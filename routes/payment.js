// ============================================================
// 9CLO API — Payment Routes (Midtrans)
// POST /api/payment/create-transaction   — Create Midtrans Snap token
// POST /api/payment/webhook              — Midtrans payment notification
// GET  /api/payment/status/:orderNumber  — Check payment status
// POST /api/payment/validate-coupon      — Validate coupon code at checkout
// ============================================================
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { sendOrderConfirmation } = require('../services/email');

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const IS_PRODUCTION       = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_BASE_URL   = IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

// ── POST /api/payment/create-transaction ──────────────────
router.post('/create-transaction', optionalAuth, async (req, res) => {
  try {
    const { customerName, email, phone, address, notes, couponCode } = req.body;

    if (!customerName || !email || !address)
      return res.status(400).json({ success: false, error: 'Data pelanggan tidak lengkap.' });

    // Get cart items for this session
    const sessionId = req.session.id;
    const cartRows = db.prepare(`
      SELECT c.*, p.name, p.price, p.image FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.session_id = ?
    `).all(sessionId);

    if (cartRows.length === 0)
      return res.status(400).json({ success: false, error: 'Keranjang kosong.' });

    // Calculate totals
    let subtotal = cartRows.reduce((s, i) => s + i.price * i.qty, 0);
    let discount = 0;

    // Apply coupon
    if (couponCode) {
      const coupon = db.prepare(`
        SELECT * FROM coupons WHERE code = ? AND is_active = 1
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND uses < max_uses
      `).get(couponCode.toUpperCase());

      if (coupon && subtotal >= coupon.min_order) {
        discount = coupon.type === 'percent'
          ? Math.round(subtotal * coupon.value / 100)
          : coupon.value;
        db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ?').run(coupon.id);
      }
    }

    const shippingCost = (subtotal - discount) >= 300000 ? 0 : 25000;
    const total        = subtotal - discount + shippingCost;

    // Generate order number
    const datePart  = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const randPart  = Math.random().toString(36).toUpperCase().slice(2,6);
    const orderNumber = `9CLO-${datePart}-${randPart}`;

    const itemsForDb = cartRows.map(i => ({
      cartItemId: i.id,
      qty: i.qty,
      size: i.size,
      color: i.color,
      subtotal: i.price * i.qty,
      product: { id: i.product_id, name: i.name, price: i.price, image: i.image }
    }));

    // Insert order with status unpaid
    const orderResult = db.prepare(`
      INSERT INTO orders
       (order_number, session_id, user_id, customer_name, customer_email,
        customer_phone, customer_address, subtotal, shipping_cost, discount,
        total, coupon_code, payment_status, status, items, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'unpaid','pending',?,?)
    `).run(
      orderNumber, sessionId, req.user?.id || null,
      customerName, email, phone||null, address,
      subtotal, shippingCost, discount, total,
      couponCode || null,
      JSON.stringify(itemsForDb), notes || null
    );

    // If Midtrans is not configured, create order and return success directly
    if (!MIDTRANS_SERVER_KEY) {
      db.prepare('UPDATE orders SET payment_status = ?, status = ? WHERE id = ?')
        .run('paid', 'processing', orderResult.lastInsertRowid);
      db.prepare('DELETE FROM cart WHERE session_id = ?').run(sessionId);
      sendOrderConfirmation({ orderNumber, customerName, email, subtotal, shippingCost, total }, itemsForDb).catch(()=>{});
      return res.json({
        success: true, demoMode: true,
        message: 'Order berhasil (demo mode — Midtrans belum dikonfigurasi)',
        data: { orderNumber, total, status: 'processing' }
      });
    }

    // Create Midtrans Snap transaction
    const snapPayload = {
      transaction_details: {
        order_id: orderNumber,
        gross_amount: total
      },
      item_details: [
        ...cartRows.map(i => ({
          id: String(i.product_id),
          price: i.price,
          quantity: i.qty,
          name: i.name.substring(0, 50)
        })),
        ...(shippingCost > 0 ? [{ id: 'SHIPPING', price: shippingCost, quantity: 1, name: 'Ongkos Kirim' }] : []),
        ...(discount > 0    ? [{ id: 'DISCOUNT',  price: -discount,      quantity: 1, name: `Diskon ${couponCode}` }] : [])
      ],
      customer_details: {
        first_name: customerName,
        email,
        phone: phone || ''
      },
      callbacks: {
        finish:  `${process.env.BASE_URL}/payment-success.html`,
        error:   `${process.env.BASE_URL}/payment-failed.html`,
        pending: `${process.env.BASE_URL}/cart.html?pending=${orderNumber}`
      }
    };

    const mtRes = await fetch(`${MIDTRANS_BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify(snapPayload)
    });

    const mtData = await mtRes.json();
    if (!mtData.token)
      return res.status(502).json({ success: false, error: 'Gagal membuat transaksi Midtrans.', detail: mtData });

    // Save Midtrans token
    db.prepare('UPDATE orders SET payment_token = ? WHERE id = ?').run(mtData.token, orderResult.lastInsertRowid);

    res.json({
      success: true,
      data: {
        orderNumber, total, shippingCost, discount,
        snapToken: mtData.token,
        redirectUrl: mtData.redirect_url,
        clientKey: process.env.MIDTRANS_CLIENT_KEY
      }
    });

  } catch (err) {
    console.error('PAYMENT CREATE error:', err);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── POST /api/payment/webhook ─────────────────────────────
// Midtrans will POST to this endpoint when payment is completed
router.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  try {
    const notif = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Verify signature
    const signatureKey = crypto
      .createHash('sha512')
      .update(`${notif.order_id}${notif.status_code}${notif.gross_amount}${MIDTRANS_SERVER_KEY}`)
      .digest('hex');

    if (signatureKey !== notif.signature_key) {
      console.warn('⚠️  Invalid Midtrans signature for order', notif.order_id);
      return res.status(403).json({ success: false, error: 'Invalid signature.' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(notif.order_id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });

    let paymentStatus = 'unpaid';
    let orderStatus   = order.status;

    if (['capture', 'settlement'].includes(notif.transaction_status)) {
      paymentStatus = 'paid';
      orderStatus   = 'processing';
      // Clear cart
      db.prepare('DELETE FROM cart WHERE session_id = ?').run(order.session_id);
      // Send confirmation email
      const items = JSON.parse(order.items || '[]');
      sendOrderConfirmation({
        orderNumber: order.order_number,
        customerName: order.customer_name,
        email: order.customer_email,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        total: order.total
      }, items).catch(() => {});
    } else if (['cancel', 'expire', 'deny'].includes(notif.transaction_status)) {
      paymentStatus = 'failed';
      orderStatus   = 'cancelled';
    } else if (notif.transaction_status === 'pending') {
      paymentStatus = 'pending';
    }

    db.prepare('UPDATE orders SET payment_status = ?, payment_method = ?, status = ? WHERE order_number = ?')
      .run(paymentStatus, notif.payment_type || 'midtrans', orderStatus, notif.order_id);

    console.log(`💳 Payment webhook: ${notif.order_id} → ${paymentStatus}`);
    res.json({ success: true });

  } catch (err) {
    console.error('WEBHOOK error:', err);
    res.status(500).json({ success: false });
  }
});

// ── GET /api/payment/status/:orderNumber ──────────────────
router.get('/status/:orderNumber', (req, res) => {
  const order = db.prepare(`
    SELECT order_number, customer_name, total, status, payment_status, created_at
    FROM orders WHERE order_number = ?
  `).get(req.params.orderNumber);
  if (!order) return res.status(404).json({ success: false, error: 'Order tidak ditemukan.' });
  res.json({ success: true, data: order });
});

// ── POST /api/payment/validate-coupon ─────────────────────
router.post('/validate-coupon', (req, res) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = db.prepare(`
      SELECT * FROM coupons WHERE code = ? AND is_active = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND uses < max_uses
    `).get((code || '').toUpperCase());

    if (!coupon)
      return res.status(404).json({ success: false, error: 'Kode promo tidak valid atau sudah expired.' });
    if (subtotal < coupon.min_order)
      return res.status(400).json({ success: false, error: `Minimum order Rp${coupon.min_order.toLocaleString('id')} untuk kupon ini.` });

    const discount = coupon.type === 'percent'
      ? Math.round(subtotal * coupon.value / 100)
      : coupon.value;

    res.json({ success: true, data: { code: coupon.code, type: coupon.type, value: coupon.value, discount } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
