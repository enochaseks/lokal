-- Allow all ISO alpha-2 region codes used by the frontend region selector.

alter table public.stores
  drop constraint if exists stores_region_check;

alter table public.stores
  add constraint stores_region_check
  check (region is null or region ~ '^[A-Z]{2}$');

select 'success' as status;
