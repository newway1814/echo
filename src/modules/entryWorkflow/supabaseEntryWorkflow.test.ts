import { describe, expect, it, vi } from "vitest";
import { createSupabaseEntryWorkflowPorts, type SupabaseEntryWorkflowClient } from "./supabaseEntryWorkflow";

const audio = new Blob(["voice"], { type: "audio/webm" });

function createFakeClient() {
  const inserts: Array<{ table: string; value: unknown }> = [];
  const updates: Array<{ table: string; value: unknown; column: string; id: string }> = [];
  const uploads: Array<{ bucket: string; path: string; body: Blob; options: unknown }> = [];
  const removals: Array<{ bucket: string; paths: string[] }> = [];

  const client: SupabaseEntryWorkflowClient = {
    from(table) {
      return {
        insert<T = unknown>(value: unknown) {
          inserts.push({ table, value });
          const data = table === "entries" ? { id: "entry-1", user_id: "user-1" } : { id: "job-1" };
          const promise = Promise.resolve({ data: null, error: null });
          return Object.assign(promise, {
            select: () => ({
              single: async () => ({ data: data as T, error: null }),
            }),
          });
        },
        update(value) {
          return {
            eq: async (column, id) => {
              updates.push({ table, value, column, id });
              return { data: null, error: null };
            },
          };
        },
      };
    },
    storage: {
      from(bucket) {
        return {
          upload: async (path, body, options) => {
            uploads.push({ bucket, path, body, options });
            return { error: null };
          },
          remove: async (paths) => {
            removals.push({ bucket, paths });
            return { error: null };
          },
        };
      },
    },
  };

  return { client, inserts, updates, uploads, removals };
}

