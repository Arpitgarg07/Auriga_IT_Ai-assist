import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { DEFAULT_CUSTOM_DAYS, HABIT_ICONS, SCHEDULE_OPTIONS, WEEKDAYS } from '../utils/constants.js'
import HabitIcon from './HabitIcon.jsx'

const blank = {
  name: '',
  description: '',
  icon: 'Target',
  frequency: 'daily',
  customDays: DEFAULT_CUSTOM_DAYS,
}

export default function HabitForm({ habit, close, save }) {
  const [value, setValue] = useState(habit ? { ...blank, ...habit } : blank)
  const update = (key, next) => setValue((current) => ({ ...current, [key]: next }))
  const toggleDay = (day) => update(
    'customDays',
    value.customDays.includes(day) ? value.customDays.filter((item) => item !== day) : [...value.customDays, day].sort((a, b) => a - b),
  )

  const invalidCustom = value.frequency === 'custom' && value.customDays.length === 0
  const canSave = Boolean(value.name.trim()) && !invalidCustom

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <form
        className="modal"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave) save({ ...value, name: value.name.trim() })
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Habit library</p>
            <h2>{habit ? 'Edit habit' : 'New habit'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close"><X /></button>
        </div>

        <label>
          Habit name
          <input autoFocus value={value.name} onChange={(event) => update('name', event.target.value)} placeholder="Drink water" />
        </label>

        <label>
          Description
          <textarea rows="2" value={value.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="Why this matters to you." />
        </label>

        <fieldset>
          <legend>Icon</legend>
          <div className="icon-grid">
            {HABIT_ICONS.map((name) => (
              <button
                type="button"
                key={name}
                className={`icon-choice ${value.icon === name ? 'selected' : ''}`}
                onClick={() => update('icon', name)}
                aria-label={name}
                aria-pressed={value.icon === name}
              >
                <HabitIcon name={name} size={17} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Schedule</legend>
          <div className="choice-row">
            {SCHEDULE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.id}
                className={`choice ${value.frequency === option.id ? 'selected' : ''}`}
                onClick={() => update('frequency', option.id)}
                aria-pressed={value.frequency === option.id}
              >
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </fieldset>

        {value.frequency === 'custom' && (
          <div className="custom-days">
            <span className="field-label">Which days?</span>
            <div className="day-options">
              {WEEKDAYS.map((day, index) => {
                const due = value.customDays.includes(index + 1)
                return (
                  <button
                    type="button"
                    key={day}
                    className={due ? 'selected' : ''}
                    onClick={() => toggleDay(index + 1)}
                    aria-pressed={due}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            {invalidCustom && <p className="field-error">Pick at least one day, or choose Every day.</p>}
          </div>
        )}

        <button className="primary-button full" disabled={!canSave}>
          Save habit <ChevronRight size={16} />
        </button>
      </form>
    </div>
  )
}
