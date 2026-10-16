import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from './LoginForm'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('LoginForm', () => {
  it('validates an invalid email before sending a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginForm onLogin={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('School email'), 'not-an-email')
    await userEvent.type(screen.getByLabelText('Password'), 'example-password')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid school email address.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a readable API error when sign-in fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })))
    render(<LoginForm onLogin={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('School email'), 'person@school.edu')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
  })

  it('passes the authenticated user to the app after a successful login', async () => {
    const onLogin = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { user: { id: 8, email: 'admin@school.local', role: 'admin' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    render(<LoginForm onLogin={onLogin} />)

    await userEvent.type(screen.getByLabelText('School email'), ' ADMIN@SCHOOL.LOCAL ')
    await userEvent.type(screen.getByLabelText('Password'), 'Admin@12345')
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: 8, email: 'admin@school.local', role: 'admin' }))
  })
})
