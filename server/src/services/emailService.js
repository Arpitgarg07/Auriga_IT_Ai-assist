import { env } from '../config/env.js'
import { greetingFor } from '../../../src/utils/motivation.js'
import { dayNameGreeting } from '../../../src/utils/reminders.js'
import { CHALLENGE_LENGTH } from '../../../src/utils/constants.js'
import { daysBetween } from '../../../src/utils/dates.js'

/* -------------------------------------------------------------------------
 * HTML escaping
 *
 * Habit names and display names are user data that lands inside an HTML
 * document. They are escaped at the boundary so a habit called `<script>` is
 * rendered as text rather than executed by whatever renders the mail.
 * ---------------------------------------------------------------------- */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character])
}

/* -------------------------------------------------------------------------
 * Content
 *
 * The email deliberately mirrors the in-app reminder: same greeting helper,
 * same day-name helper, same challenge constants, and — because the caller
 * supplies habits that were resolved by src/utils/reminders.js — the same
 * definition of "still pending today". The email cannot disagree with the
 * dashboard because it is not computing anything the dashboard computes
 * differently.
 * ---------------------------------------------------------------------- */

// The subject may only claim a streak is at risk when one genuinely is. This is
// the same honesty rule the in-app reminder follows, applied to the subject
// line: a user with nothing live is welcomed, not warned.
export function buildSubject(user, pendingHabits, streak) {
  const name = (user?.name || '').trim()
  const who = name ? `${name}, ` : ''
  if (streak && streak.current > 0) return `🔥 ${who}your streak is waiting!`
  if (pendingHabits.length === 1) return `☀️ ${who}1 habit left today`
  return `☀️ ${who}${pendingHabits.length} habits left today`
}

const MOTIVATION = [
  'Small steps. Strong habits. Better you.',
  'Consistency beats intensity. Every single time.',
  'You do not need to feel ready. You just need to begin.',
  'Seventy-five days is just today, repeated.',
]

function pickMotivation(dateKey) {
  const digits = String(dateKey || '').replace(/\D/g, '')
  const seed = digits ? Number(digits.slice(-4)) : 0
  return MOTIVATION[seed % MOTIVATION.length]
}

function habitCard(entry) {
  const name = escapeHtml(entry.habit.name)
  const streakLine = entry.current > 0
    ? `<span style="color:#b18425;font-size:13px;">🔥 ${entry.current} day${entry.current === 1 ? '' : 's'} streak</span>`
    : `${escapeHtml(entry.schedule || 'Scheduled today')}`

  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
                <tr>
                  <td style="background:#f7faf7;border:1px solid #dce5de;border-left:3px solid #1d6b51;border-radius:10px;padding:14px 16px;">
                    <div style="font-size:15px;font-weight:700;color:#1c2925;margin-bottom:4px;">${name}</div>
                    <div style="font-size:13px;color:#71807a;">${streakLine}</div>
                  </td>
                </tr>
              </table>`
}

function progressBar(percent) {
  const filled = Math.max(0, Math.min(100, Math.round(percent)))
  const empty = 100 - filled
  // Two cells rather than a nested div: this renders consistently in Outlook,
  // Gmail and Apple Mail, none of which agree on modern CSS.
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e3ece5;border-radius:8px;">
                <tr>
                  <td width="${filled}%" height="10" bgcolor="#1d6b51" style="background:#1d6b51;border-radius:8px;font-size:0;line-height:0;">&nbsp;</td>
                  <td width="${empty}%" height="10" style="font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>`
}

