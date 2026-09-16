# Daymark — a 75-day habit tracker

Daymark is a responsive habit tracker built for a 75-day self-improvement challenge, in the spirit of the original problem: a person with a few daily habits, a few weekday-only habits, and a list that keeps growing.

Open it in the morning, see only what is due today, tick habits off one by one, and watch the streak build.

Built for any user — no name, habit or streak is hard-coded.

It runs in two modes. Signed out, everything lives in the browser and needs no server at all. Signed in with Google, your habits, history, rewards and streaks live in MongoDB and follow you to any device — and only then can the morning email reminder reach you when the app is closed.

---

## Problem Interpretation

The brief is a story rather than a specification. Each concrete detail was read as a clue about a general product:

- **"75-day challenge"** → a bounded challenge with a start date, day counter and progress bar.
- **"some every day, some only on weekdays"** → three schedule types: every day, weekdays, and an explicit custom day set.
- **"see today's habits, complete them one by one"** → a home board that shows only what is scheduled today, with one-tap, reversible completion.
- **"current streak" and "best-ever streak"** → two schedule-aware numbers.
- **"her habit list becomes long"** → search, filter and sort.
- **"archive instead of permanent deletion"** → soft delete; history survives and can be restored.
- **"historical data", "day-wise management"** → a date picker that reads *and* writes real past dates.
- **"analytics, motivation, rewards, streak milestones"** → a full analytics tab, rotating encouragement, a reward ledger, and milestone badges.
- **"for ANY user"** → the display name is configurable and nothing about Ananya is baked in.

The two most load-bearing assumptions: a day is the user's **local calendar day**, and **a weekday means Monday–Friday**, where Saturday and Sunday are unscheduled rather than missed.

---

## Features

**Home**
- Time-aware personalised greeting (`Good morning, Sneha ☀️`) driven by the profile name
- Today's progress ring, current streak, best streak and challenge-day stats
- A 75-day challenge panel with days remaining
- "Next reward" card with real progress toward the next streak milestone
- Today's habit list with one-tap completion and empty state
- Milestone badge strip with reward indicators
- Rotating motivational message (can be switched off)

**Habits**
- Create, edit, archive, restore and search
- Schedules: every day, weekdays, or custom days — shown as a `MON ✓ TUE ✓ SAT ✕` strip
- Optional icon per habit
- Current and best streak per habit
- Filter (active / archived / all) and sort (recent, name, streak, completion rate)

**Streaks**
- Schedule-aware current and best streaks
- Weekends never break a weekday habit; Friday → Monday stays consecutive
- An unfinished today does not erase yesterday's run

**History**
- Date picker on the Manage tab to review or backfill any past date (capped at today)
- Only real stored data is shown — nothing is generated

**Celebration**
- Small toast on each check-off
- Full celebration with confetti when every habit due today is complete
- Milestone celebrations at 1, 3, 7, 14, 21, 30, 50 and 75 days, recorded once and never repeated

**Reminders**
- A morning checklist of habits scheduled today that have not been logged yet
- On the first open of a new day, a one-time reminder panel; every later visit that day gets a compact Home card instead, so it never nags on navigation
- Only habits that are actually due today appear — weekday habits stay silent at the weekend, custom days are respected, archived habits never appear
- Streak copy is only used when a pending habit genuinely has a live streak on the line
- Per-habit current streak shown against each outstanding habit
- Daily Reminders ON/OFF, a reminder time, and an optional browser notification that requests permission only on click

**Email reminders**
- A morning email listing exactly the habits that are active, due today and still unlogged — one email per day, sent from the backend, never from the browser
- Personalized subject and body: greeting, day name, habit cards with streaks, 75-day challenge progress, and a link back into the app
- Skipped entirely when nothing is outstanding; a user is never emailed about habits they have already done
- Same exclusion rules as the dashboard: archived habits, completed habits, weekday habits at the weekend and unselected custom days are all left out
- Duplicate-protected per user per day by a unique database index, so a restart or two overlapping schedulers cannot double-send
- A failed send is recorded as failed, not sent, so a later run can retry it
- "Preview email" renders the real template with no credentials at all; "Send test email" sends one for real
- Opt-in, and honest about its own state: an unconfigured mail service says so rather than pretending

