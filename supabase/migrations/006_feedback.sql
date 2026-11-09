-- 006_feedback.sql
-- Create feedback table

create table if not exists public.feedback (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  overall_score integer not null check (overall_score >= 1 and overall_score <= 10),
  payload jsonb not null,
  tts_audio_path text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.feedback enable row level security;

-- Policies: only owner of the associated session can read/modify
create policy "Users can view feedback of their own sessions"
  on public.feedback for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = feedback.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert feedback for their own sessions"
  on public.feedback for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = feedback.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can update feedback for their own sessions"
  on public.feedback for update
  using (
    exists (
      select 1 from public.sessions s
      where s.id = feedback.session_id
        and s.user_id = auth.uid()
    )
  );

