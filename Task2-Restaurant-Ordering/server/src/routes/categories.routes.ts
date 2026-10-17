import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/menu.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', getCategories);
router.post('/', authenticate, authorize(Role.ADMIN), createCategory);
router.patch('/:id', authenticate, authorize(Role.ADMIN), updateCategory);
router.delete('/:id', authenticate, authorize(Role.ADMIN), deleteCategory);

export default router;
