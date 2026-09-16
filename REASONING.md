# Engineering Reasoning

## How the Problem Statement Was Interpreted

The brief is a story, not a specification: Ananya is 75 days into a self-improvement challenge with four named habits, some daily and some weekday-only, and she wants to see today's list, tick things off, watch streaks, and keep a growing list manageable.

Every concrete requirement in the story was treated as a clue about a *general* product rather than a description of one person's data:

| Clue in the story | Requirement derived |
| --- | --- |
| "75-day challenge" | A bounded challenge with a start date, day counter and progress bar |
| "some every day, some only on weekdays" | Per-habit schedules: daily, weekdays, and custom day sets |
| "every morning she wants to see today's habits" | A home screen that answers only "what is due today?" |
| "complete them one by one" | One-tap completion, reversible |
| "current streak" and "best-ever streak" | Two distinct streak numbers, both schedule-aware |
| "her habit list becomes long" | Search, filtering and sorting |
| "archive instead of permanent deletion" | Soft delete that preserves history |
| "historical data", "day-wise management" | A date picker that reads and backfills real past dates |
| "analytics", "motivation", "rewards", "streak milestones" | Analytics tab, rotating encouragement, a reward ledger, milestone badges |
| "built for ANY user, not just Ananya" | No hard-coded name, habits, or four-habit assumption |

The most important interpretation: **the story never asks for a specific person's data.** So the product stores no name, habit or completion that the user did not create, and the greeting is driven by a configurable profile rather than the word "Ananya".

## Assumptions

- A day is the user's **local calendar day**, not a UTC timestamp. Date keys are `YYYY-MM-DD` strings built from local `getFullYear/getMonth/getDate`.
- **Weekday means Monday–Friday.** Saturday and Sunday are *unscheduled* for weekday habits, not failures.
- Missing a **scheduled** day breaks a streak. Skipping an unscheduled day does not.
- The challenge is 75 days and starts on the date the user sets. With no explicit start, first launch stamps today.
- One local profile per browser. There is no account system in this build.
- A habit cannot miss days before it existed, so history windows are floored at `max(period start, habit.createdAt)`.

## Architecture

React 19 + Vite, plain JavaScript, no state library and no UI kit. The dependency list is deliberately tiny: `react`, `react-dom`, `lucide-react` for icons, and an **optional** Express/Mongoose server that the frontend never requires.

```
src/
  App.jsx                  shell: state, tab routing, celebrations, persistence
  App.css                  design tokens, layout, components, responsive rules
  index.css                global reset, focus treatment, colour scheme
  components/
    HomeView.jsx           greeting, today's board, streaks, badges, next reward
    AnalyticsView.jsx      filters, charts, date strip, habit table, insights
    ManageView.jsx         add/edit/archive/restore, search, filter, sort, history
    SettingsView.jsx       profile, challenge, preferences, rewards, integrations
    HabitCard.jsx          one habit row, reused across Home and Manage
    HabitForm.jsx          create/edit modal with icon and schedule pickers
    RewardForm.jsx         create/edit reward modal
    RewardsPanel.jsx       reward ledger with locked/unlocked/claimed states
    Celebration.jsx        overlay for day-complete and milestone moments
    DayChips.jsx           read-only Mon–Sun schedule strip
    HabitIcon.jsx          name → icon resolution with a safe fallback
  utils/
    dates.js               local date keys and arithmetic
    streaks.js             schedule-aware streak engine (unchanged from MVP)
    storage.js             localStorage read/write/validate/clear
    analytics.js           period stats, per-habit reports, insights
    constants.js           weekdays, milestones, schedule vocabulary
    motivation.js          time-based greeting and message rotation
server/
  src/models/              Mongoose schemas mirroring the client data model
  src/services/            Google Health boundary
  src/server.js            optional API (health, auth stub, fitness status)
```

The reason for splitting the single-file MVP into components is reuse: `HabitCard` and `DayChips` are now rendered by two different tabs, and the four views each have genuinely different state. The data model and the streak engine were left exactly as they were.

## Data Model

Habits are stored under `habit-tracker-habits`:

```js
{
  id, name, description, icon,
  frequency: 'daily' | 'weekdays' | 'custom',
  customDays: [1..7],        // 1 = Monday … 7 = Sunday
  createdAt, archived: false,
  completions: ['2026-09-16', ...]
}
```

