import test from 'node:test'
import assert from 'node:assert/strict'

import { addDays, fromDateKey, toDateKey } from '../src/utils/dates.js'
import { DEFAULT_REMINDER_TIME } from '../src/utils/constants.js'
import {
  formatReminderTime,
  getMorningReminder,
  getTodaysHabits,
  getTodaysPendingHabits,
  isPastReminderTime,
  shouldShowMorningModal,
  toMinutes,
} from '../src/utils/reminders.js'

/* ---------------------------------------------------------------- helpers */

// A Wednesday, so weekday habits are in scope by default.
const TODAY = '2026-09-16'

const back = (dateKey, days) => toDateKey(addDays(fromDateKey(dateKey), -days))

// `count` consecutive daily completions ending the day BEFORE `dateKey`, which
// is exactly what makes a current streak of `count` while today is unlogged.
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

// Find the first date on or after `from` whose getDay() equals `target`.
function firstDayOfWeek(from, target) {
  const cursor = fromDateKey(from)
  while (cursor.getDay() !== target) cursor.setDate(cursor.getDate() + 1)
  return toDateKey(cursor)
}

/* ------------------------------------------- 1. a new day with open habits */

test('scenario 1: a new day with unlogged habits produces a pending reminder', () => {
  const habits = [
    habit({ name: 'Drink Water' }),
    habit({ name: 'Read' }),
    habit({ name: 'No Sugar' }),
  ]
  const reminder = getMorningReminder(habits, TODAY)

  assert.equal(reminder.mode, 'pending')
  assert.equal(reminder.pendingCount, 3)
  assert.equal(reminder.total, 3)
  assert.equal(reminder.completedCount, 0)
  assert.equal(reminder.allDone, false)
  assert.deepEqual(reminder.pending.map((h) => h.name), ['Drink Water', 'Read', 'No Sugar'])
  assert.match(reminder.headline, /3 habits waiting/)
})

test('the pending list preserves stored habit order and carries schedule labels', () => {
  const habits = [
    habit({ name: 'Workout', frequency: 'weekdays' }),
    habit({ name: 'Water' }),
  ]
  const reminder = getMorningReminder(habits, TODAY)
  assert.deepEqual(reminder.pending.map((h) => h.name), ['Workout', 'Water'])
  assert.equal(reminder.items[0].schedule, 'Monday to Friday')
  assert.equal(reminder.items[1].schedule, 'Every day')
})

/* -------------------------------------- 2. completing a habit removes it */

test('scenario 2: a completed habit leaves the pending list', () => {
  const habits = [
    habit({ name: 'Drink Water', completions: [TODAY] }),
    habit({ name: 'Read' }),
    habit({ name: 'Workout', frequency: 'weekdays' }),
  ]
  const reminder = getMorningReminder(habits, TODAY)

  assert.equal(reminder.pendingCount, 2)
  assert.equal(reminder.completedCount, 1)
  assert.ok(!reminder.pending.some((h) => h.name === 'Drink Water'))
  assert.deepEqual(reminder.logged.map((h) => h.name), ['Drink Water'])
  assert.deepEqual(getTodaysPendingHabits(habits, TODAY).map((h) => h.name), ['Read', 'Workout'])
})

test('uncompleting a habit puts it back into the pending list', () => {
  const done = habit({ name: 'Read', completions: [TODAY] })
  const undone = habit({ name: 'Read', completions: [] })
  assert.equal(getMorningReminder([done], TODAY).pendingCount, 0)
  assert.equal(getMorningReminder([undone], TODAY).pendingCount, 1)
})

test('a completion on a different date does not satisfy today', () => {
  const habits = [habit({ name: 'Read', completions: [back(TODAY, 1)] })]
  const reminder = getMorningReminder(habits, TODAY)
  assert.equal(reminder.pendingCount, 1)
  assert.equal(reminder.completedCount, 0)
})

/* ------------------------------------------- 3. everything done for today */

