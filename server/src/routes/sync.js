import { Router } from 'express'
import User from '../models/User.js'
import Habit from '../models/Habit.js'
import HabitCompletion from '../models/HabitCompletion.js'
import Challenge from '../models/Challenge.js'
import Reward from '../models/Reward.js'
import Achievement from '../models/Achievement.js'
import { requireAuth } from '../middleware/auth.js'
import { customDaysToScheduledDays, presentHabit, presentReward } from '../services/habitMapper.js'
import { MILESTONES } from '../../../src/utils/constants.js'

const router = Router()

const MAX_HABITS = 300
const MAX_REWARDS = 200
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const FREQUENCIES = ['daily', 'weekdays', 'custom']

/* -------------------------------------------------------------------------
 * Reading the account
 * ---------------------------------------------------------------------- */

export async function loadAccount(userId) {
  const [habits, completions, rewards, achievements, challenge] = await Promise.all([
    Habit.find({ userId }).sort({ createdAt: 1 }).lean(),
    HabitCompletion.find({ userId }).select('habitId date').lean(),
    Reward.find({ userId }).sort({ milestone: 1 }).lean(),
    Achievement.find({ userId }).sort({ milestone: 1 }).lean(),
    Challenge.findOne({ userId }).lean(),
  ])

  const byHabit = new Map()
  completions.forEach((entry) => {
    const key = String(entry.habitId)
    if (!byHabit.has(key)) byHabit.set(key, [])
    byHabit.get(key).push(entry.date)
  })

  return {
    // Archived habits are included on purpose: the client owns that filter, and
    // its Manage tab needs to be able to restore them.
    habits: habits.map((habit) => presentHabit(habit, byHabit.get(String(habit._id)) || [])),
    rewards: rewards.map(presentReward),
    achievements: achievements.map((entry) => entry.milestone),
    challengeStart: challenge?.startDate || null,
    challengeDuration: challenge?.duration || 75,
  }
}

router.get('/bootstrap', requireAuth, async (request, response) => {
  const account = await loadAccount(request.user._id)
  response.json({
    ...account,
    user: {
      id: String(request.user._id),
      name: request.user.name || '',
      email: request.user.email,
      avatar: request.user.avatar || '',
    },
    reminderEnabled: Boolean(request.user.reminderEnabled),
    reminderTime: request.user.reminderTime || '08:00',
  })
})

/* -------------------------------------------------------------------------
 * Writing the account
 *
 * One idempotent endpoint handles both the one-off import of a browser's local
 * data and the ongoing writes the app makes while signed in. Everything is
 * keyed on the client id the browser already assigned, so sending the same
 * payload twice changes nothing the second time.
 *
 * This is deliberately a whole-account replace rather than a diff protocol: the
 * data is small, the client already holds the full picture in state, and a
 * single idempotent call is far harder to get wrong than a stream of deltas.
 * ---------------------------------------------------------------------- */

async function reconcileCompletions(userId, habitId, desired) {
  const wanted = new Set((Array.isArray(desired) ? desired : []).filter((key) => DATE_KEY.test(key)))
  const existing = await HabitCompletion.find({ userId, habitId }).select('date').lean()
  const current = new Set(existing.map((row) => row.date))

  const toAdd = [...wanted].filter((date) => !current.has(date))
  const toRemove = [...current].filter((date) => !wanted.has(date))

  if (toAdd.length) {
    await HabitCompletion.bulkWrite(
      toAdd.map((date) => ({
        updateOne: {
          filter: { userId, habitId, date },
          update: { $setOnInsert: { userId, habitId, date, completedAt: new Date() } },
          upsert: true,
        },
      })),
      { ordered: false },
    )
  }
  if (toRemove.length) {
    await HabitCompletion.deleteMany({ userId, habitId, date: { $in: toRemove } })
  }
  return { added: toAdd.length, removed: toRemove.length }
}

function normaliseHabit(input, index) {
  const frequency = FREQUENCIES.includes(input?.frequency) ? input.frequency : 'daily'
  return {
    clientId: typeof input?.id === 'string' && input.id ? input.id : `imported-${index}`,
    name: String(input?.name || '').trim().slice(0, 200),
    description: String(input?.description || '').slice(0, 1000),
    icon: String(input?.icon || 'Target').slice(0, 40),
    frequency,
    // Daily and weekday habits carry no explicit day list; only custom does.
    scheduledDays: frequency === 'custom' ? customDaysToScheduledDays(input?.customDays) : [],
    archived: Boolean(input?.archived),
    completions: (Array.isArray(input?.completions) ? input.completions : []).filter((key) => DATE_KEY.test(key)),
  }
}

