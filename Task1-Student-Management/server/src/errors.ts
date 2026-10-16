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

export function requirePositiveId(value: unknown, field = "ID"): number {
  assert(typeof value === "string" || typeof value === "number", 400, `${field} must be a positive integer.`, "VALIDATION_ERROR");
  const id = Number(value);
  assert(Number.isSafeInteger(id) && id > 0, 400, `${field} must be a positive integer.`, "VALIDATION_ERROR");
  return id;
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

export function emailConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}
