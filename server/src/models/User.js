import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  googleId: String,
  name: String,
  email: { type: String, required: true, unique: true },
  avatar: String,
  challengeStartDate: String,
  preferences: { motivationalMessages: { type: Boolean, default: true }, celebrationEffects: { type: Boolean, default: true } },
}, { timestamps: true })

export default mongoose.model('User', userSchema)
