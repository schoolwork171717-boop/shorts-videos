// han.js: a majestic Han-dynasty China built in 3D for Tall Tale / Iron Canyon shorts.
//   majSky(scene, { top, mid, horizon, sunDir, sunCol, glow })  3-stop gradient sky with a glowing sun (no texture)
//   peaks(scene, { z, n, seed, col, h, spread, x })              a row of misty karst mountains (layer several)
//   curvedRoof(w, d, h, col)                                     swept roof with upturned corners
//   palace({ w, d, h, roofCol, wallCol, colCol })                a hall on a stone platform with steps, columns, two roofs
//   lantern(col, light)  · banner(col, emblem) (.update(t))  · plumTree(s)  · house(col)  · stoneFloor(w, d)
//   jar()  -> { group, update(t, state) }   Zhang Heng's bronze jar: 8 dragons with balls, 8 toads
//        state = { drop: i, k: 0..1 (ball fall), shake: 0..1, glow: 0..1, swing: radians }
//   court(E, { time })     a palace courtyard: 'gold' (sunset), 'day', 'night'
//   jarHall(E)             the great hall: columns, lacquer, lanterns, window light, the jar on a round dais
//   westLand(E)            the far west: dusty mountains, a village (houses[] can shake), a road
import * as THREE from 'three';
import { mat, canvasTex, sunlight, clouds } from './world.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, parent, seg = 18) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };
const sph = (r, m, x = 0, y = 0, z = 0, parent, sx = 1, sy = 1, sz = 1) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.castShadow = true; if (parent) parent.add(b); return b; };

export const HAN = { red: '#C8372E', lacquer: '#9E2420', gold: '#E9B23C', jade: '#3FA58C', ink: '#1F1C33', stone: '#C9BBA6', wood: '#7A4A2E', bronze: '#C08A3E', patina: '#5FA38C', roof: '#2F5F7A' };

export function majSky(scene, { top = '#2C3E9E', mid = '#C25B9E', horizon = '#FFB45C', sunDir = [0.2, 0.18, -1], sunCol = '#FFE6A6', glow = 1.0, r = 420 } = {}) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { cT: { value: new THREE.Color(top) }, cM: { value: new THREE.Color(mid) }, cH: { value: new THREE.Color(horizon) }, sd: { value: new THREE.Vector3(...sunDir).normalize() }, sc: { value: new THREE.Color(sunCol) }, gl: { value: glow } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 cT, cM, cH, sc, sd; uniform float gl; varying vec3 vP;
      void main(){ float y = max(vP.y, -0.05); vec3 c = mix(cH, cM, smoothstep(0.0, 0.22, y)); c = mix(c, cT, smoothstep(0.18, 0.7, y));
        float d = max(dot(normalize(vP), sd), 0.0); c += sc * (pow(d, 900.0) * 3.0 + pow(d, 40.0) * 0.55 + pow(d, 6.0) * 0.25) * gl;
        gl_FragColor = vec4(c, 1.0); }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24), m); s.renderOrder = -10; scene.add(s); return s;
}

/** misty karst peaks: rounded towers with a lighter top, fading with distance (use scene fog) */
export function peaks(scene, { z = -160, n = 9, seed = 1, col = '#5E6FB8', h = 60, spread = 320, x = 0, width = 26 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  for (let i = 0; i < n; i++) {
    const hh = h * (0.55 + rnd(seed * 31 + i) * 0.7), w = width * (0.7 + rnd(seed * 17 + i) * 0.6), pts = [];
    for (let k = 0; k <= 12; k++) { const f = k / 12; pts.push(new THREE.Vector2(w * (1 - Math.pow(f, 2.4)) * (0.9 + 0.1 * Math.sin(f * 9 + i)), f * hh)); }
    const geo = new THREE.LatheGeometry(pts, 14); const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setX(k, p.getX(k) * (1 + (rnd(k + i * 99) - 0.5) * 0.12)); p.setZ(k, p.getZ(k) * (1 + (rnd(k * 3 + i) - 0.5) * 0.12)); }
    geo.computeVertexNormals();
    const c = new THREE.Color(col).offsetHSL((rnd(i) - 0.5) * 0.04, 0, (rnd(i * 5) - 0.5) * 0.08);
    const m = new THREE.Mesh(geo, mat({ color: c, roughness: 1, flatShading: true }));
    m.position.set(x + (i / Math.max(1, n - 1) - 0.5) * spread + (rnd(seed + i * 7) - 0.5) * 20, -2, z + (rnd(seed * 3 + i) - 0.5) * 40); g.add(m);
  }
  return g;
}

