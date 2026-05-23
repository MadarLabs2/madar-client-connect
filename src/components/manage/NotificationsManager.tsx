import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  projectList,
  projectDelete,
  projectSendBroadcast,
} from "@/lib/project-db.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Search, Send } from "lucide-react";

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

const localeLabel = (loc: string) =>
  loc === "he" ? "עברית" : loc === "ar" ? "ערבית" : loc === "en" ? "אנגלית" : loc;

export function NotificationsManager({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(projectList);
  const deleteFn = useServerFn(projectDelete);
  const sendFn = useServerFn(projectSendBroadcast);

  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectAr, setSubjectAr] = useState("");
  const [subjectEn, setSubjectEn] = useState("");
  const [body, setBody] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const validate = (): boolean => {
    if (!subject.trim() || !body.trim()) {
      toast.error("נא למלא נושא ותוכן בעברית");
      return false;
    }
    const needsAr = subscribers.some((s) => s.locale === "ar");
    const needsEn = subscribers.some((s) => s.locale === "en");
    if (needsAr && (!subjectAr.trim() || !bodyAr.trim())) {
      toast.error("יש מנויים בערבית — נא למלא נושא ותוכן בערבית");
      return false;
    }
    if (needsEn && (!subjectEn.trim() || !bodyEn.trim())) {
      toast.error("יש מנויים באנגלית — נא למלא נושא ותוכן באנגלית");
      return false;
    }
    return true;
  };

  const onSend = async () => {
    setSending(true);
    setConfirmOpen(false);
    try {
      const res = await sendFn({
        data: {
          projectId,
          subject: subject.trim(),
          subjectAr: subjectAr.trim(),
          subjectEn: subjectEn.trim(),
          body: body.trim(),
          bodyAr: bodyAr.trim(),
          bodyEn: bodyEn.trim(),
        },
      });
      if (res.ok) {
        toast.success(`נשלח ל-${res.sent} נמענים`);
        setSubject(""); setSubjectAr(""); setSubjectEn("");
        setBody(""); setBodyAr(""); setBodyEn("");
      } else {
        toast.error(
          `שליחה לא הופעלה (${(res as any).queued} ממתינים). ודא שקיימת פונקציית edge בשם send-newsletter-broadcast בפרויקט.`
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "שליחה נכשלה");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>אישור שליחה</AlertDialogTitle>
            <AlertDialogDescription>
              ההודעה תישלח ל-{subscribers.length} נמענים. להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onSend()}>שלח</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">הודעות</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ניהול מנויי ניוזלטר ושליחת הודעות.
          </p>
        </div>
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
        <div className="border-b bg-muted/30 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
          רשימת נמענים ({subscribers.length})
        </div>
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
              <thead className="border-b bg-muted/20 text-xs uppercase text-muted-foreground">
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
                    <td className="px-3 py-2 text-right">{localeLabel(s.locale)}</td>
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

      <Card className="p-5">
        <div className="mb-4">
          <h2 className="font-display text-xl">חיבור הודעה חדשה</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            מלא את הנושא והתוכן בעברית. אם יש מנויים בערבית/אנגלית, מלא גם בשפות אלו.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              נושא (עברית)
            </label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} dir="rtl" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              نوع الموضوع (ערבית)
            </label>
            <Input value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} maxLength={200} dir="rtl" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Subject (אנגלית)
            </label>
            <Input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} maxLength={200} dir="ltr" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              תוכן (עברית)
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              maxLength={20000}
              dir="rtl"
              className="min-h-[10rem]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              المحتوى (ערבית)
            </label>
            <Textarea
              value={bodyAr}
              onChange={(e) => setBodyAr(e.target.value)}
              rows={8}
              maxLength={20000}
              dir="rtl"
              className="min-h-[10rem]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Body (אנגלית)
            </label>
            <Textarea
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              rows={8}
              maxLength={20000}
              dir="ltr"
              className="min-h-[10rem]"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button
            disabled={sending || subscribers.length === 0}
            onClick={() => {
              if (!validate()) return;
              setConfirmOpen(true);
            }}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {sending ? "שולח…" : `שלח ל-${subscribers.length} נמענים`}
          </Button>
        </div>
      </Card>
    </div>
  );
}
