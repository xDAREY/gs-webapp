export type Role = 'nurse' | 'supervisor'
export type StaffRole = 'nurse' | 'pca_cna'

export type NurseStatus = 'pending' | 'approved'
export type ShiftStatus = 'in_progress' | 'submitted' | 'approved' | 'rejected'
export type EntryKind = 'note' | 'medication' | 'incident' | 'task'| 'vitals' | 'temperature'
export type CareStatus = 'Stable' | 'Needs attention'
export type MedicationStatus = 'Given' | 'Refused'
export type NotificationType = 'approved' | 'rejected'

export type NotificationItem = {
  id: string
  message: string
  type: NotificationType
  shiftId: string
  read: boolean
  timestamp: string
}

// Keyed by id (nurses.id), not phone. Phone is still the login credential
// and is shown in the UI, but it's no longer the join key anywhere.
export type NurseAccount = {
  id: string
  name: string
  phone: string
  status: NurseStatus
  role: StaffRole
  mustResetPin: boolean
  assignedPatientIds: string[]
  // Deactivated nurses can't log in and lose all RLS-gated access
  // immediately (see current_nurse_id() in the schema) — this is the
  // alternative to hard-delete for anyone with shift history.
  active: boolean
}

export type SupervisorAccount = {
  id: string
  name: string
  phone: string
}

export type Diagnosis = {
  id: string
  name: string
  description?: string
}

export type Patient = {
  id: string
  name: string
  room: string
  dob: string
  medicaidNumber: string
  diagnoses: Diagnosis[]
}

export type Entry = {
  id: string
  kind: EntryKind
  time: string
  timestamp: string
  status?: CareStatus
  tags?: string[]
  detail: string
  drug?: string
  dose?: string
  route?: string
  medStatus?: MedicationStatus
  reason?: string
  administeredAt?: string
  observations?: string[]
  lengthOfEvent?: string
  timeframe?: string
  tasks?: string[]
  bloodPressure?: string
  pulse?: string
  respiratoryRate?: string
  oxygenSaturation?: string
  temperatureValue?: string
  temperatureUnit?: 'F' | 'C'
  temperatureMethod?: string
}

export type Shift = {
  id: string
  nurseId: string
  nurseName: string
  patientIds: string[]
  status: ShiftStatus
  startedAt: string
  endedAt?: string
  submittedAt?: string
  entries: Entry[]
  incident: boolean
  summary?: string
  observations?: string
  recommendations?: string
  followUp: boolean
  signature?: string
  reviewComment?: string
  reviewedAt?: string
  reviewedBy?: string
}

export type AuditAction =
  | 'account_created'
  | 'login'
  | 'logout'
  | 'session_timeout'
  | 'viewed'
  | 'created'
  | 'edited'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'pin_reset'
  | 'assigned'
  | 'nurse_approved'

export type AuditEvent = {
  id: string
  actor: string
  actorRole: Role
  patientIds: string[]
  action: AuditAction
  timestamp: string
}