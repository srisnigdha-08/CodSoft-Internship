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
  return value.trim();
}

function readPort(name: string, fallback: number): number {
  const raw = process.env[name]?.trim() || String(fallback);
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(name + " must be an integer from 1 to 65535.");
  }
  return port;
}

/** Reads the database name from a MongoDB URI. The URI itself is never echoed because it can contain credentials. */
export function databaseNameFromUri(uri: string, variableName: string): string {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/.exec(uri);
  if (!match?.[1]) {
    throw new Error(variableName + " must be a mongodb:// URI that names a database, for example mongodb://localhost:27017/codsoft_student_management.");
  }
  return decodeURIComponent(match[1]);
}

export function getMongoConfig() {
  const uri = requiredValue("MONGODB_URI");
  return { uri, databaseName: databaseNameFromUri(uri, "MONGODB_URI") };
}

export function getMongoTestConfig() {
  const uri = requiredValue("MONGODB_TEST_URI");
  return { uri, databaseName: databaseNameFromUri(uri, "MONGODB_TEST_URI") };
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
