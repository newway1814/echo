import { describe, expect, it, vi } from "vitest";
import { chooseRecordingMimeType, createBrowserRecorder } from "./recording";

describe("recording module", () => {
  it("chooses the first MIME type supported by the browser", () => {
    const mimeType = chooseRecordingMimeType(
      ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"],
      (candidate) => candidate === "audio/webm;codecs=opus",
    );

    expect(mimeType).toBe("audio/webm;codecs=opus");
  });

  it("returns no MIME type when the browser reports no candidate support", () => {
    const mimeType = chooseRecordingMimeType(["audio/mp4"], () => false);

    expect(mimeType).toBeUndefined();
  });

  it("records through the public recorder interface and returns blob metadata", async () => {
    const started: string[] = [];
    const stopped: string[] = [];
    const blob = new Blob(["voice"], { type: "audio/webm" });
    const recorder = createBrowserRecorder({
      getNow: (() => {
        let now = 1000;
        return () => {
          now += 1250;
          return now;
        };
      })(),
      requestStream: async () => ({ id: "stream" }),
      createMediaRecorder: (_stream, options) => ({
        mimeType: options.mimeType ?? "audio/webm",
        start: () => started.push("start"),
        stop: () => stopped.push("stop"),
        requestStop: async () => blob,
      }),
      chooseMimeType: () => "audio/webm",
    });

    await recorder.start();
    const result = await recorder.finish();

    expect(started).toEqual(["start"]);
    expect(stopped).toEqual(["stop"]);
    expect(result.mimeType).toBe("audio/webm");
    expect(result.sizeBytes).toBe(5);
    expect(result.durationMs).toBe(1250);
    expect(result.blob).toBe(blob);
  });

  it("surfaces microphone permission failures as recording failures", async () => {
    const recorder = createBrowserRecorder({
      requestStream: async () => {
        throw new Error("permission denied");
      },
      createMediaRecorder: vi.fn(),
      chooseMimeType: () => "audio/mp4",
    });

    await expect(recorder.start()).rejects.toMatchObject({
      code: "microphone_unavailable",
    });
  });
});
