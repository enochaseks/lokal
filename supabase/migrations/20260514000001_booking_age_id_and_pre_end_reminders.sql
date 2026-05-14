-- Booking safety and completion confirmation enhancements.

ALTER TABLE public.store_bookings
  ADD COLUMN IF NOT EXISTS age_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS minimum_age_required integer,
  ADD COLUMN IF NOT EXISTS customer_age_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_id_commitment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_age_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_age_verified_by uuid references auth.users(id) on delete set null,
  ADD COLUMN IF NOT EXISTS completion_confirmed_by_merchant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pre_end_confirmation_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_end_confirmation_sent_at timestamptz;

ALTER TABLE public.store_bookings
  DROP CONSTRAINT IF EXISTS store_bookings_age_restricted_fields_check;

ALTER TABLE public.store_bookings
  ADD CONSTRAINT store_bookings_age_restricted_fields_check
  CHECK (
    NOT age_restricted
    OR (
      minimum_age_required IS NOT NULL
      AND minimum_age_required >= 18
      AND customer_age_confirmed = true
      AND customer_id_commitment = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_store_bookings_pre_end_confirmation_sent
  ON public.store_bookings(pre_end_confirmation_sent, slot_end);

CREATE OR REPLACE FUNCTION public.send_pre_end_booking_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  payload jsonb;
BEGIN
  FOR rec IN
    SELECT
      b.id,
      b.store_id,
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      b.service,
      b.staff_name,
      b.slot_start,
      b.slot_end,
      b.age_restricted,
      b.minimum_age_required,
      s.name AS store_name
    FROM public.store_bookings b
    JOIN public.stores s ON s.id = b.store_id
    WHERE b.status = 'confirmed'
      AND b.pre_end_confirmation_sent = false
      AND b.slot_end > now()
      AND b.slot_end <= now() + interval '20 minutes'
  LOOP
    payload := jsonb_build_object(
      'booking_id', rec.id,
      'store_id', rec.store_id,
      'store_name', rec.store_name,
      'customer_name', rec.customer_name,
      'customer_email', rec.customer_email,
      'customer_phone', rec.customer_phone,
      'service', rec.service,
      'staff_name', rec.staff_name,
      'slot_start', rec.slot_start,
      'slot_end', rec.slot_end,
      'age_restricted', rec.age_restricted,
      'minimum_age_required', rec.minimum_age_required
    );

    PERFORM net.http_post(
      url := 'https://aabyxfcrrqivjupawxdu.supabase.co/functions/v1/send-booking-pre-end-reminder',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload::text
    );

    UPDATE public.store_bookings
    SET pre_end_confirmation_sent = true,
        pre_end_confirmation_sent_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-booking-pre-end-reminders');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

SELECT cron.schedule(
  'send-booking-pre-end-reminders',
  '*/5 * * * *',
  'SELECT public.send_pre_end_booking_reminders()'
);

SELECT 'success' AS status;
