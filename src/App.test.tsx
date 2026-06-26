import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AccountDataGateway } from "./modules/account/accountData";
import type { AuthGateway } from "./modules/auth/auth";
import type { EntryHistoryGateway } from "./modules/entries/history";
import type { Recorder } from "./modules/recording/types";
import type { ReflectionProvider } from "./modules/reflection/reflection";
import type { TranscriptionProvider } from "./modules/transcription/transcription";

function signedInGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    configured: true,
    async getSession() {
      return { userId: "user-1", email: "maya@example.com" };
    },
    async requestEmailOtp() {},
    async captureTimezone() {},
    async signOut() {},
    ...overrides,
  };
}
function historyEntry(overrides: Partial<Awaited<ReturnType<EntryHistoryGateway["listEntries"]>>[number]> = {}) {
  return {
    id: "history-1",
    userId: "user-1",
    promptText: "A small good thing",
    recordedAt: "2026-06-24T20:30:00.000Z",
    recordedDate: "2026-06-24",
    timezone: "Asia/Singapore",
    status: "ready" as const,
    transcript: "I slowed down enough to actually hear my daughter today.",
    mirrorNote: "You mentioned slowing down enough to hear your daughter. One thing that stands out is the care in that moment.",
    moodTags: ["tender"],
    memoryQuote: "I slowed down enough to actually hear my daughter today.",
    durationMs: 42000,
    audioRetentionPolicy: "none" as const,
    audioStoragePath: null,
    audioMimeType: null,
    audioSizeBytes: null,
    audioDeletedAt: "2026-06-24T20:31:00.000Z",
    transcriptionProvider: "gemini",
    transcriptionModel: "gemini-2.5-flash",
    reflectionProvider: "gemini",
    reflectionModel: "gemini-2.5-flash",
    deletedAt: null,
    ...overrides,
  };
}

function fakeHistoryGateway(entries = [historyEntry()]) {
  return {
    listEntries: vi.fn(async () => entries),
    deleteEntry: vi.fn(async () => undefined),
  } satisfies EntryHistoryGateway;
}
function fakeAccountDataGateway(overrides: Partial<AccountDataGateway> = {}) {
  return {
    exportUserData: vi.fn(async () => ({
      exportedAt: "2026-06-26T02:00:00.000Z",
      userId: "user-1",
      entries: [
        {
          id: "history-1",
          promptText: "A small good thing",
          recordedAt: "2026-06-24T20:30:00.000Z",
          recordedDate: "2026-06-24",
          timezone: "Asia/Singapore",
          status: "ready",
          transcript: "I slowed down enough to actually hear my daughter today.",
          mirrorNote: "You mentioned slowing down enough to hear your daughter.",
          moodTags: ["tender"],
          memoryQuote: "I slowed down enough to actually hear my daughter today.",
          durationMs: 42000,
          audioRetentionPolicy: "none",
          audioMimeType: null,
          audioSizeBytes: null,
          audioDeletedAt: "2026-06-24T20:31:00.000Z",
          transcriptionProvider: "gemini",
          transcriptionModel: "gemini-2.5-flash",
          reflectionProvider: "gemini",
          reflectionModel: "gemini-2.5-flash",
          createdAt: "2026-06-24T20:30:00.000Z",
          updatedAt: "2026-06-24T20:31:00.000Z",
        },
      ],
    })),
    wipeUserData: vi.fn(async () => undefined),
    ...overrides,
  } satisfies AccountDataGateway;
}
function fakeTranscriptionProvider(overrides: Partial<TranscriptionProvider> = {}) {
  return {
    transcribe: vi.fn(async () => ({
      text: "I felt clearer after walking.",
      provider: "gemini",
      model: "gemini-2.5-flash",
    })),
    ...overrides,
  } satisfies TranscriptionProvider;
}

