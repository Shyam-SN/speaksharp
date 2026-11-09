-- 002_prompts.sql
-- Create prompts table

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  suggested_seconds integer default 60 not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.prompts enable row level security;

-- All authenticated (including anonymous) users can read prompts
create policy "Authenticated users can read prompts"
  on public.prompts for select
  to authenticated
  using (true);

-- Also allow anon key read access for public browsing if needed
create policy "Public can read prompts"
  on public.prompts for select
  to anon
  using (true);

