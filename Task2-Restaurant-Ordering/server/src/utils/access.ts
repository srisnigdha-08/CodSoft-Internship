import { Role } from '@prisma/client';
import { TokenPayload } from './jwt';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';

/**
 * Access rule shared by orders and payments.
 * - Staff (kitchen/admin) may access any record.
 * - Records linked to an account are visible to that account only.
 * - Guest records have no account, so the unguessable UUID is the only credential.
 *   Short reference numbers (ORD-..., PAY-...) are not accepted for them.
 */
export function assertRecordAccess(
  user: TokenPayload | undefined,
  ownerId: string | null,
  lookedUpByUuid: boolean
) {
  if (user && user.role !== Role.CUSTOMER) {
    return;
  }

  if (ownerId) {
    if (!user) {
      throw new UnauthorizedError('Authentication is required to access this record.');
    }
    if (ownerId !== user.userId) {
      throw new ForbiddenError('You do not have permission to access this record.');
    }
    return;
  }

  if (!lookedUpByUuid) {
    throw new NotFoundError('Record not found');
  }
}
