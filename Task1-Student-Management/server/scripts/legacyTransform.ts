// Pure conversion from exported PostgreSQL rows to MongoDB documents.
import { createHash } from "node:crypto";
import { Types } from "mongoose";

export const LEGACY_TABLES = ["users", "teachers", "classes", "students", "attendance", "attendance_corrections", "examinations", "academic_results", "fee_records", "fee_payments"] as const;
export type LegacyTable = (typeof LEGACY_TABLES)[number];
export type LegacyRow = Record<string, unknown>;
export type LegacyData = Record<LegacyTable, LegacyRow[]>;

/** The same legacy row always maps to the same ObjectId, so a rerun cannot create duplicates. */
export function legacyObjectId(table: LegacyTable, id: unknown): Types.ObjectId {
  return new Types.ObjectId(createHash("sha256").update(`${table}:${String(id)}`).digest("hex").slice(0, 24));
}

function moneyToCents(value: unknown): number {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("A legacy amount could not be converted to whole cents.");
  return cents;
}

const optionalRef = (table: LegacyTable, id: unknown) => (id === null || id === undefined ? null : legacyObjectId(table, id));
const day = (value: unknown) => new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
const timestamps = (row: LegacyRow, field = "created_at") => ({ createdAt: new Date(String(row[field])), updatedAt: new Date(String(row[field])) });
const fullName = (row: LegacyRow) => `${String(row.first_name)} ${String(row.last_name)}`;

export function transformLegacyData(data: LegacyData) {
  const profileByUser = new Map([...data.students, ...data.teachers].map((row) => [String(row.user_id), row]));

  const users = data.users.map((row) => {
    const profile = profileByUser.get(String(row.id));
    return {
      _id: legacyObjectId("users", row.id), name: profile ? fullName(profile) : "School Administrator", email: String(row.email).toLowerCase(),
      passwordHash: row.password_hash, role: row.role, status: profile ? profile.status : "active", ...timestamps(row),
    };
  });

  const teachers = data.teachers.map((row) => ({
    _id: legacyObjectId("teachers", row.id), userId: legacyObjectId("users", row.user_id), firstName: row.first_name, lastName: row.last_name,
    employeeNumber: row.employee_number, subject: row.subject, status: row.status, ...timestamps(row),
  }));

  const classes = data.classes.map((row) => ({
    _id: legacyObjectId("classes", row.id), name: row.name, section: row.section, teacherId: optionalRef("teachers", row.teacher_id), ...timestamps(row),
  }));

  const students = data.students.map((row) => ({
    _id: legacyObjectId("students", row.id), userId: legacyObjectId("users", row.user_id), firstName: row.first_name, lastName: row.last_name,
    studentNumber: row.student_number, classId: optionalRef("classes", row.class_id), dateOfBirth: row.date_of_birth ? day(row.date_of_birth) : null,
    phone: row.phone ?? null, address: row.address ?? null, status: row.status, ...timestamps(row),
  }));

  // Relational correction rows become an embedded audit array on their attendance record.
  const correctionsByRecord = new Map<string, LegacyRow[]>();
  for (const row of data.attendance_corrections) {
    const key = String(row.attendance_id);
    correctionsByRecord.set(key, [...(correctionsByRecord.get(key) ?? []), row]);
  }
  const attendance = data.attendance.map((row) => ({
    _id: legacyObjectId("attendance", row.id), studentId: legacyObjectId("students", row.student_id), classId: legacyObjectId("classes", row.class_id),
    date: day(row.attendance_date), status: row.status, recordedBy: legacyObjectId("users", row.recorded_by),
    corrections: (correctionsByRecord.get(String(row.id)) ?? []).map((item) => ({
      _id: legacyObjectId("attendance_corrections", item.id), previousStatus: item.previous_status, newStatus: item.new_status,
      correctedBy: legacyObjectId("users", item.corrected_by), correctedAt: new Date(String(item.corrected_at)),
    })),
    ...timestamps(row),
  }));

  const exams = data.examinations.map((row) => ({
    _id: legacyObjectId("examinations", row.id), title: row.title, classId: legacyObjectId("classes", row.class_id), date: day(row.exam_date),
    maxScore: Number(row.max_score), createdBy: legacyObjectId("users", row.created_by), ...timestamps(row),
  }));

  const results = data.academic_results.map((row) => ({
    _id: legacyObjectId("academic_results", row.id), studentId: legacyObjectId("students", row.student_id), examId: legacyObjectId("examinations", row.examination_id),
    score: Number(row.score), recordedBy: legacyObjectId("users", row.recorded_by), ...timestamps(row),
  }));

  const paidByFee = new Map<string, number>();
  const studentOfFee = new Map(data.fee_records.map((row) => [String(row.id), row.student_id]));
  for (const row of data.fee_payments) {
    const key = String(row.fee_record_id);
    paidByFee.set(key, (paidByFee.get(key) ?? 0) + moneyToCents(row.amount));
  }
  const fees = data.fee_records.map((row) => ({
    _id: legacyObjectId("fee_records", row.id), studentId: legacyObjectId("students", row.student_id), description: row.description, academicYear: row.academic_year,
    amountCents: moneyToCents(row.amount), paidCents: paidByFee.get(String(row.id)) ?? 0, dueDate: day(row.due_date), createdBy: legacyObjectId("users", row.created_by), ...timestamps(row),
  }));

  const payments = data.fee_payments.map((row) => ({
    _id: legacyObjectId("fee_payments", row.id), feeId: legacyObjectId("fee_records", row.fee_record_id), studentId: legacyObjectId("students", studentOfFee.get(String(row.fee_record_id))),
    amountCents: moneyToCents(row.amount), paidAt: new Date(String(row.paid_at)), referenceCode: row.reference_code, recordedBy: legacyObjectId("users", row.recorded_by), ...timestamps(row, "paid_at"),
  }));

  return { users, teachers, classes, students, attendance, exams, results, fees, payments };
}
