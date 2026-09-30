/**
 * Validation of image BYTES — the uploaded source photo and the generated
 * result. Pure functions over bytes: magic numbers, size and (for PNG/JPEG)
 * dimensions. Nothing here inspects or scores a face; a generated image is
 * never analysed and never becomes evidence.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp";

export const MAX_SOURCE_PHOTO_BYTES = 10_000_000;
export const MAX_GENERATED_IMAGE_BYTES = 12_000_000;
const MIN_IMAGE_BYTES = 2_000;
const MIN_SIDE = 256;
const MAX_SIDE = 8_000;

export function detectImageMime(b: Uint8Array): ImageMime | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** Width/height for PNG and JPEG; null when unknown (e.g. WebP). */
export function imageDimensions(b: Uint8Array): { width: number; height: number } | null {
  const mime = detectImageMime(b);
  if (mime === "image/png" && b.length >= 24) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + len;
    }
  }
  return null;
}

export type ValidatedImage = { ok: true; mimeType: ImageMime; bytes: Uint8Array } | { ok: false; reason: string };

/**
 * A file part from multipart parsing. `instanceof File` is not reliable here:
 * the parser's File and this module's File can be different objects, so a
 * real upload would be rejected and the illustration would never start.
 */
export function isUploadedPhoto(value: unknown): value is Blob & { name?: string } {
  if (!value || typeof value !== "object") return false;
  const photo = value as Blob;
  return typeof photo.arrayBuffer === "function" && typeof photo.size === "number" && typeof photo.type === "string" && photo.size >= 0;
}

/** Browsers sometimes omit a type, or send the non-standard image/jpg label, for a real JPEG. */
function declaredMimeMatches(declaredMime: string, detected: ImageMime): boolean {
  const declared = declaredMime.trim().toLowerCase();
  if (declared === detected) return true;
  if (declared === "") return true;
  return detected === "image/jpeg" && (declared === "image/jpg" || declared === "image/pjpeg");
}

/** The uploaded source photo: a real PNG/JPEG/WebP of sensible size whose bytes match what it claims to be. */
export function validateSourcePhoto(bytes: Uint8Array, declaredMime: string): ValidatedImage {
  if (bytes.length === 0 || bytes.length > MAX_SOURCE_PHOTO_BYTES) return { ok: false, reason: "photo size" };
  const mime = detectImageMime(bytes);
  if (!mime) return { ok: false, reason: "photo is not a PNG, JPEG or WebP image" };
  if (!declaredMimeMatches(declaredMime, mime)) return { ok: false, reason: "photo type does not match its content" };
  const d = imageDimensions(bytes);
  if (d && (Math.min(d.width, d.height) < MIN_SIDE || Math.max(d.width, d.height) > MAX_SIDE)) return { ok: false, reason: "photo dimensions" };
  return { ok: true, mimeType: mime, bytes };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** A generated image: valid base64, a real image, plausible size and dimensions, and not simply the source returned unchanged. */
export function validateGeneratedImage(base64: unknown, sourceBytes?: Uint8Array): (ValidatedImage & { ok: true; base64: string }) | { ok: false; reason: string } {
  if (typeof base64 !== "string" || base64.length < 100 || !BASE64.test(base64)) return { ok: false, reason: "not base64 image data" };
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  if (bytes.length < MIN_IMAGE_BYTES || bytes.length > MAX_GENERATED_IMAGE_BYTES) return { ok: false, reason: "image size" };
  const mime = detectImageMime(bytes);
  if (!mime) return { ok: false, reason: "not a PNG, JPEG or WebP image" };
  const d = imageDimensions(bytes);
  if (d && (Math.min(d.width, d.height) < MIN_SIDE || Math.max(d.width, d.height) > MAX_SIDE)) return { ok: false, reason: "image dimensions" };
  if (sourceBytes && bytes.length === sourceBytes.length && bytes.every((v, i) => v === sourceBytes[i])) return { ok: false, reason: "image is identical to the source" };
  return { ok: true, mimeType: mime, bytes, base64 };
}
