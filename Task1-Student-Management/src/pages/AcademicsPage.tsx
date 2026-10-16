import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiRequest, apiRequestPage } from '../api'
import type { AcademicResult, Examination, Role, SchoolClass, Student, User } from '../types'
import { Badge, Button, EmptyState, ErrorMessage, Field, Loading, PageHeading, SelectInput, TextInput } from '../components/shared'
import { formatDate } from '../utils/format'
import { loadActiveStudents } from '../utils/activeStudents'

export function AcademicsPage({ user }: { user: User }) {
  const role: Role = user.role
  const [examinations, setExaminations] = useState<Examination[]>([])
  const [results, setResults] = useState<AcademicResult[]>([])
  const [resultPage, setResultPage] = useState(1)
  const [resultMeta, setResultMeta] = useState({ total: 0, pages: 0 })
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [examDraft, setExamDraft] = useState({ title: '', classId: '', date: '', maxScore: '100' })
  const [resultDraft, setResultDraft] = useState({ examinationId: '', studentId: '', score: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const selectedExam = examinations.find((exam) => exam.id === Number(resultDraft.examinationId))
  const eligibleStudents = useMemo(() => students.filter((student) => student.classId === selectedExam?.classId), [students, selectedExam])

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<Examination[]>('/academics/examinations'),
      apiRequestPage<AcademicResult[], { total: number; pages: number }>(`/academics/results?page=${resultPage}`),
      role === 'student' ? Promise.resolve([] as SchoolClass[]) : apiRequest<SchoolClass[]>('/classes'),
      role === 'student' ? Promise.resolve([] as Student[]) : loadActiveStudents(),
    ]).then(([examRows, resultResponse, classRows, studentRows]) => {
      if (!active) return
      setExaminations(examRows); setResults(resultResponse.data); setResultMeta(resultResponse.meta); setClasses(classRows); setStudents(studentRows); setError('')
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load academic records.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role, refresh, resultPage])

  async function saveExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await apiRequest('/academics/examinations', { method: 'POST', body: JSON.stringify({ ...examDraft, classId: Number(examDraft.classId), maxScore: Number(examDraft.maxScore) }) })
      setExamDraft({ title: '', classId: '', date: '', maxScore: '100' }); setNotice('Examination created.'); setRefresh((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create examination.') }
    finally { setSaving(false) }
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await apiRequest('/academics/results', { method: 'POST', body: JSON.stringify({ examinationId: Number(resultDraft.examinationId), studentId: Number(resultDraft.studentId), score: Number(resultDraft.score) }) })
      setResultDraft({ examinationId: '', studentId: '', score: '' }); setNotice('Student result saved.'); setRefresh((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this result.') }
    finally { setSaving(false) }
  }

  return <div className="page-content"><PageHeading eyebrow="LEARNING" title="Academics" description={role === 'student' ? 'Review your examinations and results.' : 'Create examinations and keep student results together.'} />{notice && <div className="notice notice-success" role="status">{notice}</div>}{error && <ErrorMessage>{error}</ErrorMessage>}
    {role !== 'student' && <div className="two-column-forms"><section className="surface form-surface"><div className="surface-heading"><div><p className="eyebrow">ASSESSMENTS</p><h2>New examination</h2></div></div><form className="stack-form" onSubmit={(event) => void saveExam(event)}><Field label="Examination title"><TextInput required maxLength={120} placeholder="Term 1 Mathematics" value={examDraft.title} onChange={(event) => setExamDraft({ ...examDraft, title: event.target.value })} /></Field><div className="form-grid"><Field label="Class"><SelectInput required value={examDraft.classId} onChange={(event) => setExamDraft({ ...examDraft, classId: event.target.value })}><option value="">Choose a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.section}</option>)}</SelectInput></Field><Field label="Date"><TextInput required type="date" value={examDraft.date} onChange={(event) => setExamDraft({ ...examDraft, date: event.target.value })} /></Field><Field label="Maximum score"><TextInput required type="number" min="0.01" step="0.01" value={examDraft.maxScore} onChange={(event) => setExamDraft({ ...examDraft, maxScore: event.target.value })} /></Field></div><Button disabled={saving || !classes.length}>{saving ? 'Saving…' : 'Create examination'}</Button></form></section>
      <section className="surface form-surface"><div className="surface-heading"><div><p className="eyebrow">MARKS</p><h2>Record a result</h2></div></div><form className="stack-form" onSubmit={(event) => void saveResult(event)}><Field label="Examination"><SelectInput required value={resultDraft.examinationId} onChange={(event) => setResultDraft({ ...resultDraft, examinationId: event.target.value, studentId: '' })}><option value="">Choose an examination</option>{examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.className}</option>)}</SelectInput></Field><div className="form-grid"><Field label="Student"><SelectInput required disabled={!selectedExam} value={resultDraft.studentId} onChange={(event) => setResultDraft({ ...resultDraft, studentId: event.target.value })}><option value="">Choose a student</option>{eligibleStudents.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.studentNumber}</option>)}</SelectInput></Field><Field label={`Score${selectedExam ? ` (out of ${selectedExam.maxScore})` : ''}`}><TextInput required type="number" min="0" max={selectedExam?.maxScore} step="0.01" value={resultDraft.score} onChange={(event) => setResultDraft({ ...resultDraft, score: event.target.value })} /></Field></div><Button disabled={saving || !examinations.length}>{saving ? 'Saving…' : 'Save result'}</Button></form></section></div>}
    <section className="surface table-surface"><div className="surface-heading"><div><p className="eyebrow">EXAM SCHEDULE</p><h2>Examinations</h2></div></div>{loading ? <Loading label="Loading examinations…" /> : examinations.length ? <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Class</th><th>Date</th><th>Maximum score</th></tr></thead><tbody>{examinations.map((exam) => <tr key={exam.id}><td><strong>{exam.title}</strong></td><td>{exam.className} · {exam.section}</td><td>{formatDate(exam.date)}</td><td>{exam.maxScore}</td></tr>)}</tbody></table></div> : <EmptyState title="No examinations yet" detail="Examinations will appear here once added." />}</section>
    <section className="surface table-surface"><div className="surface-heading"><div><p className="eyebrow">RESULTS</p><h2>{role === 'student' ? 'My results' : 'Student results'}</h2></div></div>{loading ? <Loading label="Loading results…" /> : results.length ? <div className="table-wrap"><table><thead><tr>{role !== 'student' && <th>Student</th>}<th>Examination</th><th>Class</th><th>Date</th><th>Score</th><th>Progress</th></tr></thead><tbody>{results.map((result) => <tr key={result.id}>{role !== 'student' && <td><strong>{result.studentName}</strong><small className="table-subtext">{result.studentNumber}</small></td>}<td>{result.examination}</td><td>{result.className}</td><td>{formatDate(result.date)}</td><td><strong>{result.score}</strong><span className="muted"> / {result.maxScore}</span></td><td><Badge tone={result.score / result.maxScore >= 0.85 ? 'green' : result.score / result.maxScore >= 0.70 ? 'amber' : 'red'}>{Math.round((result.score / result.maxScore) * 100)}%</Badge></td></tr>)}</tbody></table></div> : <EmptyState title="No results recorded" detail="Marks will appear here when they are saved for an examination." />}</section>
    {!loading && resultMeta.total > 0 && <div className="pagination"><span>Showing page {resultPage} of {Math.max(resultMeta.pages, 1)} · {resultMeta.total} results</span><div><Button variant="secondary" disabled={resultPage <= 1} onClick={() => { setLoading(true); setResultPage((page) => page - 1) }}>Previous</Button><Button variant="secondary" disabled={resultPage >= resultMeta.pages} onClick={() => { setLoading(true); setResultPage((page) => page + 1) }}>Next</Button></div></div>}
  </div>
}
