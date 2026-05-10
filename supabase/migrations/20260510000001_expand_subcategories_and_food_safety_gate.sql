-- Expand supported subcategories and enforce food safety requirements for Meat & Fish stores.

alter table public.stores
  add column if not exists health_safety_certificate_url text,
  add column if not exists health_safety_certificate_status text not null default 'not_required';

alter table public.stores
  drop constraint if exists stores_health_safety_certificate_status_check;

alter table public.stores
  add constraint stores_health_safety_certificate_status_check
  check (health_safety_certificate_status in ('not_required', 'pending', 'approved', 'rejected'));

alter table public.stores
  drop constraint if exists stores_subcategory_valid_check;

alter table public.stores
  add constraint stores_subcategory_valid_check
  check (
    subcategory is null
    or (
      category = 'Groceries'
      and subcategory = any (array[
        'Fresh Produce',
        'Meat & Fish',
        'Pantry Staples',
        'Spices & Seasoning',
        'Frozen Foods',
        'Drinks',
        'Snacks'
      ]::text[])
    )
    or (
      category = 'Barbers'
      and subcategory = any (array[
        'Haircut & Fade',
        'Beard Grooming',
        'Kids Cuts',
        'Home Service Haircut',
        'Mobile Grooming'
      ]::text[])
    )
    or (
      category = 'Hair & Beauty'
      and subcategory = any (array[
        'Makeup',
        'Braids',
        'Wig Install',
        'Locs',
        'Natural Hair Care',
        'Lashes & Brows',
        'Nails'
      ]::text[])
    )
    or (
      category = 'Beauty Store'
      and subcategory = any (array[
        'Skincare Products',
        'Hair Products',
        'Cosmetics',
        'Tools & Accessories',
        'Fragrances',
        'Body Care'
      ]::text[])
    )
    or (
      category = 'Clothes & Fashion'
      and (
        (
          coalesce(selling_mode, 'products') = 'products'
          and subcategory = any (array[
            'Men''s Wear',
            'Women''s Wear',
            'Kids Wear',
            'Accessories',
            'Shoes'
          ]::text[])
        )
        or (
          selling_mode = 'services'
          and subcategory = any (array[
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
  );

alter table public.stores
  drop constraint if exists stores_meat_fish_certificate_required_check;

alter table public.stores
  add constraint stores_meat_fish_certificate_required_check
  check (
    not (
      category = 'Groceries'
      and subcategory = 'Meat & Fish'
      and health_safety_certificate_url is null
    )
  );

alter table public.stores
  drop constraint if exists stores_meat_fish_publish_approval_check;

alter table public.stores
  add constraint stores_meat_fish_publish_approval_check
  check (
    not (
      published = true
      and category = 'Groceries'
      and subcategory = 'Meat & Fish'
      and health_safety_certificate_status <> 'approved'
    )
  );

create index if not exists idx_stores_health_safety_certificate_status on public.stores(health_safety_certificate_status);
