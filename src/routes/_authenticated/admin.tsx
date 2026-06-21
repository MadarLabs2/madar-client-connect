import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/external-db/client";
import {
  inviteClient,
  createProject,
  updateProject,
  deleteProject,
  updateClient,
  deleteClient,
  upsertProduct,
  deleteProduct,
  listAdminProjects,
  getAdminProjectEmailSettings,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { MANAGE_TEMPLATE_IDS, MANAGE_TEMPLATES, type ManageTemplateId } from "@/lib/project-templates";
import { toast } from "sonner";
import { Pencil, Trash2, Database, Package, ExternalLink, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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
  manage_template: ManageTemplateId;
  status: ProjectStatus;
  progress: number;
  live_url: string | null;
  cms_url: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  supabase_service_key: string | null;
  resend_from_email: string | null;
  resend_admin_email: string | null;
  email_test_mode: boolean;
  has_resend_api_key: boolean;
  updated_at: string;
};
type ProductRow = { id: string; project_id: string; data: Record<string, unknown>; created_at: string };

const PROJECT_TYPES: ProjectType[] = ["website", "ecommerce", "web_app", "branding", "marketing"];
const PROJECT_STATUSES: ProjectStatus[] = ["planning", "in_progress", "review", "live", "paused"];

type ProjectForm = {
  clientId: string;
  name: string;
  type: ProjectType;
  manageTemplate: ManageTemplateId;
  status: ProjectStatus;
  progress: number;
  liveUrl: string;
  cmsUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  resendApiKey: string;
  resendFromEmail: string;
  resendAdminEmail: string;
  emailTestMode: boolean;
  hasResendApiKey: boolean;
};

const emptyProjectForm: ProjectForm = {
  clientId: "",
  name: "",
  type: "website",
  manageTemplate: "ecommerce",
  status: "planning",
  progress: 0,
  liveUrl: "",
  cmsUrl: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseServiceKey: "",
  resendApiKey: "",
  resendFromEmail: "",
  resendAdminEmail: "",
  emailTestMode: false,
  hasResendApiKey: false,
};

function AdminDashboard() {
  const { role } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const invite = useServerFn(inviteClient);
  const editClient = useServerFn(updateClient);
  const removeClient = useServerFn(deleteClient);
  const addProject = useServerFn(createProject);
  const editProject = useServerFn(updateProject);
  const removeProject = useServerFn(deleteProject);
  const saveProduct = useServerFn(upsertProduct);
  const removeProduct = useServerFn(deleteProduct);
  const fetchProjects = useServerFn(listAdminProjects);
  const fetchEmailSettings = useServerFn(getAdminProjectEmailSettings);

  const [clientOpen, setClientOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [productsProject, setProductsProject] = useState<ProjectRow | null>(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", password: randomPassword() });
  const [clientEditForm, setClientEditForm] = useState({ name: "", company: "" });
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
      const rows = await fetchProjects();
      return rows.map((p) => ({
        ...p,
        manage_template: (p.manage_template as ManageTemplateId) || "ecommerce",
      }));
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
      manageTemplate: p.manage_template,
      status: p.status,
      progress: p.progress,
      liveUrl: p.live_url ?? "",
      cmsUrl: p.cms_url ?? "",
      supabaseUrl: p.supabase_url ?? "",
      supabaseAnonKey: p.supabase_anon_key ?? "",
      supabaseServiceKey: p.supabase_service_key ?? "",
      resendApiKey: "",
      resendFromEmail: p.resend_from_email ?? "",
      resendAdminEmail: p.resend_admin_email ?? "",
      emailTestMode: p.email_test_mode,
      hasResendApiKey: p.has_resend_api_key,
    });
    setProjOpen(true);
    void fetchEmailSettings({ data: { projectId: p.id } })
      .then((email) => {
        setPForm((prev) =>
          prev.clientId === p.client_id && prev.name === p.name
            ? {
                ...prev,
                resendFromEmail: email.resendFromEmail,
                resendAdminEmail: email.resendAdminEmail,
                emailTestMode: email.emailTestMode,
                hasResendApiKey: email.hasResendApiKey,
              }
            : prev,
        );
      })
      .catch(() => {});
  }

  function openEditClient(c: ClientRow) {
    setEditingClient(c);
    setClientEditForm({ name: c.name, company: c.company });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.company || !form.email || form.password.length < 8) {
      toast.error(t("admin.allFieldsRequired"));
      return;
    }
    try {
      await invite({ data: form });
      toast.success(`${t("admin.clientCreated")} ${form.email}`);
      setClientOpen(false);
      setForm({ name: "", company: "", email: "", password: randomPassword() });
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.failedCreate"));
    }
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;
    try {
      await editClient({ data: { id: editingClient.id, ...clientEditForm } });
      toast.success(t("admin.clientUpdated"));
      setEditingClient(null);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.failedUpdate"));
    }
  }

  async function handleDeleteClient() {
    if (!deletingClientId) return;
    try {
      await removeClient({ data: { id: deletingClientId } });
      toast.success(t("admin.clientDeleted"));
      setDeletingClientId(null);
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.failedDelete"));
    }
  }

  async function handleSaveProject(e: React.FormEvent) {
    e.preventDefault();
    if (!pForm.clientId || !pForm.name) {
      toast.error(t("admin.pickClient"));
      return;
    }
    try {
      if (editingId) {
        await editProject({ data: { ...pForm, id: editingId } });
        toast.success(t("admin.projectUpdated"));
      } else {
        await addProject({ data: pForm });
        toast.success(t("admin.projectCreated"));
      }
      setProjOpen(false);
      setEditingId(null);
      setPForm(emptyProjectForm);
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.failedSaveProject"));
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await removeProject({ data: { id: deletingId } });
      toast.success(t("admin.projectDeleted"));
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["admin-projects"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.failedDelete"));
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("admin.kicker")}
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("admin.title")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" className="bg-gradient-primary">
            <Link to="/crm">{t("admin.crmBtn")}</Link>
          </Button>
          <Button variant="outline" onClick={openNewProject}>{t("admin.newProject")}</Button>
          <Dialog open={clientOpen} onOpenChange={setClientOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">{t("admin.addClient")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.newClient.title")}</DialogTitle>
                <DialogDescription>{t("admin.newClient.desc")}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="n">{t("admin.contactName")}</Label>
                  <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="c">{t("admin.company")}</Label>
                  <Input id="c" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="e">{t("admin.email")}</Label>
                  <Input id="e" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="p">{t("admin.tempPassword")}</Label>
                  <div className="flex gap-2">
                    <Input id="p" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <Button type="button" variant="outline" onClick={() => setForm({ ...form, password: randomPassword() })}>
                      {t("admin.regen")}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{t("admin.createClient")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Project dialog */}
      <Dialog open={projOpen} onOpenChange={(o) => { setProjOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("admin.editProject") : t("admin.createProject")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("admin.editProjectDesc") : t("admin.createProjectDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveProject} className="space-y-4">
            <div className="grid gap-1.5">
              <Label>{t("admin.client")}</Label>
              <Select value={pForm.clientId} onValueChange={(v) => setPForm({ ...pForm, clientId: v })}>
                <SelectTrigger><SelectValue placeholder={t("admin.chooseClient")} /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pn">{t("admin.projectName")}</Label>
              <Input id="pn" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t("admin.manageTemplate")}</Label>
              <Select
                value={pForm.manageTemplate}
                onValueChange={(v) => setPForm({ ...pForm, manageTemplate: v as ManageTemplateId })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANAGE_TEMPLATE_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {MANAGE_TEMPLATES[id].label.he}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {MANAGE_TEMPLATES[pForm.manageTemplate].description.he}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>{t("admin.type")}</Label>
                <Select value={pForm.type} onValueChange={(v) => setPForm({ ...pForm, type: v as ProjectType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>{ty.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("admin.status")}</Label>
                <Select value={pForm.status} onValueChange={(v) => setPForm({ ...pForm, status: v as ProjectStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>{t(`status.${st}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pp">{t("admin.progressPct")}</Label>
              <Input id="pp" type="number" min={0} max={100} value={pForm.progress}
                onChange={(e) => setPForm({ ...pForm, progress: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pl">{t("admin.liveUrl")}</Label>
                <Input id="pl" placeholder="https://…" value={pForm.liveUrl} onChange={(e) => setPForm({ ...pForm, liveUrl: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pc">{t("admin.cmsUrl")}</Label>
                <Input id="pc" placeholder="https://…" value={pForm.cmsUrl} onChange={(e) => setPForm({ ...pForm, cmsUrl: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" /> {t("admin.dbConn")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="su">{t("admin.dbUrl")}</Label>
                <Input id="su" placeholder="https://xxx.supabase.co" value={pForm.supabaseUrl}
                  onChange={(e) => setPForm({ ...pForm, supabaseUrl: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sa">{t("admin.anonKey")}</Label>
                <Input id="sa" value={pForm.supabaseAnonKey}
                  onChange={(e) => setPForm({ ...pForm, supabaseAnonKey: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ss">{t("admin.serviceKey")}</Label>
                <Input id="ss" type="password" value={pForm.supabaseServiceKey}
                  onChange={(e) => setPForm({ ...pForm, supabaseServiceKey: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t("admin.serviceKeyHint")}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" /> {t("admin.resendConn")}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rk">{t("admin.resendApiKey")}</Label>
                <Input
                  id="rk"
                  type="password"
                  placeholder={editingId && pForm.hasResendApiKey ? "••••••••" : "re_..."}
                  value={pForm.resendApiKey}
                  onChange={(e) => setPForm({ ...pForm, resendApiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t("admin.resendApiKeyHint")}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rf">{t("admin.resendFromEmail")}</Label>
                <Input
                  id="rf"
                  placeholder="Bakery Name <orders@domain.com>"
                  value={pForm.resendFromEmail}
                  onChange={(e) => setPForm({ ...pForm, resendFromEmail: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t("admin.resendFromHint")}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ra">{t("admin.resendAdminEmail")}</Label>
                <Input
                  id="ra"
                  type="email"
                  placeholder="admin@client.com"
                  value={pForm.resendAdminEmail}
                  onChange={(e) => setPForm({ ...pForm, resendAdminEmail: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={pForm.emailTestMode}
                  onCheckedChange={(v) => setPForm({ ...pForm, emailTestMode: v === true })}
                />
                {t("admin.emailTestMode")}
              </label>
            </div>

            <DialogFooter>
              <Button type="submit">{editingId ? t("admin.save") : t("admin.createProject")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit client dialog */}
      <Dialog open={!!editingClient} onOpenChange={(o) => !o && setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.editClient")}</DialogTitle>
            <DialogDescription>{t("admin.editClientDesc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveClient} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ecn">{t("admin.contactName")}</Label>
              <Input id="ecn" value={clientEditForm.name}
                onChange={(e) => setClientEditForm({ ...clientEditForm, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ecc">{t("admin.company")}</Label>
              <Input id="ecc" value={clientEditForm.company}
                onChange={(e) => setClientEditForm({ ...clientEditForm, company: e.target.value })} />
            </div>
            <DialogFooter><Button type="submit">{t("admin.saveBtn")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete project alert */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteProject")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.deleteProjectDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("admin.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete client alert */}
      <AlertDialog open={!!deletingClientId} onOpenChange={(o) => !o && setDeletingClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.deleteClient")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.deleteClientDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient}>{t("admin.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Products manager */}
      <ProductsDialog
        project={productsProject}
        onClose={() => setProductsProject(null)}
        saveProduct={saveProduct}
        removeProduct={removeProduct}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: t("admin.clients"), value: metrics.clients },
          { label: t("admin.activeProjects"), value: metrics.active },
          { label: t("admin.liveProducts"), value: metrics.live },
          { label: t("admin.totalProjects"), value: metrics.total },
        ].map((m) => (
          <Card key={m.label} className="p-5 shadow-card">
            <div className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{m.label}</div>
            <div className="mt-2 font-display text-3xl tracking-tight">{m.value}</div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight">{t("admin.allClients")}</h2>

        {projectsQ.isError ? (
          <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {projectsQ.error instanceof Error ? projectsQ.error.message : t("admin.failedLoadProjects")}
          </Card>
        ) : null}

        {clientsQ.isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">{t("admin.loading")}</Card>
        ) : clients.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            {t("admin.noClients")} <span className="font-medium">{t("admin.addClient")}</span> {t("admin.toInvite")}
          </Card>
        ) : (
          <div className="space-y-3">
            {clients.map((c) => {
              const cp = projectsByClient[c.id] ?? [];
              return (
                <Card key={c.id} className="overflow-hidden p-0 shadow-card">
                  <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 sm:flex-nowrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="truncate text-base font-semibold text-foreground">{c.company || "—"}</span>
                        <span className="text-sm text-muted-foreground">·</span>
                        <span className="truncate text-sm text-muted-foreground">{c.name || t("admin.noName")}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span>{cp.length} {cp.length === 1 ? t("admin.projectCount") : t("admin.projectsCount")}</span>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditClient(c)} aria-label={t("admin.editAria")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingClientId(c.id)} aria-label={t("admin.deleteAria")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {cp.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">{t("admin.noProjects")}</div>
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
                              {p.supabase_url && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  <Database className="h-3 w-3" /> DB
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            <span className="tabular-nums">{p.progress}%</span>
                            <Button asChild size="sm" variant="default" className="h-8 gap-1.5 bg-gradient-primary">
                              <Link to="/manage/$projectId" params={{ projectId: p.id }}>
                                <ExternalLink className="h-3.5 w-3.5" />
                                {t("admin.manage")}
                              </Link>
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditProject(p)} aria-label={t("admin.editAria")}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingId(p.id)} aria-label={t("admin.deleteAria")}>
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

function ProductsDialog({
  project,
  onClose,
  saveProduct,
  removeProduct,
}: {
  project: ProjectRow | null;
  onClose: () => void;
  saveProduct: (args: { data: { id?: string; projectId: string; data: Record<string, unknown> } }) => Promise<unknown>;
  removeProduct: (args: { data: { id: string } }) => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('{\n  "name": "",\n  "price": 0\n}');

  const productsQ = useQuery({
    queryKey: ["admin-products", project?.id],
    enabled: !!project,
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id,project_id,data,created_at")
        .eq("project_id", project!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProductRow[];
    },
  });

  function reset() {
    setEditingProductId(null);
    setJsonText('{\n  "name": "",\n  "price": 0\n}');
  }

  async function save() {
    if (!project) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Must be a JSON object");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }
    try {
      await saveProduct({ data: { id: editingProductId ?? undefined, projectId: project.id, data: parsed } });
      toast.success(editingProductId ? "Product updated" : "Product added");
      reset();
      qc.invalidateQueries({ queryKey: ["admin-products", project.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function remove(id: string) {
    try {
      await removeProduct({ data: { id } });
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["admin-products", project?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <Dialog open={!!project} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Products · {project?.name}</DialogTitle>
          <DialogDescription>
            Flexible JSON entries. Add any fields you need per product.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="json">{editingProductId ? "Edit product (JSON)" : "New product (JSON)"}</Label>
          <Textarea
            id="json"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="min-h-[160px] font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={save}>{editingProductId ? "Save changes" : "Add product"}</Button>
            {editingProductId && (
              <Button variant="outline" onClick={reset}>Cancel</Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Existing ({productsQ.data?.length ?? 0})</h3>
          {productsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (productsQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No products yet.</p>
          ) : (
            <ul className="space-y-2">
              {productsQ.data!.map((pr) => (
                <li key={pr.id} className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <pre className="min-w-0 flex-1 overflow-x-auto text-xs">{JSON.stringify(pr.data, null, 2)}</pre>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                        setEditingProductId(pr.id);
                        setJsonText(JSON.stringify(pr.data, null, 2));
                      }} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(pr.id)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
