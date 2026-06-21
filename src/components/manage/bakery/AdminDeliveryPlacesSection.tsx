import { useEffect, useState } from "react";
import { Loader2, MapPinned, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBakeryDb } from "@/lib/bakery/db";
import {
  createDeliveryPlace,
  deleteDeliveryPlace,
  fetchAdminDeliveryPlaces,
  isValidDeliveryPlacePrice,
  parseDeliveryPlacePrice,
  pickDeliveryPlaceName,
  updateDeliveryPlace,
  updateDeliveryPlaceStatus,
  type DeliveryPlaceRow,
} from "@/lib/bakery/deliveryPlaces";
import { useBakeryT } from "@/lib/bakery/i18n";
import { cn } from "@/lib/utils";

type AdminDeliveryPlacesSectionProps = { projectId: string };

const emptyForm = () => ({
  nameHe: "",
  nameAr: "",
  nameEn: "",
  price: "",
  sortOrder: "0",
  isActive: true,
});

export function AdminDeliveryPlacesSection({ projectId }: AdminDeliveryPlacesSectionProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();
  const [rows, setRows] = useState<DeliveryPlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<{ names?: string; price?: string }>({});

  const load = async () => {
    setLoading(true);
    const result = await fetchAdminDeliveryPlaces(db);
    if (!result.ok) {
      const missing = result.message.includes("delivery_places");
      setNeedsMigration(missing);
      setLoadError(missing ? t("adminDeliveryPlacesMigrationHint") : result.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setNeedsMigration(false);
    setRows(result.rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), sortOrder: String(rows.length) });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (row: DeliveryPlaceRow) => {
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
    if (!form.nameHe.trim() && !form.nameAr.trim() && !form.nameEn.trim()) {
      next.names = t("deliveryPlaceNameRequired");
    }
    if (!isValidDeliveryPlacePrice(form.price)) {
      next.price = t("deliveryPlacePriceInvalid");
    }
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    const price = parseDeliveryPlacePrice(form.price);
    if (price == null) return;

    setSaving(true);
    const payload = {
      nameHe: form.nameHe,
      nameAr: form.nameAr,
      nameEn: form.nameEn,
      price,
      isActive: form.isActive,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    };

    const result = editingId
      ? await updateDeliveryPlace(db, editingId, payload)
      : await createDeliveryPlace(db, payload);
    setSaving(false);

    if (!result.ok) {
      if (result.message === "NAME_REQUIRED") toast.error(t("deliveryPlaceNameRequired"));
      else if (result.message === "PRICE_INVALID") toast.error(t("deliveryPlacePriceInvalid"));
      else toast.error(result.message);
      return;
    }

    toast.success(t("deliveryPlaceSavedSuccess"));
    setDialogOpen(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteDeliveryPlace(db, id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t("deliveryPlaceRemovedSuccess"));
    await load();
  };

  const handleToggle = async (row: DeliveryPlaceRow) => {
    const result = await updateDeliveryPlaceStatus(db, row.id, !row.is_active);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t("deliveryPlaceSavedSuccess"));
    await load();
  };

  return (
    <section className="admin-section-enter overflow-hidden rounded-2xl border border-[#1B4332]/10 bg-white shadow-sm">
      <div className="border-b border-[#1B4332]/10 bg-gradient-to-br from-[#1B4332] to-[#2d5a45] px-4 py-4 text-[#faf8f4] sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-11 sm:w-11">
              <MapPinned className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold sm:text-lg">{t("deliveryPlacesTitle")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#faf8f4]/85 sm:mt-0.5 sm:text-sm">
                {t("adminDeliveryPlacesSubtitle")}
              </p>
            </div>
          </div>
          {!loading && !loadError ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 shrink-0 bg-white/15 text-[#faf8f4] hover:bg-white/25"
              onClick={openAdd}
            >
              <Plus className="me-2 h-4 w-4" aria-hidden />
              {t("addDeliveryPlace")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t("loading")}
          </div>
        ) : loadError ? (
          <div
            className={cn(
              "rounded-xl border px-3.5 py-3.5 text-xs leading-relaxed sm:text-sm",
              needsMigration
                ? "border-amber-300/80 bg-amber-50 text-amber-950"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
            role="alert"
          >
            {loadError}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-center">
            <MapPinned className="mb-3 h-8 w-8 text-stone-300" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("noDeliveryPlacesYet")}</p>
            <Button type="button" className="mt-4 bg-[#1B4332] hover:bg-[#1B4332]/90" onClick={openAdd}>
              <Plus className="me-2 h-4 w-4" aria-hidden />
              {t("addDeliveryPlace")}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3 sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-[#1B4332]/12">
            {rows.map((row) => (
              <li
                key={row.id}
                className="overflow-hidden rounded-xl border border-[#1B4332]/10 bg-white p-4 shadow-sm sm:rounded-none sm:border-0 sm:border-b sm:border-[#1B4332]/10 sm:shadow-none last:sm:border-b-0"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold text-[#1B4332]">
                      {pickDeliveryPlaceName(row, lang)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      ₪{Number(row.price).toFixed(2)} · #{row.sort_order}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={row.is_active}
                        onCheckedChange={() => void handleToggle(row)}
                        aria-label={row.is_active ? t("deliveryPlaceActive") : t("deliveryPlaceInactive")}
                      />
                      <span className="text-muted-foreground">
                        {row.is_active ? t("deliveryPlaceActive") : t("deliveryPlaceInactive")}
                      </span>
                    </label>
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => openEdit(row)}>
                      <Pencil className="me-1.5 h-3.5 w-3.5" aria-hidden />
                      {t("editDeliveryPlace")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => void handleDelete(row.id)}
                    >
                      <Trash2 className="me-1.5 h-3.5 w-3.5" aria-hidden />
                      {t("deliveryPlaceDelete")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          overlayClassName="bg-[#1B4332]/40 backdrop-blur-[3px]"
          className={cn(
            "gap-0 overflow-hidden border-[#1B4332]/12 p-0 shadow-2xl shadow-[#1B4332]/15",
            "w-[min(calc(100%-2rem),24rem)] max-w-[calc(100%-2rem)] sm:w-full sm:max-w-lg",
            "rounded-2xl",
            "[&>button]:end-3 [&>button]:top-3 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center",
            "[&>button]:rounded-full [&>button]:bg-white/15 [&>button]:text-[#faf8f4] [&>button]:opacity-100",
            "[&>button]:ring-0 [&>button]:hover:bg-white/25 [&>button]:focus:ring-2 [&>button]:focus:ring-white/40",
          )}
        >
          <div className="border-b border-[#1B4332]/10 bg-gradient-to-br from-[#1B4332] to-[#2d5a45] px-4 py-4 sm:px-5">
            <DialogHeader className="space-y-1.5 text-start pe-7">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <MapPinned className="h-4 w-4 text-[#faf8f4]" aria-hidden />
                </div>
                <DialogTitle className="font-display text-base font-semibold leading-snug text-[#faf8f4] sm:text-lg">
                  {editingId ? t("editDeliveryPlace") : t("addDeliveryPlace")}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs leading-relaxed text-[#faf8f4]/80">
                {t("deliveryPlaceDialogSubtitle")}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[min(65dvh,28rem)] space-y-4 overflow-y-auto bg-gradient-to-b from-[#faf8f4]/90 to-white px-4 py-4 sm:px-5 sm:py-5">
            <div className="space-y-3 rounded-xl border border-[#1B4332]/10 bg-white p-3.5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1B4332]/70">
                {t("deliveryPlace")}
              </p>
              <div className="space-y-2.5">
                <div>
                  <Label htmlFor="dp-name-he" className="text-xs text-muted-foreground">
                    {t("deliveryPlaceNameHe")}
                  </Label>
                  <Input
                    id="dp-name-he"
                    value={form.nameHe}
                    onChange={(e) => setForm((f) => ({ ...f, nameHe: e.target.value }))}
                    placeholder="עברית"
                    className="mt-1.5 h-10 border-[#1B4332]/15 bg-[#faf8f4]/40 focus-visible:ring-[#1B4332]/25"
                    dir="rtl"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="dp-name-ar" className="text-xs text-muted-foreground">
                    {t("deliveryPlaceNameAr")}
                  </Label>
                  <Input
                    id="dp-name-ar"
                    value={form.nameAr}
                    onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                    placeholder="العربية"
                    className="mt-1.5 h-10 border-[#1B4332]/15 bg-[#faf8f4]/40 focus-visible:ring-[#1B4332]/25"
                    dir="rtl"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="dp-name-en" className="text-xs text-muted-foreground">
                    {t("deliveryPlaceNameEn")}
                  </Label>
                  <Input
                    id="dp-name-en"
                    value={form.nameEn}
                    onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                    placeholder="English"
                    className="mt-1.5 h-10 border-[#1B4332]/15 bg-[#faf8f4]/40 focus-visible:ring-[#1B4332]/25"
                    dir="ltr"
                    autoComplete="off"
                  />
                </div>
              </div>
              {formErrors.names ? (
                <p className="text-xs text-destructive" role="alert">
                  {formErrors.names}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#1B4332]/10 bg-white p-3 shadow-sm">
                <Label htmlFor="dp-price" className="text-xs font-semibold uppercase tracking-wide text-[#1B4332]/70">
                  {t("deliveryPrice")}
                </Label>
                <div className="relative mt-2">
                  <span
                    className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#1B4332]"
                    dir="ltr"
                  >
                    ₪
                  </span>
                  <Input
                    id="dp-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="h-11 border-[#1B4332]/15 bg-[#faf8f4]/40 ps-9 tabular-nums focus-visible:ring-[#1B4332]/25"
                    dir="ltr"
                  />
                </div>
                {formErrors.price ? (
                  <p className="mt-1.5 text-xs text-destructive" role="alert">
                    {formErrors.price}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-[#1B4332]/10 bg-white p-3 shadow-sm">
                <Label htmlFor="dp-sort" className="text-xs font-semibold uppercase tracking-wide text-[#1B4332]/70">
                  {t("deliveryPlaceSortOrder")}
                </Label>
                <Input
                  id="dp-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="mt-2 h-11 border-[#1B4332]/15 bg-[#faf8f4]/40 tabular-nums focus-visible:ring-[#1B4332]/25"
                  dir="ltr"
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-[#1B4332]/10 bg-white px-3.5 py-3 shadow-sm">
              <span className="text-sm font-medium text-[#1B4332]">
                {form.isActive ? t("deliveryPlaceActive") : t("deliveryPlaceInactive")}
              </span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </label>
          </div>

          <DialogFooter className="flex-row gap-2 border-t border-[#1B4332]/8 bg-white/95 px-4 py-3.5 sm:px-5 sm:py-4">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 border-[#1B4332]/20 sm:flex-none"
              onClick={() => setDialogOpen(false)}
            >
              {t("adminDeliveryPlacesCancel")}
            </Button>
            <Button
              type="button"
              className="h-10 flex-1 bg-[#1B4332] hover:bg-[#1B4332]/90 sm:flex-none sm:min-w-[7.5rem]"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                  {t("adminOrderAvailabilitySaving")}
                </>
              ) : (
                t("adminDeliveryPlacesSave")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
