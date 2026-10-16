import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { pool } from "./db.js";
import { inTransaction } from "./database.js";

const TARGET_STUDENTS = 150;
const TARGET_TEACHERS = 15;
const CLASS_GROUPS = ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
const SECTIONS = ["A", "B"];
const SUBJECTS = ["Mathematics", "Science", "English"];
const firstNames = [
  "Ari", "Mira", "Dev", "Nia", "Ishan", "Tara", "Rohan", "Leela", "Kabir", "Anaya",
  "Neil", "Sana", "Vihaan", "Ira", "Arjun", "Diya", "Kian", "Meera", "Ayaan", "Riya",
  "Rey", "Avni", "Aarav", "Myra", "Ishaan", "Kiara", "Ritvik", "Sara", "Yash", "Zoya",
];
const lastNames = [
  "Patel", "Shah", "Rao", "Kapoor", "Nair", "Mehta", "Das", "Iyer", "Khanna", "Sen",
  "Joshi", "Menon", "Bose", "Malik", "Desai", "Bhat", "Saxena", "Gill", "Sethi", "Dutta",
  "Kulkarni", "Chawla", "Roy", "Reddy", "Fernandes", "Pillai", "Arora", "Mishra", "Khan", "Ghosh",
];
const teacherNames = [
  ["Rhea", "Bennett"], ["Omar", "Foster"], ["Lina", "Park"], ["Theo", "Carter"],
  ["Amara", "Wells"], ["Noah", "Reed"], ["Elena", "Brooks"], ["Milo", "Hayes"],
  ["Nora", "Price"], ["Eli", "Rivera"], ["Ivy", "Collins"], ["Zane", "Murphy"],
  ["Maya", "Ross"], ["Leo", "Baker"],
] as const;
const teacherSubjects = ["Science", "English", "History", "Computer Science", "Mathematics"] as const;

type DemoRole = "admin" | "teacher" | "student";

interface DemoStudent {
  id: number;
  studentNumber: string;
  classId: number;
}

interface DemoClass {
  id: number;
  name: string;
  section: string;
  teacherUserId: number | null;
}

async function ensureUser(client: PoolClient, email: string, role: DemoRole, passwordHash: string): Promise<number> {
  await client.query(
    "INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING",
    [email, passwordHash, role],
  );
  const result = await client.query<{ id: string; role: string }>("SELECT id,role FROM users WHERE email=$1", [email]);
  const user = result.rows[0];
  if (!user || user.role !== role) throw new Error(`The demo login ${email} already exists with an incompatible role.`);
  return Number(user.id);
}

async function ensureTeacher(
  client: PoolClient,
  userId: number,
  firstName: string,
  lastName: string,
  employeeNumber: string,
  subject: string,
): Promise<number> {
  await client.query(
    `INSERT INTO teachers(user_id,first_name,last_name,employee_number,subject)
     VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO NOTHING`,
    [userId, firstName, lastName, employeeNumber, subject],
  );
  const result = await client.query<{ id: string }>("SELECT id FROM teachers WHERE user_id=$1", [userId]);
  if (!result.rows[0]) throw new Error(`Could not resolve the teacher profile for ${employeeNumber}.`);
  return Number(result.rows[0].id);
}

function pad(value: number, width = 3): string {
  return String(value).padStart(width, "0");
}