Challenge, achievements, rewards, profile and preferences share `habit-tracker-settings`:

```js
{
  challengeStart: '2026-09-16',
  achievements: [1, 3, 7],                       // reached milestone numbers
  rewards: [{ id, name, description, milestone, claimed }],
  profile: { name, email },
  preferences: { motivationalMessages, celebrationEffects, theme },
  reminders: { enabled, time, browserNotifications, lastShownDate }
}
```

Two deliberate choices:

1. **Completions live on the habit**, as an array of date keys. It keeps a habit self-contained for streak maths and makes the persisted JSON human-readable.
2. **Sunday is `7`, not `0`.** `Date#getDay()` returns `0` for Sunday, which would make a 1-based "which days are selected" UI confusing. `customDays` is normalised to 1-based at the boundary.

## The Streak Algorithm (unchanged, and why)

`src/utils/streaks.js` was verified working before this session and was **not modified**. I re-verified it independently with a Node harness covering eleven edge cases — weekday Fri→Mon continuity, weekend records not inflating a weekday best, a missed Thursday breaking a daily streak, the "today not yet done" grace period, and custom Sunday scheduling. All eleven passed.

`getCurrentStreak` starts at today. If today is scheduled but incomplete it steps back one day first, then walks backwards, counting only scheduled days and stopping at the first scheduled miss. That produces the behaviour users expect: an unfinished today still shows yesterday's run.

`getBestStreak` filters completions down to scheduled dates only, sorts them, and for each one walks back to the *previous scheduled date*. If the previous **scheduled** date is the previous completion, the run extends; otherwise it resets. This single detail is what makes Friday→Monday count as consecutive for a weekday habit, and what stops a stray Saturday record from inflating a weekday streak.

One change *was* made around it: the UI previously called `getCurrentStreak(habit)` with no date, so it silently used wall-clock time. It now receives the same `date` the rest of the screen is rendering, which keeps the number consistent with the list beside it.

A second, more serious defect was found and fixed while reviewing the inherited code. The Manage tab can point the app at a past date, and the completion handler read that shared `date` state — but the Home board always *displays* today. So after visiting a historical date in Manage and returning Home, ticking a habit on the Home screen would write the completion to the **past** date. The handler now receives the target date explicitly from whichever view invoked it, so Home always writes to today and Manage always writes to the day it is showing. Celebration logic uses the same explicit date, which also stops a backfilled past day from claiming "today is complete".

## Daily vs Weekday Logic

Scheduling is one predicate, `isHabitScheduledOnDate(habit, date)`, used by the streak engine, the home board, the analytics denominators and the historical view. Because there is exactly one implementation, a habit cannot be "due" in one place and not another:

- `daily` → always
- `weekdays` → `getDay()` between 1 and 5
- `custom` → membership in `customDays`

## Archive vs Deletion

Archive flips a boolean. Nothing is removed. Archived habits disappear from the home board and from completion counting, but keep their entire completion array, so restoring one restores its streaks exactly as they were. Archiving asks for confirmation; restoring does not. Rewards and milestones are computed from **active** habits only, so an archived habit cannot silently unlock new rewards.

## The Reward System

A reward is a user-authored record with a streak threshold: "buy a new dress at 14 days". Its state is *derived*, never stored, from the best streak across active habits:

- `locked` — `milestone > bestStreak`
- `unlocked` — `milestone <= bestStreak`, not yet claimed
- `claimed` — the user has taken it

Only `claimed` is persisted, because it is the only fact that cannot be recomputed. Rewards surface in three places: a "next reward" card on Home with real progress, the badge strip where a milestone has an attached reward, and full management in Settings.

**This was the largest defect inherited from the previous session.** `RewardForm`, `saveReward` and the reward modal render all existed, and `REASONING.md` described the feature as working — but nothing in the application ever called `setModal({ type: 'reward' })`. The reward list was written to storage and never read back. It is now wired end to end.

## Celebrations

Three tiers, each idempotent:

1. **Small win** — a short toast on a single check-off.
2. **Day complete** — fires when the last habit scheduled *for today* is completed. Guarded on `date === todayKey` so backfilling a past date does not claim "today is complete".
3. **Milestone** — 1, 3, 7, 14, 21, 30, 50, 75.

