// Reports email configuration with every EMAIL_* variable explicitly blanked.
// Run in a child process by the test so the assertion does not depend on
// whatever the developer happens to have in their own .env.
// dotenv does not override variables that are already set, so an empty string
// in the child environment stays empty and the status is deterministic.

const BASE = new URL('../../server/src/services/', import.meta.url).href
const { emailStatus, sendEmail } = await import(`${BASE}emailService.js`)

const status = emailStatus()
const send = await sendEmail({ to: 'someone@example.com', subject: 'x', html: '<p>x</p>' })

process.stdout.write(JSON.stringify({
  configured: status.configured,
  provider: status.provider,
  missing: status.missing,
  sendSent: send.sent,
  sendError: send.error || null,
}))
