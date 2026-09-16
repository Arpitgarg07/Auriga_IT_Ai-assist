import { DAY_NAMES } from '../../../src/utils/constants.js'

/**
 * The boundary between how schedules are stored and how they are computed.
 *
 * MongoDB stores day names — `["monday", "wednesday"]` — because they are
 * readable in the database and survive a 1-based/0-based mistake. The streak
 * engine works in 1-based numbers, because that is what it has always done and
 * it is verified. This module is the only place the two representations meet,
 * so the engine needed no change at all.
 */

const NAME_TO_NUMBER = Object.fromEntries(DAY_NAMES.map((name, index) => [name, index + 1]))
const NUMBER_TO_NAME = Object.fromEntries(DAY_NAMES.map((name, index) => [index + 1, name]))

export function scheduledDaysToCustomDays(scheduledDays) {
  if (!Array.isArray(scheduledDays)) return []
  const numbers = scheduledDays
    .map((day) => NAME_TO_NUMBER[String(day).trim().toLowerCase()])
    .filter((value) => Number.isInteger(value))
  return [...new Set(numbers)].sort((a, b) => a - b)
}

export function customDaysToScheduledDays(customDays) {
  if (!Array.isArray(customDays)) return []
  const valid = customDays
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
  return [...new Set(valid)].sort((a, b) => a - b).map((value) => NUMBER_TO_NAME[value])
}

/**
 * Shapes a habit for the client. The output matches the localStorage habit
 * object exactly, so every component and the whole verified engine work
 * identically whether the data came from the browser or from MongoDB.
 */
export function presentHabit(habit, completions = []) {
  const scheduledDays = Array.isArray(habit.scheduledDays) ? habit.scheduledDays : []
  return {
    id: String(habit._id),
    clientId: habit.clientId || null,
    name: habit.name,
    description: habit.description || '',
    icon: habit.icon || 'Target',
    frequency: habit.frequency,
    // Derived, never stored twice: the engine reads this field.
    customDays: scheduledDaysToCustomDays(scheduledDays),
    scheduledDays,
    archived: Boolean(habit.archived),
    createdAt: habit.createdAt,
    completions: [...completions].sort(),
  }
}

/**
 * Rewards are stored with the `title` field the data model specifies but
 * presented as `name`, which is what the existing UI and its tests already use.
 */
export function presentReward(reward) {
  return {
    id: String(reward._id),
    clientId: reward.clientId || null,
    name: reward.title,
    description: reward.description || '',
    milestone: reward.milestone,
    claimed: Boolean(reward.claimed),
    claimedAt: reward.claimedAt || null,
  }
}
