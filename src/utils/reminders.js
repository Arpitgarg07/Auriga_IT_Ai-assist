import { fromDateKey } from './dates.js'
import { getBestStreak, getCurrentStreak, isHabitScheduledOnDate } from './streaks.js'
import { DEFAULT_REMINDER_TIME, scheduleLabel } from './constants.js'
import { dayOfYear } from './motivation.js'

/* -------------------------------------------------------------------------
 * Today's board
 *
 * The brief's first four steps — today's date, which habits are scheduled,
 * which are already logged, which are still waiting — resolved in one place so
 * the reminder, the Home board and the morning modal cannot disagree.
 *
 * Scheduling is delegated to isHabitScheduledOnDate, so weekday habits do not
 * fire on Saturday or Sunday and custom habits fire only on their chosen days.
 * Archived habits are filtered here, which is what keeps them out of reminders.
 * ---------------------------------------------------------------------- */

export function getTodaysHabits(habits, dateKey) {
  const date = fromDateKey(dateKey)
  const isLogged = (habit) => (habit.completions || []).includes(dateKey)
  const due = (habits || []).filter((habit) => !habit.archived && isHabitScheduledOnDate(habit, date))
  return {
    dateKey,
    due,
    logged: due.filter(isLogged),
    pending: due.filter((habit) => !isLogged(habit)),
  }
}

export function getTodaysPendingHabits(habits, dateKey) {
  return getTodaysHabits(habits, dateKey).pending
}

/* -------------------------------------------------------------------------
 * Streak context
 *
 * A pending habit has a streak genuinely "on the line" only when its current
 * run is already non-zero. getCurrentStreak steps back past an incomplete
 * today, so a non-zero value means the run is alive through the last scheduled
 * day and today's check-off is precisely what continues it. That is the only
 * situation in which "don't let today break your streak" is a true statement,
 * and the only situation this module will say it.
 *
 * A pending habit with a zero streak has nothing to break, so it gets ordinary
 * encouragement instead. No streak language is ever emitted for it.
 * ---------------------------------------------------------------------- */

export function pendingWithStreaks(habits, dateKey) {
  const date = fromDateKey(dateKey)
  return getTodaysPendingHabits(habits, dateKey).map((habit) => ({
    habit,
    current: getCurrentStreak(habit, date),
    best: getBestStreak(habit),
    schedule: scheduleLabel(habit),
  }))
}

// The single pending habit whose live streak is longest, or null when no
// pending habit can truthfully claim one.
export function streakAtRisk(entries) {
  const live = entries.filter((entry) => entry.current > 0)
  if (!live.length) return null
  return live.reduce((best, entry) => (entry.current > best.current ? entry : best))
}

/* -------------------------------------------------------------------------
 * Copy
 * ---------------------------------------------------------------------- */

// Deliberately free of the word "streak". When no pending habit has a live run,
// nothing in this pool may imply one exists — which makes the guarantee a plain
// string check in the tests rather than a judgement call.
const ENCOURAGEMENT = [
  'A fresh start today. Tick one off and the momentum begins.',
  'Nothing to defend yet — today is where it begins.',
  'Begin with the smallest one. The rest follows.',
  'One check-off is all it takes to start something.',
]

const ALL_DONE_MESSAGES = [
  'Come back tomorrow and keep the streak alive.',
  'Everything is logged. Rest is part of the plan.',
  'Nothing left today. Tomorrow starts from a stronger place.',
]

function pick(pool, dateKey) {
  const seed = dayOfYear(fromDateKey(dateKey))
  return pool[seed % pool.length]
}

// "Happy Tuesday!" — used under the greeting.
export function dayNameGreeting(dateKey) {
  return `Happy ${fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'long' })}!`
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm
}

/* -------------------------------------------------------------------------
 * The reminder view-model
 *
 * getMorningReminder is the one thing the UI reads. It never invents data: the
 * counts, names and streak numbers all come from stored completions through the
 * existing streak engine.
 * ---------------------------------------------------------------------- */

