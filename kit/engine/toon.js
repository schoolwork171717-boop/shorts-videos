// Toon people: flat 2D cartoon characters (thick ink outlines, big round heads, bean bodies, stick limbs) that live
// inside the 3D world as camera-facing cut-outs with real shadows.
//
//   drawToon(g, look, st)   draws one character into any 2D context, in a 512 x 1024 box (feet at y 1000)
//   new Toon(look, { height })  a 3D cut-out:  .set(st) every frame, .face(camera), .group (position it), .tint(col)
//
// look = { body: '#E8734A', shade?, pattern: 'plain'|'check'|'stripes'|'overalls'|'vest'|'apron', patCol,
//          hat: 'none'|'cap'|'bowler'|'boater'|'beanie'|'visor'|'tophat'|'bun'|'flower', hatCol, band,
//          neck: 'none'|'bowtie'|'tie'|'scarf'|'collar', neckCol, dots,
//          extra: ['mustache','glasses','freckles','blush','pencil','monocle'], head: '#F7F7FA' }
// st   = { mood: 'neutral'|'smug'|'happy'|'laugh'|'shock'|'worried'|'angry'|'sad'|'sly'|'proud'|'tired'|'dizzy'|'strain'|'content'|'deadpan'
//          |'excited'|'gasp'|'skeptic'|'scheme',  from (previous mood) + mk (0..1 into the change) = a smooth blended change,
//          tilt° (head tilt), eyeS / mouthS (exaggerate),
//          look: [dx, dy] (-1..1 pupils), blink 0..1, talk 0..1 (mouth open), sweat, tears,
//          armL / armR: [shoulder°, elbow°]  (0 = hanging down, + = outward/up, elbow + = bends up),
//          legs: 'stand'|'walk'|'run'|'sit'|'jump', phase (walk cycle, radians), lean°, bob (px), squash,
//          holdL / holdR: (g, x, y, angle) => draws a prop in that hand,  flip (mirror left/right) }
import * as THREE from 'three';

export const INK = '#1F1C33';
const LW = 9;
const R2D = Math.PI / 180;

export function shadeOf(hex, k = 0.78) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + ((1 << 24) + (f(r) << 16) + (f(gg) << 8) + f(b)).toString(16).slice(1);
}

