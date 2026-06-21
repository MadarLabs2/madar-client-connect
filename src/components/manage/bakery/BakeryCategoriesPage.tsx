import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import { pickName, resolveImage } from "@/lib/bakery/utils";
import { validateUpload } from "@/lib/bakery/uploadValidation";
import { safeDeleteStorageFiles } from "@/lib/bakery/storageDelete";

type BakeryCategoriesPageProps = { projectId: string };

type CategoryRow = Record<string, unknown> & {
  id?: string;
  name?: string | null;
  name_en?: string | null;
  name_he?: string | null;
  name_ar?: string | null;
  description?: string | null;
  image_url?: string | null;
};

const empty: CategoryRow = {
  name_en: "",
  name_he: "",
  name_ar: "",
  description: "",
  image_url: "",
};

function categoryToForm(c: Record<string, unknown>): CategoryRow {
  const legacy = typeof c.name === "string" ? c.name : "";
  return {
    ...c,
    name_en:
      typeof c.name_en === "string" && c.name_en.trim() ? (c.name_en as string) : legacy,
    name_he:
      typeof c.name_he === "string" && c.name_he.trim() ? (c.name_he as string) : legacy,
    name_ar:
      typeof c.name_ar === "string" && c.name_ar.trim() ? (c.name_ar as string) : legacy,
  };
}

function categoryCardSubtitle(c: {
  name?: string | null;
  name_en?: string | null;
  name_he?: string | null;
  name_ar?: string | null;
}) {
  const legacy = (c.name ?? "").trim();
  const parts = [
    (c.name_he ?? "").trim() || legacy,
    (c.name_en ?? "").trim() || legacy,
    (c.name_ar ?? "").trim() || legacy,
  ];
  return [...new Set(parts.filter(Boolean))].join(" / ");
}

function categoryUpperLine(c: { name?: string | null; name_en?: string | null }) {
  const raw = ((c.name_en ?? "").trim() || (c.name ?? "").trim()).toUpperCase();
  return raw || "—";
}