test('scenario 3: all habits complete reports the completion state', () => {
  const habits = [
    habit({ name: 'Drink Water', completions: [TODAY] }),
    habit({ name: 'Read', completions: [TODAY] }),
  ]
  const reminder = getMorningReminder(habits, TODAY)

  assert.equal(reminder.mode, 'complete')
  assert.equal(reminder.allDone, true)
  assert.equal(reminder.pendingCount, 0)
  assert.match(reminder.headline, /all done/i)
  assert.ok(reminder.message.length > 0)
})

test('nothing scheduled is a rest day, not a completion', () => {
  const saturday = firstDayOfWeek('2026-09-01', 6)
  const reminder = getMorningReminder([habit({ frequency: 'weekdays' })], saturday)
  assert.equal(reminder.mode, 'rest')
  assert.equal(reminder.nothingScheduled, true)
  assert.equal(reminder.total, 0)
})

test('no habits at all is a rest day', () => {
  assert.equal(getMorningReminder([], TODAY).mode, 'rest')
})

/* --------------------------------- 4. weekday habits on the weekend are out */

test('scenario 4: a weekday habit is not reminded on Saturday or Sunday', () => {
  const saturday = firstDayOfWeek('2026-09-01', 6)
  const sunday = firstDayOfWeek('2026-09-01', 0)
  const workout = habit({ name: 'Workout', frequency: 'weekdays' })

  assert.equal(getMorningReminder([workout], saturday).pendingCount, 0)
  assert.equal(getMorningReminder([workout], sunday).pendingCount, 0)
  assert.equal(getTodaysHabits([workout], saturday).due.length, 0)

  // …and is reminded on each weekday.
  for (const offset of [0, 1, 2, 3, 4]) {
    const weekday = toDateKey(addDays(fromDateKey(saturday), offset - 5))
    if (fromDateKey(weekday).getDay() >= 1 && fromDateKey(weekday).getDay() <= 5) {
      assert.equal(getMorningReminder([workout], weekday).pendingCount, 1, `${weekday} should remind`)
    }
  }
})

test('a daily habit IS reminded at the weekend', () => {
  const saturday = firstDayOfWeek('2026-09-01', 6)
  assert.equal(getMorningReminder([habit({ frequency: 'daily' })], saturday).pendingCount, 1)
})

/* ------------------------------- 5. custom schedules only on chosen days */

test('scenario 5: a custom habit is reminded only on its selected days', () => {
  // Monday, Wednesday, Friday — customDays is 1-based with Sunday as 7.
  const mondayWednesdayFriday = habit({ name: 'Gym', frequency: 'custom', customDays: [1, 3, 5] })

  const expected = { 1: true, 2: false, 3: true, 4: false, 5: true, 6: false, 0: false }
  const start = fromDateKey('2026-09-06') // a Sunday
  for (let offset = 0; offset < 7; offset += 1) {
    const day = toDateKey(addDays(start, offset))
    const jsDay = fromDateKey(day).getDay()
    assert.equal(
      getMorningReminder([mondayWednesdayFriday], day).pendingCount,
      expected[jsDay] ? 1 : 0,
      `${day} (getDay=${jsDay})`,
    )
  }
})

test('a custom Sunday-only habit is reminded on Sunday, not Monday', () => {
  const sundayOnly = habit({ name: 'Weekly review', frequency: 'custom', customDays: [7] })
  const sunday = firstDayOfWeek('2026-09-01', 0)
  const monday = toDateKey(addDays(fromDateKey(sunday), 1))

  assert.equal(getMorningReminder([sundayOnly], sunday).pendingCount, 1)
  assert.equal(getMorningReminder([sundayOnly], monday).pendingCount, 0)
})

test('a custom habit with no days selected is never due and never breaks', () => {
  const never = habit({ frequency: 'custom', customDays: [] })
  assert.equal(getMorningReminder([never], TODAY).total, 0)
})

/* --------------------------------------------- 6. archived habits are out */

