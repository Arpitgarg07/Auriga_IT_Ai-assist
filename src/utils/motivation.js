// Time-aware greeting plus deterministic message rotation. Messages are picked
// from the day of the year so they change daily but never flicker between renders.

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  // Night wraps midnight: 21:00-04:59. Without the leading branch, 00:05 — a
  // moment the morning panel genuinely appears on a new day — said "Good
  // morning", and the night branch could only ever be reached after 21:00.
  if (hour < 5) return { text: 'Good night', emoji: '🌙', period: 'night' }
  if (hour < 12) return { text: 'Good morning', emoji: '☀️', period: 'morning' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️', period: 'afternoon' }
  if (hour < 21) return { text: 'Good evening', emoji: '🌙', period: 'evening' }
  return { text: 'Good night', emoji: '🌙', period: 'night' }
}

export function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date - start) / 86400000)
}

const MESSAGES = {
  allDone: [
    'Every habit is checked off. This is what consistency looks like.',
    'Today is complete. Rest is part of the programme.',
    'You showed up for all of it today. That is the whole game.',
    'Full house. Tomorrow you start again from a stronger place.',
  ],
  inProgress: [
    'You are mid-way through today. Keep the momentum.',
    'A few left. Small steps, done today, beat big steps promised tomorrow.',
    'One check-off at a time. You are ahead of yesterday already.',
    'The hardest part is starting. You already did that.',
  ],
  untouched: [
    'Small steps today. Big changes tomorrow.',
    'Start with the easiest one. Momentum does the rest.',
    'Seventy-five days is just today, repeated. Begin here.',
    'You do not need to feel ready. You just need to begin.',
  ],
  rest: [
    'Nothing scheduled today. Enjoy the pause — it is part of the plan.',
    'A planned rest day. Recovery is training too.',
  ],
}

/**
 * `streak` must be a streak that is genuinely on the line today — the current
 * streak of a habit that is scheduled today and still unlogged. It must NOT be
 * the app-wide maximum streak: a user whose only live streak belongs to a habit
 * they already completed would be told their streak is at risk when it is not.
 * `reminder.streak.current` from getMorningReminder is the correct source.
 */
export function motivationFor({ completed = 0, total = 0, streak = 0, date = new Date() } = {}) {
  const pool = total === 0
    ? MESSAGES.rest
    : completed >= total
      ? MESSAGES.allDone
      : completed > 0
        ? MESSAGES.inProgress
        : streak > 0
          ? [...MESSAGES.untouched, `Your ${streak}-day streak is on the line. One habit is enough to keep it.`]
          : MESSAGES.untouched
  return pool[dayOfYear(date) % pool.length]
}

// Short, warm feedback for a single habit check-off.
const SMALL_WINS = ['Nice.', 'Logged.', 'That counts.', 'Kept the promise.', 'One more down.', 'Streak protected.']

export function smallWinFor(index) {
  return SMALL_WINS[Math.abs(index) % SMALL_WINS.length]
}

export function initialsFor(name) {
  if (!name || !name.trim()) return 'Y'
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]).join('').toUpperCase()
}
