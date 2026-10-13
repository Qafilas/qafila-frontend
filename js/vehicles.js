/* Qafila vehicles page */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  const vehicleForm    = document.getElementById('vehicle-form');
  const vehicleSubmit  = document.getElementById('vehicle-submit');
  const vehicleErr     = document.getElementById('vehicle-error');
  const vehicleOk      = document.getElementById('vehicle-success');

  const vehicleList    = document.getElementById('vehicle-list');
  const vehicleCount   = document.getElementById('vehicle-count');
  const showInactive   = document.getElementById('show-inactive-toggle');

  let currentFilter = false;

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

  /* ---------- Load vehicles ---------- */
  async function loadVehicles() {
    try {
      const url = currentFilter ? '/api/vehicles?all=1' : '/api/vehicles';
      const data = await apiFetch(url);
      vehicleList.innerHTML = '';

      if (!data || data.length === 0) {
        vehicleList.appendChild(el('p', 'empty',
          currentFilter
            ? 'No vehicles at all yet. Add the first one using the form.'
            : 'No active vehicles. Add a vehicle or toggle Show inactive.'));
        vehicleCount.textContent = '0';
        return;
      }

      vehicleCount.textContent = String(data.length);

      data.forEach(v => {
        const card = el('div', 'data-item');

        const left = el('div', 'data-item-left');
        left.appendChild(el('div', 'data-item-title', v.plate));

        const sub1 = [];
        if (v.make || v.model) {
          sub1.push([v.make, v.model].filter(Boolean).join(' '));
        }
        if (v.year) sub1.push(v.year);
        left.appendChild(el('div', 'data-item-sub',
          sub1.length ? sub1.join(' · ') : 'no details'));

        const sub2 = v.node_id ? `Node: ${v.node_id}` : 'No node assigned';
        const nodeStatus = v.node_last_seen
          ? ` · last seen ${timeAgo(v.node_last_seen)}`
          : (v.node_id ? ' · never seen' : '');
        left.appendChild(el('div', 'data-item-sub', sub2 + nodeStatus));

        const right = el('div', 'data-item-right');

        right.appendChild(el('span',
          `badge ${v.active ? 'ok' : 'crit'}`,
          v.active ? 'Active' : 'Inactive'));

        if (v.active) {
          right.appendChild(iconButton('deactivate', 'Deactivate',
            () => deactivateVehicle(v)));
        } else {
          right.appendChild(iconButton('activate', 'Reactivate',
            () => activateVehicle(v)));
        }

        right.appendChild(iconButton('delete', 'Delete',
          () => deleteVehicle(v)));

        card.appendChild(left);
        card.appendChild(right);
        vehicleList.appendChild(card);
      });
    } catch (err) {
      vehicleList.innerHTML = '';
      vehicleList.appendChild(el('p', 'empty', 'Failed to load vehicles: ' + err.message));
    }
  }

  function timeAgo(ts) {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  /* ---------- Add vehicle ---------- */
  vehicleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    vehicleErr.hidden = true;
    vehicleOk.hidden = true;
    vehicleSubmit.disabled = true;
    vehicleSubmit.textContent = 'Adding…';

    const plate = document.getElementById('v-plate').value.trim();
    const make  = document.getElementById('v-make').value.trim();
    const model = document.getElementById('v-model').value.trim();
    const yearRaw = document.getElementById('v-year').value.trim();
    const node  = document.getElementById('v-node').value.trim();

    const year = yearRaw ? Number(yearRaw) : null;

    try {
      await apiFetch('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          plate,
          make: make || null,
          model: model || null,
          year,
          node_id: node || null
        })
      });

      vehicleOk.textContent = 'Vehicle added.';
      vehicleOk.hidden = false;

      vehicleForm.reset();
      loadVehicles();
    } catch (err) {
      vehicleErr.textContent = err.message || 'Failed to add vehicle';
      vehicleErr.hidden = false;
    }

    vehicleSubmit.disabled = false;
    vehicleSubmit.textContent = 'Add vehicle';
  });

  /* ---------- Actions ---------- */
  async function deactivateVehicle(v) {
    try {
      await apiFetch(`/api/vehicles/${v.id}/deactivate`, { method: 'POST' });
      loadVehicles();
    } catch (err) {
      alert('Failed to deactivate: ' + err.message);
    }
  }

  async function activateVehicle(v) {
    try {
      await apiFetch(`/api/vehicles/${v.id}/activate`, { method: 'POST' });
      loadVehicles();
    } catch (err) {
      alert('Failed to reactivate: ' + err.message);
    }
  }

  async function deleteVehicle(v) {
    try {
      const res = await apiFetch(`/api/vehicles/${v.id}?force=0`, {
        method: 'DELETE'
      });

      if (res && res.needsConfirm) {
        const ok = confirm(
          `${v.plate} has ${res.shiftCount} shift(s) on record.\n\n` +
          `Deleting will orphan those shifts.\n\nDo you want to proceed?`
        );
        if (!ok) return;

        await apiFetch(`/api/vehicles/${v.id}?force=1`, { method: 'DELETE' });
      }

      loadVehicles();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  /* ---------- Filter toggle ---------- */
  if (showInactive) {
    showInactive.addEventListener('change', () => {
      currentFilter = showInactive.checked;
      loadVehicles();
    });
  }

  /* ---------- Boot ---------- */
  loadVehicles();
})();