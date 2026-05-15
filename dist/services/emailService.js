"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendOrderNotification = sendOrderNotification;
exports.sendAdminOrderNotification = sendAdminOrderNotification;
exports.sendInvoiceEmail = sendInvoiceEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
/* ══════════════════════════════════════════════════
   TRANSPORTER
══════════════════════════════════════════════════ */
function createTransporter() {
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST ?? "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: {
            user: process.env.SMTP_USER ?? "",
            pass: process.env.SMTP_PASS ?? "",
        },
    });
}
/* ══════════════════════════════════════════════════
   FORMATTERS
══════════════════════════════════════════════════ */
function fmtMnt(n) {
    return (n ?? 0).toLocaleString("mn-MN") + "₮";
}
const UNIT_LABEL = {
    TON: "тонн",
    M3: "м³",
    LITER: "литр",
};
function fmtUnit(unit) {
    return UNIT_LABEL[unit] ?? unit ?? "тонн";
}
function fmtDate(d) {
    try {
        return new Date(d).toLocaleDateString("mn-MN", {
            year: "numeric", month: "long", day: "numeric", weekday: "long",
        });
    }
    catch {
        return d;
    }
}
/* ══════════════════════════════════════════════════
   BANK INFO  (env-ээс авна, fallback байна)
══════════════════════════════════════════════════ */
const BANK_INFO = {
    company: process.env.BANK_COMPANY ?? "Өргөжих Хаус ХХК",
    bank: process.env.BANK_NAME ?? "Хаан банк",
    account: process.env.BANK_ACCOUNT ?? "5000010361",
    iban: process.env.BANK_IBAN ?? "MN570032005000010361",
};
/* ══════════════════════════════════════════════════
   TRANSACTION REFERENCE
══════════════════════════════════════════════════ */
function txRef(orderId) {
    return `URGUJIKH-${String(orderId).padStart(6, "0")}`;
}
function normalizePitStatus(raw) {
    const LABELS = {
        yes: "✅ Тийм, байна",
        no: "❌ Үгүй / стандартын бус",
        unsure: "❓ Мэдэхгүй",
    };
    const DESCS = {
        yes: "Зориулалтын нүх байна — Бохир ус сорох боломжтой",
        no: "Зориулалтын нүх байхгүй — Бохир ид сорхалх боломж байхгүй байж болно",
        unsure: "Тодорхойгүй — Жолооч газарт очоод шалгана",
    };
    const COLORS = {
        yes: "#059669",
        no: "#dc2626",
        unsure: "#d97706",
    };
    const key = raw;
    if (key && LABELS[key]) {
        return { key, label: LABELS[key], desc: DESCS[key], color: COLORS[key] };
    }
    return { key: null, label: "—", desc: "Мэдээлэл байхгүй", color: "#6b7280" };
}
function normalizePitType(raw) {
    if (raw === "septic")
        return "🏗️ Септик систем";
    if (raw === "pitToilet")
        return "🚽 Нүхэн жорлон";
    if (raw === "tank")
        return "🛢️ Хуримтлагч танк";
    return raw ?? "—";
}
/* ══════════════════════════════════════════════════
   HTML BUILDER
══════════════════════════════════════════════════ */
function buildOrderEmail(p, sentAt) {
    const pit = normalizePitStatus(p.pitStatus);
    const pitType = normalizePitType(p.pitType);
    const ref = txRef(p.id);
    const addOns = p.addOns ?? [];
    const addOnSum = addOns.reduce((s, a) => s + a.price, 0);
    const hasAddOn = addOns.length > 0 && addOnSum > 0;
    const dashboardUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.id}`;
    /* ── table row helper ── */
    const row = (icon, label, value, opts = {}) => `
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
    /* ── section header ── */
    const section = (title) => `
  <tr>
    <td colspan="2" style="padding:14px 22px 4px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <span style="font-size:10px;font-weight:800;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">
        ${title}
      </span>
    </td>
  </tr>`;
    /* ── add-on rows ── */
    const addOnRows = addOns.map(a => row("✨", a.label, `+${fmtMnt(a.price)}`, { color: "#f59e0b" })).join("");
    return `<!DOCTYPE html>
<html lang="mn">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Шинэ захиалга #${p.id}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;
  font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0"
  style="background:#eef2f7;padding:36px 16px;">
<tr><td align="center">

<table width="600" cellpadding="0" cellspacing="0"
  style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;
    overflow:hidden;box-shadow:0 8px 40px rgba(30,64,175,0.14);">

  <!-- ══ HEADER ══ -->
  <tr>
    <td colspan="2"
      style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#2563eb 100%);
        padding:36px 28px 30px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <div style="background:rgba(255,255,255,0.16);border-radius:12px;
            display:inline-block;padding:9px 15px;margin-bottom:14px;">
            <span style="font-size:22px;">🚛</span>
          </div>
          <h1 style="margin:0 0 8px;font-size:25px;font-weight:800;
            color:#ffffff;line-height:1.2;letter-spacing:-0.01em;">
            Шинэ захиалга ирлээ!
          </h1>
          <p style="margin:0;font-size:12.5px;color:rgba(255,255,255,0.68);">
            Захиалга&nbsp;<strong style="color:#fff;">#${p.id}</strong>
            &nbsp;•&nbsp;${sentAt}
          </p>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="background:#fef3c7;border-radius:20px;
            padding:6px 14px;display:inline-block;margin-bottom:8px;">
            <span style="font-size:11.5px;font-weight:800;color:#92400e;">
              ⏳ Хүлээгдэж буй
            </span>
          </div>
          <br/>
          <span style="font-size:11px;color:rgba(255,255,255,0.55);">
            Лавлах: ${BANK_INFO.company}
          </span>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- ══ ХЭРЭГЛЭГЧ ══ -->
  ${section("👤 Хэрэглэгчийн мэдээлэл")}
  ${row("🧑", "Нэр", p.customerName ?? "—")}
  ${row("✉️", "Имэйл", p.customerEmail ?? "—", { color: "#2563eb" })}
  ${row("📞", "Утас", p.customerPhone ?? "—")}

  <!-- ══ ЗАХИАЛГА ══ -->
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

  <!-- ══ ҮНЭ ТООЦООЛОЛ ══ -->
  ${section("💰 Үнийн тооцоолол")}
  ${row("📦", "Үндсэн үйлчилгээний үнэ", fmtMnt(p.basePrice))}
  ${addOnRows}
  ${hasAddOn ? row("➕", "Нэмэлт үйлчилгээний нийлбэр", fmtMnt(addOnSum), { color: "#f59e0b", bold: true }) : ""}

  <!-- НИЙТ МӨНГӨН ДҮН -->
  <tr>
    <td colspan="2" style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <span style="font-size:14px;font-weight:700;color:#fff;">
                💰 Нийт төлбөр
              </span>
              ${hasAddOn ? `<br/><span style="font-size:11px;color:rgba(255,255,255,0.58);">
                Үндсэн ${fmtMnt(p.basePrice)} + нэмэлт ${fmtMnt(addOnSum)}
              </span>` : ""}
            </td>
            <td style="text-align:right;">
              <span style="font-size:26px;font-weight:800;color:#fbbf24;">
                ${fmtMnt(p.totalPrice)}
              </span>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr>

  <!-- ══ БАНКНЫ МЭДЭЭЛЭЛ ══ -->
  ${section("🏦 Банкны шилжүүлгийн мэдээлэл")}
  ${row("🏦", "Банк", BANK_INFO.bank, { small: true })}
  ${row("🏢", "Компанийн нэр", BANK_INFO.company, { small: true })}
  ${row("💳", "Дансны дугаар", BANK_INFO.account, { small: true, bold: true })}
  ${row("🔢", "IBAN", BANK_INFO.iban, { small: true })}
  ${row("📝", "Гүйлгээний утга", ref, { small: true, bold: true, color: "#2563eb" })}

  <!-- ══ BUTTON ══ -->
  <tr>
    <td colspan="2" style="padding:32px 28px 24px;text-align:center;">
      <a href="${dashboardUrl}"
        style="display:inline-block;
          background:linear-gradient(135deg,#2563eb,#1d4ed8);
          color:#ffffff;text-decoration:none;font-size:14.5px;font-weight:700;
          padding:15px 40px;border-radius:12px;letter-spacing:0.02em;
          box-shadow:0 4px 16px rgba(37,99,235,0.35);">
        Admin Dashboard-д харах &rarr;
      </a>
    </td>
  </tr>

  <!-- ══ FOOTER ══ -->
  <tr>
    <td colspan="2"
      style="padding:16px 28px 28px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">
        ${BANK_INFO.company}
        &nbsp;•&nbsp;Бохир ус тээвэрлэлтийн систем
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
   PASSWORD RESET EMAIL
══════════════════════════════════════════════════ */
async function sendPasswordResetEmail({ to, resetUrl, }) {
    const transporter = createTransporter();
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
      <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">Өргөжих Хаус ХХК</p>
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
    await transporter.sendMail({
        from: `"Өргөжих Хаус" <${process.env.SMTP_USER}>`,
        to,
        subject: "🔐 Нууц үг сэргээх холбоос",
        html,
    });
    console.log(`[email] ✅ Password reset email sent → ${to}`);
}
/* ══════════════════════════════════════════════════
   MAIN EXPORT — sendOrderNotification
   Зөвхөн НЭГ мэйл (admin) явуулна
══════════════════════════════════════════════════ */
async function sendOrderNotification(payload) {
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER;
    if (!adminEmail) {
        console.warn("[email] ADMIN_EMAIL тохируулаагүй — мэйл явуулахгүй");
        return;
    }
    const sentAt = new Date().toLocaleDateString("mn-MN", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
    const html = buildOrderEmail(payload, sentAt);
    const subject = `🚛 Захиалга #${payload.id} — ${payload.serviceType} · ${payload.district} · ${fmtMnt(payload.totalPrice)}`;
    const transporter = createTransporter();
    try {
        await transporter.sendMail({
            from: `"${BANK_INFO.company}" <${process.env.SMTP_USER}>`,
            to: adminEmail,
            subject,
            html,
        });
        console.log(`[email] ✅ Захиалга #${payload.id} мэйл явлаа → ${adminEmail}`);
    }
    catch (err) {
        console.error(`[email] ❌ Мэйл явуулахад алдаа гарлаа:`, err);
        throw err;
    }
} /* ══════════════════════════════════════════════════
   ИЙМ КОДЫГ src/services/emailService.ts ФАЙЛЫН
   ХАМГИЙН ТӨГСГӨЛД (мөр 421-ний дараа) НЭМЭХ
   ══════════════════════════════════════════════════
   Шалтгаан: src/routes/orders.ts нь
     import { sendInvoiceEmail, sendAdminOrderNotification }
   гэж import хийдэг ч өмнө нь зөвхөн `sendOrderNotification`
   гэдэг функц л export болсон байсан. Энэ runtime crash өгөх
   ёстой алдаа байсан тул admin email явахгүй байсан.
══════════════════════════════════════════════════ */
/* ──────────────────────────────────────────────
   sendAdminOrderNotification
   Захиалга үүссэний дараа админ руу явуулах email.
   Дотроо одоо байгаа buildOrderEmail()-ийг ашиглана.
────────────────────────────────────────────── */
async function sendAdminOrderNotification(p) {
    // OrderEmailPayload руу хөрвүүлнэ
    const payload = {
        id: p.orderId,
        serviceType: p.serviceType,
        district: p.zone,
        address: p.address,
        pitStatus: p.pitStatus,
        pitType: p.pitType,
        volume: p.volume,
        volumeUnit: p.volumeUnit,
        date: p.date,
        timeSlot: p.slot,
        basePrice: p.priceSubtotal,
        addOns: (p.addOns ?? []).map(a => ({ label: a.name, price: a.price })),
        totalPrice: p.priceTotal,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        customerPhone: p.customerPhone,
    };
    const sentAt = new Date().toLocaleDateString("mn-MN", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
    // OrderEmailPayload type-д `addOns` нь `{ label, price }[]` гэж байна.
    // Үүнийг ашиглахын тулд buildOrderEmail дотор label ашигладаг эсэхийг шалгах хэрэгтэй.
    // Дээрх buildOrderEmail() label-ийг ашигладаг тул ийм байхад зүгээр.
    const html = buildOrderEmail(payload, sentAt);
    const subject = `🚛 Захиалга #${p.orderId} — ${p.serviceType} · ${p.zone} · ${(p.priceTotal ?? 0).toLocaleString("mn-MN")}₮`;
    const transporter = createTransporter();
    try {
        await transporter.sendMail({
            from: `"${BANK_INFO.company}" <${process.env.SMTP_USER}>`,
            to: p.adminEmail,
            subject,
            html,
        });
        console.log(`[email] ✅ Admin notif #${p.orderId} → ${p.adminEmail}`);
    }
    catch (err) {
        console.error(`[email] ❌ Admin notif fail #${p.orderId}:`, err);
        throw err;
    }
}
/* ──────────────────────────────────────────────
   sendInvoiceEmail
   Захиалга DONE статустай болоход хэрэглэгч рүү явуулах нэхэмжлэл.
────────────────────────────────────────────── */
async function sendInvoiceEmail(p) {
    const transporter = createTransporter();
    const addOns = p.addOns ?? [];
    const addOnSum = addOns.reduce((s, a) => s + a.price, 0);
    const hasAddOn = addOns.length > 0 && addOnSum > 0;
    const fmt = (n) => (n ?? 0).toLocaleString("mn-MN") + "₮";
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
        Сайн байна уу. Таны захиалсан үйлчилгээ амжилттай хүргэгдэн дууслаа. Доор нэхэмжлэлийн дэлгэрэнгүй мэдээллийг хавсаргалаа.
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
    try {
        await transporter.sendMail({
            from: `"${BANK_INFO.company}" <${process.env.SMTP_USER}>`,
            to: p.customerEmail,
            subject: `🧾 Захиалга #${p.orderId} — Нэхэмжлэл (${(p.priceTotal ?? 0).toLocaleString("mn-MN")}₮)`,
            html,
        });
        console.log(`[email] ✅ Invoice #${p.orderId} → ${p.customerEmail}`);
    }
    catch (err) {
        console.error(`[email] ❌ Invoice fail #${p.orderId}:`, err);
        throw err;
    }
}
