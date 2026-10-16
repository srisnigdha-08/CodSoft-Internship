import { Router } from "express";
import type { Pool } from "pg";
import { requireAuth } from "../auth.js";

interface RecentStudentRow {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  class_name: string | null;
  created_at: Date;
}

interface TrendRow {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export function dashboardRouter(pool: Pool, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret, pool));

  router.get("/stats", async (req, res) => {
    const role = req.user?.role ?? "student";
    const teacherId = req.user?.teacherId ?? -1;
    const studentId = req.user?.studentId ?? -1;
    const admin = role === "admin";
    const teacher = role === "teacher";

    const studentQuery = admin
      ? "SELECT COUNT(*)::int AS total FROM students WHERE status='active'"
      : teacher
        ? "SELECT COUNT(*)::int AS total FROM students s JOIN classes c ON c.id=s.class_id WHERE s.status='active' AND c.teacher_id=$1"
        : "SELECT 0::int AS total";
    const teacherQuery = admin
      ? "SELECT COUNT(*)::int AS total FROM teachers WHERE status='active'"
      : "SELECT 0::int AS total";
    const scopeValues = [role, teacherId, studentId];

    const [students, teachers, attendance, trend, academics] = await Promise.all([
      pool.query<{ total: number }>(studentQuery, teacher ? [teacherId] : []),
      pool.query<{ total: number }>(teacherQuery),
      pool.query<{ present: number; absent: number; late: number; total: number }>(
        `SELECT COUNT(*) FILTER(WHERE a.status='present')::int AS present,
                COUNT(*) FILTER(WHERE a.status='absent')::int AS absent,
                COUNT(*) FILTER(WHERE a.status='late')::int AS late,
                COUNT(*)::int AS total
         FROM attendance a JOIN classes c ON c.id=a.class_id
         WHERE a.attendance_date=CURRENT_DATE
           AND ($1::text='admin' OR ($1::text='teacher' AND c.teacher_id=$2) OR ($1::text='student' AND a.student_id=$3))`,
        scopeValues,
      ),
      pool.query<TrendRow>(
        `WITH days AS (
           SELECT generate_series(CURRENT_DATE - 13,CURRENT_DATE,INTERVAL '1 day')::date AS day
         ), scoped AS (
           SELECT a.attendance_date,a.status
           FROM attendance a JOIN classes c ON c.id=a.class_id
           WHERE a.attendance_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE
             AND ($1::text='admin' OR ($1::text='teacher' AND c.teacher_id=$2) OR ($1::text='student' AND a.student_id=$3))
         )
         SELECT days.day::text AS date,
                COUNT(scoped.status) FILTER(WHERE scoped.status='present')::int AS present,
                COUNT(scoped.status) FILTER(WHERE scoped.status='absent')::int AS absent,
                COUNT(scoped.status) FILTER(WHERE scoped.status='late')::int AS late,
                COUNT(scoped.status)::int AS total
         FROM days LEFT JOIN scoped ON scoped.attendance_date=days.day
         GROUP BY days.day ORDER BY days.day`,
        scopeValues,
      ),
      pool.query<{ result_count: number; average_percentage: number; strong: number; steady: number; support: number }>(
        `SELECT COUNT(*)::int AS result_count,
                COALESCE(AVG(r.score / NULLIF(e.max_score,0) * 100),0)::numeric(6,2)::float8 AS average_percentage,
                COUNT(*) FILTER(WHERE r.score / NULLIF(e.max_score,0) >= .85)::int AS strong,
                COUNT(*) FILTER(WHERE r.score / NULLIF(e.max_score,0) >= .70 AND r.score / NULLIF(e.max_score,0) < .85)::int AS steady,
                COUNT(*) FILTER(WHERE r.score / NULLIF(e.max_score,0) < .70)::int AS support
         FROM academic_results r
         JOIN students s ON s.id=r.student_id
         JOIN examinations e ON e.id=r.examination_id
         JOIN classes c ON c.id=e.class_id
         WHERE ($1::text='admin' OR ($1::text='teacher' AND c.teacher_id=$2) OR ($1::text='student' AND r.student_id=$3))`,
        scopeValues,
      ),
    ]);

    const recentFilter = admin ? "" : teacher ? "AND c.teacher_id=$1" : "AND s.id=$1";
    const recentValues = admin ? [] : [teacher ? teacherId : studentId];
    const recent = await pool.query<RecentStudentRow>(
      `SELECT s.id,s.first_name,s.last_name,s.student_number,c.name AS class_name,s.created_at
       FROM students s LEFT JOIN classes c ON c.id=s.class_id
       WHERE s.status='active' ${recentFilter}
       ORDER BY s.created_at DESC,s.id DESC LIMIT 5`,
      recentValues,
    );

    let fees: { obligations: number; collected: number; outstanding: number } | null = null;
    if (role !== "teacher") {
      const feeTotals = await pool.query<{ obligations: number; collected: number; outstanding: number }>(
        `SELECT COALESCE(SUM(f.amount),0)::float8 AS obligations,
                COALESCE(SUM(COALESCE(p.total,0)),0)::float8 AS collected,
                COALESCE(SUM(GREATEST(f.amount-COALESCE(p.total,0),0)),0)::float8 AS outstanding
         FROM fee_records f JOIN students s ON s.id=f.student_id
         LEFT JOIN (SELECT fee_record_id,SUM(amount) AS total FROM fee_payments GROUP BY fee_record_id) p ON p.fee_record_id=f.id
         WHERE ($1::text='admin' OR ($1::text='student' AND f.student_id=$2))`,
        [role, studentId],
      );
      const totals = feeTotals.rows[0];
      fees = {
        obligations: Number(totals?.obligations ?? 0),
        collected: Number(totals?.collected ?? 0),
        outstanding: Number(totals?.outstanding ?? 0),
      };
    }

    const today = attendance.rows[0] ?? { present: 0, absent: 0, late: 0, total: 0 };
    const academic = academics.rows[0];
    const trendRows = trend.rows.map((row) => {
      const presentCount = Number(row.present);
      const lateCount = Number(row.late);
      const totalCount = Number(row.total);
      return {
        date: String(row.date).slice(0, 10),
        present: presentCount,
        absent: Number(row.absent),
        late: lateCount,
        total: totalCount,
        percentage: totalCount ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0,
      };
    });
    const attendedToday = Number(today.present) + Number(today.late);

    res.json({
      data: {
        summary: {
          totalStudents: admin || teacher ? Number(students.rows[0]?.total ?? 0) : null,
          totalTeachers: admin ? Number(teachers.rows[0]?.total ?? 0) : null,
          attendance: {
            present: Number(today.present),
            absent: Number(today.absent),
            late: Number(today.late),
            total: Number(today.total),
            percentage: today.total ? Math.round((attendedToday / Number(today.total)) * 100) : 0,
          },
        },
        recentStudents: recent.rows.map((row) => ({
          id: Number(row.id),
          name: `${row.first_name} ${row.last_name}`,
          studentNumber: row.student_number,
          className: row.class_name,
          registeredAt: row.created_at,
        })),
        attendanceTrend: trendRows,
        academics: {
          resultCount: Number(academic?.result_count ?? 0),
          averagePercentage: Number(academic?.average_percentage ?? 0),
          gradeBands: {
            strong: Number(academic?.strong ?? 0),
            steady: Number(academic?.steady ?? 0),
            support: Number(academic?.support ?? 0),
          },
        },
        fees,
      },
    });
  });
  return router;
}
