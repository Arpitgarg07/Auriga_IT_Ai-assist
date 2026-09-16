import crypto from 'node:crypto'

/**
 * Stateless session tokens: a compact HS256-signed payload carried in an
 * httpOnly cookie. Implemented directly on node:crypto so the project gains no
 * auth dependency, and so every step (signing, verification, expiry, algorithm
 * pinning) is small enough to be read in one sitting and tested exhaustively.
 *
 * This is a JWT in shape. It is NOT a general-purpose JWT library: only HS256
 * is supported, there are no claims beyond sub/iat/exp, and the algorithm is
 * pinned rather than read from the token.
 */

const ALGORITHM = 'HS256'
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

function sign(encoded, secret) {
  return crypto.createHmac('sha256', secret).update(encoded).digest().toString('base64url')
}

export function signSession(payload, { secret, ttlSeconds }) {
  if (!secret) throw new Error('A session secret is required to sign a session')
  const issuedAt = Math.floor(Date.now() / 1000)
  const encoded = `${encode({ alg: ALGORITHM, typ: 'JWT' })}.${encode({ ...payload, iat: issuedAt, exp: issuedAt + ttlSeconds })}`
  return `${encoded}.${sign(encoded, secret)}`
}

/**
 * Returns the token payload, or null for anything at all suspicious: wrong
 * shape, wrong algorithm, bad signature, malformed JSON or expired.
 */
export function verifySession(token, { secret } = {}) {
  if (!secret || typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts
  if (!headerPart || !payloadPart || !signaturePart) return null

  const expected = Buffer.from(sign(`${headerPart}.${payloadPart}`, secret))
  const given = Buffer.from(signaturePart)
  // Length must match before a timing-safe compare, which throws on mismatch.
  if (given.length !== expected.length) return null
  if (!crypto.timingSafeEqual(given, expected)) return null

  try {
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'))
    // Pin the algorithm: never trust the token to tell us how it was signed.
    if (header?.alg !== ALGORITHM) return null

    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
    if (typeof payload?.exp !== 'number') return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'daymark_session'

export function sessionCookieOptions({ secure, maxAge = 1000 * 60 * 60 * 24 * 30 }) {
  return {
    httpOnly: true,          // not readable from JavaScript
    sameSite: 'lax',         // sent on top-level navigations (the OAuth return), not cross-site POSTs
    secure,                  // HTTPS-only in production
    path: '/',
    maxAge,
  }
}

/**
 * Minimal cookie reader. Express provides res.cookie but only cookie-parser
 * adds req.cookies, and this is the whole of what is needed from it.
 */
export function readCookie(header, name) {
  if (typeof header !== 'string' || !header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    const raw = part.slice(separator + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}