function fakeReflectionProvider(overrides: Partial<ReflectionProvider> = {}) {
  return {
    reflect: vi.fn(async () => ({
      mirrorNote:
        "It seems like the walk gave you a little more room. One thing that stands out is that you noticed the shift.",
      moodTags: ["clearer", "settled"],
      memoryQuote: "I felt clearer after walking.",
      provider: "gemini",
      model: "gemini-2.5-flash",
    })),
    ...overrides,
  } satisfies ReflectionProvider;
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


  it("does not block signed-in users when profile timezone capture is missing remotely", async () => {
    render(
      <App
        authGateway={{
          ...signedInGateway(),
          async captureTimezone() {
            throw new Error("Could not find the table 'public.profiles' in the schema cache");
          },
        }}
      />,
    );

    expect(await screen.findByRole("heading", { name: /what's sitting with you today/i })).toBeInTheDocument();
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
    render(<App authGateway={signedInGateway()} recorderFactory={async () => recorder} transcriptionProvider={fakeTranscriptionProvider()} />);

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/start recording/i));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledOnce());

    fireEvent.click(await screen.findByLabelText(/finish recording/i));

    await waitFor(() => expect(recorder.finish).toHaveBeenCalledOnce());
    expect(await screen.findByText("MY WORDS")).toBeInTheDocument();
    expect(screen.queryByRole("audio")).not.toBeInTheDocument();
  });
  it("auto-finishes the recording screen at the 60 second cap", async () => {
    const recorder = fakeRecorder();
    render(<App authGateway={signedInGateway()} recorderFactory={async () => recorder} transcriptionProvider={fakeTranscriptionProvider()} />);

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());

    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/start recording/i));
      await Promise.resolve();
    });
    expect(recorder.start).toHaveBeenCalledOnce();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(recorder.finish).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    vi.useRealTimers();
    expect(await screen.findByText("MY WORDS")).toBeInTheDocument();
  });



  it("distinguishes securing copy from safe-to-close copy during the entry workflow handoff", async () => {
    const recorder = fakeRecorder();
    const transcriptionProvider = fakeTranscriptionProvider({
      transcribe: vi.fn(() => new Promise<Awaited<ReturnType<TranscriptionProvider["transcribe"]>>>(() => undefined)),
    });
    render(<App authGateway={signedInGateway()} recorderFactory={async () => recorder} transcriptionProvider={transcriptionProvider} />);

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/start recording/i));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledOnce());

    fireEvent.click(await screen.findByLabelText(/finish recording/i));

    expect(await screen.findByText(/Echo is securing this reflection/i)).toBeInTheDocument();
    expect(await screen.findByText(/Your reflection is safe to close/i)).toBeInTheDocument();
    expect(transcriptionProvider.transcribe).toHaveBeenCalledOnce();
  });


  it("loads signed-in reflection history and opens a past Afterglow detail", async () => {
    const entryHistoryGateway = fakeHistoryGateway();
    render(<App authGateway={signedInGateway()} entryHistoryGateway={entryHistoryGateway} />);

    await waitFor(() => expect(entryHistoryGateway.listEntries).toHaveBeenCalledWith("user-1"));
    fireEvent.click(await screen.findByRole("button", { name: /reflections/i }));

    expect(await screen.findByText(/1 kept/i)).toBeInTheDocument();
    expect(screen.getByText(/JUN 24 - tender/i)).toBeInTheDocument();
    expect(screen.getByText(/I slowed down enough to actually hear my daughter today/i)).toBeInTheDocument();
    expect(screen.queryByRole("audio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open reflection from jun 24/i }));

    expect(await screen.findByText("MY WORDS")).toBeInTheDocument();
    expect(screen.getByText(/You mentioned slowing down enough/i)).toBeInTheDocument();
  });

  it("soft-deletes a history reflection and removes it from normal history", async () => {
    const entryHistoryGateway = fakeHistoryGateway();
    render(<App authGateway={signedInGateway()} entryHistoryGateway={entryHistoryGateway} />);

    await waitFor(() => expect(entryHistoryGateway.listEntries).toHaveBeenCalledWith("user-1"));
    fireEvent.click(await screen.findByRole("button", { name: /reflections/i }));
    fireEvent.click(await screen.findByRole("button", { name: /delete reflection from jun 24/i }));

    await waitFor(() => expect(entryHistoryGateway.deleteEntry).toHaveBeenCalledWith("user-1", "history-1"));
    expect(screen.queryByText(/I slowed down enough to actually hear my daughter today/i)).not.toBeInTheDocument();
    expect(screen.getByText(/0 kept/i)).toBeInTheDocument();
  });
  it("exports signed-in account data without audio blobs", async () => {
    const accountDataGateway = fakeAccountDataGateway();
    const exportSink = vi.fn();
    render(<App authGateway={signedInGateway()} accountDataGateway={accountDataGateway} exportDataSink={exportSink} />);

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /export my data/i }));

    await waitFor(() => expect(accountDataGateway.exportUserData).toHaveBeenCalledWith("user-1"));
    expect(exportSink).toHaveBeenCalledWith(
      "echo-user-1-export.json",
      expect.objectContaining({ userId: "user-1", entries: [expect.objectContaining({ audioRetentionPolicy: "none" })] }),
    );
    expect(JSON.stringify(exportSink.mock.calls[0][1])).not.toContain("audioStoragePath");
  });

  it("confirms data wipe, signs out, and clears local reflections", async () => {
    const signOut = vi.fn(async () => undefined);
    const accountDataGateway = fakeAccountDataGateway();
    const entryHistoryGateway = fakeHistoryGateway();
    render(<App authGateway={signedInGateway({ signOut })} entryHistoryGateway={entryHistoryGateway} accountDataGateway={accountDataGateway} />);

    await waitFor(() => expect(entryHistoryGateway.listEntries).toHaveBeenCalledWith("user-1"));
    fireEvent.click(screen.getByRole("button", { name: /account/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^delete echo data$/i }));
    expect(accountDataGateway.wipeUserData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /confirm delete data/i }));

    await waitFor(() => expect(accountDataGateway.wipeUserData).toHaveBeenCalledWith("user-1"));
    expect(signOut).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: /let the audio go/i })).toBeInTheDocument();
  });
  it("renders the Afterglow result screen with MVP-only actions", async () => {
    const recorder = fakeRecorder();
    const transcriptionProvider = fakeTranscriptionProvider();
    const reflectionProvider = fakeReflectionProvider();
    render(
      <App
        authGateway={signedInGateway()}
        recorderFactory={async () => recorder}
        transcriptionProvider={transcriptionProvider}
        reflectionProvider={reflectionProvider}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText(/start recording/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/start recording/i));
    fireEvent.click(await screen.findByLabelText(/finish recording/i));

    expect(await screen.findByText("MY WORDS")).toBeInTheDocument();
    expect(screen.getAllByText(/I felt clearer after walking\./i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("MIRROR NOTE")).toBeInTheDocument();
    expect(screen.getByText(/It seems like the walk gave you a little more room/i)).toBeInTheDocument();
    expect(screen.getByText("A MEMORY FROM TODAY")).toBeInTheDocument();
    expect(screen.getByText("clearer")).toBeInTheDocument();
    expect(screen.getByText("settled")).toBeInTheDocument();
    expect(screen.getAllByText(/I felt clearer after walking\./i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /keep this/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /make shorter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save privately/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save image/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument();
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


  it("submits an Audio Lab recording for transcription and shows provider metadata", async () => {
    const recorder = fakeRecorder({
      finish: vi.fn(async () => ({
        blob: new Blob(["voice-diagnostic"], { type: "audio/webm" }),
        mimeType: "audio/webm",
        sizeBytes: 16,
        durationMs: 10000,
      })),
    });
    const transcriptionProvider = fakeTranscriptionProvider();
    render(
      <App
        authGateway={signedInGateway()}
        recorderFactory={async () => recorder}
        transcriptionProvider={transcriptionProvider}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /audio lab/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /audio lab/i }));
    fireEvent.click(screen.getByRole("button", { name: /test 10s/i }));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: /stop diagnostic recording/i }));
    await waitFor(() => expect(recorder.finish).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: /submit to transcription/i }));

    await waitFor(() => expect(transcriptionProvider.transcribe).toHaveBeenCalledOnce());
    expect(await screen.findByText("I felt clearer after walking.")).toBeInTheDocument();
    expect(screen.getByText("gemini / gemini-2.5-flash")).toBeInTheDocument();
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
