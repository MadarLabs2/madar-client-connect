import { useCallback, useEffect, useRef } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { bakeryProjectRealtimeConfig } from "@/lib/project-db.functions";

const POLL_VISIBLE_MS = 15_000;
const POLL_HIDDEN_MS = 60_000;

type Options = {
  projectId: string;
  enabled?: boolean;
  /** Called after debounce when orders table may have changed. */
  onOrdersChange: () => void;
};

/**
 * Keeps bakery admin in sync with the project DB orders table.
 * Realtime over anon key often fails without a project Supabase session (RLS),
 * so polling is the reliable fallback.
 */
export function useBakeryOrdersSync({ projectId, enabled = true, onOrdersChange }: Options) {
  const realtimeConfigFn = useServerFn(bakeryProjectRealtimeConfig);
  const onChangeRef = useRef(onOrdersChange);
  onChangeRef.current = onOrdersChange;

  const notify = useCallback(() => {
    onChangeRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let debounceRef: ReturnType<typeof setTimeout> | null = null;
    let pollRef: ReturnType<typeof setInterval> | null = null;

    const schedule = () => {
      if (debounceRef) clearTimeout(debounceRef);
      debounceRef = setTimeout(() => {
        debounceRef = null;
        if (!cancelled) notify();
      }, 300);
    };

    const startPoll = () => {
      if (pollRef) clearInterval(pollRef);
      const ms = document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
      pollRef = window.setInterval(schedule, ms);
    };

    void realtimeConfigFn({ data: { projectId } }).then((config) => {
      if (cancelled || !config.url || !config.anonKey) return;
      supabase = createClient(config.url, config.anonKey, {
        realtime: { params: { eventsPerSecond: 4 } },
      });
      channel = supabase
        .channel(`bakery-orders-sync-${projectId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, schedule)
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[BakeryOrdersSync] realtime unavailable:", status, err?.message);
          }
        });
    });

    startPoll();
    const onVisibility = () => startPoll();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (debounceRef) clearTimeout(debounceRef);
      if (pollRef) clearInterval(pollRef);
      document.removeEventListener("visibilitychange", onVisibility);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [projectId, enabled, notify, realtimeConfigFn]);
}
