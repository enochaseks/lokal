-- Add per-product / per-service image to store_products.
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS image_url TEXT;
