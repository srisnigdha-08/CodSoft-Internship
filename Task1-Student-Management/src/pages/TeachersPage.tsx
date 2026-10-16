import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, ApiClientError } from '../api'
import type { Teacher } from '../types'
import { Button, EmptyState, ErrorMessage, Field, Loading, Modal, PageHeading, TextInput } from '../components/shared'
import { formatDate, initials } from '../utils/format'

interface TeacherDraft { email: string; password: string; firstName: string; lastName: string; employeeNumber: string; subject: string }
const blankTeacher: TeacherDraft = { email: '', password: '', firstName: '', lastName: '', employeeNumber: '', subject: '' }

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editing, setEditing] = useState<Teacher | 'new' | null>(null)
  const [deactivating, setDeactivating] = useState<Teacher | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    apiRequest<Teacher[]>(`/teachers${query ? `?search=${encodeURIComponent(query)}` : ''}`)
      .then((value) => { if (active) setTeachers(value) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load teachers.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, refresh])

  async function deactivate() {
    if (!deactivating) return
    try {
      await apiRequest(`/teachers/${deactivating.id}`, { method: 'DELETE' })
      setNotice(`${deactivating.firstName} ${deactivating.lastName} was deactivated.`)
      setRefresh((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not deactivate teacher.') }
    setDeactivating(null)
  }

  return <div className="page-content">
    <PageHeading eyebrow="PEOPLE" title="Teachers" description="Manage staff accounts, subjects, and employee profiles." action={<Button onClick={() => setEditing('new')}>＋ Add teacher</Button>} />
    {notice && <div className="notice notice-success" role="status">{notice}<button className="notice-close" onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}{error && <ErrorMessage>{error}</ErrorMessage>}
    <section className="surface table-surface"><div className="table-toolbar"><label className="search-form search-as-label"><span aria-hidden="true">⌕</span><TextInput aria-label="Search teachers" placeholder="Search name, subject, or employee ID" value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value) }} /></label><span className="result-count">Showing {teachers.length} active {teachers.length === 1 ? 'teacher' : 'teachers'}</span></div>
      {loading ? <Loading label="Loading teacher profiles…" /> : teachers.length ? <div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Employee ID</th><th>Subject</th><th>Email</th><th className="align-right">Actions</th></tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.id}><td><div className="person-cell"><span className="avatar avatar-peach">{initials(`${teacher.firstName} ${teacher.lastName}`)}</span><span><strong>{teacher.firstName} {teacher.lastName}</strong><small>Added {formatDate(teacher.createdAt)}</small></span></div></td><td><span className="id-chip">{teacher.employeeNumber}</span></td><td>{teacher.subject}</td><td>{teacher.email}</td><td className="align-right"><div className="row-actions"><button className="text-button" onClick={() => setEditing(teacher)}>Edit</button><button className="text-button danger-text" onClick={() => setDeactivating(teacher)}>Deactivate</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No teacher profiles found" detail="Add a teacher profile to assign staff to classes." />}
    </section>
    {editing && <TeacherForm teacher={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(teacher) => { const changed = editing !== 'new'; setEditing(null); setNotice(`${teacher.firstName} ${teacher.lastName} was ${changed ? 'updated' : 'added'}.`); setRefresh((value) => value + 1) }} />}
    {deactivating && <Modal title="Deactivate teacher?" onClose={() => setDeactivating(null)}><p className="modal-copy">{deactivating.firstName} {deactivating.lastName} will lose access to the teacher workspace. Existing academic records remain in the system.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setDeactivating(null)}>Cancel</Button><Button variant="danger" onClick={() => void deactivate()}>Deactivate teacher</Button></div></Modal>}
  </div>
}

function TeacherForm({ teacher, onClose, onSaved }: { teacher?: Teacher; onClose: () => void; onSaved: (teacher: Teacher) => void }) {
  const [draft, setDraft] = useState<TeacherDraft>(teacher ? { email: teacher.email, password: '', firstName: teacher.firstName, lastName: teacher.lastName, employeeNumber: teacher.employeeNumber, subject: teacher.subject } : blankTeacher)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const update = (field: keyof TeacherDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!teacher && draft.password.length < 10) { setError('Set an initial password of at least 10 characters.'); return }
    setPending(true)
    try {
      const result = await apiRequest<Teacher>(teacher ? `/teachers/${teacher.id}` : '/teachers', { method: teacher ? 'PUT' : 'POST', body: JSON.stringify(draft) })
      onSaved(result)
    } catch (cause) { setError(cause instanceof ApiClientError || cause instanceof Error ? cause.message : 'Could not save this teacher.') }
    finally { setPending(false) }
  }

  return <Modal title={teacher ? 'Edit teacher' : 'Add a teacher'} onClose={onClose}><form className="record-form" onSubmit={(event) => void submit(event)}>{error && <ErrorMessage>{error}</ErrorMessage>}<div className="form-grid"><Field label="First name"><TextInput required maxLength={80} value={draft.firstName} onChange={(event) => update('firstName', event.target.value)} /></Field><Field label="Last name"><TextInput required maxLength={80} value={draft.lastName} onChange={(event) => update('lastName', event.target.value)} /></Field><Field label="School email"><TextInput required type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} /></Field><Field label="Employee ID"><TextInput required maxLength={40} value={draft.employeeNumber} onChange={(event) => update('employeeNumber', event.target.value)} /></Field><Field label="Subject"><TextInput required maxLength={120} value={draft.subject} onChange={(event) => update('subject', event.target.value)} /></Field>{!teacher && <Field label="Initial password"><TextInput required type="password" minLength={10} autoComplete="new-password" value={draft.password} onChange={(event) => update('password', event.target.value)} /></Field>}</div><div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? 'Saving…' : teacher ? 'Save changes' : 'Create teacher'}</Button></div></form></Modal>
}
