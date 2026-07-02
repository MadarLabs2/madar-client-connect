-- Run on the store project Supabase (e.g. Heba Fashion), NOT on Madar platform DB.
-- Links guest orders to registered customers by matching customer_email to profiles.email.

UPDATE public.orders o
SET user_id = p.id
FROM public.profiles p
WHERE o.user_id IS NULL
  AND o.customer_email IS NOT NULL
  AND trim(o.customer_email) <> ''
  AND lower(trim(o.customer_email)) = lower(trim(p.email));
