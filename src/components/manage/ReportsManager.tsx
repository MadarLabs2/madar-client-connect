import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  eachDayOfInterval,
  endOfDay,
  format,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { projectList, ecommerceOrdersList } from "@/lib/project-db.functions";
import { ECOMMERCE_ORDER_STATUSES } from "@/lib/ecommerce/orders";
import { cn } from "@/lib/utils";
import { useEcommerceTheme } from "@/lib/ecommerce/EcommerceThemeContext";
import { formatEcommerceDateTime, formatEcommerceMoney, formatEcommerceNumber, useEcommerceOrderLabels, useEcommerceT } from "@/lib/ecommerce/i18n";

type RangePreset = "7" | "30" | "90" | "month" | "custom";

const ORDER_STATUSES = ECOMMERCE_ORDER_STATUSES;
function statusColors(accent: string) {
  return [accent, "hsl(36, 45%, 55%)", "hsl(200, 15%, 45%)", "hsl(140, 12%, 40%)", "hsl(0, 70%, 50%)"];
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(d.getTime()) ? null : d;
}

function getRange(preset: RangePreset, from: string, to: string) {
  const now = new Date();
  const endDefault = endOfDay(now);
  if (preset === "7") return { start: startOfDay(subDays(now, 6)), end: endDefault };
  if (preset === "30") return { start: startOfDay(subDays(now, 29)), end: endDefault };
  if (preset === "90") return { start: startOfDay(subDays(now, 89)), end: endDefault };
  if (preset === "month") return { start: startOfMonth(now), end: endDefault };
  const f = parseDateInput(from);
  const tt = parseDateInput(to);
  let s = f ? startOfDay(f) : startOfDay(subDays(now, 29));
  let e = tt ? endOfDay(tt) : endDefault;
  if (s > e) [s, e] = [startOfDay(e), endOfDay(s)];
  return { start: s, end: e };
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function rowsToCsv(rows: string[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}
function download(filename: string, body: string) {
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsManager({ projectId }: { projectId: string }) {
  const { t, lang } = useEcommerceT();
  const { statusLabel } = useEcommerceOrderLabels();
  const { preset: accentPreset } = useEcommerceTheme();
  const accent = accentPreset.swatch;
  const chartColors = statusColors(accent);
  const listFn = useServerFn(projectList);
  const ordersListFn = useServerFn(ecommerceOrdersList);

  const { data: ordersRes, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["ecommerce", projectId, "orders", "all"],
    queryFn: () => ordersListFn({ data: { projectId, limit: 500 } }),
  });
  const { data: productsRes, isLoading: productsLoading } = useQuery({
    queryKey: ["pdb", projectId, "products"],
    queryFn: () => listFn({ data: { projectId, table: "products", limit: 500 } }),
  });
  const { data: customersRes, isLoading: customersLoading } = useQuery({
    queryKey: ["pdb", projectId, "profiles"],
    queryFn: () => listFn({ data: { projectId, table: "profiles", limit: 500 } }),
  });

  const orders: any[] = ordersRes?.rows ?? [];
  const products: any[] = productsRes?.rows ?? [];
  const customers: any[] = customersRes?.rows ?? [];

  const [preset, setPreset] = useState<RangePreset>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { start, end } = useMemo(() => getRange(preset, from, to), [preset, from, to]);

  const inRange = useMemo(
    () =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }),
    [orders, start, end]
  );
  const nonCancelled = useMemo(() => inRange.filter((o) => o.status !== "cancelled"), [inRange]);

  const metrics = useMemo(() => {
    const revenue = nonCancelled.reduce((s, o) => s + Number(o.total || 0), 0);
    const subtotal = nonCancelled.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const shipping = nonCancelled.reduce((s, o) => s + Number(o.shipping_fee || 0), 0);
    const count = nonCancelled.length;
    const cancelled = inRange.filter((o) => o.status === "cancelled").length;
    const aov = count ? revenue / count : 0;
    return { revenue, subtotal, shipping, count, cancelled, aov };
  }, [nonCancelled, inRange]);

  const newCustomers = useMemo(
    () =>
      customers.filter((c) => {
        const t = new Date(c.created_at).getTime();
        return t >= start.getTime() && t <= end.getTime();
      }).length,
    [customers, start, end]
  );

  const revenueByDay = useMemo(() => {
    const days = eachDayOfInterval({ start, end });
    const map = new Map<string, number>();
    for (const d of days) map.set(format(d, "yyyy-MM-dd"), 0);
    for (const o of nonCancelled) {
      const key = format(new Date(o.created_at), "yyyy-MM-dd");
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + Number(o.total || 0));
    }
    return days.map((d) => ({
      label: format(d, "d MMM"),
      key: format(d, "yyyy-MM-dd"),
      revenue: map.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
  }, [nonCancelled, start, end]);

  const statusMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of ORDER_STATUSES) map.set(s, 0);
    for (const o of inRange) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return ORDER_STATUSES.map((s) => ({
      status: s,
      name: statusLabel(s),
      value: map.get(s) ?? 0,
    })).filter((x) => x.value > 0);
  }, [inRange, statusLabel]);

  const topCustomers = useMemo(() => {
    const agg = new Map<string, { name: string; email: string; revenue: number; orders: number }>();
    for (const o of nonCancelled) {
      const key = o.user_id ?? `guest:${(o.customer_email || o.customer_name || o.id || "").toLowerCase()}`;
      const cur = agg.get(key) ?? {
        name: o.customer_name ?? "",
        email: o.customer_email ?? "",
        revenue: 0,
        orders: 0,
      };
      cur.revenue += Number(o.total || 0);
      cur.orders += 1;
      agg.set(key, cur);
    }
    return [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [nonCancelled]);

  const money = useMemo(
    () => (n: number) => formatEcommerceMoney(n, lang, { maximumFractionDigits: 0 }),
    [lang],
  );
  const moneyDetailed = useMemo(
    () => (n: number) =>
      formatEcommerceMoney(n, lang, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [lang],
  );
  const formatCount = (n: number) => formatEcommerceNumber(n, lang);

  const periodLabel = `${format(start, "d MMM yyyy")} — ${format(end, "d MMM yyyy")}`;

  const handleDownload = useCallback(() => {
    try {
      const sections: { title: string; rows: string[][] }[] = [
        {
          title: t("csv.summary"),
          rows: [
            [t("csv.range"), `${format(start, "yyyy-MM-dd")} – ${format(end, "yyyy-MM-dd")}`],
            [t("csv.ordersInRange"), formatCount(inRange.length)],
            [t("csv.revenue"), moneyDetailed(metrics.revenue)],
            [t("csv.ordersNonCancelled"), formatCount(metrics.count)],
            [t("csv.aov"), metrics.count ? moneyDetailed(metrics.aov) : "—"],
            [t("csv.cancelled"), formatCount(metrics.cancelled)],
            [t("csv.subtotal"), moneyDetailed(metrics.subtotal)],
            [t("csv.shipping"), moneyDetailed(metrics.shipping)],
            [t("csv.newCustomers"), formatCount(newCustomers)],
            [t("csv.products"), formatCount(products.length)],
          ],
        },
        {
          title: t("csv.ordersSection"),
          rows: [
            ["id", "order_number", "status", "created_at", "subtotal", "shipping_fee", "total", "customer_name", "customer_email"],
            ...inRange.map((o) => [
              o.id,
              o.order_number ?? "",
              o.status ?? "",
              o.created_at ?? "",
              String(o.subtotal ?? ""),
              String(o.shipping_fee ?? ""),
              String(o.total ?? ""),
              o.customer_name ?? "",
              o.customer_email ?? "",
            ]),
          ],
        },
        {
          title: t("csv.topCustomersSection"),
          rows: [
            ["name", "email", "orders", "revenue"],
            ...topCustomers.map((r) => [r.name, r.email, formatCount(r.orders), moneyDetailed(r.revenue)]),
          ],
        },
      ];
      const parts = sections.map((s) => `${s.title}\r\n${rowsToCsv(s.rows)}`).join("\r\n\r\n");
      download(`sales-report_${format(start, "yyyy-MM-dd")}_${format(end, "yyyy-MM-dd")}.csv`, parts);
      toast.success(t("downloadSuccess"));
    } catch (e: any) {
      toast.error(e.message || t("downloadError"));
    }
  }, [inRange, metrics, moneyDetailed, newCustomers, products.length, start, end, topCustomers, t]);

  const presets: { id: RangePreset; labelKey: string }[] = [
    { id: "7", labelKey: "preset.7" },
    { id: "30", labelKey: "preset.30" },
    { id: "90", labelKey: "preset.90" },
    { id: "month", labelKey: "preset.month" },
    { id: "custom", labelKey: "preset.custom" },
  ];

  const loading = ordersLoading || productsLoading || customersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{t("reportsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("reportsSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{periodLabel}</span>
          <Button onClick={handleDownload} variant="outline">
            <Download className="ml-1.5 h-4 w-4" />
            {t("downloadCsv")}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("dateRange")}
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors",
                preset === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-transparent text-foreground hover:bg-muted"
              )}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              {t("fromDate")}
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              {t("toDate")}
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
          </div>
        )}
      </Card>

      {ordersError ? (
        <Card className="p-4 text-sm text-destructive">{t("loadOrdersError")}</Card>
      ) : loading ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("loading")}</Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label={t("revenue")} value={money(metrics.revenue)} />
            <Kpi label={t("ordersKpi")} value={formatCount(metrics.count)} />
            <Kpi label={t("aov")} value={metrics.count ? money(metrics.aov) : "—"} />
            <Kpi label={t("cancelled")} value={formatCount(metrics.cancelled)} />
            <Kpi label={t("newCustomers")} value={formatCount(newCustomers)} />
            <Kpi label={t("reportsProducts")} value={formatCount(products.length)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Kpi label={t("reportsSubtotal")} value={moneyDetailed(metrics.subtotal)} />
            <Kpi label={t("reportsShipping")} value={moneyDetailed(metrics.shipping)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("revenueByDay")}
              </div>
              {revenueByDay.every((d) => d.revenue === 0) ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  {t("noDataInRange")}
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueByDay}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 11 }} width={64} />
                      <Tooltip
                        formatter={(value: any) => [moneyDetailed(Number(value)), t("revenue")]}
                        labelFormatter={(_, payload: any) => payload?.[0]?.payload?.key ?? ""}
                        contentStyle={{ borderRadius: 6, border: "1px solid hsl(0,0%,90%)", fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke={accent} fill="url(#revFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("statusDistribution")}
              </div>
              {statusMix.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  {t("noDataInRange")}
                </div>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                          {statusMix.map((_, i) => (
                            <Cell key={i} fill={chartColors[i % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, _n: any, item: any) => [value, item.payload.name]}
                          contentStyle={{ borderRadius: 6, border: "1px solid hsl(0,0%,90%)", fontSize: 12 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {statusMix.map((s, i) => (
                      <div key={s.status} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ background: chartColors[i % chartColors.length] }}
                        />
                        <span>{s.name}</span>
                        <span className="text-muted-foreground">({s.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("topCustomers")}
            </div>
            {topCustomers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">{t("reportsCustomer")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("reportsEmail")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("reportsOrders")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("reportsRevenue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2 text-right">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-right">{r.email || "—"}</td>
                        <td className="px-3 py-2 text-right">{formatCount(r.orders)}</td>
                        <td className="px-3 py-2 text-right">{moneyDetailed(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </Card>
  );
}
