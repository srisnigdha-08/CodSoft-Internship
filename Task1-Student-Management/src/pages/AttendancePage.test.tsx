import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceRecord, User } from '../types'
import { AttendancePage } from './AttendancePage'

const admin: User = { id: 1, email: 'admin@integration.example.test', role: 'admin' }
const student: User = { id: 2, email: 'student@integration.example.test', role: 'student', studentId: 1 }
const record: AttendanceRecord = {
  id: 5, studentId: 1, studentName: 'Test Learner', studentNumber: 'UI-S1',
  classId: 1, className: 'Test Grade', section: 'A', date: '2026-10-16', status: 'present',
}

function json(data: unknown, meta?: unknown, status = 200) {
  return new Response(JSON.stringify({ data, ...(meta ? { meta } : {}) }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}

function fakeApi(failCorrection = false) {
  let current = { ...record }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/attendance/5/corrections') return json(current.status === 'late' ? [{ id: 1, attendanceId: 5, previousStatus: 'present', newStatus: 'late', correctedBy: 1, correctedAt: '2026-10-16T12:00:00.000Z' }] : [])
    if (path === '/api/attendance/5' && init?.method === 'PUT') {
      if (failCorrection) return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You can only correct attendance for your assigned classes.' } }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      current = { ...current, status: 'late' }
      return json(current)
    }
    if (path.startsWith('/api/attendance')) return json([current], { summary: { present: current.status === 'present' ? 1 : 0, absent: 0, late: current.status === 'late' ? 1 : 0 }, total: 1 })
    if (path === '/api/classes') return json([{ id: 1, name: 'Test Grade', section: 'A', teacherId: null, teacherName: null, studentCount: 1 }])
    if (path.startsWith('/api/students')) return json([], { page: 1, total: 0, pages: 1 })
    throw new Error(`Unexpected test request: ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AttendancePage correction', () => {
  it('lets an administrator correct a record and reloads the audit history', async () => {
    const fetchMock = fakeApi()
    render(<AttendancePage user={admin} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Correct' }))
    expect(await screen.findByText('No corrections yet.')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Corrected status'), 'late')
    await userEvent.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByText('Attendance for Test Learner was corrected.')).toBeInTheDocument()
    expect(await screen.findByText('present → late')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/attendance/5', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ status: 'late' }) })))
  })

  it('shows a correction error without changing the displayed status', async () => {
    fakeApi(true)
    render(<AttendancePage user={admin} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Correct' }))
    await userEvent.selectOptions(screen.getByLabelText('Corrected status'), 'late')
    await userEvent.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You can only correct attendance for your assigned classes.')
    expect(screen.getByText(/Current status:/)).toHaveTextContent('present')
  })

  it('does not offer correction controls to students', async () => {
    fakeApi()
    render(<AttendancePage user={student} />)
    expect(await screen.findByText('Test Learner')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Correct' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Take attendance' })).not.toBeInTheDocument()
  })
})
