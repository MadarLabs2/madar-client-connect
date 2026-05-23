import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  projectList,
  projectInsert,
  projectUpdate,
  projectDelete,
  projectUploadImage,
} from "@/lib/project-db.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Size = { size: string; quantity: number };
type Variant = { color: string; colorHex: string; images: string[]; sizes: Size[] };
type ProductRow = {
  id: string;
  name: string;
  description?: string | null;
  description_en?: string | null;
  description_ar?: string | null;
  price: number;
  original_price?: number | null;
  category: string;
  variants?: Variant[];
  is_new?: boolean;
  is_featured?: boolean;
  is_on_sale?: boolean;
  popularity?: number;
};
type ProductInput = Omit<ProductRow, "id"> & { id?: string };

const emptyVariant: Variant = { color: "", colorHex: "#000000", images: [], sizes: [] };
const emptyForm: ProductInput = {
  name: "",
  description: "",
  description_en: "",
  description_ar: "",
  price: 0,
  original_price: null,
  category: "",
  variants: [emptyVariant],
  is_new: false,
  is_featured: false,
  is_on_sale: false,
  popularity: 0,
};

const getThumb = (p: ProductRow): string | null => {
  for (const v of p.variants ?? []) {
    const img = (v?.images ?? []).find((u) => typeof u === "string" && u.trim());
    if (img) return img;
  }
  return null;
};

const isHttpUrl = (s: string) => /^https?:\/\//i.test(s.trim());

const fileToBase64 = async (file: File) => {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
};

