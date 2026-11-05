// tokyo.js: rush-hour rail for Iron Canyon / Tall Tale shorts.
//   commuterCar({ body, stripe, old })  -> Group, 20 m long along x, side with 3 doors facing +z (platform side).
//        .setDoors(k) 0 closed .. 1 open  ·  .doorX = [-6, 0, 6] (local x of the door centres)
//   station(E, { era: 'tokyo' | 'ny' }) -> { scene, sun, cars[], train (Group), clock, update(t, { doorK, trainX }) }
//        platform floor y = 0 for z in [-1.55, 8]; car side wall at z = -1.75; people stand at z ~ -1.2 .. 2
//   crowdTex(key, seed, cols)  a painted "faces squashed against the glass" texture for windows
import * as THREE from 'three';
import { mat, canvasTex, sunlight, signBoard } from './world.js';
import { majSky } from './han.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 16) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const INK = '#1F1C33';

/** faces + shoulders crammed against a window: a painted texture, lit from inside */
export function crowdTex(key, seed = 1, { bg = '#FFD9A0', suits = ['#2E3A55', '#5A6478', '#3B4A6B', '#6B4A3A', '#2A3A6A', '#8A6AA8'], hats = false } = {}) {
  return canvasTex('crowd-' + key, 512, 256, (c, W, H) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(120,60,40,0.25)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 26; k++) {
      const x = (k % 13) * 42 + rnd(seed * 7 + k) * 18 - 6, y = k < 13 ? 150 + rnd(seed + k) * 20 : 95 + rnd(seed * 3 + k) * 25, r = 26 + rnd(seed * 5 + k) * 8;
      c.fillStyle = suits[Math.floor(rnd(seed * 11 + k) * suits.length)]; c.strokeStyle = INK; c.lineWidth = 4;
      c.beginPath(); c.ellipse(x, y + r * 2.1, r * 1.25, r * 1.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      const sq = 0.82 + rnd(seed * 13 + k) * 0.12;                           // squashed against the glass
      c.fillStyle = '#F7F7FA'; c.beginPath(); c.ellipse(x, y, r * 1.08, r * sq, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = INK; const m = rnd(seed * 17 + k);
      if (m < 0.35) { c.lineWidth = 3; [-1, 1].forEach((s) => { c.beginPath(); c.moveTo(x + s * 9 - 5, y - 3); c.lineTo(x + s * 9 + 5, y + 3); c.moveTo(x + s * 9 + 5, y - 3); c.lineTo(x + s * 9 - 5, y + 3); c.stroke(); }); }
      else [-1, 1].forEach((s) => { c.beginPath(); c.arc(x + s * 9, y - 2, 3.2, 0, 7); c.fill(); });
      c.beginPath(); if (m > 0.7) c.ellipse(x, y + 12, 5, 6, 0, 0, 7); else c.ellipse(x, y + 12, 7, 2, 0, 0, 7); c.fill();
      if (hats) { c.fillStyle = rnd(k * 9 + seed) > 0.5 ? '#2A2028' : '#C8A060'; c.beginPath(); c.ellipse(x, y - r * 0.8, r * 1.2, 7, 0, 0, 7); c.fill(); c.fillRect(x - r * 0.7, y - r * 1.35, r * 1.4, r * 0.55); }
    }
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(120, 0); c.lineTo(40, H); c.lineTo(-80, H); c.fill();
  });
}

