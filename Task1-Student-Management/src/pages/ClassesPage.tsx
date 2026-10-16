import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest } from '../api'
import type { SchoolClass, Teacher } from '../types'
import { Button, EmptyState, ErrorMessage, Field, Loading, Modal, PageHeading, SelectInput, TextInput } from '../components/shared'

interface ClassDraft { name: string; section: string; teacherId: string }

export function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editing, setEditing] = useState<SchoolClass | 'new' | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([apiRequest<SchoolClass[]>('/classes'), apiRequest<Teacher[]>('/teachers')])
      .then(([nextClasses, nextTeachers]) => { if (active) { setClasses(nextClasses); setTeachers(nextTeachers) } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load classes.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refresh])

  return <div className="page-content"><PageHeading eyebrow="ACADEMIC SETUP" title="Classes" description="Organize class sections and assign a teacher to each group." action={<Button onClick={() => setEditing('new')}>＋ Add class</Button>} />{error && <ErrorMessage>{error}</ErrorMessage>}<section className="surface table-surface">{loading ? <Loading label="Loading classes…" /> : classes.length ? <div className="table-wrap"><table><thead><tr><th>Class</th><th>Section</th><th>Class teacher</th><th>Active students</th><th className="align-right">Actions</th></tr></thead><tbody>{classes.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><span className="id-chip">{item.section}</span></td><td>{item.teacherName || <span className="muted">Not assigned</span>}</td><td>{item.studentCount}</td><td className="align-right"><button className="text-button" onClick={() => setEditing(item)}>Edit</button></td></tr>)}</tbody></table></div> : <EmptyState title="No classes yet" detail="Create a class before assigning students, attendance, or examinations." />}</section>{editing && <ClassForm item={editing === 'new' ? undefined : editing} teachers={teachers} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRefresh((value) => value + 1) }} />}</div>
}

function ClassForm({ item, teachers, onClose, onSaved }: { item?: SchoolClass; teachers: Teacher[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<ClassDraft>(item ? { name: item.name, section: item.section, teacherId: item.teacherId ? String(item.teacherId) : '' } : { name: '', section: 'A', teacherId: '' })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setPending(true)
    try {
      await apiRequest(item ? `/classes/${item.id}` : '/classes', { method: item ? 'PUT' : 'POST', body: JSON.stringify({ ...draft, teacherId: draft.teacherId || null }) })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this class.') }
    finally { setPending(false) }
  }
  return <Modal title={item ? 'Edit class' : 'Create class'} onClose={onClose}><form className="record-form" onSubmit={(event) => void submit(event)}>{error && <ErrorMessage>{error}</ErrorMessage>}<div className="form-grid"><Field label="Class name"><TextInput required maxLength={80} placeholder="Grade 10" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="Section"><TextInput required maxLength={40} placeholder="A" value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} /></Field><Field label="Class teacher"><SelectInput value={draft.teacherId} onChange={(event) => setDraft({ ...draft, teacherId: event.target.value })}><option value="">Not assigned</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName} · {teacher.subject}</option>)}</SelectInput></Field></div><div className="modal-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button disabled={pending}>{pending ? 'Saving…' : item ? 'Save class' : 'Create class'}</Button></div></form></Modal>
}