function fictionalBirthDate(number: number): string {
  const year = 2010 + (number % 4);
  const month = ((number - 2) % 12) + 1;
  const day = ((number * 7) % 27) + 1;
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo seed is disabled when NODE_ENV=production.");
  }

  const [adminHash, teacherHash, studentHash] = await Promise.all([
    bcrypt.hash("Admin@12345", 12),
    bcrypt.hash("Teacher@12345", 12),
    bcrypt.hash("Student@12345", 12),
  ]);

  const counts = await inTransaction(pool, async (client) => {
    const adminId = await ensureUser(client, "admin@school.local", "admin", adminHash);
    const teacherIds: number[] = [];

    const baselineTeacherUserId = await ensureUser(client, "teacher@school.local", "teacher", teacherHash);
    teacherIds.push(await ensureTeacher(client, baselineTeacherUserId, "Avery", "Morgan", "T-1001", "Mathematics"));

    for (let teacherNumber = 2; teacherNumber <= TARGET_TEACHERS; teacherNumber += 1) {
      const index = teacherNumber - 2;
      const [firstName, lastName] = teacherNames[index] ?? ["Demo", `Teacher${teacherNumber}`];
      const email = `teacher${pad(teacherNumber)}@staff.example.test`;
      const userId = await ensureUser(client, email, "teacher", teacherHash);
      teacherIds.push(await ensureTeacher(
        client,
        userId,
        firstName,
        lastName,
        `T-${pad(1000 + teacherNumber)}`,
        teacherSubjects[index % teacherSubjects.length] ?? "Mathematics",
      ));
    }

    const demoClasses: DemoClass[] = [];
    let classIndex = 0;
    for (const grade of CLASS_GROUPS) {
      for (const section of SECTIONS) {
        const teacherPosition = classIndex % teacherIds.length;
        const teacherId = teacherIds[teacherPosition] ?? teacherIds[0];
        await client.query(
          `INSERT INTO classes(name,section,teacher_id) VALUES($1,$2,$3)
           ON CONFLICT(name,section) DO NOTHING`,
          [grade, section, teacherId],
        );
        const result = await client.query<{ id: string; teacher_user_id: string | null }>(
          `SELECT c.id,t.user_id AS teacher_user_id FROM classes c
           LEFT JOIN teachers t ON t.id=c.teacher_id WHERE c.name=$1 AND c.section=$2`,
          [grade, section],
        );
        if (!result.rows[0]) throw new Error(`Could not resolve class ${grade} ${section}.`);
        demoClasses.push({ id: Number(result.rows[0].id), name: grade, section, teacherUserId: result.rows[0].teacher_user_id ? Number(result.rows[0].teacher_user_id) : null });
        classIndex += 1;
      }
    }

    const baselineStudentUserId = await ensureUser(client, "student@school.local", "student", studentHash);
    const baselineClass = demoClasses.find((item) => item.name === "Grade 10" && item.section === "A");
    if (!baselineClass) throw new Error("The baseline class is missing.");
    await client.query(
      `INSERT INTO students(user_id,first_name,last_name,student_number,class_id,date_of_birth,phone)
       VALUES($1,'Jordan','Lee','S-2026-001',$2,'2010-04-12','555-0102')
       ON CONFLICT(user_id) DO NOTHING`,
      [baselineStudentUserId, baselineClass.id],
    );
    const baselineProfile = await client.query<{ id: string; student_number: string; class_id: string | null }>(
      "SELECT id,student_number,class_id FROM students WHERE user_id=$1",
      [baselineStudentUserId],
    );
    if (baselineProfile.rows[0]?.student_number !== "S-2026-001" || !baselineProfile.rows[0]?.class_id) {
      throw new Error("The existing baseline demo student profile conflicts with its stable student ID; no seed changes were committed.");
    }
    const students: DemoStudent[] = [{
      id: Number(baselineProfile.rows[0].id),
      studentNumber: baselineProfile.rows[0].student_number,
      classId: Number(baselineProfile.rows[0].class_id),
    }];

    for (let number = 2; number <= TARGET_STUDENTS; number += 1) {
      const nameIndex = number - 2;
      const email = `student${pad(number)}@students.example.test`;
      const userId = await ensureUser(client, email, "student", studentHash);
      const classRecord = demoClasses[nameIndex % demoClasses.length] ?? baselineClass;
      await client.query(
        `INSERT INTO students(user_id,first_name,last_name,student_number,class_id,date_of_birth,phone,address,created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW() - ($9::int * INTERVAL '1 day'))
         ON CONFLICT(user_id) DO NOTHING`,
        [
          userId,
          firstNames[nameIndex % firstNames.length],
          lastNames[nameIndex % lastNames.length],
          `S-2026-${pad(number)}`,
          classRecord.id,
          fictionalBirthDate(number),
          `555-01${pad((number - 2) % 100, 2)}`,
          `${number} Example Way, Demo Borough, ZZ 00000`,
          number % 180,
        ],
      );
      const verify = await client.query<{ id: string; student_number: string; class_id: string | null }>(
        "SELECT id,student_number,class_id FROM students WHERE user_id=$1",
        [userId],
      );
      if (verify.rows[0]?.student_number !== `S-2026-${pad(number)}`) {
        throw new Error(`A conflicting student profile exists for the demo login ${email}; no records were changed.`);
      }
      if (!verify.rows[0]?.class_id) throw new Error(`The demo student S-2026-${pad(number)} has no class assignment.`);
      students.push({ id: Number(verify.rows[0].id), studentNumber: verify.rows[0].student_number, classId: Number(verify.rows[0].class_id) });
    }

    // Seed thirty school days (weekdays only) so the demo trend resembles a real term.
    await client.query(
      `WITH school_days AS (
         SELECT day::date AS attendance_date
         FROM generate_series(CURRENT_DATE - 41,CURRENT_DATE,INTERVAL '1 day') AS calendar(day)
         WHERE EXTRACT(ISODOW FROM day) BETWEEN 1 AND 5
         ORDER BY attendance_date DESC
         LIMIT 30
       )
       INSERT INTO attendance(student_id,class_id,attendance_date,status,recorded_by)
       SELECT s.id,s.class_id,d.attendance_date,
              CASE WHEN pattern.status_roll < pattern.absent_cutoff THEN 'absent'
                   WHEN pattern.status_roll < pattern.absent_cutoff + pattern.late_cutoff THEN 'late'
                   ELSE 'present' END,
              COALESCE(t.user_id,$1)
       FROM students s
       JOIN classes c ON c.id=s.class_id
       LEFT JOIN teachers t ON t.id=c.teacher_id
       CROSS JOIN school_days d
       CROSS JOIN LATERAL (
         SELECT MOD(s.id * 37 + EXTRACT(DOY FROM d.attendance_date)::bigint * 17
                    + EXTRACT(DOY FROM d.attendance_date)::bigint * EXTRACT(DOY FROM d.attendance_date)::bigint * 3,100) AS status_roll,
                8 + MOD(EXTRACT(DOY FROM d.attendance_date)::int * 7
                        + EXTRACT(ISODOW FROM d.attendance_date)::int * 3,9) AS absent_cutoff,
                1 + MOD(EXTRACT(DOY FROM d.attendance_date)::int * 11
                        + EXTRACT(ISODOW FROM d.attendance_date)::int,4) AS late_cutoff
       ) AS pattern
       WHERE s.status='active' AND s.class_id IS NOT NULL AND s.id=ANY($2::bigint[])
       ON CONFLICT(student_id,class_id,attendance_date) DO NOTHING`,
      [adminId, students.map((student) => student.id)],
    );

    const exams: Array<{ id: number; classId: number; subjectIndex: number; teacherUserId: number }> = [];
    for (const classRecord of demoClasses) {
      for (let subjectIndex = 0; subjectIndex < SUBJECTS.length; subjectIndex += 1) {
        const subject = SUBJECTS[subjectIndex] ?? "Mathematics";
        const title = `Term 1 ${subject}`;
        // Preserve and reuse a pre-existing matching demo exam (including the original Avery/Jordan record).
        let exam = await client.query<{ id: string }>(
          "SELECT id FROM examinations WHERE title=$1 AND class_id=$2 ORDER BY exam_date LIMIT 1",
          [title, classRecord.id],
        );
        if (!exam.rows[0]) {
          const examDate = ["2026-09-15", "2026-09-17", "2026-09-19"][subjectIndex] ?? "2026-09-15";
          await client.query(
            `INSERT INTO examinations(title,class_id,exam_date,max_score,created_by)
             VALUES($1,$2,$3,100,$4) ON CONFLICT(title,class_id,exam_date) DO NOTHING`,
            [title, classRecord.id, examDate, classRecord.teacherUserId ?? adminId],
          );
          exam = await client.query<{ id: string }>(
            "SELECT id FROM examinations WHERE title=$1 AND class_id=$2 ORDER BY exam_date LIMIT 1",
            [title, classRecord.id],
          );
        }
        if (!exam.rows[0]) throw new Error(`Could not resolve ${title} for ${classRecord.name} ${classRecord.section}.`);
        exams.push({ id: Number(exam.rows[0].id), classId: classRecord.id, subjectIndex, teacherUserId: classRecord.teacherUserId ?? adminId });
      }
    }

    for (const exam of exams) {
      await client.query(
        `INSERT INTO academic_results(student_id,examination_id,score,recorded_by)
         SELECT s.id,$1,50 + ((s.id * 17 + $2 * 11) % 46),$3
         FROM students s WHERE s.class_id=$4 AND s.status='active' AND s.id=ANY($5::bigint[])
         ON CONFLICT(student_id,examination_id) DO NOTHING`,
        [exam.id, exam.subjectIndex, exam.teacherUserId, exam.classId, students.filter((student) => student.classId === exam.classId).map((student) => student.id)],
      );
    }

    // Annual tuition has three deterministic states: pending, partial, or paid.
    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      if (!student) continue;
      const amount = 72000 + ((index % 5) * 6000);
      await client.query(
        `INSERT INTO fee_records(student_id,description,academic_year,amount,due_date,created_by)
         VALUES($1,'Annual tuition','2026-27',$2,'2027-03-31',$3)
         ON CONFLICT(student_id,description,academic_year) DO NOTHING`,
        [student.id, amount, adminId],
      );
      const feeResult = await client.query<{ id: string; amount: string }>(
        "SELECT id,amount FROM fee_records WHERE student_id=$1 AND description='Annual tuition' AND academic_year='2026-27'",
        [student.id],
      );
      const fee = feeResult.rows[0];
      if (!fee) throw new Error(`Could not resolve the tuition record for ${student.studentNumber}.`);
      const state = index % 3;
      if (state === 0) continue;
      const feeAmount = Number(fee.amount);
      const paymentAmount = state === 1 ? Math.round(feeAmount * 0.4 * 100) / 100 : feeAmount;
      const referenceCode = `DEMO-ANNUAL-${student.studentNumber}`;
      await client.query(
        `INSERT INTO fee_payments(fee_record_id,amount,paid_at,reference_code,recorded_by)
         VALUES($1,$2,TIMESTAMPTZ '2026-09-20 12:00:00+00' + ($3::int * INTERVAL '1 day'),$4,$5)
         ON CONFLICT(reference_code) DO NOTHING`,
        [fee.id, paymentAmount, index % 20, referenceCode, adminId],
      );
    }

    const totals = await client.query<Record<string, string>>(
      `SELECT (SELECT COUNT(*) FROM users)::text AS users,
              (SELECT COUNT(*) FROM teachers)::text AS teachers,
              (SELECT COUNT(*) FROM classes)::text AS classes,
              (SELECT COUNT(*) FROM students)::text AS students,
              (SELECT COUNT(*) FROM attendance)::text AS attendance,
              (SELECT COUNT(*) FROM examinations)::text AS examinations,
              (SELECT COUNT(*) FROM academic_results)::text AS academic_results,
              (SELECT COUNT(*) FROM fee_records)::text AS fee_records,
              (SELECT COUNT(*) FROM fee_payments)::text AS fee_payments`,
    );
    return totals.rows[0] ?? {};
  });

  console.log("Fictional local demo data is ready. Existing account passwords and profiles were not overwritten.");
  console.log("Database totals:", JSON.stringify(counts));
  console.log("New demo teacher and student accounts use their role demo password shown in the README.");
}

seed()
  .catch((error: unknown) => {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "Unknown seed error.";
    const safeMessage = message.replace(/(password\s*[:=]\s*)\S+/gi, "$1[redacted]");
    console.error("Database seeding failed.", code ? `Database error code: ${code}.` : "", safeMessage);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
