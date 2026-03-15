// ============================================================
// 9CLO API — Orders Routes
// POST /api/orders     { customerName, email, phone, address, notes }
// GET  /api/orders/:orderNumber  (lookup by order number)
// ============================================================
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { getCartWithProducts } = require('./cart');

// POST /api/orders — Checkout
router.post('/', (req, res) => {
  try {
    const { customerName, email, phone, address, notes } = req.body;
    const sessionId = req.session.id;

    // Validation
    if (!customerName || !email || !address) {
      return res.status(400).json({
        success: false,
        error: 'customerName, email, dan address wajib diisi'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Format email tidak valid' });
    }

    // Get current cart
    const cart = getCartWithProducts(sessionId);
    if (cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Keranjang kosong' });
    }

    // Generate order number: 9CLO-YYYYMMDD-XXXX
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.random().toString(36).toUpperCase().slice(2, 6);
    const orderNumber = `9CLO-${datePart}-${randPart}`;

    // Save order
    const stmt = db.prepare(`
      INSERT INTO orders (order_number, session_id, customer_name, customer_email, customer_phone, customer_address, subtotal, shipping_cost, total, items, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      orderNumber,
      sessionId,
      customerName,
      email,
      phone || null,
      address,
      cart.subtotal,
      cart.shippingCost,
      cart.total,
      JSON.stringify(cart.items),
      notes || null
    );

    // Clear cart after successful order
    db.prepare('DELETE FROM cart WHERE session_id = ?').run(sessionId);

    res.status(201).json({
      success: true,
      message: 'Pesanan berhasil dibuat! Tim kami akan segera menghubungi kamu.',
      data: {
        orderNumber,
        customerName,
        email,
        subtotal: cart.subtotal,
        shippingCost: cart.shippingCost,
        total: cart.total,
        itemCount: cart.count,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('POST /api/orders error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/orders/:orderNumber — Order status lookup
router.get('/:orderNumber', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(req.params.orderNumber);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order tidak ditemukan' });
    }
    res.json({
      success: true,
      data: {
        ...order,
        items: JSON.parse(order.items || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/orders — All orders summary (admin use)
router.get('/', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT id, order_number, customer_name, customer_email, total, status, created_at
      FROM orders ORDER BY created_at DESC LIMIT 100
    `).all();
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
