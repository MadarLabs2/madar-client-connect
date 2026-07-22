import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  projectDelete,
  projectInsert,
  projectList,
  projectUpdate,
} from "@/lib/project-db.functions";
import { useEcommerceTheme } from "@/lib/ecommerce/EcommerceThemeContext";
import { useEcommerceT, type EcommerceLang } from "@/lib/ecommerce/i18n";
import { cn } from "@/lib/utils";

type ShippingZoneRow = {
  id: string;
  name_he: string;
  name_ar: string;
  name_en: string;
  price: number;
  is_active: boolean;
  sort_order: number;
};

export type FlushShippingZoneActiveFn = () => Promise<void>;

type EcommerceShippingZonesSectionProps = {
  projectId: string;
  /** Registers a flush fn so parent "Save Settings" can persist active toggles. */
  registerFlushActive?: (fn: FlushShippingZoneActiveFn | null) => void;
};

const emptyForm = () => ({
  nameHe: "",
  nameAr: "",
  nameEn: "",
  price: "",
  sortOrder: "0",
  isActive: true,
});

function normalizeNames(form: { nameHe: string; nameAr: string; nameEn: string }) {
  const nameHe = form.nameHe.trim();
  const nameAr = form.nameAr.trim();
  const nameEn = form.nameEn.trim();
  if (!nameHe && !nameAr && !nameEn) return null;
  const fallback = nameHe || nameEn || nameAr;
  return {
    name_he: nameHe || fallback,
    name_ar: nameAr || fallback,
    name_en: nameEn || fallback,
  };
}

function pickZoneName(row: ShippingZoneRow, lang: EcommerceLang): string {
  if (lang === "ar") return row.name_ar || row.name_he || row.name_en;
  return row.name_he || row.name_en || row.name_ar;
}

function isValidPrice(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0;
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </label>
  );
}