router.post('/sync', requireAuth, async (request, response) => {
  const userId = request.user._id
  const body = request.body || {}
  const result = { habits: 0, completionsAdded: 0, completionsRemoved: 0, rewards: 0, achievements: 0, challenge: false, user: false }

  /* habits + their completions */
  const incoming = Array.isArray(body.habits) ? body.habits.slice(0, MAX_HABITS) : null
  if (incoming) {
    const keepClientIds = []

    for (const [index, raw] of incoming.entries()) {
      const habit = normaliseHabit(raw, index)
      if (!habit.name) continue
      keepClientIds.push(habit.clientId)

      const doc = await Habit.findOneAndUpdate(
        { userId, clientId: habit.clientId },
        {
          $set: {
            name: habit.name,
            description: habit.description,
            icon: habit.icon,
            frequency: habit.frequency,
            scheduledDays: habit.scheduledDays,
            archived: habit.archived,
          },
          $setOnInsert: { userId, clientId: habit.clientId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )

      const delta = await reconcileCompletions(userId, doc._id, habit.completions)
      result.completionsAdded += delta.added
      result.completionsRemoved += delta.removed
      result.habits += 1
    }

    // Anything the client no longer has — a habit it deleted outright rather
    // than archived — is removed here, together with its history.
    const stale = await Habit.find({ userId, clientId: { $nin: keepClientIds } }).select('_id').lean()
    if (stale.length) {
      const staleIds = stale.map((row) => row._id)
      await Promise.all([
        Habit.deleteMany({ userId, _id: { $in: staleIds } }),
        HabitCompletion.deleteMany({ userId, habitId: { $in: staleIds } }),
      ])
    }
    result.habitsRemoved = stale.length
  }

  /* rewards */
  const rewards = Array.isArray(body.rewards) ? body.rewards.slice(0, MAX_REWARDS) : null
  if (rewards) {
    const keep = []
    for (const raw of rewards) {
      const title = String(raw?.name || raw?.title || '').trim().slice(0, 200)
      const milestone = Number(raw?.milestone)
      if (!title || !MILESTONES.includes(milestone)) continue
      const clientId = typeof raw?.id === 'string' && raw.id ? raw.id : `reward-${milestone}-${title}`
      keep.push(clientId)

      await Reward.findOneAndUpdate(
        { userId, clientId },
        {
          $set: {
            title,
            description: String(raw?.description || '').slice(0, 1000),
            milestone,
            claimed: Boolean(raw?.claimed),
            claimedAt: raw?.claimed ? new Date(raw.claimedAt || Date.now()) : null,
          },
          $setOnInsert: { userId, clientId },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      result.rewards += 1
    }
    await Reward.deleteMany({ userId, clientId: { $nin: keep } })
  }

  /* achievements */
  if (Array.isArray(body.achievements)) {
    const reached = body.achievements.map(Number).filter((value) => MILESTONES.includes(value))
    if (reached.length) {
      await Achievement.bulkWrite(
        reached.map((milestone) => ({
          updateOne: {
            filter: { userId, milestone },
            update: { $setOnInsert: { userId, milestone, unlockedAt: new Date() } },
            upsert: true,
          },
        })),
        { ordered: false },
      )
    }
    result.achievements = reached.length
  }

  /* challenge + account settings */
  if (DATE_KEY.test(body.challengeStart || '')) {
    await Challenge.findOneAndUpdate(
      { userId },
      { startDate: body.challengeStart, duration: 75 },
      { upsert: true },
    )
    await User.updateOne({ _id: userId }, { $set: { challengeStartDate: body.challengeStart } })
    result.challenge = true
  }

  const userUpdate = {}
  if (typeof body.reminderEnabled === 'boolean') userUpdate.reminderEnabled = body.reminderEnabled
  if (typeof body.reminderTime === 'string' && /^\d{1,2}:\d{2}$/.test(body.reminderTime)) userUpdate.reminderTime = body.reminderTime
  if (body.profile && typeof body.profile === 'object') {
    if (typeof body.profile.name === 'string') userUpdate.name = body.profile.name.slice(0, 120)
    if (typeof body.profile.avatar === 'string') userUpdate.avatar = body.profile.avatar.slice(0, 500)
    // Email is the account key and is owned by the auth provider, so it is not
    // writable from the app.
  }
  if (body.preferences && typeof body.preferences === 'object') {
    userUpdate.preferences = {
      motivationalMessages: body.preferences.motivationalMessages !== false,
      celebrationEffects: body.preferences.celebrationEffects !== false,
      theme: ['light', 'dark', 'system'].includes(body.preferences.theme) ? body.preferences.theme : 'light',
    }
  }
  if (Object.keys(userUpdate).length) {
    await User.updateOne({ _id: userId }, { $set: userUpdate })
    result.user = true
  }

  const account = await loadAccount(userId)
  return response.json({ ...result, ...account })
})

export { reconcileCompletions, normaliseHabit }
export default router
