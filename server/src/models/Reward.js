import mongoose from 'mongoose'

const rewardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientId: { type: String, default: null },
  // `title` per the data model; presented to the client as `name`.
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  milestone: { type: Number, required: true, min: 1 },
  claimed: { type: Boolean, default: false },
  claimedAt: { type: Date, default: null },
}, { timestamps: true })

rewardSchema.index({ userId: 1, milestone: 1 })
// Sparse so rewards created directly through the API (with no client id) do not
// collide on a shared null.
rewardSchema.index({ userId: 1, clientId: 1 }, { unique: true, sparse: true })

export default mongoose.model('Reward', rewardSchema)
