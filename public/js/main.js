// ============================================
// 9CLO — Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initAnnouncement();
  initHeroSlider();
  initMobileMenu();
  initScrollReveal();
  initCartCount();
  initSearchOverlay();
  initWishlistButtons();
  initStickyHeader();
});

// --- Announcement Bar ---
function initAnnouncement() {
  const bar = document.querySelector('.announcement-bar');
  if (!bar) return;
  // Duplicate marquee content for seamless loop
  const marquee = bar.querySelector('.marquee');
  if (marquee) {
    const clone = marquee.innerHTML;
    marquee.innerHTML = clone + clone;
  }
}

// --- Hero Slider ---
function initHeroSlider() {
  const slider = document.querySelector('.hero-slider');
  if (!slider) return;

  const track = slider.querySelector('.slider-track');
  const slides = slider.querySelectorAll('.slide');
  const dots = slider.querySelectorAll('.slider-dot');
  const prevBtn = slider.querySelector('.slider-arrow.prev');
  const nextBtn = slider.querySelector('.slider-arrow.next');
  const progress = slider.querySelector('.slider-progress');

  let current = 0;
  let timer = null;
  const duration = 4500;

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
    resetProgress();
  }

  function resetProgress() {
    if (!progress) return;
    progress.classList.remove('animating');
    progress.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        progress.classList.add('animating');
      });
    });
  }

  function startAuto() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), duration);
  }

  prevBtn?.addEventListener('click', () => { goTo(current - 1); startAuto(); });
  nextBtn?.addEventListener('click', () => { goTo(current + 1); startAuto(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { goTo(i); startAuto(); }));

  // Touch swipe
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
    startAuto();
  });

  // Init
  slides[0]?.classList.add('active');
  dots[0]?.classList.add('active');
  resetProgress();
  startAuto();
}

// --- Mobile Menu ---
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('open');
    document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('active');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// --- Scroll Reveal ---
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => observer.observe(el));
}

// --- Cart Count (API-based) ---
function initCartCount() {
  fetchCartCount();
}

async function fetchCartCount() {
  try {
    const res = await fetch('/api/cart', { credentials: 'same-origin' });
    const json = await res.json();
    if (json.success) updateCartBadge(json.data.count);
  } catch {
    // Silently fail — not critical
  }
}

function updateCartBadge(count) {
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// Legacy shim (used by product-detail page)
async function addToCart(product) {
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, size: product.size || 'M', color: product.color || 'Black' }),
      credentials: 'same-origin'
    });
    const json = await res.json();
    if (json.success) {
      updateCartBadge(json.data.count);
      showCartToast(product.name);
    }
  } catch (err) {
    console.error('addToCart error:', err);
  }
}

function showCartToast(name) {
  const existing = document.querySelector('.cart-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'cart-toast';
  toast.innerHTML = `
    <span style="color:#00c851">✓</span>
    <span><strong>${name}</strong> ditambahkan ke keranjang</span>
    <a href="cart.html" style="color:var(--accent);font-weight:700;white-space:nowrap">Lihat Keranjang →</a>
  `;
  toast.style.cssText = `
    position:fixed; bottom:90px; right:24px; z-index:9999;
    background:var(--bg-surface); border:1px solid var(--border);
    border-left:3px solid var(--accent); border-radius:8px;
    padding:14px 18px; display:flex; align-items:center; gap:12px;
    font-size:0.85rem; box-shadow:var(--shadow-md); max-width:340px;
    animation: slideInToast 0.3s ease; color:var(--text-primary);
  `;

  if (!document.querySelector('#toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `@keyframes slideInToast { from { transform: translateX(120%); opacity:0;} to { transform: translateX(0); opacity:1; } }`;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- Search Overlay ---
function initSearchOverlay() {
  const trigger = document.querySelector('.search-trigger');
  const overlay = document.querySelector('.search-overlay');
  const closeBtn = overlay?.querySelector('.search-close');
  const input = overlay?.querySelector('.search-input');

  if (!trigger || !overlay) return;

  trigger.addEventListener('click', () => {
    overlay.classList.add('active');
    setTimeout(() => input?.focus(), 100);
  });

  closeBtn?.addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.classList.remove('active');
  });
}

// --- Wishlist Buttons ---
function initWishlistButtons() {
  document.querySelectorAll('.wishlist-btn, .wishlist-large').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.classList.toggle('loved');
      const icon = btn.querySelector('svg, span');
      if (btn.classList.contains('loved')) {
        btn.style.color = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
      } else {
        btn.style.color = '';
        btn.style.borderColor = '';
      }
    });
  });
}

// --- Sticky Header shadow ---
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.style.boxShadow = '0 4px 32px rgba(0,0,0,0.5)';
    } else {
      header.style.boxShadow = '';
    }
  }, { passive: true });
}

// Expose globally
window._9clo = { addToCart, updateCartBadge, showCartToast };
