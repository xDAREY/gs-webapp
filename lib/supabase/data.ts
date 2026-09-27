import { createClient } from './client'
import type {
  AuditAction,
  AuditEvent,
  Diagnosis,
  Entry,
  EntryKind,
  NotificationItem,
  NurseAccount,
  Patient,
  Role,
  Shift,
} from '@/lib/types'

/* ---------------------------------------------------------------------- */
/* Row -> frontend-type mappers                                           */
/* ---------------------------------------------------------------------- */

function dbEntryToEntry(row: any): Entry {
  return {
    id: row.id,
    kind: row.kind,
    time: new Date(row.occurred_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    timestamp: row.occurred_at,
    status: row.care_status ?? undefined,
    tags: row.tags ?? [],
    detail: row.detail,
    drug: row.drug ?? undefined,
    dose: row.dose ?? undefined,
    route: row.route ?? undefined,
    medStatus: row.med_status ?? undefined,
    reason: row.reason ?? undefined,
    administeredAt: row.administered_at ?? undefined,
    observations: row.observations ?? [],
    lengthOfEvent: row.length_of_event ?? undefined,
    timeframe: row.timeframe ?? undefined,
    tasks: row.tasks ?? [],
    bloodPressure: row.blood_pressure ?? undefined,
    pulse: row.pulse ?? undefined,
    respiratoryRate: row.respiratory_rate ?? undefined,
    oxygenSaturation: row.oxygen_saturation ?? undefined,
    temperatureValue: row.temperature_value ?? undefined,
    temperatureUnit: row.temperature_unit ?? undefined,
    temperatureMethod: row.temperature_method ?? undefined,

  }
}

function dbShiftToShift(row: any): Shift {
  return {
    id: row.id,
    nurseId: row.nurse_id,
    nurseName: row.nurses?.name ?? 'Unknown nurse',
    patientIds: (row.shift_patients ?? []).map((sp: any) => sp.patient_id),
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    entries: (row.entries ?? [])
      .map(dbEntryToEntry)
      .sort((a: Entry, b: Entry) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    incident: row.incident,
    summary: row.summary ?? undefined,
    observations: row.observations ?? undefined,
    recommendations: row.recommendations ?? undefined,
    followUp: row.follow_up,
    signature: row.signature ?? undefined,
    reviewComment: row.review_comment ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.supervisors?.name ?? undefined,
  }
}

function dbPatientToPatient(row: any): Patient {
  return {
    id: row.id,
    name: row.name,
    room: row.room,
    dob: row.dob,
    medicaidNumber: row.medicaid_number,
    diagnoses: (row.patient_diagnoses ?? []).map(
      (d: any): Diagnosis => ({ id: d.id, name: d.name, description: d.description ?? undefined })
    ),
  }
}

function dbNurseToNurseAccount(row: any): NurseAccount {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: row.status,
    role: row.role,
    mustResetPin: row.must_reset_pin,
    assignedPatientIds: (row.nurse_patient_assignments ?? []).map((a: any) => a.patient_id),
    active: row.active,
  }
}

function dbNotificationToNotification(row: any): NotificationItem {
  return {
    id: row.id,
    message: row.message,
    type: row.type,
    shiftId: row.shift_id,
    read: row.read,
    timestamp: row.created_at,
  }
}

function dbAuditToAuditEvent(row: any): AuditEvent {
  return {
    id: row.id,
    actor: row.actor_name,
    actorRole: row.actor_role,
    patientIds: row.patient_ids ?? [],
    action: row.action,
    timestamp: row.created_at,
  }
}

/* ---------------------------------------------------------------------- */
/* Fetchers                                                                */
/* ---------------------------------------------------------------------- */

// Supervisor-only (RLS: nurses_select allows own row OR is_supervisor()).
export async function fetchNurses(): Promise<NurseAccount[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nurses')
    .select('id, name, phone, status, role, must_reset_pin, active, nurse_patient_assignments ( patient_id )')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(dbNurseToNurseAccount)
}

// Visible to a supervisor (all patients) or a nurse (only assigned ones) —
// RLS handles the filtering, so this query is the same for both.
export async function fetchPatients(): Promise<Patient[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, room, dob, medicaid_number, patient_diagnoses ( id, name, description )')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(dbPatientToPatient)
}

// Pass nurseId to scope to one nurse's own shifts; omit for a supervisor
// (RLS already restricts a nurse to their own rows either way).
export async function fetchShifts(nurseId?: string): Promise<Shift[]> {
  const supabase = createClient()
  let query = supabase
    .from('shifts')
    .select(
      `id, nurse_id, status, incident, started_at, ended_at, submitted_at, summary, observations,
       recommendations, follow_up, signature, review_comment, reviewed_at,
       nurses ( name ),
       supervisors ( name ),
       shift_patients ( patient_id ),
       entries ( * )`
    )
    .order('started_at', { ascending: false })

  if (nurseId) query = query.eq('nurse_id', nurseId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(dbShiftToShift)
}

export async function fetchNotifications(nurseId: string): Promise<NotificationItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('nurse_id', nurseId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(dbNotificationToNotification)
}

// Supervisor-only (RLS: audit_select_by_supervisor).
export async function fetchAuditEvents(): Promise<AuditEvent[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('audit_events').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(dbAuditToAuditEvent)
}

/* ---------------------------------------------------------------------- */
/* Mutations — nurses / team management                                   */
/* ---------------------------------------------------------------------- */

export async function approveNurse(nurseId: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('approve_nurse', { p_nurse_id: nurseId })
  if (error) throw error
}

export async function resetNursePin(nurseId: string, newPin: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc('reset_nurse_pin', { p_nurse_id: nurseId, p_new_pin: newPin })
  if (error) throw error
}

// Plain UPDATE, permitted for supervisors by the existing
// nurses_update_by_supervisor RLS policy — no new grant needed. Setting
// active=false immediately blocks the nurse everywhere via
// current_nurse_id() (see the migration), even if they're mid-session.
export async function setNurseActive(nurseId: string, active: boolean) {
  const supabase = createClient()
  const { error } = await supabase.from('nurses').update({ active }).eq('id', nurseId)
  if (error) throw error
}

export async function removeNurse(nurseId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('nurses').delete().eq('id', nurseId)
  if (error) {
    if (error.code === '23503') {
      throw new Error('This nurse has shift history on file and can\u2019t be removed.')
    }
    throw error
  }
}

// Replaces the nurse's full assignment set. Simpler and safer than diffing
// for a list this size; two round trips but both are cheap.
export async function assignPatients(nurseId: string, patientIds: string[], supervisorId: string) {
  const supabase = createClient()
  const { error: deleteErr } = await supabase.from('nurse_patient_assignments').delete().eq('nurse_id', nurseId)
  if (deleteErr) throw deleteErr

  if (patientIds.length) {
    const { error: insertErr } = await supabase
      .from('nurse_patient_assignments')
      .insert(patientIds.map((patientId) => ({ nurse_id: nurseId, patient_id: patientId, assigned_by: supervisorId })))
    if (insertErr) throw insertErr
  }
}

/* ---------------------------------------------------------------------- */
/* Mutations — patients                                                    */
/* ---------------------------------------------------------------------- */

type DiagnosisInput = { name: string; description?: string }

export async function addPatient(
  name: string,
  room: string,
  dob: string,
  medicaidNumber: string,
  diagnoses: DiagnosisInput[],
  supervisorId: string
): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('patients')
    .insert({ name, room, dob, medicaid_number: medicaidNumber, created_by: supervisorId })
    .select('id')
    .single()
  if (error) throw error

  const patientId = data.id as string
  if (diagnoses.length) {
    const { error: diagErr } = await supabase
      .from('patient_diagnoses')
      .insert(diagnoses.map((d) => ({ patient_id: patientId, name: d.name, description: d.description || null })))
    if (diagErr) throw diagErr
  }
  return patientId
}

export async function updatePatient(
  id: string,
  name: string,
  room: string,
  dob: string,
  medicaidNumber: string,
  diagnoses: DiagnosisInput[]
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('patients')
    .update({ name, room, dob, medicaid_number: medicaidNumber })
    .eq('id', id)
  if (error) throw error

  const { error: deleteErr } = await supabase.from('patient_diagnoses').delete().eq('patient_id', id)
  if (deleteErr) throw deleteErr

  if (diagnoses.length) {
    const { error: diagErr } = await supabase
      .from('patient_diagnoses')
      .insert(diagnoses.map((d) => ({ patient_id: id, name: d.name, description: d.description || null })))
    if (diagErr) throw diagErr
  }
}

// NOTE: shift_patients.patient_id is ON DELETE RESTRICT — a patient who has
// ever appeared on a shift can't be deleted. Catch this and surface a
// friendly message rather than letting the raw Postgres error through.
export async function removePatient(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('This patient has shift history on file and can\u2019t be deleted.')
    }
    throw error
  }
}

