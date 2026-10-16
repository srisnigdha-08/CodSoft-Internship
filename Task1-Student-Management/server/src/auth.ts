import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import jwt from "jsonwebtoken";
import { ApiError } from "./errors.js";

export type UserRole = "admin" | "teacher" | "student";

export interface SessionUser {
  id: number;
  email: string;
  role: UserRole;
  studentId?: number;
  teacherId?: number;
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

export function requireAuth(secret: string, pool: Pool) {
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
      const current = await pool.query<{ id: string; email: string; role: UserRole; student_id: string | null; teacher_id: string | null }>(
        `SELECT u.id,u.email,u.role,s.id AS student_id,t.id AS teacher_id
         FROM users u
         LEFT JOIN students s ON s.user_id=u.id AND s.status='active'
         LEFT JOIN teachers t ON t.user_id=u.id AND t.status='active'
         WHERE u.id=$1 AND u.email=$2 AND u.role=$3
           AND (u.role='admin' OR (u.role='student' AND s.id IS NOT NULL) OR (u.role='teacher' AND t.id IS NOT NULL))`,
        [payload.id, payload.email, payload.role],
      );
      const row = current.rows[0];
      if (!row) throw new ApiError(401, "Your account is inactive or your session has expired. Please sign in again.", "UNAUTHENTICATED");
      req.user = {
        id: Number(row.id), email: row.email, role: row.role,
        ...(row.student_id ? { studentId: Number(row.student_id) } : {}),
        ...(row.teacher_id ? { teacherId: Number(row.teacher_id) } : {}),
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

function isSessionUser(value: jwt.JwtPayload): value is jwt.JwtPayload & SessionUser {
  return Number.isSafeInteger(value.id) && typeof value.email === "string" &&
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
