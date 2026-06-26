export type TranscriptionInput = {
  entryId?: string;
  audio: Blob;
  mimeType: string;
  durationMs: number;
  promptText?: string;
};

export type TranscriptionResult = {
  text: string;
  provider: string;
  model: string;
  language?: string;
};

export interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

type Fetcher = typeof fetch;

type GeminiProviderOptions = {
  endpoint?: string;
  headers?: Record<string, string>;
  fetcher?: Fetcher;
};

export class TranscriptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  private readonly endpoint: string;
  private readonly headers?: Record<string, string>;
  private readonly fetcher: Fetcher;

  constructor(options: GeminiProviderOptions | string = {}) {
    if (typeof options === "string") {
      this.endpoint = options;
      this.fetcher = fetch;
      return;
    }

    this.endpoint = options.endpoint ?? "/api/transcribe";
    this.headers = options.headers;
    this.fetcher = options.fetcher ?? fetch;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append("audio", input.audio, `reflection.${extensionForMimeType(input.mimeType)}`);
    formData.append("mimeType", input.mimeType);
    formData.append("durationMs", String(input.durationMs));
    if (input.entryId) formData.append("entryId", input.entryId);
    if (input.promptText) formData.append("promptText", input.promptText);

    let response: Response;
    try {
      response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: this.headers,
        body: formData,
      });
    } catch (error) {
      throw new TranscriptionError("request_failed", error instanceof Error ? error.message : "Transcription request failed.");
    }

    const payload = await readJson(response);

    if (!response.ok) {
      const code = typeof payload?.error === "string" ? payload.error : "transcription_failed";
      throw new TranscriptionError(code, humanizeTranscriptionError(code, response.status), response.status);
    }

    if (!payload || typeof payload.text !== "string" || typeof payload.provider !== "string" || typeof payload.model !== "string") {
      throw new TranscriptionError("invalid_transcription_response", "Transcription returned an invalid response.", response.status);
    }

    return {
      text: payload.text,
      provider: payload.provider,
      model: payload.model,
      language: typeof payload.language === "string" ? payload.language : undefined,
    };
  }
}

export class DemoTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_input?: TranscriptionInput): Promise<TranscriptionResult> {
    void _input;
    return {
      text: "Work pulled at me all day. By the time I got home I had almost nothing left for the people I care about.",
      provider: "demo",
      model: "demo-transcriber",
    };
  }
}

type PublicTranscriptionEnv = Partial<Record<"VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY", string>> & Record<string, unknown>;

export function createConfiguredTranscriptionProvider(env: PublicTranscriptionEnv = import.meta.env as PublicTranscriptionEnv): TranscriptionProvider {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return new DemoTranscriptionProvider();

  return new GeminiTranscriptionProvider({
    endpoint: `${supabaseUrl.replace(/\/$/, "")}/functions/v1/transcribe-entry`,
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
  });
}

export function describeTranscriptionFailure(error: unknown) {
  if (error instanceof TranscriptionError) return error.message;
  return error instanceof Error ? error.message : "Transcription failed.";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "audio";
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function humanizeTranscriptionError(code: string, status: number) {
  if (code === "missing_gemini_api_key") return "Gemini transcription is not configured on the server.";
  if (code === "missing_audio") return "No audio was received for transcription.";
  if (code === "empty_transcript") return "Gemini did not return transcript text.";
  if (code === "gemini_transcription_failed") return `Gemini transcription failed with status ${status}.`;
  return `Transcription failed with status ${status}.`;
}
