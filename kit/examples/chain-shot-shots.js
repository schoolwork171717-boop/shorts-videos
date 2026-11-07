// WARSHIPS FIRED CANNONBALLS CHAINED TOGETHER — kit v9.1: a sunny open sea with two little sailing warships (live
// ocean), a spinning chain shot that shreds the enemy's sails, a stone fort with a glowing shot furnace, and a farm
// haystack for the analogy.
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
  captain: { body: '#2E4A7A', pattern: 'jacket', patCol: '#24406C', hat: 'official', hatCol: '#1E2A44', band: '#F2C230', extra: ['beard'], beardCol: '#3A2A1A', neck: 'collar' },
  gunner: { body: '#D8343F', pattern: 'stripes', patCol: '#F4F4F8', hat: 'beanie', hatCol: '#2A2830', extra: ['mustache'], mustacheCol: '#3A2A1A' },
  enemy: { body: '#3E8A5A', pattern: 'jacket', patCol: '#2E6A44', hat: 'tophat', hatCol: '#2A2830', extra: ['longmustache'], neck: 'bowtie' },
  oldgun: { body: '#8A6A4A', pattern: 'apron', patCol: '#5A4A3A', hat: 'workcap', hatCol: '#5A3A22', extra: ['beard'], beardCol: '#E8E8EE' },
  newgun: { body: '#3C6FB6', pattern: 'plain', hat: 'cap', hatCol: '#3C6FB6', extra: ['freckles'], hair: '#C8783A' },
  farmer: { body: '#E2B33C', pattern: 'overalls', patCol: '#3C6FB6', hat: 'cowboy', hatCol: '#C8A060', extra: ['goatee'] },
};
const tongs = (g, x, y) => { g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-14, -150); g.moveTo(6, 0); g.lineTo(14, -150); g.stroke(); g.strokeStyle = '#6A6A78'; g.lineWidth = 5; g.beginPath(); g.moveTo(-6, 0); g.lineTo(-14, -150); g.moveTo(6, 0); g.lineTo(14, -150); g.stroke();
  const gr = g.createRadialGradient(0, -170, 4, 0, -170, 34); gr.addColorStop(0, '#FFF6C8'); gr.addColorStop(0.5, '#FF9A3A'); gr.addColorStop(1, '#D8343F'); g.fillStyle = gr; g.beginPath(); g.arc(0, -172, 30, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke(); g.restore(); };
