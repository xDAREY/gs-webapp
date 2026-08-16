'use client'

import { useEffect, useState } from 'react'
import type { AuditAction, AuditEvent, NotificationItem, NurseAccount, Patient, Role, Shift, SupervisorAccount } from '@/lib/types'
import { newId } from '@/lib/storage'
import { Landing, NurseAuth, SupervisorAuth, useIdleTimeout } from '@/components/Shared'
import { NurseApp } from '@/components/Nurse'
import { SupervisorApp } from '@/components/Supervisor'
import { createClient } from '@/lib/supabase/client'
import { login, registerNurse, setOwnPin } from '@/lib/auth-actions'
import { fetchAuditEvents, fetchNotifications, fetchNurses, fetchPatients, fetchShifts, insertAuditEvent } from '@/lib/supabase/data'

type Screen = 'landing' | 'nurseAuth' | 'supervisorAuth' | 'nurse' | 'supervisor' | 'nurseResetPin'

// Nurse.tsx still reads nurse.notifications directly as a nested field
// (pre-Phase-3). This bridges the gap until that component is rewritten to
// take `notifications` as its own top-level prop.
type NurseWithNotifications = NurseAccount & { notifications: NotificationItem[] }

export default function Page() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [sessionMessage, setSessionMessage] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [authError, setAuthError] = useState('')

  const [currentNurse, setCurrentNurse] = useState<NurseWithNotifications | null>(null)
  const [currentSupervisor, setCurrentSupervisor] = useState<SupervisorAccount | null>(null)

  // Real data, fetched from Supabase after login / session restore — no
  // localStorage anywhere in this file anymore.
  const [nurses, setNurses] = useState<NurseAccount[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])

  function audit(action: AuditAction, patientIds: string[] = [], actor = 'Unknown') {
    // Optimistic local copy for immediate UI feedback...
    setAuditEvents((events) => [
      ...events,
      { id: newId(), actor, actorRole: (screen === 'supervisor' ? 'supervisor' : 'nurse') as Role, patientIds, action, timestamp: new Date().toISOString() },
    ])
    // ...and the real insert. Fire-and-forget: audit_events is append-only
    // and nothing on this screen needs to block waiting for it.
    if (currentSupervisor) {
      insertAuditEvent({
        actorName: actor,
        actorRole: 'supervisor',
        actorSupervisorId: currentSupervisor.id,
        patientIds,
        action,
      }).catch(console.error)
    } else if (currentNurse) {
      insertAuditEvent({
        actorName: actor,
        actorRole: 'nurse',
        actorNurseId: currentNurse.id,
        patientIds,
        action,
      }).catch(console.error)
    }
  }

  function goLanding(message = '') {
    setScreen('landing')
    setCurrentNurse(null)
    setCurrentSupervisor(null)
    setNurses([])
    setPatients([])
    setShifts([])
    setAuditEvents([])
    setSessionMessage(message)
  }

  async function loadNurseWorkspace(nurse: NurseAccount) {
    const [patientsData, shiftsData, notificationsData] = await Promise.all([
      fetchPatients(),
      fetchShifts(nurse.id),
      fetchNotifications(nurse.id),
    ])
    setPatients(patientsData)
    setShifts(shiftsData)
    setCurrentNurse({ ...nurse, notifications: notificationsData })
  }

  async function loadSupervisorWorkspace() {
    const [nursesData, patientsData, shiftsData, auditData] = await Promise.all([
      fetchNurses(),
      fetchPatients(),
      fetchShifts(),
      fetchAuditEvents(),
    ])
    setNurses(nursesData)
    setPatients(patientsData)
    setShifts(shiftsData)
    setAuditEvents(auditData)
  }

  async function refreshNursePatients() {
    if (!currentNurse) return
    setPatients(await fetchPatients())
  }

  // Restore an existing Supabase session on load so a page refresh doesn't
  // bounce a signed-in user back to the landing screen.
  useEffect(() => {
    const supabase = createClient()

    async function restore() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        setCheckingSession(false)
        return
      }

      const role = session.user.user_metadata?.role as Role | undefined

      if (role === 'nurse') {
        const { data } = await supabase
          .from('nurses')
          .select('id, name, phone, status, must_reset_pin, active')
          .eq('auth_user_id', session.user.id)
          .single()

        if (data && !data.active) {
          // Deactivated mid-session (their token was still valid, but
          // current_nurse_id() now returns null for them at the DB
          // level). Sign out cleanly rather than let them sit on a
          // session that can't actually fetch or write anything.
          await supabase.auth.signOut()
          setCheckingSession(false)
          goLanding('Your account has been deactivated. Contact your supervisor if this is unexpected.')
          return
        }

        if (data) {
          const nurse: NurseAccount = {
            id: data.id,
            name: data.name,
            phone: data.phone,
            status: data.status,
            mustResetPin: data.must_reset_pin,
            assignedPatientIds: [],
            active: data.active,
          }
          if (data.must_reset_pin) {
            setCurrentNurse({ ...nurse, notifications: [] })
            setScreen('nurseResetPin')
          } else {
            await loadNurseWorkspace(nurse)
            setScreen('nurse')
          }
        }
      } else if (role === 'supervisor') {
        const { data } = await supabase.from('supervisors').select('id, name, phone').eq('auth_user_id', session.user.id).single()
        if (data) {
          setCurrentSupervisor(data)
          await loadSupervisorWorkspace()
          setScreen('supervisor')
        }
      }

      setCheckingSession(false)
    }

    restore()
  }, [])

  useIdleTimeout(screen === 'nurse' || screen === 'supervisor', () => {
    const actor = screen === 'supervisor' ? currentSupervisor?.name || 'Supervisor' : currentNurse?.name || 'Nurse'
    audit('session_timeout', [], actor)
    createClient().auth.signOut()
    goLanding('Your session expired after 15 minutes of inactivity. Please sign in again.')
  })

  /* ---------------------------- Nurse auth ---------------------------- */

  async function createNurse(name: string, phone: string, pin: string) {
    setAuthError('')
    const result = await registerNurse(name, phone, pin)
    if (!result.ok) {
      setAuthError(
        result.error === 'phone_taken'
          ? 'An account with that phone number already exists. Try logging in instead.'
          : 'Something went wrong creating your account. Please try again.'
      )
      return
    }
    setAuthError('')
    audit('account_created', [], name)
    goLanding(`Thanks, ${name.split(' ')[0]}! Your account was created and is waiting on your supervisor's approval before you can sign in.`)
  }

  async function loginNurse(phone: string, pin: string) {
    setAuthError('')
    const result = await login('nurse', phone, pin)
    if (!result.ok) {
      setAuthError(
        result.error === 'pending_approval'
          ? 'Your account is awaiting supervisor approval. Please check back soon or contact your supervisor.'
          : result.error === 'account_deactivated'
            ? 'Your account has been deactivated. Contact your supervisor if this is unexpected.'
            : result.error === 'invalid_credentials'
              ? 'No matching account found. Check your phone number and PIN, or contact your supervisor for a reset.'
              : 'Something went wrong. Please try again.'
      )
      return
    }
    setAuthError('')
    setSessionMessage('')
    audit('login', [], result.profile.name)

    // The auth-login Edge Function already rejects deactivated nurses
    // before minting a session, so reaching this point means active must
    // be true — it just isn't part of the login response payload.
    const nurse: NurseAccount = {
      id: result.profile.id,
      name: result.profile.name,
      phone,
      status: 'approved',
      mustResetPin: !!result.profile.mustResetPin,
      assignedPatientIds: [],
      active: true,
    }

    if (nurse.mustResetPin) {
      setCurrentNurse({ ...nurse, notifications: [] })
      setScreen('nurseResetPin')
    } else {
      await loadNurseWorkspace(nurse)
      setScreen('nurse')
    }
  }

  /* -------------------------- Supervisor auth -------------------------- */
  // Self-service supervisor creation is intentionally gone — accounts are
  // backend-provisioned only. SupervisorAuth is always rendered in 'login'
  // mode; its onCreate branch is unreachable.

  async function loginSupervisor(phone: string, pin: string) {
    setAuthError('')
    const result = await login('supervisor', phone, pin)
    if (!result.ok) {
      setAuthError(
        result.error === 'invalid_credentials'
          ? 'Incorrect phone number or PIN.'
          : `Something went wrong signing in (${result.error}). Please try again.`
      )
      return
    }
    setAuthError('')
    setSessionMessage('')
    audit('login', [], result.profile.name)
    setCurrentSupervisor({ id: result.profile.id, name: result.profile.name, phone })
    await loadSupervisorWorkspace()
    setScreen('supervisor')
  }

  async function handleLogout(actorName: string) {
    audit('logout', [], actorName)
    await createClient().auth.signOut()
    goLanding()
  }

  // Nurse.tsx calls dbMarkNotificationsRead itself (the real Supabase
  // mutation), then calls this to reflect that locally — page.tsx owns
  // currentNurse state, so it's the only place that can update it.
  function markCurrentNurseNotificationsRead() {
    setCurrentNurse((nurse) => (nurse ? { ...nurse, notifications: nurse.notifications.map((n) => ({ ...n, read: true })) } : nurse))
  }

  /* ------------------------------ Render ------------------------------- */

  if (checkingSession) return null

  if (screen === 'landing') {
    return (
      <Landing
        onPick={(role) => {
          setAuthError('')
          setScreen(role === 'nurse' ? 'nurseAuth' : 'supervisorAuth')
        }}
        sessionMessage={sessionMessage}
        onDismissMessage={() => setSessionMessage('')}
      />
    )
  }

  if (screen === 'nurseAuth') {
    return <NurseAuth onBack={() => setScreen('landing')} onCreate={createNurse} onLogin={loginNurse} error={authError} />
  }

  if (screen === 'supervisorAuth') {
    return (
      <SupervisorAuth
        exists
        onBack={() => setScreen('landing')}
        onCreate={async () => {}}
        onLogin={loginSupervisor}
        error={authError}
      />
    )
  }

  if (screen === 'nurseResetPin' && currentNurse) {
    return (
      <NurseResetPin
        error={authError}
        onSubmit={async (newPin) => {
          const result = await setOwnPin(newPin)
          if (!result.ok) {
            setAuthError('Could not update your PIN. Please try again.')
            return
          }
          setAuthError('')
          await loadNurseWorkspace({ ...currentNurse, mustResetPin: false })
          setScreen('nurse')
        }}
      />
    )
  }

  if (screen === 'nurse' && currentNurse) {
    return (
      <NurseApp
        nurse={currentNurse}
        patients={patients}
        shifts={shifts}
        setShifts={setShifts}
        audit={audit}
        onNotificationsRead={markCurrentNurseNotificationsRead}
        onLogout={() => handleLogout(currentNurse.name)}
      />
    )
  }

  if (screen === 'supervisor' && currentSupervisor) {
    return (
      <SupervisorApp
        supervisorId={currentSupervisor.id}
        supervisorName={currentSupervisor.name}
        nurses={nurses}
        setNurses={setNurses}
        patients={patients}
        setPatients={setPatients}
        shifts={shifts}
        setShifts={setShifts}
        auditEvents={auditEvents}
        setAuditEvents={setAuditEvents}
        audit={audit}
        onLogout={() => handleLogout(currentSupervisor.name)}
      />
    )
  }

  return <Landing onPick={(role) => setScreen(role === 'nurse' ? 'nurseAuth' : 'supervisorAuth')} />
}

/* ---------------------------------------------------------------------- */

function NurseResetPin({ onSubmit, error }: { onSubmit: (pin: string) => void; error: string }) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const valid = /^\d{4,6}$/.test(pin) && pin === confirmPin

  return (
    <main className="login-screen">
      <div className="login-card">
        <p className="eyebrow">One more step</p>
        <h1>Set a new PIN.</h1>
        <p className="login-copy">Your supervisor reset your PIN. Choose a new 4–6 digit PIN to continue.</p>
        <div className="form-stack">
          <label>
            New PIN
            <input
              className="pin-input"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              type="password"
              placeholder="••••"
            />
          </label>
          <label>
            Confirm PIN
            <input
              className="pin-input"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              type="password"
              placeholder="••••"
            />
          </label>
        </div>
        {error && (
          <p className="red-text" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        <button className="primary-button wide" disabled={!valid} onClick={() => onSubmit(pin)}>
          Save new PIN
        </button>
      </div>
    </main>
  )
}