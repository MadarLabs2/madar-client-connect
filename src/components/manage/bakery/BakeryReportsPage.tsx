import { useEffect, useState } from "react";
import { Package, ShoppingCart, Star, TrendingUp } from "lucide-react";
import { OrderRefAndDate } from "@/components/manage/bakery/OrderRefAndDate";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import { adminOrderStatusLabel } from "@/lib/bakery/adminLabels";

type BakeryReportsPageProps = { projectId: string };

type ReportOrder = {
  id: string;
  customer_name: string | null;
  created_at: string;
  total_amount: number | string | null;
  order_status: string;
};

export function BakeryReportsPage({ projectId }: BakeryReportsPageProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();
  const [stats, setStats] = useState({ orders: 0, products: 0, bestSellers: 0, revenue: 0 });
  const [recent, setRecent] = useState<ReportOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [o, p, b, totals, r] = await Promise.all([
        db.from("orders").select("id", { head: true, count: "exact" }),
        db.from("products").select("id", { head: true, count: "exact" }),
        db.from("products").select("id", { head: true, count: "exact" }).eq("is_best_seller", true),
        db.from("orders").select("total_amount").limit(5000),
        db
          .from("orders")
          .select("id, customer_name, order_status, created_at, total_amount")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (cancelled) return;
      const revenue = ((totals.data ?? []) as Array<{ total_amount?: number | string | null }>).reduce(
        (s, x) => s + Number(x.total_amount ?? 0),
        0,
      );
      setStats({
        orders: o.count ?? 0,
        products: p.count ?? 0,
        bestSellers: b.count ?? 0,
        revenue,
      });
      setRecent((r.data ?? []) as ReportOrder[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const metricSquares = [
    { titleKey: "adminMetricRevenue" as const, value: `₪${stats.revenue.toFixed(2)}`, icon: TrendingUp },
    { titleKey: "adminMetricBestSellers" as const, value: stats.bestSellers, icon: Star },
    { titleKey: "adminMetricTotalProducts" as const, value: stats.products, icon: Package },
    { titleKey: "adminMetricTotalOrders" as const, value: stats.orders, icon: ShoppingCart },
  ];

  return (
    <div className="admin-page-enter mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-8">
      <h1 className="admin-header-enter font-display text-2xl font-bold tracking-tight text-[#1B4332] sm:text-3xl">
        {t("adminDashReportsTitle")}
      </h1>

      <section className="space-y-4" aria-labelledby="reports-metric-heading">
        <h2 id="reports-metric-heading" className="sr-only">
          {t("adminMetricsOverviewSr")}
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="admin-list-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metricSquares.map((c) => (
              <div
                key={c.titleKey}
                className="flex aspect-square min-h-0 min-w-0 flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <c.icon className="h-6 w-6 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0 text-end text-sm leading-snug text-muted-foreground">
                    {t(c.titleKey)}
                  </span>
                </div>
                <div className="min-w-0 pt-2 text-end font-display text-2xl font-bold tabular-nums leading-tight sm:text-3xl">
                  {c.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div
        className="admin-section-enter rounded-2xl border border-border bg-card p-6 shadow-sm"
        style={{ animationDelay: "240ms" }}
      >
        <h2 className="mb-4 font-display text-xl font-bold">{t("adminRecentOrders")}</h2>
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("adminNoOrdersYet")}</p>
          ) : (
            recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <div>
                  <div className="font-medium">{o.customer_name?.trim() || "—"}</div>
                  <OrderRefAndDate orderId={o.id} createdAt={o.created_at} lang={lang} className="text-xs" />
                </div>
                <div className="text-right">
                  <div className="font-semibold">₪{Number(o.total_amount ?? 0).toFixed(2)}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {adminOrderStatusLabel(o.order_status, t)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
