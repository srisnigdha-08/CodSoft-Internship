import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { ApiError } from "./errors.js";
import { SchoolClass, Student, Teacher, User, type Role } from "./models/index.js";

export type UserRole = Role;

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
}

declare global {
  // Express request augmentation requires this global namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const SESSION_COOKIE = "sms_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

export function createSessionCookie(user: SessionUser, secret: string, secure: boolean): string {
  const token = jwt.sign(user, secret, { expiresIn: sessionMaxAgeSeconds, issuer: "student-management-api" });
  const flags = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, "HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${sessionMaxAgeSeconds}`];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const flags = [`${SESSION_COOKIE}=`, "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

/** Builds the session for an active account, or null when its role's profile is inactive or missing. */
export async function activeSession(user: { _id: Types.ObjectId; email: string; role: UserRole }): Promise<SessionUser | null> {
  const session: SessionUser = { id: String(user._id), email: user.email, role: user.role };
  if (user.role === "student") {
    const student = await Student.findOne({ userId: user._id, status: "active" }).select("_id").lean();
    return student ? { ...session, studentId: String(student._id) } : null;
  }
  if (user.role === "teacher") {
    const teacher = await Teacher.findOne({ userId: user._id, status: "active" }).select("_id").lean();
    return teacher ? { ...session, teacherId: String(teacher._id) } : null;
  }
  return session;
}

export function requireAuth(secret: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = readCookie(req, SESSION_COOKIE);
      if (!token) throw new ApiError(401, "Please sign in to continue.", "UNAUTHENTICATED");
      let payload: string | jwt.JwtPayload;
      try {
        payload = jwt.verify(token, secret, { issuer: "student-management-api" });
      } catch {
        throw new ApiError(401, "Your session has expired. Please sign in again.", "UNAUTHENTICATED");
      }
      if (typeof payload === "string" || !isSessionUser(payload)) {
        throw new ApiError(401, "Your session is invalid. Please sign in again.", "UNAUTHENTICATED");
      }
      // Check current account and profile state on each request so deactivation
      // or role changes take effect before the signed cookie expires.
      const current = await User.findOne({ _id: new Types.ObjectId(payload.id), email: payload.email, role: payload.role, status: "active" }).select("email role").lean();
      const session = current ? await activeSession(current) : null;
      if (!session) throw new ApiError(401, "Your account is inactive or your session has expired. Please sign in again.", "UNAUTHENTICATED");
      req.user = session;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function isSessionUser(value: jwt.JwtPayload): value is jwt.JwtPayload & SessionUser {
  return typeof value.id === "string" && /^[0-9a-f]{24}$/i.test(value.id) && typeof value.email === "string" &&
    (value.role === "admin" || value.role === "teacher" || value.role === "student");
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ApiError(403, "You do not have permission to perform this action.", "FORBIDDEN"));
      return;
    }
    next();
  };
}

// requireAuth guarantees these profile IDs for the matching role; the checks
// make a missing ID fail closed instead of widening a query.
export function currentUserId(req: Request): Types.ObjectId {
  if (!req.user) throw new ApiError(401, "Please sign in to continue.", "UNAUTHENTICATED");
  return new Types.ObjectId(req.user.id);
}

export function currentStudentId(req: Request): Types.ObjectId {
  if (!req.user?.studentId) throw new ApiError(403, "This account has no student profile.", "FORBIDDEN");
  return new Types.ObjectId(req.user.studentId);
}

export function currentTeacherId(req: Request): Types.ObjectId {
  if (!req.user?.teacherId) throw new ApiError(403, "This account has no teacher profile.", "FORBIDDEN");
  return new Types.ObjectId(req.user.teacherId);
}

/** The classes a teacher is assigned to; every teacher-scoped query starts here. */
export async function teacherClassIds(req: Request): Promise<Types.ObjectId[]> {
  return SchoolClass.find({ teacherId: currentTeacherId(req) }).distinct("_id");
}

export async function teacherOwnsClass(req: Request, classId: Types.ObjectId): Promise<boolean> {
  return (await SchoolClass.exists({ _id: classId, teacherId: currentTeacherId(req) })) !== null;
}
