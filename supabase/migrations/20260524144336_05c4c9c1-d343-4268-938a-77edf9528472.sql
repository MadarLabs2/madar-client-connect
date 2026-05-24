
-- 1) Create admin-only secrets table
CREATE TABLE public.project_secrets (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  supabase_url text,
  supabase_anon_key text,
  supabase_service_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project secrets"
ON public.project_secrets
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER project_secrets_updated_at
BEFORE UPDATE ON public.project_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Copy existing credentials
INSERT INTO public.project_secrets (project_id, supabase_url, supabase_anon_key, supabase_service_key)
SELECT id, supabase_url, supabase_anon_key, supabase_service_key
FROM public.projects
WHERE supabase_url IS NOT NULL
   OR supabase_anon_key IS NOT NULL
   OR supabase_service_key IS NOT NULL;

-- 3) Drop credential columns from projects (which is client-readable via RLS)
ALTER TABLE public.projects DROP COLUMN supabase_url;
ALTER TABLE public.projects DROP COLUMN supabase_anon_key;
ALTER TABLE public.projects DROP COLUMN supabase_service_key;
