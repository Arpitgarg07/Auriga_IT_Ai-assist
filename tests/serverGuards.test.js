import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Static guards over the API source.
 *
 * These are deliberately source-level rather than behavioural: the rules they
 * check ("the identity always comes from the session", "no route trusts a
 * client-supplied user id") are properties of how every handler is written, and
 * a runtime test can only prove them for the routes it happens to call. A new
 * route added later is covered the moment it is written.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROUTES_DIR = path.join(ROOT, 'server', 'src', 'routes')
const MODELS_DIR = path.join(ROOT, 'server', 'src', 'models')

const routeFiles = fs.readdirSync(ROUTES_DIR).filter((name) => name.endsWith('.js'))
const read = (dir, name) => fs.readFileSync(path.join(dir, name), 'utf8')

/* ------------------------------------------------- identity always scoped */

test('no route reads a user id from the request body or query', () => {
  const offenders = []

  routeFiles.forEach((name) => {
    const source = read(ROUTES_DIR, name)
    // Identity must come from the session. A client-supplied id used to scope a
    // query is the vulnerability this guards against.
    //
    // Note what is deliberately NOT flagged: /api/reminders/preview and /test
    // accept `body.user.name` and `body.user.email` purely as display and
    // delivery details for a snapshot-based send, where there may be no signed-in
    // user at all. Those fields never scope a database query — asserted below.
    const suspicious = [
      /request\.(?:body|query)\??\.userId/,
      /request\.(?:body|query)\??\['userId'\]/,
      /request\.params\.userId/,
      /request\.body\??\.user\??\.id\b/,
      /request\.(?:body|query)\??\.user\??\._id\b/,
    ]
    suspicious.forEach((pattern) => {
      if (pattern.test(source)) offenders.push(`${name} matches ${pattern}`)
    })
  })

  assert.deepEqual(offenders, [], `routes must derive identity from the session, not the request:\n${offenders.join('\n')}`)
})

test('the reminder snapshot user is only ever used for display, never to scope a query', () => {
  const source = read(ROUTES_DIR, 'reminders.js')
  // It may appear as a name/email for rendering and delivery…
  assert.match(source, /request\.body\?\.user\?\.(?:name|email)/)
  // …but never as a filter key on a model query.
  assert.doesNotMatch(source, /(?:find|findOne|updateOne|deleteOne|countDocuments)\([^)]*body\?\.user/)
})

test('every data route scopes its queries by the session user', () => {
  // Routers that touch user-owned collections must reference request.user._id.
  const userOwned = ['habits.js', 'completions.js', 'rewards.js', 'achievements.js', 'analytics.js', 'sync.js', 'challenge.js']
  userOwned.forEach((name) => {
    const source = read(ROUTES_DIR, name)
    assert.match(source, /request\.user\._id/, `${name} should scope by request.user._id`)
  })
})

test('every data route is behind requireAuth', () => {
  const userOwned = ['habits.js', 'completions.js', 'rewards.js', 'achievements.js', 'analytics.js', 'sync.js', 'challenge.js']
  userOwned.forEach((name) => {
    const source = read(ROUTES_DIR, name)
    assert.match(source, /requireAuth/, `${name} should import and use requireAuth`)
  })
})

test('the only public reminder routes are status and preview', () => {
  const source = read(ROUTES_DIR, 'reminders.js')
  // Sending mail is guarded; rendering is not, because it needs no credentials.
  assert.match(source, /router\.post\('\/test', requireReminderAccess/)
  assert.match(source, /router\.post\('\/run', requireReminderAccess/)
})

/* -------------------------------------------------- secret handling */

test('nothing in the routes or models hard-codes a credential', () => {
  const offenders = []

  ;[ROUTES_DIR, MODELS_DIR].forEach((dir) => {
    fs.readdirSync(dir).filter((name) => name.endsWith('.js')).forEach((name) => {
      const source = read(dir, name)
      const patterns = [
        /mongodb\+srv:\/\/[^'"\s]*:[^'"\s@]+@/i,   // a URI with an embedded password
        /(?:secret|password|apikey|api_key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
        /GOCSPX-[A-Za-z0-9_-]+/,                    // a Google client secret
        /AIza[0-9A-Za-z_-]{20,}/,                   // a Google API key
      ]
      patterns.forEach((pattern) => {
        if (pattern.test(source)) offenders.push(`${name} matches ${pattern}`)
      })
    })
  })

  assert.deepEqual(offenders, [], `no credentials may be committed:\n${offenders.join('\n')}`)
})

test('the environment module reads every secret from process.env', () => {
  const source = read(path.join(ROOT, 'server', 'src', 'config'), 'env.js')
  assert.match(source, /process\.env\.MONGODB_URI/)
  assert.match(source, /process\.env\.SESSION_SECRET/)
  assert.match(source, /process\.env\.GOOGLE_CLIENT_SECRET/)
  assert.match(source, /process\.env\.EMAIL_PASSWORD/)
})

test('.env.example documents the required variables and holds no values', () => {
  const example = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8')
  ;['MONGODB_URI', 'SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'EMAIL_PASSWORD'].forEach((key) => {
    assert.match(example, new RegExp(`^${key}=`, 'm'), `${key} should be documented`)
  })

  // Every secret-bearing line must be empty in the committed template.
  const sensitive = ['MONGODB_URI', 'SESSION_SECRET', 'GOOGLE_CLIENT_SECRET', 'EMAIL_PASSWORD', 'REMINDER_ADMIN_TOKEN']
  sensitive.forEach((key) => {
    const match = new RegExp(`^${key}=(.*)$`, 'm').exec(example)
    if (match) assert.equal(match[1].trim(), '', `${key} must be blank in .env.example`)
  })
})

/* ----------------------------------------------------- model integrity */

test('user-owned models all carry a userId reference', () => {
  ;['Habit.js', 'HabitCompletion.js', 'Reward.js', 'Achievement.js', 'Challenge.js', 'ReminderLog.js'].forEach((name) => {
    const source = read(MODELS_DIR, name)
    assert.match(source, /userId/, `${name} should belong to a user`)
  })
})

test('the duplicate guards are real unique indexes', () => {
  const expectations = [
    ['HabitCompletion.js', /\{\s*userId:\s*1,\s*habitId:\s*1,\s*date:\s*1\s*\},\s*\{\s*unique:\s*true\s*\}/],
    ['Achievement.js', /\{\s*userId:\s*1,\s*milestone:\s*1\s*\},\s*\{\s*unique:\s*true\s*\}/],
    ['ReminderLog.js', /\{\s*userId:\s*1,\s*channel:\s*1,\s*dateKey:\s*1\s*\},\s*\{\s*unique:\s*true\s*\}/],
    ['Habit.js', /\{\s*userId:\s*1,\s*clientId:\s*1\s*\},\s*\{\s*unique:\s*true\s*\}/],
  ]
  expectations.forEach(([name, pattern]) => {
    assert.match(read(MODELS_DIR, name), pattern, `${name} should declare a compound unique index`)
  })
})

test('the scheduler queries the indexed reminder flag, not a nested path', () => {
  const source = read(path.join(ROOT, 'server', 'src', 'services'), 'reminderService.js')
  assert.match(source, /reminderEnabled:\s*true/)
  assert.doesNotMatch(source, /'reminders\.emailEnabled'/)
})

/* --------------------------------------------- no duplicated streak maths */

test('the server never re-implements the streak engine', () => {
  const servicesDir = path.join(ROOT, 'server', 'src', 'services')
  const files = [
    ...fs.readdirSync(servicesDir).map((name) => [servicesDir, name]),
    ...routeFiles.map((name) => [ROUTES_DIR, name]),
  ].filter(([, name]) => name.endsWith('.js'))

  const offenders = []
  files.forEach(([dir, name]) => {
    const source = read(dir, name)
    // A hand-rolled walk backwards through dates would look like this.
    if (/function\s+get(?:Current|Best)Streak/.test(source)) offenders.push(`${name} defines its own streak function`)
    if (/setDate\(.*getDate\(\)\s*-\s*1\)/.test(source) && /streak/i.test(source)) offenders.push(`${name} walks dates for a streak`)
  })

  assert.deepEqual(offenders, [], `streak maths must come from src/utils/streaks.js:\n${offenders.join('\n')}`)
})

test('the server imports the shared reminder computation rather than copying it', () => {
  const source = read(path.join(ROOT, 'server', 'src', 'services'), 'reminderService.js')
  assert.match(source, /from '\.\.\/\.\.\/\.\.\/src\/utils\/reminders\.js'/, 'should import the shared module')
  assert.match(source, /pendingWithStreaks/)
  assert.match(source, /streakAtRisk/)
})
