import type { Lang } from "@/lib/i18n";
import { formatOrderDateDisplay, shortOrderRef } from "@/lib/bakery/formatDate";
import { cn } from "@/lib/utils";

type OrderRefAndDateProps = {
  orderId: string;
  createdAt: string;
  lang: Lang;
  className?: string;
};

/** Order ref + date with correct visual order and bidi isolation for RTL locales. */
export function OrderRefAndDate({ orderId, createdAt, lang, className }: OrderRefAndDateProps) {
  const ref = shortOrderRef(orderId);
  const date = formatOrderDateDisplay(createdAt, lang);
  const refEl = (
    <span dir="ltr" className="font-mono [unicode-bidi:isolate]">
      {ref}
    </span>
  );
  const dateEl = <time dateTime={createdAt}>{date}</time>;
  const sep = <span aria-hidden className="text-muted-foreground/60">·</span>;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground", className)}>
      {lang === "en" ? (
        <>
          {refEl}
          {sep}
          {dateEl}
        </>
      ) : (
        <>
          {dateEl}
          {sep}
          {refEl}
        </>
      )}
    </div>
  );
}
