import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth, requireRole } from "../auth.js";
import { inTransaction } from "../database.js";
import { ApiError, assert, requireAmount, requireDate, requirePositiveId, requireString } from "../errors.js";

interface FeeRow {
  id: string;
  student_id: string;
  student_name: string;
  student_number: string;
  description: string;
  academic_year: string;
  amount: string;
  due_date: string;
  amount_paid: string;
  balance: string;
  status: "pending" | "partially paid" | "paid";
}

const feeSelect = `SELECT f.id,f.student_id,s.first_name || ' ' || s.last_name AS student_name,
  s.student_number,f.description,f.academic_year,f.amount,f.due_date::text AS due_date,
  COALESCE(SUM(p.amount),0)::numeric(10,2)::text AS amount_paid,
  GREATEST(f.amount-COALESCE(SUM(p.amount),0),0)::numeric(10,2)::text AS balance,
  CASE WHEN COALESCE(SUM(p.amount),0)=0 THEN 'pending'
       WHEN COALESCE(SUM(p.amount),0)<f.amount THEN 'partially paid' ELSE 'paid' END AS status
  FROM fee_records f JOIN students s ON s.id=f.student_id
  LEFT JOIN fee_payments p ON p.fee_record_id=f.id`;

function presentFee(row: FeeRow) {
  return { id: Number(row.id), studentId: Number(row.student_id), studentName: row.student_name, studentNumber: row.student_number, description: row.description, academicYear: row.academic_year, amount: Number(row.amount), dueDate: String(row.due_date).slice(0, 10), amountPaid: Number(row.amount_paid), balance: Number(row.balance), status: row.status };
}

function uniqueError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23505"; }

export function feesRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/", async (req, res) => {
    if (req.user?.role === "teacher") throw new ApiError(403, "Fee information is limited to administrators and the student concerned.", "FORBIDDEN");
    const filters: string[] = [];
    const values: number[] = [];
    if (req.user?.role === "student") { values.push(req.user.studentId ?? -1); filters.push(`f.student_id=$${values.length}`); }
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role === "admin") { values.push(requirePositiveId(req.query.studentId, "Student ID")); filters.push(`f.student_id=$${values.length}`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const result = await pool.query<FeeRow>(`${feeSelect} ${where} GROUP BY f.id,s.id ORDER BY f.due_date DESC LIMIT 300`, values);
    const totals = await pool.query<{ total: number; obligations: number; collected: number; outstanding: number }>(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(amount),0)::float8 AS obligations,
              COALESCE(SUM(paid),0)::float8 AS collected,
              COALESCE(SUM(GREATEST(amount-paid,0)),0)::float8 AS outstanding
       FROM (
         SELECT f.id,f.amount,COALESCE(SUM(p.amount),0) AS paid
         FROM fee_records f LEFT JOIN fee_payments p ON p.fee_record_id=f.id
         ${where} GROUP BY f.id
       ) scoped`,
      values,
    );
    const summary = totals.rows[0] ?? { total: 0, obligations: 0, collected: 0, outstanding: 0 };
    res.json({ data: result.rows.map(presentFee), meta: { total: summary.total, summary: { obligations: summary.obligations, collected: summary.collected, outstanding: summary.outstanding } } });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const studentId = requirePositiveId(req.body?.studentId, "Student ID");
    const description = requireString(req.body?.description, "Description", 120);
    const academicYear = requireString(req.body?.academicYear, "Academic year", 16);
    const amount = requireAmount(req.body?.amount, "Amount");
    const dueDate = requireDate(req.body?.dueDate, "Due date");
    const result = await pool.query<{ id: string }>(
      `INSERT INTO fee_records(student_id,description,academic_year,amount,due_date,created_by)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
      [studentId, description, academicYear, amount, dueDate, req.user?.id],
    ).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "That fee obligation already exists for this student and academic year.", "DUPLICATE_RECORD");
      if (foreignKeyError(error)) throw new ApiError(400, "The selected student does not exist.", "VALIDATION_ERROR");
      throw error;
    });
    const rows = await pool.query<FeeRow>(`${feeSelect} WHERE f.id=$1 GROUP BY f.id,s.id`, [result.rows[0]?.id]);
    res.status(201).json({ data: rows.rows[0] ? presentFee(rows.rows[0]) : null });
  });

  router.post("/:id/payments", requireRole("admin"), async (req, res) => {
    const feeId = requirePositiveId(req.params.id, "Fee record ID");
    const amount = requireAmount(req.body?.amount, "Payment amount");
    const referenceCode = req.body?.referenceCode ? requireString(req.body.referenceCode, "Reference code", 80) : `LOCAL-${randomUUID()}`;

    const payment = await inTransaction(pool, async (client) => {
      const fee = await client.query<{ amount: string }>("SELECT amount FROM fee_records WHERE id=$1 FOR UPDATE", [feeId]);
      if (!fee.rows[0]) throw new ApiError(404, "Fee record was not found.", "NOT_FOUND");
      const paid = await client.query<{ total: string }>("SELECT COALESCE(SUM(amount),0)::text AS total FROM fee_payments WHERE fee_record_id=$1", [feeId]);
      const balance = Number(fee.rows[0].amount) - Number(paid.rows[0]?.total ?? 0);
      assert(amount <= balance + 0.00001, 400, "Payment cannot be greater than the outstanding balance.", "VALIDATION_ERROR");
      const result = await client.query<{ id: string; paid_at: Date }>(
        `INSERT INTO fee_payments(fee_record_id,amount,reference_code,recorded_by)
         VALUES($1,$2,$3,$4) RETURNING id,paid_at`,
        [feeId, amount, referenceCode, req.user?.id],
      );
      return result.rows[0];
    }).catch((error: unknown) => {
      if (uniqueError(error)) throw new ApiError(409, "That payment reference has already been used.", "DUPLICATE_RECORD");
      throw error;
    });
    res.status(201).json({ data: { id: payment?.id ? Number(payment.id) : null, feeRecordId: feeId, amount, referenceCode, paidAt: payment?.paid_at ?? null } });
  });

  router.get("/:id/payments", async (req, res) => {
    const feeId = requirePositiveId(req.params.id, "Fee record ID");
    if (req.user?.role === "teacher") throw new ApiError(403, "Fee information is limited to administrators and the student concerned.", "FORBIDDEN");
    if (req.user?.role === "student") {
      // Scope the lookup before checking existence, so foreign IDs reveal nothing.
      const ownFee = await pool.query("SELECT 1 FROM fee_records WHERE id=$1 AND student_id=$2", [feeId, req.user.studentId ?? -1]);
      if (!ownFee.rowCount) throw new ApiError(403, "You can only view your own payments.", "FORBIDDEN");
    } else {
      const fee = await pool.query("SELECT 1 FROM fee_records WHERE id=$1", [feeId]);
      if (!fee.rowCount) throw new ApiError(404, "Fee record was not found.", "NOT_FOUND");
    }
    const payments = await pool.query<{ id: string; amount: string; paid_at: Date; reference_code: string }>(
      "SELECT id,amount,paid_at,reference_code FROM fee_payments WHERE fee_record_id=$1 ORDER BY paid_at DESC", [feeId],
    );
    res.json({ data: payments.rows.map((row) => ({ id: Number(row.id), amount: Number(row.amount), paidAt: row.paid_at, referenceCode: row.reference_code })) });
  });

  return router;
}

function foreignKeyError(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "23503"; }
