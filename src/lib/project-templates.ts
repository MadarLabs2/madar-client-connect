export const MANAGE_TAB_IDS = [
  "overview",
  "products",
  "categories",
  "orders",
  "customers",
  "coupons",
  "offers",
  "reports",
  "notifications",
  "settings",
  "availability",
  "rest-days",
] as const;

export type ManageTabId = (typeof MANAGE_TAB_IDS)[number];
export type ManageTemplateId = "ecommerce" | "bakery";
export type ProductsManagerVariant = "ecommerce" | "bakery";

export type ManageTemplate = {
  id: ManageTemplateId;
  label: { he: string; en: string; ar: string };
  description: { he: string; en: string; ar: string };
  tabs: ManageTabId[];
  productsManager: ProductsManagerVariant;
};

export const MANAGE_TEMPLATES: Record<ManageTemplateId, ManageTemplate> = {
  ecommerce: {
    id: "ecommerce",
    label: { he: "חנות / איקומרס", en: "E-commerce", ar: "تجارة إلكترونية" },
    description: {
      he: "מוצרים, הזמנות, קופונים, ניוזלטר והגדרות — התבנית המלאה",
      en: "Products, orders, coupons, newsletter and settings — full template",
      ar: "منتجات، طلبات، كوبونات، نشرة إخبارية وإعدادات — القالب الكامل",
    },
    tabs: [
      "overview",
      "products",
      "categories",
      "orders",
      "customers",
      "coupons",
      "reports",
      "notifications",
      "settings",
    ],
    productsManager: "ecommerce",
  },
  bakery: {
    id: "bakery",
    label: { he: "מאפייה", en: "Bakery", ar: "مخبز" },
    description: {
      he: "ניהול מאפייה: מוצרים, הזמנות, קופונים, מבצעים, זמינות והגדרות",
      en: "Bakery operations: products, orders, coupons, offers, availability and settings",
      ar: "إدارة المخبز: المنتجات والطلبات والكوبونات والعروض والتوفر والإعدادات",
    },
    tabs: [
      "overview",
      "products",
      "categories",
      "orders",
      "coupons",
      "offers",
      "reports",
      "settings",
      "availability",
      "rest-days",
    ],
    productsManager: "bakery",
  },
};

export const MANAGE_TEMPLATE_IDS = Object.keys(MANAGE_TEMPLATES) as ManageTemplateId[];

export function getManageTemplate(id: string | null | undefined): ManageTemplate {
  if (id && id in MANAGE_TEMPLATES) return MANAGE_TEMPLATES[id as ManageTemplateId];
  return MANAGE_TEMPLATES.ecommerce;
}

export function isManageTabAllowed(
  templateId: string | null | undefined,
  tab: string,
): tab is ManageTabId {
  return getManageTemplate(templateId).tabs.includes(tab as ManageTabId);
}
