import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth, requireRole } from "../auth.js";
import { ApiError, requirePositiveId, requireString } from "../errors.js";

interface ClassRow {
  id: string;
  name: string;
  section: string;
  teacher_id: string | null;
  teacher_name: string | null;
  student_count: string;
}

const classSelect = `SELECT c.id, c.name, c.section,
  CASE WHEN t.id IS NULL THEN NULL ELSE c.teacher_id END AS teacher_id,
  CASE WHEN t.id IS NULL THEN NULL ELSE t.first_name || ' ' || t.last_name END AS teacher_name,
  (SELECT COUNT(*)::text FROM students s WHERE s.class_id = c.id AND s.status = 'active') AS student_count
  FROM classes c LEFT JOIN teachers t ON t.id = c.teacher_id AND t.status = 'active'`;

function presentClass(row: ClassRow) {
  return { id: Number(row.id), name: row.name, section: row.section, teacherId: row.teacher_id ? Number(row.teacher_id) : null, teacherName: row.teacher_name, studentCount: Number(row.student_count) };
}

export function classesRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/", async (req, res) => {
    let filter = "";
    const values: number[] = [];
    if (req.user?.role === "teacher") {
      filter = "WHERE c.teacher_id = $1";
      values.push(req.user.teacherId ?? -1);
    } else if (req.user?.role === "student") {
      filter = "WHERE c.id = (SELECT s.class_id FROM students s WHERE s.id = $1 AND s.status = 'active')";
      values.push(req.user.studentId ?? -1);
    }
    const result = await pool.query<ClassRow>(`${classSelect} ${filter} ORDER BY c.name, c.section`, values);
    res.json({ data: result.rows.map(presentClass) });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const name = requireString(req.body?.name, "Class name", 80);
    const section = req.body?.section ? requireString(req.body.section, "Section", 40) : "A";
    const teacherId = req.body?.teacherId ? requirePositiveId(req.body.teacherId, "Teacher ID") : null;
    if (teacherId !== null) await assertActiveTeacher(pool, teacherId);
    const result = await pool.query<{ id: string }>("INSERT INTO classes(name, section, teacher_id) VALUES($1,$2,$3) RETURNING id", [name, section, teacherId]).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "That class and section already exist.", "DUPLICATE_RECORD");
      if (foreignKeyError(error)) throw new ApiError(400, "The selected teacher does not exist.", "VALIDATION_ERROR");
      throw error;
    });
    const row = await pool.query<ClassRow>(`${classSelect} WHERE c.id = $1`, [result.rows[0]?.id]);
    res.status(201).json({ data: row.rows[0] ? presentClass(row.rows[0]) : null });
  });

  router.put("/:id", requireRole("admin"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Class ID");
    const name = requireString(req.body?.name, "Class name", 80);
    const section = req.body?.section ? requireString(req.body.section, "Section", 40) : "A";
    const teacherId = req.body?.teacherId ? requirePositiveId(req.body.teacherId, "Teacher ID") : null;
    if (teacherId !== null) await assertActiveTeacher(pool, teacherId);
    const result = await pool.query("UPDATE classes SET name=$1, section=$2, teacher_id=$3 WHERE id=$4", [name, section, teacherId, id]).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "That class and section already exist.", "DUPLICATE_RECORD");
      if (foreignKeyError(error)) throw new ApiError(400, "The selected teacher does not exist.", "VALIDATION_ERROR");
      throw error;
    });
    if (!result.rowCount) throw new ApiError(404, "Class was not found.", "NOT_FOUND");
    const row = await pool.query<ClassRow>(`${classSelect} WHERE c.id = $1`, [id]);
    res.json({ data: row.rows[0] ? presentClass(row.rows[0]) : null });
  });

  return router;
}

async function assertActiveTeacher(pool: Pool, teacherId: number): Promise<void> {
  const teacher = await pool.query("SELECT 1 FROM teachers WHERE id=$1 AND status='active'", [teacherId]);
  if (!teacher.rowCount) throw new ApiError(400, "The selected teacher is not active.", "VALIDATION_ERROR");
}

function uniqueError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23505"; }
function foreignKeyError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23503"; }