**Analytics**
- Windows: last 7 days, last 30 days, this month, all time
- Stat cards: current streak, best streak, completion rate, completed, missed, active habits
- Daily completion chart, week-over-week comparison, day-of-week breakdown
- Horizontal streak date strip with complete / partial / missed / nothing-scheduled states
- Selected-day detail listing exactly which habits were due and which were done
- Per-habit table: rate, current streak, best streak, completed, missed
- Activity heatmap
- Data-driven insights (strongest weekday, most consistent habit, habit needing attention, week-over-week movement, longest unbroken run)

**Rewards**
- Create, edit, delete and claim rewards tied to a streak milestone
- Derived states: Locked, Unlocked, Claimed
- Progress bar toward each threshold

**Settings**
- Profile: display name and email (used by the greeting)
- Challenge: start date, "start today", reset
- Preferences: motivational messages, celebration effects, theme (Light / Dark / System)
- Rewards, achievements, integrations, data reset, account

---

## Setup and Running

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production and quality checks:

```bash
npm run lint      # ESLint
npm test          # node:test unit suite (no extra dependencies)
npm run build     # production bundle into dist/
npm run preview   # serve the built bundle
```

### Tests

`npm test` runs everything on Node's built-in test runner — no test framework is installed. It covers the areas where a silent mistake would be invisible in the UI:

| File | Covers |
| --- | --- |
| `tests/streaks.test.js` | Schedule matching, weekend handling for weekday habits, Friday→Monday continuity, current vs best streaks |
| `tests/reminders.test.js` | Every in-app reminder scenario: pending detection, completion removal, all-done and rest states, weekday/custom/archived exclusion, once-per-day behaviour, and the streak-claim honesty rules |
| `tests/emailReminder.test.js` | The email pipeline: HTML escaping, subject honesty, challenge progress, every exclusion rule, the reminder window, unconfigured-email handling, and a real send against an unreachable SMTP host to prove failures are contained |
| `tests/storage.test.js` | Settings persistence, including upgrading a settings object written before reminders existed |
| `tests/motivation.test.js` | Greeting correctness across all 24 hours, and that no message claims a streak that is not at risk |
| `tests/session.test.js` | Session token signing and verification: tampering, the `alg: none` downgrade, expiry, malformed input, and cookie parsing |
| `tests/habitMapper.test.js` | The `scheduledDays` ↔ `customDays` boundary and the response presenters |
| `tests/serverGuards.test.js` | Static checks over the API source: no route trusts a client-supplied id, every data route is behind `requireAuth` and scopes by the session, no credentials are committed, the duplicate guards are real unique indexes, and the server never re-implements the streak engine |
| `tests/api.integration.test.js` | **Real Express + real MongoDB over real HTTP**: authentication, session forgery, protected routes, cross-user isolation, habit/completion/reward/achievement CRUD, derived challenge progress, the reminder job reading from the database, duplicate-reminder prevention, sync idempotence, and that no response leaks a secret |

The frontend needs **no environment variables and no backend**. With no server running it says "backend not reachable", offers to continue without an account, and works entirely in the browser.

### Running the full stack (accounts + MongoDB)

```bash
# 1. Configure the server
cp .env.example .env      # then fill in MONGODB_URI and SESSION_SECRET

# 2. Start the API, then the frontend
npm run server            # http://localhost:4000
npm run dev               # http://localhost:5173 (proxies /api to the API)
```

Open the app and sign in. With no Google credentials you get **Continue as developer**, which creates a real account in your database so the whole account layer can be exercised locally. It is unavailable when `NODE_ENV=production`.

### Demo with no database at all

