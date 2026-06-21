/**
 * Al-Nour Bakery — HTML email templates for Resend.
 * Palette: dark green #1B4332, cream #FDFBF7, gold #D4AF37, warm brown #3C2A21.
 * Inline styles only — tested for Gmail, Outlook, and mobile clients.
 */

const BRAND = "Al-nour Gluten-free Bakery";
const BRAND_SHORT = "Al-Nour Bakery";
const TAGLINE = "Fresh · Wholesome · 100% Gluten-free";
const GREEN = "#1B4332";
const GREEN_LIGHT = "#2D6A4F";
const CREAM = "#FDFBF7";
const CREAM_DARK = "#F5F0E8";
const GOLD = "#D4AF37";
const GOLD_LIGHT = "#E8D5A3";
const BROWN = "#3C2A21";
const MUTED = "#7A7268";
const WHITE = "#FFFFFF";
const BORDER = "#E8E4DC";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, "<br />");
}

function formatMoney(n: number): string {
  return `₪${n.toFixed(2)}`;
}

const BAKERY_PHONE_1 = "053-763-6011";
const BAKERY_PHONE_2 = "050-858-8985";

/** Keeps phone numbers readable in RTL emails (Gmail Arabic/Hebrew). */
function ltrPhone(value: string, bold = false): string {
  const weight = bold ? "font-weight:600;" : "";
  const color = bold ? `color:${BROWN};` : "";
  const tag = bold ? "strong" : "span";
  return `<${tag} dir="ltr" style="unicode-bidi:isolate;display:inline-block;direction:ltr;${weight}${color}">${escapeHtml(value)}</${tag}>`;
}

function helpPhoneLine(helpBody: string, orWord: string): string {
  return `${escapeHtml(helpBody)} ${ltrPhone(BAKERY_PHONE_1, true)} ${escapeHtml(orWord)} ${ltrPhone(BAKERY_PHONE_2, true)}`;
}

function testModeBanner(note: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td style="padding:14px 18px;background:#FFFBF0;border:1px solid ${GOLD};border-radius:10px;">
      <p style="margin:0;font-size:13px;line-height:1.55;color:#6B5A1E;font-family:Arial,Helvetica,sans-serif;">
        <strong style="color:#5C4A12;">Test mode</strong> — ${escapeHtml(note.replace(/^\[Test mode\]\s*/i, ""))}
      </p>
    </td></tr>
  </table>`;
}

function emailHeader(subtitle?: string): string {
  const sub = subtitle ?? TAGLINE;
  return `<tr>
    <td style="padding:0;background:${GREEN};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:36px 32px 28px;text-align:center;background:linear-gradient(165deg,${GREEN} 0%,${GREEN_LIGHT} 55%,#1a3d2e 100%);">
            <!-- Monogram -->
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 16px;">
              <tr><td style="width:56px;height:56px;background:${GOLD};border-radius:50%;text-align:center;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:${GREEN};line-height:56px;">A</td></tr>
            </table>
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:${WHITE};letter-spacing:0.3px;line-height:1.25;">${BRAND}</p>
            <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${GOLD_LIGHT};letter-spacing:2px;text-transform:uppercase;">${sub}</p>
            <!-- Gold divider -->
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:20px auto 0;">
              <tr><td style="width:48px;height:3px;background:${GOLD};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function emailFooter(): string {
  return `<tr>
    <td style="padding:0;background:${CREAM_DARK};border-top:1px solid ${BORDER};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:28px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:bold;color:${GREEN};">${BRAND_SHORT}</p>
            <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};line-height:1.5;">${TAGLINE}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 14px;">
              <tr>
                <td dir="ltr" style="padding:0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BROWN};text-align:center;">
                  <a href="tel:0537636011" dir="ltr" style="unicode-bidi:isolate;color:${GREEN};text-decoration:none;font-weight:600;">${BAKERY_PHONE_1}</a>
                </td>
                <td style="color:${GOLD};font-size:10px;">●</td>
                <td dir="ltr" style="padding:0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BROWN};text-align:center;">
                  <a href="tel:0508588985" dir="ltr" style="unicode-bidi:isolate;color:${GREEN};text-decoration:none;font-weight:600;">${BAKERY_PHONE_2}</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};">Made with care in our dedicated gluten-free kitchen.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function emailShell(
  content: string,
  headerSubtitle?: string,
  preheader?: string,
  options?: { locale?: EmailLocale },
): string {
  const locale = options?.locale ?? "en";
  const lang = locale;
  const dir = locale === "en" ? "ltr" : "rtl";
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CREAM};">${escapeHtml(preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${BRAND}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${pre}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};min-width:100%;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${WHITE};border-radius:16px;overflow:hidden;border:1px solid ${BORDER};box-shadow:0 4px 24px rgba(27,67,50,0.08);">
        ${emailHeader(headerSubtitle)}
        <tr>
          <td style="padding:36px 32px 32px;font-family:Arial,Helvetica,sans-serif;color:${BROWN};">
            ${content}
          </td>
        </tr>
        ${emailFooter()}
      </table>
      <p style="margin:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};text-align:center;">© ${new Date().getFullYear()} ${BRAND_SHORT}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0;">
    <tr>
      <td style="border-radius:50px;background:linear-gradient(135deg,${GREEN} 0%,${GREEN_LIGHT} 100%);">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${WHITE};text-decoration:none;letter-spacing:0.3px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:13px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:${BROWN};text-align:right;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Stacked label/value rows — reliable in Gmail RTL (avoids collapsed columns). */
function detailRowHe(label: string, value: string, ltrValue = false): string {
  const valueHtml = ltrValue
    ? `<span dir="ltr" style="unicode-bidi:isolate;display:inline-block;direction:ltr;text-align:left;">${escapeHtml(value)}</span>`
    : escapeHtml(value);
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};">
      <p style="margin:0 0 4px;font-size:12px;color:${MUTED};font-family:Arial,Helvetica,sans-serif;text-align:right;line-height:1.4;">${escapeHtml(label)}</p>
      <p style="margin:0;font-size:14px;color:${BROWN};font-family:Arial,Helvetica,sans-serif;text-align:right;font-weight:600;line-height:1.5;word-break:break-word;">${valueHtml}</p>
    </td>
  </tr>`;
}

