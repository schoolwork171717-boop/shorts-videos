// act.js: acting helpers for cut-out people. Everything is a pure function of film time t, so any frame renders the
// same no matter where a render segment starts.
//
//   keys(t, [[t0, v0], [t1, v1], ...], dur, ease)  hold each value, then blend into the next one over `dur` s starting
//                                                  at its time. v = number or array (arm poses [shoulder, elbow], ...)
//   face(t, [[t0, 'neutral'], [t1, 'shock'], ...], dur)  -> { mood, from, mk }  spread into toon.set() for a smooth change
//   alive(t, seed, amt)   -> { look, blink, tilt, bob }  never-still micro acting: eye darts, blinks, head sway, breath
//   pop(t, t0, dur)       0 -> 1 with a springy overshoot (props appearing, text popping in)
//   jolt(t, t0, dur, amp) a quick decaying wobble (reaction hits, impacts)
//   hop(t, t0, dur, h)    a little jump arc (0 at both ends)
//   beatsOf(words, from, to) word start times in [from, to) for "act on every word" timing
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eo = (x) => 1 - Math.pow(1 - x, 3);
export const back = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mixV = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k);

export function keys(t, list, dur = 0.25, ease = back) {
  if (!list.length) return 0;
  let i = 0; while (i + 1 < list.length && t >= list[i + 1][0]) i++;
  if (t < list[0][0] || i === 0 && list.length === 1) return list[0][1];
  const [t0, v] = list[i]; const prev = i > 0 ? list[i - 1][1] : v;
  return mixV(prev, v, ease(clamp((t - t0) / dur)));
}

export function face(t, list, dur = 0.22) {
  let i = 0; while (i + 1 < list.length && t >= list[i + 1][0]) i++;
  const mood = list[i][1], from = i > 0 ? list[i - 1][1] : mood;
  return { mood, from, mk: clamp((t - list[i][0]) / dur) };
}

export function alive(t, seed = 0, amt = 1) {
  // eye darts: a new gaze target every 0.6-1.3 s, reached in 0.1 s
  const slot = (k) => { let tt = 0, n = 0; while (true) { const d = 0.6 + rnd(seed * 13 + n) * 0.7; if (tt + d > k) return [n, tt]; tt += d; n++; if (n > 4000) return [n, tt]; } };
  const [n, s0] = slot(t + seed * 0.37);
  const tgt = (j) => [(rnd(seed * 7 + j) - 0.5) * 1.3, (rnd(seed * 11 + j * 3) - 0.5) * 0.6];
  const kk = eo(clamp((t + seed * 0.37 - s0) / 0.1)), a = tgt(n - 1), b = tgt(n);
  const look = [(a[0] + (b[0] - a[0]) * kk) * amt, (a[1] + (b[1] - a[1]) * kk) * amt];
  // blinks every 2.2-3.8 s (sometimes a double blink)
  const per = 2.2 + rnd(seed) * 1.6, ph = (t + seed * 1.3) % per; const bl = ph < 0.11 ? 1 : (rnd(seed + Math.floor((t + seed * 1.3) / per)) > 0.75 && ph > 0.22 && ph < 0.31) ? 1 : 0;
  return { look, blink: bl, tilt: Math.sin(t * 1.4 + seed * 2.1) * 3.2 * amt + Math.sin(t * 0.53 + seed) * 2 * amt, bob: Math.sin(t * 3.4 + seed * 1.7) * 4.5 * amt };
}

export const pop = (t, t0, dur = 0.35) => (t < t0 ? 0 : back(clamp((t - t0) / dur)));
export const jolt = (t, t0, dur = 0.45, amp = 1) => (t < t0 || t > t0 + dur ? 0 : Math.sin((t - t0) * 38) * amp * (1 - (t - t0) / dur));
export const hop = (t, t0, dur = 0.4, h = 1) => (t < t0 || t > t0 + dur ? 0 : Math.sin(Math.PI * (t - t0) / dur) * h);
export const beatsOf = (words, from, to) => words.filter((w) => w.start >= from && w.start < to).map((w) => w.start);

