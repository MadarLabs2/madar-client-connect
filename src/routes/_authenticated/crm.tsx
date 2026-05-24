import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  listLeads,
  getLead,
  upsertLead,
  updateLeadStage,
  deleteLead,
  upsertActivity,
  toggleActivity,
  deleteActivity,
  addCommunication,
  deleteCommunication,
  upsertInvoice,
  deleteInvoice,
  getCrmOverview,
} from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  CheckCircle2,
  Circle,
  TrendingUp,
  Users,
  DollarSign,
  AlertCircle,
  ArrowLeft,
  Building2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  component: CrmPage,
});

type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
type ActivityType = "call" | "meeting" | "email" | "task" | "note";
type CommChannel = "phone" | "email" | "whatsapp" | "meeting" | "other";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const STAGES: { key: Stage; color: string }[] = [
  { key: "new", color: "bg-slate-500" },
  { key: "contacted", color: "bg-blue-500" },
  { key: "qualified", color: "bg-indigo-500" },
  { key: "proposal", color: "bg-amber-500" },
  { key: "won", color: "bg-emerald-600" },
  { key: "lost", color: "bg-rose-500" },
];

const ACTIVITY_TYPES: ActivityType[] = ["call", "meeting", "email", "task", "note"];
const CHANNEL_TYPES: CommChannel[] = ["phone", "email", "whatsapp", "meeting", "other"];
const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  stage: Stage;
  value: number;
  currency: string;
  notes: string | null;
  created_at: string;
};

const emptyLead = {
  name: "",
  email: "",
  phone: "",
  company: "",
  source: "",
  stage: "new" as Stage,
  value: 0,
  currency: "ILS",
  notes: "",
};

