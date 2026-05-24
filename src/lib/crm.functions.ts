import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin as extAdmin } from "@/integrations/external-db/client.server";
import { supabaseAdmin as cloudAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await extAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "won", "lost"] as const;

// ============ Leads ============

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await cloudAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const [lead, activities, communications, invoices] = await Promise.all([
      cloudAdmin.from("leads").select("*").eq("id", data.id).maybeSingle(),
      cloudAdmin.from("lead_activities").select("*").eq("lead_id", data.id).order("due_date", { ascending: true, nullsFirst: false }),
      cloudAdmin.from("lead_communications").select("*").eq("lead_id", data.id).order("occurred_at", { ascending: false }),
      cloudAdmin.from("lead_invoices").select("*").eq("lead_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (lead.error) throw new Error(lead.error.message);
    return {
      lead: lead.data,
      activities: activities.data ?? [],
      communications: communications.data ?? [],
      invoices: invoices.data ?? [],
    };
  });

const UpsertLeadSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
  source: z.string().max(100).optional().or(z.literal("")),
  stage: z.enum(LEAD_STAGES),
  value: z.number().min(0).max(99999999),
  currency: z.string().min(1).max(10),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export const upsertLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertLeadSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      source: data.source || null,
      stage: data.stage,
      value: data.value,
      currency: data.currency,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await cloudAdmin.from("leads").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await cloudAdmin.from("leads").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id };
  });

export const updateLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), stage: z.enum(LEAD_STAGES) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin.from("leads").update({ stage: data.stage }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Activities ============

const UpsertActivitySchema = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid(),
  type: z.enum(["call", "meeting", "email", "task", "note"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  due_date: z.string().nullable().optional(),
  completed: z.boolean().optional(),
});

export const upsertActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertActivitySchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = {
      lead_id: data.lead_id,
      type: data.type,
      title: data.title,
      description: data.description || null,
      due_date: data.due_date || null,
      completed: data.completed ?? false,
      completed_at: data.completed ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await cloudAdmin.from("lead_activities").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await cloudAdmin.from("lead_activities").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id };
  });

export const toggleActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin
      .from("lead_activities")
      .update({ completed: data.completed, completed_at: data.completed ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin.from("lead_activities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Communications ============

const AddCommSchema = z.object({
  lead_id: z.string().uuid(),
  channel: z.enum(["phone", "email",