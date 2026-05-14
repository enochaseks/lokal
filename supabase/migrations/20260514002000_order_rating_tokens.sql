-- Order rating email support

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rating_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rating_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_completed boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS orders_rating_token_idx ON public.orders(rating_token);
