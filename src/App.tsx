import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import type { ReflectionEntry } from "./modules/entries/types";
import { runEntryWorkflow } from "./modules/entryWorkflow/entryWorkflow";
import { createSupabaseEntryWorkflowPorts, type SupabaseEntryWorkflowClient } from "./modules/entryWorkflow/supabaseEntryWorkflow";
import type { EntryWorkflowInput, EntryWorkflowPorts } from "./modules/entryWorkflow/types";
import { createConfiguredAuthGateway, createConfiguredSupabaseClient } from "./modules/auth/supabaseClient";
import { getAuthRedirectUrl, type AuthGateway } from "./modules/auth/auth";
import { createDefaultBrowserRecorder, chooseRecordingMimeType, preferredAudioMimeTypes } from "./modules/recording/recording";
import type { RecordedAudio, Recorder } from "./modules/recording/types";
import { DemoReflectionProvider, type ReflectionProvider } from "./modules/reflection/reflection";
import { createConfiguredTranscriptionProvider, describeTranscriptionFailure, type TranscriptionProvider, type TranscriptionResult } from "./modules/transcription/transcription";
import { getDailyPromptSet } from "./modules/prompts/prompts";
import { BottomNav, BreathingOrb, EchoButton, PromptChip, ReflectionText, SectionLabel, SoftCard, Tag } from "./modules/designSystem/designSystem";
import { linenAndSageTokens } from "./modules/designSystem/tokens";

type Route = "onboarding" | "auth" | "today" | "recording" | "processing" | "result" | "history" | "audio-lab" | "design-system";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

type RecorderFactory = () => Promise<Recorder>;

type AppProps = {
  authGateway?: AuthGateway;
  recorderFactory?: RecorderFactory;
  transcriptionProvider?: TranscriptionProvider;
};

