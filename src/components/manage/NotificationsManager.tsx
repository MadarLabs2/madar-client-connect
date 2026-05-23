import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { projectList, projectDelete } from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search } from "lucide-react";

type SubscriberRow = {
  id: string;
  email: string;
  locale: string;
  created_at: string;
};

function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export function NotificationsManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const deleteFn = useServerFn(projectDelete);

  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "newsletter_subscribers"],
    queryFn: () =>
      listFn({ data: { projectId, table: "newsletter_subscribers", limit: 500 } }),
  });

  const rows: any[] = data?.rows ?? [];

  const subscribers: SubscriberRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: String(r.id ?? ""),
        email: String(r.email ?? ""),
        locale: String(r.locale ?? "he"),
        created_at: String(r.created_at ?? ""),
      })),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) => s.email.toLowerCase().includes(q) || s.locale.toLowerCase().includes(q)
    );
  }, [subscribers, query]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["pdb", projectId, "newsletter_subscribers"] });

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את הנמען?")) return;
    try {
      await deleteFn({ data: { projectId, table: "newsletter_subscribers", id } });
      toast.success("נמחק");
      invalidate();
    } catch (err: any) {
      toast.error(err?.message || "מחיקה נכשלה");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">ניוזלטר</h1>
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
        ) : data?.error ? (
          <div className="p-6 text-sm">
            <div className="font-medium">לא ניתן לטעון את הטבלה</div>
            <div className="mt-1 text-muted-foreground">{data.error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">אין נמענים עדיין.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">אימייל</th>
                  <th className="px-3 py-2 text-right font-medium">שפה</th>
                  <th className="px-3 py-2 text-right font-medium">תאריך</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-right font-mono text-xs" dir="ltr">
                      {s.email}
                    </td>
                    <td className="px-3 py-2 text-right uppercase">{s.locale}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {fmtDate(s.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}>
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

      <div className="text-xs text-muted-foreground">סה״כ נמענים: {subscribers.length}</div>
    </div>
  );
}
