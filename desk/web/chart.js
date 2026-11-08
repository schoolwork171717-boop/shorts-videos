/* Charts drawn by hand on <canvas>. No chart library. devicePixelRatio aware. */
(function () {
  const C = {
    green: '#00d35a', red: '#ff453a', orange: '#ff9f0a', blue: '#0a84ff', cyan: '#64d2ff', yellow: '#ffd60a',
    sec: 'rgba(235,235,245,0.6)', ter: 'rgba(235,235,245,0.3)', sep: 'rgba(84,84,88,0.55)', card: '#1c1c1e', card2: '#2c2c2e',
  };
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function font(px, weight) { return `${weight || 500} ${px}px -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`; }

  /* ---------------- Home line chart ---------------- */
  function lineChart(canvas, data, prev) {
    // data: {points:[[ts,v]], start, marks:[{ts,kind,text}], empty}
    const st = canvas._st || (canvas._st = { seen: new Set(), anim: null });
    const pts = data.points || [];
    const run = (tSlide, fades) => {
      const { ctx, w, h } = setup(canvas);
      const padT = 54, padB = 10;
      if (!pts.length) return;
      let t0 = pts[0][0], t1 = pts[pts.length - 1][0];
      if (t1 - t0 < 60) t0 = t1 - 60;
      let lo = Math.min(data.start, ...pts.map(p => p[1])), hi = Math.max(data.start, ...pts.map(p => p[1]));
      if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
      const span = hi - lo; lo -= span * 0.12; hi += span * 0.12;
      const X = t => ((t - t0) / (t1 - t0)) * (w - 8) + 4;
      const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
      // slide: the newest point eases in from the previous one
      const draw = pts.map(p => [X(p[0]), Y(p[1])]);
      if (tSlide < 1 && draw.length > 1) {
        const a = draw[draw.length - 2], b = draw[draw.length - 1];
        draw[draw.length - 1] = [a[0] + (b[0] - a[0]) * tSlide, a[1] + (b[1] - a[1]) * tSlide];
      }
      // dashed start line
      ctx.setLineDash([4, 5]); ctx.strokeStyle = C.ter; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, Y(data.start)); ctx.lineTo(w, Y(data.start)); ctx.stroke(); ctx.setLineDash([]);
      if (data.empty) {
        ctx.fillStyle = C.sec; ctx.font = font(15); ctx.textAlign = 'center';
        ctx.fillText('Waiting for the first trade', w / 2, Y(data.start) - 14);
        return;
      }
      // gradient fill under the line
      const g = ctx.createLinearGradient(0, padT, 0, h);
      g.addColorStop(0, 'rgba(0,211,90,0.28)'); g.addColorStop(1, 'rgba(0,211,90,0)');
      ctx.beginPath(); ctx.moveTo(draw[0][0], h);
      draw.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(draw[draw.length - 1][0], h); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); draw.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      const last = draw[draw.length - 1];
      ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(last[0], last[1], 3.5, 0, 7); ctx.fill();
      // marks above the line, never overlapping: a later mark moves up a row
      const rows = [];
      ctx.font = font(12, 600);
      (data.marks || []).forEach(m => {
        if (m.ts < t0) return;
        const x = X(m.ts), tw = ctx.measureText(m.text).width + 14;
        let left = Math.min(Math.max(4, x - tw / 2), w - tw - 4);
        let row = 0;
        while ((rows[row] || []).some(([a, b]) => left < b + 4 && left + tw > a - 4)) row++;
        (rows[row] = rows[row] || []).push([left, left + tw]);
        const vAt = interp(pts, m.ts);
        const yLine = Y(vAt);
        const yTop = Math.max(2, Math.min(yLine - 30, padT - 26) - row * 24);
        const alpha = fades[m.ts + m.text] != null ? fades[m.ts + m.text] : 1;
        const col = m.kind === 'buy' ? C.blue : m.kind === 'win' ? C.green : C.red;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(x, yTop + 20); ctx.lineTo(x, yLine); ctx.stroke(); ctx.setLineDash([]);
        roundRect(ctx, left, yTop, tw, 20, 10); ctx.fillStyle = col; ctx.fill();
        ctx.fillStyle = m.kind === 'win' ? '#000' : '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(m.text, left + 7, yTop + 10.5);
        ctx.globalAlpha = 1;
      });
    };
    const newMarks = (data.marks || []).filter(m => !st.seen.has(m.ts + m.text));
    newMarks.forEach(m => st.seen.add(m.ts + m.text));
    const grew = prev && prev.points && pts.length && prev.points.length &&
      pts[pts.length - 1][0] !== prev.points[prev.points.length - 1][0];
    if (st.anim) cancelAnimationFrame(st.anim);
    if (reduced() || (!grew && !newMarks.length) || !prev) { run(1, {}); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 250);
      const fades = {};
      newMarks.forEach(m => fades[m.ts + m.text] = Math.min(1, (now - t0) / 200));
      run(grew ? easeOut(k) : 1, fades);
      if (k < 1) st.anim = requestAnimationFrame(step);
    };
    st.anim = requestAnimationFrame(step);
  }

  function interp(pts, t) {
    if (!pts.length) return 0;
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][0] >= t) {
        const [a, av] = pts[i - 1], [b, bv] = pts[i];
        return av + (bv - av) * ((t - a) / Math.max(1e-9, b - a));
      }
    }
    return pts[pts.length - 1][1];
  }
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------------- Coin candles with volume ---------------- */
  function candleChart(canvas, d) {
    // d: {candles:[{t,o,h,l,c,v}], exitLine, entry}
    const { ctx, w, h } = setup(canvas);
    const cs = d.candles || [];
    if (!cs.length) {
      ctx.fillStyle = C.sec; ctx.font = font(14); ctx.textAlign = 'center';
      ctx.fillText('Waiting for the first price', w / 2, h / 2); return;
    }
    const volH = 44, padT = 10, padR = 64;
    const vals = cs.flatMap(c => [c.h, c.l]).concat([d.exitLine, d.entry].filter(Boolean));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < hi * 1e-6) { hi *= 1.01; lo *= 0.99; }
    const span = hi - lo; hi += span * 0.08; lo -= span * 0.08;
    const n = Math.max(cs.length, 30), cw = (w - padR) / n;
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (h - volH - padT - 8);
    const vmax = Math.max(1, ...cs.map(c => c.v || 0));
    ctx.strokeStyle = C.sep; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = padT + i * (h - volH - padT - 8) / 3;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = C.ter; ctx.font = font(10); ctx.textAlign = 'left';
      ctx.fillText(fmtP(hi - (i / 3) * (hi - lo)), w - padR + 6, y + 3);
    }
    cs.forEach((c, i) => {
      const x = (n - cs.length + i) * cw + cw / 2;
      const up = c.c >= c.o, col = up ? C.green : C.red;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
      const bw = Math.max(1.5, cw * 0.62), top = Y(Math.max(c.o, c.c)), bh = Math.max(1, Math.abs(Y(c.o) - Y(c.c)));
      ctx.fillRect(x - bw / 2, top, bw, bh);
      const vh = ((c.v || 0) / vmax) * (volH - 6);
      ctx.globalAlpha = 0.45; ctx.fillRect(x - bw / 2, h - vh, bw, vh); ctx.globalAlpha = 1;
    });
    const hline = (v, col, label, dash) => {
      if (!v) return;
      const y = Y(v);
      ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = font(11, 600); ctx.textAlign = 'left';
      const tw = ctx.measureText(label).width + 10;
      roundRect(ctx, 4, y - 18, tw, 16, 8); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.fillText(label, 9, y - 9.5); ctx.textBaseline = 'alphabetic';
    };
    if (d.entry) hline(d.entry, C.ter, 'Entry', [2, 4]);
    if (d.exitLine) hline(d.exitLine, C.orange, 'Risk trailing stop', [6, 5]);
  }

  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  function fmtP(v) {
    if (v == null || !isFinite(v)) return 'n/a';
    if (v >= 1) return v.toFixed(v >= 1000 ? 0 : 3);
    if (v <= 0) return '0';
    const z = -Math.floor(Math.log10(v)) - 1;             // zeros after the decimal point
    if (z < 4) return v.toFixed(z + 3);
    const digits = Math.round(v * Math.pow(10, z + 3)).toString().slice(0, 3);
    return '0.0' + String(z).split('').map(d => SUB[+d]).join('') + digits;   // 0.0₆354 = 0.000000354
  }

  /* ---------------- Score ring ---------------- */
  function scoreRing(canvas, score, threshold) {
    const { ctx, w, h } = setup(canvas);
    const r = Math.min(w, h) / 2 - 8, cx = w / 2, cy = h / 2;
    ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.strokeStyle = C.card2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    if (score != null) {
      const col = score >= threshold ? C.green : C.yellow;
      ctx.strokeStyle = col; ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, score / 100)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * 0.75)}px -apple-system, "SF Pro Display", system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(score), cx, cy + 2);
    } else {
      ctx.fillStyle = C.ter; ctx.font = font(14); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('—', cx, cy);
    }
    // threshold tick
    const a = -Math.PI / 2 + Math.PI * 2 * threshold / 100;
    ctx.strokeStyle = C.sec; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7)); ctx.lineTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7)); ctx.stroke();
  }

  window.Charts = { lineChart, candleChart, scoreRing, fmtP, C, reduced };
})();
