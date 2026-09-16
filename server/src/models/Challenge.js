import mongoose from 'mongoose'

const challengeSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, startDate: { type: String, required: true }, duration: { type: Number, default: 75 } }, { timestamps: true })
export default mongoose.model('Challenge', challengeSchema)
