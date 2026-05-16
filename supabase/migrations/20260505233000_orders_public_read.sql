-- Allow customer dashboard/profile to read order history.
-- This matches the existing bookings policy model (public read).
drop policy if exists "Public read orders" on public.orders;
create policy "Public read orders"
  on public.orders
  for select
  to public
  using (true);
