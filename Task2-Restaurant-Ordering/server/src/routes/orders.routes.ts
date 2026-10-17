import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
} from '../controllers/orders.controller';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuth, createOrder);
router.get('/my', optionalAuth, getMyOrders);
router.get('/:id', optionalAuth, getOrderById);
router.patch('/:id/cancel', optionalAuth, cancelOrder);

export default router;
