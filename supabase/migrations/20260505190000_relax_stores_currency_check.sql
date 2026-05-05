-- Allow ISO-4217 style 3-letter currency codes for all supported regions.
alter table public.stores
  drop constraint if exists stores_currency_check;

alter table public.stores
  add constraint stores_currency_check
  check (currency is null or currency ~ '^[A-Z]{3}$');
