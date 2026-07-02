import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Bell,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import { ecommerceOrdersList, projectCount, projectList } from "@/lib/project-db.functions";
import { formatEcommerceDateTime, formatEcommerceMoney, formatEcommerceNumber, useEcommerceOrderLabels, useEcommerceT } from "@/lib/ecommerce/i18n";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  customer_name: string;
};

type EcommerceDashboardProps = {
  projectId: string;
  projectName: string;
  onTabChange: (tab: string) => void;
};

const QUICK_TILES = [
  { tab: "products", labelKey: "quickProducts", descKey: "quickProductsDesc", icon: Package },
  { tab: "categories", labelKey: "quickCategories", descKey: "quickCategoriesDesc", icon: Tags },
  { tab: "orders", labelKey: "quickOrders", descKey: "quickOrdersDesc", icon: ShoppingCart },
  { tab: "customers", labelKey: "quickCustomers", descKey: "quickCustomersDesc", icon: Users },
  { tab: "reports", labelKey: "quickReports", descKey: "quickReportsDesc", icon: BarChart3 },
  { tab: "coupons", labelKey: "quickCoupons", descKey: "quickCouponsDesc", icon: Ticket },
  { tab: "notifications", labelKey: "quickNotifications", descKey: "quickNotificationsDesc", icon: Bell },
  { tab: "settings", labelKey: "quickSettings", descKey: "quickSettingsDesc", icon: Settings },
] as const;

function KpiCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border-border/70 bg-background p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function EcommerceDashboard({
  projectId,
  projectName,
  onTabChange,
}: EcommerceDashboardProps) {
  const { t, lang } = useEcommerceT();
  const { statusLabel } = useEcommerceOrderLabels();
  const ordersFn = useServerFn(ecommerceOrdersList);
  const countFn = useServerFn(projectCount);
  const listFn = useServerFn(projectList);

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ["ecommerce", projectId, "orders", "dashboard"],
    queryFn: () => ordersFn({ data: { projectId, limit: 500 } }),
    refetchInterval: 15000,
  });

  const { data: productsRes } = useQuery({
    queryKey: ["pdb", projectId, "products", "exact-count"],
    queryFn: () => countFn({ data: { projectId, table: "products" } }),
  });

  const { data: customersRes } = useQuery({
    queryKey: ["pdb", projectId, "profiles", "count"],
    queryFn: () => listFn({ data: { projectId, table: "profiles", limit: 500 } }),
  });

  const orders: OrderRow[] = useMemo(() => {
    const rows: any[] = ordersRes?.rows ?? [];
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      order_number: String(r.order_number ?? r.id ?? ""),
      status: String(r.status ?? ""),
      total: Number(r.total ?? 0),
      created_at: String(r.created_at ?? ""),
      customer_name: String(r.customer_name ?? ""),
    }));
  }, [ordersRes]);

  const metrics = useMemo(() => {
    const nonCancelled = orders.filter((o) => o.status !== "cancelled");
    const totalRevenue = nonCancelled.reduce((s, o) => s + o.total, 0);
    const customerRows: any[] = customersRes?.rows ?? [];
    const customers = customerRows.filter((c) => String(c.role ?? "customer") === "customer").length;

    return {
      totalRevenue,
      totalOrders: orders.length,
      customers,
      products: productsRes?.count ?? 0,
    };
  }, [orders, customersRes, productsRes]);

  const recent = orders.slice(0, 6);

  const money = (n: number) =>
    formatEcommerceMoney(n, lang, { maximumFractionDigits: 0 });
  const formatCount = (n: number) => formatEcommerceNumber(n, lang);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-border/60 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {t("dashboardKicker")}
          </p>
          <h1 className="mt-3 font-display text-3xl font-medium tracking-tight">{projectName}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("dashboardSubtitle")}
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {t("mainMetrics")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard
            label={t("totalRevenue")}
            value={ordersLoading ? "…" : money(metrics.totalRevenue)}
            hint={t("totalRevenueHint")}
          />
          <KpiCard
            label={t("totalOrders")}
            value={ordersLoading ? "…" : formatCount(metrics.totalOrders)}
            hint={t("totalOrdersHint")}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {t("inventoryCustomers")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard label={t("products")} value={formatCount(metrics.products)} />
          <KpiCard label={t("registeredCustomers")} value={formatCount(metrics.customers)} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {t("recentOrders")}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => onTabChange("orders")}>
            {t("allOrders")}
          </Button>
        </div>
        <Card className="overflow-hidden border-border/70 bg-background">
          {ordersLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>
          ) : recent.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">{t("noOrdersYet")}</div>
          ) : (
            <div className="divide-y divide-border/70">
              {recent.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onTabChange("orders")}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-start transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {o.order_number}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium">{o.customer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.created_at ? formatEcommerceDateTime(o.created_at, lang) : "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-medium tabular-nums">{money(o.total)}</p>
                    <p className="text-xs text-muted-foreground">{statusLabel(o.status)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {t("quickManage")}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.tab}
                type="button"
                onClick={() => onTabChange(tile.tab)}
                className="group relative aspect-square overflow-hidden border border-border/70 bg-muted/30 text-start transition-colors hover:border-primary/30 hover:bg-muted/50"
              >
                <div className="absolute inset-0 bg-primary/[0.03] transition-colors group-hover:bg-primary/[0.06]" />
                <div className="relative flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.12em]">
                    {t(tile.labelKey)}
                  </span>
                  <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {t(tile.descKey)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
