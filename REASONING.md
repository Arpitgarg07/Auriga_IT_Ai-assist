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

The implementation prioritizes the complete daily loop: see today's relevant habits, check them off, inspect streaks, and manage the list. Add/edit, search, archive, persistence, and challenge progress were included because each is explicit in the brief. Analytics, accounts, sync, notifications, and configurable recurrence were left out to stay within the 2.5-hour constraint.

## Architecture

This is a single React view with small utility boundaries. `App.jsx` owns UI state and composes the dashboard, habit card, and form modal. `dates.js` owns local date conversion. `streaks.js` owns schedule-aware calculations. `storage.js` owns serialization and malformed-data fallback. CSS is local and responsive rather than introducing a UI framework.

## Data Model

Each habit contains `id`, `name`, `description`, `icon`, `frequency` (`daily` or `weekdays`), `createdAt`, `archived`, and a list of completion keys. Challenge settings contain `challengeStart`. Completion keys are strings in `YYYY-MM-DD` form, which makes persisted data readable and avoids time-of-day ambiguity.

## Streak Algorithm

`getCurrentStreak` starts today. If today is scheduled but incomplete, it moves back one calendar day, then walks backward. It increments only for scheduled dates that appear in the completion set and stops at the first missing scheduled date. This makes an incomplete today show the still-valid previous run, while a missed earlier scheduled day returns zero.

`getBestStreak` sorts all recorded completion keys and scans them in order. For each completion, it finds the previous scheduled date, so a Friday-to-Monday completion extends one run for weekday habits. Any missing scheduled day resets the run. No history returns zero.

## Weekday Handling

JavaScript's local `Date#getDay()` identifies Sunday as 0 and Saturday as 6. Weekday habits are scheduled only when the value is 1 through 5. The current-streak walk still visits calendar dates but ignores unscheduled weekend dates, so weekends cannot break the run.

## Archive Design

Archive is a boolean state change, not deletion. Archived habits disappear from Today and the active list, but remain searchable in the archived section with their completions and streak history. Unarchive restores the same record. Archiving asks for confirmation; unarchiving is immediate.

## localStorage Decision

The brief explicitly rules out a backend and requires offline operation, so browser `localStorage` is the appropriate minimal persistence layer. Separate keys keep habits and challenge settings simple. Reads and writes are wrapped in `try/catch`; malformed arrays or settings fall back safely. This is intentionally not multi-device storage.

## Edge Cases

The UI handles no habits scheduled today, no active search results, empty descriptions, invalid blank names, no completion history, archived-only results, and malformed storage. Challenge day is clamped between 1 and 75. New habits begin with an empty completion list. Local date construction avoids UTC date shifts.

## Testing

The available executable checks are `npm run lint` and `npm run build`; both pass. The streak utilities are pure and reusable so daily, weekday, weekend-gap, missing-day, today-incomplete, and empty-history examples can be exercised directly in a future unit-test suite. A dedicated test runner was not added because it was not already part of the small dependency set.

## Trade-offs

A single component keeps the assessment implementation fast, but it means `App.jsx` is denser than a larger production codebase would be. `localStorage` is reliable for a single offline browser but has no synchronization or recovery across devices. The challenge start date is persisted but not editable in the current UI. The typography uses a Google Fonts stylesheet for visual polish; all behavior remains local and falls back when the font cannot load.

## Future Improvements

Add automated utility tests, a start-date control, a completion calendar, richer recurrence rules, export/import, and a service worker cache for fully self-contained offline assets.
