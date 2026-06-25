// Supabase Edge Function: transcribe-entry
// Gemini is used for development only. Keep GEMINI_API_KEY server-side.

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({ error: "missing_gemini_api_key" }, 500);
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  const mimeType = String(formData.get("mimeType") ?? "application/octet-stream");
  const model = Deno.env.get("GEMINI_TRANSCRIPTION_MODEL") ?? "gemini-2.5-flash";

  if (!(audio instanceof File)) {
    return json({ error: "missing_audio" }, 400);
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  const base64 = btoa(String.fromCharCode(...bytes));
  const parts: GeminiPart[] = [
    {
      text:
        "Transcribe this short spoken self-reflection. Return only the transcript text. Do not summarize, diagnose, or add commentary.",
    },
    { inlineData: { mimeType, data: base64 } },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    },
  );

  if (!response.ok) {
    return json({ error: "gemini_transcription_failed", status: response.status }, 502);
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join(" ").trim();

  return json({ text, provider: "gemini", model });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
