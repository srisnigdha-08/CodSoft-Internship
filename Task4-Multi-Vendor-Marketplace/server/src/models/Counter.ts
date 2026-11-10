import { model, Schema } from 'mongoose';

// Atomic sequence for human-readable order numbers (MKT-1001, MKT-1002, ...).
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true },
  },
  { versionKey: false },
);

export const Counter = model('Counter', counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).orFail();
  return counter.seq;
}
