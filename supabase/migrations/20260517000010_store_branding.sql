-- Add merchant storefront branding and safe layout controls.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_image_url text,
  ADD COLUMN IF NOT EXISTS brand_primary_color text,
  ADD COLUMN IF NOT EXISTS brand_accent_color text,
  ADD COLUMN IF NOT EXISTS button_style text NOT NULL DEFAULT 'pill',
  ADD COLUMN IF NOT EXISTS font_preset text NOT NULL DEFAULT 'display',
  ADD COLUMN IF NOT EXISTS show_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_hours boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_socials boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_featured_products boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS section_order text[] NOT NULL DEFAULT ARRAY['featured_products', 'hours', 'socials', 'reviews']::text[];

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_button_style_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_button_style_check
  CHECK (button_style IN ('rounded', 'pill', 'square'));

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_font_preset_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_font_preset_check
  CHECK (font_preset IN ('display', 'sans', 'mono'));

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_section_order_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_section_order_check
  CHECK (
    section_order <@ ARRAY['featured_products', 'hours', 'socials', 'reviews']::text[]
    AND cardinality(section_order) BETWEEN 1 AND 4
  );

SELECT 'success' AS status;
