#!/usr/bin/env bash
# Builds the Iron Canyon 3D style from the faceless-shorts Tall Tale engine.
set -euo pipefail
FS=$(dirname "$(find / -path "*faceless-shorts/SKILL.md" -not -path "*/proc/*" 2>/dev/null | head -1)")
[ -d "$FS/styles/tall-tale/example" ] || { echo "faceless-shorts skill not found"; exit 1; }
D="${IRON_CANYON_DIR:-$HOME/.faceless-shorts/styles/iron-canyon}"
rm -rf "$D"; mkdir -p "$D"; cp -r "$FS/styles/tall-tale/example" "$D/example"; cd "$D/example"
command -v patch >/dev/null || { echo "needs the patch command"; exit 1; }
patch -s -p0 <<'IC_PATCH_0'
--- src/core/toon.js
+++ src/core/toon.js
@@ -72,6 +72,7 @@
   g.fillStyle = L.body; g.fill(body);
   g.save(); g.clip(body);
   drawPattern(g, L, bx, top, bot, bw);
+  drawStraps(g, L, bx, top, bot, bw);
   g.fillStyle = L.shade || shadeOf(L.body, 0.8); g.globalAlpha = 0.85;
   g.beginPath(); g.ellipse(bx + bw + 40, (top + bot) / 2 + 20, 70, 260, 0, 0, Math.PI * 2); g.fill();
   g.globalAlpha = 0.25; g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(bx - 50, top + 90, 16, 60, 0.2, 0, Math.PI * 2); g.fill();
@@ -102,10 +103,17 @@
   const head = new Path2D(); head.ellipse(hx, hy, r, r * 0.97, 0, 0, Math.PI * 2);
   g.fillStyle = L.head; g.fill(head);
   g.save(); g.clip(head);
-  g.fillStyle = shadeOf(L.head, 0.9); g.beginPath(); g.arc(hx + 52, hy + 44, r, 0, Math.PI * 2); g.rect(hx - 400, hy - 400, 800, 800); g.fill('evenodd');
+  // crescent shade on the lower right + light pencil hatching inside it (the hand-inked look)
+  const cres = new Path2D(); cres.arc(hx + 40, hy + 34, r * 1.02, 0, Math.PI * 2); cres.rect(hx - 400, hy - 400, 800, 800);
+  g.fillStyle = L.headShade || '#DCDCE4'; g.fill(cres, 'evenodd');
+  g.save(); g.clip(cres, 'evenodd'); g.strokeStyle = INK; g.globalAlpha = 0.13; g.lineWidth = 3;
+  for (let k = -r * 2; k < r * 2; k += 15) { g.beginPath(); g.moveTo(hx + k, hy + r); g.lineTo(hx + k + r * 0.55, hy - r * 0.2); g.stroke(); }
+  g.restore();
   g.restore();
   g.strokeStyle = INK; g.lineWidth = LW + 1; g.stroke(head);
+  if (L.hair) drawHair(g, L, hx, hy, r);
   drawFace(g, L, S, hx, hy);
+  if (L.extra.includes('beard')) drawBeard(g, L, S, hx, hy, r);
   drawHat(g, L, hx, hy, r);
   g.restore();
   g.restore();
@@ -139,12 +147,77 @@
     spots.slice(0, n).forEach(([dx, dy, r], i) => { g.save(); g.translate(bx + dx, top + dy); g.rotate(r); const cols = ['#D8343F', '#3C6FB6', '#2E8A5A', '#E2B33C', '#8C6FC9']; g.fillStyle = '#FFFDF4'; g.strokeStyle = INK; g.lineWidth = 3;
       g.beginPath(); g.rect(-22, -27, 44, 54); g.fill(); g.stroke(); g.fillStyle = cols[i % 5]; g.fillRect(-15, -20, 30, 32); g.fillStyle = '#FFFDF4'; g.font = '900 13px Inter'; g.textAlign = 'center'; g.fillText(i % 2 ? '5¢' : '2¢', 0, 22);
       g.beginPath(); g.arc(0, -6, 8, 0, 7); g.fill(); g.restore(); });
+  } else if (L.pattern === 'plaid') {                       // flannel work shirt: bold bands + thin light lines
+    const dk = L.patCol || '#3A1F28', lt = L.patCol2 || '#F2E6CF';
+    g.fillStyle = dk; g.globalAlpha = 0.55;
+    for (let x = bx - 130; x < bx + 130; x += 46) g.fillRect(x, top - 20, 18, bot - top + 40);
+    for (let y = top + 6; y < bot + 20; y += 46) g.fillRect(bx - 130, y, 260, 18);
+    g.globalAlpha = 0.6; g.strokeStyle = lt; g.lineWidth = 2.5;
+    for (let x = bx - 112; x < bx + 130; x += 46) { g.beginPath(); g.moveTo(x + 14, top - 20); g.lineTo(x + 14, bot + 20); g.stroke(); }
+    for (let y = top + 24; y < bot + 20; y += 46) { g.beginPath(); g.moveTo(bx - 130, y + 12); g.lineTo(bx + 130, y + 12); g.stroke(); }
+    g.globalAlpha = 1; g.strokeStyle = INK; g.lineWidth = 4; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(bx, top + 20); g.lineTo(bx, bot); g.stroke(); g.setLineDash([]);
+  } else if (L.pattern === 'jacket') {                      // work jacket: centre seam, buttons, two flap pockets
+    const dk = L.patCol || shadeOf(L.body, 0.72);
+    g.strokeStyle = dk; g.lineWidth = 5; g.beginPath(); g.moveTo(bx, top + 30); g.lineTo(bx, bot); g.stroke();
+    g.fillStyle = INK; [100, 150, 200].forEach((dy) => { g.beginPath(); g.arc(bx + 12, top + dy, 6, 0, 7); g.fill(); });
+    [-1, 1].forEach((s) => { const px = bx + s * 48; g.strokeStyle = INK; g.lineWidth = 4; g.fillStyle = dk;
+      g.beginPath(); g.rect(px - 26, top + 78, 52, 44); g.stroke(); g.beginPath(); g.rect(px - 28, top + 70, 56, 16); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(px, top + 80, 4, 0, 7); g.fill(); });
   } else if (L.pattern === 'apron') {
     g.fillStyle = L.patCol || '#F4EFE4'; g.beginPath(); g.roundRect(bx - 70, top + 90, 140, bot - top, 18); g.fill();
     g.strokeStyle = shadeOf(L.patCol || '#F4EFE4', 0.8); g.lineWidth = 4; g.beginPath(); g.roundRect(bx - 40, top + 190, 80, 60, 8); g.stroke();
   }
 }
 
+// suspenders (straps: colour) and a belt with a brass buckle (belt: colour)
+function drawStraps(g, L, bx, top, bot) {
+  if (L.straps) {
+    g.fillStyle = L.straps; g.strokeStyle = INK; g.lineWidth = 4;
+    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(bx + s * 44, top - 10); g.lineTo(bx + s * 62, top - 10); g.lineTo(bx + s * 50, bot); g.lineTo(bx + s * 32, bot); g.closePath(); g.fill(); g.stroke();
+      g.fillStyle = '#E2B33C'; g.beginPath(); g.roundRect(bx + s * 41 - 9, top + 120, 18, 14, 3); g.fill(); g.stroke(); g.fillStyle = L.straps; });
+  }
+  if (L.belt) {
+    const y = bot - 92; g.fillStyle = L.belt; g.strokeStyle = INK; g.lineWidth = 4;
+    g.fillRect(bx - 140, y, 280, 26); g.beginPath(); g.moveTo(bx - 140, y); g.lineTo(bx + 140, y); g.moveTo(bx - 140, y + 26); g.lineTo(bx + 140, y + 26); g.stroke();
+    g.fillStyle = '#E2B33C'; g.beginPath(); g.roundRect(bx - 20, y - 4, 40, 34, 4); g.fill(); g.stroke(); g.fillStyle = L.belt; g.fillRect(bx - 9, y + 6, 18, 14);
+  }
+}
+
+// a tuft of hair poking out under the hat on one side (hair: colour, hairSide: 1 right | -1 left | 0 both)
+function drawHair(g, L, hx, hy, r) {
+  const sides = L.hairSide === 0 ? [-1, 1] : [L.hairSide || 1];
+  sides.forEach((s) => {
+    const p = new Path2D();
+    p.moveTo(hx + s * r * 0.1, hy - r * 0.8);
+    p.bezierCurveTo(hx + s * r * 0.8, hy - r * 0.98, hx + s * r * 1.12, hy - r * 0.5, hx + s * r * 1.0, hy + r * 0.12);
+    p.bezierCurveTo(hx + s * r * 0.92, hy + r * 0.0, hx + s * r * 0.86, hy - r * 0.28, hx + s * r * 0.74, hy - r * 0.2);
+    p.bezierCurveTo(hx + s * r * 0.7, hy - r * 0.42, hx + s * r * 0.4, hy - r * 0.5, hx + s * r * 0.1, hy - r * 0.8);
+    g.fillStyle = L.hair; g.fill(p);
+    g.save(); g.clip(p); g.strokeStyle = shadeOf(L.hair, 0.7); g.lineWidth = 3; g.globalAlpha = 0.8;
+    for (let k = 0; k < 9; k++) { const x = hx + s * r * (0.45 + k * 0.07); g.beginPath(); g.moveTo(x, hy - r * 0.8); g.quadraticCurveTo(x + s * 10, hy - r * 0.4, x + s * 4, hy); g.stroke(); }
+    g.restore(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(p);
+  });
+}
+
+// a big bushy beard below the mouth, inked with short strokes (beardCol)
+function drawBeard(g, L, S, hx, hy, r) {
+  const c = L.beardCol || '#BFC0C6', my = hy + 66, p = new Path2D();
+  p.moveTo(hx - r * 0.95, hy + 4);
+  p.bezierCurveTo(hx - r * 1.02, hy + r * 0.9, hx - r * 0.6, hy + r * 1.45, hx, hy + r * 1.6);
+  p.bezierCurveTo(hx + r * 0.6, hy + r * 1.45, hx + r * 1.02, hy + r * 0.9, hx + r * 0.95, hy + 4);
+  p.bezierCurveTo(hx + r * 0.7, my + 6, hx + 50, my + 10, hx + 30, my + 26);
+  p.quadraticCurveTo(hx, my + 40, hx - 30, my + 26);
+  p.bezierCurveTo(hx - 50, my + 10, hx - r * 0.7, my + 6, hx - r * 0.95, hy + 4);
+  p.closePath();
+  g.fillStyle = c; g.fill(p);
+  g.save(); g.clip(p);
+  g.fillStyle = shadeOf(c, 0.8); g.beginPath(); g.ellipse(hx + r * 0.55, hy + r * 1.0, r * 0.6, r * 0.9, -0.3, 0, 7); g.fill();
+  g.strokeStyle = shadeOf(c, 0.55); g.lineWidth = 3;
+  for (let i = 0; i < 70; i++) { const u = rnd2(i) * 2 - 1, v = rnd2(i * 3.1); const x = hx + u * r * 0.9, y = my + 20 + v * r * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + u * 6, y + 18); g.stroke(); }
+  g.restore(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(p);
+  if (S.talk > 0.05 || S.mood === 'laugh' || S.mood === 'shock') { g.fillStyle = '#3A1A2A'; g.beginPath(); g.ellipse(hx, my + 22, 18, 8 + (S.talk || 0.5) * 10, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); }
+}
+const rnd2 = (i) => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
+
 function drawNeckwear(g, L, bx, top) {
   const c = L.neckCol || '#D8343F';
   g.strokeStyle = INK; g.lineWidth = 6;
@@ -170,6 +243,10 @@
 function eye(g, x, y, S, side, L) {
   const [lx, ly] = S.look; const m = S.mood; const bl = S.blink || 0;
   g.fillStyle = INK; g.strokeStyle = INK;
+  if (m === 'strain') {                                   // squeezed shut: > <
+    g.lineWidth = 9; const d = side < 0 ? 1 : -1; g.beginPath(); g.moveTo(x - d * 18, y - 16); g.lineTo(x + d * 14, y); g.lineTo(x - d * 18, y + 14); g.stroke(); return;
+  }
+  if (m === 'content') { g.lineWidth = 9; g.beginPath(); g.arc(x, y + 8, 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
   if (m === 'happy' || m === 'laugh' || (m === 'proud' && side > 0 && false)) {
     g.lineWidth = 10; g.beginPath(); g.arc(x, y + 10, 20, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return;
   }
@@ -183,7 +260,7 @@
   // pupil
   const px = x + lx * 9, py = y + ly * 8;
   g.beginPath(); g.ellipse(px, py, 13, 17 * (1 - bl * 0.6), 0, 0, 7); g.fill();
-  if (m === 'smug' || m === 'tired' || m === 'sly' || m === 'proud') {           // heavy lid over the top half
+  if (m === 'smug' || m === 'tired' || m === 'sly' || m === 'proud' || m === 'deadpan') {           // heavy lid over the top half
     g.fillStyle = L.head; g.fillRect(x - 24, y - 28, 48, 26 + (m === 'tired' ? 6 : 0));
     g.lineWidth = 7; g.beginPath(); g.moveTo(x - 20, y - 2 + (m === 'tired' ? 6 : 0)); g.lineTo(x + 20, y - 2 + (m === 'tired' ? 6 : 0)); g.stroke();
   }
@@ -194,7 +271,7 @@
   const m = S.mood, ex = 46, ey = hy + 4;
   // eyebrows
   const brow = { neutral: [4, 0], smug: [-8, 10], happy: [8, 0], laugh: [10, 0], shock: [24, 0], worried: [10, -16], angry: [-10, 22],
-    sad: [8, -18], sly: [-6, 12], proud: [6, 4], tired: [-2, 0], dizzy: [14, 0] }[m] || [4, 0];
+    sad: [8, -18], sly: [-6, 12], proud: [6, 4], tired: [-2, 0], dizzy: [14, 0], strain: [-8, 20], content: [6, -2], deadpan: [-6, 0] }[m] || [4, 0];
   g.strokeStyle = INK; g.lineWidth = 12;
   [-1, 1].forEach((s) => {
     let lift = brow[0], tilt = brow[1] * s;           // tilt > 0: inner end lower (angry)
@@ -215,7 +292,13 @@
     g.beginPath(); g.ellipse(hx, my + h * 0.3, w, Math.max(4, h), 0, 0, 7); g.fillStyle = '#3A1A2A'; g.fill(); g.stroke();
     if (tongue && h > 12) { g.save(); g.clip(); g.fillStyle = '#E2697A'; g.beginPath(); g.ellipse(hx, my + h * 1.1, w * 0.7, h * 0.6, 0, 0, 7); g.fill(); g.restore(); }
   };
-  if (m === 'shock') openMouth(16, 20 + t * 6);
+  if (m === 'strain') {                                   // gritted teeth
+    g.fillStyle = '#FFFFFF'; g.lineWidth = 6; g.beginPath(); g.roundRect(hx - 30, my - 8, 60, 34, 10); g.fill(); g.stroke();
+    g.lineWidth = 3.5; g.beginPath(); g.moveTo(hx - 30, my + 9); g.lineTo(hx + 30, my + 9); [-15, 0, 15].forEach((dx) => { g.moveTo(hx + dx, my - 8); g.lineTo(hx + dx, my + 26); }); g.stroke();
+  }
+  else if (m === 'deadpan' && t <= 0.05) { g.lineWidth = 6; g.beginPath(); g.ellipse(hx, my + 6, 8, 9, 0, 0, 7); g.stroke(); }
+  else if (m === 'content' && t <= 0.05) { g.beginPath(); g.moveTo(hx - 14, my + 4); g.quadraticCurveTo(hx, my + 10, hx + 14, my + 4); g.stroke(); }
+  else if (m === 'shock') openMouth(16, 20 + t * 6);
   else if (m === 'laugh') { g.beginPath(); g.moveTo(hx - 40, my - 6); g.quadraticCurveTo(hx, my - 2, hx + 40, my - 6); g.quadraticCurveTo(hx + 34, my + 52, hx, my + 52); g.quadraticCurveTo(hx - 34, my + 52, hx - 40, my - 6); g.closePath(); g.fillStyle = '#3A1A2A'; g.fill(); g.save(); g.clip(); g.fillStyle = '#E2697A'; g.beginPath(); g.ellipse(hx, my + 50, 24, 18, 0, 0, 7); g.fill(); g.fillStyle = '#FFFFFF'; g.fillRect(hx - 40, my - 10, 80, 12); g.restore(); g.stroke(); }
   else if (t > 0.05) openMouth(14 + t * 10, 6 + t * 18);
   else if (m === 'happy' || m === 'proud') { g.beginPath(); g.moveTo(hx - 28, my); g.quadraticCurveTo(hx, my + 26, hx + 28, my); g.stroke(); }
@@ -272,6 +355,23 @@
     g.fillStyle = c; g.beginPath(); g.roundRect(hx - r * 0.72, top - 40, r * 1.44, 70, [20, 20, 4, 4]); g.fill(); g.stroke();
     g.fillStyle = INK; g.beginPath(); g.ellipse(hx - 10, top + 34, r * 0.82, 18, 0.04, 0, Math.PI); g.fill();
     g.fillStyle = '#E2B33C'; g.beginPath(); g.arc(hx, top - 6, 13, 0, 7); g.fill(); g.lineWidth = 4; g.stroke();
+  } else if (L.hat === 'railcap') {                      // hickory-stripe engineer cap: puffy striped crown, short brim
+    const crown = new Path2D(); crown.moveTo(hx - r * 1.0, top + 46); crown.bezierCurveTo(hx - r * 1.08, top - 60, hx + r * 1.12, top - 70, hx + r * 1.04, top + 46); crown.closePath();
+    g.fillStyle = c; g.fill(crown); g.save(); g.clip(crown); g.strokeStyle = L.band || '#F4F4F8'; g.lineWidth = 11;
+    for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(hx + k * 26, top + 50); g.quadraticCurveTo(hx + k * 22, top - 10, hx + k * 12, top - 60); g.stroke(); }
+    g.restore(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke(crown);
+    g.fillStyle = shadeOf(c, 0.7); g.beginPath(); g.ellipse(hx - 22, top + 50, r * 0.86, 24, 0.05, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
+  } else if (L.hat === 'cowboy') {                       // wide brim with turned-up sides, pinched crown
+    g.beginPath(); g.moveTo(hx - r * 1.55, top + 6); g.quadraticCurveTo(hx - r * 1.2, top + 52, hx, top + 50); g.quadraticCurveTo(hx + r * 1.2, top + 52, hx + r * 1.55, top + 6);
+    g.quadraticCurveTo(hx + r * 1.2, top + 30, hx, top + 26); g.quadraticCurveTo(hx - r * 1.2, top + 30, hx - r * 1.55, top + 6); g.closePath(); g.fill(); g.stroke();
+    g.beginPath(); g.moveTo(hx - r * 0.66, top + 30); g.bezierCurveTo(hx - r * 0.72, top - 60, hx - r * 0.3, top - 100, hx - r * 0.1, top - 80); g.quadraticCurveTo(hx, top - 60, hx + r * 0.1, top - 80);
+    g.bezierCurveTo(hx + r * 0.3, top - 100, hx + r * 0.72, top - 60, hx + r * 0.66, top + 30); g.closePath(); g.fill(); g.stroke();
+    band(top + 12, r * 0.66, L.band || shadeOf(c, 0.6));
+  } else if (L.hat === 'workcap') {                      // flat-topped peaked work cap
+    g.beginPath(); g.moveTo(hx - r * 0.86, top + 44); g.lineTo(hx - r * 0.98, top - 20); g.lineTo(hx + r * 0.98, top - 20); g.lineTo(hx + r * 0.86, top + 44); g.closePath(); g.fill(); g.stroke();
+    g.fillStyle = shadeOf(c, 1.25); g.beginPath(); g.ellipse(hx, top - 22, r * 0.98, 26, 0, 0, 7); g.fill(); g.stroke();
+    g.fillStyle = INK; g.beginPath(); g.ellipse(hx - 16, top + 46, r * 0.84, 18, 0.04, 0, Math.PI); g.fill();
+    band(top + 26, r * 0.88, L.band || shadeOf(c, 0.6));
   } else if (L.hat === 'flower') {
     const fx = hx + r * 0.62, fy = top + 40;
     for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.fillStyle = L.hatCol || '#F29BB5'; g.beginPath(); g.arc(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18, 14, 0, 7); g.fill(); g.lineWidth = 4; g.stroke(); }
@@ -281,6 +381,18 @@
 
 // ---------- props held in a hand: (g, x, y, angle, side) ----------
 export const PROPS = {
+  pail: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(x, y - 10, 34, Math.PI, 0); g.stroke();   // tin lunch pail
+    g.fillStyle = '#9AA3AE'; g.beginPath(); g.moveTo(x - 46, y + 4); g.lineTo(x + 46, y + 4); g.lineTo(x + 38, y + 84); g.lineTo(x - 38, y + 84); g.closePath(); g.fill(); g.stroke();
+    g.fillStyle = '#C4CAD2'; g.fillRect(x - 40, y + 14, 14, 62); g.fillStyle = '#6E7782'; g.beginPath(); g.ellipse(x, y + 4, 46, 9, 0, 0, 7); g.fill(); g.stroke(); },
+  sandwich: (g, x, y) => { g.save(); g.translate(x, y - 22); g.rotate(-0.08); g.strokeStyle = INK; g.lineWidth = 5;
+    g.fillStyle = '#F2DDA6'; g.beginPath(); g.roundRect(-52, -30, 104, 22, 8); g.fill(); g.stroke(); g.fillStyle = '#E58A9A'; g.fillRect(-50, -9, 100, 9); g.fillStyle = '#8CC063'; g.fillRect(-54, -1, 108, 6);
+    g.fillStyle = '#F2DDA6'; g.beginPath(); g.roundRect(-52, 4, 104, 22, 8); g.fill(); g.stroke(); g.restore(); },
+  maul: (g, x, y, a) => { g.save(); g.translate(x, y); g.rotate(-(a || 0) * 0.3 - 0.2); g.strokeStyle = INK; g.lineWidth = 5;      // spike maul
+    g.fillStyle = '#B07A48'; g.beginPath(); g.roundRect(-8, -230, 16, 300, 6); g.fill(); g.stroke();
+    g.fillStyle = '#4A4A55'; g.beginPath(); g.moveTo(-90, -250); g.lineTo(80, -252); g.lineTo(80, -214); g.lineTo(-90, -222); g.closePath(); g.fill(); g.stroke(); g.restore(); },
+  lantern: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(x, y - 6, 22, Math.PI, 0); g.stroke();
+    g.fillStyle = '#B5372E'; g.beginPath(); g.roundRect(x - 30, y + 10, 60, 16, 4); g.fill(); g.stroke(); g.fillStyle = '#FFE7A0'; g.beginPath(); g.roundRect(x - 24, y + 26, 48, 60, 14); g.fill(); g.stroke();
+    g.fillStyle = '#F2A33A'; g.beginPath(); g.ellipse(x, y + 60, 8, 14, 0, 0, 7); g.fill(); g.fillStyle = '#B5372E'; g.beginPath(); g.roundRect(x - 32, y + 84, 64, 14, 4); g.fill(); g.stroke(); },
   parcels: (g, x, y) => { [[0, 0, 150, 90], [10, -88, 120, 80], [-6, -160, 96, 64]].forEach(([dx, dy, w, h], i) => { g.fillStyle = ['#C8935A', '#B9844E', '#D3A26A'][i]; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.rect(x - w / 2 + dx - 40, y - h + dy, w, h); g.fill(); g.stroke(); g.fillStyle = '#E9D7A5'; g.fillRect(x + dx - 46, y - h + dy, 12, h); g.fillStyle = '#D8343F'; g.fillRect(x + dx + w / 2 - 70, y - h + dy + 10, 18, 22); }); },
   book: (title = 'RULES', open = 0) => (g, x, y) => { g.save(); g.translate(x, y - 70); g.strokeStyle = INK; g.lineWidth = 6;
     if (open > 0.5) { g.fillStyle = '#F4EFE4'; g.beginPath(); g.rect(-110, -70, 110, 140); g.rect(0, -70, 110, 140); g.fill(); g.stroke(); g.fillStyle = '#9B958A'; for (let i = 0; i < 6; i++) { g.fillRect(-96, -50 + i * 20, 82, 6); g.fillRect(14, -50 + i * 20, 82, 6); } }
IC_PATCH_0
patch -s -p0 <<'IC_PATCH_1'
--- src/core/captions.js
+++ src/core/captions.js
@@ -1,6 +1,6 @@
-// Captions: ONE word at a time (short words ride along with the next: "a single", "the whole"), white heavy sans with
-// a black outline and a soft drop shadow, centre of the screen. No colour highlight. Words keep their punctuation.
-// A script line may set "caps": "He bet | his life | savings" to choose the chunks; otherwise they're made automatically.
+// Captions (Iron Canyon): short phrases of 1-3 words ("on the job."), white heavy sans with a thick black outline and a
+// soft drop shadow, lower centre of the screen. No colour highlight. Words keep their punctuation; a chunk always ends
+// at a comma or full stop. A script line may set "caps": "He bet | his life | savings" to choose the chunks.
 import { ctx, clamp, lerp, seg, eob } from './lib.js';
 import { T, lineWords } from './timing.js';
 
@@ -9,10 +9,11 @@
 const SHORT = /^(a|an|the|to|of|in|on|at|by|and|but|or|so|is|it|he|she|we|i|his|her|my|no|up|for|was)$/i;
 
 function autoChunks(ws) {
-  const out = [];
+  const out = []; let a = 0;
   for (let i = 0; i < ws.length; i++) {
-    const w = ws[i], n = ws[i + 1], bare = w.replace(/[^A-Za-z']/g, '');
-    if (n && SHORT.test(bare) && !/[,.!?;:]$/.test(w) && (w + n).length <= 11) { out.push([i, i + 1]); i++; } else out.push([i, i]);
+    const len = ws.slice(a, i + 1).join(' ').length, n = ws[i + 1];
+    const end = !n || /[,.!?;:]$/.test(ws[i]) || i - a >= 2 || (len + 1 + n.length > 14 && !SHORT.test(ws[i].replace(/[^A-Za-z']/g, '')));
+    if (end) { out.push([a, i]); a = i + 1; }
   }
   return out;
 }
IC_PATCH_1
patch -s -p0 <<'IC_PATCH_2'
--- sheet.html
+++ sheet.html
@@ -1,5 +1,5 @@
 <!doctype html>
-<html><head><meta charset="utf-8"><title>Style sheet</title>
+<html><head><meta charset="utf-8"><title>Iron Canyon style sheet</title>
 <style>
 @font-face { font-family: 'Inter'; font-weight: 900; src: url('fonts/Inter-Black.otf'); }
 @font-face { font-family: 'Inter'; font-weight: 800; src: url('fonts/Inter-ExtraBold.otf'); }
IC_PATCH_2
cat > 'src/core/canyon.js' <<'IC_FILE_EOF'
// The Iron Canyon world: red-rock canyon country built in 3D. Layered sandstone cliffs with stepped ledges, a deep gorge
// that fades into violet haze, rail lines on the ledges, telegraph poles, cactus, steel trestles and a work beam.
//   T.strata(pal, seed, rep)          banded sandstone texture
//   cliff({ w, h, y0, ledge, setback, seed, pal }) -> Mesh   a layered wall facing +z (base at y0, recedes as it rises)
//   trestleTower(h, w) · trestleBridge(len, h) · beam(len) · cactus(s, kind) · rocks(n, area) · haze(scene, col, y)
//   railLedge(E, { sunset, trainOn }) -> { scene, sun, train }  tracks on a ledge: cliff right, lake + far mesas left
//   gorge(E, { sunset })             -> { scene, sun, beam }   a beam over the drop, far wall, tower, trestle bridge
import * as THREE from 'three';
import { canvasTex, mat, T, sky, clouds, sunlight, pole, wire } from './world.js';
import { rails, train } from './props.js';

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const box = (w, h, d, m, x = 0, y = 0, z = 0, parent) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; if (parent) parent.add(b); return b; };

export const STRATA = ['#C2452D', '#D4582F', '#E2703A', '#E8873F', '#F0A85A', '#F6CF95', '#D4582F', '#E2703A', '#B8382A'];
export const PAL = { sky: '#3F7FE0', skyLow: '#BFD9F5', rock: '#CC4A2E', rockLight: '#F0A85A', cream: '#F4C88A', dirt: '#D98A4E', haze: '#8E7BD6', lake: '#6F8FD8', cactus: '#5E8F4E', iron: '#2A2830' };

T.strata = (pal = STRATA, seed = 1, rep = [1, 1]) => canvasTex('strata' + seed + pal.join(''), 512, 1024, (g, w, h) => {
  let y = 0, i = 0;
  while (y < h) {
    const bh = 16 + rnd(seed * 31 + i) * 56, col = pal[Math.floor(rnd(seed * 7 + i * 3.3) * pal.length)];
    g.fillStyle = col; g.fillRect(0, y, w, bh + 1);
    g.fillStyle = shade(col, 1.14); g.fillRect(0, y, w, 3);                    // sunlit lip
    g.fillStyle = shade(col, 0.72); g.fillRect(0, y + bh - 3, w, 3);           // shadowed undercut
    // wavy secondary lines inside thick bands
    if (bh > 30) { g.strokeStyle = shade(col, 0.86); g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + bh * 0.5 + Math.sin(x * 0.03 + i) * 3); g.stroke(); }
    for (let k = 1; k < bh / 9; k++) { g.fillStyle = 'rgba(60,14,8,0.16)'; g.fillRect(0, y + k * 9, w, 1.5); }   // fine ridges
    y += bh; i++;
  }
  for (let k = 0; k < 2600; k++) { g.fillStyle = rnd(k * 1.7) > 0.5 ? 'rgba(255,240,210,0.25)' : 'rgba(80,20,10,0.22)'; g.fillRect(rnd(k * 2.3) * w, rnd(k * 4.1) * h, 2, 2); }
  g.globalAlpha = 0.1; g.fillStyle = '#4A160E';                                  // desert-varnish streaks
  for (let k = 0; k < 46; k++) g.fillRect(rnd(k * 9.1) * w, rnd(k * 5.7) * h, 2 + rnd(k) * 6, 40 + rnd(k * 3) * 220);
  g.globalAlpha = 1;
}, rep);

/** a layered sandstone wall in the x-y plane facing +z: base at y0, ledges every `ledge` m, each one set back by `setback` */
export function cliff({ w = 160, h = 60, y0 = 0, ledge = 1.7, setback = 0.34, rough = 0.3, seed = 1, pal = STRATA, texH = 34, seg = [180, 140], rim = 24 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, seg[0], seg[1]), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), yy = p.getY(i) + h / 2;                                 // 0 at the base
    const b = Math.floor(yy / ledge), f = (yy % ledge) / ledge;
    let z = -(b * setback + THREE.MathUtils.smoothstep(f, 0.82, 1) * setback);    // stepped terraces
    z += Math.sin(x * 0.33 + seed) * 0.55 + Math.sin(x * 1.1 + seed * 2) * 0.22;  // gullies and fins
    z += (rnd(seed * 17 + b * 13 + Math.floor(x / 2.5)) - 0.5) * rough;           // blocky breaks per layer
    z -= Math.floor(yy / (ledge * 4)) * setback * 1.5;                           // every 4th ledge a deeper terrace
    if (yy >= h - 0.01) z -= rim;                                                 // the top folds back into a plateau
    p.setXYZ(i, x, yy + y0, z);
    uv.setXY(i, x / texH, yy / texH);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat({ map: T.strata(pal, seed), flatShading: true, roughness: 0.95 }));
  m.castShadow = m.receiveShadow = true; return m;
}

