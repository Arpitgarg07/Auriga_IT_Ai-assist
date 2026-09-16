import { Check, X } from 'lucide-react'
import { WEEKDAYS } from '../utils/constants.js'

// Read-only schedule strip: every day shown, ticked when the habit is due.
// A habit with no days selected is called out rather than silently blank.
export default function DayChips({ days = [], label = 'Schedule' }) {
  const selected = new Set(days)
  return (
    <ul className="day-chips" aria-label={label}>
      {WEEKDAYS.map((day, index) => {
        const due = selected.has(index + 1)
        return (
          <li key={day} className={due ? 'is-due' : 'is-off'}>
            <span className="day-chip-name">{day}</span>
            {due ? <Check size={13} aria-label="scheduled" /> : <X size={13} aria-label="not scheduled" />}
          </li>
        )
      })}
    </ul>
  )
}
