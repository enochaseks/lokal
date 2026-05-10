-- Add store timezone for global open/closed accuracy.

alter table public.stores
  add column if not exists timezone text;

update public.stores
set timezone = 'UTC'
where timezone is null
  or btrim(timezone) = '';

alter table public.stores
  alter column timezone set default 'UTC';

alter table public.stores
  alter column timezone set not null;

create index if not exists idx_stores_timezone on public.stores (timezone);
