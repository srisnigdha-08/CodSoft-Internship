import { Router } from 'express';
import { processPaymentCheckout, getPaymentById } from '../controllers/payments.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/checkout', optionalAuth, processPaymentCheckout);
router.get('/:id', optionalAuth, getPaymentById);

export default router;
