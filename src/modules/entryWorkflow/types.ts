import type { ReflectionResult } from "../reflection/reflection";
import type { TranscriptionResult } from "../transcription/transcription";

export type EntryStatus =
  | "draft_recording"
  | "recorded_locally"
  | "uploading_for_transcription"
  | "transcribing"
  | "transcribed"
  | "reflecting"
  | "ready"
  | "recording_failed"
  | "upload_failed"
  | "transcription_failed_retryable"
  | "transcription_failed_expired"
  | "reflection_failed"
  | "deleted";

export type EntryWorkflowInput = {
  userId: string;
  promptText: string;
  timezone: string;
  recordedAt: string;
  audio: Blob;
  mimeType: string;
  durationMs: number;
};

export type TemporaryAudioHandoff = {
  jobId: string;
  entryId: string;
  userId: string;
  storagePath: string;
  expiresAt: string;
};

export type TemporaryAudioDeletion = {
  deletedAt: string;
};

export type EntryWorkflowSavedResult = {
  transcript: string;
  transcriptionProvider: string;
  transcriptionModel: string;
  mirrorNote: string;
  moodTags: string[];
  memoryQuote: string;
  reflectionProvider: string;
  reflectionModel: string;
  audioDeletedAt: string;
};

export type EntryWorkflowResult = {
  status: EntryStatus;
  entryId?: string;
  transcript?: string;
  mirrorNote?: string;
  moodTags?: string[];
  memoryQuote?: string;
  temporaryAudioDeleted?: boolean;
  temporaryAudioDeletedAt?: string;
  userMessage?: string;
};

export type EntryWorkflowPorts = {
  createEntry: (input: EntryWorkflowInput) => Promise<{ id: string; userId: string }>;
  uploadTemporaryAudio: (
    entryId: string,
    input: EntryWorkflowInput,
  ) => Promise<TemporaryAudioHandoff>;
  transcribe: (
    handoff: TemporaryAudioHandoff,
    input: EntryWorkflowInput,
  ) => Promise<TranscriptionResult>;
  updateEntryStatus: (entryId: string, status: EntryStatus) => Promise<void>;
  deleteTemporaryAudio: (handoff: TemporaryAudioHandoff) => Promise<TemporaryAudioDeletion>;
  reflect: (input: { transcript: string; promptText: string }) => Promise<ReflectionResult>;
  saveEntryResult: (entryId: string, result: EntryWorkflowSavedResult) => Promise<void>;
  markFailed: (entryId: string, status: EntryStatus, message: string) => Promise<void>;
  recordEvent: (entryId: string, event: EntryStatus | "temporary_audio_deleted") => Promise<void>;
};
