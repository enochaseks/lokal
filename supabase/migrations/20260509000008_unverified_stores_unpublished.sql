-- Enforce: Unverified stores cannot be published

-- 1) Unpublish any currently published stores that are not verified
UPDATE public.stores
SET published = false
WHERE published = true AND (is_verified = false OR is_verified IS NULL);

-- 2) Add CHECK constraint to prevent publishing unverified stores
ALTER TABLE public.stores
ADD CONSTRAINT published_requires_verified
CHECK (published = false OR is_verified = true);

-- 3) Add index on is_verified for faster verification lookups
CREATE INDEX IF NOT EXISTS stores_is_verified_idx ON public.stores(is_verified);
