import { useEffect, useState } from 'react'
import { apiRequest, ApiClientError } from '../api'
import type { DashboardStats, Role, Section } from '../types'
import { Badge, Button, EmptyState, ErrorMessage, Loading, PageHeading } from '../components/shared'
import { formatDate, formatMoney, initials } from '../utils/format'

export function DashboardPage({ role, onNavigate }: { role: Role; onNavigate: (section: Section) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiRequest<DashboardStats>('/dashboard/stats')
      .then((value) => { if (active) setStats(value) })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiClientError ? cause.message : 'Could not load dashboard information.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return <div className="page-content">
    <PageHeading eyebrow="OVERVIEW" title={`${greeting}.`} description="Here’s what’s happening across your school today." action={role === 'admin' ? <Button onClick={() => onNavigate('students')}>Open students</Button> : undefined} />
    {loading && <Loading label="Loading school statistics…" />}
    {error && <ErrorMessage>{error}</ErrorMessage>}
    {stats && <>
      <div className={`stats-grid ${role === 'student' ? 'stats-grid-student' : ''}`}>
        {role !== 'student' && <StatCard label={role === 'teacher' ? 'My students' : 'Total students'} value={stats.summary.totalStudents} caption="Active student records" icon="↗" tone="lavender" />}
        {role === 'admin' && <StatCard label="Teaching staff" value={stats.summary.totalTeachers} caption="Active teacher profiles" icon="♙" tone="peach" />}
        <StatCard label="Present today" value={stats.summary.attendance.present + stats.summary.attendance.late} caption={`${stats.summary.attendance.total} records today`} icon="✓" tone="mint" />
        <div className="stat-card attendance-stat">
          <div className="stat-top"><span>Attendance rate</span><span className="stat-icon icon-blue">◔</span></div>
          <div className="attendance-rate"><strong>{stats.summary.attendance.total ? `${stats.summary.attendance.percentage}%` : '—'}</strong><div className="attendance-ring" style={{ background: `conic-gradient(#3e8c78 ${stats.summary.attendance.percentage}%, #e8eeeb 0)` }}><span>{stats.summary.attendance.total ? `${stats.summary.attendance.total}` : '0'}</span></div></div>
          <small>Present or late, based on today’s records</small>
        </div>
      </div>

      <div className={`report-grid ${stats.fees ? '' : 'report-grid-two'}`}>
        <section className="surface report-surface">
          <div className="surface-heading"><div><p className="eyebrow">LAST 14 DAYS</p><h2>Attendance trend</h2></div><Badge tone="green">{stats.summary.attendance.total ? `${stats.summary.attendance.percentage}% today` : 'No records today'}</Badge></div>
          {stats.attendanceTrend.some((day) => day.total > 0) ? <>
            <div className="attendance-chart" role="img" aria-label="Daily percentage of attendance records marked present or late over the last fourteen days">
              <div className="chart-y-axis" aria-hidden="true"><small>100%</small><small>50%</small><small>0%</small></div>
              <div className="chart-days">
                {stats.attendanceTrend.map((day) => {
                  const date = new Date(`${day.date}T12:00:00`)
                  const detail = day.total
                    ? `${formatDate(day.date)}: ${day.percentage}% present or late; ${day.present} present, ${day.late} late, ${day.absent} absent.`
                    : `${formatDate(day.date)}: no attendance records.`
                  return <div className="chart-day" key={day.date} title={detail}>
                    <small className="chart-value">{day.total ? `${day.percentage}%` : '—'}</small>
                    <div className="chart-bar-track">
                      <span className={`chart-bar ${day.total ? '' : 'chart-bar-empty'}`} style={{ height: `${day.total ? day.percentage : 0}%` }} />
                    </div>
                    <small>{date.toLocaleDateString('en', { day: 'numeric' })}</small>
                    <small className="chart-weekday">{date.toLocaleDateString('en', { weekday: 'short' })}</small>
                  </div>
                })}
              </div>
            </div>
            <div className="chart-legend"><span><i className="legend-dot" />Present or late</span><span>{stats.attendanceTrend.reduce((count, day) => count + day.total, 0).toLocaleString()} attendance records</span></div>
          </> : <EmptyState title="No recent attendance" detail="Attendance entries for the last two weeks will appear here." />}
        </section>

        <section className="surface report-surface academic-report">
          <div className="surface-heading"><div><p className="eyebrow">ASSESSMENTS</p><h2>Academic summary</h2></div><span className="report-icon">⌁</span></div>
          <div className="report-highlight"><strong>{stats.academics.resultCount ? `${stats.academics.averagePercentage}%` : '—'}</strong><span>Average score across recorded results</span></div>
          <div className="grade-band-list">
            <GradeBand label="Strong · 85%+" value={stats.academics.gradeBands.strong} color="strong" />
            <GradeBand label="Steady · 70–84%" value={stats.academics.gradeBands.steady} color="steady" />
            <GradeBand label="Needs support · under 70%" value={stats.academics.gradeBands.support} color="support" />
          </div>
          <small className="report-footnote">{stats.academics.resultCount.toLocaleString()} results recorded</small>
        </section>

        {stats.fees && <section className="surface report-surface fees-report">
          <div className="surface-heading"><div><p className="eyebrow">FEE LEDGER</p><h2>{role === 'student' ? 'My fee summary' : 'Fee summary'}</h2></div><button className="text-button" onClick={() => onNavigate('fees')}>Open ledger →</button></div>
          {stats.fees.obligations > 0 ? <>
            <div className="fee-progress-label"><span>Collected</span><strong>{stats.fees.obligations ? Math.round((stats.fees.collected / stats.fees.obligations) * 100) : 0}%</strong></div>
            <div className="fee-progress" aria-label={`${formatMoney(stats.fees.collected)} collected of ${formatMoney(stats.fees.obligations)}`}><span style={{ width: `${Math.min(100, Math.round((stats.fees.collected / stats.fees.obligations) * 100))}%` }} /></div>
          </> : <EmptyState title="No fee obligations" detail="Fee totals will appear here after obligations are added." />}
          <div className="fee-report-values"><div><small>Total fees</small><strong>{formatMoney(stats.fees.obligations)}</strong></div><div><small>Collected</small><strong>{formatMoney(stats.fees.collected)}</strong></div><div><small>Outstanding</small><strong>{formatMoney(stats.fees.outstanding)}</strong></div></div>
        </section>}
      </div>

      <div className="dashboard-lower">
        <section className="surface recent-surface">
          <div className="surface-heading"><div><p className="eyebrow">LATEST ACTIVITY</p><h2>{role === 'student' ? 'Your profile' : 'Recent registrations'}</h2></div>{role !== 'student' && <button className="text-button" onClick={() => onNavigate('students')}>View students <span aria-hidden="true">→</span></button>}</div>
          {stats.recentStudents.length ? <div className="recent-list">{stats.recentStudents.map((student) => <div className="recent-row" key={student.id}><div className="avatar avatar-lavender">{initials(student.name)}</div><div className="recent-person"><strong>{student.name}</strong><small>{student.studentNumber}{student.className ? ` · ${student.className}` : ''}</small></div><div className="recent-date"><Badge tone="green">Active</Badge><small>{formatDate(student.registeredAt)}</small></div></div>)}</div> : <EmptyState title="No recent registrations" detail="New student records will appear here once added." />}
        </section>
        <section className="surface shortcuts-surface">
          <div className="surface-heading"><div><p className="eyebrow">WORKSPACE</p><h2>Quick access</h2></div></div>
          <div className="shortcut-list">
            <Shortcut icon="▤" title={role === 'student' ? 'My profile' : 'Student directory'} text={role === 'student' ? 'Review your student record' : 'Search and manage student profiles'} onClick={() => onNavigate('students')} />
            {role !== 'student' && <Shortcut icon="◷" title="Take attendance" text="Record today’s class attendance" onClick={() => onNavigate('attendance')} />}
            <Shortcut icon="⌁" title="Academic records" text="Examinations and student results" onClick={() => onNavigate('academics')} />
            {(role === 'admin' || role === 'student') && <Shortcut icon="₹" title="Fee overview" text="Review obligations and payments" onClick={() => onNavigate('fees')} />}
          </div>
        </section>
      </div>
    </>}
    <p className="dashboard-date">School workspace · {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}</p>
  </div>
}

function StatCard({ label, value, caption, icon, tone }: { label: string; value: number | null; caption: string; icon: string; tone: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon icon-${tone}`}>{icon}</span></div><strong className="stat-value">{value === null ? '—' : value.toLocaleString()}</strong><small>{caption}</small></div>
}

function GradeBand({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="grade-band"><span className={`grade-dot grade-${color}`} /><span>{label}</span><strong>{value.toLocaleString()}</strong></div>
}

function Shortcut({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) {
  return <button className="shortcut-row" onClick={onClick}><span className="shortcut-icon">{icon}</span><span className="shortcut-copy"><strong>{title}</strong><small>{text}</small></span><span className="shortcut-arrow">→</span></button>
}
