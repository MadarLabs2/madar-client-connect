import type { Lang } from "@/lib/i18n";
import type { useBakeryDb } from "@/lib/bakery/db";
import { pickName } from "@/lib/bakery/utils";

type BakeryDb = ReturnType<typeof useBakeryDb>;

export type DeliveryPlaceRow = {
  id: string;
  name_he: string;
  name_ar: string;
  name_en: string;
  price: number;
  is_active: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryPlaceInput = {
  nameHe: string;
  nameAr: string;
  nameEn: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
  description?: string | null;
};

function normalizePlaceNames(input: Pick<DeliveryPlaceInput, "nameHe" | "nameAr" | "nameEn">): {
  nameHe: string;
  nameAr: string;
  nameEn: string;
} | null {
  const nameHe = input.nameHe.trim();
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  if (!nameHe && !nameAr && !nameEn) return null;

  const fallback = nameHe || nameEn || nameAr;
  return {
    nameHe: nameHe || fallback,
    nameAr: nameAr || fallback,
    nameEn: nameEn || fallback,
  };
}

const normalizeRow = (row: Record<string, unknown>): DeliveryPlaceRow => ({
  id: String(row.id ?? ""),
  name_he: String(row.name_he ?? ""),
  name_ar: String(row.name_ar ?? ""),
  name_en: String(row.name_en ?? ""),
  price: Number(row.price ?? 0),
  is_active: row.is_active !== false,
  sort_order: Number(row.sort_order ?? 0),
  description: typeof row.description === "string" ? row.description : null,
  created_at: String(row.created_at ?? ""),
  updated_at: String(row.updated_at ?? ""),
});

export function pickDeliveryPlaceName(
  place: Pick<DeliveryPlaceRow, "name_he" | "name_ar" | "name_en">,
  lang: Lang,
): string {
  return pickName(
    { name_he: place.name_he, name_ar: place.name_ar, name_en: place.name_en },
    lang,
  );
}

export function isValidDeliveryPlacePrice(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0;
}

export function parseDeliveryPlacePrice(value: string): number | null {
  if (!isValidDeliveryPlacePrice(value)) return null;
  return Number.parseFloat(value.trim());
}

export function validateDeliveryPlaceInput(input: DeliveryPlaceInput): string | null {
  if (!normalizePlaceNames(input)) return "NAME_REQUIRED";
  if (!Number.isFinite(input.price) || input.price < 0) return "PRICE_INVALID";
  return null;
}

export function calculateDeliveryFeeFromSelectedPlace(
  method: "pickup" | "delivery",
  place: DeliveryPlaceRow | null | undefined,
): number {
  if (method !== "delivery") return 0;
  if (!place) return 0;
  return Number(place.price) || 0;
}

export async function fetchActiveDeliveryPlaces(
  db: BakeryDb,
): Promise<{ ok: true; rows: DeliveryPlaceRow[] } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("delivery_places")
    .select("id, name_he, name_ar, name_en, price, is_active, sort_order, description, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .limit(300);

  if (error) {
    if (error.message.includes("delivery_places")) {
      return { ok: true, rows: [] };
    }
    return { ok: false, message: error.message };
  }

  const rows = (data ?? [])
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row) => row.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en));

  return { ok: true, rows };
}

export async function fetchAdminDeliveryPlaces(
  db: BakeryDb,
): Promise<{ ok: true; rows: DeliveryPlaceRow[] } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("delivery_places")
    .select("id, name_he, name_ar, name_en, price, is_active, sort_order, description, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .limit(300);

  if (error) return { ok: false, message: error.message };

  const rows = (data ?? [])
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en));

  return { ok: true, rows };
}

export async function createDeliveryPlace(
  db: BakeryDb,
  input: DeliveryPlaceInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = validateDeliveryPlaceInput(input);
  if (validation) return { ok: false, message: validation };

  const names = normalizePlaceNames(input);
  if (!names) return { ok: false, message: "NAME_REQUIRED" };

  const { error } = await db.from("delivery_places").insert({
    name_he: names.nameHe,
    name_ar: names.nameAr,
    name_en: names.nameEn,
    price: input.price,
    is_active: input.isActive,
    sort_order: input.sortOrder,
    description: input.description?.trim() || null,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateDeliveryPlace(
  db: BakeryDb,
  id: string,
  input: DeliveryPlaceInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = validateDeliveryPlaceInput(input);
  if (validation) return { ok: false, message: validation };

  const names = normalizePlaceNames(input);
  if (!names) return { ok: false, message: "NAME_REQUIRED" };

  const { error } = await db
    .from("delivery_places")
    .update({
      name_he: names.nameHe,
      name_ar: names.nameAr,
      name_en: names.nameEn,
      price: input.price,
      is_active: input.isActive,
      sort_order: input.sortOrder,
      description: input.description?.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteDeliveryPlace(
  db: BakeryDb,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await db.from("delivery_places").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateDeliveryPlaceStatus(
  db: BakeryDb,
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await db.from("delivery_places").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export function minDeliveryPlacePrice(places: DeliveryPlaceRow[]): number | null {
  if (places.length === 0) return null;
  return Math.min(...places.map((p) => Number(p.price)));
}