export function commuterCar({ body = '#E9EEF2', stripe = '#F28C28', stripe2 = '#2E8B57', glass = '#24425A', old = false, seed = 1 } = {}) {
  const g = new THREE.Group(), L = 20, Z = -1.75, top = 3.0, bot = -0.75;
  const bm = mat({ color: body, roughness: old ? 0.7 : 0.35, metalness: old ? 0 : 0.35 });
  const sm = mat({ color: stripe, roughness: 0.5 }), s2 = mat({ color: stripe2, roughness: 0.5 }), dark = mat({ color: '#2A2A33', roughness: 0.6 });
  const doorX = [-6, 0, 6], dw = 1.3, dh = 2.05;
  // the side wall, built around the three door openings
  const spans = [[-L / 2, -6 - dw / 2], [-6 + dw / 2, -dw / 2], [dw / 2, 6 - dw / 2], [6 + dw / 2, L / 2]];
  const win = mat({ color: glass, roughness: 0.15, metalness: 0.2, map: crowdTex((old ? 'ny' : 'tk') + seed, seed, old ? { bg: '#FFC878', suits: ['#3A2A22', '#6B4A3A', '#2A3350', '#7A5A3A'], hats: true } : {}), emissive: '#FFE2B0', emissiveIntensity: 0.55 });
  win.emissiveMap = win.map;
  spans.forEach(([a, b], i) => {
    const w = b - a, cx = (a + b) / 2;
    box(w, 1.15 - bot, 0.06, bm, cx, (1.15 + bot) / 2, Z, g);                 // below the windows
    box(w, top - 2.25, 0.06, bm, cx, (top + 2.25) / 2, Z, g);                 // above the windows
    const nW = Math.max(1, Math.round(w / 1.6)), ww = w / nW;
    for (let k = 0; k < nW; k++) {
      const x0 = a + k * ww; box(0.12, 1.1, 0.07, bm, x0 + 0.06, 1.7, Z, g); box(0.12, 1.1, 0.07, bm, x0 + ww - 0.06, 1.7, Z, g);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.24, 1.1), win); p.position.set(x0 + ww / 2, 1.7, Z - 0.02); g.add(p);
      const tx = p.material.map; if (!p.userData.done) { p.userData.done = true; }
    }
  });
  // stripes
  spans.forEach(([a, b]) => { const w = b - a, cx = (a + b) / 2; box(w, 0.16, 0.07, sm, cx, 1.0, Z + 0.01, g); if (!old) box(w, 0.07, 0.07, s2, cx, 0.86, Z + 0.01, g); });
  box(L, 0.1, 0.07, sm, 0, 2.62, Z + 0.01, g);
  // door frames + the dark interior behind each door + door leaves (slide behind the wall)
  const leaves = [];
  doorX.forEach((x, i) => {
    box(0.08, dh + 0.1, 0.1, dark, x - dw / 2 - 0.02, dh / 2, Z, g); box(0.08, dh + 0.1, 0.1, dark, x + dw / 2 + 0.02, dh / 2, Z, g); box(dw + 0.12, 0.1, 0.1, dark, x, dh + 0.02, Z, g);
    box(dw + 0.12, 0.08, 0.1, mat({ color: '#B8B8C0' }), x, 0.0, Z + 0.02, g);
    box(dw + 0.12, top - dh - 0.07, 0.06, bm, x, (top + dh + 0.07) / 2, Z, g);                // wall above the door
    box(dw + 0.12, 0.75, 0.06, bm, x, bot / 2 - 0.0, Z, g);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(dw + 0.6, dh + 0.2), mat({ color: '#2E2430', map: crowdTex('door' + (old ? 'ny' : 'tk') + i + seed, seed * 3 + i, old ? { bg: '#E8A860', suits: ['#3A2A22', '#6B4A3A', '#2A3350'], hats: true } : { bg: '#C89A70' }), emissive: '#FFD8A0', emissiveIntensity: 0.45 }));
    inside.material.emissiveMap = inside.material.map; inside.position.set(x, dh / 2 + 0.05, Z - 1.0); g.add(inside);
    [-1, 1].forEach((s) => box(0.05, dh + 0.2, 1.0, mat({ color: '#5A4A58' }), x + s * (dw / 2 + 0.3), dh / 2, Z - 0.55, g));
    box(dw + 0.6, 0.05, 1.3, mat({ color: '#6A5A50' }), x, 0.02, Z - 0.6, g);                     // floor of the vestibule
    box(dw + 0.6, 0.05, 1.3, mat({ color: '#F4E8D0', emissive: '#FFF0D0', emissiveIntensity: 0.6 }), x, dh + 0.12, Z - 0.6, g); // ceiling light
    [-1, 1].forEach((s) => {
      const lf = new THREE.Group(); lf.position.set(x + s * dw / 4, 0, Z - 0.1); g.add(lf);
      box(dw / 2 - 0.02, dh, 0.05, bm, 0, dh / 2, 0, lf);
      const dwin = new THREE.Mesh(new THREE.PlaneGeometry(dw / 2 - 0.2, 0.9), win); dwin.position.set(0, 1.55, 0.03); lf.add(dwin);
      box(0.04, dh, 0.07, dark, -s * (dw / 4 - 0.03), dh / 2, 0, lf);
      leaves.push({ lf, x0: x + s * dw / 4, s });
    });
  });
  // the rest of the body: roof, back wall, ends, underframe, bogies
  box(L, top - bot, 0.06, bm, 0, (top + bot) / 2, Z - 2.9, g);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, L, 24, 1, false, 0.55, Math.PI - 1.1), mat({ color: old ? '#3A2A2A' : '#B8BEC6', roughness: 0.6, side: THREE.DoubleSide }));
  roof.rotation.z = Math.PI / 2; roof.position.set(0, top - 0.81, Z - 1.45); roof.castShadow = true; g.add(roof);
  [-1, 1].forEach((s) => box(0.08, top - bot, 2.95, bm, s * L / 2, (top + bot) / 2, Z - 1.45, g));
  box(L - 1, 0.35, 2.4, dark, 0, bot - 0.15, Z - 1.45, g);
  [-7, 7].forEach((x) => { box(2.6, 0.45, 2.2, mat({ color: '#25242B' }), x, bot - 0.45, Z - 1.45, g); [-0.8, 0.8].forEach((dx) => [-0.55, 0.55].forEach((dz) => { const w = cyl(0.42, 0.42, 0.12, mat({ color: '#3A3940', metalness: 0.5 }), x + dx, bot - 0.55, Z - 1.45 + dz, g, 16); w.rotation.x = Math.PI / 2; })); });
  if (old) { [-L / 2 + 0.2, L / 2 - 0.2].forEach((x) => box(0.06, 0.06, 0.06, mat({ color: '#E9B23C' }), x, 2.7, Z + 0.04, g)); }
  else { const pg = new THREE.Group(); g.add(pg); box(0.05, 0.9, 0.05, dark, 0, top + 0.45, Z - 1.45, pg); box(1.6, 0.05, 0.05, dark, 0, top + 0.9, Z - 1.45, pg); }
  g.doorX = doorX;
  g.setDoors = (k) => leaves.forEach(({ lf, x0, s }) => { lf.position.x = x0 + s * k * (dw / 2 + 0.02); });
  g.setDoors(0); return g;
}

