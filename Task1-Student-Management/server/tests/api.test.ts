import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { addDays, dayFromDate, today } from "../src/dates.js";
import { Attendance, Exam, Payment, Result, SchoolClass, Student, Teacher, User } from "../src/models/index.js";
import { closeTestDatabase, connectTestDatabase, countTestDocuments, createFixtures, resetTestData, type Fixtures } from "./testDb.js";

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

type Actor = "admin" | "teacher-a" | "teacher-b" | "student-a" | "student-b";

async function login(role: Actor): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ email: `${role}@integration.example.test`, password });
  expect(response.status).toBe(200);
  return String(response.headers["set-cookie"]?.[0] ?? "").split(";")[0] ?? "";
}

function studentBody(email = "new@integration.example.test") {
  return { email, password, firstName: "New", lastName: "Student", studentNumber: "IT-S3", classId: ids.classA, dateOfBirth: "2011-02-10" };
}

describe("authentication and access control", () => {
  it("reports database connectivity through the health endpoint", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: "ok", database: "connected" });
  });

  it("logs in and returns only safe user fields in an HttpOnly cookie session", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "admin@integration.example.test", password });
    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({ id: ids.admin, email: "admin@integration.example.test", role: "admin" });
    expect(JSON.stringify(response.body).toLowerCase()).not.toContain("password");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Strict");
  });

  it("links student and teacher sessions to their profiles", async () => {
    const me = await request(app).get("/api/auth/me").set("Cookie", await login("student-a"));
    expect(me.body.data.user).toMatchObject({ role: "student", studentId: ids.studentA });
    const teacher = await request(app).get("/api/auth/me").set("Cookie", await login("teacher-a"));
    expect(teacher.body.data.user).toMatchObject({ role: "teacher", teacherId: ids.teacherA });
  });

  it("rejects an incorrect password and clears the session on logout", async () => {
    const wrong = await request(app).post("/api/auth/login").send({ email: "admin@integration.example.test", password: "wrong-password" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
    const logout = await request(app).post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.[0]).toContain("Max-Age=0");
  });

  it("enforces a student's own-record boundary on student list and detail routes", async () => {
    const cookie = await login("student-a");
    expect((await request(app).get("/api/students").set("Cookie", cookie)).status).toBe(403);
    const own = await request(app).get(`/api/students/${ids.studentA}`).set("Cookie", cookie);
    expect(own.status).toBe(200);
    expect(own.body.data.studentNumber).toBe("IT-S1");
    expect((await request(app).get(`/api/students/${ids.studentB}`).set("Cookie", cookie)).status).toBe(403);
    expect((await request(app).get(`/api/students/${missingId}`).set("Cookie", cookie)).status).toBe(403);
  });

  it("invalidates an existing cookie when its student profile is deactivated", async () => {
    const cookie = await login("student-a");
    await Student.updateOne({ _id: ids.studentA }, { status: "inactive" });
    const response = await request(app).get(`/api/students/${ids.studentA}`).set("Cookie", cookie);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("does not expose a teacher profile to a student", async () => {
    const response = await request(app).get(`/api/teachers/${ids.teacherA}`).set("Cookie", await login("student-a"));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("enforces role, ownership, class, origin, and manipulated-ID boundaries", async () => {
    const admin = await login("admin");
    const teacher = await login("teacher-a");
    const student = await login("student-a");
    expect((await request(app).get("/api/students")).status).toBe(401);
    expect((await request(app).get("/api/students").set("Cookie", student)).status).toBe(403);
    expect((await request(app).get(`/api/students/${ids.studentB}`).set("Cookie", student)).status).toBe(403);
    expect((await request(app).get(`/api/students/${ids.studentB}`).set("Cookie", teacher)).status).toBe(403);
    expect((await request(app).get(`/api/students/${ids.studentA}`).set("Cookie", teacher)).status).toBe(200);
    expect((await request(app).get(`/api/teachers/${ids.teacherB}`).set("Cookie", teacher)).status).toBe(403);
    expect((await request(app).get(`/api/teachers/${ids.teacherA}`).set("Cookie", student)).status).toBe(403);
    expect((await request(app).get("/api/fees").set("Cookie", teacher)).status).toBe(403);
    expect((await request(app).get("/api/payments").set("Cookie", teacher)).status).toBe(403);
    expect((await request(app).get(`/api/fees/${ids.feeA}/payments`).set("Cookie", student)).status).toBe(200);
    const foreignFee = await request(app).post("/api/fees").set("Cookie", admin)
      .send({ studentId: ids.studentB, description: "Other fee", academicYear: "2026-27", amount: 200, dueDate: "2026-12-01" });
    const foreign = await request(app).get(`/api/fees/${foreignFee.body.data.id}/payments`).set("Cookie", student);
    const missing = await request(app).get(`/api/fees/${missingId}/payments`).set("Cookie", student);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toEqual(missing.body.error);
    expect((await request(app).post("/api/attendance").set("Cookie", teacher).send({ studentId: ids.studentB, classId: ids.classB, date: "2026-10-15", status: "present" })).status).toBe(403);
    expect((await request(app).post("/api/fees").set("Cookie", student).send({})).status).toBe(403);
    expect((await request(app).post("/api/classes").set("Cookie", teacher).send({ name: "X" })).status).toBe(403);
    expect((await request(app).post("/api/auth/login").set("Origin", "https://untrusted.example.test").send({ email: "admin@integration.example.test", password })).status).toBe(403);
  });

  it("scopes classes to the assigned teacher and enrolled student", async () => {
    const teacher = await request(app).get("/api/classes").set("Cookie", await login("teacher-a"));
    expect(teacher.body.data.map((item: { id: string }) => item.id)).toEqual([ids.classA]);
    const student = await request(app).get("/api/classes").set("Cookie", await login("student-b"));
    expect(student.body.data.map((item: { id: string }) => item.id)).toEqual([ids.classB]);
    const admin = await request(app).get("/api/classes").set("Cookie", await login("admin"));
    expect(admin.body.data).toHaveLength(2);
    expect(admin.body.data[0]).toMatchObject({ section: "A", teacherId: ids.teacherA, teacherName: "Test Teacher A", studentCount: 1 });
  });
});

describe("students", () => {
  it("creates, reads, edits, and deactivates a student without accepting mass-assigned fields", async () => {
    const cookie = await login("admin");
    const created = await request(app).post("/api/students").set("Cookie", cookie)
      .send({ ...studentBody(), role: "admin", status: "inactive", userId: ids.admin, passwordHash: "forged", address: "7 Example Way" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ email: "new@integration.example.test", status: "active", studentNumber: "IT-S3", dateOfBirth: "2011-02-10", address: "7 Example Way", className: "Integration Grade", section: "A" });
    expect(JSON.stringify(created.body).toLowerCase()).not.toContain("passwordhash");
    const studentId = String(created.body.data.id);
    expect((await User.findOne({ email: "new@integration.example.test" }).lean())?.role).toBe("student");

    expect((await request(app).get(`/api/students/${studentId}`).set("Cookie", cookie)).status).toBe(200);
    const updated = await request(app).put(`/api/students/${studentId}`).set("Cookie", cookie)
      .send({ ...studentBody("edited@integration.example.test"), firstName: "Edited", status: "inactive" });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ email: "edited@integration.example.test", firstName: "Edited", status: "active" });
    expect((await User.findOne({ email: "edited@integration.example.test" }).lean())?.name).toBe("Edited Student");

    const removed = await request(app).delete(`/api/students/${studentId}`).set("Cookie", cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.data.status).toBe("inactive");
    const inactive = await request(app).get(`/api/students/${studentId}`).set("Cookie", cookie);
    expect(inactive.body.data.status).toBe("inactive");
    expect((await request(app).post("/api/auth/login").send({ email: "edited@integration.example.test", password })).status).toBe(401);
  });

  it("rejects duplicate and invalid students and undoes a failed account creation", async () => {
    const cookie = await login("admin");
    const duplicateNumber = await request(app).post("/api/students").set("Cookie", cookie)
      .send({ ...studentBody("rolled-back@integration.example.test"), studentNumber: "IT-S1" });
    expect(duplicateNumber.status).toBe(409);
    expect(await User.exists({ email: "rolled-back@integration.example.test" })).toBeNull();
    const duplicateEmail = await request(app).post("/api/students").set("Cookie", cookie).send(studentBody("student-a@integration.example.test"));
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.error.code).toBe("DUPLICATE_RECORD");
    expect((await request(app).post("/api/students").set("Cookie", cookie).send(studentBody("bad-email"))).status).toBe(400);
    expect((await request(app).post("/api/students").set("Cookie", cookie).send({ ...studentBody(), classId: missingId })).status).toBe(400);
    expect((await request(app).get(`/api/students/${missingId}`).set("Cookie", cookie)).status).toBe(404);
    expect((await request(app).get("/api/students/1%20OR%201=1").set("Cookie", cookie)).status).toBe(400);
  });

  it("keeps the old email when a profile edit conflicts", async () => {
    const cookie = await login("admin");
    const response = await request(app).put(`/api/students/${ids.studentA}`).set("Cookie", cookie)
      .send({ ...studentBody("changed@integration.example.test"), studentNumber: "IT-S2" });
    expect(response.status).toBe(409);
    expect(await User.exists({ email: "student-a@integration.example.test" })).not.toBeNull();
    expect(await User.exists({ email: "changed@integration.example.test" })).toBeNull();
  });

  it("searches, filters, sorts, and paginates on the server", async () => {
    const cookie = await login("admin");
    const byEmail = await request(app).get("/api/students?search=student-b").set("Cookie", cookie);
    expect(byEmail.body.data.map((item: { id: string }) => item.id)).toEqual([ids.studentB]);
    const byClass = await request(app).get(`/api/students?classId=${ids.classA}`).set("Cookie", cookie);
    expect(byClass.body.meta.total).toBe(1);
    const sorted = await request(app).get("/api/students?sortBy=studentNumber&sortOrder=desc&limit=1&page=2").set("Cookie", cookie);
    expect(sorted.body.data[0].studentNumber).toBe("IT-S1");
    expect(sorted.body.meta).toEqual({ page: 2, limit: 1, total: 2, pages: 2 });
    const byClassName = await request(app).get("/api/students?sortBy=class&sortOrder=asc").set("Cookie", cookie);
    expect(byClassName.body.meta.total).toBe(2);
    expect((await request(app).get("/api/students?limit=51").set("Cookie", cookie)).status).toBe(400);
    const teacherView = await request(app).get("/api/students").set("Cookie", await login("teacher-a"));
    expect(teacherView.body.data.map((item: { id: string }) => item.id)).toEqual([ids.studentA]);
  });
});

