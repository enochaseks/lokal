-- Enforce pay_at_store fulfillment for service-first categories.

UPDATE public.stores
SET fulfillment = 'pay_at_store'
WHERE category IN ('Barbers', 'Hair & Beauty', 'Body Arts & Crafts')
  AND fulfillment <> 'pay_at_store';

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_service_categories_pay_at_store_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_service_categories_pay_at_store_check
  CHECK (
    CASE
      WHEN category IN ('Barbers', 'Hair & Beauty', 'Body Arts & Crafts')
        THEN fulfillment = 'pay_at_store'
      ELSE true
    END
  );
