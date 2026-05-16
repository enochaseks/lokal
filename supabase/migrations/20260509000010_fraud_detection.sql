-- Fraud detection and risk scoring tables

-- Risk scores for profiles
create table if not exists public.profile_risk_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  risk_score integer not null default 0, -- 0-100 (0=safe, 100=definite fraud)
  risk_level text not null default 'low', -- low, medium, high
  fraud_flags text[] default array[]::text[], -- array of detected issues
  flagged_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid references auth.users(id),
  status text default 'pending', -- pending, approved, rejected, blocked
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, store_id)
);

-- Admin review queue
create table if not exists public.fraud_review_queue (
  id uuid default gen_random_uuid() primary key,
  risk_score_id uuid not null references public.profile_risk_scores(id) on delete cascade,
  entity_type text not null, -- 'user' or 'store'
  entity_id uuid not null,
  user_id uuid not null references auth.users(id),
  risk_score integer not null,
  fraud_flags text[] not null,
  reason text,
  status text default 'pending', -- pending, approved, rejected
  assigned_to uuid references auth.users(id),
  assigned_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  unique(risk_score_id)
);

-- Suspicious activity log
create table if not exists public.fraud_activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null, -- 'profile_created', 'store_created', 'review_posted', 'transaction', etc
  entity_type text,
  entity_id uuid,
  risk_flags text[] default array[]::text[],
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.profile_risk_scores enable row level security;
alter table public.fraud_review_queue enable row level security;
alter table public.fraud_activity_log enable row level security;

-- RLS Policies for profile_risk_scores
create policy "Admins can view all risk scores" on public.profile_risk_scores
  for select using (exists(select 1 from auth.users where auth.users.id = auth.uid() and email like '%@lokal%'));

create policy "Users can view their own risk score" on public.profile_risk_scores
  for select using (user_id = auth.uid());

create policy "System can insert risk scores" on public.profile_risk_scores
  for insert with check (true);

create policy "Admins can update risk scores" on public.profile_risk_scores
  for update using (exists(select 1 from auth.users where auth.users.id = auth.uid() and email like '%@lokal%'));

-- RLS Policies for fraud_review_queue
create policy "Admins can view review queue" on public.fraud_review_queue
  for select using (exists(select 1 from auth.users where auth.users.id = auth.uid() and email like '%@lokal%'));

create policy "System can insert into review queue" on public.fraud_review_queue
  for insert with check (true);

create policy "Admins can update review queue" on public.fraud_review_queue
  for update using (exists(select 1 from auth.users where auth.users.id = auth.uid() and email like '%@lokal%'));

-- RLS Policies for fraud_activity_log
create policy "Admins can view activity log" on public.fraud_activity_log
  for select using (exists(select 1 from auth.users where auth.users.id = auth.uid() and email like '%@lokal%'));

create policy "System can insert activity logs" on public.fraud_activity_log
  for insert with check (true);

-- Indexes for performance
create index if not exists idx_profile_risk_scores_user_id on public.profile_risk_scores(user_id);
create index if not exists idx_profile_risk_scores_store_id on public.profile_risk_scores(store_id);
create index if not exists idx_profile_risk_scores_status on public.profile_risk_scores(status);
create index if not exists idx_profile_risk_scores_risk_level on public.profile_risk_scores(risk_level);

create index if not exists idx_fraud_review_queue_status on public.fraud_review_queue(status);
create index if not exists idx_fraud_review_queue_user_id on public.fraud_review_queue(user_id);
create index if not exists idx_fraud_review_queue_entity_id on public.fraud_review_queue(entity_id);

create index if not exists idx_fraud_activity_log_user_id on public.fraud_activity_log(user_id);
create index if not exists idx_fraud_activity_log_activity_type on public.fraud_activity_log(activity_type);
