import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, user, role, hydrated } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && user && role) {
      nav({ to: role === "admin" ? "/admin" : "/dashboard" });
    }
  }, [hydrated, user, role, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp({ email, password, name, company });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (mode === "signup") {
      toast.success(t("login.created"));
      await signIn(email, password);
    } else {
      toast.success(t("login.welcome"));
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/90 text-accent-foreground shadow-glow">
            <span className="font-display text-xl leading-none">M</span>
          </span>
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
          <span>© {new Date().getFullYear()} {t("app.name")}</span>
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
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground">
              <span className="font-display text-lg leading-none">M</span>
            </span>
            <span className="font-display text-3xl tracking-tight">{t("app.name")}</span>
          </div>

          <h2 className="font-display text-4xl tracking-tight">
            {mode === "signin" ? t("login.signin") : t("login.signup")}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signin" ? t("login.access") : t("login.firstAdmin")}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">{t("login.fullName")}</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">{t("login.company")}</Label>
                  <Input id="company" required value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              </>
            )}
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
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
              {busy ? t("login.wait") : mode === "signin" ? t("login.signin") : t("login.signup")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? t("login.noAccount") : t("login.haveAccount")}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {mode === "signin" ? t("login.signup") : t("login.signin")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
