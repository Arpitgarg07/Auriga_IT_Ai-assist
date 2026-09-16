import mongoose from 'mongoose'

const rewardSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, name: { type: String, required: true }, description: String, milestone: { type: Number, required: true }, claimed: { type: Boolean, default: false } }, { timestamps: true })
export default mongoose.model('Reward', rewardSchema)
