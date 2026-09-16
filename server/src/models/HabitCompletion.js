import mongoose from 'mongoose'

const completionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
  // The logical habit day as a local calendar key, not a timestamp. A date is
  // what the streak engine reasons about; the moment it was ticked is only
  // metadata, which is why completedAt is a separate field.
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  completedAt: { type: Date, default: Date.now },
}, { timestamps: true })

// The duplicate guard: one habit can be completed at most once per day.
completionSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true })

export default mongoose.model('HabitCompletion', completionSchema)
