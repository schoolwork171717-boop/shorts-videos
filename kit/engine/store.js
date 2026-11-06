// store.js (kit v8): a bright corner store with a lottery counter, a bright office, and story props.
//   cornerStore(E) -> { scene, sun, terminal: { group, screen, setScreen(lines, col) }, checker (self-check scanner group),
//                       counter: { z, top }, update(t) }   counter along x at z -1.0 (top y 1.0); clerk stands at z -1.7,
//                       customers at z ~0.1; door + window on the left wall (x -4), shelves on the right (x 2..4)
//   office(E, { sign }) -> { scene, sun, desk: [x, z] }       a bright corporate office with a big desk and a sign
//   chalkboard(lines) · bigCheck(amount, to) · billStack(label, n) · coin() · screenTex helpers
import * as THREE from 'three';
import { mat, canvasTex, sunlight, signBoard } from './world.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 18) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const INK = '#1F1C33';

/** a live canvas for little screens: returns { tex, draw(lines, bg) } */
function liveScreen(w = 256, h = 160) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; let key = '';
  const draw = (lines = [['READY', '#FFFFFF']], bg = '#1E3A5E') => { const k = JSON.stringify([lines, bg]); if (k === key) return; key = k;
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, col, size], i) => { let fs = size || 40; g.font = `900 ${fs}px Inter, sans-serif`; while (g.measureText(t).width > w - 24 && fs > 14) { fs -= 2; g.font = `900 ${fs}px Inter, sans-serif`; } g.fillStyle = col || '#FFFFFF'; g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h / (lines.length + 0.6))); });
    tex.needsUpdate = true; };
  draw(); return { tex, draw };
}

