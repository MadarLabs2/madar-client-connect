import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Eye,
  LayoutGrid,
  Mail,
  Plus,
  Send,
  Trash2,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBakeryDb } from "@/lib/bakery/db";
import { useBakeryT } from "@/lib/bakery/i18n";
import {
  loadSavedEmailTemplates,
  saveSavedEmailTemplates,
  type SavedEmailTemplate,
} from "@/lib/bakery/emailOfferTemplatesStorage";

type BakeryOffersPageProps = { projectId: string };

const catBreads = "/bakery/cat-breads.jpg";
const catPastries = "/bakery/cat-pastries.jpg";
const catCakes = "/bakery/cat-cakes.jpg";

type CampaignRow = {
  id: string;
  subject: string;
  message: string;
  discount_code: string | null;
  discount_percent: number | null;
  recipients_type: string;
  recipients_count: number;
  status: string;
  sent_at: string | null;
  created_at: string;
};

const SUBJECT_MAX = 120;

const cream = "#FDFBF7";
const forestBtn = "#1B4332";

type TemplateDef = {
  id: string;
  title: string;
  tag: string;
  subject: string;
  body: string;
  discount: string;
  cardClass: string;
  tagClass: string;
  imageSrc?: string;
  isCustom?: boolean;
};

function localDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tintToClasses(tint: SavedEmailTemplate["tint"]): { card: string; tag: string } {
  switch (tint) {
    case "amber":
      return {
        card: "bg-gradient-to-br from-amber-950 via-amber-900 to-orange-950 text-amber-50",
        tag: "border border-amber-400/30 bg-amber-400/15 text-amber-100",
      };
    case "brown":
      return {
        card: "bg-gradient-to-br from-[#3d2914] via-[#4a3220] to-[#2c1a0e] text-stone-100",
        tag: "border border-amber-200/25 bg-amber-200/10 text-amber-100",
      };
    case "slate":
      return {
        card: "bg-gradient-to-br from-slate-800 to-slate-950 text-slate-50",
        tag: "border border-slate-400/30 bg-white/10 text-slate-100",
      };
    default:
      return {
        card: "bg-gradient-to-br from-[#1B4332] to-[#2a5c45] text-white",
        tag: "border border-white/25 bg-white/15 text-white",
      };
  }
}

function savedToDef(s: SavedEmailTemplate): TemplateDef {
  const { card, tag } = tintToClasses(s.tint);
  return {
    id: s.id,
    title: s.title,
    tag: s.tag,
    subject: s.subject,
    body: s.body,
    discount: s.discount,
    cardClass: card,
    tagClass: tag,
    imageSrc: s.imageUrl?.trim() || undefined,
    isCustom: true,
  };
}

