import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  projectList,
  projectInsert,
  projectUpdate,
  projectDelete,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type CategoryRow = {
  id: string;
  name: string;
  name_he: string;
  name_ar: string;
};

const emptyForm: CategoryRow = { id: "", name: "", name_he: "", name_ar: "" };

export function CategoriesManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);

  const [query, setQuery] = useState("");
  const [form, setForm] = useState<CategoryRow>(emptyForm);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "categories"],
    queryFn: () => listFn({ data: { projectId, table: "categories", limit: 500 } }),
  });

  const rows: any[] = data?.rows ?? [];

  const categories: CategoryRow[] = useMemo(
    () =>
      rows.map((r) => ({
        id: String(r.id ?? ""),
        name: String(r.name ?? ""),
        name_he: String(r.name_he ?? ""),
        name_ar: String(r.name_ar ?? ""),
      })),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.name_he.toLowerCase().includes(q) ||
        c.name_ar.toLowerCase().includes(q)
    );
  }, [categories, query]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pdb", projectId, "categories"] });

  const reset = () => {
    setForm(emptyForm);
    setEditingOriginalId(null);
  };

  const onEdit = (c: CategoryRow) => {
    setForm(c);
    setEditingOriginalId(c.id);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id || !form.name || !form.name_he || !form.name_ar) {
      toast.error("נא למלא את כל השדות");
      return;
    }
    const normalizedId = form.id.trim().toLowerCase().replace(/\s+/g, "-");
    const row = {
      id: normalizedId,
      name: form.name.trim(),
      name_he: form.name_he.trim(),
      name_ar: form.name_ar.trim(),
    };
    setSaving(true);
    try {
      if (editingOriginalId && editingOriginalId === normalizedId) {
        const { id, ...rest } = row;
        await updateFn({ data: { projectId, table: "categories", id: editingOriginalId, row: rest } });
      } else {
        // New id or renamed slug -> insert (and remove old if renamed)
        await insertFn({ data: { projectId, table: "categories", row } });
        if (editingOriginalId && editingOriginalId !== normalizedId) {
          await deleteFn({ data: { projectId, table: "categories", id: editingOriginalId } });
        }
      }
      toast.success("נשמר");
      reset();
      invalidate();
    } catch (err: any) {
      toast.error(err?.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את הקטגוריה?")) return;
    try {
      await deleteFn({ data: { projectId, table: "categories", id } });
      toast.success("נמחק");
      if (editingOriginalId === id) reset();
      invalidate();
    } catch (err: any) {
      toast.error(err?.message || "מחיקה נכשלה");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">קטגוריות</h1>
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
            <div className="p-6 text-sm text-muted-foreground">לא נמצאו קטגוריות.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">ID</th>
                    <th className="px-3 py-2 text-right font-medium">שמות</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-3 py-2 text-right font-mono text-xs">{c.id}</td>
                      <td className="px-3 py-2 text-right">
                        {c.name} / {c.name_he} / {c.name_ar}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
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

        <Card className="p-4">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg">
            <Plus className="h-4 w-4" />
            {editingOriginalId ? "עריכת קטגוריה" : "הוספת קטגוריה"}
          </h2>
          <form onSubmit={onSave} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">ID (slug)</Label>
              <Input
                value={form.id}
                onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                placeholder="dresses"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">English</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Dresses"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">עברית</Label>
              <Input
                value={form.name_he}
                onChange={(e) => setForm((p) => ({ ...p, name_he: e.target.value }))}
                placeholder="שמלות"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">العربية</Label>
              <Input
                value={form.name_ar}
                onChange={(e) => setForm((p) => ({ ...p, name_ar: e.target.value }))}
                placeholder="فساتين"
                dir="rtl"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "שומר…" : "שמירה"}
              </Button>
              <Button type="button" variant="outline" onClick={reset} className="flex-1">
                נקה
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
