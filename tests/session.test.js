import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import {
  SESSION_COOKIE,
  readCookie,
  sessionCookieOptions,
  signSession,
  verifySession,
} from '../server/src/services/sessionService.js'

const SECRET = 'test-secret-value-not-a-real-one'
const sign = (payload = { sub: 'user-1' }, ttlSeconds = 3600) => signSession(payload, { secret: SECRET, ttlSeconds })

/* ------------------------------------------------------------- signing */

test('a signed session verifies and carries its subject', () => {
  const token = sign({ sub: 'abc123' })
  const payload = verifySession(token, { secret: SECRET })
  assert.equal(payload.sub, 'abc123')
  assert.ok(payload.exp > Math.floor(Date.now() / 1000))
})

test('the token has three base64url segments', () => {
  const parts = sign().split('.')
  assert.equal(parts.length, 3)
  parts.forEach((part) => assert.match(part, /^[A-Za-z0-9_-]+$/))
})

test('signing without a secret is an error, not an unsigned token', () => {
  assert.throws(() => signSession({ sub: 'x' }, { secret: '', ttlSeconds: 60 }), /secret/i)
})

/* ---------------------------------------------------------- verification */

test('a token signed with a different secret is rejected', () => {
  const token = signSession({ sub: 'abc' }, { secret: 'a-different-secret', ttlSeconds: 3600 })
  assert.equal(verifySession(token, { secret: SECRET }), null)
})

test('a tampered payload is rejected', () => {
  const [header, , signature] = sign({ sub: 'victim' }).split('.')
  // Re-encode the payload as a different subject, keeping the original signature.
  const forged = Buffer.from(JSON.stringify({ sub: 'attacker', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  assert.equal(verifySession(`${header}.${forged}.${signature}`, { secret: SECRET }), null)
})

test('a tampered signature is rejected', () => {
  const [header, payload] = sign().split('.')
  const bogus = Buffer.from('not-the-real-signature-value').toString('base64url')
  assert.equal(verifySession(`${header}.${payload}.${bogus}`, { secret: SECRET }), null)
})

test('the "none" algorithm is rejected rather than trusted', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'attacker', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  assert.equal(verifySession(`${header}.${payload}.`, { secret: SECRET }), null)
  assert.equal(verifySession(`${header}.${payload}.anything`, { secret: SECRET }), null)
})

test('an expired token is rejected', () => {
  // Signed in the past, so it is already outside its window.
  assert.equal(verifySession(sign({ sub: 'x' }, -10), { secret: SECRET }), null)
})

test('malformed input never throws, it just fails', () => {
  const bad = [null, undefined, '', '.', '..', 'a.b', 'a.b.c.d', 'not-a-token', 42, {}, []]
  bad.forEach((value) => {
    assert.equal(verifySession(value, { secret: SECRET }), null, `input: ${JSON.stringify(value)}`)
  })
})

test('a token whose payload is not valid JSON is rejected', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from('this is not json').toString('base64url')
  const signature = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest().toString('base64url')
  assert.equal(verifySession(`${header}.${payload}.${signature}`, { secret: SECRET }), null)
})

test('a correctly signed payload with no exp is rejected', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url')
  const signature = createHmac('sha256', SECRET).update(`${header}.${payload}`).digest().toString('base64url')
  assert.equal(verifySession(`${header}.${payload}.${signature}`, { secret: SECRET }), null)
})

test('verifying with no secret configured yields null rather than throwing', () => {
  assert.equal(verifySession(sign(), { secret: '' }), null)
  assert.equal(verifySession(sign(), {}), null)
})

/* -------------------------------------------------------------- cookies */

test('cookie options lock the session down', () => {
  const options = sessionCookieOptions({ secure: true })
  assert.equal(options.httpOnly, true, 'must not be readable from JavaScript')
  assert.equal(options.sameSite, 'lax')
  assert.equal(options.secure, true)
  assert.equal(options.path, '/')
  assert.ok(options.maxAge > 0)
})

test('the cookie name is stable', () => {
  assert.equal(SESSION_COOKIE, 'daymark_session')
})

test('readCookie finds a value among others', () => {
  const header = 'a=1; daymark_session=abc.def.ghi; b=2'
  assert.equal(readCookie(header, SESSION_COOKIE), 'abc.def.ghi')
  assert.equal(readCookie(header, 'a'), '1')
  assert.equal(readCookie(header, 'b'), '2')
})

test('readCookie handles padding, spaces and absence', () => {
  assert.equal(readCookie('  daymark_session = spaced  ', SESSION_COOKIE), 'spaced')
  assert.equal(readCookie('other=1', SESSION_COOKIE), null)
  assert.equal(readCookie('', SESSION_COOKIE), null)
  assert.equal(readCookie(undefined, SESSION_COOKIE), null)
  assert.equal(readCookie(null, SESSION_COOKIE), null)
})

test('readCookie does not match a cookie whose name merely ends the same', () => {
  assert.equal(readCookie('not_daymark_session=x', SESSION_COOKIE), null)
})

test('readCookie decodes a percent-encoded value', () => {
  assert.equal(readCookie('daymark_session=a%2Eb%2Ec', SESSION_COOKIE), 'a.b.c')
})

test('a cookie value containing "=" survives', () => {
  assert.equal(readCookie('daymark_session=a=b=c', SESSION_COOKIE), 'a=b=c')
})
