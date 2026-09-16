const HABITS_KEY = 'habit-tracker-habits'
const SETTINGS_KEY = 'habit-tracker-settings'

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
  createdAt: new Date().toISOString(),
  archived: false,
  completions: [],
}))

function validHabit(habit) {
  return habit && typeof habit === 'object' && typeof habit.id === 'string' && typeof habit.name === 'string'
    && ['daily', 'weekdays', 'custom'].includes(habit.frequency) && Array.isArray(habit.completions)
}

function validSettings(settings, today) {
  if (!settings || typeof settings.challengeStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(settings.challengeStart)) {
    return { challengeStart: today, achievements: [], rewards: [] }
  }
  return {
    ...settings,
    achievements: Array.isArray(settings.achievements) ? settings.achievements : [],
    rewards: Array.isArray(settings.rewards) ? settings.rewards : [],
  }
}

export function loadData(today) {
  try {
    const savedHabits = localStorage.getItem(HABITS_KEY)
    const savedSettings = localStorage.getItem(SETTINGS_KEY)
    const habits = savedHabits ? JSON.parse(savedHabits) : seedHabits
    const settings = savedSettings ? JSON.parse(savedSettings) : { challengeStart: today, achievements: [], rewards: [] }
    return { habits: Array.isArray(habits) && habits.every(validHabit) ? habits : seedHabits, settings: validSettings(settings, today) }
  } catch {
    return { habits: seedHabits, settings: { challengeStart: today, achievements: [], rewards: [] } }
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
