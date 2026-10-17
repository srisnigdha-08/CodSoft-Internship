import { Router } from 'express';
import { getKitchenOrders, updateOrderStatus } from '../controllers/kitchen.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate, authorize([Role.KITCHEN_STAFF, Role.ADMIN]));

router.get('/orders', getKitchenOrders);
router.patch('/orders/:id/status', updateOrderStatus);

export default router;