/** violet haze: scene fog + a glowing floor far below */
export function haze(scene, { col = PAL.haze, near = 40, far = 330, floorY = -90 } = {}) {
  scene.fog = new THREE.Fog(col, near, far);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshBasicMaterial({ color: col, fog: false })); f.rotation.x = -Math.PI / 2; f.position.y = floorY; scene.add(f);
  return f;
}

/** a steel lattice tower (h tall, w wide), base at y = 0 going up */
export function trestleTower(h = 30, w = 2.4, col = PAL.iron) {
  const g = new THREE.Group(), m = mat({ color: col, roughness: 0.6, metalness: 0.3 }), t = 0.09;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => box(t, h, t, m, sx * w / 2, h / 2, sz * w / 2, g));
  const lv = 2.2, d = Math.hypot(w, lv);
  for (let y = 0; y < h; y += lv) {
    [[0, w / 2, 0], [0, -w / 2, 0], [Math.PI / 2, 0, w / 2], [Math.PI / 2, 0, -w / 2]].forEach(([ry, zz, xx]) => {
      [1, -1].forEach((s) => { const b = box(d, t * 0.7, t * 0.7, m, xx, y + lv / 2, zz, g); b.rotation.set(0, ry, s * Math.atan2(lv, w)); });
      const hb = box(w, t, t, m, xx, y, zz, g); hb.rotation.y = ry;
    });
  }
  return g;
}

