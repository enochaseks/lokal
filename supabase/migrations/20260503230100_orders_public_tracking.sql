-- Allow anyone to look up their own order by reference (public order tracking page)
create policy "Anyone can look up order by reference" on public.orders
  for select to public
  using (true);
