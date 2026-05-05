-- Allow stores to choose whether they operate as products or services.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS selling_mode TEXT;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_selling_mode_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_selling_mode_check
  CHECK (selling_mode IS NULL OR selling_mode IN ('products', 'services'));

-- Preserve existing behavior for Clothes & Fashion stores that already configured schedules.
UPDATE public.stores s
SET selling_mode = 'services'
WHERE s.category = 'Clothes & Fashion'
  AND EXISTS (
    SELECT 1 FROM public.store_availability a WHERE a.store_id = s.id
  )
  AND s.selling_mode IS NULL;
