import type { ReflectionProvider } from "../reflection/reflection";
import type { TranscriptionProvider } from "../transcription/transcription";
import type { EntryWorkflowPorts } from "./types";

type SupabaseError = { message: string; code?: string };
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };

type InsertSelectSingleBuilder<T> = {
  select: (columns?: string) => { single: () => Promise<SupabaseResult<T>> };
};

type UpdateBuilder = {
  eq: (column: string, value: string) => Promise<SupabaseResult<null>>;
};

type InsertBuilder<T = unknown> = InsertSelectSingleBuilder<T> & Promise<SupabaseResult<null>>;

type SupabaseTable = {
  insert: <T = unknown>(value: unknown) => InsertBuilder<T>;
  update: (value: unknown) => UpdateBuilder;
};

type SupabaseStorageBucket = {
  upload: (path: string, body: Blob, options: { contentType: string; upsert: boolean }) => Promise<{ error: SupabaseError | null }>;
  remove: (paths: string[]) => Promise<{ error: SupabaseError | null }>;
};

export type SupabaseEntryWorkflowClient = {
  from: (table: "entries" | "temporary_audio_jobs" | "entry_events") => SupabaseTable;
  storage: {
    from: (bucket: "temporary-audio") => SupabaseStorageBucket;
  };
};

type SupabaseEntryWorkflowPortsInput = {
  client: SupabaseEntryWorkflowClient;
  transcriptionProvider: TranscriptionProvider;
  reflectionProvider: ReflectionProvider;
  now?: () => Date;
  onHandoffComplete?: () => void;
};

export function createSupabaseEntryWorkflowPorts({
  client,
  transcriptionProvider,
  reflectionProvider,
  now = () => new Date(),
  onHandoffComplete,
}: SupabaseEntryWorkflowPortsInput): EntryWorkflowPorts {
  const entryOwners = new Map<string, string>();

  return {
    async createEntry(input) {
      const result = await client
        .from("entries")
        .insert<{ id: string; user_id: string }>({
          user_id: input.userId,
          prompt_text: input.promptText,
          recorded_at: input.recordedAt,
          recorded_date: input.recordedAt.slice(0, 10),
          timezone: input.timezone,
          status: "draft_recording",
          duration_ms: input.durationMs,
          audio_retention_policy: "none",
        })
        .select("id,user_id")
        .single();

      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("Entry insert did not return a row.");
      entryOwners.set(result.data.id, result.data.user_id);
      return { id: result.data.id, userId: result.data.user_id };
    },

    async updateEntryStatus(entryId, status) {
      await updateEntry(client, entryId, { status, updated_at: now().toISOString() });
    },

    async uploadTemporaryAudio(entryId, input) {
      const storagePath = temporaryAudioPath(input.userId, entryId, input.mimeType);
      const expiresAt = new Date(now().getTime() + 10 * 60 * 1000).toISOString();

      const upload = await client.storage.from("temporary-audio").upload(storagePath, input.audio, {
        contentType: storageContentType(input.mimeType),
        upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);

      await updateEntry(client, entryId, {
        audio_retention_policy: "temporary",
        audio_storage_path: storagePath,
        audio_mime_type: input.mimeType,
        audio_size_bytes: input.audio.size,
        updated_at: now().toISOString(),
      });

      const inserted = await client
        .from("temporary_audio_jobs")
        .insert<{ id: string }>({
          entry_id: entryId,
          user_id: input.userId,
          status: "uploaded",
          storage_path: storagePath,
          mime_type: input.mimeType,
          size_bytes: input.audio.size,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (inserted.error) throw new Error(inserted.error.message);
      if (!inserted.data) throw new Error("Temporary audio job insert did not return a row.");
      onHandoffComplete?.();
      return { jobId: inserted.data.id, entryId, userId: input.userId, storagePath, expiresAt };
    },

    async transcribe(handoff, input) {
      await updateTemporaryAudioJob(client, handoff.jobId, { status: "transcribing", attempts: 1, updated_at: now().toISOString() });
      return transcriptionProvider.transcribe({
        entryId: handoff.entryId,
        audio: input.audio,
        mimeType: input.mimeType,
        durationMs: input.durationMs,
        promptText: input.promptText,
      });
    },

    async deleteTemporaryAudio(handoff) {
      const deletedAt = now().toISOString();
      const removal = await client.storage.from("temporary-audio").remove([handoff.storagePath]);
      if (removal.error) throw new Error(removal.error.message);

      await updateTemporaryAudioJob(client, handoff.jobId, { status: "deleted", deleted_at: deletedAt, updated_at: deletedAt });
      await updateEntry(client, handoff.entryId, {
        audio_retention_policy: "none",
        audio_storage_path: null,
        audio_deleted_at: deletedAt,
        updated_at: deletedAt,
      });
      return { deletedAt };
    },

    async reflect(input) {
      return reflectionProvider.reflect(input);
    },

    async saveEntryResult(entryId, result) {
      await updateEntry(client, entryId, {
        status: "ready",
        transcript: result.transcript,
        mirror_note: result.mirrorNote,
        mood_tags: result.moodTags,
        memory_quote: result.memoryQuote,
        audio_deleted_at: result.audioDeletedAt,
        transcription_provider: result.transcriptionProvider,
        transcription_model: result.transcriptionModel,
        reflection_provider: result.reflectionProvider,
        reflection_model: result.reflectionModel,
        updated_at: now().toISOString(),
      });
    },

    async markFailed(entryId, status, message) {
      await updateEntry(client, entryId, { status, error_message: message, updated_at: now().toISOString() });
    },

    async recordEvent(entryId, event) {
      const userId = entryOwners.get(entryId);
      if (!userId) throw new Error(`Could not record event for unknown entry ${entryId}.`);
      const inserted = await client.from("entry_events").insert({
        entry_id: entryId,
        user_id: userId,
        event,
        metadata: {},
        created_at: now().toISOString(),
      });
      const result = await inserted;
      if (result.error) throw new Error(result.error.message);
    },
  };
}

function temporaryAudioPath(userId: string, entryId: string, mimeType: string) {
  return `tmp-transcription/${userId}/${entryId}.${extensionForMimeType(mimeType)}`;
}

function storageContentType(mimeType: string) {
  if (mimeType.includes("mp4")) return "audio/mp4";
  if (mimeType.includes("ogg")) return "audio/ogg";
  if (mimeType.includes("mpeg")) return "audio/mpeg";
  if (mimeType.includes("wav")) return "audio/wav";
  if (mimeType.includes("webm")) return "audio/webm";
  return "application/octet-stream";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "audio";
}

async function updateEntry(client: SupabaseEntryWorkflowClient, entryId: string, value: Record<string, unknown>) {
  const result = await client.from("entries").update(value).eq("id", entryId);
  if (result.error) throw new Error(result.error.message);
}

async function updateTemporaryAudioJob(client: SupabaseEntryWorkflowClient, jobId: string, value: Record<string, unknown>) {
  const result = await client.from("temporary_audio_jobs").update(value).eq("id", jobId);
  if (result.error) throw new Error(result.error.message);
}
