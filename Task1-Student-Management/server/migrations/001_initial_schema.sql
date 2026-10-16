-- This migration is additive. It does not delete or rewrite existing records.
-- An unrecognized pre-existing public.students table causes a clear error so it
-- can be reviewed before application code relies on its columns.
DO $$
DECLARE
  missing_columns TEXT;
BEGIN
  IF to_regclass('public.students') IS NOT NULL THEN
    SELECT string_agg(required.column_name, ', ')
      INTO missing_columns
      FROM unnest(ARRAY['id', 'user_id', 'first_name', 'last_name', 'student_number', 'class_id', 'status', 'created_at']) AS required(column_name)
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns column_info
        WHERE column_info.table_schema = 'public'
          AND column_info.table_name = 'students'
          AND column_info.column_name = required.column_name
      );
    IF missing_columns IS NOT NULL THEN
      RAISE EXCEPTION 'Existing public.students table is not compatible. Missing columns: %. Review and write a non-destructive migration before continuing.', missing_columns;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  employee_number VARCHAR(40) NOT NULL UNIQUE,
  subject VARCHAR(120) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classes (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  section VARCHAR(40) NOT NULL DEFAULT 'A',
  teacher_id BIGINT REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, section)
);

CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  student_number VARCHAR(40) NOT NULL UNIQUE,
  class_id BIGINT REFERENCES classes(id) ON DELETE SET NULL,
  date_of_birth DATE,
  phone VARCHAR(32),
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  recorded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, class_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS examinations (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  exam_date DATE NOT NULL,
  max_score NUMERIC(7, 2) NOT NULL CHECK (max_score > 0),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (title, class_id, exam_date)
);

CREATE TABLE IF NOT EXISTS academic_results (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  examination_id BIGINT NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  score NUMERIC(7, 2) NOT NULL CHECK (score >= 0),
  recorded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, examination_id)
);

CREATE TABLE IF NOT EXISTS fee_records (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  description VARCHAR(120) NOT NULL,
  academic_year VARCHAR(16) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, description, academic_year)
);

CREATE TABLE IF NOT EXISTS fee_payments (
  id BIGSERIAL PRIMARY KEY,
  fee_record_id BIGINT NOT NULL REFERENCES fee_records(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference_code VARCHAR(80) NOT NULL UNIQUE,
  recorded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_students_class_status ON students(class_id, status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_attendance_date_class ON attendance(attendance_date, class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_examinations_class_date ON examinations(class_id, exam_date DESC);
CREATE INDEX IF NOT EXISTS idx_results_student ON academic_results(student_id, examination_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_due_date ON fee_records(student_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payments_fee_record ON fee_payments(fee_record_id, paid_at DESC);
