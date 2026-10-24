/* ============================================================
   Qafila — app shell
   Guards the page, injects the sidebar and top bar, runs the
   clocks, connects Socket.IO and shows live alerts.

   Each page provides:
     <div id="side-slot"></div>
     <header class="topbar" data-title="Drivers" data-crumb="..."></header>
   and <body data-page="drivers">.
   ============================================================ */

(function () {
  const Q = window.Qafila;
  const { h, icon, $ } = Q;

  /* ---------- Auth guard ---------- */
  if (!Q.getToken() || Q.tokenExpired()) {
    Q.clearToken();
    location.replace(Q.loginUrl());
    return;
  }

  const page = document.body.dataset.page || 'dashboard';
  const me = Q.tokenPayload() || {};

  /* ---------- Event bus for live updates ---------- */
  const bus = new EventTarget();
  Q.on = (type, fn) => bus.addEventListener(type, e => fn(e.detail));
  Q.emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

  /* ---------- Brand mark: a lane seen from the driver's seat ---------- */
  function brandMark() {
    const span = document.createElement('span');
    span.innerHTML = `<svg class="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="8" fill="#8A1538"/>
      <path d="M8 28 L14.5 7 M26 28 L19.5 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M17 24.5v3.5M17 16.5v3M17 9.5v2.2" stroke="#E2A400" stroke-width="2.4" stroke-linecap="round"/>
    </svg>`;
    return span.firstChild;
  }
  Q.brandMark = brandMark;

  /* ---------- Sidebar ---------- */
  const NAV = [
    { group: 'Fleet', items: [
      { id: 'dashboard',  label: 'Dashboard',  icon: 'dashboard' },
      { id: 'operations', label: 'Operations', icon: 'operations' },
      { id: 'drivers',    label: 'Drivers',    icon: 'drivers' },
      { id: 'vehicles',   label: 'Vehicles',   icon: 'vehicles' },
      { id: 'shifts',     label: 'Shifts',     icon: 'shifts' }
    ]},
    { group: 'Insights', items: [
      { id: 'predictions', label: 'Predictions', icon: 'predictions' },
      { id: 'alerts',      label: 'Alerts',      icon: 'alert' }
    ]},
    { group: 'System', items: [
      { id: 'import',   label: 'Import', icon: 'import' },
      { id: 'settings', label: 'Settings',   icon: 'settings' }
    ]}
  ];

  const activeId = page === 'shift-report' ? 'shifts' : page === 'vehicle' ? 'vehicles' : page;

  const themeBtn = h('button', { class: 'side-icon-btn', type: 'button', 'aria-label': 'Switch theme', title: 'Switch theme' });
  function paintThemeBtn() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    Q.mount(themeBtn, icon(dark ? 'sun' : 'moon'));
  }
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('qafila_theme', next); } catch (_) {}
    paintThemeBtn();
  });
  paintThemeBtn();

  /* ---------- Alarm sound for critical alerts ---------- */
  let soundOn = true;
  try { soundOn = localStorage.getItem('qafila_sound') !== 'off'; } catch (_) {}
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  /* Browsers only allow sound after the page has been clicked once. */
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, ensureAudio, { once: true, capture: true }));

  function playAlarm() {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const start = ctx.currentTime + 0.05;
    /* three short 1000 Hz beeps, twice, like the buzzer in the car */
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 3; i++) {
        const t0 = start + r * 1.1 + i * 0.22;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.16);
      }
    }
  }
  Q.playAlarm = playAlarm;

  const soundBtn = h('button', { class: 'side-icon-btn', type: 'button' });
  function paintSoundBtn() {
    Q.mount(soundBtn, icon(soundOn ? 'bell' : 'bellOff'));
    const t = soundOn ? 'Alarm sound on for critical alerts. Click to mute.' : 'Alarm sound muted. Click to turn on.';
    soundBtn.title = t;
    soundBtn.setAttribute('aria-label', t);
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem('qafila_sound', soundOn ? 'on' : 'off'); } catch (_) {}
    paintSoundBtn();
    if (soundOn) playAlarm();
  });
  paintSoundBtn();

  const logoutBtn = h('button', { class: 'side-icon-btn', type: 'button', 'aria-label': 'Sign out', title: 'Sign out' }, icon('logout'));
  logoutBtn.addEventListener('click', () => {
    Q.clearToken();
    location.href = Q.loginUrl();
  });

  const alertCount = h('span', { class: 'side-count', hidden: true });

  const side = h('aside', { class: 'side', id: 'side', 'aria-label': 'Main navigation' },
    h('a', { class: 'side-brand', href: Q.pagePath('dashboard') },
      brandMark(),
      h('span', { class: 'brand-words' },
        h('span', { class: 'brand-ar', lang: 'ar' }, 'قافلة'),
        h('span', { class: 'brand-en' }, 'QAFILA'))),
    h('nav', { class: 'side-nav' },
      NAV.map(g => h('div', { class: 'side-group' },
        h('div', { class: 'side-group-label' }, g.group),
        g.items.map(it => {
          const a = h('a', {
            class: 'side-link' + (it.id === activeId ? ' active' : ''),
            href: Q.pagePath(it.id),
            'aria-current': it.id === activeId ? 'page' : null
          }, icon(it.icon), h('span', null, it.label));
          if (it.id === 'dashboard') a.appendChild(alertCount);
          return a;
        })))),
    h('div', { class: 'side-foot' },
      h('div', { class: 'side-user' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, Q.initials(me.name || 'M')),
        h('div', { class: 'grow' },
          h('div', { class: 'side-user-name ellipsis', id: 'side-user-name' }, me.name || 'Manager'),
          h('div', { class: 'side-user-role' }, 'Fleet manager'))),
      h('div', { class: 'side-actions' }, soundBtn, themeBtn, logoutBtn)));

  const slot = $('#side-slot');
  if (slot) slot.replaceWith(side);
  const scrim = h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open') });
  document.body.appendChild(scrim);

  Q.setUserName = name => { const el = $('#side-user-name'); if (el) el.textContent = name; };

  /* ---------- Top bar ---------- */
  const top = $('.topbar');
  const clockTime = h('div', { class: 'clock-time' }, '--:--');
  const clockDate = h('div', { class: 'clock-label' });

  if (top) {
    const crumb = top.dataset.crumb;
    const crumbHref = top.dataset.crumbHref;
    Q.mount(top,
      h('button', {
        class: 'topbar-menu', type: 'button', 'aria-label': 'Open navigation',
        onclick: () => document.body.classList.toggle('nav-open')
      }, icon('menu')),
      h('div', { class: 'topbar-title' },
        crumb ? h('div', { class: 'crumbs' },
          h('a', { href: crumbHref ? Q.pagePath(crumbHref) : '#' }, crumb), h('span', null, '/')) : null,
        h('h1', { class: 'topbar-h1', id: 'page-title' }, top.dataset.title || document.title)),
      h('div', { class: 'topbar-right' },
        h('div', { class: 'clocks' },
          h('div', { class: 'clock' }, clockTime, clockDate))));
  }

  function tick() {
    const d = new Date();
    clockTime.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    clockDate.textContent = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  tick();
  setInterval(tick, 10000);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.body.classList.remove('nav-open');
  });

  /* ---------- Unresolved critical count in the sidebar ---------- */
  async function refreshAlertCount() {
    try {
      const live = await Q.api.get('/api/alerts/live');
      const crit = (live || []).filter(a => a.level === 'red').length;
      alertCount.hidden = crit === 0;
      alertCount.textContent = crit;
      alertCount.title = `${crit} unresolved critical alert${crit === 1 ? '' : 's'}`;
    } catch (_) { /* quiet */ }
  }
  Q.refreshAlertCount = refreshAlertCount;
  refreshAlertCount();

  /* ---------- Live alerts ---------- */
  const shownAlerts = new Set();

  function showCriticalAlert(a) {
    playAlarm();
    Q.dialog(close => {
      const call = a.driver_phone
        ? h('a', { class: 'btn btn-primary', href: 'tel:' + a.driver_phone }, icon('phone'), 'Call driver')
        : null;
      return [
        h('div', { class: 'dialog-head' },
          h('div', { class: 'alarm-head grow' },
            Q.led('crit'),
            h('h2', { class: 't-h2' }, a.type === 'gasket' ? 'Possible head gasket fault' : 'Critical alert'))),
        h('div', { class: 'dialog-body' },
          h('div', { class: 'row' },
            a.vehicle_plate ? Q.plate(a.vehicle_plate, 'lg') : null,
            a.value != null && a.parameter !== 'gasket_suspect'
              ? h('div', { class: 'alarm-value' }, Q.fmtNum(a.value, a.parameter === 'voltage' ? 1 : 0, a.parameter === 'voltage' ? ' V' : a.parameter && a.parameter.startsWith('coolant') ? '°C' : a.parameter === 'stft' || a.parameter === 'ltft' ? '%' : ''))
              : null),
          h('p', { style: { color: 'var(--ink)', fontSize: '15px' } }, a.message || 'Critical reading'),
          h('dl', { class: 'kv' },
            h('dt', null, 'Driver'), h('dd', null, a.driver_name || 'No driver on shift'),
            h('dt', null, 'Phone'), h('dd', null, a.driver_phone || '—'),
            h('dt', null, 'Time'), h('dd', null, Q.fmtTime(a.ts, true)))),
        h('div', { class: 'dialog-foot' },
          h('button', {
            class: 'btn', onclick: async () => {
              try { await Q.api.post(`/api/alerts/${a.id}/acknowledge`); } catch (_) {}
              close(); Q.emit('alerts-changed');
            }
          }, 'Acknowledge'),
          call)
      ];
    }, { class: 'crit', locked: false });
  }

  function onAlert(a) {
    if (!a || shownAlerts.has(a.id)) return;
    shownAlerts.add(a.id);
    Q.emit('alert', a);
    refreshAlertCount();
    if (a.level === 'red') showCriticalAlert(a);
    else Q.toast({
      level: 'warn',
      title: a.vehicle_plate ? `Vehicle ${a.vehicle_plate}` : 'Warning',
      text: a.message,
      timeout: 7000
    });
  }

  function onShift(s) {
    Q.emit('shift', s);
    if (!s) return;
    const plate = s.vehicle && s.vehicle.plate;
    const name = s.driver && s.driver.name;
    if (s.action === 'started') Q.toast({ level: 'duty', title: `Shift started on ${plate}`, text: name });
    else if (s.action === 'ended') Q.toast({ level: 'ok', title: `Shift ended on ${plate}`, text: name ? `${name}. The report will be ready shortly.` : null });
    else if (s.action === 'rejected') Q.toast({ level: 'warn', title: `Card tap refused on ${plate || 'a vehicle'}`, text: s.reason });
  }

  /* ---------- Socket.IO (loaded from the backend) ---------- */
  /* Connection state is kept for other scripts; nothing is shown in the UI. */
  function setConn(state) {
    Q.liveState = state;
  }

  function connectSocket() {
    const base = Q.getApiBase();
    const s = document.createElement('script');
    s.src = base + '/socket.io/socket.io.js';
    s.async = true;
    s.onload = () => {
      if (typeof window.io !== 'function') return setConn('down');
      const socket = window.io(base, { transports: ['websocket', 'polling'] });
      socket.on('connect', () => setConn('ok'));
      socket.on('disconnect', () => setConn('down'));
      socket.on('connect_error', () => setConn('down'));
      socket.on('alert', onAlert);
      socket.on('shift', onShift);
      socket.on('fleet', d => Q.emit('fleet', d));
      socket.on('node', d => Q.emit('node', d));
      Q.socket = socket;
    };
    s.onerror = () => {
      setConn('down');
      setTimeout(connectSocket, 20000);
    };
    document.head.appendChild(s);
  }
  connectSocket();
})();
