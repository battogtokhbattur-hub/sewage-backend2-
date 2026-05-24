import { Resend } from "resend";

/* ══════════════════════════════════════════════════
   ⚠️ ЗАСВАР:
   Энэ файлд одоо SANDBOX PROXY логик нэмэгдсэн.

   Өмнөх алдаа: Resend testing mode дээр зөвхөн
   account-той холбоотой email рүү л явуулдаг.
   Status email-үүд шууд хэрэглэгчийн email рүү
   очиж байсан учир бүгд "validation_error" гэж
   унаж байсан.

   Одоо:
   - RESEND_SANDBOX=true (default) үед бүх email
     ADMIN_EMAIL руу proxy хийгдэнэ (унахгүй)
   - RESEND_SANDBOX=false + verified домэйнтэй үед
     жинхэнэ хэрэглэгчид рүү очно
══════════════════════════════════════════════════ */

/* ── Resend client (singleton, lazy) ── */
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  _resend = new Resend(key);
  return _resend;
}

const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Өргөжих Хаус <onboarding@resend.dev>";

/* ── SANDBOX PROXY ──
   Resend domain verify хийгээгүй үед — бүх email-ийг
   ADMIN_EMAIL руу шилжүүлнэ. Subject-ын эхэнд
   "[→ original@email]" гэсэн tag нэмнэ.
*/
function getRecipient(originalTo: string): {
  realTo:   string;
  isProxy:  boolean;
  original: string;
} {
  const adminEmail  = process.env.ADMIN_EMAIL;
  const sandboxMode = process.env.RESEND_SANDBOX !== "false";

  if (sandboxMode && adminEmail) {
    if (originalTo.toLowerCase() === adminEmail.toLowerCase()) {
      return { realTo: originalTo, isProxy: false, original: originalTo };
    }
    return { realTo: adminEmail, isProxy: true, original: originalTo };
  }

  return { realTo: originalTo, isProxy: false, original: originalTo };
}

/* ── Төвлөрсөн send helper (sandbox-аа дотроо хийнэ) ── */
async function resendSend(args: {
  to:      string;
  subject: string;
  html:    string;
  tag?:    string;
}) {
  const tag = args.tag ?? "status";
  const { realTo, isProxy, original } = getRecipient(args.to);

  const finalSubject = isProxy
    ? `[→ ${original}] ${args.subject}`
    : args.subject;

  try {
    const { data, error } = await getResend().emails.send({
      from:    FROM_ADDRESS,
      to:      realTo,
      subject: finalSubject,
      html:    args.html,
    });

    if (error) {
      console.error(`[${tag}] ❌ Resend API error:`, error);
      throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);
    }

    if (isProxy) {
      console.log(`[${tag}] ✅ [SANDBOX] ${original} → ${realTo} (id: ${data?.id})`);
    } else {
      console.log(`[${tag}] ✅ Sent → ${realTo} (id: ${data?.id})`);
    }
    return data;
  } catch (err) {
    console.error(`[${tag}] ❌ Send failed:`, err);
    throw err;
  }
}

function fmtMntStatus(n: number) {
  return (n ?? 0).toLocaleString("mn-MN") + "₮";
}

const STATUS_BANK_INFO = {
  company: process.env.BANK_COMPANY ?? "Өргөжих Хаус ХХК",
  bank:    process.env.BANK_NAME    ?? "Хаан банк",
  account: process.env.BANK_ACCOUNT ?? "5000010361",
  iban:    process.env.BANK_IBAN    ?? "MN570032005000010361",
};

