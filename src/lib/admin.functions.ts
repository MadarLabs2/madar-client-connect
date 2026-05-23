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

    // Trigger creates profile + 'client' role. Ensure profile has name/company
    // in case metadata wasn't populated yet.
    await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, company: data.company })
      .eq("id", created.user.id);

    return { ok: true, userId: created.user.id };
  });

const ProjectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: z.enum(["website", "ecommerce", "web_app", "branding", "marketing"]),
  status: z.enum(["planning", "in_progress", "review", "live", "paused"]),
  progress: z.number().int().min(0).max(100),
  liveUrl: z.string().url().max(500).optional().or(z.literal("")),
  cmsUrl: z.string().url().max(500).optional().or(z.literal("")),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ProjectSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("projects").insert({
      client_id: data.clientId,
      name: data.name,
      type: data.type,
      status: data.status,
      progress: data.progress,
      live_url: data.liveUrl || null,
      cms_url: data.cmsUrl || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
