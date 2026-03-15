# 9clo — Premium Streetwear E-commerce

Website fullstack e-commerce brand 9clo, dibangun dengan Node.js + Express + SQLite.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Buat file .env dari template
cp .env.example .env
# Edit .env sesuai kebutuhan (minimal SESSION_SECRET & JWT_SECRET)

# 3. Buat akun admin pertama
node database/create-admin.js

# 4. Seed data produk
npm run seed

# 5. Jalankan server
npm run dev     # development (auto-restart)
npm start       # production
```

Server berjalan di `http://localhost:3000`

## 🔗 Halaman Utama

| Halaman | URL |
|---------|-----|
| Beranda | `/index.html` |
| Toko | `/shop.html` |
| Login | `/login.html` |
| Daftar | `/register.html` |
| Akun Saya | `/my-account.html` |
| Admin | `/admin/login.html` |
| Admin Dashboard | `/admin/` |

## 🗝️ API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET  /api/auth/me`
- `PUT  /api/auth/me` (update profil / ganti password)
- `GET  /api/auth/my-orders`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET  /api/auth/verify-email/:token`
- `GET/POST/DELETE /api/auth/addresses`

### Produk
- `GET /api/products` — list + filter + search
- `GET /api/products/:id`
- `GET /api/products/categories`

### Cart
- `GET/POST/PUT/DELETE /api/cart`

### Pesanan
- `POST /api/orders`
- `GET  /api/orders/:id`

### Payment
- `POST /api/payment/create-transaction`
- `POST /api/payment/webhook`
- `GET  /api/payment/status/:orderNumber`
- `POST /api/payment/validate-coupon`

### Admin (requires admin role)
- `GET  /api/admin/stats`
- `GET/POST/PUT/DELETE /api/admin/products`
- `POST /api/admin/products/:id/image`
- `GET  /api/admin/orders`
- `PUT  /api/admin/orders/:id/status`
- `GET  /api/admin/messages` + `PUT /api/admin/messages/:id/read`
- `GET  /api/admin/customers`
- `GET/POST/DELETE /api/admin/coupons`
- `GET  /api/admin/logs`

## 🔐 Environment Variables

Lihat `.env.example` untuk semua variabel yang dibutuhkan.

**Wajib:**
- `SESSION_SECRET` — random string panjang (min 32 karakter)
- `JWT_SECRET` — random string panjang

**Opsional:**
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- Midtrans: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`

## 🛠️ Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite (via better-sqlite3)
- **Auth:** bcryptjs + JWT + express-session
- **Email:** Nodemailer
- **Payment:** Midtrans Snap
- **Security:** helmet, express-rate-limit, compression
- **Upload:** multer

## 🚢 Deploy ke Railway

1. Push ke GitHub repository
2. Login di [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variables di Settings → Variables
4. Railway otomatis build dan deploy dari `npm start`

## 📁 Struktur Proyek

```
9clo/
├── server.js              # Entry point Express
├── database/
│   ├── db.js              # SQLite schema + migrations
│   ├── seed.js            # Data produk awal
│   └── create-admin.js    # Setup akun admin
├── middleware/
│   ├── auth.js            # requireAuth, requireAdmin
│   └── errorHandler.js
├── routes/
│   ├── auth.js            # Register, login, profil
│   ├── admin.js           # Admin CRUD
│   ├── payment.js         # Midtrans integration
│   ├── products.js        # Produk API
│   ├── cart.js            # Cart API
│   ├── orders.js          # Order API
│   └── contact.js         # Contact form
├── services/
│   └── email.js           # Nodemailer templates
└── public/                # Static frontend
    ├── index.html         # Beranda
    ├── shop.html          # Toko
    ├── login.html         # Login
    ├── register.html      # Daftar
    ├── my-account.html    # Dashboard user
    ├── payment-success.html
    ├── payment-failed.html
    ├── admin/
    │   ├── login.html
    │   └── index.html     # Admin dashboard
    ├── css/
    ├── js/
    └── assets/
```