function totalRowHe(label: string, amount: number): string {
  return `<tr>
    <td style="padding:14px 0 0;border-top:2px solid ${GREEN};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold;color:${GREEN};text-align:right;padding-top:4px;">${escapeHtml(label)}</td>
          <td width="120" style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;color:${GREEN};text-align:left;padding-top:4px;white-space:nowrap;" dir="ltr">${formatMoney(amount)}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function summaryRowHe(label: string, amount: number, discount = false): string {
  const display = discount ? `−${formatMoney(Math.abs(amount))}` : formatMoney(amount);
  const color = discount ? GREEN : BROWN;
  return `<tr>
    <td style="padding:6px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};text-align:right;">${escapeHtml(label)}</td>
          <td width="100" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${color};text-align:left;white-space:nowrap;font-weight:${discount ? "600" : "normal"};" dir="ltr">${display}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function heDeliveryLabel(method: string): string {
  const k = method.toLowerCase();
  if (k === "pickup" || k === "איסוף") return "איסוף";
  if (k === "delivery" || k === "משלוח") return "משלוח";
  return method;
}

function hePaymentLabel(method: string): string {
  const k = method.toLowerCase().replace(/\s+/g, "_");
  if (k === "cash" || k === "מזומן") return "מזומן";
  if (k === "card" || k === "credit_card" || k === "creditcard") return "כרטיס אשראי";
  return method;
}

export type EmailLocale = "en" | "he" | "ar";

export function normalizeEmailLocale(raw?: string | null): EmailLocale {
  const k = raw?.trim().toLowerCase();
  if (k === "en" || k === "he" || k === "ar") return k;
  return "he";
}

function emailDeliveryLabel(locale: EmailLocale, method: string): string {
  const isDelivery = method.toLowerCase() === "delivery";
  if (locale === "he") return isDelivery ? "משלוח" : "איסוף";
  if (locale === "ar") return isDelivery ? "توصيل" : "استلام من المتجر";
  return isDelivery ? "Delivery" : "Pickup";
}

function emailPaymentLabel(locale: EmailLocale, method: string): string {
  const k = method.toLowerCase().replace(/\s+/g, "_");
  if (locale === "he") {
    if (k === "cash" || k === "מזומן") return "מזומן";
    if (k === "card" || k === "credit_card" || k === "creditcard") return "כרטיס אשראי";
    return method;
  }
  if (locale === "ar") {
    if (k === "cash" || k === "מזומן") return "نقدًا";
    if (k === "card" || k === "credit_card" || k === "creditcard") return "بطاقة ائتمان";
    return method;
  }
  if (k === "cash") return "Cash";
  if (k === "card" || k === "credit_card" || k === "creditcard") return "Card";
  return method;
}

type ConfirmationLabels = {
  subject: (shortId: string) => string;
  preheader: (shortId: string) => string;
  headerSubtitle: string;
  badge: string;
  thanks: (name: string) => string;
  intro: string;
  orderDetails: string;
  orderNum: string;
  email: string;
  phone: string;
  delivery: string;
  payment: string;
  yourOrder: string;
  item: string;
  qty: string;
  price: string;
  lineTotal: string;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  grandTotal: string;
  helpTitle: string;
  helpBody: string;
  or: string;
};