export default function App({ authGateway: providedAuthGateway, recorderFactory = createDefaultBrowserRecorder, transcriptionProvider: providedTranscriptionProvider }: AppProps = {}) {
  const [route, setRoute] = useState<Route>("onboarding");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const promptSet = useMemo(() => getDailyPromptSet(), []);
  const [selectedPrompt, setSelectedPrompt] = useState(promptSet.dailyPrompt);
  const [entries, setEntries] = useState<ReflectionEntry[]>(() => [demoEntry]);
  const [activeEntry, setActiveEntry] = useState<ReflectionEntry | null>(demoEntry);
  const [processingMessage, setProcessingMessage] = useState("Echo is securing this reflection.");
  const transcriptionProvider = useMemo(() => providedTranscriptionProvider ?? createConfiguredTranscriptionProvider(), [providedTranscriptionProvider]);
  const audioLabTranscriptionProvider = useMemo(() => providedTranscriptionProvider ?? createConfiguredTranscriptionProvider(), [providedTranscriptionProvider]);
  const reflectionProvider = useMemo(() => new DemoReflectionProvider(), []);
  const supabaseWorkflowClient = useMemo(
    () => (providedAuthGateway ? null : createConfiguredSupabaseClient()),
    [providedAuthGateway],
  );
  const authGateway = useMemo(() => providedAuthGateway ?? createConfiguredAuthGateway(), [providedAuthGateway]);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      try {
        const session = await authGateway.getSession();
        if (!mounted || !session) return;
        setUserId(session.userId);
        setIsSignedIn(true);
        await authGateway.captureTimezone(session.userId, Intl.DateTimeFormat().resolvedOptions().timeZone);
        if (mounted) setRoute("today");
      } catch (error) {
        if (mounted) setAuthMessage(error instanceof Error ? error.message : "Could not restore your session.");
      }
    }
    void restoreSession();
    return () => {
      mounted = false;
    };
  }, [authGateway]);

  async function completeReflection(recording: RecordedAudio) {
    const recordedAt = new Date().toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setProcessingMessage("Echo is securing this reflection.");
    setRoute("processing");
    await nextUiFrame();

    const workflowInput: EntryWorkflowInput = {
      userId: userId ?? "demo-user",
      promptText: selectedPrompt,
      timezone,
      recordedAt,
      audio: recording.blob,
      mimeType: recording.mimeType,
      durationMs: recording.durationMs,
    };

    const workflowResult = await runEntryWorkflow(
      workflowInput,
      supabaseWorkflowClient
        ? createSupabaseEntryWorkflowPorts({
            client: supabaseWorkflowClient as unknown as SupabaseEntryWorkflowClient,
            transcriptionProvider,
            reflectionProvider,
            onHandoffComplete: () => {
              setProcessingMessage("Your reflection is safe to close. Echo is listening back now.");
            },
          })
        : createClientEntryWorkflowPorts({
            transcriptionProvider,
            reflectionProvider,
            onHandoffComplete: () => {
              setProcessingMessage("Your reflection is safe to close. Echo is listening back now.");
            },
          }),
    );

    if (workflowResult.status !== "ready") {
      setProcessingMessage(workflowResult.userMessage ?? "Echo could not finish this reflection.");
      return;
    }

    const entry: ReflectionEntry = {
      id: workflowResult.entryId ?? crypto.randomUUID?.() ?? String(Date.now()),
      userId: workflowInput.userId,
      promptText: selectedPrompt,
      recordedAt,
      recordedDate: todayIsoDate(),
      timezone,
      status: "ready",
      transcript: workflowResult.transcript,
      mirrorNote: workflowResult.mirrorNote,
      moodTags: workflowResult.moodTags ?? [],
      memoryQuote: workflowResult.memoryQuote,
      durationMs: recording.durationMs,
      audioRetentionPolicy: "none",
      audioStoragePath: null,
      audioMimeType: null,
      audioSizeBytes: null,
      audioDeletedAt: workflowResult.temporaryAudioDeletedAt ?? new Date().toISOString(),
      transcriptionProvider: "workflow",
      transcriptionModel: "workflow",
      reflectionProvider: "workflow",
      reflectionModel: "workflow",
    };
    setEntries((current) => [entry, ...current]);
    setActiveEntry(entry);
    setRoute("result");
  }

  function deleteEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (activeEntry?.id === id) {
      setActiveEntry(null);
      setRoute("history");
    }
  }

  return (
    <div className="app-canvas">
      <div className="phone-shell" data-route={route}>
        {route === "onboarding" && <OnboardingScreen onBegin={() => setRoute("auth")} />}
        {route === "auth" && (
          <AuthScreen
            configured={authGateway.configured}
            message={authMessage}
            onRequestLink={async (email) => {
              setAuthMessage(null);
              try {
                await authGateway.requestEmailOtp(email, getAuthRedirectUrl());
                setAuthMessage("Check your email for the Echo sign-in link.");
              } catch (error) {
                setAuthMessage(error instanceof Error ? error.message : "Could not send sign-in link.");
              }
            }}
          />
        )}
        {route === "today" && (
          <TodayScreen
            promptSet={promptSet}
            isSignedIn={isSignedIn}
            selectedPrompt={selectedPrompt}
            onSelectPrompt={setSelectedPrompt}
            onRecord={() => setRoute(isSignedIn ? "recording" : "auth")}
            onOpenHistory={() => setRoute("history")}
            onOpenAudioLab={() => setRoute("audio-lab")}
            onOpenDesignSystem={() => setRoute("design-system")}
          />
        )}
        {route === "recording" && (
          <RecordingScreen
            prompt={selectedPrompt}
            onDiscard={() => setRoute("today")}
            recorderFactory={recorderFactory}
            onFinish={(recording) => void completeReflection(recording)}
          />
        )}
        {route === "processing" && <ProcessingScreen message={processingMessage} />}
        {route === "result" && activeEntry && (
          <ResultScreen entry={activeEntry} onDone={() => setRoute("today")} onDelete={() => deleteEntry(activeEntry.id)} />
        )}
        {route === "history" && (
          <HistoryScreen
            entries={entries}
            onOpen={(entry) => {
              setActiveEntry(entry);
              setRoute("result");
            }}
            onToday={() => setRoute("today")}
          />
        )}
        {route === "audio-lab" && <AudioLabScreen recorderFactory={recorderFactory} transcriptionProvider={audioLabTranscriptionProvider} promptText={selectedPrompt} onBack={() => setRoute("today")} />}
        {route === "design-system" && <DesignSystemPreview onBack={() => setRoute("today")} />}
      </div>
    </div>
  );
}



