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

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

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

        const right = el('div', 'data-item-right');

        right.appendChild(el('span',
          `badge ${d.active ? 'ok' : 'crit'}`,
          d.active ? 'Active' : 'Inactive'));

        if (d.active) {
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

  driverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    driverErr.hidden = true;
    driverOk.hidden = true;
    driverSubmit.disabled = true;
    driverSubmit.textContent = 'Adding…';

    const name     = document.getElementById('d-name').value.trim();
    const employee = document.getElementById('d-employee').value.trim();
    const phoneCode = document.getElementById('d-phone-code').value;
    const phoneNum  = document.getElementById('d-phone').value.trim().replace(/\s+/g, '');
    const phone     = phoneNum ? (phoneCode + phoneNum) : '';
    const license  = document.getElementById('d-license').value.trim();

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

  async function deactivateDriver(driver) {
    if (!confirm(`Deactivate ${driver.name}?`)) return;
    try {
      await apiFetch(`/api/drivers/${driver.id}`, { method: 'DELETE' });
      loadDrivers();
    } catch (err) {
      alert('Failed to deactivate: ' + err.message);
    }
  }

  loadDrivers();
})();