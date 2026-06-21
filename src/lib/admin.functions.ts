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
  resendApiKey: z.string().max(500).optional().or(z.literal("")),
  resendFromEmail: z.string().max(500).optional().or(z.literal("")),
  resendAdminEmail: z.string().email().max(255).optional().or(z.literal("")),
  emailTestMode: z.boolean().optional().default(false),
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

async function upsertProjectSecrets(projectId: string, d: z.infer<typeof ProjectSchema>) {
  const { data: existing } = await supabaseAdmin
    .from("project_secrets")
    .select(
      "supabase_url, supabase_anon_key, supabase_service_key, resend_api_key, resend_from_email, resend_admin_email, email_test_mode",
    )
    .eq("project_id", projectId)
    .maybeSingle();

  const hasAny =
    d.supabaseUrl ||
    d.supabaseAnonKey ||
    d.supabaseServiceKey ||
    d.resendApiKey ||
    d.resendFromEmail ||
    d.resendAdminEmail ||
    existing;
  if (!hasAny) return;

  const payload = {
    project_id: projectId,
    supabase_url: d.supabaseUrl || existing?.supabase_url || null,
    supabase_anon_key: d.supabaseAnonKey || existing?.supabase_anon_key || null,
    supabase_service_key: d.supabaseServiceKey || existing?.supabase_service_key || null,
    resend_api_key: d.resendApiKey?.trim() || existing?.resend_api_key || null,
    resend_from_email: d.resendFromEmail?.trim() || existing?.resend_from_email || null,
    resend_admin_email: d.resendAdminEmail?.trim() || existing?.resend_admin_email || null,
    email_test_mode: d.emailTestMode ?? existing?.email_test_mode ?? false,
  };

  const { error } = await supabaseAdmin.from("project_secrets").upsert(payload);
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
