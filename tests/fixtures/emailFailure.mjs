// Runs in a child process so it can set EMAIL_* before env.js is evaluated.
// Emits a single JSON report on stdout; emailService's own logging goes to
// stderr, so stdout stays parseable.

const BASE = new URL('../../server/src/services/', import.meta.url).href
const { emailStatus, sendMorningHabitReminder } = await import(`${BASE}emailService.js`)

const user = { name: 'Sneha', email: 'sneha@example.com' }
const habits = [{ habit: { name: 'Read', id: 'h1' }, current: 8, best: 8, schedule: 'Every day' }]

const report = {
  configured: emailStatus().configured,
  provider: emailStatus().provider,
  threw: false,
  sent: null,
  error: null,
  subject: null,
}

try {
  const result = await sendMorningHabitReminder(user, habits, { dateKey: '2026-09-16' })
  report.sent = result.sent
  report.error = result.error || null
  report.subject = result.subject || null
} catch (error) {
  report.threw = true
  report.error = error.message
}

process.stdout.write(JSON.stringify(report))
