// Supabase Edge Function: reflect-entry
// Gemini is used for development only. Keep GEMINI_API_KEY server-side.

type ReflectBody = {
  transcript?: string;
  promptText?: string;
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({ error: "missing_gemini_api_key" }, 500);
  }

  const body = (await request.json()) as ReflectBody;
  if (!body.transcript || !body.promptText) {
    return json({ error: "missing_transcript_or_prompt" }, 400);
  }

  const model = Deno.env.get("GEMINI_REFLECTION_MODEL") ?? "gemini-2.5-flash";
  const prompt = `You are Echo, a reflective self-reflection product.\n\nPrompt: ${body.promptText}\nTranscript: ${body.transcript}\n\nReturn strict JSON with mirrorNote, moodTags, and memoryQuote.\nRules:\n- mirrorNote: 1-2 sentences. Use cautious language like "You mentioned", "It seems like", or "One thing that stands out is".\n- Avoid diagnosis, therapy claims, certainty about emotions, and medical or mental-health conclusions.\n- moodTags: 1-3 short gentle labels.\n- memoryQuote: exact quote from the transcript, not rewritten.`;

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
    return json({ error: "gemini_reflection_failed", status: response.status }, 502);
  }

  const payload = await response.json();
  const raw = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join(" ").trim();
  const parsed = JSON.parse(raw);

  return json({ ...parsed, provider: "gemini", model });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
