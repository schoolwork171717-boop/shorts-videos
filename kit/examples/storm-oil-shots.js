// WHY SAILORS POURED OIL ON STORM WAVES — kit v9.1: a stormy sea with a little sailing ship (live ocean mesh whose
// chop and whitecaps die in a growing calm ring), a sunny park pond for the teaspoon trick, an icy lot for the analogy.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
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
  captain: { body: '#2E4A7A', pattern: 'jacket', patCol: '#24406C', hat: 'official', hatCol: '#1E2A44', band: '#F2C230', extra: ['beard'], beardCol: '#E8E8EE', neck: 'collar' },
  rookie: { body: '#F4F4F8', pattern: 'stripes', patCol: '#3C6FB6', hat: 'beanie', hatCol: '#D8343F', extra: ['freckles'], hair: '#C8783A' },
  crew: { body: '#E2B33C', pattern: 'overalls', patCol: '#C89A2E', hat: 'cap', hatCol: '#3C6FB6', extra: ['mustache'], mustacheCol: '#5A3A22' },
  inventor: { body: '#7A3A5A', pattern: 'vest', patCol: '#5E2A44', hat: 'tophat', hatCol: '#2A2830', extra: ['glasses'], neck: 'bowtie', hair: '#D8D8DE' },
  lady: { body: '#7FBF7A', pattern: 'plain', hat: 'flower', hatCol: '#F29BB5', extra: ['blush'] },
  gent: { body: '#C8783A', pattern: 'check', patCol: '#A85E2A', hat: 'bowler', hatCol: '#3A2E28', extra: ['mustache'], mustacheCol: '#3A2A1A' },
  pusher: { body: '#D8343F', pattern: 'jacket', patCol: '#A82A30', hat: 'beanie', hatCol: '#F2C230', neck: 'scarf', neckCol: '#3C6FB6' },
};
// hand props drawn into the cut-out
const sack = (g, x, y) => { g.save(); g.translate(x, y + 30); g.fillStyle = '#E8D9B4'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(-34, -30); g.quadraticCurveTo(-48, 50, 0, 58); g.quadraticCurveTo(48, 50, 34, -30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#7A5A2A'; [[-12, 10], [10, 24], [-4, 38], [16, 0]].forEach(([a, b]) => { g.beginPath(); g.arc(a, b, 4, 0, 7); g.fill(); }); g.fillStyle = '#F2C230'; g.beginPath(); g.ellipse(-10, 66, 5, 8, 0, 0, 7); g.fill(); g.restore(); };
const cane = (g, x, y) => { g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 190); g.stroke(); g.strokeStyle = '#B88A4A'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, -40); g.lineTo(0, 190); g.stroke();
  g.fillStyle = '#F2C230'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.arc(0, -46, 12, 0, 7); g.fill(); g.stroke(); g.restore(); };
