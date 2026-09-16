import { useState } from 'react'
import { Activity, AlertTriangle, Bell, BellOff, BellRing, Check, Cloud, Download, Eye, Gift, HeartPulse, LogOut, Mail, Palette, RefreshCw, Send, Settings as SettingsIcon, Sparkles, Trophy, User } from 'lucide-react'
import { CHALLENGE_LENGTH, MILESTONES } from '../utils/constants.js'
import { toDateKey } from '../utils/dates.js'
import { initialsFor } from '../utils/motivation.js'
import { formatReminderTime } from '../utils/reminders.js'
import RewardsPanel from './RewardsPanel.jsx'

const THEMES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

// Each permission state gets a plain description of what is actually possible,
// so the UI never implies background delivery that this build cannot do.
const NOTIFICATION_HINT = {
  granted: 'Allowed. A notification can be raised while Daymark is open in a tab.',
  default: 'Not enabled yet. The browser will ask once, and only when you click Allow.',
  denied: 'Blocked for this site. Re-enable notifications in your browser settings, then reload.',
  unsupported: 'This browser does not provide the Notification API, so this stays unavailable.',
}

function Toggle({ checked, onChange, label, hint, id }) {
  return (
    <div className="pref-row">
      <div>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  )
}

export default function SettingsView({
  profile,
  onProfileChange,
  challenge,
  challengeStart,
  onChallengeStartChange,
  onResetChallenge,
  preferences,
  onPreferenceChange,
  rewards,
  bestStreak,
  onAddReward,
  onEditReward,
  onDeleteReward,
  onClaimReward,
  achievements,
  health,
  reminderSettings,
  onReminderChange,
  notificationState,
  onRequestNotifications,
  emailStatus,
  emailBusy,
  onPreviewEmail,
  onSendTestEmail,
  account,
  syncing,
  onSignOut,
  onResetData,
}) {
  const [draft, setDraft] = useState(profile)
  const [savedFlash, setSavedFlash] = useState(false)
  const [syncedProfile, setSyncedProfile] = useState(profile)

  // `emailStatus` is null when the API could not be reached, which is a
  // different state from "the API is up but email is not configured".
  const emailConfigured = Boolean(emailStatus?.configured)

  // The inputs are controlled by a local draft so typing stays responsive. If
  // the stored profile changes from elsewhere — a full data reset, for example —
  // the draft has to follow, or the next blur would write the stale values back.
  // Adjusting during render (rather than in an effect) is React's documented
  // pattern for deriving state from a changed prop and avoids a second pass.
  if (profile !== syncedProfile) {
    setSyncedProfile(profile)
    setDraft(profile)
  }

  const commitProfile = (next) => {
    setDraft(next)
    onProfileChange(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1400)
  }

  return (
    <section className="page-view settings-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><SettingsIcon size={14} /> Personalize</p>
          <h2>Settings</h2>
        </div>
        {savedFlash && <span className="saved-flash"><Check size={14} /> Saved</span>}
      </div>

      <div className="settings-card">
        <h3><User size={15} /> Profile</h3>
        <div className="profile-large">
          <div className="avatar avatar-lg">{initialsFor(draft.name)}</div>
          <div className="profile-fields">
            <label>
              Display name
              <input
                value={draft.name || ''}
                placeholder="Your name"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                onBlur={() => commitProfile(draft)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draft.email || ''}
                placeholder="you@example.com"
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                onBlur={() => commitProfile(draft)}
              />
            </label>
          </div>
        </div>
        <p className="muted field-hint">
          Stored only in this browser. Your name is used for the home greeting — nothing is sent anywhere.
        </p>
      </div>

      <div className="settings-card">
        <h3><Trophy size={15} /> Challenge</h3>
        <label>
          Challenge start date
          <input type="date" value={challengeStart} onChange={(event) => onChallengeStartChange(event.target.value)} />
        </label>
        <div className="challenge-summary">
          <span>Duration: {CHALLENGE_LENGTH} days</span>
          <span>{challenge.started ? `Day ${challenge.day} of ${CHALLENGE_LENGTH} · ${challenge.remaining} remaining` : 'Not started yet'}</span>
        </div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={() => onChallengeStartChange(toDateKey())}>Start today</button>
          <button className="text-button danger-text" onClick={onResetChallenge}>Reset challenge</button>
        </div>
        <p className="muted field-hint">Resetting moves the start date to today and clears unlocked milestones. Habit history is kept.</p>
      </div>

      <div className="settings-card">
        <h3><Bell size={15} /> Daily Reminders</h3>

        <Toggle
          id="pref-reminders"
          label="Daily reminders"
          hint="Show a morning checklist of habits you have not logged yet"
          checked={reminderSettings.enabled}
          onChange={(next) => onReminderChange('enabled', next)}
        />

        <div className="pref-row">
          <div>
            <strong>Reminder time</strong>
            <small>When your checklist becomes due ({formatReminderTime(reminderSettings.time)})</small>
          </div>
          <input
            type="time"
            className="time-input"
            aria-label="Reminder time"
            value={reminderSettings.time}
            disabled={!reminderSettings.enabled}
            onChange={(event) => onReminderChange('time', event.target.value || '08:00')}
          />
        </div>

        <div className="pref-row is-stacked">
          <div>
            <strong>
              {notificationState === 'granted' ? <BellRing size={14} /> : <BellOff size={14} />} Browser notifications
            </strong>
            <small>{NOTIFICATION_HINT[notificationState] || NOTIFICATION_HINT.default}</small>
          </div>
          <div className="settings-actions">
            {notificationState === 'granted' ? (
              <span className="status-pill is-on"><Check size={13} /> Enabled</span>
            ) : (
              <button
                className="secondary-button"
                onClick={onRequestNotifications}
                disabled={notificationState === 'unsupported' || notificationState === 'denied'}
                title={
                  notificationState === 'unsupported'
                    ? 'This browser has no Notification API'
                    : notificationState === 'denied'
                      ? 'Blocked — re-enable notifications for this site in your browser settings'
                      : 'Ask the browser for permission'
                }
              >
                Allow notifications
              </button>
            )}
          </div>
        </div>

        <p className="muted field-hint">
          Daymark has no push server, so a browser notification can only be raised while the app is open in a tab
          — for example if you leave it open past your reminder time. The morning checklist and the Home card work
          without any permission at all.
        </p>
      </div>

      <div className="settings-card">
        <h3><Sparkles size={15} /> Preferences</h3>
        <Toggle
          id="pref-motivation"
          label="Motivational messages"
          hint="Show rotating encouragement on the home screen"
          checked={preferences.motivationalMessages}
          onChange={(next) => onPreferenceChange('motivationalMessages', next)}
        />
        <Toggle
          id="pref-celebration"
          label="Celebration effects"
          hint="Confetti when you finish a day or hit a milestone"
          checked={preferences.celebrationEffects}
          onChange={(next) => onPreferenceChange('celebrationEffects', next)}
        />
        <div className="pref-row">
          <div>
            <strong><Palette size={14} /> Theme</strong>
            <small>Appearance of the whole app</small>
          </div>
          <div className="filter-chips small" role="tablist" aria-label="Theme">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                role="tab"
                aria-selected={preferences.theme === theme.id}
                className={preferences.theme === theme.id ? 'active' : ''}
                onClick={() => onPreferenceChange('theme', theme.id)}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3><Mail size={15} /> Daily Email Reminder</h3>
        <p className="muted">Get a friendly reminder every morning about habits you haven&apos;t completed.</p>

        <Toggle
          id="pref-email-reminders"
          label="Daily email reminders"
          hint="One email each morning, only when habits are still outstanding"
          checked={reminderSettings.emailEnabled}
          onChange={(next) => onReminderChange('emailEnabled', next)}
        />

        <div className="pref-row">
          <div>
            <strong>Reminder time</strong>
            <small>Sent at {formatReminderTime(reminderSettings.emailTime)}, and skipped entirely if nothing is pending</small>
          </div>
          <input
            type="time"
            className="time-input"
            aria-label="Email reminder time"
            value={reminderSettings.emailTime}
            disabled={!reminderSettings.emailEnabled}
            onChange={(event) => onReminderChange('emailTime', event.target.value || '08:00')}
          />
        </div>

        <label className="email-field">
          Send to
          <input
            type="email"
            value={profile.email || ''}
            placeholder="sneha@example.com"
            onChange={(event) => onProfileChange({ ...profile, email: event.target.value })}
          />
        </label>

        <div className={`email-service ${emailConfigured ? 'is-ready' : 'is-unconfigured'}`}>
          {emailStatus === null ? (
            <>
              <AlertTriangle size={15} />
              <div>
                <strong>Reminder service is not reachable</strong>
                <small>The app works normally without it. Start the API to enable email.</small>
              </div>
            </>
          ) : emailConfigured ? (
            <>
              <Check size={15} />
              <div>
                <strong>Email service is configured</strong>
                <small>
                  SMTP via {emailStatus.provider} · {emailStatus.timezone}
                  {emailStatus.schedulerEnabled ? ` · checking every ${emailStatus.pollMinutes} min` : ' · scheduler off'}
                </small>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle size={15} />
              <div>
                <strong>Email service isn&apos;t configured yet</strong>
                <small>
                  {emailStatus?.missing?.length
                    ? `Set ${emailStatus.missing.join(', ')} in the server environment.`
                    : 'Set the EMAIL_* variables in the server environment.'}
                </small>
              </div>
            </>
          )}
        </div>

        <div className="settings-actions">
          <button className="secondary-button" onClick={onPreviewEmail} disabled={emailBusy}>
            <Eye size={15} /> Preview email
          </button>
          <button
            className="secondary-button"
            onClick={onSendTestEmail}
            disabled={emailBusy || !emailConfigured || !profile.email?.trim()}
            title={
              !emailConfigured
                ? 'Configure the EMAIL_* variables on the server first'
                : !profile.email?.trim()
                  ? 'Add a send-to address first'
                  : 'Send one real reminder now'
            }
          >
            <Send size={15} /> Send test email
          </button>
        </div>

        <p className="muted field-hint">
          The scheduled job runs on the server and emails only habits that are active, due today and still unlogged —
          the same rule the Home checklist uses. A preview needs no credentials; sending needs SMTP configured.
          Per-user timezones are not implemented; the job uses the server&apos;s configured zone.
        </p>
      </div>

      <div className="settings-card">
        <h3><Gift size={15} /> Rewards</h3>
        <RewardsPanel
          rewards={rewards}
          bestStreak={bestStreak}
          onAdd={onAddReward}
          onEdit={onEditReward}
          onDelete={onDeleteReward}
          onClaim={onClaimReward}
        />
      </div>

      <div className="settings-card">
        <h3><Activity size={15} /> Achievements</h3>
        <div className="milestone-row">
          {MILESTONES.map((milestone) => {
            const earned = (achievements || []).includes(milestone)
            return (
              <span className={earned ? 'earned' : ''} key={milestone} title={earned ? 'Unlocked' : 'Not yet unlocked'}>
                {milestone}
              </span>
            )
          })}
        </div>
        <p className="muted field-hint">
          {(achievements || []).length} of {MILESTONES.length} milestones unlocked · best streak {bestStreak} days.
        </p>
      </div>

      <div className="settings-card">
        <h3><HeartPulse size={15} /> Integrations</h3>
        <div className="integration">
          <div>
            <strong>Google Health</strong>
            <p>{health.connected ? 'Connected' : 'Not connected'}</p>
          </div>
          <span className={`status-pill ${health.connected ? 'is-on' : ''}`}>
            {health.connected ? <Check size={13} /> : <AlertTriangle size={13} />}
            {health.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <p className="muted field-hint">
          {health.configured
            ? 'Google credentials are configured on the server, but the OAuth handshake is not implemented yet.'
            : 'Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server. Steps, distance, calories and exercise will appear here once connected — the habit tracker works fully without it.'}
        </p>
        <div className="settings-actions">
          <button className="secondary-button" disabled title={health.configured ? 'OAuth flow not implemented yet' : 'Server credentials not configured'}>
            <Cloud size={15} /> Connect fitness data
          </button>
        </div>
      </div>

      <div className="settings-card">
        <h3><Download size={15} /> Your data</h3>
        <p className="muted">Everything lives in this browser&apos;s local storage. Export a copy or start over.</p>
        <div className="settings-actions">
          <button className="secondary-button" onClick={onResetData}><RefreshCw size={15} /> Reset all data</button>
        </div>
      </div>

      <div className="settings-card">
        <h3><LogOut size={15} /> Account</h3>
        {account?.status === 'signed-in' && account.user ? (
          <>
            <div className="profile-large">
              {account.user.avatar ? (
                <img className="avatar avatar-lg avatar-img" src={account.user.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="avatar avatar-lg">{initialsFor(account.user.name)}</div>
              )}
              <div className="profile-fields">
                <strong className="account-name">{account.user.name || 'Signed in'}</strong>
                <small className="account-email">{account.user.email}</small>
                <small className={`account-sync ${syncing ? 'is-on' : ''}`}>
                  {syncing ? 'Synced to your account' : 'Not syncing'}
                </small>
              </div>
            </div>
            <p className="muted field-hint">
              This is your real account. Habits, completion history, rewards and milestones are stored on the
              server and follow you to any device you sign in on.
            </p>
            <div className="settings-actions">
              <button className="secondary-button" onClick={onSignOut}><LogOut size={15} /> Sign out</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              <Mail size={14} /> You are using a local profile. Everything is stored in this browser only.
            </p>
            <p className="muted field-hint">
              Sign in to keep your habits, history and streaks on the server. The sign-in screen is available from a
              fresh load; this local data can be imported into the account once you do.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
