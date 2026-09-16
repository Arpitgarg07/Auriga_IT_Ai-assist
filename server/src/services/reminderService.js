import { env } from '../config/env.js'
import User from '../models/User.js'
import Habit from '../models/Habit.js'
import HabitCompletion from '../models/HabitCompletion.js'
import Challenge from '../models/Challenge.js'
import ReminderLog from '../models/ReminderLog.js'
import { CHALLENGE_LENGTH } from '../../../src/utils/constants.js'
import { daysBetween } from '../../../src/utils/dates.js'
import { pendingWithStreaks, streakAtRisk } from '../../../src/utils/reminders.js'
import { createReminderEmail, sendEmail, sendMorningHabitReminder } from './emailService.js'
import { presentHabit } from './habitMapper.js'

/* -------------------------------------------------------------------------
 * Timezone handling
 *
 * Users have no timezone field, so one server-wide zone is used (REMINDER_
 * TIMEZONE). Everything is derived from Intl rather than manual offset maths,
 * which keeps DST correct. `zonedNow` returns both the user's calendar date and
 * their local minute-of-day, so the same value drives "which day is it for this
 * user" and "is it past their reminder time".
 * ---------------------------------------------------------------------- */

export function zonedNow(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const lookup = {}
  parts.forEach((part) => { lookup[part.type] = part.value })

  return {
    dateKey: `${lookup.year}-${lookup.month}-${lookup.day}`,
    minutes: Number(lookup.hour) * 60 + Number(lookup.minute),
  }
}

// How late a reminder may still be sent. A server that was down at 08:00 should
// not deliver a "good morning" email at 23:00.
export const REMINDER_WINDOW_MINUTES = 180

export function isWithinReminderWindow(reminderTimeMinutes, nowMinutes) {
  if (reminderTimeMinutes === null) return false
  const elapsed = nowMinutes - reminderTimeMinutes
  return elapsed >= 0 && elapsed <= REMINDER_WINDOW_MINUTES
}

export function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/* -------------------------------------------------------------------------
 * Data access
 *
 * Habits and completions live in two collections. They are joined back into the
 * single shape the shared logic module expects, and archived habits are passed
 * through untouched — getTodaysHabits is the one place that filters them, so
 * the email can never include something the dashboard would not.
 * ---------------------------------------------------------------------- */

export async function loadHabitsForUser(userId) {
  const [habits, completions] = await Promise.all([
    Habit.find({ userId }).lean(),
    HabitCompletion.find({ userId }).lean(),
  ])

  const byHabit = new Map()
  completions.forEach((entry) => {
    const key = String(entry.habitId)
    if (!byHabit.has(key)) byHabit.set(key, [])
    byHabit.get(key).push(entry.date)
  })

  // presentHabit is the same mapper the API uses, so the job sees exactly the
  // shape the browser sees — including the scheduledDays -> customDays
  // conversion the streak engine depends on for custom schedules.
  return habits.map((habit) => presentHabit(habit, byHabit.get(String(habit._id)) || []))
}

export async function loadChallengeStart(userId, user) {
  const challenge = await Challenge.findOne({ userId }).lean()
  return challenge?.startDate || user?.challengeStartDate || null
}

/* -------------------------------------------------------------------------
 * Computation
 *
 * `computeReminder` runs the exact same module the browser runs. The email and
 * the dashboard therefore cannot disagree about which habits are outstanding,
 * and no streak arithmetic is duplicated on the server.
 * ---------------------------------------------------------------------- */

export function computeReminder(habits, dateKey, { challengeStart = null, user = {}, now = new Date() } = {}) {
  const entries = pendingWithStreaks(habits, dateKey)
  const streak = streakAtRisk(entries)

  let challengeDay = 0
  if (challengeStart) {
    const elapsed = daysBetween(challengeStart, dateKey)
    challengeDay = elapsed >= 0 ? Math.min(CHALLENGE_LENGTH, elapsed + 1) : 0
  }

  return {
    entries,
    streak,
    hasPending: entries.length > 0,
    context: {
      dateKey,
      challengeStart,
      challengeDay,
      appUrl: env.clientUrl,
      now,
    },
    user,
  }
}

/* -------------------------------------------------------------------------
 * Duplicate protection
 *
 * A unique index on { userId, channel, dateKey } makes the claim atomic: two
 * schedulers racing, a retried request, or a restart mid-send cannot produce a
 * second email for the same day. A failed send is recorded as `failed`, never
 * as `sent`, so a later tick may retry it.
 * ---------------------------------------------------------------------- */