Milestones are recorded into `settings.achievements` and filtered against that list before firing, so they never repeat on re-render or reload. Unchecking a completion does **not** revoke an earned milestone — it happened. Confetti is hand-rolled from ~50 absolutely-positioned spans with deterministic pseudo-random offsets (a sine-hash of the piece index), so a re-render never reshuffles mid-animation, and no animation dependency was added.

## Morning Reminders

The feature asks the app to notice what is *still outstanding* and say so warmly without becoming a nag. Three decisions carry it.

**One source of truth for "today".** The brief lists four steps — today's date, which habits are scheduled, which are logged, which remain. Rather than re-deriving those separately in the reminder, the Home board and the modal, `reminders.js` resolves them once in `getTodaysHabits`, and `getMorningReminder` layers counts, copy and streak context on top. Scheduling is still delegated to the untouched `isHabitScheduledOnDate`, so there is exactly one definition of "due today" in the codebase. Archived habits are filtered inside that function, which is what guarantees they can never surface in a reminder.

**Copy that cannot lie.** The brief is unusually specific: *"Only show this type of message when the habit actually has a current streak. Do not use misleading language if completing the habit cannot affect the streak."* That rules out the obvious implementation, which is to take the user's maximum streak and write "your streak is waiting" whenever anything is pending.

The trap is subtle. `getCurrentStreak` deliberately steps back past an incomplete today, so a **pending** habit reporting a non-zero streak means the run is alive through its last scheduled day, and today's check-off is exactly what continues it — so "don't let today break it" is true. But consider a user with a 10-day streak on *Water* who has already logged Water today, plus one unlogged habit *Read* sitting at zero. Their maximum streak is 10, yet nothing pending can break it. Naming that streak would be a lie, and it is the exact case a naive implementation gets wrong.

So the claim is gated on the maximum current streak **among pending habits only**, and the message names that specific habit. When no pending habit has a live run, the copy falls back to plain encouragement that mentions no streak at all. `tests/reminders.test.js` pins this down with the already-logged-streak case and with a streak that was already broken before today.

**Once per day, derived rather than stored.** "First open of a new day → show the reminder; later visits → show it compactly" needs a durable marker plus a way not to re-fire on navigation. The first attempt used an effect that called `setState`, which the React hooks lint rule correctly rejects — calling `setState` synchronously in an effect causes cascading renders. Rather than suppress the rule, the design changed to something better: modal visibility is *derived during render* from `lastShownDate !== todayKey`, and the marker is written from the dismiss handler. That makes "once per day" a property of the data rather than a timing race — a re-render, a tab switch and a page reload all leave the marker in place, while a genuine midnight rollover clears the comparison and shows it again. The `todayKey` interval that already existed for date honesty now also ticks a clock, so a reminder time that passes while the tab sits open is still noticed. The same reasoning moved the browser-notification marker out of React state entirely and into its own storage key: it records an external side effect, not anything the UI renders.

**Notifications, honestly bounded.** A page cannot deliver a notification to a closed tab without a push server and a service worker, and this project has neither. So the implementation does only the part that is real: permission is requested solely from an explicit click, a denial is reported rather than re-prompted (browsers refuse to re-prompt anyway), and a notification is raised only while the app is open, past the reminder time, with habits outstanding, once per day. The Settings panel states the limitation in plain language rather than implying background delivery works. The in-app panel and the Home card need no permission and always work.

## Email Reminders

The in-app reminder only works when the app is open. An email reminder has to work when it is not, which changes where the logic has to live and forces a decision the rest of this project has been able to avoid.

**Why the sending is server-side.** Two reasons, and only one of them is about secrecy. An SMTP password shipped to a browser is visible to anyone who opens devtools, so credentials must stay on the server. But more fundamentally, a page that is closed cannot send anything — a reminder that only fires while the tab is open is not an email reminder at all. So the render and the send both live on the server, behind `server/src/services/emailService.js`, with the provider isolated to a single `createTransport` function so swapping SMTP for a transactional API means rewriting one function.

**The data-ownership problem, and how it is resolved.** This is the honest tension in the feature. The job is specified to "identify the user, get all active habits, and check which are scheduled for today" — but at the time of writing there is no account system (Google OAuth is a stub, `attachUser` returns null, every data route answers 401) and the React app keeps everything in `localStorage`. A scheduler has nothing to read.

