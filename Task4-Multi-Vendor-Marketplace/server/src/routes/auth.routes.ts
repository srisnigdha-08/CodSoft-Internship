import bcrypt from 'bcrypt';
import { Router, type Router as ExpressRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  authenticate,
  clearAuthCookie,
  currentUser,
  setAuthCookie,
  type UserDoc,
} from '../middleware/auth.js';
import { User, Vendor } from '../models/index.js';
import { AppError, forbidden, unauthorized } from '../utils/AppError.js';
import { runUnitOfWork } from '../utils/unitOfWork.js';
import { addressSchema, phoneSchema } from '../utils/validation.js';

const accountFields = {
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase().max(254),
  // bcrypt only reads the first 72 bytes, so longer passwords are rejected.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[a-z]/, 'Password needs a lowercase letter')
    .regex(/[A-Z]/, 'Password needs an uppercase letter')
    .regex(/[0-9]/, 'Password needs a digit'),
  phone: phoneSchema.optional(),
};

// ADMIN is deliberately absent: admin accounts cannot be self-registered.
const registerSchema = z.discriminatedUnion('accountType', [
  z.object({ accountType: z.literal('CUSTOMER'), ...accountFields }),
  z.object({
    accountType: z.literal('VENDOR'),
    ...accountFields,
    vendor: z.object({
      businessName: z.string().trim().min(2).max(100),
      description: z.string().trim().max(1000).default(''),
      contactEmail: z.email().trim().toLowerCase().optional(),
      phone: phoneSchema.optional(),
      address: addressSchema,
    }),
  }),
]);

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(200),
});

// Compared against for unknown emails so response time does not reveal which exist.
const dummyHash = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);

async function sessionPayload(user: UserDoc) {
  const vendor =
    user.role === 'VENDOR'
      ? await Vendor.findOne({ userId: user._id }).select('businessName approvalStatus').lean()
      : null;
  return { user: user.toJSON(), vendor };
}

export function authRoutes(rateLimitMax: number): ExpressRouter {
  const router = Router();
  const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')),
  });

  router.post('/register', credentialLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

    const user = await runUnitOfWork(async (uow) => {
      const [created] = await User.create(
        [{ name: input.name, email: input.email, phone: input.phone, passwordHash, role: input.accountType }],
        { session: uow.session },
      );
      uow.onRollback(() => User.deleteOne({ _id: created._id }));
      if (input.accountType === 'VENDOR') {
        await Vendor.create(
          [
            {
              userId: created._id,
              businessName: input.vendor.businessName,
              description: input.vendor.description,
              contactEmail: input.vendor.contactEmail ?? input.email,
              phone: input.vendor.phone ?? input.phone,
              address: input.vendor.address,
              approvalStatus: 'PENDING',
            },
          ],
          { session: uow.session },
        );
      }
      return created;
    });

    setAuthCookie(res, user);
    res.status(201).json(await sessionPayload(user));
  });

  router.post('/login', credentialLimiter, async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email }).select('+passwordHash');
    const matches = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
    if (!user || !matches) throw unauthorized('Incorrect email or password');
    if (user.status !== 'ACTIVE') throw forbidden('This account has been deactivated');

    setAuthCookie(res, user);
    res.json(await sessionPayload(user));
  });

  router.post('/logout', (_req, res) => {
    clearAuthCookie(res);
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req, res) => {
    res.json(await sessionPayload(currentUser(req)));
  });

  return router;
}
