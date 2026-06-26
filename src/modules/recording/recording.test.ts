import { describe, expect, it, vi } from "vitest";
import { chooseRecordingMimeType, createBrowserRecorder } from "./recording";

class FakeEventRecorder {
  mimeType = "audio/webm";
  private listeners = new Map<string, Array<(event: BlobEvent) => void>>();

  start = vi.fn();
  stop = vi.fn(() => {
    this.emit("dataavailable", { data: new Blob(["voice"], { type: "audio/webm" }) } as BlobEvent);
    this.emit("stop", { data: new Blob() } as BlobEvent);
  });

  addEventListener(event: string, callback: (event: BlobEvent) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
  }

  private emit(event: string, payload: BlobEvent) {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }
}

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
    const stopTrack = vi.fn();
    const blob = new Blob(["voice"], { type: "audio/webm" });
    const recorder = createBrowserRecorder({
      getNow: (() => {
        let now = 1000;
        return () => {
          now += 1250;
          return now;
        };
      })(),
      requestStream: async () => ({ id: "stream", getTracks: () => [{ stop: stopTrack }] }),
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
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(result.mimeType).toBe("audio/webm");
    expect(result.sizeBytes).toBe(5);
    expect(result.durationMs).toBe(1250);
    expect(result.blob).toBe(blob);
  });

  it("collects dataavailable events when requestStop is not available", async () => {
    const eventRecorder = new FakeEventRecorder();
    const recorder = createBrowserRecorder({
      getNow: () => 1000,
      requestStream: async () => ({ id: "stream" }),
      createMediaRecorder: () => eventRecorder,
      chooseMimeType: () => "audio/webm",
    });

    await recorder.start();
    const result = await recorder.finish();

    expect(eventRecorder.start).toHaveBeenCalledOnce();
    expect(eventRecorder.stop).toHaveBeenCalledOnce();
    expect(result.blob.size).toBe(5);
    expect(result.mimeType).toBe("audio/webm");
  });

  it("stops tracks when a recording is discarded", async () => {
    const stopTrack = vi.fn();
    const recorder = createBrowserRecorder({
      requestStream: async () => ({ getTracks: () => [{ stop: stopTrack }] }),
      createMediaRecorder: () => ({
        mimeType: "audio/webm",
        start: vi.fn(),
        stop: vi.fn(),
        requestStop: async () => new Blob(),
      }),
      chooseMimeType: () => "audio/webm",
    });

    await recorder.start();
    await recorder.discard();

    expect(stopTrack).toHaveBeenCalledOnce();
    await expect(recorder.finish()).rejects.toMatchObject({ code: "not_recording" });
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
