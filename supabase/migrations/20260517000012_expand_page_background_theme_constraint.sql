-- Expand allowed page background themes to match the merchant editor options.
ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_page_background_theme_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_page_background_theme_check
  CHECK (page_background_theme IN ('cream', 'primary_tint', 'accent_tint', 'gradient'));

SELECT 'success' AS status;
