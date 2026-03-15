// ============================================================
// 9CLO — Auth & Admin Middleware
// ============================================================
const jwt = require('jsonwebtoken');
const db  = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || '9clo_jwt_dev_secret';

// ── Generate JWT ──────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// ── Verify JWT from cookie or Authorization header ────────
function extractToken(req) {
  if (req.session?.userId) return null; // session-based, no JWT needed
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.cookies?.token || null;
}

// ── requireAuth — must be logged in ──────────────────────
function requireAuth(req, res, next) {
  // 1. Check session (primary method)
  if (req.session?.userId) {
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // 2. Check JWT header (for API clients)
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (e) { /* invalid token */ }
  }

  return res.status(401).json({ success: false, error: 'Kamu harus login terlebih dahulu.' });
}

// ── requireAdmin — must be admin role ────────────────────
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role === 'admin') return next();
    return res.status(403).json({ success: false, error: 'Akses ditolak. Hanya admin.' });
  });
}

// ── optionalAuth — attach user if logged in but don't block ──
function optionalAuth(req, res, next) {
  if (req.session?.userId) {
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
    if (user) req.user = user;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth, signToken };
