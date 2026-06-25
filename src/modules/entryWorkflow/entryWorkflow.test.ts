import { describe, expect, it } from "vitest";
import { runEntryWorkflow } from "./entryWorkflow";
import type { EntryWorkflowPorts } from "./types";

const audio = new Blob(["voice"], { type: "audio/webm" });

function createPorts(overrides: Partial<EntryWorkflowPorts> = {}): EntryWorkflowPorts {
  const events: string[] = [];

  return {
    createEntry: async () => {
      events.push("createEntry");
      return { id: "entry-1", userId: "user-1" };
    },
    uploadTemporaryAudio: async () => {
      events.push("uploadTemporaryAudio");
      return {
        jobId: "job-1",
        storagePath: "tmp/user-1/entry-1.webm",
        expiresAt: "2026-06-26T01:00:00.000Z",
      };
    },
    transcribe: async () => {
      events.push("transcribe");
      return {
        text: "I felt stretched thin today.",
        provider: "gemini",
        model: "gemini-2.5-flash",
      };
    },
    deleteTemporaryAudio: async () => {
      events.push("deleteTemporaryAudio");
    },
    reflect: async () => {
      events.push("reflect");
      return {
        mirrorNote: "You mentioned feeling stretched thin today.",
        moodTags: ["stretched"],
        memoryQuote: "I felt stretched thin today.",
        provider: "gemini",
        model: "gemini-2.5-flash",
      };
    },
    saveEntryResult: async () => {
      events.push("saveEntryResult");
    },
    markFailed: async () => {
      events.push("markFailed");
    },
    recordEvent: async (_entryId, event) => {
      events.push(event);
    },
    ...overrides,
  };
}

describe("entry workflow", () => {
  it("hands off temporary audio, transcribes, deletes audio, reflects, and saves a ready entry", async () => {
    const ports = createPorts();

    const result = await runEntryWorkflow(
      {
        userId: "user-1",
        promptText: "What is sitting with you today?",
        timezone: "Asia/Singapore",
        recordedAt: "2026-06-26T01:00:00.000Z",
        audio,
        mimeType: "audio/webm",
        durationMs: 30000,
      },
      ports,
    );

    expect(result.status).toBe("ready");
    expect(result.entryId).toBe("entry-1");
    expect(result.transcript).toBe("I felt stretched thin today.");
    expect(result.temporaryAudioDeleted).toBe(true);
  });

  it("returns an expired transcription failure when temporary audio is gone", async () => {
    const ports = createPorts({
      transcribe: async () => {
        const error = new Error("temporary audio expired");
        error.name = "TemporaryAudioExpiredError";
        throw error;
      },
    });

    const result = await runEntryWorkflow(
      {
        userId: "user-1",
        promptText: "What drained you today?",
        timezone: "Asia/Singapore",
        recordedAt: "2026-06-26T01:00:00.000Z",
        audio,
        mimeType: "audio/webm",
        durationMs: 30000,
      },
      ports,
    );

    expect(result.status).toBe("transcription_failed_expired");
    expect(result.userMessage).toContain("not kept");
  });
});
