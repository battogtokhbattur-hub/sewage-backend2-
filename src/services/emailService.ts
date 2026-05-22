import { Resend } from "resend";

/* ══════════════════════════════════════════════════
   RESEND CLIENT (singleton, lazy)
══════════════════════════════════════════════════ */
let _resend: Resend | null = null;
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY is not set in environment variables");
  }
  _resend = new Resend(key);
  return _resend;
}

/* ── FROM хаяг ──
   Эхэндээ: "Өргөжих Хаус <onboarding@resend.dev>"  (өөрийн домэйнгүй ажиллана)
   Дараа нь өөрийн домэйнгээ verify хийсний дараа: noreply@yourdomain.mn
*/
const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Өргөжих Хаус <onboarding@resend.dev>";

/* ══════════════════════════════════════════════════
   SANDBOX MODE
   Resend домэйн verify хийгээгүй үед бүх email-ийг
   admin рүү дамжуулна. Тэгэхгүй бол хэрэглэгчийн email
   рүү шууд явахыг оролдоод алдаа гарна.
══════════════════════════════════════════════════ */
function getRecipient(originalTo: string): {
  realTo:   string;
  isProxy:  boolean;
  original: string;
} {
  const adminEmail   = process.env.ADMIN_EMAIL;
  const sandboxMode  = process.env.RESEND_SANDBOX !== "false"; // default ON

  // Хэрэв sandbox идэвхтэй ба admin email тохируулсан бол
  // бүх email админ руу явна (subject дотор жинхэнэ хаягийг харуулна)
  if (sandboxMode && adminEmail) {
    if (originalTo.toLowerCase() === adminEmail.toLowerCase()) {
      return { realTo: originalTo, isProxy: false, original: originalTo };
    }
    return { realTo: adminEmail, isProxy: true, original: originalTo };
  }

  return { realTo: originalTo, isProxy: false, original: originalTo };
}

/* ══════════════════════════════════════════════════
   FORMATTERS
══════════════════════════════════════════════════ */
function fmtMnt(n: number) {
  return (n ?? 0).toLocaleString("mn-MN") + "₮";
}

const UNIT_LABEL: Record<string, string> = {
  TON:   "тонн",
  M3:    "м³",
  LITER: "литр",
};
function fmtUnit(unit: string) {
  return UNIT_LABEL[unit] ?? unit ?? "тонн";
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("mn-MN", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });
  } catch {
    return d;
  }
}

/* ══════════════════════════════════════════════════
   BANK INFO
══════════════════════════════════════════════════ */
const BANK_INFO = {
  company: process.env.BANK_COMPANY ?? "Өргөжих Хаус ХХК",
  bank:    process.env.BANK_NAME    ?? "Хаан банк",
  account: process.env.BANK_ACCOUNT ?? "5000010361",
  iban:    process.env.BANK_IBAN    ?? "MN570032005000010361",
};

/* ══════════════════════════════════════════════════
   TRANSACTION REFERENCE
══════════════════════════════════════════════════ */
function txRef(orderId: number) {
  return `URGUJIKH-${String(orderId).padStart(6, "0")}`;
}

/* ══════════════════════════════════════════════════
   PIT STATUS  NORMALIZE
══════════════════════════════════════════════════ */
type PitKey = "yes" | "no" | "unsure";

function normalizePitStatus(raw?: string): {
  key: PitKey | null; label: string; desc: string; color: string;
} {
  const LABELS: Record<PitKey, string> = {
    yes:    "✅ Тийм, байна",
    no:     "❌ Үгүй / стандартын бус",
    unsure: "❓ Мэдэхгүй",
  };
  const DESCS: Record<PitKey, string> = {
    yes:    "Зориулалтын нүх байна — Бохир ус сорох боломжтой",
    no:     "Зориулалтын нүх байхгүй — Бохир ид сорхалх боломж байхгүй байж болно",
    unsure: "Тодорхойгүй — Жолооч газарт очоод шалгана",
  };
  const COLORS: Record<PitKey, string> = {
    yes:    "#059669",
    no:     "#dc2626",
    unsure: "#d97706",
  };

  const key = raw as PitKey;
  if (key && LABELS[key]) {
    return { key, label: LABELS[key], desc: DESCS[key], color: COLORS[key] };
  }
  return { key: null, label: "—", desc: "Мэдээлэл байхгүй", color: "#6b7280" };
}