/** a long timber trestle bridge along x (deck at y = 0, bents going down h metres) with rails on top */
export function trestleBridge(len = 120, h = 26, col = '#5A3E2A') {
  const g = new THREE.Group(), m = mat({ color: col, roughness: 0.9 }), t = 0.22;
  for (let x = -len / 2; x <= len / 2; x += 5) {
    const bent = new THREE.Group(); bent.position.x = x; g.add(bent);
    [-1, 1].forEach((s) => { const leg = box(t, h, t, m, 0, -h / 2, s * 1.4, bent); leg.rotation.x = s * 0.06; });
    for (let y = -h; y < 0; y += 4) [1, -1].forEach((s) => { const b = box(t * 0.6, 4.4, t * 0.6, m, 0, y + 2, 0, bent); b.rotation.x = s * 0.6; });
  }
  box(len + 4, 0.4, 3.2, m, 0, 0.1, 0, g);
  const r = rails(len + 4); r.position.y = 0.2; g.add(r);
  return g;
}

/** the work beam the crew sits on (along x) */
export function beam(len = 14) {
  return box(len, 0.34, 0.42, mat({ map: T.dirt('#8E7D6A', [len / 2, 0.2], false), roughness: 0.9 }), 0, 0, 0);
}

export function cactus(s = 1, kind = 'saguaro') {
  const g = new THREE.Group(), m = mat({ color: PAL.cactus, roughness: 0.8 });
  const cyl = (r, h, x, y, z) => { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 10), m); c.position.set(x, y, z); c.castShadow = true; g.add(c); return c; };
  if (kind === 'saguaro') { cyl(0.22 * s, 2.6 * s, 0, 1.5 * s, 0); [[-1, 1.4, 0.9], [1, 1.9, 0.7]].forEach(([sd, y, hh]) => { cyl(0.15 * s, 0.4 * s, sd * 0.4 * s, y * s, 0).rotation.z = sd * 1.57; cyl(0.15 * s, hh * s, sd * 0.62 * s, (y + hh / 2 + 0.05) * s, 0); }); }
  else [[0, 0.35, 0, 0], [0.25, 0.75, 0.05, 0.5], [-0.22, 0.7, 0, -0.5], [0.05, 1.05, 0, 0.2]].forEach(([x, y, z, r]) => { const pad = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 12, 8), m); pad.scale.set(1, 1.25, 0.32); pad.position.set(x * s, y * s, z); pad.rotation.z = r; pad.castShadow = true; g.add(pad); });
  return g;
}

