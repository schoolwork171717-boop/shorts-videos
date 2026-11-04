// THE TRAIN TRACK THAT BENT IN THE SUN: the shot list (Iron Canyon 3D).
// Why crews heat or stretch welded rail before they lock it down: old jointed track had gaps, welded rail has none,
// heat makes it shove sideways into a "sun kink" (Texas, July 4 2012: 43 coal cars derailed), so the rail is laid
// already "summer-long".
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
  foreman: { body: '#A8382A', pattern: 'plaid', patCol: '#2A1A22', straps: '#3A2E2A', hat: 'bowler', hatCol: '#5E5248', hair: '#D2D3D9', extra: ['beard'], beardCol: '#C4C5CB' },
  welder: { body: '#3FA7A0', pattern: 'jacket', patCol: '#2C7C78', hat: 'railcap', hatCol: '#3E5C9A', hair: '#8A5A36', neck: 'scarf', neckCol: '#C8372E' },
  rookie: { body: '#7FA24A', pattern: 'jacket', patCol: '#5E7E34', belt: '#3A2E2A', hat: 'workcap', hatCol: '#55565E', hair: '#8A5A36', hairSide: -1 },
  oldhand: { body: '#7A6248', pattern: 'jacket', patCol: '#5A4634', hat: 'cowboy', hatCol: '#6E5038', hair: '#B9BAC0', extra: ['mustache'], mustacheCol: '#B9BAC0' },
  driver: { body: '#3C6FB6', pattern: 'jacket', patCol: '#2C5288', hat: 'railcap', hatCol: '#2A2A33', band: '#F4F4F8', hair: '#3A2A22', extra: ['mustache'], mustacheCol: '#3A2A22' },
};
const person = (k) => new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] });

// a rail torch, drawn in the cut-out style (the 3D flame is added at its tip)
const P2 = {
  torch: (g, x, y) => { g.save(); g.translate(x, y); g.rotate(0.9); g.strokeStyle = INK; g.lineWidth = 5;
    g.fillStyle = '#C9A13B'; g.beginPath(); g.roundRect(-10, -20, 20, 120, 6); g.fill(); g.stroke();
    g.fillStyle = '#4A4A55'; g.beginPath(); g.roundRect(-6, -150, 12, 134, 4); g.fill(); g.stroke();
    g.fillStyle = '#2A2A33'; g.beginPath(); g.roundRect(-12, -176, 24, 30, 5); g.fill(); g.stroke(); g.restore(); },
};

