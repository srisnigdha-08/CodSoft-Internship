import { Router } from "express";
import type { Types } from "mongoose";
import { currentStudentId, currentTeacherId, requireAuth, requireRole } from "../auth.js";
import { ApiError, conflictOnDuplicate, requireObjectId, requireString } from "../errors.js";
import { SchoolClass, Student, Teacher, type ClassDocument } from "../models/index.js";
import { NO_MATCH } from "../queryStages.js";

const DUPLICATE_MESSAGE = "That class and section already exist.";

type ClassRow = ClassDocument & { _id: Types.ObjectId; teacher?: { _id: Types.ObjectId; firstName: string; lastName: string }; studentCount: number };

function presentClass(row: ClassRow) {
  return {
    id: String(row._id), name: row.name, section: row.section,
    // An inactive teacher is shown as unassigned, as is a class with no teacher.
    teacherId: row.teacher ? String(row.teacher._id) : null,
    teacherName: row.teacher ? `${row.teacher.firstName} ${row.teacher.lastName}` : null,
    studentCount: row.studentCount,
  };
}

async function loadClasses(match: Record<string, unknown>): Promise<ClassRow[]> {
  return SchoolClass.aggregate<ClassRow>([
    { $match: match },
    { $sort: { name: 1, section: 1 } },
    { $lookup: { from: Teacher.collection.name, localField: "teacherId", foreignField: "_id", as: "teacher", pipeline: [{ $match: { status: "active" } }, { $project: { firstName: 1, lastName: 1 } }] } },
    { $unwind: { path: "$teacher", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: Student.collection.name, localField: "_id", foreignField: "classId", as: "activeStudents", pipeline: [{ $match: { status: "active" } }, { $project: { _id: 1 } }] } },
    { $addFields: { studentCount: { $size: "$activeStudents" } } },
    { $project: { activeStudents: 0 } },
  ]);
}

async function loadClass(id: Types.ObjectId) {
  const [row] = await loadClasses({ _id: id });
  return row ? presentClass(row) : null;
}

async function readBody(body: Record<string, unknown> | undefined) {
  const name = requireString(body?.name, "Class name", 80);
  const section = body?.section ? requireString(body.section, "Section", 40) : "A";
  const teacherId = body?.teacherId ? requireObjectId(body.teacherId, "Teacher ID") : null;
  if (teacherId && !(await Teacher.exists({ _id: teacherId, status: "active" }))) {
    throw new ApiError(400, "The selected teacher is not active.", "VALIDATION_ERROR");
  }
  return { name, section, teacherId };
}

export function classesRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/", async (req, res) => {
    let match: Record<string, unknown> = {};
    if (req.user?.role === "teacher") {
      match = { teacherId: currentTeacherId(req) };
    } else if (req.user?.role === "student") {
      const student = await Student.findOne({ _id: currentStudentId(req), status: "active" }).select("classId").lean();
      match = student?.classId ? { _id: student.classId } : NO_MATCH;
    }
    res.json({ data: (await loadClasses(match)).map(presentClass) });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const created = await SchoolClass.create(await readBody(req.body)).catch(conflictOnDuplicate(DUPLICATE_MESSAGE));
    res.status(201).json({ data: await loadClass(created._id) });
  });

  router.put("/:id", requireRole("admin"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Class ID");
    const result = await SchoolClass.updateOne({ _id: id }, { $set: await readBody(req.body) }, { runValidators: true })
      .catch(conflictOnDuplicate(DUPLICATE_MESSAGE));
    if (!result.matchedCount) throw new ApiError(404, "Class was not found.", "NOT_FOUND");
    res.json({ data: await loadClass(id) });
  });

  return router;
}