/* ---------------------------------------------------------------------- */
/* Mutations — shifts / entries                                            */
/* ---------------------------------------------------------------------- */

export async function startShift(nurseId: string, patientIds: string[]): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shifts')
    .insert({ nurse_id: nurseId, status: 'in_progress' })
    .select('id')
    .single()
  if (error) throw error

  const shiftId = data.id as string
  const { error: spErr } = await supabase
    .from('shift_patients')
    .insert(patientIds.map((patientId) => ({ shift_id: shiftId, patient_id: patientId })))
  if (spErr) throw spErr

  return shiftId
}

type EntryInput = Omit<Entry, 'id' | 'time' | 'timestamp'>

export async function addEntry(shiftId: string, entry: EntryInput) {
  const supabase = createClient()
  const { error } = await supabase.from('entries').insert({
    shift_id: shiftId,
    kind: entry.kind as EntryKind,
    detail: entry.detail,
    care_status: entry.status ?? null,
    tags: entry.tags ?? [],
    timeframe: entry.timeframe ?? null,
    drug: entry.drug ?? null,
    dose: entry.dose ?? null,
    route: entry.route ?? null,
    administered_at: entry.administeredAt ?? null,
    med_status: entry.medStatus ?? null,
    reason: entry.reason ?? null,
    length_of_event: entry.lengthOfEvent ?? null,
    observations: entry.observations ?? [],
    tasks: entry.tasks ?? [],
    blood_pressure: entry.bloodPressure ?? null,
    pulse: entry.pulse ?? null,
    respiratory_rate: entry.respiratoryRate ?? null,
    oxygen_saturation: entry.oxygenSaturation ?? null,
    temperature_value: entry.temperatureValue ?? null,
    temperature_unit: entry.temperatureUnit ?? null,
    temperature_method: entry.temperatureMethod ?? null,
  })
  if (error) throw error
}

