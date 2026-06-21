// Server-side admin client for external Supabase - bypasses RLS.
// Use only in server functions / server routes.
import { createClient } from '@supabase/supabase-js';
import { getExternalDbServiceRoleKey, getExternalDbUrl } from './config';

function createAdminClient() {
  const URL = getExternalDbUrl();
  const KEY = getExternalDbServiceRoleKey();
  if (!KEY) {
    throw new Error(
      'Missing EXTERNAL_DB_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY). Add it to .env — Supabase Dashboard → Settings → API → service_role.',
    );
  }
  return createClient(URL, KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _admin: ReturnType<typeof createAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    if (!_admin) _admin = createAdminClient();
    return Reflect.get(_admin, prop, receiver);
  },
});
