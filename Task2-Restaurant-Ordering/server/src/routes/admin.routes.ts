import { Router } from 'express';
import {
  getAdminStats,
  getAdminOrders,
  getAdminUsers,
  updateUserRole,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate, authorize(Role.ADMIN));

router.get('/stats', getAdminStats);
router.get('/orders', getAdminOrders);
router.get('/users', getAdminUsers);
router.patch('/users/:id/role', updateUserRole);

export default router;
