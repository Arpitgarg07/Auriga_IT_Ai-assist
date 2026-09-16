import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Check, Cloud, Flame, Leaf, LayoutDashboard, ListChecks, Plus, AlertTriangle, Settings as SettingsIcon } from 'lucide-react'
import './App.css'
import { daysBetween, formatDate, fromDateKey, toDateKey } from './utils/dates.js'
import { getBestStreak, getCurrentStreak, isHabitScheduledOnDate } from './utils/streaks.js'
import { clearAll, loadData, readNotifiedDate, saveHabits, saveSettings, writeNotifiedDate } from './utils/storage.js'
import { CHALLENGE_LENGTH, MILESTONES } from './utils/constants.js'
import { rewardState } from './utils/analytics.js'
import { initialsFor, smallWinFor } from './utils/motivation.js'
import {
  getMorningReminder,
  notificationBody,
  notificationPermission,
  shouldNotifyBrowser,
  shouldShowMorningModal,
} from './utils/reminders.js'
import Celebration from './components/Celebration.jsx'
import HabitForm from './components/HabitForm.jsx'
import RewardForm from './components/RewardForm.jsx'
import HomeView from './components/HomeView.jsx'
import AnalyticsView from './components/AnalyticsView.jsx'
import ManageView from './components/ManageView.jsx'
import SettingsView from './components/SettingsView.jsx'
import MorningReminder from './components/MorningReminder.jsx'
import EmailPreview from './components/EmailPreview.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import { api, buildReminderSnapshot } from './services/api.js'

const NAV = [
  { id: 'home', label: 'Home', Icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'manage', label: 'Manage', Icon: ListChecks },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
]

const HEALTH_IDLE = { connected: false, configured: false, message: 'Google Health not connected' }

// `status` is one of: checking, signed-in, anonymous, unavailable.
const ACCOUNT_CHECKING = { status: 'checking', user: null, providers: null, error: null }