/** swooshes on camera moves: call once at the end of buildShots. Every shot with trans 'zoom' / 'whip' (or swoosh: true)
 *  gets a swoosh just before it starts, panning with the whip direction; o.moves = [t, ...] adds one per fast camera move
 *  inside a shot (crane, orbit, push). Skips a time that already has a whoosh/swoosh within 0.25 s. */
export function autoSwoosh(shots, cue, cues) {
  const near = (t) => cues.some((c) => (c.type === 'whoosh' || c.type === 'swoosh') && Math.abs(c.t - t) < 0.25);
  shots.forEach((o, i) => {
    if (i > 0 && (o.trans === 'zoom' || o.trans === 'whip' || o.swoosh) && !near(o.at - 0.12)) cue(o.at - 0.12, 'swoosh', { gain: o.trans === 'whip' ? 0.9 : 0.75, sweep: o.trans === 'whip' ? -(o.whipDir ?? 1) * 0.8 : 0, dur: o.trans === 'whip' ? 0.42 : 0.55 });
    (o.moves || []).forEach((t) => { if (!near(t)) cue(t, 'swoosh', { gain: 0.6, sweep: 0.5, dur: 0.6 }); });
  });
}

/** body squash & stretch for a hop: returns sq (-1..1); put it in toon state as { sq } (act() maps it to mesh scale):
 *  squash on take-off and landing, stretch in the air */
export function squashHop(t, t0, dur = 0.4) {
  if (t < t0 - 0.08 || t > t0 + dur + 0.15) return 0;
  if (t < t0) return 0.6 * Math.sin(Math.PI * (t - t0 + 0.08) / 0.16);            // crouch before the jump
  if (t < t0 + dur) return -0.5 * Math.sin(Math.PI * (t - t0) / dur);               // stretch in the air
  return 0.7 * Math.sin(Math.PI * (t - t0 - dur) / 0.15);                           // land
}
/** apply a squash value to a Toon (feet stay planted): call after set() */
export function applySquash(p, sq = 0) { p.mesh.scale.set(1 + sq * 0.14, 1 - sq * 0.14, 1); }
/** a lantern flicker multiplier (0.85..1.1) */
export const flicker = (t, seed = 0) => 1 + Math.sin(t * 13 + seed) * 0.05 + Math.sin(t * 7.3 + seed * 2) * 0.04 + Math.sin(t * 29 + seed * 5) * 0.02;

/** anime-smooth arm: shoulder springs to each key, the elbow follows 70 ms later with a softer, bigger overshoot
 *  (overlapping action), plus a constant gentle sway so arms are never frozen. list = [[t0, [shoulder, elbow]], ...] */
export function arm(t, list, { seed = 0, lag = 0.07, dur = 0.3 } = {}) {
  const s = keys(t, list, dur, back), e = keys(t - lag, list, dur * 1.25, (x) => { const c = 2.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); });
  return [s[0] + Math.sin(t * 2.1 + seed) * 2.5, e[1] + Math.sin(t * 2.6 + seed * 1.7) * 4];
}
/** an idle arm pose that breathes (use when a shot doesn't pose the arm) */
export const idleArm = (t, seed = 0, side = 1) => [10 + Math.sin(t * 2.1 + seed + side) * 3, 8 + Math.sin(t * 2.6 + seed * 1.3 + side) * 5];

