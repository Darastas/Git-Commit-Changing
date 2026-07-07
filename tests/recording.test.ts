import { describe, expect, it } from "vitest";
import {
  getWebMRecordingDurationMs,
  getPreferredWebMRecorderOptions,
  getWebMBlobType,
  getWebMVideoBitsPerSecond,
  HIGH_QUALITY_WEBM_BITS_PER_SECOND
} from "@/lib/movie/recording";

describe("WebM recording options", () => {
  it("prefers VP8 WebM with a high video bitrate when supported", () => {
    const options = getPreferredWebMRecorderOptions((mimeType) => mimeType === "video/webm;codecs=vp8");

    expect(options).toEqual({
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: HIGH_QUALITY_WEBM_BITS_PER_SECOND
    });
  });

  it("falls back through supported WebM codecs", () => {
    const options = getPreferredWebMRecorderOptions((mimeType) => mimeType === "video/webm;codecs=vp9");

    expect(options.mimeType).toBe("video/webm;codecs=vp9");
    expect(options.videoBitsPerSecond).toBe(8_000_000);
  });

  it("uses plain WebM when codec support is unavailable", () => {
    const options = getPreferredWebMRecorderOptions();

    expect(getWebMBlobType(options)).toBe("video/webm");
    expect(options.videoBitsPerSecond).toBe(8_000_000);
  });

  it("raises the bitrate for larger HD canvases without exceeding the export cap", () => {
    expect(getWebMVideoBitsPerSecond({ width: 1280, height: 720 })).toBe(HIGH_QUALITY_WEBM_BITS_PER_SECOND);
    expect(getWebMVideoBitsPerSecond({ width: 2816, height: 1584 })).toBeGreaterThan(HIGH_QUALITY_WEBM_BITS_PER_SECOND);
    expect(getWebMVideoBitsPerSecond({ width: 4096, height: 2304 })).toBe(24_000_000);
  });

  it("uses a bounded recording duration so large histories export as concise videos", () => {
    expect(getWebMRecordingDurationMs(2)).toBe(8_000);
    expect(getWebMRecordingDurationMs(100)).toBe(14_000);
    expect(getWebMRecordingDurationMs(900)).toBe(60_000);
  });
});
