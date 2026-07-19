import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ecommerceOrdersList,
  ecommerceOrderDetails,
  ecommerceHideReceivedOrder,
  projectUpdate,
} from "@/lib/project-db.functions";
import { ECOMMERCE_ORDER_STATUSES } from "@/lib/ecommerce/orders";
import { sendEcommerceOrderStatusEmailFn } from "@/lib/ecommerce/sendOrderStatusEmail.functions";
import {
  formatEcommerceDateTime,
  formatEcommerceMoney,
  formatEcommerceNumber,
  useEcommerceOrderLabels,
  useEcommerceT,
} from "@/lib/ecommerce/i18n";
import { useEcommerceOrdersSync } from "@/lib/ecommerce/useEcommerceOrdersSync";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

type SortOrder = "newest" | "oldest";

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

type AdminOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  coupon_code?: string | null;
  created_at: string;
  customer_name: string;
  customer_email: string;
  user_id: string | null;
};

type OrderItemRow = {
  id: string;
  product_name: string;
  image_url: string | null;
  color: string;
  color_hex?: string | null;
  size: string;
  quantity: number;
  unit_price: number;
};

type OrderDetailsRow = {
  id: string;
  order_number: string;
  status: string;
  shipping_method: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  coupon_code?: string | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: unknown;
  cardcom_document_number?: string | null;
  cardcom_document_type?: string | null;
  cardcom_document_url?: string | null;
  order_items: OrderItemRow[];
};

function ColorSwatch({ hex, label }: { hex?: string | null; label?: string }) {
  const bg = hex?.trim() || "#e5e5e5";
  return (
    <span
      title={label}
      className="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
      style={{ backgroundColor: bg }}
    />
  );
}

