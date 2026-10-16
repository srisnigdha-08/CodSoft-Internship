import bcrypt from "bcryptjs";
import request from "supertest";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  TEST_DATABASE, countIntegrationRows, createIntegrationPool,
  prepareIntegrationDatabase, resetIntegrationFixtures,
} from "./integrationDb.js";

const password = "Integration@12345";
const jwtSecret = "isolated-integration-suite-secret-32-characters";
const pool = createIntegrationPool();
let prepared = false;
let passwordHash: string;
let app: ReturnType<typeof createApp>;
let ids: Awaited<ReturnType<typeof seedFixtures>>;

beforeAll(async () => {
  await prepareIntegrationDatabase(pool);
  await pool.query("ALTER TABLE attendance_corrections DROP CONSTRAINT IF EXISTS correction_test_reject");
  prepared = true;
  passwordHash = await bcrypt.hash(password, 4);
});

beforeEach(async () => {
  await resetIntegrationFixtures(pool);
  ids = await seedFixtures(pool, passwordHash);
  app = createApp({ pool, jwtSecret, frontendOrigin: "http://localhost:5173", secureCookie: false });
});

afterEach(async () => {
  if (prepared) await resetIntegrationFixtures(pool);
});

afterAll(async () => {
  try {
    if (prepared) expect(await countIntegrationRows(pool)).toBe(0);
  } finally {
    await pool.end();
  }
});

