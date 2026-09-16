import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Apple, BookOpen, Check, ChevronRight, Dumbbell, Droplets, Flame, Leaf, Plus, Search, Sparkles, Target, X } from 'lucide-react'
import './App.css'
import { daysBetween, formatDate, toDateKey } from './utils/dates'
import { getBestStreak, getCurrentStreak, isHabitScheduledOnDate } from './utils/streaks'
import { loadData, saveHabits, saveSettings } from './utils/storage'

const icons = { Droplets, BookOpen, Dumbbell, Apple, Leaf, Target, Sparkles }
const todayKey = toDateKey()

function HabitIcon({ name, size = 20 }) {
  const Component = icons[name] || Target
  return <Component size={size} strokeWidth={2.1} aria-hidden="true" />
}

function HabitForm({ habit, onSave, onClose }) {
  const [form, setForm] = useState(habit || { name: '', description: '', icon: 'Target', frequency: 'daily' })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  function submit(event) {
    event.preventDefault()
    if (form.name.trim()) onSave({ ...form, name: form.name.trim(), description: form.description.trim() })
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Habit library</p><h2>{habit ? 'Edit habit' : 'New habit'}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div><label>Habit name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Meditate" maxLength={60} /></label><label>Description <span className="muted">optional</span><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="What does success look like?" rows="3" maxLength={140} /></label><fieldset><legend>Schedule</legend><div className="choice-row"><label className={`choice ${form.frequency === 'daily' ? 'selected' : ''}`}><input type="radio" checked={form.frequency === 'daily'} onChange={() => update('frequency', 'daily')} />Every day</label><label className={`choice ${form.frequency === 'weekdays' ? 'selected' : ''}`}><input type="radio" checked={form.frequency === 'weekdays'} onChange={() => update('frequency', 'weekdays')} />Weekdays</label></div></fieldset><fieldset><legend>Icon</legend><div className="icon-grid">{Object.keys(icons).map((name) => <button type="button" key={name} className={`icon-choice ${form.icon === name ? 'selected' : ''}`} onClick={() => update('icon', name)} aria-label={`Choose ${name} icon`}><HabitIcon name={name} /></button>)}</div></fieldset><button className="primary-button full" type="submit" disabled={!form.name.trim()}>{habit ? 'Save changes' : 'Add habit'}<ChevronRight size={17} /></button></form></div>
}

function HabitCard({ habit, completed, onToggle, onEdit, onArchive, archived = false }) {
  return <article className={`habit-card ${completed ? 'completed' : ''}`}><div className="habit-icon"><HabitIcon name={habit.icon} /></div><div className="habit-main"><div className="habit-title"><h3>{habit.name}</h3>{completed && <span className="done-label"><Check size={13} /> Done</span>}</div><p>{habit.description || 'No description yet.'}</p><span className="frequency">{habit.frequency === 'daily' ? 'Every day' : 'Monday to Friday'}</span></div>{!archived && <div className="stats"><span><strong>{getCurrentStreak(habit)}</strong> current</span><span><strong>{getBestStreak(habit)}</strong> best</span></div>}<div className="card-actions">{!archived && <button className={`complete-button ${completed ? 'is-complete' : ''}`} onClick={onToggle} aria-label={`${completed ? 'Uncomplete' : 'Complete'} ${habit.name}`}><Check size={20} /></button>}<button className="text-button" onClick={onEdit}>Edit</button><button className="icon-button subtle" onClick={onArchive} aria-label={archived ? `Unarchive ${habit.name}` : `Archive ${habit.name}`}>{archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}</button></div></article>
}

function App() {
  const initial = useMemo(() => loadData(todayKey), [])
  const [habits, setHabits] = useState(initial.habits)
  const [settings] = useState(initial.settings)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => { saveHabits(habits) }, [habits])
  useEffect(() => { saveSettings(settings) }, [settings])

  const active = habits.filter((habit) => !habit.archived)
  const todayHabits = active.filter((habit) => isHabitScheduledOnDate(habit, new Date()))
  const completedToday = todayHabits.filter((habit) => habit.completions.includes(todayKey)).length
  const query = search.trim().toLowerCase()
  const filtered = habits.filter((habit) => `${habit.name} ${habit.description}`.toLowerCase().includes(query))
  const activeResults = filtered.filter((habit) => !habit.archived)
  const archivedResults = filtered.filter((habit) => habit.archived)
  const challengeDay = Math.min(75, Math.max(1, daysBetween(settings.challengeStart, todayKey) + 1))
  const progress = Math.round((challengeDay / 75) * 100)

  function saveHabit(value) {
    if (value.id) setHabits((current) => current.map((habit) => habit.id === value.id ? value : habit))
    else setHabits((current) => [...current, { ...value, id: crypto.randomUUID(), createdAt: new Date().toISOString(), archived: false, completions: [] }])
    setShowForm(false); setEditing(null)
  }
  function toggle(habit) {
    setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, completions: item.completions.includes(todayKey) ? item.completions.filter((date) => date !== todayKey) : [...item.completions, todayKey] } : item))
  }
  function archive(habit) {
    if (!habit.archived && !window.confirm(`Archive “${habit.name}”? Its history will be kept.`)) return
    setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, archived: !item.archived } : item))
    setNotice(`${habit.name} ${habit.archived ? 'unarchived' : 'archived'}.`)
    window.setTimeout(() => setNotice(''), 2600)
  }

  return <div className="app-shell"><header className="topbar"><div className="brand"><div className="brand-mark"><Leaf size={19} /></div><span>daymark</span></div><div className="date-chip"><span className="live-dot" />{formatDate(todayKey)}</div></header><main><section className="hero-section"><div><p className="eyebrow"><Sparkles size={14} /> Personal progress</p><h1>Keep showing up,<br /><em>one day at a time.</em></h1><p className="hero-copy">Small promises become the life you want. Your habits are ready when you are.</p></div><div className="challenge-panel"><div className="challenge-top"><span>75-day challenge</span><strong>Day {challengeDay}<small> / 75</small></strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><div className="challenge-bottom"><span>{75 - challengeDay} days remaining</span><span>{progress}% complete</span></div></div></section><section className="today-section"><div className="section-heading"><div><p className="eyebrow">Your focus</p><h2>Today <span>{completedToday}/{todayHabits.length}</span></h2></div><div className="today-progress"><div className="mini-track"><span style={{ width: `${todayHabits.length ? (completedToday / todayHabits.length) * 100 : 0}%` }} /></div><span>{todayHabits.length ? Math.round((completedToday / todayHabits.length) * 100) : 0}% done</span></div></div>{todayHabits.length ? <div className="today-list">{todayHabits.map((habit) => <HabitCard key={habit.id} habit={habit} completed={habit.completions.includes(todayKey)} onToggle={() => toggle(habit)} onEdit={() => { setEditing(habit); setShowForm(true) }} onArchive={() => archive(habit)} />)}</div> : <div className="empty-state"><Target size={26} /><h3>A quiet day</h3><p>No habits are scheduled today. Add one to make tomorrow count.</p></div>}</section><section className="library-section"><div className="section-heading library-heading"><div><p className="eyebrow">All your promises</p><h2>Habit library</h2></div><button className="primary-button" onClick={() => { setEditing(null); setShowForm(true) }}><Plus size={18} /> Add habit</button></div><div className="search-wrap"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search active and archived habits..." aria-label="Search habits" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}</div><div className="library-column"><h3 className="list-label">Active <span>{activeResults.length}</span></h3>{activeResults.length ? activeResults.map((habit) => <HabitCard key={habit.id} habit={habit} completed={habit.completions.includes(todayKey)} onToggle={() => toggle(habit)} onEdit={() => { setEditing(habit); setShowForm(true) }} onArchive={() => archive(habit)} />) : <div className="compact-empty">{query ? 'No active habits match your search.' : 'No active habits yet. Add your first one above.'}</div>}{archivedResults.length > 0 && <><h3 className="list-label archived-label">Archived <span>{archivedResults.length}</span></h3>{archivedResults.map((habit) => <HabitCard key={habit.id} habit={habit} onEdit={() => { setEditing(habit); setShowForm(true) }} onArchive={() => archive(habit)} archived />)}</>}</div></section></main><footer><span>Built for consistency.</span><span><Flame size={15} /> Your best streak is still ahead.</span></footer>{notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}{showForm && <HabitForm habit={editing} onSave={saveHabit} onClose={() => { setShowForm(false); setEditing(null) }} />}</div>
}

export default App