/** scattered stones: n rocks inside [x0, x1] x [z0, z1] at height y */
export function rocks(n, [x0, x1, z0, z1], y = 0, cols = ['#B2462E', '#8E7D6A', '#C9A27A', '#6E6A6A']) {
  const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat({ roughness: 0.9 }), n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { const s = 0.04 + rnd(i * 3.3) ** 3 * 0.35; e.set(rnd(i), rnd(i * 2), rnd(i * 5)); q.setFromEuler(e); m4.compose(new THREE.Vector3(x0 + rnd(i * 1.7) * (x1 - x0), y + s * 0.4, z0 + rnd(i * 2.9) * (z1 - z0)), q, new THREE.Vector3(s, s * 0.7, s)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(cols[i % cols.length])); }
  im.castShadow = im.receiveShadow = true; return im;
}

const SKY = (sunset) => (sunset ? { top: '#5E4FB0', horizon: '#FF9A70' } : { top: PAL.sky, horizon: PAL.skyLow });

/** tracks on a ledge: the cliff rises on the right (+x), a lake and far mesas on the left, poles along the line */
export function railLedge(E, { sunset = false, trainOn = true, len = 260 } = {}) {
  const scene = new THREE.Scene(); sky(scene, SKY(sunset));
  const sun = sunlight(scene, E, sunset ? { col: '#FFB07A', i: 2.6, pos: [-30, 10, 10], target: [1, 0, -6], box: 16, sky: '#C9A6E0', ground: '#7A3A2A', hemi: 1.0 }
    : { col: '#FFF0D6', i: 2.9, pos: [-10, 16, 8], target: [1, 0, -6], box: 16, sky: '#CFE2FF', ground: '#C4703E', hemi: 1.2 });
  haze(scene, { col: sunset ? '#B07AB8' : '#9FA6E0', near: 60, far: 420, floorY: -30 });
  clouds(scene, [[-60, 40, -160, 30], [20, 55, -220, 36], [-120, 30, -120, 22]], sunset ? '#FFB8A0' : '#FFFFFF');
  const z0 = -len / 2 + 20;
  // the ledge: packed dirt from the lake edge (x -4) to the cliff (x 7)
  const ground = box(11, 1, len, mat({ map: T.dirt(PAL.dirt, [3, len / 8], false) }), 1.5, -0.5, z0); ground.castShadow = false;
  const edge = cliff({ w: len, h: 7, y0: -7, ledge: 1.6, setback: 0.25, seed: 4, seg: [140, 10], rim: 0 }); edge.rotation.y = -Math.PI / 2; edge.position.set(-4, 0, z0); scene.add(edge);
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(600, len * 2), mat({ color: PAL.lake, roughness: 0.25, metalness: 0.1 })); lake.rotation.x = -Math.PI / 2; lake.position.set(-300, -5.5, z0); lake.receiveShadow = true; scene.add(lake);
  // far mesas across the lake
  [[-150, -60, 0.2, 7], [-130, -230, 0.4, 9], [-220, -140, 0.1, 3]].forEach(([x, z, ry, sd]) => { const c = cliff({ w: 160, h: 18 + sd, y0: -6, ledge: 4, setback: 1.4, seed: sd, seg: [60, 20], rim: 40 }); c.position.set(x, 0, z); c.rotation.y = Math.PI / 2 + ry; scene.add(c); });
  // the cliff on the right
  const wall = cliff({ w: len, h: 46, y0: -1, ledge: 1.9, setback: 0.45, seed: 2, seg: [200, 150] }); wall.rotation.y = -Math.PI / 2; wall.position.set(7.2, 0, z0); scene.add(wall);
  const r = rails(len); r.rotation.y = Math.PI / 2; r.position.set(-0.6, 0, z0); scene.add(r);
  for (let z = 8; z > -len + 40; z -= 16) { const p = pole(7.5); p.position.set(4.6, 0, z); p.rotation.y = Math.PI / 2; scene.add(p); }
  for (let z = 8; z > -len + 56; z -= 16) [-0.8, -0.3, 0.3, 0.8].forEach((dz) => scene.add(wire(new THREE.Vector3(4.6, 7.0, z + dz * 0), new THREE.Vector3(4.6, 7.0, z - 16), 0.4)));
  for (let i = 0; i < 26; i++) { const c = cactus(0.5 + rnd(i) * 0.5, rnd(i * 3) > 0.6 ? 'saguaro' : 'pear'); c.position.set(5.2 + rnd(i * 7) * 1.6, 0, 6 - i * 9 - rnd(i * 5) * 4); scene.add(c); }
  scene.add(rocks(900, [-4, 7, -len + 40, 12], 0));
  let tr = null; if (trainOn) { tr = train(); tr.rotation.y = Math.PI / 2; tr.position.set(-0.6, 0, 40); scene.add(tr); }
  return { scene, sun, train: tr };
}

/** the gorge: a work beam over the drop (along x at y 0, z 0), the far wall across, a lattice tower, a trestle bridge */
export function gorge(E, { sunset = false, beamLen = 16 } = {}) {
  const scene = new THREE.Scene(); sky(scene, SKY(sunset));
  const sun = sunlight(scene, E, sunset ? { col: '#FFB07A', i: 2.6, pos: [-24, 8, 12], target: [0, 0, 0], box: 12, sky: '#C9A6E0', ground: '#7A3A2A', hemi: 1.0 }
    : { col: '#FFF0D6', i: 3.0, pos: [-8, 14, 9], target: [0, 0, 0], box: 12, sky: '#CFE2FF', ground: '#B2462E', hemi: 1.2 });
  haze(scene, { col: sunset ? '#9A6AB8' : PAL.haze, near: 30, far: 260, floorY: -110 });
  clouds(scene, [[30, 60, -200, 34], [-40, 70, -260, 40], [90, 50, -180, 24]], sunset ? '#FFB8A0' : '#FFFFFF');
  const far = cliff({ w: 460, h: 124, y0: -110, seed: 3, seg: [220, 300], rim: 60 }); far.position.set(60, 0, -60); far.rotation.y = 0.62; scene.add(far);
  const near = cliff({ w: 200, h: 130, y0: -110, seed: 6, seg: [100, 240], rim: 40 }); near.position.set(-28, 0, 40); near.rotation.y = Math.PI * 0.62; scene.add(near);
  const b = beam(beamLen); b.position.set(2, 0, 0); scene.add(b);
  const tw = trestleTower(40, 2.6); tw.position.set(-5.2, -40.2, 0); scene.add(tw);
  const tw2 = trestleTower(40, 2.6); tw2.position.set(10, -40.2, 0); scene.add(tw2);
  const br = trestleBridge(150, 40); br.position.set(10, -5, -24); br.rotation.y = 0.5; scene.add(br);
  return { scene, sun, beam: b, beamTop: 0.17, beamFront: 0.21 };
}
IC_FILE_EOF
cat > 'src/sheet.js' <<'IC_FILE_EOF'
// The Iron Canyon style sheet: every picture is drawn by the style's own engine (3D canyon sets + 2D cut-out crew).
import * as THREE from 'three';
import { ctx } from './core/lib.js';
import { startBoard, panel, frame, small, rules, swatches } from './core/board.js';
import { makeEngine, camera } from './core/engine.js';
import * as CY from './core/canyon.js';
import { Toon, drawToon, PROPS } from './core/toon.js';
import { captionText } from './core/captions.js';

await document.fonts.load('900 40px Inter'); await document.fonts.load('800 40px Inter');
const GL = document.getElementById('gl'), GL2 = document.getElementById('gl2');
GL.width = 648; GL.height = 1152;
const E = makeEngine(GL, { w: 648, h: 1152, samples: 0 }), E2 = makeEngine(GL2, { w: 1280, h: 860, samples: 0 });
const cam = camera(40);
const B = startBoard(document.getElementById('cv'), { title: 'IRON CANYON 3D: VIDEO STYLE SHEET', bg: '#1E1715', line: '#4A3B36', head: '#FFF1E0', accent: '#E8873F' });
const shot = (x, y, w, renderFn, over) => frame(x, y, w, () => { renderFn(); ctx.drawImage(GL, 0, 0, 1080, 1920); if (over) over(); });
const wide = (box, renderFn, over) => { renderFn(); B.save(); B.beginPath(); B.roundRect(box.x, box.y, box.w, box.h, 12); B.clip(); B.drawImage(GL2, box.x, box.y, box.w, box.h); B.restore(); if (over) over(); };

export const CREW = {
  foreman: { body: '#A8382A', pattern: 'plaid', patCol: '#2A1A22', straps: '#3A2E2A', hat: 'bowler', hatCol: '#5E5248', hair: '#D2D3D9', extra: ['beard'], beardCol: '#C4C5CB' },
  engineer: { body: '#3FA7A0', pattern: 'jacket', patCol: '#2C7C78', hat: 'railcap', hatCol: '#3E5C9A', hair: '#8A5A36', neck: 'scarf', neckCol: '#C8372E' },
  rookie: { body: '#7FA24A', pattern: 'jacket', patCol: '#5E7E34', belt: '#3A2E2A', hat: 'workcap', hatCol: '#55565E', hair: '#8A5A36', hairSide: -1 },
  oldhand: { body: '#7A6248', pattern: 'jacket', patCol: '#5A4634', hat: 'cowboy', hatCol: '#6E5038', hair: '#B9BAC0', extra: ['mustache'], mustacheCol: '#B9BAC0' },
  cook: { body: '#E2B33C', pattern: 'apron', patCol: '#F4EFE4', hat: 'cap', hatCol: '#9E2F27', hair: '#3A2A22', extra: ['freckles'] },
  boss: { body: '#3B3346', pattern: 'vest', patCol: '#2A2533', hat: 'tophat', hatCol: '#2A2638', neck: 'bowtie', neckCol: '#C8372E', extra: ['mustache', 'monocle'] },
};