// ───────────── kit v8: bodies that never stop (matched to the reference channel) ─────────────
const rnd8 = (i, seed) => { const x = Math.sin(i * 127.1 + seed * 311.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
const GESTURES = [[70, 80], [100, 40], [45, 110], [125, 25], [85, 95], [60, 125], [110, 60]];
/** the performance layer: talking bounce, weight shift, head sway, breathing and a talking-hands gesture every
 *  ~0.8-1.3 s (upper arm leads with overshoot, forearm follows). k = energy (0 still, 1 normal, 1.6 hyped).
 *  Spread it into a Toon state, then override anything the beat needs: { ...A.perform(t, p.seed), mood, armR: ... }.
 *  Returns { bob, lean, tilt, squash, armL, armR, dx } (dx = metres of sideways weight shift for the position). */
export function perform(t, seed = 0, k = 1, { talk = 1, gestures = true } = {}) {
  const per = 0.8 + rnd8(1, seed) * 0.5, off = rnd8(2, seed) * per, n = Math.floor((t + off) / per);
  const list = (side) => { const L = []; for (let i = n - 2; i <= n + 1; i++) { const p = rnd8(i + 7, seed), s = p < 0.42 ? -1 : p < 0.84 ? 1 : 0; const g = GESTURES[Math.floor(rnd8(i + 11, seed) * GESTURES.length)];
      const on = gestures && (s === side || s === 0) && rnd8(i + 13, seed) < 0.8; const t0 = i * per - off;
      L.push([t0, on ? [g[0] * (0.75 + 0.25 * k), g[1]] : [12 + rnd8(i, seed) * 8, 10 + rnd8(i + 3, seed) * 14]]); L.push([t0 + per * 0.55, [12, 12]]); } return L; };
  const armL = arm(t, list(-1), { seed, dur: 0.28 }), armR = arm(t, list(1), { seed: seed + 3, dur: 0.28 });
  const talkB = Math.abs(Math.sin(t * Math.PI * 2 * 2.05 + seed)) * talk;
  return {
    bob: -talkB * 7 * k + Math.sin(t * 1.8 + seed) * 2 * k,
    lean: Math.sin(t * Math.PI * 2 * 0.33 + seed) * 2.6 * k + Math.sin(t * Math.PI * 2 * 0.9 + seed * 2) * 0.8 * k,
    tilt: Math.sin(t * Math.PI * 2 * 0.47 + seed * 2) * 4.5 * k,
    squash: (Math.sin(t * Math.PI * 2 * 0.28 + seed) * 0.02 + talkB * 0.03) * k,
    armL, armR, dx: Math.sin(t * Math.PI * 2 * 0.21 + seed) * 0.035 * k,
  };
}
/** big body reactions on a beat (t0), blend out after dur. Spread after perform(): { ...A.perform(..), ...A.react('laugh', t, t0) } */
export function react(type, t, t0, dur = 0.9) {
  if (t < t0 || t > t0 + dur) return {};
  const x = (t - t0) / dur, k = Math.sin(Math.PI * Math.min(1, x * 1.4)) * (1 - x * 0.3), w = t - t0;
  switch (type) {
    case 'laugh': return { lean: -9 * k, bob: Math.sin(w * 56) * 6 * k, tilt: Math.sin(w * 28) * 6 * k, armL: [35, 115], armR: [35, 115], squash: Math.abs(Math.sin(w * 28)) * 0.05 * k };
    case 'angry': return { dx: Math.sin(w * 88) * 0.025 * k, bob: Math.abs(Math.sin(w * 18)) * -10 * k, armL: [150, 40], armR: [150, 40], squash: 0.06 * k };
    case 'shock': return { hopY: hop(t, t0, 0.35, 0.16), squash: -0.12 * k, armL: [150, -15], armR: [150, -15], lean: -4 * k };
    case 'shrug': return { armL: [110, -70], armR: [110, -70], bob: -10 * k, tilt: 9 * k };
    case 'proud': return { lean: -7 * k, armL: [38, 128], armR: [38, 128], squash: -0.04 * k };
    case 'sad': return { lean: 7 * k, bob: 12 * k, armL: [4, 4], armR: [4, 4], tilt: -6 * k };
    case 'point': return { armR: [95, -5], lean: 5 * k };
    case 'cheer': return { armL: [165, 10], armR: [165, 10], hopY: hop(t, t0, 0.4, 0.12), squash: squashHop(t, t0, 0.4) };
  }
  return {};
}
/** one long, continuous camera move through many framings (the reference channel rarely cuts):
 *  keys = [[time, [x, y, z] position, [x, y, z] look-at, fov?], ...]; smooth Catmull-Rom path, eased at the ends.
 *  returns { pos: [x, y, z], look: [x, y, z], fov } */
export function camPath(t, keys) {
  if (t <= keys[0][0]) return { pos: keys[0][1], look: keys[0][2], fov: keys[0][3] ?? 42 };
  const N = keys.length; if (t >= keys[N - 1][0]) return { pos: keys[N - 1][1], look: keys[N - 1][2], fov: keys[N - 1][3] ?? 42 };
  let i = 0; while (i < N - 2 && t > keys[i + 1][0]) i++;
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), s = u * u * (3 - 2 * u) * 0.5 + u * 0.5;   // soft ease, never stops dead mid-path
  const cr = (j) => { const a = keys[Math.max(0, i - 1)][j], b = keys[i][j], c = keys[i + 1][j], d = keys[Math.min(N - 1, i + 2)][j];
    return b.map((_, q) => { const p0 = a[q], p1 = b[q], p2 = c[q], p3 = d[q], s2 = s * s, s3 = s2 * s; return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3); }); };
  const f0 = keys[i][3] ?? 42, f1 = keys[i + 1][3] ?? 42;
  return { pos: cr(1), look: cr(2), fov: f0 + (f1 - f0) * s };
}

