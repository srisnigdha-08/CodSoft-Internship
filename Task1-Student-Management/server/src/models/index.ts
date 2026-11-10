import { model, Schema, type Types } from "mongoose";

const required = true;
const ref = (name: string) => ({ type: Schema.Types.ObjectId, ref: name, required });
const integerCents = { validator: Number.isSafeInteger, message: "{PATH} must be a whole number of cents." };

export const ROLES = ["admin", "teacher", "student"] as const;
export const PROFILE_STATUSES = ["active", "inactive"] as const;
export const ATTENDANCE_STATUSES = ["present", "absent", "late"] as const;

export type Role = (typeof ROLES)[number];
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

interface Timestamps { createdAt: Date; updatedAt: Date }

export interface UserDocument extends Timestamps {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: ProfileStatus;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required, trim: true, maxlength: 161 },
  email: { type: String, required, unique: true, lowercase: true, trim: true, maxlength: 254, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  // select:false keeps the hash out of every query that does not explicitly ask for it.
  passwordHash: { type: String, required, select: false },
  role: { type: String, required, enum: ROLES },
  status: { type: String, required, enum: PROFILE_STATUSES, default: "active" },
}, { timestamps: true, collection: "users" });

export interface TeacherDocument extends Timestamps {
  userId: Types.ObjectId;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  subject: string;
  status: ProfileStatus;
}

const teacherSchema = new Schema<TeacherDocument>({
  userId: { ...ref("User"), unique: true },
  firstName: { type: String, required, trim: true, maxlength: 80 },
  lastName: { type: String, required, trim: true, maxlength: 80 },
  employeeNumber: { type: String, required, unique: true, trim: true, maxlength: 40 },
  subject: { type: String, required, trim: true, maxlength: 120 },
  status: { type: String, required, enum: PROFILE_STATUSES, default: "active" },
}, { timestamps: true, collection: "teachers" });
teacherSchema.index({ status: 1, lastName: 1, firstName: 1 });

export interface ClassDocument extends Timestamps {
  name: string;
  section: string;
  teacherId: Types.ObjectId | null;
}

const classSchema = new Schema<ClassDocument>({
  name: { type: String, required, trim: true, maxlength: 80 },
  section: { type: String, required, trim: true, maxlength: 40, default: "A" },
  teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
}, { timestamps: true, collection: "classes" });
classSchema.index({ name: 1, section: 1 }, { unique: true });
classSchema.index({ teacherId: 1 });

export interface StudentDocument extends Timestamps {
  userId: Types.ObjectId;
  firstName: string;
  lastName: string;
  studentNumber: string;
  classId: Types.ObjectId | null;
  dateOfBirth: Date | null;
  phone: string | null;
  address: string | null;
  status: ProfileStatus;
}

const studentSchema = new Schema<StudentDocument>({
  userId: { ...ref("User"), unique: true },
  firstName: { type: String, required, trim: true, maxlength: 80 },
  lastName: { type: String, required, trim: true, maxlength: 80 },
  studentNumber: { type: String, required, unique: true, trim: true, maxlength: 40 },
  classId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
  dateOfBirth: { type: Date, default: null },
  phone: { type: String, trim: true, maxlength: 32, default: null },
  address: { type: String, trim: true, maxlength: 255, default: null },
  status: { type: String, required, enum: PROFILE_STATUSES, default: "active" },
}, { timestamps: true, collection: "students" });
studentSchema.index({ classId: 1, status: 1 });
studentSchema.index({ status: 1, createdAt: -1 });

export interface AttendanceCorrection {
  _id: Types.ObjectId;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  correctedBy: Types.ObjectId;
  correctedAt: Date;
}

export interface AttendanceDocument extends Timestamps {
  studentId: Types.ObjectId;
  classId: Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  recordedBy: Types.ObjectId;
  corrections: AttendanceCorrection[];
}

// Corrections are embedded: a status change and its audit entry are written in
// one atomic document update, and they are only ever read with their record.
const correctionSchema = new Schema<AttendanceCorrection>({
  previousStatus: { type: String, required, enum: ATTENDANCE_STATUSES },
  newStatus: { type: String, required, enum: ATTENDANCE_STATUSES },
  correctedBy: ref("User"),
  correctedAt: { type: Date, required, default: () => new Date() },
});

