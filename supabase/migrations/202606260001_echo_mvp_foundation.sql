-- Echo MVP Supabase foundation

create type public.entry_status as enum (
  'draft_recording',
  'recorded_locally',
  'uploading_for_transcription',
  'transcribing',
  'transcribed',
  'reflecting',
  'ready',
  'recording_failed',
  'upload_failed',
  'transcription_failed_retryable',
  'transcription_failed_expired',
  'reflection_failed',
  'deleted'
);

create type public.audio_retention_policy as enum ('none', 'temporary', 'retained');
create type public.temporary_audio_status as enum ('created', 'uploaded', 'transcribing', 'deleted', 'expired', 'failed');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_text text not null,
  recorded_at timestamptz not null,
  recorded_date date not null,
  timezone text not null,
  status public.entry_status not null default 'draft_recording',
  transcript text,
  mirror_note text,
  mood_tags text[] not null default '{}',
  memory_quote text,
  duration_ms integer,
  audio_retention_policy public.audio_retention_policy not null default 'none',
  audio_storage_path text,
  audio_mime_type text,
  audio_size_bytes integer,
  audio_deleted_at timestamptz,
  transcription_provider text,
  transcription_model text,
  reflection_provider text,
  reflection_model text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.temporary_audio_jobs (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.temporary_audio_status not null default 'created',
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  expires_at timestamptz not null,
  deleted_at timestamptz,
  attempts integer not null default 0,
  last_error_code text,
  last_error_message text,
  last_error_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entry_events (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.temporary_audio_jobs enable row level security;
alter table public.entry_events enable row level security;

create policy "profiles are owned by user" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "entries are owned by user" on public.entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "temporary audio jobs are owned by user" on public.temporary_audio_jobs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "entry events are owned by user" on public.entry_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index entries_user_recorded_at_idx on public.entries (user_id, recorded_at desc) where deleted_at is null;
create index temporary_audio_jobs_expiry_idx on public.temporary_audio_jobs (expires_at) where deleted_at is null;
alter table public.entries
  add constraint entries_audio_none_has_no_path
  check (audio_retention_policy <> 'none' or audio_storage_path is null);

alter table public.entries
  add constraint entries_duration_ms_non_negative
  check (duration_ms is null or duration_ms >= 0);

alter table public.temporary_audio_jobs
  add constraint temporary_audio_jobs_attempts_non_negative
  check (attempts >= 0);

alter table public.temporary_audio_jobs
  add constraint temporary_audio_jobs_size_non_negative
  check (size_bytes >= 0);

create index entry_events_entry_created_idx on public.entry_events (entry_id, created_at asc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'temporary-audio',
  'temporary-audio',
  false,
  26214400,
  array['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "temporary audio objects are user scoped" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'temporary-audio'
    and (storage.foldername(name))[1] = 'tmp-transcription'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'temporary-audio'
    and (storage.foldername(name))[1] = 'tmp-transcription'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Temporary audio is private and must be deleted by the workflow after transcription.
-- Store objects under tmp-transcription/{user_id}/{entry_id}.* so storage RLS can scope each path to its owner.
-- Do not create public read policies for this bucket.
