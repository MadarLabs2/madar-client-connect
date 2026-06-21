import { useEffect, useState } from "react";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RestDayDateRangeSelector } from "@/components/manage/bakery/RestDayDateRangeSelector";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import {
  createRestDay,
  deleteRestDay,
  fetchAdminRestDays,
  formatRestDayRange,
  updateRestDayStatus,
  type RestDayRow,
} from "@/lib/bakery/restDays";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type BakeryRestDaysPageProps = { projectId: string };

function RestDayListItem({
  row,
  onToggle,
  onDelete,
}: {
  row: RestDayRow;
  onToggle: (row: RestDayRow) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useBakeryT();

  return (
    <li className="overflow-hidden rounded-xl border border-[#1B4332]/10 bg-white shadow-sm sm:rounded-none sm:border-0 sm:border-b sm:border-[#1B4332]/10 sm:shadow-none last:sm:border-b-0">
      <div className="p-4 sm:px-5 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-snug text-[#1B4332] sm:text-[15px]" dir="ltr">
              {formatRestDayRange(row)}
            </p>
            {row.reason ? (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{row.reason}</p>
            ) : null}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium sm:hidden",
              row.is_active
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
                : "bg-stone-100 text-stone-600 ring-1 ring-stone-200/80",
            )}
          >
            {row.is_active ? t("restDayActive") : t("restDayInactive")}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#1B4332]/8 pt-3.5 sm:mt-3 sm:pt-3">
          <label className="flex min-h-[44px] flex-1 items-center gap-2.5 text-sm">
            <Switch
              checked={row.is_active}
              onCheckedChange={() => onToggle(row)}
              aria-label={row.is_active ? t("restDayActive") : t("restDayInactive")}
            />
            <span className="text-muted-foreground">
              {row.is_active ? t("restDayActive") : t("restDayInactive")}
            </span>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 border-destructive/30 px-3 text-destructive hover:bg-destructive/5 sm:h-9"
            onClick={() => onDelete(row.id)}
          >
            <Trash2 className="h-4 w-4 sm:me-1.5" aria-hidden />
            <span className="hidden sm:inline">{t("restDayDelete")}</span>
            <span className="sr-only sm:hidden">{t("restDayDelete")}</span>
          </Button>
        </div>
      </div>
    </li>
  );
}

export function BakeryRestDaysPage({ projectId }: BakeryRestDaysPageProps) {
  const db = useBakeryDb(projectId);
  const { t } = useBakeryT();
  const [rows, setRows] = useState<RestDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const result = await fetchAdminRestDays(db);
    if (!result.ok) {
      const missing = result.message.includes("bakery_rest_days");
      setNeedsMigration(missing);
      setLoadError(missing ? t("adminRestDaysMigrationHint") : result.message);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  }, [projectId]);

  const handleAdd = async () => {
    if (!startDate.trim()) {
      toast.error(t("restDayStartRequired"));
      return;
    }
    setSaving(true);
    const result = await createRestDay(db, {
      startDate: startDate.trim(),
      endDate: endDate.trim() && endDate.trim() !== startDate.trim() ? endDate.trim() : null,
      reason: reason.trim() || null,
    });
    setSaving(false);

    if (!result.ok) {
      if (result.message === "END_BEFORE_START") toast.error(t("restDayEndBeforeStart"));
      else if (result.message === "OVERLAP") toast.error(t("restDayOverlap"));
      else toast.error(result.message);
      return;
    }

    toast.success(t("restDaySavedSuccess"));
    setStartDate("");
    setEndDate("");
    setReason("");
    await load();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteRestDay(db, id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t("restDayRemovedSuccess"));
    await load();
  };

  const handleToggle = async (row: RestDayRow) => {
    const result = await updateRestDayStatus(db, row.id, !row.is_active);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t("restDayUpdatedSuccess"));
    await load();
  };

  return (
    <div className="admin-page-enter mx-auto max-w-4xl space-y-5 px-3 py-4 sm:space-y-8 sm:px-4 sm:py-6 md:px-8">
      <div className="admin-header-enter">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#1B4332] sm:text-3xl">
          {t("restDaysTitle")}
        </h1>
        <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground sm:mt-1 sm:text-sm">
          {t("adminRestDaysSubtitle")}
        </p>
      </div>

      <section className="admin-section-enter overflow-hidden rounded-2xl border border-[#1B4332]/10 bg-white shadow-sm">
        <div className="border-b border-[#1B4332]/10 bg-gradient-to-br from-[#1B4332] to-[#2d5a45] px-4 py-4 text-[#faf8f4] sm:px-6 sm:py-5">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:h-11 sm:w-11">
              <CalendarOff className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold sm:text-lg">{t("addRestDay")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-[#faf8f4]/85 sm:mt-0.5 sm:text-sm">
                {t("restDayOptionalEndHint")}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("loading")}
            </div>
          ) : loadError ? (
            <div
              className={cn(
                "rounded-xl border px-3.5 py-3.5 text-xs leading-relaxed sm:px-4 sm:py-4 sm:text-sm",
                needsMigration
                  ? "border-amber-300/80 bg-amber-50 text-amber-950"
                  : "border-destructive/30 bg-destructive/5 text-destructive",
              )}
              role="alert"
            >
              {loadError}
            </div>
          ) : (
            <>
              <div className="space-y-5 rounded-xl border border-[#1B4332]/10 bg-[#faf8f4]/40 p-3.5 sm:p-5">
                <RestDayDateRangeSelector
                  startDate={startDate}
                  endDate={endDate}
                  onStartChange={setStartDate}
                  onEndChange={setEndDate}
                />

                <div>
                  <label htmlFor="rest-reason" className="text-xs font-semibold text-[#1B4332] sm:text-sm">
                    {t("restDayReason")}
                  </label>
                  <Input
                    id="rest-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t("restDayReasonPlaceholder")}
                    className="mt-2 h-11 min-h-[44px] border-[#1B4332]/15 bg-white text-base sm:h-10 sm:text-sm"
                  />
                </div>

                <Button
                  type="button"
                  className="h-11 w-full bg-[#1B4332] text-sm hover:bg-[#1B4332]/90 sm:h-10 sm:w-auto"
                  onClick={() => void handleAdd()}
                  disabled={saving || !startDate}
                >
                  {saving ? (
                    <>
                      <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                      {t("adminOrderAvailabilitySaving")}
                    </>
                  ) : (
                    <>
                      <Plus className="me-2 h-4 w-4" aria-hidden />
                      {t("addRestDay")}
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-[#1B4332] sm:text-base">
                    {t("adminRestDaysUpcoming")}
                  </h3>
                  {rows.length > 0 ? (
                    <span className="rounded-full bg-[#1B4332]/8 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-[#1B4332] sm:text-xs">
                      {rows.length}
                    </span>
                  ) : null}
                </div>

                {rows.length === 0 ? (
                  <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-10 text-center sm:py-12">
                    <CalendarOff className="mb-3 h-8 w-8 text-stone-300" aria-hidden />
                    <p className="text-sm text-muted-foreground">{t("noRestDaysYet")}</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3 sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-[#1B4332]/12 sm:bg-white">
                    {rows.map((row) => (
                      <RestDayListItem
                        key={row.id}
                        row={row}
                        onToggle={(r) => void handleToggle(r)}
                        onDelete={(id) => void handleDelete(id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
