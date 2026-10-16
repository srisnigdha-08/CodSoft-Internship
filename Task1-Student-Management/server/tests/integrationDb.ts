import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg, { type Pool, type PoolClient } from "pg";
import { getDatabaseConfig } from "../src/env.js";

export const TEST_DATABASE = "codsoft_sms_integration_test";
const GUARD_MARKER = "codsoft_sms_integration_suite_v1";
const dataTables = [
  "fee_payments", "fee_records", "academic_results", "examinations",
  "attendance_corrections", "attendance", "students", "classes", "teachers", "users",
] as const;
const allowedTables = new Set([...dataTables, "schema_migrations", "integration_test_guard"]);

export function createIntegrationPool(): Pool {
  const config = getDatabaseConfig();
  if (config.database === TEST_DATABASE) {
    throw new Error("server/.env must continue to point to the application database, not the integration database.");
  }
  return new pg.Pool({ ...config, database: TEST_DATABASE, max: 5 });
}

async function assertTarget(client: PoolClient, requireMarker: boolean): Promise<void> {
  const identity = await client.query<{ database: string; role: string; owner: string }>(
    `SELECT current_database() AS database, current_user AS role,
            pg_get_userbyid(d.datdba) AS owner
     FROM pg_database d WHERE d.datname = current_database()`,
  );
  const row = identity.rows[0];
  if (!row || row.database !== TEST_DATABASE || row.owner !== row.role) {
    throw new Error("Integration setup refused: connected database name or ownership is not the dedicated test target.");
  }
  if (!requireMarker) return;
  const marker = await client.query<{ marker: string }>("SELECT marker FROM public.integration_test_guard");
  if (marker.rows.length !== 1 || marker.rows[0]?.marker !== GUARD_MARKER) {
    throw new Error("Integration cleanup refused: the test database guard marker is missing or invalid.");
  }
  const tables = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  if (tables.rows.some(({ tablename }) => !allowedTables.has(tablename))) {
    throw new Error("Integration cleanup refused: the test database has an unrecognized public table.");
  }
}

export async function prepareIntegrationDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await assertTarget(client, false);
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    const hasGuard = tables.rows.some(({ tablename }) => tablename === "integration_test_guard");
    if (!hasGuard && tables.rows.length > 0) {
      throw new Error("Integration setup refused: the test database is not empty and has no guard marker.");
    }
    if (hasGuard) await assertTarget(client, true);

    const migrationDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
    const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
    await client.query("BEGIN");
    try {
      if (!hasGuard) {
        await client.query("CREATE TABLE public.integration_test_guard(marker text PRIMARY KEY)");
        await client.query("INSERT INTO public.integration_test_guard(marker) VALUES($1)", [GUARD_MARKER]);
        await client.query("CREATE TABLE public.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
      }
      const applied = await client.query<{ version: string }>("SELECT version FROM public.schema_migrations");
      const versions = new Set(applied.rows.map(({ version }) => version));
      if (applied.rows.some(({ version }) => !files.includes(version))) {
        throw new Error("Integration setup refused: migration history contains an unrecognized version.");
      }
      for (const file of files) {
        if (versions.has(file)) continue;
        await assertTarget(client, false);
        await client.query(await readFile(fileURLToPath(new URL(`../migrations/${file}`, import.meta.url)), "utf8"));
        await client.query("INSERT INTO public.schema_migrations(version) VALUES($1)", [file]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    await assertTarget(client, true);
  } finally {
    client.release();
  }
}

export async function resetIntegrationFixtures(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Every destructive setup and cleanup rechecks the database identity and marker.
    await assertTarget(client, true);
    await client.query("BEGIN");
    try {
      await client.query(`TRUNCATE TABLE ${dataTables.map((name) => `public.${name}`).join(", ")} RESTART IDENTITY`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}

export async function countIntegrationRows(pool: Pool): Promise<number> {
  const client = await pool.connect();
  try {
    await assertTarget(client, true);
    const totals = await client.query<{ total: string }>(
      `SELECT (${dataTables.map((name) => `(SELECT COUNT(*) FROM public.${name})`).join(" + ")})::text AS total`,
    );
    return Number(totals.rows[0]?.total ?? 0);
  } finally {
    client.release();
  }
}
