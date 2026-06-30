import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { isSameDay, subDays } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChefHat,
  Clock,
  Filter,
  Package,
  ShoppingBag,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { BAKERY_PICKUP_ADDRESS } from "@/lib/bakery/checkoutDelivery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import type { Lang } from "@/lib/i18n";
import { formatOrderDate, formatOrderDateDisplay } from "@/lib/bakery/formatDate";
import { adminOrderStatusLabel, adminOrderStatusPillClass } from "@/lib/bakery/adminLabels";
import { resolveImage } from "@/lib/bakery/utils";
import {
  buildScheduleDateOptions,
  enabledDaysFromMap,
  fetchFulfillmentDays,
  mergeOpenScheduleDates,
  rowsToWeekdayMap,
  type ScheduleDateOption,
} from "@/lib/bakery/fulfillmentDays";
import { WEEKDAY_DICT_KEYS } from "@/lib/bakery/fulfillmentDays-i18n";
import { fetchAdminRestDays } from "@/lib/bakery/restDays";
import { cn } from "@/lib/utils";
import { isOrderVisibleInAdmin } from "@/lib/bakery/orderPayment";
import { fulfillmentLabelFromOrder } from "@/lib/bakery/fulfillmentLabel";
import { sendOrderStatusEmailFn } from "@/lib/bakery/sendOrderStatusEmail.functions";
import { useAuth } from "@/lib/auth";
import { useBakeryPendingOrders } from "@/components/manage/bakery/BakeryPendingOrdersContext";

type BakeryOrdersPageProps = { projectId: string };

const brandLogo = "/bakery/BakeryLogo.png";

type Translate = (key: string) => string;

const STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

type TabId = "all" | "new" | "preparing" | "ready" | "completed" | "cancelled";

const TABS: { id: TabId; labelKey: string; match: (status: string) => boolean }[] = [
  { id: "all", labelKey: "adminOrdersTabAll", match: () => true },
  {
    id: "new",
    labelKey: "adminOrdersTabNew",
    match: (s) => s === "pending" || s === "confirmed",
  },
  { id: "preparing", labelKey: "adminOrdersTabPreparing", match: (s) => s === "preparing" },
  {
    id: "ready",
    labelKey: "adminOrdersTabReady",
    match: (s) => s === "ready" || s === "out_for_delivery",
  },
  { id: "completed", labelKey: "adminOrdersTabCompleted", match: (s) => s === "completed" },
  { id: "cancelled", labelKey: "adminOrdersTabCancelled", match: (s) => s === "cancelled" },
];

type OrderRow = Record<string, unknown> & {
  id: string;
  order_status?: string;
  created_at?: string;
  items?: unknown[];
  order_items?: unknown[];
};

function normalizeOrderItem(raw: unknown): Record<string, unknown> {
  const item = raw as Record<string, unknown>;
  const productRel = item.products ?? item.product;
  const productRow = Array.isArray(productRel)
    ? (productRel[0] as Record<string, unknown> | undefined)
    : (productRel as Record<string, unknown> | null | undefined);
  const imageUrl = item.image_url ?? productRow?.image_url ?? null;
  return {
    ...item,
    product: productRow ?? (imageUrl ? { image_url: imageUrl } : undefined),
  };
}

function normalizeOrders(rows: OrderRow[]): OrderRow[] {
  return rows
    .filter((o) => isOrderVisibleInAdmin(o))
    .map((o) => {
      const rawItems = Array.isArray(o.order_items)
        ? o.order_items
        : Array.isArray(o.items)
          ? o.items
          : [];
      return {
        ...o,
        id: String(o.id),
        items: rawItems.map(normalizeOrderItem),
      };
    });
}

function deliveryLabel(raw: string | null | undefined, t: Translate) {
  const k = String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (k === "pickup") return t("adminOrderFulfillmentPickup");
  if (k === "delivery") return t("adminOrderFulfillmentDelivery");
  return raw ? String(raw).replace(/_/g, " ") : "—";
}

function isPickupOrder(method: string | null | undefined) {
  return String(method ?? "").toLowerCase() === "pickup";
}

