/* Qafila — operations: shifts running now, and the pairing board */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const liveBody = h('tbody');
  const liveCount = h('span', { class: 'count-pill' }, '0');
  const pairBody = h('div');
  const pairNote = h('span', { class: 'panel-sub' });

  mount($('#page'),
    h('p', { class: 'page-lede' },
      'Shifts start when a driver taps their card in a vehicle. The tap is accepted only for the driver paired with that vehicle, inside their shift window.'),
    h('section', { class: 'panel', 'aria-labelledby': 'live-title' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2', id: 'live-title' }, 'Active shifts'),
        liveCount),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Vehicle'),
            h('th', null, 'Driver'),
            h('th', null, 'Started'),
            h('th', null, 'Coolant'),
            h('th', null, 'Battery'),
            h('th', null, 'Speed'),
            h('th', null, 'Status'),
            h('th', { class: 'actions' }, h('span', { class: 'sr-only' }, 'Actions')))),
          liveBody))),
    h('section', { class: 'panel', 'aria-labelledby': 'pair-title' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2', id: 'pair-title' }, 'Pairing board', h('div', null, pairNote))),
      h('div', { class: 'panel-body flush' }, pairBody)));

  mount(liveBody, Q.loadingRows(8, 3));
  mount(pairBody, h('div', { style: { padding: '20px' } }, h('div', { class: 'skeleton', style: { height: '200px' } })));

  /* ============ Live shifts ============ */
  let live = [];
  let activeShifts = [];

  async function loadLive() {
    try {
      [live, activeShifts] = await Promise.all([
        Q.api.get('/api/telemetry/latest'),
        Q.api.get('/api/shifts/active')
      ]);
      renderLive();
    } catch (err) {
      mount(liveBody, h('tr', null, h('td', { colspan: 8 }, Q.errorBox(err, loadLive))));
    }
  }

  function renderLive() {
    liveCount.textContent = live.length;
    if (!live.length) {
      mount(liveBody, h('tr', null, h('td', { colspan: 8 }, Q.empty('card', 'Nobody is on shift',
        'When a paired driver taps their card, their vehicle appears here within a second, with live engine readings every 30 seconds.'))));
      return;
    }
    const byId = new Map(activeShifts.map(s => [s.id, s]));
    const rank = x => x.alerts.some(a => a.level === 'red') ? 0 : x.alerts.length ? 1 : 2;
    live.sort((a, b) => rank(a) - rank(b));
    mount(liveBody, live.map(x => liveRow(x, byId.get(x.shift_id) || {})));
  }

  function reading(value, digits, unit, cls) {
    return h('td', { class: 'nowrap' + (cls ? ' t-' + cls : ''), style: { fontWeight: '600' } },
      value === '—' ? h('span', { class: 't-faint' }, '—') : [value, h('span', { class: 'cell-sub', style: { fontWeight: '400' } }, ' ' + unit)]);
  }

  function liveRow(x, s) {
    const t = x.latest || {};
    const red = x.alerts.some(a => a.level === 'red');
    const lv = red ? 'crit' : x.alerts.length ? 'warn' : 'duty';
    const v = x.vehicle || {};
    const d = x.driver || {};
    const started = s.start_time;
    const recent = t.ts && Date.now() - Q.parseTs(t.ts).getTime() < 3 * 60e3;
    const label = red ? 'Critical' : x.alerts.length ? 'Warning' : recent ? 'Live' : 'On shift';

    const dur = h('span', null, Q.fmtDuration(Q.minutesBetween(started)));
    dur.dataset.since = started || '';
    const href = Q.pagePath('shift-report') + '?id=' + x.shift_id;

    return h('tr', { class: 'clickable', onclick: e => { if (!e.target.closest('a,button')) location.href = href; } },
      h('td', null, v.plate ? h('a', { href: Q.pagePath('vehicle') + '?id=' + v.id, title: 'Open vehicle details' }, Q.plate(v.plate)) : '—',
        h('div', { class: 'cell-sub', style: { marginTop: '4px' } }, [v.make, v.model].filter(Boolean).join(' '))),
      h('td', null,
        h('div', { class: 'cell-main' }, d.name || 'Unknown driver'),
        d.phone ? h('a', { class: 'cell-sub', href: 'tel:' + d.phone }, d.phone) : null),
      h('td', { class: 'nowrap' },
        h('div', { class: 'cell-main' }, Q.fmtTime(started)),
        h('div', { class: 'cell-sub' }, dur)),
      reading(Q.fmtNum(t.coolant, 0), 0, '°C', Q.readingClass('coolant', t.coolant)),
      reading(Q.fmtNum(t.voltage, 1), 1, 'V', Q.readingClass('voltage', t.voltage)),
      reading(Q.fmtNum(t.speed, 0), 0, 'km/h'),
      h('td', null,
        h('span', { class: 'state' }, Q.led(lv), label),
        x.alerts.length ? h('div', { class: 'cell-sub ellipsis', style: { maxWidth: '220px', color: red ? 'var(--signal-text)' : 'var(--road-text)' } }, x.alerts[0].message) : null),
      h('td', { class: 'actions' },
        d.phone ? h('a', { class: 'btn btn-xs' + (red ? ' btn-primary' : ''), href: 'tel:' + d.phone }, icon('phone'), 'Call driver') : null,
        h('a', { class: 'icon-btn', href, 'aria-label': 'Open shift', title: 'Open shift' }, icon('chevron'))));
  }

  /* tick durations without refetching */
  setInterval(() => {
    document.querySelectorAll('[data-since]').forEach(el => {
      if (el.dataset.since) el.textContent = Q.fmtDuration(Q.minutesBetween(el.dataset.since));
    });
  }, 30000);

  /* ============ Pairing board ============ */
  let vehicles = [];
  let drivers = [];
  let dragged = null; /* { driverId, fromVehicleId } */

  async function loadPairs() {
    try {
      [vehicles, drivers] = await Promise.all([
        Q.api.get('/api/vehicles'),
        Q.api.get('/api/drivers?all=1')
      ]);
      renderPairs();
    } catch (err) {
      mount(pairBody, Q.errorBox(err, loadPairs));
    }
  }

  function driverChip(d, fromVehicleId) {
    const chip = h('span', {
      class: 'driver-chip' + (d.active ? '' : ' inactive'),
      draggable: 'true',
      title: 'Drag onto a vehicle to pair'
    },
      h('span', { class: 'avatar' }, Q.initials(d.name)),
      h('span', { class: 'name' }, d.name),
      d.active ? null : h('span', { class: 'tag' }, 'Inactive'));
    chip.addEventListener('dragstart', e => {
      dragged = { driverId: d.id, fromVehicleId };
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(d.id));
    });
    chip.addEventListener('dragend', () => { chip.classList.remove('dragging'); dragged = null; });
    return chip;
  }

  function renderPairs() {
    const active = vehicles.filter(v => v.active);
    const unpaired = active.filter(v => !v.default_driver_id).length;
    pairNote.textContent = unpaired
      ? `${unpaired} vehicle${unpaired === 1 ? ' has' : 's have'} no driver. Taps in ${unpaired === 1 ? 'it' : 'them'} are refused.`
      : 'Every vehicle has a paired driver. Drag a driver onto a vehicle to change it.';

    if (!active.length) {
      mount(pairBody, Q.empty('vehicles', 'No vehicles to pair',
        'Import your fleet CSV first. Each row pairs a driver with a vehicle.',
        h('a', { class: 'btn btn-primary btn-sm', href: Q.pagePath('import') }, 'Import CSV')));
      return;
    }

    const byId = new Map(drivers.map(d => [d.id, d]));

    const vehicleRows = active.map(v => {
      const d = byId.get(v.default_driver_id);
      const slot = h('div', { class: 'slot' + (d ? ' filled' : '') },
        d ? driverChip(d, v.id) : h('span', { class: 'slot-empty' }, 'Drop a driver here'),
        d ? h('button', {
          class: 'icon-btn danger', style: { marginLeft: 'auto' }, 'aria-label': `Unassign ${d.name} from ${v.plate}`, title: 'Unassign',
          onclick: async () => {
            try { await Q.fleet.pair(v, null); loadPairs(); } catch (err) { Q.toast({ level: 'crit', title: 'Could not unassign', text: err.message }); }
          }
        }, icon('x')) : null);

      slot.addEventListener('dragover', e => { if (dragged) { e.preventDefault(); slot.classList.add('over'); } });
      slot.addEventListener('dragleave', () => slot.classList.remove('over'));
      slot.addEventListener('drop', async e => {
        e.preventDefault();
        slot.classList.remove('over');
        if (!dragged || dragged.fromVehicleId === v.id) return;
        const drv = byId.get(dragged.driverId);
        const from = dragged.fromVehicleId ? active.find(x => x.id === dragged.fromVehicleId) : null;
        try {
          await Q.fleet.pair(v, drv);
          if (from) await Q.api.patch(`/api/vehicles/${from.id}/pair`, { driver_id: null });
        } catch (err) {
          Q.toast({ level: 'crit', title: 'Pairing failed', text: err.message });
        }
        loadPairs();
      });

      const changeBtn = h('button', { class: 'btn btn-xs', type: 'button' }, d ? 'Change' : 'Pair driver');
      changeBtn.addEventListener('click', () => Q.fleet.pairPicker(changeBtn, v, drivers, loadPairs));

      return h('div', { class: 'pair-row' },
        h('div', { style: { minWidth: '150px' } },
          Q.plate(v.plate),
          h('div', { class: 'cell-sub', style: { marginTop: '4px' } },
            [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle',
            v.vehicle_type ? `, ${String(Q.typeLabel(v.vehicle_type)).toLowerCase()}` : '')),
        slot,
        changeBtn);
    });

    /* driver pool */
    const pairedCount = new Map();
    active.forEach(v => { if (v.default_driver_id) pairedCount.set(v.default_driver_id, (pairedCount.get(v.default_driver_id) || 0) + 1); });
    const pool = drivers.slice().sort((a, b) => (b.active - a.active) || ((pairedCount.get(a.id) ? 1 : 0) - (pairedCount.get(b.id) ? 1 : 0)) || a.name.localeCompare(b.name));

    mount(pairBody,
      h('div', { class: 'pair-layout' },
        h('div', { class: 'pair-col' },
          h('div', { class: 'pair-col-head' }, icon('vehicles'), `Vehicles (${active.length})`),
          vehicleRows),
        h('div', { class: 'pair-col' },
          h('div', { class: 'pair-col-head' }, icon('drivers'), `Drivers (${drivers.length})`),
          h('div', { class: 'pool' },
            pool.length ? pool.map(d => {
              const n = pairedCount.get(d.id) || 0;
              return h('div', { class: 'pool-item' },
                driverChip(d, null),
                h('span', { class: 'cell-sub nowrap' + (n || !d.active ? '' : ' t-warn') },
                  !d.active ? '' : n ? `${n} vehicle${n === 1 ? '' : 's'}` : 'Not paired'));
            }) : Q.empty(null, 'No drivers', 'Add drivers on the Drivers page or import a CSV.')))));
  }

  /* ============ Boot + live ============ */
  loadLive();
  loadPairs();
  const refresh = Q.debounce(() => { loadLive(); }, 500);
  Q.on('shift', refresh);
  Q.on('alert', refresh);
  Q.on('fleet', Q.debounce(loadPairs, 500));
  setInterval(() => { if (!document.hidden) loadLive(); }, 30000);
})();
