-- DB guard: never allow unverified stores to remain published.
-- This prevents stale clients from tripping published_requires_verified on insert/update.

create or replace function public.coerce_unverified_store_unpublished()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.is_verified, false) = false then
    new.published := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coerce_unverified_store_unpublished on public.stores;

create trigger trg_coerce_unverified_store_unpublished
before insert or update of published, is_verified on public.stores
for each row
execute function public.coerce_unverified_store_unpublished();

select 'success' as status;
