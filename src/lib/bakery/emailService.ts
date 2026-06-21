/**
 * Bakery order status emails via Resend (per-project config from project_secrets).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { orderStatusTemplate, type OrderStatusEmailData } from "@/lib/bakery/emailTemplates";
import type { ProjectEmailConfig } from "@/lib/project-email.server";

export type EmailType =
  | "order_status_confirmed"
  | "order_status_preparing"
  | "order_status_ready"
  | "order_status_delivered"
  | "order_status_cancelled";

export type EmailLogStatus = "pending" | "processing" | "sent" | "failed";

export const ORDER_STATUS_EMAIL_TYPE: Partial<Record<string, EmailType>> = {
  confirmed: "order_status_confirmed",
  preparing: "order_status_preparing",
  ready: "order_status_ready",
  out_for_delivery: "order_status_ready",
  completed: "order_status_delivered",
  cancelled: "order_status_cancelled",
};

function isEmailTestMode(config: ProjectEmailConfig): boolean {
  if (config.emailTestMode) return true;
  return config.resendFromEmail.includes("@resend.dev");
}

function getTestRecipientEmail(config: ProjectEmailConfig): string {
  return config.adminEmail.trim();
}

function resolveRecipient(
  config: ProjectEmailConfig,
  intendedEmail: string,
): { to: string; testModeNote?: string } {
  if (!isEmailTestMode(config)) {
    return { to: intendedEmail.trim() };
  }
  const testTo = getTestRecipientEmail(config);
  if (!testTo) return { to: intendedEmail.trim() };
  if (testTo.toLowerCase() === intendedEmail.trim().toLowerCase()) {
    return { to: testTo };
  }
  return {
    to: testTo,
    testModeNote: `[Test mode] This email was intended for ${intendedEmail}. After verifying your domain in Resend, disable test mode to send to customers.`,
  };
}

function normalizeFromAddress(from: string): string | null {
  const trimmed = from.trim().replace(/^["']|["']$/g, "");
  if (!trimmed || /https?:\/\//i.test(trimmed) || !trimmed.includes("@")) return null;
  const emailPart = trimmed.includes("<")
    ? trimmed.slice(trimmed.indexOf("<") + 1, trimmed.indexOf(">"))
    : trimmed;
  const domain = emailPart.split("@")[1]?.toLowerCase() ?? "";
  if (["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)) {
    return null;
  }
  return trimmed;
}

export type SendEmailResult = {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  actualRecipient: string;
};

async function sendHtmlEmail(
  config: ProjectEmailConfig,
  to: string,
  subject: string,
  html: string,
): Promise<SendEmailResult> {
  const from = normalizeFromAddress(config.resendFromEmail);
  if (!from || !config.resendApiKey.trim()) {
    return { ok: false, error: "missing_resend_config", actualRecipient: to };
  }

  const resend = new Resend(config.resendApiKey.trim());
  try {
    const { data, error } = await resend.emails.send({ from, to: [to], subject, html });
    if (error) return { ok: false, error: error.message, actualRecipient: to };
    return { ok: true, providerMessageId: data?.id, actualRecipient: to };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_send_error";
    console.error("[bakery/emailService] Resend error:", msg);
    return { ok: false, error: msg, actualRecipient: to };
  }
}

async function sendAndLogOrderEmail(
  db: SupabaseClient,
  config: ProjectEmailConfig,
  opts: {
    orderId: string;
    emailType: EmailType;
    recipientEmail: string;
    subject: string;
    html: string;
  },
): Promise<SendEmailResult & { alreadySent: boolean }> {
  const { orderId, emailType, recipientEmail, subject, html } = opts;

  try {
    const { data: sent } = await db
      .from("email_logs")
      .select("id, recipient_email")
      .eq("order_id", orderId)
      .eq("email_type", emailType)
      .eq("status", "sent")
      .maybeSingle();

    if (sent && sent.recipient_email?.trim().toLowerCase() === recipientEmail.trim().toLowerCase()) {
      return { ok: true, alreadySent: true, actualRecipient: recipientEmail };
    }
  } catch (e) {
    console.warn("[bakery/emailService] Dedup lookup skipped:", e);
  }

  const result = await sendHtmlEmail(config, recipientEmail, subject, html);
  const now = new Date().toISOString();
  const logFields = {
    recipient_email: recipientEmail,
    subject,
    status: (result.ok ? "sent" : "failed") as EmailLogStatus,
    sent_at: result.ok ? now : null,
    provider_message_id: result.providerMessageId ?? null,
    error_message: result.ok ? null : (result.error ?? null),
  };

  try {
    const { data: existing } = await db
      .from("email_logs")
      .select("id, attempt_count")
      .eq("order_id", orderId)
      .eq("email_type", emailType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await db
        .from("email_logs")
        .update({ ...logFields, attempt_count: (existing.attempt_count ?? 0) + 1 })
        .eq("id", existing.id);
    } else {
      await db.from("email_logs").insert({
        order_id: orderId,
        email_type: emailType,
        attempt_count: 1,
        ...logFields,
      });
    }
  } catch (e) {
    console.error("[bakery/emailService] Log write failed:", e);
  }

  return { ...result, alreadySent: false };
}

export async function sendOrderStatusEmail(
  db: SupabaseClient,
  config: ProjectEmailConfig,
  statusData: OrderStatusEmailData & { orderId: string },
): Promise<SendEmailResult & { alreadySent: boolean; noEmail: boolean }> {
  const emailType = ORDER_STATUS_EMAIL_TYPE[statusData.status];
  if (!emailType) {
    return { ok: true, alreadySent: false, noEmail: true, actualRecipient: "" };
  }

  const email = statusData.customerEmail?.trim();
  if (!email) {
    return { ok: false, alreadySent: false, noEmail: true, error: "missing_customer_email", actualRecipient: "" };
  }

  const { to, testModeNote } = resolveRecipient(config, email);
  const { subject, html } = orderStatusTemplate({ ...statusData, testModeNote });

  const result = await sendAndLogOrderEmail(db, config, {
    orderId: statusData.orderId,
    emailType,
    recipientEmail: to,
    subject,
    html,
  });

  return { ...result, noEmail: false };
}

export function isProjectEmailConfigured(config: ProjectEmailConfig | null): boolean {
  if (!config) return false;
  return Boolean(config.resendApiKey.trim() && normalizeFromAddress(config.resendFromEmail));
}
