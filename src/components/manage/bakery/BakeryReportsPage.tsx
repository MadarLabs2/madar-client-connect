import { useCallback, useMemo, useState, type ReactNode } from "react";
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
import { ar, enUS, he } from "date-fns/locale";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBakeryDb } from "@/lib/bakery/db";
import { bakeryReportOrdersList } from "@/lib/project-db.functions";
import { useBakeryT } from "@/lib/bakery/i18n";
import { adminOrderStatusLabel } from "@/lib/bakery/adminLabels";
import { isCashOrder, isCreditCardOrder, isOrderCountedInRevenue, sumOrderRevenue } from "@/lib/bakery/orderPayment";

type BakeryReportsPageProps = { projectId: string };

type RangePreset = "7" | "30" | "90" | "month" | "custom";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

const ACCENT = "#1B4332";
const CHART_COLORS = [ACCENT, "hsl(36, 45%, 55%)", "hsl(200, 15%, 45%)", "hsl(140, 12%, 40%)", "hsl(0, 70%, 50%)", "hsl(28, 40%, 42%)", "hsl(210, 18%, 55%)"];

type ReportOrder = {
  id: string;
  user_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  created_at: string;
  total_amount?: number | string | null;
  subtotal?: number | string | null;
  delivery_fee?: number | string | null;
  order_status?: string | null;
  payment_method?: string | null;
};

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