describe("teachers and classes", () => {
  it("manages teachers and classes with active-assignment validation", async () => {
    const cookie = await login("admin");
    const teacher = await request(app).post("/api/teachers").set("Cookie", cookie).send({
      email: "new-teacher@integration.example.test", password, firstName: "New", lastName: "Teacher", employeeNumber: "IT-T3", subject: "History", role: "admin",
    });
    expect(teacher.status).toBe(201);
    const teacherId = String(teacher.body.data.id);
    expect((await User.findOne({ email: "new-teacher@integration.example.test" }).lean())?.role).toBe("teacher");
    const updated = await request(app).put(`/api/teachers/${teacherId}`).set("Cookie", cookie).send({
      email: "new-teacher@integration.example.test", firstName: "Edited", lastName: "Teacher", employeeNumber: "IT-T3", subject: "Geography",
    });
    expect(updated.body.data).toMatchObject({ firstName: "Edited", subject: "Geography" });
    const search = await request(app).get("/api/teachers?search=geogra").set("Cookie", cookie);
    expect(search.body.data.map((item: { id: string }) => item.id)).toEqual([teacherId]);
    const own = await request(app).get("/api/teachers").set("Cookie", await login("teacher-a"));
    expect(own.body.data.map((item: { id: string }) => item.id)).toEqual([ids.teacherA]);

    const createdClass = await request(app).post("/api/classes").set("Cookie", cookie).send({ name: "Integration Grade", section: "C", teacherId });
    expect(createdClass.status).toBe(201);
    const classId = String(createdClass.body.data.id);
    const reassigned = await request(app).put(`/api/classes/${classId}`).set("Cookie", cookie).send({ name: "Integration Grade", section: "C", teacherId: ids.teacherA });
    expect(reassigned.body.data.teacherId).toBe(ids.teacherA);
    expect((await request(app).delete(`/api/teachers/${teacherId}`).set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).put(`/api/classes/${classId}`).set("Cookie", cookie).send({ name: "Integration Grade", section: "C", teacherId })).status).toBe(400);
    expect((await request(app).post("/api/classes").set("Cookie", cookie).send({ name: "Integration Grade", section: "A" })).status).toBe(409);
    expect((await request(app).put(`/api/classes/${missingId}`).set("Cookie", cookie).send({ name: "Nope" })).status).toBe(404);
  });

  it("shows a class as unassigned when its teacher is inactive", async () => {
    await Teacher.updateOne({ _id: ids.teacherA }, { status: "inactive" });
    const response = await request(app).get("/api/classes").set("Cookie", await login("admin"));
    const classA = response.body.data.find((item: { id: string }) => item.id === ids.classA);
    expect(classA).toMatchObject({ teacherId: null, teacherName: null });
  });
});

