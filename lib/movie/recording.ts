export const HIGH_QUALITY_WEBM_BITS_PER_SECOND = 8_000_000;

const WEBM_MIME_CANDIDATES = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"];

type MimeTypeSupport = (mimeType: string) => boolean;

export function getPreferredWebMRecorderOptions(isTypeSupported?: MimeTypeSupport): MediaRecorderOptions {
  const mimeType = isTypeSupported
    ? (WEBM_MIME_CANDIDATES.find((candidate) => isTypeSupported(candidate)) ?? "video/webm")
    : "video/webm";

  return {
    mimeType,
    videoBitsPerSecond: HIGH_QUALITY_WEBM_BITS_PER_SECOND
  };
}

export function getWebMBlobType(options: MediaRecorderOptions) {
  return options.mimeType && options.mimeType.length > 0 ? options.mimeType : "video/webm";
}
