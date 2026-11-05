// beasts.js: animal cut-outs in the same ink style as the Toon people.
//   new Horse({ col, mane, saddle }, { length })  .set({ phase, gallop 0..1, head (deg), mood }) every frame, .face(cam),
//   .group (position; the horse faces +x on its canvas, rotate group.rotation.y to aim it), .saddle (world point for a rider)
import * as THREE from 'three';
import { INK, shadeOf } from './toon.js';

function drawHorse(g, L, S) {
  const c = L.col || '#B8743E', dk = shadeOf(c, 0.75), mane = L.mane || '#3A2418', ph = S.phase || 0, gal = S.gallop ?? 1;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const bob = Math.sin(ph * 2) * 10 * gal;
  g.save(); g.translate(0, bob);
  // legs (far pair darker, behind the body)
  const leg = (x, y, a1, a2, col) => { const k1x = x + Math.sin(a1) * 90, k1y = y + Math.cos(a1) * 90, fx = k1x + Math.sin(a1 + a2) * 100, fy = k1y + Math.cos(a1 + a2) * 100;
    g.strokeStyle = INK; g.lineWidth = 30; g.beginPath(); g.moveTo(x, y); g.lineTo(k1x, k1y); g.lineTo(fx, fy); g.stroke();
    g.strokeStyle = col; g.lineWidth = 20; g.beginPath(); g.moveTo(x, y); g.lineTo(k1x, k1y); g.lineTo(fx, fy); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(fx + 6, fy + 4, 16, 10, 0, 0, 7); g.fill(); };
  const sw = (o) => Math.sin(ph + o) * 0.75 * gal, bend = (o) => Math.max(0, Math.sin(ph + o + 1.2)) * 1.3 * gal;
  leg(330, 330, -sw(0.6), bend(0.6), dk); leg(720, 330, sw(2.4), -bend(2.4), dk);
  // tail
  g.fillStyle = mane; g.strokeStyle = INK; g.lineWidth = 8; g.beginPath(); g.moveTo(250, 250); g.quadraticCurveTo(150, 260 + Math.sin(ph * 2) * 30, 120, 400 + Math.sin(ph * 2 + 1) * 20); g.quadraticCurveTo(190, 330, 270, 290); g.closePath(); g.fill(); g.stroke();
  // body
  g.fillStyle = c; g.lineWidth = 10; g.beginPath(); g.ellipse(520, 280, 300, 115, 0, 0, 7); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.ellipse(520, 280, 300, 115, 0, 0, 7); g.clip(); g.fillStyle = dk; g.beginPath(); g.ellipse(540, 380, 300, 60, 0, 0, 7); g.fill(); g.restore();
  // saddle cloth
  if (L.saddle) { g.fillStyle = L.saddle; g.beginPath(); g.roundRect(420, 170, 170, 130, 20); g.fill(); g.lineWidth = 7; g.stroke(); g.fillStyle = '#E9B23C'; g.fillRect(420, 280, 170, 14); g.strokeRect(420, 280, 170, 14); }
  // neck + head
  const hd = (S.head || 0) * Math.PI / 180 + Math.sin(ph * 2) * 0.08 * gal;
  g.save(); g.translate(760, 220); g.rotate(hd);
  g.fillStyle = c; g.lineWidth = 10; g.beginPath(); g.moveTo(-30, 80); g.quadraticCurveTo(40, -40, 70, -150); g.lineTo(150, -120); g.quadraticCurveTo(110, 10, 90, 90); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(170, -150, 110, 52, 0.45, 0, 7); g.fill(); g.stroke();
  g.fillStyle = mane; g.beginPath(); g.moveTo(50, -160); for (let k = 0; k < 6; k++) g.lineTo(20 - k * 14 + Math.sin(ph * 2 + k) * 8, -120 + k * 34); g.lineTo(60, 60); g.quadraticCurveTo(90, -60, 110, -150); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = c; g.beginPath(); g.moveTo(80, -200); g.lineTo(100, -262); g.lineTo(122, -196); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(150, -175, 20, 22, 0, 0, 7); g.fill(); g.lineWidth = 6; g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(156, -173, 9, 0, 7); g.fill();
  g.beginPath(); g.ellipse(255, -110, 9, 6, 0.4, 0, 7); g.fill();
  g.restore();
  // near legs
  leg(360, 340, sw(Math.PI), bend(Math.PI), c); leg(700, 340, -sw(Math.PI + 1.8), -bend(Math.PI + 1.8), c);
  g.restore();
}

export class Horse {
  constructor(look = {}, { length = 2.6 } = {}) {
    this.look = look; this.canvas = document.createElement('canvas'); this.canvas.width = 1024; this.canvas.height = 640; this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace;
    const W = length * 1.3, H = W * 0.625; const geo = new THREE.PlaneGeometry(W, H); geo.translate(0, H / 2 - H * (20 / 640), 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.pivot = new THREE.Group(); this.pivot.add(this.mesh); this.group = new THREE.Group(); this.group.add(this.pivot);
    this.W = W; this.H = H; this.key = ''; this.set({});
  }
  set(st = {}) {
    const key = JSON.stringify(st, (k, v) => (typeof v === 'number' ? Math.round(v * 50) / 50 : v)); if (key === this.key) return this; this.key = key; this.st = st;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1024, 640); g.translate(0, 40); drawHorse(g, this.look, st); this.tex.needsUpdate = true; return this;
  }
  /** keep the side view toward the camera; flips so the horse still runs the right way on screen */
  face(cam, dirX = 1) { const p = new THREE.Vector3(); this.group.getWorldPosition(p); this.pivot.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) - this.group.rotation.y; this.mesh.scale.x = dirX; return this; }
  at(x, y, z) { this.group.position.set(x, y, z); return this; }
  /** where the rider's feet go (sitting, legs dangling) in world space */
  saddle() { const p = new THREE.Vector3(); this.group.getWorldPosition(p); p.y += this.H * 0.37 + Math.sin((this.st.phase || 0) * 2) * 0.03 * (this.st.gallop ?? 1); return p; }
}