export function BakeryCategoriesPage({ projectId }: BakeryCategoriesPageProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow>(empty);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);
  const urlToDeleteOnSave = useRef<string | null>(null);

  const load = () =>
    db
      .from("categories")
      .select("*")
      .order("name", { ascending: true })
      .limit(500)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setCats((data ?? []) as CategoryRow[]);
      });

  useEffect(() => {
    void load();
  }, [projectId]);

  const upload = async (file: File) => {
    const validation = await validateUpload(file);
    if (!validation.ok) {
      if (validation.error === "file_too_large") toast.error(t("uploadFileTooLarge"));
      else if (validation.error === "invalid_type") toast.error(t("uploadInvalidType"));
      else toast.error(t("uploadInvalidDimensions"));
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await db.uploadImage(file, { folder: "categories" });
      if (error) throw error;
      const newUrl = String(data?.url ?? "");
      if (!newUrl) {
        toast.error(t("genericError"));
        return;
      }

      setEditing((prev) => {
        if (prev.image_url && prev.image_url !== newUrl) {
          urlToDeleteOnSave.current = String(prev.image_url);
        }
        return { ...prev, image_url: newUrl };
      });
      toast.success(t("imageUploaded"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const name_en = editing.name_en?.trim() || null;
    const name_he = editing.name_he?.trim() || null;
    const name_ar = editing.name_ar?.trim() || null;
    if (!name_en && !name_he && !name_ar) {
      toast.error(t("adminCategoryNamesRequired"));
      return;
    }

    const name = name_he?.trim() || name_en?.trim() || name_ar?.trim() || "—";

    const payload = {
      name,
      name_en,
      name_he,
      name_ar,
      description: editing.description?.trim() || null,
      image_url: editing.image_url?.trim() || null,
    };

    try {
      if (editing.id) {
        const { error } = await db.from("categories").update(payload).eq("id", String(editing.id));
        if (error) throw error;
      } else {
        const { error } = await db.from("categories").insert(payload);
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("genericError"));
      return;
    }

    toast.success(t("saved"));

    if (urlToDeleteOnSave.current) {
      const oldUrl = urlToDeleteOnSave.current;
      urlToDeleteOnSave.current = null;
      void safeDeleteStorageFiles(db, [oldUrl], {
        excludeCategoryId: editing.id ? String(editing.id) : undefined,
      });
    }

    setOpen(false);
    setEditing(empty);
    void load();
  };

  const performDelete = async (id: string) => {
    const target = cats.find((c) => c.id === id) ?? pendingDelete;
    const imageUrl = target?.image_url ? String(target.image_url) : null;

    try {
      const { error } = await db.from("categories").delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("genericError"));
      return;
    }

    toast.success(t("deleted"));
    if (imageUrl) void safeDeleteStorageFiles(db, [imageUrl]);
    void load();
  };

  const filteredCats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cats;
    return cats.filter((c) => {
      const blob = [c.name, c.name_en, c.name_he, c.name_ar, c.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [cats, search]);

  return (
    <div className="admin-page-enter mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <h1
        id="admin-categories-top"
        className="admin-header-enter scroll-mt-24 font-display text-2xl font-bold md:text-3xl"
      >
        {t("categories")}
      </h1>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditing(empty);
            setUploading(false);
            urlToDeleteOnSave.current = null;
          }
        }}
      >
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(11rem,15rem)] lg:items-start lg:gap-8">
          <aside className="shrink-0 space-y-3 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
            <DialogTrigger asChild>
              <Button className="w-full" onClick={() => setEditing(empty)}>
                <Plus className="h-4 w-4" /> {t("adminBtnNewCategory")}
              </Button>
            </DialogTrigger>
          </aside>

          <section className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminSearchCategories")}
              className="w-full max-w-full sm:max-w-md"
              aria-label={t("adminSearchCategories")}
            />

            <div className="admin-list-stagger flex flex-col gap-3">
              {filteredCats.length === 0 && (
                <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  {cats.length === 0 ? t("noCategories") : t("adminNoMatchingCategoriesSearch")}
                </p>
              )}
              {filteredCats.map((c) => {
                const imgSrc = c.image_url ? resolveImage(c.image_url) : null;
                return (
                  <article
                    key={String(c.id)}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                      <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
                        <button
                          type="button"
                          className="relative mt-1 h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted ring-offset-background transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-24 sm:w-24"
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
                            {categoryUpperLine(c)}
                          </p>
                          <p className="break-words font-mono text-[11px] text-muted-foreground">
                            {t("adminProductIdLabel")}: {String(c.id)}
                          </p>
                          <p className="break-words font-display text-base font-semibold leading-snug text-foreground sm:text-lg">
                            {categoryCardSubtitle(c)}
                          </p>
                          {c.description?.trim() ? (
                            <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 flex-row gap-2 sm:w-auto sm:justify-end">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 border-primary/40 sm:flex-initial sm:min-w-[7rem]"
                          onClick={() => {
                            setEditing(categoryToForm(c));
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 shrink-0" />
                          {t("adminEditAction")}
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 gap-2 sm:flex-initial sm:min-w-[7rem]"
                          onClick={() => setPendingDelete(c)}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
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

        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing.id ? t("adminDialogCategoryEditTitle") : t("adminDialogCategoryNewTitle")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("adminDialogCategoryFormSr")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 [&_label]:text-sm [&_label]:!font-semibold [&_label]:text-foreground">
            <div className="space-y-2">
              <Label htmlFor="cat-name-en">{t("adminCategoryLangEn")}</Label>
              <Input
                id="cat-name-en"
                placeholder="English"
                value={editing.name_en ?? ""}
                onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-name-he">{t("adminCategoryLangHe")}</Label>
              <Input
                id="cat-name-he"
                placeholder="עברית"
                value={editing.name_he ?? ""}
                onChange={(e) => setEditing({ ...editing, name_he: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-name-ar">{t("adminCategoryLangAr")}</Label>
              <Input
                id="cat-name-ar"
                placeholder="العربية"
                dir="rtl"
                value={editing.name_ar ?? ""}
                onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">{t("adminThDescription")}</Label>
              <Textarea
                id="cat-desc"
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cat-image-url">{t("adminLabelImage")}</Label>
              <Input
                id="cat-image-url"
                type="url"
                value={editing.image_url ?? ""}
                placeholder={t("adminCategoryImageUrlPlaceholder")}
                onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                className="mt-1"
              />
              <p className="mt-2 text-xs text-muted-foreground">{t("adminCategoryImageHint")}</p>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="mt-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
              {uploading && (
                <p className="mt-1 text-xs text-muted-foreground">{t("adminUploading")}</p>
              )}
              {editing.image_url && (
                <div className="mt-3 flex items-start gap-3">
                  <img
                    src={resolveImage(editing.image_url)!}
                    alt=""
                    className="h-24 w-36 rounded-md border object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ ...editing, image_url: "" })}
                  >
                    {t("adminRemoveImage")}
                  </Button>
                </div>
              )}
            </div>
            <Button onClick={() => void save()} className="w-full" disabled={uploading}>
              {t("adminSave")}
            </Button>
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
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("adminDeleteCategoryTitle")}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground">
                <p>{t("adminDeleteCategoryBody")}</p>
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
