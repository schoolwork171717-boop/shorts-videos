// WHY JAILS PAINTED THEIR CELLS BUBBLEGUM PINK: the shot list (Iron Canyon / Tall Tale engine v6, kit v7 voice).
// A scientist stares at a pink card and his heart slows; a Navy jail paints a holding cell Baker-Miller pink; furious
// new prisoners calm in 15 minutes; jails everywhere (and one football coach's visitors' locker room) go pink.
// Twist: retests found the calm wears off and a gray cell works just as well. Loop: "maybe, for fifteen minutes".
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, eob, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as PS from './core/pinkset.js';
import * as A from './core/act.js';
import { Toon, INK } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = (a, b, k) => a.clone().lerp(b, k);
const drift = (x) => 0.65 * x + 0.35 * eio(x);
let NOW = 0;

const ORANGE = { body: '#F07A2A', pattern: 'plain' };
const LOOK = {
  con1: { ...ORANGE, hair: '#2A2028', extra: ['beard'], beardCol: '#4A3226' },          // the hero prisoner
  con2: { ...ORANGE, hat: 'beanie', hatCol: '#3A3A48', extra: ['mustache'], mustacheCol: '#2A2028' },
  sci: { body: '#F4F4F8', pattern: 'jacket', patCol: '#D2D2E0', neck: 'tie', neckCol: '#3C6FB6', hair: '#8A5A3A', extra: ['glasses'] },
  sci2: { body: '#F4F4F8', pattern: 'jacket', patCol: '#D2D2E0', neck: 'bowtie', neckCol: '#8A4FB8', hat: 'bun', hatCol: '#2A2028', extra: ['glasses'] },
  guard: { body: '#2A3350', pattern: 'jacket', patCol: '#1A2240', hat: 'workcap', hatCol: '#F4F4F4', neck: 'tie', neckCol: '#1A1A22', extra: ['mustache'], mustacheCol: '#3A2A22' },
  painter: { body: '#E8E4DC', pattern: 'overalls', patCol: '#3C6FB6', hat: 'cap', hatCol: '#FF91AF', extra: ['freckles'] },
  coach: { body: '#C8372E', pattern: 'jacket', patCol: '#9E2420', hat: 'visor', hatCol: '#F2C230', extra: ['mustache', 'glasses'], mustacheCol: '#8A8A98' },
  plA: { body: '#3FA58C', pattern: 'stripes', patCol: '#F4F4F4', extra: [] },
  plB: { body: '#3FA58C', pattern: 'stripes', patCol: '#F4F4F4', hair: '#2A2028', extra: ['freckles'] },
};
const make = (k, seed, res = 2) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res }); p.seed = seed; return p; };

