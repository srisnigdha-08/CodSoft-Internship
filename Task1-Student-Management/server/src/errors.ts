import { Types } from "mongoose";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "REQUEST_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function assert(condition: unknown, status: number, message: string, code?: string): asserts condition {
  if (!condition) throw new ApiError(status, message, code);
}

export function requireString(value: unknown, field: string, maxLength = 160): string {
  assert(typeof value === "string", 400, `${field} is required.`, "VALIDATION_ERROR");
  const cleaned = value.trim();
  assert(cleaned.length > 0 && cleaned.length <= maxLength, 400, `${field} must be between 1 and ${maxLength} characters.`, "VALIDATION_ERROR");
  return cleaned;
}

export function requireEmail(value: unknown): string {
  const email = requireString(value, "Email", 254).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, "Enter a valid email address.", "VALIDATION_ERROR");
  return email;
}

export function requirePositiveInteger(value: unknown, field: string): number {
  assert(typeof value === "string" || typeof value === "number", 400, `${field} must be a positive integer.`, "VALIDATION_ERROR");
  const parsed = Number(value);
  assert(Number.isSafeInteger(parsed) && parsed > 0, 400, `${field} must be a positive integer.`, "VALIDATION_ERROR");
  return parsed;
}

/** Accepts only a 24-character hex string, so request objects can never become query operators. */
export function requireObjectId(value: unknown, field = "ID"): Types.ObjectId {
  assert(typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value), 400, `${field} is not a valid record ID.`, "VALIDATION_ERROR");
  return new Types.ObjectId(value);
}

export function requireDate(value: unknown, field: string): string {
  const date = requireString(value, field, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date, 400, `${field} must be a valid date in YYYY-MM-DD format.`, "VALIDATION_ERROR");
  return date;
}

export function requirePassword(value: unknown): string {
  assert(typeof value === "string" && value.length > 0 && value.length <= 200, 400, "Password is required.", "VALIDATION_ERROR");
  return value;
}

export function requireAmount(value: unknown, field: string): number {
  const amount = value;
  assert(typeof amount === "number" && Number.isFinite(amount) && amount > 0 && amount <= 99_999_999.99 && hasTwoDecimalPlaces(amount), 400, `${field} must be a positive amount up to 99999999.99 with at most two decimal places.`, "VALIDATION_ERROR");
  return amount;
}

export function hasTwoDecimalPlaces(value: number): boolean {
  return Math.round(value * 100) / 100 === value;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Escapes user text so a search is always a literal substring match. */
export function containsPattern(search: string): RegExp {
  return new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

export function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/** Use in `.catch()` to report a unique-index conflict as HTTP 409. */
export function conflictOnDuplicate(message: string) {
  return (error: unknown): never => {
    if (isDuplicateKey(error)) throw new ApiError(409, message, "DUPLICATE_RECORD");
    throw error;
  };
}
