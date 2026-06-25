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
];

const certaintyPatterns = [/\byou are\b/i, /\bclearly (have|are|need|feel|felt)\b/i, /\bobviously\b/i, /\bdefinitely\b/i];

export function validateMirrorNote(note: string): MirrorNoteValidation {
  const lower = note.toLowerCase();
  const reasons: string[] = [];

  if (diagnosticTerms.some((term) => lower.includes(term))) {
    reasons.push("diagnostic_language");
  }
  if (certaintyPatterns.some((pattern) => pattern.test(note))) {
    reasons.push("certainty_language");
  }
  if (!/(you mentioned|it seems|one thing that stands out)/i.test(note)) {
    reasons.push("missing_cautious_framing");
  }

  return {
    valid: reasons.length === 0,
    reasons,
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
    const memoryQuote = chooseMemoryQuote(input.transcript);
    return {
      mirrorNote:
        "You mentioned having almost nothing left for the people you care about. One thing that stands out is how clearly you noticed the pattern.",
      moodTags: ["depleted", "boundaries"],
      memoryQuote,
      provider: "demo",
      model: "demo-reflector",
    };
  }
}

export class GeminiReflectionProvider implements ReflectionProvider {
  constructor(private readonly endpoint = "/api/reflect") {}

  async reflect(input: ReflectionInput): Promise<ReflectionResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Reflection failed with ${response.status}`);
    }

    const result = (await response.json()) as ReflectionResult;
    const validation = validateMirrorNote(result.mirrorNote);
    if (!validation.valid) {
      throw new Error(`Unsafe Mirror Note: ${validation.reasons.join(", ")}`);
    }
    return result;
  }
}