/* ══════════════════════════════════════════════════
   HTML helpers
══════════════════════════════════════════════════ */
function statusEmailWrapper(opts: {
  bgGradient: string;
  badgeBg:    string;
  badgeColor: string;
  badgeText:  string;
  emoji:      string;
  title:      string;
  subtitle:   string;
  bodyHtml:   string;
  ctaText?:   string;
  ctaUrl?:    string;
  ctaColor?:  string;
}): string {
  const cta = opts.ctaText && opts.ctaUrl ? `
    <tr>
      <td style="padding:30px 28px 22px;text-align:center;">
        <a href="${opts.ctaUrl}"
          style="display:inline-block;background:${opts.ctaColor ?? "linear-gradient(135deg,#2563eb,#1d4ed8)"};
            color:#fff;text-decoration:none;font-size:14.5px;font-weight:700;
            padding:15px 40px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.15);">
          ${opts.ctaText}
        </a>
      </td>
    </tr>` : "";

  return `<!DOCTYPE html>
<html lang="mn"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#fff;border-radius:18px;overflow:hidden;
    box-shadow:0 8px 40px rgba(30,64,175,0.14);">
  <tr>
    <td style="background:${opts.bgGradient};padding:36px 28px 30px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="background:rgba(255,255,255,0.18);border-radius:12px;display:inline-block;padding:9px 15px;margin-bottom:14px;">
            <span style="font-size:22px;">${opts.emoji}</span>
          </div>
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;line-height:1.2;">${opts.title}</h1>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.78);">${opts.subtitle}</p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="background:${opts.badgeBg};border-radius:20px;padding:6px 14px;display:inline-block;">
            <span style="font-size:11.5px;font-weight:800;color:${opts.badgeColor};">${opts.badgeText}</span>
          </div>
        </td>
      </tr></table>
    </td>
  </tr>
  ${opts.bodyHtml}
  ${cta}
  <tr>
    <td style="padding:16px 28px 26px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        ${STATUS_BANK_INFO.company} • Бохир ус тээвэрлэлтийн систем
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">Энэ мэйл автоматаар илгээгдсэн.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;
}

function statusInfoBox(rows: { icon: string; label: string; value: string; color?: string }[]): string {
  return `
  <tr><td style="padding:0 22px;"><table width="100%" cellpadding="0" cellspacing="0">
    ${rows.map(r => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;width:46%;">
        <span style="font-size:13.5px;color:#64748b;">${r.icon}&nbsp;${r.label}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
        <span style="font-size:13.5px;color:${r.color ?? "#111827"};font-weight:600;">${r.value}</span>
      </td>
    </tr>`).join("")}
  </table></td></tr>`;
}

function statusInfoSection(title: string): string {
  return `
  <tr>
    <td style="padding:18px 22px 4px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <span style="font-size:10.5px;font-weight:800;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">
        ${title}
      </span>
    </td>
  </tr>`;
}

/* ══════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════ */
export interface StatusEmailPayload {
  to:           string;
  customerName: string;
  orderId:      number;
  serviceType:  string;
  district:     string;
  address:      string;
  date:         string;
  timeSlot:     string;
  totalPrice:   number;
  appUrl?:      string;
}

export interface AssignedEmailPayload extends StatusEmailPayload {
  driverName:  string;
  driverPhone: string;
  truckName?:  string;
  truckPlate?: string;
}

export interface InvoicePaymentPayload {
  to:            string;
  customerName:  string;
  orderId:       number;
  serviceType:   string;
  district:      string;
  address:       string;
  volume:        number;
  volumeUnit:    string;
  date:          string;
  timeSlot:      string;
  priceSubtotal: number;
  addOns:        { name: string; price: number }[];
  totalPrice:    number;
  appUrl?:       string;
}

export interface OrderCompletedPayload {
  to:           string;
  customerName: string;
  orderId:      number;
  serviceType:  string;
  totalPrice:   number;
  paidAt:       string;
  appUrl?:      string;
}

export interface AdminPaymentNoticePayload {
  adminEmail:    string;
  orderId:       number;
  customerName:  string;
  customerEmail: string;
  customerPhone: string;
  address:       string;
  serviceType:   string;
  priceTotal:    number;
  transactionRef?: string;
  userNote?:     string;
  dashboardUrl?: string;
}

/* ══════════════════════════════════════════════════
   1) CONFIRMED
══════════════════════════════════════════════════ */
export async function sendOrderConfirmedEmail(p: StatusEmailPayload): Promise<void> {
  if (!p.to) {
    console.warn(`[confirmed-${p.orderId}] ⚠️ Хэрэглэгчийн email байхгүй — алгаслаа`);
    return;
  }

  const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#2563eb 100%)",
    badgeBg:    "#dbeafe", badgeColor: "#1e40af", badgeText: "✅ Баталгаажсан",
    emoji: "📋", title: "Захиалга баталгаажлаа!",
    subtitle: `Захиалга #${p.orderId} • Бид удахгүй жолооч хувиарлах болно`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалгыг бид амжилттай хүлээн авч <strong>баталгаажуулсан</strong> байна.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
        { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
        { icon: "🗺️", label: "Дүүрэг",    value: p.district },
        { icon: "📍", label: "Хаяг",      value: p.address },
        { icon: "📅", label: "Огноо",     value: p.date },
        { icon: "🕐", label: "Цаг",       value: p.timeSlot, color: "#2563eb" },
        { icon: "💰", label: "Үнийн дүн", value: fmtMntStatus(p.totalPrice), color: "#059669" },
      ])}`,
    ctaText: "Захиалгаа харах →", ctaUrl: url,
  });

  await resendSend({
    to: p.to,
    subject: `✅ Захиалга #${p.orderId} баталгаажлаа`,
    html,
    tag: `confirmed-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   2) ASSIGNED
══════════════════════════════════════════════════ */
export async function sendOrderAssignedEmail(p: AssignedEmailPayload): Promise<void> {
  if (!p.to) {
    console.warn(`[assigned-${p.orderId}] ⚠️ Хэрэглэгчийн email байхгүй — алгаслаа`);
    return;
  }

  const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
  const driverInfoFields: any[] = [
    { icon: "🧑", label: "Жолоочийн нэр",  value: p.driverName,  color: "#7c3aed" },
    { icon: "📞", label: "Утасны дугаар", value: p.driverPhone, color: "#7c3aed" },
  ];
  if (p.truckName)  driverInfoFields.push({ icon: "🚚", label: "Машин",      value: p.truckName,  color: "#7c3aed" });
  if (p.truckPlate) driverInfoFields.push({ icon: "🔢", label: "Гос дугаар", value: p.truckPlate, color: "#7c3aed" });

  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#5b21b6 0%,#7c3aed 50%,#8b5cf6 100%)",
    badgeBg: "#ede9fe", badgeColor: "#5b21b6", badgeText: "🚛 Жолооч хувиарлагдсан",
    emoji: "🚛", title: "Жолооч таны захиалгыг хүлээн авлаа!",
    subtitle: `Захиалга #${p.orderId} • Заасан өдөр болон цагт ирнэ`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалгад жолооч хувиарлагдлаа.
        </p>
      </td></tr>
      ${statusInfoSection("👤 ХУВИАРЛАГДСАН ЖОЛООЧ")}
      ${statusInfoBox(driverInfoFields)}
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
        { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
        { icon: "📍", label: "Хаяг",      value: p.address },
        { icon: "📅", label: "Огноо",     value: p.date },
        { icon: "🕐", label: "Цаг",       value: p.timeSlot, color: "#2563eb" },
      ])}`,
    ctaText: "Захиалгаа харах →", ctaUrl: url,
    ctaColor: "linear-gradient(135deg,#7c3aed,#5b21b6)",
  });

  await resendSend({
    to: p.to,
    subject: `🚛 Захиалга #${p.orderId} — Жолооч хувиарлагдлаа`,
    html,
    tag: `assigned-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   3) IN_PROGRESS
══════════════════════════════════════════════════ */
export async function sendOrderInProgressEmail(p: StatusEmailPayload): Promise<void> {
  if (!p.to) {
    console.warn(`[in-progress-${p.orderId}] ⚠️ Хэрэглэгчийн email байхгүй — алгаслаа`);
    return;
  }

  const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#92400e 0%,#d97706 50%,#f59e0b 100%)",
    badgeBg: "#fef3c7", badgeColor: "#92400e", badgeText: "🔄 Явагдаж байна",
    emoji: "🔄", title: "Үйлчилгээ эхэллээ!",
    subtitle: `Захиалга #${p.orderId} • Жолооч таны хаяг дээр ажилаж эхэллээ`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Жолооч таны хаяг дээр очиж <strong>үйлчилгээг эхлүүллээ</strong>.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
        { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
        { icon: "📍", label: "Хаяг",      value: p.address },
        { icon: "🕐", label: "Цаг",       value: p.timeSlot },
      ])}`,
    ctaText: "Захиалгаа харах →", ctaUrl: url,
    ctaColor: "linear-gradient(135deg,#d97706,#92400e)",
  });

  await resendSend({
    to: p.to,
    subject: `🔄 Захиалга #${p.orderId} — Үйлчилгээ эхэллээ`,
    html,
    tag: `in-progress-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   4) AWAITING_PAYMENT
══════════════════════════════════════════════════ */
export async function sendInvoicePaymentEmail(p: InvoicePaymentPayload): Promise<void> {
  if (!p.to) {
    console.warn(`[invoice-payment-${p.orderId}] ⚠️ Хэрэглэгчийн email байхгүй — алгаслаа`);
    return;
  }

  const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
  const ref = `URGUJIKH-${String(p.orderId).padStart(6, "0")}`;
  const addOnSum = (p.addOns ?? []).reduce((s, a) => s + a.price, 0);
  const hasAddOn = (p.addOns ?? []).length > 0 && addOnSum > 0;

  const addOnRows = (p.addOns ?? []).map(a => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:13px;color:#64748b;">✨ ${a.name}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
        <span style="font-size:13px;color:#f59e0b;font-weight:600;">+${fmtMntStatus(a.price)}</span>
      </td>
    </tr>`).join("");

  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#7c2d12 0%,#c2410c 50%,#ea580c 100%)",
    badgeBg: "#fed7aa", badgeColor: "#9a3412", badgeText: "💳 Төлбөр хүлээгдэж буй",
    emoji: "🧾", title: "Үйлчилгээ дууслаа — Төлбөрийн нэхэмжлэл",
    subtitle: `Захиалга #${p.orderId} • Гүйлгээний утга: ${ref}`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалгын <strong>үйлчилгээ амжилттай гүйцэтгэгдэж дууссан</strong> байна.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
        { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
        { icon: "🗺️", label: "Дүүрэг",    value: p.district },
        { icon: "📍", label: "Хаяг",      value: p.address },
        { icon: "⚖️", label: "Хэмжээ",   value: `${p.volume} ${p.volumeUnit === "M3" ? "м³" : "тонн"}` },
        { icon: "🕐", label: "Цаг",       value: p.timeSlot },
      ])}
      ${statusInfoSection("🧾 НЭХЭМЖЛЭЛ")}
      <tr><td style="padding:0 22px;"><table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:13px;color:#64748b;">📦 Үндсэн үйлчилгээ</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
            <span style="font-size:13px;">${fmtMntStatus(p.priceSubtotal)}</span>
          </td>
        </tr>
        ${addOnRows}
        ${hasAddOn ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:13px;color:#64748b;font-weight:600;">➕ Нэмэлтүүдийн нийлбэр</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
            <span style="font-size:13px;color:#f59e0b;font-weight:700;">${fmtMntStatus(addOnSum)}</span>
          </td>
        </tr>` : ""}
      </table></td></tr>
      <tr><td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:linear-gradient(135deg,#7c2d12,#ea580c);padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td><span style="font-size:14px;font-weight:700;color:#fff;">💳 Төлөх дүн</span></td>
              <td style="text-align:right;"><span style="font-size:28px;font-weight:800;color:#fbbf24;">${fmtMntStatus(p.totalPrice)}</span></td>
            </tr></table>
          </td>
        </tr></table>
      </td></tr>
      ${statusInfoSection("🏦 БАНКНЫ МЭДЭЭЛЭЛ")}
      <tr><td style="padding:14px 22px 0;">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:12.5px;color:#9a3412;font-weight:700;">
            ⚠️ ВАЖНО: Гүйлгээний утган дотор заавал доорх кодыг бичнэ үү
          </p>
          <p style="margin:0;font-size:14px;color:#7c2d12;font-weight:800;letter-spacing:0.04em;">${ref}</p>
        </div>
      </td></tr>
      ${statusInfoBox([
        { icon: "🏦", label: "Банк",          value: STATUS_BANK_INFO.bank },
        { icon: "🏢", label: "Компанийн нэр", value: STATUS_BANK_INFO.company },
        { icon: "💳", label: "Дансны дугаар", value: STATUS_BANK_INFO.account, color: "#1e40af" },
        { icon: "🔢", label: "IBAN",          value: STATUS_BANK_INFO.iban },
        { icon: "📝", label: "Гүйлгээний утга", value: ref, color: "#dc2626" },
      ])}`,
    ctaText: "Захиалгаа харах & Төлсөн гэж тэмдэглэх", ctaUrl: url,
    ctaColor: "linear-gradient(135deg,#ea580c,#7c2d12)",
  });

  await resendSend({
    to: p.to,
    subject: `🧾 Захиалга #${p.orderId} — Төлбөрийн нэхэмжлэл (${fmtMntStatus(p.totalPrice)})`,
    html,
    tag: `invoice-payment-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   5) DONE
══════════════════════════════════════════════════ */
export async function sendOrderCompletedEmail(p: OrderCompletedPayload): Promise<void> {
  if (!p.to) {
    console.warn(`[completed-${p.orderId}] ⚠️ Хэрэглэгчийн email байхгүй — алгаслаа`);
    return;
  }

  const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#064e3b 0%,#065f46 50%,#059669 100%)",
    badgeBg: "#d1fae5", badgeColor: "#065f46", badgeText: "🎉 Бүрэн дууссан",
    emoji: "🎉", title: "Захиалга амжилттай дууслаа!",
    subtitle: `Захиалга #${p.orderId} • Төлбөр баталгаажсан: ${p.paidAt}`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны төлбөрийг хүлээн авч баталгаажууллаа. 🎉
        </p>
      </td></tr>
      <tr><td style="padding:18px 22px;">
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:18px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:#065f46;font-weight:600;">✅ Төлсөн дүн</p>
          <p style="margin:0;font-size:30px;font-weight:800;color:#059669;">${fmtMntStatus(p.totalPrice)}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#065f46;">${p.serviceType}</p>
        </div>
      </td></tr>`,
    ctaText: "Захиалгын дэлгэрэнгүй →", ctaUrl: url,
    ctaColor: "linear-gradient(135deg,#059669,#065f46)",
  });

  await resendSend({
    to: p.to,
    subject: `🎉 Захиалга #${p.orderId} амжилттай дууслаа — Баярлалаа!`,
    html,
    tag: `completed-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   6) CANCELED
══════════════════════════════════════════════════ */
export async function sendOrderCanceledEmail(p: StatusEmailPayload & { reason?: string }): Promise<void> {
  if (!p.to) {
    console.warn(`[canceled-${p.orderId}] ⚠️ Хэрэглэгчийн email байхгүй — алгаслаа`);
    return;
  }

  const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 50%,#dc2626 100%)",
    badgeBg: "#fee2e2", badgeColor: "#991b1b", badgeText: "❌ Цуцлагдсан",
    emoji: "❌", title: "Захиалга цуцлагдлаа",
    subtitle: `Захиалга #${p.orderId} • Цуцлагдсан огноо: ${new Date().toLocaleDateString("mn-MN")}`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалга <strong>цуцлагдсан</strong> байна.
          ${p.reason ? `<br/><br/><strong>Шалтгаан:</strong> ${p.reason}` : ""}
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЦУЦЛАГДСАН ЗАХИАЛГА")}
      ${statusInfoBox([
        { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
        { icon: "📍", label: "Хаяг",      value: p.address },
        { icon: "📅", label: "Огноо",     value: p.date },
        { icon: "🕐", label: "Цаг",       value: p.timeSlot },
      ])}`,
    ctaText: "Шинэ захиалга өгөх",
    ctaUrl: `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/order/create`,
    ctaColor: "linear-gradient(135deg,#dc2626,#7f1d1d)",
  });

  await resendSend({
    to: p.to,
    subject: `❌ Захиалга #${p.orderId} цуцлагдлаа`,
    html,
    tag: `canceled-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   7) ADMIN PAYMENT NOTICE
══════════════════════════════════════════════════ */
export async function sendAdminPaymentNotice(p: AdminPaymentNoticePayload): Promise<void> {
  if (!p.adminEmail) {
    console.warn(`[payment-notice-${p.orderId}] ⚠️ Админ email байхгүй — алгаслаа`);
    return;
  }

  const url = p.dashboardUrl ?? `${process.env.ADMIN_DASHBOARD_URL ?? "http://localhost:3000"}/admin`;
  const html = statusEmailWrapper({
    bgGradient: "linear-gradient(135deg,#065f46 0%,#10b981 50%,#34d399 100%)",
    badgeBg: "#d1fae5", badgeColor: "#065f46", badgeText: "💰 Төлбөр шилжүүлсэн",
    emoji: "💰", title: "Хэрэглэгч төлбөрөө шилжүүлсэн",
    subtitle: `Захиалга #${p.orderId} • ${new Date().toLocaleString("mn-MN")}`,
    bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">Сайн байна уу, <strong>Админ</strong>!</p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Хэрэглэгч <strong>${p.customerName}</strong> өөрийн захиалгын төлбөрийг
          <strong>${fmtMntStatus(p.priceTotal)}</strong> шилжүүлсэн гэж тэмдэглэлээ.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
        { icon: "👤", label: "Хэрэглэгч",  value: `${p.customerName} (${p.customerEmail})` },
        { icon: "📞", label: "Утас",       value: p.customerPhone || "—" },
        { icon: "🚛", label: "Үйлчилгээ",  value: p.serviceType },
        { icon: "📍", label: "Хаяг",       value: p.address },
        { icon: "💵", label: "Дүн",        value: fmtMntStatus(p.priceTotal) },
        ...(p.transactionRef ? [{ icon: "🔢", label: "Гүйлгээний №", value: p.transactionRef }] : []),
        ...(p.userNote       ? [{ icon: "📝", label: "Тэмдэглэл",    value: p.userNote }] : []),
      ])}`,
    ctaText: "Захиалгыг харах", ctaUrl: url,
    ctaColor: "linear-gradient(135deg,#10b981,#065f46)",
  });

  await resendSend({
    to: p.adminEmail,
    subject: `💰 [Төлбөр] Захиалга #${p.orderId} — Хэрэглэгч төлсөн`,
    html,
    tag: `payment-notice-${p.orderId}`,
  });
}