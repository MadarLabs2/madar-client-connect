import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import { getProjectSupabaseSecrets } from "@/lib/project-db.server";

async function isPlatformAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/**
 * Heba's `send-transactional-email` requires a real clothing-store admin JWT
 * (`auth.getUser` + `profiles.role === 'admin'`). Madar authenticates against a
 * different Supabase project, so the service-role key alone gets 401.
 *
 * Mint a short-lived store-admin session via service role (no email is sent).
 */
async function mintClothingStoreAdminAccessToken(
  url: string,
  serviceKey: string,
  anonKey: string,
): Promise<string | null> {
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: adminProfile, error: profileErr } = await service
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (profileErr || !adminProfile?.id) {
    console.error(
      "[sendEcommerceOrderStatusEmailFn] no clothing-store admin profile:",
      profileErr?.message ?? "not found",
    );
    return null;
  }

  let email = String(adminProfile.email ?? "").trim();
  if (!email) {
    const { data: userData, error: userErr } = await service.auth.admin.getUserById(
      adminProfile.id,
    );
    if (userErr || !userData.user?.email) {
      console.error(
        "[sendEcommerceOrderStatusEmailFn] admin email missing:",
        userErr?.message ?? "no email",
      );
      return null;
    }
    email = userData.user.email;
  }

  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    console.error(
      "[sendEcommerceOrderStatusEmailFn] generateLink failed:",
      linkErr?.message ?? "no token",
    );
    return null;
  }

  // Ephemeral anon client — never reuse the cached service-role client for OTP.
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: sessionData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: hashedToken,
  });
  const accessToken = sessionData.session?.access_token;
  if (otpErr || !accessToken) {
    console.error(
      "[sendEcommerceOrderStatusEmailFn] verifyOtp failed:",
      otpErr?.message ?? "no session",
    );
    return null;
  }

  return accessToken;
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

    let secrets;
    try {
      secrets = await getProjectSupabaseSecrets(data.projectId, context.userId, admin);
    } catch (e) {
      console.error("[sendEcommerceOrderStatusEmailFn] project access denied:", e);
      return;
    }

    if (!secrets.serviceKey || !secrets.anonKey) {
      console.error(
        "[sendEcommerceOrderStatusEmailFn] project needs both supabase_service_key and supabase_anon_key",
      );
      return;
    }

    const accessToken = await mintClothingStoreAdminAccessToken(
      secrets.url,
      secrets.serviceKey,
      secrets.anonKey,
    );
    if (!accessToken) return;

    const client = createClient(secrets.url, secrets.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await client.functions.invoke("send-transactional-email", {
      body: {
        type: "order_status",
        orderId: data.orderId,
        newStatus: data.newStatus,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      // FunctionsHttpError carries the edge function's JSON error body in context.
      const ctx = (error as { context?: Response }).context;
      let detail = "";
      if (ctx && typeof ctx.text === "function") {
        detail = await ctx.text().catch(() => "");
      }
      console.error(
        "[sendEcommerceOrderStatusEmailFn] invoke error:",
        error.message,
        detail || "(no body)",
      );
    }
  });
