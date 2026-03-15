// ============================================================
// 9CLO API — Products Routes
// GET  /api/products          (query: category, sort, search, limit)
// GET  /api/products/:id
// GET  /api/categories
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Helper: parse JSON fields safely
function parseProduct(row) {
  if (!row) return null;
  return {
    ...row,
    sizes: JSON.parse(row.sizes || '[]'),
    colors: JSON.parse(row.colors || '[]'),
    discount: row.original_price
      ? Math.round((1 - row.price / row.original_price) * 100)
      : null
  };
}

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { category, sort, search, limit = 100 } = req.query;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    switch (sort) {
      case 'price_asc':  sql += ' ORDER BY price ASC'; break;
      case 'price_desc': sql += ' ORDER BY price DESC'; break;
      case 'name_asc':   sql += ' ORDER BY name ASC'; break;
      case 'newest':
      default:           sql += ' ORDER BY id DESC'; break;
    }

    sql += ' LIMIT ?';
    params.push(Number(limit));

    const rows = db.prepare(sql).all(...params);
    const products = rows.map(parseProduct);

    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: parseProduct(row) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/categories  — distinct categories with counts
router.get('/meta/categories', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY category
    `).all();

    const total = db.prepare('SELECT COUNT(*) as count FROM products').get();

    res.json({
      success: true,
      data: [
        { category: 'all', label: 'Semua Produk', count: total.count },
        ...rows.map(r => ({
          category: r.category,
          label: r.category.charAt(0).toUpperCase() + r.category.slice(1),
          count: r.count
        }))
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
