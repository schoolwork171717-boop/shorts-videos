// critters.js (kit v8): cartoon animals in the same flat, thick-ink style as the Toon people, as camera-facing cut-outs.
//   new Critter(drawEmu, look, { height })  ->  .set(st) each frame, .face(cam), .group, like a Toon
//   drawEmu(g, look, st): a big fluffy emu. st = { mood: 'neutral'|'smug'|'sly'|'shock'|'happy'|'angry', look: [dx, dy],
//        blink, legs: 'stand'|'run'|'walk'|'sit', phase, neck (−1..1 bend), peck (0..1), tilt°, bob, lean°, flip }
import * as THREE from 'three';
import { Toon, INK, blobTex } from './toon.js';

const R2D = Math.PI / 180;
export class Critter extends Toon {
  constructor(draw, look = {}, opts = {}) { super(look, opts); this.draw = draw; this.key = ''; this.set({}); }
  set(st = {}) {
    if (!this.draw) return super.set(st);
    const key = JSON.stringify(st, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));
    if (key === this.key) return this;
    this.key = key; this.st = st;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.scale(this.res, this.res); this.draw(g, this.look, st); this.tex.needsUpdate = true; return this;
  }
}

export function drawEmu(g, look = {}, st = {}) {
  const L = { body: '#6B4A33', body2: '#8A6446', neck: '#7FA6C8', beak: '#3A3030', eye: '#F2C230', ...look };
  const S = { mood: 'neutral', look: [0, 0], blink: 0, legs: 'stand', phase: 0, neck: 0, peck: 0, tilt: 0, bob: 0, lean: 0, ...st };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (S.flip) { g.translate(512, 0); g.scale(-1, 1); }
  g.translate(256, 1000); g.rotate((S.lean || 0) * R2D); g.translate(-256, -1000);
  const run = S.legs === 'run' || S.legs === 'walk', sit = S.legs === 'sit';
  const bob = (S.bob || 0) + (run ? -Math.abs(Math.sin(S.phase)) * (S.legs === 'run' ? 26 : 12) : 0) + (sit ? 230 : 0);
  const bx = 250, by = 560 + bob;                      // body centre
  // legs (behind the body): thick backward knees, three toes
  g.strokeStyle = INK;
  const leg = (side) => {
    const ph = S.phase + (side > 0 ? Math.PI : 0), amp = S.legs === 'run' ? 1 : S.legs === 'walk' ? 0.5 : 0;
    const hipX = bx + side * 34, hipY = by + 90;
    if (sit) { g.lineWidth = 16; g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(hipX + side * 60, 990); g.stroke(); return; }
    const sw = Math.sin(ph) * amp, lift = Math.max(0, -Math.cos(ph)) * amp * 90;
    const kx = hipX + 40 + sw * 40, ky = hipY + 170 - lift * 0.4, fx = hipX + sw * 110, fy = 995 - lift;
    g.lineWidth = 18; g.strokeStyle = '#5E6A7E'; g.beginPath(); g.moveTo(hipX, hipY); g.quadraticCurveTo(kx, ky, fx, fy); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(hipX, hipY); g.quadraticCurveTo(kx, ky, fx, fy); g.stroke();
    g.lineWidth = 9; [-0.5, 0, 0.5].forEach((a) => { g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.sin(a + 0.4) * 44, fy + Math.cos(a + 0.4) * 6 + 2); g.stroke(); });
  };
  leg(-1); leg(1);
  // body: a shaggy feather ball (scalloped edge), lighter fluff on top
  const body = new Path2D(); const rx = 165, ry = 140;
  for (let k = 0; k <= 36; k++) { const a = (k / 36) * Math.PI * 2, wob = 1 + (k % 2 ? 0.05 : -0.03) + (a > 0.4 && a < 2.6 ? 0.07 * Math.sin(a * 9) : 0);
    const x = bx + Math.cos(a) * rx * wob, y = by + Math.sin(a) * ry * wob; k ? body.lineTo(x, y) : body.moveTo(x, y); }
  body.closePath(); g.fillStyle = L.body; g.fill(body);
  g.save(); g.clip(body); g.fillStyle = L.body2; g.beginPath(); g.ellipse(bx - 30, by - 60, 130, 70, -0.2, 0, 7); g.fill();
  g.strokeStyle = 'rgba(30,20,30,0.35)'; g.lineWidth = 4; for (let k = 0; k < 16; k++) { const x = bx - 140 + k * 19, y = by - 40 + Math.sin(k * 1.7) * 30; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + 40, x - 4, y + 70); g.stroke(); }
  g.fillStyle = 'rgba(20,15,30,0.25)'; g.beginPath(); g.ellipse(bx + 70, by + 70, 140, 90, 0, 0, 7); g.fill(); g.restore();
  g.strokeStyle = INK; g.lineWidth = 9; g.stroke(body);
  // tail fluff
  g.fillStyle = L.body; g.beginPath(); g.ellipse(bx - rx + 10, by - 10, 46, 60, -0.5, 0, 7); g.fill(); g.stroke();
  // neck: an S-curve from the front of the body up to the head
  const nb = S.neck || 0, pk = S.peck || 0;
  const nx0 = bx + 110, ny0 = by - 70, hx = bx + 150 + nb * 60 + pk * 80, hy = by - 330 + Math.abs(nb) * 40 + pk * 260 + (run ? Math.sin(S.phase * 2) * 10 : 0);
  const c1x = nx0 + 70, c1y = ny0 - 80, c2x = hx - 60 - nb * 40, c2y = hy + 120;
  const neck = () => { g.beginPath(); g.moveTo(nx0, ny0); g.bezierCurveTo(c1x, c1y, c2x, c2y, hx, hy); };
  g.strokeStyle = INK; g.lineWidth = 50; neck(); g.stroke(); g.strokeStyle = L.neck; g.lineWidth = 36; neck(); g.stroke();
  g.strokeStyle = 'rgba(40,40,80,0.25)'; g.lineWidth = 3; for (let k = 1; k < 6; k++) { const u = k / 6; const x = (1 - u) ** 3 * nx0 + 3 * (1 - u) ** 2 * u * c1x + 3 * (1 - u) * u * u * c2x + u ** 3 * hx, y = (1 - u) ** 3 * ny0 + 3 * (1 - u) ** 2 * u * c1y + 3 * (1 - u) * u * u * c2y + u ** 3 * hy; g.beginPath(); g.arc(x, y, 7, 0, Math.PI); g.stroke(); }
  // head
  g.save(); g.translate(hx, hy); g.rotate((S.tilt || 0) * R2D);
  g.fillStyle = L.neck; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.ellipse(0, 0, 58, 50, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#4A3A30'; g.beginPath(); g.ellipse(-14, -40, 34, 16, -0.3, 0, 7); g.fill();                   // a scruffy tuft
  // beak
  g.fillStyle = L.beak; g.beginPath(); g.moveTo(40, -6); g.quadraticCurveTo(104, 2, 96, 18); g.quadraticCurveTo(70, 26, 38, 18); g.closePath(); g.fill(); g.stroke();
  if (S.mood === 'shock' || S.mood === 'happy') { g.fillStyle = '#C8505A'; g.beginPath(); g.moveTo(42, 14); g.quadraticCurveTo(80, 44, 92, 22); g.closePath(); g.fill(); g.stroke(); }
  // eye: big cartoon eye with brow
  const ex = 14, ey = -8, er = 26;
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(ex, ey, er, er * 1.08, 0, 0, 7); g.fill(); g.lineWidth = 6; g.stroke();
  const shut = Math.min(1, S.blink || 0);
  if (shut < 0.9) { g.fillStyle = INK; g.beginPath(); g.arc(ex + 6 + S.look[0] * 8, ey + 2 + S.look[1] * 8, 10, 0, 7); g.fill(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(ex + 9 + S.look[0] * 8, ey - 2 + S.look[1] * 8, 3.5, 0, 7); g.fill(); }
  const lid = S.mood === 'smug' || S.mood === 'sly' ? 0.5 : S.mood === 'angry' ? 0.35 : 0;
  const lk = Math.max(lid, shut);
  if (lk > 0) { g.fillStyle = L.neck; g.beginPath(); g.ellipse(ex, ey, er + 2, er * 1.1 + 2, 0, Math.PI, Math.PI + Math.PI); g.rect(ex - er - 3, ey - er * 1.2, (er + 3) * 2, er * 2.2 * lk); g.save(); g.clip(new Path2D(`M${ex - er - 3} ${ey - er * 1.2} h${(er + 3) * 2} v${er * 2.4 * lk} h${-(er + 3) * 2}z`)); g.beginPath(); g.ellipse(ex, ey, er + 1, er * 1.09, 0, 0, 7); g.fill(); g.restore(); g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(ex - er, ey - er * 1.08 + er * 2.16 * lk); g.lineTo(ex + er, ey - er * 1.08 + er * 2.16 * lk); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 7; g.beginPath();
  if (S.mood === 'angry') { g.moveTo(ex - 22, ey - 40); g.lineTo(ex + 22, ey - 28); }
  else if (S.mood === 'smug' || S.mood === 'sly') { g.moveTo(ex - 22, ey - 30); g.quadraticCurveTo(ex, ey - 44, ex + 24, ey - 36); }
  else if (S.mood === 'shock') { g.moveTo(ex - 18, ey - 48); g.quadraticCurveTo(ex, ey - 58, ex + 20, ey - 48); }
  else { g.moveTo(ex - 20, ey - 38); g.quadraticCurveTo(ex, ey - 46, ex + 22, ey - 38); }
  g.stroke();
  g.restore();
  g.restore();
}

/** A big flock for crowd shots: run / walk / peck cycles are drawn once into a few textures and shared, so 40-120
 *  birds cost almost nothing. flock.bird(i, x, z, { mode: 'run'|'walk'|'stand'|'peck', phase, flip, y }) each frame,
 *  flock.face(cam), flock.hide(). Add flock.group to the scene. */
export class Flock {
  constructor(n, { height = 1.75, res = 0.5, bodies = ['#6B4A33', '#5E432E', '#73503A'], draw = drawEmu } = {}) {
    const H = height / 0.96, Wd = H / 2; this.n = n; this.group = new THREE.Group();
    const geo = new THREE.PlaneGeometry(Wd, H); geo.translate(0, H / 2 - H * (24 / 1024), 0);
    const bake = (look, st) => { const c = document.createElement('canvas'); c.width = 512 * res; c.height = 1024 * res; const g = c.getContext('2d'); g.scale(res, res); draw(g, look, st);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, toneMapped: false }); };
    this.mats = bodies.map((body) => ({
      run: [...Array(8)].map((_, k) => bake({ body }, { legs: 'run', phase: (k / 8) * Math.PI * 2, neck: 0.3 })),
      walk: [...Array(8)].map((_, k) => bake({ body }, { legs: 'walk', phase: (k / 8) * Math.PI * 2, neck: 0.1 })),
      stand: [0, 1, 2, 3].map((k) => bake({ body }, { neck: [-0.2, 0.1, 0.3, 0][k], tilt: [6, -8, 0, 12][k], look: [[0.5, 0], [-0.4, 0.2], [0, 0], [0.6, -0.2]][k] })),
      peck: [0, 0.35, 0.7, 1].map((p) => bake({ body }, { peck: p, neck: 0.2 })),
    }));
    const blobM = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.5 });
    this.birds = [...Array(n)].map((_, i) => { const g = new THREE.Group(), pv = new THREE.Group(), m = new THREE.Mesh(geo, this.mats[i % bodies.length].stand[0]);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 0.9, Wd * 0.34), blobM); b.rotation.x = -Math.PI / 2; b.position.y = 0.012;
      pv.add(m); g.add(pv, b); this.group.add(g); return { g, pv, m, set: this.mats[i % bodies.length] }; });
  }
  bird(i, x, z, { mode = 'stand', phase = 0, flip = false, y = 0, s = 1 } = {}) {
    const B = this.birds[i]; if (!B) return; B.g.visible = true; B.g.position.set(x, y, z); B.g.scale.setScalar(s);
    const list = B.set[mode] || B.set.stand; const k = mode === 'run' || mode === 'walk' ? Math.floor(((phase / (Math.PI * 2)) % 1 + 1) % 1 * 8) % 8 : Math.floor(Math.abs(phase)) % list.length;
    B.m.material = list[k]; B.m.scale.x = flip ? -1 : 1;
  }
  hide() { this.birds.forEach((B) => (B.g.visible = false)); }
  face(cam) { const p = new THREE.Vector3(); this.birds.forEach((B) => { if (!B.g.visible) return; B.g.getWorldPosition(p); B.pv.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z); }); }
}
