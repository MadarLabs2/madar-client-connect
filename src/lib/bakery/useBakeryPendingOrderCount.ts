import { useBakeryPendingOrders } from "@/components/manage/bakery/BakeryPendingOrdersContext";

/**
 * Count of orders needing attention (pending / confirmed). Single shared subscription via {@link BakeryPendingOrdersProvider}.
 */
export function useBakeryPendingOrderCount(): number {
  return useBakeryPendingOrders().pendingCount;
}

export { useBakeryPendingOrders };
