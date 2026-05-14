-- Weekly merchant rating digest (opt-in)

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS rating_digest_opt_in boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.merchant_rating_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  sent_to text,
  rating_count int NOT NULL DEFAULT 0,
  avg_rating numeric(3,2),
  low_rating_count int NOT NULL DEFAULT 0,
  high_rating_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, week_start)
);

CREATE OR REPLACE FUNCTION public.send_pending_merchant_rating_digests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  payload jsonb;
  digest_week_start date := (date_trunc('week', now())::date - interval '7 day')::date;
  digest_week_end date := date_trunc('week', now())::date;
BEGIN
  FOR rec IN
    SELECT s.id AS store_id, s.owner_id
    FROM public.stores s
    WHERE s.rating_digest_opt_in = true
      AND s.owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.merchant_rating_digest_log l
        WHERE l.store_id = s.id
          AND l.week_start = digest_week_start
      )
  LOOP
    payload := jsonb_build_object(
      'store_id', rec.store_id,
      'owner_id', rec.owner_id,
      'week_start', digest_week_start,
      'week_end', digest_week_end
    );

    PERFORM net.http_post(
      url := 'https://aabyxfcrrqivjupawxdu.supabase.co/functions/v1/send-merchant-rating-digest',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload::text
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  existing_job_id int;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'send-merchant-rating-digests-weekly'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'send-merchant-rating-digests-weekly',
    '0 9 * * 1',
    'SELECT public.send_pending_merchant_rating_digests()'
  );
END;
$$;
