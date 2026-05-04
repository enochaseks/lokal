ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS fulfillment text NOT NULL DEFAULT 'collection'
  CHECK (fulfillment IN ('collection', 'delivery', 'both'));
