/* ============================================================
   Qafila — line chart
   One measure per chart (no dual axes). Optional area fill,
   reference lines for warning/critical levels, and a hover
   crosshair with a tooltip. Charts in the same `group` share
   the crosshair, so stacked charts read together.

   Q.lineChart({
     points: [{ t: Date, v: Number }],     // sorted by time
     unit: '°C', digits: 0,
     refs: [{ v: 90, label: '90° warning', cls: 'warn' }],
     area: true, color: 'var(--maroon)', height: 180,
     tickFormat: d => '...', tipTime: d => '...',
     yMin, yMax, group: 'shift'
   }) -> HTMLElement
   ============================================================ */

(function () {
  const Q = window.Qafila;
  const NS = 'http://www.w3.org/2000/svg';
  const groups = {};

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceStep(span, target) {
    const raw = span / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n >= 5 ? 10 : n >= 2 ? 5 : n >= 1 ? 2 : 1) * mag;
  }

  function lineChart(opts) {
    const pts = (opts.points || []).filter(p => p && p.t && p.v !== null && p.v !== undefined && !isNaN(p.v));
    const wrap = document.createElement('div');
    wrap.className = 'lc';
    const tip = document.createElement('div');
    tip.className = 'lc-tip';
    tip.hidden = true;
    wrap.appendChild(tip);

    if (pts.length < 2) {
      const msg = document.createElement('div');
      msg.className = 'lc-empty';
      msg.textContent = opts.emptyText || 'Not enough readings yet.';
      wrap.appendChild(msg);
      return wrap;
    }

    const H = opts.height || 180;
    const L = 44, R = 14, T = 12, B = 26;
    const digits = opts.digits ?? 0;
    const fmtV = v => Number(v).toFixed(digits) + (opts.unit ? (opts.unit === '%' || opts.unit.startsWith('°') ? '' : ' ') + opts.unit : '');
    const tickFmt = opts.tickFormat || (d => Q.fmtTime(d));
    const tipTime = opts.tipTime || (d => Q.fmtDateTime(d));

    let svg, xs, ys, W, cross, dot;
    const api = {};

    function draw() {
      W = Math.max(280, wrap.clientWidth || 600);
      const t0 = pts[0].t.getTime(), t1 = pts[pts.length - 1].t.getTime();
      const vals = pts.map(p => p.v).concat((opts.refs || []).filter(r => r.inView !== false).map(r => r.v));
      let lo = opts.yMin ?? Math.min(...vals), hi = opts.yMax ?? Math.max(...vals);
      if (lo === hi) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.08;
      if (opts.yMin === undefined) lo -= pad;
      if (opts.yMax === undefined) hi += pad;
      const step = niceStep(hi - lo, 4);
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;

      xs = t => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
      ys = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

      if (svg) svg.remove();
      svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'lc-svg', role: 'img', 'aria-label': opts.label || 'Line chart' });

      /* grid + y labels */
      for (let v = lo; v <= hi + step / 2; v += step) {
        const y = ys(v);
        el('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'lc-grid' }, svg);
        const t = el('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'lc-axis' }, svg);
        t.textContent = Number(v.toFixed(6)).toString();
      }

      /* x labels */
      const n = Math.min(opts.ticks || 6, Math.max(2, Math.floor((W - L - R) / 110)));
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n;
        const lbl = el('text', { x: xs(t), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === n ? 'end' : 'middle', class: 'lc-axis' }, svg);
        lbl.textContent = tickFmt(new Date(t));
      }

      /* reference lines */
      (opts.refs || []).forEach(r => {
        if (r.v < lo || r.v > hi) return;
        const y = ys(r.v);
        el('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'lc-ref ' + (r.cls || '') }, svg);
        const t = el('text', { x: W - R - 4, y: y - 5, 'text-anchor': 'end', class: 'lc-ref-label ' + (r.cls || '') }, svg);
        t.textContent = r.label;
      });

      /* series, broken where readings are far apart */
      const gap = opts.gapMs || 5 * 60 * 1000;
      const runs = [];
      let run = [];
      pts.forEach((p, i) => {
        if (i && p.t - pts[i - 1].t > gap) { runs.push(run); run = []; }
        run.push(p);
      });
      runs.push(run);
      const color = opts.color || 'var(--maroon)';
      runs.forEach(r => {
        if (r.length === 1) {
          el('circle', { cx: xs(r[0].t.getTime()), cy: ys(r[0].v), r: 2.5, fill: color }, svg);
          return;
        }
        const d = r.map((p, i) => (i ? 'L' : 'M') + xs(p.t.getTime()).toFixed(1) + ' ' + ys(p.v).toFixed(1)).join(' ');
        if (opts.area) {
          const base = ys(Math.max(lo, Math.min(hi, opts.areaBase ?? lo)));
          el('path', { d: `${d} L ${xs(r[r.length - 1].t.getTime()).toFixed(1)} ${base} L ${xs(r[0].t.getTime()).toFixed(1)} ${base} Z`, class: 'lc-area', style: `fill:${color}` }, svg);
        }
        el('path', { d, class: 'lc-line', style: `stroke:${color}` }, svg);
      });

      if (opts.markers) {
        pts.forEach(p => el('circle', { cx: xs(p.t.getTime()), cy: ys(p.v), r: 3.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2 }, svg));
      }

      /* hover layer */
      cross = el('line', { y1: T, y2: H - B, class: 'lc-cross', visibility: 'hidden' }, svg);
      dot = el('circle', { r: 4.5, fill: color, stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
      const hit = el('rect', { x: L, y: 0, width: W - L - R, height: H, fill: 'transparent' }, svg);
      hit.addEventListener('mousemove', e => {
        const r = svg.getBoundingClientRect();
        const x = (e.clientX - r.left) * (W / r.width);
        const t = t0 + ((x - L) / (W - L - R)) * (t1 - t0);
        broadcast(t);
      });
      hit.addEventListener('mouseleave', () => broadcast(null));

      wrap.insertBefore(svg, tip);
    }

    function nearest(t) {
      let best = pts[0], d = Infinity;
      for (const p of pts) {
        const dd = Math.abs(p.t.getTime() - t);
        if (dd < d) { d = dd; best = p; }
      }
      return best;
    }

    api.showAt = t => {
      if (t === null || !svg) {
        cross && cross.setAttribute('visibility', 'hidden');
        dot && dot.setAttribute('visibility', 'hidden');
        tip.hidden = true;
        return;
      }
      const p = nearest(t);
      const x = xs(p.t.getTime()), y = ys(p.v);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      dot.setAttribute('visibility', 'visible');
      tip.innerHTML = '';
      const a = document.createElement('div'); a.className = 'lc-tip-v'; a.textContent = fmtV(p.v);
      const b = document.createElement('div'); b.className = 'lc-tip-t'; b.textContent = (opts.tipPrefix ? opts.tipPrefix + ', ' : '') + tipTime(p.t);
      tip.append(a, b);
      tip.hidden = false;
      const scale = svg.getBoundingClientRect().width / W;
      const px = x * scale;
      const left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), wrap.clientWidth - tip.offsetWidth);
      tip.style.left = left + 'px';
      tip.style.top = Math.max(0, y * scale - tip.offsetHeight - 12) + 'px';
    };

    function broadcast(t) {
      if (opts.group && groups[opts.group]) groups[opts.group].forEach(c => c.showAt(t));
      else api.showAt(t);
    }

    if (opts.group) (groups[opts.group] = groups[opts.group] || []).push(api);

    requestAnimationFrame(draw);
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      if (Math.abs(wrap.clientWidth - lastW) > 4) { lastW = wrap.clientWidth; draw(); }
    });
    ro.observe(wrap);
    return wrap;
  }

  Q.lineChart = lineChart;
})();
