import { useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarDays, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { toIsoDate } from "@/lib/bakery/fulfillmentDays";
import { orderDateLocale } from "@/lib/bakery/formatDate";
import { useBakeryT } from "@/lib/bakery/i18n";
import type { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type RestDayDateRangeSelectorProps = {
  startDate: string;
  endDate: string;
  onStartChange: (iso: string) => void;
  onEndChange: (iso: string) => void;
};

function isoToLocalDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3) return undefined;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDisplayDate(iso: string, lang: Lang): string {
  const date = isoToLocalDate(iso);
  if (!date) return "";
  return format(date, "d MMMM yyyy", { locale: orderDateLocale(lang) });
}

export function RestDayDateRangeSelector({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: RestDayDateRangeSelectorProps) {
  const { t, lang, dir } = useBakeryT();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const selectedRange: DateRange | undefined = useMemo(() => {
    const from = isoToLocalDate(startDate);
    if (!from) return undefined;
    const to = isoToLocalDate(endDate);
    return { from, to: to && to.getTime() !== from.getTime() ? to : undefined };
  }, [startDate, endDate]);

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onStartChange("");
      onEndChange("");
      return;
    }
    onStartChange(toIsoDate(range.from));
    onEndChange(range.to ? toIsoDate(range.to) : "");
  };

  const clearDates = () => {
    onStartChange("");
    onEndChange("");
  };

  const isSingleDay = Boolean(startDate && (!endDate || endDate === startDate));
  const endDisplay =
    endDate && endDate !== startDate
      ? formatDisplayDate(endDate, lang)
      : isSingleDay
        ? t("restDaySingleDay")
        : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DateSummaryCard
          label={t("restDayStartDate")}
          badge={t("restDayStartRequiredBadge")}
          value={startDate ? formatDisplayDate(startDate, lang) : null}
          placeholder={t("restDayNotSelected")}
          filled={Boolean(startDate)}
        />
        <DateSummaryCard
          label={t("restDayEndDate")}
          badge={t("restDayOptionalBadge")}
          value={endDisplay}
          placeholder={t("restDayNotSelected")}
          filled={Boolean(endDate && endDate !== startDate) || isSingleDay}
          muted={isSingleDay}
        />
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{t("restDayCalendarHint")}</p>

      <div className="overflow-hidden rounded-2xl border border-[#1B4332]/12 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#1B4332]/8 bg-gradient-to-r from-[#faf8f4] to-white px-4 py-3">
          <CalendarDays className="h-4 w-4 text-[#1B4332]" aria-hidden />
          <span className="font-display text-sm font-medium text-[#1B4332]">{t("closedDate")}</span>
        </div>
        <div className="flex justify-center bg-gradient-to-b from-white to-[#faf8f4]/40 p-3 sm:p-5" dir={dir}>
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={handleRangeSelect}
            locale={orderDateLocale(lang)}
            disabled={{ before: today }}
            numberOfMonths={1}
            className="w-full max-w-[min(100%,22rem)] [--cell-size:2.75rem] sm:[--cell-size:2.5rem]"
            classNames={{
              months: "w-full",
              month: "w-full gap-3",
              month_caption: "mb-1 font-display text-base font-semibold text-[#1B4332]",
              nav: "text-[#1B4332]",
              weekday: "text-[#1B4332]/55 text-[0.65rem] font-semibold uppercase tracking-wide",
              day: "rounded-lg",
              today: "bg-[#1B4332]/10 text-[#1B4332] font-semibold",
            }}
          />
        </div>
      </div>

      {(startDate || endDate) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground hover:bg-[#1B4332]/5 hover:text-[#1B4332]"
          onClick={clearDates}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {t("restDayClearDates")}
        </Button>
      )}
    </div>
  );
}

function DateSummaryCard({
  label,
  badge,
  value,
  placeholder,
  filled,
  muted,
}: {
  label: string;
  badge: string;
  value: string | null;
  placeholder: string;
  filled: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[4.5rem] items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-colors",
        filled
          ? "border-[#1B4332]/25 bg-[#1B4332]/[0.04]"
          : "border-dashed border-[#1B4332]/18 bg-white",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          filled ? "bg-[#1B4332] text-white shadow-sm" : "bg-[#1B4332]/8 text-[#1B4332]",
        )}
      >
        <CalendarDays className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-xs font-semibold text-[#1B4332]">{label}</p>
          <span className="rounded-full bg-stone-100 px-2 py-px text-[10px] font-medium text-stone-500">
            {badge}
          </span>
        </div>
        <p
          className={cn(
            "mt-1 truncate font-display text-sm font-semibold leading-snug sm:text-base",
            value ? (muted ? "text-[#1B4332]/70" : "text-[#1B4332]") : "text-muted-foreground/60",
          )}
          dir="ltr"
        >
          {value ?? placeholder}
        </p>
      </div>
    </div>
  );
}
