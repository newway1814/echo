import { describe, expect, it, vi } from "vitest";
import { createSupabaseAccountDataGateway } from "./accountData";

function createFakeClient(rows: unknown[] = []) {
  const calls: string[] = [];
  const updates: unknown[] = [];

  const query = {
    eq(column: string, value: unknown) {
      calls.push(`eq:${column}:${String(value)}`);
      return query;
    },
    is(column: string, value: unknown) {
      calls.push(`is:${column}:${String(value)}`);
      return query;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.push(`order:${column}:${String(options.ascending)}`);
      return Promise.resolve({ data: rows, error: null });
    },
  };

  const updateBuilder = {
    eq(column: string, value: unknown) {
      calls.push(`updateEq:${column}:${String(value)}`);
      return Promise.resolve({ data: null, error: null });
    },
  };

  const deleteBuilder = {
    eq(column: string, value: unknown) {
      calls.push(`deleteEq:${column}:${String(value)}`);
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    client: {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => query),
        update: vi.fn((value: unknown) => {
          updates.push({ table, value });
          return updateBuilder;
        }),
        delete: vi.fn(() => deleteBuilder),
      })),
    },
    calls,
    updates,
  };
}

describe("account data gateway", () => {
  it("exports only non-deleted reflection data for the signed-in user without audio objects", async () => {
    const fake = createFakeClient([
      {
        id: "entry-1",
        prompt_text: "What shifted today?",
        recorded_at: "2026-06-26T01:00:00.000Z",
        recorded_date: "2026-06-26",
        timezone: "Asia/Singapore",
        status: "ready",
        transcript: "I felt clearer after walking.",
        mirror_note: "It seems like the walk gave you room.",
        mood_tags: ["clearer"],
        memory_quote: "I felt clearer after walking.",
        duration_ms: 30000,
        audio_retention_policy: "none",
        audio_mime_type: null,
        audio_size_bytes: null,
        audio_deleted_at: "2026-06-26T01:01:00.000Z",
        transcription_provider: "gemini",
        transcription_model: "gemini-2.5-flash",
        reflection_provider: "gemini",
        reflection_model: "gemini-2.5-flash",
        created_at: "2026-06-26T01:00:00.000Z",
        updated_at: "2026-06-26T01:01:00.000Z",
      },
    ]);
    const gateway = createSupabaseAccountDataGateway(fake.client, () => new Date("2026-06-26T02:00:00.000Z"));

    const exported = await gateway.exportUserData("user-1");

    expect(fake.calls).toEqual(["eq:user_id:user-1", "is:deleted_at:null", "order:recorded_at:false"]);
    expect(exported).toEqual({
      exportedAt: "2026-06-26T02:00:00.000Z",
      userId: "user-1",
      entries: [
        expect.objectContaining({
          id: "entry-1",
          transcript: "I felt clearer after walking.",
          audioRetentionPolicy: "none",
          audioDeletedAt: "2026-06-26T01:01:00.000Z",
        }),
      ],
    });
    expect(JSON.stringify(exported)).not.toContain("audio_storage_path");
    expect(JSON.stringify(exported)).not.toContain("temporary_audio_jobs");
  });

  it("wipes signed-in user data by soft-deleting entries, expiring temp jobs, and deleting profile", async () => {
    const fake = createFakeClient();
    const gateway = createSupabaseAccountDataGateway(fake.client, () => new Date("2026-06-26T02:00:00.000Z"));

    await gateway.wipeUserData("user-1");

    expect(fake.updates).toEqual([
      {
        table: "entries",
        value: expect.objectContaining({ status: "deleted", deleted_at: "2026-06-26T02:00:00.000Z" }),
      },
      {
        table: "temporary_audio_jobs",
        value: expect.objectContaining({ status: "deleted", deleted_at: "2026-06-26T02:00:00.000Z" }),
      },
    ]);
    expect(fake.calls).toEqual(["updateEq:user_id:user-1", "updateEq:user_id:user-1", "deleteEq:user_id:user-1"]);
  });
});