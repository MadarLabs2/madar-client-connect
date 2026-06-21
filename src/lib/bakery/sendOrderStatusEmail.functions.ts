import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import { getProjectClient } from "@/lib/project-db.server";
import {
  isProjectEmailConfigured,
  ORDER_STATUS_EMAIL_TYPE,
  sendOrderStatusEmail,
} from "@/lib/bakery/emailService";
import { getProjectEmailConfig } from "@/lib/project-email.server";

async function isPlatformAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export type SendOrderStatusEmailResult = {
  ok: boolean;
  emailSent: boolean;
  alreadySent?: boolean;
  noEmail?: boolean;
  error?: string;
};

export const sendOrderStatusEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        orderId: z.string().uuid(),
        newStatus: z.string().min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SendOrderStatusEmailResult> => {
    const { projectId, orderId, newStatus } = data;
    const admin = await isPlatformAdmin(context.userId);

    if (!ORDER_STATUS_EMAIL_TYPE[newStatus]) {
      return { ok: true, emailSent: false, noEmail: true };
    }

    const emailConfig = await getProjectEmailConfig(projectId);
    if (!emailConfig || !isProjectEmailConfigured(emailConfig)) {
      return { ok: true, emailSent: false, error: "missing_resend_config" };
    }

    let projectDb;
    try {
      projectDb = await getProjectClient(projectId, context.userId, admin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "forbidden";
      return { ok: false, emailSent: false, error: msg };
    }

    const { data: order, error: orderError } = await projectDb
      .from("orders")
      .select("id, customer_name, customer_email, delivery_method, delivery_address, customer_locale")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return { ok: false, emailSent: false, error: "order_not_found" };
    }

    try {
      const result = await sendOrderStatusEmail(projectDb, emailConfig, {
        orderId: order.id,
        orderNumber: order.id.slice(0, 8).toUpperCase(),
        customerName: order.customer_name ?? "",
        customerEmail: order.customer_email ?? "",
        deliveryMethod: order.delivery_method ?? "pickup",
        deliveryAddress: order.delivery_address ?? null,
        status: newStatus,
        locale: order.customer_locale,
      });

      if (result.noEmail) return { ok: true, emailSent: false, noEmail: true };
      if (result.alreadySent) return { ok: true, emailSent: false, alreadySent: true };
      if (!result.ok) return { ok: true, emailSent: false, error: result.error };

      return { ok: true, emailSent: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "email_send_failed";
      console.error("[sendOrderStatusEmailFn]", msg);
      return { ok: true, emailSent: false, error: msg };
    }
  });
