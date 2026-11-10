import type { Role } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { forbidden, unauthorized } from '../utils/apiError.js';
import { AUTH_COOKIE, clearAuthCookie, readToken } from '../utils/token.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

const authUserSelect = { id: true, email: true, name: true, role: true, isActive: true } as const;

/** The user is reloaded on each request so deactivation and role changes apply immediately. */
async function resolveSessionUser(req: Request): Promise<AuthUser | null> {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string') return null;
  const userId = readToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: authUserSelect });
  return user?.isActive ? user : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await resolveSessionUser(req);
  if (!user) {
    if (req.cookies?.[AUTH_COOKIE]) clearAuthCookie(res);
    throw unauthorized();
  }
  req.user = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  req.user = (await resolveSessionUser(req)) ?? undefined;
  next();
}

/** Must run after requireAuth. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
