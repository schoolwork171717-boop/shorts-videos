// THE ARMY THAT LOST A WAR TO BIRDS — kit v8 (reference-channel style): long flying camera moves, bodies that never
// stop, bright high-key colour, in-world signs and labels instead of pop-up text, dissolves for time and place skips.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Le, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as OB from './core/outback.js';
import * as EW from './core/emuwar.js';
import * as A from './core/act.js';
import { Toon, INK } from './core/toon.js';
import { Critter, drawEmu, Flock } from './core/critters.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
let NOW = 0;
const KHAKI = { body: '#B89C64', pattern: 'jacket', patCol: '#9A8048', hat: 'slouch', hatCol: '#8C7448', band: '#4A3A28', neck: 'tie', neckCol: '#6A5636' };
const LOOK = {
  major: { ...KHAKI, extra: ['mustache'], mustacheCol: '#5A3A22', bw: 118 },
  sold1: { ...KHAKI, extra: ['freckles'] },
  sold2: { ...KHAKI, extra: ['glasses'] },
  farmer: { body: '#C8443A', pattern: 'plaid', patCol: '#7A2420', hat: 'cowboy', hatCol: '#E2C27A', extra: ['beard'], beardCol: '#8A5A3A', neck: 'scarf', neckCol: '#3C6FB6' },
  mp1: { body: '#3A4A6A', pattern: 'jacket', patCol: '#2C3A56', neck: 'tie', neckCol: '#B5372E', extra: ['mustache', 'glasses'], mustacheCol: '#6A6A70', hair: '#D8D8DC' },
  mp2: { body: '#4A4A52', pattern: 'jacket', patCol: '#38383E', neck: 'tie', neckCol: '#3C6FB6', hat: 'bowler', hatCol: '#2A2830', extra: ['blush'] },
  mp3: { body: '#5A3A4A', pattern: 'jacket', patCol: '#46303A', neck: 'tie', neckCol: '#F2C230', extra: ['beard'], beardCol: '#5A4030', hair: '#5A4030' },
  mp4: { body: '#2E4E5E', pattern: 'jacket', patCol: '#243E4A', neck: 'tie', neckCol: '#D8343F', extra: ['freckles'], hair: '#C8783A' },
};
// a rolled-up newspaper in the hand (named so the cut-out cache key stays stable)
function rolledPaper(g, x, y) { g.save(); g.translate(x, y); g.rotate(-0.5); g.fillStyle = '#FBF5E4'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.roundRect(-15, -170, 30, 180, 12); g.fill(); g.stroke();
  g.lineWidth = 4; [-130, -95].forEach((yy) => { g.beginPath(); g.moveTo(-15, yy); g.lineTo(15, yy + 6); g.stroke(); }); g.restore(); }

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); FX.motes(t, { n: o.motes ?? 18, col: o.moteCol || '255,240,200', size: 1.0 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.16, bloomThreshold: 0.97, aperture: 0.0004, maxblur: 0.004 };
  const shoot = (scene, people, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); if (!c.noClose) cam.position.lerp(V3(...c.look), 0.14 * clamp((50 - c.fov) / 6));   // v9.2: continuous (an on/off switch made the camera jump)   // v8.3: closer, like the references
    cam.position.add(V3(Math.sin(t * 0.9) * 0.04, Math.sin(t * 1.3 + 1) * 0.03, Math.sin(t * 0.7 + 2) * 0.03));     // never perfectly still
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    people.forEach((q) => q.face(cam)); flockA.face(cam); flockD.face(cam);
    E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
  };
  const proj = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * CW, (1 - p.y) / 2 * CH]; };
  // every person performs all the time; the beat overrides on top
  const act = (p, x, z, o = {}, y = 0, k = 1) => {
    const al = A.alive(NOW, p.seed, 1), pf = A.perform(NOW, p.seed, o.energy ?? k, { talk: o.talk ?? 1 });
    p.group.visible = true; p.at(x + (o.still ? 0 : pf.dx) + (o.dx || 0), y + (o.hopY || 0), z);
    const st = { look: al.look, blink: al.blink, ...pf, tilt: pf.tilt + al.tilt, ...o }; delete st.dx; delete st.hopY; delete st.energy; delete st.still;
    if (st.steam) st.steamT = NOW; p.set(st); A.applySquash(p, st.squash || 0);
  };
  const emuAct = (e, x, z, o = {}, y = 0) => {
    const t = NOW, s = e.seed, al = A.alive(t, s, 1);
    e.group.visible = true; e.at(x, y, z);
    const st = { blink: al.blink, look: al.look, neck: Math.sin(t * 1.7 + s) * 0.35, tilt: Math.sin(t * 2.3 + s * 2) * 10, bob: Math.sin(t * 3.1 + s) * 6,
      peck: Math.max(0, Math.sin(t * 0.9 + s * 3) - 0.75) * 3, lean: Math.sin(t * 1.1 + s) * 2 };
    Object.entries(o).forEach(([k, v]) => { if (v !== undefined) st[k] = v; }); e.set(st);
  };
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });

  // ── sets ──
  const OUT = OB.outback(E);                                   // the farm by day
  const DUSK = OB.outback(E, { sunset: true });                // the same farm at sunset (the ending)
  const PAR = EW.parliament(E);
  const pond = EW.waterHole(3.4, 2.1); pond.position.set(24, 0, -7.5); OUT.scene.add(pond);
  [[20.4, 0.6], [23.9, 0.75]].forEach(([x, z]) => { const b = EW.hayBale(); b.position.set(x, 0, z); b.scale.setScalar(0.7); OUT.scene.add(b); });
  const perch = EW.hayBale(); perch.position.set(-12.5, 0, -4.2); OUT.scene.add(perch);          // the lookout's hay bale
  const spare = OB.armyTruck(); const gun2 = spare.gun, gun2Head = spare.gunHead; spare.remove(gun2);  // a ground gun for the ambush
  gun2.position.set(22.1, 0.02, 1.75); OUT.scene.add(gun2);
  const crates = [...Array(6)].map((_, i) => { const c = EW.ammoCrate('BULLETS'); c.position.set(1.0 + (i % 3) * 1.05, Math.floor(i / 3) * 0.62, 3.25 + (i % 2) * 0.05); c.rotation.y = (rnd(i) - 0.5) * 0.15; OUT.scene.add(c); return c; });
  const duskCrates = [0, 1, 2].map(() => { const c = EW.ammoCrate('BULLETS'); DUSK.scene.add(c); return c; });
  const paper = EW.newspaper(['BIRDS', 'BEAT', 'ARMY']); OUT.scene.add(paper);
  const rep = EW.report(); DUSK.scene.add(rep);
  const med = EW.medal(); PAR.scene.add(med);
  const smoke = EW.puff('#EDEAF2'); OUT.scene.add(smoke);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#FFF2A0'; g.strokeStyle = '#F29A30'; g.lineWidth = 6; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = k % 2 ? 26 : 60; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, toneMapped: false }));
  flash.scale.set(0.6, 0.6, 1); flash.visible = false; OUT.scene.add(flash);
  const fire = (head, t, on, len = 1.0) => { head.updateWorldMatrix(true, false); const p = head.localToWorld(V3(0, 0, len)); flash.position.copy(p); flash.visible = on && Math.floor(t * 30) % 2 === 0; flash.material.rotation = t * 7; };

  // ── cast ──
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const major = mk('major', 1), sold1 = mk('sold1', 2), sold2 = mk('sold2', 3), farmer = mk('farmer', 4);
  const mps = ['mp1', 'mp2', 'mp3', 'mp4'].map((k, i) => mk(k, 20 + i));
  const emus = [0, 1, 2, 3, 4, 5].map((i) => { const e = new Critter(drawEmu, { body: ['#6B4A33', '#5E432E', '#73503A'][i % 3] }, { height: 1.9, res: 1.5 }); e.seed = 10 + i; return e; });
  const lookout = new Critter(drawEmu, { body: '#4E3424', neck: '#6E98C0' }, { height: 2.3, res: 1.5 }); lookout.seed = 30;
  const flockA = new Flock(64, { height: 1.75, res: 0.5 }); OUT.scene.add(flockA.group);
  const flockD = new Flock(24, { height: 1.75, res: 0.5 }); DUSK.scene.add(flockD.group);
  const all = [major, sold1, sold2, farmer, ...mps, ...emus, lookout];
  const hideAll = () => { all.forEach((p) => (p.group.visible = false)); flockA.hide(); flockD.hide(); paper.visible = false; rep.visible = false; smoke.visible = false; flash.visible = false; crates.forEach((c) => (c.visible = false)); };
  const SHOOT = (scene, c, look) => shoot(scene, all, c, look);
  // spread-out flock spots in the field (deterministic)
  const spot = (i, cx, cz, rx, rz) => [cx + (rnd(i * 3 + 1) - 0.5) * 2 * rx, cz - rnd(i * 5 + 2) * rz];

  // ── S1 · "An army rolled out machine guns to fight a bunch of birds."
  { const st = 0, mg = Wd('machine', 0), bi = Wd('birds', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open: track the army truck rolling in, the gunner swings the gun on "machine guns", the camera swings out over the fence to the emus on "birds"', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, sold1, sold2, ...emus);
      const tx = lerp(-16, -3, eo(clamp(t / 2.4)));
      OUT.update(t, { truckX: tx }); OUT.truck.position.y = 0; OUT.truck.rotation.set(0, 0, 0);
      OUT.truck.gunHead.rotation.set(0, lerp(1.4, 0.2, eio(clamp((t - mg + 0.2) / 0.6))) + Math.sin(t * 3) * 0.03, 0);
      act(sold1, tx - 2.35, 1.0, { ...A.face(t, [[0, 'happy'], [mg, 'excited'], [bi + 0.2, 'smug']]), armL: A.arm(t, [[0, [40, 60]], [mg - 0.1, [80, 40]]]), armR: A.arm(t, [[0, [40, 60]], [mg, [85, 30]]]) }, 1.17);
      act(sold2, tx - 1.1, 1.35, { ...A.face(t, [[0, 'content'], [bi, 'laugh']]), ...A.react('laugh', t, bi + 0.1, 0.9) }, 1.17);
      act(major, tx + 0.55, 2.62, { ...A.face(t, [[0, 'proud'], [bi, 'smug']]), armR: A.arm(t, [[0, [20, 30]], [mg, [150, -40]]]) }, 0.6);
      const up = t > bi;
      [[0.8, -4.0], [2.6, -6.0], [3.9, -3.4], [1.5, -7.6], [4.8, -5.2], [-0.7, -6.4]].forEach(([x, z], i) => emuAct(emus[i], x, z, {
        mood: up ? (i % 2 ? 'smug' : 'neutral') : 'neutral', peck: up ? 0 : undefined, neck: up ? Math.sin(t * 2 + i) * 0.15 : undefined, flip: i % 3 === 0, look: up ? [0.4, 0] : undefined }));
      const c = A.camPath(t, [
        [0.0, [tx + 4.2, 1.5, 6.4], [tx, 1.4, 1.2], 44],
        [mg + 0.2, [tx + 2.6, 1.9, 5.4], [tx - 1.6, 1.6, 1.2], 42],
        [(mg + bi) / 2 + 0.15, [0.6, 3.1, 9.0], [0.2, 1.0, -2.0], 46],
        [end, [2.6, 2.3, 6.4], [2.3, 0.9, -5.0], 46],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(0.05, 'chug', { gain: 0.35 }); cue(mg + 0.05, 'zip', { gain: 0.4 }); cue(bi + 0.15, 'swoosh', { gain: 0.5, sweep: -0.6 }); }

  // ── S2 · "Farmers out west were furious. Twenty thousand emus were stomping through their wheat and eating everything."
  { const st = L(1), fu = Wd('furious', 1), tw = Wd('twenty', 1), sto = Wd('stomping', 1), ea = Wd('eating', 1), end = L(2);
    add({ id: 'S2', at: st, note: 'the farmer: start close on his red, steaming face, pull up and back over the wheat to a field crawling with emus, then down to an emu eating right beside him', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, farmer, emus[0], emus[1]); OUT.update(t, { truckX: -60 });
      const fx = 8, fz = -2.0;
      act(farmer, fx, fz, { ...A.face(t, [[st, 'angry'], [tw, 'shock'], [sto + 0.2, 'angry']]), flush: clamp((t - st) / 0.6) * (t > tw && t < sto ? 0.4 : 1), steam: t > fu - 0.1 ? 1 : 0,
        armR: A.arm(t, [[st, [150, 40]], [tw - 0.1, [40, 120]], [ea, [160, 20]]]), armL: A.arm(t, [[st, [30, 20]], [ea, [150, 40]]]), ...A.react('angry', t, fu, 0.8), ...A.react('angry', t, ea + 0.1, 1.0), energy: 1.3 });
      emuAct(emus[0], fx + 1.1, fz - 0.6, { peck: Math.max(0, Math.sin(t * 6)) * 0.9, mood: t > ea ? 'smug' : 'neutral', flip: true });
      emuAct(emus[1], fx - 1.4, fz - 1.4, { peck: Math.max(0, Math.sin(t * 5 + 1)) * 0.9, legs: 'walk', phase: t * 6 });
      for (let i = 0; i < 64; i++) { const [x, z] = spot(i, fx + 2, -4.5, 16, 22); const w = i % 3 === 0; flockA.bird(i, x + (w ? Math.sin(t * 0.6 + i) * 0.8 : 0), z, { mode: w ? 'walk' : 'peck', phase: w ? t * 5 + i : t * 3 + i, flip: i % 2 === 0 }); }
      const c = A.camPath(t, [
        [st, [fx + 0.3, 1.75, fz + 3.0], [fx, 1.55, fz], 40],
        [tw + 0.1, [fx + 1.2, 4.2, fz + 7.0], [fx + 1.4, 0.6, fz - 5.0], 48],
        [ea - 0.2, [fx + 2.2, 3.4, fz + 6.0], [fx + 0.6, 0.9, fz - 1.5], 44],
        [end, [fx + 1.4, 1.7, fz + 3.6], [fx + 0.4, 1.2, fz - 0.4], 40],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(fu, 'boing', { gain: 0.3 }); cue(tw + 0.05, 'swoosh', { gain: 0.45, sweep: 0.5 }); cue(ea, 'pop', { gain: 0.35 }); }

  // ── S3 · "So the army sent a major, two soldiers, two machine guns, and crates and crates of bullets." /
  //         "Everyone figured this would be easy. They're birds. How hard can it be?"
  { const st = L(2), ma = Wd('major', 2), so = Wd('soldiers', 2), gu = Wd('guns', 2), cr = Wd('crates', 2), bu = Wd('bullets', 2), ev = L(3), bi = Wd('birds', 3), ho = Wd('hard', 3), end = L(4);
    add({ id: 'S3', at: st, note: 'the army arrives: truck pulls up, the major hops down, the soldiers stack crates that pop in one by one; on "How hard can it be?" the camera pushes in on the smug major while an emu peers over the fence behind him', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, sold1, sold2, emus[2]);
      const tx = lerp(-6, 4, eo(clamp((t - st) / 1.6)));
      OUT.update(t, { truckX: tx }); OUT.truck.position.y = 0; OUT.truck.rotation.set(0, 0, 0); OUT.truck.gunHead.rotation.set(0, 0.5 + Math.sin(t * 0.8) * 0.2, 0);
      const hopT = ma - 0.25, down = clamp((t - hopT) / 0.4), he = eio(down);
      act(major, lerp(tx + 0.55, 5.6, he), lerp(2.62, 3.25, he), { ...A.face(t, [[st, 'proud'], [ma, 'smug'], [ev, 'content'], [bi, 'smug'], [ho, 'laugh']]),
        armR: A.arm(t, [[st, [20, 30]], [ma + 0.3, [150, -40]], [ev + 0.3, [90, 60]], [bi, [120, -10]], [ho - 0.1, [40, 128]]]), armL: A.arm(t, [[st, [20, 30]], [ho - 0.1, [40, 128]]]),
        hopY: A.hop(t, hopT, 0.4, 0.4), ...A.react('proud', t, ho + 0.2, 1.2) }, lerp(0.6, 0, down));
      act(sold1, tx - 1.6, 1.0, { ...A.face(t, [[st, 'happy'], [so, 'excited'], [ev, 'content'], [ho + 0.2, 'laugh']]), armL: A.arm(t, [[st, [60, 60]], [cr, [100, 40]]]), armR: A.arm(t, [[st, [60, 60]], [cr, [100, 40]]]), ...A.react('laugh', t, ho + 0.25, 1.0) }, 1.17);
      act(sold2, 2.4, 3.9, { ...A.face(t, [[st, 'content'], [gu, 'excited'], [cr, 'strain'], [ev, 'happy'], [ho + 0.1, 'laugh']]), armL: A.arm(t, [[st, [40, 60]], [cr, [95, 50]], [bu + 0.4, [20, 20]]]), armR: A.arm(t, [[st, [40, 60]], [cr, [95, 50]], [bu + 0.4, [20, 20]]]), ...A.react('laugh', t, ho + 0.15, 1.1) });
      crates.forEach((c, i) => { const t0 = cr - 0.1 + i * 0.22, k = A.pop(t, t0, 0.3); c.visible = t > t0; c.scale.setScalar(Math.max(0.001, k)); });
      emuAct(emus[2], 6.4, -1.0, { mood: t > ev ? 'sly' : 'neutral', look: [-0.6, 0.1], neck: t > bi ? -0.25 + Math.sin(t * 3) * 0.05 : undefined, peck: t > ev ? 0 : undefined, flip: true });
      const c = A.camPath(t, [
        [st, [tx + 3.6, 1.8, 7.6], [tx + 0.5, 1.3, 1.8], 44],
        [ma + 0.4, [6.6, 1.7, 7.4], [5.4, 1.45, 3.2], 42],
        [so + 0.2, [3.4, 2.5, 9.4], [2.6, 1.7, 2.0], 46],
        [cr + 0.2, [3.6, 1.7, 8.2], [2.4, 1.1, 3.4], 44],
        [ev + 0.6, [6.9, 1.75, 7.6], [5.6, 1.4, 2.0], 42],
        [end, [6.1, 1.62, 5.9], [5.65, 1.5, 2.6], 36],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(st + 0.05, 'chug', { gain: 0.3 }); cue(ma - 0.25, 'boing', { gain: 0.3 }); crates.forEach((_, i) => cue(cr - 0.1 + i * 0.22, 'pop', { gain: 0.22 })); cue(ho + 0.25, 'ding', { gain: 0.3 }); }

  // ── S4 · "Then the first flock showed up, and the soldiers opened fire." / "The emus scattered in every direction, like somebody kicked a bag of marbles."
  { const st = L(4), fl = Wd('flock', 4), op = Wd('opened', 4), sc = L(5), di = Wd('direction', 5), ma = Wd('marbles', 5), end = L(6);
    const CX = 7, CZ = -7;
    add({ id: 'S4', at: st, note: 'over the gunner\'s shoulder: a flock strolls in, the guns flash, and the camera rises as the emus burst outward in every direction like kicked marbles', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, sold1, sold2); OUT.update(t, { truckX: 4 }); OUT.truck.position.y = 0; OUT.truck.rotation.set(0, 0, 0);
      const firing = t > op && t < ma + 0.3;
      OUT.truck.gunHead.rotation.set(0, Math.PI + 0.25 + (firing ? Math.sin(t * 9) * 0.25 : 0) + (t > sc ? Math.sin(t * 3.1) * 0.5 : 0), 0);
      fire(OUT.truck.gunHead, t, firing, 1.0);
      act(sold1, 1.7, 2.05, { ...A.face(t, [[st, 'content'], [fl, 'excited'], [op, 'strain'], [sc + 0.3, 'shock'], [ma, 'dizzy']]), armL: [70, 40], armR: [75, 30], energy: firing ? 1.6 : 1, dx: firing ? Math.sin(t * 40) * 0.02 : 0 }, 1.17);
      act(sold2, 3.6, 3.1, { ...A.face(t, [[st, 'content'], [fl, 'gasp'], [op, 'excited'], [sc + 0.2, 'shock']]), ...A.react('point', t, fl, 1.2), ...A.react('shock', t, sc + 0.25, 0.6) });
      act(major, 5.3, 3.3, { ...A.face(t, [[st, 'smug'], [op, 'excited'], [sc + 0.3, 'shock'], [ma, 'worried']]), armR: A.arm(t, [[st, [30, 30]], [op - 0.1, [160, -20]], [sc + 0.3, [150, -15]]]), ...A.react('shock', t, sc + 0.3, 0.6) });
      for (let i = 0; i < 60; i++) {
        const [x0, z0] = spot(i + 100, CX, CZ + 2.2, 3.2, 4.4), arrive = clamp((t - st) / Math.max(0.5, op - st));
        let x = lerp(x0 + 6, x0, eo(arrive)), z = lerp(z0 - 8, z0, eo(arrive)), mode = 'walk', ph = t * 6 + i, flip = true;
        if (t > op && t < sc - 0.3) { mode = 'stand'; ph = i % 4; flip = i % 2 === 0; }        // startled by the first shots
        if (t > sc - 0.3) {                                          // then burst outward from the centre
          const a = Math.atan2(z0 - CZ, x0 - CX) + (rnd(i) - 0.5) * 0.5, sp = 1.5 + rnd(i * 7) * 2.0, u = Math.max(0, t - (sc - 0.3));
          x = x0 + Math.cos(a) * sp * u; z = Math.min(z0 + Math.sin(a) * sp * u * 0.8, -0.7 - rnd(i) * 0.5); mode = 'run'; ph = t * 14 + i; flip = Math.cos(a) < 0;
        }
        flockA.bird(i, x, z, { mode, phase: ph, flip });
      }
      const c = A.camPath(t, [
        [st, [-0.4, 3.3, 4.8], [3.0, 1.9, 0.6], 44],
        [fl + 0.3, [0.0, 3.4, 5.0], [6.0, 0.9, -7.0], 46],
        [op + 0.5, [0.8, 3.5, 5.4], [6.5, 0.8, -7.0], 46],
        [di, [7.4, 6.8, -0.6], [7.0, 0.0, -7.4], 58],
        [end, [7.5, 7.4, 0.0], [7.0, 0.0, -7.4], 62],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(fl, 'swoosh', { gain: 0.4 }); for (let k = 0; k < 8; k++) cue(op + k * 0.16, 'pop', { gain: 0.25 }); cue(sc + 0.1, 'swoosh', { gain: 0.5, sweep: 0.7 }); cue(ma, 'boing', { gain: 0.3 }); }

  // ── S5 · "So they set up an ambush by a water hole. A thousand emus came strolling right toward them." / "And the gun jammed."
  { const st = L(6), am = Wd('ambush', 6), wa = Wd('water', 6), th = Wd('thousand', 6), str = Wd('strolling', 6), ja = Wd('jammed', 7), end = L(8);
    add({ id: 'S5', at: st, note: 'the ambush: low behind hay bales by the water hole, the soldiers shush each other while a huge flock strolls in; on "jammed" a puff of smoke, wide eyes, every emu turns to look', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, sold1, sold2); OUT.update(t, { truckX: -60 });
      gun2Head.rotation.set(0, Math.PI + Math.sin(t * 0.7) * 0.08 + (t > ja ? A.jolt(t, ja, 0.5, 0.15) : 0), 0);
      const jam = clamp((t - ja) / 1.1); gun2Head.updateWorldMatrix(true, false); smoke.position.copy(gun2Head.localToWorld(V3(0, 0.2, 0.6))); smoke.setK(t > ja ? jam : 0, 1.1);
      act(sold1, 21.0, 1.7, { ...A.face(t, [[st, 'scheme'], [th, 'gasp'], [ja, 'shock'], [ja + 0.6, 'worried']]), armL: A.arm(t, [[st, [60, 50]], [ja + 0.1, [150, -15]]]), armR: A.arm(t, [[st, [70, 40]], [ja + 0.1, [150, -15]]]), ...A.react('shock', t, ja + 0.05, 0.5), energy: 0.8, talk: 0 });
      act(sold2, 23.2, 1.85, { ...A.face(t, [[st, 'scheme'], [am, 'sly'], [th, 'excited'], [ja + 0.05, 'shock']]), armR: A.arm(t, [[st, [30, 30]], [am, [140, 160]], [str, [40, 30]], [ja + 0.1, [150, -15]]]), energy: 0.8, talk: 0, ...A.react('shock', t, ja + 0.1, 0.5) });
      act(major, 24.6, 2.2, { ...A.face(t, [[st, 'smug'], [wa, 'scheme'], [th, 'excited'], [ja + 0.1, 'shock'], [ja + 0.7, 'angry']]), flush: t > ja + 0.6 ? 1 : 0, steam: t > ja + 0.8 ? 1 : 0,
        armR: A.arm(t, [[st, [20, 30]], [wa, [100, 70]], [ja + 0.6, [150, 40]]]), ...A.react('angry', t, ja + 0.7, 1.0), energy: 0.9 });
      for (let i = 0; i < 60; i++) {
        const [xe, ze] = spot(i + 200, 25.5, -7.5, 6, 9), come = clamp((t - th + 0.6) / 3.2), dly = rnd(i * 3) * 0.3;
        const u = eo(clamp(come - dly)); let x = lerp(xe + 10, xe, u), z = lerp(ze - 16, ze, u);
        if (Math.hypot(x - 24, (z + 7.5) * 1.6) < 3.6) z -= 2.6;              // nobody stands in the water
        const turned = t > ja + 0.1;
        flockA.bird(i, x, z, { mode: turned ? 'stand' : u > 0.98 ? 'peck' : 'walk', phase: turned ? (i % 4) : t * 5 + i, flip: !turned });
      }
      const c = A.camPath(t, [
        [st, [26.0, 1.8, 6.6], [23.2, 1.3, 1.6], 42],
        [am + 0.4, [24.6, 2.0, 7.0], [22.8, 1.15, 1.4], 44],
        [th, [23.0, 2.6, 7.0], [24.4, 0.6, -7.5], 46],
        [ja - 0.4, [22.6, 2.2, 6.6], [23.4, 0.9, -4.0], 46],
        [end, [22.4, 1.7, 6.2], [22.3, 1.2, 1.8], 42],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(st + 0.1, 'swoosh', { gain: 0.35 }); cue(th, 'swoosh', { gain: 0.35, sweep: 0.4 }); cue(ja, 'slam', { gain: 0.4 }); cue(ja + 0.15, 'pop', { gain: 0.4 }); cue(ja + 0.8, 'boing', { gain: 0.25 }); }

  // ── S6 · "Fine. They tied a machine gun to a truck and chased them." / "But the emus ran faster than the truck, and the ride was so bumpy the gunner couldn't even aim."
  { const st = L(8), fi = Wd('fine', 8), ti = Wd('tied', 8), ch = Wd('chased', 8), bu = L(9), fa = Wd('faster', 9), bm = Wd('bumpy', 9), ai = Wd('aim', 9), end = L(10);
    const x0 = -38, v = 6.2;
    add({ id: 'S6', at: st, note: 'the chase: one tracking shot beside the bouncing truck; the emus pull away easily while the gunner bounces off the bed and sprays the sky', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, sold1, sold2, ...emus.slice(0, 4));
      const u = Math.max(0, t - ti), tx = x0 + v * u * clamp(u / 1.2 + 0.3);
      OUT.update(t, { truckX: tx }); const bump = t > ti ? Math.abs(Math.sin(t * 9.5)) * 0.14 + Math.abs(Math.sin(t * 5.3)) * 0.06 : 0;
      OUT.truck.position.y = bump; OUT.truck.rotation.set(t > ti ? Math.sin(t * 6.3) * 0.03 : 0, 0, t > ti ? Math.sin(t * 7.1) * 0.035 : 0);
      const gunning = t > ch - 0.1;
      OUT.truck.gunHead.rotation.set(gunning ? -0.2 + Math.sin(t * 8.3) * 0.35 : 0, Math.PI + (gunning ? Math.sin(t * 5.7) * 0.9 + Math.sin(t * 13) * 0.3 : 0.2), 0);
      fire(OUT.truck.gunHead, t, gunning && t > bu, 1.0);
      act(sold1, tx - 1.9, 1.95, { ...A.face(t, [[st, 'deadpan'], [ti, 'excited'], [bu, 'strain'], [bm, 'dizzy']]), armL: [75, 35], armR: [70, 30], hopY: bump * 2.2 + (t > bm ? Math.abs(Math.sin(t * 11)) * 0.22 : 0), lean: Math.sin(t * 8) * 10, energy: 1.6 }, 1.17);
      act(major, tx + 0.55, 2.62, { ...A.face(t, [[st, 'angry'], [fi, 'deadpan'], [ch, 'excited'], [fa + 0.2, 'shock'], [ai, 'worried']]), flush: t < ti ? 0.6 : 0, armR: A.arm(t, [[st, [150, 40]], [ch, [160, -20]]]), armL: [80, 120], hopY: bump * 1.5, energy: 1.4 }, 0.6);
      act(sold2, tx - 0.4, 0.9, { mood: 'strain', armL: [60, 40], armR: [60, 40], hopY: bump * 1.8, lean: Math.sin(t * 9 + 1) * 8 }, 1.17);
      // emus: from beside the truck to well ahead of it (faster than the truck)
      const ex = (k) => lerp(tx + 2 + k * 1.5, tx + 9 + k * 2.4, clamp((t - bu) / (end - bu)));
      emus.slice(0, 4).forEach((e, k) => emuAct(e, t < ti ? x0 + 5 + k * 1.5 : ex(k), [-1.3, -2.4, -1.9, -3.1][k], { legs: t > ti ? 'run' : 'stand', phase: t * 15 + k, mood: t > fa ? 'smug' : 'happy', neck: t > ti ? 0.35 : undefined, peck: 0, flip: false, look: [-0.7, 0] }));
      for (let i = 0; i < 20; i++) flockA.bird(i, t < ti ? x0 + 4 + rnd(i) * 10 : tx + 4 + rnd(i) * 14 + (t - ti) * 1.6, -3.6 - rnd(i * 3) * 6, { mode: t < ti ? 'stand' : 'run', phase: t * 15 + i, flip: false });
      const c = A.camPath(t, [
        [st, [x0 + 4.0, 1.8, 7.2], [x0 + 0.6, 1.4, 1.5], 42],
        [ch, [tx + 2.2, 2.6, 10.6], [tx + 1.6, 1.1, -0.6], 50],
        [fa, [tx + 4.0, 2.8, 11.4], [tx + 4.0, 1.0, -1.2], 50],
        [bm - 0.1, [tx - 0.4, 2.7, 6.6], [tx - 1.8, 2.3, 1.6], 44],
        [end, [tx - 0.2, 2.6, 6.8], [tx - 1.5, 2.3, 1.5], 44],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(ti, 'chug', { gain: 0.45 }); for (let k = 0; k < 10; k++) cue(bu + 0.2 + k * 0.28, 'pop', { gain: 0.18 }); cue(fa, 'swoosh', { gain: 0.45, sweep: 0.6 }); cue(bm, 'boing', { gain: 0.35 }); cue(bm + 0.4, 'boing', { gain: 0.3 }); }

  // ── S7 · "Newspapers made fun of them."  (a soldier reads the paper; the major fumes)
  { const st = L(10), fu = Wd('fun', 10), end = Wd('lawmakers', 10) - 0.05;
    add({ id: 'S7', at: st, note: 'start tight on the newspaper headline in a soldier\'s hands, pull back to the soldiers laughing and the major turning red and steaming', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, sold1, sold2); OUT.update(t, { truckX: 4 }); OUT.truck.position.y = 0; OUT.truck.rotation.set(0, 0, 0); OUT.truck.gunHead.rotation.set(0, 0.6, 0);
      crates.slice(0, 3).forEach((c) => { c.visible = true; c.scale.setScalar(1); });
      act(sold2, 2.05, 3.9, { ...A.face(t, [[st, 'laugh']]), armL: [62, 112], armR: [62, 112], ...A.react('laugh', t, st + 0.1, 2.5), talk: 0.5 });
      paper.visible = true; paper.position.set(2.05 + Math.sin(t * 20) * 0.01, 1.08 + Math.sin(t * 28) * 0.015, 4.25); paper.rotation.set(-0.05, 0, Math.sin(t * 9) * 0.03);
      act(sold1, 1.0, 3.4, { ...A.face(t, [[st, 'laugh']]), ...A.react('laugh', t, st + 0.3, 2.2) });
      act(major, 2.95, 3.75, { ...A.face(t, [[st, 'shock'], [fu, 'angry']]), flush: clamp((t - fu + 0.2) / 0.5), steam: t > fu ? 1 : 0, ...A.react('angry', t, fu + 0.05, 1.2), energy: 1.3 });
      const c = A.camPath(t, [
        [st, [2.15, 1.15, 5.7], [2.08, 1.1, 4.2], 34],
        [end + 0.3, [2.7, 1.5, 7.4], [2.45, 1.35, 3.9], 42],
      ]);
      SHOOT(OUT.scene, c); blit();
    } });
    cue(st + 0.05, 'pop', { gain: 0.3 }); cue(fu + 0.05, 'boing', { gain: 0.3 }); }

  // ── S8 · "Lawmakers asked if the soldiers would get medals for surviving."
  { const st = Wd('lawmakers', 10) - 0.05, me = Wd('medals', 10), su = Wd('surviving', 10), end = L(11);
    add({ id: 'S8', at: st, trans: 'dissolve', motes: 10, note: 'parliament: glide past green benches of chuckling lawmakers to one holding up a medal on a cushion; on "surviving" the whole room bursts out laughing', draw(lt, d, t, blit) {
      hideAll(); into(PAR.scene, ...mps);
      act(mps[0], -1.15, -0.5, { ...A.face(t, [[st, 'smug'], [me, 'skeptic'], [su, 'laugh']]), ...A.react('laugh', t, su + 0.05, 1.4) });
      act(mps[2], 1.15, -0.9, { ...A.face(t, [[st, 'content'], [me, 'excited'], [su, 'laugh']]), ...A.react('laugh', t, su + 0.15, 1.3) });
      act(mps[3], -0.35, -3.0, { ...A.face(t, [[st, 'happy'], [su, 'laugh']]), ...A.react('laugh', t, su, 1.4) }, 0.35);
      const lift = A.pop(t, me - 0.2, 0.4);
      act(mps[1], 0.05, 0.7, { ...A.face(t, [[st, 'smug'], [me, 'proud'], [su, 'laugh']]), armR: t > me - 0.2 ? [150, -20] : [30, 30], armL: t > me - 0.2 ? [150, -20] : [30, 30], ...A.react('laugh', t, su + 0.1, 1.2), still: true });
      med.position.set(0.05, lerp(0.9, 2.05, clamp(lift)), lerp(-0.3, 0.85, clamp(lift))); med.coin.rotation.y = t * 2; med.rotation.set(0.5 * clamp(lift), Math.sin(t) * 0.2, 0);
      const c = A.camPath(t, [
        [st, [-2.8, 1.8, 5.4], [-0.8, 1.3, -0.6], 44],
        [me, [-0.8, 1.75, 5.2], [0.0, 1.45, -0.3], 44],
        [end, [0.7, 1.9, 5.4], [0.1, 1.45, -0.6], 46],
      ]);
      SHOOT(PAR.scene, c); blit();
    } });
    cue(me, 'ding', { gain: 0.35 }); cue(su + 0.05, 'boing', { gain: 0.25 }); }

  // ── S9 · "You see, emus don't march in a line like an army. Every flock had a tall lookout, and the moment anything went bang, they split up." /
  //         "It's like trying to swat a hundred flies with one rolled up newspaper." / "The major even admitted these birds could take bullets like tanks."
  { const st = L(11), lo = Wd('lookout', 11), ba = Wd('bang', 11), sp = Wd('split', 11), sw = L(12), fl = Wd('flies', 12), ma = L(13), ta = Wd('tanks', 13), end = L(14);
    const CX = -13, CZ = -7;
    add({ id: 'S9', at: st, trans: 'dissolve', note: 'how emus fight: a calm flock pecks while a tall lookout watches from a hay bale; on "bang" the flock splits four ways; the major swats wildly with a rolled newspaper at emus running rings round him; a bullet pings off a smug emu that keeps strutting', draw(lt, d, t, blit) {
      hideAll(); into(OUT.scene, major, lookout, ...emus.slice(0, 4)); OUT.update(t, { truckX: 60 });
      emuAct(lookout, -12.5, -4.2, { mood: t > ba ? 'shock' : 'neutral', neck: t > ba ? -0.1 : Math.sin(t * 1.2) * 0.5, look: [Math.sin(t * 1.3) * 0.8, 0], peck: 0, tilt: Math.sin(t * 2) * 14, flip: Math.sin(t * 0.8) > 0.3 }, 1.48);
      const split = t > ba;
      for (let i = 0; i < 48; i++) {
        const [x0, z0] = spot(i + 300, CX, CZ + 4, 6, 6), grp = i % 4, a = [0.6, 2.4, 3.6, 5.4][grp] + (rnd(i) - 0.5) * 0.4, u = Math.max(0, t - ba - rnd(i) * 0.12);
        const x = split ? x0 + Math.cos(a) * u * 6.5 : x0, z = Math.min(-0.8, split ? z0 + Math.sin(a) * u * 4.5 : z0);
        flockA.bird(i, x, z, { mode: split ? 'run' : (i % 3 ? 'peck' : 'stand'), phase: split ? t * 14 + i : t * 2.5 + i, flip: split ? Math.cos(a) < 0 : i % 2 === 0 });
      }
      // the major and his newspaper vs the emus running rings round him
      const mx = -9.0, mz = -1.2, swat = t > sw - 0.1 && t < ma + 0.3;
      act(major, mx, mz, { ...A.face(t, [[st, 'skeptic'], [sw, 'strain'], [fl, 'angry'], [ma, 'shock'], [ta, 'worried']]), flush: swat ? 0.8 : 0, steam: swat && t > fl ? 1 : 0,
        holdR: swat ? rolledPaper : undefined, armR: swat ? A.arm(t, [...Array(12)].map((_, k) => [sw + k * 0.3, k % 2 ? [160, -40] : [50, 70]])) : A.arm(t, [[st, [30, 30]], [ma, [150, -15]]]),
        armL: t > ma ? [150, -15] : [40, 60], ...A.react('shock', t, ma + 0.1, 0.6), ...A.react('shrug', t, ta + 0.2, 1.0), energy: swat ? 1.6 : 1 });
      emus.slice(0, 4).forEach((e, k) => { if (t < sw - 0.3) { e.group.visible = false; return; }
        const a = t * 2.2 + k * Math.PI / 2, x = mx + Math.cos(a) * 2.0, z = mz - 0.6 + Math.sin(a) * 1.0;
        const tank = k === 0 && t > ma; emuAct(e, tank ? lerp(mx + 2.2, mx + 0.6, clamp((t - ma) / 2.4)) : x, tank ? mz - 0.2 : z, { legs: tank ? 'walk' : 'run', phase: t * (tank ? 6 : 14) + k, mood: tank ? 'smug' : 'happy', flip: tank ? true : Math.sin(a) > 0, neck: 0.25, peck: 0 }); });
      const c = A.camPath(t, [
        [st, [CX + 3.0, 4.6, 6.0], [CX, 0.6, CZ + 1.0], 48],
        [lo - 0.2, [-11.4, 2.6, 0.6], [-12.5, 2.4, -4.2], 40],
        [sp + 0.2, [CX + 2.5, 7.4, 6.4], [CX, 0.2, CZ + 0.5], 52],
        [sw + 0.5, [mx + 0.5, 1.9, 3.8], [mx, 1.3, mz - 0.4], 46],
        [ma + 0.6, [mx + 1.3, 1.7, 3.2], [mx + 0.8, 1.25, mz - 0.3], 44],
        [end, [mx + 0.7, 1.7, 3.2], [mx + 0.4, 1.35, mz - 0.4], 42],
      ]);
      SHOOT(OUT.scene, c);
      if (t > ta - 0.4 && t < ta + 0.8) { const [sx, sy] = proj(emus[0].group.position.clone().add(V3(0, 1.0, 0))); FX.sparkle(sx, sy, t, 1, 70); }
      blit();
    } });
    cue(lo, 'ding', { gain: 0.25 }); cue(ba, 'slam', { gain: 0.5 }); cue(sp, 'swoosh', { gain: 0.5, sweep: 0.8 }); for (let k = 0; k < 6; k++) cue(sw + 0.15 + k * 0.6, 'swoosh', { gain: 0.2, sweep: k % 2 ? 0.5 : -0.5 }); cue(ta - 0.3, 'tock', { gain: 0.4 }); cue(ta + 0.1, 'ding', { gain: 0.3 }); }

  // ── S10 · "After about five weeks, the army packed up and went home." / "Thousands of bullets later, the emus were still eating the wheat." /
  //          "And the major's official report proudly said his men suffered no casualties."
  { const st = L(14), pa = Wd('packed', 14), ho = Wd('home', 14), th = L(15), wh = Wd('wheat', 15), rp = L(16), of = Wd('official', 16), ca = Wd('casualties', 16), end = T.dur;
    add({ id: 'S10', at: st, trans: 'dissolve', note: 'sunset: the soldiers load the last crates and the truck pulls away; the camera drifts over emus still eating the wheat, then catches up with the truck where the major proudly holds up his report (CASUALTIES: NONE) while an emu rides along behind him', draw(lt, d, t, blit) {
      hideAll(); into(DUSK.scene, major, sold1, sold2, lookout);
      const go = Math.max(0, t - ho), tx = go * 1.5 + go * go * 0.12;
      DUSK.update(t, { truckX: tx }); DUSK.truck.gunHead.rotation.set(0, 0.4, 0);
      duskCrates.forEach((c, i) => { const lift = clamp((t - st - 0.4 - i * 0.6) / 0.6); c.position.set(lerp(tx - 1.2 + i * 0.7, tx - 2.3 + i * 0.75, lift), lerp(0, 1.16, eio(lift)) + Math.sin(Math.PI * lift) * 0.4, lerp(3.4, 1.3, lift)); });
      act(sold1, tx - 1.7, 1.0, { ...A.face(t, [[st, 'tired'], [pa, 'sad'], [rp, 'deadpan']]), armL: A.arm(t, [[st, [90, 40]], [pa + 0.6, [20, 20]]]), armR: A.arm(t, [[st, [90, 40]], [pa + 0.6, [20, 20]]]), energy: 0.6, sweat: 1 }, 1.17);
      act(sold2, t < ho ? lerp(-1.6, -0.4, clamp((t - st) / 1.4)) : tx - 0.6, t < ho ? 3.3 : 0.9, { ...A.face(t, [[st, 'tired'], [ho, 'sad']]), ...A.react('sad', t, ho - 0.3, 1.2), energy: 0.6 }, t < ho ? 0 : 1.17);
      act(major, tx - 1.05, 1.45, { ...A.face(t, [[st, 'deadpan'], [of, 'proud'], [ca, 'smug']]), armL: t > rp ? [62, 112] : [20, 20], armR: t > rp ? [62, 112] : [20, 20], ...A.react('proud', t, ca + 0.2, 1.4), energy: 0.8 }, 1.17);
      rep.visible = t > rp - 0.2; rep.position.set(tx - 1.05, 1.17 + 1.05, 1.45 + 0.22); rep.rotation.set(-0.05, 0, Math.sin(t * 3) * 0.04);
      if (t > th) emuAct(lookout, tx - 0.32, 0.4, { mood: 'sly', look: [-0.8, 0.4], peck: 0, neck: -0.15, flip: true }, 1.17);
      for (let i = 0; i < 24; i++) { const [x, z] = spot(i + 400, -5, -2.5, 9, 9); flockD.bird(i, x, Math.min(-0.8, z), { mode: i % 4 ? 'peck' : 'stand', phase: t * 3 + i, flip: i % 2 === 0 }); }
      const c = A.camPath(t, [
        [st, [-1.2, 1.9, 7.8], [-0.6, 1.2, 2.2], 44],
        [ho + 0.3, [1.0, 2.2, 8.6], [1.6, 1.2, 1.4], 46],
        [th + 0.5, [-3.6, 2.8, 6.4], [-4.6, 0.6, -5.0], 48],
        [wh + 0.3, [-2.4, 2.0, 5.2], [-3.4, 0.8, -3.2], 44],
        [rp + 0.3, [tx + 1.2, 2.7, 6.4], [tx - 1.0, 2.15, 1.4], 42],
        [of + 0.4, [tx + 0.5, 2.65, 5.8], [tx - 1.05, 2.15, 1.4], 40],
        [end, [tx + 0.35, 2.6, 5.4], [tx - 0.92, 2.2, 1.4], 38],
      ]);
      shoot(DUSK.scene, all, c, { ...LK, bloom: 0.2 }); blit();
    } });
    cue(st + 0.2, 'swoosh', { gain: 0.35 }); cue(ho, 'chug', { gain: 0.35 }); cue(th + 0.2, 'swoosh', { gain: 0.4, sweep: -0.5 }); cue(rp + 0.1, 'swoosh', { gain: 0.35 }); cue(ca + 0.2, 'ding', { gain: 0.4 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
