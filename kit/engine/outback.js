// outback.js (kit v8): a bright, high-key farm in the Australian outback: golden wheat, a dirt road, a fence, gum trees,
// low purple hills, puffy clouds and a 1930s army truck with a machine gun on the back.
//   outback(E, { sunset, truckOn }) -> { scene, sun, truck (Group: drive along +x; truck.wheels spin with .roll(dist)), gun, update(t, { truckX }) }
//   road along x at z 0..2.6 (people on the road stand at z ~1), wheat field at z < -0.5 and z > 3.6
//   the truck's flatbed top is y = 1.15 (stand soldiers on it at local x -1.9..-0.4, z 0)
import * as THREE from 'three';
import { mat, canvasTex, sunlight, signBoard } from './world.js';
import { majSky } from './han.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 18) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };

export function armyTruck() {
  const g = new THREE.Group(), olive = mat({ color: '#66743E', roughness: 0.6 }), dark = mat({ color: '#3E4628', roughness: 0.6 }), wood = mat({ color: '#9A7448', roughness: 0.8 }), blk = mat({ color: '#25242A', roughness: 0.7 }), chrome = mat({ color: '#C8C8D0', metalness: 0.6, roughness: 0.3 });
  box(5.6, 0.25, 1.9, dark, 0, 0.62, 0, g);                                     // chassis
  box(1.5, 0.75, 1.5, olive, 1.85, 1.1, 0, g); box(0.1, 0.62, 1.3, chrome, 2.62, 1.05, 0, g);   // hood + grille
  [-0.55, 0.55].forEach((z) => { const h = cyl(0.13, 0.13, 0.06, mat({ color: '#FFF4C8', emissive: '#FFE8A0', emissiveIntensity: 0.4 }), 2.66, 1.22, z, g); h.rotation.z = Math.PI / 2; });
  box(1.15, 1.25, 1.8, olive, 0.55, 1.4, 0, g); box(0.06, 0.55, 1.5, mat({ color: '#2A3A48', roughness: 0.1, metalness: 0.3 }), 1.14, 1.72, 0, g);   // cab + windscreen
  box(0.9, 0.06, 1.85, dark, 0.55, 2.05, 0, g);                                // cab roof
  box(3.1, 0.12, 2.0, wood, -1.25, 1.1, 0, g);                                 // flatbed
  [-0.95, 0.95].forEach((z) => box(3.1, 0.35, 0.08, wood, -1.25, 1.33, z, g)); box(0.08, 0.35, 2.0, wood, -2.78, 1.33, 0, g);
  [[1.9, 1], [1.9, -1], [-1.6, 1], [-1.6, -1]].forEach(([x, s]) => { const fen = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 20, 1, false, 0, Math.PI), olive); fen.rotation.x = Math.PI / 2; fen.rotation.z = Math.PI / 2; fen.position.set(x, 0.55, s * 0.82); g.add(fen); });
  const wheels = [];
  [[1.9, 1], [1.9, -1], [-1.6, 1], [-1.6, -1]].forEach(([x, s]) => { const w = new THREE.Group(); w.position.set(x, 0.5, s * 0.82); g.add(w); const t = cyl(0.5, 0.5, 0.34, blk, 0, 0, 0, w, 22); t.rotation.x = Math.PI / 2; const hb = cyl(0.22, 0.22, 0.36, mat({ color: '#B8B080', metalness: 0.3 }), 0, 0, 0, w, 12); hb.rotation.x = Math.PI / 2;
    for (let k = 0; k < 5; k++) { const sp = box(0.06, 0.4, 0.06, dark, 0, 0, s * 0.18, w); sp.rotation.z = k / 5 * Math.PI; } wheels.push(w); });
  // the machine gun on a tripod at the back of the bed (barrel points +z toward the field by default)
  const gun = new THREE.Group(); gun.position.set(-2.1, 1.16, 0); g.add(gun);
  [0, 2.1, 4.2].forEach((a) => { const l = cyl(0.025, 0.025, 0.75, blk, Math.sin(a) * 0.22, 0.3, Math.cos(a) * 0.22, gun, 6); l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); });
  const head = new THREE.Group(); head.position.y = 0.66; gun.add(head);
  const bar = cyl(0.07, 0.07, 1.3, blk, 0, 0, 0.35, head, 12); bar.rotation.x = Math.PI / 2;
  const jacket = cyl(0.11, 0.11, 0.7, dark, 0, 0, 0.25, head, 14); jacket.rotation.x = Math.PI / 2;
  const drum = cyl(0.22, 0.22, 0.08, dark, 0, 0.14, 0.05, head, 20);
  box(0.06, 0.12, 0.5, wood, 0, -0.04, -0.4, head);
  g.wheels = wheels; g.gun = gun; g.gunHead = head;
  g.roll = (dist) => wheels.forEach((w) => (w.rotation.z = -dist / 0.5));
  return g;
}