describe("Supabase entry workflow ports", () => {
  it("uploads codec MIME recordings with a Supabase bucket-safe content type", async () => {
    const codecAudio = new Blob(["voice"], { type: "audio/webm;codecs=opus" });
    const fake = createFakeClient();
    const ports = createSupabaseEntryWorkflowPorts({
      client: fake.client,
      transcriptionProvider: { transcribe: vi.fn() },
      reflectionProvider: { reflect: vi.fn() },
      now: () => new Date("2026-06-26T01:00:00.000Z"),
    });

    const entry = await ports.createEntry({
      userId: "user-1",
      promptText: "What changed today?",
      timezone: "Asia/Singapore",
      recordedAt: "2026-06-26T01:00:00.000Z",
      audio: codecAudio,
      mimeType: "audio/webm;codecs=opus",
      durationMs: 30000,
    });
    await ports.uploadTemporaryAudio(entry.id, {
      userId: "user-1",
      promptText: "What changed today?",
      timezone: "Asia/Singapore",
      recordedAt: "2026-06-26T01:00:00.000Z",
      audio: codecAudio,
      mimeType: "audio/webm;codecs=opus",
      durationMs: 30000,
    });

    expect(fake.uploads).toContainEqual(
      expect.objectContaining({
        path: "tmp-transcription/user-1/entry-1.webm",
        options: { contentType: "audio/webm", upsert: false },
      }),
    );
    expect(fake.updates).toContainEqual(
      expect.objectContaining({
        table: "entries",
        value: expect.objectContaining({ audio_mime_type: "audio/webm;codecs=opus" }),
      }),
    );
    expect(fake.inserts).toContainEqual(
      expect.objectContaining({
        table: "temporary_audio_jobs",
        value: expect.objectContaining({ mime_type: "audio/webm;codecs=opus" }),
      }),
    );
  });
  it("creates owned entries and uploads temporary audio into the private user-scoped path", async () => {
    const fake = createFakeClient();
    const ports = createSupabaseEntryWorkflowPorts({
      client: fake.client,
      transcriptionProvider: { transcribe: vi.fn() },
      reflectionProvider: { reflect: vi.fn() },
      now: () => new Date("2026-06-26T01:00:00.000Z"),
    });

    const entry = await ports.createEntry({
      userId: "user-1",
      promptText: "What changed today?",
      timezone: "Asia/Singapore",
      recordedAt: "2026-06-26T01:00:00.000Z",
      audio,
      mimeType: "audio/webm",
      durationMs: 30000,
    });
    const handoff = await ports.uploadTemporaryAudio(entry.id, {
      userId: "user-1",
      promptText: "What changed today?",
      timezone: "Asia/Singapore",
      recordedAt: "2026-06-26T01:00:00.000Z",
      audio,
      mimeType: "audio/webm",
      durationMs: 30000,
    });

    expect(entry).toEqual({ id: "entry-1", userId: "user-1" });
    expect(fake.inserts).toContainEqual(
      expect.objectContaining({
        table: "entries",
        value: expect.objectContaining({ user_id: "user-1", audio_retention_policy: "none" }),
      }),
    );
    expect(fake.uploads).toEqual([
      expect.objectContaining({
        bucket: "temporary-audio",
        path: "tmp-transcription/user-1/entry-1.webm",
        body: audio,
        options: { contentType: "audio/webm", upsert: false },
      }),
    ]);
    expect(handoff).toEqual({
      jobId: "job-1",
      entryId: "entry-1",
      userId: "user-1",
      storagePath: "tmp-transcription/user-1/entry-1.webm",
      expiresAt: "2026-06-26T01:10:00.000Z",
    });
  });

  it("deletes temporary audio and records entry/job cleanup metadata", async () => {
    const fake = createFakeClient();
    const ports = createSupabaseEntryWorkflowPorts({
      client: fake.client,
      transcriptionProvider: { transcribe: vi.fn() },
      reflectionProvider: { reflect: vi.fn() },
      now: () => new Date("2026-06-26T01:02:00.000Z"),
    });

    const deletion = await ports.deleteTemporaryAudio({
      jobId: "job-1",
      entryId: "entry-1",
      userId: "user-1",
      storagePath: "tmp-transcription/user-1/entry-1.webm",
      expiresAt: "2026-06-26T01:10:00.000Z",
    });

    expect(deletion).toEqual({ deletedAt: "2026-06-26T01:02:00.000Z" });
    expect(fake.removals).toEqual([{ bucket: "temporary-audio", paths: ["tmp-transcription/user-1/entry-1.webm"] }]);
    expect(fake.updates).toContainEqual(
      expect.objectContaining({
        table: "temporary_audio_jobs",
        value: expect.objectContaining({ status: "deleted", deleted_at: "2026-06-26T01:02:00.000Z" }),
      }),
    );
    expect(fake.updates).toContainEqual(
      expect.objectContaining({
        table: "entries",
        value: expect.objectContaining({
          audio_retention_policy: "none",
          audio_storage_path: null,
          audio_deleted_at: "2026-06-26T01:02:00.000Z",
        }),
      }),
    );
  });

  it("persists separate transcription and reflection provider metadata", async () => {
    const fake = createFakeClient();
    const ports = createSupabaseEntryWorkflowPorts({
      client: fake.client,
      transcriptionProvider: { transcribe: vi.fn() },
      reflectionProvider: { reflect: vi.fn() },
      now: () => new Date("2026-06-26T01:03:00.000Z"),
    });

    await ports.saveEntryResult("entry-1", {
      transcript: "I felt stretched thin today.",
      transcriptionProvider: "gemini",
      transcriptionModel: "gemini-transcribe",
      mirrorNote: "You mentioned feeling stretched thin today.",
      moodTags: ["stretched"],
      memoryQuote: "I felt stretched thin today.",
      reflectionProvider: "gemini",
      reflectionModel: "gemini-reflect",
      audioDeletedAt: "2026-06-26T01:02:00.000Z",
    });

    expect(fake.updates).toContainEqual(
      expect.objectContaining({
        table: "entries",
        value: expect.objectContaining({
          transcript: "I felt stretched thin today.",
          transcription_provider: "gemini",
          transcription_model: "gemini-transcribe",
          reflection_provider: "gemini",
          reflection_model: "gemini-reflect",
        }),
      }),
    );
  });
});
