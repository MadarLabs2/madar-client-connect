import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/external-db/client";
import { inviteClient, createProject } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

function randomPassword() {
  return Math.random().toString(36).slice(2, 6) + "A1!" + Math.random().toString(36).slice(2, 6);
}

type ClientRow = { id: string; name: string; company: string };
type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  type: "website" | "ecommerce" | "web_app" | "branding" | "marketing";
  status: "planning" | "in_progress" | "review" | "live" | "paused";
  progress: number;
  updated_at: string;
};

function AdminDashboard() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const invite = useServerFn(inviteClient);
  const addProject = useServerFn(createProject);

  const [open, setOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", password: randomPassword() });
  const [pForm, setPForm] = useState({
    clientId: "",
    name: "",
    type: "website" as ProjectRow["type"],
    status: "planning" as ProjectRow["status"],
    progress: 0,
    liveUrl: "",
    cmsUrl: "",
  });

  const clientsQ = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async (): Promise<ClientRow[]> => {
      // Admin RLS allows reading all profiles. Exclude self by joining roles client-side.
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id,name,company"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
      return (profiles ?? []).filter((p) => !adminIds.has(p.id));
    },
  });

  const projectsQ = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,client_id,name,type,status,progress,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  if (role && role !== "admin") return <Navigate to="/dashboard" />;

  const clients = clientsQ.data ?? [];
  const projects = projectsQ.data ?? [];

  const metrics = useMemo(() => {
    return {
      clients: clients.length,
      active: projects.filter((p) => p.status === "in_progress" || p.status === "review").length,
      live: projects.filter((p) => p.status === "live").length,
      total: projects.length,
    };
  }, [clients, projects]);

  const projectsByClient = useMemo(() => {
    const map: Record<string, ProjectRow[]> = {};
    for (const p of projects) {
      (map[p.client_id] ||= []).push(p);
    }
    return map;
  }, [projects]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.company || !form.email || form.password.length < 8) {
      toast.error("All fields required (password ≥ 8 chars)");
      return;
    }
    try {
      await invite({ data: form });
      toast.success(`Client created · ${form.email}`);
      setOpen(false);
      setForm({ name: "", company: "", email: "", password: randomPassword() });
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    }
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    if (!pForm.clientId || !pForm.name) {
      toast.error("Pick a client and enter a project name");
      return;
    }
    try {
      await addProject({ data: pForm });
      toast.success("Project created");
      setProjOpen(false);
      setPForm({ ...pForm, name: "", liveUrl: "", cmsUrl: "", progress: 0 });
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Admin · Master view
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Client portfolio</h1>
        </div>
        <div className="flex gap-2">
          <Dialog open={projOpen} onOpenChange={setProjOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>Assign a new project to a client.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddProject} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label>Client</Label>
                  <Select value={pForm.clientId} onValueChange={(v) => setPForm({ ...pForm, clientId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.company} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pn">Project name</Label>
                  <Input id="pn" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <Select value={pForm.type} onValueChange={(v) => setPForm({ ...pForm, type: v as ProjectRow["type"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["website", "ecommerce", "web_app", "branding", "marketing"].map((t) => (
                          <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Status</Label>
                    <Select value={pForm.status} onValueChange={(v) => setPForm({ ...pForm, status: v as ProjectRow["status"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["planning", "in_progress", "review", "live", "paused"].map((t) => (
                          <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pp">Progress (%)</Label>
                  <Input id="pp" type="number" min={0} max={100} value={pForm.progress}
                    onChange={(e) => setPForm({ ...pForm, progress: Number(e.target.value) })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pl">Live URL (optional)</Label>
                  <Input id="pl" placeholder="https://…" value={pForm.liveUrl} onChange={(e) => setPForm({ ...pForm, liveUrl: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pc">CMS URL (optional)</Label>
                  <Input id="pc" placeholder="https://…" value={pForm.cmsUrl} onChange={(e) => setPForm({ ...pForm, cmsUrl: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="submit">Create project</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add new client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New client account</DialogTitle>
                <DialogDescription>
                  Generates login credentials. The client can sign in immediately with the email and password below.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="n">Contact name</Label>
                  <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="c">Company</Label>
                  <Input id="c" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="e">Email</Label>
                  <Input id="e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="p">Temporary password</Label>
                  <div className="flex gap-2">
                    <Input id="p" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <Button type="button" variant="outline" onClick={() => setForm({ ...form, password: randomPassword() })}>
                      Regenerate
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create client</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: "Clients", value: metrics.clients },
          { label: "Active projects", value: metrics.active },
          { label: "Live products", value: metrics.live },
          { label: "Total projects", value: metrics.total },
        ].map((m) => (
          <Card key={m.label} className="p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.label}</div>
            <div className="mt-2 font-display text-3xl tracking-tight">{m.value}</div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-tight">All clients</h2>
          <span className="text-sm text-muted-foreground">
            System status · <span className="text-[oklch(0.45_0.14_155)]">Operational</span>
          </span>
        </div>

        {clientsQ.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : clients.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No clients yet. Click <span className="font-medium">Add new client</span> to invite one.
          </Card>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const cp = projectsByClient[c.id] ?? [];
              return (
                <Card key={c.id} className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="truncate text-base font-semibold text-foreground">{c.company || "—"}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="truncate text-sm text-muted-foreground">{c.name || "(no name)"}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      <span>{cp.length} project{cp.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  {cp.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">No projects assigned yet.</div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {cp.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:flex-nowrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs capitalize text-muted-foreground">{p.type.replace("_", " ")}</span>
                              <StatusBadge status={p.status} />
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                            <span>{p.progress}%</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
