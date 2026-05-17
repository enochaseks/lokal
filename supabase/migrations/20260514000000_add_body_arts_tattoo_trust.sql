-- Add Body Arts & Crafts category and tattoo trust fields.

ALTER TYPE public.store_category ADD VALUE IF NOT EXISTS 'Body Arts & Crafts';

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS minimum_age integer,
  ADD COLUMN IF NOT EXISTS tattoo_portfolio_url text,
  ADD COLUMN IF NOT EXISTS tattoo_license_url text,
  ADD COLUMN IF NOT EXISTS is_verified_tattoo_artist boolean NOT NULL DEFAULT false;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_subcategory_valid_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_subcategory_valid_check
  CHECK (
    subcategory IS NULL
    OR (
      category = 'Groceries'
      AND subcategory = ANY (ARRAY[
        'Fresh Produce',
        'Meat & Fish',
        'Pantry Staples',
        'Spices & Seasoning',
        'Frozen Foods',
        'Drinks',
        'Snacks'
      ]::text[])
    )
    OR (
      category = 'Barbers'
      AND subcategory = ANY (ARRAY[
        'Haircut & Fade',
        'Beard Grooming',
        'Kids Cuts',
        'Home Service Haircut',
        'Mobile Grooming'
      ]::text[])
    )
    OR (
      category = 'Hair & Beauty'
      AND subcategory = ANY (ARRAY[
        'Makeup',
        'Braids',
        'Wig Install',
        'Locs',
        'Natural Hair Care',
        'Lashes & Brows',
        'Nails',
        'Wigs, Bundles & Extensions'
      ]::text[])
    )
    OR (
      category = 'Beauty Store'
      AND subcategory = ANY (ARRAY[
        'Skincare Products',
        'Hair Products',
        'Cosmetics',
        'Lashes',
        'Body Care'
      ]::text[])
    )
    OR (
      category = 'Clothes & Fashion'
      AND (
        (
          coalesce(selling_mode, 'products') = 'products'
          AND subcategory = ANY (ARRAY[
            'Men''s Wear',
            'Women''s Wear',
            'Kids Wear',
            'Accessories',
            'Shoes'
          ]::text[])
        )
        OR (
          selling_mode = 'services'
          AND subcategory = ANY (ARRAY[
            'Custom Tailoring',
            'Alterations',
            'Bridal & Occasion',
            'Uniforms',
            'Embroidery & Print',
            'Custom Shoe Making'
          ]::text[])
        )
      )
    )
    OR (
      category::text = 'Body Arts & Crafts'
      AND subcategory = ANY (ARRAY[
        'Tattooing',
        'Piercing',
        'Henna',
        'Body Painting',
        'Craft Workshops'
      ]::text[])
    )
  );

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_tattoo_requirements_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_tattoo_requirements_check
  CHECK (
    NOT (
      category::text = 'Body Arts & Crafts'
      AND subcategory = 'Tattooing'
      AND (
        minimum_age IS NULL
        OR minimum_age < 18
        OR tattoo_portfolio_url IS NULL
        OR tattoo_license_url IS NULL
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_stores_category_city ON public.stores(category, city);
CREATE INDEX IF NOT EXISTS idx_stores_tattoo_verified ON public.stores(is_verified_tattoo_artist);

ALTER TABLE public.store_verification_requests
  ADD COLUMN IF NOT EXISTS is_tattoo_verification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tattoo_minimum_age integer,
  ADD COLUMN IF NOT EXISTS tattoo_portfolio_url text,
  ADD COLUMN IF NOT EXISTS tattoo_license_url text,
  ADD COLUMN IF NOT EXISTS tattoo_age_restriction_acknowledged boolean;

ALTER TABLE public.store_verification_requests
  DROP CONSTRAINT IF EXISTS store_verification_requests_tattoo_payload_check;

ALTER TABLE public.store_verification_requests
  ADD CONSTRAINT store_verification_requests_tattoo_payload_check
  CHECK (
    NOT is_tattoo_verification
    OR (
      tattoo_minimum_age IS NOT NULL
      AND tattoo_minimum_age >= 18
      AND tattoo_portfolio_url IS NOT NULL
      AND tattoo_license_url IS NOT NULL
      AND coalesce(tattoo_age_restriction_acknowledged, false) = true
    )
  );

SELECT 'success' AS status;
