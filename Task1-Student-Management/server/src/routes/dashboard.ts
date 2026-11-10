import { Router } from "express";
import type { Types } from "mongoose";
import { currentStudentId, requireAuth, teacherClassIds } from "../auth.js";
import { addDays, dayFromDate, today } from "../dates.js";
import { Attendance, Exam, Result, Student, Teacher } from "../models/index.js";
import { joinOptionalClass } from "../queryStages.js";
import { teacherExamIds } from "./academics.js";
import { feeTotals } from "./fees.js";

interface AttendanceCounts { present: number; absent: number; late: number; total: number }
interface RecentRow { _id: Types.ObjectId; firstName: string; lastName: string; studentNumber: string; createdAt: Date; schoolClass?: { name: string } }
interface AcademicTotals { resultCount: number; average: number; strong: number; steady: number; support: number }

const TREND_DAYS = 14;

const countByStatus = {
  present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
  absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
  late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
  total: { $sum: 1 },
};

function attendancePercentage(counts: AttendanceCounts): number {
  return counts.total ? Math.round(((counts.present + counts.late) / counts.total) * 100) : 0;
}

export function dashboardRouter(secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  router.get("/stats", async (req, res) => {
    const role = req.user?.role ?? "student";
    const admin = role === "admin";
    const teacher = role === "teacher";

    // Each role sees the same statistics over its own slice of the data.
    const classIds = teacher ? await teacherClassIds(req) : [];
    const studentId = role === "student" ? currentStudentId(req) : null;
    const attendanceScope: Record<string, unknown> = admin ? {} : teacher ? { classId: { $in: classIds } } : { studentId };
    const resultScope: Record<string, unknown> = admin ? {} : teacher ? { examId: { $in: await teacherExamIds(req) } } : { studentId };
    const recentScope: Record<string, unknown> = admin ? {} : teacher ? { classId: { $in: classIds } } : { _id: studentId };

    const day = today();
    const firstTrendDay = addDays(day, 1 - TREND_DAYS);

    const [totalStudents, totalTeachers, todayTotals, trendRows, academicTotals, recent, fees] = await Promise.all([
      admin || teacher ? Student.countDocuments({ status: "active", ...(teacher ? { classId: { $in: classIds } } : {}) }) : null,
      admin ? Teacher.countDocuments({ status: "active" }) : null,
      Attendance.aggregate<AttendanceCounts>([{ $match: { ...attendanceScope, date: day } }, { $group: { _id: null, ...countByStatus } }]),
      Attendance.aggregate<AttendanceCounts & { _id: Date }>([
        { $match: { ...attendanceScope, date: { $gte: firstTrendDay, $lte: day } } },
        { $group: { _id: "$date", ...countByStatus } },
      ]),
      Result.aggregate<AcademicTotals>([
        { $match: resultScope },
        { $lookup: { from: Exam.collection.name, localField: "examId", foreignField: "_id", as: "exam", pipeline: [{ $project: { maxScore: 1 } }] } },
        { $unwind: "$exam" },
        { $project: { ratio: { $divide: ["$score", "$exam.maxScore"] } } },
        { $group: {
          _id: null,
          resultCount: { $sum: 1 },
          average: { $avg: { $multiply: ["$ratio", 100] } },
          strong: { $sum: { $cond: [{ $gte: ["$ratio", 0.85] }, 1, 0] } },
          steady: { $sum: { $cond: [{ $and: [{ $gte: ["$ratio", 0.7] }, { $lt: ["$ratio", 0.85] }] }, 1, 0] } },
          support: { $sum: { $cond: [{ $lt: ["$ratio", 0.7] }, 1, 0] } },
        } },
      ]),
      Student.aggregate<RecentRow>([
        { $match: { status: "active", ...recentScope } },
        { $sort: { createdAt: -1, _id: -1 } },
        { $limit: 5 },
        ...joinOptionalClass,
      ]),
      teacher ? null : feeTotals(admin ? {} : { studentId }),
    ]);

    const zero: AttendanceCounts = { present: 0, absent: 0, late: 0, total: 0 };
    const todayCounts = todayTotals[0] ?? zero;
    const trendByDay = new Map(trendRows.map((row) => [dayFromDate(row._id), row]));
    const attendanceTrend = Array.from({ length: TREND_DAYS }, (_, index) => {
      const date = dayFromDate(addDays(firstTrendDay, index));
      const { present, absent, late, total } = trendByDay.get(date) ?? zero;
      return { date, present, absent, late, total, percentage: attendancePercentage({ present, absent, late, total }) };
    });
    const academic = academicTotals[0];

    res.json({
      data: {
        summary: {
          totalStudents,
          totalTeachers,
          attendance: {
            present: todayCounts.present,
            absent: todayCounts.absent,
            late: todayCounts.late,
            total: todayCounts.total,
            percentage: attendancePercentage(todayCounts),
          },
        },
        recentStudents: recent.map((row) => ({
          id: String(row._id),
          name: `${row.firstName} ${row.lastName}`,
          studentNumber: row.studentNumber,
          className: row.schoolClass?.name ?? null,
          registeredAt: row.createdAt,
        })),
        attendanceTrend,
        academics: {
          resultCount: academic?.resultCount ?? 0,
          averagePercentage: Math.round((academic?.average ?? 0) * 100) / 100,
          gradeBands: { strong: academic?.strong ?? 0, steady: academic?.steady ?? 0, support: academic?.support ?? 0 },
        },
        fees: fees ? { obligations: fees.obligations, collected: fees.collected, outstanding: fees.outstanding } : null,
      },
    });
  });

  return router;
}
