import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    nav({ to: user.role === "admin" ? "/admin" : "/dashboard" });
  }

  function quickFill(role: "admin" | "client") {
    if (role === "admin") {
      setEmail("admin@madar.com");
      setPassword("admin123");
    } else {
      setEmail("client@acme.com");
      setPassword("client123");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = login(email, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Welcome back");
    // Re-read user via storage to route correctly
    const stored = JSON.parse(localStorage.getItem("madar.session.v1") || "null");
    nav({ to: stored?.role === "admin" ? "/admin" : "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="font-display text-3xl tracking-tight">Madar</div>
        <div className="relative">
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight">
            A quieter way<br />to run client work.
          </h1>
          <p className="mt-6 max-w-md text-sm text-primary-foreground/70">
            One workspace for projects, finances, and communication — built for studios and the
            clients they serve.
          </p>
        </div>
        <div className="text-xs text-primary-foreground/50">© {new Date().getFullYear()} Madar</div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.78 0.13 75) 0%, transparent 60%)" }}
        />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="font-display text-3xl tracking-tight">Madar</div>
          </div>
          <h2 className="font-display text-3xl tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Access your client portal.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-card p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Demo accounts
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => quickFill("admin")}>
                Use Admin
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => quickFill("client")}>
                Use Client
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              admin@madar.com / admin123 · client@acme.com / client123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
