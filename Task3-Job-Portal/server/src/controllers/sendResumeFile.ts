import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import type { StoredResume } from '../services/resume.service.js';
import { notFound } from '../utils/apiError.js';

/** Streams a stored resume. Only PDFs may open in the browser; other types always download. */
export function sendResumeFile(req: Request, res: Response, resume: StoredResume): void {
  const storedName = path.basename(resume.storedName);
  if (!existsSync(path.join(env.uploadDir, storedName))) {
    throw notFound('The resume file is no longer available');
  }
  res.attachment(resume.originalName);
  res.type(resume.mimeType);
  if (req.query.view === '1' && resume.mimeType === 'application/pdf') {
    const disposition = res.get('Content-Disposition') ?? '';
    res.set('Content-Disposition', disposition.replace(/^attachment/, 'inline'));
  }
  res.sendFile(storedName, { root: env.uploadDir, dotfiles: 'deny' });
}
