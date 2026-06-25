import type { EntryStatus } from "../entryWorkflow/types";

export type ReflectionEntry = {
  id: string;
  userId: string;
  promptText: string;
  recordedAt: string;
  recordedDate: string;
  timezone: string;
  status: EntryStatus;
  transcript?: string;
  mirrorNote?: string;
  moodTags: string[];
  memoryQuote?: string;
  durationMs?: number;
  audioRetentionPolicy: "none" | "temporary" | "retained";
  audioStoragePath?: string | null;
  audioMimeType?: string | null;
  audioSizeBytes?: number | null;
  audioDeletedAt?: string | null;
  transcriptionProvider?: string;
  transcriptionModel?: string;
  reflectionProvider?: string;
  reflectionModel?: string;
  deletedAt?: string | null;
};
