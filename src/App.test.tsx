import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Echo app shell", () => {
  it("starts with onboarding and routes to auth before Today", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /who you're becoming/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /begin/i }));

    expect(screen.getByRole("heading", { name: /let the audio go/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeDisabled();
  });
});
