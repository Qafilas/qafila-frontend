/* Qafila shift detail page */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  const params  = new URLSearchParams(location.search);
  const shiftId = params.get('id');

  const shiftMeta       = document.getElementById('shift-meta');
  const behaviorPanel   = document.getElementById('behavior-panel');
  const eventsPanel     = document.getElementById('events-panel');
  const alertsPanel     = document.getElementById('alerts-panel');
  const predictionsPanel= document.getElementById('predictions-panel');
  const managerNameEl   = document.getElementById('manager-name');
  const logoutBtn       = document.getElementById('logout-btn');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function kv(parent, k, v) {
    const row = el('div', 'kv-row');
    row.appendChild(el('span', 'k', k));
    row.appendChild(el('span', 'v', v == null ? '—' : String(v)));
    parent.appendChild(row);
  }

  function fmt(ts) {
    if (!ts) return '—';
    return new Date(ts + 'Z').toLocaleString();
  }

  function decodeToken() {
    try {
      const t = getToken();
      if (!t) return null;
      return JSON.parse(atob(t.split('.')[1]));
    } catch (_) { return null; }
  }

  async function load() {
    if (!shiftId) {
      shiftMeta.innerHTML = '';
      shiftMeta.appendChild(el('p', 'empty', 'No shift id in URL.'));
      return;
    }
    try {
      const data = await apiFetch('/api/shifts/' + shiftId);
      renderShift(data);
    } catch (err) {
      shiftMeta.innerHTML = '';
      shiftMeta.appendChild(el('p', 'empty', 'Failed to load: ' + err.message));
    }
  }

  function renderShift(data) {
    const { shift, report, events, alerts, predictions } = data;

    /* Shift meta */
    shiftMeta.innerHTML = '';
    kv(shiftMeta, 'Driver', shift.driver_name);
    kv(shiftMeta, 'Employee ID', shift.driver_employee_id);
    kv(shiftMeta, 'Phone', shift.driver_phone);
    kv(shiftMeta, 'Vehicle', shift.vehicle_plate);
    kv(shiftMeta, 'Make / Model',
      `${shift.vehicle_make || ''} ${shift.vehicle_model || ''}`.trim() || '—');
    kv(shiftMeta, 'Start', fmt(shift.start_time));
    kv(shiftMeta, 'End', shift.end_time ? fmt(shift.end_time) : 'Active');
    kv(shiftMeta, 'Status', shift.active ? 'Active' : 'Ended');

    /* Behavior */
    behaviorPanel.innerHTML = '';
    if (report && report.paragraph) {
      behaviorPanel.appendChild(el('p', 'paragraph', report.paragraph));
      const score = el('p', 'score-line');
      score.innerHTML = `Behavior score: <strong>${report.score}</strong>`;
      behaviorPanel.appendChild(score);
    } else {
      behaviorPanel.appendChild(el('p', 'empty',
        shift.active ? 'Report will be generated at shift end.' : 'No report yet.'));
    }

    /* Events */
    eventsPanel.innerHTML = '';
    if (!events || events.length === 0) {
      eventsPanel.appendChild(el('p', 'empty', 'No events.'));
    } else {
      events.forEach(e => {
        const item = el('div', 'alert-item');
        const head = el('div', 'alert-head');
        head.appendChild(el('span', 'alert-level', e.event_type));
        head.appendChild(el('span', 'alert-time', fmt(e.ts)));
        item.appendChild(head);
        item.appendChild(el('div', 'alert-msg', e.detail || ''));
        eventsPanel.appendChild(item);
      });
    }

    /* Alerts */
    alertsPanel.innerHTML = '';
    if (!alerts || alerts.length === 0) {
      alertsPanel.appendChild(el('p', 'empty', 'No alerts.'));
    } else {
      alerts.forEach(a => {
        const cls = a.level === 'red' ? 'crit' : 'warn';
        const item = el('div', `alert-item ${cls}`);
        const head = el('div', 'alert-head');
        head.appendChild(el(
          'span', 'alert-level',
          a.level === 'red' ? 'Critical' : 'Warning'
        ));
        head.appendChild(el('span', 'alert-time', fmt(a.ts)));
        item.appendChild(head);
        item.appendChild(el('div', 'alert-msg', a.message || a.parameter || ''));
        alertsPanel.appendChild(item);
      });
    }

    /* Predictions */
    predictionsPanel.innerHTML = '';
    if (!predictions || predictions.length === 0) {
      predictionsPanel.appendChild(el('p', 'empty', 'No predictions.'));
    } else {
      predictions.forEach(p => {
        const item = el('div', 'prediction-item');
        const head = el('div', 'prediction-head');
        head.appendChild(el('span', 'alert-level', p.stream));
        head.appendChild(el('span', 'prediction-time', fmt(p.ts)));
        item.appendChild(head);
        item.appendChild(el('div', 'prediction-msg', p.message || ''));
        predictionsPanel.appendChild(item);
      });
    }
  }

  function setupManager() {
    const payload = decodeToken();
    managerNameEl.textContent = payload && payload.name ? payload.name : '—';
  }

  logoutBtn.addEventListener('click', () => {
    clearToken();
    location.href = '../login.html';
  });

  setupManager();
  load();
})();