function paymentLabel(raw: string | null | undefined, t: Translate) {
  const k = String(raw ?? "").toLowerCase();
  if (k === "cash") return t("cash");
  if (k === "credit_card" || k === "creditcard") return t("creditCard");
  return raw ? String(raw).replace(/_/g, " ") : "—";
}

function orderMatchesTab(orderStatus: string, tab: TabId): boolean {
  const def = TABS.find((x) => x.id === tab);
  return def ? def.match(orderStatus) : true;
}

function tabCount(orders: OrderRow[], tab: TabId): number {
  return orders.filter((o) => orderMatchesTab(String(o.order_status), tab)).length;
}

function dayBucket(orders: OrderRow[], day: Date) {
  return orders.filter((o) => o.created_at && isSameDay(new Date(o.created_at), day));
}

function orderFulfillmentIso(order: OrderRow): string | null {
  const fulfillment = String(order.selected_fulfillment_date ?? "").trim();
  if (!fulfillment) return null;
  return fulfillment.split("T")[0] ?? null;
}

function orderMatchesFulfillmentDate(order: OrderRow, dayIso: string): boolean {
  return orderFulfillmentIso(order) === dayIso;
}

function orderLineItems(order: OrderRow): Record<string, unknown>[] {
  const raw = Array.isArray(order.items)
    ? order.items
    : Array.isArray(order.order_items)
      ? order.order_items
      : [];
  return raw as Record<string, unknown>[];
}

function lineItemProductId(item: Record<string, unknown>): string {
  return String(item.product_id ?? "").trim();
}

function lineItemKey(item: Record<string, unknown>): string {
  const id = lineItemProductId(item);
  if (id) return id;
  const name = String(item.product_name ?? "").trim();
  return name ? `name:${name}` : "";
}

function lineItemName(item: Record<string, unknown>): string {
  return String(item.product_name ?? "").trim() || lineItemProductId(item) || "—";
}

type OrderProductOption = { id: string; name: string; totalQty: number };

function collectProductsFromOrders(orders: OrderRow[]): OrderProductOption[] {
  const map = new Map<string, { name: string; qty: number }>();
  for (const order of orders) {
    for (const item of orderLineItems(order)) {
      const key = lineItemKey(item);
      if (!key) continue;
      const name = lineItemName(item);
      const prev = map.get(key);
      map.set(key, { name: prev?.name ?? name, qty: (prev?.qty ?? 0) + Number(item.quantity ?? 0) });
    }
  }
  return [...map.entries()]
    .map(([id, { name, qty }]) => ({ id, name, totalQty: qty }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

function orderContainsProduct(order: OrderRow, productKey: string): boolean {
  return orderLineItems(order).some((item) => lineItemKey(item) === productKey);
}

function trendLine(current: number, previous: number, t: Translate): string {
  if (previous === 0 && current === 0) return t("adminOrdersStatSame");
  if (previous === 0) return `↗ · ${t("adminOrdersStatVsYesterday")}`;
  const pct = Math.round(((current - previous) / previous) * 100);
  const arrow = pct >= 0 ? "↗" : "↘";
  return `${arrow} ${Math.abs(pct)}% ${t("adminOrdersStatVsYesterday")}`;
}

function statusAccentBar(status: string): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "bg-emerald-500";
    case "preparing":
      return "bg-amber-400";
    case "ready":
    case "out_for_delivery":
      return "bg-sky-500";
    case "completed":
      return "bg-stone-400";
    case "cancelled":
      return "bg-red-500";
    default:
      return "bg-stone-300";
  }
}

function listStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100";
    case "preparing":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-100";
    case "ready":
    case "out_for_delivery":
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-100";
    case "completed":
      return "bg-stone-100 text-stone-800 ring-1 ring-stone-200";
    case "cancelled":
      return "bg-red-50 text-red-900 ring-1 ring-red-100";
    default:
      return "bg-stone-100 text-stone-700 ring-1 ring-stone-200";
  }
}

