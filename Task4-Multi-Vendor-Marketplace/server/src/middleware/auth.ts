import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from '../models/constants.js';
import { User, Vendor } from '../models/index.js';
import { forbidden, unauthorized } from '../utils/AppError.js';
import { parseId } from '../utils/validation.js';

export const AUTH_COOKIE = 'marketplace_token';

export type UserDoc = InstanceType<typeof User>;
export type VendorDoc = InstanceType<typeof Vendor>;

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
    vendor?: VendorDoc;
  }
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
});

export function setAuthCookie(res: Response, user: UserDoc): void {
  const token = jwt.sign({ role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    expiresIn: env.JWT_EXPIRES_IN_HOURS * 3600,
  });
  res.cookie(AUTH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: env.JWT_EXPIRES_IN_HOURS * 3_600_000,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, cookieOptions());
}

/** Verifies the cookie and reloads the user so role and status changes apply immediately. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || !token) throw unauthorized();

  let subject: unknown;
  try {
    subject = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }).sub;
  } catch {
    throw unauthorized('Session is invalid or has expired');
  }

  const user = await User.findById(parseId(subject, 'session'));
  if (!user) throw unauthorized('Session is invalid or has expired');
  if (user.status !== 'ACTIVE') throw forbidden('This account has been deactivated');
  req.user = user;
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Loads the signed-in vendor's own profile. Must run after requireRole('VENDOR'). */
export const loadVendor: RequestHandler = async (req, _res, next) => {
  const vendor = await Vendor.findOne({ userId: currentUser(req)._id });
  if (!vendor) throw forbidden('No vendor profile is linked to this account');
  req.vendor = vendor;
  next();
};

export const requireApprovedVendor: RequestHandler = (req, _res, next) => {
  if (currentVendor(req).approvalStatus !== 'APPROVED') {
    throw forbidden('Your store must be approved before it can manage products');
  }
  next();
};

export function currentUser(req: Request): UserDoc {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function currentVendor(req: Request): VendorDoc {
  if (!req.vendor) throw forbidden('No vendor profile is linked to this account');
  return req.vendor;
}