const caneTop = (g, x, y) => { g.save(); g.translate(x, y); g.rotate(2.2); g.fillStyle = '#B88A4A'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.rect(-8, -50, 16, 60); g.fill(); g.stroke(); g.fillStyle = '#F2C230'; g.beginPath(); g.arc(0, -56, 12, 0, 7); g.fill(); g.stroke(); g.restore(); };
const bottle = (g, x, y) => { g.save(); g.translate(x, y - 10); g.fillStyle = '#F2D86A'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(-22, 80); g.lineTo(-22, 0); g.quadraticCurveTo(-22, -20, -9, -30); g.lineTo(-9, -60); g.lineTo(9, -60); g.lineTo(9, -30); g.quadraticCurveTo(22, -20, 22, 0); g.lineTo(22, 80); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.fillRect(-20, 14, 40, 40); g.strokeRect(-20, 14, 40, 40); g.fillStyle = '#3E8A5A'; g.font = '900 13px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('SALAD', 0, 31); g.fillText('OIL', 0, 47); g.fillStyle = '#D8343F'; g.fillRect(-11, -70, 22, 12); g.restore(); };
const bucket = (g, x, y) => { g.save(); g.translate(x, y + 10); g.rotate(-0.9); g.fillStyle = '#9AA3AE'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(-36, -10); g.lineTo(36, -10); g.lineTo(28, 60); g.lineTo(-28, 60); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#F2C230'; g.beginPath(); g.ellipse(0, -10, 36, 9, 0, 0, 7); g.fill(); g.stroke(); g.restore(); };

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; CUR = o.id; FF = null; f(lt, d, t, blit); FX.motes(t, { n: 14, col: '255,250,235', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.16, bloomThreshold: 0.96, aperture: 0.0016, maxblur: 0.009 };
  let EXTRAS = [];
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.position.lerp(V3(...c.look), 0.12 * clamp((50 - c.fov) / 6));   // v9.2: continuous push-in (the old 38-44 on/off switch made the camera jump)
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); A.frameFix(cam, FF || all.filter((q) => q.group.parent === scene), { t: NOW, key: CUR, extras: FF ? [] : EXTRAS.filter((o) => o.parent && rootOf(o) === scene) }); all.forEach((q) => q.face(cam));
    E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
  };
  const rootOf = (o) => { while (o.parent) o = o.parent; return o; };
  const act = (p, x, z, o = {}, y = 0, k = 1) => {
    const al = A.alive(NOW, p.seed, 1), pf = A.perform(NOW, p.seed, o.energy ?? k, { talk: o.talk ?? 1 });
    p.group.visible = true; p.at(x + (o.still ? 0 : pf.dx) + (o.dx || 0), y + (o.hopY || 0), z);
    const st = { look: al.look, blink: al.blink, ...pf, tilt: pf.tilt + al.tilt, ...o }; delete st.dx; delete st.hopY; delete st.energy; delete st.still;
    Object.keys(st).forEach((k2) => st[k2] === undefined && delete st[k2]);
    if (st.steam) st.steamT = NOW; p.set(st); A.applySquash(p, st.squash || 0);
  };
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });
  const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const cyl = (r1, r2, h, m, x, y, z, parent, seg = 12) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const proj = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * CW, (1 - p.y) / 2 * CH]; };

  // ═════ SET 1: storm sea + ship ═════
  const SEA = new THREE.Scene(); const skyM = WD.sky(SEA, { top: '#5A78A6', horizon: '#C4D2E2' });
  const sun = WD.sunlight(SEA, E, { col: '#F2F0FF', i: 2.4, pos: [-6, 14, 8], target: [0, 1, 0], box: 12, sky: '#C6D6EE', ground: '#4A6A86', hemi: 1.5 });
  CY.haze(SEA, { col: '#B8C6DA', near: 40, far: 170, floorY: -3 });
  WD.clouds(SEA, [[-40, 26, -120, 30], [30, 30, -140, 36], [90, 24, -100, 24], [-100, 28, -80, 26], [0, 34, 120, 34]], '#D6DEEA');
  // live ocean
  const OG = new THREE.PlaneGeometry(150, 150, 150, 150); OG.rotateX(-Math.PI / 2);
  const OP = OG.attributes.position, OB = Float32Array.from(OP.array), OC = new Float32Array(OP.count * 3); OG.setAttribute('color', new THREE.BufferAttribute(OC, 3));
  const oM = WD.mat({ color: '#FFFFFF', vertexColors: true, roughness: 0.35 }); oM.userData.keepPBR = true; const ocean = new THREE.Mesh(OG, oM); ocean.receiveShadow = true; SEA.add(ocean);
  const deep = new THREE.Color('#2F7FB8'), lite = new THREE.Color('#5FB0DE'), foam = new THREE.Color('#F2FAFF'), tc = new THREE.Color();
  const swell = (x, z, t) => 0.95 * Math.sin(0.40 * x + 0.9 * t) + 0.55 * Math.sin(0.29 * z - 0.75 * t + 1.3) + 0.35 * Math.sin(0.22 * (x + z) + 1.15 * t);
  const chopF = (x, z, t) => 0.30 * Math.sin(1.7 * x + 2.6 * t) * Math.sin(1.5 * z - 2.0 * t) + 0.18 * Math.sin(2.9 * x - 1.3 * z + 3.3 * t) + 0.1 * Math.sin(4.3 * z + 1.1 * x - 4 * t);
  let lastSea = -1;
  const sea = (t, R, k = 1) => {           // R: radius of the calm ring around the ship (m), k: how calm inside it
    if (t === lastSea) return; lastSea = t;
    for (let i = 0; i < OP.count; i++) { const x = OB[i * 3], z = OB[i * 3 + 2], r = Math.hypot(x, z), c = k * (1 - clamp((r - R + 6) / 6));
      const ch = chopF(x, z, t) * (1 - 0.92 * c), sw = swell(x, z, t), y = sw + ch; OP.setY(i, y);
      const crest = clamp((ch - 0.17) / 0.12) * (1 - c) * clamp((sw + 0.4) / 1.2);
      tc.copy(deep).lerp(lite, clamp((sw + 1.4) / 3.2)); if (c > 0) tc.lerp(new THREE.Color('#79C4EA'), c * 0.35); tc.lerp(foam, crest);
      OC[i * 3] = tc.r; OC[i * 3 + 1] = tc.g; OC[i * 3 + 2] = tc.b; }
    OP.needsUpdate = true; OG.attributes.color.needsUpdate = true; OG.computeVertexNormals();
  };
  // the ship
  const ship = new THREE.Group(); SEA.add(ship);
  const hullS = new THREE.Shape(); hullS.moveTo(-1.6, -5.0); hullS.lineTo(1.6, -5.0); hullS.lineTo(1.75, 2.2); hullS.quadraticCurveTo(1.5, 4.8, 0, 6.3); hullS.quadraticCurveTo(-1.5, 4.8, -1.75, 2.2); hullS.closePath();
  const hullG = new THREE.ExtrudeGeometry(hullS, { depth: 2.0, bevelEnabled: false }); hullG.rotateX(-Math.PI / 2); hullG.translate(0, -0.8, 0);
  const hull = new THREE.Mesh(hullG, WD.mat({ map: WD.T.planks('#8A4A2E', [0.6, 0.6]), color: '#C88A6A' })); hull.castShadow = hull.receiveShadow = true; ship.add(hull);
  const bandG = new THREE.ExtrudeGeometry(hullS, { depth: 0.22, bevelEnabled: false }); bandG.rotateX(-Math.PI / 2); bandG.translate(0, 0.98, 0); bandG.scale(1.02, 1, 1.01);
  const band = new THREE.Mesh(bandG, WD.mat({ color: '#F2C230' })); ship.add(band);
  const deckG = new THREE.ShapeGeometry(hullS); deckG.rotateX(-Math.PI / 2); const deck = new THREE.Mesh(deckG, WD.mat({ map: WD.T.planks('#D2A26A', [0.35, 0.35]) })); deck.position.y = 1.21; deck.receiveShadow = true; ship.add(deck);
  const outline = hullS.getSpacedPoints(46).map((p) => V3(p.x * 0.97, 1.85, -p.y * 0.97));
  const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 120, 0.055, 6, true), WD.mat({ color: '#6A3A22' })); rail.castShadow = true; ship.add(rail);
  outline.forEach((p, i) => { if (i % 2) return; cyl(0.04, 0.04, 0.64, WD.mat({ color: '#6A3A22' }), p.x, 1.53, p.z, ship, 6); });
  const sailM = WD.mat({ color: '#F4EBD6', side: THREE.DoubleSide });
  [[-3.0, 9.0]].forEach(([z, h]) => { cyl(0.14, 0.17, h, WD.mat({ color: '#7A4A2A' }), 0, 1.2 + h / 2, z, ship);
    [[h * 0.62, 3.6], [h * 0.9, 2.6]].forEach(([y, w]) => { const yd = cyl(0.06, 0.06, w + 0.4, WD.mat({ color: '#7A4A2A' }), 0, 1.2 + y, z, ship); yd.rotation.z = Math.PI / 2;
      const sg = new THREE.PlaneGeometry(w, h * 0.24, 8, 4); const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, -0.35 * Math.cos((sp.getX(i) / w) * Math.PI)); sg.computeVertexNormals();
      const s = new THREE.Mesh(sg, sailM); s.position.set(0, 1.2 + y - h * 0.13, z - 0.1); s.castShadow = true; ship.add(s); }); });
  const flagT = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), WD.mat({ color: '#D8343F', side: THREE.DoubleSide })); flagT.position.set(0.4, 10.4, -3.0); ship.add(flagT);
  [[-0.9, -1.0], [-1.15, -0.2], [-0.85, 0.6]].forEach(([x, z]) => { const b = WD.barrel(); b.position.set(x, 1.21, z); ship.add(b); });
  const oilSign = ST.board(1.0, 0.5); oilSign.scale.setScalar(0.7); oilSign.position.set(-1.0, 0.95, -1.7); oilSign.rotation.y = 0.5; oilSign.draw([['FISH OIL', '#F2C230', 120, 200]]); ship.add(oilSign);
  [[1.0, -2.0], [1.1, -1.3]].forEach(([x, z]) => { const c = WD.crate(0.6); c.position.set(x, 1.21, z); ship.add(c); });
  const wheel = new THREE.Group(); wheel.position.set(0, 2.25, 4.1); ship.add(wheel); cyl(0.08, 0.1, 1.05, WD.mat({ color: '#7A4A2A' }), 0, -0.5, 0.1, wheel);
  const wr = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 28), WD.mat({ color: '#8A5A36' })); wheel.add(wr); for (let i = 0; i < 8; i++) { const sp = cyl(0.025, 0.025, 1.08, WD.mat({ color: '#8A5A36' }), 0, 0, 0, wheel, 6); sp.rotation.z = i * Math.PI / 8; }
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 24), WD.mat({ color: '#C8A060' })); coil.rotation.x = Math.PI / 2; coil.position.set(0.9, 1.28, 2.6); ship.add(coil);
  const lant = new THREE.PointLight('#FFC870', 3, 6, 1.5); lant.position.set(0, 3.2, 3.6); ship.add(lant);
  // oil bags hanging over the side
  const bags = []; [[1.82, -0.6], [1.86, 0.8], [-1.82, 0.2]].forEach(([x, z], i) => { const g = new THREE.Group(); g.position.set(x * 1.03, 1.85, z); ship.add(g);
    const rope = cyl(0.012, 0.012, 1.2, WD.mat({ color: '#C8A060' }), 0, -0.6, 0, g, 4); const sb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), WD.mat({ color: '#E8D9B4' })); sb.scale.set(1, 1.3, 1); sb.position.y = -1.3; sb.castShadow = true; g.add(sb); g.visible = false; bags.push(g); });
  const oilSlick = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#C8E8F4', transparent: true, opacity: 0.0, roughness: 0.05, metalness: 0.2, depthWrite: false })); oilSlick.rotation.x = -Math.PI / 2; SEA.add(oilSlick);
  let shipY = 0;
  const pose = (t) => { const h = swell(0, 0, t) * 0.55; shipY = h; ship.position.y = h; ship.rotation.z = Math.sin(t * 0.9 + 0.4) * 0.045; ship.rotation.x = Math.sin(t * 0.75) * 0.03; flagT.rotation.y = Math.sin(t * 6) * 0.3; };
  const DECK = 1.21;

  // ═════ SET 2: the park pond ═════
  const PM = WD.meadow(E, { fenceOn: false, flowers: false }); const POND = PM.scene;
  { const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 1400), m4 = new THREE.Matrix4(); let n = 0, sd = 11; const rn = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const tf = new THREE.InstancedMesh(new THREE.ConeGeometry(0.025, 0.16, 3), WD.mat({ color: '#5DA83E' }), 3000); let m2 = 0;
    for (let i = 0; i < 9000 && (n < 1400 || m2 < 3000); i++) { const x = (rn() - 0.5) * 40, z = (rn() - 0.5) * 34 - 1; if (Math.hypot(x, (z + 3) * 1.15) < 7.6) continue;
      if (n < 1400 && rn() < 0.35) { m4.makeTranslation(x, 0.1, z); fl.setMatrixAt(n, m4); fl.setColorAt(n, new THREE.Color(['#F2D23A', '#F29BB5', '#FFFFFF', '#B98ACF', '#F28C4A'][n % 5])); n++; }
      else if (m2 < 3000) { m4.makeTranslation(x, 0.07, z); tf.setMatrixAt(m2, m4); m2++; } }
    fl.count = n; tf.count = m2; POND.add(fl, tf); }
  const PG = new THREE.PlaneGeometry(15, 15, 110, 110); PG.rotateX(-Math.PI / 2); const PP = PG.attributes.position, PB = Float32Array.from(PP.array), PC = new Float32Array(PP.count * 3); PG.setAttribute('color', new THREE.BufferAttribute(PC, 3));
  const pM = WD.mat({ color: '#FFFFFF', vertexColors: true, roughness: 0.25 }); pM.userData.keepPBR = true; const pond = new THREE.Mesh(PG, pM); pond.position.set(0, 0.04, -3); pond.receiveShadow = true; POND.add(pond);
  const pc1 = new THREE.Color('#3F95C8'), pc2 = new THREE.Color('#8ACDEB'), glass = new THREE.Color('#BDE6F7');
  const POUR = V3(0.3, 0, 3.2).sub(pond.position);
  let lastPond = -1;
  const pondAt = (t, R) => { if (t === lastPond) return; lastPond = t;
    for (let i = 0; i < PP.count; i++) { const x = PB[i * 3], z = PB[i * 3 + 2], r = Math.hypot(x, z * 1.15); if (r > 7.0) { PP.setY(i, -0.3); continue; }
      const c = 1 - clamp((Math.hypot(x - POUR.x, z - POUR.z) - R + 1.5) / 1.5), w = 0.035 * Math.sin(5.1 * x + 4.2 * t) * Math.sin(4.3 * z - 3.6 * t) + 0.02 * Math.sin(8.3 * x - 6.1 * z + 6 * t);
      PP.setY(i, w * (1 - 0.95 * c) * clamp((7 - r) / 0.6)); tc.copy(pc1).lerp(pc2, clamp(0.5 + w * 9)).lerp(glass, c * 0.75); PC[i * 3] = tc.r; PC[i * 3 + 1] = tc.g; PC[i * 3 + 2] = tc.b; }
    PP.needsUpdate = true; PG.attributes.color.needsUpdate = true; PG.computeVertexNormals(); };
  { const rim = []; for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283; rim.push([Math.cos(a) * 7.15, Math.sin(a) * 7.15 / 1.15 - 3]); }
    const rg = CY.lumpRock(5), rm = WD.mat({ color: '#9A9AA8' }); rim.forEach(([x, z], i) => { if (Math.abs(x) < 1.6 && z > 2) return; const m = new THREE.Mesh(rg, rm); m.position.set(x, 0.05, z); m.scale.setScalar(0.22 + ((i * 37) % 10) / 40); m.castShadow = true; POND.add(m); });
    const reedM = WD.mat({ color: '#4E8A3C' }); for (let i = 0; i < 60; i++) { const a = 3.6 + (i / 60) * 2.0, r = 6.6 + (i % 3) * 0.2; const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.9 + (i % 4) * 0.2, 4), reedM); c.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r / 1.15 - 3); POND.add(c); }
    const duck = new THREE.Group(); duck.position.set(-3.2, 0.08, -5); POND.add(duck); const dm = WD.mat({ color: '#F4F4F8' }); const db = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), dm); db.scale.set(1.3, 0.8, 1); duck.add(db); const dh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), dm); dh.position.set(0.22, 0.2, 0); duck.add(dh); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), WD.mat({ color: '#F2A23A' })); bk.rotation.z = -Math.PI / 2; bk.position.set(0.36, 0.2, 0); duck.add(bk);
    const bench = new THREE.Group(); bench.position.set(-3.4, 0, 5.6); bench.rotation.y = 0.4; POND.add(bench); box(1.8, 0.08, 0.5, WD.mat({ color: '#A8693E' }), 0, 0.48, 0, bench); box(1.8, 0.4, 0.06, WD.mat({ color: '#A8693E' }), 0, 0.78, -0.22, bench); [[-0.8], [0.8]].forEach(([x]) => box(0.08, 0.48, 0.45, WD.mat({ color: '#2E3A35' }), x, 0.24, 0, bench));
    const lp = WD.lamp(); lp.position.set(3.6, 0, 5.8); POND.add(lp); }
  const pondBoard = ST.board(1.6, 1.0); pondBoard.position.set(2.5, 0, 4.6); pondBoard.rotation.y = -0.45; POND.add(pondBoard);

  // ═════ SET 3: the icy lot for the analogy ═════
  const ICE = new THREE.Scene(); WD.sky(ICE, { top: '#5FA0E6', horizon: '#E4F0FA' });
  WD.sunlight(ICE, E, { col: '#FFF4E0', i: 2.8, pos: [7, 12, 8], target: [0, 0, 0], box: 12, sky: '#D6E6FF', ground: '#C8D6E6', hemi: 1.5 });
  WD.clouds(ICE, [[-30, 24, -90, 16], [30, 30, -100, 20]]);
  const snow = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), WD.mat({ map: WD.T.dirt('#EEF4FA', [40, 40], false) })); snow.rotation.x = -Math.PI / 2; snow.receiveShadow = true; ICE.add(snow);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: '#BFE4F6', roughness: 0.08, metalness: 0.15 })); ice.rotation.x = -Math.PI / 2; ice.position.y = 0.02; ice.receiveShadow = true; ICE.add(ice);
  [[-6, -8], [7, -10], [-10, -4], [11, -3]].forEach(([x, z], i) => { const tr = WD.tree(1.2 + i * 0.1, '#5E9A6A', i % 2 ? 'cypress' : 'round'); tr.position.set(x, 0, z); ICE.add(tr); });
  ICE.add(CY.rocks(120, [-14, 14, -12, -9], 0, ['#F4F8FC', '#E4EEF6']));
  const car = WD.car('#3C6FB6'); car.rotation.y = Math.PI / 2; car.position.set(0.6, 0.02, -1.2); ICE.add(car);
  const iceBoard = ST.board(1.5, 0.95); iceBoard.position.set(-2.4, 0, -2.4); iceBoard.rotation.y = 0.35; ICE.add(iceBoard);
  EXTRAS = [oilSign, pondBoard, iceBoard];

  // ═════ cast ═════
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const captain = mk('captain', 1, 1.8), rookie = mk('rookie', 2, 1.62), crew = mk('crew', 3), inventor = mk('inventor', 4, 1.78), lady = mk('lady', 5, 1.6), gent = mk('gent', 6), pusher = mk('pusher', 7);
  const all = [captain, rookie, crew, inventor, lady, gent, pusher];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const splash = (x, y, k, t) => { if (k <= 0) return; ctx.save(); ctx.fillStyle = '#F4FAFF'; ctx.strokeStyle = '#2A3A55'; ctx.lineWidth = 6; for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.32, d = 80 + 260 * k + (i % 3) * 30, r = 34 + (i % 4) * 12; ctx.globalAlpha = Math.min(1, 1.6 * (1 - k) + 0.3); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, r * (1 - k * 0.4), 0, 7); ctx.fill(); ctx.stroke(); } ctx.restore(); };
  const arrows = (k, t) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 4; i++) { const y = 360 + i * 150, x0 = ((t * 420 + i * 260) % (CW + 400)) - 300; ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + 80, y - 40, x0 + 160, y + 40, x0 + 240, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x0 + 205, y - 28); ctx.lineTo(x0 + 245, y); ctx.lineTo(x0 + 205, y + 28); ctx.stroke(); } ctx.restore(); };
  const drip = (p, t) => { const [x, y] = proj(p); ctx.save(); ctx.fillStyle = '#F2C230'; ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(x, y + 20 + ph * 120, 6, 10, 0, 0, 7); ctx.fill(); ctx.stroke(); } ctx.restore(); };

  // ── S1 · "Sailors in giant storms used to fight thirty foot waves by pouring oil on the water. And it actually worked."
  { const st = 0, gi = Wd('giant', 0), po = Wd('pouring', 0), an = Wd('and', 0), wo = Wd('worked', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open: we skim low over a grey-blue storm sea full of whitecaps to a little red-and-gold sailing ship; a sailor tips a bucket of oil over the rail and a glassy calm ring spreads out', draw(lt, d, t, blit) {
      hideAll(); into(SEA, crew, captain); pose(t);
      const R = t < po ? 0 : 3 + (t - po) * 5; sea(t, R, 1); oilSlick.material.opacity = 0;
      act(crew, 1.25, 0.3, { ...A.face(t, [[st, 'worried'], [po, 'scheme'], [wo, 'happy']]), holdR: bucket, armR: A.arm(t, [[st, [60, 60]], [po - 0.2, [120, 60]]]), ...A.react('cheer', t, wo, 1.0) }, shipY + DECK);
      act(captain, 0.2, 2.2, { ...A.face(t, [[st, 'skeptic'], [wo, 'proud']]), ...A.react('proud', t, wo, 1.2) }, shipY + DECK);
      const c = A.camPath(t, [
        [st, [26, 4.0, -18], [0, 2.0, 0], 46],
        [po - 0.3, [9.0, 3.6, -4.0], [0.8, 2.2, 0.6], 44],
        [an, [6.0, 4.2, 3.0], [1.2, 2.4, 0.8], 42],
        [end, [4.2, 3.4, 3.4], [0.9, 2.6, 1.2], 40],
      ]);
      shoot(SEA, c); blit(); FX.rain(t, { n: 110, k: 1 - clamp((t - po) / 4) * 0.6, angle: 0.3 });
    } });
    cue(0.05, 'swoosh', { gain: 0.45, sweep: -0.8 }); cue(Wd('pouring', 0), 'gulp', { gain: 0.35 }); cue(Wd('worked', 0), 'ding', { gain: 0.3 }); }

  // ── S2 · "Picture a captain in a storm, waves smashing over the deck, and he yells, 'Get the fish oil!'"
  { const st = L(1), ca = Wd('captain', 1), sm = Wd('smashing', 1), ye = Wd('yells', 1), fi = Wd('fish', 1), end = L(2);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'on deck at the wheel: rain lashes, a wave bursts over the rail and drenches the captain, who spins round and points at the FISH OIL barrels', draw(lt, d, t, blit) {
      hideAll(); into(SEA, captain, rookie); pose(t); sea(t, 0, 0); bags.forEach((b) => (b.visible = false));
      act(captain, 0.0, 3.4, { ...A.face(t, [[st, 'angry'], [sm, 'shock'], [ye, 'angry'], [fi, 'excited']]), armR: A.arm(t, [[st, [40, 120]], [ye, [120, 20]], [fi, [100, 0]]]), armL: [40, 120], sweat: t > sm + 0.3 ? 1 : 0, ...A.react('shock', t, sm + 0.2, 0.6), ...A.react('point', t, fi, 1.0) }, shipY + DECK);
      act(rookie, -1.0, 2.0, { ...A.face(t, [[st, 'worried'], [sm, 'shock']]), armL: [160, 20], armR: [160, -20], ...A.react('shock', t, sm + 0.25, 0.8) }, shipY + DECK);
      const c = A.camPath(t, [
        [st, [2.6, 3.2, 6.4], [0.0, 2.6, 3.4], 42],
        [fi - 0.2, [1.8, 3.0, 5.6], [-0.3, 2.4, 2.0], 44],
        [end, [1.4, 3.1, 5.6], [-0.4, 2.2, 1.2], 46],
      ]);
      shoot(SEA, c); blit();
      const k = clamp((t - sm + 0.1) / 0.7); if (k > 0 && k < 1) { const [x, y] = proj(V3(1.7, shipY + 2.2, 3.0)); splash(x, y, k, t); }
      FX.rain(t, { n: 130, k: 1, angle: 0.35 });
    } });
    cue(Wd('smashing', 1), 'whoosh', { gain: 0.5 }); cue(Wd('smashing', 1) + 0.15, 'thud', { gain: 0.4 }); cue(Wd('fish', 1), 'boing', { gain: 0.3 }); }

  // ── S3 · "The crew fills canvas bags with oil, pokes holes in them, and hangs them over the side." / "The new guy says, 'Captain, we're sinking, and you're cooking?'"
  { const st = L(2), fi = Wd('fills', 2), po = Wd('pokes', 2), ha = Wd('hangs', 2), ng = L(3), si = Wd('sinking', 3), co = Wd('cooking', 3), end = L(4);
    add({ id: 'S3', at: st, note: 'by the barrels the sailor fills a lumpy canvas sack, jabs holes in it, and the bags drop over the rail dripping gold oil; the rookie in a striped shirt turns to the captain, deadpan', draw(lt, d, t, blit) {
      hideAll(); into(SEA, crew, rookie, captain); pose(t); sea(t, 0, 0);
      bags.forEach((b, i) => { b.visible = t > ha + i * 0.25; b.rotation.z = Math.sin(t * 2 + i) * 0.15; });
      act(crew, lerp(0.2, 1.2, eo(clamp((NOW - Wd('hangs', 2) + 0.6) / 0.6))), -0.8, { ...A.face(t, [[st, 'content'], [po, 'scheme'], [ha, 'proud']]), holdR: t < ha ? sack : undefined, armR: A.arm(t, [[st, [70, 60]], [po, [100, 20]], [po + 0.3, [70, 60]], [po + 0.6, [100, 20]], [ha, [140, -10]]]), armL: A.arm(t, [[st, [40, 60]], [po, [80, 80]]]) }, shipY + DECK);
      act(rookie, -0.6, 1.3, { ...A.face(t, [[st, 'skeptic'], [ng, 'skeptic'], [si, 'worried'], [co, 'sly']]), armR: A.arm(t, [[st, [30, 30]], [si, [90, 60]], [co, [120, 40]]]), ...A.react('shrug', t, co + 0.2, 1.0) }, shipY + DECK);
      act(captain, 0.6, 2.4, { ...A.face(t, [[st, 'proud'], [co, 'angry']]), armL: [40, 120], ...A.react('angry', t, co + 0.4, 0.8) }, shipY + DECK);
      const c = A.camPath(t, [
        [st, [-1.6, 2.9, 1.4], [0.2, 2.2, -0.8], 42],
        [ha - 0.1, [-0.7, 3.0, 1.8], [0.9, 2.2, -0.6], 44],
        [ng + 0.2, [-1.2, 2.9, 4.4], [0.0, 2.6, 1.6], 42],
        [end, [-1.0, 2.8, 4.2], [-0.2, 2.6, 1.6], 40],
      ]);
      shoot(SEA, c); blit();
      if (t > ha) bags.forEach((b) => b.visible && drip(b.localToWorld(V3(0, -1.5, 0)), t));
      FX.rain(t, { n: 110, k: 0.9, angle: 0.35 });
    } });
    cue(Wd('pokes', 2), 'pop', { gain: 0.3 }); cue(Wd('pokes', 2) + 0.3, 'pop', { gain: 0.3 }); cue(Wd('hangs', 2) + 0.1, 'plop', { gain: 0.35 }); cue(Wd('cooking', 3) + 0.2, 'boing', { gain: 0.3 }); }

  // ── S4 · "But slowly, all around the ship, the water goes smooth, like somebody ironed it." / "The waves are still huge, but they stop breaking over the ship."
  { const st = L(4), sl = Wd('slowly', 4), sm = Wd('smooth', 4), ir = Wd('ironed', 4), wv = L(5), hu = Wd('huge', 5), br = Wd('breaking', 5), end = L(6);
    add({ id: 'S4', at: st, note: 'over the rail: the dripping bags, and the whitecaps around the hull die away in a growing glassy ring; then a big crane-out shows the ship riding huge smooth swells with no foam near it', draw(lt, d, t, blit) {
      hideAll(); into(SEA, captain, rookie); pose(t); bags.forEach((b) => (b.visible = true));
      const R = 2 + clamp((t - sl) / 3.5) * 16 + Math.max(0, t - wv) * 3; sea(t, R, 1);
      act(captain, 1.25, 0.9, { ...A.face(t, [[st, 'content'], [ir, 'proud']]), armL: [30, 30], ...A.react('proud', t, ir, 1.0) }, shipY + DECK);
      act(rookie, 1.2, -0.4, { ...A.face(t, [[st, 'skeptic'], [sm, 'gasp'], [hu, 'worried'], [br, 'happy']]), ...A.react('shock', t, sm, 0.6), ...A.react('cheer', t, br + 0.3, 1.0) }, shipY + DECK);
      const c = A.camPath(t, [
        [st, [3.6, 3.6, 2.6], [1.6, 1.0, -0.2], 44],
        [ir, [5.0, 4.6, 3.6], [1.8, 1.2, 0.0], 46],
        [wv + 0.4, [14, 9, 12], [0.0, 1.6, 0.0], 46],
        [end, [10, 6.5, 9], [0.6, 2.0, 0.4], 44],
      ]);
      shoot(SEA, c); blit();
      if (t < wv + 0.5) bags.forEach((b) => drip(b.localToWorld(V3(0, -1.5, 0)), t));
      FX.rain(t, { n: 90, k: 0.6 - clamp((t - sl) / 4) * 0.4, angle: 0.3 });
    } });
    cue(Wd('smooth', 4), 'slide', { gain: 0.3 }); cue(Wd('ironed', 4), 'swoosh', { gain: 0.3 }); cue(L(5) + 0.3, 'swoosh', { gain: 0.4, sweep: 0.8 }); }

  // ── S5 · "One inventor was so obsessed with this, he carried oil hidden inside his walking stick." / "He'd walk up to a windy pond, pour out one teaspoon, and half an acre of water went flat." / "People thought it was a magic trick. He just shrugged."
  { const st = L(6), ob = Wd('obsessed', 6), hi = Wd('hidden', 6), wa = Wd('walk', 7), po = Wd('pour', 7), te = Wd('teaspoon', 7), ha = Wd('half', 7), fl = Wd('flat', 7), pe = L(8), ma = Wd('magic', 8), sh = Wd('shrugged', 8), end = L(9);
    add({ id: 'S5', at: st, trans: 'dissolve', note: 'a sunny park pond: the top-hatted inventor twists the gold knob off his cane, shows the hidden oil, tips one drop in, and a glassy patch races across the rippling pond; two strollers gasp; he shrugs', draw(lt, d, t, blit) {
      hideAll(); into(POND, inventor, lady, gent);
      const R = t < po + 0.3 ? 0 : (t - po - 0.3) * 4.2; pondAt(t, R);
      pondBoard.draw(t > fl ? [['1 TEASPOON', '#FFFFFF', 74, 120], ['=', '#F2C230', 70, 205], ['HALF AN ACRE', '#F2C230', 74, 290]] : [['CLAPHAM POND', '#FFFFFF', 60, 140], ['NO SWIMMING', '#FF8A80', 52, 260]]);
      const ix = t < wa ? 0.4 : lerp(0.4, 0.3, eo(clamp((t - wa) / 1))), iz = t < wa ? 6.0 : lerp(6.0, 4.2, eo(clamp((t - wa) / 1.2)));
      act(inventor, ix, iz, { ...A.face(t, [[st, 'scheme'], [hi, 'sly'], [po, 'content'], [fl, 'proud'], [ma, 'skeptic'], [sh, 'content']]), holdR: t < hi ? cane : t < po + 1.2 ? caneTop : cane, armR: A.arm(t, [[st, [30, 20]], [hi, [100, 40]], [po, [130, 60]], [po + 1.2, [30, 20]]]), ...A.react('shrug', t, sh, 1.0) });
      act(lady, -1.9, 4.9, { ...A.face(t, [[st, 'content'], [fl, 'gasp'], [ma, 'excited']]), ...A.react('shock', t, fl, 0.7), ...A.react('cheer', t, ma, 1.0) }, 0, 0.8);
      act(gent, -2.9, 5.5, { ...A.face(t, [[st, 'skeptic'], [fl, 'shock'], [ma, 'scheme']]), ...A.react('shock', t, fl + 0.15, 0.7), ...A.react('point', t, ma + 0.2, 0.8) }, 0, 0.8);
      const c = A.camPath(t, [
        [st, [1.6, 1.7, 7.6], [0.4, 1.4, 6.0], 40],
        [wa, [2.0, 1.8, 8.4], [0.4, 1.3, 5.0], 42],
        [po, [2.4, 2.6, 6.6], [0.0, 0.6, 2.4], 46],
        [fl, [3.2, 4.4, 8.2], [-0.4, 0.2, -1.2], 50],
        [pe + 0.3, [1.0, 1.9, 8.6], [-1.2, 1.3, 4.8], 46],
        [end, [0.8, 1.8, 7.4], [-0.6, 1.4, 4.6], 44],
      ]);
      shoot(POND, c); blit();
    } });
    cue(Wd('hidden', 6), 'pop', { gain: 0.3 }); cue(Wd('pour', 7) + 0.2, 'plop', { gain: 0.35 }); cue(Wd('flat', 7), 'ding', { gain: 0.3 }); cue(Wd('shrugged', 8), 'boing', { gain: 0.25 }); }

  // ── S6 · "You see, wind makes big waves by grabbing tiny ripples first." / "Oil spreads into a film so thin it's only one molecule thick, and it wipes those ripples out."
  { const st = L(9), yo = Wd('see', 9), gr = Wd('grabbing', 9), oi = L(10), th = Wd('thin', 10), mo = Wd('molecule', 10), wi = Wd('wipes', 10), end = L(11);
    add({ id: 'S6', at: st, note: 'low over the pond: white wind swirls tug the ripples; the inventor beside his board explains: WIND GRABS RIPPLES, then OIL FILM = 1 MOLECULE; the ripples vanish as he points', draw(lt, d, t, blit) {
      hideAll(); into(POND, inventor);
      const R = t < wi ? 0.0 : (t - wi) * 7; pondAt(t, R);
      pondBoard.draw(t < oi ? [['WIND', '#FFFFFF', 76, 110], ['GRABS', '#FFFFFF', 76, 200], ['RIPPLES', '#F2C230', 84, 295]] : [['OIL FILM', '#FFFFFF', 76, 110], ['1 MOLECULE', '#F2C230', 80, 210], ['THICK', '#FFFFFF', 70, 300]]);
      act(inventor, t < oi - 0.2 ? 0.1 : 1.4, 4.5, { ...A.face(t, [[st, 'scheme'], [gr, 'excited'], [th, 'content'], [mo, 'proud'], [wi, 'happy']]), holdR: cane, armL: A.arm(t, [[st, [40, 40]], [yo, [120, 30]], [gr + 0.6, [40, 40]], [mo, [130, 20]], [wi + 0.6, [40, 40]]]), ...A.react('point', t, mo, 1.0) });
      const c = A.camPath(t, [
        [st, [-1.4, 1.0, 7.4], [0.6, 0.6, 2.6], 46],
        [oi - 0.2, [-0.2, 0.9, 6.6], [0.8, 0.6, 2.6], 46],
        [oi + 0.3, [0.4, 1.7, 7.6], [1.8, 1.4, 4.4], 44],
        [end, [0.6, 1.75, 7.2], [1.9, 1.45, 4.4], 42],
      ]);
      shoot(POND, c); blit(); arrows(t < oi ? clamp((t - st) / 0.4) : 1 - clamp((t - wi) / 0.8), t);
    } });
    cue(Wd('see', 9), 'swoosh', { gain: 0.3 }); cue(Wd('molecule', 10), 'ding', { gain: 0.3 }); cue(Wd('wipes', 10), 'slide', { gain: 0.3 }); }

  // ── S7 · "It's like trying to push a car on ice. No grip, no push, no wave."
  { const st = L(11), pu = Wd('push', 11), ca = Wd('car', 11), ic = Wd('ice', 11), ng = Wd('grip', 11), np = Wd('wave', 11) - 0.45, nw = Wd('wave', 11), end = L(12);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'a frozen lot: a guy in a red jacket heaves at a blue car on shiny ice; his boots spin in place and he does the splits; the board reads NO GRIP, NO PUSH, NO WAVE', draw(lt, d, t, blit) {
      hideAll(); into(ICE, pusher);
      iceBoard.draw([['NO GRIP', t > ng ? '#FF8A80' : '#FFFFFF', 70, 110], ['NO PUSH', t > np + 0.2 ? '#FF8A80' : '#FFFFFF', 70, 200], ['NO WAVE', t > nw ? '#F2C230' : '#FFFFFF', 70, 290]]);
      const slip = t > pu ? Math.sin((t - pu) * 14) * 0.22 : 0;
      act(pusher, -1.25 + slip * 0.4, -1.2, { ...A.face(t, [[st, 'strain'], [ic, 'worried'], [ng, 'shock'], [nw, 'dizzy']]), armR: [100, 20], armL: [100, -20], tilt: t > pu ? 12 + Math.sin(t * 12) * 6 : 6, energy: 1.2, sweat: 1, ...A.react('shock', t, nw, 0.7) }, 0, 1.2);
      const c = A.camPath(t, [[st, [-0.2, 2.2, 6.4], [-0.3, 1.0, -1.2], 46], [nw - 0.3, [-1.0, 2.0, 5.4], [-1.0, 1.1, -1.4], 46], [end, [-1.2, 1.9, 4.8], [-1.2, 1.2, -1.6], 44]]);
      shoot(ICE, c); blit();
    } });
    cue(Wd('push', 11), 'slide', { gain: 0.3 }); cue(Wd('grip', 11), 'tock', { gain: 0.3 }); cue(Wd('wave', 11), 'boing', { gain: 0.3 }); }

  // ── S8 · "So for hundreds of years, one of the best pieces of storm gear on a ship was basically a leaky bag of salad dressing."
  { const st = L(12), hu = Wd('hundreds', 12), be = Wd('best', 12), ba = Wd('basically', 12), sa = Wd('salad', 12), end = T.dur;
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'back at sea, the storm breaking up and the water glassy round the ship: the captain proudly raises a bottle labelled SALAD OIL; the rookie facepalms and laughs', draw(lt, d, t, blit) {
      hideAll(); into(SEA, captain, rookie); pose(t * 0.6); sea(t, 30, 1); bags.forEach((b) => (b.visible = true));
      act(captain, 0.4, 2.6, { ...A.face(t, [[st, 'content'], [be, 'proud'], [sa, 'laugh']]), holdR: bottle, armR: A.arm(t, [[st, [40, 60]], [be, [150, -10]]]), ...A.react('proud', t, be, 1.4) }, shipY + DECK);
      act(rookie, -0.7, 2.2, { ...A.face(t, [[st, 'skeptic'], [ba, 'sly'], [sa, 'laugh']]), ...A.react('laugh', t, sa, 1.4) }, shipY + DECK);
      const c = A.camPath(t, [[st, [8, 6, 10], [0.0, 2.2, 1.6], 44], [be, [1.6, 3.1, 6.6], [0.0, 2.6, 2.4], 42], [end, [1.2, 3.0, 6.0], [0.0, 2.6, 2.4], 40]]);
      shoot(SEA, c); blit(); FX.rain(t, { n: 40, k: 0.25 * (1 - clamp((t - st) / 2)), angle: 0.3 });
    } });
    cue(Wd('salad', 12), 'ding', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
