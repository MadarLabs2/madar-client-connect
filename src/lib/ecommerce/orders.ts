export const ECOMMERCE_ORDER_STATUSES = [
  "in_preparation",
  "ready",
  "shipped",
  "delivered",
  "received",
  "cancelled",
] as const;

export type EcommerceOrderStatus = (typeof ECOMMERCE_ORDER_STATUSES)[number];

export const ECOMMERCE_STATUS_LABELS: Record<string, string> = {
  in_preparation: "בהכנה",
  ready: "מוכנה",
  shipped: "נשלחה",
  delivered: "נמסרה",
  received: "התקבלה",
  cancelled: "בוטלה",
  processing: "בטיפול",
};

export function sortEcommerceOrdersForDisplay<T extends { status: string; created_at: string }>(
  rows: T[],
): T[] {
  const tier = (s: string) => (s === "received" ? 1 : 0);
  return [...rows].sort((a, b) => {
    const t = tier(a.status) - tier(b.status);
    if (t !== 0) return t;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function ecommerceShippingMethodLabel(method: string): string {
  if (method === "home_delivery") return "משלוח עד הבית";
  if (method === "store_pickup") return "איסוף מהחנות";
  return method;
}

export function cardcomDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    TaxInvoiceAndReceipt: "חשבונית מס קבלה",
    Receipt: "קבלה",
    TaxInvoice: "חשבונית מס",
    Order: "הזמנה",
  };
  return labels[type] ?? type;
}
