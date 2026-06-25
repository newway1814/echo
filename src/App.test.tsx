import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Echo app shell", () => {
  it("renders the mobile-first Echo experience in a phone-framed shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /what's sitting with you today/i })).toBeInTheDocument();
    expect(screen.getByText(/tap to speak/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument();
  });
});
