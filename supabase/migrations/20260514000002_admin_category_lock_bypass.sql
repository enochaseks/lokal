-- Allow admins to override category lock after first publish.
-- Non-admin merchants remain blocked by the same trigger exception.

create or replace function public.lock_store_category_after_publish()
returns trigger
language plpgsql
as $$
begin
  -- Once a store is published, keep the lock marker enabled.
  if new.published = true then
    new.category_locked := true;
  end if;

  -- Block category changes if locked, unless user is admin.
  if old.category_locked = true
     and new.category is distinct from old.category
     and not (coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false)
              or coalesce(public.is_admin_email(), false)) then
    raise exception 'Category changes are locked after first publish';
  end if;

  return new;
end;
$$;

select 'success' as status;
