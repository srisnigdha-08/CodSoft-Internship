import { Router } from "express";
import bcrypt from "bcryptjs";
import { activeSession, clearSessionCookie, createSessionCookie, requireAuth } from "../auth.js";
import { ApiError, requireEmail, requirePassword } from "../errors.js";
import { User } from "../models/index.js";

interface AuthOptions {
  secret: string;
  secureCookie: boolean;
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function authRouter({ secret, secureCookie }: AuthOptions): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const current = attempts.get(key);
    if (current && current.resetAt > Date.now() && current.count >= 10) {
      throw new ApiError(429, "Too many sign-in attempts. Please wait a few minutes and try again.", "RATE_LIMITED");
    }

    const email = requireEmail(req.body?.email);
    const password = requirePassword(req.body?.password);
    const account = await User.findOne({ email, status: "active" }).select("+passwordHash email role").lean();
    const session = account ? await activeSession(account) : null;
    const valid = account && session ? await bcrypt.compare(password, account.passwordHash) : false;
    if (!session || !valid) {
      const nextCount = current && current.resetAt > Date.now() ? current.count + 1 : 1;
      attempts.set(key, { count: nextCount, resetAt: Date.now() + 10 * 60_000 });
      throw new ApiError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
    }

    attempts.delete(key);
    res.setHeader("Set-Cookie", createSessionCookie(session, secret, secureCookie));
    res.json({ data: { user: session } });
  });

  router.post("/logout", (_req, res) => {
    res.setHeader("Set-Cookie", clearSessionCookie(secureCookie));
    res.json({ data: { message: "Signed out." } });
  });

  router.get("/me", requireAuth(secret), (req, res) => {
    res.json({ data: { user: req.user } });
  });

  return router;
}
