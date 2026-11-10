import mongoose from 'mongoose';
import { detectTransactionSupport } from '../utils/unitOfWork.js';
import { resolveDatabaseUri } from './env.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(resolveDatabaseUri(), { serverSelectionTimeoutMS: 5000 });
  await detectTransactionSupport();
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function databaseStatus(): 'connected' | 'disconnected' {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected
    ? 'connected'
    : 'disconnected';
}