```bash
npm run dev:demo    # API on :4000 backed by an in-memory MongoDB
npm run dev         # frontend on :5173
```

The real API against a real (throwaway) MongoDB — nothing is mocked, and no configuration is needed. Sign in with **Continue as developer**; the data is discarded when the process exits. The `mongod` binary is downloaded on first run.

### What each mode gives you

| | Signed out, no backend | Signed in |
| --- | --- | --- |
| Works at all | ✅ | ✅ |
| Habits, history, streaks | ✅ in this browser | ✅ on the server |
| Sync across devices | ✗ | ✅ |
| Morning reminder panel | ✅ | ✅ |
| Email reminders | ✗ (needs an account) | ✅ if SMTP is configured |
| Survives clearing site data | ✗ | ✅ |

Vite proxies `/api` to `http://localhost:4000`, so the frontend needs no hard-coded host. If the server is not running the request fails, the login screen says **Backend not reachable**, and the app continues on local storage.

---

## Environment Variables

Server variables only. Copy `.env.example` to `.env` and fill in your own values — **no real credentials are committed to this repository, and none should ever be**.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `4000`) |
| `API_URL` | Public origin of the API, used to build the OAuth callback (default `http://localhost:4000`) |
| `CLIENT_URL` | Frontend origin allowed by CORS and used for post-sign-in redirects (default `http://localhost:5173`) |
| `MONGODB_URI` | MongoDB connection string. Without it the API boots and reports "not configured" |
| `SESSION_SECRET` | Signs the session cookie. **Required in production** |
| `SESSION_TTL_SECONDS` | Session lifetime (default 30 days) |
| `COOKIE_SECURE` | Force the cookie's `Secure` flag. Automatic when `NODE_ENV=production` |
| `GOOGLE_CLIENT_ID` | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth redirect URI (defaults to `${API_URL}/api/auth/google/callback`) |
| `DEV_LOGIN` | Set to `off` to disable developer sign-in in development. Always off in production |
| `DEVELOPMENT_USER_EMAIL` | Email the developer sign-in creates or reuses |
| `DEVELOPMENT_USER_NAME` | Display name for that account |
| `EMAIL_HOST` | SMTP host, e.g. `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port (default `587`; `465` switches on implicit TLS automatically) |
| `EMAIL_SECURE` | Force implicit TLS. Inferred from the port when unset |
| `EMAIL_USER` | SMTP username — for Gmail, the full address |
| `EMAIL_PASSWORD` | SMTP password or **App Password**. Never a real account password |
| `EMAIL_FROM` | The `From` header. Usually the same as `EMAIL_USER` |
| `EMAIL_CONNECTION_TIMEOUT_MS` | How long to wait for the SMTP server before giving up (default `10000`) |
| `REMINDER_TIMEZONE` | Timezone the reminder job evaluates users in (default `Asia/Kolkata`) |
| `REMINDER_POLL_MINUTES` | How often the scheduler checks for due reminders (default `15`) |
| `REMINDER_SCHEDULER` | Set to `off` to run the API without the scheduler |
| `REMINDER_ADMIN_TOKEN` | Protects `POST /api/reminders/test` and `/run`. Required in production |

Every value is optional. With none of them set the server still starts, logs that MongoDB and email are unconfigured, reports Google sign-in as unavailable, and the frontend falls back to local storage.

### Setting up email (Gmail example)

1. Enable 2-Step Verification on the Google account.
2. Create an **App Password** at <https://myaccount.google.com/apppasswords>. A normal account password will not work over SMTP, and Daymark never asks for one.
3. Put it in `.env`:

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@gmail.com
EMAIL_PASSWORD=your-16-character-app-password
EMAIL_FROM=you@gmail.com
```

