import { useEffect, useState, type FormEvent } from 'react'
import { apiRequest, apiRequestPage } from '../api'
import type { FeeRecord, Role, Student, User } from '../types'
import { Badge, Button, EmptyState, ErrorMessage, Field, Loading, Modal, PageHeading, SelectInput, TextInput } from '../components/shared'
import { formatDate, formatMoney } from '../utils/format'
import { loadActiveStudents } from '../utils/activeStudents'

interface FeeDraft { studentId: string; description: string; academicYear: string; amount: string; dueDate: string }
interface FeeMeta { total: number; summary: { obligations: number; collected: number; outstanding: number } }

export function FeesPage({ user }: { user: User }) {
  const role: Role = user.role
  const [fees, setFees] = useState<FeeRecord[]>([])
  const [feeMeta, setFeeMeta] = useState<FeeMeta>({ total: 0, summary: { obligations: 0, collected: 0, outstanding: 0 } })
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [adding, setAdding] = useState(false)
  const [paying, setPaying] = useState<FeeRecord | null>(null)
  const [draft, setDraft] = useState<FeeDraft>({ studentId: '', description: '', academicYear: '2026-27', amount: '', dueDate: '' })
  const [payment, setPayment] = useState({ amount: '', referenceCode: '' })
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([
      apiRequestPage<FeeRecord[], FeeMeta>('/fees'),
      role === 'admin' ? loadActiveStudents() : Promise.resolve([] as Student[]),
    ]).then(([feeResult, studentRows]) => { if (active) { setFees(feeResult.data); setFeeMeta(feeResult.meta); setStudents(studentRows); setError('') } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load fee records.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role, refresh])

  async function createFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      await apiRequest('/fees', { method: 'POST', body: JSON.stringify({ ...draft, studentId: Number(draft.studentId), amount: Number(draft.amount) }) })
      setAdding(false); setDraft({ studentId: '', description: '', academicYear: '2026-27', amount: '', dueDate: '' }); setNotice('Fee obligation created.'); setRefresh((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create this fee record.') }
    finally { setSaving(false) }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!paying) return
    setSaving(true); setError(''); setNotice('')
    try {
      await apiRequest(`/fees/${paying.id}/payments`, { method: 'POST', body: JSON.stringify({ amount: Number(payment.amount), referenceCode: payment.referenceCode || undefined }) })
      setNotice('Payment record saved.'); setPaying(null); setPayment({ amount: '', referenceCode: '' }); setRefresh((value) => value + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not record this payment.') }
    finally { setSaving(false) }
  }

  return <div className="page-content"><PageHeading eyebrow="SCHOOL ACCOUNTS" title="Fees" description="Track fee obligations, payments, and outstanding balances." action={role === 'admin' ? <Button onClick={() => setAdding(true)}>＋ Add fee record</Button> : undefined} />{notice && <div className="notice notice-success" role="status">{notice}</div>}{error && <ErrorMessage>{error}</ErrorMessage>}
    {!loading && <div className="fee-summary"><FeeSummary label="Total obligations" amount={feeMeta.summary.obligations} color="blue" /><FeeSummary label="Payments recorded" amount={feeMeta.summary.collected} color="green" /><FeeSummary label="Outstanding" amount={feeMeta.summary.outstanding} color="amber" /></div>}
    {!loading && feeMeta.total > fees.length && <p className="muted">Showing the latest {fees.length} of {feeMeta.total} fee records. Totals include all records.</p>}
    <section className="surface table-surface"><div className="surface-heading"><div><p className="eyebrow">FEE LEDGER</p><h2>{role === 'student' ? 'My fee records' : 'Student fee records'}</h2></div></div>{loading ? <Loading label="Loading fee records…" /> : fees.length ? <div className="table-wrap"><table><thead><tr>{role === 'admin' && <th>Student</th>}<th>Fee</th><th>Academic year</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th>{role === 'admin' && <th className="align-right">Actions</th>}</tr></thead><tbody>{fees.map((fee) => <tr key={fee.id}>{role === 'admin' && <td><strong>{fee.studentName}</strong><small className="table-subtext">{fee.studentNumber}</small></td>}<td>{fee.description}</td><td>{fee.academicYear}</td><td>{formatDate(fee.dueDate)}</td><td>{formatMoney(fee.amount)}</td><td>{formatMoney(fee.amountPaid)}</td><td><strong>{formatMoney(fee.balance)}</strong></td><td><Badge tone={fee.status === 'paid' ? 'green' : fee.status === 'partially paid' ? 'amber' : 'red'}>{fee.status}</Badge></td>{role === 'admin' && <td className="align-right">{fee.balance > 0 ? <button className="text-button" onClick={() => { setPaying(fee); setPayment({ amount: String(fee.balance), referenceCode: '' }) }}>Record payment</button> : <span className="muted">Complete</span>}</td>}</tr>)}</tbody></table></div> : <EmptyState title="No fee records" detail="Fee obligations will appear here after they are created." />}</section>
    {adding && <Modal title="Add fee obligation" onClose={() => setAdding(false)}><form className="record-form" onSubmit={(event) => void createFee(event)}><div className="form-grid"><Field label="Student"><SelectInput required value={draft.studentId} onChange={(event) => setDraft({ ...draft, studentId: event.target.value })}><option value="">Choose a student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.studentNumber}</option>)}</SelectInput></Field><Field label="Fee description"><TextInput required maxLength={120} placeholder="Term 1 tuition" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field><Field label="Academic year"><TextInput required maxLength={16} placeholder="2026-27" value={draft.academicYear} onChange={(event) => setDraft({ ...draft, academicYear: event.target.value })} /></Field><Field label="Amount (₹)"><TextInput required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></Field><Field label="Due date"><TextInput required type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></Field></div><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button disabled={saving}>{saving ? 'Saving…' : 'Create obligation'}</Button></div></form></Modal>}
    {paying && <Modal title="Record fee payment" onClose={() => setPaying(null)}><p className="modal-copy">{paying.studentName} · {paying.description}<br />Outstanding balance: <strong>{formatMoney(paying.balance)}</strong></p><form className="record-form" onSubmit={(event) => void recordPayment(event)}><div className="form-grid"><Field label="Payment amount (₹)"><TextInput required type="number" min="0.01" max={paying.balance} step="0.01" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} /></Field><Field label="Reference code (optional)"><TextInput maxLength={80} placeholder="Generated automatically" value={payment.referenceCode} onChange={(event) => setPayment({ ...payment, referenceCode: event.target.value })} /></Field></div><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setPaying(null)}>Cancel</Button><Button disabled={saving}>{saving ? 'Saving…' : 'Save payment record'}</Button></div></form></Modal>}
  </div>
}

function FeeSummary({ label, amount, color }: { label: string; amount: number; color: string }) { return <div className={`fee-summary-card fee-${color}`}><span>{label}</span><strong>{formatMoney(amount)}</strong><small>Across all matching fee records</small></div> }
