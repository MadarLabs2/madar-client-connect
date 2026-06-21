import { supabaseAdmin } from "@/integrations/external-db/client.server";

export type ProjectEmailConfig = {
  resendApiKey: string;
  resendFromEmail: string;
  adminEmail: string;
  emailTestMode: boolean;
};

export async function getProjectEmailConfig(
  projectId: string,
): Promise<ProjectEmailConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("project_secrets")
    .select("resend_api_key, resend_from_email, resend_admin_email, email_test_mode")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error("[project-email] Failed to load secrets:", error.message);
    return null;
  }

  const apiKey = data?.resend_api_key?.trim() ?? "";
  const from = data?.resend_from_email?.trim() ?? "";
  if (!apiKey || !from) return null;

  return {
    resendApiKey: apiKey,
    resendFromEmail: from,
    adminEmail: data?.resend_admin_email?.trim() ?? "",
    emailTestMode: data?.email_test_mode === true,
  };
}
