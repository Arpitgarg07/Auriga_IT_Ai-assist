import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { createApp } from '../server/src/app.js'
import { env } from '../server/src/config/env.js'
import { signSession } from '../server/src/services/sessionService.js'
import { claimReminder, recordReminderResult, hasSentToday, runReminderJob, loadHabitsForUser } from '../server/src/services/reminderService.js'
import User from '../server/src/models/User.js'
import Habit from '../server/src/models/Habit.js'
import HabitCompletion from '../server/src/models/HabitCompletion.js'
import Reward from '../server/src/models/Reward.js'
import Achievement from '../server/src/models/Achievement.js'
import Challenge from '../server/src/models/Challenge.js'
import ReminderLog from '../server/src/models/ReminderLog.js'

/**
 * End-to-end tests against a real MongoDB and the real Express stack.
 *
 * These exist because the rules that matter most here — user isolation, the
 * duplicate guards, the reminder job reading its data from the database — are
 * enforced by database indexes and middleware, not by the functions a unit test
 * would call. A fake would prove nothing about them.
 */

let mongod
let server
let base

before(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri('daymark_test'))

  // Index creation is asynchronous. The unique indexes ARE the duplicate
  // guards, so every test below depends on these having been built.
  await Promise.all([
    User.init(), Habit.init(), HabitCompletion.init(), Reward.init(),
    Achievement.init(), Challenge.init(), ReminderLog.init(),
  ])

  server = createApp().listen(0)
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await mongoose.disconnect()
  await mongod?.stop()
})

/* ---------------------------------------------------------------- helpers */

function makeClient(initialCookie = '') {
  let cookie = initialCookie

  return {
    get cookie() { return cookie },
    async request(path, { method = 'GET', body } = {}) {
      const headers = {}
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      if (cookie) headers.Cookie = cookie

      const response = await fetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean)
      setCookies.forEach((entry) => {
        const pair = entry.split(';')[0]
        if (pair.startsWith('daymark_session=')) cookie = pair
      })

      const text = await response.text()
      let data = null
      if (text) { try { data = JSON.parse(text) } catch { data = text } }
      return { status: response.status, data }
    },
  }
}

// Signs a session directly, so a test can be any user it likes. The dev sign-in
// route only ever produces one fixed account, and user isolation needs two.
function clientFor(user) {
  const token = signSession({ sub: String(user._id) }, { secret: env.sessionSecret, ttlSeconds: 3600 })
  return makeClient(`daymark_session=${token}`)
}

let userCounter = 0
async function makeUser(overrides = {}) {
  userCounter += 1
  return User.create({
    email: `user${userCounter}@example.test`,
    name: `User ${userCounter}`,
    challengeStartDate: '2026-09-01',
    ...overrides,
  })
}

const TODAY = '2026-09-16' // a Wednesday

/* --------------------------------------------------- 1-4. server + auth */

test('the server answers health without a database session', async () => {
  const client = makeClient()
  const result = await client.request('/api/health')
  assert.equal(result.status, 200)
  assert.equal(result.data.ok, true)
  assert.equal(result.data.connected, true, 'the in-memory database is connected')
})

test('the API boots and serves even before any sign-in', async () => {
  const client = makeClient()
  const providers = await client.request('/api/auth/providers')
  assert.equal(providers.status, 200)
  assert.equal(providers.data.database, true)
  assert.equal(typeof providers.data.google, 'boolean')
  assert.equal(typeof providers.data.developer, 'boolean')
})

test('authentication: developer sign-in issues a session that identifies the user', async () => {
  const client = makeClient()
  const signIn = await client.request('/api/auth/dev', { method: 'POST' })
  assert.equal(signIn.status, 200, `dev sign-in failed: ${JSON.stringify(signIn.data)}`)
  assert.ok(client.cookie.startsWith('daymark_session='), 'a session cookie is set')

  const me = await client.request('/api/me')
  assert.equal(me.status, 200)
  assert.equal(me.data.user.email, env.devUserEmail)
  assert.ok(me.data.user.id)
})

