// External Supabase client - points to user's own Supabase project.
// URL and anon key are public by design (anon key is bundled in browser).
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ddjjlpnianvfuywxqcin.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkampscG5pYW52ZnV5d3hxY2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzA5OTcsImV4cCI6MjA5NTEwNjk5N30.LHLhevtfI7OMWaaPUAT-ru8hnuzTsjH_iJdcpvEtefc';

function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
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
