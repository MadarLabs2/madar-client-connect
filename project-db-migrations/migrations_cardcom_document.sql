-- Run on the store project Supabase (e.g. Heba Fashion), NOT on Madar platform DB.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cardcom_document_number text,
  ADD COLUMN IF NOT EXISTS cardcom_document_type text,
  ADD COLUMN IF NOT EXISTS cardcom_document_url text;

COMMENT ON COLUMN public.orders.cardcom_document_number IS 'Cardcom document number after payment.';
COMMENT ON COLUMN public.orders.cardcom_document_type IS 'Cardcom document type (e.g. TaxInvoiceAndReceipt).';
COMMENT ON COLUMN public.orders.cardcom_document_url IS 'Public URL to Cardcom invoice PDF.';
