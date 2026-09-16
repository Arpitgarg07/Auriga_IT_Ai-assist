import { env } from './config/env.js'
import { connectDatabase, databaseStatus } from './config/database.js'
import { createApp } from './app.js'
import { startReminderScheduler } from './jobs/reminderScheduler.js'

/**
 * Process entry point: connect, listen, schedule.
 *
 * Nothing here is imported by tests — they build the app themselves with
 * createApp(), so importing this module must never have side effects beyond
 * starting the real server.
 */
async function start() {
  await connectDatabase()

  const app = createApp()

  const server = app.listen(env.port, () => {
    console.log(`Daymark API listening on port ${env.port}`)
    console.log(`  database: ${databaseStatus().connected ? 'connected' : 'not connected'}`)
    console.log(`  google sign-in: ${env.googleConfigured ? 'configured' : 'not configured'}`)
    console.log(`  dev sign-in: ${env.devLoginEnabled ? `enabled (${env.devUserEmail})` : 'disabled'}`)
    console.log(`  email reminders: ${env.emailConfigured ? 'configured' : `not configured (missing ${env.emailMissing.join(', ')})`}`)
    if (!env.sessionSecret) console.warn('  SESSION_SECRET is not set; sign-in will be refused in production')
    startReminderScheduler()
  })

  return server
}

start()

export { start }
