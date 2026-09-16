import mongoose from 'mongoose'

/**
 * One row per user, per channel, per day. The compound unique index is what
 * actually prevents a duplicate reminder: two schedulers racing, a retried
 * request or a restart mid-send all collide on this index instead of sending a
 * second email.
 *
 * Status is deliberately tri-state so a failed send can be retried later:
 *   pending -> an attempt is in flight
 *   sent    -> delivered; never send again for this dateKey
 *   failed  -> the attempt did not land; a later tick may try again
 */
const reminderLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: String, enum: ['email'], default: 'email' },
  dateKey: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  claimedAt: Date,
  sentAt: Date,
  error: String,
}, { timestamps: true })

reminderLogSchema.index({ userId: 1, channel: 1, dateKey: 1 }, { unique: true })

export default mongoose.model('ReminderLog', reminderLogSchema)
