import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { addDays, fromDateKey, toDateKey } from '../src/utils/dates.js'
import { buildSubject, createReminderEmail, escapeHtml, sendMorningHabitReminder } from '../server/src/services/emailService.js'
import { computeReminder, isWithinReminderWindow, parseTimeToMinutes, previewReminderForSnapshot, zonedNow } from '../server/src/services/reminderService.js'

/* ---------------------------------------------------------------- helpers */

// A Wednesday, so weekday habits are in scope.
const TODAY = '2026-09-16'
const back = (dateKey, days) => toDateKey(addDays(fromDateKey(dateKey), -days))
// Consecutive completions ending yesterday => a live current streak today.
const runEndingYesterday = (dateKey, count) =>
  Array.from({ length: count }, (_, index) => back(dateKey, index + 1)).reverse()

let nextId = 0
function habit(overrides = {}) {
  nextId += 1
  return {
    id: `h${nextId}`,
    name: `Habit ${nextId}`,
    description: '',
    frequency: 'daily',
    customDays: [1, 2, 3, 4, 5],
    createdAt: '2026-01-01T09:00:00.000Z',
    archived: false,
    completions: [],
    ...overrides,
  }
}

function firstDayOfWeek(from, target) {
  const cursor = fromDateKey(from)
  while (cursor.getDay() !== target) cursor.setDate(cursor.getDate() + 1)
  return toDateKey(cursor)
}

const user = { name: 'Sneha', email: 'sneha@example.com' }

/* ------------------------------------------------------------- escaping */

test('user data is HTML-escaped before it reaches the email body', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry')
  assert.equal(escapeHtml(`He said "hi"`), 'He said &quot;hi&quot;')
  assert.equal(escapeHtml(null), '')
})

test('a habit named like markup cannot inject HTML into the email', () => {
  const habits = [habit({ name: '<img src=x onerror=alert(1)>' })]
  const email = createReminderEmail(user, computeReminder(habits, TODAY).entries, { dateKey: TODAY })
  assert.ok(!email.html.includes('<img src=x'), 'raw tag must not survive')
  assert.ok(email.html.includes('&lt;img src=x'), 'it should appear escaped')
})

/* -------------------------------------------- 1. a pending daily habit */

test('scenario 1: a pending daily habit produces a reminder email', () => {
  const habits = [habit({ name: 'Drink Water' }), habit({ name: 'Read' })]
  const email = createReminderEmail(user, computeReminder(habits, TODAY).entries, { dateKey: TODAY })

  assert.ok(email.subject.length > 0)
  assert.match(email.subject, /Sneha/)
  assert.ok(email.html.includes('Drink Water'))
  assert.ok(email.html.includes('Read'))
  assert.match(email.text, /You still have 2 habits to complete today/)
  assert.ok(email.html.includes('Open Habit Tracker'))
})

test('the email carries the challenge progress and CTA', () => {
  const habits = [habit({ name: 'Read' })]
  const email = createReminderEmail(user, computeReminder(habits, TODAY).entries, {
    dateKey: TODAY,
    challengeStart: back(TODAY, 13), // 14th day inclusive
    appUrl: 'https://example.test/app',
  })

  assert.ok(email.html.includes('75-Day Challenge'))
  assert.match(email.html, /Day 14 \/ 75/)
  assert.ok(email.html.includes('https://example.test/app'))
  assert.match(email.text, /Day 14 \/ 75/)
})

test('streaks appear against the habit that has one', () => {
  const habits = [
    habit({ name: 'Workout', completions: runEndingYesterday(TODAY, 14) }),
    habit({ name: 'Read', completions: runEndingYesterday(TODAY, 8) }),
  ]
  const email = createReminderEmail(user, computeReminder(habits, TODAY).entries, { dateKey: TODAY })

  assert.ok(email.html.includes('14 days streak'))
  assert.ok(email.html.includes('8 days streak'))
  assert.match(email.text, /Workout — 14 day streak/)
})

/* ------------------------------------------------- 2 & 3. exclusions */

