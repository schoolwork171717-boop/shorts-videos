// THE ARMY THAT LOST A WAR TO BIRDS — 10 s kit-v8 sample (reference-channel style: one long camera move, bodies that
// never stop, bright high-key colour, in-world signs instead of pop-up text, a dissolve for the time skip).
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as OB from './core/outback.js';
import * as A from './core/act.js';
import { Toon } from './core/toon.js';
import { Critter, drawEmu } from './core/critters.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let NOW = 0;
const KHAKI = { body: '#B89C64', pattern: 'jacket', patCol: '#9A8048', hat: 'slouch', hatCol: '#8C7448', band: '#4A3A28', neck: 'tie', neckCol: '#6A5636' };
const LOOK = {
  general: { ...KHAKI, extra: ['mustache'], mustacheCol: '#5A3A22', bw: 118 },
  sold1: { ...KHAKI, extra: ['freckles'] },
  sold2: { ...KHAKI, extra: ['glasses'] },
};

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); FX.motes(t, { n: 18, col: '255,240,200', size: 1.0 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.16, bloomThreshold: 0.97, aperture: 0.0004, maxblur: 0.004 };
  const shoot = (scene, people, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos);
    cam.position.add(V3(Math.sin(t * 0.9) * 0.04, Math.sin(t * 1.3 + 1) * 0.03, Math.sin(t * 0.7 + 2) * 0.03));     // never perfectly still
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    people.forEach((q) => q.face(cam)); E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
  };
  // every person performs all the time; the beat overrides on top
  const act = (p, x, z, o = {}, y = 0, k = 1) => {
    const al = A.alive(NOW, p.seed, 1), pf = A.perform(NOW, p.seed, o.energy ?? k, { talk: o.talk ?? 1 });
    p.group.visible = true; p.at(x + (o.still ? 0 : pf.dx), y + (o.hopY || 0), z);
    const st = { look: al.look, blink: al.blink, ...pf, tilt: pf.tilt + al.tilt, ...o }; delete st.dx; p.set(st); A.applySquash(p, st.squash || 0);
  };
  const emuAct = (e, x, z, o = {}) => {
    const t = NOW, s = e.seed, al = A.alive(t, s, 1);
    e.group.visible = true; e.at(x, 0, z);
    const st = { blink: al.blink, look: al.look, neck: Math.sin(t * 1.7 + s) * 0.35, tilt: Math.sin(t * 2.3 + s * 2) * 10, bob: Math.sin(t * 3.1 + s) * 6,
      peck: Math.max(0, Math.sin(t * 0.9 + s * 3) - 0.75) * 3, lean: Math.sin(t * 1.1 + s) * 2 };
    Object.entries(o).forEach(([k, v]) => { if (v !== undefined) st[k] = v; }); e.set(st);
  };
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });

  // ── set + cast ──
  const OUT = OB.outback(E);
  const mk = (k, seed) => { const p = new Toon({ ...LOOK[k], extra: [...LOOK[k].extra] }, { res: 2 }); p.seed = seed; return p; };
  const general = mk('general', 1), sold1 = mk('sold1', 2), sold2 = mk('sold2', 3);
  const emus = [0, 1, 2, 3, 4, 5].map((i) => { const e = new Critter(drawEmu, { body: ['#6B4A33', '#5E432E', '#73503A'][i % 3] }, { height: 1.9, res: 1.5 }); e.seed = 10 + i; return e; });
  const all = [general, sold1, sold2, ...emus];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));

  // ── S1 · "An army rolled out machine guns to fight a bunch of birds. / The general said it would take a week, tops."
  { const st = 0, mg = Wd('machine', 0), bi = Wd('birds', 0), ge = Wd('general', 1), wk = Wd('week', 1), tp = Wd('tops', 1), end = L(2) - 0.05;
    add({ id: 'S1', at: st, note: 'one continuous move: track the truck rolling in, the gunner swings the gun toward the field on "machine guns", the camera swings out to reveal the emus on "birds", then glides back to the general bragging "a week, tops"', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, general, sold1, sold2, ...emus);
      const tx = lerp(-16, -3, eo(clamp(t / 2.6)));
      OUT.update(t, { truckX: tx }); OUT.truck.gunHead.rotation.y = lerp(1.4, 0, eio(clamp((t - mg + 0.2) / 0.6))) + Math.sin(t * 3) * 0.03;
      // soldiers on the flatbed (world x = truck x + local), the gunner behind the gun
      act(sold1, tx - 2.35, 1.0, { ...A.face(t, [[0, 'happy'], [mg, 'excited'], [bi + 0.2, 'smug']]), armL: A.arm(t, [[0, [40, 60]], [mg - 0.1, [80, 40]]]), armR: A.arm(t, [[0, [40, 60]], [mg, [85, 30]]]) }, 1.17);
      act(sold2, tx - 1.1, 1.35, { ...A.face(t, [[0, 'content'], [bi, 'laugh']]), ...A.react('laugh', t, bi + 0.1, 0.9) }, 1.17);
      // the general rides on the running board (just outside the cab), then hops down onto the verge and brags
      const hu = clamp((t - (ge - 0.5)) / 0.45), he = eio(hu);
      act(general, lerp(tx + 0.55, -1.2, he), lerp(2.62, 3.5, he), { ...A.face(t, [[0, 'proud'], [ge, 'smug'], [wk, 'proud'], [tp, 'laugh']]),
        armR: A.arm(t, [[0, [20, 30]], [wk - 0.15, [150, -40]], [tp + 0.3, [40, 128]]]), armL: A.arm(t, [[0, [20, 30]], [tp + 0.3, [40, 128]]]),
        hopY: A.hop(t, ge - 0.5, 0.45, 0.4), squash: A.squashHop(t, ge - 0.05, 0.3), ...A.react('proud', t, tp + 0.25, 1.2) }, lerp(0.6, 0, hu));
      // emus in the wheat: heads up on "birds", one peeks at the camera
      const look = t > bi;
      [[0.8, -4.0], [2.6, -6.0], [3.9, -3.4], [1.5, -7.6], [4.8, -5.2], [-0.7, -6.4]].forEach(([x, z], i) => emuAct(emus[i], x, z, {
        mood: look ? (i % 2 ? 'smug' : 'neutral') : 'neutral', peck: look ? 0 : undefined, neck: look ? Math.sin(t * 2 + i) * 0.15 : undefined, flip: i % 3 === 0, look: look ? [0.4, 0] : undefined }));
      const c = A.camPath(t, [
        [0.0, [tx + 4.2, 1.5, 6.4], [tx, 1.4, 1.2], 44],
        [mg + 0.2, [tx + 2.6, 1.9, 5.4], [tx - 1.6, 1.6, 1.2], 42],
        [(mg + bi) / 2 + 0.15, [0.6, 3.1, 9.0], [0.2, 1.0, -2.0], 46],
        [bi + 0.3, [2.6, 2.3, 6.4], [2.3, 0.9, -5.0], 46],
        [ge + 0.2, [0.8, 1.65, 7.2], [-0.7, 1.35, 3.5], 42],
        [end, [0.1, 1.55, 6.4], [-1.05, 1.4, 3.5], 40],
      ]);
      shoot(OUT.scene, all, c); blit();
    } });
    cue(0.05, 'chug', { gain: 0.35 }); cue(mg + 0.05, 'zip', { gain: 0.4 }); cue(bi + 0.25, 'swoosh', { gain: 0.5, sweep: -0.6 }); cue(ge - 0.5, 'boing', { gain: 0.3 }); cue(wk, 'pop', { gain: 0.4 }); cue(tp + 0.25, 'ding', { gain: 0.35 }); }

  // ── S2 · "A month later, the birds were winning, and nobody could figure out why." (dissolve = time skip)
  { const st = L(2) - 0.05, wi = Wd('winning', 2), no = Wd('nobody', 3), wh = Wd('why', 3);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'a month later: tired, sweaty soldiers, emus jogging circles round the parked truck and one standing on its bed; crane down to the general who shrugs; an emu pops up beside him on "why"', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, general, sold1, sold2, ...emus);
      OUT.update(t, { truckX: -3 }); OUT.truck.gunHead.rotation.y = Math.sin(t * 1.4) * 0.6;
      act(sold1, -5.35, 1.0, { mood: 'tired', sweat: 1, armL: [10, 10], armR: [40, 80], energy: 0.6 }, 1.17);
      act(sold2, -4.4, 3.2, { ...A.face(t, [[0, 'dizzy'], [wi, 'sad']]), sweat: 1, energy: 0.7 });
      act(general, -0.6, 3.7, { ...A.face(t, [[0, 'worried'], [no, 'skeptic'], [wh, 'shock']]), sweat: 1,
        armR: A.arm(t, [[0, [30, 40]], [no - 0.1, [150, -80]]]), ...A.react('shrug', t, no + 0.5, 0.9), ...A.react('shock', t, wh + 0.05, 0.5) });
      [0, 1, 2, 3].forEach((i) => { const a = t * 1.6 + i * Math.PI / 2, x = -3 + Math.cos(a) * 4.6, z = 0.9 + Math.sin(a) * 1.9;
        emuAct(emus[i], x, z, { legs: 'run', phase: t * 13 + i, mood: i % 2 ? 'smug' : 'happy', flip: Math.sin(a) > 0, neck: 0.3, peck: 0 }); });
      emuAct(emus[4], -4.2, 1.3, { mood: 'smug', look: [0.6, 0.2] }); emus[4].group.position.y = 1.17;
      const pop = eo(clamp((t - wh + 0.15) / 0.3));
      emuAct(emus[5], lerp(1.5, 0.45, pop), lerp(2.0, 3.2, pop), { mood: 'smug', look: [0.8, 0.1], tilt: 14 * pop, neck: -0.3 * pop });
      emus[5].group.visible = t > wh - 0.15;
      const c = A.camPath(t, [
        [st, [-2.6, 4.6, 11.0], [-2.8, 0.9, 1.2], 46],
        [no - 0.2, [-0.2, 2.2, 8.2], [-0.6, 1.3, 3.2], 44],
        [T.dur, [0.2, 1.6, 7.2], [0.05, 1.45, 3.5], 42],
      ]);
      shoot(OUT.scene, all, c); blit();
    } });
    cue(st + 0.2, 'swoosh', { gain: 0.4 }); cue(wi, 'boing', { gain: 0.35 }); cue(no + 0.5, 'gulp', { gain: 0.35 }); cue(wh + 0.05, 'pop', { gain: 0.6 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
