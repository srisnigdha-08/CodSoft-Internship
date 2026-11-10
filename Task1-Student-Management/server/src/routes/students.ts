import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import { Types, type PipelineStage } from "mongoose";
import { currentStudentId, requireAuth, requireRole, teacherClassIds } from "../auth.js";
import { dateFromDay, dayFromDate } from "../dates.js";
import { ApiError, assert, conflictOnDuplicate, containsPattern, requireDate, requireEmail, requireObjectId, requirePassword, requirePositiveInteger, requireString } from "../errors.js";
import { SchoolClass, Student, User, type StudentDocument } from "../models/index.js";
import { joinOptionalClass, joinUserEmail } from "../queryStages.js";

type StudentRow = StudentDocument & {
  _id: Types.ObjectId;
  user: { email: string };
  schoolClass?: { name: string; section: string };
};

const DUPLICATE_MESSAGE = "That email or student number is already in use.";
const SORT_FIELDS: Record<string, string> = { createdAt: "createdAt", name: "lastName", studentNumber: "studentNumber", class: "schoolClass.name" };

function safeStudent(row: StudentRow) {
  return {
    id: String(row._id), email: row.user.email, firstName: row.firstName, lastName: row.lastName,
    studentNumber: row.studentNumber, classId: row.classId ? String(row.classId) : null,
    className: row.schoolClass?.name ?? null, section: row.schoolClass?.section ?? null,
    dateOfBirth: row.dateOfBirth ? dayFromDate(row.dateOfBirth) : null,
    phone: row.phone, address: row.address ?? null, status: row.status, createdAt: row.createdAt,
  };
}

async function fetchStudent(id: Types.ObjectId): Promise<StudentRow> {
  const [row] = await Student.aggregate<StudentRow>([{ $match: { _id: id } }, ...joinUserEmail, ...joinOptionalClass]);
  if (!row) throw new ApiError(404, "Student was not found.", "NOT_FOUND");
  return row;
}

async function assertTeacherCanSee(req: Request, studentId: Types.ObjectId): Promise<void> {
  const visible = await Student.exists({ _id: studentId, classId: { $in: await teacherClassIds(req) } });
  if (!visible) throw new ApiError(403, "This student is outside your assigned classes.", "FORBIDDEN");
}

async function optionalClassId(value: unknown): Promise<Types.ObjectId | null> {
  if (!value) return null;
  const classId = requireObjectId(value, "Class ID");
  if (!(await SchoolClass.exists({ _id: classId }))) throw new ApiError(400, "The selected class does not exist.", "VALIDATION_ERROR");
  return classId;
}

function readProfile(body: Record<string, unknown> | undefined) {
  return {
    email: requireEmail(body?.email),
    firstName: requireString(body?.firstName, "First name", 80),
    lastName: requireString(body?.lastName, "Last name", 80),
    studentNumber: requireString(body?.studentNumber, "Student number", 40),
    dateOfBirth: body?.dateOfBirth ? dateFromDay(requireDate(body.dateOfBirth, "Date of birth")) : null,
    phone: body?.phone ? requireString(body.phone, "Phone", 32) : null,
    address: body?.address ? requireString(body.address, "Address", 255) : null,
  };
}