test('scenario 2: a completed habit is excluded from the email', () => {
  const habits = [
    habit({ name: 'Drink Water', completions: [TODAY] }),
    habit({ name: 'Read' }),
  ]
  const result = previewReminderForSnapshot(habits, { dateKey: TODAY, user })

  assert.equal(result.habitCount, 1)
  assert.deepEqual(result.habits.map((h) => h.name), ['Read'])
  assert.ok(!result.html.includes('Drink Water'), 'a completed habit must not appear')
})

test('scenario 3: an archived habit is excluded from the email', () => {
  const habits = [
    habit({ name: 'Abandoned', archived: true }),
    habit({ name: 'Read' }),
  ]
  const result = previewReminderForSnapshot(habits, { dateKey: TODAY, user })

  assert.equal(result.habitCount, 1)
  assert.deepEqual(result.habits.map((h) => h.name), ['Read'])
  assert.ok(!result.html.includes('Abandoned'))
})

test('an archived habit alone produces no email at all', () => {
  const result = previewReminderForSnapshot([habit({ archived: true })], { dateKey: TODAY, user })
  assert.equal(result.skipped, true)
})

/* ------------------------------------------------------ 4. weekends */

test('scenario 4: a weekday habit produces no email on Saturday or Sunday', () => {
  const saturday = firstDayOfWeek('2026-09-01', 6)
  const sunday = firstDayOfWeek('2026-09-01', 0)
  const workout = habit({ name: 'Workout', frequency: 'weekdays' })

  assert.equal(previewReminderForSnapshot([workout], { dateKey: saturday, user }).skipped, true)
  assert.equal(previewReminderForSnapshot([workout], { dateKey: sunday, user }).skipped, true)
  // …and does produce one on a weekday.
  assert.equal(previewReminderForSnapshot([workout], { dateKey: '2026-09-16', user }).skipped, false)
})

/* ------------------------------------------------ 5. custom schedules */

test('scenario 5: a custom schedule is only eligible on its selected days', () => {
  // Monday, Wednesday, Friday.
  const gym = habit({ name: 'Gym', frequency: 'custom', customDays: [1, 3, 5] })
  const expected = { 1: false, 2: true, 3: false, 4: true, 5: false, 6: true, 0: true } // jsDay -> skipped?
  const start = fromDateKey('2026-09-06') // Sunday

  for (let offset = 0; offset < 7; offset += 1) {
    const day = toDateKey(addDays(start, offset))
    const jsDay = fromDateKey(day).getDay()
    const result = previewReminderForSnapshot([gym], { dateKey: day, user })
    assert.equal(result.skipped, expected[jsDay], `${day} (getDay=${jsDay})`)
  }
})

/* ------------------------------------- 6. nothing pending means no email */

test('scenario 6: no email is produced when every habit is complete', () => {
  const habits = [
    habit({ name: 'Read', completions: [TODAY] }),
    habit({ name: 'Water', completions: [TODAY] }),
  ]
  const result = previewReminderForSnapshot(habits, { dateKey: TODAY, user })
  assert.equal(result.skipped, true)
  assert.match(result.reason, /No pending habits/)
})

test('sendMorningHabitReminder refuses to send with nothing pending', async () => {
  const result = await sendMorningHabitReminder(user, [], { dateKey: TODAY })
  assert.equal(result.sent, false)
  assert.equal(result.skipped, true)
})

/* ------------------------------------------- 7. duplicate protection */

test('scenario 7: the reminder window bounds when a send may happen', () => {
  // 08:00 reminder.
  const eight = parseTimeToMinutes('08:00')
  assert.equal(eight, 480)

  assert.equal(isWithinReminderWindow(eight, 7 * 60 + 59), false, 'before the time: not yet')
  assert.equal(isWithinReminderWindow(eight, 8 * 60), true, 'exactly on time: due')
  assert.equal(isWithinReminderWindow(eight, 9 * 60), true, 'inside the window: still due')
  assert.equal(isWithinReminderWindow(eight, 11 * 60 + 1), false, 'past the window: no stale morning email')
  // An unparseable time can never fire.
  assert.equal(isWithinReminderWindow(parseTimeToMinutes('nonsense'), 600), false)
})