describe("attendance and corrections", () => {
  it("records, corrects, filters, and totals attendance with class-scoped teacher updates", async () => {
    const admin = await login("admin");
    const teacher = await login("teacher-a");
    const date = dayFromDate(today());
    const bodyA = { studentId: ids.studentA, classId: ids.classA, date, status: "present" };
    const first = await request(app).post("/api/attendance").set("Cookie", admin).send(bodyA);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ studentName: "Test Student A", className: "Integration Grade", date });
    expect((await request(app).post("/api/attendance").set("Cookie", admin).send(bodyA)).status).toBe(409);
    const second = await request(app).post("/api/attendance").set("Cookie", admin).send({ studentId: ids.studentB, classId: ids.classB, date, status: "absent" });
    expect(second.status).toBe(201);

    const corrected = await request(app).put(`/api/attendance/${first.body.data.id}`).set("Cookie", teacher).send({ status: "late", studentId: ids.studentB, classId: ids.classB });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data).toMatchObject({ status: "late", studentId: ids.studentA, classId: ids.classA });

    const history = await request(app).get(`/api/attendance/${first.body.data.id}/corrections`).set("Cookie", teacher);
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({ attendanceId: first.body.data.id, previousStatus: "present", newStatus: "late", correctedBy: ids.teacherUserA });
    expect(new Date(history.body.data[0].correctedAt).getTime()).toBeGreaterThan(0);

    const stored = await Attendance.findById(first.body.data.id).lean();
    expect(stored?.status).toBe("late");
    expect(stored?.corrections).toHaveLength(1);
    expect((await request(app).put(`/api/attendance/${first.body.data.id}`).set("Cookie", teacher).send({ status: "late" })).status).toBe(400);
    expect((await Attendance.findById(first.body.data.id).lean())?.corrections).toHaveLength(1);

    expect((await request(app).put(`/api/attendance/${second.body.data.id}`).set("Cookie", teacher).send({ status: "present" })).status).toBe(403);
    expect((await request(app).get(`/api/attendance/${second.body.data.id}/corrections`).set("Cookie", teacher)).status).toBe(403);
    expect((await request(app).get(`/api/attendance/${first.body.data.id}/corrections`).set("Cookie", await login("student-a"))).status).toBe(403);
    expect((await request(app).get(`/api/attendance/${missingId}/corrections`).set("Cookie", admin)).status).toBe(404);
    expect((await request(app).get("/api/attendance/1%20OR%201=1/corrections").set("Cookie", admin)).status).toBe(400);
    expect((await request(app).delete(`/api/attendance/${first.body.data.id}/corrections`).set("Cookie", admin)).status).toBe(404);
    expect((await request(app).put(`/api/attendance/${first.body.data.id}`).set("Cookie", teacher).send({ status: "invalid" })).status).toBe(400);

    const listing = await request(app).get(`/api/attendance?date=${date}`).set("Cookie", admin);
    expect(listing.status).toBe(200);
    expect(listing.body.meta).toEqual({ summary: { present: 0, absent: 1, late: 1 }, total: 2 });
    const teacherListing = await request(app).get("/api/attendance").set("Cookie", teacher);
    expect(teacherListing.body.meta.total).toBe(1);
    const studentListing = await request(app).get("/api/attendance").set("Cookie", await login("student-b"));
    expect(studentListing.body.data.map((row: { id: string }) => row.id)).toEqual([second.body.data.id]);
  });

  it("reports totals across the full filtered set, beyond the displayed 200 rows", async () => {
    await Attendance.insertMany(Array.from({ length: 201 }, (_, index) => ({
      studentId: ids.studentA, classId: ids.classA, date: addDays(new Date("2026-01-01T00:00:00Z"), index), status: index === 200 ? "absent" : "present", recordedBy: ids.admin,
    })));
    const response = await request(app).get("/api/attendance").set("Cookie", await login("admin"));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(200);
    expect(response.body.data[0].status).toBe("absent");
    expect(response.body.meta).toEqual({ summary: { present: 200, absent: 1, late: 0 }, total: 201 });
  });

  it("rejects attendance for a student outside the class", async () => {
    const response = await request(app).post("/api/attendance").set("Cookie", await login("admin"))
      .send({ studentId: ids.studentB, classId: ids.classA, date: "2026-10-15", status: "present" });
    expect(response.status).toBe(400);
  });
});

