import { Archive, ArchiveRestore, Check, Pencil } from 'lucide-react'
import { fromDateKey } from '../utils/dates.js'
import { getBestStreak, getCurrentStreak, isHabitScheduledOnDate } from '../utils/streaks.js'
import { scheduleLabel } from '../utils/constants.js'
import HabitIcon from './HabitIcon.jsx'
import DayChips from './DayChips.jsx'

export default function HabitCard({ habit, date, onToggle, onEdit, onArchive, archived = false }) {
  const scheduled = isHabitScheduledOnDate(habit, fromDateKey(date))
  const complete = (habit.completions || []).includes(date)
  const current = getCurrentStreak(habit, fromDateKey(date))
  const best = getBestStreak(habit)

  return (
    <article className={`habit-card ${complete ? 'completed' : ''} ${!scheduled && !archived ? 'not-scheduled' : ''}`}>
      <div className="habit-icon"><HabitIcon name={habit.icon} /></div>

      <div className="habit-main">
        <div className="habit-title">
          <h3>{habit.name}</h3>
          {complete && <span className="done-label"><Check size={13} /> Done</span>}
          {archived && <span className="archived-label-chip">Archived</span>}
        </div>
        <p>{habit.description || 'No description yet.'}</p>
        <span className="frequency">
          {scheduleLabel(habit)}
          {!scheduled && !archived && ' · Not scheduled today'}
        </span>
        {habit.frequency === 'custom' && <DayChips days={habit.customDays} label={`${habit.name} schedule`} />}
      </div>

      {!archived && (
        <div className="stats">
          <span><strong>{current}</strong> current</span>
          <span><strong>{best}</strong> best</span>
        </div>
      )}

      <div className="card-actions">
        {!archived && scheduled && (
          <button
            className={`complete-button ${complete ? 'is-complete' : ''}`}
            onClick={() => onToggle(habit)}
            aria-label={`${complete ? 'Mark incomplete' : 'Mark complete'}: ${habit.name}`}
            aria-pressed={complete}
          >
            <Check size={19} />
          </button>
        )}
        <button className="icon-button" onClick={() => onEdit(habit)} aria-label={`Edit ${habit.name}`}><Pencil size={16} /></button>
        <button className="icon-button" onClick={() => onArchive(habit)} aria-label={archived ? `Restore ${habit.name}` : `Archive ${habit.name}`}>
          {archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
        </button>
      </div>
    </article>
  )
}
