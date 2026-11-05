// HE LOST 25 DAYS IN A CAVE WITHOUT NOTICING: the shot list (Iron Canyon 3D, engine v3).
// Michel Siffre, 1962: down a shaft into an ice cave, no watch / calendar / sun, a phone call to the surface team every
// time he woke, ate or slept. Told it was over on September 14 he thought it was August 20.
// Built as FEW, LONG shots where people actually act (walk, climb, unpack, sleep, eat, phone) and the camera never stops.
import * as THREE from 'three';
import { ctx, clamp, lerp, seg, eo, eio, eob, W as CW, H as CH } from './core/lib.js';
import { L, Wd } from './core/timing.js';
import { camera } from './core/engine.js';
import * as WD from './core/world.js';
import * as CY from './core/canyon.js';
import { Toon, PROPS, INK } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = (a, b, k) => a.clone().lerp(b, k);
const drift = (x) => 0.7 * x + 0.3 * eio(x);
let NOW = 0;
const idle = (seed) => Math.sin(NOW * 3.1 + seed * 1.7) * 3;
const blink = (t, off = 0) => (((t + off) % 3.3) < 0.12 ? 1 : 0);
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const tween = (a, b, t, t0, dur = 0.25) => { const k = eo(clamp((t - t0) / dur)); return a.map((v, i) => v + (b[i] - v) * k); };
const path = (pts, k) => { const n = pts.length - 1, i = Math.min(n - 1, Math.floor(k * n)), f = k * n - i; return mix(pts[i], pts[i + 1], eio(clamp(f))); };

const LOOK = {
  michel: { body: '#C8372E', pattern: 'jacket', patCol: '#9E2F27', belt: '#3A2E2A', hat: 'cap', hatCol: '#E2B33C', hair: '#3A2A22', hairSide: 0, neck: 'scarf', neckCol: '#3C6FB6' },
  chief: { body: '#7A6248', pattern: 'plaid', patCol: '#3A2A1E', straps: '#3A2E2A', hat: 'bowler', hatCol: '#5E5248', hair: '#D2D3D9', extra: ['beard'], beardCol: '#C4C5CB' },
  aide: { body: '#3FA7A0', pattern: 'jacket', patCol: '#2C7C78', hat: 'workcap', hatCol: '#55565E', hair: '#8A5A36', extra: ['glasses'] },
};
const person = (k) => new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] });

