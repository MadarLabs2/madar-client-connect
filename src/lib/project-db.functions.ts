import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import { ADMIN_VISIBLE_ORDERS_FILTER } from "@/lib/bakery/orderPayment";
import { extractStoragePath } from "@/lib/bakery/uploadValidation";
import { getProjectClient, ALLOWED_TABLES } from "./project-db.server";

const PRODUCT_IMAGES_BUCKET = "product-images";

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

const TableSchema = z.enum(ALLOWED_TABLES);
const EqValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const EqSchema = z.record(z.string().min(1), EqValueSchema);

export const projectList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        table: TableSchema,
        select: z.string().min(1).max(2000).optional().default("*"),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .optional()
          .default(200)
          .transform((limit) => Math.min(limit, 500)),
        orderColumn: z.string().min(1).max(120).optional(),
        orderAscending: z.boolean().optional().default(true),
        eq: EqSchema.optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    let query = client.from(data.table).select(data.select).limit(data.limit);
    if (data.orderColumn) query = query.order(data.orderColumn, { ascending: data.orderAscending });
    for (const [column, value] of Object.entries(data.eq)) {
      query = query.eq(column, value as string | number | boolean | null);
    }
    const { data: rows, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: rows ?? [], error: null };
  });

export const projectCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        table: TableSchema,
        eq: EqSchema.optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    let query = client.from(data.table).select("*", { count: "exact", head: true });
    for (const [column, value] of Object.entries(data.eq)) {
      query = query.eq(column, value as string | number | boolean | null);
    }
    const { count, error } = await query;
    if (error) return { count: 0, error: error.message };
    return { count: count ?? 0, error: null };
  });

export const bakeryOrdersList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        limit: z.coerce
          .number()
          .int()
          .min(1)
          .optional()
          .default(200)
          .transform((limit) => Math.min(limit, 500)),
        orderColumn: z.string().min(1).max(120).optional().default("created_at"),
        orderAscending: z.boolean().optional().default(false),
        eq: EqSchema.optional().default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    let query = client
      .from("orders")
      .select("*,order_items(*,products(image_url))")
      .or(ADMIN_VISIBLE_ORDERS_FILTER)
      .limit(data.limit)
      .order(data.orderColumn, { ascending: data.orderAscending });
    for (const [column, value] of Object.entries(data.eq)) {
      query = query.eq(column, value as string | number | boolean | null);
    }
    const { data: rows, error } = await query;
    if (error) return { rows: [], error: error.message };
    const normalizedRows = (rows ?? []).map((rawOrder) => {
      const order = rawOrder as Record<string, unknown>;
      const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
      return {
        ...order,
        order_items: orderItems.map((rawItem) => {
          const item = rawItem as Record<string, unknown>;
          const productRel = item.products;
          const product = Array.isArray(productRel)
            ? (productRel[0] as Record<string, unknown> | undefined)
            : (productRel as Record<string, unknown> | null | undefined);
          return {
            ...item,
            image_url: item.image_url ?? product?.image_url ?? null,
          };
        }),
      };
    });
    return { rows: normalizedRows, error: null };
  });

export const bakeryPendingOrdersCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const { count, error } = await client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("order_status", ["pending", "confirmed"])
      .or(ADMIN_VISIBLE_ORDERS_FILTER);
    if (error) return { count: 0, error: error.message };
    return { count: count ?? 0, error: null };
  });

export const bakeryProjectRealtimeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select("client_id, project_secrets(supabase_url, supabase_anon_key)")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error || !project) {
      return { url: null, anonKey: null, error: error?.message ?? "Project not found" };
    }
    if (!admin && project.client_id !== context.userId) {
      return { url: null, anonKey: null, error: "Forbidden" };
    }
    const secrets = Array.isArray(project.project_secrets)
      ? project.project_secrets[0]
      : project.project_secrets;
    return {
      url: secrets?.supabase_url ?? null,
      anonKey: secrets?.supabase_anon_key ?? null,
      error: null,
    };
  });

