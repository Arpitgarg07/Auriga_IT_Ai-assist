import { Router } from 'express'
import { env } from '../config/env.js'
import { toDateKey } from '../../../src/utils/dates.js'
import { loadChallengeStart, loadHabitsForUser, previewReminderForSnapshot, runReminderJob, sendTestReminder } from '../services/reminderService.js'

const router = Router()

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const MAX_SNAPSHOT_HABITS = 200

/* -------------------------------------------------------------------------
 * Access control
 *
 * /test and /run can send mail and read the user table, so they are not public.
 * With REMINDER_ADMIN_TOKEN set, a matching x-reminder-token header is required.
 * Without it, production hides the endpoints entirely rather than leaving an
 * open mail trigger, and development allows them for local work.
 * ---------------------------------------------------------------------- */

function requireReminderAccess(request, response, next) {
  if (env.reminderAdminToken) {
    if (request.get('x-reminder-token') === env.reminderAdminToken) return next()
    return response.status(403).json({ error: 'A valid x-reminder-token header is required' })
  }
  if (env.nodeEnv === 'production') {
    return response.status(404).json({ error: 'Not found' })
  }
  return next()
}

/* -------------------------------------------------------------------------
 * Snapshot resolution
 *
 * A request may carry the client's own habits. That is what lets the reminder
 * be demonstrated with no account, no database and no OAuth: the server runs
 * the same logic module the dashboard runs, over the dashboard's own data.
 * When an authenticated user exists and no snapshot was posted, the data is
 * read from MongoDB instead.
 * ---------------------------------------------------------------------- */

function readSnapshot(body) {
  if (!Array.isArray(body?.habits)) return null
  return body.habits.slice(0, MAX_SNAPSHOT_HABITS)
}

function readDateKey(body, fallback) {
  return DATE_KEY.test(body?.dateKey || '') ? body.dateKey : fallback
}

async function resolveReminderInputs(request) {
  const snapshot = readSnapshot(request.body)
  const user = {
    name: request.body?.user?.name ?? request.user?.name ?? '',
    email: request.body?.user?.email ?? request.user?.email ?? '',
  }

  if (snapshot) {
    return { habits: snapshot, user, challengeStart: request.body?.challengeStart || null, source: 'snapshot' }
  }

  if (!request.user) {
    return { error: 'Post a habit snapshot, or authenticate to read habits from the database.', status: 400 }
  }

  const habits = await loadHabitsForUser(request.user._id)
  const challengeStart = await loadChallengeStart(request.user._id, request.user)
  return { habits, user: { name: request.user.name || '', email: request.user.email || '' }, challengeStart, source: 'database' }
}

/* ----------------------------------------------------------------- routes */

// Safe to expose: booleans and variable *names* only. The SMTP host, user and
// sender address are deliberately not returned here.
router.get('/status', (_request, response) => {
  response.json({
    configured: env.emailConfigured,
    provider: env.emailConfigured ? 'smtp' : null,
    missing: env.emailMissing,
    timezone: env.reminderTimezone,
    pollMinutes: env.reminderPollMinutes,
    schedulerEnabled: env.reminderSchedulerEnabled && env.emailConfigured,
    windowMinutes: 180,
  })
})

// Renders the exact email that would be sent, without sending it. Needs no
// credentials, no database and no account.
router.post('/preview', (request, response) => {
  const dateKey = readDateKey(request.body, toDateKey())
  const snapshot = readSnapshot(request.body)

  if (!snapshot) {
    return response.status(400).json({ error: 'A habits array is required to preview a reminder' })
  }

  const result = previewReminderForSnapshot(snapshot, {
    dateKey,
    user: { name: request.body?.user?.name || '', email: request.body?.user?.email || '' },
    challengeStart: request.body?.challengeStart || null,
  })

  return response.json(result)
})

// Sends one real reminder. Bypasses the once-per-day guard on purpose: it is an
// explicit, human-triggered test, not the scheduled job.
router.post('/test', requireReminderAccess, async (request, response) => {
  const dateKey = readDateKey(request.body, toDateKey())
  const resolved = await resolveReminderInputs(request)
  if (resolved.error) return response.status(resolved.status).json({ error: resolved.error })

  if (!resolved.user.email) {
    return response.status(400).json({ error: 'No recipient email address. Add one in Settings, or sign in.' })
  }

  const result = await sendTestReminder(resolved.habits, {
    dateKey,
    user: resolved.user,
    challengeStart: resolved.challengeStart,
  })

  const status = result.sent ? 200 : result.skipped ? 200 : 503
  return response.status(status).json({ ...result, source: resolved.source })
})

// Runs the scheduled job immediately. Requires a database: there is nothing to
// iterate over otherwise.
router.post('/run', requireReminderAccess, async (request, response) => {
  const mongoose = (await import('mongoose')).default
  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({
      error: 'Database unavailable',
      detail: 'The reminder job iterates over users, so it needs MONGODB_URI configured.',
    })
  }

  const summary = await runReminderJob({
    force: request.body?.force === true,
    dryRun: request.body?.dryRun === true,
  })
  return response.json(summary)
})

export default router
