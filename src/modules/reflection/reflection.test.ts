import { describe, expect, it } from "vitest";
import { createQuoteBasedMemoryCard, validateMirrorNote } from "./reflection";

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
  });

  it("creates a Memory Card from an exact transcript quote", () => {
    const card = createQuoteBasedMemoryCard({
      transcript:
        "Work pulled at me all day. By the time I got home I had almost nothing left for the people I care about.",
      tags: ["depleted", "boundaries"],
      recordedAt: "2026-06-25T20:30:00.000Z",
    });

    expect(card.quote).toBe("By the time I got home I had almost nothing left for the people I care about.");
    expect(card.tags).toEqual(["depleted", "boundaries"]);
  });
});