test('a reminder time parses to minutes, rejecting junk', () => {
  assert.equal(parseTimeToMinutes('00:00'), 0)
  assert.equal(parseTimeToMinutes('08:00'), 480)
  assert.equal(parseTimeToMinutes('23:59'), 1439)
  assert.equal(parseTimeToMinutes('24:00'), null)
  assert.equal(parseTimeToMinutes('12:60'), null)
  assert.equal(parseTimeToMinutes(''), null)
  assert.equal(parseTimeToMinutes(undefined), null)
})

/* --------------------------------- 8. email failure is not fatal */

// The unconfigured case is covered by the spawned fixture below, which blanks
// every EMAIL_* variable so the result cannot depend on a developer's .env.
// Calling sendEmail() directly here would attempt a real connection wherever
// SMTP happens to be configured.

test('scenario 8: an unconfigured email service reports exactly what is missing', () => {
  // Spawned with every EMAIL_* blanked so the result does not depend on the
  // developer's own .env — dotenv will not override an already-set variable.
  const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'emailUnconfigured.mjs')
  const blanked = Object.fromEntries(
    ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'].map((key) => [key, '']),
  )

  const run = spawnSync(process.execPath, [fixture], {
    encoding: 'utf8',
    timeout: 60000,
    env: { ...process.env, ...blanked },
  })

  assert.equal(run.status, 0, `fixture crashed: ${run.stderr}`)
  const report = JSON.parse(run.stdout)

  assert.equal(report.configured, false)
  assert.equal(report.provider, null)
  // The variable *names* are reported so the UI can tell the user what to set.
  ;['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'].forEach((key) => {
    assert.ok(report.missing.includes(key), `${key} should be listed as missing`)
  })

  assert.equal(report.sendSent, false)
  assert.match(report.sendError, /not configured/i)
})

test('scenario 8: a send attempt for a missing recipient fails cleanly', async () => {
  const result = await sendMorningHabitReminder({ name: 'Nobody' }, [{ habit: { name: 'Read' }, current: 0 }], { dateKey: TODAY })
  assert.equal(result.sent, false)
  assert.ok(result.error)
})

test('scenario 8: a configured but unreachable SMTP host fails without throwing', () => {
  // Spawned in a child process because env.js reads EMAIL_* at import time.
  // This proves the failure path end to end against a real socket that refuses
  // the connection, rather than against a mocked transport.
  const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'emailFailure.mjs')

  const run = spawnSync(process.execPath, [fixture], {
    encoding: 'utf8',
    timeout: 60000,
    env: {
      ...process.env,
      EMAIL_HOST: '127.0.0.1',
      EMAIL_PORT: '2525', // nothing listens here
      EMAIL_USER: 'test@example.com',
      EMAIL_PASSWORD: 'not-a-real-password',
      EMAIL_FROM: 'test@example.com',
      EMAIL_CONNECTION_TIMEOUT_MS: '2500',
    },
  })

  assert.equal(run.status, 0, `fixture crashed: ${run.stderr}`)

  const report = JSON.parse(run.stdout)
  assert.equal(report.configured, true, 'fake SMTP settings are complete, so it is "configured"')
  assert.equal(report.threw, false, 'a mail failure must never throw')
  assert.equal(report.sent, false)
  assert.ok(report.error, 'the failure reason is reported to the caller')
  assert.match(report.error, /ECONNREFUSED|connect/i)
  assert.match(report.subject, /Sneha/, 'the email was still rendered before the send failed')
})

/* ----------------------------------- 9. the demo path needs no database */

test('scenario 9: the preview path renders a full email with no database and no credentials', () => {
  const habits = [
    habit({ name: 'Workout', frequency: 'weekdays', completions: runEndingYesterday(TODAY, 14) }),
    habit({ name: 'Read', completions: runEndingYesterday(TODAY, 8) }),
    habit({ name: 'Drink Water', completions: runEndingYesterday(TODAY, 5) }),
    habit({ name: 'Already done', completions: [TODAY] }),
    habit({ name: 'Archived', archived: true }),
  ]
  const result = previewReminderForSnapshot(habits, { dateKey: TODAY, user, challengeStart: back(TODAY, 13) })

  assert.equal(result.skipped, false)
  assert.equal(result.habitCount, 3, 'only the three pending, active, due-today habits')
  assert.deepEqual(result.habits.map((h) => h.name), ['Workout', 'Read', 'Drink Water'])
  assert.match(result.html, /Day 14 \/ 75/)
  assert.ok(result.text.includes('Open') || result.text.includes('http'))
})

