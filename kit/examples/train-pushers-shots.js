// TOKYO HIRED PEOPLE TO SHOVE YOU ONTO TRAINS: the shot list (Iron Canyon / Tall Tale engine v6, kit v7 voice).
// Rush-hour Tokyo: trains packed past twice their size, doors that won't close, white-gloved student "pushers" (oshiya)
// shoving backs, shoulders and bags until the doors shut and the train leaves on time. Twist: New York subway guards
// did it first (1918). Loop: back to a packed train... and a gloved hand on your back.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, eob, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as TK from './core/tokyo.js';
import * as A from './core/act.js';
import { Toon, INK } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = (a, b, k) => a.clone().lerp(b, k);
const drift = (x) => 0.65 * x + 0.35 * eio(x);
let NOW = 0;

const SUIT = { body: '#22325E', pattern: 'jacket', patCol: '#16224A', hat: 'workcap', hatCol: '#1B2648', gloves: true, neck: 'tie', neckCol: '#E9B23C' };
const LOOK = {
  pushA: { ...SUIT, extra: ['blush'] },                                       // the student pusher (hero)
  pushB: { ...SUIT, extra: ['glasses'] },
  sal1: { body: '#5A6478', neck: 'tie', neckCol: '#C8372E', extra: ['glasses'] },
  sal2: { body: '#2E3A55', neck: 'tie', neckCol: '#3FA58C', hair: '#2A2028', extra: [] },
  sal3: { body: '#8A6AA8', neck: 'tie', neckCol: '#F2C230', extra: ['mustache'], mustacheCol: '#2A2028' },
  girl: { body: '#2A3A6A', neck: 'scarf', neckCol: '#D8343F', hair: '#2A2028', hairSide: 0, extra: ['blush'] },
  lady: { body: '#C8607E', hat: 'bun', hatCol: '#8A8A98', extra: ['glasses'] },
  teen: { body: '#F2B233', hat: 'beanie', hatCol: '#3FA58C', extra: ['freckles'] },
  nyG: { body: '#2A3350', pattern: 'jacket', patCol: '#1A2240', hat: 'workcap', hatCol: '#1F2440', extra: ['mustache'], mustacheCol: '#3A2A22' },
  ny1: { body: '#6B4A3A', hat: 'bowler', hatCol: '#2A2028', neck: 'bowtie', neckCol: '#C8372E', extra: ['mustache'], mustacheCol: '#3A2A22' },
  ny2: { body: '#8A6A4A', hat: 'boater', hatCol: '#E8D49A', neck: 'collar', extra: [] },
  ny3: { body: '#3E5A7A', hat: 'cap', hatCol: '#5A4A3A', extra: ['beard'], mustacheCol: '#6A4A2A' },
};
const make = (k, seed, res = 2) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res }); p.seed = seed; return p; };

