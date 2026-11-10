import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { currentTeacherId, requireAuth, requireRole } from "../auth.js";
import { ApiError, conflictOnDuplicate, containsPattern, requireEmail, requireObjectId, requirePassword, requireString } from "../errors.js";
import { Teacher, User, type TeacherDocument } from "../models/index.js";

const DUPLICATE_MESSAGE = "That email or employee number is already in use.";

type TeacherRow = Omit<TeacherDocument, "userId"> & { _id: Types.ObjectId; userId: { _id: Types.ObjectId; email: string } };

function presentTeacher(row: TeacherRow) {
  return {
    id: String(row._id), email: row.userId.email, firstName: row.firstName, lastName: row.lastName,
    employeeNumber: row.employeeNumber, subject: row.subject, status: row.status, createdAt: row.createdAt,
  };
}

async function findTeacher(filter: Record<string, unknown>): Promise<TeacherRow | null> {
  return Teacher.findOne(filter).populate<{ userId: TeacherRow["userId"] }>("userId", "email").lean<TeacherRow>();
}

function readProfile(body: Record<string, unknown> | undefined) {
  return {
    email: requireEmail(body?.email),
    firstName: requireString(body?.firstName, "First name", 80),
    lastName: requireString(body?.lastName, "Last name", 80),
    employeeNumber: requireString(body?.employeeNumber, "Employee number", 40),
    subject: requireString(body?.subject, "Subject", 120),
  };
}

export function teachersRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/", requireRole("admin", "teacher"), async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter: Record<string, unknown> = { status: "active" };
    if (req.user?.role === "teacher") filter._id = currentTeacherId(req);
    if (search) {
      const pattern = containsPattern(search);
      filter.$or = [{ firstName: pattern }, { lastName: pattern }, { employeeNumber: pattern }, { subject: pattern }];
    }
    const rows = await Teacher.find(filter).sort({ lastName: 1, firstName: 1 }).limit(100)
      .populate<{ userId: TeacherRow["userId"] }>("userId", "email").lean<TeacherRow[]>();
    res.json({ data: rows.map(presentTeacher) });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const { email, ...fields } = readProfile(req.body);
    const password = requirePassword(req.body?.password);
    if (password.length < 10) throw new ApiError(400, "Password must contain at least 10 characters.", "VALIDATION_ERROR");
    const passwordHash = await bcrypt.hash(password, 12);

    // MongoDB here is standalone, so a failed profile removes the account it just created.
    const user = await User.create({ email, passwordHash, role: "teacher", name: `${fields.firstName} ${fields.lastName}` })
      .catch(conflictOnDuplicate(DUPLICATE_MESSAGE));
    let teacher;
    try {
      teacher = await Teacher.create({ ...fields, userId: user._id });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      return conflictOnDuplicate(DUPLICATE_MESSAGE)(error);
    }
    const row = await findTeacher({ _id: teacher._id });
    res.status(201).json({ data: row ? presentTeacher(row) : null });
  });

  router.get("/:id", requireRole("admin", "teacher"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Teacher ID");
    if (req.user?.role === "teacher" && !currentTeacherId(req).equals(id)) {
      throw new ApiError(403, "You can only view your own teacher profile.", "FORBIDDEN");
    }
    const row = await findTeacher({ _id: id, status: "active" });
    if (!row) throw new ApiError(404, "Teacher was not found.", "NOT_FOUND");
    res.json({ data: presentTeacher(row) });
  });

  router.put("/:id", requireRole("admin"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Teacher ID");
    const current = await Teacher.findOne({ _id: id, status: "active" }).select("userId").lean();
    if (!current) throw new ApiError(404, "Active teacher was not found.", "NOT_FOUND");
    const { email, ...fields } = readProfile(req.body);
    const account = await User.findById(current.userId).select("email name").lean();
    if (!account) throw new ApiError(404, "Active teacher was not found.", "NOT_FOUND");

    await User.updateOne({ _id: current.userId }, { $set: { email, name: `${fields.firstName} ${fields.lastName}` } }, { runValidators: true })
      .catch(conflictOnDuplicate(DUPLICATE_MESSAGE));
    try {
      await Teacher.updateOne({ _id: id }, { $set: fields }, { runValidators: true });
    } catch (error) {
      await User.updateOne({ _id: current.userId }, { $set: { email: account.email, name: account.name } });
      return conflictOnDuplicate(DUPLICATE_MESSAGE)(error);
    }
    const row = await findTeacher({ _id: id });
    res.json({ data: row ? presentTeacher(row) : null });
  });

  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const id = requireObjectId(req.params.id, "Teacher ID");
    const teacher = await Teacher.findOneAndUpdate({ _id: id, status: "active" }, { $set: { status: "inactive" } }).select("userId").lean();
    if (!teacher) throw new ApiError(404, "Active teacher was not found.", "NOT_FOUND");
    await User.updateOne({ _id: teacher.userId }, { $set: { status: "inactive" } });
    res.json({ data: { id: String(id), status: "inactive" } });
  });

  return router;
}
