import { describe, expect, it } from "vitest";
import {
  getPreferredWebMRecorderOptions,
  getWebMBlobType,
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
});