Rather than invent an account layer that would not work, the server was given two ways to obtain the same data, both feeding one computation:

- **From MongoDB** — the real deployment. `loadHabitsForUser` joins `Habit` and `HabitCompletion` back into the plain habit shape and hands it to the shared logic. This is the path the scheduled job takes once accounts exist.
- **From a client snapshot** — the demo path. The browser posts its own habits to `/api/reminders/preview` or `/test`, and the server runs exactly the same computation over them.

The second path is not a mock. It uses the real template, the real exclusion rules and the real streak engine; it simply skips the database. That is what makes the feature demonstrable today — with no account, no MongoDB and no SMTP credentials — and it is what the assessment's "safe development/testing mechanism" clause is for.

**One source of truth, literally.** The brief says not to duplicate the streak logic and to use the same source of truth as the dashboard. The strongest available answer is that the server does not have its own copy at all: `reminderService.js` imports `pendingWithStreaks`, `streakAtRisk` and `getTodaysHabits` from `src/utils/reminders.js`, which in turn imports the untouched `streaks.js`. There is exactly one implementation of "which habits are still outstanding today", and it is the one the dashboard renders. The email cannot disagree with the app, because it is running the same function.

**Duplicate protection.** "The same user must not receive multiple reminder emails for the same date" is enforced by the database, not by a conditional. `ReminderLog` has a unique index on `{ userId, channel, dateKey }`, and the job claims a row with `findOneAndUpdate({ status: { $ne: 'sent' } }, …, { upsert: true })`. If a `sent` row already exists, the filter does not match and the upsert collides with the unique index — the claim returns null and nothing is sent. Two schedulers racing, a retried request and a restart mid-send all resolve the same way. The status field is deliberately tri-state: a failure writes `failed`, never `sent`, so the brief's "do not mark the reminder as sent if the email failed" is satisfied and a later run can retry.

**Scheduling: polling, not cron.** A cron entry pinned to 08:00 would be wrong for every user whose reminder time is not 08:00, and fragile across restarts. The scheduler instead wakes every `REMINDER_POLL_MINUTES` and lets each user's own configured time decide, which the per-day `ReminderLog` makes free. It also enforces a three-hour window: a server that was down at 08:00 should not deliver a "good morning" email at 23:00.

**Timezone, and the limitation stated plainly.** There is no timezone field on a user, so per-user scheduling is not implemented. One server-wide `REMINDER_TIMEZONE` is used, derived through `Intl.DateTimeFormat` rather than manual offset arithmetic so DST stays correct. This matters more than it looks: in `Asia/Kolkata`, 20:00 UTC is already the next calendar day, so a UTC-only scheduler would compute the wrong date and email the wrong day's habits. The chosen zone is documented in `.env.example`, surfaced in the Settings UI, and named as a limitation in the README. The `User` model already carries a `timezone` field so the account layer can populate it later without a migration.

**Access control.** `/status` and `/preview` are safe to expose: they return booleans, variable *names* and rendered markup, and touch neither credentials nor the database. `/test` and `/run` can send mail and read the user table, so they are gated — with `REMINDER_ADMIN_TOKEN` set, a matching header is required; without it, production returns 404 so the endpoints are not even advertised, and development allows them for local work. That is deliberately a different posture from "trust the client", and it was verified in all three states.

**Email-client constraints.** The template is table-based with inline styles, no external CSS, no flexbox and no grid, because Outlook, Gmail and Apple Mail do not agree on modern CSS. The progress bar is two table cells rather than a nested div for the same reason. Every piece of user data that reaches the body — display name, habit name, challenge start — passes through `escapeHtml` first, so a habit named `<img src=x onerror=…>` is rendered as text. That is a real concern here in a way it is not in the React app, because the output is a document rather than a component tree.

**Failure containment.** A mail server that is down, rejecting credentials or timing out must not take anything else with it. `sendEmail` catches everything and returns a result object; the job catches per user so one bad account cannot abort a run; the scheduler catches around the whole run; and explicit `connectionTimeout`/`greetingTimeout`/`socketTimeout` values stop a dead host from hanging a request for nodemailer's two-minute default. This was verified against a real refused socket rather than a mock: the send returned `{ sent: false }` in 290 ms with the email still rendered, and the test suite now covers it permanently by spawning a child process against an unreachable port.

