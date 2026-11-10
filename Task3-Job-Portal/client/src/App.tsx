import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EmptyState } from './components/ui';
import { AdminApplicationsPage } from './pages/admin/AdminApplicationsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminEmployersPage } from './pages/admin/AdminEmployersPage';
import { AdminJobsPage } from './pages/admin/AdminJobsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { ApplicantDetailsPage } from './pages/employer/ApplicantDetailsPage';
import { ApplicantsPage } from './pages/employer/ApplicantsPage';
import { CompanyPage } from './pages/employer/CompanyPage';
import { EmployerDashboardPage } from './pages/employer/EmployerDashboardPage';
import { EmployerJobsPage } from './pages/employer/EmployerJobsPage';
import { JobFormPage } from './pages/employer/JobFormPage';
import { ApplicationDetailsPage } from './pages/jobseeker/ApplicationDetailsPage';
import { MyApplicationsPage } from './pages/jobseeker/MyApplicationsPage';
import { ProfilePage } from './pages/jobseeker/ProfilePage';
import { ResumePage } from './pages/jobseeker/ResumePage';
import { SeekerDashboardPage } from './pages/jobseeker/SeekerDashboardPage';
import { HomePage } from './pages/public/HomePage';
import { JobDetailsPage } from './pages/public/JobDetailsPage';
import { JobsPage } from './pages/public/JobsPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';

function NotFoundPage() {
  return (
    <main className="container">
      <EmptyState
        title="Page not found"
        message="That page does not exist or has moved."
        action={
          <Link to="/" className="btn btn-primary">
            Back to home
          </Link>
        }
      />
    </main>
  );
}

export function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/job-seeker"
          element={
            <ProtectedRoute roles={['JOB_SEEKER']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SeekerDashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="resume" element={<ResumePage />} />
          <Route path="jobs" element={<Navigate to="/jobs" replace />} />
          <Route path="applications" element={<MyApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailsPage />} />
        </Route>

        <Route
          path="/employer"
          element={
            <ProtectedRoute roles={['EMPLOYER']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EmployerDashboardPage />} />
          <Route path="company" element={<CompanyPage />} />
          <Route path="jobs" element={<EmployerJobsPage />} />
          <Route path="jobs/new" element={<JobFormPage />} />
          <Route path="jobs/:id/edit" element={<JobFormPage />} />
          <Route path="jobs/:id/applicants" element={<ApplicantsPage />} />
          <Route path="applicants/:id" element={<ApplicantDetailsPage backTo="/employer/jobs" />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="employers" element={<AdminEmployersPage />} />
          <Route path="jobs" element={<AdminJobsPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route
            path="applications/:id"
            element={<ApplicantDetailsPage backTo="/admin/applications" />}
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
