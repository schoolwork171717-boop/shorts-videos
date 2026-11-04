// WHY THE COWBOY WHO DRAWS FIRST LOSES: the shot list (Iron Canyon 3D, Old West town).
// Niels Bohr's idea (the one who reacts moves faster), his toy-pistol duels with George Gamow, the 2010 Birmingham
// button "gunfights" (reacting is 21 ms faster, but noticing takes ~200 ms, so the second draw still loses).
// Every "shot" in this film is a cartoon flag-gun: a BANG! flag pops out, a hat flies off, nobody gets hurt.
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

const LOOK = {
  hero: { body: '#E8DCC0', pattern: 'vest', patCol: '#7A5638', neck: 'scarf', neckCol: '#C8372E', hat: 'cowboy', hatCol: '#F2E6CF', band: '#7A5638', hair: '#8A5A36', belt: '#4A3424' },
  villain: { body: '#3B3346', pattern: 'vest', patCol: '#24202C', hat: 'cowboy', hatCol: '#26222A', band: '#C8372E', hair: '#2A2230', extra: ['mustache'], mustacheCol: '#2A2230', belt: '#2A2230' },
  bohr: { body: '#4A4A55', pattern: 'vest', patCol: '#34343E', neck: 'tie', neckCol: '#7A2E2E', hat: 'none', hair: '#5A4634', hairSide: 0 },
  gamow: { body: '#7A6248', pattern: 'jacket', patCol: '#5A4634', neck: 'bowtie', neckCol: '#3C6FB6', hat: 'none', hair: '#D9B25A', hairSide: 0, extra: ['glasses'] },
  vol1: { body: '#3C6FB6', pattern: 'stripes', patCol: '#2C5288', hat: 'none', hair: '#3A2A22', hairSide: 1 },
  vol2: { body: '#E8734A', pattern: 'check', patCol: '#B5553C', hat: 'none', hair: '#C9A13B', hairSide: -1 },
  prof: { body: '#F4F4F8', pattern: 'jacket', patCol: '#D8DCE4', neck: 'tie', neckCol: '#3C6FB6', hat: 'none', hair: '#8A8A94', hairSide: 0, extra: ['glasses'] },
  director: { body: '#2A2A33', pattern: 'stripes', patCol: '#F4F4F8', hat: 'beanie', hatCol: '#C8372E', hair: '#3A2A22', extra: ['beard'], beardCol: '#3A2A22' },
};
const person = (k) => new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] });