function nextUiFrame() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
type ClientEntryWorkflowPortsInput = {
  transcriptionProvider: TranscriptionProvider;
  reflectionProvider: ReflectionProvider;
  onHandoffComplete: () => void;
};

function createClientEntryWorkflowPorts({
  transcriptionProvider,
  reflectionProvider,
  onHandoffComplete,
}: ClientEntryWorkflowPortsInput): EntryWorkflowPorts {
  return {
    async createEntry(input) {
      return { id: crypto.randomUUID?.() ?? String(Date.now()), userId: input.userId };
    },
    async updateEntryStatus() {},
    async uploadTemporaryAudio(entryId, input) {
      onHandoffComplete();
      return {
        jobId: `provider-handoff-${entryId}`,
        entryId,
        userId: input.userId,
        storagePath: `provider-handoff/${input.userId}/${entryId}.${input.mimeType.includes("mp4") ? "mp4" : "webm"}`,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
    },
    async transcribe(_handoff, input) {
      return transcriptionProvider.transcribe({
        entryId: _handoff.jobId,
        audio: input.audio,
        mimeType: input.mimeType,
        durationMs: input.durationMs,
        promptText: input.promptText,
      });
    },
    async deleteTemporaryAudio() {
      return { deletedAt: new Date().toISOString() };
    },
    async reflect(input) {
      return reflectionProvider.reflect(input);
    },
    async saveEntryResult() {},
    async markFailed() {},
    async recordEvent() {},
  };
}
function StatusBar() {
  return (
    <div className="status-bar" aria-hidden="true">
      <span>9:41</span>
      <span className="battery" />
    </div>
  );
}

function OnboardingScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <main className="screen onboarding-screen">
      <div className="brand">ECHO</div>
      <BreathingOrb kind="hero" />
      <h1>You don't have to remember every detail of your life to understand who you're becoming.</h1>
      <EchoButton tone="dark" onClick={onBegin}>Begin</EchoButton>
      <p className="quiet">Takes a minute a day</p>
    </main>
  );
}

function AuthScreen({
  configured,
  message,
  onRequestLink,
}: {
  configured: boolean;
  message: string | null;
  onRequestLink: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email || submitting || !configured) return;
    setSubmitting(true);
    try {
      await onRequestLink(email);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="screen auth-screen">
      <p className="eyebrow">PRIVATE BY DESIGN</p>
      <h1>Speak briefly. Keep the words. Let the audio go.</h1>
      <p className="body-copy">
        Echo turns your short recording into text, then deletes temporary audio after transcription. During early testing,
        reflections may be processed by third-party AI providers.
      </p>
      <label className="input-label">
        Email
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          disabled={!configured || submitting}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <EchoButton tone="sage" onClick={() => void submit()} disabled={!configured || submitting || !email}>
        {submitting ? "Sending..." : "Email me a sign-in link"}
      </EchoButton>
      <p className="quiet">
        {message ??
          (configured
            ? "Magic link or OTP sign-in for the MVP."
            : "Supabase auth is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable tester sign-in.")}
      </p>
    </main>
  );
}

