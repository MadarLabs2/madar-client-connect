import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarOff,
  FolderTree,
  Mail,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import { formatOrderDateDisplay } from "@/lib/bakery/formatDate";
import { useBakeryPendingOrderCount, useBakeryPendingOrders } from "@/lib/bakery/useBakeryPendingOrderCount";
import { adminOrderStatusLabel, adminOrderStatusPillClass } from "@/lib/bakery/adminLabels";

type BakeryDashboardProps = {
  projectId: string;
  projectName: string;
  liveUrl?: string | null;
  activeTab?: string;
  onTabChange: (tab: string) => void;
};

type TileTitleKey =
  | "adminDashReportsTitle"
  | "products"
  | "categories"
  | "adminDashOrdersTitle"
  | "adminDashCouponsTitle"
  | "adminDashEmailOffersTitle"
  | "adminDashSettingsTitle"
  | "adminDashAvailabilityTitle"
  | "adminDashRestDaysTitle";

type TileDescKey =
  | "adminDashReportsDesc"
  | "adminDashProductsDesc"
  | "adminDashCategoriesDesc"
  | "adminDashOrdersDesc"
  | "adminDashCouponsDesc"
  | "adminDashEmailOffersDesc"
  | "adminDashSettingsDesc"
  | "adminDashAvailabilityDesc"
  | "adminDashRestDaysDesc";

type TileLinkKey =
  | "adminResourceLinkProducts"
  | "adminResourceLinkCategories"
  | "adminResourceLinkOrders"
  | "adminResourceLinkCoupons"
  | "adminResourceLinkOffers"
  | "adminResourceLinkReports"
  | "adminResourceLinkSettings"
  | "adminResourceLinkAvailability"
  | "adminResourceLinkRestDays";

type ResourceTile = {
  tab: string;
  icon: LucideIcon;
  titleKey: TileTitleKey;
  descKey: TileDescKey;
  linkKey: TileLinkKey;
  iconClass: string;
  glowClass: string;
  linkClass: string;
};

const resourceTiles: ResourceTile[] = [
  {
    tab: "products",
    icon: Package,
    titleKey: "products",
    descKey: "adminDashProductsDesc",
    linkKey: "adminResourceLinkProducts",
    iconClass: "bg-[#2d4a3e] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#2d4a3e]",
    linkClass: "text-[#2d4a3e]",
  },
  {
    tab: "categories",
    icon: FolderTree,
    titleKey: "categories",
    descKey: "adminDashCategoriesDesc",
    linkKey: "adminResourceLinkCategories",
    iconClass: "bg-[#6b5344] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#6b5344]",
    linkClass: "text-[#6b5344]",
  },
  {
    tab: "orders",
    icon: ShoppingCart,
    titleKey: "adminDashOrdersTitle",
    descKey: "adminDashOrdersDesc",
    linkKey: "adminResourceLinkOrders",
    iconClass: "bg-[#1f6f3e] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#1f6f3e]",
    linkClass: "text-[#1f6f3e]",
  },
  {
    tab: "coupons",
    icon: Tag,
    titleKey: "adminDashCouponsTitle",
    descKey: "adminDashCouponsDesc",
    linkKey: "adminResourceLinkCoupons",
    iconClass: "bg-[#b45309] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#b45309]",
    linkClass: "text-[#b45309]",
  },
  {
    tab: "offers",
    icon: Mail,
    titleKey: "adminDashEmailOffersTitle",
    descKey: "adminDashEmailOffersDesc",
    linkKey: "adminResourceLinkOffers",
    iconClass: "bg-[#2b5cad] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#2b5cad]",
    linkClass: "text-[#2b5cad]",
  },
  {
    tab: "reports",
    icon: BarChart3,
    titleKey: "adminDashReportsTitle",
    descKey: "adminDashReportsDesc",
    linkKey: "adminResourceLinkReports",
    iconClass: "bg-[#45454a] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#45454a]",
    linkClass: "text-[#45454a]",
  },
  {
    tab: "settings",
    icon: Settings,
    titleKey: "adminDashSettingsTitle",
    descKey: "adminDashSettingsDesc",
    linkKey: "adminResourceLinkSettings",
    iconClass: "bg-[#1B4332] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#1B4332]",
    linkClass: "text-[#1B4332]",
  },
  {
    tab: "availability",
    icon: Calendar,
    titleKey: "adminDashAvailabilityTitle",
    descKey: "adminDashAvailabilityDesc",
    linkKey: "adminResourceLinkAvailability",
    iconClass: "bg-[#3d6b5a] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#3d6b5a]",
    linkClass: "text-[#3d6b5a]",
  },
  {
    tab: "rest-days",
    icon: CalendarOff,
    titleKey: "adminDashRestDaysTitle",
    descKey: "adminDashRestDaysDesc",
    linkKey: "adminResourceLinkRestDays",
    iconClass: "bg-[#7c5c4a] text-white shadow-sm ring-1 ring-white/15",
    glowClass: "bg-[#7c5c4a]",
    linkClass: "text-[#7c5c4a]",
  },
];

