import { Card } from "@/components/ui/card";
import { BakeryAdminLayout } from "@/components/manage/bakery/BakeryAdminLayout";
import { BakeryDashboard } from "@/components/manage/bakery/BakeryDashboard";
import { BakeryProductsPage } from "@/components/manage/bakery/BakeryProductsPage";
import { BakeryCategoriesPage } from "@/components/manage/bakery/BakeryCategoriesPage";
import { BakeryOrdersPage } from "@/components/manage/bakery/BakeryOrdersPage";
import { BakeryCouponsPage } from "@/components/manage/bakery/BakeryCouponsPage";
import { BakeryOffersPage } from "@/components/manage/bakery/BakeryOffersPage";
import { BakerySettingsPage } from "@/components/manage/bakery/BakerySettingsPage";
import { BakeryAvailabilityPage } from "@/components/manage/bakery/BakeryAvailabilityPage";
import { BakeryRestDaysPage } from "@/components/manage/bakery/BakeryRestDaysPage";
import { BakeryReportsPage } from "@/components/manage/bakery/BakeryReportsPage";
import { useBakeryT } from "@/lib/bakery/i18n";

type BakeryManageAppProps = {
  projectId: string;
  projectName: string;
  hasCredentials: boolean;
  liveUrl?: string | null;
  tab: string;
  onTabChange: (tab: string) => void;
};

const CREDENTIAL_TABS = new Set([
  "products",
  "categories",
  "orders",
  "coupons",
  "offers",
  "reports",
  "settings",
  "availability",
  "rest-days",
]);

export function BakeryManageApp({
  projectId,
  projectName,
  hasCredentials,
  liveUrl,
  tab,
  onTabChange,
}: BakeryManageAppProps) {
  const { t } = useBakeryT();
  const activeTab = tab || "overview";
  const needsCredentials = CREDENTIAL_TABS.has(activeTab);

  const renderTab = () => {
    if (needsCredentials && !hasCredentials) {
      return (
        <Card className="p-6">
          <h2 className="font-display text-xl">{t("manage.missing.title")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("manage.missing.body", { label: activeTab })}
          </p>
        </Card>
      );
    }

    if (activeTab === "overview")
      return (
        <BakeryDashboard
          projectId={projectId}
          projectName={projectName}
          liveUrl={liveUrl}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      );
    if (activeTab === "products") return <BakeryProductsPage projectId={projectId} />;
    if (activeTab === "categories") return <BakeryCategoriesPage projectId={projectId} />;
    if (activeTab === "orders") return <BakeryOrdersPage projectId={projectId} />;
    if (activeTab === "coupons") return <BakeryCouponsPage projectId={projectId} />;
    if (activeTab === "reports") return <BakeryReportsPage projectId={projectId} />;
    if (activeTab === "settings") return <BakerySettingsPage projectId={projectId} />;
    if (activeTab === "offers") return <BakeryOffersPage projectId={projectId} />;
    if (activeTab === "availability") return <BakeryAvailabilityPage projectId={projectId} />;
    if (activeTab === "rest-days") return <BakeryRestDaysPage projectId={projectId} />;
    return (
      <BakeryDashboard
        projectId={projectId}
        projectName={projectName}
        liveUrl={liveUrl}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    );
  };

  return (
    <BakeryAdminLayout
      projectId={projectId}
      liveUrl={liveUrl}
      activeTab={activeTab}
      onTabChange={onTabChange}
    >
      {renderTab()}
    </BakeryAdminLayout>
  );
}
