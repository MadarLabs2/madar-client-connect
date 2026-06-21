import { useBakeryDb } from "@/lib/bakery/db";

type BakeryDb = ReturnType<typeof useBakeryDb>;

export async function safeDeleteStorageFiles(
  db: BakeryDb,
  urls: string[],
  opts: { excludeProductId?: string; excludeCategoryId?: string } = {},
): Promise<void> {
  if (urls.length === 0) return;
  await db.safeDeleteStorageFiles(urls, opts);
}
