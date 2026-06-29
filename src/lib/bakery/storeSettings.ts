import type { useBakeryDb } from "@/lib/bakery/db";

type BakeryDb = ReturnType<typeof useBakeryDb>;

export const HOMEPAGE_CATEGORY_ORDER_KEY = "homepage_category_order";

export async function fetchHomepageCategoryOrder(db: BakeryDb): Promise<string[] | null> {
  const { data, error } = await db
    .from("store_settings")
    .select("setting_value")
    .eq("setting_key", HOMEPAGE_CATEGORY_ORDER_KEY)
    .limit(1);

  if (error) {
    console.warn("[store_settings] homepage_category_order:", error.message);
    return null;
  }

  const raw = (data ?? [])[0] as { setting_value?: string } | undefined;
  const value = raw?.setting_value;
  if (!value?.trim()) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return null;
  }
}

async function saveHomepageCategoryOrder(db: BakeryDb, order: string[]) {
  const payload = {
    setting_key: HOMEPAGE_CATEGORY_ORDER_KEY,
    setting_value: JSON.stringify(order),
    description: "Homepage category section display order (JSON array of category UUIDs)",
  };

  const { data, error: fetchError } = await db
    .from("store_settings")
    .select("id")
    .eq("setting_key", HOMEPAGE_CATEGORY_ORDER_KEY)
    .limit(1);

  if (fetchError) throw fetchError;

  const existing = (data ?? [])[0] as { id?: string } | undefined;
  if (existing?.id) {
    const { error } = await db
      .from("store_settings")
      .update({
        setting_value: payload.setting_value,
        description: payload.description,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await db.from("store_settings").insert(payload);
  if (error) throw error;
}

export async function updateHomepageCategoryOrder(
  db: BakeryDb,
  categoryIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await saveHomepageCategoryOrder(db, categoryIds);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
