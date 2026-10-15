const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SIDEBAR = fs.readFileSync(path.join(ROOT, 'partials', 'sidebar.html'), 'utf8');

const targets = [
  { file: 'index.html',              root: true,  active: 'dashboard'   },
  { file: 'pages/operations.html',   root: false, active: 'operations'  },
  { file: 'pages/drivers.html',      root: false, active: 'drivers'     },
  { file: 'pages/vehicles.html',     root: false, active: 'vehicles'    },
  { file: 'pages/shifts.html',       root: false, active: 'shifts'      },
  { file: 'pages/shift-report.html', root: false, active: 'shifts'      },
  { file: 'pages/predictions.html',  root: false, active: 'predictions' },
  { file: 'pages/import.html',       root: false, active: 'import'      },
  { file: 'pages/settings.html',     root: false, active: 'settings'    }
];

const MARKER = '<!-- SIDEBAR -->';
let touched = 0;

targets.forEach(({ file, root, active }) => {
  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) {
    console.warn('skip (missing):', file);
    return;
  }

  let html = fs.readFileSync(full, 'utf8');

  /* On the root dashboard page, sibling links need the pages/ prefix.
     On pages inside /pages/, sibling links are local, and the dashboard
     link needs to go up one level. */
  const base      = root ? 'pages/' : '';
  const dashboard = root ? 'index.html' : '../index.html';

  let block = SIDEBAR
    .replace(/__DASHBOARD__/g, dashboard)
    .replace(/__BASE__/g, base);

  block = block.replace(/__ACTIVE_(\w+)__/g, (_, name) =>
    name === active ? 'active' : ''
  );

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