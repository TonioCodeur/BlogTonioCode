/**
 * MIME detection via magic bytes for cover-image uploads.
 *
 * Only three formats are accepted (spec §B.2.2):
 *   - JPEG  : FF D8 FF
 *   - PNG   : 89 50 4E 47 0D 0A 1A 0A
 *   - WebP  : 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  (RIFF…WEBP)
 *
 * All other formats (SVG, GIF, AVIF, HEIC, PDF, EXE …) are rejected with a
 * hard `null`. We never trust the client `Content-Type` header — we always
 * cross-check against the first bytes of the buffer.
 */

export type DetectedMime = "image/jpeg" | "image/png" | "image/webp";

export type DetectedExt = "jpg" | "png" | "webp";

const EXT_FOR_MIME: Record<DetectedMime, DetectedExt> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extForMime(mime: DetectedMime): DetectedExt {
  return EXT_FOR_MIME[mime];
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function eqAt(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Inspects the first bytes of `buffer` and returns the detected MIME, or
 * `null` if no allow-listed format matches.
 *
 * Note: we read only the first 12 bytes; the upload route ensures the buffer
 * is bounded to 1 MiB before this is called, but the function itself is safe
 * to call on arbitrarily sized inputs.
 */
export function detectImageMime(buffer: ArrayBuffer): DetectedMime | null {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12));

  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    eqAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }

  return null;
}
