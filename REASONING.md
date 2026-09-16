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
  preferences: { motivationalMessages, celebrationEffects, theme }
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

- `npm install` — 255 packages (the dependency tree was missing on handoff)
- `npm run lint` — clean
- `npm run build` — success, ~245 kB JS / ~76 kB gzip
- Node harness for the streak engine — 11/11 edge cases pass
- Node harness for `analytics.js` — period stats, per-habit reports, creation-floored windows, weekday bucketing, week-over-week, longest run, reward ordering and reward state transitions

Known limitations, stated plainly:

- The Express server has never been run against a live MongoDB Atlas cluster, because no URI exists in this repository and none was fabricated. Its routes are a documented boundary, not a verified deployment.
- Google OAuth and the Google Health API are not implemented. The UI reports the disconnected state truthfully.
- There is no automated test runner in the repo; the harnesses above were run directly with Node.
