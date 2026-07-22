-- Shipping zones for Heba Fashion (clothing store).
-- Admin manages area name + price in Madar settings; checkout picks a zone for home delivery.
-- Run in the clothing store Supabase SQL Editor (project nhqghbvcsqbxchvcqgen).

CREATE TABLE IF NOT EXISTS public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he TEXT NOT NULL DEFAULT '',
  name_ar TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shipping_zones_name_required CHECK (
    length(trim(name_he)) > 0
    OR length(trim(name_ar)) > 0
    OR length(trim(name_en)) > 0
  )
);

CREATE INDEX IF NOT EXISTS shipping_zones_active_sort_idx
  ON public.shipping_zones (is_active, sort_order);

CREATE OR REPLACE FUNCTION public.set_shipping_zones_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipping_zones_updated_at ON public.shipping_zones;
CREATE TRIGGER trg_shipping_zones_updated_at
  BEFORE UPDATE ON public.shipping_zones
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shipping_zones_updated_at();

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shipping_zones_select_public" ON public.shipping_zones;
CREATE POLICY "shipping_zones_select_public"
  ON public.shipping_zones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "shipping_zones_insert_admin" ON public.shipping_zones;
CREATE POLICY "shipping_zones_insert_admin"
  ON public.shipping_zones FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shipping_zones_update_admin" ON public.shipping_zones;
CREATE POLICY "shipping_zones_update_admin"
  ON public.shipping_zones FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "shipping_zones_delete_admin" ON public.shipping_zones;
CREATE POLICY "shipping_zones_delete_admin"
  ON public.shipping_zones FOR DELETE
  USING (public.is_admin());

-- Optional seed (safe to re-run — only inserts when table is empty)
INSERT INTO public.shipping_zones (name_he, name_ar, name_en, price, is_active, sort_order)
SELECT * FROM (VALUES
  ('מרכז', 'الوسط', 'Center', 50::numeric, true, 0),
  ('צפון', 'الشمال', 'North', 70::numeric, true, 1),
  ('דרום', 'الجنوب', 'South', 70::numeric, true, 2),
  ('ירושלים', 'القدس', 'Jerusalem', 60::numeric, true, 3)
) AS v(name_he, name_ar, name_en, price, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_zones LIMIT 1);

NOTIFY pgrst, 'reload schema';