function confirmationEmailLabels(locale: EmailLocale): ConfirmationLabels {
  if (locale === "ar") {
    return {
      subject: (id) => `تأكيد الطلب #${id} — ${BRAND_SHORT}`,
      preheader: (id) => `تم تأكيد الطلب #${id} — ${BRAND_SHORT}`,
      headerSubtitle: "تأكيد الطلب",
      badge: "تم تأكيد الطلب",
      thanks: (name) => `شكرًا، ${name}!`,
      intro: "استلمنا طلبك وبدأ خبّازونا بالعمل عليه.\nمخبوزات خالية من الغلوتين — في طريقها إليك.",
      orderDetails: "تفاصيل الطلب",
      orderNum: "رقم الطلب",
      email: "البريد الإلكتروني",
      phone: "الهاتف",
      delivery: "التوصيل / الاستلام",
      payment: "الدفع",
      yourOrder: "طلبك",
      item: "المنتج",
      qty: "الكمية",
      price: "السعر",
      lineTotal: "المجموع",
      subtotal: "المجموع الفرعي",
      discount: "خصم",
      deliveryFee: "رسوم التوصيل",
      grandTotal: "الإجمالي للدفع",
      helpTitle: "هل تحتاج مساعدة مع طلبك؟",
      helpBody: "اتصل بنا:",
      or: "أو",
    };
  }
  if (locale === "en") {
    return {
      subject: (id) => `Order Confirmation #${id} — ${BRAND_SHORT}`,
      preheader: (id) => `Order #${id} confirmed — ${BRAND_SHORT}`,
      headerSubtitle: "Order Confirmation",
      badge: "Order Confirmed",
      thanks: (name) => `Thank you, ${name}!`,
      intro: "We've received your order and our bakers are already getting started.\nFresh gluten-free treats — on their way to you.",
      orderDetails: "Order Details",
      orderNum: "Order #",
      email: "Email",
      phone: "Phone",
      delivery: "Delivery / Pickup",
      payment: "Payment",
      yourOrder: "Your Order",
      item: "Item",
      qty: "Qty",
      price: "Price",
      lineTotal: "Total",
      subtotal: "Subtotal",
      discount: "Discount",
      deliveryFee: "Delivery fee",
      grandTotal: "Total due",
      helpTitle: "Need help with your order?",
      helpBody: "Call us:",
      or: "or",
    };
  }
  return {
    subject: (id) => `אישור הזמנה #${id} — ${BRAND_SHORT}`,
    preheader: (id) => `ההזמנה #${id} אושרה — ${BRAND_SHORT}`,
    headerSubtitle: "אישור הזמנה",
    badge: "ההזמנה אושרה",
    thanks: (name) => `תודה, ${name}!`,
    intro: "קיבלנו את ההזמנה שלך והאופים שלנו כבר מתחילים לעבוד.\nמעדנים ללא גלוטן טריים — בדרך אליך.",
    orderDetails: "פרטי הזמנה",
    orderNum: "מס׳ הזמנה",
    email: 'דוא"ל',
    phone: "טלפון",
    delivery: "משלוח / איסוף",
    payment: "תשלום",
    yourOrder: "ההזמנה שלך",
    item: "פריט",
    qty: "כמות",
    price: "מחיר",
    lineTotal: "סה״כ",
    subtotal: "סכום ביניים",
    discount: "הנחה",
    deliveryFee: "דמי משלוח",
    grandTotal: "סה״כ לתשלום",
    helpTitle: "צריכים עזרה עם ההזמנה?",
    helpBody: "התקשרו אלינו:",
    or: "או",
  };
}

function shopUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.VITE_SITE_URL?.trim() ||
    "http://localhost:8080"
  );
}

function adminPanelUrl(): string {
  return `${shopUrl()}/admin/orders`;
}

function statusBadge(text: string): string {
  return `<span style="display:inline-block;padding:6px 14px;background:#E8F5EE;color:${GREEN};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;border-radius:20px;">${escapeHtml(text)}</span>`;
}

// ─── Order Confirmation ───────────────────────────────────────────────────────

export type OrderItemLine = {
  product_name: string;
  quantity: number;
  product_price: number;
  total_price: number;
};

export type OrderConfirmationData = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItemLine[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryMethod: string;
  paymentMethod: string;
  couponCode?: string | null;
  locale?: EmailLocale | string | null;
  testModeNote?: string;
};

