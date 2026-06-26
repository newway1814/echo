import { describe, expect, it } from "vitest";
import migrationSql from "../../../supabase/migrations/202606260001_echo_mvp_foundation.sql?raw";

const normalizedSql = migrationSql.replace(/\s+/g, " ").toLowerCase();

describe("Supabase foundation migration", () => {
  it("defines owned reflection tables with RLS", () => {
    expect(normalizedSql).toContain("create table public.profiles");
    expect(normalizedSql).toContain("create table public.entries");
    expect(normalizedSql).toContain("create table public.temporary_audio_jobs");
    expect(normalizedSql).toContain("alter table public.entries enable row level security");
    expect(normalizedSql).toContain("create policy \"entries are owned by user\" on public.entries");
    expect(normalizedSql).toContain("using ((select auth.uid()) = user_id)");
    expect(normalizedSql).toContain("with check ((select auth.uid()) = user_id)");
  });

  it("preserves the MVP no-retained-audio default while leaving future audio fields", () => {
    expect(normalizedSql).toContain("audio_retention_policy public.audio_retention_policy not null default 'none'");
    expect(normalizedSql).toContain("audio_storage_path text");
    expect(normalizedSql).toContain("audio_mime_type text");
    expect(normalizedSql).toContain("audio_size_bytes integer");
    expect(normalizedSql).toContain("audio_deleted_at timestamptz");
    expect(normalizedSql).toContain("entries_audio_none_has_no_path");
  });

  it("tracks temporary audio status, expiry, deletion, attempts, and structured errors", () => {
    expect(normalizedSql).toContain("create type public.temporary_audio_status as enum");
    expect(normalizedSql).toContain("storage_path text not null");
    expect(normalizedSql).toContain("expires_at timestamptz not null");
    expect(normalizedSql).toContain("deleted_at timestamptz");
    expect(normalizedSql).toContain("attempts integer not null default 0");
    expect(normalizedSql).toContain("last_error_code text");
    expect(normalizedSql).toContain("last_error_message text");
    expect(normalizedSql).toContain("last_error_metadata jsonb not null default '{}'");
  });

  it("configures private temporary audio storage scoped by auth user folder", () => {
    expect(normalizedSql).toContain("insert into storage.buckets");
    expect(normalizedSql).toContain("'temporary-audio'");
    expect(normalizedSql).toContain("public = false");
    expect(normalizedSql).toContain("create policy \"temporary audio objects are user scoped\" on storage.objects");
    expect(normalizedSql).toContain("bucket_id = 'temporary-audio'");
    expect(normalizedSql).toContain("(storage.foldername(name))[1] = 'tmp-transcription'");
    expect(normalizedSql).toContain("(storage.foldername(name))[2] = (select auth.uid())::text");
  });
});
