-- Run on the store project Supabase (e.g. Heba Fashion), NOT on Madar platform DB.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS hidden_from_admin_at timestamptz;

COMMENT ON COLUMN public.orders.hidden_from_admin_at IS
  'When set, order is hidden from admin list only; customer still sees it in My Orders.';

CREATE OR REPLACE FUNCTION public.admin_hide_received_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET hidden_from_admin_at = now()
  WHERE id = p_order_id
    AND status = 'received'
    AND hidden_from_admin_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_HIDE_FAILED';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_hide_received_order(uuid) TO authenticated, service_role;
