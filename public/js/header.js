// ============================================================
// 9CLO — Premium Header JavaScript
// ============================================================

(function () {
  'use strict';

  // ── Announcement Bar ──────────────────────────────────────
  function initAnnouncement() {
    const bar = document.querySelector('.announcement-bar');
    if (!bar) return;

    const closeBtn = bar.querySelector('.ann-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        bar.style.height = bar.offsetHeight + 'px';
        requestAnimationFrame(() => {
          bar.style.transition = 'height 0.4s ease, opacity 0.3s ease';
          bar.style.height = '0';
          bar.style.opacity = '0';
          bar.style.overflow = 'hidden';
        });
        setTimeout(updateMegaMenuTop, 450);
        sessionStorage.setItem('9clo_ann_closed', '1');
      });
    }

    if (sessionStorage.getItem('9clo_ann_closed')) {
      bar.style.display = 'none';
    }
  }

  // ── Sticky Header ─────────────────────────────────────────
  function initStickyHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 60);
      updateMegaMenuTop();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mega Menu top position ────────────────────────────────
  function updateMegaMenuTop() {
    const header = document.querySelector('.site-header');
    const ann    = document.querySelector('.announcement-bar');
    if (!header) return;
    const top = (ann && ann.offsetHeight > 0 ? ann.offsetHeight : 0) + header.offsetHeight;
    document.querySelectorAll('.mega-menu').forEach(m => {
      m.style.top = top + 'px';
      // Also update the ::after bridge top so it sits just above the mega-menu
      m.closest('.nav-item')?.style.setProperty('--bridge-top', (top - 20) + 'px');
    });
  }

  window.addEventListener('resize', updateMegaMenuTop, { passive: true });

  // ── Mega Menu — JS hover with delay ──────────────────────
  //
  // ROOT CAUSE: Pure CSS :hover loses state when cursor crosses
  // the tiny gap between header bottom and the fixed mega-menu top.
  //
  // FIX: Use mouseenter/mouseleave on BOTH the .nav-item trigger
  // AND the .mega-menu panel, with a 150ms delayed close timer.
  // The timer is cancelled if the cursor enters the mega-menu
  // before it fires — so the menu stays open during transit.
  //
  function initMegaMenu() {
    const navItems = document.querySelectorAll('.header-nav .nav-item');
    let closeTimer = null;

    navItems.forEach(item => {
      const mega = item.querySelector('.mega-menu');
      if (!mega) return;

      // Mark for CSS bridge pseudo-element
      item.classList.add('has-mega');

      function openMenu() {
        clearTimeout(closeTimer);
        // Close other open menus
        navItems.forEach(other => {
          if (other !== item) other.classList.remove('open');
        });
        item.classList.add('open');
        updateMegaMenuTop();
      }

      function scheduleClose() {
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
          item.classList.remove('open');
        }, 150); // 150ms grace window — cursor can cross gap in time
      }

      // ① Mouse enters the nav-item trigger
      item.addEventListener('mouseenter', openMenu);
      // ② Mouse leaves the nav-item trigger → start close timer
      item.addEventListener('mouseleave', scheduleClose);

      // ③ Mouse enters the mega panel → cancel close timer!
      mega.addEventListener('mouseenter', () => clearTimeout(closeTimer));
      // ④ Mouse leaves the mega panel → schedule close
      mega.addEventListener('mouseleave', scheduleClose);
    });

    // Close when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('.site-header') && !e.target.closest('.mega-menu')) {
        clearTimeout(closeTimer);
        navItems.forEach(i => i.classList.remove('open'));
      }
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        clearTimeout(closeTimer);
        navItems.forEach(i => i.classList.remove('open'));
      }
    });
  }

  // ── Mobile Drawer ─────────────────────────────────────────
  function initMobileDrawer() {
    const hamburger = document.querySelector('.hamburger');
    const drawer    = document.querySelector('.mobile-drawer');
    const overlay   = document.querySelector('.mobile-drawer-overlay');
    const closeBtn  = drawer?.querySelector('.mobile-drawer-close');
    if (!hamburger || !drawer) return;

    function openDrawer() {
      drawer.classList.add('open');
      overlay?.classList.add('open');
      document.body.style.overflow = 'hidden';
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      overlay?.classList.remove('open');
      document.body.style.overflow = '';
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    }

    hamburger.addEventListener('click', () =>
      drawer.classList.contains('open') ? closeDrawer() : openDrawer()
    );
    closeBtn?.addEventListener('click', closeDrawer);
    overlay?.addEventListener('click', closeDrawer);

    // Accordion sub-menus inside drawer
    drawer.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item   = btn.closest('.mobile-nav-item');
        const isOpen = item.classList.contains('open');
        drawer.querySelectorAll('.mobile-nav-item.open').forEach(el => el.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });

    // Close on nav link click
    drawer.querySelectorAll('a').forEach(link => link.addEventListener('click', closeDrawer));

    // Swipe left to close
    let touchStartX = 0;
    drawer.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    drawer.addEventListener('touchend', e => {
      if (touchStartX - e.changedTouches[0].clientX > 60) closeDrawer();
    });
  }

  // ── Search Overlay ────────────────────────────────────────
  function initSearch() {
    const overlay  = document.querySelector('.search-overlay');
    const triggers = document.querySelectorAll('.search-trigger-btn, .search-trigger');
    const closeBtn = overlay?.querySelector('.search-close-btn, .search-close');
    const input    = overlay?.querySelector('input');
    if (!overlay || !triggers.length) return;

    function openSearch() {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input?.focus(), 150);
    }

    function closeSearch() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    triggers.forEach(t => t.addEventListener('click', openSearch));
    closeBtn?.addEventListener('click', closeSearch);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearch();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    });

    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && input.value.trim()) {
          window.location.href = `/shop.html?search=${encodeURIComponent(input.value.trim())}`;
        }
      });
    }
  }

  // ── Cart Count ───────────────────────────────────────────
  async function initCartCount() {
    try {
      const res  = await fetch('/api/cart', { credentials: 'same-origin' });
      const json = await res.json();
      if (json.success) updateCartBadge(json.data.count);
    } catch (e) { /* silent fail */ }
  }

  function updateCartBadge(count) {
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = count;
      el.classList.toggle('show', count > 0);
    });
    // Legacy class support
    document.querySelectorAll('.cart-count').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  function showCartToast(name) {
    document.querySelector('.cart-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.innerHTML = `
      <span style="color:#00c851;font-size:1.1rem">✓</span>
      <span><strong>${name}</strong> ditambahkan ke keranjang</span>
      <a href="/cart.html" style="color:var(--accent);font-weight:700;white-space:nowrap;margin-left:4px">Lihat →</a>
    `;
    toast.style.cssText = `
      position:fixed;bottom:90px;right:24px;z-index:9999;
      background:var(--bg-surface);border:1px solid var(--border);
      border-left:3px solid var(--accent);border-radius:8px;
      padding:14px 18px;display:flex;align-items:center;gap:10px;
      font-size:0.83rem;box-shadow:0 8px 32px rgba(0,0,0,0.6);max-width:320px;
      animation:toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;color:var(--text-primary);
    `;
    if (!document.querySelector('#toast-kf')) {
      const s = document.createElement('style');
      s.id = 'toast-kf';
      s.textContent = '@keyframes toastIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastIn 0.25s ease reverse';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // ── Auth State in Header ──────────────────────────────────
  async function initAuth() {
    try {
      const res  = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const json = await res.json();

      const loginBtn    = document.getElementById('h-login-btn');
      const userMenu    = document.getElementById('h-user-menu');
      const avatarEl    = document.getElementById('h-avatar-initial');
      const nameEl      = document.getElementById('h-dropdown-name');
      const emailEl     = document.getElementById('h-dropdown-email');
      const adminLink   = document.getElementById('h-admin-link');
      const logoutBtn   = document.getElementById('h-logout-btn');

      // Mobile drawer auth elements
      const mLoginItem   = document.getElementById('m-login-item');
      const mAccountItem = document.getElementById('m-account-item');
      const mAccountName = document.getElementById('m-account-name');
      const mAdminItem   = document.getElementById('m-admin-item');

      if (json.success) {
        const user = json.data;
        // Switch to logged-in state
        loginBtn?.style && (loginBtn.style.display = 'none');
        if (userMenu) userMenu.style.display = 'block';
        if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
        if (nameEl)   nameEl.textContent   = user.name;
        if (emailEl)  emailEl.textContent  = user.email;
        if (adminLink && user.role === 'admin') adminLink.style.display = 'flex';

        // Mobile drawer
        if (mLoginItem)  mLoginItem.style.display   = 'none';
        if (mAccountItem) {
          mAccountItem.style.display = 'block';
          if (mAccountName) mAccountName.textContent = `👤 ${user.name.split(' ')[0]}`;
        }
        if (mAdminItem && user.role === 'admin') mAdminItem.style.display = 'block';

        // Logout
        logoutBtn?.addEventListener('click', async () => {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
          window.location.reload();
        });

        // Toggle dropdown on avatar click (fallback for touch devices)
        document.getElementById('h-avatar-btn')?.addEventListener('click', () => {
          document.getElementById('h-user-menu')?.classList.toggle('open');
        });

      } else {
        // Not logged in — keep login icon visible
        if (mAccountItem) mAccountItem.style.display = 'none';
        if (mAdminItem)   mAdminItem.style.display   = 'none';
      }
    } catch (e) { /* silently skip if API unavailable */ }
  }

  // ── Active Nav Highlight ──────────────────────────────────
  function setActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.header-nav .nav-item').forEach(item => {
      const link = item.querySelector(':scope > a');
      if (link?.getAttribute('href')?.includes(path)) item.classList.add('active');
    });
  }

  // ── DOM Ready ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initAnnouncement();
    initStickyHeader();
    initMegaMenu();      // JS-controlled hover — fixes hover gap bug
    initMobileDrawer();
    initSearch();
    initCartCount();
    initAuth();          // Show login/avatar based on session state
    setActiveNav();
    updateMegaMenuTop(); // Set correct top position immediately
  });

  // ── Global Exports ────────────────────────────────────────
  window._9clo = window._9clo || {};
  Object.assign(window._9clo, { updateCartBadge, showCartToast, updateMegaMenuTop });

})();
