// ============================================================
// 9CLO API — Auth Routes
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/logout
// GET  /api/auth/me
// POST /api/auth/forgot-password
// POST /api/auth/reset-password
// GET  /api/auth/verify-email/:token
// ============================================================
const express  = require('express');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const router   = express.Router();
const db       = require('../database/db');
const { signToken, requireAuth } = require('../middleware/auth');
const { sendPasswordReset, sendVerifyEmail } = require('../services/email');

// ── Helpers ────────────────────────────────────────────────
function safeUser(u) {
  const { password_hash, reset_token, verify_token, ...safe } = u;
  return safe;
}

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'name, email, password wajib diisi.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, error: 'Password minimal 8 karakter.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, error: 'Format email tidak valid.' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing)
      return res.status(409).json({ success: false, error: 'Email sudah terdaftar. Silakan login.' });

    const hash        = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, phone, verify_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase(), hash, phone || null, verifyToken);

    // Start session
    req.session.userId = result.lastInsertRowid;

    // Send verification email (non-blocking)
    sendVerifyEmail(email, name, verifyToken).catch(() => {});

    // Transfer anonymous cart to user
    db.prepare('UPDATE cart SET user_id = ? WHERE session_id = ? AND user_id IS NULL')
      .run(result.lastInsertRowid, req.session.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      success: true,
      message: 'Akun berhasil dibuat! Cek email untuk verifikasi.',
      data: safeUser(user)
    });
  } catch (err) {
    console.error('REGISTER error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email dan password wajib diisi.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user)
      return res.status(401).json({ success: false, error: 'Email atau password salah.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ success: false, error: 'Email atau password salah.' });

    // Update session & last login
    req.session.userId = user.id;
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Transfer anonymous cart → user's cart
    db.prepare('UPDATE cart SET user_id = ? WHERE session_id = ? AND user_id IS NULL')
      .run(user.id, req.session.id);

    const token = signToken({ id: user.id, role: user.role });
    res.json({
      success: true,
      message: `Selamat datang kembali, ${user.name}!`,
      token,
      data: safeUser(user)
    });
  } catch (err) {
    console.error('LOGIN error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('9clo.sid');
    res.json({ success: true, message: 'Berhasil logout.' });
  });
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  // Attach order count
  const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get(req.user.id)?.c || 0;
  res.json({ success: true, data: { ...req.user, orderCount } });
});

// ── UPDATE profile ─────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, phone, currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    let updates = [];
    let params  = [];

    if (name)  { updates.push('name = ?');  params.push(name.trim()); }
    if (phone) { updates.push('phone = ?'); params.push(phone); }

    // Change password
    if (newPassword) {
      if (!currentPassword)
        return res.status(400).json({ success: false, error: 'Masukkan password lama.' });
      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match)
        return res.status(401).json({ success: false, error: 'Password lama salah.' });
      if (newPassword.length < 8)
        return res.status(400).json({ success: false, error: 'Password baru minimal 8 karakter.' });
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(newPassword, 12));
    }

    if (updates.length > 0) {
      params.push(req.user.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, message: 'Profil diperbarui.', data: safeUser(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── GET /api/auth/my-orders ────────────────────────────────
router.get('/my-orders', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT id, order_number, total, status, payment_status, created_at, items
    FROM orders WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({
    success: true,
    data: orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }))
  });
});

// ── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, message: 'Jika email terdaftar, link reset akan dikirim.' });
    }
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, user.id);
    await sendPasswordReset(user.email, user.name, token);
    res.json({ success: true, message: 'Link reset password dikirim ke email kamu.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8)
      return res.status(400).json({ success: false, error: 'Token atau password tidak valid.' });

    const user = db.prepare(`
      SELECT * FROM users WHERE reset_token = ? AND reset_expires > datetime('now')
    `).get(token);
    if (!user)
      return res.status(400).json({ success: false, error: 'Link reset sudah expired atau tidak valid.' });

    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?')
      .run(hash, user.id);

    res.json({ success: true, message: 'Password berhasil direset. Silakan login.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── GET /api/auth/verify-email/:token ─────────────────────
router.get('/verify-email/:token', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(req.params.token);
  if (!user)
    return res.redirect('/login.html?error=invalid_token');

  db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL WHERE id = ?').run(user.id);
  res.redirect('/index.html?verified=1');
});

// ── GET/POST /api/auth/addresses ──────────────────────────
router.get('/addresses', requireAuth, (req, res) => {
  const addrs = db.prepare('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id);
  res.json({ success: true, data: addrs });
});

router.post('/addresses', requireAuth, (req, res) => {
  const { label, recipient_name, phone, address, city, province, postal_code, is_default } = req.body;
  if (!recipient_name || !address)
    return res.status(400).json({ success: false, error: 'recipient_name dan address wajib.' });

  if (is_default) {
    db.prepare('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  }
  const result = db.prepare(`
    INSERT INTO user_addresses (user_id, label, recipient_name, phone, address, city, province, postal_code, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, label||'Rumah', recipient_name, phone||null, address, city||null, province||null, postal_code||null, is_default?1:0);

  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM user_addresses WHERE id = ?').get(result.lastInsertRowid) });
});

router.delete('/addresses/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM user_addresses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true, message: 'Alamat dihapus.' });
});

module.exports = router;
