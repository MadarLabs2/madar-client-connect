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
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { playNewOrderChime } from "@/lib/bakery/orderNotificationSound";
import {
  bakeryPendingOrdersCount,
  bakeryProjectRealtimeConfig,
} from "@/lib/project-db.functions";

type Ctx = { pendingCount: number };

const BakeryPendingOrdersContext = createContext<Ctx | null>(null);

export function BakeryPendingOrdersProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const countFn = useServerFn(bakeryPendingOrdersCount);
  const realtimeConfigFn = useServerFn(bakeryProjectRealtimeConfig);
  const [count, setCount] = useState(0);
  const lastRef = useRef(0);
  const initialisedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchActionableOrderCount = useCallback(async (): Promise<number> => {
    const res = await countFn({ data: { projectId } });
    if (res.error) {
      console.warn("[BakeryPendingOrders]", res.error);
      return 0;
    }
    return res.count ?? 0;
  }, [countFn, projectId]);

  const applyCount = useCallback((n: number, playOnIncrease: boolean) => {
    if (initialisedRef.current && playOnIncrease && n > lastRef.current) {
      playNewOrderChime();
    }
    lastRef.current = n;
    initialisedRef.current = true;
    setCount(n);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;

    const pull = async (playOnIncrease: boolean) => {
      const n = await fetchActionableOrderCount();
      if (cancelled) return;
      applyCount(n, playOnIncrease);
    };

    void pull(false);

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void pull(true);
      }, 350);
    };

    void realtimeConfigFn({ data: { projectId } }).then((config) => {
      if (cancelled || !config.url || !config.anonKey) return;
      supabase = createClient(config.url, config.anonKey);
      channel = supabase
        .channel(`admin-pending-orders-count-${projectId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
        .subscribe();
    });

    const poll = window.setInterval(() => void pull(true), 25_000);

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.clearInterval(poll);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [projectId, applyCount, fetchActionableOrderCount, realtimeConfigFn]);

  const value = useMemo(() => ({ pendingCount: count }), [count]);

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