export function orderConfirmationTemplate(data: OrderConfirmationData): { subject: string; html: string } {
  const locale = normalizeEmailLocale(data.locale);
  const labels = confirmationEmailLabels(locale);
  const rtl = locale !== "en";
  const shortId = data.orderNumber || data.orderId.slice(0, 8).toUpperCase();
  const firstName = data.customerName.split(" ")[0] ?? data.customerName;
  const deliveryLabel = emailDeliveryLabel(locale, data.deliveryMethod);
  const paymentLabel = emailPaymentLabel(locale, data.paymentMethod);
  const subject = labels.subject(shortId);
  const introHtml = escapeHtml(labels.intro).replace(/\n/g, "<br/>");
  const textAlign = rtl ? "right" : "left";
  const priceAlign = rtl ? "left" : "right";

  const itemRows = data.items
    .map(
      (item, i) => `
    <tr style="background:${i % 2 === 0 ? WHITE : CREAM};">
      <td style="padding:14px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};border-bottom:1px solid ${BORDER};text-align:${textAlign};">${escapeHtml(item.product_name)}</td>
      <td style="padding:14px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};text-align:center;border-bottom:1px solid ${BORDER};">${item.quantity}</td>
      <td style="padding:14px 8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};text-align:${priceAlign};border-bottom:1px solid ${BORDER};" dir="ltr">${formatMoney(item.product_price)}</td>
      <td style="padding:14px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${GREEN};text-align:${priceAlign};border-bottom:1px solid ${BORDER};" dir="ltr">${formatMoney(item.total_price)}</td>
    </tr>`,
    )
    .join("");

  const testBanner = data.testModeNote ? testModeBanner(data.testModeNote) : "";

  const detailRows = rtl
    ? `${detailRowHe(labels.orderNum, shortId, true)}
       ${detailRowHe(labels.email, data.customerEmail, true)}
       ${detailRowHe(labels.phone, data.customerPhone, true)}
       ${detailRowHe(labels.delivery, deliveryLabel)}
       ${detailRowHe(labels.payment, paymentLabel)}`
    : `${detailRow(labels.orderNum, shortId)}
       ${detailRow(labels.email, data.customerEmail)}
       ${detailRow(labels.phone, data.customerPhone)}
       ${detailRow(labels.delivery, deliveryLabel)}
       ${detailRow(labels.payment, paymentLabel)}`;

  const summaryRows = rtl
    ? `${summaryRowHe(labels.subtotal, data.subtotal)}
       ${data.discountAmount > 0 ? summaryRowHe(`${labels.discount}${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ""}`, data.discountAmount, true) : ""}
       ${summaryRowHe(labels.deliveryFee, data.deliveryFee)}
       ${totalRowHe(labels.grandTotal, data.totalAmount)}`
    : `<tr><td style="padding:6px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
         <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};">${labels.subtotal}</td>
         <td width="100" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};text-align:right;white-space:nowrap;" dir="ltr">${formatMoney(data.subtotal)}</td>
       </tr></table></td></tr>
       ${data.discountAmount > 0 ? `<tr><td style="padding:6px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
         <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${GREEN};">${labels.discount}${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ""}</td>
         <td width="100" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${GREEN};text-align:right;font-weight:600;white-space:nowrap;" dir="ltr">−${formatMoney(data.discountAmount)}</td>
       </tr></table></td></tr>` : ""}
       <tr><td style="padding:6px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
         <td style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};">${labels.deliveryFee}</td>
         <td width="100" style="padding:4px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};text-align:right;white-space:nowrap;" dir="ltr">${formatMoney(data.deliveryFee)}</td>
       </tr></table></td></tr>
       <tr><td style="padding:14px 0 0;border-top:2px solid ${GREEN};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
         <td style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold;color:${GREEN};">${labels.grandTotal}</td>
         <td width="120" style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:bold;color:${GREEN};text-align:right;white-space:nowrap;" dir="ltr">${formatMoney(data.totalAmount)}</td>
       </tr></table></td></tr>`;

  const content = `
    ${testBanner}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="text-align:center;padding-bottom:8px;">${statusBadge(labels.badge)}</td></tr>
    </table>
    <h1 style="margin:12px 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:${GREEN};text-align:center;line-height:1.3;">${escapeHtml(labels.thanks(firstName))}</h1>
    <p style="margin:0 0 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${MUTED};text-align:center;line-height:1.7;">${introHtml}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;background:${CREAM};border-radius:12px;border:1px solid ${BORDER};overflow:hidden;">
      <tr><td style="padding:14px 20px;background:${GREEN};">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${GOLD_LIGHT};letter-spacing:1px;font-weight:bold;text-align:${textAlign};">${labels.orderDetails}</p>
      </td></tr>
      <tr><td style="padding:8px 20px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRows}
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold;color:${GREEN};text-align:${textAlign};">${labels.yourOrder}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:12px;overflow:hidden;margin-bottom:8px;">
      <tr style="background:${GREEN};">
        <th style="padding:12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:${textAlign};letter-spacing:0.5px;font-weight:bold;">${labels.item}</th>
        <th style="padding:12px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:center;letter-spacing:0.5px;font-weight:bold;">${labels.qty}</th>
        <th style="padding:12px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:${priceAlign};letter-spacing:0.5px;font-weight:bold;">${labels.price}</th>
        <th style="padding:12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:${priceAlign};letter-spacing:0.5px;font-weight:bold;">${labels.lineTotal}</th>
      </tr>
      ${itemRows}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${summaryRows}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:20px 22px;background:linear-gradient(135deg,${CREAM} 0%,${CREAM_DARK} 100%);border-radius:12px;border:1px solid ${BORDER};text-align:center;">
        <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;color:${GREEN};">${labels.helpTitle}</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};line-height:1.7;">${helpPhoneLine(labels.helpBody, labels.or)}</p>
      </td></tr>
    </table>`;

  return {
    subject,
    html: emailShell(content, labels.headerSubtitle, labels.preheader(shortId), { locale }),
  };
}

// ─── Marketing / Offer ────────────────────────────────────────────────────────

export type OfferEmailData = {
  subject: string;
  message: string;
  couponCode?: string | null;
  discountPercent?: number | null;
  testModeNote?: string;
};

