import { Router } from 'express'
import Habit from '../models/Habit.js'
import HabitCompletion from '../models/HabitCompletion.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

// Confirms the habit exists *and* belongs to the caller. Every write goes
// through this, so a signed-in user can never attach a completion to someone
// else's habit by guessing an id.
async function ownedHabit(userId, habitId) {
  if (!habitId || !/^[a-f\d]{24}$/i.test(String(habitId))) return null
  return Habit.findOne({ _id: habitId, userId }).lean()
}

router.get('/', requireAuth, async (request, response) => {
  const filter = { userId: request.user._id }
  if (request.query.habitId) {
    const habit = await ownedHabit(request.user._id, request.query.habitId)
    if (!habit) return response.status(404).json({ error: 'Habit not found' })
    filter.habitId = habit._id
  }
  if (DATE_KEY.test(request.query.from || '')) filter.date = { ...filter.date, $gte: request.query.from }
  if (DATE_KEY.test(request.query.to || '')) filter.date = { ...filter.date, $lte: request.query.to }

  const completions = await HabitCompletion.find(filter).sort({ date: -1 }).lean()
  return response.json({
    completions: completions.map((row) => ({
      id: String(row._id),
      habitId: String(row.habitId),
      date: row.date,
      completedAt: row.completedAt,
    })),
  })
})

// Idempotent by design: the unique index means repeating this is a no-op, which
// makes a retried request from a flaky connection harmless.
router.post('/', requireAuth, async (request, response) => {
  const { habitId, date } = request.body || {}
  if (!DATE_KEY.test(date || '')) return response.status(400).json({ error: 'date must be YYYY-MM-DD' })

  const habit = await ownedHabit(request.user._id, habitId)
  if (!habit) return response.status(404).json({ error: 'Habit not found' })

  const completion = await HabitCompletion.findOneAndUpdate(
    { userId: request.user._id, habitId: habit._id, date },
    { $setOnInsert: { userId: request.user._id, habitId: habit._id, date, completedAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  return response.status(201).json({
    completion: {
      id: String(completion._id),
      habitId: String(completion.habitId),
      date: completion.date,
      completedAt: completion.completedAt,
    },
  })
})

router.delete('/:habitId/:date', requireAuth, async (request, response) => {
  const { habitId, date } = request.params
  if (!DATE_KEY.test(date)) return response.status(400).json({ error: 'date must be YYYY-MM-DD' })

  const habit = await ownedHabit(request.user._id, habitId)
  if (!habit) return response.status(404).json({ error: 'Habit not found' })

  const result = await HabitCompletion.deleteOne({ userId: request.user._id, habitId: habit._id, date })
  return response.json({ removed: result.deletedCount })
})

export default router
