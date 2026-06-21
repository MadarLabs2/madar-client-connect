import { useBakeryT } from "@/lib/bakery/i18n";
import { resolveCompareAtPrice } from "@/lib/bakery/productPrice";
import { cn } from "@/lib/utils";

function formatNis(n: number) {
  return `₪${n.toFixed(2)}`;
}

export function BakeryProductPriceRow({
  price,
  compareAtPrice,
  variant,
  className,
}: {
  price: number;
  compareAtPrice?: number | null;
  variant: "compact" | "rail" | "default" | "hero";
  className?: string;
}) {
  const { t } = useBakeryT();
  const sell = Number(price);
  const was = resolveCompareAtPrice(sell, compareAtPrice);

  const wasSize =
    variant === "rail"
      ? "text-[10px] sm:text-[11px]"
      : variant === "compact"
        ? "text-[11px] sm:text-xs md:text-sm"
        : variant === "default"
          ? "text-sm"
          : "text-xl md:text-2xl";

  const nowSize =
    variant === "rail"
      ? "text-xs sm:text-sm"
      : variant === "compact"
        ? "text-sm sm:text-base md:text-xl"
        : variant === "default"
          ? "text-xl"
          : "text-3xl md:text-4xl";

  return (
    <div className={cn("font-display text-primary", className)}>
      {was != null ? (
        <span className="sr-only">
          {t("priceAccessibleWas")} {formatNis(was)}, {t("priceAccessibleNow")} {formatNis(sell)}.
        </span>
      ) : null}
      <span
        dir="ltr"
        className={cn(
          "inline-flex flex-col",
          was != null ? "items-end gap-0.5 sm:gap-1" : "items-baseline",
        )}
        {...(was != null ? { "aria-hidden": true as const } : {})}
      >
        {was != null ? (
          <>
            <span className={cn("font-bold tabular-nums leading-tight", nowSize)}>{formatNis(sell)}</span>
            <span
              className={cn(
                "font-sans font-semibold leading-none line-through text-destructive decoration-destructive/75",
                wasSize,
              )}
            >
              {formatNis(was)}
            </span>
          </>
        ) : (
          <span className={cn("font-bold tabular-nums", nowSize)}>{formatNis(sell)}</span>
        )}
      </span>
    </div>
  );
}
