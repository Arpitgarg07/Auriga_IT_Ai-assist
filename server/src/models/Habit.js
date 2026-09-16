import mongoose from 'mongoose'

const habitSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, name: { type: String, required: true }, description: String, frequency: { type: String, enum: ['daily', 'weekdays', 'custom'], default: 'daily' }, customDays: [Number], archived: { type: Boolean, default: false } }, { timestamps: true })
export default mongoose.model('Habit', habitSchema)
