/**
 * Zero-configuration demo API.
 *
 * Starts the real Express app against a real MongoDB that lives in memory, so
 * the account layer, the protected routes and the reminder job can all be
 * exercised without a database or any credentials. Nothing here is a mock: it
 * is the same app the production entry point builds, with the connection
 * pointed somewhere disposable.
 *
 *   npm run dev:demo      # API on :4000 with an in-memory MongoDB
 *   npm run dev           # frontend on :5173, proxying /api to it
 *
 * Then sign in with "Continue as developer". Data is discarded on exit, which
 * is the point — it is for demos, not for keeping anything.
 *
 * The mongod binary is downloaded on first run by mongodb-memory-server.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { createApp } from './src/app.js'
import { env } from './src/config/env.js'

const mongod = await MongoMemoryServer.create()
await mongoose.connect(mongod.getUri('daymark_demo'))

// The unique indexes are the duplicate guards. Build them before serving so the
// demo behaves exactly like a real deployment.
await Promise.all([
  (await import('./src/models/User.js')).default.init(),
  (await import('./src/models/Habit.js')).default.init(),
  (await import('./src/models/HabitCompletion.js')).default.init(),
  (await import('./src/models/Reward.js')).default.init(),
  (await import('./src/models/Achievement.js')).default.init(),
  (await import('./src/models/ReminderLog.js')).default.init(),
])

createApp().listen(env.port, () => {
  console.log(`Demo API listening on ${env.port} with an in-memory MongoDB`)
  console.log(`  sign in with "Continue as developer" (${env.devUserEmail})`)
  console.log('  data is discarded when this process exits')
})

async function shutdown() {
  await mongoose.disconnect()
  await mongod.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
