/**
 * The single place the browser talks to the API.
 *
 * Every call returns `{ ok, status, data }` instead of throwing, so a missing
 * or unreachable backend is a state the UI renders rather than an exception it
 * has to catch. The session cookie travels automatically; no token is ever held
 * in JavaScript.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function request(path, { method = 'GET', body, signal } = {}) {
  try {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    })

    if (response.status === 204) return { ok: true, status: 204, data: null }
    const data = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, data }
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    // Network failure or no server at all — a normal, handled condition.
    return { ok: false, status: 0, data: null, offline: true }
  }
}

export const api = {
  /* sign-in */
  providers: () => request('/api/auth/providers'),
  me: () => request('/api/me'),
  devSignIn: () => request('/api/auth/dev', { method: 'POST' }),
  signOut: () => request('/api/auth/logout', { method: 'POST' }),
  // A full-page navigation, not a fetch: the browser must follow the redirect.
  googleSignInUrl: '/api/auth/google',

  /* account data */
  bootstrap: () => request('/api/bootstrap'),
  sync: (payload) => request('/api/sync', { method: 'POST', body: payload }),
  analytics: (range) => request(`/api/analytics?range=${encodeURIComponent(range)}`),

  /* habits, completions, rewards, achievements */
  habits: () => request('/api/habits'),
  createHabit: (habit) => request('/api/habits', { method: 'POST', body: habit }),
  updateHabit: (id, habit) => request(`/api/habits/${id}`, { method: 'PUT', body: habit }),
  archiveHabit: (id) => request(`/api/habits/${id}/archive`, { method: 'POST' }),
  restoreHabit: (id) => request(`/api/habits/${id}/restore`, { method: 'POST' }),
  deleteHabit: (id) => request(`/api/habits/${id}`, { method: 'DELETE' }),
  addCompletion: (habitId, date) => request('/api/completions', { method: 'POST', body: { habitId, date } }),
  removeCompletion: (habitId, date) => request(`/api/completions/${habitId}/${date}`, { method: 'DELETE' }),
  rewards: () => request('/api/rewards'),
  achievements: () => request('/api/achievements'),
  challenge: () => request('/api/challenge'),

  /* email reminders */
  reminderStatus: () => request('/api/reminders/status'),
  previewReminder: (payload) => request('/api/reminders/preview', { method: 'POST', body: payload }),
  sendTestReminder: (payload) => request('/api/reminders/test', { method: 'POST', body: payload }),
}

/**
 * Builds the snapshot the reminder endpoints take. Only the fields the shared
 * logic reads are sent, and the habit objects keep their stored shape so the
 * server can run the identical module with identical results.
 */
export function buildReminderSnapshot(habits, { dateKey, profile, challengeStart }) {
  return {
    dateKey,
    challengeStart: challengeStart || null,
    user: { name: profile?.name || '', email: profile?.email || '' },
    habits: (habits || []).map((habit) => ({
      id: habit.id,
      name: habit.name,
      description: habit.description || '',
      frequency: habit.frequency,
      customDays: habit.customDays || [],
      createdAt: habit.createdAt,
      archived: Boolean(habit.archived),
      completions: habit.completions || [],
    })),
  }
}
