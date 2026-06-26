import { describe, expect, it, vi } from "vitest";
import { createSupabaseEntryHistoryGateway } from "./history";

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
      return updateBuilder;
    },
    is(column: string, value: unknown) {
      calls.push(`updateIs:${column}:${String(value)}`);
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    client: {
      from: vi.fn(() => ({
        select: vi.fn(() => query),
        update: vi.fn((value: unknown) => {
          updates.push(value);
          return updateBuilder;
        }),
      })),
    },
    calls,
    updates,
  };
}

describe("entry history gateway", () => {
  it("lists only ready non-deleted entries for the signed-in user", async () => {
    const fake = createFakeClient([
      {
        id: "entry-1",
        user_id: "user-1",
        prompt_text: "A small good thing",
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
        audio_storage_path: null,
        audio_mime_type: null,
        audio_size_bytes: null,
        audio_deleted_at: "2026-06-26T01:01:00.000Z",
        transcription_provider: "gemini",
        transcription_model: "gemini-2.5-flash",
        reflection_provider: "gemini",
        reflection_model: "gemini-2.5-flash",
        deleted_at: null,
      },
    ]);
    const gateway = createSupabaseEntryHistoryGateway(fake.client);

    const entries = await gateway.listEntries("user-1");

    expect(fake.calls).toEqual([
      "eq:user_id:user-1",
      "eq:status:ready",
      "is:deleted_at:null",
      "order:recorded_at:false",
    ]);
    expect(entries).toEqual([
      expect.objectContaining({
        id: "entry-1",
        userId: "user-1",
        promptText: "A small good thing",
        memoryQuote: "I felt clearer after walking.",
        moodTags: ["clearer"],
      }),
    ]);
  });

  it("soft-deletes only the signed-in user's matching active entry", async () => {
    const fake = createFakeClient();
    const gateway = createSupabaseEntryHistoryGateway(fake.client, () => new Date("2026-06-26T02:00:00.000Z"));

    await gateway.deleteEntry("user-1", "entry-1");

    expect(fake.updates).toEqual([
      expect.objectContaining({
        status: "deleted",
        deleted_at: "2026-06-26T02:00:00.000Z",
        updated_at: "2026-06-26T02:00:00.000Z",
      }),
    ]);
    expect(fake.calls).toEqual(["updateEq:id:entry-1", "updateEq:user_id:user-1", "updateIs:deleted_at:null"]);
  });
});