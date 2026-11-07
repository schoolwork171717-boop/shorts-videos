// HE LOST A WHOLE MONTH IN A CAVE — kit v8.4: the 1962 cave stay told as a story (no names), long flying takes,
// in-world boards and calendars, a cool ice-blue cave with a warm lamp, sunny surface for the ending.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, eob, W as CW, H as CH } from './core/lib.js';
import { L, Le, Wd, T } from './core/timing.js';
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
  caver: { body: '#D8343F', pattern: 'jacket', patCol: '#A82A30', hat: 'beanie', hatCol: '#3C6FB6', extra: ['beard'], beardCol: '#6A4A30', neck: 'scarf', neckCol: '#F2C230' },
  chief: { body: '#3C6FB6', pattern: 'vest', patCol: '#2E5A9A', hat: 'cap', hatCol: '#2A2830', extra: ['mustache', 'glasses'], mustacheCol: '#5A3A22' },
  aide: { body: '#7FBF7A', pattern: 'plain', hair: '#C8783A', extra: ['freckles'] },
};
function phoneProp(g, x, y) { g.save(); g.translate(x, y - 20); g.rotate(-0.4); g.fillStyle = '#2A2A33'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-14, -70, 28, 120, 12); g.fill(); g.stroke(); g.beginPath(); g.roundRect(-26, -84, 52, 28, 10); g.fill(); g.stroke(); g.beginPath(); g.roundRect(-26, 34, 52, 28, 10); g.fill(); g.stroke(); g.restore(); }
function pencilProp(g, x, y) { g.save(); g.translate(x, y); g.rotate(0.5); g.fillStyle = '#F2C230'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.rect(-7, -80, 14, 80); g.fill(); g.stroke(); g.restore(); }

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; CUR = o.id; FF = null; f(lt, d, t, blit); FX.motes(t, { n: o.cave ? 26 : 16, col: o.cave ? '200,230,255' : '255,240,210', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.18, bloomThreshold: 0.95, aperture: 0.0016, maxblur: 0.009 };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.position.lerp(V3(...c.look), 0.12 * clamp((50 - c.fov) / 6));   // v9.2: continuous push-in (the old 38-44 on/off switch made the camera jump)
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); A.frameFix(cam, FF || all.filter((q) => q.group.parent === scene), { t: NOW, key: CUR, extras: FF ? [] : [dayBoard, calB, sept] }); all.forEach((q) => q.face(cam)); E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
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
  const ROCK = ['#5A6488', '#6A74A0', '#4E587A', '#7A84B0', '#5E6890', '#536A8E'];
  const ICE = ['#CFE8F5', '#A9D4EE', '#E8F6FC', '#8EC3E4', '#BFE0F2'];

  // ── SET 1: the sunny surface: mountain plateau, the pit with a timber tripod, the team tent ──
  const TOP = new THREE.Scene(); WD.sky(TOP, { top: '#3F7FE0', horizon: '#D6E6F7' });
  WD.sunlight(TOP, E, { col: '#FFF0D6', i: 3.0, pos: [-8, 16, 10], target: [0, 0, 0], box: 14, sky: '#CFE2FF', ground: '#8E7D6A', hemi: 1.4 });
  CY.haze(TOP, { col: '#C8D2EC', near: 80, far: 420, floorY: -3 });
  WD.clouds(TOP, [[-40, 40, -160, 26], [40, 52, -200, 32], [100, 36, -140, 20]]);
  const tg = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), WD.mat({ map: WD.T.dirt('#8EA07A', [60, 60], false) })); tg.rotation.x = -Math.PI / 2; tg.receiveShadow = true; TOP.add(tg);
  [[-60, -120, 0.2, 3, 70], [50, -150, -0.2, 7, 90], [140, -110, -0.5, 5, 60], [-150, -90, 0.4, 9, 50]].forEach(([x, z, ry, sd, h]) => { const c = CY.cliff({ w: 160, h, y0: -1, ledge: 4, setback: 1.6, seed: sd, seg: [70, 50], rim: 60, pal: ROCK }); c.position.set(x, 0, z); c.rotation.y = ry; TOP.add(c); });
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.0, 40), new THREE.MeshBasicMaterial({ color: '#05060A' })); hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.02, 0); TOP.add(hole);
  TOP.add(CY.rocks(400, [-14, 14, -10, 10], 0, ['#6A6F80', '#8E7D6A', '#5A7A5E']));
  const wood = WD.mat({ color: '#8A5A36', roughness: 0.9 });
  const legs = []; [Math.PI / 3, Math.PI, 5 * Math.PI / 3].forEach((a) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8), wood); l.position.set(Math.sin(a) * 0.65, 1.7, Math.cos(a) * 0.65); l.rotation.set(-Math.cos(a) * 0.37, 0, Math.sin(a) * 0.37); l.castShadow = true; TOP.add(l); legs.push(l); });
  const tent = (scene, x, z, col, s = 1) => { const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); const m = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 2.0 * s, 4), WD.mat({ color: col, roughness: 0.85 })); m.position.y = 1.0 * s; m.rotation.y = Math.PI / 4; m.castShadow = m.receiveShadow = true; g.add(m);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * s, 1.0 * s), WD.mat({ color: '#2A2228' })); door.position.set(0, 0.5 * s, 1.14 * s); door.rotation.x = -0.5; g.add(door); return g; };
  tent(TOP, 4.5, -3, '#E2B33C', 1.3);
  const sept = ST.board(1.3, 0.9); sept.position.set(1.8, 0, -1.6); sept.draw([['SEPT', '#FFFFFF', 90, 120], ['14', '#F2C230', 160, 290]]); TOP.add(sept);

  // ── SET 2: the cave: a shaft from a daylight hole down to an ice hall with tent, lamp, phone and his day board ──
  const CAVE = new THREE.Scene(); CAVE.background = new THREE.Color('#121A30');
  WD.sunlight(CAVE, E, { col: '#D6E6FF', i: 2.4, pos: [0.5, 50, 0.5], target: [0, 0, 0], box: 12, sky: '#9AB0E0', ground: '#4A5478', hemi: 2.0 });
  CAVE.fog = new THREE.Fog('#1A2240', 18, 70);
  const rockMat = WD.mat({ map: WD.T.stone(['#7480B0', '#8490C0', '#6E78A6', '#8C96C2'], [12, 5], 10), color: '#D0D6EC', side: THREE.BackSide, roughness: 0.95 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 42, 24, 12, true), rockMat); shaft.position.y = 31; shaft.receiveShadow = true; CAVE.add(shaft);
  const sky = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: '#EAF4FF', toneMapped: false })); sky.rotation.x = Math.PI / 2; sky.position.y = 51.9; CAVE.add(sky);
  const hall = new THREE.Mesh(new THREE.CylinderGeometry(13, 14, 10, 40, 4, true), rockMat); hall.position.y = 5; hall.receiveShadow = true; CAVE.add(hall);
  const roof = new THREE.Mesh(new THREE.RingGeometry(3.5, 14, 40), WD.mat({ color: '#3A4260', side: THREE.DoubleSide })); roof.rotation.x = Math.PI / 2; roof.position.y = 10; CAVE.add(roof);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), WD.mat({ map: WD.T.dirt('#5A6280', [8, 8], false) })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; CAVE.add(floor);
  const glacier = CY.cliff({ w: 22, h: 10, y0: 0, ledge: 1.3, setback: 0.2, rough: 0.5, seed: 12, seg: [80, 40], rim: 0, pal: ICE }); glacier.position.set(0, 0, -9.5); CAVE.add(glacier);
  const iceGlow = new THREE.PointLight('#9FD8FF', 12, 18, 1.2); iceGlow.position.set(0, 4, -6); CAVE.add(iceGlow);
  CAVE.add(CY.rocks(300, [-10, 10, -8, 8], 0, ['#6A74A0', '#4E587A', '#7A84B0']));
  const camp = new THREE.Group(); CAVE.add(camp);
  tent(camp, -1.3, -3.9, '#C8372E', 0.8);
  const crateM = WD.mat({ map: WD.T.planks('#B07A48', [0.5, 0.5]) });
  const crateA = box(0.7, 0.6, 0.6, crateM, 0.2, 0.3, -3.4, camp), crateB = box(0.7, 0.6, 0.6, crateM, 1.5, 0.3, -3.0, camp);
  const lampG = new THREE.Group(); lampG.position.set(0.2, 0.6, -3.4); camp.add(lampG);
  box(0.16, 0.04, 0.16, WD.mat({ color: '#B5372E' }), 0, 0.02, 0, lampG); const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), new THREE.MeshStandardMaterial({ color: '#FFE7A0', emissive: '#FFC870', emissiveIntensity: 1.2 })); glass.position.y = 0.14; lampG.add(glass);
  const lampL = new THREE.PointLight('#FFB45A', 11, 11, 1.3); lampL.position.set(0.2, 1.1, -3.1); CAVE.add(lampL);
  const phoneG = new THREE.Group(); phoneG.position.set(1.5, 0.6, -3.0); camp.add(phoneG);
  box(0.3, 0.14, 0.22, WD.mat({ color: '#2A2A33', roughness: 0.4 }), 0, 0.07, 0, phoneG); const hand = box(0.32, 0.06, 0.08, WD.mat({ color: '#1A1A20' }), 0, 0.17, 0, phoneG);
  CAVE.add(WD.wire(V3(1.5, 0.65, -3.0), V3(0.3, 52, 0.3), 0.0));
  const dayBoard = ST.board(1.4, 0.9); dayBoard.position.set(2.15, 0, -3.35); dayBoard.rotation.y = -0.3; dayBoard.scale.setScalar(0.85); CAVE.add(dayBoard);
  // v9 set dressing: stalactites from the roof, stalagmites and ice spikes on the floor, pebbles round the camp
  { const sm = WD.mat({ color: '#7A84B0', roughness: 0.9 }), im = WD.mat({ color: '#CFEAF8', roughness: 0.3 }); let sd = 7; const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) { const a = rn() * 6.283, r = 5 + rn() * 8, h = 0.6 + rn() * 2.4, w = 0.12 + rn() * 0.3; const c = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7), sm); c.position.set(Math.cos(a) * r, 10 - h / 2, Math.sin(a) * r); c.rotation.x = Math.PI; c.castShadow = true; CAVE.add(c); }
    for (let i = 0; i < 46; i++) { const a = rn() * 6.283, r = 4.5 + rn() * 8, h = 0.25 + rn() * 1.3, w = 0.1 + rn() * 0.28; const ice = rn() < 0.4 || Math.sin(a) < -0.6; const c = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), ice ? im : sm); c.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r - 1); c.rotation.z = (rn() - 0.5) * 0.3; c.castShadow = c.receiveShadow = true; CAVE.add(c); }
    }
  // v9 camp clutter (the reference films fill every set with small, specific things): sleeping bag, cans, books, rope, pack, socks on a line
  { const add3 = (m) => { m.castShadow = m.receiveShadow = true; camp.add(m); return m; };
    const bag = add3(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.3, 6, 14), WD.mat({ color: '#3E8A5A' }))); bag.rotation.z = Math.PI / 2; bag.rotation.y = 0.5; bag.position.set(-0.6, 0.2, -2.95); bag.scale.set(1, 1, 0.6);
    const pillow = add3(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.25, 4, 10), WD.mat({ color: '#E8D8B0' }))); pillow.rotation.z = Math.PI / 2; pillow.position.set(-1.25, 0.2, -2.55);
    const can = (x, y, z, col) => { const c = add3(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 14), WD.mat({ color: col, metalness: 0.2, roughness: 0.5 }))); c.position.set(x, y, z); };
    can(-0.05, 0.665, -3.25, '#D8343F'); can(0.42, 0.665, -3.5, '#F2C230'); can(0.5, 0.665, -3.28, '#3C6FB6'); can(2.0, 0.065, -2.7, '#D8343F');
    [['#8E3A2E', 0.06], ['#2E5A8A', 0.05], ['#D8A83A', 0.045]].forEach(([col, hh], i) => { const b = add3(new THREE.Mesh(new THREE.BoxGeometry(0.34 - i * 0.03, hh, 0.24), WD.mat({ color: col }))); b.position.set(1.62, 0.6 + 0.03 + i * 0.055, -3.2); b.rotation.y = i * 0.25; });
    const rope = add3(new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 28), WD.mat({ color: '#C8A060' }))); rope.rotation.x = Math.PI / 2; rope.position.set(-2.3, 0.05, -2.6);
    const rope2 = add3(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 28), WD.mat({ color: '#B8904E' }))); rope2.rotation.x = Math.PI / 2; rope2.position.set(-2.3, 0.13, -2.6);
    const pack = add3(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3), WD.mat({ color: '#E2723A' }))); pack.position.set(-2.7, 0.33, -3.5); pack.rotation.y = 0.5;
    const pk2 = add3(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.12), WD.mat({ color: '#C85A2A' }))); pk2.position.set(-2.7 + 0.08, 0.25, -3.5 + 0.15); pk2.rotation.y = 0.5;
    const pole = (x, z) => add3(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), WD.mat({ color: '#9A9AA8', metalness: 0.4 }))).position.set(x, 0.85, z);
    pole(-2.6, -4.4); pole(-0.2, -5.0); const line = add3(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.47, 4), WD.mat({ color: '#EEE' }))); line.position.set(-1.4, 1.62, -4.7); line.rotation.z = Math.PI / 2; line.rotation.y = Math.atan2(0.6, 2.4);
    ['#F2F2F2', '#D8343F', '#F2F2F2', '#3C6FB6'].forEach((col, i) => { const u = -2.3 + i * 0.6, z = -4.4 - (u + 2.6) / 2.4 * 0.6; const sk = add3(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.04), WD.mat({ color: col }))); sk.position.set(u, 1.45, z); sk.rotation.y = Math.atan2(0.6, 2.4); const ft = add3(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.04), WD.mat({ color: col }))); ft.position.set(u + 0.05, 1.29, z); ft.rotation.y = Math.atan2(0.6, 2.4); }); }
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshStandardMaterial({ color: '#8EC3E4', roughness: 0.1, metalness: 0.2 })); puddle.rotation.x = -Math.PI / 2; puddle.position.set(0.8, 0.015, -1.6); CAVE.add(puddle);

  // ── SET 3: the surface team's tent: log book table, wall calendar, a clock under a cloth ──
  const TT = WD.interior(E, { w: 7, depth: 6, h: 3.6, wall: '#9FB8D8', motif: '#8AA4C8', floor: '#6E8AB0', ceiling: '#5A6E90', signText: 'SURFACE TEAM', counterOn: false, litter: false, picture: false });
  TT.scene.background = new THREE.Color('#9FB8D8');
  box(2.2, 0.08, 1.0, WD.mat({ color: '#A8693E' }), 1.0, 0.86, -3.4, TT.scene); [[0, -3.0], [2, -3.0], [0, -3.8], [2, -3.8]].forEach(([x, z]) => box(0.06, 0.86, 0.06, wood, x, 0.43, z, TT.scene));
  const book = box(0.6, 0.04, 0.42, WD.mat({ color: '#F4EFE4' }), 0.6, 0.92, -3.3, TT.scene);
  const tphone = new THREE.Group(); tphone.position.set(1.6, 0.9, -3.2); TT.scene.add(tphone); box(0.3, 0.14, 0.22, WD.mat({ color: '#2A2A33' }), 0, 0.07, 0, tphone);
  const calB = ST.board(1.2, 1.0); calB.position.set(-1.9, 0.6, -5.6); calB.draw([['SEPTEMBER', '#FFFFFF', 64, 90], ['14', '#F2C230', 170, 270]]); TT.scene.add(calB);
  const clockTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#FFFDF4'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#2A2230'; g.lineWidth = 10; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96); g.lineTo(128 + Math.sin(a) * 110, 128 - Math.cos(a) * 110); g.stroke(); }
    g.lineWidth = 9; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.moveTo(128, 128); g.lineTo(176, 150); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.6 })); clock.position.set(1.4, 2.25, -5.88); TT.scene.add(clock);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), WD.mat({ color: '#D8343F', side: THREE.DoubleSide })); cloth.position.set(1.4, 2.25, -5.84); TT.scene.add(cloth);

  // ── cast ──
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const caver = mk('caver', 1), chief = mk('chief', 2), aide = mk('aide', 3, 1.66);
  const all = [caver, chief, aide];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const headXY = (p, up = 1.47) => { const v = p.group.position.clone(); v.y += up; v.project(cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; };
  const goggles = (p, up = 1.47) => { const [x, y] = headXY(p, up); const s = Math.max(0.4, Math.min(2.4, 9 / cam.position.distanceTo(p.group.position))) * 0.5; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = '#1C1C24'; ctx.strokeStyle = INK; ctx.lineWidth = 8;
    [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * 46, 0, 40, 30, 0, 0, 7); ctx.fill(); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -4); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * 46 - 14, -10, 10, 6, -0.4, 0, 7); ctx.fill(); }); ctx.restore(); };
  const glare = (k) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#FFFCF0'; ctx.fillRect(0, 0, CW, CH); ctx.restore(); };
  const ringLines = (x, y, t, k) => { if (k <= 0) return; ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const r = 50 + i * 26 + Math.sin(t * 30) * 4; ctx.globalAlpha = k * (1 - i * 0.25); ctx.beginPath(); ctx.arc(x, y, r, -0.7, 0.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); } ctx.restore(); };
  const proj = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * CW, (1 - p.y) / 2 * CH]; };
  const COLD = '#8FB8F0';

  // ── S1 · "A guy lived alone in a freezing cave for two months, and somehow lost almost a whole month without noticing."
  { const st = 0, fr = Wd('freezing', 0), mo = Wd('months', 0), lo = Wd('lost', 0), no = Wd('noticing', 0), end = L(1);
    add({ id: 'S1', at: st, cave: true, note: 'cold open: one long fall from the bright hole down the rock shaft into the ice hall, landing on the bearded caver waving by his little red tent', draw(lt, d, t, blit) {
      hideAll(); into(CAVE, caver);
      act(caver, 0.6, -2.2, { ...A.face(t, [[st, 'happy'], [lo, 'content'], [no, 'skeptic']]), armR: A.arm(t, [[st, [150, -20]], [lo, [30, 30]]]), flush: 0.25, flushCol: COLD, ...A.react('shrug', t, no, 1.0) });
      const k = eio(clamp((t - st) / Math.max(1, mo - st + 0.6)));
      const c = A.camPath(t, [
        [st, [0.3, 46, 0.6], [0.3, 30, 0.0], 52],
        [mo + 0.2, [1.2, 6.5, 3.6], [0.5, 1.5, -2.0], 48],
        [end, [1.2, 1.7, 1.6], [0.6, 1.45, -2.2], 40],
      ]);
      shoot(CAVE, c); blit();
    } });
    cue(0.1, 'swoosh', { gain: 0.45, sweep: -0.8 }); cue(no, 'tock', { gain: 0.3 }); }

  // ── S2 · "No clock, no calendar, no sunlight. Just a tent, a little lamp, and a phone to the surface."
  { const st = L(1), cl = Wd('clock', 1), ca = Wd('calendar', 1), su = Wd('sunlight', 1), te = Wd('tent', 1), la = Wd('lamp', 1), ph = Wd('phone', 1), end = L(2);
    add({ id: 'S2', at: st, cave: true, note: 'his day board crosses out CLOCK, CALENDAR, SUN; then the camp pops in on the beat: tent, lamp (it glows), phone', draw(lt, d, t, blit) {
      hideAll(); into(CAVE, caver);
      const lines = [['NO CLOCK', t > cl + 0.2 ? '#FF8A80' : '#FFFFFF', 60, 90], ['NO CALENDAR', t > ca + 0.2 ? '#FF8A80' : '#FFFFFF', 56, 200], ['NO SUN', t > su + 0.2 ? '#FF8A80' : '#FFFFFF', 60, 310]];
      dayBoard.draw(t > te - 0.2 ? [['TENT', '#F2C230', 70, 90], ['LAMP', '#F2C230', 70, 200], ['PHONE', '#F2C230', 70, 310]] : lines);
      glass.material.emissiveIntensity = t > la ? 1.2 : 0.1; lampL.intensity = t > la ? 11 : 0.5;
      act(caver, 0.8, -1.8, { ...A.face(t, [[st, 'skeptic'], [su, 'sad'], [te, 'content'], [ph, 'happy']]), armR: A.arm(t, [[st, [80, 40]], [cl, [110, 30]], [ca, [80, 40]], [su, [110, 30]], [te, [150, -20]], [ph, [90, 60]]]), holdR: t > ph ? phoneProp : undefined, flush: 0.25, flushCol: COLD });
      const c = A.camPath(t, [
        [st, [1.6, 1.7, 1.4], [1.6, 1.3, -2.8], 46],
        [te - 0.1, [1.8, 2.0, 1.2], [0.4, 0.9, -3.2], 46],
        [end, [1.6, 1.7, 0.6], [1.0, 1.4, -2.0], 40],
      ]);
      shoot(CAVE, c); blit();
    } });
    cue(Wd('clock', 1) + 0.2, 'tock', { gain: 0.3 }); cue(Wd('calendar', 1) + 0.2, 'tock', { gain: 0.3 }); cue(Wd('sunlight', 1) + 0.2, 'tock', { gain: 0.3 }); cue(Wd('lamp', 1), 'ding', { gain: 0.3 }); }

  // ── S3 · "Every time he woke up, ate, or went to bed, he called his team up top." / "They wrote down the real time, and they were not allowed to tell him."
  { const st = L(2), wo = Wd('woke', 2), at = Wd('ate', 2), be = Wd('bed', 2), ca = Wd('called', 2), th = L(3), wr = Wd('wrote', 3), no = Wd('not', 3), end = L(4);
    add({ id: 'S3', at: st, cave: true, note: 'a living time-lapse: he stretches awake, sips from a cup, yawns, and lifts the phone; dissolve-free swing up the wire to the surface tent where the team logs the time and drapes a red cloth over the clock', draw(lt, d, t, blit) {
      const top = t > th - 0.1;
      if (!top) { hideAll(); into(CAVE, caver);
        act(caver, 1.0, -2.0, { ...A.face(t, [[st, 'tired'], [wo + 0.3, 'happy'], [at, 'content'], [be, 'tired'], [ca, 'excited']]), armR: A.arm(t, [[st, [160, 20]], [at - 0.1, [90, 120]], [be, [150, 160]], [ca, [100, 150]]]), armL: A.arm(t, [[st, [160, -20]], [at, [30, 30]]]),
          holdR: t > at - 0.1 && t < be ? PROPS.cup : t > ca ? phoneProp : undefined, flush: 0.25, flushCol: COLD });
        const c = A.camPath(t, [[st, [1.9, 1.75, 0.8], [1.0, 1.4, -2.0], 40], [th - 0.1, [1.4, 1.9, 0.4], [1.2, 1.5, -2.6], 42]]);
        shoot(CAVE, c); blit(); if (t > ca) { const [x, y] = proj(caver.group.position.clone().add(V3(0.3, 1.5, 0))); ringLines(x, y, t, 0.8); } return; }
      hideAll(); into(TT.scene, chief, aide);
      cloth.position.y = lerp(3.4, 2.25, eo(clamp((t - no) / 0.4)));
      act(chief, 0.1, -2.6, { ...A.face(t, [[th, 'content'], [wr, 'scheme'], [no, 'sly']]), holdR: pencilProp, armR: A.arm(t, [[th, [70, 60]], [wr, [80, 80]], [no, [150, -20]]]) });
      act(aide, 1.5, -2.8, { ...A.face(t, [[th, 'happy'], [no, 'scheme']]), armR: A.arm(t, [[th, [60, 40]], [no - 0.2, [160, 20]]]), ...A.react('point', t, no, 0.8) });
      const c = A.camPath(t, [[th - 0.1, [0.7, 1.8, 1.6], [0.8, 1.4, -3.0], 46], [end, [1.0, 1.85, 1.6], [0.9, 1.65, -4.0], 46]]);
      shoot(TT.scene, c); blit();
    } });
    cue(Wd('woke', 2), 'pop', { gain: 0.25 }); cue(Wd('ate', 2), 'gulp', { gain: 0.3 }); cue(Wd('called', 2), 'ding', { gain: 0.3 }); cue(L(3) - 0.1, 'swoosh', { gain: 0.45 }); cue(Wd('not', 3), 'slide', { gain: 0.35 }); }

  // ── S4 · "It was barely above freezing down there, and his feet were always wet."
  { const st = L(4), fr = Wd('freezing', 4), fe = Wd('feet', 4), we = Wd('wet', 4), end = L(5);
    add({ id: 'S4', at: st, trans: 'dissolve', cave: true, note: 'back in the cave: he shivers blue-faced, then the camera drops to his boots standing in an icy puddle as drips fall', draw(lt, d, t, blit) {
      hideAll(); into(CAVE, caver);
      act(caver, 0.8, -1.6, { ...A.face(t, [[st, 'worried'], [we, 'sad']]), flush: 0.85, flushCol: COLD, tilt: Math.sin(t * 40) * 3, dx: Math.sin(t * 50) * 0.01, armL: [30, 140], armR: [30, 140], energy: 1.2, sweat: 1 });
      const c = A.camPath(t, [[st, [1.3, 1.65, 0.6], [0.8, 1.5, -1.6], 38], [fe - 0.1, [2.8, 1.3, 1.0], [0.8, 0.75, -1.6], 44], [end, [2.9, 1.4, 1.2], [0.8, 0.8, -1.6], 46]]);
      shoot(CAVE, c); blit();
    } });
    cue(Wd('wet', 4), 'plop', { gain: 0.35 }); }

  // ── S5 · "One day they asked him to count to a hundred and twenty, one number every second." / "It took him five minutes."
  { const st = L(5), co = Wd('count', 5), se = Wd('second', 5), it = L(6), fi = Wd('five', 6), end = L(7);
    add({ id: 'S5', at: st, cave: true, note: 'on the phone he counts on his fingers; his board ticks up painfully slowly; on "five minutes" it reads 120 = 5 MINUTES and he scratches his head', draw(lt, d, t, blit) {
      hideAll(); into(CAVE, caver);
      const n = t < co ? 0 : Math.min(120, Math.floor((t - co) * 6)); dayBoard.draw(t > fi - 0.1 ? [['COUNT TO 120', '#FFFFFF', 54, 90], ['TOOK HIM', '#FFFFFF', 54, 200], ['5 MINUTES', '#FF8A80', 76, 310]] : [['COUNTING...', '#FFFFFF', 56, 100], [String(n), '#F2C230', 150, 270]]);
      act(caver, 1.0, -1.9, { ...A.face(t, [[st, 'content'], [co, 'scheme'], [fi, 'gasp']]), holdR: phoneProp, armR: [100, 150], armL: A.arm(t, [...Array(8)].map((_, k) => [co + k * 0.45, k % 2 ? [110, 20] : [80, 50]])), ...A.react('shrug', t, fi + 0.2, 1.0), flush: 0.25, flushCol: COLD });
      const c = A.camPath(t, [[st, [1.4, 1.75, 1.0], [1.0, 1.4, -2.0], 42], [co + 0.5, [1.9, 1.7, 1.4], [1.6, 1.3, -2.8], 46], [end, [1.8, 1.7, 1.2], [1.5, 1.3, -2.7], 44]]);
      shoot(CAVE, c); blit();
    } });
    cue(Wd('five', 6), 'boing', { gain: 0.35 }); }

  // ── S6 · "Then the phone rang. The experiment was over." / "He was confused. By his count, it was only August twentieth. He thought he still had almost a month to go."
  { const st = L(7), ra = Wd('rang', 7), ov = Wd('over', 7), co = L(8), au = Wd('august', 8), mo = Wd('month', 8), end = L(9);
    add({ id: 'S6', at: st, cave: true, note: 'the phone rattles on its crate, he jumps, answers, and his board flips to his own count: AUGUST 20, while he counts on his fingers, baffled', draw(lt, d, t, blit) {
      hideAll(); into(CAVE, caver);
      const ringing = t > ra - 0.2 && t < ov; hand.position.y = 0.17 + (ringing ? Math.abs(Math.sin(t * 40)) * 0.04 : 0); phoneG.rotation.z = ringing ? Math.sin(t * 50) * 0.05 : 0;
      dayBoard.draw([['HIS COUNT:', '#FFFFFF', 54, 90], ['AUGUST', '#F2C230', 76, 200], ['20', '#F2C230', 110, 310]]);
      act(caver, 1.0, -1.9, { ...A.face(t, [[st, 'tired'], [ra, 'shock'], [ov, 'gasp'], [co, 'skeptic'], [au, 'worried'], [mo, 'dizzy']]), holdR: t > ov - 0.2 ? phoneProp : undefined, armR: t > ov - 0.2 ? [100, 150] : [30, 30], hopY: A.hop(t, ra, 0.4, 0.3), ...A.react('shock', t, ra, 0.5), ...A.react('shrug', t, mo, 1.0), flush: 0.25, flushCol: COLD });
      const c = A.camPath(t, [[st, [2.6, 1.6, 0.2], [1.5, 0.9, -3.0], 42], [ov, [1.8, 1.75, 0.6], [1.0, 1.45, -1.9], 40], [au, [1.9, 1.7, 1.4], [1.6, 1.3, -2.8], 46], [end, [1.8, 1.75, 1.0], [1.4, 1.4, -2.4], 44]]);
      shoot(CAVE, c); blit(); if (ringing) { const [x, y] = proj(V3(1.5, 0.9, -3.0)); ringLines(x, y, t, 1); }
    } });
    cue(Wd('rang', 7) - 0.2, 'alarm', { gain: 0.25 }); cue(Wd('rang', 7) + 0.1, 'alarm', { gain: 0.25 }); cue(L(8) + 0.1, 'boing', { gain: 0.3 }); cue(Wd('august', 8), 'slide', { gain: 0.3 }); }

  // ── S7 · "You see, without the sun, his days quietly stretched a little longer than normal, and his sense of time shrank." /
  //         "It's like a watch that runs a few minutes slow. Each day it's barely off, and a month later you've missed the bus."
  { const st = L(9), ys = Wd('see', 9), st2 = Wd('stretched', 9), sh = Wd('shrank', 9), it = L(10), wa = Wd('watch', 10), ba = Wd('barely', 10), bu = Wd('bus', 10), end = L(11);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'the surface tent: the chief\'s board compares HIS DAY 24 h 30 m with A REAL DAY 24 h; then the calendar on the wall races to SEPTEMBER 14 while the aide taps his slow watch and shrugs', draw(lt, d, t, blit) {
      hideAll(); into(TT.scene, chief, aide); cloth.position.y = 3.4;
      calB.draw(t < it ? [['HIS DAY', '#FFFFFF', 60, 80], ['24 h 30 m', '#F2C230', 80, 170], ['REAL DAY: 24 h', '#8FE0A0', 54, 290]] : [['SLOW WATCH', '#FFFFFF', 60, 90], [t > bu - 0.3 ? 'MISSED THE BUS' : 'A BIT LATE...', t > bu - 0.3 ? '#FF8A80' : '#F2C230', 64, 260]]);
      act(chief, t < L(10) ? -0.6 : 1.0, -4.2, { ...A.face(t, [[st, 'content'], [st2, 'excited'], [sh, 'proud']]), holdR: pencilProp, armR: A.arm(t, [[st, [40, 40]], [st2 - 0.2, [120, 40]], [sh + 0.4, [40, 40]]]), ...A.react('point', t, st2, 1.0) });
      act(aide, t < L(10) ? 0.9 : -0.3, -3.0, { ...A.face(t, [[st, 'skeptic'], [wa, 'scheme'], [ba, 'content'], [bu, 'shock']]), armL: A.arm(t, [[st, [30, 30]], [wa, [80, 120]]]), ...A.react('shock', t, bu, 0.6), ...A.react('shrug', t, bu + 0.5, 0.9) });
      const c = A.camPath(t, [[st, [0.2, 1.8, 0.4], [-1.2, 1.5, -4.6], 44], [it, [-0.4, 1.75, 0.8], [-0.9, 1.45, -3.8], 46], [end, [-0.5, 1.7, 0.3], [-1.0, 1.45, -3.8], 44]]);
      shoot(TT.scene, c); blit();
    } });
    cue(Wd('see', 9), 'swoosh', { gain: 0.3 }); cue(Wd('bus', 10) - 0.2, 'boing', { gain: 0.3 }); }

  // ── S8 · "So he climbed out in dark ski goggles, squinting at a summer that was almost over." / "His body never lost its rhythm. His brain just lost track of twenty-five days."
  { const st = L(11), cl = Wd('climbed', 11), go = Wd('goggles', 11), su = Wd('summer', 11), hi = L(12), br = Wd('brain', 12), tw = Wd('twenty', 12), end = T.dur;
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'blinding daylight: he rises out of the pit on the rope in black ski goggles, the team cheers; the camera settles on him beside the board that says SEPT 14 as he counts on his fingers and shrugs', draw(lt, d, t, blit) {
      hideAll(); into(TOP, caver, chief, aide); legs.forEach((l) => (l.visible = false));
      const rise = eo(clamp((t - st) / 1.6));
      act(caver, lerp(0.0, 0.9, eo(clamp((t - cl - 1.0) / 0.8))), lerp(0.0, 0.6, eo(clamp((t - cl - 1.0) / 0.8))), { ...A.face(t, [[st, 'strain'], [go, 'happy'], [hi, 'content'], [br, 'skeptic'], [tw, 'gasp']]), armR: t < cl + 1 ? [170, 0] : A.arm(t, [[cl + 1, [40, 40]], [tw, [110, 30]]]), armL: t < cl + 1 ? [170, 0] : [30, 30], ...A.react('shrug', t, tw + 0.4, 1.0) }, lerp(-1.8, 0, rise));
      act(chief, t > hi - 0.5 ? 4.6 : 3.0, -0.4, { ...A.face(t, [[st, 'excited'], [su, 'laugh']]), ...A.react('cheer', t, go, 1.0) });
      act(aide, t > hi - 0.5 ? -3.2 : -1.3, -0.5, { ...A.face(t, [[st, 'excited'], [su, 'happy']]), ...A.react('cheer', t, go + 0.2, 1.0) });
      if (t > hi - 0.5) { FF = [caver]; chief.group.visible = aide.group.visible = false; }
      const c = A.camPath(t, [[st, [1.6, 1.3, 3.4], [0.2, 1.0, 0.0], 46], [su, [1.2, 1.8, 5.2], [0.6, 1.2, -0.3], 48], [hi + 0.3, [1.5, 1.7, 4.4], [1.4, 1.35, -0.6], 46], [end, [1.3, 1.65, 4.0], [1.2, 1.35, -0.7], 46]]);
      shoot(TOP, c);
      blit(); goggles(caver, 1.47); glare((1 - clamp((t - st) / 1.2)) * 0.9);
    } });
    cue(L(11), 'swoosh', { gain: 0.4, sweep: 0.8 }); cue(Wd('goggles', 11), 'ding', { gain: 0.3 }); cue(Wd('twenty', 12) + 0.3, 'boing', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
