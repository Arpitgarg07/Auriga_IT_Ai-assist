import { useEffect, useState } from 'react'
import { Bell, Check, Flame, PartyPopper, Sunrise, Target, X } from 'lucide-react'
import { greetingFor } from '../utils/motivation.js'
import { dayNameGreeting } from '../utils/reminders.js'
import { Confetti } from './Celebration.jsx'

// Shown once on the first open of a new day. Every later visit that day gets the
// compact ReminderCard instead, so this never repeats on navigation.
export default function MorningReminder({ reminder, name, effects = true, onClose, onComplete }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!reminder) return null

  const greeting = greetingFor()
  const complete = reminder.mode === 'complete'

  return (
    <div
      className="modal-backdrop reminder-backdrop"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Morning reminder"
    >
      {effects && complete && <Confetti pieces={44} />}
      <div className={`morning-reminder ${complete ? 'is-complete' : ''} ${visible ? 'is-visible' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button morning-close" onClick={onClose} aria-label="Dismiss reminder"><X size={17} /></button>

        <div className="morning-badge">
          {complete ? <PartyPopper size={26} /> : <Sunrise size={26} />}
        </div>

        <p className="eyebrow">
          {complete ? <><Check size={14} /> Day complete</> : <><Bell size={14} /> Morning reminder</>}
        </p>

        <h2>
          {complete
            ? "You're all done for today!"
            : `${greeting.text}, ${name} ${greeting.emoji}`}
        </h2>
        <p className="morning-day">{dayNameGreeting(reminder.dateKey)}</p>

        {complete ? (
          <p className="morning-copy">{reminder.message}</p>
        ) : (
          <>
            <p className="morning-copy">
              You still {reminder.pendingCount === 1 ? 'have 1 habit' : `have ${reminder.pendingCount} habits`} waiting for you today.
            </p>

            <ul className="morning-list">
              {reminder.items.map((entry) => (
                <li key={entry.habit.id}>
                  <span className="morning-circle" aria-hidden="true" />
                  <span className="morning-name">{entry.habit.name}</span>
                  {entry.current > 0 && (
                    <span className="morning-streak"><Flame size={13} /> {entry.current} {entry.current === 1 ? 'day' : 'days'}</span>
                  )}
                </li>
              ))}
            </ul>

            <p className="morning-nudge">{reminder.message}</p>
          </>
        )}

        <div className="morning-actions">
          {complete ? (
            <button className="primary-button full" onClick={onClose}>See you tomorrow</button>
          ) : (
            <>
              <button className="primary-button" onClick={onComplete}>Complete a habit</button>
              <button className="text-button" onClick={onClose}>Later</button>
            </>
          )}
        </div>

        {!complete && reminder.hasStreakAtRisk && (
          <p className="morning-footnote"><Target size={12} /> {reminder.total} scheduled today</p>
        )}
      </div>
    </div>
  )
}
