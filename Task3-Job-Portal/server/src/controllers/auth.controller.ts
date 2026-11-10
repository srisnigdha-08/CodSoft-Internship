import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authenticate.js';
import * as authService from '../services/auth.service.js';
import { sendCreated, sendMessage, sendOk } from '../utils/http.js';
import { clearAuthCookie, setAuthCookie } from '../utils/token.js';
import { loginSchema, registerSchema } from '../validation/auth.validation.js';
import { changePasswordSchema, updateAccountSchema } from '../validation/profile.validation.js';

export async function register(req: Request, res: Response) {
  const user = await authService.registerUser(registerSchema.parse(req.body));
  setAuthCookie(res, user.id);
  sendCreated(res, user);
}

export async function login(req: Request, res: Response) {
  const user = await authService.authenticateUser(loginSchema.parse(req.body));
  setAuthCookie(res, user.id);
  sendOk(res, user);
}

export function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  sendMessage(res, 'Signed out');
}

export function me(req: Request, res: Response) {
  sendOk(res, currentUser(req));
}

export async function updateAccount(req: Request, res: Response) {
  const { name } = updateAccountSchema.parse(req.body);
  sendOk(res, await authService.updateAccountName(currentUser(req).id, name));
}

export async function changePassword(req: Request, res: Response) {
  const input = changePasswordSchema.parse(req.body);
  await authService.changePassword(currentUser(req).id, input.currentPassword, input.newPassword);
  sendMessage(res, 'Password updated');
}
