import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {profile?.company || "Your workspace"}
        </p>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Welcome, {firstName}.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {projects.length === 0
            ? "Your projects will appear here once your studio assigns them."
            : "Here's the state of your projects today."}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight">Project hub</h2>
        {isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading projects…</Card>
        ) : projects.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No projects yet.</Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs capitalize text-muted-foreground">{p.type.replace("_", " ")}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/manage/$projectId" params={{ projectId: p.id }} search={{ tab: "overview" }}>
                      <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" /> לוח ניהול
                    </Link>
                  </Button>
                  {p.live_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.live_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> צפייה
                      </a>
                    </Button>
                  )}
                  {p.cms_url && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.cms_url} target="_blank" rel="noreferrer">
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" /> CMS חיצוני
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