function TodayScreen(props: {
  promptSet: ReturnType<typeof getDailyPromptSet>;
  isSignedIn: boolean;
  selectedPrompt: string;
  onSelectPrompt: (prompt: string) => void;
  onRecord: () => void;
  onOpenHistory: () => void;
  onOpenAudioLab: () => void;
  onOpenDesignSystem: () => void;
}) {
  const offline = typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
  return (
    <main className="screen today-screen">
      <StatusBar />
      <section className="today-head">
        <p className="eyebrow">{props.promptSet.todayLabel}</p>
        <h1>{props.promptSet.greeting}<br />{props.selectedPrompt}</h1>
      </section>
      <section className="prompt-chips" aria-label="Prompt chips">
        {props.promptSet.promptChips.map((prompt) => (
          <PromptChip selected={props.selectedPrompt === prompt} key={prompt} onClick={() => props.onSelectPrompt(prompt)}>
            {prompt}
          </PromptChip>
        ))}
      </section>
      <section className="record-cta">
        <button className="record-orb" aria-label="Start recording" disabled={offline || !props.isSignedIn} onClick={props.onRecord}>
          <Mic size={36} />
        </button>
        <p>{offline ? "Echo needs a connection to transcribe without keeping your audio." : "Tap to speak - about a minute"}</p>
      </section>
      <button className="yesterday-card" onClick={props.onOpenHistory}>
        <span>YESTERDAY YOU SAID</span>
        <q>I slowed down enough to actually hear my daughter today.</q>
      </button>
      <div className="dev-links">
        <button onClick={props.onOpenAudioLab}>Audio Lab</button>
        <button onClick={props.onOpenDesignSystem}>Design System</button>
      </div>
      <BottomNav active="today" onToday={() => undefined} onHistory={props.onOpenHistory} />
    </main>
  );
}

function RecordingScreen({
  prompt,
  recorderFactory,
  onDiscard,
  onFinish,
}: {
  prompt: string;
  recorderFactory: RecorderFactory;
  onDiscard: () => void;
  onFinish: (recording: RecordedAudio) => void;
}) {
  const recorderRef = useRef<Recorder | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let mounted = true;
    let interval: number | undefined;

    async function start() {
      try {
        const recorder = await recorderFactory();
        if (!mounted) return;
        recorderRef.current = recorder;
        await recorder.start();
        interval = window.setInterval(() => {
          setElapsedMs((current) => {
            const next = Math.min(current + 250, 60000);
            if (next >= 60000) void finish();
            return next;
          });
        }, 250);
      } catch (startError) {
        if (mounted) setError(startError instanceof Error ? startError.message : "Recording could not start.");
      }
    }

    void start();

    return () => {
      mounted = false;
      if (interval) window.clearInterval(interval);
      void recorderRef.current?.discard();
    };
    // The recorder lifecycle starts once when the screen mounts; finish reads refs/current state intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderFactory]);

  async function finish() {
    if (finishing || !recorderRef.current) return;
    setFinishing(true);
    try {
      const recording = await recorderRef.current.finish();
      onFinish(recording);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Recording could not be finished.");
      setFinishing(false);
    }
  }

  async function discard() {
    await recorderRef.current?.discard();
    onDiscard();
  }

  const seconds = Math.floor(elapsedMs / 1000);
  const remaining = Math.max(0, 60 - seconds);
  const progress = Math.min(100, (elapsedMs / 60000) * 100);

  return (
    <main className="screen recording-screen">
      <p className="eyebrow centered">LISTENING</p>
      <h1>{prompt}</h1>
      <div className="recording-orb" />
      <div className="waveform" aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => (
          <span key={index} style={{ height: `${20 + ((index * 17) % 42)}px` }} />
        ))}
      </div>
      <div className="timer">0:{String(seconds).padStart(2, "0")}</div>
      <div className="progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="quiet">{error ?? `about ${remaining} seconds left`}</p>
      <div className="recording-actions">
        <button className="round secondary" onClick={() => void discard()} aria-label="Discard recording">
          x
        </button>
        <button className="round finish" onClick={() => void finish()} aria-label="Finish recording" disabled={finishing || Boolean(error)}>
          <span />
        </button>
      </div>
    </main>
  );
}