export function cornerStore(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#F6EBD2');
  scene.environment = E.envMap; scene.environmentIntensity = 0.55;
  const sun = sunlight(scene, E, { col: '#FFF4E0', i: 2.3, pos: [-6, 8, 6], target: [0, 0.8, -1], box: 12, sky: '#FFF8EC', ground: '#E8C8A0', hemi: 2.1 });
  // checkerboard floor, mint walls, a sunny window and the front door
  const fT = canvasTex('storefloor', 256, 256, (c, W, H) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#F4EEE2' : '#E4A26A'; c.fillRect(x * 32, y * 32, 32, 32); } }, [6, 6]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat({ map: fT, roughness: 0.6 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const wall = mat({ color: '#BFE6D4', roughness: 0.9 }), trim = mat({ color: '#F4EBD6' }), wood = mat({ color: '#B07A48', roughness: 0.7 }), red = mat({ color: '#D8443C', roughness: 0.5 });
  box(14, 4.2, 0.2, wall, 0, 2.1, -3.4, scene); box(0.2, 4.2, 14, wall, -4.2, 2.1, 0, scene); box(0.2, 4.2, 14, wall, 4.4, 2.1, 0, scene);
  box(14, 0.35, 0.24, trim, 0, 0.17, -3.28, scene);
  const winM = mat({ color: '#D8F0FF', emissive: '#D8F0FF', emissiveIntensity: 0.85 });
  box(0.06, 1.8, 2.6, winM, -4.08, 2.0, 0.8, scene); box(0.1, 0.12, 2.8, trim, -4.05, 2.95, 0.8, scene); box(0.1, 0.12, 2.8, trim, -4.05, 1.05, 0.8, scene);
  box(0.08, 2.4, 1.2, mat({ color: '#3C6FB6' }), -4.08, 1.2, 3.0, scene);                                                     // door
  // the counter (front panel in red with a cream top), a ticket rack and candy behind it
  box(3.4, 0.98, 0.7, red, 0.2, 0.49, -1.0, scene); box(3.6, 0.06, 0.85, mat({ color: '#F4EBD6', roughness: 0.4 }), 0.2, 1.0, -1.0, scene);
  const rackT = canvasTex('tixrack', 512, 256, (c, W, H) => { c.fillStyle = '#2E4E7A'; c.fillRect(0, 0, W, H); const cols = ['#F2C230', '#E8734A', '#7FBF7A', '#D8343F', '#8FC8F0', '#C88AE0'];
    for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) { c.fillStyle = cols[(r * 3 + k) % cols.length]; c.fillRect(14 + k * 62, 14 + r * 80, 52, 66); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(14 + k * 62, 14 + r * 80, 52, 66); c.fillStyle = INK; c.font = '900 14px Inter'; c.textAlign = 'center'; c.fillText('$$', 40 + k * 62, 52 + r * 80); } });
  box(3.0, 1.5, 0.08, mat({ map: rackT, roughness: 0.6 }), 0.2, 2.2, -3.25, scene);
  const sign = signBoard('LOTTO', { w: 1.6, h: 0.5, bg: '#F2C230', fg: '#B5372E', font: 'Inter' }); sign.position.set(0.2, 3.3, -3.22); scene.add(sign);
  const boxCols = ['#E8734A', '#7FBF7A', '#F2C230', '#8FC8F0', '#D8343F', '#C88AE0', '#F4EFE4'];
  for (let side = 0; side < 2; side++) for (let lvl = 0; lvl < 4; lvl++) {                                                      // shelves along the right wall
    const sx = 3.9, z0 = -2.6 + side * 3.2; box(0.7, 0.05, 2.8, trim, sx, 0.3 + lvl * 0.55, z0 + 1.2, scene);
    for (let k = 0; k < 9; k++) { const h = 0.2 + rnd(side * 40 + lvl * 9 + k) * 0.22; box(0.42, h, 0.24, mat({ color: boxCols[(k + lvl + side) % boxCols.length], roughness: 0.6 }), sx - 0.05, 0.33 + lvl * 0.55 + h / 2, z0 + k * 0.3, scene); } }
  for (let k = 0; k < 2; k++) { box(1.1, 2.3, 0.7, mat({ color: '#E8F4FA', emissive: '#CFEFFF', emissiveIntensity: 0.25 }), -2.6 + k * 1.2, 1.15, -3.0, scene); }   // drinks fridges
  [-1.5, 1.5].forEach((x) => { const l = box(1.6, 0.08, 0.3, mat({ color: '#FFFBEA', emissive: '#FFF6D8', emissiveIntensity: 1.0 }), x, 4.05, 0, scene); l.castShadow = false; });
  // the lottery terminal on the counter: a little screen that faces the clerk (rotate .screenPivot to turn it)
  const terminal = new THREE.Group(); terminal.position.set(1.4, 1.03, -1.05); scene.add(terminal);
  box(0.5, 0.12, 0.4, mat({ color: '#2A2830' }), 0, 0.06, 0, terminal);
  const pivot = new THREE.Group(); pivot.position.y = 0.12; terminal.add(pivot); pivot.rotation.y = Math.PI;               // screen faces -z (the clerk)
  box(0.5, 0.36, 0.06, mat({ color: '#2A2830' }), 0, 0.22, 0, pivot);
  const scr = liveScreen(); const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.3), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); sm.position.set(0, 0.22, 0.034); pivot.add(sm);
  // a self-check scanner for the ending (hidden until shown): faces the customer (+z)
  const checker = new THREE.Group(); checker.position.set(-0.9, 1.03, -0.85); checker.visible = false; scene.add(checker);
  box(0.36, 0.5, 0.26, mat({ color: '#3C6FB6' }), 0, 0.25, 0, checker);
  const cs = liveScreen(); const cm = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ map: cs.tex, toneMapped: false })); cm.position.set(0, 0.34, 0.132); checker.add(cm);
  box(0.3, 0.05, 0.12, mat({ color: '#F2C230', emissive: '#F2C230', emissiveIntensity: 0.4 }), 0, 0.12, 0.16, checker);
  cs.draw([['SCAN', '#FFFFFF', 44], ['YOUR TICKET', '#F2C230', 26]], '#1E3A5E');
  return { scene, sun, terminal: { group: terminal, pivot, setScreen: scr.draw }, checker: { group: checker, setScreen: cs.draw }, counter: { z: -1.0, top: 1.03 } };
}

