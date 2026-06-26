import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import type { AuthGateway } from "./modules/auth/auth";

function signedInGateway(): AuthGateway {
  return {
    configured: true,
    async getSession() {
      return { userId: "user-1", email: "maya@example.com" };
    },
    async requestEmailOtp() {},
    async captureTimezone() {},
    async signOut() {},
  };
}

describe("Echo app shell", () => {
  it("starts with onboarding and routes to auth before Today", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /who you're becoming/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /begin/i }));

    expect(screen.getByRole("heading", { name: /let the audio go/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeDisabled();
  });

  it("shows Today for signed-in users and passes selected prompt into recording", async () => {
    render(<App authGateway={signedInGateway()} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /what's sitting with you today/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /what drained you today/i }));
    expect(screen.getByRole("heading", { name: /what drained you today/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/start recording/i));
    expect(await screen.findByRole("heading", { name: /what drained you today/i })).toBeInTheDocument();
  });

  it("keeps deferred features out of the Today screen", async () => {
    render(<App authGateway={signedInGateway()} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /what's sitting with you today/i })).toBeInTheDocument());
    expect(screen.queryByText(/weekly recap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/audio retention/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/keep original audio/i)).not.toBeInTheDocument();
  });
});
