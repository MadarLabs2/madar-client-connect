import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogOut } from "lucide-react";

export function Header() {
  const { user, profile, role, signOut } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant transition-transform group-hover:scale-105"
          >
            <span className="font-display text-lg leading-none">M</span>
          </span>
          <span className="font-display text-2xl tracking-tight text-foreground">
            {t("app.name")}
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <span className="hidden items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-md sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span>{profile?.name || user.email}</span>
                <span className="opacity-50">·</span>
                <span className="font-medium text-foreground">
                  {role === "admin" ? t("role.admin") : t("role.client")}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={async () => {
                  await signOut();
                  nav({ to: "/login" });
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("nav.signOut")}</span>
              </Button>
            </>
          ) : (
            <Link to="/login" className="text-sm font-medium text-foreground hover:opacity-70">
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
