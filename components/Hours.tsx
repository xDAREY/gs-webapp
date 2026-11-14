'use client'

import { useMemo, useState } from 'react'
import { Download, Timer } from 'lucide-react'
import type { NurseAccount, Patient, Shift } from '@/lib/types'
import { initials } from '@/lib/storage'

/* Hours tab (supervisor). Hours are self-reported by staff when they submit a
   shift; the start time is recorded automatically. Nothing here is printed on
   the patient's log report. */

type Preset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'all'
type Mode = 'date' | 'staff'

const WEEK_STARTS_ON_MONDAY = true

function rangeFor(preset: Preset): [Date | null, Date | null] {
  const now = new Date()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = WEEK_STARTS_ON_MONDAY ? (day.getDay() + 6) % 7 : day.getDay()
  const weekStart = new Date(day)
  weekStart.setDate(day.getDate() - dow)
  const plus = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
  if (preset === 'this_week') return [weekStart, plus(weekStart, 7)]
  if (preset === 'last_week') return [plus(weekStart, -7), weekStart]
  if (preset === 'this_month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)]
  if (preset === 'last_month') return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)]
  return [null, null]
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'all', label: 'All time' },
]

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}
const clock = (iso: string | Date) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

type Row = {
  shift: Shift
  staff: string
  role: string
  patients: string
  minutes: number | null
  endIso: string | null
  flag: string | null
  counted: boolean
}