// sets
const G = CY.gorge(E);
const sitY = G.beamTop - 0.39, sitZ = G.beamFront + 0.03;
const crew = ['oldhand', 'rookie', 'foreman', 'engineer'].map((k) => { const t = new Toon(CREW[k]); G.scene.add(t.group); return t; });
const seat = (st) => {
  crew[0].at(-1.9, sitY, sitZ).set({ mood: 'deadpan', legs: 'sit', armL: [12, 40], armR: [14, 60], holdR: PROPS.cup });
  crew[1].at(-0.85, sitY, sitZ).set({ mood: 'smug', legs: 'sit', armR: [70, -40], holdR: PROPS.sandwich, look: [0.6, 0] });
  crew[2].at(0.25, sitY, sitZ).set({ mood: 'content', legs: 'sit', armL: [30, -70], armR: [30, -70], holdL: PROPS.sandwich, ...st });
  crew[3].at(1.35, sitY, sitZ).set({ mood: 'laugh', legs: 'sit', armL: [14, 50], holdL: PROPS.pail });
};
const faceAll = (c) => crew.forEach((t) => t.face(c));

// 1 · hero frame
let b = panel(20, 80, 540, 520, 1, 'HERO FRAME');
shot(b.x + 4, b.y, 246, () => {
  seat({});
  cam.position.set(4.6, 1.0, 3.0); cam.lookAt(-1.2, 0.75, -1.2); faceAll(cam);
  E.render(G.scene, cam, { focus: 4.4, aperture: 0.0006, maxblur: 0.006, bloom: 0.12, sat: 1.15 });
}, () => captionText('above nothing.', 540, 1340));
[['2D CARTOON CREW', 'thick ink, pencil shading'], ['IN A 3D CANYON', 'layered red rock, real sun'], ['DIZZY HEIGHTS', 'beams, ledges, trestles'], ['TRUE WORK STORIES', 'old jobs, told deadpan'], ['1-3 WORD CAPTIONS', 'white, low centre']]
  .forEach(([a, c], i) => { small(a, b.x + 270, b.y + 34 + i * 86, 'left', 16, '#FFF1E0'); small(c.toUpperCase(), b.x + 270, b.y + 58 + i * 86, 'left', 12, '#B8A79E'); });

// 2 · the crew
b = panel(570, 80, 690, 520, 2, 'THE CREW');
{
  const g = B; g.save(); g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h - 8, 12); g.clip();
  const gr = g.createLinearGradient(0, b.y, 0, b.y + b.h); gr.addColorStop(0, '#6FA3EA'); gr.addColorStop(0.45, '#BFD9F5'); gr.addColorStop(0.45, '#E8873F'); gr.addColorStop(0.58, '#CC4A2E'); gr.addColorStop(0.72, '#F0A85A'); gr.addColorStop(0.72, '#D98A4E'); gr.addColorStop(1, '#B8692F');
  g.fillStyle = gr; g.fillRect(b.x, b.y, b.w, b.h);
  const roles = [['foreman', 'FOREMAN', { mood: 'content', armR: [30, -84], holdR: PROPS.pail }], ['engineer', 'ENGINEER', { mood: 'strain', armR: [150, 20], holdR: PROPS.maul }], ['rookie', 'THE ROOKIE', { mood: 'worried', armL: [40, -40], armR: [40, -40] }],
    ['oldhand', 'OLD HAND', { mood: 'deadpan', armR: [20, -100], holdR: PROPS.cup }], ['cook', 'THE COOK', { mood: 'happy', armL: [30, -80], holdL: PROPS.sandwich }], ['boss', 'THE BOSS', { mood: 'smug', armL: [30, -70], holdL: PROPS.stack }]];
  roles.forEach(([k, name, st], i) => { g.save(); g.translate(b.x + 6 + i * 110, b.y + 44); g.scale(0.22, 0.22); drawToon(g, CREW[k], st); g.restore(); small(name, b.x + 62 + i * 110, b.y + b.h - 30, 'center', 13, '#2A1A16'); });
  g.restore();
  small('RECIPE: ROUND HEAD · HAIR TUFT · ONE WORK HAT · BEARD OR NECKERCHIEF', b.x + b.w / 2, b.y + b.h + 6, 'center', 12, '#B8A79E');
}

// 3 · faces
b = panel(1270, 80, 630, 520, 3, 'FACES DO THE ACTING');
{
  const moods = ['neutral', 'content', 'deadpan', 'smug', 'laugh', 'shock', 'worried', 'strain', 'angry', 'sad', 'tired', 'dizzy'];
  moods.forEach((m, i) => {
    const cx = b.x + 52 + (i % 6) * 100, cy = b.y + 20 + Math.floor(i / 6) * 215;
    B.save(); B.beginPath(); B.roundRect(cx - 46, cy, 92, 150, 10); B.fillStyle = '#3A2B26'; B.fill(); B.clip();
    B.translate(cx - 75, cy + 4); B.scale(0.29, 0.29); drawToon(B, CREW.engineer, { mood: m }); B.restore();
    small(m.toUpperCase(), cx, cy + 176, 'center', 13, ['content', 'deadpan', 'strain'].includes(m) ? '#F0A85A' : '#FFF1E0');
  });
}

// 4 · worlds
b = panel(20, 610, 760, 456, 4, 'WORLDS');
const sw = 206, sx = (i) => b.x + 14 + i * (sw + 40);
{
  const R = CY.railLedge(E, { trainOn: false });
  const eng = new Toon(CREW.engineer); R.scene.add(eng.group);
  eng.at(-0.1, 0, -0.6).set({ mood: 'strain', legs: 'walk', phase: 0.6, armR: [150, 30], holdR: PROPS.maul, lean: -4 });
  shot(sx(0), b.y, sw, () => { cam.position.set(-1.3, 1.35, 3.4); cam.lookAt(0.7, 1.7, -12); eng.face(cam); E.render(R.scene, cam, { focus: 4.1, aperture: 0.0006, bloom: 0.12 }); });
}
shot(sx(1), b.y, sw, () => {
  seat({ mood: 'happy' });
  cam.position.set(-0.3, 2.1, 5.6); cam.lookAt(0.0, -1.4, -3); faceAll(cam);
  E.render(G.scene, cam, { focus: 5.6, aperture: 0.0005, bloom: 0.12 });
});
{
  const GS = CY.gorge(E, { sunset: true });
  const k = new Toon(CREW.foreman); GS.scene.add(k.group); k.at(5.0, GS.beamTop, 0.0).set({ mood: 'content', armL: [150, 10], holdR: PROPS.lantern, armR: [20, -30] }); k.tint('#FFE2D2');
  shot(sx(2), b.y, sw, () => { cam.position.set(5.8, 1.3, 5.0); cam.lookAt(3.5, 0.6, -30); k.face(cam); E.render(GS.scene, cam, { focus: 3.6, aperture: 0.0008, bloom: 0.3 }); });
}
['(A) THE RAIL LEDGE', '(B) LUNCH ON THE BEAM', '(C) THE BEAM, SUNSET'].forEach((t, i) => small(t, sx(i) + sw / 2, b.y + sw * 16 / 9 + 24, 'center', 14));

// 5 · captions
b = panel(790, 610, 520, 456, 5, 'CAPTIONS');
wide({ x: b.x, y: b.y, w: b.w, h: b.h - 10 }, () => {
  seat({ mood: 'shock', look: [-0.6, 0.6] });
  const c3 = new THREE.PerspectiveCamera(30, 1280 / 860, 0.05, 900); c3.position.set(1.4, 1.0, 3.6); c3.lookAt(0.0, 0.6, -1); faceAll(c3);
  E2.render(G.scene, c3, { focus: 3.8, aperture: 0.0015, maxblur: 0.01, bloom: 0.12 });
}, () => {
  const mid = b.x + b.w / 2;
  [['He worked', 60], ['two hundred feet', 160], ['above nothing.', 260]].forEach(([w, y]) => { B.save(); B.translate(mid, b.y + y); B.scale(0.5, 0.5); captionText(w, 0, 0); B.restore(); });
  small('1-3 WORDS · WHITE · THICK BLACK EDGE · LOW CENTRE', mid, b.y + b.h - 34, 'center', 13, '#FFFFFF');
});

