// ============================================================
// 9CLO Database Seed — Insert initial product data
// ============================================================
const db = require('./db');

const products = [
  {
    name: 'Shadow Tee Vol.1',
    category: 'tees',
    price: 189000,
    original_price: null,
    description: 'Tee legendaris 9clo. Dibuat dari 100% cotton combed 30s premium dengan fit oversized yang sempurna. Detail sablon DTF tahan lama.',
    badge: 'New',
    stock: 80,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
    colors: JSON.stringify(['Black', 'Navy', 'Charcoal']),
    image: 'assets/images/product-tee.png'
  },
  {
    name: 'Cipher Oversized Tee',
    category: 'tees',
    price: 219000,
    original_price: 279000,
    description: 'Oversized tee dengan graphic premium. Material cotton spandex 24s, nyaman sepanjang hari.',
    badge: 'Sale',
    stock: 45,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
    colors: JSON.stringify(['Black', 'Brown']),
    image: 'assets/images/product-tee.png'
  },
  {
    name: 'Tactical Tee',
    category: 'tees',
    price: 169000,
    original_price: null,
    description: 'Tee dengan vibes tactical. Minimal branding, maximum impact.',
    badge: null,
    stock: 120,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
    colors: JSON.stringify(['Black']),
    image: 'assets/images/product-tee.png'
  },
  {
    name: 'Phantom Jacket',
    category: 'jackets',
    price: 689000,
    original_price: null,
    description: 'Bomber jacket premium. Material polyester ripstop water-resistant. Zipper YKK berkualitas tinggi. Essential piece untuk musim hujan.',
    badge: 'New',
    stock: 30,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
    colors: JSON.stringify(['Black', 'Olive']),
    image: 'assets/images/product-jacket.png'
  },
  {
    name: 'Void Bomber',
    category: 'jackets',
    price: 749000,
    original_price: null,
    description: 'Bomber jacket dengan detail tactical. Banyak pocket fungsional, lining premium.',
    badge: null,
    stock: 25,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
    colors: JSON.stringify(['Black']),
    image: 'assets/images/product-jacket.png'
  },
  {
    name: 'Rift Jacket',
    category: 'jackets',
    price: 599000,
    original_price: 799000,
    description: 'Jaket wajib di lemari kamu. Desain clean dengan detail zipper kontras.',
    badge: 'Sale',
    stock: 15,
    sizes: JSON.stringify(['S', 'M', 'L']),
    colors: JSON.stringify(['Black', 'Charcoal']),
    image: 'assets/images/product-jacket.png'
  },
  {
    name: 'Eclipse Hoodie',
    category: 'hoodies',
    price: 359000,
    original_price: null,
    description: 'Hoodie pullover premium 320gsm. Bahan tebal dan hangat, cocok untuk cuaca dingin. Fit oversized dengan pocket kangaroo.',
    badge: 'New',
    stock: 60,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
    colors: JSON.stringify(['Black', 'Charcoal', 'Navy']),
    image: 'assets/images/product-hoodie.png'
  },
  {
    name: 'Noir Crewneck',
    category: 'hoodies',
    price: 319000,
    original_price: null,
    description: 'Crewneck minimalis dengan warna solid. Perfect untuk layering atau daily wear.',
    badge: null,
    stock: 50,
    sizes: JSON.stringify(['M', 'L', 'XL']),
    colors: JSON.stringify(['Black', 'Brown']),
    image: 'assets/images/product-hoodie.png'
  },
  {
    name: 'Urban Hoodie',
    category: 'hoodies',
    price: 389000,
    original_price: null,
    description: 'Hoodie dengan desain streetwear modern. Graphic minimal di dada kiri.',
    badge: null,
    stock: 40,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
    colors: JSON.stringify(['Black']),
    image: 'assets/images/product-hoodie.png'
  },
  {
    name: 'Signal Cargo Pants',
    category: 'pants',
    price: 459000,
    original_price: null,
    description: 'Cargo pants tactical dengan 6 pocket fungsional. Material ripstop premium. Adjustable hem, cocok untuk segala aktivitas.',
    badge: 'New',
    stock: 35,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
    colors: JSON.stringify(['Black', 'Olive', 'Khaki']),
    image: 'assets/images/product-pants.png'
  },
  {
    name: 'Stealth Jogger',
    category: 'pants',
    price: 299000,
    original_price: 389000,
    description: 'Jogger pants super nyaman. Material cotton fleece lembut, elastic waist dengan drawstring.',
    badge: 'Sale',
    stock: 55,
    sizes: JSON.stringify(['S', 'M', 'L', 'XL', 'XXL']),
    colors: JSON.stringify(['Black', 'Charcoal']),
    image: 'assets/images/product-pants.png'
  },
  {
    name: 'Grid Cargo',
    category: 'pants',
    price: 499000,
    original_price: null,
    description: 'Wide-leg cargo pants dengan grid pattern subtle. Statement piece yang versatile.',
    badge: 'New',
    stock: 20,
    sizes: JSON.stringify(['M', 'L', 'XL']),
    colors: JSON.stringify(['Black']),
    image: 'assets/images/product-pants.png'
  }
];

function seed() {
  const count = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (count.count > 0) {
    console.log(`ℹ️  Products already seeded (${count.count} items). Skipping.`);
    return;
  }

  const insert = db.prepare(`
    INSERT INTO products (name, category, price, original_price, description, badge, stock, sizes, colors, image)
    VALUES (@name, @category, @price, @original_price, @description, @badge, @stock, @sizes, @colors, @image)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) insert.run(item);
  });

  insertMany(products);
  console.log(`✅ Seeded ${products.length} products into database.`);
}

seed();
module.exports = { seed };
