import type { ReflectionEntry } from "./types";

type SupabaseError = { message: string };
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };

type EntryRow = {
  id: string;
  user_id: string;
  prompt_text: string;
  recorded_at: string;
  recorded_date: string;
  timezone: string;
  status: ReflectionEntry["status"];
  transcript: string | null;
  mirror_note: string | null;
  mood_tags: string[] | null;
  memory_quote: string | null;
  duration_ms: number | null;
  audio_retention_policy: ReflectionEntry["audioRetentionPolicy"];
  audio_storage_path: string | null;
  audio_mime_type: string | null;
  audio_size_bytes: number | null;
  audio_deleted_at: string | null;
  transcription_provider: string | null;
  transcription_model: string | null;
  reflection_provider: string | null;
  reflection_model: string | null;
  deleted_at: string | null;
};

type EntryQueryBuilder = {
  eq: (column: string, value: unknown) => EntryQueryBuilder;
  is: (column: string, value: unknown) => EntryQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => PromiseLike<SupabaseResult<unknown[]>>;
};

type EntryUpdateBuilder = {
  eq: (column: string, value: unknown) => EntryUpdateBuilder;
  is: (column: string, value: unknown) => PromiseLike<SupabaseResult<null>>;
};

type EntriesTable = {
  select: (columns: string) => EntryQueryBuilder;
  update: (value: Record<string, unknown>) => EntryUpdateBuilder;
};

export type SupabaseEntryHistoryClient = {
  from: (table: "entries") => EntriesTable;
};

export type EntryHistoryGateway = {
  listEntries: (userId: string) => Promise<ReflectionEntry[]>;
  deleteEntry: (userId: string, entryId: string) => Promise<void>;
};

const entryColumns = [
  "id",
  "user_id",
  "prompt_text",
  "recorded_at",
  "recorded_date",
  "timezone",
  "status",
  "transcript",
  "mirror_note",
  "mood_tags",
  "memory_quote",
  "duration_ms",
  "audio_retention_policy",
  "audio_storage_path",
  "audio_mime_type",
  "audio_size_bytes",
  "audio_deleted_at",
  "transcription_provider",
  "transcription_model",
  "reflection_provider",
  "reflection_model",
  "deleted_at",
].join(",");

export function createSupabaseEntryHistoryGateway(
  client: SupabaseEntryHistoryClient,
  now: () => Date = () => new Date(),
): EntryHistoryGateway {
  return {
    async listEntries(userId) {
      const result = await client
        .from("entries")
        .select(entryColumns)
        .eq("user_id", userId)
        .eq("status", "ready")
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false });

      if (result.error) throw new Error(result.error.message);
      return ((result.data ?? []) as EntryRow[]).map(rowToEntry);
    },

    async deleteEntry(userId, entryId) {
      const deletedAt = now().toISOString();
      const result = await client
        .from("entries")
        .update({ status: "deleted", deleted_at: deletedAt, updated_at: deletedAt })
        .eq("id", entryId)
        .eq("user_id", userId)
        .is("deleted_at", null);

      if (result.error) throw new Error(result.error.message);
    },
  };
}

function rowToEntry(row: EntryRow): ReflectionEntry {
  return {
    id: row.id,
    userId: row.user_id,
    promptText: row.prompt_text,
    recordedAt: row.recorded_at,
    recordedDate: row.recorded_date,
    timezone: row.timezone,
    status: row.status,
    transcript: row.transcript ?? undefined,
    mirrorNote: row.mirror_note ?? undefined,
    moodTags: row.mood_tags ?? [],
    memoryQuote: row.memory_quote ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    audioRetentionPolicy: row.audio_retention_policy,
    audioStoragePath: row.audio_storage_path,
    audioMimeType: row.audio_mime_type,
    audioSizeBytes: row.audio_size_bytes,
    audioDeletedAt: row.audio_deleted_at,
    transcriptionProvider: row.transcription_provider ?? undefined,
    transcriptionModel: row.transcription_model ?? undefined,
    reflectionProvider: row.reflection_provider ?? undefined,
    reflectionModel: row.reflection_model ?? undefined,
    deletedAt: row.deleted_at,
  };
}