ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS manage_template text NOT NULL DEFAULT 'ecommerce';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_manage_template_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_manage_template_check
  CHECK (manage_template IN ('ecommerce', 'bakery'));
