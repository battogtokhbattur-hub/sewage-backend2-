import nodemailer from "nodemailer";

export const sendResetEmail = async (to, link) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Өргөжих Хаус" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Нууц үг сэргээх",
    html: `
      <p>Та доорх холбоосоор нууц үгээ сэргээнэ үү:</p>
      <a href="${link}">${link}</a>
      <p>⏰ Холбоос 15 минут хүчинтэй</p>
    `,
  });
};
