/* Grok Bot desk app. Plain JS, no framework, no build step.
   FOMO links are never built here: every URL comes from the server (links.py). */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');
  const PUB = window.DESK_PUBLIC || {};
  const APP = PUB.appName || 'Grok Bot';
  const reduced = () => window.Charts.reduced();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- token: {URL}#t={APP_TOKEN} once, then localStorage ---------- */
  (function takeToken() {
    const m = location.hash.match(/^#t=([^&]+)/);
    if (m) {
      localStorage.setItem('desk_token', decodeURIComponent(m[1]));
      history.replaceState(null, '', location.pathname + '#/home');
    }
  })();
  const token = () => localStorage.getItem('desk_token') || '';

  const S = { state: null, chart: null, range: 'LIVE', act: null, lastOk: 0, offline: false, retry: 5, exec: null, route: null };

  class Locked extends Error {}
  async function api(path, opts = {}) {
    const r = await fetch(path, {
      method: opts.method || 'GET', cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + token() }, opts.body ? { 'Content-Type': 'application/json' } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (r.status === 401) throw new Locked();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.detail || ('HTTP ' + r.status)); e.status = r.status; e.soft = true; throw e; }
    S.lastOk = Date.now();
    if (S.offline) { S.offline = false; S.retry = 5; banner(null); }
    return j;
  }

  /* ---------- formatters ---------- */
  const usd = (v, signed) => v == null ? 'n/a' : (signed ? (v >= 0 ? '+$' : '-$') : (v < 0 ? '-$' : '$')) +
    Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kusd = v => v == null ? 'n/a' : Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + Math.round(v);
  const pct = (v, d = 2) => v == null ? 'n/a' : (v >= 0 ? '+' : '') + v.toFixed(d) + '%';
  const gnum = v => (Math.round(v * 1000) / 1000).toString();
  const tm = ts => new Date(ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  const ago = ts => { const m = Math.max(0, (Date.now() / 1000 - ts) / 60); return m < 60 ? Math.floor(m) + 'm' : m < 1440 ? Math.floor(m / 60) + 'h' : Math.floor(m / 1440) + 'd'; };
  const price = v => v == null ? 'n/a' : '$' + window.Charts.fmtP(v);
  const AG = { scanner: 'Scanner', auditor: 'Auditor', analyst: 'Analyst', executor: 'Executor', risk: 'Risk' };
  const COL = { scanner: '#64d2ff', auditor: '#64d2ff', analyst: '#ffd60a', executor: '#00d35a', risk: '#ff6b9a' };

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  /* ---------- error state ---------- */
  let bannerTimer = null;
  function banner(err) {
    const b = $('#banner');
    clearInterval(bannerTimer);
    document.body.classList.toggle('offline', !!err);
    if (!err) { b.hidden = true; return; }
    S.offline = true;
    let n = S.retry;
    const paint = () => {
      const last = S.lastOk ? new Date(S.lastOk).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'never';
      b.textContent = `Desk offline · retrying in ${n}s · last update ${last}`;
    };
    b.hidden = false; paint();
    bannerTimer = setInterval(() => { n = Math.max(0, n - 1); paint(); }, 1000);
  }

  function lockedScreen() {
    view.innerHTML = `<div class="largetitle">${esc(APP)}</div><div class="empty">This desk is private.<br>Open it once from your own link
      (<span class="ter">your URL</span> followed by <code>#t=…</code>). The token then stays on this iPhone.</div>`;
  }

  /* ---------- odometer: each changed digit rolls 600ms ease-out, 30ms stagger right to left ---------- */
  function odo(el, text) {
    const prev = el._t;
    el._t = text;
    if (reduced() || prev == null || prev.length !== text.length) {
      el.innerHTML = [...text].map(ch => /\d/.test(ch)
        ? `<span class="d"><span class="s" style="transform:translateY(-${+ch * 1.02}em)">${[...'0123456789'].map(x => `<span>${x}</span>`).join('')}</span></span>`
        : `<span class="c">${esc(ch)}</span>`).join('');
      return;
    }
    const nodes = [...el.children];
    let order = 0;
    for (let i = text.length - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch !== prev[i] && /\d/.test(ch)) {
        const s = nodes[i].querySelector('.s');
        if (s) { s.style.transitionDelay = (order * 30) + 'ms'; s.style.transform = `translateY(-${+ch * 1.02}em)`; }
        order++;
      } else if (ch !== prev[i]) nodes[i].textContent = ch;
    }
  }

  /* ---------- navbar ---------- */
  function navbar() {
    const st = S.state || {};
    const handle = (S.account && S.account.fomoHandle) || '';
    return `<div class="nav">
      <a class="avatar" href="#/account" aria-label="Account"><span>${esc((handle[0] || APP[0]).toUpperCase())}</span></a>
      <a class="title" href="#/agents">${esc(APP)} <span class="chev">›</span></a>
      <button class="icon-btn" id="btn-search" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6" stroke-linecap="round"/></svg></button>
      <button class="icon-btn" id="btn-bell" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" stroke-linejoin="round"/></svg>${st.unread ? '<i class="dot"></i>' : ''}</button>
    </div>`;
  }
  function wireNav() {
    const s = $('#btn-search'); if (s) s.onclick = openSearch;
    const b = $('#btn-bell'); if (b) b.onclick = openBell;
  }

  /* ================= HOME ================= */
  function homeSkeleton() {
    return navbar() + `<div class="balance-wrap"><div class="sk" style="height:66px;width:72%;margin-top:6px"></div>
      <div class="sk" style="height:22px;width:40%;margin-top:12px"></div></div>
      <div class="sk" style="height:240px;margin:14px var(--g) 0"></div>
      <div class="section"><h3>Agents</h3></div><div class="carousel"><div class="acard sk"></div></div>
      <div class="section"><h3>Activity</h3></div><div class="list"><div class="row"><div class="sk" style="height:36px;flex:1"></div></div></div>`;
  }
  function homeShell() {
    view.innerHTML = navbar() + `<div id="home">
      <div class="balance-wrap"><div class="balance-row"><div class="balance"><span class="odo" id="odo"></span></div>
      <span class="pill paper" id="paper" hidden>PAPER</span></div>
      <div class="today"><span id="today"></span><span class="pill mult" id="mult"></span></div></div>
      <canvas class="chart" id="chart"></canvas>
      <div class="ranges" id="ranges">${['LIVE', '1H', '4H', '1D', '1W', 'ALL'].map(r => `<button data-r="${r}" class="${r === S.range ? 'on' : ''}">${r}</button>`).join('')}</div>
      <div class="section"><h3 id="agents-h">Agents</h3></div>
      <div class="carousel" id="cards">${Object.keys(AG).map(a => `<div class="acard" id="card-${a}"></div>`).join('')}</div>
      <a class="list pnlrow" href="#/trades" id="pnlrow"></a>
      <div class="section"><h3>Activity</h3><a href="#/activity">See all</a></div>
      <div class="list" id="act5"></div></div>`;
    wireNav();
    $$('#ranges button').forEach(b => b.onclick = async () => {
      S.range = b.dataset.r; $$('#ranges button').forEach(x => x.classList.toggle('on', x === b));
      S.chart = null; await refreshHome();
    });
  }
  async function viewHome() {
    if (!$('#home')) { if (!S.state) view.innerHTML = homeSkeleton(); }
    await refreshHome();
  }
  async function refreshHome() {
    const [st, ch, act] = await Promise.all([api('/api/state'), api('/api/chart?range=' + S.range), api('/api/activity')]);
    S.state = st;
    if (S.route !== 'home') return;
    if (!$('#home')) homeShell();
    odo($('#odo'), usd(st.balance));
    $('#paper').hidden = st.mode !== 'PAPER';
    const t = $('#today'); t.textContent = pct(st.todayPct) + ' today'; t.className = st.todayPct >= 0 ? 'up' : 'down';
    $('#mult').textContent = st.multiplier.toFixed(2) + '×';
    const dot = $('#btn-bell .dot'); if (!!st.unread !== !!dot) $('#btn-bell').innerHTML = $('#btn-bell').innerHTML.replace(/<i class="dot"><\/i>/, '') + (st.unread ? '<i class="dot"></i>' : '');
    window.Charts.lineChart($('#chart'), ch, S.chart); S.chart = ch;
    const tn = st.tonight || {};
    $('#pnlrow').innerHTML = `<div class="row"><div class="tx"><div class="t1">Trades & PnL tonight</div><div class="t2">${tn.trades || 0} closed${tn.winRate != null ? ' · ' + tn.winRate + '% won' : ''} · fees ${usd(tn.fees || 0)}</div></div>
      <div class="val ${(tn.realized || 0) >= 0 ? 'up' : 'down'}">${usd(tn.realized || 0, true)}<small>›</small></div></div>`;
    const running = st.agents.filter(a => !a.paused).length;
    $('#agents-h').textContent = `Agents · ${running} running`;
    st.agents.forEach(a => paintCard(a));
    $('#act5').innerHTML = act.rows.length ? act.rows.slice(0, 5).map(actRow).join('') : `<div class="empty">Nothing yet tonight</div>`;
  }

  /* ---------- agent cards ---------- */
  function paintCard(a) {
    const el = $('#card-' + a.name); if (!el) return;
    const hd = `<div class="hd"><i style="background:${COL[a.name]}"></i>${AG[a.name]}${a.paused ? ' <span class="pill" style="background:#2c2c2e;color:#ff9f0a;margin-left:auto">Paused</span>' : ''}</div>`;
    let body = '';
    if (a.name === 'scanner') {
      body = `<div class="big" style="color:${COL.scanner}">${a.count} pools</div><div class="sub">${a.waiting} in the waiting room · ${a.wsConnected ? 'live' : 'reconnecting'}</div>
        <div class="feed">${a.feed.length ? a.feed.slice(0, 5).map(f => f.verdict === 'pass'
          ? `<div class="r pass"><span class="n">${esc(f.name)} · liq ${kusd(f.liq)}</span><span class="why">→ auditor</span></div>`
          : `<div class="r kill"><span class="n">${esc(f.name)}</span><span class="why">${esc(f.reason || '')}</span></div>`).join('')
          : `<div class="empty" style="padding:30px 0">Listening for graduations</div>`}</div>`;
    } else if (a.name === 'auditor') {
      const cur = a.current;
      const layers = cur ? cur.layers : a.strips;
      const strips = Array.from({ length: 8 }, (_, i) => {
        const L = (layers || []).find(x => x.n === i + 1);
        const cls = L ? (L.pass ? 'ok' : 'bad') : (cur && cur.layer === i + 1 ? 'now' : '');
        return `<div class="${cls}">${i + 1}</div>`;
      }).join('');
      let line;
      if (!a.enabled) line = '<span class="muted">Take apart is off</span>';
      else if (cur) line = `<span style="color:#64d2ff">taking apart ${esc(cur.name)}...</span>`;
      else if (a.last) line = a.last.passed ? `<span class="up">${esc(a.last.name)} · 8/8 → Executor</span>` : `<span class="down">${esc(a.last.name)} · ${esc(a.last.reason)}</span>`;
      else line = `<span class="muted">No coin taken apart yet</span>`;
      body = `<div class="big">${a.count} taken apart</div><div class="strips">${strips}</div><div style="font-size:15px">${line}</div>
        <div class="foot"><span class="muted">${a.rejected} rejected</span>${a.lastMint ? `<a class="link" href="#/audit/${esc(a.lastMint)}">Open</a>` : ''}</div>`;
    } else if (a.name === 'analyst') {
      const L = a.current ? null : a.last;
      body = `<div class="big" style="color:${COL.analyst}">Scoring</div><div class="sub">${a.mode === 'rules' ? 'Rules mode' : 'Jev'} · green from ${a.minScore}</div>
        <canvas class="ring" id="ring"></canvas>
        <div class="foot"><span>${a.current ? esc(a.current.name) + ' · scoring…' : L ? esc(L.name) + (L.passed ? ' · <span class="up">→ Executor</span>' : ' · <span class="down">' + esc(L.reason || '') + '</span>') : '<span class="muted">Nothing scored yet</span>'}</span><span class="muted">${a.count} scored</span></div>`;
    } else if (a.name === 'executor') {
      const L = a.last;
      body = `<div class="big" style="color:${COL.executor}">${a.count} trades</div>
        <div class="sub">${L && L.size ? usd(L.size) + ' · ' + gnum(L.pct) + '% of stack' : 'stack ' + gnum(a.stackPct) + '% per coin'}</div>
        <div class="bar"><i id="exbar"></i></div><div id="exline" style="margin-top:8px;font-size:15px"></div>
        <div class="foot"><span class="muted">${L ? esc(L.name) + ' · ' + esc(L.status) : 'No push yet'}</span></div>`;
    } else if (a.name === 'risk') {
      const L = a.last;
      body = `<div class="big" style="color:${COL.risk}">${a.open ? 'Guarding' : 'Idle'}</div>
        <div class="sub">${a.open ? a.open + ' open position' + (a.open > 1 ? 's' : '') : 'No open positions'}</div>
        <div style="margin-top:14px;font-size:15px">${L ? `${esc(L.label)} · ${esc(L.name)} · <span class="${L.pnl >= 0 ? 'up' : 'down'}">${usd(L.pnl, true)}</span>` : '<span class="muted">No exits yet</span>'}</div>
        <div class="foot"><div class="pills"><span class="pill mono red">stop -${gnum(a.stopPct)}%</span><span class="pill mono green">trail ${gnum(a.trailPct)}%</span></div></div>`;
    }
    el.innerHTML = hd + body;
    if (a.name === 'analyst') {
      const sc = a.current ? null : (a.last ? a.last.score : null);
      requestAnimationFrame(() => { const r = $('#ring'); if (r) window.Charts.scoreRing(r, sc, a.minScore); });
    }
    if (a.name === 'executor') paintExec();
  }

  function paintExec() {
    const bar = $('#exbar'), line = $('#exline'); if (!bar) return;
    const e = S.exec;
    if (!e) { bar.style.width = '0'; line.innerHTML = ''; return; }
    if (e.filled) { bar.style.width = '100%'; line.innerHTML = '<span class="up">✓ Filled</span>'; return; }
    const dur = e.mode === 'PAPER' ? 1200 : 5 * 60 * 1000;
    const k = Math.min(e.mode === 'PAPER' ? 1 : 0.99, (Date.now() - e.start) / dur);
    bar.style.width = (k * 100).toFixed(0) + '%';
    line.innerHTML = `Executing... ${Math.round(k * 100)}%` + (e.mode === 'LIVE' ? ' <span class="muted">· waiting for your tap</span>' : '');
    if (k < 1) requestAnimationFrame(paintExec);
  }

  /* ---------- activity rows ---------- */
  const ICON = { bought: 'B', sold: 'S', stopped: '×', rejected: '–' };
  function actRow(r) {
    const href = r.mint ? (r.kind === 'rejected' ? '#/audit/' : '#/coin/') + r.mint : '#/activity';   // trades -> Coin, rejects -> Auditor
    const v = String(r.value || '');
    const cls = r.kind === 'sold' ? (v.startsWith('-') ? 'down' : 'up') : r.kind === 'stopped' ? 'down' : r.kind === 'rejected' ? 'muted' : '';
    const [v1, v2] = v.split(' · ');
    return `<a class="row" href="${href}"><div class="ic ${r.kind}">${ICON[r.kind] || '•'}</div>
      <div class="tx"><div class="t1">${esc(r.title)}</div><div class="t2">${esc(r.subtitle)}</div></div>
      <div class="val ${cls}">${esc(v1)}${v2 ? `<small>${esc(v2)}</small>` : `<small>${tm(r.ts)}</small>`}</div></a>`;
  }

  /* ================= ACTIVITY ================= */
  async function viewActivity() {
    if (!$('#acts')) view.innerHTML = `<div class="largetitle">Activity</div>${tabSeg()}<div class="list" id="acts">${'<div class="row"><div class="sk" style="height:40px;flex:1"></div></div>'.repeat(5)}</div>`;
    const d = await api('/api/activity');
    if (S.route !== 'activity') return;
    S.actNext = d.next;
    $('#acts').innerHTML = d.rows.length ? d.rows.map(actRow).join('') : `<div class="empty">Nothing yet tonight</div>`;
    let more = $('#more'); if (more) more.remove();
    if (d.next) {
      view.insertAdjacentHTML('beforeend', `<button class="more" id="more">Load more</button>`);
      $('#more').onclick = async () => {
        const n = await api('/api/activity?before=' + S.actNext); S.actNext = n.next;
        $('#acts').insertAdjacentHTML('beforeend', n.rows.map(actRow).join(''));
        if (!n.next) $('#more').remove();
      };
    }
  }

  function tabSeg() {
    return `<div class="seg2"><a href="#/activity" class="${S.route === 'activity' ? 'on' : ''}">Activity</a><a href="#/trades" class="${S.route === 'trades' ? 'on' : ''}">Trades & PnL</a></div>`;
  }

  /* ================= TRADES & PnL ================= */
  const REASON = { trail: 'Trailing stop', stop: 'Stop', timeout: 'Timeout', pulled: 'Liquidity pulled', manual: 'Sold by hand' };
  const hold = m => m == null ? 'n/a' : m < 60 ? Math.round(m) + 'm' : Math.floor(m / 60) + 'h ' + Math.round(m % 60) + 'm';
  const cls = v => v == null ? '' : v >= 0 ? 'up' : 'down';
  function tradeRow(t) {
    const open = !t.closedAt;
    const v = open ? t.unrealized : t.pnl;
    const sub = open ? `${usd(t.size)} in · ${price(t.entry)} → ${price(t.price)} · stop -${gnum(t.stopPct)}%${t.exiting ? ' · exiting' : ''}`
      : `${tm(t.openedAt)} · ${hold(t.holdMin)} · ${esc(REASON[t.reason] || t.reason)} · fees ${usd(t.fees)}`;
    return `<a class="row" href="#/coin/${esc(t.mint)}"><div class="ic ${open ? 'bought' : (t.pnl >= 0 ? 'sold' : 'stopped')}">${open ? '•' : (t.pnl >= 0 ? '+' : '−')}</div>
      <div class="tx"><div class="t1">${esc(t.name)}</div><div class="t2">${sub}</div></div>
      <div class="val ${cls(v)}">${v == null ? 'n/a' : usd(v, true)}<small>${t.pct == null ? '' : pct(t.pct)}${open ? ' open' : ''}</small></div></a>`;
  }
  async function viewTrades(more) {
    S.tr = S.tr || { mode: null, range: 'night' };
    if (!$('#trades')) view.innerHTML = `<div class="largetitle">Activity</div>${tabSeg()}<div id="trades"><div class="sk" style="height:120px;margin:12px var(--g)"></div><div class="sk" style="height:180px;margin:12px var(--g)"></div></div>`;
    const q = `/api/trades?range=${S.tr.range}` + (S.tr.mode ? `&mode=${S.tr.mode}` : '');
    const [d, lz] = await Promise.all([api(more ? q + '&before=' + S.tr.next : q), api('/api/lessons')]);
    S.tr.lz = lz;
    if (S.route !== 'trades') return;
    if (more) { S.tr.closed = S.tr.closed.concat(d.closed); } else { S.tr.closed = d.closed; }
    S.tr.next = d.next; S.tr.mode = d.mode; S.tr.data = d;
    const s = d.summary;
    const stat = (k, v, c) => `<div><span>${k}</span><b class="${c || ''}">${v}</b></div>`;
    $('#trades').innerHTML = `
      <div class="filters"><div class="seg" id="tr-mode">${['PAPER', 'LIVE'].map(m => `<button data-v="${m}" class="${m === d.mode ? 'on' : ''}">${m}</button>`).join('')}</div>
        <div class="seg" id="tr-range">${[['night', 'Tonight'], ['7d', '7D'], ['all', 'All']].map(([k, l]) => `<button data-v="${k}" class="${k === d.range ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="pnlhead"><div class="muted">Net PnL after fees${d.mode === 'PAPER' ? ' · PAPER' : ''}</div>
        <div class="pnlbig ${cls(s.realized)}">${usd(s.realized, true)}</div>
        <div class="muted">${s.pct == null ? '' : pct(s.pct) + ' of ' + usd(s.startStack) + ' · '}open ${usd(s.unrealized, true)} before exit fees</div></div>
      <canvas class="pnlchart" id="pnlc"></canvas>
      <div class="stats">${stat('Win rate', s.winRate == null ? 'n/a' : s.winRate + '%')}${stat('Trades', `${s.trades} · ${s.wins}W ${s.losses}L`)}
        ${stat('Profit factor', s.profitFactor == null ? 'n/a' : s.profitFactor)}${stat('Max drawdown', usd(-s.maxDrawdown) + ' · ' + s.maxDrawdownPct + '%', s.maxDrawdown ? 'down' : '')}
        ${stat('Avg win', s.avgWin == null ? 'n/a' : usd(s.avgWin, true), 'up')}${stat('Avg loss', s.avgLoss == null ? 'n/a' : usd(s.avgLoss, true), 'down')}
        ${stat('Best', s.best == null ? 'n/a' : usd(s.best, true), cls(s.best))}${stat('Worst', s.worst == null ? 'n/a' : usd(s.worst, true), cls(s.worst))}
        ${stat('Fees paid', usd(s.fees))}${stat('Avg hold', hold(s.avgHoldMin))}</div>
      <div class="group-t">PnL by exit</div><div class="list">${d.byReason.length ? d.byReason.map(b => `<div class="vrow"><span class="k">${esc(REASON[b.reason] || b.reason)} · ${b.n}</span><span class="val ${cls(b.pnl)}">${usd(b.pnl, true)}</span></div>`).join('') : '<div class="empty">No exits yet</div>'}</div>
      <div class="group-t">AUTO readiness · burner wallet $${d.readiness.burnerUsd}</div><div class="list">
        ${d.readiness.items.map(i => `<div class="vrow"><span class="k">${i.ok ? '<span class="up">✓</span>' : '<span class="down">✕</span>'} ${esc(i.label)}</span><span class="val">${esc(i.value)}</span></div>`).join('')}
        <div class="vrow"><span class="muted" style="font-size:13px">${d.readiness.ready ? 'Every line is green on PAPER. AUTO is still off until you say go.' : 'AUTO is not built. It is considered only when every line is green on PAPER.'}</span></div></div>
      <div class="group-t">Lessons learned · learner ${esc(S.tr.lz ? S.tr.lz.mode : '')}</div><div class="list" id="tr-lessons">${lessonRows()}</div>
      <div class="group-t">Open · ${d.open.length}</div><div class="list">${d.open.length ? d.open.map(tradeRow).join('') : '<div class="empty">No open positions</div>'}</div>
      <div class="group-t">Closed · ${s.trades}</div><div class="list" id="tr-closed">${S.tr.closed.length ? S.tr.closed.map(tradeRow).join('') : '<div class="empty">No closed trades yet</div>'}</div>
      ${d.next ? '<button class="more" id="tr-more">Load more</button>' : ''}
      ${S.tr.closed.length ? '<button class="more" id="tr-csv">Export CSV</button>' : ''}`;
    requestAnimationFrame(() => window.Charts.pnlCurve($('#pnlc'), s.curve, s.curve.length ? Math.min(s.curve[0][0], ...S.tr.closed.map(t => t.openedAt)) : 0));
    $$('#tr-mode button').forEach(b => b.onclick = () => { S.tr.mode = b.dataset.v; viewTrades(); });
    $$('#tr-range button').forEach(b => b.onclick = () => { S.tr.range = b.dataset.v; viewTrades(); });
    const m = $('#tr-more'); if (m) m.onclick = () => viewTrades(true);
    const c = $('#tr-csv'); if (c) c.onclick = exportCsv;
    $$('#tr-lessons [data-l]').forEach(b => b.onclick = async ev => {
      ev.preventDefault();
      const [id, act] = b.dataset.l.split(':');
      if (act === 'undo' && !confirm('Undo this lesson? The setting goes back to its old value.')) return;
      toast((await api(`/api/lessons/${id}/${act}`, { method: 'POST' })).result); viewTrades();
    });
  }
  function lessonRows() {
    const L = (S.tr.lz && S.tr.lz.lessons) || [];
    if (!L.length) return `<div class="empty">No lessons yet. Every closed trade gets a post-mortem; the desk tightens only when losses show a pattern.</div>`;
    return L.map(l => `<div class="vrow" style="align-items:flex-start"><span class="k" style="flex:1"><b style="color:#fff">#${l.id} ${esc(l.key.split('.').pop().replace(/_/g, ' '))} ${esc(gnum(l.old))} → ${esc(gnum(l.new))}</b><br>${esc(l.text)}</span>
      ${l.status === 'applied' ? `<button class="link" style="color:#ff453a" data-l="${l.id}:undo">Undo</button>` : l.status === 'suggested' ? `<button class="link" data-l="${l.id}:apply">Apply</button>` : `<span class="muted">${esc(l.status)}</span>`}</div>`).join('');
  }
  async function exportCsv() {
    const rows = [['opened', 'closed', 'coin', 'mint', 'mode', 'size_usd', 'entry', 'exit', 'reason', 'pnl_usd', 'pct', 'fees_usd', 'fomo_link']];
    S.tr.closed.forEach(t => rows.push([new Date(t.openedAt * 1000).toISOString(), new Date(t.closedAt * 1000).toISOString(), t.name, t.mint, t.mode,
      t.size, t.entry, t.exit, t.reason, t.pnl, t.pct, t.fees, t.link]));
    const csv = rows.map(r => r.map(x => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const file = new File([csv], `trades-${S.tr.mode}-${S.tr.range}.csv`, { type: 'text/csv' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (_) { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  }

  /* ================= AGENTS ================= */
  async function viewAgents() {
    if (!$('#agents')) view.innerHTML = `<div class="largetitle">Agents</div><div id="agents">${'<div class="fcard sk" style="height:180px"></div>'.repeat(3)}</div>`;
    const st = await api('/api/state');
    const decs = await Promise.all(Object.keys(AG).map(a => api(`/api/agents/${a}/decisions`)));
    S.state = st;
    if (S.route !== 'agents') return;
    $('#agents').innerHTML = st.agents.map((a, i) => {
      const locked = a.name === 'risk' && a.locked;
      const today = a.name === 'scanner' ? `${a.count} pools` : a.name === 'auditor' ? `${a.count} taken apart · ${a.rejected} rejected`
        : a.name === 'analyst' ? `${a.count} scored` : a.name === 'executor' ? `${a.count} trades` : `${a.open} open`;
      const rows = decs[i].length ? decs[i].map(d => `<div class="dec"><span class="w">${tm(d.ts)}</span>
        <span class="c"><a href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.name)}</a></span>
        <span class="v ${esc(d.verdict)}">${esc(d.verdict)}${d.reason ? ' · ' + esc(d.reason) : ''}</span></div>`).join('')
        : `<div class="dec"><span></span><span class="muted">No decisions yet</span><span></span></div>`;
      return `<div class="fcard"><div class="top"><span class="status ${a.paused ? 'paused' : ''}"></span><b>${AG[a.name]}</b>
        <label class="sw" title="${locked ? 'Risk is locked while a position is open' : ''}"><input type="checkbox" data-agent="${a.name}" ${a.paused ? '' : 'checked'} ${locked ? 'disabled' : ''}><i></i></label></div>
        <div class="meta"><span>${a.paused ? 'Paused' : 'Running'} · today ${today}</span><a class="link" href="#/account/${a.name}">Settings</a></div>${rows}</div>`;
    }).join('');
    $$('#agents input[data-agent]').forEach(inp => inp.onchange = async () => {
      try { const r = await api(`/api/agents/${inp.dataset.agent}/${inp.checked ? 'resume' : 'pause'}`, { method: 'POST' }); toast(r.message); }
      catch (e) { toast(e.message); inp.checked = !inp.checked; }
      viewAgents();
    });
  }

  /* ================= AUDITOR SCREEN ================= */
  const DISC_GAP = 32;
  async function viewAudit(mint) {
    if (!$('#audit')) view.innerHTML = `<div class="nav"><a class="back" href="javascript:history.back()"><svg viewBox="0 0 12 20"><path d="M10 2 2 10l8 8"/></svg>Back</a></div>
      <div id="audit"><div class="sk" style="width:220px;height:300px;margin:6px auto"></div><div class="list">${'<div class="vrow"><div class="sk" style="height:20px;flex:1"></div></div>'.repeat(4)}</div></div>`;
    const d = await api(mint ? '/api/audit/' + encodeURIComponent(mint) : '/api/audits/latest');
    if (!S.route.startsWith('audit')) return;
    if (!d.audited && !d.running) {
      $('#audit').innerHTML = `<div class="largetitle">Auditor</div><div class="empty">No coin taken apart yet</div>` + auditToggle(d.enabled !== false) + (d.coinUrl ? `<a class="cta ghost" href="${esc(d.coinUrl)}" target="_blank" rel="noopener">Open on FOMO</a>` : '');
      wireToggle(); return;
    }
    const done = d.layers.filter(L => L.pass !== null).length + (d.verdict === 'rejected' ? 0 : 0);
    $('#audit').innerHTML = `<div class="coinhd"><h1>${esc(d.name)}</h1><div class="muted">${esc(d.symbol || '')} · Solana · taken apart in 8 layers</div></div>
      <div class="stack" id="stack">${d.layers.map((L, i) => `<div class="disc" id="disc-${i}" style="top:${8 + i * DISC_GAP}px;z-index:${20 - i}"><b>${''}</b></div>`).join('')}<div class="beam" id="beam"></div></div>
      <div class="list" id="vrows">${d.layers.map((L, i) => `<div class="vrow"><span class="k"><em>${L.n}</em>${esc(L.name)}</span><span class="val na" id="val-${i}">…</span></div>`).join('')}</div>
      <div id="verdict"></div>${auditToggle(d.enabled)}
      <a class="cta ghost" href="${esc(d.coinUrl)}" target="_blank" rel="noopener">Open on FOMO</a>`;
    wireToggle();
    S.audit = { d, mint: d.mint, i: 0, waiting: false };
    runBeam();
  }
  function auditToggle(on) {
    return `<div class="list" style="margin-top:16px"><div class="vrow"><span>Take apart before buying</span><label class="sw"><input type="checkbox" id="aud-en" ${on ? 'checked' : ''}><i></i></label></div></div>`;
  }
  function wireToggle() {
    const t = $('#aud-en'); if (!t) return;
    t.onchange = async () => {
      if (!t.checked) {
        if (!confirm('Turn off the Auditor? Coins would reach the Analyst without the 8 safety layers.') ||
            !confirm('Are you sure? Rugs, freeze authority and drains will not be checked.')) { t.checked = true; return; }
      }
      try { await api('/api/settings', { method: 'POST', body: { 'auditor.enabled': t.checked } }); toast(t.checked ? 'Auditor on' : 'Auditor off'); }
      catch (e) { toast(e.message); t.checked = !t.checked; }
    };
  }
  function reveal(i, L) {
    const disc = $('#disc-' + i), val = $('#val-' + i); if (!disc) return;
    disc.classList.remove('ok', 'bad', 'grey');
    if (L.pass === true) { disc.classList.add('ok'); disc.firstChild.textContent = '✓'; val.className = 'val ok'; }
    else if (L.pass === false) { disc.classList.add('bad'); disc.firstChild.textContent = '✕'; val.className = 'val bad'; }
    else { disc.classList.add('grey'); val.className = 'val na'; }
    val.textContent = L.value;
  }
  function verdictBox(d) {
    const v = $('#verdict'); if (!v) return;
    if (d.verdict === 'rejected') v.innerHTML = `<div class="verdict bad"><b>Rejected · ${esc(d.reason)}</b><span>${esc(APP)} won't buy ${esc(d.name)}</span></div>`;
    else if (d.verdict === 'cleared') v.innerHTML = `<div class="verdict ok"><b>Cleared · 8/8 parts</b><span>${d.sentSize ? 'Sent to Executor · ' + usd(d.sentSize) : 'Sent to Analyst'}</span></div>`;
    else v.innerHTML = `<div class="verdict"><b style="color:#64d2ff">Taking apart...</b><span>Layer by layer, as the server reads them</span></div>`;
  }
  function runBeam() {
    const A = S.audit; if (!A) return;
    const d = A.d, beam = $('#beam');
    if (reduced()) { d.layers.forEach((L, i) => { if (L.pass !== null || !d.running) reveal(i, L); }); if (!d.running) verdictBox(d); return; }
    const step = () => {
      if (S.audit !== A || !$('#beam')) return;
      if (A.i >= 8) { beam.style.opacity = 0; verdictBox(d); return; }
      const L = d.layers[A.i];
      const firstRed = d.layers.findIndex(x => x.pass === false);
      if (firstRed >= 0 && A.i > firstRed) {           // after a red: the rest are grey "not checked"
        for (let k = A.i; k < 8; k++) reveal(k, d.layers[k]);
        A.i = 8; return step();
      }
      beam.style.opacity = 1; beam.style.top = (8 + A.i * DISC_GAP + 19) + 'px';
      setTimeout(() => {
        if (S.audit !== A) return;
        if (L.pass === null && d.running) { A.waiting = true; verdictBox(d); return; }   // the beam waits on that layer
        A.waiting = false;
        reveal(A.i, L);
        setTimeout(() => { A.i++; step(); }, 150);
      }, 350);
    };
    step();
  }
  function onAuditEvent(kind, data) {
    const A = S.audit;
    if (!A || data.mint !== A.mint) return;
    if (kind === 'audit_layer' && data.pass !== undefined && data.n) {
      A.d.layers[data.n - 1] = { n: data.n, name: data.name, pass: data.pass, value: data.value, source: data.source };
      if (A.waiting) { A.waiting = false; runBeamResume(); }
    }
    if (kind === 'audit') {
      A.d.running = false;
      A.d.layers = data.layers; A.d.verdict = data.passed ? 'cleared' : 'rejected'; A.d.reason = data.reason;
      if (A.waiting) { A.waiting = false; runBeamResume(); }
    }
  }
  function runBeamResume() { const A = S.audit; if (A) { const i = A.i; A.i = i; runBeam(); } }

  /* ================= COIN SCREEN ================= */
  async function viewCoin(mint) {
    if (!$('#coin') || S.coinMint !== mint) {
      S.coinMint = mint;
      view.innerHTML = `<div class="nav"><a class="back" href="javascript:history.back()"><svg viewBox="0 0 12 20"><path d="M10 2 2 10l8 8"/></svg>Back</a></div>
        <div id="coin"><div class="coinhd"><div class="sk" style="height:30px;width:50%"></div><div class="sk" style="height:48px;width:60%;margin-top:12px"></div></div>
        <div class="sk" style="height:280px;margin:12px var(--g)"></div><div class="stats">${'<div><div class="sk" style="height:34px"></div></div>'.repeat(4)}</div></div>`;
    }
    const c = await api('/api/coin/' + encodeURIComponent(mint));
    if (!S.route.startsWith('coin')) return;
    const p = c.position && !c.position.closedAt ? c.position : null;
    const chg = p && c.price ? 100 * (c.price / p.entry - 1) : null;
    const age = c.migratedAt ? ago(c.migratedAt) + ' old' : '';
    const shield = c.audit.passed === 8 ? 'chip' : c.audit.passed ? 'chip bad' : 'chip na';
    const left = p ? Math.max(0, p.timeoutAt - Date.now() / 1000) : 0;
    const exitCard = p ? `<div class="group-t">Your position · ${usd(p.size)} in · Executor${p.mode === 'PAPER' ? ' · PAPER' : ''}</div>
      <div class="excard">
        <div class="vrow"><span class="k">Entry</span><span class="val">${price(p.entry)}</span></div>
        <div class="vrow"><span class="k">Stop line</span><span class="val bad">${price(p.stop)} · -${gnum(p.stopPct)}%</span></div>
        <div class="vrow"><span class="k">Trail line</span><span class="val ${p.trailActive ? 'ok' : 'na'}">${p.trailActive ? price(p.trailLine) + ' · ' + gnum(p.trailPct) + '% off the top' : 'starts at ' + price(p.trailLine)}</span></div>
        <div class="vrow"><span class="k">Time left to timeout</span><span class="val">${Math.floor(left / 3600)}h ${Math.floor(left % 3600 / 60)}m</span></div>
        ${p.exitingAt ? `<div class="vrow"><span class="k">Risk says</span><span class="val bad">exit · ${esc(p.exitReason)}</span></div>` : ''}
      </div>` : '';
    const taps = c.signal && c.mode === 'LIVE' ? `<div class="btnrow"><button id="tap-bought">Bought</button><button id="tap-skip">Skip</button></div>`
      : (p && p.exitingAt && p.mode === 'LIVE' ? `<div class="btnrow"><button id="tap-sold">Sold</button></div>` : '');
    $('#coin').innerHTML = `<div class="coinhd"><h1>${esc(c.name || c.symbol || mint.slice(0, 6))}${c.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}</h1>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span class="muted">${esc(c.symbol || '')} · Solana · ${age}</span>
      <span class="${shield}">🛡 ${c.audit.passed}/8</span></div>
      <div class="price">${price(c.price)}</div>
      ${chg != null ? `<div class="${chg >= 0 ? 'up' : 'down'}" style="font-weight:600;margin-top:4px">${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(2)}% since entry</div>` : ''}</div>
      <canvas class="candles" id="candles"></canvas>
      <div class="stats"><div><span>Market cap</span><b>${kusd(c.stats.mcap)}</b></div><div><span>Liquidity</span><b>${kusd(c.stats.liquidity)}</b></div>
      <div><span>24h volume</span><b>${kusd(c.stats.volume24h)}</b></div><div><span>Holders</span><b>${c.stats.holders == null ? 'n/a' : c.stats.holders.toLocaleString()}</b></div></div>
      ${exitCard}
      <a class="cta ${p ? 'sell' : ''}" href="${esc(c.coinUrl)}" target="_blank" rel="noopener">${p ? 'Sell on FOMO' : 'Buy on FOMO'}</a>${taps}
      <a class="link" style="display:flex;justify-content:center" href="#/audit/${esc(mint)}">See the audit</a>`;
    requestAnimationFrame(() => window.Charts.candleChart($('#candles'), { candles: c.candles, exitLine: p ? p.exitLine : null, entry: p ? p.entry : null }));
    const tb = $('#tap-bought'), ts = $('#tap-skip'), td = $('#tap-sold');
    if (tb) tb.onclick = async () => { toast((await api(`/api/signals/${c.signal.id}/bought`, { method: 'POST' })).result); viewCoin(mint); };
    if (ts) ts.onclick = async () => { toast((await api(`/api/signals/${c.signal.id}/skip`, { method: 'POST' })).result); viewCoin(mint); };
    if (td) td.onclick = async () => { toast((await api(`/api/positions/${p.id}/sold`, { method: 'POST' })).result); viewCoin(mint); };
  }

  /* ================= ACCOUNT ================= */
  async function viewAccount(section) {
    if (!$('#account')) view.innerHTML = `<div class="largetitle">Account</div><div id="account">${'<div class="sk" style="height:60px;margin:10px var(--g)"></div>'.repeat(5)}</div>`;
    const [acc, set] = await Promise.all([api('/api/account'), api('/api/settings')]);
    S.account = acc;
    if (!S.route.startsWith('account')) return;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const g = set.groups;
    const groupHtml = name => `<div class="group-t" id="grp-${name}">${name === 'desk' ? 'Desk' : AG[name]}</div><div class="list">${g[name].filter(s => s.key !== 'desk.mode').map(settingRow).join('')}</div>`;
    $('#account').innerHTML = `
      <div class="group-t">Mode</div><div class="list"><div class="vrow"><span>Trading mode</span><div class="seg" id="mode">
        <button data-m="PAPER" class="${acc.mode === 'PAPER' ? 'on' : ''}">PAPER</button><button data-m="LIVE" class="${acc.mode === 'LIVE' ? 'on' : ''}">LIVE</button></div></div>
        ${!acc.liveAllowed ? `<div class="vrow"><span class="muted" style="font-size:13px">${esc(acc.liveWhy)}</span></div>` : ''}
        <div class="vrow"><span>Stack</span><span class="val">${usd(acc.stack)}</span></div>
        <div class="vrow"><span>LIVE stack</span><input class="field" type="number" inputmode="decimal" id="stack" value="${acc.liveStack}"></div>
        ${acc.ticket.message ? `<div class="vrow"><span class="${acc.ticket.level === 'warn' ? 'down' : 'muted'}" style="font-size:13px">${esc(acc.ticket.message)}</span></div>` : ''}</div>
      <div class="group-t">FOMO</div><div class="list">
        ${acc.profileUrl ? `<a class="vrow" href="${esc(acc.profileUrl)}" target="_blank" rel="noopener"><span>Your FOMO profile</span><span class="val ok">@${esc(acc.fomoHandle)} ›</span></a>`
          : `<div class="vrow"><span>Your FOMO handle</span><input class="field" type="text" id="handle" placeholder="username" style="width:150px"></div>`}
        <button class="vrow" id="invite" style="width:100%"><span>Invite a friend</span><span class="val ok">Share ›</span></button></div>
      <div class="group-t">Notifications</div><div class="list">
        <div class="vrow"><span>Telegram</span><span class="val ${acc.telegram.configured && acc.telegram.owner ? 'ok' : 'na'}">${acc.telegram.configured ? (acc.telegram.owner ? 'connected' : 'send /start to your bot') : 'not connected'}</span></div>
        <div class="vrow"><span>Web push on this iPhone</span><span class="val ${acc.webpush.subscriptions ? 'ok' : 'na'}">${acc.webpush.subscriptions ? acc.webpush.subscriptions + ' device(s)' : 'off'}</span></div>
        ${standalone ? `<button class="vrow" id="enable-push" style="width:100%"><span>Enable notifications</span><span class="val ok">›</span></button>`
          : `<div class="vrow"><span class="muted" style="font-size:13px">Add ${esc(APP)} to your home screen (Safari, Share, Add to Home Screen) to enable notifications.</span></div>`}
        <button class="vrow" id="test-push" style="width:100%"><span>Send test push</span><span class="val ok">›</span></button></div>
      <div class="group-t">Analyst · Jev key</div><div class="list"><div class="vrow"><span>${acc.jevKey ? 'Jev key saved · mode ' + esc(acc.analystMode) : 'No key · rules mode'}</span>
        ${acc.jevKey ? '<button class="link" id="jev-rm" style="color:#ff453a">Remove</button>' : ''}</div>
        ${acc.jevKey ? '' : `<div class="vrow"><input class="field" type="password" id="jev" placeholder="paste key" style="width:100%;text-align:left"><button class="link" id="jev-save" style="margin-left:10px">Save</button></div>`}</div>
      <div class="group-t">Talk to the desk</div>
      <div class="cmd"><input id="cmd" placeholder="why X · set stop to -8% · status" autocapitalize="off" autocomplete="off"><button id="cmd-go">Send</button></div><div id="replies"></div>
      ${['scanner', 'auditor', 'analyst', 'executor', 'risk', 'desk'].map(groupHtml).join('')}`;
    wireAccount(acc);
    if (section) { const el = $('#grp-' + section); if (el) el.scrollIntoView(); }
  }
  function settingRow(s) {
    const id = 'set-' + s.key.replace(/\./g, '-');
    const label = esc(s.label) + (s.sub ? ' <span class="ter">(rules)</span>' : '');
    if (s.kind === 'bool') return `<div class="set"><div class="l"><span>${label}</span><label class="sw"><input type="checkbox" data-key="${s.key}" ${s.value ? 'checked' : ''}><i></i></label></div></div>`;
    if (s.kind.startsWith('enum:')) return `<div class="set"><div class="l"><span>${label}</span><div class="seg" data-key="${s.key}">${s.kind.slice(5).split('|').map(o => `<button data-v="${o}" class="${o === s.value ? 'on' : ''}">${o}</button>`).join('')}</div></div></div>`;
    if (s.kind === 'str' || s.kind === 'time') return `<div class="set"><div class="l"><span>${label}</span><input type="${s.kind === 'time' ? 'time' : 'text'}" data-key="${s.key}" value="${esc(s.value)}"></div></div>`;
    const step = s.kind === 'int' ? 1 : (s.max <= 1 ? 0.01 : s.max <= 100 ? 0.5 : 1);
    return `<div class="set"><div class="l"><span>${label}</span><input type="number" inputmode="decimal" data-key="${s.key}" id="${id}" value="${s.value}" step="${step}" min="${s.min}" max="${s.max}"></div>
      <input type="range" data-for="${id}" min="${s.min}" max="${s.max}" step="${step}" value="${s.value}"></div>`;
  }
  async function saveSetting(key, value, el) {
    try { const r = await api('/api/settings', { method: 'POST', body: { [key]: value } }); toast(`${key.split('.').pop()} → ${r.changed[0].new}`); if (r.ticket && r.ticket.message) toast(r.ticket.message); }
    catch (e) { toast(e.message); if (el) viewAccount(); }
  }
  function wireAccount(acc) {
    $$('#mode button').forEach(b => b.onclick = async () => {
      const m = b.dataset.m; if (m === acc.mode) return;
      const body = { mode: m };
      if (m === 'LIVE') { const t = prompt('Money only moves when you tap Buy on FOMO and buy inside FOMO.\nType LIVE to confirm'); if (t !== 'LIVE') return; body.confirm = 'LIVE'; }
      try { await api('/api/mode', { method: 'POST', body }); toast('Mode ' + m); } catch (e) { toast(e.message); }
      viewAccount();
    });
    const st = $('#stack'); if (st) st.onchange = () => saveSetting('desk.stack_usd', st.value, st);
    const hd = $('#handle'); if (hd) hd.onchange = async () => { await saveSetting('desk.fomo_handle', hd.value, hd); viewAccount(); };
    $('#invite').onclick = async () => {
      const url = acc.signupUrl;
      try { if (navigator.share) { await navigator.share({ url }); return; } } catch (_) { return; }
      try { await navigator.clipboard.writeText(url); } catch (_) { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      toast('Link copied');
    };
    $('#test-push').onclick = async () => { const r = await api('/api/push/test', { method: 'POST' }); toast(r.ok ? 'Sent via ' + r.via.join(', ') : 'No channel connected yet'); };
    const ep = $('#enable-push'); if (ep) ep.onclick = enablePush;
    const js = $('#jev-save'); if (js) js.onclick = async () => { await api('/api/jev-key', { method: 'POST', body: { key: $('#jev').value } }); toast('Jev key saved'); viewAccount(); };
    const jr = $('#jev-rm'); if (jr) jr.onclick = async () => { if (!confirm('Remove the Jev key? Analyst switches to rules mode.')) return; await api('/api/jev-key', { method: 'POST', body: { key: '' } }); viewAccount(); };
    const go = async () => {
      const t = $('#cmd').value.trim(); if (!t) return;
      const r = await api('/api/command', { method: 'POST', body: { text: t } });
      $('#replies').innerHTML = r.replies.map(x => `<div class="reply">${esc(x.text)}<div>${(x.buttons || []).map(b => b.url
        ? `<a class="b" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)}</a>`
        : `<a class="b" href="#" data-cb="${esc(b.callback)}">${esc(b.label)}</a>`).join('')}</div></div>`).join('');
      $$('#replies [data-cb]').forEach(a => a.onclick = async ev => {
        ev.preventDefault(); const [k, id] = a.dataset.cb.split(':');
        const path = k === 'sold' ? `/api/positions/${id}/sold` : `/api/signals/${id}/${k}`;
        toast((await api(path, { method: 'POST' })).result);
      });
    };
    $('#cmd-go').onclick = go; $('#cmd').onkeydown = e => { if (e.key === 'Enter') go(); };
    $$('#account input[type=number][data-key]').forEach(inp => {
      const rng = $(`input[data-for="${inp.id}"]`);
      inp.onchange = () => { if (rng) rng.value = inp.value; saveSetting(inp.dataset.key, inp.value, inp); };
      if (rng) { rng.oninput = () => inp.value = rng.value; rng.onchange = () => saveSetting(inp.dataset.key, rng.value, inp); }
    });
    $$('#account input[type=checkbox][data-key]').forEach(inp => inp.onchange = () => {
      if (inp.dataset.key === 'auditor.enabled' && !inp.checked && (!confirm('Turn off the Auditor?') || !confirm('Are you sure? Coins skip the 8 safety layers.'))) { inp.checked = true; return; }
      saveSetting(inp.dataset.key, inp.checked, inp);
    });
    $$('#account input[type=text][data-key], #account input[type=time][data-key]').forEach(inp => inp.onchange = () => saveSetting(inp.dataset.key, inp.value, inp));
    $$('#account .seg[data-key]').forEach(seg => $$('button', seg).forEach(b => b.onclick = async () => { await saveSetting(seg.dataset.key, b.dataset.v, seg); viewAccount(); }));
  }
  async function enablePush() {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Notifications not allowed'); return; }
      const key = PUB.vapidPublicKey;
      const pad = '='.repeat((4 - key.length % 4) % 4);
      const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) });
      await api('/api/push', { method: 'POST', body: sub.toJSON() });
      toast('Notifications on'); viewAccount();
    } catch (e) { toast('Could not enable: ' + e.message); }
  }

  /* ================= search + bell ================= */
  function sheet(html) {
    const s = document.createElement('div'); s.className = 'sheet'; s.innerHTML = html; document.body.appendChild(s);
    $('.sheet-close', s).onclick = () => s.remove(); return s;
  }
  function openSearch() {
    const s = sheet(`<div class="search"><input id="q" placeholder="Name, symbol or mint" autocapitalize="off" autocomplete="off"><button class="link sheet-close">Cancel</button></div><div class="list" id="qres"></div>`);
    const q = $('#q', s); q.focus();
    q.oninput = async () => {
      if (q.value.trim().length < 2) { $('#qres', s).innerHTML = ''; return; }
      const rows = await api('/api/search?q=' + encodeURIComponent(q.value.trim()));
      $('#qres', s).innerHTML = rows.length ? rows.map(r => `<a class="row" href="#/coin/${esc(r.mint)}"><div class="tx"><div class="t1">${esc(r.name || r.mint.slice(0, 8))}</div>
        <div class="t2">${esc(r.symbol || '')} · ${esc(r.mint.slice(0, 4))}…${esc(r.mint.slice(-4))}</div></div><span class="val muted">›</span></a>`).join('') : `<div class="empty">No coin found</div>`;
      $$('a.row', s).forEach(a => a.addEventListener('click', () => s.remove()));
    };
  }
  async function openBell() {
    const s = sheet(`<div class="nav"><span class="title">Pushes</span><button class="link sheet-close">Done</button></div><div class="list" id="pres"><div class="row"><div class="sk" style="height:36px;flex:1"></div></div></div>`);
    const rows = await api('/api/pushes');
    $('#pres', s).innerHTML = rows.length ? rows.map(p => `<a class="row" ${p.url ? `href="${esc(p.url)}" target="_blank" rel="noopener"` : ''}><div class="tx">
      <div class="t2">${esc(APP)} · ${tm(p.ts)}</div><div class="t1" style="white-space:normal">${esc(p.text)}</div></div></a>`).join('') : `<div class="empty">No pushes yet</div>`;
    api('/api/pushes/read', { method: 'POST' }).catch(() => {});
  }

  /* ================= router ================= */
  async function route() {
    const h = location.hash || '#/home';
    const [, name, arg] = h.match(/^#\/(\w+)\/?([^/?]*)/) || [null, 'home', ''];
    const prev = S.route;
    S.route = name + (arg ? '/' + arg : '');
    if (prev !== S.route) { S.audit = null; if (name !== 'home') S.chart = null; window.scrollTo(0, 0); }
    $$('#tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === (name === 'trades' ? 'activity' : name)));
    if (prev && prev.split('/')[0] !== name) view.innerHTML = '';
    try {
      if (name === 'home') await viewHome();
      else if (name === 'agents') await viewAgents();
      else if (name === 'activity') await viewActivity();
      else if (name === 'trades') await viewTrades();
      else if (name === 'account') await viewAccount(arg);
      else if (name === 'coin') await viewCoin(decodeURIComponent(arg));
      else if (name === 'audit') await viewAudit(arg ? decodeURIComponent(arg) : null);
      else { location.hash = '#/home'; }
    } catch (e) { handleErr(e); }
  }
  function handleErr(e) {
    if (e instanceof Locked) { lockedScreen(); return; }
    if (e.soft) { toast(e.message); return; }
    banner(e);
    if (!view.innerHTML.trim() || $('.sk')) {/* keep skeleton: never a blank screen */}
  }
  window.addEventListener('hashchange', route);

  /* refresh loop + retry with backoff */
  async function tick() {
    while (true) {
      await sleep(S.offline ? S.retry * 1000 : 5000);
      if (document.hidden) continue;
      const r = S.route || '';
      try {
        if (r === 'home') await refreshHome();
        else if (r === 'agents') await viewAgents();
        else if (r.startsWith('coin/')) await viewCoin(decodeURIComponent(r.slice(5)));
        else if (r === 'activity' && window.scrollY < 50) await viewActivity();
        else if (r === 'trades' && window.scrollY < 50 && !(S.tr && S.tr.closed && S.tr.closed.length > 50)) await viewTrades();
        else await api('/api/state').then(st => S.state = st);
      } catch (e) {
        if (e instanceof Locked) { lockedScreen(); continue; }
        if (S.offline) S.retry = Math.min(30, S.retry * 2);
        if (!e.soft) banner(e);
      }
    }
  }

  /* SSE over fetch (so the token stays in a header, never in a URL) */
  let refreshT = null;
  const soon = () => { clearTimeout(refreshT); refreshT = setTimeout(() => { if (S.route === 'home') refreshHome().catch(() => {}); }, 400); };
  function onEvent(kind, data) {
    if (kind === 'signal' && data.status !== 'skipped' && data.status !== 'missed') { S.exec = { start: Date.now(), mode: data.mode, mint: data.mint }; paintExec(); }
    if (kind === 'fill') { if (S.exec) S.exec.filled = true; else S.exec = { filled: true }; paintExec(); setTimeout(() => { S.exec = null; }, 8000); }
    if (kind === 'audit_layer' || kind === 'audit') onAuditEvent(kind, data);
    if (S.route === 'home') soon();
    if (S.route === 'coin/' + data.mint && (kind === 'fill' || kind === 'exit')) viewCoin(data.mint).catch(() => {});
  }
  async function stream() {
    while (true) {
      try {
        const r = await fetch('/api/stream', { headers: { Authorization: 'Bearer ' + token() }, cache: 'no-store' });
        if (r.status === 401) return;
        const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
        while (true) {
          const { value, done } = await rd.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const ev = (chunk.match(/^event: (.*)$/m) || [])[1]; const dt = (chunk.match(/^data: (.*)$/m) || [])[1];
            if (ev && dt) { try { onEvent(ev, JSON.parse(dt)); } catch (_) {} }
          }
        }
      } catch (_) {}
      await sleep(3000);
    }
  }

  if (!token()) { lockedScreen(); return; }
  route().then(() => { tick(); stream(); });
  api('/api/account').then(a => { S.account = a; S.trail = null; }).catch(() => {});
})();
