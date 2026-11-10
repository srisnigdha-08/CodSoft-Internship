// Copies the legacy PostgreSQL data into MongoDB.
//
//   Dry run (default): reads, transforms, and validates; writes nothing.
//   npm run db:migrate:postgres
//
//   Import and verify:
//   npm run db:migrate:postgres -- --apply
//
// PostgreSQL is only ever read: psql runs a single READ ONLY snapshot and the
// script refuses to continue unless the server confirms that mode. Using the
// psql CLI keeps a PostgreSQL driver out of this project's dependencies.
import { spawnSync } from "node:child_process";
import type { Model, Types } from "mongoose";
import { assertDedicatedDatabase, formatDatabaseFailure } from "../src/databaseGuards.js";
import { connectDatabase, disconnectDatabase } from "../src/db.js";
import { getMongoConfig } from "../src/env.js";
import { Attendance, Exam, Fee, Payment, Result, SchoolClass, Student, Teacher, User } from "../src/models/index.js";
import { LEGACY_TABLES, transformLegacyData, type LegacyData, type LegacyTable } from "./legacyTransform.js";

function legacyConfig() {
  const read = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}. Set the LEGACY_PG_* variables described in server/.env.example.`);
    return value;
  };
  return { host: read("LEGACY_PG_HOST"), port: process.env.LEGACY_PG_PORT?.trim() || "5432", database: read("LEGACY_PG_DATABASE"), user: read("LEGACY_PG_USER"), password: read("LEGACY_PG_PASSWORD") };
}

function readLegacyData(): LegacyData {
  const config = legacyConfig();
  const selects = LEGACY_TABLES.map((table) => `SELECT json_build_object('t','${table}','r',row_to_json(x))::text FROM public.${table} x ORDER BY x.id;`).join("\n");
  const script = `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object('t','__session','readOnly',current_setting('transaction_read_only'))::text;
