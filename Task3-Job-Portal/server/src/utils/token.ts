import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE = 'jp_session';

const ALGORITHM = 'HS256';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.isProduction,
  path: '/',
};

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: ALGORITHM,
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN_HOURS * 3600,
  });
}

/** Returns the user id stored in a valid token, or null for any invalid token. */
export function readToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, userId: string): void {
  res.cookie(AUTH_COOKIE, signToken(userId), {
    ...baseCookieOptions,
    maxAge: env.JWT_EXPIRES_IN_HOURS * 3_600_000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, baseCookieOptions);
}
