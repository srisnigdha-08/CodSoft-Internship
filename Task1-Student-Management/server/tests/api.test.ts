import bcrypt from "bcryptjs";
import request from "supertest";
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

interface FakeStudent {
  id: string; user_id: string; email: string; first_name: string; last_name: string;
  student_number: string; class_id: string | null; class_name: string | null; section: string | null;
  date_of_birth: string | null; phone: string | null; address: string | null; status: "active" | "inactive"; created_at: Date;
}

interface FakeUser { id: string; email: string; password_hash: string; role: "admin" | "teacher" | "student" }

const secret = "integration-test-secret-that-is-at-least-32-characters-long";
let passwordHashes: Record<string, string>;
let app: ReturnType<typeof createApp>;
let state: ReturnType<typeof makeDatabase>["state"];

beforeAll(async () => {
  passwordHashes = {
    admin: await bcrypt.hash("Admin@12345", 4),
    teacher: await bcrypt.hash("Teacher@12345", 4),
    student: await bcrypt.hash("Student@12345", 4),
  };
});

beforeEach(() => {
  const database = makeDatabase(passwordHashes);
  state = database.state;
  app = createApp({ pool: database.pool, jwtSecret: secret, frontendOrigin: "http://localhost:5173", secureCookie: false });
});

describe("authentication and access control", () => {
  it("reports database connectivity through the health endpoint", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: "ok", database: "connected" });
  });

  it("logs in and returns only safe user fields in an HttpOnly cookie session", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "admin@school.local", password: "Admin@12345" });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({ id: 1, email: "admin@school.local", role: "admin" });
    expect(JSON.stringify(response.body)).not.toContain("password_hash");
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=Strict");
  });

  it("rejects an incorrect password", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "admin@school.local", password: "wrong-password" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("enforces a student's own-record boundary on student list and detail routes", async () => {
    const cookie = await signIn("student@school.local", "Student@12345");
    const list = await request(app).get("/api/students").set("Cookie", cookie);
    const own = await request(app).get("/api/students/1").set("Cookie", cookie);
    const other = await request(app).get("/api/students/2").set("Cookie", cookie);
    const missingOther = await request(app).get("/api/students/999").set("Cookie", cookie);

    expect(list.status).toBe(403);
    expect(own.status).toBe(200);
    expect(own.body.data.studentNumber).toBe("S-2026-001");
    expect(other.status).toBe(403);
    expect(missingOther.status).toBe(403);
  });

  it("invalidates an existing cookie when its student profile is deactivated", async () => {
    const cookie = await signIn("student@school.local", "Student@12345");
    const student = state.students.find((item) => item.id === "1");
    if (student) student.status = "inactive";

    const response = await request(app).get("/api/students/1").set("Cookie", cookie);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("does not expose a teacher profile to a student", async () => {
    const cookie = await signIn("student@school.local", "Student@12345");
    const response = await request(app).get("/api/teachers/1").set("Cookie", cookie);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});

describe("student management", () => {
  it("creates, retrieves, updates, and deactivates a student", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const created = await request(app).post("/api/students").set("Cookie", cookie).send({
      email: "new.student@school.local", password: "NewStudent@123", firstName: "Sam", lastName: "Rivera",
      studentNumber: "S-2026-010", classId: 1, dateOfBirth: "2011-02-10", phone: "555-0120", address: "7 Example Way, Demo Borough",
    });
    expect(created.status).toBe(201);
    expect(created.body.data.email).toBe("new.student@school.local");
    expect(created.body.data.studentNumber).toBe("S-2026-010");
    expect(created.body.data.address).toBe("7 Example Way, Demo Borough");

    const id = created.body.data.id as number;
    const retrieved = await request(app).get(`/api/students/${id}`).set("Cookie", cookie);
    expect(retrieved.status).toBe(200);
    expect(retrieved.body.data.firstName).toBe("Sam");

    const updated = await request(app).put(`/api/students/${id}`).set("Cookie", cookie).send({
      email: "sam.rivera@school.local", firstName: "Samuel", lastName: "Rivera", studentNumber: "S-2026-010",
      classId: 1, dateOfBirth: "2011-02-10", phone: "555-0121", address: "8 Example Way, Demo Borough",
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.firstName).toBe("Samuel");
    expect(updated.body.data.email).toBe("sam.rivera@school.local");
    expect(updated.body.data.address).toBe("8 Example Way, Demo Borough");

    const removed = await request(app).delete(`/api/students/${id}`).set("Cookie", cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.data.status).toBe("inactive");
    expect(state.students.find((student) => student.id === String(id))?.status).toBe("inactive");
  });

  it("rejects duplicate email, invalid input, and missing students", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const duplicate = await request(app).post("/api/students").set("Cookie", cookie).send({
      email: "admin@school.local", password: "ValidPassword@123", firstName: "A", lastName: "B", studentNumber: "S-2026-020",
    });
    const invalid = await request(app).post("/api/students").set("Cookie", cookie).send({ email: "not-an-email" });
    const missing = await request(app).get("/api/students/999").set("Cookie", cookie);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_RECORD");
    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});

describe("class assignments", () => {
  it("rejects assignment to an inactive teacher", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const response = await request(app).post("/api/classes").set("Cookie", cookie).send({ name: "Grade 11", section: "A", teacherId: 999 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("attendance, academic results, and fee records", () => {
  it("records attendance once per student, class, and date", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const body = { studentId: 1, classId: 1, date: "2026-10-14", status: "present" };
    const first = await request(app).post("/api/attendance").set("Cookie", cookie).send(body);
    const duplicate = await request(app).post("/api/attendance").set("Cookie", cookie).send(body);

    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe("present");
    expect(duplicate.status).toBe(409);
  });

  it("rejects an academic score above the examination maximum", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const response = await request(app).post("/api/academics/results").set("Cookie", cookie).send({ examinationId: 1, studentId: 1, score: 101 });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain("greater than the examination maximum");
  });

  it("rejects blank or nonnumeric marks and payment amounts", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const blankScore = await request(app).post("/api/academics/results").set("Cookie", cookie).send({ examinationId: 1, studentId: 1, score: "" });
    const booleanPayment = await request(app).post("/api/fees/1/payments").set("Cookie", cookie).send({ amount: true });
    expect(blankScore.status).toBe(400);
    expect(booleanPayment.status).toBe(400);
  });

  it("paginates academic results with a full matching count", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const response = await request(app).get("/api/academics/results?page=2").set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 50, total: 450, pages: 9 });
    expect(response.body.data[0].date).toBe("2026-10-08");
  });

  it("reports attendance totals across the full filtered set, beyond the displayed 200 rows", async () => {
    for (let index = 0; index < 201; index += 1) {
      state.attendance.push({ id: String(index + 1), student_id: "1", class_id: "1", attendance_date: "2026-10-14", status: index === 200 ? "absent" : "present" });
    }
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const response = await request(app).get("/api/attendance").set("Cookie", cookie);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(200);
    expect(response.body.meta).toEqual({ summary: { present: 200, absent: 1, late: 0 }, total: 201 });
  });

  it("calculates fee balances and rejects a payment above the balance", async () => {
    const cookie = await signIn("admin@school.local", "Admin@12345");
    const records = await request(app).get("/api/fees").set("Cookie", cookie);
    const excessive = await request(app).post("/api/fees/1/payments").set("Cookie", cookie).send({ amount: 800 });

    expect(records.status).toBe(200);
    expect(records.body.data[0]).toMatchObject({ amount: 1000, amountPaid: 250, balance: 750, status: "partially paid" });
    expect(records.body.meta).toEqual({ total: 1, summary: { obligations: 1000, collected: 250, outstanding: 750 } });
    expect(excessive.status).toBe(400);
    expect(excessive.body.error.message).toContain("outstanding balance");
  });

  it("does not reveal another fee record's existence to a student", async () => {
    const cookie = await signIn("student@school.local", "Student@12345");
    const own = await request(app).get("/api/fees/1/payments").set("Cookie", cookie);
    const foreign = await request(app).get("/api/fees/2/payments").set("Cookie", cookie);
    const missing = await request(app).get("/api/fees/999/payments").set("Cookie", cookie);
    expect(own.status).toBe(200);
    expect(foreign.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(foreign.body.error).toEqual(missing.body.error);
  });
});

async function signIn(email: string, password: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  if (response.status !== 200) throw new Error(`Test sign-in failed for ${email}`);
  const cookie = response.headers["set-cookie"]?.[0];
  if (!cookie) throw new Error("Test sign-in did not return a session cookie.");
  return cookie.split(";")[0] ?? "";
}

function makeDatabase(hashes: Record<string, string>) {
  const hashFor = (role: "admin" | "teacher" | "student") => {
    const hash = hashes[role];
    if (!hash) throw new Error(`Missing ${role} password hash in test fixture.`);
    return hash;
  };
  const users: FakeUser[] = [
    { id: "1", email: "admin@school.local", password_hash: hashFor("admin"), role: "admin" },
    { id: "2", email: "teacher@school.local", password_hash: hashFor("teacher"), role: "teacher" },
    { id: "3", email: "student@school.local", password_hash: hashFor("student"), role: "student" },
  ];
  const students: FakeStudent[] = [
    { id: "1", user_id: "3", email: "student@school.local", first_name: "Jordan", last_name: "Lee", student_number: "S-2026-001", class_id: "1", class_name: "Grade 10", section: "A", date_of_birth: "2010-04-12", phone: "555-0102", address: null, status: "active", created_at: new Date("2026-10-01T00:00:00Z") },
    { id: "2", user_id: "99", email: "another.student@school.local", first_name: "Taylor", last_name: "Chen", student_number: "S-2026-002", class_id: "1", class_name: "Grade 10", section: "A", date_of_birth: null, phone: null, address: null, status: "active", created_at: new Date("2026-10-02T00:00:00Z") },
  ];
  const state = {
    users,
    students,
    attendance: [] as Array<Record<string, unknown>>,
    payments: [{ fee_record_id: "1", amount: 250 }],
    nextUserId: 4,
    nextStudentId: 3,
    nextAttendanceId: 1,
  };

  async function query<T extends QueryResultRow = QueryResultRow>(rawSql: string, rawValues: unknown[] = []): Promise<QueryResult<T>> {
    const sql = rawSql.replace(/\s+/g, " ").trim().toLowerCase();
    const values = rawValues;
    const rows = <R>(items: R[], rowCount = items.length) => ({ rows: items, rowCount, command: "SELECT", oid: 0, fields: [] }) as unknown as QueryResult<T>;
    const pgError = (code: string) => Object.assign(new Error("database constraint"), { code });
    if (["begin", "commit", "rollback"].includes(sql)) return rows([]);

    if (sql.startsWith("select u.id,u.email,u.role,s.id as student_id,t.id as teacher_id")) {
      const user = state.users.find((item) => item.id === String(values[0]) && item.email === values[1] && item.role === values[2]);
      if (!user) return rows([]);
      const student = state.students.find((item) => item.user_id === user.id && item.status === "active");
      const teacherId = user.role === "teacher" ? "1" : null;
      if ((user.role === "student" && !student) || (user.role === "teacher" && !teacherId)) return rows([]);
      return rows([{ id: user.id, email: user.email, role: user.role, student_id: student?.id ?? null, teacher_id: teacherId }]);
    }
    if (sql.startsWith("select u.id, u.email, u.password_hash")) {
      const user = state.users.find((item) => item.email === values[0]);
      if (!user) return rows([]);
      const student = state.students.find((item) => item.user_id === user.id && item.status === "active");
      const teacherId = user.role === "teacher" ? "1" : null;
      if (user.role === "student" && !student) return rows([]);
      return rows([{ id: user.id, email: user.email, password_hash: user.password_hash, role: user.role, student_id: student?.id ?? null, teacher_id: teacherId }]);
    }
    if (sql.startsWith("insert into users(email")) {
      const email = String(values[0]);
      if (state.users.some((item) => item.email === email)) throw pgError("23505");
      const id = String(state.nextUserId++);
      state.users.push({ id, email, password_hash: String(values[1]), role: sql.includes("'teacher'") ? "teacher" : "student" });
      return rows([{ id }]);
    }
    if (sql.startsWith("insert into students(user_id")) {
      const [userId, firstName, lastName, studentNumber, classId, dob, phone, address] = values;
      if (state.students.some((item) => item.student_number === studentNumber)) throw pgError("23505");
      const user = state.users.find((item) => item.id === String(userId));
      const student: FakeStudent = { id: String(state.nextStudentId++), user_id: String(userId), email: user?.email ?? "", first_name: String(firstName), last_name: String(lastName), student_number: String(studentNumber), class_id: classId ? String(classId) : null, class_name: classId ? "Grade 10" : null, section: classId ? "A" : null, date_of_birth: dob ? String(dob) : null, phone: phone ? String(phone) : null, address: address ? String(address) : null, status: "active", created_at: new Date("2026-10-15T00:00:00Z") };
      state.students.push(student);
      return rows([{ id: student.id }]);
    }
    if (sql.startsWith("select s.id, u.email")) {
      let found = state.students;
      const idFilter = sql.match(/where s\.id\s*=\s*\$\d+/);
      if (idFilter) found = found.filter((student) => student.id === String(values[0]));
      return rows(found.map(({ id, email, first_name, last_name, student_number, class_id, class_name, section, date_of_birth, phone, address, status, created_at }) => ({ id, email, first_name, last_name, student_number, class_id, class_name, section, date_of_birth, phone, address, status, created_at })));
    }
    if (sql.startsWith("select user_id from students")) {
      const student = state.students.find((item) => item.id === String(values[0]) && item.status === "active");
      return rows(student ? [{ user_id: student.user_id }] : []);
    }
    if (sql.startsWith("update users set email")) {
      const user = state.users.find((item) => item.id === String(values[1]));
      if (state.users.some((item) => item.email === values[0] && item.id !== String(values[1]))) throw pgError("23505");
      if (user) user.email = String(values[0]);
      return rows([], user ? 1 : 0);
    }
    if (sql.startsWith("update students set first_name")) {
      const student = state.students.find((item) => item.id === String(values[7]));
      if (!student) return rows([], 0);
      [student.first_name, student.last_name, student.student_number] = [String(values[0]), String(values[1]), String(values[2])];
      student.class_id = values[3] ? String(values[3]) : null; student.class_name = values[3] ? "Grade 10" : null; student.section = values[3] ? "A" : null;
      student.date_of_birth = values[4] ? String(values[4]) : null; student.phone = values[5] ? String(values[5]) : null; student.address = values[6] ? String(values[6]) : null;
      student.email = state.users.find((item) => item.id === student.user_id)?.email ?? student.email;
      return rows([], 1);
    }
    if (sql.startsWith("update students set status")) {
      const student = state.students.find((item) => item.id === String(values[0]) && item.status === "active");
      if (student) student.status = "inactive";
      return rows([], student ? 1 : 0);
    }
    if (sql.startsWith("select 1 from students where id=$1 and class_id=$2")) {
      const student = state.students.find((item) => item.id === String(values[0]) && item.class_id === String(values[1]) && item.status === "active");
      return rows(student ? [{ ok: 1 }] : []);
    }
    if (sql.startsWith("select 1 from teachers where id=$1 and status='active'")) return rows([]);
    if (sql.startsWith("insert into attendance(")) {
      if (state.attendance.some((item) => item.student_id === String(values[0]) && item.class_id === String(values[1]) && item.attendance_date === values[2])) throw pgError("23505");
      const row = { id: String(state.nextAttendanceId++), student_id: String(values[0]), class_id: String(values[1]), attendance_date: String(values[2]), status: String(values[3]) };
      state.attendance.push(row);
      return rows([{ id: row.id }]);
    }
    if (sql.startsWith("select a.id, a.student_id")) {
      const selected = sql.includes("order by a.attendance_date") ? state.attendance.slice(0, 200) : state.attendance.filter((item) => item.id === String(values[0]));
      return rows(selected.flatMap((attendance) => {
        const student = state.students.find((item) => item.id === attendance.student_id);
        return student ? [{ id: attendance.id, student_id: student.id, student_name: `${student.first_name} ${student.last_name}`, student_number: student.student_number, class_id: "1", class_name: "Grade 10", section: "A", attendance_date: attendance.attendance_date, status: attendance.status }] : [];
      }));
    }
    if (sql.startsWith("select count(*) filter (where a.status='present')")) {
      const present = state.attendance.filter((item) => item.status === "present").length;
      const absent = state.attendance.filter((item) => item.status === "absent").length;
      const late = state.attendance.filter((item) => item.status === "late").length;
      return rows([{ present, absent, late, total: state.attendance.length }]);
    }
    if (sql.startsWith("select class_id,max_score from examinations")) return String(values[0]) === "1" ? rows([{ class_id: "1", max_score: "100" }]) : rows([]);
    if (sql.startsWith("select count(*)::int as total from academic_results")) return rows([{ total: 450 }]);
    if (sql.startsWith("select r.id,r.student_id")) return rows([{ id: "1", student_id: "1", student_name: "Jordan Lee", student_number: "S-2026-001", examination_id: "1", title: "Term 1 Mathematics", class_name: "Grade 10", exam_date: "2026-10-08", score: "88", max_score: "100" }]);
    if (sql.startsWith("select f.id,f.student_id")) return rows([{ id: "1", student_id: "1", student_name: "Jordan Lee", student_number: "S-2026-001", description: "Term 1 tuition", academic_year: "2026-27", amount: "1000", due_date: "2026-11-15", amount_paid: "250", balance: "750", status: "partially paid" }]);
    if (sql.startsWith("select count(*)::int as total,") && sql.includes("from fee_records f")) return rows([{ total: 1, obligations: 1000, collected: 250, outstanding: 750 }]);
    if (sql.startsWith("select amount from fee_records")) return rows([{ amount: "1000" }]);
    if (sql.startsWith("select 1 from fee_records where id=$1 and student_id=$2")) return String(values[0]) === "1" && String(values[1]) === "1" ? rows([{ ok: 1 }]) : rows([]);
    if (sql.startsWith("select 1 from fee_records where id=$1")) return String(values[0]) === "1" ? rows([{ ok: 1 }]) : rows([]);
    if (sql.startsWith("select id,amount,paid_at,reference_code from fee_payments")) return rows([]);
    if (sql.startsWith("select coalesce(sum(amount),0)::text as total from fee_payments")) return rows([{ total: "250" }]);
    if (sql.startsWith("insert into fee_payments")) return rows([{ id: "1", paid_at: new Date() }]);
    if (sql.startsWith("select 1")) return rows([{ ok: 1 }]);
    throw new Error(`Unhandled fake query in test: ${sql}`);
  }

  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool = { query, connect: async () => client } as unknown as Pool;
  return { pool, state };
}