describe("examinations and results", () => {
  it("validates examinations and results and scopes them to students and teachers", async () => {
    const admin = await login("admin");
    const teacherA = await login("teacher-a");
    const exam = await request(app).post("/api/academics/examinations").set("Cookie", admin).send({ title: "Integration exam", classId: ids.classA, date: "2026-10-15", maxScore: 100 });
    expect(exam.status).toBe(201);
    expect(exam.body.data).toMatchObject({ className: "Integration Grade", section: "A", date: "2026-10-15", maxScore: 100 });
    const examinationId = String(exam.body.data.id);
    expect((await request(app).post("/api/academics/examinations").set("Cookie", admin).send({ title: "Integration exam", classId: ids.classA, date: "2026-10-15", maxScore: 100 })).status).toBe(409);
    expect((await request(app).post("/api/academics/examinations").set("Cookie", await login("teacher-b")).send({ title: "Foreign", classId: ids.classA, date: "2026-10-15", maxScore: 100 })).status).toBe(403);
    expect((await request(app).post("/api/academics/examinations").set("Cookie", admin).send({ title: "No class", classId: missingId, date: "2026-10-15", maxScore: 100 })).status).toBe(400);

    const result = await request(app).post("/api/academics/results").set("Cookie", teacherA).send({ examinationId, studentId: ids.studentA, score: 85 });
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ examination: "Integration exam", studentName: "Test Student A", className: "Integration Grade", score: 85, maxScore: 100, date: "2026-10-15" });
    expect((await request(app).post("/api/academics/results").set("Cookie", teacherA).send({ examinationId, studentId: ids.studentA, score: 85 })).status).toBe(409);
    const over = await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId, studentId: ids.studentA, score: 101 });
    expect(over.status).toBe(400);
    expect(over.body.error.message).toContain("greater than the examination maximum");
    expect((await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId, studentId: ids.studentB, score: 85 })).status).toBe(400);
    expect((await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId, studentId: ids.studentA, score: "" })).status).toBe(400);
    expect((await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId: missingId, studentId: ids.studentA, score: 1 })).status).toBe(404);

    expect((await request(app).get("/api/academics/results").set("Cookie", await login("student-a"))).body.meta.total).toBe(1);
    expect((await request(app).get("/api/academics/results").set("Cookie", await login("student-b"))).body.meta.total).toBe(0);
    expect((await request(app).get("/api/academics/results").set("Cookie", await login("teacher-b"))).body.meta.total).toBe(0);
    expect((await request(app).get("/api/academics/examinations").set("Cookie", await login("student-b"))).body.data).toHaveLength(0);
  });

  it("paginates academic results with a full matching count", async () => {
    const admin = await login("admin");
    const exam = await request(app).post("/api/academics/examinations").set("Cookie", admin).send({ title: "Pagination exam", classId: ids.classA, date: "2026-10-15", maxScore: 100 });
    const users = await User.insertMany(Array.from({ length: 51 }, (_, index) => ({ email: `page-${index}@integration.example.test`, passwordHash, role: "student", name: "Test Pagination" })));
    const students = await Student.insertMany(users.map((user, index) => ({ userId: user._id, firstName: "Test", lastName: "Pagination", studentNumber: `PAGE-${index}`, classId: ids.classA })));
    await Result.insertMany(students.map((student) => ({ studentId: student._id, examId: exam.body.data.id, score: 75, recordedBy: ids.admin })));
    const first = await request(app).get("/api/academics/results?page=1").set("Cookie", admin);
    const second = await request(app).get("/api/academics/results?page=2").set("Cookie", admin);
    expect(first.body.data).toHaveLength(50);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.meta).toEqual({ page: 2, limit: 50, total: 51, pages: 2 });
  });
});

