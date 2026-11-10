import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { assertDedicatedDatabase, assertSeedAllowed, formatDatabaseFailure } from "../src/databaseGuards.js";
import { connectDatabase, disconnectDatabase } from "../src/db.js";
import { databaseNameFromUri, getMongoTestConfig } from "../src/env.js";
import { allModels, Attendance, Exam, Fee, Payment, Result, SchoolClass, Student, Teacher, User } from "../src/models/index.js";
import { legacyObjectId, transformLegacyData, type LegacyData } from "../scripts/legacyTransform.js";
import { closeTestDatabase, connectTestDatabase, countTestDocuments, createFixtures, resetTestData, TEST_DATABASE, type Fixtures } from "./testDb.js";

const password = "Integration@12345";
const missingId = "0123456789abcdef01234567";
let passwordHash: string;
let ids: Fixtures;
const app = createApp({ jwtSecret: "isolated-integration-suite-secret-32-characters", frontendOrigin: "http://localhost:5173", secureCookie: false });

beforeAll(async () => {
  await connectTestDatabase();
  passwordHash = await bcrypt.hash(password, 4);
});
beforeEach(async () => {
  await resetTestData();
  ids = await createFixtures(passwordHash);
});
afterEach(async () => { await resetTestData(); });
afterAll(async () => {
  try { expect(await countTestDocuments()).toBe(0); } finally { await closeTestDatabase(); }
});

async function login(role: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ email: `${role}@integration.example.test`, password });
  expect(response.status).toBe(200);
  return String(response.headers["set-cookie"]?.[0] ?? "").split(";")[0] ?? "";
}

describe("database connection", () => {
  it("runs only against the dedicated test database", () => {
    expect(mongoose.connection.name).toBe(TEST_DATABASE);
  });

  it("reports 503 when MongoDB is disconnected and recovers on reconnect", async () => {
    await disconnectDatabase();
    try {
      const response = await request(app).get("/api/health");
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("DATABASE_UNAVAILABLE");
      expect(JSON.stringify(response.body)).not.toContain("mongodb://");
    } finally {
      await connectDatabase(getMongoTestConfig().uri);
    }
    expect((await request(app).get("/api/health")).status).toBe(200);
  });

  it("requires a named database in the connection string", () => {
    expect(databaseNameFromUri("mongodb://localhost:27017/codsoft_student_management", "X")).toBe("codsoft_student_management");
    expect(databaseNameFromUri("mongodb://u:p@h:1/name?authSource=admin", "X")).toBe("name");
    expect(() => databaseNameFromUri("mongodb://localhost:27017", "MONGODB_URI")).toThrow(/MONGODB_URI must be/);
    expect(() => databaseNameFromUri("postgres://localhost/x", "MONGODB_URI")).toThrow(/MONGODB_URI must be/);
  });

  it("blocks the seed in production and against other projects' databases", () => {
    expect(() => assertSeedAllowed("production", "codsoft_student_management")).toThrow(/disabled/);
    expect(() => assertSeedAllowed("development", "sentinel-db")).toThrow(/refused/);
    expect(() => assertSeedAllowed("development", "codsoft_student_management_other")).not.toThrow();
    expect(() => assertDedicatedDatabase("codsoft_student_managementX", "Migration")).toThrow(/refused/);
  });

  it("never prints a connection string in a diagnostic", () => {
    const diagnostic = formatDatabaseFailure({ name: "Error", message: "bad mongodb://user:secret@host/db password=hunter2" }, "Seeding");
    expect(diagnostic).toContain("[connection string redacted]");
    expect(diagnostic).not.toContain("secret");
    expect(diagnostic).not.toContain("hunter2");
    const unreachable = formatDatabaseFailure({ name: "MongooseServerSelectionError", message: "connect ECONNREFUSED 127.0.0.1:27017" }, "API startup");
    expect(unreachable).toContain("could not be reached");
    expect(unreachable).not.toContain("127.0.0.1");
  });
});

describe("indexes", () => {
  const indexKeys = async (model: (typeof allModels)[number]) => (await model.collection.indexes()).map((index) => ({ key: JSON.stringify(index.key), unique: index.unique === true }));

  it.each([
    [User, '{"email":1}', true],
    [Student, '{"studentNumber":1}', true],
    [Student, '{"userId":1}', true],
    [Student, '{"classId":1,"status":1}', false],
    [Teacher, '{"employeeNumber":1}', true],
    [Teacher, '{"userId":1}', true],
    [SchoolClass, '{"name":1,"section":1}', true],
    [Attendance, '{"studentId":1,"classId":1,"date":1}', true],
    [Attendance, '{"studentId":1,"date":-1}', false],
    [Attendance, '{"classId":1,"date":-1}', false],
    [Exam, '{"title":1,"classId":1,"date":1}', true],
    [Result, '{"studentId":1,"examId":1}', true],
    [Result, '{"examId":1}', false],
    [Fee, '{"studentId":1,"description":1,"academicYear":1}', true],
    [Payment, '{"referenceCode":1}', true],
    [Payment, '{"studentId":1,"paidAt":-1}', false],
    [Payment, '{"feeId":1,"paidAt":-1}', false],
  ] as const)("%s has index %s", async (model, key, unique) => {
    expect(await indexKeys(model)).toContainEqual({ key, unique });
  });
});

