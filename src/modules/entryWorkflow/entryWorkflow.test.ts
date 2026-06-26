import { describe, expect, it } from "vitest";
import { TemporaryAudioExpiredError, runEntryWorkflow } from "./entryWorkflow";
import type { EntryStatus, EntryWorkflowPorts } from "./types";

const audio = new Blob(["voice"], { type: "audio/webm" });

function workflowInput() {
  return {
    userId: "user-1",
    promptText: "What is sitting with you today?",
    timezone: "Asia/Singapore",
    recordedAt: "2026-06-26T01:00:00.000Z",
    audio,
    mimeType: "audio/webm",
    durationMs: 30000,
  };
}

function createPorts(overrides: Partial<EntryWorkflowPorts> = {}) {
  const events: string[] = [];
  const statuses: EntryStatus[] = [];
  const savedResults: unknown[] = [];

  const ports: EntryWorkflowPorts = {
    createEntry: async (input) => {
      events.push(`createEntry:${input.userId}`);
      return { id: "entry-1", userId: input.userId };
    },
    updateEntryStatus: async (_entryId, status) => {
      statuses.push(status);
    },
    uploadTemporaryAudio: async (_entryId, input) => {
      events.push(`uploadTemporaryAudio:${input.mimeType}`);
      return {
        jobId: "job-1",
        entryId: "entry-1",
        userId: input.userId,
        storagePath: "tmp-transcription/user-1/entry-1.webm",
        expiresAt: "2026-06-26T01:10:00.000Z",
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
      return { deletedAt: "2026-06-26T01:02:00.000Z" };
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
    saveEntryResult: async (_entryId, result) => {
      events.push("saveEntryResult");
      savedResults.push(result);
    },
    markFailed: async (_entryId, status, message) => {
      events.push(`markFailed:${status}:${message}`);
    },
    recordEvent: async (_entryId, event) => {
      events.push(`event:${event}`);
    },
    ...overrides,
  };

  return { ports, events, statuses, savedResults };
}

describe("entry workflow", () => {
  it("creates an owned entry, hands off audio, transcribes, deletes audio, reflects, and saves deletion metadata", async () => {
    const { ports, events, statuses, savedResults } = createPorts();

    const result = await runEntryWorkflow(workflowInput(), ports);

    expect(result).toMatchObject({
      status: "ready",
      entryId: "entry-1",
      transcript: "I felt stretched thin today.",
      temporaryAudioDeleted: true,
      temporaryAudioDeletedAt: "2026-06-26T01:02:00.000Z",
    });
    expect(statuses).toEqual([
      "recorded_locally",
      "uploading_for_transcription",
      "transcribing",
      "transcribed",
      "reflecting",
      "ready",
    ]);
    expect(events).toContain("createEntry:user-1");
    expect(events).toContain("uploadTemporaryAudio:audio/webm");
    expect(events).toContain("event:temporary_audio_deleted");
    expect(savedResults).toEqual([
      expect.objectContaining({
        transcript: "I felt stretched thin today.",
        transcriptionProvider: "gemini",
        transcriptionModel: "gemini-2.5-flash",
        reflectionProvider: "gemini",
        reflectionModel: "gemini-2.5-flash",
        audioDeletedAt: "2026-06-26T01:02:00.000Z",
      }),
    ]);
  });

  it("distinguishes retryable transcription failures before deleting temporary audio", async () => {
    const { ports, statuses, events } = createPorts({
      transcribe: async () => {
        throw new Error("Gemini timed out");
      },
    });

    const result = await runEntryWorkflow(workflowInput(), ports);

    expect(result.status).toBe("transcription_failed_retryable");
    expect(result.userMessage).toContain("Try again");
    expect(statuses).toEqual(["recorded_locally", "uploading_for_transcription", "transcribing"]);
    expect(events).not.toContain("deleteTemporaryAudio");
    expect(events).toContain("event:transcription_failed_retryable");
  });

  it("returns an expired transcription failure when temporary audio is gone", async () => {
    const { ports } = createPorts({
      transcribe: async () => {
        throw new TemporaryAudioExpiredError();
      },
    });

    const result = await runEntryWorkflow(workflowInput(), ports);

    expect(result.status).toBe("transcription_failed_expired");
    expect(result.userMessage).toContain("not kept");
    expect(result.userMessage).toContain("record it again");
  });
});
