/* Qafila — vehicles: list, add, inline edit, pairing, activate, delete */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  let vehicles = [];
  let drivers = [];
  let unbound = [];
  let status = 'active';
  let typeFilter = '';
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

  const typeSelect = h('select', {
    class: 'select select-sm', 'aria-label': 'Vehicle type', style: { width: 'auto' },
    onchange: e => { typeFilter = e.target.value; render(); }
  }, h('option', { value: '' }, 'All types'), Q.VEHICLE_TYPES.map(t => h('option', { value: t.value }, t.label)));

  const search = h('label', { class: 'search' }, icon('search'),
    h('input', {
      class: 'input input-sm', type: 'search', placeholder: 'Search plate, make, model or driver',
      value: query, 'aria-label': 'Search vehicles',
      oninput: Q.debounce(e => { query = e.target.value; render(); }, 120)
    }));

  mount($('#page'),
    h('div', { class: 'page-head' },
      h('p', { class: 'page-lede' }, 'Each vehicle has one paired driver, and only that driver can start a shift in it. A board binds itself when it reads the car\'s VIN. If it cannot, it shows up here as Unbound and you assign it with one click.'),
      h('button', { class: 'btn btn-primary', onclick: addVehicle }, icon('plus'), 'Add vehicle')),
    h('section', { class: 'panel' },
      h('div', { class: 'toolbar' }, search, typeSelect, h('span', { class: 'spacer' }), seg),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null,
            h('th', null, 'Vehicle'),
            h('th', null, 'Type'),
            h('th', null, 'Paired driver'),
            h('th', null, 'Board status'),
            h('th', null, 'Status'),
            h('th', { class: 'actions' }, h('span', { class: 'sr-only' }, 'Actions')))),
          tbody))));

  mount(tbody, Q.loadingRows(6));

  async function load() {
    try {
      [vehicles, drivers, unbound] = await Promise.all([
        Q.api.get('/api/vehicles?all=1'),
        Q.api.get('/api/drivers?all=1'),
        Q.api.get('/api/nodes/unbound').catch(() => [])
      ]);
      render();
    } catch (err) {
      mount(tbody, h('tr', null, h('td', { colspan: 6 }, Q.errorBox(err, load))));
    }
  }

  function matches(v) {
    if (status === 'active' && !v.active) return false;
    if (status === 'inactive' && v.active) return false;
    if (typeFilter && v.vehicle_type !== typeFilter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [v.plate, v.make, v.model, v.year, v.driver_name, v.node].some(x => x && String(x).toLowerCase().includes(q));
  }

  function render() {
    counts.active.textContent = vehicles.filter(v => v.active).length;
    counts.inactive.textContent = vehicles.filter(v => !v.active).length;
    counts.all.textContent = vehicles.length;

    const list = vehicles.filter(matches);
    if (!list.length) {
      mount(tbody, h('tr', null, h('td', { colspan: 6 },
        vehicles.length
          ? Q.empty('search', 'No vehicles match', 'Try another plate or clear the filters.')
          : Q.empty('vehicles', 'No vehicles yet', 'Add a vehicle, or import your fleet from a CSV file. Each CSV row pairs a driver with a vehicle.',
              h('div', { class: 'row', style: { justifyContent: 'center' } },
                h('button', { class: 'btn btn-primary btn-sm', onclick: addVehicle }, icon('plus'), 'Add vehicle'),
                h('a', { class: 'btn btn-sm', href: Q.pagePath('import') }, 'Import CSV'))))));
      return;
    }
    mount(tbody, list.map(v => v.id === editingId ? editRow(v) : row(v)));
  }

  /* ---------- Board status: Bound / Unbound, with Assign or Change ---------- */
  function shortId(id) { return id && id.length > 13 ? id.slice(0, 11) + '…' : id; }

  function boardList(v, close, emptyText) {
    if (!unbound.length) {
      return h('div', { class: 'popover-title', style: { maxWidth: '280px', lineHeight: '1.45' } }, emptyText);
    }
    return h('div', { class: 'popover-list' }, unbound.map(n =>
      h('button', {
        class: 'popover-item', type: 'button', role: 'menuitem',
        onclick: async () => {
          close();
          try {
            await Q.api.post(`/api/nodes/${encodeURIComponent(n.id)}/assign`, { vehicle_id: v.id });
            Q.toast({ title: `Board assigned to ${v.plate}`, text: `${n.id} will show "Assigned to ${v.plate}" within 5 seconds.` });
            load();
          } catch (err) { Q.toast({ level: 'crit', title: 'Could not assign', text: err.message }); }
        }
      },
        icon('chip'),
        h('span', { class: 'grow' },
          h('span', { class: 't-mono', style: { display: 'block' } }, n.id),
          h('span', { class: 'cell-sub' }, `First seen ${Q.fmtDateTime(n.first_seen)}`)),
        h('span', { class: 'cell-sub' }, Q.fmtAgo(n.last_seen)))));
  }

  function assignMenu(btn, v) {
    Q.popover(btn, close => [
      h('div', { class: 'popover-title' }, `Assign a board to ${v.plate}`),
      boardList(v, close, 'No boards are waiting. Plug a board into the car and turn on the ignition; it appears here within a few seconds.')
    ]);
  }

  function changeMenu(btn, v) {
    Q.popover(btn, close => [
      h('div', { class: 'popover-title' }, `Board on ${v.plate}: ${v.node}`),
      unbound.length ? h('div', { class: 'popover-title' }, 'Replace with') : null,
      unbound.length ? boardList(v, close, '') : null,
      h('div', { class: 'popover-sep' }),
      h('button', {
        class: 'popover-item', type: 'button', style: { color: 'var(--signal-text)' },
        onclick: async () => {
          close();
          const ok = await Q.confirm({
            title: `Unassign the board from ${v.plate}?`,
            body: 'The board stops sending data for this vehicle and shows as Unbound until you assign it again. Past readings stay with the vehicle.',
            confirmText: 'Unassign board', danger: true
          });
          if (!ok) return;
          try {
            await Q.api.post(`/api/nodes/${encodeURIComponent(v.node)}/unassign`);
            Q.toast({ title: `Board removed from ${v.plate}` });
            load();
          } catch (err) { Q.toast({ level: 'crit', title: 'Could not unassign', text: err.message }); }
        }
      }, icon('unlink'), 'Unassign board')
    ]);
  }

  function boardCell(v) {
    if (v.node) {
      const seen = Q.parseTs(v.node_last_seen);
      const fresh = seen && Date.now() - seen.getTime() < 15 * 60e3;
      const btn = h('button', { class: 'btn btn-xs', type: 'button' }, 'Change');
      btn.addEventListener('click', () => changeMenu(btn, v));
      return h('div', { class: 'row', style: { gap: '12px' } },
        h('div', { class: 'grow' },
          h('div', { class: 'row', style: { gap: '6px' } },
            h('span', { class: 'tag ok' }, 'Bound'),
            h('span', { class: 't-mono nowrap', title: v.node }, shortId(v.node))),
          h('div', { class: 'cell-sub', style: fresh ? { color: 'var(--go-text)' } : null },
            v.node_last_seen ? `Seen ${Q.fmtAgo(v.node_last_seen)}` : 'Not reported yet')),
        btn);
    }
    if (!v.active) return h('span', { class: 't-faint' }, '—');
    const btn = h('button', { class: 'btn btn-xs' + (unbound.length ? ' btn-primary' : ''), type: 'button' }, 'Assign');
    btn.addEventListener('click', () => assignMenu(btn, v));
    return h('div', { class: 'row', style: { gap: '12px' } },
      h('div', { class: 'grow' },
        h('span', { class: 'tag warn' }, 'Unbound'),
        h('div', { class: 'cell-sub', style: { marginTop: '3px' } },
          unbound.length ? `${unbound.length} board${unbound.length === 1 ? '' : 's'} waiting` : 'No board yet')),
      btn);
  }

  function row(v) {
    const st = Q.vehicleState(v);
    const pairBtn = h('button', { class: 'btn btn-xs', type: 'button' }, v.default_driver_id ? 'Change pair' : 'Pair driver');
    pairBtn.addEventListener('click', () => Q.fleet.pairPicker(pairBtn, v, drivers, load));

    const driverCell = v.default_driver_id
      ? h('div', { class: 'row', style: { gap: '12px' } },
          h('div', { class: 'grow' },
            h('div', { class: 'cell-main' }, v.driver_name,
              v.driver_active === 0 ? h('span', { class: 'tag warn', style: { marginLeft: '8px' } }, 'Inactive') : null),
            h('div', { class: 'cell-sub' }, Q.fmtWindow(v.driver_shift_start, v.driver_shift_end) ? `${Q.fmtWindow(v.driver_shift_start, v.driver_shift_end)}${v.driver_shift_days ? ', ' + v.driver_shift_days : ''}` : 'No shift window')),
          pairBtn)
      : h('div', { class: 'row', style: { gap: '12px' } },
          h('div', { class: 'grow t-warn' }, 'No driver, taps refused'),
          pairBtn);

    return h('tr', { class: v.active ? '' : 'is-inactive' },
      h('td', null,
        h('a', { class: 'row vehicle-link', style: { gap: '12px' }, href: Q.pagePath('vehicle') + '?id=' + v.id, title: 'Open vehicle details' },
          Q.plate(v.plate),
          h('div', null,
            h('div', { class: 'cell-main' }, [v.make, v.model].filter(Boolean).join(' ') || 'Vehicle'),
            h('div', { class: 'cell-sub' }, v.year ? String(v.year) : 'Year not set'),
            v.vin ? h('div', { class: 'cell-sub t-mono', title: 'VIN' }, v.vin) : null))),
      h('td', null, v.vehicle_type ? h('span', { class: 'tag' }, Q.typeLabel(v.vehicle_type)) : h('span', { class: 't-faint' }, '—')),
      h('td', { style: { minWidth: '260px' } }, driverCell),
      h('td', { style: { minWidth: '230px' } }, boardCell(v)),
      h('td', null, v.active_shift_id
        ? h('a', { href: Q.pagePath('shift-report') + '?id=' + v.active_shift_id, style: { color: 'inherit' } }, Q.stateBadge(st))
        : Q.stateBadge(st)),
      h('td', { class: 'actions' },
        h('button', { class: 'icon-btn', title: 'Edit', 'aria-label': `Edit ${v.plate}`, onclick: () => { editingId = v.id; render(); } }, icon('edit')),
        h('button', {
          class: 'icon-btn', title: v.active ? 'Deactivate' : 'Activate',
          'aria-label': (v.active ? 'Deactivate ' : 'Activate ') + v.plate,
          onclick: e => toggleActive(v, e.currentTarget)
        }, icon(v.active ? 'ban' : 'activate')),
        h('button', { class: 'icon-btn danger', title: 'Delete', 'aria-label': `Delete ${v.plate}`, onclick: () => remove(v) }, icon('x'))));
  }

  /* ---------- Inline edit ---------- */
  function editRow(v) {
    const f = {
      plate: h('input', { class: 'input input-sm', value: v.plate, 'aria-label': 'Plate', style: { width: '110px' } }),
      make: h('input', { class: 'input input-sm', value: v.make || '', placeholder: 'Make', 'aria-label': 'Make' }),
      model: h('input', { class: 'input input-sm', value: v.model || '', placeholder: 'Model', 'aria-label': 'Model' }),
      year: h('input', { class: 'input input-sm', value: v.year || '', placeholder: 'Year', inputmode: 'numeric', 'aria-label': 'Year', style: { width: '90px' } }),
      vin: h('input', { class: 'input input-sm', value: v.vin || '', placeholder: 'VIN (optional)', 'aria-label': 'VIN', autocomplete: 'off', spellcheck: 'false' }),
      vehicle_type: h('select', { class: 'select select-sm', 'aria-label': 'Type' },
        h('option', { value: '' }, 'Not set'),
        Q.VEHICLE_TYPES.map(t => h('option', { value: t.value, selected: t.value === v.vehicle_type ? true : null }, t.label)))
    };
    const save = h('button', { class: 'btn btn-primary btn-xs', onclick: () => saveEdit(v, f, save) }, 'Save');

    const tr = h('tr', { class: 'editing' },
      h('td', null,
        h('div', { style: { display: 'grid', gap: '6px', gridTemplateColumns: 'auto 1fr' } },
          f.plate, f.year,
          h('div', { style: { gridColumn: '1 / -1', display: 'grid', gap: '6px', gridTemplateColumns: '1fr 1fr' } }, f.make, f.model),
          h('div', { style: { gridColumn: '1 / -1' } }, f.vin))),
      h('td', null, f.vehicle_type),
      h('td', { colspan: 3, class: 'cell-sub' }, 'With the right VIN, a board plugged into this car binds itself. Change the board from the Board status column.'),
      h('td', { class: 'actions' },
        h('div', { class: 'row', style: { justifyContent: 'flex-end', gap: '6px' } },
          h('button', { class: 'btn btn-xs', onclick: () => { editingId = null; render(); } }, 'Cancel'),
          save)));

    tr.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveEdit(v, f, save); }
      if (e.key === 'Escape') { editingId = null; render(); }
    });
    setTimeout(() => f.make.focus(), 0);
    return tr;
  }

  async function saveEdit(v, f, btn) {
    const body = {
      plate: f.plate.value.trim(),
      make: f.make.value.trim(),
      model: f.model.value.trim(),
      year: f.year.value.trim() ? Number(f.year.value.trim()) : undefined,
      vehicle_type: f.vehicle_type.value || null,
      vin: f.vin.value.trim()
    };
    if (!body.plate) { f.plate.classList.add('invalid'); f.plate.focus(); return; }
    if (body.year !== undefined && (!Number.isInteger(body.year) || body.year < 1950 || body.year > 2100)) {
      f.year.classList.add('invalid'); f.year.focus(); return;
    }
    Q.busy(btn, true, '');
    try {
      await Q.api.put(`/api/vehicles/${v.id}`, body);
      editingId = null;
      Q.toast({ title: `Saved ${body.plate}` });
      await load();
    } catch (err) {
      Q.busy(btn, false);
      Q.toast({ level: 'crit', title: 'Could not save', text: err.message });
    }
  }

  /* ---------- Add ---------- */
  function addVehicle() {
    const activeDrivers = drivers.filter(d => d.active);
    Q.formDialog({
      title: 'Add vehicle',
      submitText: 'Add vehicle',
      fields: [
        { name: 'plate', label: 'Plate number', required: true, inputmode: 'numeric' },
        { name: 'vehicle_type', label: 'Type', type: 'select', value: 'van', options: Q.VEHICLE_TYPES },
        { name: 'make', label: 'Make', placeholder: 'Toyota' },
        { name: 'model', label: 'Model', placeholder: 'Hiace' },
        { name: 'year', label: 'Year', inputmode: 'numeric', placeholder: String(new Date().getFullYear()) },
        { name: 'vin', label: 'VIN (optional)', placeholder: '17 characters', hint: 'If the board can read this VIN from the car, it binds itself.' },
        {
          name: 'default_driver_id', label: 'Paired driver', type: 'select', value: '',
          options: [{ value: '', label: 'No driver yet' }].concat(activeDrivers.map(d => ({ value: d.id, label: d.name })))
        }
      ],
      onSubmit: async data => {
        if (data.year && !/^\d{4}$/.test(data.year)) throw new Error('Year must be four digits, for example 2022.');
        await Q.api.post('/api/vehicles', {
          plate: data.plate,
          vehicle_type: data.vehicle_type,
          make: data.make || null,
          model: data.model || null,
          year: data.year ? Number(data.year) : null,
          default_driver_id: data.default_driver_id ? Number(data.default_driver_id) : null,
          vin: data.vin || null
        });
        Q.toast({ title: `Vehicle ${data.plate} added`, text: 'Plug a board into it. It binds by VIN, or appears as Unbound for you to assign.' });
        await load();
      }
    });
  }

  /* ---------- Activate / deactivate ---------- */
  async function toggleActive(v, btn) {
    if (v.active) {
      const ok = await Q.confirm({
        title: `Deactivate ${v.plate}?`,
        body: 'It leaves the fleet board and stops getting weekly predictions. Its history stays, and you can activate it again later.',
        confirmText: 'Deactivate'
      });
      if (!ok) return;
    }
    Q.busy(btn, true, '');
    try {
      await Q.api.post(`/api/vehicles/${v.id}/${v.active ? 'deactivate' : 'activate'}`);
      Q.toast({ title: v.active ? `${v.plate} deactivated` : `${v.plate} is active again` });
      await load();
    } catch (err) {
      Q.busy(btn, false);
      Q.toast({ level: 'crit', title: 'Could not update', text: err.message });
    }
  }

  /* ---------- Delete ---------- */
  async function remove(v) {
    const n = Number(v.shift_count) || 0;
    let choice;
    if (n > 0) {
      choice = await Q.dialog(close => [
        h('div', { class: 'dialog-head' }, h('h2', { class: 't-h2' }, `Delete vehicle ${v.plate}?`)),
        h('div', { class: 'dialog-body' },
          h('p', null, `${v.plate} has ${n} recorded shift${n === 1 ? '' : 's'}. Deleting keeps the shifts but they lose their vehicle, and the node binding is removed.`),
          h('p', null, 'To keep the history intact, deactivate the vehicle instead.')),
        h('div', { class: 'dialog-foot' },
          h('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
          v.active ? h('button', { class: 'btn', onclick: () => close('deactivate') }, 'Deactivate instead') : null,
          h('button', { class: 'btn btn-danger-solid', onclick: () => close('delete') }, 'Delete vehicle'))
      ]);
    } else {
      choice = await Q.confirm({
        title: `Delete vehicle ${v.plate}?`,
        body: 'It has no shifts on record. This cannot be undone.',
        confirmText: 'Delete vehicle',
        danger: true
      }) ? 'delete' : null;
    }
    if (!choice) return;
    try {
      if (choice === 'deactivate') {
        await Q.api.post(`/api/vehicles/${v.id}/deactivate`);
        Q.toast({ title: `${v.plate} deactivated` });
      } else {
        await Q.api.del(`/api/vehicles/${v.id}?force=1`);
        Q.toast({ title: `${v.plate} deleted` });
      }
      await load();
    } catch (err) {
      Q.toast({ level: 'crit', title: 'Could not delete', text: err.message });
    }
  }

  load();
  const refresh = Q.debounce(() => { if (!editingId) load(); }, 600);
  Q.on('fleet', refresh);
  Q.on('node', refresh);
  Q.on('shift', refresh);
})();
