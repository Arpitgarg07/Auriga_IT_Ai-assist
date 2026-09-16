import { Router } from 'express'
import Achievement from '../models/Achievement.js'
import { requireAuth } from '../middleware/auth.js'
import { MILESTONES } from '../../../src/utils/constants.js'

const router = Router()

router.get('/', requireAuth, async (request, response) => {
  const achievements = await Achievement.find({ userId: request.user._id }).sort({ milestone: 1 }).lean()
  response.json({
    achievements: achievements.map((row) => ({
      id: String(row._id),
      milestone: row.milestone,
      unlockedAt: row.unlockedAt,
    })),
  })
})

/**
 * Records a reached milestone. Idempotent — the unique { userId, milestone }
 * index means a repeat call cannot create a duplicate or re-fire a celebration
 * on another device.
 */
router.post('/', requireAuth, async (request, response) => {
  const milestone = Number(request.body?.milestone)
  if (!MILESTONES.includes(milestone)) {
    return response.status(400).json({ error: `milestone must be one of ${MILESTONES.join(', ')}` })
  }

  await Achievement.updateOne(
    { userId: request.user._id, milestone },
    { $setOnInsert: { userId: request.user._id, milestone, unlockedAt: new Date() } },
    { upsert: true },
  )

  const achievements = await Achievement.find({ userId: request.user._id }).sort({ milestone: 1 }).lean()
  return response.status(201).json({ achievements: achievements.map((row) => row.milestone) })
})

export default router