## Authentication and Multi-User Data

The reminder job was always specified to "find users with reminders enabled", but until now there were no users — no sign-in, and every habit lived in one browser's local storage. This section covers what it took to make the app genuinely multi-user.

**Sessions without a dependency.** The session is a compact HS256-signed token in an httpOnly cookie, implemented directly on `node:crypto` in `server/src/services/sessionService.js`. A JWT library would have been defensible, but the whole implementation is about forty lines, and every part of it that matters is then visible and testable: the algorithm is pinned rather than read from the token (so `alg: none` cannot be smuggled in), the signature comparison is `timingSafeEqual` after a length check, expiry is enforced on the server, and a tampered payload or signature returns null rather than throwing. The tests cover all of those, including a hand-forged token with a valid-looking payload and the original signature, and a token signed with the wrong secret.

`httpOnly` matters more than it looks: the session is not readable from JavaScript, so an XSS bug cannot exfiltrate it, and there is no token for the frontend to store or accidentally log. `SameSite=Lax` allows the cookie to survive the top-level navigation back from Google while still blocking cross-site POSTs. `Secure` is set in production and deliberately *not* on plain-HTTP localhost, where some browsers would silently drop it and break sign-in for no security gain.

**Google OAuth, written out rather than imported.** The authorization-code flow is about thirty lines of `fetch`: redirect with a random `state` stored in a short-lived cookie, verify that state on return, exchange the code, fetch the profile, upsert the user, set the session. The `state` check is the part that matters — without it, a third party can feed the callback a code that is not ours. The upsert is keyed on **email** rather than `googleId`, so a user who first signed in another way keeps their history when they later link Google.

**Developer sign-in, and why it is safe.** Google credentials do not exist in this environment, and the assessment's own advice is not to spend the time on provider configuration when they are unavailable. Rather than leave the entire account layer undemonstrable, `POST /api/auth/dev` creates a real account in the local database. It is gated twice: it cannot run when `NODE_ENV=production`, and it can be switched off in development with `DEV_LOGIN=off`. It creates a genuine `User` document and sets the same signed cookie Google would — so everything downstream of authentication is the real thing, not a bypass. The login screen says all of this in plain language rather than hiding it.

**Identity comes from the session, never from the request.** There is no `userId` parameter anywhere in the API. `attachUser` resolves the cookie into `request.user` and nothing else assigns it; every handler then scopes by `request.user._id`. Three defences back this up:

1. Every data route is mounted behind `requireAuth` in a single place in `app.js`, so a new router is protected by default rather than by remembering.
2. Ownership is re-checked on the specific row for any id that arrives in a URL — `Habit.findOne({ _id: id, userId })`, never `findById(id)`. A test signs in as one user and tries to read, edit, archive, delete and complete another user's habit by id; all five return 404 and the row is provably unchanged.
3. `tests/serverGuards.test.js` scans the route sources and fails if any handler reads an id from the body, the query string or the params as an identity, or if a user-owned router stops scoping by the session. That catches the mistake at the moment a route is written, which a behavioural test can only do for the routes it happens to call.

**The storage-versus-engine boundary.** The data model stores schedules as day names — `["monday", "wednesday"]` — because they are readable and cannot be misread as 0-based. The verified streak engine works in 1-based numbers. `server/src/services/habitMapper.js` is the only place the two meet, so the engine needed no change at all. This is not a theoretical concern: while wiring the reminder job to the new schema I found `loadHabitsForUser` still reading the old `customDays` field, which would have silently made every custom-scheduled habit never come due. It now calls the same `presentHabit` mapper the API uses, so the job sees exactly the shape the browser sees, and a test asserts a Mon/Wed habit survives the database round trip.

**One idempotent sync instead of a delta protocol.** Both the one-off import of a browser's local data and the ongoing writes while signed in go through `POST /api/sync`. Every habit and reward carries the `clientId` the browser already assigned, and the endpoint upserts on it, then reconciles completions to match the set it was given. Sending the same payload twice changes nothing the second time. A diff protocol would have been more efficient and considerably easier to get wrong; for data this small, idempotence is worth more than bandwidth. Deletion is handled by absence — a habit the client no longer sends, and did not merely archive, is removed with its history.

