// Shared vocabulary for schedules, milestones and icons.
// Sunday is represented as 7 (not 0) so custom day lists stay 1-based and
// match the Monday-first labelling used throughout the UI.
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// The storage vocabulary for schedules, index-aligned with WEEKDAYS: index 0 is
// Monday in both, so `DAY_NAMES[i]` is the long name of `WEEKDAYS[i]`. The server
// stores these strings; the app works in 1-based numbers. Keeping both lists
// side by side is what makes that mapping checkable in a test.
export const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export const MILESTONES = [1, 3, 7, 14, 21, 30, 50, 75]

export const CHALLENGE_LENGTH = 75

export const SCHEDULE_OPTIONS = [
  { id: 'daily', label: 'Every day', hint: 'All seven days' },
  { id: 'weekdays', label: 'Weekdays', hint: 'Monday to Friday' },
  { id: 'custom', label: 'Custom days', hint: 'Pick exact days' },
]

export const DEFAULT_CUSTOM_DAYS = [1, 2, 3, 4, 5]

// Default morning-reminder time, stored as 'HH:MM' 24-hour so it maps directly
// onto an <input type="time"> value.
export const DEFAULT_REMINDER_TIME = '08:00'

// Icon names are stored on the habit record; the UI resolves them through this
// list so persisted data stays readable and no arbitrary component is imported.
export const HABIT_ICONS = ['Target', 'Droplets', 'BookOpen', 'Dumbbell', 'Apple', 'Moon', 'Sun', 'Heart', 'Brain', 'Footprints']

export function scheduleLabel(habit) {
  if (habit.frequency === 'daily') return 'Every day'
  if (habit.frequency === 'weekdays') return 'Monday to Friday'
  const days = (habit.customDays || []).slice().sort((a, b) => a - b)
  if (!days.length) return 'No days selected'
  if (days.length === 7) return 'Every day'
  return days.map((day) => WEEKDAYS[day - 1]).join(', ')
}

export function milestoneLabel(milestone) {
  return milestone === 1 ? 'First completion' : `${milestone}-day streak`
}
