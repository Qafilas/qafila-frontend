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

  let currentFilter = false;
  let editingId = null;

  const ICONS = {
    delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    deactivate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    activate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`
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

  /* ---------- Phone helpers ---------- */

  const PHONE_CODES = [
    '+974', '+966', '+971', '+965', '+973', '+968',
    '+20', '+91', '+92', '+63', '+44', '+1'
  ];

  function splitPhone(full) {
    if (!full) return { code: '+974', number: '' };
    for (const c of PHONE_CODES) {
      if (full.startsWith(c)) return { code: c, number: full.slice(c.length) };
    }
    return { code: '+974', number: full };
  }

  /* ---------- Load ---------- */

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
        if (editingId === d.id) {
          driverList.appendChild(renderEditor(d));
        } else {
          driverList.appendChild(renderRow(d));
        }
      });
    } catch (err) {
      driverList.innerHTML = '';
      driverList.appendChild(el('p', 'empty', 'Failed to load drivers: ' + err.message));
    }
  }

  /* ---------- Row ---------- */

  function renderRow(d) {
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
      right.appendChild(iconButton('edit', 'Edit', () => {
        editingId = d.id;
        loadDrivers();
      }));
      right.appendChild(iconButton('deactivate', 'Deactivate',
        () => deactivateDriver(d)));
    } else {
      right.appendChild(iconButton('activate', 'Reactivate',
        () => activateDriver(d)));
    }

    right.appendChild(iconButton('delete', 'Delete', () => deleteDriver(d)));

    card.appendChild(left);
    card.appendChild(right);
    return card;
  }

  /* ---------- Inline editor ---------- */

  function renderEditor(d) {
    const card = el('div', 'data-item data-item-edit');

    const form = el('div', 'edit-form');

    /* Name */
    const nameRow = el('div', 'edit-row');
    nameRow.appendChild(el('label', 'edit-label', 'Full name'));
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = d.name || '';
    nameInput.className = 'edit-input';
    nameRow.appendChild(nameInput);
    form.appendChild(nameRow);

    /* Employee ID (read-only) */
    const empRow = el('div', 'edit-row');
    empRow.appendChild(el('label', 'edit-label', 'Employee ID'));
    const empInput = document.createElement('input');
    empInput.type = 'text';
    empInput.value = d.employee_id || '';
    empInput.className = 'edit-input';
    empInput.disabled = true;
    empRow.appendChild(empInput);
    form.appendChild(empRow);

    /* Phone */
    const phone = splitPhone(d.phone);
    const phoneRow = el('div', 'edit-row');
    phoneRow.appendChild(el('label', 'edit-label', 'Phone'));
    const phoneWrap = el('div', 'phone-field');
    const codeSel = document.createElement('select');
    PHONE_CODES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === phone.code) opt.selected = true;
      codeSel.appendChild(opt);
    });
    const phoneInput = document.createElement('input');
    phoneInput.type = 'text';
    phoneInput.value = phone.number;
    phoneInput.className = 'edit-input';
    phoneWrap.appendChild(codeSel);
    phoneWrap.appendChild(phoneInput);
    phoneRow.appendChild(phoneWrap);
    form.appendChild(phoneRow);

    /* License */
    const licRow = el('div', 'edit-row');
    licRow.appendChild(el('label', 'edit-label', 'License'));
    const licInput = document.createElement('input');
    licInput.type = 'text';
    licInput.value = d.license || '';
    licInput.className = 'edit-input';
    licRow.appendChild(licInput);
    form.appendChild(licRow);

    /* Error message */
    const errP = el('p', 'auth-error', '');
    errP.hidden = true;
    form.appendChild(errP);

    /* Actions */
    const actions = el('div', 'edit-actions');

    const saveBtn = el('button', 'btn btn-primary', 'Save');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', async () => {
      errP.hidden = true;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      const phoneCode = codeSel.value;
      const phoneNum  = phoneInput.value.trim().replace(/\s+/g, '');
      const fullPhone = phoneNum ? (phoneCode + phoneNum) : '';

      try {
        await apiFetch(`/api/drivers/${d.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: nameInput.value.trim(),
            phone: fullPhone,
            license: licInput.value.trim()
          })
        });
        editingId = null;
        loadDrivers();
      } catch (err) {
        errP.textContent = err.message || 'Failed to save';
        errP.hidden = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    const cancelBtn = el('button', 'btn', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', () => {
      editingId = null;
      loadDrivers();
    });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    card.appendChild(form);
    return card;
  }

  /* ---------- Add ---------- */

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
      const res = await apiFetch(`/api/drivers/${driver.id}?force=0`, { method: 'DELETE' });

      if (res && res.needsConfirm) {
        const ok = confirm(
          `${driver.name} has ${res.shiftCount} shift(s) on record.\n\n` +
          `Deleting will orphan those shifts.\n\nProceed?`
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