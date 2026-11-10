import { randomBytes } from 'crypto';
import { Types } from 'mongoose';

/** API documents expose `id` as a string and never expose internal fields. */
export const toJSONOptions = {
  virtuals: true,
  versionKey: false,
  transform(_doc: unknown, ret: Record<string, any>) {
    delete ret._id;
    delete ret.passwordHash;
    delete ret.holdsSlot;
    return ret;
  },
};

/**
 * A guest order is reachable only through its id, which acts as a private link.
 * Standard ObjectIds embed a timestamp and a counter and can be guessed from a neighbouring id,
 * so orders and payments use 96 random bits instead.
 */
export function randomObjectId(): Types.ObjectId {
  return new Types.ObjectId(randomBytes(12));
}
