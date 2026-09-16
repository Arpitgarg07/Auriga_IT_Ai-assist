import { AlertTriangle, ArrowRight, Check, Cloud, Flame, Leaf, Server, ShieldCheck } from 'lucide-react'

/**
 * The signed-out screen. It has three honest states rather than one:
 *
 *  - the backend is reachable and at least one sign-in method works
 *  - the backend is reachable but not configured (no database, no Google keys)
 *  - the backend cannot be reached at all
 *
 * In every non-working case the local app is still offered, because a blank
 * screen or a dead end would be worse than the honest explanation.
 */
export default function LoginScreen({ providers, status, busy, error, onDeveloper, onContinueLocal }) {
  const unavailable = status === 'unavailable'
  const canGoogle = Boolean(providers?.google)
  const canDeveloper = Boolean(providers?.developer)
  const canSignIn = canGoogle || canDeveloper

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark"><Leaf size={19} /></span>
          <span>daymark</span>
        </div>

        <h1 className="login-title">Build better habits.<br /><em>Keep your streak alive.</em></h1>
        <p className="login-sub">
          A 75-day challenge tracker with real streaks, honest analytics and a morning reminder that
          only speaks up when you still have something left to do.
        </p>

        {error && (
          <p className="login-error" role="alert"><AlertTriangle size={15} /> {error}</p>
        )}

        {busy ? (
          <div className="login-busy"><span className="spinner" aria-hidden="true" /> Checking your session…</div>
        ) : canSignIn ? (
          <>
            {canGoogle && (
              <a className="login-primary" href="/api/auth/google">
                <GoogleMark /> Continue with Google
              </a>
            )}
            {canDeveloper && (
              <button className="login-primary is-secondary" onClick={onDeveloper} type="button">
                <ShieldCheck size={17} /> Continue as developer
              </button>
            )}
            {canDeveloper && (
              <p className="login-note">
                Developer sign-in creates a real account in your local database. It is available because
                <code> NODE_ENV</code> is not <code>production</code>; it disappears in production.
              </p>
            )}
          </>
        ) : (
          <div className="login-unavailable">
            <div className="login-unavailable-head">
              {unavailable ? <Server size={17} /> : <Cloud size={17} />}
              <strong>{unavailable ? 'Backend not reachable' : 'Backend not configured'}</strong>
            </div>
            <p>
              {unavailable
                ? 'The API server is not running, so accounts are unavailable. Start it with npm run server.'
                : 'Sign-in needs MONGODB_URI, SESSION_SECRET and Google credentials on the server.'}
            </p>
            {providers?.databaseMissing?.length > 0 && (
              <p className="login-missing">Missing: {providers.databaseMissing.join(', ')}</p>
            )}
          </div>
        )}

        <button className="login-local" onClick={onContinueLocal} type="button">
          Continue without an account <ArrowRight size={15} />
        </button>

        <ul className="login-points">
          <li><Flame size={14} /> Streaks that understand weekends</li>
          <li><Check size={14} /> Archived habits keep their history</li>
          <li><ShieldCheck size={14} /> Your data stays on your device until you sign in</li>
        </ul>
      </div>

      <p className="login-foot">Your progress deserves a place to grow.</p>
    </div>
  )
}

// Inline so the button needs no external asset and stays crisp at any size.
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.6c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.5-4.2 6.5-10.3 6.5-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.6 14.6 0 0 1 9.6 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.6-5.9l-7.6-5.9c-2 1.4-4.7 2.4-8 2.4-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}
