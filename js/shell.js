/* Qafila shared shell — sidebar toggle, clock, live status, logout */

(function () {
  if (!getToken()) {
    const inPages = location.pathname.includes('/pages/');
    location.href = inPages ? '../login.html' : 'login.html';
    return;
  }

  /* ---------- Sidebar toggle (mobile) ---------- */
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebar-toggle');

  if (sidebar && toggle) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
  }

  if (sidebar) {
    sidebar.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          sidebar.classList.remove('open');
        }
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (window.innerWidth > 900) return;
    if (!sidebar) return;
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target)) return;
    if (toggle && toggle.contains(e.target)) return;
    sidebar.classList.remove('open');
  });

  /* ---------- Manager name + logout ---------- */
  const managerNameEl = document.getElementById('manager-name');
  const logoutBtn     = document.getElementById('logout-btn');

  function decodeToken() {
    try {
      const t = getToken();
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1]));
    } catch (_) { return null; }
  }

  if (managerNameEl) {
    const payload = decodeToken();
    managerNameEl.textContent = payload && payload.name ? payload.name : '—';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearToken();
      const inPages = location.pathname.includes('/pages/');
      location.href = inPages ? '../login.html' : 'login.html';
    });
  }

  /* ---------- Live clock ---------- */
  const heroTime = document.getElementById('hero-time');
  const heroDate = document.getElementById('hero-date');

  if (heroTime) {
    setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      heroTime.textContent = `${hh}:${mm}:${ss}`;
    }, 1000);
  }

  if (heroDate) {
    const now = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    heroDate.textContent =
      `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  /* ---------- Socket + sidebar live dot ---------- */
  const dot   = document.getElementById('sidebar-live-dot');
  const text  = document.getElementById('sidebar-live-text');
  const strip = document.getElementById('top-strip');

  if (typeof io !== 'undefined') {
    const socket = io(API_BASE);

    socket.on('connect', () => {
      if (dot)  dot.className = 'sidebar-live-dot ok';
      if (text) text.textContent = 'Cloud connected';
    });

    socket.on('disconnect', () => {
      if (dot)  dot.className = 'sidebar-live-dot crit';
      if (text) text.textContent = 'Cloud offline';
    });

    socket.on('alert', (alert) => {
      if (window.QafilaPopup) window.QafilaPopup.show(alert);
    });
  }
})();