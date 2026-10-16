import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { requireAuth, requireRole } from "../auth.js";
import { inTransaction } from "../database.js";
import { ApiError, assert, requireDate, requireEmail, requirePassword, requirePositiveId, requireString } from "../errors.js";

interface StudentRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  student_number: string;
  class_id: string | null;
  class_name: string | null;
  section: string | null;
  date_of_birth: string | null;
  phone: string | null;
  address: string | null;
  status: "active" | "inactive";
  created_at: Date;
}

const baseSelect = `SELECT s.id, u.email, s.first_name, s.last_name, s.student_number,
  s.class_id, c.name AS class_name, c.section, s.date_of_birth::text AS date_of_birth, s.phone, s.address, s.status, s.created_at
  FROM students s JOIN users u ON u.id = s.user_id
  LEFT JOIN classes c ON c.id = s.class_id`;

function safeStudent(row: StudentRow) {
  return {
    id: Number(row.id), email: row.email, firstName: row.first_name, lastName: row.last_name,
    studentNumber: row.student_number, classId: row.class_id ? Number(row.class_id) : null,
    className: row.class_name, section: row.section, dateOfBirth: row.date_of_birth,
    phone: row.phone, address: row.address ?? null, status: row.status, createdAt: row.created_at,
  };
}

async function fetchStudent(pool: Pool, id: number): Promise<StudentRow> {
  const result = await pool.query<StudentRow>(`${baseSelect} WHERE s.id = $1`, [id]);
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "Student was not found.", "NOT_FOUND");
  return row;
}

async function assertTeacherCanSee(pool: Pool, teacherId: number | undefined, studentId: number): Promise<void> {
  const result = await pool.query(
    `SELECT 1 FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = $1 AND c.teacher_id = $2`,
    [studentId, teacherId ?? -1],
  );
  if (!result.rowCount) throw new ApiError(403, "This student is outside your assigned classes.", "FORBIDDEN");
}

