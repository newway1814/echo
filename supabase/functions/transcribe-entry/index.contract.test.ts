import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("transcribe-entry Gemini audio contract", () => {
  it("uses the Gemini Interactions inline-audio shape for transcription", () => {
    const source = readFileSync("supabase/functions/transcribe-entry/index.ts", "utf8");

    expect(source).toContain("/v1beta/interactions");
    expect(source).toContain('type: "audio"');
    expect(source).toContain("mime_type");
    expect(source).toContain("output_text");
    expect(source).not.toContain("generateContent");
    expect(source).not.toContain("inlineData");
  });
});