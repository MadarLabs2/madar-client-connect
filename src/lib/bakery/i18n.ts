import { useCallback } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { bakeryAdminDict } from "@/lib/bakery/admin-i18n";

type BakeryEntry = Record<Lang, string>;
type BakeryDict = Record<string, BakeryEntry>;

const dict: BakeryDict = {
  "bakery.shell.back": { he: "חזרה", en: "Back", ar: "رجوع" },
  "bakery.shell.connected": { he: "מחובר", en: "Connected", ar: "متصل" },
  "bakery.shell.notConnected": { he: "לא מחובר ל-DB", en: "Not connected to DB", ar: "غير متصل بقاعدة البيانات" },
  "bakery.shell.liveSite": { he: "אתר חי", en: "Live site", ar: "الموقع المباشر" },
  "bakery.shell.manage": { he: "ניהול מאפייה", en: "Bakery admin", ar: "إدارة المخبز" },

  "bakery.tab.overview": { he: "סקירה", en: "Overview", ar: "نظرة عامة" },
  "bakery.tab.products": { he: "מוצרים", en: "Products", ar: "المنتجات" },
  "bakery.tab.categories": { he: "קטגוריות", en: "Categories", ar: "الفئات" },
  "bakery.tab.orders": { he: "הזמנות", en: "Orders", ar: "الطلبات" },
  "bakery.tab.coupons": { he: "קופונים", en: "Coupons", ar: "الكوبونات" },
  "bakery.tab.offers": { he: "מבצעים", en: "Offers", ar: "العروض" },
  "bakery.tab.reports": { he: "דוחות", en: "Reports", ar: "التقارير" },
  "bakery.tab.settings": { he: "הגדרות", en: "Settings", ar: "الإعدادات" },
  "bakery.tab.availability": { he: "זמינות", en: "Availability", ar: "الإتاحة" },
  "bakery.tab.restDays": { he: "ימי מנוחה", en: "Rest days", ar: "أيام الراحة" },

  "bakery.common.loading": { he: "טוען…", en: "Loading…", ar: "جارٍ التحميل…" },
  "bakery.common.search": { he: "חיפוש…", en: "Search…", ar: "بحث…" },
  "bakery.common.save": { he: "שמירה", en: "Save", ar: "حفظ" },
  "bakery.common.cancel": { he: "ביטול", en: "Cancel", ar: "إلغاء" },
  "bakery.common.delete": { he: "מחיקה", en: "Delete", ar: "حذف" },
  "bakery.common.edit": { he: "עריכה", en: "Edit", ar: "تعديل" },
  "bakery.common.create": { he: "יצירה", en: "Create", ar: "إنشاء" },
  "bakery.common.status": { he: "סטטוס", en: "Status", ar: "الحالة" },
  "bakery.common.name": { he: "שם", en: "Name", ar: "الاسم" },
  "bakery.common.description": { he: "תיאור", en: "Description", ar: "الوصف" },
  "bakery.common.price": { he: "מחיר", en: "Price", ar: "السعر" },
  "bakery.common.active": { he: "פעיל", en: "Active", ar: "نشط" },
  "bakery.common.inactive": { he: "לא פעיל", en: "Inactive", ar: "غير نشط" },
  "bakery.common.noData": { he: "אין נתונים", en: "No data", ar: "لا توجد بيانات" },

  "bakery.dashboard.title": { he: "סקירת מאפייה", en: "Bakery overview", ar: "نظرة عامة على المخبز" },
  "bakery.dashboard.todayOrders": { he: "הזמנות היום", en: "Today's orders", ar: "طلبات اليوم" },
  "bakery.dashboard.todayRevenue": { he: "הכנסות היום", en: "Today's revenue", ar: "إيرادات اليوم" },
  "bakery.dashboard.pendingOrders": { he: "הזמנות בטיפול", en: "Pending orders", ar: "الطلبات قيد المعالجة" },
  "bakery.dashboard.lowStock": { he: "מלאי נמוך", en: "Low stock", ar: "مخزون منخفض" },

  "bakery.products.title": { he: "ניהול מוצרים", en: "Products management", ar: "إدارة المنتجات" },
  "bakery.products.add": { he: "הוספת מוצר", en: "Add product", ar: "إضافة منتج" },
  "bakery.products.empty": { he: "לא נמצאו מוצרים.", en: "No products found.", ar: "لم يتم العثور على منتجات." },

  "bakery.categories.title": { he: "קטגוריות", en: "Categories", ar: "الفئات" },
  "bakery.categories.add": { he: "הוספת קטגוריה", en: "Add category", ar: "إضافة فئة" },
  "bakery.categories.empty": { he: "אין קטגוריות.", en: "No categories.", ar: "لا توجد فئات." },

  "bakery.orders.title": { he: "ניהול הזמנות", en: "Orders management", ar: "إدارة الطلبات" },
  "bakery.orders.number": { he: "מס' הזמנה", en: "Order #", ar: "رقم الطلب" },
  "bakery.orders.customer": { he: "לקוח", en: "Customer", ar: "العميل" },
  "bakery.orders.total": { he: "סה״כ", en: "Total", ar: "الإجمالي" },
  "bakery.orders.paymentStatus": { he: "סטטוס תשלום", en: "Payment status", ar: "حالة الدفع" },
  "bakery.orders.updateStatus": { he: "עדכון סטטוס", en: "Update status", ar: "تحديث الحالة" },

  "bakery.coupons.title": { he: "קופונים", en: "Coupons", ar: "الكوبونات" },
  "bakery.coupons.add": { he: "קופון חדש", en: "New coupon", ar: "كوبون جديد" },
  "bakery.coupons.code": { he: "קוד", en: "Code", ar: "الرمز" },
  "bakery.coupons.discount": { he: "הנחה", en: "Discount", ar: "الخصم" },

  "bakery.offers.title": { he: "מבצעים", en: "Offers", ar: "العروض" },
  "bakery.offers.add": { he: "מבצע חדש", en: "New offer", ar: "عرض جديد" },
  "bakery.offers.empty": { he: "אין מבצעים פעילים.", en: "No active offers.", ar: "لا توجد عروض نشطة." },

  "bakery.settings.title": { he: "הגדרות חנות", en: "Store settings", ar: "إعدادات المتجر" },
  "bakery.settings.storeName": { he: "שם החנות", en: "Store name", ar: "اسم المتجر" },
  "bakery.settings.phone": { he: "טלפון", en: "Phone", ar: "الهاتف" },
  "bakery.settings.whatsapp": { he: "וואטסאפ", en: "WhatsApp", ar: "واتساب" },
  "bakery.settings.email": { he: "אימייל", en: "Email", ar: "البريد الإلكتروني" },
  "bakery.settings.deliveryFee": { he: "דמי משלוח", en: "Delivery fee", ar: "رسوم التوصيل" },
  "bakery.settings.minOrder": { he: "מינימום הזמנה", en: "Minimum order", ar: "الحد الأدنى للطلب" },

  "bakery.availability.title": { he: "זמינות משלוחים", en: "Delivery availability", ar: "إتاحة التوصيل" },
  "bakery.availability.day": { he: "יום", en: "Day", ar: "اليوم" },
  "bakery.availability.timeFrom": { he: "משעה", en: "From", ar: "من" },
  "bakery.availability.timeTo": { he: "עד שעה", en: "To", ar: "إلى" },
  "bakery.availability.cutoff": { he: "שעת סגירה להזמנה", en: "Order cutoff time", ar: "موعد إغلاق الطلب" },

  "bakery.restDays.title": { he: "ימי מנוחה", en: "Rest days", ar: "أيام الراحة" },
  "bakery.restDays.add": { he: "הוספת יום מנוחה", en: "Add rest day", ar: "إضافة يوم راحة" },
  "bakery.restDays.reason": { he: "סיבה", en: "Reason", ar: "السبب" },
  "bakery.restDays.date": { he: "תאריך", en: "Date", ar: "التاريخ" },

  "bakery.reports.title": { he: "דוחות מכירות", en: "Sales reports", ar: "تقارير المبيعات" },
  "bakery.reports.range": { he: "טווח תאריכים", en: "Date range", ar: "نطاق التاريخ" },
  "bakery.reports.export": { he: "ייצוא CSV", en: "Export CSV", ar: "تصدير CSV" },
  "bakery.reports.revenue": { he: "הכנסות", en: "Revenue", ar: "الإيرادات" },
  "bakery.reports.orders": { he: "הזמנות", en: "Orders", ar: "الطلبات" },
};

const mergedDict: BakeryDict = { ...bakeryAdminDict, ...dict };

export function isRTL(lang: Lang): boolean {
  return lang === "he" || lang === "ar";
}

export function useBakeryT() {
  const { lang, dir, setLang } = useI18n();

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const entry = mergedDict[key];
      let value = entry ? entry[lang] : key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(`{${k}}`, String(v)).replace(`{{${k}}}`, String(v));
        }
      }
      return value;
    },
    [lang],
  );

  return { t, lang, dir, setLang, dict: mergedDict };
}
