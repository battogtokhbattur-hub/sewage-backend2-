"use strict";
/* ══════════════════════════════════════════════════
   ORDER STATUS NOTIFICATION EMAILS
   Захиалгын төлөв өөрчлөгдөх бүрд хэрэглэгч рүү явуулах имэйлүүд
══════════════════════════════════════════════════ */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOrderConfirmedEmail = sendOrderConfirmedEmail;
exports.sendOrderAssignedEmail = sendOrderAssignedEmail;
exports.sendOrderInProgressEmail = sendOrderInProgressEmail;
exports.sendInvoicePaymentEmail = sendInvoicePaymentEmail;
exports.sendOrderCompletedEmail = sendOrderCompletedEmail;
exports.sendOrderCanceledEmail = sendOrderCanceledEmail;
exports.sendAdminPaymentNotice = sendAdminPaymentNotice;
const nodemailer_1 = __importDefault(require("nodemailer"));
function createTransporterStatus() {
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
function fmtMntStatus(n) {
    return (n ?? 0).toLocaleString("mn-MN") + "₮";
}
const STATUS_BANK_INFO = {
    company: process.env.BANK_COMPANY ?? "Өргөжих Хаус ХХК",
    bank: process.env.BANK_NAME ?? "Хаан банк",
    account: process.env.BANK_ACCOUNT ?? "5000010361",
    iban: process.env.BANK_IBAN ?? "MN570032005000010361",
};
/* ──────────────────────────────────────────────
   Универсал имэйл template
────────────────────────────────────────────── */
function statusEmailWrapper(opts) {
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
          <div style="background:rgba(255,255,255,0.18);border-radius:12px;
            display:inline-block;padding:9px 15px;margin-bottom:14px;">
            <span style="font-size:22px;">${opts.emoji}</span>
          </div>
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;line-height:1.2;">
            ${opts.title}
          </h1>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.78);">
            ${opts.subtitle}
          </p>
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
      <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;">
        Энэ мэйл автоматаар илгээгдсэн.
      </p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;
}
function statusInfoBox(rows) {
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
function statusInfoSection(title) {
    return `
  <tr>
    <td style="padding:18px 22px 4px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <span style="font-size:10.5px;font-weight:800;letter-spacing:0.12em;color:#94a3b8;text-transform:uppercase;">
        ${title}
      </span>
    </td>
  </tr>`;
}
async function sendOrderConfirmedEmail(p) {
    const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
    const html = statusEmailWrapper({
        bgGradient: "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#2563eb 100%)",
        badgeBg: "#dbeafe",
        badgeColor: "#1e40af",
        badgeText: "✅ Баталгаажсан",
        emoji: "📋",
        title: "Захиалга баталгаажлаа!",
        subtitle: `Захиалга #${p.orderId} • Бид удахгүй жолооч хувиарлах болно`,
        bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалгыг бид амжилттай хүлээн авч <strong>баталгаажуулсан</strong> байна.
          Удахгүй жолооч хувиарлагдсан тухай мэдэгдэл явуулах болно.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
            { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
            { icon: "🗺️", label: "Дүүрэг", value: p.district },
            { icon: "📍", label: "Хаяг", value: p.address },
            { icon: "📅", label: "Огноо", value: p.date },
            { icon: "🕐", label: "Цаг", value: p.timeSlot, color: "#2563eb" },
            { icon: "💰", label: "Үнийн дүн", value: fmtMntStatus(p.totalPrice), color: "#059669" },
        ])}`,
        ctaText: "Захиалгаа харах →",
        ctaUrl: url,
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.to,
        subject: `✅ Захиалга #${p.orderId} баталгаажлаа`,
        html,
    });
    console.log(`[email] ✅ Confirmed #${p.orderId} → ${p.to}`);
}
async function sendOrderAssignedEmail(p) {
    const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
    // Жолоочийн мэдээллийн талбарууд (машин мэдээлэл байгаа бол нэмж харуулна)
    const driverInfoFields = [
        { icon: "🧑", label: "Жолоочийн нэр", value: p.driverName, color: "#7c3aed" },
        { icon: "📞", label: "Утасны дугаар", value: p.driverPhone, color: "#7c3aed" },
    ];
    if (p.truckName)
        driverInfoFields.push({ icon: "🚚", label: "Машин", value: p.truckName, color: "#7c3aed" });
    if (p.truckPlate)
        driverInfoFields.push({ icon: "🔢", label: "Гос дугаар", value: p.truckPlate, color: "#7c3aed" });
    const html = statusEmailWrapper({
        bgGradient: "linear-gradient(135deg,#5b21b6 0%,#7c3aed 50%,#8b5cf6 100%)",
        badgeBg: "#ede9fe",
        badgeColor: "#5b21b6",
        badgeText: "🚛 Жолооч хувиарлагдсан",
        emoji: "🚛",
        title: "Жолооч таны захиалгыг хүлээн авлаа!",
        subtitle: `Захиалга #${p.orderId} • Заасан өдөр болон цагт ирнэ`,
        bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалгад жолооч хувиарлагдлаа. Заасан огноо, цагт жолооч таны хаяг руу ирнэ.
          Шаардлагатай бол доорх утсаар жолоочтой шууд холбогдож болно.
        </p>
      </td></tr>
      ${statusInfoSection("👤 ХУВИАРЛАГДСАН ЖОЛООЧ")}
      ${statusInfoBox(driverInfoFields)}
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
            { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
            { icon: "📍", label: "Хаяг", value: p.address },
            { icon: "📅", label: "Огноо", value: p.date },
            { icon: "🕐", label: "Цаг", value: p.timeSlot, color: "#2563eb" },
        ])}`,
        ctaText: "Захиалгаа харах →",
        ctaUrl: url,
        ctaColor: "linear-gradient(135deg,#7c3aed,#5b21b6)",
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.to,
        subject: `🚛 Захиалга #${p.orderId} — Жолооч хувиарлагдлаа`,
        html,
    });
    console.log(`[email] 🚛 Assigned #${p.orderId} → ${p.to}`);
}
/* ══════════════════════════════════════════════════
   3) IN_PROGRESS — "Үйлчилгээ эхэллээ" имэйл
══════════════════════════════════════════════════ */
async function sendOrderInProgressEmail(p) {
    const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
    const html = statusEmailWrapper({
        bgGradient: "linear-gradient(135deg,#92400e 0%,#d97706 50%,#f59e0b 100%)",
        badgeBg: "#fef3c7",
        badgeColor: "#92400e",
        badgeText: "🔄 Явагдаж байна",
        emoji: "🔄",
        title: "Үйлчилгээ эхэллээ!",
        subtitle: `Захиалга #${p.orderId} • Жолооч таны хаяг дээр ажилаж эхэллээ`,
        bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Жолооч таны хаяг дээр очиж <strong>үйлчилгээг эхлүүллээ</strong>.
          Үйлчилгээ дууссаны дараа таны имэйл рүү төлбөрийн нэхэмжлэл ирэх болно.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
            { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
            { icon: "📍", label: "Хаяг", value: p.address },
            { icon: "🕐", label: "Цаг", value: p.timeSlot },
        ])}`,
        ctaText: "Захиалгаа харах →",
        ctaUrl: url,
        ctaColor: "linear-gradient(135deg,#d97706,#92400e)",
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.to,
        subject: `🔄 Захиалга #${p.orderId} — Үйлчилгээ эхэллээ`,
        html,
    });
    console.log(`[email] 🔄 InProgress #${p.orderId} → ${p.to}`);
}
async function sendInvoicePaymentEmail(p) {
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
        badgeBg: "#fed7aa",
        badgeColor: "#9a3412",
        badgeText: "💳 Төлбөр хүлээгдэж буй",
        emoji: "🧾",
        title: "Үйлчилгээ дууслаа — Төлбөрийн нэхэмжлэл",
        subtitle: `Захиалга #${p.orderId} • Гүйлгээний утга: ${ref}`,
        bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны захиалгын <strong>үйлчилгээ амжилттай гүйцэтгэгдэж дууссан</strong> байна.
          Доорх банкны мэдээллийн дагуу <strong>төлбөрөө шилжүүлэхийг</strong> хүсье.
          Төлбөр хүлээн авсны дараа админ захиалгыг бүрэн дуусгах болно.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
            { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
            { icon: "🗺️", label: "Дүүрэг", value: p.district },
            { icon: "📍", label: "Хаяг", value: p.address },
            { icon: "⚖️", label: "Хэмжээ", value: `${p.volume} ${p.volumeUnit === "M3" ? "м³" : "тонн"}` },
            { icon: "🕐", label: "Цаг", value: p.timeSlot },
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

      ${statusInfoSection("🏦 БАНКНЫ МЭДЭЭЛЭЛ — ШИЛЖҮҮЛЭГ ХИЙХ")}
      <tr><td style="padding:14px 22px 0;">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 8px;font-size:12.5px;color:#9a3412;font-weight:700;">
            ⚠️ ВАЖНО: Гүйлгээний утган дотор заавал доорх кодыг бичнэ үү
          </p>
          <p style="margin:0;font-size:14px;color:#7c2d12;font-weight:800;letter-spacing:0.04em;">
            ${ref}
          </p>
        </div>
      </td></tr>
      ${statusInfoBox([
            { icon: "🏦", label: "Банк", value: STATUS_BANK_INFO.bank },
            { icon: "🏢", label: "Компанийн нэр", value: STATUS_BANK_INFO.company },
            { icon: "💳", label: "Дансны дугаар", value: STATUS_BANK_INFO.account, color: "#1e40af" },
            { icon: "🔢", label: "IBAN", value: STATUS_BANK_INFO.iban },
            { icon: "📝", label: "Гүйлгээний утга", value: ref, color: "#dc2626" },
        ])}

      <tr><td style="padding:14px 22px 0;">
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
          <p style="margin:0;font-size:12.5px;color:#78350f;line-height:1.6;">
            💡 Төлбөр шилжүүлсний дараа админ таны төлбөрийг шалгаж захиалгыг
            <strong>"Дууссан"</strong> төлөвт оруулна. Шилжүүлэг хийсэн тохиолдолд
            <a href="tel:${process.env.ADMIN_PHONE ?? ''}">бидэнтэй холбогдож</a> мэдэгдэж болно.
          </p>
        </div>
      </td></tr>`,
        ctaText: "Захиалгаа харах & Төлсөн гэж тэмдэглэх",
        ctaUrl: url,
        ctaColor: "linear-gradient(135deg,#ea580c,#7c2d12)",
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.to,
        subject: `🧾 Захиалга #${p.orderId} — Төлбөрийн нэхэмжлэл (${fmtMntStatus(p.totalPrice)})`,
        html,
    });
    console.log(`[email] 🧾 Invoice #${p.orderId} → ${p.to}`);
}
async function sendOrderCompletedEmail(p) {
    const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
    const html = statusEmailWrapper({
        bgGradient: "linear-gradient(135deg,#064e3b 0%,#065f46 50%,#059669 100%)",
        badgeBg: "#d1fae5",
        badgeColor: "#065f46",
        badgeText: "🎉 Бүрэн дууссан",
        emoji: "🎉",
        title: "Захиалга амжилттай дууслаа!",
        subtitle: `Захиалга #${p.orderId} • Төлбөр баталгаажсан: ${p.paidAt}`,
        bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу${p.customerName ? `, <strong>${p.customerName}</strong>` : ""}!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Таны төлбөрийг хүлээн авч баталгаажууллаа.
          Захиалга <strong>амжилттай бүрэн дуусгасан</strong> байна. 🎉
        </p>
        <p style="margin:14px 0 0;font-size:13px;color:#374151;line-height:1.6;">
          Бидний үйлчилгээг сонгож, итгэл хүлээлгэсэнд <strong>баярлалаа</strong>.
          Дараа дахин үйлчилгээ хэрэгтэй бол ${STATUS_BANK_INFO.company}-той холбогдоно уу.
        </p>
      </td></tr>
      <tr><td style="padding:18px 22px;">
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:18px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:#065f46;font-weight:600;">
            ✅ Төлсөн дүн
          </p>
          <p style="margin:0;font-size:30px;font-weight:800;color:#059669;">
            ${fmtMntStatus(p.totalPrice)}
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#065f46;">
            ${p.serviceType}
          </p>
        </div>
      </td></tr>`,
        ctaText: "Захиалгын дэлгэрэнгүй →",
        ctaUrl: url,
        ctaColor: "linear-gradient(135deg,#059669,#065f46)",
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.to,
        subject: `🎉 Захиалга #${p.orderId} амжилттай дууслаа — Баярлалаа!`,
        html,
    });
    console.log(`[email] 🎉 Completed #${p.orderId} → ${p.to}`);
}
/* ══════════════════════════════════════════════════
   6) CANCELED — "Захиалга цуцлагдлаа" имэйл
══════════════════════════════════════════════════ */
async function sendOrderCanceledEmail(p) {
    const url = `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/dashboard/orders/${p.orderId}`;
    const html = statusEmailWrapper({
        bgGradient: "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 50%,#dc2626 100%)",
        badgeBg: "#fee2e2",
        badgeColor: "#991b1b",
        badgeText: "❌ Цуцлагдсан",
        emoji: "❌",
        title: "Захиалга цуцлагдлаа",
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
            { icon: "📍", label: "Хаяг", value: p.address },
            { icon: "📅", label: "Огноо", value: p.date },
            { icon: "🕐", label: "Цаг", value: p.timeSlot },
        ])}`,
        ctaText: "Шинэ захиалга өгөх",
        ctaUrl: `${p.appUrl ?? process.env.APP_URL ?? "http://localhost:3000"}/order/create`,
        ctaColor: "linear-gradient(135deg,#dc2626,#7f1d1d)",
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.to,
        subject: `❌ Захиалга #${p.orderId} цуцлагдлаа`,
        html,
    });
    console.log(`[email] ❌ Canceled #${p.orderId} → ${p.to}`);
}
async function sendAdminPaymentNotice(p) {
    const url = p.dashboardUrl ?? `${process.env.ADMIN_DASHBOARD_URL ?? "http://localhost:3000"}/admin`;
    const html = statusEmailWrapper({
        bgGradient: "linear-gradient(135deg,#065f46 0%,#10b981 50%,#34d399 100%)",
        badgeBg: "#d1fae5",
        badgeColor: "#065f46",
        badgeText: "💰 Төлбөр шилжүүлсэн",
        emoji: "💰",
        title: "Хэрэглэгч төлбөрөө шилжүүлсэн",
        subtitle: `Захиалга #${p.orderId} • ${new Date().toLocaleString("mn-MN")}`,
        bodyHtml: `
      <tr><td style="padding:24px 28px 0;">
        <p style="margin:0 0 12px;font-size:14px;color:#374151;">
          Сайн байна уу, <strong>Админ</strong>!
        </p>
        <p style="margin:0;font-size:13.5px;color:#374151;line-height:1.6;">
          Хэрэглэгч <strong>${p.customerName}</strong> өөрийн захиалгын төлбөрийг
          <strong>${fmtMntStatus(p.priceTotal)}</strong> шилжүүлсэн гэж тэмдэглэлээ.
          Та банкны дансаа шалгаад баталгаажуулна уу.
        </p>
      </td></tr>
      ${statusInfoSection("📋 ЗАХИАЛГЫН МЭДЭЭЛЭЛ")}
      ${statusInfoBox([
            { icon: "👤", label: "Хэрэглэгч", value: `${p.customerName} (${p.customerEmail})` },
            { icon: "📞", label: "Утас", value: p.customerPhone || "—" },
            { icon: "🚛", label: "Үйлчилгээ", value: p.serviceType },
            { icon: "📍", label: "Хаяг", value: p.address },
            { icon: "💵", label: "Дүн", value: fmtMntStatus(p.priceTotal) },
            ...(p.transactionRef ? [{ icon: "🔢", label: "Гүйлгээний №", value: p.transactionRef }] : []),
            ...(p.userNote ? [{ icon: "📝", label: "Тэмдэглэл", value: p.userNote }] : []),
        ])}`,
        ctaText: "Захиалгыг харах",
        ctaUrl: url,
        ctaColor: "linear-gradient(135deg,#10b981,#065f46)",
    });
    await createTransporterStatus().sendMail({
        from: `"${STATUS_BANK_INFO.company}" <${process.env.SMTP_USER}>`,
        to: p.adminEmail,
        subject: `💰 [Төлбөр] Захиалга #${p.orderId} — Хэрэглэгч төлсөн`,
        html,
    });
    console.log(`[email] 💰 Payment notice → ${p.adminEmail} (Order #${p.orderId})`);
}
