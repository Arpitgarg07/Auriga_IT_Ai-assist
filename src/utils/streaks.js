import { addDays, fromDateKey, toDateKey } from './dates.js'

export function isHabitScheduledOnDate(habit, date) {
  if (habit.frequency === 'daily') return true
  if (habit.frequency === 'custom') return habit.customDays?.includes(fromDateKey(toDateKey(date)).getDay() || 7)
  return fromDateKey(toDateKey(date)).getDay() >= 1 && fromDateKey(toDateKey(date)).getDay() <= 5
}

export function getCurrentStreak(habit, today = new Date()) {
  const completions = new Set(habit.completions || [])
  let cursor = new Date(today)
  let streak = 0

  if (isHabitScheduledOnDate(habit, cursor) && !completions.has(toDateKey(cursor))) {
    cursor = addDays(cursor, -1)
  }

  while (streak < 10000) {
    if (isHabitScheduledOnDate(habit, cursor)) {
      if (!completions.has(toDateKey(cursor))) break
      streak += 1
    }
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function getBestStreak(habit) {
  const completions = new Set(habit.completions || [])
  if (!completions.size) return 0
  const dates = [...completions].filter((key) => isHabitScheduledOnDate(habit, fromDateKey(key))).sort()
  let best = 0
  let streak = 0
  let previousScheduledKey = null

  dates.forEach((key) => {
    const date = fromDateKey(key)
    let previousDate = addDays(date, -1)
    while (!isHabitScheduledOnDate(habit, previousDate)) previousDate = addDays(previousDate, -1)
    if (previousScheduledKey === toDateKey(previousDate)) {
      streak += 1
    } else {
      streak = 1
    }
    previousScheduledKey = key
    best = Math.max(best, streak)
  })
  return best
}