/** swept Chinese roof along x (w wide, d deep, h tall) with upturned corners and ridge ends */
export function curvedRoof(w = 10, d = 6, h = 2.2, col = HAN.roof) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w * 1.12, d * 1.25, 40, 20); const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), u = Math.abs(y) / (d * 0.625), v = Math.abs(x) / (w * 0.56);
    const z = h * (1 - Math.pow(u, 0.75)) + 0.55 * Math.pow(v, 5) * (0.6 + u) + 0.35 * Math.pow(u, 6) * (0.4 + v);
    p.setXYZ(i, x, z, y);
  }
  geo.computeVertexNormals();
  const tiles = canvasTex('tiles' + col, 256, 256, (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); for (let k = 0; k < 8; k++) { c.fillStyle = new THREE.Color(col).multiplyScalar(0.72).getStyle(); c.fillRect(k * 32, 0, 6, H); c.fillStyle = new THREE.Color(col).multiplyScalar(1.25).getStyle(); c.fillRect(k * 32 + 10, 0, 8, H); } }, [w / 1.5, d / 1.5]);
  const m = new THREE.Mesh(geo, mat({ map: tiles, side: THREE.DoubleSide, roughness: 0.6 })); m.castShadow = m.receiveShadow = true; g.add(m);
  const ridge = box(w * 0.98, 0.3, 0.3, mat({ color: new THREE.Color(col).multiplyScalar(0.7) }), 0, h + 0.1, 0, g);
  [-1, 1].forEach((s) => { const e = box(0.4, 0.8, 0.4, mat({ color: HAN.gold, roughness: 0.4 }), s * w * 0.49, h + 0.45, 0, g); e.rotation.z = s * 0.3; });
  return g;
}

export function stoneFloor(w = 40, d = 40, col = HAN.stone) {
  const t = canvasTex('flag' + col, 512, 512, (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const cc = new THREE.Color(col).offsetHSL(0, 0, (rnd(x * 8 + y) - 0.5) * 0.08); c.fillStyle = cc.getStyle(); c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } }, [w / 4, d / 4]);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat({ map: t, roughness: 0.85 })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; return f;
}

export function lantern(col = HAN.red, light = false) {
  const g = new THREE.Group();
  const body = sph(0.32, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.7 }), 0, 0, 0, g, 1, 1.15, 1); body.userData.noCel = true;
  cyl(0.18, 0.18, 0.08, mat({ color: HAN.gold }), 0, 0.38, 0, g); cyl(0.18, 0.18, 0.08, mat({ color: HAN.gold }), 0, -0.38, 0, g);
  cyl(0.02, 0.02, 0.4, mat({ color: HAN.gold }), 0, -0.6, 0, g);
  if (light) { const L = new THREE.PointLight('#FFB070', 3, 7, 1.5); g.add(L); g.userData.light = L; }
  return g;
}

export function banner(col = HAN.red, emblem = '#E9B23C') {
  const tex = canvasTex('ban' + col + emblem, 128, 512, (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = emblem; c.fillRect(8, 8, W - 16, 10); c.fillRect(8, H - 30, W - 16, 10); c.beginPath(); c.arc(W / 2, H * 0.4, 34, 0, 7); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(W / 2, H * 0.4, 22, 0, 7); c.fill(); });
  const geo = new THREE.PlaneGeometry(0.9, 3.4, 6, 12); const base = geo.attributes.position.array.slice();
  const m = new THREE.Mesh(geo, mat({ map: tex, side: THREE.DoubleSide })); m.castShadow = true;
  const g = new THREE.Group(); const pole = cyl(0.05, 0.05, 5.4, mat({ color: HAN.wood }), -0.5, 2.7, 0, g); m.position.set(0, 3.5, 0); g.add(m);
  g.update = (t) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; p.setZ(i, Math.sin(t * 3 + y * 1.6 + x * 2) * 0.12 * (x + 0.45)); } p.needsUpdate = true; geo.computeVertexNormals(); };
  return g;
}

