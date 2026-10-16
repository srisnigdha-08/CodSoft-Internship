import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Anchor configuration to the server package so scripts behave the same when
// started from the repository root, server/, or the compiled dist/ directory.
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const loaded = dotenv.config({ path: envPath, quiet: true });

if (loaded.error && (loaded.error as NodeJS.ErrnoException).code !== "ENOENT") {
  throw new Error("Could not read server/.env. Check that the file is readable.");
}

function requiredValue(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error("Missing required environment variable: " + name + ". Set it in server/.env or the process environment.");
  }
  return value;
}

function readPort(name: string, fallback: number): number {
  const raw = process.env[name]?.trim() || String(fallback);
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(name + " must be an integer from 1 to 65535.");
  }
  return port;
}

export function getDatabaseConfig() {
  return {
    host: requiredValue("DB_HOST"),
    port: readPort("DB_PORT", 5432),
    database: requiredValue("DB_NAME"),
    user: requiredValue("DB_USER"),
    password: requiredValue("DB_PASSWORD"),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  };
}

export function getServerConfig() {
  const jwtSecret = requiredValue("JWT_SECRET");
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }

  return {
    port: readPort("PORT", 5017),
    jwtSecret,
    frontendOrigin: process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:5173",
    secureCookie: process.env.NODE_ENV === "production",
  };
}
