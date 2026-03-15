// ============================================================
// 9CLO API — Contact Routes
// POST /api/contact  { name, email, subject, message }
// GET  /api/contact  (admin — list all messages)
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// POST /api/contact
router.post('/', (req, res) => {
  try {
    const { name, email, subject = 'Umum', message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'name, email, dan message wajib diisi'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Format email tidak valid' });
    }

    if (message.length < 10) {
      return res.status(400).json({ success: false, error: 'Pesan terlalu pendek (min. 10 karakter)' });
    }

    db.prepare(`
      INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)
    `).run(name, email, subject, message);

    console.log(`📨 Contact message from ${name} <${email}>`);

    res.status(201).json({
      success: true,
      message: 'Pesan berhasil diterima! Tim kami akan merespons dalam 1–2 hari kerja.'
    });
  } catch (err) {
    console.error('POST /api/contact error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/contact — Admin list
router.get('/', (req, res) => {
  try {
    const msgs = db.prepare(`
      SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json({ success: true, count: msgs.length, data: msgs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
