// ============================================================
// 9CLO API — Cart Routes (session-based)
// GET    /api/cart
// POST   /api/cart            { productId, size, color }
// PUT    /api/cart/:itemId    { qty }
// DELETE /api/cart/:itemId
// DELETE /api/cart            (clear all)
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../database/db');

function getSessionId(req) {
  return req.session.id;
}

function getCartWithProducts(sessionId) {
  const rows = db.prepare(`
    SELECT
      c.id as cart_item_id,
      c.qty,
      c.size,
      c.color,
      c.created_at,
      p.id as product_id,
      p.name,
      p.category,
      p.price,
      p.original_price,
      p.badge,
      p.image,
      p.stock
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.session_id = ?
    ORDER BY c.created_at ASC
  `).all(sessionId);

  const items = rows.map(r => ({
    cartItemId: r.cart_item_id,
    qty: r.qty,
    size: r.size,
    color: r.color,
    product: {
      id: r.product_id,
      name: r.name,
      category: r.category,
      price: r.price,
      originalPrice: r.original_price,
      badge: r.badge,
      image: r.image,
      stock: r.stock
    },
    subtotal: r.price * r.qty
  }));

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const shippingCost = subtotal >= 300000 ? 0 : 25000;
  const total = subtotal + shippingCost;
  const count = items.reduce((s, i) => s + i.qty, 0);

  return { items, subtotal, shippingCost, total, count };
}

// GET /api/cart
router.get('/', (req, res) => {
  try {
    const cart = getCartWithProducts(getSessionId(req));
    res.json({ success: true, data: cart });
  } catch (err) {
    console.error('GET /api/cart error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/cart
router.post('/', (req, res) => {
  try {
    const { productId, size = 'M', color = 'Black' } = req.body;
    const sessionId = getSessionId(req);

    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' });
    }

    // Check product exists
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check if same item already in cart
    const existing = db.prepare(`
      SELECT * FROM cart WHERE session_id = ? AND product_id = ? AND size = ? AND color = ?
    `).get(sessionId, productId, size, color);

    if (existing) {
      db.prepare('UPDATE cart SET qty = qty + 1 WHERE id = ?').run(existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart (session_id, product_id, size, color, qty) VALUES (?, ?, ?, ?, 1)
      `).run(sessionId, productId, size, color);
    }

    const cart = getCartWithProducts(sessionId);
    res.json({ success: true, message: `${product.name} ditambahkan ke keranjang`, data: cart });
  } catch (err) {
    console.error('POST /api/cart error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/cart/:itemId
router.put('/:itemId', (req, res) => {
  try {
    const { qty } = req.body;
    const sessionId = getSessionId(req);

    if (!qty || qty < 1) {
      return res.status(400).json({ success: false, error: 'qty must be >= 1' });
    }

    const item = db.prepare('SELECT * FROM cart WHERE id = ? AND session_id = ?').get(req.params.itemId, sessionId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Cart item not found' });
    }

    db.prepare('UPDATE cart SET qty = ? WHERE id = ?').run(qty, req.params.itemId);
    const cart = getCartWithProducts(sessionId);
    res.json({ success: true, data: cart });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/cart/:itemId
router.delete('/:itemId', (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const item = db.prepare('SELECT * FROM cart WHERE id = ? AND session_id = ?').get(req.params.itemId, sessionId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Cart item not found' });
    }
    db.prepare('DELETE FROM cart WHERE id = ?').run(req.params.itemId);
    const cart = getCartWithProducts(sessionId);
    res.json({ success: true, message: 'Item dihapus dari keranjang', data: cart });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/cart  (clear all)
router.delete('/', (req, res) => {
  try {
    db.prepare('DELETE FROM cart WHERE session_id = ?').run(getSessionId(req));
    res.json({ success: true, message: 'Keranjang dikosongkan', data: { items: [], subtotal: 0, shippingCost: 25000, total: 25000, count: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.getCartWithProducts = getCartWithProducts;
