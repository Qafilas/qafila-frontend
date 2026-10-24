/* Qafila — alert history: every alert, open and resolved, with filters */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const state = {
    status: Q.qs('status') || 'all',     /* all | open | resolved */
    level: Q.qs('level') || '',          /* '' | red | yellow */
    type: Q.qs('type') || '',            /* '' | emergency | gasket */
    vehicle: Q.qs('vehicle') || '',
    from: Q.qs('from') || '',
    to: Q.qs('to') || ''
  };
  let alerts = [];

  const tbody = h('tbody');
  const summary = h('span', { class: 'panel-sub' });

  function seg(key, options, label) {
    const el = h('div', { class: 'seg', role: 'group', 'aria-label': label },
      options.map(([v, l]) => h('button', {
        type: 'button', 'aria-pressed': v === state[key] ? 'true' : 'false',
        onclick: e => {
          state[key] = v;
          el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
          load();
        }
      }, l)));
    return el;
  }

  const statusSeg = seg('status', [['all', 'All'], ['open', 'Open'], ['resolved', 'Resolved']], 'Status');
  const levelSeg = seg('level', [['', 'Any level'], ['red', 'Critical'], ['yellow', 'Warning']], 'Level');
  const typeSel = h('select', { class: 'select select-sm', 'aria-label': 'Type', style: { width: 'auto' } },
    h('option', { value: '' }, 'All types'),
    h('option', { value: 'emergency', selected: state.type === 'emergency' ? true : null }, 'Engine and battery'),
    h('option', { value: 'gasket', selected: state.type === 'gasket' ? true : null }, 'Head gasket'));
  const vehicleSel = h('select', { class: 'select select-sm', 'aria-label': 'Vehicle', style: { width: 'auto', minWidth: '140px' } },
    h('option', { value: '' }, 'All vehicles'));
  const fromIn = h('input', { class: 'input input-sm', type: 'date', value: state.from, 'aria-label': 'From date', style: { width: 'auto' } });
  const toIn = h('input', { class: 'input input-sm', type: 'date', value: state.to, 'aria-label': 'To date', style: { width: 'auto' } });

  typeSel.addEventListener('change', () => { state.type = typeSel.value; load(); });
  vehicleSel.addEventListener('change', () => { state.vehicle = vehicleSel.value; load(); });
  fromIn.addEventListener('change', () => { state.from = fromIn.value; load(); });
  toIn.addEventListener('change', () => { state.to = toIn.value; load(); });

  mount($('#page'),
    h('p', { class: 'page-lede' }, 'Every alert the fleet has raised, open and resolved. Click a row to open the shift it happened in.'),
    h('section', { class: 'panel' },
      h('div', { class: 'toolbar' },
        statusSeg, levelSeg, typeSel, vehicleSel,
        h('span', { class: 'row', style: { gap: '6px' } }, fromIn, h('span', { class: 't-faint' }, 'to'), toIn)),
      h('div', { class: 'panel-head', style: { minHeight: '0', padding: '10px 20px' } }, summary),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, ''),
            h('th', null, 'Alert'),
            h('th', null, 'Vehicle'),
            h('th', null, 'Driver'),
            h('th', null, 'When'),
            h('th', null, 'Status'),
            h('th', { class: 'actions' }, h('span', { class: 'sr-only' }, 'Actions')))),
          tbody))));

  mount(tbody, Q.loadingRows(7, 5));

  async function loadVehicles() {
    try {
      const vs = await Q.api.get('/api/vehicles?all=1');
      vs.forEach(v => vehicleSel.appendChild(h('option', { value: v.id, selected: String(v.id) === state.vehicle ? true : null }, v.plate)));
    } catch (_) { /* optional */ }
  }

  async function load() {
    const p = new URLSearchParams({ limit: '300' });
    if (state.status === 'open') p.set('resolved', '0');
    if (state.status === 'resolved') p.set('resolved', '1');
    if (state.level) p.set('level', state.level);
    if (state.type) p.set('type', state.type);
    if (state.vehicle) p.set('vehicle_id', state.vehicle);
    if (state.from) p.set('from', state.from);
    if (state.to) p.set('to', state.to + ' 23:59:59');

    const u = new URLSearchParams();
    Object.entries(state).forEach(([k, v]) => { if (v && !(k === 'status' && v === 'all')) u.set(k, v); });
    history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));

    try {
      alerts = await Q.api.get('/api/alerts?' + p) || [];
      render();
    } catch (err) {
      mount(tbody, h('tr', null, h('td', { colspan: 7 }, Q.errorBox(err, load))));
    }
  }

  function render() {
    const crit = alerts.filter(a => a.level === 'red').length;
    const open = alerts.filter(a => !a.resolved).length;
    summary.textContent = alerts.length
      ? `${alerts.length === 300 ? 'Latest 300' : alerts.length} alert${alerts.length === 1 ? '' : 's'}, ${crit} critical, ${open} still open`
      : '';

    if (!alerts.length) {
      mount(tbody, h('tr', null, h('td', { colspan: 7 },
        Q.empty('check', 'No alerts match', 'Try another filter or a wider date range.'))));
      return;
    }

    mount(tbody, alerts.map(a => {
      const lv = Q.levelClass(a.level);
      const href = a.shift_id ? Q.pagePath('shift-report') + '?id=' + a.shift_id : null;
      const status = a.resolved ? h('span', { class: 'tag ok' }, 'Resolved')
        : a.acknowledged ? h('span', { class: 'tag' }, 'Acknowledged')
        : h('span', { class: 'tag ' + lv }, 'Open');

      const resolveBtn = !a.resolved ? h('button', {
        class: 'btn btn-xs', onclick: async e => {
          e.stopPropagation();
          Q.busy(e.currentTarget, true, '');
          try {
            await Q.api.post(`/api/alerts/${a.id}/resolve`);
            a.resolved = 1;
            render();
            Q.refreshAlertCount();
          } catch (err) { Q.toast({ level: 'crit', title: 'Could not resolve', text: err.message }); render(); }
        }
      }, icon('check'), 'Resolve') : null;

      return h('tr', { class: (href ? 'clickable ' : '') + (a.resolved ? 'is-inactive' : ''), onclick: e => { if (href && !e.target.closest('a,button')) location.href = href; } },
        h('td', { style: { width: '28px' } }, Q.led(lv)),
        h('td', null,
          h('div', { class: 'cell-main' }, a.message),
          a.type === 'gasket' ? h('div', { class: 'cell-sub' }, 'Head gasket symptom') : null),
        h('td', null, a.vehicle_plate
          ? h('a', { href: Q.pagePath('vehicle') + '?id=' + a.vehicle_id, onclick: e => e.stopPropagation() }, Q.plate(a.vehicle_plate, 'sm'))
          : h('span', { class: 't-faint' }, '—')),
        h('td', null, a.driver_name || h('span', { class: 't-faint' }, 'No driver on shift')),
        h('td', { class: 'nowrap' }, h('div', null, Q.fmtDateTime(a.ts)), h('div', { class: 'cell-sub' }, Q.fmtAgo(a.ts))),
        h('td', null, status),
        h('td', { class: 'actions' },
          a.driver_phone && !a.resolved ? h('a', { class: 'btn btn-xs', href: 'tel:' + a.driver_phone, onclick: e => e.stopPropagation(), style: { marginRight: '6px' } }, icon('phone'), 'Call driver') : null,
          resolveBtn));
    }));
  }

  loadVehicles();
  load();
  Q.on('alert', Q.debounce(load, 600));
})();
