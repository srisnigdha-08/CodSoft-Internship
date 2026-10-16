-- Optional profile detail used by local demonstration data.
-- The column is nullable, so existing student rows remain valid and unchanged.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS address VARCHAR(255);