// 6 · palette + rules
b = panel(1320, 610, 580, 456, 6, 'PALETTE + RULES');
const yy = swatches({ x: b.x, y: b.y - 6, w: b.w, h: 120 }, [['SKY', '#3F7FE0'], ['ROCK', '#CC4A2E'], ['SAND', '#F0A85A'], ['HAZE', '#8E7BD6'], ['CACTUS', '#5E8F4E'], ['IRON', '#2A2830']]);
rules(b, ['OPEN ON THE CRAZIEST FACT, THEN EXPLAIN IT.', 'HEIGHT IS THE STAR: SHOW THE DROP OFTEN.', 'NEW SHOT EVERY 1.5-3 S; THE CAMERA DRIFTS.', 'FACES REACT ON EVERY BEAT (STRAIN, DEADPAN).', 'MIDDAY SUN ON RED ROCK; SUNSET FOR ENDINGS.'], yy - 4, 15, 44);
window.SHEET_READY = true;
IC_FILE_EOF
cat > 'tools/stylesheet.mjs' <<'IC_FILE_EOF'
// Render the style sheet (sheet.html) to a PNG with headless Chrome.   node tools/stylesheet.mjs ../style-sheet.png
// Uses the pre-installed Playwright if available. SOFTWARE_GL=1 forces the software renderer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(ROOT, process.argv[2] || '../style-sheet.png');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf', '.png': 'image/png' };
const srv = http.createServer((req, r) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise((res) => srv.listen(0, '127.0.0.1', res));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = []; page.on('console', (m) => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', (e) => logs.push('ERROR: ' + e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/sheet.html`);
try { await page.waitForFunction(() => window.SHEET_READY === true, null, { timeout: 600000, polling: 500 }); }
catch (e) { console.log(logs.join('\n')); throw e; }
const data = await page.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
if (logs.length) console.log(logs.filter((l) => !l.includes('GPU stall')).join('\n'));
console.log(out); await browser.close(); srv.close();
IC_FILE_EOF
cat > 'src/core/rig.js' <<'IC_FILE_EOF'
// Iron Canyon rigs + smooth motion.
//   drift(x)                         camera progress: mostly constant speed, a touch of easing (keeps moving through cuts)
//   wrapShot(o)                      wrap a shot so clock.t holds the film time while it draws (needed by idle())
//   idle(seed)                       a gentle breathing bob in px, for anyone standing or sitting still
//   tween(a, b, t, t0, dur)          blend two poses (arrays like [shoulder, elbow]) over dur seconds from t0
//   canyonWall(E, opts) -> rig       a sheer Black-Canyon wall with a flat rim at y 0, a far wall across, violet haze,
//                                    ropes + bosun seats:  rig.hang(person, x, feetY, state, swing)  rig.stand(person, x, z, state, y)
//                                    rig.faceZ(y) (wall face), rig.rimZ (rim lip), rig.rope(), rig.stretch(mesh, a, b), rig.reset(people)
import * as THREE from 'three';
import * as WD from './world.js';
import * as CY from './canyon.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const eio = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const eo = (x) => 1 - (1 - x) * (1 - x);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const drift = (x) => 0.7 * x + 0.3 * eio(x);
export const clock = { t: 0 };
export const wrapShot = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { clock.t = t; f(lt, d, t, blit); }; return o; };
export const idle = (seed = 0) => Math.sin(clock.t * 3.1 + seed * 1.7) * 3;
export const tween = (a, b, t, t0, dur = 0.25) => { const k = eo(clamp((t - t0) / dur)); return a.map((v, i) => v + (b[i] - v) * k); };

export function canyonWall(E, { sunset = false, height = 162, seed = 5 } = {}) {
  const scene = new THREE.Scene(); WD.sky(scene, sunset ? { top: '#5E4FB0', horizon: '#FF9A70' } : { top: CY.PAL.sky, horizon: CY.PAL.skyLow });
  const sun = WD.sunlight(scene, E, sunset ? { col: '#FFB07A', i: 2.6, pos: [-24, 10, 20], target: [0, -8, 0], box: 14, sky: '#C9A6E0', ground: '#7A3A2A', hemi: 1.0 }
    : { col: '#FFF0D6', i: 3.0, pos: [-14, 22, 20], target: [0, -8, 0], box: 14, sky: '#CFE2FF', ground: '#B2462E', hemi: 1.15 });
  CY.haze(scene, { col: sunset ? '#9A6AB8' : CY.PAL.haze, near: 35, far: 320, floorY: -height - 3 });
  WD.clouds(scene, [[-60, 60, 160, 30], [40, 70, 190, 38], [120, 55, -120, 30], [-110, 45, -60, 24]], sunset ? '#FFB8A0' : '#FFFFFF');
  scene.add(CY.cliff({ w: 200, h: height, y0: -height, ledge: 1.7, setback: 0.03, rough: 0.25, seed, seg: [200, Math.round(height * 2.1)], rim: 40 }));
  const faceZ = (y) => -0.0243 * (y + height);
  const far = CY.cliff({ w: 300, h: height + 8, y0: -height - 3, seed: seed + 3, seg: [150, 240], rim: 40 }); far.position.set(0, 4, 95); far.rotation.y = Math.PI; scene.add(far);
  const bend = CY.cliff({ w: 260, h: height + 3, y0: -height - 3, seed: seed + 4, seg: [120, 220], rim: 40 }); bend.position.set(150, 2, 40); bend.rotation.y = -Math.PI * 0.5; scene.add(bend);
  const rimZ = faceZ(0) + 0.5;
  const ground = new THREE.Mesh(new THREE.BoxGeometry(200, 0.8, 40), WD.mat({ map: WD.T.dirt(CY.PAL.dirt, [20, 4], false) }));
  ground.position.set(0, -0.4, rimZ - 20); ground.receiveShadow = true; scene.add(ground);
  scene.add(CY.rocks(500, [-30, 30, rimZ - 12, rimZ - 0.4], 0));
  for (let i = 0; i < 8; i++) { const c = CY.cactus(0.45 + rnd(i) * 0.4, i % 3 ? 'pear' : 'saguaro'); c.position.set(-22 + i * 6 + rnd(i * 3) * 3, 0, rimZ - 5 - rnd(i * 5) * 6); scene.add(c); }
  const ropeMat = WD.mat({ color: '#C9A877', roughness: 0.9 }), seatMat = WD.mat({ map: WD.T.planks('#9A6337', [0.3, 0.3]) });
  const extras = [];
  const rope = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), ropeMat); m.castShadow = true; scene.add(m); extras.push(m); return m; };
  const seat = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.26), seatMat); m.castShadow = true; scene.add(m); extras.push(m); return m; };
  const stretch = (m, a, b) => { const d = b.clone().sub(a), len = d.length(); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); m.visible = true; };
  const kit = new Map();                              // person -> { rope, seat }
  const hang = (p, x, y, st = {}, swing = 0) => {
    if (!kit.has(p)) kit.set(p, { rope: rope(), seat: seat() });
    const k = kit.get(p), z = faceZ(y) + 1.05, seatY = y + 0.35;
    if (p.group.parent !== scene) scene.add(p.group);
    p.group.visible = true; p.at(x + swing, y, z).set({ legs: 'sit', bob: idle(x), ...st });
    k.seat.position.set(x + swing, seatY, z - 0.06); k.seat.visible = true;
    stretch(k.rope, V3(x + swing, seatY, z - 0.1), V3(x, 0.05, rimZ - 0.2));
    return z;
  };
  const stand = (p, x, z, st = {}, y = 0) => { if (p.group.parent !== scene) scene.add(p.group); p.group.visible = true; p.at(x, y, z).set({ bob: st.legs === 'walk' || st.legs === 'jump' ? 0 : idle(x + 3), ...st }); };
  const reset = (people = []) => { people.forEach((p) => { p.group.visible = false; p.mesh.rotation.z = 0; }); extras.forEach((m) => (m.visible = false)); };
  return { scene, sun, faceZ, rimZ, rope, seat, stretch, hang, stand, reset };
}
IC_FILE_EOF
MIXURL=https://raw.githubusercontent.com/schoolwork171717-boop/shorts-videos/main/kit/mix.py
if curl -fsSL "$MIXURL" -o /tmp/ic-mix.py 2>/dev/null && grep -q music_dry /tmp/ic-mix.py; then cp /tmp/ic-mix.py tools/mix.py
elif [ -f "$HOME/shorts-videos/kit/mix.py" ]; then cp "$HOME/shorts-videos/kit/mix.py" tools/mix.py
else echo "WARNING: Iron Canyon mixer (dry/quirk music + voice polish) not found; using the default mixer"; fi
for f in engine.js fx.js main.js toon.js act.js han.js beasts.js tokyo.js pinkset.js critters.js outback.js emuwar.js graveyard.js store.js world.js captions.js index.html; do case $f in main.js) dst=src/main.js;; index.html) dst=index.html;; *) dst=src/core/$f;; esac
  curl -fsSL "https://raw.githubusercontent.com/schoolwork171717-boop/shorts-videos/main/kit/engine/$f" -o "/tmp/ic-$f" 2>/dev/null && grep -q . "/tmp/ic-$f" && cp "/tmp/ic-$f" "$dst" \
    || cp "$HOME/shorts-videos/kit/engine/$f" "$dst" 2>/dev/null || echo "WARNING: engine v3 file $f not found; the old flat look is used"; done
curl -fsSL "https://raw.githubusercontent.com/schoolwork171717-boop/shorts-videos/main/kit/tools/voice.py" -o tools/voice.py 2>/dev/null && grep -q "blended voices" tools/voice.py \
  || cp "$HOME/shorts-videos/kit/tools/voice.py" tools/voice.py 2>/dev/null || echo "WARNING: kit voice.py (blended voices) not found; use faceless-shorts voice.py with a single voice"
curl -fsSL "https://raw.githubusercontent.com/schoolwork171717-boop/shorts-videos/main/kit/fonts/Nunito-Black.woff2" -o fonts/Nunito-Black.woff2 2>/dev/null || cp "$HOME/shorts-videos/kit/fonts/Nunito-Black.woff2" fonts/ 2>/dev/null || echo "WARNING: Nunito font missing; captions fall back to Inter"
# v7 narrator: cloned from the user's reference video (Pocket TTS via sherpa-onnx; models from GitHub releases)
R=https://raw.githubusercontent.com/schoolwork171717-boop/shorts-videos/main/kit
curl -fsSL "$R/tools/clone_voice.py" -o tools/clone_voice.py 2>/dev/null && grep -q "Pocket TTS" tools/clone_voice.py \
  || cp "$HOME/shorts-videos/kit/tools/clone_voice.py" tools/clone_voice.py 2>/dev/null || echo "WARNING: clone_voice.py not found; fall back to tools/voice.py"
mkdir -p "$HOME/.faceless-shorts/voice"
curl -fsSL "$R/voice/narrator.wav" -o "$HOME/.faceless-shorts/voice/narrator.wav" 2>/dev/null || cp "$HOME/shorts-videos/kit/voice/narrator.wav" "$HOME/.faceless-shorts/voice/" 2>/dev/null || echo "WARNING: voice/narrator.wav (reference clip) not found"
mkdir -p examples
for f in sun-kink-shots.js quick-draw-shots.js cave-shots.js jar-shots.js train-pushers-shots.js pink-cell-shots.js emu-war-shots.js emu-war-script.json emu-sample-shots.js lottery-clerk-shots.js lottery-clerk-script.json; do curl -fsSL "https://raw.githubusercontent.com/schoolwork171717-boop/shorts-videos/main/kit/examples/$f" -o "examples/$f" 2>/dev/null || cp "$HOME/shorts-videos/kit/examples/$f" "examples/$f" 2>/dev/null || true; done
# voice energizer (WORLD vocoder) for mix.py's "energize"
PYV="$HOME/.faceless-shorts/venv/bin/python"
if [ -x "$PYV" ] && ! "$PYV" -c "import pyworld" 2>/dev/null; then
  (command -v uv >/dev/null && uv pip install --python "$PYV" -q pyworld "setuptools<70") || "$PYV" -m pip install -q pyworld "setuptools<70" 2>/dev/null || echo "WARNING: pyworld not installed; the voice will not be energized"
fi
if [ -x "$PYV" ] && ! "$PYV" -c "import sherpa_onnx, num2words" 2>/dev/null; then
  (command -v uv >/dev/null && uv pip install --python "$PYV" -q sherpa-onnx num2words) || "$PYV" -m pip install -q sherpa-onnx num2words 2>/dev/null || echo "WARNING: sherpa-onnx not installed; the cloned narrator needs it"
fi
[ -x "$PYV" ] && "$PYV" -c "import sys; sys.argv=['x']; sys.path.insert(0,'tools'); import clone_voice as c; c.ensure_models()" 2>/dev/null || echo "WARNING: narrator models not downloaded yet (clone_voice.py downloads them on first use)"
cat > '../STYLE.md' <<'IC_FILE_EOF'
# Iron Canyon 3D: wild true work stories, 9:16

Deadpan, a little dizzy, a little proud. Flat 2D cartoon crew (thick ink outlines, round white heads with pencil-hatched
shading, hair tufts under work hats, bushy beards, plaid and work jackets, stick limbs) acting inside a sunlit 3D
red-rock canyon: layered sandstone cliffs, a gorge that fades into violet haze, rail lines on ledges, telegraph poles,
cactus, steel lattice towers, timber trestles and the work beam they eat lunch on. Height is the star.
Built on the Tall Tale 3D engine. Sheet: `style-sheet.png` (drawn by `example/sheet.html` → `node example/tools/stylesheet.mjs`).

