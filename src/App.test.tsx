import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AuthGateway } from "./modules/auth/auth";
import type { Recorder } from "./modules/recording/types";

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

function fakeRecorder(overrides: Partial<Recorder> = {}) {
  return {
    start: vi.fn(async () => undefined),
    finish: vi.fn(async () => ({
      blob: new Blob(["voice"], { type: "audio/webm" }),
      mimeType: "audio/webm",
      sizeBytes: 5,
      durationMs: 30000,
    })),
    discard: vi.fn(async () => undefined),
    ...overrides,
  } satisfies Recorder;
}

describe("Echo app shell", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:echo-diagnostic");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("starts with onboarding and routes to auth before Today", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /who you're becoming/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /begin/i }));

    expect(screen.getByRole("heading", { name: /let the audio go/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeDisabled();
  });

  it("shows Today for signed-in users and passes selected prompt into recording", async () => {
    render(<App authGateway={signedInGateway()} recorderFactory={async () => fakeRecorder()} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /what's sitting with you today/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /what drained you today/i }));
    expect(screen.getByRole("heading", { name: /what drained you today/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/start recording/i));
    expect(await screen.findByRole("heading", { name: /what drained you today/i })).toBeInTheDocument();
  });

  it("finishes a recording through the shared recorder without adding replay UI", async () => {
    const recorder = fakeRecorder();
    render(<App authGateway={signedInGateway()} recorderFactory={async () => recorder} />);

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/start recording/i));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledOnce());

    fireEvent.click(await screen.findByLabelText(/finish recording/i));

    await waitFor(() => expect(recorder.finish).toHaveBeenCalledOnce());
    expect(await screen.findByText("MY WORDS")).toBeInTheDocument();
    expect(screen.queryByRole("audio")).not.toBeInTheDocument();
  });


  it("exposes a Linen & Sage design-system preview route", async () => {
    render(<App authGateway={signedInGateway()} />);

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /design system/i }));

    expect(screen.getByRole("heading", { name: /design primitives for echo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/preview record orb/i)).toBeInTheDocument();
  });

  it("runs an Audio Lab recording test with permission, stop, metadata, and playback diagnostics", async () => {
    const recorder = fakeRecorder({
      finish: vi.fn(async () => ({
        blob: new Blob(["voice-diagnostic"], { type: "audio/webm;codecs=opus" }),
        mimeType: "audio/webm;codecs=opus",
        sizeBytes: 16,
        durationMs: 10000,
      })),
    });
    render(<App authGateway={signedInGateway()} recorderFactory={async () => recorder} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /audio lab/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /audio lab/i }));
    fireEvent.click(screen.getByRole("button", { name: /test 10s/i }));

    await waitFor(() => expect(recorder.start).toHaveBeenCalledOnce());
    expect(screen.getByText(/permission granted/i)).toBeInTheDocument();
    expect(screen.getByText(/recording 10s test/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /stop diagnostic recording/i }));

    await waitFor(() => expect(recorder.finish).toHaveBeenCalledOnce());
    expect(screen.getAllByText("audio/webm;codecs=opus").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("16 bytes")).toBeInTheDocument();
    expect(screen.getByText("10s")).toBeInTheDocument();
    expect(screen.getAllByText(/local playback only/i).length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces Audio Lab permission failures and supports canceling an active test", async () => {
    const deniedRecorder = fakeRecorder({
      start: vi.fn(async () => {
        throw new Error("permission denied");
      }),
    });
    const deniedApp = render(<App authGateway={signedInGateway()} recorderFactory={async () => deniedRecorder} />);

    await waitFor(() => expect(screen.getByRole("button", { name: /audio lab/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /audio lab/i }));
    fireEvent.click(screen.getByRole("button", { name: /test 30s/i }));

    expect(await screen.findByText(/permission denied or unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByText(/permission denied/i).length).toBeGreaterThanOrEqual(1);

    deniedApp.unmount();

    const discard = vi.fn(async () => undefined);
    const activeRecorder = fakeRecorder({ discard });
    render(<App authGateway={signedInGateway()} recorderFactory={async () => activeRecorder} />);

    await waitFor(() => expect(screen.getAllByRole("button", { name: /audio lab/i }).at(-1)).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: /audio lab/i }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: /test 60s/i }).at(-1)!);
    await waitFor(() => expect(activeRecorder.start).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: /cancel diagnostic recording/i }));

    await waitFor(() => expect(discard).toHaveBeenCalledOnce());
    expect(screen.getByText(/recording canceled/i)).toBeInTheDocument();
  });
  it("keeps deferred features out of the Today screen", async () => {
    render(<App authGateway={signedInGateway()} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: /what's sitting with you today/i })).toBeInTheDocument());
    expect(screen.queryByText(/weekly recap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/audio retention/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/keep original audio/i)).not.toBeInTheDocument();
  });
});