function couponTicket(code: string | null | undefined, percent: number | null | undefined): string {
  if (!code && !percent) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0;">
    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;overflow:hidden;border:2px dashed ${GOLD};">
        <tr>
          <td style="padding:28px 24px;background:linear-gradient(145deg,#FFFBF5 0%,${CREAM} 50%,#FFF8E7 100%);text-align:center;">
            <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Special Offer</p>
            ${percent ? `<p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:42px;font-weight:bold;color:${GREEN};line-height:1;">${percent}<span style="font-size:22px;">%</span></p><p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};font-weight:600;">OFF your next order</p>` : ""}
            ${code ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td style="padding:12px 28px;background:${WHITE};border:2px solid ${GOLD};border-radius:8px;">
              <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${MUTED};letter-spacing:1.5px;text-transform:uppercase;">Your code</p>
              <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;color:${GREEN};letter-spacing:4px;">${escapeHtml(code)}</p>
            </td></tr></table>` : ""}
            <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};">Apply at checkout · Limited time</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>`;
}

export function offerEmailTemplate(data: OfferEmailData): { subject: string; html: string } {
  const testBanner = data.testModeNote ? testModeBanner(data.testModeNote) : "";

  const content = `
    ${testBanner}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="text-align:center;padding-bottom:4px;">${statusBadge("Exclusive Offer")}</td></tr>
    </table>
    <h1 style="margin:12px 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:${GREEN};text-align:center;line-height:1.3;">${escapeHtml(data.subject)}</h1>

    <!-- Message body -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr><td style="padding:24px 26px;background:${CREAM};border-radius:12px;border-left:4px solid ${GOLD};">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${BROWN};line-height:1.75;">${plainTextToHtml(data.message)}</div>
      </td></tr>
    </table>

    ${couponTicket(data.couponCode, data.discountPercent ?? null)}

    ${ctaButton("Shop Now →", shopUrl())}

    <p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};text-align:center;line-height:1.6;">Fresh gluten-free breads, pastries &amp; cakes — baked with love.</p>`;

  return {
    subject: data.subject,
    html: emailShell(content, "Special Offer", data.subject),
  };
}

// ─── Admin: New Order Notification ───────────────────────────────────────────

export type AdminOrderEmailData = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: OrderItemLine[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryMethod: string;
  deliveryAddress?: string | null;
  paymentMethod: string;
  notes?: string | null;
};

export function adminNewOrderTemplate(data: AdminOrderEmailData): { subject: string; html: string } {
  const shortId = data.orderNumber || data.orderId.slice(0, 8).toUpperCase();
  const subject = `הזמנה חדשה #${shortId} — ${BRAND_SHORT}`;

  const itemRows = data.items
    .map(
      (item, i) => `
    <tr style="background:${i % 2 === 0 ? WHITE : CREAM};">
      <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BROWN};border-bottom:1px solid ${BORDER};text-align:right;">${escapeHtml(item.product_name)}</td>
      <td style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};text-align:center;border-bottom:1px solid ${BORDER};">${item.quantity}</td>
      <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:${GREEN};text-align:left;border-bottom:1px solid ${BORDER};" dir="ltr">${formatMoney(item.total_price)}</td>
    </tr>`,
    )
    .join("");

  const discountRow =
    data.discountAmount > 0
      ? summaryRowHe("הנחה", data.discountAmount, true)
      : "";

  const deliveryRow =
    data.deliveryFee > 0
      ? summaryRowHe("דמי משלוח", data.deliveryFee)
      : "";

  const addressNote = data.deliveryMethod.toLowerCase() === "delivery" && data.deliveryAddress
    ? detailRowHe("כתובת", data.deliveryAddress)
    : "";

  const notesNote = data.notes
    ? detailRowHe("הערות", data.notes)
    : "";

  const deliveryHe = heDeliveryLabel(data.deliveryMethod);
  const paymentHe = hePaymentLabel(data.paymentMethod);

  const content = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="text-align:center;padding-bottom:8px;">${statusBadge("הזמנה חדשה")}</td></tr>
    </table>
    <h1 style="margin:12px 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:${GREEN};text-align:center;line-height:1.2;">הזמנה <span dir="ltr" style="unicode-bidi:isolate;">#${escapeHtml(shortId)}</span></h1>
    <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};text-align:center;">התקבלה הזמנה חדשה באתר ${BRAND_SHORT}.</p>

    <!-- Customer card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:${CREAM};border-radius:10px;border:1px solid ${BORDER};overflow:hidden;">
      <tr><td style="padding:10px 16px;background:${GREEN};">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};letter-spacing:1px;font-weight:bold;text-align:right;">לקוח</p>
      </td></tr>
      <tr><td style="padding:6px 16px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRowHe("שם", data.customerName)}
          ${detailRowHe("טלפון", data.customerPhone, true)}
          ${detailRowHe('דוא"ל', data.customerEmail, true)}
          ${detailRowHe("משלוח / איסוף", deliveryHe)}
          ${detailRowHe("תשלום", paymentHe)}
          ${addressNote}
          ${notesNote}
        </table>
      </td></tr>
    </table>

    <!-- Items -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:10px;overflow:hidden;margin-bottom:8px;">
      <tr style="background:${GREEN};">
        <th style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:right;letter-spacing:0.5px;font-weight:bold;">פריט</th>
        <th style="padding:10px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:center;letter-spacing:0.5px;font-weight:bold;">כמות</th>
        <th style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};text-align:left;letter-spacing:0.5px;font-weight:bold;">סה״כ</th>
      </tr>
      ${itemRows}
    </table>

    <!-- Totals -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${discountRow}
      ${deliveryRow}
      ${totalRowHe("סה״כ", data.totalAmount)}
    </table>

    ${ctaButton("צפייה בניהול הזמנות ←", adminPanelUrl())}`;

  return {
    subject,
    html: emailShell(content, "הזמנה חדשה", `הזמנה חדשה #${shortId} מ${data.customerName}`, { locale: "he" }),
  };
}