export function studentsRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/", requireRole("admin", "teacher"), async (req, res) => {
    const page = req.query.page === undefined ? 1 : requirePositiveInteger(req.query.page, "Page");
    const limit = req.query.limit === undefined ? 10 : requirePositiveInteger(req.query.limit, "Limit");
    assert(page <= 1_000_000 && limit <= 50, 400, "Page must be at most 1000000 and limit at most 50.", "VALIDATION_ERROR");

    const conditions: Array<Record<string, unknown>> = [];
    if (req.query.status === "active" || req.query.status === "inactive") conditions.push({ status: req.query.status });
    if (typeof req.query.classId === "string" && req.query.classId) conditions.push({ classId: requireObjectId(req.query.classId, "Class ID") });
    if (req.user?.role === "teacher") conditions.push({ classId: { $in: await teacherClassIds(req) } });

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    assert(search.length <= 160, 400, "Search must be at most 160 characters.", "VALIDATION_ERROR");
    const sortField = SORT_FIELDS[String(req.query.sortBy)] ?? "createdAt";
    const direction = req.query.sortOrder === "asc" ? 1 : -1;
    const sortsByClass = sortField === "schoolClass.name";

    // Join before the page cut only when a filter or sort needs the joined field.
    const pipeline: PipelineStage[] = [{ $match: conditions.length ? { $and: conditions } : {} }];
    if (search) {
      const pattern = containsPattern(search);
      pipeline.push(...joinUserEmail, { $match: { $or: [{ firstName: pattern }, { lastName: pattern }, { studentNumber: pattern }, { "user.email": pattern }] } });
    }
    if (sortsByClass) pipeline.push(...joinOptionalClass);
    pipeline.push({
      $facet: {
        total: [{ $count: "value" }],
        rows: [
          { $sort: { [sortField]: direction, _id: direction } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          ...(search ? [] : joinUserEmail),
          ...(sortsByClass ? [] : joinOptionalClass),
        ],
      },
    });

    const [result] = await Student.aggregate<{ total: Array<{ value: number }>; rows: StudentRow[] }>(pipeline);
    const total = result?.total[0]?.value ?? 0;
    res.json({ data: (result?.rows ?? []).map(safeStudent), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const profile = readProfile(req.body);
    const password = requirePassword(req.body?.password);
    assert(password.length >= 10, 400, "Password must contain at least 10 characters.", "VALIDATION_ERROR");
    const classId = await optionalClassId(req.body?.classId);
    const passwordHash = await bcrypt.hash(password, 12);
    const { email, ...fields } = profile;

    // MongoDB here is standalone, so a failed profile removes the account it just created.
    const user = await User.create({ email, passwordHash, role: "student", name: `${fields.firstName} ${fields.lastName}` })
      .catch(conflictOnDuplicate(DUPLICATE_MESSAGE));
    let student;
    try {
      student = await Student.create({ ...fields, userId: user._id, classId });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      return conflictOnDuplicate(DUPLICATE_MESSAGE)(error);
    }
    res.status(201).json({ data: safeStudent(await fetchStudent(student._id)) });
  });

  router.get("/:id", async (req, res) => {
    const id = requireObjectId(req.params.id, "Student ID");
    if (req.user?.role === "student" && !currentStudentId(req).equals(id)) {
      throw new ApiError(403, "You can only view your own student record.", "FORBIDDEN");
    }
    if (req.user?.role === "teacher") await assertTeacherCanSee(req, id);
    res.json({ data: safeStudent(await fetchStudent(id)) });
  });

  router.put("/:id", requireRole("admin"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Student ID");
    const existing = await Student.findOne({ _id: id, status: "active" }).select("userId").lean();
    if (!existing) throw new ApiError(404, "Active student was not found.", "NOT_FOUND");

    const { email, ...fields } = readProfile(req.body);
    const classId = await optionalClassId(req.body?.classId);
    const account = await User.findById(existing.userId).select("email name").lean();
    if (!account) throw new ApiError(404, "Active student was not found.", "NOT_FOUND");

    await User.updateOne({ _id: existing.userId }, { $set: { email, name: `${fields.firstName} ${fields.lastName}` } }, { runValidators: true })
      .catch(conflictOnDuplicate(DUPLICATE_MESSAGE));
    try {
      await Student.updateOne({ _id: id }, { $set: { ...fields, classId } }, { runValidators: true });
    } catch (error) {
      await User.updateOne({ _id: existing.userId }, { $set: { email: account.email, name: account.name } });
      return conflictOnDuplicate(DUPLICATE_MESSAGE)(error);
    }
    res.json({ data: safeStudent(await fetchStudent(id)) });
  });

  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Student ID");
    const student = await Student.findOneAndUpdate({ _id: id, status: "active" }, { $set: { status: "inactive" } }).select("userId").lean();
    if (!student) throw new ApiError(404, "Active student was not found.", "NOT_FOUND");
    await User.updateOne({ _id: student.userId }, { $set: { status: "inactive" } });
    res.json({ data: { id: String(id), status: "inactive" } });
  });

  return router;
}
