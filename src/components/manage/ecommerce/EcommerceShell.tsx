import { type ReactNode, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useEcommerceT } from "@/lib/ecommerce/i18n";

type NavItem = {
  id: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { id: "overview", icon: LayoutDashboard },
  { id: "products", icon: Package },
  { id: "categories", icon: Tags },
  { id: "orders", icon: ShoppingCart },
  { id: "customers", icon: Users },
  { id: "coupons", icon: Ticket },
  { id: "reports", icon: BarChart3 },
  { id: "notifications", icon: Bell },
  { id: "employees", icon: ClipboardList },
  { id: "settings", icon: Settings },
];

type EcommerceShellProps = {
  projectName: string;
  liveUrl?: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: ReactNode;
};

function NavButtons({
  activeTab,
  onTabChange,
  onNavigate,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNavigate?: () => void;
}) {
  const { t } = useEcommerceT();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onTabChange(item.id);
              onNavigate?.();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/75 hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t(`tab.${item.id}`)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function EcommerceShell({
  projectName,
  liveUrl,
  activeTab,
  onTabChange,
  children,
}: EcommerceShellProps) {
  const { t } = useEcommerceT();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeLabel =
    NAV_ITEMS.find((n) => n.id === activeTab) != null
      ? t(`tab.${activeTab}`)
      : t("manage");

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-5 py-6">
        <Link
          to="/dashboard"
          className="mb-5 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          {t("backToProjects")}
        </Link>
        <p className="font-display text-lg font-medium tracking-tight">{projectName}</p>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("storeManage")}
        </p>
        {liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t("liveSite")}
          </a>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <NavButtons
          activeTab={activeTab}
          onTabChange={onTabChange}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#f3f2ef] p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[90rem] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm sm:min-h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2.5rem)]">
        <aside className="sticky top-0 hidden h-full min-h-[inherit] w-[17.5rem] shrink-0 border-s border-border/60 bg-background lg:flex lg:flex-col">
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/60 bg-background/95 px-4 py-3.5 backdrop-blur sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">{t("menu")}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 p-0">
                  {sidebar}
                </SheetContent>
              </Sheet>
              <div className="min-w-0 lg:hidden">
                <p className="truncate font-medium">{projectName}</p>
                <p className="text-xs text-muted-foreground">{activeLabel}</p>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
