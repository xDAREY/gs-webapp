'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Clock3,
  Home,
  LogOut,
  Plus,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  History,
  HeartHandshake,
} from 'lucide-react'
import type { StaffRole } from '@/lib/types'

/* ---------------------------------------------------------------------- */
/* Idle / session timeout (HIPAA requirement: 15 min inactivity)          */
/* ---------------------------------------------------------------------- */

const IDLE_LIMIT_MS = 15 * 60 * 1000

export function useIdleTimeout(active: boolean, onTimeout: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!active) return
    const reset = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(onTimeout, IDLE_LIMIT_MS)
    }
    reset()
    const events = ['click', 'keydown', 'touchstart', 'scroll']
    events.forEach((event) => window.addEventListener(event, reset))
    return () => {
      if (timer.current) clearTimeout(timer.current)
      events.forEach((event) => window.removeEventListener(event, reset))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}

/* ---------------------------------------------------------------------- */
/* Landing / role picker                                                  */
/* ---------------------------------------------------------------------- */

export type LandingPick = StaffRole | 'supervisor'

export function Landing({
  onPick,
  sessionMessage,
  onDismissMessage,
}: {
  onPick: (pick: LandingPick) => void
  sessionMessage?: string
  onDismissMessage?: () => void
}) {
  return (
    <main className="login-screen">
      <div className="login-card">
        <div className="brand-mark login-mark">
          <ShieldCheck />
        </div>
        <p className="eyebrow">Golden Serenity</p>
        <h1>
          Care, documented
          <br />
          with confidence.
        </h1>
        <p className="login-copy">Choose how you are entering today.</p>
        <div className="login-options">
          <button onClick={() => onPick('nurse')}>
            <span className="action-icon teal-bg">
              <Stethoscope />
            </span>
            <span>
              <strong>Nurse</strong>
              <small>Continue to your workspace</small>
            </span>
          </button>
          <button onClick={() => onPick('pca_cna')}>
            <span className="action-icon amber-bg">
              <HeartHandshake />
            </span>
            <span>
              <strong>PCA/CNA</strong>
              <small>Continue to your workspace</small>
            </span>
          </button>
          <button onClick={() => onPick('supervisor')}>
            <span className="action-icon blue-bg">
              <UsersRound />
            </span>
            <span>
              <strong>Supervisor</strong>
              <small>Review team documentation</small>
            </span>
          </button>
        </div>
        <p className="secure-note">
          <ShieldCheck /> Separate role accounts · 15-minute inactivity timeout
        </p>
      </div>
      {sessionMessage && (
        <div className="floating-message" role="status">
          <span>{sessionMessage}</span>
          <button onClick={onDismissMessage} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </main>
  )
}

/* ---------------------------------------------------------------------- */
/* Header + bottom nav                                                    */
/* ---------------------------------------------------------------------- */

export function Header({ title, eyebrow, onBack }: { title: string; eyebrow?: string; onBack?: () => void }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        {onBack ? (
          <button className="icon-button" aria-label="Go back" onClick={onBack}>
            <ArrowLeft />
          </button>
        ) : (
          <div className="brand-mark">
            <ShieldCheck />
          </div>
        )}
        <div className="header-title">
          <p className="eyebrow">{eyebrow ?? 'Golden Serenity'}</p>
          <h1>{title}</h1>
        </div>
      </div>
    </header>
  )
}

export function NurseBottomNav({
  tab,
  onNavigate,
  onLogout,
}: {
  tab: 'home' | 'patients' | 'history'
  onNavigate: (tab: 'home' | 'patients' | 'history') => void
  onLogout: () => void
}) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button className={tab === 'home' ? 'active' : ''} onClick={() => onNavigate('home')}>
        <Home />
        Home
      </button>
      <button className={tab === 'patients' ? 'active' : ''} onClick={() => onNavigate('patients')}>
        <UsersRound />
        Patients
      </button>
      <button className={tab === 'history' ? 'active' : ''} onClick={() => onNavigate('history')}>
        <History />
        History
      </button>
      <button onClick={onLogout}>
        <LogOut />
        Sign out
      </button>
    </nav>
  )
}

