// pinkset.js: sets for the "drunk tank pink" Short.
//   cell(E, { x })        a stage-set jail cell (open toward +z): back wall z = -1.8, side walls x = ±1.7, floor y = 0.
//        .paint(k, sweep)  wall colour gray -> Baker-Miller pink; sweep = 0..1 how far a fresh pink coat has rolled across
//        .setPink(k)       all walls at once                       .light (the ceiling panel)
//   twinCells(E)          two cells side by side (left gray, right pink) for the comparison shot
//   lab(E)                a colour lab: teal walls, colour swatches, desk, a heart monitor on a stand
//   corridor(E)           a long cell block: steel doors both sides; .doorPink(i, k) turns door i's window glow pink
//   locker(E)             a visitors' locker room: lockers, benches, all pink
import * as THREE from 'three';
import { mat, canvasTex, sunlight, signBoard } from './world.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 16) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
export const PINK = '#FF9CB8', GRAY = '#A4ABB8';
const lerpCol = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k);

function lights(scene, E, { key = '#FFE6C8', i = 2.4, pos = [2.5, 6, 6], sky = '#7FA8E8', ground = '#3A2A4A', hemi = 1.0, box: bx = 8 } = {}) {
  return sunlight(scene, E, { col: key, i, pos, target: [0, 1, -0.5], box: bx, sky, ground, hemi });
}
const concrete = (key, col) => canvasTex(key, 512, 512, (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); for (let k = 0; k < 2600; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'; c.fillRect(rnd(k * 3) * W, rnd(k * 7) * H, 2 + rnd(k) * 3, 2 + rnd(k * 5) * 3); } }, [3, 3]);

function buildCell(parent, { x = 0, start = 0 } = {}) {
  const g = new THREE.Group(); g.position.x = x; parent.add(g);
  const wallM = mat({ color: GRAY, roughness: 0.8, map: concrete('cellwall', '#FFFFFF') });
  const back = box(3.4, 3.0, 0.15, wallM, 0, 1.5, -1.8, g);
  const sideL = box(0.15, 3.0, 3.8, wallM, -1.7, 1.5, 0.1, g), sideR = box(0.15, 3.0, 3.8, wallM, 1.7, 1.5, 0.1, g);
  const floorM = mat({ color: '#6A6E7A', roughness: 0.6, map: concrete('cellfloor', '#FFFFFF') });
  const fl = box(3.4, 0.1, 4.2, floorM, 0, -0.05, 0.3, g); fl.castShadow = false;
  box(3.4, 0.12, 3.9, mat({ color: '#4A4E5A' }), 0, 3.06, 0.1, g);
  // fresh-paint coat that rolls across the back wall
  const coat = new THREE.Mesh(new THREE.PlaneGeometry(1, 3.0), mat({ color: PINK, roughness: 0.55 })); coat.position.set(0, 1.5, -1.71); coat.receiveShadow = true; g.add(coat);
  // bench, door with a window slot, a ceiling light panel
  const steel = mat({ color: '#B8BEC8', metalness: 0.5, roughness: 0.35 });
  box(1.8, 0.1, 0.55, steel, -0.3, 0.5, -1.45, g); [-1.0, 0.4].forEach((bx) => box(0.08, 0.5, 0.45, steel, bx, 0.25, -1.45, g));
  const door = box(0.08, 2.2, 1.0, mat({ color: '#5A6478', metalness: 0.4, roughness: 0.4 }), 1.63, 1.1, -0.6, g);
  box(0.1, 0.25, 0.5, mat({ color: '#1A1A22' }), 1.62, 1.75, -0.6, g);
  const light = box(1.0, 0.05, 0.5, mat({ color: '#FFFFFF', emissive: '#FFF4E8', emissiveIntensity: 1.3 }), 0, 3.0, -0.4, g); light.castShadow = false;
  const walls = [back, sideL, sideR];
  g.setPink = (k) => { const c = lerpCol(GRAY, PINK, k); walls.forEach((w) => { w.material.color.copy(c); w.material.emissive.copy(c); w.material.emissiveIntensity = 0.16; }); };
  g.paint = (k, sweep = 0) => { g.setPink(k); coat.visible = sweep > 0.001 && k < 0.999; coat.scale.x = Math.max(0.001, 3.3 * sweep); coat.position.x = -1.65 + 1.65 * sweep; };
  walls.forEach((w) => { w.material = w.material.clone(); });
  g.setPink(start); g.paint(start, 0); g.light = light;
  return g;
}

export function cell(E, { start = 0 } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1C2240');
  const sun = lights(scene, E, { key: '#FFE8D4', i: 3.1, pos: [1.6, 5.5, 4.5], sky: '#C8D6FF', ground: '#8A5A80', hemi: 1.55 });
  scene.fog = new THREE.Fog('#1C2240', 12, 40);
  const c = buildCell(scene, { start });
  return { scene, sun, cell: c, paint: c.paint, setPink: c.setPink };
}

export function twinCells(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1C2240');
  const sun = lights(scene, E, { key: '#FFE8D4', i: 3.1, pos: [0, 6, 6], sky: '#C8D6FF', ground: '#8A5A80', hemi: 1.55, box: 10 });
  const a = buildCell(scene, { x: -1.8, start: 0 }), b = buildCell(scene, { x: 1.8, start: 1 });
  return { scene, sun, gray: a, pink: b };
}

export function lab(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#14283A');
  const sun = lights(scene, E, { key: '#FFE8CC', i: 2.5, pos: [-2.5, 6, 5], sky: '#7FC8E8', ground: '#2A3A4A', hemi: 1.1 });
  const wm = mat({ color: '#2E7A80', roughness: 0.7 });
  box(9, 4, 0.2, wm, 0, 2, -2.2, scene); box(0.2, 4, 7, wm, -3.6, 2, 0.5, scene); box(0.2, 4, 7, wm, 3.6, 2, 0.5, scene);
  const fl = box(9, 0.1, 7, mat({ color: '#D8D2C4', map: canvasTex('labfloor', 256, 256, (c, W, H) => { c.fillStyle = '#E8E2D4'; c.fillRect(0, 0, W, H); c.fillStyle = '#C8C0B0'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) c.fillRect(x * 64, y * 64, 64, 64); }, [6, 5]) }), 0, -0.05, 0.5, scene); fl.castShadow = false;
  // colour swatches on the back wall: a chart of cards, the pink one glowing
  const cols = ['#E8533A', '#F2C230', '#5FBF6A', '#3C6FB6', '#8A4FB8', PINK, '#F4F4F4', '#2A2A33'];
  const sw = []; cols.forEach((c, i) => { const m = box(0.55, 0.75, 0.04, mat({ color: c, emissive: c === PINK ? PINK : '#000000', emissiveIntensity: c === PINK ? 0.25 : 0 }), -2.0 + (i % 4) * 0.75, 2.6 - Math.floor(i / 4) * 0.95, -2.08, scene); sw.push(m); });
  box(2.6, 0.08, 1.0, mat({ color: '#E8E4DC' }), 1.4, 0.95, -1.2, scene); [0.3, 2.5].forEach((x) => box(0.08, 0.95, 0.9, mat({ color: '#8A8A98' }), x, 0.47, -1.2, scene));
  // heart monitor
  const mon = new THREE.Group(); mon.position.set(1.8, 1.0, -1.3); scene.add(mon);
  box(0.9, 0.6, 0.35, mat({ color: '#3A3A48' }), 0, 0.35, 0, mon); box(0.78, 0.46, 0.02, mat({ color: '#0E2A1E', emissive: '#1EE08A', emissiveIntensity: 0.25 }), 0, 0.37, 0.18, mon);
  const lamp = box(1.2, 0.06, 0.5, mat({ color: '#FFFFFF', emissive: '#FFF4E8', emissiveIntensity: 1.2 }), 0, 3.95, 0, scene); lamp.castShadow = false;
  return { scene, sun, swatches: sw, monitor: mon };
}

export function corridor(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#141A30');
  const sun = lights(scene, E, { key: '#FFDDB8', i: 2.2, pos: [1, 7, 6], sky: '#6A88D8', ground: '#3A2A3A', hemi: 1.05, box: 14 });
  scene.fog = new THREE.Fog('#18203A', 10, 46);
  const wm = mat({ color: '#5A6A86', roughness: 0.7, map: concrete('corwall', '#FFFFFF') });
  box(0.2, 3.4, 40, wm, -2.2, 1.7, -14, scene); box(0.2, 3.4, 40, wm, 2.2, 1.7, -14, scene);
  const fl = box(4.6, 0.1, 40, mat({ color: '#7A7E8A', roughness: 0.35, map: concrete('corfloor', '#FFFFFF') }), 0, -0.05, -14, scene); fl.castShadow = false;
  box(4.6, 0.1, 40, mat({ color: '#2A2E3A' }), 0, 3.45, -14, scene);
  const doors = [];
  for (let i = 0; i < 8; i++) [-1, 1].forEach((s) => {
    const z = 2 - i * 4.2 - (s > 0 ? 2.1 : 0), gl = mat({ color: '#2A2A33', emissive: PINK, emissiveIntensity: 0 });
    const frame = box(0.12, 2.4, 1.3, mat({ color: '#2A2E3A' }), s * 2.08, 1.2, z, scene);
    const d = box(0.08, 2.2, 1.05, mat({ color: '#6A7488', metalness: 0.45, roughness: 0.4 }), s * 2.03, 1.1, z, scene);
    const w = box(0.1, 0.35, 0.55, gl, s * 2.0, 1.7, z, scene); const glow = new THREE.PointLight(PINK, 0, 3.5); glow.position.set(s * 1.6, 1.7, z); scene.add(glow);
    doors.push({ w, glow, d, z, s });
  });
  for (let i = 0; i < 9; i++) { const l = box(0.9, 0.05, 0.3, mat({ color: '#FFFFFF', emissive: '#FFF0DC', emissiveIntensity: 1.2 }), 0, 3.38, 1 - i * 4.2, scene); l.castShadow = false; }
  const sign = signBoard('U.S. NAVY  CELL BLOCK', { w: 2.8, h: 0.42, bg: '#1F2A4A', fg: '#F2D37A', font: 'Inter' }); sign.position.set(0, 2.95, -26); scene.add(sign);
  return { scene, sun, doors, doorPink: (i, k) => { const D = doors[i]; if (!D) return; D.w.material.emissiveIntensity = k * 1.4; D.w.material.color.copy(lerpCol('#2A2A33', PINK, k)); D.glow.intensity = k * 6; D.d.material.color.copy(lerpCol('#6A7488', '#E888A8', k * 0.8)); } };
}

export function locker(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#2A1A30');
  const sun = lights(scene, E, { key: '#FFE8D8', i: 2.4, pos: [-2, 6, 5], sky: '#9FB8FF', ground: '#5A2A4A', hemi: 1.15, box: 10 });
  const pm = mat({ color: PINK, roughness: 0.6 });
  box(10, 3.6, 0.2, pm, 0, 1.8, -2.4, scene); box(0.2, 3.6, 8, pm, -4.2, 1.8, 0.8, scene); box(0.2, 3.6, 8, pm, 4.2, 1.8, 0.8, scene);
  const fl = box(10, 0.1, 8, mat({ color: '#E890A8', roughness: 0.5, map: concrete('lockfloor', '#FFFFFF') }), 0, -0.05, 0.8, scene); fl.castShadow = false;
  const lm = mat({ color: '#FF7FA4', roughness: 0.4, metalness: 0.25 }), vent = mat({ color: '#C8587A' });
  for (let i = 0; i < 10; i++) { const x = -3.6 + i * 0.8; box(0.76, 2.3, 0.5, lm, x, 1.15, -2.05, scene); for (let k = 0; k < 3; k++) box(0.4, 0.04, 0.02, vent, x, 2.0 - k * 0.1, -1.79, scene); box(0.05, 0.18, 0.04, mat({ color: '#F4E0A0', metalness: 0.6 }), x + 0.28, 1.2, -1.78, scene); }
  [-1.2, 1.6].forEach((z) => { box(5, 0.1, 0.45, mat({ color: '#FFB0C8' }), 0, 0.45, z - 0.6, scene); [-2.2, 2.2].forEach((x) => box(0.08, 0.45, 0.4, mat({ color: '#C8587A' }), x, 0.22, z - 0.6, scene)); });
  const sign = signBoard('VISITORS', { w: 2.4, h: 0.5, bg: '#FFFFFF', fg: '#E0507A', font: 'Inter' }); sign.position.set(0, 3.05, -2.25); scene.add(sign);
  for (let i = 0; i < 3; i++) { const l = box(1.2, 0.05, 0.4, mat({ color: '#FFFFFF', emissive: '#FFF0F4', emissiveIntensity: 1.2 }), -2.5 + i * 2.5, 3.55, 0.2, scene); l.castShadow = false; }
  return { scene, sun };
}
