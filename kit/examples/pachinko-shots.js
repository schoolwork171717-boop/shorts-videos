// HOW JAPAN PAYS GAMBLERS WITHOUT GAMBLING — kit v9.1: a candy-bright pachinko hall (glowing machines, buckets of
// silver balls, a prize counter), the street outside with the hall's neon front, a tiny faceless exchange window and a
// wholesaler's van; a looping arrow shows the prize going round in a circle.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as WD from './core/world.js';
import * as ST from './core/store.js';
import * as A from './core/act.js';
import { Toon, INK, PROPS } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let CUR = '_', NOW = 0, FF = null;
const LOOK = {
  regular: { body: '#3C6FB6', pattern: 'jacket', patCol: '#2E5A9A', hat: 'cap', hatCol: '#D8343F', extra: ['mustache'], mustacheCol: '#5A3A22' },
  rookie: { body: '#7FBF7A', pattern: 'stripes', patCol: '#5E9A5A', hat: 'none', hair: '#2A2230', extra: ['freckles'] },
  staff: { body: '#F4F4F8', pattern: 'vest', patCol: '#D8343F', hat: 'visor', hatCol: '#D8343F', neck: 'bowtie', neckCol: '#2A2230' },
  driver: { body: '#E2B33C', pattern: 'overalls', patCol: '#C89A2E', hat: 'workcap', hatCol: '#3C6FB6', extra: ['beard'], beardCol: '#5A3A22' },
  boothman: { body: '#8A8A9A', pattern: 'plain', hat: 'bowler', hatCol: '#2A2830', extra: ['glasses', 'mustache'] },
};
const ballCup = (g, x, y) => { g.save(); g.translate(x, y); g.fillStyle = '#F2A23A'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(-52, -40); g.lineTo(52, -40); g.lineTo(44, 40); g.lineTo(-44, 40); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#D8DCE4'; for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(-40 + (i % 6) * 16 + (i > 5 ? 8 : 0), -46 - Math.floor(i / 6) * 13, 9, 0, 7); g.fill(); g.stroke(); } g.restore(); };
const prize = (g, x, y) => { g.save(); g.translate(x, y - 30); g.rotate(-0.2); g.fillStyle = 'rgba(220,235,255,0.9)'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-34, -48, 68, 96, 8); g.fill(); g.stroke();
  g.fillStyle = '#F2C230'; g.beginPath(); g.roundRect(-20, -24, 40, 50, 4); g.fill(); g.stroke(); g.fillStyle = '#FFF6C8'; g.fillRect(-14, -18, 8, 34); g.restore(); };
