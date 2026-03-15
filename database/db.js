// ============================================================
// 9CLO Database — SQLite Connection & Schema Init
// ============================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(__dirname, '9clo.db'));

// WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────
db.exec(`
  -- Users (customers & admins)
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'customer',
    email_verified INTEGER DEFAULT 0,
    verify_token TEXT,
    reset_token TEXT,
    reset_expires DATETIME,
    phone TEXT,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Saved shipping addresses per user
  CREATE TABLE IF NOT EXISTS user_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT DEFAULT 'Rumah',
    recipient_name TEXT NOT NULL,
    phone TEXT,
    address TEXT NOT NULL,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Products
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    original_price INTEGER,
    description TEXT,
    badge TEXT,
    stock INTEGER DEFAULT 100,
    sizes TEXT DEFAULT '["S","M","L","XL"]',
    colors TEXT DEFAULT '["Black"]',
    image TEXT DEFAULT 'assets/images/product-tee.png',
    images TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Product Reviews
  CREATE TABLE IF NOT EXISTS product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Cart (session-based, can also link to user)
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_id INTEGER,
    product_id INTEGER NOT NULL,
    size TEXT DEFAULT 'M',
    color TEXT DEFAULT 'Black',
    qty INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Orders
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    session_id TEXT,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    shipping_cost INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    total INTEGER NOT NULL,
    coupon_code TEXT,
    payment_method TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    payment_token TEXT,
    status TEXT DEFAULT 'pending',
    items TEXT NOT NULL,
    notes TEXT,
    shipped_at DATETIME,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  -- Contact Messages
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    replied_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Coupons / Discount Codes
  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'percent',
    value INTEGER NOT NULL,
    min_order INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT 100,
    uses INTEGER DEFAULT 0,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Admin Activity Logs
  CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id INTEGER,
    detail TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Basic indices (columns guaranteed to exist on first run)
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_cart_session ON cart(session_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
`);

console.log('✅ Database connected: database/9clo.db');

// ── Migrations — safely add new columns ───────────────────
// SQLite throws if you try to ADD COLUMN that already exists,
// so we catch and ignore those errors.
const migrations = [
  // products: new columns
  `ALTER TABLE products ADD COLUMN slug TEXT`,
  `ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]'`,
  `ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1`,
  `ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0`,
  // cart: link to user
  `ALTER TABLE cart ADD COLUMN user_id INTEGER`,
  // orders: new payment + user columns
  `ALTER TABLE orders ADD COLUMN user_id INTEGER`,
  `ALTER TABLE orders ADD COLUMN discount INTEGER DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN coupon_code TEXT`,
  `ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'pending'`,
  `ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`,
  `ALTER TABLE orders ADD COLUMN payment_token TEXT`,
  `ALTER TABLE orders ADD COLUMN shipped_at DATETIME`,
  `ALTER TABLE orders ADD COLUMN delivered_at DATETIME`,
  // contact: read tracking
  `ALTER TABLE contact_messages ADD COLUMN is_read INTEGER DEFAULT 0`,
  `ALTER TABLE contact_messages ADD COLUMN replied_at DATETIME`,
  // indices (ignore if exist via IF NOT EXISTS)
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_status)`,
];

for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* column/index already exists — skip */ }
}

module.exports = db;

