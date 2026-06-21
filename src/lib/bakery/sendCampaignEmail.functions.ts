import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/external-db/auth-middleware";
import { supabaseAdmin } from "@/integrations/external-db/client.server";
import {
  isProjectEmailConfigured,
  isProjectEmailTestMode,
  sendOfferEmail,
} from "@/lib/bakery/emailService";
import { getProjectEmailConfig } from "@/lib/project-email.server";
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

async function loadSubscriberEmails(
  projectDb: Awaited<ReturnType<typeof getProjectClient>>,
): Promise<string[]> {
  const { data: subs, error: subsError } = await projectDb
    .from("email_subscribers")
    .select("email")
    .eq("is_active", true);

  if (!subsError && (subs?.length ?? 0) > 0) {
    return subs
      .map((r) => r.email?.trim())
      .filter((e): e is string => Boolean(e && e.includes("@")));
  }

  const { data: nl, error: nlError } = await projectDb.from("newsletter_subscribers").select("email");
  if (nlError) return [];
  return (nl ?? [])
    .map((r) => r.email?.trim())
    .filter((e): e is string => Boolean(e && e.includes("@")));
}

const sendOfferInput = z.object({
  projectId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  message: z.string().min(1).max(50_000),
  coupon_code: z.string().max(100).nullable(),
  discount_percent: z.number().min(0).max(100).nullable().optional(),
  test_recipient: z.string().email().optional(),
});

export type SendCampaignResult = {
  ok: boolean;
  inserted: boolean;
  campaignId?: string;
  sent: number;
  failed: number;
  subscriberCount: number;
  recipientsType: "test" | "all_subscribers";
  noMailProvider: boolean;
  testMode: boolean;
  error?: string;
  resendLastError?: string;
};

export const sendCampaignEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendOfferInput.parse(input))
  .handler(async ({ data, context }): Promise<SendCampaignResult> => {
    const { projectId, subject, message, coupon_code, discount_percent, test_recipient } = data;
    const admin = await isPlatformAdmin(context.userId);

    let projectDb: Awaited<ReturnType<typeof getProjectClient>>;
    try {
      projectDb = await getProjectClient(projectId, context.userId, admin);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "forbidden";
      return {
        ok: false,
        inserted: false,
        sent: 0,
        failed: 0,
        subscriberCount: 0,
        recipientsType: "test",
        noMailProvider: false,
        testMode: false,
        error: msg,
      };
    }

    const emailConfig = await getProjectEmailConfig(projectId);
    const testMode = emailConfig ? isProjectEmailTestMode(emailConfig) : false;
    const configured = isProjectEmailConfigured(emailConfig);

    let recipients: string[] = [];
    let recipientsType: "test" | "all_subscribers" = "test";

    if (testMode) {
      const testEmail = (
        test_recipient?.trim() ||
        emailConfig?.adminEmail?.trim() ||
        ""
      ).trim();
      if (testEmail) recipients = [testEmail];
    } else {
      recipientsType = "all_subscribers";
      recipients = await loadSubscriberEmails(projectDb);
    }

    const { data: campaign, error: insertError } = await projectDb
      .from("email_campaigns")
      .insert({
        subject,
        message,
        discount_code: coupon_code,
        discount_percent: discount_percent ?? null,
        recipients_type: recipientsType,
        recipients_count: recipients.length,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !campaign) {
      return {
        ok: false,
        inserted: false,
        sent: 0,
        failed: 0,
        subscriberCount: recipients.length,
        recipientsType,
        noMailProvider: false,
        testMode,
        error: insertError?.message ?? "insert_failed",
      };
    }

    const campaignId = campaign.id as string;

    if (!configured || !emailConfig) {
      await projectDb.from("email_campaigns").update({ status: "draft" }).eq("id", campaignId);
      return {
        ok: true,
        inserted: true,
        campaignId,
        sent: 0,
        failed: 0,
        subscriberCount: recipients.length,
        recipientsType,
        noMailProvider: true,
        testMode,
      };
    }

    if (recipients.length === 0) {
      await projectDb
        .from("email_campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipients_count: 0 })
        .eq("id", campaignId);
      return {
        ok: true,
        inserted: true,
        campaignId,
        sent: 0,
        failed: 0,
        subscriberCount: 0,
        recipientsType,
        noMailProvider: false,
        testMode,
      };
    }

    let sent = 0;
    let failed = 0;
    let resendLastError: string | undefined;

    for (const to of recipients) {
      const result = await sendOfferEmail(projectDb, emailConfig, {
        to,
        subject,
        message,
        couponCode: coupon_code,
        discountPercent: discount_percent ?? null,
        campaignId,
        testRecipientOverride: test_recipient || emailConfig.adminEmail,
      });

      if (result.ok) sent += 1;
      else {
        failed += 1;
        resendLastError = result.error;
      }
    }

    const finalStatus = failed === recipients.length ? "failed" : "sent";
    await projectDb
      .from("email_campaigns")
      .update({
        status: finalStatus,
        sent_at: new Date().toISOString(),
        recipients_count: sent,
      })
      .eq("id", campaignId);

    return {
      ok: true,
      inserted: true,
      campaignId,
      sent,
      failed,
      subscriberCount: recipients.length,
      recipientsType,
      noMailProvider: false,
      testMode,
      resendLastError,
    };
  });

export const getBakeryEmailStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await isPlatformAdmin(context.userId);
    try {
      await getProjectClient(data.projectId, context.userId, admin);
    } catch {
      return { configured: false, testMode: false, testRecipient: "" };
    }
    const config = await getProjectEmailConfig(data.projectId);
    return {
      configured: isProjectEmailConfigured(config),
      testMode: config ? isProjectEmailTestMode(config) : false,
      testRecipient: config?.adminEmail?.trim() ?? "",
    };
  });
