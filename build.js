const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SIDEBAR = fs.readFileSync(path.join(ROOT, 'partials', 'sidebar.html'), 'utf8');

const targets = [
  { file: 'index.html',              base: 'pages/', active: 'dashboard'   },
  { file: 'pages/operations.html',   base: '',       active: 'operations'  },
  { file: 'pages/drivers.html',      base: '',       active: 'drivers'     },
  { file: 'pages/vehicles.html',     base: '',       active: 'vehicles'    },
  { file: 'pages/shifts.html',       base: '',       active: 'shifts'      },
  { file: 'pages/shift-report.html', base: '',       active: 'shifts'      },
  { file: 'pages/predictions.html',  base: '',       active: 'predictions' },
  { file: 'pages/import.html',       base: '',       active: 'import'      },
  { file: 'pages/settings.html',     base: '',       active: 'settings'    }
];

const MARKER = '<!-- SIDEBAR -->';
let touched = 0;

targets.forEach(({ file, base, active }) => {
  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) {
    console.warn('skip (missing):', file);
    return;
  }

  let html = fs.readFileSync(full, 'utf8');

  let block = SIDEBAR.replace(/__BASE__/g, base);
  block = block.replace(/__ACTIVE_(\w+)__/g, (_, name) =>
    name === active ? 'active' : ''
  );

  /* Replace either the marker or an existing <aside class="sidebar" ...> block */
  if (html.includes(MARKER)) {
    html = html.replace(MARKER, block);
  } else {
    html = html.replace(/<aside class="sidebar"[\s\S]*?<\/aside>/, block);
  }

  fs.writeFileSync(full, html);
  console.log('built:', file);
  touched++;
});

console.log(`done (${touched} file${touched === 1 ? '' : 's'})`);