// v9.2 frameFix(cam, toons, { extras }): keeps every on-screen head (hat included) and every sign whole, SMOOTHLY.
// Anchors come from each person's position + height (not the wobbling cut-out), weights are fixed from the camera as
// it was aimed, and the fix is one continuous dolly-back (only as much as the spread needs, max +80%) plus a truck,
// so the correction can never jump between frames (v9.1 stepped the dolly and flickered).
function frameFixRaw(cam, toons, { mx = 0.84, top = 0.9, bottom = -0.82, maxBack = 0.8, extras = [] } = {}) {
  const V = cam.position.constructor;
  cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const sets = [];   // [{ pts: world points[], w }]
  for (const p of toons) {
    if (!p.group.visible || !p.group.parent || !p.H) continue; p.group.updateMatrixWorld(true);
    const H = p.H, W = H / 2, off = H * 24 / 1024; let pts;
    if (p.flat) pts = [[0, 0.995], [-0.26, 0.9], [0.26, 0.9], [-0.26, 0.7], [0.26, 0.7]].map(([x, y]) => p.mesh.localToWorld(new V(x * W, y * H - off, 0)));
    else { const g = new V(); p.group.getWorldPosition(g); const s = p.group.scale.y; const r = new V(1, 0, 0).applyQuaternion(cam.quaternion).multiplyScalar(0.26 * W * s);
      const yT = g.y + (0.995 * H - off) * s, yH = g.y + (0.88 * H - off) * s, yB = g.y + (0.68 * H - off) * s;
      pts = [new V(g.x, yT, g.z), new V(g.x, yH, g.z).add(r), new V(g.x, yH, g.z).sub(r), new V(g.x, yB, g.z).add(r), new V(g.x, yB, g.z).sub(r)]; }
    sets.push({ pts, kx: 1.0, ky: 1.0 });
  }
  for (const o of extras) {
    if (!o.visible || !o.parent) continue; o.updateMatrixWorld(true); const mn = new V(9e9, 9e9, 9e9), mxv = new V(-9e9, -9e9, -9e9);
    o.traverse((m) => { if (!m.isMesh || !m.geometry) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const g = m.geometry.boundingBox;
      for (let i = 0; i < 8; i++) { const v = new V(i & 1 ? g.max.x : g.min.x, i & 2 ? g.max.y : g.min.y, i & 4 ? g.max.z : g.min.z).applyMatrix4(m.matrixWorld); mn.min(v); mxv.max(v); } });
    const pts = []; for (let i = 0; i < 8; i++) if (i & 2) pts.push(new V(i & 1 ? mxv.x : mn.x, mxv.y, i & 4 ? mxv.z : mn.z));
    sets.push({ pts, kx: 0.75, ky: 0.95, sign: true });
  }
  // weights from the camera as aimed (fixed for the whole fix -> no feedback flicker)
  const proj = (v) => v.clone().project(cam);
  const live = [];
  for (const s of sets) { const q = s.pts.map(proj); if (q.some((v) => v.z > 1 || v.z < -1)) continue;
    const cx = q.reduce((a, v) => a + v.x, 0) / q.length, cy = q.reduce((a, v) => a + v.y, 0) / q.length;
    const w = 1 - clamp((Math.max(Math.abs(cx) - s.kx, Math.abs(cy) - s.ky) - 0.05) / 0.35); if (w > 0) live.push({ ...s, w }); }
  if (!live.length) return;
  const bounds = () => { let minX = 9, maxX = -9, minY = 9, maxY = -9; for (const s of live) { const q = s.pts.map(proj), cx = q.reduce((a, v) => a + v.x, 0) / q.length, cy = q.reduce((a, v) => a + v.y, 0) / q.length;
      for (const v of q) { const x = cx + (v.x - cx) * 1 + (v.x - cx) * 0, xx = v.x * s.w + cx * (1 - s.w), yy = v.y * s.w + cy * (1 - s.w); minX = Math.min(minX, xx); maxX = Math.max(maxX, xx); if (!s.sign) minY = Math.min(minY, yy); maxY = Math.max(maxY, yy); } }
    if (minY > 8) minY = maxY; return { minX, maxX, minY, maxY }; };
  const fwd = new V(); cam.getWorldDirection(fwd);
  const anchor = new V(); live.forEach((s) => s.pts.forEach((p) => anchor.add(p))); anchor.multiplyScalar(1 / live.reduce((a, s) => a + s.pts.length, 0));
  const dist = Math.max(0.5, anchor.clone().sub(cam.position).dot(fwd));
  // 1) continuous dolly-back if the spread doesn't fit
  let b = bounds(); const need = Math.max(1, (b.maxX - b.minX) / (2 * mx), (b.maxY - b.minY) / (top - bottom));
  if (need > 1) { const back = Math.min(maxBack, need - 1) * dist; cam.position.addScaledVector(fwd, -back); cam.updateMatrixWorld(true); }
  // 2) truck (two continuous passes)
  for (let it = 0; it < 2; it++) {
    b = bounds(); let dx = 0, dy = 0;
    if (b.maxX > mx) dx = b.maxX - mx; if (b.minX < -mx) dx = b.minX + mx; if (b.maxX - b.minX > 2 * mx) dx = (b.maxX + b.minX) / 2;
    if (b.maxY > top) dy = b.maxY - top; else if (b.minY < bottom) dy = b.minY - bottom;
    const d = Math.max(0.5, anchor.clone().sub(cam.position).dot(fwd)), hh = Math.tan((cam.fov * Math.PI) / 360) * d, ww = hh * cam.aspect;
    const right = new V(1, 0, 0).applyQuaternion(cam.quaternion), up = new V(0, 1, 0).applyQuaternion(cam.quaternion);
    cam.position.addScaledVector(right, dx * ww).addScaledVector(up, dy * hh); cam.updateMatrixWorld(true);
  }
}

