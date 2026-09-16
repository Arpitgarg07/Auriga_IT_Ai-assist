import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  // Sparse: local and developer accounts have no Google id, and a unique index
  // over a column with many nulls would reject the second such account.
  googleId: { type: String, index: { unique: true, sparse: true } },
  name: { type: String, default: '' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  avatar: { type: String, default: '' },

  // Challenge start. The current day is always derived from this at read time;
  // no progress is ever stored, so it cannot drift from the completions.
  challengeStartDate: { type: String, default: null },

  // Top-level so the reminder job's query is a simple indexed lookup.
  reminderEnabled: { type: Boolean, default: false },
  reminderTime: { type: String, default: '08:00' },
  // Null falls back to the server-wide REMINDER_TIMEZONE.
  timezone: { type: String, default: null },

  preferences: {
    motivationalMessages: { type: Boolean, default: true },
    celebrationEffects: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
  },
}, { timestamps: true })

// The scheduler asks for "everyone with reminders on"; this makes that cheap.
userSchema.index({ reminderEnabled: 1 })

export default mongoose.model('User', userSchema)
