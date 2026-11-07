// WHY EVERYONE PICKS THE SAME RANDOM NUMBER — kit v9.1: a sunny main street; a street interviewer with a mic, his
// deadpan buddy with a clipboard and a giant easel chart whose bars grow as people answer; placards for the answers.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as WD from './core/world.js';
import * as A from './core/act.js';
import { Toon, INK, PROPS } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let CUR = '_', NOW = 0, FF = null;
const LOOK = {
  host: { body: '#D8343F', pattern: 'jacket', patCol: '#A82A30', hat: 'none', hair: '#3A2A1A', extra: ['blush'], neck: 'tie', neckCol: '#F2C230' },
  buddy: { body: '#3C6FB6', pattern: 'vest', patCol: '#2E5A9A', hat: 'cap', hatCol: '#2A2830', extra: ['glasses'] },
  thinker: { body: '#7FBF7A', pattern: 'plaid', patCol: '#5E9A5A', hat: 'workcap', hatCol: '#C8783A', extra: ['beard'], beardCol: '#6A4A30' },
  lady: { body: '#B98ACF', pattern: 'plain', hat: 'bun', hatCol: '#5A3A22', extra: ['freckles'] },
  guy2: { body: '#E2B33C', pattern: 'stripes', patCol: '#C89A2E', hat: 'beanie', hatCol: '#3C6FB6', extra: ['mustache'] },
  weird: { body: '#F29BB5', pattern: 'check', patCol: '#7FBF7A', hat: 'flower', hatCol: '#F2C230', neck: 'bowtie', neckCol: '#3C6FB6', extra: ['monocle'] },
};
const mic = (g, x, y) => { g.save(); g.translate(x, y); g.rotate(-0.5); g.fillStyle = '#2A2A33'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-9, -10, 18, 80, 6); g.fill(); g.stroke(); g.fillStyle = '#9AA3AE'; g.beginPath(); g.arc(0, -24, 22, 0, 7); g.fill(); g.stroke(); g.restore(); };
const clip = (g, x, y) => { g.save(); g.translate(x, y - 40); g.rotate(0.15); g.fillStyle = '#A8693E'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.rect(-55, -70, 110, 150); g.fill(); g.stroke(); g.fillStyle = '#FFFFFF'; g.fillRect(-45, -55, 90, 125); g.strokeStyle = '#8A90A0'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-35, -35 + i * 18); g.lineTo(35, -35 + i * 18); g.stroke(); } g.fillStyle = '#9AA3AE'; g.fillRect(-20, -78, 40, 16); g.restore(); };

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; CUR = o.id; FF = null; f(lt, d, t, blit); FX.motes(t, { n: 14, col: '255,245,220', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.16, bloomThreshold: 0.96, aperture: 0.0016, maxblur: 0.009 };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos); cam.position.lerp(V3(...c.look), 0.12 * clamp((50 - c.fov) / 6));   // v9.2: continuous push-in (the old 38-44 on/off switch made the camera jump)
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); ST.faceAll(cam); A.frameFix(cam, FF || all.filter((q) => q.group.parent === scene && q.group.visible), { t: NOW, key: CUR, extras: FF ? [] : [chart.grp] }); all.forEach((q) => q.face(cam)); ST.faceAll(cam);
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

  // ── the street ──
  const ST = WD.mainStreet(E, { len: 70, people: true, cars: true }); const SC = ST.scene;
  // the giant easel chart: bars for 1..100 grouped by 10 plus called-out spikes
  const chart = (() => { const c = document.createElement('canvas'); c.width = 768; c.height = 560; const g = c.getContext('2d'); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; let key = '';
    const grp = new THREE.Group(); const wood = WD.mat({ color: '#9A6A3E' });
    const face = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, 0.06), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), wood]); face.position.y = 1.95; face.castShadow = true; grp.add(face);
    [[-1.0, 0.25], [1.0, 0.25], [0, -0.55]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), wood); l.position.set(x, 1.1, z * 0.6 - 0.1); l.rotation.x = z < 0 ? -0.35 : 0.06; l.castShadow = true; grp.add(l); });
    const draw = (mode, k, hl) => { const kk = mode + '|' + k.toFixed(2) + '|' + hl; if (kk === key) return; key = kk;
      g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, 768, 560); g.strokeStyle = '#9A6A3E'; g.lineWidth = 26; g.strokeRect(0, 0, 768, 560);
      g.fillStyle = '#2A2230'; g.font = '900 52px Inter, sans-serif'; g.textAlign = 'center';
      if (mode === 'ten') { g.fillText('PICK 1 TO 10', 384, 62); for (let n = 1; n <= 10; n++) { const h = (n === 7 ? 330 : n === 3 ? 140 : n === 5 ? 110 : [1, 10].includes(n) ? 40 : 70) * k, x = 60 + (n - 1) * 66;
          g.fillStyle = n === 7 ? '#D8343F' : '#3C6FB6'; g.fillRect(x, 470 - h, 50, h); g.strokeStyle = '#2A2230'; g.lineWidth = 4; g.strokeRect(x, 470 - h, 50, h); g.fillStyle = '#2A2230'; g.font = '900 30px Inter, sans-serif'; g.fillText(String(n), x + 25, 515); }
        tex.needsUpdate = true; return; }
      if (mode === 'rules') { g.fillText('YOUR BRAIN SAYS NO TO:', 384, 70); const rows = [['2, 4, 6, 8...', 'TOO NEAT'], ['10, 20, 30...', 'PLANNED'], ['1 and 100', 'IN THE QUESTION']];
        rows.forEach(([a, b], i) => { if (k < i + 0.3) return; const y = 175 + i * 125; g.textAlign = 'left'; g.fillStyle = '#3C6FB6'; g.font = '900 60px Inter, sans-serif'; g.fillText(a, 50, y - 18); g.fillStyle = '#D8343F'; g.font = '900 50px Inter, sans-serif'; g.fillText('= ' + b, 120, y + 42); g.strokeStyle = '#D8343F'; g.lineWidth = 9; g.beginPath(); g.moveTo(44, y - 34); g.lineTo(440, y - 34); g.stroke(); g.textAlign = 'center'; });
        tex.needsUpdate = true; return; }
      if (mode === 'pick') { g.fillText('SO IT PICKS...', 384, 70); ['ODD', 'NOT TOO BIG', 'NOT TOO SMALL', 'MEANS NOTHING'].forEach((s, i) => { if (k < i * 0.5 + 0.2) return; g.fillStyle = '#3C6FB6'; g.font = '900 44px Inter, sans-serif'; g.textAlign = 'left'; g.fillText('✓ ' + s, 36, 160 + i * 88); g.textAlign = 'center'; });
        if (k > 2.2) { g.fillStyle = '#D8343F'; g.font = '900 180px Inter, sans-serif'; g.fillText('37', 640, 470); } tex.needsUpdate = true; return; }
      g.fillText('"RANDOM" NUMBER, 1 TO 100', 384, 62);
      for (let n = 1; n <= 100; n++) { const x = 44 + (n - 1) * 6.8; let h = 26 + 18 * Math.abs(Math.sin(n * 12.9898) * 1.7 % 1);
        if (n % 10 === 0) h = 6; if (n === 37 || n === 73) h = 330; if (n === 77) h = 250; if (n === 7) h = 220; if (n === 1 || n === 100) h = 160; if (n === 42 || n === 69) h = 180; if (n === 50) h = 90;
        h *= k; g.fillStyle = hl.includes(n) ? '#D8343F' : (n % 10 === 0 && hl.includes(0)) ? '#F2C230' : '#3C6FB6'; g.fillRect(x - (hl.includes(n) ? 2 : 0), 470 - h, hl.includes(n) ? 9 : 5.6, h); }
      g.fillStyle = '#2A2230'; g.font = '900 28px Inter, sans-serif'; [1, 25, 50, 75, 100].forEach((n) => g.fillText(String(n), 47 + (n - 1) * 6.8, 512));
      hl.filter((n) => n > 0).forEach((n, i) => { g.fillStyle = '#D8343F'; g.font = '900 58px Inter, sans-serif'; g.fillText(String(n), 47 + (n - 1) * 6.8, 470 - 340 * k - 12 + (n === 77 ? 80 : 0)); });
      if (hl.includes(0)) { g.fillStyle = '#C8901A'; g.font = '900 46px Inter, sans-serif'; g.fillText('90? 30? 40? NOPE', 384, 160); }
      tex.needsUpdate = true; };
    return { grp, draw }; })();
  chart.grp.position.set(2.1, 0, -5.6); chart.grp.rotation.y = -0.2; SC.add(chart.grp);
  const BACK = ST.people;   // background extras on the sidewalks

  // ── cast ──
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const host = mk('host', 1), buddy = mk('buddy', 2, 1.7), thinker = mk('thinker', 3, 1.82), lady = mk('lady', 4, 1.6), guy2 = mk('guy2', 5, 1.72);
  const clones = [0, 1, 2, 3, 4, 5].map((i) => mk('weird', 10 + i, 1.66 + (i % 3) * 0.06));
  const all = [host, buddy, thinker, lady, guy2, ...clones];
  const hideAll = () => all.forEach((p) => (p.group.visible = false));
  const CARDS = {}; const card = (n) => CARDS[n] || (CARDS[n] = Object.defineProperty((g, x, y) => { g.save(); g.translate(x, y); g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = '#9A6A43'; g.fillRect(-7, -150, 14, 160); g.strokeRect(-7, -150, 14, 160);
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(-95, -290, 190, 150, 16); g.fill(); g.stroke(); g.fillStyle = '#D8343F'; g.font = '900 112px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 0, -212); g.restore(); }, 'name', { value: 'card' + n }));
  into(SC, ...all);

  // ── S1 · "Someone asked two hundred thousand people to pick a random number from one to a hundred, and they kept picking the same few numbers."
  { const st = 0, tw = Wd('thousand', 0), pi = Wd('pick', 0), ke = Wd('kept', 0), fe = Wd('few', 0), end = L(1);
    add({ id: 'S1', at: st, note: 'cold open: a crane down a sunny main street full of people to a giant easel chart where four bars (37, 73, 77, 7) shoot up far above all the others; the host and his buddy stare up at it', draw(lt, d, t, blit) {
      hideAll();
      chart.draw('hundred', eo(clamp((t - pi) / 1.6)), t > ke ? [37, 73, 77, 7] : []);
      act(host, 0.4, -4.6, { ...A.face(t, [[st, 'content'], [ke, 'gasp'], [fe, 'shock']]), holdR: mic, armR: [60, 60], ...A.react('shock', t, ke + 0.2, 0.7) });
      act(buddy, 3.6, -4.9, { ...A.face(t, [[st, 'skeptic'], [fe, 'skeptic']]), holdL: clip, armL: [50, 70] });
      const c = A.camPath(t, [
        [st, [0.0, 9.0, 12.0], [0.0, 2.0, -6.0], 50],
        [pi, [0.6, 4.0, 4.0], [1.4, 1.9, -5.0], 46],
        [end, [1.6, 2.4, 0.2], [1.8, 1.9, -5.0], 44],
      ]);
      shoot(SC, c); blit();
    } });
    cue(0.05, 'swoosh', { gain: 0.45, sweep: -0.8 }); cue(Wd('kept', 0), 'zip', { gain: 0.3 }); cue(Wd('few', 0), 'ding', { gain: 0.3 }); }

  // ── S2 · "Picture a guy with a microphone stopping people on the street." / "'Quick, random number, one to a hundred.' A man thinks really hard and goes, 'Thirty seven.'"
  { const st = L(1), mi = Wd('microphone', 1), qu = L(2), th = Wd('thinks', 2), go = Wd('goes', 2), ts = Wd('thirty', 2), end = L(3);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'the host darts in front of a bearded man and shoves the mic at him; the man strains, steam puffing, then proudly flips up a placard: 37', draw(lt, d, t, blit) {
      hideAll();
      act(host, lerp(-1.5, -0.6, eo(clamp((t - st) / 0.8))), -3.2, { ...A.face(t, [[st, 'excited'], [qu, 'happy'], [ts, 'excited']]), holdR: mic, armR: A.arm(t, [[st, [60, 60]], [qu, [100, 40]]]) });
      act(thinker, 0.6, -3.6, { ...A.face(t, [[st, 'neutral'], [qu, 'shock'], [th, 'strain'], [ts, 'proud']]), steam: t > th && t < ts, holdR: t > ts - 0.2 ? card(37) : undefined, armR: t > ts - 0.2 ? [150, -10] : [30, 30], ...A.react('proud', t, ts, 1.0) });
      const c = A.camPath(t, [[st, [-1.6, 1.9, 1.4], [-0.6, 1.5, -3.4], 44], [qu + 0.3, [0.4, 1.8, 0.8], [0.0, 1.5, -3.4], 42], [end, [0.8, 1.8, 0.4], [0.3, 1.6, -3.5], 40]]);
      shoot(SC, c); blit();
    } });
    cue(Wd('thinks', 2), 'sizzle', { gain: 0.25 }); cue(Wd('thirty', 2), 'ding', { gain: 0.3 }); }

  // ── S3 · "Next lady. 'Seventy three.' Next guy. 'Seventy seven.'" / "His buddy with the clipboard says, 'Wow. Super random crowd today.'"
  { const st = L(3), la = Wd('lady', 3), se = Wd('seventy', 3), gu = Wd('guy', 3), bu = L(4), wo = Wd('wow', 4), cr = Wd('crowd', 4), end = L(5);
    add({ id: 'S3', at: st, note: 'a quick line-up: a lady flips up 73, a guy in a beanie flips up 77; the camera glides to the buddy with the clipboard, who ticks a box with a flat, unimpressed face', draw(lt, d, t, blit) {
      hideAll();
      act(host, -0.8, -3.2, { ...A.face(t, [[st, 'excited'], [bu, 'happy']]), holdR: mic, armR: [100, 40] });
      act(lady, 0.3, -3.7, { ...A.face(t, [[st, 'content'], [la + 0.3, 'proud']]), holdR: t > la ? card(73) : undefined, armR: t > la ? [150, -10] : [30, 30] }, 0, 0.8);
      act(guy2, 1.3, -3.9, { ...A.face(t, [[st, 'neutral'], [gu + 0.3, 'excited']]), holdR: t > gu ? card(77) : undefined, armR: t > gu ? [150, -10] : [30, 30] }, 0, 0.8);
      act(buddy, 2.5, -3.4, { ...A.face(t, [[st, 'skeptic'], [wo, 'sly'], [cr, 'skeptic']]), holdL: clip, armL: [50, 70], armR: A.arm(t, [[st, [30, 30]], [wo, [70, 80]], [cr, [30, 30]]]) });
      const c = A.camPath(t, [[st, [0.0, 1.8, 1.2], [0.2, 1.55, -3.6], 44], [gu + 0.4, [0.9, 1.8, 1.0], [0.9, 1.55, -3.7], 44], [bu + 0.2, [2.4, 1.75, -0.4], [2.4, 1.55, -3.4], 40], [end, [2.3, 1.75, -0.6], [2.4, 1.55, -3.4], 38]]);
      shoot(SC, c); blit();
    } });
    cue(Wd('seventy', 3), 'pop', { gain: 0.3 }); cue(Wd('guy', 3) + 0.4, 'pop', { gain: 0.3 }); cue(Wd('crowd', 4), 'tock', { gain: 0.3 }); }

  // ── S4 · "Meanwhile, almost nobody says ninety, or thirty, or forty." / "And if you only ask for one to ten, a huge chunk of people just say seven."
  { const st = L(5), ni = Wd('ninety', 5), an = L(6), te = Wd('ten', 6), se = Wd('seven', 6), end = L(7);
    add({ id: 'S4', at: st, note: 'at the chart: the round-number bars (90, 30, 40) glow yellow and are tiny; the buddy flips the chart to PICK 1 TO 10 and the 7 bar rockets up red', draw(lt, d, t, blit) {
      hideAll();
      if (t < an) chart.draw('hundred', 1, t > ni ? [0] : []); else chart.draw('ten', eo(clamp((t - te) / 0.9)), []);
      act(buddy, 2.95, -4.5, { ...A.face(t, [[st, 'content'], [ni, 'scheme'], [se, 'proud']]), holdL: clip, armL: [50, 70], armR: A.arm(t, [[st, [30, 30]], [ni - 0.2, [120, 30]], [an, [30, 30]], [se, [140, 20]]]), ...A.react('point', t, se, 0.9) });
      act(host, 0.4, -4.6, { ...A.face(t, [[st, 'skeptic'], [se, 'gasp']]), holdR: mic, armR: [60, 60], ...A.react('shock', t, se + 0.1, 0.6) });
      const c = A.camPath(t, [[st, [2.3, 2.0, -2.2], [2.2, 1.95, -5.6], 44], [an, [2.5, 2.0, -2.3], [2.3, 1.95, -5.6], 44], [end, [2.3, 2.0, -2.1], [2.2, 1.9, -5.6], 46]]);
      shoot(SC, c); blit();
    } });
    cue(Wd('ninety', 5), 'tock', { gain: 0.25 }); cue(Wd('seven', 6), 'zip', { gain: 0.3 }); }

  // ── S5 · "You see, your brain has a picture of what random looks like, and it's really picky." / "Even numbers feel too neat. Numbers ending in zero feel planned. One and a hundred are right there in the question."
  { const st = L(7), yo = Wd('see', 7), pk = Wd('picky', 7), ev = L(8), ze = Wd('zero', 8), on = Wd('one', 8), qn = Wd('question', 8), end = L(9);
    add({ id: 'S5', at: st, note: 'the buddy turns teacher at the chart: YOUR BRAIN SAYS NO TO: even numbers (TOO NEAT), round tens (PLANNED), 1 and 100 (IN THE QUESTION), each crossed out as he taps it; the host nods along', draw(lt, d, t, blit) {
      hideAll();
      const k = t < ev ? 0 : t < ze - 0.4 ? 1 : t < on - 0.2 ? 2 : 3; chart.draw('rules', k, []);
      act(buddy, 2.95, -4.5, { ...A.face(t, [[st, 'scheme'], [pk, 'skeptic'], [ev, 'content'], [qn, 'proud']]), holdL: clip, armL: [50, 70], armR: A.arm(t, [[st, [40, 40]], [ev, [130, 30]], [ev + 0.6, [40, 40]], [ze - 0.4, [120, 20]], [ze + 0.3, [40, 40]], [on - 0.2, [110, 10]], [qn, [40, 40]]]) });
      act(host, 0.4, -4.6, { ...A.face(t, [[st, 'content'], [pk, 'skeptic'], [qn, 'happy']]), holdR: mic, armR: [60, 60] });
      const c = A.camPath(t, [[st, [1.0, 1.9, 0.6], [1.6, 1.7, -4.8], 46], [ev, [2.3, 2.0, -2.2], [2.2, 1.95, -5.6], 44], [end, [2.4, 2.0, -2.3], [2.3, 1.95, -5.6], 42]]);
      shoot(SC, c); blit();
    } });
    cue(Wd('see', 7), 'swoosh', { gain: 0.3 }); cue(L(8) + 0.2, 'slide', { gain: 0.25 }); cue(Wd('zero', 8) - 0.3, 'slide', { gain: 0.25 }); cue(Wd('one', 8) - 0.1, 'slide', { gain: 0.25 }); }

  // ── S6 · "So it grabs something odd, not too big, not too small, that doesn't mean anything. Like thirty seven."
  { const st = L(9), od = Wd('odd', 9), bi = Wd('big', 9), sm = Wd('small', 9), me = Wd('mean', 9), li = Wd('like', 9), end = L(10);
    add({ id: 'S6', at: st, note: 'four ticks appear on the chart (ODD, NOT TOO BIG, NOT TOO SMALL, MEANS NOTHING) and a giant red 37 lands; the host whips the 37 placard back up with a grin', draw(lt, d, t, blit) {
      hideAll();
      const k = t < od ? 0 : t < bi ? 0.3 : t < sm ? 0.8 : t < me ? 1.3 : t < li ? 1.8 : 2.4; chart.draw('pick', k, []);
      act(host, 0.4, -4.6, { ...A.face(t, [[st, 'content'], [li, 'excited']]), holdR: t > li ? card(37) : mic, armR: t > li ? [150, -10] : [60, 60], ...A.react('cheer', t, li + 0.2, 0.8) });
      act(buddy, 2.95, -4.5, { ...A.face(t, [[st, 'content'], [li, 'proud']]), holdL: clip, armL: [50, 70], ...A.react('point', t, li, 0.9) });
      const c = A.camPath(t, [[st, [2.3, 2.0, -2.2], [2.2, 1.95, -5.6], 44], [li - 0.2, [1.6, 2.0, -1.0], [1.5, 1.8, -5.0], 46], [end, [1.4, 2.0, -0.8], [1.3, 1.8, -5.0], 46]]);
      shoot(SC, c); blit();
    } });
    cue(Wd('odd', 9), 'pop', { gain: 0.25 }); cue(Wd('big', 9), 'pop', { gain: 0.25 }); cue(Wd('small', 9), 'pop', { gain: 0.25 }); cue(Wd('mean', 9), 'pop', { gain: 0.25 }); cue(Wd('like', 9) + 0.3, 'ding', { gain: 0.3 }); }

  // ── S7 · "It's like trying to stand out in a crowd by wearing the weirdest outfit you own." / "Then you show up, and everyone else had the exact same idea."
  { const st = L(10), wr = Wd('weirdest', 10), th = L(11), sh = Wd('show', 11), ev = Wd('everyone', 11), sa = Wd('same', 11), end = L(12);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'down the street a guy struts out in a loud pink-check suit with a flower hat and monocle, posing; the camera pulls back to show five more people in the exact same outfit; they all freeze and gasp', draw(lt, d, t, blit) {
      hideAll();
      const reveal = eo(clamp((t - ev + 0.3) / 0.8));
      clones.forEach((p, i) => { if (i === 0) { act(p, lerp(-1.6, 0.0, eo(clamp((t - st) / 1.4))), -12, { ...A.face(t, [[st, 'proud'], [wr, 'excited'], [ev, 'shock'], [sa, 'gasp']]), armR: A.arm(t, [[st, [40, 40]], [wr, [150, -10]], [ev, [30, 30]]]), ...A.react('proud', t, wr, 1.2), ...A.react('shock', t, ev + 0.1, 0.7) }); return; }
        if (t < ev - 0.4) return; const a = [-2.2, 2.2, -1.1, 1.2, 2.9][i - 1], z = -12 + [-0.8, -0.6, -1.8, -1.6, -2.4][i - 1];
        act(p, a * reveal + (1 - reveal) * (a * 2.6), z, { ...A.face(t, [[ev, 'proud'], [sa, 'shock']]), ...A.react('shock', t, sa + i * 0.06, 0.7), armR: [150, -10] }, 0, 0.8); });
      const c = A.camPath(t, [[st, [-0.6, 1.9, -7.6], [-0.4, 1.5, -12], 42], [th, [0.0, 1.9, -8.2], [0.0, 1.5, -12], 40], [ev - 0.2, [0.0, 1.8, -8.6], [0.0, 1.5, -12], 40], [sa, [0.1, 2.2, -7.2], [0.2, 1.4, -12.6], 50], [end, [0.1, 2.2, -7.0], [0.2, 1.4, -12.6], 50]]);
      if (t < ev - 0.2) FF = [clones[0]];
      shoot(SC, c); blit();
    } });
    cue(Wd('weirdest', 10), 'sparkle', { gain: 0.3 }); cue(Wd('everyone', 11), 'whoosh', { gain: 0.4 }); cue(Wd('same', 11), 'boing', { gain: 0.35 }); }

  // ── S8 · "So the most random number people can think of is about the least random number there is."
  { const st = L(12), mo = Wd('most', 12), le = Wd('least', 12), end = T.dur;
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'back at the chart: the host holds up 37 to camera with a shrug, the buddy behind him tips his cap and laughs, the 37 bar towering on the chart', draw(lt, d, t, blit) {
      hideAll(); chart.draw('hundred', 1, [37, 73]);
      act(host, 0.9, -3.6, { ...A.face(t, [[st, 'content'], [mo, 'scheme'], [le, 'laugh']]), holdR: card(37), armR: [150, -10], ...A.react('shrug', t, le + 0.4, 1.2) });
      act(buddy, 3.2, -4.6, { ...A.face(t, [[st, 'skeptic'], [le, 'laugh']]), holdL: clip, armL: [50, 70], ...A.react('laugh', t, le + 0.2, 1.4) });
      const c = A.camPath(t, [[st, [1.6, 2.0, 0.6], [1.8, 1.8, -4.6], 46], [end, [1.4, 1.85, -0.2], [1.6, 1.7, -4.4], 42]]);
      shoot(SC, c); blit();
    } });
    cue(Wd('least', 12) + 0.3, 'boing', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
