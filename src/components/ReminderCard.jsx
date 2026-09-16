import { Bell, Check, Flame, PartyPopper, Target } from 'lucide-react'
import { dayNameGreeting } from '../utils/reminders.js'

function PendingRow({ entry }) {
  const { habit, current, schedule } = entry
  return (
    <li className="reminder-item">
      <span className="reminder-bullet" aria-hidden="true" />
      <span className="reminder-item-main">
        <strong>{habit.name}</strong>
        <small>{schedule}</small>
      </span>
      {current > 0 ? (
        <span className="reminder-item-streak" title={`${current}-day current streak`}>
          <Flame size={13} /> {current} {current === 1 ? 'day' : 'days'}
        </span>
      ) : (
        <span className="reminder-item-streak is-new">No streak yet</span>
      )}
    </li>
  )
}

// The always-available Home section. Noticeable, but a card rather than a
// modal, so returning to the app later in the day is not interrupted.
export default function ReminderCard({ reminder, name, onComplete, onOpenSettings }) {
  if (!reminder) return null

  if (reminder.mode === 'rest') {
    return (
      <section className="reminder-card is-rest" aria-label="Today's reminders">
        <div className="reminder-head">
          <span className="reminder-icon"><Target size={17} /></span>
          <div>
            <h3>Your morning checklist</h3>
            <p>Nothing scheduled today</p>
          </div>
        </div>
        <p className="reminder-message">{reminder.message}</p>
      </section>
    )
  }

  if (reminder.mode === 'complete') {
    return (
      <section className="reminder-card is-complete" aria-label="Today's reminders">
        <div className="reminder-head">
          <span className="reminder-icon"><PartyPopper size={17} /></span>
          <div>
            <h3>Your morning checklist</h3>
            <p>All {reminder.total} {reminder.total === 1 ? 'habit' : 'habits'} done</p>
          </div>
          <span className="reminder-count is-done"><Check size={13} /> Complete</span>
        </div>
        <p className="reminder-message">{reminder.message}</p>
        <div className="reminder-progress">
          <div className="mini-track"><span style={{ width: '100%' }} /></div>
        </div>
      </section>
    )
  }

  const { pendingCount, total, completedCount, items, message } = reminder

  return (
    <section className="reminder-card" aria-label="Today's reminders">
      <div className="reminder-head">
        <span className="reminder-icon"><Bell size={17} /></span>
        <div>
          <h3>Your morning checklist</h3>
          <p>{dayNameGreeting(reminder.dateKey)}</p>
        </div>
        <span className="reminder-count">{pendingCount} left</span>
      </div>

      <p className="reminder-message">
        {name ? `${name}, you` : 'You'} still {pendingCount === 1 ? 'have 1 habit' : `have ${pendingCount} habits`} waiting for you today.
      </p>

      <ul className="reminder-list">
        {items.map((entry) => <PendingRow key={entry.habit.id} entry={entry} />)}
      </ul>

      <div className="reminder-progress">
        <div className="mini-track"><span style={{ width: `${total ? Math.round((completedCount / total) * 100) : 0}%` }} /></div>
        <small>{completedCount} of {total} done</small>
      </div>

      <p className="reminder-nudge">{message}</p>

      <div className="reminder-actions">
        <button className="primary-button" onClick={onComplete}>Complete a habit</button>
        {onOpenSettings && (
          <button className="text-button" onClick={onOpenSettings}>Reminder settings</button>
        )}
      </div>
    </section>
  )
}
