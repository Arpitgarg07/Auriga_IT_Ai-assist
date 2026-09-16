import { addDays, fromDateKey, toDateKey } from './dates.js'
import { getBestStreak, getCurrentStreak, isHabitScheduledOnDate } from './streaks.js'
import { WEEKDAYS } from './constants.js'

const MAX_SPAN_DAYS = 3660 // ten years; a guard against runaway walks on bad data

// Every scheduled date key for a habit inside an inclusive range.
export function scheduledKeysBetween(habit, startKey, endKey) {
  const keys = []
  const end = fromDateKey(endKey)
  let cursor = fromDateKey(startKey)
  let guard = 0
  while (cursor <= end && guard < MAX_SPAN_DAYS) {
    if (isHabitScheduledOnDate(habit, cursor)) keys.push(toDateKey(cursor))
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return keys
}

// A habit cannot miss days before it existed. The later of "when it was created"
// and the requested floor becomes the effective start of its history.
export function effectiveStart(habit, floorKey) {
  if (!habit.createdAt) return floorKey
  const created = toDateKey(new Date(habit.createdAt))
  return created > floorKey ? created : floorKey
}

// Per-habit scorecard for any window: completed, missed, schedule length, rate
// and both streaks. Missed counts scheduled days that were never checked off.
export function habitReport(habit, floorKey, todayKey) {
  const startKey = effectiveStart(habit, floorKey)
  const scheduled = scheduledKeysBetween(habit, startKey, todayKey)
  const completed = new Set(habit.completions || [])
  const done = scheduled.reduce((total, key) => total + (completed.has(key) ? 1 : 0), 0)
  return {
    startKey,
    scheduled: scheduled.length,
    done,
    missed: scheduled.length - done,
    rate: scheduled.length ? Math.round((done / scheduled.length) * 100) : 0,
    current: getCurrentStreak(habit, fromDateKey(todayKey)),
    best: getBestStreak(habit),
  }
}

// Day-by-day completion density across a set of habits.
export function periodStats(habits, startKey, endKey) {
  const perDay = []
  const end = fromDateKey(endKey)
  let cursor = fromDateKey(startKey)
  let guard = 0
  while (cursor <= end && guard < MAX_SPAN_DAYS) {
    const key = toDateKey(cursor)
    const due = habits.filter((habit) => effectiveStart(habit, startKey) <= key && isHabitScheduledOnDate(habit, cursor))
    const done = due.filter((habit) => (habit.completions || []).includes(key)).length
    perDay.push({ key, scheduled: due.length, done, missed: due.length - done, rate: due.length ? done / due.length : 0 })
    cursor = addDays(cursor, 1)
    guard += 1
  }
  const scheduled = perDay.reduce((total, day) => total + day.scheduled, 0)
  const done = perDay.reduce((total, day) => total + day.done, 0)
  return { startKey, endKey, perDay, scheduled, done, missed: scheduled - done, rate: scheduled ? Math.round((done / scheduled) * 100) : 0 }
}

// The earliest day any real history could exist for, used by the "All time" filter.
export function earliestKey(habits, challengeStart, todayKey) {
  const candidates = [challengeStart, todayKey]
  habits.forEach((habit) => {
    if (habit.createdAt) candidates.push(toDateKey(new Date(habit.createdAt)))
    ;(habit.completions || []).forEach((key) => candidates.push(key))
  })
  return candidates.filter(Boolean).sort()[0]
}

export const RANGE_IDS = ['7d', '30d', 'month', 'all']

export function buildRange(id, habits, challengeStart, todayKey) {
  if (id === '7d') return { id, label: 'Last 7 days', startKey: toDateKey(addDays(fromDateKey(todayKey), -6)), endKey: todayKey }
  if (id === '30d') return { id, label: 'Last 30 days', startKey: toDateKey(addDays(fromDateKey(todayKey), -29)), endKey: todayKey }
  if (id === 'month') return { id, label: 'This month', startKey: `${todayKey.slice(0, 7)}-01`, endKey: todayKey }
  return { id: 'all', label: 'All time', startKey: earliestKey(habits, challengeStart, todayKey), endKey: todayKey }
}

// Completion rate grouped by day of week, so the UI can name a strongest day.
export function weekdayBreakdown(habits, startKey, endKey) {
  const buckets = WEEKDAYS.map((label, index) => ({ label, index: index + 1, scheduled: 0, done: 0 }))
  const end = fromDateKey(endKey)
  let cursor = fromDateKey(startKey)
  let guard = 0
  while (cursor <= end && guard < MAX_SPAN_DAYS) {
    const key = toDateKey(cursor)
    const jsDay = cursor.getDay()
    const bucket = buckets[jsDay === 0 ? 6 : jsDay - 1]
    habits.forEach((habit) => {
      if (effectiveStart(habit, startKey) > key) return
      if (!isHabitScheduledOnDate(habit, cursor)) return
      bucket.scheduled += 1
      if ((habit.completions || []).includes(key)) bucket.done += 1
    })
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return buckets.map((bucket) => ({ ...bucket, rate: bucket.scheduled ? Math.round((bucket.done / bucket.scheduled) * 100) : 0 }))
}

// Weekly comparison: the current 7 days against the 7 before it.
export function weekComparison(habits, todayKey) {
  const thisWeek = periodStats(habits, toDateKey(addDays(fromDateKey(todayKey), -6)), todayKey)
  const lastWeek = periodStats(
    habits,
    toDateKey(addDays(fromDateKey(todayKey), -13)),
    toDateKey(addDays(fromDateKey(todayKey), -7)),
  )
  return { thisWeek, lastWeek, delta: thisWeek.rate - lastWeek.rate }
}

// A run of consecutive calendar dates with at least one completion.
export function longestDailyRun(habits) {
  const days = [...new Set(habits.flatMap((habit) => habit.completions || []))].sort()
  if (!days.length) return { length: 0, endKey: null }
  let best = 1
  let current = 1
  let endKey = days[0]
  for (let index = 1; index < days.length; index += 1) {
    const previous = fromDateKey(days[index - 1])
    const expected = toDateKey(addDays(previous, 1))
    current = expected === days[index] ? current + 1 : 1
    if (current > best) {
      best = current
      endKey = days[index]
    }
  }
  return { length: best, endKey }
}

// Insights are derived only from stored completions, never invented.
export function buildInsights(habits, startKey, endKey, todayKey) {
  const insights = []
  if (!habits.length) return insights

  const days = weekdayBreakdown(habits, startKey, endKey)
  const ranked = days.filter((day) => day.scheduled >= 2).sort((a, b) => b.rate - a.rate)
  if (ranked.length) {
    const top = ranked[0]
    insights.push({ tone: 'positive', title: `${top.label} is your strongest day`, detail: `${top.rate}% completion across ${top.scheduled} scheduled habits.` })
    if (ranked.length > 1 && top.rate - ranked[ranked.length - 1].rate >= 15) {
      const weak = ranked[ranked.length - 1]
      insights.push({ tone: 'warning', title: `${weak.label} is your weakest day`, detail: `${weak.rate}% completion — ${top.rate - weak.rate} points below ${top.label}.` })
    }
  }

  const reports = habits
    .map((habit) => ({ habit, report: habitReport(habit, startKey, todayKey) }))
    .filter((entry) => entry.report.scheduled >= 2)

  if (reports.length) {
    const strongest = reports.slice().sort((a, b) => b.report.rate - a.report.rate || b.report.done - a.report.done)[0]
    insights.push({ tone: 'positive', title: `${strongest.habit.name} is your most consistent habit`, detail: `${strongest.report.rate}% completion — ${strongest.report.done} of ${strongest.report.scheduled} scheduled days.` })

    const weakest = reports.slice().sort((a, b) => a.report.rate - b.report.rate || b.report.missed - a.report.missed)[0]
    if (weakest.habit.id !== strongest.habit.id && weakest.report.missed > 0) {
      insights.push({ tone: 'warning', title: `${weakest.habit.name} needs attention`, detail: `Missed ${weakest.report.missed} scheduled ${weakest.report.missed === 1 ? 'day' : 'days'} in this window.` })
    }
  }

  const { delta, thisWeek, lastWeek } = weekComparison(habits, todayKey)
  if (thisWeek.scheduled) {
    const previous = lastWeek.scheduled ? `${lastWeek.rate}%` : 'no data'
    insights.push({
      tone: delta > 0 ? 'positive' : delta < 0 ? 'warning' : 'neutral',
      title: delta > 0 ? `Up ${delta} points on last week` : delta < 0 ? `Down ${Math.abs(delta)} points on last week` : 'Holding steady week over week',
      detail: `This week ${thisWeek.rate}% (${thisWeek.done}/${thisWeek.scheduled}) against last week at ${previous}.`,
    })
  }

  const run = longestDailyRun(habits)
  if (run.length >= 2) {
    insights.push({ tone: 'positive', title: `Your longest unbroken run is ${run.length} days`, detail: `Ending ${run.endKey}, every calendar day in that run had at least one check-off.` })
  }

  const totalDone = habits.reduce((total, habit) => total + (habit.completions || []).length, 0)
  if (totalDone) {
    insights.push({ tone: 'neutral', title: `${totalDone} total check-offs recorded`, detail: `Across ${habits.length} ${habits.length === 1 ? 'habit' : 'habits'}, all stored locally on this device.` })
  }

  return insights
}

export function nextReward(rewards, bestStreak) {
  return (rewards || [])
    .filter((reward) => !reward.claimed && reward.milestone > bestStreak)
    .sort((a, b) => a.milestone - b.milestone)[0] || null
}

export function rewardState(reward, bestStreak) {
  if (reward.claimed) return 'claimed'
  return reward.milestone <= bestStreak ? 'unlocked' : 'locked'
}
