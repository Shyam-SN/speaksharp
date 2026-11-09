-- 004_transcripts.sql
-- Create transcripts table

create table if not exists public.transcripts (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  text text not null,
  words jsonb default '[]'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.transcripts enable row level security;

-- Policies: only owner of the associated session can read/modify
create policy "Users can view transcripts of their own sessions"
  on public.transcripts for select
  using (
    exists (
      select 1 from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can insert transcripts for their own sessions"
  on public.transcripts for insert
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  );

