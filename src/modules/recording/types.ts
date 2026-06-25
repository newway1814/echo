export type RecordingFailureCode =
  | "microphone_unavailable"
  | "recorder_unavailable"
  | "not_recording"
  | "recording_failed";

export class RecordingFailure extends Error {
  readonly code: RecordingFailureCode;

  constructor(code: RecordingFailureCode, message: string) {
    super(message);
    this.name = "RecordingFailure";
    this.code = code;
  }
}

export type RecordedAudio = {
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
};

export type Recorder = {
  start: () => Promise<void>;
  finish: () => Promise<RecordedAudio>;
  discard: () => Promise<void>;
};

export type MediaStreamLike = {
  id?: string;
  getTracks?: () => Array<{ stop: () => void }>;
};

export type MediaRecorderLike = {
  mimeType: string;
  start: () => void;
  stop: () => void;
  requestStop?: () => Promise<Blob>;
  addEventListener?: (event: string, callback: (event: BlobEvent) => void) => void;
};

export type BrowserRecorderPorts = {
  requestStream: () => Promise<MediaStreamLike>;
  createMediaRecorder: (
    stream: MediaStreamLike,
    options: { mimeType?: string },
  ) => MediaRecorderLike;
  chooseMimeType: () => string | undefined;
  getNow?: () => number;
};