type OrderRow = {
  id: string;
  customer_name: string | null;
  order_status: string;
  created_at: string;
  total_amount: number | string | null;
};

async function subscriberCount(
  db: ReturnType<typeof useBakeryDb>,
): Promise<number> {
  const emailRes = await db.from("email_subscribers").select("id", { head: true, count: "exact" });
  if (!emailRes.error) return emailRes.count ?? 0;
  const newsletterRes = await db
    .from("newsletter_subscribers")
    .select("id", { head: true, count: "exact" });
  return newsletterRes.count ?? 0;
}

export function BakeryDashboard({ projectId, activeTab, onTabChange }: BakeryDashboardProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();
  const pendingOrders = useBakeryPendingOrderCount();
  const { ordersRevision } = useBakeryPendingOrders();
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["bakery", projectId, "dashboard-kpis", ordersRevision],
    queryFn: async () => {
      const [ordersRes, productsRes, totalsRes, subsCount, recentRes] = await Promise.all([
        db.from("orders").select("id", { head: true, count: "exact" }),
        db.from("products").select("id", { head: true, count: "exact" }),
        db.from("orders").select("total_amount"),
        subscriberCount(db),
        db
          .from("orders")
          .select("id, customer_name, order_status, created_at, total_amount")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      const revenue = ((totalsRes.data ?? []) as Array<{ total_amount?: number | string | null }>).reduce(
        (s, x) => s + Number(x.total_amount ?? 0),
        0,
      );
      return {
        revenue,
        orders: ordersRes.count ?? 0,
        products: productsRes.count ?? 0,
        subscribers: subsCount,
        recent: (recentRes.data ?? []) as OrderRow[],
      };
    },
    placeholderData: (prev) => prev,
  });

  const q = search.trim().toLowerCase();
  const filteredTiles = useMemo(() => {
    if (!q) return resourceTiles;
    return resourceTiles.filter((tile) => {
      const title = t(tile.titleKey).toLowerCase();
      const desc = t(tile.descKey).toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [q, t]);

  const isTileActive = (tab: string) => activeTab === tab;

  const kpis = [
    {
      labelKey: "adminMetricRevenue" as const,
      value: `₪${(data?.revenue ?? 0).toFixed(2)}`,
      badge: t("adminKpiBadgeAllTime"),
      badgeClass: "bg-[#e8f0eb] text-[#2d5544] ring-1 ring-[#2d5544]/12",
    },
    {
      labelKey: "adminMetricTotalOrders" as const,
      value: data?.orders ?? 0,
      badge: t("adminKpiBadgeLive"),
      badgeClass: "bg-[#f7efe6] text-[#8b5a2b] ring-1 ring-[#8b5a2b]/15",
    },
    {
      labelKey: "adminMetricTotalProducts" as const,
      value: data?.products ?? 0,
      badge: t("adminKpiBadgeInStock"),
      badgeClass: "bg-stone-100/90 text-stone-600 ring-1 ring-stone-300/40",
    },
    {
      labelKey: "adminMetricSubscribers" as const,
      value: data?.subscribers ?? 0,
      badge: t("adminKpiBadgeActive"),
      badgeClass: "bg-[#e8f0eb] text-[#2d5544] ring-1 ring-[#2d5544]/12",
    },
  ];

  const recent = data?.recent ?? [];

  return (
    <div className="admin-page-enter mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:max-w-[min(100%,80rem)]">
      <div className="space-y-5 rounded-2xl border border-stone-200/45 bg-gradient-to-b from-[#fffdfb] via-[#faf7f2] to-[#f3efe8] p-4 shadow-[0_1px_3px_rgba(60,42,33,0.06)] sm:space-y-7 sm:rounded-3xl sm:p-6 md:space-y-10 md:p-8">
        <header className="admin-header-enter flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-display text-2xl font-medium tracking-[0.02em] text-[#2c3d34] sm:text-[1.65rem] md:text-[2.1rem] md:leading-[1.15]">
              {t("adminPanelTitle")}
            </h1>
            <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-stone-600 sm:mt-3 sm:text-[0.95rem] md:mt-4 md:text-base">
              {t("adminPanelSubtitle")}
            </p>
          </div>
          <div className="relative w-full shrink-0 lg:max-w-sm">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400 sm:start-3 sm:h-4 sm:w-4"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminSearchPlaceholder")}
              className="h-9 rounded-full border-stone-200/90 bg-white/85 ps-9 text-sm text-stone-800 shadow-sm transition-colors placeholder:text-stone-400 focus-visible:border-stone-300 focus-visible:ring-2 focus-visible:ring-[#1B4332]/12 sm:h-10 sm:ps-10 sm:text-base"
              aria-label={t("adminSearchPlaceholder")}
            />
          </div>
        </header>

        <section aria-label={t("adminMetricsOverviewSr")}>
          <h2 className="sr-only">{t("adminMetricsOverviewSr")}</h2>
          <div className="admin-list-stagger grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.labelKey}
                className="relative overflow-hidden rounded-2xl border border-stone-200/50 bg-gradient-to-b from-[#fefdfb] to-[#f5f1ea] p-3.5 shadow-[0_1px_2px_rgba(60,42,33,0.05)] sm:p-5"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="min-w-0 font-sans text-[9px] font-medium uppercase leading-tight tracking-[0.12em] text-stone-500 sm:text-[10px] sm:tracking-[0.14em]">
                    {t(k.labelKey)}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-px text-[8px] font-medium sm:px-2 sm:py-0.5 sm:text-[10px]",
                      k.badgeClass,
                    )}
                  >
                    {k.badge}
                  </span>
                </div>
                <p className="mt-2.5 font-display text-lg font-medium tabular-nums tracking-tight text-[#4a4238] sm:mt-4 sm:text-2xl md:text-[1.65rem]">
                  {k.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 sm:space-y-4" aria-labelledby="resource-mgmt-heading">
          <h2
            id="resource-mgmt-heading"
            className="border-b border-stone-200/50 pb-2 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500 sm:pb-2.5 sm:text-[11px] sm:tracking-[0.22em]"
          >
            {t("adminDashResourceSection")}
          </h2>
          <ul className="admin-list-stagger grid list-none auto-rows-[1fr] grid-cols-2 gap-2.5 p-0 sm:gap-3 xl:grid-cols-3">
            {filteredTiles.map((tile) => {
              const Icon = tile.icon;
              const active = isTileActive(tile.tab);
              return (
                <li key={tile.tab} className="flex min-h-0 min-w-0">
                  <button
                    type="button"
                    onClick={() => onTabChange(tile.tab)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-stone-200/50 bg-gradient-to-b from-[#fefdfb] to-[#f8f4ed] p-3.5 text-start shadow-sm outline-none transition-[box-shadow,border-color,transform] duration-300 sm:p-5 md:p-6",
                      "hover:border-stone-300/70 hover:shadow-md hover:shadow-stone-300/25 sm:motion-safe:hover:-translate-y-px",
                      "focus-visible:ring-2 focus-visible:ring-[#1B4332]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf7f2]",
                      active && "border-stone-300/80 ring-1 ring-[#1B4332]/15 shadow-md shadow-stone-200/30",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none absolute -end-4 -top-6 h-20 w-20 rounded-full opacity-[0.07] transition-opacity group-hover:opacity-[0.1] sm:-end-6 sm:-top-10 sm:h-32 sm:w-32",
                        tile.glowClass,
                      )}
                      aria-hidden
                    />
                    <div className="relative flex min-h-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1">
                        <div className="flex items-start gap-2 sm:gap-4">
                          <span
                            className={cn(
                              "flex shrink-0 rounded-xl p-2 shadow-inner sm:p-3",
                              tile.tab === "orders" && "relative",
                              tile.iconClass,
                            )}
                          >
                            <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.85} aria-hidden />
                            {tile.tab === "orders" && pendingOrders > 0 ? (
                              <Badge
                                variant="destructive"
                                className="pointer-events-none absolute -end-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 py-0 text-[10px] font-bold leading-none tabular-nums sm:h-5 sm:min-w-5 sm:text-[11px]"
                              >
                                {pendingOrders > 99 ? "99+" : pendingOrders}
                              </Badge>
                            ) : null}
                          </span>
                          <div className="min-w-0 flex-1 pt-0 sm:pt-0.5">
                            <h3 className="font-display text-[15px] font-medium leading-snug text-[#3d342c] sm:text-lg md:text-xl">
                              {t(tile.titleKey)}
                            </h3>
                            <p className="mt-1 min-h-[2lh] line-clamp-2 font-sans text-[10px] leading-relaxed text-stone-600 sm:mt-1.5 sm:text-sm">
                              {t(tile.descKey)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "mt-auto inline-flex shrink-0 items-center gap-1 pt-2.5 font-sans text-[10px] font-medium tracking-wide transition-transform motion-safe:group-hover:translate-x-0.5 sm:gap-1.5 sm:pt-4 sm:text-sm md:pt-5 rtl:motion-safe:group-hover:-translate-x-0.5",
                          tile.linkClass,
                        )}
                      >
                        <span className="line-clamp-1">{t(tile.linkKey)}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 opacity-80 sm:h-4 sm:w-4 rtl:rotate-180" aria-hidden />
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {filteredTiles.length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-300/60 bg-white/50 px-4 py-6 text-center text-sm text-stone-500">
              {t("adminNoMatchingSections")}
            </p>
          )}
        </section>

        <section
          className="admin-section-enter space-y-3 sm:space-y-4"
          style={{ animationDelay: "280ms" }}
          aria-labelledby="recent-orders-heading"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="recent-orders-heading"
              className="font-display text-lg font-medium tracking-tight text-[#2c3d34] sm:text-xl md:text-2xl"
            >
              {t("adminRecentOrders")}
            </h2>
            <button
              type="button"
              onClick={() => onTabChange("orders")}
              className="inline-flex items-center gap-0.5 font-sans text-xs font-medium text-stone-600 underline-offset-[5px] transition-colors hover:text-[#2d4a3e] hover:underline sm:gap-1 sm:text-sm"
            >
              {t("adminViewAllOrders")}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-70 sm:h-4 sm:w-4 rtl:rotate-180" aria-hidden />
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-stone-200/50 bg-[#fefdfb] shadow-sm sm:rounded-2xl">
            {recent.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-500 sm:px-6 sm:py-10">
                {t("adminNoOrdersYet")}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-stone-200/55 md:hidden" aria-label={t("adminRecentOrders")}>
                  {recent.map((o) => (
                    <li key={o.id} className="px-3 py-3 sm:px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-sans text-xs font-medium text-[#3d342c]">
                            {o.customer_name?.trim() || "—"}
                          </p>
                          <p className="font-mono text-[10px] text-stone-500">#{o.id.slice(0, 8)}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-px text-[10px] font-medium capitalize",
                            adminOrderStatusPillClass(o.order_status),
                          )}
                        >
                          {adminOrderStatusLabel(o.order_status, t)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-stone-500">
                        <time dateTime={o.created_at}>{formatOrderDateDisplay(o.created_at, lang, true)}</time>
                        <span className="shrink-0 font-sans font-medium tabular-nums text-[#4a4238]">
                          ₪{Number(o.total_amount ?? 0).toFixed(2)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[36rem] border-collapse text-start">
                    <thead>
                      <tr className="border-b border-stone-200/60 bg-stone-100/40">
                        <th className="px-5 py-3 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminOrdersColRef")}
                        </th>
                        <th className="px-5 py-3 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminOrdersColCustomer")}
                        </th>
                        <th className="px-5 py-3 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminOrdersColStatus")}
                        </th>
                        <th className="px-5 py-3 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminOrdersColDate")}
                        </th>
                        <th className="px-5 py-3 text-end font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminOrdersColTotal")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((o) => (
                        <tr
                          key={o.id}
                          className="border-b border-stone-200/45 transition-colors last:border-0 even:bg-stone-50/35 hover:bg-stone-50/60"
                        >
                          <td className="px-5 py-3.5 font-mono text-xs text-stone-500">#{o.id.slice(0, 8)}</td>
                          <td className="px-5 py-3.5 font-sans text-sm font-medium text-[#3d342c]">
                            {o.customer_name?.trim() || "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                                adminOrderStatusPillClass(o.order_status),
                              )}
                            >
                              {adminOrderStatusLabel(o.order_status, t)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-sans text-sm text-stone-600">
                            {formatOrderDateDisplay(o.created_at, lang, true)}
                          </td>
                          <td className="px-5 py-3.5 text-end font-sans text-sm font-medium tabular-nums text-[#4a4238]">
                            ₪{Number(o.total_amount ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