export function BakeryOffersPage({ projectId }: BakeryOffersPageProps) {
  const db = useBakeryDb(projectId);
  const { t, dir } = useBakeryT();
  const [subscribers, setSubscribers] = useState<{ id: string; email: string }[]>([]);
  const [past, setPast] = useState<CampaignRow[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return localDatetimeInputValue(d);
  });
  const [allTemplatesOpen, setAllTemplatesOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addTemplateOpen, setAddTemplateOpen] = useState(false);
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
  const [customRows, setCustomRows] = useState<SavedEmailTemplate[]>([]);

  const [ntTitle, setNtTitle] = useState("");
  const [ntTag, setNtTag] = useState("");
  const [ntSubject, setNtSubject] = useState("");
  const [ntBody, setNtBody] = useState("");
  const [ntDiscount, setNtDiscount] = useState("");
  const [ntImageUrl, setNtImageUrl] = useState("");
  const [ntTint, setNtTint] = useState<SavedEmailTemplate["tint"]>("green");

  const reloadCustom = useCallback(() => {
    setCustomRows(loadSavedEmailTemplates());
  }, []);

  useEffect(() => {
    reloadCustom();
  }, [reloadCustom]);

  const builtInTemplates: TemplateDef[] = useMemo(
    () => [
      {
        id: "builtin-weekend",
        title: t("adminOffersTplWeekendTitle"),
        tag: t("adminOffersTagDiscount"),
        subject: t("adminOffersTplWeekendSubject"),
        body: t("adminOffersTplWeekendBody"),
        discount: "WEEKEND20",
        cardClass: "bg-gradient-to-br from-[#1B4332] to-[#2a5c45] text-white shadow-md",
        tagClass: "border border-white/25 bg-white/15 text-white",
        imageSrc: catBreads,
      },
      {
        id: "builtin-ramadan",
        title: t("adminOffersTplRamadanTitle"),
        tag: t("adminOffersTagSeasonal"),
        subject: t("adminOffersTplRamadanSubject"),
        body: t("adminOffersTplRamadanBody"),
        discount: "RAMADAN15",
        cardClass: "bg-gradient-to-br from-amber-950 via-amber-900 to-orange-950 text-amber-50 shadow-md",
        tagClass: "border border-amber-400/30 bg-amber-400/15 text-amber-100",
        imageSrc: catPastries,
      },
      {
        id: "builtin-launch",
        title: t("adminOffersTplLaunchTitle"),
        tag: t("adminOffersTagAnnouncement"),
        subject: t("adminOffersTplLaunchSubject"),
        body: t("adminOffersTplLaunchBody"),
        discount: "NEWLAUNCH",
        cardClass: "bg-gradient-to-br from-[#3d2914] via-[#4a3220] to-[#2c1a0e] text-stone-100 shadow-md",
        tagClass: "border border-amber-200/25 bg-amber-200/10 text-amber-100",
        imageSrc: catCakes,
      },
    ],
    [t],
  );

  const offerTemplates: TemplateDef[] = useMemo(
    () => [...builtInTemplates, ...customRows.map(savedToDef)],
    [builtInTemplates, customRows],
  );

  const load = async () => {
    try {
      const subRes = await db
        .from("email_subscribers")
        .select("id, email")
        .eq("is_active", true)
        .limit(500);
      if (!subRes.error && (subRes.data?.length ?? 0) > 0) {
        setSubscribers(subRes.data as { id: string; email: string }[]);
      } else {
        const nlRes = await db.from("newsletter_subscribers").select("id, email").limit(500);
        setSubscribers(
          ((nlRes.data ?? []) as Array<{ id: unknown; email: unknown }>).map((s) => ({
            id: String(s.id),
            email: String(s.email),
          })),
        );
      }
    } catch {
      setSubscribers([]);
    }

    const { data, error } = await db
      .from("email_campaigns")
      .select(
        "id, subject, message, discount_code, discount_percent, recipients_type, recipients_count, status, sent_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setPast((data ?? []) as CampaignRow[]);
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  const applyTemplate = (tpl: TemplateDef) => {
    setSubject(tpl.subject.slice(0, SUBJECT_MAX));
    setBody(tpl.body);
    setDiscountCode(tpl.discount);
    setSelectedTemplateId(tpl.id);
    setPreviewImageSrc(tpl.imageSrc ?? null);
    setAllTemplatesOpen(false);
  };

  const removeCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = customRows.filter((r) => r.id !== id);
    setCustomRows(next);
    saveSavedEmailTemplates(next);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null);
      setPreviewImageSrc(null);
    }
    toast.success(t("adminOffersTemplateRemoved"));
  };

  const resetNewTemplateForm = () => {
    setNtTitle("");
    setNtTag("");
    setNtSubject("");
    setNtBody("");
    setNtDiscount("");
    setNtImageUrl("");
    setNtTint("green");
  };

  const saveNewTemplate = () => {
    const title = ntTitle.trim();
    const tag = ntTag.trim();
    const sub = ntSubject.trim();
    const bod = ntBody.trim();
    const disc = ntDiscount.trim();
    if (!title || !tag || !sub || !bod) {
      toast.error(t("subjectBodyRequired"));
      return;
    }
    let imageUrl: string | null = ntImageUrl.trim() || null;
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
      toast.error(t("adminOffersImageUrlHttpsOnly"));
      return;
    }
    const row: SavedEmailTemplate = {
      id: crypto.randomUUID(),
      title,
      tag,
      subject: sub,
      body: bod,
      discount: disc || "PROMO",
      imageUrl,
      tint: ntTint,
    };
    const next = [...customRows, row];
    setCustomRows(next);
    saveSavedEmailTemplates(next);
    resetNewTemplateForm();
    setAddTemplateOpen(false);
    toast.success(t("adminOffersTemplateSaved"));
  };

  const send = async () => {
    if (!subject || !body) return toast.error(t("subjectBodyRequired"));
    if (scheduleMode === "later") {
      toast.message(t("adminOffersScheduleComingToast"));
      return;
    }
    setSending(true);
    try {
      const pct = discountPercent.trim() ? Number(discountPercent) : null;
      const payload = {
        subject: subject.slice(0, SUBJECT_MAX),
        message: body,
        discount_code: discountCode.trim() || null,
        discount_percent: pct != null && !Number.isNaN(pct) ? pct : null,
        recipients_type: testRecipient.trim() ? "test" : "subscribers",
        recipients_count: testRecipient.trim() ? 1 : subscribers.length,
        status: "saved",
        sent_at: null,
      };
      const { error } = await db.from("email_campaigns").insert(payload);
      if (error) throw error;
      toast.message(t("emailCampaignSavedTitle"), {
        description: t("emailNotConfigured"),
      });
      setSubject("");
      setBody("");
      setDiscountCode("");
      setDiscountPercent("");
      setSelectedTemplateId(null);
      setPreviewImageSrc(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("emailCampaignSendError"));
    }
    setSending(false);
  };

  const previewSnippet = body.trim() ? (body.length > 220 ? `${body.slice(0, 220)}…` : body) : "—";

  const scheduledSummary =
    scheduleMode === "later" && scheduledAt
      ? (() => {
          try {
            const d = new Date(scheduledAt);
            return Number.isNaN(d.getTime()) ? scheduledAt : format(d, "PPp");
          } catch {
            return scheduledAt;
          }
        })()
      : null;

  const renderTemplateCard = (tpl: TemplateDef) => {
    const hasImg = Boolean(tpl.imageSrc);
    return (
      <div key={tpl.id} className="relative shrink-0">
        {tpl.isCustom ? (
          <button
            type="button"
            className="absolute end-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition hover:bg-black/60"
            title={t("adminOffersDeleteTemplate")}
            aria-label={t("adminOffersDeleteTemplate")}
            onClick={(e) => removeCustomTemplate(tpl.id, e)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => applyTemplate(tpl)}
          className={cn(
            "relative flex min-h-[132px] min-w-[200px] max-w-[220px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl p-4 text-left transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4332] focus-visible:ring-offset-2",
            !hasImg && tpl.cardClass,
            selectedTemplateId === tpl.id && "ring-2 ring-offset-2 ring-offset-[#FDFBF7] ring-[#D4AF37]/90",
          )}
        >
          {hasImg ? (
            <>
              <img src={tpl.imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15" />
            </>
          ) : null}
          <div className={cn("relative z-10 flex h-full flex-col justify-between", hasImg && "text-white")}>
            <div>
              <p className="font-display text-base font-bold leading-snug drop-shadow-sm">{tpl.title}</p>
              {tpl.id === "builtin-weekend" ? (
                <p className="mt-1 font-display text-sm font-semibold tracking-wide text-[#E8D5A3] drop-shadow">
                  20% OFF
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "mt-3 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide drop-shadow",
                hasImg ? "border border-white/35 bg-black/30 text-white" : tpl.tagClass,
              )}
            >
              {tpl.tag}
            </span>
          </div>
        </button>
      </div>
    );
  };

  const templatePicker = (compact: boolean) => (
    <div
      className={cn(
        "flex gap-3 overflow-x-auto pb-2 pt-1",
        compact ? "-mx-1 px-1" : "flex-wrap",
      )}
      style={{ direction: dir === "rtl" ? "rtl" : "ltr" }}
    >
      {offerTemplates.map((tpl) => renderTemplateCard(tpl))}
      <button
        type="button"
        onClick={() => {
          resetNewTemplateForm();
          setAddTemplateOpen(true);
        }}
        className="flex min-h-[132px] min-w-[200px] max-w-[220px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C9B8A4] bg-white/70 text-[#1B4332] shadow-sm transition hover:border-[#1B4332]/50 hover:bg-[#FDFBF7]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1B4332]/10">
          <Plus className="h-6 w-6" strokeWidth={2} aria-hidden />
        </div>
        <span className="px-2 text-center text-sm font-semibold">{t("adminOffersAddTemplate")}</span>
      </button>
    </div>
  );

  return (
    <div className="admin-page-enter min-h-full pb-16 pt-2 md:pt-6" style={{ backgroundColor: cream }}>
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <header className="admin-header-enter mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#1B3324] md:text-4xl">
              {t("adminDashEmailOffersTitle")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#3C2A21]/80">
              {t("adminOffersPageSubtitle")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-2 rounded-xl border-[#E8E4DC] bg-white text-[#1B4332] shadow-sm hover:bg-[#F9F9F7]"
            onClick={() => setAllTemplatesOpen(true)}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {t("adminOffersTemplatesBtn")}
          </Button>
        </header>

        <div
          role="alert"
          className="admin-section-enter mb-6 flex gap-3 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          style={{ animationDelay: "120ms" }}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-semibold">{t("emailTestModeTitle")}</p>
            <p className="mt-1 text-amber-900/90">{t("emailTestModeDesc")}</p>
          </div>
        </div>

        <section className="admin-section-enter mb-8" style={{ animationDelay: "200ms" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-[#1B3324] md:text-xl">
              {t("adminOffersChooseTemplate")}
            </h2>
            <button
              type="button"
              className="text-sm font-medium text-[#1B4332] underline-offset-4 hover:underline"
              onClick={() => setAllTemplatesOpen(true)}
            >
              {t("adminOffersViewAllTemplates")}
            </button>
          </div>
          <div className="-mx-4 px-4 md:mx-0 md:px-0">{templatePicker(true)}</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card className="overflow-hidden border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 border-b border-[#E8E4DC] p-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${forestBtn}18` }}
                  >
                    <Users className="h-5 w-5 text-[#1B4332]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("adminOffersAudience")}
                    </p>
                    <p className="truncate font-medium text-[#2c2419]">
                      {t("adminOffersTestRecipientOnly")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("adminOffersTestRecipientHint").replace("{{n}}", String(subscribers.length))}
                    </p>
                  </div>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground/50" aria-hidden />
                </div>
                <div className="max-h-44 space-y-0 overflow-y-auto px-4 py-3 text-sm">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    {t("adminOffersSubscribers")}
                  </p>
                  {subscribers.map((s) => (
                    <div
                      key={s.id}
                      className="border-b border-[#F0EBE3] py-2 text-[#3C2A21] last:border-0"
                    >
                      {s.email}
                    </div>
                  ))}
                  {subscribers.length === 0 && (
                    <p className="py-2 text-muted-foreground">{t("adminOffersNoSubscribers")}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="space-y-2 p-4">
                <Label htmlFor="offer-subject" className="flex items-center gap-2 text-[#2c2419]">
                  <Mail className="h-4 w-4 text-[#1B4332]" aria-hidden />
                  {t("adminOffersSubjectLine")}
                </Label>
                <Input
                  id="offer-subject"
                  value={subject}
                  maxLength={SUBJECT_MAX}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("adminOffersSubjectPlaceholder")}
                  className="rounded-xl border-[#E8E4DC] bg-[#FDFBF7]/80 text-base"
                />
                <p className="text-right text-xs tabular-nums text-muted-foreground">
                  {subject.length}/{SUBJECT_MAX}
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="space-y-2 p-4">
                <Label htmlFor="offer-test-email" className="text-[#2c2419]">
                  {t("adminOffersTestEmailLabel")}
                </Label>
                <Input
                  id="offer-test-email"
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder={t("adminOffersTestEmailPlaceholder")}
                  className="rounded-xl border-[#E8E4DC] bg-[#FDFBF7]/80"
                />
                <p className="text-xs text-muted-foreground">{t("adminOffersTestEmailHint")}</p>
              </CardContent>
            </Card>

            <Card className="border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="space-y-2 p-4">
                <Label htmlFor="offer-discount" className="text-[#2c2419]">
                  {t("adminOffersDiscountHint")}
                </Label>
                <Input
                  id="offer-discount"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="WELCOME10"
                  className="rounded-xl border-[#E8E4DC] bg-[#FDFBF7]/80"
                />
              </CardContent>
            </Card>

            <Card className="border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="space-y-2 p-4">
                <Label htmlFor="offer-discount-pct" className="text-[#2c2419]">
                  {t("adminOffersDiscountPercentLabel")}
                </Label>
                <Input
                  id="offer-discount-pct"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="20"
                  className="rounded-xl border-[#E8E4DC] bg-[#FDFBF7]/80"
                />
              </CardContent>
            </Card>

            <Card className="border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="offer-body" className="text-[#2c2419]">
                    {t("adminLabelCampaignMessage")}
                  </Label>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("adminOffersCompose")}
                  </span>
                </div>
                <Textarea
                  id="offer-body"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("adminOffersMessagePlaceholder")}
                  className="min-h-[180px] rounded-xl border-[#E8E4DC] bg-[#FDFBF7]/80"
                />
              </CardContent>
            </Card>

            <Card className="border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-[#1B4332]" aria-hidden />
                    <div className="min-w-0 flex-1 space-y-4">
                      <p className="font-display font-semibold text-[#2c2419]">{t("adminOffersScheduleTitle")}</p>
                      <RadioGroup
                        value={scheduleMode}
                        onValueChange={(v) => setScheduleMode(v as "now" | "later")}
                        className="grid gap-3"
                      >
                        <label
                          htmlFor="sched-now"
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-1 py-1 hover:bg-[#FDFBF7]"
                        >
                          <RadioGroupItem value="now" id="sched-now" />
                          <span className="text-sm font-medium">{t("adminOffersSendNow")}</span>
                        </label>
                        <label
                          htmlFor="sched-later"
                          className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-1 py-1 hover:bg-[#FDFBF7]"
                        >
                          <RadioGroupItem value="later" id="sched-later" />
                          <span className="text-sm font-medium">{t("adminOffersScheduleLater")}</span>
                        </label>
                      </RadioGroup>
                    </div>
                  </div>
                  <div className="w-full shrink-0 sm:w-[min(100%,240px)] sm:text-end">
                    {scheduleMode === "later" ? (
                      <div className="rounded-xl border border-[#E8E4DC] bg-[#FDFBF7]/80 p-3 text-start sm:text-end">
                        <Label htmlFor="sched-at" className="text-xs text-muted-foreground">
                          {t("adminOffersSchedulePickTime")}
                        </Label>
                        <Input
                          id="sched-at"
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="mt-2 rounded-lg border-[#E8E4DC] bg-white"
                        />
                        {scheduledSummary ? (
                          <p className="mt-2 text-xs text-muted-foreground">{scheduledSummary}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#E8E4DC] bg-[#FDFBF7]/80 px-3 py-3 text-sm text-muted-foreground sm:text-end">
                        {t("adminOffersImmediateSendHint")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-[#E8E4DC] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E8E4DC] px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#2c2419]">
                  <Eye className="h-4 w-4 text-[#1B4332]" aria-hidden />
                  {t("adminOffersPreviewTitle")}
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-[#1B4332] underline-offset-4 hover:underline"
                  onClick={() => setPreviewOpen(true)}
                >
                  {t("adminOffersViewFullPreview")}
                </button>
              </div>
              <div className="p-4" style={{ backgroundColor: cream }}>
                <div className="overflow-hidden rounded-xl border border-[#E8E4DC] bg-white shadow-inner">
                  {previewImageSrc ? (
                    <div className="relative h-32 w-full overflow-hidden border-b border-[#E8E4DC]">
                      <img src={previewImageSrc} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    </div>
                  ) : null}
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4332] font-display text-xs font-bold text-white">
                        A
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{t("brand")}</span>
                    </div>
                    <p className="font-display text-lg font-bold leading-snug text-[#1B4332]">
                      {subject.trim() || "—"}
                    </p>
                    {discountCode.trim() ? (
                      <p className="mt-2 text-xs font-medium text-[#7a6210]">
                        {t("adminThCode")}: {discountCode.trim()}
                      </p>
                    ) : null}
                    {discountPercent.trim() ? (
                      <p className="mt-1 text-xs font-medium text-[#7a6210]">
                        {discountPercent.trim()}% {t("adminOffersDiscountOff")}
                      </p>
                    ) : null}
                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {previewSnippet}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Button
              type="button"
              size="lg"
              disabled={sending}
              className="h-14 w-full gap-2 rounded-2xl text-base font-semibold text-white shadow-lg transition hover:opacity-95"
              style={{ backgroundColor: forestBtn }}
              onClick={send}
            >
              <Send className="h-5 w-5 shrink-0" aria-hidden />
              {t("adminOffersSendEmailOffer")}
            </Button>
          </div>

          <div>
            <Card className="sticky top-4 border-[#E8E4DC] bg-white shadow-sm">
              <CardContent className="p-5">
                <h2 className="font-display text-xl font-bold text-[#1B4332]">{t("adminOffersPastCampaigns")}</h2>
                <div className="mt-4 max-h-[min(70vh,520px)] space-y-3 overflow-y-auto text-sm">
                  {past.map((o) => (
                    <div key={o.id} className="rounded-xl border border-[#F0EBE3] bg-[#FDFBF7]/60 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <b className="text-[#2c2419]">{o.subject}</b>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {format(new Date(o.sent_at || o.created_at), "PP")}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            o.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : o.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-stone-100 text-stone-600",
                          )}
                        >
                          {o.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {t("adminOffersRecipientsCount").replace("{{n}}", String(o.recipients_count ?? 0))}
                        </span>
                      </div>
                      {o.discount_code ? (
                        <p className="mt-1 text-xs text-[#7a6210]">
                          {t("adminThCode")}: {o.discount_code}
                        </p>
                      ) : null}
                      {o.discount_percent ? (
                        <p className="mt-0.5 text-xs text-[#7a6210]">
                          {o.discount_percent}% {t("adminOffersDiscountOff")}
                        </p>
                      ) : null}
                      <p className="mt-2 line-clamp-3 text-muted-foreground">{o.message}</p>
                    </div>
                  ))}
                  {past.length === 0 && (
                    <p className="text-muted-foreground">{t("adminOffersNoCampaigns")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-[#E8E4DC] bg-[#FDFBF7]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1B4332]">
              {t("adminOffersPreviewDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 overflow-hidden rounded-2xl border border-[#E8E4DC] bg-white shadow-sm">
            {previewImageSrc ? (
              <div className="relative max-h-48 w-full overflow-hidden">
                <img src={previewImageSrc} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              </div>
            ) : null}
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1B4332] font-display text-sm font-bold text-white">
                  A
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("brand")}</p>
                  <p className="font-display text-lg font-bold text-[#1B4332]">{subject.trim() || "—"}</p>
                </div>
              </div>
              {discountCode.trim() ? (
                <p className="mb-4 rounded-lg bg-[#D4AF37]/15 px-3 py-2 text-sm font-medium text-[#5c4a12]">
                  {t("adminThCode")}: {discountCode.trim()}
                </p>
              ) : null}
              {discountPercent.trim() ? (
                <p className="mb-4 rounded-lg bg-[#D4AF37]/15 px-3 py-2 text-sm font-medium text-[#5c4a12]">
                  {discountPercent.trim()}% {t("adminOffersDiscountOff")}
                </p>
              ) : null}
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#3C2A21]">
                {body.trim() || "—"}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={allTemplatesOpen} onOpenChange={setAllTemplatesOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#E8E4DC] bg-[#FDFBF7]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1B4332]">
              {t("adminOffersAllTemplatesTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">{templatePicker(false)}</div>
        </DialogContent>
      </Dialog>

      <Dialog open={addTemplateOpen} onOpenChange={setAddTemplateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-[#E8E4DC] bg-[#FDFBF7]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-[#1B4332]">
              {t("adminOffersNewTemplateDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nt-title">{t("adminOffersTemplateTitleField")}</Label>
              <Input
                id="nt-title"
                value={ntTitle}
                onChange={(e) => setNtTitle(e.target.value)}
                className="rounded-xl border-[#E8E4DC] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt-tag">{t("adminOffersTemplateTagField")}</Label>
              <Input
                id="nt-tag"
                value={ntTag}
                onChange={(e) => setNtTag(e.target.value)}
                className="rounded-xl border-[#E8E4DC] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt-subject">{t("adminOffersSubjectLine")}</Label>
              <Input
                id="nt-subject"
                value={ntSubject}
                maxLength={SUBJECT_MAX}
                onChange={(e) => setNtSubject(e.target.value)}
                className="rounded-xl border-[#E8E4DC] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt-body">{t("adminLabelCampaignMessage")}</Label>
              <Textarea
                id="nt-body"
                rows={5}
                value={ntBody}
                onChange={(e) => setNtBody(e.target.value)}
                className="rounded-xl border-[#E8E4DC] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt-disc">{t("adminOffersDiscountHint")}</Label>
              <Input
                id="nt-disc"
                value={ntDiscount}
                onChange={(e) => setNtDiscount(e.target.value)}
                placeholder="WELCOME10"
                className="rounded-xl border-[#E8E4DC] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt-img">{t("adminOffersTemplateImageUrlField")}</Label>
              <Input
                id="nt-img"
                value={ntImageUrl}
                onChange={(e) => setNtImageUrl(e.target.value)}
                placeholder="https://"
                className="rounded-xl border-[#E8E4DC] bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nt-tint">{t("adminOffersTemplateTintField")}</Label>
              <select
                id="nt-tint"
                value={ntTint}
                onChange={(e) => setNtTint(e.target.value as SavedEmailTemplate["tint"])}
                className="flex h-10 w-full rounded-xl border border-[#E8E4DC] bg-white px-3 text-sm"
              >
                <option value="green">{t("adminOffersTintGreen")}</option>
                <option value="amber">{t("adminOffersTintAmber")}</option>
                <option value="brown">{t("adminOffersTintBrown")}</option>
                <option value="slate">{t("adminOffersTintSlate")}</option>
              </select>
            </div>
            <Button
              type="button"
              className="w-full rounded-xl bg-[#1B4332] text-white"
              onClick={saveNewTemplate}
            >
              {t("adminOffersSaveTemplate")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t("adminOffersTemplatesStorageNote")}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