/* ------------------------------------------- greeting / subject honesty */

test('the subject claims a streak only when one is genuinely on the line', () => {
  const live = computeReminder([habit({ name: 'Read', completions: runEndingYesterday(TODAY, 9) })], TODAY)
  const withStreak = createReminderEmail(user, live.entries, { dateKey: TODAY })
  assert.match(withStreak.subject, /streak is waiting/)

  const none = computeReminder([habit({ name: 'Brand new' })], TODAY)
  const withoutStreak = createReminderEmail(user, none.entries, { dateKey: TODAY })
  assert.doesNotMatch(withoutStreak.subject, /streak/i)
  assert.match(withoutStreak.subject, /habit/)
})

test('a live streak on an already-completed habit is not claimed in the subject', () => {
  // The same trap the in-app reminder guards against: the only outstanding
  // habit has no streak, so the subject must not warn about one.
  const habits = [
    habit({ name: 'Water', completions: [...runEndingYesterday(TODAY, 10), TODAY] }),
    habit({ name: 'Read' }),
  ]
  const { entries } = computeReminder(habits, TODAY)
  assert.equal(entries.length, 1)
  const email = createReminderEmail(user, entries, { dateKey: TODAY })
  assert.doesNotMatch(email.subject, /streak/i)
})

test('the single-habit subject reads naturally', () => {
  assert.match(buildSubject(user, [{ current: 0 }], null), /^☀️ Sneha, 1 habit left today$/)
  assert.match(buildSubject(user, [{ current: 0 }, { current: 0 }], null), /2 habits left today/)
  assert.match(buildSubject({}, [{ current: 0 }], null), /^☀️ 1 habit left today$/)
})

/* ------------------------------------------------------- timezone maths */

test('zonedNow reports the user\'s local date and minute-of-day', () => {
  // 02:30 UTC is 08:00 in Asia/Kolkata (UTC+5:30).
  const ist = zonedNow(new Date('2026-09-16T02:30:00Z'), 'Asia/Kolkata')
  assert.equal(ist.dateKey, '2026-09-16')
  assert.equal(ist.minutes, 8 * 60)

  // 20:00 UTC is already the NEXT day in IST — the day boundary a UTC-only
  // scheduler would get wrong.
  const late = zonedNow(new Date('2026-09-16T20:00:00Z'), 'Asia/Kolkata')
  assert.equal(late.dateKey, '2026-09-17')
  assert.equal(late.minutes, 90)

  const utc = zonedNow(new Date('2026-09-16T20:00:00Z'), 'UTC')
  assert.equal(utc.dateKey, '2026-09-16')
  assert.equal(utc.minutes, 20 * 60)
})

test('computeReminder clamps the challenge day and reports pending correctly', () => {
  const habits = [habit({ name: 'Read' })]
  const future = computeReminder(habits, TODAY, { challengeStart: toDateKey(addDays(fromDateKey(TODAY), 5)) })
  assert.equal(future.context.challengeDay, 0, 'a future start date is not day 1')

  const day1 = computeReminder(habits, TODAY, { challengeStart: TODAY })
  assert.equal(day1.context.challengeDay, 1)

  const past = computeReminder(habits, TODAY, { challengeStart: back(TODAY, 200) })
  assert.equal(past.context.challengeDay, 75, 'clamped to the challenge length')
})

test('an empty or corrupt habit list never throws', () => {
  assert.equal(previewReminderForSnapshot([], { dateKey: TODAY, user }).skipped, true)
  assert.equal(previewReminderForSnapshot(undefined, { dateKey: TODAY, user }).skipped, true)
  const broken = [{ ...habit({ name: 'Corrupt' }), completions: undefined }]
  assert.equal(previewReminderForSnapshot(broken, { dateKey: TODAY, user }).habitCount, 1)
})