function normalizePitType(raw?: string): string {
  if (raw === "septic")     return "🏗️ Септик систем";
  if (raw === "pitToilet")  return "🚽 Нүхэн жорлон";
  if (raw === "tank")       return "🛢️ Хуримтлагч танк";
  return raw ?? "—";
}

/* ══════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════ */
export interface OrderEmailPayload {
  id:             number;
  serviceType:    string;
  district:       string;
  address:        string;
  pitStatus?:     string;
  pitType?:       string;
  volume:         number;
  volumeUnit?:    string;
  date:           string;
  timeSlot:       string;
  basePrice:      number;
  addOns?:        { label: string; price: number }[];
  totalPrice:     number;
  customerName?:  string;
  customerEmail?: string;
  customerPhone?: string;
}

/* ══════════════════════════════════════════════════
   HTML BUILDER
══════════════════════════════════════════════════ */
function buildOrderEmail(p: OrderEmailPayload, sentAt: string): string {
  const pit      = normalizePitStatus(p.pitStatus);
  const pitType  = normalizePitType(p.pitType);
  const ref      = txRef(p.id);
  const addOns   = p.addOns ?? [];
  const addOnSum = addOns.reduce((s, a) => s + a.price, 0);
  const hasAddOn = addOns.length > 0 && addOnSum > 0;
  const dashboardUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.id}`;

  const row = (
    icon: string,
    label: string,
    value: string,
    opts: { color?: string; bold?: boolean; small?: boolean } = {}
  ) => `
  <tr>
    <td style="padding:10px 22px;border-bottom:1px solid #f1f5f9;width:46%;vertical-align:top;">
      <span style="font-size:${opts.small ? "12" : "13.5"}px;color:#64748b;">${icon}&nbsp;${label}</span>
    </td>
    <td style="padding:10px 22px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;">
      <span style="font-size:${opts.small ? "12" : "13.5"}px;color:${opts.color ?? "#111827"};font-weight:${opts.bold ? "700" : "500"};">
        ${value}
      </span>
    </td>
  </tr>`;

  const section = (title: string) => `
  <tr>
    <td colspan="2" style="padding:14px 22px 4px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <span style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">
        ${title}
      </span>
    </td>
  </tr>`;

  const addOnRows = addOns.map(a =>
    row("✨", a.label, `+${fmtMnt(a.price)}`, { color: "#f59e0b" })
  ).join("");

  return `<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Шинэ захиалга #${p.id}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;
    overflow:hidden;box-shadow:0 8px 40px rgba(30,64,175,0.14);">
  <tr>
    <td colspan="2" style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#2563eb 100%);padding:36px 28px 30px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="background:rgba(255,255,255,0.16);border-radius:12px;display:inline-block;padding:9px 15px;margin-bottom:14px;">
            <span style="font-size:22px;">🚛</span>
          </div>
          <h1 style="margin:0 0 8px;font-size:25px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.01em;">
            Шинэ захиалга ирлээ!
          </h1>
          <p style="margin:0;font-size:12.5px;color:rgba(255,255,255,0.68);">
            Захиалга&nbsp;<strong style="color:#fff;">#${p.id}</strong>&nbsp;•&nbsp;${sentAt}
          </p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="background:#fef3c7;border-radius:20px;padding:6px 14px;display:inline-block;margin-bottom:8px;">
            <span style="font-size:11.5px;font-weight:800;color:#92400e;">⏳ Хүлээгдэж буй</span>
          </div>
          <br/>
          <span style="font-size:11px;color:rgba(255,255,255,0.55);">Лавлах: ${BANK_INFO.company}</span>
        </td>
      </tr></table>
    </td>
  </tr>
  ${section("👤 Хэрэглэгчийн мэдээлэл")}
  ${row("🧑", "Нэр",   p.customerName  ?? "—")}
  ${row("✉️", "Имэйл", p.customerEmail ?? "—", { color: "#2563eb" })}
  ${row("📞", "Утас",  p.customerPhone ?? "—")}
  ${section("📋 Захиалгын дэлгэрэнгүй")}
  ${row("🚛", "Үйлчилгээ", p.serviceType, { bold: true })}
  ${row("🗺️", "Дүүрэг", p.district)}
  ${row("📍", "Хаяг", p.address)}
  <tr>
    <td style="padding:10px 22px;border-bottom:1px solid #f1f5f9;vertical-align:top;">
      <span style="font-size:13.5px;color:#64748b;">🕳️&nbsp;Зориулалтын нүх</span>
    </td>
    <td style="padding:10px 22px;border-bottom:1px solid #f1f5f9;text-align:right;vertical-align:top;">
      <span style="font-size:13.5px;color:${pit.color};font-weight:600;">${pit.label}</span>
      <br/>
      <span style="font-size:11px;color:#94a3b8;">${pit.desc}</span>
    </td>
  </tr>
  ${row("🚽", "Нүхний төрөл", pitType)}
  ${row("⚖️", "Хэмжээ", `${p.volume} ${fmtUnit(p.volumeUnit ?? "TON")}`)}
  ${row("📅", "Огноо", fmtDate(p.date))}
  ${row("🕐", "Цаг", p.timeSlot, { color: "#2563eb", bold: true })}
  ${section("💰 Үнийн тооцоолол")}
  ${row("📦", "Үндсэн үйлчилгээний үнэ", fmtMnt(p.basePrice))}
  ${addOnRows}
  ${hasAddOn ? row("➕", "Нэмэлт үйлчилгээний нийлбэр", fmtMnt(addOnSum), { color: "#f59e0b", bold: true }) : ""}
  <tr>
    <td colspan="2" style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <span style="font-size:14px;font-weight:700;color:#fff;">💰 Нийт төлбөр</span>
              ${hasAddOn ? `<br/><span style="font-size:11px;color:rgba(255,255,255,0.58);">
                Үндсэн ${fmtMnt(p.basePrice)} + нэмэлт ${fmtMnt(addOnSum)}
              </span>` : ""}
            </td>
            <td style="text-align:right;">
              <span style="font-size:26px;font-weight:800;color:#fbbf24;">${fmtMnt(p.totalPrice)}</span>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr>
  ${section("🏦 Банкны шилжүүлгийн мэдээлэл")}
  ${row("🏦", "Банк",          BANK_INFO.bank,    { small: true })}
  ${row("🏢", "Компанийн нэр", BANK_INFO.company, { small: true })}
  ${row("💳", "Дансны дугаар", BANK_INFO.account, { small: true, bold: true })}
  ${row("🔢", "IBAN",          BANK_INFO.iban,    { small: true })}
  ${row("📝", "Гүйлгээний утга", ref,             { small: true, bold: true, color: "#2563eb" })}
  <tr>
    <td colspan="2" style="padding:32px 28px 24px;text-align:center;">
      <a href="${dashboardUrl}"
        style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;
          padding:15px 40px;border-radius:12px;letter-spacing:0.02em;
          box-shadow:0 4px 16px rgba(37,99,235,0.35);">
        Admin Dashboard-д харах &rarr;
      </a>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:16px 28px 28px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        ${BANK_INFO.company}&nbsp;•&nbsp;Бохир ус тээвэрлэлтийн систем
      </p>
      <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">
        Энэ мэйл автоматаар илгээгдсэн. Хариу илгээх шаардлагагүй.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ══════════════════════════════════════════════════
   ТӨВЛӨРСӨН SEND HELPER
   Бүх send функц энэ дотроос Resend дуудна.