// ---- 2D hand props: a revolver / toy pistol pointing along the forearm, with a pop-out BANG! flag (f 0..1) ----
const gun = (toy = false, f = 0) => function gun(g, x, y, ang) {
  g.save(); g.translate(x, y); g.rotate(-ang); g.strokeStyle = INK; g.lineWidth = 5; g.lineJoin = 'round';
  const body = toy ? '#D8343F' : '#4A4A55', grip = toy ? '#F2C230' : '#8A5A36';
  g.fillStyle = grip; g.beginPath(); g.roundRect(-16, -34, 30, 58, 10); g.fill(); g.stroke();
  g.fillStyle = body; g.beginPath(); g.roundRect(-20, 10, 40, 46, 10); g.fill(); g.stroke();
  g.beginPath(); g.roundRect(-11, 50, 22, 74, 6); g.fill(); g.stroke();
  if (toy) { g.fillStyle = '#3C6FB6'; g.beginPath(); g.arc(0, 32, 9, 0, 7); g.fill(); g.stroke(); }
  if (f > 0) { const L = 124 + f * 70; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(0, 124); g.lineTo(0, L); g.stroke();
    if (f > 0.4) { const k = clamp((f - 0.4) / 0.6); g.save(); g.translate(0, L); g.rotate(Math.PI / 2); g.scale(k, k);
      g.fillStyle = '#FFFDF4'; g.lineWidth = 6; g.beginPath(); g.moveTo(-6, -2); g.lineTo(-6, -96); g.lineTo(150, -96); g.lineTo(150, -2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#D8343F'; g.font = '900 44px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BANG!', 72, -50); g.restore(); } }
  g.restore(); };
const GUN = { r: gun(false, 0), t: gun(true, 0) };
const gunF = (toy, f) => (f <= 0 ? (toy ? GUN.t : GUN.r) : gun(toy, Math.round(f * 10) / 10));
const clip = PROPS.paper ? PROPS.paper('RESULTS') : PROPS.cup;
const megaphone = function megaphone(g, x, y, ang) { g.save(); g.translate(x, y); g.rotate(-ang); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#F2C230';
  g.beginPath(); g.moveTo(-12, -10); g.lineTo(12, -10); g.lineTo(46, 110); g.lineTo(-46, 110); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#2A2A33'; g.beginPath(); g.ellipse(0, 110, 46, 12, 0, 0, 7); g.fill(); g.stroke(); g.restore(); };

export function buildShots(E) {
  const S = [], CUES = [], add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); if (!o.noMotes) FX.motes(t, { n: 22, col: o.lab ? '255,255,255' : '255,232,190' }); if (o.shafts) FX.shafts(t, { k: o.shafts, x: o.shaftX ?? CW * 0.8, angle: o.shaftA ?? 0.45 }); }; S.push(o); return o; }, cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.06);
  const cam = camera(40);
  const headXY = (p, up = 1.62) => { const v = p.group.position.clone(); v.y += up; v.project(cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; };
  const LK = { bloom: 0.14, aperture: 0.0006, maxblur: 0.006 };
  const shoot = (scene, people, from, to, at, at2, k, look = LK, shake = 0, t = 0) => {
    const fov = look.fov || 40; if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const p = mix(from, to, k); if (shake) p.add(V3(Math.sin(t * 61) * shake, Math.cos(t * 47) * shake, 0));
    cam.position.copy(p); const a = at2 ? mix(at, at2, k) : at; cam.lookAt(a);
    people.forEach((q) => q.face(cam));
    E.render(scene, cam, { ...look, focus: look.focus ?? cam.position.distanceTo(a), t });
  };
  const stand = (p, x, z, st = {}, y = 0) => { p.group.visible = true; p.at(x, y, z).set({ bob: st.legs === 'walk' ? 0 : idle(x * 3 + z), ...st }); };
  // guns are separate little cut-out planes on the person's pivot, so they can stick out past the body canvas
  const GT = new Map();
  const gunTex = (toy, f) => { const key = (toy ? 't' : 'r') + f; if (GT.has(key)) return GT.get(key);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); g.translate(70, 150);
    g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round'; const body = toy ? '#D8343F' : '#4A4A55', grip = toy ? '#F2C230' : '#8A5A36';
    g.fillStyle = grip; g.beginPath(); g.moveTo(-14, -6); g.lineTo(18, -6); g.lineTo(10, 58); g.lineTo(-24, 54); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = body; g.beginPath(); g.roundRect(-10, -34, 70, 40, 10); g.fill(); g.stroke(); g.beginPath(); g.roundRect(52, -28, 96, 22, 6); g.fill(); g.stroke();
    if (toy) { g.fillStyle = '#3C6FB6'; g.beginPath(); g.arc(24, -14, 10, 0, 7); g.fill(); g.stroke(); } else { g.fillStyle = '#9AA3AE'; g.beginPath(); g.arc(24, -14, 12, 0, 7); g.fill(); g.stroke(); }
    if (f > 0) { const x1 = 148 + f * 60; g.lineWidth = 7; g.beginPath(); g.moveTo(148, -17); g.lineTo(x1, -17); g.stroke();
      if (f > 0.4) { const k = Math.min(1, (f - 0.4) / 0.6); g.save(); g.translate(x1, -17); g.scale(k, k); g.fillStyle = '#FFFDF4'; g.lineWidth = 6; g.beginPath(); g.rect(0, -120, 150, 104); g.fill(); g.stroke();
        g.fillStyle = '#D8343F'; g.font = '900 44px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BANG!', 75, -68); g.restore(); } }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; GT.set(key, tx); return tx; };
  const gunMeshes = [];
  const gunMesh = (p) => { if (p.gun) return p.gun; const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false })); m.visible = false; p.pivot.add(m); p.gun = m; gunMeshes.push(m); return m; };
  const armed = (p, side, toy = false, f = 0) => { const m = gunMesh(p), arm = side > 0 ? p.st.armR : p.st.armL, hand = p.hands && p.hands[side > 0 ? 'R' : 'L']; if (!arm || !hand) return;
    m.material.map = gunTex(toy, Math.round(f * 10) / 10); m.material.needsUpdate = true; m.visible = true;
    const H = p.H, Wd = H / 2, s = (Wd / 512) * 0.85, a2 = (arm[0] + arm[1]) * Math.PI / 180;
    const lx = (hand[0] / 512 - 0.5) * Wd, ly = H - H * (24 / 1024) - (hand[1] / 1024) * H;
    const th = Math.atan2(-Math.cos(a2), side * Math.sin(a2)), sy = side > 0 ? 1 : -1, ox = 186 * s, oy = 22 * s * sy;
    m.scale.set(512 * s, 256 * s * sy, 1); m.rotation.set(0, 0, th); m.position.set(lx + Math.cos(th) * ox - Math.sin(th) * oy, ly + Math.sin(th) * ox + Math.cos(th) * oy, 0.012); };
  const unarm = () => gunMeshes.forEach((m) => (m.visible = false));

  // ── SET 1: the Old West street. Dirt road along x; wooden fronts at z -7 facing +z; red-rock cliffs behind ──
  const TOWN = new THREE.Scene(); WD.sky(TOWN, { top: CY.PAL.sky, horizon: '#CFE0F5' });
  WD.sunlight(TOWN, E, { col: '#FFF0D6', i: 3.0, pos: [6, 16, 10], target: [0, 0, 0], box: 16, sky: '#CFE2FF', ground: '#C4703E', hemi: 1.2 });
  CY.haze(TOWN, { col: '#C9B4DA', near: 80, far: 420, floorY: -2 });
  WD.clouds(TOWN, [[-50, 40, -160, 26], [30, 50, -200, 32], [90, 36, -140, 20]]);
  const tg = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), WD.mat({ map: WD.T.dirt('#D29A62', [80, 80], false) })); tg.rotation.x = -Math.PI / 2; tg.receiveShadow = true; TOWN.add(tg);
  [[-60, -110, 0.1, 3, 40], [40, -140, -0.15, 7, 46], [130, -100, -0.5, 5, 30], [-150, -90, 0.4, 9, 28]].forEach(([x, z, ry, sd, h]) => { const c = CY.cliff({ w: 140, h, y0: -1, ledge: 3.2, setback: 1.2, seed: sd, seg: [60, 40], rim: 50 }); c.position.set(x, 0, z); c.rotation.y = ry; TOWN.add(c); });
  const SHOPS = [['SALOON', '#9E4A3A'], ['GENERAL STORE', '#C9A27A'], ['SHERIFF', '#7A8A6A'], ['BANK', '#C7B79A'], ['HOTEL', '#A3485A'], ['BARBER', '#E3C16F'], ['ASSAY OFFICE', '#8C6F55'], ['STABLES', '#7A5638']];
  { let x = -26, k = 0; while (x < 30) { const [name, wall] = SHOPS[k % SHOPS.length], w = 6 + rnd(k) * 2, h = 5.5 + rnd(k * 3) * 2.5;
      const front = WD.mat({ map: WD.facade(name, { wall, kind: 'wood', trim: '#F2E6CF', sign: '#3A2A22', signText: '#F2D37A', w, h, seed: k + 3 }) }), side = WD.mat({ color: wall });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), [side, side, side, side, front, side]); b.position.set(x + w / 2, h / 2, -10); b.castShadow = b.receiveShadow = true; TOWN.add(b);
      const porch = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 2.2), WD.mat({ map: WD.T.planks('#8A5A36', [w / 2, 1]) })); porch.position.set(x + w / 2, 0.1, -5.9); porch.receiveShadow = true; TOWN.add(porch);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 2.4), WD.mat({ color: '#6B3E26' })); roof.position.set(x + w / 2, 3.0, -5.9); roof.rotation.x = 0.18; roof.castShadow = true; TOWN.add(roof);
      [0.3, w - 0.3].forEach((dx) => { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.9, 0.14), WD.mat({ color: '#6B3E26' })); post.position.set(x + dx, 1.45, -4.9); post.castShadow = true; TOWN.add(post); });
      x += w + 0.1; k++; } }
  [[-9, -4.3], [3.5, -4.4], [12, -4.2]].forEach(([x, z], i) => { const o = i % 2 ? WD.crate() : WD.barrel(); o.position.set(x, 0, z); TOWN.add(o); });
  for (let i = 0; i < 10; i++) { const c = CY.cactus(0.4 + rnd(i) * 0.5, i % 3 ? 'pear' : 'saguaro'); c.position.set(-40 + i * 9 + rnd(i) * 3, 0, 8 + rnd(i * 4) * 10); TOWN.add(c); }
  TOWN.add(CY.rocks(600, [-30, 30, -4, 20], 0, ['#B2462E', '#C9A27A', '#8E7D6A']));
  // the tumbleweed (rolls along x)
  const weed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: '#B08A52', wireframe: true })); weed.visible = false; TOWN.add(weed);
  const weedAt = (x, t) => { weed.visible = true; weed.position.set(x, 0.45 + Math.abs(Math.sin(t * 5)) * 0.25, 1.6); weed.rotation.z = -t * 6; };
  // a 3D cowboy hat that can fly off
  const flyHat = (() => { const g = new THREE.Group(), m = WD.mat({ color: '#26222A', roughness: 0.8 }), band = WD.mat({ color: '#C8372E' });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 24), m); g.add(brim); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.18, 20), m); crown.position.y = 0.1; g.add(crown);
    const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.04, 20), band); bd.position.y = 0.04; g.add(bd); g.traverse((o) => (o.castShadow = true)); g.visible = false; TOWN.add(g); return g; })();
  const hatFly = (x, z, s, k, col) => { flyHat.visible = k > 0; if (!flyHat.visible) return; flyHat.children[0].material.color.set(col); flyHat.children[1].material.color.set(col);
    flyHat.position.set(x + s * k * 1.6, 1.72 + 1.8 * k - 1.6 * k * k, z + 0.1); flyHat.rotation.set(k * 2.5, k * 7, s * k * 3); };
  const villain = person('villain'), hero = person('hero'), director = person('director');
  const town = [villain, hero, director]; town.forEach((p) => TOWN.add(p.group));
  // the film crew for the reveal: a camera on a tripod, a spotlight and a chair
  const crew = new THREE.Group(); TOWN.add(crew); crew.visible = false;
  { const dk = WD.mat({ color: '#2A2A33', roughness: 0.5, metalness: 0.4 }), al = WD.mat({ color: '#9AA3AE', metalness: 0.7, roughness: 0.3 });
    const bx = (w, h, d, m, x, y, z, p = crew) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; p.add(b); return b; };
    const camRig = new THREE.Group(); camRig.position.set(-0.7, 0, 0); crew.add(camRig);
    [0, 2.1, 4.2].forEach((a) => { const l = bx(0.05, 1.5, 0.05, al, Math.sin(a) * 0.35, 0.72, Math.cos(a) * 0.35, camRig); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); });
    bx(0.5, 0.42, 0.8, dk, 0, 1.65, 0, camRig); const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.34, 16), dk); lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.65, -0.55); camRig.add(lens);
    [0.3, -0.25].forEach((z) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 24), dk); r.rotation.z = Math.PI / 2; r.position.set(0, 2.1, z); camRig.add(r); });
    const lamp = new THREE.Group(); lamp.position.set(-2.2, 0, 0.6); crew.add(lamp); bx(0.05, 2.4, 0.05, al, 0, 1.2, 0, lamp);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, 0.5, 18), dk); head.rotation.x = Math.PI / 2 + 0.3; head.position.set(0, 2.45, -0.1); lamp.add(head);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: '#FFF6D8', toneMapped: false })); face.position.set(0, 2.38, -0.36); face.rotation.x = Math.PI + 0.3; lamp.add(face);
    const chair = new THREE.Group(); chair.position.set(1.2, 0, 0.6); crew.add(chair); bx(0.6, 0.06, 0.5, WD.mat({ color: '#8A5A36' }), 0, 0.7, 0, chair); bx(0.6, 0.5, 0.04, WD.mat({ color: '#2A2A33' }), 0, 1.0, 0.25, chair);
    [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.22], [0.28, 0.22]].forEach(([x, z]) => bx(0.04, 0.7, 0.04, WD.mat({ color: '#8A5A36' }), x, 0.35, z, chair)); }

  const VX = -3.2, HX = 3.2;           // villain on the left, hero on the right, facing each other along x
  const VHAT = LOOK.villain.hatCol, HHAT = LOOK.hero.hatCol;
  const hatState = new Map();
  const hatOn = (p, on) => { if (hatState.get(p) === on) return; hatState.set(p, on); p.restyle({ hat: on ? 'cowboy' : 'none' }); };
  const townReset = () => { unarm(); town.forEach((p) => (p.group.visible = false)); weed.visible = false; flyHat.visible = false; crew.visible = false; hatOn(villain, true); hatOn(hero, true); };
  // poses: hand over the holster, and gun out pointing at the other man (villain points right = armR, hero points left = armL)
  const HOVER = [14, -28], AIM = [30, 60];
  const vPose = (t, tDraw, fl = 0, mood) => ({ mood: mood || (t > tDraw ? 'angry' : 'sly'), armR: t > tDraw ? tween(HOVER, AIM, t, tDraw, 0.14) : HOVER, armL: [10, 8], blink: blink(t) });
  const hPose = (t, tDraw, fl = 0, mood) => ({ mood: mood || 'deadpan', armL: t > tDraw ? tween(HOVER, AIM, t, tDraw, 0.12) : HOVER, armR: [10, 8], blink: blink(t, 0.9) });

  // ── SET 2: Bohr's institute (1930s): green walls, a chalkboard ──
  const INST = WD.interior(E, { w: 8, depth: 7, h: 4.2, wall: '#4E6B58', motif: '#5E7E68', floor: '#8A5A36', ceiling: '#2E3E34', signText: 'PHYSICS INSTITUTE', counterOn: false, litter: false });
  const chalk = (() => { const c = document.createElement('canvas'); c.width = 1024; c.height = 600; const g = c.getContext('2d');
    g.fillStyle = '#26382E'; g.fillRect(0, 0, 1024, 600); g.strokeStyle = '#8A5A36'; g.lineWidth = 28; g.strokeRect(0, 0, 1024, 600);
    g.strokeStyle = '#F2F2EA'; g.fillStyle = '#F2F2EA'; g.lineWidth = 7; g.lineCap = 'round'; g.font = '700 64px Caladea, serif';
    const stick = (x, s) => { g.beginPath(); g.arc(x, 210, 34, 0, 7); g.moveTo(x, 244); g.lineTo(x, 380); g.moveTo(x, 380); g.lineTo(x - 40, 470); g.moveTo(x, 380); g.lineTo(x + 40, 470); g.moveTo(x, 290); g.lineTo(x + s * 90, 290); g.stroke(); g.beginPath(); g.moveTo(x - 60, 176); g.lineTo(x + 60, 176); g.moveTo(x - 30, 176); g.lineTo(x - 22, 140); g.lineTo(x + 22, 140); g.lineTo(x + 30, 176); g.stroke(); };
    stick(220, 1); stick(800, -1); g.fillText('1st', 180, 110); g.fillText('2nd', 760, 110);
    g.font = '700 70px Caladea, serif'; g.fillText('think', 120, 560); g.fillText('react!', 680, 560);
    g.beginPath(); g.moveTo(380, 300); g.lineTo(640, 300); g.moveTo(600, 270); g.lineTo(640, 300); g.lineTo(600, 330); g.stroke();
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; })();
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshStandardMaterial({ map: chalk, roughness: 0.9 })); board.position.set(-1.6, 2.1, -6.85); INST.scene.add(board);
  [-2.2, 2.2].forEach((x) => { const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.9), WD.mat({ map: WD.T.planks('#6B3E26', [1, 0.5]) })); desk.position.set(x, 0.4, -4.6); desk.castShadow = desk.receiveShadow = true; INST.scene.add(desk); });
  const bohr = person('bohr'), gamow = person('gamow'); const inst = [bohr, gamow]; inst.forEach((p) => INST.scene.add(p.group));
  const instReset = () => { unarm(); inst.forEach((p) => (p.group.visible = false)); };

  // ── SET 3: the 2010 lab: pale walls, a table with two button boxes ──
  const LAB = WD.interior(E, { w: 8, depth: 7, h: 3.6, wall: '#DCE3EA', motif: '#CCD5DE', floor: '#8E99A6', ceiling: '#EEF1F4', signText: 'PSYCHOLOGY LAB', counterOn: false, litter: false, picture: false });
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.0), WD.mat({ color: '#F4F4F8', roughness: 0.4 })); table.position.set(0, 0.86, -3.2); table.castShadow = table.receiveShadow = true; LAB.scene.add(table);
  [[-0.72, -2.8], [0.72, -2.8], [-0.72, -3.6], [0.72, -3.6]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.06), WD.mat({ color: '#9AA3AE', metalness: 0.6 })); l.position.set(x, 0.43, z); LAB.scene.add(l); });
  const btnM = [], panels = [];
  [-0.42, 0.42].forEach((x, s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3), WD.mat({ color: '#2A2A33' })); p.position.set(x, 0.94, -3.2); p.castShadow = true; LAB.scene.add(p); panels.push(p);
    btnM[s] = [0, 1, 2].map((k) => { const m = new THREE.MeshStandardMaterial({ color: ['#D8343F', '#F2C230', '#3C6FB6'][k], emissive: ['#FF3A3A', '#FFD84A', '#4A8AFF'][k], emissiveIntensity: 0, roughness: 0.4 });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 18), m); b.position.set(x - 0.17 + k * 0.17, 1.0, -3.2); LAB.scene.add(b); return m; }); });
  const lightBtns = (s, n) => btnM[s].forEach((m, k) => (m.emissiveIntensity = k < n ? 1.6 : 0));
  const vol1 = person('vol1'), vol2 = person('vol2'), prof = person('prof'); const lab = [vol1, vol2, prof]; lab.forEach((p) => LAB.scene.add(p.group));
  const labReset = () => { unarm(); lab.forEach((p) => (p.group.visible = false)); lightBtns(0, 0); lightBtns(1, 0); };

  // ── 2D overlays ──
  const big = (txt, x, y, s, k, col = '#FFFFFF') => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.font = `900 ${s}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
  const bubble = (x, y, txt, k) => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.fillStyle = '#FFFDF4'; ctx.strokeStyle = INK; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(0, 0, 120, 95, 0, 0, 7); ctx.fill(); ctx.stroke(); [[-70, 120, 22], [-110, 170, 13]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill(); ctx.stroke(); });
    ctx.font = '900 120px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#D8343F'; ctx.fillText(txt, 0, 8); ctx.restore(); };
  const cross = (x, y, k) => { if (k <= 0) return; ctx.save(); ctx.strokeStyle = '#D8343F'; ctx.lineWidth = 22; ctx.lineCap = 'round'; const r = 110 * eo(clamp(k));
    ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); ctx.restore(); };
  const speed = (x, y, dir, k) => { if (k <= 0) return; ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.globalAlpha = clamp(1.5 - k);
    for (let i = 0; i < 6; i++) { const yy = y - 120 + i * 48, l = 140 + rnd(i) * 120; ctx.beginPath(); ctx.moveTo(x - dir * 40, yy); ctx.lineTo(x - dir * (40 + l * eo(clamp(k * 2))), yy); ctx.stroke(); } ctx.restore(); };
  const tally = (n, x, y) => { ctx.save(); ctx.strokeStyle = INK; ctx.fillStyle = '#FFFDF4'; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(x - 260, y - 90, 520, 180, 26); ctx.fill(); ctx.stroke();
    ctx.font = '900 54px Inter'; ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('BOHR', x - 230, y - 32); ctx.fillText('GAMOW', x - 230, y + 40);
    ctx.lineWidth = 9; ctx.strokeStyle = '#2E8A5A'; for (let i = 0; i < n; i++) { const gx = x + 20 + (i % 5) * 26 + Math.floor(i / 5) * 160; if (i % 5 === 4) { ctx.beginPath(); ctx.moveTo(gx - 112, y - 10); ctx.lineTo(gx + 6, y - 54); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(gx, y - 58); ctx.lineTo(gx, y - 6); ctx.stroke(); } }
    ctx.fillStyle = '#D8343F'; ctx.fillText('0', x + 20, y + 40); ctx.restore(); };
  const bars = (k, x, y) => { ctx.save(); ctx.fillStyle = 'rgba(255,253,244,0.96)'; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(x - 440, y - 200, 880, 400, 30); ctx.fill(); ctx.stroke();
    ctx.font = '900 48px Inter'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.fillText('FIRST TO MOVE', x - 400, y - 120); ctx.fillText('REACTING', x - 400, y + 50);
    const full = 760, a = full * eo(clamp(k / 0.5)), b = full * 0.9 * eo(clamp((k - 0.15) / 0.5));
    ctx.fillStyle = '#9AA3AE'; ctx.beginPath(); ctx.roundRect(x - 400, y - 80, a, 56, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2E8A5A'; ctx.beginPath(); ctx.roundRect(x - 400, y + 90, Math.max(1, b), 56, 14); ctx.fill(); ctx.stroke();
    if (k > 0.6) { ctx.fillStyle = '#2E8A5A'; ctx.textAlign = 'right'; ctx.font = '900 60px Inter'; ctx.fillText('−21 ms', x + 400, y + 120 - 70 + 4 * Math.sin(k * 20) * (1 - clamp((k - 0.6) * 4))); }
    ctx.restore(); };
  const watch = (x, y, ms, k) => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.strokeStyle = INK; ctx.lineWidth = 10; ctx.fillStyle = '#FFFDF4';
    ctx.beginPath(); ctx.roundRect(-26, -200, 52, 40, 10); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 160, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F2C230'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 140, -Math.PI / 2, -Math.PI / 2 + (ms / 1000) * Math.PI * 2 * 3); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); const a = -Math.PI / 2 + (ms / 1000) * Math.PI * 2 * 3; ctx.lineTo(Math.cos(a) * 130, Math.sin(a) * 130); ctx.stroke();
    ctx.font = '900 64px Inter'; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(ms)} ms`, 0, 230); ctx.restore(); };
  const sepia = (k) => { if (k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = 0.5 * k; ctx.fillStyle = '#8A6A44'; ctx.fillRect(0, 0, CW, CH); ctx.restore(); };
  const vignette = () => { const g = ctx.createRadialGradient(CW / 2, CH / 2, CH * 0.3, CW / 2, CH / 2, CH * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH); };

  // ── S01 · "In old Western movies, the cowboy who draws first always loses." — the standoff; villain draws, hero's BANG ──
  { const st = cut(0), dr = Wd('draws', 0), ls = Wd('loses', 0);
    add({ id: 'S01', at: st, shafts: 0.7, note: 'low over the villain\'s shoulder down the street at the hero; tumbleweed; villain draws on "draws first", hero draws later but his BANG flag pops first and the villain\'s hat flies off on "loses"', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d)), fl = clamp((t - (ls - 0.15)) / 0.2);
      hatOn(villain, t < ls); stand(villain, VX, 1.0, vPose(t, dr, 0, t > ls ? 'shock' : undefined)); if (t > dr + 0.05) armed(villain, 1);
      stand(hero, HX, -0.6, hPose(t, ls - 0.35, fl)); if (t > ls - 0.3) armed(hero, -1, false, fl);
      hatFly(VX, 1.0, -1, clamp((t - ls) / 0.9), VHAT); weedAt(lerp(-2, 4, k), t);
      shoot(TOWN, town, V3(VX - 3.0, 1.45, 2.2), V3(VX - 2.6, 1.42, 2.05), V3(HX, 1.3, -0.6), null, k, { ...LK, focus: 9, fov: 32 });
      blit(); vignette();
    } });
    cue(0.05, 'whoosh', { gain: 0.5 }); cue(Wd('draws', 0), 'zip', { gain: 0.6 }); cue(Wd('loses', 0) - 0.05, 'pop', { gain: 1.0 }); cue(Wd('loses', 0), 'boing', { gain: 0.5 }); }

  // ── S02 · "Physicist Niels Bohr thought he knew why." — Bohr at the chalkboard, an idea "!" ──
  { const st = cut(1), wy = Wd('why', 1);
    add({ id: 'S02', at: st, shafts: 0.9, shaftX: CW * 0.25, shaftA: -0.3, note: 'Bohr at the chalkboard (two stick cowboys: 1st / 2nd); a "!" bubble pops on "why"', draw(lt, d, t, blit) {
      instReset(); const k = drift(clamp(lt / d));
      stand(bohr, 0.3, -5.6, { mood: t > wy - 0.2 ? 'happy' : 'neutral', armL: [150, 10], look: [-0.5, -0.2], blink: blink(t) });
      shoot(INST.scene, inst, V3(0.6, 1.6, -1.2), V3(0.4, 1.6, -2.0), V3(-0.25, 1.7, -6.4), null, k);
      blit(); sepia(0.35); bubble(760, 520, '!', clamp((t - (wy - 0.2)) / 0.25)); FX.sparkle(760, 520, t, clamp((t - wy) / 0.25) * (1 - clamp((t - wy - 0.6) / 0.3)), 90);
    } });
    cue(st, 'whoosh'); cue(Wd('why', 1) - 0.2, 'ding', { gain: 0.7 }); }

  // ── S03 · "The guy who reacts doesn't have to think," — the hero, deadpan; a thought bubble gets crossed out ──
  { const st = cut(2), th = Wd('think', 2);
    add({ id: 'S03', at: st, note: 'close on the hero, deadpan; a "?" thought bubble appears and is crossed out on "think"', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d));
      stand(hero, HX, -0.2, hPose(t, 99, 0, 'deadpan'));
      shoot(TOWN, town, V3(HX - 1.2, 1.55, 2.6), V3(HX - 1.0, 1.55, 2.1), V3(HX, 1.45, -0.2), null, k);
      blit(); bubble(300, 520, '?', clamp((lt - 0.2) / 0.25)); cross(300, 520, clamp((t - th) / 0.2));
    } });
    cue(st + 0.2, 'pop', { gain: 0.5 }); cue(Wd('think', 2), 'tock', { gain: 0.8 }); }

  // ── S04 · "so his hand moves faster." — the hero's lightning draw, speed lines ──
  { const st = cut(3), hd = Wd('hand', 3);
    add({ id: 'S04', at: st, note: 'mid shot: the hero\'s hand whips the revolver up on "hand", white speed lines', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d));
      stand(hero, HX, -0.2, hPose(t, hd - 0.05, 0, t > hd ? 'smug' : 'deadpan')); if (t > hd) armed(hero, -1);
      shoot(TOWN, town, V3(HX - 0.4, 1.2, 3.4), V3(HX - 0.6, 1.2, 2.9), V3(HX - 0.4, 1.2, -0.2), null, k);
      blit(); speed(380, 860, -1, clamp((t - hd) / 0.5));
    } });
    cue(Wd('hand', 3) - 0.05, 'zip', { gain: 0.9 }); cue(Wd('faster', 3), 'whoosh', { gain: 0.6 }); }

  // ── S05 · "The story goes, he tested it with toy pistols against his friend George Gamow," — the office duel ──
  { const st = cut(4), tp = Wd('toy', 4), gm = Wd('George', 4);
    add({ id: 'S05', at: st, shafts: 0.8, shaftX: CW * 0.25, shaftA: -0.3, note: 'in the institute: Bohr and Gamow face off between the desks; on "toy pistols" both hold bright toy guns; push in on Gamow at his name', draw(lt, d, t, blit) {
      instReset(); const k = drift(clamp(lt / d));
      const armd = t > tp;
      stand(bohr, -0.75, -3.2, { mood: 'sly', armR: armd ? [20, -20] : HOVER, blink: blink(t) }); if (armd) armed(bohr, 1, true);
      stand(gamow, 0.8, -3.6, { mood: t > gm ? 'smug' : 'neutral', armL: armd ? [20, -20] : HOVER, blink: blink(t, 0.8) }); if (armd) armed(gamow, -1, true);
      shoot(INST.scene, inst, V3(0.0, 1.5, 1.8), V3(0.15, 1.45, 0.5), V3(0, 1.2, -3.4), V3(0.15, 1.25, -3.5), k);
      blit(); sepia(0.35);
    } });
    cue(st, 'whoosh'); cue(Wd('toy', 4), 'boing', { gain: 0.5 }); }

  // ── S06 · "and Bohr won every single duel." — Gamow draws, Bohr's flag pops first; a tally of wins ──
  { const st = cut(5), gd = st + 0.25, bf = st + 0.7;
    add({ id: 'S06', at: st, shafts: 0.8, shaftX: CW * 0.25, shaftA: -0.3, note: 'Gamow raises first, Bohr reacts and his BANG flag pops first; Gamow sulks; tally counts Bohr\'s wins', draw(lt, d, t, blit) {
      instReset(); const k = drift(clamp(lt / d)), fl = clamp((t - bf) / 0.2);
      stand(bohr, -0.75, -3.2, { mood: t > bf ? 'smug' : 'sly', armR: tween([20, -20], AIM, t, bf - 0.2, 0.12), blink: blink(t) }); armed(bohr, 1, true, fl);
      stand(gamow, 0.8, -3.6, { mood: t > bf + 0.1 ? 'tired' : 'angry', armL: tween([20, -20], AIM, t, gd, 0.3), blink: blink(t, 0.8) }); armed(gamow, -1, true);
      shoot(INST.scene, inst, V3(0.1, 1.5, 1.6), V3(0.0, 1.45, 1.1), V3(0.0, 1.3, -3.4), null, k);
      blit(); sepia(0.35); { const [hx, hy] = headXY(gamow); FX.sweat(hx + 70, hy - 40, clamp((t - bf - 0.1) / 0.3)); } tally(Math.min(12, Math.floor(clamp((lt - 0.5) / (d - 0.7)) * 12)), 540, 380);
    } });
    cue(st + 0.7, 'pop', { gain: 1.0 }); for (let i = 0; i < 6; i++) cue(st + 0.75 + i * 0.2, 'tock', { gain: 0.5 }); }

  // ── S07 · "Then in 2010, scientists in Birmingham ran lab gunfights," — the modern lab, "2010" ──
  { const st = cut(6), gf = Wd('gunfights', 6);
    add({ id: 'S07', at: st, lab: true, note: 'bright modern lab: two volunteers face each other across a table with button boxes, the scientist with a clipboard; big "2010"', draw(lt, d, t, blit) {
      labReset(); const k = drift(clamp(lt / d));
      stand(vol1, -1.05, -3.2, { mood: 'angry', armR: [60, -30], look: [0.6, 0.2], blink: blink(t) }); stand(vol2, 1.05, -3.2, { mood: 'sly', armL: [60, -30], look: [-0.6, 0.2], blink: blink(t, 1) });
      stand(prof, 1.6, -5.2, { mood: 'neutral', armR: [40, -60], holdR: clip, blink: blink(t, 0.4) });
      shoot(LAB.scene, lab, V3(-0.2, 1.9, 3.0), V3(0.0, 1.75, 1.8), V3(0.2, 1.2, -3.4), null, k, { ...LK, fov: 50 });
      blit(); big('2010', 540, 520, 200, clamp((lt - 0.15) / 0.3), '#F2C230'); if (t > gf) big('LAB GUNFIGHT', 540, 700, 80, clamp((t - gf) / 0.25));
    } });
    cue(st, 'whoosh', { gain: 0.9 }); cue(st + 0.2, 'pop', { gain: 0.6 }); cue(Wd('gunfights', 6), 'ding', { gain: 0.6 }); }

  // ── S08 · "with buttons instead of guns." — close on the button boxes lighting up in a race ──
  { const st = cut(7);
    add({ id: 'S08', at: st, lab: true, note: 'close over the table: two button boxes, the buttons light up one after another as both race', draw(lt, d, t, blit) {
      labReset(); const k = drift(clamp(lt / d));
      lightBtns(0, Math.floor(clamp((lt - 0.2) / 0.8) * 3.99)); lightBtns(1, Math.floor(clamp((lt - 0.3) / 0.75) * 3.99));
      stand(vol1, -1.05, -3.2, { mood: 'strain', armR: [50, -10], blink: blink(t) }); stand(vol2, 1.05, -3.2, { mood: 'strain', armL: [50, -10], blink: blink(t, 1) });
      shoot(LAB.scene, lab, V3(0.0, 1.95, -0.6), V3(0.05, 1.85, -0.9), V3(0, 0.95, -3.2), null, k, { ...LK, fov: 50 });
      blit();
    } });
    [0.25, 0.5, 0.75, 0.95].forEach((dt, i) => cue(cut(7) + dt, 'tock', { gain: 0.6 + (i % 2) * 0.2 })); }

  // ── S09 · "And Bohr was right!" — Bohr proud at the board, a big green tick ──
  { const st = cut(8);
    add({ id: 'S09', at: st, shafts: 0.9, shaftX: CW * 0.25, shaftA: -0.3, note: 'Bohr beams at the chalkboard, a big green tick', draw(lt, d, t, blit) {
      instReset(); const k = drift(clamp(lt / d));
      stand(bohr, 0.5, -5.6, { mood: 'proud', armR: [150, 10], blink: blink(t) });
      shoot(INST.scene, inst, V3(0.6, 1.6, -2.4), V3(0.6, 1.6, -2.9), V3(0.2, 1.6, -5.6), null, k);
      blit(); sepia(0.35);
      const kk = clamp((lt - 0.15) / 0.3); if (kk > 0) { ctx.save(); ctx.strokeStyle = '#2E8A5A'; ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(680, 520); ctx.lineTo(680 + 60 * Math.min(1, kk * 2), 520 + 70 * Math.min(1, kk * 2)); if (kk > 0.5) ctx.lineTo(740 + 160 * (kk - 0.5) * 2, 590 - 200 * (kk - 0.5) * 2); ctx.stroke(); ctx.restore(); }
    } });
    cue(st + 0.15, 'sparkle', { gain: 0.6 }); }

  // ── S10 · "Reacting really is faster, by twenty-one milliseconds." — the bar chart over the lab ──
  { const st = cut(9);
    add({ id: 'S10', at: st, lab: true, note: 'over a soft-focus lab: two bars, FIRST TO MOVE vs REACTING; the reacting bar is shorter, "−21 ms"', draw(lt, d, t, blit) {
      labReset(); const k = drift(clamp(lt / d)); lightBtns(0, 3); lightBtns(1, 3);
      stand(vol1, -1.05, -3.2, { mood: 'tired', blink: blink(t) }); stand(vol2, 1.05, -3.2, { mood: 'happy', armL: [150, 10], blink: blink(t, 1) });
      shoot(LAB.scene, lab, V3(0, 1.6, 2.4), V3(0, 1.6, 1.8), V3(0, 1.3, -3.3), null, k, { ...LK, fov: 50, aperture: 0.004, maxblur: 0.012, focus: 1.0 });
      blit(); bars(clamp(lt / d * 1.4), 540, 760);
    } });
    cue(st, 'whoosh'); cue(st + 1.6, 'ding', { gain: 0.6 }); }

  // ── S11 · "But here's the catch." — back on the street: a slow, dramatic push-in on the hero ──
  { const st = cut(10);
    add({ id: 'S11', at: st, shafts: 0.8, note: 'street, dramatic push-in on the hero\'s squinting deadpan; tumbleweed crosses', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d));
      stand(hero, HX, -0.2, hPose(t, 99, 0, 'sly')); weedAt(lerp(-1, 6, k), t + 3);
      shoot(TOWN, town, V3(HX - 1.6, 1.5, 4.2), V3(HX - 0.8, 1.6, 1.8), V3(HX, 1.6, -0.2), null, k);
      blit(); vignette();
    } });
    cue(st, 'slide', { gain: 0.6 }); }

  // ── S12 · "Just noticing the other guy move takes about two hundred." — slow-mo draw, a stopwatch to 200 ms ──
  { const st = cut(11), mv = Wd('move', 11);
    add({ id: 'S12', at: st, note: 'wide over the hero\'s shoulder: the villain draws in slow motion while the hero is still frozen in shock; a stopwatch runs to 200 ms', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d)), sl = clamp((t - (mv - 0.2)) / 1.2);
      stand(villain, VX, 0.4, { mood: 'angry', armR: [lerp(HOVER[0], AIM[0], eio(sl)), lerp(HOVER[1], AIM[1], eio(sl))], blink: 0 }); if (sl > 0.1) armed(villain, 1);
      stand(hero, HX, -1.0, hPose(t, 99, 0, t > mv ? 'shock' : 'sly'));
      shoot(TOWN, town, V3(HX + 3.0, 1.45, -2.2), V3(HX + 2.6, 1.42, -2.05), V3(VX, 1.3, 0.4), null, k, { ...LK, focus: 9, fov: 32 });
      blit(); vignette(); { const [hx, hy] = headXY(hero, 1.3); FX.sweat(hx - 120, hy, clamp((t - mv - 0.1) / 0.3)); } watch(540, 500, 200 * clamp((lt - 0.2) / (d - 0.5)), clamp((lt - 0.1) / 0.25));
    } });
    cue(st + 0.1, 'pop', { gain: 0.5 }); cue(st + 0.3, 'heartbeat', { gain: 0.6 }); }

  // ── S13 · "So the one who draws second still almost always loses." — villain's flag first, hero's hat flies ──
  { const st = cut(12), sc = Wd('second', 12), ls = Wd('loses', 12);
    add({ id: 'S13', at: st, note: 'same standoff, now the villain draws first and his BANG flag pops; the hero reacts on "second" but too late; the hero\'s hat flies on "loses", dizzy', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d)), fl = clamp((t - (ls - 0.2)) / 0.2);
      stand(villain, -1.6, -0.2, vPose(t, st + 0.15, fl, t > ls ? 'laugh' : 'angry')); if (t > st + 0.2) armed(villain, 1, false, fl);
      hatOn(hero, t < ls); stand(hero, 1.6, 0.3, hPose(t, sc, 0, t > ls ? 'dizzy' : 'strain')); if (t > sc + 0.05) armed(hero, -1);
      hatFly(1.6, 0.3, 1, clamp((t - ls) / 0.9), HHAT);
      shoot(TOWN, town, V3(0, 1.7, 7.6), V3(0, 1.68, 6.9), V3(0, 1.3, 0), null, k, { ...LK, fov: 50, aperture: 0 });
      blit(); vignette();
    } });
    cue(cut(12) + 0.15, 'zip', { gain: 0.6 }); cue(Wd('second', 12), 'zip', { gain: 0.4 }); cue(Wd('loses', 12) - 0.05, 'pop', { gain: 1.0 }); cue(Wd('loses', 12), 'boing', { gain: 0.6 }); }

  // ── S14 · "The scientists' verdict on Bohr?" — the scientist checks the clipboard ──
  { const st = cut(13);
    add({ id: 'S14', at: st, lab: true, note: 'the scientist in the lab lowers his clipboard, eyebrow raised', draw(lt, d, t, blit) {
      labReset(); const k = drift(clamp(lt / d));
      stand(prof, 0.3, -3.8, { mood: 'sly', armR: [60, -60], holdR: clip, look: [-0.3, 0], blink: blink(t) });
      shoot(LAB.scene, lab, V3(0.9, 1.6, -1.2), V3(0.7, 1.6, -1.7), V3(0.3, 1.55, -3.8), null, k);
      blit();
    } });
    cue(st, 'whoosh'); }

  // ── S15 · "He was probably just a really good shot." — Bohr twirls his toy pistol, Gamow sulks ──
  { const st = cut(14);
    add({ id: 'S15', at: st, shafts: 0.9, shaftX: CW * 0.25, shaftA: -0.3, note: 'Bohr blows on his toy pistol and grins, smug; Gamow behind with folded arms, tired', draw(lt, d, t, blit) {
      instReset(); const k = drift(clamp(lt / d));
      stand(bohr, -0.2, -3.2, { mood: 'smug', armR: [150, -150 + Math.sin(t * 9) * 8], blink: blink(t) }); armed(bohr, 1, true);
      stand(gamow, 0.9, -4.8, { mood: 'tired', armL: [40, -110], armR: [40, -110], blink: blink(t, 0.8) });
      shoot(INST.scene, inst, V3(0.2, 1.55, 0.4), V3(0.0, 1.5, -0.2), V3(0.3, 1.45, -3.6), null, k);
      blit(); sepia(0.35);
    } });
    cue(st + 0.3, 'sparkle', { gain: 0.5 }); }

  // ── S16 · "So next time a movie cowboy waits to draw second," — the standoff again (the opening frame) ──
  { const st = cut(15);
    add({ id: 'S16', at: st, shafts: 0.7, note: 'back to the opening standoff composition; the hero squints, waiting', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d));
      stand(villain, VX, 1.0, vPose(t, 99)); stand(hero, HX, -0.6, hPose(t, 99, 0, 'sly')); weedAt(lerp(-3, 3, k), t);
      shoot(TOWN, town, V3(VX - 3.0, 1.45, 2.2), V3(VX - 2.6, 1.42, 2.05), V3(HX, 1.3, -0.6), null, k, { ...LK, focus: 9, fov: 32 });
      blit(); vignette();
    } });
    cue(st, 'whoosh', { gain: 0.6 }); }

  // ── S17 · "he's not faster. He's just in a movie." — pull back: a film camera, a lamp, the director with a megaphone ──
  { const st = cut(16), mv = Wd('movie', 16);
    add({ id: 'S17', at: st, note: 'big pull-back from the standoff reveals the film crew: camera on tripod, studio lamp, director with megaphone; on "movie" the director waves', draw(lt, d, t, blit) {
      townReset(); const k = drift(clamp(lt / d));
      stand(villain, VX, 0.2, vPose(t, 99, 0, 'deadpan')); stand(hero, HX, -0.2, hPose(t, 99, 0, 'deadpan'));
      crew.visible = true; crew.position.set(0, 0, 9);
      stand(director, 1.2, 9.6, { mood: t > mv ? 'laugh' : 'neutral', armR: t > mv ? tween([40, -40], [150, 10], t, mv, 0.2) : [40, -40], holdR: megaphone, legs: 'sit', blink: blink(t) }, 0.42);
      shoot(TOWN, town, V3(0, 1.4, 5), V3(0.3, 2.6, 17), V3(0, 1.2, 0), V3(0.4, 1.3, 5), k, { ...LK, fov: lerp(46, 50, k), aperture: 0 });
      blit();
    } });
    cue(st, 'whoosh', { gain: 0.9 }); cue(Wd('movie', 16), 'ding', { gain: 0.7 }); }

  return { shots: S, cues: CUES };
}
