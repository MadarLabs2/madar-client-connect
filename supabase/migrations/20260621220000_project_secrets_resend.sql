-- Per-project Resend credentials (admin-only via project_secrets RLS)
ALTER TABLE public.project_secrets
  ADD COLUMN IF NOT EXISTS resend_api_key text,
  ADD COLUMN IF NOT EXISTS resend_from_email text,
  ADD COLUMN IF NOT EXISTS resend_admin_email text,
  ADD COLUMN IF NOT EXISTS email_test_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_secrets.resend_api_key IS 'Client Resend API key — server only, never expose to browser';
COMMENT ON COLUMN public.project_secrets.resend_from_email IS 'Sender, e.g. Bakery Name <orders@domain.com>';
COMMENT ON COLUMN public.project_secrets.resend_admin_email IS 'Test-mode recipient / admin inbox for this project';
COMMENT ON COLUMN public.project_secrets.email_test_mode IS 'When true, emails go to resend_admin_email only';

ALTER TABLE public.project_secrets
  ADD COLUMN IF NOT EXISTS resend_api_key_set boolean GENERATED ALWAYS AS (
    resend_api_key IS NOT NULL AND btrim(resend_api_key) <> ''
  ) STORED;