export function getMorningReminder(habits, dateKey) {
  const { due, logged, pending } = getTodaysHabits(habits, dateKey)
  const entries = pendingWithStreaks(habits, dateKey)
  const atRisk = streakAtRisk(entries)

  const total = due.length
  const pendingCount = pending.length
  const completedCount = logged.length
  const mode = total === 0 ? 'rest' : pendingCount === 0 ? 'complete' : 'pending'

  let headline
  let message

  if (mode === 'rest') {
    headline = 'Nothing scheduled today'
    message = 'No habits are due today. Enjoy the pause — it is part of the plan.'
  } else if (mode === 'complete') {
    headline = "You're all done for today!"
    message = pick(ALL_DONE_MESSAGES, dateKey)
  } else {
    headline = `${pendingCount} ${plural(pendingCount, 'habit', 'habits')} waiting for you`
    // Streak language appears only when a pending habit's run is provably live.
    // Because atRisk is null exactly when no pending habit has a current streak,
    // the fallback branch can never imply a streak that does not exist.
    message = atRisk
      ? `You've maintained a ${atRisk.current}-day streak. Don't let today's ${atRisk.habit.name} be the one that breaks it! 🔥`
      : pick(ENCOURAGEMENT, dateKey)
  }

  return {
    dateKey,
    mode,
    headline,
    message,
    due,
    logged,
    pending,
    items: entries,
    total,
    pendingCount,
    completedCount,
    // True only when a streak claim is provably accurate.
    hasStreakAtRisk: Boolean(atRisk),
    streak: atRisk,
    allDone: mode === 'complete',
    nothingScheduled: mode === 'rest',
  }
}

/* -------------------------------------------------------------------------
 * Once-per-day behaviour and reminder time
 * ---------------------------------------------------------------------- */

// The morning modal belongs to the first open of a new day and never repeats.
export function shouldShowMorningModal(reminder, reminders) {
  if (!reminders?.enabled) return false
  if (reminder.mode === 'rest') return false
  return reminders.lastShownDate !== reminder.dateKey
}

export function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function isPastReminderTime(reminderTime, now = new Date()) {
  const target = toMinutes(reminderTime)
  if (target === null) return true
  return now.getHours() * 60 + now.getMinutes() >= target
}

// 12-hour display for the settings hint. Falls back to the raw value.
export function formatReminderTime(time) {
  const minutes = toMinutes(time)
  if (minutes === null) return time || DEFAULT_REMINDER_TIME
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const suffix = hours < 12 ? 'AM' : 'PM'
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${String(mins).padStart(2, '0')} ${suffix}`
}

/* -------------------------------------------------------------------------
 * Browser notifications
 *
 * Deliberately limited to what a page can honestly do. There is no push server
 * and no service worker in this project, so a notification can only be raised
 * while Daymark is open. Everything below is gated on the real permission
 * state, and the UI states this limitation rather than implying background
 * delivery works.
 * ---------------------------------------------------------------------- */

export function notificationSupport() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationSupport()) return 'unsupported'
  return window.Notification.permission // 'default' | 'granted' | 'denied'
}

// `notifiedDate` is the date a notification was last raised, passed in by the
// caller so this stays a pure decision and is trivially testable.
export function shouldNotifyBrowser(reminder, reminders, notifiedDate, now = new Date()) {
  if (!reminders?.enabled || !reminders?.browserNotifications) return false
  if (reminder.pendingCount === 0) return false
  if (notifiedDate === reminder.dateKey) return false
  if (notificationPermission() !== 'granted') return false
  return isPastReminderTime(reminders.time, now)
}

export function notificationBody(reminder) {
  if (reminder.hasStreakAtRisk) {
    return `${reminder.pendingCount} ${plural(reminder.pendingCount, 'habit', 'habits')} left — your ${reminder.streak.current}-day streak on ${reminder.streak.habit.name} is on the line.`
  }
  return `${reminder.pendingCount} ${plural(reminder.pendingCount, 'habit', 'habits')} still waiting today.`
}
