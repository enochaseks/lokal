-- Expand allowed font presets to match the merchant editor options.
ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_font_preset_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_font_preset_check
  CHECK (font_preset IN ('display', 'sans', 'mono', 'script', 'rounded'));

SELECT 'success' AS status;