// v9.3 frameFix = a pre-computed, SMOOTHED framing pass. `node tools/capture.mjs framing` draws the film every 0.1 s with
// the raw fix, records how far it moved the camera, Gaussian-smooths that per shot and writes data/framing.json; renders
// then add the smoothed offset, so the camera glides instead of popping. Without the table (sheets before the pass) the
// raw fix is used. shoot() must pass { t, key: shotId }.
let FRAMING;
const loadFraming = () => { if (FRAMING !== undefined) return FRAMING; FRAMING = null;
  try { if (typeof XMLHttpRequest === 'undefined') return null; const x = new XMLHttpRequest(); x.open('GET', 'data/framing.json?' + Date.now(), false); x.send(); if (x.status === 200) FRAMING = JSON.parse(x.responseText); } catch (e) { FRAMING = null; }
  return FRAMING; };
export function frameFix(cam, toons, opts = {}) {
  const q = typeof location !== 'undefined' ? location.search : '';
  if (q.includes('nofix')) return;
  const rec = q.includes('framerec'), t = opts.t, key = opts.key ?? '_';
  const tab = rec ? null : loadFraming();
  if (tab && t != null) { const a = tab[key]; if (!a || !a.length) return;
    let i = 0; while (i < a.length - 1 && a[i + 1][0] <= t) i++;
    const p = a[i], n = a[Math.min(i + 1, a.length - 1)], k = n[0] > p[0] ? clamp((t - p[0]) / (n[0] - p[0])) : 0;
    cam.position.x += p[1] + (n[1] - p[1]) * k; cam.position.y += p[2] + (n[2] - p[2]) * k; cam.position.z += p[3] + (n[3] - p[3]) * k; cam.updateMatrixWorld(true); return; }
  const p0 = cam.position.clone(); frameFixRaw(cam, toons, opts);
  if (rec && t != null) (globalThis.__FREC ||= []).push([key, +(+t).toFixed(3), cam.position.x - p0.x, cam.position.y - p0.y, cam.position.z - p0.z]);
}
