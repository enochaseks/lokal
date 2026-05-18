-- Allow customer enquiries to be sent by phone or email.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS customer_email text;

ALTER TABLE public.messages
  ALTER COLUMN customer_phone DROP NOT NULL;

SELECT 'success' AS status;