// cut-out props
const P2 = {
  bag: (g, x, y) => { g.save(); g.translate(x, y + 40); g.strokeStyle = INK; g.lineWidth = 6; g.fillStyle = '#7A4A2E'; g.beginPath(); g.roundRect(-46, 0, 92, 70, 10); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-18, 0); g.quadraticCurveTo(0, -36, 18, 0); g.stroke(); g.fillStyle = '#E9B23C'; g.fillRect(-8, 26, 16, 10); g.restore(); },
  phone: (g, x, y) => { g.save(); g.translate(x, y - 20); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#2A2A33'; g.beginPath(); g.roundRect(-16, -30, 32, 60, 6); g.fill(); g.stroke(); g.fillStyle = '#8FD8FF'; g.fillRect(-11, -24, 22, 44); g.restore(); },
};

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); if (!o.noMotes) FX.motes(t, { n: o.motes ?? 30, col: o.moteCol || '255,226,170', size: 1.1 }); if (o.shafts) FX.shafts(t, { k: o.shafts, x: o.shaftX ?? CW * 0.2, angle: o.shaftA ?? -0.35, col: o.shaftCol || '255,214,160' }); }; S.push(o); return o; };
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.05);
  const cam = camera(40);
  const toScreen = (v) => { const q = v.clone().project(cam); return [(q.x + 1) / 2 * CW, (1 - q.y) / 2 * CH]; };
  const headXY = (p, up = 1.62) => toScreen(p.group.position.clone().add(V3(0, up, 0)));
  const LK = { bloom: 0.3, bloomThreshold: 0.96, aperture: 0.0007, maxblur: 0.007 };
  const shoot = (scene, people, p, a, look = LK, shake = 0, t = NOW, fov = 40) => {
    const f = look.fov || fov; if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix(); }
    cam.position.copy(p); if (shake) cam.position.add(V3(Math.sin(t * 61) * shake, Math.cos(t * 47) * shake, Math.sin(t * 53) * shake * 0.5));
    const fl = look.float ?? 1; cam.position.add(V3(Math.sin(t * 0.9) * 0.05 * fl, Math.sin(t * 1.3 + 1) * 0.035 * fl, Math.sin(t * 0.7 + 2) * 0.04 * fl));
    cam.lookAt(a); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.012 * fl); cam.fov = f * (1 - Math.sin(t * 0.8) * 0.012 * fl); cam.updateProjectionMatrix();
    people.forEach((q) => q.face(cam)); E.render(scene, cam, { ...look, focus: look.focus ?? cam.position.distanceTo(a), t });
  };
  const act = (p, x, z, o = {}, y = 0) => {
    const al = A.alive(NOW, p.seed, o.alive ?? 1); p.group.visible = true;
    p.at(x, y + (o.hopY || 0), z).set({ look: al.look, blink: al.blink, tilt: al.tilt, bob: o.legs === 'walk' || o.legs === 'run' ? 0 : al.bob, armL: A.idleArm(NOW, p.seed, -1), armR: A.idleArm(NOW, p.seed, 1), ...o }); A.applySquash(p, o.sq || 0);
  };
  const big = (txt, x, y, s, k, col = '#FFFFFF', rot = 0) => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.font = `900 ${s}px Nunito, Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = s * 0.2; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
  const burst = (x, y, t, k, col = '255,230,150') => { if (k <= 0 || k >= 1) return; ctx.save(); ctx.strokeStyle = `rgba(${col},${1 - k})`; ctx.lineWidth = 12 * (1 - k); ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r0 = 40 + k * 120, r1 = r0 + 60 * (1 - k); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); } ctx.restore(); };
  const qmark = (x, y, k, t) => big('?', x, y + Math.sin(t * 6) * 6, 130, k, '#FFD15C', Math.sin(t * 4) * 0.15);
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });
  const lines = (t, w, dur = 0.6) => { if (t > w && t < w + dur) FX.speedLines(t, 1 - (t - w) / dur); };

  // ── sets + cast ──
  const TKY = TK.station(E, { era: 'tokyo' }), NY = TK.station(E, { era: 'ny' });
  const pushA = make('pushA', 1), pushB = make('pushB', 2), sal1 = make('sal1', 3), sal2 = make('sal2', 4), sal3 = make('sal3', 5), girl = make('girl', 6), lady = make('lady', 7, 1), teen = make('teen', 8);
  const nyG = make('nyG', 9), ny1 = make('ny1', 10), ny2 = make('ny2', 11), ny3 = make('ny3', 12, 1);
  const all = [pushA, pushB, sal1, sal2, sal3, girl, lady, teen, nyG, ny1, ny2, ny3];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const sunXY = () => toScreen(cam.position.clone().add(V3(-0.55, 0.07, -1).normalize().multiplyScalar(300)));

  // the hero door is the middle car's middle door at x = 0 (opening x -0.65..0.65, wall z -1.75)
  // ── S01 · hook: a white glove shoves a salaryman into a packed doorway (SHOVE!) ──
  { const st = cut(0), sh = Wd('shoving', 0), tr = Wd('train', 0);
    add({ id: 'S01', at: st, shafts: 0.7, note: '3/4 close on the hero door: packed commuters inside, pusher shoves a salaryman in on "shoving"; SHOVE! + speed lines', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA, sal1, sal2, girl, sal3); TKY.update(t, { doorK: 1, trainX: 0 });
      const k = eio(clamp((t - sh + 0.15) / 0.35));
      act(girl, -0.35, -2.25, { ...A.face(t, [[0, 'worried'], [sh + 0.05, 'dizzy']]), eyeS: 1.1, sq: 0.15 + A.jolt(t, sh + 0.05, 0.4, 0.25) });
      act(sal2, 0.35, -2.15, { ...A.face(t, [[0, 'tired'], [sh + 0.05, 'shock']]), armR: [40, 60], holdR: P2.phone, sq: 0.18 + A.jolt(t, sh + 0.05, 0.4, 0.25) });
      act(sal3, 0.0, -2.5, { mood: 'strain', sq: 0.2 });
      act(sal1, lerp(0.15, 0.05, k), lerp(-1.25, -1.75, k), { ...A.face(t, [[0, 'neutral'], [sh - 0.3, 'worried'], [sh + 0.05, 'shock']]), armR: A.arm(t, [[0, [20, 30]], [sh, [140, 10]]]), armL: A.arm(t, [[0, [10, 10]], [sh, [130, 20]]]), lean: -10 * k, sq: A.jolt(t, sh, 0.4, 0.3), holdL: P2.bag });
      act(pushA, lerp(0.95, 0.7, k), lerp(-0.55, -0.95, k), { ...A.face(t, [[0, 'strain'], [sh + 0.1, 'proud']]), armL: A.arm(t, [[0, [40, 40]], [sh - 0.12, [70, 50]], [sh, [92, 0]]]), armR: A.arm(t, [[0, [20, 40]], [sh, [-30, 70]]]), lean: -14 * k });
      const push = clamp((t - st) / d);
      shoot(TKY.scene, [pushA, sal1, sal2, girl, sal3], mix(V3(2.4, 1.55, 2.2), V3(1.7, 1.5, 1.4), drift(push)), V3(0.15, 1.25, -1.4), { ...LK, fov: 42 }, A.jolt(t, sh, 0.45, 0.05), t);
      blit(); lines(t, sh); big('SHOVE!', 560, 470, 170, A.pop(t, sh), '#FFD15C', -0.1); burst(380, 900, t, clamp((t - sh) / 0.45));
    } });
    cue(sh, 'thud', { gain: 0.8 }); cue(sh, 'boing', { gain: 0.4 }); cue(sh + 0.02, 'pop', { gain: 0.5 }); cue(tr, 'tock', { gain: 0.3 }); }

  // ── S02 · "In Tokyo, that job is real!" vast sunrise station, train sweeping in, petals + godray ──
  { const st = cut(1), tk = Wd('tokyo', 1), re = Wd('real', 1);
    add({ id: 'S02', at: st, trans: 'whip', shafts: 1.0, shaftX: CW * 0.15, note: 'crane down over the sunrise platform as the train sweeps in from the right; skyline + cherry trees; TOKYO pops; godray', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA, pushB, lady, sal2); const k = clamp(lt / d);
      TKY.update(t, { doorK: 0, trainX: lerp(60, 4, eo(clamp(lt / (d * 0.95)))) });
      act(pushA, -1.5, 0.2, { mood: 'happy', armR: A.arm(t, [[0, [10, 10]], [re - 0.2, [150, 30]]]) });
      act(pushB, -0.4, 0.6, { mood: 'content', armL: [20, 10] });
      act(lady, lerp(4, 1.6, k), 1.2, { mood: 'neutral', legs: 'walk', phase: t * 7 });
      act(sal2, lerp(5.5, 2.4, k), 2.0, { mood: 'tired', legs: 'walk', phase: t * 7 + 1, holdR: P2.bag, armR: [10, 10] });
      shoot(TKY.scene, [pushA, pushB, lady, sal2], mix(V3(1.0, 7.0, 15), V3(0.4, 2.6, 9.5), drift(k)), mix(V3(-3, 1.5, -6), V3(-0.6, 1.6, -1), drift(k)), { ...LK, fov: 46, aperture: 0 });
      blit(); const [sx, sy] = sunXY(); FX.godray(clamp(sx, 0, CW), clamp(sy, 0, CH), t, { k: 0.75 }); FX.petals(t, { n: 34 }); FX.orbs(t, { k: 0.7 });
      big('TOKYO', 540, 360, 160, A.pop(t, tk), '#FFFFFF', -0.04); big('IT\'S REAL!', 540, 520, 96, A.pop(t, re), '#FFD15C', 0.05);
    } });
    cue(st + 0.1, 'whoosh', { gain: 0.5 }); cue(tk, 'sparkle', { gain: 0.6 }); cue(re, 'pop', { gain: 0.6 }); }

  // ── S03 · "When rush hour got crazy," commuters stampede, the clock spins to 8 ──
  { const st = cut(2), ru = Wd('rush', 2), cr = Wd('crazy', 2);
    add({ id: 'S03', at: st, trans: 'zoom', note: 'tracking shot: a wave of commuters hurries left along the platform, the pillar clock spins forward; RUSH HOUR!', draw(lt, d, t, blit) {
      hideAll(); const ps = [sal1, sal2, sal3, girl, lady, teen]; into(TKY.scene, ...ps); TKY.update(t, { doorK: 0, trainX: 4 });
      TKY.clock.set(7.2 + 0.75 * eio(clamp(lt / d)));
      const k = clamp(lt / d);
      ps.forEach((p, i) => act(p, 3.4 - i * 0.6 - k * 3.2, 0.4 + (i % 3) * 0.75, { mood: i % 2 ? 'worried' : 'tired', legs: 'run', phase: t * 11 + i, armR: [40 + 20 * Math.sin(t * 11 + i), 40], armL: [40 - 20 * Math.sin(t * 11 + i), 40], lean: -8, holdR: i === 1 ? P2.bag : null }));
      shoot(TKY.scene, ps, V3(2.4 - k * 2.6, 1.8, 7.0), V3(1.9 - k * 2.6, 1.5, 0.8), { ...LK, fov: 46 });
      blit(); FX.speedLines(t, 0.35, CW * 0.8, CH * 0.45); big('RUSH HOUR!', 540, 380, 130, A.pop(t, ru), '#FFD15C', -0.06);
      if (t > cr) { const [x, y] = headXY(lady, 1.9); FX.sweat(x + 40, y, clamp((t - cr) / 0.3)); }
    } });
    cue(st, 'whoosh', { gain: 0.6 }); cue(ru, 'pop', { gain: 0.6 }); cue(cr, 'boing', { gain: 0.4 }); }

  // ── S04 · "trains carried more than twice the people they were built for." packed doorway + 2X ──
  { const st = cut(3), tw = Wd('twice', 3), bu = Wd('built', 3);
    add({ id: 'S04', at: st, trans: 'whip', whipDir: -1, shafts: 0.5, note: 'push in on a jam-packed car: faces squashed on the glass, people stuffed in the doorway; 2X pops on "twice"', draw(lt, d, t, blit) {
      hideAll(); const ps = [sal1, sal2, girl, sal3, lady]; into(TKY.scene, ...ps); TKY.update(t, { doorK: 1, trainX: 0 });
      const sq = 0.22 + Math.sin(t * 5) * 0.04;
      act(sal3, -0.45, -2.45, { mood: 'strain', sq }); act(lady, 0.45, -2.5, { mood: 'dizzy', sq });
      act(girl, -0.25, -2.05, { ...A.face(t, [[0, 'worried'], [tw, 'shock']]), sq: sq + A.jolt(t, tw, 0.4, 0.15) });
      act(sal2, 0.3, -1.95, { ...A.face(t, [[0, 'tired'], [tw + 0.1, 'dizzy']]), armR: [150, 10], holdR: P2.bag, sq });
      act(sal1, 0.0, -1.7, { ...A.face(t, [[0, 'strain'], [bu, 'worried']]), armL: [100, 40], armR: [100, 40], sq: sq + 0.05 });
      const k = drift(clamp(lt / d));
      shoot(TKY.scene, ps, mix(V3(-0.6, 1.75, 3.4), V3(0.05, 1.5, 1.6), k), mix(V3(-0.5, 1.5, -1.9), V3(0.0, 1.35, -2.0), k), { ...LK, fov: 44 });
      blit(); big('2X', 540, 420, 220, A.pop(t, tw), '#FF6A5A', -0.08); big('PACKED!', 540, 610, 100, A.pop(t, bu), '#FFFFFF', 0.04); FX.orbs(t, { k: 0.4, col: '255,200,150' });
    } });
    cue(tw, 'slam', { gain: 0.5 }); cue(tw + 0.05, 'pop', { gain: 0.6 }); cue(bu, 'gulp', { gain: 0.5 }); }

  // ── S05 · "The doors couldn't even close!" doors slam on a bag and bounce open ──
  { const st = cut(4), cl = Wd('close', 4), dr = Wd('doors', 4);
    add({ id: 'S05', at: st, trans: 'zoom', note: 'tight on the doorway: the doors slide in, BONK on the bag sticking out, bounce open again, worried faces', draw(lt, d, t, blit) {
      hideAll(); const ps = [sal1, sal2, girl]; into(TKY.scene, ...ps);
      const hit1 = dr + 0.15, hit2 = cl;
      const dk = t < hit1 ? lerp(1, 0.38, eio(clamp((t - st) / (hit1 - st)))) : t < hit2 - 0.25 ? lerp(0.38, 0.7, eo(clamp((t - hit1) / 0.25))) : t < hit2 ? lerp(0.7, 0.38, eio(clamp((t - hit2 + 0.25) / 0.25))) : lerp(0.38, 0.65, eo(clamp((t - hit2) / 0.3)));
      TKY.update(t, { doorK: dk, trainX: 0 });
      act(girl, -0.2, -2.15, { ...A.face(t, [[0, 'worried'], [hit1, 'shock'], [hit2 + 0.2, 'sad']]), sq: 0.2 });
      act(sal2, 0.25, -2.1, { ...A.face(t, [[0, 'tired'], [hit1, 'dizzy']]), sq: 0.2 + A.jolt(t, hit1, 0.4, 0.2) });
      act(sal1, 0.0, -1.62, { ...A.face(t, [[0, 'worried'], [hit1, 'shock'], [hit2, 'angry']]), armR: [95, -10], holdR: P2.bag, armL: A.arm(t, [[0, [20, 20]], [hit2, [140, 30]]]), sq: A.jolt(t, hit1, 0.35, 0.25) + A.jolt(t, hit2, 0.35, 0.25) });
      shoot(TKY.scene, ps, V3(0.15, 1.45, 2.0), V3(0.05, 1.25, -1.7), { ...LK, fov: 40 }, A.jolt(t, hit1, 0.35, 0.04) + A.jolt(t, hit2, 0.35, 0.05), t);
      blit(); big('BONK!', 300, 560, 120, A.pop(t, hit1), '#FFD15C', -0.15); big('BONK!', 780, 700, 130, A.pop(t, hit2), '#FF8A5A', 0.12); burst(540, 1000, t, clamp((t - hit2) / 0.4));
    } });
    cue(st + 0.15, 'slide', { gain: 0.5 }); cue(dr + 0.15, 'thud', { gain: 0.7 }); cue(cl, 'thud', { gain: 0.8 }); cue(cl + 0.05, 'boing', { gain: 0.5 }); }

  // ── S06 · "So stations hired pushers." two pushers march in, godray behind them ──
  { const st = cut(5), pu = Wd('pushers', 5);
    add({ id: 'S06', at: st, trans: 'zoom', shafts: 1, shaftX: CW * 0.25, note: 'low angle: two white-gloved pushers stride in from the right in step, stop, tug their caps; sun bursts behind; PUSHERS!', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA, pushB); TKY.update(t, { doorK: 1, trainX: 0 });
      const stop = st + 0.65, w = eo(clamp((t - st) / (stop - st)));
      const walking = t < stop;
      act(pushA, lerp(2.6, -0.4, w), 0.0, { ...A.face(t, [[0, 'content'], [pu, 'proud']]), legs: walking ? 'walk' : 'stand', phase: t * 8, armR: A.arm(t, [[0, [20, 10]], [pu - 0.1, [150, -40]]]), armL: [15, 10] });
      act(pushB, lerp(3.6, 0.6, w), 0.3, { ...A.face(t, [[0, 'content'], [pu + 0.08, 'smug']]), legs: walking ? 'walk' : 'stand', phase: t * 8 + 3, armL: A.arm(t, [[0, [20, 10]], [pu, [150, -40]]]), armR: [15, 10] });
      const k = drift(clamp(lt / d));
      shoot(TKY.scene, [pushA, pushB], mix(V3(0.2, 0.7, 4.6), V3(0.1, 0.9, 3.9), k), V3(0.1, 1.55, 0), { ...LK, fov: 44 });
      blit(); FX.godray(540, 760, t, { k: 0.6 + A.pop(t, pu) * 0.3 }); FX.sparkle(420, 1060, t, A.pop(t, pu)); FX.sparkle(690, 1080, t, A.pop(t, pu + 0.1));
      big('PUSHERS!', 540, 340, 140, A.pop(t, pu), '#FFFFFF', -0.05);
    } });
    cue(pu, 'sparkle', { gain: 0.7 }); cue(pu, 'pop', { gain: 0.5 }); }

  // ── S07 · "Mostly students, in neat uniforms" close on the grinning student pusher ──
  { const st = cut(6), su = Wd('students', 6), un = Wd('uniforms', 6), cutB = Wd('bright', 6) - 0.25;
    add({ id: 'S07', at: st, trans: 'whip', shafts: 0.7, note: 'head-and-torso on the student pusher: gulps, grins, straightens his tie, tugs his cap on "uniforms"; STUDENTS pops', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA, girl); TKY.update(t, { doorK: 0, trainX: 0 });
      act(girl, 1.3, -1.1, { mood: 'happy', armR: [40, 60], holdR: P2.phone });
      act(pushA, 0.0, 0.0, { ...A.face(t, [[0, 'gasp'], [su, 'happy'], [un, 'proud']]), armR: A.arm(t, [[0, [10, 10]], [su + 0.1, [60, 110]], [un, [150, -40]]]), armL: A.arm(t, [[0, [10, 10]], [un + 0.1, [70, 100]]]), tilt: -5 });
      const k = drift(clamp(lt / d));
      shoot(TKY.scene, [pushA, girl], mix(V3(0.5, 1.5, 3.0), V3(0.3, 1.45, 2.3), k), V3(0.05, 1.3, 0), { ...LK, fov: 40, aperture: 0.0014 });
      blit(); big('STUDENTS', 540, 330, 130, A.pop(t, su), '#FFD15C', -0.04); FX.orbs(t, { k: 0.6 });
    } });
    cue(su, 'pop', { gain: 0.6 }); cue(un, 'zip', { gain: 0.4 });

  // ── S08 · "and bright white gloves." macro on the gloves snapping on, sparkles ──
    const gl = Wd('gloves', 6);
    add({ id: 'S08', at: cutB, trans: 'zoom', shafts: 0.6, note: 'macro on the gloves: hands come together, the glove tugs tight, a sparkle ping on "gloves"; pushB behind grins', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushB, pushA); TKY.update(t, { doorK: 0, trainX: 0 });
      act(pushB, 0, 0, { ...A.face(t, [[0, 'smug'], [gl, 'excited']]), armL: A.arm(t, [[0, [60, 90]], [gl - 0.1, [80, 100]], [gl + 0.1, [150, 20]]]), armR: A.arm(t, [[0, [60, 90]], [gl - 0.05, [75, 95]], [gl + 0.12, [150, 20]]]) });
      act(pushA, -1.3, -1.0, { mood: 'happy' });
      const k = drift(clamp(lt / d));
      shoot(TKY.scene, [pushB, pushA], mix(V3(0.1, 1.2, 1.7), V3(0.05, 1.45, 2.3), k), mix(V3(0, 1.05, 0), V3(0, 1.35, 0), k), { ...LK, fov: 36, aperture: 0.0016 });
      blit(); const [hx, hy] = headXY(pushB, 0.95); FX.sparkle(hx - 120, hy - 80, t, A.pop(t, gl), 90); FX.sparkle(hx + 130, hy - 60, t, A.pop(t, gl + 0.08), 80); FX.orbs(t, { k: 0.9, col: '255,250,230' });
      big('WHITE GLOVES', 540, 360, 110, A.pop(t, gl), '#FFFFFF', 0.04);
    } });
    cue(gl, 'sparkle', { gain: 0.8 }); cue(gl - 0.1, 'zip', { gain: 0.4 }); }

  // ── S09 · "They pushed backs, shoulders and bags, until everyone fit." the push montage ──
  { const st = cut(7), w1 = Wd('backs', 7), w2 = Wd('shoulders', 7), w3 = Wd('bags', 7), fit = Wd('fit', 7);
    add({ id: 'S09', at: st, trans: 'whip', shafts: 0.6, note: '3/4 at the doorway: both pushers shove on each word: a back, a shoulder, a bag; commuters squash in; IT FITS!', draw(lt, d, t, blit) {
      hideAll(); const ps = [pushA, pushB, sal1, sal2, sal3, girl]; into(TKY.scene, ...ps); TKY.update(t, { doorK: 1, trainX: 0 });
      const hit = (w) => A.jolt(t, w, 0.35, 1);
      const inK = (w) => eio(clamp((t - w) / 0.3));
      act(girl, -0.3, -2.3, { mood: 'dizzy', sq: 0.2 + Math.abs(hit(w2)) * 0.2 }); act(sal3, 0.3, -2.4, { mood: 'strain', sq: 0.2 + Math.abs(hit(w1)) * 0.2 });
      act(sal1, lerp(-0.2, -0.15, inK(w1)), lerp(-1.4, -1.95, inK(w1)), { ...A.face(t, [[0, 'worried'], [w1, 'shock'], [fit, 'dizzy']]), sq: Math.abs(hit(w1)) * 0.35, lean: -8 * inK(w1) });
      act(sal2, lerp(0.35, 0.3, inK(w2)), lerp(-1.35, -1.9, inK(w2)), { ...A.face(t, [[0, 'tired'], [w2, 'shock'], [w3 + 0.1, 'sad']]), armR: [100, 0], holdR: P2.bag, sq: Math.abs(hit(w2)) * 0.35 });
      act(pushA, lerp(-0.4, -0.3, inK(w1)), lerp(-0.6, -1.0, inK(w1)), { ...A.face(t, [[0, 'strain'], [w1 + 0.15, 'proud'], [fit, 'happy']]), armL: A.arm(t, [[0, [50, 40]], [w1, [100, -5]], [w1 + 0.35, [60, 40]], [w3, [100, -5]]]), armR: A.arm(t, [[0, [50, 40]], [w1, [100, -5]], [w1 + 0.35, [60, 40]], [w3, [100, -5]]]), lean: -12 * inK(w1) });
      act(pushB, lerp(0.75, 0.65, inK(w2)), lerp(-0.55, -0.95, inK(w2)), { ...A.face(t, [[0, 'strain'], [w2 + 0.15, 'smug'], [fit, 'laugh']]), armL: A.arm(t, [[0, [50, 40]], [w2, [100, -5]], [w2 + 0.35, [60, 40]], [w3 + 0.05, [100, -5]]]), armR: A.arm(t, [[0, [50, 40]], [w2, [100, -5]], [w3 + 0.05, [100, -5]]]), lean: -12 * inK(w2) });
      const k = drift(clamp(lt / d)), sh = (hit(w1) + hit(w2) + hit(w3)) * 0.04;
      shoot(TKY.scene, ps, mix(V3(2.3, 1.6, 2.4), V3(1.6, 1.5, 1.7), k), V3(0.1, 1.2, -1.3), { ...LK, fov: 44 }, Math.abs(sh), t);
      blit(); [w1, w2, w3].forEach((w) => lines(t, w));
      big('BACKS!', 300, 380, 110, A.pop(t, w1), '#FFD15C', -0.12); big('SHOULDERS!', 640, 520, 100, A.pop(t, w2), '#FFFFFF', 0.08); big('BAGS!', 360, 660, 120, A.pop(t, w3), '#FF8A5A', -0.06);
      big('IT FITS!', 540, 1180, 110, A.pop(t, fit), '#7CF2A0', 0.03);
    } });
    [w1, w2, w3].forEach((w) => { cue(w, 'thud', { gain: 0.7 }); cue(w + 0.02, 'gulp', { gain: 0.35 }); }); cue(fit, 'sparkle', { gain: 0.5 }); }

  // ── S10 · "Then the doors closed," doors glide shut, pushers bow ──
  { const st = cut(8), dc = Wd('closed', 8);
    add({ id: 'S10', at: st, trans: 'zoom', note: 'the doors glide shut on the squashed faces; the pushers bow politely', draw(lt, d, t, blit) {
      hideAll(); const ps = [pushA, pushB, sal1, sal2]; into(TKY.scene, ...ps);
      TKY.update(t, { doorK: 1 - eio(clamp((t - dc + 0.35) / 0.45)), trainX: 0 });
      act(sal1, -0.2, -1.95, { mood: 'dizzy', sq: 0.25 }); act(sal2, 0.3, -2.0, { mood: 'tired', sq: 0.25 });
      const bow = A.keys(t, [[0, 0], [dc + 0.1, 22], [dc + 0.75, 0]], 0.3);
      act(pushA, -0.5, 0.2, { mood: 'content', lean: bow, armL: [8, 6], armR: [8, 6] }); act(pushB, 0.55, 0.35, { mood: 'content', lean: bow * 0.9, armL: [8, 6], armR: [8, 6] });
      const k = drift(clamp(lt / d));
      shoot(TKY.scene, ps, mix(V3(0.3, 1.55, 3.8), V3(0.2, 1.5, 3.2), k), V3(0.05, 1.25, -1.2), { ...LK, fov: 46 });
      blit(); FX.sparkle(540, 720, t, A.pop(t, dc + 0.1), 70);
    } });
    cue(dc - 0.3, 'slide', { gain: 0.6 }); cue(dc + 0.1, 'tock', { gain: 0.5 }); }

  // ── S11 · "and the train left right on time." the train whooshes off; clock on the dot; ON TIME! ──
  { const st = Wd('train', 8) - 0.3, ti = Wd('time', 8);
    add({ id: 'S11', at: st, trans: 'whip', shafts: 0.9, shaftX: CW * 0.15, note: 'wide down the platform: the train streaks off left with speed lines, the clock hits 8:00, pushers wave; RIGHT ON TIME!', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA, pushB); const k = clamp(lt / d);
      TKY.update(t, { doorK: 0, trainX: -Math.pow(k, 2) * 55 }); TKY.clock.set(8.0);
      act(pushA, -0.6, 0.7, { mood: 'happy', armR: A.arm(t, [[0, [20, 10]], [st + 0.2, [150, 30]], [st + 0.45, [130, 60]], [st + 0.7, [150, 30]], [st + 0.95, [130, 60]]]) });
      act(pushB, 0.5, 1.1, { mood: 'proud', armL: [150, 20] });
      shoot(TKY.scene, [pushA, pushB], mix(V3(0.8, 1.7, 6.6), V3(0.4, 2.0, 7.2), drift(k)), mix(V3(-1.0, 1.7, -0.5), V3(-1.6, 2.0, -1.0), drift(k)), { ...LK, fov: 46, aperture: 0 });
      blit(); FX.speedLines(t, 0.5 + k * 0.4, CW * 0.1, CH * 0.45); FX.petals(t, { n: 22, wind: 2.5 });
      big('RIGHT ON TIME!', 540, 360, 110, A.pop(t, ti), '#7CF2A0', -0.05);
    } });
    cue(st, 'whoosh', { gain: 0.9 }); cue(ti, 'ding', { gain: 0.8 }); }

  // ── S12 · "But here's the twist." the pusher freezes mid-wave, looks at you ──
  { const st = cut(9), tw = Wd('twist', 9);
    add({ id: 'S12', at: st, cut: true, swoosh: true, note: 'snap zoom on the student pusher frozen mid-wave; his eyes slide to camera; skeptical; ? pops', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA); TKY.update(t, { doorK: 0, trainX: -60 });
      act(pushA, 0, 0.3, { ...A.face(t, [[0, 'happy'], [st + 0.15, 'gasp'], [tw, 'skeptic']]), armR: [150, 30], look: [0, 0], alive: 0.2, tilt: 8 });
      const k = eo(clamp(lt / 0.3));
      shoot(TKY.scene, [pushA], mix(V3(0.3, 1.6, 3.6), V3(0.1, 1.6, 1.9), k), V3(0, 1.5, 0.3), { ...LK, fov: 38, float: 0.4 });
      blit(); FX.vignetteGlow(0.5, '90,120,255'); const [x, y] = headXY(pushA, 1.95); qmark(x + 150, y - 40, A.pop(t, tw), t);
    } });
    cue(st, 'tock', { gain: 0.7 }); cue(tw, 'pop', { gain: 0.5 }); }

  // ── S13 · "Japan didn't invent this job." pusher shrugs, NOT JAPAN?! ──
  { const st = cut(10), inv = Wd('invent', 10);
    add({ id: 'S13', at: st, trans: 'whip', shafts: 0.6, note: 'medium two-shot: the pushers shrug big, palms up, the other one points off frame; NOT JAPAN?!', draw(lt, d, t, blit) {
      hideAll(); into(TKY.scene, pushA, pushB); TKY.update(t, { doorK: 0, trainX: -60 });
      act(pushA, -0.45, 0.2, { ...A.face(t, [[0, 'skeptic'], [inv, 'shock']]), armL: A.arm(t, [[0, [10, 10]], [st + 0.2, [110, -70]]]), armR: A.arm(t, [[0, [10, 10]], [st + 0.25, [110, -70]]]), hopY: A.hop(t, inv, 0.3, 0.12), sq: A.squashHop(t, inv, 0.3) });
      act(pushB, 0.55, 0.5, { ...A.face(t, [[0, 'neutral'], [inv + 0.1, 'sly']]), armR: A.arm(t, [[0, [10, 10]], [inv, [100, 0]]]) });
      shoot(TKY.scene, [pushA, pushB], mix(V3(0.3, 1.55, 4.4), V3(0.2, 1.5, 3.6), drift(clamp(lt / d))), V3(0.05, 1.35, 0.3), { ...LK, fov: 42 });
      blit(); big('NOT JAPAN?!', 540, 380, 130, A.pop(t, inv), '#FFD15C', -0.05);
    } });
    cue(inv, 'boing', { gain: 0.5 }); cue(inv, 'pop', { gain: 0.5 }); }

  // ── S14 · "Long before Tokyo, New York subway guards..." a 1918 underground platform, warm bulbs ──
  { const st = cut(11), nw = Wd('new', 11), gu = Wd('guards', 11);
    add({ id: 'S14', at: st, trans: 'zoom', motes: 40, moteCol: '255,214,150', note: 'crane down into a tiled 1918 New York subway: maroon cars, bowler hats, a mustached guard steps up; NEW YORK pops', draw(lt, d, t, blit) {
      hideAll(); const ps = [nyG, ny1, ny2, ny3]; into(NY.scene, ...ps); NY.update(t, { doorK: 1, trainX: 0 });
      act(ny1, lerp(-2.2, -0.5, clamp(lt / d)), -0.9, { mood: 'neutral', legs: 'walk', phase: t * 7 });
      act(ny2, 0.6, -0.7, { mood: 'content', holdR: P2.bag, armR: [10, 10] });
      act(ny3, 1.5, 0.6, { mood: 'tired' });
      act(nyG, 1.0, 0.1, { ...A.face(t, [[0, 'neutral'], [gu, 'smug']]), armR: A.arm(t, [[0, [10, 10]], [gu, [150, -40]]]) });
      const k = drift(clamp(lt / d));
      shoot(NY.scene, ps, mix(V3(-0.5, 4.0, 7.0), V3(0.2, 1.7, 4.2), k), mix(V3(0, 1.0, -2), V3(0.2, 1.3, -0.6), k), { ...LK, fov: 44 });
      blit(); FX.orbs(t, { k: 0.9, col: '255,210,140' }); big('NEW YORK', 540, 340, 140, A.pop(t, nw), '#FFFFFF', -0.04); big('LONG BEFORE!', 540, 480, 90, A.pop(t, st + 0.15), '#FFD15C', 0.04);
    } });
    cue(nw, 'sparkle', { gain: 0.6 }); }

  // ── S15 · "...shoved crowds onto trains too!" the guard shoves bowler hats into the car ──
  { const st = Wd('shoved', 11) - 0.25, sv = Wd('shoved', 11), too = Wd('too', 11);
    add({ id: 'S15', at: st, trans: 'whip', note: '3/4 at an old car door: the guard plants both hands and SHOVES two hatted men in; speed lines', draw(lt, d, t, blit) {
      hideAll(); const ps = [nyG, ny1, ny2, ny3]; into(NY.scene, ...ps); NY.update(t, { doorK: 1, trainX: 0 });
      const k = eio(clamp((t - sv) / 0.35));
      act(ny3, 0.0, -2.35, { mood: 'dizzy', sq: 0.2 });
      act(ny1, lerp(-0.1, -0.15, k), lerp(-1.3, -1.95, k), { ...A.face(t, [[0, 'worried'], [sv, 'shock']]), hopY: A.hop(t, sv, 0.3, 0.1), sq: A.jolt(t, sv, 0.4, 0.3) });
      act(ny2, lerp(0.4, 0.3, k), lerp(-1.2, -1.85, k), { ...A.face(t, [[0, 'neutral'], [sv + 0.05, 'shock']]), holdR: P2.bag, armR: [110, 0], sq: A.jolt(t, sv + 0.05, 0.4, 0.3) });
      act(nyG, lerp(0.95, 0.75, k), lerp(-0.45, -0.85, k), { ...A.face(t, [[0, 'strain'], [too, 'laugh']]), armL: A.arm(t, [[0, [50, 40]], [sv, [98, -5]]]), armR: A.arm(t, [[0, [50, 40]], [sv, [-40, 80]]]), lean: -14 * k });
      shoot(NY.scene, ps, mix(V3(2.4, 1.6, 2.2), V3(1.8, 1.5, 1.6), drift(clamp(lt / d))), V3(0.15, 1.25, -1.4), { ...LK, fov: 42 }, A.jolt(t, sv, 0.45, 0.05), t);
      blit(); lines(t, sv, 0.7); big('SHOVE!', 540, 420, 160, A.pop(t, sv), '#FFD15C', 0.08); big('TOO!', 760, 640, 110, A.pop(t, too), '#FFFFFF', -0.1);
    } });
    cue(sv, 'thud', { gain: 0.8 }); cue(sv, 'boing', { gain: 0.4 }); cue(too, 'pop', { gain: 0.5 }); }

  // ── S16 · "So next time your train feels packed," a teen squeezed on a modern car, relieved ──
  { const st = cut(12), pk = Wd('packed', 12), gd = Wd('glad', 12);
    add({ id: 'S16', at: st, trans: 'whip', whipDir: -1, shafts: 0.8, note: 'back in Tokyo: a teen squeezed in the doorway between salarymen, phone up, sighs with relief', draw(lt, d, t, blit) {
      hideAll(); const ps = [teen, sal1, sal2, girl]; into(TKY.scene, ...ps); TKY.update(t, { doorK: 1, trainX: 0 });
      act(sal1, -0.45, -2.2, { mood: 'tired', sq: 0.18 }); act(sal2, 0.45, -2.15, { mood: 'neutral', sq: 0.18 }); act(girl, 0.0, -2.5, { mood: 'dizzy', sq: 0.2 });
      act(teen, 0.0, -1.7, { ...A.face(t, [[0, 'worried'], [pk, 'dizzy'], [gd, 'content']]), armR: [40, 70], holdR: P2.phone, sq: 0.12 + A.jolt(t, pk, 0.4, 0.15) });
      const k = drift(clamp(lt / d));
      shoot(TKY.scene, ps, mix(V3(0.25, 1.5, 2.6), V3(0.15, 1.45, 1.9), k), V3(0.0, 1.3, -1.8), { ...LK, fov: 40 });
      blit(); big('PACKED?', 540, 380, 120, A.pop(t, pk), '#FFFFFF', -0.05); FX.orbs(t, { k: 0.5 });
      if (t > gd) { const [x, y] = headXY(teen, 1.9); FX.sparkle(x + 110, y - 40, t, A.pop(t, gd), 50); }
    } });
    cue(pk, 'gulp', { gain: 0.5 }); cue(gd, 'sparkle', { gain: 0.4 }); }

  // ── S17 · "just be glad nobody's paid to push you." ...a white glove lands on the teen's back (loop) ──
  { const st = Wd('nobody', 12) - 0.2, pa = Wd('paid', 12), pu = Wd('push', 12);
    add({ id: 'S17', at: st, trans: 'zoom', shafts: 0.7, note: 'wider: behind the relieved teen the student pusher creeps in with a scheming grin, gloves up... and on "push" plants them on his back (loops to the hook)', draw(lt, d, t, blit) {
      hideAll(); const ps = [teen, pushA, sal1, sal2]; into(TKY.scene, ...ps); TKY.update(t, { doorK: 1, trainX: 0 });
      act(sal1, -0.45, -2.2, { mood: 'tired', sq: 0.18 }); act(sal2, 0.45, -2.15, { mood: 'neutral', sq: 0.18 });
      act(teen, 0.05, -1.55, { ...A.face(t, [[0, 'content'], [pu + 0.05, 'shock']]), armR: [40, 70], holdR: P2.phone, sq: A.jolt(t, pu + 0.05, 0.4, 0.3) });
      const cr = eio(clamp((t - st) / 0.7));
      act(pushA, lerp(1.6, 0.75, cr), lerp(0.4, -0.95, cr), { ...A.face(t, [[0, 'scheme'], [pu + 0.1, 'laugh']]), armL: A.arm(t, [[0, [60, 60]], [pa, [80, 40]], [pu, [95, 0]]]), armR: A.arm(t, [[0, [60, 60]], [pu, [-30, 70]]]), lean: -10 * clamp((t - pu) / 0.2) });
      shoot(TKY.scene, ps, mix(V3(2.2, 1.6, 2.6), V3(1.7, 1.5, 1.8), drift(clamp(lt / d))), V3(0.25, 1.3, -1.2), { ...LK, fov: 42 }, A.jolt(t, pu + 0.05, 0.4, 0.04), t);
      blit(); lines(t, pu, 0.5);
      if (t < pu) { const [x, y] = headXY(pushA, 1.95); FX.sparkle(x - 60, y + 260, t, A.pop(t, pa), 50); }
    } });
    cue(pa, 'tock', { gain: 0.4 }); cue(pu + 0.05, 'thud', { gain: 0.7 }); cue(pu + 0.05, 'boing', { gain: 0.4 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
