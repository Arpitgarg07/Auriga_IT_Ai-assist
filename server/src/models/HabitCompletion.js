import mongoose from 'mongoose'

const completionSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true }, date: { type: String, required: true } }, { timestamps: true })
completionSchema.index({ habitId: 1, date: 1 }, { unique: true })
export default mongoose.model('HabitCompletion', completionSchema)