export function plumTree(s = 1) {
  const g = new THREE.Group(), bark = mat({ color: '#5A3A2E' }), bloom = mat({ color: '#FF8FB8', roughness: 0.8 }), bloom2 = mat({ color: '#FFC1D9' });
  const tr = cyl(0.12 * s, 0.2 * s, 2.2 * s, bark, 0, 1.1 * s, 0, g); tr.rotation.z = 0.08;
  for (let i = 0; i < 9; i++) sph((0.6 + rnd(i) * 0.4) * s, i % 3 ? bloom : bloom2, (rnd(i * 3) - 0.5) * 2 * s, (2.2 + rnd(i * 5) * 1.2) * s, (rnd(i * 7) - 0.5) * 1.6 * s, g);
  return g;
}

export function house(col = '#C9A27A', roofCol = '#6B4A30') {
  const g = new THREE.Group(); box(3, 2.2, 2.4, mat({ color: col }), 0, 1.1, 0, g);
  const r = curvedRoof(3.4, 2.6, 0.9, roofCol); r.position.y = 2.2; g.add(r);
  box(0.7, 1.3, 0.05, mat({ color: '#3A2620' }), 0, 0.65, 1.21, g); return g;
}

/** a Han hall on a stone platform: steps in front (+z), red columns, lattice walls, a double swept roof */
export function palace({ w = 16, d = 9, h = 5, roofCol = HAN.roof, wallCol = '#E8D2B0', colCol = HAN.red } = {}) {
  const g = new THREE.Group(), stone = mat({ color: '#D8CBB4' });
  box(w + 3, 1.2, d + 3, stone, 0, 0.6, 0, g);
  for (let k = 0; k < 5; k++) box(w * 0.4, 0.24, 0.5, stone, 0, 0.12 + k * 0.24, d / 2 + 1.5 + 2.5 - k * 0.5, g);
  const lat = canvasTex('lattice' + wallCol, 256, 256, (c, W, H) => { c.fillStyle = '#5A2A22'; c.fillRect(0, 0, W, H); c.fillStyle = wallCol; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c.fillRect(x * 32 + 4, y * 32 + 4, 24, 24); c.strokeStyle = '#5A2A22'; c.lineWidth = 6; c.strokeRect(0, 0, W, H); });
  box(w - 1, h - 0.6, 0.2, mat({ map: lat, emissive: '#FFC070', emissiveIntensity: 0.18 }), 0, 1.2 + (h - 0.6) / 2, d / 2 - 1.2, g);
  box(w - 1, h - 0.6, d - 2.5, mat({ color: '#7A3A2E' }), 0, 1.2 + (h - 0.6) / 2, -0.2, g);
  const cm = mat({ color: colCol, roughness: 0.5 });
  for (let i = 0; i < 6; i++) cyl(0.3, 0.34, h, cm, -w / 2 + 0.8 + i * (w - 1.6) / 5, 1.2 + h / 2, d / 2 - 0.4, g);
  box(w + 0.6, 0.6, 0.5, mat({ color: HAN.jade }), 0, 1.2 + h - 0.1, d / 2 - 0.4, g);
  box(w + 0.6, 0.25, 0.55, mat({ color: HAN.gold }), 0, 1.2 + h - 0.5, d / 2 - 0.4, g);
  const r1 = curvedRoof(w + 3, d + 3, 2.4, roofCol); r1.position.y = 1.2 + h + 0.2; g.add(r1);
  box(w * 0.7, 1.4, d * 0.6, mat({ color: '#7A3A2E' }), 0, 1.2 + h + 2.5, 0, g);
  const r2 = curvedRoof(w * 0.8, d * 0.75, 2.0, roofCol); r2.position.y = 1.2 + h + 3.1; g.add(r2);
  return g;
}

