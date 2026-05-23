import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const URL = process.env.EXTERNAL_DB_URL;
    const KEY = process.env.EXTERNAL_DB_ANON_KEY;
    if (!URL || !KEY) {
      throw new Error('Missing EXTERNAL_DB_URL or EXTERNAL_DB_ANON_KEY');
    }

    const request = getRequest();
    const authHeader = request?.headers?.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized: missing Bearer token');
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(URL, KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Error('Unauthorized: invalid token');
    }

    return next({
      context: { supabase, userId: data.claims.sub, claims: data.claims },
    });
  },
);
