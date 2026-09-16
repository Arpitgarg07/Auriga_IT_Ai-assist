import { useMemo, useState } from 'react'
import { Activity, BarChart3, CalendarDays, Flame, Info, Target, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { fromDateKey } from '../utils/dates.js'
import { isHabitScheduledOnDate } from '../utils/streaks.js'
import { WEEKDAYS } from '../utils/constants.js'
import { RANGE_IDS, buildInsights, buildRange, habitReport, periodStats, weekdayBreakdown, weekComparison } from '../utils/analytics.js'

const RANGE_LABELS = { '7d': '7 days', '30d': '30 days', month: 'This month', all: 'All time' }

function TrendIcon({ tone }) {
  if (tone === 'positive') return <TrendingUp size={15} />
  if (tone === 'warning') return <TrendingDown size={15} />
  return <Info size={15} />
}

function dayState(day) {
  if (!day.scheduled) return 'none'
  if (day.done === day.scheduled) return 'complete'
  if (day.done > 0) return 'partial'
  return 'missed'
}

export default function AnalyticsView({
  habits,
  activeHabits,
  todayKey,
  challengeStart,
  rangeId,
  onRangeChange,
  selectedDate,
  onSelectDate,
}) {
  const [hovered, setHovered] = useState(null)

  const range = useMemo(
    () => buildRange(rangeId, habits, challengeStart, todayKey),
    [rangeId, habits, challengeStart, todayKey],
  )

  const stats = useMemo(() => periodStats(activeHabits, range.startKey, range.endKey), [activeHabits, range])
  const comparison = useMemo(() => weekComparison(activeHabits, todayKey), [activeHabits, todayKey])
  const byWeekday = useMemo(() => weekdayBreakdown(activeHabits, range.startKey, range.endKey), [activeHabits, range])
  const insights = useMemo(
    () => buildInsights(activeHabits, range.startKey, range.endKey, todayKey),
    [activeHabits, range, todayKey],
  )

  const reports = useMemo(
    () => activeHabits
      .map((habit) => ({ habit, report: habitReport(habit, range.startKey, todayKey) }))
      .sort((a, b) => b.report.rate - a.report.rate || b.report.done - a.report.done),
    [activeHabits, range, todayKey],
  )

  const best = reports.reduce((max, entry) => Math.max(max, entry.report.best), 0)
  const currentStreak = reports.reduce((max, entry) => Math.max(max, entry.report.current), 0)
  const totalCompleted = reports.reduce((total, entry) => total + (entry.habit.completions || []).length, 0)

  // Long ranges stay readable by charting only the most recent slice. The
  // truncation is always stated on screen rather than silently applied.
  const CHART_LIMIT = 30
  const chartDays = stats.perDay.slice(-CHART_LIMIT)
  const chartTruncated = stats.perDay.length - chartDays.length
  const stripDays = stats.perDay.slice(-35)
  const peak = Math.max(1, ...chartDays.map((day) => day.rate))
  const selectedKey = selectedDate || todayKey
  const selectedDay = stats.perDay.find((day) => day.key === selectedKey) || null
  const selectedHabits = activeHabits.filter((habit) => isHabitScheduledOnDate(habit, fromDateKey(selectedKey)))

  return (
    <section className="page-view analytics-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><BarChart3 size={14} /> Your patterns</p>
          <h2>Analytics</h2>
        </div>
        <div className="filter-chips" role="tablist" aria-label="Analytics range">
          {RANGE_IDS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={rangeId === id}
              className={rangeId === id ? 'active' : ''}
              onClick={() => onRangeChange(id)}
            >
              {RANGE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <p className="range-caption">
        {range.label} · {range.startKey} to {range.endKey}
      </p>

      <div className="analytics-cards">
        <div className="metric"><span>Current streak</span><strong>{currentStreak}</strong><small>days</small></div>
        <div className="metric"><span>Best streak</span><strong>{best}</strong><small>days</small></div>
        <div className="metric"><span>Completion rate</span><strong>{stats.rate}%</strong><small>{range.label.toLowerCase()}</small></div>
        <div className="metric"><span>Completed</span><strong>{stats.done}</strong><small>check-offs</small></div>
        <div className="metric"><span>Missed</span><strong>{stats.missed}</strong><small>scheduled days</small></div>
        <div className="metric"><span>Active habits</span><strong>{activeHabits.length}</strong><small>{totalCompleted} all-time</small></div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3>Daily completion</h3>
          <span className="panel-hint">
            {chartTruncated
              ? `Last ${CHART_LIMIT} days of ${stats.perDay.length} · ${range.label.toLowerCase()}`
              : 'Share of scheduled habits completed each day'}
          </span>
        </div>
        {chartDays.length ? (
          <div className="bar-chart" onMouseLeave={() => setHovered(null)}>
            {chartDays.map((day) => {
              const height = day.scheduled ? Math.max(3, Math.round((day.done / day.scheduled) * 100)) : 3
              return (
                <div key={day.key} onMouseEnter={() => setHovered(day)} className={day.key === selectedKey ? 'is-selected' : ''}>
                  <span
                    className={dayState(day)}
                    style={{ height: `${height}%` }}
                    title={`${day.key}: ${day.done}/${day.scheduled}`}
                  />
                  <small>{fromDateKey(day.key).getDate()}</small>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted">No data in this range yet.</p>
        )}
        {hovered && (
          <p className="chart-readout">
            <strong>{hovered.key}</strong> · {hovered.done} of {hovered.scheduled} completed
            {hovered.scheduled ? ` (${Math.round(hovered.rate * 100)}%)` : ' · nothing scheduled'}
          </p>
        )}
        {chartDays.length > 0 && (
          <p className="panel-hint">Best day shown: {Math.round(peak * 100)}% of scheduled habits completed.</p>
        )}
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3>This week vs last week</h3>
          <span className={`trend-chip ${comparison.delta > 0 ? 'up' : comparison.delta < 0 ? 'down' : ''}`}>
            <TrendIcon tone={comparison.delta > 0 ? 'positive' : comparison.delta < 0 ? 'warning' : 'neutral'} />
            {comparison.delta > 0 ? '+' : ''}{comparison.delta} pts
          </span>
        </div>
        <div className="comparison-row">
          <div className="comparison-col">
            <small>Last week</small>
            <strong>{comparison.lastWeek.rate}%</strong>
            <span>{comparison.lastWeek.done}/{comparison.lastWeek.scheduled}</span>
            <div className="mini-track"><span style={{ width: `${comparison.lastWeek.rate}%` }} /></div>
          </div>
          <div className="comparison-col is-current">
            <small>This week</small>
            <strong>{comparison.thisWeek.rate}%</strong>
            <span>{comparison.thisWeek.done}/{comparison.thisWeek.scheduled}</span>
            <div className="mini-track"><span style={{ width: `${comparison.thisWeek.rate}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3>Streak history</h3>
          <span className="panel-hint">Tap any day for its detail</span>
        </div>
        <div className="date-strip">
          {stripDays.map((day) => {
            const date = fromDateKey(day.key)
            return (
              <button
                key={day.key}
                className={`date-cell ${dayState(day)} ${day.key === selectedKey ? 'is-selected' : ''}`}
                onClick={() => onSelectDate(day.key)}
                aria-pressed={day.key === selectedKey}
              >
                <small>{WEEKDAYS[(date.getDay() + 6) % 7]}</small>
                <strong>{date.getDate()}</strong>
                <span className="date-dot" />
              </button>
            )
          })}
        </div>
        <ul className="strip-legend">
          <li><span className="legend-swatch complete" /> All done</li>
          <li><span className="legend-swatch partial" /> Partly done</li>
          <li><span className="legend-swatch missed" /> Missed</li>
          <li><span className="legend-swatch none" /> Nothing scheduled</li>
        </ul>

        <div className="selected-day">
          <div className="selected-day-head">
            <CalendarDays size={16} />
            <strong>{selectedKey}</strong>
            {selectedDay && <small>{selectedDay.done}/{selectedDay.scheduled} completed</small>}
          </div>
          {selectedHabits.length ? (
            <ul className="selected-day-list">
              {selectedHabits.map((habit) => {
                const done = (habit.completions || []).includes(selectedKey)
                return (
                  <li key={habit.id} className={done ? 'is-done' : 'is-missed'}>
                    <span className="day-state-mark">{done ? '✓' : '✕'}</span>
                    <span className="day-state-name">{habit.name}</span>
                    <small>{done ? 'Completed' : 'Not completed'}</small>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="muted">No habits were scheduled on this date.</p>
          )}
        </div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3>Day of week</h3>
          <span className="panel-hint">Where your consistency actually lives</span>
        </div>
        <div className="weekday-chart">
          {byWeekday.map((day) => (
            <div key={day.label}>
              <div className="weekday-bar-track">
                <span style={{ height: `${day.scheduled ? Math.max(4, day.rate) : 0}%` }} />
              </div>
              <strong>{day.rate}%</strong>
              <small>{day.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3>Habit performance</h3>
          <span className="panel-hint">{reports.length} active habits in {range.label.toLowerCase()}</span>
        </div>
        {reports.length ? (
          <div className="performance-table">
            <div className="performance-head">
              <span>Habit</span><span>Rate</span><span>Streak</span><span>Done</span><span>Missed</span>
            </div>
            {reports.map(({ habit, report }) => (
              <div className="performance" key={habit.id}>
                <span className="performance-name">{habit.name}</span>
                <span className="performance-rate">
                  <b>{report.rate}%</b>
                  <span className="mini-track"><span style={{ width: `${report.rate}%` }} /></span>
                </span>
                <span className="performance-streak"><Flame size={12} />{report.current} / {report.best}</span>
                <span>{report.done}</span>
                <span className={report.missed ? 'is-missed' : ''}>{report.missed}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Add an active habit to see performance.</p>
        )}
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3>Activity heatmap</h3>
          <span className="panel-hint">{range.label}</span>
        </div>
        <div className="heatmap">
          {stats.perDay.map((day) => (
            <span
              key={day.key}
              className={`heat-${day.scheduled ? Math.min(4, day.done) : 0}`}
              title={`${day.key}: ${day.done}/${day.scheduled}`}
            />
          ))}
        </div>
      </div>

      <div className="chart-panel">
        <div className="panel-head">
          <h3><Activity size={16} /> Insights</h3>
          <span className="panel-hint">Derived from your stored check-offs</span>
        </div>
        {insights.length ? (
          <ul className="insight-list">
            {insights.map((insight) => (
              <li key={insight.title} className={`insight is-${insight.tone}`}>
                <TrendIcon tone={insight.tone} />
                <div>
                  <strong>{insight.title}</strong>
                  <small>{insight.detail}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Not enough recorded history yet. Check off a few days and insights will appear.</p>
        )}
      </div>

      {!activeHabits.length && (
        <div className="empty-state">
          <Target size={26} />
          <h3>No active habits</h3>
          <p>Analytics fill in as soon as you add habits and start checking them off.</p>
        </div>
      )}

      <div className="chart-panel">
        <div className="panel-head">
          <h3><Trophy size={16} /> All-time totals</h3>
        </div>
        <p className="muted">
          {totalCompleted} check-offs recorded across {activeHabits.length} active
          {habits.length - activeHabits.length > 0 ? ` and ${habits.length - activeHabits.length} archived` : ''} habits on this device.
        </p>
      </div>
    </section>
  )
}
