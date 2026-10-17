import { Router } from 'express';
import {
  checkAvailability,
  createReservation,
  getMyReservations,
  getAllReservations,
  updateReservationStatus,
} from '../controllers/reservations.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { Role } from '@prisma/client';

const router = Router();

router.get('/availability', checkAvailability);
router.post('/', optionalAuth, createReservation);
router.get('/my', optionalAuth, getMyReservations);
router.get('/', authenticate, authorize([Role.ADMIN, Role.KITCHEN_STAFF]), getAllReservations);
router.patch('/:id/status', authenticate, authorize([Role.ADMIN, Role.KITCHEN_STAFF]), updateReservationStatus);

export default router;
