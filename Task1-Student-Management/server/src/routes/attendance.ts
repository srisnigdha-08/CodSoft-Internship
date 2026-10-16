import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth, requireRole } from "../auth.js";
import { inTransaction } from "../database.js";
import { ApiError, requireDate, requirePositiveId } from "../errors.js";

interface AttendanceRow {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  class_id: string;
  class_name: string;
  section: string;
  attendance_date: string;
  status: "present" | "absent" | "late";
}

type AttendanceStatus = AttendanceRow["status"];

interface CorrectionRow {
  id: string;
  attendance_id: string;
  previous_status: AttendanceStatus;
  new_status: AttendanceStatus;
  corrected_by: string;
  corrected_at: Date;
}

const selectAttendance = `SELECT a.id, a.student_id, s.first_name || ' ' || s.last_name AS student_name,
  s.student_number, a.class_id, c.name AS class_name, c.section, a.attendance_date::text AS attendance_date, a.status
  FROM attendance a JOIN students s ON s.id = a.student_id JOIN classes c ON c.id = a.class_id`;

function presentAttendance(row: AttendanceRow) {
  return { id: Number(row.id), studentId: Number(row.student_id), studentName: row.student_name, studentNumber: row.student_number, classId: Number(row.class_id), className: row.class_name, section: row.section, date: String(row.attendance_date).slice(0, 10), status: row.status };
}

