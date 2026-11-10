import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Types } from "mongoose";
import { currentStudentId, currentUserId, requireAuth, requireRole } from "../auth.js";
import { dateFromDay, dayFromDate } from "../dates.js";
import { ApiError, assert, conflictOnDuplicate, fromCents, isDuplicateKey, requireAmount, requireDate, requireObjectId, requirePositiveInteger, requireString, toCents } from "../errors.js";
import { Fee, Payment, Student, type FeeDocument } from "../models/index.js";

const TEACHER_DENIED = "Fee information is limited to administrators and the student concerned.";
const STUDENT_FIELDS = "firstName lastName studentNumber";
const PAYMENTS_PER_PAGE = 50;

type FeeStudent = { _id: Types.ObjectId; firstName: string; lastName: string; studentNumber: string };
type FeeRow = Omit<FeeDocument, "studentId"> & { _id: Types.ObjectId; studentId: FeeStudent };

function feeStatus(paidCents: number, amountCents: number): "pending" | "partially paid" | "paid" {
  if (paidCents === 0) return "pending";
  return paidCents < amountCents ? "partially paid" : "paid";
}

function presentFee(row: FeeRow) {
  return {
    id: String(row._id), studentId: String(row.studentId._id), studentName: `${row.studentId.firstName} ${row.studentId.lastName}`,
    studentNumber: row.studentId.studentNumber, description: row.description, academicYear: row.academicYear,
    amount: fromCents(row.amountCents), dueDate: dayFromDate(row.dueDate), amountPaid: fromCents(row.paidCents),
    balance: fromCents(Math.max(row.amountCents - row.paidCents, 0)), status: feeStatus(row.paidCents, row.amountCents),
  };
}

/** Ledger totals for every fee matching the filter, shared with the dashboard. */
export async function feeTotals(match: Record<string, unknown>) {
  const [totals] = await Fee.aggregate<{ total: number; obligations: number; collected: number; outstanding: number }>([
    { $match: match },
    { $group: {
      _id: null,
      total: { $sum: 1 },
      obligations: { $sum: "$amountCents" },
      collected: { $sum: "$paidCents" },
      outstanding: { $sum: { $max: [{ $subtract: ["$amountCents", "$paidCents"] }, 0] } },
    } },
  ]);
  return {
    total: totals?.total ?? 0,
    obligations: fromCents(totals?.obligations ?? 0),
    collected: fromCents(totals?.collected ?? 0),
    outstanding: fromCents(totals?.outstanding ?? 0),
  };
}

function presentPayment(row: { _id: Types.ObjectId; amountCents: number; paidAt: Date; referenceCode: string }) {
  return { id: String(row._id), amount: fromCents(row.amountCents), paidAt: row.paidAt, referenceCode: row.referenceCode };
}