const attendanceSchema = new Schema<AttendanceDocument>({
  studentId: ref("Student"),
  classId: ref("Class"),
  date: { type: Date, required },
  status: { type: String, required, enum: ATTENDANCE_STATUSES },
  recordedBy: ref("User"),
  corrections: { type: [correctionSchema], default: [] },
}, { timestamps: true, collection: "attendance" });
attendanceSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ studentId: 1, date: -1 });
attendanceSchema.index({ classId: 1, date: -1 });
attendanceSchema.index({ date: -1, classId: 1 });

export interface ExamDocument extends Timestamps {
  title: string;
  classId: Types.ObjectId;
  date: Date;
  maxScore: number;
  createdBy: Types.ObjectId;
}

const examSchema = new Schema<ExamDocument>({
  title: { type: String, required, trim: true, maxlength: 120 },
  classId: ref("Class"),
  date: { type: Date, required },
  maxScore: { type: Number, required, min: 0.01, max: 99_999.99 },
  createdBy: ref("User"),
}, { timestamps: true, collection: "exams" });
examSchema.index({ title: 1, classId: 1, date: 1 }, { unique: true });
examSchema.index({ classId: 1, date: -1 });

export interface ResultDocument extends Timestamps {
  studentId: Types.ObjectId;
  examId: Types.ObjectId;
  score: number;
  recordedBy: Types.ObjectId;
}

const resultSchema = new Schema<ResultDocument>({
  studentId: ref("Student"),
  examId: ref("Exam"),
  score: { type: Number, required, min: 0 },
  recordedBy: ref("User"),
}, { timestamps: true, collection: "results" });
resultSchema.index({ studentId: 1, examId: 1 }, { unique: true });
resultSchema.index({ examId: 1 });

export interface FeeDocument extends Timestamps {
  studentId: Types.ObjectId;
  description: string;
  academicYear: string;
  amountCents: number;
  paidCents: number;
  dueDate: Date;
  createdBy: Types.ObjectId;
}

// Money is stored in integer cents so sums and balances never pick up
// binary floating-point error. The API still exchanges decimal amounts.
const feeSchema = new Schema<FeeDocument>({
  studentId: ref("Student"),
  description: { type: String, required, trim: true, maxlength: 120 },
  academicYear: { type: String, required, trim: true, maxlength: 16 },
  amountCents: { type: Number, required, min: 1, validate: integerCents },
  // Running total of this fee's payments; see routes/fees.ts for the atomic guard.
  paidCents: { type: Number, required, min: 0, default: 0, validate: integerCents },
  dueDate: { type: Date, required },
  createdBy: ref("User"),
}, { timestamps: true, collection: "fees" });
feeSchema.index({ studentId: 1, description: 1, academicYear: 1 }, { unique: true });
feeSchema.index({ dueDate: -1, _id: -1 });

export interface PaymentDocument extends Timestamps {
  feeId: Types.ObjectId;
  studentId: Types.ObjectId;
  amountCents: number;
  paidAt: Date;
  referenceCode: string;
  recordedBy: Types.ObjectId;
}

const paymentSchema = new Schema<PaymentDocument>({
  feeId: ref("Fee"),
  studentId: ref("Student"),
  amountCents: { type: Number, required, min: 1, validate: integerCents },
  paidAt: { type: Date, required, default: () => new Date() },
  referenceCode: { type: String, required, unique: true, trim: true, maxlength: 80 },
  recordedBy: ref("User"),
}, { timestamps: true, collection: "payments" });
paymentSchema.index({ feeId: 1, paidAt: -1 });
paymentSchema.index({ studentId: 1, paidAt: -1 });

export const User = model<UserDocument>("User", userSchema);
export const Teacher = model<TeacherDocument>("Teacher", teacherSchema);
export const SchoolClass = model<ClassDocument>("Class", classSchema);
export const Student = model<StudentDocument>("Student", studentSchema);
export const Attendance = model<AttendanceDocument>("Attendance", attendanceSchema);
export const Exam = model<ExamDocument>("Exam", examSchema);
export const Result = model<ResultDocument>("Result", resultSchema);
export const Fee = model<FeeDocument>("Fee", feeSchema);
export const Payment = model<PaymentDocument>("Payment", paymentSchema);

export const allModels = [User, Teacher, SchoolClass, Student, Attendance, Exam, Result, Fee, Payment] as const;
