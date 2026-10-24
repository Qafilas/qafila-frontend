/* ============================================================
   Qafila — shared fleet actions
   Pairing a driver to a vehicle (the tap logic depends on it).
   ============================================================ */

(function () {
  const Q = window.Qafila;
  const { h, icon } = Q;

  /* PATCH /api/vehicles/:id/pair */
  async function pair(vehicle, driver) {
    const res = await Q.api.patch(`/api/vehicles/${vehicle.id}/pair`, { driver_id: driver ? driver.id : null });
    if (driver) {
      Q.toast({
        title: `${driver.name} paired with ${vehicle.plate}`,
        text: driver.active === 0 ? 'This driver is inactive, so their card taps will be refused until you activate them.' : 'Their next card tap in this vehicle starts a shift.',
        level: driver.active === 0 ? 'warn' : 'ok'
      });
    } else {
      Q.toast({ title: `${vehicle.plate} has no paired driver`, text: 'Card taps in this vehicle will be refused until you pair someone.', level: 'warn' });
    }
    return res;
  }

  /* Popover listing drivers; resolves after a successful change. */
  function pairPicker(anchor, vehicle, drivers, onDone) {
    let filter = '';
    const list = h('div', { class: 'popover-list' });

    function render() {
      const f = filter.toLowerCase();
      const rows = drivers
        .filter(d => !f || d.name.toLowerCase().includes(f) || String(d.employee_id).toLowerCase().includes(f))
        .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name));
      Q.mount(list, rows.length ? rows.map(d =>
        h('button', {
          class: 'popover-item' + (d.id === vehicle.default_driver_id ? ' selected' : ''),
          type: 'button', role: 'menuitem',
          onclick: async () => {
            Q.closePopover();
            if (d.id === vehicle.default_driver_id) return;
            try { await pair(vehicle, d); onDone && onDone(); }
            catch (err) { Q.toast({ level: 'crit', title: 'Pairing failed', text: err.message }); }
          }
        },
          h('span', { class: 'avatar', style: { width: '26px', height: '26px', fontSize: '11px', background: 'var(--surface-3)', color: 'var(--ink)' } }, Q.initials(d.name)),
          h('span', { class: 'grow ellipsis' }, d.name),
          h('span', { class: 'cell-sub' }, d.active ? (d.paired_plates ? d.paired_plates.split(',').length + ' paired' : 'Free') : 'Inactive')))
        : h('div', { class: 'popover-title' }, 'No driver matches'));
    }

    Q.popover(anchor, close => {
      const search = h('input', {
        class: 'input input-sm', placeholder: 'Search drivers', 'aria-label': 'Search drivers',
        oninput: e => { filter = e.target.value; render(); }
      });
      render();
      return [
        h('div', { class: 'popover-title' }, `Driver for ${vehicle.plate}`),
        h('div', { class: 'popover-search' }, search),
        list,
        vehicle.default_driver_id ? [
          h('div', { class: 'popover-sep' }),
          h('button', {
            class: 'popover-item', type: 'button', style: { color: 'var(--signal-text)' },
            onclick: async () => {
              close();
              try { await pair(vehicle, null); onDone && onDone(); }
              catch (err) { Q.toast({ level: 'crit', title: 'Could not unassign', text: err.message }); }
            }
          }, icon('unlink'), 'Unassign driver')
        ] : null
      ];
    });
  }

  Q.fleet = { pair, pairPicker };
})();
