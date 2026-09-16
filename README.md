# Daymark Habit Tracker

Daymark is a responsive, offline-first habit tracker for a 75-day self-improvement challenge. It helps any user focus on habits scheduled for today, record completions, and protect visibility into current and best streaks.

## Problem Interpretation

The challenge describes a growing collection of habits with different schedules, a need for daily check-offs, streak motivation, search, and a reversible way to remove abandoned habits from the active view. Daymark treats "out of the way" as archive, while keeping completion history intact.

## Features

- Today view showing only habits scheduled for the current local date
- Add and edit habits with a description, icon, and daily or weekday schedule
- Complete or uncomplete today's habit
- Current and best-ever streaks for each active habit
- Search across active and archived habits
- Archive and unarchive without deleting history
- Persisted 75-day challenge day and progress
- Historical day picker using actual stored completion dates
- Milestone celebrations for first completion through 75-day streaks
- Rewards with streak thresholds, locked/unlocked states, and claiming
- 7-day and 30-day analytics with completion rates, misses, habit rates, and activity heatmap
- Seed habits on first launch only
- Responsive layout, accessible labels, disabled invalid submit, confirmation before archive, and empty states

## Tech Stack

React 19, Vite, JavaScript, CSS, `lucide-react` icons, ESLint, and browser `localStorage`. There is no backend, authentication, external API, or server-side dependency.

## Setup and Running Locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The production commands are:

```bash
npm run lint
npm run build
npm run preview
```

The app has no environment variables. The Google Fonts import improves typography when online; the app's functionality remains client-side and does not depend on an API.

## Project Structure

```text
src/
  App.jsx             Dashboard, form modal, habit cards, and app state
  App.css             Responsive visual styling
  index.css           Global reset and focus treatment
  main.jsx            React entry point
  utils/
    dates.js          Local calendar date helpers
    streaks.js        Schedule-aware streak calculations
    storage.js        Safe localStorage loading and saving
```

## Persistence

Habits are stored under `habit-tracker-habits` and challenge settings, achievements, and rewards under `habit-tracker-settings`. The first load creates four sample habits and stores the current date as the challenge start date. Later loads use existing data and never reseed over it. Invalid or unreadable JSON safely falls back to the seed data. Browser storage can be cleared through DevTools to reset the demo.

## Streak Behavior

Dates are saved as local calendar keys in `YYYY-MM-DD` format. Daily habits require every calendar day. Weekday habits require Monday through Friday; Saturday and Sunday are skipped rather than counted as breaks. Current streaks count backward from today, using the most recent scheduled day when today is not complete. Best streaks scan all completion dates and count consecutive scheduled completions. A habit with no history has a zero streak.

Challenge progress is based on the persisted local start date: day 1 is the start date, progress is capped at day 75, and the display reports remaining days.

## Troubleshooting

- If habits appear reset, check that browser storage is enabled and that the app is running on the same origin.
- To reset sample data, clear local storage for the app origin and reload.
- If `npm run dev` is unavailable, run `npm install` first and check the Node.js version.
- If a build fails after dependency changes, remove `node_modules` and `package-lock.json`, then run `npm install` again.

## Future Improvements

A larger version could add a challenge start-date editor, configurable schedules, import/export, automated unit tests for date boundaries, richer all-time analytics, and a service worker for stronger offline asset caching.
