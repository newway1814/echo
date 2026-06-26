import { describe, expect, it, vi } from "vitest";
import {
  DemoTranscriptionProvider,
  GeminiTranscriptionProvider,
  TranscriptionError,
  createConfiguredTranscriptionProvider,
} from "./transcription";

function recordingBlob() {
  return new Blob(["voice"], { type: "audio/webm" });
}

describe("transcription providers", () => {
  it("submits audio to a server endpoint and returns transcript metadata", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ text: "I felt clearer after walking.", provider: "gemini", model: "gemini-2.5-flash" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const provider = new GeminiTranscriptionProvider({ endpoint: "https://example.test/transcribe", fetcher });

    const result = await provider.transcribe({
      audio: recordingBlob(),
      mimeType: "audio/webm",
      durationMs: 10000,
      promptText: "What shifted today?",
    });

    expect(result).toEqual({ text: "I felt clearer after walking.", provider: "gemini", model: "gemini-2.5-flash" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/transcribe",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("normalizes server failures into transcription errors", async () => {
    const provider = new GeminiTranscriptionProvider({
      endpoint: "https://example.test/transcribe",
      fetcher: async () =>
        new Response(JSON.stringify({ error: "missing_gemini_api_key" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    });

    await expect(
      provider.transcribe({ audio: recordingBlob(), mimeType: "audio/webm", durationMs: 10000 }),
    ).rejects.toMatchObject({ code: "missing_gemini_api_key", status: 500 });
  });

  it("uses the Supabase Edge Function endpoint when public Supabase config exists", async () => {
    const provider = createConfiguredTranscriptionProvider({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(provider).toBeInstanceOf(GeminiTranscriptionProvider);
  });

  it("falls back to the demo provider without browser Supabase configuration", async () => {
    const provider = createConfiguredTranscriptionProvider({});

    expect(provider).toBeInstanceOf(DemoTranscriptionProvider);
  });

  it("exposes a typed failure for callers that need developer-readable states", () => {
    const error = new TranscriptionError("provider_failed", "Gemini transcription failed.", 502);

    expect(error.code).toBe("provider_failed");
    expect(error.status).toBe(502);
  });
});
