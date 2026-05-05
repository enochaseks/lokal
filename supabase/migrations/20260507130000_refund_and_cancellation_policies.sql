-- Merchant policy fields shown to customers before booking/payment.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS accepts_refunds boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_policy text,
  ADD COLUMN IF NOT EXISTS cancellation_policy text;