export function HoursPanel({ shifts, nurses, patients }: { shifts: Shift[]; nurses: NurseAccount[]; patients: Patient[] }) {
  const [preset, setPreset] = useState<Preset>('this_week')
  const [mode, setMode] = useState<Mode>('date')
  const [staffId, setStaffId] = useState('all')
  const [role, setRole] = useState<'all' | 'nurse' | 'pca_cna'>('all')
  const [approvedOnly, setApprovedOnly] = useState(false)

  const roleOf = (id: string) => nurses.find((n) => n.id === id)?.role ?? 'nurse'

  const rows: Row[] = useMemo(() => {
    const [from, to] = rangeFor(preset)
    return shifts
      .filter((s) => s.status !== 'in_progress')
      .filter((s) => {
        const t = new Date(s.startedAt)
        return (!from || t >= from) && (!to || t < to)
      })
      .filter((s) => staffId === 'all' || s.nurseId === staffId)
      .filter((s) => role === 'all' || roleOf(s.nurseId) === role)
      .map((s): Row => {
        const minutes = (s as Shift & { workedMinutes?: number | null }).workedMinutes ?? null
        const elapsed = s.submittedAt ? (new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 60000 : null
        let flag: string | null = null
        if (minutes == null) flag = 'Not recorded'
        else if (elapsed != null && minutes > elapsed + 15) flag = 'More than time elapsed'
        const counted = minutes != null && (approvedOnly ? s.status === 'approved' : s.status === 'submitted' || s.status === 'approved')
        return {
          shift: s,
          staff: s.nurseName,
          role: roleOf(s.nurseId) === 'pca_cna' ? 'PCA/CNA' : 'Nurse',
          patients: s.patientIds.map((id) => patients.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || '—',
          minutes,
          endIso: minutes != null ? new Date(new Date(s.startedAt).getTime() + minutes * 60000).toISOString() : null,
          flag,
          counted,
        }
      })
      .sort((a, b) => +new Date(b.shift.startedAt) - +new Date(a.shift.startedAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, nurses, patients, preset, staffId, role, approvedOnly])

  const total = rows.reduce((sum, r) => sum + (r.counted ? r.minutes! : 0), 0)
  const countedShifts = rows.filter((r) => r.counted).length
  const flagged = rows.filter((r) => r.flag).length
  const people = new Set(rows.filter((r) => r.counted).map((r) => r.shift.nurseId)).size

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; sub?: string; minutes: number; rows: Row[] }>()
    for (const r of rows) {
      const key = mode === 'date' ? dayKey(r.shift.startedAt) : r.shift.nurseId
      const g = map.get(key) ?? { title: mode === 'date' ? dayLabel(r.shift.startedAt) : r.staff, sub: mode === 'staff' ? r.role : undefined, minutes: 0, rows: [] }
      g.rows.push(r)
      if (r.counted) g.minutes += r.minutes!
      map.set(key, g)
    }
    const list = [...map.entries()]
    if (mode === 'staff') list.sort((a, b) => a[1].title.localeCompare(b[1].title))
    return list
  }, [rows, mode])

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const header = ['Date', 'Staff', 'Role', 'Patient', 'Start', 'End', 'Hours (decimal)', 'Duration', 'Status', 'Counted in totals', 'Flag']
    const lines = rows.map((r) => [
      new Date(r.shift.startedAt).toLocaleDateString(),
      r.staff,
      r.role,
      r.patients,
      clock(r.shift.startedAt),
      r.endIso ? clock(r.endIso) : '',
      r.minutes != null ? (r.minutes / 60).toFixed(2) : '',
      r.minutes != null ? fmtDuration(r.minutes) : '',
      r.shift.status === 'rejected' ? 'needs correction' : r.shift.status,
      r.counted ? 'Yes' : 'No',
      r.flag ?? '',
    ].map(esc).join(','))
    const blob = new Blob(['﻿' + [header.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `staff-hours-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const staffOptions = nurses.filter((n) => n.status !== 'pending').sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <p className="lead">Hours are entered by staff when they submit a shift. Start time is recorded automatically. This is separate from the patient log report.</p>

      <div className="filter-bar" style={{ marginTop: 16 }}>
        {PRESETS.map((p) => (
          <button key={p.value} className={`filter-chip ${preset === p.value ? 'active' : ''}`} onClick={() => setPreset(p.value)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="form-row" style={{ marginTop: 12 }}>
        <label>
          Staff
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="all">Everyone</option>
            {staffOptions.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as 'all' | 'nurse' | 'pca_cna')}>
            <option value="all">Nurses and PCA/CNAs</option>
            <option value="nurse">Nurses</option>
            <option value="pca_cna">PCA/CNAs</option>
          </select>
        </label>
      </div>

      <label className="checkbox-row" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />
        Count approved shifts only
      </label>

      <div className="metric-grid" style={{ margin: '16px 0' }}>
        <div className="metric-card"><span className="metric-label">Total hours</span><strong>{fmtDuration(total)}</strong></div>
        <div className="metric-card"><span className="metric-label">Shifts · staff</span><strong>{countedShifts} · {people}</strong></div>
        <div className="metric-card"><span className="metric-label">Need a look</span><strong>{flagged}</strong></div>
      </div>

      <div className="filter-bar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`filter-chip ${mode === 'date' ? 'active' : ''}`} onClick={() => setMode('date')}>By date</button>
          <button className={`filter-chip ${mode === 'staff' ? 'active' : ''}`} onClick={() => setMode('staff')}>By staff</button>
        </div>
        <button className="secondary-button" disabled={!rows.length} onClick={exportCsv}>
          <Download /> Export CSV
        </button>
      </div>

      {groups.length ? (
        <div style={{ marginTop: 14, display: 'grid', gap: 18 }}>
          {groups.map(([key, g]) => (
            <section key={key}>
              <div className="section-heading">
                <h3 style={{ fontSize: 15 }}>{g.title}{g.sub ? <span className="muted"> · {g.sub}</span> : null}</h3>
                <span className="muted">{fmtDuration(g.minutes)} · {g.rows.length} shift{g.rows.length === 1 ? '' : 's'}</span>
              </div>
              <div className="review-list">
                {g.rows.map((r) => (
                  <div className="review-card" key={r.shift.id} style={{ cursor: 'default' }}>
                    <div className="review-card-top">
                      <div className="avatar small">{initials(r.staff)}</div>
                      <div>
                        <strong>{mode === 'date' ? r.staff : new Date(r.shift.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                        <p>{mode === 'date' ? `${r.role} · ` : ''}{r.patients}</p>
                      </div>
                      <span className={`status-badge ${r.shift.status === 'approved' ? 'green' : r.shift.status === 'rejected' ? 'red' : 'amber'}`}>
                        {r.shift.status === 'rejected' ? 'Needs correction' : r.shift.status === 'submitted' ? 'Pending' : r.shift.status}
                      </span>
                    </div>
                    <div className="review-card-bottom">
                      <span>
                        {clock(r.shift.startedAt)}{r.endIso ? ` → ${clock(r.endIso)}` : ''}
                        {r.minutes != null ? <strong> · {fmtDuration(r.minutes)}</strong> : null}
                      </span>
                      {r.flag && <span className="status-badge amber">{r.flag}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ marginTop: 16 }}>
          <Timer />
          <strong>No shifts in this period</strong>
          <p>Submitted shifts with hours will show up here.</p>
        </div>
      )}
      <p className="helper-text" style={{ textAlign: 'left', marginTop: 16 }}>
        Hours are reported by staff and are not verified automatically. Shifts needing correction are listed but not counted in totals.
      </p>
    </>
  )
}