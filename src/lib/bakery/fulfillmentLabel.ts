import type { Lang } from "@/lib/i18n";
import { formatOrderDateDisplay } from "@/lib/bakery/formatDate";

/** Mirrors bakery `fulfillmentLabelFromOrder` for admin order detail. */
export function fulfillmentLabelFromOrder(
  selectedDate: string | null | undefined,
  dayOfWeek: number | string | null | undefined,
  label: string | null | undefined,
  lang: Lang,
  _deliveryMethod?: string | null,
): string | null {
  const custom = String(label ?? "").trim();
  if (custom) return custom;
  const date = String(selectedDate ?? "").trim();
  if (date) return formatOrderDateDisplay(date, lang);
  if (dayOfWeek != null && String(dayOfWeek).trim() !== "") return String(dayOfWeek);
  return null;
}
