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

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly endpoint = "/api/transcribe") {}

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append("audio", input.audio, `reflection.${extensionForMimeType(input.mimeType)}`);
    formData.append("mimeType", input.mimeType);
    formData.append("durationMs", String(input.durationMs));
    if (input.entryId) formData.append("entryId", input.entryId);
    if (input.promptText) formData.append("promptText", input.promptText);

    const response = await fetch(this.endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed with ${response.status}`);
    }

    return response.json() as Promise<TranscriptionResult>;
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

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "audio";
}



