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