function ProcessingScreen({ message }: { message: string }) {
  return (
    <main className="screen processing-screen">
      <div className="spinner-orb" />
      <h1>Your reflection is saved.</h1>
      <p className="body-copy">{message}</p>
    </main>
  );
}

function ResultScreen({ entry, onDone, onDelete }: { entry: ReflectionEntry; onDone: () => void; onDelete: () => void }) {
  return (
    <main className="screen result-screen">
      <p className="eyebrow centered">{displayDate(entry.recordedAt).toUpperCase()} � {Math.round((entry.durationMs ?? 0) / 1000)}S</p>
      <section>
        <SectionLabel tone="clay">MY WORDS</SectionLabel>
        <ReflectionText className="transcript">"{entry.transcript}"</ReflectionText>
      </section>
      <section>
        <SectionLabel>MIRROR NOTE</SectionLabel>
        <SoftCard className="mirror-card">{entry.mirrorNote}</SoftCard>
      </section>
      <section>
        <SectionLabel tone="clay">A MEMORY FROM TODAY</SectionLabel>
        <div className="memory-card">
          <p className="memory-date">{displayDate(entry.recordedAt).toUpperCase()}</p>
          <q>{entry.memoryQuote}</q>
          <div className="tag-row">
            {entry.moodTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>
      </section>
      <div className="result-actions">
        <EchoButton tone="sage" onClick={onDone}>Done</EchoButton>
        <EchoButton tone="muted" onClick={onDelete}>Delete</EchoButton>
      </div>
    </main>
  );
}

function HistoryScreen({ entries, onOpen, onToday }: { entries: ReflectionEntry[]; onOpen: (entry: ReflectionEntry) => void; onToday: () => void }) {
  return (
    <main className="screen history-screen">
      <StatusBar />
      <section className="history-head">
        <h1>Reflections</h1>
        <p>{entries.length} kept</p>
      </section>
      <section className="entry-list">
        {entries.map((entry) => (
          <button key={entry.id} className="entry-row" onClick={() => onOpen(entry)}>
            <span className="entry-icon">
              <Sparkles size={18} />
            </span>
            <span>
              <span className="entry-meta">
                {displayDate(entry.recordedAt).toUpperCase()} � {entry.moodTags[0] ?? "reflection"}
              </span>
              <q>{entry.memoryQuote ?? entry.transcript}</q>
            </span>
          </button>
        ))}
      </section>
      <BottomNav active="history" onToday={onToday} onHistory={() => undefined} />
    </main>
  );
}

function AudioLabScreen({ recorderFactory, transcriptionProvider, promptText, onBack }: { recorderFactory: RecorderFactory; transcriptionProvider: TranscriptionProvider; promptText: string; onBack: () => void }) {
  const [recording, setRecording] = useState<RecordedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"idle" | "granted" | "denied" | "unavailable">("idle");
  const [activeTestSeconds, setActiveTestSeconds] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Microphone permission has not been requested yet.");
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      void recorderRef.current?.discard();
      if (playbackUrl) URL.revokeObjectURL?.(playbackUrl);
    };
  }, [playbackUrl]);

  function clearActiveTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetPlaybackUrl() {
    if (playbackUrl) URL.revokeObjectURL?.(playbackUrl);
    setPlaybackUrl(null);
  }

  function markFailure(startError: unknown) {
    const message = startError instanceof Error ? startError.message : "Audio Lab could not start recording.";
    const normalized = message.toLowerCase();
    const nextState = normalized.includes("permission") || normalized.includes("denied") ? "denied" : "unavailable";
    setPermissionState(nextState);
    setStatusMessage(nextState === "denied" ? "Permission denied or unavailable." : "Microphone unavailable in this browser context.");
    setError(message);
    setActiveTestSeconds(null);
    recorderRef.current = null;
  }

  async function start(seconds: number) {
    clearActiveTimer();
    resetPlaybackUrl();
    setError(null);
    setRecording(null);
    setActiveTestSeconds(seconds);
    setStatusMessage("Requesting microphone permission...");
    try {
      const recorder = await recorderFactory();
      recorderRef.current = recorder;
      await recorder.start();
      setPermissionState("granted");
      setStatusMessage(`Permission granted. Recording ${seconds}s test.`);
      timerRef.current = window.setTimeout(() => void finish(), seconds * 1000);
    } catch (startError) {
      clearActiveTimer();
      markFailure(startError);
    }
  }

  async function finish() {
    if (!recorderRef.current) return;
    clearActiveTimer();
    try {
      const nextRecording = await recorderRef.current.finish();
      setRecording(nextRecording);
      setPlaybackUrl(URL.createObjectURL(nextRecording.blob));
      setStatusMessage("Recording complete. Local playback only for diagnostics.");
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Audio Lab could not finish recording.");
      setStatusMessage("Recording failed during stop. Capture this on the iPhone checklist.");
    } finally {
      setActiveTestSeconds(null);
      recorderRef.current = null;
    }
  }

  async function cancel() {
    clearActiveTimer();
    await recorderRef.current?.discard();
    recorderRef.current = null;
    setActiveTestSeconds(null);
    setRecording(null);
    resetPlaybackUrl();
    setStatusMessage("Recording canceled before upload or transcription.");
  }


  async function submitForTranscription() {
    if (!recording || transcribing) return;
    setTranscribing(true);
    setTranscription(null);
    setTranscriptionError(null);
    setStatusMessage("Submitting recording to server-side transcription...");
    try {
      const result = await transcriptionProvider.transcribe({
        audio: recording.blob,
        mimeType: recording.mimeType,
        durationMs: recording.durationMs,
        promptText,
      });
      setTranscription(result);
      setStatusMessage("Transcription returned from server-side provider.");
    } catch (submitError) {
      const message = describeTranscriptionFailure(submitError);
      setTranscriptionError(message);
      setStatusMessage("Transcription failed. Capture this failure on the iPhone checklist.");
    } finally {
      setTranscribing(false);
    }
  }
  const browserMetadata = [
    ["User agent", typeof navigator === "undefined" ? "unknown" : navigator.userAgent],
    ["Platform", typeof navigator === "undefined" ? "unknown" : navigator.platform || "not reported"],
    ["Secure context", typeof window === "undefined" ? "unknown" : window.isSecureContext ? "yes" : "no"],
    ["MediaRecorder", typeof MediaRecorder === "undefined" ? "unavailable" : "available"],
  ];

  return (
    <main className="screen audio-lab-screen">
      <p className="eyebrow">AUDIO LAB</p>
      <h1>Prove the voice loop before polish.</h1>
      <p className="body-copy">
        Internal diagnostics for permission, MIME output, duration caps, cancellation, local playback, and useful failure notes.
      </p>
      <div className="diagnostic-card">
        <div><span>Permission</span><strong>{permissionState}</strong></div>
        <div><span>Status</span><strong>{statusMessage}</strong></div>
      </div>
      <div className="diagnostic-card">
        {preferredAudioMimeTypes.map((candidate) => (
          <div key={candidate}>
            <span>{candidate}</span>
            <strong>{chooseRecordingMimeType([candidate]) ? "supported" : "not reported"}</strong>
          </div>
        ))}
      </div>
      <div className="diagnostic-card">
        {browserMetadata.map(([label, value]) => (
          <div key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>
      <div className="audio-lab-actions">
        {[10, 30, 60].map((seconds) => (
          <button className="primary muted" key={seconds} disabled={activeTestSeconds !== null} onClick={() => void start(seconds)}>
            Test {seconds}s
          </button>
        ))}
      </div>
      {activeTestSeconds !== null && (
        <div className="audio-lab-actions">
          <button className="primary sage" onClick={() => void finish()} aria-label="Stop diagnostic recording">
            Stop
          </button>
          <button className="primary muted" onClick={() => void cancel()} aria-label="Cancel diagnostic recording">
            Cancel
          </button>
        </div>
      )}
      {recording && (
        <div className="diagnostic-card">
          <div><span>Actual MIME</span><strong>{recording.mimeType || "not reported"}</strong></div>
          <div><span>Blob size</span><strong>{recording.sizeBytes} bytes</strong></div>
          <div><span>Duration</span><strong>{Math.round(recording.durationMs / 1000)}s</strong></div>
          <p className="quiet">Local playback only. Echo MVP still deletes temporary audio after transcription.</p>
          {playbackUrl && <audio controls src={playbackUrl} aria-label="Audio Lab local diagnostic playback" />}
          <button className="primary sage" onClick={() => void submitForTranscription()} disabled={transcribing} aria-label="Submit to transcription">
            {transcribing ? "Transcribing..." : "Submit to transcription"}
          </button>
        </div>
      )}
      {transcription && (
        <div className="diagnostic-card">
          <div><span>Transcript</span><strong>{transcription.text}</strong></div>
          <div><span>Provider / model</span><strong>{transcription.provider} / {transcription.model}</strong></div>
          {transcription.language && <div><span>Language</span><strong>{transcription.language}</strong></div>}
        </div>
      )}
      {transcriptionError && <p className="quiet">{transcriptionError}</p>}
      {error && <p className="quiet">{error}</p>}
      <EchoButton tone="dark" onClick={onBack}>Back to Today</EchoButton>
    </main>
  );
}

function DesignSystemPreview({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen design-system-screen">
      <p className="eyebrow">LINEN & SAGE</p>
      <h1>Design primitives for Echo.</h1>
      <div className="swatch-row" aria-label="Linen and Sage color tokens">
        {Object.entries(linenAndSageTokens).map(([name, value]) => (
          <span key={name} style={{ background: value }} title={`${name}: ${value}`} />
        ))}
      </div>
      <section className="prompt-chips" aria-label="Design prompt chips">
        <PromptChip selected>What drained you today?</PromptChip>
        <PromptChip>A small good thing</PromptChip>
      </section>
      <BreathingOrb kind="record" label="Preview record orb" />
      <SoftCard className="preview-card">
        <SectionLabel tone="clay">MY WORDS</SectionLabel>
        <ReflectionText>"By the time I got home I had almost nothing left."</ReflectionText>
        <div className="tag-row"><Tag>depleted</Tag><Tag>boundaries</Tag></div>
      </SoftCard>
      <EchoButton tone="dark" onClick={onBack}>Back to Today</EchoButton>
    </main>
  );
}
const demoEntry: ReflectionEntry = {
  id: "demo-1",
  userId: "demo-user",
  promptText: "What drained you today?",
  recordedAt: "2026-06-25T20:30:00.000Z",
  recordedDate: "2026-06-25",
  timezone: "Asia/Singapore",
  status: "ready",
  transcript:
    "Work pulled at me all day. By the time I got home I had almost nothing left for the people I care about.",
  mirrorNote:
    "You mentioned having almost nothing left for the people you care about. One thing that stands out is how clearly you noticed the pattern.",
  moodTags: ["depleted", "boundaries"],
  memoryQuote: "By the time I got home I had almost nothing left for the people I care about.",
  durationMs: 54000,
  audioRetentionPolicy: "none",
  audioStoragePath: null,
  audioMimeType: null,
  audioSizeBytes: null,
  audioDeletedAt: "2026-06-25T20:31:00.000Z",
  transcriptionProvider: "demo",
  transcriptionModel: "demo-transcriber",
  reflectionProvider: "demo",
  reflectionModel: "demo-reflector",
};
