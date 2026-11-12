-- 009_sessions_coverage.sql
-- Add recording duration and coverage warning flag to sessions

alter table public.sessions add column if not exists recording_duration_sec double precision;
alter table public.sessions add column if not exists coverage_warning boolean default false;
