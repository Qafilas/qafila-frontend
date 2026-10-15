/* Qafila shifts page — table with filters */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const fDriver   = document.getElementById('f-driver');
  const fVehicle  = document.getElementById('f-vehicle');
  const fFrom     = document.getElementById('f-from');
  const fTo       = document.getElementById('f-to');
  const fActive   = document.getElementById('f-active');
  const fClear    = document.getElementById('f-clear');

  const tableWrap = document.getElementById('shifts-table-wrap');
  const shiftsCount = document.getElementById('shifts-count');

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts + 'Z');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`;
  }

  function fmtDuration(startTs, endTs) {
    if (!startTs) return '—';
    const start = new Date(startTs + 'Z');
    const end = endTs ? new Date(endTs + 'Z') : new Date();
    const sec = Math.max(0, Math.floor((end - start) / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  /* ============================================================
     Populate filter dropdowns once
     ============================================================ */

  async function populateFilters() {
    try {
      const [drivers, vehicles] = await Promise.all([
        apiFetch('/api/drivers'),
        apiFetch('/api/vehicles')
      ]);

      if (Array.isArray(drivers)) {
        drivers.forEach(d => {
          const opt = document.createElement('option');
          opt.value = String(d.id);
          opt.textContent = d.name;
          fDriver.appendChild(opt);
        });
      }

      if (Array.isArray(vehicles)) {
        vehicles.forEach(v => {
          const opt = document.createElement('option');
          opt.value = String(v.id);
          opt.textContent = v.plate;
          fVehicle.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('[shifts] populateFilters failed:', err.message);
    }
  }

  /* ============================================================
     Build query string from filters
     ============================================================ */

  function buildQuery() {
    const params = new URLSearchParams();

    if (fDriver.value)  params.append('driver_id', fDriver.value);
    if (fVehicle.value) params.append('vehicle_id', fVehicle.value);
    if (fFrom.value)    params.append('from', fFrom.value);
    if (fTo.value)      params.append('to', fTo.value);
    if (fActive.checked) params.append('active', '1');

    return params.toString();
  }

  /* ============================================================
     Load shifts
     ============================================================ */

  async function loadShifts() {
    try {
      const qs = buildQuery();
      const url = '/api/shifts' + (qs ? ('?' + qs) : '');
      const data = await apiFetch(url);

      tableWrap.innerHTML = '';
      shiftsCount.textContent = String(Array.isArray(data) ? data.length : 0);

      if (!data || data.length === 0) {
        const soft = el('div', 'empty-soft');
        soft.appendChild(el('div', 'empty-soft-title', 'No shifts found'));
        soft.appendChild(el('div', 'empty-soft-sub',
          'Adjust the filters or wait for a driver to tap a card.'));
        tableWrap.appendChild(soft);
        return;
      }

      const table = el('table', 'shift-table');

      const thead = el('thead');
      const headRow = el('tr');
      ['Date', 'Driver', 'Vehicle', 'Duration', 'Score', 'Status']
        .forEach(h => headRow.appendChild(el('th', '', h)));
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = el('tbody');

      data.forEach(s => {
        const tr = el('tr');

        tr.appendChild(el('td', 'td-date', fmtDate(s.start_time)));

        const driverCell = el('td', 'td-driver');
        if (s.driver_name) {
          driverCell.textContent = s.driver_name;
        } else {
          driverCell.classList.add('unassigned');
          driverCell.textContent = 'Unassigned';
        }
        tr.appendChild(driverCell);

        tr.appendChild(el('td', 'td-plate', s.vehicle_plate || '—'));

        tr.appendChild(el('td', '', fmtDuration(s.start_time, s.end_time)));

        const scoreCell = el('td', 'td-score');
        if (s.behavior_score != null) {
          scoreCell.textContent = String(s.behavior_score);
        } else {
          scoreCell.classList.add('muted');
          scoreCell.textContent = '—';
        }
        tr.appendChild(scoreCell);

        const statusCell = el('td');
        const badge = el('span',
          `status-badge ${s.active ? 'active' : 'ended'}`,
          s.active ? 'Active' : 'Ended');
        statusCell.appendChild(badge);
        tr.appendChild(statusCell);

        tr.addEventListener('click', () => {
          location.href = `shift-report.html?id=${s.id}`;
        });

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      tableWrap.appendChild(table);
    } catch (err) {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(el('p', 'empty', 'Failed to load shifts: ' + err.message));
    }
  }

  /* ============================================================
     Event wiring
     ============================================================ */

  [fDriver, fVehicle, fFrom, fTo, fActive].forEach(ctrl => {
    ctrl.addEventListener('change', loadShifts);
  });

  fClear.addEventListener('click', () => {
    fDriver.value = '';
    fVehicle.value = '';
    fFrom.value = '';
    fTo.value = '';
    fActive.checked = false;
    loadShifts();
  });

  /* ============================================================
     Boot
     ============================================================ */

  requestAnimationFrame(async () => {
    await populateFilters();
    loadShifts();
  });

  setInterval(loadShifts, 15000);
})();