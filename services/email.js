// ============================================================
// 9CLO — Email Service
// ============================================================
const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

const FROM = process.env.EMAIL_FROM || '9clo Store <no-reply@9clo.com>';
const BASE = process.env.BASE_URL  || 'http://localhost:3000';

// ── Send order confirmation ───────────────────────────────
async function sendOrderConfirmation(order, items) {
  if (!process.env.EMAIL_USER) return; // Email not configured

  const rows = items.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #222">${i.product?.name || i.name}</td>
      <td style="padding:8px;border-bottom:1px solid #222">${i.size} / ${i.color}</td>
      <td style="padding:8px;border-bottom:1px solid #222">${i.qty}x</td>
      <td style="padding:8px;border-bottom:1px solid #222;text-align:right">Rp${(i.subtotal||0).toLocaleString('id')}</td>
    </tr>`).join('');

  const html = `
    <div style="background:#0a0a0a;padding:40px;font-family:sans-serif;color:#e0e0e0;max-width:600px;margin:0 auto">
      <h1 style="color:#ff4500;font-size:2rem;letter-spacing:-0.03em;margin:0 0 24px">9<span>clo</span></h1>
      <h2 style="font-size:1.2rem;margin:0 0 8px">Pesanan Dikonfirmasi! 🎉</h2>
      <p style="color:#999">Order #<strong style="color:#fff">${order.orderNumber}</strong></p>
      <p>Hei <strong>${order.customerName}</strong>, terima kasih sudah belanja di 9clo!</p>
      <table style="width:100%;border-collapse:collapse;margin:24px 0">
        <thead><tr style="background:#1a1a1a">
          <th style="padding:10px;text-align:left">Produk</th>
          <th style="padding:10px;text-align:left">Varian</th>
          <th style="padding:10px;text-align:left">Qty</th>
          <th style="padding:10px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>Rp${(order.subtotal||0).toLocaleString('id')}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Ongkir</span><span>${order.shippingCost===0?'GRATIS':'Rp'+order.shippingCost.toLocaleString('id')}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.1rem;margin-top:8px;padding-top:8px;border-top:1px solid #333"><span>Total</span><span style="color:#ff4500">Rp${(order.total||0).toLocaleString('id')}</span></div>
      </div>
      <p style="color:#999;font-size:0.85rem">Pesanan akan diproses dalam 1-2 hari kerja. Pertanyaan? Hubungi kami via <a href="mailto:cs@9clo.com" style="color:#ff4500">cs@9clo.com</a></p>
    </div>`;

  try {
    await createTransporter().sendMail({
      from:    FROM,
      to:      order.email,
      subject: `✅ Order #${order.orderNumber} Dikonfirmasi — 9clo`,
      html
    });
    console.log(`📧 Order email sent to ${order.email}`);
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

// ── Send password reset email ─────────────────────────────
async function sendPasswordReset(email, name, token) {
  if (!process.env.EMAIL_USER) return;
  const link = `${BASE}/reset-password.html?token=${token}`;
  try {
    await createTransporter().sendMail({
      from, to: email,
      subject: '🔐 Reset Password — 9clo',
      html: `
        <div style="background:#0a0a0a;padding:40px;font-family:sans-serif;color:#e0e0e0;max-width:600px">
          <h1 style="color:#ff4500">9clo</h1>
          <p>Hei ${name}, kamu meminta reset password.</p>
          <a href="${link}" style="display:inline-block;background:#ff4500;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
          <p style="color:#999;font-size:0.8rem">Link berlaku 1 jam. Abaikan jika kamu tidak meminta ini.</p>
        </div>`
    });
  } catch (e) { console.error('Reset email error:', e.message); }
}

// ── Send email verification ───────────────────────────────
async function sendVerifyEmail(email, name, token) {
  if (!process.env.EMAIL_USER) return;
  const link = `${BASE}/api/auth/verify-email/${token}`;
  try {
    await createTransporter().sendMail({
      from: FROM, to: email,
      subject: '✉️ Verifikasi Email — 9clo',
      html: `
        <div style="background:#0a0a0a;padding:40px;font-family:sans-serif;color:#e0e0e0;max-width:600px">
          <h1 style="color:#ff4500">9clo</h1>
          <p>Hei ${name}, verifikasi email kamu untuk melanjutkan.</p>
          <a href="${link}" style="display:inline-block;background:#ff4500;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Verifikasi Email</a>
        </div>`
    });
  } catch (e) { console.error('Verify email error:', e.message); }
}

module.exports = { sendOrderConfirmation, sendPasswordReset, sendVerifyEmail };
