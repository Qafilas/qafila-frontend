/* Qafila — settings: profile, password, weekly prediction, node health */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const me = Q.tokenPayload() || {};

  /* ---------- Profile ---------- */
  const nameIn = h('input', { class: 'input', value: me.name || '', autocomplete: 'name' });
  const profileMsg = h('div', { hidden: true });
  const profileBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save name');
  const profileForm = h('form', { style: { display: 'grid', gap: '16px' } },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Name'), nameIn),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Email'),
      h('input', { class: 'input', value: me.email || '', disabled: true }),
      h('span', { class: 'field-hint' }, 'The sign-in email cannot be changed here.')),
    profileMsg,
    h('div', null, profileBtn));

  profileForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = nameIn.value.trim();
    if (!name) { nameIn.classList.add('invalid'); return; }
    Q.busy(profileBtn, true, 'Saving');
    try {
      const r = await Q.api.patch('/api/auth/me', { name });
      Q.setUserName(r.manager.name);
      showMsg(profileMsg, 'ok', 'Name saved. It shows everywhere the next time you sign in.');
    } catch (err) {
      showMsg(profileMsg, 'err', err.message);
    } finally { Q.busy(profileBtn, false); }
  });

  /* ---------- Password ---------- */
  const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
  const nxt = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const nxt2 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const pwMsg = h('div', { hidden: true });
  const pwBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Change password');
  const pwForm = h('form', { style: { display: 'grid', gap: '16px' } },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Current password'), cur),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'New password'), nxt, h('span', { class: 'field-hint' }, 'At least 8 characters, with a letter and a number.')),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Repeat new password'), nxt2)),
    pwMsg,
    h('div', null, pwBtn));

  pwForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!cur.value || !nxt.value) return showMsg(pwMsg, 'err', 'Enter your current password and a new one.');
    if (nxt.value.length < 8 || !/[A-Za-z]/.test(nxt.value) || !/\d/.test(nxt.value)) return showMsg(pwMsg, 'err', 'Use at least 8 characters, with a letter and a number.');
    if (nxt.value !== nxt2.value) return showMsg(pwMsg, 'err', 'The two new passwords do not match.');
    Q.busy(pwBtn, true, 'Changing');
    try {
      await Q.api.post('/api/auth/password', { current: cur.value, next: nxt.value });
      cur.value = nxt.value = nxt2.value = '';
      showMsg(pwMsg, 'ok', 'Password changed.');
    } catch (err) {
      showMsg(pwMsg, 'err', err.message);
    } finally { Q.busy(pwBtn, false); }
  });

  /* ---------- Weekly prediction schedule ---------- */
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daySel = h('select', { class: 'select', 'aria-label': 'Day' }, DAYS.map((d, i) => h('option', { value: String(i) }, d)));
  const timeIn = h('input', { class: 'input', type: 'time', step: 60, required: true, 'aria-label': 'Time' });
  const schedNow = h('span', { class: 'field-hint' }, 'Loading the current schedule…');
  const schedMsg = h('div', { hidden: true });
  const schedBtn = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save schedule');
  const schedForm = h('form', { style: { display: 'grid', gap: '16px' } },
    h('p', { class: 't-muted', style: { margin: 0 } },
      'Qafila checks every vehicle once a week for slow trends that lead to a fault. Pick a quiet time, when most of your vehicles are parked and their last readings have been uploaded.'),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Day'), daySel),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Time'), timeIn)),
    schedNow,
    schedMsg,
    h('div', null, schedBtn));

  function showSchedule(s) {
    daySel.value = String(s.day);
    timeIn.value = s.time;
    schedNow.textContent = `Now: ${s.label}, ${s.timezone} time.`;
  }

  async function loadSchedule() {
    try { showSchedule(await Q.api.get('/api/predictions/schedule')); }
    catch (err) { schedNow.textContent = 'Could not load the schedule: ' + err.message; }
  }

  schedForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!timeIn.value) return showMsg(schedMsg, 'err', 'Choose a time.');
    Q.busy(schedBtn, true, 'Saving');
    try {
      const s = await Q.api.put('/api/predictions/schedule', { day: Number(daySel.value), time: timeIn.value });
      showSchedule(s);
      showMsg(schedMsg, 'ok', `Saved. The weekly check now runs ${s.label.replace(/^Every/, 'every')}.`);
    } catch (err) {
      showMsg(schedMsg, 'err', err.message);
    } finally { Q.busy(schedBtn, false); }
  });

  function showMsg(el, kind, text) {
    el.className = kind === 'ok' ? 'form-ok' : 'form-error';
    el.textContent = text;
    el.hidden = false;
  }

  /* ---------- Node health ---------- */
  const nodesBody = h('tbody');
  const nodesNote = h('span', { class: 'panel-sub' });

  function bars(sig) {
    /* CSQ 0-31 from the SIM7600 */
    const n = sig == null ? 0 : sig >= 20 ? 4 : sig >= 15 ? 3 : sig >= 10 ? 2 : sig > 0 ? 1 : 0;
    return h('span', { class: 'signal-bars', title: sig == null ? 'No signal reading' : `Signal ${sig} of 31` },
      [1, 2, 3, 4].map(i => h('i', { class: i <= n ? 'on' : '' })));
  }

  async function loadNodes() {
    mount(nodesBody, Q.loadingRows(6, 2));
    try {
      const nodes = await Q.api.get('/api/nodes') || [];
      const online = nodes.filter(n => n.last_seen && Date.now() - Q.parseTs(n.last_seen).getTime() < 15 * 60e3).length;
      nodesNote.textContent = nodes.length ? `${online} of ${nodes.length} reported in the last 15 minutes. Boards run on the ignition, so a parked vehicle shows offline.` : '';
      if (!nodes.length) {
        mount(nodesBody, h('tr', null, h('td', { colspan: 6 }, Q.empty('chip', 'No boards yet',
          'A board appears here the first time it powers on in a vehicle.'))));
        return;
      }
      mount(nodesBody, nodes.map(n => {
        const seen = Q.parseTs(n.last_seen);
        const fresh = seen && Date.now() - seen.getTime() < 15 * 60e3;
        return h('tr', null,
          h('td', null, h('span', { class: 't-mono' }, n.id)),
          h('td', null, n.vehicle_plate
            ? h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'tag ok' }, 'Bound'), Q.plate(n.vehicle_plate, 'sm'))
            : h('div', null, h('span', { class: 'tag warn' }, 'Unbound'),
                h('div', { class: 'cell-sub', style: { marginTop: '3px' } }, 'Assign it on the Vehicles page'))),
          h('td', null, h('span', { class: 'state' }, Q.led(fresh ? 'ok' : 'off'), fresh ? 'Online' : 'Offline')),
          h('td', { class: 'nowrap' },
            n.last_seen ? [h('div', null, Q.fmtDateTime(n.last_seen)), h('div', { class: 'cell-sub' }, Q.fmtAgo(n.last_seen))]
              : h('span', { class: 't-faint' }, 'Never')),
          h('td', null, h('div', { class: 'row', style: { gap: '8px' } }, bars(n.signal), h('span', { class: 'cell-sub' }, n.lte_registered ? 'LTE' : n.signal == null ? '—' : 'No LTE'))),
          h('td', { class: 'num' }, String(n.uploads_24h || 0)));
      }));
    } catch (err) {
      mount(nodesBody, h('tr', null, h('td', { colspan: 6 }, Q.errorBox(err, loadNodes))));
    }
  }

  /* ---------- Layout ---------- */
  mount($('#page'),
    h('div', { class: 'cols-even' },
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Your profile')),
        h('div', { class: 'panel-body' }, profileForm)),
      h('section', { class: 'panel' },
        h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Password')),
        h('div', { class: 'panel-body' }, pwForm))),
    h('section', { class: 'panel', id: 'prediction-schedule' },
      h('div', { class: 'panel-head' }, h('h2', { class: 't-h2' }, 'Weekly prediction')),
      h('div', { class: 'panel-body' }, schedForm)),
    h('section', { class: 'panel' },
      h('div', { class: 'panel-head' },
        h('h2', { class: 't-h2' }, 'Node health', h('div', null, nodesNote)),
        h('button', { class: 'btn btn-sm', onclick: loadNodes }, icon('refresh'), 'Refresh')),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Board'), h('th', null, 'Vehicle'), h('th', null, 'Status'),
            h('th', null, 'Last seen'), h('th', null, 'Cellular'), h('th', { class: 'num' }, 'Uploads, 24 h'))),
          nodesBody))));

  loadNodes();
  loadSchedule();
  Q.on('node', Q.debounce(loadNodes, 500));
})();