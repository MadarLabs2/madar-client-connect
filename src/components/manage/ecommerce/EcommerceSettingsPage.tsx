import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  EcommerceShippingZonesSection,
  type FlushShippingZoneActiveFn,
} from "@/components/manage/ecommerce/EcommerceShippingZonesSection";
import {
  gateFromSettingsRow,
  readEcommerceAdminGate,
  writeEcommerceAdminGate,
  type EcommerceAdminGate,
} from "@/lib/ecommerce/manage-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SettingsForm = {
  contact_phone_display: string;
  shipping_free_above_subtotal_nis: string;
  admin_accent_preset: EcommerceAccentId;
};

const EMPTY: SettingsForm = {
  contact_phone_display: "",
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
  const [gate, setGate] = useState<EcommerceAdminGate>(() => readEcommerceAdminGate(projectId));
  const [gateSaving, setGateSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const flushZonesActiveRef = useRef<FlushShippingZoneActiveFn | null>(null);

  const registerFlushZonesActive = useCallback((fn: FlushShippingZoneActiveFn | null) => {
    flushZonesActiveRef.current = fn;
  }, []);

  useEffect(() => {
    if (!current) {
      setForm({ ...EMPTY, admin_accent_preset: liveAccentId });
      return;
    }
    setForm({
      contact_phone_display: String(current.contact_phone_display ?? ""),
      shipping_free_above_subtotal_nis: String(current.shipping_free_above_subtotal_nis ?? 0),
      admin_accent_preset: parseAccentId(current.admin_accent_preset) ?? liveAccentId,
    });
    const storedGate = gateFromSettingsRow(current);
    if (storedGate) {
      writeEcommerceAdminGate(projectId, storedGate);
      setGate(storedGate);
    }
  }, [current?.id, current?.admin_gate_enabled, current?.admin_gate_password, liveAccentId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = <K extends keyof SettingsForm>(key: K, val: SettingsForm[K]) =>
    setForm((s) => ({ ...s, [key]: val }));

  const validate = (): boolean => {
    if (form.contact_phone_display.trim() && !isValidPhone(form.contact_phone_display)) {
      toast.error(t("validationPhone"));
      return false;
    }
    const free = Number(form.shipping_free_above_subtotal_nis);
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
      const baseRow = {
        contact_phone_display: form.contact_phone_display.trim(),
        shipping_free_above_subtotal_nis: Number(form.shipping_free_above_subtotal_nis),
      };

      const save = async (row: Record<string, unknown>) => {
        if (current?.id != null) {
          await updateFn({
            data: { projectId, table: "site_settings", id: current.id, row },
          });
        } else {
          await insertFn({ data: { projectId, table: "site_settings", row } });
        }
      };

      // If the project's DB doesn't have the admin_accent_preset column,
      // retry without it so phone/shipping still persist.
      let accentSavedToDb = true;
      try {
        await save({ ...baseRow, admin_accent_preset: form.admin_accent_preset });
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (!msg.includes("admin_accent_preset")) throw err;
        accentSavedToDb = false;
        await save(baseRow);
      }

      persistAccentLocal(projectId, form.admin_accent_preset);
      if (flushZonesActiveRef.current) {
        await flushZonesActiveRef.current();
      }
      toast.success(accentSavedToDb ? t("settingsSaved") : t("accentSavedLocal"));
      qc.invalidateQueries({ queryKey: ["pdb", projectId, "site_settings"] });
      qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "theme"] });
    } catch (err: any) {
      persistAccentLocal(projectId, form.admin_accent_preset);
      qc.invalidateQueries({ queryKey: ["ecommerce", projectId, "theme"] });
      toast.error(err?.message || t("loadFailed"));
    } finally {
      setSaving(false);
    }
  };

  const persistGate = async (next: EcommerceAdminGate) => {
    writeEcommerceAdminGate(projectId, next);
    setGate(next);
    const row = {
      admin_gate_enabled: next.enabled,
      admin_gate_password: next.password,
    };
    try {
      if (current?.id != null) {
        await updateFn({ data: { projectId, table: "site_settings", id: current.id, row } });
      } else {
        await insertFn({ data: { projectId, table: "site_settings", row } });
      }
      qc.invalidateQueries({ queryKey: ["pdb", projectId, "site_settings"] });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("admin_gate_")) return false;
      throw err;
    }
  };

  const handleToggleGate = async (enabled: boolean) => {
    setGateSaving(true);
    try {
      const savedToDb = await persistGate({ ...gate, enabled });
      toast.success(savedToDb ? t("gateToggled") : t("gateSavedLocal"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setGateSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (currentPassword !== gate.password) {
      toast.error(t("gateWrongCurrent"));
      return;
    }
    if (nextPassword.trim().length < 4) {
      toast.error(t("gatePasswordShort"));
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error(t("gatePasswordMismatch"));
      return;
    }
    setPasswordSaving(true);
    try {
      const savedToDb = await persistGate({ enabled: gate.enabled, password: nextPassword });
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setPasswordFormOpen(false);
      toast.success(savedToDb ? t("gateUpdated") : t("gateSavedLocal"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setPasswordSaving(false);
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
        <h2 className="font-display text-xl">{t("gateTitle")}</h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("gateDesc")}</p>
        <div className="mt-5 flex items-center gap-3">
          <span className="text-sm font-medium">{gate.enabled ? t("gateEnabled") : t("gateDisabled")}</span>
          <Switch
            checked={gate.enabled}
            disabled={gateSaving}
            onCheckedChange={(checked) => void handleToggleGate(checked)}
            aria-label={t("gateTitle")}
          />
        </div>
        <div className="mt-5">
          {passwordFormOpen ? (
            <div className="max-w-sm space-y-3">
              <Field label={t("gateCurrent")}>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                />
              </Field>
              <Field label={t("gateNew")}>
                <Input
                  type="password"
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                />
              </Field>
              <Field label={t("gateConfirm")}>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  dir="ltr"
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <Button type="button" disabled={passwordSaving} onClick={() => void handleUpdatePassword()}>
                  {passwordSaving ? t("saving") : t("gateUpdate")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={passwordSaving}
                  onClick={() => {
                    setPasswordFormOpen(false);
                    setCurrentPassword("");
                    setNextPassword("");
                    setConfirmPassword("");
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setPasswordFormOpen(true)}>
              {t("gateUpdateTitle")}
            </Button>
          )}
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
        <p className="mt-1 text-sm text-muted-foreground">{t("shippingFreeHint")}</p>
        <div className="mt-4 max-w-md">
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

      <EcommerceShippingZonesSection
        projectId={projectId}
        registerFlushActive={registerFlushZonesActive}
      />

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
