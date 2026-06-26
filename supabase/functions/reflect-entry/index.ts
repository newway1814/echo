// Supabase Edge Function: reflect-entry
// Gemini is used for development only. Keep GEMINI_API_KEY server-side.

type ReflectBody = {
  transcript?: string;
  promptText?: string;
};

type GeminiReflectionPayload = {
  mirrorNote?: unknown;
  moodTags?: unknown;
};

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "missing_gemini_api_key" }, 500);
    }

    const body = (await request.json()) as ReflectBody;
    const transcript = body.transcript?.trim();
    const promptText = body.promptText?.trim();

    if (!transcript || !promptText) {
      return json({ error: "missing_transcript_or_prompt" }, 400);
    }

    const model = Deno.env.get("GEMINI_REFLECTION_MODEL") ?? "gemini-2.5-flash";
    const prompt = [
      "You are Echo, a reflective self-reflection product.",
      "Return strict JSON with only mirrorNote and moodTags.",
      "mirrorNote must be 1-2 sentences and use cautious language such as 'You mentioned', 'It seems like', or 'One thing that stands out is'.",
      "Avoid diagnosis, therapy claims, certainty about emotions, and medical or mental-health conclusions.",
      "moodTags must be 1-3 short gentle scan labels.",
      `Prompt: ${promptText}`,
      `Transcript: ${transcript}`,
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!response.ok) {
      return json({ error: "gemini_reflection_failed", status: response.status, provider: "gemini", model }, 502);
    }

    const payload = await response.json();
    const raw = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join(" ").trim();
    const parsed = parseReflectionPayload(raw);
    if (!parsed) {
      return json({ error: "invalid_reflection_response", provider: "gemini", model }, 502);
    }

    const mirrorNote = String(parsed.mirrorNote).trim();
    const moodTags = normalizeMoodTags(parsed.moodTags);
    const validation = validateMirrorNote(mirrorNote);

    if (!validation.valid || moodTags.length === 0) {
      return json(
        {
          error: "unsafe_reflection_output",
          reasons: [...validation.reasons, ...(moodTags.length === 0 ? ["invalid_mood_tags"] : [])],
          provider: "gemini",
          model,
        },
        502,
      );
    }

    return json({
      mirrorNote,
      moodTags,
      memoryQuote: chooseMemoryQuote(transcript),
      provider: "gemini",
      model,
    });
  } catch (error) {
    return json({ error: "reflection_request_failed", message: error instanceof Error ? error.message : "Unknown failure" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function parseReflectionPayload(raw: string | undefined): GeminiReflectionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GeminiReflectionPayload;
    if (typeof parsed.mirrorNote !== "string" || !Array.isArray(parsed.moodTags)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function validateMirrorNote(note: string) {
  const lower = note.toLowerCase();
  const reasons: string[] = [];

  if (!note) reasons.push("empty_mirror_note");
  if (diagnosticTerms.some((term) => lower.includes(term))) reasons.push("diagnostic_language");
  if (certaintyPatterns.some((pattern) => pattern.test(note))) reasons.push("certainty_language");
  if (!cautiousFramingPattern.test(note)) reasons.push("missing_cautious_framing");

  return { valid: reasons.length === 0, reasons };
}

function normalizeMoodTags(tags: unknown[]) {
  return tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .filter((tag) => tag.length <= 32)
    .filter((tag) => !diagnosticTerms.some((term) => tag.includes(term)))
    .slice(0, 3);
}

function chooseMemoryQuote(transcript: string): string {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const preferred = sentences.find((sentence) => sentence.length >= 45 && sentence.length <= 140);
  return preferred ?? sentences[0] ?? transcript.trim();
}
