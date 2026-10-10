/* Qafila emergency popup module */

(function () {
  const root = document.getElementById('popup-root');
  const shown = new Set(); /* prevent duplicate popups by alert id */

  /* Track popups so we can remove dim overlay when all close */
  const openPopups = new Set();

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

  function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function updateDim() {
    let dim = document.getElementById('popup-dim');
    if (openPopups.size === 0) {
      if (dim) dim.remove();
      return;
    }
    /* Only show dim if any open popup is critical */
    const hasCrit = Array.from(openPopups).some(id => id.startsWith('crit:'));
    if (hasCrit && !dim) {
      dim = el('div', 'popup-dim');
      dim.id = 'popup-dim';
      root.appendChild(dim);
    } else if (!hasCrit && dim) {
      dim.remove();
    }
  }

  function removePopup(popup, key) {
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    openPopups.delete(key);
    updateDim();
  }

  function showPopup(alert) {
    if (!alert || !alert.id) return;
    if (shown.has(alert.id)) return;
    shown.add(alert.id);

    const level = alert.level === 'red' ? 'crit' : 'warn';
    const isCrit = level === 'crit';
    const key = `${isCrit ? 'crit' : 'warn'}:${alert.id}`;

    const popup = el('div', `popup ${level} ${isCrit ? 'center' : 'corner'}`);

    /* Head */
    const head = el('div', 'popup-head');
    head.appendChild(el(
      'div', 'popup-title',
      isCrit ? 'Critical alert' : 'Warning alert'
    ));
    const closeBtn = el('button', 'popup-close', 'Close');
    closeBtn.addEventListener('click', () => removePopup(popup, key));
    head.appendChild(closeBtn);
    popup.appendChild(head);

    /* Body */
    const body = el('div', 'popup-body');
    kv(body, 'Vehicle',     alert.vehicle_plate || '—');
    kv(body, 'Driver',      alert.driver_name || '—');
    kv(body, 'Employee ID', alert.driver_employee_id || '—');
    kv(body, 'Phone',       alert.driver_phone || '—');
    kv(body, 'Parameter',   alert.parameter || '—');
    kv(body, 'Value',       alert.value == null ? '—' : alert.value);
    kv(body, 'Threshold',   alert.threshold == null ? '—' : alert.threshold);
    kv(body, 'Time',        formatTime(alert.ts));
    popup.appendChild(body);

    if (alert.message) {
      const msg = el('div', 'popup-msg', alert.message);
      body.appendChild(msg);
    }

    /* Actions */
    const actions = el('div', 'popup-actions');

    if (alert.driver_phone) {
      const callBtn = el('button', 'btn btn-primary', 'Call driver');
      callBtn.addEventListener('click', () => {
        window.location.href = `tel:${alert.driver_phone}`;
      });
      actions.appendChild(callBtn);
    }

    const ackBtn = el('button', 'btn', 'Acknowledge');
    ackBtn.addEventListener('click', async () => {
      try {
        await apiFetch(`/api/alerts/${alert.id}/acknowledge`, { method: 'POST' });
      } catch (_) {}
      removePopup(popup, key);
    });
    actions.appendChild(ackBtn);

    const resolveBtn = el('button', 'btn', 'Resolve');
    resolveBtn.addEventListener('click', async () => {
      try {
        await apiFetch(`/api/alerts/${alert.id}/resolve`, { method: 'POST' });
      } catch (_) {}
      removePopup(popup, key);
    });
    actions.appendChild(resolveBtn);

    popup.appendChild(actions);

    root.appendChild(popup);
    openPopups.add(key);
    updateDim();
  }

  window.QafilaPopup = {
    show: showPopup
  };
})();