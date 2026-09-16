import test from 'node:test'
import assert from 'node:assert/strict'

import { DAY_NAMES, WEEKDAYS } from '../src/utils/constants.js'
import {
  customDaysToScheduledDays,
  presentHabit,
  presentReward,
  scheduledDaysToCustomDays,
} from '../server/src/services/habitMapper.js'

/* ------------------------------------------------- day-name alignment */

test('DAY_NAMES is index-aligned with WEEKDAYS', () => {
  // Both lists start on Monday, which is what makes the 1-based mapping safe.
  assert.equal(DAY_NAMES.length, 7)
  assert.equal(WEEKDAYS.length, 7)
  DAY_NAMES.forEach((name, index) => {
    assert.equal(name, name.toLowerCase())
    assert.ok(
      WEEKDAYS[index].toLowerCase().startsWith(name.slice(0, 3)),
      `${WEEKDAYS[index]} should correspond to ${name}`,
    )
  })
  assert.equal(DAY_NAMES[0], 'monday')
  assert.equal(DAY_NAMES[6], 'sunday')
})

test('customDays round-trips through scheduledDays', () => {
  const cases = [[], [1], [7], [1, 2, 3, 4, 5], [1, 3, 5], [6, 7], [1, 2, 3, 4, 5, 6, 7]]
  cases.forEach((days) => {
    assert.deepEqual(scheduledDaysToCustomDays(customDaysToScheduledDays(days)), days, `${days.join(',')} round trip`)
  })
})

test('Monday is 1 and Sunday is 7 in both directions', () => {
  assert.deepEqual(scheduledDaysToCustomDays(['monday']), [1])
  assert.deepEqual(scheduledDaysToCustomDays(['sunday']), [7])
  assert.deepEqual(customDaysToScheduledDays([1]), ['monday'])
  assert.deepEqual(customDaysToScheduledDays([7]), ['sunday'])
})

test('mapping is case-insensitive and de-duplicates', () => {
  assert.deepEqual(scheduledDaysToCustomDays(['MONDAY', 'Monday', ' monday ']), [1])
  assert.deepEqual(customDaysToScheduledDays([1, 1, 1]), ['monday'])
})

test('mapping is sorted and ignores junk', () => {
  assert.deepEqual(scheduledDaysToCustomDays(['friday', 'monday', 'wednesday']), [1, 3, 5])
  assert.deepEqual(scheduledDaysToCustomDays(['noday', 'monday', 7, null]), [1])
  assert.deepEqual(customDaysToScheduledDays([5, 1, 99, 0, -3, 'x']), ['monday', 'friday'])
})

test('non-array input yields an empty schedule rather than throwing', () => {
  ;[undefined, null, 'monday', 42, {}].forEach((value) => {
    assert.deepEqual(scheduledDaysToCustomDays(value), [])
    assert.deepEqual(customDaysToScheduledDays(value), [])
  })
})

/* ------------------------------------------------------------ presenters */

test('presentHabit produces exactly the shape the client stores locally', () => {
  const habit = presentHabit({
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    clientId: 'local-1',
    name: 'Workout',
    description: 'Move',
    icon: 'Dumbbell',
    frequency: 'custom',
    scheduledDays: ['monday', 'wednesday', 'friday'],
    archived: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }, ['2026-09-16', '2026-09-14'])

  assert.equal(habit.id, 'aaaaaaaaaaaaaaaaaaaaaaaa')
  assert.equal(habit.name, 'Workout')
  assert.equal(habit.icon, 'Dumbbell')
  assert.equal(habit.frequency, 'custom')
  // The engine reads customDays; it is derived here, never stored twice.
  assert.deepEqual(habit.customDays, [1, 3, 5])
  assert.deepEqual(habit.scheduledDays, ['monday', 'wednesday', 'friday'])
  assert.equal(habit.archived, false)
  assert.deepEqual(habit.completions, ['2026-09-14', '2026-09-16'], 'sorted')
})

test('presentHabit fills gaps so a sparse document still renders', () => {
  const habit = presentHabit({ _id: 'b', name: 'Read' })
  assert.equal(habit.description, '')
  assert.equal(habit.icon, 'Target')
  assert.deepEqual(habit.customDays, [])
  assert.deepEqual(habit.completions, [])
  assert.equal(habit.archived, false)
})

test('presentReward maps the stored title onto the client field name', () => {
  const reward = presentReward({
    _id: 'r1',
    clientId: 'local-r1',
    title: 'Buy a new dress',
    description: 'Treat',
    milestone: 14,
    claimed: true,
    claimedAt: new Date('2026-09-16T00:00:00Z'),
  })

  assert.equal(reward.name, 'Buy a new dress')
  assert.equal(reward.milestone, 14)
  assert.equal(reward.claimed, true)
  assert.ok(reward.claimedAt)
})

test('presentReward defaults claimed to false and claimedAt to null', () => {
  const reward = presentReward({ _id: 'r2', title: 'Spa day', milestone: 30 })
  assert.equal(reward.claimed, false)
  assert.equal(reward.claimedAt, null)
  assert.equal(reward.description, '')
})