export function createReminderEmail(user, pendingHabits, context = {}) {
  const {
    dateKey = new Date().toISOString().slice(0, 10),
    challengeStart = null,
    challengeDay = 0,
    appUrl = env.clientUrl,
    now = new Date(),
  } = context

  const entries = pendingHabits || []
  const streak = entries
    .filter((entry) => entry.current > 0)
    .reduce((best, entry) => (!best || entry.current > best.current ? entry : best), null)

  const displayName = (user?.name || '').trim()
  const greeting = greetingFor(now)
  const total = entries.length

  // A caller that knows the day passes it; a caller that only knows the start
  // date still gets the right number, so the two can never drift apart.
  const derivedDay = challengeStart
    ? (() => {
      const elapsed = daysBetween(challengeStart, dateKey)
      return elapsed >= 0 ? Math.min(CHALLENGE_LENGTH, elapsed + 1) : 0
    })()
    : 0
  const day = Math.max(0, Math.min(CHALLENGE_LENGTH, challengeDay || derivedDay))
  const percent = Math.round((day / CHALLENGE_LENGTH) * 100)

  const subject = buildSubject(user, entries, streak)

  const cards = entries.map(habitCard).join('')
  const remaining = `${total} habit${total === 1 ? '' : 's'} remaining`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7f2;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #dce5de;border-radius:16px;overflow:hidden;">

          <tr>
            <td style="padding:26px 28px 18px 28px;border-bottom:1px solid #dce5de;">
              <div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#1d6b51;text-transform:uppercase;">Daymark</div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 28px 8px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 6px 0;font-size:22px;font-weight:700;color:#1c2925;line-height:1.3;">
                ${greeting.text}${displayName ? `, ${escapeHtml(displayName)}` : ''}! ${greeting.emoji}
              </p>
              <p style="margin:0 0 22px 0;font-size:13px;color:#71807a;">${escapeHtml(dayNameGreeting(dateKey))}</p>
              <p style="margin:0 0 22px 0;font-size:15px;color:#3d4c47;line-height:1.6;">
                You still have <strong style="color:#1c2925;">${total}</strong> habit${total === 1 ? '' : 's'} to complete today.
              </p>
              <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#71807a;text-transform:uppercase;">Your morning checklist</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 28px;">
${cards}
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 4px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eaf3ec;border-radius:12px;">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 14px 0;font-size:11px;font-weight:700;letter-spacing:1.4px;color:#1d6b51;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${CHALLENGE_LENGTH}-Day Challenge</p>
                    <p style="margin:0 0 12px 0;font-size:19px;font-weight:700;color:#1c2925;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${day > 0 ? `Day ${day} / ${CHALLENGE_LENGTH}` : 'Not started'}
                    </p>
${progressBar(percent)}
                    <p style="margin:12px 0 0 0;font-size:13px;color:#71807a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      ${remaining}${challengeStart ? ` &middot; started ${escapeHtml(challengeStart)}` : ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px 6px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#1d6b51;">
                ${streak ? 'Your streak is waiting.' : 'Your checklist is waiting.'}
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;color:#3d4c47;">
                ${streak
                  ? `Let's keep it alive! 💪`
                  : `Let's get one on the board. 💪`}
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 28px 26px 28px;">
              <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#1d6b51;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Open Habit Tracker</a>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 26px 28px;border-top:1px solid #dce5de;">
              <p style="margin:0;font-size:12px;color:#71807a;text-align:center;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                &ldquo;${pickMotivation(dateKey)}&rdquo;
              </p>
            </td>
          </tr>

        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:16px 8px 0 8px;font-size:11px;color:#93a49a;text-align:center;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              You are receiving this because daily email reminders are switched on in Daymark.<br>
              Turn them off any time in Settings &rarr; Daily Email Reminder.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `${greeting.text}${displayName ? `, ${displayName}` : ''}!`,
    '',
    dayNameGreeting(dateKey),
    '',
    `You still have ${total} habit${total === 1 ? '' : 's'} to complete today.`,
    '',
    ...entries.map((entry) => (
      entry.current > 0
        ? `  [ ] ${entry.habit.name} — ${entry.current} day streak`
        : `  [ ] ${entry.habit.name}`
    )),
    '',
    `${CHALLENGE_LENGTH}-Day Challenge — ${day > 0 ? `Day ${day} / ${CHALLENGE_LENGTH}` : 'Not started'} (${percent}%)`,
    `${remaining}`,
    '',
    streak ? "Your streak is waiting. Let's keep it alive!" : "Your checklist is waiting. Let's get one on the board.",
    appUrl,
    '',
    `"${pickMotivation(dateKey)}"`,
    '',
    'Daily email reminders are on. Turn them off in Settings → Daily Email Reminder.',
  ].join('\n')

  return { subject, html, text }
}

/* -------------------------------------------------------------------------
 * Provider boundary
 *
 * The only place that knows how mail actually leaves the process. Swapping
 * SMTP for a transactional API means rewriting this function and nothing else.
 * Credentials come from the environment; none are ever hard-coded, and a
 * missing configuration is reported rather than faked.
 * ---------------------------------------------------------------------- */

let cachedTransport

async function createTransport() {
  if (cachedTransport) return cachedTransport
  if (!env.emailConfigured) return null

  // Imported lazily so the API still boots, and every non-email route still
  // works, when the mail dependency is not installed.
  let nodemailer
  try {
    nodemailer = (await import('nodemailer')).default
  } catch {
    throw new Error('The "nodemailer" package is not installed. Run: npm install nodemailer')
  }

  cachedTransport = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: env.email.secure,
    auth: env.email.user ? { user: env.email.user, pass: env.email.password } : undefined,
    connectionTimeout: env.email.connectionTimeout,
    greetingTimeout: env.email.greetingTimeout,
    socketTimeout: env.email.socketTimeout,
  })
  return cachedTransport
}

export function emailStatus() {
  return {
    configured: env.emailConfigured,
    provider: env.emailConfigured ? 'smtp' : null,
    host: env.emailConfigured ? env.email.host : null,
    from: env.emailConfigured ? env.email.from : null,
    missing: env.emailMissing,
  }
}

/**
 * Sends a prepared message. Resolves to a result object and never throws, so a
 * mail outage cannot take down a request or the scheduler.
 */
export async function sendEmail({ to, subject, html, text }) {
  if (!env.emailConfigured) {
    return { sent: false, error: 'Email is not configured', missing: env.emailMissing }
  }
  if (!to) {
    return { sent: false, error: 'No recipient address' }
  }

  try {
    const transport = await createTransport()
    const info = await transport.sendMail({ from: env.email.from, to, subject, html, text })
    return { sent: true, messageId: info.messageId, accepted: info.accepted || [] }
  } catch (error) {
    // Logged server-side; the caller decides what the user sees.
    console.error(`Email send failed for ${to}: ${error.message}`)
    return { sent: false, error: error.message }
  }
}

/**
 * sendMorningHabitReminder(user, pendingHabits)
 *
 * Renders and sends the morning reminder. Returns a structured result instead
 * of throwing so callers (the job, the test route) can report honestly.
 */
export async function sendMorningHabitReminder(user, pendingHabits, context = {}) {
  const entries = pendingHabits || []
  if (!entries.length) {
    return { sent: false, skipped: true, reason: 'No pending habits' }
  }

  const email = createReminderEmail(user, entries, context)
  const result = await sendEmail({ to: user?.email, ...email })
  return { ...result, subject: email.subject, habitCount: entries.length }
}
