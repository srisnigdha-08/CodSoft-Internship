import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { assertSeedAllowed, formatDatabaseFailure } from "./databaseGuards.js";
import { addDays, dateFromDay, today } from "./dates.js";
import { connectDatabase, disconnectDatabase } from "./db.js";
import { getMongoConfig } from "./env.js";
import { allModels, Attendance, Exam, Fee, Payment, Result, SchoolClass, Student, Teacher, User, type AttendanceStatus, type Role } from "./models/index.js";

const TARGET_STUDENTS = 150;
const TARGET_TEACHERS = 15;
const SCHOOL_DAYS = 31;
const CLASS_GROUPS = ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
const SECTIONS = ["A", "B"];
const SUBJECTS = ["Mathematics", "Science", "English"];
const EXAM_DATES = ["2026-09-15", "2026-09-17", "2026-09-19"];
const firstNames = [
  "Ari", "Mira", "Dev", "Nia", "Ishan", "Tara", "Rohan", "Leela", "Kabir", "Anaya",
  "Neil", "Sana", "Vihaan", "Ira", "Arjun", "Diya", "Kian", "Meera", "Ayaan", "Riya",
  "Rey", "Avni", "Aarav", "Myra", "Ishaan", "Kiara", "Ritvik", "Sara", "Yash", "Zoya",
];
const lastNames = [
  "Patel", "Shah", "Rao", "Kapoor", "Nair", "Mehta", "Das", "Iyer", "Khanna", "Sen",
  "Joshi", "Menon", "Bose", "Malik", "Desai", "Bhat", "Saxena", "Gill", "Sethi", "Dutta",
  "Kulkarni", "Chawla", "Roy", "Reddy", "Fernandes", "Pillai", "Arora", "Mishra", "Khan", "Ghosh",
];
const teacherNames = [
  ["Rhea", "Bennett"], ["Omar", "Foster"], ["Lina", "Park"], ["Theo", "Carter"],
  ["Amara", "Wells"], ["Noah", "Reed"], ["Elena", "Brooks"], ["Milo", "Hayes"],
  ["Nora", "Price"], ["Eli", "Rivera"], ["Ivy", "Collins"], ["Zane", "Murphy"],
  ["Maya", "Ross"], ["Leo", "Baker"],
] as const;
const teacherSubjects = ["Science", "English", "History", "Computer Science", "Mathematics"] as const;

function pad(value: number, width = 3): string {
  return String(value).padStart(width, "0");
}

function fictionalBirthDate(number: number): Date {
  const year = 2010 + (number % 4);
  const month = ((number - 2) % 12) + 1;
  const day = ((number * 7) % 27) + 1;
  return dateFromDay(`${year}-${pad(month, 2)}-${pad(day, 2)}`);
}

type BulkOperation = { updateOne: { filter: Record<string, unknown>; update: Record<string, unknown>; upsert?: boolean } };
type BulkWriter = { bulkWrite: (operations: never[], options: { ordered: boolean; timestamps: boolean }) => Promise<unknown> };

/** Insert-only upsert: an existing document is left exactly as it is. */
function insertIfMissing(filter: Record<string, unknown>, fields: Record<string, unknown>, now: Date): BulkOperation {
  return { updateOne: { filter, update: { $setOnInsert: { ...fields, createdAt: fields.createdAt ?? now, updatedAt: now } }, upsert: true } };
}

async function writeAll(model: BulkWriter, operations: BulkOperation[]): Promise<void> {
  for (let start = 0; start < operations.length; start += 1000) {
    await model.bulkWrite(operations.slice(start, start + 1000) as never[], { ordered: true, timestamps: false });
  }
}

async function ensureUsers(accounts: Array<{ email: string; role: Role; name: string; passwordHash: string }>, now: Date): Promise<Map<string, Types.ObjectId>> {
  await writeAll(User, accounts.map((account) => insertIfMissing({ email: account.email }, { ...account, status: "active" }, now)));
  const rows = await User.find({ email: { $in: accounts.map((account) => account.email) } }).select("email role").lean();
  const byEmail = new Map(rows.map((row) => [row.email, row]));
  return new Map(accounts.map((account) => {
    const user = byEmail.get(account.email);
    if (!user || user.role !== account.role) throw new Error(`The demo login ${account.email} already exists with an incompatible role.`);
    return [account.email, user._id];
  }));
}

