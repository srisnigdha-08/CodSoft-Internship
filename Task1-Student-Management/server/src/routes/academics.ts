import { Router, type Request } from "express";
import type { Types } from "mongoose";
import { currentStudentId, currentUserId, requireAuth, requireRole, teacherClassIds, teacherOwnsClass } from "../auth.js";
import { dateFromDay, dayFromDate } from "../dates.js";
import { ApiError, assert, conflictOnDuplicate, hasTwoDecimalPlaces, requireDate, requireObjectId, requirePositiveInteger, requireString } from "../errors.js";
import { Exam, Result, SchoolClass, Student, type ExamDocument, type ResultDocument } from "../models/index.js";
import { allOf, joinClass, joinStudent, NO_MATCH } from "../queryStages.js";

type ExamRow = ExamDocument & { _id: Types.ObjectId; schoolClass: { name: string; section: string } };
type ResultRow = ResultDocument & {
  _id: Types.ObjectId;
  student: { firstName: string; lastName: string; studentNumber: string };
  exam: { title: string; date: Date; maxScore: number };
  schoolClass: { name: string };
};

const RESULTS_PER_PAGE = 50;

function presentExam(row: ExamRow) {
  return { id: String(row._id), title: row.title, classId: String(row.classId), className: row.schoolClass.name, section: row.schoolClass.section, date: dayFromDate(row.date), maxScore: row.maxScore };
}

function presentResult(row: ResultRow) {
  return {
    id: String(row._id), studentId: String(row.studentId), studentName: `${row.student.firstName} ${row.student.lastName}`,
    studentNumber: row.student.studentNumber, examinationId: String(row.examId), examination: row.exam.title,
    className: row.schoolClass.name, date: dayFromDate(row.exam.date), score: row.score, maxScore: row.exam.maxScore,
  };
}

const joinExam = [
  { $lookup: { from: Exam.collection.name, localField: "examId", foreignField: "_id", as: "exam", pipeline: [{ $project: { title: 1, date: 1, maxScore: 1, classId: 1 } }] } },
  { $unwind: "$exam" },
];
const joinExamClass = [
  { $lookup: { from: SchoolClass.collection.name, localField: "exam.classId", foreignField: "_id", as: "schoolClass", pipeline: [{ $project: { name: 1 } }] } },
  { $unwind: "$schoolClass" },
];

/** Exams visible to a teacher, shared by the results list and the dashboard. */
export async function teacherExamIds(req: Request): Promise<Types.ObjectId[]> {
  return Exam.find({ classId: { $in: await teacherClassIds(req) } }).distinct("_id");
}

async function assertTeacherClass(req: Request, classId: Types.ObjectId): Promise<void> {
  if (!(await teacherOwnsClass(req, classId))) throw new ApiError(403, "You can only manage academic records for your assigned classes.", "FORBIDDEN");
}

export function academicsRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/examinations", async (req, res) => {
    let match: Record<string, unknown> = {};
    if (req.user?.role === "teacher") {
      match = { classId: { $in: await teacherClassIds(req) } };
    } else if (req.user?.role === "student") {
      const student = await Student.findById(currentStudentId(req)).select("classId").lean();
      match = student?.classId ? { classId: student.classId } : NO_MATCH;
    }
    const rows = await Exam.aggregate<ExamRow>([{ $match: match }, { $sort: { date: -1, title: 1 } }, ...joinClass]);
    res.json({ data: rows.map(presentExam) });
  });

  router.post("/examinations", requireRole("admin", "teacher"), async (req, res) => {
    const title = requireString(req.body?.title, "Examination title", 120);
    const classId = requireObjectId(req.body?.classId, "Class ID");
    const date = requireDate(req.body?.date, "Examination date");
    const maxScore: unknown = req.body?.maxScore;
    assert(typeof maxScore === "number" && Number.isFinite(maxScore) && maxScore > 0 && maxScore <= 99_999.99 && hasTwoDecimalPlaces(maxScore), 400, "Maximum score must be a positive number up to 99999.99 with at most two decimal places.", "VALIDATION_ERROR");
    if (req.user?.role === "teacher") await assertTeacherClass(req, classId);
    if (!(await SchoolClass.exists({ _id: classId }))) throw new ApiError(400, "The selected class does not exist.", "VALIDATION_ERROR");
    const created = await Exam.create({ title, classId, date: dateFromDay(date), maxScore, createdBy: currentUserId(req) })
      .catch(conflictOnDuplicate("An examination with that title already exists for the class and date."));
    const [row] = await Exam.aggregate<ExamRow>([{ $match: { _id: created._id } }, ...joinClass]);
    res.status(201).json({ data: row ? presentExam(row) : null });
  });

  router.get("/results", async (req, res) => {
    const page = req.query.page === undefined ? 1 : requirePositiveInteger(req.query.page, "Page");
    assert(page <= 1_000_000, 400, "Page must be at most 1000000.", "VALIDATION_ERROR");
    const conditions: Array<Record<string, unknown>> = [];
    if (req.user?.role === "student") conditions.push({ studentId: currentStudentId(req) });
    if (req.user?.role === "teacher") conditions.push({ examId: { $in: await teacherExamIds(req) } });
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role !== "student") conditions.push({ studentId: requireObjectId(req.query.studentId, "Student ID") });

    const [result] = await Result.aggregate<{ total: Array<{ value: number }>; rows: ResultRow[] }>([
      { $match: allOf(conditions) },
      { $facet: {
        total: [{ $count: "value" }],
        rows: [
          ...joinExam,
          ...joinStudent,
          { $sort: { "exam.date": -1, "student.lastName": 1, "student.firstName": 1, _id: 1 } },
          { $skip: (page - 1) * RESULTS_PER_PAGE },
          { $limit: RESULTS_PER_PAGE },
          ...joinExamClass,
        ],
      } },
    ]);
    const total = result?.total[0]?.value ?? 0;
    res.json({ data: (result?.rows ?? []).map(presentResult), meta: { page, limit: RESULTS_PER_PAGE, total, pages: Math.ceil(total / RESULTS_PER_PAGE) } });
  });

  router.post("/results", requireRole("admin", "teacher"), async (req, res) => {
    const studentId = requireObjectId(req.body?.studentId, "Student ID");
    const examId = requireObjectId(req.body?.examinationId, "Examination ID");
    const score: unknown = req.body?.score;
    assert(typeof score === "number" && Number.isFinite(score) && score >= 0 && hasTwoDecimalPlaces(score), 400, "Score must be zero or greater with at most two decimal places.", "VALIDATION_ERROR");
    const exam = await Exam.findById(examId).select("classId maxScore").lean();
    if (!exam) throw new ApiError(404, "Examination was not found.", "NOT_FOUND");
    assert(score <= exam.maxScore, 400, "Score cannot be greater than the examination maximum.", "VALIDATION_ERROR");
    if (!(await Student.exists({ _id: studentId, classId: exam.classId, status: "active" }))) {
      throw new ApiError(400, "The active student is not assigned to the examination class.", "VALIDATION_ERROR");
    }
    if (req.user?.role === "teacher") await assertTeacherClass(req, exam.classId);

    const created = await Result.create({ studentId, examId, score, recordedBy: currentUserId(req) })
      .catch(conflictOnDuplicate("A result is already recorded for this student and examination."));
    const [row] = await Result.aggregate<ResultRow>([{ $match: { _id: created._id } }, ...joinExam, ...joinStudent, ...joinExamClass]);
    res.status(201).json({ data: row ? presentResult(row) : null });
  });

  return router;
}
