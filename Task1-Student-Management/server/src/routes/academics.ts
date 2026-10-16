import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth, requireRole } from "../auth.js";
import { ApiError, assert, hasTwoDecimalPlaces, requireDate, requirePositiveId, requireString } from "../errors.js";

interface ExaminationRow {
  id: string;
  title: string;
  class_id: string;
  class_name: string;
  section: string;
  exam_date: string;
  max_score: string;
}

interface ResultRow {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  examination_id: string;
  title: string;
  class_name: string;
  exam_date: string;
  score: string;
  max_score: string;
}

const examsQuery = `SELECT e.id,e.title,e.class_id,c.name AS class_name,c.section,e.exam_date::text AS exam_date,e.max_score
  FROM examinations e JOIN classes c ON c.id=e.class_id`;
const resultsQuery = `SELECT r.id,r.student_id,s.first_name || ' ' || s.last_name AS student_name,s.student_number,
  e.id AS examination_id,e.title,c.name AS class_name,e.exam_date::text AS exam_date,r.score,e.max_score
  FROM academic_results r JOIN students s ON s.id=r.student_id
  JOIN examinations e ON e.id=r.examination_id JOIN classes c ON c.id=e.class_id`;

function presentExam(row: ExaminationRow) {
  return { id: Number(row.id), title: row.title, classId: Number(row.class_id), className: row.class_name, section: row.section, date: String(row.exam_date).slice(0, 10), maxScore: Number(row.max_score) };
}

function presentResult(row: ResultRow) {
  return { id: Number(row.id), studentId: Number(row.student_id), studentName: row.student_name, studentNumber: row.student_number, examinationId: Number(row.examination_id), examination: row.title, className: row.class_name, date: String(row.exam_date).slice(0, 10), score: Number(row.score), maxScore: Number(row.max_score) };
}

function uniqueError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23505"; }

export function academicsRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/examinations", async (req, res) => {
    const values: number[] = [];
    let where = "";
    if (req.user?.role === "teacher") {
      values.push(req.user.teacherId ?? -1);
      where = "WHERE c.teacher_id = $1";
    } else if (req.user?.role === "student") {
      values.push(req.user.studentId ?? -1);
      where = "WHERE e.class_id = (SELECT s.class_id FROM students s WHERE s.id = $1)";
    }
    const result = await pool.query<ExaminationRow>(`${examsQuery} ${where} ORDER BY e.exam_date DESC, e.title`, values);
    res.json({ data: result.rows.map(presentExam) });
  });

  router.post("/examinations", requireRole("admin", "teacher"), async (req, res) => {
    const title = requireString(req.body?.title, "Examination title", 120);
    const classId = requirePositiveId(req.body?.classId, "Class ID");
    const date = requireDate(req.body?.date, "Examination date");
    const maxScore: unknown = req.body?.maxScore;
    assert(typeof maxScore === "number" && Number.isFinite(maxScore) && maxScore > 0 && maxScore <= 99_999.99 && hasTwoDecimalPlaces(maxScore), 400, "Maximum score must be a positive number up to 99999.99 with at most two decimal places.", "VALIDATION_ERROR");
    if (req.user?.role === "teacher") await assertTeacherClass(pool, req.user.teacherId, classId);
    const result = await pool.query<{ id: string }>(
      "INSERT INTO examinations(title,class_id,exam_date,max_score,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [title, classId, date, maxScore, req.user?.id],
    ).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "An examination with that title already exists for the class and date.", "DUPLICATE_RECORD");
      if (foreignKeyError(error)) throw new ApiError(400, "The selected class does not exist.", "VALIDATION_ERROR");
      throw error;
    });
    const row = await pool.query<ExaminationRow>(`${examsQuery} WHERE e.id=$1`, [result.rows[0]?.id]);
    res.status(201).json({ data: row.rows[0] ? presentExam(row.rows[0]) : null });
  });

  router.get("/results", async (req, res) => {
    const page = req.query.page === undefined ? 1 : requirePositiveId(req.query.page, "Page");
    assert(page <= 1_000_000, 400, "Page must be at most 1000000.", "VALIDATION_ERROR");
    const limit = 50;
    const filters: string[] = [];
    const values: number[] = [];
    if (req.user?.role === "student") { values.push(req.user.studentId ?? -1); filters.push(`r.student_id=$${values.length}`); }
    if (req.user?.role === "teacher") { values.push(req.user.teacherId ?? -1); filters.push(`c.teacher_id=$${values.length}`); }
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role !== "student") { values.push(requirePositiveId(req.query.studentId, "Student ID")); filters.push(`r.student_id=$${values.length}`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const count = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM academic_results r
       JOIN examinations e ON e.id=r.examination_id JOIN classes c ON c.id=e.class_id ${where}`,
      values,
    );
    const result = await pool.query<ResultRow>(
      `${resultsQuery} ${where} ORDER BY e.exam_date DESC,s.last_name,s.first_name,r.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    );
    const total = Number(count.rows[0]?.total ?? 0);
    res.json({ data: result.rows.map(presentResult), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  });

  router.post("/results", requireRole("admin", "teacher"), async (req, res) => {
    const studentId = requirePositiveId(req.body?.studentId, "Student ID");
    const examId = requirePositiveId(req.body?.examinationId, "Examination ID");
    const score: unknown = req.body?.score;
    assert(typeof score === "number" && Number.isFinite(score) && score >= 0 && hasTwoDecimalPlaces(score), 400, "Score must be zero or greater with at most two decimal places.", "VALIDATION_ERROR");
    const exam = await pool.query<{ class_id: string; max_score: string }>("SELECT class_id,max_score FROM examinations WHERE id=$1", [examId]);
    if (!exam.rows[0]) throw new ApiError(404, "Examination was not found.", "NOT_FOUND");
    assert(score <= Number(exam.rows[0].max_score), 400, "Score cannot be greater than the examination maximum.", "VALIDATION_ERROR");
    const student = await pool.query("SELECT 1 FROM students WHERE id=$1 AND class_id=$2 AND status='active'", [studentId, exam.rows[0].class_id]);
    if (!student.rowCount) throw new ApiError(400, "The active student is not assigned to the examination class.", "VALIDATION_ERROR");
    if (req.user?.role === "teacher") await assertTeacherClass(pool, req.user.teacherId, Number(exam.rows[0].class_id));

    const result = await pool.query<{ id: string }>(
      "INSERT INTO academic_results(student_id,examination_id,score,recorded_by) VALUES($1,$2,$3,$4) RETURNING id",
      [studentId, examId, score, req.user?.id],
    ).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "A result is already recorded for this student and examination.", "DUPLICATE_RECORD");
      throw error;
    });
    const row = await pool.query<ResultRow>(`${resultsQuery} WHERE r.id=$1`, [result.rows[0]?.id]);
    res.status(201).json({ data: row.rows[0] ? presentResult(row.rows[0]) : null });
  });

  return router;
}

async function assertTeacherClass(pool: Pool, teacherId: number | undefined, classId: number): Promise<void> {
  const result = await pool.query("SELECT 1 FROM classes WHERE id=$1 AND teacher_id=$2", [classId, teacherId ?? -1]);
  if (!result.rowCount) throw new ApiError(403, "You can only manage academic records for your assigned classes.", "FORBIDDEN");
}

function foreignKeyError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23503"; }
