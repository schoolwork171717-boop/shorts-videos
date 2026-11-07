// WHY OLD COFFINS HAD DOORBELLS — kit v8.4: dusk graveyard (cool), warm lanterns, long flying takes, a cut-away grave,
// in-world signs, a boxing-ring punchline.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Le, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as GY from './core/graveyard.js';
import * as ST from './core/store.js';
import * as A from './core/act.js';
import { Toon, INK, PROPS } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let NOW = 0;
const LOOK = {
  gent: { body: '#5A4A7A', pattern: 'vest', patCol: '#3E3258', hat: 'tophat', hatCol: '#2A2830', neck: 'bowtie', neckCol: '#D8343F', extra: ['mustache'], mustacheCol: '#5A3A22' },
  doctor: { body: '#2E3A5A', pattern: 'jacket', patCol: '#222C46', hat: 'bowler', hatCol: '#2A2830', neck: 'tie', neckCol: '#F2C230', extra: ['glasses', 'beard'], beardCol: '#8A5A3A' },
  sleeper: { body: '#E8E2D4', pattern: 'plain', hair: '#7A4A2A', extra: ['freckles'] },
  watch: { body: '#3C5A7A', pattern: 'jacket', patCol: '#2E465E', hat: 'cap', hatCol: '#2A2830', extra: ['mustache'], mustacheCol: '#9A9AA4', neck: 'scarf', neckCol: '#D8734A' },
  boxA: { body: '#D8343F', pattern: 'plain', hair: '#2A2830', gloves: '#D8343F', extra: ['blush'] },
  boxB: { body: '#3C6FB6', pattern: 'plain', hair: '#C8783A', gloves: '#3C6FB6', extra: ['freckles'] },
  ref: { body: '#F4F4F8', pattern: 'stripes', patCol: '#2A2830', neck: 'bowtie', neckCol: '#2A2830', hair: '#5A5A64', extra: ['mustache'] },
};
function lanternProp(g, x, y) { PROPS.lantern(g, x, y); }
function shovelProp(g, x, y) { g.save(); g.translate(x, y); g.rotate(0.35); g.strokeStyle = INK; g.lineWidth = 6; g.fillStyle = '#9A6A3E'; g.beginPath(); g.rect(-6, -150, 12, 210); g.fill(); g.stroke(); g.fillStyle = '#B8C0CC'; g.beginPath(); g.moveTo(-28, 60); g.lineTo(28, 60); g.lineTo(22, 130); g.quadraticCurveTo(0, 150, -22, 130); g.closePath(); g.fill(); g.stroke(); g.restore(); }
function toastProp(g, x, y) { g.save(); g.translate(x, y - 30); g.fillStyle = '#C8843A'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-34, -36, 68, 64, 14); g.fill(); g.stroke(); g.fillStyle = '#F2D8A0'; g.beginPath(); g.roundRect(-24, -26, 48, 44, 10); g.fill(); g.restore(); }

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); FX.motes(t, { n: o.motes ?? 20, col: '200,210,255', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.18, bloomThreshold: 0.95, aperture: 0.0005, maxblur: 0.005 };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); if (c.fov >= 38 && c.fov <= 44) cam.position.lerp(V3(...c.look), 0.12);
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => { q.face(cam); if (q.flat) q.pivot.rotation.y = 0; }); E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
  };
  const act = (p, x, z, o = {}, y = 0, k = 1) => {
    const al = A.alive(NOW, p.seed, 1), pf = A.perform(NOW, p.seed, o.energy ?? k, { talk: o.talk ?? 1 });
    p.group.visible = true; p.at(x + (o.still ? 0 : pf.dx) + (o.dx || 0), y + (o.hopY || 0), z);
    const st = { look: al.look, blink: al.blink, ...pf, tilt: pf.tilt + al.tilt, ...o }; delete st.dx; delete st.hopY; delete st.energy; delete st.still;
    Object.keys(st).forEach((k2) => st[k2] === undefined && delete st[k2]);
    if (st.steam) st.steamT = NOW; p.set(st); A.applySquash(p, st.squash || 0);
    p.mesh.rotation.set(0, 0, 0); p.blob.visible = true; p.flat = false;
  };
  // a person lying on their back in the coffin, facing the camera (the cut-out turned in its own plane)
  const lie = (p, x, y, z, o = {}) => { act(p, x, z, { ...o, still: true }, y); p.mesh.rotation.x = -Math.PI / 2; p.blob.visible = false; p.flat = true; };   // flat on its back, seen from above
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });

  // ── sets ──
  const G = GY.graveyard(E), RING = GY.boxingRing(E);
  const tally = ST.board(1.3, 0.8); tally.position.set(4.3, 0, -0.4); tally.scale.setScalar(0.8); G.scene.add(tally);
  const saved = ST.board(1.6, 0.9); saved.position.set(-3.2, 0, -1.2); G.scene.add(saved); saved.draw([['SAFETY COFFINS', '#F2C230', 48, 80], ['PEOPLE SAVED:', '#FFFFFF', 56, 200], ['0', '#FF8A80', 120, 320]]);
  const food = [0, 1, 2].map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.strokeStyle = INK; g.lineWidth = 6;
    if (i === 0) { g.fillStyle = '#F4EFE4'; g.beginPath(); g.ellipse(64, 70, 46, 30, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#E8A040'; g.beginPath(); g.ellipse(64, 62, 36, 14, 0, 0, 7); g.fill(); }
    else if (i === 1) { g.fillStyle = '#B8563A'; g.beginPath(); g.roundRect(18, 46, 92, 36, 18); g.fill(); g.stroke(); }
    else { g.fillStyle = '#F2C230'; g.beginPath(); g.rect(34, 30, 54, 76); g.fill(); g.stroke(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(50, 30, 14, 0, 7); g.arc(72, 28, 14, 0, 7); g.fill(); g.beginPath(); g.arc(98, 66, 14, -1.5, 1.5); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(0.32, 0.32, 1); s.visible = false; G.scene.add(s); return s; });
  const notes = [...Array(6)].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#F2C230'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.ellipse(48, 92, 22, 16, -0.4, 0, 7); g.fill(); g.stroke(); g.fillRect(64, 20, 8, 72); g.strokeRect(64, 20, 8, 72); g.beginPath(); g.moveTo(72, 20); g.quadraticCurveTo(104, 34, 98, 62); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(0.3, 0.3, 1); s.visible = false; G.scene.add(s); return s; });
  const alarm = new THREE.Group(); alarm.position.set(2.3, 1.6, -0.9); alarm.scale.setScalar(1.8); G.scene.add(alarm);
  const alarmBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 20), new THREE.MeshStandardMaterial({ color: '#C9CED8' })); alarmBody.rotation.x = Math.PI / 2; alarm.add(alarmBody);
  { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#D9DDE5'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill(); g.strokeStyle = '#8A90A0'; g.lineWidth = 6;   // v9: a real-looking alarm face (vents, button, label) instead of a glowing white disc
    [110, 84].forEach((r) => { g.beginPath(); g.arc(128, 128, r, 0, 7); g.stroke(); }); g.lineWidth = 5; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.beginPath(); g.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); g.lineTo(128 + Math.cos(a) * 106, 128 + Math.sin(a) * 106); g.stroke(); }
    g.fillStyle = '#B8BECA'; g.beginPath(); g.arc(128, 128, 40, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#5A6070'; g.font = '900 20px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('TEST', 128, 136);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const face = new THREE.Mesh(new THREE.CircleGeometry(0.158, 32), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 })); face.position.z = 0.037; alarm.add(face); }
  const alarmLed = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#FF3030', toneMapped: false })); alarmLed.position.set(0.09, 0.09, 0.045); alarm.add(alarmLed); alarm.visible = false;
  const table = new THREE.Group(); table.position.set(2.2, 0, -0.6); G.scene.add(table);
  [[0.4, 0.75, 0.5]].forEach(() => { const m = new THREE.MeshStandardMaterial({ color: '#8A5A36' }); const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.5), m); top.position.y = 0.75; top.castShadow = true; table.add(top); [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), m); l.position.set(x, 0.375, z); table.add(l); }); });
  const toaster = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: '#B8C0CC', metalness: 0.5, roughness: 0.3 })); toaster.position.set(0.1, 0.89, 0); toaster.castShadow = true; table.add(toaster);
  const toast = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.03), new THREE.MeshStandardMaterial({ color: '#C8843A' })); toast.position.set(0.1, 0.95, 0); table.add(toast); table.visible = false;

  // ── cast ──
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const gent = mk('gent', 1), doctor = mk('doctor', 2), sleeper = mk('sleeper', 3, 1.6), watch = mk('watch', 4), boxA = mk('boxA', 5), boxB = mk('boxB', 6), ref = mk('ref', 7);
  const all = [gent, doctor, sleeper, watch, boxA, boxB, ref];
  const hideAll = () => { all.forEach((p) => (p.group.visible = false)); food.forEach((f) => (f.visible = false)); notes.forEach((n) => (n.visible = false)); G.flag.visible = false; tally.visible = false; saved.visible = false; alarm.visible = false; table.visible = false; G.cut.lid.visible = false; };
  const ring = (b, t, t0, dur = 0.9) => { const k = t - t0; b.bell.rotation.z = k > 0 && k < dur ? Math.sin(k * 30) * 0.5 * (1 - k / dur) : 0; };
  const ringNote = (i, x, y, z, t, t0) => { const k = clamp((t - t0) / 0.9), n = notes[i]; n.visible = t > t0 && k < 1; n.position.set(x + (i % 2 ? 0.2 : -0.2), y + k * 0.6, z); n.material.opacity = 1 - k; };
  const B0 = G.bells[0], CZ = 1.0, CY = -2.45;     // the sleeper's feet in the cut-away coffin; PIT = looking down into the grave
  const PIT = (dz = 0, h = 0) => [[0.1, 3.5 + h, 1.9 + dz], [0.0, -2.4, 0.2], 44];     // cut-away coffin

  // ── S1 · "In the eighteen hundreds, people were so scared of being buried alive, they started building coffins with doorbells."
  { const st = 0, sc = Wd('scared', 0), bu = Wd('buried', 0), co = Wd('coffins', 0), dbl = Wd('doorbells', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open on a bell post jingling over a fresh grave at dusk; a top-hatted gent jumps; the camera rises to reveal rows of graves, each with its own little bell', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, gent);
      ring(B0, t, 0.15); ring(B0, t, dbl); G.bells.slice(1).forEach((b, i) => ring(b, t, dbl + 0.05 * i));
      ringNote(0, B0.x, 1.5, B0.z, t, 0.15); ringNote(1, B0.x, 1.5, B0.z, t, dbl);
      act(gent, 1.1, 1.0, { ...A.face(t, [[st, 'shock'], [sc, 'worried'], [bu, 'gasp'], [co, 'skeptic'], [dbl, 'shock']]), sweat: 1, ...A.react('shock', t, 0.2, 0.6), ...A.react('shock', t, dbl + 0.1, 0.6), hopY: A.hop(t, 0.2, 0.35, 0.25), energy: 1.3 });
      const c = A.camPath(t, [
        [st, [0.5, 1.45, 0.4], [-0.3, 1.25, -1.25], 36],
        [bu, [1.9, 1.7, 3.6], [0.6, 1.3, 0.3], 42],
        [end, [0.5, 4.2, 7.5], [0.0, 0.6, -4.0], 50],
      ]);
      shoot(G.scene, c); blit();
    } });
    cue(0.15, 'ding', { gain: 0.45 }); cue(bu, 'gulp', { gain: 0.3 }); cue(dbl, 'ding', { gain: 0.45 }); cue(dbl + 0.25, 'ding', { gain: 0.3 }); }

  // ── S2 · "Strings were tied to your hands and feet, and they ran up through the dirt to a little bell above your grave." /
  //         "If you woke up underground, you just wiggled. Ding! Somebody would come dig you out."
  { const st = L(1), ha = Wd('hands', 1), ra = Wd('ran', 1), be = Wd('bell', 1), wo = L(2), wi = Wd('wiggled', 2), di = Wd('ding', 2), dg = Wd('dig', 2), end = L(3);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'the cut-away grave: a sleeper in the coffin with a string from his hand up through the dirt; the camera follows the string up to the bell; he wakes, wiggles, ding, and a watchman runs in with a shovel', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, sleeper, watch);
      const awake = t > wo; lie(sleeper, 0.0, CY, CZ, { mood: awake ? (t > wi ? 'excited' : 'gasp') : 'tired', blink: awake ? 0 : 1, armR: t > wi ? [150 + Math.sin(t * 20) * 20, -20] : [20, 20], dx: t > wi && t < dg ? Math.sin(t * 25) * 0.03 : 0 });
      ring(B0, t, di - 0.05); ringNote(0, B0.x, 1.5, B0.z, t, di - 0.05);
      const run = clamp((t - dg + 0.5) / 1.0); act(watch, lerp(4.5, 0.9, eo(run)), 1.4, { ...A.face(t, [[st, 'gasp'], [dg, 'excited']]), legs: run > 0 && run < 1 ? 'walk' : undefined, phase: t * 10, holdR: shovelProp, armR: [60, 40], energy: 1.5 });
      watch.group.visible = t > dg - 0.5;
      const c = A.camPath(t, [
        [st, ...PIT()],
        [ha + 0.2, ...PIT(-0.4, -0.4)],
        [ra + 0.2, [0.9, 1.6, 2.6], [-0.2, 0.4, -1.0], 46],
        [be, [0.5, 1.5, 1.6], [-0.3, 1.25, -1.25], 40],
        [wo + 0.3, ...PIT(-0.3, -0.3)],
        [di - 0.1, [0.6, 2.4, 3.6], [-0.2, 0.2, -0.6], 50],
        [end, [1.4, 1.6, 4.4], [0.6, 1.0, 0.4], 44],
      ]);
      shoot(G.scene, c); blit();
    } });
    cue(be, 'ding', { gain: 0.3 }); cue(wi, 'boing', { gain: 0.3 }); cue(di - 0.05, 'ding', { gain: 0.5 }); cue(dg - 0.3, 'swoosh', { gain: 0.35 }); }

  // ── S3 · "One doctor was so sure about his design, he had himself buried alive to prove it." /
  //         "He stayed down there for hours, and they even sent him a lunch of soup, sausages, and beer through a pipe."
  { const st = L(3), su = Wd('sure', 3), bu = Wd('buried', 3), pr = Wd('prove', 3), ho = L(4), sp = Wd('soup', 4), sa = Wd('sausages', 4), bb = Wd('beer', 4), pi = Wd('pipe', 4), end = L(5);
    add({ id: 'S3', at: st, trans: 'dissolve', note: 'a proud doctor thumbs his own coffin, hops in; cut-away: he lounges happily underground while soup, sausages and beer slide down the pipe to him', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, doctor, gent);
      const inside = t > pr + 0.3;
      if (!inside) { act(doctor, 0.6, 0.9, { ...A.face(t, [[st, 'proud'], [su, 'smug'], [bu, 'excited']]), armR: A.arm(t, [[st, [30, 30]], [su, [150, -40]], [bu, [90, 80]]]), hopY: A.hop(t, pr - 0.1, 0.4, 0.4) });
        act(gent, -1.2, 1.4, { ...A.face(t, [[st, 'skeptic'], [bu, 'shock']]), sweat: 1 }); }
      else lie(doctor, 0.0, CY, CZ, { mood: t > sp ? 'happy' : 'content', armR: [150, -20], armL: t > bb + 0.4 ? [110, 60] : [20, 20], holdL: t > bb + 0.4 ? PROPS.cup : undefined });
      [sp, sa, bb].forEach((t0, i) => { const k = clamp((t - t0) / 0.7), f = food[i]; f.visible = t > t0 && t < t0 + 1.0; f.position.set(0.25, lerp(-0.1, CY + 0.35, eio(k)), 0.45); });
      const c = A.camPath(t, [
        [st, [1.6, 1.6, 4.0], [0.2, 1.2, 0.6], 42],
        [pr, [0.8, 1.2, 4.0], [0.3, 0.6, 0.6], 44],
        [ho, ...PIT()],
        [sp, ...PIT(-0.2, 0.3)],
        [end, ...PIT(-0.5, -0.4)],
      ]);
      shoot(G.scene, c); blit();
    } });
    cue(pr, 'boing', { gain: 0.3 }); cue(sp, 'slide', { gain: 0.3 }); cue(sa, 'slide', { gain: 0.3 }); cue(bb, 'slide', { gain: 0.3 }); cue(pi, 'plop', { gain: 0.35 }); }

  // ── S4 · "Another inventor added a flag that popped up, and one man spent nine whole days inside his coffin."
  { const st = L(5), fl = Wd('flag', 5), po = Wd('popped', 5), ni = Wd('nine', 5), end = L(6);
    add({ id: 'S4', at: st, trans: 'dissolve', note: 'a red flag springs up from a grave; the tally board beside it counts DAY 1 to DAY 9 while the man inside drums his fingers', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, sleeper);
      G.flag.visible = true; const up = A.pop(t, po - 0.1, 0.5); G.flag.scale.set(1, Math.max(0.01, Math.min(1.15, up)), 1); G.flag.cloth.rotation.y = Math.sin(t * 6) * 0.2;
      tally.visible = true; const day = Math.max(1, Math.min(9, 1 + Math.floor((t - ni + 0.8) * 6))); tally.draw([['DAY', '#F2C230', 70, 120], [String(day), '#FFFFFF', 160, 280]]);
      lie(sleeper, 0.0, CY, CZ, { mood: t > ni ? 'tired' : 'deadpan', armR: [90 + Math.sin(t * 12) * 10, 40] });
      const c = A.camPath(t, [
        [st, [4.6, 1.4, 3.0], [3.6, 1.4, -0.6], 42],
        [ni - 0.2, [3.4, 1.6, 4.2], [3.2, 1.0, -0.4], 46],
        [ni + 0.9, ...PIT(0.2, 0.2)],
        [end, ...PIT(-0.2)],
      ]);
      shoot(G.scene, c); blit();
    } });
    cue(po, 'boing', { gain: 0.4 }); for (let k = 0; k < 6; k++) cue(Wd('nine', 5) - 0.6 + k * 0.17, 'tock', { gain: 0.2 }); }

  // ── S5 · "Cemeteries hired night watchmen just to listen for bells." / "And the bells did ring. A lot."
  { const st = L(6), li = Wd('listen', 6), an = L(7), lo = Wd('lot', 7), end = L(8);
    add({ id: 'S5', at: st, trans: 'dissolve', note: 'a night watchman with a lantern sits cupping his ear among the bell posts; then every bell in the yard starts swinging and he spins round, head to head', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, watch);
      G.bells.forEach((b, i) => { const t0 = an + 0.1 + (i % 7) * 0.12; b.bell.rotation.z = t > t0 ? Math.sin((t - t0) * 28 + i) * 0.45 : 0; });
      for (let i = 0; i < 6; i++) { const b = G.bells[1 + i * 2] || G.bells[0]; ringNote(i, b.x, 1.5, b.z, t, an + 0.15 + i * 0.12); }
      act(watch, 1.0, 1.2, { ...A.face(t, [[st, 'content'], [li, 'scheme'], [an, 'gasp'], [lo, 'shock']]), holdL: lanternProp, armL: [70, 40], armR: t < an ? [150, 120] : [30, 30], tilt: t > an ? Math.sin(t * 9) * 14 : 0, sweat: t > lo ? 1 : 0, energy: t > an ? 1.6 : 0.8, talk: 0 });
      const c = A.camPath(t, [
        [st, [2.4, 1.5, 3.6], [1.0, 1.3, 1.0], 40],
        [an, [2.0, 1.7, 4.6], [0.6, 1.2, 0.0], 44],
        [end, [1.0, 4.6, 8.0], [0.0, 0.8, -4.0], 52],
      ]);
      shoot(G.scene, c); blit();
    } });
    for (let k = 0; k < 8; k++) cue(L(7) + 0.1 + k * 0.15, 'ding', { gain: 0.25 }); }

  // ── S6 · "You see, after someone dies, the body swells up and shifts as it breaks down. So the strings would tug, and the bell would jingle." /
  //         "It's like a smoke alarm that goes off every single time you make toast."
  { const st = L(8), sw = Wd('swells', 8), sh = Wd('shifts', 8), tu = Wd('tug', 8), ji = Wd('jingle', 8), sm = L(9), al = Wd('alarm', 9), to = Wd('toast', 9), end = L(10);
    add({ id: 'S6', at: st, trans: 'dissolve', note: 'the cut-away again with a cartoon dummy in a suit: it puffs up like a balloon and shifts, the string tugs, the bell jingles; then the watchman at his little table pops toast and the smoke alarm on the lamp post screams', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, sleeper, watch);
      const puff = clamp((t - sw) / 0.8); lie(sleeper, (t > sh ? Math.sin(t * 3) * 0.05 : 0), CY, CZ, { mood: 'tired', blink: 1, squash: -0.25 * puff, armR: t > tu ? [60, 20] : [20, 20] });
      ring(B0, t, ji - 0.05); ringNote(0, B0.x, 1.5, B0.z, t, ji - 0.05);
      const kitchen = t > sm - 0.3; table.visible = kitchen; alarm.visible = kitchen;
      const pop = A.pop(t, to - 0.15, 0.4); toast.position.y = 0.95 + (t > to - 0.15 ? Math.min(1, pop) * 0.18 : 0);
      alarmLed.visible = t > to && Math.floor(t * 8) % 2 === 0; alarm.rotation.z = t > to ? Math.sin(t * 40) * 0.05 : 0;
      if (kitchen) act(watch, 1.7, -0.2, { ...A.face(t, [[sm - 0.3, 'happy'], [to, 'shock'], [to + 0.6, 'angry']]), armL: t > to ? [160, 120] : [40, 60], armR: t > to ? [160, 120] : [70, 60], holdR: t < to ? toastProp : undefined, flush: t > to + 0.5 ? 0.7 : 0, ...A.react('shock', t, to, 0.6) });
      const c = A.camPath(t, [
        [st, ...PIT()],
        [tu, ...PIT(0.3, 0.3)],
        [ji, [0.5, 1.5, 1.6], [-0.3, 1.25, -1.25], 40],
        [sm + 0.2, [2.8, 1.6, 2.8], [2.0, 1.3, -0.6], 42],
        [end, [2.6, 1.7, 2.6], [2.2, 1.55, -0.8], 40],
      ]);
      shoot(G.scene, c); blit();
    } });
    cue(sw, 'boing', { gain: 0.3 }); cue(ji - 0.05, 'ding', { gain: 0.45 }); cue(to - 0.15, 'pop', { gain: 0.4 }); for (let k = 0; k < 6; k++) cue(Wd('toast', 9) + k * 0.13, 'alarm', { gain: 0.18 }); }

  // ── S7 · "After all those inventions, bells, flags, and beer pipes, there's no record of a safety coffin ever saving a single person."
  { const st = L(10), bl = Wd('bells', 10), re = Wd('record', 10), si = Wd('single', 10), end = L(11);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'a slow crane over the whole quiet graveyard at dusk, every bell still, ending on the gate board: SAFETY COFFINS, PEOPLE SAVED: 0; the gent shrugs', draw(lt, d, t, blit) {
      hideAll(); into(G.scene, gent); saved.visible = t > re - 0.4; G.flag.visible = true; G.flag.scale.set(1, 1, 1);
      act(gent, -2.3, -0.2, { ...A.face(t, [[st, 'content'], [re, 'skeptic'], [si, 'deadpan']]), ...A.react('shrug', t, si + 0.2, 1.0) });
      const c = A.camPath(t, [
        [st, [3.0, 5.2, 9.0], [0.0, 0.8, -4.0], 50],
        [re - 0.2, [-1.2, 2.2, 4.4], [-2.8, 1.6, -1.0], 44],
        [end, [-2.0, 1.75, 3.4], [-3.0, 1.55, -1.1], 42],
      ]);
      shoot(G.scene, c); blit();
    } });
    cue(Wd('record', 10) - 0.4, 'swoosh', { gain: 0.3 }); cue(Wd('single', 10) + 0.3, 'tock', { gain: 0.3 }); }

  // ── S8 · "And no, that's not where saved by the bell comes from. That one's from boxing."
  { const st = L(11), sa = Wd('saved', 11), bx = Wd('boxing', 11), end = T.dur;
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'the punchline in a boxing ring: a wobbling, dizzy boxer about to drop, the ringside bell clangs, the referee steps in, and the boxer slumps into his corner, saved', draw(lt, d, t, blit) {
      hideAll(); into(RING.scene, boxA, boxB, ref);
      const top = RING.ring.top, saveT = sa + 0.3;
      RING.bell.rotation.z = t > saveT && t < saveT + 0.8 ? Math.sin((t - saveT) * 30) * 0.3 : 0;
      act(boxA, -0.45, 0.4, { ...A.face(t, [[st, 'dizzy'], [saveT + 0.2, 'happy']]), tilt: t < saveT ? Math.sin(t * 5) * 18 : 0, lean: t < saveT ? Math.sin(t * 4) * 8 : 0, armL: [60, 90], armR: [50, 100], energy: 1.2, talk: 0 }, top);
      act(boxB, 0.6, -0.1, { ...A.face(t, [[st, 'angry'], [saveT, 'shock']]), armR: t < saveT ? A.arm(t, [...Array(6)].map((_, k) => [st + k * 0.25, k % 2 ? [100, 20] : [60, 90]])) : [60, 90], armL: [60, 90], ...A.react('shrug', t, saveT + 0.2, 0.9) }, top);
      act(ref, 0.05, -1.0, { ...A.face(t, [[st, 'content'], [saveT, 'proud']]), armR: t > saveT ? [150, -20] : [30, 30], ...A.react('point', t, saveT, 0.9) }, top);
      const c = A.camPath(t, [
        [st, [-0.6, 2.9, 3.2], [0.0, 1.95, -0.1], 46],
        [saveT, [0.6, 2.85, 3.0], [0.2, 1.95, -0.2], 46],
        [end, [0.2, 2.9, 3.3], [0.1, 1.95, -0.3], 46],
      ]);
      shoot(RING.scene, c, { ...LK, bloom: 0.25 }); blit();
    } });
    cue(st + 0.1, 'swoosh', { gain: 0.35 }); cue(sa + 0.3, 'ding', { gain: 0.6 }); cue(sa + 0.55, 'ding', { gain: 0.4 }); cue(bx + 0.3, 'boing', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
