import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { databaseStatus } from './config/database.js'
import { attachUser, requireAuth } from './middleware/auth.js'
import { requireDatabase } from './middleware/requireDatabase.js'
import { getConnectionStatus, getFitnessSummary } from './services/googleHealthService.js'
import authRoutes, { meHandler } from './routes/auth.js'
import syncRoutes from './routes/sync.js'
import habitRoutes from './routes/habits.js'
import completionRoutes from './routes/completions.js'
import rewardRoutes from './routes/rewards.js'
import achievementRoutes from './routes/achievements.js'
import challengeRoutes from './routes/challenge.js'
import analyticsRoutes from './routes/analytics.js'
import reminderRoutes from './routes/reminders.js'

/**
 * Builds the Express application without binding a port or connecting to
 * anything. Keeping construction separate from startup is what lets the API be
 * exercised over real HTTP in tests, where the port and the database are chosen
 * by the test rather than by the environment.
 */
export function createApp() {
  const app = express()

  // Credentials must be allowed for the session cookie to travel between the
  // Vite dev server and this API.
  app.use(cors({ origin: env.clientUrl, credentials: true }))
  app.use(express.json({ limit: '1mb' }))

  // Resolves the session cookie into request.user for every route below. This
  // is the only place an identity is ever established.
  app.use(attachUser)

  /* -------------------------------------------------------------- public */

  app.get('/api/health', (_request, response) => response.json({
    ok: true,
    ...databaseStatus(),
    email: env.emailConfigured,
    googleAuth: env.googleConfigured,
    session: Boolean(env.sessionSecret),
  }))

  app.get('/api/fitness/status', (_request, response) => response.json(getConnectionStatus()))
  app.get('/api/fitness/summary', async (_request, response) => response.json(await getFitnessSummary()))

  // Sign-in options and the OAuth handshake. Public by necessity.
  app.use('/api/auth', authRoutes)

  // /status and /preview are safe to expose: no credentials, no database, and
  // /preview only renders markup from a snapshot the caller supplies.
  app.use('/api/reminders', reminderRoutes)

  /* ----------------------------------------------------------- protected */

  // Everything below needs a verified session and a live database. Each router
  // scopes its own queries by request.user._id — no route accepts a userId.
  app.get('/api/me', requireAuth, requireDatabase, meHandler)
  app.use('/api', requireAuth, requireDatabase, syncRoutes)
  app.use('/api/habits', requireAuth, requireDatabase, habitRoutes)
  app.use('/api/completions', requireAuth, requireDatabase, completionRoutes)
  app.use('/api/rewards', requireAuth, requireDatabase, rewardRoutes)
  app.use('/api/achievements', requireAuth, requireDatabase, achievementRoutes)
  app.use('/api/challenge', requireAuth, requireDatabase, challengeRoutes)
  app.use('/api/analytics', requireAuth, requireDatabase, analyticsRoutes)

  /* -------------------------------------------------------------- errors */

  app.use((_request, response) => response.status(404).json({ error: 'Not found' }))

  // Express 5 forwards rejected async handlers here automatically, so a thrown
  // error in any route becomes a JSON response rather than a hanging request.
  app.use((error, _request, response, _next) => {
    console.error(error)
    const status = error.status || (error.name === 'ValidationError' ? 400 : 500)
    return response.status(status).json({ error: error.message || 'Internal server error' })
  })

  return app
}

export default createApp
