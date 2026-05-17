-- Add optional store subcategory with guardrails for supported categories.
alter table public.stores
  add column if not exists subcategory text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stores_subcategory_valid_check'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_subcategory_valid_check
      check (
        subcategory is null
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
            'Lashes',
            'Body Care'
          ]::text[])
        )
      );
  end if;
end
$$;

create index if not exists idx_stores_subcategory on public.stores(subcategory);
