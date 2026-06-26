import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BreathingOrb, EchoButton, PhoneFrame, PromptChip, SectionLabel, SoftCard, Tag, ReflectionText } from "./designSystem";
import { linenAndSageTokens } from "./tokens";

describe("Linen & Sage design system", () => {
  it("exposes the canonical color tokens from the design bundle", () => {
    expect(linenAndSageTokens).toMatchObject({
      linen: "#f4efe6",
      card: "#fbf8f2",
      sage: "#a8b79a",
      clay: "#c9a38e",
      text: "#43403b",
      muted: "#6e665c",
    });
  });

  it("renders reusable primitives for the Echo screens", () => {
    render(
      <PhoneFrame>
        <SoftCard>
          <SectionLabel tone="clay">MY WORDS</SectionLabel>
          <ReflectionText>"A small good thing."</ReflectionText>
          <PromptChip selected>A small good thing</PromptChip>
          <Tag>presence</Tag>
          <BreathingOrb label="Start recording" />
          <EchoButton tone="sage">Continue</EchoButton>
        </SoftCard>
      </PhoneFrame>,
    );

    expect(screen.getByText("MY WORDS")).toBeInTheDocument();
    expect(screen.getByText('"A small good thing."')).toBeInTheDocument();
    expect(screen.getByText("presence")).toBeInTheDocument();
    expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });
});


