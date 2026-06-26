import { describe, expect, it } from "vitest";
import { formatTodayLabel, getDailyPromptSet, getGreeting } from "./prompts";

describe("daily prompts", () => {
  it("returns the default daily prompt and prompt chips", () => {
    const promptSet = getDailyPromptSet(new Date("2026-06-26T20:30:00+08:00"));

    expect(promptSet.dailyPrompt).toBe("What's sitting with you today?");
    expect(promptSet.promptChips).toEqual([
      "What drained you today?",
      "A small good thing",
      "Something you keep avoiding",
    ]);
  });

  it("formats the Today label and greeting from local time", () => {
    const evening = new Date("2026-06-26T20:30:00+08:00");

    expect(formatTodayLabel(evening)).toMatch(/FRIDAY/);
    expect(getGreeting(evening)).toBe("Good evening.");
  });
});
