import crypto from 'node:crypto'
import { Router } from 'express'
import User from '../models/User.js'
import Challenge from '../models/Challenge.js'
import Habit from '../models/Habit.js'
import { cookieSecure, env } from '../config/env.js'
import { databaseProblem } from '../config/database.js'
import { clearSession, issueSession, requireAuth, sessionConfigured } from '../middleware/auth.js'
import { readCookie, sessionCookieOptions } from '../services/sessionService.js'

const router = Router()

const STATE_COOKIE = 'daymark_oauth_state'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

function callbackUrl() {
  return env.googleCallbackUrl || `${env.apiUrl}/api/auth/google/callback`
}

// Public description of what sign-in options exist. Deliberately says nothing
// about secrets — only whether the provider is usable.
router.get('/providers', (_request, response) => {
  const database = databaseProblem()
  response.json({
    google: env.googleConfigured && !database,
    developer: env.devLoginEnabled && !database,
    database: !database,
    databaseMissing: database?.missing || [],
    session: sessionConfigured(),
  })
})

/**
 * Starts the OAuth dance. The state value is random, stored in a short-lived
 * httpOnly cookie and compared on return, which is what stops a third party
 * from feeding the callback a code that is not ours.
 */
router.get('/google', (request, response) => {
  const problem = databaseProblem()
  if (problem) return response.status(problem.status).json({ error: problem.error, detail: problem.detail })
  if (!env.googleConfigured) {
    return response.status(503).json({
      error: 'Google sign-in is not configured',
      detail: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.',
      missing: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    })
  }

  const state = crypto.randomBytes(24).toString('base64url')
  response.cookie(STATE_COOKIE, state, sessionCookieOptions({ secure: cookieSecure, maxAge: 1000 * 60 * 10 }))

  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', env.googleClientId)
  url.searchParams.set('redirect_uri', callbackUrl())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('prompt', 'select_account')

  return response.redirect(url.toString())
})

router.get('/google/callback', async (request, response) => {
  const fail = (reason) => response.redirect(`${env.clientUrl}/?auth=failed&reason=${encodeURIComponent(reason)}`)

  const problem = databaseProblem()
  if (problem) return fail(problem.error)
  if (!env.googleConfigured) return fail('not-configured')

  const { code, state } = request.query
  const expectedState = readCookie(request.headers.cookie, STATE_COOKIE)
  response.clearCookie(STATE_COOKIE, { path: '/' })

  if (!code || typeof code !== 'string') return fail('missing-code')
  if (!state || !expectedState || state !== expectedState) return fail('state-mismatch')

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: callbackUrl(),
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenResponse.ok) return fail('token-exchange-failed')
    const tokens = await tokenResponse.json()

    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!profileResponse.ok) return fail('profile-fetch-failed')
    const profile = await profileResponse.json()

    if (!profile?.email) return fail('no-email')

    // Upsert on email rather than googleId so a user who first signed in locally
    // and later links Google keeps their history.
    const user = await User.findOneAndUpdate(
      { email: String(profile.email).toLowerCase() },
      {
        $set: {
          googleId: profile.sub,
          name: profile.name || '',
          avatar: profile.picture || '',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )

    // First sign-in starts the challenge today; it is never faked afterwards.
    if (!user.challengeStartDate) {
      user.challengeStartDate = new Date().toISOString().slice(0, 10)
      await user.save()
      await Challenge.findOneAndUpdate(
        { userId: user._id },
        { startDate: user.challengeStartDate, duration: 75 },
        { upsert: true },
      )
    }

    issueSession(response, user)
    return response.redirect(`${env.clientUrl}/?auth=ok`)
  } catch (error) {
    console.error(`Google sign-in failed: ${error.message}`)
    return fail('unexpected-error')
  }
})

/**
 * Development-only sign-in. Never enabled in production, and requires an
 * explicit opt-in even in development. It exists so the whole account layer —
 * protected routes, user isolation, the reminder job reading MongoDB — can be
 * exercised without Google credentials.
 */
router.post('/dev', async (_request, response) => {
  if (!env.devLoginEnabled) {
    return response.status(404).json({ error: 'Not found' })
  }
  const problem = databaseProblem()
  if (problem) return response.status(problem.status).json({ error: problem.error, detail: problem.detail })

  const email = env.devUserEmail.toLowerCase()
  const user = await User.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, name: env.devUserName, challengeStartDate: new Date().toISOString().slice(0, 10) } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )

  issueSession(response, user)
  return response.json({ user: await presentUser(user) })
})

router.post('/logout', (request, response) => {
  clearSession(response)
  return response.json({ ok: true, wasSignedIn: Boolean(request.user) })
})

/* -------------------------------------------------------------------------
 * Account shape returned to the client
 * ---------------------------------------------------------------------- */

// The challenge day is always derived from the start date, never stored, so it
// cannot disagree with the completions.
export function challengeDayFor(startDate, todayKey, duration = 75) {
  if (!startDate) return { started: false, day: 0, duration, percent: 0, remaining: duration }
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const today = Date.parse(`${todayKey}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(today)) return { started: false, day: 0, duration, percent: 0, remaining: duration }
  const elapsed = Math.floor((today - start) / 86400000)
  if (elapsed < 0) return { started: false, day: 0, duration, percent: 0, remaining: duration }
  const day = Math.min(duration, elapsed + 1)
  return { started: true, day, duration, percent: Math.round((day / duration) * 100), remaining: Math.max(0, duration - day) }
}

export async function presentUser(user) {
  return {
    id: String(user._id),
    name: user.name || '',
    email: user.email,
    avatar: user.avatar || '',
    challengeStartDate: user.challengeStartDate || null,
    reminderEnabled: Boolean(user.reminderEnabled),
    reminderTime: user.reminderTime || '08:00',
    preferences: {
      motivationalMessages: user.preferences?.motivationalMessages !== false,
      celebrationEffects: user.preferences?.celebrationEffects !== false,
      theme: user.preferences?.theme || 'light',
    },
    createdAt: user.createdAt,
  }
}

// The canonical account endpoint. Registered at /api/me by app.js rather than
// under /api/auth, because it is the entry point the client calls on load.
export async function meHandler(request, response) {
  const [challenge, habitCount] = await Promise.all([
    Challenge.findOne({ userId: request.user._id }).lean(),
    Habit.countDocuments({ userId: request.user._id, archived: false }),
  ])
  return response.json({
    user: await presentUser(request.user),
    challenge: challenge ? { startDate: challenge.startDate, duration: challenge.duration } : null,
    habitCount,
  })
}

// Kept as an alias so either path works.
router.get('/me', requireAuth, meHandler)

export default router
