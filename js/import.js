/* Qafila import page — CSV upload, preview, POST to /api/import */

(function () {
  if (!getToken()) {
    location.href = '../login.html';
    return;
  }

  /* ============================================================
     DOM refs
     ============================================================ */

  const downloadBtn  = document.getElementById('download-template');
  const fileInput    = document.getElementById('file-input');
  const fileButton   = document.getElementById('file-button');
  const fileNameEl   = document.getElementById('file-name');
  const importErr    = document.getElementById('import-error');

  const previewPanel = document.getElementById('preview-panel');
  const previewCount = document.getElementById('preview-count');
  const previewTable = document.getElementById('preview-table');
  const summaryEl    = document.getElementById('import-summary');

  const submitBtn    = document.getElementById('import-submit');
  const cancelBtn    = document.getElementById('import-cancel');
  const resultEl     = document.getElementById('import-result');

  /* ============================================================
     State
     ============================================================ */

  const EXPECTED_COLUMNS = [
    'name', 'employee_id', 'phone', 'license',
    'plate', 'make', 'model', 'year', 'node_id'
  ];

  let parsedRows = [];   /* [{ name, employee_id, ... }] */
  let parsedErrors = []; /* strings from parsing */

  /* ============================================================
     Helpers
     ============================================================ */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ============================================================
     Download template
     ============================================================ */

  downloadBtn.addEventListener('click', () => {
    const header = EXPECTED_COLUMNS.join(',');
    const sample1 = 'Ahmed Al-Mansoori,EMP-0142,+97455512345,QA-123456,12345,Toyota,Hiace,2020,NODE-001';
    const sample2 = 'Khalid Al-Kuwari,EMP-0187,+97455567890,QA-234567,67890,Nissan,Urvan,2022,NODE-002';
    const sample3 = 'Sara Al-Thani,EMP-0203,+97455598765,QA-345678,,,,,';
    const content = [header, sample1, sample2, sample3].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'qafila-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  /* ============================================================
     CSV parser (handles quotes and commas inside quotes)
     ============================================================ */

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    /* Strip BOM if present */
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    while (i < text.length) {
      const c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }

      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }

      field += c;
      i++;
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function csvToObjects(csvText) {
    const matrix = parseCSV(csvText);

    if (matrix.length === 0) {
      return { rows: [], errors: ['File is empty'] };
    }

    const header = matrix[0].map(h => String(h).trim().toLowerCase());

    const missing = EXPECTED_COLUMNS.filter(col => !header.includes(col));
    const errors = [];
    if (missing.length) {
      errors.push('Missing column(s): ' + missing.join(', '));
    }

    const rows = [];

    for (let i = 1; i < matrix.length; i++) {
      const line = matrix[i];

      /* Skip completely empty lines */
      if (line.length === 1 && line[0].trim() === '') continue;

      const obj = {};
      EXPECTED_COLUMNS.forEach(col => {
        const idx = header.indexOf(col);
        obj[col] = idx >= 0 ? String(line[idx] ?? '').trim() : '';
      });

      rows.push(obj);
    }

    return { rows, errors };
  }

  /* ============================================================
     File input
     ============================================================ */

  fileButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    importErr.hidden = true;
    resultEl.hidden  = true;

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      fileNameEl.textContent = 'No file selected';
      previewPanel.hidden = true;
      return;
    }

    fileNameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target.result || '');
      const { rows, errors } = csvToObjects(text);

      parsedRows = rows;
      parsedErrors = errors;

      if (errors.length) {
        importErr.textContent = errors.join(' · ');
        importErr.hidden = false;
        previewPanel.hidden = true;
        return;
      }

      if (rows.length === 0) {
        importErr.textContent = 'No data rows found (only the header is present).';
        importErr.hidden = false;
        previewPanel.hidden = true;
        return;
      }

      renderPreview();
      previewPanel.hidden = false;
    };
    reader.readAsText(file, 'UTF-8');
  });

  /* ============================================================
     Preview + summary
     ============================================================ */

  function renderPreview() {
    previewCount.textContent = parsedRows.length + ' row' + (parsedRows.length === 1 ? '' : 's');
    previewTable.innerHTML = '';

    const table = el('table');

    const thead = el('thead');
    const headRow = el('tr');
    EXPECTED_COLUMNS.forEach(col => headRow.appendChild(el('th', '', col)));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el('tbody');
    const maxRows = Math.min(parsedRows.length, 20);

    for (let i = 0; i < maxRows; i++) {
      const tr = el('tr');
      EXPECTED_COLUMNS.forEach(col => {
        tr.appendChild(el('td', '', parsedRows[i][col] || '—'));
      });
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    previewTable.appendChild(table);

    if (parsedRows.length > maxRows) {
      previewTable.appendChild(el('div', 'form-hint',
        `…and ${parsedRows.length - maxRows} more rows not shown.`));
    }

    renderSummary();
    submitBtn.disabled = false;
  }

  function renderSummary() {
    summaryEl.innerHTML = '';

    let withDriver = 0;
    let withVehicle = 0;
    let withBoth = 0;
    let emptyRows = 0;

    const seenEmp = new Set();
    const seenPlate = new Set();
    let duplicateEmp = 0;
    let duplicatePlate = 0;

    parsedRows.forEach(r => {
      const hasDriver  = r.employee_id && r.name;
      const hasVehicle = r.plate;

      if (!r.employee_id && !r.plate) { emptyRows++; return; }
      if (hasDriver) withDriver++;
      if (hasVehicle) withVehicle++;
      if (hasDriver && hasVehicle) withBoth++;

      if (r.employee_id) {
        if (seenEmp.has(r.employee_id)) duplicateEmp++;
        else seenEmp.add(r.employee_id);
      }
      if (r.plate) {
        if (seenPlate.has(r.plate)) duplicatePlate++;
        else seenPlate.add(r.plate);
      }
    });

    const rows = [
      { k: 'Total rows in file',   v: parsedRows.length },
      { k: 'Rows with a driver',   v: withDriver },
      { k: 'Rows with a vehicle',  v: withVehicle },
      { k: 'Rows with both',       v: withBoth }
    ];

    if (duplicateEmp > 0)   rows.push({ k: 'Duplicate employee IDs in file', v: duplicateEmp, warn: true });
    if (duplicatePlate > 0) rows.push({ k: 'Duplicate plates in file', v: duplicatePlate, warn: true });
    if (emptyRows > 0)      rows.push({ k: 'Empty rows (ignored)', v: emptyRows });

    rows.forEach(r => {
      const line = el('div', 'summary-row' + (r.warn ? ' warn' : ''));
      line.appendChild(el('span', 'k', r.k));
      line.appendChild(el('span', 'v', String(r.v)));
      summaryEl.appendChild(line);
    });
  }

  /* ============================================================
     Submit
     ============================================================ */

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Importing…';
    resultEl.hidden = true;
    importErr.hidden = true;

    try {
      const res = await apiFetch('/api/import', {
        method: 'POST',
        body: JSON.stringify({ rows: parsedRows })
      });

      renderResult(res);
    } catch (err) {
      importErr.textContent = 'Import failed: ' + err.message;
      importErr.hidden = false;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Import';
  });

  function renderResult(res) {
    summaryEl.innerHTML = '';

    const lines = [
      { k: 'Drivers created',  v: res.driversCreated },
      { k: 'Drivers skipped (already existed)', v: res.driversSkipped, warn: true },
      { k: 'Vehicles created', v: res.vehiclesCreated },
      { k: 'Vehicles skipped (already existed)', v: res.vehiclesSkipped, warn: true },
      { k: 'Nodes created',    v: res.nodesCreated }
    ];

    lines.forEach(r => {
      const line = el('div', 'summary-row' + (r.warn && r.v > 0 ? ' warn' : ''));
      line.appendChild(el('span', 'k', r.k));
      line.appendChild(el('span', 'v', String(r.v)));
      summaryEl.appendChild(line);
    });

    if (Array.isArray(res.errors) && res.errors.length) {
      const box = el('div', 'summary-errors');
      res.errors.forEach(e => box.appendChild(el('div', '', e)));
      summaryEl.appendChild(box);
    }

    resultEl.textContent = 'Import complete. Open Drivers or Vehicles to review.';
    resultEl.hidden = false;

    submitBtn.disabled = true;
  }

  /* ============================================================
     Cancel
     ============================================================ */

  cancelBtn.addEventListener('click', () => {
    parsedRows = [];
    parsedErrors = [];
    fileInput.value = '';
    fileNameEl.textContent = 'No file selected';
    previewPanel.hidden = true;
    importErr.hidden = true;
    resultEl.hidden = true;
  });
})();