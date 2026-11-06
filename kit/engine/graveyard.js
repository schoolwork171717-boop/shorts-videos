// graveyard.js (kit v8.4): a cool dusk cemetery with bell posts, a cut-away grave, and a boxing ring.
//   graveyard(E) -> { scene, sun, bells: [{ group, bell, x, z }], cut: { group, coffin, lid, pipe, x, z }, flag, update(t) }
//     ground at y 0; graves in rows along x at z -2..-8; the cut-away grave at x 0, z 0 (its front face at z 1.2, the coffin at y -1.6)
//   boxingRing(E) -> { scene, sun, bell, ring: { size, top } }
import * as THREE from 'three';
import { mat, canvasTex, sunlight, signBoard } from './world.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 16) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };

function skyDome(scene, top, mid, bottom) {
  const t = canvasTex('sky' + top + mid + bottom, 16, 256, (c, W, H) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom); c.fillStyle = g; c.fillRect(0, 0, W, H); });
  const s = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, toneMapped: false })); s.userData.noToon = true; scene.add(s); return s;
}

/** a bell on a post under a little roof (the safety-coffin signal) */
export function bellPost() {
  const g = new THREE.Group(), wood = mat({ color: '#6E4A30', roughness: 0.8 }), brass = mat({ color: '#E8B83A', metalness: 0.6, roughness: 0.3, emissive: '#5A4410', emissiveIntensity: 0.25 });
  box(0.1, 1.3, 0.1, wood, 0, 0.65, 0, g); box(0.5, 0.06, 0.4, wood, 0, 1.38, 0, g);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 4), mat({ color: '#3E5A7A' })); roof.position.y = 1.56; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const bell = new THREE.Group(); bell.position.set(0, 1.33, 0); g.add(bell);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.15, 0.2, 16, 1, true), brass); b.position.y = -0.12; b.castShadow = true; bell.add(b);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), brass); top.position.y = -0.02; bell.add(top);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), mat({ color: '#E8E0C8' })); str.position.y = -0.8; bell.add(str);
  g.bell = bell; return g;
}

function headstone(i) {
  const g = new THREE.Group(), stone = mat({ color: ['#9AA6BC', '#8E98AE', '#A8B0C4'][i % 3], roughness: 0.9 });
  const w = 0.55 + rnd(i) * 0.2, h = 0.7 + rnd(i * 3) * 0.35;
  box(w, h - w / 2, 0.14, stone, 0, (h - w / 2) / 2, 0, g);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.14, 20, 1, false, 0, Math.PI), stone); top.rotation.set(Math.PI / 2, 0, -Math.PI / 2); top.position.y = h - w / 2; top.rotation.z = 0; top.rotation.x = Math.PI / 2; top.rotation.y = Math.PI / 2; top.castShadow = true;
  const arc = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.14, 20), stone); arc.rotation.x = Math.PI / 2; arc.position.y = h - w / 2; arc.scale.set(1, 1, 1); arc.castShadow = true; g.add(arc);
  box(w * 0.5, 0.04, 0.02, mat({ color: '#5E6A82' }), 0, h * 0.62, 0.075, g); box(w * 0.36, 0.04, 0.02, mat({ color: '#5E6A82' }), 0, h * 0.5, 0.075, g);
  g.rotation.z = (rnd(i * 7) - 0.5) * 0.12; return g;
}

