'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileText,
  History,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react'
import type { Entry, NotificationItem, NurseAccount, Patient, Shift } from '@/lib/types'
import { initials, newId, nowTime } from '@/lib/storage'
import { CARE_TAGS, ROUTES_OF_ADMINISTRATION, SEIZURE_OBSERVATIONS, TASK_GROUPS, TEMPERATURE_METHODS } from '@/lib/data'
import { Header, NurseBottomNav } from './Shared'
import {
  addEntry as dbAddEntry,
  fetchShifts,
  markNotificationsRead as dbMarkNotificationsRead,
  reopenShift as dbReopenShift,
  startShift as dbStartShift,
  submitShift as dbSubmitShift,
} from '@/lib/supabase/data'

function formatEntryStamp(entry: Entry) {
  const dateLabel = new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const timeLabel = entry.timeframe || entry.time
  return `${dateLabel} · ${timeLabel}`
}

type NurseTab = 'home' | 'patients' | 'history'
type NurseModal = 'startShift' | 'note' | 'medication' | 'incident' | 'task' | 'vitals' | 'temperature' | 'end' | null
type NurseWithNotifications = NurseAccount & { notifications: NotificationItem[] }

export function NurseApp({
  nurse,
  patients,
  shifts,
  setShifts,
  audit,
  onNotificationsRead,
  onLogout,
}: {
  nurse: NurseWithNotifications
  patients: Patient[]
  shifts: Shift[]
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>
  audit: (action: any, patientIds?: string[], actor?: string) => void
  // Owned by page.tsx, since it's the one holding `currentNurse` state —
  // this just tells it "mark all notifications read locally" after the
  // real Supabase mutation succeeds.
  onNotificationsRead: () => void
  onLogout: () => void
}) {
  const [tab, setTab] = useState<NurseTab>('home')
  const [modal, setModal] = useState<NurseModal>(null)
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([])
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [error, setError] = useState('')

  const nurseShifts = shifts.filter((shift) => shift.nurseId === nurse.id)
  const activeShift = nurseShifts.find((shift) => shift.status === 'in_progress')

  // `patients` here is already RLS-scoped to exactly this nurse's assigned
  // patients — the patients_select policy only returns rows that have a
  // matching nurse_patient_assignments row for current_nurse_id(). There's
  // no need to filter again by nurse.assignedPatientIds client-side (that
  // field is never populated on this object anyway — it only carries real
  // data on the supervisor's fetched nurses list, where it's used for the
  // "N patients assigned" count). Double-filtering here was a real bug:
  // it silently zeroed out this list regardless of what was actually
  // assigned in the database.
  const assignedPatients = patients

  async function refreshShifts() {
    const fresh = await fetchShifts(nurse.id)
    setShifts(fresh)
  }

  async function markNotificationsRead() {
    if (!nurse.notifications.some((n) => !n.read)) return
    try {
      await dbMarkNotificationsRead(nurse.id)
      onNotificationsRead()
    } catch (err) {
      console.error(err)
      setError('Could not update notifications — check your connection and try again.')
    }
  }

  async function startShift() {
    if (!selectedPatientIds.length) return
    try {
      await dbStartShift(nurse.id, selectedPatientIds)
      await refreshShifts()
      audit('created', selectedPatientIds, nurse.name)
      setError('')
    } catch (err) {
      console.error(err)
      setError('Could not start the shift — check your connection and try again.')
      return
    }
    setSelectedPatientIds([])
    setModal(null)
    setTab('home')
  }

  async function addEntry(entry: Entry, incident = false) {
    if (!activeShift) return
    try {
      await dbAddEntry(activeShift.id, entry)
      await refreshShifts()
      audit('edited', activeShift.patientIds, nurse.name)
      setError('')
      setModal(null)
    } catch (err) {
      console.error(err)
      setError('Could not save that entry — check your connection and try again.')
    }
  }

  async function submitShift(payload: { summary: string; observations: string; recommendations: string; followUp: boolean; signature: string }) {
    if (!activeShift) return
    try {
      await dbSubmitShift(activeShift.id, payload)
      await refreshShifts()
      audit('submitted', activeShift.patientIds, nurse.name)
      setError('')
      setModal(null)
      setTab('history')
    } catch (err) {
      console.error(err)
      setError('Could not submit the shift — check your connection and try again.')
    }
  }

  // A rejected shift goes back to "in progress" so the nurse can edit and
  // resubmit it — the entries, summary, etc. all stay in place for them to
  // adjust in response to the supervisor's comment.
  async function reopenShift(shiftId: string) {
    if (activeShift) return
    try {
      await dbReopenShift(shiftId)
      await refreshShifts()
      const target = shifts.find((shift) => shift.id === shiftId)
      audit('edited', target?.patientIds || [], nurse.name)
      setError('')
      setTab('home')
    } catch (err) {
      console.error(err)
      setError('Could not reopen that shift — check your connection and try again.')
    }
  }

  return (
    <div className="page-shell">
      <Header title={tab === 'home' ? 'Good morning' : tab === 'patients' ? 'Patients' : 'History'} />
      <main className="content-area">
        {error && (
          <div className="alert-callout" style={{ marginBottom: 20 }}>
            <AlertTriangle />
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}
        {tab === 'home' && (
          <NurseHome
            nurse={nurse}
            patients={patients}
            activeShift={activeShift}
            hasAssignedPatients={!!assignedPatients.length}
            onStartShift={() => setModal('startShift')}
            onAction={(type) => setModal(type)}
            onOpenNotifications={markNotificationsRead}
          />
        )}
        {tab === 'patients' && <PatientDirectory patients={assignedPatients} />}
        {tab === 'history' && (
          <NurseHistory shifts={nurseShifts} patients={patients} hasActiveShift={!!activeShift} onReopen={reopenShift} />
        )}
      </main>
      <NurseBottomNav tab={tab} onNavigate={setTab} onLogout={() => setConfirmingLogout(true)} />

      {modal === 'startShift' && (
        <StartShiftModal
          patients={assignedPatients}
          selected={selectedPatientIds}
          setSelected={setSelectedPatientIds}
          onStart={startShift}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'note' && activeShift && (
        <NoteModal shift={activeShift} patients={patients} onSave={(entry) => addEntry(entry)} onClose={() => setModal(null)} />
      )}
      {modal === 'medication' && activeShift && (
        <MedicationModal onSave={(entry) => addEntry(entry)} onClose={() => setModal(null)} />
      )}
      {modal === 'incident' && activeShift && (
        <IncidentModal onSave={(entry) => addEntry(entry, true)} onClose={() => setModal(null)} />
      )}
      {modal === 'task' && activeShift && (
        <TaskModal onSave={(entry) => addEntry(entry)} onClose={() => setModal(null)} />
      )}
      {modal === 'vitals' && activeShift && (
        <VitalsModal onSave={(entry) => addEntry(entry)} onClose={() => setModal(null)} />
      )}
      {modal === 'temperature' && activeShift && (
        <TemperatureModal onSave={(entry) => addEntry(entry)} onClose={() => setModal(null)} />
      )}
      {modal === 'end' && activeShift && (
        <EndShiftModal shift={activeShift} nurse={nurse} onSubmit={submitShift} onClose={() => setModal(null)} />
      )}

      {confirmingLogout && (
        <ConfirmModal
          title="Sign out?"
          body="You'll need your phone number and PIN to sign back in. Any unsaved draft text will be kept for next time."
          confirmLabel="Sign out"
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={() => {
            setConfirmingLogout(false)
            onLogout()
          }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------- */

function NurseHome({
  nurse,
  patients,
  activeShift,
  hasAssignedPatients,
  onStartShift,
  onAction,
  onOpenNotifications,
}: {
  nurse: NurseWithNotifications
  patients: Patient[]
  activeShift?: Shift
  hasAssignedPatients: boolean
  onStartShift: () => void
    onAction: (type: 'note' | 'medication' | 'incident' | 'task' | 'vitals' | 'temperature' | 'end') => void
  onOpenNotifications: () => void
}) {
  const [showNotifications, setShowNotifications] = useState(false)
  const activePatients = activeShift ? patients.filter((patient) => activeShift.patientIds.includes(patient.id)) : []
  const hoursLogged = activeShift ? activeShift.entries.length : 0
  const notifications = [...nurse.notifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <h2>Ready for your shift?</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="notification-bell-wrap">
            <button
              className="icon-button notification-bell"
              aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
              onClick={() => {
                const next = !showNotifications
                setShowNotifications(next)
                if (next) onOpenNotifications()
              }}
            >
              <Bell />
              {unreadCount > 0 && <span className="notification-dot">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="notification-panel">
                <div className="notification-panel-head">
                  <strong>Notifications</strong>
                  <button className="icon-button" onClick={() => setShowNotifications(false)} aria-label="Close notifications">
                    ×
                  </button>
                </div>
                {notifications.length ? (
                  <div className="notification-list">
                    {notifications.map((item) => (
                      <div className="notification-item" key={item.id}>
                        <span className={`notification-icon ${item.type === 'approved' ? 'green' : 'red'}`}>
                          {item.type === 'approved' ? <CheckCircle2 /> : <XCircle />}
                        </span>
                        <div>
                          <p>{item.message}</p>
                          <small>{new Date(item.timestamp).toLocaleString()}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="notification-empty">No notifications yet. You&apos;ll be notified here when a supervisor reviews your shift.</p>
                )}
              </div>
            )}
          </div>
          <div className="avatar">{initials(nurse.name)}</div>
        </div>
      </div>

      {activeShift?.reviewComment && activeShift.status === 'in_progress' && (
        <div className="alert-callout" style={{ marginBottom: 20 }}>
          <AlertTriangle />
          <div>
            <strong>Your supervisor requested changes to this shift.</strong>
            <p>{activeShift.reviewComment}</p>
          </div>
        </div>
      )}

      {activeShift ? (
        <button className="hero-card" onClick={() => onAction('note')}>
          <div className="hero-icon">
            <Stethoscope />
          </div>
          <div className="hero-copy">
            <span className="status-badge teal">Active shift</span>
            <h3>{activePatients.map((p) => p.name).join(', ') || 'Patient care'}</h3>
            <p>Started {new Date(activeShift.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
          <ChevronRight />
        </button>
      ) : (
        <section className="start-shift-panel">
          <Clock3 />
          <div>
            <h3>No active shift</h3>
            <p>{hasAssignedPatients ? 'Select a patient before starting a shift.' : 'Ask your supervisor to assign you a patient to get started.'}</p>
          </div>
          <button className="primary-button" onClick={onStartShift} disabled={!hasAssignedPatients}>
            Choose patient
          </button>
        </section>
      )}

      <section className="section-block">
        <div className="section-heading">
          <h3>Quick actions</h3>
          <span className="muted">Add to today&apos;s record</span>
        </div>
        <div className="action-grid">
          <button disabled={!activeShift} onClick={() => onAction('note')}>
            <span className="action-icon teal-bg">
              <FileText />
            </span>
            <strong>Add note</strong>
            <small>Hourly care update</small>
          </button>
          <button disabled={!activeShift} onClick={() => onAction('medication')}>
            <span className="action-icon blue-bg">
              <Pill />
            </span>
            <strong>Log medication</strong>
            <small>Record administration</small>
          </button>
          <button disabled={!activeShift} onClick={() => onAction('incident')}>
            <span className="action-icon red-bg">
              <AlertTriangle />
            </span>
            <strong>Report incident</strong>
            <small>Document an event</small>
          </button>
          <button disabled={!activeShift} onClick={() => onAction('task')}>
            <span className="action-icon amber-bg">
              <ClipboardList />
            </span>
            <strong>Task</strong>
            <small>Check off completed tasks</small>
          </button>
                    <button disabled={!activeShift} onClick={() => onAction('vitals')}>
            <span className="action-icon blue-bg">
              <Pill />
            </span>
            <strong>Log vitals</strong>
            <small>BP, pulse, resp, O2</small>
          </button>
          <button disabled={!activeShift} onClick={() => onAction('temperature')}>
            <span className="action-icon amber-bg">
              <FileText />
            </span>
            <strong>Log temperature</strong>
            <small>Record a reading</small>
          </button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h3>Today&apos;s progress</h3>
        </div>
        <div className="progress-card">
          <div className="progress-ring">
            <span>{hoursLogged}</span>
            <small>entries</small>
          </div>
          <div>
            <strong>Shift documentation</strong>
            <p>{activeShift ? `${hoursLogged} entr${hoursLogged === 1 ? 'y' : 'ies'} recorded this shift` : 'Start a shift to begin recording care'}</p>
            <div className="progress-track">
              <span style={{ width: activeShift ? `${Math.min(hoursLogged * 12, 100)}%` : '0%' }} />
            </div>
          </div>
        </div>
      </section>

      {activeShift && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <h3>Care timeline</h3>
            </div>
            {activeShift.entries.length ? (
              <div className="timeline-list">
                {activeShift.entries.map((entry) => (
                  <TimelineItem key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FileText />
                <strong>Nothing logged yet</strong>
                <p>Your notes, medications, and incidents will appear here.</p>
              </div>
            )}
          </section>
          <button className="secondary-button wide" onClick={() => onAction('end')}>
            End shift &amp; review
          </button>
        </>
      )}
    </>
  )
}

function TimelineItem({ entry }: { entry: Entry }) {
    const icon =
      entry.kind === 'incident' ? <AlertTriangle />
      : entry.kind === 'medication' ? <Pill />
      : entry.kind === 'task' ? <ClipboardList />
      : entry.kind === 'vitals' ? <Stethoscope />
      : entry.kind === 'temperature' ? <FileText />
      : <FileText />
    const title =
      entry.kind === 'medication'
        ? `${entry.drug} · ${entry.medStatus}`
        : entry.kind === 'incident'
          ? 'Seizure incident'
          : entry.kind === 'task'
            ? 'Tasks completed'
            : entry.kind === 'vitals'
              ? 'Vitals recorded'
              : entry.kind === 'temperature'
                ? 'Temperature recorded'
                : 'Hourly note'
  return (
    <div className="timeline-item">
      <div className="timeline-line">
        <div className="timeline-dot" />
      </div>
      <div className="timeline-content">
        <div className="timeline-meta">
          <span>{formatEntryStamp(entry)}</span>
          {entry.kind === 'incident' && <span className="status-badge critical-flash">⚠ SEIZURE</span>}
          {entry.status === 'Needs attention' && <span className="status-badge amber">Needs attention</span>}
        </div>
        <h4>
          {icon} {title}
        </h4>
        {entry.kind === 'medication' && (entry.route || entry.administeredAt) && (
          <p className="muted-meta">
            {entry.route ? `Route: ${entry.route}` : ''}
            {entry.route && entry.administeredAt ? ' · ' : ''}
            {entry.administeredAt ? `Given at ${entry.administeredAt}` : ''}
          </p>
        )}
        <p>{entry.detail}</p>
        {!!entry.tags?.length && (
          <div className="tag-grid" style={{ marginTop: 8, marginBottom: 0 }}>
            {entry.tags.map((tag) => (
              <span className="tag-chip selected" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {!!entry.tasks?.length && (
          <div className="tag-grid" style={{ marginTop: 8, marginBottom: 0 }}>
            {entry.tasks.map((task) => (
              <span className="tag-chip selected" key={task}>
                {task}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- */

function PatientDirectory({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState('')
  const list = patients.filter((patient) => `${patient.name} ${patient.room}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <div className="search-box">
        <Search />
        <input aria-label="Search patients" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or room" />
      </div>
      <div className="patient-results">
        {list.map((patient) => (
          <div className="patient-result" key={patient.id}>
            <div className="patient-photo">{initials(patient.name)}</div>
            <div>
              <strong>{patient.name}</strong>
              <p>{patient.room}</p>
              {!!patient.diagnoses?.length && <small>{patient.diagnoses.map((d) => d.name).join(', ')}</small>}
            </div>
          </div>
        ))}
        {!list.length && (
          <div className="empty-state">
            <UsersRound />
            <strong>No patients assigned yet</strong>
            <p>Your supervisor assigns patients to your account — reach out to them if you&apos;re expecting one.</p>
          </div>
        )}
      </div>
      <div className="prototype-note">
        <ShieldCheck />
        <span>
          <strong>Patient records are protected.</strong> Only you and your supervisor can see this information.
        </span>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------------- */

function StartShiftModal({
  patients,
  selected,
  setSelected,
  onStart,
  onClose,
}: {
  patients: Patient[]
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  onStart: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const list = patients.filter((patient) => `${patient.name} ${patient.room}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <Modal title="Who are you caring for?" onClose={onClose}>
      <p className="lead">Select one or more of your assigned patients.</p>
      <div className="search-box" style={{ marginTop: 14 }}>
        <Search />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients" />
      </div>
      <div className="patient-results">
        {list.map((patient) => (
          <button
            key={patient.id}
            className="patient-result"
            style={selected.includes(patient.id) ? { borderColor: 'var(--primary)', background: 'var(--teal-soft)' } : undefined}
            onClick={() => setSelected((ids) => (ids.includes(patient.id) ? ids.filter((id) => id !== patient.id) : [...ids, patient.id]))}
          >
            <div className="patient-photo">{initials(patient.name)}</div>
            <div>
              <strong>{patient.name}</strong>
              <p>{patient.room}</p>
            </div>
            {selected.includes(patient.id) && <Check />}
          </button>
        ))}
        {!list.length && (
          <div className="empty-state">
            <UsersRound />
            <strong>No assigned patients found</strong>
            <p>Ask your supervisor to assign you a patient.</p>
          </div>
        )}
      </div>
      <button className="primary-button wide" disabled={!selected.length} onClick={onStart}>
        Start shift with {selected.length || ''} patient{selected.length === 1 ? '' : 's'}
      </button>
    </Modal>
  )
}

function NoteModal({ shift, patients, onSave, onClose }: { shift: Shift; patients: Patient[]; onSave: (entry: Entry) => void; onClose: () => void }) {
  const draftKey = `gs-draft-note-${shift.id}`
  const [status, setStatus] = useState<'Stable' | 'Needs attention'>('Stable')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [loggingMode, setLoggingMode] = useState<'now' | 'timeframe'>('now')
  const [timeFrom, setTimeFrom] = useState('')
  const [timeTo, setTimeTo] = useState('')

  // Restore an in-progress draft if the session timed out mid-entry.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw)
        setStatus(draft.status ?? 'Stable')
        setTags(draft.tags ?? [])
        setNote(draft.note ?? '')
        setLoggingMode(draft.loggingMode ?? 'now')
        setTimeFrom(draft.timeFrom ?? '')
        setTimeTo(draft.timeTo ?? '')
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ status, tags, note, loggingMode, timeFrom, timeTo }))
  }, [draftKey, status, tags, note, loggingMode, timeFrom, timeTo])

  function toggleTag(tag: string) {
    setTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))
  }

  function formatClock(value: string) {
    if (!value) return ''
    const [hourStr, minuteStr] = value.split(':')
    const hour = Number(hourStr)
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const displayHour = ((hour + 11) % 12) + 1
    return `${displayHour}:${minuteStr} ${suffix}`
  }

  const timeframeLabel = timeFrom && timeTo ? `${formatClock(timeFrom)} – ${formatClock(timeTo)}` : ''
  const canSave = note.trim().length > 0 || tags.length > 0
  const timeframeValid = loggingMode === 'now' || (timeFrom && timeTo)

  function save() {
    onSave({
      id: newId(),
      kind: 'note',
      time: nowTime(),
      timestamp: new Date().toISOString(),
      status,
      tags,
      detail: note.trim() || 'Routine care observed.',
      timeframe: loggingMode === 'timeframe' ? timeframeLabel : undefined,
    })
    localStorage.removeItem(draftKey)
  }

  const patientNames = shift.patientIds.map((id) => patients.find((p) => p.id === id)?.name).filter(Boolean).join(', ')

  return (
    <Modal title="Add hourly note" onClose={onClose}>
      <p className="lead">{patientNames}</p>
      <label className="field-label">How is the patient doing?</label>
      <div className="choice-row">
        <button className={status === 'Stable' ? 'selected' : ''} onClick={() => setStatus('Stable')}>
          Stable
        </button>
        <button className={status === 'Needs attention' ? 'selected attention' : ''} onClick={() => setStatus('Needs attention')}>
          Needs attention
        </button>
      </div>
      <label className="field-label">What happened this hour?</label>
      <div className="tag-grid">
        {CARE_TAGS.map((tag) => (
          <button key={tag} className={`tag-chip ${tags.includes(tag) ? 'selected' : ''}`} onClick={() => toggleTag(tag)}>
            {tag}
          </button>
        ))}
      </div>
      <label className="field-label">
        Notes
        <textarea className="large-textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add any details for this hour" />
      </label>

      <label className="field-label">When did this happen?</label>
      <div className="choice-row">
        <button className={loggingMode === 'now' ? 'selected' : ''} onClick={() => setLoggingMode('now')}>
          Logging now
        </button>
        <button className={loggingMode === 'timeframe' ? 'selected' : ''} onClick={() => setLoggingMode('timeframe')}>
          Add a timeframe
        </button>
      </div>
      {loggingMode === 'timeframe' && (
        <div className="form-row">
          <label>
            From
            <input type="time" value={timeFrom} onChange={(event) => setTimeFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="time" value={timeTo} onChange={(event) => setTimeTo(event.target.value)} />
          </label>
        </div>
      )}
      {loggingMode === 'timeframe' && timeframeLabel && <p className="helper-text" style={{ textAlign: 'left' }}>Logged for {timeframeLabel}</p>}

      <button className="primary-button wide" disabled={!canSave || !timeframeValid} onClick={save}>
        <Check /> Save note
      </button>
      <p className="helper-text">This entry stays editable until you sign and submit the shift.</p>
    </Modal>
  )
}

function MedicationModal({ onSave, onClose }: { onSave: (entry: Entry) => void; onClose: () => void }) {
  const [drug, setDrug] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('')
  const [administeredAt, setAdministeredAt] = useState(() => {
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  const [medStatus, setMedStatus] = useState<'Given' | 'Refused'>('Given')
  const [reason, setReason] = useState('')

  function formatClock(value: string) {
    if (!value) return ''
    const [hourStr, minuteStr] = value.split(':')
    const hour = Number(hourStr)
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const displayHour = ((hour + 11) % 12) + 1
    return `${displayHour}:${minuteStr} ${suffix}`
  }

  return (
    <Modal title="Log medication" onClose={onClose}>
      <div className="form-stack">
        <label>
          Medication name
          <input value={drug} onChange={(event) => setDrug(event.target.value)} placeholder="e.g. Acetaminophen" />
        </label>
        <div className="form-row">
          <label>
            Dose
            <input value={dose} onChange={(event) => setDose(event.target.value)} placeholder="e.g. 500 mg" />
          </label>
          <label>
            Route
            <select value={route} onChange={(event) => setRoute(event.target.value)}>
              <option value="">Select route</option>
              {ROUTES_OF_ADMINISTRATION.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Time of administration
          <input type="time" value={administeredAt} onChange={(event) => setAdministeredAt(event.target.value)} />
        </label>
      </div>
      <label className="field-label">Result</label>
      <div className="choice-row">
        <button className={medStatus === 'Given' ? 'selected' : ''} onClick={() => setMedStatus('Given')}>
          Given
        </button>
        <button className={medStatus === 'Refused' ? 'selected attention' : ''} onClick={() => setMedStatus('Refused')}>
          Refused
        </button>
      </div>
      {medStatus === 'Refused' && (
        <label className="field-label">
          Reason
          <textarea className="large-textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why was it refused?" />
        </label>
      )}
      <button
        className="primary-button wide"
        disabled={!drug.trim() || !dose.trim() || !route || (medStatus === 'Refused' && !reason.trim())}
        onClick={() =>
          onSave({
            id: newId(),
            kind: 'medication',
            time: nowTime(),
            timestamp: new Date().toISOString(),
            drug: drug.trim(),
            dose: dose.trim(),
            route,
            administeredAt: formatClock(administeredAt),
            medStatus,
            reason: reason.trim(),
            detail: medStatus === 'Given' ? `${dose.trim()} administered.` : `Refused — ${reason.trim()}`,
          })
        }
      >
        <Check /> Save medication
      </button>
    </Modal>
  )
}

function IncidentModal({ onSave, onClose }: { onSave: (entry: Entry) => void; onClose: () => void }) {
  const [length, setLength] = useState('')
  const [observations, setObservations] = useState<string[]>([])
  const [comment, setComment] = useState('')

  function toggle(item: string) {
    setObservations((current) => (current.includes(item) ? current.filter((o) => o !== item) : [...current, item]))
  }

  return (
    <Modal title="Report an incident" onClose={onClose}>
      <div className="alert-callout">
        <AlertTriangle />
        <div>
          <strong>This will flag the shift for priority supervisor attention.</strong>
        </div>
      </div>
      <label className="field-label">
        Length of seizure
        <input value={length} onChange={(event) => setLength(event.target.value)} placeholder="e.g. 30 seconds" />
      </label>
      <label className="field-label">Observations</label>
      <div className="tag-grid">
        {SEIZURE_OBSERVATIONS.map((item) => (
          <button key={item} className={`tag-chip ${observations.includes(item) ? 'selected' : ''}`} onClick={() => toggle(item)}>
            {item}
          </button>
        ))}
      </div>
      <label className="field-label">
        Recovery observations &amp; comments
        <textarea className="large-textarea" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What happened during recovery?" />
      </label>
      <button
        className="primary-button wide"
        disabled={!length.trim() && !observations.length && !comment.trim()}
        onClick={() =>
          onSave({
            id: newId(),
            kind: 'incident',
            time: nowTime(),
            timestamp: new Date().toISOString(),
            lengthOfEvent: length.trim(),
            observations,
            detail: comment.trim() || 'Seizure observed — see recorded observations.',
          })
        }
      >
        <Check /> Save incident report
      </button>
    </Modal>
  )
}

function TaskModal({ onSave, onClose }: { onSave: (entry: Entry) => void; onClose: () => void }) {
  const [checked, setChecked] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [note, setNote] = useState('')

  function toggle(task: string) {
    setChecked((current) => (current.includes(task) ? current.filter((t) => t !== task) : [...current, task]))
  }

  const allTasks = [...checked, ...(otherText.trim() ? [otherText.trim()] : [])]
  const canSave = allTasks.length > 0

  return (
    <Modal title="Log tasks completed" onClose={onClose}>
      <p className="lead">Check off everything you completed this shift.</p>
      {TASK_GROUPS.map((group) => (
        <div key={group.label} style={{ marginTop: 20 }}>
          <label className="field-label">{group.label}</label>
          <div className="task-checklist">
            {group.tasks.map((task) => (
              <label key={task} className="task-check-row">
                <input type="checkbox" checked={checked.includes(task)} onChange={() => toggle(task)} />
                <span>{task}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <label className="field-label">
        Other (optional)
        <input value={otherText} onChange={(event) => setOtherText(event.target.value)} placeholder="Anything not listed above" />
      </label>
      <label className="field-label">
        Notes
        <textarea className="large-textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add any details" />
      </label>
      <button
        className="primary-button wide"
        disabled={!canSave}
        onClick={() =>
          onSave({
            id: newId(),
            kind: 'task',
            time: nowTime(),
            timestamp: new Date().toISOString(),
            tasks: allTasks,
            detail: note.trim() || `${allTasks.length} task${allTasks.length === 1 ? '' : 's'} completed.`,
          })
        }
      >
        <Check /> Save tasks
      </button>
    </Modal>
  )
}

function VitalsModal({ onSave, onClose }: { onSave: (entry: Entry) => void; onClose: () => void }) {
  const [bp, setBp] = useState('')
  const [pulse, setPulse] = useState('')
  const [resp, setResp] = useState('')
  const [o2, setO2] = useState('')
  const [note, setNote] = useState('')
  const canSave = bp.trim() || pulse.trim() || resp.trim() || o2.trim()

  return (
    <Modal title="Log vitals" onClose={onClose}>
      <div className="form-stack">
        <label>
          Blood pressure
          <input value={bp} onChange={(event) => setBp(event.target.value)} placeholder="e.g. 120/80" />
        </label>
        <div className="form-row">
          <label>
            Pulse (bpm)
            <input value={pulse} onChange={(event) => setPulse(event.target.value)} />
          </label>
          <label>
            Resp. rate
            <input value={resp} onChange={(event) => setResp(event.target.value)} />
          </label>
        </div>
        <label>
          O2 saturation (%)
          <input value={o2} onChange={(event) => setO2(event.target.value)} />
        </label>
        <label>
          Notes
          <textarea className="large-textarea" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      <button
        className="primary-button wide"
        disabled={!canSave}
        onClick={() =>
          onSave({
            id: newId(),
            kind: 'vitals',
            time: nowTime(),
            timestamp: new Date().toISOString(),
            bloodPressure: bp.trim(),
            pulse: pulse.trim(),
            respiratoryRate: resp.trim(),
            oxygenSaturation: o2.trim(),
            detail: note.trim() || `BP ${bp} · Pulse ${pulse} · Resp ${resp} · O2 ${o2}%`,
          })
        }
      >
        <Check /> Save vitals
      </button>
    </Modal>
  )
}

function TemperatureModal({ onSave, onClose }: { onSave: (entry: Entry) => void; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState<'F' | 'C'>('F')
  const [method, setMethod] = useState('')

  return (
    <Modal title="Log temperature" onClose={onClose}>
      <div className="form-stack">
        <div className="form-row">
          <label>
            Temperature
            <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="e.g. 98.6" />
          </label>
          <label>
            Unit
            <select value={unit} onChange={(event) => setUnit(event.target.value as 'F' | 'C')}>
              <option value="F">°F</option>
              <option value="C">°C</option>
            </select>
          </label>
        </div>
        <label>
          Method
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">Select method</option>
            {TEMPERATURE_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="primary-button wide"
        disabled={!value.trim() || !method}
        onClick={() =>
          onSave({
            id: newId(),
            kind: 'temperature',
            time: nowTime(),
            timestamp: new Date().toISOString(),
            temperatureValue: value.trim(),
            temperatureUnit: unit,
            temperatureMethod: method,
            detail: `${value.trim()}°${unit} (${method})`,
          })
        }
      >
        <Check /> Save temperature
      </button>
    </Modal>
  )
}

function EndShiftModal({
  shift,
  nurse,
  onSubmit,
  onClose,
}: {
  shift: Shift
  nurse: NurseAccount
  onSubmit: (payload: { summary: string; observations: string; recommendations: string; followUp: boolean; signature: string }) => void
  onClose: () => void
}) {
  const [summary, setSummary] = useState(shift.summary || '')
  const [observations, setObservations] = useState(shift.observations || '')
  const [recommendations, setRecommendations] = useState(shift.recommendations || '')
  const [followUp, setFollowUp] = useState(!!shift.followUp)
  const [confirmed, setConfirmed] = useState(false)
  const [signature, setSignature] = useState('')

  const checklist = [
    { label: 'At least one entry recorded', met: shift.entries.length > 0 },
    { label: 'Summary of care completed', met: summary.trim().length > 0 },
    { label: 'Follow-up status identified', met: true },
  ]
  const allMet = checklist.every((item) => item.met) && confirmed && signature.trim().toLowerCase() === nurse.name.toLowerCase()

  return (
    <Modal title={shift.reviewComment ? 'Fix & resubmit shift' : 'End shift'} onClose={onClose}>
      {shift.reviewComment && (
        <div className="alert-callout">
          <AlertTriangle />
          <div>
            <strong>Your supervisor requested changes:</strong>
            <p>{shift.reviewComment}</p>
          </div>
        </div>
      )}
      <label className="field-label">
        Summary of care
        <textarea className="large-textarea tall" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Share the most important handoff details." />
      </label>
      <label className="field-label">
        Clinical observations
        <textarea className="large-textarea" value={observations} onChange={(event) => setObservations(event.target.value)} placeholder="Anything clinically relevant this shift" />
      </label>
      <label className="field-label">
        Recommendations
        <textarea className="large-textarea" value={recommendations} onChange={(event) => setRecommendations(event.target.value)} placeholder="Any recommendations worth flagging" />
      </label>
      <label className="field-label">Anything unusual or needing follow-up?</label>
      <div className="choice-row">
        <button className={!followUp ? 'selected' : ''} onClick={() => setFollowUp(false)}>
          No
        </button>
        <button className={followUp ? 'selected attention' : ''} onClick={() => setFollowUp(true)}>
          Yes
        </button>
      </div>

      <div className="checklist-card" style={{ marginTop: 20 }}>
        {checklist.map((item) => (
          <div key={item.label}>
            <span className="check-bubble" style={!item.met ? { background: 'var(--muted)', color: 'var(--muted-foreground)' } : undefined}>
              <Check />
            </span>
            <span>
              <strong>{item.label}</strong>
            </span>
          </div>
        ))}
      </div>

      <label className="checkbox-row">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        I confirm this note is accurate.
      </label>
      <label className="field-label">
        Type your name to sign
        <input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder={nurse.name} />
      </label>
      <button
        className="primary-button wide"
        disabled={!allMet}
        onClick={() => onSubmit({ summary: summary.trim(), observations: observations.trim(), recommendations: recommendations.trim(), followUp, signature: signature.trim() })}
      >
        {shift.reviewComment ? 'Resubmit shift' : 'Sign & submit shift'}
      </button>
    </Modal>
  )
}

/* ---------------------------------------------------------------------- */

function NurseHistory({
  shifts,
  patients,
  hasActiveShift,
  onReopen,
}: {
  shifts: Shift[]
  patients: Patient[]
  hasActiveShift: boolean
  onReopen: (shiftId: string) => void
}) {
  const sorted = [...shifts].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  if (!sorted.length) {
    return (
      <div className="empty-state">
        <History />
        <strong>No completed shifts yet</strong>
        <p>Your signed shift notes will appear here.</p>
      </div>
    )
  }
  return (
    <div className="history-list">
      {sorted.map((shift) => (
        <div className="history-card" key={shift.id} style={{ flexWrap: 'wrap' }}>
          <div className="history-date">
            <Clock3 />
            <span>{new Date(shift.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="history-main">
            <strong>{shift.patientIds.map((id) => patients.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</strong>
            <p>
              {shift.entries.length} entr{shift.entries.length === 1 ? 'y' : 'ies'} ·{' '}
              {shift.submittedAt ? `Submitted ${new Date(shift.submittedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'In progress'}
            </p>
            {shift.reviewComment && <p className="red-text">{shift.reviewComment}</p>}
          </div>
          <span className={`status-badge ${shift.status === 'approved' ? 'green' : shift.status === 'rejected' ? 'red' : shift.status === 'submitted' ? 'amber' : 'neutral'}`}>
            {shift.status === 'rejected' ? 'Needs correction' : shift.status.replace('_', ' ')}
          </span>
          {shift.status === 'rejected' && (
            <button
              className="secondary-button"
              style={{ width: '100%', marginTop: 4 }}
              disabled={hasActiveShift}
              onClick={() => onReopen(shift.id)}
            >
              {hasActiveShift ? 'Finish your current shift first' : 'Fix & resubmit'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger,
  onCancel,
  onConfirm,
}: {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-overlay" role="alertdialog" aria-modal="true">
      <div className="modal-card confirm-card">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onCancel} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">
          <p className="lead">{body}</p>
          <div className="review-actions" style={{ marginTop: 22 }}>
            <button className="secondary-button" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button className={danger ? 'danger-outline' : 'primary-button'} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}