// cut-out props
const P2 = {
  phone: (g, x, y, a) => { g.save(); g.translate(x, y); g.rotate(-(a || 0) * 0.5); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#2A2A33';
    g.beginPath(); g.roundRect(-14, -70, 28, 140, 12); g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, -74, 26, 18, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, 74, 26, 18, 0, 0, 7); g.fill(); g.stroke(); g.restore(); },
  watchless: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 4; g.fillStyle = '#F2D9C2'; g.beginPath(); g.roundRect(x - 26, y - 10, 52, 22, 8); g.fill(); g.stroke(); },
};

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); if (!o.noMotes) FX.motes(t, { n: o.cave ? 30 : 20, col: o.cave ? '200,230,255' : '255,236,200', size: o.cave ? 0.8 : 1 }); if (o.shafts) FX.shafts(t, { k: o.shafts, x: o.shaftX ?? CW * 0.6, angle: o.shaftA ?? 0.25, col: o.cave ? '210,235,255' : '255,236,190' }); }; S.push(o); return o; };
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.06);
  const cam = camera(40);
  const headXY = (p, up = 1.62) => { const v = p.group.position.clone(); v.y += up; v.project(cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; };
  const LK = { bloom: 0.2, aperture: 0.0006, maxblur: 0.006 };
  const shoot = (scene, people, p, a, look = LK, shake = 0, t = 0) => {
    const fov = look.fov || 40; if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.position.copy(p); if (shake) cam.position.add(V3(Math.sin(t * 61) * shake, Math.cos(t * 47) * shake, 0)); cam.lookAt(a);
    people.forEach((q) => q.face(cam)); E.render(scene, cam, { ...look, focus: look.focus ?? cam.position.distanceTo(a), t });
  };
  const stand = (p, x, z, st = {}, y = 0) => { p.group.visible = true; p.at(x, y, z).set({ bob: st.legs === 'walk' ? 0 : idle(x * 3 + z), ...st }); };
  const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const ROCK = ['#4A4E5C', '#5A5F70', '#3E4250', '#6A6F80', '#535868', '#47506A'];
  const ICE = ['#CFE8F5', '#A9D4EE', '#E8F6FC', '#8EC3E4', '#BFE0F2'];

  // ── SET 1: the surface. A rock plateau in the mountains, the pit with a timber tripod and winch, the team's tent ──
  const TOP = new THREE.Scene(); WD.sky(TOP, { top: '#3F7FE0', horizon: '#D6E6F7' });
  WD.sunlight(TOP, E, { col: '#FFF0D6', i: 3.0, pos: [-8, 16, 10], target: [0, 0, 0], box: 14, sky: '#CFE2FF', ground: '#8E7D6A', hemi: 1.2 });
  CY.haze(TOP, { col: '#C8D2EC', near: 80, far: 420, floorY: -3 });
  WD.clouds(TOP, [[-40, 40, -160, 26], [40, 52, -200, 32], [100, 36, -140, 20]]);
  const tg = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), WD.mat({ map: WD.T.dirt('#9C8A78', [60, 60], false) })); tg.rotation.x = -Math.PI / 2; tg.receiveShadow = true; TOP.add(tg);
  [[-60, -120, 0.2, 3, 70, ROCK], [50, -150, -0.2, 7, 90, ROCK], [140, -110, -0.5, 5, 60, ROCK], [-150, -90, 0.4, 9, 50, ROCK]].forEach(([x, z, ry, sd, h, pal]) => { const c = CY.cliff({ w: 160, h, y0: -1, ledge: 4, setback: 1.6, seed: sd, seg: [70, 50], rim: 60, pal }); c.position.set(x, 0, z); c.rotation.y = ry; TOP.add(c); });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshBasicMaterial({ color: '#05060A' })); hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.02, 0); TOP.add(hole);
  TOP.add(CY.rocks(500, [-14, 14, -10, 10], 0, ['#6A6F80', '#8E7D6A', '#4A4E5C']));
  const wood = WD.mat({ color: '#8A5A36', roughness: 0.9 });
  [Math.PI / 3, Math.PI, 5 * Math.PI / 3].forEach((a) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8), wood); l.position.set(Math.sin(a) * 0.65, 1.7, Math.cos(a) * 0.65); l.rotation.set(-Math.cos(a) * 0.37, 0, Math.sin(a) * 0.37); l.castShadow = true; TOP.add(l); });
  const topRope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), WD.mat({ color: '#C9A877' })); TOP.add(topRope);
  const tent = (scene, x, z, col, s = 1) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); const m = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 2.0 * s, 4), WD.mat({ color: col, roughness: 0.85 })); m.position.y = 1.0 * s; m.rotation.y = Math.PI / 4; m.castShadow = m.receiveShadow = true; g.add(m);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * s, 1.0 * s), WD.mat({ color: '#2A2228' })); door.position.set(0, 0.5 * s, 1.14 * s); door.rotation.x = -0.5; g.add(door); return g; };
  tent(TOP, 4.5, -3, '#E2B33C', 1.3);
  const chief = person('chief'), aide = person('aide'), michel = person('michel');
  const topPeople = [chief, aide, michel]; topPeople.forEach((p) => TOP.add(p.group));

  // ── SET 2: the cave. A rock shaft from a daylight hole down to a chamber with an ice wall, tent, lamp, phone ──
  const CAVE = new THREE.Scene(); CAVE.background = new THREE.Color('#07080E');
  WD.sunlight(CAVE, E, { col: '#BFD9FF', i: 1.1, pos: [0.5, 50, 0.5], target: [0, 0, 0], box: 12, sky: '#4A5878', ground: '#1A1C26', hemi: 0.55 });
  CAVE.fog = new THREE.Fog('#0B0E18', 18, 70);
  const rockMat = WD.mat({ map: WD.T.strata(ROCK, 4, [4, 2]), color: '#9AA0B8', side: THREE.BackSide, roughness: 0.95 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 42, 24, 12, true), rockMat); shaft.position.y = 31; shaft.receiveShadow = true; CAVE.add(shaft);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: '#EAF4FF', toneMapped: false })); sky.rotation.x = Math.PI / 2; sky.position.y = 51.9; CAVE.add(sky);
  const hall = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 10, 40, 4, true), rockMat); hall.position.y = 5; hall.receiveShadow = true; CAVE.add(hall);
  const roof = new THREE.Mesh(new THREE.RingGeometry(3.5, 14, 40), WD.mat({ color: '#2E3240', side: THREE.DoubleSide })); roof.rotation.x = Math.PI / 2; roof.position.y = 10; CAVE.add(roof);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), WD.mat({ map: WD.T.dirt('#4E5262', [8, 8], false) })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; CAVE.add(floor);
  const glacier = CY.cliff({ w: 22, h: 10, y0: 0, ledge: 1.3, setback: 0.2, rough: 0.5, seed: 12, seg: [80, 40], rim: 0, pal: ICE }); glacier.position.set(0, 0, -9.5); CAVE.add(glacier);
  CAVE.add(CY.rocks(300, [-10, 10, -8, 8], 0, ['#5A5F70', '#3E4250', '#6A6F80']));
  const cRope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), WD.mat({ color: '#C9A877' })); CAVE.add(cRope);
  const camp = new THREE.Group(); CAVE.add(camp);
  const ctent = tent(camp, -1.3, -3.9, '#C8372E', 0.8);
  const crateM = WD.mat({ map: WD.T.planks('#B07A48', [0.5, 0.5]) });
  box(0.7, 0.6, 0.6, crateM, 0.2, 0.3, -3.4, camp); box(0.7, 0.6, 0.6, crateM, 1.5, 0.3, -3.0, camp);
  const lampG = new THREE.Group(); lampG.position.set(0.2, 0.6, -3.4); camp.add(lampG);
  box(0.16, 0.04, 0.16, WD.mat({ color: '#B5372E' }), 0, 0.02, 0, lampG); const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), new THREE.MeshStandardMaterial({ color: '#FFE7A0', emissive: '#FFC870', emissiveIntensity: 0 })); glass.position.y = 0.14; lampG.add(glass);
  const lampL = new THREE.PointLight('#FFC870', 0, 9, 1.4); lampL.position.set(0.2, 1.1, -3.1); lampL.castShadow = false; CAVE.add(lampL);
  const phoneG = new THREE.Group(); phoneG.position.set(1.5, 0.6, -3.0); camp.add(phoneG);
  box(0.3, 0.14, 0.22, WD.mat({ color: '#2A2A33', roughness: 0.4 }), 0, 0.07, 0, phoneG); const hand = box(0.32, 0.06, 0.08, WD.mat({ color: '#1A1A20' }), 0, 0.17, 0, phoneG);
  const wire = WD.wire(V3(1.5, 0.65, -3.0), V3(0.3, 52, 0.3), 0.0); CAVE.add(wire);
  const tally = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 384; const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.9 })); m.position.set(2.9, 1.4, -3.7); m.rotation.y = -0.45; CAVE.add(m);
    let last = -1; const draw = (n, label) => { const key = n + label; if (key === last) return; last = key; const g = c.getContext('2d'); g.fillStyle = '#E9DFC4'; g.fillRect(0, 0, 512, 384); g.strokeStyle = '#6B3E26'; g.lineWidth = 16; g.strokeRect(0, 0, 512, 384);
      g.strokeStyle = '#2A2230'; g.lineWidth = 7; g.lineCap = 'round'; for (let i = 0; i < n; i++) { const gx = 40 + (i % 25) * 18 + Math.floor((i % 25) / 5) * 10, gy = 150 + Math.floor(i / 25) * 90; if (i % 5 === 4) { g.beginPath(); g.moveTo(gx - 78, gy + 50); g.lineTo(gx + 6, gy + 6); g.stroke(); } else { g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx, gy + 56); g.stroke(); } }
      if (label) { g.fillStyle = '#C8372E'; g.font = '900 78px Inter'; g.textAlign = 'center'; g.fillText(label, 256, 100); } tx.needsUpdate = true; };
    return { mesh: m, draw }; })();
  const cavePeople = [michel]; // michel moves between scenes
  // ── SET 3: the surface team's tent: a log book, a wall calendar, a clock that gets covered ──
  const TT = WD.interior(E, { w: 7, depth: 6, h: 3.6, wall: '#C9A27A', motif: '#B8926A', floor: '#8A5A36', ceiling: '#6B4A30', signText: 'SURFACE TEAM', counterOn: false, litter: false, picture: false });
  box(2.2, 0.08, 1.0, WD.mat({ color: '#A8693E' }), 1.0, 0.86, -3.4, TT.scene); [[0, -3.0], [2, -3.0], [0, -3.8], [2, -3.8]].forEach(([x, z]) => box(0.06, 0.86, 0.06, wood, x, 0.43, z, TT.scene));
  const tphone = new THREE.Group(); tphone.position.set(1.5, 0.9, -3.2); TT.scene.add(tphone); box(0.3, 0.14, 0.22, WD.mat({ color: '#2A2A33' }), 0, 0.07, 0, tphone);
  const calTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 640; const g = c.getContext('2d'); g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, 512, 640); g.fillStyle = '#C8372E'; g.fillRect(0, 0, 512, 150);
    g.fillStyle = '#FFFFFF'; g.font = '900 72px Inter'; g.textAlign = 'center'; g.fillText('SEPTEMBER', 256, 100); g.fillStyle = '#2A2230'; g.font = '900 64px Inter';
    for (let d = 1; d <= 30; d++) { const col = (d + 5) % 7, row = Math.floor((d + 5) / 7); g.font = '700 46px Inter'; g.fillText(String(d), 50 + col * 69, 220 + row * 84); }
    g.strokeStyle = '#C8372E'; g.lineWidth = 9; g.beginPath(); g.ellipse(50 + ((14 + 5) % 7) * 69, 205 + Math.floor((14 + 5) / 7) * 84, 40, 36, 0, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.375), new THREE.MeshStandardMaterial({ map: calTex, roughness: 0.9 })); cal.position.set(-2.5, 2.0, -5.88); TT.scene.add(cal);
  const clockTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#FFFDF4'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#2A2230'; g.lineWidth = 10; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); g.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); g.stroke(); }
    g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.moveTo(128, 128); g.lineTo(176, 150); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.6 })); clock.position.set(2.45, 2.25, -5.88); TT.scene.add(clock);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), WD.mat({ color: '#3C6FB6', side: THREE.DoubleSide })); cloth.position.set(2.45, 2.25, -5.84); TT.scene.add(cloth);
  const ttPeople = [person('chief'), person('aide')]; ttPeople.forEach((p) => TT.scene.add(p.group)); const [chief2, aide2] = ttPeople;

  const stretch = (m, a, b) => { const d = b.clone().sub(a), len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); m.visible = true; };
  const into = (scene) => { if (michel.group.parent !== scene) scene.add(michel.group); };
  const hideAll = () => { [chief, aide, michel, chief2, aide2].forEach((p) => (p.group.visible = false)); };
  const big = (txt, x, y, s, k, col = '#FFFFFF') => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.font = `900 ${s}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
  const icon = (kind, x, y, k, crossK) => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.fillStyle = '#FFFDF4'; ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.fill(); ctx.stroke(); ctx.lineWidth = 8;
    if (kind === 'watch') { ctx.fillStyle = '#C9A13B'; ctx.fillRect(-22, -80, 44, 160); ctx.strokeRect(-22, -80, 44, 160); ctx.fillStyle = '#FFFDF4'; ctx.beginPath(); ctx.arc(0, 0, 48, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.moveTo(0, 0); ctx.lineTo(22, 10); ctx.stroke(); }
    if (kind === 'cal') { ctx.fillStyle = '#FFFDF4'; ctx.fillRect(-55, -50, 110, 100); ctx.strokeRect(-55, -50, 110, 100); ctx.fillStyle = '#C8372E'; ctx.fillRect(-55, -50, 110, 30); ctx.strokeRect(-55, -50, 110, 30); ctx.fillStyle = INK; ctx.font = '900 44px Inter'; ctx.textAlign = 'center'; ctx.fillText('14', 0, 38); }
    if (kind === 'sun') { ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.arc(0, 0, 36, 0, 7); ctx.fill(); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 50, Math.sin(a) * 50); ctx.lineTo(Math.cos(a) * 72, Math.sin(a) * 72); ctx.stroke(); } }
    if (crossK > 0) { ctx.strokeStyle = '#D8343F'; ctx.lineWidth = 20; ctx.lineCap = 'round'; const r = 80 * eo(clamp(crossK)); ctx.beginPath(); ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r); ctx.stroke(); }
    ctx.restore(); };
  const ring = (x, y, t, k) => { if (k <= 0) return; ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const r = 50 + i * 26 + Math.sin(t * 30) * 4; ctx.globalAlpha = k * (1 - i * 0.25); ctx.beginPath(); ctx.arc(x, y, r, -0.7, 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); } ctx.restore(); };
  const goggles = (p, up = 1.47) => { const [x, y] = headXY(p, up); const s = Math.max(0.4, Math.min(2.2, 9 / cam.position.distanceTo(p.group.position))) * 0.5; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#1C1C24'; ctx.strokeStyle = INK; ctx.lineWidth = 8;
    [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * 46, 0, 40, 30, 0, 0, 7); ctx.fill(); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * 46 - 14, -10, 10, 6, -0.4, 0, 7); ctx.fill(); }); ctx.restore(); };
  const glare = (k) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#FFFCF0'; ctx.fillRect(0, 0, CW, CH); ctx.restore(); };

  // ── S01 · "How do you lose twenty-five days and never notice?" — the surface: Michel at the pit, unbuckles his watch ──
  { const st = cut(0), tw = Wd('twenty-five', 0);
    add({ id: 'S01', at: st, shafts: 0.7, note: 'continuous push-in on Michel at the edge of the pit; he slips his watch off and tosses it to the team chief, deadpan; "25 DAYS?" pops', draw(lt, d, t, blit) {
      hideAll(); into(TOP); const k = drift(clamp(lt / d)), toss = clamp((lt - 1.1) / 0.6);
      stand(michel, -0.3, 1.5, { mood: lt < 1.1 ? 'neutral' : 'deadpan', armR: tween([20, -100], [60, -20], t, st + 1.0, 0.25), holdR: lt < 1.15 ? P2.watchless : undefined, blink: blink(t), look: [0.4, 0] });
      stand(chief, 1.05, 1.9, { mood: toss > 0.8 ? 'smug' : 'neutral', armL: tween([10, 8], [60, -40], t, st + 1.5, 0.2), blink: blink(t, 1.2), look: [-0.5, 0] });
      stretch(topRope, V3(0, 3.35, 0), V3(0, 0.0, 0));
      shoot(TOP, topPeople, mix(V3(0.5, 1.7, 7.2), V3(0.3, 1.6, 5.4), k), V3(0.35, 1.3, 1.5));
      blit(); big('25 DAYS?', 540, 520, 150, clamp((t - tw) / 0.25), '#F2C230');
    } });
    cue(st + 0.05, 'whoosh', { gain: 0.5 }); cue(st + 1.3, 'pop', { gain: 0.5 }); cue(Wd('twenty-five', 0), 'ding', { gain: 0.6 }); }

  // ── S02 · "In 1962 ... Michel Siffre / climbed down 130 meters into an ice cave." — ONE long take down the shaft ──
  { const st = cut(1), en = L(3) - 0.06, cv = Wd('cave', 2);
    add({ id: 'S02', at: st, cave: true, shafts: 1, shaftX: CW * 0.5, shaftA: 0.02, note: 'one continuous take: start at the bright hole above, Michel abseils down the rope past the camera, the camera sinks with him 40 m into the dark chamber, the ice wall glows into view; depth counter runs to 130 m', draw(lt, d, t, blit) {
      hideAll(); into(CAVE); const k = clamp(lt / d), fall = eio(clamp(lt / (cv - st + 0.2))); const y = lerp(49, 0, fall);
      stand(michel, 0.25, 0.2, { mood: fall < 0.98 ? (k < 0.4 ? 'strain' : 'worried') : 'shock', legs: fall < 0.98 ? 'sit' : 'stand', armL: [160, 10], armR: [150, 20], blink: blink(t), look: [0, -0.4] }, y);
      stretch(cRope, V3(0.25, y + 1.9, 0.2), V3(0.25, 52, 0.2));
      lampL.intensity = 0; glass.material.emissiveIntensity = 0; camp.visible = true; ctent.scale.setScalar(0.001); phoneG.visible = wire.visible = false; tally.draw(0, '');
      const camY = lerp(51, 1.6, eio(clamp((lt - 0.2) / (cv - st)))), endK = clamp((lt - (cv - st)) / (d - (cv - st)));
      shoot(CAVE, cavePeople, mix(V3(2.4, camY + 0.6, 2.6), V3(2.0, 1.5, 4.2), endK), mix(V3(0.25, y + 1.0, 0.2), V3(0, 1.6, -5), endK * 0.8), { ...LK, aperture: 0, bloom: 0.35 });
      blit(); if (lt < 2.2) big('1962', 540, 330, 130, clamp(lt / 0.25) * (1 - clamp((lt - 1.8) / 0.4)), '#F2C230');
      if (lt > 2.2) big(`${Math.round(130 * fall)} m`, 540, 330, 120, clamp((lt - 2.2) / 0.3) * (1 - clamp((lt - (cv - st) - 0.6) / 0.4)), '#BFE0F2');
    } });
    cue(st, 'whoosh', { gain: 0.9 }); cue(st + 0.4, 'slide', { gain: 0.5 }); cue(Wd('cave', 2), 'thud', { gain: 0.6 }); }

  // ── S03 · "He brought a tent, a lamp, and a telephone." — he walks his camp into being, one item per word ──
  { const st = cut(3), w1 = Wd('tent', 3), w2 = Wd('lamp', 3), w3 = Wd('telephone', 3);
    add({ id: 'S03', at: st, cave: true, note: 'continuous orbit: Michel walks across the chamber; the tent pops up on "tent", he lights the lamp on "lamp" (warm light floods in), sets the phone down on "telephone"', draw(lt, d, t, blit) {
      hideAll(); into(CAVE); const k = drift(clamp(lt / d));
      const wp = path([V3(-1.5, 0, -2.4), V3(-0.4, 0, -2.6), V3(0.9, 0, -2.6), V3(2.2, 0, -2.5)], clamp((t - st + 0.2) / (w3 - st + 0.4)));
      const walking = t < w3 - 0.05;
      stand(michel, wp.x, wp.z, { mood: t > w2 ? 'content' : 'neutral', legs: walking ? 'walk' : 'stand', phase: t * 7, armR: t > w2 && t < w2 + 0.5 ? [90, 0] : [20, -30], blink: blink(t) });
      ctent.scale.setScalar(Math.max(0.001, eob(clamp((t - w1) / 0.35)))); const lk = clamp((t - w2) / 0.3); lampL.intensity = lk * 5; glass.material.emissiveIntensity = lk * 1.4;
      phoneG.visible = t > w3 - 0.1; phoneG.position.y = 0.6 + (1 - eo(clamp((t - w3 + 0.1) / 0.25))) * 0.4; wire.visible = phoneG.visible; cRope.visible = false; tally.draw(0, '');
      const fx = wp.x - 0.5;
      shoot(CAVE, cavePeople, V3(fx - 0.6 + k * 0.9, 1.8, 1.6), V3(fx, 1.0, -3.0), { ...LK, bloom: 0.25 });
      blit();
    } });
    cue(Wd('tent', 3), 'pop', { gain: 0.7 }); cue(Wd('lamp', 3), 'sparkle', { gain: 0.5 }); cue(Wd('telephone', 3), 'tock', { gain: 0.8 }); }

  // ── S04 · "No watch. No calendar. No sun." — close on Michel, three icons crossed out on the beat ──
  { const st = cut(4), a1 = Wd('watch', 4), a2 = Wd('calendar', 4), a3 = Wd('sun', 4);
    add({ id: 'S04', at: st, cave: true, note: 'slow push-in on Michel in lamplight looking at his bare wrist, then up; watch / calendar / sun icons pop and get crossed out on each word', draw(lt, d, t, blit) {
      hideAll(); into(CAVE); const k = drift(clamp(lt / d));
      stand(michel, 1.0, -1.9, { mood: t > a3 ? 'deadpan' : 'worried', armL: t < a2 ? [70, -60] : [12, 10], look: t < a2 ? [-0.3, 0.5] : [0, -0.3], blink: blink(t) });
      ctent.scale.setScalar(1); lampL.intensity = 5; glass.material.emissiveIntensity = 1.4; phoneG.visible = wire.visible = true; cRope.visible = false;
      shoot(CAVE, cavePeople, mix(V3(1.6, 1.6, 1.4), V3(1.4, 1.6, 0.6), k), V3(1.0, 1.45, -1.9), { ...LK, bloom: 0.25 });
      blit(); [['watch', a1, 220], ['cal', a2, 540], ['sun', a3, 860]].forEach(([kind, w, x]) => icon(kind, x, 400, clamp((t - w + 0.1) / 0.25), clamp((t - w - 0.15) / 0.2)));
    } });
    [Wd('watch', 4), Wd('calendar', 4), Wd('sun', 4)].forEach((w) => { cue(w, 'pop', { gain: 0.6 }); cue(w + 0.17, 'tock', { gain: 0.7 }); }); }

  // ── S05 · "Every time he woke up, ate, or went to sleep, he called the team up top." — a living time-lapse, one take ──
  { const st = cut(5), wk = Wd('woke', 5), at = Wd('ate', 5), sl = Wd('sleep', 5), cl = Wd('called', 5);
    add({ id: 'S05', at: st, cave: true, note: 'one take, camera drifting sideways past the camp: Michel asleep sits up and stretches ("woke"), eats a sandwich ("ate"), yawns and lies back ("sleep"), then walks to the phone and calls ("called"); the lamp breathes, the tally board fills', draw(lt, d, t, blit) {
      hideAll(); into(CAVE); const k = drift(clamp(lt / d));
      ctent.scale.setScalar(1); lampL.intensity = 5 + Math.sin(t * 9) * 0.5; glass.material.emissiveIntensity = 1.4; phoneG.visible = wire.visible = true; cRope.visible = false;
      let st8;
      if (t < wk) st8 = { mood: 'content', legs: 'sit', blink: 1, armL: [12, 10] };
      else if (t < at) st8 = { mood: 'tired', legs: 'sit', armL: tween([12, 10], [160, 20], t, wk, 0.3), armR: tween([12, 10], [160, 20], t, wk, 0.3), blink: blink(t) };
      else if (t < sl) st8 = { mood: 'content', legs: 'sit', armR: [70, -60], holdR: PROPS.sandwich, blink: blink(t) };
      else if (t < cl - 0.3) st8 = { mood: 'tired', legs: 'sit', armR: [150, 60], blink: clamp((t - sl) / 0.4) };
      else st8 = { mood: 'happy', armR: [150, 140], holdR: P2.phone, blink: blink(t) };
      const pos = t < cl - 0.3 ? V3(-0.4, 0, -2.5) : mix(V3(-0.4, 0, -2.5), V3(1.0, 0, -2.4), eio(clamp((t - cl + 0.3) / 0.35)));
      stand(michel, pos.x, pos.z, { ...st8, ...(t > cl - 0.3 && t < cl + 0.05 ? { legs: 'walk', phase: t * 9 } : {}) }, st8.legs === 'sit' ? -0.42 : 0);
      tally.draw(Math.floor(clamp(lt / d) * 24), '');
      shoot(CAVE, cavePeople, V3(pos.x - 0.5 + k * 0.8, 1.5, 1.4), V3(pos.x + 0.1, 0.9, -2.6), { ...LK, bloom: 0.25 });
      blit(); if (t > cl) ring(...headXY(michel, 1.35), t, 1 - clamp((t - cl - 1.2) / 0.3));
    } });
    cue(Wd('woke', 5), 'boing', { gain: 0.4 }); cue(Wd('ate', 5), 'gulp', { gain: 0.6 }); cue(Wd('sleep', 5), 'slide', { gain: 0.4 }); cue(Wd('called', 5), 'ding', { gain: 0.6 }); }

  // ── S06 · "They wrote it down, and never told him the time." — the surface tent: log book, the clock gets covered ──
  { const st = cut(6), nv = Wd('never', 6);
    add({ id: 'S06', at: st, shafts: 0.6, shaftX: CW * 0.3, shaftA: -0.3, note: 'inside the surface tent, the aide on the phone writes in the log; on "never" the chief hangs a blue cloth over the wall clock and gives a shush, deadpan; camera pushes in', draw(lt, d, t, blit) {
      hideAll(); const k = drift(clamp(lt / d));
      stand(aide2, 0.75, -4.2, { mood: 'content', armR: [150, 140], holdR: P2.phone, armL: [60, -30], holdL: PROPS.paper('LOG'), blink: blink(t) });
      stand(chief2, 2.05, -5.1, { mood: t > nv + 0.3 ? 'sly' : 'neutral', armL: t < nv ? [40, -40] : tween([150, 10], [150, 150], t, nv + 0.35, 0.2), blink: blink(t, 0.8) });
      const ck = eob(clamp((t - nv) / 0.35)); cloth.visible = ck > 0.01; cloth.scale.set(1, Math.max(0.01, ck), 1); cloth.position.y = 2.8 - 0.55 * ck;
      shoot(TT.scene, ttPeople, mix(V3(1.3, 1.7, 0.6), V3(1.35, 1.75, -0.4), k), V3(1.4, 1.6, -4.8));
      blit();
    } });
    cue(Wd('never', 6), 'whoosh', { gain: 0.6 }); cue(Wd('never', 6) + 0.4, 'zip', { gain: 0.4 }); }

  // ── S07 · "The plan was two months, until September fourteenth." — push into the wall calendar ──
  { const st = cut(7), sp = Wd('September', 7);
    add({ id: 'S07', at: st, shafts: 0.6, shaftX: CW * 0.3, shaftA: -0.3, note: 'continuous move across the tent to the wall calendar: September, the 14th circled in red', draw(lt, d, t, blit) {
      hideAll(); const k = drift(clamp(lt / d)); cloth.visible = true; cloth.scale.set(1, 1, 1); cloth.position.y = 2.25;
      stand(chief2, -1.55, -5.0, { mood: 'proud', armR: [120, 10], look: [-0.4, 0.2], blink: blink(t) });
      shoot(TT.scene, ttPeople, mix(V3(0.2, 1.8, -0.8), V3(-2.4, 2.0, -3.1), k), mix(V3(-1.4, 1.7, -5.4), V3(-2.5, 2.0, -5.9), k));
      blit(); { const tw = Wd('two', 7); big('2 MONTHS', 540, 330, 120, clamp((t - tw) / 0.25) * (1 - clamp((t - sp) / 0.25)), '#F2C230'); }
    } });
    cue(st, 'whoosh'); cue(Wd('fourteenth', 7), 'ding', { gain: 0.7 }); }

  // ── S08 · "Then the phone rang. The experiment was over." — the phone rattles in the cave, Michel jumps ──
  { const st = cut(8), rg = Wd('rang', 8), ov = Wd('over', 8);
    add({ id: 'S08', at: st, cave: true, note: 'low by the crate: the phone jumps and rattles on "rang", Michel jolts awake on his bedroll, grabs it; on "over" he freezes, shocked', draw(lt, d, t, blit) {
      hideAll(); into(CAVE); const k = drift(clamp(lt / d)), ringing = t > rg - 0.1 && t < rg + 0.8;
      ctent.scale.setScalar(1); lampL.intensity = 5; glass.material.emissiveIntensity = 1.4; phoneG.visible = wire.visible = true; cRope.visible = false;
      hand.position.y = 0.17 + (ringing ? Math.abs(Math.sin(t * 40)) * 0.05 : 0); phoneG.rotation.z = ringing ? Math.sin(t * 50) * 0.05 : 0;
      const got = t > rg + 0.7;
      stand(michel, 0.9, -2.3, { mood: t > ov ? 'shock' : t > rg ? 'worried' : 'content', legs: got ? 'stand' : 'sit', armR: got ? [150, 140] : [20, -10], holdR: got ? P2.phone : undefined, blink: t < rg ? 1 : blink(t) }, got ? 0 : -0.42);
      shoot(CAVE, cavePeople, mix(V3(1.8, 1.0, 1.3), V3(1.5, 1.3, 0.6), k), mix(V3(1.2, 0.7, -2.7), V3(1.0, 1.1, -2.4), k), { ...LK, bloom: 0.25 }, ringing ? 0.01 : 0, t);
      blit(); if (ringing) ring(...(() => { const v = V3(1.5, 0.9, -3.0).project(cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; })(), t, 1);
    } });
    cue(Wd('rang', 8), 'alarm', { dur: 0.9, gain: 0.45 }); cue(Wd('over', 8), 'slam', { gain: 0.6 }); }

  // ── S09 · "Michel was confused. By his count, it was August twentieth. / He thought he still had almost a month to go." ──
  { const st = cut(9), au = Wd('August', 9), mo = Wd('month', 10), back = L(10) + 0.1;
    add({ id: 'S09', at: st, cave: true, note: 'one take from his face to his tally board: Michel on the phone, confused; the board reads AUG 20; he counts on his fingers, shrugs at "month"', draw(lt, d, t, blit) {
      hideAll(); into(CAVE); const k = drift(clamp(lt / d));
      ctent.scale.setScalar(1); lampL.intensity = 5; glass.material.emissiveIntensity = 1.4; phoneG.visible = wire.visible = true; cRope.visible = false;
      const count = t > au + 0.6 && t < mo;
      stand(michel, 2.0, -2.4, { mood: t > mo ? 'dizzy' : 'worried', armR: [150, 140], holdR: P2.phone, armL: count ? [60 + Math.sin(t * 8) * 10, -60] : t > mo ? [150, 40] : [12, 10], look: t < au ? [0.2, 0] : [0.6, 0], blink: blink(t) });
      tally.draw(35, t > au ? 'AUG 20?' : '');
      const toBoard = eio(clamp((t - au + 0.3) / 0.7)) * (1 - eio(clamp((t - back) / 0.7)));
      shoot(CAVE, cavePeople, mix(mix(V3(1.7, 1.6, 0.4), V3(1.8, 1.6, -0.1), k), V3(1.9, 1.5, -0.4), toBoard), mix(V3(2.0, 1.45, -2.4), V3(2.9, 1.4, -3.7), toBoard), { ...LK, bloom: 0.25 });
      blit(); { const [hx, hy] = headXY(michel, 1.55); FX.sweat(hx + 110, hy - 30, clamp((lt - 0.5) / 0.3)); }
      if (t > mo) big('?', 860, 420, 200, clamp((t - mo) / 0.25), '#F2C230');
    } });
    cue(Wd('confused', 9), 'boing', { gain: 0.4 }); cue(Wd('August', 9), 'pop', { gain: 0.6 }); cue(Wd('month', 10), 'tock', { gain: 0.6 }); }

  // ── S10 · "He climbed out in dark ski goggles, blinking at a summer that was nearly over." — up into blinding daylight ──
  { const st = cut(11), gg = Wd('goggles', 11);
    add({ id: 'S10', at: st, shafts: 1, note: 'at the surface: the rope goes taut, Michel rises out of the pit into blinding sun in dark goggles; the team cheers; the glare settles as the camera rises', draw(lt, d, t, blit) {
      hideAll(); into(TOP); const k = drift(clamp(lt / d)), up = eo(clamp(lt / 1.6));
      const stepK = eio(clamp((lt - 1.7) / 0.7)); stand(michel, 0, 1.2 * stepK, { mood: up < 1 ? 'strain' : 'deadpan', legs: up < 1 ? 'sit' : stepK > 0 && stepK < 1 ? 'walk' : 'stand', phase: t * 8, armL: [160, 10], armR: up < 1 ? [150, 20] : [60, -40], blink: 0 }, lerp(-1.9, 0, up));
      stretch(topRope, V3(0, 3.35, 0), V3(0, lerp(-1.9, 0, up) + 1.9 - stepK * 2.5, 0));
      stand(chief, 1.0, -1.5, { mood: up >= 1 ? 'laugh' : 'worried', armL: up >= 1 ? [160, 10] : [40, -40], armR: up >= 1 ? [160, 10] : [10, 8], blink: blink(t) });
      stand(aide, -1.0, -1.5, { mood: up >= 1 ? 'laugh' : 'neutral', armR: up >= 1 ? [160, 10] : [10, 8], blink: blink(t, 1) });
      shoot(TOP, topPeople, mix(V3(0.2, 0.9, 3.8), V3(0.3, 1.9, 5.0), k), V3(0, 1.1, -0.2), { ...LK, fov: 46, bloom: 0.45, exposure: lerp(1.6, 1.0, clamp(lt / 1.8)) });
      blit(); if (t > gg - 0.3 || lt > 1.2) goggles(michel); glare(0.7 * (1 - clamp(lt / 1.4)));
    } });
    cue(st, 'whoosh', { gain: 0.8 }); cue(st + 0.2, 'slide', { gain: 0.6 }); cue(st + 1.6, 'sparkle', { gain: 0.6 }); }

  // ── S11 · "That's how you lose twenty-five days, and never notice." — the loop: pull back up and away from the pit ──
  { const st = cut(12), tw = Wd('twenty-five', 12);
    add({ id: 'S11', at: st, shafts: 0.8, note: 'loop: Michel deadpan into camera with goggles, then a long rising pull-back to the tiny pit in the big mountains; "25 DAYS" returns', draw(lt, d, t, blit) {
      hideAll(); into(TOP); const k = drift(clamp(lt / d));
      stand(michel, 0.0, 1.45, { mood: 'deadpan', armL: [12, 10], armR: [60, -40], blink: blink(t) });
      stand(chief, 1.0, 1.8, { mood: 'smug', blink: blink(t, 1) }); stand(aide, -1.0, 1.8, { mood: 'content', blink: blink(t, 2) });
      stretch(topRope, V3(0, 3.35, 0), V3(0, 0.1, 0));
      shoot(TOP, topPeople, mix(V3(0.0, 1.6, 4.4), V3(1.5, 14, 28), eio(clamp((lt - 0.5) / (d - 0.5)))), mix(V3(0.0, 1.5, 1.45), V3(0, 2, -10), k), { ...LK, aperture: lt < 0.6 ? 0.0006 : 0, fov: lerp(40, 50, k) });
      blit(); if (lt < 1.4) goggles(michel); big('25 DAYS', 540, 520, 150, clamp((t - tw) / 0.25), '#F2C230');
    } });
    cue(st + 0.5, 'whoosh', { gain: 0.9 }); cue(Wd('twenty-five', 12), 'ding', { gain: 0.6 }); }

  return { shots: S, cues: CUES };
}