══════════════════════════════════════════════════ */
export async function resendSend(args: {
  to:      string;
  subject: string;
  html:    string;
  tag?:    string;
}) {
  const tag = args.tag ?? "email";
  const { realTo, isProxy, original } = getRecipient(args.to);

  // Sandbox proxy үед subject-д жинхэнэ recipient-ыг харуулна
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

/* ══════════════════════════════════════════════════
   PASSWORD RESET EMAIL
══════════════════════════════════════════════════ */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="mn">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 16px;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0"
  style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;
    overflow:hidden;box-shadow:0 8px 40px rgba(30,64,175,0.14);">
  <tr>
    <td style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:32px 28px;">
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;">🔐 Нууц үг сэргээх</h1>
      <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">${BANK_INFO.company}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px 28px;">
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        Та нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх товчийг дарж нууц үгээ шинэчилнэ үү.
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#6b7280;">
        Холбоос <strong>1 цагийн</strong> дотор хүчинтэй.
      </p>
      <div style="text-align:center;">
        <a href="${resetUrl}"
          style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);
            color:#fff;text-decoration:none;font-size:15px;font-weight:700;
            padding:14px 36px;border-radius:10px;letter-spacing:0.02em;">
          Нууц үг сэргээх →
        </a>
      </div>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        Хэрвээ та энэ хүсэлт илгээгээгүй бол энэ мэйлийг үл тоомсорлоно уу.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  await resendSend({
    to,
    subject: "🔐 Нууц үг сэргээх холбоос",
    html,
    tag: "password-reset",
  });
}