export async function claimReminder(userId, dateKey) {
  try {
    return await ReminderLog.findOneAndUpdate(
      { userId, channel: 'email', dateKey, status: { $ne: 'sent' } },
      {
        $set: { status: 'pending', claimedAt: new Date(), error: null },
        $inc: { attempts: 1 },
        $setOnInsert: { userId, channel: 'email', dateKey },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
  } catch (error) {
    // The upsert collided with the unique index, which only happens when a
    // `sent` record already exists for today. That is the duplicate guard.
    if (error?.code === 11000) return null
    throw error
  }
}

export async function recordReminderResult(log, result) {
  if (!log) return
  const update = result.sent
    ? { status: 'sent', sentAt: new Date(), error: null }
    : { status: 'failed', error: result.error || 'Unknown send failure' }
  await ReminderLog.updateOne({ _id: log._id }, { $set: update })
}

export async function hasSentToday(userId, dateKey) {
  const existing = await ReminderLog.findOne({ userId, channel: 'email', dateKey, status: 'sent' }).lean()
  return Boolean(existing)
}

/* -------------------------------------------------------------------------
 * The job
 * ---------------------------------------------------------------------- */

/**
 * Finds users with email reminders enabled, works out what each still has
 * outstanding today, and emails only those who have something left.
 *
 * Never throws: a single failing user, a mail outage or a database hiccup is
 * recorded in the summary so the caller (route or scheduler) stays healthy.
 */
export async function runReminderJob({ now = new Date(), force = false, dryRun = false, userId = null } = {}) {
  const timeZone = env.reminderTimezone
  const summary = {
    ranAt: now.toISOString(),
    timezone: timeZone,
    dryRun,
    considered: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  }

  const query = { reminderEnabled: true }
  if (userId) query._id = userId

  const users = await User.find(query).lean()
  summary.considered = users.length

  for (const user of users) {
    const { dateKey, minutes } = zonedNow(now, user.timezone || timeZone)
    const reminderMinutes = parseTimeToMinutes(user.reminderTime)

    if (!force && !isWithinReminderWindow(reminderMinutes, minutes)) {
      summary.skipped += 1
      summary.details.push({ userId: String(user._id), outcome: 'skipped', reason: 'Outside reminder window' })
      continue
    }

    if (!user.email) {
      summary.skipped += 1
      summary.details.push({ userId: String(user._id), outcome: 'skipped', reason: 'No email address on the account' })
      continue
    }

    try {
      const habits = await loadHabitsForUser(user._id)
      const challengeStart = await loadChallengeStart(user._id, user)
      const { entries, context } = computeReminder(habits, dateKey, { challengeStart, user, now })

      if (!entries.length) {
        summary.skipped += 1
        summary.details.push({ userId: String(user._id), outcome: 'skipped', reason: 'Nothing pending today' })
        continue
      }

      if (dryRun) {
        summary.skipped += 1
        summary.details.push({ userId: String(user._id), outcome: 'dry-run', pending: entries.length, dateKey })
        continue
      }

      const log = await claimReminder(user._id, dateKey)
      if (!log) {
        summary.skipped += 1
        summary.details.push({ userId: String(user._id), outcome: 'skipped', reason: 'Already sent today' })
        continue
      }

      const result = await sendMorningHabitReminder(user, entries, context)
      await recordReminderResult(log, result)

      if (result.sent) {
        summary.sent += 1
        summary.details.push({ userId: String(user._id), outcome: 'sent', pending: entries.length, dateKey })
      } else {
        summary.failed += 1
        summary.details.push({ userId: String(user._id), outcome: 'failed', reason: result.error, dateKey })
      }
    } catch (error) {
      // One user's problem must not stop the run.
      console.error(`Reminder job failed for user ${user._id}: ${error.message}`)
      summary.failed += 1
      summary.details.push({ userId: String(user._id), outcome: 'failed', reason: error.message })
    }
  }

  return summary
}

/* -------------------------------------------------------------------------
 * Manual / demo paths
 * ---------------------------------------------------------------------- */

/**
 * Renders the email without sending it. Works from a client-supplied habit
 * snapshot when no database is configured, which is what makes the feature
 * demonstrable without an account, a database or SMTP credentials.
 */
export function previewReminderForSnapshot(habits, { dateKey, user = {}, challengeStart = null, now = new Date() }) {
  const { entries, streak, context } = computeReminder(habits, dateKey, { challengeStart, user, now })
  if (!entries.length) {
    return { sent: false, skipped: true, reason: 'No pending habits for this date', dateKey }
  }
  const email = createReminderEmail(user, entries, context)
  return {
    skipped: false,
    dateKey,
    subject: email.subject,
    html: email.html,
    text: email.text,
    habitCount: entries.length,
    habits: entries.map((entry) => ({ name: entry.habit.name, streak: entry.current })),
    hasStreakAtRisk: Boolean(streak),
  }
}

/**
 * Sends a real email for a supplied snapshot, bypassing the database and the
 * duplicate guard (it is a deliberate one-off test).
 */
export async function sendTestReminder(habits, { dateKey, user = {}, challengeStart = null, now = new Date() } = {}) {
  const { entries, context } = computeReminder(habits, dateKey, { challengeStart, user, now })
  if (!entries.length) {
    return { sent: false, skipped: true, reason: 'No pending habits for this date', dateKey }
  }
  if (!user.email) {
    return { sent: false, error: 'No recipient email address supplied', dateKey }
  }
  const email = createReminderEmail(user, entries, context)
  const result = await sendEmail({ to: user.email, ...email })
  return { ...result, dateKey, subject: email.subject, habitCount: entries.length }
}
