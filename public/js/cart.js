// ============================================================
// 9CLO — Cart Page (API-powered)
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  renderCart();
});

function formatPrice(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

async function renderCart() {
  const list = document.getElementById('cart-items');
  const emptyState = document.getElementById('empty-cart');
  const cartContent = document.getElementById('cart-content');
  if (!list) return;

  // Show loading
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Memuat keranjang...</div>';

  try {
    const res = await fetch('/api/cart', { credentials: 'same-origin' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    const { items, subtotal, shippingCost, total, count } = json.data;

    // Update badge
    window._9clo?.updateCartBadge(count);

    if (items.length === 0) {
      emptyState && (emptyState.style.display = 'flex');
      cartContent && (cartContent.style.display = 'none');
      return;
    }

    emptyState && (emptyState.style.display = 'none');
    cartContent && (cartContent.style.display = 'grid');

    list.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item-img">
          <img src="${item.product.image || 'assets/images/product-tee.png'}" alt="${item.product.name}">
        </div>
        <div class="cart-item-info">
          <a href="product-detail.html?id=${item.product.id}" class="item-name" style="color:var(--text-primary)">${item.product.name}</a>
          <div class="item-meta">Size: ${item.size} &nbsp;|&nbsp; Color: ${item.color} &nbsp;|&nbsp; Stok: ${item.product.stock}</div>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeQty(${item.cartItemId}, ${item.qty - 1})">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty(${item.cartItemId}, ${item.qty + 1})">+</button>
          </div>
        </div>
        <div class="flex-col" style="align-items:flex-end;gap:8px">
          <div class="cart-item-price">${formatPrice(item.subtotal)}</div>
          <button onclick="removeItem(${item.cartItemId})" style="font-size:0.78rem;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:4px 0;transition:color 0.2s" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-muted)'">Hapus</button>
        </div>
      </div>
    `).join('');

    renderSummary({ subtotal, shippingCost, total });

  } catch (err) {
    console.error('Render cart error:', err);
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Gagal memuat keranjang. Coba refresh.</div>';
  }
}

function renderSummary({ subtotal, shippingCost, total }) {
  const el = document.getElementById('order-summary-content');
  if (!el) return;
  el.innerHTML = `
    <div class="summary-row"><span class="label">Subtotal</span><span class="value">${formatPrice(subtotal)}</span></div>
    <div class="summary-row"><span class="label">Ongkos Kirim</span><span class="value">${shippingCost === 0 ? '<span style="color:#00c851">GRATIS</span>' : formatPrice(shippingCost)}</span></div>
    ${shippingCost > 0 ? `<div style="font-size:0.75rem;color:var(--text-muted);padding:4px 0">Belanja ${formatPrice(300000 - subtotal)} lagi untuk gratis ongkir</div>` : ''}
    <div class="summary-row total"><span class="label">Total</span><span class="value">${formatPrice(total)}</span></div>
    <button class="btn btn-primary" style="width:100%;margin-top:16px;padding:18px;font-size:0.9rem" onclick="showCheckoutForm()">Lanjut ke Checkout →</button>
    <a href="/shop.html" class="btn btn-secondary" style="width:100%;margin-top:8px;justify-content:center">Lanjut Belanja</a>
  `;
}

async function changeQty(cartItemId, newQty) {
  if (newQty < 1) {
    return removeItem(cartItemId);
  }
  try {
    await fetch(`/api/cart/${cartItemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: newQty }),
      credentials: 'same-origin'
    });
    renderCart();
  } catch (err) {
    console.error(err);
  }
}

async function removeItem(cartItemId) {
  try {
    await fetch(`/api/cart/${cartItemId}`, { method: 'DELETE', credentials: 'same-origin' });
    renderCart();
  } catch (err) {
    console.error(err);
  }
}

function showCheckoutForm() {
  const existing = document.getElementById('checkout-modal');
  if (existing) return existing.style.display = 'flex';

  const modal = document.createElement('div');
  modal.id = 'checkout-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);';
  modal.innerHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:36px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;">
      <h2 style="margin-bottom:24px">Checkout</h2>
      <form id="checkout-form" style="display:flex;flex-direction:column;gap:14px;">
        <div><label style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-secondary);display:block;margin-bottom:6px;">Nama Lengkap *</label>
        <input name="customerName" required placeholder="Nama kamu" style="width:100%;padding:13px 16px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:6px;color:var(--white);font-family:var(--font-main);font-size:0.88rem;outline:none;"></div>
        <div><label style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-secondary);display:block;margin-bottom:6px;">Email *</label>
        <input name="email" type="email" required placeholder="email@kamu.com" style="width:100%;padding:13px 16px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:6px;color:var(--white);font-family:var(--font-main);font-size:0.88rem;outline:none;"></div>
        <div><label style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-secondary);display:block;margin-bottom:6px;">No. WhatsApp</label>
        <input name="phone" placeholder="+62 812 xxxx xxxx" style="width:100%;padding:13px 16px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:6px;color:var(--white);font-family:var(--font-main);font-size:0.88rem;outline:none;"></div>
        <div><label style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-secondary);display:block;margin-bottom:6px;">Alamat Pengiriman *</label>
        <textarea name="address" required rows="3" placeholder="Jl. xxxx No. xx, Kota, Kode Pos" style="width:100%;padding:13px 16px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:6px;color:var(--white);font-family:var(--font-main);font-size:0.88rem;outline:none;resize:vertical;"></textarea></div>
        <div><label style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-secondary);display:block;margin-bottom:6px;">Catatan</label>
        <input name="notes" placeholder="Catatan untuk penjual (opsional)" style="width:100%;padding:13px 16px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:6px;color:var(--white);font-family:var(--font-main);font-size:0.88rem;outline:none;"></div>
        <div style="display:flex;gap:10px;margin-top:8px;">
          <button type="button" onclick="document.getElementById('checkout-modal').style.display='none'" class="btn btn-secondary" style="flex:1;padding:16px;">Batal</button>
          <button type="submit" class="btn btn-primary" style="flex:1;padding:16px;" id="submit-order-btn">Pesan Sekarang →</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    const data = Object.fromEntries(new FormData(e.target));
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'same-origin'
      });
      const json = await res.json();

      if (!json.success) {
        btn.disabled = false;
        btn.textContent = 'Pesan Sekarang →';
        alert('Error: ' + json.error);
        return;
      }

      modal.innerHTML = `
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:48px 36px;text-align:center;max-width:480px;width:100%">
          <div style="font-size:3.5rem;margin-bottom:16px">✅</div>
          <h2 style="margin-bottom:12px">Pesanan Diterima!</h2>
          <p style="margin-bottom:24px">Terima kasih, <strong style="color:var(--white)">${json.data.customerName}</strong>. Konfirmasi dikirim ke <strong style="color:var(--accent)">${json.data.email}</strong></p>
          <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:16px 20px;margin-bottom:24px;text-align:left;">
            <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Order Number</div>
            <div style="font-size:1.2rem;font-weight:800;color:var(--accent)">${json.data.orderNumber}</div>
          </div>
          <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:24px">Tim 9clo akan menghubungi kamu via WhatsApp untuk konfirmasi pembayaran.</p>
          <a href="/index.html" class="btn btn-primary" style="display:inline-flex;">Kembali ke Home</a>
        </div>
      `;
      renderCart();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Pesan Sekarang →';
      alert('Gagal membuat pesanan. Coba lagi.');
    }
  });
}

window.changeQty = changeQty;
window.removeItem = removeItem;
window.showCheckoutForm = showCheckoutForm;
