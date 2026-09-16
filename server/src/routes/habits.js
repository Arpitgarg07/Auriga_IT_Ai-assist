import { Router } from 'express'
import crypto from 'node:crypto'
import Habit from '../models/Habit.js'
import HabitCompletion from '../models/HabitCompletion.js'
import { requireAuth } from '../middleware/auth.js'
import { customDaysToScheduledDays, presentHabit } from '../services/habitMapper.js'

const router = Router()

const FREQUENCIES = ['daily', 'weekdays', 'custom']

async function present(habit) {
  const completions = await HabitCompletion.find({ userId: habit.userId, habitId: habit._id }).select('date').lean()
  return presentHabit(habit, completions.map((row) => row.date))
}

function validate(body) {
  if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) return 'A habit name is required'
  if (body.frequency && !FREQUENCIES.includes(body.frequency)) return `frequency must be one of ${FREQUENCIES.join(', ')}`
  if (body.frequency === 'custom' && !Array.isArray(body.customDays)) return 'customDays is required for a custom schedule'
  return null
}

// Every query is scoped by userId taken from the session, never from the
// request. There is no code path here that can read or write another user's row.
router.get('/', requireAuth, async (request, response) => {
  const filter = { userId: request.user._id }
  if (request.query.archived === 'true') filter.archived = true
  if (request.query.archived === 'false') filter.archived = false

  const habits = await Habit.find(filter).sort({ createdAt: 1 })
  response.json({ habits: await Promise.all(habits.map(present)) })
})

router.post('/', requireAuth, async (request, response) => {
  const problem = validate(request.body)
  if (problem) return response.status(400).json({ error: problem })

  const frequency = request.body.frequency || 'daily'
  const habit = await Habit.create({
    userId: request.user._id,
    clientId: typeof request.body.id === 'string' && request.body.id ? request.body.id : crypto.randomUUID(),
    name: request.body.name.trim(),
    description: request.body.description || '',
    icon: request.body.icon || 'Target',
    frequency,
    scheduledDays: frequency === 'custom' ? customDaysToScheduledDays(request.body.customDays) : [],
  })

  return response.status(201).json({ habit: await present(habit) })
})

router.put('/:id', requireAuth, async (request, response) => {
  const problem = validate(request.body)
  if (problem) return response.status(400).json({ error: problem })

  const frequency = request.body.frequency || 'daily'
  const habit = await Habit.findOneAndUpdate(
    { _id: request.params.id, userId: request.user._id },
    {
      $set: {
        name: request.body.name.trim(),
        description: request.body.description || '',
        icon: request.body.icon || 'Target',
        frequency,
        scheduledDays: frequency === 'custom' ? customDaysToScheduledDays(request.body.customDays) : [],
      },
    },
    { new: true },
  )
  if (!habit) return response.status(404).json({ error: 'Habit not found' })
  return response.json({ habit: await present(habit) })
})

// Soft delete: the flag flips, the history stays, and a restore brings the
// streaks back exactly as they were.
router.post('/:id/archive', requireAuth, async (request, response) => {
  const habit = await Habit.findOneAndUpdate(
    { _id: request.params.id, userId: request.user._id },
    { $set: { archived: true } },
    { new: true },
  )
  if (!habit) return response.status(404).json({ error: 'Habit not found' })
  return response.json({ habit: await present(habit) })
})

router.post('/:id/restore', requireAuth, async (request, response) => {
  const habit = await Habit.findOneAndUpdate(
    { _id: request.params.id, userId: request.user._id },
    { $set: { archived: false } },
    { new: true },
  )
  if (!habit) return response.status(404).json({ error: 'Habit not found' })
  return response.json({ habit: await present(habit) })
})

// Permanent removal, including its completion history. Distinct from archive,
// which is what the app uses day to day.
router.delete('/:id', requireAuth, async (request, response) => {
  const habit = await Habit.findOneAndDelete({ _id: request.params.id, userId: request.user._id })
  if (!habit) return response.status(404).json({ error: 'Habit not found' })
  await HabitCompletion.deleteMany({ userId: request.user._id, habitId: habit._id })
  return response.status(204).end()
})

export default router
