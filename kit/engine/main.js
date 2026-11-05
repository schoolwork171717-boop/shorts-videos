// Boot: fonts → script + timing → 3D engine + sets → captions → shots. draw(t) renders film time t (pure function of t):
// the shot renders its 3D frame into the hidden WebGL canvas, which is copied onto the 2D canvas, then the 2D layer
// (labels, counters) and the captions go on top. window.OP is the API tools/capture.mjs drives.
import { W, H, setCtx, ctx, clamp } from './core/lib.js';
import { T, loadTiming } from './core/timing.js';
import { buildCaptions, drawCaption, captionList } from './core/captions.js';
import { makeEngine, RES, AA } from './core/engine.js';
import { buildShots } from './shots.js';

const cv = document.getElementById('cv'), GL = document.getElementById('gl');
setCtx(cv.getContext('2d'));
const OP = (window.OP = { ready: false });

let TMP = null, CUR = null;
function draw(t) {
  t = clamp(t, 0, T.dur - 1e-4);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
  const S = OP._shots; let i = S.length - 1; while (i > 0 && S[i].at > t) i--;
  const sh = S[i], end = i < S.length - 1 ? S[i + 1].at : T.dur, d = end - sh.at, lt = t - sh.at;
  const blit = () => ctx.drawImage(GL, 0, 0, W, H);
  // soft cross-dissolve into each new shot (Ricks-style flow); a shot with cut: true starts with a hard cut instead
  const X = sh.dissolve ?? OP.dissolve ?? 0.3; let mixK = 1;
  if (i > 0 && lt < X && !sh.cut) {
    const p = S[i - 1], pd = sh.at - p.at;
    ctx.save(); p.draw(pd + lt, pd, t, blit); ctx.restore();
    if (!TMP) { TMP = document.createElement('canvas'); TMP.width = W; TMP.height = H; }
    TMP.getContext('2d').drawImage(cv, 0, 0); mixK = lt / X;
  }
  ctx.save(); sh.draw(lt, d, t, blit); ctx.restore();
  // transitions: 'dissolve' (default), 'zoom' (punch through: old frame rushes at you, new one settles in), 'whip' (fast
  // smeared pan). Pick per shot with sh.trans, film-wide with OP.trans.
  const TR = sh.trans ?? OP.trans ?? 'dissolve';
  if (mixK < 1 && TR === 'dissolve') { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - mixK * mixK * (3 - 2 * mixK); ctx.drawImage(TMP, 0, 0); ctx.restore(); }
  else if (mixK < 1) {
    if (!CUR) { CUR = document.createElement('canvas'); CUR.width = W; CUR.height = H; }
    CUR.getContext('2d').drawImage(cv, 0, 0); const e = mixK * mixK * (3 - 2 * mixK);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (TR === 'zoom') {
      const s1 = 1 + 0.16 * (1 - e); ctx.globalAlpha = 1; ctx.drawImage(CUR, W / 2 - W * s1 / 2, H / 2 - H * s1 / 2, W * s1, H * s1);
      const s0 = 1 + 0.45 * e; ctx.globalAlpha = 1 - e; ctx.drawImage(TMP, W / 2 - W * s0 / 2, H / 2 - H * s0 / 2, W * s0, H * s0);
    } else {
      const dir = sh.whipDir ?? 1, ox = (1 - e) * W * 0.55 * dir, px = -e * W * 0.55 * dir;
      for (let j = 4; j >= 0; j--) { ctx.globalAlpha = (j ? 0.16 : 1) * (1 - 0.25 * j / 4); ctx.drawImage(CUR, ox + j * 26 * (1 - e) * dir, 0); }
      for (let j = 4; j >= 0; j--) { ctx.globalAlpha = (j ? 0.16 : 1) * (1 - e); ctx.drawImage(TMP, px - j * 26 * e * dir, 0); }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
  const fade = Math.min(clamp(t / 0.25), clamp((T.dur - t) / 0.4));
  if (fade < 1) { ctx.fillStyle = '#000'; ctx.globalAlpha = 1 - fade; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawCaption(t);
}

(async () => {
  try {
    await document.fonts.load('900 100px Inter'); await document.fonts.load('800 100px Inter');
    const script = await (await fetch('script.json', { cache: 'no-store' })).json();
    await loadTiming();
    buildCaptions(script);
    GL.width = Math.round(1080 * RES); GL.height = Math.round(1920 * RES);
    const E = makeEngine(GL, { w: GL.width, h: GL.height, samples: AA });
    const { shots, cues } = buildShots(E);
    shots.sort((a, b) => a.at - b.at);
    OP._shots = shots; OP.script = script;
    OP.duration = () => T.dur;
    OP.draw = draw;
    OP.frame = (t, q = 0.92) => { draw(t); return cv.toDataURL('image/jpeg', q); };
    OP.shots = () => shots.map((s, i) => ({ id: s.id, at: +s.at.toFixed(3), end: +(i < shots.length - 1 ? shots[i + 1].at : T.dur).toFixed(3), note: s.note || '' }));
    OP.captions = () => captionList().map((c) => ({ s: +c.s.toFixed(3), e: +c.e.toFixed(3), text: c.words.map((w) => (w.hi ? '*' : '') + w.txt).join(' ') }));
    OP.cues = () => cues.slice().sort((a, b) => a.t - b.t);
    OP.ready = true;
    const q = new URLSearchParams(location.search);
    if (!q.has('capture')) {
      if (q.has('t')) draw(+q.get('t'));
      else {
        const audio = new Audio('data/mix.wav'); let t0 = null; const btn = document.getElementById('play'); btn.hidden = false;
        btn.onclick = () => { btn.hidden = true; t0 = performance.now(); audio.currentTime = 0; audio.play().catch(() => {}); };
        const loop = (now) => { const t = t0 == null ? 0 : (now - t0) / 1000; draw(t); if (t0 != null && t > T.dur) { t0 = null; btn.hidden = false; } requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      }
    }
  } catch (e) { OP.bootError = String(e && e.stack || e); console.error(e); }
})();
