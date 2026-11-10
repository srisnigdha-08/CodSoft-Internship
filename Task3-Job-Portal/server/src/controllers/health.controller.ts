import type { Request, Response } from 'express';
import { prisma } from '../db/prisma.js';

export async function getHealth(_req: Request, res: Response) {
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
}
