-- Add store verification fields for customer trust and reliability
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS verification_reason text;

-- Create index for faster queries on verified stores
CREATE INDEX IF NOT EXISTS idx_stores_is_verified ON public.stores(is_verified);
