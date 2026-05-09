-- Enforce verification flow: only stores with an approved request remain verified.

-- 1) Normalize existing data so no store is verified without an approved request.
UPDATE public.stores s
SET
  is_verified = false,
  verified_at = null,
  verification_reason = null
WHERE
  s.is_verified = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.store_verification_requests r
    WHERE r.store_id = s.id
      AND r.status = 'approved'
  );

-- 2) Allow public read access to approved verification requests (used to validate badge display).
CREATE POLICY "Public can view approved verification requests"
  ON public.store_verification_requests
  FOR SELECT
  USING (status = 'approved');
