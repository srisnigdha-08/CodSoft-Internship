import { describe, expect, it } from "vitest";
import { formatMigrationFailure } from "../src/migrationDiagnostics.js";

describe("migration diagnostics", () => {
  it("gives connection failures an actionable category without printing an address", () => {
    const diagnostic = formatMigrationFailure({
      code: "ECONNREFUSED",
      message: "connect ECONNREFUSED 127.0.0.1:5432",
    });

    expect(diagnostic).toContain("connection refused");
    expect(diagnostic).toContain("DB_HOST/DB_PORT");
    expect(diagnostic).not.toContain("127.0.0.1");
  });

  it("reports schema compatibility conflicts without hiding the missing columns", () => {
    const diagnostic = formatMigrationFailure({
      code: "APP_SCHEMA_INCOMPATIBLE",
      message: "Existing public.students table conflicts with migration. Missing application columns: user_id, student_number.",
    });

    expect(diagnostic).toContain("schema compatibility conflict");
    expect(diagnostic).toContain("user_id, student_number");
  });

  it("redacts password details from unexpected database diagnostics", () => {
    const diagnostic = formatMigrationFailure({
      code: "XX000",
      message: "database failure password=top-secret DETAIL: email=private@example.test",
    });

    expect(diagnostic).toContain("[redacted]");
    expect(diagnostic).toContain("[database detail redacted]");
    expect(diagnostic).not.toContain("top-secret");
    expect(diagnostic).not.toContain("private@example.test");
  });
});
