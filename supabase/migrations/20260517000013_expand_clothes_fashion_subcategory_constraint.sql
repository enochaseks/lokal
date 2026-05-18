-- Expand Clothes & Fashion subcategories to match the current merchant form.

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
            'Unisex',
            'Clothing Store',
            'African Traditional Wear',
            'Sportswear & Trainers',
            'Shoes',
            'Bags & Handbags',
            'Jewellery & Watches',
            'Accessories',
            'Vintage & Second-Hand',
            'Crochet'
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
            'Custom Shoe Making',
            'Shoe & Trainer Cleaning',
            'Shoe Repair & Cobbling',
            'Laundry & Ironing',
            'Clothing Repair'
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

SELECT 'success' AS status;