export function office(E, { sign = 'LOTTERY CORP.', wall: wallCol = '#F4E2C0' } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#F4E2C0');
  scene.environment = E.envMap; scene.environmentIntensity = 0.55;
  const sun = sunlight(scene, E, { col: '#FFF2DC', i: 2.4, pos: [-5, 8, 7], target: [0, 0.8, -1], box: 12, sky: '#FFF6E8', ground: '#C8A070', hemi: 2.0 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat({ color: '#3E7AA8', roughness: 1 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const wall = mat({ color: wallCol, roughness: 0.9 }), wood = mat({ color: '#8A5A36', roughness: 0.6 }), trim = mat({ color: '#FFF6E4' });
  box(16, 4.4, 0.2, wall, 0, 2.2, -3.6, scene); box(0.2, 4.4, 16, wall, -5, 2.2, 0, scene); box(0.2, 4.4, 16, wall, 5, 2.2, 0, scene);
  const winM = mat({ color: '#CFE8FF', emissive: '#CFE8FF', emissiveIntensity: 0.8 });
  [-3.2, 3.2].forEach((x) => { box(1.6, 2.2, 0.08, winM, x, 2.2, -3.48, scene); box(1.8, 0.12, 0.14, trim, x, 1.05, -3.45, scene); box(1.8, 0.12, 0.14, trim, x, 3.35, -3.45, scene); });
  const s = signBoard(sign, { w: 2.6, h: 0.6, bg: '#2E5A3E', fg: '#F2D37A', font: 'Inter' }); s.position.set(0, 3.1, -3.45); scene.add(s);
  box(2.6, 0.1, 1.1, wood, 0, 0.92, -1.6, scene); box(2.4, 0.86, 0.9, mat({ color: '#6E4428', roughness: 0.6 }), 0, 0.43, -1.6, scene);      // desk
  const plant = new THREE.Group(); plant.position.set(-3.6, 0, -2.6); scene.add(plant); cyl(0.3, 0.24, 0.6, mat({ color: '#D8734A' }), 0, 0.3, 0, plant);
  for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat({ color: '#5E9E4E', flatShading: true })); l.position.set((rnd(k) - 0.5) * 0.5, 0.9 + rnd(k * 3) * 0.6, (rnd(k * 5) - 0.5) * 0.5); l.castShadow = true; plant.add(l); }
  const cooler = new THREE.Group(); cooler.position.set(3.7, 0, -2.6); scene.add(cooler); box(0.45, 1.0, 0.45, trim, 0, 0.5, 0, cooler); cyl(0.2, 0.2, 0.5, mat({ color: '#8FC8F0', transparent: true, opacity: 0.8 }), 0, 1.25, 0, cooler);
  return { scene, sun, desk: [0, -1.6] };
}

export function chalkboard(lines = [['WINS', '#FFFFFF']], w = 2.2, h = 1.4) {
  const t = canvasTex('chalk' + JSON.stringify(lines), 512, 320, (c, W, H) => { c.fillStyle = '#2E5A46'; c.fillRect(0, 0, W, H); c.strokeStyle = '#9A6A3E'; c.lineWidth = 22; c.strokeRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach(([l, col, size], i) => { c.fillStyle = col || '#F4F4F0'; c.font = `900 ${size || 52}px Inter, sans-serif`; c.fillText(l, W / 2, 70 + i * ((H - 100) / Math.max(1, lines.length - 1 || 1))); });
    c.globalAlpha = 0.12; c.fillStyle = '#FFFFFF'; for (let k = 0; k < 40; k++) c.fillRect(rnd(k) * W, rnd(k * 3) * H, 30, 2); });
  const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [mat({ color: '#9A6A3E' }), mat({ color: '#9A6A3E' }), mat({ color: '#9A6A3E' }), mat({ color: '#9A6A3E' }), mat({ map: t, roughness: 0.9 }), mat({ color: '#9A6A3E' })]);
  m.castShadow = true; g.add(m); [-1, 1].forEach((s) => { const leg = box(0.06, 1.0, 0.06, mat({ color: '#9A6A3E' }), s * (w / 2 - 0.1), -h / 2 - 0.5 + 0.05, 0, g); }); return g;
}

export function bigCheck(amount = '$200,000', to = 'PAY TO: THE OLD MAN') {
  const t = canvasTex('check' + amount + to, 640, 300, (c, W, H) => { c.fillStyle = '#E8F6EA'; c.fillRect(0, 0, W, H); c.strokeStyle = '#2E8A4A'; c.lineWidth = 14; c.strokeRect(7, 7, W - 14, H - 14);
    c.fillStyle = INK; c.textAlign = 'left'; c.font = '900 30px Inter'; c.fillText(to, 30, 70); c.textAlign = 'center'; c.font = '900 110px Inter'; c.fillStyle = '#2E8A4A'; c.fillText(amount, W / 2, 200);
    c.fillStyle = INK; c.fillRect(30, 250, W - 60, 4); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), mat({ map: t, roughness: 0.8, side: THREE.DoubleSide })); m.castShadow = true; return m;
}

/** a tall stack of paper with a label tag in front (lawyer bills etc.) */
export function billStack(label = 'LAWYER BILLS', amount = '$629,600', n = 18) {
  const g = new THREE.Group(), pm = mat({ color: '#FBF5E4', roughness: 0.9 }), pm2 = mat({ color: '#EDE4CC', roughness: 0.9 });
  for (let k = 0; k < n; k++) box(0.62, 0.07, 0.45, k % 2 ? pm : pm2, (rnd(k) - 0.5) * 0.06, 0.035 + k * 0.072, (rnd(k * 3) - 0.5) * 0.05, g);
  const t = canvasTex('tag' + label + amount, 320, 200, (c, W, H) => { c.fillStyle = '#F2C230'; c.fillRect(0, 0, W, H); c.strokeStyle = INK; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10); c.fillStyle = INK; c.textAlign = 'center'; c.font = '900 34px Inter'; c.fillText(label, W / 2, 70); c.font = '900 58px Inter'; c.fillStyle = '#B5372E'; c.fillText(amount, W / 2, 150); });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.45), mat({ map: t, side: THREE.DoubleSide })); tag.position.set(0, 0.35, 0.3); g.add(tag); g.height = n * 0.072; return g;
}

