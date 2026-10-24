/* ============================================================
   Qafila — shared fleet actions
   Pairing drivers with vehicles. A vehicle can have several
   paired drivers (back-to-back shifts); the card tap picks the
   one whose shift window covers the current time.
   ============================================================ */

(function () {
  const Q = window.Qafila;
  const { h, icon } = Q;

  const pairedIds = v => (v.drivers || []).map(d => d.id);

  async function addDriver(vehicle, driver) {
    await Q.api.post(`/api/vehicles/${vehicle.id}/drivers`, { driver_id: driver.id });
    Q.toast({
      title: `${driver.name} paired with ${vehicle.plate}`,
      text: driver.active === 0
        ? 'This driver is inactive, so their card taps will be refused until you activate them.'
        : 'A tap in this vehicle during their shift window starts their shift.',
      level: driver.active === 0 ? 'warn' : 'ok'
    });
  }

  async function removeDriver(vehicle, driver) {
    await Q.api.del(`/api/vehicles/${vehicle.id}/drivers/${driver.id}`);
    const left = pairedIds(vehicle).filter(id => id !== driver.id).length;
    Q.toast({
      title: `${driver.name} removed from ${vehicle.plate}`,
      text: left ? null : 'No drivers left on this vehicle, so card taps in it will be refused.',
      level: left ? 'ok' : 'warn'
    });
  }

  /* Kept for callers that set exactly one driver (or none) */
  async function pair(vehicle, driver) {
    await Q.api.patch(`/api/vehicles/${vehicle.id}/pair`, { driver_id: driver ? driver.id : null });
    if (driver) Q.toast({ title: `${driver.name} is now the only driver on ${vehicle.plate}` });
    else Q.toast({ title: `${vehicle.plate} has no drivers`, text: 'Card taps in this vehicle will be refused until you pair someone.', level: 'warn' });
  }

  /* Popover: tick drivers on and off for one vehicle */
  function pairPicker(anchor, vehicle, drivers, onDone) {
    let filter = '';
    const list = h('div', { class: 'popover-list' });

    function render() {
      const f = filter.toLowerCase();
      const on = new Set(pairedIds(vehicle));
      const rows = drivers
        .filter(d => !f || d.name.toLowerCase().includes(f) || String(d.employee_id).toLowerCase().includes(f))
        .sort((a, b) => (on.has(b.id) - on.has(a.id)) || (b.active - a.active) || a.name.localeCompare(b.name));
      Q.mount(list, rows.length ? rows.map(d => {
        const isOn = on.has(d.id);
        return h('button', {
          class: 'popover-item' + (isOn ? ' selected' : ''),
          type: 'button', role: 'menuitemcheckbox', 'aria-checked': isOn ? 'true' : 'false',
          onclick: async () => {
            Q.closePopover();
            try {
              if (isOn) await removeDriver(vehicle, d);
              else await addDriver(vehicle, d);
              onDone && onDone();
            } catch (err) { Q.toast({ level: 'crit', title: 'Could not update pairing', text: err.message }); }
          }
        },
          h('span', { class: 'pick-box' }, isOn ? icon('check') : null),
          h('span', { class: 'grow' },
            h('span', { class: 'ellipsis', style: { display: 'block' } }, d.name),
            h('span', { class: 'cell-sub' }, Q.fmtWindow(d.shift_start, d.shift_end) || 'No shift window')),
          !d.active ? h('span', { class: 'cell-sub' }, 'Inactive') : null);
      }) : h('div', { class: 'popover-title' }, 'No driver matches'));
    }

    Q.popover(anchor, close => {
      const search = h('input', {
        class: 'input input-sm', placeholder: 'Search drivers', 'aria-label': 'Search drivers',
        oninput: e => { filter = e.target.value; render(); }
      });
      render();
      return [
        h('div', { class: 'popover-title' }, `Drivers for ${vehicle.plate}. Tick everyone who drives it.`),
        h('div', { class: 'popover-search' }, search),
        list
      ];
    });
  }

  Q.fleet = { pair, addDriver, removeDriver, pairPicker };
})();
