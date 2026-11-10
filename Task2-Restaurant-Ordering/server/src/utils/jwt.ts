import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Role } from '../models/enums';
import { isObjectIdString } from './ids';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  // Tokens issued before the MongoDB migration carry ids that no longer exist
  if (!isObjectIdString(payload.userId)) {
    throw new jwt.JsonWebTokenError('Malformed user id');
  }
  return payload;
}
