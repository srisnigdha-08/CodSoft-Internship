import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, apiRequestPage, ApiClientError } from '../api'
import type { Role, SchoolClass, Student, User } from '../types'
import { Badge, Button, EmptyState, ErrorMessage, Field, Loading, Modal, PageHeading, SelectInput, TextInput } from '../components/shared'
import { formatDate, initials } from '../utils/format'

interface StudentPageMeta { page: number; limit: number; total: number; pages: number }
interface StudentDraft { email: string; password: string; firstName: string; lastName: string; studentNumber: string; classId: string; dateOfBirth: string; phone: string; address: string }
const emptyDraft: StudentDraft = { email: '', password: '', firstName: '', lastName: '', studentNumber: '', classId: '', dateOfBirth: '', phone: '', address: '' }

export function StudentsPage({ user }: { user: User }) {
  const role: Role = user.role
  const [students, setStudents] = useState<Student[]>([])
  const [ownStudent, setOwnStudent] = useState<Student | null>(null)
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [classFilter, setClassFilter] = useState('')
  const [sortOption, setSortOption] = useState('createdAt-desc')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState<StudentPageMeta>({ page: 1, limit: 10, total: 0, pages: 0 })
  const [refresh, setRefresh] = useState(0)
  const [editing, setEditing] = useState<Student | 'new' | null>(null)
  const [details, setDetails] = useState<Student | null>(null)
  const [deactivating, setDeactivating] = useState<Student | null>(null)

  useEffect(() => {
    let active = true
    async function loadStudents() {
      try {
        if (role === 'student') {
          if (!user.studentId) throw new Error('Your student profile is not linked to this account.')
          const ownRecord = await apiRequest<Student>(`/students/${user.studentId}`)
          if (active) { setOwnStudent(ownRecord); setError('') }
        } else {
          const params = new URLSearchParams({ page: String(page), limit: '10', status: statusFilter })
          if (search) params.set('search', search)
          if (classFilter) params.set('classId', classFilter)
          const [sortBy, sortOrder] = sortOption.split('-')
          params.set('sortBy', sortBy ?? 'createdAt')
          params.set('sortOrder', sortOrder ?? 'desc')
          const result = await apiRequestPage<Student[], StudentPageMeta>(`/students?${params.toString()}`)
          if (active) { setStudents(result.data); setMeta(result.meta); setError('') }
        }
      } catch (cause) {
        if (active) setError(cause instanceof ApiClientError || cause instanceof Error ? cause.message : 'Could not load students.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadStudents()
    return () => { active = false }
  }, [role, user.studentId, page, statusFilter, classFilter, sortOption, search, refresh])

  useEffect(() => {
    if (role === 'student') return
    apiRequest<SchoolClass[]>('/classes').then(setClasses).catch(() => setClasses([]))
  }, [role])

  async function deactivateStudent() {
    if (!deactivating) return
    try {
      await apiRequest(`/students/${deactivating.id}`, { method: 'DELETE' })
      setNotice(`${deactivating.firstName} ${deactivating.lastName} was deactivated.`)
      setDeactivating(null)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not deactivate this student.')
      setDeactivating(null)
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setPage(1)
    setSearch(searchInput.trim())
    setRefresh((value) => value + 1)
  }

  if (role === 'student') {
    return <div className="page-content"><PageHeading eyebrow="MY RECORD" title="Student profile" description="Your personal information and class placement." />{loading ? <Loading /> : error ? <ErrorMessage>{error}</ErrorMessage> : ownStudent ? <StudentDetail student={ownStudent} /> : <EmptyState title="Profile unavailable" detail="Ask an administrator to check your student account." />}</div>
  }

  return <div className="page-content">
    <PageHeading eyebrow="DIRECTORY" title="Students" description="Find student records and keep profile details up to date." action={role === 'admin' ? <Button onClick={() => setEditing('new')}>＋ Add student</Button> : undefined} />
    {notice && <div className="notice notice-success" role="status">{notice}<button className="notice-close" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <section className="surface table-surface">
      <div className="table-toolbar student-toolbar"><form className="search-form" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><TextInput aria-label="Search students" placeholder="Search by name, ID, or email" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /><Button variant="secondary" type="submit">Search</Button></form><div className="student-filters"><label className="filter-label"><span>Status</span><SelectInput aria-label="Filter by status" value={statusFilter} onChange={(event) => { setLoading(true); setError(''); setPage(1); setStatusFilter(event.target.value) }}><option value="active">Active students</option><option value="inactive">Inactive students</option></SelectInput></label><label className="filter-label"><span>Class</span><SelectInput aria-label="Filter by class" value={classFilter} onChange={(event) => { setLoading(true); setPage(1); setClassFilter(event.target.value) }}><option value="">All classes</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.section}</option>)}</SelectInput></label><label className="filter-label"><span>Sort</span><SelectInput aria-label="Sort students" value={sortOption} onChange={(event) => { setLoading(true); setPage(1); setSortOption(event.target.value) }}><option value="createdAt-desc">Newest first</option><option value="createdAt-asc">Oldest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="studentNumber-asc">Student ID A–Z</option><option value="studentNumber-desc">Student ID Z–A</option></SelectInput></label></div></div>
      {loading ? <Loading label="Loading student records…" /> : students.length ? <>
        <div className="table-wrap"><table><thead><tr><th>Student</th><th>Student ID</th><th>Class</th><th>Email</th><th>Status</th><th className="align-right">Actions</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><button className="person-cell person-button" onClick={() => setDetails(student)}><span className="avatar avatar-lavender">{initials(`${student.firstName} ${student.lastName}`)}</span><span><strong>{student.firstName} {student.lastName}</strong><small>Joined {formatDate(student.createdAt)}</small></span></button></td><td><span className="id-chip">{student.studentNumber}</span></td><td>{student.className ? `${student.className}${student.section ? ` · ${student.section}` : ''}` : <span className="muted">Unassigned</span>}</td><td>{student.email}</td><td><Badge tone={student.status === 'active' ? 'green' : 'neutral'}>{student.status}</Badge></td><td className="align-right"><div className="row-actions"><button className="text-button" onClick={() => setDetails(student)}>View</button>{role === 'admin' && <><button className="text-button" onClick={() => setEditing(student)}>Edit</button>{student.status === 'active' && <button className="text-button danger-text" onClick={() => setDeactivating(student)}>Deactivate</button>}</>}</div></td></tr>)}</tbody></table></div>
        <div className="pagination"><span>Showing {Math.min((page - 1) * meta.limit + 1, meta.total)}–{Math.min(page * meta.limit, meta.total)} of {meta.total} students</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)) }}>Previous</Button><span className="page-number">Page {page} of {Math.max(meta.pages, 1)}</span><Button variant="secondary" disabled={page >= meta.pages} onClick={() => { setLoading(true); setPage((value) => value + 1) }}>Next</Button></div></div>
      </> : <EmptyState title="No students found" detail={search ? 'Try a different name, ID, or email.' : 'There are no student records for this filter yet.'} />}
    </section>

    {editing && <StudentForm student={editing === 'new' ? undefined : editing} classes={classes} onClose={() => setEditing(null)} onSaved={(student) => { const wasEditing = editing !== 'new'; setEditing(null); setNotice(`${student.firstName} ${student.lastName} was ${wasEditing ? 'updated' : 'added'}.`); setRefresh((value) => value + 1) }} />}
    {details && <Modal title="Student details" onClose={() => setDetails(null)}><StudentDetail student={details} compact /></Modal>}
    {deactivating && <Modal title="Deactivate student?" onClose={() => setDeactivating(null)}><p className="modal-copy">{deactivating.firstName} {deactivating.lastName} will no longer be able to sign in. Their attendance, results, and fee history will remain available.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setDeactivating(null)}>Cancel</Button><Button variant="danger" onClick={() => void deactivateStudent()}>Deactivate student</Button></div></Modal>}
  </div>
}

