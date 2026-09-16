import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { runReminderJob } from '../services/reminderService.js'

/**
 * Polls on an interval rather than firing at an exact wall-clock time. A cron
 * entry pinned to 08:00 would miss every user whose reminder time is not 08:00
 * and would be fragile across restarts; polling every REMINDER_POLL_MINUTES and
 * letting each user's own time decide is both simpler and more correct. The
 * per-day ReminderLog makes a repeated tick harmless.
 *
 * Returns the timer, or null when the scheduler is not running, so the caller
 * can report why.
 */
export function startReminderScheduler() {
  if (!env.reminderSchedulerEnabled) {
    console.log('Reminder scheduler: disabled via REMINDER_SCHEDULER=off')
    return null
  }
  if (!env.emailConfigured) {
    console.log(`Reminder scheduler: idle — email not configured (missing ${env.emailMissing.join(', ')})`)
    return null
  }

  const intervalMs = env.reminderPollMinutes * 60 * 1000
  let inFlight = false

  const tick = async () => {
    // Never stack runs, and never query a database that is not connected.
    if (inFlight || mongoose.connection.readyState !== 1) return
    inFlight = true
    try {
      const summary = await runReminderJob()
      if (summary.sent || summary.failed) {
        console.log(`Reminder job: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed (${summary.timezone})`)
      }
    } catch (error) {
      // The scheduler must survive anything a single run throws.
      console.error(`Reminder job failed: ${error.message}`)
    } finally {
      inFlight = false
    }
  }

  const timer = setInterval(tick, intervalMs)
  const bootTimer = setTimeout(tick, 5000)

  // Do not hold the process open just for reminders.
  if (typeof timer.unref === 'function') timer.unref()
  if (typeof bootTimer.unref === 'function') bootTimer.unref()

  console.log(`Reminder scheduler: every ${env.reminderPollMinutes} min, timezone ${env.reminderTimezone}`)
  return timer
}
