import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  projectInfo,
  projectList,
  projectInsert,
  projectUpdate,
  projectDelete,
  projectUploadImage,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductsManager } from "@/components/manage/ProductsManager";
import { CategoriesManager } from "@/components/manage/CategoriesManager";
import { OrdersManager } from "@/components/manage/OrdersManager";
import { CustomersManager } from "@/components/manage/CustomersManager";
import { ReportsManager } from "@/components/manage/ReportsManager";
import { CouponsManager } from "@/components/manage/CouponsManager";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Package,
  Tags,
  ShoppingCart,
  Users,
  Ticket,
  BarChart3,
  Bell,
  Settings,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";

const searchSchema = z.object({
  tab: z
    .enum(["overview", "products", "categories", "orders", "customers", "coupons", "reports", "notifications", "settings"])
    .default("overview"),
});

export const Route = createFileRoute("/_authenticated/manage/$projectId")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ManageProject,
});

const TABS = [
  { id: "overview", label: "סקירה", icon: BarChart3, table: null },
  { id: "products", label: "מוצרים", icon: Package, table: "products" as const },
  { id: "categories", label: "קטגוריות", icon: Tags, table: "categories" as const },
  { id: "orders", label: "הזמנות", icon: ShoppingCart, table: "orders" as const },
  { id: "customers", label: "לקוחות", icon: Users, table: "profiles" as const },
  { id: "coupons", label: "קופונים", icon: Ticket, table: "coupons" as const },
  { id: "reports", label: "דוחות", icon: BarChart3, table: null },
  { id: "notifications", label: "ניוזלטר", icon: Bell, table: "newsletter_subscribers" as const },
  { id: "settings", label: "הגדרות", icon: Settings, table: "site_settings" as const },
] as const;

function ManageProject() {
  const { projectId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const infoFn = useServerFn(projectInfo);

  const { data: info, isLoading } = useQuery({
    queryKey: ["project-info", projectId],
    queryFn: () => infoFn({ data: { projectId } }),
  });

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 border-l bg-muted/30 px-3 py-6">
        <Link
          to="/dashboard"
          className="mb-6 flex items-center gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> חזרה
        </Link>
        <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {info?.name || "Project"}
        </div>
        <div className="mb-4 px-2 text-[11px] text-muted-foreground">
          {info?.hasCredentials ? "מחובר" : "לא מחובר ל-DB"}
        </div>
        <nav className="space-y-0.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === activeTab.id;
            return (
              <button
                key={t.id}
                onClick={() => navigate({ to: ".", search: { tab: t.id }, params: { projectId } })}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 px-6 py-6">
        {isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">טוען…</Card>
        ) : !info?.hasCredentials && activeTab.table ? (
          <Card className="p-6">
            <h2 className="font-display text-xl">חסרים פרטי חיבור</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              כדי לנהל {activeTab.label}, צריך להגדיר ב-Admin את ה-Supabase URL וה-Service Key של הפרויקט.
            </p>
          </Card>
        ) : activeTab.id === "overview" ? (
          <Overview info={info} />
        ) : activeTab.id === "reports" ? (
          <ReportsManager projectId={projectId} />
        ) : activeTab.id === "products" ? (
          <ProductsManager projectId={projectId} />
        ) : activeTab.id === "categories" ? (
          <CategoriesManager projectId={projectId} />
        ) : activeTab.id === "orders" ? (
          <OrdersManager projectId={projectId} />
        ) : activeTab.id === "customers" ? (
          <CustomersManager projectId={projectId} />
        ) : (
          <ResourceTable projectId={projectId} table={activeTab.table!} label={activeTab.label} />
        )}
      </main>
    </div>
  );
}

function Overview({ info }: { info: any }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">{info?.name}</h1>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">סטטוס</div>
          <div className="mt-1 text-lg">{info?.status}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">סוג</div>
          <div className="mt-1 text-lg">{info?.type}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">התקדמות</div>
          <div className="mt-1 text-lg">{info?.progress}%</div>
        </Card>
      </div>
      {info?.liveUrl && (
        <Button asChild variant="outline">
          <a href={info.liveUrl} target="_blank" rel="noreferrer">
            צפייה באתר החי
          </a>
        </Button>
      )}
    </div>
  );
}

