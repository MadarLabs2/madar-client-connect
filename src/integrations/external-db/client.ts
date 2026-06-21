// Platform Supabase client — auth, clients, projects (not per-store DB).
import { createClient } from "@supabase/supabase-js";
import { EXTERNAL_DB_DEFAULT_ANON_KEY, EXTERNAL_DB_DEFAULT_URL } from "./config";

const DEPRECATED_PROJECT_REF = "ddjjlpnianvfuywxqcin";

function pickEnv(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (trimmed.includes(DEPRECATED_PROJECT_REF)) continue;
    return trimmed;
  }
  return undefined;
}

const SUPABASE_URL =
  pickEnv(import.meta.env.VITE_EXTERNAL_DB_URL, import.meta.env.VITE_SUPABASE_URL) ??
  EXTERNAL_DB_DEFAULT_URL;

const SUPABASE_ANON_KEY =
  pickEnv(import.meta.env.VITE_EXTERNAL_DB_ANON_KEY, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
  EXTERNAL_DB_DEFAULT_ANON_KEY;

function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
