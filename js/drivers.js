/* Qafila drivers page */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  const driverForm    = document.getElementById('driver-form');
  const driverSubmit  = document.getElementById('driver-submit');
  const driverErr     = document.getElementById('driver-error');
  const driverOk      = document.getElementById('driver-success');

  const driverList    = document.getElementById('driver-list');
  const driverCount   = document.getElementById('driver-count');
  const showInactive  = document.getElementById('show-inactive-toggle');

  let currentFilter = false; /* false = active only */

  /* ---------- SVG icons ---------- */
  const ICONS = {
    delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    deactivate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    activate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function iconButton(kind, title, onClick) {
    const btn = el('button', `icon-btn ${kind}`);
    btn.title = title;
    btn.type = 'button';
    btn.innerHTML = ICONS[kind];
    btn.addEventListener('click', onClick);
    return btn;
  }

  /* ---------- Load drivers ---------- */
  async function loadDrivers() {
    try {
      const url = currentFilter ? '/api/drivers?all=1' : '/api/drivers';
      const data = await apiFetch(url);
      driverList.innerHTML = '';

      if (!data || data.length === 0) {
        driverList.appendChild(el('p', 'empty',
          currentFilter
            ? 'No drivers at all yet. Add the first one using the form.'
            : 'No active drivers. Add a driver or toggle Show inactive.'));
        driverCount.textContent = '0';
        return;
      }

      driverCount.textContent = String(data.length);

      data.forEach(d => {
        const card = el('div', 'data-item');

        const left = el('div', 'data-item-left');
        left.appendChild(el('div', 'data-item-title', d.name));

        const sub1 = [d.employee_id, d.phone || 'no phone', d.license || 'no license'];
        left.appendChild(el('div', 'data-item-sub', sub1.join(' · ')));

        const right = el('div', 'data-item-right');

        right.appendChild(el('span',
          `badge ${d.active ? 'ok' : 'crit'}`,
          d.active ? 'Active' : 'Inactive'));

        if (d.active) {
          right.appendChild(iconButton('deactivate', 'Deactivate',
            () => deactivateDriver(d)));
        } else {
          right.appendChild(iconButton('activate', 'Reactivate',
            () => activateDriver(d)));
        }

        right.appendChild(iconButton('delete', 'Delete',
          () => deleteDriver(d)));

        card.appendChild(left);
        card.appendChild(right);
        driverList.appendChild(card);
      });
    } catch (err) {
      driverList.innerHTML = '';
      driverList.appendChild(el('p', 'empty', 'Failed to load drivers: ' + err.message));
    }
  }

  /* ---------- Add driver ---------- */
  driverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    driverErr.hidden = true;
    driverOk.hidden = true;
    driverSubmit.disabled = true;
    driverSubmit.textContent = 'Adding…';

    const name      = document.getElementById('d-name').value.trim();
    const employee  = document.getElementById('d-employee').value.trim();
    const phoneCode = document.getElementById('d-phone-code').value;
    const phoneNum  = document.getElementById('d-phone').value.trim().replace(/\s+/g, '');
    const phone     = phoneNum ? (phoneCode + phoneNum) : '';
    const license   = document.getElementById('d-license').value.trim();

    try {
      await apiFetch('/api/drivers', {
        method: 'POST',
        body: JSON.stringify({ name, employee_id: employee, phone, license })
      });

      driverOk.textContent = 'Driver added.';
      driverOk.hidden = false;

      driverForm.reset();
      loadDrivers();
    } catch (err) {
      driverErr.textContent = err.message || 'Failed to add driver';
      driverErr.hidden = false;
    }

    driverSubmit.disabled = false;
    driverSubmit.textContent = 'Add driver';
  });

  /* ---------- Actions ---------- */
  async function deactivateDriver(driver) {
    try {
      await apiFetch(`/api/drivers/${driver.id}/deactivate`, { method: 'POST' });
      loadDrivers();
    } catch (err) {
      alert('Failed to deactivate: ' + err.message);
    }
  }

  async function activateDriver(driver) {
    try {
      await apiFetch(`/api/drivers/${driver.id}/activate`, { method: 'POST' });
      loadDrivers();
    } catch (err) {
      alert('Failed to reactivate: ' + err.message);
    }
  }

  async function deleteDriver(driver) {
    try {
      const res = await apiFetch(`/api/drivers/${driver.id}?force=0`, {
        method: 'DELETE'
      });

      if (res && res.needsConfirm) {
        const ok = confirm(
          `${driver.name} has ${res.shiftCount} shift(s) on record.\n\n` +
          `Deleting will orphan those shifts (they will show "unknown driver").\n\n` +
          `Do you want to proceed?`
        );
        if (!ok) return;

        await apiFetch(`/api/drivers/${driver.id}?force=1`, { method: 'DELETE' });
      }

      loadDrivers();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  /* ---------- Filter toggle ---------- */
  if (showInactive) {
    showInactive.addEventListener('change', () => {
      currentFilter = showInactive.checked;
      loadDrivers();
    });
  }

  /* ---------- Boot ---------- */
  loadDrivers();
})();