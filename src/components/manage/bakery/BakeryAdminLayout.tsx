import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BakeryShell } from "@/components/manage/bakery/BakeryShell";
import { BakeryPendingOrdersProvider } from "@/components/manage/bakery/BakeryPendingOrdersContext";
import { useBakeryT } from "@/lib/bakery/i18n";
import { useAuth } from "@/lib/auth";

type BakeryAdminLayoutProps = {
  projectId: string;
  liveUrl?: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
};

export function BakeryAdminLoadingScreen() {
  const { t } = useBakeryT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F9F7] px-4 text-muted-foreground">
      {t("adminLoading")}
    </div>
  );
}

export function BakeryAdminRedirectScreen() {
  const { t } = useBakeryT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F9F7] px-4 text-muted-foreground">
      {t("adminRedirecting")}
    </div>
  );
}

/** Bakery admin shell layout — mirrors `/admin` layout in the original bakery app. */
export function BakeryAdminLayout({
  projectId,
  liveUrl,
  activeTab,
  onTabChange,
  children,
}: BakeryAdminLayoutProps) {
  const { user, hydrated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      void navigate({ to: "/login" });
    }
  }, [user, hydrated, navigate]);

  if (!hydrated) {
    return <BakeryAdminLoadingScreen />;
  }

  if (!user) {
    return <BakeryAdminRedirectScreen />;
  }

  return (
    <BakeryPendingOrdersProvider projectId={projectId}>
      <BakeryShell liveUrl={liveUrl} activeTab={activeTab} onTabChange={onTabChange}>
        {children}
      </BakeryShell>
    </BakeryPendingOrdersProvider>
  );
}
