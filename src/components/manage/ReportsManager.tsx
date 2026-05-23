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
import { projectList } from "@/lib/project-db.functions";
import { cn } from "@/lib/utils";

type RangePreset = "7" | "30" | "90" | "month" | "custom";

const ORDER_STATUSES = ["received", "processing", "shipped", "delivered", "cancelled"] as const;
const STATUS_LABELS: Record<string, string> = {
  received: "התקבלה",
  processing: "בטיפול",
  shipped: "נשלחה",
  delivered: "נמסרה",
  cancelled: "בוטלה",
};
const STATUS_COLORS = [
  "hsl(0, 0%, 20%)",
  "hsl(36, 45%, 55%)",
  "hsl(200, 15%, 45%)",
  "hsl(140, 12%, 40%)",
  "hsl(0, 70%, 50%)",
];

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
  const listFn = useServerFn(projectList);

  const { data: ordersRes, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["pdb", projectId, "orders"],
    queryFn: () => listFn({ data: { projectId, table: "orders", limit: 500 } }),
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
      name: STATUS_LABELS[s] ?? s,
      value: map.get(s) ?? 0,
    })).filter((x) => x.value > 0);
  }, [inRange]);

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
    () => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }),
    []
  );
  const moneyDetailed = useMemo(
    () => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    []
  );

  const periodLabel = `${format(start, "d MMM yyyy")} — ${format(end, "d MMM yyyy")}`;

  const handleDownload = useCallback(() => {
    try {
      const sections: { title: string; rows: string[][] }[] = [
        {
          title: "סיכום",
          rows: [
            ["טווח", `${format(start, "yyyy-MM-dd")} – ${format(end, "yyyy-MM-dd")}`],
            ["הזמנות בטווח", String(inRange.length)],
            ["הכנסות", moneyDetailed.format(metrics.revenue)],
            ["הזמנות (לא מבוטלות)", String(metrics.count)],
            ["AOV", metrics.count ? moneyDetailed.format(metrics.aov) : "—"],
            ["בוטלו", String(metrics.cancelled)],
            ["סכום ביניים", moneyDetailed.format(metrics.subtotal)],
            ["משלוחים", moneyDetailed.format(metrics.shipping)],
            ["לקוחות חדשים", String(newCustomers)],
            ["מוצרים", String(products.length)],
          ],
        },
        {
          title: "הזמנות",
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
          title: "לקוחות מובילים",
          rows: [
            ["name", "email", "orders", "revenue"],
            ...topCustomers.map((r) => [r.name, r.email, String(r.orders), moneyDetailed.format(r.revenue)]),
          ],
        },
      ];
      const parts = sections.map((s) => `${s.title}\r\n${rowsToCsv(s.rows)}`).join("\r\n\r\n");
      download(`sales-report_${format(start, "yyyy-MM-dd")}_${format(end, "yyyy-MM-dd")}.csv`, parts);
      toast.success("הדוח הורד");
    } catch (e: any) {
      toast.error(e.message || "שגיאה בהורדה");
    }
  }, [inRange, metrics, moneyDetailed, newCustomers, products.length, start, end, topCustomers]);

  const presets: { id: RangePreset; label: string }[] = [
    { id: "7", label: "7 ימים" },
    { id: "30", label: "30 ימים" },
    { id: "90", label: "90 ימים" },
    { id: "month", label: "החודש" },
    { id: "custom", label: "מותאם" },
  ];

  const loading = ordersLoading || productsLoading || customersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">דוחות</h1>
          <p className="text-sm text-muted-foreground">סקירת מכירות, סטטוסים ולקוחות</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{periodLabel}</span>
          <Button onClick={handleDownload} variant="outline">
            <Download className="ml-1.5 h-4 w-4" />
            הורד CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">טווח תאריכים</div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition-colors",
                preset === p.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              מתאריך
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              עד
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
        <Card className="p-4 text-sm text-destructive">שגיאה בטעינת הזמנות</Card>
      ) : loading ? (
        <Card className="p-6 text-sm text-muted-foreground">טוען…</Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="הכנסות" value={money.format(metrics.revenue)} />
            <Kpi label="הזמנות" value={String(metrics.count)} />
            <Kpi label="AOV" value={metrics.count ? money.format(metrics.aov) : "—"} />
            <Kpi label="בוטלו" value={String(metrics.cancelled)} />
            <Kpi label="לקוחות חדשים" value={String(newCustomers)} />
            <Kpi label="מוצרים" value={String(products.length)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Kpi label="סכום ביניים" value={moneyDetailed.format(metrics.subtotal)} />
            <Kpi label="משלוחים" value={moneyDetailed.format(metrics.shipping)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                הכנסות לפי יום
              </div>
              {revenueByDay.every((d) => d.revenue === 0) ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  אין נתונים בטווח זה
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueByDay}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(36, 45%, 55%)" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="hsl(36, 45%, 55%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,90%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => money.format(Number(v))} tick={{ fontSize: 11 }} width={64} />
                      <Tooltip
                        formatter={(value: any) => [moneyDetailed.format(Number(value)), "הכנסות"]}
                        labelFormatter={(_, payload: any) => payload?.[0]?.payload?.key ?? ""}
                        contentStyle={{ borderRadius: 6, border: "1px solid hsl(0,0%,90%)", fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(36, 45%, 45%)" fill="url(#revFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="p-4">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                התפלגות סטטוסים
              </div>
              {statusMix.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  אין נתונים בטווח זה
                </div>
              ) : (
                <>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusMix} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                          {statusMix.map((_, i) => (
                            <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
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
                          style={{ background: STATUS_COLORS[i % STATUS_COLORS.length] }}
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
              לקוחות מובילים
            </div>
            {topCustomers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">אין נתונים</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right font-medium">לקוח</th>
                      <th className="px-3 py-2 text-right font-medium">אימייל</th>
                      <th className="px-3 py-2 text-right font-medium">הזמנות</th>
                      <th className="px-3 py-2 text-right font-medium">הכנסות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2 text-right">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-right">{r.email || "—"}</td>
                        <td className="px-3 py-2 text-right">{r.orders}</td>
                        <td className="px-3 py-2 text-right">{moneyDetailed.format(r.revenue)}</td>
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