export function studentsRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/", requireRole("admin", "teacher"), async (req, res) => {
    const page = req.query.page === undefined ? 1 : requirePositiveId(req.query.page, "Page");
    const limit = req.query.limit === undefined ? 10 : requirePositiveId(req.query.limit, "Limit");
    assert(page <= 1_000_000 && limit <= 50, 400, "Page must be at most 1000000 and limit at most 50.", "VALIDATION_ERROR");
    const offset = (page - 1) * limit;
    const filters: string[] = [];
    const values: Array<string | number> = [];
    const addFilter = (clause: string, value: string | number) => { values.push(value); filters.push(clause.replace("?", `$${values.length}`)); };

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      assert(search.length <= 160, 400, "Search must be at most 160 characters.", "VALIDATION_ERROR");
      values.push(`%${search}%`);
      filters.push(`(s.first_name ILIKE $${values.length} OR s.last_name ILIKE $${values.length} OR s.student_number ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
    }
    if (req.query.status === "active" || req.query.status === "inactive") addFilter("s.status = ?", String(req.query.status));
    if (typeof req.query.classId === "string" && req.query.classId) addFilter("s.class_id = ?", requirePositiveId(req.query.classId, "Class ID"));
    if (req.user?.role === "teacher") addFilter("c.teacher_id = ?", req.user.teacherId ?? -1);

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const count = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM students s JOIN users u ON u.id = s.user_id LEFT JOIN classes c ON c.id = s.class_id ${where}`,
      values,
    );
    const sortColumns: Record<string, string> = { createdAt: "s.created_at", name: "s.last_name", studentNumber: "s.student_number", class: "c.name" };
    const sortColumn = sortColumns[String(req.query.sortBy)] ?? "s.created_at";
    const sortDirection = req.query.sortOrder === "asc" ? "ASC" : "DESC";
    const result = await pool.query<StudentRow>(
      `${baseSelect} ${where} ORDER BY ${sortColumn} ${sortDirection}, s.id ${sortDirection} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    const total = Number(count.rows[0]?.total ?? 0);
    res.json({ data: result.rows.map(safeStudent), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    assert(password.length >= 10, 400, "Password must contain at least 10 characters.", "VALIDATION_ERROR");
    const firstName = requireString(req.body?.firstName, "First name", 80);
    const lastName = requireString(req.body?.lastName, "Last name", 80);
    const studentNumber = requireString(req.body?.studentNumber, "Student number", 40);
    const classId = req.body?.classId ? requirePositiveId(req.body.classId, "Class ID") : null;
    const dateOfBirth = req.body?.dateOfBirth ? requireDate(req.body.dateOfBirth, "Date of birth") : null;
    const phone = req.body?.phone ? requireString(req.body.phone, "Phone", 32) : null;
    const address = req.body?.address ? requireString(req.body.address, "Address", 255) : null;
    const passwordHash = await bcrypt.hash(password, 12);

    const id = await inTransaction(pool, async (client) => {
      const user = await client.query<{ id: string }>(
        "INSERT INTO users(email, password_hash, role) VALUES ($1, $2, 'student') RETURNING id",
        [email, passwordHash],
      );
      const student = await client.query<{ id: string }>(
        `INSERT INTO students(user_id, first_name, last_name, student_number, class_id, date_of_birth, phone, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [user.rows[0]?.id, firstName, lastName, studentNumber, classId, dateOfBirth, phone, address],
      );
      return Number(student.rows[0]?.id);
    }).catch((error: unknown) => {
      if (isUniqueViolation(error)) throw new ApiError(409, "That email or student number is already in use.", "DUPLICATE_RECORD");
      throw error;
    });

    res.status(201).json({ data: safeStudent(await fetchStudent(pool, id)) });
  });

  router.get("/:id", async (req, res) => {
    const id = requirePositiveId(req.params.id, "Student ID");
    if (req.user?.role === "student" && req.user.studentId !== id) {
      throw new ApiError(403, "You can only view your own student record.", "FORBIDDEN");
    }
    if (req.user?.role === "teacher") await assertTeacherCanSee(pool, req.user.teacherId, id);
    const row = await fetchStudent(pool, id);
    res.json({ data: safeStudent(row) });
  });

  router.put("/:id", requireRole("admin"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Student ID");
    const existing = await pool.query<{ user_id: string }>("SELECT user_id FROM students WHERE id = $1 AND status = 'active'", [id]);
    if (!existing.rows[0]) throw new ApiError(404, "Active student was not found.", "NOT_FOUND");

    const email = requireEmail(req.body?.email);
    const firstName = requireString(req.body?.firstName, "First name", 80);
    const lastName = requireString(req.body?.lastName, "Last name", 80);
    const studentNumber = requireString(req.body?.studentNumber, "Student number", 40);
    const classId = req.body?.classId ? requirePositiveId(req.body.classId, "Class ID") : null;
    const dateOfBirth = req.body?.dateOfBirth ? requireDate(req.body.dateOfBirth, "Date of birth") : null;
    const phone = req.body?.phone ? requireString(req.body.phone, "Phone", 32) : null;
    const address = req.body?.address ? requireString(req.body.address, "Address", 255) : null;

    await inTransaction(pool, async (client) => {
      await client.query("UPDATE users SET email = $1 WHERE id = $2", [email, existing.rows[0]?.user_id]);
      await client.query(
        `UPDATE students SET first_name = $1, last_name = $2, student_number = $3,
         class_id = $4, date_of_birth = $5, phone = $6, address = $7 WHERE id = $8`,
        [firstName, lastName, studentNumber, classId, dateOfBirth, phone, address, id],
      );
    }).catch((error: unknown) => {
      if (isUniqueViolation(error)) throw new ApiError(409, "That email or student number is already in use.", "DUPLICATE_RECORD");
      throw error;
    });
    res.json({ data: safeStudent(await fetchStudent(pool, id)) });
  });

  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Student ID");
    const result = await pool.query("UPDATE students SET status = 'inactive' WHERE id = $1 AND status = 'active'", [id]);
    if (!result.rowCount) throw new ApiError(404, "Active student was not found.", "NOT_FOUND");
    res.json({ data: { id, status: "inactive" } });
  });

  return router;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