const P2 = {
  card: (g, x, y) => { g.save(); g.translate(x, y - 70); g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = '#FF91AF'; g.beginPath(); g.roundRect(-70, -95, 140, 190, 10); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-58, -84, 30, 168); g.restore(); },
  clip: (g, x, y) => { g.save(); g.translate(x, y - 30); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#B07A48'; g.beginPath(); g.roundRect(-40, -55, 80, 110, 6); g.fill(); g.stroke(); g.fillStyle = '#F4F4F4'; g.fillRect(-32, -42, 64, 90); g.fillStyle = INK; for (let i = 0; i < 5; i++) g.fillRect(-24, -30 + i * 16, 40 - (i % 2) * 14, 4); g.fillStyle = '#C8C8D0'; g.fillRect(-14, -60, 28, 12); g.restore(); },
  roller: (g, x, y, a) => { g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -150); g.lineTo(40, -150); g.stroke(); g.fillStyle = '#FF91AF'; g.lineWidth = 5; g.beginPath(); g.roundRect(-20, -200, 110, 46, 14); g.fill(); g.stroke(); g.restore(); },
  whistle: (g, x, y) => { g.save(); g.translate(x, y - 10); g.strokeStyle = INK; g.lineWidth = 4; g.fillStyle = '#C8C8D0'; g.beginPath(); g.ellipse(0, 0, 18, 12, 0, 0, 7); g.fill(); g.stroke(); g.restore(); },
};

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); if (!o.noMotes) FX.motes(t, { n: o.motes ?? 26, col: o.moteCol || '255,220,235', size: 1.1 }); if (o.shafts) FX.shafts(t, { k: o.shafts, x: o.shaftX ?? CW * 0.7, angle: o.shaftA ?? 0.25, col: o.shaftCol || '255,220,230' }); }; S.push(o); return o; };
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.05);
  const cam = camera(40);
  const toScreen = (v) => { const q = v.clone().project(cam); return [(q.x + 1) / 2 * CW, (1 - q.y) / 2 * CH]; };
  const headXY = (p, up = 1.62) => toScreen(p.group.position.clone().add(V3(0, up, 0)));
  const LK = { bloom: 0.42, bloomThreshold: 0.92, aperture: 0.0007, maxblur: 0.007 };
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
  const qmark = (x, y, k, t) => big('?', x, y + Math.sin(t * 6) * 6, 130, k, '#FFD15C', Math.sin(t * 4) * 0.15);
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });
  const lines = (t, w, dur = 0.6) => { if (t > w && t < w + dur) FX.speedLines(t, 1 - (t - w) / dur); };
  // angry steam puffing from a head (2D)
  const steam = (x, y, t, k) => { if (k <= 0.01) return; ctx.save(); for (let i = 0; i < 6; i++) { const ph = (t * 1.6 + i / 6) % 1, s = i % 2 ? 1 : -1; const px = x + s * (90 + ph * 60), py = y - 40 - ph * 140; ctx.globalAlpha = k * (1 - ph) * 0.9; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, 18 + ph * 26, 0, 7); ctx.fill(); ctx.stroke(); } ctx.restore(); };
  // a heart-monitor line (2D); bpm sets the spacing of the beats
  const ecg = (x, y, w, h, t, bpm, k = 1) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(10,30,24,0.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.rect(x + 10, y + 10, w - 20, h - 20); ctx.clip(); ctx.strokeStyle = '#3CF0A0'; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.beginPath();
    const per = 60 / bpm, speed = 420; for (let px = 0; px <= w; px += 4) { const tt = t - (w - px) / speed, ph = ((tt % per) + per) % per / per; let v = 0; if (ph > 0.1 && ph < 0.14) v = -0.2; else if (ph >= 0.14 && ph < 0.18) v = 1; else if (ph >= 0.18 && ph < 0.22) v = -0.45; else if (ph > 0.35 && ph < 0.45) v = 0.18 * Math.sin((ph - 0.35) / 0.1 * Math.PI); const yy = y + h * 0.58 - v * h * 0.38; px ? ctx.lineTo(x + px, yy) : ctx.moveTo(x + px, yy); }
    ctx.stroke(); ctx.restore(); ctx.save(); ctx.globalAlpha = k; ctx.font = '900 46px Nunito, Inter'; ctx.fillStyle = '#3CF0A0'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(bpm)} BPM`, x + w - 26, y + 56); ctx.restore(); };
  const heart = (x, y, t, bpm, s = 1) => { const per = 60 / bpm, ph = (t % per) / per, b = 1 + 0.22 * Math.max(0, 1 - ph * 5); ctx.save(); ctx.translate(x, y); ctx.scale(s * b, s * b); ctx.fillStyle = '#FF5A7A'; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -40, -60, 0, -30); ctx.bezierCurveTo(40, -60, 60, -10, 0, 30); ctx.fill(); ctx.stroke(); ctx.restore(); };
  // a big 2D clock with a sweeping minute hand; m = minutes shown (0..60)
  const clock = (x, y, r, m, k = 1) => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,145,175,0.55)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 12, -Math.PI / 2, -Math.PI / 2 + m / 60 * Math.PI * 2); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(Math.sin(a) * (r - 14), -Math.cos(a) * (r - 14)); ctx.lineTo(Math.sin(a) * (r - 30), -Math.cos(a) * (r - 30)); ctx.stroke(); }
    const a = m / 60 * Math.PI * 2; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * (r - 40), -Math.cos(a) * (r - 40)); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); ctx.restore(); };

  // ── sets + cast ──
  const CELL = PS.cell(E, { start: 0 }), LAB = PS.lab(E), COR = PS.corridor(E), LOCK = PS.locker(E), TWIN = PS.twinCells(E);
  const con1 = make('con1', 1), con2 = make('con2', 2), sci = make('sci', 3), sci2 = make('sci2', 4), guard = make('guard', 5), painter = make('painter', 6), coach = make('coach', 7), plA = make('plA', 8, 1), plB = make('plB', 9, 1);
  const all = [con1, con2, sci, sci2, guard, painter, coach, plA, plB];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));

  // ── S01 · "Could one color calm down an angry prisoner?" gray cell -> PINK floods in ──
  { const st = cut(0), co = Wd('color', 0), ca = Wd('calm', 0), an = Wd('angry', 0), pr = Wd('prisoner', 0);
    add({ id: 'S01', at: st, shafts: 0.5, note: 'a furious prisoner stomps in a gray cell, steam pouring off; on "color" the walls flood bubblegum pink and he freezes mid-rage; ? on "prisoner"', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, con1); const pk = eio(clamp((t - co) / 0.45)); CELL.paint(pk, 0);
      const stomp = t < co ? Math.abs(Math.sin(t * 7)) : 0;
      act(con1, lerp(-0.5, 0.15, clamp(t / co)) * (t < co ? 1 : 1), -0.6, { ...A.face(t, [[0, 'angry'], [co + 0.05, 'shock'], [ca + 0.1, 'gasp'], [pr, 'skeptic']]), eyeS: 1.1, armL: A.arm(t, [[0, [40, 110]], [co, [150, 30]], [pr, [30, 90]]]), armR: A.arm(t, [[0, [40, 110]], [co + 0.05, [150, 30]], [pr, [30, 90]]]), legs: t < co ? 'walk' : 'stand', phase: t * 8, hopY: stomp * 0.06, sq: A.jolt(t, co, 0.4, 0.3) });
      const k = drift(clamp(lt / d));
      shoot(CELL.scene, [con1], mix(V3(0.3, 1.6, 3.4), V3(0.1, 1.5, 2.3), k), V3(0.05, 1.3, -0.6), { ...LK, fov: 42 }, t < co ? 0.012 : A.jolt(t, co, 0.4, 0.05), t);
      blit(); const [hx, hy] = headXY(con1, 1.75); steam(hx, hy, t, 1 - pk);
      if (t > co) { FX.godray(540, 760, t, { k: 0.6 * (1 - clamp((t - co - 0.8) / 1.2)), col: '255,180,210' }); FX.sparkle(320, 640, t, A.pop(t, co), 70); FX.sparkle(780, 520, t, A.pop(t, co + 0.1), 60); }
      big('PINK?!', 540, 330, 150, A.pop(t, co), '#FF91AF', -0.06); qmark(hx + 160, hy - 60, A.pop(t, pr), t);
    } });
    cue(0.05, 'thud', { gain: 0.35 }); cue(0.55, 'thud', { gain: 0.35 }); cue(co, 'sparkle', { gain: 0.8 }); cue(co, 'whoosh', { gain: 0.5 }); cue(pr, 'pop', { gain: 0.5 }); }

  // ── S02 · "A scientist thought so." the lab; a scientist pops in with a raised finger ──
  { const st = cut(1), sc = Wd('scientist', 1), th = Wd('thought', 1);
    add({ id: 'S02', at: st, trans: 'zoom', shafts: 0.6, shaftX: CW * 0.3, note: 'a teal colour lab with a wall of colour cards; the scientist pops up from behind the desk, finger raised, eyebrows up', draw(lt, d, t, blit) {
      hideAll(); into(LAB.scene, sci);
      act(sci, 0.0, -0.3, { ...A.face(t, [[0, 'neutral'], [sc, 'excited'], [th, 'smug']]), armR: A.arm(t, [[0, [10, 10]], [th - 0.1, [150, -30]]]), hopY: A.hop(t, sc - 0.1, 0.35, 0.18), sq: A.squashHop(t, sc - 0.1, 0.35) });
      const k = drift(clamp(lt / d));
      shoot(LAB.scene, [sci], mix(V3(0.6, 1.5, 3.6), V3(0.3, 1.55, 2.8), k), V3(0.0, 1.45, -0.6), { ...LK, fov: 42 });
      blit(); big('A SCIENTIST', 540, 340, 120, A.pop(t, sc), '#FFFFFF', -0.04); const [hx, hy] = headXY(sci, 1.95); FX.sparkle(hx + 140, hy - 40, t, A.pop(t, th), 60);
    } });
    cue(sc - 0.1, 'boing', { gain: 0.5 }); cue(sc, 'pop', { gain: 0.6 }); cue(th, 'ding', { gain: 0.5 }); }

  // ── S03 · "He stared at a bubblegum pink card," he holds up the pink card; pink orbs drift ──
  { const st = cut(2), bu = Wd('bubblegum', 2), ca = Wd('card', 2);
    add({ id: 'S03', at: st, trans: 'whip', shafts: 0.6, note: 'over-the-card: the scientist lifts a big pink card and stares into it, eyes going soft; pink glow and orbs; BUBBLEGUM PINK', draw(lt, d, t, blit) {
      hideAll(); into(LAB.scene, sci);
      act(sci, 0.0, -0.3, { ...A.face(t, [[0, 'neutral'], [bu, 'content']]), armR: A.arm(t, [[0, [20, 30]], [st + 0.2, [70, 70]]]), holdR: P2.card, look: [0.4, -0.1], alive: 0.3 });
      const k = drift(clamp(lt / d));
      shoot(LAB.scene, [sci], mix(V3(-0.4, 1.6, 2.8), V3(-0.25, 1.55, 2.0), k), V3(0.1, 1.45, -0.3), { ...LK, fov: 40, aperture: 0.0014 });
      blit(); FX.orbs(t, { k: 0.9, col: '255,150,190' }); FX.vignetteGlow(0.35, '255,120,170');
      big('BUBBLEGUM', 540, 330, 120, A.pop(t, bu), '#FF91AF', -0.04); big('PINK', 540, 470, 150, A.pop(t, bu + 0.15), '#FFFFFF', 0.04);
    } });
    cue(bu, 'sparkle', { gain: 0.6 }); cue(ca, 'pop', { gain: 0.4 }); }

  // ── S04 · "and his heartbeat slowed down!" the heart monitor slows; his face melts into calm ──
  { const st = cut(3), hb = Wd('heartbeat', 3), sl = Wd('slowed', 3);
    add({ id: 'S04', at: st, trans: 'zoom', note: 'close on the scientist going dreamy; a heart-monitor overlay: beats spread out, a pulsing heart slows; SLOWED DOWN!', draw(lt, d, t, blit) {
      hideAll(); into(LAB.scene, sci);
      act(sci, 0.0, -0.3, { ...A.face(t, [[0, 'content'], [sl, 'tired'], [sl + 0.5, 'content']]), armR: [70, 70], holdR: P2.card, alive: 0.4, tilt: lerp(0, 9, clamp((t - sl) / 0.8)) });
      const k = drift(clamp(lt / d));
      shoot(LAB.scene, [sci], mix(V3(-0.05, 1.7, 2.3), V3(-0.05, 1.7, 1.9), k), V3(-0.1, 1.55, -0.3), { ...LK, fov: 40 });
      const bpm = lerp(96, 58, eio(clamp((t - hb) / 1.4)));
      blit(); ecg(90, 1020, 900, 230, t, bpm, eo(clamp((t - st) / 0.25))); heart(880, 340, t, bpm, 1.5); big('SLOWED DOWN!', 470, 360, 110, A.pop(t, sl), '#3CF0A0', -0.05);
    } });
    cue(hb, 'heartbeat', { gain: 0.6 }); cue(hb + 0.7, 'heartbeat', { gain: 0.5 }); cue(sl + 0.4, 'heartbeat', { gain: 0.4 }); cue(sl, 'pop', { gain: 0.5 }); }

  // ── S05 · "So a Navy jail let him test it." down the cell block; the guard salutes, waves him in ──
  { const st = cut(4), na = Wd('navy', 4), te = Wd('test', 4);
    add({ id: 'S05', at: st, trans: 'whip', shafts: 0.4, note: 'dolly down a Navy cell block of steel doors; the white-capped guard salutes and swings an arm toward a cell; the scientist hurries in with his card; NAVY JAIL', draw(lt, d, t, blit) {
      hideAll(); into(COR.scene, guard, sci); for (let i = 0; i < 16; i++) COR.doorPink(i, 0);
      act(guard, 0.7, -1.0, { ...A.face(t, [[0, 'neutral'], [na, 'proud'], [te, 'smug']]), armR: A.arm(t, [[0, [10, 10]], [na - 0.1, [150, -70]], [te, [100, 0]]]) });
      act(sci, lerp(-1.4, -0.4, eo(clamp(lt / d))), 0.2, { mood: 'excited', legs: 'walk', phase: t * 8, armR: [70, 70], holdR: P2.card });
      const k = drift(clamp(lt / d));
      shoot(COR.scene, [guard, sci], mix(V3(0.2, 1.7, 4.8), V3(0.1, 1.6, 3.4), k), V3(0.1, 1.45, -1.2), { ...LK, fov: 44 });
      blit(); big('NAVY JAIL', 540, 340, 130, A.pop(t, na), '#FFFFFF', -0.05);
    } });
    cue(na, 'pop', { gain: 0.6 }); cue(te, 'tock', { gain: 0.4 }); }

  // ── S06 · "They painted a whole cell pink, floor to ceiling." a roller sweeps pink across the gray ──
  { const st = cut(5), pa = Wd('painted', 5), fl = Wd('floor', 5), ce = Wd('ceiling', 5);
    add({ id: 'S06', at: st, trans: 'zoom', note: 'the painter rolls a fat stripe of bubblegum pink across the gray back wall in one sweep; on "ceiling" the whole cell pops pink with a sparkle burst', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, painter);
      const sw = eio(clamp((t - pa + 0.1) / (ce - pa))), full = eio(clamp((t - ce) / 0.3));
      CELL.paint(full, sw);
      const up = Math.sin(t * 9) * 0.5 + 0.5;
      act(painter, lerp(-1.1, 1.0, sw), -1.15, { ...A.face(t, [[0, 'happy'], [ce, 'laugh']]), armR: [lerp(80, 150, up), lerp(40, -20, up)], holdR: P2.roller, legs: sw > 0 && sw < 1 ? 'walk' : 'stand', phase: t * 7 });
      const k = drift(clamp(lt / d));
      shoot(CELL.scene, [painter], mix(V3(-0.2, 1.6, 3.6), V3(0.3, 1.55, 3.2), k), V3(lerp(-0.6, 0.6, sw), 1.4, -1.4), { ...LK, fov: 44 });
      blit(); if (t > ce) { FX.godray(540, 800, t, { k: 0.7 * (1 - clamp((t - ce - 0.5) / 0.8)), col: '255,190,215' }); FX.sparkle(260, 520, t, A.pop(t, ce), 80); FX.sparkle(800, 700, t, A.pop(t, ce + 0.08), 70); FX.petals(t, { n: 20 }); }
      big('FLOOR TO', 540, 320, 110, A.pop(t, fl), '#FFFFFF', -0.04); big('CEILING!', 540, 450, 130, A.pop(t, ce), '#FF91AF', 0.04);
    } });
    cue(pa, 'slide', { gain: 0.6 }); cue(pa + 0.6, 'slide', { gain: 0.5 }); cue(ce, 'sparkle', { gain: 0.8 }); }

  // ── S07 · "Furious new prisoners went in," the guard shoves a raging prisoner into the pink cell ──
  { const st = cut(6), fu = Wd('furious', 6), wi = Wd('went', 6);
    add({ id: 'S07', at: st, trans: 'whip', note: 'a raging prisoner bursts in, fists up, steam blasting; the guard plants him in the cell; FURIOUS!', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, con1, guard); CELL.paint(1, 0);
      const k = eo(clamp((t - st) / 0.5));
      act(con1, lerp(1.4, 0.1, k), -0.5, { ...A.face(t, [[0, 'angry']]), eyeS: 1.15, armL: A.arm(t, [[0, [150, 40]], [fu, [60, 120]], [fu + 0.25, [150, 40]]]), armR: A.arm(t, [[0, [60, 120]], [fu, [150, 40]], [fu + 0.25, [60, 120]]]), hopY: A.hop(t, fu, 0.25, 0.12) + A.hop(t, wi, 0.25, 0.1), sq: A.squashHop(t, fu, 0.25) });
      act(guard, lerp(2.0, 1.05, k), 0.1, { mood: 'strain', armL: [95, 0], lean: -10 * k });
      shoot(CELL.scene, [con1, guard], V3(0.35, 1.55, 3.4), V3(0.3, 1.3, -0.4), { ...LK, fov: 42 }, 0.018, t);
      blit(); const [hx, hy] = headXY(con1, 1.75); steam(hx, hy, t, 1); FX.vignetteGlow(0.5, '255,60,60'); lines(t, fu, 0.5);
      big('FURIOUS!', 540, 340, 140, A.pop(t, fu), '#FF5A4A', -0.08);
    } });
    cue(st, 'slam', { gain: 0.6 }); cue(fu, 'thud', { gain: 0.6 }); cue(wi, 'thud', { gain: 0.5 }); }

  // ── S08 · "and in fifteen minutes, they calmed right down!" a time-lapse: rage melts into calm ──
  { const st = cut(7), fi = Wd('fifteen', 7), ca = Wd('calmed', 7);
    add({ id: 'S08', at: st, trans: 'zoom', shafts: 0.6, note: 'time-lapse orbit: a clock races to 15 minutes while the prisoner rage melts: stomping -> sitting -> a big yawn and a content smile; CALM!', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, con1); CELL.paint(1, 0);
      const m = 15 * eio(clamp((t - st) / (ca - st))), calm = clamp((t - st) / (ca - st));
      act(con1, 0.0, -1.2, { ...A.face(t, [[0, 'angry'], [st + 0.5, 'tired'], [ca - 0.3, 'sad'], [ca, 'content']]), legs: calm > 0.35 ? 'sit' : 'stand', armL: A.arm(t, [[0, [60, 110]], [st + 0.5, [10, 10]], [ca, [150, -60]]]), armR: A.arm(t, [[0, [60, 110]], [st + 0.5, [10, 10]], [ca + 0.05, [150, -60]]]), alive: 0.5 }, calm > 0.35 ? 0.05 : 0);
      const a = lerp(-0.5, 0.5, drift(clamp(lt / d)));
      shoot(CELL.scene, [con1], V3(Math.sin(a) * 3.0, 1.45, -1.2 + Math.cos(a) * 3.0), V3(0, 1.0, -1.2), { ...LK, fov: 42 });
      blit(); const [hx, hy] = headXY(con1, 1.2); steam(hx, hy, t, 1 - clamp(calm * 2)); clock(820, 360, 130, m, eo(clamp((t - st) / 0.3)));
      big('15 MINUTES', 380, 360, 96, A.pop(t, fi), '#FFFFFF', -0.05); big('CALM!', 540, 560, 150, A.pop(t, ca), '#FF91AF', 0.05); FX.orbs(t, { k: calm, col: '255,170,200' });
    } });
    cue(st + 0.1, 'zip', { gain: 0.4 }); cue(fi, 'tock', { gain: 0.5 }); cue(ca, 'sparkle', { gain: 0.7 }); }

  // ── S09 · "Soon jails everywhere were painting cells pink." door after door glows pink down the block ──
  { const st = cut(8), ev = Wd('everywhere', 8), pi = Wd('pink', 8);
    add({ id: 'S09', at: st, trans: 'whip', whipDir: -1, motes: 34, note: 'rising pull-back down the cell block as door windows light up pink one after another into the distance; EVERYWHERE!', draw(lt, d, t, blit) {
      hideAll(); for (let i = 0; i < 16; i++) COR.doorPink(i, eo(clamp((t - st - i * 0.09) / 0.25)));
      const k = drift(clamp(lt / d));
      shoot(COR.scene, [], mix(V3(0.0, 1.5, 2.5), V3(0.0, 2.9, 5.5), k), mix(V3(0, 1.5, -6), V3(0, 1.3, -14), k), { ...LK, fov: 46, aperture: 0 });
      blit(); FX.orbs(t, { k: 0.9, col: '255,150,190' }); FX.godray(540, 900, t, { k: 0.35, col: '255,170,200' });
      big('EVERYWHERE!', 540, 360, 130, A.pop(t, ev), '#FF91AF', -0.05);
    } });
    cue(st + 0.1, 'pop', { gain: 0.3 }); cue(st + 0.5, 'pop', { gain: 0.3 }); cue(st + 0.9, 'pop', { gain: 0.3 }); cue(ev, 'sparkle', { gain: 0.6 }); }

  // ── S10 · "A football coach even painted the other team's locker room pink!" ──
  { const st = cut(9), co = Wd('coach', 9), ot = Wd('other', 9), lk = Wd('locker', 9), pk = Wd('pink', 9);
    add({ id: 'S10', at: st, trans: 'zoom', shafts: 0.5, note: 'an all-pink visitors locker room: the coach grins with his whistle; two visiting players walk in, freeze, and gasp; PINK?!', draw(lt, d, t, blit) {
      hideAll(); into(LOCK.scene, coach, plA, plB);
      act(coach, -0.45, -0.6, { ...A.face(t, [[0, 'smug'], [ot, 'scheme'], [pk, 'laugh']]), armR: A.arm(t, [[0, [20, 30]], [co, [150, -40]]]), armL: [40, 80], holdL: P2.whistle });
      const w = eo(clamp((t - ot + 0.2) / 0.8));
      act(plA, lerp(3.0, 0.7, w), -0.1, { ...A.face(t, [[0, 'neutral'], [lk, 'shock']]), legs: w < 1 ? 'walk' : 'stand', phase: t * 8, armL: A.arm(t, [[0, [10, 10]], [lk, [150, 30]]]), hopY: A.hop(t, lk, 0.3, 0.12), sq: A.squashHop(t, lk, 0.3) });
      act(plB, lerp(3.8, 1.5, w), 0.3, { ...A.face(t, [[0, 'happy'], [lk + 0.1, 'gasp']]), legs: w < 1 ? 'walk' : 'stand', phase: t * 8 + 2, armR: A.arm(t, [[0, [10, 10]], [lk + 0.1, [150, 30]]]) });
      const k = drift(clamp(lt / d));
      shoot(LOCK.scene, [coach, plA, plB], mix(V3(0.6, 1.6, 4.6), V3(0.3, 1.5, 3.8), k), V3(0.2, 1.4, -0.6), { ...LK, fov: 44 });
      blit(); big('LOCKER ROOM', 540, 330, 110, A.pop(t, lk), '#FFFFFF', -0.04); big('PINK?!', 540, 470, 150, A.pop(t, pk), '#FF91AF', 0.06); FX.sparkle(300, 700, t, A.pop(t, co), 60);
    } });
    cue(co, 'pop', { gain: 0.5 }); cue(lk, 'boing', { gain: 0.5 }); cue(pk, 'pop', { gain: 0.6 }); }

  // ── S11 · "But here's the twist." the calm prisoner's eyes slide to camera ──
  { const st = cut(10), tw = Wd('twist', 10);
    add({ id: 'S11', at: st, cut: true, swoosh: true, note: 'snap zoom on the calm prisoner on the bench; he stops smiling, eyes slide to camera; ? pops', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, con1); CELL.paint(1, 0);
      act(con1, 0.0, -1.2, { ...A.face(t, [[0, 'content'], [st + 0.2, 'neutral'], [tw, 'skeptic']]), legs: 'sit', look: [0, 0], alive: 0.2 }, 0.05);
      const k = eo(clamp(lt / 0.3));
      shoot(CELL.scene, [con1], mix(V3(0.2, 1.3, 2.6), V3(0.1, 1.3, 1.2), k), V3(0, 1.15, -1.2), { ...LK, fov: 40, float: 0.4 });
      blit(); FX.vignetteGlow(0.5, '90,120,255'); const [hx, hy] = headXY(con1, 1.35); qmark(hx + 160, hy - 60, A.pop(t, tw), t);
    } });
    cue(st, 'tock', { gain: 0.7 }); cue(tw, 'pop', { gain: 0.5 }); }

  // ── S12 · "When scientists tested it again, the calm wore off fast," the rage comes back ──
  { const st = cut(11), te = Wd('tested', 11), wo = Wd('wore', 11), fa = Wd('fast', 11);
    add({ id: 'S12', at: st, trans: 'whip', note: 'two scientists with clipboards peer in at the calm prisoner; the clock ticks on and his calm cracks: twitch, frown, back to steaming mad; WORE OFF!', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, con1, sci, sci2); CELL.paint(1, 0);
      act(sci, 0.62, 0.3, { ...A.face(t, [[0, 'neutral'], [te, 'smug'], [fa, 'shock']]), armR: [60, 80], holdR: P2.clip });
      act(sci2, -0.62, 0.35, { ...A.face(t, [[0, 'neutral'], [fa + 0.1, 'worried']]), armL: [60, 80], holdL: P2.clip });
      const mad = clamp((t - wo) / (fa - wo + 0.2));
      act(con1, 0.0, -1.2, { ...A.face(t, [[0, 'content'], [wo, 'skeptic'], [fa, 'angry']]), legs: mad > 0.6 ? 'stand' : 'sit', armL: A.arm(t, [[0, [10, 10]], [fa, [150, 40]]]), armR: A.arm(t, [[0, [10, 10]], [fa + 0.05, [150, 40]]]), hopY: A.hop(t, fa, 0.25, 0.12), sq: A.squashHop(t, fa, 0.25) }, mad > 0.6 ? 0 : 0.05);
      const k = drift(clamp(lt / d));
      shoot(CELL.scene, [con1, sci, sci2], mix(V3(0.0, 1.6, 3.7), V3(0.0, 1.5, 3.1), k), V3(0, 1.2, -0.6), { ...LK, fov: 46 }, A.jolt(t, fa, 0.4, 0.04), t);
      blit(); const [hx, hy] = headXY(con1, 1.75); steam(hx, hy, t, clamp((t - fa) / 0.3)); clock(830, 330, 110, 15 + 25 * eio(clamp((t - st) / d)), 1);
      big('WORE OFF!', 420, 360, 120, A.pop(t, wo + 0.1), '#FF5A4A', -0.06); lines(t, fa, 0.5);
    } });
    cue(te, 'pop', { gain: 0.4 }); cue(fa, 'thud', { gain: 0.7 }); cue(fa, 'boing', { gain: 0.4 }); }

  // ── S13 · "and a plain gray cell worked just as well." gray vs pink, side by side: SAME ──
  { const st = cut(12), gr = Wd('gray', 12), we = Wd('well', 12);
    add({ id: 'S13', at: st, trans: 'zoom', note: 'two cells side by side, gray on the left, pink on the right, a prisoner calming in each at the same moment; = SAME!', draw(lt, d, t, blit) {
      hideAll(); into(TWIN.scene, con1, con2);
      act(con2, -1.0, -1.0, { ...A.face(t, [[0, 'angry'], [gr + 0.1, 'content']]), legs: t > gr ? 'sit' : 'stand' }, t > gr ? 0.05 : 0);
      act(con1, 1.0, -1.0, { ...A.face(t, [[0, 'angry'], [gr + 0.1, 'content']]), legs: t > gr ? 'sit' : 'stand' }, t > gr ? 0.05 : 0);
      const k = drift(clamp(lt / d));
      shoot(TWIN.scene, [con1, con2], mix(V3(0, 1.7, 6.4), V3(0, 1.6, 5.6), k), V3(0, 1.15, -0.8), { ...LK, fov: 44 });
      blit(); big('GRAY', 270, 380, 100, A.pop(t, gr), '#C8D0DC', -0.05); big('PINK', 810, 380, 100, A.pop(t, gr + 0.1), '#FF91AF', 0.05); big('=', 540, 400, 150, A.pop(t, gr + 0.25), '#FFFFFF'); big('SAME!', 540, 560, 140, A.pop(t, we), '#FFD15C', -0.04);
    } });
    cue(gr, 'pop', { gain: 0.5 }); cue(gr + 0.25, 'pop', { gain: 0.5 }); cue(we, 'ding', { gain: 0.6 }); }

  // ── S14 · "So can a color calm you down? Maybe, for about fifteen minutes." the shrug + loop to the hook ──
  { const st = cut(13), ma = Wd('maybe', 13), fi = Wd('fifteen', 13), mi = Wd('minutes', 13);
    add({ id: 'S14', at: st, trans: 'whip', shafts: 0.5, note: 'in the pink cell the prisoner turns to us and shrugs big on "maybe"; a 15-minute clock pops; as it runs out his smile twitches back to rage (loops to the hook)', draw(lt, d, t, blit) {
      hideAll(); into(CELL.scene, con1); CELL.paint(1, 0);
      const end = Le13();
      act(con1, 0.0, -0.6, { ...A.face(t, [[0, 'content'], [ma, 'skeptic'], [fi, 'smug'], [end - 0.45, 'angry']]), armL: A.arm(t, [[0, [10, 10]], [ma, [110, -70]], [fi + 0.4, [10, 10]], [end - 0.4, [40, 110]]]), armR: A.arm(t, [[0, [10, 10]], [ma + 0.05, [110, -70]], [fi + 0.4, [10, 10]], [end - 0.4, [40, 110]]]), sq: A.jolt(t, end - 0.4, 0.4, 0.25) });
      const k = drift(clamp(lt / d));
      shoot(CELL.scene, [con1], mix(V3(0.4, 1.6, 3.6), V3(0.15, 1.55, 2.5), k), V3(0.05, 1.35, -0.6), { ...LK, fov: 42 });
      blit(); const [hx, hy] = headXY(con1, 1.75); steam(hx, hy, t, clamp((t - end + 0.4) / 0.2));
      big('MAYBE...', 540, 330, 120, A.pop(t, ma), '#FFFFFF', -0.05); clock(820, 520, 120, 15 * clamp((t - fi) / 0.8), A.pop(t, fi));
    } });
    cue(ma, 'boing', { gain: 0.4 }); cue(fi, 'tock', { gain: 0.5 }); cue(mi + 0.6, 'thud', { gain: 0.4 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
const Le13 = () => T.lines[13].end;