function attendanceStatus(number: number, day: Date): AttendanceStatus {
  const dayOfYear = Math.floor((day.getTime() - Date.UTC(day.getUTCFullYear(), 0, 0)) / 86_400_000);
  const isoWeekday = day.getUTCDay() || 7;
  const roll = (number * 37 + dayOfYear * 17 + dayOfYear * dayOfYear * 3) % 100;
  const absentCutoff = 8 + ((dayOfYear * 7 + isoWeekday * 3) % 9);
  const lateCutoff = 1 + ((dayOfYear * 11 + isoWeekday) % 4);
  if (roll < absentCutoff) return "absent";
  return roll < absentCutoff + lateCutoff ? "late" : "present";
}

function recentSchoolDays(count: number): Date[] {
  const days: Date[] = [];
  for (let cursor = today(); days.length < count; cursor = addDays(cursor, -1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) days.push(cursor);
  }
  return days;
}

async function seed(): Promise<void> {
  const { uri, databaseName } = getMongoConfig();
  assertSeedAllowed(process.env.NODE_ENV, databaseName);
  await connectDatabase(uri);

  const [adminHash, teacherHash, studentHash] = await Promise.all([
    bcrypt.hash("Admin@12345", 12),
    bcrypt.hash("Teacher@12345", 12),
    bcrypt.hash("Student@12345", 12),
  ]);
  const now = new Date();

  // Teachers.
  const teacherPlans = Array.from({ length: TARGET_TEACHERS }, (_, position) => {
    const number = position + 1;
    if (number === 1) return { email: "teacher@school.local", firstName: "Avery", lastName: "Morgan", employeeNumber: "T-1001", subject: "Mathematics" };
    const index = number - 2;
    const [firstName, lastName] = teacherNames[index] ?? ["Demo", `Teacher${number}`];
    return { email: `teacher${pad(number)}@staff.example.test`, firstName, lastName, employeeNumber: `T-${pad(1000 + number)}`, subject: teacherSubjects[index % teacherSubjects.length] ?? "Mathematics" };
  });
  const adminUsers = await ensureUsers([{ email: "admin@school.local", role: "admin", name: "School Administrator", passwordHash: adminHash }], now);
  const adminId = adminUsers.get("admin@school.local");
  if (!adminId) throw new Error("The administrator account could not be resolved.");
  const teacherUsers = await ensureUsers(teacherPlans.map((plan) => ({ email: plan.email, role: "teacher", name: `${plan.firstName} ${plan.lastName}`, passwordHash: teacherHash })), now);
  await writeAll(Teacher, teacherPlans.map(({ email, ...fields }) => insertIfMissing({ userId: teacherUsers.get(email) }, { ...fields, userId: teacherUsers.get(email), status: "active" }, now)));
  const teachers = await Teacher.find({ userId: { $in: [...teacherUsers.values()] } }).select("userId employeeNumber").lean();
  const teacherByNumber = new Map(teachers.map((row) => [row.employeeNumber, row]));
  for (const plan of teacherPlans) {
    if (!teacherByNumber.has(plan.employeeNumber)) throw new Error(`A conflicting teacher profile exists for the demo login ${plan.email}; stopping.`);
  }

  // Classes.
  const classPlans = CLASS_GROUPS.flatMap((name) => SECTIONS.map((section) => ({ name, section })));
  await writeAll(SchoolClass, classPlans.map((plan, index) => {
    const teacherPlan = teacherPlans[index % teacherPlans.length];
    return insertIfMissing({ name: plan.name, section: plan.section }, { ...plan, teacherId: teacherPlan ? teacherByNumber.get(teacherPlan.employeeNumber)?._id ?? null : null }, now);
  }));
  const classRows = await SchoolClass.find({ $or: classPlans }).lean();
  const classKey = (name: string, section: string) => `${name}|${section}`;
  const classByKey = new Map(classRows.map((row) => [classKey(row.name, row.section), row]));
  const orderedClasses = classPlans.map((plan) => {
    const row = classByKey.get(classKey(plan.name, plan.section));
    if (!row) throw new Error(`Could not resolve class ${plan.name} ${plan.section}.`);
    return row;
  });
  const teacherUserOf = new Map(teachers.map((row) => [String(row._id), row.userId]));
  const recorderFor = (teacherId: Types.ObjectId | null) => (teacherId ? teacherUserOf.get(String(teacherId)) : undefined) ?? adminId;

  // Students.
  const baselineClass = classByKey.get(classKey("Grade 10", "A"));
  if (!baselineClass) throw new Error("The baseline class is missing.");
  const studentPlans = Array.from({ length: TARGET_STUDENTS }, (_, position) => {
    const number = position + 1;
    if (number === 1) {
      return { number, email: "student@school.local", firstName: "Jordan", lastName: "Lee", classId: baselineClass._id, dateOfBirth: dateFromDay("2010-04-12"), phone: "555-0102", address: null as string | null, createdAt: now };
    }
    const index = number - 2;
    return {
      number, email: `student${pad(number)}@students.example.test`, firstName: firstNames[index % firstNames.length] ?? "Demo", lastName: lastNames[index % lastNames.length] ?? "Student",
      classId: (orderedClasses[index % orderedClasses.length] ?? baselineClass)._id, dateOfBirth: fictionalBirthDate(number), phone: `555-01${pad((number - 2) % 100, 2)}`,
      address: `${number} Example Way, Demo Borough, ZZ 00000`, createdAt: addDays(now, -(number % 180)),
    };
  });
  const studentNumberOf = (number: number) => `S-2026-${pad(number)}`;
  const studentUsers = await ensureUsers(studentPlans.map((plan) => ({ email: plan.email, role: "student", name: `${plan.firstName} ${plan.lastName}`, passwordHash: studentHash })), now);
  await writeAll(Student, studentPlans.map(({ number, email, ...fields }) => insertIfMissing({ userId: studentUsers.get(email) }, { ...fields, userId: studentUsers.get(email), studentNumber: studentNumberOf(number), status: "active" }, now)));
  const studentRows = await Student.find({ userId: { $in: [...studentUsers.values()] } }).select("studentNumber classId status").lean();
  const studentByNumber = new Map(studentRows.map((row) => [row.studentNumber, row]));
  const students = studentPlans.map((plan) => {
    const row = studentByNumber.get(studentNumberOf(plan.number));
    if (!row) throw new Error(`A conflicting student profile exists for the demo login ${plan.email}; stopping.`);
    return { number: plan.number, _id: row._id, classId: row.classId, status: row.status, studentNumber: row.studentNumber };
  });
  const teacherOfClass = new Map(classRows.map((row) => [String(row._id), row.teacherId]));

  // Attendance: a student that already has a full history is left alone, so
  // running the seed on a later date does not extend the data set.
  const existingCounts = await Attendance.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { studentId: { $in: students.map((student) => student._id) } } },
    { $group: { _id: "$studentId", count: { $sum: 1 } } },
  ]);
  const countByStudent = new Map(existingCounts.map((row) => [String(row._id), row.count]));
  const schoolDays = recentSchoolDays(SCHOOL_DAYS);
  await writeAll(Attendance, students
    .filter((student) => student.status === "active" && student.classId && (countByStudent.get(String(student._id)) ?? 0) < SCHOOL_DAYS)
    .flatMap((student) => schoolDays.map((date) => insertIfMissing(
      { studentId: student._id, classId: student.classId, date },
      { studentId: student._id, classId: student.classId, date, status: attendanceStatus(student.number, date), recordedBy: recorderFor(teacherOfClass.get(String(student.classId)) ?? null), corrections: [] },
      now,
    ))));

  // Examinations and results: reuse any existing exam with the same title and class.
  const titleOf = (subject: string) => `Term 1 ${subject}`;
  const existingExams = await Exam.find({ classId: { $in: orderedClasses.map((row) => row._id) }, title: { $in: SUBJECTS.map(titleOf) } }).sort({ date: 1 }).lean();
  const examKey = (classId: Types.ObjectId, title: string) => `${String(classId)}|${title}`;
  const examByKey = new Map<string, Types.ObjectId>();
  for (const exam of existingExams) if (!examByKey.has(examKey(exam.classId, exam.title))) examByKey.set(examKey(exam.classId, exam.title), exam._id);

  const resultOperations: BulkOperation[] = [];
  for (const classRecord of orderedClasses) {
    for (const [subjectIndex, subject] of SUBJECTS.entries()) {
      const title = titleOf(subject);
      let examId = examByKey.get(examKey(classRecord._id, title));
      if (!examId) {
        const created = await Exam.create({ title, classId: classRecord._id, date: dateFromDay(EXAM_DATES[subjectIndex] ?? "2026-09-15"), maxScore: 100, createdBy: recorderFor(classRecord.teacherId) });
        examId = created._id;
      }
      for (const student of students) {
        if (student.status !== "active" || !student.classId?.equals(classRecord._id)) continue;
        resultOperations.push(insertIfMissing(
          { studentId: student._id, examId },
          { studentId: student._id, examId, score: 50 + ((student.number * 17 + subjectIndex * 11) % 46), recordedBy: recorderFor(classRecord.teacherId) },
          now,
        ));
      }
    }
  }
  await writeAll(Result, resultOperations);

  // Fees: one annual tuition per student with deterministic pending, partial,
  // and paid states, plus the original baseline term fee and its payment.
  const YEAR = "2026-27";
  const tuitionAmountCents = (index: number) => (72_000 + (index % 5) * 6_000) * 100;
  const baseline = students[0];
  if (!baseline) throw new Error("The baseline student is missing.");
  await writeAll(Fee, [
    ...students.map((student, index) => insertIfMissing(
      { studentId: student._id, description: "Annual tuition", academicYear: YEAR },
      { studentId: student._id, description: "Annual tuition", academicYear: YEAR, amountCents: tuitionAmountCents(index), paidCents: 0, dueDate: dateFromDay("2027-03-31"), createdBy: adminId },
      now,
    )),
    insertIfMissing(
      { studentId: baseline._id, description: "Term 1 tuition", academicYear: YEAR },
      { studentId: baseline._id, description: "Term 1 tuition", academicYear: YEAR, amountCents: 4_500_000, paidCents: 0, dueDate: dateFromDay("2026-11-14"), createdBy: adminId },
      now,
    ),
  ]);
  const fees = await Fee.find({ studentId: { $in: students.map((student) => student._id) }, academicYear: YEAR, description: { $in: ["Annual tuition", "Term 1 tuition"] } }).lean();
  const feeKey = (studentId: Types.ObjectId, description: string) => `${String(studentId)}|${description}`;
  const feeByKey = new Map(fees.map((fee) => [feeKey(fee.studentId, fee.description), fee]));

  const paymentOperations = students.flatMap((student, index) => {
    const state = index % 3;
    const fee = feeByKey.get(feeKey(student._id, "Annual tuition"));
    if (state === 0 || !fee) return [];
    const amountCents = state === 1 ? Math.round(fee.amountCents * 0.4) : fee.amountCents;
    const referenceCode = `DEMO-ANNUAL-${student.studentNumber}`;
    return [insertIfMissing(
      { referenceCode },
      { feeId: fee._id, studentId: student._id, amountCents, referenceCode, paidAt: new Date(Date.UTC(2026, 8, 20 + (index % 20), 12)), recordedBy: adminId },
      now,
    )];
  });
  const baselineFee = feeByKey.get(feeKey(baseline._id, "Term 1 tuition"));
  if (baselineFee) {
    paymentOperations.push(insertIfMissing(
      { referenceCode: "DEMO-FEE-2026-27" },
      { feeId: baselineFee._id, studentId: baseline._id, amountCents: 1_500_000, referenceCode: "DEMO-FEE-2026-27", paidAt: new Date("2026-10-15T16:34:32.000Z"), recordedBy: adminId },
      now,
    ));
  }
  await writeAll(Payment, paymentOperations);

  // Derive each seeded fee's running total from its payments, which keeps the
  // ledger correct whichever of the writes above were skipped on a repeat run.
  const seededFeeIds = fees.map((fee) => fee._id);
  const paidTotals = await Payment.aggregate<{ _id: Types.ObjectId; paid: number }>([
    { $match: { feeId: { $in: seededFeeIds } } },
    { $group: { _id: "$feeId", paid: { $sum: "$amountCents" } } },
  ]);
  const paidByFee = new Map(paidTotals.map((row) => [String(row._id), row.paid]));
  const stale = fees.filter((fee) => fee.paidCents !== (paidByFee.get(String(fee._id)) ?? 0));
  if (stale.length) {
    await writeAll(Fee, stale.map((fee) => ({ updateOne: { filter: { _id: fee._id }, update: { $set: { paidCents: paidByFee.get(String(fee._id)) ?? 0 } } } })));
  }

  const totals = Object.fromEntries(await Promise.all(allModels.map(async (model) => [model.collection.name, await model.collection.countDocuments()] as const)));
  console.log("Fictional local demo data is ready. Existing account passwords and profiles were not overwritten.");
  console.log("Database totals:", JSON.stringify(totals));
  console.log("New demo teacher and student accounts use their role demo password shown in the README.");
}

seed()
  .catch((error: unknown) => {
    console.error(formatDatabaseFailure(error, "Database seeding"));
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