function StudentForm({ student, classes, onClose, onSaved }: { student?: Student; classes: SchoolClass[]; onClose: () => void; onSaved: (student: Student) => void }) {
  const [draft, setDraft] = useState<StudentDraft>(student ? { email: student.email, password: '', firstName: student.firstName, lastName: student.lastName, studentNumber: student.studentNumber, classId: student.classId ? String(student.classId) : '', dateOfBirth: student.dateOfBirth ?? '', phone: student.phone ?? '', address: student.address ?? '' } : emptyDraft)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const editing = Boolean(student)
  const update = (field: keyof StudentDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!editing && draft.password.length < 10) { setError('Set an initial password of at least 10 characters.'); return }
    setPending(true)
    const body = { ...draft, classId: draft.classId || null, dateOfBirth: draft.dateOfBirth || null, phone: draft.phone || null }
    try {
      const saved = await apiRequest<Student>(editing ? `/students/${student?.id}` : '/students', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      onSaved(saved)
    } catch (cause) { setError(cause instanceof ApiClientError || cause instanceof Error ? cause.message : 'Could not save this student.') }
    finally { setPending(false) }
  }

  return <Modal title={editing ? 'Edit student' : 'Add a student'} onClose={onClose}><form className="record-form" onSubmit={(event) => void submit(event)}>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <div className="form-grid"><Field label="First name"><TextInput required maxLength={80} value={draft.firstName} onChange={(event) => update('firstName', event.target.value)} /></Field><Field label="Last name"><TextInput required maxLength={80} value={draft.lastName} onChange={(event) => update('lastName', event.target.value)} /></Field><Field label="School email"><TextInput type="email" required maxLength={254} value={draft.email} onChange={(event) => update('email', event.target.value)} /></Field><Field label="Student ID"><TextInput required maxLength={40} value={draft.studentNumber} onChange={(event) => update('studentNumber', event.target.value)} /></Field>
      {!editing && <Field label="Initial password"><TextInput type="password" required minLength={10} autoComplete="new-password" value={draft.password} onChange={(event) => update('password', event.target.value)} /><small className="field-hint">At least 10 characters. Share it with the student securely.</small></Field>}
      <Field label="Class"><SelectInput value={draft.classId} onChange={(event) => update('classId', event.target.value)}><option value="">Unassigned</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.section}</option>)}</SelectInput></Field><Field label="Date of birth"><TextInput type="date" value={draft.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></Field><Field label="Phone"><TextInput type="tel" maxLength={32} value={draft.phone} onChange={(event) => update('phone', event.target.value)} /></Field><Field label="Address"><TextInput maxLength={255} value={draft.address} onChange={(event) => update('address', event.target.value)} /></Field></div>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create student'}</Button></div>
  </form></Modal>
}

function StudentDetail({ student, compact = false }: { student: Student; compact?: boolean }) {
  return <div className={`student-profile ${compact ? 'student-profile-compact' : ''}`}><div className="profile-banner"><div className="avatar avatar-large">{initials(`${student.firstName} ${student.lastName}`)}</div><div><h2>{student.firstName} {student.lastName}</h2><p>{student.studentNumber}</p></div><Badge tone={student.status === 'active' ? 'green' : 'neutral'}>{student.status}</Badge></div><dl className="detail-grid"><div><dt>School email</dt><dd>{student.email}</dd></div><div><dt>Class</dt><dd>{student.className ? `${student.className} · ${student.section}` : 'Unassigned'}</dd></div><div><dt>Date of birth</dt><dd>{student.dateOfBirth ? formatDate(student.dateOfBirth) : 'Not provided'}</dd></div><div><dt>Phone</dt><dd>{student.phone || 'Not provided'}</dd></div><div><dt>Address</dt><dd>{student.address || 'Not provided'}</dd></div><div><dt>Registered</dt><dd>{formatDate(student.createdAt)}</dd></div></dl></div>
}