/* ══════════════════════════════════════════════════
   sendOrderNotification  (legacy)
══════════════════════════════════════════════════ */
export async function sendOrderNotification(
  payload: OrderEmailPayload
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[email] ADMIN_EMAIL тохируулаагүй — мэйл явуулахгүй");
    return;
  }

  const sentAt = new Date().toLocaleDateString("mn-MN", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const html    = buildOrderEmail(payload, sentAt);
  const subject =
    `🚛 Захиалга #${payload.id} — ${payload.serviceType} · ${payload.district} · ${fmtMnt(payload.totalPrice)}`;

  await resendSend({ to: adminEmail, subject, html, tag: `order-${payload.id}` });
}

/* ══════════════════════════════════════════════════
   ADMIN / INVOICE PAYLOAD TYPES
══════════════════════════════════════════════════ */
export interface AdminOrderPayload {
  adminEmail:    string;
  orderId:       number;
  customerEmail: string;
  customerName:  string;
  customerPhone: string;
  address:       string;
  serviceType:   string;
  zone:          string;
  volume:        number;
  volumeUnit:    string;
  date:          string;
  slot:          string;
  notes?:        string;
  pitStatus?:    string;
  pitType?:      string;
  addOns:        { name: string; price: number }[];
  priceSubtotal: number;
  priceTotal:    number;
  createdAt:     string;
  dashboardUrl:  string;
}

export interface InvoicePayload {
  orderId:       number;
  customerEmail: string;
  address:       string;
  serviceType:   string;
  zone:          string;
  volume:        number;
  volumeUnit:    string;
  slot:          string;
  priceSubtotal: number;
  addOns:        { name: string; price: number }[];
  priceTotal:    number;
  createdAt:     string;
  completedAt:   string;
}

/* ══════════════════════════════════════════════════
   ШИНЭ: Customer-ийн анх захиалга өгсний баталгаа email
══════════════════════════════════════════════════ */
export interface CustomerOrderReceivedPayload {
  customerEmail: string;
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
  priceTotal:    number;
}

