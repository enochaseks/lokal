-- Support online/informal businesses during verification.
ALTER TABLE public.store_verification_requests
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'online_presence',
  ADD COLUMN IF NOT EXISTS online_presence_url text,
  ADD COLUMN IF NOT EXISTS manual_review_details text,
  ADD COLUMN IF NOT EXISTS supporting_links text;

ALTER TABLE public.store_verification_requests
  DROP CONSTRAINT IF EXISTS store_verification_requests_verification_method_check;

ALTER TABLE public.store_verification_requests
  ADD CONSTRAINT store_verification_requests_verification_method_check
  CHECK (verification_method IN ('registration_number', 'online_presence', 'manual_review'));
