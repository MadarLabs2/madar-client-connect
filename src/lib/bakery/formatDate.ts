import { format } from "date-fns";
import { he, enUS, arSA } from "date-fns/locale";
import type { Lang } from "@/lib/i18n";

export function orderDateLocale(lang: Lang) {
  if (lang === "en") return enUS;
  if (lang === "ar") return arSA;
  return he;
}

export function formatOrderDate(
  iso: string,
  lang: Lang,
  pattern: string,
): string {
  try {
    return format(new Date(iso), pattern, { locale: orderDateLocale(lang) });
  } catch {
    return iso;
  }
}

export function formatOrderDateDisplay(iso: string, lang: Lang, withTime = false): string {
  const pattern =
    lang === "en"
      ? withTime
        ? "MMM d, yyyy · h:mm a"
        : "MMM d, yyyy"
      : withTime
        ? "d MMMM yyyy · HH:mm"
        : "d MMMM yyyy";
  return formatOrderDate(iso, lang, pattern);
}

export function shortOrderRef(orderId: string): string {
  return `#${orderId.slice(0, 8)}`;
}
