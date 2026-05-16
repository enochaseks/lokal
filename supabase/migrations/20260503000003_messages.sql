create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  body text not null,
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  created_at timestamptz default now() not null
);
alter table messages enable row level security;
-- Merchants can read messages for their own stores
create policy "Merchants read own store messages" on messages
  for select using (
    exists (select 1 from stores where stores.id = messages.store_id and stores.owner_id = auth.uid())
  );
-- Anyone can send an inbound message (customers)
create policy "Anyone can send inbound message" on messages
  for insert with check (direction = 'inbound');
-- Enable realtime for messages table
alter publication supabase_realtime add table messages;
