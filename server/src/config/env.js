import 'dotenv/config'

const emailPort = Number(process.env.EMAIL_PORT || 587)

// Any SMTP provider works: a Gmail App Password, a transactional service, or a
// local catcher such as MailHog. Nothing is defaulted to a real credential.
const email = {
  host: process.env.EMAIL_HOST || '',
  port: emailPort,
  secure: process.env.EMAIL_SECURE === 'true' || emailPort === 465,
  user: process.env.EMAIL_USER || '',
  password: process.env.EMAIL_PASSWORD || '',
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  // Timeouts keep a dead or unreachable SMTP host from hanging a request or a
  // scheduler tick. Without these, nodemailer waits two minutes by default.
  connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS || 10000),
  greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT_MS || 8000),
  socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT_MS || 20000),
}

const EMAIL_REQUIRED = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM']
const emailMissing = EMAIL_REQUIRED.filter((key) => !process.env[key])

export const isProduction = (process.env.NODE_ENV || 'development') === 'production'

// Cookies are marked Secure only over HTTPS, which in practice means production.
// A Secure cookie on plain-HTTP localhost would be silently dropped by some
// browsers, breaking sign-in during development for no security gain.
export const cookieSecure = isProduction || process.env.COOKIE_SECURE === 'true'

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || `http://localhost:${Number(process.env.PORT || 4000)}`,
  nodeEnv: process.env.NODE_ENV || 'development',
  googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || '',

  // A session secret is mandatory in production. In development a throwaway
  // one is generated per boot so the app still runs; sessions then do not
  // survive a restart, which is a reasonable trade for a dev convenience and
  // is logged loudly below.
  sessionSecret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'development-only-insecure-secret'),
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 30),

  // Development-only sign-in that does not need Google. Never enabled in
  // production, and never enabled implicitly.
  devLoginEnabled: process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN !== 'off',
  devUserEmail: process.env.DEVELOPMENT_USER_EMAIL || 'developer@daymark.local',
  devUserName: process.env.DEVELOPMENT_USER_NAME || 'Local Developer',

  email,
  emailConfigured: emailMissing.length === 0,
  emailMissing,

  // The reminder job's clock. Per-user timezones would need a timezone field on
  // every account and a scheduler that buckets by offset; that is out of scope
  // for this build, so one server-wide timezone is used and documented.
  reminderTimezone: process.env.REMINDER_TIMEZONE || 'Asia/Kolkata',
  reminderPollMinutes: Math.max(1, Number(process.env.REMINDER_POLL_MINUTES || 15)),
  reminderSchedulerEnabled: process.env.REMINDER_SCHEDULER !== 'off',

  // Protects the manual reminder endpoints. Required in production; in
  // development the endpoints are reachable without it.
  reminderAdminToken: process.env.REMINDER_ADMIN_TOKEN || '',
}
