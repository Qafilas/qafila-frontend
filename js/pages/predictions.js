/* Qafila — weekly OLS predictions and head gasket watch */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  let preds = [];
  let filter = 'open';

  const predBody = h('div');
  const gasketBody = h('div');
  const gasketNote = h('span', { class: 'panel-sub' });
  const predCount = h('span', { class: 'count-pill' }, '0');

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Prediction status' },
    [['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([v, l]) =>
      h('button', {
        type: 'button', 'aria-pressed': v === filter ? 'true' : 'false',
        onclick: e => {
          filter = v;
          seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
          renderPreds();
        }
      }, l)));

  const runBtn = h('button', { class: 'btn btn-sm', onclick: runNow }, icon('refresh'), 'Run check now');

  mount($('#page'),
    h('p', { class: 'page-lede' },
      'Every Thursday at 10:00 PM, Qafila averages each vehicle\'s readings week by week and fits a straight-line trend over the last four weeks. When a trend moves toward a fault faster than its limit, it lands here, weeks before a breakdown.'),
    h('section', { class: 'panel', id: 'trends' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2' }, 'Weekly trends'),
        predCount, seg, runBtn),
      h('div', { class: 'panel-body flush' }, predBody)),
    h('section', { class: 'panel', id: 'gasket' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2' }, 'Head gasket watch', h('div', null, gasketNote))),
      h('div', { class: 'panel-body flush' }, gasketBody)));

  [predBody, gasketBody].forEach(b => mount(b, h('div', { style: { padding: '20px' } }, h('div', { class: 'skeleton', style: { height: '80px' } }))));

  /* ---------- Trends ---------- */
  async function loadPreds() {
    try {
      preds = await Q.api.get('/api/predictions?limit=200') || [];
      renderPreds();
    } catch (err) {
      mount(predBody, Q.errorBox(err, loadPreds));
    }
  }

  function renderPreds() {
    const list = preds.filter(p => filter === 'all' || (filter === 'open' ? !p.resolved : p.resolved));
    predCount.textContent = preds.filter(p => !p.resolved).length;

    if (!list.length) {
      mount(predBody, Q.empty('predictions',
        filter === 'resolved' ? 'Nothing resolved yet' : 'No trends need attention',
        filter === 'resolved' ? 'Predictions you mark as resolved after maintenance are kept here.'
          : 'Each vehicle needs three to four weeks of readings before a trend can be fitted.'));
      return;
    }

    mount(predBody, list.map(p => {
      const w = [p.w1, p.w2, p.w3, p.w4].filter(v => v != null);
      const unit = Q.STREAM_UNIT[p.stream] || '';
      const fmt = v => Number(v).toFixed(p.stream === 'voltage' ? 2 : 1);
      const msg = p.message || '';
      const rec = msg.includes('Recommendation:')
        ? msg.slice(msg.indexOf('Recommendation:') + 'Recommendation:'.length).trim()
        : msg.split(/(?<=\.)\s+/).filter(x => /^Inspect/i.test(x)).join(' ');

      const ack = !p.acknowledged && !p.resolved ? h('button', {
        class: 'btn btn-xs', onclick: e => act(p, 'acknowledge', e.currentTarget)
      }, 'Acknowledge') : null;
      const res = !p.resolved ? h('button', {
        class: 'btn btn-xs', onclick: e => act(p, 'resolve', e.currentTarget)
      }, icon('check'), 'Mark serviced') : h('span', { class: 'tag ok' }, 'Resolved');

      return h('div', { class: 'pred-row' + (p.resolved ? ' resolved' : '') },
        h('a', { class: 'vehicle-link', href: Q.pagePath('vehicle') + '?id=' + p.vehicle_id, title: 'Open vehicle details' },
          Q.plate(p.vehicle_plate),
          h('div', { class: 'cell-sub', style: { marginTop: '4px' } }, [p.vehicle_make, p.vehicle_model].filter(Boolean).join(' '))),
        h('div', { style: { minWidth: '0' } },
          h('div', { class: 'cell-main' }, Q.STREAM_LABEL[p.stream] || p.stream,
            p.acknowledged && !p.resolved ? h('span', { class: 'tag', style: { marginLeft: '8px' } }, 'Acknowledged') : null),
          h('div', { class: 'pred-msg' },
            h('span', { class: 'pred-slope ' + (p.resolved ? '' : 't-warn') }, `${p.slope > 0 ? '+' : ''}${Number(p.slope).toFixed(2)} ${unit} per week`),
            ` against a threshold of ${p.stream === 'voltage' ? '-' : '+'}${p.threshold}. `,
            rec || ''),
          h('div', { class: 'cell-sub', style: { marginTop: '4px' } }, `Found ${Q.fmtDateTime(p.ts)}, from ${p.weeks_qualifying || w.length} weeks of data`)),
        h('div', null,
          Q.spark(w, { dots: true, height: 44, width: 150 }),
          h('div', { class: 'pred-weeks' }, w.map(v => h('span', null, fmt(v))))),
        h('div', { class: 'alert-actions pred-actions' }, ack, res));
    }));
  }

  async function act(p, what, btn) {
    Q.busy(btn, true, '');
    try {
      await Q.api.post(`/api/predictions/${p.id}/${what}`);
      if (what === 'acknowledge') p.acknowledged = 1;
      else p.resolved = 1;
      renderPreds();
      Q.toast({ title: what === 'resolve' ? `${p.vehicle_plate} marked as serviced` : 'Prediction acknowledged' });
    } catch (err) {
      Q.busy(btn, false);
      Q.toast({ level: 'crit', title: 'Could not update', text: err.message });
    }
  }

  async function runNow() {
    Q.busy(runBtn, true, 'Running');
    try {
      const before = preds.length;
      await Q.api.post('/api/predictions/run');
      await loadPreds();
      const added = preds.length - before;
      Q.toast({
        title: added > 0 ? `${added} new prediction${added === 1 ? '' : 's'}` : 'No new trends',
        text: added > 0 ? null : 'Trends already flagged this week are not repeated.'
      });
    } catch (err) {
      Q.toast({ level: 'crit', title: 'Check failed', text: err.message });
    } finally {
      Q.busy(runBtn, false);
    }
  }

  /* ---------- Gasket ---------- */
  async function loadGasket() {
    try {
      const rows = await Q.api.get('/api/gasket/status') || [];
      const rank = { suspect: 0, watch: 1, clear: 2 };
      rows.sort((a, b) => rank[a.status] - rank[b.status]);
      const flagged = rows.filter(r => r.status !== 'clear');
      const clear = rows.length - flagged.length;

      gasketNote.textContent = 'Two or more different symptoms within 24 hours make a vehicle a suspect: coolant spike, misfire code, P0118, P0171 or fuel trim drift.';

      mount(gasketBody,
        flagged.length ? flagged.map(g => h('div', { class: 'gasket-row' },
          Q.led(g.status === 'suspect' ? 'crit' : 'warn'),
          h('div', null,
            h('div', { class: 'row-w' },
              Q.plate(g.plate, 'sm'),
              h('span', { class: 'cell-main' }, g.status === 'suspect' ? 'Suspected head gasket fault' : 'One symptom, watching'),
              g.driver_name ? h('span', { class: 'cell-sub' }, `On shift: ${g.driver_name}`) : null),
            h('div', { class: 'flags' }, g.flags.map(f => h('span', { class: 'tag ' + (f.level === 'crit' ? 'crit' : 'warn'), title: f.message }, f.label || f.parameter))),
            g.recommendation ? h('div', { class: 'pred-msg' }, g.recommendation) : null),
          h('span', { class: 'tag ' + (g.status === 'suspect' ? 'crit' : 'warn') }, g.status === 'suspect' ? 'Inspect' : 'Watch')))
          : Q.empty('check', 'No gasket symptoms', 'No vehicle has shown a coolant spike, misfire code or fuel trim drift in the last 24 hours.'),
        clear && flagged.length ? h('div', { class: 'panel-foot', style: { justifyContent: 'flex-start' } },
          h('span', { class: 'cell-sub' }, `${clear} other vehicle${clear === 1 ? ' is' : 's are'} clear.`)) : null);
    } catch (err) {
      mount(gasketBody, Q.errorBox(err, loadGasket));
    }
  }

  loadPreds();
  loadGasket();
  Q.on('alert', Q.debounce(loadGasket, 800));
  if (location.hash === '#gasket') setTimeout(() => $('#gasket').scrollIntoView({ behavior: 'smooth' }), 400);
})();