export function SupervisorBottomNav({
  tab,
  onNavigate,
  onLogout,
}: {
  tab: 'queue' | 'activity' | 'team' | 'patients'
  onNavigate: (tab: 'queue' | 'activity' | 'team' | 'patients') => void
  onLogout: () => void
}) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <button className={tab === 'queue' ? 'active' : ''} onClick={() => onNavigate('queue')}>
        <Home />
        Queue
      </button>
      <button className={tab === 'activity' ? 'active' : ''} onClick={() => onNavigate('activity')}>
        <Clock3 />
        Activity
      </button>
      <button className={tab === 'team' ? 'active' : ''} onClick={() => onNavigate('team')}>
        <Stethoscope />
        Nurses
      </button>
      <button className={tab === 'patients' ? 'active' : ''} onClick={() => onNavigate('patients')}>
        <UsersRound />
        Patients
      </button>
      <button onClick={onLogout}>
        <LogOut />
        Sign out
      </button>
    </nav>
  )
}

/* ---------------------------------------------------------------------- */
/* Nurse / PCA-CNA auth (create account / log in — no seeded accounts)    */
/* ---------------------------------------------------------------------- */

const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  nurse: 'Nurse',
  pca_cna: 'PCA/CNA',
}

export function NurseAuth({
  staffRole,
  onBack,
  onCreate,
  onLogin,
  error,
}: {
  // Which entry point this is — only changes copy/labels. The actual
  // role-matching enforcement happens server-side (see auth-login), not
  // here; this prop exists purely so the same component can serve both
  // buttons without duplicating the whole screen.
  staffRole: StaffRole
  onBack: () => void
  onCreate: (name: string, phone: string, pin: string) => Promise<void>
  onLogin: (phone: string, pin: string) => Promise<void>
  error: string
}) {
  const roleLabel = STAFF_ROLE_LABEL[staffRole]
  const [mode, setMode] = useState<'choose' | 'create' | 'login'>('choose')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [showPendingInfo, setShowPendingInfo] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin() {
    setSubmitting(true)
    try {
      await onLogin(phone.trim(), pin)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreate() {
    setShowPendingInfo(false)
    setSubmitting(true)
    try {
      await onCreate(name.trim(), phone.trim(), pin)
    } finally {
      setSubmitting(false)
    }
  }

  if (mode === 'choose') {
    return (
      <main className="login-screen">
        <div className="login-card">
          <button className="icon-button" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </button>
          <div className="brand-mark login-mark">
            <Stethoscope />
          </div>
          <h1>{roleLabel} workspace</h1>
          <p className="login-copy">Create an account the first time you sign in, or log in if you already have one.</p>
          <div className="login-options">
            <button onClick={() => setMode('create')}>
              <span className="action-icon teal-bg">
                <Plus />
              </span>
              <span>
                <strong>Create account</strong>
                <small>First time using the app</small>
              </span>
            </button>
            <button onClick={() => setMode('login')}>
              <span className="action-icon blue-bg">
                <Stethoscope />
              </span>
              <span>
                <strong>Log in</strong>
                <small>I already have an account</small>
              </span>
            </button>
          </div>
        </div>
      </main>
    )
  }

  const valid = mode === 'create' ? !!name.trim() && !!phone.trim() && /^\d{4,6}$/.test(pin) : !!phone.trim() && /^\d{4,6}$/.test(pin)

  return (
    <main className="login-screen">
      <div className="login-card">
        <button className="icon-button" onClick={() => setMode('choose')} aria-label="Back">
          <ArrowLeft />
        </button>
        <div className="brand-mark login-mark">
          <Stethoscope />
        </div>
        <p className="eyebrow">
          {roleLabel} · {mode === 'create' ? 'Create account' : 'Log in'}
        </p>
        <h1>{mode === 'create' ? 'Create your account.' : 'Welcome back.'}</h1>
        <div className="form-stack">
          {mode === 'create' && (
            <label>
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" disabled={submitting} />
            </label>
          )}
          <label>
            Phone number
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''))}
              placeholder="Phone number"
              inputMode="tel"
              disabled={submitting}
            />
          </label>
          <label>
            4–6 digit PIN
            <input
              className="pin-input"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              type="password"
              placeholder="••••"
              disabled={submitting}
            />
          </label>
        </div>
        {error && <p className="red-text" style={{ marginTop: 12 }}>{error}</p>}
        <button
          className="primary-button wide"
          disabled={!valid || submitting}
          onClick={() => (mode === 'create' ? setShowPendingInfo(true) : handleLogin())}
        >
          {submitting ? (mode === 'create' ? 'Creating…' : 'Signing in…') : mode === 'create' ? 'Create account' : 'Log in'}
        </button>
        {mode === 'login' && (
          <p className="secure-note" style={{ marginTop: 18 }}>
            Forgot your PIN? Contact your supervisor to reset it.
          </p>
        )}
      </div>

      {showPendingInfo && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true">
          <div className="modal-card confirm-card">
            <div className="modal-head">
              <h2>Almost done</h2>
              <button className="icon-button" onClick={() => setShowPendingInfo(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="lead">
                Your account will be created as a {roleLabel}, but it won&apos;t be usable right away. A supervisor needs to review
                and approve it first — once they do, you can sign in with the phone number and PIN you just chose.
              </p>
              <div className="review-actions" style={{ marginTop: 22 }}>
                <button className="secondary-button" onClick={() => setShowPendingInfo(false)}>
                  Go back
                </button>
                <button className="primary-button" disabled={submitting} onClick={handleCreate}>
                  {submitting ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/* ---------------------------------------------------------------------- */
/* Supervisor auth (single agency account, self-service first-run setup)  */
/* ---------------------------------------------------------------------- */

export function SupervisorAuth({
  exists,
  onBack,
  onCreate,
  onLogin,
  error,
}: {
  exists: boolean
  onBack: () => void
  onCreate: (name: string, phone: string, pin: string) => Promise<void>
  onLogin: (phone: string, pin: string) => Promise<void>
  error: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const mode = exists ? 'login' : 'create'
  const valid = mode === 'create' ? !!name.trim() && !!phone.trim() && /^\d{4,6}$/.test(pin) : !!phone.trim() && /^\d{4,6}$/.test(pin)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      if (mode === 'create') {
        await onCreate(name.trim(), phone.trim(), pin)
      } else {
        await onLogin(phone.trim(), pin)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <div className="login-card">
        <button className="icon-button" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </button>
        <div className="brand-mark login-mark">
          <ShieldCheck />
        </div>
        <p className="eyebrow">Supervisor workspace</p>
        <h1>{mode === 'create' ? 'Set up your account.' : 'Welcome back.'}</h1>
        <p className="login-copy">
          {mode === 'create'
            ? 'No supervisor account exists yet for this agency. Set one up now — this only needs to happen once.'
            : 'Review submitted shifts, manage nurses and patients.'}
        </p>
        <div className="form-stack">
          {mode === 'create' && (
            <label>
              Full name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" disabled={submitting} />
            </label>
          )}
          <label>
            Phone number
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone number"
              inputMode="tel"
              disabled={submitting}
            />
          </label>
          <label>
            4–6 digit PIN
            <input
              className="pin-input"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              type="password"
              placeholder="••••"
              disabled={submitting}
            />
          </label>
        </div>
        {error && <p className="red-text" style={{ marginTop: 12 }}>{error}</p>}
        <button className="primary-button wide" disabled={!valid || submitting} onClick={handleSubmit}>
          {submitting ? (mode === 'create' ? 'Creating…' : 'Signing in…') : mode === 'create' ? 'Create account' : 'Log in'}
        </button>
      </div>
    </main>
  )
}