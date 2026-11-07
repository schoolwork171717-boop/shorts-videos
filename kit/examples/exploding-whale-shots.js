// THE DAY OREGON BLEW UP A WHALE — kit v9.3: a sunny Oregon beach with a beached whale, a crowd, a parking lot with a
// shiny new red car; half a ton of dynamite, a cartoon blast and raining blubber; a picnic ketchup analogy; an office
// promotion for the punchline.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as WD from './core/world.js';
import * as CY from './core/canyon.js';
import * as ST from './core/store.js';
import * as A from './core/act.js';
import { Toon, INK, PROPS } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let CUR = '_', NOW = 0, FF = null;
const LOOK = {
  engineer: { body: '#F28C3A', pattern: 'vest', patCol: '#F2C230', hat: 'workcap', hatCol: '#F2C230', extra: ['glasses'], neck: 'tie', neckCol: '#3C6FB6' },
  vet: { body: '#5E7A4A', pattern: 'jacket', patCol: '#4A6238', hat: 'bowler', hatCol: '#3A2E28', extra: ['mustache'], mustacheCol: '#D8D8DE', hair: '#D8D8DE' },
  lady: { body: '#F29BB5', pattern: 'plain', hat: 'flower', hatCol: '#F2C230', extra: ['blush'] },
  kid: { body: '#7FBF7A', pattern: 'stripes', patCol: '#5E9A5A', hat: 'cap', hatCol: '#D8343F', extra: ['freckles'] },
  picnic: { body: '#3C6FB6', pattern: 'plaid', patCol: '#2E5A9A', hat: 'none', hair: '#5A3A22', extra: ['beard'], beardCol: '#5A3A22' },
  boss: { body: '#2A2830', pattern: 'jacket', patCol: '#1E1C24', hat: 'none', hair: '#D8D8DE', extra: ['glasses', 'mustache'], neck: 'tie', neckCol: '#D8343F' },
};
const cert = (g, x, y) => { g.save(); g.translate(x, y - 40); g.rotate(-0.08); g.fillStyle = '#FFF6DC'; g.strokeStyle = '#C8901A'; g.lineWidth = 8; g.beginPath(); g.rect(-90, -64, 180, 128); g.fill(); g.stroke(); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(-90, -64, 180, 128);
  g.fillStyle = '#D8343F'; g.font = '900 30px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('PROMOTED!', 0, -12); g.fillStyle = '#2A2230'; g.font = '700 16px Inter, sans-serif'; g.fillText('for a job well done', 0, 18); g.fillStyle = '#F2C230'; g.beginPath(); g.arc(56, 40, 16, 0, 7); g.fill(); g.stroke(); g.restore(); };
const packet = (g, x, y) => { g.save(); g.translate(x, y - 10); g.rotate(0.2); g.fillStyle = '#D8343F'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-34, -22, 68, 44, 6); g.fill(); g.stroke(); g.fillStyle = '#FFFFFF'; g.font = '900 13px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('KETCHUP', 0, 5); g.restore(); };

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; CUR = o.id; FF = null; f(lt, d, t, blit); FX.motes(t, { n: 12, col: '255,250,235', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.16, bloomThreshold: 0.95, aperture: 0.0016, maxblur: 0.009 };
  let EXTRAS = [];
  const rootOf = (o) => { while (o.parent) o = o.parent; return o; };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.position.lerp(V3(...c.look), 0.12 * clamp((50 - c.fov) / 6));
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008 + (c.shake || 0) * Math.sin(t * 60) * 0.03); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); crowd.forEach((q) => q.face(cam));
    A.frameFix(cam, FF || all.filter((q) => q.group.parent === scene && q.group.visible), { t: NOW, key: CUR, extras: FF ? [] : EXTRAS.filter((o) => rootOf(o) === scene) }); all.forEach((q) => q.face(cam));
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

  // ═════ SET 1: the beach ═════
  const BEACH = new THREE.Scene(); WD.sky(BEACH, { top: '#4A92E0', horizon: '#D6ECF8' });
  WD.sunlight(BEACH, E, { col: '#FFF0D6', i: 3.0, pos: [8, 14, 10], target: [0, 0, -2], box: 18, sky: '#CFE2FF', ground: '#D8C08A', hemi: 1.4 });
  WD.clouds(BEACH, [[-40, 26, -120, 22], [30, 30, -140, 26], [90, 24, -100, 18]]);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), WD.mat({ map: WD.T.dirt('#E6D0A0', [60, 60], false) })); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; BEACH.add(sand);
  const seaM = WD.mat({ color: '#3E92CE', roughness: 0.25 }); const seaP = new THREE.Mesh(new THREE.PlaneGeometry(300, 140), seaM); seaP.rotation.x = -Math.PI / 2; seaP.position.set(0, 0.03, -86); BEACH.add(seaP);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(300, 2.2), WD.mat({ color: '#F4FAFF' })); surf.rotation.x = -Math.PI / 2; surf.position.set(0, 0.04, -16.5); BEACH.add(surf);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(300, 5), WD.mat({ color: '#C8B07A' })); wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.02, -13.5); BEACH.add(wet);
  const dg = CY.lumpRock(7), dm = WD.mat({ color: '#E2C88E' }); [[-24, 14, 9], [-12, 18, 7], [6, 20, 8], [22, 16, 10], [36, 12, 7]].forEach(([x, z, s], i) => { const m = new THREE.Mesh(dg, dm); m.position.set(x, -1.5, z); m.scale.set(s, s * 0.45, s * 0.7); m.receiveShadow = true; BEACH.add(m); });
  const grassM = WD.mat({ color: '#7FA85A' }); for (let i = 0; i < 160; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.6, 3), grassM); c.position.set(-30 + (i * 37 % 70), 0.3, 10 + (i * 13 % 9)); c.rotation.z = ((i * 7) % 5 - 2) * 0.12; BEACH.add(c); }
  // the whale
  const whale = new THREE.Group(); whale.position.set(0, 0, -6); whale.rotation.y = 0.15; BEACH.add(whale);
  const wM = WD.mat({ color: '#6A7A92' }), bM = WD.mat({ color: '#B8C2D2' });
  const wb = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 7.0, 10, 18), wM); wb.rotation.z = Math.PI / 2; wb.position.y = 1.15; wb.scale.set(1, 1, 0.9); wb.castShadow = true; whale.add(wb);
  const head = box(3.2, 2.5, 2.4, wM, 3.6, 1.3, 0, whale); head.geometry = new THREE.BoxGeometry(3.2, 2.5, 2.4, 4, 4, 4); { const p = head.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 - 0.25 * Math.max(0, (x / 1.6) ** 4); p.setY(i, y * k); p.setZ(i, z * k); } head.geometry.computeVertexNormals(); }
  const belly = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 6.0, 8, 14), bM); belly.rotation.z = Math.PI / 2; belly.position.set(0.4, 0.55, 0.55); belly.scale.set(1, 1, 0.6); whale.add(belly);
  const fluke = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.3, 3), wM); fluke.rotation.set(Math.PI / 2, 0, Math.PI / 2); fluke.position.set(-5.3, 0.6, 0); fluke.scale.set(1, 1, 2.2); whale.add(fluke);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), WD.mat({ color: '#1A1A22' })); eye.position.set(3.0, 1.0, 1.22); whale.add(eye);
  const crates = new THREE.Group(); crates.position.set(1.6, 0, -3.6); BEACH.add(crates);
  for (let i = 0; i < 7; i++) { const c = WD.crate(0.55); c.position.set((i % 4) * 0.6 - 0.9, Math.floor(i / 4) * 0.55, (i % 2) * 0.1); crates.add(c); }
  const dynaSign = ST.board(1.2, 0.6); dynaSign.scale.setScalar(0.7); dynaSign.position.set(3.4, 0, -3.0); dynaSign.rotation.y = -0.3; dynaSign.draw([['DYNAMITE', '#FF8A80', 100, 140], ['20 CASES', '#FFFFFF', 80, 280]]); BEACH.add(dynaSign);
  const plunger = new THREE.Group(); plunger.position.set(-3.4, 0, 4.2); BEACH.add(plunger); box(0.5, 0.4, 0.4, WD.mat({ color: '#D8343F' }), 0, 0.2, 0, plunger); const rod = cyl(0.03, 0.03, 0.5, WD.mat({ color: '#9AA3AE', metalness: 0.5 }), 0, 0.6, 0, plunger, 6); const tbar = box(0.5, 0.06, 0.06, WD.mat({ color: '#2A2830' }), 0, 0.85, 0, plunger);
  BEACH.add(WD.wire(V3(-3.4, 0.1, 4.2), V3(1.0, 0.1, -3.6), 0.0));
  const hwSign = ST.board(1.4, 0.75); hwSign.position.set(-5.0, 0, 3.4); hwSign.rotation.y = 0.5; BEACH.add(hwSign);
  // parking lot with the shiny new car
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), WD.mat({ map: WD.T.dirt('#8E8E9A', [6, 2], false) })); lot.rotation.x = -Math.PI / 2; lot.position.set(4, 0.02, 9.0); lot.receiveShadow = true; BEACH.add(lot);
  const carA = WD.car('#2C3A4A'); carA.position.set(-1.5, 0.02, 9.2); BEACH.add(carA); const carB = WD.car('#7FA36A'); carB.position.set(9.5, 0.02, 9.2); BEACH.add(carB);
  const newCar = WD.car('#D8343F'); newCar.position.set(4.6, 0.02, 9.0); BEACH.add(newCar); const roof = newCar.children[1];
  const deal = ST.board(1.6, 0.6); deal.scale.setScalar(0.6); deal.position.set(4.6, 1.1, 10.7); deal.draw([['WHALE OF', '#F2C230', 90, 130], ['A DEAL!', '#FFFFFF', 90, 270]]); BEACH.add(deal);
  const crowd = WD.extras(BEACH, [[-6.6, 2.0, 0], [-7.6, 2.6, 1], [-8.4, 1.6, 2], [6.8, 2.4, 3], [7.8, 1.8, 4], [8.8, 2.8, 5], [-9.6, 3.2, 1], [10, 2.0, 0]]);
  // blubber chunks (ballistic)
  const chunkM = WD.mat({ color: '#D8A8A8' }), chunkG = CY.lumpRock(3);
  const chunks = []; for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(chunkG, chunkM); m.castShadow = true; m.visible = false; BEACH.add(m); const a = (i / 26) * 6.283 + (i % 3) * 0.4, r = 4 + (i * 37 % 13); chunks.push({ m, to: V3(Math.cos(a) * r, 0.2, -6 + Math.sin(a) * r * 0.9 + 3), s: 0.25 + (i % 5) * 0.12, h: 9 + (i % 4) * 4, d: 1.6 + (i % 4) * 0.3 }); }
  const bigChunk = new THREE.Mesh(chunkG, chunkM); bigChunk.scale.set(0.8, 0.5, 0.7); bigChunk.castShadow = true; bigChunk.visible = false; BEACH.add(bigChunk);
  let BOOM = 1e9, LAND = 1e9;
  const blast = (t) => { const k = t - BOOM; whale.visible = true; wb.scale.set(1, 1, 0.9); if (k > 0) { wb.scale.set(1, 0.8, 0.75); head.scale.setScalar(0.9); }
    chunks.forEach((c, i) => { const p = clamp(k / c.d); c.m.visible = k > 0 && p < 1.02; if (!c.m.visible) return; const from = V3(0, 1.2, -6); c.m.position.copy(from).lerp(c.to, p); c.m.position.y = 1.2 + c.h * 4 * p * (1 - p) * 0.5 + (c.to.y - 1.2) * p; c.m.scale.setScalar(c.s); c.m.rotation.set(k * 3 + i, k * 2, 0); if (p >= 1) c.m.position.y = 0.15; c.m.visible = true; });
    const pb = clamp((t - BOOM) / Math.max(0.5, LAND - BOOM)); bigChunk.visible = t > BOOM; if (bigChunk.visible) { const to = V3(4.6, 1.5, 9.0); bigChunk.position.copy(V3(0, 1.2, -6)).lerp(to, pb); bigChunk.position.y = lerp(1.2, 1.25, pb) + 16 * pb * (1 - pb); bigChunk.rotation.set(t * 2, t, 0); }
    const crushed = t > LAND; roof.scale.y = crushed ? 0.35 : 1; roof.position.y = crushed ? 1.05 : 1.4; };
  EXTRAS = [dynaSign, hwSign];

  // ═════ SET 2: the picnic ═════
  const PICNIC = WD.meadow(E, { fenceOn: false }).scene;
  const table = new THREE.Group(); table.position.set(0.6, 0, -2.4); PICNIC.add(table); box(2.4, 0.08, 0.9, WD.mat({ map: WD.T.planks('#C88A4A', [1, 1]) }), 0, 0.8, 0, table); [[-1, 0.3], [1, 0.3], [-1, -0.3], [1, -0.3]].forEach(([x, z]) => box(0.08, 0.8, 0.08, WD.mat({ color: '#8A5A36' }), x, 0.4, z, table));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), WD.mat({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#D8343F' : '#FFFFFF'; g.fillRect(x * 16, y * 16, 16, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() })); cloth.rotation.x = -Math.PI / 2; cloth.position.y = 0.85; table.add(cloth);
  const picBoard = ST.board(1.4, 0.85); picBoard.position.set(-2.2, 0, -2.4); picBoard.rotation.y = 0.35; PICNIC.add(picBoard);

  // ═════ SET 3: the office ═════
  const OFF = ST.office(E, { sign: 'HIGHWAY DEPT.' }); const OS = OFF.scene;
  const offBoard = ST.board(1.4, 0.9); offBoard.position.set(2.4, 0, -2.6); offBoard.rotation.y = -0.4; OS.add(offBoard);

  // ═════ cast ═════
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const engineer = mk('engineer', 1, 1.74), vet = mk('vet', 2, 1.78), lady = mk('lady', 3, 1.6), kid = mk('kid', 4, 1.3), picnic = mk('picnic', 5, 1.8), boss = mk('boss', 6, 1.76);
  const all = [engineer, vet, lady, kid, picnic, boss];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const stink = (x, y, k, t) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k * 0.85; ctx.strokeStyle = '#8FCF5A'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const x0 = x + (i - 2) * 90; ctx.beginPath(); for (let s = 0; s <= 20; s++) { const yy = y - s * 14 - ((t * 60) % 40); const xx = x0 + Math.sin(s * 0.6 + t * 4 + i) * 20; s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); } ctx.restore(); };
  const gulls = (k, t, away = 0) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 6; i++) { const x = CW * (0.15 + i * 0.14) + Math.sin(t * 1.5 + i) * 40 + away * (i % 2 ? 1 : -1) * 900, y = 260 + (i % 3) * 70 + Math.cos(t * 2 + i) * 20 - away * 500; const f = Math.sin(t * 9 + i) * 14;
      ctx.beginPath(); ctx.moveTo(x - 40, y - f); ctx.quadraticCurveTo(x - 20, y - 22, x, y); ctx.quadraticCurveTo(x + 20, y - 22, x + 40, y - f); ctx.stroke(); } ctx.restore(); };
  const boom = (x, y, k, t) => { if (k <= 0 || k >= 1) return; ctx.save(); const r = 120 + eo(k) * 700; ctx.globalAlpha = 1 - k * 0.6;
    ctx.fillStyle = '#FFF6C8'; ctx.beginPath(); for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283, rr = r * (i % 2 ? 0.7 : 1.05); i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.stroke();
    ctx.fillStyle = '#FF9A3A'; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, 7); ctx.fill(); ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#2A2230'; ctx.font = `900 ${120 + 80 * eo(k)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BOOM!', x, y); ctx.restore(); };
  const splat = (k, t) => { if (k <= 0) return; ctx.save(); ctx.fillStyle = '#D8343F'; ctx.strokeStyle = INK; ctx.lineWidth = 5; for (let i = 0; i < 18; i++) { const kk = clamp(k * 2 - i / 18); if (kk <= 0) continue; const x = (Math.sin(i * 12.9898) * 0.5 + 0.5) * CW, y = (Math.sin(i * 78.233) * 0.5 + 0.5) * CH * 0.9 + 60, r = (24 + (i % 4) * 22) * eo(kk);
      ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = j / 10 * 6.283, rr = r * (j % 2 ? 0.65 : 1); j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); };

  // ── S1 · "In nineteen seventy, Oregon tried to get rid of a dead whale by blowing it up with half a ton of dynamite."
  { const st = 0, de = Wd('dead', 0), bl = Wd('blowing', 0), ha = Wd('half', 0), dy = Wd('dynamite', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open: a sunny Oregon beach; the camera sweeps from a red plunger box past a pile of DYNAMITE crates to a huge grey whale lying on the sand; the engineer in a hard-hat and safety vest gives a confident thumbs-up', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, engineer); blast(-1); hwSign.draw([['HIGHWAY', '#FFFFFF', 76, 130], ['DEPT.', '#F2C230', 90, 260]]);
      act(engineer, -2.4, 3.6, { ...A.face(t, [[st, 'proud'], [bl, 'scheme'], [dy, 'excited']]), armR: A.arm(t, [[st, [40, 40]], [bl, [150, -10]]]), ...A.react('proud', t, dy, 1.2) });
      const c = A.camPath(t, [[st, [-1.6, 1.2, 7.2], [-3.4, 0.8, 4.2], 44], [de, [3.8, 3.2, 6.4], [0.4, 1.4, -5.0], 48], [ha, [1.6, 2.2, 6.4], [-1.0, 1.4, 1.0], 48], [end, [-0.2, 2.0, 7.4], [-1.8, 1.5, 3.0], 44]]);
      shoot(BEACH, c); blit();
    } });
    cue(0.05, 'swoosh', { gain: 0.45, sweep: -0.8 }); cue(Wd('dynamite', 0), 'boing', { gain: 0.3 }); }

  // ── S2 · "An eight ton whale washed up on the beach, and the smell was unbelievable."
  { const st = L(1), ei = Wd('eight', 1), wa = Wd('washed', 1), sm = Wd('smell', 1), un = Wd('unbelievable', 1), end = L(2);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'close by the whale: green stink lines wiggle up; the old man in a bowler and a lady pinch their noses and turn green-faced, a kid gags', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, vet, lady, kid); blast(-1);
      act(vet, 2.2, -1.6, { ...A.face(t, [[st, 'skeptic'], [sm, 'dizzy']]), flush: t > sm ? 0.7 : 0, flushCol: '#9FD86A', armR: t > sm ? [130, 120] : [30, 30] });
      act(lady, 3.4, -1.2, { ...A.face(t, [[st, 'content'], [sm + 0.2, 'shock'], [un, 'dizzy']]), flush: t > sm ? 0.7 : 0, flushCol: '#9FD86A', armR: t > sm ? [130, 120] : [30, 30] }, 0, 0.8);
      act(kid, 1.2, -1.0, { ...A.face(t, [[st, 'happy'], [sm + 0.1, 'gasp'], [un, 'dizzy']]), flush: t > sm ? 0.8 : 0, flushCol: '#9FD86A' }, 0, 0.8);
      const c = A.camPath(t, [[st, [6.4, 2.2, 2.4], [1.0, 1.5, -5.0], 46], [sm - 0.2, [4.4, 1.9, 2.6], [2.2, 1.4, -1.6], 46], [end, [4.0, 1.85, 2.2], [2.2, 1.4, -1.5], 44]]);
      shoot(BEACH, c); blit(); const [x, y] = proj(V3(0.6, 2.4, -6)); stink(x, y, clamp((t - sm + 0.3) / 0.5), t);
    } });
    cue(Wd('smell', 1), 'sizzle', { gain: 0.25 }); }

  // ── S3 · "The highway engineer had a plan. 'Blow it into little pieces, and the seagulls will eat them.'"
  { const st = L(2), pl = Wd('plan', 2), bl = Wd('blow', 2), li = Wd('little', 2), se = Wd('seagulls', 2), ea = Wd('eat', 2), end = L(3);
    add({ id: 'S3', at: st, note: 'the engineer at his HIGHWAY DEPT. board flips it to TINY PIECES = SEAGULL SNACKS, mimes a little explosion with his hands, and points up at gulls circling overhead', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, engineer); blast(-1);
      hwSign.draw(t < bl ? [['HIGHWAY', '#FFFFFF', 76, 130], ['DEPT.', '#F2C230', 90, 260]] : [['TINY PIECES', '#FFFFFF', 64, 130], ['= SEAGULL SNACKS', '#F2C230', 52, 260]]);
      act(engineer, -3.6, 3.0, { ...A.face(t, [[st, 'scheme'], [pl, 'proud'], [bl, 'excited'], [se, 'happy']]), armR: A.arm(t, [[st, [40, 40]], [bl, [120, 60]], [li, [150, -10]], [se, [160, 10]]]), armL: A.arm(t, [[st, [30, 30]], [bl, [120, 60]], [li, [40, 40]]]), ...A.react('point', t, se, 1.0) });
      const c = A.camPath(t, [[st, [-2.6, 1.85, 6.4], [-4.0, 1.6, 3.0], 44], [end, [-2.4, 1.85, 6.0], [-4.1, 1.7, 3.0], 42]]);
      shoot(BEACH, c); blit(); gulls(clamp((t - se + 0.3) / 0.4), t);
    } });
    cue(Wd('little', 2), 'pop', { gain: 0.25 }); cue(Wd('seagulls', 2), 'chirp', { gain: 0.3 }); }

  // ── S4 · "A guy in the crowd who knew explosives took one look and said, 'That's way too much.'" / "Nobody listened. He'd just bought a brand new car at a sale called, no joke, Whale of a Deal."
  { const st = L(3), kn = Wd('knew', 3), lo = Wd('look', 3), wa = Wd('way', 3), no = L(4), br = Wd('brand', 4), sa = Wd('sale', 4), jo = Wd('joke', 4), wh = Wd('whale', 4), end = L(5);
    add({ id: 'S4', at: st, note: 'the old explosives vet in a bowler stares at the towering crate pile, eyebrows up, waving his hands NO; nobody turns; then he glances proudly back at his shiny red car with a WHALE OF A DEAL sign in the parking lot', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, vet, engineer); blast(-1);
      const atCar = t > br - 0.3;
      act(vet, atCar ? 3.4 : 2.6, atCar ? 7.6 : -1.8, { ...A.face(t, [[st, 'skeptic'], [lo, 'shock'], [wa, 'angry'], [no, 'sad'], [br, 'proud'], [wh, 'laugh']]), armR: A.arm(t, [[st, [30, 30]], [wa, [120, 80]], [no, [30, 30]], [br, [100, 10]]]), armL: A.arm(t, [[st, [30, 30]], [wa, [120, 80]], [no, [30, 30]]]), ...A.react('shock', t, lo, 0.6) });
      act(engineer, -0.4, -1.2, { ...A.face(t, [[st, 'content'], [no, 'scheme']]), look: t > wa && t < br ? [-0.9, 0.1] : undefined });
      const c = atCar ? A.camPath(t, [[br - 0.3, [2.0, 1.9, 4.4], [4.0, 1.2, 8.6], 46], [end, [2.2, 1.85, 4.8], [4.0, 1.2, 8.8], 44]]) : A.camPath(t, [[st, [4.6, 1.9, 1.6], [2.0, 1.5, -3.0], 46], [wa, [4.0, 1.85, 1.0], [2.4, 1.5, -2.4], 44], [br - 0.3, [3.6, 1.9, 1.6], [1.0, 1.4, -2.2], 46]]);
      shoot(BEACH, c); blit();
    } });
    cue(Wd('way', 3), 'tock', { gain: 0.3 }); cue(Wd('whale', 4), 'ding', { gain: 0.3 }); }

  // ── S5 · "Then, boom." / "Giant chunks of blubber flew over the crowd, and people ran while whale rained from the sky." / "One huge chunk landed right on that brand new car and smashed the roof."
  { const st = L(5), bo = Wd('boom', 5), gi = L(6), ra = Wd('ran', 6), rai = Wd('rained', 6), on = L(7), la = Wd('landed', 7), sm = Wd('smashed', 7), end = L(8);
    BOOM = bo; LAND = sm;
    add({ id: 'S5', at: st, note: 'the engineer slams the plunger; a giant cartoon BOOM fills the beach; pink blubber chunks arc over the crowd who run; one huge chunk sails across and flattens the red car\'s roof as the vet freezes in horror', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, engineer, vet, lady, kid); blast(t);
      rod.position.y = t > bo - 0.15 ? 0.4 : 0.6; tbar.position.y = t > bo - 0.15 ? 0.65 : 0.85;
      act(engineer, -3.2, 4.6, { ...A.face(t, [[st, 'excited'], [bo, 'shock'], [rai, 'gasp']]), armR: A.arm(t, [[st, [120, 20]], [bo - 0.2, [60, 60]]]), ...A.react('shock', t, bo, 0.8) });
      const run = clamp((t - gi) / 3);
      act(lady, lerp(-5.6, -9.0, run), lerp(2.0, 5.0, run), { ...A.face(t, [[st, 'content'], [bo, 'shock'], [gi, 'gasp']]), armL: [160, -20], armR: [160, 20], hopY: Math.abs(Math.sin(t * 9)) * 0.12 * (run > 0 && run < 1 ? 1 : 0) }, 0, 1.2);
      act(kid, lerp(-4.6, -7.8, run), lerp(1.4, 4.4, run), { ...A.face(t, [[st, 'happy'], [bo, 'shock'], [gi, 'laugh']]), armL: [160, -20], armR: [160, 20], hopY: Math.abs(Math.sin(t * 10)) * 0.12 * (run > 0 && run < 1 ? 1 : 0) }, 0, 1.2);
      act(vet, 3.0, 7.6, { ...A.face(t, [[st, 'skeptic'], [bo, 'shock'], [on, 'worried'], [sm, 'gasp']]), ...A.react('shock', t, sm, 0.8), armL: t > sm ? [160, -20] : [30, 30], armR: t > sm ? [160, 20] : [30, 30] });
      const c = t < gi ? A.camPath(t, [[st, [-1.6, 1.6, 7.6], [-3.0, 1.2, 4.4], 44], [bo, [-1.8, 1.7, 8.2], [-2.4, 1.4, 3.6], 46], [gi, [4.0, 5.0, 14], [0.0, 2.0, -3.0], 52]]) :
        t < on ? A.camPath(t, [[gi, [4.0, 5.0, 14], [0.0, 2.0, -3.0], 52], [on, [0.0, 3.6, 14], [-3.0, 2.0, 1.0], 52]]) : A.camPath(t, [[on, [1.4, 2.4, 4.8], [4.0, 1.4, 8.6], 48], [end, [1.6, 2.2, 5.0], [4.0, 1.3, 8.8], 46]]);
      c.shake = clamp(1 - (t - bo) / 0.8) * (t > bo ? 1 : 0) + clamp(1 - (t - sm) / 0.5) * (t > sm ? 0.6 : 0);
      if (t > gi && t < on) FF = [];
      shoot(BEACH, c); blit();
      const [bx, by] = proj(V3(0, 1.5, -6)); boom(bx, by, (t - bo) / 1.6, t);
      FX.rain(t, { n: 0, k: 0 });
    } });
    cue(Wd('boom', 5) - 0.05, 'slam', { gain: 0.6 }); cue(Wd('boom', 5), 'thud', { gain: 0.6 }); cue(L(6) + 0.3, 'whoosh', { gain: 0.4 }); cue(Wd('smashed', 7), 'thud', { gain: 0.6 }); cue(Wd('smashed', 7) + 0.1, 'slam', { gain: 0.4 }); }

  // ── S6 · "You see, a blast pushes stuff whichever way is easiest, and with sand underneath, the easiest way was up."
  { const st = L(8), pu = Wd('pushes', 8), ea = Wd('easiest', 8), sa = Wd('sand', 8), up = Wd('up', 8), end = L(9);
    add({ id: 'S6', at: st, trans: 'dissolve', note: 'the engineer, speckled with blubber, stands at his board which now shows SAND = WALL, BLAST GOES UP with a big up arrow; he points up, sheepish', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, engineer); blast(BOOM + 20);
      hwSign.draw(t < sa ? [['A BLAST GOES', '#FFFFFF', 60, 130], ['THE EASY WAY', '#F2C230', 60, 260]] : [['SAND = WALL', '#FFFFFF', 64, 130], ['SO IT GOES ↑', '#F2C230', 70, 260]]);
      act(engineer, -3.6, 3.0, { ...A.face(t, [[st, 'worried'], [pu, 'scheme'], [up, 'skeptic']]), flush: 0.4, flushCol: '#E8A8A8', armR: A.arm(t, [[st, [40, 40]], [pu, [110, 30]], [up, [170, 0]]]), ...A.react('point', t, up, 1.0) });
      const c = A.camPath(t, [[st, [-2.4, 1.85, 6.6], [-4.0, 1.6, 3.0], 44], [end, [-2.3, 1.9, 6.2], [-4.0, 1.7, 3.0], 42]]);
      shoot(BEACH, c); blit();
      if (t > up - 0.2) { const k = eo(clamp((t - up + 0.2) / 0.5)); ctx.save(); ctx.strokeStyle = '#F2C230'; ctx.fillStyle = '#F2C230'; ctx.lineWidth = 26; ctx.lineCap = 'round'; const x = CW * 0.78, y0 = CH * 0.6, y1 = y0 - 460 * k; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 60, y1 + 30); ctx.lineTo(x, y1 - 50); ctx.lineTo(x + 60, y1 + 30); ctx.closePath(); ctx.fill(); ctx.restore(); }
    } });
    cue(Wd('see', 8), 'swoosh', { gain: 0.3 }); cue(Wd('up', 8), 'zip', { gain: 0.3 }); }

  // ── S7 · "It's like stomping on a ketchup packet. You don't get rid of it, you just put it everywhere."
  { const st = L(9), sto = Wd('stomping', 9), ke = Wd('ketchup', 9), yo = Wd('you', 9), ev = Wd('everywhere', 9), end = L(10);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'a picnic in a sunny meadow: a bearded guy drops a ketchup packet and stomps it; red splats fly across the whole screen and onto his shirt; the board says GONE? NOPE. EVERYWHERE.', draw(lt, d, t, blit) {
      hideAll(); into(PICNIC, picnic);
      picBoard.draw(t < yo ? [['KETCHUP', '#FF8A80', 90, 140], ['PACKET', '#FFFFFF', 80, 260]] : [['GONE? NOPE.', '#FFFFFF', 64, 140], ['EVERYWHERE', '#FF8A80', 72, 260]]);
      act(picnic, 0.0, -1.0, { ...A.face(t, [[st, 'scheme'], [sto, 'excited'], [ke + 0.4, 'shock'], [ev, 'sad']]), holdR: t < sto ? packet : undefined, armR: A.arm(t, [[st, [80, 60]], [sto - 0.2, [40, 40]]]), hopY: A.hop ? 0 : 0, squash: t > ke && t < ke + 0.3 ? 0.6 : 0, flush: t > ke + 0.3 ? 0.6 : 0, flushCol: '#F29B9B', ...A.react('shock', t, ke + 0.3, 0.7) });
      const c = A.camPath(t, [[st, [0.4, 1.6, 2.8], [0.0, 1.2, -1.0], 44], [end, [0.6, 1.7, 3.0], [-0.2, 1.3, -1.2], 46]]);
      shoot(PICNIC, c); blit(); splat(clamp((t - ke - 0.2) / 1.6), t);
    } });
    cue(Wd('ketchup', 9) + 0.15, 'plop', { gain: 0.5 }); cue(Wd('everywhere', 9), 'boing', { gain: 0.3 }); }

  // ── S8 · "Most of the whale was still lying on the beach, and the seagulls wouldn't even come near it."
  { const st = L(10), mo = Wd('most', 10), st2 = Wd('still', 10), se = Wd('seagulls', 10), ne = Wd('near', 10), end = L(11);
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'after the smoke clears: most of the whale is still there, just a bit dented, blubber everywhere; the gulls swoop in, take one sniff and flee; the engineer and the vet stand side by side holding their noses', draw(lt, d, t, blit) {
      hideAll(); into(BEACH, engineer, vet); blast(BOOM + 20);
      act(engineer, 3.0, -1.4, { ...A.face(t, [[st, 'worried'], [st2, 'sad'], [ne, 'dizzy']]), flush: 0.5, flushCol: '#9FD86A', armR: [130, 120] });
      act(vet, 4.2, -1.0, { ...A.face(t, [[st, 'angry'], [se, 'skeptic'], [ne, 'sly']]), flush: 0.5, flushCol: '#9FD86A', armR: [130, 120] });
      const c = A.camPath(t, [[st, [7.0, 2.6, 3.6], [1.0, 1.4, -5.0], 46], [se, [6.4, 2.1, 2.4], [3.2, 1.5, -1.6], 46], [end, [6.0, 2.0, 2.2], [3.4, 1.5, -1.4], 44]]);
      shoot(BEACH, c); blit(); const [x, y] = proj(V3(0.4, 2.4, -6)); stink(x, y, 0.8, t); gulls(1, t, eo(clamp((t - ne + 0.2) / 0.9)));
    } });
    cue(Wd('seagulls', 10), 'chirp', { gain: 0.3 }); cue(Wd('near', 10), 'whoosh', { gain: 0.3 }); }

  // ── S9 · "The engineer called the whole thing a success." / "Six months later, he got a promotion."
  { const st = L(11), ca = Wd('called', 11), su = Wd('success', 11), si = L(12), mo = Wd('months', 12), pr = Wd('promotion', 12), end = T.dur;
    add({ id: 'S9', at: st, trans: 'dissolve', note: 'the HIGHWAY DEPT. office: the engineer beams beside a board reading SUCCESS!; his boss walks in and hands him a framed PROMOTED! certificate; confetti', draw(lt, d, t, blit) {
      hideAll(); into(OS, engineer, boss);
      offBoard.draw(t < si ? [['WHALE JOB:', '#FFFFFF', 70, 140], ['SUCCESS!', '#8FE0A0', 90, 270]] : [['6 MONTHS', '#FFFFFF', 76, 140], ['LATER...', '#F2C230', 80, 270]]);
      act(engineer, 0.6, -0.6, { ...A.face(t, [[st, 'proud'], [su, 'laugh'], [si, 'content'], [pr, 'excited']]), holdR: t > pr ? cert : undefined, armR: t > pr ? [150, -10] : [40, 40], ...A.react('proud', t, su, 1.2), ...A.react('cheer', t, pr + 0.2, 1.2) });
      act(boss, lerp(-2.6, -0.6, eo(clamp((t - si) / 1.0))), -0.4, { ...A.face(t, [[st, 'content'], [mo, 'happy'], [pr, 'proud']]), holdR: t > si && t < pr ? cert : undefined, armR: t > si && t < pr ? [100, 30] : [30, 30] });
      if (t < si) boss.group.visible = false;
      const c = A.camPath(t, [[st, [1.4, 1.75, 3.0], [1.4, 1.5, -1.2], 44], [si, [0.4, 1.8, 3.4], [0.0, 1.5, -0.6], 46], [end, [0.3, 1.75, 3.0], [0.0, 1.5, -0.6], 44]]);
      shoot(OS, c); blit();
      if (t > pr) { const k = t - pr; ctx.save(); for (let i = 0; i < 60; i++) { const x = (i * 97 % 100) / 100 * CW, y = ((i * 53 % 100) / 100 * 300 + k * (300 + (i % 5) * 80)) % (CH + 100) - 100; ctx.fillStyle = ['#D8343F', '#F2C230', '#3C6FB6', '#7FBF7A', '#F29BB5'][i % 5]; ctx.save(); ctx.translate(x, y); ctx.rotate(k * 4 + i); ctx.fillRect(-10, -5, 20, 10); ctx.restore(); } ctx.restore(); }
    } });
    cue(Wd('success', 11), 'ding', { gain: 0.3 }); cue(Wd('promotion', 12), 'sparkle', { gain: 0.35 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
