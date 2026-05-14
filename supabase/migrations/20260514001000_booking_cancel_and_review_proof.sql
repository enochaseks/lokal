-- Booking reliability and review proof updates

ALTER TABLE public.store_bookings
  ADD COLUMN IF NOT EXISTS cancelled_by text
    CHECK (cancelled_by IN ('customer', 'merchant', 'system')),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_late boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS proof_image_url text;

ALTER TABLE public.staff_reviews
  ADD COLUMN IF NOT EXISTS proof_image_url text;
