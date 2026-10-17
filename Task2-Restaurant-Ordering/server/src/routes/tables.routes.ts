import { Router } from 'express';
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
} from '../controllers/tables.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', getTables);
router.post('/', authenticate, authorize(Role.ADMIN), createTable);
router.patch('/:id', authenticate, authorize(Role.ADMIN), updateTable);
router.delete('/:id', authenticate, authorize(Role.ADMIN), deleteTable);

export default router;
