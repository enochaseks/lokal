create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  reference      text not null unique,
  customer_name  text not null,
  customer_phone text not null,
  note           text,
  items          jsonb not null default '[]',
  total_gbp      numeric(10, 2) not null,
  status         text not null default 'pending_transfer'
                   check (status in ('pending_transfer', 'payment_received', 'cancelled')),
  created_at     timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Merchants can read orders for stores they own
create policy "Merchant reads own store orders" on public.orders
  for select to authenticated
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- Anyone (including anonymous shoppers) can place an order
create policy "Anyone can place an order" on public.orders
  for insert to public
  with check (true);

-- Merchants can update the status of their orders
create policy "Merchant updates own store orders" on public.orders
  for update to authenticated
  using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );
