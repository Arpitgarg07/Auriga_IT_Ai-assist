import test from 'node:test'
import assert from 'node:assert/strict'

import { dayOfYear, greetingFor, initialsFor, motivationFor, smallWinFor } from '../src/utils/motivation.js'

// motivationFor rotates its message by day of the year, so a single call only
// ever exercises one branch. These tests sweep a whole year to cover them all.
const year = (from = new Date(2026, 0, 1)) =>
  Array.from({ length: 366 }, (_, index) => new Date(from.getFullYear(), 0, 1 + index))

/* ------------------------------------------------------------- greeting */

test('greetingFor follows the clock, with night wrapping midnight', () => {
  const at = (hour) => greetingFor(new Date(2026, 8, 16, hour, 0))
  // Night wraps around midnight rather than only covering the late evening.
  assert.equal(at(0).text, 'Good night')
  assert.equal(at(4).text, 'Good night')
  assert.equal(at(5).text, 'Good morning')
  assert.equal(at(6).text, 'Good morning')
  assert.equal(at(11).text, 'Good morning')
  assert.equal(at(12).text, 'Good afternoon')
  assert.equal(at(16).text, 'Good afternoon')
  assert.equal(at(17).text, 'Good evening')
  assert.equal(at(20).text, 'Good evening')
  assert.equal(at(21).text, 'Good night')
  assert.equal(at(23).text, 'Good night')
})

test('every hour of the day maps to a greeting', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const greeting = greetingFor(new Date(2026, 8, 16, hour, 30))
    assert.ok(greeting.text.length > 0, `hour ${hour}`)
    assert.ok(greeting.emoji.length > 0, `hour ${hour}`)
    assert.ok(greeting.period.length > 0, `hour ${hour}`)
  }
})

test('every greeting carries an emoji', () => {
  year().forEach((date) => {
    assert.ok(greetingFor(date).emoji.length > 0)
  })
})

/* ----------------------------------------------- streak-claim honesty */

test('no message claims a streak is on the line when none is at risk', () => {
  year().forEach((date) => {
    const message = motivationFor({ completed: 0, total: 3, streak: 0, date })
    assert.doesNotMatch(message, /streak is on the line/i, `leaked a streak claim on ${date.toDateString()}`)
  })
})

test('a message claims a streak only when one is genuinely at risk', () => {
  const messages = year().map((date) => motivationFor({ completed: 0, total: 3, streak: 7, date }))

  // At least one day surfaces the streak line…
  assert.ok(messages.some((message) => /7-day streak is on the line/.test(message)))
  // …and whenever the phrase appears, it carries the caller's own number.
  messages.forEach((message) => {
    if (/streak is on the line/i.test(message)) {
      assert.match(message, /7-day streak is on the line/)
    }
  })
})

test('completed work never produces streak language', () => {
  year().forEach((date) => {
    const done = motivationFor({ completed: 3, total: 3, streak: 9, date })
    assert.doesNotMatch(done, /streak is on the line/i)

    const partial = motivationFor({ completed: 1, total: 3, streak: 9, date })
    assert.doesNotMatch(partial, /streak is on the line/i)
  })
})

test('a rest day produces rest copy, not streak copy', () => {
  year().forEach((date) => {
    const rest = motivationFor({ completed: 0, total: 0, streak: 12, date })
    assert.doesNotMatch(rest, /streak is on the line/i)
  })
})

test('every message is a non-empty string for every combination', () => {
  year().forEach((date) => {
    ;[[0, 0, 0], [0, 3, 0], [0, 3, 5], [1, 3, 5], [3, 3, 5]].forEach(([completed, total, streak]) => {
      const message = motivationFor({ completed, total, streak, date })
      assert.equal(typeof message, 'string')
      assert.ok(message.trim().length > 0)
    })
  })
})

/* ------------------------------------------------------------- helpers */

test('dayOfYear is 1-based and stable', () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1)
  assert.equal(dayOfYear(new Date(2026, 11, 31)), 365)
})

test('initialsFor degrades gracefully', () => {
  assert.equal(initialsFor('Sneha'), 'S')
  assert.equal(initialsFor('Sneha Sharma'), 'SS')
  assert.equal(initialsFor('  '), 'Y')
  assert.equal(initialsFor(''), 'Y')
  assert.equal(initialsFor(null), 'Y')
  assert.equal(initialsFor(undefined), 'Y')
})

test('smallWinFor always returns an encouragement and never indexes out of range', () => {
  for (let index = -5; index < 50; index += 1) {
    assert.ok(smallWinFor(index).length > 0)
  }
})
