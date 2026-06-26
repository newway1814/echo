export type MirrorNoteValidation = {
  valid: boolean;
  reasons: string[];
};

export type ReflectionInput = {
  transcript: string;
  promptText: string;
};

export type ReflectionResult = {
  mirrorNote: string;
  moodTags: string[];
  memoryQuote: string;
  provider: string;
  model: string;
};

export interface ReflectionProvider {
  reflect(input: ReflectionInput): Promise<ReflectionResult>;
}

type Fetcher = typeof fetch;

type GeminiReflectionProviderOptions = {
  endpoint?: string;
  headers?: Record<string, string>;
  fetcher?: Fetcher;
};

export class ReflectionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly reasons: string[] = [],
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ReflectionError";
  }
}

const diagnosticTerms = [
  "depressed",
  "depression",
  "anxiety",
  "anxious disorder",
  "trauma response",
  "bipolar",
  "adhd",
  "ptsd",
  "diagnosis",
  "clinical",
  "medical",
  "mental health disorder",
];

const certaintyPatterns = [/\byou are\b/i, /\bclearly (have|are|need|feel|felt)\b/i, /\bobviously\b/i, /\bdefinitely\b/i];
const cautiousFramingPattern = /(you mentioned|it seems|one thing that stands out)/i;

export function validateMirrorNote(note: string): MirrorNoteValidation {
  const lower = note.toLowerCase();
  const reasons: string[] = [];

  if (!note.trim()) reasons.push("empty_mirror_note");
  if (diagnosticTerms.some((term) => lower.includes(term))) {
    reasons.push("diagnostic_language");
  }
  if (certaintyPatterns.some((pattern) => pattern.test(note))) {
    reasons.push("certainty_language");
  }
  if (!cautiousFramingPattern.test(note)) {
    reasons.push("missing_cautious_framing");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function normalizeReflectionResult(input: ReflectionInput, result: ReflectionResult): ReflectionResult {
  const validation = validateMirrorNote(result.mirrorNote);
  if (!validation.valid) {
    throw new ReflectionError("unsafe_mirror_note", `Unsafe Mirror Note: ${validation.reasons.join(", ")}`, validation.reasons);
  }

  const moodTags = normalizeMoodTags(result.moodTags);
  if (moodTags.length === 0) {
    throw new ReflectionError("invalid_mood_tags", "Reflection must include one to three gentle mood tags.");
  }

  return {
    mirrorNote: result.mirrorNote.trim(),
    moodTags,
    memoryQuote: chooseMemoryQuote(input.transcript),
    provider: result.provider,
    model: result.model,
  };
}

export function createQuoteBasedMemoryCard(input: {
  transcript: string;
  tags: string[];
  recordedAt: string;
}) {
  return {
    quote: chooseMemoryQuote(input.transcript),
    tags: input.tags.slice(0, 3),
    recordedAt: input.recordedAt,
  };
}

export function chooseMemoryQuote(transcript: string): string {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const preferred = sentences.find((sentence) => sentence.length >= 45 && sentence.length <= 140);
  return preferred ?? sentences[0] ?? transcript.trim();
}

export class DemoReflectionProvider implements ReflectionProvider {
  async reflect(input: ReflectionInput): Promise<ReflectionResult> {
    return normalizeReflectionResult(input, {
      mirrorNote:
        "You mentioned having almost nothing left for the people you care about. One thing that stands out is how clearly you noticed the pattern.",
      moodTags: ["depleted", "boundaries"],
      memoryQuote: chooseMemoryQuote(input.transcript),
      provider: "demo",
      model: "demo-reflector",
    });
  }
}

export class GeminiReflectionProvider implements ReflectionProvider {
  private readonly endpoint: string;
  private readonly headers?: Record<string, string>;
  private readonly fetcher: Fetcher;

  constructor(options: GeminiReflectionProviderOptions | string = {}) {
    if (typeof options === "string") {
      this.endpoint = options;
      this.fetcher = fetch;
      return;
    }

    this.endpoint = options.endpoint ?? "/api/reflect";
    this.headers = options.headers;
    this.fetcher = options.fetcher ?? fetch;
  }

  async reflect(input: ReflectionInput): Promise<ReflectionResult> {
    let response: Response;
    try {
      response = await this.fetcher(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.headers },
        body: JSON.stringify(input),
      });
    } catch (error) {
      throw new ReflectionError("request_failed", error instanceof Error ? error.message : "Reflection request failed.");
    }

    const payload = await readJson(response);

    if (!response.ok) {
      const code = typeof payload?.error === "string" ? payload.error : "reflection_failed";
      throw new ReflectionError(code, humanizeReflectionError(code, response.status), [], response.status);
    }

    if (!isReflectionPayload(payload)) {
      throw new ReflectionError("invalid_reflection_response", "Reflection returned an invalid response.", [], response.status);
    }

    return normalizeReflectionResult(input, payload);
  }
}

type PublicReflectionEnv = Partial<Record<"VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY", string>> & Record<string, unknown>;

export function createConfiguredReflectionProvider(env: PublicReflectionEnv = import.meta.env as PublicReflectionEnv): ReflectionProvider {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return new DemoReflectionProvider();

  return new GeminiReflectionProvider({
    endpoint: `${supabaseUrl.replace(/\/$/, "")}/functions/v1/reflect-entry`,
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
  });
}

function normalizeMoodTags(tags: string[]) {
  return tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .filter((tag) => tag.length <= 32)
    .filter((tag) => !diagnosticTerms.some((term) => tag.includes(term)))
    .slice(0, 3);
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isReflectionPayload(payload: Record<string, unknown> | null): payload is ReflectionResult {
  return Boolean(
    payload &&
      typeof payload.mirrorNote === "string" &&
      Array.isArray(payload.moodTags) &&
      payload.moodTags.every((tag) => typeof tag === "string") &&
      typeof payload.memoryQuote === "string" &&
      typeof payload.provider === "string" &&
      typeof payload.model === "string",
  );
}

function humanizeReflectionError(code: string, status: number) {
  if (code === "missing_gemini_api_key") return "Gemini reflection is not configured on the server.";
  if (code === "missing_transcript_or_prompt") return "Reflection needs both transcript and prompt text.";
  if (code === "unsafe_reflection_output") return "Reflection output did not meet Echo safety rules.";
  if (code === "gemini_reflection_failed") return `Gemini reflection failed with status ${status}.`;
  return `Reflection failed with status ${status}.`;
}