/** Compact active control — same height as outline action buttons. */
function ActiveToggle({
  checked,
  onCheckedChange,
  activeLabel,
  inactiveLabel,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  activeLabel: string;
  inactiveLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? activeLabel : inactiveLabel}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2.5 rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium transition-colors",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      <span
        dir="ltr"
        className={cn(
          "pointer-events-none relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/25",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
          )}
        />
      </span>
      <span
        className={cn(
          "min-w-[2.75rem] text-start",
          checked ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {checked ? activeLabel : inactiveLabel}
      </span>
    </button>
  );
}

export function EcommerceShippingZonesSection({
  projectId,
  registerFlushActive,
}: EcommerceShippingZonesSectionProps) {
  const { t, lang } = useEcommerceT();
  const { themeStyle } = useEcommerceTheme();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);

  const [rows, setRows] = useState<ShippingZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<{ names?: string; price?: string }>({});

  const rowsRef = useRef<ShippingZoneRow[]>([]);
  const baselineActiveRef = useRef<Map<string, boolean>>(new Map());
  rowsRef.current = rows;

  const applyLoadedRows = (mapped: ShippingZoneRow[]) => {
    setRows(mapped);
    baselineActiveRef.current = new Map(mapped.map((r) => [r.id, r.is_active]));
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFn({
        data: {
          projectId,
          table: "shipping_zones",
          select: "id, name_he, name_ar, name_en, price, is_active, sort_order",
          limit: 300,
          orderColumn: "sort_order",
          orderAscending: true,
        },
      });
      if (res.error) {
        const missing = res.error.includes("shipping_zones");
        setNeedsMigration(missing);
        setLoadError(missing ? t("shippingZonesMigrationHint") : res.error);
        applyLoadedRows([]);
        return;
      }
      const mapped = (res.rows ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        name_he: String(r.name_he ?? ""),
        name_ar: String(r.name_ar ?? ""),
        name_en: String(r.name_en ?? ""),
        price: Number(r.price ?? 0),
        is_active: r.is_active !== false,
        sort_order: Number(r.sort_order ?? 0),
      }));
      setNeedsMigration(false);
      setLoadError(null);
      applyLoadedRows(mapped);
    } catch (err: any) {
      const msg = String(err?.message ?? t("loadFailed"));
      const missing = msg.includes("shipping_zones");
      setNeedsMigration(missing);
      setLoadError(missing ? t("shippingZonesMigrationHint") : msg);
      applyLoadedRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!registerFlushActive) return;

    const flush: FlushShippingZoneActiveFn = async () => {
      const current = rowsRef.current;
      const dirty = current.filter((r) => baselineActiveRef.current.get(r.id) !== r.is_active);
      for (const r of dirty) {
        await updateFn({
          data: {
            projectId,
            table: "shipping_zones",
            id: r.id,
            row: { is_active: r.is_active },
          },
        });
      }
      baselineActiveRef.current = new Map(current.map((r) => [r.id, r.is_active]));
    };

    registerFlushActive(flush);
    return () => registerFlushActive(null);
  }, [registerFlushActive, projectId, updateFn]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), sortOrder: String(rows.length) });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (row: ShippingZoneRow) => {
    setEditingId(row.id);
    setForm({
      nameHe: row.name_he,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      price: String(row.price),
      sortOrder: String(row.sort_order),
      isActive: row.is_active,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const validateForm = (): boolean => {
    const next: { names?: string; price?: string } = {};
    if (!normalizeNames(form)) next.names = t("shippingZoneNameRequired");
    if (!isValidPrice(form.price)) next.price = t("shippingZonePriceInvalid");
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const names = normalizeNames(form);
    if (!names) return;
    const price = Number.parseFloat(form.price.trim());

    setSaving(true);
    try {
      const row = {
        ...names,
        price,
        is_active: form.isActive,
        sort_order: Number.parseInt(form.sortOrder, 10) || 0,
      };
      if (editingId) {
        await updateFn({ data: { projectId, table: "shipping_zones", id: editingId, row } });
      } else {
        await insertFn({ data: { projectId, table: "shipping_zones", row } });
      }
      toast.success(t("shippingZoneSaved"));
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFn({ data: { projectId, table: "shipping_zones", id } });
      toast.success(t("shippingZoneDeleted"));
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("loadFailed"));
    }
  };

  /** Local only — persisted via parent "Save Settings". */
  const handleToggle = (row: ShippingZoneRow) => {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)),
    );
  };

  return (
    <Card className="border-border/70 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MapPinned className="h-4 w-4" aria-hidden />
            </span>
            <h2 className="font-display text-xl">{t("shippingZonesTitle")}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t("shippingZonesSubtitle")}</p>
        </div>
        {!loading && !loadError ? (
          <Button type="button" className="shrink-0" onClick={openAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("shippingZoneAdd")}
          </Button>
        ) : null}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("loading")}
          </div>
        ) : loadError ? (
          <div
            className={cn(
              "rounded-xl border px-3.5 py-3.5 text-sm leading-relaxed",
              needsMigration
                ? "border-amber-300/80 bg-amber-50 text-amber-950"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
            role="alert"
          >
            {loadError}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border/80 bg-muted/30 px-4 py-10 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPinned className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">{t("shippingZonesEmpty")}</p>
            <Button type="button" className="mt-4" onClick={openAdd}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("shippingZoneAdd")}
            </Button>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border/70 bg-background">
            {rows.map((row, index) => (
              <li
                key={row.id}
                className={cn(
                  "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
                  index > 0 && "border-t border-border/60",
                  !row.is_active && "bg-muted/20 opacity-80",
                )}
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-medium tracking-tight">
                    {pickZoneName(row, lang)}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground" dir="ltr">
                    ₪{Number(row.price).toFixed(2)}
                    <span className="mx-1.5 text-border">·</span>#{row.sort_order}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActiveToggle
                    checked={row.is_active}
                    onCheckedChange={() => void handleToggle(row)}
                    activeLabel={t("shippingZoneActive")}
                    inactiveLabel={t("shippingZoneInactive")}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {t("edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => void handleDelete(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    {t("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          style={themeStyle}
          overlayClassName="bg-black/50 backdrop-blur-[1px]"
          className={cn(
            "gap-0 overflow-hidden border-border/70 p-0 shadow-xl sm:max-w-lg sm:rounded-2xl",
            "[&>button]:end-4 [&>button]:start-auto [&>button]:top-4",
            "[&>button]:rounded-md [&>button]:opacity-70 hover:[&>button]:opacity-100",
          )}
        >
          <div className="border-b border-border/60 px-5 py-4 pe-12 sm:px-6">
            <DialogHeader className="space-y-1.5 text-start">
              <DialogTitle className="font-display text-xl tracking-tight">
                {editingId ? t("shippingZoneEdit") : t("shippingZoneAdd")}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {t("shippingZoneDialogSubtitle")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div className="space-y-3">
              <div>
                <FieldLabel htmlFor="sz-name-he">{t("shippingZoneNameHe")}</FieldLabel>
                <Input
                  id="sz-name-he"
                  value={form.nameHe}
                  onChange={(e) => setForm((f) => ({ ...f, nameHe: e.target.value }))}
                  dir="rtl"
                  autoComplete="off"
                />
              </div>
              <div>
                <FieldLabel htmlFor="sz-name-ar">{t("shippingZoneNameAr")}</FieldLabel>
                <Input
                  id="sz-name-ar"
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  dir="rtl"
                  autoComplete="off"
                />
              </div>
              <div>
                <FieldLabel htmlFor="sz-name-en">{t("shippingZoneNameEn")}</FieldLabel>
                <Input
                  id="sz-name-en"
                  value={form.nameEn}
                  onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
              {formErrors.names ? (
                <p className="text-xs text-destructive" role="alert">
                  {formErrors.names}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="sz-price">{t("shippingZonePrice")}</FieldLabel>
                <Input
                  id="sz-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="tabular-nums"
                  dir="ltr"
                />
                {formErrors.price ? (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {formErrors.price}
                  </p>
                ) : null}
              </div>
              <div>
                <FieldLabel htmlFor="sz-sort">{t("shippingZoneSortOrder")}</FieldLabel>
                <Input
                  id="sz-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="tabular-nums"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <FieldLabel>{t("shippingZoneActive")}</FieldLabel>
              <ActiveToggle
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                activeLabel={t("shippingZoneActive")}
                inactiveLabel={t("shippingZoneInactive")}
                className="w-full justify-start sm:w-auto"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 border-t border-border/60 bg-muted/15 px-5 py-4 sm:justify-start sm:space-x-0 sm:px-6">
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
