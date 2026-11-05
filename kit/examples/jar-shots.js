// THE BRONZE JAR THAT FELT A DISTANT EARTHQUAKE: the shot list (Iron Canyon / Tall Tale engine v4).
// Zhang Heng's seismoscope (132 AD): 8 dragons with bronze balls, 8 toads; a ball fell when nobody felt a tremor;
// days later a messenger reported a big earthquake far to the west.
// v4 acting: every person runs on act.alive() (eye darts, blinks, head sway, breath), moods change through
// act.face() timelines (blended, never snapped), arms through act.keys() poses. Short, busy shots; zoom/whip transitions.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, eob, W as CW, H as CH } from './core/lib.js';
import { L, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as WD from './core/world.js';
import * as HN from './core/han.js';
import * as A from './core/act.js';
import { Toon, PROPS, INK } from './core/toon.js';
import { Horse } from './core/beasts.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = (a, b, k) => a.clone().lerp(b, k);
const drift = (x) => 0.65 * x + 0.35 * eio(x);
let NOW = 0;

const LOOK = {
  zhang: { body: '#2E5FA8', robe: true, sleeves: true, trim: '#E9B23C', hat: 'scholar', hatCol: '#1F1C33', extra: ['longmustache', 'goatee'], mustacheCol: '#2A2028' },
  emp: { body: '#E9B23C', robe: true, sleeves: true, trim: '#C8372E', hat: 'mian', hatCol: '#1F1C33', extra: ['longmustache', 'goatee'], mustacheCol: '#3A2A22' },
  rivA: { body: '#3FA58C', robe: true, sleeves: true, trim: '#1F5E4E', hat: 'official', hatCol: '#1F1C33', extra: ['mustache'], mustacheCol: '#2A2028' },
  rivB: { body: '#8A4FB8', robe: true, sleeves: true, trim: '#E9B23C', hat: 'official', hatCol: '#1F1C33', extra: ['goatee'], mustacheCol: '#2A2028' },
  mess: { body: '#B0643A', pattern: 'jacket', patCol: '#7A4428', belt: '#3A2E2A', hat: 'headband', hatCol: '#D8343F', extra: [] },
};
const make = (k, seed) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }); p.seed = seed; return p; };

