/* Qafila dashboard — read-only fleet status */

(function () {
  if (!getToken()) {
    location.href = 'login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const topStrip        = document.getElementById('top-strip');

  const sidebar         = document.getElementById('sidebar');
  const sidebarToggle   = document.getElementById('sidebar-toggle');
  const sidebarLiveDot  = document.getElementById('sidebar-live-dot');
  const sidebarLiveText = document.getElementById('sidebar-live-text');

  const managerNameEl   = document.getElementById('manager-name');
  const logoutBtn       = document.getElementById('logout-btn');

  const heroTime        = document.getElementById('hero-time');
  const heroDate        = document.getElementById('hero-date');
  const heroPill        = document.getElementById('hero-pill');
  const heroPillText    = document.getElementById('hero-pill-text');

  const metricShifts    = document.getElementById('metric-shifts');
  const metricDrivers   = document.getElementById('metric-drivers');
  const metricVehicles  = document.getElementById('metric-vehicles');
  const metricCrit      = document.getElementById('metric-crit');
  const metricWarn      = document.getElementById('metric-warn');

  const alertsList      = document.getElementById('alerts-list');
  const alertsCount     = document.getElementById('alerts-count');

  const predictionsList = document.getElementById('predictions-list');
  const predictionsCount= document.getElementById('predictions-count');

  const reportsList     = document.getElementById('reports-list');

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function timeAgo(ts) {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts + 'Z');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }

  /* ============================================================
     Mobile sidebar toggle
     ============================================================ */

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  /* ============================================================
     Live clock
     ============================================================ */

  function tickClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    heroTime.textContent = `${hh}:${mm}:${ss}`;

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    heroDate.textContent =
      `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  tickClock();
  setInterval(tickClock, 1000);

  /* ============================================================
     Sidebar live status
     ============================================================ */

  function setSidebarStatus(level, text) {
    sidebarLiveDot.className = 'sidebar-live-dot ' + level;
    sidebarLiveText.textContent = text;
  }

  /* ============================================================
     Status pill + top strip
     ============================================================ */

  function updateHeroPill(worst) {
    heroPill.className = `hero-pill ${worst}`;
    if (worst === 'crit')      heroPillText.textContent = 'Critical active';
    else if (worst === 'warn') heroPillText.textContent = 'Warning active';
    else                       heroPillText.textContent = 'All systems normal';

    topStrip.className = 'top-strip ' + worst;
  }

  /* ============================================================
     Socket
     ============================================================ */

  const socket = io(API_BASE);

  socket.on('connect', () => {
    setSidebarStatus('ok', 'Cloud connected');
  });

  socket.on('disconnect', () => {
    setSidebarStatus('crit', 'Cloud offline');
  });

  socket.on('alert', (alert) => {
    if (window.QafilaPopup) window.QafilaPopup.show(alert);
    loadAlerts();
  });

  /* ============================================================
     Metrics
     ============================================================ */

  async function loadMetrics() {
    try {
      const [shifts, drivers, vehicles] = await Promise.all([
        apiFetch('/api/shifts/active'),
        apiFetch('/api/drivers'),
        apiFetch('/api/vehicles')
      ]);

      metricShifts.textContent   = Array.isArray(shifts)   ? shifts.length   : 0;
      metricDrivers.textContent  = Array.isArray(drivers)  ? drivers.length  : 0;
      metricVehicles.textContent = Array.isArray(vehicles) ? vehicles.length : 0;
    } catch (err) {
      console.error('[dashboard] loadMetrics failed:', err.message);
    }
  }

  /* ============================================================
     Emergency alerts
     ============================================================ */

  async function loadAlerts() {
    try {
      const data = await apiFetch('/api/alerts/live');
      alertsList.innerHTML = '';

      if (!data || data.length === 0) {
        alertsCount.textContent = '0';

        const soft = el('div', 'empty-soft');
        soft.appendChild(el('div', 'empty-soft-title', 'All clear'));
        soft.appendChild(el('div', 'empty-soft-sub',
          'No active alerts across the fleet.'));
        alertsList.appendChild(soft);

        metricCrit.textContent = '0';
        metricWarn.textContent = '0';
        updateHeroPill('ok');
        return;
      }

      alertsCount.textContent = String(data.length);

      let crit = 0;
      let warn = 0;

      data.forEach(a => {
        const isCrit = a.level === 'red';
        if (isCrit) crit++;
        else warn++;

        const item = el('div', `alert-item ${isCrit ? 'crit' : 'warn'}`);

        const head = el('div', 'alert-head');
        head.appendChild(el('span', 'alert-level',
          isCrit ? 'Critical' : 'Warning'));
        head.appendChild(el('span', 'alert-time', timeAgo(a.ts)));
        item.appendChild(head);

        const line = [
          a.vehicle_plate || '—',
          a.driver_name || 'unassigned',
          a.message || a.parameter || ''
        ].join(' · ');
        item.appendChild(el('div', 'alert-msg', line));

        item.addEventListener('click', () => {
          if (a.shift_id) {
            location.href = `pages/shift.html?id=${a.shift_id}`;
          }
        });
        item.style.cursor = 'pointer';

        alertsList.appendChild(item);
      });

      metricCrit.textContent = String(crit);
      metricWarn.textContent = String(warn);

      const worst = crit > 0 ? 'crit' : (warn > 0 ? 'warn' : 'ok');
      updateHeroPill(worst);

      if (worst === 'crit')      setSidebarStatus('crit', 'Critical alert');
      else if (worst === 'warn') setSidebarStatus('warn', 'Warning active');
      else                       setSidebarStatus('ok', 'All systems normal');
    } catch (err) {
      console.error('[dashboard] loadAlerts failed:', err.message);
    }
  }

  /* ============================================================
     Maintenance predictions
     ============================================================ */

  async function loadPredictions() {
    try {
      const data = await apiFetch('/api/predictions?resolved=0&limit=30');
      predictionsList.innerHTML = '';

      if (!data || data.length === 0) {
        predictionsCount.textContent = '0';
        const soft = el('div', 'empty-soft');
        soft.appendChild(el('div', 'empty-soft-title', 'No predictions'));
        soft.appendChild(el('div', 'empty-soft-sub',
          'The weekly job populates this panel.'));
        predictionsList.appendChild(soft);
        return;
      }

      predictionsCount.textContent = String(data.length);

      data.forEach(p => {
        const item = el('div', 'prediction-item');

        const head = el('div', 'prediction-head');
        head.appendChild(el('span', 'alert-level', p.stream));
        head.appendChild(el('span', 'prediction-time', timeAgo(p.ts)));
        item.appendChild(head);

        const line = [
          p.vehicle_plate || '—',
          `slope ${p.slope} / threshold ${p.threshold}`
        ].join(' · ');
        item.appendChild(el('div', 'prediction-msg', line));

        item.addEventListener('click', () => {
          location.href = 'pages/predictions.html';
        });
        item.style.cursor = 'pointer';

        predictionsList.appendChild(item);
      });
    } catch (err) {
      console.error('[dashboard] loadPredictions failed:', err.message);
    }
  }

  /* ============================================================
     Recent reports — last 5 completed shifts
     ============================================================ */

  async function loadRecentReports() {
    try {
      const data = await apiFetch('/api/shifts?active=0&limit=5');
      reportsList.innerHTML = '';

      if (!data || data.length === 0) {
        const soft = el('div', 'empty-soft');
        soft.appendChild(el('div', 'empty-soft-title', 'No reports yet'));
        soft.appendChild(el('div', 'empty-soft-sub',
          'Completed shifts will appear here.'));
        reportsList.appendChild(soft);
        return;
      }

      data.slice(0, 5).forEach(s => {
        const row = el('div', 'report-row');

        const left = el('div', 'report-row-left');
        left.appendChild(el('div', 'report-row-title',
          s.driver_name || 'Unassigned'));
        left.appendChild(el('div', 'report-row-sub',
          `${s.vehicle_plate || '—'} · ${fmtDate(s.end_time || s.start_time)}`));
        row.appendChild(left);

        const right = el('div', 'report-row-right');
        if (s.behavior_score != null) {
          right.appendChild(el('span', 'report-score', String(s.behavior_score)));
        } else {
          right.appendChild(el('span', 'report-score muted', '—'));
        }
        row.appendChild(right);

        row.addEventListener('click', () => {
          location.href = `pages/shift-report.html?id=${s.id}`;
        });
        row.style.cursor = 'pointer';

        reportsList.appendChild(row);
      });
    } catch (err) {
      console.error('[dashboard] loadRecentReports failed:', err.message);
    }
  }

  /* ============================================================
     Manager + logout
     ============================================================ */

  function decodeToken() {
    try {
      const t = getToken();
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1]));
    } catch (_) { return null; }
  }

  function setupManager() {
    const payload = decodeToken();
    managerNameEl.textContent = payload && payload.name ? payload.name : '—';
  }

  logoutBtn.addEventListener('click', () => {
    clearToken();
    location.href = 'login.html';
  });

  /* ============================================================
     Boot
     ============================================================ */

  setupManager();

  requestAnimationFrame(() => {
    loadMetrics();
    loadAlerts();
    loadPredictions();
    loadRecentReports();
  });

  setInterval(loadMetrics, 10000);
  setInterval(loadAlerts, 5000);
  setInterval(loadPredictions, 30000);
  setInterval(loadRecentReports, 30000);
})();