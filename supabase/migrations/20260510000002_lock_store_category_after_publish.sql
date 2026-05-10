-- Lock category changes once a store has been published at least once.

alter table public.stores
  add column if not exists category_locked boolean not null default false;

-- Backfill existing live stores so their category becomes immutable.
update public.stores
set category_locked = true
where published = true
  and category_locked = false;

create or replace function public.lock_store_category_after_publish()
returns trigger
language plpgsql
as $$
begin
  -- Once a store is published, lock its category permanently.
  if new.published = true then
    new.category_locked := true;
  end if;

  if old.category_locked = true and new.category is distinct from old.category then
    raise exception 'Category changes are locked after first publish';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lock_store_category_after_publish on public.stores;

create trigger trg_lock_store_category_after_publish
before update on public.stores
for each row
execute function public.lock_store_category_after_publish();
