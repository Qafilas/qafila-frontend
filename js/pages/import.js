/* Qafila — import the manager's own fleet CSV (one row = one driver-vehicle pair) */

(function () {
  const Q = window.Qafila;
  if (!Q.on) return;
  const { h, icon, mount, $ } = Q;

  const COLUMNS = ['name', 'employee_id', 'phone', 'license', 'plate', 'make', 'model', 'year', 'vehicle_type', 'vin', 'shift_start', 'shift_end', 'days'];
  const ALIASES = { type: 'vehicle_type', vehicle: 'plate', plate_number: 'plate', shift_days: 'days', licence: 'license', employee: 'employee_id', emp_id: 'employee_id' };

  let rows = [];

  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', class: 'sr-only', id: 'csv-file' });
  const chooseBtn = h('label', { class: 'btn', for: 'csv-file', tabindex: '0' }, icon('file'), 'Choose File');
  const fileName = h('span', { class: 't-muted' }, 'No file chosen');
  const importBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: true }, icon('upload'), 'Import');
  const result = h('div', { class: 'import-result' });
  const preview = h('div', { class: 'import-preview' });

  chooseBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });

  /* ---------- What the CSV must contain ---------- */
  const GUIDE = [
    ['name', 'Required', 'Driver 1', "The driver's name as it should appear on the dashboard."],
    ['employee_id', 'Required', 'EMP-0142', 'Unique for each driver. Used to update the same driver next time.'],
    ['phone', 'Optional', '+97455512345', 'Shown with alerts so you can call the driver.'],
    ['license', 'Optional', 'QA-123456', "Driver's licence number."],
    ['plate', 'Required', '12345', 'Unique for each vehicle. Used to update the same vehicle next time.'],
    ['make', 'Optional', 'Toyota', ''],
    ['model', 'Optional', 'Hiace', ''],
    ['year', 'Optional', '2020', 'Four digits.'],
    ['vehicle_type', 'Optional', 'bus', 'One of car, bus or truck.'],
    ['vin', 'Optional', 'JTFSX23P0L6123456', 'Lets the board bind to this vehicle by itself. Leave blank if you do not know it.'],
    ['shift_start', 'Required', '06:00 AM', 'Start of the driver\'s shift, Qatar time, with AM or PM.'],
    ['shift_end', 'Required', '02:00 PM', 'End of the shift. An end earlier than the start means an overnight shift.'],
    ['days', 'Optional', 'Sun-Thu', 'Working days.']
  ];

  const guide = h('section', { class: 'panel' },
    h('div', { class: 'panel-head' },
      h('h2', { class: 't-h2' }, 'What your CSV file must contain',
        h('div', { class: 'panel-sub' }, 'The first row holds the column names below. Every other row is one driver and the vehicle they drive.'))),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'table' },
        h('thead', null, h('tr', null,
          h('th', null, 'Column'), h('th', null, 'Needed'), h('th', null, 'Example'), h('th', null, 'Notes'))),
        h('tbody', null, GUIDE.map(([col, need, ex, note]) => h('tr', null,
          h('td', null, h('code', { class: 'col-name' }, col)),
          h('td', null, h('span', { class: 'tag ' + (need === 'Required' ? 'brand' : '') }, need)),
          h('td', { class: 'nowrap' }, ex),
          h('td', { class: 't-muted' }, note)))))),
    h('div', { class: 'panel-body guide-foot' },
      h('div', { class: 'field-label' }, 'Example rows'),
      h('pre', { class: 'csv-example' },
        'name,employee_id,phone,license,plate,make,model,year,vehicle_type,vin,shift_start,shift_end,days\n' +
        'Driver 1,EMP-0142,+97455512345,QA-123456,12345,Toyota,Hiace,2020,bus,JTFSX23P0L6123456,06:00 AM,02:00 PM,Sun-Thu\n' +
        'Driver 2,EMP-0187,+97455567890,QA-234567,67890,Nissan,Urvan,2022,bus,,02:00 PM,10:00 PM,Sun-Thu\n' +
        'Driver 3,EMP-0203,+97455598765,QA-345678,11111,Ford,Transit,2023,truck,,10:00 PM,06:00 AM,Mon-Fri'),
      h('ul', { class: 'how-list' },
        h('li', null, 'Write the column names exactly as shown. Their order does not matter.'),
        h('li', null, 'One driver can appear on more than one row if they drive more than one vehicle.'),
        h('li', null, 'Uploading again updates existing drivers and vehicles. Empty cells never erase saved details, and nothing is deleted.'),
        h('li', null, 'In Excel use File, Save As, CSV UTF-8. In Google Sheets use File, Download, Comma-separated values.'))));

  mount($('#page'),
    Q.qs('welcome') ? h('div', { class: 'notice' }, icon('info'),
      h('div', null, h('strong', null, 'Welcome to Qafila. '), 'Start by importing your fleet CSV.')) : null,
    h('section', { class: 'panel import-card' },
      h('div', { class: 'panel-body' },
        h('h2', { class: 't-h2' }, 'Import your fleet'),
        h('p', { class: 't-muted', style: { marginTop: '6px', maxWidth: '60ch' } },
          'Upload your fleet spreadsheet as a CSV file. Each row pairs a driver with a vehicle. See below for the columns it needs.'),
        h('div', { class: 'import-picker' }, fileInput, chooseBtn, fileName, importBtn),
        result),
      preview),
    guide);

  /* ---------- CSV parsing ---------- */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const semi = !text.slice(0, 300).includes(',') && text.slice(0, 300).includes(';');
    const out = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === (semi ? ';' : ',')) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field.length || row.length) { row.push(field); out.push(row); }
    return out.filter(r => r.some(c => c.trim() !== ''));
  }

  function normHeader(s) {
    const k = String(s).trim().toLowerCase().replace(/[\s-]+/g, '_');
    return ALIASES[k] || k;
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    mount(result);
    mount(preview);
    rows = [];
    importBtn.disabled = true;
    importBtn.lastChild.textContent = 'Import';
    if (!file) { fileName.textContent = 'No file chosen'; return; }

    fileName.textContent = file.name;
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      mount(result, h('div', { class: 'form-error' }, `${file.name} is not a CSV file. In Excel use File, Save As, CSV UTF-8. In Google Sheets use File, Download, CSV.`));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const matrix = parseCSV(String(reader.result));
      if (matrix.length < 2) {
        mount(result, h('div', { class: 'form-error' }, 'The file has no rows under the header.'));
        return;
      }
      const header = matrix[0].map(normHeader);
      if (!header.includes('name') || (!header.includes('employee_id') && !header.includes('plate'))) {
        mount(result, h('div', { class: 'form-error' }, `The first row must be the column names, including name, employee_id and plate. Found: ${matrix[0].join(', ')}.`));
        return;
      }
      rows = matrix.slice(1).map(r => {
        const o = {};
        header.forEach((c, i) => { if (COLUMNS.includes(c)) o[c] = (r[i] || '').trim(); });
        return o;
      });
      fileName.textContent = `${file.name}, ${rows.length} row${rows.length === 1 ? '' : 's'}`;
      runPreview(file.name);
    };
    reader.readAsText(file);
  });

  /* ---------- Preview: the server checks every row without saving ---------- */
  const WORD = { created: ['New', 'ok'], updated: ['Updated', 'duty'], unchanged: ['No change', ''], set: ['New pairing', 'ok'] };
  const tagFor = v => v && WORD[v] ? h('span', { class: 'tag ' + WORD[v][1] }, WORD[v][0]) : h('span', { class: 't-faint' }, '—');

  async function runPreview(name) {
    mount(preview, h('div', { class: 'panel-body t-muted' }, h('span', { class: 'spin' }), ' Checking every row…'));
    let r;
    try { r = await Q.api.post('/api/import?dry_run=1', { rows }); }
    catch (err) { mount(preview, h('div', { class: 'panel-body' }, h('div', { class: 'form-error' }, err.message))); return; }

    const notes = {};
    (r.warnings || []).forEach(w => { const m = /^Row (\d+):\s*(.*)$/.exec(w); if (m) (notes[m[1]] = notes[m[1]] || []).push(m[2]); });
    const bad = r.rows.filter(x => x.error).length;
    const good = r.rows.length - bad;
    const parts = [];
    if (r.driversCreated) parts.push(`${r.driversCreated} new driver${r.driversCreated === 1 ? '' : 's'}`);
    if (r.driversUpdated) parts.push(`${r.driversUpdated} driver${r.driversUpdated === 1 ? '' : 's'} updated`);
    if (r.vehiclesCreated) parts.push(`${r.vehiclesCreated} new vehicle${r.vehiclesCreated === 1 ? '' : 's'}`);
    if (r.vehiclesUpdated) parts.push(`${r.vehiclesUpdated} vehicle${r.vehiclesUpdated === 1 ? '' : 's'} updated`);
    if (r.pairsSet) parts.push(`${r.pairsSet} new pairing${r.pairsSet === 1 ? '' : 's'}`);

    mount(preview,
      h('div', { class: 'panel-head', style: { borderTop: '1px solid var(--line)' } },
        h('h2', { class: 't-h2' }, 'Preview, nothing saved yet',
          h('div', { class: 'panel-sub' },
            (parts.length ? parts.join(', ') : 'No changes') + '. ' +
            (bad ? `${bad} row${bad === 1 ? '' : 's'} will be skipped.` : 'Every row can be imported.')))),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table preview-table' },
          h('thead', null, h('tr', null,
            h('th', { class: 'num' }, 'Row'), h('th', null, 'Driver'), h('th', null, 'Vehicle'),
            h('th', null, 'Driver change'), h('th', null, 'Vehicle change'), h('th', null, 'Pairing'), h('th', null, 'Notes'))),
          h('tbody', null, r.rows.map(x => {
            const src = rows[x.row - 2] || {};
            const n = notes[x.row] || [];
            return h('tr', { class: x.error ? 'bad' : '' },
              h('td', { class: 'num' }, String(x.row)),
              h('td', null, h('div', { class: 'cell-main' }, src.name || '—'), h('div', { class: 'cell-sub' }, src.employee_id || '')),
              h('td', null, src.plate ? Q.plate(src.plate, 'sm') : h('span', { class: 't-faint' }, '—')),
              x.error ? h('td', { colspan: 3, class: 'err' }, h('strong', null, 'Skipped: '), x.error) : [h('td', null, tagFor(x.driver)), h('td', null, tagFor(x.vehicle)), h('td', null, tagFor(x.pair))],
              h('td', { class: 'cell-sub' }, n.length ? n.join('; ') : ''));
          })))));

    if (good) {
      importBtn.disabled = false;
      importBtn.lastChild.textContent = `Import ${good} row${good === 1 ? '' : 's'}`;
      importBtn.focus();
    } else {
      mount(result, h('div', { class: 'form-error' }, `No row in ${name} can be imported. Fix the rows marked Skipped and choose the file again.`));
    }
  }

  /* ---------- Import ---------- */
  importBtn.addEventListener('click', async () => {
    if (!rows.length) return;
    Q.busy(importBtn, true, 'Importing');
    mount(result);
    mount(preview);
    try {
      const r = await Q.api.post('/api/import', { rows });
      const updated = r.driversUpdated + r.vehiclesUpdated;
      const line = `${r.driversCreated} driver${r.driversCreated === 1 ? '' : 's'} created, ` +
        `${r.vehiclesCreated} vehicle${r.vehiclesCreated === 1 ? '' : 's'} created, ` +
        `${updated} updated, ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}`;

      mount(result,
        h('div', { class: 'import-summary' },
          h('div', { class: 'result-line' }, line),
          r.pairsSet ? h('div', { class: 't-muted' }, `${r.pairsSet} driver-vehicle pairing${r.pairsSet === 1 ? '' : 's'} set.`) : null),
        r.errors.length ? h('div', { class: 'notice crit' }, icon('alert'),
          h('div', null, h('strong', null, 'Skipped rows'),
            h('ul', { class: 'import-issues' }, r.errors.slice(0, 20).map(e => h('li', null, e))))) : null,
        r.warnings && r.warnings.length ? h('div', { class: 'notice warn' }, icon('info'),
          h('div', null, h('strong', null, 'Imported with notes'),
            h('ul', { class: 'import-issues' }, r.warnings.slice(0, 20).map(e => h('li', null, e))))) : null,
        h('div', { class: 'row-w' },
          h('a', { class: 'btn', href: Q.pagePath('vehicles') }, 'Go to vehicles'),
          h('a', { class: 'btn', href: Q.pagePath('drivers') }, 'Go to drivers')));

      Q.toast({ title: 'Fleet imported', text: line });
      rows = [];
      fileInput.value = '';
      fileName.textContent = 'No file chosen';
      Q.busy(importBtn, false);
      importBtn.disabled = true;
      importBtn.lastChild.textContent = 'Import';
    } catch (err) {
      Q.busy(importBtn, false);
      mount(result, h('div', { class: 'form-error' }, err.message));
    }
  });
})();