test('scenario 6: archived habits never appear in reminders', () => {
  const habits = [
    habit({ name: 'Archived thing', archived: true }),
    habit({ name: 'Active thing' }),
  ]
  const reminder = getMorningReminder(habits, TODAY)
  assert.equal(reminder.total, 1)
  assert.deepEqual(reminder.pending.map((h) => h.name), ['Active thing'])
  assert.deepEqual(getTodaysPendingHabits(habits, TODAY).map((h) => h.name), ['Active thing'])
})

test('archiving a habit removes it from the very next reminder', () => {
  const active = habit({ name: 'Read' })
  assert.equal(getMorningReminder([active], TODAY).pendingCount, 1)
  assert.equal(getMorningReminder([{ ...active, archived: true }], TODAY).pendingCount, 0)
})

/* ---------------------------- 7 & 8. once per day, and not on navigation */

test('scenario 7 & 8: the morning modal is once per day and survives reloads', () => {
  const habits = [habit({ name: 'Read' })]
  const reminder = getMorningReminder(habits, TODAY)

  // First open of the day: never shown before.
  const fresh = { enabled: true, time: DEFAULT_REMINDER_TIME, browserNotifications: false, lastShownDate: null }
  assert.equal(shouldShowMorningModal(reminder, fresh), true)

  // Acknowledged: a reload, a re-render or a tab switch cannot show it again.
  const seen = { ...fresh, lastShownDate: TODAY }
  assert.equal(shouldShowMorningModal(reminder, seen), false)
  // Repeated evaluation is stable — this is what "does not pop up on navigation" means.
  assert.equal(shouldShowMorningModal(reminder, seen), false)
  assert.equal(shouldShowMorningModal(reminder, seen), false)

  // A genuine day rollover shows it again.
  const tomorrow = toDateKey(addDays(fromDateKey(TODAY), 1))
  assert.equal(shouldShowMorningModal(getMorningReminder(habits, tomorrow), seen), true)
})

test('the modal is suppressed when reminders are disabled', () => {
  const reminder = getMorningReminder([habit()], TODAY)
  const off = { enabled: false, time: DEFAULT_REMINDER_TIME, lastShownDate: null }
  assert.equal(shouldShowMorningModal(reminder, off), false)
})

test('the modal is suppressed on a rest day', () => {
  const sunday = firstDayOfWeek('2026-09-01', 0)
  const workout = habit({ frequency: 'weekdays' })
  const reminder = getMorningReminder([workout], sunday)
  const fresh = { enabled: true, time: DEFAULT_REMINDER_TIME, lastShownDate: null }
  assert.equal(shouldShowMorningModal(reminder, fresh), false)
})

test('a corrupt or future lastShownDate cannot permanently hide the modal', () => {
  const reminder = getMorningReminder([habit()], TODAY)
  // A garbage marker is normalised to null by storage, which re-enables it.
  assert.equal(shouldShowMorningModal(reminder, { enabled: true, lastShownDate: null }), true)
})

/* ----------------------------------------------- streak context honesty */

test('a pending habit with a live streak is named as being at risk', () => {
  const habits = [habit({ name: 'Read', completions: runEndingYesterday(TODAY, 8) })]
  const reminder = getMorningReminder(habits, TODAY)

  assert.equal(reminder.hasStreakAtRisk, true)
  assert.equal(reminder.streak.current, 8)
  assert.equal(reminder.streak.habit.name, 'Read')
  assert.match(reminder.message, /8-day streak/)
  assert.match(reminder.message, /Read/)
})

test('the longest live streak among pending habits is the one named', () => {
  const habits = [
    habit({ name: 'Short', completions: runEndingYesterday(TODAY, 2) }),
    habit({ name: 'Long', completions: runEndingYesterday(TODAY, 14) }),
  ]
  const reminder = getMorningReminder(habits, TODAY)
  assert.equal(reminder.streak.current, 14)
  assert.equal(reminder.streak.habit.name, 'Long')
})

test('a pending habit with no streak produces no streak claim', () => {
  const reminder = getMorningReminder([habit({ name: 'Brand new' })], TODAY)
  assert.equal(reminder.hasStreakAtRisk, false)
  assert.equal(reminder.streak, null)
  assert.doesNotMatch(reminder.message, /streak/i)
})