function money(n: number, digits = 0) {
  return `₪${n.toLocaleString("he-IL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
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

export function BakeryReportsPage({ projectId }: BakeryReportsPageProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();
  const dateLocale = lang === "ar" ? ar : lang === "en" ? enUS : he;
  const reportOrdersFn = useServerFn(bakeryReportOrdersList);

  const ordersQ = useQuery({
    queryKey: ["bakery", projectId, "reports-orders"],
    queryFn: async () => {
      const res = await reportOrdersFn({ data: { projectId } });
      if (res.error) throw new Error(res.error);
      return (res.rows ?? []) as ReportOrder[];
    },
  });
  const productsQ = useQuery({
    queryKey: ["bakery", projectId, "reports-products"],
    queryFn: async () => {
      const res = await db.from("products").select("id", { head: true, count: "exact" });
      if (res.error) throw res.error;
      return res.count ?? 0;
    },
  });
  const customersQ = useQuery({
    queryKey: ["bakery", projectId, "reports-profiles"],
    queryFn: async () => {
      const res = await db.from("profiles").select("id, created_at").limit(500);
      if (res.error) throw res.error;
      return (res.data ?? []) as Array<{ id: string; created_at?: string | null }>;
    },
  });

  const orders = ordersQ.data ?? [];
  const productsCount = productsQ.data ?? 0;
  const customers = customersQ.data ?? [];

  const [preset, setPreset] = useState<RangePreset>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { start, end } = useMemo(() => getRange(preset, from, to), [preset, from, to]);

  const inRange = useMemo(
    () =>
      orders.filter((o) => {
        const time = new Date(o.created_at).getTime();
        return time >= start.getTime() && time <= end.getTime();
      }),
    [orders, start, end],
  );
  const counted = useMemo(() => inRange.filter((o) => isOrderCountedInRevenue(o)), [inRange]);
  const allTimeRevenue = useMemo(
    () => sumOrderRevenue(orders.filter((o) => isOrderCountedInRevenue(o))),
    [orders],
  );

  const metrics = useMemo(() => {
    const revenue = counted.reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const subtotal = counted.reduce((s, o) => s + Number(o.subtotal || 0), 0);
    const delivery = counted.reduce((s, o) => s + Number(o.delivery_fee || 0), 0);
    const cash = counted
      .filter((o) => isCashOrder(o))
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const card = counted
      .filter((o) => isCreditCardOrder(o))
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
    const count = counted.length;
    const cancelled = inRange.filter((o) => !isOrderCountedInRevenue(o)).length;
    const aov = count ? revenue / count : 0;
    return { revenue, subtotal, delivery, cash, card, count, cancelled, aov };
  }, [counted, inRange]);

  const newCustomers = useMemo(
    () =>
      customers.filter((c) => {
        if (!c.created_at) return false;
        const time = new Date(c.created_at).getTime();
        return time >= start.getTime() && time <= end.getTime();
      }).length,
    [customers, start, end],
  );

  const revenueByDay = useMemo(() => {
    const days = eachDayOfInterval({ start, end });
    const map = new Map<string, number>();
    for (const d of days) map.set(format(d, "yyyy-MM-dd"), 0);
    for (const o of counted) {
      const key = format(new Date(o.created_at), "yyyy-MM-dd");
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + Number(o.total_amount || 0));
    }
    return days.map((d) => ({
      label: format(d, "d MMM"),
      key: format(d, "yyyy-MM-dd"),
      revenue: map.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
  }, [counted, start, end]);

  const statusMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of ORDER_STATUSES) map.set(s, 0);
    for (const o of inRange) {
      const status = String(o.order_status ?? "");
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return ORDER_STATUSES.map((s) => ({
      status: s,
      name: adminOrderStatusLabel(s, t),
      value: map.get(s) ?? 0,
    })).filter((x) => x.value > 0);
  }, [inRange, t]);

  const topCustomers = useMemo(() => {
    const agg = new Map<string, { name: string; email: string; revenue: number; orders: number }>();
    for (const o of counted) {
      const key = o.user_id ?? `guest:${(o.customer_email || o.customer_name || o.id || "").toLowerCase()}`;
      const cur = agg.get(key) ?? {
        name: o.customer_name ?? "",
        email: o.customer_email ?? "",
        revenue: 0,
        orders: 0,
      };
      cur.revenue += Number(o.total_amount || 0);
      cur.orders += 1;
      agg.set(key, cur);
    }
    return [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [counted]);

  const periodLabel = `${format(start, "d MMM yyyy", { locale: dateLocale })} – ${format(end, "d MMM yyyy", { locale: dateLocale })}`;

  const handleDownload = useCallback(() => {
    try {
      const sections: { title: string; rows: string[][] }[] = [
        {
          title: t("adminReportSubtitle"),
          rows: [
            [t("adminReportDateRange"), `${format(start, "yyyy-MM-dd")} – ${format(end, "yyyy-MM-dd")}`],
            [t("adminReportRevenue"), money(metrics.revenue, 2)],
            [t("adminReportOrders"), String(metrics.count)],
            [t("adminReportAov"), metrics.count ? money(metrics.aov, 2) : "—"],
            [t("adminReportCancelled"), String(metrics.cancelled)],
            [t("adminReportSubtotal"), money(metrics.subtotal, 2)],
            [t("adminReportDelivery"), money(metrics.delivery, 2)],
            [t("adminReportCash"), money(metrics.cash, 2)],
            [t("adminReportCard"), money(metrics.card, 2)],
            [t("adminReportNewCustomers"), String(newCustomers)],
            [t("adminReportProducts"), String(productsCount)],
          ],
        },
        {
          title: t("adminReportOrders"),
          rows: [
            [
              "id",
              "status",
              "created_at",
              "payment_method",
              "subtotal",
              "delivery_fee",
              "total",
              "customer_name",
              "customer_email",
            ],
            ...inRange.map((o) => [
              o.id,
              o.order_status ?? "",
              o.created_at ?? "",
              o.payment_method ?? "",
              String(o.subtotal ?? ""),
              String(o.delivery_fee ?? ""),
              String(o.total_amount ?? ""),
              o.customer_name ?? "",
              o.customer_email ?? "",
            ]),
          ],
        },
        {
          title: t("adminReportTopCustomers"),
          rows: [
            ["name", "email", "orders", "revenue"],
            ...topCustomers.map((r) => [r.name, r.email, String(r.orders), money(r.revenue, 2)]),
          ],
        },
      ];
      const parts = sections.map((s) => `${s.title}\r\n${rowsToCsv(s.rows)}`).join("\r\n\r\n");
      download(`bakery-report_${format(start, "yyyy-MM-dd")}_${format(end, "yyyy-MM-dd")}.csv`, parts);
      toast.success(t("adminReportDownloadOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("adminReportDownloadFail"));
    }
  }, [inRange, metrics, newCustomers, productsCount, start, end, t, topCustomers]);

  const presets: { id: RangePreset; labelKey: string }[] = [
    { id: "7", labelKey: "adminReportPreset7" },
    { id: "30", labelKey: "adminReportPreset30" },
    { id: "90", labelKey: "adminReportPreset90" },
    { id: "month", labelKey: "adminReportPresetMonth" },
    { id: "custom", labelKey: "adminReportPresetCustom" },
  ];

  const loading = ordersQ.isLoading || productsQ.isLoading || customersQ.isLoading;

  return (
    <div className="admin-page-enter mx-auto max-w-6xl px-3 py-3 sm:px-4 sm:py-5 md:px-6 md:py-6 lg:max-w-[min(100%,80rem)]">
      <div className="space-y-5 rounded-2xl border border-stone-200/45 bg-gradient-to-b from-[#fffdfb] via-[#faf7f2] to-[#f3efe8] p-4 shadow-[0_1px_3px_rgba(60,42,33,0.06)] sm:space-y-7 sm:rounded-3xl sm:p-6 md:space-y-8 md:p-8">
        <header className="admin-header-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-display text-2xl font-medium tracking-[0.02em] text-[#2c3d34] sm:text-[1.65rem] md:text-[2.1rem]">
              {t("adminDashReportsTitle")}
            </h1>
            <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-stone-600 md:text-base">
              {t("adminReportSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-stone-200/90 bg-white/85 px-4 text-sm font-medium text-[#2c3d34] shadow-sm transition-colors hover:bg-white lg:w-auto"
          >
            <Download className="h-4 w-4" />
            {t("adminReportDownloadCsv")}
          </button>
        </header>

        <section className="rounded-2xl border border-stone-200/50 bg-gradient-to-b from-[#fefdfb] to-[#f5f1ea] p-4 shadow-[0_1px_2px_rgba(60,42,33,0.05)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-stone-500">
                {t("adminMetricRevenue")}
              </p>
              <p className="mt-1 font-sans text-xs text-stone-500">{t("adminReportSinceOpen")}</p>
              <p className="mt-2 font-display text-3xl font-medium tracking-tight text-[#2c3d34] sm:text-4xl">
                <span className="tabular-nums" dir="ltr">
                  {ordersQ.isLoading ? "…" : money(allTimeRevenue, 2)}
                </span>
              </p>
            </div>
            <p className="font-sans text-sm text-stone-600">{periodLabel}</p>
          </div>

          <p className="mt-5 font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-stone-500">
            {t("adminReportDateRange")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm",
                  preset === p.id
                    ? "bg-[#1B4332] text-white shadow-sm"
                    : "border border-stone-200/90 bg-[#faf8f4] text-stone-800 hover:bg-stone-100",
                )}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 font-sans text-xs text-stone-600">
                {t("adminReportFrom")}
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 rounded-full border border-stone-200/90 bg-white px-3 text-sm text-stone-800"
                />
              </label>
              <label className="flex flex-col gap-1 font-sans text-xs text-stone-600">
                {t("adminReportTo")}
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 rounded-full border border-stone-200/90 bg-white px-3 text-sm text-stone-800"
                />
              </label>
            </div>
          )}
        </section>

        {ordersQ.error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("adminReportLoadError")}
          </p>
        ) : loading ? (
          <p className="font-sans text-sm text-stone-500">{t("loading")}</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
              <Kpi label={t("adminReportRevenue")} value={money(metrics.revenue)} />
              <Kpi label={t("adminReportOrders")} value={String(metrics.count)} />
              <Kpi label={t("adminReportAov")} value={metrics.count ? money(metrics.aov) : "—"} />
              <Kpi label={t("adminReportCancelled")} value={String(metrics.cancelled)} />
              <Kpi label={t("adminReportNewCustomers")} value={String(newCustomers)} />
              <Kpi label={t("adminReportProducts")} value={String(productsCount)} />
            </section>

            <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <Kpi label={t("adminReportSubtotal")} value={money(metrics.subtotal, 2)} />
              <Kpi label={t("adminReportDelivery")} value={money(metrics.delivery, 2)} />
              <Kpi label={t("adminReportCash")} value={money(metrics.cash, 2)} />
              <Kpi label={t("adminReportCard")} value={money(metrics.card, 2)} />
            </section>

            <section className="grid min-w-0 gap-3 lg:grid-cols-2">
              <Panel title={t("adminReportRevenueByDay")}>
                {revenueByDay.every((d) => d.revenue === 0) ? (
                  <Empty>{t("adminReportNoData")}</Empty>
                ) : (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueByDay}>
                        <defs>
                          <linearGradient id="bakeryRevFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e0d6" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} />
                        <YAxis tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 10, fill: "#78716c" }} width={52} />
                        <Tooltip
                          formatter={(value) => [money(Number(value), 2), t("adminReportRevenue")]}
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0] as { payload?: { key?: string } } | undefined;
                            return row?.payload?.key ?? "";
                          }}
                          contentStyle={{ borderRadius: 12, border: "1px solid #e7e0d6", fontSize: 12 }}
                        />
                        <Area type="monotone" dataKey="revenue" stroke={ACCENT} fill="url(#bakeryRevFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>

              <Panel title={t("adminReportStatusMix")}>
                {statusMix.length === 0 ? (
                  <Empty>{t("adminReportNoData")}</Empty>
                ) : (
                  <>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                            {statusMix.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value, _name, item) => {
                              const row = item as { payload?: { name?: string } } | undefined;
                              return [value, row?.payload?.name ?? ""];
                            }}
                            contentStyle={{ borderRadius: 12, border: "1px solid #e7e0d6", fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 font-sans text-xs text-stone-700">
                      {statusMix.map((s, i) => (
                        <div key={s.status} className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span>{s.name}</span>
                          <span className="text-stone-500">({s.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Panel>
            </section>

            <Panel title={t("adminReportTopCustomers")}>
              {topCustomers.length === 0 ? (
                <Empty>{t("adminReportNoData")}</Empty>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] border-collapse text-start">
                    <thead>
                      <tr className="border-b border-stone-200/60">
                        <th className="px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminReportCustomer")}
                        </th>
                        <th className="px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminReportEmail")}
                        </th>
                        <th className="px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminReportOrders")}
                        </th>
                        <th className="px-3 py-2 font-sans text-[11px] font-medium uppercase tracking-wider text-stone-500">
                          {t("adminReportRevenue")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((r, i) => (
                        <tr key={i} className="border-b border-stone-200/45 last:border-0">
                          <td className="px-3 py-3 font-sans text-sm text-[#3d342c]">{r.name || "—"}</td>
                          <td className="px-3 py-3 font-sans text-sm text-stone-600" dir="ltr">{r.email || "—"}</td>
                          <td className="px-3 py-3 font-sans text-sm tabular-nums text-stone-700">{r.orders}</td>
                          <td className="px-3 py-3 font-sans text-sm font-medium tabular-nums text-[#4a4238]" dir="ltr">
                            {money(r.revenue, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-stone-200/50 bg-[#fefdfb] p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 border-b border-stone-200/50 pb-2 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center font-sans text-sm text-stone-500">{children}</div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-stone-200/50 bg-gradient-to-b from-[#fefdfb] to-[#f5f1ea] p-3.5 shadow-[0_1px_2px_rgba(60,42,33,0.05)] sm:p-5">
      <p className="font-sans text-[10px] font-medium uppercase leading-tight tracking-[0.12em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-lg font-medium tracking-tight text-[#4a4238] sm:text-2xl">
        <span className="tabular-nums" dir="ltr">
          {value}
        </span>
      </p>
    </div>
  );
}
