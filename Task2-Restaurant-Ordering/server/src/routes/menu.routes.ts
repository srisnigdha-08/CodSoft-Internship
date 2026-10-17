import { Router } from 'express';
import {
  getMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from '../controllers/menu.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', getMenuItems);
router.get('/:id', getMenuItemById);
router.post('/', authenticate, authorize(Role.ADMIN), createMenuItem);
router.patch('/:id', authenticate, authorize(Role.ADMIN), updateMenuItem);
router.delete('/:id', authenticate, authorize(Role.ADMIN), deleteMenuItem);

export default router;