${selects}
COMMIT;`;
  const result = spawnSync("psql", ["-h", config.host, "-p", config.port, "-U", config.user, "-d", config.database, "-w", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-f", "-"], {
    input: script,
    env: { ...process.env, PGPASSWORD: config.password, PGOPTIONS: "-c default_transaction_read_only=on", PGCLIENTENCODING: "UTF8" },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 512,
  });
  if (result.error) throw new Error("Could not run psql. Install the PostgreSQL client tools and add psql to PATH.");
  if (result.status !== 0) throw new Error("psql could not read the legacy database. Check the LEGACY_PG_* settings and that PostgreSQL is running.");

  const data = Object.fromEntries(LEGACY_TABLES.map((table) => [table, []])) as unknown as LegacyData;
  let readOnly = false;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line) as { t: LegacyTable | "__session"; r?: Record<string, unknown>; readOnly?: string };
    if (entry.t === "__session") readOnly = entry.readOnly === "on";
    else if (entry.r) data[entry.t].push(entry.r);
  }
  if (!readOnly) throw new Error("PostgreSQL did not confirm a read-only session; stopping without using the data.");
  return data;
}

type Docs = ReturnType<typeof transformLegacyData>;
// The plan table mixes every model, so a single shared model type is needed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;
type Plan = { label: keyof Docs; source: LegacyTable; model: AnyModel };

const plans: Plan[] = [
  { label: "users", source: "users", model: User },
  { label: "teachers", source: "teachers", model: Teacher },
  { label: "classes", source: "classes", model: SchoolClass },
  { label: "students", source: "students", model: Student },
  { label: "attendance", source: "attendance", model: Attendance },
  { label: "exams", source: "examinations", model: Exam },
  { label: "results", source: "academic_results", model: Result },
  { label: "fees", source: "fee_records", model: Fee },
  { label: "payments", source: "fee_payments", model: Payment },
];

async function validateDocuments(docs: Docs): Promise<void> {
  let invalid = 0;
  for (const plan of plans) {
    for (const doc of docs[plan.label]) {
      try {
        await new plan.model(doc).validate();
      } catch (error) {
        invalid += 1;
        // Field names only: messages could otherwise quote personal values.
        console.error(`Invalid ${plan.label} document: ${Object.keys((error as { errors?: object }).errors ?? {}).join(", ")}`);
      }
    }
  }
  if (invalid) throw new Error(`${invalid} transformed document(s) failed schema validation; nothing was imported.`);
}

async function assertNoForeignDocuments(docs: Docs): Promise<void> {
  for (const plan of plans) {
    const expected = docs[plan.label].map((doc) => doc._id as Types.ObjectId);
    const foreign = await plan.model.countDocuments({ _id: { $nin: expected } });
    if (foreign) throw new Error(`The ${plan.label} collection already holds ${foreign} document(s) that did not come from this migration. Use an empty database; nothing was imported.`);
  }
}

async function importDocuments(docs: Docs): Promise<void> {
  for (const plan of plans) {
    const documents = docs[plan.label];
    for (let start = 0; start < documents.length; start += 1000) {
      // Insert-only: documents already imported, and any later edits to them, are kept.
      await plan.model.bulkWrite(documents.slice(start, start + 1000).map((doc) => ({
        updateOne: { filter: { _id: doc._id }, update: { $setOnInsert: doc }, upsert: true },
      })) as never[], { ordered: true, timestamps: false });
    }
  }
}

async function verify(source: LegacyData, docs: Docs): Promise<boolean> {
  let passed = true;
  const check = (name: string, expected: number, actual: number) => {
    const ok = expected === actual;
    passed &&= ok;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(42)} expected ${expected}, found ${actual}`);
  };

  for (const plan of plans) check(`${plan.label} count`, source[plan.source].length, await plan.model.countDocuments());

  const correctionTotal = await Attendance.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: { $size: "$corrections" } } } }]);
  check("embedded attendance corrections", source.attendance_corrections.length, correctionTotal[0]?.total ?? 0);

  const references: Array<[string, AnyModel, string, AnyModel]> = [
    ["teachers.userId", Teacher, "userId", User],
    ["students.userId", Student, "userId", User],
    ["students.classId", Student, "classId", SchoolClass],
    ["classes.teacherId", SchoolClass, "teacherId", Teacher],
    ["attendance.studentId", Attendance, "studentId", Student],
    ["attendance.classId", Attendance, "classId", SchoolClass],
    ["attendance.recordedBy", Attendance, "recordedBy", User],
    ["exams.classId", Exam, "classId", SchoolClass],
    ["results.studentId", Result, "studentId", Student],
    ["results.examId", Result, "examId", Exam],
    ["fees.studentId", Fee, "studentId", Student],
    ["payments.feeId", Payment, "feeId", Fee],
    ["payments.studentId", Payment, "studentId", Student],
  ];
  for (const [name, child, field, parent] of references) {
    const parentIds = await parent.distinct("_id");
    check(`dangling ${name}`, 0, await child.countDocuments({ [field]: { $nin: [...parentIds, null] } }));
  }

  const sum = (rows: Array<{ total: number }>) => rows[0]?.total ?? 0;
  const expectedObligations = docs.fees.reduce((total, fee) => total + fee.amountCents, 0);
  const expectedPaid = docs.payments.reduce((total, payment) => total + payment.amountCents, 0);
  check("fee obligations (cents)", expectedObligations, sum(await Fee.aggregate([{ $group: { _id: null, total: { $sum: "$amountCents" } } }])));
  check("fee paidCents total (cents)", expectedPaid, sum(await Fee.aggregate([{ $group: { _id: null, total: { $sum: "$paidCents" } } }])));
  check("payment records total (cents)", expectedPaid, sum(await Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amountCents" } } }])));
  check("overpaid fees", 0, await Fee.countDocuments({ $expr: { $gt: ["$paidCents", "$amountCents"] } }));
  return passed;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { uri, databaseName } = getMongoConfig();
  assertDedicatedDatabase(databaseName, "Migration");

  const source = readLegacyData();
  console.log("Read-only PostgreSQL snapshot:", JSON.stringify(Object.fromEntries(LEGACY_TABLES.map((table) => [table, source[table].length]))));
  const docs = transformLegacyData(source);
  await validateDocuments(docs);
  console.log("Every transformed document passed Mongoose schema validation.");

  if (!apply) {
    console.log("Dry run complete. MongoDB was not contacted or changed. Re-run with --apply to import.");
    return;
  }

  await connectDatabase(uri);
  await assertNoForeignDocuments(docs);
  await importDocuments(docs);
  console.log("Import finished. Verifying against the snapshot:");
  if (!(await verify(source, docs))) throw new Error("Verification found differences between PostgreSQL and MongoDB.");
  console.log("Data migration verified.");
}

main()
  .catch((error: unknown) => {
    console.error(formatDatabaseFailure(error, "Data migration"));
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
