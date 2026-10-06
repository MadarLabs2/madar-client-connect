import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcommerceShell } from "@/components/manage/ecommerce/EcommerceShell";
import { EcommerceDashboard } from "@/components/manage/ecommerce/EcommerceDashboard";
import { ProductsManager } from "@/components/manage/ProductsManager";
import { CategoriesManager } from "@/components/manage/CategoriesManager";
import { OrdersManager } from "@/components/manage/OrdersManager";
import { CustomersManager } from "@/components/manage/CustomersManager";
import { ReportsManager } from "@/components/manage/ReportsManager";
import { CouponsManager } from "@/components/manage/CouponsManager";
import { NotificationsManager } from "@/components/manage/NotificationsManager";
import { EcommerceSettingsPage } from "@/components/manage/ecommerce/EcommerceSettingsPage";
import { EcommerceEmployeesPage } from "@/components/manage/ecommerce/EcommerceEmployeesPage";
import { EcommercePendingOrdersProvider } from "@/components/manage/ecommerce/EcommercePendingOrdersContext";
import { EcommerceThemeProvider, useEcommerceTheme } from "@/lib/ecommerce/EcommerceThemeContext";
import { EcommerceI18nProvider, useEcommerceT } from "@/lib/ecommerce/i18n";
import {
  ECOMMERCE_GUARDED_TABS,
  clearEcommerceGuardedIntent,
  isEcommerceAdminUnlocked,
  lockEcommerceAdmin,
  markEcommerceGuardedIntent,
  readEcommerceAdminGate,
  unlockEcommerceAdmin,
} from "@/lib/ecommerce/manage-access";
import { cn } from "@/lib/utils";

type EcommerceManageAppProps = {
  projectId: string;
  projectName: string;
  hasCredentials: boolean;
  liveUrl?: string | null;
  tab: string;
  userId?: string | null;
  orderId?: string | null;
  onTabChange: (tab: string) => void;
};

const CREDENTIAL_TABS = new Set([
  "products",
  "categories",
  "orders",
  "customers",
  "coupons",
  "reports",
  "notifications",
  "employees",
  "settings",
]);

function MissingCredentialsCard({ activeTab }: { activeTab: string }) {
  const { t } = useEcommerceT();
  return (
    <Card className="border-border/70 p-6">
      <h2 className="font-display text-xl">{t("missingCredentialsTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("missingCredentialsBody", { label: t(`tab.${activeTab}`) })}
      </p>
    </Card>
  );
}

function EcommerceManageFrame({
  projectId,
  projectName,
  hasCredentials,
  liveUrl,
  tab,
  userId,
  orderId,
  onTabChange,
}: EcommerceManageAppProps) {
  const { t } = useEcommerceT();
  const { themeStyle } = useEcommerceTheme();
  const activeTab = tab || "orders";
  const needsCredentials = CREDENTIAL_TABS.has(activeTab);
  const [unlocked, setUnlocked] = useState(false);
  const [gateEnabled, setGateEnabled] = useState(true);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setUnlocked(isEcommerceAdminUnlocked(projectId));
    setGateEnabled(readEcommerceAdminGate(projectId).enabled);
  }, [projectId, activeTab]);

  useEffect(() => {
    if (ECOMMERCE_GUARDED_TABS.has(activeTab)) return;
    lockEcommerceAdmin(projectId);
    setUnlocked(false);
  }, [activeTab, projectId]);

  const guardedLocked = gateEnabled && ECOMMERCE_GUARDED_TABS.has(activeTab) && !unlocked;

  const requestTab = (nextTab: string) => {
    if (!ECOMMERCE_GUARDED_TABS.has(nextTab)) {
      clearEcommerceGuardedIntent(projectId);
      lockEcommerceAdmin(projectId);
      setUnlocked(false);
      onTabChange(nextTab);
      return;
    }
    const gate = readEcommerceAdminGate(projectId);
    if (!gate.enabled) {
      setGateEnabled(false);
      markEcommerceGuardedIntent(projectId, nextTab);
      onTabChange(nextTab);
      return;
    }
    if (!unlocked) {
      setPassword("");
      setPendingTab(nextTab);
      return;
    }
    onTabChange(nextTab);
  };

  const submitPassword = () => {
    if (password !== readEcommerceAdminGate(projectId).password) {
      toast.error(t("empWrongPassword"));
      return;
    }
    unlockEcommerceAdmin(projectId);
    setUnlocked(true);
    const next = pendingTab;
    setPendingTab(null);
    setPassword("");
    if (next) onTabChange(next);
  };

  const renderTab = () => {
    if (guardedLocked) return null;

    if (needsCredentials && !hasCredentials) {
      return <MissingCredentialsCard activeTab={activeTab} />;
    }

    if (activeTab === "overview") {
      return (
        <EcommerceDashboard
          projectId={projectId}
          projectName={projectName}
          onTabChange={requestTab}
        />
      );
    }
    if (activeTab === "products") return <ProductsManager projectId={projectId} />;
    if (activeTab === "categories") return <CategoriesManager projectId={projectId} />;
    if (activeTab === "orders") {
      return (
        <OrdersManager
          projectId={projectId}
          userIdFilter={userId ?? null}
          initialOrderId={orderId ?? null}
        />
      );
    }
    if (activeTab === "customers") return <CustomersManager projectId={projectId} />;
    if (activeTab === "reports") return <ReportsManager projectId={projectId} />;
    if (activeTab === "coupons") return <CouponsManager projectId={projectId} />;
    if (activeTab === "notifications") return <NotificationsManager projectId={projectId} />;
    if (activeTab === "employees") return <EcommerceEmployeesPage projectId={projectId} />;
    if (activeTab === "settings") return <EcommerceSettingsPage projectId={projectId} />;
    return null;
  };

  const pendingLabel = pendingTab ? t(`tab.${pendingTab}`) : "";

  return (
    <>
      <EcommerceShell
        projectName={projectName}
        liveUrl={liveUrl}
        activeTab={guardedLocked ? "orders" : activeTab}
        onTabChange={requestTab}
      >
        {renderTab()}
      </EcommerceShell>
      <Dialog
        open={pendingTab != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTab(null);
            setPassword("");
          }
        }}
      >
        <DialogContent
          style={themeStyle}
          overlayClassName="bg-black/50 backdrop-blur-[1px]"
          className={cn(
            "gap-4 overflow-hidden border-border/70 bg-background p-5 shadow-xl sm:rounded-2xl [&>button]:end-4 [&>button]:start-auto [&>button]:top-4",
          )}
        >
          <DialogHeader className="space-y-1.5 text-start">
            <DialogTitle className="font-display text-xl tracking-tight">{t("adminGateTitle")}</DialogTitle>
            <DialogDescription>{t("adminGateBody", { label: pendingLabel })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPassword()}
              className="flex-1"
              autoFocus
              dir="ltr"
            />
            <Button onClick={submitPassword}>{t("confirm")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EcommerceManageApp(props: EcommerceManageAppProps) {
  return (
    <EcommerceI18nProvider projectId={props.projectId}>
      <EcommerceThemeProvider projectId={props.projectId}>
        <EcommercePendingOrdersProvider projectId={props.projectId}>
          <EcommerceManageFrame {...props} />
        </EcommercePendingOrdersProvider>
      </EcommerceThemeProvider>
    </EcommerceI18nProvider>
  );
}
