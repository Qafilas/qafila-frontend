/* ============================================================
   Qafila — UI helpers
   Element builder, icons, formatting, plates, LEDs, toasts,
   dialogs and popovers. No framework.
   ============================================================ */

(function () {
  const Q = window.Qafila = window.Qafila || {};

  /* ---------- Element builder ----------
     h('div', { class: 'x', onclick: fn }, 'text', child, [children]) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
      children.unshift(attrs);
      attrs = null;
    }
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, children);
    return el;
  }

  function append(el, children) {
    children.flat(Infinity).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

  function mount(el, ...children) { clear(el); return append(el, children); }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Icons (24px grid, 2px stroke) ---------- */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    operations: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    drivers: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/>',
    vehicles: '<path d="M2 16V8a2 2 0 0 1 2-2h10v10"/><path d="M14 9h4l4 4v3h-2"/><path d="M2 16h2m6 0h4"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    shifts: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    predictions: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    import: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4m0-4h.01"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    back: '<path d="M19 12H5m6-7-7 7 7 7"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    unlink: '<path d="m18.8 13.2 1.7-1.7a5 5 0 0 0-7-7l-1.7 1.7M5.2 10.8l-1.7 1.7a5 5 0 0 0 7 7l1.7-1.7"/><path d="M8 2v3M2 8h3m11 14v-3m3-3h3"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    signal: '<path d="M4 20v-3m5 3v-7m5 7V9m5 11V4"/>',
    thermo: '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="M6 10v4m4-4v4"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a10 10 0 1 1 17.4 0"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z" transform="scale(.9) translate(1.3 1.3)"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    bellOff: '<path d="M8.7 3A6 6 0 0 1 18 8a21 21 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.7 4.7 0 0 1 .3-1.7"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/><path d="m2 2 20 20"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    activate: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'
  };

  function icon(name, cls) {
    const span = document.createElement('span');
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ic${cls ? ' ' + cls : ''}">${ICONS[name] || ''}</svg>`;
    return span.firstChild;
  }

  /* ---------- Time ----------
     The backend stores SQLite datetime('now'): "YYYY-MM-DD HH:MM:SS" in UTC. */
  function parseTs(ts) {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    const s = String(ts);
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    return isNaN(d) ? null : d;
  }

  const pad = n => String(n).padStart(2, '0');

  function fmtTime(ts, withSeconds) {
    const d = parseTs(ts);
    if (!d) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: withSeconds ? '2-digit' : undefined, hour12: true });
  }

  function fmtDate(ts) {
    const d = parseTs(ts);
    if (!d) return '—';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(ts) {
    const d = parseTs(ts);
    if (!d) return '—';
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const day = sameDay ? 'Today' : d.toDateString() === yest.toDateString() ? 'Yesterday'
      : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `${day}, ${fmtTime(d)}`;
  }

  function fmtAgo(ts) {
    const d = parseTs(ts);
    if (!d) return 'never';
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const hr = Math.round(m / 60);
    if (hr < 24) return `${hr} h ago`;
    const days = Math.round(hr / 24);
    if (days < 30) return `${days} d ago`;
    return fmtDate(d);
  }

  function minutesBetween(a, b) {
    const da = parseTs(a), db = b ? parseTs(b) : new Date();
    if (!da || !db) return 0;
    return Math.max(0, Math.round((db - da) / 60000));
  }

  function fmtDuration(mins) {
    if (mins == null || isNaN(mins)) return '—';
    mins = Math.round(mins);
    if (mins < 60) return `${mins} min`;
    const hr = Math.floor(mins / 60), m = mins % 60;
    return m ? `${hr} h ${m} min` : `${hr} h`;
  }

  /* Shift windows are stored as "HH:MM" (24-hour, Qatar time). Show 12-hour. */
  function fmtHHMM(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!m) return hhmm || '';
    const hr = Number(m[1]);
    return `${hr % 12 || 12}:${m[2]} ${hr < 12 ? 'AM' : 'PM'}`;
  }

  function fmtWindow(start, end) {
    if (!start || !end) return null;
    return `${fmtHHMM(start)} – ${fmtHHMM(end)}`;
  }

  /* ---------- Numbers ---------- */
  function fmtNum(v, digits = 0, unit = '') {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '—';
    return Number(v).toFixed(digits) + unit;
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  /* ---------- Plate chip (Qatar private plate) ---------- */
  function plate(number, size) {
    return h('span', { class: 'plate' + (size ? ' ' + size : ''), title: `Plate ${number || ''}` },
      h('span', { class: 'plate-band', 'aria-hidden': 'true' }, 'قطر'),
      h('span', { class: 'plate-num' }, number || '—'));
  }

  /* ---------- LED + vehicle state ----------
     Mirrors the device: blue on shift, green ready, yellow warning,
     red critical, grey when the node has not reported recently. */
  const STATE = {
    crit:    { cls: 'crit', label: 'Critical' },
    warn:    { cls: 'warn', label: 'Warning' },
    duty:    { cls: 'duty', label: 'On shift' },
    ok:      { cls: 'ok',   label: 'Ready' },
    off:     { cls: 'off',  label: 'Offline' },
    nonode:  { cls: 'off',  label: 'No board' },
    parked:  { cls: 'off',  label: 'Inactive' }
  };

  function vehicleState(v) {
    if (!v.active) return STATE.parked;
    if (Number(v.alert_rank) >= 2) return STATE.crit;
    if (Number(v.alert_rank) === 1) return STATE.warn;
    if (v.active_shift_id) return STATE.duty;
    if (!v.node) return STATE.nonode;
    const seen = parseTs(v.node_last_seen);
    if (seen && Date.now() - seen.getTime() < 15 * 60 * 1000) return STATE.ok;
    return STATE.off;
  }

  function led(cls, label) {
    return h('span', { class: 'led ' + (cls || 'off'), role: label ? 'img' : null, 'aria-label': label || null });
  }

  function stateBadge(state) {
    return h('span', { class: 'state' }, led(state.cls), state.label);
  }

  function levelClass(level) {
    return level === 'red' ? 'crit' : level === 'yellow' ? 'warn' : 'ok';
  }

  function scoreDial(score, size) {
    const v = Number(score);
    const cls = isNaN(v) ? '' : v < 60 ? 'crit' : v < 80 ? 'warn' : '';
    const el = h('span', { class: `score ${cls} ${size || ''}`, title: `Behaviour score ${isNaN(v) ? 'pending' : v}` },
      h('span', null, isNaN(v) ? '—' : String(v)));
    el.style.setProperty('--v', isNaN(v) ? 0 : v);
    return el;
  }

  function empty(iconName, title, text, action) {
    return h('div', { class: 'empty' },
      iconName ? icon(iconName) : null,
      h('div', { class: 'empty-title' }, title),
      text ? h('p', null, text) : null,
      action || null);
  }

  function loadingRows(cols, n = 3) {
    return Array.from({ length: n }, () =>
      h('tr', { class: 'loading-row' }, h('td', { colspan: cols }, h('div', { class: 'skeleton' }))));
  }

  function errorBox(err, retry) {
    return h('div', { class: 'empty' },
      icon('alert'),
      h('div', { class: 'empty-title' }, 'Could not load this'),
      h('p', null, err && err.message ? err.message : String(err)),
      retry ? h('button', { class: 'btn btn-sm', onclick: retry }, icon('refresh'), 'Try again') : null);
  }

  /* ---------- Toasts ---------- */
  function toast(opts) {
    if (typeof opts === 'string') opts = { title: opts };
    let root = $('.toasts');
    if (!root) {
      root = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(root);
    }
    const close = h('button', { class: 'icon-btn', 'aria-label': 'Dismiss' }, icon('x'));
    const el = h('div', { class: 'toast' },
      led(opts.level || 'ok'),
      h('div', { class: 'toast-body' },
        h('div', { class: 'toast-title' }, opts.title),
        opts.text ? h('div', { class: 'toast-text' }, opts.text) : null,
        opts.action || null),
      close);
    const remove = () => { el.remove(); };
    close.addEventListener('click', remove);
    root.appendChild(el);
    if (opts.timeout !== 0) setTimeout(remove, opts.timeout || 4500);
    return remove;
  }

  /* ---------- Dialogs ---------- */
  function dialog(build, opts = {}) {
    return new Promise(resolve => {
      const prevFocus = document.activeElement;
      const box = h('div', { class: 'dialog ' + (opts.class || ''), role: 'dialog', 'aria-modal': 'true' });
      const back = h('div', { class: 'dialog-back' }, box);

      function close(value) {
        document.removeEventListener('keydown', onKey);
        back.remove();
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(value);
      }
      function onKey(e) {
        if (e.key === 'Escape' && !opts.locked) close(undefined);
        if (e.key === 'Tab') {
          const f = $$('button, [href], input, select, textarea', box).filter(x => !x.disabled);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      }
      back.addEventListener('mousedown', e => { if (e.target === back && !opts.locked) close(undefined); });
      document.addEventListener('keydown', onKey);

      append(box, build(close));
      document.body.appendChild(back);
      const first = $('[autofocus]', box) || $('input, select, textarea', box) || $('.dialog-foot .btn:last-child', box);
      if (first) first.focus();
    });
  }

  function confirm({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
    return dialog(close => [
      h('div', { class: 'dialog-head' }, h('h2', { class: 't-h2' }, title)),
      h('div', { class: 'dialog-body' }, typeof body === 'string' ? h('p', null, body) : body),
      h('div', { class: 'dialog-foot' },
        h('button', { class: 'btn', onclick: () => close(false) }, cancelText),
        h('button', { class: 'btn ' + (danger ? 'btn-danger-solid' : 'btn-primary'), onclick: () => close(true) }, confirmText))
    ]).then(v => !!v);
  }

  /* Form dialog: fields = [{ name, label, type, value, options, required, hint, span }] */
  function formDialog({ title, fields, submitText = 'Save', onSubmit, wide }) {
    return dialog(close => {
      const err = h('div', { class: 'form-error', hidden: true });
      const submit = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => form.requestSubmit() }, submitText);
      const form = h('form', { class: 'form-grid', novalidate: true });

      fields.forEach((f, i) => {
        let input;
        if (f.type === 'select') {
          input = h('select', { class: 'select', name: f.name },
            f.options.map(o => h('option', { value: o.value, selected: String(o.value) === String(f.value ?? '') ? true : null }, o.label)));
        } else {
          input = h('input', {
            class: 'input', name: f.name, type: f.type || 'text',
            value: f.value ?? '', placeholder: f.placeholder || null,
            required: f.required || null, inputmode: f.inputmode || null,
            pattern: f.pattern || null, autocomplete: 'off',
            autofocus: i === 0 ? true : null, min: f.min ?? null, max: f.max ?? null
          });
        }
        form.appendChild(h('label', { class: 'field' + (f.span ? ' span-2' : '') },
          h('span', { class: 'field-label' }, f.label),
          input,
          f.hint ? h('span', { class: 'field-hint' }, f.hint) : null));
      });

      form.appendChild(h('div', { class: 'span-2' }, err));
      form.appendChild(h('button', { type: 'submit', hidden: true, tabindex: '-1' }));

      form.addEventListener('submit', async e => {
        e.preventDefault();
        err.hidden = true;
        const data = {};
        fields.forEach(f => {
          const el = form.elements[f.name];
          data[f.name] = el.value.trim();
          el.classList.remove('invalid');
        });
        const missing = fields.filter(f => f.required && !data[f.name]);
        if (missing.length) {
          missing.forEach(f => form.elements[f.name].classList.add('invalid'));
          err.textContent = `Fill in ${missing.map(f => f.label.toLowerCase()).join(', ')}.`;
          err.hidden = false;
          form.elements[missing[0].name].focus();
          return;
        }
        submit.disabled = true;
        const label = submit.textContent;
        mount(submit, h('span', { class: 'spin' }), 'Saving');
        try {
          const result = await onSubmit(data);
          close(result === undefined ? true : result);
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
          submit.disabled = false;
          mount(submit, label);
        }
      });

      return [
        h('div', { class: 'dialog-head' },
          h('h2', { class: 't-h2' }, title),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => close(undefined) }, icon('x'))),
        h('div', { class: 'dialog-body' }, form),
        h('div', { class: 'dialog-foot' },
          h('button', { class: 'btn', type: 'button', onclick: () => close(undefined) }, 'Cancel'),
          submit)
      ];
    }, { class: wide ? 'wide' : '' });
  }

  /* ---------- Popover anchored to an element ---------- */
  let openPop = null;
  function popover(anchor, build) {
    closePopover();
    const pop = h('div', { class: 'popover', role: 'menu' });
    append(pop, build(closePopover));
    document.body.appendChild(pop);

    const r = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.left + window.scrollX;
    if (left + pw > window.scrollX + window.innerWidth - 12) left = window.scrollX + window.innerWidth - pw - 12;
    let top = r.bottom + window.scrollY + 6;
    if (r.bottom + ph + 12 > window.innerHeight && r.top > ph + 12) top = r.top + window.scrollY - ph - 6;
    pop.style.left = Math.max(12, left) + 'px';
    pop.style.top = top + 'px';

    const onDoc = e => { if (!pop.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
    const onKey = e => { if (e.key === 'Escape') { closePopover(); anchor.focus(); } };
    setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onKey);
    openPop = { pop, off: () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); } };

    const f = $('input', pop) || $('.popover-item', pop);
    if (f) f.focus();
    return pop;
  }

  function closePopover() {
    if (!openPop) return;
    openPop.off();
    openPop.pop.remove();
    openPop = null;
  }

  /* ---------- Sparkline ---------- */
  function spark(values, opts = {}) {
    const ns = 'http://www.w3.org/2000/svg';
    const W = opts.width || 120, H = opts.height || 40, P = 3;
    const vals = values.map(Number).filter(v => !isNaN(v));
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'spark');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    if (vals.length < 2) return svg;
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const pts = vals.map((v, i) => [P + (i * (W - 2 * P)) / (vals.length - 1), H - P - ((v - min) / span) * (H - 2 * P)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = document.createElementNS(ns, 'path');
    area.setAttribute('d', `${d} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`);
    area.setAttribute('class', 'area');
    const line = document.createElementNS(ns, 'path');
    line.setAttribute('d', d);
    line.setAttribute('class', 'line');
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(area, line);
    if (opts.dots) pts.forEach(p => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); c.setAttribute('r', 2.6); c.setAttribute('class', 'dot');
      svg.appendChild(c);
    });
    return svg;
  }

  /* ---------- Misc ---------- */
  function debounce(fn, ms = 200) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function busy(btn, on, label) {
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      mount(btn, h('span', { class: 'spin' }), label || 'Working');
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function qs(name) { return new URLSearchParams(location.search).get(name); }

  function pagePath(page) {
    const inPages = location.pathname.includes('/pages/');
    if (page === 'dashboard') return inPages ? '../index.html' : 'index.html';
    return (inPages ? '' : 'pages/') + page + '.html';
  }

  const VEHICLE_TYPES = [
    { value: 'car', label: 'Car' },
    { value: 'bus', label: 'Bus' },
    { value: 'truck', label: 'Truck' }
  ];

  function typeLabel(t) {
    const f = VEHICLE_TYPES.find(x => x.value === t);
    return f ? f.label : (t ? t : null);
  }

  /* Same thresholds as the backend's immediate alerts */
  function readingClass(param, v) {
    if (v === null || v === undefined || isNaN(Number(v))) return '';
    v = Number(v);
    if (param === 'coolant') return v >= 105 ? 'crit' : v >= 90 ? 'warn' : '';
    if (param === 'voltage') return v <= 0 ? '' : v <= 12.5 ? 'crit' : v <= 13.5 ? 'warn' : '';
    if (param === 'trim') return Math.abs(v) > 15 ? 'warn' : '';
    return '';
  }

  const STREAM_LABEL = {
    coolant: 'Cooling system',
    stft: 'Short-term fuel trim',
    ltft: 'Long-term fuel trim',
    voltage: 'Charging system',
    load_speed: 'Engine efficiency'
  };
  const STREAM_UNIT = { coolant: '°C', voltage: 'V', stft: '%', ltft: '%', load_speed: '' };

  function alertValue(a) {
    if (a.value === null || a.value === undefined || a.parameter === 'gasket_suspect') return null;
    const p = a.parameter || '';
    if (p === 'voltage') return Number(a.value).toFixed(1) + ' V';
    if (p.startsWith('coolant')) return (p === 'coolant_spike' ? '+' : '') + Number(a.value).toFixed(0) + '°C';
    if (p === 'stft' || p === 'ltft') return Number(a.value).toFixed(1) + '%';
    return String(a.value);
  }

  Object.assign(Q, {
    readingClass, STREAM_LABEL, STREAM_UNIT, alertValue,
    h, append, clear, mount, $, $$, icon,
    parseTs, fmtTime, fmtDate, fmtDateTime, fmtAgo, fmtDuration, minutesBetween,
    fmtHHMM, fmtWindow, fmtNum, initials,
    plate, led, stateBadge, vehicleState, levelClass, scoreDial, STATE,
    empty, loadingRows, errorBox, toast, dialog, confirm, formDialog,
    popover, closePopover, spark, debounce, busy, downloadText, qs, pagePath,
    VEHICLE_TYPES, typeLabel
  });
})();
