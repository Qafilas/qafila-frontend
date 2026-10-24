/* Qafila — vehicle detail: health trends, predictions, shifts, alerts */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const id = Q.qs('id');
  const page = $('#page');
  let days = Number(Q.qs('days')) || 42;

  if (!id) {
    mount(page, Q.empty('vehicles', 'No vehicle selected', 'Open a vehicle from the Vehicles page.',
      h('a', { class: 'btn btn-primary btn-sm', href: Q.pagePath('vehicles') }, 'Go to vehicles')));
    return;
  }

  mount(page, h('div', { class: 'skeleton', style: { height: '150px' } }), h('div', { class: 'skeleton', style: { height: '420px' } }));

  /* The five streams the weekly prediction watches (load/speed shown in the list only) */
  const STREAMS = [
    { key: 'coolant', title: 'Coolant temperature', unit: '°C', digits: 1,
      refs: [{ v: 90, label: '90 °C warning', cls: 'warn' }, { v: 105, label: '105 °C critical', cls: 'crit' }] },
    { key: 'voltage', title: 'Battery voltage', unit: 'V', digits: 2,
      refs: [{ v: 13.5, label: '13.5 V warning', cls: 'warn' }, { v: 12.5, label: '12.5 V critical', cls: 'crit' }] },
    { key: 'ltft', title: 'Long-term fuel trim', unit: '%', digits: 1,
      refs: [{ v: 15, label: '+15% warning', cls: 'warn' }] },
    { key: 'stft', title: 'Short-term fuel trim', unit: '%', digits: 1,
      refs: [{ v: 15, label: '+15% warning', cls: 'warn' }] }
  ];

  const dayDate = d => new Date(d + 'T12:00:00');
  const shortDay = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  async function load() {
    try {
      const [v, hist, shifts, alerts, preds, gasket] = await Promise.all([
        Q.api.get('/api/vehicles/' + encodeURIComponent(id)),
        Q.api.get(`/api/vehicles/${encodeURIComponent(id)}/history?days=${days}`),
        Q.api.get('/api/shifts?vehicle_id=' + encodeURIComponent(id)),
        Q.api.get('/api/alerts?limit=15&vehicle_id=' + encodeURIComponent(id)),
        Q.api.get('/api/predictions?resolved=0&vehicle_id=' + encodeURIComponent(id)),
        Q.api.get('/api/gasket/status').catch(() => [])
      ]);
      render(v, hist, shifts, alerts, preds, (gasket || []).find(g => String(g.vehicle_id) === String(v.id)));
    } catch (err) {
      mount(page, err.status === 404
        ? Q.empty('vehicles', 'Vehicle not found', 'It may have been deleted.',
            h('a', { class: 'btn btn-primary btn-sm', href: Q.pagePath('vehicles') }, 'Go to vehicles'))
        : Q.errorBox(err, load));
    }
  }

  function trendPanel(s, daily) {
    const points = daily.filter(d => d[s.key] !== null).map(d => ({ t: dayDate(d.day), v: Number(d[s.key]) }));
    const last = points[points.length - 1];
    const weekAgo4 = points.find(p => last && last.t - p.t <= 28 * 864e5);
    let change = last && weekAgo4 && weekAgo4 !== last ? last.v - weekAgo4.v : null;
    if (change !== null && Math.abs(change) < 0.5 * Math.pow(10, -s.digits)) change = 0;
    const cls = last ? Q.readingClass(s.key === 'ltft' || s.key === 'stft' ? 'trim' : s.key, last.v) : '';

    return h('div', { class: 'trend' },
      h('div', { class: 'trend-head' },
        h('div', null,
          h('div', { class: 't-h3' }, s.title),
          h('div', { class: 'cell-sub' }, 'Daily average')),
        h('div', { class: 'trend-now' },
          h('div', { class: 'trend-val ' + (cls ? 't-' + cls : '') }, last ? `${last.v.toFixed(s.digits)} ${s.unit}` : '—'),
          change !== null ? h('div', { class: 'cell-sub' },
            `${change >= 0 ? '+' : ''}${change.toFixed(s.digits)} ${s.unit} over 4 weeks`) : null)),
      Q.lineChart({
        points, unit: s.unit, digits: s.digits, refs: s.refs, markers: points.length <= 45,
        height: 190, gapMs: 3 * 864e5, label: `${s.title}, daily average`,
        tickFormat: shortDay,
        tipTime: d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        emptyText: 'No readings in this period.'
      }));
  }

  function render(v, hist, shifts, alerts, preds, gasket) {
    const st = Q.vehicleState(v);
    $('#page-title').textContent = `Vehicle ${v.plate}`;
    document.title = `${v.plate} – Qafila`;

    const rangeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Period' },
      [[28, '4 weeks'], [42, '6 weeks'], [84, '12 weeks']].map(([n, l]) =>
        h('button', {
          type: 'button', 'aria-pressed': n === days ? 'true' : 'false',
          onclick: () => { days = n; history.replaceState(null, '', `?id=${id}&days=${n}`); load(); }
        }, l)));

    const t = hist.totals || {};
    const stat = (label, val, unit) => h('div', { class: 'stat' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-val' }, val, unit ? h('small', null, unit) : null));

    mount(page,
      h('div', { class: 'page-head no-print' },
        h('a', { class: 'btn btn-ghost btn-sm', href: Q.pagePath('vehicles') }, icon('back'), 'All vehicles')),

      /* Header */
      h('section', { class: 'panel' },
        h('div', { class: 'report-head' },
          h('div', null,
            h('div', { class: 'report-who' },
              Q.plate(v.plate, 'lg'),
              h('div', null,
                h('div', { class: 'report-name' }, [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'),
                h('div', { class: 't-muted' },
                  [v.year, Q.typeLabel(v.vehicle_type)].filter(Boolean).join(', ') || 'No details yet',
                  v.vin ? h('span', { class: 't-mono', style: { marginLeft: '10px' } }, v.vin) : null)),
              Q.stateBadge(st)),
            h('div', { class: 'report-times' },
              h('span', null, 'Paired driver',
                h('b', null, v.driver_name || 'None'),
                v.driver_phone ? h('a', { href: 'tel:' + v.driver_phone, class: 'cell-sub' }, v.driver_phone) : null),
              h('span', null, 'Shift window', h('b', null, Q.fmtWindow(v.driver_shift_start, v.driver_shift_end) || '—')),
              h('span', null, 'Board', h('b', { class: v.node ? 't-mono' : '' }, v.node || 'Unbound'),
                v.node_last_seen ? h('span', { class: 'cell-sub' }, `Seen ${Q.fmtAgo(v.node_last_seen)}`) : null))),
          v.active_shift_id
            ? h('a', { class: 'btn btn-primary', href: Q.pagePath('shift-report') + '?id=' + v.active_shift_id }, 'Open current shift')
            : null)),

      h('section', { class: 'panel' },
        h('div', { class: 'stats' },
          stat('Shifts, last 30 days', t.shifts_30d ?? 0),
          stat('Average score, 30 days', t.score_30d ?? '—', t.score_30d != null ? '/ 100' : ''),
          stat('Alerts, last 30 days', t.alerts_30d ?? 0),
          stat('Last reading', v.last_ts ? Q.fmtAgo(v.last_ts) : '—'))),

      /* Trends */
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' },
          h('h2', { class: 't-h2' }, 'Engine health',
            h('div', { class: 'panel-sub' }, 'The readings the weekly prediction watches. A steady climb toward a dashed line is what it warns about.')),
          rangeSeg),
        h('div', { class: 'trends' }, STREAMS.map(s => trendPanel(s, hist.daily || [])))),

      /* Predictions + gasket */
      h('div', { class: 'cols-even' },
        h('section', { class: 'panel' },
          h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Open predictions'), h('span', { class: 'count-pill' }, preds.length)),
          preds.length
            ? h('div', { class: 'list' }, preds.map(p => {
                const w = [p.w1, p.w2, p.w3, p.w4].filter(x => x != null);
                const msg = p.message || '';
                const eta = (msg.match(/At this rate[^.]*\./) || [''])[0];
                return h('a', { class: 'list-row', href: Q.pagePath('predictions') },
                  h('div', { class: 'trend-cell' }, Q.spark(w, { dots: true })),
                  h('div', { class: 'grow' },
                    h('div', { class: 'cell-main' }, Q.STREAM_LABEL[p.stream] || p.stream),
                    h('div', { class: 'cell-sub' }, `${p.slope > 0 ? '+' : ''}${Number(p.slope).toFixed(2)} ${Q.STREAM_UNIT[p.stream] || ''} per week. ${eta}`)),
                  p.acknowledged ? h('span', { class: 'tag' }, 'Acknowledged') : h('span', { class: 'tag warn' }, 'Open'));
              }))
            : h('div', { class: 'panel-body' }, Q.empty('check', 'Nothing drifting', 'The last weekly check found no trend heading toward a fault.')),
          gasket && gasket.status !== 'clear'
            ? h('div', { class: 'gasket-row', style: { borderTop: '1px solid var(--line)' } },
                Q.led(gasket.status === 'suspect' ? 'crit' : 'warn'),
                h('div', null,
                  h('div', { class: 'cell-main' }, gasket.status === 'suspect' ? 'Head gasket suspected' : 'Gasket symptom, watching'),
                  h('div', { class: 'flags' }, gasket.flags.map(f => h('span', { class: 'tag ' + (f.level === 'crit' ? 'crit' : 'warn') }, f.label || f.parameter)))),
                h('span', { class: 'tag ' + (gasket.status === 'suspect' ? 'crit' : 'warn') }, gasket.status === 'suspect' ? 'Inspect' : 'Watch'))
            : null),

        h('section', { class: 'panel' },
          h('div', { class: 'panel-head' },
            h('h2', { class: 't-h2' }, 'Recent alerts'),
            h('a', { class: 'btn btn-ghost btn-sm', href: Q.pagePath('alerts') + '?vehicle=' + v.id }, 'All alerts')),
          alerts.length
            ? h('div', { class: 'timeline' }, alerts.slice(0, 8).map(a => h('div', { class: 'tl-row', style: { gridTemplateColumns: '130px auto minmax(0,1fr)' } },
                h('span', { class: 'tl-time' }, Q.fmtDateTime(a.ts)),
                Q.led(Q.levelClass(a.level)),
                h('span', null, a.message, a.resolved ? h('span', { class: 'tag ok', style: { marginLeft: '8px' } }, 'Resolved') : null))))
            : h('div', { class: 'panel-body' }, Q.empty('check', 'No alerts', 'This vehicle has not raised an alert.')))),

      /* Shifts */
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' },
          h('h2', { class: 't-h2' }, 'Recent shifts'),
          h('a', { class: 'btn btn-ghost btn-sm', href: Q.pagePath('shifts') + '?vehicle=' + v.id }, 'All shifts')),
        shifts.length
          ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
              h('thead', null, h('tr', null, h('th', null, 'Score'), h('th', null, 'Driver'), h('th', null, 'Started'), h('th', null, 'Duration'), h('th', { class: 'actions' }))),
              h('tbody', null, shifts.slice(0, 8).map(s => {
                const href = Q.pagePath('shift-report') + '?id=' + s.id;
                return h('tr', { class: 'clickable', onclick: () => { location.href = href; } },
                  h('td', { style: { width: '64px' } }, s.active ? Q.led('duty', 'On shift') : Q.scoreDial(s.behavior_score)),
                  h('td', { class: 'cell-main' }, s.driver_name || 'Driver removed'),
                  h('td', { class: 'nowrap' }, Q.fmtDateTime(s.start_time)),
                  h('td', { class: 'nowrap' }, s.active ? h('span', { class: 'tag duty' }, 'Running') : Q.fmtDuration(Q.minutesBetween(s.start_time, s.end_time))),
                  h('td', { class: 'actions' }, h('a', { class: 'icon-btn', href, 'aria-label': 'Open shift report' }, icon('chevron'))));
              }))))
          : h('div', { class: 'panel-body' }, Q.empty('shifts', 'No shifts yet', 'Shifts appear once the paired driver taps their card in this vehicle.'))));
  }

  load();
  Q.on('alert', a => { if (a && String(a.vehicle_id) === String(id)) load(); });
})();
