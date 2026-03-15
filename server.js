// ============================================================
// 9CLO — Express Server (Fullstack Entry Point)
// ============================================================
require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const SqliteStore = require('connect-sqlite3')(session);

// Init DB + seed on startup
require('./database/db');
require('./database/seed');

// Routes
const productsRouter = require('./routes/products');
const cartRouter     = require('./routes/cart');
const ordersRouter   = require('./routes/orders');
const contactRouter  = require('./routes/contact');
const authRouter     = require('./routes/auth');
const adminRouter    = require('./routes/admin');
const paymentRouter  = require('./routes/payment');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── Security Headers ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "app.midtrans.com", "api.midtrans.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "api.midtrans.com"],
    }
  },
  crossOriginEmbedderPolicy: false
}));

// ── Compression ────────────────────────────────────────────
app.use(compression());

// ── CORS ───────────────────────────────────────────────────
app.use(cors({
  origin: isProd ? process.env.BASE_URL : true,
  credentials: true
}));

// ── Body Parsers ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rate Limiting ──────────────────────────────────────────
// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Terlalu banyak request, coba lagi nanti.' }
});

// Strict limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit.' }
});

// Contact form limit
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, error: 'Terlalu banyak pesan. Coba lagi dalam 1 jam.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/contact', contactLimiter);

// ── Session (Persistent SQLite Store) ─────────────────────
app.use(session({
  store: new SqliteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, 'database')
  }),
  secret: process.env.SESSION_SECRET || '9clo_secret_dev',
  resave: false,
  saveUninitialized: false,
  name: '9clo.sid',
  cookie: {
    secure: isProd,            // true in production (HTTPS)
    httpOnly: true,            // JS cannot access cookie
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    sameSite: isProd ? 'strict' : 'lax'
  }
}));

// ── Static Files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProd ? '7d' : 0,
  etag: true
}));

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart',     cartRouter);
app.use('/api/orders',   ordersRouter);
app.use('/api/contact',  contactRouter);
app.use('/api/admin',    adminRouter);
app.use('/api/payment',  paymentRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    app: '9clo API',
    version: '2.0.0',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// ── Error Handlers ─────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       9CLO — Fullstack v2.0              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  🌐  http://localhost:${PORT}                ║`);
  console.log(`║  🔌  API: /api                           ║`);
  console.log(`║  🔒  Admin: /admin                       ║`);
  console.log(`║  📦  Env: ${(process.env.NODE_ENV || 'development').padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
