/* Qafila dashboard logic */

(function () {
  if (!getToken()) {
    location.href = 'login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const topStrip        = document.getElementById('top-strip');

  const managerNameEl   = document.getElementById('manager-name');
  const logoutBtn       = document.getElementById('logout-btn');

  const heroTime        = document.getElementById('hero-time');
  const heroDate        = document.getElementById('hero-date');
  const heroHeadline    = document.getElementById('hero-headline');
  const heroSub         = document.getElementById('hero-sub');
  const heroPill        = document.getElementById('hero-pill');
  const heroPillText    = document.getElementById('hero-pill-text');

  const vehicleGrid     = document.getElementById('vehicle-grid');
  const vehicleCount    = document.getElementById('vehicle-count');

  const alertsList      = document.getElementById('alerts-list');
  const alertsTabCount  = document.getElementById('alerts-tab-count');

  const predictionsList    = document.getElementById('predictions-list');
  const predictionsTabCount= document.getElementById('predictions-tab-count');

  const footVehicles    = document.getElementById('foot-vehicles');
  const footDrivers     = document.getElementById('foot-drivers');
  const footShifts      = document.getElementById('foot-shifts');
  const footConnection  = document.getElementById('foot-connection');

  /* Expanded vehicle cards (by shift_id) */
  const expandedCards = new Set();

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmt(v, unit = '') {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'number') return `${v}${unit}`;
    return String(v) + unit;
  }

  function timeAgo(ts) {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  function severityFromAlerts(alerts) {
    if (!alerts || alerts.length === 0) return 'ok';
    if (alerts.some(a => a.level === 'red')) return 'crit';
    return 'warn';
  }

  function labelForSeverity(sev) {
    if (sev === 'crit') return 'Critical';
    if (sev === 'warn') return 'Warning';
    return 'Normal';
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
    heroDate.textContent = `${days[now.getDay()]} · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  tickClock();
  setInterval(tickClock, 1000);

  /* ============================================================
     Socket
     ============================================================ */

  const socket = io(API_BASE);

  socket.on('connect', () => {
    footConnection.textContent = 'Online';
    footConnection.className = 'footer-value ok';
  });

  socket.on('disconnect', () => {
    footConnection.textContent = 'Offline';
    footConnection.className = 'footer-value crit';
  });

  socket.on('alert', (alert) => {
    window.QafilaPopup.show(alert);
    loadAlerts();
  });

  /* ============================================================
     Hero summary
     ============================================================ */

  function updateHero(data, worst) {
    const total = data ? data.length : 0;
    const crit  = data ? data.filter(d => severityFromAlerts(d.alerts) === 'crit').length : 0;
    const warn  = data ? data.filter(d => severityFromAlerts(d.alerts) === 'warn').length : 0;

    if (total === 0) {
      heroHeadline.textContent = 'No vehicles on shift';
      heroSub.textContent      = 'Waiting for the first card tap.';
    } else {
      const veh = total === 1 ? 'vehicle' : 'vehicles';
      heroHeadline.textContent = `${total} ${veh} on shift`;

      const parts = [];
      if (crit > 0) parts.push(`${crit} critical`);
      if (warn > 0) parts.push(`${warn} warning`);
      if (parts.length === 0) parts.push('all normal');
      heroSub.textContent = parts.join(' · ');
    }

    heroPill.className = `hero-pill ${worst}`;
    if (worst === 'crit')      heroPillText.textContent = 'Critical active';
    else if (worst === 'warn') heroPillText.textContent = 'Warning active';
    else                       heroPillText.textContent = 'All systems normal';
  }

  /* ============================================================
     Vehicle card
     ============================================================ */

  function renderVehicleCard(item) {
    const { vehicle, driver, latest, alerts, shift_id } = item;
    const sev = severityFromAlerts(alerts);

    const card = el('div', `vehicle-card ${sev}`);

    /* --- Head --- */
    const head = el('div', 'vehicle-head');
    const headLeft = el('div');
    headLeft.appendChild(el('div', 'vehicle-plate', vehicle.plate));

    const driverLine = el('div', 'vehicle-driver');
    driverLine.textContent = driver ? driver.name : 'Unknown driver';
    if (driver && driver.employee_id) {
      driverLine.appendChild(document.createTextNode(` · ${driver.employee_id}`));
    }
    if (driver && driver.phone) {
      driverLine.appendChild(document.createTextNode(' · '));
      const phoneLink = el('a', '', driver.phone);
      phoneLink.href = `tel:${driver.phone}`;
      driverLine.appendChild(phoneLink);
    }
    headLeft.appendChild(driverLine);
    head.appendChild(headLeft);

    head.appendChild(el('span', `badge ${sev}`, labelForSeverity(sev)));
    card.appendChild(head);

    /* --- Primary readings --- */
    const grid = el('div', 'reading-grid');
    const primary = [
      { l: 'RPM',     v: latest ? latest.rpm     : null },
      { l: 'Coolant', v: latest ? latest.coolant : null, unit: '°C',
        cls: latest && latest.coolant >= 105 ? 'crit' :
             latest && latest.coolant >= 90  ? 'warn' : '' },
      { l: 'Speed',   v: latest ? latest.speed   : null, unit: ' km/h' },
      { l: 'Voltage', v: latest ? latest.voltage : null, unit: ' V',
        cls: latest && latest.voltage <= 12.5 ? 'crit' :
             latest && latest.voltage <= 13.5 ? 'warn' : '' }
    ];

    primary.forEach(r => {
      const box = el('div', 'reading');
      box.appendChild(el('div', 'rl', r.l));
      box.appendChild(el('div', `rv ${r.cls || ''}`, fmt(r.v, r.unit || '')));
      grid.appendChild(box);
    });
    card.appendChild(grid);

    /* --- Expand toggle --- */
    const isExpanded = expandedCards.has(shift_id);
    const toggle = el('button', 'expand-toggle', isExpanded ? 'Hide extra readings' : 'Show all readings');
    toggle.addEventListener('click', () => {
      if (expandedCards.has(shift_id)) expandedCards.delete(shift_id);
      else expandedCards.add(shift_id);
      refresh();
    });
    card.appendChild(toggle);

    /* --- Secondary readings (collapsible) --- */
    if (isExpanded) {
      const grid2 = el('div', 'reading-grid secondary');
      const secondary = [
        { l: 'Load',     v: latest ? latest.load     : null, unit: '%' },
        { l: 'Throttle', v: latest ? latest.throttle : null, unit: '%' },
        { l: 'STFT',     v: latest ? latest.stft     : null, unit: '%' },
        { l: 'LTFT',     v: latest ? latest.ltft     : null, unit: '%' }
      ];
      secondary.forEach(r => {
        const box = el('div', 'reading');
        box.appendChild(el('div', 'rl', r.l));
        box.appendChild(el('div', 'rv', fmt(r.v, r.unit || '')));
        grid2.appendChild(box);
      });
      card.appendChild(grid2);
    }

    /* --- Flags --- */
    const flags = el('div', 'flags-block');
    flags.appendChild(el('div', 'flags-label', 'Active flags'));

    if (!alerts || alerts.length === 0) {
      const f = el('div', 'flag ok');
      f.appendChild(el('span', 'dot'));
      f.appendChild(el('span', '', 'No active flags'));
      flags.appendChild(f);
    } else {
      alerts.slice(0, 6).forEach(a => {
        const cls = a.level === 'red' ? 'crit' : 'warn';
        const f = el('div', `flag ${cls}`);
        f.appendChild(el('span', 'dot'));
        f.appendChild(el('span', '', a.message || a.parameter || '—'));
        flags.appendChild(f);
      });
    }
    card.appendChild(flags);

    /* --- Footer --- */
    const foot = el('div', 'card-foot');
    foot.appendChild(el('span', '', `Last upload: ${latest ? timeAgo(latest.ts) : '—'}`));

    const actions = el('div', 'card-actions');

    if (driver && driver.phone) {
      const callBtn = el('button', 'btn', 'Call driver');
      callBtn.addEventListener('click', () => {
        window.location.href = `tel:${driver.phone}`;
      });
      actions.appendChild(callBtn);
    }

    const shiftBtn = el('button', 'btn', 'View shift');
    shiftBtn.addEventListener('click', () => {
      location.href = `pages/shift.html?id=${shift_id}`;
    });
    actions.appendChild(shiftBtn);

    foot.appendChild(actions);
    card.appendChild(foot);

    return card;
  }

  /* ============================================================
     Loaders
     ============================================================ */

  let lastData = null;

  async function loadLatest() {
    try {
      const data = await apiFetch('/api/telemetry/latest');
      lastData = data;

      vehicleGrid.innerHTML = '';
      let worst = 'ok';

      if (!data || data.length === 0) {
        vehicleGrid.appendChild(el('p', 'empty', 'No active shifts.'));
        vehicleCount.textContent = '0';
      } else {
        data.forEach(item => {
          const sev = severityFromAlerts(item.alerts);
          if (sev === 'crit') worst = 'crit';
          else if (sev === 'warn' && worst !== 'crit') worst = 'warn';
          vehicleGrid.appendChild(renderVehicleCard(item));
        });
        vehicleCount.textContent = String(data.length);
      }

      topStrip.className = 'top-strip ' + worst;
      updateHero(data, worst);
    } catch (err) {
      console.error('[dashboard] loadLatest failed:', err.message);
    }
  }

  async function loadAlerts() {
    try {
      const data = await apiFetch('/api/alerts/live');
      alertsList.innerHTML = '';

      if (!data || data.length === 0) {
        alertsTabCount.textContent = '0';
        const emptySoft = el('div', 'empty-soft');
        emptySoft.appendChild(el('div', 'empty-soft-title', 'No active alerts'));
        emptySoft.appendChild(el('div', 'empty-soft-sub', 'Live alerts will appear here in real time.'));
        alertsList.appendChild(emptySoft);
        return;
      }

      alertsTabCount.textContent = String(data.length);

      data.slice(0, 40).forEach(a => {
        const cls = a.level === 'red' ? 'crit' : 'warn';
        const item = el('div', `alert-item ${cls}`);

        const head = el('div', 'alert-head');
        head.appendChild(el('span', 'alert-level',
          a.level === 'red' ? 'Critical' : 'Warning'));
        head.appendChild(el('span', 'alert-time', timeAgo(a.ts)));
        item.appendChild(head);

        item.appendChild(el('div', 'alert-msg',
          `${a.vehicle_plate || '—'} · ${a.driver_name || '—'} · ${a.message || a.parameter || ''}`));

        alertsList.appendChild(item);
      });
    } catch (err) {
      console.error('[dashboard] loadAlerts failed:', err.message);
    }
  }

  async function loadPredictions() {
    try {
      const data = await apiFetch('/api/predictions?resolved=0&limit=30');
      predictionsList.innerHTML = '';

      if (!data || data.length === 0) {
        predictionsTabCount.textContent = '0';
        const emptySoft = el('div', 'empty-soft');
        emptySoft.appendChild(el('div', 'empty-soft-title', 'No predictions'));
        emptySoft.appendChild(el('div', 'empty-soft-sub', 'The weekly OLS job will populate this panel.'));
        predictionsList.appendChild(emptySoft);
        return;
      }

      predictionsTabCount.textContent = String(data.length);

      data.forEach(p => {
        const item = el('div', 'prediction-item');

        const head = el('div', 'prediction-head');
        head.appendChild(el('span', 'alert-level', p.stream));
        head.appendChild(el('span', 'prediction-time', timeAgo(p.ts)));
        item.appendChild(head);

        item.appendChild(el('div', 'prediction-msg',
          `${p.vehicle_plate || '—'} · slope ${p.slope} (threshold ${p.threshold})`));

        predictionsList.appendChild(item);
      });
    } catch (err) {
      console.error('[dashboard] loadPredictions failed:', err.message);
    }
  }

  /* ============================================================
     Footer summary (fetch drivers, vehicles, shifts counts)
     ============================================================ */

  async function loadFooterStats() {
    try {
      const [vehicles, drivers, shifts] = await Promise.all([
        apiFetch('/api/vehicles'),
        apiFetch('/api/drivers'),
        apiFetch('/api/shifts?limit=200')
      ]);

      footVehicles.textContent = Array.isArray(vehicles) ? vehicles.length : 0;
      footDrivers.textContent  = Array.isArray(drivers)  ? drivers.length  : 0;

      if (Array.isArray(shifts)) {
        const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
        const week = shifts.filter(s => {
          if (!s.start_time) return false;
          return new Date(s.start_time + 'Z').getTime() >= weekAgo;
        });
        footShifts.textContent = week.length;
      } else {
        footShifts.textContent = '0';
      }
    } catch (err) {
      console.error('[dashboard] loadFooterStats failed:', err.message);
    }
  }

  /* ============================================================
     Console tabs
     ============================================================ */

  const consoleTabs = document.querySelectorAll('.console-tab');
  const panelAlerts = document.getElementById('console-panel-alerts');
  const panelPreds  = document.getElementById('console-panel-predictions');

  consoleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      consoleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const which = tab.dataset.tab;
      panelAlerts.hidden = which !== 'alerts';
      panelPreds.hidden  = which !== 'predictions';
    });
  });

  /* ============================================================
     Refresh helper (used by expand toggle)
     ============================================================ */

  function refresh() {
    if (lastData) {
      vehicleGrid.innerHTML = '';
      let worst = 'ok';
      lastData.forEach(item => {
        const sev = severityFromAlerts(item.alerts);
        if (sev === 'crit') worst = 'crit';
        else if (sev === 'warn' && worst !== 'crit') worst = 'warn';
        vehicleGrid.appendChild(renderVehicleCard(item));
      });
      topStrip.className = 'top-strip ' + worst;
      updateHero(lastData, worst);
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
  loadLatest();
  loadAlerts();
  loadPredictions();
  loadFooterStats();

  setInterval(loadLatest, 2000);
  setInterval(loadAlerts, 5000);
  setInterval(loadPredictions, 30000);
  setInterval(loadFooterStats, 60000);
})();