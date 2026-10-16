import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { requireAuth, requireRole } from "../auth.js";
import { inTransaction } from "../database.js";
import { ApiError, requireEmail, requirePassword, requirePositiveId, requireString } from "../errors.js";

interface TeacherRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  subject: string;
  status: "active" | "inactive";
  created_at: Date;
}

const selectTeachers = `SELECT t.id, u.email, t.first_name, t.last_name, t.employee_number,
  t.subject, t.status, t.created_at FROM teachers t JOIN users u ON u.id = t.user_id`;

function presentTeacher(row: TeacherRow) {
  return {
    id: Number(row.id), email: row.email, firstName: row.first_name, lastName: row.last_name,
    employeeNumber: row.employee_number, subject: row.subject, status: row.status, createdAt: row.created_at,
  };
}

function uniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export function teachersRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/", requireRole("admin", "teacher"), async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const values: Array<string | number> = [];
    const filters = ["t.status = 'active'"];
    if (req.user?.role === "teacher") {
      values.push(req.user.teacherId ?? -1);
      filters.push(`t.id = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      filters.push(`(t.first_name ILIKE $${values.length} OR t.last_name ILIKE $${values.length} OR t.employee_number ILIKE $${values.length} OR t.subject ILIKE $${values.length})`);
    }
    const result = await pool.query<TeacherRow>(`${selectTeachers} WHERE ${filters.join(" AND ")} ORDER BY t.last_name, t.first_name LIMIT 100`, values);
    res.json({ data: result.rows.map(presentTeacher) });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    if (password.length < 10) throw new ApiError(400, "Password must contain at least 10 characters.", "VALIDATION_ERROR");
    const firstName = requireString(req.body?.firstName, "First name", 80);
    const lastName = requireString(req.body?.lastName, "Last name", 80);
    const employeeNumber = requireString(req.body?.employeeNumber, "Employee number", 40);
    const subject = requireString(req.body?.subject, "Subject", 120);
    const passwordHash = await bcrypt.hash(password, 12);

    const id = await inTransaction(pool, async (client) => {
      const user = await client.query<{ id: string }>("INSERT INTO users(email, password_hash, role) VALUES ($1, $2, 'teacher') RETURNING id", [email, passwordHash]);
      const teacher = await client.query<{ id: string }>(
        `INSERT INTO teachers(user_id, first_name, last_name, employee_number, subject)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [user.rows[0]?.id, firstName, lastName, employeeNumber, subject],
      );
      return Number(teacher.rows[0]?.id);
    }).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "That email or employee number is already in use.", "DUPLICATE_RECORD");
      throw error;
    });
    const result = await pool.query<TeacherRow>(`${selectTeachers} WHERE t.id = $1`, [id]);
    res.status(201).json({ data: result.rows[0] ? presentTeacher(result.rows[0]) : null });
  });

  router.get("/:id", requireRole("admin", "teacher"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Teacher ID");
    if (req.user?.role === "teacher" && req.user.teacherId !== id) {
      throw new ApiError(403, "You can only view your own teacher profile.", "FORBIDDEN");
    }
    const result = await pool.query<TeacherRow>(`${selectTeachers} WHERE t.id = $1 AND t.status = 'active'`, [id]);
    if (!result.rows[0]) throw new ApiError(404, "Teacher was not found.", "NOT_FOUND");
    res.json({ data: presentTeacher(result.rows[0]) });
  });

  router.put("/:id", requireRole("admin"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Teacher ID");
    const current = await pool.query<{ user_id: string }>("SELECT user_id FROM teachers WHERE id = $1 AND status = 'active'", [id]);
    if (!current.rows[0]) throw new ApiError(404, "Active teacher was not found.", "NOT_FOUND");
    const email = requireEmail(req.body?.email);
    const firstName = requireString(req.body?.firstName, "First name", 80);
    const lastName = requireString(req.body?.lastName, "Last name", 80);
    const employeeNumber = requireString(req.body?.employeeNumber, "Employee number", 40);
    const subject = requireString(req.body?.subject, "Subject", 120);
    await inTransaction(pool, async (client) => {
      await client.query("UPDATE users SET email = $1 WHERE id = $2", [email, current.rows[0]?.user_id]);
      await client.query("UPDATE teachers SET first_name=$1, last_name=$2, employee_number=$3, subject=$4 WHERE id=$5", [firstName, lastName, employeeNumber, subject, id]);
    }).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "That email or employee number is already in use.", "DUPLICATE_RECORD");
      throw error;
    });
    const result = await pool.query<TeacherRow>(`${selectTeachers} WHERE t.id = $1`, [id]);
    res.json({ data: result.rows[0] ? presentTeacher(result.rows[0]) : null });
  });

  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Teacher ID");
    const result = await pool.query("UPDATE teachers SET status = 'inactive' WHERE id = $1 AND status = 'active'", [id]);
    if (!result.rowCount) throw new ApiError(404, "Active teacher was not found.", "NOT_FOUND");
    res.json({ data: { id, status: "inactive" } });
  });

  return router;
}
