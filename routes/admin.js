// ============================================================
// 9CLO API — Admin Routes (all protected by requireAdmin)
// GET  /api/admin/stats
// CRUD /api/admin/products
// POST /api/admin/products/:id/image
// GET+PUT /api/admin/orders
// PUT  /api/admin/orders/:id/status
// GET+PUT /api/admin/messages
// GET  /api/admin/customers
// POST /api/admin/coupons
// ============================================================
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const router  = express.Router();
const db      = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// All admin routes require admin auth
router.use(requireAdmin);

// ── File Upload (product images) ───────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/products');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Hanya file gambar yang diizinkan.'), allowed.includes(ext));
  }
});

// ── Helper: log admin action ────────────────────────────────
function logAction(adminId, action, entity, entityId, detail, ip) {
  try {
    db.prepare('INSERT INTO admin_logs (admin_id, action, entity, entity_id, detail, ip) VALUES (?, ?, ?, ?, ?, ?)')
      .run(adminId, action, entity, entityId, detail ? JSON.stringify(detail) : null, ip);
  } catch(e) {}
}

// ── GET /api/admin/stats ────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const totalProducts   = db.prepare('SELECT COUNT(*) as c FROM products WHERE is_active = 1').get().c;
    const totalOrders     = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const totalRevenue    = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE payment_status='paid'").get().s;
    const pendingOrders   = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c;
    const totalCustomers  = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").get().c;
    const unreadMessages  = db.prepare('SELECT COUNT(*) as c FROM contact_messages WHERE is_read=0').get().c;
    const todayRevenue    = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM orders WHERE payment_status='paid' AND date(created_at)=date('now')").get().s;

    // Revenue last 7 days
    const revenueChart = db.prepare(`
      SELECT date(created_at) as date, COALESCE(SUM(total),0) as revenue
      FROM orders WHERE payment_status='paid' AND created_at >= datetime('now','-7 days')
      GROUP BY date(created_at) ORDER BY date ASC
    `).all();

    // Top products
    const topProducts = db.prepare(`
      SELECT p.name, p.category, COUNT(o.id) as order_count
      FROM orders o, products p WHERE o.items LIKE '%'||p.id||'%'
      GROUP BY p.id ORDER BY order_count DESC LIMIT 5
    `).all();

    // Recent orders
    const recentOrders = db.prepare(`
      SELECT order_number, customer_name, total, status, payment_status, created_at
      FROM orders ORDER BY created_at DESC LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        totalProducts, totalOrders, totalRevenue, pendingOrders,
        totalCustomers, unreadMessages, todayRevenue,
        revenueChart, topProducts, recentOrders
      }
    });
  } catch (err) {
    console.error('ADMIN STATS error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── PRODUCTS CRUD ───────────────────────────────────────────

// GET all products (admin — includes inactive)
router.get('/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all()
    .map(p => ({
      ...p,
      sizes:  JSON.parse(p.sizes  || '[]'),
      colors: JSON.parse(p.colors || '[]'),
      images: JSON.parse(p.images || '[]')
    }));
  res.json({ success: true, count: products.length, data: products });
});

// POST — Add product
router.post('/products', (req, res) => {
  try {
    const { name, category, price, original_price, description, badge, stock, sizes, colors, image, featured } = req.body;
    if (!name || !category || !price)
      return res.status(400).json({ success: false, error: 'name, category, price wajib.' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const result = db.prepare(`
      INSERT INTO products (name, slug, category, price, original_price, description, badge, stock, sizes, colors, image, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, slug, category, parseInt(price),
      original_price ? parseInt(original_price) : null,
      description || null, badge || null,
      parseInt(stock) || 100,
      JSON.stringify(sizes || ['S','M','L','XL']),
      JSON.stringify(colors || ['Black']),
      image || 'assets/images/product-tee.png',
      featured ? 1 : 0
    );

    logAction(req.user.id, 'CREATE', 'product', result.lastInsertRowid, { name }, req.ip);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    console.error('ADMIN CREATE PRODUCT:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT — Update product
router.put('/products/:id', (req, res) => {
  try {
    const { name, category, price, original_price, description, badge, stock, sizes, colors, image, is_active, featured } = req.body;
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });

    db.prepare(`
      UPDATE products SET
        name=?, category=?, price=?, original_price=?, description=?, badge=?,
        stock=?, sizes=?, colors=?, image=?, is_active=?, featured=?
      WHERE id=?
    `).run(
      name, category, parseInt(price),
      original_price ? parseInt(original_price) : null,
      description || null, badge || null,
      parseInt(stock) || 100,
      JSON.stringify(sizes || ['S','M','L','XL']),
      JSON.stringify(colors || ['Black']),
      image, is_active !== undefined ? (is_active ? 1 : 0) : 1,
      featured ? 1 : 0,
      req.params.id
    );

    logAction(req.user.id, 'UPDATE', 'product', req.params.id, { name }, req.ip);
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE product
router.delete('/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT id, name FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });

    // Soft delete: set is_active = 0
    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
    logAction(req.user.id, 'DELETE', 'product', req.params.id, { name: product.name }, req.ip);
    res.json({ success: true, message: 'Produk dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST — Upload product image
router.post('/products/:id/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Tidak ada file yang diupload.' });
    const imageUrl = `/uploads/products/${req.file.filename}`;
    db.prepare('UPDATE products SET image = ? WHERE id = ?').run(imageUrl, req.params.id);
    logAction(req.user.id, 'UPLOAD_IMAGE', 'product', req.params.id, { url: imageUrl }, req.ip);
    res.json({ success: true, data: { url: imageUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ORDERS MANAGEMENT ────────────────────────────────────────

router.get('/orders', (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let sql = 'SELECT * FROM orders';
    const params = [];
    if (status && status !== 'all') { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const orders = db.prepare(sql).all(...params);
    const total  = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    res.json({
      success: true,
      data: orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })),
      total, page: parseInt(page), limit: parseInt(limit)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/orders/:id/status', (req, res) => {
  try {
    const { status, payment_status } = req.body;
    const validStatuses = ['pending','processing','shipped','delivered','cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, error: 'Status tidak valid.' });

    const updates = ['status = ?'];
    const params  = [status];
    if (payment_status) { updates.push('payment_status = ?'); params.push(payment_status); }
    if (status === 'shipped')   { updates.push('shipped_at = CURRENT_TIMESTAMP'); }
    if (status === 'delivered') { updates.push('delivered_at = CURRENT_TIMESTAMP'); }
    params.push(req.params.id);

    db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logAction(req.user.id, 'UPDATE_STATUS', 'order', req.params.id, { status, payment_status }, req.ip);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { ...order, items: JSON.parse(order.items || '[]') } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── MESSAGES ─────────────────────────────────────────────────

router.get('/messages', (req, res) => {
  const { read } = req.query;
  let sql = 'SELECT * FROM contact_messages';
  const params = [];
  if (read === '0') { sql += ' WHERE is_read = 0'; }
  sql += ' ORDER BY created_at DESC';
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

router.put('/messages/:id/read', (req, res) => {
  db.prepare('UPDATE contact_messages SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── CUSTOMERS ─────────────────────────────────────────────────

router.get('/customers', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const customers = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.email_verified, u.created_at, u.last_login,
           COUNT(o.id) as order_count, COALESCE(SUM(o.total),0) as total_spent
    FROM users u
    LEFT JOIN orders o ON o.user_id = u.id AND o.payment_status = 'paid'
    WHERE u.role = 'customer'
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).all(parseInt(limit), offset);
  const total = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='customer'").get().c;
  res.json({ success: true, data: customers, total });
});

// ── COUPONS ───────────────────────────────────────────────────

router.get('/coupons', (req, res) => {
  res.json({ success: true, data: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() });
});

router.post('/coupons', (req, res) => {
  try {
    const { code, type, value, min_order, max_uses, expires_at } = req.body;
    if (!code || !value) return res.status(400).json({ success: false, error: 'code dan value wajib.' });
    const result = db.prepare(`
      INSERT INTO coupons (code, type, value, min_order, max_uses, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(code.toUpperCase(), type||'percent', parseInt(value), parseInt(min_order)||0, parseInt(max_uses)||100, expires_at||null);
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/coupons/:id', (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── LOGS ──────────────────────────────────────────────────────
router.get('/logs', (req, res) => {
  const logs = db.prepare(`
    SELECT l.*, u.name as admin_name FROM admin_logs l
    LEFT JOIN users u ON l.admin_id = u.id
    ORDER BY l.created_at DESC LIMIT 100
  `).all();
  res.json({ success: true, data: logs });
});

// ── VALIDATE COUPON (public — used at checkout) ───────────────
router.post('/validate-coupon', (req, res) => {
  // Remove requireAdmin for this one  — it's called from checkout
}, (req, res) => {});

module.exports = router;
