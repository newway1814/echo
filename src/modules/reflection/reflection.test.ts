import { describe, expect, it, vi } from "vitest";
import {
  DemoReflectionProvider,
  GeminiReflectionProvider,
  ReflectionError,
  createConfiguredReflectionProvider,
  createQuoteBasedMemoryCard,
  normalizeReflectionResult,
  validateMirrorNote,
} from "./reflection";

const transcript =
  "Work pulled at me all day. By the time I got home I had almost nothing left for the people I care about.";

describe("reflection module", () => {
  it("accepts cautious non-diagnostic Mirror Notes", () => {
    const result = validateMirrorNote(
      "You mentioned feeling stretched thin today. One thing that stands out is how clearly you noticed the pattern.",
    );

    expect(result.valid).toBe(true);
  });

  it("rejects diagnostic or certain Mirror Notes", () => {
    const result = validateMirrorNote("You are depressed and clearly have anxiety.");

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("diagnostic_language");
    expect(result.reasons).toContain("certainty_language");
  });

  it("normalizes reflection output to safe tone, one to three tags, and an exact transcript quote", () => {
    const result = normalizeReflectionResult(
      { transcript, promptText: "What drained you today?" },
      {
        mirrorNote: "It seems like the day asked a lot of you. One thing that stands out is how you noticed what was left at home.",
        moodTags: ["depleted", "boundaries", "home", "extra"],
        memoryQuote: "a paraphrase that should not be trusted",
        provider: "gemini",
        model: "gemini-2.5-flash",
      },
    );

    expect(result.moodTags).toEqual(["depleted", "boundaries", "home"]);
    expect(result.memoryQuote).toBe("By the time I got home I had almost nothing left for the people I care about.");
    expect(transcript).toContain(result.memoryQuote);
  });

  it("rejects unsafe reflection output", () => {
    expect(() =>
      normalizeReflectionResult(
        { transcript, promptText: "What drained you today?" },
        {
          mirrorNote: "You are clinically depressed.",
          moodTags: ["diagnosis"],
          memoryQuote: transcript,
          provider: "gemini",
          model: "gemini-2.5-flash",
        },
      ),
    ).toThrow(ReflectionError);
  });

  it("creates a Memory Card from an exact transcript quote", () => {
    const card = createQuoteBasedMemoryCard({
      transcript,
      tags: ["depleted", "boundaries"],
      recordedAt: "2026-06-25T20:30:00.000Z",
    });

    expect(card.quote).toBe("By the time I got home I had almost nothing left for the people I care about.");
    expect(card.tags).toEqual(["depleted", "boundaries"]);
  });

  it("Gemini reflection adapter posts only to a server endpoint and returns normalized output", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          mirrorNote: "You mentioned having almost nothing left. One thing that stands out is the pattern you noticed.",
          moodTags: ["depleted", "aware"],
          memoryQuote: "not exact",
          provider: "gemini",
          model: "gemini-2.5-flash",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = new GeminiReflectionProvider({ endpoint: "https://example.test/reflect", fetcher });

    const result = await provider.reflect({ transcript, promptText: "What drained you today?" });

    expect(result.memoryQuote).toBe("By the time I got home I had almost nothing left for the people I care about.");
    expect(result.provider).toBe("gemini");
    expect(fetcher).toHaveBeenCalledWith(
      "https://example.test/reflect",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "Content-Type": "application/json" }) }),
    );
  });

  it("uses the configured Supabase Edge Function for Gemini reflection when public config exists", () => {
    const provider = createConfiguredReflectionProvider({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    expect(provider).toBeInstanceOf(GeminiReflectionProvider);
  });

  it("falls back to demo reflection without public Supabase config", async () => {
    const provider = createConfiguredReflectionProvider({});
    const result = await provider.reflect({ transcript, promptText: "What drained you today?" });

    expect(provider).toBeInstanceOf(DemoReflectionProvider);
    expect(result.memoryQuote).toBe("By the time I got home I had almost nothing left for the people I care about.");
  });
});