export default function App() {
  const initial = useMemo(() => loadData(toDateKey()), [])
  const [habits, setHabits] = useState(initial.habits)
  const [settings, setSettings] = useState(initial.settings)
  const [tab, setTab] = useState('home')
  const [todayKey, setTodayKey] = useState(() => toDateKey())
  const [date, setDate] = useState(() => toDateKey())
  const [search, setSearch] = useState('')
  const [rangeId, setRangeId] = useState('7d')
  const [selectedDate, setSelectedDate] = useState(null)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const [health, setHealth] = useState(HEALTH_IDLE)
  const [clock, setClock] = useState(() => new Date())
  const [permission, setPermission] = useState(() => notificationPermission())
  const [emailStatus, setEmailStatus] = useState(null)
  const [emailPreview, setEmailPreview] = useState(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [account, setAccount] = useState(ACCOUNT_CHECKING)
  const [localMode, setLocalMode] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const [importState, setImportState] = useState({ visible: false, busy: false })
  // Which account's data is currently loaded. A bare boolean would be unsafe:
  // signing out and back in as someone else would leave it true while the
  // previous account's habits were still in state, and the sync effect could
  // push them into the new account. Keying on the user id makes that impossible.
  const [hydratedUserId, setHydratedUserId] = useState(null)
  const todayRef = useRef(todayKey)
  const noticeTimer = useRef(null)
  const notifiedRef = useRef(null)

  const hydrated = account.status === 'signed-in'
    && hydratedUserId !== null
    && hydratedUserId === account.user?.id

  // Declared above the effects that depend on it. Memoised so the fallback
  // object keeps a stable identity and does not re-run those effects on every
  // render.
  const reminderSettings = useMemo(
    () => settings.reminders || {
      enabled: true,
      time: '08:00',
      browserNotifications: false,
      lastShownDate: null,
      emailEnabled: false,
      emailTime: '08:00',
    },
    [settings.reminders],
  )


  useEffect(() => { saveHabits(habits) }, [habits])
  useEffect(() => { saveSettings(settings) }, [settings])

  /* ------------------------------------------------------------ account */

  // Ask the server who we are. A missing or unconfigured backend is a state,
  // not an error: the app stays fully usable on local storage.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const providers = await api.providers()
      if (cancelled) return
      if (!providers.ok) {
        setAccount({ status: 'unavailable', user: null, providers: null, error: null })
        return
      }
      const me = await api.me()
      if (cancelled) return
      setAccount({
        status: me.ok && me.data?.user ? 'signed-in' : 'anonymous',
        user: me.data?.user || null,
        providers: providers.data,
        error: null,
      })
    })()
    return () => { cancelled = true }
  }, [])

  // Pull the account's data once, and only then allow writes. If this fails the
  // app keeps showing local data but deliberately does NOT sync, so a failed
  // load can never overwrite the account with whatever happened to be local.
  useEffect(() => {
    if (account.status !== 'signed-in') return undefined

    let cancelled = false
    ;(async () => {
      const result = await api.bootstrap()
      if (cancelled) return

      if (!result.ok) {
        setSyncError(result.data?.detail || result.data?.error || 'Could not load your account data.')
        return
      }

      const data = result.data
      setHabits(data.habits || [])
      setSettings((current) => ({
        ...current,
        rewards: data.rewards || [],
        achievements: data.achievements || [],
        challengeStart: data.challengeStart || current.challengeStart,
        profile: { ...current.profile, name: data.user?.name || current.profile.name },
        reminders: {
          ...current.reminders,
          emailEnabled: Boolean(data.reminderEnabled),
          emailTime: data.reminderTime || current.reminders.emailTime,
        },
      }))
      setSyncError(null)
      setHydratedUserId(data.user?.id || account.user?.id || null)

      // Offer the import only when the account is genuinely empty and there is
      // something local worth bringing over.
      if ((data.habits || []).length === 0 && initial.habits.length > 0) {
        setImportState({ visible: true, busy: false })
      }
    })()

    return () => { cancelled = true }
  }, [account.status, account.user?.id, initial.habits.length])

  // Debounced, idempotent write-back. Guarded on `hydrated` so the account is
  // never written before it has been read.
  useEffect(() => {
    if (account.status !== 'signed-in' || !hydrated) return undefined

    const timer = setTimeout(async () => {
      const result = await api.sync({
        habits,
        rewards: settings.rewards || [],
        achievements: settings.achievements || [],
        challengeStart: settings.challengeStart,
        reminderEnabled: reminderSettings.emailEnabled,
        reminderTime: reminderSettings.emailTime,
        profile: { name: settings.profile?.name || '' },
        preferences: settings.preferences,
      })
      if (!result.ok && result.status !== 0) setSyncError(result.data?.error || 'Sync failed.')
      else if (result.ok) setSyncError(null)
    }, 900)

    return () => clearTimeout(timer)
  }, [habits, settings, account.status, hydrated, reminderSettings])


  // Keep "today" honest if the app is left open across midnight, and tick a
  // clock so a reminder time that passes while the tab sits open is noticed.
  useEffect(() => {
    const timer = setInterval(() => {
      setTodayKey(toDateKey())
      setClock(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (todayRef.current === todayKey) return
    const previous = todayRef.current
    todayRef.current = todayKey
    setDate((current) => (current === previous ? todayKey : current))
  }, [todayKey])

  const themePreference = settings.preferences?.theme || 'light'

  // Theme resolves "system" against the OS preference.
  useEffect(() => {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference
  }, [themePreference])

  // Optional server status. Absence of the API is not an error state.
  useEffect(() => {
    let cancelled = false
    fetch('/api/fitness/status')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('offline'))))
      .then((data) => { if (!cancelled) setHealth({ ...HEALTH_IDLE, ...data }) })
      .catch(() => { if (!cancelled) setHealth(HEALTH_IDLE) })

    // Whether the server can actually send mail. Null means "could not ask".
    api.reminderStatus().then((result) => { if (!cancelled) setEmailStatus(result.ok ? result.data : null) })
    return () => { cancelled = true }
  }, [])

  const toast = useCallback((message) => {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 2200)
  }, [])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const activeHabits = useMemo(() => habits.filter((habit) => !habit.archived), [habits])
  const todayHabits = useMemo(
    () => activeHabits.filter((habit) => isHabitScheduledOnDate(habit, fromDateKey(todayKey))),
    [activeHabits, todayKey],
  )

  const currentStreak = activeHabits.reduce((max, habit) => Math.max(max, getCurrentStreak(habit, fromDateKey(todayKey))), 0)
  const bestStreak = activeHabits.reduce((max, habit) => Math.max(max, getBestStreak(habit)), 0)

  const challengeDays = daysBetween(settings.challengeStart, todayKey)
  const challengeStarted = challengeDays >= 0
  const challengeDay = challengeStarted ? Math.min(CHALLENGE_LENGTH, challengeDays + 1) : 0
  const challenge = {
    started: challengeStarted,
    day: challengeDay,
    percent: Math.round((challengeDay / CHALLENGE_LENGTH) * 100),
    remaining: Math.max(0, CHALLENGE_LENGTH - challengeDay),
  }

  const profile = settings.profile || { name: '', email: '' }
  const preferences = settings.preferences || { motivationalMessages: true, celebrationEffects: true, theme: 'light' }
  const displayName = profile.name?.trim() || 'friend'
  const rewards = settings.rewards || []
  const achievements = settings.achievements || []

  // Today's reminder, derived from the same stored completions the rest of the
  // app renders. Nothing here is hard-coded.
  const reminder = useMemo(() => getMorningReminder(habits, todayKey), [habits, todayKey])

  // Visibility is derived rather than stored, so it cannot get out of sync and
  // does not need an effect. The "already seen today" marker is written from the
  // dismiss handler, which is what makes this fire exactly once per day: a
  // re-render, a tab switch or a reload all leave the marker in place, while a
  // genuine day rollover clears the comparison and shows it again.
  const morningVisible = !celebration
    && reminder.mode !== 'rest'
    && shouldShowMorningModal(reminder, reminderSettings)

  // Browser notifications, limited to what a page can honestly do while open.
  // No setState here: the marker is external bookkeeping, not React state.
  useEffect(() => {
    if (!shouldNotifyBrowser(reminder, reminderSettings, notifiedRef.current ?? readNotifiedDate(), clock)) return
    try {
      new window.Notification("Daymark · today's habits", {
        body: notificationBody(reminder),
        tag: `daymark-${reminder.dateKey}`,
      })
    } catch {
      // Some platforms reject construction outright; the in-app card still shows.
    }
    notifiedRef.current = reminder.dateKey
    writeNotifiedDate(reminder.dateKey)
  }, [reminder, reminderSettings, clock])

  // A milestone is recorded once and never re-celebrated. Day-completion is
  // derived from the live board so it can never drift from what is displayed.
  // `targetDate` is passed in explicitly rather than read from state: the Home
  // board always writes to today, while Manage may be pointed at a past date.
  function evaluateCompletion(nextHabits, targetDate, completionMessage) {
    const uniqueDays = new Set(nextHabits.flatMap((habit) => habit.completions || []))
    const longest = nextHabits.reduce((max, habit) => Math.max(max, getBestStreak(habit)), 0)
    const reached = MILESTONES
      .filter((milestone) => (milestone === 1 ? uniqueDays.size >= 1 : longest >= milestone))
      .filter((milestone) => !achievements.includes(milestone))

    if (reached.length) {
      const milestone = reached[reached.length - 1]
      setSettings((current) => ({
        ...current,
        achievements: [...new Set([...(current.achievements || []), ...reached])],
      }))
      const unlockedReward = (settings.rewards || []).find(
        (reward) => reward.milestone === milestone && rewardState(reward, milestone) === 'unlocked',
      )
      setCelebration({
        kind: 'milestone',
        milestone,
        reward: unlockedReward || null,
        habitName: null,
      })
      return
    }

    const due = nextHabits.filter((habit) => !habit.archived && isHabitScheduledOnDate(habit, fromDateKey(targetDate)))
    const allDone = due.length > 0 && due.every((habit) => (habit.completions || []).includes(targetDate))
    if (allDone && targetDate === todayKey) {
      setCelebration({
        kind: 'day',
        completed: due.length,
        total: due.length,
        streak: nextHabits.reduce((max, habit) => Math.max(max, getCurrentStreak(habit, fromDateKey(targetDate))), 0),
      })
      return
    }

    toast(completionMessage)
  }

  function toggle(habit, targetDate = todayKey, win) {
    const completing = !(habit.completions || []).includes(targetDate)
    const next = habits.map((item) => (
      item.id === habit.id
        ? {
          ...item,
          completions: completing
            ? [...item.completions, targetDate]
            : item.completions.filter((key) => key !== targetDate),
        }
        : item
    ))
    setHabits(next)
    if (completing) evaluateCompletion(next, targetDate, win || smallWinFor(next.length))
  }

  function saveHabit(value) {
    setHabits((current) => (
      value.id
        ? current.map((item) => (item.id === value.id ? { ...item, ...value } : item))
        : [...current, {
          ...value,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          archived: false,
          completions: [],
        }]
    ))
    toast(value.id ? 'Habit updated.' : 'Habit added.')
    setModal(null)
  }

  function archiveHabit(habit) {
    if (!habit.archived && !window.confirm(`Archive “${habit.name}”? Its history is kept and it can be restored later.`)) return
    setHabits((current) => current.map((item) => (item.id === habit.id ? { ...item, archived: !item.archived } : item)))
    toast(habit.archived ? 'Habit restored.' : 'Habit archived. History kept.')
  }

  function saveReward(value) {
    setSettings((current) => {
      const list = current.rewards || []
      return {
        ...current,
        rewards: value.id
          ? list.map((item) => (item.id === value.id ? { ...item, ...value } : item))
          : [...list, { ...value, id: crypto.randomUUID(), claimed: false }],
      }
    })
    toast(value.id ? 'Reward updated.' : 'Reward added.')
    setModal(null)
  }

  function deleteReward(reward) {
    if (!window.confirm(`Delete the reward “${reward.name}”?`)) return
    setSettings((current) => ({ ...current, rewards: (current.rewards || []).filter((item) => item.id !== reward.id) }))
    toast('Reward deleted.')
  }

  function claimReward(reward) {
    if (!reward) return
    setSettings((current) => ({
      ...current,
      rewards: (current.rewards || []).map((item) => (item.id === reward.id ? { ...item, claimed: true } : item)),
    }))
    toast(`Claimed: ${reward.name}`)
  }

  function setPreference(key, value) {
    setSettings((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }))
  }

  function setReminder(key, value) {
    setSettings((current) => ({ ...current, reminders: { ...current.reminders, [key]: value } }))
  }

  // The email endpoints take the client's own habits, so the server renders the
  // same pending list the dashboard shows. No account or database is required.
  function reminderPayload() {
    return buildReminderSnapshot(habits, {
      dateKey: todayKey,
      profile: settings.profile,
      challengeStart: settings.challengeStart,
    })
  }

  async function previewEmailReminder() {
    setEmailBusy(true)
    const result = await api.previewReminder(reminderPayload())
    setEmailBusy(false)

    if (result.status === 0) { toast('Reminder service is not reachable.'); return }
    if (!result.ok) { toast(result.data?.error || 'Could not build the preview.'); return }
    if (result.data?.skipped) { toast(result.data.reason || 'Nothing pending today — no email would be sent.'); return }
    setEmailPreview(result.data)
  }

  async function sendTestEmail() {
    const recipient = settings.profile?.email?.trim()
    if (!recipient) { toast('Add an email address first.'); return }

    setEmailBusy(true)
    const result = await api.sendTestReminder(reminderPayload())
    setEmailBusy(false)

    if (result.status === 0) { toast('Reminder service is not reachable.'); return }
    if (result.data?.skipped) { toast(result.data.reason || 'Nothing pending today — no email sent.'); return }
    if (result.data?.sent) { toast(`Test reminder sent to ${recipient}.`); return }
    toast(result.data?.error || 'The email could not be sent.')
  }

  /* ------------------------------------------------------- account actions */

  async function signInAsDeveloper() {
    setAuthBusy(true)
    const result = await api.devSignIn()
    setAuthBusy(false)
    if (!result.ok) {
      setAccount((current) => ({ ...current, error: result.data?.detail || result.data?.error || 'Sign-in failed.' }))
      return
    }
    setAccount((current) => ({ ...current, status: 'signed-in', user: result.data.user, error: null }))
  }

  async function signOut() {
    await api.signOut()
    setLocalMode(false)
    setImportState({ visible: false, busy: false })
    setAccount((current) => ({ ...current, status: 'anonymous', user: null, error: null }))
    // Local storage already holds a cache of this account, so the app keeps
    // working and nothing the user can see disappears.
    toast('Signed out. Your device copy is still here.')
  }

  // The one-off import offered when a signed-in account is still empty. It goes
  // through the same idempotent sync endpoint, so running it twice is harmless.
  async function importLocalData() {
    setImportState({ visible: true, busy: true })
    const result = await api.sync({
      habits: initial.habits,
      rewards: initial.settings.rewards || [],
      achievements: initial.settings.achievements || [],
      challengeStart: initial.settings.challengeStart,
      reminderEnabled: initial.settings.reminders?.emailEnabled,
      reminderTime: initial.settings.reminders?.emailTime,
      profile: { name: initial.settings.profile?.name || '' },
      preferences: initial.settings.preferences,
    })

    if (!result.ok) {
      setImportState({ visible: true, busy: false })
      toast(result.data?.error || 'Import failed.')
      return
    }

    setHabits(result.data.habits || [])
    setSettings((current) => ({
      ...current,
      rewards: result.data.rewards || [],
      achievements: result.data.achievements || [],
    }))
    setImportState({ visible: false, busy: false })
    setHydratedUserId(account.user?.id || null)
    toast(`Imported ${result.data.habits?.length || 0} habits. Nothing local was deleted.`)
  }

  // Permission is only ever requested from an explicit click, and a denial is
  // reported rather than re-prompted (browsers refuse to re-prompt anyway).
  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      toast('This browser does not support notifications.')
      return
    }
    const result = await window.Notification.requestPermission()
    setPermission(result)
    setReminder('browserNotifications', result === 'granted')
    if (result === 'granted') toast('Browser notifications enabled.')
    else if (result === 'denied') toast('Notifications blocked in your browser settings.')
  }

  // Send the user to the thing the reminder is about: the first habit still
  // waiting today, on the Home tab. Dismissing also records that today's modal
  // has been seen, which is what stops it reappearing.
  function dismissMorningReminder() {    setSettings((current) => ({
      ...current,
      reminders: { ...current.reminders, lastShownDate: todayKey },
    }))
  }

  function focusFirstPendingHabit() {
    dismissMorningReminder()
    setTab('home')
    requestAnimationFrame(() => {
      const target = document.querySelector('.home-view .today-list .complete-button:not(.is-complete)')
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.focus({ preventScroll: true })
      } else {
        document.querySelector('.home-view .today-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  function updateProfile(next) {
    setSettings((current) => ({ ...current, profile: { ...current.profile, ...next } }))
  }

  function resetChallenge() {
    if (!window.confirm('Reset the challenge to start today? Unlocked milestones are cleared; habit history is kept.')) return
    setSettings((current) => ({ ...current, challengeStart: todayKey, achievements: [] }))
    toast('Challenge reset to today.')
  }

  function resetAllData() {
    if (!window.confirm('Delete all habits, history, rewards and settings on this device? This cannot be undone.')) return
    clearAll()
    const fresh = loadData(toDateKey())
    setHabits(fresh.habits)
    setSettings(fresh.settings)
    setDate(toDateKey())
    setSelectedDate(null)
    toast('All local data cleared.')
  }

  const openRewards = () => setTab('settings')

  // The sign-in screen is the only thing shown when the backend offers a way in
  // and the user has not chosen to skip it. Choosing "continue without an
  // account" keeps the whole app working exactly as before.
  if (account.status === 'anonymous' && !localMode) {
    return (
      <LoginScreen
        providers={account.providers}
        status={account.status}
        busy={authBusy}
        error={account.error}
        onDeveloper={signInAsDeveloper}
        onContinueLocal={() => setLocalMode(true)}
      />
    )
  }

  return (
    <div className="product-shell" data-tab={tab}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Leaf size={19} /></div>daymark</div>
        <nav aria-label="Primary navigation">
          {NAV.map(({ id, label, Icon }) => (
            <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id} aria-current={tab === id ? 'page' : undefined}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-quick">
          <span><Flame size={14} /><strong>{currentStreak}</strong> day streak</span>
          <span>{challenge.started ? `Day ${challenge.day}/${CHALLENGE_LENGTH}` : 'Not started'}</span>
          <div className="mini-track"><span style={{ width: `${challenge.percent}%` }} /></div>
        </div>
        <div className="profile">
          {/* The real account when signed in; the local profile otherwise. */}
          {account.user?.avatar ? (
            <img className="avatar avatar-img" src={account.user.avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar">{initialsFor(account.user?.name || profile.name)}</div>
          )}
          <div>
            <strong>{account.user?.name || profile.name?.trim() || 'Add your name'}</strong>
            <small>{account.user?.email || profile.email?.trim() || 'Local profile'}</small>
          </div>
        </div>
      </aside>

      <div className="app-shell">
        <header className="topbar">
          <div className="mobile-brand">daymark</div>
          <div className="topbar-actions">
            <button className="secondary-button compact" onClick={() => setModal({ type: 'reward' })}>
              <Plus size={15} /> Reward
            </button>
            <div className="date-chip"><span className="live-dot" />{formatDate(todayKey)}</div>
          </div>
        </header>

        <main>
          {importState.visible && (
            <div className="account-banner is-import">
              <Cloud size={17} />
              <div>
                <strong>Import your existing data?</strong>
                <small>
                  This account is empty and this browser has {initial.habits.length} habit
                  {initial.habits.length === 1 ? '' : 's'} with their history. Importing copies them to your account;
                  nothing is deleted from this device.
                </small>
              </div>
              <div className="account-banner-actions">
                <button className="primary-button" onClick={importLocalData} disabled={importState.busy}>
                  {importState.busy ? 'Importing…' : 'Import'}
                </button>
                <button
                  className="text-button"
                  onClick={() => setImportState({ visible: false, busy: false })}
                  disabled={importState.busy}
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {syncError && (
            <div className="account-banner is-error">
              <AlertTriangle size={17} />
              <div>
                <strong>Changes are not being saved to your account</strong>
                <small>{syncError} Your work is still safe on this device.</small>
              </div>
              <div className="account-banner-actions">
                <button className="secondary-button" onClick={() => window.location.reload()}>Retry</button>
              </div>
            </div>
          )}

          <HomeView
            name={displayName}
            todayLabel={{ key: todayKey, full: formatDate(todayKey) }}
            todayHabits={todayHabits}
            onToggle={(habit, win) => toggle(habit, todayKey, win)}
            onEditHabit={(habit) => setModal({ type: 'habit', item: habit })}
            onArchiveHabit={archiveHabit}
            onNavigate={setTab}
            current={currentStreak}
            best={bestStreak}
            challenge={challenge}
            rewards={rewards}
            achievements={achievements}
            showMotivation={preferences.motivationalMessages}
            onAddReward={() => setModal({ type: 'reward' })}
            onOpenRewards={openRewards}
            reminder={reminder}
            onCompleteHabit={focusFirstPendingHabit}
            onOpenReminderSettings={() => setTab('settings')}
          />

          <AnalyticsView
            habits={habits}
            activeHabits={activeHabits}
            todayKey={todayKey}
            challengeStart={settings.challengeStart}
            rangeId={rangeId}
            onRangeChange={setRangeId}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <ManageView
            habits={habits}
            activeHabits={activeHabits}
            todayKey={todayKey}
            challengeStart={settings.challengeStart}
            search={search}
            onSearch={setSearch}
            date={date}
            onDate={setDate}
            onAddHabit={() => setModal({ type: 'habit' })}
            onEditHabit={(habit) => setModal({ type: 'habit', item: habit })}
            onArchiveHabit={archiveHabit}
            onToggle={(habit) => toggle(habit, date)}
          />

          <SettingsView
            profile={profile}
            onProfileChange={updateProfile}
            challenge={challenge}
            challengeStart={settings.challengeStart}
            onChallengeStartChange={(value) => setSettings((current) => ({ ...current, challengeStart: value }))}
            onResetChallenge={resetChallenge}
            preferences={preferences}
            onPreferenceChange={setPreference}
            rewards={rewards}
            bestStreak={bestStreak}
            onAddReward={() => setModal({ type: 'reward' })}
            onEditReward={(reward) => setModal({ type: 'reward', item: reward })}
            onDeleteReward={deleteReward}
            onClaimReward={claimReward}
            achievements={achievements}
            health={health}
            reminderSettings={reminderSettings}
            onReminderChange={setReminder}
            notificationState={permission}
            onRequestNotifications={requestNotificationPermission}
            emailStatus={emailStatus}
            emailBusy={emailBusy}
            onPreviewEmail={previewEmailReminder}
            onSendTestEmail={sendTestEmail}
            account={account}
            syncing={account.status === 'signed-in' && hydrated}
            onSignOut={signOut}
            onResetData={resetAllData}
          />
        </main>

        <footer>
          <span>Built for consistency.</span>
          <span><Flame size={15} /> Keep showing up.</span>
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.map(({ id, label, Icon }) => (
          <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)} key={id}>
            <Icon size={18} /><small>{label}</small>
          </button>
        ))}
      </nav>

      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}

      {modal?.type === 'habit' && (
        <HabitForm habit={modal.item} save={saveHabit} close={() => setModal(null)} />
      )}
      {modal?.type === 'reward' && (
        <RewardForm reward={modal.item} bestStreak={bestStreak} save={saveReward} close={() => setModal(null)} />
      )}

      {emailPreview && <EmailPreview preview={emailPreview} onClose={() => setEmailPreview(null)} />}

      {morningVisible && (
        <MorningReminder
          reminder={reminder}
          name={displayName}
          effects={preferences.celebrationEffects}
          onClose={dismissMorningReminder}
          onComplete={focusFirstPendingHabit}
        />
      )}

      {celebration && (
        <Celebration
          kind={celebration.kind}
          milestone={celebration.milestone}
          habitName={celebration.habitName}
          completed={celebration.completed}
          total={celebration.total}
          streak={celebration.streak}
          reward={celebration.reward}
          effects={preferences.celebrationEffects}
          onClose={() => setCelebration(null)}
        />
      )}
    </div>
  )
}