// cut-out props held in hands
const P2 = {
  scroll: (g, x, y) => { g.save(); g.translate(x, y - 10); g.rotate(-0.2); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#F4E6C4'; g.beginPath(); g.roundRect(-16, -80, 32, 160, 10); g.fill(); g.stroke();
    g.fillStyle = '#9E2420'; [-84, 76].forEach((yy) => { g.beginPath(); g.roundRect(-22, yy, 44, 12, 5); g.fill(); g.stroke(); }); g.restore(); },
  openScroll: (g, x, y) => { g.save(); g.translate(x + 60, y - 40); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#F4E6C4'; g.beginPath(); g.rect(-70, -50, 140, 100); g.fill(); g.stroke();
    g.fillStyle = '#2A2028'; for (let i = 0; i < 4; i++) g.fillRect(-50 + i * 30, -36, 8, 72); g.fillStyle = '#9E2420'; [-78, 66].forEach((xx) => { g.beginPath(); g.roundRect(xx, -58, 12, 116, 5); g.fill(); g.stroke(); }); g.restore(); },
  fan: (g, x, y, a) => { g.save(); g.translate(x, y); g.rotate(-0.6 + (a || 0) * 0.2); g.strokeStyle = INK; g.lineWidth = 5; g.fillStyle = '#F2C230'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 90, -2.4, -0.7); g.closePath(); g.fill(); g.stroke(); g.restore(); },
};

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); if (!o.noMotes) FX.motes(t, { n: o.motes ?? 34, col: o.moteCol || '255,226,170', size: 1.1 }); if (o.shafts) FX.shafts(t, { k: o.shafts, x: o.shaftX ?? CW * 0.7, angle: o.shaftA ?? 0.3, col: o.shaftCol || '255,222,170' }); }; S.push(o); return o; };
  const cut = (i) => (i === 0 ? 0 : L(i) - 0.05);
  const cam = camera(40);
  const headXY = (p, up = 1.62) => { const v = p.group.position.clone(); v.y += up; v.project(cam); return [(v.x + 1) / 2 * CW, (1 - v.y) / 2 * CH]; };
  const toScreen = (v) => { const q = v.clone().project(cam); return [(q.x + 1) / 2 * CW, (1 - q.y) / 2 * CH]; };
  const LK = { bloom: 0.42, bloomThreshold: 0.92, aperture: 0.0007, maxblur: 0.007 };
  const shoot = (scene, people, p, a, look = LK, shake = 0, t = NOW, fov = 40) => {
    const f = look.fov || fov; if (cam.fov !== f) { cam.fov = f; cam.updateProjectionMatrix(); }
    cam.position.copy(p); if (shake) cam.position.add(V3(Math.sin(t * 61) * shake, Math.cos(t * 47) * shake, Math.sin(t * 53) * shake * 0.5)); cam.lookAt(a);
    people.forEach((q) => q.face(cam)); E.render(scene, cam, { ...look, focus: look.focus ?? cam.position.distanceTo(a), t });
  };
  // every person is always alive: eye darts, blinks, head sway, breathing. o = mood timeline result + pose overrides
  const act = (p, x, z, o = {}, y = 0) => {
    const al = A.alive(NOW, p.seed, o.alive ?? 1); p.group.visible = true;
    p.at(x, y + (o.hopY || 0), z).set({ look: al.look, blink: al.blink, tilt: al.tilt, bob: o.legs === 'walk' || o.legs === 'run' ? 0 : al.bob, ...o });
  };
  const big = (txt, x, y, s, k, col = '#FFFFFF', rot = 0) => { if (k <= 0) return; const sc = eob(clamp(k)); ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.font = `900 ${s}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = s * 0.2; ctx.strokeStyle = INK; ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
  const burst = (x, y, t, k, col = '255,230,150') => { if (k <= 0 || k >= 1) return; ctx.save(); ctx.strokeStyle = `rgba(${col},${1 - k})`; ctx.lineWidth = 12 * (1 - k); ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r0 = 40 + k * 120, r1 = r0 + 60 * (1 - k); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); } ctx.restore(); };
  const qmark = (x, y, k, t) => big('?', x, y + Math.sin(t * 6) * 6, 130, k, '#FFD15C', Math.sin(t * 4) * 0.15);
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });

  // ── sets ──
  const HALL = HN.jarHall(E), J = HALL.jar;
  const COURT = HN.court(E, { time: 'gold' });
  const WEST = HN.westLand(E);
  const ROAD = (() => { const scene = new THREE.Scene(); HN.majSky(scene, { top: '#2E3FA8', mid: '#E87A8E', horizon: '#FFC56A', sunDir: [0.0, 0.08, -1] });
    const sun = WD.sunlight(scene, E, { col: '#FFC890', i: 3.1, pos: [-8, 7, -10], target: [0, 0, 0], box: 14, sky: '#FFB8C8', ground: '#B07040', hemi: 1.15 });
    scene.fog = new THREE.Fog('#F0A89A', 40, 320);
    HN.peaks(scene, { z: -220, n: 11, seed: 21, col: '#8A6FC0', h: 85, spread: 560 }); HN.peaks(scene, { z: -140, n: 9, seed: 23, col: '#7A5FB0', h: 45, spread: 380 });
    const gt = WD.canvasTex('field', 512, 512, (c, w, h) => { c.fillStyle = '#E6B04E'; c.fillRect(0, 0, w, h); for (let k = 0; k < 2600; k++) { const r = (Math.sin(k * 12.9) * 43758.5) % 1; c.fillStyle = Math.abs(r) > 0.5 ? 'rgba(255,240,160,0.45)' : 'rgba(160,100,30,0.25)'; c.fillRect(Math.abs((Math.sin(k * 3.3) * 1e4) % 1) * w, Math.abs((Math.sin(k * 7.1) * 1e4) % 1) * h, 2, 8); } }, [40, 40]);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), WD.mat({ map: gt })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(5, 600), WD.mat({ color: '#C88A50' })); rd.rotation.x = -Math.PI / 2; rd.position.y = 0.02; rd.receiveShadow = true; scene.add(rd);
    const pal = HN.palace({ w: 18, d: 9, h: 5 }); pal.position.set(0, 0, -90); scene.add(pal);
    for (let i = 0; i < 14; i++) { const tr = HN.plumTree(1 + (i % 3) * 0.3); tr.position.set((i % 2 ? 1 : -1) * (6 + (i * 1.7) % 5), 0, -8 - i * 7); scene.add(tr); }
    return { scene, sun }; })();
  const zhang = make('zhang', 1), emp = make('emp', 2), rivA = make('rivA', 3), rivB = make('rivB', 4), mess = make('mess', 5), horse = new Horse({ col: '#B8743E', mane: '#3A2418', saddle: '#C8372E' });
  const all = [zhang, emp, rivA, rivB, mess];
  const hideAll = () => { all.forEach((p) => (p.group.visible = false)); horse.group.visible = false; J.update(NOW, {}); J.body.material.transparent = false; J.body.material.opacity = 1; };
  const lookAtX = (p, x) => [clamp((x - p.group.position.x) * 0.6, -1, 1), 0];

  // ── S01 · hook, part 1: a dragon's jaw opens, the ball drops, CLANG into the toad ──
  { const st = cut(0), dk = st + 0.45, hit = st + 1.05;
    add({ id: 'S01', at: st, shafts: 0.8, note: 'macro on one dragon head: jaw opens, ball falls, camera tilts down with it into the toad, CLANG burst', draw(lt, d, t, blit) {
      hideAll(); const k = clamp((t - dk) / (hit - dk)); J.update(t, { drop: 0, k: eio(k), glow: 0.4 + A.pop(t, hit) * 0.6 });
      const m = J.mouthAt[0](), q = J.toadAt[0](), b = J.balls[0].getWorldPosition(V3()); const lookP = mix(m, q, eio(k)); lookP.y = lerp(m.y, b.y, 0.85);
      shoot(HALL.scene, [], mix(V3(0.55, 1.75, 2.85), V3(0.5, 0.9, 3.0), eio(clamp(lt / 1.4))), lookP, { ...LK, fov: 34, aperture: 0.0012 }, A.jolt(t, hit, 0.4, 0.03), t);
      blit(); const [bx, by] = toScreen(q); burst(bx, by - 30, t, clamp((t - hit) / 0.45)); big('CLANG!', 540, 520, 150, A.pop(t, hit), '#FFD15C', -0.08);
    } });
    cue(dk, 'tock', { gain: 0.6 }); cue(dk + 0.1, 'whoosh', { gain: 0.5 }); cue(hit, 'ding', { gain: 1.0 }); cue(hit, 'thud', { gain: 0.5 }); }

  // ── S02 · hook, part 2: the courtiers jump; Zhang Heng grins; "HUNDREDS OF KM AWAY?" ──
  { const st = Wd('earthquake', 0) - 0.35, hd = Wd('hundreds', 0);
    add({ id: 'S02', at: st, trans: 'zoom', shafts: 0.6, note: 'wide on the jar: rivals hop in shock, Zhang Heng in front turns to camera with a proud grin; overlay pops on "hundreds"', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, zhang, rivA, rivB); J.update(t, { drop: 0, k: 1, glow: 0.6 });
      act(rivA, -1.15, 1.75, { ...A.face(t, [[0, 'neutral'], [st + 0.1, 'gasp'], [st + 1.0, 'shock']]), armL: A.keys(t, [[0, [12, 10]], [st + 0.1, [150, 40]]]), armR: A.keys(t, [[0, [12, 10]], [st + 0.12, [150, 40]]]), hopY: A.hop(t, st + 0.1, 0.35, 0.35) });
      act(rivB, 1.25, 1.65, { ...A.face(t, [[0, 'neutral'], [st + 0.15, 'shock'], [st + 1.1, 'worried']]), armR: A.keys(t, [[0, [12, 10]], [st + 0.15, [100, 80]]]), holdR: P2.fan, hopY: A.hop(t, st + 0.15, 0.35, 0.3) });
      act(zhang, 0.2, 2.6, { ...A.face(t, [[0, 'happy'], [st + 0.5, 'proud'], [hd, 'excited']]), armL: A.keys(t, [[0, [20, 10]], [st + 0.5, [60, -60]], [hd, [150, 20]]]), armR: A.keys(t, [[0, [20, 10]], [hd + 0.08, [150, 20]]]), tilt: -6 });
      shoot(HALL.scene, [zhang, rivA, rivB], mix(V3(0.3, 2.0, 8.8), V3(0.2, 1.8, 7.2), drift(clamp(lt / d))), V3(0.1, 1.6, 0.6), { ...LK, fov: 42 });
      blit(); big('HUNDREDS OF', 540, 300, 96, A.pop(t, hd), '#FFFFFF'); big('KM AWAY?!', 540, 410, 130, A.pop(t, hd + 0.12), '#FFD15C', -0.04);
    } });
    cue(st + 0.1, 'boing', { gain: 0.5 }); cue(Wd('hundreds', 0), 'pop', { gain: 0.6 }); cue(Wd('hundreds', 0) + 0.12, 'pop', { gain: 0.6 }); }

  // ── S03 · "Almost two thousand years ago in China," majestic crane up over the golden courtyard ──
  { const st = cut(1), ch = Wd('china', 1);
    add({ id: 'S03', at: st, trans: 'whip', shafts: 1, shaftX: CW * 0.5, shaftA: 0.05, note: 'crane rising from waving banners to the palace, misty peaks and a gold sunset; officials stroll across; "132 AD" pops', draw(lt, d, t, blit) {
      hideAll(); into(COURT.scene, rivA, rivB); COURT.update(t);
      const k = drift(clamp(lt / d)); const wa = clamp(lt / d);
      act(rivA, lerp(-5, -2.4, wa), 1.0, { mood: 'content', legs: 'walk', phase: t * 7, armR: [30, -60], holdR: P2.scroll });
      act(rivB, lerp(4.5, 2.2, wa), 0.4, { mood: 'happy', legs: 'walk', phase: t * 7 + 1, armL: [20, -40], holdL: P2.fan });
      shoot(COURT.scene, [rivA, rivB], mix(V3(0, 1.6, 12), V3(0, 7.5, 20), k), mix(V3(0, 2.6, 0), V3(0, 6, -14), k), { ...LK, fov: 46, aperture: 0 });
      blit(); big('132 AD', 540, 330, 150, A.pop(t, st + 0.25), '#FFD15C'); big('CHINA', 540, 470, 90, A.pop(t, ch), '#FFFFFF');
    } });
    cue(st, 'whoosh', { gain: 0.8 }); cue(st + 0.25, 'pop', { gain: 0.6 }); cue(Wd('china', 1), 'sparkle', { gain: 0.5 }); }

  // ── S04 · "the court astronomer Zhang Heng" he strides in under a starry scroll, bows, presents ──
  { const st = cut(2), zh = Wd('zhang', 2), bu = Wd('built', 2);
    add({ id: 'S04', at: st, trans: 'zoom', shafts: 0.7, note: 'Zhang Heng strides toward camera through the hall, stops on his name, bows, then flings both arms toward the jar behind him', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, zhang); J.update(t, { glow: 0.2 });
      const wk = clamp((t - st) / (zh - st + 0.1)), x = lerp(-2.2, -1.25, eio(wk)), z = lerp(0.8, 3.0, eio(wk)), walking = wk < 1;
      act(zhang, x, z, { ...A.face(t, [[0, 'content'], [zh, 'proud'], [zh + 0.5, 'smug'], [bu, 'excited']]), legs: walking ? 'walk' : 'stand', phase: t * 8,
        armL: A.keys(t, [[0, [20, -40]], [zh, [40, -90]], [bu - 0.1, [150, 30]]]), armR: A.keys(t, [[0, [20, -40]], [zh, [40, -90]], [bu - 0.05, [120, 20]]]), holdR: t < bu - 0.1 ? P2.scroll : undefined, lean: A.keys(t, [[0, 0], [zh + 0.05, 10], [zh + 0.4, 0]]) });
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [zhang], mix(V3(-1.0, 1.7, 7.2), V3(-1.1, 1.65, 5.6), k), mix(V3(-1.7, 1.4, 2.4), V3(-1.0, 1.6, 1.2), k));
      blit(); { const [hx, hy] = headXY(zhang, 1.95); big('ZHANG HENG', 540, 300, 104, A.pop(t, zh), '#FFD15C'); big('court astronomer', 540, 400, 54, A.pop(t, zh + 0.15), '#FFFFFF'); FX.sparkle(hx + 120, hy - 60, t, A.pop(t, zh)); }
    } });
    cue(st, 'whoosh', { gain: 0.6 }); cue(Wd('zhang', 2), 'ding', { gain: 0.6 }); }

  // ── S05 · "built a bronze jar nearly two meters wide." the jar rises into view; he measures it with his arms ──
  { const st = Wd('built', 2) - 0.05, tw = Wd('two', 2), wi = Wd('wide', 2);
    add({ id: 'S05', at: st, trans: 'whip', shafts: 0.9, shaftX: CW * 0.35, note: 'low crane rising up the glowing jar; Zhang Heng beside it spreads his arms, a width arrow snaps across "2 METERS"', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, zhang); J.update(t, { glow: 0.3 + 0.4 * A.pop(t, st + 0.2) });
      act(zhang, 1.35, 1.85, { ...A.face(t, [[0, 'excited'], [tw, 'proud'], [wi + 0.2, 'laugh']]), armL: A.keys(t, [[0, [30, 10]], [tw - 0.1, [100, 0]]]), armR: A.keys(t, [[0, [30, 10]], [tw - 0.1, [100, 0]]]), tilt: 4 });
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [zhang], mix(V3(0.5, 0.7, 8.0), V3(0.6, 2.6, 8.8), k), mix(V3(0.35, 1.0, 0.4), V3(0.4, 1.7, 0.4), k), { ...LK, fov: 48 });
      blit(); const ak = A.pop(t, tw, 0.4); if (ak > 0) { const [lx, ly] = toScreen(V3(-0.98, 1.2, 0.95)), [rx, ry] = toScreen(V3(0.98, 1.2, 0.95)); const cx = (lx + rx) / 2, hw = (rx - lx) / 2 * Math.min(1, ak);
        ctx.save(); ctx.strokeStyle = '#FFD15C'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - hw, ly); ctx.lineTo(cx + hw, ry); ctx.stroke(); [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(cx + s * hw, ly); ctx.lineTo(cx + s * (hw - 30), ly - 24); ctx.moveTo(cx + s * hw, ly); ctx.lineTo(cx + s * (hw - 30), ly + 24); ctx.stroke(); }); ctx.restore();
        big('~2 METERS', cx, ly - 90, 96, ak, '#FFFFFF'); }
    } });
    cue(Wd('two', 2), 'zip', { gain: 0.6 }); cue(Wd('wide', 2), 'pop', { gain: 0.5 }); }

  // ── S06 · "Eight dragons circled the top, each holding a bronze ball" an orbit around the top; a counter 1..8 ──
  { const st = cut(3), ei = Wd('eight', 3), ba = Wd('ball', 3);
    add({ id: 'S06', at: st, trans: 'zoom', note: 'fast orbit round the jar top past each dragon head; a counter ticks 1-8 as each passes; on "ball" every ball sparkles', draw(lt, d, t, blit) {
      hideAll(); J.update(t, { glow: 0.5 });
      const a = lerp(-0.4, Math.PI * 1.25, eio(clamp(lt / d))), r = 3.4;
      shoot(HALL.scene, [], V3(Math.sin(a) * r, 2.6, Math.cos(a) * r), V3(0, 2.05, 0), { ...LK, fov: 44 });
      blit(); const n = Math.min(8, 1 + Math.floor(clamp((t - ei) / (ba - ei)) * 8)); big(`${n}`, 540, 330, 200, A.pop(t, ei), '#FFD15C'); big('DRAGONS', 540, 470, 80, A.pop(t, ei + 0.1), '#FFFFFF');
      if (t > ba) J.balls.forEach((b, i) => { const p = b.getWorldPosition(V3()); const v = p.clone().project(cam); if (v.z < 1 && Math.abs(v.x) < 1) { const [sx, sy] = toScreen(p); FX.sparkle(sx, sy, t + i, clamp((t - ba - i * 0.04) / 0.2), 40); } });
    } });
    cue(st, 'whoosh', { gain: 0.7 }); for (let i = 0; i < 8; i++) cue(Wd('eight', 3) + i * (Wd('ball', 3) - Wd('eight', 3)) / 8, 'tock', { gain: 0.35 }); cue(Wd('ball', 3), 'sparkle', { gain: 0.7 }); }

  // ── S07 · "Below every dragon sat a toad, mouth wide open." floor-level push; a courtier peers in, gasps ──
  { const st = cut(4), to = Wd('toad', 4), op = Wd('open', 4);
    add({ id: 'S07', at: st, trans: 'whip', whipDir: -1, note: 'camera skims the floor past the toads; rival B kneels and peers into a toad mouth, gasps on "open", fan flutters', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, rivB); J.update(t, { glow: 0.3 });
      act(rivB, 1.5, 1.65, { ...A.face(t, [[0, 'skeptic'], [to, 'neutral'], [op, 'gasp']]), legs: 'sit', armR: A.keys(t, [[0, [40, 80]], [op, [150, 60]]]), holdR: P2.fan, tilt: A.keys(t, [[0, -12], [op, 6]]), eyeS: 1.1 }, -0.35);
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [rivB], mix(V3(-0.4, 0.6, 4.0), V3(1.0, 0.8, 4.0), k), mix(V3(0.3, 0.45, 1.3), V3(1.25, 0.65, 1.4), k), { ...LK, fov: 42, aperture: 0.0012 });
      blit(); big('TOADS', 540, 330, 130, A.pop(t, to), '#7FE0B0');
    } });
    cue(Wd('toad', 4), 'boing', { gain: 0.5 }); cue(Wd('open', 4), 'pop', { gain: 0.5 }); }

  // ── S08 · "When the ground shook, a weight inside swung, and one dragon dropped its ball." cut-away: the pendulum ──
  { const st = cut(5), sh = Wd('shook', 5), sw = Wd('swung', 5), dr = Wd('dropped', 5);
    add({ id: 'S08', at: st, trans: 'zoom', note: 'the bronze goes see-through: the floor shakes on "shook", the weight inside swings on "swung" and knocks one dragon, whose jaw drops the ball', draw(lt, d, t, blit) {
      hideAll(); const shake = clamp((t - sh) / 0.2) * (1 - clamp((t - dr - 0.3) / 0.5));
      const swing = t < sw ? Math.sin(t * 30) * 0.02 * shake : Math.sin((t - sw) * 6) * 0.35 * Math.exp(-(t - sw) * 0.8);
      J.update(t, { inside: true, swing, shake, drop: 2, k: eio(clamp((t - dr) / 0.6)), glow: 0.3 });
      J.body.material.transparent = true; J.body.material.opacity = 0.32; J.body.material.depthWrite = false;
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [], mix(V3(-3.6, 2.0, 4.2), V3(-2.6, 1.8, 3.6), k), V3(0, 1.5, 0), { ...LK, fov: 44, style: { ink: true, cel: true } }, 0.045 * shake, t);
      blit(); big('SHAKE!', 540, 330, 130, A.pop(t, sh) * (1 - clamp((t - sw) / 0.2)), '#FF8A5C', Math.sin(t * 40) * 0.05);
    } });
    cue(Wd('shook', 5), 'chug', { dur: 1.2, gain: 0.6 }); cue(Wd('swung', 5), 'whoosh', { gain: 0.6 }); cue(Wd('dropped', 5), 'tock', { gain: 0.7 }); }

  // ── S09 · "Clang! Right into a toad!" hard cut, extreme close, big CLANG ──
  { const st = cut(6), cl = Wd('clang', 6), to = Wd('toad', 6);
    add({ id: 'S09', at: st, cut: true, note: 'extreme close on the toad mouth: the ball lands on "Clang", flash, rings and a camera jolt', draw(lt, d, t, blit) {
      hideAll(); J.update(t, { drop: 2, k: clamp(0.75 + (t - st) / 0.25 * 0.25), glow: 0.4 + A.pop(t, cl) });
      const q = J.toadAt[2](), qq = q.clone(); qq.y += 0.1;
      shoot(HALL.scene, [], q.clone().add(V3(0.9, 0.7, 1.4)).add(V3(0, 0, -0.3 * drift(clamp(lt / d)))), qq, { ...LK, fov: 38, bloom: 0.7 }, A.jolt(t, cl, 0.5, 0.05), t);
      blit(); const [bx, by] = toScreen(q); burst(bx, by, t, clamp((t - cl) / 0.4)); burst(bx, by, t, clamp((t - cl - 0.15) / 0.4), '255,255,255');
      big('CLANG!', 540, 420, 190, A.pop(t, cl), '#FFD15C', -0.1); big('RIGHT IN!', 540, 600, 90, A.pop(t, to), '#FFFFFF', 0.05);
    } });
    cue(Wd('clang', 6), 'ding', { gain: 1.0 }); cue(Wd('clang', 6), 'slam', { gain: 0.4 }); }

  // ── S10 · "And that told you where the earthquake came from." top-down: the empty dragon becomes a compass arrow ──
  { const st = cut(7), wh = Wd('where', 7);
    add({ id: 'S10', at: st, trans: 'zoom', note: 'rising to a top view of the jar; a glowing arrow shoots out from the empty dragon across the floor; compass letters pop round the rim', draw(lt, d, t, blit) {
      hideAll(); J.update(t, { drop: 2, k: 1, glow: 0.5 });
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [], mix(V3(0.5, 5.0, 5.0), V3(0.2, 8.5, 1.2), k), V3(0, 0.6, 0), { ...LK, fov: 46, aperture: 0 });
      blit(); const c = toScreen(V3(0, 2.0, 0)), a = 2 / 8 * Math.PI * 2, tip = toScreen(V3(Math.sin(a) * 5.5, 0.4, Math.cos(a) * 5.5)), ak = eo(clamp((t - wh) / 0.5));
      if (ak > 0) { ctx.save(); ctx.strokeStyle = '#FFD15C'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.shadowColor = '#FFB040'; ctx.shadowBlur = 30; const ex = lerp(c[0], tip[0], ak), ey = lerp(c[1], tip[1], ak); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(ex, ey); ctx.stroke();
        const an = Math.atan2(ey - c[1], ex - c[0]); ctx.fillStyle = '#FFD15C'; ctx.beginPath(); ctx.moveTo(ex + Math.cos(an) * 50, ey + Math.sin(an) * 50); ctx.lineTo(ex + Math.cos(an + 2.4) * 50, ey + Math.sin(an + 2.4) * 50); ctx.lineTo(ex + Math.cos(an - 2.4) * 50, ey + Math.sin(an - 2.4) * 50); ctx.fill(); ctx.restore(); }
      ['N', 'E', 'S', 'W'].forEach((L_, i) => { const aa = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][i], p = toScreen(V3(Math.sin(aa) * 2.6, 0.5, Math.cos(aa) * 2.6)); big(L_, p[0], p[1], 70, A.pop(t, st + 0.15 + i * 0.08), '#FFFFFF'); });
    } });
    cue(Wd('where', 7), 'zip', { gain: 0.7 }); }

  // ── S11 · "Then one day, a ball fell, and nobody felt a thing." the court chats; a clang; everyone freezes, checks the floor ──
  { const st = cut(8), fe = Wd('fell', 8), no = Wd('nobody', 8);
    add({ id: 'S11', at: st, trans: 'whip', shafts: 0.6, note: 'wide on the hall: rivals chatting with fans, the emperor on a stool; a ball drops on "fell", everyone snaps round, then looks at the still floor, shrugs on "nobody"', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, rivA, rivB, emp); J.update(t, { drop: 6, k: eio(clamp((t - fe + 0.35) / 0.35)), glow: 0.3 + A.pop(t, fe) * 0.4 });
      const turn = (p, x) => (t > fe ? lookAtX(p, 0) : [0.6, 0]);
      act(rivA, -1.3, 2.6, { ...A.face(t, [[0, 'laugh'], [fe, 'shock'], [no, 'skeptic']]), armL: A.keys(t, [[0, [60, -60]], [fe, [150, 40]], [no + 0.2, [70, -70]]]), armR: A.keys(t, [[0, [12, 10]], [no + 0.2, [70, -70]]]), look: t > no ? [0, 1] : turn(rivA, 0), hopY: A.hop(t, fe, 0.3, 0.25) });
      act(rivB, -0.25, 3.4, { ...A.face(t, [[0, 'happy'], [fe + 0.05, 'gasp'], [no + 0.1, 'skeptic']]), armR: A.keys(t, [[0, [60, 80]], [fe, [150, 60]]]), holdR: P2.fan, look: t > no ? [0, 1] : [-0.6, 0], hopY: A.hop(t, fe + 0.05, 0.3, 0.25) });
      act(emp, 1.3, 2.8, { ...A.face(t, [[0, 'content'], [fe + 0.1, 'shock'], [no + 0.2, 'skeptic']]), armL: A.keys(t, [[0, [20, 10]], [no + 0.25, [60, -80]]]), look: t > no ? [-0.3, 0.8] : [-0.7, 0] });
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [rivA, rivB, emp], mix(V3(0.1, 2.1, 9.6), V3(0.1, 1.9, 8.4), k), V3(0.1, 1.5, 1.0), { ...LK, fov: 46 }, 0, t);
      blit(); [rivA, emp].forEach((p, i) => qmark(...headXY(p, 2.15).map((v, j) => v + (j ? -40 : 30)), A.pop(t, no + 0.15 + i * 0.1), t));
      big('NO SHAKING?', 540, 300, 100, A.pop(t, no + 0.2), '#FFFFFF');
    } });
    cue(Wd('fell', 8), 'ding', { gain: 0.8 }); cue(Wd('nobody', 8), 'boing', { gain: 0.4 }); }

  // ── S12 · "His rivals said the jar was broken." the rivals laugh and point; Zhang sweats ──
  { const st = cut(9), sa = Wd('said', 9), br = Wd('broken', 9);
    add({ id: 'S12', at: st, trans: 'zoom', note: 'over-the-shoulder of a worried Zhang Heng: the two rivals point and double over laughing on "broken"; a BROKEN? stamp slams on', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, zhang, rivA, rivB); J.update(t, { drop: 6, k: 1 });
      act(rivA, -0.7, 0.6 + 2.2, { ...A.face(t, [[0, 'smug'], [sa, 'scheme'], [br, 'laugh']]), armR: A.keys(t, [[0, [20, 10]], [sa, [100, -10]]]), armL: A.keys(t, [[0, [12, 10]], [br, [60, -90]]]), lean: A.keys(t, [[0, 0], [br, -10]]) , look: [1, 0] });
      act(rivB, 0.55, 0.3 + 2.2, { ...A.face(t, [[0, 'skeptic'], [sa + 0.1, 'smug'], [br + 0.05, 'laugh']]), armL: A.keys(t, [[0, [40, 80]], [br, [150, 60]]]), holdL: P2.fan, lean: A.keys(t, [[0, 0], [br, 10]]) });
      act(zhang, 1.5, 4.9, { ...A.face(t, [[0, 'neutral'], [sa, 'worried'], [br + 0.2, 'strain']]), sweat: 1, look: [-0.6, 0] });
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [zhang, rivA, rivB], mix(V3(2.4, 1.85, 7.6), V3(2.2, 1.85, 7.0), k), V3(-0.1, 1.55, 2.5), { ...LK, fov: 40 });
      blit(); { const [hx, hy] = headXY(zhang, 1.4); FX.sweat(hx - 110, hy - 40, 1); }
      big('BROKEN!', 540, 360, 160, A.pop(t, br), '#FF6A5C', -0.12);
    } });
    cue(Wd('broken', 9), 'slam', { gain: 0.6 }); cue(Wd('said', 9), 'pop', { gain: 0.3 }); }

  // ── S13 · "But days later, a messenger rushed into the capital." a horseman gallops down the golden road ──
  { const st = cut(10), me = Wd('messenger', 10);
    add({ id: 'S13', at: st, trans: 'whip', motes: 46, moteCol: '255,214,150', shafts: 0.8, shaftX: CW * 0.5, shaftA: 0.02, note: 'tracking shot beside a galloping messenger on the golden road toward the far palace; dust flies; "DAYS LATER"', draw(lt, d, t, blit) {
      hideAll(); into(ROAD.scene, mess); if (horse.group.parent !== ROAD.scene) ROAD.scene.add(horse.group);
      const z = lerp(10, -18, clamp(lt / d)); horse.group.visible = true; horse.at(0, 0, z); horse.group.rotation.y = 0; horse.set({ phase: t * 13, gallop: 1, head: -10 });
      const sp = horse.saddle(); act(mess, sp.x, sp.z + 0.05, { ...A.face(t, [[0, 'strain'], [me, 'worried']]), legs: 'sit', armL: [70, -50], armR: [110, -30], holdR: P2.scroll, lean: -14, alive: 0.5 }, sp.y - 0.8);
      shoot(ROAD.scene, [mess], V3(5.6, 2.0, z + 5.2), V3(0, 1.5, z - 0.6), { ...LK, fov: 44, aperture: 0 }, 0.012, t);
      horse.face(cam, -1);
      blit(); big('DAYS LATER', 540, 320, 120, A.pop(t, st + 0.2), '#FFD15C');
      for (let i = 0; i < 6; i++) { const ph = (t * 3 + i / 6) % 1, [dx, dy] = toScreen(V3(-0.6 + ph * 0.5, 0.15, z + 1.2 + ph * 3)); ctx.save(); ctx.globalAlpha = (1 - ph) * 0.6; ctx.fillStyle = '#E8C080'; ctx.beginPath(); ctx.arc(dx, dy, 40 + ph * 90, 0, 7); ctx.fill(); ctx.restore(); }
    } });
    cue(st, 'whoosh', { gain: 0.8 }); for (let k = 0; k < 9; k++) cue(L(10) + k * 0.28, 'tock', { gain: 0.3 }); }

  // ── S14 · "A big earthquake had hit the far west," the messenger bursts in and kneels; the court gasps ──
  { const st = cut(11), bi = Wd('big', 11), we = Wd('west', 11);
    add({ id: 'S14', at: st, trans: 'zoom', note: 'the messenger skids in and kneels holding out the scroll; behind him the emperor and rivals go from skeptic to gasp on "big"', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, mess, emp, rivA, rivB); J.update(t, { drop: 6, k: 1, glow: 0.3 });
      const kn = clamp(lt / 0.35);
      act(mess, lerp(-2.4, -0.85, eo(kn)), 2.9, { ...A.face(t, [[0, 'strain'], [st + 0.4, 'worried']]), legs: kn < 1 ? 'run' : 'sit', phase: t * 14, armL: [100, -30], armR: [100, -30], holdR: P2.openScroll }, kn < 1 ? 0 : -0.4);
      act(emp, 0.6, 1.9, { ...A.face(t, [[0, 'skeptic'], [bi, 'gasp'], [we + 0.3, 'shock']]), armL: A.keys(t, [[0, [20, 10]], [bi, [130, 60]]]), eyeS: 1.1 });
      act(rivA, 1.05, 1.6, { ...A.face(t, [[0, 'smug'], [bi + 0.1, 'shock']]), armR: A.keys(t, [[0, [12, 10]], [bi + 0.1, [150, 30]]]) });
      act(rivB, -0.4, 1.4, { ...A.face(t, [[0, 'smug'], [bi + 0.15, 'gasp']]), armR: A.keys(t, [[0, [40, 80]], [bi + 0.15, [150, 60]]]), holdR: P2.fan });
      const k = drift(clamp(lt / d));
      shoot(HALL.scene, [mess, emp, rivA, rivB], mix(V3(-1.2, 1.5, 9.0), V3(-0.8, 1.6, 8.0), k), V3(-0.1, 1.3, 2.4), { ...LK, fov: 44 }, A.jolt(t, st + 0.35, 0.3, 0.02), t);
      blit(); big('EARTHQUAKE!', 540, 330, 130, A.pop(t, Wd('earthquake', 11)), '#FF8A5C', 0.04);
    } });
    cue(st + 0.35, 'thud', { gain: 0.6 }); cue(Wd('big', 11), 'boing', { gain: 0.5 }); }

  // ── S15 · "hundreds of kilometers away!" the far-west village shakes; a distance line streaks back to the jar ──
  { const st = Wd('hundreds', 11) - 0.1;
    add({ id: 'S15', at: st, trans: 'whip', motes: 60, moteCol: '240,200,150', note: 'far-west village at sunset: houses rock and hop, dust rolls; the camera shakes, then a fast pull up and away', draw(lt, d, t, blit) {
      hideAll(); WEST.houses.forEach((h, i) => { h.rotation.z = Math.sin(t * 30 + i) * 0.05; h.position.y = Math.abs(Math.sin(t * 22 + i * 2)) * 0.12; });
      const k = drift(clamp(lt / d));
      shoot(WEST.scene, [], mix(V3(1.0, 2.6, 8.0), V3(2.0, 8.0, 16.0), k), V3(0.5, 1.0, -9), { ...LK, fov: 46, aperture: 0 }, 0.08 * (1 - k * 0.6), t);
      blit(); big('HUNDREDS OF KM', 540, 320, 96, A.pop(t, st + 0.1), '#FFFFFF'); big('AWAY!', 540, 440, 150, A.pop(t, st + 0.3), '#FFD15C', -0.05);
    } });
    cue(st, 'chug', { dur: 1.6, gain: 0.8 }); cue(st + 0.2, 'slam', { gain: 0.5 }); }

  // ── S16 · loop: "That's how a jar felt an earthquake hundreds of kilometers away." Zhang triumphant; pull back to the hall ──
  { const st = cut(12), ja = Wd('jar', 12), hu = Wd('hundreds', 12);
    add({ id: 'S16', at: st, trans: 'zoom', shafts: 1, shaftX: CW * 0.4, note: 'Zhang Heng beams beside the jar, the emperor laughs and claps him on the shoulder, rivals sulk; a long rising pull-back to the glowing jar in the great hall', draw(lt, d, t, blit) {
      hideAll(); into(HALL.scene, zhang, emp, rivA, rivB); J.update(t, { drop: 6, k: 1, glow: 0.6 + 0.3 * Math.sin(t * 3) });
      act(zhang, -0.7, 2.7, { ...A.face(t, [[0, 'proud'], [ja, 'excited'], [hu + 0.4, 'laugh']]), armL: A.keys(t, [[0, [30, 10]], [ja, [150, 20]]]), armR: A.keys(t, [[0, [20, 10]], [ja + 0.1, [60, -80]]]), hopY: A.hop(t, ja, 0.4, 0.2) });
      act(emp, 0.45, 2.35, { ...A.face(t, [[0, 'happy'], [ja + 0.2, 'laugh']]), armL: A.keys(t, [[0, [20, 10]], [ja + 0.2, [80, 20]]]) });
      act(rivA, 1.15, 1.6, { ...A.face(t, [[0, 'shock'], [ja + 0.4, 'sad']]), sweat: 1 }); act(rivB, -1.25, 1.5, { ...A.face(t, [[0, 'gasp'], [ja + 0.5, 'worried']]), armR: [40, 80], holdR: P2.fan });
      const k = eio(clamp((lt - 0.6) / (d - 0.6)));
      shoot(HALL.scene, [zhang, emp, rivA, rivB], mix(V3(0.2, 1.8, 7.4), V3(0.4, 6.5, 15), k), mix(V3(0.1, 1.6, 2.2), V3(0, 2.2, -1), k), { ...LK, fov: lerp(42, 50, k), aperture: k > 0.1 ? 0 : 0.0007 });
      blit(); big('132 AD', 540, 320, 110, A.pop(t, hu) , '#FFD15C'); big('EARTHQUAKE DETECTOR', 540, 430, 64, A.pop(t, hu + 0.15), '#FFFFFF');
    } });
    cue(st, 'whoosh', { gain: 0.8 }); cue(Wd('jar', 12), 'sparkle', { gain: 0.6 }); cue(Wd('hundreds', 12), 'pop', { gain: 0.5 }); }

  return { shots: S, cues: CUES };
}
