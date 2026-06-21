import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";
import madarLogo from "@/assets/madar-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, role, hydrated } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && user && role) {
      nav({ to: role === "admin" ? "/admin" : "/dashboard" });
    }
  }, [hydrated, user, role, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("login.welcome"));
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <img
            src={madarLogo}
            alt={t("app.name")}
            className="h-14 w-14 rounded-full bg-white object-cover p-1 shadow-glow ring-1 ring-white/30"
          />
          <span className="font-display text-3xl tracking-tight">{t("app.name")}</span>
        </div>

        <div className="relative">
          <h1 className="font-display text-6xl leading-[1.02] tracking-tight">
            {t("login.tagline.l1")}
            <br />
            <em className="not-italic text-accent">{t("login.tagline.l2")}</em>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-primary-foreground/70">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-primary-foreground/50">
          <span>
            © {new Date().getFullYear()} {t("app.name")}
          </span>
        </div>

        {/* Decorative gradient blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -end-32 -top-32 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.86 0.16 78) 0%, transparent 60%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 -bottom-24 h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.18 280) 0%, transparent 60%)" }}
        />
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-background bg-mesh px-6 py-12">
        <div className="absolute top-4 end-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img
              src={madarLogo}
              alt={t("app.name")}
              className="h-12 w-12 rounded-full object-cover shadow-elegant ring-1 ring-border/60"
            />
            <span className="font-display text-3xl tracking-tight">{t("app.name")}</span>
          </div>

          <h2 className="font-display text-4xl tracking-tight">{t("login.signin")}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("login.access")}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordHint")}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.01]"
              disabled={busy}
            >
              {busy ? t("login.wait") : t("login.signin")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
