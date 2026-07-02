import { Card } from "@/components/ui/card";
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
import { EcommerceThemeProvider } from "@/lib/ecommerce/EcommerceThemeContext";
import { EcommerceI18nProvider, useEcommerceT } from "@/lib/ecommerce/i18n";

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

export function EcommerceManageApp({
  projectId,
  projectName,
  hasCredentials,
  liveUrl,
  tab,
  userId,
  orderId,
  onTabChange,
}: EcommerceManageAppProps) {
  const activeTab = tab || "overview";
  const needsCredentials = CREDENTIAL_TABS.has(activeTab);

  const renderTab = () => {
    if (needsCredentials && !hasCredentials) {
      return <MissingCredentialsCard activeTab={activeTab} />;
    }

    if (activeTab === "overview") {
      return (
        <EcommerceDashboard
          projectId={projectId}
          projectName={projectName}
          onTabChange={onTabChange}
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
    if (activeTab === "settings") return <EcommerceSettingsPage projectId={projectId} />;
    return null;
  };

  return (
    <EcommerceI18nProvider projectId={projectId}>
      <EcommerceThemeProvider projectId={projectId}>
        <EcommerceShell
          projectName={projectName}
          liveUrl={liveUrl}
          activeTab={activeTab}
          onTabChange={onTabChange}
        >
          {renderTab()}
        </EcommerceShell>
      </EcommerceThemeProvider>
    </EcommerceI18nProvider>
  );
}
