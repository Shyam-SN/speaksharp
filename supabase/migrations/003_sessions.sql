-- 003_sessions.sql
-- Create sessions table

create type session_status as enum ('processing', 'complete', 'failed');

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  prompt_id uuid references public.prompts(id) on delete set null,
  audio_path text,
  duration_sec double precision,
  status session_status default 'processing' not null,
  error text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.sessions enable row level security;

-- Policies for sessions: users can only manage their own sessions
create policy "Users can view their own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_created_at on public.sessions(created_at desc);

