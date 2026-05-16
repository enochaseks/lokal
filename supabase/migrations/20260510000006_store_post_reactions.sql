create table if not exists public.store_post_reactions (
  post_id uuid not null references public.store_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('helpful', 'interested', 'love_it')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.store_post_reactions enable row level security;

create policy "Public read store_post_reactions"
  on public.store_post_reactions for select
  using (true);

create policy "Users manage own store_post_reactions"
  on public.store_post_reactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
