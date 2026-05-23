import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/external-db/client.server";

const cache = new Map<string, SupabaseClient>();

export async function getProjectClient(projectId: string, userId: string, isAdmin: boolean) {
  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("id,client_id,supabase_url,supabase_service_key,supabase_anon_key")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!project) throw new Error("Project not found");
  if (!isAdmin && project.client_id !== userId) throw new Error("Forbidden");
  const url = project.supabase_url;
  const key = project.supabase_service_key || project.supabase_anon_key;
  if (!url || !key) throw new Error("Project has no Supabase credentials configured");
  const cacheKey = `${url}:${key}`;
  let client = cache.get(cacheKey);
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cache.set(cacheKey, client);
  }
  return client;
}

export const ALLOWED_TABLES = [
  "products",
  "categories",
  "orders",
  "order_items",
  "profiles",
  "coupons",
  "newsletter_subscribers",
  "site_settings",
] as const;
export type AllowedTable = (typeof ALLOWED_TABLES)[number];
