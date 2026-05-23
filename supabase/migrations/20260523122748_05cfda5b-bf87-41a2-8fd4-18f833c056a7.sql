
-- Add DB connection fields to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS supabase_url text,
  ADD COLUMN IF NOT EXISTS supabase_anon_key text,
  ADD COLUMN IF NOT EXISTS supabase_service_key text;

-- Products table (flexible JSON per project)
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_project ON public.products(project_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients view their products"
  ON public.products FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = products.project_id AND p.client_id = auth.uid()
  ));

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
