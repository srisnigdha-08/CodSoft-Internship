import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.dinedesk_token) {
      token = req.cookies.dinedesk_token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. Please login.');
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Invalid or expired token. Please login again.'));
    } else {
      next(err);
    }
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.dinedesk_token) {
      token = req.cookies.dinedesk_token;
    }

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }
    next();
  } catch {
    next();
  }
}
