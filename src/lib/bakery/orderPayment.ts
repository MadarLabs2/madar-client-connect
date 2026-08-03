/** Orders visible to admin / customer lists — unpaid card checkouts are excluded. */
export function isCreditCardOrder(order: { payment_method?: string | null }) {
  const k = String(order.payment_method ?? "").toLowerCase();
  return k === "credit_card" || k === "card";
}

export function isOrderPaymentSettled(order: {
  payment_method?: string | null;
  payment_status?: string | null;
}) {
  if (!isCreditCardOrder(order)) return true;
  return String(order.payment_status ?? "").toLowerCase() === "paid";
}

/** Supabase `.or()` filter: show cash orders and paid card orders only. */
export const ADMIN_VISIBLE_ORDERS_FILTER =
  "payment_method.neq.credit_card,payment_status.eq.paid" as const;

export function isOrderVisibleInAdmin(order: {
  payment_method?: string | null;
  payment_status?: string | null;
}): boolean {
  return isOrderPaymentSettled(order);
}

/** Cancelled orders must not count toward sales / revenue KPIs. */
export function isOrderCountedInRevenue(order: { order_status?: string | null }): boolean {
  return String(order.order_status ?? "").toLowerCase() !== "cancelled";
}

export function sumOrderRevenue(
  orders: Array<{ total_amount?: number | string | null; order_status?: string | null }>,
): number {
  return orders.reduce((acc, o) => {
    if (!isOrderCountedInRevenue(o)) return acc;
    return acc + Number(o.total_amount ?? 0);
  }, 0);
}

export const PENDING_CARD_ORDER_STORAGE_KEY = "pendingCardOrderId";