export const projectInsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        table: TableSchema,
        row: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const { error } = await client.from(data.table).insert(data.row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const projectUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        table: TableSchema,
        id: z.union([z.string(), z.number()]),
        row: z.record(z.string(), z.unknown()),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const { error } = await client.from(data.table).update(data.row).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const projectDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        table: TableSchema,
        id: z.union([z.string(), z.number()]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const { error } = await client.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const projectInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .select(
        "id,name,client_id,live_url,cms_url,status,type,progress,manage_template, project_secrets(supabase_url,supabase_service_key,supabase_anon_key)",
      )
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");
    if (!admin && project.client_id !== context.userId) throw new Error("Forbidden");
    const secrets = Array.isArray(project.project_secrets)
      ? project.project_secrets[0]
      : project.project_secrets;
    return {
      id: project.id,
      name: project.name,
      hasCredentials: !!(
        secrets?.supabase_url &&
        (secrets.supabase_service_key || secrets.supabase_anon_key)
      ),
      liveUrl: project.live_url,
      status: project.status,
      type: project.type,
      progress: project.progress,
      manageTemplate: project.manage_template ?? "ecommerce",
    };
  });

export const projectUploadImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(100),
        dataBase64: z.string().min(1),
        bucket: z.string().min(1).max(100).default("product-images"),
        folder: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    const ext = (data.fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const cleanFolder = (data.folder || "").replace(/^\/+|\/+$/g, "");
    const path = cleanFolder ? `${cleanFolder}/${safeName}` : safeName;

    // Ensure bucket exists (best-effort, ignore "already exists")
    await client.storage.createBucket(data.bucket, { public: true }).catch(() => {});

    const { error: upErr } = await client.storage
      .from(data.bucket)
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = client.storage.from(data.bucket).getPublicUrl(path);
    return { url: pub.publicUrl, path };
  });

export const projectSendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        subject: z.string().min(1).max(200),
        subjectAr: z.string().max(200).optional().default(""),
        subjectEn: z.string().max(200).optional().default(""),
        body: z.string().min(1).max(20000),
        bodyAr: z.string().max(20000).optional().default(""),
        bodyEn: z.string().max(20000).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const { data: subs, error } = await client
      .from("newsletter_subscribers")
      .select("email, locale");
    if (error) throw new Error(error.message);
    const recipients = (subs ?? []) as Array<{ email: string; locale: string }>;

    // Try invoking project's edge function if it exists
    try {
      const { data: res, error: invErr } = await client.functions.invoke(
        "send-newsletter-broadcast",
        {
          body: {
            subject: data.subject,
            subjectAr: data.subjectAr,
            subjectEn: data.subjectEn,
            body: data.body,
            bodyAr: data.bodyAr,
            bodyEn: data.bodyEn,
          },
        },
      );
      if (!invErr) {
        const sentValue =
          res && typeof res === "object" && "sent" in res
            ? Number((res as Record<string, unknown>).sent)
            : NaN;
        const sent = Number.isFinite(sentValue) ? sentValue : recipients.length;
        return { ok: true, sent };
      }
    } catch {
      // fall through
    }
    // Fallback: no edge function available — return queued count only
    return { ok: false, sent: 0, queued: recipients.length, error: "no_edge_function" };
  });

export const projectSafeDeleteStorageFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        urls: z.array(z.string().min(1).max(2000)).max(50),
        excludeProductId: z.string().uuid().optional(),
        excludeCategoryId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);

    const [{ data: products }, { data: categories }] = await Promise.all([
      client.from("products").select("id, image_url, gallery_urls"),
      client.from("categories").select("id, image_url"),
    ]);

    const isReferenced = (url: string) => {
      for (const p of products ?? []) {
        const row = p as { id?: string; image_url?: string; gallery_urls?: unknown };
        if (row.id === data.excludeProductId) continue;
        if (row.image_url === url) return true;
        const gallery = Array.isArray(row.gallery_urls) ? row.gallery_urls : [];
        if (gallery.includes(url)) return true;
      }
      for (const c of categories ?? []) {
        const row = c as { id?: string; image_url?: string };
        if (row.id === data.excludeCategoryId) continue;
        if (row.image_url === url) return true;
      }
      return false;
    };

    for (const url of data.urls) {
      const path = extractStoragePath(url);
      if (!path || isReferenced(url)) continue;
      const { error } = await client.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
      if (error) console.warn("[safeDeleteStorageFiles] remove failed:", error.message);
    }

    return { ok: true };
  });
