/* Qafila dashboard logic */

(function () {
  if (!getToken()) {
    location.href = 'login.html';
    return;
  }

  /* ---------- DOM refs ---------- */
  const managerNameEl     = document.getElementById('manager-name');
  const logoutBtn         = document.getElementById('logout-btn');
  const topStrip          = document.getElementById('top-strip');

  const statActiveShifts  = document.getElementById('stat-active-shifts');
  const statActiveAlerts  = document.getElementById('stat-active-alerts');
  const statPredictions   = document.getElementById('stat-predictions');
  const statConnection    = document.getElementById('stat-connection');

  const vehicleGrid       = document.getElementById('vehicle-grid');
  const vehicleCount      = document.getElementById('vehicle-count');

  const alertsList        = document.getElementById('alerts-list');
  const alertsCount       = document.getElementById('alerts-count');

  const predictionsList   = document.getElementById('predictions-list');
  const predictionsCount  = document.getElementById('predictions-count');

  let worstLevel = 'ok';

  /* ---------- Socket ---------- */
  const socket = io(API_BASE);

  socket.on('connect', () => {
    statConnection.textContent = 'Connected';
    statConnection.className = 'v ok';
  });

  socket.on('disconnect', () => {
    statConnection.textContent = 'Disconnected';
    statConnection.className = 'v crit';
  });

  socket.on('alert', (alert) => {
    window.QafilaPopup.show(alert);
    loadAlerts();
  });

  /* ---------- Helpers ---------- */
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

  function bumpWorst(sev) {
    if (sev === 'crit') worstLevel = 'crit';
    else if (sev === 'warn' && worstLevel !== 'crit') worstLevel = 'warn';
  }

  /* ---------- Vehicle card ---------- */
  function renderVehicleCard(item) {
    const { vehicle, driver, latest, alerts } = item;
    const sev = severityFromAlerts(alerts);
    bumpWorst(sev);

    const card = el('div', `vehicle-card ${sev}`);

    /* Head */
    const head = el('div', 'vehicle-head');
    const headLeft = el('div');
    headLeft.appendChild(el('div', 'vehicle-plate', vehicle.plate));
    headLeft.appendChild(el(
      'div', 'vehicle-driver',
      `${driver ? driver.name : 'Unknown driver'} · ${driver ? driver.employee_id : '—'}`
    ));
    head.appendChild(headLeft);
    head.appendChild(el('span', `badge ${sev}`, labelForSeverity(sev)));
    card.appendChild(head);

    /* Readings */
    const grid = el('div', 'reading-grid');

    const readings = [
      { l: 'RPM',      v: latest ? latest.rpm      : null },
      { l: 'Coolant',  v: latest ? latest.coolant  : null, unit: '°C',
        cls: latest && latest.coolant >= 105 ? 'crit' :
             latest && latest.coolant >= 90  ? 'warn' : '' },
      { l: 'Speed',    v: latest ? latest.speed    : null, unit: ' km/h' },
      { l: 'Load',     v: latest ? latest.load     : null, unit: '%' },
      { l: 'Throttle', v: latest ? latest.throttle : null, unit: '%' },
      { l: 'STFT',     v: latest ? latest.stft     : null, unit: '%' },
      { l: 'LTFT',     v: latest ? latest.ltft     : null, unit: '%' },
      { l: 'Voltage',  v: latest ? latest.voltage  : null, unit: ' V',
        cls: latest && latest.voltage <= 12.5 ? 'crit' :
             latest && latest.voltage <= 13.5 ? 'warn' : '' }
    ];

    readings.forEach(r => {
      const box = el('div', 'reading');
      box.appendChild(el('div', 'rl', r.l));
      box.appendChild(el('div', `rv ${r.cls || ''}`, fmt(r.v, r.unit || '')));
      grid.appendChild(box);
    });

    card.appendChild(grid);

    /* Flags */
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

    /* Footer */
    const foot = el('div', 'card-foot');
    foot.appendChild(el('span', '', `Last upload: ${latest ? timeAgo(latest.ts) : '—'}`));

    const actions = el('div', 'card-actions');

    const callBtn = el('button', 'btn', 'Call driver');
    callBtn.addEventListener('click', () => {
      if (driver && driver.phone) window.location.href = `tel:${driver.phone}`;
    });
    actions.appendChild(callBtn);

    const shiftBtn = el('button', 'btn', 'View shift');
    shiftBtn.addEventListener('click', () => {
      location.href = `pages/shift.html?id=${item.shift_id}`;
    });
    actions.appendChild(shiftBtn);

    foot.appendChild(actions);
    card.appendChild(foot);

    return card;
  }

  /* ---------- Load latest ---------- */
  async function loadLatest() {
    try {
      const data = await apiFetch('/api/telemetry/latest');
      vehicleGrid.innerHTML = '';
      worstLevel = 'ok';

      if (!data || data.length === 0) {
        vehicleGrid.appendChild(el('p', 'empty', 'No active shifts.'));
        vehicleCount.textContent = '0';
      } else {
        data.forEach(item => vehicleGrid.appendChild(renderVehicleCard(item)));
        vehicleCount.textContent = String(data.length);
      }

      statActiveShifts.textContent = String(data ? data.length : 0);

      /* Top strip colour = worst level across all vehicles */
      topStrip.className = 'top-strip ' + worstLevel;
    } catch (err) {
      console.error('[dashboard] loadLatest failed:', err.message);
    }
  }

  /* ---------- Load alerts ---------- */
  async function loadAlerts() {
    try {
      const data = await apiFetch('/api/alerts/live');
      alertsList.innerHTML = '';

      if (!data || data.length === 0) {
        alertsList.appendChild(el('p', 'empty', 'No alerts.'));
        alertsCount.textContent = '0';
        statActiveAlerts.textContent = '0';
        statActiveAlerts.className = 'v';
        return;
      }

      alertsCount.textContent = String(data.length);
      statActiveAlerts.textContent = String(data.length);

      const hasCrit = data.some(a => a.level === 'red');
      statActiveAlerts.className = 'v ' + (hasCrit ? 'crit' : 'warn');

      data.slice(0, 30).forEach(a => {
        const cls = a.level === 'red' ? 'crit' : 'warn';
        const item = el('div', `alert-item ${cls}`);

        const head = el('div', 'alert-head');
        head.appendChild(el(
          'span', 'alert-level',
          a.level === 'red' ? 'Critical' : 'Warning'
        ));
        head.appendChild(el('span', 'alert-time', timeAgo(a.ts)));
        item.appendChild(head);

        item.appendChild(el(
          'div', 'alert-msg',
          `${a.vehicle_plate || '—'} · ${a.driver_name || '—'} · ${a.message || a.parameter || ''}`
        ));

        alertsList.appendChild(item);
      });
    } catch (err) {
      console.error('[dashboard] loadAlerts failed:', err.message);
    }
  }

  /* ---------- Load predictions ---------- */
  async function loadPredictions() {
    try {
      const data = await apiFetch('/api/predictions?resolved=0&limit=30');
      predictionsList.innerHTML = '';

      if (!data || data.length === 0) {
        predictionsList.appendChild(el('p', 'empty', 'No predictions.'));
        predictionsCount.textContent = '0';
        statPredictions.textContent = '0';
        return;
      }

      predictionsCount.textContent = String(data.length);
      statPredictions.textContent  = String(data.length);

      data.forEach(p => {
        const item = el('div', 'prediction-item');

        const head = el('div', 'prediction-head');
        head.appendChild(el('span', 'alert-level', p.stream));
        head.appendChild(el('span', 'prediction-time', timeAgo(p.ts)));
        item.appendChild(head);

        item.appendChild(el(
          'div', 'prediction-msg',
          `${p.vehicle_plate || '—'} · slope ${p.slope} (threshold ${p.threshold})`
        ));

        predictionsList.appendChild(item);
      });
    } catch (err) {
      console.error('[dashboard] loadPredictions failed:', err.message);
    }
  }

  /* ---------- Manager + logout ---------- */
  function decodeToken() {
    try {
      const t = getToken();
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1]));
    } catch (_) {
      return null;
    }
  }

  function setupManager() {
    const payload = decodeToken();
    managerNameEl.textContent = payload && payload.name ? payload.name : '—';
  }

  logoutBtn.addEventListener('click', () => {
    clearToken();
    location.href = 'login.html';
  });

  /* ---------- Boot ---------- */
  setupManager();
  loadLatest();
  loadAlerts();
  loadPredictions();

  setInterval(loadLatest, 2000);
  setInterval(loadAlerts, 5000);
  setInterval(loadPredictions, 30000);
})();