test('authentication: signing out invalidates the session', async () => {
  const client = makeClient()
  await client.request('/api/auth/dev', { method: 'POST' })
  assert.equal((await client.request('/api/me')).status, 200)

  await client.request('/api/auth/logout', { method: 'POST' })
  const after = await client.request('/api/me')
  assert.equal(after.status, 401)
})

test('a forged or tampered session cookie is rejected', async () => {
  const user = await makeUser()
  const real = signSession({ sub: String(user._id) }, { secret: env.sessionSecret, ttlSeconds: 3600 })
  const [header, , signature] = real.split('.')

  const forgedPayload = Buffer.from(JSON.stringify({ sub: String(user._id), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
  const wrongSecret = signSession({ sub: String(user._id) }, { secret: 'not-the-real-secret', ttlSeconds: 3600 })

  for (const token of [`${header}.${forgedPayload}.${signature}`, wrongSecret, 'garbage', 'a.b.c']) {
    const client = makeClient(`daymark_session=${token}`)
    assert.equal((await client.request('/api/me')).status, 401, `should reject: ${token.slice(0, 24)}`)
  }
})

/* ------------------------------------------------ 4. protected routes */

test('every protected route refuses an anonymous request', async () => {
  const client = makeClient()
  const paths = [
    ['GET', '/api/me'], ['GET', '/api/bootstrap'], ['GET', '/api/habits'],
    ['GET', '/api/completions'], ['GET', '/api/rewards'], ['GET', '/api/achievements'],
    ['GET', '/api/challenge'], ['GET', '/api/analytics'],
    ['POST', '/api/sync'], ['POST', '/api/habits'],
  ]

  for (const [method, path] of paths) {
    const result = await client.request(path, { method, body: method === 'POST' ? {} : undefined })
    assert.equal(result.status, 401, `${method} ${path} should require authentication`)
  }
})

/* -------------------------------------- 5. user isolation (the big one) */

test('a user cannot see another user\'s habits', async () => {
  const alice = await makeUser()
  const bob = await makeUser()
  const aliceClient = clientFor(alice)
  const bobClient = clientFor(bob)

  await aliceClient.request('/api/habits', { method: 'POST', body: { id: 'a1', name: 'Alice private habit' } })
  await bobClient.request('/api/habits', { method: 'POST', body: { id: 'b1', name: 'Bob private habit' } })

  const aliceHabits = (await aliceClient.request('/api/habits')).data.habits
  const bobHabits = (await bobClient.request('/api/habits')).data.habits

  assert.deepEqual(aliceHabits.map((h) => h.name), ['Alice private habit'])
  assert.deepEqual(bobHabits.map((h) => h.name), ['Bob private habit'])
})

test('a user cannot read, edit or archive another user\'s habit by id', async () => {
  const alice = await makeUser()
  const bob = await makeUser()
  const aliceHabit = (await clientFor(alice).request('/api/habits', {
    method: 'POST', body: { id: 'a1', name: 'Alice habit' },
  })).data.habit

  const bobClient = clientFor(bob)
  const id = aliceHabit.id

  assert.equal((await bobClient.request(`/api/habits/${id}`, { method: 'PUT', body: { name: 'Hijacked' } })).status, 404)
  assert.equal((await bobClient.request(`/api/habits/${id}/archive`, { method: 'POST' })).status, 404)
  assert.equal((await bobClient.request(`/api/habits/${id}`, { method: 'DELETE' })).status, 404)

  // And nothing actually changed.
  const stillAlice = (await clientFor(alice).request('/api/habits')).data.habits[0]
  assert.equal(stillAlice.name, 'Alice habit')
  assert.equal(stillAlice.archived, false)
})

test('a user cannot attach a completion to another user\'s habit', async () => {
  const alice = await makeUser()
  const bob = await makeUser()
  const aliceHabit = (await clientFor(alice).request('/api/habits', {
    method: 'POST', body: { id: 'a1', name: 'Alice habit' },
  })).data.habit

  const result = await clientFor(bob).request('/api/completions', {
    method: 'POST', body: { habitId: aliceHabit.id, date: TODAY },
  })
  assert.equal(result.status, 404, 'another user\'s habit is not addressable')

  const stored = await HabitCompletion.countDocuments({ habitId: aliceHabit.id })
  assert.equal(stored, 0, 'no completion was written')
})

test('a user cannot claim another user\'s reward by id', async () => {
  const alice = await makeUser()
  const bob = await makeUser()
  const reward = (await clientFor(alice).request('/api/rewards', {
    method: 'POST', body: { name: 'Alice reward', milestone: 7 },
  })).data.reward

  assert.equal((await clientFor(bob).request(`/api/rewards/${reward.id}/claim`, { method: 'POST' })).status, 404)
  assert.equal((await clientFor(bob).request(`/api/rewards/${reward.id}`, { method: 'DELETE' })).status, 404)
})

/* ---------------------------------------------------- 6. habit CRUD */

test('habit CRUD round-trips through the API', async () => {
  const client = clientFor(await makeUser())

  const created = await client.request('/api/habits', {
    method: 'POST',
    body: { id: 'h-crud', name: 'Workout', description: 'Move', icon: 'Dumbbell', frequency: 'custom', customDays: [1, 3, 5] },
  })
  assert.equal(created.status, 201)
  const habit = created.data.habit
  assert.equal(habit.name, 'Workout')
  // Stored as day names, presented as the engine's 1-based numbers.
  assert.deepEqual(habit.scheduledDays, ['monday', 'wednesday', 'friday'])
  assert.deepEqual(habit.customDays, [1, 3, 5])

  const updated = await client.request(`/api/habits/${habit.id}`, {
    method: 'PUT', body: { name: 'Workout (harder)', frequency: 'weekdays' },
  })
  assert.equal(updated.data.habit.name, 'Workout (harder)')
  assert.equal(updated.data.habit.frequency, 'weekdays')

  const archived = await client.request(`/api/habits/${habit.id}/archive`, { method: 'POST' })
  assert.equal(archived.data.habit.archived, true)

  const restored = await client.request(`/api/habits/${habit.id}/restore`, { method: 'POST' })
  assert.equal(restored.data.habit.archived, false)

  assert.equal((await client.request(`/api/habits/${habit.id}`, { method: 'DELETE' })).status, 204)
  assert.equal((await client.request('/api/habits')).data.habits.length, 0)
})

test('a habit without a name is rejected', async () => {
  const client = clientFor(await makeUser())
  assert.equal((await client.request('/api/habits', { method: 'POST', body: { name: '   ' } })).status, 400)
})

/* ---------------------------------------- 7. completion persistence */

test('completions persist, are idempotent and can be removed', async () => {
  const client = clientFor(await makeUser())
  const habit = (await client.request('/api/habits', { method: 'POST', body: { id: 'c1', name: 'Read' } })).data.habit

  const first = await client.request('/api/completions', { method: 'POST', body: { habitId: habit.id, date: TODAY } })
  assert.equal(first.status, 201)

  // Repeating the same completion must not create a second row.
  await client.request('/api/completions', { method: 'POST', body: { habitId: habit.id, date: TODAY } })
  assert.equal(await HabitCompletion.countDocuments({ habitId: habit.id, date: TODAY }), 1)

  const listed = await client.request(`/api/completions?habitId=${habit.id}`)
  assert.equal(listed.data.completions.length, 1)
  assert.equal(listed.data.completions[0].date, TODAY)
  assert.ok(listed.data.completions[0].completedAt, 'completedAt is recorded')

  const removed = await client.request(`/api/completions/${habit.id}/${TODAY}`, { method: 'DELETE' })
  assert.equal(removed.data.removed, 1)
  assert.equal(await HabitCompletion.countDocuments({ habitId: habit.id }), 0)
})

test('a malformed completion date is rejected', async () => {
  const client = clientFor(await makeUser())
  const habit = (await client.request('/api/habits', { method: 'POST', body: { id: 'c2', name: 'Read' } })).data.habit
  assert.equal((await client.request('/api/completions', { method: 'POST', body: { habitId: habit.id, date: '16-09-2026' } })).status, 400)
})

/* ------------------------------------------- 8. rewards persistence */

test('rewards persist with their claimed state', async () => {
  const client = clientFor(await makeUser())

  const created = await client.request('/api/rewards', { method: 'POST', body: { name: 'Buy a new dress', milestone: 14 } })
  assert.equal(created.status, 201)
  const reward = created.data.reward
  // Stored as `title`, presented as `name` — the shape the UI already uses.
  assert.equal(reward.name, 'Buy a new dress')
  assert.equal(reward.claimed, false)
  assert.equal(reward.claimedAt, null)

  const claimed = await client.request(`/api/rewards/${reward.id}/claim`, { method: 'POST' })
  assert.equal(claimed.data.reward.claimed, true)
  assert.ok(claimed.data.reward.claimedAt, 'claimedAt is stamped')

  const persisted = await Reward.findById(reward.id).lean()
  assert.equal(persisted.title, 'Buy a new dress')
  assert.equal(persisted.claimed, true)

  assert.equal((await client.request('/api/rewards')).data.rewards.length, 1)
  assert.equal((await client.request(`/api/rewards/${reward.id}`, { method: 'DELETE' })).status, 204)
})

test('a reward with an invalid milestone is rejected', async () => {
  const client = clientFor(await makeUser())
  assert.equal((await client.request('/api/rewards', { method: 'POST', body: { name: 'Nope', milestone: 4 } })).status, 400)
})

/* ------------------------------------- 9. achievement persistence */

test('achievements persist and cannot be duplicated', async () => {
  const client = clientFor(await makeUser())

  const first = await client.request('/api/achievements', { method: 'POST', body: { milestone: 7 } })
  assert.equal(first.status, 201)
  assert.deepEqual(first.data.achievements, [7])

  // The unique index makes a repeat a no-op rather than a duplicate.
  const second = await client.request('/api/achievements', { method: 'POST', body: { milestone: 7 } })
  assert.deepEqual(second.data.achievements, [7])
  assert.equal(await Achievement.countDocuments({ milestone: 7 }), 1)

  await client.request('/api/achievements', { method: 'POST', body: { milestone: 30 } })
  const listed = await client.request('/api/achievements')
  assert.deepEqual(listed.data.achievements.map((a) => a.milestone), [7, 30])
  assert.ok(listed.data.achievements[0].unlockedAt)
})

test('an invalid milestone is rejected', async () => {
  const client = clientFor(await makeUser())
  assert.equal((await client.request('/api/achievements', { method: 'POST', body: { milestone: 5 } })).status, 400)
})

/* ------------------------------------------------- 9b. challenge */

test('the challenge day is derived, never stored', async () => {
  const user = await makeUser({ challengeStartDate: '2026-09-02' })
  const client = clientFor(user)

  const first = await client.request('/api/challenge')
  assert.equal(first.data.challenge.startDate, '2026-09-02')
  assert.equal(first.data.challenge.duration, 75)

  // Setting a start moves the derived day; nothing about progress is persisted.
  const updated = await client.request('/api/challenge', { method: 'PUT', body: { startDate: '2026-09-01' } })
  assert.equal(updated.data.challenge.startDate, '2026-09-01')
  assert.equal(updated.data.progress.duration, 75)
  assert.ok(updated.data.progress.day >= 1)

  const stored = await Challenge.findOne({ userId: user._id }).lean()
  assert.ok(stored, 'the challenge was persisted')
  assert.equal(stored.duration, 75)
  assert.equal(stored.progress, undefined, 'no progress field is written')
})

/* ------------------------------ 10-13. the reminder job reads the database */

test('the reminder job computes pending habits from the database', async () => {
  const user = await makeUser({ reminderEnabled: true, reminderTime: '08:00', timezone: 'Asia/Kolkata' })
  const client = clientFor(user)

  // Three daily habits: one completed, one archived, one still pending.
  const pending = (await client.request('/api/habits', { method: 'POST', body: { id: 'p1', name: 'Drink Water' } })).data.habit
  const done = (await client.request('/api/habits', { method: 'POST', body: { id: 'p2', name: 'Read' } })).data.habit
  const archived = (await client.request('/api/habits', { method: 'POST', body: { id: 'p3', name: 'Old habit' } })).data.habit

  await client.request('/api/completions', { method: 'POST', body: { habitId: done.id, date: TODAY } })
  await client.request(`/api/habits/${archived.id}/archive`, { method: 'POST' })

  // 08:00 IST is 02:30 UTC — inside the reminder window.
  const summary = await runReminderJob({ now: new Date('2026-09-16T02:30:00Z'), dryRun: true, userId: user._id })
  const detail = summary.details.find((entry) => entry.userId === String(user._id))

  assert.ok(detail, 'the user was considered')
  assert.equal(detail.outcome, 'dry-run')
  assert.equal(detail.dateKey, TODAY, 'the date is derived in the user\'s timezone')
  assert.equal(detail.pending, 1, 'only the unlogged, active, due-today habit counts')

  // And the same three habits shaped for the engine agree.
  const habits = await loadHabitsForUser(user._id)
  assert.equal(habits.length, 3, 'archived habits are loaded, then filtered by the shared logic')
  assert.ok(habits.every((habit) => Array.isArray(habit.completions)))
  void pending
})

test('the job skips a user whose reminders are switched off', async () => {
  const user = await makeUser({ reminderEnabled: false })
  const summary = await runReminderJob({ now: new Date('2026-09-16T02:30:00Z'), dryRun: true })
  assert.ok(!summary.details.some((entry) => entry.userId === String(user._id)))
})

test('the job skips a user outside their reminder window', async () => {
  const user = await makeUser({ reminderEnabled: true, reminderTime: '08:00', timezone: 'Asia/Kolkata' })
  await clientFor(user).request('/api/habits', { method: 'POST', body: { id: 'w1', name: 'Anything' } })

  // 20:00 IST — twelve hours late, far outside the three-hour window.
  const summary = await runReminderJob({ now: new Date('2026-09-16T14:30:00Z'), dryRun: true, userId: user._id })
  const detail = summary.details.find((entry) => entry.userId === String(user._id))
  assert.equal(detail.outcome, 'skipped')
  assert.match(detail.reason, /window/i)
})

test('a weekday habit is not pending at the weekend, and a custom schedule is respected', async () => {
  const user = await makeUser({ reminderEnabled: true, reminderTime: '08:00', timezone: 'Asia/Kolkata' })
  const client = clientFor(user)

  // The job reports a count only when it reaches the dry-run branch; with
  // nothing due it skips earlier, which also means zero. Read it as "how many
  // are outstanding today" either way.
  const pendingOn = (summary) => {
    const detail = summary.details.find((entry) => entry.userId === String(user._id))
    return detail ? (detail.pending ?? 0) : null
  }

  await client.request('/api/habits', { method: 'POST', body: { id: 'wd', name: 'Weekday only', frequency: 'weekdays' } })
  // Monday and Wednesday only.
  await client.request('/api/habits', { method: 'POST', body: { id: 'cm', name: 'Mon/Wed only', frequency: 'custom', customDays: [1, 3] } })

  const monday = await runReminderJob({ now: new Date('2026-09-14T02:30:00Z'), dryRun: true, userId: user._id })
  assert.equal(pendingOn(monday), 2, 'both are due on a Monday')

  // Saturday 2026-09-19.
  const saturday = await runReminderJob({ now: new Date('2026-09-19T02:30:00Z'), dryRun: true, userId: user._id })
  assert.equal(pendingOn(saturday), 0, 'neither is due at the weekend')

  // Sunday 2026-09-20.
  const sunday = await runReminderJob({ now: new Date('2026-09-20T02:30:00Z'), dryRun: true, userId: user._id })
  assert.equal(pendingOn(sunday), 0, 'nor on a Sunday')

  // Tuesday: the weekday habit is due, the Mon/Wed custom one is not.
  const tuesday = await runReminderJob({ now: new Date('2026-09-15T02:30:00Z'), dryRun: true, userId: user._id })
  assert.equal(pendingOn(tuesday), 1, 'only the weekday habit')

  // The custom habit must carry its schedule through the database mapping,
  // otherwise it would silently never be due.
  const habits = await loadHabitsForUser(user._id)
  const custom = habits.find((habit) => habit.name === 'Mon/Wed only')
  assert.deepEqual(custom.customDays, [1, 3], 'scheduledDays survived the round trip to customDays')
})

/* ------------------------------------ 14-15. duplicate protection */

test('a reminder cannot be claimed twice for the same day', async () => {
  const user = await makeUser({ reminderEnabled: true })

  const first = await claimReminder(user._id, TODAY)
  assert.ok(first, 'the first claim succeeds')
  assert.equal(first.status, 'pending')
  assert.equal(first.attempts, 1)

  // Mark it delivered, then try again — the unique index must refuse.
  await recordReminderResult(first, { sent: true })
  assert.equal(await hasSentToday(user._id, TODAY), true)

  const second = await claimReminder(user._id, TODAY)
  assert.equal(second, null, 'a second claim for the same day is refused')
  assert.equal(await ReminderLog.countDocuments({ userId: user._id, dateKey: TODAY }), 1, 'exactly one row exists')
})

test('a concurrent claim is also refused', async () => {
  const user = await makeUser({ reminderEnabled: true })

  const results = await Promise.all([
    claimReminder(user._id, TODAY),
    claimReminder(user._id, TODAY),
  ])
  // At least one succeeds; the unique index prevents a second row regardless.
  assert.ok(results.some(Boolean))
  assert.equal(await ReminderLog.countDocuments({ userId: user._id, dateKey: TODAY }), 1)
})

test('a FAILED send is not recorded as sent, and may be retried', async () => {
  const user = await makeUser({ reminderEnabled: true })

  const claim = await claimReminder(user._id, TODAY)
  await recordReminderResult(claim, { sent: false, error: 'connect ECONNREFUSED' })

  const stored = await ReminderLog.findOne({ userId: user._id, dateKey: TODAY }).lean()
  assert.equal(stored.status, 'failed', 'a failure must never be marked sent')
  assert.ok(!stored.sentAt, 'sentAt is not stamped on a failure')
  assert.match(stored.error, /ECONNREFUSED/)
  assert.equal(await hasSentToday(user._id, TODAY), false)

  // A later run may try again.
  const retry = await claimReminder(user._id, TODAY)
  assert.ok(retry, 'a failed reminder can be retried')
  assert.equal(retry.attempts, 2)
})

test('reminders are independent per user and per day', async () => {
  const a = await makeUser({ reminderEnabled: true })
  const b = await makeUser({ reminderEnabled: true })

  await claimReminder(a._id, TODAY)
  const bClaim = await claimReminder(b._id, TODAY)
  assert.ok(bClaim, 'another user is unaffected')

  const tomorrow = '2026-09-17'
  assert.ok(await claimReminder(a._id, tomorrow), 'the next day is a fresh reminder')
})

/* --------------------------------------------- 11. sync + import path */

test('the sync endpoint imports a browser\'s local data idempotently', async () => {
  const user = await makeUser()
  const client = clientFor(user)

  const payload = {
    habits: [
      { id: 'local-1', name: 'Drink Water', frequency: 'daily', customDays: [], archived: false, completions: ['2026-09-14', '2026-09-15'] },
      { id: 'local-2', name: 'Workout', frequency: 'custom', customDays: [1, 3, 5], archived: false, completions: ['2026-09-14'] },
      { id: 'local-3', name: 'Archived one', frequency: 'daily', archived: true, completions: [] },
    ],
    rewards: [{ id: 'r-1', name: 'New shoes', milestone: 14, claimed: false }],
    achievements: [1, 3, 7],
    challengeStart: '2026-09-01',
    reminderEnabled: true,
    reminderTime: '07:30',
  }

  const first = await client.request('/api/sync', { method: 'POST', body: payload })
  assert.equal(first.status, 200, `sync failed: ${JSON.stringify(first.data)}`)
  assert.equal(first.data.habits.length, 3)
  assert.equal(first.data.rewards.length, 1)
  assert.deepEqual(first.data.achievements, [1, 3, 7])
  assert.equal(first.data.challengeStart, '2026-09-01')

  const water = first.data.habits.find((habit) => habit.name === 'Drink Water')
  assert.deepEqual(water.completions, ['2026-09-14', '2026-09-15'], 'history is preserved')
  const workout = first.data.habits.find((habit) => habit.name === 'Workout')
  assert.deepEqual(workout.customDays, [1, 3, 5], 'custom schedule survives the import')

  // Sending the same payload again must not duplicate anything.
  const second = await client.request('/api/sync', { method: 'POST', body: payload })
  assert.equal(second.data.habits.length, 3)
  assert.equal(second.data.rewards.length, 1)
  // Scoped to this user: other tests' documents are still in the database.
  assert.equal(await Habit.countDocuments({ userId: user._id }), 3, 'no duplicate habits')
  assert.equal(await HabitCompletion.countDocuments({ userId: user._id }), 3, 'no duplicate completions')
  assert.equal(await Reward.countDocuments({ userId: user._id }), 1)

  // The account's reminder settings were carried over too.
  const me = await client.request('/api/me')
  assert.equal(me.data.user.reminderEnabled, true)
  assert.equal(me.data.user.reminderTime, '07:30')
})

test('sync removes habits the client has genuinely deleted', async () => {
  const user = await makeUser()
  const client = clientFor(user)

  await client.request('/api/sync', { method: 'POST', body: { habits: [
    { id: 'k1', name: 'Keep', frequency: 'daily', completions: ['2026-09-15'] },
    { id: 'k2', name: 'Drop', frequency: 'daily', completions: ['2026-09-15'] },
  ] } })

  const result = await client.request('/api/sync', { method: 'POST', body: { habits: [
    { id: 'k1', name: 'Keep', frequency: 'daily', completions: ['2026-09-15'] },
  ] } })

  assert.deepEqual(result.data.habits.map((h) => h.name), ['Keep'])
  // The dropped habit's history goes with it, so it cannot be resurrected.
  assert.equal(await Habit.countDocuments({ userId: user._id }), 1)
  assert.equal(await HabitCompletion.countDocuments({ userId: user._id }), 1)
})

test('sync ignores a habit with no name and caps absurd input', async () => {
  const client = clientFor(await makeUser())
  const result = await client.request('/api/sync', { method: 'POST', body: { habits: [
    { id: 'x1', name: '   ' },
    { id: 'x2', name: 'Valid', frequency: 'nonsense' },
  ] } })
  assert.deepEqual(result.data.habits.map((h) => h.name), ['Valid'])
  assert.equal(result.data.habits[0].frequency, 'daily', 'an unknown frequency falls back')
})

/* ------------------------------------------------- 7b. analytics */

test('analytics are computed from stored completions and scoped to the user', async () => {
  const user = await makeUser({ challengeStartDate: '2026-09-01' })
  const client = clientFor(user)
  const habit = (await client.request('/api/habits', { method: 'POST', body: { id: 'an1', name: 'Read' } })).data.habit

  for (const date of ['2026-09-14', '2026-09-15', '2026-09-16']) {
    await client.request('/api/completions', { method: 'POST', body: { habitId: habit.id, date } })
  }

  // The habit was created just now, so history before today is deliberately
  // floored at createdAt — a habit cannot have missed days before it existed.
  const fresh = await client.request('/api/analytics?range=7d')
  assert.equal(fresh.data.totals.completed, 1, 'only today counts for a habit created today')
  assert.equal(fresh.data.habits[0].scheduled, 1)

  // Backdate the creation so those three days are legitimately part of its life.
  // Mongoose treats createdAt as immutable, so this goes through the raw driver.
  await Habit.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(habit.id) },
    { $set: { createdAt: new Date('2026-09-01T00:00:00.000Z') } },
  )

  const result = await client.request('/api/analytics?range=7d')
  assert.equal(result.status, 200)
  assert.equal(result.data.totals.activeHabits, 1)
  assert.equal(result.data.totals.completed, 3)
  assert.equal(result.data.habits[0].name, 'Read')
  assert.equal(result.data.habits[0].current, 3, 'three consecutive days ending today')
  assert.equal(result.data.habits[0].best, 3)
  assert.ok(Array.isArray(result.data.daily))
  assert.ok(result.data.daily.every((day) => typeof day.rate === 'number'))
})

test('analytics never include another user\'s completions', async () => {
  const alice = await makeUser({ challengeStartDate: '2026-09-01' })
  const bob = await makeUser({ challengeStartDate: '2026-09-01' })
  const aliceClient = clientFor(alice)
  const bobClient = clientFor(bob)

  const aliceHabit = (await aliceClient.request('/api/habits', { method: 'POST', body: { id: 'iso-a', name: 'Alice' } })).data.habit
  const bobHabit = (await bobClient.request('/api/habits', { method: 'POST', body: { id: 'iso-b', name: 'Bob' } })).data.habit

  for (const date of ['2026-09-14', '2026-09-15', '2026-09-16']) {
    await aliceClient.request('/api/completions', { method: 'POST', body: { habitId: aliceHabit.id, date } })
  }
  await bobClient.request('/api/completions', { method: 'POST', body: { habitId: bobHabit.id, date: '2026-09-16' } })

  const bobAnalytics = await bobClient.request('/api/analytics?range=7d')
  assert.equal(bobAnalytics.data.totals.completed, 1, 'Bob sees only his own completion')
  assert.deepEqual(bobAnalytics.data.habits.map((h) => h.name), ['Bob'])
})

test('bootstrap returns the whole account in one call', async () => {
  const client = clientFor(await makeUser())
  await client.request('/api/habits', { method: 'POST', body: { id: 'b1', name: 'Read' } })

  const result = await client.request('/api/bootstrap')
  assert.equal(result.status, 200)
  assert.equal(result.data.habits.length, 1)
  assert.deepEqual(result.data.rewards, [])
  assert.deepEqual(result.data.achievements, [])
  assert.ok(result.data.user.email)
  assert.equal(typeof result.data.reminderEnabled, 'boolean')
})

/* -------------------------------------------- secrets never leave */

test('no response ever contains a secret', async () => {
  const client = makeClient()
  const responses = await Promise.all([
    client.request('/api/health'),
    client.request('/api/auth/providers'),
    client.request('/api/reminders/status'),
  ])

  const forbidden = ['MONGODB_URI', 'mongodb+srv', 'GOOGLE_CLIENT_SECRET', 'SESSION_SECRET', 'EMAIL_PASSWORD', 'GOCSPX', 'password']
  responses.forEach(({ data }) => {
    const text = JSON.stringify(data)
    forbidden.forEach((needle) => {
      assert.ok(!text.includes(needle), `response leaked ${needle}: ${text}`)
    })
  })
})