function OrderStatusGlyph({ status }: { status: string }) {
  const common = "h-5 w-5";
  switch (status) {
    case "pending":
    case "confirmed":
      return <ShoppingBag className={cn(common, "text-emerald-700")} strokeWidth={1.75} aria-hidden />;
    case "preparing":
      return <ChefHat className={cn(common, "text-amber-700")} strokeWidth={1.75} aria-hidden />;
    case "ready":
      return <Package className={cn(common, "text-sky-700")} strokeWidth={1.75} aria-hidden />;
    case "out_for_delivery":
      return <Truck className={cn(common, "text-sky-700")} strokeWidth={1.75} aria-hidden />;
    case "completed":
      return <CheckCircle2 className={cn(common, "text-stone-600")} strokeWidth={1.75} aria-hidden />;
    case "cancelled":
      return <XCircle className={cn(common, "text-red-600")} strokeWidth={1.75} aria-hidden />;
    default:
      return <Package className={cn(common, "text-stone-500")} strokeWidth={1.75} aria-hidden />;
  }
}

function AdminOrderStatusSelect({
  order,
  t,
  setStatus,
  triggerClassName,
}: {
  order: { id: string; order_status: string };
  t: Translate;
  setStatus: (id: string, status: string) => Promise<void>;
  triggerClassName: string;
}) {
  return (
    <div className="min-w-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <Select value={order.order_status} onValueChange={(v) => void setStatus(order.id, v)}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {adminOrderStatusLabel(s, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function OrdersListCard({
  o,
  lang,
  t,
  onOpen,
}: {
  o: OrderRow;
  lang: Lang;
  t: Translate;
  onOpen: () => void;
}) {
  const ref = String(o.order_status ?? "");
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full touch-manipulation gap-0 rounded-2xl border border-stone-200/95 bg-white p-0 text-start shadow-[0_1px_3px_rgba(45,74,62,0.06)]",
        "outline-none transition-[box-shadow,transform] active:scale-[0.99]",
        "focus-visible:ring-2 focus-visible:ring-[#1B4332]/25 focus-visible:ring-offset-2",
      )}
    >
      <span className={cn("w-1 shrink-0 self-stretch rounded-s-[0.65rem]", statusAccentBar(ref))} aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f4f2] ring-1 ring-stone-200/80">
          <OrderStatusGlyph status={ref} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold tracking-tight text-[#1B4332]">
            #ORD-{o.id.replace(/-/g, "").slice(0, 5).toUpperCase()}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-900">{String(o.customer_name ?? "")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            {o.created_at ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  {formatOrderDate(o.created_at, lang, lang === "en" ? "MMM d, yyyy" : "d MMMM yyyy")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  {formatOrderDate(o.created_at, lang, "h:mm a")}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 ps-1">
          <span className="font-display text-lg font-bold tabular-nums text-[#1B4332]" dir="ltr">
            ₪{Number(o.total_amount).toFixed(2)}
          </span>
          <span
            className={cn(
              "max-w-[9.5rem] truncate rounded-full px-2.5 py-0.5 text-center text-[11px] font-semibold leading-tight",
              listStatusBadgeClass(ref),
            )}
          >
            {adminOrderStatusLabel(ref, t)}
          </span>
          <ChevronRight className="h-4 w-4 text-neutral-400 rtl:rotate-180" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </button>
  );
}

