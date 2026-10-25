/* Qafila — shift report (six sections + telemetry chart) */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const id = Q.qs('id');
  const page = $('#page');

  if (!id) {
    mount(page, Q.empty('shifts', 'No shift selected', 'Open a shift from the Shifts page to see its report.',
      h('a', { class: 'btn btn-primary btn-sm', href: Q.pagePath('shifts') }, 'Go to shifts')));
    return;
  }

  mount(page, h('div', { class: 'skeleton', style: { height: '140px' } }), h('div', { class: 'skeleton', style: { height: '300px' } }));

  const EVENT_LABEL = {
    hard_brake: ['Hard braking', 'warn'],
    aggressive_accel: ['Harsh acceleration', 'warn'],
    speeding: ['Speeding', 'crit'],
    prolonged_idle: ['Long idle', '']
  };

  let data = null;
  let timer = null;

  async function load() {
    try {
      data = await Q.api.get('/api/shifts/' + encodeURIComponent(id));
      render();
      clearTimeout(timer);
      if (data.shift.active || !data.report) timer = setTimeout(load, 30000);
    } catch (err) {
      mount(page, err.status === 404
        ? Q.empty('shifts', 'Shift not found', 'It may have been removed. Pick another from the Shifts page.',
            h('a', { class: 'btn btn-primary btn-sm', href: Q.pagePath('shifts') }, 'Go to shifts'))
        : Q.errorBox(err, load));
    }
  }

  /* ---------- Stats from telemetry ---------- */
  function computeStats(rows) {
    let drive = 0, idle = 0, km = 0, max = 0;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      const dt = (Q.parseTs(b.ts) - Q.parseTs(a.ts)) / 1000;
      if (!(dt > 0) || dt > 120) continue;
      const sa = Number(a.speed) || 0, sb = Number(b.speed) || 0;
      const avg = (sa + sb) / 2;
      if (avg > 1) { drive += dt; km += avg * dt / 3600; }
      else if ((Number(b.rpm) || 0) > 0) idle += dt;
    }
    rows.forEach(r => { if (r.speed != null) max = Math.max(max, Number(r.speed)); });
    return {
      driveMin: drive / 60,
      idleMin: idle / 60,
      km,
      max,
      avgMoving: drive > 0 ? km / (drive / 3600) : 0
    };
  }

  /* ---------- Render ---------- */
  function render() {
    const { shift: s, report, events, alerts, predictions, telemetry } = data;
    const stats = computeStats(telemetry);
    const minutes = Q.minutesBetween(s.start_time, s.end_time);
    const score = report ? report.score : null;

    $('#page-title').textContent = s.driver_name ? `${s.driver_name}, ${Q.fmtDate(s.start_time)}` : 'Shift report';
    document.title = `Shift ${s.id} – Qafila`;

    const activePreds = predictions.filter(p => !p.resolved);

    /* 1. Header */
    const header = h('section', { class: 'panel' },
      h('div', { class: 'report-head' },
        h('div', null,
          h('div', { class: 'report-who' },
            s.vehicle_plate ? h('a', { href: Q.pagePath('vehicle') + '?id=' + s.vehicle_id, title: 'Open vehicle details' }, Q.plate(s.vehicle_plate, 'lg')) : null,
            h('div', null,
              h('div', { class: 'report-name' }, s.driver_name || 'Driver removed'),
              h('div', { class: 't-muted' },
                [s.driver_employee_id, [s.vehicle_make, s.vehicle_model].filter(Boolean).join(' ')].filter(Boolean).join(', '),
                s.driver_phone ? [', ', h('a', { href: 'tel:' + s.driver_phone }, s.driver_phone)] : null)),
            s.active ? h('span', { class: 'tag duty' }, Q.led('duty'), 'On shift now') : null),
          h('div', { class: 'report-times' },
            h('span', null, 'Started', h('b', null, Q.fmtDateTime(s.start_time))),
            h('span', null, 'Ended', h('b', null, s.end_time ? Q.fmtDateTime(s.end_time) : 'Still running')),
            h('span', null, 'Duration', h('b', null, Q.fmtDuration(minutes))))),
        h('div', { class: 'row', style: { gap: '16px' } },
          h('div', { style: { textAlign: 'right' }, class: 't-small t-muted' }, 'Behaviour', h('br'), 'score'),
          Q.scoreDial(score, 'lg'))));

    /* 2. Summary paragraph */
    const summary = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Behaviour summary')),
      h('div', { class: 'panel-body' },
        report
          ? h('p', { class: 'summary-text' }, report.paragraph)
          : h('p', { class: 'summary-text t-muted' }, s.active
              ? 'The summary is written when the driver taps out. Readings so far are below.'
              : 'Writing the report. It is ready within 30 seconds of the shift ending; this page refreshes on its own.')));

    /* 6. Stats (shown high on the page because it is the quick read) */
    const stat = (label, val, unit) => h('div', { class: 'stat' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-val' }, val, unit ? h('small', null, unit) : null));
    const statsPanel = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Summary stats')),
      h('div', { class: 'stats' },
        stat('Driving time', Q.fmtDuration(stats.driveMin)),
        stat('Idle time', Q.fmtDuration(stats.idleMin)),
        stat('Distance', stats.km.toFixed(1), 'km'),
        stat('Max speed', Math.round(stats.max), 'km/h'),
        stat('Average moving speed', Math.round(stats.avgMoving), 'km/h'),
        stat('Alerts', alerts.length),
        stat('Driving events', events.length),
        stat('Score', score == null ? '—' : score, score == null ? '' : '/ 100')));

    /* Charts: one measure each, stacked on the same time axis (no dual axes) */
    const pts = key => telemetry.filter(r => r[key] != null).map(r => ({ t: Q.parseTs(r.ts), v: Number(r[key]) }));
    const sameDay = d => Q.fmtTime(d);
    const chartPanel = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2' }, 'Speed and coolant', h('div', { class: 'panel-sub' }, `${telemetry.length} readings, one every 30 seconds. Hover to read a value.`))),
      telemetry.length > 1
        ? h('div', { class: 'stacked-charts' },
            h('div', { class: 'stacked-chart' },
              h('div', { class: 't-h3' }, 'Speed, km/h'),
              Q.lineChart({ points: pts('speed'), unit: 'km/h', digits: 0, area: true, areaBase: 0, yMin: 0, color: 'var(--duty)',
                refs: [{ v: 90, label: '90 km/h speeding', cls: 'warn' }], height: 170, group: 'shift-' + s.id,
                tickFormat: sameDay, tipTime: sameDay, label: 'Speed over the shift' })),
            h('div', { class: 'stacked-chart' },
              h('div', { class: 't-h3' }, 'Coolant temperature, °C'),
              Q.lineChart({ points: pts('coolant'), unit: '°C', digits: 0, color: 'var(--maroon)',
                refs: [{ v: 105, label: '105 °C warning', cls: 'warn' }, { v: 200, label: '200 °C critical', cls: 'crit', inView: false }],
                height: 170, group: 'shift-' + s.id, tickFormat: sameDay, tipTime: sameDay, label: 'Coolant over the shift' })))
        : h('div', { class: 'panel-body' }, Q.empty('gauge', 'No readings for this shift', 'The board sends engine data every 30 seconds while the ignition is on.')));

    /* 3. Event log */
    const eventPanel = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Driving events'), h('span', { class: 'count-pill' }, events.length)),
      events.length
        ? h('div', { class: 'timeline' }, events.map(e => {
            const [label, cls] = EVENT_LABEL[e.event_type] || [e.event_type, ''];
            return h('div', { class: 'tl-row' },
              h('span', { class: 'tl-time' }, Q.fmtTime(e.ts)),
              h('span', null, h('span', { class: 'tag ' + cls }, label)),
              h('span', { class: 't-muted' }, e.detail || ''));
          }))
        : h('div', { class: 'panel-body' }, Q.empty('check', 'No unsafe driving recorded',
            s.active ? 'Events are detected when the shift ends.' : 'No hard braking, harsh acceleration, speeding or long idling on this shift.')));

    /* 4. Alerts */
    const alertPanel = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Alerts during the shift'), h('span', { class: 'count-pill' + (alerts.some(a => a.level === 'red') ? ' crit' : '') }, alerts.length)),
      alerts.length
        ? h('div', { class: 'timeline' }, alerts.map(a => h('div', { class: 'tl-row' },
            h('span', { class: 'tl-time' }, Q.fmtTime(a.ts)),
            h('span', null, Q.led(Q.levelClass(a.level))),
            h('span', null,
              a.message,
              a.type === 'gasket' ? h('span', { class: 'tag', style: { marginLeft: '8px' } }, 'Gasket') : null,
              a.resolved ? h('span', { class: 'tag ok', style: { marginLeft: '8px' } }, 'Resolved') : null))))
        : h('div', { class: 'panel-body' }, Q.empty('check', 'No alerts', 'Coolant, battery and fuel trim stayed inside safe limits.')));

    /* 5. Predictions for this vehicle */
    const predPanel = h('section', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Maintenance predictions for this vehicle')),
      activePreds.length
        ? h('div', { class: 'list' }, activePreds.slice(0, 5).map(p => {
            const w = [p.w1, p.w2, p.w3, p.w4].filter(v => v != null);
            return h('div', { class: 'list-row' },
              h('div', { class: 'trend-cell' }, Q.spark(w, { dots: true })),
              h('div', { class: 'grow' },
                h('div', { class: 'cell-main' }, Q.STREAM_LABEL[p.stream] || p.stream),
                h('div', { class: 'cell-sub' }, `${p.slope > 0 ? '+' : ''}${Number(p.slope).toFixed(2)} ${Q.STREAM_UNIT[p.stream] || ''} per week, found ${Q.fmtDate(p.ts)}`)),
              p.acknowledged ? h('span', { class: 'tag' }, 'Acknowledged') : h('span', { class: 'tag warn' }, 'Open'));
          }))
        : h('div', { class: 'panel-body' }, Q.empty('predictions', 'No open predictions', 'The weekly trend check found nothing drifting on this vehicle.')));

    mount(page,
      h('div', { class: 'page-head no-print' },
        h('a', { class: 'btn btn-ghost btn-sm', href: Q.pagePath('shifts') }, icon('back'), 'All shifts'),
        h('button', { class: 'btn btn-sm', onclick: () => window.print() }, 'Print report')),
      header,
      summary,
      statsPanel,
      chartPanel,
      h('div', { class: 'cols-even' }, eventPanel, alertPanel),
      predPanel);
  }

  load();
  Q.on('shift', d => { if (d && String(d.shift_id) === String(id)) setTimeout(load, 1500); });
})();