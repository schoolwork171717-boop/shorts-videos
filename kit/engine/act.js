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
