/* Qafila — drivers: list, add, inline edit, activate, delete */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  let drivers = [];
  let status = 'active';
  let query = Q.qs('q') || '';
  let editingId = null;

  const tbody = h('tbody');
  const counts = { active: h('span', { class: 'seg-n' }), inactive: h('span', { class: 'seg-n' }), all: h('span', { class: 'seg-n' }) };

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Status' },
    [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(([v, l]) =>
      h('button', {
        type: 'button', 'aria-pressed': v === status ? 'true' : 'false',
        onclick: e => {
          status = v;
          seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
          render();
        }
      }, l, counts[v])));

  const search = h('label', { class: 'search' }, icon('search'),
    h('input', {
      class: 'input input-sm', type: 'search', placeholder: 'Search name, employee ID or phone',
      value: query, 'aria-label': 'Search drivers',
      oninput: Q.debounce(e => { query = e.target.value; render(); }, 120)
    }));


  mount($('#page'),
    h('div', { class: 'page-head' },
      h('p', { class: 'page-lede' }, 'A driver\'s card tap is accepted only in their paired vehicle and inside their shift window.'),
      h('button', { class: 'btn btn-primary', onclick: addDriver }, icon('plus'), 'Add driver')),
    h('section', { class: 'panel' },
      h('div', { class: 'toolbar' }, search, h('span', { class: 'spacer' }), seg),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Driver'),
            h('th', null, 'Phone and licence'),
            h('th', null, 'Shift window'),
            h('th', null, 'Paired vehicle'),
            h('th', { class: 'num' }, 'Avg score'),
            h('th', null, 'Status'),
            h('th', { class: 'actions' }, h('span', { class: 'sr-only' }, 'Actions')))),
          tbody))));

  mount(tbody, Q.loadingRows(7));

  async function load() {
    try {
      drivers = await Q.api.get('/api/drivers?all=1') || [];
      render();
    } catch (err) {
      mount(tbody, h('tr', null, h('td', { colspan: 7 }, Q.errorBox(err, load))));
    }
  }

  function matches(d) {
    if (status === 'active' && !d.active) return false;
    if (status === 'inactive' && d.active) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [d.name, d.employee_id, d.phone, d.license, d.paired_plates].some(x => x && String(x).toLowerCase().includes(q));
  }

  function render() {
    counts.active.textContent = drivers.filter(d => d.active).length;
    counts.inactive.textContent = drivers.filter(d => !d.active).length;
    counts.all.textContent = drivers.length;

    const list = drivers.filter(matches);
    if (!list.length) {
      mount(tbody, h('tr', null, h('td', { colspan: 7 },
        drivers.length
          ? Q.empty('search', 'No drivers match', 'Try another name or switch the status filter.')
          : Q.empty('drivers', 'No drivers yet', 'Add drivers one by one, or import your whole fleet from a CSV file.',
              h('div', { class: 'row', style: { justifyContent: 'center' } },
                h('button', { class: 'btn btn-primary btn-sm', onclick: addDriver }, icon('plus'), 'Add driver'),
                h('a', { class: 'btn btn-sm', href: Q.pagePath('import') }, 'Import CSV'))))));
      return;
    }
    mount(tbody, list.map(d => d.id === editingId ? editRow(d) : row(d)));
  }

  function windowCell(d) {
    const w = Q.fmtWindow(d.shift_start, d.shift_end);
    if (!w) return h('span', { class: 't-warn' }, 'Not set, taps refused');
    return [
      h('div', { class: 'cell-main nowrap' }, w),
      d.shift_days ? h('div', { class: 'cell-sub' }, d.shift_days) : null
    ];
  }

  function row(d) {
    const plates = d.paired_plates ? d.paired_plates.split(',').map(s => s.trim()) : [];
    const st = !d.active ? h('span', { class: 'tag' }, 'Inactive')
      : d.active_shift_id ? h('a', { class: 'tag duty', href: Q.pagePath('shift-report') + '?id=' + d.active_shift_id }, 'On shift')
      : h('span', { class: 'tag ok' }, 'Active');

    return h('tr', { class: d.active ? '' : 'is-inactive' },
      h('td', null,
        h('a', { class: 'cell-main', href: Q.pagePath('shifts') + '?driver=' + d.id, style: { color: 'inherit' } }, d.name),
        h('div', { class: 'cell-sub' }, d.employee_id)),
      h('td', null,
        d.phone ? h('a', { href: 'tel:' + d.phone, style: { color: 'inherit' } }, d.phone) : h('span', { class: 't-faint' }, 'No phone'),
        h('div', { class: 'cell-sub' }, d.license || 'No licence on file')),
      h('td', null, windowCell(d)),
      h('td', null, plates.length
        ? h('div', { class: 'row-w', style: { gap: '6px' } }, plates.map(p => Q.plate(p, 'sm')))
        : h('span', { class: 't-faint' }, 'Not paired')),
      h('td', { class: 'num' }, d.avg_score != null ? h('span', { class: d.avg_score < 60 ? 't-crit' : d.avg_score < 80 ? 't-warn' : '' }, String(d.avg_score)) : h('span', { class: 't-faint' }, '—')),
      h('td', null, st),
      h('td', { class: 'actions' },
        h('button', { class: 'icon-btn', title: 'Edit', 'aria-label': `Edit ${d.name}`, onclick: () => { editingId = d.id; render(); } }, icon('edit')),
        h('button', {
          class: 'icon-btn', title: d.active ? 'Deactivate' : 'Activate',
          'aria-label': (d.active ? 'Deactivate ' : 'Activate ') + d.name,
          onclick: e => toggleActive(d, e.currentTarget)
        }, icon(d.active ? 'ban' : 'activate')),
        h('button', { class: 'icon-btn danger', title: 'Delete', 'aria-label': `Delete ${d.name}`, onclick: () => remove(d) }, icon('x'))));
  }

  /* ---------- Inline edit ---------- */
  function editRow(d) {
    const f = {};
    const input = (name, value, attrs = {}) => (f[name] = h('input', Object.assign({ class: 'input input-sm', value: value || '', 'aria-label': name.replace('_', ' ') }, attrs)));

    const save = h('button', { class: 'btn btn-primary btn-xs', onclick: () => saveEdit(d, f, save) }, 'Save');
    const tr = h('tr', { class: 'editing' },
      h('td', null, input('name', d.name), h('div', { class: 'cell-sub', style: { marginTop: '4px' } }, d.employee_id)),
      h('td', null,
        h('div', { style: { display: 'grid', gap: '6px' } },
          input('phone', d.phone, { placeholder: 'Phone', inputmode: 'tel' }),
          input('license', d.license, { placeholder: 'Licence' }))),
      h('td', null,
        h('div', { style: { display: 'grid', gap: '6px', gridTemplateColumns: '1fr 1fr' } },
          input('shift_start', d.shift_start, { type: 'time', 'aria-label': 'Shift start' }),
          input('shift_end', d.shift_end, { type: 'time', 'aria-label': 'Shift end' }),
          h('div', { style: { gridColumn: '1 / -1' } }, input('shift_days', d.shift_days, { placeholder: 'Days, e.g. Sun-Thu' })))),
      h('td', { colspan: 3, class: 'cell-sub' }, 'Employee ID cannot be changed. Pair vehicles on the Vehicles or Operations page.'),
      h('td', { class: 'actions' },
        h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '6px' } },
          h('button', { class: 'btn btn-xs', onclick: () => { editingId = null; render(); } }, 'Cancel'),
          save)));

    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveEdit(d, f, save); }
      if (e.key === 'Escape') { editingId = null; render(); }
    });
    setTimeout(() => f.name.focus(), 0);
    return tr;
  }

  async function saveEdit(d, f, btn) {
    const body = {};
    Object.keys(f).forEach(k => { body[k] = f[k].value.trim(); });
    if (!body.name) { f.name.classList.add('invalid'); f.name.focus(); return; }
    if ((body.shift_start && !body.shift_end) || (!body.shift_start && body.shift_end)) {
      Q.toast({ level: 'warn', title: 'Set both start and end', text: 'A shift window needs a start and an end time.' });
      return;
    }
    Q.busy(btn, true, '');
    try {
      await Q.api.put(`/api/drivers/${d.id}`, body);
      editingId = null;
      Q.toast({ title: `Saved ${body.name}` });
      await load();
    } catch (err) {
      Q.busy(btn, false);
      Q.toast({ level: 'crit', title: 'Could not save', text: err.message });
    }
  }

  /* ---------- Add ---------- */
  function addDriver() {
    Q.formDialog({
      title: 'Add driver',
      submitText: 'Add driver',
      fields: [
        { name: 'name', label: 'Full name', required: true, span: true },
        { name: 'employee_id', label: 'Employee ID', required: true, placeholder: 'EMP-0000' },
        { name: 'phone', label: 'Phone', inputmode: 'tel', placeholder: '+974' },
        { name: 'license', label: 'Licence number' },
        { name: 'shift_days', label: 'Days', placeholder: 'Sun-Thu' },
        { name: 'shift_start', label: 'Shift start', type: 'time' },
        { name: 'shift_end', label: 'Shift end', type: 'time', hint: 'An end earlier than the start means an overnight shift.' }
      ],
      onSubmit: async data => {
        await Q.api.post('/api/drivers', data);
        Q.toast({ title: `${data.name} added`, text: 'Pair them with a vehicle so their card works.' });
        await load();
      }
    });
  }

  /* ---------- Activate / deactivate ---------- */
  async function toggleActive(d, btn) {
    if (d.active) {
      const ok = await Q.confirm({
        title: `Deactivate ${d.name}?`,
        body: 'Their card taps will be refused. Shift history and reports stay as they are, and you can activate them again at any time.',
        confirmText: 'Deactivate'
      });
      if (!ok) return;
    }
    Q.busy(btn, true, '');
    try {
      await Q.api.post(`/api/drivers/${d.id}/${d.active ? 'deactivate' : 'activate'}`);
      Q.toast({ title: d.active ? `${d.name} deactivated` : `${d.name} is active again` });
      await load();
    } catch (err) {
      Q.busy(btn, false);
      Q.toast({ level: 'crit', title: 'Could not update', text: err.message });
    }
  }

  /* ---------- Delete ---------- */
  async function remove(d) {
    const n = Number(d.shift_count) || 0;
    let choice;
    if (n > 0) {
      choice = await Q.dialog(close => [
        h('div', { class: 'dialog-head' }, h('h2', { class: 't-h2' }, `Delete ${d.name}?`)),
        h('div', { class: 'dialog-body' },
          h('p', null, `${d.name} has ${n} recorded shift${n === 1 ? '' : 's'}. Deleting keeps those shifts but removes the driver's name from them, and unpairs any vehicle.`),
          h('p', null, 'To keep the history intact, deactivate the driver instead.')),
        h('div', { class: 'dialog-foot' },
          h('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
          d.active ? h('button', { class: 'btn', onclick: () => close('deactivate') }, 'Deactivate instead') : null,
          h('button', { class: 'btn btn-danger-solid', onclick: () => close('delete') }, 'Delete driver'))
      ]);
    } else {
      choice = await Q.confirm({
        title: `Delete ${d.name}?`,
        body: 'They have no shifts on record. This cannot be undone.',
        confirmText: 'Delete driver',
        danger: true
      }) ? 'delete' : null;
    }
    if (!choice) return;

    try {
      if (choice === 'deactivate') {
        await Q.api.post(`/api/drivers/${d.id}/deactivate`);
        Q.toast({ title: `${d.name} deactivated` });
      } else {
        await Q.api.del(`/api/drivers/${d.id}?force=1`);
        Q.toast({ title: `${d.name} deleted` });
      }
      await load();
    } catch (err) {
      Q.toast({ level: 'crit', title: 'Could not delete', text: err.message });
    }
  }

  load();
  Q.on('fleet', Q.debounce(() => { if (!editingId) load(); }, 600));
  Q.on('shift', Q.debounce(() => { if (!editingId) load(); }, 600));
})();