describe("fees and payments", () => {
  it("creates fees, records payments, and calculates balances and history", async () => {
    const admin = await login("admin");
    const student = await login("student-a");
    const created = await request(app).post("/api/fees").set("Cookie", admin).send({ studentId: ids.studentA, description: "Lab fee", academicYear: "2026-27", amount: 300, dueDate: "2026-12-02" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ amount: 300, amountPaid: 0, balance: 300, status: "pending", dueDate: "2026-12-02" });
    const feeId = String(created.body.data.id);

    const payment = await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin).send({ amount: 120, referenceCode: "IT-PAY-1" });
    expect(payment.status).toBe(201);
    expect(payment.body.data).toMatchObject({ feeRecordId: feeId, amount: 120, referenceCode: "IT-PAY-1" });

    const ledger = await request(app).get("/api/fees").set("Cookie", admin);
    expect(ledger.body.data.find((fee: { id: string }) => fee.id === feeId)).toMatchObject({ amount: 300, amountPaid: 120, balance: 180, status: "partially paid" });
    expect(ledger.body.meta).toEqual({ total: 2, summary: { obligations: 1300, collected: 120, outstanding: 1180 } });

    const history = await request(app).get(`/api/fees/${feeId}/payments`).set("Cookie", student);
    expect(history.status).toBe(200);
    expect(history.body.data[0]).toMatchObject({ amount: 120, referenceCode: "IT-PAY-1" });

    const over = await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin).send({ amount: 190, referenceCode: "IT-PAY-2" });
    expect(over.status).toBe(400);
    expect(over.body.error.message).toContain("outstanding balance");
    expect((await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin).send({ amount: 1, referenceCode: "IT-PAY-1" })).status).toBe(409);
    const paidOff = await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin).send({ amount: 180 });
    expect(paidOff.status).toBe(201);
    const after = await request(app).get(`/api/fees?studentId=${ids.studentA}`).set("Cookie", admin);
    expect(after.body.data.find((fee: { id: string }) => fee.id === feeId)).toMatchObject({ balance: 0, status: "paid" });
    expect((await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", student).send({ amount: 1 })).status).toBe(403);
  });

  it("lists payments only for the people allowed to see them", async () => {
    const admin = await login("admin");
    await request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", admin).send({ amount: 10, referenceCode: "IT-LIST" });
    const all = await request(app).get("/api/payments").set("Cookie", admin);
    expect(all.body.meta).toEqual({ page: 1, limit: 50, total: 1, pages: 1 });
    expect(all.body.data[0]).toMatchObject({ amount: 10, feeRecordId: ids.feeA, studentId: ids.studentA });
    expect((await request(app).get("/api/payments").set("Cookie", await login("student-a"))).body.meta.total).toBe(1);
    expect((await request(app).get("/api/payments").set("Cookie", await login("student-b"))).body.meta.total).toBe(0);
    expect((await request(app).get(`/api/payments?studentId=${ids.studentB}`).set("Cookie", admin)).body.meta.total).toBe(0);
  });

  it("does not reveal another fee record's existence to a student", async () => {
    const cookie = await login("student-b");
    const foreign = await request(app).get(`/api/fees/${ids.feeA}/payments`).set("Cookie", cookie);
    const missing = await request(app).get(`/api/fees/${missingId}/payments`).set("Cookie", cookie);
    expect(foreign.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(foreign.body.error).toEqual(missing.body.error);
  });
});

