import mongoose from 'mongoose'
import User from '../models/User.js'
import { cookieSecure, env } from '../config/env.js'
import { SESSION_COOKIE, readCookie, sessionCookieOptions, signSession, verifySession } from '../services/sessionService.js'

/**
 * Resolves the signed session cookie into a real user document.
 *
 * The frontend never supplies an identity — there is no userId parameter
 * anywhere in the API. Every handler reads `request.user`, which is set here
 * and nowhere else, so a client cannot ask for another user's data even if it
 * tries.
 *
 * Never throws: a malformed cookie, a tampered token, a stale session for a
 * deleted user or a database outage all resolve to "not signed in", and the
 * request continues so public routes still work.
 */
export async function attachUser(request, _response, next) {
  request.user = null

  try {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE)
    const payload = token ? verifySession(token, { secret: env.sessionSecret }) : null

    if (payload?.sub && mongoose.connection.readyState === 1 && mongoose.isValidObjectId(payload.sub)) {
      request.user = await User.findById(payload.sub).lean()
    }
  } catch {
    request.user = null
  }

  return next()
}

export function requireAuth(request, response, next) {
  if (!request.user) {
    return response.status(401).json({
      error: 'Authentication required',
      detail: 'Sign in to use account features. The app keeps working locally without an account.',
    })
  }
  return next()
}

export function sessionConfigured() {
  return Boolean(env.sessionSecret)
}

export function issueSession(response, user, { request } = {}) {
  const token = signSession(
    { sub: String(user._id) },
    { secret: env.sessionSecret, ttlSeconds: env.sessionTtlSeconds },
  )
  response.cookie(SESSION_COOKIE, token, sessionCookieOptions({ secure: cookieSecure }))
  void request
  return token
}

export function clearSession(response) {
  response.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: cookieSecure })
}
