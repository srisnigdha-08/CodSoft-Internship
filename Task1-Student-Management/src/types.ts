export type Role = 'admin' | 'teacher' | 'student'
export type Section = 'dashboard' | 'students' | 'teachers' | 'classes' | 'attendance' | 'academics' | 'fees'

export interface User {
  id: string
  email: string
  role: Role
  studentId?: string
  teacherId?: string
}

export interface Student {
  id: string
  email: string
  firstName: string
  lastName: string
  studentNumber: string
  classId: string | null
  className: string | null
  section: string | null
  dateOfBirth: string | null
  phone: string | null
  address: string | null
  status: 'active' | 'inactive'
  createdAt: string
}

export interface Teacher {
  id: string
  email: string
  firstName: string
  lastName: string
  employeeNumber: string
  subject: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface SchoolClass {
  id: string
  name: string
  section: string
  teacherId: string | null
  teacherName: string | null
  studentCount: number
}

export interface AttendanceRecord {
  id: string
  studentId: string
  studentName: string
  studentNumber: string
  classId: string
  className: string
  section: string
  date: string
  status: 'present' | 'absent' | 'late'
}

export interface AttendanceCorrection {
  id: string
  attendanceId: string
  previousStatus: AttendanceRecord['status']
  newStatus: AttendanceRecord['status']
  correctedBy: string
  correctedAt: string
}

export interface Examination {
  id: string
  title: string
  classId: string
  className: string
  section: string
  date: string
  maxScore: number
}

export interface AcademicResult {
  id: string
  studentId: string
  studentName: string
  studentNumber: string
  examinationId: string
  examination: string
  className: string
  date: string
  score: number
  maxScore: number
}

export interface FeeRecord {
  id: string
  studentId: string
  studentName: string
  studentNumber: string
  description: string
  academicYear: string
  amount: number
  dueDate: string
  amountPaid: number
  balance: number
  status: 'pending' | 'partially paid' | 'paid'
}

export interface DashboardStats {
  summary: {
    totalStudents: number | null
    totalTeachers: number | null
    attendance: { present: number; absent: number; late: number; total: number; percentage: number }
  }
  recentStudents: Array<{ id: string; name: string; studentNumber: string; className: string | null; registeredAt: string }>
  attendanceTrend: Array<{ date: string; present: number; absent: number; late: number; total: number; percentage: number }>
  academics: { resultCount: number; averagePercentage: number; gradeBands: { strong: number; steady: number; support: number } }
  fees: { obligations: number; collected: number; outstanding: number } | null
}