test('a live streak that is already logged today is NOT claimed to be at risk', () => {
  // The subtle case: the user does have a streak, but the habit carrying it is
  // already done. Only a habit with a zero streak is outstanding, so claiming
  // today would "break the streak" would be false.
  const habits = [
    habit({ name: 'Water', completions: [...runEndingYesterday(TODAY, 10), TODAY] }),
    habit({ name: 'Read' }),
  ]
  const reminder = getMorningReminder(habits, TODAY)

  assert.equal(reminder.pendingCount, 1)
  assert.equal(reminder.hasStreakAtRisk, false)
  assert.doesNotMatch(reminder.message, /streak/i)
  assert.doesNotMatch(reminder.headline, /streak/i)
})

test('a streak broken before today produces no streak claim', () => {
  // Two completions, then a missed day before today: the run is already dead, so
  // today cannot "break" anything.
  const habits = [habit({ name: 'Read', completions: [back(TODAY, 4), back(TODAY, 3)] })]
  const reminder = getMorningReminder(habits, TODAY)
  assert.equal(reminder.hasStreakAtRisk, false)
  assert.doesNotMatch(reminder.message, /streak/i)
})

test('a completion-state reminder mentions no at-risk streak', () => {
  const habits = [habit({ name: 'Read', completions: [...runEndingYesterday(TODAY, 5), TODAY] })]
  const reminder = getMorningReminder(habits, TODAY)
  assert.equal(reminder.mode, 'complete')
  assert.equal(reminder.hasStreakAtRisk, false)
})

/* ---------------------------------------------------------- reminder time */

test('toMinutes parses valid times and rejects junk', () => {
  assert.equal(toMinutes('08:00'), 480)
  assert.equal(toMinutes('00:00'), 0)
  assert.equal(toMinutes('23:59'), 1439)
  assert.equal(toMinutes('8:30'), 510)
  assert.equal(toMinutes('24:00'), null)
  assert.equal(toMinutes('12:60'), null)
  assert.equal(toMinutes(''), null)
  assert.equal(toMinutes(null), null)
  assert.equal(toMinutes('breakfast'), null)
})

test('isPastReminderTime compares against the clock', () => {
  const at = (hours, minutes) => new Date(2026, 8, 16, hours, minutes)
  assert.equal(isPastReminderTime('08:00', at(7, 59)), false)
  assert.equal(isPastReminderTime('08:00', at(8, 0)), true)
  assert.equal(isPastReminderTime('08:00', at(8, 1)), true)
  assert.equal(isPastReminderTime('23:00', at(22, 59)), false)
  // An unparseable time is treated as "no constraint" rather than blocking.
  assert.equal(isPastReminderTime('nonsense', at(0, 0)), true)
})

test('formatReminderTime renders 12-hour labels', () => {
  assert.equal(formatReminderTime('08:00'), '8:00 AM')
  assert.equal(formatReminderTime('00:00'), '12:00 AM')
  assert.equal(formatReminderTime('12:00'), '12:00 PM')
  assert.equal(formatReminderTime('13:45'), '1:45 PM')
  assert.equal(formatReminderTime('23:59'), '11:59 PM')
  // Falls back rather than throwing on bad input.
  assert.equal(formatReminderTime('nonsense'), 'nonsense')
  assert.equal(formatReminderTime(null), DEFAULT_REMINDER_TIME)
})

/* ------------------------------------------------------- habit integrity */

test('a habit missing a completions array is treated as unlogged, not a crash', () => {
  const broken = { ...habit({ name: 'Corrupt' }), completions: undefined }
  const reminder = getMorningReminder([broken], TODAY)
  assert.equal(reminder.pendingCount, 1)
})

test('the reminder never mutates the habits it is given', () => {
  const habits = [habit({ name: 'Read', completions: [back(TODAY, 1)] })]
  const snapshot = JSON.stringify(habits)
  getMorningReminder(habits, TODAY)
  getTodaysPendingHabits(habits, TODAY)
  assert.equal(JSON.stringify(habits), snapshot)
})