export function feesRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/", async (req, res) => {
    if (req.user?.role === "teacher") throw new ApiError(403, TEACHER_DENIED, "FORBIDDEN");
    const match: Record<string, unknown> = {};
    if (req.user?.role === "student") match.studentId = currentStudentId(req);
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role === "admin") match.studentId = requireObjectId(req.query.studentId, "Student ID");
    const [rows, totals] = await Promise.all([
      Fee.find(match).sort({ dueDate: -1, _id: -1 }).limit(300)
        .populate<{ studentId: FeeStudent }>("studentId", STUDENT_FIELDS).lean<FeeRow[]>(),
      feeTotals(match),
    ]);
    const { total, ...summary } = totals;
    res.json({ data: rows.map(presentFee), meta: { total, summary } });
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const studentId = requireObjectId(req.body?.studentId, "Student ID");
    const description = requireString(req.body?.description, "Description", 120);
    const academicYear = requireString(req.body?.academicYear, "Academic year", 16);
    const amount = requireAmount(req.body?.amount, "Amount");
    const dueDate = requireDate(req.body?.dueDate, "Due date");
    if (!(await Student.exists({ _id: studentId }))) throw new ApiError(400, "The selected student does not exist.", "VALIDATION_ERROR");
    const created = await Fee.create({ studentId, description, academicYear, amountCents: toCents(amount), dueDate: dateFromDay(dueDate), createdBy: currentUserId(req) })
      .catch(conflictOnDuplicate("That fee obligation already exists for this student and academic year."));
    const row = await Fee.findById(created._id).populate<{ studentId: FeeStudent }>("studentId", STUDENT_FIELDS).lean<FeeRow>();
    res.status(201).json({ data: row ? presentFee(row) : null });
  });

  router.post("/:id/payments", requireRole("admin"), async (req, res) => {
    const feeId = requireObjectId(req.params.id, "Fee record ID");
    const amount = requireAmount(req.body?.amount, "Payment amount");
    const amountCents = toCents(amount);
    const referenceCode = req.body?.referenceCode ? requireString(req.body.referenceCode, "Reference code", 80) : `LOCAL-${randomUUID()}`;

    // Reserve the amount with one guarded, atomic update: two concurrent payments
    // cannot both pass the balance check, so the fee can never be overpaid.
    const fee = await Fee.findOneAndUpdate(
      { _id: feeId, $expr: { $lte: [{ $add: ["$paidCents", amountCents] }, "$amountCents"] } },
      { $inc: { paidCents: amountCents } },
    ).select("studentId").lean();
    if (!fee) {
      if (!(await Fee.exists({ _id: feeId }))) throw new ApiError(404, "Fee record was not found.", "NOT_FOUND");
      assert(false, 400, "Payment cannot be greater than the outstanding balance.", "VALIDATION_ERROR");
    }

    let payment;
    try {
      payment = await Payment.create({ feeId, studentId: fee.studentId, amountCents, referenceCode, recordedBy: currentUserId(req) });
    } catch (error) {
      await Fee.updateOne({ _id: feeId }, { $inc: { paidCents: -amountCents } });
      if (isDuplicateKey(error)) throw new ApiError(409, "That payment reference has already been used.", "DUPLICATE_RECORD");
      throw error;
    }
    res.status(201).json({ data: { id: String(payment._id), feeRecordId: String(feeId), amount, referenceCode, paidAt: payment.paidAt } });
  });

  router.get("/:id/payments", async (req, res) => {
    const feeId = requireObjectId(req.params.id, "Fee record ID");
    if (req.user?.role === "teacher") throw new ApiError(403, TEACHER_DENIED, "FORBIDDEN");
    if (req.user?.role === "student") {
      // Scope the lookup before checking existence, so foreign IDs reveal nothing.
      if (!(await Fee.exists({ _id: feeId, studentId: currentStudentId(req) }))) throw new ApiError(403, "You can only view your own payments.", "FORBIDDEN");
    } else if (!(await Fee.exists({ _id: feeId }))) {
      throw new ApiError(404, "Fee record was not found.", "NOT_FOUND");
    }
    const payments = await Payment.find({ feeId }).sort({ paidAt: -1 }).lean();
    res.json({ data: payments.map(presentPayment) });
  });

  return router;
}

export function paymentsRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/", async (req, res) => {
    if (req.user?.role === "teacher") throw new ApiError(403, TEACHER_DENIED, "FORBIDDEN");
    const page = req.query.page === undefined ? 1 : requirePositiveInteger(req.query.page, "Page");
    assert(page <= 1_000_000, 400, "Page must be at most 1000000.", "VALIDATION_ERROR");
    const match: Record<string, unknown> = {};
    if (req.user?.role === "student") match.studentId = currentStudentId(req);
    if (typeof req.query.studentId === "string" && req.query.studentId && req.user?.role === "admin") match.studentId = requireObjectId(req.query.studentId, "Student ID");
    const [rows, total] = await Promise.all([
      Payment.find(match).sort({ paidAt: -1, _id: -1 }).skip((page - 1) * PAYMENTS_PER_PAGE).limit(PAYMENTS_PER_PAGE).lean(),
      Payment.countDocuments(match),
    ]);
    res.json({
      data: rows.map((row) => ({ ...presentPayment(row), feeRecordId: String(row.feeId), studentId: String(row.studentId) })),
      meta: { page, limit: PAYMENTS_PER_PAGE, total, pages: Math.ceil(total / PAYMENTS_PER_PAGE) },
    });
  });

  return router;
}