## 0. v8: the reference-channel style (Nov 2026). Where this disagrees with a later section, THIS wins.
Measured from 20 reference Shorts (31-78 s, median ~57 s). Emulate the style; never copy their scripts, shots, characters
or music. Example: `examples/emu-war-shots.js` + `examples/emu-war-script.json` (10 s sample, Great Emu War).
- **Story, not school.** No inventor or scientist names, no dates lists, no "in 1953 Dr X...". The protagonist is "he",
  "a general", "the inventor", "a farmer". Cold open = a statement of the most absurd true moment ("An army rolled out
  machine guns to fight a bunch of birds."), never a question. Then escalation with quoted dialogue and a sarcastic side
  character ("The general said it would take a week, tops."), mockery, a "You see," explanation ~2/3 in with an
  everyday analogy, and an ironic punchline ending. Present tense or "you" framing is fine. 200-245 words, 55-65 s.
- **Few cuts, a camera that flies.** Average shot 5-20 s (two references are single takes). Build each scene as ONE
  long move with `A.camPath(t, [[time, [pos], [look], fov], ...])` (Catmull-Rom, soft ease) that tracks, swings out to
  reveal and glides back in. Only time or place skips get a transition: `trans: 'dissolve'` (~0.3 s).
- **Bodies never stop.** Run every person through `A.perform(t, seed, k, { talk })` (talk bounce, sway, head tilt,
  breathing, a gesture every 0.8-1.3 s with overshoot) merged with `A.alive()`; add `A.react(type, t, t0)` beats:
  `laugh` (shaking), `angry`, `shock`, `shrug`, `proud`, `sad`, `point`, `cheer`. Animals: `core/critters.js`
  (`Critter` + `drawEmu` with mood, legs stand/walk/run/sit, neck, peck, tilt, bob) keep bobbing and pecking too.
- **Look (v8.2, re-measured on 10 references):** clean round heads, soft grey crescent shade, thick ink, chunky bean
  torsos, emotional face colour. Filmic, NOT washed out: mean value ~0.62, darkest 10% ~0.25, ~12% of pixels in deep
  shade (<0.25), ~18% near-white, saturation ~0.47. Engine default `GRADE_DEFAULT = { sat 0.9, vib 0.12, con 0.24,
  split 0.38, shadow #2E3A78 (indigo shadows), high #FFD9A0, vignette 0.26, lift 0, gain 0.97 }`, and `sunlight()` now
  uses less flat ambient (hemi x0.62, `globalThis.AMBIENT` to change) and a brighter key + rim, so objects get a real dark
  side and cast shadows. The v8 high-key grade (value 0.78, half the frame near-white) is kept as `GRADE_V8` only for
  reference. Measure every film: sheet every 5 s, tiles -> mean value / p10 / dark share / bright share / saturation.
  Rich detail: textured floors (planks, tiles), patterned walls, props on every surface, light pools and window light.
- **No big pop-up text.** Information lives in the world: labelled props, signs, boards, a tally on a wall.
- **Captions v8:** 1-2 words, white Nunito Black ~74 px, thick black edge, soft shadow, at y 1350, almost static (tiny
  0.06 s pop).
- **Music v8:** `"music": "steady"` (default): one original mellow 96 BPM groove (muted bass, e-piano, soft marimba,
  brushes, shaker) that never builds, stops or ducks, ~16 dB under the voice. Whooshes on camera swings (`A.autoSwoosh`).
- **Voice v8.2:** takes are now chosen for liveliness too (flat pitch range is punished: flat = robotic), and the
  final narration gets a clean radio polish (high-pass 75 Hz, -3 dB at 280 Hz, +2.5 dB presence at 3.4 kHz, air shelf,
  gentle 2.6:1 compression); the untouched take is kept as data/narration_raw.wav. `tools/clone_voice.py` (Pocket TTS clone of `~/.faceless-shorts/voice/narrator.wav`) now makes the
  script in ~28-word chunks, picks the best of several takes by Parakeet word check + speaker likeness + pitch, and
  writes `data/narration.wav`, `data/lines.json` and exact word times `data/words.json` itself (no words.py step).
- Keep `FPS=60`, 2-second segments. Sets: `core/outback.js` (`outback(E, { sunset })` wheat farm, road, fence, gum trees,
  army truck with turning gun, `update(t, { truckX })`), v9 LOOK (engine.js): ink lines on every 3D crease (normal threshold 0.25, two radii, pen-weight variation, slight wobble) not only silhouettes; screen-space ambient occlusion from the ink depth (pairs of 1/z samples, no halos) darkens corners and contacts; cut-outs write alpha 0.5 into the normal pass so 3D ink never doubles a character outline; default film depth of field aperture 0.0016 / maxblur 0.009 (reference films blur backgrounds hard). Dress every set: 50-100 small repeated props (stalactites, pebbles, spikes, clutter) — reference frames have ~2x our edge density; but keep the floor around actors clear. `core/graveyard.js` (graveyard(E): dusk churchyard with an open pit, coffin with bell pipe and string, bell posts, lamps; boxingRing(E)), LYING PEOPLE: p.mesh.rotation.x=-PI/2, p.flat=true, after face() set pivot.rotation.y=0 and film them top-down (PIT view [[0.1,3.5+h,1.9+dz],[0,-2.4,0.2],44]) — a side camera in 9:16 cannot see a lying cut-out. ctx overlays (goggles, ring lines, glare) must be drawn AFTER blit(), or the GL frame paints over them. `core/emuwar.js` (waterHole, ammoCrate(label), hayBale,
  newspaper(headline), report(lines), medal, puff smoke, a bright parliament room), plus canyon, tokyo, pinkset, han.
- Crowds: `new Flock(n)` (critters.js) pre-draws run/walk/peck/stand frames once, so 40-120 animals cost almost nothing;
  `flock.bird(i, x, z, { mode, phase, flip })` each frame. Angry faces: `flush: 0..1` (red face) and `steam: 1`.
- The full reference film is `examples/emu-war-shots.js` (62 s, 10 long shots); `examples/emu-sample-shots.js` is the
  10 s sample.

### v8.3 (Nov 6, after measuring 4 more reference Shorts against our own films)
- Measured (mean value / near-white share / warm share / cool share / flat-surface texture): references 0.60-0.67 /
  11-25% / 33-39% / 37-52% / 0.025-0.031; our v8.1 films 0.76-0.79 / 48-53% / 61-72% / 11-16% / 0.009-0.031. So: darker,
  cooler, more textured. The v8.2 grade fixes value; keep sets cool-balanced (blue skies, teal/blue walls and floors,
  indigo shade, warm only for lamps, skin of the sets' key light and accents) - never a mostly-yellow frame.
- Every surface gets painterly grain automatically (engine `GRAIN`, world-space value noise, ?grain=0 to switch off).
- Frame closer: faces fill about a quarter of the frame width in talking beats (shoot() pulls 38-44° cameras 14%
  toward the look point); wides only for reveals.
- Voice: the full-precision Pocket TTS model (int8 was buzzier and less like the narrator: speaker likeness 0.89-0.90
  vs 0.84-0.88, less breathy noise), lively takes preferred, then the clean radio polish.

## 1. Rules
- **People are 2D, the world is 3D.** Every person is a `Toon` cut-out that faces the camera and casts a real shadow.
- **One crew, one look each, all video.** One work hat (`railcap`, `workcap`, `bowler`, `cowboy`, `cap`) + one of:
  beard, mustache, neckerchief (`neck: 'scarf'`). A hair tuft (`hair`) pokes out under the hat.
- **Faces do the acting.** `strain` (> < eyes, gritted teeth) for hard work and danger, `deadpan` for the old hand who
  has seen it all, `content` for lunch, `shock` on the reveal, `laugh` for the payoff. Blink and talk on the beat.
- **Show the drop.** Every few shots, a camera move that reveals how high they are: crane down past the beam to the
  haze, a tilt from boots to the gorge floor, a wide from across the canyon.
- Camera always moves: push-ins along ledges, pans along the beam, crane-downs, orbits, tracking walkers. A new shot
  every 2.5-7 s, and each shot is a little scene where someone does something (see 1e).
- Bright midday sun on red rock; violet haze below; pink sunset for endings and flashbacks.
- **Captions (v6):** rounded heavy white words (Nunito Black, `fonts/Nunito-Black.woff2`, OFL) with a slim dark edge and a
  soft blurred drop shadow, at y 1420 (lower-middle, clear of YouTube's bottom overlay), 1-3 words, springy pop-in.
- **60 fps:** render with `FPS=60` for smoother motion, in 2-second segments (~5 minutes each); budget ~100 minutes of
  rendering per 40 s Short.
- **Camera never still:** `shoot()` adds a slow operator float, a breathing zoom and a whisper of roll to every shot
  (`look.float = 0` turns it off for locked-off frames). Frame closer: head-and-torso most of the time.
- **Contrast & values:** warm light pools (lamps, windows, sunsets) against deep teal-navy shadows; the grade default is
  `con 0.32, split 0.5, shadow #1E4A6E, high #FFC878, vignette 0.32`.
- **Arms:** `A.arm(t, keys)`: elbow follows the shoulder 70 ms later (overlapping action) with a gentle constant sway.
- Old caption rule (kept for reference): 1-3 words at a time ("on the job."), white Inter Black, thick black edge, soft shadow, lower centre
  (y 1340). No colour highlight. Words keep their punctuation; a chunk ends at a comma or full stop.
- Story shape: open on the craziest true fact ("they ate lunch 800 feet up, every day"), then explain the job step by
  step, one picture per clause, short reaction beats, end on a deadpan punchline.
- Narration (v7): THE voice is the user's reference narrator, cloned. `"voice": "clone"`, `"speed": 1.12`, `"gap": 0.04`,
  `"lead": 0.12`, made with the project's `tools/clone_voice.py` (Kyutai Pocket TTS via sherpa-onnx, reference clip
  `~/.faceless-shorts/voice/narrator.wav`, ~190 Hz, ~3.6 words/s, almost no gaps). Each line is made several times and
  the take with every word right (Whisper check) that sounds most like the reference wins. No audio effects on the
  voice. Fallback only if cloning is impossible: tools/voice.py with "am_fenrir:0.4+am_eric:0.4+am_puck:0.2" @1.3.
  The mixer puts the voice at -17.5 dB RMS (`"voice_db"`); mixes land around -11 to -13 LUFS.
- Music: `"bright"` (default: original warm, playful 116 BPM bed: round bass, pizzicato, mallets, whistle-flute motifs,
  soft drums, stereo hall reverb, humanised) ; `"epic"` for battles and grand history, `"dry"` for quiet ones. Never use
  or alter another creator's track (Content ID matches it anyway).
- **Audience: tweens and teens.** Simple words, short punchy sentences, "you" framing ("Imagine you..."), wonder and
  drama. Keep the facts true but light: no full names of obscure people (say "an astronomer", "a scientist"), few dates
  and numbers (one big one at most, said simply: "almost 2,000 years ago"), no jargon (say "earthquake detector", not
  "seismoscope"). Every fact still checked and listed in script.json "sources". Sounds: `whoosh` on cuts, wind on
  height reveals, `clank` / `ding` on steel, `chug` for trains.
- True stories only (railroad crews, bridge and dam builders, lineworkers, old jobs), checked against good sources and
  listed in `script.json` "sources". The look is inspired by a format; never copy another creator's script, shots or frames.

## 1b. Smooth motion (the difference between "cheap" and "pro")
- **Render at 30 fps** (`FPS=30`), never 24. Without a GPU: `SOFTWARE_GL=1 QS='&res=0.6&aa=0&shadow=1024' FPS=30`.
- **The camera never stops.** Drive every move with `drift(k)` from `core/rig.js` (mostly constant speed), not a full
  ease-in-out: an eased move stops dead at each cut and the film feels jerky. Keep the move going the same direction
  across a cut when you can (push-in → push-in, pan right → pan right).
- **Nobody freezes.** Everyone visible gets `bob: idle(seed)` (rig.hang / rig.stand add it for you); walkers walk with
  `phase: t * 7`; people on ropes sway (`swing: Math.sin(t * 1.3) * 0.06`).
- **Poses blend, they don't pop.** When arms change on a word (lifting dynamite, grabbing), blend with
  `tween(fromPose, toPose, t, word, 0.25)`. Mood can switch on the word (cartoon timing), arms glide.
- Shakes are tiny (0.006-0.02) and short (< 0.25 s). Falls use gravity (`-4.9 * s * s`), swings decay (`exp(-t)`).
- QA for smoothness: render 2-3 seconds around each cut as a clip and watch it frame by frame (`ffmpeg -vf
  select='between(t,a,b)'` → contact strip); a move that stops, a pose that jumps, a person who teleports = fix.

## 1d. The finished look (engine v3)
- **Ink on everything.** `core/engine.js` draws dark outlines on every 3D object from depth and normal edges (thinner and
  lighter with distance), and swaps PBR materials for soft cel shading. Cut-out people keep their own ink. Opt out per
  mesh with `userData.noInk` / `noCel`; per frame with `look.style = { ink: false, cel: false }`.
- **Flow, not cuts.** `main.js` cross-dissolves 0.3 s into every shot. Give a shot `cut: true` for a hard cut on an
  impact, or `dissolve: 0.5` for a slower blend. Keep camera moves going through the dissolve.
- **A living picture.** Draw after every shot: `FX.motes(t)` (dust in the light), `FX.shafts(t, { k })` for sun or window
  light, `FX.rain` for storms, `FX.sparkle(x, y, t, k)` on reveals, `FX.sweat(x, y, k)` next to worried faces (use a
  `headXY(person)` helper that projects the head to the screen).
- **Big faces.** Most shots frame one or two people from the chest up; wides are for scale reveals and last 1-2 s.
- Faces change on almost every line (worried, deadpan, shock, smug). Overlays are diegetic when possible: a sign, a
  board, a counter, a blueprint in the world rather than floating text.

## 1e. Animation, not cuts
- Count the action, not the cuts: every shot must contain at least one visible action (walk, climb, descend, pick up,
  set down, sleep, wake, eat, phone, point, count, shrug, cheer) and one camera move.
- Long takes beat many cuts: a 7 s crane down a rope shaft with a live depth counter is better than four 1.7 s stills.
- Things happen on the word: the tent pops up on "tent", the lamp lights on "lamp", an icon is crossed out on "No".
- Time passing = one take with changing poses and a filling tally board, not a montage of cuts.
- Lighting tells the story: a dark cave lit only by a lamp (PointLight intensity ~5, emissive ~1.4; brighter blows out
  the cel shading), a blinding white glare fading as someone steps into daylight.
- The 9:16 frame is narrow, so stage in depth, not side by side: team behind the hero, items along the hero's path,
  the camera tracking. Check the contact sheet (`sheet review/all.jpg 1.0 8` at `res=0.4&ink=0`) for anyone cut off.

## 1f. Acting v4: faces that blend, people who never stop
- **Never snap a face.** Drive moods with `A.face(t, [[t0, 'neutral'], [word, 'shock'], ...])` from `core/act.js` and
  spread the result into `set()`: brows slide with overshoot, eyes squint shut-and-open through the change, the mouth
  shrinks and grows into the new shape, the head squashes/stretches (the "take"). Change a face every 0.5-1.5 s.
- New moods: `excited` (big eyes + wide grin), `gasp` (huge eyes, big O), `skeptic` (one brow up), `scheme` (toothy
  smirk). `tilt` (head tilt deg), `eyeS` / `mouthS` exaggerate.
- **Always alive.** Run every visible person through an `act()` helper that merges `A.alive(t, seed)` (eye darts every
  0.6-1.3 s, blinks, head sway, breathing) under the shot's own state.
- **Poses on the beat.** Arms with `A.keys(t, [[t0, [20, 10]], [word, [150, 30]]])` (springy blend), jumps with
  `A.hop`, hits with `A.jolt`, props and text with `A.pop`.
- **Pace:** about 16 shots in 40 s (1.2-4 s each) and something happens on nearly every word. Transitions: give shots
  `trans: 'zoom'` (punch through) or `trans: 'whip'` (smeared pan) alternately, `cut: true` for impacts.
- **Staging in 9:16:** at fov 40-46 everyone must sit within ±0.21-0.24 × distance of the look point sideways. Stage in
  depth (one in front, others behind), never three people side by side at 2 m.
- **Majestic colour:** the engine grade (vibrance, S-curve, split toning) is on by default. Build every set with a
  cool/warm contrast: warm key light and lanterns against indigo, violet and jade (floors, walls, fog, distant peaks);
  never let one warm colour fill the frame. `HN.majSky` gives 3-stop sunset skies with a glowing sun; `HN.peaks` misty
  mountains. Keep `bloomThreshold` at ~0.92 so white faces don't glow.
- **Make it magnificent:** each film needs at least three "wow" frames: a god-ray reveal of the hero object
  (`FX.godray`), a vast establishing shot (palace / canyon / city under a glowing sky with `HN.peaks` layers and
  `FX.petals` or `FX.orbs` floating), and an impact with `FX.speedLines` + burst + camera jolt. Exaggerate scale (huge
  objects next to tiny people), colour (sunset gold against violet and jade), and reactions (squash & stretch hops via
  `A.squashHop`, eyes x1.3 on gasps). A swoosh sound plays on every camera move (`A.autoSwoosh`).
- Han China kit (`core/han.js`): `court(E, { time })`, `jarHall(E)`, `westLand(E)`, `palace()`, `curvedRoof()`,
  `lantern()`, `banner()`, `plumTree()`, `jar()`; robes `robe: true, sleeves: true, trim`, hats `scholar`, `mian`,
  `official`, `headband`, `extra: ['longmustache', 'goatee']`; `Horse` cut-out in `core/beasts.js`. Example:
  `examples/jar-shots.js`.

## 1c. Format notes (from the reference channel)
- 45-66 s, one true story, told deadpan. Title = the hook in plain words ("Why Perfect Railroads Don't Work",
  "He Caught a Falling Man... From a Rope"); description = one or two sentences + hashtags.
- Real heights and places sell it: show the drop, the haze, the tiny people on the big wall.
- Original scripts and shots only. Never reuse another channel's script, title, characters or frames.

## 2. Palette
| name | hex | use |
|---|---|---|
| sky | `#3F7FE0` → `#BFD9F5` | top of frame |
| rock | `#CC4A2E` (bands `#C2452D` `#D4582F` `#E2703A` `#B8382A`) | cliff layers |
| sand | `#F0A85A` / cream `#F6CF95` | layer lips, ledge tops |
| dust | `#D98A4E` | ledges, track bed |
| haze | `#8E7BD6` | fog + gorge floor (sunset `#9A6AB8`) |
| cactus | `#5E8F4E` | plants |
| iron | `#2A2830` | towers, rails, ink-dark metal |
| ink | `#1F1C33` | outlines |

## 3. Engine map (`example/src/`)
| file | gives you |
|---|---|
| `core/canyon.js` | **sets:** `railLedge(E, { sunset, trainOn })` → `{ scene, sun, train }` (tracks along -z at x -0.6, cliff right at x 7.2, poles x 4.6, lake left); `gorge(E, { sunset, beamLen })` → `{ scene, sun, beam, beamTop, beamFront }` (beam along x at y 0, z 0; towers below; far wall; trestle bridge at y -5, z -24). **pieces:** `cliff({ w, h, y0, ledge, setback, seed })`, `trestleTower(h, w)`, `trestleBridge(len, h)`, `beam(len)`, `cactus(s, 'saguaro'│'pear')`, `rocks(n, area)`, `haze(scene, opts)`, `T.strata(pal, seed)`, `PAL`, `STRATA` |
| `core/rig.js` | **smooth motion:** `drift, idle, tween, wrapShot, clock`. **canyonWall(E, { sunset })** → `{ scene, sun, faceZ(y), rimZ, hang(person, x, feetY, state, swing), stand(person, x, z, state, y), rope(), stretch(mesh, a, b), reset(people) }`: a sheer wall (rim at y 0, ~150 m drop into haze), far wall across, flat rim with rocks and cactus; scalers on bosun seats with ropes to the rim. Wrap every shot with `wrapShot()` so `idle()` moves. |
| `core/toon.js` | `drawToon`, `new Toon(look, { height })` (`.at .set .face .tint .restyle`), `PROPS` |
| `core/world.js` | Tall Tale pieces still available: `sky, clouds, sunlight, pole, wire, lamp, barrel, crate, fence, signBoard, interior(...)` (a site office or bunkhouse) |
| `core/props.js` | `rails(len)`, `train()` (`.update(t)`), `poster(lines)`, `desk()`, `parcel()` |
| `core/captions.js` | 1-3 word chunks, `captionText(text, x, y)` |

**New looks:** `pattern: plaid│jacket` (+ all Tall Tale ones), `straps: col` (suspenders), `belt: col`, `hair: col`,
`hairSide: 1│-1│0`, `extra: ['beard']` + `beardCol`, `hat: railcap│workcap│cowboy` (+ Tall Tale hats), `headShade`.
**New moods:** `strain`, `deadpan`, `content`. **New props:** `PROPS.pail`, `sandwich`, `maul`, `lantern` (+ `cup`, `stack`…).

**Sitting on the beam:** `toon.at(x, beamTop - 0.39, beamFront + 0.03).set({ legs: 'sit' })` (hips on the beam, legs
dangling in front of it). Space crew 1.1 m apart. Standing on the beam: `y = beamTop`.

## 4. Shot anatomy
Same as Tall Tale (`shots.js`): build every set once, give each set its own cut-outs, per shot place people, `set()`
state from `t`, move the camera, `face(cam)` everyone, render with a little depth of field, `blit()`, overlays, cues on
words. Good moves: along the beam at seat height (hero frame: cam `(4.6, 1.0, 3.0)` → look `(-1.2, 0.75, -1.2)`), down
from above the beam to the haze (cam `(-0.3, 2.1, 5.6)` → look `(0, -1.4, -3)`), low on the tracks (cam
`(-1.3, 1.35, 3.4)` → look `(0.7, 1.7, -12)`).

## 5. QA pitfalls
- 9:16 is narrow: the horizontal half-angle at fov 40 is only ~12°. Keep people within that cone or they're cut off.
  Two people 6 m apart need ~14 m of distance; prefer an over-the-shoulder shot (fov 32) for standoffs.
- A hand prop held straight out runs past the 512 px cut-out canvas and gets clipped: use the bent aim pose and a
  separate prop plane on the person's pivot (`armed()` in `examples/quick-draw-shots.js`).
- Keep the far wall's top below the top fifth of the frame so there's sky; a wall filling the frame reads as flat stripes.
- Cut-outs seen from the side become slivers: keep the camera within ~60° of facing them.
- Legs of sitting crew must be in front of the beam (z = beamFront + 0.03) or the beam hides them.
- Shadows only fall inside the sun's shadow box (`box` 12-16 around `target`): move `sun.key.target` to the action.
- An upside-down person (held by the leg): `person.mesh.rotation.z = Math.PI` with the group at the hand point;
  `rig.reset()` puts it back.
- A frame can come out partly black on a few very steep downward camera angles in software rendering: after the
  final render, scan every frame (dark pixel share > 15 % outside the fade = bad) and change that camera move.
- Rendering speed: no GPU → `SOFTWARE_GL=1 QS='&res=0.6&aa=0&shadow=1024' FPS=30` (≈3 s/frame with ink). Render in
  4-second segments (`capture.mjs video part.mp4 start end`, each well under 10 minutes), join them with the ffmpeg
  concat demuxer (`-c:v copy`) and put `data/mix.wav` back on as one track so the audio has no seams.
- Whisper can't download in some sandboxes: words.py then spreads words inside the exact voice line times, which is
  fine for 1-3 word captions.

## 6. Status
`example/` holds the full engine, `core/rig.js` and the style sheet. Its `shots.js` / `script.json` are still the
Tall Tale demo story: a new project replaces both. First published Iron Canyon short: "He Caught a Falling Man...
From a Rope" (Hoover Dam high scalers), built with the canyonWall rig. Then "The Train Track That Bent in the Sun"
(`examples/sun-kink-shots.js`) and "Why the Cowboy Who Draws First Loses" (`examples/quick-draw-shots.js`).
The continuous-animation reference is "He Lost 25 Days in a Cave Without Noticing" (`examples/cave-shots.js`, Michel
Siffre 1962): one-take abseil, camp built item by item, in-shot time-lapse, ringing phone, glare-to-daylight exit.
IC_FILE_EOF
node tools/stylesheet.mjs ../style-sheet.png >/dev/null
echo "Iron Canyon ready: $D"
