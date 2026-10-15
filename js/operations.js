/* Qafila operations page — active shifts + driver/vehicle pairing */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const activeShiftsEl     = document.getElementById('active-shifts');
  const activeCountEl      = document.getElementById('active-count');

  const driversCol         = document.getElementById('drivers-col');
  const vehiclesCol        = document.getElementById('vehicles-col');
  const driversCountEl     = document.getElementById('drivers-count');
  const vehiclesCountEl    = document.getElementById('vehicles-count');

  const countShifts        = document.getElementById('ops-count-shifts');
  const countUnassigned    = document.getElementById('ops-count-unassigned');
  const countFreeDrivers   = document.getElementById('ops-count-free-drivers');
  const countFreeVehicles  = document.getElementById('ops-count-free-vehicles');

  /* ============================================================
     State
     ============================================================ */

  let driversCache  = [];
  let vehiclesCache = [];
  let shiftsCache   = [];

  /* Currently selected driver or vehicle for pairing */
  let selectedDriverId  = null;
  let selectedVehicleId = null;

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts + 'Z');
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(ts) {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  }

  /* ============================================================
     Loaders
     ============================================================ */

  async function loadAll() {
    try {
      const [shifts, drivers, vehicles] = await Promise.all([
        apiFetch('/api/shifts/active'),
        apiFetch('/api/drivers'),
        apiFetch('/api/vehicles')
      ]);

      shiftsCache   = Array.isArray(shifts)   ? shifts   : [];
      driversCache  = Array.isArray(drivers)  ? drivers  : [];
      vehiclesCache = Array.isArray(vehicles) ? vehicles : [];

      renderSummary();
      renderActiveShifts();
      renderDrivers();
      renderVehicles();
    } catch (err) {
      console.error('[operations] loadAll failed:', err.message);
    }
  }

  /* ============================================================
     Summary chips
     ============================================================ */

  function renderSummary() {
    const activeShifts = shiftsCache.length;

    const assignedShiftVehicleIds = new Set(
      shiftsCache.filter(s => s.driver_id).map(s => s.vehicle_id)
    );

    const assignedDriverIds = new Set(
      shiftsCache.filter(s => s.driver_id).map(s => s.driver_id)
    );

    const assignedVehicleIds = new Set(
      shiftsCache.map(s => s.vehicle_id)
    );

    const unassigned = shiftsCache.filter(s => !s.driver_id).length;

    const freeDrivers  = driversCache.filter(d => !assignedDriverIds.has(d.id)).length;
    const freeVehicles = vehiclesCache.filter(v => !assignedVehicleIds.has(v.id)).length;

    countShifts.textContent       = String(activeShifts);
    countUnassigned.textContent   = String(unassigned);
    countFreeDrivers.textContent  = String(freeDrivers);
    countFreeVehicles.textContent = String(freeVehicles);
  }

  /* ============================================================
     Active shifts list
     ============================================================ */

  function renderActiveShifts() {
    activeShiftsEl.innerHTML = '';
    activeCountEl.textContent = String(shiftsCache.length);

    if (shiftsCache.length === 0) {
      const soft = el('div', 'empty-soft');
      soft.appendChild(el('div', 'empty-soft-title', 'No active shifts'));
      soft.appendChild(el('div', 'empty-soft-sub',
        'A shift opens when a driver taps a card.'));
      activeShiftsEl.appendChild(soft);
      return;
    }

    shiftsCache.forEach(s => {
      const row = el('div', 'active-shift-row');

      /* Plate */
      const plate = el('div', 'active-shift-plate', s.vehicle_plate || '—');
      row.appendChild(plate);

      /* Driver or unassigned */
      const driverCell = el('div', 'active-shift-driver');
      if (s.driver_id && s.driver_name) {
        driverCell.textContent = s.driver_name;
      } else {
        driverCell.appendChild(el('span', 'unassigned', 'Unassigned'));
      }
      row.appendChild(driverCell);

      /* Meta */
      const meta = el('div', 'active-shift-meta',
        `Started ${fmtTime(s.start_time)} · ${timeAgo(s.start_time)} ago`);
      row.appendChild(meta);

      /* Actions */
      const actions = el('div', 'active-shift-actions');

      const select = document.createElement('select');

      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '— Choose driver —';
      select.appendChild(optNone);

      driversCache.forEach(d => {
        const opt = document.createElement('option');
        opt.value = String(d.id);
        opt.textContent = d.name;
        select.appendChild(opt);
      });

      select.value = s.driver_id ? String(s.driver_id) : '';

      select.addEventListener('change', async () => {
        const newId = select.value ? Number(select.value) : null;
        try {
          await apiFetch(`/api/shifts/${s.id}/driver`, {
            method: 'PATCH',
            body: JSON.stringify({ driver_id: newId })
          });
          loadAll();
        } catch (err) {
          alert('Failed to assign driver: ' + err.message);
          select.value = s.driver_id ? String(s.driver_id) : '';
        }
      });

      actions.appendChild(select);

      const viewBtn = el('button', 'btn', 'View');
      viewBtn.addEventListener('click', () => {
        location.href = `shift.html?id=${s.id}`;
      });
      actions.appendChild(viewBtn);

      row.appendChild(actions);

      activeShiftsEl.appendChild(row);
    });
  }

  /* ============================================================
     Drivers column
     ============================================================ */

  function renderDrivers() {
    driversCol.innerHTML = '';
    driversCountEl.textContent = String(driversCache.length);

    if (driversCache.length === 0) {
      driversCol.appendChild(el('p', 'empty', 'No drivers.'));
      return;
    }

    const assignedByDriverId = {};
    shiftsCache.forEach(s => {
      if (s.driver_id) assignedByDriverId[s.driver_id] = s.vehicle_plate;
    });

    driversCache.forEach(d => {
      const item = el('div', 'pair-item');
      item.dataset.driverId = d.id;

      const left = el('div', 'pair-item-left');
      left.appendChild(el('div', 'pair-item-title', d.name));

      const subParts = [d.employee_id];
      if (d.phone) subParts.push(d.phone);
      left.appendChild(el('div', 'pair-item-sub', subParts.join(' · ')));

      const right = el('div', 'pair-item-right');

      if (assignedByDriverId[d.id]) {
        item.classList.add('assigned');
        right.appendChild(el('span', 'pair-item-badge assigned',
          `On ${assignedByDriverId[d.id]}`));
      } else {
        right.appendChild(el('span', 'pair-item-badge free', 'Free'));
      }

      item.appendChild(left);
      item.appendChild(right);

      if (selectedDriverId === d.id) item.classList.add('selected');

      item.addEventListener('click', () => {
        if (selectedDriverId === d.id) {
          selectedDriverId = null;
        } else {
          selectedDriverId = d.id;
        }
        renderDrivers();
        renderVehicles();
      });

      driversCol.appendChild(item);
    });
  }

  /* ============================================================
     Vehicles column
     ============================================================ */

  function renderVehicles() {
    vehiclesCol.innerHTML = '';
    vehiclesCountEl.textContent = String(vehiclesCache.length);

    if (vehiclesCache.length === 0) {
      vehiclesCol.appendChild(el('p', 'empty', 'No vehicles.'));
      return;
    }

    const assignedByVehicleId = {};
    shiftsCache.forEach(s => {
      if (s.vehicle_id) {
        assignedByVehicleId[s.vehicle_id] = s.driver_name || 'Unassigned';
      }
    });

    vehiclesCache.forEach(v => {
      const item = el('div', 'pair-item');
      item.dataset.vehicleId = v.id;

      const left = el('div', 'pair-item-left');
      left.appendChild(el('div', 'pair-item-title', v.plate));

      const subParts = [];
      if (v.make || v.model) subParts.push([v.make, v.model].filter(Boolean).join(' '));
      if (v.node_id) subParts.push(`Node ${v.node_id}`);
      left.appendChild(el('div', 'pair-item-sub', subParts.join(' · ') || 'no details'));

      const right = el('div', 'pair-item-right');

      if (assignedByVehicleId[v.id]) {
        item.classList.add('assigned');
        right.appendChild(el('span', 'pair-item-badge assigned',
          assignedByVehicleId[v.id]));
      } else {
        right.appendChild(el('span', 'pair-item-badge free', 'Free'));
      }

      item.appendChild(left);
      item.appendChild(right);

      if (selectedVehicleId === v.id) item.classList.add('selected');

      item.addEventListener('click', () => {
        if (selectedVehicleId === v.id) {
          selectedVehicleId = null;
        } else {
          selectedVehicleId = v.id;
        }
        renderDrivers();
        renderVehicles();
        tryPair();
      });

      vehiclesCol.appendChild(item);
    });
  }

  /* ============================================================
     Pairing logic
     ============================================================ */

  async function tryPair() {
    if (!selectedDriverId || !selectedVehicleId) return;

    const driverId = selectedDriverId;
    const vehicleId = selectedVehicleId;

    /* Find the open shift for the chosen vehicle */
    const shift = shiftsCache.find(s => s.vehicle_id === vehicleId);

    if (!shift) {
      alert('This vehicle has no open shift. A shift must be open (card tapped) before assigning a driver.');
      selectedDriverId = null;
      selectedVehicleId = null;
      renderDrivers();
      renderVehicles();
      return;
    }

    try {
      await apiFetch(`/api/shifts/${shift.id}/driver`, {
        method: 'PATCH',
        body: JSON.stringify({ driver_id: driverId })
      });
      selectedDriverId = null;
      selectedVehicleId = null;
      loadAll();
    } catch (err) {
      alert('Failed to pair: ' + err.message);
    }
  }

  /* ============================================================
     Boot
     ============================================================ */

  requestAnimationFrame(loadAll);
  setInterval(loadAll, 8000);
})();