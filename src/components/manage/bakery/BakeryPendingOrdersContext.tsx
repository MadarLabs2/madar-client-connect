/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { playNewOrderChime } from "@/lib/bakery/orderNotificationSound";
import { useBakeryOrdersSync } from "@/lib/bakery/useBakeryOrdersSync";
import { bakeryPendingOrdersCount } from "@/lib/project-db.functions";

type Ctx = { pendingCount: number; ordersRevision: number };

const BakeryPendingOrdersContext = createContext<Ctx | null>(null);

export function BakeryPendingOrdersProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const countFn = useServerFn(bakeryPendingOrdersCount);
  const [count, setCount] = useState(0);
  const [ordersRevision, setOrdersRevision] = useState(0);
  const lastRef = useRef(0);
  const initialisedRef = useRef(false);

  const fetchActionableOrderCount = useCallback(async (): Promise<number> => {
    const res = await countFn({ data: { projectId } });
    if (res.error) {
      console.warn("[BakeryPendingOrders]", res.error);
      return 0;
    }
    return res.count ?? 0;
  }, [countFn, projectId]);

  const pullCount = useCallback(
    async (playOnIncrease: boolean) => {
      const n = await fetchActionableOrderCount();
      if (initialisedRef.current && playOnIncrease && n > lastRef.current) {
        playNewOrderChime();
      }
      lastRef.current = n;
      initialisedRef.current = true;
      setCount(n);
    },
    [fetchActionableOrderCount],
  );

  const onOrdersChange = useCallback(() => {
    setOrdersRevision((r) => r + 1);
    void pullCount(true);
  }, [pullCount]);

  useEffect(() => {
    void pullCount(false);
  }, [pullCount]);

  useBakeryOrdersSync({ projectId, onOrdersChange });

  const value = useMemo(() => ({ pendingCount: count, ordersRevision }), [count, ordersRevision]);

  return (
    <BakeryPendingOrdersContext.Provider value={value}>
      {children}
    </BakeryPendingOrdersContext.Provider>
  );
}

export function useBakeryPendingOrders(): Ctx {
  const v = useContext(BakeryPendingOrdersContext);
  if (!v) {
    throw new Error("useBakeryPendingOrders must be used within BakeryPendingOrdersProvider");
  }
  return v;
}
