-- Reviews table
create table if not exists public.reviews (
  id           uuid      primary key default gen_random_uuid(),
  store_id     uuid      references public.stores(id) on delete cascade not null,
  reviewer_name text     not null check (char_length(reviewer_name) between 2 and 80),
  rating       smallint  not null check (rating between 1 and 5),
  body         text      check (body is null or char_length(body) <= 500),
  created_at   timestamptz default now() not null
);
alter table public.reviews enable row level security;
-- Anyone can read reviews
create policy "reviews_public_read"
  on public.reviews for select
  using (true);
-- Anyone can leave a review (no auth required — good for browse-and-rate UX)
create policy "reviews_public_insert"
  on public.reviews for insert
  with check (rating between 1 and 5);
-- Merchants / admins cannot delete each others' reviews (default deny on delete)
-- Add realtime support
alter publication supabase_realtime add table public.reviews;
