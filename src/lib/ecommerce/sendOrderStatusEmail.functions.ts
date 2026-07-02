import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import { getProjectClient } from "@/lib/project-db.server";

async function isPlatformAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/** Fire-and-forget: invokes project `send-transactional-email` edge function (SMTP). */
export const sendEcommerceOrderStatusEmailFn = createServerFn({ method: "POST" })
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
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);

    let client;
    try {
      client = await getProjectClient(data.projectId, context.userId, admin);
    } catch (e) {
      console.error("[sendEcommerceOrderStatusEmailFn] project access denied:", e);
      return;
    }

    const { error } = await client.functions.invoke("send-transactional-email", {
      body: {
        type: "order_status",
        orderId: data.orderId,
        newStatus: data.newStatus,
      },
    });

    if (error) {
      console.error("[sendEcommerceOrderStatusEmailFn] invoke error:", error);
    }
  });