/** Zhang Heng's seismoscope: a bronze wine-jar shape ~1.9 m across, 8 dragons around the top, 8 toads round the base */
export function jar() {
  const g = new THREE.Group(), br = mat({ color: '#B98E52', roughness: 0.35, metalness: 0.45 }), pat = mat({ color: HAN.patina, roughness: 0.6 }), goldM = mat({ color: '#FFD15C', roughness: 0.25, metalness: 0.5, emissive: '#7A4A10', emissiveIntensity: 0.25 });
  const prof = [[0, 0], [0.62, 0], [0.7, 0.12], [0.62, 0.3], [0.86, 0.75], [0.98, 1.2], [0.95, 1.6], [0.8, 1.9], [0.72, 2.0], [0.78, 2.12], [0.5, 2.25], [0.2, 2.42], [0.12, 2.55], [0, 2.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), br); body.castShadow = body.receiveShadow = true; g.add(body);
  [0.32, 1.95].forEach((y) => { const band = new THREE.Mesh(new THREE.TorusGeometry(y < 1 ? 0.64 : 0.76, 0.05, 8, 40), pat); band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band); });
  const knob = sph(0.14, goldM, 0, 2.66, 0, g);
  const dragons = [], toads = [], balls = [], mouths = [], toadMouths = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, dir = V3(Math.sin(a), 0, Math.cos(a));
    const dg = new THREE.Group(); dg.rotation.y = a; g.add(dg);
    // body: a tube snaking from the shoulder down the side and out to the head
    const curve = new THREE.CatmullRomCurve3([V3(0.2, 2.3, 0.62), V3(0.5, 2.1, 0.86), V3(-0.2, 1.85, 0.98), V3(0.15, 1.62, 1.02), V3(0, 1.52, 1.2)]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.085, 8), pat); tube.castShadow = true; dg.add(tube);
    const head = new THREE.Group(); head.position.set(0, 1.5, 1.24); dg.add(head);
    sph(0.15, pat, 0, 0.02, 0, head, 1, 0.9, 1.15);
    box(0.18, 0.08, 0.26, pat, 0, 0.06, 0.18, head);                                         // upper snout
    const jaw = box(0.16, 0.05, 0.22, pat, 0, -0.06, 0.15, head); jaw.rotation.x = 0.35;      // lower jaw
    [-1, 1].forEach((s) => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 6), goldM); h.position.set(s * 0.07, 0.2, -0.05); h.rotation.x = -0.6; head.add(h); sph(0.035, mat({ color: '#FFF4D0' }), s * 0.08, 0.1, 0.1, head); });
    const ball = sph(0.075, goldM, 0, -0.02, 0.3, head); balls.push(ball);
    mouths.push(() => { const p = V3(); ball.getWorldPosition(p); return p; });
    // toad under the dragon, mouth up
    const tg = new THREE.Group(); tg.position.copy(dir.clone().multiplyScalar(1.42)); tg.rotation.y = a; g.add(tg);
    const tb = mat({ color: '#8E5E2E', roughness: 0.4, metalness: 0.4 }); sph(0.3, tb, 0, 0.2, 0, tg, 1.05, 0.72, 1.1); [-1, 1].forEach((s) => { sph(0.08, tb, s * 0.15, 0.42, 0.08, tg); sph(0.04, mat({ color: '#1F1C33' }), s * 0.16, 0.46, 0.13, tg); sph(0.1, tb, s * 0.26, 0.06, 0.14, tg, 1, 0.5, 1.4); });
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.11, 18), mat({ color: '#2A1A14' })); mouth.position.set(0, 0.42, 0.18); mouth.rotation.x = -1.1; tg.add(mouth);
    toads.push(tg); toadMouths.push(() => { const p = V3(); mouth.getWorldPosition(p); return p; }); dragons.push({ group: dg, head, jaw, ball });
  }
  // the pendulum inside (seen in the cut-away)
  const pend = new THREE.Group(); pend.position.y = 2.2; g.add(pend);
  cyl(0.02, 0.02, 1.6, mat({ color: '#6E5A40' }), 0, -0.8, 0, pend); sph(0.18, mat({ color: '#6E5A40' }), 0, -1.65, 0, pend); pend.visible = false;
  const home = balls.map((b) => b.position.clone());
  const up = (t, st = {}) => {
    balls.forEach((b, i) => { b.visible = true; b.position.copy(home[i]); b.parent !== dragons[i].head && dragons[i].head.add(b); dragons[i].jaw.rotation.x = 0.35; });
    if (st.drop != null) {
      const i = st.drop, k = st.k || 0, d = dragons[i];
      d.jaw.rotation.x = 0.35 + Math.min(1, k * 4) * 0.5;
      if (k > 0) { const a = mouths[i](), bq = toadMouths[i](); const b = balls[i]; g.attach(b); const p = a.clone().lerp(bq, k); p.y = a.y + (bq.y - a.y) * k * k; g.worldToLocal(p); b.position.copy(p); if (k >= 1) b.position.y -= 0.04; }
    }
    pend.visible = !!st.inside; pend.rotation.z = st.swing || 0;
    g.rotation.z = (st.shake || 0) * Math.sin(t * 60) * 0.01;
    body.material.emissive = new THREE.Color('#FFE0A0'); body.material.emissiveIntensity = (st.glow || 0) * 0.12;
  };
  return { group: g, body, dragons, toads, balls, mouthAt: mouths, toadAt: toadMouths, update: up, pend };
}

