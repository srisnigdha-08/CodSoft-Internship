import { Types } from 'mongoose';
import { Role } from '../models/enums';
import { TokenPayload } from './jwt';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';

/**
 * Access rule shared by orders and payments.
 * - Staff (kitchen/admin) may access any record.
 * - Records linked to an account are visible to that account only.
 * - Guest records have no account, so their random id is the only credential.
 *   Short reference numbers (ORD-..., PAY-...) are not accepted for them.
 */
export function assertRecordAccess(
  user: TokenPayload | undefined,
  ownerId: Types.ObjectId | string | null | undefined,
  lookedUpById: boolean
) {
  if (user && user.role !== Role.CUSTOMER) {
    return;
  }

  if (ownerId) {
    if (!user) {
      throw new UnauthorizedError('Authentication is required to access this record.');
    }
    if (String(ownerId) !== user.userId) {
      throw new ForbiddenError('You do not have permission to access this record.');
    }
    return;
  }

  if (!lookedUpById) {
    throw new NotFoundError('Record not found');
  }
}
