// Captions (Iron Canyon): short phrases of 1-3 words ("on the job."), white heavy sans with a thick black outline and a
// soft drop shadow, lower centre of the screen. No colour highlight. Words keep their punctuation; a chunk always ends
// at a comma or full stop. A script line may set "caps": "He bet | his life | savings" to choose the chunks.
import { ctx, clamp, lerp, seg, eob } from './lib.js';
import { T, lineWords } from './timing.js';

// v6 captions: rounded heavy white words (Nunito Black, falls back to Inter), a slim dark edge and a soft blurred shadow,
// lower-middle of the frame, a quick springy pop-in per word chunk.
export const CAP = { y: 1350, size: 74, maxW: 900, font: 'Nunito, Inter', weight: 900, pop: 0.06 };   // v8: like the references (small, 1-2 words, mid-low)
let caps = [];
const SHORT = /^(a|an|the|to|of|in|on|at|by|and|but|or|so|is|it|he|she|we|i|his|her|my|no|up|for|was)$/i;

function autoChunks(ws) {
  const out = []; let a = 0;
  for (let i = 0; i < ws.length; i++) {
    const len = ws.slice(a, i + 1).join(' ').length, n = ws[i + 1];
    const end = !n || /[,.!?;:]$/.test(ws[i]) || i - a >= 2 || (len + 1 + n.length > 14 && !SHORT.test(ws[i].replace(/[^A-Za-z']/g, '')));
    if (end) { out.push([a, i]); a = i + 1; }
  }
  return out;
}

export function buildCaptions(script) {
  caps = [];
  script.lines.forEach((ln, i) => {
    const ws = lineWords(i); if (!ws.length) return;
    const textWords = ln.text.split(/\s+/).filter(Boolean);
    const spoken = ws.length === textWords.length ? textWords : ws.map((w) => w.w);
    if (ln.caps) {
      const nm = (w) => String(w).toLowerCase().replace(/[^a-z0-9']+/g, '');
      let from = 0;
      ln.caps.split('|').map((c) => c.trim()).filter(Boolean).forEach((c, j) => {
        const first = nm(c.split(/\s+/)[0]);
        let idx = j === 0 ? 0 : ws.findIndex((w, k) => k > from && nm(w.w) === first);
        if (idx < 0) idx = Math.min(ws.length - 1, from + 1);
        from = idx; caps.push({ line: i, s: ws[idx].s - 0.03, text: c.replace(/\*/g, '') });
      });
    } else autoChunks(spoken).forEach(([a, b]) => caps.push({ line: i, s: ws[a].s - 0.03, text: spoken.slice(a, b + 1).join(' ') }));
  });
  caps.forEach((c, k) => { const next = caps[k + 1], lineEnd = T.lines[c.line].end; c.e = next ? (next.s - lineEnd > 0.6 && next.line !== c.line ? lineEnd + 0.25 : next.s) : T.dur; });
  return caps;
}
export const captionList = () => caps.map((c) => ({ ...c, words: [{ txt: c.text }] }));

/** draw one caption text at x, y (also used by the style sheet) */
export function captionText(text, x = 540, y = CAP.y, sc = 1) {
  const size = CAP.size;
  ctx.save(); ctx.font = `${CAP.weight || 900} ${size}px ${CAP.font}`; ctx.letterSpacing = '0.5px';
  const fit = Math.min(1, CAP.maxW / ctx.measureText(text).width);
  ctx.translate(x, y); ctx.scale(sc * fit, sc * fit); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(text, 0, 3); ctx.restore();
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(16,12,28,0.92)'; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(text, 0, 0);
  ctx.restore();
}
export function drawCaption(t) {
  const c = caps.find((c) => t >= c.s && t < c.e); if (!c) return;
  const lt = t - c.s; captionText(c.text, 540, CAP.y, CAP.pop && lt < CAP.pop ? lerp(0.9, 1, eob(seg(lt, 0, CAP.pop))) : 1);
}