function stdLights(scene, E, opt) { return sunlight(scene, E, opt); }

export function court(E, { time = 'gold' } = {}) {
  const scene = new THREE.Scene();
  const P = { gold: { top: '#3348B0', mid: '#E0709E', horizon: '#FFC06A', sun: '#FFE2A0', key: '#FFC48A', i: 3.2, pos: [-14, 9, 6], sky: '#FFB6D0', gnd: '#B0704A', fog: '#E8A0A8', peak: '#8A6FC0' },
    day: { top: '#2E7BE6', mid: '#7FC0F2', horizon: '#E8F4FF', sun: '#FFFFFF', key: '#FFF2DA', i: 3.0, pos: [-10, 16, 8], sky: '#CFE6FF', gnd: '#C49A6A', fog: '#C8DDF2', peak: '#6F8FC8' },
    night: { top: '#120E3A', mid: '#3A2A7A', horizon: '#8A5AB0', sun: '#E6E8FF', key: '#9DA8FF', i: 1.2, pos: [10, 14, -6], sky: '#5A4AA8', gnd: '#2A2040', fog: '#3A2E6A', peak: '#3A3280' } }[time];
  majSky(scene, { top: P.top, mid: P.mid, horizon: P.horizon, sunCol: P.sun, sunDir: time === 'night' ? [0.45, 0.35, -1] : [0.25, 0.12, -1], glow: time === 'night' ? 0.6 : 1 });
  const sun = stdLights(scene, E, { col: P.key, i: P.i, pos: P.pos, target: [0, 0, 0], box: 16, sky: P.sky, ground: P.gnd, hemi: time === 'night' ? 0.7 : 1.2 });
  scene.fog = new THREE.Fog(P.fog, 40, 300);
  peaks(scene, { z: -230, n: 11, seed: 3, col: P.peak, h: 90, spread: 520 }); peaks(scene, { z: -150, n: 9, seed: 7, col: new THREE.Color(P.peak).offsetHSL(0, 0, -0.08).getStyle(), h: 55, spread: 380 });
  clouds(scene, [[-60, 50, -200, 30], [70, 62, -240, 40], [10, 40, -180, 22]], time === 'gold' ? '#FFD0C0' : time === 'night' ? '#8A7AC8' : '#FFFFFF');
  const fl = stoneFloor(80, 80); scene.add(fl);
  const pal = palace({ w: 18, d: 9, h: 5 }); pal.position.set(0, 0, -14); scene.add(pal);
  const lights = [];
  [-7, -3.5, 3.5, 7].forEach((x, i) => { const l = lantern(HAN.red, i === 1 || i === 2); l.position.set(x, 4.6, -8.6); scene.add(l); lights.push(l); });
  const flags = []; [[-10, -4], [10, -4], [-10, 4], [10, 4]].forEach(([x, z], i) => { const b = banner(i % 2 ? HAN.jade : HAN.red); b.position.set(x, 0, z); scene.add(b); flags.push(b); });
  [[-14, -8], [14, -8], [-16, 2]].forEach(([x, z], i) => { const t = plumTree(1.2); t.position.set(x, 0, z); scene.add(t); });
  return { scene, sun, palace: pal, flags, lanterns: lights, update: (t) => flags.forEach((f) => f.update(t)) };
}