// ---------- the drawing ----------
export function drawToon(g, look = {}, st = {}) {
  const L = { body: '#E8734A', head: '#F7F7FA', hat: 'none', neck: 'none', pattern: 'plain', extra: [], ...look };
  const S = { mood: 'neutral', look: [0, 0], blink: 0, talk: 0, armL: [8, 6], armR: [8, 6], legs: 'stand', phase: 0, lean: 0, bob: 0, squash: 0, ...st };
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (S.flip) { g.translate(512, 0); g.scale(-1, 1); }
  // whole-body lean pivots at the feet
  g.translate(256, 1000); g.rotate((S.lean || 0) * R2D); g.translate(-256, -1000);
  const sit = S.legs === 'sit', jump = S.legs === 'jump';
  const by = (sit ? 210 : 0) + (L.kid ? 190 : 0) + (S.bob || 0) + (jump ? -60 : 0);       // how far the upper body drops (kids: short legs)
  const sq = 1 + (S.squash || 0);
  // body box
  const bx = 256, top = 330 + by, bot = 600 + by * 0.98, bw = L.bw ?? 106, sw = L.sw ?? 66;     // v8: a chunkier bean (half width at the hips / shoulders)
  const hipY = bot - 26;

  // ---- legs (behind the body) ----
  g.strokeStyle = INK; g.lineWidth = 15;
  const leg = (sx, side) => {
    let kx, ky, fx, fy;
    if (sit) {                                           // thighs come toward us (short), shins hang down
      const kx2 = sx + side * 30, ky2 = hipY + 44; fx = sx + side * 34; fy = 1000;
      g.beginPath(); g.moveTo(sx, hipY); g.lineTo(kx2, ky2); g.lineTo(fx, fy); g.stroke();
      g.fillStyle = INK; g.beginPath(); g.ellipse(fx + side * 10, fy - 4, 20, 10, 0, 0, Math.PI * 2); g.fill(); return;
    }
    else if (S.legs === 'walk' || S.legs === 'run') {
      const amp = S.legs === 'run' ? 1.0 : 0.55, a = Math.sin(S.phase + (side > 0 ? Math.PI : 0)) * amp;
      const lift = Math.max(0, -Math.cos(S.phase + (side > 0 ? Math.PI : 0))) * (S.legs === 'run' ? 70 : 34);
      kx = sx + a * 22 + side * 6; ky = hipY + 200 - lift * 0.6; fx = sx + a * 34 + side * 8; fy = 1000 - lift;
    } else if (jump) { kx = sx + side * 40; ky = hipY + 170; fx = sx + side * 18; fy = 940; }
    else { kx = sx + side * 4; ky = hipY + 210; fx = sx + side * 10; fy = 1000; }
    g.beginPath(); g.moveTo(sx, hipY); g.quadraticCurveTo(kx, ky, fx, fy); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(fx + side * 10, fy - 4, 20, 10, 0, 0, Math.PI * 2); g.fill();
  };
  leg(bx - 42, -1); leg(bx + 42, 1);

  // ---- body (a bean) ----
  const body = new Path2D();
  body.moveTo(bx - sw, top + 10);
  body.bezierCurveTo(bx - sw - 22, top + 40, bx - bw - 6, bot - 120, bx - bw, bot - 50);
  body.bezierCurveTo(bx - bw + 4, bot + 6, bx + bw - 4, bot + 6, bx + bw, bot - 50);
  body.bezierCurveTo(bx + bw + 6, bot - 120, bx + sw + 22, top + 40, bx + sw, top + 10);
  body.bezierCurveTo(bx + sw * 0.5, top - 8, bx - sw * 0.5, top - 8, bx - sw, top + 10);
  body.closePath();
  g.fillStyle = L.body; g.fill(body);
  g.save(); g.clip(body);
  drawPattern(g, L, bx, top, bot, bw);
  drawStraps(g, L, bx, top, bot, bw);
  g.fillStyle = L.shade || shadeOf(L.body, 0.8); g.globalAlpha = 0.85;
  g.beginPath(); g.ellipse(bx + bw + 40, (top + bot) / 2 + 20, 70, 260, 0, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.25; g.fillStyle = '#FFFFFF'; g.beginPath(); g.ellipse(bx - 50, top + 90, 16, 60, 0.2, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1; g.restore();
  g.strokeStyle = INK; g.lineWidth = LW; g.stroke(body);
  if (L.robe && !sit) {                                        // long robe: a flared skirt down to the ankles, swaying when walking
    const sway = (S.legs === 'walk' || S.legs === 'run') ? Math.sin(S.phase || 0) * 18 : 0, rc = L.robeCol || L.body, hem = 968 + (jump ? -60 : 0);
    const sk = new Path2D(); sk.moveTo(bx - bw + 2, bot - 60); sk.quadraticCurveTo(bx - bw - 30, (bot + hem) / 2, bx - bw - 46 + sway, hem);
    sk.quadraticCurveTo(bx + sway * 0.5, hem + 14, bx + bw + 46 + sway, hem); sk.quadraticCurveTo(bx + bw + 30, (bot + hem) / 2, bx + bw - 2, bot - 60); sk.closePath();
    g.fillStyle = rc; g.fill(sk); g.save(); g.clip(sk); g.fillStyle = shadeOf(rc, 0.78); g.beginPath(); g.ellipse(bx + bw + 30, hem, 70, 330, 0.1, 0, 7); g.fill();
    if (L.trim) { g.fillStyle = L.trim; g.fillRect(bx - 200, hem - 34, 400, 22); } g.restore(); g.stroke(sk);
    g.beginPath(); g.moveTo(bx + sway * 0.4, bot - 40); g.lineTo(bx + sway * 0.8, hem); g.lineWidth = 4; g.stroke(); g.lineWidth = LW;
  }
  if (L.robe) {                                                // crossed collar (right over left)
    g.fillStyle = L.trim || shadeOf(L.body, 0.6); g.beginPath(); g.moveTo(bx - 44, top + 4); g.lineTo(bx + 30, top + 150); g.lineTo(bx + 52, top + 128); g.lineTo(bx - 18, top - 2); g.closePath(); g.fill(); g.lineWidth = 5; g.stroke(); g.lineWidth = LW;
  }
  drawNeckwear(g, L, bx, top);

  // ---- arms (in front of the body) ----
  const hands = {};
  const arm = (side, [a, e], hold) => {
    const sx = bx + side * (sw + 8), sy = top + 46;
    const u = 118, lo = 112;
    const a1 = a * R2D, a2 = (a + e) * R2D;
    let ex = sx + side * Math.sin(a1) * u, ey = sy + Math.cos(a1) * u;
    let hx = ex + side * Math.sin(a2) * lo, hy = ey + Math.cos(a2) * lo;
    // v8.4: never let a hand (or what it holds) leave the 512 px cut-out, or it gets sliced off on screen
    const lim = hold ? [96, 416] : [34, 478];
    if (hx < lim[0] || hx > lim[1] || hy < 30) { const tx = Math.min(lim[1], Math.max(lim[0], hx)), k = Math.max(0.35, Math.min(1, (tx - sx) / ((hx - sx) || 1), hy < 30 ? (sy - 30) / ((sy - hy) || 1) : 1));
      ex = sx + (ex - sx) * k; ey = sy + (ey - sy) * k; hx = sx + (hx - sx) * k; hy = sy + (hy - sy) * k; }
    g.strokeStyle = INK; g.lineWidth = 14;
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(ex, ey, hx, hy); g.stroke();
    if (L.sleeves) {                                            // wide robe sleeve that flares toward the wrist
      const cx = ex * 0.8 + hx * 0.2, cy = ey * 0.8 + hy * 0.2, wx = sx + (hx - sx) * 0.86, wy = sy + (hy - sy) * 0.86;
      const nx = -(wy - sy), ny = wx - sx, nl = Math.hypot(nx, ny) || 1, ux = nx / nl, uy = ny / nl;
      const sl = new Path2D(); sl.moveTo(sx - ux * 22, sy - uy * 22); sl.quadraticCurveTo(cx - ux * 30, cy - uy * 30, wx - ux * 44, wy - uy * 44);
      sl.quadraticCurveTo(wx + (wx - cx) * 0.25, wy + (wy - cy) * 0.25 + 20, wx + ux * 44, wy + uy * 44); sl.quadraticCurveTo(cx + ux * 30, cy + uy * 30, sx + ux * 22, sy + uy * 22); sl.closePath();
      g.fillStyle = L.sleeveCol || L.body; g.fill(sl); g.lineWidth = 7; g.stroke(sl); if (L.trim) { g.strokeStyle = L.trim; g.lineWidth = 9; g.beginPath(); g.moveTo(wx - ux * 40, wy - uy * 40); g.lineTo(wx + ux * 40, wy + uy * 40); g.stroke(); g.strokeStyle = INK; }
      g.lineWidth = 14;
    }
    if (hold) { g.save(); hold(g, hx, hy, side * (a + e) * R2D, side); g.restore(); }
    if (L.gloves) { g.fillStyle = L.gloves === true ? '#FFFFFF' : L.gloves; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(hx, hy, 21, 23, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.lineWidth = 14; } else { g.fillStyle = INK; g.beginPath(); g.ellipse(hx, hy, 15, 17, 0, 0, Math.PI * 2); g.fill(); }
    hands[side < 0 ? 'L' : 'R'] = [hx, hy];
  };
  arm(-1, S.armL, S.holdL); arm(1, S.armR, S.holdR);

  // ---- head ----
  const hx = 256, hy = 178 + by * 0.99, r = 138;
  const mk = S.mk ?? 1, mixing = !!S.from && S.from !== S.mood && mk < 1, take = mixing ? Math.sin(Math.PI * mk) : 0;
  const pop = BIG.has(S.mood);                                  // surprise-type faces stretch up, calm ones settle down
  const tsx = 1 + (pop ? -0.07 : 0.05) * take, tsy = 1 + (pop ? 0.11 : -0.05) * take;
  g.save(); g.translate(hx, hy + r * 0.85); g.rotate((S.tilt || 0) * R2D); g.translate(-hx, -(hy + r * 0.85));
  g.translate(hx, hy + r * 0.6); g.scale(tsx, tsy); g.translate(-hx, -(hy + r * 0.6));
  g.translate(hx, hy); g.scale(1 + (S.squash || 0) * -0.3, sq); g.translate(-hx, -hy);
  if (L.hat === 'bun') { g.fillStyle = L.hatCol || '#6B4A3A'; g.beginPath(); g.arc(hx + 10, hy - r - 8, 46, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke(); }
  const head = new Path2D(); head.ellipse(hx, hy, r, r * 0.97, 0, 0, Math.PI * 2);
  g.fillStyle = L.head; g.fill(head);
  g.save(); g.clip(head);
  if (S.flush) { g.globalAlpha = Math.min(1, S.flush) * 0.85; const fg = g.createLinearGradient(0, hy - r, 0, hy + r);   // v8: angry red / sick green face, rising from the chin
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(0.35, S.flushCol || '#F0604E'); fg.addColorStop(1, S.flushCol || '#E0483C'); g.fillStyle = fg; g.fill(head); g.globalAlpha = 1; }
  // crescent shade on the lower right + light pencil hatching inside it (the hand-inked look)
  const cres = new Path2D(); cres.arc(hx + 40, hy + 34, r * 1.02, 0, Math.PI * 2); cres.rect(hx - 400, hy - 400, 800, 800);
  g.fillStyle = L.headShade || '#DCDCE4'; g.fill(cres, 'evenodd');
  if (L.hatch) { g.save(); g.clip(cres, 'evenodd'); g.strokeStyle = INK; g.globalAlpha = 0.13; g.lineWidth = 3;     // old v3-v7 pencil hatching (off in v8: clean soft shade like the references)
    for (let k = -r * 2; k < r * 2; k += 15) { g.beginPath(); g.moveTo(hx + k, hy + r); g.lineTo(hx + k + r * 0.55, hy - r * 0.2); g.stroke(); }
    g.restore(); }
  g.restore();
  g.strokeStyle = INK; g.lineWidth = LW + 1; g.stroke(head);
  if (S.steam) { const k = Math.min(1, S.steam), ph = S.steamT || 0;                                                   // v8: steam puffs from both sides of the head
    [-1, 1].forEach((sd) => { for (let j = 0; j < 3; j++) { const u = ((ph * 1.6 + j / 3) % 1), px = hx + sd * (r + 10 + u * 70), py = hy - 10 - u * 120, pr = (18 + u * 26) * k;
      g.globalAlpha = (1 - u) * k; g.fillStyle = '#FFFFFF'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill(); g.stroke(); } }); g.globalAlpha = 1; }
  if (L.hair) drawHair(g, L, hx, hy, r);
  drawFace(g, L, S, hx, hy);
  if (L.extra.includes('beard')) drawBeard(g, L, S, hx, hy, r);
  drawHat(g, L, hx, hy, r);
  g.restore();
  g.restore();
  g.restore();
  return hands;
}

function drawPattern(g, L, bx, top, bot, bw) {
  const pc = L.patCol || shadeOf(L.body, 0.7);
  if (L.pattern === 'check') {
    g.strokeStyle = pc; g.globalAlpha = 0.55; g.lineWidth = 6;
    for (let x = bx - 120; x < bx + 120; x += 34) { g.beginPath(); g.moveTo(x, top - 20); g.lineTo(x, bot + 20); g.stroke(); }
    for (let y = top; y < bot + 20; y += 34) { g.beginPath(); g.moveTo(bx - 130, y); g.lineTo(bx + 130, y); g.stroke(); }
    g.lineWidth = 2; g.globalAlpha = 0.5; g.strokeStyle = L.patCol2 || '#B5372E';
    for (let x = bx - 103; x < bx + 120; x += 68) { g.beginPath(); g.moveTo(x, top - 20); g.lineTo(x, bot + 20); g.stroke(); }
    g.globalAlpha = 1;
  } else if (L.pattern === 'stripes') {
    g.fillStyle = pc; for (let x = bx - 130; x < bx + 130; x += 36) g.fillRect(x, top - 20, 14, bot - top + 40);
  } else if (L.pattern === 'overalls') {
    g.fillStyle = L.patCol || '#3E5FA8';
    g.beginPath(); g.roundRect(bx - 62, top + 110, 124, 110, 14); g.fill(); g.fillRect(bx - 130, top + 190, 260, 200);
    g.strokeStyle = shadeOf(g.fillStyle, 0.75); g.lineWidth = 4; g.setLineDash([8, 7]); g.strokeRect(bx - 48, top + 124, 96, 80); g.setLineDash([]);
    g.fillStyle = L.patCol || '#3E5FA8'; g.fillRect(bx - 58, top, 16, 120); g.fillRect(bx + 42, top, 16, 120);
    g.fillStyle = '#F1C24B'; [[-50, 118], [50, 118]].forEach(([dx, dy]) => { g.beginPath(); g.arc(bx + dx, top + dy, 8, 0, 7); g.fill(); });
  } else if (L.pattern === 'vest') {
    g.fillStyle = L.patCol || '#3B3346';
    g.beginPath(); g.moveTo(bx - 140, top - 10); g.lineTo(bx - 8, top + 120); g.lineTo(bx - 8, bot + 20); g.lineTo(bx - 140, bot + 20); g.fill();
    g.beginPath(); g.moveTo(bx + 140, top - 10); g.lineTo(bx + 8, top + 120); g.lineTo(bx + 8, bot + 20); g.lineTo(bx + 140, bot + 20); g.fill();
    g.fillStyle = '#E9C46A'; [150, 195, 240].forEach((dy) => { g.beginPath(); g.arc(bx + 26, top + dy, 6, 0, 7); g.fill(); });
  } else if (L.pattern === 'stamps' || L.stamps) {
    const n = L.stamps ?? 6; const spots = [[-50, 70, -0.2], [30, 60, 0.15], [-10, 140, 0.05], [50, 150, -0.12], [-60, 180, 0.18], [10, 215, -0.1], [-30, 100, 0.3], [60, 105, 0.08], [20, 175, 0.25], [-45, 240, -0.05]];
    spots.slice(0, n).forEach(([dx, dy, r], i) => { g.save(); g.translate(bx + dx, top + dy); g.rotate(r); const cols = ['#D8343F', '#3C6FB6', '#2E8A5A', '#E2B33C', '#8C6FC9']; g.fillStyle = '#FFFDF4'; g.strokeStyle = INK; g.lineWidth = 3;
      g.beginPath(); g.rect(-22, -27, 44, 54); g.fill(); g.stroke(); g.fillStyle = cols[i % 5]; g.fillRect(-15, -20, 30, 32); g.fillStyle = '#FFFDF4'; g.font = '900 13px Inter'; g.textAlign = 'center'; g.fillText(i % 2 ? '5¢' : '2¢', 0, 22);
      g.beginPath(); g.arc(0, -6, 8, 0, 7); g.fill(); g.restore(); });
  } else if (L.pattern === 'plaid') {                       // flannel work shirt: bold bands + thin light lines
    const dk = L.patCol || '#3A1F28', lt = L.patCol2 || '#F2E6CF';
    g.fillStyle = dk; g.globalAlpha = 0.55;
    for (let x = bx - 130; x < bx + 130; x += 46) g.fillRect(x, top - 20, 18, bot - top + 40);
    for (let y = top + 6; y < bot + 20; y += 46) g.fillRect(bx - 130, y, 260, 18);
    g.globalAlpha = 0.6; g.strokeStyle = lt; g.lineWidth = 2.5;
    for (let x = bx - 112; x < bx + 130; x += 46) { g.beginPath(); g.moveTo(x + 14, top - 20); g.lineTo(x + 14, bot + 20); g.stroke(); }
    for (let y = top + 24; y < bot + 20; y += 46) { g.beginPath(); g.moveTo(bx - 130, y + 12); g.lineTo(bx + 130, y + 12); g.stroke(); }
    g.globalAlpha = 1; g.strokeStyle = INK; g.lineWidth = 4; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(bx, top + 20); g.lineTo(bx, bot); g.stroke(); g.setLineDash([]);
  } else if (L.pattern === 'jacket') {                      // work jacket: centre seam, buttons, two flap pockets
    const dk = L.patCol || shadeOf(L.body, 0.72);
    g.strokeStyle = dk; g.lineWidth = 5; g.beginPath(); g.moveTo(bx, top + 30); g.lineTo(bx, bot); g.stroke();
    g.fillStyle = INK; [100, 150, 200].forEach((dy) => { g.beginPath(); g.arc(bx + 12, top + dy, 6, 0, 7); g.fill(); });
    [-1, 1].forEach((s) => { const px = bx + s * 48; g.strokeStyle = INK; g.lineWidth = 4; g.fillStyle = dk;
      g.beginPath(); g.rect(px - 26, top + 78, 52, 44); g.stroke(); g.beginPath(); g.rect(px - 28, top + 70, 56, 16); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.arc(px, top + 80, 4, 0, 7); g.fill(); });
  } else if (L.pattern === 'apron') {
    g.fillStyle = L.patCol || '#F4EFE4'; g.beginPath(); g.roundRect(bx - 70, top + 90, 140, bot - top, 18); g.fill();
    g.strokeStyle = shadeOf(L.patCol || '#F4EFE4', 0.8); g.lineWidth = 4; g.beginPath(); g.roundRect(bx - 40, top + 190, 80, 60, 8); g.stroke();
  }
}

// suspenders (straps: colour) and a belt with a brass buckle (belt: colour)
function drawStraps(g, L, bx, top, bot) {
  if (L.straps) {
    g.fillStyle = L.straps; g.strokeStyle = INK; g.lineWidth = 4;
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(bx + s * 44, top - 10); g.lineTo(bx + s * 62, top - 10); g.lineTo(bx + s * 50, bot); g.lineTo(bx + s * 32, bot); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#E2B33C'; g.beginPath(); g.roundRect(bx + s * 41 - 9, top + 120, 18, 14, 3); g.fill(); g.stroke(); g.fillStyle = L.straps; });
  }
  if (L.belt) {
    const y = bot - 92; g.fillStyle = L.belt; g.strokeStyle = INK; g.lineWidth = 4;
    g.fillRect(bx - 140, y, 280, 26); g.beginPath(); g.moveTo(bx - 140, y); g.lineTo(bx + 140, y); g.moveTo(bx - 140, y + 26); g.lineTo(bx + 140, y + 26); g.stroke();
    g.fillStyle = '#E2B33C'; g.beginPath(); g.roundRect(bx - 20, y - 4, 40, 34, 4); g.fill(); g.stroke(); g.fillStyle = L.belt; g.fillRect(bx - 9, y + 6, 18, 14);
  }
}

// a tuft of hair poking out under the hat on one side (hair: colour, hairSide: 1 right | -1 left | 0 both)
function drawHair(g, L, hx, hy, r) {
  const sides = L.hairSide === 0 ? [-1, 1] : [L.hairSide || 1];
  sides.forEach((s) => {
    const p = new Path2D();
    p.moveTo(hx + s * r * 0.1, hy - r * 0.8);
    p.bezierCurveTo(hx + s * r * 0.8, hy - r * 0.98, hx + s * r * 1.12, hy - r * 0.5, hx + s * r * 1.0, hy + r * 0.12);
    p.bezierCurveTo(hx + s * r * 0.92, hy + r * 0.0, hx + s * r * 0.86, hy - r * 0.28, hx + s * r * 0.74, hy - r * 0.2);
    p.bezierCurveTo(hx + s * r * 0.7, hy - r * 0.42, hx + s * r * 0.4, hy - r * 0.5, hx + s * r * 0.1, hy - r * 0.8);
    g.fillStyle = L.hair; g.fill(p);
    g.save(); g.clip(p); g.strokeStyle = shadeOf(L.hair, 0.7); g.lineWidth = 3; g.globalAlpha = 0.8;
    for (let k = 0; k < 9; k++) { const x = hx + s * r * (0.45 + k * 0.07); g.beginPath(); g.moveTo(x, hy - r * 0.8); g.quadraticCurveTo(x + s * 10, hy - r * 0.4, x + s * 4, hy); g.stroke(); }
    g.restore(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(p);
  });
}

// a big bushy beard below the mouth, inked with short strokes (beardCol)
function drawBeard(g, L, S, hx, hy, r) {
  const c = L.beardCol || '#BFC0C6', my = hy + 66, p = new Path2D();
  p.moveTo(hx - r * 0.95, hy + 4);
  p.bezierCurveTo(hx - r * 1.02, hy + r * 0.9, hx - r * 0.6, hy + r * 1.45, hx, hy + r * 1.6);
  p.bezierCurveTo(hx + r * 0.6, hy + r * 1.45, hx + r * 1.02, hy + r * 0.9, hx + r * 0.95, hy + 4);
  p.bezierCurveTo(hx + r * 0.7, my + 6, hx + 50, my + 10, hx + 30, my + 26);
  p.quadraticCurveTo(hx, my + 40, hx - 30, my + 26);
  p.bezierCurveTo(hx - 50, my + 10, hx - r * 0.7, my + 6, hx - r * 0.95, hy + 4);
  p.closePath();
  g.fillStyle = c; g.fill(p);
  g.save(); g.clip(p);
  g.fillStyle = shadeOf(c, 0.8); g.beginPath(); g.ellipse(hx + r * 0.55, hy + r * 1.0, r * 0.6, r * 0.9, -0.3, 0, 7); g.fill();
  g.strokeStyle = shadeOf(c, 0.55); g.lineWidth = 3;
  for (let i = 0; i < 70; i++) { const u = rnd2(i) * 2 - 1, v = rnd2(i * 3.1); const x = hx + u * r * 0.9, y = my + 20 + v * r * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + u * 6, y + 18); g.stroke(); }
  g.restore(); g.strokeStyle = INK; g.lineWidth = 6; g.stroke(p);
  if (S.talk > 0.05 || S.mood === 'laugh' || S.mood === 'shock') { g.fillStyle = '#3A1A2A'; g.beginPath(); g.ellipse(hx, my + 22, 18, 8 + (S.talk || 0.5) * 10, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); }
}
const rnd2 = (i) => { const x = Math.sin(i * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };

function drawNeckwear(g, L, bx, top) {
  const c = L.neckCol || '#D8343F';
  g.strokeStyle = INK; g.lineWidth = 6;
  if (L.neck === 'bowtie') {
    const y = top + 24, bt = new Path2D();
    bt.moveTo(bx, y); bt.bezierCurveTo(bx - 30, y - 30, bx - 64, y - 26, bx - 62, y); bt.bezierCurveTo(bx - 64, y + 26, bx - 30, y + 30, bx, y);
    bt.bezierCurveTo(bx + 30, y - 30, bx + 64, y - 26, bx + 62, y); bt.bezierCurveTo(bx + 64, y + 26, bx + 30, y + 30, bx, y);
    g.fillStyle = c; g.fill(bt);
    if (L.dots) { g.save(); g.clip(bt); g.fillStyle = '#FFFFFF'; for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) { g.beginPath(); g.arc(bx + i * 18 + (j & 1) * 9, y + j * 15, 4.5, 0, 7); g.fill(); } g.restore(); }
    g.stroke(bt); g.fillStyle = shadeOf(c, 0.75); g.beginPath(); g.roundRect(bx - 13, y - 13, 26, 26, 6); g.fill(); g.stroke();
  } else if (L.neck === 'tie') {
    g.fillStyle = c; g.beginPath(); g.moveTo(bx - 14, top + 10); g.lineTo(bx + 14, top + 10); g.lineTo(bx + 20, top + 140); g.lineTo(bx, top + 170); g.lineTo(bx - 20, top + 140); g.closePath(); g.fill(); g.stroke();
  } else if (L.neck === 'scarf') {
    g.fillStyle = c; g.beginPath(); g.moveTo(bx + 20, top + 20); g.lineTo(bx + 58, top + 130); g.lineTo(bx + 24, top + 138); g.lineTo(bx + 6, top + 26); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(bx - 70, top + 4); g.quadraticCurveTo(bx, top + 44, bx + 70, top + 4); g.lineTo(bx + 66, top + 34); g.quadraticCurveTo(bx, top + 76, bx - 66, top + 34); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = shadeOf(c, 0.75); g.lineWidth = 4; g.beginPath(); g.moveTo(bx - 50, top + 26); g.quadraticCurveTo(bx, top + 56, bx + 50, top + 26); g.stroke();
  } else if (L.neck === 'collar') {
    g.fillStyle = '#FFFFFF';
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(bx, top + 18); g.lineTo(bx + s * 56, top + 2); g.lineTo(bx + s * 40, top + 46); g.closePath(); g.fill(); g.stroke(); });
  }
}

function eye(g, x, y, S, side, L) {
  const [lx, ly] = S.look; const m = S.mood; const bl = S.blink || 0;
  g.fillStyle = INK; g.strokeStyle = INK;
  if (m === 'strain') {                                   // squeezed shut: > <
    g.lineWidth = 9; const d = side < 0 ? 1 : -1; g.beginPath(); g.moveTo(x - d * 18, y - 16); g.lineTo(x + d * 14, y); g.lineTo(x - d * 18, y + 14); g.stroke(); return;
  }
  if (m === 'content') { g.lineWidth = 9; g.beginPath(); g.arc(x, y + 8, 18, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return; }
  if (m === 'happy' || m === 'laugh' || (m === 'proud' && side > 0 && false)) {
    g.lineWidth = 10; g.beginPath(); g.arc(x, y + 10, 20, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); return;
  }
  if (m === 'dizzy') { g.lineWidth = 6; g.beginPath(); for (let a = 0; a < 12; a += 0.3) { const rr = a * 1.6; g.lineTo(x + Math.cos(a * side) * rr, y + Math.sin(a * side) * rr); } g.stroke(); return; }
  if (m === 'angry' && false) return;
  if (m === 'shock') {
    g.fillStyle = '#FFFFFF'; g.lineWidth = 6; g.beginPath(); g.ellipse(x, y, 26, 30, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(x + lx * 8, y + ly * 8, 7, 0, 7); g.fill(); return;
  }
  if (bl > 0.6) { g.lineWidth = 8; g.beginPath(); g.moveTo(x - 14, y + 4); g.quadraticCurveTo(x, y + 10, x + 14, y + 4); g.stroke(); return; }
  // pupil
  const px = x + lx * 9, py = y + ly * 8;
  g.beginPath(); g.ellipse(px, py, 13, 17 * (1 - bl * 0.6), 0, 0, 7); g.fill();
  if (m === 'smug' || m === 'tired' || m === 'sly' || m === 'proud' || m === 'deadpan') {           // heavy lid over the top half
    g.fillStyle = L.head; g.fillRect(x - 24, y - 28, 48, 26 + (m === 'tired' ? 6 : 0));
    g.lineWidth = 7; g.beginPath(); g.moveTo(x - 20, y - 2 + (m === 'tired' ? 6 : 0)); g.lineTo(x + 20, y - 2 + (m === 'tired' ? 6 : 0)); g.stroke();
  }
  if (m === 'sad' || m === 'worried') { g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(px - 3, py - 5, 3.5, 0, 7); g.fill(); }
}

const BIG = new Set(['shock', 'laugh', 'happy', 'angry', 'proud', 'excited', 'gasp']);
const BROW = { neutral: [4, 0], smug: [-8, 10], happy: [8, 0], laugh: [10, 0], shock: [26, 0], worried: [10, -16], angry: [-12, 24],
  sad: [8, -18], sly: [-6, 12], proud: [6, 4], tired: [-2, 0], dizzy: [14, 0], strain: [-8, 20], content: [6, -2], deadpan: [-6, 0],
  excited: [18, -4], gasp: [22, -6], skeptic: [-4, 8], scheme: [-10, 18] };
const EYES = { shock: 1.3, gasp: 1.22, excited: 1.12, worried: 1.08, angry: 0.94, scheme: 0.95 };
const browFor = (m, s) => (((m === 'smug' || m === 'sly' || m === 'skeptic') && s > 0) ? [18, -4] : (BROW[m] || [4, 0]));
const lerpA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const backOut = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

// The face. A mood change is never a snap: give st.from (previous mood) and st.mk (0..1, how far into the change,
// use act.face(t, keys) to get both). Brows slide with a little overshoot, the eyes squint shut-and-open through the
// change, the mouth shrinks and grows into the new shape, and drawToon squashes/stretches the head ("the take").
function drawFace(g, L, S, hx, hy) {
  const m = S.mood, ex = 46, ey = hy + 4, mk = S.mk ?? 1, from = S.from || m, mixing = from !== m && mk < 1;
  const kb = mixing ? backOut(mk) : 1, half = mixing ? Math.sin(Math.PI * mk) : 0;
  const mEye = mixing && mk < 0.5 ? from : m, mMouth = mixing && mk < 0.45 ? from : m;
  // eyebrows
  g.strokeStyle = INK; g.lineWidth = 12;
  [-1, 1].forEach((s) => {
    const [lift, tl] = lerpA(browFor(from, s), browFor(m, s), kb), tilt = tl * s;
    const y = ey - 44 - lift;
    g.beginPath(); g.moveTo(hx + s * (ex - 26), y + tilt * 0.5); g.quadraticCurveTo(hx + s * ex, y - 7, hx + s * (ex + 26), y - tilt * 0.5);
    g.stroke();
  });
  const es = ((EYES[from] || 1) + ((EYES[m] || 1) - (EYES[from] || 1)) * kb) * (S.eyeS || 1), squint = 1 - 0.82 * half;
  const SE = { ...S, mood: mEye === 'excited' || mEye === 'gasp' ? 'shock' : mEye === 'skeptic' ? 'smug' : mEye === 'scheme' ? 'sly' : mEye };
  [-1, 1].forEach((s) => { const x = hx + s * ex; g.save(); g.translate(x, ey); g.scale(es, es * squint); g.translate(-x, -ey); eye(g, x, ey, SE, s, L); g.restore(); });
  if (L.extra.includes('glasses')) { g.strokeStyle = INK; g.lineWidth = 5; [-1, 1].forEach((s) => { g.beginPath(); g.arc(hx + s * ex, ey, 30, 0, 7); g.stroke(); }); g.beginPath(); g.moveTo(hx - 16, ey - 4); g.lineTo(hx + 16, ey - 4); g.stroke(); }
  if (L.extra.includes('monocle')) { g.strokeStyle = '#C9A13B'; g.lineWidth = 5; g.beginPath(); g.arc(hx + ex, ey, 30, 0, 7); g.stroke(); g.beginPath(); g.moveTo(hx + ex + 22, ey + 22); g.quadraticCurveTo(hx + ex + 40, ey + 90, hx + ex + 10, ey + 140); g.stroke(); }
  const blushK = Math.max(L.extra.includes('blush') ? 1 : 0, ['laugh', 'proud', 'excited'].includes(m) ? kb : 0, ['laugh', 'proud', 'excited'].includes(from) && mixing ? 1 - mk : 0);
  if (blushK > 0.02) { g.fillStyle = `rgba(240,110,125,${0.4 * Math.min(1, blushK)})`; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(hx + s * 78, ey + 40, 24, 13, 0, 0, 7); g.fill(); }); }
  if (L.extra.includes('freckles')) { g.fillStyle = '#C98A64'; [-1, 1].forEach((s) => [[0, 0], [12, 8], [-10, 10]].forEach(([dx, dy]) => { g.beginPath(); g.arc(hx + s * (74 + dx), ey + 36 + dy, 3.5, 0, 7); g.fill(); })); }
  // mouth: shrink out of the old shape, grow into the new one
  const my = ey + 62, ms = (mixing ? 0.3 + 0.7 * Math.abs(Math.cos(Math.PI * mk)) : 1) * (S.mouthS || 1);
  g.save(); g.translate(hx, my + 8); g.scale(ms, ms); g.translate(-hx, -(my + 8)); mouth(g, L, mMouth, S.talk || 0, hx, my); g.restore();
  if (L.extra.includes('mustache')) {
    g.fillStyle = L.mustacheCol || '#3A2A22'; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(hx, my - 18); g.bezierCurveTo(hx - 20, my - 32, hx - 60, my - 22, hx - 64, my - 2); g.bezierCurveTo(hx - 44, my - 8, hx - 20, my - 4, hx, my - 10);
    g.bezierCurveTo(hx + 20, my - 4, hx + 44, my - 8, hx + 64, my - 2); g.bezierCurveTo(hx + 60, my - 22, hx + 20, my - 32, hx, my - 18); g.fill(); g.stroke();
  }
  if (L.extra.includes('longmustache')) {                              // thin drooping mustache ends (scholars, officials)
    g.strokeStyle = L.mustacheCol || '#2A2028'; g.lineWidth = 6;
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(hx + s * 8, my - 10); g.quadraticCurveTo(hx + s * 46, my - 14, hx + s * 52, my + 30 + half * 6); g.stroke(); });
  }
  if (L.extra.includes('goatee')) { g.fillStyle = L.mustacheCol || '#2A2028'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(hx - 12, my + 30); g.quadraticCurveTo(hx, my + 92, hx + 4, my + 100); g.quadraticCurveTo(hx + 10, my + 70, hx + 12, my + 30); g.closePath(); g.fill(); g.stroke(); }
  if (L.extra.includes('pencil')) { g.save(); g.translate(hx + 132, hy - 50); g.rotate(-0.5); g.fillStyle = '#F2C230'; g.fillRect(-8, -60, 16, 120); g.fillStyle = '#E58A9A'; g.fillRect(-8, -70, 16, 14); g.strokeStyle = INK; g.lineWidth = 4; g.strokeRect(-8, -70, 16, 130); g.restore(); }
  const sw = S.sweat ?? (m === 'worried' ? kb : from === 'worried' && mixing ? 1 - mk : 0);
  if (sw > 0.02) { const k = Math.min(1, sw); g.globalAlpha = k; g.fillStyle = '#8FD3F4'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); const sx = hx + 104, sy = hy - 70 + (1 - k) * -10; g.moveTo(sx, sy - 26); g.quadraticCurveTo(sx + 18, sy, sx, sy + 12); g.quadraticCurveTo(sx - 18, sy, sx, sy - 26); g.fill(); g.stroke(); g.globalAlpha = 1; }
  if (S.tears || m === 'sad') { g.fillStyle = '#8FD3F4'; [-1, 1].forEach((s) => { g.beginPath(); g.ellipse(hx + s * (ex + 6), ey + 40, 7, 14, 0, 0, 7); g.fill(); }); }
}