export function buildShots(E) {
  const S = [], CUES = [], add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); if (!o.noMotes) FX.motes(t, { n: 22, col: '255,236,200' }); if (o.shafts) FX.shafts(t, { k: o.shafts }); }; S.push(o); return o; }, cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
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

  // ── the set: a rail line across red-rock desert, running along -z at x 0; mesas behind, cliff on the right ──
  const D = new THREE.Scene(); WD.sky(D, { top: CY.PAL.sky, horizon: '#CFE0F5' });
  WD.sunlight(D, E, { col: '#FFF0D6', i: 3.1, pos: [-12, 18, 8], target: [0, 0, -4], box: 16, sky: '#CFE2FF', ground: '#C4703E', hemi: 1.2 });
  CY.haze(D, { col: '#B9A6D8', near: 70, far: 460, floorY: -2 });
  WD.clouds(D, [[-60, 50, -200, 30], [30, 60, -240, 36], [-140, 40, -150, 24], [90, 45, -180, 26]]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), WD.mat({ map: WD.T.dirt(CY.PAL.dirt, [90, 90], false) })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; D.add(ground);
  [[-70, -150, 0.3, 7, 26], [60, -210, -0.2, 9, 32], [-160, -260, 0.1, 3, 22], [140, -120, -0.6, 5, 20]].forEach(([x, z, ry, sd, h]) => { const c = CY.cliff({ w: 120, h, y0: -1, ledge: 3.2, setback: 1.2, seed: sd, seg: [60, 30], rim: 50 }); c.position.set(x, 0, z); c.rotation.y = ry; D.add(c); });
  const wall = CY.cliff({ w: 300, h: 34, y0: -1, ledge: 1.9, setback: 0.45, seed: 2, seg: [160, 90] }); wall.rotation.y = -Math.PI / 2; wall.position.set(26, 0, -80); D.add(wall);
  for (let z = 10; z > -190; z -= 16) { const p = WD.pole(7.5); p.position.set(-4.2, 0, z); p.rotation.y = Math.PI / 2; D.add(p); if (z > -180) D.add(WD.wire(V3(-4.2, 7.0, z), V3(-4.2, 7.0, z - 16), 0.4)); }
  for (let i = 0; i < 40; i++) { const sd = rnd(i * 7) > 0.5 ? 1 : -1; const c = CY.cactus(0.5 + rnd(i) * 0.6, rnd(i * 3) > 0.55 ? 'saguaro' : 'pear'); c.position.set(sd * (5.5 + rnd(i * 5) * 14), 0, 12 - i * 5.5); D.add(c); }
  D.add(CY.rocks(1400, [-24, 24, -200, 16], 0));
  const bed = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 240), WD.mat({ map: WD.T.dirt('#9C8A78', [1, 60], false) })); bed.position.set(0, 0.09, -100); bed.receiveShadow = true; D.add(bed);

  // ── the track: rails + ties as instanced pieces so they can bend (off(z) = sideways offset) or split into joints ──
  const Z0 = 18, Z1 = -200, SEG = 0.4, N = Math.ceil((Z0 - Z1) / SEG), TIE = 0.62, NT = Math.floor((Z0 - Z1) / TIE);
  const steel = new THREE.MeshStandardMaterial({ color: '#86807A', roughness: 0.32, metalness: 0.75 });
  const railIM = [-0.72, 0.72].map(() => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.15, 1), steel, N); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; D.add(m); return m; });
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.12, 0.24), WD.mat({ color: '#5A3E2A', roughness: 0.9 }), NT); ties.receiveShadow = ties.castShadow = true; ties.frustumCulled = false; D.add(ties);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(), PO = new THREE.Vector3(), UP = V3(0, 1, 0);
  // jointed mode: pieces `joint` metres long with a gap of `gap` metres between them
  const layTrack = ({ off = () => 0, joint = 0, gap = 0 } = {}) => {
    for (let i = 0; i < N; i++) {
      const za = Z0 - i * SEG, zb = za - SEG, zm = (za + zb) / 2;
      let len = SEG * 1.02, zc = zm;
      if (joint) { const pa = (Z0 - za) % joint, pb = pa + SEG; if (pb > joint - gap) { const keep = Math.max(0, joint - gap - pa); len = keep; zc = za - keep / 2; } }
      const yaw = Math.atan2(off(za) - off(zb), SEG);
      Q.setFromAxisAngle(UP, yaw);
      [-0.72, 0.72].forEach((dx, r) => { PO.set(off(zc) + dx * Math.cos(yaw), 0.375, zc); SC.set(1, 1, Math.max(0.0001, len)); M4.compose(PO, Q, SC); railIM[r].setMatrixAt(i, M4); });
    }
    for (let i = 0; i < NT; i++) { const z = Z0 - i * TIE - 0.2, yaw = Math.atan2(off(z + 0.2) - off(z - 0.2), 0.4); Q.setFromAxisAngle(UP, yaw); PO.set(off(z), 0.24, z); SC.set(1, 1, 1); M4.compose(PO, Q, SC); ties.setMatrixAt(i, M4); }
    railIM.forEach((m) => (m.instanceMatrix.needsUpdate = true)); ties.instanceMatrix.needsUpdate = true;
  };
  const kink = (zc, amp, w = 9) => (z) => { const u = (z - zc) / w; return Math.abs(u) > 1.6 ? 0 : amp * Math.sin(u * Math.PI * 1.25) * Math.exp(-u * u * 1.6); };

  // heated glow on a stretch of rail + a 3D torch flame
  const glowM = new THREE.MeshBasicMaterial({ color: '#FF7A2A', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.175, 1.6), glowM); D.add(glow);
  const flameM = new THREE.MeshBasicMaterial({ color: '#FFB347', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32, 10), flameM); flame.visible = false; D.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.2, 10), new THREE.MeshBasicMaterial({ color: '#BFE4FF', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })); flame2.visible = false; D.add(flame2);
  const heat = (on, rx, z, len, t) => { glow.visible = on > 0; glowM.opacity = on * (0.75 + Math.sin(t * 9) * 0.08); glow.scale.z = len / 1.6; glow.position.set(rx, 0.375, z); };
  const torchAt = (on, x, z, t) => { flame.visible = flame2.visible = on; if (!on) return; const f = 1 + Math.sin(t * 37) * 0.12 + Math.sin(t * 23) * 0.08; flame.position.set(x, 0.6, z); flame.rotation.z = Math.PI; flame.scale.set(1, f, 1); flame2.position.set(x, 0.62, z); flame2.rotation.z = Math.PI; flame2.scale.set(1, f, 1); };

  // the hydraulic rail stretcher: a yellow frame clamped across a cut in one rail
  const jack = new THREE.Group(); D.add(jack); jack.visible = false;
  { const y = WD.mat({ color: '#E2B33C', roughness: 0.5, metalness: 0.2 }), dk = WD.mat({ color: '#2A2830', roughness: 0.5, metalness: 0.4 });
    const bx = (w, h, d, m, x, yy, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, yy, z); b.castShadow = true; jack.add(b); return b; };
    bx(0.34, 0.16, 1.5, y, 0.2, 0.36, 0); [-0.62, 0.62].forEach((z) => bx(0.42, 0.3, 0.16, dk, 0.05, 0.3, z));
    [-0.2, 0.2].forEach((z) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 12), WD.mat({ color: '#C4CAD2', metalness: 0.8, roughness: 0.2 })); c.rotation.x = Math.PI / 2; c.position.set(0.3, 0.36, z * 2); jack.add(c); }); }

  // the coal train (a plain unbranded diesel + hopper cars), heading toward -z
  const coal = new THREE.Group(); D.add(coal); coal.visible = false;
  const cars = [];
  { const gray = WD.mat({ color: '#4A4A55', roughness: 0.6, metalness: 0.3 }), black = WD.mat({ color: '#1E1D24', roughness: 0.9 }), red = WD.mat({ color: '#B5372E', roughness: 0.5 }), cream = WD.mat({ color: '#F2E6CF' });
    const bx = (g, w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    const wheelsOn = (g, zs) => zs.forEach((z) => [-0.72, 0.72].forEach((x) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 16), black); w.rotation.z = Math.PI / 2; w.position.set(x, 0.62, z); g.add(w); }));
    const glass = new THREE.MeshStandardMaterial({ color: '#BFD9F5', emissive: '#6F8FB8', emissiveIntensity: 0.3 });
    const loco = new THREE.Group(); coal.add(loco); cars.push(loco);
    bx(loco, 2.9, 0.4, 17, black, 0, 1.15, 0); bx(loco, 2.4, 2.4, 11, red, 0, 2.55, 2.2); bx(loco, 2.9, 3.0, 3.4, red, 0, 2.85, -5.0); bx(loco, 2.95, 0.4, 3.6, cream, 0, 4.4, -5.0);
    [-1.46, 1.46].forEach((x) => { const wnd = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), glass); wnd.position.set(x * 1.001, 3.4, -5.0); wnd.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; loco.add(wnd); });
    bx(loco, 2.9, 0.28, 0.2, cream, 0, 1.5, -8.5); wheelsOn(loco, [-6, -4.6, 4.6, 6]);
    for (let i = 0; i < 6; i++) { const c = new THREE.Group(); coal.add(c); cars.push(c);
      bx(c, 3.0, 2.6, 15, gray, 0, 2.3, 0); bx(c, 2.7, 0.5, 14.4, black, 0, 3.7, 0);
      for (let k = 0; k < 6; k++) { const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), black); lump.position.set((rnd(i * 9 + k) - 0.5) * 1.6, 3.9, -6 + k * 2.4); c.add(lump); }
      bx(c, 3.1, 0.3, 15.2, black, 0, 1.0, 0); wheelsOn(c, [-6, -4.8, 4.8, 6]); }
  }
  const CAR_GAP = 17.2;
  // lay the coal train along the track; head at z = hz. tip(i) = how far car i has come off (0..1)
  const placeCoal = (hz, tip = () => 0, off = () => 0) => { coal.visible = true; cars.forEach((c, i) => { const z = hz + i * CAR_GAP, k = tip(i), sd = i % 2 ? 1 : -1; c.visible = true;
    c.position.set(off(z) + sd * k * (2.6 + i * 0.3), Math.sin(k * Math.PI) * 0.3, z + k * i * 0.8); c.rotation.set(0, sd * k * (0.35 + rnd(i) * 0.3), sd * k * (1.1 + rnd(i * 3) * 0.3)); }); };
  // dust puffs
  const dustTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 60); gr.addColorStop(0, 'rgba(225,190,150,1)'); gr.addColorStop(0.7, 'rgba(215,175,135,0.7)'); gr.addColorStop(1, 'rgba(215,175,135,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const dust = []; for (let i = 0; i < 24; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false })); s.visible = false; D.add(s); dust.push(s); }
  const dustAt = (zc, k) => dust.forEach((s, i) => { s.visible = k > 0.02; if (!s.visible) return; const a = clamp(k * 1.4 - rnd(i) * 0.3); s.position.set((rnd(i * 2) - 0.5) * 12 * (0.4 + a), 1 + a * 4 * rnd(i * 5), zc + (rnd(i * 7) - 0.3) * 60); const sc = 2 + a * 7; s.scale.set(sc, sc, 1); s.material.opacity = Math.min(0.85, a) * (1 - a * 0.5); });

  // the crew
  const foreman = person('foreman'), welder = person('welder'), rookie = person('rookie'), oldhand = person('oldhand'), driver = person('driver');
  const all = [foreman, welder, rookie, oldhand, driver]; all.forEach((p) => D.add(p.group));
  const reset = () => { all.forEach((p) => (p.group.visible = false)); heat(0, 0, 0, 1, 0); torchAt(false); jack.visible = false; coal.visible = false; dust.forEach((s) => (s.visible = false)); layTrack(); };
  const stand = (p, x, z, st = {}, y = 0) => { p.group.visible = true; p.at(x, y, z).set({ bob: st.legs === 'walk' ? 0 : idle(x * 3 + z), ...st }); };

  // 2D overlays
  const sunGlare = (k) => { if (k <= 0) return; const g = ctx.createRadialGradient(CW * 0.78, CH * 0.1, 20, CW * 0.78, CH * 0.1, CW * 0.9); g.addColorStop(0, `rgba(255,248,214,${0.95 * k})`); g.addColorStop(0.18, `rgba(255,214,120,${0.55 * k})`); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
    ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#FF8A3A'; ctx.fillRect(0, 0, CW, CH); ctx.globalAlpha = 1; };
  const sepia = (k) => { if (k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = 0.55 * k; ctx.fillStyle = '#8A6A44'; ctx.fillRect(0, 0, CW, CH); ctx.restore();
    ctx.globalAlpha = 0.12 * k; ctx.fillStyle = '#F2D9A8'; ctx.fillRect(0, 0, CW, CH); ctx.globalAlpha = 1; };
  const thermo = (x, y, v, label) => { // v 0..1
    ctx.save(); ctx.translate(x, y); ctx.lineWidth = 10; ctx.strokeStyle = INK; ctx.fillStyle = '#FFFDF4';
    ctx.beginPath(); ctx.roundRect(-34, -330, 68, 330, 34); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 30, 62, 0, 7); ctx.fill(); ctx.stroke();
    const col = v > 0.7 ? '#E2402E' : v > 0.4 ? '#F08A3A' : '#3C6FB6'; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 30, 44, 0, 7); ctx.fill(); const h = 40 + v * 250; ctx.beginPath(); ctx.roundRect(-16, -h, 32, h + 20, 16); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 5; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(34, -60 - k * 46); ctx.lineTo(56, -60 - k * 46); ctx.stroke(); }
    if (label) { ctx.font = '900 64px Inter'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.strokeText(label, 0, -370); ctx.fillStyle = '#FFFFFF'; ctx.fillText(label, 0, -370); }
    ctx.restore(); };
  const big = (txt, x, y, s, k, col = '#FFFFFF') => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.font = `900 ${s}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
  const arrows = (x0, x1, y, k) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.strokeStyle = INK; ctx.fillStyle = '#E2B33C'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
    [[x0, -1], [x1, 1]].forEach(([x, s]) => { ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + s * 70, y); ctx.lineTo(x, y + 34); ctx.lineTo(x, y + 14); ctx.lineTo(x - s * 50, y + 14); ctx.lineTo(x - s * 50, y - 14); ctx.lineTo(x, y - 14); ctx.closePath(); ctx.fill(); ctx.stroke(); }); ctx.restore(); };

  const WZ = -2;            // where the welding happens (rail at x +0.72)
  // ── S01 · "Why do railroad crews heat up a steel rail" — low close: the welder's torch, the rail glowing ──
  { const st = cut(0);
    add({ id: 'S01', at: st, shafts: 0.8, note: 'low on the rail: the welder crouches with a torch, the rail glows orange; slow push-in', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d)), on = clamp(lt / 0.8);
      stand(welder, 1.35, WZ, { mood: 'strain', armR: [40, 30], holdR: P2.torch, lean: -10, blink: blink(t) }, -0.35);
      stand(foreman, -1.5, WZ - 2.2, { mood: 'deadpan', armL: [12, 40], blink: blink(t, 1.1) });
      heat(on, 0.72, WZ, 1.6, t); torchAt(true, 0.8, WZ + 0.2, t);
      shoot(D, all, V3(2.6, 0.75, WZ + 4.2), V3(2.0, 0.62, WZ + 3.0), V3(0.6, 0.45, WZ - 0.6), null, k);
      blit();
    } });
    cue(st + 0.05, 'whoosh', { gain: 0.5 }); cue(st + 0.2, 'sizzle', { dur: 2.2, gain: 0.5 }); }

  // ── S02 · "before they lock it down?" — the foreman swings the maul onto a spike ──
  { const st = cut(1), hit = Wd('lock', 1);
    add({ id: 'S02', at: st, note: 'the foreman swings his spike maul down on "lock"; tiny shake', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d)), sw = clamp((t - (hit - 0.35)) / 0.35);
      stand(foreman, 1.25, WZ - 1.4, { mood: t > hit ? 'smug' : 'strain', armR: tween([160, 10], [40, 20], t, hit - 0.3, 0.3), holdR: PROPS.maul, lean: lerp(4, -12, sw), blink: blink(t) });
      stand(welder, -1.6, WZ - 3.4, { mood: 'deadpan', armR: [20, -60], holdR: P2.torch, blink: blink(t, 0.7) });
      heat(0.5, 0.72, WZ, 1.6, t);
      shoot(D, all, V3(3.6, 1.3, WZ + 3.2), V3(3.2, 1.2, WZ + 2.6), V3(0.8, 0.9, WZ - 1.6), null, k, LK, t > hit && t < hit + 0.2 ? 0.02 : 0, t);
      blit();
    } });
    cue(hit, 'thud', { gain: 1.0 }); cue(hit + 0.02, 'ding', { gain: 0.5 }); }

  // ── S03 · "Old track came in short pieces," — old days (sepia): jointed rails, camera low along the joints ──
  const J = 11.9, GAP = 0.16;
  { const st = cut(2);
    add({ id: 'S03', at: st, note: 'sepia "old days": short rail pieces with joints; camera glides low along the rail', draw(lt, d, t, blit) {
      reset(); layTrack({ joint: J, gap: GAP }); const k = drift(clamp(lt / d));
      stand(oldhand, 1.5, -12, { mood: 'content', armR: [20, -100], holdR: PROPS.cup, blink: blink(t) });
      shoot(D, all, V3(1.9, 1.5, 6), V3(1.7, 1.4, 2), V3(0.5, 0.35, -14), null, k);
      blit(); sepia(1);
    } });
    cue(st, 'whoosh'); }

  // ── S04 · "with little gaps for the steel to grow in the heat." — close on a gap; it shrinks as it heats ──
  { const st = cut(3), gw = Wd('grow', 3);
    add({ id: 'S04', at: st, note: 'macro on one joint: the gap between rail ends; on "grow" the ends creep together, thermometer rises', draw(lt, d, t, blit) {
      reset(); const g = lerp(GAP * 1.6, 0.03, eio(seg(t, gw - 0.2, gw + 0.8))); layTrack({ joint: J, gap: g }); const k = drift(clamp(lt / d));
      const zj = Z0 - J * 2 + g / 2;            // centre of the second joint
      shoot(D, all, V3(1.25, 0.8, zj + 1.2), V3(1.15, 0.72, zj + 0.95), V3(0.72, 0.4, zj), null, k, { ...LK, focus: 1.2, aperture: 0.002, maxblur: 0.01 });
      blit(); sepia(1); thermo(900, 760, lerp(0.25, 0.8, seg(t, gw - 0.2, gw + 0.8)));
    } });
    cue(st + 0.05, 'pop', { gain: 0.5 }); cue(gw, 'slide', { gain: 0.6 }); }

  // ── S05 · "That's the clickety-clack." — the train rolls over the joints: click, clack ──
  { const st = cut(4);
    add({ id: 'S05', at: st, note: 'side view near rail height: the train rolls over the joints, camera tracks along; a bump at each gap', draw(lt, d, t, blit) {
      reset(); layTrack({ joint: J, gap: GAP }); const k = clamp(lt / d), hz = lerp(-20, -40, k);
      placeCoal(hz); cars.forEach((c, i) => { c.position.y = Math.max(0, Math.sin((hz + i * CAR_GAP) * 1.7) * 0.03); });
      shoot(D, all, V3(15, 2.4, hz + 22), V3(15, 2.4, hz + 16), V3(0, 1.8, hz + 13), V3(0, 1.8, hz + 7), drift(k), { ...LK, aperture: 0 });
      blit(); sepia(1);
    } });
    for (let i = 0; i < 6; i++) cue(cut(4) + 0.08 + i * 0.18, 'tock', { gain: i % 2 ? 0.6 : 0.9 }); }

  // ── S06 · "Today, the rail is welded into one long ribbon." — colour returns; seamless rail to the horizon, crane up ──
  { const st = cut(5);
    add({ id: 'S06', at: st, shafts: 1, note: 'colour again: one seamless rail running to the horizon; camera cranes up from the rail', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d));
      stand(welder, 1.6, -3, { mood: 'proud', armL: [150, 10], holdR: P2.torch, blink: blink(t) });
      shoot(D, all, V3(0.9, 0.6, 5), V3(1.6, 6.0, 9), V3(0.7, 0.3, -6), V3(0, 0, -70), k, { ...LK, fov: lerp(40, 46, k) });
      blit(); sepia(1 - clamp(lt / 0.35)); FX.sparkle(560, 1000, t, clamp((lt - 0.6) / 0.3) * (1 - clamp((lt - 1.6) / 0.4)), 70);
    } });
    cue(st, 'whoosh', { gain: 0.9 }); cue(st + 0.1, 'sparkle', { gain: 0.4 }); }

  // ── S07 · "No gaps. Nowhere to grow." — the rookie looks down the rail, worried ──
  { const st = cut(6);
    add({ id: 'S07', at: st, shafts: 0.6, note: 'the rookie by the rail looking for a gap, worried; push-in', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d));
      stand(rookie, 1.45, -1, { mood: 'worried', look: [-0.6, 0.5], armL: [40, -40], blink: blink(t) });
      shoot(D, all, V3(3.0, 1.4, 2.6), V3(2.6, 1.3, 1.8), V3(0.9, 0.9, -1.8), null, k);
      blit(); { const [hx, hy] = headXY(rookie, 1.55); FX.sweat(hx + 120, hy - 40, clamp((lt - 0.4) / 0.3)); }
    } });
    cue(st, 'tock', { gain: 0.6 }); }

  // ── S08 · "So on a scorching day, the steel shoves against itself," — glaring sun, thermometer climbs ──
  { const st = cut(7);
    add({ id: 'S08', at: st, shafts: 1, note: 'blazing sun glare, the rail straining (tiny shudder), thermometer in the red; crew wiping brows', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d)), wob = Math.sin(t * 31) * 0.004 * clamp(lt / 1.2);
      layTrack({ off: (z) => wob * Math.sin(z * 0.8) });
      stand(oldhand, -1.7, -6, { mood: 'tired', armR: [150, 70], blink: blink(t) }); stand(rookie, 1.8, -5, { mood: 'worried', armL: [150, 70], blink: blink(t, 0.6) });
      shoot(D, all, V3(0.3, 1.6, 6), V3(0.1, 1.4, 4.4), V3(0, 0.5, -24), null, k, LK, 0.004, t);
      blit(); sunGlare(clamp(lt / 0.6)); thermo(900, 820, lerp(0.6, 1, clamp(lt / d)));
    } });
    cue(st, 'whoosh', { gain: 0.6 }); }

  // ── S09 · "until the track jumps sideways into a squiggle." — the kink snaps out ──
  const KZ = -20;
  { const st = cut(8), jw = Wd('jumps', 8);
    add({ id: 'S09', at: st, note: 'high angle down the line: on "jumps" the track snaps sideways into an S-shaped kink; shake + thud', draw(lt, d, t, blit) {
      reset(); const a = eob(clamp((t - jw) / 0.4)) * 1.1; layTrack({ off: kink(KZ, a) });
      const k = drift(clamp(lt / d));
      shoot(D, all, V3(3.5, 7.5, KZ + 16), V3(3.0, 6.5, KZ + 13), V3(0, 0, KZ + 1), null, k, LK, t > jw && t < jw + 0.25 ? 0.05 : 0, t);
      blit(); sunGlare(0.5);
    } });
    cue(Wd('jumps', 8), 'slam', { gain: 0.9 }); cue(Wd('jumps', 8) + 0.05, 'boing', { gain: 0.4 }); }

  // ── S10 · "Crews call it a sun kink." — the crew stand beside the kink, the old hand deadpan ──
  { const st = cut(9);
    add({ id: 'S10', at: st, shafts: 0.5, note: 'ground level beside the kink: oldhand deadpan, rookie shocked, foreman points at it', draw(lt, d, t, blit) {
      reset(); layTrack({ off: kink(KZ, 1.1) }); const k = drift(clamp(lt / d));
      stand(oldhand, -1.3, KZ + 12, { mood: 'deadpan', look: [0.4, 0], blink: blink(t) });
      stand(rookie, 1.35, KZ + 12.6, { mood: 'shock', armL: [40, -40], armR: [40, -40], blink: blink(t, 0.5) });
      stand(foreman, 1.1, KZ + 9.0, { mood: 'neutral', armL: [100, 0], look: [-0.7, 0.3], blink: blink(t, 1.2) });
      shoot(D, all, V3(0.1, 1.9, KZ + 20), V3(0.05, 1.8, KZ + 18.6), V3(0, 0.7, KZ), null, k);
      blit(); sunGlare(0.35); { const [hx, hy] = headXY(rookie, 1.55); FX.sweat(hx + 70, hy - 50, clamp((lt - 0.3) / 0.3)); }
    } });
    cue(st, 'whoosh'); }

  // ── S11 · "In Texas, a crew spotted one ahead and couldn't stop." — the coal train comes toward us, the kink in between ──
  { const st = cut(10), sp = Wd('spotted', 10);
    add({ id: 'S11', at: st, note: 'low beyond the kink looking back: the coal train rolls toward camera, the kink in the foreground; driver on the front platform goes from neutral to shock', draw(lt, d, t, blit) {
      reset(); const kz = KZ - 40, kf = kink(kz, 1.1); layTrack({ off: kf }); const k = clamp(lt / d), hz = lerp(kz + 62, kz + 26, k);
      placeCoal(hz); cars.forEach((c) => { c.rotation.set(0, 0, 0); });
      stand(driver, 0.65, hz - 7.6, { mood: t > sp ? 'shock' : 'neutral', armR: t > sp ? [150, 20] : [30, -60], blink: blink(t) }, 1.35);
      shoot(D, all, V3(2.4, 1.9, kz - 14), V3(2.1, 1.8, kz - 12), V3(0.2, 1.6, hz - 4), null, drift(k), { ...LK, aperture: 0 }, 0.006, t);
      blit(); sunGlare(0.3);
    } });
    cue(st, 'chug', { dur: 2.6, gain: 0.7 }); cue(sp, 'alarm', { dur: 1.4, gain: 0.35 }); }

  // ── S12 · "Forty-three coal cars came off the track." — wide: the coal cars tip off in a cloud of dust, "43" ──
  { const st = cut(11), fz = KZ - 40;
    add({ id: 'S12', at: st, note: 'wide from a distance: coal cars fold off the kinked track one after another into dust; big "43" pops', draw(lt, d, t, blit) {
      reset(); const kf = kink(fz, 1.1); layTrack({ off: kf }); const k = drift(clamp(lt / d));
      placeCoal(fz - 8, (i) => (i === 0 ? clamp((lt - 0.1) / 0.6) * 0.25 : eo(clamp((lt - 0.15 - i * 0.12) / 0.55))), kf);
      dustAt(fz + 30, clamp((lt - 0.2) / 1.4));
      shoot(D, all, V3(-34, 9, fz + 52), V3(-30, 8, fz + 46), V3(0, 1, fz + 30), null, k, { ...LK, aperture: 0 });
      blit(); big('43', 540, 640, 260, clamp((lt - 0.35) / 0.3)); big('COAL CARS', 540, 820, 92, clamp((lt - 0.5) / 0.3));
    } });
    cue(st + 0.15, 'slam', { gain: 1.0 }); cue(st + 0.45, 'thud', { gain: 0.8 }); cue(st + 0.75, 'thud', { gain: 0.6 }); cue(st + 0.4, 'pop', { gain: 0.6 }); }

  // ── S13 · "So now, before the rail is clamped down," — calm again: the crew lines up by fresh rail ──
  { const st = cut(12);
    add({ id: 'S13', at: st, note: 'fresh straight rail, crew in a row beside it; the foreman raises a finger like a teacher', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d));
      stand(foreman, 1.9, -4, { mood: 'proud', armR: [160, 10], blink: blink(t) }); stand(welder, 2.0, -6.4, { mood: 'content', holdR: P2.torch, armR: [20, -60], blink: blink(t, 0.6) });
      stand(rookie, 2.1, -8.8, { mood: 'neutral', blink: blink(t, 1.3) }); stand(oldhand, 2.2, -11.2, { mood: 'deadpan', blink: blink(t, 2) });
      shoot(D, all, V3(-1.6, 1.5, 3), V3(-1.4, 1.4, 1.2), V3(2, 1.0, -8), null, k);
      blit();
    } });
    cue(st, 'whoosh'); }

  // ── S14a · "they heat it," — torch + glowing rail;  S14b · "or stretch it with hydraulic jacks," — the jack pulls ──
  { const st = cut(13), sw = Wd('stretch', 13) - 0.08;
    add({ id: 'S14a', at: st, note: 'close: the welder runs the torch along the rail, the glow spreads', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d));
      stand(welder, 1.35, -3 - k * 0.6, { mood: 'strain', armR: [40, 30], holdR: P2.torch, lean: -10, blink: blink(t) }, -0.35);
      heat(clamp(lt / 0.4), 0.72, -3.2, 1.2 + k * 2.4, t); torchAt(true, 0.8, -2.8 - k * 0.6, t);
      shoot(D, all, V3(2.4, 0.9, 0.8), V3(2.3, 0.85, 0.2), V3(0.7, 0.3, -3.6), null, k);
      blit();
    } });
    add({ id: 'S14b', at: sw, note: 'the yellow hydraulic jack clamped on the rail: the two rail ends squeeze together, rookie and foreman straining', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d)), pull = eio(clamp((lt - 0.2) / (d - 0.4))), gp = lerp(0.3, 0.02, pull);
      layTrack({ joint: 40, gap: gp });
      const zj = Z0 - 40 + gp / 2; jack.visible = true; jack.position.set(0.72, 0.13, zj);
      stand(rookie, 1.5, zj - 1.7, { mood: 'strain', armL: [60, 20], armR: [60, 20], lean: -12, blink: blink(t) });
      stand(foreman, 2.1, zj - 2.6, { mood: 'strain', armR: [120, 40], blink: blink(t, 0.8) });
      shoot(D, all, V3(2.2, 1.4, zj + 3.6), V3(2.0, 1.3, zj + 3.0), V3(1.0, 0.6, zj - 0.8), null, k);
      blit(); arrows(330, 750, 1150, clamp((lt - 0.2) / 0.3));
    } });
    cue(st, 'sizzle', { dur: Math.max(0.6, sw - st), gain: 0.5 }); cue(sw, 'whoosh', { gain: 0.6 }); cue(sw + 0.3, 'zip', { gain: 0.5 }); }

  // ── S15 · "until it's as long as it will be on a hot summer day." — thermometer pinned at summer ──
  { const st = cut(14);
    add({ id: 'S15', at: st, shafts: 0.9, note: 'the long rail with a "summer" thermometer climbing high; crane up', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d));
      stand(welder, 1.7, -2.5, { mood: 'smug', armL: [150, 10], holdR: P2.torch, blink: blink(t) });
      shoot(D, all, V3(-1.2, 1.2, 4), V3(-1.6, 2.6, 6), V3(0.5, 0.6, -6), V3(0, 0.3, -20), k);
      blit(); thermo(880, 800, lerp(0.3, 0.95, eio(clamp(lt / (d * 0.7)))), lt > d * 0.6 ? 'SUMMER' : ''); FX.sparkle(880, 440, t, clamp((lt - d * 0.6) / 0.3), 80);
    } });
    cue(st, 'whoosh', { gain: 0.7 }); cue(st + 1.2, 'ding', { gain: 0.5 }); }

  // ── S16 · "Then summer has nothing left to push." — blazing sun, track dead straight, crew eating lunch ──
  { const st = cut(15);
    add({ id: 'S16', at: st, shafts: 1, note: 'full summer glare again, but the track stays perfectly straight; the crew sit on the rail eating lunch, content', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d));
      stand(oldhand, 0.85, -3.2, { mood: 'content', legs: 'sit', armR: [70, -40], holdR: PROPS.sandwich, blink: blink(t) }, 0.06);
      stand(rookie, 0.85, -4.6, { mood: 'laugh', legs: 'sit', armL: [14, 50], holdL: PROPS.pail, blink: blink(t, 0.6) }, 0.06);
      stand(foreman, 0.85, -6.0, { mood: 'smug', legs: 'sit', armR: [20, -100], holdR: PROPS.cup, blink: blink(t, 1.4) }, 0.06);
      shoot(D, all, V3(-0.4, 1.05, 0.6), V3(-0.25, 1.0, -0.2), V3(0.9, 0.75, -4.6), null, k);
      blit(); sunGlare(0.7);
    } });
    cue(st, 'whoosh', { gain: 0.6 }); }

  // ── S17 · "And that's why the crew cooks the rail before they lock it down." — loop: torch, then the maul ──
  { const st = cut(16), hit = Wd('lock', 17);
    add({ id: 'S17', at: st, shafts: 0.6, note: 'loop to the opening: torch on the glowing rail, foreman swings the maul on "lock", deadpan into camera', draw(lt, d, t, blit) {
      reset(); const k = drift(clamp(lt / d)), sw = clamp((t - (hit - 0.35)) / 0.35);
      stand(welder, 1.35, WZ, { mood: 'content', armR: [40, 30], holdR: P2.torch, lean: -10, blink: blink(t) }, -0.35);
      stand(foreman, 1.25, WZ - 1.6, { mood: t > hit + 0.3 ? 'deadpan' : 'strain', armR: tween([160, 10], [40, 20], t, hit - 0.3, 0.3), holdR: PROPS.maul, lean: lerp(4, -12, sw), look: [0.3, 0], blink: blink(t, 1) });
      heat(1, 0.72, WZ, 1.6, t); torchAt(true, 0.8, WZ + 0.2, t);
      shoot(D, all, V3(2.0, 0.62, WZ + 3.0), V3(3.4, 1.25, WZ + 3.4), V3(0.6, 0.45, WZ - 0.6), V3(0.8, 0.85, WZ - 1.4), k, LK, t > hit && t < hit + 0.2 ? 0.02 : 0, t);
      blit();
    } });
    cue(st, 'sizzle', { dur: 1.6, gain: 0.4 }); cue(hit, 'thud', { gain: 1.0 }); cue(hit + 0.02, 'ding', { gain: 0.5 }); }

  return { shots: S, cues: CUES };
}
