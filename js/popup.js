/* Qafila emergency popup module */

(function () {
  const root = document.getElementById('popup-root');
  const shown = new Set(); /* prevent duplicate popups by alert id */

  function formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts + 'Z');
    return d.toLocaleTimeString();
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function kv(parent, key, value) {
    const row = el('div', 'kv');
    row.appendChild(el('span', 'k', key));
    row.appendChild(el('span', 'v', value == null ? '—' : String(value)));
    parent.appendChild(row);
  }

  function removePopup(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function showPopup(alert, options = {}) {
    if (!alert || !alert.id) return;
    if (shown.has(alert.id)) return;
    shown.add(alert.id);

    const level = alert.level === 'red' ? 'red' : 'yellow';
    const isRed = level === 'red';

    const popup = el('div', `popup ${level} ${isRed ? 'center' : 'corner'}`);

    /* Head */
    const head = el('div', 'popup-head');
    const title = el(
      'div',
      'popup-title',
      isRed ? 'Critical alert' : 'Warning alert'
    );
    head.appendChild(title);

    const closeBtn = el('button', 'popup-close', 'Close');
    closeBtn.addEventListener('click', () => removePopup(popup));
    head.appendChild(closeBtn);
    popup.appendChild(head);

    /* Body */
    const body = el('div', 'popup-body');

    kv(body, 'Vehicle', alert.vehicle_plate || '—');
    kv(body, 'Driver', alert.driver_name || '—');
    kv(body, 'Employee ID', alert.driver_employee_id || '—');
    kv(body, 'Phone', alert.driver_phone || '—');
    kv(body, 'Parameter', alert.parameter || '—');
    kv(body, 'Value', alert.value == null ? '—' : alert.value);
    kv(body, 'Threshold', alert.threshold == null ? '—' : alert.threshold);
    kv(body, 'Time', formatTime(alert.ts));

    if (alert.message) {
      const msg = el('div', 'alert-msg');
      msg.style.marginTop = '0.4rem';
      msg.textContent = alert.message;
      body.appendChild(msg);
    }

    popup.appendChild(body);

    /* Actions */
    const actions = el('div', 'popup-actions');

    if (alert.driver_phone) {
      const callBtn = el('button', 'primary', 'Call driver');
      callBtn.addEventListener('click', () => {
        window.location.href = `tel:${alert.driver_phone}`;
      });
      actions.appendChild(callBtn);
    }

    const ackBtn = el('button', '', 'Acknowledge');
    ackBtn.addEventListener('click', async () => {
      try {
        await apiFetch(`/api/alerts/${alert.id}/acknowledge`, { method: 'POST' });
      } catch (_) {}
      removePopup(popup);
    });
    actions.appendChild(ackBtn);

    const resolveBtn = el('button', '', 'Resolve');
    resolveBtn.addEventListener('click', async () => {
      try {
        await apiFetch(`/api/alerts/${alert.id}/resolve`, { method: 'POST' });
      } catch (_) {}
      removePopup(popup);
    });
    actions.appendChild(resolveBtn);

    popup.appendChild(actions);

    root.appendChild(popup);
  }

  window.QafilaPopup = {
    show: showPopup
  };
})();