export const HIGH_QUALITY_WEBM_BITS_PER_SECOND = 8_000_000;
export const MAX_WEBM_BITS_PER_SECOND = 24_000_000;
export const WEBM_RECORDING_FRAME_RATE = 24;
export const MIN_WEBM_RECORDING_DURATION_MS = 8_000;
export const MAX_WEBM_RECORDING_DURATION_MS = 60_000;

const WEBM_MIME_CANDIDATES = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];

type MimeTypeSupport = (mimeType: string) => boolean;
type CanvasDimensions = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getWebMVideoBitsPerSecond(dimensions?: CanvasDimensions) {
  if (!dimensions) {
    return HIGH_QUALITY_WEBM_BITS_PER_SECOND;
  }

  const pixels = Math.max(0, dimensions.width) * Math.max(0, dimensions.height);
  const scaledBitrate = Math.round(pixels * 2.8);
  return clamp(scaledBitrate, HIGH_QUALITY_WEBM_BITS_PER_SECOND, MAX_WEBM_BITS_PER_SECOND);
}

export function getWebMRecordingDurationMs(commitCount: number) {
  return clamp(
    Math.max(0, Math.round(commitCount)) * 140,
    MIN_WEBM_RECORDING_DURATION_MS,
    MAX_WEBM_RECORDING_DURATION_MS
  );
}

export function getPreferredWebMRecorderOptions(
  isTypeSupported?: MimeTypeSupport,
  dimensions?: CanvasDimensions
): MediaRecorderOptions {
  const mimeType = isTypeSupported
    ? (WEBM_MIME_CANDIDATES.find((candidate) => isTypeSupported(candidate)) ?? "video/webm")
    : "video/webm";

  return {
    mimeType,
    videoBitsPerSecond: getWebMVideoBitsPerSecond(dimensions)
  };
}

export function getWebMBlobType(options: MediaRecorderOptions) {
  return options.mimeType && options.mimeType.length > 0 ? options.mimeType : "video/webm";
}
