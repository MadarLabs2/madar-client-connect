import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/external-db/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ExternalLink, Settings2, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: ClientDashboard,
});

function ClientDashboard() {
  const { user, profile, role } = useAuth();
  const { t } = useI18n();
  if (role === "admin") return <Navigate to="/admin" />;
  if (!user) return <Navigate to="/login" />;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["my-projects", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,type,status,progress,live_url,cms_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const firstName = (profile?.name || user.email || "there").split(" ")[0];

  return (
    <div className="space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-card bg-mesh p-8 shadow-card">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {profile?.company || t("dash.workspace")}
        </p>
        <h1 className="mt-2 font-display text-5xl tracking-tight">
          {t("dash.welcome", { name: firstName })}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {projects.length === 0 ? t("dash.empty") : t("dash.today")}
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -end-20 -top-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.86 0.16 78 / 0.5) 0%, transparent 60%)" }}
        />
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-2xl tracking-tight">{t("dash.hub")}</h2>
        {isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">{t("dash.loading")}</Card>
        ) : projects.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">{t("dash.none")}</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} className="group relative overflow-hidden p-6 shadow-card transition-all hover:shadow-elegant">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs capitalize text-muted-foreground">{p.type.replace("_", " ")}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("dash.progress")}</span>
                    <span className="font-medium text-foreground">{p.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-accent transition-all"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm" className="bg-gradient-primary">
                    <Link to="/manage/$projectId" params={{ projectId: p.id }} search={{ tab: "overview" }}>
                      <LayoutDashboard className="me-1.5 h-3.5 w-3.5" /> {t("dash.manage")}
                    </Link>
                  </Button>
                  {p.live_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.live_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="me-1.5 h-3.5 w-3.5" /> {t("dash.view")}
                      </a>
                    </Button>
                  )}
                  {p.cms_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.cms_url} target="_blank" rel="noreferrer">
                        <Settings2 className="me-1.5 h-3.5 w-3.5" /> {t("dash.cms")}
                      </a>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