function Reports({ projectId }: { projectId: string }) {
  const listFn = useServerFn(projectList);
  const { data: ordersRes } = useQuery({
    queryKey: ["pdb", projectId, "orders"],
    queryFn: () => listFn({ data: { projectId, table: "orders", limit: 500 } }),
  });
  const { data: productsRes } = useQuery({
    queryKey: ["pdb", projectId, "products"],
    queryFn: () => listFn({ data: { projectId, table: "products", limit: 500 } }),
  });
  const { data: customersRes } = useQuery({
    queryKey: ["pdb", projectId, "profiles"],
    queryFn: () => listFn({ data: { projectId, table: "profiles", limit: 500 } }),
  });

  const orders = ordersRes?.rows ?? [];
  const revenue = orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">דוחות</h1>
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">הזמנות</div>
          <div className="mt-1 text-2xl font-semibold">{orders.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">הכנסות</div>
          <div className="mt-1 text-2xl font-semibold">₪{revenue.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">מוצרים</div>
          <div className="mt-1 text-2xl font-semibold">{productsRes?.rows?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">לקוחות</div>
          <div className="mt-1 text-2xl font-semibold">{customersRes?.rows?.length ?? 0}</div>
        </Card>
      </div>
      {ordersRes?.error && (
        <Card className="p-4 text-sm text-muted-foreground">
          לא ניתן לטעון הזמנות: {ordersRes.error}
        </Card>
      )}
    </div>
  );
}

type Table = "products" | "categories" | "orders" | "profiles" | "coupons" | "newsletter_subscribers" | "site_settings";

function ResourceTable({ projectId, table, label }: { projectId: string; table: Table; label: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);
  const uploadFn = useServerFn(projectUploadImage);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(bin);
      const res = await uploadFn({
        data: {
          projectId,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          dataBase64,
        },
      });
      // Insert URL into the JSON editor
      setEditing((s) => {
        if (!s) return s;
        try {
          const obj = JSON.parse(s.json || "{}");
          const target = obj.data && typeof obj.data === "object" ? obj.data : obj;
          target.image_url = res.url;
          if (target !== obj && !obj.data) obj.data = target;
          return { ...s, json: JSON.stringify(obj, null, 2) };
        } catch {
          return { ...s, json: JSON.stringify({ image_url: res.url }, null, 2) };
        }
      });
      toast.success("התמונה הועלתה");
    } catch (e: any) {
      toast.error(e.message || "שגיאה בהעלאה");
    } finally {
      setUploading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["pdb", projectId, table],
    queryFn: () => listFn({ data: { projectId, table, limit: 500 } }),
  });

  const [editing, setEditing] = useState<{ id?: any; json: string } | null>(null);

  const rows = data?.rows ?? [];
  const columns = useMemo(() => {
    const set = new Set<string>();
    rows.slice(0, 10).forEach((r: any) => Object.keys(r).forEach((k) => set.add(k)));
    return Array.from(set).slice(0, 6);
  }, [rows]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, table] });

  const save = async () => {
    if (!editing) return;
    try {
      const row = JSON.parse(editing.json);
      if (editing.id != null) {
        const { id, ...rest } = row;
        await updateFn({ data: { projectId, table, id: editing.id, row: rest } });
      } else {
        await insertFn({ data: { projectId, table, row } });
      }
      toast.success("נשמר");
      setEditing(null);
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (id: any) => {
    if (!confirm("למחוק?")) return;
    try {
      await deleteFn({ data: { projectId, table, id } });
      toast.success("נמחק");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">{label}</h1>
        <Button onClick={() => setEditing({ json: "{\n  \n}" })}>
          <Plus className="mr-1.5 h-4 w-4" /> חדש
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">טוען…</Card>
      ) : data?.error ? (
        <Card className="p-6 text-sm">
          <div className="font-medium">לא ניתן לטעון את הטבלה</div>
          <div className="mt-1 text-muted-foreground">{data.error}</div>
          <div className="mt-3 text-xs text-muted-foreground">
            ודא שהטבלה <code>{table}</code> קיימת ב-Supabase של הפרויקט.
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">אין רשומות עדיין.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-medium">{c}</th>
                  ))}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={r.id ?? i} className="border-b last:border-0">
                    {columns.map((c) => (
                      <td key={c} className="max-w-[240px] truncate px-3 py-2 text-right">
                        {typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "")}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing({ id: r.id, json: JSON.stringify(r, null, 2) })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id != null ? "עריכת רשומה" : "רשומה חדשה"}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "מעלה…" : "העלאת תמונה"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-[11px] text-muted-foreground">
              התמונה תעלה ל-Storage של הפרויקט ותתווסף כ-image_url
            </span>
          </div>
          <Textarea
            className="min-h-[320px] font-mono text-xs"
            value={editing?.json ?? ""}
            onChange={(e) => setEditing((s) => (s ? { ...s, json: e.target.value } : s))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button onClick={save}>שמירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
