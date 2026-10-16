import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { formatMigrationFailure } from "./migrationDiagnostics.js";

const requiredStudentColumns = ["id", "user_id", "first_name", "last_name", "student_number", "class_id", "status", "created_at"];
const expectedStudentTypes: Record<string, string> = {
  id: "bigint",
  user_id: "bigint",
  first_name: "character varying",
  last_name: "character varying",
  student_number: "character varying",
  class_id: "bigint",
  status: "character varying",
  created_at: "timestamp with time zone",
};
const applicationStudentInsertColumns = new Set([
  "user_id",
  "first_name",
  "last_name",
  "student_number",
  "class_id",
  "date_of_birth",
  "phone",
]);

interface StudentColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_identity: string;
  is_generated: string;
}

class MigrationCompatibilityError extends Error {
  readonly code = "APP_SCHEMA_INCOMPATIBLE";
}

async function checkExistingStudentSchema(pendingMigrations: string[]): Promise<void> {
  if (!pendingMigrations.includes("001_initial_schema.sql")) return;

  const tableExists = (await pool.query<{ present: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    ["public.students"],
  )).rows[0]?.present;
  if (!tableExists) return;

  const result = await pool.query<StudentColumn>(
    `SELECT column_name, data_type, is_nullable, column_default, is_identity, is_generated
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position`,
    ["public", "students"],
  );
  const columns = result.rows;
  const existingNames = new Set(columns.map((column) => column.column_name));
  const missing = requiredStudentColumns.filter((name) => !existingNames.has(name));
  const wrongTypes = columns
    .filter((column) => expectedStudentTypes[column.column_name] && expectedStudentTypes[column.column_name] !== column.data_type)
    .map((column) => column.column_name + " is " + column.data_type + " (expected " + expectedStudentTypes[column.column_name] + ")");
  const unsupportedRequired = columns
    .filter((column) =>
      column.is_nullable === "NO" &&
      column.column_default === null &&
      column.is_identity === "NO" &&
      column.is_generated === "NEVER" &&
      column.column_name !== "id" &&
      !applicationStudentInsertColumns.has(column.column_name),
    )
    .map((column) => column.column_name);

  if (missing.length || wrongTypes.length || unsupportedRequired.length) {
    const issues: string[] = [];
    if (missing.length) issues.push("Missing application columns: " + missing.join(", ") + ".");
    if (wrongTypes.length) issues.push("Incompatible application column types: " + wrongTypes.join(", ") + ".");
    if (unsupportedRequired.length) {
      issues.push("Required legacy columns not supplied by application inserts: " + unsupportedRequired.join(", ") + ".");
    }
    throw new MigrationCompatibilityError(
      "Existing public.students table conflicts with 001_initial_schema.sql. " +
      issues.join(" ") +
      " No schema changes were applied. Use a separate application database or prepare a reviewed additive compatibility migration.",
    );
  }
}

async function migrate(): Promise<void> {
  const migrationDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
  const historyExists = (await pool.query<{ present: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS present",
    ["public.schema_migrations"],
  )).rows[0]?.present;
  const appliedVersions = historyExists
    ? new Set((await pool.query<{ version: string }>("SELECT version FROM public.schema_migrations ORDER BY version")).rows.map((row) => row.version))
    : new Set<string>();
  const pendingMigrations = files.filter((file) => !appliedVersions.has(file));

  // Check for incompatible legacy tables before creating even the migration-history table.
  await checkExistingStudentSchema(pendingMigrations);

  await pool.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  for (const file of pendingMigrations) {
    const sql = await readFile(path.join(migrationDirectory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO public.schema_migrations(version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration ${file}`);
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original migration error if rollback also fails.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .catch((error: unknown) => {
    console.error(formatMigrationFailure(error));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