export function attendanceRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/", async (req, res) => {
    const filters: string[] = [];
    const values: Array<number | string> = [];
    const add = (sql: string, value: number | string) => { values.push(value); filters.push(sql.replace("?", `$${values.length}`)); };
    if (req.user?.role === "student") add("a.student_id = ?", req.user.studentId ?? -1);
    if (req.user?.role === "teacher") add("c.teacher_id = ?", req.user.teacherId ?? -1);
    if (typeof req.query.date === "string" && req.query.date) add("a.attendance_date = ?", requireDate(req.query.date, "Date"));
    if (typeof req.query.classId === "string" && req.query.classId) add("a.class_id = ?", requirePositiveId(req.query.classId, "Class ID"));
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role !== "student") add("a.student_id = ?", requirePositiveId(req.query.studentId, "Student ID"));
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await pool.query<AttendanceRow>(`${selectAttendance} ${where} ORDER BY a.attendance_date DESC, s.last_name, s.first_name LIMIT 200`, values);
    const totals = await pool.query<{ present: number; absent: number; late: number; total: number }>(
      `SELECT COUNT(*) FILTER (WHERE a.status='present')::int AS present,
              COUNT(*) FILTER (WHERE a.status='absent')::int AS absent,
              COUNT(*) FILTER (WHERE a.status='late')::int AS late,
              COUNT(*)::int AS total
       FROM attendance a JOIN classes c ON c.id=a.class_id ${where}`,
      values,
    );
    const { present = 0, absent = 0, late = 0, total = 0 } = totals.rows[0] ?? {};
    res.json({ data: result.rows.map(presentAttendance), meta: { summary: { present, absent, late }, total } });
  });

  router.post("/", requireRole("admin", "teacher"), async (req, res) => {
    const studentId = requirePositiveId(req.body?.studentId, "Student ID");
    const classId = requirePositiveId(req.body?.classId, "Class ID");
    const date = requireDate(req.body?.date, "Date");
    const status = req.body?.status;
    if (status !== "present" && status !== "absent" && status !== "late") throw new ApiError(400, "Status must be Present, Absent, or Late.", "VALIDATION_ERROR");

    const validStudent = await pool.query(
      "SELECT 1 FROM students WHERE id=$1 AND class_id=$2 AND status='active'",
      [studentId, classId],
    );
    if (!validStudent.rowCount) throw new ApiError(400, "The active student is not assigned to this class.", "VALIDATION_ERROR");
    if (req.user?.role === "teacher") {
      const assignment = await pool.query("SELECT 1 FROM classes WHERE id=$1 AND teacher_id=$2", [classId, req.user.teacherId ?? -1]);
      if (!assignment.rowCount) throw new ApiError(403, "You can only record attendance for your assigned classes.", "FORBIDDEN");
    }

    const result = await pool.query<{ id: string }>(
      "INSERT INTO attendance(student_id,class_id,attendance_date,status,recorded_by) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [studentId, classId, date, status, req.user?.id],
    ).catch((error: unknown) => {
      if (isUniqueViolation(error)) throw new ApiError(409, "Attendance has already been recorded for this student and class on that date.", "DUPLICATE_RECORD");
      throw error;
    });
    const row = await pool.query<AttendanceRow>(`${selectAttendance} WHERE a.id = $1`, [result.rows[0]?.id]);
    res.status(201).json({ data: row.rows[0] ? presentAttendance(row.rows[0]) : null });
  });

  router.get("/:id/corrections", requireRole("admin", "teacher"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Attendance ID");
    const record = await pool.query<{ teacher_id: string | null }>(
      "SELECT c.teacher_id FROM attendance a JOIN classes c ON c.id=a.class_id WHERE a.id=$1",
      [id],
    );
    if (!record.rows[0]) {
      throw new ApiError(req.user?.role === "teacher" ? 403 : 404, req.user?.role === "teacher" ? "You can only view corrections for your assigned classes." : "Attendance record was not found.", req.user?.role === "teacher" ? "FORBIDDEN" : "NOT_FOUND");
    }
    if (req.user?.role === "teacher" && Number(record.rows[0].teacher_id) !== req.user.teacherId) {
      throw new ApiError(403, "You can only view corrections for your assigned classes.", "FORBIDDEN");
    }
    // Repeat the teacher scope in the history query so a reassignment between
    // the existence check and this read cannot reveal another class's audit.
    const history = req.user?.role === "teacher"
      ? await pool.query<CorrectionRow>(
        `SELECT h.id,h.attendance_id,h.previous_status,h.new_status,h.corrected_by,h.corrected_at
         FROM attendance_corrections h JOIN attendance a ON a.id=h.attendance_id
         JOIN classes c ON c.id=a.class_id
         WHERE h.attendance_id=$1 AND c.teacher_id=$2 ORDER BY h.corrected_at DESC,h.id DESC`,
        [id, req.user.teacherId ?? -1],
      )
      : await pool.query<CorrectionRow>(
        `SELECT id,attendance_id,previous_status,new_status,corrected_by,corrected_at
         FROM attendance_corrections WHERE attendance_id=$1 ORDER BY corrected_at DESC,id DESC`,
        [id],
      );
    res.json({ data: history.rows.map((row) => ({
      id: Number(row.id), attendanceId: Number(row.attendance_id), previousStatus: row.previous_status,
      newStatus: row.new_status, correctedBy: Number(row.corrected_by), correctedAt: row.corrected_at,
    })) });
  });

  router.put("/:id", requireRole("admin", "teacher"), async (req, res) => {
    const id = requirePositiveId(req.params.id, "Attendance ID");
    const status = req.body?.status;
    if (status !== "present" && status !== "absent" && status !== "late") {
      throw new ApiError(400, "Status must be Present, Absent, or Late.", "VALIDATION_ERROR");
    }
    const corrected = await inTransaction(pool, async (client) => {
      // Lock the attendance and class rows until the status and audit insert
      // commit together. A class reassignment cannot race the teacher check.
      const existing = await client.query<{ status: AttendanceStatus; teacher_id: string | null }>(
        `SELECT a.status,c.teacher_id FROM attendance a JOIN classes c ON c.id=a.class_id
         WHERE a.id=$1 FOR UPDATE OF a,c`,
        [id],
      );
      const current = existing.rows[0];
      if (!current) {
        const teacher = req.user?.role === "teacher";
        throw new ApiError(teacher ? 403 : 404, teacher ? "You can only correct attendance for your assigned classes." : "Attendance record was not found.", teacher ? "FORBIDDEN" : "NOT_FOUND");
      }
      if (req.user?.role === "teacher" && Number(current.teacher_id) !== req.user.teacherId) {
        throw new ApiError(403, "You can only correct attendance for your assigned classes.", "FORBIDDEN");
      }
      if (current.status === status) {
        throw new ApiError(400, "Attendance already has that status.", "VALIDATION_ERROR");
      }
      await client.query("UPDATE attendance SET status=$1 WHERE id=$2", [status, id]);
      await client.query(
        "INSERT INTO attendance_corrections(attendance_id,previous_status,new_status,corrected_by) VALUES($1,$2,$3,$4)",
        [id, current.status, status, req.user?.id],
      );
      const row = await client.query<AttendanceRow>(`${selectAttendance} WHERE a.id=$1`, [id]);
      if (!row.rows[0]) throw new Error("Corrected attendance record could not be reloaded.");
      return presentAttendance(row.rows[0]);
    });
    res.json({ data: corrected });
  });

  return router;
}

function isUniqueViolation(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23505"; }