export async function submitShift(
  shiftId: string,
  payload: { summary: string; observations: string; recommendations: string; followUp: boolean; signature: string }
) {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('shifts')
    .update({
      status: 'submitted',
      ended_at: now,
      submitted_at: now,
      summary: payload.summary,
      observations: payload.observations,
      recommendations: payload.recommendations,
      follow_up: payload.followUp,
      signature: payload.signature,
      review_comment: null,
      reviewed_at: null,
      reviewed_by: null,
    })
    .eq('id', shiftId)
  if (error) throw error
}

// Requires the schema fix that widens shifts_update_own_in_progress to
// also permit status = 'rejected' in USING — without it, RLS silently
// filters this update to zero affected rows instead of erroring. The
// .select() + length check below guards against exactly that class of bug.
export async function reopenShift(shiftId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('shifts')
    .update({ status: 'in_progress', submitted_at: null })
    .eq('id', shiftId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('Could not reopen this shift — it may no longer be available.')
  }
}

export async function reviewShift(
  shiftId: string,
  nurseId: string,
  status: 'approved' | 'rejected',
  comment: string,
  supervisorId: string,
  notificationMessage: string
) {
  const supabase = createClient()
  const { error } = await supabase
    .from('shifts')
    .update({ status, review_comment: comment || null, reviewed_at: new Date().toISOString(), reviewed_by: supervisorId })
    .eq('id', shiftId)
  if (error) throw error

  const { error: notifyErr } = await supabase.from('notifications').insert({
    nurse_id: nurseId,
    shift_id: shiftId,
    type: status,
    message: notificationMessage,
  })
  if (notifyErr) throw notifyErr
}

export async function markNotificationsRead(nurseId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('notifications').update({ read: true }).eq('nurse_id', nurseId).eq('read', false)
  if (error) throw error
}

/* ---------------------------------------------------------------------- */
/* Mutations — audit log                                                   */
/* ---------------------------------------------------------------------- */

// actorNurseId/actorSupervisorId must match the caller's own id — RLS
// (audit_insert) rejects anything else.
export async function insertAuditEvent(params: {
  actorName: string
  actorRole: Role
  actorNurseId?: string
  actorSupervisorId?: string
  patientIds?: string[]
  action: AuditAction
}) {
  const supabase = createClient()
  const { error } = await supabase.from('audit_events').insert({
    actor_name: params.actorName,
    actor_role: params.actorRole,
    actor_nurse_id: params.actorRole === 'nurse' ? params.actorNurseId : null,
    actor_supervisor_id: params.actorRole === 'supervisor' ? params.actorSupervisorId : null,
    patient_ids: params.patientIds ?? [],
    action: params.action,
  })
  if (error) throw error
}