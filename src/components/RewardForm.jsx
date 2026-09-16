import { useState } from 'react'
import { ChevronRight, Trophy, X } from 'lucide-react'
import { MILESTONES } from '../utils/constants.js'

export default function RewardForm({ reward, bestStreak = 0, close, save }) {
  const [value, setValue] = useState(
    reward || { name: '', description: '', milestone: MILESTONES.find((day) => day > bestStreak) || 7 },
  )
  const update = (key, next) => setValue({ ...value, [key]: next })

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <form
        className="modal"
        onSubmit={(event) => {
          event.preventDefault()
          if (value.name.trim()) save({ ...value, name: value.name.trim(), milestone: Number(value.milestone) })
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow"><Trophy size={14} /> Rewards</p>
            <h2>{reward ? 'Edit reward' : 'New reward'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close"><X /></button>
        </div>

        <label>
          Reward title
          <input
            autoFocus
            value={value.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Buy a new dress"
          />
        </label>

        <label>
          Description
          <textarea
            rows="2"
            value={value.description || ''}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Something to look forward to."
          />
        </label>

        <label>
          Required streak
          <select value={value.milestone} onChange={(event) => update('milestone', event.target.value)}>
            {MILESTONES.map((day) => (
              <option key={day} value={day}>{day} {day === 1 ? 'day' : 'days'}</option>
            ))}
          </select>
        </label>
        <p className="muted field-hint">Unlocks when your best streak reaches {value.milestone} days.</p>

        <button className="primary-button full" disabled={!value.name.trim()}>
          Save reward <ChevronRight size={16} />
        </button>
      </form>
    </div>
  )
}
