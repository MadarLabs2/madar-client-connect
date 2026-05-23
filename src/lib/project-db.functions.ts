import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import { getProjectClient, ALLOWED_TABLES } from "./project-db.server";

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

export const projectList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      projectId: z.string().uuid(),
      table: TableSchema,
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await isAdmin(context.userId);
    const client = await getProjectClient(data.projectId, context.userId, admin);
    const { data: rows, error } = await client
      .from(data.table)
      .select("*")
      .limit(data.limit);
    if (error) return { rows: [], error: error.message };
    return { rows: rows ?? [], error: null };
  });

export const projectInsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      projectId: z.string().uuid(),
      table: TableSchema,
      row: z.record(z.string(), z.unknown()),
    }).parse(input),
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
    z.object({
      projectId: z.string().uuid(),
      table: TableSchema,
      id: z.union([z.string(), z.number()]),
      row: z.record(z.string(), z.unknown()),
    }).parse(input),
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
    z.object({
      projectId: z.string().uuid(),
      table: TableSchema,
      id: z.union([z.string(), z.number()]),
    }).parse(input),
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
      .select("id,name,client_id,supabase_url,supabase_service_key,supabase_anon_key,live_url,cms_url,status,type,progress")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");
    if (!admin && project.client_id !== context.userId) throw new Error("Forbidden");
    return {
      id: project.id,
      name: project.name,
      hasCredentials: !!(project.supabase_url && (project.supabase_service_key || project.supabase_anon_key)),
      liveUrl: project.live_url,
      status: project.status,
      type: project.type,
      progress: project.progress,
    };
  });

export const projectUploadImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      projectId: z.string().uuid(),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(100),
      dataBase64: z.string().min(1),
      bucket: z.string().min(1).max(100).default("product-images"),
      folder: z.string().max(200).optional(),
    }).parse(input),
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
