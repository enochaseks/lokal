-- Keep origin required, but avoid hard-coding a short allow-list that drifts from frontend options.

alter table public.stores
  drop constraint if exists stores_origin_allowed_check;

alter table public.stores
  add constraint stores_origin_allowed_check
  check (origin is not null and btrim(origin) <> '');

select 'success' as status;