export function jarHall(E) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#16123A');
  const sun = stdLights(scene, E, { col: '#FFD9A8', i: 2.6, pos: [-6, 9, 7], target: [0, 1, 0], box: 12, sky: '#8FA2FF', ground: '#3A2A6A', hemi: 1.0 });
  scene.fog = new THREE.Fog('#241E52', 18, 60);
  const floorT = canvasTex('hallfloor', 512, 512, (c, W, H) => { c.fillStyle = '#26285E'; c.fillRect(0, 0, W, H); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#2F3274' : '#242660'; c.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } }, [6, 6]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat({ map: floorT, roughness: 0.35 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const dais = cyl(2.4, 2.6, 0.35, mat({ color: '#ECE6F6' }), 0, 0.175, 0, scene, 40); const dais2 = cyl(2.0, 2.0, 0.08, mat({ color: HAN.gold }), 0, 0.39, 0, scene, 40);
  const cm = mat({ color: HAN.red, roughness: 0.45 }), gm = mat({ color: HAN.gold, roughness: 0.4 });
  [[-5, -4], [5, -4], [-5, 3], [5, 3], [-5, -10], [5, -10]].forEach(([x, z]) => { cyl(0.38, 0.42, 9, cm, x, 4.5, z, scene); cyl(0.5, 0.5, 0.4, gm, x, 0.2, z, scene); cyl(0.48, 0.48, 0.3, gm, x, 8.7, z, scene); });
  box(14, 0.6, 0.7, mat({ color: HAN.jade }), 0, 8.6, -4, scene); box(14, 0.6, 0.7, mat({ color: HAN.jade }), 0, 8.6, 3, scene); box(14, 0.25, 0.75, gm, 0, 8.15, -4, scene);
  const lat = canvasTex('hall-lat', 256, 256, (c, W, H) => { c.fillStyle = '#1E2A4A'; c.fillRect(0, 0, W, H); c.fillStyle = '#FFE2A8'; for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) c.fillRect(x * 43 + 6, y * 43 + 6, 31, 31); });
  const back = box(20, 10, 0.3, mat({ map: lat, emissive: '#FFD8A0', emissiveIntensity: 0.25 }), 0, 5, -12, scene); back.material.userData = {};
  [-10, 10].forEach((x) => box(0.3, 10, 26, mat({ color: '#1E5A5A' }), x, 5, -1, scene));
  const lights = []; [[-3, 6.4, -2], [3, 6.4, -2], [-3, 6.4, 2.5], [3, 6.4, 2.5]].forEach(([x, y, z], i) => { const l = lantern(i % 2 ? '#E8533A' : HAN.red, i < 2); l.position.set(x, y, z); scene.add(l); cyl(0.01, 0.01, 2.3, mat({ color: '#2A1A14' }), x, y + 1.5, z, scene); lights.push(l); });
  const J = jar(); J.group.position.y = 0.43; scene.add(J.group);
  return { scene, sun, jar: J, lanterns: lights };
}

export function westLand(E) {
  const scene = new THREE.Scene();
  majSky(scene, { top: '#24307E', mid: '#B4609E', horizon: '#FFC27A', sunCol: '#FFE6A6', sunDir: [-0.4, 0.1, -1] });
  const sun = stdLights(scene, E, { col: '#FFD6C0', i: 3.0, pos: [-12, 8, 4], target: [0, 0, 0], box: 16, sky: '#FFC0A0', ground: '#A0603A', hemi: 1.1 });
  scene.fog = new THREE.Fog('#B08AC0', 30, 260);
  peaks(scene, { z: -150, n: 9, seed: 11, col: '#6A5AA8', h: 70, spread: 420, width: 34 }); peaks(scene, { z: -90, n: 7, seed: 13, col: '#7A5A9A', h: 40, spread: 260, width: 26 });
  const gt = canvasTex('dust', 512, 512, (c, W, H) => { c.fillStyle = '#B4927E'; c.fillRect(0, 0, W, H); for (let k = 0; k < 3000; k++) { c.fillStyle = rnd(k) > 0.5 ? 'rgba(255,230,180,0.3)' : 'rgba(120,60,30,0.2)'; c.fillRect(rnd(k * 3) * W, rnd(k * 7) * H, 3, 3); } }, [20, 20]);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat({ map: gt })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  const houses = []; [[-6, -6, 0.3], [-1.5, -9, -0.1], [3.5, -6.5, 0.2], [8, -10, -0.3], [-9, -12, 0.1], [1, -14, 0]].forEach(([x, z, r], i) => { const h = house(i % 2 ? '#E2C08E' : '#D2A878', i % 3 ? '#7A4A30' : '#5E6F8A'); h.position.set(x, 0, z); h.rotation.y = r; scene.add(h); houses.push(h); });
  return { scene, sun, houses };
}
