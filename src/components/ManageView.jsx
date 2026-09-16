import { useMemo, useState } from 'react'
import { Archive, ListChecks, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { habitReport } from '../utils/analytics.js'
import { formatDate } from '../utils/dates.js'
import { scheduleLabel } from '../utils/constants.js'
import HabitCard from './HabitCard.jsx'

const FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
]

const SORTS = [
  { id: 'recent', label: 'Recently added' },
  { id: 'name', label: 'Name A–Z' },
  { id: 'streak', label: 'Current streak' },
  { id: 'rate', label: 'Completion rate' },
]

export default function ManageView({
  habits,
  activeHabits,
  todayKey,
  challengeStart,
  search,
  onSearch,
  date,
  onDate,
  onAddHabit,
  onEditHabit,
  onArchiveHabit,
  onToggle,
}) {
  const [filter, setFilter] = useState('active')
  const [sort, setSort] = useState('recent')

  const decorate = useMemo(() => {
    const map = new Map()
    habits.forEach((habit) => map.set(habit.id, habitReport(habit, challengeStart, todayKey)))
    return map
  }, [habits, challengeStart, todayKey])

  const query = search.toLowerCase().trim()
  const matched = habits.filter((habit) => `${habit.name} ${habit.description || ''}`.toLowerCase().includes(query))
  const filtered = matched.filter((habit) => {
    if (filter === 'active') return !habit.archived
    if (filter === 'archived') return habit.archived
    return true
  })

  const sorted = filtered.slice().sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'streak') return (decorate.get(b.id)?.current || 0) - (decorate.get(a.id)?.current || 0)
    if (sort === 'rate') return (decorate.get(b.id)?.rate || 0) - (decorate.get(a.id)?.rate || 0)
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  })

  const activeList = filter === 'archived' ? [] : sorted.filter((habit) => !habit.archived)
  const archivedList = filter === 'active' ? [] : sorted.filter((habit) => habit.archived)
  const archivedTotal = habits.filter((habit) => habit.archived).length

  return (
    <section className="page-view manage-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><ListChecks size={14} /> Organize</p>
          <h2>Manage habits</h2>
        </div>
        <button className="primary-button" onClick={onAddHabit}><Plus size={17} /> Add habit</button>
      </div>

      <div className="manage-toolbar">
        <div className="search-wrap">
          <Search size={18} />
          <input
            placeholder="Search name or description"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-label="Search habits"
          />
          {search && (
            <button className="clear-search" onClick={() => onSearch('')} aria-label="Clear search"><X size={16} /></button>
          )}
        </div>

        <div className="toolbar-row">
          <div className="filter-chips" role="tablist" aria-label="Filter habits">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                role="tab"
                aria-selected={filter === option.id}
                className={filter === option.id ? 'active' : ''}
                onClick={() => setFilter(option.id)}
              >
                {option.label}
                {option.id === 'archived' && archivedTotal > 0 ? ` (${archivedTotal})` : ''}
              </button>
            ))}
          </div>

          <label className="sort-control">
            <SlidersHorizontal size={15} />
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort habits">
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="day-picker">
        <label>
          History date
          <input type="date" max={todayKey} value={date} onChange={(event) => onDate(event.target.value || todayKey)} />
        </label>
        {date !== todayKey ? (
          <>
            <span className="history-flag">Viewing {formatDate(date)} — check-offs save to that date</span>
            <button className="text-button" onClick={() => onDate(todayKey)}>Back to today</button>
          </>
        ) : (
          <span className="history-flag muted">Showing today · pick a past date to review or backfill</span>
        )}
      </div>

      {activeList.length > 0 && (
        <>
          <h3 className="list-label">Active <span>{activeList.length}</span></h3>
          <div className="library-column">
            {activeList.map((habit) => (
              <div className="manage-row" key={habit.id}>
                <HabitCard
                  habit={habit}
                  date={date}
                  onToggle={onToggle}
                  onEdit={onEditHabit}
                  onArchive={onArchiveHabit}
                />
                <div className="manage-meta">
                  <span><strong>{decorate.get(habit.id)?.rate ?? 0}%</strong> completion</span>
                  <span><strong>{decorate.get(habit.id)?.done ?? 0}</strong> done</span>
                  <span><strong>{decorate.get(habit.id)?.missed ?? 0}</strong> missed</span>
                  <small>{scheduleLabel(habit)}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {archivedList.length > 0 && (
        <>
          <h3 className="list-label archived-label">
            <Archive size={13} /> Archived <span>{archivedList.length}</span>
          </h3>
          <p className="muted archived-note">Archived habits keep their full history and can be restored at any time.</p>
          <div className="library-column">
            {archivedList.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                date={date}
                onEdit={onEditHabit}
                onArchive={onArchiveHabit}
                archived
              />
            ))}
          </div>
        </>
      )}

      {!sorted.length && (
        <div className="empty-state">
          <ListChecks size={26} />
          <h3>{query ? 'No habits match your search' : filter === 'archived' ? 'Nothing archived' : 'No habits yet'}</h3>
          <p>
            {query
              ? `Nothing matched “${search}”. Try a different word, or clear the search.`
              : filter === 'archived'
                ? 'Archived habits will appear here. Archiving keeps history instead of deleting it.'
                : 'Add your first habit to start building the challenge.'}
          </p>
          {query ? (
            <button className="secondary-button" onClick={() => onSearch('')}>Clear search</button>
          ) : (
            <button className="primary-button" onClick={onAddHabit}><Plus size={16} /> Add habit</button>
          )}
        </div>
      )}

      {activeHabits.length > 0 && (
        <p className="manage-footnote">
          {activeHabits.length} active {activeHabits.length === 1 ? 'habit' : 'habits'} · {archivedTotal} archived · history preserved on archive.
        </p>
      )}
    </section>
  )
}