function mouth(g, L, m, t, hx, my) {
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 8;
  const openMouth = (w, h, tongue = true) => {
    g.beginPath(); g.ellipse(hx, my + h * 0.3, w, Math.max(4, h), 0, 0, 7); g.fillStyle = '#3A1A2A'; g.fill(); g.stroke();
    if (tongue && h > 12) { g.save(); g.clip(); g.fillStyle = '#E2697A'; g.beginPath(); g.ellipse(hx, my + h * 1.1, w * 0.7, h * 0.6, 0, 0, 7); g.fill(); g.restore(); }
  };
  const grin = (w, h) => { g.beginPath(); g.moveTo(hx - w, my - 6); g.quadraticCurveTo(hx, my - 2, hx + w, my - 6); g.quadraticCurveTo(hx + w * 0.85, my + h, hx, my + h); g.quadraticCurveTo(hx - w * 0.85, my + h, hx - w, my - 6); g.closePath(); g.fillStyle = '#3A1A2A'; g.fill(); g.save(); g.clip(); g.fillStyle = '#E2697A'; g.beginPath(); g.ellipse(hx, my + h, w * 0.6, h * 0.35, 0, 0, 7); g.fill(); g.fillStyle = '#FFFFFF'; g.fillRect(hx - w, my - 10, w * 2, 12); g.restore(); g.stroke(); };
  if (m === 'strain' || m === 'scheme') {                       // gritted teeth (scheme: a wide toothy smirk)
    const w = m === 'scheme' ? 40 : 30, dy = m === 'scheme' ? -4 : 0;
    g.fillStyle = '#FFFFFF'; g.lineWidth = 6; g.beginPath(); g.roundRect(hx - w, my - 8 + dy, w * 2, 30, 12); g.fill(); g.stroke();
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(hx - w, my + 7 + dy); g.lineTo(hx + w, my + 7 + dy); [-0.5, 0, 0.5].forEach((f) => { g.moveTo(hx + f * w, my - 8 + dy); g.lineTo(hx + f * w, my + 22 + dy); }); g.stroke();
  }
  else if (m === 'deadpan' && t <= 0.05) { g.lineWidth = 6; g.beginPath(); g.ellipse(hx, my + 6, 8, 9, 0, 0, 7); g.stroke(); }
  else if (m === 'content' && t <= 0.05) { g.beginPath(); g.moveTo(hx - 14, my + 4); g.quadraticCurveTo(hx, my + 10, hx + 14, my + 4); g.stroke(); }
  else if (m === 'shock') openMouth(16, 20 + t * 6);
  else if (m === 'gasp') openMouth(24, 30 + t * 6);
  else if (m === 'laugh') grin(40, 52);
  else if (m === 'excited') grin(44, 44 + t * 10);
  else if (t > 0.05) openMouth(14 + t * 10, 6 + t * 18);
  else if (m === 'happy' || m === 'proud') { g.beginPath(); g.moveTo(hx - 28, my); g.quadraticCurveTo(hx, my + 26, hx + 28, my); g.stroke(); }
  else if (m === 'smug' || m === 'sly' || m === 'skeptic') { g.beginPath(); g.moveTo(hx - 22, my + 6); g.quadraticCurveTo(hx + 4, my + 16, hx + 24, my - 4); g.stroke(); }
  else if (m === 'worried') { g.beginPath(); g.moveTo(hx - 26, my + 8); g.bezierCurveTo(hx - 12, my - 4, hx + 8, my + 14, hx + 26, my + 2); g.stroke(); }
  else if (m === 'angry') { g.beginPath(); g.moveTo(hx - 30, my + 12); g.quadraticCurveTo(hx, my - 8, hx + 30, my + 12); g.stroke(); g.lineWidth = 5; g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(hx - 24, my - 2, 48, 14, 6); g.fill(); g.stroke(); }
  else if (m === 'sad') { g.beginPath(); g.moveTo(hx - 24, my + 12); g.quadraticCurveTo(hx, my - 4, hx + 24, my + 12); g.stroke(); }
  else if (m === 'tired' || m === 'dizzy') { g.beginPath(); g.moveTo(hx - 18, my + 6); g.lineTo(hx + 18, my + 6); g.stroke(); }
  else { g.beginPath(); g.moveTo(hx - 20, my + 2); g.quadraticCurveTo(hx, my + 14, hx + 20, my + 2); g.stroke(); }
}

