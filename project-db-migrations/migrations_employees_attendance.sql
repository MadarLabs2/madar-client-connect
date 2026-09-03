-- Employees & attendance tracking for the clothing store.
-- Run this in the clothing-store Supabase SQL Editor (not Madar platform).

CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_clock_in ON attendance(clock_in);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_employees" ON employees;
DROP POLICY IF EXISTS "service_role_attendance" ON attendance;

CREATE POLICY "service_role_employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
