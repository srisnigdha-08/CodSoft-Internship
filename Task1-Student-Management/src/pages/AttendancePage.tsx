import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest, apiRequestPage } from '../api'
import type { AttendanceCorrection, AttendanceRecord, Role, SchoolClass, Student, User } from '../types'
import { Badge, Button, EmptyState, ErrorMessage, Field, Loading, Modal, PageHeading, SelectInput, TextInput } from '../components/shared'
import { formatDate } from '../utils/format'
import { loadActiveStudents } from '../utils/activeStudents'

interface AttendanceMeta { summary: { present: number; absent: number; late: number }; total: number }
function localDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }

export function AttendancePage({ user }: { user: User }) {
  const role: Role = user.role
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [summary, setSummary] = useState<AttendanceMeta['summary']>({ present: 0, absent: 0, late: 0 })
  const [total, setTotal] = useState(0)
  const [filterDate, setFilterDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [draft, setDraft] = useState({ classId: '', studentId: '', date: localDate(), status: 'present' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [correcting, setCorrecting] = useState<AttendanceRecord | null>(null)
  const [correctedStatus, setCorrectedStatus] = useState<AttendanceRecord['status']>('present')
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [correctionError, setCorrectionError] = useState('')
  const [correctionSaving, setCorrectionSaving] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const correctingId = correcting?.id
  const eligibleStudents = useMemo(() => students.filter((student) => !draft.classId || student.classId === Number(draft.classId)), [students, draft.classId])

  useEffect(() => {
    let active = true
    const dateQuery = filterDate ? `?date=${encodeURIComponent(filterDate)}` : ''
    Promise.all([
      apiRequestPage<AttendanceRecord[], AttendanceMeta>(`/attendance${dateQuery}`),
      apiRequest<SchoolClass[]>('/classes'),
      role === 'student' ? Promise.resolve([] as Student[]) : loadActiveStudents(),
    ]).then(([attendanceResult, classList, studentList]) => {
      if (!active) return
      setRecords(attendanceResult.data); setSummary(attendanceResult.meta.summary); setTotal(attendanceResult.meta.total)
      setClasses(classList); setStudents(studentList); setError('')
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load attendance records.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role, filterDate, refresh])

  useEffect(() => {
    if (!correctingId) return
    let active = true
    apiRequest<AttendanceCorrection[]>(`/attendance/${correctingId}/corrections`)
      .then((history) => { if (active) { setCorrections(history); setCorrectionError('') } })
      .catch((cause: unknown) => { if (active) setCorrectionError(cause instanceof Error ? cause.message : 'Could not load correction history.') })
      .finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [correctingId, historyRefresh])

  function openCorrection(record: AttendanceRecord) {
    setCorrecting(record)
    setCorrectedStatus(record.status)
    setCorrections([])
    setCorrectionError('')
    setHistoryLoading(true)
  }

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!correcting || correctedStatus === correcting.status) return
    setCorrectionSaving(true); setCorrectionError('')
    try {
      const updated = await apiRequest<AttendanceRecord>(`/attendance/${correcting.id}`, {
        method: 'PUT', body: JSON.stringify({ status: correctedStatus }),
      })
      setCorrecting(updated)
      setNotice(`Attendance for ${updated.studentName} was corrected.`)
      setRefresh((value) => value + 1)
      setHistoryLoading(true)
      setHistoryRefresh((value) => value + 1)
    } catch (cause) {
      setCorrectionError(cause instanceof Error ? cause.message : 'Could not correct attendance.')
    } finally { setCorrectionSaving(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice(''); setSaving(true)
    try {
      await apiRequest('/attendance', { method: 'POST', body: JSON.stringify({ ...draft, classId: Number(draft.classId), studentId: Number(draft.studentId) }) })
      setNotice('Attendance has been recorded.')
      setRefresh((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record attendance.') }
    finally { setSaving(false) }
  }

  return <div className="page-content"><PageHeading eyebrow="DAILY OPERATIONS" title="Attendance" description={role === 'student' ? 'Review your attendance history.' : 'Record a class session and review attendance history.'} />
    {notice && <div className="notice notice-success" role="status">{notice}</div>}{error && <ErrorMessage>{error}</ErrorMessage>}
    {!loading && <div className="summary-strip"><SummaryValue label="Present" value={summary.present} tone="green" /><SummaryValue label="Absent" value={summary.absent} tone="red" /><SummaryValue label="Late" value={summary.late} tone="amber" /></div>}
    {!loading && total > records.length && <p className="muted">Showing the latest {records.length} of {total} matching attendance records. The summary includes all {total}.</p>}
    {role !== 'student' && <section className="surface form-surface"><div className="surface-heading"><div><p className="eyebrow">NEW RECORD</p><h2>Take attendance</h2></div></div><form className="inline-form" onSubmit={(event) => void submit(event)}><Field label="Class"><SelectInput required value={draft.classId} onChange={(event) => setDraft({ ...draft, classId: event.target.value, studentId: '' })}><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.section}</option>)}</SelectInput></Field><Field label="Student"><SelectInput required disabled={!draft.classId} value={draft.studentId} onChange={(event) => setDraft({ ...draft, studentId: event.target.value })}><option value="">Choose a student</option>{eligibleStudents.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.studentNumber}</option>)}</SelectInput></Field><Field label="Date"><TextInput required type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></Field><Field label="Status"><SelectInput value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></SelectInput></Field><Button type="submit" disabled={saving || !classes.length}>{saving ? 'Saving…' : 'Record attendance'}</Button></form></section>}
    <section className="surface table-surface"><div className="surface-heading records-heading"><div><p className="eyebrow">HISTORY</p><h2>Attendance records</h2></div><label className="filter-label"><span>Filter by date</span><TextInput type="date" value={filterDate} onChange={(event) => { setLoading(true); setFilterDate(event.target.value) }} /></label></div>{loading ? <Loading label="Loading attendance…" /> : records.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Class</th><th>Date</th><th>Status</th>{role !== 'student' && <th>Actions</th>}</tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.studentName}</strong></td><td><span className="id-chip">{record.studentNumber}</span></td><td>{record.className} · {record.section}</td><td>{formatDate(record.date)}</td><td><Badge tone={record.status === 'present' ? 'green' : record.status === 'late' ? 'amber' : 'red'}>{record.status}</Badge></td>{role !== 'student' && <td><Button type="button" variant="secondary" onClick={() => openCorrection(record)}>Correct</Button></td>}</tr>)}</tbody></table></div> : <EmptyState title="No attendance records" detail={filterDate ? 'No records were found for this date.' : 'Attendance entries will appear here after they are recorded.'} />}</section>
    {correcting && role !== 'student' && <Modal title="Correct attendance" onClose={() => setCorrecting(null)}>
      <p className="modal-copy">{correcting.studentName} · {correcting.className} · {formatDate(correcting.date)}. Current status: <strong>{correcting.status}</strong>.</p>
      <form className="record-form" onSubmit={(event) => void saveCorrection(event)}>
        <Field label="Corrected status"><SelectInput value={correctedStatus} onChange={(event) => { const value = event.target.value; if (value === 'present' || value === 'absent' || value === 'late') setCorrectedStatus(value) }}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></SelectInput></Field>
        {correctionError && <ErrorMessage>{correctionError}</ErrorMessage>}
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setCorrecting(null)}>Close</Button><Button type="submit" disabled={correctionSaving || correctedStatus === correcting.status}>{correctionSaving ? 'Saving…' : 'Save correction'}</Button></div>
      </form>
      <div className="correction-history"><h3>Correction history</h3>{historyLoading ? <Loading label="Loading corrections…" /> : corrections.length ? <ul>{corrections.map((item) => <li key={item.id}><strong>{item.previousStatus} → {item.newStatus}</strong><span>{new Date(item.correctedAt).toLocaleString()} · User #{item.correctedBy}</span></li>)}</ul> : <p className="muted">No corrections yet.</p>}</div>
    </Modal>}
  </div>
}

function SummaryValue({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="summary-item"><span className={`summary-dot dot-${tone}`} /><span>{label}</span><strong>{value}</strong></div> }