const box6 = (g, x, y) => { g.save(); g.translate(x, y - 20); g.fillStyle = '#C8A060'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.rect(-70, -55, 140, 100); g.fill(); g.stroke(); g.fillStyle = '#F2C230'; for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(-55 + i * 40, -78, 30, 26, 4); g.fill(); g.stroke(); } g.restore(); };

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; CUR = o.id; FF = null; f(lt, d, t, blit); FX.motes(t, { n: 14, col: '255,235,245', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.2, bloomThreshold: 0.93, aperture: 0.0016, maxblur: 0.009 };
  let EXTRAS = [];
  const rootOf = (o) => { while (o.parent) o = o.parent; return o; };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.position.lerp(V3(...c.look), 0.12 * clamp((50 - c.fov) / 6));   // v9.2: continuous push-in (the old 38-44 on/off switch made the camera jump)
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); A.frameFix(cam, FF || all.filter((q) => q.group.parent === scene && q.group.visible), { t: NOW, key: CUR, extras: FF ? [] : EXTRAS.filter((o) => rootOf(o) === scene) }); all.forEach((q) => q.face(cam));
    E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
  };
  const act = (p, x, z, o = {}, y = 0, k = 1) => {
    const al = A.alive(NOW, p.seed, 1), pf = A.perform(NOW, p.seed, o.energy ?? k, { talk: o.talk ?? 1 });
    p.group.visible = true; p.at(x + (o.still ? 0 : pf.dx) + (o.dx || 0), y + (o.hopY || 0), z);
    const st = { look: al.look, blink: al.blink, ...pf, tilt: pf.tilt + al.tilt, ...o }; delete st.dx; delete st.hopY; delete st.energy; delete st.still;
    Object.keys(st).forEach((k2) => st[k2] === undefined && delete st[k2]);
    if (st.steam) st.steamT = NOW; p.set(st); A.applySquash(p, st.squash || 0);
  };
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });
  const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const cyl = (r1, r2, h, m, x, y, z, parent, seg = 14) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const proj = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * CW, (1 - p.y) / 2 * CH]; };
  const tex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); paint(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

  // ═════ SET 1: the pachinko hall ═════
  const HALL = WD.interior(E, { w: 8, depth: 7, h: 3.4, wall: '#F7D6E4', motif: '#F2BCD2', floor: '#C8505E', ceiling: '#5A3E7A', signText: 'PRIZE COUNTER →', counterOn: false, litter: false, picture: false });
  const HS = HALL.scene; HS.background = new THREE.Color('#F7D6E4');
  const machineTex = [0, 1, 2].map((v) => tex(256, 512, (g, w, h) => { const cols = [['#D8343F', '#F2C230'], ['#3C6FB6', '#7FD0F0'], ['#7A3AA8', '#F29BB5']][v];
    g.fillStyle = cols[0]; g.fillRect(0, 0, w, h); g.fillStyle = cols[1]; g.fillRect(10, 10, w - 20, 40); g.fillStyle = '#2A2230'; g.font = '900 30px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(['LUCKY 7', 'OCEAN', 'DRAGON'][v], w / 2, 41);
    g.fillStyle = '#EAF4FF'; g.beginPath(); g.arc(w / 2, 190, 112, 0, 7); g.fill(); g.strokeStyle = '#2A2230'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#9AA3AE'; for (let i = 0; i < 70; i++) { const a = i * 2.4, r = 20 + (i * 37 % 90); g.fillRect(w / 2 + Math.cos(a) * r, 190 + Math.sin(a) * r, 3, 3); }
    g.fillStyle = '#2A2230'; g.fillRect(w / 2 - 50, 160, 100, 60); g.fillStyle = '#F2C230'; g.font = '900 40px Inter, sans-serif'; g.fillText('777', w / 2, 204);
    g.fillStyle = '#D8DCE4'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(60 + (i * 53 % 140), 90 + (i * 71 % 200), 8, 0, 7); g.fill(); }
    g.fillStyle = '#F2EDE0'; g.fillRect(30, 330, w - 60, 70); g.fillStyle = '#C8C8D2'; g.beginPath(); g.ellipse(w / 2, 450, 90, 30, 0, 0, 7); g.fill(); g.strokeStyle = '#2A2230'; g.lineWidth = 5; g.stroke(); }));
  const machines = [];
  const machine = (x, z, ry, v) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; HS.add(g);
    const side = WD.mat({ color: '#2A2230' }); const face = new THREE.MeshStandardMaterial({ map: machineTex[v], emissive: '#FFFFFF', emissiveMap: machineTex[v], emissiveIntensity: 0.25, roughness: 0.5 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.55, 0.42), [side, side, side, side, face, side]); m.position.y = 1.35; m.castShadow = true; g.add(m);
    box(0.82, 0.6, 0.5, WD.mat({ color: '#2A2230' }), 0, 0.3, 0, g); const st = cyl(0.2, 0.2, 0.06, WD.mat({ color: '#D8343F' }), 0, 0.62, 0.65, g); cyl(0.05, 0.05, 0.6, WD.mat({ color: '#9AA3AE', metalness: 0.5 }), 0, 0.3, 0.65, g);
    machines.push(g); return g; };
  for (let i = 0; i < 8; i++) machine(-3.2 + i * 0.85, -6.5, 0, i % 3);
  for (let i = 0; i < 5; i++) machine(-3.65, -1.6 - i * 0.85, Math.PI / 2, (i + 1) % 3);
  const ballBox = (x, y, z, n, parent = HS) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); box(0.42, 0.3, 0.32, WD.mat({ color: '#F2A23A' }), 0, 0.15, 0, g);
    const sp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#E8ECF2', metalness: 0.9, roughness: 0.15 }), n), m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m4.makeTranslation(((i * 0.618) % 1 - 0.5) * 0.36, 0.31 + Math.floor(i / 60) * 0.05 + ((i * 0.37) % 1) * 0.03, ((i * 0.414) % 1 - 0.5) * 0.26); sp.setMatrixAt(i, m4); } g.add(sp); return g; };
  const boxes = [ballBox(0.9, 0, -5.5, 240), ballBox(1.4, 0, -5.6, 240), ballBox(1.15, 0.31, -5.55, 240)];
  // prize counter on the right
  const counter = new THREE.Group(); counter.position.set(3.0, 0, -3.2); HS.add(counter);
  box(1.0, 1.0, 3.2, WD.mat({ color: '#F2EDE0' }), 0, 0.5, 0, counter); box(1.1, 0.06, 3.3, WD.mat({ color: '#D8343F' }), 0, 1.03, 0, counter);
  const shelf = box(0.3, 2.2, 3.2, WD.mat({ color: '#B98ACF' }), 0.7, 1.1, 0, counter);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { const it = box(0.16, 0.18, 0.2, WD.mat({ color: ['#F2C230', '#3C6FB6', '#7FBF7A', '#D8343F'][(r + i) % 4] }), 0.5, 1.4 + r * 0.32, -1.3 + i * 0.5, counter); }
  const prizeSign = ST.board(1.4, 0.7); prizeSign.scale.setScalar(0.7); prizeSign.position.set(2.75, 1.35, -5.5); prizeSign.rotation.y = -0.6; prizeSign.draw([['PRIZES', '#F2C230', 110, 150], ['NO CASH HERE', '#FFFFFF', 54, 280]]); HS.add(prizeSign);
  [[-2, -2.5, '#FF4A8A'], [1.5, -4.5, '#4AC8FF']].forEach(([x, z, c]) => { const l = new THREE.PointLight(c, 6, 7, 1.4); l.position.set(x, 2.8, z); HS.add(l); });

  // ═════ SET 2: the street outside ═════
  const OUT = new THREE.Scene(); WD.sky(OUT, { top: '#3D8EE0', horizon: '#CFE8F8' });
  WD.sunlight(OUT, E, { col: '#FFF0D6', i: 2.8, pos: [8, 12, 9], target: [2, 0, -3], box: 16, sky: '#CFE2FF', ground: '#8E8A96', hemi: 1.4 });
  WD.clouds(OUT, [[-30, 26, -100, 16], [25, 32, -110, 20], [60, 22, -90, 12]]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), WD.mat({ map: WD.T.dirt('#8E8E9A', [40, 40], false) })); road.rotation.x = -Math.PI / 2; road.receiveShadow = true; OUT.add(road);
  const walk = box(26, 0.12, 3, WD.mat({ map: WD.T.planks('#C8C0B4', [10, 1]) }), 2, 0.06, -4.6, OUT);
  const bld = (x, w, h, name, wall, kind, aw) => { const front = WD.mat({ map: WD.facade(name, { wall, kind, awning: aw, w, h, seed: x | 0 }) }), side = WD.mat({ color: wall }); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), [side, side, side, side, front, side]); b.position.set(x, h / 2, -8.6); b.castShadow = b.receiveShadow = true; OUT.add(b); return b; };
  // the hall: a custom neon front
  const neon = tex(1024, 512, (g, w, h) => { g.fillStyle = '#2A1A3A'; g.fillRect(0, 0, w, h); g.font = '900 150px Inter, sans-serif'; g.textAlign = 'center';
    ['#FF4A8A', '#FFD84A', '#4AC8FF'].forEach((c, i) => { g.fillStyle = c; g.fillText('PACHINKO'[0], 0, 0); }); const grd = g.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#FF4A8A'); grd.addColorStop(0.5, '#FFD84A'); grd.addColorStop(1, '#4AC8FF'); g.fillStyle = grd; g.fillText('PACHINKO', w / 2, 220);
    g.fillStyle = '#FFFFFF'; g.font = '900 64px Inter, sans-serif'; g.fillText('★ LUCKY PALACE ★', w / 2, 330); for (let i = 0; i < 28; i++) { g.fillStyle = ['#FF4A8A', '#FFD84A', '#4AC8FF'][i % 3]; g.beginPath(); g.arc(20 + i * 36, 30, 10, 0, 7); g.fill(); g.beginPath(); g.arc(20 + i * 36, h - 30, 10, 0, 7); g.fill(); } });
  const hallB = new THREE.Group(); hallB.position.set(-4.2, 0, -8.6); OUT.add(hallB);
  box(8, 7.5, 5, WD.mat({ color: '#F7D6E4' }), 0, 3.75, 0, hallB);
  const neonM = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.3), new THREE.MeshStandardMaterial({ map: neon, emissive: '#FFFFFF', emissiveMap: neon, emissiveIntensity: 0.6 })); neonM.position.set(0, 5.2, 2.52); hallB.add(neonM);
  const door = box(2.4, 2.6, 0.1, new THREE.MeshStandardMaterial({ color: '#BFE4F6', emissive: '#FFD8F0', emissiveIntensity: 0.4, roughness: 0.1 }), 0, 1.3, 2.52, hallB);
  // the exchange booth: a plain little wall with one tiny frosted window
  const booth = new THREE.Group(); booth.position.set(2.6, 0, -7.0); OUT.add(booth);
  box(2.6, 3.2, 2.0, WD.mat({ color: '#D6D2C8' }), 0, 1.6, 0, booth);
  const win = box(0.55, 0.35, 0.06, new THREE.MeshStandardMaterial({ color: '#E8EEF6', roughness: 0.3, emissive: '#C8D8F0', emissiveIntensity: 0.15 }), 0, 1.25, 1.02, booth);
  box(0.75, 0.06, 0.25, WD.mat({ color: '#8A8A9A' }), 0, 1.04, 1.1, booth);
  const xSign = ST.board(0.9, 0.45); xSign.scale.setScalar(0.65); xSign.position.set(0, 1.0, 1.05); xSign.draw([['両替', '#FFFFFF', 150, 170], ['EXCHANGE', '#F2C230', 70, 310]]); booth.add(xSign);
  const slot = new THREE.Group(); slot.position.set(0, 1.12, 1.12); booth.add(slot);
  const cashM = box(0.22, 0.01, 0.1, WD.mat({ color: '#9ED39A' }), 0, 0.01, 0, slot), prizeM = box(0.08, 0.02, 0.12, WD.mat({ color: '#F2C230' }), 0, 0.01, 0, slot);
  bld(7.2, 5, 6.5, 'WHOLESALE CO.', '#7FA36A', 'wood', '#F2C230');
  const van = WD.car('#F4F4F8'); van.position.set(6.6, 0, -2.6); van.rotation.y = Math.PI / 2; van.scale.set(1.1, 1.25, 1.1); OUT.add(van);
  const vanSign = ST.board(1.4, 0.4); vanSign.scale.setScalar(0.8); vanSign.position.set(6.6, 0.0, -1.68); vanSign.draw([['WHOLESALE', '#F2C230', 90, 200]]); OUT.add(vanSign);
  [[-8.6, -6.4], [10.8, -6.4]].forEach(([x, z]) => { const t = WD.tree(1.1, '#4E9A3C'); t.position.set(x, 0, z); OUT.add(t); });
  const lampP = WD.lamp(); lampP.position.set(0.6, 0.12, -5.6); OUT.add(lampP);
  const bench = new THREE.Group(); bench.position.set(-0.6, 0.12, -1.2); OUT.add(bench); box(1.8, 0.08, 0.5, WD.mat({ color: '#A8693E' }), 0, 0.48, 0, bench); box(1.8, 0.4, 0.06, WD.mat({ color: '#A8693E' }), 0, 0.78, -0.22, bench);
  EXTRAS = [prizeSign, xSign];

  // ═════ cast ═════
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const regular = mk('regular', 1, 1.72), rookie = mk('rookie', 2, 1.68), staff = mk('staff', 3, 1.66), driver = mk('driver', 4, 1.8), boothman = mk('boothman', 5, 1.7);
  const all = [regular, rookie, staff, driver, boothman];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const loop = (k, t) => { if (k <= 0) return; const pts = [V3(-2.6, 1.0, -5.6), V3(2.6, 1.3, -5.8), V3(6.6, 1.6, -2.6), V3(-1.2, 1.6, -5.4)].map(proj);
    ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.setLineDash([36, 26]); ctx.lineDashOffset = -t * 160; ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i <= pts.length; i++) { const a = pts[i - 1], b = pts[i % pts.length]; ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 120, b[0], b[1]); } ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#F2C230'; ctx.strokeStyle = INK; ctx.lineWidth = 5; pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y - 6, 22, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.font = '900 26px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, y + 3); ctx.fillStyle = '#F2C230'; }); ctx.restore(); };

  // ── S1 · "In Japan, gambling for cash is illegal, and yet people walk out of pachinko halls with cash every single day."
  { const st = 0, ga = Wd('gambling', 0), il = Wd('illegal', 0), ye = Wd('yet', 0), wa = Wd('walk', 0), ca = Wd('cash', 0), da = Wd('day', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open on the street: the neon PACHINKO front glows; the regular strolls out the door fanning a wad of cash, grinning, past a confused rookie', draw(lt, d, t, blit) {
      hideAll(); into(OUT, regular, rookie);
      act(regular, lerp(-4.2, -2.2, eo(clamp((t - wa + 0.3) / 1.4))), lerp(-5.6, -3.4, eo(clamp((t - wa + 0.3) / 1.4))), { ...A.face(t, [[st, 'content'], [wa, 'happy'], [da, 'proud']]), holdR: t > wa - 0.3 ? PROPS.cash(4) : undefined, armR: A.arm(t, [[st, [30, 30]], [wa, [130, 20]]]), ...A.react('proud', t, da, 1.0) });
      act(rookie, 0.2, -3.0, { ...A.face(t, [[st, 'skeptic'], [il, 'skeptic'], [ca, 'shock']]), ...A.react('shock', t, ca, 0.7) });
      const c = A.camPath(t, [[st, [-4.2, 6.5, 3.0], [-4.2, 4.8, -6.0], 46], [ye, [-2.4, 2.4, 2.4], [-2.6, 1.8, -4.2], 46], [end, [-1.4, 1.8, 1.4], [-1.2, 1.5, -3.4], 44]]);
      shoot(OUT, c); blit();
    } });
    cue(0.05, 'swoosh', { gain: 0.45, sweep: -0.8 }); cue(Wd('illegal', 0), 'tock', { gain: 0.3 }); cue(Wd('cash', 0), 'ding', { gain: 0.3 }); }

  // ── S2 · "Here's the trick. You win a bucket full of little silver balls." / "The hall isn't allowed to give you money, so it swaps your balls for a weird little prize, like a tiny gold bar sealed in plastic."
  { const st = L(1), wi = Wd('win', 1), ba = Wd('balls', 1), th = L(2), al = Wd('allowed', 2), sw = Wd('swaps', 2), go = Wd('gold', 2), pl = Wd('plastic', 2), end = L(3);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'inside the candy-pink hall: rows of glowing machines; the regular jumps as his machine pays out and stacks of silver-ball boxes appear; at the prize counter the staffer pushes the money away and hands him a tiny gold bar in a plastic case', draw(lt, d, t, blit) {
      hideAll(); into(HS, regular, staff);
      boxes.forEach((b, i) => (b.visible = t > wi + i * 0.25));
      const atCounter = t > th; machines.forEach((m, i) => (m.children[0].material[4].emissiveIntensity = 0.25 + (i === 2 && t > wi && t < th ? 0.5 * (Math.sin(t * 20) > 0 ? 1 : 0) : 0)));
      act(regular, atCounter ? 1.8 : 0.0, atCounter ? -3.0 : -5.4, { ...A.face(t, [[st, 'content'], [wi, 'excited'], [th, 'happy'], [al, 'skeptic'], [go, 'gasp']]), holdR: t > go ? prize : t > th ? ballCup : undefined, armR: t > go || t > th ? [120, 20] : [30, 30], ...A.react('cheer', t, wi, 1.0) });
      act(staff, 2.6, -3.2, { ...A.face(t, [[th, 'content'], [al, 'scheme'], [sw, 'happy']]), armR: A.arm(t, [[th, [30, 30]], [al, [100, 60]], [sw, [110, 20]]]), ...A.react('point', t, sw, 0.8) });
      const c = A.camPath(t, [[st, [-0.6, 1.9, -2.4], [0.4, 1.4, -5.6], 44], [th - 0.1, [0.4, 1.9, -2.6], [0.9, 1.2, -5.6], 44], [th + 0.2, [0.2, 1.9, -0.6], [2.0, 1.5, -3.2], 44], [end, [0.8, 1.8, -0.8], [2.1, 1.5, -3.2], 40]]);
      shoot(HS, c); blit();
    } });
    cue(Wd('win', 1), 'bubbles', { gain: 0.35 }); cue(Wd('balls', 1), 'chirp', { gain: 0.3 }); cue(Wd('gold', 2), 'ding', { gain: 0.3 }); }

  // ── S3 · "Then you walk out the door, around the corner, to a tiny window where you can't even see a face." / "You slide the prize in, and cash slides back out."
  { const st = L(3), wa = Wd('walk', 3), co = Wd('corner', 3), ti = Wd('tiny', 3), fa = Wd('face', 3), yo = L(4), sl = Wd('slide', 4), ca = Wd('cash', 4), end = L(5);
    add({ id: 'S3', at: st, trans: 'dissolve', note: 'the regular strolls round the corner to a plain grey wall with one tiny frosted window marked EXCHANGE; he slides the gold prize in and a green bill slides straight back out', draw(lt, d, t, blit) {
      hideAll(); into(OUT, regular);
      const walkK = eo(clamp((t - wa + 0.2) / 2.2));
      prizeM.visible = t > sl && t < sl + 0.6; prizeM.position.z = lerp(0.15, -0.2, clamp((t - sl) / 0.5)); cashM.visible = t > ca - 0.2; cashM.position.z = lerp(-0.2, 0.12, clamp((t - ca + 0.2) / 0.4));
      act(regular, lerp(-1.6, 2.1, walkK), lerp(-3.4, -5.4, walkK), { ...A.face(t, [[st, 'content'], [ti, 'sly'], [fa, 'skeptic'], [sl, 'scheme'], [ca, 'happy']]), holdR: t < sl ? prize : t > ca + 0.2 ? PROPS.cash(1) : undefined, armR: A.arm(t, [[st, [30, 30]], [sl - 0.3, [90, 10]], [ca + 0.3, [130, 20]]]) });
      const c = A.camPath(t, [[st, [-2.0, 1.9, 0.4], [-1.0, 1.5, -3.8], 44], [ti, [1.2, 1.7, -1.6], [2.4, 1.3, -6.0], 42], [yo, [2.9, 1.45, -3.9], [2.5, 1.2, -6.0], 40], [end, [3.0, 1.5, -3.6], [2.4, 1.25, -6.0], 40]]);
      shoot(OUT, c); blit();
    } });
    cue(Wd('slide', 4), 'slide', { gain: 0.35 }); cue(Wd('cash', 4), 'chirp', { gain: 0.3 }); }

  // ── S4 · "Then a third company buys the prizes from the window and sells them right back to the hall." / "A new guy watching says, 'Wait. So the prize just goes around in a circle?'" / "The regular just grins. 'It's not gambling. It's shopping.'"
  { const st = L(5), th = Wd('third', 5), bu = Wd('buys', 5), se = Wd('sells', 5), ng = L(6), wa = Wd('wait', 6), ci = Wd('circle', 6), re = L(7), sh = Wd('shopping', 7), end = L(8);
    add({ id: 'S4', at: st, note: 'a WHOLESALE van pulls up; the driver carries a box of gold prizes from the booth to the hall; a dashed gold loop draws itself through hall, booth and van; the rookie on the bench points at it; the regular grins with his cash', draw(lt, d, t, blit) {
      hideAll(); into(OUT, driver, rookie, regular);
      const k = clamp((t - bu) / 2.4); const dx = t < se ? lerp(4.4, 2.6, eo(clamp((t - bu) / 1))) : lerp(2.6, -1.6, eo(clamp((t - se) / 1.6)));
      act(driver, dx, -4.4, { ...A.face(t, [[st, 'content'], [bu, 'scheme'], [se, 'happy']]), holdR: t > bu + 0.3 ? box6 : undefined, armR: t > bu + 0.3 ? [100, 40] : [30, 30], armL: t > bu + 0.3 ? [100, -40] : [30, 30] });
      act(rookie, -0.6, -1.3, { ...A.face(t, [[ng, 'skeptic'], [wa, 'shock'], [ci, 'gasp']]), ...A.react('point', t, ci - 0.3, 1.0) });
      act(regular, 0.6, -1.6, { ...A.face(t, [[st, 'content'], [re, 'sly'], [sh, 'proud']]), holdR: PROPS.cash(3), armR: [70, 40], ...A.react('shrug', t, sh, 1.0) });
      const c = A.camPath(t, [[st, [3.6, 2.4, 3.6], [4.0, 1.5, -3.8], 46], [se, [1.6, 3.6, 6.6], [1.4, 1.8, -4.4], 50], [ng + 0.4, [0.6, 2.4, 3.4], [0.0, 1.5, -1.4], 46], [re, [0.8, 1.8, 1.6], [0.4, 1.5, -1.5], 42], [end, [0.9, 1.8, 1.4], [0.5, 1.5, -1.6], 40]]);
      shoot(OUT, c); blit(); loop(t < re ? clamp((t - se) / 0.6) : 1 - clamp((t - re) / 0.6), t);
    } });
    cue(Wd('third', 5), 'chug', { gain: 0.3 }); cue(Wd('circle', 6), 'zip', { gain: 0.3 }); cue(Wd('shopping', 7), 'ding', { gain: 0.3 }); }

  // ── S5 · "You see, the law only looks at each step on its own." / "A hall gives you a prize. Legal. A little shop buys a prize from you. Also legal."
  { const st = L(8), lo = Wd('looks', 8), ea = Wd('each', 8), ah = L(9), le = Wd('legal', 9), li = Wd('little', 9), al = Wd('also', 9), end = L(10);
    add({ id: 'S5', at: st, trans: 'dissolve', note: 'a strict inspector-style staffer stamps each step: the camera hops from the hall door (a big green LEGAL stamp lands) to the exchange window (another LEGAL stamp), each on its own', draw(lt, d, t, blit) {
      hideAll(); into(OUT, staff);
      const second = t > li - 0.2;
      act(staff, second ? 2.0 : -2.6, -5.0, { ...A.face(t, [[st, 'skeptic'], [ea, 'content'], [le, 'proud'], [al, 'proud']]), armR: A.arm(t, [[st, [30, 30]], [le - 0.3, [150, 0]], [le + 0.1, [90, 40]], [al - 0.3, [150, 0]], [al + 0.1, [90, 40]]]), ...A.react('point', t, lo, 0.8) });
      const c = A.camPath(t, [[st, [-2.4, 2.0, -0.8], [-2.8, 1.8, -5.6], 46], [li - 0.25, [-2.2, 1.9, -1.0], [-2.6, 1.6, -5.6], 44], [li - 0.2, [2.4, 1.8, -2.0], [2.2, 1.3, -6.0], 44], [end, [2.4, 1.75, -2.2], [2.3, 1.3, -6.0], 42]]);
      shoot(OUT, c); blit();
      const stamp = (k, x, y) => { if (k <= 0) return; const s = 1 + (1 - eo(clamp(k / 0.25))) * 1.5; ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18); ctx.scale(s, s); ctx.globalAlpha = Math.min(1, k * 4); ctx.strokeStyle = '#2E9A4A'; ctx.lineWidth = 14; ctx.beginPath(); ctx.roundRect(-190, -70, 380, 140, 20); ctx.stroke(); ctx.fillStyle = '#2E9A4A'; ctx.font = '900 100px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LEGAL', 0, 6); ctx.restore(); };
      stamp(t < li - 0.2 ? clamp((t - le + 0.05) / 0.6) : 0, CW * 0.5, CH * 0.3); stamp(clamp((t - al + 0.05) / 0.6), CW * 0.5, CH * 0.3);
    } });
    cue(Wd('see', 8), 'swoosh', { gain: 0.3 }); cue(Wd('legal', 9), 'stamp', { gain: 0.4 }); cue(Wd('also', 9) + 0.15, 'stamp', { gain: 0.4 }); }

  // ── S6 · "It's like you hand your friend a sandwich, and he hands you five bucks. Nobody said the word sale."
  { const st = L(10), sa = Wd('sandwich', 10), fi = Wd('five', 10), no = Wd('nobody', 10), sl = Wd('sale', 10), end = L(11);
    add({ id: 'S6', at: st, note: 'on the bench outside: the rookie hands the regular a sandwich, the regular hands back a bill; both look away innocently and whistle', draw(lt, d, t, blit) {
      hideAll(); into(OUT, rookie, regular);
      act(rookie, -1.2, -1.0, { ...A.face(t, [[st, 'content'], [fi, 'happy'], [no, 'sly']]), holdR: t < sa + 0.6 ? PROPS.sandwich : t > fi + 0.4 ? PROPS.bill : undefined, armR: A.arm(t, [[st, [60, 40]], [sa, [100, 20]], [sa + 0.8, [40, 40]], [fi + 0.3, [100, 20]]]), look: t > no ? [-0.9, 0.2] : undefined });
      act(regular, 0.0, -1.0, { ...A.face(t, [[st, 'content'], [sa + 0.6, 'happy'], [no, 'sly']]), holdR: t > sa + 0.6 ? PROPS.sandwich : t < fi + 0.4 ? PROPS.bill : undefined, armR: A.arm(t, [[st, [40, 40]], [fi, [100, 20]], [fi + 0.8, [40, 40]]]), look: t > no ? [0.9, 0.2] : undefined });
      const c = A.camPath(t, [[st, [-0.6, 1.7, 2.4], [-0.6, 1.4, -1.0], 42], [end, [-0.5, 1.65, 2.0], [-0.6, 1.4, -1.0], 40]]);
      shoot(OUT, c); blit();
    } });
    cue(Wd('sandwich', 10), 'pop', { gain: 0.3 }); cue(Wd('five', 10) + 0.3, 'chirp', { gain: 0.3 }); cue(Wd('sale', 10), 'tock', { gain: 0.3 }); }

  // ── S7 · "So a giant industry runs on three buildings standing really close together." / "And all three of them pretend they've never met."
  { const st = L(11), gi = Wd('giant', 11), th = Wd('three', 11), cl = Wd('close', 11), an = L(12), pr = Wd('pretend', 12), me = Wd('met', 12), end = T.dur;
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'a crane up reveals the neon hall, the tiny booth and the wholesaler side by side; the hall staffer, the booth man and the van driver stand at their own doors, then all turn their backs on each other and whistle', draw(lt, d, t, blit) {
      hideAll(); into(OUT, staff, boothman, driver);
      const turned = t > pr;
      act(staff, -0.5, -5.0, { ...A.face(t, [[st, 'content'], [pr, 'sly']]), look: turned ? [-0.9, 0.2] : undefined, ...A.react('shrug', t, me, 0.9) });
      act(boothman, 2.2, -5.0, { ...A.face(t, [[st, 'neutral'], [pr, 'sly']]), look: turned ? [0.9, 0.2] : undefined, ...A.react('shrug', t, me + 0.15, 0.9) });
      act(driver, 4.6, -4.8, { ...A.face(t, [[st, 'content'], [pr, 'sly']]), look: turned ? [0.9, 0.2] : undefined, ...A.react('shrug', t, me + 0.3, 0.9) });
      const c = A.camPath(t, [[st, [1.6, 3.4, 6.0], [1.4, 3.0, -6.0], 52], [cl, [1.8, 3.2, 5.6], [1.6, 2.4, -6.0], 52], [an + 0.2, [2.0, 1.9, 1.8], [2.0, 1.6, -5.0], 52], [end, [2.0, 1.9, 1.5], [2.0, 1.6, -5.0], 50]]);
      shoot(OUT, c); blit();
    } });
    cue(Wd('three', 11), 'pop', { gain: 0.25 }); cue(Wd('met', 12), 'boing', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
