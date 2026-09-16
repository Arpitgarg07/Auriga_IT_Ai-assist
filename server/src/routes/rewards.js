import { Router } from 'express'
import crypto from 'node:crypto'
import Reward from '../models/Reward.js'
import { requireAuth } from '../middleware/auth.js'
import { presentReward } from '../services/habitMapper.js'
import { MILESTONES } from '../../../src/utils/constants.js'

const router = Router()

function validate(body) {
  const title = String(body?.name || body?.title || '').trim()
  if (!title) return 'A reward title is required'
  if (!MILESTONES.includes(Number(body?.milestone))) return `milestone must be one of ${MILESTONES.join(', ')}`
  return null
}

router.get('/', requireAuth, async (request, response) => {
  const rewards = await Reward.find({ userId: request.user._id }).sort({ milestone: 1 })
  response.json({ rewards: rewards.map(presentReward) })
})

router.post('/', requireAuth, async (request, response) => {
  const problem = validate(request.body)
  if (problem) return response.status(400).json({ error: problem })

  const reward = await Reward.create({
    userId: request.user._id,
    clientId: typeof request.body.id === 'string' && request.body.id ? request.body.id : crypto.randomUUID(),
    title: String(request.body.name || request.body.title).trim(),
    description: request.body.description || '',
    milestone: Number(request.body.milestone),
  })

  return response.status(201).json({ reward: presentReward(reward) })
})

router.put('/:id', requireAuth, async (request, response) => {
  const problem = validate(request.body)
  if (problem) return response.status(400).json({ error: problem })

  const reward = await Reward.findOneAndUpdate(
    { _id: request.params.id, userId: request.user._id },
    {
      $set: {
        title: String(request.body.name || request.body.title).trim(),
        description: request.body.description || '',
        milestone: Number(request.body.milestone),
      },
    },
    { new: true },
  )
  if (!reward) return response.status(404).json({ error: 'Reward not found' })
  return response.json({ reward: presentReward(reward) })
})

router.post('/:id/claim', requireAuth, async (request, response) => {
  const reward = await Reward.findOneAndUpdate(
    { _id: request.params.id, userId: request.user._id },
    { $set: { claimed: true, claimedAt: new Date() } },
    { new: true },
  )
  if (!reward) return response.status(404).json({ error: 'Reward not found' })
  return response.json({ reward: presentReward(reward) })
})

router.delete('/:id', requireAuth, async (request, response) => {
  const reward = await Reward.findOneAndDelete({ _id: request.params.id, userId: request.user._id })
  if (!reward) return response.status(404).json({ error: 'Reward not found' })
  return response.status(204).end()
})

export default router
