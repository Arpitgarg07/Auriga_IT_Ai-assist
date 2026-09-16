import { DEFAULT_REMINDER_TIME } from './constants.js'
import { toMinutes } from './reminders.js'

const HABITS_KEY = 'habit-tracker-habits'
const SETTINGS_KEY = 'habit-tracker-settings'
const REMINDER_LOG_KEY = 'habit-tracker-reminder-log'

const seedHabits = [
  ['Drink Water', 'Eight glasses to keep energy steady.', 'Droplets', 'daily'],
  ['Read', 'A few pages of something worthwhile.', 'BookOpen', 'daily'],
  ['Workout', 'Move your body with intention.', 'Dumbbell', 'weekdays'],
  ['No Sugar', 'Make the small, better choice today.', 'Apple', 'daily'],
].map(([name, description, icon, frequency], index) => ({
  id: `seed-${index + 1}`,
  name,
  description,
  icon,
  frequency,
  customDays: [1, 2, 3, 4, 5],
  createdAt: new Date().toISOString(),
  archived: false,
  completions: [],
}))

export function defaultSettings(today) {
  return {
    challengeStart: today,
    achievements: [],
    rewards: [],
    profile: { name: '', email: '' },
    preferences: { motivationalMessages: true, celebrationEffects: true, theme: 'light' },
    reminders: defaultReminders(),
  }
}

// Morning reminders are on by default because they are the feature's whole
// point, but every field is normalised on load so an older stored settings
// object upgrades without losing anything.
//
// lastShownDate is the only durable reminder marker kept here: it records
// whether the morning modal has been acknowledged today, and it is written from
// event handlers rather than effects. The browser-notification marker is not UI
// state at all, so it lives under its own key (see the helpers below).
export function defaultReminders() {
  return {
    enabled: true,
    time: DEFAULT_REMINDER_TIME,
    browserNotifications: false,
    lastShownDate: null,
    // Email reminders are opt-in, mirroring the server-side default: nobody is
    // emailed until they switch it on themselves.
    emailEnabled: false,
    emailTime: DEFAULT_REMINDER_TIME,
  }
}

const isDateKey = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

function validHabit(habit) {
  return habit && typeof habit === 'object' && typeof habit.id === 'string' && typeof habit.name === 'string'
    && ['daily', 'weekdays', 'custom'].includes(habit.frequency) && Array.isArray(habit.completions)
}

// Settings written by earlier versions have no profile or preferences block, so
// each field is normalised rather than rejected. Unknown extra keys survive.
function validSettings(settings, today) {
  const base = defaultSettings(today)
  if (!settings || typeof settings !== 'object' || typeof settings.challengeStart !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(settings.challengeStart)) {
    return base
  }
  const profile = settings.profile && typeof settings.profile === 'object' ? settings.profile : {}
  const preferences = settings.preferences && typeof settings.preferences === 'object' ? settings.preferences : {}
  const reminders = settings.reminders && typeof settings.reminders === 'object' ? settings.reminders : {}
  return {
    ...base,
    ...settings,
    achievements: Array.isArray(settings.achievements) ? settings.achievements : [],
    rewards: Array.isArray(settings.rewards) ? settings.rewards : [],
    profile: {
      name: typeof profile.name === 'string' ? profile.name : '',
      email: typeof profile.email === 'string' ? profile.email : '',
    },
    preferences: {
      motivationalMessages: preferences.motivationalMessages !== false,
      celebrationEffects: preferences.celebrationEffects !== false,
      theme: ['light', 'dark', 'system'].includes(preferences.theme) ? preferences.theme : 'light',
    },
    reminders: {
      enabled: reminders.enabled !== false,
      time: toMinutes(reminders.time) === null ? DEFAULT_REMINDER_TIME : reminders.time,
      browserNotifications: reminders.browserNotifications === true,
      // A stale or corrupt marker is dropped rather than trusted, which at worst
      // means the morning modal appears once more.
      lastShownDate: isDateKey(reminders.lastShownDate) ? reminders.lastShownDate : null,
      emailEnabled: reminders.emailEnabled === true,
      emailTime: toMinutes(reminders.emailTime) === null ? DEFAULT_REMINDER_TIME : reminders.emailTime,
    },
  }
}

export function loadData(today) {
  try {
    const savedHabits = localStorage.getItem(HABITS_KEY)
    const savedSettings = localStorage.getItem(SETTINGS_KEY)
    const habits = savedHabits ? JSON.parse(savedHabits) : seedHabits
    const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings(today)
    return { habits: Array.isArray(habits) && habits.every(validHabit) ? habits : seedHabits, settings: validSettings(settings, today) }
  } catch {
    return { habits: seedHabits, settings: defaultSettings(today) }
  }
}

export function saveHabits(habits) {
  try {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits))
  } catch {
    return false
  }
  return true
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    return false
  }
  return true
}

/* -------------------------------------------------------------------------
 * Browser-notification log
 *
 * Bookkeeping for an external side effect (raising a Notification), not UI
 * state, so it is deliberately kept out of React and out of the settings
 * object. It survives reloads so the user is not notified twice in one day.
 * ---------------------------------------------------------------------- */

export function readNotifiedDate() {
  try {
    const value = localStorage.getItem(REMINDER_LOG_KEY)
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
  } catch {
    return null
  }
}

export function writeNotifiedDate(dateKey) {
  try {
    localStorage.setItem(REMINDER_LOG_KEY, dateKey)
  } catch {
    return false
  }
  return true
}

export function clearAll() {
  try {
    localStorage.removeItem(HABITS_KEY)
    localStorage.removeItem(SETTINGS_KEY)
    localStorage.removeItem(REMINDER_LOG_KEY)
  } catch {
    return false
  }
  return true
}
