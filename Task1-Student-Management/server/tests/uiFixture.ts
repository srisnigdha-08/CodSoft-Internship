// Optional browser smoke-test fixture for the dedicated test database:
//   npx tsx tests/uiFixture.ts setup|cleanup
import bcrypt from "bcryptjs";
import { Exam, Fee, Payment, Result, SchoolClass, Student, Teacher, User } from "../src/models/index.js";
import { closeTestDatabase, connectTestDatabase, countTestDocuments, resetTestData, TEST_DATABASE } from "./testDb.js";

const mode = process.argv[2];
if (mode !== "setup" && mode !== "cleanup") {
  throw new Error("Use: npx tsx tests/uiFixture.ts setup|cleanup");
}

async function createBrowserFixtures(): Promise<void> {
  const passwordHash = await bcrypt.hash("UiIntegration@12345", 4);
  const account = (prefix: string, role: "admin" | "teacher" | "student", name: string) => User.create({ email: `${prefix}@integration.example.test`, passwordHash, role, name });
  const admin = await account("admin-ui", "admin", "UI Admin");

  async function classGroup(label: "" | "-other", section: string, teacherFirst: string, employeeNumber: string, subject: string, studentFirst: string, studentNumber: string) {
    const teacherUser = await account(`teacher${label}-ui`, "teacher", `${teacherFirst} Teacher`);
    const teacher = await Teacher.create({ userId: teacherUser._id, firstName: teacherFirst, lastName: "Teacher", employeeNumber, subject });
    const schoolClass = await SchoolClass.create({ name: "UI Test Grade", section, teacherId: teacher._id });
    const studentUser = await account(`student${label}-ui`, "student", `${studentFirst} Learner`);
    const student = await Student.create({ userId: studentUser._id, firstName: studentFirst, lastName: "Learner", studentNumber, classId: schoolClass._id });
    return { teacherUser, schoolClass, student };
  }

  const own = await classGroup("", "A", "Test", "UI-T1", "Mathematics", "Test", "UI-S1");
  const other = await classGroup("-other", "B", "Other", "UI-T2", "Science", "Other", "UI-S2");
  const date = new Date("2026-10-15T00:00:00Z");
  const dueDate = new Date("2026-11-30T00:00:00Z");
  const exam = await Exam.create({ title: "UI Mathematics", classId: own.schoolClass._id, date, maxScore: 100, createdBy: own.teacherUser._id });
  await Result.create({ studentId: own.student._id, examId: exam._id, score: 84, recordedBy: own.teacherUser._id });
  const otherExam = await Exam.create({ title: "UI Science", classId: other.schoolClass._id, date, maxScore: 100, createdBy: other.teacherUser._id });
  await Result.create({ studentId: other.student._id, examId: otherExam._id, score: 77, recordedBy: other.teacherUser._id });
  const fee = await Fee.create({ studentId: own.student._id, description: "UI tuition", academicYear: "2026-27", amountCents: 100_000, paidCents: 40_000, dueDate, createdBy: admin._id });
  await Payment.create({ feeId: fee._id, studentId: own.student._id, amountCents: 40_000, referenceCode: "UI-SEED-PAY", recordedBy: admin._id });
  await Fee.create({ studentId: other.student._id, description: "UI tuition", academicYear: "2026-27", amountCents: 80_000, dueDate, createdBy: admin._id });
}

await connectTestDatabase();
try {
  await resetTestData();
  if (mode === "setup") {
    await createBrowserFixtures();
    console.log(`Temporary browser fixtures created in ${TEST_DATABASE}.`);
  } else {
    if ((await countTestDocuments()) !== 0) throw new Error("Browser fixture cleanup did not leave the test database empty.");
    console.log(`Temporary browser fixtures removed from ${TEST_DATABASE}; document count: 0.`);
  }
} finally {
  await closeTestDatabase();
}
