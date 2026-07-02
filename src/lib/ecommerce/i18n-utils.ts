export type EcommerceLang = "he" | "ar";

export const ECOMMERCE_LANGS: { code: EcommerceLang; labelKey: string; native: string }[] = [
  { code: "he", labelKey: "settings.langHe", native: "עברית" },
  { code: "ar", labelKey: "settings.langAr", native: "العربية" },
];

export function langStorageKey(projectId: string) {
  return `ecommerce-admin-lang:${projectId}`;
}

export function parseEcommerceLang(raw: unknown): EcommerceLang | null {
  return raw === "he" || raw === "ar" ? raw : null;
}

export function ecommerceLocale(lang: EcommerceLang) {
  return lang === "ar" ? "ar-IL" : "he-IL";
}

/** Keep Western digits (0–9) even when UI is Arabic. */
export const ECOMMERCE_LATN = { numberingSystem: "latn" as const };

export function formatEcommerceNumber(
  value: number,
  lang: EcommerceLang,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(ecommerceLocale(lang), {
    ...ECOMMERCE_LATN,
    ...options,
  }).format(value);
}

export function formatEcommerceMoney(
  amount: number,
  lang: EcommerceLang,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(ecommerceLocale(lang), {
    style: "currency",
    currency: "ILS",
    ...ECOMMERCE_LATN,
    ...options,
  }).format(amount);
}

export function formatEcommerceDateTime(
  input: Date | string | number,
  lang: EcommerceLang,
  options: Intl.DateTimeFormatOptions = {},
) {
  const date = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat(ecommerceLocale(lang), {
    ...ECOMMERCE_LATN,
    ...options,
  }).format(date);
}