**Hydration keyed to the account, not a boolean.** The app syncs its state back to the server on change, which needs a guard so it never writes before it has read. The first version used a `hydrated` boolean, and the React hooks lint rule flagged its effect. Fixing it properly was worthwhile rather than suppressing: a bare boolean stays `true` across a sign-out and sign-in, so for the window before the new account's data arrived, the previous account's habits were still in state and could have been pushed into the new account. `hydrated` is now derived — `hydratedUserId === account.user.id` — which makes that window impossible rather than unlikely.

**What is verified, and what is not.** `tests/api.integration.test.js` runs the real Express app against a real `mongod` (via `mongodb-memory-server`) over real HTTP with real session cookies — 34 tests covering: server startup, database connection, the sign-in flow, session forgery, every protected route returning 401 anonymously, cross-user isolation for reads, writes, completions, rewards and analytics, habit CRUD, completion idempotence and persistence, reward claiming with `claimedAt`, achievement uniqueness, derived challenge progress, the reminder job reading pending habits from the database, archived/completed/weekend/custom exclusion, duplicate-reminder prevention including a concurrent claim, retry after a failed send, sync idempotence, and analytics scoped to one user. It also asserts that no response body contains a secret.

The signed-in flow was then driven in a real browser against a real database (`npm run dev:demo` plus the Vite dev server): the login screen rendered with Google, developer and local options and the app shell genuinely absent behind it; developer sign-in produced the app; the sidebar and the Settings account card both showed the real account name and email; the "Import your existing data?" banner recognized four browser-local habits in an empty account; importing them produced four habit cards and a reminder listing the same four; and reading the account back over the API confirmed the habits, the completion round trip with `completedAt` and the derived analytics (25% from one completion across four habits) had all persisted server-side.

What it does not cover: an actual Google OAuth round trip, because the exchange with Google itself cannot be exercised from here; and real email delivery, for the same reason. Both are written and their surrounding logic is tested, but neither has been observed end to end.

## Analytics Approach

Everything is derived from stored completion arrays. Nothing is estimated or invented.

- **Windows** — last 7 days, last 30 days, this month, all time. All-time starts at the earliest real signal (earliest habit creation or completion), never at an arbitrary date.
- **Denominators are scheduled days**, not calendar days. A weekday habit is not penalised for weekends.
- **Per-habit report** — completion rate, completed, missed, current and best streak. Missed counts scheduled days with no completion, floored at habit creation.
- **Date strip** — the recent slice of the window, each cell coloured complete / partial / missed / nothing-scheduled. Selecting a day lists exactly which habits were due and which were done.
- **Day-of-week breakdown** — completion rate bucketed by weekday, which is what surfaces "Saturday is your weakest day".
- **Insights** are computed, not templated: strongest and weakest weekday (minimum two samples so a single day cannot define a pattern), most consistent habit, habit needing attention, week-over-week delta, and the longest unbroken calendar run.

An intentional limit: the "All time" completion count is a count of check-offs, while percentages use scheduled-day denominators. Mixing those two would flatter the user, so the labels say which is which.

## Edge Cases Handled

- No habits scheduled today — a real empty state, not a blank panel
- No habits at all, no search results, archived-only results
- A brand-new habit starts with zero scheduled days behind it, so it cannot show a false 0% or fake misses
- Blank habit names and a custom schedule with no days selected both block save
- A future challenge start date reports "Not started" instead of a negative day
- Challenge day is clamped to 1–75
- Habits with no `createdAt` fall back to the window floor rather than the epoch
- Malformed or unreadable storage falls back to seed data; a settings object written by an older build is field-by-field normalised rather than discarded
- `today` is recomputed every minute, so an app left open across midnight rolls over, and a user sitting on "today" follows it
- Streak and analytics walks are bounded by a ten-year guard against pathological data
- Reduced-motion users get confetti suppressed and animations collapsed

## Trade-offs

