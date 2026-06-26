export type AccountDataExport = {
  exportedAt: string;
  userId: string;
  entries: ExportedReflectionEntry[];
};

export type ExportedReflectionEntry = {
  id: string;
  promptText: string;
  recordedAt: string;
  recordedDate: string;
  timezone: string;
  status: string;
  transcript: string | null;
  mirrorNote: string | null;
  moodTags: string[];
  memoryQuote: string | null;
  durationMs: number | null;
  audioRetentionPolicy: string;
  audioMimeType: string | null;
  audioSizeBytes: number | null;
  audioDeletedAt: string | null;
  transcriptionProvider: string | null;
  transcriptionModel: string | null;
  reflectionProvider: string | null;
  reflectionModel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountDataGateway = {
  exportUserData: (userId: string) => Promise<AccountDataExport>;
  wipeUserData: (userId: string) => Promise<void>;
};

type SupabaseError = { message: string };
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };

type AccountDataQueryBuilder = {
  eq: (column: string, value: unknown) => AccountDataQueryBuilder;
  is: (column: string, value: unknown) => AccountDataQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => PromiseLike<SupabaseResult<unknown[]>>;
};

type AccountDataUpdateBuilder = {
  eq: (column: string, value: unknown) => PromiseLike<SupabaseResult<null>>;
};

type AccountDataDeleteBuilder = {
  eq: (column: string, value: unknown) => PromiseLike<SupabaseResult<null>>;
};

type AccountDataTable = {
  select: (columns: string) => AccountDataQueryBuilder;
  update: (value: Record<string, unknown>) => AccountDataUpdateBuilder;
  delete: () => AccountDataDeleteBuilder;
};

export type SupabaseAccountDataClient = {
  from: (table: "entries" | "temporary_audio_jobs" | "profiles") => AccountDataTable;
};

type EntryExportRow = {
  id: string;
  prompt_text: string;
  recorded_at: string;
  recorded_date: string;
  timezone: string;
  status: string;
  transcript: string | null;
  mirror_note: string | null;
  mood_tags: string[] | null;
  memory_quote: string | null;
  duration_ms: number | null;
  audio_retention_policy: string;
  audio_mime_type: string | null;
  audio_size_bytes: number | null;
  audio_deleted_at: string | null;
  transcription_provider: string | null;
  transcription_model: string | null;
  reflection_provider: string | null;
  reflection_model: string | null;
  created_at: string;
  updated_at: string;
};

const exportColumns = [
  "id",
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
  "audio_mime_type",
  "audio_size_bytes",
  "audio_deleted_at",
  "transcription_provider",
  "transcription_model",
  "reflection_provider",
  "reflection_model",
  "created_at",
  "updated_at",
].join(",");

export function createSupabaseAccountDataGateway(
  client: SupabaseAccountDataClient,
  now: () => Date = () => new Date(),
): AccountDataGateway {
  return {
    async exportUserData(userId) {
      const result = await client
        .from("entries")
        .select(exportColumns)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("recorded_at", { ascending: false });

      if (result.error) throw new Error(result.error.message);
      return {
        exportedAt: now().toISOString(),
        userId,
        entries: ((result.data ?? []) as EntryExportRow[]).map(rowToExportedEntry),
      };
    },

    async wipeUserData(userId) {
      const deletedAt = now().toISOString();
      await checked(
        client.from("entries").update({ status: "deleted", deleted_at: deletedAt, updated_at: deletedAt }).eq("user_id", userId),
      );
      await checked(
        client.from("temporary_audio_jobs").update({ status: "deleted", deleted_at: deletedAt, updated_at: deletedAt }).eq("user_id", userId),
      );
      await checked(client.from("profiles").delete().eq("user_id", userId));
    },
  };
}

function rowToExportedEntry(row: EntryExportRow): ExportedReflectionEntry {
  return {
    id: row.id,
    promptText: row.prompt_text,
    recordedAt: row.recorded_at,
    recordedDate: row.recorded_date,
    timezone: row.timezone,
    status: row.status,
    transcript: row.transcript,
    mirrorNote: row.mirror_note,
    moodTags: row.mood_tags ?? [],
    memoryQuote: row.memory_quote,
    durationMs: row.duration_ms,
    audioRetentionPolicy: row.audio_retention_policy,
    audioMimeType: row.audio_mime_type,
    audioSizeBytes: row.audio_size_bytes,
    audioDeletedAt: row.audio_deleted_at,
    transcriptionProvider: row.transcription_provider,
    transcriptionModel: row.transcription_model,
    reflectionProvider: row.reflection_provider,
    reflectionModel: row.reflection_model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function checked(resultPromise: PromiseLike<SupabaseResult<null>>) {
  const result = await resultPromise;
  if (result.error) throw new Error(result.error.message);
}