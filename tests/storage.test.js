import test from 'node:test'
import assert from 'node:assert/strict'

// storage.js touches localStorage only inside its functions, so a plain stub
// installed before the first call is enough — no jsdom required.
class MemoryStorage {
  #map = new Map()
  getItem(key) { return this.#map.has(key) ? this.#map.get(key) : null }
  setItem(key, value) { this.#map.set(key, String(value)) }
  removeItem(key) { this.#map.delete(key) }
  clear() { this.#map.clear() }
  has(key) { return this.#map.has(key) }
}

globalThis.localStorage = new MemoryStorage()

const {
  clearAll,
  defaultSettings,
  loadData,
  readNotifiedDate,
  saveSettings,
  writeNotifiedDate,
} = await import('../src/utils/storage.js')

const SETTINGS_KEY = 'habit-tracker-settings'
const TODAY = '2026-09-16'

const reset = () => globalThis.localStorage.clear()

/* ------------------------------------------------------------ defaults */

test('default settings include an enabled reminder block', () => {
  const reminders = defaultSettings(TODAY).reminders
  assert.equal(reminders.enabled, true)
  assert.equal(reminders.time, '08:00')
  assert.equal(reminders.browserNotifications, false)
  assert.equal(reminders.lastShownDate, null)
})

/* ------------------------------------------- upgrade from older settings */

test('settings written before reminders existed still load, and gain defaults', () => {
  reset()
  // The exact shape the previous build persisted: no reminders key at all.
  globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    challengeStart: '2026-09-01',
    achievements: [1, 3],
    rewards: [{ id: 'r1', name: 'Dress', milestone: 14, claimed: false }],
    profile: { name: 'Sneha', email: 'sneha@example.com' },
    preferences: { motivationalMessages: false, celebrationEffects: true, theme: 'dark' },
  }))

  const { settings } = loadData(TODAY)

  // Nothing from the old object is lost…
  assert.equal(settings.challengeStart, '2026-09-01')
  assert.equal(settings.profile.name, 'Sneha')
  assert.equal(settings.preferences.theme, 'dark')
  assert.equal(settings.preferences.motivationalMessages, false)
  assert.deepEqual(settings.achievements, [1, 3])
  assert.equal(settings.rewards.length, 1)
  // …and the new block appears with working defaults.
  assert.equal(settings.reminders.enabled, true)
  assert.equal(settings.reminders.time, '08:00')
  assert.equal(settings.reminders.lastShownDate, null)
})

test('a corrupt reminder block is repaired field by field', () => {
  reset()
  globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    challengeStart: TODAY,
    reminders: {
      enabled: 'yes please',
      time: '99:99',
      browserNotifications: 'granted',
      lastShownDate: 'not-a-date',
    },
  }))

  const { settings } = loadData(TODAY)
  assert.equal(settings.reminders.enabled, true) // only an explicit false disables
  assert.equal(settings.reminders.time, '08:00') // unparseable time falls back
  assert.equal(settings.reminders.browserNotifications, false)
  assert.equal(settings.reminders.lastShownDate, null)
})

test('a deliberately disabled reminder setting survives a reload', () => {
  reset()
  saveSettings({ ...defaultSettings(TODAY), reminders: { enabled: false, time: '06:30', browserNotifications: true, lastShownDate: TODAY } })

  const { settings } = loadData(TODAY)
  assert.equal(settings.reminders.enabled, false)
  assert.equal(settings.reminders.time, '06:30')
  assert.equal(settings.reminders.browserNotifications, true)
  assert.equal(settings.reminders.lastShownDate, TODAY)
})

test('an acknowledged day persists, so the modal does not return on reload', () => {
  reset()
  saveSettings({ ...defaultSettings(TODAY), reminders: { enabled: true, time: '08:00', browserNotifications: false, lastShownDate: TODAY } })
  assert.equal(loadData(TODAY).settings.reminders.lastShownDate, TODAY)
})

test('a future lastShownDate is preserved rather than silently discarded', () => {
  reset()
  globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    challengeStart: TODAY,
    reminders: { lastShownDate: '2099-01-01' },
  }))
  // It is a well-formed date key, so it is kept; the modal simply shows again
  // today and the marker is overwritten, which is self-healing.
  assert.equal(loadData(TODAY).settings.reminders.lastShownDate, '2099-01-01')
})

/* ---------------------------------------------- notification marker log */

test('the notification marker round-trips and rejects junk', () => {
  reset()
  assert.equal(readNotifiedDate(), null)
  writeNotifiedDate(TODAY)
  assert.equal(readNotifiedDate(), TODAY)

  globalThis.localStorage.setItem('habit-tracker-reminder-log', 'rubbish')
  assert.equal(readNotifiedDate(), null)
})

test('clearAll removes habits, settings and the reminder log', () => {
  reset()
  saveSettings(defaultSettings(TODAY))
  writeNotifiedDate(TODAY)
  assert.equal(globalThis.localStorage.has('habit-tracker-reminder-log'), true)

  clearAll()

  assert.equal(globalThis.localStorage.has(SETTINGS_KEY), false)
  assert.equal(globalThis.localStorage.has('habit-tracker-reminder-log'), false)
  assert.equal(readNotifiedDate(), null)
})

/* ------------------------------------------------------ fault tolerance */

test('unreadable stored settings fall back to defaults instead of throwing', () => {
  reset()
  globalThis.localStorage.setItem(SETTINGS_KEY, '{{{ not json')
  const { settings } = loadData(TODAY)
  assert.equal(settings.reminders.enabled, true)
  assert.equal(settings.challengeStart, TODAY)
})

test('storage that throws on write reports failure rather than crashing', () => {
  const original = globalThis.localStorage
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error('quota exceeded') },
    removeItem: () => {},
  }
  assert.equal(saveSettings(defaultSettings(TODAY)), false)
  globalThis.localStorage = original
})