export function OrdersManager({
  projectId,
  userIdFilter,
  initialOrderId,
}: {
  projectId: string;
  userIdFilter?: string | null;
  initialOrderId?: string | null;
}) {
  const { t, lang } = useEcommerceT();
  const { statusLabel, shippingLabel, cardcomLabel } = useEcommerceOrderLabels();
  const qc = useQueryClient();
  const listFn = useServerFn(ecommerceOrdersList);
  const detailsFn = useServerFn(ecommerceOrderDetails);
  const hideFn = useServerFn(ecommerceHideReceivedOrder);
  const updateFn = useServerFn(projectUpdate);
  const sendStatusEmailFn = useServerFn(sendEcommerceOrderStatusEmailFn);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [orderPendingHide, setOrderPendingHide] = useState<AdminOrderRow | null>(null);
  const [unseenOrderIds, setUnseenOrderIds] = useState<Set<string>>(() => new Set());

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const ordersInitializedRef = useRef(false);

  const formatMoney = (n: number) =>
    formatEcommerceMoney(n, lang, { maximumFractionDigits: 0 });
  const formatCount = (n: number) => formatEcommerceNumber(n, lang);

  const invalidateOrders = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "orders"] });
  }, [qc, projectId]);

  useEcommerceOrdersSync({
    projectId,
    onOrdersChange: invalidateOrders,
  });

  useEffect(() => {
    ordersInitializedRef.current = false;
    knownOrderIdsRef.current = new Set();
    setUnseenOrderIds(new Set());
  }, [projectId, userIdFilter]);

  const { data: listRes, isLoading, isError } = useQuery({
    queryKey: ["ecommerce", projectId, "orders", userIdFilter ?? "all"],
    queryFn: () =>
      listFn({
        data: {
          projectId,
          limit: 500,
          ...(userIdFilter ? { userId: userIdFilter } : {}),
        },
      }),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const { data: detailsRes, isLoading: detailsLoading } = useQuery({
    queryKey: ["ecommerce", projectId, "order", selectedId],
    queryFn: () =>
      detailsFn({ data: { projectId, orderId: selectedId! } }),
    enabled: Boolean(selectedId),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const orders: AdminOrderRow[] = useMemo(() => {
    const rows: any[] = listRes?.rows ?? [];
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      order_number: String(r.order_number ?? r.id ?? ""),
      status: String(r.status ?? "received"),
      total: Number(r.total ?? 0),
      coupon_code: r.coupon_code ?? null,
      created_at: String(r.created_at ?? ""),
      customer_name: String(r.customer_name ?? ""),
      customer_email: String(r.customer_email ?? ""),
      user_id: r.user_id ? String(r.user_id) : null,
    }));
  }, [listRes]);

  useEffect(() => {
    if (!orders.length) return;
    const currentIds = new Set(orders.map((o) => o.id));
    if (!ordersInitializedRef.current) {
      knownOrderIdsRef.current = currentIds;
      ordersInitializedRef.current = true;
      return;
    }
    // The chime itself is played globally by EcommercePendingOrdersProvider.
    const brandNew = orders.filter((o) => !knownOrderIdsRef.current.has(o.id));
    if (brandNew.length > 0) {
      setUnseenOrderIds((prev) => {
        const next = new Set(prev);
        for (const o of brandNew) next.add(o.id);
        return next;
      });
      toast.info(
        brandNew.length === 1
          ? t("newOrderToast", { number: brandNew[0].order_number })
          : t("newOrdersToast", { count: brandNew.length }),
      );
    }
    knownOrderIdsRef.current = currentIds;
  }, [orders]);

  const order: OrderDetailsRow | null = useMemo(() => {
    const raw = detailsRes?.order;
    if (!raw) return null;
    const items = Array.isArray(raw.order_items) ? raw.order_items : [];
    return {
      id: String(raw.id),
      order_number: String(raw.order_number ?? raw.id),
      status: String(raw.status ?? ""),
      shipping_method: String(raw.shipping_method ?? ""),
      shipping_fee: Number(raw.shipping_fee ?? 0),
      subtotal: Number(raw.subtotal ?? 0),
      total: Number(raw.total ?? 0),
      coupon_code: raw.coupon_code ?? null,
      discount_percent: raw.discount_percent ?? null,
      discount_amount: raw.discount_amount ?? null,
      customer_name: String(raw.customer_name ?? ""),
      customer_email: String(raw.customer_email ?? ""),
      customer_phone: raw.customer_phone ?? null,
      shipping_address: raw.shipping_address ?? null,
      cardcom_document_number: raw.cardcom_document_number ?? null,
      cardcom_document_type: raw.cardcom_document_type ?? null,
      cardcom_document_url: raw.cardcom_document_url ?? null,
      order_items: items.map((it: any) => ({
        id: String(it.id ?? ""),
        product_name: String(it.product_name ?? ""),
        image_url: it.image_url ?? null,
        color: String(it.color ?? ""),
        color_hex: it.color_hex ?? null,
        size: String(it.size ?? ""),
        quantity: Number(it.quantity ?? 0),
        unit_price: Number(it.unit_price ?? 0),
      })),
    };
  }, [detailsRes]);

  const openOrder = useCallback((id: string) => {
    setSelectedId(id);
    setUnseenOrderIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (order) setStatusDraft(order.status);
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (initialOrderId && orders.some((o) => o.id === initialOrderId)) {
      openOrder(initialOrderId);
    }
  }, [initialOrderId, orders, openOrder]);

  const todayMetrics = useMemo(() => {
    const today = orders.filter((o) => isToday(o.created_at) && o.status !== "cancelled");
    return {
      count: today.length,
      revenue: today.reduce((s, o) => s + o.total, 0),
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        (o.coupon_code?.toLowerCase().includes(q) ?? false)
      );
    });
    return [...rows].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? tb - ta : ta - tb;
    });
  }, [orders, query, statusFilter, sortOrder]);

  const statusOptions = useMemo(() => {
    const base = [...ECOMMERCE_ORDER_STATUSES];
    if (order?.status && !base.includes(order.status as (typeof ECOMMERCE_ORDER_STATUSES)[number])) {
      return [order.status, ...base];
    }
    return base;
  }, [order?.status]);

  const shippingAddressFields = useMemo(() => {
    const a = order?.shipping_address;
    if (!a || typeof a !== "object" || Array.isArray(a)) return [] as Array<{ label: string; value: string }>;
    const raw = a as Record<string, unknown>;
    const pick = (key: string) => {
      const v = raw[key];
      return typeof v === "string" ? v.trim() : "";
    };
    const fields = [
      { label: t("city"), value: pick("city") },
      { label: t("street"), value: pick("street") },
      { label: t("houseNumber"), value: pick("house_number") },
      { label: t("apartment"), value: pick("apartment_number") },
      { label: t("deliveryNotes"), value: pick("delivery_notes") },
      { label: t("address"), value: pick("address") || pick("line1") },
      { label: t("zip"), value: pick("postal_code") || pick("zip") },
    ];
    const out: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();
    for (const f of fields) {
      if (!f.value) continue;
      const key = `${f.label}:${f.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
    return out;
  }, [order?.shipping_address, t]);

  const hasInvoice =
    Boolean(order?.cardcom_document_number?.trim()) ||
    Boolean(order?.cardcom_document_type?.trim()) ||
    Boolean(order?.cardcom_document_url?.trim());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "orders"] });
    if (selectedId) qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "order", selectedId] });
  };

  const saveStatus = async () => {
    if (!selectedId || !order || statusDraft === order.status) return;
    setSaving(true);
    const newStatus = statusDraft;
    try {
      await updateFn({
        data: { projectId, table: "orders", id: selectedId, row: { status: newStatus } },
      });
      invalidate();
      void sendStatusEmailFn({
        data: { projectId, orderId: selectedId, newStatus },
      });
      toast.success(t("statusUpdated"));
    } catch (e: any) {
      toast.error(e?.message || t("updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onConfirmHide = async () => {
    if (!orderPendingHide) return;
    setHiding(true);
    try {
      await hideFn({ data: { projectId, orderId: orderPendingHide.id } });
      toast.success(t("hideSuccess"));
      if (selectedId === orderPendingHide.id) setSelectedId(null);
      setOrderPendingHide(null);
      invalidate();
    } catch (e: any) {
      const msg =
        e?.message === "ORDER_HIDE_FAILED" ? t("hideFailedMigration") : e?.message || t("hideFailed");
      toast.error(msg);
    } finally {
      setHiding(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertDialog open={!!orderPendingHide} onOpenChange={(open) => !open && setOrderPendingHide(null)}>
        <AlertDialogContent className="max-w-md gap-4 border-border p-6">
          <AlertDialogHeader className="space-y-2 text-start">
            <AlertDialogTitle className="font-body text-base font-normal">
              {t("hideConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-sm leading-relaxed">
              {t("hideConfirmDesc")}
              {orderPendingHide ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">({orderPendingHide.order_number})</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex flex-row flex-wrap justify-end gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <Button disabled={hiding} onClick={() => void onConfirmHide()}>
              {t("hide")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {userIdFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("customerFilterBanner")}</span>
          <div className="flex flex-wrap gap-3">
            <Link
              to="."
              search={{ tab: "customers" }}
              params={{ projectId }}
              className="text-xs uppercase tracking-widest underline underline-offset-4"
            >
              {t("customersLink")}
            </Link>
            <Link
              to="."
              search={{ tab: "orders" }}
              params={{ projectId }}
              className="text-xs uppercase tracking-widest underline underline-offset-4"
            >
              {t("allOrdersLink")}
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-border/70 p-4 sm:p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("todayOrders")}
          </p>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums sm:text-3xl">
            {isLoading ? "…" : formatCount(todayMetrics.count)}
          </p>
        </Card>
        <Card className="border-border/70 p-4 sm:p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("todaySales")}
          </p>
          <p className="mt-3 font-display text-2xl font-semibold tabular-nums sm:text-3xl">
            {isLoading ? "…" : formatMoney(todayMetrics.revenue)}
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{t("ordersTitle")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("sortNewest")}</SelectItem>
              <SelectItem value="oldest">{t("sortOldest")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              {ECOMMERCE_ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="w-56 pr-7"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>
        ) : isError || listRes?.error ? (
          <div className="p-6 text-sm text-destructive">
            {listRes?.error || t("ordersLoadFailed")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">{t("noOrders")}</div>
        ) : (
          <div className="divide-y">
            {filtered.map((o) => {
              const isNew = unseenOrderIds.has(o.id);
              return (
              <div
                key={o.id}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-stretch",
                  isNew ? "bg-amber-50/80 hover:bg-amber-50" : "hover:bg-muted/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => openOrder(o.id)}
                  className="min-w-0 flex-1 p-4 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          {o.order_number}
                        </p>
                        {isNew ? (
                          <span className="inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                            {t("newOrderBadge")}
                          </span>
                        ) : null}
                      </div>
                      <p className="font-medium">{o.customer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEcommerceDateTime(o.created_at, lang)}
                      </p>
                      {o.coupon_code?.trim() ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {t("coupon")}: {o.coupon_code.trim()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <p className="font-medium tabular-nums">{formatMoney(o.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {statusLabel(o.status)}
                      </p>
                    </div>
                  </div>
                </button>
                {o.status === "received" && (
                  <div className="flex items-stretch border-t p-4 pt-3 sm:border-s sm:border-t-0 sm:pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setOrderPendingHide(o)}
                    >
                      {t("hideFromList")}
                    </Button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("orderTitle", { number: order?.order_number ?? "…" })}</DialogTitle>
          </DialogHeader>

          {detailsLoading || !order ? (
            <div className="py-8 text-sm text-muted-foreground">{t("loadingDetails")}</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
                <div className="min-w-[180px] flex-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("status")}</Label>
                  <Select value={statusDraft} onValueChange={setStatusDraft}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => void saveStatus()}
                  disabled={saving || statusDraft === order.status}
                >
                  {saving ? t("saving") : t("updateStatus")}
                </Button>
              </div>

              <Card className="space-y-3 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("orderShipping")}</span>
                  <span>{shippingLabel(order.shipping_method)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">{t("customer")}</span>
                  <span className="min-w-0 break-words text-end">
                    {order.customer_name}
                    <br />
                    <span className="text-muted-foreground">{order.customer_email}</span>
                    {order.customer_phone ? (
                      <>
                        <br />
                        <span className="text-muted-foreground">{order.customer_phone}</span>
                      </>
                    ) : null}
                  </span>
                </div>
                {shippingAddressFields.length > 0 && (
                  <div>
                    <span className="mb-1 block text-muted-foreground">{t("shippingAddress")}</span>
                    <div className="space-y-1 break-words border bg-muted/30 p-3">
                      {shippingAddressFields.map((row) => (
                        <p key={row.label}>
                          <span className="text-muted-foreground">{row.label}: </span>
                          {row.value}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span>{formatMoney(order.subtotal)}</span>
                </div>
                {order.coupon_code?.trim() ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{t("coupon")}</span>
                    <span dir="ltr" className="break-all">
                      {order.coupon_code.trim()}
                    </span>
                  </div>
                ) : null}
                {Number(order.discount_amount) > 0 && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {t("discount")}
                      {Number(order.discount_percent) > 0 ? ` (${order.discount_percent}%)` : ""}
                    </span>
                    <span className="tabular-nums">−{formatMoney(Number(order.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("shippingFee")}</span>
                  <span>{formatMoney(order.shipping_fee)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>{t("total")}</span>
                  <span>{formatMoney(order.total)}</span>
                </div>
              </Card>

              {hasInvoice && (
                <Card className="space-y-3 p-4">
                  <h2 className="text-xs uppercase tracking-widest">{t("invoiceCardcom")}</h2>
                  {order.cardcom_document_type?.trim() ? (
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{t("docType")}</span>
                      <span>{cardcomLabel(order.cardcom_document_type.trim())}</span>
                    </div>
                  ) : null}
                  {order.cardcom_document_number?.trim() ? (
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{t("docNumber")}</span>
                      <span dir="ltr" className="tabular-nums">
                        {order.cardcom_document_number.trim()}
                      </span>
                    </div>
                  ) : null}
                  {order.cardcom_document_url?.trim() ? (
                    <div className="flex justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">PDF</span>
                      <a
                        href={order.cardcom_document_url.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-muted-foreground"
                      >
                        {t("viewInvoice")}
                      </a>
                    </div>
                  ) : null}
                </Card>
              )}

              <Card className="overflow-hidden">
                <div className="border-b bg-muted/30 px-3 py-2 text-xs uppercase text-muted-foreground">
                  {t("items")}
                </div>
                <div className="divide-y">
                  {order.order_items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        {it.image_url ? (
                          <img
                            src={it.image_url}
                            alt=""
                            className="h-12 w-10 shrink-0 object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        <ColorSwatch hex={it.color_hex} label={it.color} />
                        <span className="min-w-0">
                          {it.product_name} — {it.color} / {it.size} × {it.quantity}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(Number(it.unit_price) * it.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedId(null)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
