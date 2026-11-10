import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { conflict, forbidden, unauthorized } from '../utils/apiError.js';
import type { LoginInput, RegisterInput } from '../validation/auth.validation.js';

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

// Compared against when an email is unknown, so login timing does not reveal registered emails.
const dummyHash = bcrypt.hashSync('timing-equalisation-only', env.BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);

export async function registerUser(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);
  const profile =
    input.role === 'JOB_SEEKER'
      ? { jobSeekerProfile: { create: {} } }
      : { employerProfile: { create: {} } };
  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash,
        ...profile,
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('An account with this email already exists');
    }
    throw error;
  }
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true },
  });
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
  if (!user || !passwordMatches) {
    throw unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw forbidden('This account has been deactivated');
  }
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!(await bcrypt.compare(current, user.passwordHash))) {
    throw unauthorized('Current password is incorrect');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next) },
  });
}

export const updateAccountName = (userId: string, name: string) =>
  prisma.user.update({ where: { id: userId }, data: { name }, select: publicUserSelect });