/** a gold coin that can spin in the air */
export function coin() {
  const t = canvasTex('coinface', 128, 128, (c, W, H) => { c.fillStyle = '#F2C230'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.strokeStyle = '#B8862F'; c.lineWidth = 8; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.stroke(); c.fillStyle = '#B8862F'; c.font = '900 56px Inter'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 64, 68); });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 24), [mat({ color: '#D8A830', metalness: 0.5 }), mat({ map: t, metalness: 0.4, roughness: 0.3 }), mat({ map: t, metalness: 0.4, roughness: 0.3 })]);
  m.castShadow = true; return m;
}

/** a wall calendar whose year can change: calendar().set('2003') */
export function calendar() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 300; const g = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; let key = '';
  const set = (year) => { if (year === key) return; key = year; g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, 256, 300); g.fillStyle = '#D8343F'; g.fillRect(0, 0, 256, 80); g.fillStyle = '#FFFFFF'; g.font = '900 40px Inter'; g.textAlign = 'center'; g.fillText('YEAR', 128, 54);
    g.fillStyle = INK; g.font = '900 92px Inter'; g.fillText(year, 128, 190); g.fillStyle = 'rgba(31,28,51,0.35)'; for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) g.fillRect(22 + k * 31, 218 + r * 24, 20, 14); g.strokeStyle = INK; g.lineWidth = 8; g.strokeRect(4, 4, 248, 292); tex.needsUpdate = true; };
  set('2001'); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); m.castShadow = true; m.set = set; return m;
}

/** a chalkboard on legs whose text can change: board().draw([[text, col, size], ...]) */
export function board(w = 2.4, h = 1.5) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; let key = '';
  const draw = (lines = []) => { const k = JSON.stringify(lines); if (k === key) return; key = k;
    g.fillStyle = '#2E5A46'; g.fillRect(0, 0, 640, 400); g.globalAlpha = 0.1; g.fillStyle = '#FFFFFF'; for (let i = 0; i < 50; i++) g.fillRect(rnd(i) * 640, rnd(i * 3) * 400, 40, 3); g.globalAlpha = 1;
    g.strokeStyle = '#9A6A3E'; g.lineWidth = 26; g.strokeRect(0, 0, 640, 400); g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([t, col, size, y], i) => { let fs = size || 56; g.font = `900 ${fs}px Inter, sans-serif`; while (g.measureText(t).width > 590 && fs > 16) { fs -= 2; g.font = `900 ${fs}px Inter, sans-serif`; } g.fillStyle = col || '#F4F4F0'; g.fillText(t, 320, y ?? (80 + i * 88)); });
    tex.needsUpdate = true; };
  const grp = new THREE.Group(); const wood = mat({ color: '#9A6A3E' });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), wood]); m.position.y = 0.9 + h / 2; m.castShadow = true; grp.add(m);
  [-1, 1].forEach((s) => box(0.07, 0.95, 0.07, wood, s * (w / 2 - 0.15), 0.47, 0, grp)); draw([]); grp.draw = draw; return grp;
}
