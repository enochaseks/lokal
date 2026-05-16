-- Add region and currency columns to stores table
alter table public.stores add column if not exists region text default 'GB' check (region in ('GB', 'NG', 'JM'));
alter table public.stores add column if not exists currency text default 'GBP' check (currency in ('GBP', 'NGN', 'JMD'));
create index if not exists idx_stores_region on public.stores(region);
