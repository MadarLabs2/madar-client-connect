import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";

type SettingsForm = {
  contact_phone_display: string;
  contact_email: string;
  contact_address: string;
  shipping_home_flat_nis: string;
  shipping_free_above_subtotal_nis: string;
  facebook_url: string;
  instagram_url: string;
  whatsapp_number: string;
};

const EMPTY: SettingsForm = {
  contact_phone_display: "",
  contact_email: "",
  contact_address: "",
  shipping_home_flat_nis: "0",
  shipping_free_above_subtotal_nis: "0",
  facebook_url: "",
  instagram_url: "",
  whatsapp_number: "",
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
      contact_email: String(current.contact_email ?? ""),
      contact_address: String(current.contact_address ?? ""),
      shipping_home_flat_nis: String(current.shipping_home_flat_nis ?? 0),
      shipping_free_above_subtotal_nis: String(current.shipping_free_above_subtotal_nis ?? 0),
      facebook_url: String(current.facebook_url ?? ""),
      instagram_url: String(current.instagram_url ?? ""),
      whatsapp_number: String(current.whatsapp_number ?? ""),
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof SettingsForm>(key: K, val: string) =>
    setForm((s) => ({ ...s, [key]: val }));

  const validate = (): boolean => {
    if (form.contact_phone_display.trim() && !isValidPhone(form.contact_phone_display)) {
      toast.error("מספר טלפון לא תקין (9–15 ספרות)");
      return false;
    }
    if (form.contact_email.trim() && !/^\S+@\S+\.\S+$/.test(form.contact_email)) {
      toast.error("אימייל לא תקין");
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
        contact_email: form.contact_email.trim(),
        contact_address: form.contact_address.trim(),
        shipping_home_flat_nis: Number(form.shipping_home_flat_nis),
        shipping_free_above_subtotal_nis: Number(form.shipping_free_above_subtotal_nis),
        facebook_url: form.facebook_url.trim(),
        instagram_url: form.instagram_url.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
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
          פרטי קשר, משלוחים ורשתות חברתיות. נשמר בטבלת <code>site_settings</code>.
        </p>
      </div>

      {data?.error && (
        <Card className="p-4 text-sm">
          <div className="font-medium">לא ניתן לטעון</div>
          <div className="mt-1 text-muted-foreground">{data.error}</div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-display text-xl">פרטי קשר</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="מספר טלפון">
            <Input
              value={form.contact_phone_display}
              onChange={(e) => update("contact_phone_display", e.target.value)}
              autoComplete="tel"
              dir="ltr"
            />
          </Field>
          <Field label="אימייל">
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) => update("contact_email", e.target.value)}
              dir="ltr"
            />
          </Field>
          <Field label="כתובת" className="md:col-span-2">
            <Textarea
              value={form.contact_address}
              onChange={(e) => update("contact_address", e.target.value)}
              rows={2}
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

      <Card className="p-5">
        <h2 className="font-display text-xl">רשתות חברתיות</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Facebook URL">
            <Input
              value={form.facebook_url}
              onChange={(e) => update("facebook_url", e.target.value)}
              dir="ltr"
            />
          </Field>
          <Field label="Instagram URL">
            <Input
              value={form.instagram_url}
              onChange={(e) => update("instagram_url", e.target.value)}
              dir="ltr"
            />
          </Field>
          <Field label="WhatsApp (מספר בינלאומי)">
            <Input
              value={form.whatsapp_number}
              onChange={(e) => update("whatsapp_number", e.target.value)}
              dir="ltr"
              placeholder="9725XXXXXXXX"
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