function deadTree(i) {
  const g = new THREE.Group(), bark = mat({ color: '#3E3448', roughness: 1 });
  cyl(0.12, 0.2, 3.2, bark, 0, 1.6, 0, g, 7);
  for (let k = 0; k < 5; k++) { const br = cyl(0.03, 0.07, 1.2 + rnd(i * 9 + k) * 0.8, bark, 0, 0, 0, g, 5); const a = (k / 5) * Math.PI * 2 + rnd(i + k); br.position.set(Math.cos(a) * 0.35, 2.4 + rnd(k + i) * 0.7, Math.sin(a) * 0.35); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
  return g;
}

export function graveyard(E) {
  const scene = new THREE.Scene();
  skyDome(scene, '#1E2A5A', '#5A5A9A', '#E8A0A8');
  scene.fog = new THREE.Fog('#7A78A8', 18, 70);
  const sun = sunlight(scene, E, { col: '#C8D4FF', i: 2.2, pos: [-6, 9, 5], target: [0, 0, -2], box: 16, sky: '#8890D8', ground: '#2E3E4A', hemi: 2.0 });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ color: '#FFF4D8', fog: false, toneMapped: false })); moon.position.set(-22, 26, -90); moon.userData.noToon = true; scene.add(moon);
  // grass ground with a hole cut for the cut-away grave (built from four slabs around it)
  const gT = canvasTex('grass', 256, 256, (c, W, H) => { c.fillStyle = '#3E6A5A'; c.fillRect(0, 0, W, H); for (let k = 0; k < 900; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(120,170,130,0.5)' : 'rgba(20,50,50,0.45)'; c.fillRect(rnd(k * 3) * W, rnd(k * 7) * H, 2, 6); } }, [10, 10]);
  const gm = mat({ map: gT, roughness: 1 });
  const slab = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), gm); m.position.set(x, -0.1, z); m.receiveShadow = true; scene.add(m); };
  slab(80, 39, 0, -1.0 - 19.5); slab(80, 39, 0, 1.4 + 19.5); slab(39, 2.4, -0.6 - 19.5, 0.2); slab(39, 2.4, 0.6 + 19.5, 0.2);
  // the cut-away grave: a block of earth seen in section, a coffin inside, a pipe up to the surface
  const cut = new THREE.Group(); scene.add(cut);
  const eT = canvasTex('earth', 256, 256, (c, W, H) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7A5A3E'); g.addColorStop(1, '#4E3828'); c.fillStyle = g; c.fillRect(0, 0, W, H); for (let k = 0; k < 160; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(150,120,90,0.6)' : 'rgba(40,28,20,0.5)'; c.beginPath(); c.arc(rnd(k * 3) * W, rnd(k * 5) * H, 2 + rnd(k) * 5, 0, 7); c.fill(); } });
  const earth = mat({ map: eT, roughness: 1 });
  box(1.4, 3.0, 0.1, earth, 0, -1.5, -1.05, cut); box(1.4, 3.0, 0.1, earth, 0, -1.5, 1.45, cut); box(0.1, 3.0, 2.4, earth, -0.65, -1.5, 0.2, cut); box(0.1, 3.0, 2.4, earth, 0.65, -1.5, 0.2, cut); box(1.4, 0.1, 2.6, earth, 0, -3.0, 0.2, cut);
  
  const wood = mat({ color: '#8A5A36', roughness: 0.7 }), wood2 = mat({ color: '#6E4428', roughness: 0.7 });
  const coffin = new THREE.Group(); coffin.position.set(0, -2.55, 0.2); coffin.rotation.y = Math.PI / 2; cut.add(coffin);   // long axis along z
  box(1.9, 0.08, 0.9, wood2, 0, 0, 0, coffin); box(1.9, 0.5, 0.08, wood, 0, 0.25, -0.42, coffin); box(0.08, 0.5, 0.9, wood, -0.95, 0.25, 0, coffin); box(0.08, 0.5, 0.9, wood, 0.95, 0.25, 0, coffin);
  const lid = box(1.9, 0.06, 0.9, wood, 0, 0.53, 0, coffin); lid.visible = false;
  const pipe = cyl(0.07, 0.07, 2.6, mat({ color: '#9AA6B8', metalness: 0.5, roughness: 0.4 }), 0.6, 1.3, 0.25, coffin, 12);
  const string = cyl(0.01, 0.01, 2.6, mat({ color: '#F4EAD0' }), 0.8, 1.3, -0.3, coffin, 4);
  // the bell posts: one at the cut-away grave, then rows of graves with their own bells
  const bells = [];
  const bp0 = bellPost(); bp0.position.set(-0.3, 0, -1.25); scene.add(bp0); bells.push({ group: bp0, bell: bp0.bell, x: -0.3, z: -1.25 });
  for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) {
    const x = -9 + k * 3 + (r % 2) * 1.4 + (rnd(r * 10 + k) - 0.5) * 0.6, z = -3.2 - r * 3.2;
    if (Math.abs(x) < 1.6 && r === 0) continue;
    const hs = headstone(r * 7 + k); hs.position.set(x, 0, z); scene.add(hs);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: '#4E7A5E', roughness: 1 })); mound.scale.set(0.5, 0.18, 1.0); mound.position.set(x, 0, z + 1.1); mound.receiveShadow = true; scene.add(mound);
    if ((r + k) % 2 === 0) { const bp = bellPost(); bp.position.set(x + 0.55, 0, z + 0.35); scene.add(bp); bells.push({ group: bp, bell: bp.bell, x: x + 0.55, z: z + 0.35 }); }
  }
  // iron fence, dead trees, a little church, warm lanterns
  const iron = mat({ color: '#2A2838' });
  for (let k = 0; k < 60; k++) { const x = -15 + k * 0.5; box(0.04, 1.1, 0.04, iron, x, 0.55, -12.5, scene); }
  box(30, 0.05, 0.05, iron, 0, 1.0, -12.5, scene); box(30, 0.05, 0.05, iron, 0, 0.3, -12.5, scene);
  [[-7, -10], [6.5, -9], [-11, -5], [10.5, -4]].forEach(([x, z], i) => { const tr = deadTree(i); tr.position.set(x, 0, z); scene.add(tr); });
  const church = new THREE.Group(); church.position.set(5, 0, -22); scene.add(church);
  box(5, 4, 4, mat({ color: '#6A6A9A' }), 0, 2, 0, church); const rf = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.4, 4), mat({ color: '#3A3A6A' })); rf.position.y = 5.2; rf.rotation.y = Math.PI / 4; church.add(rf);
  box(1.4, 7, 1.4, mat({ color: '#5E5E8E' }), -2.2, 3.5, 1, church); const sp = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4), mat({ color: '#3A3A6A' })); sp.position.set(-2.2, 8.3, 1); sp.rotation.y = Math.PI / 4; church.add(sp);
  [[-1.0, 2.2], [1.0, 2.2]].forEach(([x, y]) => box(0.6, 1.1, 0.05, mat({ color: '#FFD890', emissive: '#FFB860', emissiveIntensity: 1.2 }), x, y, 2.03, church));
  const lamps = [];
  [[-4.6, 2.2], [2.6, -1.4], [-5.5, -6.0]].forEach(([x, z]) => { const l = new THREE.Group(); l.position.set(x, 0, z); scene.add(l); box(0.06, 1.6, 0.06, iron, 0, 0.8, 0, l); box(0.22, 0.3, 0.22, mat({ color: '#FFD890', emissive: '#FFB860', emissiveIntensity: 0.7 }), 0, 1.75, 0, l); const pl = new THREE.PointLight('#FFB868', 4, 6, 1.6); pl.position.set(0, 1.75, 0); l.add(pl); lamps.push(l); });
  // a flag on a pole (the flag-raising coffin), hidden until used
  const flag = new THREE.Group(); flag.position.set(3.4, 0, -0.6); scene.add(flag);
  cyl(0.03, 0.03, 2.2, iron, 0, 1.1, 0, flag, 6); const fl = box(0.7, 0.42, 0.02, mat({ color: '#D8343F' }), 0.36, 1.9, 0, flag); flag.cloth = fl; flag.visible = false;
  return { scene, sun, bells, cut: { group: cut, coffin, lid, pipe, string, x: 0, z: 0 }, flag, lamps };
}

