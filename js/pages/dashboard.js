/* Qafila — dashboard: metrics, emergency alerts, predictions, recent reports */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  /* ---------- Layout ---------- */
  const metric = (key, label) => {
    const value = h('div', { class: 'metric-value' }, '—');
    const sub = h('div', { class: 'metric-sub' }, ' ');
    const ledEl = Q.led('off');
    const card = h('a', { class: 'metric', href: '#' },
      h('div', { class: 'metric-top' }, h('span', { class: 'metric-label' }, label), ledEl),
      value, sub);
    return { key, card, value, sub, ledEl };
  };
  const M = {
    shifts: metric('shifts', 'Shifts'),
    drivers: metric('drivers', 'Drivers'),
    vehicles: metric('vehicles', 'Vehicles'),
    crit: metric('crit', 'Critical'),
    warn: metric('warn', 'Warning')
  };
  M.shifts.card.href = Q.pagePath('operations');
  M.drivers.card.href = Q.pagePath('drivers');
  M.vehicles.card.href = Q.pagePath('vehicles');
  M.crit.card.href = '#alerts';
  M.warn.card.href = '#alerts';

  const alertsBody = h('div', { class: 'alert-list' });
  const alertsCount = h('span', { class: 'count-pill' }, '0');
  const predBody = h('div', { class: 'list' });
  const reportsBody = h('div', { class: 'list' });

  let alertFilter = 'open';
  const filterSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Alert filter' },
    [['open', 'All unresolved'], ['red', 'Critical only']].map(([v, label]) =>
      h('button', {
        type: 'button', 'aria-pressed': v === alertFilter ? 'true' : 'false',
        onclick: e => {
          alertFilter = v;
          filterSeg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
          renderAlerts();
        }
      }, label)));

  mount($('#page'),
    h('section', { class: 'metrics', 'aria-label': 'Fleet overview' }, Object.values(M).map(m => m.card)),
    h('section', { class: 'panel', id: 'alerts', 'aria-labelledby': 'alerts-title' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2', id: 'alerts-title' }, 'Emergency alerts'),
        alertsCount,
        filterSeg),
      h('div', { class: 'panel-body flush' }, alertsBody)),
    h('div', { class: 'cols-even' },
      h('section', { class: 'panel', 'aria-labelledby': 'pred-title' },
        h('div', { class: 'panel-head' },
          h('h2', { class: 't-h2', id: 'pred-title' }, 'Maintenance predictions'),
          h('a', { class: 'btn btn-ghost btn-sm', href: Q.pagePath('predictions') }, 'View all')),
        h('div', { class: 'panel-body flush' }, predBody)),
      h('section', { class: 'panel', 'aria-labelledby': 'rep-title' },
        h('div', { class: 'panel-head' },
          h('h2', { class: 't-h2', id: 'rep-title' }, 'Recent reports'),
          h('a', { class: 'btn btn-ghost btn-sm', href: Q.pagePath('shifts') }, 'View all')),
        h('div', { class: 'panel-body flush' }, reportsBody))));

  [alertsBody, predBody, reportsBody].forEach(el =>
    mount(el, h('div', { style: { padding: '20px', display: 'grid', gap: '12px' } },
      h('div', { class: 'skeleton', style: { height: '14px', width: '70%' } }),
      h('div', { class: 'skeleton', style: { height: '14px', width: '45%' } }))));

  /* ---------- Metrics ---------- */
  let alerts = [];

  function setMetric(m, value, sub, ledCls) {
    m.value.textContent = value;
    m.sub.textContent = sub;
    m.ledEl.className = 'led ' + (ledCls || 'off');
    m.card.classList.toggle('is-crit', ledCls === 'crit');
    m.card.classList.toggle('is-warn', ledCls === 'warn');
  }

  async function loadMetrics() {
    try {
      const [vehicles, drivers, active] = await Promise.all([
        Q.api.get('/api/vehicles'),
        Q.api.get('/api/drivers'),
        Q.api.get('/api/shifts/active')
      ]);
      const unpaired = vehicles.filter(v => !(v.drivers || []).length).length;
      const unbound = vehicles.filter(v => v.board_status === 'unbound').length;
      const freeDrivers = drivers.filter(d => !d.paired_plates).length;

      setMetric(M.shifts, active.length, active.length ? 'running now' : 'nobody on shift', active.length ? 'duty' : 'off');
      setMetric(M.drivers, drivers.length,
        freeDrivers ? `${freeDrivers} not paired` : 'all paired', 'off');
      setMetric(M.vehicles, vehicles.length,
        unbound ? `${unbound} without a board` : unpaired ? `${unpaired} without a driver` : 'all ready', unbound || unpaired ? 'warn' : 'ok');
    } catch (err) {
      Object.values(M).slice(0, 3).forEach(m => setMetric(m, '—', 'could not load', 'off'));
    }
  }

  /* ---------- Alerts ---------- */
  async function loadAlerts() {
    try {
      alerts = await Q.api.get('/api/alerts/live') || [];
      alerts.sort((a, b) => (a.ts < b.ts ? 1 : -1)); /* most recent first */
      renderAlerts();
    } catch (err) {
      mount(alertsBody, Q.errorBox(err, loadAlerts));
    }
  }

  function renderAlerts() {
    const crit = alerts.filter(a => a.level === 'red').length;
    const warn = alerts.length - crit;
    setMetric(M.crit, crit, crit ? 'need action now' : 'none open', crit ? 'crit' : 'off');
    setMetric(M.warn, warn, warn ? 'to check today' : 'none open', warn ? 'warn' : 'off');

    const list = alertFilter === 'red' ? alerts.filter(a => a.level === 'red') : alerts;
    alertsCount.textContent = alerts.length;
    alertsCount.className = 'count-pill' + (crit ? ' crit' : '');

    if (!list.length) {
      mount(alertsBody, Q.empty('check', alertFilter === 'red' ? 'No critical alerts' : 'All clear',
        'Coolant, battery and fuel trim are inside safe limits on every vehicle. New alerts appear here the moment they fire.'));
      return;
    }
    mount(alertsBody, list.slice(0, 40).map(alertRow));
  }

  function alertRow(a) {
    const lv = Q.levelClass(a.level);
    const report = a.shift_id ? Q.pagePath('shift-report') + '?id=' + a.shift_id : null;

    const ack = a.acknowledged ? null : h('button', {
      class: 'btn btn-xs', onclick: async e => {
        e.stopPropagation();
        Q.busy(e.currentTarget, true, '');
        try {
          await Q.api.post(`/api/alerts/${a.id}/acknowledge`);
          a.acknowledged = 1;
          renderAlerts();
        } catch (err) { Q.toast({ level: 'crit', title: 'Could not acknowledge', text: err.message }); renderAlerts(); }
      }
    }, 'Acknowledge');

    const resolve = h('button', {
      class: 'btn btn-xs', title: 'Mark as resolved', onclick: async e => {
        e.stopPropagation();
        Q.busy(e.currentTarget, true, '');
        try {
          await Q.api.post(`/api/alerts/${a.id}/resolve`);
          alerts = alerts.filter(x => x.id !== a.id);
          renderAlerts();
          Q.refreshAlertCount();
          Q.toast({ title: 'Alert resolved', text: a.message });
        } catch (err) { Q.toast({ level: 'crit', title: 'Could not resolve', text: err.message }); renderAlerts(); }
      }
    }, icon('check'), 'Resolve');

    const call = a.driver_phone
      ? h('a', { class: 'btn btn-xs' + (lv === 'crit' ? ' btn-primary' : ''), href: 'tel:' + a.driver_phone, onclick: e => e.stopPropagation() }, icon('phone'), 'Call driver')
      : null;

    const row = h('div', {
      class: 'alert-row ' + lv + (report ? ' clickable' : ''),
      role: report ? 'link' : null,
      tabindex: report ? '0' : null,
      title: report ? 'Open the shift report' : null
    },
      Q.led(lv),
      h('div', { class: 'grow' },
        h('div', { class: 'alert-msg' },
          a.message,
          a.type === 'gasket' ? h('span', { class: 'tag ' + lv, style: { marginLeft: '8px' } }, 'Gasket') : null),
        h('div', { class: 'alert-meta' },
          a.vehicle_plate ? Q.plate(a.vehicle_plate, 'sm') : null,
          h('span', null, a.driver_name || 'No driver on shift'),
          h('span', null, `${Q.fmtDateTime(a.ts)}, ${Q.fmtAgo(a.ts)}`),
          a.acknowledged ? h('span', { class: 'tag' }, 'Acknowledged') : null)),
      h('div', { class: 'alert-actions' }, call, ack, resolve));

    if (report) {
      row.addEventListener('click', () => { location.href = report; });
      row.addEventListener('keydown', e => { if (e.key === 'Enter') location.href = report; });
    }
    return row;
  }

  /* ---------- Predictions ---------- */
  async function loadPredictions() {
    try {
      const [preds, gasket] = await Promise.all([
        Q.api.get('/api/predictions?resolved=0&limit=20'),
        Q.api.get('/api/gasket/status').catch(() => [])
      ]);
      const rows = [];

      (gasket || []).filter(g => g.status === 'suspect').forEach(g => rows.push(
        h('a', { class: 'list-row', href: Q.pagePath('predictions') + '#gasket' },
          Q.plate(g.plate, 'sm'),
          h('div', { class: 'grow' },
            h('div', { class: 'cell-main' }, 'Head gasket suspected'),
            h('div', { class: 'cell-sub ellipsis' }, g.flags.map(f => f.label).join(', '))),
          h('span', { class: 'tag crit' }, 'Inspect'))));

      (preds || []).slice(0, 5).forEach(p => {
        const weeks = [p.w1, p.w2, p.w3, p.w4].filter(x => x !== null && x !== undefined);
        rows.push(h('a', { class: 'list-row', href: Q.pagePath('predictions') },
          Q.plate(p.vehicle_plate, 'sm'),
          h('div', { class: 'grow' },
            h('div', { class: 'cell-main' }, Q.STREAM_LABEL[p.stream] || p.stream),
            h('div', { class: 'cell-sub' },
              `${p.slope > 0 ? '+' : ''}${Number(p.slope).toFixed(2)} ${Q.STREAM_UNIT[p.stream] || ''} per week`)),
          h('div', { class: 'trend-cell' }, Q.spark(weeks, { dots: true }))));
      });

      mount(predBody, rows.length ? rows : Q.empty('predictions', 'No trends to act on',
        'Every Thursday at 10:00 PM, Qafila fits a four-week trend to each vehicle. Anything drifting toward a fault shows up here.'));
    } catch (err) {
      mount(predBody, Q.errorBox(err, loadPredictions));
    }
  }

  /* ---------- Recent reports ---------- */
  async function loadReports() {
    try {
      const shifts = await Q.api.get('/api/shifts?active=0') || [];
      const recent = shifts.slice(0, 6);
      mount(reportsBody, recent.length ? recent.map(s =>
        h('a', { class: 'list-row', href: Q.pagePath('shift-report') + '?id=' + s.id },
          Q.scoreDial(s.behavior_score),
          h('div', { class: 'grow' },
            h('div', { class: 'cell-main ellipsis' }, s.driver_name || 'Unknown driver'),
            h('div', { class: 'cell-sub' },
              `${Q.fmtTime(s.start_time)} to ${Q.fmtTime(s.end_time)}, ${Q.fmtDuration(Q.minutesBetween(s.start_time, s.end_time))}`)),
          s.vehicle_plate ? Q.plate(s.vehicle_plate, 'sm') : null))
        : Q.empty('shifts', 'No finished shifts yet',
            'When a driver taps their card at the end of a shift, the behaviour report lands here within 30 seconds.'));
    } catch (err) {
      mount(reportsBody, Q.errorBox(err, loadReports));
    }
  }

  /* ---------- Boot + live updates ---------- */
  loadMetrics();
  loadAlerts();
  loadPredictions();
  loadReports();

  const refreshLive = Q.debounce(() => { loadMetrics(); loadAlerts(); }, 600);
  Q.on('alert', refreshLive);
  Q.on('alerts-changed', refreshLive);
  Q.on('shift', () => { refreshLive(); setTimeout(loadReports, 35000); });
  Q.on('fleet', refreshLive);
  Q.on('node', refreshLive);

  setInterval(() => { if (!document.hidden) { loadMetrics(); loadAlerts(); } }, 30000);
  setInterval(() => { if (!document.hidden) loadReports(); }, 120000);
})();