// ─── Customer: Order Status Update ───────────────────────────────────────────

export type OrderStatusEmailData = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  deliveryMethod: string;
  deliveryAddress?: string | null;
  status: string;
  locale?: EmailLocale | string | null;
  testModeNote?: string;
};

type StatusMeta = {
  badgeText: string;
  heading: string;
  body: string;
  headerSubtitle: string;
  preheader: string;
};

function statusMeta(
  status: string,
  firstName: string,
  deliveryMethod: string,
  locale: EmailLocale,
): StatusMeta {
  const f = escapeHtml(firstName);
  const isDelivery = deliveryMethod === "delivery";

  const copy: Record<EmailLocale, Record<string, StatusMeta>> = {
    he: {
      confirmed: {
        badgeText: "ההזמנה אושרה",
        heading: `ההזמנה שלך אושרה, ${f}!`,
        body: "אישרנו את ההזמנה והצוות שלנו יתחיל להכין אותה בקרוב. נעדכן אותך ככל שההזמנה תתקדם.",
        headerSubtitle: "ההזמנה אושרה",
        preheader: `ההזמנה שלך אושרה — ${BRAND_SHORT}`,
      },
      preparing: {
        badgeText: "בהכנה",
        heading: `אנחנו אופים בשבילך, ${f}!`,
        body: "האופים שלנו התחילו להכין את ההזמנה הטרייה שלך ללא גלוטן. נודיע לך כשהיא תהיה מוכנה.",
        headerSubtitle: "ההזמנה בהכנה",
        preheader: `ההזמנה שלך בהכנה — ${BRAND_SHORT}`,
      },
      ready: {
        badgeText: isDelivery ? "יצאה למשלוח" : "מוכנה לאיסוף",
        heading: isDelivery ? `ההזמנה בדרך אליך, ${f}!` : `ההזמנה מוכנה, ${f}!`,
        body: isDelivery
          ? "ההזמנה הועברה לצוות המשלוחים ובדרך אליך. תודה על הסבלנות!"
          : "ההזמנה שלך ארוזה וטרייה ומוכנה לאיסוף. נשמח לראות אותך!",
        headerSubtitle: isDelivery ? "בדרך אליך" : "מוכנה לאיסוף",
        preheader: isDelivery
          ? `ההזמנה בדרך אליך — ${BRAND_SHORT}`
          : `ההזמנה מוכנה לאיסוף — ${BRAND_SHORT}`,
      },
      out_for_delivery: {
        badgeText: "יצאה למשלוח",
        heading: `ההזמנה בדרך אליך, ${f}!`,
        body: "ההזמנה הועברה לצוות המשלוחים ובדרך אליך. תודה על הסבלנות!",
        headerSubtitle: "בדרך אליך",
        preheader: `ההזמנה בדרך אליך — ${BRAND_SHORT}`,
      },
      completed: {
        badgeText: "ההזמנה נמסרה",
        heading: `בתיאבון, ${f}!`,
        body: "ההזמנה נמסרה. מקווים שתיהנו מכל ביס! תודה שבחרתם במאפיית אל-נור ללא גלוטן.",
        headerSubtitle: "ההזמנה הושלמה",
        preheader: `ההזמנה נמסרה — ${BRAND_SHORT}`,
      },
      cancelled: {
        badgeText: "ההזמנה בוטלה",
        heading: `ההזמנה שלך בוטלה, ${f}`,
        body: "ההזמנה בוטלה. אם יש שאלות או שזה לא צפוי — אנחנו כאן לעזור.",
        headerSubtitle: "ההזמנה בוטלה",
        preheader: `ההזמנה בוטלה — ${BRAND_SHORT}`,
      },
      default: {
        badgeText: "עדכון הזמנה",
        heading: `עדכון לגבי ההזמנה, ${f}`,
        body: "יש עדכון חדש לגבי ההזמנה שלך. צרו קשר אם יש שאלות.",
        headerSubtitle: "עדכון הזמנה",
        preheader: `עדכון הזמנה — ${BRAND_SHORT}`,
      },
    },
    en: {
      confirmed: {
        badgeText: "Order Confirmed",
        heading: `Your order is confirmed, ${f}!`,
        body: "We've confirmed your order and our team will start preparing it soon. You'll hear from us again as it progresses.",
        headerSubtitle: "Order Confirmed",
        preheader: `Your order is confirmed — ${BRAND_SHORT}`,
      },
      preparing: {
        badgeText: "Preparing Your Order",
        heading: `We're baking for you, ${f}!`,
        body: "Our bakers have started preparing your fresh gluten-free order. We'll let you know when it's ready.",
        headerSubtitle: "Baking in Progress",
        preheader: `Your order is being prepared — ${BRAND_SHORT}`,
      },
      ready: {
        badgeText: isDelivery ? "Out for Delivery" : "Ready for Pickup",
        heading: isDelivery ? `Your order is on its way, ${f}!` : `Your order is ready, ${f}!`,
        body: isDelivery
          ? "Your order has been handed to our delivery team and is on its way to you. Thank you for your patience!"
          : "Your gluten-free order is freshly packed and ready for pickup. We look forward to seeing you!",
        headerSubtitle: isDelivery ? "On the Way" : "Ready for Pickup",
        preheader: isDelivery
          ? `Your order is on its way — ${BRAND_SHORT}`
          : `Your order is ready for pickup — ${BRAND_SHORT}`,
      },
      out_for_delivery: {
        badgeText: "Out for Delivery",
        heading: `Your order is on its way, ${f}!`,
        body: "Your order has been handed to our delivery team and is on its way to you. Thank you for your patience!",
        headerSubtitle: "On the Way",
        preheader: `Your order is on its way — ${BRAND_SHORT}`,
      },
      completed: {
        badgeText: "Order Delivered",
        heading: `Enjoy every bite, ${f}!`,
        body: "Your order has been delivered. We hope you love it! Thank you for choosing Al-Nour Gluten-Free Bakery.",
        headerSubtitle: "Order Complete",
        preheader: `Your order has been delivered — ${BRAND_SHORT}`,
      },
      cancelled: {
        badgeText: "Order Cancelled",
        heading: `Your order has been cancelled, ${f}`,
        body: "Your order has been cancelled. If you have any questions or this was unexpected, please don't hesitate to reach out to us.",
        headerSubtitle: "Order Cancelled",
        preheader: `Your order has been cancelled — ${BRAND_SHORT}`,
      },
      default: {
        badgeText: "Order Update",
        heading: `Order update for ${f}`,
        body: "There has been an update to your order. Please contact us if you have any questions.",
        headerSubtitle: "Order Update",
        preheader: `Order update — ${BRAND_SHORT}`,
      },
    },
    ar: {
      confirmed: {
        badgeText: "تم تأكيد الطلب",
        heading: `تم تأكيد طلبك، ${f}!`,
        body: "أكّدنا طلبك وسيبدأ فريقنا بتحضيره قريبًا. سنوافيك بتحديثات أثناء تقدّم الطلب.",
        headerSubtitle: "تم تأكيد الطلب",
        preheader: `تم تأكيد طلبك — ${BRAND_SHORT}`,
      },
      preparing: {
        badgeText: "قيد التحضير",
        heading: `نخبز من أجلك، ${f}!`,
        body: "بدأ خبّازونا بتحضير طلبك الطازج الخالي من الغلوتين. سنُعلمك عندما يصبح جاهزًا.",
        headerSubtitle: "الطلب قيد التحضير",
        preheader: `طلبك قيد التحضير — ${BRAND_SHORT}`,
      },
      ready: {
        badgeText: isDelivery ? "في الطريق للتوصيل" : "جاهز للاستلام",
        heading: isDelivery ? `طلبك في الطريق، ${f}!` : `طلبك جاهز، ${f}!`,
        body: isDelivery
          ? "تم تسليم طلبك لفريق التوصيل وهو في الطريق إليك. شكرًا على صبرك!"
          : "طلبك مغلّف طازجًا وجاهز للاستلام. نتطلّع لرؤيتك!",
        headerSubtitle: isDelivery ? "في الطريق" : "جاهز للاستلام",
        preheader: isDelivery
          ? `طلبك في الطريق — ${BRAND_SHORT}`
          : `طلبك جاهز للاستلام — ${BRAND_SHORT}`,
      },
      out_for_delivery: {
        badgeText: "في الطريق للتوصيل",
        heading: `طلبك في الطريق، ${f}!`,
        body: "تم تسليم طلبك لفريق التوصيل وهو في الطريق إليك. شكرًا على صبرك!",
        headerSubtitle: "في الطريق",
        preheader: `طلبك في الطريق — ${BRAND_SHORT}`,
      },
      completed: {
        badgeText: "تم التسليم",
        heading: `بالهناء والشّفاء، ${f}!`,
        body: "تم تسليم طلبك. نأمل أن يعجبك! شكرًا لاختيارك مخبز النور الخالي من الغلوتين.",
        headerSubtitle: "اكتمل الطلب",
        preheader: `تم تسليم طلبك — ${BRAND_SHORT}`,
      },
      cancelled: {
        badgeText: "تم الإلغاء",
        heading: `تم إلغاء طلبك، ${f}`,
        body: "تم إلغاء طلبك. إذا كان لديك أي أسئلة أو لم تكن تتوقع ذلك، تواصل معنا.",
        headerSubtitle: "تم الإلغاء",
        preheader: `تم إلغاء الطلب — ${BRAND_SHORT}`,
      },
      default: {
        badgeText: "تحديث الطلب",
        heading: `تحديث بخصوص طلبك، ${f}`,
        body: "هناك تحديث جديد بخصوص طلبك. تواصل معنا إذا كان لديك أي أسئلة.",
        headerSubtitle: "تحديث الطلب",
        preheader: `تحديث الطلب — ${BRAND_SHORT}`,
      },
    },
  };

  const bucket = copy[locale];
  if (status === "ready" || status === "out_for_delivery") {
    return bucket[status === "out_for_delivery" ? "out_for_delivery" : "ready"];
  }
  return bucket[status] ?? bucket.default;
}

