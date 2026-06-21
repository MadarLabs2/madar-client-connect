import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBakeryDb } from "@/lib/bakery/db";
import {
  fetchFulfillmentDays,
  rowsToWeekdayMap,
  saveFulfillmentAvailability,
  type WeekdayAvailability,
} from "@/lib/bakery/fulfillmentDays";
import { WEEKDAY_DICT_KEYS } from "@/lib/bakery/fulfillmentDays-i18n";
import { useBakeryT } from "@/lib/bakery/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type BakeryAvailabilityPageProps = { projectId: string };

const EMPTY_WEEK: WeekdayAvailability = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };

function WeekdayToggleGrid({
  title,
  description,
  values,
  onChange,
}: {
  title: string;
  description: string;
  values: WeekdayAvailability;
  onChange: (next: WeekdayAvailability) => void;
}) {
  const { t } = useBakeryT();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold text-[#1B4332]">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAY_DICT_KEYS.map((key, dayOfWeek) => {
          const enabled = values[dayOfWeek] ?? false;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={enabled}
              onClick={() => onChange({ ...values, [dayOfWeek]: !enabled })}
              className={cn(
                "rounded-xl border-2 px-3 py-3 text-center text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4332]/50 focus-visible:ring-offset-2",
                enabled
                  ? "border-[#1B4332] bg-[#1B4332] text-white shadow-sm"
                  : "border-[#1B4332]/15 bg-white text-[#1B4332]/70 hover:border-[#1B4332]/35 hover:bg-[#faf8f4]",
              )}
            >
              {t(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BakeryAvailabilityPage({ projectId }: BakeryAvailabilityPageProps) {
  const db = useBakeryDb(projectId);
  const { t } = useBakeryT();
  const [pickup, setPickup] = useState<WeekdayAvailability>({ ...EMPTY_WEEK, 2: true, 5: true });
  const [delivery, setDelivery] = useState<WeekdayAvailability>({ ...EMPTY_WEEK, 2: true, 5: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchFulfillmentDays(db);
      if (cancelled) return;
      if (!result.ok) {
        const missingTable = result.message.includes("fulfillment_available_days");
        setNeedsMigration(missingTable);
        setLoadError(missingTable ? t("adminOrderAvailabilityMigrationHint") : result.message);
        toast.error(t("adminOrderAvailabilityLoadError"));
        setLoading(false);
        return;
      }
      setLoadError(null);
      setNeedsMigration(false);
      setPickup(rowsToWeekdayMap(result.rows, "pickup"));
      setDelivery(rowsToWeekdayMap(result.rows, "delivery"));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, t]);

  const save = async () => {
    setSaving(true);
    const result = await saveFulfillmentAvailability(db, pickup, delivery);
    setSaving(false);

    if (!result.ok) {
      if (result.message === "MIN_ONE_DAY_REQUIRED") {
        toast.error(t("availabilityMinOneDay"));
      } else {
        toast.error(result.message);
      }
      return;
    }

    toast.success(t("availabilitySavedSuccess"));
  };

  return (
    <div className="admin-page-enter mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
      <div className="admin-header-enter">
        <h1 className="font-display text-3xl font-bold text-[#1B4332]">{t("adminOrderAvailabilityTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("adminOrderAvailabilitySubtitle")}</p>
      </div>

      <section
        className="admin-section-enter overflow-hidden rounded-2xl border border-[#1B4332]/10 bg-white shadow-sm"
        style={{ animationDelay: "120ms" }}
      >
        <div className="border-b border-[#1B4332]/10 bg-gradient-to-br from-[#1B4332] to-[#2d5a45] px-5 py-5 text-[#faf8f4] sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">{t("orderAvailabilityTitle")}</h2>
              <p className="mt-0.5 text-sm text-[#faf8f4]/85">{t("adminOrderAvailabilitySubtitle")}</p>
            </div>
          </div>
        </div>

        <div className="space-y-8 p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t("loading")}
            </div>
          ) : loadError ? (
            <div
              className={cn(
                "rounded-xl border px-4 py-4 text-sm leading-relaxed",
                needsMigration
                  ? "border-amber-300/80 bg-amber-50 text-amber-950"
                  : "border-destructive/30 bg-destructive/5 text-destructive",
              )}
              role="alert"
            >
              <p className="font-semibold">{t("adminOrderAvailabilityLoadError")}</p>
              <p className="mt-2">{loadError}</p>
            </div>
          ) : (
            <>
              <WeekdayToggleGrid
                title={t("pickupAvailabilityTitle")}
                description={t("choosePickupDay")}
                values={pickup}
                onChange={setPickup}
              />

              <div className="border-t border-[#1B4332]/10 pt-8">
                <WeekdayToggleGrid
                  title={t("deliveryAvailabilityTitle")}
                  description={t("chooseDeliveryDay")}
                  values={delivery}
                  onChange={setDelivery}
                />
              </div>

              <Button
                type="button"
                className="h-11 bg-[#1B4332] px-6 hover:bg-[#1B4332]/90"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("adminOrderAvailabilitySaving")}
                  </>
                ) : (
                  t("adminOrderAvailabilitySave")
                )}
              </Button>
            </>
          )}
        </div>
      </section>

      <section
        className="admin-section-enter rounded-2xl border border-dashed border-[#1B4332]/20 bg-[#faf8f4]/60 p-5"
        style={{ animationDelay: "180ms" }}
      >
        <div className="flex gap-3">
          <Truck className="mt-0.5 h-5 w-5 shrink-0 text-[#1B4332]" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground">{t("adminOrderAvailabilityNote")}</p>
        </div>
      </section>
    </div>
  );
}
