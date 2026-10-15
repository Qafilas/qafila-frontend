/* Qafila predictions page — OLS weekly forecasts + gasket indirect symptoms */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const predictionsList = document.getElementById('predictions-list');
  const predictionsCount = document.getElementById('predictions-count');

  const gasketList     = document.getElementById('gasket-list');
  const gasketCount    = document.getElementById('gasket-count');

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function timeAgo(ts) {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - new Date(ts + 'Z').getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  }

  /* ============================================================
     Section 1 — Predictive maintenance (OLS)
     ============================================================ */

  async function loadPredictions() {
    try {
      const data = await apiFetch('/api/predictions?resolved=0&limit=100');
      predictionsList.innerHTML = '';
      predictionsCount.textContent = String(Array.isArray(data) ? data.length : 0);

      if (!data || data.length === 0) {
        const soft = el('div', 'empty-soft');
        soft.appendChild(el('div', 'empty-soft-title', 'No predictive alerts'));
        soft.appendChild(el('div', 'empty-soft-sub',
          'The weekly OLS job will populate this section.'));
        predictionsList.appendChild(soft);
        return;
      }

      data.forEach(p => {
        const card = el('div', 'pred-card');

        const head = el('div', 'pred-head');
        head.appendChild(el('span', 'pred-stream', p.stream || '—'));
        head.appendChild(el('span', 'pred-time', timeAgo(p.ts)));
        card.appendChild(head);

        card.appendChild(el('div', 'pred-plate', p.vehicle_plate || '—'));

        if (p.message) {
          card.appendChild(el('div', 'pred-body', p.message));
        } else {
          card.appendChild(el('div', 'pred-body',
            `Slope ${p.slope} (threshold ${p.threshold})`));
        }

        const meta = [];
        if (p.w1 != null) meta.push(`w1 ${p.w1}`);
        if (p.w2 != null) meta.push(`w2 ${p.w2}`);
        if (p.w3 != null) meta.push(`w3 ${p.w3}`);
        if (p.w4 != null) meta.push(`w4 ${p.w4}`);
        if (meta.length) {
          card.appendChild(el('div', 'pred-meta', meta.join('   ')));
        }

        const actions = el('div', 'pred-actions');

        const ackBtn = el('button', 'btn', 'Acknowledge');
        ackBtn.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/predictions/${p.id}/acknowledge`, { method: 'POST' });
            loadPredictions();
          } catch (err) {
            alert('Failed to acknowledge: ' + err.message);
          }
        });
        actions.appendChild(ackBtn);

        const resolveBtn = el('button', 'btn btn-danger', 'Resolve');
        resolveBtn.addEventListener('click', async () => {
          try {
            await apiFetch(`/api/predictions/${p.id}/resolve`, { method: 'POST' });
            loadPredictions();
          } catch (err) {
            alert('Failed to resolve: ' + err.message);
          }
        });
        actions.appendChild(resolveBtn);

        card.appendChild(actions);
        predictionsList.appendChild(card);
      });
    } catch (err) {
      predictionsList.innerHTML = '';
      predictionsList.appendChild(el('p', 'empty',
        'Failed to load predictions: ' + err.message));
    }
  }

  /* ============================================================
     Section 2 — Gasket indirect symptoms
     Only flagged vehicles are shown.
     ============================================================ */

  async function loadGasket() {
    try {
      let data = [];
      try {
        data = await apiFetch('/api/gasket/status');
      } catch (_) {
        /* Endpoint does not exist yet — gracefully show all clear */
        data = [];
      }

      gasketList.innerHTML = '';

      const flagged = Array.isArray(data)
        ? data.filter(v => v.status === 'watch' || v.status === 'suspect')
        : [];

      gasketCount.textContent = String(flagged.length);

      if (flagged.length === 0) {
        const soft = el('div', 'empty-soft');
        soft.appendChild(el('div', 'empty-soft-title', 'All clear'));
        soft.appendChild(el('div', 'empty-soft-sub',
          'No vehicles show indirect head gasket symptoms right now.'));
        gasketList.appendChild(soft);
        return;
      }

      flagged.forEach(v => {
        const cls = v.status === 'suspect' ? 'suspect' : 'watch';
        const card = el('div', `gasket-card ${cls}`);

        const head = el('div', 'gasket-head');

        const left = el('div', 'gasket-left');
        left.appendChild(el('div', 'gasket-plate', v.plate || '—'));
        if (v.driver_name) {
          left.appendChild(el('div', 'gasket-driver', v.driver_name));
        }
        head.appendChild(left);

        const label = v.status === 'suspect' ? 'Suspect' : 'Watch';
        head.appendChild(el('span', `gasket-badge ${cls}`, label));

        card.appendChild(head);

        const flags = el('div', 'gasket-flags');

        if (Array.isArray(v.flags) && v.flags.length) {
          v.flags.forEach(f => {
            const level = f.level === 'crit' ? 'crit' : 'warn';
            const row = el('div', `gasket-flag ${level}`);
            row.appendChild(el('span', 'dot'));
            row.appendChild(el('span', '', f.message || f.parameter || '—'));
            flags.appendChild(row);
          });
        } else {
          flags.appendChild(el('div', 'gasket-flag', 'No specific flags recorded'));
        }

        card.appendChild(flags);

        if (v.recommendation) {
          card.appendChild(el('div', 'gasket-recommendation', v.recommendation));
        }

        gasketList.appendChild(card);
      });
    } catch (err) {
      gasketList.innerHTML = '';
      gasketList.appendChild(el('p', 'empty',
        'Failed to load gasket status: ' + err.message));
    }
  }

  /* ============================================================
     Boot
     ============================================================ */

  requestAnimationFrame(() => {
    loadPredictions();
    loadGasket();
  });

  setInterval(loadPredictions, 30000);
  setInterval(loadGasket, 15000);
})();