async function seedFixtures(database: Pool, hash: string) {
  const client = await database.connect();
  const id = async (sql: string, values: unknown[]) => {
    const result = await client.query<{ id: string }>(sql, values);
    if (!result.rows[0]) throw new Error("A test fixture could not be created.");
    return Number(result.rows[0].id);
  };
  try {
    await client.query("BEGIN");
    const admin = await id("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin') RETURNING id", ["admin@integration.example.test", hash]);
    const teacherUserA = await id("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'teacher') RETURNING id", ["teacher-a@integration.example.test", hash]);
    const teacherUserB = await id("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'teacher') RETURNING id", ["teacher-b@integration.example.test", hash]);
    const studentUserA = await id("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'student') RETURNING id", ["student-a@integration.example.test", hash]);
    const studentUserB = await id("INSERT INTO users(email,password_hash,role) VALUES($1,$2,'student') RETURNING id", ["student-b@integration.example.test", hash]);
    const teacherA = await id("INSERT INTO teachers(user_id,first_name,last_name,employee_number,subject) VALUES($1,'Test','Teacher A','IT-T1','Math') RETURNING id", [teacherUserA]);
    const teacherB = await id("INSERT INTO teachers(user_id,first_name,last_name,employee_number,subject) VALUES($1,'Test','Teacher B','IT-T2','Science') RETURNING id", [teacherUserB]);
    const classA = await id("INSERT INTO classes(name,section,teacher_id) VALUES('Integration Grade','A',$1) RETURNING id", [teacherA]);
    const classB = await id("INSERT INTO classes(name,section,teacher_id) VALUES('Integration Grade','B',$1) RETURNING id", [teacherB]);
    const studentA = await id("INSERT INTO students(user_id,first_name,last_name,student_number,class_id) VALUES($1,'Test','Student A','IT-S1',$2) RETURNING id", [studentUserA, classA]);
    const studentB = await id("INSERT INTO students(user_id,first_name,last_name,student_number,class_id) VALUES($1,'Test','Student B','IT-S2',$2) RETURNING id", [studentUserB, classB]);
    const feeA = await id("INSERT INTO fee_records(student_id,description,academic_year,amount,due_date,created_by) VALUES($1,'Test tuition','2026-27',1000,'2026-12-01',$2) RETURNING id", [studentA, admin]);
    await client.query("COMMIT");
    return { admin, teacherUserA, teacherA, teacherB, classA, classB, studentA, studentB, feeA };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function login(role: "admin" | "teacher-a" | "teacher-b" | "student-a" | "student-b") {
  const response = await request(app).post("/api/auth/login").send({ email: `${role}@integration.example.test`, password });
  expect(response.status).toBe(200);
  return String(response.headers["set-cookie"]?.[0] ?? "").split(";")[0] ?? "";
}

function studentBody(email = "new@integration.example.test") {
  return { email, password, firstName: "New", lastName: "Student", studentNumber: "IT-S3", classId: ids.classA, dateOfBirth: "2011-02-10" };
}

describe("real PostgreSQL integration", () => {
  it("uses only the guarded database and applies each migration once", async () => {
    const identity = await pool.query<{ database: string }>("SELECT current_database() AS database");
    expect(identity.rows[0]?.database).toBe(TEST_DATABASE);
    await prepareIntegrationDatabase(pool);
    const history = await pool.query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
    expect(history.rows.map((row) => row.version)).toEqual(["001_initial_schema.sql", "002_student_address.sql", "003_attendance_corrections.sql"]);
  });

  it("creates, reads, edits, and deactivates a student without accepting mass-assigned fields", async () => {
    const cookie = await login("admin");
    const created = await request(app).post("/api/students").set("Cookie", cookie)
      .send({ ...studentBody(), role: "admin", status: "inactive", userId: ids.admin, passwordHash: "forged" });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ email: "new@integration.example.test", status: "active", studentNumber: "IT-S3" });
    expect(JSON.stringify(created.body)).not.toContain("password_hash");
    const studentId = Number(created.body.data.id);
    const account = await pool.query<{ role: string }>("SELECT role FROM users WHERE email=$1", ["new@integration.example.test"]);
    expect(account.rows[0]?.role).toBe("student");

    const read = await request(app).get(`/api/students/${studentId}`).set("Cookie", cookie);
    expect(read.status).toBe(200);
    const updated = await request(app).put(`/api/students/${studentId}`).set("Cookie", cookie)
      .send({ ...studentBody("edited@integration.example.test"), firstName: "Edited", status: "inactive" });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ email: "edited@integration.example.test", firstName: "Edited", status: "active" });
    const removed = await request(app).delete(`/api/students/${studentId}`).set("Cookie", cookie);
    expect(removed.status).toBe(200);
    const inactive = await request(app).get(`/api/students/${studentId}`).set("Cookie", cookie);
    expect(inactive.body.data.status).toBe("inactive");
  });

  it("rejects duplicate and invalid students and rolls back a failed account creation", async () => {
    const cookie = await login("admin");
    const duplicateNumber = await request(app).post("/api/students").set("Cookie", cookie)
      .send({ ...studentBody("rolled-back@integration.example.test"), studentNumber: "IT-S1" });
    expect(duplicateNumber.status).toBe(409);
    const orphan = await pool.query("SELECT 1 FROM users WHERE email=$1", ["rolled-back@integration.example.test"]);
    expect(orphan.rowCount).toBe(0);
    const duplicateEmail = await request(app).post("/api/students").set("Cookie", cookie)
      .send(studentBody("student-a@integration.example.test"));
    expect(duplicateEmail.status).toBe(409);
    expect((await request(app).post("/api/students").set("Cookie", cookie).send(studentBody("bad-email"))).status).toBe(400);
    expect((await request(app).get("/api/students/999999").set("Cookie", cookie)).status).toBe(404);
    expect((await request(app).get("/api/students/1%20OR%201=1").set("Cookie", cookie)).status).toBe(400);
  });

  it("manages teachers and classes with active-assignment validation", async () => {
    const cookie = await login("admin");
    const teacher = await request(app).post("/api/teachers").set("Cookie", cookie).send({
      email: "new-teacher@integration.example.test", password, firstName: "New", lastName: "Teacher",
      employeeNumber: "IT-T3", subject: "History", role: "admin",
    });
    expect(teacher.status).toBe(201);
    const teacherId = Number(teacher.body.data.id);
    const updated = await request(app).put(`/api/teachers/${teacherId}`).set("Cookie", cookie).send({
      email: "new-teacher@integration.example.test", firstName: "Edited", lastName: "Teacher",
      employeeNumber: "IT-T3", subject: "Geography",
    });
    expect(updated.body.data).toMatchObject({ firstName: "Edited", subject: "Geography" });
    const createdClass = await request(app).post("/api/classes").set("Cookie", cookie)
      .send({ name: "Integration Grade", section: "C", teacherId });
    expect(createdClass.status).toBe(201);
    const classId = Number(createdClass.body.data.id);
    const reassigned = await request(app).put(`/api/classes/${classId}`).set("Cookie", cookie)
      .send({ name: "Integration Grade", section: "C", teacherId: ids.teacherA });
    expect(reassigned.body.data.teacherId).toBe(ids.teacherA);
    expect((await request(app).delete(`/api/teachers/${teacherId}`).set("Cookie", cookie)).status).toBe(200);
    const inactiveAssignment = await request(app).put(`/api/classes/${classId}`).set("Cookie", cookie)
      .send({ name: "Integration Grade", section: "C", teacherId });
    expect(inactiveAssignment.status).toBe(400);
  });

  it("records, corrects, filters, and totals attendance with class-scoped teacher updates", async () => {
    const admin = await login("admin");
    const teacher = await login("teacher-a");
    const date = (await pool.query<{ day: string }>("SELECT CURRENT_DATE::text AS day")).rows[0]?.day;
    const bodyA = { studentId: ids.studentA, classId: ids.classA, date, status: "present" };
    const first = await request(app).post("/api/attendance").set("Cookie", admin).send(bodyA);
    expect(first.status).toBe(201);
    expect((await request(app).post("/api/attendance").set("Cookie", admin).send(bodyA)).status).toBe(409);
    const second = await request(app).post("/api/attendance").set("Cookie", admin)
      .send({ studentId: ids.studentB, classId: ids.classB, date, status: "absent" });
    expect(second.status).toBe(201);
    const corrected = await request(app).put(`/api/attendance/${first.body.data.id}`).set("Cookie", teacher)
      .send({ status: "late", studentId: ids.studentB, classId: ids.classB });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data).toMatchObject({ status: "late", studentId: ids.studentA, classId: ids.classA });
    const history = await request(app).get(`/api/attendance/${first.body.data.id}/corrections`).set("Cookie", teacher);
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({ attendanceId: first.body.data.id, previousStatus: "present", newStatus: "late", correctedBy: ids.teacherUserA });
    expect(new Date(history.body.data[0].correctedAt).getTime()).toBeGreaterThan(0);
    const stored = await pool.query<{ status: string; previous_status: string; new_status: string; corrected_by: string }>(
      `SELECT a.status,h.previous_status,h.new_status,h.corrected_by FROM attendance a
       JOIN attendance_corrections h ON h.attendance_id=a.id WHERE a.id=$1`,
      [first.body.data.id],
    );
    expect(stored.rows[0]).toMatchObject({ status: "late", previous_status: "present", new_status: "late", corrected_by: String(ids.teacherUserA) });
    expect((await request(app).put(`/api/attendance/${first.body.data.id}`).set("Cookie", teacher).send({ status: "late" })).status).toBe(400);
    expect((await pool.query("SELECT 1 FROM attendance_corrections WHERE attendance_id=$1", [first.body.data.id])).rowCount).toBe(1);
    expect((await request(app).put(`/api/attendance/${second.body.data.id}`).set("Cookie", teacher).send({ status: "present" })).status).toBe(403);
    expect((await request(app).get(`/api/attendance/${second.body.data.id}/corrections`).set("Cookie", teacher)).status).toBe(403);
    expect((await request(app).get(`/api/attendance/${first.body.data.id}/corrections`).set("Cookie", await login("student-a"))).status).toBe(403);
    expect((await request(app).get("/api/attendance/999999/corrections").set("Cookie", admin)).status).toBe(404);
    expect((await request(app).get("/api/attendance/1%20OR%201=1/corrections").set("Cookie", admin)).status).toBe(400);
    expect((await request(app).delete(`/api/attendance/${first.body.data.id}/corrections`).set("Cookie", admin)).status).toBe(404);
    expect((await request(app).put(`/api/attendance/${first.body.data.id}`).set("Cookie", teacher).send({ status: "invalid" })).status).toBe(400);
    const listing = await request(app).get(`/api/attendance?date=${date}`).set("Cookie", admin);
    expect(listing.status).toBe(200);
    expect(listing.body.meta).toEqual({ summary: { present: 0, absent: 1, late: 1 }, total: 2 });
  });

  it("rolls back an attendance status change when its audit insert fails", async () => {
    const admin = await login("admin");
    const created = await request(app).post("/api/attendance").set("Cookie", admin)
      .send({ studentId: ids.studentA, classId: ids.classA, date: "2026-10-14", status: "present" });
    expect(created.status).toBe(201);
    await countIntegrationRows(pool); // Recheck the test database identity and guard before test-only DDL.
    await pool.query("ALTER TABLE attendance_corrections DROP CONSTRAINT IF EXISTS correction_test_reject");
    await pool.query("ALTER TABLE attendance_corrections ADD CONSTRAINT correction_test_reject CHECK (false) NOT VALID");
    try {
      const failed = await request(app).put(`/api/attendance/${created.body.data.id}`).set("Cookie", admin).send({ status: "late" });
      expect(failed.status).toBe(400);
      const state = await pool.query<{ status: string }>("SELECT status FROM attendance WHERE id=$1", [created.body.data.id]);
      expect(state.rows[0]?.status).toBe("present");
      const history = await pool.query("SELECT 1 FROM attendance_corrections WHERE attendance_id=$1", [created.body.data.id]);
      expect(history.rowCount).toBe(0);
    } finally {
      await pool.query("ALTER TABLE attendance_corrections DROP CONSTRAINT IF EXISTS correction_test_reject");
    }
  });

  it("validates examinations and results and scopes them to students and teachers", async () => {
    const admin = await login("admin");
    const teacherA = await login("teacher-a");
    const studentA = await login("student-a");
    const studentB = await login("student-b");
    const exam = await request(app).post("/api/academics/examinations").set("Cookie", admin)
      .send({ title: "Integration exam", classId: ids.classA, date: "2026-10-15", maxScore: 100 });
    expect(exam.status).toBe(201);
    const examinationId = Number(exam.body.data.id);
    const result = await request(app).post("/api/academics/results").set("Cookie", teacherA)
      .send({ examinationId, studentId: ids.studentA, score: 85 });
    expect(result.status).toBe(201);
    expect((await request(app).post("/api/academics/results").set("Cookie", teacherA).send({ examinationId, studentId: ids.studentA, score: 85 })).status).toBe(409);
    expect((await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId, studentId: ids.studentA, score: 101 })).status).toBe(400);
    expect((await request(app).post("/api/academics/results").set("Cookie", admin).send({ examinationId, studentId: ids.studentB, score: 85 })).status).toBe(400);
    const own = await request(app).get("/api/academics/results").set("Cookie", studentA);
    const other = await request(app).get("/api/academics/results").set("Cookie", studentB);
    expect(own.body.meta.total).toBe(1);
    expect(other.body.meta.total).toBe(0);
  });

  it("paginates academic results using real PostgreSQL rows", async () => {
    const admin = await login("admin");
    const exam = await request(app).post("/api/academics/examinations").set("Cookie", admin)
      .send({ title: "Pagination exam", classId: ids.classA, date: "2026-10-15", maxScore: 100 });
    const examId = Number(exam.body.data.id);
    await pool.query(
      `INSERT INTO users(email,password_hash,role)
       SELECT 'page-' || n || '@integration.example.test',$1,'student' FROM generate_series(1,51) AS n`, [passwordHash],
    );
    await pool.query(
      `INSERT INTO students(user_id,first_name,last_name,student_number,class_id)
       SELECT id,'Test','Pagination','PG-' || row_number() OVER (ORDER BY id),$1
       FROM users WHERE email LIKE 'page-%@integration.example.test'`, [ids.classA],
    );
    await pool.query(
      `INSERT INTO academic_results(student_id,examination_id,score,recorded_by)
       SELECT id,$1,75,$2 FROM students WHERE student_number LIKE 'PG-%'`, [examId, ids.admin],
    );
    const first = await request(app).get("/api/academics/results?page=1").set("Cookie", admin);
    const second = await request(app).get("/api/academics/results?page=2").set("Cookie", admin);
    expect(first.body.data).toHaveLength(50);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.meta).toEqual({ page: 2, limit: 50, total: 51, pages: 2 });
  });

  it("creates fees, records payments, and calculates balances and history", async () => {
    const admin = await login("admin");
    const student = await login("student-a");
    const created = await request(app).post("/api/fees").set("Cookie", admin).send({
      studentId: ids.studentA, description: "Lab fee", academicYear: "2026-27", amount: 300, dueDate: "2026-12-02",
    });
    expect(created.status).toBe(201);
    const feeId = Number(created.body.data.id);
    const payment = await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin)
      .send({ amount: 120, referenceCode: "IT-PAY-1" });
    expect(payment.status).toBe(201);
    const ledger = await request(app).get("/api/fees").set("Cookie", admin);
    const labFee = ledger.body.data.find((fee: { id: number }) => fee.id === feeId);
    expect(labFee).toMatchObject({ amount: 300, amountPaid: 120, balance: 180, status: "partially paid" });
    expect(ledger.body.meta.summary).toEqual({ obligations: 1300, collected: 120, outstanding: 1180 });
    const history = await request(app).get(`/api/fees/${feeId}/payments`).set("Cookie", student);
    expect(history.status).toBe(200);
    expect(history.body.data[0]).toMatchObject({ amount: 120, referenceCode: "IT-PAY-1" });
    expect((await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin).send({ amount: 190, referenceCode: "IT-PAY-2" })).status).toBe(400);
    expect((await request(app).post(`/api/fees/${feeId}/payments`).set("Cookie", admin).send({ amount: 1, referenceCode: "IT-PAY-1" })).status).toBe(409);
  });

  it("serializes concurrent payments so the fee cannot be overpaid", async () => {
    const admin = await login("admin");
    const responses = await Promise.all([
      request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", admin).send({ amount: 700, referenceCode: "IT-CONCURRENT-A" }),
      request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", admin).send({ amount: 700, referenceCode: "IT-CONCURRENT-B" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 400]);
    const ledger = await request(app).get("/api/fees").set("Cookie", admin);
    expect(ledger.body.data[0]).toMatchObject({ amountPaid: 700, balance: 300, status: "partially paid" });
  });

  it("matches dashboard aggregates to the underlying database", async () => {
    const admin = await login("admin");
    const teacher = await login("teacher-a");
    const date = (await pool.query<{ day: string }>("SELECT CURRENT_DATE::text AS day")).rows[0]?.day;
    await request(app).post("/api/attendance").set("Cookie", admin).send({ studentId: ids.studentA, classId: ids.classA, date, status: "present" });
    await request(app).post("/api/attendance").set("Cookie", admin).send({ studentId: ids.studentB, classId: ids.classB, date, status: "absent" });
    const exam = await request(app).post("/api/academics/examinations").set("Cookie", admin)
      .send({ title: "Dashboard exam", classId: ids.classA, date, maxScore: 100 });
    await request(app).post("/api/academics/results").set("Cookie", admin)
      .send({ examinationId: exam.body.data.id, studentId: ids.studentA, score: 85 });
    await request(app).post(`/api/fees/${ids.feeA}/payments`).set("Cookie", admin).send({ amount: 250, referenceCode: "IT-DASHBOARD" });
    const stats = await request(app).get("/api/dashboard/stats").set("Cookie", admin);
    expect(stats.status).toBe(200);
    expect(stats.body.data.summary).toMatchObject({ totalStudents: 2, totalTeachers: 2, attendance: { present: 1, absent: 1, late: 0, total: 2, percentage: 50 } });
    expect(stats.body.data.academics).toMatchObject({ resultCount: 1, averagePercentage: 85, gradeBands: { strong: 1, steady: 0, support: 0 } });
    expect(stats.body.data.fees).toEqual({ obligations: 1000, collected: 250, outstanding: 750 });
    const direct = await pool.query<{ students: number; teachers: number; attendance: number; collected: number }>(
      `SELECT (SELECT COUNT(*)::int FROM students WHERE status='active') AS students,
              (SELECT COUNT(*)::int FROM teachers WHERE status='active') AS teachers,
              (SELECT COUNT(*)::int FROM attendance WHERE attendance_date=CURRENT_DATE) AS attendance,
              (SELECT COALESCE(SUM(amount),0)::int FROM fee_payments) AS collected`,
    );
    expect(direct.rows[0]).toEqual({ students: 2, teachers: 2, attendance: 2, collected: 250 });
    const teacherStats = await request(app).get("/api/dashboard/stats").set("Cookie", teacher);
    expect(teacherStats.body.data.summary).toMatchObject({ totalStudents: 1, totalTeachers: null, attendance: { present: 1, total: 1 } });
    expect(teacherStats.body.data.fees).toBeNull();
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
    expect((await request(app).get(`/api/fees/${ids.feeA}/payments`).set("Cookie", student)).status).toBe(200);
    const foreignFee = await request(app).post("/api/fees").set("Cookie", admin)
      .send({ studentId: ids.studentB, description: "Other fee", academicYear: "2026-27", amount: 200, dueDate: "2026-12-01" });
    const foreign = await request(app).get(`/api/fees/${foreignFee.body.data.id}/payments`).set("Cookie", student);
    const missing = await request(app).get("/api/fees/999999/payments").set("Cookie", student);
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toEqual(missing.body.error);
    expect((await request(app).post("/api/attendance").set("Cookie", teacher).send({ studentId: ids.studentB, classId: ids.classB, date: "2026-10-15", status: "present" })).status).toBe(403);
    expect((await request(app).post("/api/fees").set("Cookie", student).send({})).status).toBe(403);
    expect((await request(app).post("/api/auth/login").set("Origin", "https://untrusted.example.test").send({ email: "admin@integration.example.test", password })).status).toBe(403);
  });

  it("enforces foreign keys and unique constraints in PostgreSQL", async () => {
    await expect(pool.query(
      "INSERT INTO students(user_id,first_name,last_name,student_number,class_id) VALUES($1,'Bad','Reference','IT-BAD',$2)",
      [ids.admin, 999999],
    )).rejects.toMatchObject({ code: "23503" });
    await expect(pool.query(
      "INSERT INTO classes(name,section,teacher_id) VALUES('Integration Grade','A',$1)", [ids.teacherA],
    )).rejects.toMatchObject({ code: "23505" });
  });
});
