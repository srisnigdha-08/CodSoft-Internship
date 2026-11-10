import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { assertAllowedFilename, decodeUploadName } from '../utils/resumeFile.js';

// Files stay in memory until their content has been verified; nothing unvalidated reaches disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxResumeBytes, files: 1, fields: 0 },
  fileFilter: (_req, file, callback) => {
    try {
      assertAllowedFilename(decodeUploadName(file.originalname));
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
});

export const resumeUpload: RequestHandler = upload.single('resume');