/** Tokyo (morning, open-air platform under a canopy, skyline + sunrise) or New York (1918, underground, tiles + bulbs) */
export function station(E, { era = 'tokyo' } = {}) {
  const scene = new THREE.Scene(), ny = era === 'ny';
  let sun;
  if (!ny) {
    majSky(scene, { top: '#1E3E7A', mid: '#E58A9A', horizon: '#FFC46E', sunCol: '#FFE6A6', sunDir: [-0.55, 0.07, -1], glow: 1.1 });
    sun = sunlight(scene, E, { col: '#FFC890', i: 3.0, pos: [-14, 6, 6], target: [0, 1, 0], box: 16, sky: '#9FB8FF', ground: '#5A4A60', hemi: 1.05 });
    scene.fog = new THREE.Fog('#E0A0A8', 35, 230);
  } else {
    scene.background = new THREE.Color('#141A30');
    sun = sunlight(scene, E, { col: '#FFD49A', i: 3.2, pos: [3, 9, 7], target: [0, 1, -1], box: 16, sky: '#8A9AE0', ground: '#5A4A5A', hemi: 1.3 });
    scene.fog = new THREE.Fog('#2A3050', 20, 80);
  }
  // platform
  const fT = canvasTex(ny ? 'ny-floor' : 'tk-floor', 512, 512, (c, W, H) => { c.fillStyle = ny ? '#8A8278' : '#A8A6AE'; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 2200; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'; c.fillRect(rnd(k * 3) * W, rnd(k * 7) * H, 3, 3); }
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 3; for (let x = 0; x < W; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } }, [16, 4]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(90, 9.6), mat({ map: fT, roughness: 0.7 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, 3.25); fl.receiveShadow = true; scene.add(fl);
  box(90, 1.1, 0.3, mat({ color: ny ? '#6A6058' : '#8E8C96' }), 0, -0.55, -1.4, scene);
  if (!ny) { const yT = canvasTex('tactile', 256, 64, (c, W, H) => { c.fillStyle = '#F2C230'; c.fillRect(0, 0, W, H); c.fillStyle = '#D8A820'; for (let x = 6; x < W; x += 16) for (let y = 6; y < H; y += 16) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); } }, [60, 1]);
    const ys = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.32), mat({ map: yT })); ys.rotation.x = -Math.PI / 2; ys.position.set(0, 0.01, -0.95); ys.receiveShadow = true; scene.add(ys); }
  box(90, 0.06, 0.08, mat({ color: ny ? '#E8E0C8' : '#FFFFFF' }), 0, 0.02, -1.5, scene);
  // track bed + rails
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(90, 9), mat({ color: ny ? '#3A3230' : '#5A5250' })); bed.rotation.x = -Math.PI / 2; bed.position.set(0, -1.1, -5.5); bed.receiveShadow = true; scene.add(bed);
  [-2.65, -3.75].forEach((z) => box(90, 0.12, 0.08, mat({ color: '#8A8A90', metalness: 0.7, roughness: 0.3 }), 0, -1.0, z, scene));
  // cars (a 3-car train) on its own group so it can roll
  const train = new THREE.Group(); scene.add(train); const cars = [];
  for (let i = 0; i < 3; i++) { const c = commuterCar(ny ? { body: '#7A2E2A', stripe: '#E9C46A', stripe2: '#E9C46A', glass: '#3A2A22', old: true, seed: 10 + i } : { seed: 1 + i }); c.position.x = (i - 1) * 20.6; train.add(c); cars.push(c); }
  let clock = null;
  if (!ny) {
    // canopy, pillars, hanging lights + signs
    const cm = mat({ color: '#3E4A62', roughness: 0.6 }), pm = mat({ color: '#E8E4DC' });
    box(90, 0.25, 9.4, cm, 0, 4.4, 3.4, scene);
    for (let x = -38.5; x <= 42; x += 7) { cyl(0.16, 0.16, 4.4, pm, x, 2.2, 4.2, scene, 12); box(0.14, 0.14, 6, cm, x, 4.2, 3.0, scene); }
    for (let x = -42; x <= 42; x += 3.5) { const l = box(1.6, 0.08, 0.16, mat({ color: '#FFFFFF', emissive: '#FFF6E0', emissiveIntensity: 1.2 }), x, 4.18, 0.8, scene); l.castShadow = false; }
    [-10.5, 10.5].forEach((x) => { const s = signBoard('TOKYO', { w: 3.2, h: 0.55, bg: '#F4F2EC', fg: '#1F2A4A', font: 'Inter' }); s.position.set(x, 3.4, 0.9); scene.add(s); box(0.03, 0.5, 0.03, cm, x - 1.2, 3.95, 0.9, scene); box(0.03, 0.5, 0.03, cm, x + 1.2, 3.95, 0.9, scene); });
    // a platform clock on a pillar
    clock = new THREE.Group(); clock.position.set(3.5, 3.0, 4.0); scene.add(clock);
    const face = cyl(0.42, 0.42, 0.1, mat({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.3 }), 0, 0, 0.12, clock, 28); face.rotation.x = Math.PI / 2;
    const rim = cyl(0.46, 0.46, 0.08, mat({ color: '#2A2A33' }), 0, 0, 0.08, clock, 28); rim.rotation.x = Math.PI / 2;
    const hH = new THREE.Group(), mH = new THREE.Group(); hH.position.z = mH.position.z = 0.19; clock.add(hH, mH);
    box(0.05, 0.22, 0.02, mat({ color: INK }), 0, 0.1, 0, hH); box(0.035, 0.34, 0.02, mat({ color: INK }), 0, 0.16, 0, mH);
    clock.set = (hours) => { hH.rotation.z = -hours / 12 * Math.PI * 2; mH.rotation.z = -(hours % 1) * Math.PI * 2; }; clock.set(7.9);
    // the city beyond the tracks: sunlit towers with lit windows
    const wT = canvasTex('towerwin', 128, 256, (c, W, H) => { c.fillStyle = '#3A4A78'; c.fillRect(0, 0, W, H); for (let y = 8; y < H; y += 18) for (let x = 8; x < W; x += 20) { c.fillStyle = rnd(x * 3 + y) > 0.55 ? '#FFD890' : '#5A6A9A'; c.fillRect(x, y, 12, 10); } }, [2, 3]);
    for (let i = 0; i < 26; i++) { const h = 14 + rnd(i * 3) * 38, w = 8 + rnd(i * 5) * 10; const b = box(w, h, w, mat({ map: wT, color: new THREE.Color('#9AA8E0').offsetHSL((rnd(i) - 0.5) * 0.06, 0, (rnd(i * 7) - 0.5) * 0.15) }), -90 + i * 7 + rnd(i) * 5, h / 2 - 1, -40 - rnd(i * 9) * 50, scene); b.castShadow = false; }
    // a few cherry trees behind the far fence
    for (let i = 0; i < 6; i++) { const t = new THREE.Group(); cyl(0.12, 0.18, 2.2, mat({ color: '#6A4A3A' }), 0, 1.1, 0, t); const cr = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), mat({ color: '#FFB3CF', roughness: 0.9, flatShading: true })); cr.position.y = 2.9; cr.castShadow = true; t.add(cr); t.position.set(-20 + i * 8, -1.1, -9 - rnd(i) * 3); scene.add(t); }
  } else {
    // 1918 New York: tiled tunnel walls, cream + green tiles, steel columns, bare bulbs
    const tT = canvasTex('ny-tiles', 512, 512, (c, W, H) => { c.fillStyle = '#EDE6D2'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(120,110,90,0.35)'; c.lineWidth = 2; for (let y = 0; y < H; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } for (let y = 0; y < H; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < W; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); }
      c.fillStyle = '#2E7A5A'; c.fillRect(0, 300, W, 40); c.fillStyle = '#C8372E'; c.fillRect(0, 312, W, 16); c.fillStyle = '#2E7A5A'; c.fillRect(0, 470, W, H - 470); }, [10, 1]);
    box(90, 6.5, 0.3, mat({ map: tT, roughness: 0.4 }), 0, 2.15, -7.2, scene);
    box(90, 6.5, 0.3, mat({ map: tT, roughness: 0.4 }), 0, 2.15, 8.2, scene);
    box(90, 0.3, 16, mat({ color: '#2A2A38' }), 0, 5.2, 0.5, scene);
    const gm = mat({ color: '#2E6A4E', roughness: 0.5 });
    for (let x = -37.5; x <= 40; x += 5) { box(0.28, 5.2, 0.28, gm, x, 2.6, 2.6, scene); box(0.45, 0.2, 0.45, gm, x, 5.0, 2.6, scene); }
    for (let x = -40; x <= 40; x += 4) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat({ color: '#FFE6A0', emissive: '#FFD27A', emissiveIntensity: 2.0 })); b.position.set(x, 4.6, 0.6); scene.add(b); cyl(0.01, 0.01, 0.5, mat({ color: '#2A2028' }), x, 4.9, 0.6, scene, 6); }
    const s = signBoard('UPTOWN', { w: 2.6, h: 0.55, bg: '#2E5A44', fg: '#F2D37A' }); s.position.set(-6, 3.6, 2.42); scene.add(s);
    const s2 = signBoard('42 ST', { w: 1.8, h: 0.55, bg: '#2E5A44', fg: '#F2D37A' }); s2.position.set(8, 3.6, 2.42); scene.add(s2);
  }
  return { scene, sun, cars, train, clock, update: (t, { doorK = 0, trainX = 0 } = {}) => { train.position.x = trainX; cars.forEach((c) => c.setDoors(doorK)); } };
}