const clay = (g, x, y) => { g.save(); g.translate(x, y - 10); g.fillStyle = '#A8693E'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, 40, 30, 0.2, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#C8956A'; g.beginPath(); g.ellipse(-12, -8, 12, 7, 0.2, 0, 7); g.fill(); g.fillStyle = '#7FC8F0'; [[18, -24], [26, -12]].forEach(([a, b]) => { g.beginPath(); g.ellipse(a, b, 5, 8, 0, 0, 7); g.fill(); }); g.restore(); };
const coal = (g, x, y) => { g.save(); g.translate(x, y - 8); const gr = g.createRadialGradient(0, 0, 3, 0, 0, 26); gr.addColorStop(0, '#FFF6C8'); gr.addColorStop(0.5, '#FF7A2A'); gr.addColorStop(1, '#3A2A2A'); g.fillStyle = gr; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(-24, 4); g.lineTo(-10, -22); g.lineTo(16, -18); g.lineTo(26, 6); g.lineTo(4, 22); g.closePath(); g.fill(); g.stroke(); g.restore(); };
const flagP = (g, x, y) => { g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 20); g.lineTo(0, -220); g.stroke(); g.fillStyle = '#D8343F'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, -220); g.lineTo(110, -190); g.lineTo(0, -160); g.closePath(); g.fill(); g.stroke(); g.restore(); };

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; CUR = o.id; FF = null; f(lt, d, t, blit); FX.motes(t, { n: 14, col: '255,250,235', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.18, bloomThreshold: 0.94, aperture: 0.0016, maxblur: 0.009 };
  let EXTRAS = [];
  const rootOf = (o) => { while (o.parent) o = o.parent; return o; };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.position.lerp(V3(...c.look), 0.12 * clamp((50 - c.fov) / 6));   // v9.2: continuous push-in (the old 38-44 on/off switch made the camera jump)
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); A.frameFix(cam, FF || all.filter((q) => q.group.parent === scene && q.group.visible), { t: NOW, key: CUR, extras: FF ? [] : EXTRAS.filter((o) => rootOf(o) === scene) }); all.forEach((q) => q.face(cam));
    E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
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
  const cyl = (r1, r2, h, m, x, y, z, parent, seg = 12) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b); return b; };
  const proj = (v) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * CW, (1 - p.y) / 2 * CH]; };
  const flames = (x, y, k, t, s = 1) => { if (k <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); for (let i = 0; i < 7; i++) { const ph = t * 6 + i * 1.7, hh = (90 + 60 * Math.sin(ph)) * k, ww = 34 * k, xo = (i - 3) * 26 * k;
      ctx.fillStyle = i % 2 ? '#FF7A2A' : '#F2C230'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(xo - ww, 0); ctx.quadraticCurveTo(xo - ww * 0.6, -hh * 0.6, xo + Math.sin(ph) * 10, -hh); ctx.quadraticCurveTo(xo + ww * 0.6, -hh * 0.6, xo + ww, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.globalAlpha = 0.45 * k; ctx.fillStyle = '#6A6A78'; for (let i = 0; i < 5; i++) { const ph = (t * 0.6 + i / 5) % 1; ctx.beginPath(); ctx.arc(Math.sin(i * 2 + t) * 30, -160 * k - ph * 260, 40 + ph * 60, 0, 7); ctx.fill(); } ctx.restore(); };

  // ═════ SET 1: sunny sea, two ships ═════
  const SEA = new THREE.Scene(); WD.sky(SEA, { top: '#3D8EE0', horizon: '#CFE8F8' });
  WD.sunlight(SEA, E, { col: '#FFF0D6', i: 3.0, pos: [-8, 14, 8], target: [0, 1, 0], box: 16, sky: '#CFE2FF', ground: '#3E86B8', hemi: 1.4 });
  CY.haze(SEA, { col: '#C8DCEE', near: 60, far: 220, floorY: -3 });
  WD.clouds(SEA, [[-40, 26, -120, 22], [30, 30, -140, 26], [90, 24, -100, 18], [-100, 28, -80, 20], [0, 34, 120, 24]]);
  const OG = new THREE.PlaneGeometry(170, 170, 140, 140); OG.rotateX(-Math.PI / 2);
  const OP = OG.attributes.position, OB = Float32Array.from(OP.array), OC = new Float32Array(OP.count * 3); OG.setAttribute('color', new THREE.BufferAttribute(OC, 3));
  const oM = WD.mat({ color: '#FFFFFF', vertexColors: true, roughness: 0.3 }); oM.userData.keepPBR = true; const ocean = new THREE.Mesh(OG, oM); ocean.receiveShadow = true; SEA.add(ocean);
  const deep = new THREE.Color('#2F86C8'), lite = new THREE.Color('#62C0EA'), foam = new THREE.Color('#F2FAFF'), tc = new THREE.Color();
  const swell = (x, z, t) => 0.35 * Math.sin(0.40 * x + 0.9 * t) + 0.22 * Math.sin(0.29 * z - 0.75 * t + 1.3);
  const chopF = (x, z, t) => 0.1 * Math.sin(1.7 * x + 2.6 * t) * Math.sin(1.5 * z - 2.0 * t) + 0.06 * Math.sin(2.9 * x - 1.3 * z + 3.3 * t);
  let lastSea = -1;
  const sea = (t) => { if (t === lastSea) return; lastSea = t;
    for (let i = 0; i < OP.count; i++) { const x = OB[i * 3], z = OB[i * 3 + 2], ch = chopF(x, z, t), sw = swell(x, z, t); OP.setY(i, sw + ch);
      tc.copy(deep).lerp(lite, clamp((sw + ch + 0.5) / 1.0)).lerp(foam, clamp((ch - 0.11) / 0.05) * 0.8); OC[i * 3] = tc.r; OC[i * 3 + 1] = tc.g; OC[i * 3 + 2] = tc.b; }
    OP.needsUpdate = true; OG.attributes.color.needsUpdate = true; OG.computeVertexNormals(); };
  const hullS = new THREE.Shape(); hullS.moveTo(-1.6, -5.0); hullS.lineTo(1.6, -5.0); hullS.lineTo(1.75, 2.2); hullS.quadraticCurveTo(1.5, 4.8, 0, 6.3); hullS.quadraticCurveTo(-1.5, 4.8, -1.75, 2.2); hullS.closePath();
  const sailM = WD.mat({ color: '#F4EBD6', side: THREE.DoubleSide });
  const makeShip = (bandCol, flagCol) => { const ship = new THREE.Group(); SEA.add(ship);
    const hullG = new THREE.ExtrudeGeometry(hullS, { depth: 2.0, bevelEnabled: false }); hullG.rotateX(-Math.PI / 2); hullG.translate(0, -0.8, 0);
    const hull = new THREE.Mesh(hullG, WD.mat({ map: WD.T.planks('#8A4A2E', [0.6, 0.6]), color: '#C88A6A' })); hull.castShadow = hull.receiveShadow = true; ship.add(hull);
    const bandG = new THREE.ExtrudeGeometry(hullS, { depth: 0.22, bevelEnabled: false }); bandG.rotateX(-Math.PI / 2); bandG.translate(0, 0.98, 0); bandG.scale(1.02, 1, 1.01); ship.add(new THREE.Mesh(bandG, WD.mat({ color: bandCol })));
    const deckG = new THREE.ShapeGeometry(hullS); deckG.rotateX(-Math.PI / 2); const deck = new THREE.Mesh(deckG, WD.mat({ map: WD.T.planks('#D2A26A', [0.35, 0.35]) })); deck.position.y = 1.21; deck.receiveShadow = true; ship.add(deck);
    const outline = hullS.getSpacedPoints(46).map((p) => V3(p.x * 0.97, 1.85, -p.y * 0.97));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 120, 0.055, 6, true), WD.mat({ color: '#6A3A22' })); ship.add(rail);
    outline.forEach((p, i) => { if (i % 2) return; cyl(0.04, 0.04, 0.64, WD.mat({ color: '#6A3A22' }), p.x, 1.53, p.z, ship, 6); });
    const sails = []; cyl(0.14, 0.17, 9, WD.mat({ color: '#7A4A2A' }), 0, 5.7, -3.0, ship);
    [[5.6, 3.6], [8.1, 2.6]].forEach(([y, w]) => { const yd = cyl(0.06, 0.06, w + 0.4, WD.mat({ color: '#7A4A2A' }), 0, 1.2 + y, -3.0, ship); yd.rotation.z = Math.PI / 2;
      const sg = new THREE.PlaneGeometry(w, 2.2, 8, 4); const sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, -0.35 * Math.cos((sp.getX(i) / w) * Math.PI)); sg.computeVertexNormals();
      const s = new THREE.Mesh(sg, sailM); s.position.set(0, 1.2 + y - 1.2, -3.1); s.castShadow = true; ship.add(s); sails.push(s); });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), WD.mat({ color: flagCol, side: THREE.DoubleSide })); flag.position.set(0.4, 10.4, -3.0); ship.add(flag);
    const guns = []; [-1, 1].forEach((s) => [-1.0, 0.6, 2.2].forEach((z) => { const g = cyl(0.13, 0.17, 1.2, WD.mat({ color: '#2A2A33', metalness: 0.4, roughness: 0.4 }), s * 1.75, 1.45, z, ship); g.rotation.z = Math.PI / 2; guns.push(g); }));
    const wheel = new THREE.Group(); wheel.position.set(0, 2.25, 4.1); ship.add(wheel); cyl(0.08, 0.1, 1.05, WD.mat({ color: '#7A4A2A' }), 0, -0.5, 0.1, wheel);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 28), WD.mat({ color: '#8A5A36' }))); for (let i = 0; i < 8; i++) { const sp = cyl(0.025, 0.025, 1.08, WD.mat({ color: '#8A5A36' }), 0, 0, 0, wheel, 6); sp.rotation.z = i * Math.PI / 8; }
    [[-0.9, -1.4], [-1.1, -0.6]].forEach(([x, z]) => { const b = WD.barrel(); b.position.set(x, 1.21, z); ship.add(b); });
    const balls = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), WD.mat({ color: '#2A2A33' })); b.position.set(1.0 + (i % 3) * 0.22, 1.32 + Math.floor(i / 3) * 0.18, 1.4 + (i % 2) * 0.1); ship.add(b); }
    return { ship, sails, flag }; };
  const ours = makeShip('#F2C230', '#D8343F'), theirs = makeShip('#3C6FB6', '#2E9A4A');
  const DECK = 1.21;
  let OY = 0;
  const poseShips = (t, ex = 20, ez = -26, ery = 0.2) => { OY = swell(0, 0, t) * 0.6; ours.ship.position.set(0, OY, 0); ours.ship.rotation.z = Math.sin(t * 0.8) * 0.02;
    theirs.ship.position.set(ex, swell(ex, ez, t) * 0.6, ez); theirs.ship.rotation.y = ery; ours.flag.rotation.y = theirs.flag.rotation.y = Math.sin(t * 6) * 0.3; };
  // the chain shot (two balls + chain), flown along a path
  const chainShot = new THREE.Group(); SEA.add(chainShot);
  const cbM = WD.mat({ color: '#2A2A33', metalness: 0.4, roughness: 0.4 }); const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), cbM), b2 = b1.clone(); b1.position.x = -0.9; b2.position.x = 0.9; chainShot.add(b1, b2);
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 6, 10), WD.mat({ color: '#5A5A66', metalness: 0.6 })); l.position.x = -0.72 + i * 0.18; l.rotation.y = i % 2 ? Math.PI / 2 : 0; chainShot.add(l); }
  chainShot.visible = false;
  const fly = (t, t0, dur, from, to) => { const k = clamp((t - t0) / dur); chainShot.visible = k > 0 && k < 1; chainShot.position.copy(from).lerp(to, k); chainShot.position.y += Math.sin(k * Math.PI) * 2.0; chainShot.rotation.y = (t - t0) * 14; chainShot.rotation.z = 0.25; return k; };
  const shred = (k) => theirs.sails.forEach((s, i) => { s.scale.set(1 - 0.55 * k, 1 - 0.7 * k, 1); s.rotation.z = k * (i ? 0.5 : -0.4); s.position.y = (i ? 7.9 : 5.6) - 1.2 * k * 1.5 + (i ? 1.2 : 1.2) - 1.2; });

  // ═════ SET 2: the fort on the cliff ═════
  const FORT = new THREE.Scene(); WD.sky(FORT, { top: '#3D8EE0', horizon: '#CFE8F8' });
  WD.sunlight(FORT, E, { col: '#FFF0D6', i: 3.0, pos: [6, 14, 10], target: [0, 0, -2], box: 14, sky: '#CFE2FF', ground: '#8E7D6A', hemi: 1.4 });
  WD.clouds(FORT, [[-40, 26, -120, 22], [30, 30, -140, 26]]);
  const fs = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), WD.mat({ color: '#3E8EC8' })); fs.rotation.x = -Math.PI / 2; fs.position.y = -8; FORT.add(fs);
  const cliff = CY.cliff({ w: 60, h: 8.2, y0: -8, ledge: 0.6, setback: 0.3, seed: 4, seg: [70, 30], rim: 0, pal: ['#B8A890', '#A89880', '#C8B8A0', '#9A8A72'] }); cliff.position.set(0, 0, 6); cliff.rotation.y = Math.PI; FORT.add(cliff);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), WD.mat({ map: WD.T.grass('#7DBF5A', [20, 10]) })); top.rotation.x = -Math.PI / 2; top.position.set(0, 0.0, -12); top.receiveShadow = true; FORT.add(top);
  const stone = WD.mat({ map: WD.T.stone(['#C8C0B0', '#B8B0A0', '#D6CEBE'], [6, 2], 9) });
  box(16, 1.3, 0.8, stone, 0, 0.65, 4.4, FORT); for (let i = 0; i < 9; i++) box(0.9, 0.5, 0.8, stone, -7.2 + i * 1.8, 1.55, 4.4, FORT);
  box(16, 0.3, 6, stone, 0, 0.15, 1.6, FORT); const tower = box(3.2, 5, 3.2, stone, -6.4, 2.5, -1.4, FORT);
  const fortFlag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), WD.mat({ color: '#D8343F', side: THREE.DoubleSide })); fortFlag.position.set(-5.8, 6.6, -1.4); FORT.add(fortFlag); cyl(0.05, 0.05, 2.4, WD.mat({ color: '#5A4A3A' }), -6.4, 6.2, -1.4, FORT, 6);
  const fGuns = [-3.0, 0.6, 4.2].map((x) => { const g = new THREE.Group(); g.position.set(x, 0.3, 3.4); FORT.add(g); const barrel = cyl(0.17, 0.22, 1.7, WD.mat({ color: '#2A2A33', metalness: 0.4, roughness: 0.4 }), 0, 0.75, 0.3, g); barrel.rotation.x = Math.PI / 2 - 0.08;
    box(0.8, 0.45, 1.1, WD.mat({ map: WD.T.planks('#8A5A36', [0.4, 0.4]) }), 0, 0.3, 0, g); [-0.45, 0.45].forEach((s) => { const w = cyl(0.22, 0.22, 0.1, WD.mat({ color: '#5A3A22' }), s, 0.22, 0.25, g); w.rotation.z = Math.PI / 2; }); return g; });
  // the shot furnace: brick oven with a glowing mouth and red-hot balls on a grate
  const furn = new THREE.Group(); furn.position.set(2.6, 0.3, -1.6); FORT.add(furn);
  const brick = WD.mat({ map: WD.T.brick ? WD.T.brick('#B5553C') : undefined, color: '#B5553C' });
  box(2.4, 1.5, 1.6, brick, 0, 0.75, 0, furn); const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), brick); dome.scale.set(1.2, 0.6, 0.8); dome.position.y = 1.5; dome.castShadow = true; furn.add(dome); cyl(0.2, 0.24, 1.4, brick, 0.6, 2.3, -0.2, furn);
  const mouth = box(1.1, 0.6, 0.05, new THREE.MeshStandardMaterial({ color: '#FF7A2A', emissive: '#FF6A1A', emissiveIntensity: 1.4 }), 0, 0.7, 0.81, furn);
  const glowL = new THREE.PointLight('#FF8A3A', 8, 6, 1.4); glowL.position.set(2.6, 1.4, -0.4); FORT.add(glowL);
  const hotM = new THREE.MeshStandardMaterial({ color: '#FF6A2A', emissive: '#FF5A1A', emissiveIntensity: 1.2 }); for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), hotM); b.position.set(-0.36 + i * 0.24, 0.75, 0.9); furn.add(b); }
  const smoke = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: '#D8D8E0', transparent: true, opacity: 0.6, depthWrite: false })); FORT.add(s); smoke.push(s); }
  const puff = (t) => smoke.forEach((s, i) => { const ph = (t * 0.25 + i / 6) % 1; s.position.set(3.2 + Math.sin(i * 2 + t) * 0.3, 3.0 + ph * 4, -1.8); s.scale.setScalar(0.6 + ph * 1.6); s.material.opacity = 0.6 * (1 - ph); });
  const fortBoard = ST.board(1.5, 0.95); fortBoard.position.set(5.6, 0.3, 0.6); fortBoard.rotation.y = -0.5; FORT.add(fortBoard);
  const bucket = new THREE.Group(); bucket.position.set(1.0, 0.3, -0.6); FORT.add(bucket); cyl(0.25, 0.2, 0.4, WD.mat({ color: '#8A5A36' }), 0, 0.2, 0, bucket); cyl(0.23, 0.23, 0.03, WD.mat({ color: '#A8693E' }), 0, 0.38, 0, bucket);

  // ═════ SET 3: the farm haystack ═════
  const FARM = WD.meadow(E, { fenceOn: true }).scene;
  const hay = new THREE.Group(); hay.position.set(0.8, 0, -2.6); FARM.add(hay); const hayM = WD.mat({ map: WD.T.planks ? WD.T.planks('#E8C25A', [2, 2]) : undefined, color: '#F2CE6A' });
  const hb = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hayM); hb.scale.set(1, 1.3, 1); hb.castShadow = true; hay.add(hb);
  const farmBoard = ST.board(1.5, 0.9); farmBoard.position.set(-2.2, 0, -2.0); farmBoard.rotation.y = 0.35; FARM.add(farmBoard);
  EXTRAS = [fortBoard, farmBoard];

  // ═════ cast ═════
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const captain = mk('captain', 1, 1.8), gunner = mk('gunner', 2, 1.7), enemy = mk('enemy', 3, 1.8), oldgun = mk('oldgun', 4, 1.75), newgun = mk('newgun', 5, 1.62), farmer = mk('farmer', 6, 1.78);
  const all = [captain, gunner, enemy, oldgun, newgun, farmer];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const onTheirs = (p, lx, lz, o) => { const v = theirs.ship.localToWorld(V3(lx, DECK, lz)); act(p, v.x, v.z, o, v.y); };

  // ── S1 · "Old sailing warships didn't just fire cannonballs. Sometimes they fired two balls chained together, spinning like giant nunchucks."
  { const st = 0, fi = Wd('fire', 0), so = Wd('sometimes', 0), ch = Wd('chained', 0), sp = Wd('spinning', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open: a cannon on the gold-banded ship booms; the camera chases two black cannonballs joined by a chain, cartwheeling over the sparkling sea toward the enemy ship', draw(lt, d, t, blit) {
      hideAll(); into(SEA, gunner); sea(t); poseShips(t, 14, -22, 0.6); shred(0);
      act(gunner, 1.2, 1.2, { ...A.face(t, [[st, 'excited'], [so, 'scheme'], [sp, 'laugh']]), armR: A.arm(t, [[st, [60, 60]], [so, [150, -10]]]), ...A.react('cheer', t, sp, 1.0) }, OY + DECK);
      const from = ours.ship.localToWorld(V3(2.4, 1.5, 0.6)), to = theirs.ship.localToWorld(V3(0, 6.0, -3.0)); const k = fly(t, so + 0.2, 4.2, from, to);
      const cp = chainShot.position;
      const c = t < so + 0.2 ? A.camPath(t, [[st, [4.6, 3.4, 4.8], [1.4, 2.4, 0.6], 44], [so + 0.2, [6.4, 3.8, 6.4], [2.6, 2.2, 0.0], 44]]) : { pos: [cp.x + 3.2, cp.y + 1.3, cp.z + 5.6], look: [cp.x, cp.y + 0.1, cp.z], fov: 46 };
      FF = [];
      shoot(SEA, c); blit();
      if (t > so - 0.05 && t < so + 0.6) { const [x, y] = proj(from); ctx.save(); ctx.globalAlpha = 1 - (t - so + 0.05) / 0.65; ctx.fillStyle = '#F4F4F8'; ctx.strokeStyle = INK; ctx.lineWidth = 6; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(x + 40 + i * 30, y - 20 + Math.sin(i) * 30, 50 + i * 8, 0, 7); ctx.fill(); ctx.stroke(); } ctx.restore(); }
    } });
    cue(0.05, 'swoosh', { gain: 0.45, sweep: -0.8 }); cue(Wd('sometimes', 0) + 0.15, 'thud', { gain: 0.5 }); cue(Wd('spinning', 0), 'whoosh', { gain: 0.4 }); }

  // ── S2 · "Picture a captain chasing an enemy ship. He doesn't want to sink it. He wants to steal it." / "So he yells, 'Load the chain shot!'"
  { const st = L(1), ca = Wd('chasing', 1), si = Wd('sink', 1), stl = Wd('steal', 1), ye = L(2), lo = Wd('load', 2), end = L(3);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'at the wheel the captain squints through a spyglass-pose at the green-flagged ship ahead, rubs his hands with a greedy grin, then bellows; the gunner hauls a chained pair of balls to the cannon', draw(lt, d, t, blit) {
      hideAll(); into(SEA, captain, gunner); sea(t); poseShips(t, 6, -30, 0.1); shred(0); chainShot.visible = false;
      act(captain, 1.0, 3.4, { ...A.face(t, [[st, 'scheme'], [si, 'skeptic'], [stl, 'sly'], [ye, 'angry'], [lo, 'excited']]), armR: A.arm(t, [[st, [120, 60]], [si, [40, 40]], [stl, [80, 100]], [ye, [150, -10]]]), ...A.react('point', t, lo, 1.0) }, OY + DECK);
      act(gunner, 1.1, 1.6, { ...A.face(t, [[st, 'content'], [lo, 'excited']]), armR: [30, 30], ...A.react('cheer', t, lo + 0.3, 0.8) }, OY + DECK);
      const c = A.camPath(t, [[st, [3.4, 3.1, 5.6], [1.0, 2.7, 3.2], 42], [stl, [3.0, 3.0, 5.4], [1.0, 2.7, 3.2], 40], [ye + 0.1, [3.6, 3.1, 5.4], [1.0, 2.6, 2.4], 46], [end, [3.8, 3.1, 5.2], [1.0, 2.5, 2.2], 46]]);
      shoot(SEA, c); blit();
    } });
    cue(Wd('steal', 1), 'sparkle', { gain: 0.3 }); cue(Wd('load', 2), 'boing', { gain: 0.3 }); }

  // ── S3 · "The balls fly out, the chain whips open, and it shreds the enemy's sails and ropes like a giant weed whacker." / "Now the enemy ship can't move, and the captain just sails over and takes it."
  { const st = L(3), fl = Wd('fly', 3), wh = Wd('whips', 3), sh = Wd('shreds', 3), we = Wd('weed', 3), no = L(4), mo = Wd('move', 4), ta = Wd('takes', 4), end = L(5);
    add({ id: 'S3', at: st, note: 'from the enemy deck: the chain shot whirls in and slices through the sails, which flop down in tatters; the top-hatted enemy captain gapes; the gold ship glides alongside and our captain hops over and plants his red flag', draw(lt, d, t, blit) {
      hideAll(); into(SEA, enemy, captain); sea(t);
      const ex = lerp(8, 4.2, eo(clamp((t - no) / 2.4))); poseShips(t, ex, -2, 0.0);
      const from = ours.ship.localToWorld(V3(2.4, 1.5, 0.6)), to = theirs.ship.localToWorld(V3(0, 6.2, -3.0)); fly(t, st, 1.0, from, to);
      shred(eo(clamp((t - sh) / 0.6)));
      onTheirs(enemy, 0.3, 1.6, { ...A.face(t, [[st, 'proud'], [wh, 'shock'], [sh, 'gasp'], [mo, 'sad'], [ta, 'angry']]), ...A.react('shock', t, sh, 0.8) });
      const cv = t > ta - 0.3 ? theirs.ship.localToWorld(V3(-0.6, DECK, 2.2)) : ours.ship.localToWorld(V3(1.2, DECK, 2.4));
      act(captain, cv.x, cv.z, { ...A.face(t, [[st, 'excited'], [mo, 'sly'], [ta, 'proud']]), holdR: t > ta - 0.3 ? flagP : undefined, armR: t > ta - 0.3 ? [150, -10] : [30, 30], ...A.react('proud', t, ta, 1.2) }, cv.y);
      const tp = theirs.ship.position;
      const c = A.camPath(t, [[st, [tp.x + 3.6, 4.0, 5.2], [tp.x, 5.4, -2.6], 50], [sh + 0.6, [tp.x + 3.4, 3.4, 5.4], [tp.x + 0.2, 3.2, 0.6], 48], [no + 0.3, [2.0, 7.0, 12.0], [2.0, 2.2, 0.0], 48], [ta - 0.2, [2.6, 3.4, 7.0], [3.6, 2.6, 0.8], 44], [end, [2.8, 3.3, 6.6], [3.8, 2.6, 0.8], 42]]);
      shoot(SEA, c); blit();
    } });
    cue(Wd('whips', 3), 'whoosh', { gain: 0.4 }); cue(Wd('shreds', 3), 'zip', { gain: 0.4 }); cue(Wd('weed', 3), 'sizzle', { gain: 0.25 }); cue(Wd('takes', 4), 'ding', { gain: 0.3 }); }

  // ── S4 · "But forts on land had something worse. They baked cannonballs in a furnace until they glowed red hot."
  { const st = L(5), wo = Wd('worse', 5), ba = Wd('baked', 5), fu = Wd('furnace', 5), gl = Wd('glowed', 5), end = L(6);
    add({ id: 'S4', at: st, trans: 'dissolve', note: 'a sunny stone fort on a sea cliff, cannons poking over the wall; the camera swoops to a brick shot furnace with a blazing mouth where the old gunner lifts a glowing red cannonball with long tongs', draw(lt, d, t, blit) {
      hideAll(); into(FORT, oldgun); puff(t); mouth.material.emissiveIntensity = 1.3 + 0.3 * Math.sin(t * 9); glowL.intensity = 7 + 2 * Math.sin(t * 7);
      fortBoard.draw([['SHOT', '#FFFFFF', 80, 120], ['FURNACE', '#F2C230', 80, 230], ['HOT!', '#FF8A80', 70, 330]]);
      act(oldgun, 2.0, 0.2, { ...A.face(t, [[st, 'content'], [wo, 'sly'], [gl, 'proud']]), holdR: t > fu ? tongs : undefined, armR: t > fu ? [140, 0] : [30, 30], ...A.react('proud', t, gl, 1.0) }, 0.3);
      const c = A.camPath(t, [[st, [6.0, 5.4, 14.0], [-1.0, 1.6, 0.0], 46], [ba, [4.2, 2.4, 5.4], [2.4, 1.4, -0.6], 44], [end, [3.6, 2.1, 3.6], [2.3, 1.6, -0.4], 42]]);
      shoot(FORT, c); blit();
    } });
    cue(Wd('worse', 5), 'thud', { gain: 0.3 }); cue(Wd('glowed', 5), 'sizzle', { gain: 0.35 }); }

  // ── S5 · "The new gunner asks, 'Uh, won't a red hot ball set off the gunpowder?'" / "The old gunner says, 'That's why we pack in wet clay first.'"
  { const st = L(6), uh = Wd('uh', 6), gp = Wd('gunpowder', 6), ol = L(7), cl = Wd('clay', 7), fi = Wd('first', 7), end = L(8);
    add({ id: 'S5', at: st, note: 'by the cannon: the young gunner in a blue cap backs away nervously from the glowing ball; the old gunner slaps a dripping lump of wet clay into his hand with a smug look', draw(lt, d, t, blit) {
      hideAll(); into(FORT, oldgun, newgun); puff(t);
      act(newgun, 0.2, 2.0, { ...A.face(t, [[st, 'worried'], [uh, 'worried'], [gp, 'shock'], [cl, 'skeptic'], [fi, 'happy']]), sweat: t < cl ? 1 : 0, holdR: t > cl ? clay : undefined, armR: t > cl ? [100, 30] : [150, 20], armL: [150, -20], dx: t < ol ? -0.2 * eo(clamp((t - gp) / 0.5)) : 0, ...A.react('shock', t, gp, 0.6) }, 0.3);
      act(oldgun, 1.4, 1.9, { ...A.face(t, [[st, 'content'], [gp, 'skeptic'], [ol, 'sly'], [fi, 'proud']]), holdR: t < ol ? tongs : undefined, holdL: t > ol && t < cl ? clay : undefined, armL: A.arm(t, [[ol, [30, 30]], [ol + 0.3, [100, 40]], [cl + 0.2, [30, 30]]]), armR: t < ol ? [130, 10] : [30, 30] }, 0.3);
      const c = A.camPath(t, [[st, [0.6, 2.0, 3.9], [0.7, 1.8, 1.9], 50], [ol, [1.1, 2.0, 3.9], [1.0, 1.8, 1.9], 50], [end, [1.0, 2.0, 3.8], [0.9, 1.8, 1.9], 48]]);
      shoot(FORT, c); blit();
    } });
    cue(Wd('gunpowder', 6), 'boing', { gain: 0.3 }); cue(Wd('clay', 7), 'plop', { gain: 0.4 }); }

  // ── S6 · "You see, wooden ships were basically floating piles of firewood, painted in tar." / "One glowing ball gets stuck in the wood, and the ship starts burning from the inside."
  { const st = L(8), wo = Wd('wooden', 8), fi = Wd('firewood', 8), ta = Wd('tar', 8), on = L(9), st2 = Wd('stuck', 9), bu = Wd('burning', 9), end = L(10);
    add({ id: 'S6', at: st, trans: 'dissolve', note: 'the green-flagged ship at sea, a board on the fort wall in the foreground reads FIREWOOD + TAR; a glowing ball streaks in and sticks in the hull with a hiss, and cartoon flames bloom from inside', draw(lt, d, t, blit) {
      hideAll(); into(SEA, enemy); sea(t); poseShips(t, 0, -8, 0.0); shred(0); chainShot.visible = false;
      theirs.sails.forEach((s) => s.scale.set(1, 1, 1));
      onTheirs(enemy, 0.4, 1.2, { ...A.face(t, [[st, 'content'], [fi, 'skeptic'], [st2, 'shock'], [bu, 'gasp']]), sweat: t > bu ? 1 : 0, ...A.react('shock', t, st2 + 0.1, 0.8) });
      const hitP = theirs.ship.localToWorld(V3(1.8, 1.3, 1.4));
      const c = A.camPath(t, [[st, [9.0, 4.4, 4.0], [0.0, 2.4, -8.0], 44], [on, [7.0, 2.8, -1.0], [1.2, 2.2, -7.0], 46], [end, [6.4, 2.7, -1.8], [1.4, 2.2, -6.8], 46]]);
      shoot(SEA, c); blit();
      const lbl = (k) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = k; ctx.translate(CW / 2, 360); ctx.rotate(-0.04); ctx.fillStyle = '#2E5A46'; ctx.strokeStyle = '#9A6A3E'; ctx.lineWidth = 16; ctx.beginPath(); ctx.roundRect(-330, -110, 660, 220, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#FFFFFF'; ctx.font = '900 76px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FIREWOOD', 0, -14); ctx.fillStyle = '#F2C230'; ctx.fillText('+ TAR', 0, 76); ctx.restore(); };
      lbl(t < on ? clamp((t - fi + 0.2) / 0.3) : 1 - clamp((t - on) / 0.3));
      const [hx, hy] = proj(hitP); const k = clamp((t - st2 + 0.4) / 0.4);
      if (k > 0 && k < 1) { const [sx, sy] = [CW * 1.1, CH * 0.1]; ctx.save(); ctx.fillStyle = '#FF7A2A'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(lerp(sx, hx, k), lerp(sy, hy, k), 22, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
      if (t > st2) { ctx.save(); ctx.fillStyle = '#FF7A2A'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(hx, hy, 20, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); flames(hx, hy, eo(clamp((t - bu + 0.3) / 1.2)), t, 2.0); }
    } });
    cue(Wd('see', 8), 'swoosh', { gain: 0.3 }); cue(Wd('stuck', 9), 'thud', { gain: 0.4 }); cue(Wd('stuck', 9) + 0.15, 'sizzle', { gain: 0.35 }); }

  // ── S7 · "It's like tossing one hot coal into a haystack. You don't need a big hit. Just one that sticks."
  { const st = L(10), to = Wd('tossing', 10), ha = Wd('haystack', 10), bi = Wd('big', 10), ju = Wd('just', 10), sti = Wd('sticks', 10), end = L(11);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'a sunny farm: a farmer in a cowboy hat flicks one glowing coal at a big round haystack; a thin curl of smoke, then flames; the board says JUST ONE THAT STICKS', draw(lt, d, t, blit) {
      hideAll(); into(FARM, farmer);
      farmBoard.draw(t < bi ? [['1 HOT COAL', '#FFFFFF', 76, 140], ['+ HAY', '#F2C230', 76, 260]] : [['JUST ONE', '#FFFFFF', 80, 140], ['THAT STICKS', '#F2C230', 72, 260]]);
      act(farmer, -0.8, -0.6, { ...A.face(t, [[st, 'scheme'], [to, 'sly'], [ha, 'shock'], [ju, 'sly']]), holdR: t < to + 0.2 ? coal : undefined, armR: A.arm(t, [[st, [80, 60]], [to, [150, -20]], [to + 0.5, [40, 40]]]), ...A.react('shock', t, ha + 0.3, 0.7) });
      const c = A.camPath(t, [[st, [-1.6, 1.8, 3.4], [-0.2, 1.4, -1.4], 46], [ha, [-1.4, 2.0, 4.0], [0.2, 1.4, -1.8], 48], [end, [-1.8, 2.0, 4.2], [-0.4, 1.4, -1.8], 48]]);
      shoot(FARM, c); blit();
      const hp = V3(0.6, 1.2, -1.4); const [hx, hy] = proj(hp); const k = clamp((t - to - 0.2) / 0.6);
      if (k > 0 && k < 1) { const [x0, y0] = proj(farmer.group.position.clone().add(V3(0.3, 1.4, 0))); ctx.save(); ctx.fillStyle = '#FF7A2A'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lerp(x0, hx, k), lerp(y0, hy, k) - Math.sin(k * Math.PI) * 120, 16, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
      if (t > to + 0.8) flames(hx, hy + 40, eo(clamp((t - ju) / 1.0)) * 1.2 + 0.15, t, 1.1);
    } });
    cue(Wd('tossing', 10) + 0.2, 'whoosh', { gain: 0.3 }); cue(Wd('sticks', 10), 'sizzle', { gain: 0.35 }); }

  // ── S8 · "Sailors even had a saying: a ship's a fool to fight a fort." / "Because ships fight with cannons, and forts fight with ovens."
  { const st = L(11), sa = Wd('saying', 11), fo = Wd('fool', 11), be = L(12), ca = Wd('cannons', 12), ov = Wd('ovens', 12), end = T.dur;
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'back at the fort: the old gunner and the young one wave cheerfully from the wall; the board reads FORT 1 · SHIPS 0; on "ovens" the old gunner raises a glowing ball in the tongs like a trophy', draw(lt, d, t, blit) {
      hideAll(); into(FORT, oldgun, newgun); puff(t);
      fortBoard.draw(t < be ? [['A SHIP\'S A FOOL', '#FFFFFF', 64, 140], ['TO FIGHT A FORT', '#F2C230', 64, 260]] : [['FORT 1', '#F2C230', 90, 140], ['SHIPS 0', '#FF8A80', 90, 270]]);
      act(oldgun, 3.4, 1.4, { ...A.face(t, [[st, 'proud'], [ca, 'sly'], [ov, 'laugh']]), holdR: t > ov - 0.3 ? tongs : undefined, armR: t > ov - 0.3 ? [150, -10] : [120, 20], ...A.react('laugh', t, ov, 1.4) }, 0.3);
      act(newgun, 4.6, 1.8, { ...A.face(t, [[st, 'happy'], [fo, 'laugh']]), armR: [150, -20], ...A.react('cheer', t, fo, 1.2) }, 0.3);
      const c = A.camPath(t, [[st, [3.4, 2.1, 3.9], [4.4, 1.8, 1.0], 52], [be, [3.6, 2.0, 3.9], [4.4, 1.8, 1.0], 50], [end, [3.8, 2.0, 3.8], [4.3, 1.8, 1.2], 48]]);
      shoot(FORT, c); blit();
    } });
    cue(Wd('fool', 11), 'boing', { gain: 0.3 }); cue(Wd('ovens', 12), 'ding', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
