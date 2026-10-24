/* Qafila — shift history with filters and CSV export */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const state = {
    driver: Q.qs('driver') || '',
    vehicle: Q.qs('vehicle') || '',
    status: Q.qs('status') || '',
    from: Q.qs('from') || '',
    to: Q.qs('to') || ''
  };
  let shifts = [];

  const tbody = h('tbody');
  const summary = h('span', { class: 'panel-sub' });

  const driverSel = h('select', { class: 'select select-sm', 'aria-label': 'Driver', style: { width: 'auto', minWidth: '170px' } },
    h('option', { value: '' }, 'All drivers'));
  const vehicleSel = h('select', { class: 'select select-sm', 'aria-label': 'Vehicle', style: { width: 'auto', minWidth: '140px' } },
    h('option', { value: '' }, 'All vehicles'));
  const fromIn = h('input', { class: 'input input-sm', type: 'date', value: state.from, 'aria-label': 'From date', style: { width: 'auto' } });
  const toIn = h('input', { class: 'input input-sm', type: 'date', value: state.to, 'aria-label': 'To date', style: { width: 'auto' } });

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Shift status' },
    [['', 'All'], ['1', 'Active'], ['0', 'Finished']].map(([v, l]) =>
      h('button', {
        type: 'button', 'aria-pressed': v === state.status ? 'true' : 'false',
        onclick: e => {
          state.status = v;
          seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
          load();
        }
      }, l)));

  [driverSel, vehicleSel].forEach((el, i) => el.addEventListener('change', () => {
    state[i === 0 ? 'driver' : 'vehicle'] = el.value; load();
  }));
  fromIn.addEventListener('change', () => { state.from = fromIn.value; load(); });
  toIn.addEventListener('change', () => { state.to = toIn.value; load(); });

  const exportBtn = h('button', { class: 'btn btn-sm', onclick: exportCsv }, icon('download'), 'Export CSV');
  const clearBtn = h('button', {
    class: 'btn btn-ghost btn-sm', onclick: () => {
      Object.assign(state, { driver: '', vehicle: '', status: '', from: '', to: '' });
      driverSel.value = vehicleSel.value = fromIn.value = toIn.value = '';
      seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'));
      load();
    }
  }, 'Clear filters');

  mount($('#page'),
    h('p', { class: 'page-lede' }, 'Every shift with its behaviour score. Reports are written within 30 seconds of the driver tapping out. Open a shift for the full report.'),
    h('section', { class: 'panel' },
      h('div', { class: 'toolbar' },
        driverSel, vehicleSel,
        h('span', { class: 'row', style: { gap: '6px' } }, fromIn, h('span', { class: 't-faint' }, 'to'), toIn),
        seg, clearBtn,
        h('span', { class: 'spacer' }), exportBtn),
      h('div', { class: 'panel-head', style: { minHeight: '0', padding: '10px 20px' } }, summary),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Score'),
            h('th', null, 'Driver'),
            h('th', null, 'Vehicle'),
            h('th', null, 'Started'),
            h('th', null, 'Duration'),
            h('th', null, 'Summary'),
            h('th', { class: 'actions' }, h('span', { class: 'sr-only' }, 'Open')))),
          tbody))));

  mount(tbody, Q.loadingRows(7, 5));

  async function loadFilters() {
    try {
      const [drivers, vehicles] = await Promise.all([
        Q.api.get('/api/drivers?all=1'),
        Q.api.get('/api/vehicles?all=1')
      ]);
      drivers.forEach(d => driverSel.appendChild(h('option', { value: d.id, selected: String(d.id) === state.driver ? true : null }, d.name + (d.active ? '' : ' (inactive)'))));
      vehicles.forEach(v => vehicleSel.appendChild(h('option', { value: v.id, selected: String(v.id) === state.vehicle ? true : null }, v.plate + (v.make ? ` ${v.make} ${v.model || ''}` : ''))));
    } catch (_) { /* filters are optional */ }
  }

  async function load() {
    const p = new URLSearchParams();
    if (state.driver) p.set('driver_id', state.driver);
    if (state.vehicle) p.set('vehicle_id', state.vehicle);
    if (state.status) p.set('active', state.status);
    if (state.from) p.set('from', state.from);
    if (state.to) p.set('to', state.to + ' 23:59:59');

    /* keep the URL shareable */
    const u = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => { if (v) u.set(k, v); });
    history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));

    try {
      shifts = await Q.api.get('/api/shifts?' + p) || [];
      render();
    } catch (err) {
      mount(tbody, h('tr', null, h('td', { colspan: 7 }, Q.errorBox(err, load))));
    }
  }

  function render() {
    const filtered = Object.values(state).some(Boolean);
    const scored = shifts.filter(s => s.behavior_score != null);
    const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.behavior_score, 0) / scored.length) : null;
    summary.textContent = shifts.length
      ? `${shifts.length === 200 ? 'Latest 200' : shifts.length} shift${shifts.length === 1 ? '' : 's'}` +
        (avg != null ? `, average score ${avg}` : '') +
        (shifts.some(s => s.active) ? `, ${shifts.filter(s => s.active).length} running now` : '')
      : '';

    if (!shifts.length) {
      mount(tbody, h('tr', null, h('td', { colspan: 7 },
        filtered
          ? Q.empty('search', 'No shifts match these filters', 'Widen the date range or clear the filters.')
          : Q.empty('shifts', 'No shifts recorded yet', 'Shifts appear here once a paired driver taps their card in a vehicle with a Qafila Node.'))));
      return;
    }

    mount(tbody, shifts.map(s => {
      const href = Q.pagePath('shift-report') + '?id=' + s.id;
      const tr = h('tr', { class: 'clickable', onclick: e => { if (!e.target.closest('a')) location.href = href; } },
        h('td', { style: { width: '64px' } }, s.active ? Q.led('duty', 'On shift') : Q.scoreDial(s.behavior_score)),
        h('td', null,
          h('div', { class: 'cell-main' }, s.driver_name || 'Driver removed'),
          h('div', { class: 'cell-sub' }, s.driver_employee_id || '')),
        h('td', null, s.vehicle_plate ? Q.plate(s.vehicle_plate, 'sm') : h('span', { class: 't-faint' }, 'Vehicle removed')),
        h('td', { class: 'nowrap' }, Q.fmtDateTime(s.start_time)),
        h('td', { class: 'nowrap' }, s.active
          ? h('span', { class: 'tag duty' }, 'Running, ' + Q.fmtDuration(Q.minutesBetween(s.start_time)))
          : Q.fmtDuration(Q.minutesBetween(s.start_time, s.end_time))),
        h('td', { style: { maxWidth: '420px' } },
          h('div', { class: 'cell-sub', style: { display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--ink-2)' } },
            s.behavior_paragraph || (s.active ? 'Report is written when the shift ends.' : 'Report pending, ready within 30 seconds.'))),
        h('td', { class: 'actions' }, h('a', { class: 'icon-btn', href, 'aria-label': 'Open shift report' }, icon('chevron'))));
      return tr;
    }));
  }

  function exportCsv() {
    if (!shifts.length) return Q.toast({ level: 'warn', title: 'Nothing to export', text: 'No shifts match the current filters.' });
    const esc = v => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['shift_id', 'driver', 'employee_id', 'vehicle', 'start_utc', 'end_utc', 'duration_min', 'score', 'summary'];
    const lines = shifts.map(s => [
      s.id, s.driver_name, s.driver_employee_id, s.vehicle_plate, s.start_time, s.end_time || '',
      Q.minutesBetween(s.start_time, s.end_time), s.behavior_score ?? '', s.behavior_paragraph || ''
    ].map(esc).join(','));
    Q.downloadText(`qafila-shifts-${new Date().toISOString().slice(0, 10)}.csv`, [head.join(','), ...lines].join('\n'));
  }

  loadFilters();
  load();
  Q.on('shift', Q.debounce(load, 800));
})();
