import { useEffect, useState } from 'react'
import { apiRequest } from './api'
import { LoginForm } from './components/LoginForm'
import { AttendancePage } from './pages/AttendancePage'
import { AcademicsPage } from './pages/AcademicsPage'
import { ClassesPage } from './pages/ClassesPage'
import { DashboardPage } from './pages/DashboardPage'
import { FeesPage } from './pages/FeesPage'
import { StudentsPage } from './pages/StudentsPage'
import { TeachersPage } from './pages/TeachersPage'
import type { Section, User } from './types'
import { Badge, Loading } from './components/shared'
import { initials } from './utils/format'
import { sectionFromHash } from './navigation'
import './App.css'

const icons: Record<Section, string> = {
  dashboard: '▦', students: '♙', teachers: '♧', classes: '▤', attendance: '◷', academics: '⌁', fees: '₹',
}
const labels: Record<Section, string> = {
  dashboard: 'Dashboard', students: 'Students', teachers: 'Teachers', classes: 'Classes', attendance: 'Attendance', academics: 'Academics', fees: 'Fees',
}

function sectionsFor(role: User['role']): Section[] {
  if (role === 'admin') return ['dashboard', 'students', 'teachers', 'classes', 'attendance', 'academics', 'fees']
  if (role === 'teacher') return ['dashboard', 'students', 'attendance', 'academics']
  return ['dashboard', 'students', 'attendance', 'academics', 'fees']
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [section, setSection] = useState<Section>(() => sectionFromHash(window.location.hash))

  useEffect(() => {
    const syncSection = () => setSection(sectionFromHash(window.location.hash))
    window.addEventListener('hashchange', syncSection)
    window.addEventListener('popstate', syncSection)
    return () => {
      window.removeEventListener('hashchange', syncSection)
      window.removeEventListener('popstate', syncSection)
    }
  }, [])

  function navigate(next: Section) {
    window.history.pushState(null, '', `#/${next}`)
    setSection(next)
  }

  useEffect(() => {
    let active = true
    apiRequest<{ user: User }>('/auth/me')
      .then((result) => { if (active) setUser(result.user) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [])

  async function logout() {
    try { await apiRequest('/auth/logout', { method: 'POST' }) } catch { /* Clear the local view even when the API is unavailable. */ }
    setUser(null)
    navigate('dashboard')
  }

  if (checkingSession) return <div className="app-loading"><Loading label="Opening your workspace…" /></div>
  if (!user) return <LoginForm onLogin={(nextUser) => { setUser(nextUser); setSection(sectionFromHash(window.location.hash)) }} />

  const availableSections = sectionsFor(user.role)
  const activeSection = availableSections.includes(section) ? section : 'dashboard'
  const roleLabel = user.role === 'admin' ? 'Administrator' : user.role === 'teacher' ? 'Teacher' : 'Student'

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-brand"><div className="brand-mark">N</div><div><strong>Northstar</strong><small>ACADEMY PORTAL</small></div></div>
      <div className="sidebar-school"><span className="school-avatar">N</span><span><strong>Northstar Academy</strong><small>School workspace</small></span><span className="chevron">⌄</span></div>
      <p className="nav-label">WORKSPACE</p>
      <nav className="main-nav" aria-label="Main navigation">{availableSections.map((key) => <button key={key} className={`nav-item ${activeSection === key ? 'active' : ''}`} onClick={() => navigate(key)} aria-current={activeSection === key ? 'page' : undefined}><span className="nav-icon" aria-hidden="true">{icons[key]}</span><span>{labels[key]}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">?</span><div><strong>Need a hand?</strong><small>Ask your school administrator</small></div></div><button className="account-row" onClick={() => void logout()} title="Sign out"><span className="avatar avatar-user">{initials(user.email.split('@')[0] ?? user.email)}</span><span className="account-details"><strong>{user.email.split('@')[0]}</strong><small>{roleLabel}</small></span><span className="logout-icon" aria-hidden="true">↪</span></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Northstar Academy</span><span className="crumb-divider">/</span><strong>{labels[activeSection]}</strong></div><div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><span className="topbar-divider" /><div className="topbar-user"><span className="avatar avatar-user">{initials(user.email.split('@')[0] ?? user.email)}</span><span className="topbar-role">{roleLabel}</span><Badge tone="blue">{user.role}</Badge></div></div></header>
      <div className="main-scroll">{activeSection === 'dashboard' && <DashboardPage role={user.role} onNavigate={navigate} />}{activeSection === 'students' && <StudentsPage user={user} />}{activeSection === 'teachers' && <TeachersPage />}{activeSection === 'classes' && <ClassesPage />}{activeSection === 'attendance' && <AttendancePage user={user} />}{activeSection === 'academics' && <AcademicsPage user={user} />}{activeSection === 'fees' && <FeesPage user={user} />}</div>
    </main>
  </div>
}