For local testing without a real inbox, run [Mailpit](https://github.com/axllent/mailpit) or MailHog and point `EMAIL_HOST`/`EMAIL_PORT` at it — nothing leaves your machine.

**Secrets are never committed.** `.env` is gitignored; only `.env.example` (placeholders, no real values) is tracked. No MongoDB URI, OAuth secret, SMTP password, JWT secret or API key exists anywhere in this repository's tracked files.

---

## Architecture

Two modes, chosen at runtime by whether a backend is reachable and whether the user signs in.

```text
 Signed out  (or no backend)
 React (Vite)  →  browser localStorage            ← always works, no server needed

 Signed in
 React (Vite)  →  Express API  →  MongoDB         ← accounts, history, multi-device
                     │
                     ├→ Google OAuth (sign-in)
                     ├→ SMTP / nodemailer (email reminders)   ← credentials stay server-side
                     └→ the reminder job

 The shared logic both sides run
 src/utils/streaks.js, reminders.js, analytics.js, dates.js
   ├── imported by the React app
   └── imported by the server        ← so the email cannot disagree with the dashboard

 Not implemented
 Express  →  Google Health (steps, distance, calories)    ← reports "not connected" honestly
```

The server never has its own copy of the streak or reminder maths. `server/src/services/reminderService.js` imports `pendingWithStreaks` from the same `src/utils/reminders.js` the browser uses, which in turn imports the untouched `streaks.js`. There is exactly one implementation of "which habits are still outstanding today".

**Accounts and sync**
- Google sign-in (OAuth 2.0), with a developer sign-in for local work when Google credentials are not configured
- Signed, httpOnly session cookies — no token is ever stored in JavaScript
- Habits, completion history, rewards, achievements and the challenge live in MongoDB once you sign in
- Every query is scoped to the session user; the API never accepts a `userId` from the client
- One idempotent sync endpoint carries both the ongoing writes and the one-off import
- "Import your existing data" offers to copy browser-local habits and history into a new account, and never deletes the local copy
- The app works fully without any of this: with no backend it says so and keeps using local storage

### Sign-in flow

```text
Browser                     Express                         Google
  │                            │                              │
  ├─ GET /api/auth/providers ──▶ what is available?           │
  │                            │                              │
  ├─ GET /api/auth/google ────▶ 302 with random state cookie ─┼─▶ consent
  │                            │                              │
  ├─ GET /api/auth/google/callback?code&state                 │
  │                            ├─ state must match the cookie  │
  │                            ├─ exchange code for tokens ────┼─▶
  │                            ├─ fetch the profile ──────────┼─▶
  │                            ├─ upsert User by email         │
  │                            ├─ stamp challengeStartDate (first sign-in only)
  │◀─ Set-Cookie: signed session (httpOnly) ─┤                 │
  │                            │                              │
  ├─ GET /api/bootstrap ──────▶ user + habits + completions +  │
  │                            │ rewards + achievements        │
  └─ POST /api/sync ──────────▶ upsert by clientId (idempotent)│
```

### The email reminder flow

```text
scheduler tick (every REMINDER_POLL_MINUTES)
  │
  ├─ for each user with reminders.emailEnabled
  │    ├─ work out the user's local date and minute-of-day in REMINDER_TIMEZONE
  │    ├─ skip if outside the 3-hour window after their reminder time
  │    ├─ load habits + completions, join them into the shared habit shape
  │    ├─ run getTodaysHabits / pendingWithStreaks  ← same module as the dashboard
  │    ├─ skip entirely if nothing is pending
  │    ├─ claim a ReminderLog row  ← unique index = duplicate protection
  │    ├─ render + send via emailService
  │    └─ mark sent, or failed (a failure is never recorded as sent)
  │
  └─ never throws: per-user failures are caught and summarised
```

**Frontend** — React 19, plain JavaScript, hand-written CSS. No state library, no UI kit, no chart library (all charts are CSS). The only runtime dependencies are `react`, `react-dom` and `lucide-react`.

**Server** — Express 5 + Mongoose. Owns sessions, the account data, the reminder job and the only SMTP code.

### Frontend structure

```text
src/
  App.jsx                  app shell: state, tab routing, account mode, celebrations
  App.css                  design tokens, layout, components, responsive rules
  index.css                global reset, focus treatment, colour scheme
  main.jsx                 React entry point
  components/
    LoginScreen.jsx        signed-out screen: Google, developer, or continue locally
    HomeView.jsx           greeting, today's board, stats, badges, next reward
    AnalyticsView.jsx      filters, charts, date strip, habit table, insights
    ManageView.jsx         add/edit/archive/restore, search, filter, sort, history
    SettingsView.jsx       profile, challenge, preferences, reminders, rewards, account
    HabitCard.jsx          single habit row (shared by Home and Manage)
    HabitForm.jsx          create/edit modal with icon and schedule pickers
    RewardForm.jsx         create/edit reward modal
    RewardsPanel.jsx       reward ledger with locked/unlocked/claimed states
    Celebration.jsx        confetti overlay for day-complete and milestones
    MorningReminder.jsx    once-per-day reminder panel
    ReminderCard.jsx       compact "Your morning checklist" card for Home
    EmailPreview.jsx       renders the real email template in-app, no credentials
    DayChips.jsx           read-only Mon–Sun schedule strip
    HabitIcon.jsx          icon-name resolution with a safe fallback
  services/
    api.js                 the only place fetch() is called
  utils/
    dates.js               local date keys and date arithmetic
    streaks.js             schedule-aware streak engine
    storage.js             localStorage load/save/validate/clear
    analytics.js           period stats, per-habit reports, insights
    reminders.js           pending-habit detection, reminder copy, once-a-day rules
    constants.js           weekdays, milestones, schedule vocabulary
    motivation.js          time-based greeting and message rotation
tests/                     node:test suite — unit and real-HTTP integration
server/
  dev-server.js            zero-config demo API on an in-memory MongoDB
  src/app.js               builds the Express app (no port, no connection)
  src/server.js            process entry point: connect, listen, schedule
  src/config/
    env.js                 environment loading
    database.js            connection and honest status reporting
  src/middleware/
    auth.js                session → request.user, requireAuth
    requireDatabase.js     503 rather than a confusing failure
  src/models/              User, Habit, HabitCompletion, Challenge, Reward, Achievement, ReminderLog
  src/services/
    sessionService.js      signed session tokens, no dependency
    habitMapper.js         scheduledDays ↔ customDays, and the response shapes
    emailService.js        template rendering + the only SMTP code
    reminderService.js     pending computation, duplicate guard, the job
    googleHealthService.js Google Health integration boundary
  src/jobs/reminderScheduler.js   the polling scheduler
  src/routes/              auth, sync, habits, completions, rewards, achievements,
                           challenge, analytics, reminders
```

### API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | Public. Database and configuration status |
| `GET` | `/api/auth/providers` | Public. Which sign-in options exist |
| `GET` | `/api/auth/google` | Public. Redirects to Google |
| `GET` | `/api/auth/google/callback` | Public. Exchanges the code, sets the session |
| `POST` | `/api/auth/dev` | Development only. Creates a real local account |
| `POST` | `/api/auth/logout` | Clears the session |
| `GET` | `/api/me` | The signed-in user |
| `GET` | `/api/bootstrap` | Everything the client needs in one call |
| `POST` | `/api/sync` | Idempotent whole-account upsert (import + ongoing writes) |
| `GET/POST` | `/api/habits` | List, create |
| `PUT`/`DELETE` | `/api/habits/:id` | Update, permanent delete |
| `POST` | `/api/habits/:id/archive` · `/restore` | Soft delete and undo |
| `GET/POST` | `/api/completions` | List, add (idempotent) |
| `DELETE` | `/api/completions/:habitId/:date` | Remove |
| `GET/POST` | `/api/rewards` · `PUT`/`DELETE` `/api/rewards/:id` · `POST /:id/claim` | Reward ledger |
| `GET/POST` | `/api/achievements` | Idempotent by milestone |
| `GET`/`PUT` | `/api/challenge` | Start date and duration; progress is derived |
| `GET` | `/api/analytics` | `?range=7d\|30d\|month\|all`, computed with the shared module |
| `GET` | `/api/reminders/status` | Public. Whether email is configured |
| `POST` | `/api/reminders/preview` | Public. Renders the email from a snapshot, sends nothing |
| `POST` | `/api/reminders/test` | Guarded. Sends one real reminder |
| `POST` | `/api/reminders/run` | Guarded. Runs the job now |

Every data route is mounted behind `requireAuth` and `requireDatabase` in one place, and each scopes its own queries by `request.user._id`. No route accepts a `userId`.

---

## Data Model

Two `localStorage` keys.

`habit-tracker-habits` — an array of habits:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `crypto.randomUUID()` |
| `name` | string | required |
| `description` | string | optional |
| `icon` | string | icon name; unknown values fall back to a default |
| `frequency` | `'daily' \| 'weekdays' \| 'custom'` | |
| `customDays` | `number[]` | `1` = Monday … `7` = Sunday |
| `createdAt` | ISO string | floors the analytics window |
| `archived` | boolean | archive, never delete |
| `completions` | `string[]` | `'YYYY-MM-DD'` local date keys |

`habit-tracker-settings` — one object:

```js
{
  challengeStart: '2026-09-16',
  achievements: [1, 3, 7],
  rewards: [{ id, name, description, milestone, claimed }],
  profile: { name, email },
  preferences: { motivationalMessages, celebrationEffects, theme },
  reminders: { enabled, time, browserNotifications, lastShownDate }
}
```

`reminders.time` is `'HH:MM'` 24-hour so it maps directly onto `<input type="time">`. `reminders.lastShownDate` is the date key the morning panel was acknowledged on — that single field is what makes it appear once per day rather than on every render, reload or tab switch.

A third key, `habit-tracker-reminder-log`, holds one date key: the last day a browser notification was raised. It is deliberately kept out of React state and out of the settings object, because it records an external side effect rather than anything the UI renders.

The client's reminder block also carries the email preferences:

```js
reminders: {
  enabled, time, browserNotifications, lastShownDate,  // in-app
  emailEnabled, emailTime                              // email (opt-in)
}
```

The recipient address is the profile email in the Profile card, so there is one place to change it.

### Server data model

The Mongo schemas mirror the client model, plus the reminder plumbing:

| Model | Purpose |
| --- | --- |
| `User` | `googleId` (sparse-unique), `email` (unique), `name`, `avatar`, `challengeStartDate`, `reminderEnabled`, `reminderTime`, `timezone`, `preferences`. Indexed on `reminderEnabled` for the job |
| `Habit` | `clientId` (unique per user), `name`, `description`, `icon`, `frequency`, `scheduledDays`, `archived` |
| `HabitCompletion` | `userId`, `habitId`, `date`, `completedAt`, **unique on `{ userId, habitId, date }`** |
| `Challenge` | `startDate`, `duration` (75). Progress is never stored |
| `Reward` | `clientId`, `title`, `description`, `milestone`, `claimed`, `claimedAt` |
| `Achievement` | `milestone`, `unlockedAt`, **unique on `{ userId, milestone }`** |
| `ReminderLog` | `channel`, `dateKey`, `status` (`pending`/`sent`/`failed`), `attempts`, `sentAt`, `error`, **unique on `{ userId, channel, dateKey }`** — the duplicate guard |

Two schemas deliberately differ from the client's field names, and the mapper reconciles both:

- **Schedules** are stored as day names (`["monday", "wednesday"]`) because they are readable and cannot be misread as 0-based. The client and the streak engine work in 1-based numbers, so `presentHabit` derives `customDays`. The engine itself was not touched.
- **Rewards** are stored as `title` per the data model and presented as `name`, which is what the existing UI already uses.

`clientId` is what the browser already called the habit. Storing it makes both the import and the ongoing sync idempotent: re-sending the same habit upserts onto one row instead of duplicating it.

Date keys are local-calendar strings, which keeps persisted data readable and avoids time-of-day and timezone drift.

On first launch the app seeds four sample habits and stamps today as the challenge start. Later loads use existing data and never reseed over it. A settings object written by an older version is normalised field by field rather than discarded.

---

## Streak Logic

`getCurrentStreak` begins at the reference date. If that day is scheduled but incomplete it steps back one day first, then walks backwards, counting only scheduled days and stopping at the first scheduled miss. An unfinished today therefore still shows yesterday's run.

`getBestStreak` keeps only completions that fall on scheduled dates, sorts them, and for each one walks back to the previous *scheduled* date. If that date is the previous completion, the run extends; otherwise it resets.

That last detail is what makes weekday habits behave correctly:

```
Workout (weekdays)   Mon ✓ Tue ✓ Wed ✓ Thu ✓ Fri ✓  Sat —  Sun —  Mon ✓
best streak = 6      weekends are skipped, not counted as breaks

Drink Water (daily)  Mon ✓ Tue ✓ Wed ✓ Thu ✗ Fri ✓
best streak = 3      the missed Thursday breaks the run
```

---

## Debugging

| Symptom | Cause and fix |
| --- | --- |
| Habits look reset | Storage is per-origin. Check you are on the same host and port, and that browser storage is not blocked. |
| Want a clean slate | Settings → *Your data* → **Reset all data**, or clear `habit-tracker-habits` and `habit-tracker-settings` in DevTools → Application → Local Storage. |
| A habit is missing from Home | It is archived, or it is not scheduled today. Check the schedule strip on the habit row, and the Manage tab's filter. |
| Streak looks wrong | Confirm the habit's schedule first. A weekday habit ignores weekends by design; a daily one does not. |
| `npm run dev` fails | Run `npm install` first and check the Node version. |
| Build fails after dependency changes | Delete `node_modules` and `package-lock.json`, then `npm install`. |
| Fonts look different | Typography is loaded from Google Fonts. Offline, the system font stack is used and nothing breaks. |
| The reminder panel did not appear | It shows once per day, only when at least one habit is scheduled today and still unlogged. Check the habit's schedule strip, and Settings → Daily Reminders. |
| Reminders stopped appearing at all | Settings → Daily Reminders → **Daily reminders** is off. |
| A habit is missing from the checklist | It is archived, already logged today, or not scheduled today (a weekday habit at the weekend, or an unselected custom day). |
| Browser notifications do nothing | They only fire while Daymark is open in a tab, and only after you click **Allow notifications**. A blocked permission cannot be re-prompted by the page — re-enable it in the browser's site settings. |
| Want the reminder panel again today | Clear `habit-tracker-reminder-log` in DevTools → Application → Local Storage, and remove `lastShownDate` from `habit-tracker-settings`. |
| Email says "isn't configured yet" | The `EMAIL_*` variables are not set on the **server** (not the browser). The message names exactly which are missing. See [Setting up email](#setting-up-email-gmail-example). |
| "Send test email" is greyed out | Either email is unconfigured or no send-to address is set. The tooltip says which. |
| Test email fails with `ECONNREFUSED` | Wrong `EMAIL_HOST`/`EMAIL_PORT`, or no SMTP server is listening. For local work, run Mailpit or MailHog. |
| Gmail rejects the login | A normal account password will not work. Create an App Password and use that as `EMAIL_PASSWORD`. |
| No email arrived, but nothing errored | The job skips users with nothing pending. Look for `Reminder job: …` in the server log; `/api/reminders/run` with `{"force":true,"dryRun":true}` reports what it would do. |
| Same person emailed twice in a day | They should not be — `ReminderLog` has a unique index on `{ userId, channel, dateKey }`. Check for a stale `pending` row from a crashed run. |
| A reminder arrived hours late | The window is three hours after the configured time; past that it is skipped rather than sent late. |
| "Backend not reachable" on the login screen | The API is not running. Start it with `npm run server`, or choose **Continue without an account**. |
| "Backend not configured" | Sign-in needs `MONGODB_URI` and `SESSION_SECRET` on the server. The login screen names what is missing. |
| Sign-in fails with a 401 loop | The session cookie is not surviving. Check `CLIENT_URL` matches the frontend origin and that the API is reached through the Vite proxy rather than a different host. |
| Signed out after every restart | `SESSION_SECRET` is unset, so a throwaway secret is generated per boot. Set it in `.env`. |
| "Changes are not being saved to your account" | The bootstrap load failed, so syncing is deliberately disabled rather than risk overwriting the account. Reload to retry. |
| A signed-in user sees local data instead of their account | That is the failed-load state above; the app shows local data but will not write it to the account. |
| Server logs "MongoDB unavailable" | `MONGODB_URI` is missing or unreachable. The API still serves `/api/health`, and the frontend falls back to local storage. |

---

## Known Limitations

**Verified working.** Sign-in, sessions, the account data model, per-user isolation, habit and completion persistence, rewards, achievements, derived challenge progress, the reminder job reading from the database, and the import of browser-local data have all been exercised end to end against a real MongoDB over real HTTP, and the signed-in flow has been driven in a real browser.

**Not verified, because the credentials or services are not available here.**

- **Google sign-in.** The full flow is implemented — state cookie, code exchange, profile fetch, upsert by email, session issue — and everything around it is tested. The round trip to Google itself has never been made from this environment. Sign-in is fully exercisable through the developer route on a local database.
- **Email delivery.** Everything up to and including the SMTP connection is tested, including a real send against an unreachable host. No email has reached a real inbox from here.
- **A live MongoDB Atlas cluster.** The integration suite uses a real `mongod`, but one started locally by `mongodb-memory-server`, not an Atlas deployment.

**Deliberate scope limits.**

- **Sync replaces rather than merges.** `POST /api/sync` upserts the whole account from the client's state and removes habits the client no longer has. Safe for one device at a time; two devices editing concurrently would have the last writer win. A per-entity merge protocol is the natural next step.
- **Per-user timezone scheduling.** One server-wide `REMINDER_TIMEZONE` drives the job. The `User` model carries a `timezone` field and the job already prefers it when set, so the account layer can populate it without a migration.
- **Browser notifications only fire while the app is open.** There is no push server and no service worker, so a notification cannot reach a closed tab or a locked phone. The Settings panel says so rather than implying otherwise. The in-app reminder panel and the Home card need no permission and always work.
- **Email goes out over SMTP only.** The provider is isolated to a single function, so a transactional API (Resend, Postmark, SES) is a small change, but only the SMTP path exists today.
- **Google Health is not implemented.** The Settings panel reports "Not connected" truthfully; steps, distance, calories and exercise are not fetched.
- **No account deletion or export.** There is no self-service way to remove an account or take your data out.
- **Theme covers the app's own surfaces.** Light and dark are both real, driven by CSS custom properties; it is not a full design-system theming layer.

**Operational.**

- **`localStorage` is still the store when signed out.** That is intentional — the app must work with no backend — but it means clearing site data loses anything not yet imported into an account.
- **The integration suite needs network access on first run.** `tests/api.integration.test.js` fetches a real `mongod` binary. Without it, that one file cannot start; the other 133 tests are unaffected.
- **No component or end-to-end test framework.** The unit and integration suites cover logic and the API thoroughly, but UI behaviour is verified by scripted browser checks rather than a component test runner.

---

## Future Improvements

Account deletion and data export, a per-entity merge protocol so two devices can edit one account safely, per-user timezones from the account's own setting, real background reminders (which need a push server and a service worker), an editable challenge duration, and the Google Health sync behind the existing service boundary.
