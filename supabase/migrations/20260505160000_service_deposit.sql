-- Add per-service deposit amount to store_products.
-- Replaces the store-level deposit_amount for new stores.
ALTER TABLE public.store_products
  ADD COLUMN IF NOT EXISTS deposit numeric;
