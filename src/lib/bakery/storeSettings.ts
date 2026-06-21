import type { useBakeryDb } from "@/lib/bakery/db";

type BakeryDb = ReturnType<typeof useBakeryDb>;

export type StoreSettings = {
  id: string;
  homepage_category_order: string[];
};

export async function fetchStoreSettings(db: BakeryDb): Promise<StoreSettings | null> {
  const { data, error } = await db.from("store_settings").select("*").limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id ?? ""),
    homepage_category_order: Array.isArray(row.homepage_category_order)
      ? row.homepage_category_order.map((value) => String(value))
      : [],
  };
}

export async function saveHomepageCategoryOrder(db: BakeryDb, order: string[], currentId?: string) {
  if (currentId) {
    const { error } = await db
      .from("store_settings")
      .update({
        homepage_category_order: order,
      })
      .eq("id", currentId);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("store_settings").insert({
    homepage_category_order: order,
  });
  if (error) throw error;
}

export async function fetchHomepageCategoryOrder(db: BakeryDb): Promise<string[] | null> {
  const settings = await fetchStoreSettings(db);
  const order = settings?.homepage_category_order;
  if (!order?.length) return null;
  return order;
}

export async function updateHomepageCategoryOrder(
  db: BakeryDb,
  categoryIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const current = await fetchStoreSettings(db);
    await saveHomepageCategoryOrder(db, categoryIds, current?.id);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
