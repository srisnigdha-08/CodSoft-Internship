import { Router } from "express";
import type { Types } from "mongoose";
import { currentStudentId, currentUserId, requireAuth, requireRole, teacherClassIds, teacherOwnsClass } from "../auth.js";
import { dateFromDay, dayFromDate } from "../dates.js";
import { ApiError, conflictOnDuplicate, requireDate, requireObjectId } from "../errors.js";
import { Attendance, Student, type AttendanceDocument, type AttendanceStatus } from "../models/index.js";
import { allOf, joinClass, joinStudent } from "../queryStages.js";

type AttendanceRow = AttendanceDocument & {
  _id: Types.ObjectId;
  student: { firstName: string; lastName: string; studentNumber: string };
  schoolClass: { name: string; section: string };
};

const DISPLAY_LIMIT = 200;

function presentAttendance(row: AttendanceRow) {
  return {
    id: String(row._id), studentId: String(row.studentId), studentName: `${row.student.firstName} ${row.student.lastName}`,
    studentNumber: row.student.studentNumber, classId: String(row.classId), className: row.schoolClass.name,
    section: row.schoolClass.section, date: dayFromDate(row.date), status: row.status,
  };
}

async function loadAttendance(id: Types.ObjectId) {
  const [row] = await Attendance.aggregate<AttendanceRow>([{ $match: { _id: id } }, ...joinStudent, ...joinClass]);
  return row ? presentAttendance(row) : null;
}

function readStatus(value: unknown): AttendanceStatus {
  if (value !== "present" && value !== "absent" && value !== "late") throw new ApiError(400, "Status must be Present, Absent, or Late.", "VALIDATION_ERROR");
  return value;
}

export function attendanceRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/", async (req, res) => {
    const conditions: Array<Record<string, unknown>> = [];
    if (req.user?.role === "student") conditions.push({ studentId: currentStudentId(req) });
    if (req.user?.role === "teacher") conditions.push({ classId: { $in: await teacherClassIds(req) } });
    if (typeof req.query.date === "string" && req.query.date) conditions.push({ date: dateFromDay(requireDate(req.query.date, "Date")) });
    if (typeof req.query.classId === "string" && req.query.classId) conditions.push({ classId: requireObjectId(req.query.classId, "Class ID") });
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role !== "student") conditions.push({ studentId: requireObjectId(req.query.studentId, "Student ID") });
    const match = allOf(conditions);

    // The displayed rows sort by student name, which needs a join. Finding the
    // date of the last displayed row first keeps that join to the rows near it.
    const [boundary] = await Attendance.find(match).sort({ date: -1 }).skip(DISPLAY_LIMIT - 1).limit(1).select("date").lean();
    const [rows, totals] = await Promise.all([
      Attendance.aggregate<AttendanceRow>([
        { $match: boundary ? { $and: [match, { date: { $gte: boundary.date } }] } : match },
        ...joinStudent,
        { $sort: { date: -1, "student.lastName": 1, "student.firstName": 1, _id: 1 } },
        { $limit: DISPLAY_LIMIT },
        ...joinClass,
      ]),
      Attendance.aggregate<{ present: number; absent: number; late: number; total: number }>([
        { $match: match },
        { $group: {
          _id: null,
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          total: { $sum: 1 },
        } },
      ]),
    ]);
    const { present = 0, absent = 0, late = 0, total = 0 } = totals[0] ?? {};
    res.json({ data: rows.map(presentAttendance), meta: { summary: { present, absent, late }, total } });
  });

  router.post("/", requireRole("admin", "teacher"), async (req, res) => {
    const studentId = requireObjectId(req.body?.studentId, "Student ID");
    const classId = requireObjectId(req.body?.classId, "Class ID");
    const date = requireDate(req.body?.date, "Date");
    const status = readStatus(req.body?.status);

    if (!(await Student.exists({ _id: studentId, classId, status: "active" }))) {
      throw new ApiError(400, "The active student is not assigned to this class.", "VALIDATION_ERROR");
    }
    if (req.user?.role === "teacher" && !(await teacherOwnsClass(req, classId))) {
      throw new ApiError(403, "You can only record attendance for your assigned classes.", "FORBIDDEN");
    }

    const created = await Attendance.create({ studentId, classId, date: dateFromDay(date), status, recordedBy: currentUserId(req) })
      .catch(conflictOnDuplicate("Attendance has already been recorded for this student and class on that date."));
    res.status(201).json({ data: await loadAttendance(created._id) });
  });

  router.get("/:id/corrections", requireRole("admin", "teacher"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Attendance ID");
    const teacher = req.user?.role === "teacher";
    const record = await Attendance.findById(id).select("classId corrections").lean();
    if (!record) {
      throw new ApiError(teacher ? 403 : 404, teacher ? "You can only view corrections for your assigned classes." : "Attendance record was not found.", teacher ? "FORBIDDEN" : "NOT_FOUND");
    }
    if (teacher && !(await teacherOwnsClass(req, record.classId))) {
      throw new ApiError(403, "You can only view corrections for your assigned classes.", "FORBIDDEN");
    }
    const history = [...record.corrections].sort((a, b) => b.correctedAt.getTime() - a.correctedAt.getTime());
    res.json({ data: history.map((item) => ({
      id: String(item._id), attendanceId: String(id), previousStatus: item.previousStatus,
      newStatus: item.newStatus, correctedBy: String(item.correctedBy), correctedAt: item.correctedAt,
    })) });
  });

  router.put("/:id", requireRole("admin", "teacher"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Attendance ID");
    const status = readStatus(req.body?.status);
    const teacher = req.user?.role === "teacher";
    const current = await Attendance.findById(id).select("status classId").lean();
    if (!current) {
      throw new ApiError(teacher ? 403 : 404, teacher ? "You can only correct attendance for your assigned classes." : "Attendance record was not found.", teacher ? "FORBIDDEN" : "NOT_FOUND");
    }
    if (teacher && !(await teacherOwnsClass(req, current.classId))) {
      throw new ApiError(403, "You can only correct attendance for your assigned classes.", "FORBIDDEN");
    }
    if (current.status === status) throw new ApiError(400, "Attendance already has that status.", "VALIDATION_ERROR");

    // One atomic document update writes the status and its audit entry together.
    // Matching on the previous status makes a concurrent correction lose cleanly.
    const updated = await Attendance.updateOne(
      { _id: id, status: current.status },
      { $set: { status }, $push: { corrections: { previousStatus: current.status, newStatus: status, correctedBy: currentUserId(req), correctedAt: new Date() } } },
      { runValidators: true },
    );
    if (!updated.modifiedCount) throw new ApiError(409, "This attendance record was just changed by someone else. Reload and try again.", "CONFLICT");
    res.json({ data: await loadAttendance(id) });
  });

  return router;
}
