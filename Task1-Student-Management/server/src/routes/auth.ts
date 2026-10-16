import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { clearSessionCookie, createSessionCookie, requireAuth, type SessionUser, type UserRole } from "../auth.js";
import { ApiError, requireEmail, requirePassword } from "../errors.js";

interface AuthOptions {
  pool: Pool;
  secret: string;
  secureCookie: boolean;
}

interface LoginRow {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  student_id: string | null;
  teacher_id: string | null;
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function authRouter({ pool, secret, secureCookie }: AuthOptions): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const current = attempts.get(key);
    if (current && current.resetAt > Date.now() && current.count >= 10) {
      throw new ApiError(429, "Too many sign-in attempts. Please wait a few minutes and try again.", "RATE_LIMITED");
    }

    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    const result = await pool.query<LoginRow>(
      `SELECT u.id, u.email, u.password_hash, u.role,
              s.id AS student_id, t.id AS teacher_id
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN teachers t ON t.user_id = u.id AND t.status = 'active'
       WHERE u.email = $1 AND (u.role = 'admin' OR (u.role = 'student' AND s.id IS NOT NULL) OR (u.role = 'teacher' AND t.id IS NOT NULL))`,
      [email],
    );

    const row = result.rows[0];
    const valid = row ? await bcrypt.compare(password, row.password_hash) : false;
    if (!row || !valid) {
      const nextCount = current && current.resetAt > Date.now() ? current.count + 1 : 1;
      attempts.set(key, { count: nextCount, resetAt: Date.now() + 10 * 60_000 });
      throw new ApiError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
    }

    attempts.delete(key);
    const user: SessionUser = {
      id: Number(row.id),
      email: row.email,
      role: row.role,
      ...(row.student_id ? { studentId: Number(row.student_id) } : {}),
      ...(row.teacher_id ? { teacherId: Number(row.teacher_id) } : {}),
    };
    res.setHeader("Set-Cookie", createSessionCookie(user, secret, secureCookie));
    res.json({ data: { user } });
  });

  router.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", clearSessionCookie(secureCookie));
    res.json({ data: { message: "Signed out." } });
  });

  router.get("/me", requireAuth(secret, pool), (req, res) => {
    res.json({ data: { user: req.user } });
  });

  return router;
}
