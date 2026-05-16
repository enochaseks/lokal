ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS delivery_fee_gbp numeric(10, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stores_delivery_fee_gbp_nonnegative_check'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_delivery_fee_gbp_nonnegative_check CHECK (delivery_fee_gbp >= 0);
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS items_subtotal_gbp numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_gbp numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'collection';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_items_subtotal_gbp_nonnegative_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_items_subtotal_gbp_nonnegative_check CHECK (items_subtotal_gbp >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_delivery_fee_gbp_nonnegative_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_fee_gbp_nonnegative_check CHECK (delivery_fee_gbp >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_fulfillment_method_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_method_check
      CHECK (fulfillment_method IN ('collection', 'delivery'));
  END IF;
END $$;

UPDATE public.orders
SET
  delivery_fee_gbp = COALESCE(delivery_fee_gbp, 0),
  items_subtotal_gbp = CASE
    WHEN COALESCE(items_subtotal_gbp, 0) > 0 THEN items_subtotal_gbp
    ELSE GREATEST(COALESCE(total_gbp, 0) - COALESCE(delivery_fee_gbp, 0), 0)
  END,
  fulfillment_method = CASE
    WHEN COALESCE(delivery_fee_gbp, 0) > 0 THEN 'delivery'
    ELSE COALESCE(fulfillment_method, 'collection')
  END;
