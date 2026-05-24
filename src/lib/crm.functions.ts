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
const ACTIVITY_TYPES = ["call", "meeting", "email", "task", "note"] as const;
const COMM_CHANNELS = ["phone", "email", "whatsapp", "meeting", "other"] as const;
const COMM_DIRECTIONS = ["in", "out"] as const;
const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;

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
  type: z.enum(ACTIVITY_TYPES),
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
  channel: z.enum(COMM_CHANNELS),
  direction: z.enum(COMM_DIRECTIONS),
  content: z.string().min(1).max(5000),
  occurred_at: z.string().optional(),
});

export const addCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AddCommSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin.from("lead_communications").insert({
      lead_id: data.lead_id,
      channel: data.channel,
      direction: data.direction,
      content: data.content,
      occurred_at: data.occurred_at || new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin.from("lead_communications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Invoices ============

const UpsertInvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  lead_id: z.string().uuid(),
  number: z.string().max(50).optional().or(z.literal("")),
  amount: z.number().min(0).max(99999999),
  currency: z.string().min(1).max(10),
  status: z.enum(INVOICE_STATUSES),
  issued_at: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const upsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertInvoiceSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = {
      lead_id: data.lead_id,
      number: data.number || null,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      issued_at: data.issued_at || null,
      due_date: data.due_date || null,
      paid_at: data.paid_at || (data.status === "paid" ? new Date().toISOString() : null),
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await cloudAdmin.from("lead_invoices").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await cloudAdmin.from("lead_invoices").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await cloudAdmin.from("lead_invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Dashboard aggregate ============

export const getCrmOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [leadsR, paidR, openInvR, todayActR, recentActR, recentCommR] = await Promise.all([
      cloudAdmin.from("leads").select("id,name,company,stage,value,currency,created_at").order("created_at", { ascending: false }),
      cloudAdmin.from("lead_invoices").select("amount,currency,status,paid_at"),
      cloudAdmin.from("lead_invoices").select("amount,currency,status").in("status", ["sent", "overdue"]),
      cloudAdmin
        .from("lead_activities")
        .select("id,lead_id,type,title,due_date,completed")
        .eq("completed", false)
        .lt("due_date", tomorrow.toISOString())
        .order("due_date", { ascending: true }),
      cloudAdmin.from("lead_activities").select("id,lead_id,type,title,created_at,completed").order("created_at", { ascending: false }).limit(8),
      cloudAdmin.from("lead_communications").select("id,lead_id,channel,direction,content,occurred_at").order("occurred_at", { ascending: false }).limit(8),
    ]);

    if (leadsR.error) throw new Error(leadsR.error.message);
    return {
      leads: leadsR.data ?? [],
      invoices: {
        paid: paidR.data ?? [],
        open: openInvR.data ?? [],
      },
      todayTasks: todayActR.data ?? [],
      recentActivities: recentActR.data ?? [],
      recentCommunications: recentCommR.data ?? [],
    };
  });