export function outback(E, { sunset = false, truckOn = true } = {}) {
  const scene = new THREE.Scene();
  if (sunset) majSky(scene, { top: '#5A6FD0', mid: '#F0A0B8', horizon: '#FFD08A', sunCol: '#FFE6A8', sunDir: [0.3, 0.12, -1], glow: 0.8 });
  else majSky(scene, { top: '#2F7FD8', mid: '#7CC0F0', horizon: '#FFF0D0', sunCol: '#FFF6DA', sunDir: [0.45, 0.55, -1], glow: 0.5 });
  const sun = sunset ? sunlight(scene, E, { col: '#FFD6A0', i: 2.7, pos: [5, 6, -8], target: [0, 0.5, 0], box: 18, sky: '#C8B8F0', ground: '#E0A070', hemi: 1.8 })
    : sunlight(scene, E, { col: '#FFF2DC', i: 3.0, pos: [7, 13, 9], target: [0, 0.5, 0], box: 18, sky: '#C6DCFF', ground: '#D8B070', hemi: 1.7 });
  scene.fog = new THREE.Fog(sunset ? '#F4C8B8' : '#DCEBFA', 70, 300);
  // golden wheat ground + a dusty road
  const wT = canvasTex('wheat', 512, 512, (c, W, H) => { c.fillStyle = '#E2B84E'; c.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 8) { c.fillStyle = (y / 8) % 2 ? 'rgba(255,230,140,0.5)' : 'rgba(170,120,40,0.35)'; c.fillRect(0, y, W, 4); }
    for (let k = 0; k < 2400; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(255,245,190,0.5)' : 'rgba(150,100,30,0.35)'; c.fillRect(rnd(k * 3) * W, rnd(k * 7) * H, 2, 6); } }, [40, 40]);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat({ map: wT, roughness: 0.95 })); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; scene.add(gr);
  const rT = canvasTex('road', 256, 256, (c, W, H) => { c.fillStyle = '#C89A64'; c.fillRect(0, 0, W, H); for (let k = 0; k < 900; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(255,230,190,0.4)' : 'rgba(110,70,40,0.3)'; c.fillRect(rnd(k * 3) * W, rnd(k * 7) * H, 3, 3); } c.fillStyle = 'rgba(110,70,40,0.25)'; c.fillRect(0, 60, W, 18); c.fillRect(0, 178, W, 18); }, [60, 1]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 2.8), mat({ map: rT, roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 1.3); road.receiveShadow = true; scene.add(road);
  // wheat clumps (instanced cones) for texture near the camera
  const cone = new THREE.ConeGeometry(0.09, 0.55, 5); const wm = mat({ color: '#F0C860', roughness: 0.9 });
  const inst = new THREE.InstancedMesh(cone, wm, 1400); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < 1400; i++) { const side = i % 3 === 0 ? 1 : -1; const x = -40 + rnd(i) * 80, z = side > 0 ? 3.7 + rnd(i * 5) * 6 : -0.4 - rnd(i * 5) * 16; p.set(x, 0.25, z); q.setFromEuler(new THREE.Euler((rnd(i * 7) - 0.5) * 0.3, 0, (rnd(i * 9) - 0.5) * 0.3)); const s = 0.7 + rnd(i * 11) * 0.7; sc.set(s, s, s); M.compose(p, q, sc); inst.setMatrixAt(i, M); }
  inst.castShadow = false; inst.receiveShadow = true; scene.add(inst);
  // fence along the far side of the road
  const fm = mat({ color: '#8A6A48', roughness: 0.9 });
  for (let x = -40; x <= 40; x += 3) { const pst = cyl(0.06, 0.07, 1.1, fm, x, 0.55, -0.3, scene, 7); pst.rotation.z = (rnd(x) - 0.5) * 0.08; }
  [0.55, 0.9].forEach((y) => box(80, 0.025, 0.025, mat({ color: '#5A5A60', metalness: 0.5 }), 0, y, -0.3, scene));
  // gum trees, hills, clouds
  const trunk = mat({ color: '#E8E0D4', roughness: 0.8 }), leaf = mat({ color: '#6E9E4E', roughness: 0.9, flatShading: true });
  [[-22, -18], [-9, -30], [6, -22], [18, -34], [30, -20], [-34, -40]].forEach(([x, z], i) => { const t = new THREE.Group(); t.position.set(x, 0, z); scene.add(t); const tr = cyl(0.22, 0.35, 5, trunk, 0, 2.5, 0, t, 8); tr.rotation.z = (rnd(i) - 0.5) * 0.2;
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + rnd(i * 4 + k), 1), leaf); b.position.set((rnd(i + k) - 0.5) * 2.6, 5 + rnd(i * 3 + k) * 1.4, (rnd(i * 2 + k) - 0.5) * 2); b.castShadow = true; t.add(b); } });
  const hm = mat({ color: '#9A88C0', roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.SphereGeometry(30 + rnd(i) * 30, 12, 8), hm); h.scale.y = 0.22 + rnd(i * 3) * 0.12; h.position.set(-160 + i * 42, 0, -150 - rnd(i * 5) * 60); h.castShadow = false; scene.add(h); }
  const cm = mat({ color: '#FFFFFF', roughness: 1, emissive: '#FFFFFF', emissiveIntensity: 0.25 });
  for (let i = 0; i < 7; i++) { const cl = new THREE.Group(); cl.position.set(-120 + i * 40 + rnd(i) * 20, 38 + rnd(i * 3) * 18, -170 - rnd(i * 7) * 40); scene.add(cl);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd(i * 5 + k) * 6, 14, 10), cm); b.position.set((k - 2) * 7, rnd(i + k) * 4, 0); b.scale.y = 0.75; b.castShadow = false; cl.add(b); } }
  const sign = signBoard('WHEAT FARM', { w: 2.2, h: 0.6, bg: '#F4EBD0', fg: '#7A3A22', font: 'Inter' }); sign.position.set(-6, 1.35, -0.25); scene.add(sign);
  cyl(0.05, 0.05, 1.1, fm, -6.9, 0.55, -0.32, scene, 6); cyl(0.05, 0.05, 1.1, fm, -5.1, 0.55, -0.32, scene, 6);
  const truck = armyTruck(); truck.position.set(0, 0, 1.3); if (truckOn) scene.add(truck);
  return { scene, sun, truck, update: (t, { truckX = 0 } = {}) => { truck.position.x = truckX; truck.roll(truckX); } };
}
