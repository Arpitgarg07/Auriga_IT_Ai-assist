import { Router } from 'express'
import Challenge from '../models/Challenge.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { toDateKey } from '../../../src/utils/dates.js'
import { challengeDayFor } from './auth.js'

const router = Router()

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

router.get('/', requireAuth, async (request, response) => {
  const challenge = await Challenge.findOne({ userId: request.user._id }).lean()
  const startDate = challenge?.startDate || request.user.challengeStartDate || null
  const duration = challenge?.duration || 75

  return response.json({
    challenge: startDate ? { startDate, duration } : null,
    // Derived on every read from the start date and today, never stored, so the
    // displayed day can never drift from the completions.
    progress: challengeDayFor(startDate, toDateKey(), duration),
  })
})

router.put('/', requireAuth, async (request, response) => {
  const { startDate, duration } = request.body || {}
  if (!DATE_KEY.test(startDate || '')) {
    return response.status(400).json({ error: 'startDate must be YYYY-MM-DD' })
  }
  const days = Number(duration) || 75
  if (days < 1 || days > 365) return response.status(400).json({ error: 'duration must be between 1 and 365' })

  const challenge = await Challenge.findOneAndUpdate(
    { userId: request.user._id },
    { startDate, duration: days },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
  await User.updateOne({ _id: request.user._id }, { $set: { challengeStartDate: startDate } })

  return response.json({
    challenge: { startDate: challenge.startDate, duration: challenge.duration },
    progress: challengeDayFor(challenge.startDate, toDateKey(), challenge.duration),
  })
})

export default router