function statusEmailLabels(locale: EmailLocale) {
  if (locale === "he") {
    return {
      orderRef: "פרטי הזמנה",
      orderNum: "מס׳ הזמנה",
      name: "שם",
      delivery: "משלוח / איסוף",
      pickupLocation: "מיקום איסוף",
      deliveryAddress: "כתובת למשלוח",
      helpTitle: "צריכים עזרה?",
      helpBody: "התקשרו אלינו:",
    };
  }
  if (locale === "ar") {
    return {
      orderRef: "تفاصيل الطلب",
      orderNum: "رقم الطلب",
      name: "الاسم",
      delivery: "التوصيل / الاستلام",
      pickupLocation: "موقع الاستلام",
      deliveryAddress: "عنوان التوصيل",
      helpTitle: "هل تحتاج مساعدة؟",
      helpBody: "اتصل بنا:",
    };
  }
  return {
    orderRef: "Order Reference",
    orderNum: "Order #",
    name: "Name",
    delivery: "Delivery / Pickup",
    pickupLocation: "Pickup location",
    deliveryAddress: "Delivery address",
    helpTitle: "Questions? We're here.",
    helpBody: "Call us at",
  };
}

export function orderStatusTemplate(data: OrderStatusEmailData): { subject: string; html: string } {
  const locale = normalizeEmailLocale(data.locale);
  const shortId = data.orderNumber || data.orderId.slice(0, 8).toUpperCase();
  const firstName = data.customerName.split(" ")[0] ?? data.customerName;
  const meta = statusMeta(data.status, firstName, data.deliveryMethod, locale);
  const labels = statusEmailLabels(locale);
  const deliveryLabel = emailDeliveryLabel(locale, data.deliveryMethod);
  const rtl = locale !== "en";
  const subject = `${meta.badgeText} #${shortId} — ${BRAND_SHORT}`;

  const testBanner = data.testModeNote ? testModeBanner(data.testModeNote) : "";

  const isCancelled = data.status === "cancelled";
  const badgeBg = isCancelled ? "#FEF2F2" : "#E8F5EE";
  const badgeColor = isCancelled ? "#991B1B" : GREEN;

  const borderAccent = rtl ? `border-right:4px solid ${GOLD};` : `border-left:4px solid ${GOLD};`;

  const locationBox =
    data.deliveryMethod !== "delivery" && data.status === "ready"
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
           <tr><td style="padding:16px 20px;background:${CREAM};border-radius:10px;${borderAccent}">
             <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};letter-spacing:1px;font-weight:bold;text-align:${rtl ? "right" : "left"};">${labels.pickupLocation}</p>
             <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};line-height:1.6;text-align:${rtl ? "right" : "left"};">${BRAND}</p>
           </td></tr>
         </table>`
      : data.deliveryMethod === "delivery" && data.deliveryAddress && (data.status === "ready" || data.status === "out_for_delivery")
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
           <tr><td style="padding:16px 20px;background:${CREAM};border-radius:10px;${borderAccent}">
             <p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};letter-spacing:1px;font-weight:bold;text-align:${rtl ? "right" : "left"};">${labels.deliveryAddress}</p>
             <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BROWN};line-height:1.6;text-align:${rtl ? "right" : "left"};">${escapeHtml(data.deliveryAddress)}</p>
           </td></tr>
         </table>`
      : "";

  const detailRows = rtl
    ? `${detailRowHe(labels.orderNum, shortId, true)}
       ${detailRowHe(labels.name, data.customerName)}
       ${detailRowHe(labels.delivery, deliveryLabel)}`
    : `${detailRow(labels.orderNum, shortId)}
       ${detailRow(labels.name, data.customerName)}
       ${detailRow(labels.delivery, deliveryLabel)}`;

  const orWord = locale === "he" ? "או" : locale === "ar" ? "أو" : "or";

  const content = `
    ${testBanner}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="text-align:center;padding-bottom:8px;">
        <span style="display:inline-block;padding:6px 14px;background:${badgeBg};color:${badgeColor};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;border-radius:20px;">${escapeHtml(meta.badgeText)}</span>
      </td></tr>
    </table>
    <h1 style="margin:12px 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:bold;color:${isCancelled ? "#991B1B" : GREEN};text-align:center;line-height:1.25;">${meta.heading}</h1>
    <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${MUTED};text-align:center;line-height:1.65;">${escapeHtml(meta.body)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:${CREAM};border-radius:10px;border:1px solid ${BORDER};overflow:hidden;">
      <tr><td style="padding:10px 16px;background:${GREEN};">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD_LIGHT};letter-spacing:1px;font-weight:bold;text-align:${rtl ? "right" : "left"};">${labels.orderRef}</p>
      </td></tr>
      <tr><td style="padding:6px 16px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${detailRows}
        </table>
      </td></tr>
    </table>

    ${locationBox}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr><td style="padding:16px 20px;background:${CREAM_DARK};border-radius:10px;text-align:center;">
        <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:bold;color:${GREEN};">${labels.helpTitle}</p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};line-height:1.6;">${helpPhoneLine(labels.helpBody, orWord)}</p>
      </td></tr>
    </table>`;

  return {
    subject,
    html: emailShell(content, meta.headerSubtitle, meta.preheader, { locale }),
  };
}
