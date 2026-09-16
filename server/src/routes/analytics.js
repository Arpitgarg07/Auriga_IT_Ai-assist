import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { loadAccount } from './sync.js'
import { toDateKey } from '../../../src/utils/dates.js'
import { RANGE_IDS, buildRange, habitReport, periodStats, weekdayBreakdown, weekComparison } from '../../../src/utils/analytics.js'
import { getBestStreak, getCurrentStreak } from '../../../src/utils/streaks.js'
import { fromDateKey } from '../../../src/utils/dates.js'

const router = Router()

/**
 * Server-side analytics, computed with the same module the browser uses.
 *
 * There is no second implementation of a completion rate or a streak here: the
 * habits are shaped into the client's own format and handed to src/utils/
 * analytics.js. A number on this endpoint and the same number on the dashboard
 * are the same arithmetic.
 */
router.get('/', requireAuth, async (request, response) => {
  const requested = RANGE_IDS.includes(request.query.range) ? request.query.range : '7d'
  const todayKey = toDateKey()
  const account = await loadAccount(request.user._id)

  const active = account.habits.filter((habit) => !habit.archived)
  const range = buildRange(requested, account.habits, account.challengeStart, todayKey)

  const stats = periodStats(active, range.startKey, range.endKey)

  const habits = active
    .map((habit) => {
      const report = habitReport(habit, range.startKey, todayKey)
      return {
        id: habit.id,
        name: habit.name,
        frequency: habit.frequency,
        rate: report.rate,
        current: report.current,
        best: report.best,
        done: report.done,
        missed: report.missed,
        scheduled: report.scheduled,
      }
    })
    .sort((a, b) => b.rate - a.rate || b.done - a.done)

  return response.json({
    range: { id: range.id, label: range.label, startKey: range.startKey, endKey: range.endKey },
    totals: {
      currentStreak: active.reduce((max, habit) => Math.max(max, getCurrentStreak(habit, fromDateKey(todayKey))), 0),
      bestStreak: active.reduce((max, habit) => Math.max(max, getBestStreak(habit)), 0),
      completionRate: stats.rate,
      completed: stats.done,
      missed: stats.missed,
      scheduled: stats.scheduled,
      activeHabits: active.length,
      archivedHabits: account.habits.length - active.length,
    },
    daily: stats.perDay.map((day) => ({ date: day.key, done: day.done, scheduled: day.scheduled, rate: Math.round(day.rate * 100) })),
    weekdays: weekdayBreakdown(active, range.startKey, range.endKey),
    week: (() => {
      const comparison = weekComparison(active, todayKey)
      return {
        thisWeek: { rate: comparison.thisWeek.rate, done: comparison.thisWeek.done, scheduled: comparison.thisWeek.scheduled },
        lastWeek: { rate: comparison.lastWeek.rate, done: comparison.lastWeek.done, scheduled: comparison.lastWeek.scheduled },
        delta: comparison.delta,
      }
    })(),
    habits,
  })
})

export default router
