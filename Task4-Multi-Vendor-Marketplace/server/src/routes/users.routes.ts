import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentUser } from '../middleware/auth.js';
import { phoneSchema } from '../utils/validation.js';

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phoneSchema.optional(),
});

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me', (req, res) => {
  res.json({ user: currentUser(req).toJSON() });
});

// Only name and phone can change here; role and status are stripped by the schema.
usersRouter.patch('/me', async (req, res) => {
  const user = currentUser(req);
  user.set(updateProfileSchema.parse(req.body));
  await user.save();
  res.json({ user: user.toJSON() });
});
