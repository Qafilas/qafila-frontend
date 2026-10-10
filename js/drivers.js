/* Qafila drivers page */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  const managerNameEl = document.getElementById('manager-name');
  const logoutBtn     = document.getElementById('logout-btn');

  const driverForm    = document.getElementById('driver-form');
  const driverSubmit  = document.getElementById('driver-submit');
  const driverErr     = document.getElementById('driver-error');
  const driverOk      = document.getElementById('driver-success');

  const driverList    = document.getElementById('driver-list');
  const driverCount   = document.getElementById('driver-count');

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

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
    location.href = '../login.html';
  });

  /* ---------- Load drivers ---------- */
  async function loadDrivers() {
    try {
      const data = await apiFetch('/api/drivers');
      driverList.innerHTML = '';

      if (!data || data.length === 0) {
        driverList.appendChild(el('p', 'empty',
          'No drivers yet. Add the first one using the form.'));
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

        left.appendChild(el('div', 'data-item-sub',
          d.card_uid ? `Card: ${d.card_uid}` : 'No card assigned'));

        const right = el('div', 'data-item-right');

        right.appendChild(el('span',
          `badge ${d.active ? 'ok' : 'crit'}`,
          d.active ? 'Active' : 'Inactive'));

        if (d.active) {
          const uidBtn = el('button', 'btn', d.card_uid ? 'Change card' : 'Assign card');
          uidBtn.addEventListener('click', () => assignCard(d));
          right.appendChild(uidBtn);

          const deactBtn = el('button', 'btn btn-danger', 'Deactivate');
          deactBtn.addEventListener('click', () => deactivateDriver(d));
          right.appendChild(deactBtn);
        }

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

    const name     = document.getElementById('d-name').value.trim();
    const employee = document.getElementById('d-employee').value.trim();
    const phone    = document.getElementById('d-phone').value.trim();
    const license  = document.getElementById('d-license').value.trim();
    const uid      = document.getElementById('d-uid').value.trim();

    try {
      const res = await apiFetch('/api/drivers', {
        method: 'POST',
        body: JSON.stringify({ name, employee_id: employee, phone, license })
      });

      if (uid && res.driverId) {
        await apiFetch(`/api/drivers/${res.driverId}/card`, {
          method: 'POST',
          body: JSON.stringify({ uid })
        });
      }

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

  /* ---------- Assign card ---------- */
  async function assignCard(driver) {
    const uid = prompt(`Enter RFID card UID for ${driver.name}:`, driver.card_uid || '');
    if (!uid) return;

    try {
      await apiFetch(`/api/drivers/${driver.id}/card`, {
        method: 'POST',
        body: JSON.stringify({ uid: uid.trim() })
      });
      loadDrivers();
    } catch (err) {
      alert('Failed to assign card: ' + err.message);
    }
  }

  /* ---------- Deactivate ---------- */
  async function deactivateDriver(driver) {
    if (!confirm(`Deactivate ${driver.name}? Their card will be disabled too.`)) return;

    try {
      await apiFetch(`/api/drivers/${driver.id}`, { method: 'DELETE' });
      loadDrivers();
    } catch (err) {
      alert('Failed to deactivate: ' + err.message);
    }
  }

  /* ---------- Boot ---------- */
  setupManager();
  loadDrivers();
})();