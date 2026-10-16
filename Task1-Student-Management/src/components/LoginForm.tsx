import { useState, type FormEvent } from 'react'
import { apiRequest, ApiClientError } from '../api'
import type { User } from '../types'
import { Button, ErrorMessage, Field, TextInput } from './shared'

export function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid school email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setPending(true)
    try {
      const result = await apiRequest<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password }),
      })
      onLogin(result.user)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Unable to sign in. Check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="login-page">
    <div className="login-visual" aria-hidden="true">
      <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
      <div className="visual-quote"><span className="visual-mark">✳</span><p>Every learner has a story.<br /><strong>Let’s help them thrive.</strong></p><small>One clear view of your school day.</small></div>
      <div className="visual-dots" />
    </div>
    <div className="login-panel">
      <div className="login-brand"><div className="brand-mark">N</div><span>Northstar <b>Academy</b></span></div>
      <div className="login-copy"><p className="eyebrow">SCHOOL PORTAL</p><h1>Welcome back</h1><p>Sign in to continue to your workspace.</p></div>
      <form className="login-form" onSubmit={(event) => void submit(event)} noValidate>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Field label="School email">
          <TextInput type="email" autoComplete="username" placeholder="you@school.edu" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="School email" />
        </Field>
        <Field label="Password">
          <TextInput type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} aria-label="Password" />
        </Field>
        <Button type="submit" disabled={pending} className="login-submit">{pending ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">→</span></Button>
      </form>
      <p className="login-help">Need access? <span>Contact your school administrator.</span></p>
      <div className="login-footer"><span>© 2026 Northstar Academy</span><span>Secure school workspace</span></div>
    </div>
  </main>
}