export function ProductsManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);
  const uploadFn = useServerFn(projectUploadImage);

  const { data: prodRes, isLoading, isError } = useQuery({
    queryKey: ["pdb", projectId, "products"],
    queryFn: () => listFn({ data: { projectId, table: "products", limit: 500 } }),
  });
  const { data: catRes } = useQuery({
    queryKey: ["pdb", projectId, "categories"],
    queryFn: () => listFn({ data: { projectId, table: "categories", limit: 200 } }),
  });

  const products = (prodRes?.rows ?? []) as ProductRow[];
  const categories = (catRes?.rows ?? []) as Array<{ id: string; name?: string }>;

  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ProductInput>(emptyForm);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Blob previews while uploading
  const [blobByKey, setBlobByKey] = useState<Record<string, string>>({});
  const blobRef = useRef(blobByKey);
  useEffect(() => {
    blobRef.current = blobByKey;
  }, [blobByKey]);
  useEffect(
    () => () => Object.values(blobRef.current).forEach((u) => URL.revokeObjectURL(u)),
    [],
  );
  const revokeBlob = (k: string) =>
    setBlobByKey((p) => {
      if (!(k in p)) return p;
      URL.revokeObjectURL(p[k]);
      const { [k]: _, ...rest } = p;
      return rest;
    });
  const setBlob = (k: string, f: File) =>
    setBlobByKey((p) => {
      const next = { ...p };
      if (next[k]) URL.revokeObjectURL(next[k]);
      next[k] = URL.createObjectURL(f);
      return next;
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const reset = () => setForm(emptyForm);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, "products"] });

  const toForm = (p: ProductRow): ProductInput => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    description_en: p.description_en ?? "",
    description_ar: p.description_ar ?? "",
    price: Number(p.price),
    original_price: p.original_price ?? null,
    category: p.category,
    variants: Array.isArray(p.variants) && p.variants.length ? p.variants : [emptyVariant],
    is_new: Boolean(p.is_new),
    is_featured: Boolean(p.is_featured),
    is_on_sale: Boolean(p.is_on_sale),
    popularity: Number(p.popularity ?? 0),
  });

  const onEdit = (p: ProductRow) => {
    setForm(toForm(p));
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את המוצר?")) return;
    try {
      await deleteFn({ data: { projectId, table: "products", id } });
      toast.success("נמחק");
      if (form.id === id) reset();
      invalidate();
    } catch (e: any) {
      toast.error(e.message || "המחיקה נכשלה");
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category || !form.price) {
      toast.error("שם, קטגוריה ומחיר הם חובה.");
      return;
    }
    if (!form.variants?.length) {
      toast.error("נדרש וריאנט אחד לפחות.");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const { id, ...rest } = form;
        await updateFn({ data: { projectId, table: "products", id: id!, row: rest } });
      } else {
        const { id: _i, ...rest } = form;
        await insertFn({ data: { projectId, table: "products", row: rest } });
      }
      toast.success("נשמר");
      reset();
      invalidate();
    } catch (e: any) {
      toast.error(e.message || "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const setVariant = (idx: number, next: Variant) =>
    setForm((p) => {
      const variants = [...(p.variants ?? [])];
      variants[idx] = next;
      return { ...p, variants };
    });
  const addVariant = () =>
    setForm((p) => ({ ...p, variants: [...(p.variants ?? []), { ...emptyVariant }] }));
  const removeVariant = (idx: number) =>
    setForm((p) => ({ ...p, variants: (p.variants ?? []).filter((_, i) => i !== idx) }));
  const addImage = (vIdx: number) => {
    const v = form.variants?.[vIdx];
    if (!v) return;
    setVariant(vIdx, { ...v, images: [...(v.images ?? []), ""] });
  };
  const addSize = (vIdx: number) => {
    const v = form.variants?.[vIdx];
    if (!v) return;
    setVariant(vIdx, { ...v, sizes: [...(v.sizes ?? []), { size: "", quantity: 0 }] });
  };

  const uploadImage = async (vIdx: number, iIdx: number, file: File) => {
    const key = `${vIdx}-${iIdx}`;
    setUploadingKey(key);
    setBlob(key, file);
    try {
      const dataBase64 = await fileToBase64(file);
      const res = await uploadFn({
        data: {
          projectId,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          dataBase64,
          folder: `products/${form.id ?? "draft"}`,
        },
      });
      const v = form.variants?.[vIdx];
      if (!v) return;
      const images = [...(v.images ?? [])];
      images[iIdx] = res.url;
      setVariant(vIdx, { ...v, images });
      toast.success("התמונה הועלתה");
    } catch (e: any) {
      toast.error(e.message || "ההעלאה נכשלה");
    } finally {
      revokeBlob(key);
      setUploadingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>תמונת מוצר</DialogTitle>
          </DialogHeader>
          {previewUrl && <img src={previewUrl} alt="" className="w-full" />}
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">מוצרים</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              requestAnimationFrame(() =>
                editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
              );
            }}
          >
            הוספת מוצר
          </Button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש…"
            className="w-44 border-b border-border bg-transparent py-2 text-sm focus:border-foreground focus:outline-none sm:w-64"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded border border-border p-4 text-sm text-muted-foreground">טוען…</div>
          ) : isError || prodRes?.error ? (
            <div className="rounded border border-border p-4 text-sm">
              <div>טעינת מוצרים נכשלה.</div>
              {prodRes?.error && <div className="mt-1 text-xs text-muted-foreground">{prodRes.error}</div>}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded border border-border p-4 text-sm text-muted-foreground">לא נמצאו מוצרים.</div>
          ) : (
            filtered.map((p) => {
              const thumb = getThumb(p);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 border border-border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {thumb ? (
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(thumb)}
                        className="aspect-square w-20 shrink-0 overflow-hidden border border-border bg-muted"
                      >
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div className="flex aspect-square w-20 shrink-0 items-center justify-center border border-dashed border-border bg-muted/50">
                        <span className="text-[10px] uppercase text-muted-foreground">אין תמונה</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.category}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.id}</div>
                      <div className="truncate text-sm">
                        {p.name} — ₪{Number(p.price)}
                        {p.original_price ? (
                          <span className="text-muted-foreground"> (₪{Number(p.original_price)})</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEdit(p)}>
                      עריכה
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(p.id)}>
                      מחיקה
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Editor */}
        <div ref={editorRef} className="border border-border p-4">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">הוספה / עריכת מוצר</h2>
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">שם</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full border-b border-border bg-transparent py-3 text-sm focus:border-foreground focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">קטגוריה</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full cursor-pointer border-b border-border bg-transparent py-3 text-sm focus:outline-none"
              >
                <option value="">בחר…</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">מחיר</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))}
                  className="w-full border-b border-border bg-transparent py-3 text-sm focus:border-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">מחיר מקורי</label>
                <input
                  type="number"
                  value={form.original_price ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      original_price: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="w-full border-b border-border bg-transparent py-3 text-sm focus:border-foreground focus:outline-none"
                />
              </div>
            </div>

            {(["description", "description_en", "description_ar"] as const).map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
                  {field === "description"
                    ? "תיאור (עברית)"
                    : field === "description_en"
                      ? "תיאור (אנגלית)"
                      : "תיאור (ערבית)"}
                </label>
                <textarea
                  value={(form as any)[field] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                  className="min-h-[80px] w-full border border-border bg-transparent p-3 text-sm focus:border-foreground focus:outline-none"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              {(["is_new", "is_featured", "is_on_sale"] as const).map((field) => (
                <label key={field} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean((form as any)[field])}
                    onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.checked }))}
                  />
                  <span className="text-sm">
                    {field === "is_new" ? "חדש" : field === "is_featured" ? "מומלץ" : "במבצע"}
                  </span>
                </label>
              ))}
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">פופולריות</label>
                <input
                  type="number"
                  value={form.popularity ?? 0}
                  onChange={(e) => setForm((p) => ({ ...p, popularity: Number(e.target.value) }))}
                  className="w-full border-b border-border bg-transparent py-2 text-sm focus:border-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Variants */}
            <div className="border border-border">
              <div className="flex items-center justify-between border-b border-border p-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">וריאנטים</p>
                <Button type="button" size="sm" variant="outline" onClick={addVariant}>
                  הוסף וריאנט
                </Button>
              </div>
              <div className="space-y-4 p-3">
                {(form.variants ?? []).map((v, idx) => (
                  <div key={idx} className="border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">וריאנט #{idx + 1}</p>
                      {(form.variants?.length ?? 0) > 1 && (
                        <Button type="button" size="sm" variant="destructive" onClick={() => removeVariant(idx)}>
                          הסר
                        </Button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">צבע</label>
                        <input
                          value={v.color}
                          onChange={(e) => setVariant(idx, { ...v, color: e.target.value })}
                          className="w-full border-b border-border bg-transparent py-2 text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Hex</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={v.colorHex || "#000000"}
                            onChange={(e) => setVariant(idx, { ...v, colorHex: e.target.value })}
                            className="h-9 w-12 cursor-pointer border border-border bg-transparent p-1"
                          />
                          <input
                            value={v.colorHex}
                            onChange={(e) => setVariant(idx, { ...v, colorHex: e.target.value })}
                            className="flex-1 border-b border-border bg-transparent py-2 text-sm focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Images */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">תמונות</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => addImage(idx)}>
                          הוסף תמונה
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {(v.images ?? []).map((img, i) => {
                          const key = `${idx}-${i}`;
                          const display = blobByKey[key] ?? (isHttpUrl(img) ? img.trim() : null);
                          return (
                            <div key={i} className="flex flex-col gap-2 sm:flex-row">
                              {display ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewUrl(display)}
                                  className="relative aspect-square w-24 shrink-0 overflow-hidden border border-border bg-muted"
                                >
                                  <img src={display} alt="" className="h-full w-full object-cover" />
                                  {uploadingKey === key && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-[10px] uppercase">
                                      מעלה…
                                    </span>
                                  )}
                                </button>
                              ) : (
                                <div className="flex aspect-square w-24 shrink-0 items-center justify-center border border-dashed border-border bg-muted/50 text-[10px] uppercase text-muted-foreground">
                                  אין תצוגה
                                </div>
                              )}
                              <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <input
                                  value={img}
                                  onChange={(e) => {
                                    const images = [...(v.images ?? [])];
                                    images[i] = e.target.value;
                                    setVariant(idx, { ...v, images });
                                  }}
                                  className="w-full border-b border-border bg-transparent py-2 text-sm focus:outline-none"
                                  placeholder="https://..."
                                />
                                <div className="flex flex-wrap gap-2">
                                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                                    {uploadingKey === key ? "מעלה…" : "העלה תמונה"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      disabled={uploadingKey === key}
                                      onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        await uploadImage(idx, i, f);
                                        e.currentTarget.value = "";
                                      }}
                                    />
                                  </label>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      const images = (v.images ?? []).filter((_, j) => j !== i);
                                      setVariant(idx, { ...v, images });
                                    }}
                                  >
                                    הסר
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(v.images ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">אין תמונות.</p>
                        )}
                      </div>
                    </div>

                    {/* Sizes */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">מידות</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => addSize(idx)}>
                          הוסף מידה
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(v.sizes ?? []).map((s, i) => (
                          <div key={i} className="grid grid-cols-3 items-center gap-2">
                            <input
                              value={s.size}
                              onChange={(e) => {
                                const sizes = [...(v.sizes ?? [])];
                                sizes[i] = { ...sizes[i], size: e.target.value };
                                setVariant(idx, { ...v, sizes });
                              }}
                              className="border-b border-border bg-transparent py-2 text-sm focus:outline-none"
                              placeholder="מידה"
                            />
                            <input
                              type="number"
                              value={s.quantity}
                              onChange={(e) => {
                                const sizes = [...(v.sizes ?? [])];
                                sizes[i] = { ...sizes[i], quantity: Number(e.target.value) };
                                setVariant(idx, { ...v, sizes });
                              }}
                              className="border-b border-border bg-transparent py-2 text-sm focus:outline-none"
                              placeholder="כמות"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                const sizes = (v.sizes ?? []).filter((_, j) => j !== i);
                                setVariant(idx, { ...v, sizes });
                              }}
                            >
                              הסר
                            </Button>
                          </div>
                        ))}
                        {(v.sizes ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">אין מידות.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "שומר…" : "שמירה"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={reset}>
                נקה
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
