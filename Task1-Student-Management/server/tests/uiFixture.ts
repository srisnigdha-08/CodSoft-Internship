import bcrypt from "bcryptjs";
import { inTransaction } from "../src/database.js";
import {
  TEST_DATABASE, countIntegrationRows, createIntegrationPool,
  prepareIntegrationDatabase, resetIntegrationFixtures,
} from "./integrationDb.js";

const mode = process.argv[2];
if (mode !== "setup" && mode !== "cleanup") {
  throw new Error("Use: npx tsx tests/uiFixture.ts setup|cleanup");
}

const pool = createIntegrationPool();
try {
  await prepareIntegrationDatabase(pool);
  await resetIntegrationFixtures(pool);
  if (mode === "setup") {
    const hash = await bcrypt.hash("UiIntegration@12345", 4);
    await inTransaction(pool, async (client) => {
      const admin = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin') RETURNING id",
        ["admin-ui@integration.example.test", hash],
      );
      const teacherUser = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'teacher') RETURNING id",
        ["teacher-ui@integration.example.test", hash],
      );
      const teacher = await client.query<{ id: string }>(
        "INSERT INTO teachers(user_id,first_name,last_name,employee_number,subject) VALUES($1,'Test','Teacher','UI-T1','Mathematics') RETURNING id",
        [teacherUser.rows[0]?.id],
      );
      const schoolClass = await client.query<{ id: string }>(
        "INSERT INTO classes(name,section,teacher_id) VALUES('UI Test Grade','A',$1) RETURNING id",
        [teacher.rows[0]?.id],
      );
      const otherTeacherUser = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'teacher') RETURNING id",
        ["teacher-other-ui@integration.example.test", hash],
      );
      const otherTeacher = await client.query<{ id: string }>(
        "INSERT INTO teachers(user_id,first_name,last_name,employee_number,subject) VALUES($1,'Other','Teacher','UI-T2','Science') RETURNING id",
        [otherTeacherUser.rows[0]?.id],
      );
      const otherClass = await client.query<{ id: string }>(
        "INSERT INTO classes(name,section,teacher_id) VALUES('UI Test Grade','B',$1) RETURNING id",
        [otherTeacher.rows[0]?.id],
      );
      const studentUser = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'student') RETURNING id",
        ["student-ui@integration.example.test", hash],
      );
      const student = await client.query<{ id: string }>(
        "INSERT INTO students(user_id,first_name,last_name,student_number,class_id) VALUES($1,'Test','Learner','UI-S1',$2) RETURNING id",
        [studentUser.rows[0]?.id, schoolClass.rows[0]?.id],
      );
      const otherStudentUser = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,'student') RETURNING id",
        ["student-other-ui@integration.example.test", hash],
      );
      const otherStudent = await client.query<{ id: string }>(
        "INSERT INTO students(user_id,first_name,last_name,student_number,class_id) VALUES($1,'Other','Learner','UI-S2',$2) RETURNING id",
        [otherStudentUser.rows[0]?.id, otherClass.rows[0]?.id],
      );
      const examination = await client.query<{ id: string }>(
        "INSERT INTO examinations(title,class_id,exam_date,max_score,created_by) VALUES('UI Mathematics',$1,'2026-10-15',100,$2) RETURNING id",
        [schoolClass.rows[0]?.id, teacherUser.rows[0]?.id],
      );
      await client.query(
        "INSERT INTO academic_results(student_id,examination_id,score,recorded_by) VALUES($1,$2,84,$3)",
        [student.rows[0]?.id, examination.rows[0]?.id, teacherUser.rows[0]?.id],
      );
      const otherExamination = await client.query<{ id: string }>(
        "INSERT INTO examinations(title,class_id,exam_date,max_score,created_by) VALUES('UI Science',$1,'2026-10-15',100,$2) RETURNING id",
        [otherClass.rows[0]?.id, otherTeacherUser.rows[0]?.id],
      );
      await client.query(
        "INSERT INTO academic_results(student_id,examination_id,score,recorded_by) VALUES($1,$2,77,$3)",
        [otherStudent.rows[0]?.id, otherExamination.rows[0]?.id, otherTeacherUser.rows[0]?.id],
      );
      const fee = await client.query<{ id: string }>(
        "INSERT INTO fee_records(student_id,description,academic_year,amount,due_date,created_by) VALUES($1,'UI tuition','2026-27',1000,'2026-11-30',$2) RETURNING id",
        [student.rows[0]?.id, admin.rows[0]?.id],
      );
      await client.query(
        "INSERT INTO fee_payments(fee_record_id,amount,reference_code,recorded_by) VALUES($1,400,'UI-SEED-PAY',$2)",
        [fee.rows[0]?.id, admin.rows[0]?.id],
      );
      await client.query(
        "INSERT INTO fee_records(student_id,description,academic_year,amount,due_date,created_by) VALUES($1,'UI tuition','2026-27',800,'2026-11-30',$2)",
        [otherStudent.rows[0]?.id, admin.rows[0]?.id],
      );
    });
    console.log(`Temporary browser fixtures created in ${TEST_DATABASE}.`);
  } else {
    const count = await countIntegrationRows(pool);
    if (count !== 0) throw new Error("Browser fixture cleanup did not leave the test database empty.");
    console.log(`Temporary browser fixtures removed from ${TEST_DATABASE}; data-row count: 0.`);
  }
} finally {
  await pool.end();
}
