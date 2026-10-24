# Qafila — frontend

Fleet manager dashboard for Qafila. Plain HTML, CSS and JavaScript, no framework and no build step. Served from GitHub Pages.

## Pages

| Page | File | What it does |
|------|------|--------------|
| Sign in | `login.html` | Sign in, create account, forgot password and reset password (the emailed link opens `login.html?reset=...`). |
| Dashboard | `index.html` | Five metrics (shifts, drivers, vehicles, critical, warning), emergency alerts with Call driver, maintenance predictions, recent reports. |
| Operations | `pages/operations.html` | Active shifts with live readings; pairing board (drag a driver onto a vehicle). |
| Drivers | `pages/drivers.html` | Add, inline edit, activate/deactivate, delete with confirmation. |
| Vehicles | `pages/vehicles.html` | Add, inline edit, type, VIN, paired driver, Board status with Assign / Change (wireless board binding). |
| Vehicle | `pages/vehicle.html?id=` | One vehicle: driver, board, 30-day stats, daily coolant / voltage / fuel trim trends with warning lines, open predictions, alerts, recent shifts. |
| Alerts | `pages/alerts.html` | Every alert, open and resolved, filterable by status, level, type, vehicle and date. |
| Shifts | `pages/shifts.html` | Filterable history, CSV export, click a row for its report. |
| Shift report | `pages/shift-report.html?id=` | Header, behaviour summary, event log, alerts, predictions, summary stats, speed/coolant chart. Printable. |
| Predictions | `pages/predictions.html` | Weekly OLS trends (acknowledge / mark serviced / run now) and head gasket watch. |
| Import | `pages/import.html` | Choose File, Import, summary. |
| Settings | `pages/settings.html` | Profile, password, node health. |

## Structure

```
css/   base.css (tokens, light + dark), layout.css (shell), components.css, pages.css
js/    theme.js   applies saved theme before paint
       api.js     backend URL, token, fetch wrapper
       ui.js      element builder, icons, formatting, plates, LEDs, toasts, dialogs
       shell.js   sidebar + top bar injected on every page, clock, Socket.IO, live alerts
       fleet.js   pairing helpers shared by Operations and Vehicles
       chart.js   line chart with warning lines and hover readout
       pages/*.js one script per page
assets/ login.jpg, favicon.svg
```

The sidebar is built once in `js/shell.js` and injected into every page at load, so there is no `build.js` step any more.

## Backend URL

Defaults to `https://qafila-backend.onrender.com` (in `js/api.js`). To test against a local backend, run this once in the browser console, then reload:

```js
localStorage.setItem('qafila_api_base', 'http://localhost:3000')
```

`localStorage.removeItem('qafila_api_base')` switches back to Render.

## Run locally

Any static server works, for example the VS Code "Live Server" extension, or:

```
python3 -m http.server 5500
```

then open http://localhost:5500/login.html.

## Notes

- Critical alerts play a short alarm (three 1000 Hz beeps, twice) with the pop-up. The bell button in the sidebar mutes it. Browsers only allow sound after the page has been clicked once.

- Shift windows are entered and checked in Qatar time (backend `SHIFT_TIMEZONE`, default `Asia/Qatar`). All times on the site are shown in 12-hour format.
- Requires the updated backend (vehicle pairing, `/api/nodes`, import preview).
