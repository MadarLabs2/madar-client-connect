import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, LayoutGrid, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import { pickName } from "@/lib/bakery/utils";
import {
  fetchHomepageCategoryOrder,
  updateHomepageCategoryOrder,
} from "@/lib/bakery/storeSettings";
import { AdminDeliveryPlacesSection } from "@/components/manage/bakery/AdminDeliveryPlacesSection";

type BakerySettingsPageProps = { projectId: string };

type CategoryRow = {
  id: string;
  name: string;
  name_en?: string | null;
  name_he?: string | null;
  name_ar?: string | null;
};

export function BakerySettingsPage({ projectId }: BakerySettingsPageProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [productCountByCategory, setProductCountByCategory] = useState<Map<string, number>>(
    new Map(),
  );
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionsSaving, setSectionsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [catRes, prodRes, savedOrder] = await Promise.all([
          db.from("categories").select("*").order("name", { ascending: true }).limit(500),
          db.from("products").select("id, category_id").eq("is_available", true).limit(500),
          fetchHomepageCategoryOrder(db),
        ]);

        if (cancelled) return;

        const cats = (catRes.data ?? []) as CategoryRow[];
        const counts = new Map<string, number>();
        for (const p of prodRes.data ?? []) {
          const row = p as { category_id?: string | null };
          if (!row.category_id) continue;
          counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
        }

        setCategories(cats);
        setProductCountByCategory(counts);

        const withProducts = cats.filter((c) => (counts.get(c.id) ?? 0) > 0);
        const locale = lang === "en" ? "en" : lang === "ar" ? "ar" : "he";
        if (savedOrder?.length) {
          const rank = new Map(savedOrder.map((id, i) => [id, i]));
          const ordered = withProducts
            .filter((c) => rank.has(c.id))
            .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
          const appended = withProducts
            .filter((c) => !rank.has(c.id))
            .sort((a, b) => pickName(a, lang).localeCompare(pickName(b, lang), locale));
          setSectionOrder([...ordered, ...appended].map((c) => c.id));
        } else {
          setSectionOrder(
            [...withProducts]
              .sort((a, b) => pickName(a, lang).localeCompare(pickName(b, lang), locale))
              .map((c) => c.id),
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setSectionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, lang]);

  const sectionCategories = useMemo(
    () =>
      sectionOrder
        .map((id) => categories.find((c) => c.id === id))
        .filter((c): c is CategoryRow => !!c),
    [sectionOrder, categories],
  );

  const moveSection = (index: number, direction: "up" | "down") => {
    const next = [...sectionOrder];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSectionOrder(next);
  };

  const saveSections = async () => {
    setSectionsSaving(true);
    const result = await updateHomepageCategoryOrder(db, sectionOrder);
    setSectionsSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t("adminHomepageSectionsSaved"));
  };

  return (
    <div className="admin-page-enter mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
      <div className="admin-header-enter">
        <h1 className="font-display text-3xl font-bold text-[#1B4332]">{t("adminSettingsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminSettingsSubtitle")}</p>
      </div>

      <AdminDeliveryPlacesSection projectId={projectId} />

      <section
        className="admin-section-enter overflow-hidden rounded-2xl border border-[#1B4332]/10 bg-white shadow-sm"
        style={{ animationDelay: "180ms" }}
      >
        <div className="border-b border-[#1B4332]/10 bg-gradient-to-br from-[#1B4332] to-[#2d5a45] px-5 py-5 text-[#faf8f4] sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <LayoutGrid className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">{t("adminHomepageSectionsTitle")}</h2>
              <p className="mt-0.5 text-sm text-[#faf8f4]/85">{t("adminHomepageSectionsDesc")}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {sectionsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("loading")}
            </div>
          ) : sectionCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("adminHomepageSectionsEmpty")}</p>
          ) : (
            <>
              <ul className="space-y-2">
                {sectionCategories.map((category, index) => {
                  const count = productCountByCategory.get(category.id) ?? 0;
                  return (
                    <li
                      key={category.id}
                      className="flex items-center gap-3 rounded-xl border border-[#1B4332]/10 bg-[#faf8f4]/40 px-4 py-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1B4332]/10 text-sm font-semibold tabular-nums text-[#1B4332]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#1B4332]">
                          {pickName(category, lang)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {count} {t("adminHomepageSectionsProductCount")}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          disabled={index === 0}
                          aria-label={t("adminHomepageSectionsMoveUp")}
                          onClick={() => moveSection(index, "up")}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9"
                          disabled={index === sectionCategories.length - 1}
                          aria-label={t("adminHomepageSectionsMoveDown")}
                          onClick={() => moveSection(index, "down")}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <Button
                type="button"
                className={cn("h-11 bg-[#1B4332] px-6 hover:bg-[#1B4332]/90")}
                onClick={() => void saveSections()}
                disabled={sectionsSaving}
              >
                {sectionsSaving ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("adminHomepageSectionsSaving")}
                  </>
                ) : (
                  t("adminHomepageSectionsSave")
                )}
              </Button>
            </>
          )}
        </div>
      </section>

      <section
        className="admin-section-enter rounded-2xl border border-dashed border-[#1B4332]/20 bg-[#faf8f4]/60 p-5"
        style={{ animationDelay: "220ms" }}
      >
        <div className="flex gap-3">
          <Settings className="mt-0.5 h-5 w-5 shrink-0 text-[#1B4332]" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("adminDeliverySettingsNote")}
          </p>
        </div>
      </section>
    </div>
  );
}
