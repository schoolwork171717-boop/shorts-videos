// emuwar.js (kit v8): props and a bright parliament room for funny-history stories.
//   waterHole() · ammoCrate(label) · hayBale() · newspaper(headline) · report(lines) · medal() · puff() (smoke puff sprite)
//   parliament(E) -> { scene, sun, benches: [[x,z]...] (seat spots), podium: [x,z] }
import * as THREE from 'three';
import { mat, canvasTex, sunlight, signBoard } from './world.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 18) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const INK = '#1F1C33';

export function waterHole(rx = 3.2, rz = 2.0) {
  const g = new THREE.Group();
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat({ color: '#B88A5A', roughness: 1 })); mud.scale.set(rx + 0.7, rz + 0.6, 1); mud.rotation.x = -Math.PI / 2; mud.position.y = 0.015; mud.receiveShadow = true; g.add(mud);
  const wT = canvasTex('pond', 256, 256, (c, W, H) => { const gr = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2); gr.addColorStop(0, '#3E9EDC'); gr.addColorStop(1, '#7CCBEA'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; for (let k = 0; k < 9; k++) { c.beginPath(); c.ellipse(W * (0.2 + rnd(k) * 0.6), H * (0.2 + rnd(k * 3) * 0.6), 18 + rnd(k * 5) * 20, 4, 0, 0, 7); c.stroke(); } });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat({ map: wT, roughness: 0.15, metalness: 0.1, emissive: '#3C8CC8', emissiveIntensity: 0.18 }));
  water.scale.set(rx, rz, 1); water.rotation.x = -Math.PI / 2; water.position.y = 0.03; g.add(water);
  const reed = mat({ color: '#6E9E4E', roughness: 0.9 });
  for (let i = 0; i < 26; i++) { const a = rnd(i) * Math.PI * 2, r = 1.02 + rnd(i * 3) * 0.12; const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6 + rnd(i * 5) * 0.5, 4), reed); c.position.set(Math.cos(a) * rx * r, 0.3, Math.sin(a) * rz * r); c.rotation.z = (rnd(i * 7) - 0.5) * 0.4; c.castShadow = true; g.add(c); }
  const rock = mat({ color: '#B8A890', roughness: 1, flatShading: true });
  for (let i = 0; i < 6; i++) { const a = rnd(i * 11) * Math.PI * 2; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + rnd(i) * 0.2, 0), rock); r.position.set(Math.cos(a) * (rx + 0.4), 0.1, Math.sin(a) * (rz + 0.35)); r.castShadow = true; g.add(r); }
  return g;
}

export function ammoCrate(label = 'BULLETS', s = 0.62) {
  const t = canvasTex('crate' + label, 256, 160, (c, W, H) => { c.fillStyle = '#7C8A4A'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(40,50,20,0.35)'; for (let y = 0; y < H; y += 32) c.fillRect(0, y, W, 3);
    c.strokeStyle = '#3E4628'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10); c.fillStyle = '#F4EBD0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 44px Inter, sans-serif'; c.fillText(label, W / 2, H / 2 + 2); });
  const side = mat({ color: '#6E7C40', roughness: 0.8 }), face = mat({ map: t, roughness: 0.8 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s, s), [side, side, side, side, face, face]); m.position.y = s / 2; m.castShadow = m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}

export function hayBale() {
  const t = canvasTex('hay', 256, 128, (c, W, H) => { c.fillStyle = '#E8C060'; c.fillRect(0, 0, W, H); for (let k = 0; k < 700; k++) { c.strokeStyle = rnd(k) > 0.5 ? 'rgba(255,240,170,0.7)' : 'rgba(160,110,30,0.5)'; c.lineWidth = 2; const x = rnd(k * 3) * W, y = rnd(k * 7) * H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 14, y + (rnd(k) - 0.5) * 6); c.stroke(); } }, [2, 1]);
  const g = new THREE.Group(); const b = cyl(0.75, 0.75, 1.3, mat({ map: t, roughness: 1 }), 0, 0.75, 0, g, 22); b.rotation.x = Math.PI / 2;
  return g;
}

function paperTex(key, draw) { return canvasTex(key, 400, 520, (c, W, H) => { c.fillStyle = '#FBF5E4'; c.fillRect(0, 0, W, H); c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10); draw(c, W, H); }); }

/** a newspaper held up like a sign (plane ~0.8 x 1.05 m). */
export function newspaper(headline = ['BIRDS', 'BEAT', 'ARMY']) {
  const t = paperTex('news' + headline.join(), (c, W, H) => { c.fillStyle = INK; c.textAlign = 'center'; c.font = '900 30px Inter, sans-serif'; c.fillText('THE DAILY NEWS', W / 2, 50); c.fillRect(24, 64, W - 48, 5);
    c.font = '900 84px Inter, sans-serif'; headline.forEach((l, i) => c.fillText(l, W / 2, 160 + i * 86));
    c.fillStyle = 'rgba(31,28,51,0.45)'; for (let k = 0; k < 7; k++) c.fillRect(30, 420 + k * 12, W - 60 - (k % 3) * 30, 5); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.04), mat({ map: t, roughness: 0.9, side: THREE.DoubleSide })); m.castShadow = true; return m;
}

