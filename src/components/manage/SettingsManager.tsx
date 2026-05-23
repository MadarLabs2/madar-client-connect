import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  projectList,
  projectInsert,
  projectUpdate,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SettingsForm = {
  contact_phone_display: string;
  shipping_home_flat_nis: string;
  shipping_free_above_subtotal_nis: string;
};

const EMPTY: SettingsForm = {
  contact_phone_display: "",
  shipping_home_flat_nis: "0",
  shipping_free_above_subtotal_nis: "0",
};

function isValidPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function SettingsManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);

  const { data, isLoading } = useQuery({
    queryKey: ["pdb", projectId, "site_settings"],
    queryFn: () => listFn({ data: { projectId, table: "site_settings", limit: 10 } }),
  });

  const rows: any[] = data?.rows ?? [];
  const current = rows[0] ?? null;

  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!current) {
      setForm(EMPTY);
      return;
    }
    setForm({
      contact_phone_display: String(current.contact_phone_display ?? ""),
      shipping_home_flat_nis: String(current.shipping_home_flat_nis ?? 0),
      shipping_free_above_subtotal_nis: String(current.shipping_free_above_subtotal_nis ?? 0),
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof SettingsForm>(key: K, val: string) =>
    setForm((s) => ({ ...s, [key]: val }));

  const validate = (): boolean => {
    if (form.contact_phone_display.trim() && !isValidPhone(form.contact_phone_display)) {
      toast.error("מספר טלפון לא תקין (9–15 ספרות)");
      return false;
    }
    const flat = Number(form.shipping_home_flat_nis);
    const free = Number(form.shipping_free_above_subtotal_nis);
    if (!Number.isFinite(flat) || flat < 0) {
      toast.error("מחיר משלוח חייב להיות מספר אי-שלילי");
      return false;
    }
    if (!Number.isFinite(free) || free < 0) {
      toast.error("סף משלוח חינם חייב להיות מספר אי-שלילי");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const row = {
        contact_phone_display: form.contact_phone_display.trim(),
        shipping_home_flat_nis: Number(form.shipping_home_flat_nis),
        shipping_free_above_subtotal_nis: Number(form.shipping_free_above_subtotal_nis),
      };
      if (current?.id != null) {
        await updateFn({
          data: { projectId, table: "site_settings", id: current.id, row },
        });
      } else {
        await insertFn({ data: { projectId, table: "site_settings", row } });
      }
      toast.success("ההגדרות נשמרו");
      qc.invalidateQueries({ queryKey: ["pdb", projectId, "site_settings"] });
    } catch (err: any) {
      toast.error(err?.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">טוען…</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">הגדרות אתר</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          מספר טלפון והגדרות משלוח. נשמר בטבלת <code>site_settings</code>.
        </p>
      </div>

      {data?.error && (
        <Card className="p-4 text-sm">
          <div className="font-medium">לא ניתן לטעון</div>
          <div className="mt-1 text-muted-foreground">{data.error}</div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-display text-xl">מספר טלפון</h2>
        <div className="mt-4">
          <Field label="מספר טלפון">
            <Input
              value={form.contact_phone_display}
              onChange={(e) => update("contact_phone_display", e.target.value)}
              autoComplete="tel"
              dir="ltr"
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl">משלוחים</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="מחיר משלוח עד הבית (₪)">
            <Input
              type="number"
              min={0}
              value={form.shipping_home_flat_nis}
              onChange={(e) => update("shipping_home_flat_nis", e.target.value)}
            />
          </Field>
          <Field label="משלוח חינם מעל סכום (₪)">
            <Input
              type="number"
              min={0}
              value={form.shipping_free_above_subtotal_nis}
              onChange={(e) => update("shipping_free_above_subtotal_nis", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "שומר…" : "שמירת הגדרות"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
