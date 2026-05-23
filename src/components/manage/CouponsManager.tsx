import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  projectList,
  projectInsert,
  projectDelete,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search } from "lucide-react";

type CouponRow = {
  id: string;
  code: string;
  discount_percent: number;
  expires_at: string;
  active?: boolean;
};

function localDateTimeToIso(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d.toISOString();
}

function fmtExpiry(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export function CouponsManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const deleteFn = useServerFn(projectDelete);

  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [expiresLocal, setExpiresLocal] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "coupons"],
    queryFn: () => listFn({ data: { projectId, table: "coupons", limit: 500 } }),
  });

  const rows: any[] = data?.rows ?? [];

  const coupons: CouponRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: String(r.id ?? ""),
        code: String(r.code ?? ""),
        discount_percent: Number(r.discount_percent ?? 0),
        expires_at: String(r.expires_at ?? ""),
        active: r.active !== false,
      })),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return coupons;
    return coupons.filter((c) => c.code.toLowerCase().includes(q));
  }, [coupons, query]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, "coupons"] });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(percent, 10);
    if (!code.trim() || !expiresLocal || Number.isNaN(p)) {
      toast.error("נא למלא קוד, אחוז ותוקף");
      return;
    }
    if (p < 1 || p > 100) {
      toast.error("אחוז בין 1 ל־100");
      return;
    }
    setSaving(true);
    try {
      const expires_at = localDateTimeToIso(expiresLocal);
      await insertFn({
        data: {
          projectId,
          table: "coupons",
          row: { code: code.trim().toUpperCase(), discount_percent: p, expires_at, active: true },
        },
      });
      toast.success("הקופון נוסף");
      setCode("");
      setPercent("10");
      setExpiresLocal("");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את הקופון?")) return;
    try {
      await deleteFn({ data: { projectId, table: "coupons", id } });
      toast.success("נמחק");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message || "מחיקה נכשלה");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">קופונים</h1>
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

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">טוען…</div>
          ) : data?.error ? (
            <div className="p-6 text-sm">
              <div className="font-medium">לא ניתן לטעון את הטבלה</div>
              <div className="mt-1 text-muted-foreground">{data.error}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">אין קופונים עדיין.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">קוד</th>
                    <th className="px-3 py-2 text-right font-medium">הנחה</th>
                    <th className="px-3 py-2 text-right font-medium">תוקף</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {c.code}
                        {!c.active && (
                          <span className="ml-2 text-[10px] text-muted-foreground">(לא פעיל)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">−{c.discount_percent}%</td>
                      <td className="px-3 py-2 text-right">{fmtExpiry(c.expires_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
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

        <Card className="p-4">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg">
            <Plus className="h-4 w-4" />
            קופון חדש
          </h2>
          <form onSubmit={onSave} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">קוד קופון</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SUMMER20"
                dir="ltr"
                className="uppercase"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">אחוז הנחה</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">תאריך ושעת תפוגה</Label>
              <Input
                type="datetime-local"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "שומר…" : "הוספה"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCode("");
                  setPercent("10");
                  setExpiresLocal("");
                }}
                className="flex-1"
              >
                נקה
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