export async function sendCustomerOrderReceived(p: CustomerOrderReceivedPayload): Promise<void> {
  const payload: OrderEmailPayload = {
    id:            p.orderId,
    serviceType:   p.serviceType,
    district:      p.district,
    address:       p.address,
    volume:        p.volume,
    volumeUnit:    p.volumeUnit,
    date:          p.date,
    timeSlot:      p.timeSlot,
    basePrice:     p.priceSubtotal,
    addOns:        (p.addOns ?? []).map(a => ({ label: a.name, price: a.price })),
    totalPrice:    p.priceTotal,
    customerName:  p.customerName,
    customerEmail: p.customerEmail,
  };

  const sentAt = new Date().toLocaleDateString("mn-MN", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const html = buildOrderEmail(payload, sentAt);
  const subject = `📬 Захиалга #${p.orderId} хүлээн авлаа — ${p.serviceType}`;

  await resendSend({
    to:      p.customerEmail,
    subject,
    html,
    tag:     `customer-received-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   sendAdminOrderNotification
══════════════════════════════════════════════════ */
export async function sendAdminOrderNotification(p: AdminOrderPayload): Promise<void> {
  const payload: OrderEmailPayload = {
    id:            p.orderId,
    serviceType:   p.serviceType,
    district:      p.zone,
    address:       p.address,
    pitStatus:     p.pitStatus,
    pitType:       p.pitType,
    volume:        p.volume,
    volumeUnit:    p.volumeUnit,
    date:          p.date,
    timeSlot:      p.slot,
    basePrice:     p.priceSubtotal,
    addOns:        (p.addOns ?? []).map(a => ({ label: a.name, price: a.price })),
    totalPrice:    p.priceTotal,
    customerName:  p.customerName,
    customerEmail: p.customerEmail,
    customerPhone: p.customerPhone,
  };

  const sentAt = new Date().toLocaleDateString("mn-MN", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const html    = buildOrderEmail(payload, sentAt);
  const subject =
    `🚛 Захиалга #${p.orderId} — ${p.serviceType} · ${p.zone} · ${fmtMnt(p.priceTotal)}`;

  await resendSend({
    to:      p.adminEmail,
    subject,
    html,
    tag:     `admin-notif-${p.orderId}`,
  });
}

/* ══════════════════════════════════════════════════
   sendInvoiceEmail
══════════════════════════════════════════════════ */
export async function sendInvoiceEmail(p: InvoicePayload): Promise<void> {
  const addOns   = p.addOns ?? [];
  const addOnSum = addOns.reduce((s, a) => s + a.price, 0);
  const hasAddOn = addOns.length > 0 && addOnSum > 0;
  const fmt = (n: number) => (n ?? 0).toLocaleString("mn-MN") + "₮";

  const addOnRows = addOns.map(a => `
    <tr>
      <td style="padding:10px 22px;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:13px;color:#64748b;">✨ ${a.name}</span>
      </td>
      <td style="padding:10px 22px;border-bottom:1px solid #f1f5f9;text-align:right;">
        <span style="font-size:13px;color:#f59e0b;font-weight:600;">+${fmt(a.price)}</span>
      </td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="mn"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:36px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#fff;border-radius:18px;overflow:hidden;
    box-shadow:0 8px 40px rgba(5,150,105,0.14);">
  <tr>
    <td style="background:linear-gradient(135deg,#064e3b,#059669);padding:32px 28px;">
      <h1 style="margin:0 0 6px;font-size:23px;font-weight:800;color:#fff;">
        ✅ Захиалга #${p.orderId} дууслаа
      </h1>
      <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.75);">
        Дууссан: ${p.completedAt}
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 28px 0;">
      <p style="margin:0 0 16px;font-size:13.5px;color:#374151;">
        Сайн байна уу. Таны захиалсан үйлчилгээ амжилттай хүргэгдэн дууслаа.
      </p>
    </td>
  </tr>
  <tr><td style="padding:0 22px;"><table width="100%" cellpadding="0" cellspacing="0">
    <tr><td colspan="2" style="padding:14px 0 4px;">
      <span style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:0.12em;">📋 ЗАХИАЛГЫН ДЭЛГЭРЭНГҮЙ</span>
    </td></tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;">🚛 Үйлчилгээ</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;font-weight:700;">${p.serviceType}</span></td>
    </tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;">🗺️ Бүс</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;">${p.zone}</span></td>
    </tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;">📍 Хаяг</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;">${p.address}</span></td>
    </tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;">⚖️ Хэмжээ</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;">${p.volume} ${p.volumeUnit === "M3" ? "м³" : "тонн"}</span></td>
    </tr>
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;">🕐 Цаг</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;">${p.slot}</span></td>
    </tr>
  </table></td></tr>
  <tr><td style="padding:0 22px;"><table width="100%" cellpadding="0" cellspacing="0">
    <tr><td colspan="2" style="padding:14px 0 4px;">
      <span style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:0.12em;">🧾 НЭХЭМЖЛЭЛ</span>
    </td></tr>
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;">📦 Үндсэн үйлчилгээ</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;">${fmt(p.priceSubtotal)}</span></td>
    </tr>
    ${addOnRows}
    ${hasAddOn ? `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;"><span style="font-size:13px;color:#64748b;font-weight:600;">➕ Нэмэлтүүдийн нийлбэр</span></td>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;"><span style="font-size:13px;color:#f59e0b;font-weight:700;">${fmt(addOnSum)}</span></td>
    </tr>` : ""}
  </table></td></tr>
  <tr><td style="padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="background:linear-gradient(135deg,#064e3b,#059669);padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><span style="font-size:14px;font-weight:700;color:#fff;">🧾 Нийт нэхэмжлэх дүн</span></td>
          <td style="text-align:right;"><span style="font-size:26px;font-weight:800;color:#fbbf24;">${fmt(p.priceTotal)}</span></td>
        </tr></table>
      </td>
    </tr></table>
  </td></tr>
  <tr>
    <td style="padding:24px 28px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">${BANK_INFO.company} · Бохир ус тээвэрлэлтийн систем</p>
      <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">Бидний үйлчилгээг сонгосонд баярлалаа.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;

  await resendSend({
    to:      p.customerEmail,
    subject: `🧾 Захиалга #${p.orderId} — Нэхэмжлэл (${fmt(p.priceTotal)})`,
    html,
    tag:     `invoice-${p.orderId}`,
  });
}