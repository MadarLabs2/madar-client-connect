import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "he" | "en" | "ar";

export const LANGS: { code: Lang; label: string; native: string; dir: "rtl" | "ltr" }[] = [
  { code: "he", label: "Hebrew", native: "עברית", dir: "rtl" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
  { code: "en", label: "English", native: "English", dir: "ltr" },
];

type Dict = Record<string, { he: string; en: string; ar: string }>;

const dict: Dict = {
  "app.name": { he: "מדאר", en: "Madar", ar: "مدار" },
  "nav.signOut": { he: "התנתקות", en: "Sign out", ar: "تسجيل الخروج" },
  "nav.signIn": { he: "התחברות", en: "Sign in", ar: "تسجيل الدخول" },
  "nav.language": { he: "שפה", en: "Language", ar: "اللغة" },
  "nav.admin": { he: "ניהול", en: "Admin", ar: "الإدارة" },
  "nav.dashboard": { he: "לוח בקרה", en: "Dashboard", ar: "لوحة التحكم" },
  "nav.crm": { he: "לידים", en: "CRM", ar: "العملاء" },

  "role.admin": { he: "מנהל", en: "Admin", ar: "مدير" },
  "role.client": { he: "לקוח", en: "Client", ar: "عميل" },

  "login.signin": { he: "התחברות", en: "Sign in", ar: "تسجيل الدخول" },
  "login.signup": { he: "צור חשבון", en: "Create account", ar: "إنشاء حساب" },
  "login.access": { he: "כניסה לפורטל הלקוחות שלך.", en: "Access your client portal.", ar: "ادخل إلى بوابة العملاء الخاصة بك." },
  "login.firstAdmin": { he: "החשבון הראשון יהיה המנהל.", en: "The first account becomes the admin.", ar: "أول حساب يصبح المدير." },
  "login.fullName": { he: "שם מלא", en: "Full name", ar: "الاسم الكامل" },
  "login.company": { he: "חברה", en: "Company", ar: "الشركة" },
  "login.email": { he: "אימייל", en: "Email", ar: "البريد الإلكتروني" },
  "login.password": { he: "סיסמה", en: "Password", ar: "كلمة المرور" },
  "login.passwordHint": { he: "לפחות 8 תווים", en: "At least 8 characters", ar: "8 أحرف على الأقل" },
  "login.wait": { he: "אנא המתן…", en: "Please wait…", ar: "يرجى الانتظار…" },
  "login.welcome": { he: "ברוך שובך", en: "Welcome back", ar: "مرحبًا بعودتك" },
  "login.created": { he: "החשבון נוצר. מתחבר…", en: "Account created. Signing you in…", ar: "تم إنشاء الحساب. جارٍ تسجيل الدخول…" },
  "login.tagline.l1": { he: "דרך שקטה יותר", en: "A quieter way", ar: "طريقة أكثر هدوءًا" },
  "login.tagline.l2": { he: "לנהל עבודה עם לקוחות.", en: "to run client work.", ar: "لإدارة عمل العملاء." },
  "login.subtitle": {
    he: "סביבה אחת לפרויקטים, פיננסים ותקשורת — נבנתה לסטודיו וללקוחות שהם משרתים.",
    en: "One workspace for projects, finances, and communication — built for studios and the clients they serve.",
    ar: "مساحة عمل واحدة للمشاريع والشؤون المالية والتواصل — صُمّمت للاستوديوهات والعملاء الذين تخدمهم.",
  },
  "login.haveAccount": { he: "יש לך כבר חשבון?", en: "Already have an account?", ar: "هل لديك حساب بالفعل؟" },
  "login.noAccount": { he: "אין לך חשבון?", en: "Don't have an account?", ar: "ليس لديك حساب؟" },

  "dash.workspace": { he: "סביבת העבודה שלך", en: "Your workspace", ar: "مساحة عملك" },
  "dash.welcome": { he: "ברוך הבא, {name}.", en: "Welcome, {name}.", ar: "مرحبًا، {name}." },
  "dash.empty": { he: "הפרויקטים שלך יופיעו כאן ברגע שהסטודיו ישייך אותם.", en: "Your projects will appear here once your studio assigns them.", ar: "ستظهر مشاريعك هنا بمجرد أن يخصصها لك الاستوديو." },
  "dash.today": { he: "סטטוס הפרויקטים שלך היום.", en: "Here's the state of your projects today.", ar: "إليك حالة مشاريعك اليوم." },
  "dash.hub": { he: "מרכז הפרויקטים", en: "Project hub", ar: "مركز المشاريع" },
  "dash.loading": { he: "טוען פרויקטים…", en: "Loading projects…", ar: "جارٍ تحميل المشاريع…" },
  "dash.none": { he: "אין עדיין פרויקטים.", en: "No projects yet.", ar: "لا توجد مشاريع بعد." },
  "dash.progress": { he: "התקדמות", en: "Progress", ar: "التقدم" },
  "dash.manage": { he: "לוח ניהול", en: "Manage", ar: "إدارة" },
  "dash.view": { he: "צפייה", en: "View", ar: "عرض" },
  "dash.cms": { he: "CMS חיצוני", en: "External CMS", ar: "نظام إدارة المحتوى" },

  "status.planning": { he: "בתכנון", en: "Planning", ar: "في التخطيط" },
  "status.in_progress": { he: "בעבודה", en: "In progress", ar: "قيد التنفيذ" },
  "status.review": { he: "בבדיקה", en: "In review", ar: "قيد المراجعة" },
  "status.live": { he: "באוויר", en: "Live", ar: "مباشر" },
  "status.paused": { he: "מושהה", en: "Paused", ar: "متوقف" },

  "nf.title": { he: "404", en: "404", ar: "404" },
  "nf.heading": { he: "הדף לא נמצא", en: "Page not found", ar: "الصفحة غير موجودة" },
  "nf.body": { he: "הדף שחיפשת לא קיים או הועבר.", en: "The page you're looking for doesn't exist or has been moved.", ar: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها." },
  "nf.home": { he: "לדף הבית", en: "Go home", ar: "العودة للرئيسية" },

  "err.title": { he: "הדף הזה לא נטען", en: "This page didn't load", ar: "لم يتم تحميل هذه الصفحة" },
  "err.body": { he: "משהו השתבש. נסה לרענן.", en: "Something went wrong. Try refreshing.", ar: "حدث خطأ ما. حاول التحديث." },
  "err.retry": { he: "נסה שוב", en: "Try again", ar: "حاول مرة أخرى" },
};

interface I18nCtx {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = "madar.lang";

function detectInitial(): Lang {
  if (typeof window === "undefined") return "he";
  const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved && LANGS.some((l) => l.code === saved)) return saved;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (nav === "he") return "he";
  if (nav === "ar") return "ar";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("he");

  useEffect(() => {
    setLangState(detectInitial());
  }, []);

  const dir = LANGS.find((l) => l.code === lang)?.dir ?? "rtl";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  function setLang(l: Lang) {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  function t(key: string, vars?: Record<string, string | number>) {
    const entry = dict[key];
    let str = entry ? entry[lang] : key;
    if (vars) for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, String(vars[k]));
    return str;
  }

  return <Ctx.Provider value={{ lang, dir, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used within I18nProvider");
  return v;
}