describe("ObjectId references and documents", () => {
  it("returns 24-character hex IDs and stores real ObjectId references", async () => {
    const cookie = await login("admin");
    const response = await request(app).get(`/api/students/${ids.studentA}`).set("Cookie", cookie);
    expect(response.body.data.id).toMatch(/^[0-9a-f]{24}$/);
    expect(response.body.data.classId).toMatch(/^[0-9a-f]{24}$/);
    const stored = await Student.findById(ids.studentA).lean();
    expect(stored?.classId).toBeInstanceOf(Types.ObjectId);
    expect(stored?.userId).toBeInstanceOf(Types.ObjectId);
  });

  it("resolves references with populate", async () => {
    const student = await Student.findById(ids.studentA).populate<{ userId: { email: string } }>("userId", "email").lean();
    expect(student?.userId.email).toBe("student-a@integration.example.test");
  });

  it("keeps password hashes out of default queries and API responses", async () => {
    const user = await User.findOne({ email: "admin@integration.example.test" }).lean();
    expect(user).not.toHaveProperty("passwordHash");
    const withHash = await User.findOne({ email: "admin@integration.example.test" }).select("+passwordHash").lean();
    expect(withHash?.passwordHash).toMatch(/^\$2[aby]\$/);
    const cookie = await login("admin");
    for (const path of ["/api/students", "/api/teachers", "/api/auth/me", `/api/students/${ids.studentA}`]) {
      const body = JSON.stringify((await request(app).get(path).set("Cookie", cookie)).body);
      expect(body).not.toContain(withHash?.passwordHash);
      expect(body).not.toContain("passwordHash");
    }
  });

  it("stores calendar days as UTC midnight so dates cannot shift", async () => {
    const cookie = await login("admin");
    const created = await request(app).post("/api/attendance").set("Cookie", cookie).send({ studentId: ids.studentA, classId: ids.classA, date: "2026-03-01", status: "present" });
    expect(created.body.data.date).toBe("2026-03-01");
    expect((await Attendance.findById(created.body.data.id).lean())?.date.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("unique indexes", () => {
  it("rejects a duplicate email even when written directly", async () => {
    await expect(User.create({ email: "ADMIN@integration.example.test", passwordHash, role: "admin", name: "Copy" })).rejects.toMatchObject({ code: 11000 });
  });

  it("rejects duplicate business keys at the database level", async () => {
    await expect(SchoolClass.create({ name: "Integration Grade", section: "A" })).rejects.toMatchObject({ code: 11000 });
    await expect(Student.create({ userId: ids.admin, firstName: "A", lastName: "B", studentNumber: "IT-S1" })).rejects.toMatchObject({ code: 11000 });
    await expect(Student.create({ userId: ids.studentUserA, firstName: "A", lastName: "B", studentNumber: "IT-S9" })).rejects.toMatchObject({ code: 11000 });
    await expect(Fee.create({ studentId: ids.studentA, description: "Test tuition", academicYear: "2026-27", amountCents: 1, dueDate: new Date(), createdBy: ids.admin })).rejects.toMatchObject({ code: 11000 });
    const exam = await Exam.create({ title: "Unique", classId: ids.classA, date: new Date("2026-01-01T00:00:00Z"), maxScore: 10, createdBy: ids.admin });
    await Result.create({ studentId: ids.studentA, examId: exam._id, score: 1, recordedBy: ids.admin });
    await expect(Result.create({ studentId: ids.studentA, examId: exam._id, score: 2, recordedBy: ids.admin })).rejects.toMatchObject({ code: 11000 });
  });

  it("prevents duplicate attendance under concurrent requests", async () => {
    const cookie = await login("admin");
    const body = { studentId: ids.studentA, classId: ids.classA, date: "2026-02-02", status: "present" };
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).post("/api/attendance").set("Cookie", cookie).send(body)));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await Attendance.countDocuments({ studentId: ids.studentA })).toBe(1);
  });
});

describe("fee and payment validation", () => {
  it("rejects negative, zero, non-numeric, and sub-cent payments", async () => {
    const cookie = await login("admin");
    for (const amount of [-5, 0, "10", true, 1.234, null]) {
      expect((await request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", cookie).send({ amount })).status).toBe(400);
    }
    expect((await Fee.findById(ids.feeA).lean())?.paidCents).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it("rejects a payment for an invalid or missing fee record", async () => {
    const cookie = await login("admin");
    expect((await request(app).post("/api/fees/not-an-id/payments").set("Cookie", cookie).send({ amount: 1 })).status).toBe(400);
    expect((await request(app).post(`/api/fees/${missingId}/payments`).set("Cookie", cookie).send({ amount: 1 })).status).toBe(404);
  });

  it("rejects a fee for a student that does not exist", async () => {
    const response = await request(app).post("/api/fees").set("Cookie", await login("admin")).send({ studentId: missingId, description: "X", academicYear: "2026-27", amount: 1, dueDate: "2026-12-01" });
    expect(response.status).toBe(400);
  });

  it("serializes concurrent payments so the fee cannot be overpaid", async () => {
    const cookie = await login("admin");
    const responses = await Promise.all(["A", "B", "C"].map((suffix) => request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", cookie).send({ amount: 700, referenceCode: `IT-CONCURRENT-${suffix}` })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400, 400]);
    const ledger = await request(app).get("/api/fees").set("Cookie", cookie);
    expect(ledger.body.data[0]).toMatchObject({ amountPaid: 700, balance: 300, status: "partially paid" });
    expect(await Payment.countDocuments()).toBe(1);
  });

  it("gives back the reserved amount when a payment reference is a duplicate", async () => {
    const cookie = await login("admin");
    await request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", cookie).send({ amount: 100, referenceCode: "IT-DUP" });
    const duplicate = await request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", cookie).send({ amount: 50, referenceCode: "IT-DUP" });
    expect(duplicate.status).toBe(409);
    expect((await Fee.findById(ids.feeA).lean())?.paidCents).toBe(10_000);
  });

  it("keeps decimal money exact through integer cents", async () => {
    const cookie = await login("admin");
    const fee = await request(app).post("/api/fees").set("Cookie", cookie).send({ studentId: ids.studentA, description: "Decimal", academicYear: "2026-27", amount: 0.3, dueDate: "2026-12-01" });
    await request(app).post(`/api/fees/${fee.body.data.id}/payments`).set("Cookie", cookie).send({ amount: 0.1 });
    await request(app).post(`/api/fees/${fee.body.data.id}/payments`).set("Cookie", cookie).send({ amount: 0.2 });
    const ledger = await request(app).get("/api/fees").set("Cookie", cookie);
    expect(ledger.body.data.find((row: { id: string }) => row.id === fee.body.data.id)).toMatchObject({ amount: 0.3, amountPaid: 0.3, balance: 0, status: "paid" });
  });

  it("rejects fractional and negative cents in the schema", async () => {
    const base = { studentId: ids.studentA, description: "D", academicYear: "Y", dueDate: new Date(), createdBy: ids.admin };
    await expect(new Fee({ ...base, amountCents: 1.5 }).validate()).rejects.toThrow();
    await expect(new Fee({ ...base, amountCents: -1 }).validate()).rejects.toThrow();
    await expect(new Fee({ ...base, amountCents: 100 }).validate()).resolves.toBeUndefined();
  });
});

describe("attendance correction atomicity", () => {
  it("lets only one of two concurrent corrections win and keeps one audit entry", async () => {
    const created = await Attendance.create({ studentId: ids.studentA, classId: ids.classA, date: new Date("2026-02-03T00:00:00Z"), status: "present", recordedBy: ids.admin });
    const cookie = await login("admin");
    const responses = await Promise.all(["late", "absent"].map((status) => request(app).put(`/api/attendance/${String(created._id)}`).set("Cookie", cookie).send({ status })));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses[0]).toBe(200);
    const stored = await Attendance.findById(created._id).lean();
    // A correction can only apply on top of the status it read, so the audit chain stays unbroken.
    expect(stored?.corrections.at(-1)?.newStatus).toBe(stored?.status);
    expect(stored?.corrections[0]?.previousStatus).toBe("present");
    expect(stored?.corrections).toHaveLength(statuses.filter((status) => status === 200).length);
  });
});

describe("query safety", () => {
  it("rejects objects in places that expect scalar values", async () => {
    const injected = await request(app).post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    expect(injected.status).toBe(400);
    const cookie = await login("admin");
    expect((await request(app).post("/api/attendance").set("Cookie", cookie).send({ studentId: { $ne: null }, classId: ids.classA, date: "2026-01-01", status: "present" })).status).toBe(400);
    expect((await request(app).post("/api/fees").set("Cookie", cookie).send({ studentId: { $ne: null }, description: "X", academicYear: "Y", amount: 1, dueDate: "2026-01-01" })).status).toBe(400);
  });

  it("treats search text as literal characters, not a pattern", async () => {
    const cookie = await login("admin");
    expect((await request(app).get(`/api/students?search=${encodeURIComponent(".*")}`).set("Cookie", cookie)).body.meta.total).toBe(0);
    expect((await request(app).get(`/api/students?search=${encodeURIComponent("(")}`).set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).get(`/api/teachers?search=${encodeURIComponent("[")}`).set("Cookie", cookie)).status).toBe(200);
  });
});

describe("legacy PostgreSQL transformation", () => {
  const stamp = "2026-10-01T00:00:00+05:30";
  const legacy: LegacyData = {
    users: [{ id: 1, email: "A@x.test", password_hash: "$2a$hash", role: "admin", created_at: stamp }, { id: 2, email: "t@x.test", password_hash: "h", role: "teacher", created_at: stamp }, { id: 3, email: "s@x.test", password_hash: "h", role: "student", created_at: stamp }],
    teachers: [{ id: 1, user_id: 2, first_name: "T", last_name: "One", employee_number: "T1", subject: "M", status: "active", created_at: stamp }],
    classes: [{ id: 1, name: "G", section: "A", teacher_id: 1, created_at: stamp }],
    students: [{ id: 1, user_id: 3, first_name: "S", last_name: "One", student_number: "S1", class_id: 1, date_of_birth: "2010-04-12", phone: null, address: null, status: "inactive", created_at: stamp }],
    attendance: [{ id: 7, student_id: 1, class_id: 1, attendance_date: "2026-09-16", status: "late", recorded_by: 2, created_at: stamp }],
    attendance_corrections: [{ id: 1, attendance_id: 7, previous_status: "present", new_status: "late", corrected_by: 1, corrected_at: stamp }],
    examinations: [{ id: 1, title: "E", class_id: 1, exam_date: "2026-09-15", max_score: 100.5, created_by: 2, created_at: stamp }],
    academic_results: [{ id: 1, student_id: 1, examination_id: 1, score: 88.25, recorded_by: 2, created_at: stamp }],
    fee_records: [{ id: 1, student_id: 1, description: "D", academic_year: "2026-27", amount: 45000.1, due_date: "2026-11-14", created_by: 1, created_at: stamp }],
    fee_payments: [{ id: 1, fee_record_id: 1, amount: 15000.05, paid_at: stamp, reference_code: "R1", recorded_by: 1 }, { id: 2, fee_record_id: 1, amount: 0.05, paid_at: stamp, reference_code: "R2", recorded_by: 1 }],
  };

  it("derives stable ObjectIds, so a rerun maps to the same documents", () => {
    expect(String(legacyObjectId("students", 5))).toBe(String(legacyObjectId("students", "5")));
    expect(String(legacyObjectId("students", 5))).not.toBe(String(legacyObjectId("teachers", 5)));
  });

  it("converts rows into valid, correctly linked documents", async () => {
    const docs = transformLegacyData(legacy);
    expect(docs.users[0]).toMatchObject({ email: "a@x.test", role: "admin", name: "School Administrator", status: "active", passwordHash: "$2a$hash" });
    expect(docs.users[2]).toMatchObject({ name: "S One", status: "inactive" });
    expect(String(docs.students[0]?.classId)).toBe(String(docs.classes[0]?._id));
    expect(docs.attendance[0]?.date.toISOString()).toBe("2026-09-16T00:00:00.000Z");
    expect(docs.attendance[0]?.corrections).toHaveLength(1);
    expect(String(docs.attendance[0]?.corrections[0]?.correctedBy)).toBe(String(docs.users[0]?._id));
    expect(docs.fees[0]).toMatchObject({ amountCents: 4_500_010, paidCents: 1_500_010 });
    expect(String(docs.payments[0]?.studentId)).toBe(String(docs.students[0]?._id));
    expect(docs.exams[0]?.maxScore).toBe(100.5);
    await expect(new User(docs.users[0]).validate()).resolves.toBeUndefined();
    await expect(new Student(docs.students[0]).validate()).resolves.toBeUndefined();
    await expect(new Attendance(docs.attendance[0]).validate()).resolves.toBeUndefined();
    await expect(new Fee(docs.fees[0]).validate()).resolves.toBeUndefined();
    await expect(new Payment(docs.payments[0]).validate()).resolves.toBeUndefined();
  });
});
