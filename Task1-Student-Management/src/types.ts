export type Role = 'admin' | 'teacher' | 'student'
export type Section = 'dashboard' | 'students' | 'teachers' | 'classes' | 'attendance' | 'academics' | 'fees'

export interface User {
  id: number
  email: string
  role: Role
  studentId?: number
  teacherId?: number
}

export interface Student {
  id: number
  email: string
  firstName: string
  lastName: string
  studentNumber: string
  classId: number | null
  className: string | null
  section: string | null
  dateOfBirth: string | null
  phone: string | null
  address: string | null
  status: 'active' | 'inactive'
  createdAt: string
}

export interface Teacher {
  id: number
  email: string
  firstName: string
  lastName: string
  employeeNumber: string
  subject: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface SchoolClass {
  id: number
  name: string
  section: string
  teacherId: number | null
  teacherName: string | null
  studentCount: number
}

export interface AttendanceRecord {
  id: number
  studentId: number
  studentName: string
  studentNumber: string
  classId: number
  className: string
  section: string
  date: string
  status: 'present' | 'absent' | 'late'
}

export interface AttendanceCorrection {
  id: number
  attendanceId: number
  previousStatus: AttendanceRecord['status']
  newStatus: AttendanceRecord['status']
  correctedBy: number
  correctedAt: string
}

export interface Examination {
  id: number
  title: string
  classId: number
  className: string
  section: string
  date: string
  maxScore: number
}

export interface AcademicResult {
  id: number
  studentId: number
  studentName: string
  studentNumber: string
  examinationId: number
  examination: string
  className: string
  date: string
  score: number
  maxScore: number
}

export interface FeeRecord {
  id: number
  studentId: number
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
  recentStudents: Array<{ id: number; name: string; studentNumber: string; className: string | null; registeredAt: string }>
  attendanceTrend: Array<{ date: string; present: number; absent: number; late: number; total: number; percentage: number }>
  academics: { resultCount: number; averagePercentage: number; gradeBands: { strong: number; steady: number; support: number } }
  fees: { obligations: number; collected: number; outstanding: number } | null
}
