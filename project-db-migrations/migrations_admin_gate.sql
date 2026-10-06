-- Admin password gate for the clothing store settings page.
-- Run this in the clothing-store Supabase SQL Editor (not Madar platform).

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS admin_gate_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_gate_password TEXT;

NOTIFY pgrst, 'reload schema';
