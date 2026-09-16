# Engineering Reasoning

## Requirements Derived from the Problem

The story implies a daily dashboard, multiple habits, different schedules, one-tap completion, current and best streak visibility, search, and reversible removal. The phrase "not gone forever" was interpreted as archive. The implementation is generic rather than naming or hard-coding behavior for Ananya.

## Assumptions

- A day is the user's local calendar day, not a UTC timestamp.
- A weekday means Monday through Friday.
- Missing a scheduled day breaks a streak; an unscheduled weekend does not.
- The challenge starts on first app setup because no start date is supplied.
- There is one challenge and one local browser user in this MVP.

## MVP Prioritization

The implementation prioritizes the complete daily loop: see today's relevant habits, check them off, inspect streaks, and manage the list. Add/edit, search, archive, persistence, and challenge progress were included because each is explicit in the brief. Historical dates, milestone achievements, rewards, and lightweight analytics were added as focused extensions. Accounts, sync, notifications, configurable recurrence, and a chart dependency were left out to stay within the 2.5-hour constraint.

## Architecture

This is a single React view with small utility boundaries. `App.jsx` owns UI state and composes the dashboard, habit cards, and habit/reward form modals. The Today section can switch to any prior local date. Analytics derive 7-day and 30-day metrics and a CSS heatmap directly from stored completions. `dates.js` owns local date conversion, `streaks.js` owns schedule-aware calculations, and `storage.js` owns serialization and malformed-data fallback. CSS is local and responsive rather than introducing a UI framework.

## Data Model

Each habit contains `id`, `name`, `description`, `icon`, `frequency` (`daily` or `weekdays`), `createdAt`, `archived`, and a list of completion keys. Settings contain `challengeStart`, an `achievements` array of reached milestone numbers, and a `rewards` array. Rewards contain an id, name, streak milestone, and claimed state. Completion keys are strings in `YYYY-MM-DD` form, which makes persisted data readable and avoids time-of-day ambiguity.

## Streak Algorithm

`getCurrentStreak` starts today. If today is scheduled but incomplete, it moves back one calendar day, then walks backward. It increments only for scheduled dates that appear in the completion set and stops at the first missing scheduled date. This makes an incomplete today show the still-valid previous run, while a missed earlier scheduled day returns zero.

`getBestStreak` filters out unscheduled completions, sorts the remaining keys, and scans them in order. For each completion it finds the previous scheduled date, so a Friday-to-Monday weekday completion extends one run. A missing scheduled day resets the run. No history returns zero. Rewards use the maximum best streak among active habits, so they unlock from actual streak data rather than challenge-day count.

## Weekday Handling

JavaScript's local `Date#getDay()` identifies Sunday as 0 and Saturday as 6. Weekday habits are scheduled only when the value is 1 through 5. The current-streak walk still visits calendar dates but ignores unscheduled weekend dates, so weekends cannot break the run.

## Archive Design

Archive is a boolean state change, not deletion. Archived habits disappear from Today and the active list, but remain searchable in the archived section with their completions and streak history. Unarchive restores the same record. Archiving asks for confirmation; unarchiving is immediate.

## Historical View

The date input is capped at today and changes the dashboard's scheduled habit list. Completion buttons on prior dates update the same stored completion arrays; no historical values are generated. The selected date remains UI state and resets to today on reload.

## Achievements

After a completion is added, the next habit collection is evaluated for the first completion and the configured 3, 7, 14, 21, 30, 50, and 75-day milestones. Newly reached numbers are appended to settings and a celebration modal is shown. Already recorded numbers are filtered out, preventing repeated celebrations on render or reload. Unchecking a completion does not delete a previously earned achievement.

## Rewards

Rewards are user-created records with a streak threshold. Their locked/unlocked state is derived during rendering from the highest current best streak in active habits. An unlocked reward can be claimed, and claimed state is persisted. Removing a reward filters it from settings rather than changing habit history.

## localStorage Decision

The brief explicitly rules out a backend and requires offline operation, so browser `localStorage` is the appropriate minimal persistence layer. Separate keys keep habits and challenge settings, achievements, and rewards simple. Reads and writes are wrapped in `try/catch`; malformed arrays and invalid settings are normalized or fall back safely. React persistence effects use block bodies so the boolean result of a save is not accidentally returned as an effect cleanup function. This is intentionally not multi-device storage.

## Edge Cases

The UI handles no habits scheduled today, no active search results, empty descriptions, invalid blank names, no completion history, archived-only results, prior dates with no scheduled habits, future challenge start dates, and malformed storage. Challenge day is clamped between 1 and 75 and a future start is shown as not started. New habits begin with an empty completion list. Local date construction avoids UTC date shifts.

## Testing

The available executable checks are the repository's `npm run lint` and `npm run build`, plus direct Node examples for daily current streaks and weekday Friday-to-Monday behavior with weekend data ignored. A dedicated test runner was not added because it was not already part of the small dependency set. Browser startup was also smoke-tested through the Vite development server and an HTTP request.

## Trade-offs

A single component keeps the assessment implementation fast, but it means `App.jsx` is denser than a larger production codebase would be. `localStorage` is reliable for a single offline browser but has no synchronization or recovery across devices. The challenge start date is persisted but not editable in the current UI. Analytics are intentionally lightweight: the all-time metric is a count of unique recorded completion dates, while period percentages use scheduled-day denominators. The typography uses a Google Fonts stylesheet for visual polish; all behavior remains local and falls back when the font cannot load.

## Future Improvements

Add automated utility tests, a start-date control, a completion calendar, richer recurrence rules, export/import, and a service worker cache for fully self-contained offline assets.
