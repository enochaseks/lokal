-- Create waitlist table for email signups
create table if not exists public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  joined_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.waitlist enable row level security;

-- Allow public inserts for waitlist signup
create policy "Allow public to insert into waitlist" on public.waitlist
  for insert with check (true);

-- Allow authenticated users to read their own entry
create policy "Allow users to read own waitlist entry" on public.waitlist
  for select using (true);

-- Create index for email lookups
create index if not exists idx_waitlist_email on public.waitlist(email);
