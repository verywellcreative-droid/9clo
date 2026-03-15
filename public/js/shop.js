// ============================================================
// 9CLO — Shop Page (API-powered)
// ============================================================

let allProducts = [];
let activeCategory = 'all';
let activeSort = 'newest';

document.addEventListener('DOMContentLoaded', async () => {
  // Handle category from URL param
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get('cat');
  if (catParam) {
    activeCategory = catParam;
    const radio = document.querySelector(`input[name="category"][value="${catParam}"]`);
    if (radio) radio.checked = true;
  }

  await loadCategories();
  await loadProducts();
  initFilters();
});

async function loadCategories() {
  try {
    const res = await fetch('/api/products/meta/categories');
    const json = await res.json();
    if (!json.success) return;

    // Update category filter counts dynamically
    json.data.forEach(cat => {
      const countEl = document.querySelector(`.count-${cat.category}`);
      if (countEl) countEl.textContent = cat.count;
    });
  } catch (err) {
    console.warn('Could not load categories:', err);
  }
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  // Show skeleton
  grid.innerHTML = Array(8).fill('<div class="product-card" style="aspect-ratio:3/4;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border);overflow:hidden;"><div class="skeleton" style="height:100%"></div></div>').join('');

  try {
    const url = new URL('/api/products', window.location.origin);
    if (activeCategory !== 'all') url.searchParams.set('category', activeCategory);
    url.searchParams.set('sort', activeSort);

    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    allProducts = json.data;

    const resultCount = document.getElementById('result-count');
    if (resultCount) resultCount.textContent = `${allProducts.length} produk`;

    if (allProducts.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text-muted)"><div style="font-size:3rem;margin-bottom:12px">🔍</div><p>Tidak ada produk ditemukan.</p><a href="/shop.html" class="btn btn-secondary" style="margin-top:16px">Reset Filter</a></div>`;
      return;
    }

    grid.innerHTML = allProducts.map(p => productCardHTML(p)).join('');
    initCardEvents(grid);
    initScrollReveal();
  } catch (err) {
    console.error('Failed to load products:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted)"><p>Gagal memuat produk. Coba refresh halaman.</p></div>`;
  }
}

function initFilters() {
  document.querySelectorAll('input[name="category"]').forEach(input => {
    input.addEventListener('change', async () => {
      activeCategory = input.value;
      await loadProducts();
    });
  });

  const sortSel = document.getElementById('sort-select');
  if (sortSel) {
    sortSel.addEventListener('change', async () => {
      activeSort = sortSel.value;
      await loadProducts();
    });
  }
}

function initCardEvents(grid) {
  grid.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      btn.classList.toggle('loved');
      btn.style.color = btn.classList.contains('loved') ? 'var(--accent)' : '';
    });
  });

  grid.querySelectorAll('.add-cart-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const productId = parseInt(btn.dataset.id);
      const product = allProducts.find(p => p.id === productId);
      if (!product) return;

      btn.disabled = true;
      btn.textContent = '...';

      try {
        await apiAddToCart(productId, product.sizes?.[0] || 'M', 'Black');
        btn.textContent = '✓ Ditambahkan';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '+ Keranjang';
        }, 2000);
      } catch {
        btn.disabled = false;
        btn.textContent = '+ Keranjang';
      }
    });
  });
}

function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal:not(.visible)');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  reveals.forEach(el => obs.observe(el));
}

function productCardHTML(p) {
  const discount = p.discount;
  const imgSrc = p.image || 'assets/images/product-tee.png';
  return `
  <div class="product-card reveal">
    <div class="product-card-img">
      <img src="${imgSrc}" alt="${p.name}" loading="lazy">
      <div class="product-card-badges">
        ${p.badge ? `<span class="badge badge-${p.badge === 'Sale' ? 'sale' : 'new'}">${p.badge}</span>` : ''}
      </div>
      <button class="wishlist-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <div class="product-card-actions">
        <button class="btn btn-primary btn-sm add-cart-btn" data-id="${p.id}">+ Keranjang</button>
      </div>
    </div>
    <a href="product-detail.html?id=${p.id}" class="product-card-info" style="display:block;text-decoration:none;">
      <div class="category">${p.category}</div>
      <h4>${p.name}</h4>
      <div class="product-price">
        <span class="price-current">Rp ${p.price.toLocaleString('id-ID')}</span>
        ${p.original_price ? `<span class="price-original">Rp ${p.original_price.toLocaleString('id-ID')}</span>` : ''}
        ${discount ? `<span class="price-discount">-${discount}%</span>` : ''}
      </div>
    </a>
  </div>`;
}

// Shared API cart function (reused by main.js)
async function apiAddToCart(productId, size = 'M', color = 'Black') {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, size, color }),
    credentials: 'same-origin'
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  window._9clo?.updateCartBadge(json.data.count);
  window._9clo?.showCartToast?.(json.data.items?.slice(-1)[0]?.product?.name || 'Produk');
  return json.data;
}

window.PRODUCTS = [];
window.productCardHTML = productCardHTML;
window.apiAddToCart = apiAddToCart;
