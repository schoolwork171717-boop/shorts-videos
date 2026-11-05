// 2D film effects drawn over the 3D frame (the "living picture" layer):
//   motes(t, { n, col, seed })            floating dust / embers drifting through the light
//   shafts(t, { x, y, angle, col, k })    soft god-ray beams from a window, the sun or a lamp
//   rain(t, { n, k })                     slanted rain streaks          sparkle(x, y, t, k)   a twinkle star (on a reveal)
//   sweat(x, y, k)                        a cartoon sweat drop next to a worried face
import { ctx, W, H } from './lib.js';
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function motes(t, { n = 40, col = '255,240,200', seed = 1, size = 1 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const r = (i + seed * 31); const sp = 0.02 + rnd(r) * 0.05;
    const x = ((rnd(r * 1.3) + t * sp * 0.6 + Math.sin(t * 0.7 + r) * 0.02) % 1) * W, y = ((rnd(r * 2.1) - t * sp + 10) % 1) * H;
    const s = (2 + rnd(r * 3) * 5) * size, a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + r));
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - s * 2, y - s * 2, s * 4, s * 4); }
  ctx.restore(); }
export function shafts(t, { x = W * 0.8, y = -100, angle = 0.45, col = '255,236,190', k = 1, n = 4 } = {}) {
  if (k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y); ctx.rotate(angle);
  for (let i = 0; i < n; i++) { const off = (i - n / 2) * 150 + Math.sin(t * 0.4 + i) * 30, w = 70 + rnd(i) * 90, a = (0.08 + rnd(i * 2) * 0.08) * k;
    const g = ctx.createLinearGradient(0, 0, 0, H * 1.4); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(off - w / 2, 0, w, H * 1.4); }
  ctx.restore(); }
export function rain(t, { n = 120, k = 1, angle = 0.25 } = {}) {
  if (k <= 0) return; ctx.save(); ctx.strokeStyle = `rgba(210,225,255,${0.35 * k})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) { const sp = 1.6 + rnd(i) * 1.2, x = (rnd(i * 1.7) * 1.3 - 0.15) * W, y = ((rnd(i * 2.3) + t * sp) % 1) * (H + 200) - 100, l = 40 + rnd(i * 5) * 50;
    ctx.beginPath(); ctx.moveTo(x + y * angle * 0.2, y); ctx.lineTo(x + (y + l) * angle * 0.2 - l * angle, y + l); ctx.stroke(); }
  ctx.restore(); }
export function sparkle(x, y, t, k = 1, s = 60) {
  if (k <= 0) return; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2); const r = s * k * (0.8 + 0.2 * Math.sin(t * 20));
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.3, 'rgba(255,245,200,0.5)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.08, 0); ctx.lineTo(-r * 0.08, 0); ctx.closePath(); ctx.fill(); }
  ctx.restore(); }
export function sweat(x, y, k = 1) {
  if (k <= 0) return; ctx.save(); ctx.translate(x, y + (1 - k) * -20); ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = '#9FD3FF'; ctx.strokeStyle = '#1F1C33'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(22, -2, 16, 12); ctx.arc(0, 10, 16, 0.2, Math.PI - 0.2); ctx.quadraticCurveTo(-22, -2, 0, -34); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(-5, 4, 4, 7, -0.3, 0, 7); ctx.fill(); ctx.restore(); }

// ── v5 "magnificent" layer ──
//   petals(t, { n, col, wind })   blossom petals tumbling across the frame (gardens, palaces, happy endings)
//   orbs(t, { n, col, k })        soft out-of-focus glowing orbs (bokeh) floating up: magic, wonder, reveals
//   godray(x, y, t, { k, col })   a radiant burst of rays behind a hero object or person (the "majestic reveal")
//   speedLines(t, k, cx, cy)      radial anime speed lines toward the centre (fast moves, shock, zoom-ins)
//   vignetteGlow(k, col)          coloured glow around the edges (dreamy flashbacks, magic moments)
export function petals(t, { n = 26, col = ['#FFB3CF', '#FF8FB8', '#FFD6E6'], wind = 1, seed = 3, size = 1 } = {}) {
  ctx.save();
  for (let i = 0; i < n; i++) { const r = i + seed * 17, sp = 0.05 + rnd(r) * 0.07;
    const x = (((rnd(r * 1.9) + t * sp * wind * 0.9) % 1) + 1) % 1 * (W + 200) - 100, y = ((rnd(r * 3.7) + t * sp) % 1) * (H + 200) - 100;
    const s = (14 + rnd(r * 5) * 14) * size, a = t * (1.5 + rnd(r) * 2) + r;
    ctx.save(); ctx.translate(x + Math.sin(t * 1.3 + r) * 30, y); ctx.rotate(a); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(a * 1.3)));
    ctx.fillStyle = col[i % col.length]; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.6, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(31,28,51,0.35)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
  ctx.restore(); }
export function orbs(t, { n = 14, col = '255,214,140', k = 1, seed = 5 } = {}) {
  if (k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const r = i + seed * 13, sp = 0.015 + rnd(r) * 0.03, s = 30 + rnd(r * 2) * 70;
    const x = (rnd(r * 1.1) + Math.sin(t * 0.4 + r) * 0.04) * W, y = ((rnd(r * 2.7) - t * sp) % 1 + 1) % 1 * (H + 300) - 150, a = (0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.7 + r))) * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.7, `rgba(${col},${a * 0.6})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - s, y - s, s * 2, s * 2); }
  ctx.restore(); }
export function godray(x, y, t, { k = 1, col = '255,230,160', n = 16, len = 900 } = {}) {
  if (k <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y); ctx.rotate(t * 0.15);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, w = 0.06 + rnd(i) * 0.06, L = len * (0.6 + rnd(i * 3) * 0.4) * k;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L); g.addColorStop(0, `rgba(${col},${0.45 * k})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, a - w, a + w); ctx.closePath(); ctx.fill(); }
  ctx.restore(); }
export function speedLines(t, k = 1, cx = W / 2, cy = H / 2) {
  if (k <= 0) return; ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) { const a = rnd(i + Math.floor(t * 12) * 0.37) * Math.PI * 2, r0 = 380 + rnd(i * 5) * 300, r1 = r0 + 300 + rnd(i * 9) * 500;
    ctx.lineWidth = 3 + rnd(i * 2) * 7; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
  ctx.restore(); }
export function vignetteGlow(k = 1, col = '120,90,255') {
  if (k <= 0) return; ctx.save(); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.75); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${0.45 * k})`);
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
