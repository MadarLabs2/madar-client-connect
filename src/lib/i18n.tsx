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

  // ===== Admin page =====
  "admin.kicker": { he: "ניהול · תצוגת מאסטר", en: "Admin · Master view", ar: "الإدارة · العرض الرئيسي" },
  "admin.title": { he: "תיק לקוחות", en: "Client portfolio", ar: "محفظة العملاء" },
  "admin.crmBtn": { he: "CRM", en: "CRM", ar: "العملاء" },
  "admin.newProject": { he: "פרויקט חדש", en: "New project", ar: "مشروع جديد" },
  "admin.addClient": { he: "הוסף לקוח חדש", en: "Add new client", ar: "إضافة عميل جديد" },
  "admin.newClient.title": { he: "חשבון לקוח חדש", en: "New client account", ar: "حساب عميل جديد" },
  "admin.newClient.desc": { he: "ייווצרו פרטי כניסה. הלקוח יוכל להתחבר מיד.", en: "Generates login credentials. The client can sign in immediately.", ar: "يتم إنشاء بيانات تسجيل الدخول. يمكن للعميل تسجيل الدخول فورًا." },
  "admin.contactName": { he: "שם איש קשר", en: "Contact name", ar: "اسم جهة الاتصال" },
  "admin.company": { he: "חברה", en: "Company", ar: "الشركة" },
  "admin.email": { he: "אימייל", en: "Email", ar: "البريد الإلكتروني" },
  "admin.tempPassword": { he: "סיסמה זמנית", en: "Temporary password", ar: "كلمة مرور مؤقتة" },
  "admin.regen": { he: "צור חדשה", en: "Regenerate", ar: "إعادة إنشاء" },
  "admin.createClient": { he: "צור לקוח", en: "Create client", ar: "إنشاء عميل" },
  "admin.editProject": { he: "עריכת פרויקט", en: "Edit project", ar: "تعديل المشروع" },
  "admin.createProject": { he: "יצירת פרויקט", en: "Create project", ar: "إنشاء مشروع" },
  "admin.editProjectDesc": { he: "עדכן פרטי פרויקט וחיבור DB.", en: "Update project details and DB connection.", ar: "تحديث تفاصيل المشروع واتصال قاعدة البيانات." },
  "admin.createProjectDesc": { he: "שייך פרויקט חדש ללקוח.", en: "Assign a new project to a client.", ar: "تعيين مشروع جديد لعميل." },
  "admin.client": { he: "לקוח", en: "Client", ar: "العميل" },
  "admin.chooseClient": { he: "בחר לקוח", en: "Choose a client", ar: "اختر عميلاً" },
  "admin.projectName": { he: "שם הפרויקט", en: "Project name", ar: "اسم المشروع" },
  "admin.type": { he: "סוג", en: "Type", ar: "النوع" },
  "admin.manageTemplate": { he: "תבנית ניהול", en: "Manage template", ar: "قالب الإدارة" },
  "admin.status": { he: "סטטוס", en: "Status", ar: "الحالة" },
  "admin.progressPct": { he: "התקדמות (%)", en: "Progress (%)", ar: "التقدم (%)" },
  "admin.liveUrl": { he: "קישור חי", en: "Live URL", ar: "رابط مباشر" },
  "admin.cmsUrl": { he: "קישור CMS", en: "CMS URL", ar: "رابط نظام إدارة المحتوى" },
  "admin.dbConn": { he: "חיבור DB לפרויקט (אופציונלי)", en: "Project DB connection (optional)", ar: "اتصال قاعدة بيانات المشروع (اختياري)" },
  "admin.dbUrl": { he: "Supabase URL", en: "Supabase URL", ar: "Supabase URL" },
  "admin.anonKey": { he: "מפתח Anon (פומבי)", en: "Anon (publishable) key", ar: "مفتاح Anon (عام)" },
  "admin.serviceKey": { he: "Service role key", en: "Service role key", ar: "Service role key" },
  "admin.serviceKeyHint": { he: "מאוחסן מוצפן. רק אדמינים יכולים לקרוא.", en: "Stored encrypted at rest. Only admins can read it.", ar: "مخزن مشفر. يمكن للمسؤولين فقط قراءته." },
  "admin.save": { he: "שמור שינויים", en: "Save changes", ar: "حفظ التغييرات" },
  "admin.editClient": { he: "עריכת לקוח", en: "Edit client", ar: "تعديل العميل" },
  "admin.editClientDesc": { he: "עדכן שם וחברה.", en: "Update name and company.", ar: "تحديث الاسم والشركة." },
  "admin.saveBtn": { he: "שמור", en: "Save", ar: "حفظ" },
  "admin.deleteProject": { he: "למחוק פרויקט?", en: "Delete project?", ar: "حذف المشروع؟" },
  "admin.deleteProjectDesc": { he: "פעולה זו אינה הפיכה. הפרויקט והמוצרים יימחקו לצמיתות.", en: "This cannot be undone. The project and its products will be permanently removed.", ar: "لا يمكن التراجع عن ذلك. سيتم حذف المشروع ومنتجاته نهائيًا." },
  "admin.deleteClient": { he: "למחוק לקוח?", en: "Delete client?", ar: "حذف العميل؟" },
  "admin.deleteClientDesc": { he: "מוחק את חשבון המשתמש, הפרופיל, הפרויקטים וכל המוצרים המשויכים. לא הפיך.", en: "Deletes the user account, profile, projects, and all linked products. Cannot be undone.", ar: "يحذف حساب المستخدم والملف الشخصي والمشاريع وجميع المنتجات المرتبطة. لا يمكن التراجع." },
  "admin.cancel": { he: "ביטול", en: "Cancel", ar: "إلغاء" },
  "admin.delete": { he: "מחק", en: "Delete", ar: "حذف" },
  "admin.clients": { he: "לקוחות", en: "Clients", ar: "العملاء" },
  "admin.activeProjects": { he: "פרויקטים פעילים", en: "Active projects", ar: "مشاريع نشطة" },
  "admin.liveProducts": { he: "מוצרים חיים", en: "Live products", ar: "منتجات مباشرة" },
  "admin.totalProjects": { he: "סה״כ פרויקטים", en: "Total projects", ar: "إجمالي المشاريع" },
  "admin.allClients": { he: "כל הלקוחות", en: "All clients", ar: "جميع العملاء" },
  "admin.loading": { he: "טוען…", en: "Loading…", ar: "جارٍ التحميل…" },
  "admin.noClients": { he: "אין לקוחות עדיין. לחץ על", en: "No clients yet. Click", ar: "لا يوجد عملاء بعد. انقر على" },
  "admin.toInvite": { he: "כדי להוסיף.", en: "to invite one.", ar: "لإضافة عميل." },
  "admin.noProjects": { he: "טרם הוקצו פרויקטים.", en: "No projects assigned yet.", ar: "لم يتم تعيين مشاريع بعد." },
  "admin.noName": { he: "(ללא שם)", en: "(no name)", ar: "(بدون اسم)" },
  "admin.projectsCount": { he: "פרויקטים", en: "projects", ar: "مشاريع" },
  "admin.projectCount": { he: "פרויקט", en: "project", ar: "مشروع" },
  "admin.manage": { he: "ניהול", en: "Manage", ar: "إدارة" },
  "admin.allFieldsRequired": { he: "כל השדות נדרשים (סיסמה ≥ 8 תווים)", en: "All fields required (password ≥ 8 chars)", ar: "جميع الحقول مطلوبة (كلمة المرور ≥ 8 أحرف)" },
  "admin.clientCreated": { he: "לקוח נוצר ·", en: "Client created ·", ar: "تم إنشاء العميل ·" },
  "admin.failedCreate": { he: "יצירת לקוח נכשלה", en: "Failed to create client", ar: "فشل إنشاء العميل" },
  "admin.clientUpdated": { he: "הלקוח עודכן", en: "Client updated", ar: "تم تحديث العميل" },
  "admin.failedUpdate": { he: "העדכון נכשל", en: "Failed to update", ar: "فشل التحديث" },
  "admin.clientDeleted": { he: "הלקוח נמחק", en: "Client deleted", ar: "تم حذف العميل" },
  "admin.failedDelete": { he: "המחיקה נכשלה", en: "Failed to delete", ar: "فشل الحذف" },
  "admin.pickClient": { he: "בחר לקוח והזן שם פרויקט", en: "Pick a client and enter a project name", ar: "اختر عميلاً وأدخل اسم مشروع" },
  "admin.projectUpdated": { he: "הפרויקט עודכן", en: "Project updated", ar: "تم تحديث المشروع" },
  "admin.projectCreated": { he: "הפרויקט נוצר", en: "Project created", ar: "تم إنشاء المشروع" },
  "admin.failedSaveProject": { he: "שמירת הפרויקט נכשלה", en: "Failed to save project", ar: "فشل حفظ المشروع" },
  "admin.projectDeleted": { he: "הפרויקט נמחק", en: "Project deleted", ar: "تم حذف المشروع" },
  "admin.editAria": { he: "עריכה", en: "Edit", ar: "تعديل" },
  "admin.deleteAria": { he: "מחיקה", en: "Delete", ar: "حذف" },

  // ===== CRM =====
  "crm.kicker": { he: "CRM", en: "CRM", ar: "إدارة العملاء" },
  "crm.title": { he: "מערכת ניהול לקוחות", en: "Customer management", ar: "إدارة العملاء" },
  "crm.backAdmin": { he: "חזרה לאדמין", en: "Back to admin", ar: "العودة للإدارة" },
  "crm.dashboard": { he: "לוח בקרה", en: "Dashboard", ar: "لوحة التحكم" },
  "crm.pipeline": { he: "Pipeline", en: "Pipeline", ar: "مسار المبيعات" },
  "crm.newLead": { he: "ליד חדש", en: "New lead", ar: "عميل محتمل جديد" },
  "crm.metric.totalLeads": { he: "סה״כ לידים", en: "Total leads", ar: "إجمالي العملاء المحتملين" },
  "crm.metric.openValue": { he: "ערך פתוח", en: "Open value", ar: "القيمة المفتوحة" },
  "crm.metric.paid": { he: "הכנסות שולמו", en: "Revenue paid", ar: "الإيرادات المدفوعة" },
  "crm.metric.openDebt": { he: "חוב פתוח", en: "Open debt", ar: "الديون المفتوحة" },
  "crm.metric.winRate": { he: "אחוז סגירה", en: "Win rate", ar: "نسبة الإغلاق" },
  "crm.todayTasks": { he: "משימות להיום", en: "Today's tasks", ar: "مهام اليوم" },
  "crm.noTasks": { he: "אין משימות לטיפול היום 🎉", en: "No tasks for today 🎉", ar: "لا توجد مهام لليوم 🎉" },
  "crm.recentLeads": { he: "לידים אחרונים", en: "Recent leads", ar: "أحدث العملاء المحتملين" },
  "crm.noLeads": { he: "עוד אין לידים. הוסף ליד חדש להתחיל.", en: "No leads yet. Add a new lead to start.", ar: "لا يوجد عملاء محتملون بعد. أضف عميلاً جديدًا للبدء." },
  "crm.recentActivity": { he: "פעילות אחרונה", en: "Recent activity", ar: "أحدث النشاطات" },
  "crm.editLead": { he: "עריכת ליד", en: "Edit lead", ar: "تعديل العميل المحتمل" },
  "crm.newLeadTitle": { he: "ליד חדש", en: "New lead", ar: "عميل محتمل جديد" },
  "crm.leadDesc": { he: "פרטי איש קשר ופוטנציאל המכירה", en: "Contact and sales potential details", ar: "تفاصيل جهة الاتصال وإمكانات المبيعات" },
  "crm.name": { he: "שם", en: "Name", ar: "الاسم" },
  "crm.company": { he: "חברה", en: "Company", ar: "الشركة" },
  "crm.source": { he: "מקור", en: "Source", ar: "المصدر" },
  "crm.sourcePh": { he: "המלצה / אתר / ...", en: "Referral / Website / ...", ar: "إحالة / موقع / ..." },
  "crm.email": { he: "אימייל", en: "Email", ar: "البريد الإلكتروني" },
  "crm.phone": { he: "טלפון", en: "Phone", ar: "الهاتف" },
  "crm.stage": { he: "שלב", en: "Stage", ar: "المرحلة" },
  "crm.value": { he: "ערך", en: "Value", ar: "القيمة" },
  "crm.currency": { he: "מטבע", en: "Currency", ar: "العملة" },
  "crm.notes": { he: "הערות", en: "Notes", ar: "ملاحظات" },
  "crm.save": { he: "שמירה", en: "Save", ar: "حفظ" },
  "crm.create": { he: "יצירה", en: "Create", ar: "إنشاء" },
  "crm.nameRequired": { he: "שם הליד חובה", en: "Lead name is required", ar: "اسم العميل المحتمل مطلوب" },
  "crm.leadUpdated": { he: "הליד עודכן", en: "Lead updated", ar: "تم تحديث العميل المحتمل" },
  "crm.leadCreated": { he: "ליד נוצר", en: "Lead created", ar: "تم إنشاء العميل المحتمل" },
  "crm.error": { he: "שגיאה", en: "Error", ar: "خطأ" },
  "crm.leadDeleted": { he: "הליד נמחק", en: "Lead deleted", ar: "تم حذف العميل المحتمل" },
  "crm.confirmDelete": { he: "למחוק את הליד?", en: "Delete lead?", ar: "حذف العميل المحتمل؟" },
  "crm.confirmDeleteDesc": { he: "הפעולה תמחק גם את כל המשימות, התקשורת והחשבוניות הקשורות.", en: "This will also delete all related tasks, communications, and invoices.", ar: "سيتم أيضًا حذف جميع المهام والاتصالات والفواتير ذات الصلة." },
  "crm.cancel": { he: "ביטול", en: "Cancel", ar: "إلغاء" },
  "crm.delete": { he: "מחק", en: "Delete", ar: "حذف" },
  "crm.loading": { he: "טוען…", en: "Loading…", ar: "جارٍ التحميل…" },
  "crm.tab.info": { he: "פרטים", en: "Info", ar: "المعلومات" },
  "crm.tab.tasks": { he: "משימות", en: "Tasks", ar: "المهام" },
  "crm.tab.comms": { he: "תקשורת", en: "Communication", ar: "التواصل" },
  "crm.tab.invoices": { he: "חשבוניות", en: "Invoices", ar: "الفواتير" },
  "crm.taskTitle": { he: "כותרת המשימה", en: "Task title", ar: "عنوان المهمة" },
  "crm.taskDesc": { he: "תיאור (אופציונלי)", en: "Description (optional)", ar: "وصف (اختياري)" },
  "crm.add": { he: "הוסף", en: "Add", ar: "إضافة" },
  "crm.noTasksYet": { he: "אין משימות עדיין", en: "No tasks yet", ar: "لا توجد مهام بعد" },
  "crm.commContent": { he: "תוכן השיחה / הודעה", en: "Call / message content", ar: "محتوى المكالمة / الرسالة" },
  "crm.log": { he: "רישום", en: "Log", ar: "تسجيل" },
  "crm.noComms": { he: "אין רישומי תקשורת", en: "No communication records", ar: "لا توجد سجلات تواصل" },
  "crm.invNumber": { he: "מס׳ חשבונית", en: "Invoice #", ar: "رقم الفاتورة" },
  "crm.invAmount": { he: "סכום", en: "Amount", ar: "المبلغ" },
  "crm.invoiceBtn": { he: "חשבונית", en: "Invoice", ar: "فاتورة" },
  "crm.noInvoices": { he: "אין חשבוניות", en: "No invoices", ar: "لا توجد فواتير" },
  "crm.dueOn": { he: "לתשלום:", en: "Due:", ar: "الاستحقاق:" },
  "crm.outgoing": { he: "יוצא ←", en: "Outgoing →", ar: "صادر →" },
  "crm.incoming": { he: "נכנס →", en: "Incoming ←", ar: "وارد ←" },

  "stage.new": { he: "חדש", en: "New", ar: "جديد" },
  "stage.contacted": { he: "יצרנו קשר", en: "Contacted", ar: "تم التواصل" },
  "stage.qualified": { he: "מתאים", en: "Qualified", ar: "مؤهل" },
  "stage.proposal": { he: "הצעה נשלחה", en: "Proposal sent", ar: "تم إرسال العرض" },
  "stage.won": { he: "סגור", en: "Won", ar: "مغلق رابح" },
  "stage.lost": { he: "אבוד", en: "Lost", ar: "خاسر" },

  "act.call": { he: "שיחה", en: "Call", ar: "مكالمة" },
  "act.meeting": { he: "פגישה", en: "Meeting", ar: "اجتماع" },
  "act.email": { he: "אימייל", en: "Email", ar: "بريد إلكتروني" },
  "act.task": { he: "משימה", en: "Task", ar: "مهمة" },
  "act.note": { he: "הערה", en: "Note", ar: "ملاحظة" },

  "chan.phone": { he: "טלפון", en: "Phone", ar: "هاتف" },
  "chan.email": { he: "אימייל", en: "Email", ar: "بريد إلكتروني" },
  "chan.whatsapp": { he: "וואטסאפ", en: "WhatsApp", ar: "واتساب" },
  "chan.meeting": { he: "פגישה", en: "Meeting", ar: "اجتماع" },
  "chan.other": { he: "אחר", en: "Other", ar: "أخرى" },

  "inv.draft": { he: "טיוטה", en: "Draft", ar: "مسودة" },
  "inv.sent": { he: "נשלחה", en: "Sent", ar: "مرسلة" },
  "inv.paid": { he: "שולמה", en: "Paid", ar: "مدفوعة" },
  "inv.overdue": { he: "באיחור", en: "Overdue", ar: "متأخرة" },
  "inv.cancelled": { he: "בוטלה", en: "Cancelled", ar: "ملغاة" },

  // ===== Manage =====
  "manage.back": { he: "חזרה", en: "Back", ar: "رجوع" },
  "manage.connected": { he: "מחובר", en: "Connected", ar: "متصل" },
  "manage.notConnected": { he: "לא מחובר ל-DB", en: "Not connected to DB", ar: "غير متصل بقاعدة البيانات" },
  "manage.loading": { he: "טוען…", en: "Loading…", ar: "جارٍ التحميل…" },
  "manage.missing.title": { he: "חסרים פרטי חיבור", en: "Missing connection details", ar: "تفاصيل الاتصال مفقودة" },
  "manage.missing.body": { he: "כדי לנהל {label}, צריך להגדיר ב-Admin את ה-Supabase URL וה-Service Key של הפרויקט.", en: "To manage {label}, set the project's Supabase URL and Service Key in Admin.", ar: "لإدارة {label}، قم بتعيين Supabase URL و Service Key للمشروع في الإدارة." },
  "manage.status": { he: "סטטוס", en: "Status", ar: "الحالة" },
  "manage.type": { he: "סוג", en: "Type", ar: "النوع" },
  "manage.progress": { he: "התקדמות", en: "Progress", ar: "التقدم" },
  "manage.viewLive": { he: "צפייה באתר החי", en: "View live site", ar: "عرض الموقع المباشر" },
  "manage.tab.overview": { he: "סקירה", en: "Overview", ar: "نظرة عامة" },
  "manage.tab.products": { he: "מוצרים", en: "Products", ar: "منتجات" },
  "manage.tab.categories": { he: "קטגוריות", en: "Categories", ar: "فئات" },
  "manage.tab.orders": { he: "הזמנות", en: "Orders", ar: "طلبات" },
  "manage.tab.customers": { he: "לקוחות", en: "Customers", ar: "العملاء" },
  "manage.tab.coupons": { he: "קופונים", en: "Coupons", ar: "قسائم" },
  "manage.tab.reports": { he: "דוחות", en: "Reports", ar: "تقارير" },
  "manage.tab.notifications": { he: "הודעות", en: "Notifications", ar: "إشعارات" },
  "manage.tab.settings": { he: "הגדרות", en: "Settings", ar: "إعدادات" },
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