function drawHat(g, L, hx, hy, r) {
  const c = L.hatCol || '#7A5236', top = hy - r * 0.97;
  g.strokeStyle = INK; g.lineWidth = LW; g.fillStyle = c;
  const band = (y, w, col) => { g.fillStyle = col; g.fillRect(hx - w, y - 12, w * 2, 24); g.strokeRect(hx - w, y - 12, w * 2, 24); };
  if (L.hat === 'scholar') {                              // Han scholar's black cap: a hair-bun cover with a tall slanted front
    g.fillStyle = c; g.beginPath(); g.moveTo(hx - r * 0.78, top + 40); g.quadraticCurveTo(hx - r * 0.8, top - 10, hx - r * 0.3, top - 24);
    g.lineTo(hx + r * 0.5, top - 96); g.quadraticCurveTo(hx + r * 0.78, top - 90, hx + r * 0.7, top - 50); g.quadraticCurveTo(hx + r * 0.86, top + 8, hx + r * 0.8, top + 40); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = shadeOf(c, 1.6); g.lineWidth = 4; g.beginPath(); g.moveTo(hx - r * 0.2, top - 20); g.lineTo(hx + r * 0.5, top - 80); g.stroke(); g.strokeStyle = INK; g.lineWidth = LW;
    g.fillStyle = shadeOf(c, 0.7); g.fillRect(hx - r * 0.82, top + 26, r * 1.64, 24); g.strokeRect(hx - r * 0.82, top + 26, r * 1.64, 24);
    g.strokeStyle = '#2A2028'; g.lineWidth = 6; [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(hx + s * r * 0.8, top + 44); g.quadraticCurveTo(hx + s * r * 1.02, top + 140, hx + s * r * 0.86, top + 240); g.stroke(); }); g.lineWidth = LW; g.strokeStyle = INK;
  } else if (L.hat === 'mian') {                          // the emperor's crown: a flat board with strings of beads at front and back
    g.fillStyle = shadeOf(c, 0.8); g.beginPath(); g.roundRect(hx - r * 0.62, top - 40, r * 1.24, 84, 18); g.fill(); g.stroke();
    g.fillStyle = '#E2B33C'; g.fillRect(hx - r * 0.64, top + 10, r * 1.28, 18); g.strokeRect(hx - r * 0.64, top + 10, r * 1.28, 18);
    g.save(); g.translate(hx, top - 52); g.rotate(-0.06); g.fillStyle = '#1F1C33'; g.beginPath(); g.roundRect(-r * 1.25, -16, r * 2.5, 30, 8); g.fill(); g.stroke();
    g.fillStyle = '#C8372E'; g.fillRect(-r * 1.2, -12, r * 2.4, 8);
    for (let i = 0; i < 9; i++) { const x = -r * 1.1 + i * r * 0.275; g.strokeStyle = '#E2B33C'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 14); g.lineTo(x, 96); g.stroke();
      ['#E9F2FF', '#F2C230', '#D8343F', '#7FD1C0', '#E9F2FF'].forEach((bc, j) => { g.fillStyle = bc; g.beginPath(); g.arc(x, 26 + j * 17, 6.5, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); }); }
    g.restore(); g.strokeStyle = INK; g.lineWidth = LW;
  } else if (L.hat === 'official') {                      // black official's cap with two stiff wings
    [-1, 1].forEach((s) => { g.fillStyle = c; g.beginPath(); g.roundRect(hx + s * r * 0.7 - (s < 0 ? r * 0.9 : 0), top - 4, r * 0.9, 22, 10); g.fill(); g.stroke(); });
    g.fillStyle = c; g.beginPath(); g.moveTo(hx - r * 0.82, top + 42); g.lineTo(hx - r * 0.74, top - 46); g.quadraticCurveTo(hx, top - 80, hx + r * 0.74, top - 46); g.lineTo(hx + r * 0.82, top + 42); g.closePath(); g.fill(); g.stroke();
    band(top + 30, r * 0.84, L.band || shadeOf(c, 1.8));
  } else if (L.hat === 'headband') {
    g.fillStyle = c; g.fillRect(hx - r * 0.98, top + 46, r * 1.96, 30); g.strokeRect(hx - r * 0.98, top + 46, r * 1.96, 30);
    g.beginPath(); g.moveTo(hx + r * 0.95, top + 60); g.quadraticCurveTo(hx + r * 1.35, top + 40, hx + r * 1.5, top + 90); g.lineTo(hx + r * 1.3, top + 96); g.quadraticCurveTo(hx + r * 1.25, top + 70, hx + r * 0.95, top + 74); g.fill(); g.stroke();
  } else if (L.hat === 'slouch') {                               // army slouch hat: wide brim, left side pinned up, a band
    g.beginPath(); g.moveTo(hx - r * 1.05, top + 30); g.quadraticCurveTo(hx - r * 1.2, top - 60, hx - r * 0.62, top - 10); g.lineTo(hx - r * 0.55, top + 24); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx + 14, top + 30, r * 1.18, 24, 0.04, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx + 4, top + 18, r * 0.68, 76, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = L.band || '#4A3A28'; g.beginPath(); g.rect(hx - r * 0.66, top + 2, r * 1.34, 16); g.fill(); g.stroke();
    g.fillStyle = '#E2B33C'; g.beginPath(); g.arc(hx - r * 0.95, top - 18, 12, 0, 7); g.fill(); g.stroke();
  } else if (L.hat === 'cap') {                                  // newsboy cap
    g.beginPath(); g.ellipse(hx + 6, top + 34, r * 0.98, 62, -0.05, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = shadeOf(c, 0.75); g.beginPath(); g.ellipse(hx - 24, top + 40, r * 0.78, 22, 0.05, 0, Math.PI); g.fill(); g.stroke();
    g.fillStyle = shadeOf(c, 1.15); g.beginPath(); g.arc(hx + 6, top - 26, 12, 0, 7); g.fill(); g.stroke();
  } else if (L.hat === 'bowler') {
    g.beginPath(); g.ellipse(hx, top + 26, r * 1.02, 22, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(hx, top + 14, r * 0.66, 80, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    band(top + 4, r * 0.64, L.band || shadeOf(c, 0.6));
  } else if (L.hat === 'boater') {
    g.fillStyle = c; g.beginPath(); g.ellipse(hx, top + 30, r * 1.3, 26, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(hx - r * 0.66, top - 46, r * 1.32, 76, [16, 16, 4, 4]); g.fill(); g.stroke();
    band(top + 8, r * 0.66, L.band || '#3C6FB6');
    g.strokeStyle = shadeOf(c, 0.82); g.lineWidth = 3; for (let x = -r * 0.6; x < r * 0.6; x += 16) { g.beginPath(); g.moveTo(hx + x, top - 40); g.lineTo(hx + x + 6, top - 6); g.stroke(); }
  } else if (L.hat === 'beanie') {
    g.beginPath(); g.ellipse(hx, top + 50, r * 0.95, 96, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = shadeOf(c, 0.8); g.beginPath(); g.roundRect(hx - r * 0.98, top + 30, r * 1.96, 40, 18); g.fill(); g.stroke();
    g.fillStyle = L.band || '#F4EFE4'; g.beginPath(); g.arc(hx, top - 52, 22, 0, 7); g.fill(); g.stroke();
  } else if (L.hat === 'visor') {
    g.fillStyle = 'rgba(70,190,120,0.85)'; g.beginPath(); g.moveTo(hx - r * 1.0, top + 70); g.quadraticCurveTo(hx, top + 10, hx + r * 1.0, top + 70); g.lineTo(hx + r * 1.15, top + 98); g.quadraticCurveTo(hx, top + 54, hx - r * 1.15, top + 98); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c; g.beginPath(); g.moveTo(hx - r * 0.96, top + 64); g.quadraticCurveTo(hx, top + 4, hx + r * 0.96, top + 64); g.lineTo(hx + r * 0.9, top + 80); g.quadraticCurveTo(hx, top + 24, hx - r * 0.9, top + 80); g.closePath(); g.fill(); g.stroke();
  } else if (L.hat === 'tophat') {
    g.beginPath(); g.ellipse(hx, top + 24, r * 1.0, 20, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(hx - r * 0.6, top - 140, r * 1.2, 164, 8); g.fill(); g.stroke();
    band(top - 4, r * 0.6, L.band || '#B5372E');
  } else if (L.hat === 'bow') {
    const fx = hx + r * 0.5, fy = top + 26, c2 = L.hatCol || '#D8343F'; g.fillStyle = c2; g.lineWidth = 6;
    [-1, 1].forEach((s2) => { g.beginPath(); g.moveTo(fx, fy); g.bezierCurveTo(fx + s2 * 30, fy - 46, fx + s2 * 66, fy - 30, fx + s2 * 60, fy); g.bezierCurveTo(fx + s2 * 66, fy + 30, fx + s2 * 30, fy + 40, fx, fy); g.fill(); g.stroke(); });
    g.beginPath(); g.arc(fx, fy, 15, 0, 7); g.fill(); g.stroke();
    g.fillStyle = L.hairCol || '#6B4A3A'; [-1, 1].forEach((s2) => { g.beginPath(); g.ellipse(hx + s2 * (r + 4), hy + 10, 22, 50, s2 * -0.2, 0, 7); g.fill(); g.stroke(); });
  } else if (L.hat === 'mailcap') {
    g.fillStyle = c; g.beginPath(); g.roundRect(hx - r * 0.72, top - 40, r * 1.44, 70, [20, 20, 4, 4]); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(hx - 10, top + 34, r * 0.82, 18, 0.04, 0, Math.PI); g.fill();
    g.fillStyle = '#E2B33C'; g.beginPath(); g.arc(hx, top - 6, 13, 0, 7); g.fill(); g.lineWidth = 4; g.stroke();
  } else if (L.hat === 'railcap') {                      // hickory-stripe engineer cap: puffy striped crown, short brim
    const crown = new Path2D(); crown.moveTo(hx - r * 1.0, top + 46); crown.bezierCurveTo(hx - r * 1.08, top - 60, hx + r * 1.12, top - 70, hx + r * 1.04, top + 46); crown.closePath();
    g.fillStyle = c; g.fill(crown); g.save(); g.clip(crown); g.strokeStyle = L.band || '#F4F4F8'; g.lineWidth = 11;
    for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(hx + k * 26, top + 50); g.quadraticCurveTo(hx + k * 22, top - 10, hx + k * 12, top - 60); g.stroke(); }
    g.restore(); g.strokeStyle = INK; g.lineWidth = LW; g.stroke(crown);
    g.fillStyle = shadeOf(c, 0.7); g.beginPath(); g.ellipse(hx - 22, top + 50, r * 0.86, 24, 0.05, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
  } else if (L.hat === 'cowboy') {                       // wide brim with turned-up sides, pinched crown
    g.beginPath(); g.moveTo(hx - r * 1.55, top + 6); g.quadraticCurveTo(hx - r * 1.2, top + 52, hx, top + 50); g.quadraticCurveTo(hx + r * 1.2, top + 52, hx + r * 1.55, top + 6);
    g.quadraticCurveTo(hx + r * 1.2, top + 30, hx, top + 26); g.quadraticCurveTo(hx - r * 1.2, top + 30, hx - r * 1.55, top + 6); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hx - r * 0.66, top + 30); g.bezierCurveTo(hx - r * 0.72, top - 60, hx - r * 0.3, top - 100, hx - r * 0.1, top - 80); g.quadraticCurveTo(hx, top - 60, hx + r * 0.1, top - 80);
    g.bezierCurveTo(hx + r * 0.3, top - 100, hx + r * 0.72, top - 60, hx + r * 0.66, top + 30); g.closePath(); g.fill(); g.stroke();
    band(top + 12, r * 0.66, L.band || shadeOf(c, 0.6));
  } else if (L.hat === 'workcap') {                      // flat-topped peaked work cap
    g.beginPath(); g.moveTo(hx - r * 0.86, top + 44); g.lineTo(hx - r * 0.98, top - 20); g.lineTo(hx + r * 0.98, top - 20); g.lineTo(hx + r * 0.86, top + 44); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = shadeOf(c, 1.25); g.beginPath(); g.ellipse(hx, top - 22, r * 0.98, 26, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.ellipse(hx - 16, top + 46, r * 0.84, 18, 0.04, 0, Math.PI); g.fill();
    band(top + 26, r * 0.88, L.band || shadeOf(c, 0.6));
  } else if (L.hat === 'flower') {
    const fx = hx + r * 0.62, fy = top + 40;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.fillStyle = L.hatCol || '#F29BB5'; g.beginPath(); g.arc(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18, 14, 0, 7); g.fill(); g.lineWidth = 4; g.stroke(); }
    g.fillStyle = '#F6C945'; g.beginPath(); g.arc(fx, fy, 11, 0, 7); g.fill(); g.stroke();
  }
}

// ---------- props held in a hand: (g, x, y, angle, side) ----------
export const PROPS = {
  pail: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(x, y - 10, 34, Math.PI, 0); g.stroke();   // tin lunch pail
    g.fillStyle = '#9AA3AE'; g.beginPath(); g.moveTo(x - 46, y + 4); g.lineTo(x + 46, y + 4); g.lineTo(x + 38, y + 84); g.lineTo(x - 38, y + 84); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#C4CAD2'; g.fillRect(x - 40, y + 14, 14, 62); g.fillStyle = '#6E7782'; g.beginPath(); g.ellipse(x, y + 4, 46, 9, 0, 0, 7); g.fill(); g.stroke(); },
  sandwich: (g, x, y) => { g.save(); g.translate(x, y - 22); g.rotate(-0.08); g.strokeStyle = INK; g.lineWidth = 5;
    g.fillStyle = '#F2DDA6'; g.beginPath(); g.roundRect(-52, -30, 104, 22, 8); g.fill(); g.stroke(); g.fillStyle = '#E58A9A'; g.fillRect(-50, -9, 100, 9); g.fillStyle = '#8CC063'; g.fillRect(-54, -1, 108, 6);
    g.fillStyle = '#F2DDA6'; g.beginPath(); g.roundRect(-52, 4, 104, 22, 8); g.fill(); g.stroke(); g.restore(); },
  maul: (g, x, y, a) => { g.save(); g.translate(x, y); g.rotate(-(a || 0) * 0.3 - 0.2); g.strokeStyle = INK; g.lineWidth = 5;      // spike maul
    g.fillStyle = '#B07A48'; g.beginPath(); g.roundRect(-8, -230, 16, 300, 6); g.fill(); g.stroke();
    g.fillStyle = '#4A4A55'; g.beginPath(); g.moveTo(-90, -250); g.lineTo(80, -252); g.lineTo(80, -214); g.lineTo(-90, -222); g.closePath(); g.fill(); g.stroke(); g.restore(); },
  lantern: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(x, y - 6, 22, Math.PI, 0); g.stroke();
    g.fillStyle = '#B5372E'; g.beginPath(); g.roundRect(x - 30, y + 10, 60, 16, 4); g.fill(); g.stroke(); g.fillStyle = '#FFE7A0'; g.beginPath(); g.roundRect(x - 24, y + 26, 48, 60, 14); g.fill(); g.stroke();
    g.fillStyle = '#F2A33A'; g.beginPath(); g.ellipse(x, y + 60, 8, 14, 0, 0, 7); g.fill(); g.fillStyle = '#B5372E'; g.beginPath(); g.roundRect(x - 32, y + 84, 64, 14, 4); g.fill(); g.stroke(); },
  parcels: (g, x, y) => { [[0, 0, 150, 90], [10, -88, 120, 80], [-6, -160, 96, 64]].forEach(([dx, dy, w, h], i) => { g.fillStyle = ['#C8935A', '#B9844E', '#D3A26A'][i]; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.rect(x - w / 2 + dx - 40, y - h + dy, w, h); g.fill(); g.stroke(); g.fillStyle = '#E9D7A5'; g.fillRect(x + dx - 46, y - h + dy, 12, h); g.fillStyle = '#D8343F'; g.fillRect(x + dx + w / 2 - 70, y - h + dy + 10, 18, 22); }); },
  book: (title = 'RULES', open = 0) => (g, x, y) => { g.save(); g.translate(x, y - 70); g.strokeStyle = INK; g.lineWidth = 6;
    if (open > 0.5) { g.fillStyle = '#F4EFE4'; g.beginPath(); g.rect(-110, -70, 110, 140); g.rect(0, -70, 110, 140); g.fill(); g.stroke(); g.fillStyle = '#9B958A'; for (let i = 0; i < 6; i++) { g.fillRect(-96, -50 + i * 20, 82, 6); g.fillRect(14, -50 + i * 20, 82, 6); } }
    else { g.fillStyle = '#8A2E2E'; g.beginPath(); g.roundRect(-80, -100, 160, 200, 8); g.fill(); g.stroke(); g.fillStyle = '#E2B33C'; g.font = '900 30px Inter'; g.textAlign = 'center'; g.fillText(title, 0, -20); g.fillRect(-50, 10, 100, 6); }
    g.restore(); },
  ticket: (g, x, y) => { g.save(); g.translate(x + 10, y - 40); g.rotate(-0.2); g.fillStyle = '#F2D37A'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-70, -40, 140, 80, 6); g.fill(); g.stroke(); g.fillStyle = INK; g.font = '900 24px Inter'; g.textAlign = 'center'; g.fillText('TICKET', 0, -4); g.font = '900 30px Inter'; g.fillStyle = '#B5372E'; g.fillText('$$$', 0, 30); g.restore(); },
  purse: (g, x, y) => { g.fillStyle = '#7A5236'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y - 30, 44, 34, 0, 0, 7); g.fill(); g.stroke(); g.strokeStyle = '#C9A13B'; g.beginPath(); g.moveTo(x - 30, y - 56); g.lineTo(x + 30, y - 56); g.stroke(); g.fillStyle = '#C9C2B5'; g.beginPath(); g.arc(x + 30, y - 6, 4, 0, 7); g.fill(); },
  letters: (g, x, y) => { for (let i = 0; i < 3; i++) { g.save(); g.translate(x - 10 + i * 10, y - 40 - i * 8); g.rotate(-0.3 + i * 0.2); g.fillStyle = i === 1 ? '#F2E6CF' : '#FFFDF4'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.rect(-50, -30, 100, 60); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-50, -30); g.lineTo(0, 6); g.lineTo(50, -30); g.stroke(); g.fillStyle = '#D8343F'; g.fillRect(28, -24, 14, 16); g.restore(); } },
  rubberStamp: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#7A5236'; g.beginPath(); g.roundRect(x - 14, y - 90, 28, 60, 8); g.fill(); g.stroke(); g.fillStyle = '#B5372E'; g.beginPath(); g.roundRect(x - 40, y - 34, 80, 28, 4); g.fill(); g.stroke(); g.fillStyle = '#7A5236'; g.beginPath(); g.arc(x, y - 100, 20, 0, 7); g.fill(); g.stroke(); },
  stamp: (g, x, y) => { g.save(); g.translate(x, y - 40); g.fillStyle = '#FFFDF4'; g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.rect(-24, -30, 48, 60); g.fill(); g.stroke(); g.fillStyle = '#D8343F'; g.fillRect(-16, -22, 32, 36); g.restore(); },
  cash: (n = 1) => (g, x, y) => { for (let i = 0; i < n; i++) bill(g, x - 30, y - 34 - i * 12, 0.06 * (i % 2 ? -1 : 1)); },
  bill: (g, x, y) => bill(g, x - 10, y - 50, -0.5),
  stack: (g, x, y) => { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#7FBF7A' : '#8FD08A'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(x - 60, y - 40 - i * 16, 120, 18, 4); g.fill(); g.stroke(); } g.fillStyle = '#E9D7A5'; g.fillRect(x - 12, y - 120, 24, 82); g.strokeRect(x - 12, y - 120, 24, 82); },
  paper: (text = 'NEWS') => (g, x, y) => { g.save(); g.translate(x, y - 70); g.rotate(-0.08); g.fillStyle = '#F2EDE0'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.rect(-70, -90, 140, 180); g.fill(); g.stroke(); g.fillStyle = INK; g.font = '900 30px Inter'; g.textAlign = 'center'; g.fillText(text, 0, -50); g.fillStyle = '#9B958A'; for (let i = 0; i < 6; i++) g.fillRect(-56, -26 + i * 18, i === 2 ? 60 : 112, 7); g.restore(); },
  mirror: (g, x, y) => { g.strokeStyle = '#B8862F'; g.lineWidth = 12; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 60); g.stroke(); g.fillStyle = '#E6B850'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.arc(x, y - 110, 54, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#BFE6F5'; g.beginPath(); g.arc(x, y - 110, 40, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(x - 14, y - 124, 9, 18, 0.6, 0, 7); g.fill(); },
  cup: (g, x, y) => { g.fillStyle = '#F4EFE4'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.roundRect(x - 30, y - 70, 60, 70, [4, 4, 14, 14]); g.fill(); g.stroke(); g.beginPath(); g.arc(x + 34, y - 36, 16, -1.4, 1.4); g.stroke(); g.fillStyle = '#7A4A2A'; g.fillRect(x - 24, y - 64, 48, 10); },
  key: (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#E6B850'; g.beginPath(); g.arc(x, y - 60, 22, 0, 7); g.fill(); g.stroke(); g.fillRect(x - 5, y - 40, 10, 50); g.strokeRect(x - 5, y - 40, 10, 50); },
  sign: (text = 'SALE', col = '#F2EDE0') => (g, x, y) => { g.strokeStyle = INK; g.lineWidth = 6; g.fillStyle = '#9A6A43'; g.fillRect(x - 6, y - 150, 12, 160); g.strokeRect(x - 6, y - 150, 12, 160); g.fillStyle = col; g.beginPath(); g.roundRect(x - 100, y - 250, 200, 110, 10); g.fill(); g.stroke(); g.fillStyle = INK; g.font = '900 44px Inter'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - 194); },
};
function bill(g, x, y, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#9ED39A'; g.strokeStyle = INK; g.lineWidth = 5;
  g.beginPath(); g.roundRect(-10, -26, 100, 52, 6); g.fill(); g.stroke();
  g.strokeStyle = '#4F8F55'; g.lineWidth = 3; g.beginPath(); g.roundRect(-2, -18, 84, 36, 4); g.stroke();
  g.fillStyle = '#4F8F55'; g.beginPath(); g.arc(40, 0, 11, 0, 7); g.fill(); g.restore();
}

// ---------- the 3D cut-out ----------
let shadowTex = null;
export function blobTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(30,20,40,0.75)'); gr.addColorStop(0.6, 'rgba(30,20,40,0.25)'); gr.addColorStop(1, 'rgba(30,20,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); shadowTex = new THREE.CanvasTexture(c); return shadowTex;
}

export class Toon {
  /** height = metres from feet to the top of the head (≈1.75); res = canvas scale (2 = 1024x2048) */
  constructor(look = {}, { height = 1.75, res = 2, castShadow = true } = {}) {
    this.look = look; this.res = res;
    this.canvas = document.createElement('canvas'); this.canvas.width = 512 * res; this.canvas.height = 1024 * res;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    const H = height / 0.96, Wd = H / 2;                       // the head top sits ~4% below the canvas top
    const geo = new THREE.PlaneGeometry(Wd, H); geo.translate(0, H / 2 - H * (24 / 1024), 0);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, toneMapped: false });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.castShadow = castShadow;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.tex, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 0.9, Wd * 0.34), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.55 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.01;
    this.group = new THREE.Group(); this.pivot = new THREE.Group(); this.pivot.add(this.mesh); this.group.add(this.pivot, this.blob);
    this.key = ''; this.H = H; this.set({});
  }
  /** redraws only when the state changed */
  set(st = {}) {
    const key = JSON.stringify(st, (k, v) => (typeof v === 'function' ? (v.name || String(v).length) : typeof v === 'number' ? Math.round(v * 100) / 100 : v));
    if (key === this.key) return this;
    this.key = key; this.st = st;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.scale(this.res, this.res); this.hands = drawToon(g, this.look, st);
    this.tex.needsUpdate = true; return this;
  }
  /** turn the cut-out to face the camera (around the vertical axis only) */
  face(cam) { const p = new THREE.Vector3(); this.group.getWorldPosition(p); this.pivot.rotation.y = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) - this.group.rotation.y; return this; }
  tint(col) { this.mat.color.set(col); return this; }
  /** change the look (e.g. more stamps) and force a redraw */
  restyle(patch) { Object.assign(this.look, patch); this.key = ''; return this; }
  at(x, y, z) { this.group.position.set(x, y, z); return this; }
}
