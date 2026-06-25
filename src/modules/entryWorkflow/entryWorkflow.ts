import type { EntryWorkflowInput, EntryWorkflowPorts, EntryWorkflowResult, EntryStatus } from "./types";

export async function runEntryWorkflow(
  input: EntryWorkflowInput,
  ports: EntryWorkflowPorts,
): Promise<EntryWorkflowResult> {
  const entry = await ports.createEntry(input);
  await ports.recordEvent(entry.id, "recorded_locally");

  let handoff;
  try {
    await ports.recordEvent(entry.id, "uploading_for_transcription");
    handoff = await ports.uploadTemporaryAudio(entry.id, input);
    await ports.recordEvent(entry.id, "transcribing");
  } catch (error) {
    return fail(entry.id, "upload_failed", readableError(error), ports);
  }

  let transcription;
  try {
    transcription = await ports.transcribe(handoff, input);
    await ports.deleteTemporaryAudio(handoff);
    await ports.recordEvent(entry.id, "temporary_audio_deleted");
    await ports.recordEvent(entry.id, "transcribed");
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
    await ports.recordEvent(entry.id, "reflecting");
    const reflection = await ports.reflect({
      transcript: transcription.text,
      promptText: input.promptText,
    });
    await ports.saveEntryResult(entry.id, {
      ...transcription,
      ...reflection,
    });
    await ports.recordEvent(entry.id, "ready");
    return {
      status: "ready",
      entryId: entry.id,
      transcript: transcription.text,
      mirrorNote: reflection.mirrorNote,
      moodTags: reflection.moodTags,
      memoryQuote: reflection.memoryQuote,
      temporaryAudioDeleted: true,
    };
  } catch (error) {
    return fail(entry.id, "reflection_failed", readableError(error), ports);
  }
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
  return error instanceof Error && error.name === "TemporaryAudioExpiredError";
}

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
