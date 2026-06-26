import type { EntryWorkflowInput, EntryWorkflowPorts, EntryWorkflowResult, EntryStatus } from "./types";

export class TemporaryAudioExpiredError extends Error {
  constructor(message = "Temporary audio expired or was deleted.") {
    super(message);
    this.name = "TemporaryAudioExpiredError";
  }
}

export async function runEntryWorkflow(
  input: EntryWorkflowInput,
  ports: EntryWorkflowPorts,
): Promise<EntryWorkflowResult> {
  const entry = await ports.createEntry(input);
  await transition(entry.id, "recorded_locally", ports);

  let handoff;
  try {
    await transition(entry.id, "uploading_for_transcription", ports);
    handoff = await ports.uploadTemporaryAudio(entry.id, input);
    await transition(entry.id, "transcribing", ports);
  } catch (error) {
    return fail(entry.id, "upload_failed", readableError(error), ports);
  }

  let transcription;
  let deletion;
  try {
    transcription = await ports.transcribe(handoff, input);
    deletion = await ports.deleteTemporaryAudio(handoff);
    await ports.recordEvent(entry.id, "temporary_audio_deleted");
    await transition(entry.id, "transcribed", ports);
  } catch (error) {
    const expired = isTemporaryAudioExpired(error);
    const status: EntryStatus = expired
      ? "transcription_failed_expired"
      : "transcription_failed_retryable";
    const message = expired
      ? "Echo couldn't finish this one, and your original audio was not kept. You'll need to record it again."
      : "Echo couldn't finish listening back. Try again?";
    return fail(entry.id, status, message, ports);
  }

  try {
    await transition(entry.id, "reflecting", ports);
    const reflection = await ports.reflect({
      transcript: transcription.text,
      promptText: input.promptText,
    });
    await ports.saveEntryResult(entry.id, {
      transcript: transcription.text,
      transcriptionProvider: transcription.provider,
      transcriptionModel: transcription.model,
      mirrorNote: reflection.mirrorNote,
      moodTags: reflection.moodTags,
      memoryQuote: reflection.memoryQuote,
      reflectionProvider: reflection.provider,
      reflectionModel: reflection.model,
      audioDeletedAt: deletion.deletedAt,
    });
    await transition(entry.id, "ready", ports);
    return {
      status: "ready",
      entryId: entry.id,
      transcript: transcription.text,
      mirrorNote: reflection.mirrorNote,
      moodTags: reflection.moodTags,
      memoryQuote: reflection.memoryQuote,
      temporaryAudioDeleted: true,
      temporaryAudioDeletedAt: deletion.deletedAt,
    };
  } catch (error) {
    return fail(entry.id, "reflection_failed", readableError(error), ports);
  }
}

async function transition(entryId: string, status: EntryStatus, ports: EntryWorkflowPorts) {
  await ports.updateEntryStatus(entryId, status);
  await ports.recordEvent(entryId, status);
}

async function fail(
  entryId: string,
  status: EntryStatus,
  message: string,
  ports: EntryWorkflowPorts,
): Promise<EntryWorkflowResult> {
  await ports.markFailed(entryId, status, message);
  await ports.recordEvent(entryId, status);
  return {
    status,
    entryId,
    userMessage: message,
  };
}

function isTemporaryAudioExpired(error: unknown) {
  return error instanceof TemporaryAudioExpiredError || (error instanceof Error && error.name === "TemporaryAudioExpiredError");
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
