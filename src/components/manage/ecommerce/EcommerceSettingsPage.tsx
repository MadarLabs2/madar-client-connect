import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { projectList, projectInsert, projectUpdate } from "@/lib/project-db.functions";
import {
  ECOMMERCE_ACCENT_IDS,
  ECOMMERCE_ACCENT_PRESETS,
  DEFAULT_ECOMMERCE_ACCENT,
  parseAccentId,
  persistAccentLocal,
  type EcommerceAccentId,
} from "@/lib/ecommerce/theme";
import { useEcommerceTheme } from "@/lib/ecommerce/EcommerceThemeContext";
import { ECOMMERCE_LANGS, useEcommerceT, type EcommerceLang } from "@/lib/ecommerce/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SettingsForm = {
  contact_phone_display: string;
  shipping_home_flat_nis: string;
  shipping_free_above_subtotal_nis: string;
  admin_accent_preset: EcommerceAccentId;
};

const EMPTY: SettingsForm = {
  contact_phone_display: "",
  shipping_home_flat_nis: "0",
  shipping_free_above_subtotal_nis: "0",
  admin_accent_preset: DEFAULT_ECOMMERCE_ACCENT,
};

function isValidPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

export function EcommerceSettingsPage({ projectId }: { projectId: string }) {
  const { t, lang, setLang } = useEcommerceT();
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const { accentId: liveAccentId, preset: livePreset } = useEcommerceTheme();

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
      setForm({ ...EMPTY, admin_accent_preset: liveAccentId });
      return;
    }
    setForm({
      contact_phone_display: String(current.contact_phone_display ?? ""),
      shipping_home_flat_nis: String(current.shipping_home_flat_nis ?? 0),
      shipping_free_above_subtotal_nis: String(current.shipping_free_above_subtotal_nis ?? 0),
      admin_accent_preset: parseAccentId(current.admin_accent_preset) ?? liveAccentId,
    });
  }, [current?.id, liveAccentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof SettingsForm>(key: K, val: SettingsForm[K]) =>
    setForm((s) => ({ ...s, [key]: val }));

  const validate = (): boolean => {
    if (form.contact_phone_display.trim() && !isValidPhone(form.contact_phone_display)) {
      toast.error(t("validationPhone"));
      return false;
    }
    const flat = Number(form.shipping_home_flat_nis);
    const free = Number(form.shipping_free_above_subtotal_nis);
    if (!Number.isFinite(flat) || flat < 0) {
      toast.error(t("validationShippingFlat"));
      return false;
    }
    if (!Number.isFinite(free) || free < 0) {
      toast.error(t("validationShippingFree"));
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
        admin_accent_preset: form.admin_accent_preset,
      };
      if (current?.id != null) {
        await updateFn({
          data: { projectId, table: "site_settings", id: current.id, row },
        });
      } else {
        await insertFn({ data: { projectId, table: "site_settings", row } });
      }
      persistAccentLocal(projectId, form.admin_accent_preset);
      toast.success(t("settingsSaved"));
      qc.invalidateQueries({ queryKey: ["pdb", projectId, "site_settings"] });
      qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "theme"] });
    } catch (err: any) {
      persistAccentLocal(projectId, form.admin_accent_preset);
      qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "theme"] });
      const msg = String(err?.message ?? "");
      if (msg.includes("admin_accent_preset")) {
        toast.success(t("accentSavedLocal"));
      } else {
        toast.error(err?.message || t("loadFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedPresetId = form.admin_accent_preset;

  if (isLoading) {
    return <Card className="border-border/70 p-6 text-sm text-muted-foreground">{t("loading")}</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">{t("settingsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsSubtitle")}</p>
      </div>

      {data?.error && (
        <Card className="border-border/70 p-4 text-sm">
          <div className="font-medium">{t("settingsLoadError")}</div>
          <div className="mt-1 text-muted-foreground">{data.error}</div>
        </Card>
      )}

      <Card className="border-border/70 p-5">
        <h2 className="font-display text-xl">{t("languageTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("languageDesc")}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {ECOMMERCE_LANGS.map(({ code, native }) => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code as EcommerceLang)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border/70 hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                {native}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="border-border/70 p-5">
        <h2 className="font-display text-xl">{t("accentTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("accentDesc")}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ECOMMERCE_ACCENT_IDS.map((id) => {
            const p = ECOMMERCE_ACCENT_PRESETS[id];
            const active = form.admin_accent_preset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => update("admin_accent_preset", id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border/70 hover:border-primary/40 hover:bg-muted/40",
                )}
              >
                <span
                  className="h-9 w-9 shrink-0 rounded-full border border-white/80 shadow-sm"
                  style={{ backgroundColor: p.swatch }}
                />
                <span className="text-sm font-medium">{t(`accent.${id}`)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm">
            {t("accentPreview")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("accentSelected", { label: t(`accent.${selectedPresetId}`) })}
            {livePreset.id !== form.admin_accent_preset ? t("accentSaveToApply") : ""}
          </span>
        </div>
      </Card>

      <Card className="border-border/70 p-5">
        <h2 className="font-display text-xl">{t("phone")}</h2>
        <div className="mt-4">
          <Field label={t("phoneField")}>
            <Input
              value={form.contact_phone_display}
              onChange={(e) => update("contact_phone_display", e.target.value)}
              autoComplete="tel"
              dir="ltr"
            />
          </Field>
        </div>
      </Card>

      <Card className="border-border/70 p-5">
        <h2 className="font-display text-xl">{t("shipping")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={t("shippingFlat")}>
            <Input
              type="number"
              min={0}
              value={form.shipping_home_flat_nis}
              onChange={(e) => update("shipping_home_flat_nis", e.target.value)}
            />
          </Field>
          <Field label={t("shippingFree")}>
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
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? t("saving") : t("saveSettings")}
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
