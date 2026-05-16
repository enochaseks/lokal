-- Add rating token columns to store_bookings so we can send post-appointment rating emails
ALTER TABLE public.store_bookings
  ADD COLUMN IF NOT EXISTS rating_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rating_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_completed boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS store_bookings_rating_token_idx ON public.store_bookings(rating_token);
-- Function called by pg_cron: sends rating request emails for appointments that have ended
CREATE OR REPLACE FUNCTION public.send_pending_rating_emails()
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
      b.rating_token,
      b.customer_name,
      b.customer_email,
      b.staff_name,
      b.slot_start,
      s.name  AS store_name,
      s.id    AS store_id
    FROM public.store_bookings b
    JOIN public.stores s ON s.id = b.store_id
    WHERE b.slot_end < NOW()
      AND b.rating_sent = false
      AND b.rating_completed = false
      AND b.customer_email IS NOT NULL
      AND b.status <> 'cancelled'
  LOOP
    payload := jsonb_build_object(
      'booking_id',     rec.id,
      'rating_token',   rec.rating_token,
      'customer_name',  rec.customer_name,
      'customer_email', rec.customer_email,
      'staff_name',     rec.staff_name,
      'store_name',     rec.store_name,
      'store_id',       rec.store_id,
      'slot_start',     rec.slot_start
    );

    PERFORM net.http_post(
      url     := 'https://aabyxfcrrqivjupawxdu.supabase.co/functions/v1/send-rating-request',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := payload::text
    );

    UPDATE public.store_bookings SET rating_sent = true WHERE id = rec.id;
  END LOOP;
END;
$$;
-- Schedule: run every hour at :05 past (requires pg_cron extension — enable in Supabase Dashboard > Database > Extensions)
SELECT cron.schedule(
  'send-rating-emails',
  '5 * * * *',
  'SELECT public.send_pending_rating_emails()'
);
