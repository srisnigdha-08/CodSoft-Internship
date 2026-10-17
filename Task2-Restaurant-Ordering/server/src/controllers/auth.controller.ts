import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../prisma';
import { signToken } from '../utils/jwt';
import { BadRequestError, UnauthorizedError, ConflictError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { Role } from '@prisma/client';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validated.password, salt);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        password: hashedPassword,
        phone: validated.phone || null,
        role: Role.CUSTOMER,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.cookie('dinedesk_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendCreated(res, { user, token }, 'Registration successful');
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(validated.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.cookie('dinedesk_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt,
    };

    return sendSuccess(res, { user: userProfile, token }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response) {
  res.clearCookie('dinedesk_token');
  return sendSuccess(res, null, 'Logged out successfully');
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Not authenticated');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    return sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}
