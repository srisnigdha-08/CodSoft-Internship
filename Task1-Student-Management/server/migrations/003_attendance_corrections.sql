-- Append-only application history for attendance status corrections.
-- Existing attendance rows and status values are left untouched.
CREATE TABLE public.attendance_corrections (
  id BIGSERIAL PRIMARY KEY,
  attendance_id BIGINT NOT NULL REFERENCES public.attendance(id) ON DELETE RESTRICT,
  previous_status VARCHAR(16) NOT NULL CHECK (previous_status IN ('present', 'absent', 'late')),
  new_status VARCHAR(16) NOT NULL CHECK (new_status IN ('present', 'absent', 'late')),
  corrected_by BIGINT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_corrections_changed CHECK (previous_status <> new_status)
);

CREATE INDEX idx_attendance_corrections_record_time
  ON public.attendance_corrections(attendance_id, corrected_at DESC, id DESC);
