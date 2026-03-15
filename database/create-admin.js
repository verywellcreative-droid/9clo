// ============================================================
// 9CLO — Admin Seeder Script
// Run: node database/create-admin.js
// ============================================================
require('dotenv').config();
const bcrypt   = require('bcryptjs');
const Database = require('better-sqlite3');
const path     = require('path');
const readline = require('readline');

const db = new Database(path.join(__dirname, '9clo.db'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(res => rl.question(q, res));

async function main() {
  console.log('\n🔧  9clo — Create Admin Account\n' + '─'.repeat(40));

  const email    = process.env.ADMIN_EMAIL    || await ask('Admin email: ');
  const password = process.env.ADMIN_PASSWORD || await ask('Admin password (min 8 chars): ');
  const name     = await ask('Admin name [9clo Admin]: ') || '9clo Admin';

  if (password.length < 8) { console.error('❌ Password too short.'); process.exit(1); }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    // Update to admin if already exists
    db.prepare("UPDATE users SET role='admin' WHERE email=?").run(email.toLowerCase());
    console.log(`\n✅ User ${email} sudah diupdate menjadi admin.`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, email_verified)
      VALUES (?, ?, ?, 'admin', 1)
    `).run(name, email.toLowerCase(), hash);
    console.log(`\n✅ Admin account berhasil dibuat!`);
  }

  console.log(`   Email  : ${email}`);
  console.log(`   URL    : ${process.env.BASE_URL || 'http://localhost:3000'}/admin/login.html\n`);
  db.close();
  rl.close();
}

main().catch(e => { console.error(e); process.exit(1); });
