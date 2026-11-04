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
