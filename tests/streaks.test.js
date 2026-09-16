import test from 'node:test'
import assert from 'node:assert/strict'

import { fromDateKey } from '../src/utils/dates.js'
import { getBestStreak, getCurrentStreak, isHabitScheduledOnDate } from '../src/utils/streaks.js'

const at = (key) => fromDateKey(key)
const daily = (completions) => ({ frequency: 'daily', completions })
const weekdays = (completions) => ({ frequency: 'weekdays', completions })
const custom = (completions, customDays) => ({ frequency: 'custom', completions, customDays })

/* ----------------------------------------------------------- scheduling */

test('daily habits are scheduled every day', () => {
  for (let day = 14; day <= 20; day += 1) {
    assert.equal(isHabitScheduledOnDate(daily([]), at(`2026-09-${day}`)), true)
  }
})

test('weekday habits run Monday to Friday only', () => {
  // 2026-09-14 is a Monday.
  const expected = { 14: true, 15: true, 16: true, 17: true, 18: true, 19: false, 20: false }
  Object.entries(expected).forEach(([day, scheduled]) => {
    assert.equal(isHabitScheduledOnDate(weekdays([]), at(`2026-09-${day}`)), scheduled, `2026-09-${day}`)
  })
})

test('custom days are 1-based with Sunday as 7', () => {
  // 2026-09-20 is a Sunday, 2026-09-21 a Monday.
  assert.equal(isHabitScheduledOnDate(custom([], [7]), at('2026-09-20')), true)
  assert.equal(isHabitScheduledOnDate(custom([], [7]), at('2026-09-21')), false)
  assert.equal(isHabitScheduledOnDate(custom([], [1]), at('2026-09-21')), true)
  assert.equal(isHabitScheduledOnDate(custom([], [1]), at('2026-09-20')), false)
  // Monday-Friday as custom must match the weekdays preset.
  assert.equal(isHabitScheduledOnDate(custom([], [1, 2, 3, 4, 5]), at('2026-09-19')), false)
  assert.equal(isHabitScheduledOnDate(custom([], [1, 2, 3, 4, 5]), at('2026-09-18')), true)
})

test('an empty custom day list is never scheduled', () => {
  for (let day = 14; day <= 20; day += 1) {
    assert.equal(isHabitScheduledOnDate(custom([], []), at(`2026-09-${day}`)), false)
  }
})

/* -------------------------------------------------------- best streaks */

test('a missed scheduled day breaks a daily streak', () => {
  // Mon Tue Wed [Thu missed] Fri
  assert.equal(getBestStreak(daily(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-18'])), 3)
})

test('weekend records do not inflate a weekday habit streak', () => {
  // Mon-Fri complete plus stray Saturday and Sunday records: still 5.
  const completions = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20']
  assert.equal(getBestStreak(weekdays(completions)), 5)
})

test('Friday to Monday stays consecutive for a weekday habit', () => {
  const completions = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-21']
  assert.equal(getBestStreak(weekdays(completions)), 6)
})

test('a weekday habit missing a weekday resets the run', () => {
  // Mon Tue [Wed missed] Thu Fri
  assert.equal(getBestStreak(weekdays(['2026-09-14', '2026-09-15', '2026-09-17', '2026-09-18'])), 2)
})

test('no history is a zero best streak', () => {
  assert.equal(getBestStreak(daily([])), 0)
})

test('custom schedules ignore unscheduled days between runs', () => {
  // Mondays only, three weeks running: consecutive by schedule.
  assert.equal(getBestStreak(custom(['2026-09-07', '2026-09-14', '2026-09-21'], [1])), 3)
})

/* ----------------------------------------------------- current streaks */

test('current streak counts back from a completed today', () => {
  assert.equal(getCurrentStreak(daily(['2026-09-14', '2026-09-15', '2026-09-16']), at('2026-09-16')), 3)
})

test('an unfinished today still shows the run ending yesterday', () => {
  assert.equal(getCurrentStreak(daily(['2026-09-14', '2026-09-15']), at('2026-09-16')), 2)
})

test('a missed yesterday resets the current streak to zero', () => {
  assert.equal(getCurrentStreak(daily(['2026-09-13']), at('2026-09-16')), 0)
})

test('a weekday habit keeps its run across the weekend', () => {
  const completions = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']
  // Read on the following Monday: the weekend neither breaks nor extends it.
  assert.equal(getCurrentStreak(weekdays(completions), at('2026-09-21')), 5)
})

test('no history is a zero current streak', () => {
  assert.equal(getCurrentStreak(daily([]), at('2026-09-16')), 0)
})

test('a future-dated completion does not count toward today', () => {
  assert.equal(getCurrentStreak(daily(['2026-09-18']), at('2026-09-16')), 0)
})
