/* Qafila dashboard logic */

(function () {
  /* ---------- Guard ---------- */
  if (!getToken()) {
    location.href = 'login.html';
    return;
  }

  /* ---------- DOM refs ---------- */
  const managerNameEl = document.getElementById('manager-name');
  const logoutBtn = document.getElementById('logout-btn');

  const statActiveShifts = document.getElementById('stat-active-shifts');
  const statActiveAlerts = document.getElementById('stat-active-alerts');
  const statPredictions = document.getElementById('stat-predictions');
  const statConnection = document.getElementById('stat-connection');

  const vehicleGrid = document.getElementById('vehicle-grid');
  const alertsList = document.getElementById('alerts-list');
  const predictionsList = document.getElementById('predictions-list');

  /* ---------- Socket ---------- */
  const socket = io(API_BASE);
  socket.on('connect', () => {
    statConnection.textContent = 'Connected';
    statConnection.className = 'status-value ok';
  });
  socket.on('disconnect', () => {
    statConnection.textContent = 'Disconnected';
    statConnection.className = 'status-value crit';
  });

  socket.on('alert', (alert) => {
    window.QafilaPopup.show(alert);
    loadAlerts();
  });

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
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
    if (!alerts || alerts.length === 0) return 'normal';
    if (alerts.some(a => a.level === 'red')) return 'critical';
    return 'warning';
  }

  function labelForSeverity(sev) {
    if (sev === 'critical') return 'Critical';
    if (sev === 'warning') return 'Warning';
    return 'Normal';
  }

  /* ---------- Render vehicle card ---------- */
  function renderVehicleCard(item) {
    const { vehicle, driver, latest, alerts } = item;
    const severity = severityFromAlerts(alerts);

    const card = el('div', 'vehicle-card');

    /* Head */
    const head = el('div', 'vehicle-card-head');

    const headLeft = el('div');
    headLeft.appendChild(el('div', 'vehicle-plate', vehicle.plate));
    headLeft.appendChild(
      el('div', 'vehicle-driver',
        `${driver ? driver.name : 'Unknown driver'} · ${driver ? driver.employee_id : '—'}`)
    );
    head.appendChild(headLeft);

    const status = el('span', `vehicle-status ${severity}`, labelForSeverity(severity));
    head.appendChild(status);

    card.appendChild(head);

    /* Live readings */
    const grid = el('div', 'reading-grid');

    const readings = [
      { label: 'RPM', value: latest ? latest.rpm : null },
      { label: 'Coolant', value: latest ? latest.coolant : null, unit: '°C',
        warn: latest && latest.coolant >= 90 && latest.coolant < 105,
        crit: latest && latest.coolant >= 105 },
      { label: 'Speed', value: latest ? latest.speed : null, unit: ' km/h' },
      { label: 'Load', value: latest ? latest.load : null, unit: '%' },
      { label: 'Throttle', value: latest ? latest.throttle : null, unit: '%' },
      { label: 'STFT', value: latest ? latest.stft : null, unit: '%' },
      { label: 'LTFT', value: latest ? latest.ltft : null, unit: '%' },
      { label: 'Voltage', value: latest ? latest.voltage : null, unit: ' V',
        warn: latest && latest.voltage <= 13.5 && latest.voltage > 12.5,
        crit: latest && latest.voltage <= 12.5 }
    ];

    readings.forEach(r => {
      const box = el('div', 'reading');
      box.appendChild(el('div', 'reading-label', r.label));
      let cls = 'reading-value';
      if (r.crit) cls += ' crit';
      else if (r.warn) cls += ' warn';
      const val = el('div', cls, fmt(r.value, r.unit || ''));
      box.appendChild(val);
      grid.appendChild(box);
    });

    card.appendChild(grid);

    /* Flags */
    const flags = el('div', 'flags');
    flags.appendChild(el('div', 'flags-title', 'Active flags'));

    if (!alerts || alerts.length === 0) {
      flags.appendChild(el('div', 'flag-line', 'No active flags'));
    } else {
      alerts.slice(0, 6).forEach(a => {
        const line = el(
          'div',
          `flag-line ${a.level === 'red' ? 'crit' : 'warn'}`,
          `${a.level === 'red' ? 'Critical' : 'Warning'} · ${a.message || a.parameter}`
        );
        flags.appendChild(line);
      });
    }

    card.appendChild(flags);

    /* Last upload */
    const upload = el('div', 'flags');
    upload.style.marginTop = '0.4rem';
    upload.appendChild(
      el('div', 'flag-line', `Last upload: ${latest ? timeAgo(latest.ts) : '—'}`)
    );
    card.appendChild(upload);

    /* Actions */
    const actions = el('div', 'card-actions');

    const callBtn = el('button', '', 'Call driver');
    callBtn.addEventListener('click', () => {
      if (driver && driver.phone) window.location.href = `tel:${driver.phone}`;
    });
    actions.appendChild(callBtn);

    const shiftBtn = el('button', '', 'View shift');
    shiftBtn.addEventListener('click', () => {
      location.href = `shift.html?id=${item.shift_id}`;
    });
    actions.appendChild(shiftBtn);

    card.appendChild(actions);

    return card;
  }

  /* ---------- Load latest telemetry ---------- */
  async function loadLatest() {
    try {
      const data = await apiFetch('/api/telemetry/latest');
      vehicleGrid.innerHTML = '';

      if (!data || data.length === 0) {
        const p = el('p', 'empty', 'No active shifts.');
        vehicleGrid.appendChild(p);
      } else {
        data.forEach(item => vehicleGrid.appendChild(renderVehicleCard(item)));
      }

      statActiveShifts.textContent = String(data ? data.length : 0);
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
        statActiveAlerts.textContent = '0';
        return;
      }

      statActiveAlerts.textContent = String(data.length);

      data.slice(0, 30).forEach(a => {
        const item = el('div', `alert-item ${a.level === 'red' ? 'red' : 'yellow'}`);

        const head = el('div', 'alert-head');
        head.appendChild(el('span', 'level', a.level === 'red' ? 'Critical' : 'Warning'));
        head.appendChild(el('span', 'alert-time', timeAgo(a.ts)));
        item.appendChild(head);

        const msg = el('div', 'alert-msg',
          `${a.vehicle_plate || '—'} · ${a.driver_name || '—'} · ${a.message || a.parameter}`);
        item.appendChild(msg);

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
        statPredictions.textContent = '0';
        return;
      }

      statPredictions.textContent = String(data.length);

      data.forEach(p => {
        const item = el('div', 'prediction-item');

        const head = el('div', 'prediction-head');
        head.appendChild(el('span', 'level', p.stream));
        head.appendChild(el('span', 'prediction-time', timeAgo(p.ts)));
        item.appendChild(head);

        const msg = el('div', 'prediction-msg',
          `${p.vehicle_plate || '—'} · slope ${p.slope} (threshold ${p.threshold})`);
        item.appendChild(msg);

        predictionsList.appendChild(item);
      });
    } catch (err) {
      console.error('[dashboard] loadPredictions failed:', err.message);
    }
  }

  /* ---------- Manager info + logout ---------- */
  function decodeToken() {
    try {
      const t = getToken();
      if (!t) return null;
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload;
    } catch (_) {
      return null;
    }
  }

  function setupManager() {
    const payload = decodeToken();
    if (payload && payload.name) managerNameEl.textContent = payload.name;
    else managerNameEl.textContent = '—';
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