import path from 'node:path';
import { unprocessable } from './apiError.js';

const ALLOWED_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;

type AllowedExtension = keyof typeof ALLOWED_TYPES;

const MAX_FILENAME_LENGTH = 255;
const PDF_SIGNATURE = Buffer.from('%PDF-');
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const isAllowedExtension = (value: string): value is AllowedExtension => value in ALLOWED_TYPES;

function contentMatchesExtension(buffer: Buffer, extension: AllowedExtension): boolean {
  switch (extension) {
    case '.pdf':
      return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
    case '.doc':
      return buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE);
    case '.docx':
      // A DOCX is a zip archive; the Word part distinguishes it from any other zip.
      return (
        buffer.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE) &&
        buffer.includes('word/document.xml')
      );
  }
}

/** Multer provides multipart filenames as latin1 even when the browser sent UTF-8. */
export const decodeUploadName = (name: string) => Buffer.from(name, 'latin1').toString('utf8');

/** Removes any path component and control characters from a client-supplied filename. */
export function sanitizeFilename(rawName: string): string {
  const baseName = path.posix.basename(rawName.replace(/\\/g, '/'));
  // eslint-disable-next-line no-control-regex
  return baseName.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
}

export function assertAllowedFilename(rawName: string): {
  name: string;
  extension: AllowedExtension;
} {
  const name = sanitizeFilename(rawName);
  const extension = path.extname(name).toLowerCase();
  if (!name || name.startsWith('.') || name.length > MAX_FILENAME_LENGTH) {
    throw unprocessable('The file name is not valid');
  }
  if (!isAllowedExtension(extension)) {
    throw unprocessable('Only PDF, DOC and DOCX files are allowed');
  }
  return { name, extension };
}

export interface ValidatedResume {
  originalName: string;
  extension: AllowedExtension;
  mimeType: string;
}

/** Verifies name, declared MIME type and actual file content before anything is stored. */
export function validateResumeFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): ValidatedResume {
  const { name, extension } = assertAllowedFilename(decodeUploadName(file.originalname));
  if (file.size === 0) {
    throw unprocessable('The uploaded file is empty');
  }
  const mimeType = ALLOWED_TYPES[extension];
  if (file.mimetype !== mimeType) {
    throw unprocessable('The file type does not match its extension');
  }
  if (!contentMatchesExtension(file.buffer, extension)) {
    throw unprocessable('The file content does not match its extension');
  }
  return { originalName: name, extension, mimeType };
}
