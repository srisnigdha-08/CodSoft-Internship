type CodedFailure = {
  code?: unknown;
  message?: unknown;
};

const connectionCategories: Record<string, string> = {
  ECONNREFUSED: "connection refused; check that PostgreSQL is running and DB_HOST/DB_PORT are correct",
  ETIMEDOUT: "connection timed out; check PostgreSQL availability and DB_HOST/DB_PORT",
  ENOTFOUND: "database host could not be resolved; check DB_HOST",
  EAI_AGAIN: "database host lookup temporarily failed; retry after checking network settings",
  "28P01": "PostgreSQL authentication failed; check DB_USER and DB_PASSWORD",
  "3D000": "the configured database does not exist; check DB_NAME or create the database locally",
  "42501": "the configured database role lacks permission to apply the migration",
};

function safeMessage(message: string): string {
  let safe = message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection string redacted]")
    .replace(/\b(password|passwd|pwd)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1=[redacted]")
    .replace(/(?:DETAIL|CONTEXT|HINT):[\s\S]*$/i, "[database detail redacted]")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const secret of [process.env.DB_PASSWORD, process.env.JWT_SECRET]) {
    if (secret && secret.length >= 4) safe = safe.split(secret).join("[secret redacted]");
  }

  return safe.slice(0, 600);
}

export function formatMigrationFailure(error: unknown): string {
  const failure = (typeof error === "object" && error !== null ? error : {}) as CodedFailure;
  const code = typeof failure.code === "string" ? failure.code : "";
  const message = typeof failure.message === "string" ? failure.message : String(error);

  if (code === "APP_SCHEMA_INCOMPATIBLE" || (code === "P0001" && message.startsWith("Existing public.students table"))) {
    return "Database migration stopped: schema compatibility conflict. " + safeMessage(message);
  }

  if (connectionCategories[code]) {
    return "Database migration failed: " + connectionCategories[code] + " (code " + code + ").";
  }

  if (code.startsWith("23")) {
    return "Database migration failed: existing data or a constraint conflicts with the migration (code " + code + "). " + safeMessage(message);
  }

  if (code.startsWith("42")) {
    return "Database migration failed: SQL or schema compatibility error (code " + code + "). " + safeMessage(message);
  }

  const diagnostic = safeMessage(message);
  return "Database migration failed: unexpected database error" + (code ? " (code " + code + ")" : "") + (diagnostic ? ". Diagnostic: " + diagnostic : ".");
}
