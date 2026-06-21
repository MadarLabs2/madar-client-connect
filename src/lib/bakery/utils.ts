import type { Lang } from "@/lib/i18n";

export function pickName(
  row: Record<string, unknown> | null | undefined,
  lang: Lang = "he",
  fallback = "—",
): string {
  if (!row) return fallback;
  const byLang =
    lang === "en"
      ? (row.name_en as string | undefined)
      : lang === "ar"
        ? (row.name_ar as string | undefined)
        : (row.name_he as string | undefined) || (row.name as string | undefined);
  const value =
    byLang ||
    (row.name_he as string | undefined) ||
    (row.name as string | undefined) ||
    (row.name_en as string | undefined) ||
    (row.name_ar as string | undefined) ||
    (row.title as string | undefined);
  return value?.trim() || fallback;
}

export function resolveImage(
  rowOrUrl: string | Record<string, unknown> | null | undefined,
): string | null {
  if (typeof rowOrUrl === "string") {
    const trimmed = rowOrUrl.trim();
    return trimmed || null;
  }
  const row = rowOrUrl;
  if (!row) return null;
  const fromString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const product =
    row.product && typeof row.product === "object" && !Array.isArray(row.product)
      ? (row.product as Record<string, unknown>)
      : null;
  return (
    fromString(row.image_url) ||
    fromString(row.image) ||
    fromString(row.thumbnail_url) ||
    fromString(row.photo_url) ||
    fromString(product?.image_url) ||
    null
  );
}

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}
