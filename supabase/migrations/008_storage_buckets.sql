-- 008_storage_buckets.sql
-- Create private storage bucket for user audio recordings and TTS output

insert into storage.buckets (id, name, public)
values ('speaksharp-audio', 'speaksharp-audio', false)
on conflict (id) do nothing;

-- RLS on storage.objects
create policy "Users can upload audio to their own directory"
  on storage.objects for insert
  with check (
    bucket_id = 'speaksharp-audio' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view and download their own audio objects"
  on storage.objects for select
  using (
    bucket_id = 'speaksharp-audio' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

