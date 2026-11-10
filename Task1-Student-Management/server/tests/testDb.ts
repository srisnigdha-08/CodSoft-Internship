import mongoose from "mongoose";
import { TEST_DATABASE } from "../src/databaseGuards.js";
import { connectDatabase, disconnectDatabase } from "../src/db.js";
import { getMongoConfig, getMongoTestConfig } from "../src/env.js";
import { allModels, Fee, SchoolClass, Student, Teacher, User } from "../src/models/index.js";

export { TEST_DATABASE };

const GUARD_COLLECTION = "integration_test_guard";
const GUARD_MARKER = "codsoft_student_management_test_suite_v1";

function guardCollection() {
  return mongoose.connection.collection<{ _id: string }>(GUARD_COLLECTION);
}

async function assertGuarded(): Promise<void> {
  if (mongoose.connection.name !== TEST_DATABASE) throw new Error("Test cleanup refused: not connected to the dedicated test database.");
  if (!(await guardCollection().findOne({ _id: GUARD_MARKER }))) throw new Error("Test cleanup refused: the test database guard marker is missing.");
}

export async function connectTestDatabase(): Promise<void> {
  const { uri, databaseName } = getMongoTestConfig();
  // Checked before connecting so even index creation can only touch the test database.
  if (databaseName !== TEST_DATABASE) throw new Error(`MONGODB_TEST_URI must name the ${TEST_DATABASE} database.`);
  if (process.env.MONGODB_URI && getMongoConfig().databaseName === TEST_DATABASE) throw new Error("MONGODB_URI must point to the application database, not the test database.");
  await connectDatabase(uri);

  if (!(await guardCollection().findOne({ _id: GUARD_MARKER }))) {
    const counts = await Promise.all(allModels.map((model) => model.collection.estimatedDocumentCount()));
    if (counts.some((count) => count > 0)) throw new Error("Test setup refused: the test database has data but no guard marker.");
    await guardCollection().insertOne({ _id: GUARD_MARKER });
  }
  await assertGuarded();
}

export async function resetTestData(): Promise<void> {
  await assertGuarded();
  await Promise.all(allModels.map((model) => model.collection.deleteMany({})));
}

export async function countTestDocuments(): Promise<number> {
  await assertGuarded();
  const counts = await Promise.all(allModels.map((model) => model.collection.countDocuments()));
  return counts.reduce((total, count) => total + count, 0);
}

export async function closeTestDatabase(): Promise<void> {
  await disconnectDatabase();
}

export type Fixtures = Awaited<ReturnType<typeof createFixtures>>;

/** Two teachers, each with a class and a student, plus one fee. IDs are returned as API-style strings. */
export async function createFixtures(passwordHash: string) {
  const account = (email: string, role: "admin" | "teacher" | "student", name: string) => User.create({ email: `${email}@integration.example.test`, passwordHash, role, name });
  const admin = await account("admin", "admin", "Test Admin");
  const teacherUserA = await account("teacher-a", "teacher", "Test Teacher A");
  const teacherUserB = await account("teacher-b", "teacher", "Test Teacher B");
  const studentUserA = await account("student-a", "student", "Test Student A");
  const studentUserB = await account("student-b", "student", "Test Student B");
  const teacherA = await Teacher.create({ userId: teacherUserA._id, firstName: "Test", lastName: "Teacher A", employeeNumber: "IT-T1", subject: "Math" });
  const teacherB = await Teacher.create({ userId: teacherUserB._id, firstName: "Test", lastName: "Teacher B", employeeNumber: "IT-T2", subject: "Science" });
  const classA = await SchoolClass.create({ name: "Integration Grade", section: "A", teacherId: teacherA._id });
  const classB = await SchoolClass.create({ name: "Integration Grade", section: "B", teacherId: teacherB._id });
  const studentA = await Student.create({ userId: studentUserA._id, firstName: "Test", lastName: "Student A", studentNumber: "IT-S1", classId: classA._id });
  const studentB = await Student.create({ userId: studentUserB._id, firstName: "Test", lastName: "Student B", studentNumber: "IT-S2", classId: classB._id });
  const feeA = await Fee.create({ studentId: studentA._id, description: "Test tuition", academicYear: "2026-27", amountCents: 100_000, dueDate: new Date("2026-12-01T00:00:00Z"), createdBy: admin._id });
  return {
    admin: String(admin._id), teacherUserA: String(teacherUserA._id), teacherA: String(teacherA._id), teacherB: String(teacherB._id),
    classA: String(classA._id), classB: String(classB._id), studentA: String(studentA._id), studentB: String(studentB._id),
    feeA: String(feeA._id), studentUserA: String(studentUserA._id),
  };
}