export function BakeryOrdersPage({ projectId }: BakeryOrdersPageProps) {
  const db = useBakeryDb(projectId);
  const { t, lang } = useBakeryT();
  const { session } = useAuth();
  const { ordersRevision } = useBakeryPendingOrders();
  const sendStatusEmailFn = useServerFn(sendOrderStatusEmailFn);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateOption[]>([]);
  const [selected, setSelected] = useState<OrderRow | null>(null);
  const [tab, setTab] = useState<TabId>("all");
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [productFilterId, setProductFilterId] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const weekdayLabel = (dayOfWeek: number) => t(WEEKDAY_DICT_KEYS[dayOfWeek] ?? "weekdaySunday");

  const load = () =>
    Promise.all([
      db.bakeryOrders({
        orderColumn: "created_at",
        orderAscending: false,
        limit: 400,
      }),
      fetchFulfillmentDays(db),
      fetchAdminRestDays(db),
    ]).then(([ordersRes, daysRes, restRes]) => {
      if (ordersRes.error) {
        toast.error(ordersRes.error.message);
        return;
      }
      setOrders(normalizeOrders((ordersRes.data ?? []) as OrderRow[]));

      if (daysRes.ok) {
        const restDays = restRes.ok ? restRes.rows : [];
        const pickupDates = buildScheduleDateOptions(
          enabledDaysFromMap(rowsToWeekdayMap(daysRes.rows, "pickup")),
          weekdayLabel,
          restDays,
        );
        const deliveryDates = buildScheduleDateOptions(
          enabledDaysFromMap(rowsToWeekdayMap(daysRes.rows, "delivery")),
          weekdayLabel,
          restDays,
        );
        setScheduleDates(mergeOpenScheduleDates(pickupDates, deliveryDates));
      } else {
        setScheduleDates([]);
      }
    });

  useEffect(() => {
    void load();
  }, [projectId, ordersRevision]);

  const setStatus = async (id: string, status: string) => {
    try {
      const { error } = await db.from("orders").update({ order_status: status }).eq("id", id);
      if (error) throw error;
      toast.success(t("updated"));
      setSelected((s) => (s && s.id === id ? { ...s, order_status: status } : s));
      void load();
      if (session?.access_token) {
        void sendStatusEmailFn({
          data: { projectId, orderId: id, newStatus: status },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("genericError"));
    }
  };

  const handleResend = async () => {
    if (!selected) return;
    setResending(true);
    try {
      toast.error(t("emailNotConfigured"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setResending(false);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const y = subDays(now, 1);
    const tOrders = dayBucket(orders, now);
    const yOrders = dayBucket(orders, y);
    const cToday = tOrders.length;
    const cY = yOrders.length;
    const sToday = tOrders.reduce((acc, o) => acc + Number(o.total_amount ?? 0), 0);
    const sY = yOrders.reduce((acc, o) => acc + Number(o.total_amount ?? 0), 0);
    return {
      cToday,
      cY,
      sToday,
      sY,
      countTrend: trendLine(cToday, cY, t),
      salesTrend: trendLine(sToday, sY, t),
    };
  }, [orders, t]);

  const ordersForTabs = useMemo(() => {
    if (!dayFilter) return orders;
    return orders.filter((o) => orderMatchesFulfillmentDate(o, dayFilter));
  }, [orders, dayFilter]);

  const filtered = useMemo(
    () => ordersForTabs.filter((o) => orderMatchesTab(String(o.order_status), tab)),
    [ordersForTabs, tab],
  );

  const productsInOrders = useMemo(
    () => (dayFilter ? collectProductsFromOrders(ordersForTabs) : []),
    [dayFilter, ordersForTabs],
  );

  useEffect(() => {
    if (productFilterId && !productsInOrders.some((p) => p.id === productFilterId)) {
      setProductFilterId(null);
    }
  }, [productFilterId, productsInOrders]);

  const dayFilterSummary = useMemo(() => {
    if (!dayFilter) return null;
    const sales = ordersForTabs.reduce((acc, o) => acc + Number(o.total_amount ?? 0), 0);
    const label = scheduleDates.find((d) => d.isoDate === dayFilter)?.label ?? dayFilter;
    return { count: ordersForTabs.length, sales, label };
  }, [ordersForTabs, dayFilter, scheduleDates]);

  const productFilterSummary = useMemo(() => {
    if (!dayFilter || !productFilterId) return null;
    const product = productsInOrders.find((p) => p.id === productFilterId);
    if (!product) return null;
    const orderCount = ordersForTabs.filter((o) => orderContainsProduct(o, productFilterId)).length;
    return { name: product.name, qty: product.totalQty, orderCount };
  }, [dayFilter, productFilterId, productsInOrders, ordersForTabs]);

  const statsCard = (
    <div
      className="admin-section-enter relative overflow-hidden rounded-2xl border border-[#1B4332]/25 bg-gradient-to-br from-[#1B4332] via-[#163d2f] to-[#0f2a20] p-4 text-white shadow-md sm:p-5"
      style={{ animationDelay: "120ms" }}
    >
      <div className="pointer-events-none absolute -bottom-6 -end-8 h-36 w-36 opacity-[0.12]" aria-hidden>
        <svg viewBox="0 0 120 120" className="h-full w-full text-[#e8d5a8]">
          <path
            fill="currentColor"
            d="M60 8c-4 18-22 32-38 42 8 10 14 22 16 36 10-6 22-10 34-10 4-22-4-44-12-68z"
          />
        </svg>
      </div>
      <div className="relative grid grid-cols-2 gap-4 divide-x divide-white/15">
        <div className="pe-3 sm:pe-4">
          <div className="flex items-center gap-2 text-white/85">
            <ShoppingBag className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              {t("adminOrdersStatTodayCount")}
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums sm:text-4xl">{stats.cToday}</p>
          <p className="mt-1 text-xs font-medium text-emerald-300/95">{stats.countTrend}</p>
        </div>
        <div className="ps-3 sm:ps-4">
          <div className="flex items-center gap-2 text-white/85">
            <span className="text-lg font-light opacity-90" aria-hidden>
              ₪
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              {t("adminOrdersStatTodaySales")}
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl" dir="ltr">
            ₪{stats.sToday.toFixed(2)}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-300/95">{stats.salesTrend}</p>
        </div>
      </div>
    </div>
  );

  const tabStrip = (
    <div className="admin-section-enter flex items-center gap-2" style={{ animationDelay: "200ms" }}>
      <div className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((def) => {
          const count = tabCount(ordersForTabs, def.id);
          const active = tab === def.id;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => setTab(def.id)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm",
                active
                  ? "bg-[#1B4332] text-white shadow-sm"
                  : "border border-stone-200/90 bg-[#faf8f4] text-stone-800 hover:bg-stone-100",
              )}
            >
              {t(def.labelKey)}
              {def.id !== "all" ? (
                <span
                  className={cn(
                    "ms-1 tabular-nums opacity-80",
                    active ? "text-white/90" : "text-stone-500",
                  )}
                >
                  ({count})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-full border-stone-200 bg-[#faf8f4] text-stone-600"
        aria-label={t("adminOrdersTabAll")}
        title={t("adminOrdersTabAll")}
        onClick={() => setTab("all")}
      >
        <Filter className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );

  const filterBar = (
    <div
      className="admin-section-enter space-y-3 rounded-2xl border border-stone-200/90 bg-[#faf8f4]/80 p-4"
      style={{ animationDelay: "160ms" }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("adminOrdersFilterDay")}
          </p>
          <div className="flex gap-2">
            <Select
              value={dayFilter ?? "__all__"}
              onValueChange={(v) => {
                const next = v === "__all__" ? null : v;
                setDayFilter(next);
                if (!next) setProductFilterId(null);
              }}
            >
              <SelectTrigger className="h-10 flex-1 border-stone-200 bg-white">
                <SelectValue placeholder={t("adminOrdersFilterDayPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("adminOrdersFilterDayAll")}</SelectItem>
                {scheduleDates.map((d) => (
                  <SelectItem key={d.isoDate} value={d.isoDate}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dayFilter ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 border-stone-200 bg-white"
                aria-label={t("adminOrdersFilterDayClear")}
                onClick={() => {
                  setDayFilter(null);
                  setProductFilterId(null);
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
          {scheduleDates.length === 0 ? (
            <p className="text-xs text-amber-800">{t("adminOrdersFilterNoScheduleDates")}</p>
          ) : null}
        </div>

        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("adminOrdersFilterProduct")}
          </p>
          <Select
            value={productFilterId ?? "__none__"}
            onValueChange={(v) => setProductFilterId(v === "__none__" ? null : v)}
            disabled={!dayFilter || productsInOrders.length === 0}
          >
            <SelectTrigger className="h-10 border-stone-200 bg-white">
              <SelectValue
                placeholder={
                  !dayFilter
                    ? t("adminOrdersFilterProductPickDate")
                    : productsInOrders.length === 0
                      ? t("adminOrdersFilterNoProductsInOrders")
                      : t("adminOrdersFilterProductPlaceholder")
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t("adminOrdersFilterProductPlaceholder")}</SelectItem>
              {productsInOrders.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {t("adminOrdersFilterProductOption")
                    .replace("{{name}}", product.name)
                    .replace("{{count}}", String(product.totalQty))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dayFilter && productsInOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("adminOrdersFilterNoProductsInOrders")}</p>
          ) : null}
        </div>
      </div>

      {dayFilterSummary || productFilterSummary ? (
        <div className="flex flex-wrap gap-2">
          {dayFilterSummary ? (
            <span className="inline-flex items-center rounded-full bg-[#1B4332]/10 px-3 py-1 text-sm font-semibold text-[#1B4332]">
              {dayFilterSummary.label}:{" "}
              {t("adminOrdersFilterDaySummary")
                .replace("{{count}}", String(dayFilterSummary.count))
                .replace("{{sales}}", dayFilterSummary.sales.toFixed(2))}
            </span>
          ) : null}
          {productFilterSummary ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-950 ring-1 ring-amber-200/80">
              {t("adminOrdersFilterProductSummary")
                .replace("{{name}}", productFilterSummary.name)
                .replace("{{count}}", String(productFilterSummary.qty))
                .replace("{{orders}}", String(productFilterSummary.orderCount))}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const brandHero = (
    <div className="flex flex-col items-center gap-1 pb-1 text-center">
      <img
        src={brandLogo}
        alt=""
        width={112}
        height={112}
        className="h-14 w-14 rounded-full object-contain ring-2 ring-[#c9a962]/35 sm:h-16 sm:w-16"
      />
      <p className="font-display text-lg font-bold uppercase tracking-[0.18em] text-[#1B4332] sm:text-xl">
        {t("brand").split(/[·|]/)[0]?.trim() ?? t("brand")}
      </p>
      <p className="max-w-xs text-[10px] font-medium uppercase tracking-[0.28em] text-stone-500 sm:text-[11px]">
        {t("tagline")}
      </p>
    </div>
  );

  const selectedScheduledLabel = selected
    ? fulfillmentLabelFromOrder(
        selected.selected_fulfillment_date as string | undefined,
        selected.selected_fulfillment_day_of_week as string | number | undefined,
        selected.selected_fulfillment_label as string | undefined,
        lang,
        selected.delivery_method as string | undefined,
      )
    : null;

  return (
    <div className="admin-page-enter mx-auto max-w-6xl space-y-5 px-4 py-6 md:space-y-6 md:px-8 md:py-8">
      <div className="md:hidden">{brandHero}</div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="admin-header-enter hidden text-center font-display text-2xl font-bold tracking-tight text-[#1B4332] sm:text-start md:block md:text-3xl">
          {t("adminDashOrdersTitle")}
        </h1>
        <h1 className="admin-header-enter font-display text-xl font-bold tracking-tight text-[#1B4332] md:hidden">
          {t("adminDashOrdersTitle")}
        </h1>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-14 text-center text-sm text-muted-foreground">
          {t("adminNoOrdersYet")}
        </p>
      ) : (
        <>
          {statsCard}
          {filterBar}
          {tabStrip}

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 py-10 text-center text-sm text-muted-foreground">
              {t("adminOrdersNoMatch")}
            </p>
          ) : (
            <>
              <div className="admin-list-stagger space-y-3 md:hidden">
                {filtered.map((o) => (
                  <OrdersListCard
                    key={o.id}
                    o={o}
                    lang={lang}
                    t={t}
                    onOpen={() => setSelected(o)}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-stone-200/80 bg-card shadow-sm md:block">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-stone-200/80 bg-muted/40 text-start">
                    <tr>
                      <th className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThOrderShort")}
                      </th>
                      <th className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThDate")}
                      </th>
                      <th className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThCustomer")}
                      </th>
                      <th className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThMethod")}
                      </th>
                      <th className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThTotal")}
                      </th>
                      <th className="px-4 py-3 font-sans text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThStatus")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr
                        key={o.id}
                        className="cursor-pointer border-t border-stone-100 transition-colors hover:bg-muted/25"
                        onClick={() => setSelected(o)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground">
                          {o.id.slice(0, 8)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {o.created_at ? formatOrderDateDisplay(o.created_at, lang, true) : "—"}
                        </td>
                        <td className="max-w-[12rem] px-4 py-3">
                          <div className="font-medium leading-snug text-foreground">
                            {String(o.customer_name ?? "")}
                          </div>
                          <div className="text-xs text-muted-foreground">{String(o.customer_phone ?? "")}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {deliveryLabel(o.delivery_method as string, t)} ·{" "}
                          {paymentLabel(o.payment_method as string, t)}
                        </td>
                        <td
                          className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-[#1B4332]"
                          dir="ltr"
                        >
                          ₪{Number(o.total_amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <AdminOrderStatusSelect
                            order={{ id: o.id, order_status: String(o.order_status ?? "pending") }}
                            t={t}
                            setStatus={setStatus}
                            triggerClassName="h-10 w-[min(100%,10rem)] min-w-[8.5rem] justify-between rounded-lg border-stone-200 bg-background text-start font-normal"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-h-[min(92dvh,44rem)] w-[calc(100vw-1.5rem)] max-w-lg gap-0 overflow-hidden border-stone-200 p-0 sm:max-w-xl">
          {selected && (
            <>
              <div className="border-b border-stone-200 bg-gradient-to-b from-[#faf8f4] to-white px-5 pb-4 pt-5">
                <DialogHeader className="space-y-3 text-start">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="font-display text-xl text-[#1B4332] sm:text-2xl">
                        {t("adminOrderTitlePrefix")} #
                        {selected.id.replace(/-/g, "").slice(0, 6).toUpperCase()}
                      </DialogTitle>
                      <DialogDescription className="sr-only">
                        {t("adminDialogOrderDetailSr")}
                      </DialogDescription>
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          adminOrderStatusPillClass(String(selected.order_status)),
                        )}
                      >
                        {adminOrderStatusLabel(String(selected.order_status), t)}
                      </span>
                    </div>
                    <div className="min-w-[10rem] flex-1 sm:max-w-[14rem]" dir="ltr">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("adminThStatus")}
                      </p>
                      <AdminOrderStatusSelect
                        order={{
                          id: selected.id,
                          order_status: String(selected.order_status ?? "pending"),
                        }}
                        t={t}
                        setStatus={setStatus}
                        triggerClassName="mt-1 h-10 w-full justify-between rounded-lg border-stone-200 bg-white text-start text-sm font-normal"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {t("adminOrderDetailPlaced")}:{" "}
                      {selected.created_at
                        ? formatOrderDateDisplay(selected.created_at, lang, true)
                        : "—"}
                    </span>
                    {selected.updated_at ? (
                      <span>
                        {t("adminOrderDetailUpdated")}:{" "}
                        {formatOrderDateDisplay(String(selected.updated_at), lang, true)}
                      </span>
                    ) : null}
                  </div>
                </DialogHeader>
              </div>

              <div className="max-h-[min(70dvh,32rem)] space-y-0 overflow-y-auto px-5 py-4 text-sm">
                <section className="rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b8577]">
                    {t("adminThCustomer")}
                  </p>
                  <p className="mt-1 font-semibold text-neutral-900">{String(selected.customer_name ?? "")}</p>
                  <div className="mt-2 space-y-1 text-sm text-neutral-600">
                    <p>
                      <a
                        href={`tel:${String(selected.customer_phone ?? "").replace(/\s/g, "")}`}
                        className="text-[#2f6a4f] hover:underline"
                      >
                        {String(selected.customer_phone ?? "")}
                      </a>
                    </p>
                    <p>
                      <a
                        href={`mailto:${String(selected.customer_email ?? "")}`}
                        className="break-all text-[#2f6a4f] hover:underline"
                      >
                        {String(selected.customer_email ?? "")}
                      </a>
                    </p>
                  </div>
                </section>

                <section className="mt-3 rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b8577]">
                    {t("adminThMethod")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        isPickupOrder(selected.delivery_method as string)
                          ? "bg-[#faf8f4] text-[#6b4e2e] ring-1 ring-[#c9a227]/40"
                          : "bg-[#1B4332]/10 text-[#1B4332]",
                      )}
                    >
                      {isPickupOrder(selected.delivery_method as string) ? (
                        <Package className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Truck className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {deliveryLabel(selected.delivery_method as string, t)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {paymentLabel(selected.payment_method as string, t)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-neutral-700">{t("adminOrderDetailPaymentStatus")}:</span>{" "}
                    {String(selected.payment_status ?? "—")}
                  </p>
                  {selectedScheduledLabel ? (
                    <p className="mt-2 flex items-start gap-2 rounded-lg border border-[#1B4332]/15 bg-[#faf8f4]/80 px-2.5 py-2 text-xs text-[#1B4332]">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        <span className="font-semibold">{t("adminOrderScheduledDate")}: </span>
                        {selectedScheduledLabel}
                      </span>
                    </p>
                  ) : null}
                  {isPickupOrder(selected.delivery_method as string) ? (
                    <div className="mt-3 rounded-lg border border-[#c9a227]/25 bg-gradient-to-br from-[#faf8f4] to-white p-2.5 text-xs leading-relaxed text-neutral-800">
                      <p className="font-semibold text-[#1B4332]">{t("adminOrderPickupLocation")}</p>
                      <p className="mt-1">{BAKERY_PICKUP_ADDRESS}</p>
                    </div>
                  ) : selected.delivery_address || selected.delivery_place_name ? (
                    <div className="mt-3 rounded-lg bg-stone-50 p-2.5 text-xs leading-relaxed text-neutral-700">
                      {selected.delivery_place_name ? (
                        <p className="mb-2 font-medium text-[#1B4332]">
                          {String(selected.delivery_place_name)}
                        </p>
                      ) : null}
                      {selected.delivery_address ? (
                        <>
                          <p className="mb-1 font-semibold text-[#1B4332]">{t("address")}</p>
                          <p className="whitespace-pre-wrap">{String(selected.delivery_address)}</p>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {selected.notes ? (
                    <p className="mt-2 rounded-lg border border-dashed border-stone-200 bg-amber-50/40 p-2 text-xs text-neutral-800">
                      <span className="font-medium">{t("notes")}: </span>
                      {String(selected.notes)}
                    </p>
                  ) : null}
                </section>

                <section className="mt-3 rounded-xl border border-stone-200/80 bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b8577]">
                    {t("adminOrderDetailSectionItems")}
                  </p>
                  <ul className="mt-2 divide-y divide-stone-100">
                    {(Array.isArray(selected.items) ? selected.items : []).map((raw, index) => {
                      const it = raw as Record<string, unknown>;
                      const product = it.product as Record<string, unknown> | undefined;
                      const rawUrl = product?.image_url as string | undefined;
                      const thumb = rawUrl ? resolveImage(rawUrl) : null;
                      return (
                        <li key={String(it.id ?? index)} className="flex gap-3 py-2.5 first:pt-0">
                          <div className="flex h-11 w-11 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="m-auto h-4 w-4 text-stone-400" aria-hidden />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug text-[#2f6a4f]">
                              {String(it.product_name ?? "")}
                            </p>
                            <p className="mt-0.5 text-xs tabular-nums text-neutral-500" dir="ltr">
                              {Number(it.quantity ?? 0)} × ₪{Number(it.product_price ?? 0).toFixed(2)}
                            </p>
                          </div>
                          <span
                            className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900"
                            dir="ltr"
                          >
                            ₪{Number(it.total_price ?? 0).toFixed(2)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="mt-3 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/90 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t("adminOrderSubtotal")}</span>
                    <span className="font-medium tabular-nums" dir="ltr">
                      ₪{Number(selected.subtotal ?? 0).toFixed(2)}
                    </span>
                  </div>
                  {Number(selected.discount_amount) > 0 ? (
                    <div className="mt-1 flex justify-between text-sm text-[#2f6a4f]">
                      <span>{t("adminOrderDiscountLine")}</span>
                      <span className="font-medium tabular-nums" dir="ltr">
                        −₪{Number(selected.discount_amount).toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  {Number(selected.delivery_fee) > 0 ? (
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-slate-600">{t("adminOrderDeliveryLine")}</span>
                      <span className="font-medium tabular-nums" dir="ltr">
                        ₪{Number(selected.delivery_fee).toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-2 flex justify-between border-t border-slate-300/70 pt-2 font-display text-lg font-bold text-[#1B4332]">
                    <span>{t("adminOrderTotalLine")}</span>
                    <span dir="ltr">₪{Number(selected.total_amount).toFixed(2)}</span>
                  </div>
                </section>
              </div>

              <div className="border-t border-stone-200 bg-[#faf8f4] px-5 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resending}
                  onClick={() => void handleResend()}
                  className="w-full border-[#1B4332]/25 text-[#1B4332] hover:bg-[#1B4332]/5"
                >
                  {resending ? t("sendingEmail") : t("resendConfirmationEmail")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
