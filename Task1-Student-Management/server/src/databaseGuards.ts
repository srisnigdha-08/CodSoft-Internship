export const APP_DATABASE = "codsoft_student_management";
export const TEST_DATABASE = "codsoft_student_management_test";

/** Only databases named for this project may receive seed or imported data. */
export function assertDedicatedDatabase(databaseName: string, action: string): void {
  if (databaseName !== APP_DATABASE && !databaseName.startsWith(`${APP_DATABASE}_`)) {
    throw new Error(`${action} refused: the target database is not a dedicated ${APP_DATABASE} database.`);
  }
}

export function assertSeedAllowed(nodeEnv: string | undefined, databaseName: string): void {
  if (nodeEnv === "production") throw new Error("The demo seed is disabled when NODE_ENV=production.");
  assertDedicatedDatabase(databaseName, "Seeding");
}

type CodedFailure = { code?: unknown; name?: unknown; message?: unknown };

/** Turns a driver failure into an actionable message without printing a connection string or host. */
export function formatDatabaseFailure(error: unknown, action: string): string {
  const failure = (typeof error === "object" && error !== null ? error : {}) as CodedFailure;
  const name = typeof failure.name === "string" ? failure.name : "";
  const message = typeof failure.message === "string" ? failure.message : String(error);
  if (name === "MongooseServerSelectionError" || name === "MongoServerSelectionError") {
    return `${action} failed: MongoDB could not be reached; check that the service is running and MONGODB_URI is correct.`;
  }
  if (failure.code === 18 || failure.code === 8000) {
    return `${action} failed: MongoDB authentication failed; check the credentials in MONGODB_URI.`;
  }
  if (failure.code === 11000) {
    return `${action} failed: existing data conflicts with a unique index (code 11000).`;
  }
  const safe = message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, "[connection string redacted]")
    .replace(/\b(password|passwd|pwd)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  return `${action} failed: ${safe}`;
}
