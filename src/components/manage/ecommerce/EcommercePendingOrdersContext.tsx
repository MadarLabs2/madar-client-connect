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
import {
  playNewOrderChime,
  unlockOrderNotificationAudio,
} from "@/lib/bakery/orderNotificationSound";
import { useEcommerceOrdersSync } from "@/lib/ecommerce/useEcommerceOrdersSync";
import { ecommerceOrdersCount } from "@/lib/project-db.functions";

type Ctx = { ordersRevision: number };

const EcommercePendingOrdersContext = createContext<Ctx | null>(null);

/**
 * Plays the new-order chime on every ecommerce admin tab (not just Orders),
 * mirroring the bakery's BakeryPendingOrdersProvider.
 */
export function EcommercePendingOrdersProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const countFn = useServerFn(ecommerceOrdersCount);
  const [ordersRevision, setOrdersRevision] = useState(0);
  const lastRef = useRef(0);
  const initialisedRef = useRef(false);

  useEffect(() => {
    const unlock = () => unlockOrderNotificationAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const fetchOrdersCount = useCallback(async (): Promise<number> => {
    const res = await countFn({ data: { projectId } });
    if (res.error) {
      console.warn("[EcommercePendingOrders]", res.error);
      return lastRef.current;
    }
    return res.count ?? 0;
  }, [countFn, projectId]);

  const pullCount = useCallback(
    async (playOnIncrease: boolean) => {
      const n = await fetchOrdersCount();
      const prev = lastRef.current;
      const changed = initialisedRef.current && n !== prev;

      if (initialisedRef.current && playOnIncrease && n > prev) {
        playNewOrderChime();
      }
      lastRef.current = n;
      initialisedRef.current = true;

      if (changed) {
        setOrdersRevision((r) => r + 1);
      }
    },
    [fetchOrdersCount],
  );

  const onOrdersChange = useCallback(() => {
    void pullCount(true);
  }, [pullCount]);

  useEffect(() => {
    void pullCount(false);
  }, [pullCount]);

  useEcommerceOrdersSync({ projectId, onOrdersChange });

  const value = useMemo(() => ({ ordersRevision }), [ordersRevision]);

  return (
    <EcommercePendingOrdersContext.Provider value={value}>
      {children}
    </EcommercePendingOrdersContext.Provider>
  );
}

export function useEcommercePendingOrders(): Ctx {
  const v = useContext(EcommercePendingOrdersContext);
  if (!v) {
    throw new Error("useEcommercePendingOrders must be used within EcommercePendingOrdersProvider");
  }
  return v;
}
