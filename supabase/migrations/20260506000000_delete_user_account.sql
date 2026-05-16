-- Allow a user to delete their own account (all stores cascade, then auth user)
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Delete all stores owned by the caller (cascades to store_products, bookings etc.)
  delete from public.stores where owner_id = auth.uid();
  -- Delete the auth user record (requires security definer + service role grants)
  delete from auth.users where id = auth.uid();
end;
$$;
-- Grant execute to authenticated users only
revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
