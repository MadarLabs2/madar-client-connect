import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/external-db/client";
import { inviteClient, createProject, updateProject, deleteProject } from "@/lib/admin.functions";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminDashboard,
});

function randomPassword() {
  return Math.random().toString(36).slice(2, 6) + "A1!" + Math.random().toString(36).slice(2, 6);
}

type ClientRow = { id: string; name: string; company: string };
type ProjectType = "website" | "ecommerce" | "web_app" | "branding" | "marketing";
type ProjectStatus = "planning" | "in_progress" | "review" | "live" | "paused";
type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  progress: number;
  live_url: string | null;
  cms_url: string | null;
  updated_at: string;
};

const PROJECT_TYPES: ProjectType[] = ["website", "ecommerce", "web_app", "branding", "marketing"];
const PROJECT_STATUSES: ProjectStatus[] = ["planning", "in_progress", "review", "live", "paused"];

type ProjectForm = {
  clientId: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  progress: number;
  liveUrl: string;
  cmsUrl: string;
};

const emptyProjectForm: ProjectForm = {
  clientId: "",
  name: "",
  type: "website",
  status: "planning",
  progress: 0,
  liveUrl: "",
  cmsUrl: "",
};

function AdminDashboard() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const invite = useServerFn(inviteClient);
  const addProject = useServerFn(createProject);
  const editProject = useServerFn(updateProject);
  const removeProject = useServerFn(deleteProject);

  const [clientOpen, setClientOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", password: randomPassword() });
  const [pForm, setPForm] = useState<ProjectForm>(emptyProjectForm);

  const clientsQ = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async (): Promise<ClientRow[]> => {
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
        .select("id,client_id,name,type,status,progress,live_url,cms_url,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as ProjectRow[];
    },
  });

  if (role && role !== "admin") return <Navigate to="/dashboard" />;

  const clients = clientsQ.data ?? [];
  const projects = projectsQ.data ?? [];

  const metrics = useMemo(() => ({
    clients: clients.length,
    active: projects.filter((p) => p.status === "in_progress" || p.status === "review").length,
    live: projects.filter((p) => p.status === "live").length,
    total: projects.length,
  }), [clients, projects]);

  const projectsByClient = useMemo(() => {
    const map: Record<string, ProjectRow[]> = {};
    for (const p of projects) (map[p.client_id] ||= []).push(p);
    return map;
  }, [projects]);

  function openNewProject() {
    setEditingId(null);
    setPForm(emptyProjectForm);
    setProjOpen(true);
  }

  function openEditProject(p: ProjectRow) {
    setEditingId(p.id);
    setPForm({
      clientId: p.client_id,
      name: p.name,
      type: p.type,
      status: p.status,
      progress: p.progress,
      liveUrl: p.live_url ?? "",
      cmsUrl: p.cms_url ?? "",
    });
    setProjOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.company || !form.email || form.password.length < 8) {
      toast.error("All fields required (password ≥ 8 chars)");
      return;
    }
    try {
      await invite({ data: form });
      toast.success(`Client created · ${form.email}`);
      setClientOpen(false);
      setForm({ name: "", company: "", email: "", password: randomPassword() });
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    }
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!pForm.clientId || !pForm.name) {
      toast.error("Pick a client and enter a project name");
      return;
    }
    try {
      if (editingId) {
        await editProject({ data: { ...pForm, id: editingId } });
        toast.success("Project updated");
      } else {
        await addProject({ data: pForm });
        toast.success("Project created");
      }
      setProjOpen(false);
      setEditingId(null);
      setPForm(emptyProjectForm);
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save project");
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await removeProject({ data: { id: deletingId } });
      toast.success("Project deleted");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
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
          <Button variant="outline" onClick={openNewProject}>New project</Button>
          <Dialog open={clientOpen} onOpenChange={setClientOpen}>
            <DialogTrigger asChild>
              <Button>Add new client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New client account</DialogTitle>
                <DialogDescription>
                  Generates login credentials. The client can sign in immediately.
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

      <Dialog open={projOpen} onOpenChange={(o) => { setProjOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit project" : "Create project"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update project details." : "Assign a new project to a client."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProject} className="space-y-4">
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
                <Select value={pForm.type} onValueChange={(v) => setPForm({ ...pForm, type: v as ProjectType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={pForm.status} onValueChange={(v) => setPForm({ ...pForm, status: v as ProjectStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((t) => (
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
              <Button type="submit">{editingId ? "Save changes" : "Create project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The project will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        <h2 className="font-display text-2xl tracking-tight">All clients</h2>

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
                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{p.progress}%</span>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditProject(p)} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingId(p.id)} aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