/** a clipboard report (plane ~0.6 x 0.8 m). lines: [[text, colour], ...] */
export function report(lines = [['OFFICIAL REPORT', INK], ['CASUALTIES:', INK], ['NONE', '#2E8A4A']]) {
  const t = canvasTex('report' + lines.map((l) => l[0]).join(), 400, 520, (c, W, H) => { c.fillStyle = '#9A6A3E'; c.fillRect(0, 0, W, H); c.fillStyle = '#FBF5E4'; c.fillRect(26, 50, W - 52, H - 76); c.strokeStyle = INK; c.lineWidth = 8; c.strokeRect(26, 50, W - 52, H - 76);
    c.fillStyle = '#C8C8D0'; c.fillRect(W / 2 - 70, 20, 140, 50); c.strokeRect(W / 2 - 70, 20, 140, 50);
    c.textAlign = 'center'; lines.forEach(([l, col], i) => { c.fillStyle = col; c.font = `900 ${i === lines.length - 1 ? 92 : 40}px Inter, sans-serif`; c.fillText(l, W / 2, 140 + i * (i === lines.length - 1 ? 120 : 70) + (i === lines.length - 1 ? 60 : 0)); }); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.78), mat({ map: t, roughness: 0.8, side: THREE.DoubleSide })); m.castShadow = true; return m;
}

export function medal() {
  const g = new THREE.Group();
  const cush = box(0.7, 0.12, 0.5, mat({ color: '#B8343F', roughness: 0.7 }), 0, 0.06, 0, g);
  const rib = box(0.12, 0.02, 0.32, mat({ color: '#3C6FB6' }), 0, 0.13, -0.05, g);
  const coin = cyl(0.13, 0.13, 0.03, mat({ color: '#F2C230', metalness: 0.7, roughness: 0.25, emissive: '#8A6A10', emissiveIntensity: 0.3 }), 0, 0.14, 0.12, g, 24);
  g.coin = coin; return g;
}

/** a cartoon smoke puff (sprite). set .k 0..1 to grow and fade. */
export function puff(col = '#E8E4EC') {
  const t = canvasTex('puff' + col, 256, 256, (c, W, H) => { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 8;
    const blobs = [[128, 140, 70], [80, 120, 50], [176, 118, 54], [110, 80, 46], [160, 76, 40]]; blobs.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); }); blobs.forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r - 4, 0, 7); c.fill(); }); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(0.01, 0.01, 1);
  s.setK = (k, size = 1.2) => { const e = Math.min(1, k * 1.6); s.scale.set(e * size, e * size, 1); s.material.opacity = k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4); s.visible = k > 0 && k < 1; };
  s.visible = false; return s;
}

/** a bright, warm parliament chamber: green benches facing a central table, cream walls, tall windows, a sign. */
export function parliament(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#F4E6C8');
  scene.environment = E.envMap; scene.environmentIntensity = 0.5;
  const sun = sunlight(scene, E, { col: '#FFF0D8', i: 2.4, pos: [-5, 9, 6], target: [0, 0.5, -1], box: 12, sky: '#FFF6E4', ground: '#9AB870', hemi: 2.0 });
  const carpet = mat({ color: '#5E9E5A', roughness: 1 }), wall = mat({ color: '#F2DFB8', roughness: 0.9 }), wood = mat({ color: '#9A6A3E', roughness: 0.7 }), leather = mat({ color: '#3E8A5A', roughness: 0.6 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), carpet); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  box(30, 9, 0.3, wall, 0, 4.5, -7, scene); box(0.3, 9, 30, wall, -8, 4.5, 0, scene); box(0.3, 9, 30, wall, 8, 4.5, 0, scene);
  const winM = mat({ color: '#CFE8FF', emissive: '#CFE8FF', emissiveIntensity: 0.7 });
  [-4.5, -1.5, 1.5, 4.5].forEach((x) => { box(1.4, 3.6, 0.1, winM, x, 4.4, -6.82, scene); box(1.6, 0.16, 0.2, wood, x, 2.55, -6.78, scene); box(1.6, 0.16, 0.2, wood, x, 6.25, -6.78, scene); });
  box(30, 1.0, 0.36, wood, 0, 0.5, -6.8, scene);                                         // wood panelling
  const benches = [];
  [-1, 1].forEach((side) => { for (let r = 0; r < 3; r++) { const x = side * (2.4 + r * 1.3), y = r * 0.35;
    box(0.9, 0.3 + y, 7, wood, x, (0.3 + y) / 2, -1.5, scene); box(0.8, 0.22, 6.8, leather, x, 0.42 + y, -1.5, scene); box(0.2, 0.7, 6.8, leather, x + side * 0.42, 0.85 + y, -1.5, scene);
    for (let k = 0; k < 4; k++) benches.push([x, -4.2 + k * 1.6, 0.53 + y, side]); } });
  box(1.6, 0.85, 3.2, wood, 0, 0.42, -1.6, scene); box(1.7, 0.06, 3.3, mat({ color: '#2E5A3E' }), 0, 0.87, -1.6, scene);   // the table
  const sign = signBoard('PARLIAMENT', { w: 1.5, h: 0.42, bg: '#2E5A3E', fg: '#F2D37A', font: 'Inter' }); sign.position.set(0, 3.7, -6.75); scene.add(sign);
  const chair = new THREE.Group(); chair.position.set(0, 0, -5.4); scene.add(chair); box(1.4, 0.6, 1.0, wood, 0, 0.3, 0, chair); box(1.4, 2.4, 0.2, wood, 0, 1.4, -0.45, chair); box(1.1, 0.2, 0.8, leather, 0, 0.68, 0, chair);
  return { scene, sun, benches, podium: [0, -0.4] };
}
