import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";

import { isManageTabAllowed, type ManageTabId } from "@/lib/project-templates";
import {
  ECOMMERCE_GUARDED_TABS,
  isEcommerceAdminUnlocked,
  peekEcommerceGuardedIntent,
  readEcommerceAdminGate,
} from "@/lib/ecommerce/manage-access";
import { projectInfo } from "@/lib/project-db.functions";
import { EcommerceManageApp } from "@/components/manage/ecommerce/EcommerceManageApp";
import { BakeryManageApp } from "@/components/manage/bakery/BakeryManageApp";
import { BakeryAdminLoadingScreen } from "@/components/manage/bakery/BakeryAdminLayout";

const searchSchema = z.object({
  tab: z.string().default("overview"),
  userId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/manage/$projectId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ManageProject,
});

function ManageProject() {
  const { projectId } = Route.useParams();
  const { tab, userId, orderId } = Route.useSearch();
  const navigate = useNavigate();
  const infoFn = useServerFn(projectInfo);

  const { data: info, isLoading } = useQuery({
    queryKey: ["project-info", projectId],
    queryFn: () => infoFn({ data: { projectId } }),
  });

  const resolvedTab: ManageTabId = isManageTabAllowed(info?.manageTemplate, tab)
    ? (tab as ManageTabId)
    : "overview";

  useEffect(() => {
    if (isLoading || !info) return;
    if (info.manageTemplate === "bakery" && tab === "rest-days") {
      navigate({ to: ".", search: { tab: "availability" }, params: { projectId }, replace: true });
      return;
    }
    if (info.manageTemplate !== "bakery" && ECOMMERCE_GUARDED_TABS.has(resolvedTab)) {
      const gate = readEcommerceAdminGate(projectId);
      const unlocked = isEcommerceAdminUnlocked(projectId);
      const intended = peekEcommerceGuardedIntent(projectId) === resolvedTab;
      if (!unlocked && (gate.enabled || !intended)) {
        navigate({ to: ".", search: { tab: "orders" }, params: { projectId }, replace: true });
        return;
      }
    }
    if (tab !== resolvedTab) {
      navigate({ to: ".", search: { tab: resolvedTab }, params: { projectId }, replace: true });
    }
  }, [isLoading, info, tab, resolvedTab, navigate, projectId]);

  if (isLoading) {
    return <BakeryAdminLoadingScreen />;
  }

  if (info?.manageTemplate === "bakery") {
    return (
      <BakeryManageApp
        projectId={projectId}
        projectName={info.name}
        hasCredentials={info.hasCredentials}
        liveUrl={info.liveUrl}
        tab={resolvedTab}
        onTabChange={(nextTab) => navigate({ to: ".", search: { tab: nextTab }, params: { projectId } })}
      />
    );
  }

  return (
    <EcommerceManageApp
      projectId={projectId}
      projectName={info?.name ?? "Project"}
      hasCredentials={info?.hasCredentials ?? false}
      liveUrl={info?.liveUrl}
      tab={resolvedTab}
      userId={userId ?? null}
      orderId={orderId ?? null}
      onTabChange={(nextTab) =>
        navigate({
          to: ".",
          search:
            nextTab === "orders"
              ? {
                  tab: nextTab,
                  ...(userId ? { userId } : {}),
                  ...(orderId ? { orderId } : {}),
                }
              : { tab: nextTab },
          params: { projectId },
        })
      }
    />
  );
}
