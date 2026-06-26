import { BrowserRecorderPorts, RecordedAudio, Recorder, RecordingFailure } from "./types";

export const preferredAudioMimeTypes = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

export function chooseRecordingMimeType(
  candidates = preferredAudioMimeTypes,
  isTypeSupported: (mimeType: string) => boolean = (mimeType) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType),
): string | undefined {
  return candidates.find((candidate) => {
    try {
      return isTypeSupported(candidate);
    } catch {
      return false;
    }
  });
}

export function createBrowserRecorder(ports: BrowserRecorderPorts): Recorder {
  let stream: Awaited<ReturnType<BrowserRecorderPorts["requestStream"]>> | undefined;
  let recorder: ReturnType<BrowserRecorderPorts["createMediaRecorder"]> | undefined;
  let startedAt = 0;
  const getNow = ports.getNow ?? (() => Date.now());

  async function stopTracks() {
    stream?.getTracks?.().forEach((track) => track.stop());
    stream = undefined;
  }

  return {
    async start() {
      try {
        stream = await ports.requestStream();
      } catch (error) {
        throw new RecordingFailure(
          "microphone_unavailable",
          error instanceof Error ? error.message : "Microphone is unavailable.",
        );
      }

      const mimeType = ports.chooseMimeType();
      try {
        recorder = ports.createMediaRecorder(stream, { mimeType });
        startedAt = getNow();
        recorder.start();
      } catch (error) {
        await stopTracks();
        throw new RecordingFailure(
          "recorder_unavailable",
          error instanceof Error ? error.message : "Recording is unavailable in this browser.",
        );
      }
    },

    async finish(): Promise<RecordedAudio> {
      if (!recorder) {
        throw new RecordingFailure("not_recording", "No active recording exists.");
      }

      try {
        const blob = recorder.requestStop
          ? await stopRecorderWithRequest(recorder)
          : await stopRecorderWithEvents(recorder);

        const durationMs = Math.max(0, getNow() - startedAt);
        const mimeType = blob.type || recorder.mimeType || "application/octet-stream";
        return {
          blob,
          mimeType,
          sizeBytes: blob.size,
          durationMs,
        };
      } catch (error) {
        throw new RecordingFailure(
          "recording_failed",
          error instanceof Error ? error.message : "Recording could not be finished.",
        );
      } finally {
        recorder = undefined;
        await stopTracks();
      }
    },

    async discard() {
      try {
        recorder?.stop();
      } catch {
        // Some browsers throw when stopping an already-inactive recorder.
      } finally {
        recorder = undefined;
        await stopTracks();
      }
    },
  };
}


async function stopRecorderWithRequest(recorder: ReturnType<BrowserRecorderPorts["createMediaRecorder"]>) {
  recorder.stop();
  return recorder.requestStop!();
}

async function stopRecorderWithEvents(recorder: ReturnType<BrowserRecorderPorts["createMediaRecorder"]>) {
  const chunks: Blob[] = [];
  const stopped = new Promise<Blob>((resolve) => {
    recorder.addEventListener?.("dataavailable", (event) => chunks.push(event.data));
    recorder.addEventListener?.("stop", () => resolve(new Blob(chunks, { type: recorder.mimeType })));
  });
  recorder.stop();
  return stopped;
}
export async function createDefaultBrowserRecorder(): Promise<Recorder> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new RecordingFailure("recorder_unavailable", "This browser cannot record audio.");
  }

  return createBrowserRecorder({
    requestStream: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    createMediaRecorder: (stream, options) => new MediaRecorder(stream as MediaStream, options),
    chooseMimeType: () => chooseRecordingMimeType(),
  });
}