function CrmPage() {
  const { role } = useAuth();
  const { t } = useI18n();
  const ACTIVITY_LABEL: Record<ActivityType, string> = { call: t("act.call"), meeting: t("act.meeting"), email: t("act.email"), task: t("act.task"), note: t("act.note") };
  const CHANNEL_LABEL: Record<CommChannel, string> = { phone: t("chan.phone"), email: t("chan.email"), whatsapp: t("chan.whatsapp"), meeting: t("chan.meeting"), other: t("chan.other") };
  const INVOICE_LABEL: Record<InvoiceStatus, string> = { draft: t("inv.draft"), sent: t("inv.sent"), paid: t("inv.paid"), overdue: t("inv.overdue"), cancelled: t("inv.cancelled") };
  const stageLabel = (k: Stage) => t(`stage.${k}`);
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getCrmOverview);
  const fetchLeads = useServerFn(listLeads);
  const saveLead = useServerFn(upsertLead);
  const moveStage = useServerFn(updateLeadStage);
  const removeLead = useServerFn(deleteLead);

  const overviewQ = useQuery({ queryKey: ["crm-overview"], queryFn: () => fetchOverview() });
  const leadsQ = useQuery({ queryKey: ["crm-leads"], queryFn: () => fetchLeads() });

  const [view, setView] = useState<"dashboard" | "pipeline">("dashboard");
  const [leadOpen, setLeadOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadRow | null>(null);
  const [leadForm, setLeadForm] = useState({ ...emptyLead });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (role && role !== "admin") return <Navigate to="/dashboard" />;

  const leads = (leadsQ.data ?? []) as LeadRow[];
  const overview = overviewQ.data;

  const metrics = useMemo(() => {
    const ov = overview;
    const totalLeads = ov?.leads.length ?? 0;
    const openValue = (ov?.leads ?? [])
      .filter((l) => l.stage !== "won" && l.stage !== "lost")
      .reduce((s, l) => s + Number(l.value ?? 0), 0);
    const paidTotal = (ov?.invoices.paid ?? [])
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const openInvTotal = (ov?.invoices.open ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const won = (ov?.leads ?? []).filter((l) => l.stage === "won").length;
    const winRate = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;
    return { totalLeads, openValue, paidTotal, openInvTotal, winRate };
  }, [overview]);

  const leadsByStage = useMemo(() => {
    const map: Record<Stage, LeadRow[]> = {
      new: [], contacted: [], qualified: [], proposal: [], won: [], lost: [],
    };
    for (const l of leads) map[l.stage]?.push(l);
    return map;
  }, [leads]);

  function openNewLead() {
    setEditingLead(null);
    setLeadForm({ ...emptyLead });
    setLeadOpen(true);
  }

  function openEditLead(l: LeadRow) {
    setEditingLead(l);
    setLeadForm({
      name: l.name,
      email: l.email ?? "",
      phone: l.phone ?? "",
      company: l.company ?? "",
      source: l.source ?? "",
      stage: l.stage,
      value: Number(l.value ?? 0),
      currency: l.currency,
      notes: l.notes ?? "",
    });
    setLeadOpen(true);
  }

  async function handleSaveLead(e: React.FormEvent) {
    e.preventDefault();
    if (!leadForm.name.trim()) {
      toast.error("שם הליד חובה");
      return;
    }
    try {
      await saveLead({ data: { ...leadForm, id: editingLead?.id } });
      toast.success(editingLead ? "הליד עודכן" : "ליד נוצר");
      setLeadOpen(false);
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  }

  async function handleStageChange(id: string, stage: Stage) {
    try {
      await moveStage({ data: { id, stage } });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  }

  async function handleDeleteLead() {
    if (!confirmDelete) return;
    try {
      await removeLead({ data: { id: confirmDelete } });
      toast.success("הליד נמחק");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-overview"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  }

  const fmt = (v: number, c = "ILS") =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);

  const leadById = (id: string) => leads.find((l) => l.id === id);

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CRM</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">מערכת ניהול לקוחות</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin"><ArrowLeft className="ml-1 h-4 w-4" />חזרה לאדמין</Link>
          </Button>
          <div className="flex rounded-md border">
            <Button
              variant={view === "dashboard" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("dashboard")}
              className="rounded-l-none"
            >
              לוח בקרה
            </Button>
            <Button
              variant={view === "pipeline" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("pipeline")}
              className="rounded-r-none"
            >
              Pipeline
            </Button>
          </div>
          <Button onClick={openNewLead}><Plus className="ml-1 h-4 w-4" />ליד חדש</Button>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard icon={<Users className="h-4 w-4" />} label="סה״כ לידים" value={String(metrics.totalLeads)} />
        <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="ערך פתוח" value={fmt(metrics.openValue)} />
        <MetricCard icon={<DollarSign className="h-4 w-4" />} label="הכנסות שולמו" value={fmt(metrics.paidTotal)} />
        <MetricCard icon={<AlertCircle className="h-4 w-4" />} label="חוב פתוח" value={fmt(metrics.openInvTotal)} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="אחוז סגירה" value={`${metrics.winRate}%`} />
      </div>

      {view === "dashboard" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Today's tasks */}
          <Card className="p-4 lg:col-span-1">
            <h2 className="mb-3 font-display text-lg">משימות להיום</h2>
            <div className="space-y-2">
              {(overview?.todayTasks ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">אין משימות לטיפול היום 🎉</p>
              ) : (
                overview?.todayTasks.map((t) => {
                  const lead = leadById(t.lead_id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setDetailId(t.lead_id)}
                      className="block w-full rounded-md border bg-card p-2 text-right hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{ACTIVITY_LABEL[t.type as ActivityType]}</Badge>
                        <span className="text-sm font-medium">{t.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {lead?.name ?? "—"}{t.due_date ? ` · ${new Date(t.due_date).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}` : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          {/* Recent leads */}
          <Card className="p-4 lg:col-span-1">
            <h2 className="mb-3 font-display text-lg">לידים אחרונים</h2>
            <div className="space-y-2">
              {leads.slice(0, 8).map((l) => (
                <button
                  key={l.id}
                  onClick={() => setDetailId(l.id)}
                  className="block w-full rounded-md border bg-card p-2 text-right hover:bg-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{l.name}</span>
                    <Badge className={`${STAGES.find((s) => s.key === l.stage)?.color} text-white text-[10px]`}>
                      {stageLabel(l.stage)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{l.company || "—"}</span>
                    <span className="tabular-nums">{fmt(Number(l.value), l.currency)}</span>
                  </div>
                </button>
              ))}
              {leads.length === 0 && <p className="text-sm text-muted-foreground">עוד אין לידים. הוסף ליד חדש להתחיל.</p>}
            </div>
          </Card>

          {/* Recent activity feed */}
          <Card className="p-4 lg:col-span-1">
            <h2 className="mb-3 font-display text-lg">פעילות אחרונה</h2>
            <div className="space-y-2">
              {[
                ...(overview?.recentActivities ?? []).map((a) => ({
                  kind: "activity" as const,
                  id: a.id,
                  lead_id: a.lead_id,
                  at: a.created_at,
                  title: a.title,
                  meta: ACTIVITY_LABEL[a.type as ActivityType],
                })),
                ...(overview?.recentCommunications ?? []).map((c) => ({
                  kind: "comm" as const,
                  id: c.id,
                  lead_id: c.lead_id,
                  at: c.occurred_at,
                  title: c.content.slice(0, 60) + (c.content.length > 60 ? "…" : ""),
                  meta: `${CHANNEL_LABEL[c.channel as CommChannel]} ${c.direction === "in" ? "←" : "→"}`,
                })),
              ]
                .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                .slice(0, 10)
                .map((e) => {
                  const lead = leadById(e.lead_id);
                  return (
                    <button
                      key={`${e.kind}-${e.id}`}
                      onClick={() => setDetailId(e.lead_id)}
                      className="block w-full rounded-md border bg-card p-2 text-right hover:bg-accent"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{e.meta}</Badge>
                        <span className="truncate text-sm">{e.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {lead?.name ?? "—"} · {new Date(e.at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>
        </div>
      ) : (
        // Kanban pipeline
        <div className="grid gap-3 overflow-x-auto md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s) => {
            const stageLeads = leadsByStage[s.key];
            const total = stageLeads.reduce((sum, l) => sum + Number(l.value), 0);
            return (
              <div key={s.key} className="min-w-[200px] rounded-lg border bg-muted/30 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.color}`} />
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">({stageLeads.length})</span>
                  </div>
                </div>
                <div className="mb-2 px-1 text-xs tabular-nums text-muted-foreground">{fmt(total)}</div>
                <div className="space-y-2">
                  {stageLeads.map((l) => (
                    <Card key={l.id} className="p-2.5 hover:shadow-md transition-shadow">
                      <button onClick={() => setDetailId(l.id)} className="block w-full text-right">
                        <div className="text-sm font-medium">{l.name}</div>
                        {l.company && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />{l.company}
                          </div>
                        )}
                        <div className="mt-1.5 text-xs tabular-nums font-medium">{fmt(Number(l.value), l.currency)}</div>
                      </button>
                      <div className="mt-2">
                        <Select value={l.stage} onValueChange={(v) => handleStageChange(l.id, v as Stage)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAGES.map((s2) => (
                              <SelectItem key={s2.key} value={s2.key} className="text-xs">{s2.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit lead dialog */}
      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLead ? "עריכת ליד" : "ליד חדש"}</DialogTitle>
            <DialogDescription>פרטי איש קשר ופוטנציאל המכירה</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLead} className="space-y-3">
            <div className="grid gap-1.5">
              <Label>שם *</Label>
              <Input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>חברה</Label>
                <Input value={leadForm.company} onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>מקור</Label>
                <Input placeholder="המלצה / אתר / ..." value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>אימייל</Label>
                <Input type="email" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>טלפון</Label>
                <Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>שלב</Label>
                <Select value={leadForm.stage} onValueChange={(v) => setLeadForm({ ...leadForm, stage: v as Stage })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>ערך</Label>
                <Input type="number" min={0} value={leadForm.value} onChange={(e) => setLeadForm({ ...leadForm, value: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label>מטבע</Label>
                <Select value={leadForm.currency} onValueChange={(v) => setLeadForm({ ...leadForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ILS">₪ ILS</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                    <SelectItem value="EUR">€ EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>הערות</Label>
              <Textarea rows={3} value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit">{editingLead ? "שמירה" : "יצירה"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lead detail */}
      {detailId && (
        <LeadDetailDialog
          leadId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(l) => { setDetailId(null); openEditLead(l); }}
          onDelete={(id) => { setDetailId(null); setConfirmDelete(id); }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>למחוק את הליד?</DialogTitle>
            <DialogDescription>הפעולה תמחק גם את כל המשימות, התקשורת והחשבוניות הקשורות.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>ביטול</Button>
            <Button variant="destructive" onClick={handleDeleteLead}>מחק</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1.5 font-display text-2xl tabular-nums">{value}</div>
    </Card>
  );
}

// ============ Lead Detail Dialog ============

type LeadDetailProps = {
  leadId: string;
  onClose: () => void;
  onEdit: (l: LeadRow) => void;
  onDelete: (id: string) => void;
};

function LeadDetailDialog({ leadId, onClose, onEdit, onDelete }: LeadDetailProps) {
  const qc = useQueryClient();
  const fetchLead = useServerFn(getLead);
  const saveAct = useServerFn(upsertActivity);
  const toggleAct = useServerFn(toggleActivity);
  const removeAct = useServerFn(deleteActivity);
  const addComm = useServerFn(addCommunication);
  const removeComm = useServerFn(deleteCommunication);
  const saveInv = useServerFn(upsertInvoice);
  const removeInv = useServerFn(deleteInvoice);

  const leadQ = useQuery({
    queryKey: ["crm-lead", leadId],
    queryFn: () => fetchLead({ data: { id: leadId } }),
  });

  const [actForm, setActForm] = useState({ type: "task" as ActivityType, title: "", description: "", due_date: "" });
  const [commForm, setCommForm] = useState({ channel: "phone" as CommChannel, direction: "out" as "in" | "out", content: "" });
  const [invForm, setInvForm] = useState({ number: "", amount: 0, currency: "ILS", status: "draft" as InvoiceStatus, due_date: "" });

  const data = leadQ.data;
  const lead = data?.lead as LeadRow | undefined;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    qc.invalidateQueries({ queryKey: ["crm-overview"] });
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!actForm.title.trim()) return;
    try {
      await saveAct({ data: { lead_id: leadId, ...actForm, due_date: actForm.due_date || null } });
      setActForm({ type: "task", title: "", description: "", due_date: "" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  }

  async function handleToggleAct(id: string, completed: boolean) {
    try { await toggleAct({ data: { id, completed } }); invalidate(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "שגיאה"); }
  }

  async function handleDeleteAct(id: string) {
    try { await removeAct({ data: { id } }); invalidate(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "שגיאה"); }
  }

  async function handleAddComm(e: React.FormEvent) {
    e.preventDefault();
    if (!commForm.content.trim()) return;
    try {
      await addComm({ data: { lead_id: leadId, ...commForm } });
      setCommForm({ channel: "phone", direction: "out", content: "" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  }

  async function handleDeleteComm(id: string) {
    try { await removeComm({ data: { id } }); invalidate(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "שגיאה"); }
  }

  async function handleAddInvoice(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveInv({ data: { lead_id: leadId, ...invForm, due_date: invForm.due_date || null } });
      setInvForm({ number: "", amount: 0, currency: "ILS", status: "draft", due_date: "" });
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    }
  }

  async function handleDeleteInv(id: string) {
    try { await removeInv({ data: { id } }); invalidate(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "שגיאה"); }
  }

  const fmt = (v: number, c = "ILS") =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!lead ? (
          <div className="py-8 text-center text-sm text-muted-foreground">טוען…</div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-2xl">{lead.name}</DialogTitle>
                  <DialogDescription className="flex items-center gap-3 mt-1">
                    {lead.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{lead.company}</span>}
                    <Badge className={`${STAGES.find((s) => s.key === lead.stage)?.color} text-white`}>
                      {stageLabel(lead.stage)}
                    </Badge>
                    <span className="tabular-nums font-medium">{fmt(Number(lead.value), lead.currency)}</span>
                  </DialogDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(lead)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onDelete(lead.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="info" className="mt-2">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">פרטים</TabsTrigger>
                <TabsTrigger value="activities">משימות ({data?.activities.length ?? 0})</TabsTrigger>
                <TabsTrigger value="comms">תקשורת ({data?.communications.length ?? 0})</TabsTrigger>
                <TabsTrigger value="invoices">חשבוניות ({data?.invoices.length ?? 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="אימייל" value={lead.email || "—"} />
                  <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="טלפון" value={lead.phone || "—"} />
                  <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="חברה" value={lead.company || "—"} />
                  <InfoRow icon={<TrendingUp className="h-3.5 w-3.5" />} label="מקור" value={lead.source || "—"} />
                </div>
                {lead.notes && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{lead.notes}</div>
                )}
              </TabsContent>

              <TabsContent value="activities" className="space-y-3 pt-3">
                <form onSubmit={handleAddActivity} className="space-y-2 rounded-md border p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={actForm.type} onValueChange={(v) => setActForm({ ...actForm, type: v as ActivityType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ACTIVITY_LABEL) as ActivityType[]).map((t) => (
                          <SelectItem key={t} value={t}>{ACTIVITY_LABEL[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="datetime-local" value={actForm.due_date} onChange={(e) => setActForm({ ...actForm, due_date: e.target.value })} />
                  </div>
                  <Input placeholder="כותרת המשימה" value={actForm.title} onChange={(e) => setActForm({ ...actForm, title: e.target.value })} />
                  <Textarea rows={2} placeholder="תיאור (אופציונלי)" value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
                  <Button type="submit" size="sm"><Plus className="ml-1 h-3.5 w-3.5" />הוסף</Button>
                </form>
                <div className="space-y-2">
                  {data?.activities.map((a) => (
                    <div key={a.id} className="flex items-start gap-2 rounded-md border p-2">
                      <button onClick={() => handleToggleAct(a.id, !a.completed)} className="mt-0.5">
                        {a.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{ACTIVITY_LABEL[a.type as ActivityType]}</Badge>
                          <span className={`text-sm font-medium ${a.completed ? "line-through text-muted-foreground" : ""}`}>{a.title}</span>
                        </div>
                        {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
                        {a.due_date && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />{new Date(a.due_date).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteAct(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {(!data?.activities || data.activities.length === 0) && (
                    <p className="text-center text-sm text-muted-foreground py-4">אין משימות עדיין</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="comms" className="space-y-3 pt-3">
                <form onSubmit={handleAddComm} className="space-y-2 rounded-md border p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={commForm.channel} onValueChange={(v) => setCommForm({ ...commForm, channel: v as CommChannel })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(CHANNEL_LABEL) as CommChannel[]).map((c) => (
                          <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={commForm.direction} onValueChange={(v) => setCommForm({ ...commForm, direction: v as "in" | "out" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="out">יוצא ←</SelectItem>
                        <SelectItem value="in">נכנס →</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea rows={2} placeholder="תוכן השיחה / הודעה" value={commForm.content} onChange={(e) => setCommForm({ ...commForm, content: e.target.value })} />
                  <Button type="submit" size="sm"><Plus className="ml-1 h-3.5 w-3.5" />רישום</Button>
                </form>
                <div className="space-y-2">
                  {data?.communications.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 rounded-md border p-2">
                      <div className="mt-0.5 text-muted-foreground">
                        {c.channel === "phone" && <Phone className="h-4 w-4" />}
                        {c.channel === "email" && <Mail className="h-4 w-4" />}
                        {c.channel === "whatsapp" && <MessageCircle className="h-4 w-4" />}
                        {(c.channel === "meeting" || c.channel === "other") && <MessageCircle className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{CHANNEL_LABEL[c.channel as CommChannel]}</span>
                          <span>{c.direction === "in" ? "נכנס →" : "יוצא ←"}</span>
                          <span>{new Date(c.occurred_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap">{c.content}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteComm(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {(!data?.communications || data.communications.length === 0) && (
                    <p className="text-center text-sm text-muted-foreground py-4">אין רישומי תקשורת</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="invoices" className="space-y-3 pt-3">
                <form onSubmit={handleAddInvoice} className="space-y-2 rounded-md border p-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="מס׳ חשבונית" value={invForm.number} onChange={(e) => setInvForm({ ...invForm, number: e.target.value })} />
                    <Input type="number" placeholder="סכום" value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: Number(e.target.value) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={invForm.currency} onValueChange={(v) => setInvForm({ ...invForm, currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ILS">₪ ILS</SelectItem>
                        <SelectItem value="USD">$ USD</SelectItem>
                        <SelectItem value="EUR">€ EUR</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={invForm.status} onValueChange={(v) => setInvForm({ ...invForm, status: v as InvoiceStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(INVOICE_LABEL) as InvoiceStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{INVOICE_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={invForm.due_date} onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })} />
                  </div>
                  <Button type="submit" size="sm"><Plus className="ml-1 h-3.5 w-3.5" />חשבונית</Button>
                </form>
                <div className="space-y-2">
                  {data?.invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 rounded-md border p-2">
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "outline"}>
                        {INVOICE_LABEL[inv.status as InvoiceStatus]}
                      </Badge>
                      <div className="flex-1 text-sm">
                        <div className="font-medium">{inv.number || "—"}</div>
                        {inv.due_date && <div className="text-xs text-muted-foreground">לתשלום: {new Date(inv.due_date).toLocaleDateString("he-IL")}</div>}
                      </div>
                      <div className="tabular-nums font-medium">{fmt(Number(inv.amount), inv.currency)}</div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteInv(inv.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {(!data?.invoices || data.invoices.length === 0) && (
                    <p className="text-center text-sm text-muted-foreground py-4">אין חשבוניות</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
