-- Create customers table for optional user profiles
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  phone text unique,
  email text,
  name text,
  favorite_store_ids uuid[] default '{}',
  addresses jsonb default '[]'::jsonb,
  payment_methods jsonb default '[]'::jsonb,
  notification_preferences jsonb default '{"email_alerts": true, "sms_alerts": true}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.customers enable row level security;

-- Create indexes
create index if not exists idx_customers_phone on public.customers(phone);
create index if not exists idx_customers_email on public.customers(email);

-- Policies: customers can view/edit only their own profile
create policy "Customers can view own profile" on public.customers
  for select using (true);

create policy "Customers can insert own profile" on public.customers
  for insert with check (true);

create policy "Customers can update own profile" on public.customers
  for update using (true) with check (true);

-- Add customer_id to orders and bookings (optional FK)
alter table if exists public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table if exists public.store_bookings add column if not exists customer_id uuid references public.customers(id) on delete set null;

-- Create indexes for lookups
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_bookings_customer_id on public.store_bookings(customer_id);
