'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  FileText,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react'
import type { AuditAction, AuditEvent, Entry, NurseAccount, Patient, Shift } from '@/lib/types'
import { generateTempPin, initials } from '@/lib/storage'
import { Header, SupervisorBottomNav } from './Shared'
import { ConfirmModal } from './Nurse'
import {
  addPatient as addPatientMutation,
  approveNurse as approveNurseMutation,
  assignPatients as assignPatientsMutation,
  fetchAuditEvents,
  fetchNurses,
  fetchPatients,
  fetchShifts,
  removeNurse as removeNurseMutation,
  removePatient as removePatientMutation,
  resetNursePin as resetNursePinMutation,
  reviewShift,
  setNurseActive,
  updatePatient as updatePatientMutation,
} from '@/lib/supabase/data'

type SupervisorTab = 'queue' | 'activity' | 'team' | 'patients'
type QueueFilter = 'all' | 'incidents' | 'pending'

export function SupervisorApp({
  supervisorId,
  supervisorName,
  nurses,
  setNurses,
  patients,
  setPatients,
  shifts,
  setShifts,
  auditEvents,
  setAuditEvents,
  audit,
  onLogout,
}: {
  supervisorId: string
  supervisorName: string
  nurses: NurseAccount[]
  setNurses: React.Dispatch<React.SetStateAction<NurseAccount[]>>
  patients: Patient[]
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>
  shifts: Shift[]
  setShifts: React.Dispatch<React.SetStateAction<Shift[]>>
  auditEvents: AuditEvent[]
  setAuditEvents: React.Dispatch<React.SetStateAction<AuditEvent[]>>
  audit: (action: AuditAction, patientIds?: string[], actor?: string) => void
  onLogout: () => void
}) {
  const [tab, setTab] = useState<SupervisorTab>('queue')
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const [error, setError] = useState('')

  const submittedShifts = shifts.filter((shift) => shift.status !== 'in_progress')
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId) || null

  async function review(status: 'approved' | 'rejected', comment: string) {
    if (!selectedShift) return
    setError('')
    try {
      const dateLabel = new Date(selectedShift.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const message =
        status === 'approved'
          ? `Your shift from ${dateLabel} was approved.`
          : `Your shift from ${dateLabel} needs a correction${comment ? `: ${comment}` : '.'}`

      await reviewShift(selectedShift.id, selectedShift.nurseId, status, comment, supervisorId, message)
      setShifts(await fetchShifts())
      audit(status === 'approved' ? 'approved' : 'rejected', selectedShift.patientIds, supervisorName)
    } catch {
      setError('Could not save the review. Please try again.')
    }
  }

  // Generates the temp PIN client-side, hashes+stores it server-side via
  // the reset_nurse_pin RPC, then returns it so the caller can display it
  // once. There's no way to recover it after this — a further reset is
  // the only recourse if it's lost before being shared with the nurse.
  async function handleResetPin(nurseId: string): Promise<string> {
    const temp = generateTempPin()
    await resetNursePinMutation(nurseId, temp)
    setNurses(await fetchNurses())
    audit('pin_reset', [], supervisorName)
    return temp
  }

  // Reuses the 'edited' audit action rather than adding new audit_action
  // enum values — ALTER TYPE ... ADD VALUE can't safely share a paste
  // with statements that use the new value, so it's not worth the
  // migration friction for what the activity log can already convey via
  // the nurse's name.
  async function handleToggleActive(nurseId: string, active: boolean) {
    setError('')
    try {
      await setNurseActive(nurseId, active)
      setNurses(await fetchNurses())
      audit('edited', [], supervisorName)
    } catch {
      setError(`Could not ${active ? 'reactivate' : 'deactivate'} that nurse. Please try again.`)
    }
  }

  async function handleRemoveNurse(nurseId: string) {
    setError('')
    try {
      await removeNurseMutation(nurseId)
      setNurses(await fetchNurses())
      audit('edited', [], supervisorName)
    } catch {
      setError('Could not remove that nurse. Please try again.')
    }
  }

  // approve_nurse already writes its own audit_events row server-side
  // (see 0002_auth_fixes.sql) — don't also call audit() here, or every
  // approval logs twice. Refetching audit events picks up the row the RPC
  // just wrote.
  async function handleApproveNurse(nurseId: string) {
    setError('')
    try {
      await approveNurseMutation(nurseId)
      const [nursesData, auditData] = await Promise.all([fetchNurses(), fetchAuditEvents()])
      setNurses(nursesData)
      setAuditEvents(auditData)
    } catch {
      setError('Could not approve that nurse. Please try again.')
    }
  }

  async function handleAssignPatients(nurseId: string, patientIds: string[]) {
    setError('')
    try {
      await assignPatientsMutation(nurseId, patientIds, supervisorId)
      setNurses(await fetchNurses())
      audit('assigned', patientIds, supervisorName)
    } catch {
      setError('Could not save that assignment. Please try again.')
    }
  }

  async function handleAddPatient(
    name: string,
    room: string,
    dob: string,
    medicaidNumber: string,
    diagnoses: { name: string; description?: string }[]
  ) {
    setError('')
    try {
      const patientId = await addPatientMutation(name, room, dob, medicaidNumber, diagnoses, supervisorId)
      setPatients(await fetchPatients())
      audit('created', [patientId], supervisorName)
    } catch {
      setError('Could not add that patient. Please try again.')
    }
  }

  async function handleUpdatePatient(
    id: string,
    name: string,
    room: string,
    dob: string,
    medicaidNumber: string,
    diagnoses: { name: string; description?: string }[]
  ) {
    setError('')
    try {
      await updatePatientMutation(id, name, room, dob, medicaidNumber, diagnoses)
      setPatients(await fetchPatients())
      audit('edited', [id], supervisorName)
    } catch {
      setError('Could not save those changes. Please try again.')
    }
  }

  // Patients with shift history can't be deleted (DB-level restrict) —
  // removePatientMutation turns that into a friendly message we surface
  // here instead of a raw Postgres error.
  async function handleRemovePatient(id: string) {
    setError('')
    try {
      await removePatientMutation(id)
      const [patientsData, nursesData] = await Promise.all([fetchPatients(), fetchNurses()])
      setPatients(patientsData)
      setNurses(nursesData)
      audit('edited', [id], supervisorName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that patient. Please try again.')
    }
  }

  return (
    <div className="page-shell">
      <Header
        title={selectedShift ? 'Shift review' : tab === 'queue' ? 'Review queue' : tab === 'activity' ? 'Activity log' : tab === 'team' ? 'Nurses' : 'Patients'}
        eyebrow="Supervisor portal"
        onBack={selectedShift ? () => setSelectedShiftId(null) : undefined}
      />
      <main className="content-area">
        {error && (
          <div className="alert-callout" style={{ marginBottom: 16 }}>
            <AlertTriangle />
            <div>
              <p>{error}</p>
            </div>
          </div>
        )}
        {selectedShift ? (
          <ShiftDetail shift={selectedShift} patients={patients} onReview={review} />
        ) : tab === 'queue' ? (
          <ReviewQueue shifts={submittedShifts} patients={patients} filter={filter} setFilter={setFilter} onOpen={setSelectedShiftId} />
        ) : tab === 'activity' ? (
          <ActivityLog events={auditEvents} patients={patients} />
        ) : tab === 'team' ? (
          <TeamPanel
            nurses={nurses}
            patients={patients}
            onReset={handleResetPin}
            onRemove={handleRemoveNurse}
            onApprove={handleApproveNurse}
            onAssign={handleAssignPatients}
            onToggleActive={handleToggleActive}
          />
        ) : (
          <PatientsPanel patients={patients} onAdd={handleAddPatient} onUpdate={handleUpdatePatient} onRemove={handleRemovePatient} />
        )}
      </main>
      {!selectedShift && <SupervisorBottomNav tab={tab} onNavigate={setTab} onLogout={() => setConfirmingLogout(true)} />}

      {confirmingLogout && (
        <ConfirmModal
          title="Sign out?"
          body="You'll need your phone number and PIN to sign back in."
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

function ReviewQueue({
  shifts,
  patients,
  filter,
  setFilter,
  onOpen,
}: {
  shifts: Shift[]
  patients: Patient[]
  filter: QueueFilter
  setFilter: (filter: QueueFilter) => void
  onOpen: (id: string) => void
}) {
  const list = shifts
    .filter((shift) => (filter === 'incidents' ? shift.incident : filter === 'pending' ? shift.status === 'submitted' : true))
    .sort((a, b) => {
      if (!!a.incident !== !!b.incident) return a.incident ? -1 : 1
      return new Date(b.submittedAt || b.startedAt).getTime() - new Date(a.submittedAt || a.startedAt).getTime()
    })

  return (
    <>
      <div className="queue-summary">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h2>{shifts.length} shift{shifts.length === 1 ? '' : 's'} to review</h2>
        </div>
      </div>

      <div className="metric-grid" style={{ margin: '20px 0' }}>
        <div className="metric-card">
          <span className="metric-label">Pending</span>
          <strong>{shifts.filter((s) => s.status === 'submitted').length}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Incidents</span>
          <strong>{shifts.filter((s) => s.incident).length}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Approved</span>
          <strong>{shifts.filter((s) => s.status === 'approved').length}</strong>
        </div>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All
        </button>
        <button className={`filter-chip ${filter === 'incidents' ? 'active' : ''}`} onClick={() => setFilter('incidents')}>
          Incidents
        </button>
        <button className={`filter-chip ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          Pending
        </button>
      </div>

      {list.length ? (
        <div className="review-list">
          {list.map((shift) => (
            <button key={shift.id} className={`review-card ${shift.incident ? 'urgent' : ''}`} onClick={() => onOpen(shift.id)}>
              <div className="review-card-top">
                <div className="avatar small">{initials(shift.nurseName)}</div>
                <div>
                  <strong>{shift.nurseName}</strong>
                  <p>{shift.patientIds.map((id) => patients.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</p>
                </div>
                {shift.incident ? (
                  <span className="status-badge red">Incident</span>
                ) : (
                  <span className={`status-badge ${shift.status === 'approved' ? 'green' : 'amber'}`}>
                    {shift.status === 'submitted' ? 'Pending' : shift.status}
                  </span>
                )}
              </div>
              <div className="review-card-bottom">
                <span>Submitted {new Date(shift.submittedAt || shift.startedAt).toLocaleString()}</span>
                <ChevronRight />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText />
          <strong>No shifts yet</strong>
          <p>Submitted shifts will appear here for review.</p>
        </div>
      )}
    </>
  )
}

function ShiftDetail({
  shift,
  patients,
  onReview,
}: {
  shift: Shift
  patients: Patient[]
  onReview: (status: 'approved' | 'rejected', comment: string) => void
}) {
  const [comment, setComment] = useState('')
  const shiftPatients = shift.patientIds.map((id) => patients.find((p) => p.id === id)).filter(Boolean) as Patient[]
  const patientNames = shiftPatients.map((p) => p.name).join(', ')

  return (
    <div id="print-shift-report">
      <div className="review-header">
        <div className="avatar">{initials(shift.nurseName)}</div>
        <div>
          <p className="eyebrow">Shift report</p>
          <h2>{shift.nurseName}</h2>
          <p>{patientNames}</p>
        </div>
        <span className={`status-badge ${shift.status === 'approved' ? 'green' : shift.status === 'rejected' ? 'red' : 'amber'}`}>
          {shift.status.replace('_', ' ')}
        </span>
      </div>

      <section className="id-block">
        <div>
          <span className="metric-label">Nurse</span>
          <strong>{shift.nurseName}</strong>
        </div>
        {shiftPatients.map((patient) => (
          <div key={patient.id}>
            <span className="metric-label">Patient</span>
            <strong>{patient.name}</strong>
            <p>
              DOB: {patient.dob || '—'} · Medicaid #: {patient.medicaidNumber || '—'}
            </p>
            <p>
              Diagnosis:{' '}
              {patient.diagnoses?.length
                ? patient.diagnoses.map((d) => (d.description ? `${d.name} (${d.description})` : d.name)).join('; ')
                : '—'}
            </p>
          </div>
        ))}
      </section>

      {shift.incident && (
        <div className="incident-panel">
          <div className="incident-title">
            <AlertTriangle />
            <h3>Incident flagged</h3>
          </div>
          <p>This shift includes an incident report and needs priority attention.</p>
        </div>
      )}

      <section className="section-block">
        <h3>Care timeline</h3>
        <div className="timeline-list" style={{ marginTop: 14 }}>
          {shift.entries.map((entry) => (
            <DetailEntry key={entry.id} entry={entry} />
          ))}
          {!shift.entries.length && <p>No entries recorded.</p>}
        </div>
      </section>

      {shift.summary && (
        <section className="section-block">
          <h3>Summary of care</h3>
          <p>{shift.summary}</p>
        </section>
      )}
      {shift.observations && (
        <section className="section-block">
          <h3>Clinical observations</h3>
          <p>{shift.observations}</p>
        </section>
      )}
      {shift.recommendations && (
        <section className="section-block">
          <h3>Recommendations</h3>
          <p>{shift.recommendations}</p>
        </section>
      )}
      {shift.followUp && (
        <div className="alert-callout">
          <AlertTriangle />
          <div>
            <strong>Nurse flagged this shift as needing follow-up.</strong>
          </div>
        </div>
      )}
      {shift.signature && (
        <section className="section-block">
          <h3>Signed by</h3>
          <p>{shift.signature}</p>
        </section>
      )}

      {shift.status === 'approved' ? (
        <div className="approved-panel">
          <CheckCircle2 />
          <div>
            <strong>Approved</strong>
            <p>Reviewed {shift.reviewedAt ? new Date(shift.reviewedAt).toLocaleString() : ''} by {shift.reviewedBy}</p>
          </div>
          <button className="secondary-button no-print" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      ) : shift.status === 'rejected' ? (
        <div className="rejected-panel">
          <XCircle />
          <div>
            <strong>Correction requested</strong>
            <p>
              Reviewed {shift.reviewedAt ? new Date(shift.reviewedAt).toLocaleString() : ''} by {shift.reviewedBy}. The nurse has
              been notified and can edit and resubmit this shift.
            </p>
            {shift.reviewComment && <p style={{ marginTop: 6 }}>&ldquo;{shift.reviewComment}&rdquo;</p>}
          </div>
        </div>
      ) : (
        <section className="section-block no-print">
          <label className="field-label">
            Review comment
            <textarea className="large-textarea" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add context for the nurse..." />
          </label>
          <div className="review-actions">
            <button className="primary-button" onClick={() => onReview('approved', comment.trim())}>
              <Check /> Approve shift
            </button>
            <button className="danger-outline" disabled={!comment.trim()} onClick={() => onReview('rejected', comment.trim())}>
              <X /> Request correction
            </button>
          </div>
          <p className="helper-text" style={{ textAlign: 'left' }}>
            A comment is required to request a correction — the nurse will see it and can resubmit once addressed.
          </p>
        </section>
      )}
    </div>
  )
}

function DetailEntry({ entry }: { entry: Entry }) {
  const icon =
    entry.kind === 'incident' ? <AlertTriangle /> : entry.kind === 'medication' ? <Pill /> : entry.kind === 'task' ? <ClipboardList /> : <FileText />
  const title =
    entry.kind === 'medication'
      ? `${entry.drug} · ${entry.medStatus}`
      : entry.kind === 'incident'
        ? 'Seizure incident'
        : entry.kind === 'task'
          ? 'Tasks completed'
          : 'Hourly note'
  return (
    <div className="timeline-item">
      <div className="timeline-line">
        <div className="timeline-dot" />
      </div>
      <div className="timeline-content">
        <div className="timeline-meta">
          <span>{entry.timeframe || entry.time}</span>
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

function ActivityLog({ events, patients }: { events: AuditEvent[]; patients: Patient[] }) {
  const sorted = [...events].reverse()
  return (
    <>
      <p className="lead">Append-only access and review history. Entries here can never be edited or deleted.</p>
      <div className="activity-list" style={{ marginTop: 16 }}>
        {sorted.length ? (
          sorted.map((event) => (
            <div className="activity-row" key={event.id}>
              <div className="tiny-icon">
                <ShieldCheck />
              </div>
              <div>
                <strong>
                  {event.actor} · {event.action.replace('_', ' ')}
                </strong>
                <p>
                  {event.patientIds.map((id) => patients.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || 'No patient context'} ·{' '}
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Clock3 />
            <strong>No activity recorded yet</strong>
          </div>
        )}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------------- */

function TeamPanel({
  nurses,
  patients,
  onReset,
  onRemove,
  onApprove,
  onAssign,
  onToggleActive,
}: {
  nurses: NurseAccount[]
  patients: Patient[]
  onReset: (nurseId: string) => Promise<string>
  onRemove: (nurseId: string) => void
  onApprove: (nurseId: string) => void
  onAssign: (nurseId: string, patientIds: string[]) => void
  onToggleActive: (nurseId: string, active: boolean) => void
}) {
  const [message, setMessage] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const assigningNurse = nurses.find((n) => n.id === assigningId) || null
  const removingNurse = nurses.find((n) => n.id === removingId) || null

  const pendingNurses = nurses.filter((n) => n.status === 'pending')
  const activeNurses = nurses.filter((n) => n.status !== 'pending' && n.active)
  const inactiveNurses = nurses.filter((n) => n.status !== 'pending' && !n.active)

  async function handleReset(nurse: NurseAccount) {
    setResettingId(nurse.id)
    try {
      const temp = await onReset(nurse.id)
      setMessage(`Temporary PIN for ${nurse.name}: ${temp}. Share it with them securely — it must be changed at next login.`)
    } finally {
      setResettingId(null)
    }
  }

  return (
    <>
      <p className="lead">Nurses appear here automatically once they create their own account — nothing to set up in advance.</p>

      {!!pendingNurses.length && (
        <section className="section-block" style={{ marginTop: 20 }}>
          <div className="section-heading">
            <h3>Awaiting approval</h3>
            <span className="muted">{pendingNurses.length} pending</span>
          </div>
          <div className="review-list">
            {pendingNurses.map((nurse) => (
              <div className="team-card" key={nurse.id}>
                <div className="avatar small">{initials(nurse.name)}</div>
                <div>
                  <strong>{nurse.name}</strong>
                  <p>{nurse.phone} · Can&apos;t sign in until approved</p>
                </div>
                <button className="primary-button" onClick={() => onApprove(nurse.id)}>
                  <Check /> Approve
                </button>
                <button className="danger-outline" onClick={() => setRemovingId(nurse.id)}>
                  Decline
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="review-list" style={{ marginTop: 16 }}>
        {activeNurses.map((nurse) => {
          const assignedCount = (nurse.assignedPatientIds || []).length
          return (
            <div className="team-card" key={nurse.id}>
              <div className="avatar small">{initials(nurse.name)}</div>
              <div>
                <strong>{nurse.name}</strong>
                <p>
                  {nurse.phone}
                  {nurse.mustResetPin ? ' · Temporary PIN active' : ''} · {assignedCount} patient{assignedCount === 1 ? '' : 's'} assigned
                </p>
              </div>
              <button className="secondary-button" onClick={() => setAssigningId(nurse.id)}>
                Assign patients
              </button>
              <button className="secondary-button" disabled={resettingId === nurse.id} onClick={() => handleReset(nurse)}>
                {resettingId === nurse.id ? 'Resetting…' : 'Reset PIN'}
              </button>
              <button className="danger-outline" onClick={() => onToggleActive(nurse.id, false)}>
                Deactivate
              </button>
              <button className="danger-outline" onClick={() => setRemovingId(nurse.id)}>
                Remove
              </button>
            </div>
          )
        })}
        {!nurses.length && (
          <div className="empty-state">
            <Stethoscope />
            <strong>No nurses yet</strong>
            <p>Nurse accounts will appear here once created.</p>
          </div>
        )}
      </div>

      {!!inactiveNurses.length && (
        <section className="section-block" style={{ marginTop: 20 }}>
          <div className="section-heading">
            <h3>Deactivated</h3>
            <span className="muted">{inactiveNurses.length} deactivated</span>
          </div>
          <div className="review-list">
            {inactiveNurses.map((nurse) => (
              <div className="team-card" key={nurse.id} style={{ opacity: 0.7 }}>
                <div className="avatar small">{initials(nurse.name)}</div>
                <div>
                  <strong>{nurse.name}</strong>
                  <p>{nurse.phone} · Can&apos;t sign in while deactivated</p>
                </div>
                <button className="primary-button" onClick={() => onToggleActive(nurse.id, true)}>
                  Reactivate
                </button>
                <button className="danger-outline" onClick={() => setRemovingId(nurse.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {message && (
        <div className="alert-callout" style={{ marginTop: 16 }}>
          <ShieldCheck />
          <div>
            <p>{message}</p>
          </div>
        </div>
      )}

      {assigningNurse && (
        <AssignPatientsModal
          nurse={assigningNurse}
          patients={patients}
          onClose={() => setAssigningId(null)}
          onSave={(patientIds) => {
            onAssign(assigningNurse.id, patientIds)
            setMessage(`Updated patient assignments for ${assigningNurse.name}.`)
            setAssigningId(null)
          }}
        />
      )}

      {removingNurse && (
        <RemoveNurseModal
          nurse={removingNurse}
          onClose={() => setRemovingId(null)}
          onConfirm={() => {
            onRemove(removingNurse.id)
            setRemovingId(null)
          }}
        />
      )}
    </>
  )
}

function RemoveNurseModal({ nurse, onClose, onConfirm }: { nurse: NurseAccount; onClose: () => void; onConfirm: () => void }) {
  const [typedName, setTypedName] = useState('')
  const matches = typedName.trim().toLowerCase() === nurse.name.trim().toLowerCase()

  return (
    <div className="modal-overlay" role="alertdialog" aria-modal="true">
      <div className="modal-card confirm-card">
        <div className="modal-head">
          <h2>Remove {nurse.name}?</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="modal-body">
          <p className="lead">
            This removes their account permanently, including access assigned to their patients. To confirm, type their full name below.
          </p>
          <label className="field-label">
            Nurse name
            <input value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder={nurse.name} autoFocus />
          </label>
          <div className="review-actions" style={{ marginTop: 22 }}>
            <button className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="danger-outline" disabled={!matches} onClick={onConfirm}>
              Remove nurse
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssignPatientsModal({
  nurse,
  patients,
  onClose,
  onSave,
}: {
  nurse: NurseAccount
  patients: Patient[]
  onClose: () => void
  onSave: (patientIds: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(nurse.assignedPatientIds || [])
  const [saving, setSaving] = useState(false)

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <h2>Assign patients to {nurse.name}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p className="lead">Select every patient this nurse should be able to start a shift for.</p>
          <div className="patient-results">
            {patients.map((patient) => (
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
            {!patients.length && (
              <div className="empty-state">
                <UsersRound />
                <strong>No patients yet</strong>
                <p>Add a patient first from the Patients tab.</p>
              </div>
            )}
          </div>
          <button
            className="primary-button wide"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await onSave(selected)
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving…' : 'Save assignment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------- */

function PatientsPanel({
  patients,
  onAdd,
  onUpdate,
  onRemove,
}: {
  patients: Patient[]
  onAdd: (name: string, room: string, dob: string, medicaidNumber: string, diagnoses: { name: string; description?: string }[]) => void
  onUpdate: (id: string, name: string, room: string, dob: string, medicaidNumber: string, diagnoses: { name: string; description?: string }[]) => void
  onRemove: (id: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const editingPatient = patients.find((p) => p.id === editingId) || null
  const removingPatient = patients.find((p) => p.id === removingId) || null

  return (
    <>
      <button className="primary-button wide" style={{ marginTop: 0 }} onClick={() => setShowAdd(true)}>
        <Plus /> Add patient
      </button>

      <div className="patient-results" style={{ marginTop: 20 }}>
        {patients.map((patient) => (
          <div className="patient-result" key={patient.id}>
            <div className="patient-photo">{initials(patient.name)}</div>
            <div>
              <strong>{patient.name}</strong>
              <p>{patient.room}</p>
              <small>
                DOB {patient.dob || '—'} · Medicaid #{patient.medicaidNumber || '—'}
              </small>
              <small>{patient.diagnoses?.length ? patient.diagnoses.map((d) => d.name).join(', ') : 'No diagnosis on file'}</small>
            </div>
            <button className="secondary-button" onClick={() => setEditingId(patient.id)}>
              Edit
            </button>
            <button className="danger-outline" onClick={() => setRemovingId(patient.id)}>
              Remove
            </button>
          </div>
        ))}
        {!patients.length && (
          <div className="empty-state">
            <UsersRound />
            <strong>No patients yet</strong>
            <p>Add your first patient to get started.</p>
          </div>
        )}
      </div>

      {showAdd && (
        <PatientFormModal
          onClose={() => setShowAdd(false)}
          onSave={(name, room, dob, medicaidNumber, diagnoses) => {
            onAdd(name, room, dob, medicaidNumber, diagnoses)
            setShowAdd(false)
          }}
        />
      )}

      {editingPatient && (
        <PatientFormModal
          patient={editingPatient}
          onClose={() => setEditingId(null)}
          onSave={(name, room, dob, medicaidNumber, diagnoses) => {
            onUpdate(editingPatient.id, name, room, dob, medicaidNumber, diagnoses)
            setEditingId(null)
          }}
        />
      )}

      {removingPatient && (
        <ConfirmModal
          title="Remove patient?"
          body={`This removes ${removingPatient.name} from the roster and unassigns them from any nurse. This can't be undone.`}
          confirmLabel="Remove patient"
          danger
          onCancel={() => setRemovingId(null)}
          onConfirm={() => {
            onRemove(removingPatient.id)
            setRemovingId(null)
          }}
        />
      )}
    </>
  )
}

type DiagnosisRow = { id: string; name: string; description: string }

function PatientFormModal({
  patient,
  onClose,
  onSave,
}: {
  patient?: Patient
  onClose: () => void
  onSave: (name: string, room: string, dob: string, medicaidNumber: string, diagnoses: { name: string; description?: string }[]) => void
}) {
  const [name, setName] = useState(patient?.name || '')
  const [room, setRoom] = useState(patient?.room || '')
  const [dob, setDob] = useState(patient?.dob || '')
  const [medicaidNumber, setMedicaidNumber] = useState(patient?.medicaidNumber || '')
  const [diagnoses, setDiagnoses] = useState<DiagnosisRow[]>(
    patient?.diagnoses?.length
      ? patient.diagnoses.map((d) => ({ id: d.id, name: d.name, description: d.description || '' }))
      : [{ id: crypto.randomUUID(), name: '', description: '' }]
  )

  function updateDiagnosis(id: string, field: 'name' | 'description', value: string) {
    setDiagnoses((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }
  function addDiagnosisRow() {
    setDiagnoses((rows) => [...rows, { id: crypto.randomUUID(), name: '', description: '' }])
  }
  function removeDiagnosisRow(id: string) {
    setDiagnoses((rows) => rows.filter((row) => row.id !== id))
  }

  const canSave = name.trim() && room.trim() && dob.trim() && medicaidNumber.trim() && diagnoses[0]?.name.trim()

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <h2>{patient ? 'Edit patient' : 'Add patient'}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-stack">
            <label>
              Patient name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
            </label>
            <label>
              Room or location
              <input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Home or location" />
            </label>
            <div className="form-row">
              <label>
                Date of birth
                <input type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
              </label>
              <label>
                Medicaid number
                <input value={medicaidNumber} onChange={(event) => setMedicaidNumber(event.target.value)} placeholder="e.g. AB123456C" />
              </label>
            </div>

            <label className="field-label" style={{ margin: '4px 0 0' }}>
              Diagnosis
            </label>
            {diagnoses.map((row, index) => (
              <div key={row.id} className="diagnosis-row">
                <input
                  value={row.name}
                  onChange={(event) => updateDiagnosis(row.id, 'name', event.target.value)}
                  placeholder={index === 0 ? 'Primary diagnosis' : `Additional diagnosis ${index + 1}`}
                />
                <input
                  value={row.description}
                  onChange={(event) => updateDiagnosis(row.id, 'description', event.target.value)}
                  placeholder="Description (optional)"
                />
                {index > 0 && (
                  <button type="button" className="icon-button" onClick={() => removeDiagnosisRow(row.id)} aria-label="Remove diagnosis">
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="secondary-button" onClick={addDiagnosisRow} style={{ alignSelf: 'flex-start' }}>
              <Plus /> Add another diagnosis
            </button>
          </div>

          <button
            className="primary-button wide"
            disabled={!canSave}
            onClick={() =>
              onSave(
                name.trim(),
                room.trim(),
                dob.trim(),
                medicaidNumber.trim(),
                diagnoses.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), description: d.description.trim() }))
              )
            }
          >
            {patient ? 'Save changes' : 'Save patient'}
          </button>
        </div>
      </div>
    </div>
  )
}