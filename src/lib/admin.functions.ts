import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const InviteSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(120),
  company: z.string().min(1).max(120),
});

export const inviteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, company: data.company },
    });
    if (error) throw new Error(error.message);
    if (!created.user) throw new Error("Failed to create user");
    await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, company: data.company })
      .eq("id", created.user.id);
    return { ok: true, userId: created.user.id };
  });

const UpdateClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  company: z.string().min(1).max(120),
});

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateClientSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, company: data.company })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ProjectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(["website", "ecommerce", "web_app", "branding", "marketing"]),
  manageTemplate: z.enum(["ecommerce", "bakery"]).default("ecommerce"),
  status: z.enum(["planning", "in_progress", "review", "live", "paused"]),
  progress: z.number().int().min(0).max(100),
  liveUrl: z.string().url().max(500).optional().or(z.literal("")),
  cmsUrl: z.string().url().max(500).optional().or(z.literal("")),
  supabaseUrl: z.string().url().max(500).optional().or(z.literal("")),
  supabaseAnonKey: z.string().max(2000).optional().or(z.literal("")),
  supabaseServiceKey: z.string().max(2000).optional().or(z.literal("")),
});

function projectPayload(d: z.infer<typeof ProjectSchema>) {
  return {
    client_id: d.clientId,
    name: d.name,
    type: d.type,
    manage_template: d.manageTemplate,
    status: d.status,
    progress: d.progress,
    live_url: d.liveUrl || null,
    cms_url: d.cmsUrl || null,
  };
}

function secretsPayload(projectId: string, d: z.infer<typeof ProjectSchema>) {
  return {
    project_id: projectId,
    supabase_url: d.supabaseUrl || null,
    supabase_anon_key: d.supabaseAnonKey || null,
    supabase_service_key: d.supabaseServiceKey || null,
  };
}

async function upsertProjectSecrets(projectId: string, d: z.infer<typeof ProjectSchema>) {
  const hasSecrets = d.supabaseUrl || d.supabaseAnonKey || d.supabaseServiceKey;
  if (!hasSecrets) return;
  const { error } = await supabaseAdmin
    .from("project_secrets")
    .upsert(secretsPayload(projectId, d));
  if (error) throw new Error(error.message);
}

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin
      .from("projects")
      .insert(projectPayload(data))
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await upsertProjectSecrets(created.id, data);
    return { ok: true };
  });

const UpdateProjectSchema = ProjectSchema.extend({ id: z.string().uuid() });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("projects")
      .update(projectPayload(data))
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await upsertProjectSecrets(data.id, data);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Products ============
const ProductDataSchema = z.record(z.string(), z.unknown());

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      projectId: z.string().uuid(),
      data: ProductDataSchema,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ data: data.data })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("products")
        .insert({ project_id: data.projectId, data: data.data });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
