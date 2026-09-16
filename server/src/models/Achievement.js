import mongoose from 'mongoose'

const achievementSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, milestone: { type: Number, required: true }, unlockedAt: { type: Date, default: Date.now } }, { timestamps: true })
achievementSchema.index({ userId: 1, milestone: 1 }, { unique: true })
export default mongoose.model('Achievement', achievementSchema)