export function boxingRing(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1E2440');
  scene.fog = new THREE.Fog('#1E2440', 12, 40);
  const sun = sunlight(scene, E, { col: '#FFF2E0', i: 3.0, pos: [0, 10, 3], target: [0, 1, 0], box: 10, sky: '#7A88D8', ground: '#3A2A4A', hemi: 1.6 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat({ color: '#2A2A44', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const S = 5.2, top = 1.0;
  box(S + 0.6, top, S + 0.6, mat({ color: '#3C6FB6' }), 0, top / 2, 0, scene);
  box(S, 0.04, S, mat({ color: '#B8B4CC', roughness: 0.9 }), 0, top + 0.02, 0, scene);
  const cols = ['#D8343F', '#F4F4F8', '#3C6FB6'];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => { cyl(0.08, 0.08, 1.5, mat({ color: i % 2 ? '#D8343F' : '#3C6FB6' }), sx * S / 2, top + 0.75, sz * S / 2, scene, 10); });
  for (let k = 0; k < 3; k++) { const y = top + 0.45 + k * 0.38, m = mat({ color: cols[k] });
    box(S, 0.05, 0.05, m, 0, y, -S / 2, scene); box(S, 0.05, 0.05, m, 0, y, S / 2, scene); box(0.05, 0.05, S, m, -S / 2, y, 0, scene); box(0.05, 0.05, S, m, S / 2, y, 0, scene); }
  const spot = new THREE.SpotLight('#FFF4E0', 60, 20, 0.6, 0.5, 1.2); spot.position.set(0, 9, 2); spot.target.position.set(0, top, 0); spot.castShadow = true; scene.add(spot, spot.target);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; const c = box(0.5, 0.9 + rnd(k) * 0.3, 0.4, mat({ color: '#2E2E50' }), Math.cos(a) * 6.5, 0.5, Math.sin(a) * 6.5, scene); }
  // ringside bell on a little stand
  const bs = new THREE.Group(); bs.position.set(S / 2 + 0.8, 0, S / 2 + 0.4); scene.add(bs); box(0.6, 1.0, 0.5, mat({ color: '#6E4A30' }), 0, 0.5, 0, bs);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: '#F2C230', metalness: 0.6, roughness: 0.3, emissive: '#6A5010', emissiveIntensity: 0.3 })); bell.position.set(0, 1.02, 0); bell.castShadow = true; bs.add(bell);
  const sign = signBoard('ROUND 3', { w: 1.6, h: 0.5, bg: '#D8343F', fg: '#FFFFFF', font: 'Inter' }); sign.position.set(0, 4.2, -S / 2 - 0.6); scene.add(sign);
  return { scene, sun, bell, ring: { size: S, top } };
}