describe("dashboard", () => {
  it("matches dashboard aggregates to the underlying database", async () => {
    const admin = await login("admin");
    const teacher = await login("teacher-a");
    const date = dayFromDate(today());
    await request(app).post("/api/attendance").set("Cookie", admin).send({ studentId: ids.studentA, classId: ids.classA, date, status: "present" });
    await request(app).post("/api/attendance").set("Cookie", admin).send({ studentId: ids.studentB, classId: ids.classB, date, status: "absent" });
    const exam = await request(app).post("/api/academics/examinations").set("Cookie", admin).send({ title: "Dashboard exam", classId: ids.classA, date, maxScore: 100 });
    await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId: exam.body.data.id, studentId: ids.studentA, score: 85 });
    await request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", admin).send({ amount: 250, referenceCode: "IT-DASHBOARD" });

    const stats = await request(app).get("/api/dashboard/stats").set("Cookie", admin);
    expect(stats.status).toBe(200);
    expect(stats.body.data.summary).toMatchObject({ totalStudents: 2, totalTeachers: 2, attendance: { present: 1, absent: 1, late: 0, total: 2, percentage: 50 } });
    expect(stats.body.data.academics).toMatchObject({ resultCount: 1, averagePercentage: 85, gradeBands: { strong: 1, steady: 0, support: 0 } });
    expect(stats.body.data.fees).toEqual({ obligations: 1000, collected: 250, outstanding: 750 });
    expect(stats.body.data.recentStudents).toHaveLength(2);
    expect(stats.body.data.attendanceTrend).toHaveLength(14);
    expect(stats.body.data.attendanceTrend.at(-1)).toMatchObject({ date, present: 1, absent: 1, total: 2, percentage: 50 });
    expect(stats.body.data.attendanceTrend[0]).toMatchObject({ total: 0, percentage: 0 });

    expect(await Student.countDocuments({ status: "active" })).toBe(2);
    expect(await Attendance.countDocuments()).toBe(2);
    expect((await Payment.find().lean()).reduce((total, payment) => total + payment.amountCents, 0)).toBe(25_000);
    expect(await Exam.countDocuments()).toBe(1);

    const teacherStats = await request(app).get("/api/dashboard/stats").set("Cookie", teacher);
    expect(teacherStats.body.data.summary).toMatchObject({ totalStudents: 1, totalTeachers: null, attendance: { present: 1, total: 1 } });
    expect(teacherStats.body.data.fees).toBeNull();
    const studentStats = await request(app).get("/api/dashboard/stats").set("Cookie", await login("student-a"));
    expect(studentStats.body.data.summary).toMatchObject({ totalStudents: null, totalTeachers: null, attendance: { present: 1, total: 1 } });
    expect(studentStats.body.data.fees).toEqual({ obligations: 1000, collected: 250, outstanding: 750 });
    expect(studentStats.body.data.recentStudents).toHaveLength(1);
    expect(studentStats.body.data.academics.resultCount).toBe(1);
  });

  it("stays correct for a teacher with no assigned classes", async () => {
    await SchoolClass.updateOne({ _id: ids.classA }, { teacherId: new Types.ObjectId() });
    const stats = await request(app).get("/api/dashboard/stats").set("Cookie", await login("teacher-a"));
    expect(stats.status).toBe(200);
    expect(stats.body.data.summary.totalStudents).toBe(0);
    expect(stats.body.data.academics.resultCount).toBe(0);
  });
});
