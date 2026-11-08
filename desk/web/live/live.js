/* Grok Bot Live: the desk in real time. Snapshot from /api/live, then every event over SSE (fetch stream, token in a header).
   FOMO URLs are never built here; coin names open the coin in the main app. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const m = location.hash.match(/^#t=([^&]+)/);
  if (m) { localStorage.setItem('desk_token', decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname); }
  const token = localStorage.getItem('desk_token') || '';
  const usd = (v, sg) => v == null ? 'n/a' : (sg ? (v >= 0 ? '+$' : '-$') : (v < 0 ? '-$' : '$')) + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = v => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  const px = v => v == null ? 'n/a' : '$' + window.Charts.fmtP(v);
  const t = ts => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const cl = v => v == null ? '' : v >= 0 ? 'up' : 'down';
  const COL = { scanner: '#64d2ff', auditor: '#64d2ff', analyst: '#ffd60a', executor: '#00d35a', risk: '#ff6b9a' };
  const AGENT_OF = { lesson: 'risk', scan: 'scanner', audit_start: 'auditor', audit_layer: 'auditor', audit: 'auditor', verdict: 'analyst', signal: 'executor', fill: 'executor', exit: 'risk' };
  const coin = (d) => `<a href="../#/coin/${encodeURIComponent(d.mint)}">${esc(d.name || (d.mint || '').slice(0, 6))}</a>`;
  const L = { snap: null, events: [], filter: 'all', lastEvent: 0, lastOk: 0, live: false, now: {}, prices: {}, chart: null };

  async function api(p) {
    const r = await fetch(p, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
    if (r.status === 401) { $('#main').hidden = true; $('#locked').hidden = false; throw new Error('locked'); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    L.lastOk = Date.now(); $('#offline').hidden = true; return r.json();
  }

  /* ---------- event text ---------- */
  function text(e) {
    const d = e.data || {};
    switch (e.kind) {
      case 'scan':
        if (d.event === 'new') return `<span class="c">${esc((d.mint || '').slice(0, 6))}… graduated</span> → waiting room (${d.room})`;
        return d.verdict === 'pass' ? `${coin(d)} <span class="g">passed</span> · liq ${usd(d.liquidityUsd)} → Auditor`
          : `${coin(d)} <span class="r">killed</span> · ${esc(d.reason)}`;
      case 'audit_start': return `Auditor taking apart ${coin(d)}`;
      case 'audit_layer': return `${coin(d)} L${d.n} ${esc(d.name)}: <span class="${d.pass ? 'g' : 'r'}">${esc(d.value)}</span>`;
      case 'audit': return d.passed ? `${coin(d)} <span class="g">cleared 8/8</span> → Analyst` : `${coin(d)} <span class="r">rejected</span> · ${esc(d.reason)}`;
      case 'verdict': return d.passed ? `${coin(d)} <span class="g">scored ${d.score}</span> → Executor`
        : `${coin(d)} <span class="r">rejected</span> · ${esc((d.failed || [])[0] || '')}${d.score != null ? ' · score ' + d.score : ''}`;
      case 'signal':
        if (d.status === 'skipped') return `${coin(d)} <span class="r">skipped</span> · ${esc(d.reason)}`;
        if (d.status === 'missed') return `${coin(d)} missed (no tap)`;
        return `<b>Buy ${coin(d)}</b> · ${usd(d.sizeUsd)} · ${d.stackPct}% of stack${d.mode === 'PAPER' ? ' · PAPER' : ''}`;
      case 'fill': return `<span class="g">Bought</span> ${coin(d)} · ${usd(d.sizeUsd)} @ ${px(d.price)}`;
      case 'exit': return d.status === 'closed' && d.reason == null ? `${coin(d)} closed`
        : `${d.pnlUsd >= 0 ? '<span class="g">Sold</span>' : '<span class="r">Stopped</span>'} ${coin(d)} · ${esc(d.reason)} · <span class="${cl(d.pnlUsd)}">${usd(d.pnlUsd, true)} (${pct(d.pct)})</span>`;
      case 'lesson': return `<span class="c">${d.status === 'applied' ? 'Learned' : 'Suggests'}</span> · ${esc(d.text)} · <b>${esc(d.key.split('.').pop())} ${esc(d.old)} → ${esc(d.new)}</b>`;
      default: return null;
    }
  }
  const skipTape = e => (e.kind === 'audit_layer' && e.data.pass === undefined) || (e.kind === 'verdict' && e.data.state === 'scoring') || !AGENT_OF[e.kind];

  function renderTape(newOne) {
    const rows = L.events.filter(e => !skipTape(e) && (L.filter === 'all' || AGENT_OF[e.kind] === L.filter)).slice(0, 300);
    $('#tape').innerHTML = rows.length ? rows.map((e, i) => {
      const tx = text(e); if (!tx) return '';
      return `<div class="ev ${newOne && i === 0 && e === L.events[0] ? 'new' : ''}"><time>${t(e.ts)}</time><i style="background:${COL[AGENT_OF[e.kind]]}"></i><div>${tx}</div></div>`;
    }).join('') : '<div class="empty">Listening for graduations</div>';
  }
  function chips() {
    $('#chips').innerHTML = ['all', 'scanner', 'auditor', 'analyst', 'executor', 'risk'].map(a =>
      `<button data-a="${a}" class="${L.filter === a ? 'on' : ''}">${a === 'all' ? 'All' : a[0].toUpperCase() + a.slice(1)}</button>`).join('');
    document.querySelectorAll('#chips button').forEach(b => b.onclick = () => { L.filter = b.dataset.a; chips(); renderTape(); });
  }

  /* ---------- snapshot render ---------- */
  function kpis() {
    const s = L.snap, st = s.state, tr = s.trades.summary;
    const unreal = s.trades.open.reduce((a, o) => a + (L.prices[o.id] != null ? L.prices[o.id].unrealized : (o.unrealized || 0)), 0);
    const bal = st.stack + unreal, today = st.startBalance ? 100 * (bal / st.startBalance - 1) : 0;
    $('#mode').hidden = st.mode !== 'PAPER';
    const k = (label, v, c, small, big) => `<div class="kpi ${big ? 'big' : ''}"><span>${label}</span><b class="${c || ''}">${v}</b>${small ? `<small>${small}</small>` : ''}</div>`;
    $('#kpis').innerHTML = k('Balance', usd(bal), '', `${(bal / (st.startBalance || bal)).toFixed(2)}× · start ${usd(st.startBalance)}`, true)
      + k('Today', pct(today), cl(today), usd(bal - st.startBalance, true))
      + k('Realized tonight', usd(tr.realized, true), cl(tr.realized), `fees ${usd(tr.fees)}`)
      + k('Unrealized', usd(unreal, true), cl(unreal), `${s.trades.open.length} open · before exit fees`)
      + k('Trades', `${tr.trades}`, '', tr.trades ? `${tr.wins}W ${tr.losses}L · ${tr.winRate}% won` : 'none closed yet')
      + k('Max drawdown', usd(-tr.maxDrawdown), tr.maxDrawdown ? 'down' : '', `${tr.maxDrawdownPct}% tonight`);
    $('#bal-sub').textContent = `stop -${s.risk.stopPct}% · trail ${s.risk.trailPct}% · timeout ${s.risk.timeoutH}h`;
  }
  function openTable() {
    const o = L.snap.trades.open;
    $('#open-n').textContent = o.length ? `${o.length} · prices every 15s` : '';
    if (!o.length) { $('#open').innerHTML = '<div class="empty">No open positions</div>'; return; }
    $('#open').innerHTML = `<div class="scroll"><table><tr><th>Coin</th><th>In</th><th>Entry</th><th>Price</th><th>PnL</th><th>To exit line</th><th>Timeout</th></tr>${o.map(p => {
      const live = L.prices[p.id] || {};
      const price = live.price != null ? live.price : p.price, un = live.unrealized != null ? live.unrealized : p.unrealized;
      const line = live.exitLine != null ? live.exitLine : p.exitLine;
      const toLine = price && line ? 100 * (line / price - 1) : null;
      const left = Math.max(0, p.openedAt + L.snap.risk.timeoutH * 3600 - Date.now() / 1000);
      return `<tr data-id="${p.id}"><td>${coin(p)}${p.exiting ? ' <span class="down">exiting</span>' : ''}</td><td>${usd(p.size)}</td><td>${px(p.entry)}</td>
        <td class="pc ${live.flash || ''}">${px(price)}</td><td class="${cl(un)}">${usd(un, true)} <span class="muted">${pct(price ? 100 * (price / p.entry - 1) : null)}</span></td>
        <td class="down">${toLine == null ? 'n/a' : pct(toLine)}</td><td>${Math.floor(left / 3600)}h ${Math.floor(left % 3600 / 60)}m</td></tr>`;
    }).join('')}</table></div>`;
    Object.values(L.prices).forEach(v => delete v.flash);
  }
  function closedTable() {
    const c = L.snap.trades.closed;
    if (!c.length) { $('#closed').innerHTML = '<div class="empty">No closed trades tonight</div>'; return; }
    const R = { trail: 'trailing stop', stop: 'stop', timeout: 'timeout', pulled: 'liq pulled', manual: 'by hand' };
    $('#closed').innerHTML = `<div class="scroll"><table><tr><th>Coin</th><th>Closed</th><th>Exit</th><th>Hold</th><th>Fees</th><th>PnL</th></tr>${c.map(x =>
      `<tr><td>${coin(x)}</td><td>${t(x.closedAt).slice(0, 5)}</td><td>${esc(R[x.reason] || x.reason)}</td><td>${Math.round(x.holdMin)}m</td><td>${usd(x.fees)}</td>
       <td class="${cl(x.pnl)}">${usd(x.pnl, true)} <span class="muted">${pct(x.pct)}</span></td></tr>`).join('')}</table></div>`;
  }
  function agents() {
    const st = L.snap.state;
    $('#agents').innerHTML = st.agents.map(a => {
      const now = L.now[a.name];
      let s;
      if (a.name === 'scanner') s = `${a.waiting} in the waiting room · ${a.count} heard · ${a.wsConnected ? 'stream live' : 'reconnecting'}`;
      else if (a.name === 'auditor') s = now || (a.current ? `taking apart ${a.current.name}` : a.last ? `last: ${a.last.name} ${a.last.passed ? '8/8' : '· ' + a.last.reason}` : 'idle');
      else if (a.name === 'analyst') s = now || (a.last ? `last: ${a.last.name} · score ${a.last.score}${a.last.passed ? ' ✓' : ' · ' + (a.last.reason || '')}` : `idle · ${a.mode} mode`);
      else if (a.name === 'executor') s = now || (a.last ? `last: ${a.last.name} · ${usd(a.last.size)} · ${a.last.status}` : 'idle');
      else s = a.open ? `guarding ${a.open} position${a.open > 1 ? 's' : ''}` : (a.last ? `last: ${a.last.label} ${a.last.name}` : 'idle');
      const hb = a.heartbeatAge == null ? '' : a.heartbeatAge < 60 ? `${Math.round(a.heartbeatAge)}s` : `${Math.round(a.heartbeatAge / 60)}m`;
      return `<div class="ag ${a.paused ? 'paused' : ''}"><i style="background:${a.paused ? '#ff9f0a' : COL[a.name]}"></i><b>${a.name[0].toUpperCase() + a.name.slice(1)}</b>
        <span>${a.paused ? 'paused · ' : ''}${esc(s)}</span><em title="last heartbeat">${hb}</em></div>`;
    }).join('');
  }
  function funnel() {
    const f = L.snap.funnel, max = Math.max(1, f.heard);
    const rows = [['Graduations heard', f.heard, '#64d2ff'], ['Waiting room now', f.waiting, '#3a8fb7'], ['Scanner passed', f.scannerPass, '#64d2ff'],
      ['Auditor cleared 8/8', f.cleared, '#64d2ff'], ['Analyst passed', f.analystPass, '#ffd60a'], ['Pushed', f.pushed, '#00d35a'],
      ['Filled', f.filled, '#00d35a'], ['Exited', f.exited, '#ff6b9a']];
    $('#funnel').innerHTML = rows.map(([l, v, c]) => `<div class="fs"><span>${l}</span><div class="bar"><i style="width:${(100 * v / max).toFixed(1)}%;background:${c}"></i></div><b>${v}</b></div>`).join('')
      + `<div class="muted" style="margin-top:4px">Scanner killed ${f.scannerKill} · Auditor took apart ${f.audited} · Analyst scored ${f.scored}</div>`;
  }
  async function chart() {
    const ch = await api('/api/chart?range=LIVE');
    window.Charts.lineChart($('#chart'), ch, L.chart); L.chart = ch;
  }
  function lessons() {
    const lz = L.snap.lessons || [];
    $('#lz-mode').textContent = 'learner: ' + L.snap.learner;
    $('#lessons').innerHTML = lz.length ? lz.map(l => `<div class="ev"><time>#${l.id}</time><i style="background:${l.status === 'applied' ? '#00d35a' : '#ff9f0a'}"></i>
      <div><b>${esc(l.key.split('.').pop().replace(/_/g, ' '))} ${esc(l.old)} → ${esc(l.new)}</b> <span class="muted">${esc(l.status)}</span><br>${esc(l.text)}</div></div>`).join('')
      : '<div class="empty">No lessons yet: post-mortem on every closed trade</div>';
  }
  function renderAll() { kpis(); openTable(); closedTable(); agents(); funnel(); lessons(); }

  async function snapshot(first) {
    const s = await api('/api/live');
    L.snap = s;
    if (first) { L.events = s.events.slice(); renderTape(); }
    renderAll();
  }
  let snapT = null;
  const soon = () => { clearTimeout(snapT); snapT = setTimeout(() => { snapshot().catch(() => {}); chart().catch(() => {}); }, 500); };

  /* ---------- live events ---------- */
  function onEvent(kind, data) {
    const e = { kind, ts: Date.now() / 1000, data };
    L.lastEvent = Date.now();
    if (kind === 'price') {
      const prev = L.prices[data.positionId];
      L.prices[data.positionId] = { ...data, flash: prev && prev.price != null ? (data.price > prev.price ? 'flash-up' : data.price < prev.price ? 'flash-down' : '') : '' };
      if (L.snap) { openTable(); kpis(); }
      return;
    }
    if (kind === 'balance') { soon(); return; }
    if (kind === 'audit_start') L.now.auditor = `taking apart ${data.name || ''}`;
    if (kind === 'audit_layer' && data.state === 'reading') L.now.auditor = `taking apart ${data.name ? '' : ''}layer ${data.n} · ${data.name}`;
    if (kind === 'audit') delete L.now.auditor;
    if (kind === 'verdict') { if (data.state === 'scoring') L.now.analyst = `scoring ${data.name}`; else delete L.now.analyst; }
    if (kind === 'signal' && !data.status) L.now.executor = `executing ${data.name} · ${usd(data.sizeUsd)}`;
    if (kind === 'fill' || (kind === 'signal' && data.status)) delete L.now.executor;
    L.events.unshift(e); L.events.length = Math.min(L.events.length, 600);
    if (!skipTape(e)) renderTape(true);
    if (L.snap) agents();
    if (['scan', 'audit', 'verdict', 'signal', 'fill', 'exit', 'lesson'].includes(kind)) soon();
  }
  async function stream() {
    while (true) {
      try {
        const r = await fetch('/api/stream', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
        if (r.status === 401) return;
        L.live = true; conn();
        const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
        while (true) {
          const { value, done } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const ch = buf.slice(0, i); buf = buf.slice(i + 2);
            L.lastOk = Date.now();
            const ev = (ch.match(/^event: (.*)$/m) || [])[1], dt = (ch.match(/^data: (.*)$/m) || [])[1];
            if (ev && dt) { try { onEvent(ev, JSON.parse(dt)); } catch (_) {} }
          }
        }
      } catch (_) {}
      L.live = false; conn();
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  function conn() {
    const dot = $('#dot'), c = $('#conn');
    const ago = L.lastEvent ? Math.round((Date.now() - L.lastEvent) / 1000) : null;
    dot.className = L.live ? 'on' : (Date.now() - L.lastOk > 20000 ? 'off' : '');
    c.textContent = L.live ? `live${ago != null ? ' · last event ' + (ago < 60 ? ago + 's' : Math.round(ago / 60) + 'm') + ' ago' : ''}` : 'reconnecting…';
    $('#clock').textContent = new Date().toLocaleTimeString([], { hour12: false });
    if (!L.live && L.lastOk && Date.now() - L.lastOk > 20000) {
      const o = $('#offline'); o.hidden = false;
      o.textContent = `Desk offline · retrying · last update ${new Date(L.lastOk).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
  }

  if (!token) { $('#main').hidden = true; $('#locked').hidden = false; return; }
  chips();
  snapshot(true).then(() => { chart(); stream(); }).catch(() => {});
  setInterval(conn, 1000);
  setInterval(() => { if (!document.hidden) snapshot().catch(() => conn()); }, 10000);
  setInterval(() => { if (!document.hidden) chart().catch(() => {}); }, 60000);
})();
