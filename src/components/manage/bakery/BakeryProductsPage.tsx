import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Croissant,
  Pencil,
  Plus,
  Save,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BakeryProductPriceRow } from "@/components/manage/bakery/BakeryProductPriceRow";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import { safeDeleteStorageFiles } from "@/lib/bakery/storageDelete";
import { validateUpload } from "@/lib/bakery/uploadValidation";
import { pickName, resolveImage } from "@/lib/bakery/utils";
import { cn } from "@/lib/utils";

type BakeryProductsPageProps = { projectId: string };

const CREAM = "#F8F4E9";

const empty = {
  category_id: "",
  name_en: "",
  name_he: "",
  name_ar: "",
  description_en: "",
  description_he: "",
  description_ar: "",
  ingredients_en: "",
  ingredients_he: "",
  ingredients_ar: "",
  allergens_en: "",
  allergens_he: "",
  allergens_ar: "",
  price: 0,
  compare_at_price: "",
  image_url: "",
  gallery_urls: [] as string[],
  is_best_seller: false,
  is_available: true,
  stock_quantity: null as number | null | "",
};

function dedupeImageUrls(image_url: string, gallery_urls: string[] | undefined): string[] {
  const out: string[] = [];
  const g = gallery_urls ?? [];
  if (image_url) out.push(image_url);
  for (const u of g) {
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

function productToForm(p: Record<string, unknown>) {
  const legacyName = typeof p.name === "string" ? p.name : "";
  const legacyDesc = typeof p.description === "string" ? p.description : "";
  const legacyIngredients = typeof p.ingredients === "string" ? p.ingredients : "";
  const legacyAllergens = typeof p.allergens === "string" ? p.allergens : "";
  const rawGallery = p.gallery_urls;
  const gallery_urls = Array.isArray(rawGallery)
    ? (rawGallery as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return {
    ...empty,
    ...p,
    gallery_urls,
    name_en: (p.name_en as string | undefined) ?? legacyName,
    name_he: (p.name_he as string | undefined) ?? legacyName,
    name_ar: (p.name_ar as string | undefined) ?? legacyName,
    description_en: (p.description_en as string | undefined) ?? legacyDesc,
    description_he: (p.description_he as string | undefined) ?? legacyDesc,
    description_ar: (p.description_ar as string | undefined) ?? legacyDesc,
    ingredients_en: (p.ingredients_en as string | undefined) ?? legacyIngredients,
    ingredients_he: (p.ingredients_he as string | undefined) ?? legacyIngredients,
    ingredients_ar: (p.ingredients_ar as string | undefined) ?? legacyIngredients,
    allergens_en: (p.allergens_en as string | undefined) ?? legacyAllergens,
    allergens_he: (p.allergens_he as string | undefined) ?? legacyAllergens,
    allergens_ar: (p.allergens_ar as string | undefined) ?? legacyAllergens,
    compare_at_price:
      p.compare_at_price != null && Number(p.compare_at_price) > 0
        ? String(Number(p.compare_at_price as number))
        : "",
  };
}

function CategoryThumb({
  cat,
  className,
}: {
  cat: { image_url?: string | null };
  className?: string;
}) {
  const src = cat.image_url ? resolveImage(cat.image_url) : null;
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-stone-200/90 bg-white",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Croissant className="h-4 w-4 text-[#B19470]" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  );
}

export function BakeryProductsPage({ projectId }: BakeryProductsPageProps) {
  const db = useBakeryDb(projectId);
  const { t, lang, dir } = useBakeryT();
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown>>(empty);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Record<string, unknown> | null>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const urlsToDeleteOnSave = useRef<string[]>([]);

  const BackChevron = dir === "rtl" ? ChevronRight : ChevronLeft;

  const categoryMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const c of categories) {
      map.set(String(c.id ?? ""), c);
    }
    return map;
  }, [categories]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === editing.category_id),
    [categories, editing.category_id],
  );

  const imageList = useMemo(
    () => dedupeImageUrls(String(editing.image_url ?? ""), editing.gallery_urls as string[] | undefined),
    [editing.image_url, editing.gallery_urls],
  );

  const load = () => {
    void db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setProducts((data ?? []) as Record<string, unknown>[]));
  };

  useEffect(() => {
    load();
    void db
      .from("categories")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }) => setCategories((data ?? []) as Record<string, unknown>[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeForm = () => {
    setOpen(false);
    setEditing({ ...empty });
    urlsToDeleteOnSave.current = [];
  };

  const save = async () => {
    const name_en = String(editing.name_en ?? "").trim();
    const name_he = String(editing.name_he ?? "").trim();
    const name_ar = String(editing.name_ar ?? "").trim();
    if (!name_en && !name_he && !name_ar) {
      toast.error(t("adminCategoryNamesRequired"));
      return;
    }
    const name = name_he || name_en || name_ar;
    const dEn = String(editing.description_en ?? "").trim();
    const dHe = String(editing.description_he ?? "").trim();
    const dAr = String(editing.description_ar ?? "").trim();
    const descriptionLegacy = dHe || dEn || dAr || null;
    const iEn = String(editing.ingredients_en ?? "").trim();
    const iHe = String(editing.ingredients_he ?? "").trim();
    const iAr = String(editing.ingredients_ar ?? "").trim();
    const ingredientsLegacy = iHe || iEn || iAr || null;
    const aEn = String(editing.allergens_en ?? "").trim();
    const aHe = String(editing.allergens_he ?? "").trim();
    const aAr = String(editing.allergens_ar ?? "").trim();
    const allergensLegacy = aHe || aEn || aAr || null;
    const sell = Number(editing.price);
    if (!Number.isFinite(sell) || sell < 0) {
      toast.error(t("genericError"));
      return;
    }
    const cmpRaw = String(editing.compare_at_price ?? "").trim();
    let compare_at_price: number | null = null;
    if (cmpRaw !== "") {
      const c = Number(cmpRaw);
      if (!Number.isFinite(c) || c < 0) {
        toast.error(t("genericError"));
        return;
      }
      if (c <= sell) {
        toast.error(t("adminCompareAtMustExceedSelling"));
        return;
      }
      compare_at_price = c;
    }
    const gallery_urls = ((editing.gallery_urls as string[] | undefined) ?? []).filter(
      (u: string) => typeof u === "string" && u.length > 0,
    );
    const payloadBase: Record<string, unknown> = {
      name,
      name_en: name_en || null,
      name_he: name_he || null,
      name_ar: name_ar || null,
      description: descriptionLegacy,
      description_en: dEn || null,
      description_he: dHe || null,
      description_ar: dAr || null,
      ingredients: ingredientsLegacy,
      ingredients_en: iEn || null,
      ingredients_he: iHe || null,
      ingredients_ar: iAr || null,
      allergens: allergensLegacy,
      allergens_en: aEn || null,
      allergens_he: aHe || null,
      allergens_ar: aAr || null,
      price: sell,
      compare_at_price,
      image_url: editing.image_url || null,
      category_id: editing.category_id || null,
      is_best_seller: !!editing.is_best_seller,
      is_available: !!editing.is_available,
      stock_quantity:
        editing.stock_quantity === "" || editing.stock_quantity == null
          ? null
          : Number(editing.stock_quantity),
    };
    const payloadWithGallery: Record<string, unknown> = { ...payloadBase, gallery_urls };

    const isGalleryColumnError = (msg: string) => {
      const m = msg.toLowerCase();
      return m.includes("gallery_urls") && (m.includes("schema cache") || m.includes("column"));
    };

    const runSave = async (payload: Record<string, unknown>) => {
      if (editing.id) {
        return db.from("products").update(payload).eq("id", String(editing.id));
      }
      return db.from("products").insert(payload);
    };

    try {
      await runSave(payloadWithGallery);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error ?? "");
      if (isGalleryColumnError(msg)) {
        try {
          await runSave(payloadBase);
        } catch (err2) {
          return toast.error(err2 instanceof Error ? err2.message : String(err2));
        }
        if (gallery_urls.length > 0) {
          toast.warning(t("adminGalleryColumnMissingWarning"), { duration: 16_000 });
        }
      } else {
        return toast.error(msg);
      }
    }

    toast.success(t("saved"));

    const toDelete = urlsToDeleteOnSave.current.splice(0);
    void safeDeleteStorageFiles(db, toDelete, {
      excludeProductId: editing.id ? String(editing.id) : undefined,
    });

    closeForm();
    load();
  };

  const performDelete = async (id: string) => {
    const target = products.find((p) => p.id === id) ?? pendingDelete;
    const imageUrls = [
      ...(target?.image_url ? [String(target.image_url)] : []),
      ...(Array.isArray(target?.gallery_urls)
        ? (target.gallery_urls as unknown[]).filter((u): u is string => typeof u === "string")
        : []),
    ];

    try {
      await db.from("products").delete().eq("id", id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return;
    }

    toast.success(t("deleted"));
    void safeDeleteStorageFiles(db, imageUrls);
    load();
  };

  const filteredProducts = useMemo(() => {
    let list = products.map((p) => ({
      ...p,
      category: p.category_id ? categoryMap.get(String(p.category_id)) : undefined,
    }));
    if (categoryFilterId) {
      list = list.filter((p) => p.category_id === categoryFilterId);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const cat = p.category as Record<string, unknown> | undefined;
      const catBlob = [cat?.name, cat?.name_en, cat?.name_he, cat?.name_ar]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const nameBlob = [p.name, p.name_en, p.name_he, p.name_ar]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const descBlob = [
        p.description,
        p.description_en,
        p.description_he,
        p.description_ar,
        p.ingredients,
        p.ingredients_en,
        p.ingredients_he,
        p.ingredients_ar,
        p.allergens,
        p.allergens_en,
        p.allergens_he,
        p.allergens_ar,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        nameBlob.includes(q) ||
        catBlob.includes(q) ||
        descBlob.includes(q) ||
        String(p.id).toLowerCase().includes(q) ||
        String(p.price).includes(q)
      );
    });
  }, [products, search, categoryFilterId, categoryMap]);

  const emptyListMessage = () => {
    if (products.length === 0) return t("noProducts");
    const hasSearch = search.trim().length > 0;
    const hasCategory = categoryFilterId != null;
    if (hasSearch && hasCategory) return t("adminNoMatchingFilters");
    if (hasSearch) return t("adminNoMatchingProducts");
    if (hasCategory) return t("adminNoProductsInCategory");
    return t("noProducts");
  };

  const scrollToTop = () => {
    document.getElementById("admin-products-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleBest = async (p: Record<string, unknown>) => {
    const id = String(p.id ?? "");
    if (!id) return;
    await db.from("products").update({ is_best_seller: !p.is_best_seller }).eq("id", id);
    load();
  };

  const uploadImage = async (file: File, target: "cover" | "gallery") => {
    const validation = await validateUpload(file);
    if (!validation.ok) {
      if (validation.error === "file_too_large") toast.error(t("uploadFileTooLarge"));
      else if (validation.error === "invalid_type") toast.error(t("uploadInvalidType"));
      else toast.error(t("uploadInvalidDimensions"));
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await db.uploadImage(file, { folder: "products" });
      if (error) throw error;
      const newUrl = String(data?.url ?? "");
      if (!newUrl) {
        toast.error(t("genericError"));
        return;
      }

      setEditing((prev) => {
        if (target === "cover") {
          if (prev.image_url && prev.image_url !== newUrl) {
            urlsToDeleteOnSave.current.push(String(prev.image_url));
          }
          return { ...prev, image_url: newUrl };
        }
        if (!prev.image_url) return { ...prev, image_url: newUrl };
        const g = [...((prev.gallery_urls as string[] | undefined) ?? [])];
        if (!g.includes(newUrl)) g.push(newUrl);
        return { ...prev, gallery_urls: g };
      });
    } catch {
      toast.error(t("genericError"));
    } finally {
      setUploading(false);
    }
  };

  const removeImageAtIndex = (index: number) => {
    const urls = dedupeImageUrls(
      String(editing.image_url ?? ""),
      editing.gallery_urls as string[] | undefined,
    );
    const removedUrl = urls[index];
    if (removedUrl) urlsToDeleteOnSave.current.push(removedUrl);
    const next = urls.filter((_, i) => i !== index);
    const [first, ...rest] = next;
    setEditing({
      ...editing,
      image_url: first || "",
      gallery_urls: rest,
    });
  };

  const formTitle = editing.id ? t("adminDialogProductEditTitle") : t("adminDialogProductNewTitle");

  const fieldClass =
    "rounded-xl border border-stone-200/90 bg-white shadow-sm focus-visible:border-[#1B4332]/35 focus-visible:ring-[#1B4332]/20";

  return (
    <div className="admin-page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <h1
        id="admin-products-top"
        tabIndex={-1}
        className="admin-header-enter scroll-mt-24 font-display text-2xl font-bold outline-none md:text-3xl"
      >
        {t("products")}
      </h1>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing({ ...empty });
        }}
      >
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(11rem,15rem)] lg:items-start lg:gap-8">
          <aside className="shrink-0 space-y-3 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
            <Button
              className="w-full bg-[#1B4332] text-white hover:bg-[#163d2f]"
              onClick={() => {
                setEditing({ ...empty });
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> {t("adminBtnNewProduct")}
            </Button>
          </aside>

          <section className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchProducts")}
              className="w-full max-w-full sm:max-w-md"
              aria-label={t("searchProducts")}
            />

            <div className="w-full max-w-full space-y-2 sm:max-w-md">
              <Label htmlFor="admin-product-category-filter" className="text-muted-foreground">
                {t("adminFilterByCategory")}
              </Label>
              <Select
                value={categoryFilterId ?? "all"}
                onValueChange={(v) => setCategoryFilterId(v === "all" ? null : v)}
              >
                <SelectTrigger id="admin-product-category-filter" className="w-full">
                  <SelectValue placeholder={t("adminAllCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("adminAllCategories")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={String(c.id)} value={String(c.id)}>
                      {pickName(c, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="admin-list-stagger flex flex-col gap-3">
              {filteredProducts.length === 0 && (
                <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  {emptyListMessage()}
                </p>
              )}
              {filteredProducts.map((p) => {
                const imgSrc = p.image_url ? resolveImage(String(p.image_url)) : null;
                const category = p.category as Record<string, unknown> | undefined;
                return (
                  <article
                    key={String(p.id)}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                      <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                        <button
                          type="button"
                          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-24 sm:w-24"
                          onClick={() => imgSrc && setLightboxUrl(imgSrc)}
                          disabled={!imgSrc}
                          aria-label={t("adminExpandImageHint")}
                        >
                          {imgSrc ? (
                            <img src={imgSrc} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                              {t("adminThImage")}
                            </span>
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1 text-start">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {category ? pickName(category, lang) : "—"}
                          </p>
                          <p className="break-all font-mono text-[11px] text-muted-foreground">
                            {t("adminProductIdLabel")}: {String(p.id)}
                          </p>
                          <p className="font-display text-base font-semibold leading-snug sm:text-lg">
                            {pickName(p, lang)}
                          </p>
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <BakeryProductPriceRow
                              price={Number(p.price)}
                              compareAtPrice={p.compare_at_price as number | null | undefined}
                              variant="compact"
                              className="text-start"
                            />
                            {p.stock_quantity != null && p.stock_quantity !== "" && (
                              <p className="text-sm text-muted-foreground">
                                {t("adminStockShort")}: {String(p.stock_quantity)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span
                              className={
                                p.is_available
                                  ? "inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                                  : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                              }
                            >
                              {p.is_available ? t("adminStatusAvailable") : t("adminStatusHidden")}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => void toggleBest(p)}
                              aria-label={t("adminBestSellerLabel")}
                            >
                              {p.is_best_seller ? (
                                <Star className="h-4 w-4 fill-primary text-primary" />
                              ) : (
                                <StarOff className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 flex-row gap-2 sm:w-auto sm:justify-end">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 border-[#1B4332]/25 sm:flex-initial sm:min-w-[7rem]"
                          onClick={() => {
                            setEditing(productToForm(p));
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                          {t("adminEditAction")}
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 gap-2 sm:flex-initial sm:min-w-[7rem]"
                          onClick={() => setPendingDelete(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("adminDeleteAction")}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <DialogContent
          className={cn(
            "flex max-h-[100dvh] w-full max-w-full flex-col gap-0 overflow-hidden border-stone-200/90 p-0 shadow-xl",
            "fixed inset-0 left-0 top-0 h-[100dvh] max-h-[100dvh] translate-x-0 translate-y-0 rounded-none",
            "sm:inset-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-xl",
            "[&>button.absolute]:hidden",
          )}
          style={{ backgroundColor: CREAM }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{t("adminDialogProductFormSr")}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <header
              className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
              style={{ backgroundColor: CREAM }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full text-[#B19470] hover:bg-black/[0.04] hover:text-[#9a7d5c]"
                onClick={() => closeForm()}
                aria-label={t("adminProductBackForm")}
              >
                <BackChevron className="h-5 w-5" strokeWidth={2} />
              </Button>
              <h2 className="font-display text-lg font-bold tracking-tight text-[#1B4332] sm:text-xl">
                {formTitle}
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full text-[#B19470] hover:bg-black/[0.04] hover:text-[#9a7d5c] disabled:opacity-40"
                disabled={uploading}
                onClick={() => void save()}
                aria-label={t("adminProductSaveForm")}
              >
                <Check className="h-5 w-5" strokeWidth={2.5} />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-4">
              <input
                ref={heroFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadImage(f, "cover");
                }}
              />
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadImage(f, "gallery");
                }}
              />

              <div className="relative mx-auto max-w-lg">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => heroFileRef.current?.click()}
                  className={cn(
                    "relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm outline-none transition-opacity",
                    "focus-visible:ring-2 focus-visible:ring-[#1B4332]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4E9]",
                    uploading && "pointer-events-none opacity-60",
                  )}
                  aria-label={t("adminProductChangeCover")}
                >
                  {editing.image_url ? (
                    <img
                      src={resolveImage(String(editing.image_url))!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 bg-stone-100/80 text-stone-500">
                      <Camera className="h-10 w-10 opacity-50" strokeWidth={1.25} />
                      <span className="text-xs font-medium">{t("adminLabelImage")}</span>
                    </div>
                  )}
                </button>
                <Button
                  type="button"
                  size="icon"
                  disabled={uploading}
                  onClick={(e) => {
                    e.stopPropagation();
                    heroFileRef.current?.click();
                  }}
                  className="absolute bottom-3 end-3 h-11 w-11 rounded-full border-0 bg-[#1B4332] text-white shadow-md hover:bg-[#163d2f]"
                  aria-label={t("adminProductChangeCover")}
                >
                  <Camera className="h-5 w-5" strokeWidth={2} />
                </Button>
              </div>

              <div className="mx-auto mt-6 max-w-lg space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#2a2a2a]">{t("adminLabelCategory")}</Label>
                  <Select
                    value={String(editing.category_id ?? "")}
                    onValueChange={(v) => setEditing({ ...editing, category_id: v })}
                  >
                    <SelectTrigger className={cn("h-12", fieldClass)}>
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {selectedCategory ? (
                          <CategoryThumb cat={selectedCategory as { image_url?: string | null }} />
                        ) : (
                          <CategoryThumb cat={{}} />
                        )}
                        <SelectValue placeholder={t("adminSelectCategoryPlaceholder")} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={String(c.id)} value={String(c.id)} textValue={pickName(c, lang)}>
                          <span className="flex items-center gap-2">
                            <CategoryThumb cat={c as { image_url?: string | null }} className="h-7 w-7" />
                            {pickName(c, lang)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="pn-he" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminThName")} ({t("adminCategoryLangHe")})
                    </Label>
                    <Input
                      id="pn-he"
                      value={String(editing.name_he ?? "")}
                      onChange={(e) => setEditing({ ...editing, name_he: e.target.value })}
                      className={cn("h-11", fieldClass)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pn-en" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminThName")} ({t("adminCategoryLangEn")})
                    </Label>
                    <Input
                      id="pn-en"
                      value={String(editing.name_en ?? "")}
                      onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                      className={cn("h-11", fieldClass)}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pn-ar" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminThName")} ({t("adminCategoryLangAr")})
                    </Label>
                    <Input
                      id="pn-ar"
                      dir="rtl"
                      value={String(editing.name_ar ?? "")}
                      onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                      className={cn("h-11", fieldClass)}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="pd-he" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminThDescription")} ({t("adminCategoryLangHe")})
                    </Label>
                    <Textarea
                      id="pd-he"
                      value={String(editing.description_he ?? "")}
                      onChange={(e) => setEditing({ ...editing, description_he: e.target.value })}
                      rows={4}
                      className={cn("min-h-[6rem] resize-y", fieldClass)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pd-en" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminThDescription")} ({t("adminCategoryLangEn")})
                    </Label>
                    <Textarea
                      id="pd-en"
                      value={String(editing.description_en ?? "")}
                      onChange={(e) => setEditing({ ...editing, description_en: e.target.value })}
                      rows={4}
                      className={cn("min-h-[6rem] resize-y", fieldClass)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pd-ar" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminThDescription")} ({t("adminCategoryLangAr")})
                    </Label>
                    <Textarea
                      id="pd-ar"
                      value={String(editing.description_ar ?? "")}
                      onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })}
                      rows={4}
                      className={cn("min-h-[6rem] resize-y", fieldClass)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="in-he" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("ingredients")} ({t("adminCategoryLangHe")})
                    </Label>
                    <Textarea
                      id="in-he"
                      value={String(editing.ingredients_he ?? "")}
                      onChange={(e) => setEditing({ ...editing, ingredients_he: e.target.value })}
                      rows={3}
                      className={cn("min-h-[5rem] resize-y", fieldClass)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="in-en" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("ingredients")} ({t("adminCategoryLangEn")})
                    </Label>
                    <Textarea
                      id="in-en"
                      value={String(editing.ingredients_en ?? "")}
                      onChange={(e) => setEditing({ ...editing, ingredients_en: e.target.value })}
                      rows={3}
                      className={cn("min-h-[5rem] resize-y", fieldClass)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="in-ar" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("ingredients")} ({t("adminCategoryLangAr")})
                    </Label>
                    <Textarea
                      id="in-ar"
                      value={String(editing.ingredients_ar ?? "")}
                      onChange={(e) => setEditing({ ...editing, ingredients_ar: e.target.value })}
                      rows={3}
                      className={cn("min-h-[5rem] resize-y", fieldClass)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="ag-he" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("allergens")} ({t("adminCategoryLangHe")})
                    </Label>
                    <Textarea
                      id="ag-he"
                      value={String(editing.allergens_he ?? "")}
                      onChange={(e) => setEditing({ ...editing, allergens_he: e.target.value })}
                      rows={3}
                      className={cn("min-h-[5rem] resize-y", fieldClass)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ag-en" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("allergens")} ({t("adminCategoryLangEn")})
                    </Label>
                    <Textarea
                      id="ag-en"
                      value={String(editing.allergens_en ?? "")}
                      onChange={(e) => setEditing({ ...editing, allergens_en: e.target.value })}
                      rows={3}
                      className={cn("min-h-[5rem] resize-y", fieldClass)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ag-ar" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("allergens")} ({t("adminCategoryLangAr")})
                    </Label>
                    <Textarea
                      id="ag-ar"
                      value={String(editing.allergens_ar ?? "")}
                      onChange={(e) => setEditing({ ...editing, allergens_ar: e.target.value })}
                      rows={3}
                      className={cn("min-h-[5rem] resize-y", fieldClass)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="pf-price" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminLabelPriceNis")}
                    </Label>
                    <Input
                      id="pf-price"
                      type="number"
                      step="0.01"
                      min={0}
                      value={editing.price as number}
                      onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                      className={cn("h-11 tabular-nums", fieldClass)}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-compare-at" className="text-sm font-semibold text-[#2a2a2a]">
                      {t("adminLabelCompareAtPriceNis")}
                    </Label>
                    <Input
                      id="product-compare-at"
                      type="number"
                      step="0.01"
                      min={0}
                      value={String(editing.compare_at_price ?? "")}
                      placeholder={t("adminOptionalPlaceholder")}
                      onChange={(e) => setEditing({ ...editing, compare_at_price: e.target.value })}
                      className={cn("h-11 tabular-nums", fieldClass)}
                      dir="ltr"
                    />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                    {t("adminCompareAtPriceHint")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pf-stock" className="text-sm font-semibold text-[#2a2a2a]">
                    {t("adminLabelStockInternal")}
                  </Label>
                  <Input
                    id="pf-stock"
                    type="number"
                    value={editing.stock_quantity ?? ""}
                    placeholder={t("adminOptionalPlaceholder")}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        stock_quantity: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={cn("h-11 tabular-nums", fieldClass)}
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-[#2a2a2a]">
                    {t("adminProductImagesSection")}
                  </Label>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {imageList.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative shrink-0">
                        <div className="h-20 w-20 overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm">
                          <img src={resolveImage(url)!} alt="" className="h-full w-full object-cover" />
                        </div>
                        <button
                          type="button"
                          className="absolute -end-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#1B4332] text-white shadow ring-2 ring-[#F8F4E9]"
                          onClick={() => removeImageAtIndex(idx)}
                          aria-label={t("adminDeleteAction")}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => galleryFileRef.current?.click()}
                      className={cn(
                        "flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-[#B19470]/55 bg-white/60 text-[#B19470] transition-colors",
                        "hover:border-[#B19470] hover:bg-white",
                        uploading && "pointer-events-none opacity-50",
                      )}
                    >
                      <Plus className="h-6 w-6" strokeWidth={2} />
                      <span className="px-1 text-center text-[10px] font-semibold leading-tight">
                        {t("adminProductAddImage")}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-200/90 bg-white px-3 py-3 shadow-sm">
                  <span className="text-sm font-semibold text-[#2a2a2a]">{t("adminProductAvailability")}</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!editing.is_available}
                      onCheckedChange={(v) => setEditing({ ...editing, is_available: v })}
                      className="data-[state=checked]:bg-[#1B4332]"
                    />
                    <span className="text-sm font-medium text-[#1B4332]">
                      {editing.is_available ? t("adminStatusAvailable") : t("adminStatusHidden")}
                    </span>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200/90 bg-white px-3 py-3 shadow-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-stone-300 text-[#1B4332] focus:ring-[#1B4332]"
                    checked={!!editing.is_best_seller}
                    onChange={(e) => setEditing({ ...editing, is_best_seller: e.target.checked })}
                  />
                  <span className="text-sm font-semibold text-[#2a2a2a]">{t("adminBestSellerLabel")}</span>
                </label>
              </div>
            </div>

            <footer
              className="shrink-0 border-t border-stone-200/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              style={{ backgroundColor: CREAM }}
            >
              <Button
                type="button"
                disabled={uploading}
                onClick={() => void save()}
                className="mx-auto flex h-12 w-full max-w-lg gap-2 rounded-xl bg-[#1B4332] text-[15px] font-semibold text-white hover:bg-[#163d2f]"
              >
                <Save className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2} />
                {t("adminProductSaveChanges")}
              </Button>
            </footer>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightboxUrl} onOpenChange={(o) => !o && setLightboxUrl(null)}>
        <DialogContent className="max-h-[90vh] max-w-[min(96vw,56rem)] border-0 bg-transparent p-0 shadow-none sm:rounded-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{t("adminExpandImageHint")}</DialogTitle>
            <DialogDescription>{t("adminExpandImageHint")}</DialogDescription>
          </DialogHeader>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="secondary"
        size="icon"
        className={cn(
          "fixed bottom-6 z-40 size-11 rounded-full border border-border shadow-lg shadow-black/10 transition-[opacity,transform] duration-200 end-6 motion-reduce:transition-none sm:bottom-8 sm:size-12 sm:end-8",
          showBackToTop
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-label={t("adminBackToTop")}
        title={t("adminBackToTop")}
        onClick={scrollToTop}
      >
        <ChevronUp className="size-5" aria-hidden />
      </Button>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminDeleteProductTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground">
                <p>{t("adminDeleteProductBody")}</p>
                {pendingDelete && (
                  <p className="font-medium text-foreground">{pickName(pendingDelete, lang)}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                const id = pendingDelete?.id;
                setPendingDelete(null);
                if (id) void performDelete(String(id));
              }}
            >
              {t("adminDeleteAction")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
