import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  projectList,
  projectUpdate,
  projectDelete,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, Eye, Trash2, Ban, CheckCircle2, ShoppingCart } from "lucide-react";

type CustomerRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
  order_count: number;
};

export function CustomersManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(projectList);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profilesRes, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "profiles"],
    queryFn: () => listFn({ data: { projectId, table: "profiles", limit: 500 } }),
  });

  const { data: ordersRes } = useQuery({
    queryKey: ["pdb", projectId, "orders"],
    queryFn: () => listFn({ data: { projectId, table: "orders", limit: 500 } }),
  });

  const customers: CustomerRow[] = useMemo(() => {
    const rows: any[] = profilesRes?.rows ?? [];
    const orders: any[] = ordersRes?.rows ?? [];
    const counts = new Map<string, number>();
    for (const o of orders) {
      const uid = String(o.user_id ?? "");
      if (!uid) continue;
      counts.set(uid, (counts.get(uid) ?? 0) + 1);
    }
    return rows.map((r) => ({
      id: String(r.id ?? ""),
      full_name: String(r.full_name ?? r.name ?? ""),
      email: String(r.email ?? ""),
      phone: String(r.phone ?? ""),
      role: String(r.role ?? "customer"),
      is_blocked: Boolean(r.is_blocked),
      created_at: String(r.created_at ?? ""),
      order_count: counts.get(String(r.id ?? "")) ?? 0,
    }));
  }, [profilesRes, ordersRes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, "profiles"] });

  const open = (c: CustomerRow) => {
    setSelected(c);
    setFullName(c.full_name);
    setPhone(c.phone);
  };

  const onSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          projectId,
          table: "profiles",
          id: selected.id,
          row: { full_name: fullName, phone },
        },
      });
      toast.success("נשמר");
      setSelected({ ...selected, full_name: fullName, phone });
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const toggleBlock = async () => {
    if (!selected) return;
    const next = !selected.is_blocked;
    try {
      await updateFn({
        data: {
          projectId,
          table: "profiles",
          id: selected.id,
          row: { is_blocked: next },
        },
      });
      toast.success(next ? "המשתמש נחסם" : "החסימה הוסרה");
      setSelected({ ...selected, is_blocked: next });
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "פעולה נכשלה");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את המשתמש לצמיתות?")) return;
    try {
      await deleteFn({ data: { projectId, table: "profiles", id } });
      toast.success("נמחק");
      if (selected?.id === id) setSelected(null);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "מחיקה נכשלה");
    }
  };

  const isAdmin = selected?.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">לקוחות</h1>
        <div className="relative">
          <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש…"
            className="w-56 pr-7"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">טוען…</div>
        ) : profilesRes?.error ? (
          <div className="p-6 text-sm">
            <div className="font-medium">לא ניתן לטעון את הטבלה</div>
            <div className="mt-1 text-muted-foreground">{profilesRes.error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">לא נמצאו לקוחות.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">שם</th>
                  <th className="px-3 py-2 text-right font-medium">קשר</th>
                  <th className="px-3 py-2 text-right font-medium">תפקיד</th>
                  <th className="px-3 py-2 text-right font-medium">הזמנות</th>
                  <th className="px-3 py-2 text-right font-medium">סטטוס</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-right">
                      <div>{c.full_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="text-xs">{c.email || "—"}</div>
                      {c.phone && (
                        <div className="text-xs text-muted-foreground">{c.phone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                        {c.role === "admin" ? "אדמין" : "לקוח"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{c.order_count}</td>
                    <td className="px-3 py-2 text-right">
                      {c.is_blocked ? (
                        <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          חסום
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">פעיל</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => open(c)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected?.full_name || selected?.email || selected?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          {selected?.is_blocked && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              חסום — המשתמש לא יכול להתחבר
            </div>
          )}

          {selected && (
            <div className="space-y-4">
              <Card className="p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-xs">{selected.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">אימייל</span>
                  <span>{selected.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תפקיד</span>
                  <span>{isAdmin ? "אדמין" : "לקוח"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">הזמנות</span>
                  <span>{selected.order_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">תאריך הצטרפות</span>
                  <span>{new Date(selected.created_at).toLocaleString()}</span>
                </div>
              </Card>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">שם מלא</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">טלפון</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <Button onClick={onSave} disabled={saving} className="w-full">
                  {saving ? "שומר…" : "שמירת שינויים"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelected(null);
                    navigate({
                      to: ".",
                      search: { tab: "orders" },
                      params: { projectId },
                    });
                  }}
                >
                  <ShoppingCart className="ml-1 h-4 w-4" /> צפייה בהזמנות
                </Button>
              </div>

              {isAdmin ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  חסימה ומחיקה אינן זמינות לחשבונות אדמין.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" onClick={toggleBlock} className="flex-1">
                    {selected.is_blocked ? (
                      <>
                        <CheckCircle2 className="ml-1 h-4 w-4" /> ביטול חסימה
                      </>
                    ) : (
                      <>
                        <Ban className="ml-1 h-4 w-4" /> חסימת משתמש
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onDelete(selected.id)}
                    className="flex-1"
                  >
                    <Trash2 className="ml-1 h-4 w-4" /> מחיקת משתמש
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              סגירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
