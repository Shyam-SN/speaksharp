-- 005_metrics.sql
-- Create metrics table

create table if not exists public.metrics (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  wpm double precision not null,
  filler_count integer not null,
  filler_rate double precision not null,
  pause_count integer not null,
  longest_pause double precision not null,
  lexical_diversity double precision not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.metrics enable row level security;

-- Policies: only owner of the associated session can read/modify
create policy "Users can view metrics of their own sessions"
  on public.metrics for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = metrics.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert metrics for their own sessions"
  on public.metrics for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = metrics.session_id
        and s.user_id = auth.uid()
    )
  );

