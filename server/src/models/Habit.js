import mongoose from 'mongoose'
import { DAY_NAMES } from '../../../src/utils/constants.js'

const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // The id the browser already gave this habit. Storing it makes syncs and data
  // imports idempotent: the same local habit can be re-sent any number of times
  // and upserts onto one row instead of duplicating.
  clientId: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'Target' },
  frequency: { type: String, enum: ['daily', 'weekdays', 'custom'], default: 'daily' },
  // Day names rather than numbers: readable in the database and impossible to
  // misread as 0-based. Converted to the engine's 1-based form at the boundary.
  scheduledDays: { type: [String], enum: DAY_NAMES, default: [] },
  archived: { type: Boolean, default: false },
}, { timestamps: true })

// One habit per client id per user, and the index that makes every query
// user-scoped by construction.
habitSchema.index({ userId: 1, clientId: 1 }, { unique: true })

export default mongoose.model('Habit', habitSchema)
