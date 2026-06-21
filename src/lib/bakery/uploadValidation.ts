export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** 5 MB */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Max width or height in pixels */
export const MAX_IMAGE_DIMENSION = 4000;

const MAGIC: { mime: AllowedMimeType; match: (b: Uint8Array) => boolean }[] = [
  {
    mime: "image/jpeg",
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    match: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/webp",
    match: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
  {
    mime: "image/avif",
    match: (b) =>
      b[4] === 0x66 &&
      b[5] === 0x74 &&
      b[6] === 0x79 &&
      b[7] === 0x70 &&
      b[8] === 0x61 &&
      b[9] === 0x76 &&
      b[10] === 0x69 &&
      b[11] === 0x66,
  },
];

async function detectMime(file: File): Promise<AllowedMimeType | null> {
  const buf = await file.slice(0, 12).arrayBuffer();
  const b = new Uint8Array(buf);
  for (const { mime, match } of MAGIC) {
    if (match(b)) return mime;
  }
  return null;
}

async function getImageDimensions(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const result = { w: bmp.width, h: bmp.height };
    bmp.close();
    return result;
  } catch {
    return null;
  }
}

export type UploadError = "file_too_large" | "invalid_type" | "invalid_dimensions";

export type UploadValidationResult =
  | { ok: true; mime: AllowedMimeType; ext: string }
  | { ok: false; error: UploadError };

export async function validateUpload(file: File): Promise<UploadValidationResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "file_too_large" };
  }

  const mime = await detectMime(file);
  if (!mime) {
    return { ok: false, error: "invalid_type" };
  }

  const dims = await getImageDimensions(file);
  if (dims && (dims.w > MAX_IMAGE_DIMENSION || dims.h > MAX_IMAGE_DIMENSION)) {
    return { ok: false, error: "invalid_dimensions" };
  }

  return { ok: true, mime, ext: MIME_TO_EXT[mime] };
}

const BUCKET_MARKER = "/product-images/";

const SAFE_PATH_RE =
  /^(categories\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|avif)$/i;

export function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const idx = url.indexOf(BUCKET_MARKER);
  if (idx === -1) return null;
  const path = url.slice(idx + BUCKET_MARKER.length);
  if (!path || path.includes("..") || path.startsWith("/") || path.includes("\0")) return null;
  if (!SAFE_PATH_RE.test(path)) return null;
  return path;
}
