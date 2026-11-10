import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/enums';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export function authorize(allowedRoles: Role | Role[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied. Allowed role(s): ${roles.join(', ')}.`));
    }

    next();
  };
}