- **localStorage over a backend.** The app must work offline and with no credentials, and a working product beats an untestable API. The Express/Mongoose layer now has real routes, validation and models for habits, completions, rewards, challenge and achievements — but it is deliberately **not** wired into the UI: nothing in `src/` depends on it. The Google Health panel reports "Not connected" honestly and the app is fully functional without it.
- **Secrets stay out of the repository.** `.env` was not gitignored when this session began, which would have allowed a real connection string to be committed. It is now ignored, and only `.env.example` (placeholders) is tracked. No credential was fabricated at any point.
- **Auth is a stub, and says so.** `attachUser` sets `request.user` to null, so every data route answers `401`. A dev-only `DEVELOPMENT_USER_EMAIL` flag exists for local API work, gated on `NODE_ENV !== 'production'`. This is a documented boundary, not fake authentication.
- **One very large analytics module.** `analytics.js` is pure functions over plain data, which made it testable in isolation from React, but it is the densest file in the project.
- **Derived rather than stored reward state.** Recomputing on render is simpler and cannot drift, at the cost of a `getBestStreak` call per habit per render. Habit counts here are small enough that this is not a bottleneck.
- **Insights are descriptive, not predictive.** They report what the data says. No forecast is shown, because a 75-day challenge rarely has enough history for one to be honest.
- **Theme is a real light/dark switch, driven by CSS custom properties**, rather than a large theming system. Components that were styled before tokens existed were converted where they mattered.

## Verification

Everything below was actually executed, not assumed:

**Frontend**

- `npm install` — dependencies were missing on handoff
- `npm run lint` — clean, 0 errors and 0 warnings
- `npm run build` — success, ~314 kB JS / ~96 kB gzip
- `npm test` — **92 tests, 92 passing** on Node's built-in runner (no test framework added)
- Headless-browser render check — all four views mount, `data-tab` switches correctly, and a scripted click-through confirmed the completion loop: milestone celebration with confetti, then the day-complete celebration, the banner, the gold ring, and that unchecking does not revoke an earned milestone
- Headless-browser check of the email UI — the Settings card renders its toggle, time and address inputs; with email unconfigured it shows "Email service isn't configured yet" naming the exact missing variables and disables the send button; the preview modal opens and receives 7,527 bytes of rendered email HTML in a sandboxed frame

**Backend**

- The API boots with no MongoDB and no SMTP: it logs exactly which variables are missing, keeps the scheduler idle, and serves `/api/health`
- `POST /api/reminders/preview` verified against the running server with a snapshot exercising every exclusion rule: a completed habit, an archived habit and a weekend-only custom habit were all excluded, leaving exactly the three pending ones; the all-complete case returned `skipped: true`
- A weekday habit with 14 calendar days of completions correctly reported a **10**-day streak, because weekends are not scheduled days — the engine's weekend rule showing up in the email
- Guarded endpoints verified in all three states: `/test` and `/run` return 404 in production without a token, 403 with a wrong or absent token when one is configured, and reach the handler with the correct token
- Email failure verified against a **real refused socket**, not a mock: with complete but unreachable SMTP settings, the send returned `{ sent: false }` in 290 ms with the email still rendered, nothing thrown, and the error logged server-side. This is now a permanent test that spawns a child process against an unreachable port

**Bugs this verification caught**, all fixed:

1. `createReminderEmail` accepted `challengeStart` but ignored it when computing the day, so a caller passing only the start date got "Not started". It now derives the day itself.
2. `greetingFor` had an unreachable night branch: midnight–04:59 fell into "Good morning". That is exactly when the morning panel can appear on a day rollover.
3. `motivation.js` shipped a line reading *"Your N-day streak is on the line"* fed by the **app-wide maximum** streak rather than a pending habit's own — the precise misleading pattern the brief forbids. Found by an adversarial review agent; the call site now passes the at-risk streak and the contract is documented and tested.
4. `sendEmail` had no timeouts, so a dead SMTP host would hang a request for nodemailer's two-minute default.

Known limitations, stated plainly:

- The Express server has never been run against a live MongoDB Atlas cluster, because no URI exists in this repository and none was fabricated. Its routes are a documented boundary, not a verified deployment.
- The scheduled email job therefore cannot be observed end to end against real users: it needs accounts to iterate. `/api/reminders/preview` and `/test` exercise the identical pipeline from a habit snapshot instead, which is what was verified.
- No email has been delivered to a real inbox from this environment, because no SMTP credentials exist here. Everything up to and including the SMTP connection was verified; actual delivery was not.
- Google OAuth and the Google Health API are not implemented. The UI reports the disconnected state truthfully.
- Browser notifications only fire while the app is open in a tab; there is no push server or service worker, and the UI says so.
- Per-user timezone scheduling is not implemented; one server-wide zone is used.
- UI behaviour is verified by scripted browser checks, not by a component test framework.
