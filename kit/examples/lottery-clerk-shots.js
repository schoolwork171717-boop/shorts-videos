// THE STORE CLERK WHO KEPT WINNING THE LOTTERY — kit v8: long flying takes, bodies that never stop, bright colour,
// in-world screens, papers and boards instead of pop-up text, dissolves for time and place skips.
import * as THREE from 'three';
import { ctx, clamp, lerp, eo, eio, W as CW, H as CH } from './core/lib.js';
import { L, Le, Wd, T } from './core/timing.js';
import { camera } from './core/engine.js';
import * as ST from './core/store.js';
import * as EW from './core/emuwar.js';
import * as A from './core/act.js';
import { Toon, INK, PROPS } from './core/toon.js';
import * as FX from './core/fx.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
let NOW = 0;
const LOOK = {
  oldman: { body: '#7A8AB8', pattern: 'vest', patCol: '#5A6A98', hat: 'cap', hatCol: '#4A5A7A', hair: '#E8E8EE', extra: ['glasses', 'mustache'], mustacheCol: '#E4E4EA', neck: 'collar' },
  clerk: { body: '#F2C230', pattern: 'apron', patCol: '#2E8A5A', hat: 'bun', hatCol: '#7A4A2A', extra: ['blush'], neck: 'collar' },
  boss: { body: '#2E3A5A', pattern: 'jacket', patCol: '#222C46', neck: 'tie', neckCol: '#D8343F', hair: '#3A2A22', extra: ['glasses'], bw: 120 },
  law1: { body: '#5A5A64', pattern: 'jacket', patCol: '#44444C', neck: 'tie', neckCol: '#3C6FB6', hat: 'bowler', hatCol: '#2A2830', extra: ['mustache'], mustacheCol: '#3A2A22' },
  law2: { body: '#4A4A70', pattern: 'jacket', patCol: '#38385A', neck: 'tie', neckCol: '#F2C230', hair: '#C8783A', extra: ['freckles'] },
  judge: { body: '#2A2830', robe: true, robeCol: '#2A2830', neck: 'collar', hair: '#F4F4F8', extra: ['glasses', 'beard'], beardCol: '#E8E8EE' },
  reporter: { body: '#D8343F', pattern: 'jacket', patCol: '#A82A30', neck: 'tie', neckCol: '#F4EFE4', hair: '#5A3A22', extra: ['blush'] },
  camera: { body: '#3C6FB6', pattern: 'plain', hat: 'cap', hatCol: '#2A2830', extra: ['beard'], beardCol: '#6A4A30' },
  prof: { body: '#F4F4F8', pattern: 'jacket', patCol: '#D8D8E0', neck: 'bowtie', neckCol: '#D8343F', hair: '#A8A8B4', extra: ['glasses', 'goatee'] },
};
// hand props (named functions keep the cut-out cache key stable)
function ticketProp(g, x, y) { PROPS.ticket(g, x, y); }
function micProp(g, x, y) { g.save(); g.translate(x, y); g.rotate(-0.3); g.fillStyle = '#2A2830'; g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.roundRect(-9, -90, 18, 90, 5); g.fill(); g.stroke(); g.fillStyle = '#B8B8C4'; g.beginPath(); g.arc(0, -104, 24, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#D8343F'; g.fillRect(-12, -70, 24, 18); g.restore(); }
function tvCamProp(g, x, y) { g.save(); g.translate(x - 40, y - 150); g.fillStyle = '#3A3A44'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.roundRect(-60, -50, 150, 90, 10); g.fill(); g.stroke(); g.fillStyle = '#2A2830'; g.beginPath(); g.roundRect(88, -30, 50, 50, 6); g.fill(); g.stroke(); g.fillStyle = '#8FC8F0'; g.beginPath(); g.arc(120, -5, 16, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#D8343F'; g.beginPath(); g.arc(-40, -32, 8, 0, 7); g.fill(); g.restore(); }
function chalkProp(g, x, y) { g.fillStyle = '#FFFFFF'; g.strokeStyle = INK; g.lineWidth = 4; g.save(); g.translate(x, y - 20); g.rotate(-0.6); g.beginPath(); g.roundRect(-8, -30, 16, 40, 4); g.fill(); g.stroke(); g.restore(); }

export function buildShots(E) {
  const S = [], CUES = [], cue = (t, type, o = {}) => CUES.push({ t: +Math.max(0, t).toFixed(3), type, ...o });
  const add = (o) => { const f = o.draw; o.draw = (lt, d, t, blit) => { NOW = t; f(lt, d, t, blit); FX.motes(t, { n: o.motes ?? 14, col: '255,244,215', size: 0.9 }); }; S.push(o); return o; };
  const cam = camera(42);
  const LK = { bloom: 0.16, bloomThreshold: 0.97, aperture: 0.0004, maxblur: 0.004 };
  const shoot = (scene, c, look = LK, t = NOW) => {
    cam.fov = c.fov; cam.position.set(...c.pos);
    cam.position.add(V3(Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3 + 1) * 0.025, Math.sin(t * 0.7 + 2) * 0.025));
    cam.lookAt(V3(...c.look)); cam.rotateZ(Math.sin(t * 0.6 + 0.5) * 0.008); cam.updateProjectionMatrix();
    all.forEach((q) => q.face(cam)); E.render(scene, cam, { ...look, focus: cam.position.distanceTo(V3(...c.look)), t });
  };
  const act = (p, x, z, o = {}, y = 0, k = 1) => {
    const al = A.alive(NOW, p.seed, 1), pf = A.perform(NOW, p.seed, o.energy ?? k, { talk: o.talk ?? 1 });
    p.group.visible = true; p.at(x + (o.still ? 0 : pf.dx) + (o.dx || 0), y + (o.hopY || 0), z);
    const st = { look: al.look, blink: al.blink, ...pf, tilt: pf.tilt + al.tilt, ...o }; delete st.dx; delete st.hopY; delete st.energy; delete st.still;
    Object.keys(st).forEach((k2) => st[k2] === undefined && delete st[k2]);
    if (st.steam) st.steamT = NOW; p.set(st); A.applySquash(p, st.squash || 0);
  };
  const into = (scene, ...ps) => ps.forEach((p) => { if (p.group.parent !== scene) scene.add(p.group); });

  // ── sets ──
  const SHOP = ST.cornerStore(E);
  const LOT = ST.office(E, { sign: 'LOTTERY CORP.' });
  const UNI = ST.office(E, { sign: 'UNIVERSITY', wall: '#E8E0F4' });
  const COURT = EW.parliament(E, { sign: 'COURT', carpet: '#A8583E', leather: '#8A3A3A', wall: '#F4E6CC' });
  const paper = EW.newspaper(['CLERK', 'WINS', '$250,000']); SHOP.scene.add(paper);
  const cal = ST.calendar(); cal.position.set(-2.1, 2.05, -2.2); COURT.scene.add(cal);
  const check = ST.bigCheck('$200,000', 'PAY TO: THE OLD MAN'); COURT.scene.add(check);
  const checkB = ST.bigCheck('$200,000', 'PAID TO THE OLD MAN'); LOT.scene.add(checkB);
  const bills = ST.billStack('LAWYER BILLS', '$629,600', 22); LOT.scene.add(bills);
  const brd = ST.board(2.6, 1.6); brd.position.set(0.0, 0.1, -3.1); UNI.scene.add(brd);
  const coin = ST.coin(); SHOP.scene.add(coin);
  const notes = [0, 1].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#F2C230'; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.ellipse(48, 92, 22, 16, -0.4, 0, 7); g.fill(); g.stroke(); g.fillRect(64, 20, 8, 72); g.strokeRect(64, 20, 8, 72); g.beginPath(); g.moveTo(72, 20); g.quadraticCurveTo(104, 34, 98, 62); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, depthWrite: false, toneMapped: false })); s.scale.set(0.28, 0.28, 1); s.visible = false; SHOP.scene.add(s); return s; });

  // ── cast ──
  const mk = (k, seed, h = 1.75) => { const p = new Toon({ ...LOOK[k], extra: [...(LOOK[k].extra || [])] }, { res: 2, height: h }); p.seed = seed; return p; };
  const oldman = mk('oldman', 1, 1.68), clerk = mk('clerk', 2, 1.7), boss = mk('boss', 3), law1 = mk('law1', 4), law2 = mk('law2', 5), judge = mk('judge', 6), reporter = mk('reporter', 7), cammo = mk('camera', 8), prof = mk('prof', 9);
  const all = [oldman, clerk, boss, law1, law2, judge, reporter, cammo, prof];
  const hideAll = () => { all.forEach((p) => (p.group.visible = false)); paper.visible = false; coin.visible = false; notes.forEach((n) => (n.visible = false)); SHOP.checker.group.visible = false; };
  const idleScreen = () => SHOP.terminal.setScreen([['CHECK', '#FFFFFF', 40], ['TICKET', '#8FC8F0', 34]], '#1E3A5E');

  // ── S1 · lines 0-2: the cold open, then the replay at the counter
  { const st = 0, qu = Wd('quarter', 0), to = Wd('told', 0), fr = Wd('free', 0), pl = L(1), wh = Wd('checked', 1), ji = Wd('jingled', 1), sm = L(2), ha = Wd('handed', 2), ke = Wd('kept', 2), end = L(3);
    add({ id: 'S1', at: st, note: 'cold open on the terminal screen (WINNER $250,000) facing the clerk, swing round the counter to the clerk telling the old man "free ticket"; the replay: the machine jingles twice, she hands him a free ticket and pockets the real one', draw(lt, d, t, blit) {
      hideAll(); into(SHOP.scene, oldman, clerk);
      SHOP.terminal.pivot.rotation.y = Math.PI;
      const win = t < to + 0.2 || (t > wh && t < sm + 0.4);
      if (win) SHOP.terminal.setScreen([['WINNER!', '#F2C230', 54], ['$250,000', '#FFFFFF', 48]], Math.floor(t * 6) % 2 ? '#2E8A4A' : '#24724A'); else idleScreen();
      act(clerk, 0.5, -1.75, { ...A.face(t, [[st, 'gasp'], [to - 0.3, 'scheme'], [fr, 'happy'], [pl, 'content'], [ji, 'gasp'], [sm, 'happy'], [ke, 'sly']]),
        armR: A.arm(t, [[st, [30, 30]], [fr - 0.2, [80, 40]], [fr + 0.6, [20, 20]], [wh - 0.2, [70, 50]], [ha - 0.1, [85, 20]], [ha + 0.5, [20, 20]]]), holdR: (t > fr - 0.2 && t < fr + 0.6) || (t > ha - 0.1 && t < ha + 0.4) ? ticketProp : undefined,
        armL: A.arm(t, [[st, [20, 20]], [ke - 0.2, [60, 80]], [ke + 0.5, [15, 30]]]), holdL: t > ke - 0.2 && t < ke + 0.5 ? ticketProp : undefined, talk: t > to && t < fr + 0.5 ? 1 : 0.3 });
      act(oldman, 0.25, 0.15, { ...A.face(t, [[st, 'content'], [fr, 'happy'], [pl, 'content'], [ji, 'gasp'], [sm, 'happy'], [ke + 0.3, 'content']]), talk: 0.2,
        armR: A.arm(t, [[st, [70, 40]], [fr + 0.3, [20, 20]], [wh - 0.3, [75, 35]], [wh + 0.3, [20, 20]], [ha + 0.1, [70, 40]]]), holdR: (t < fr + 0.3) || (t > wh - 0.3 && t < wh + 0.3) || t > ha + 0.1 ? ticketProp : undefined,
        ...A.react('cheer', t, fr + 0.4, 0.6), ...A.react('shrug', t, ha + 0.6, 0.9) });
      notes.forEach((n, i) => { const t0 = ji + i * 0.35, k = clamp((t - t0) / 0.9); n.visible = t > t0 && k < 1; n.position.set(1.4 + (i ? 0.25 : -0.2), 1.6 + k * 0.6, -1.05); n.material.opacity = 1 - k; });
      const c = A.camPath(t, [
        [st, [1.75, 1.45, -1.75], [1.4, 1.32, -1.05], 34],
        [qu + 0.4, [2.2, 1.75, -2.6], [1.1, 1.4, -1.1], 42],
        [to + 0.2, [2.6, 1.8, 2.6], [0.5, 1.35, -0.8], 40],
        [pl + 0.4, [1.0, 1.55, 2.4], [0.25, 1.35, 0.1], 38],
        [ji, [1.5, 1.75, 1.8], [1.0, 1.35, -1.2], 40],
        [sm + 0.5, [1.8, 1.7, 2.4], [0.5, 1.35, -0.8], 40],
        [end, [0.9, 1.62, 1.0], [0.5, 1.5, -1.7], 38],
      ]);
      shoot(SHOP.scene, c); blit();
    } });
    cue(qu, 'ding', { gain: 0.35 }); cue(to + 0.1, 'swoosh', { gain: 0.4 }); cue(ji, 'ding', { gain: 0.4 }); cue(ji + 0.35, 'ding', { gain: 0.4 }); cue(ke, 'slide', { gain: 0.35 }); }

  // ── S2 · "A few days later, he opened the local paper. The big winner? The clerk from his store."
  { const st = L(3), op = Wd('opened', 3), bi = Wd('big', 3), cl = Wd('clerk', 3), end = L(4);
    add({ id: 'S2', at: st, trans: 'dissolve', note: 'days later by the shop window: close on the headline CLERK WINS $250,000, the paper drops to his shocked face; behind him the clerk waves from the counter', draw(lt, d, t, blit) {
      hideAll(); into(SHOP.scene, oldman, clerk); idleScreen(); SHOP.terminal.pivot.rotation.y = Math.PI;
      const drop = eio(clamp((t - cl + 0.1) / 0.35));
      act(oldman, -2.6, 1.2, { ...A.face(t, [[st, 'content'], [bi, 'skeptic'], [cl, 'shock']]), armL: [70, 105], armR: [70, 105], ...A.react('shock', t, cl, 0.6), talk: 0 });
      paper.visible = true; paper.position.set(-2.6, lerp(1.32, 0.9, drop), 1.55); paper.rotation.set(lerp(-0.05, -0.5, drop), 0.35, Math.sin(t * 8) * 0.02);
      act(clerk, 0.5, -1.75, { mood: 'happy', armR: [150 + Math.sin(t * 9) * 20, -20], ...A.react('cheer', t, cl + 0.2, 0.6) });
      const c = A.camPath(t, [
        [st, [-2.0, 1.45, 4.3], [-2.55, 1.3, 1.4], 40],
        [cl - 0.1, [-1.9, 1.55, 4.4], [-2.4, 1.4, 1.2], 40],
        [end, [-1.6, 1.6, 3.8], [-1.6, 1.4, 0.4], 44],
      ]);
      shoot(SHOP.scene, c); blit();
    } });
    cue(op, 'slide', { gain: 0.3 }); cue(cl, 'boing', { gain: 0.35 }); }

  // ── S3 · "So he complained to the lottery company. They fought him instead."
  { const st = L(4), co = Wd('complained', 4), fo = Wd('fought', 4), end = L(5);
    add({ id: 'S3', at: st, trans: 'dissolve', note: 'the lottery office: the old man pounds the desk, red-faced; the boss leans back smug, and on "fought" two lawyers pop up behind him with folded arms', draw(lt, d, t, blit) {
      hideAll(); into(LOT.scene, oldman, boss, law1, law2); checkB.visible = false; bills.visible = false;
      act(oldman, 0.2, -0.45, { ...A.face(t, [[st, 'angry']]), flush: 0.9, steam: 1, armR: A.arm(t, [...Array(8)].map((_, k) => [st + k * 0.32, k % 2 ? [60, 60] : [150, 30]])), ...A.react('angry', t, co, 1.0), energy: 1.4 });
      act(boss, 0.1, -2.3, { ...A.face(t, [[st, 'deadpan'], [fo, 'smug']]), armL: [40, 128], armR: [40, 128], talk: 0.2 });
      const pop = (p, x, t0) => { if (t < t0) { p.group.visible = false; return; } const k = Math.min(1, A.pop(t, t0, 0.35)); act(p, x, -2.9, { mood: 'smug', armL: [38, 128], armR: [38, 128], talk: 0, squash: (1 - k) * -0.2 }, -0.25 + 0.25 * k); };
      pop(law1, -0.95, fo - 0.05); pop(law2, 1.15, fo + 0.12);
      const c = A.camPath(t, [
        [st, [1.6, 1.7, 2.6], [0.2, 1.35, -0.6], 42],
        [fo, [0.9, 1.75, 3.0], [0.1, 1.45, -1.8], 44],
        [end, [0.5, 1.8, 3.4], [0.1, 1.5, -2.2], 44],
      ]);
      shoot(LOT.scene, c); blit();
    } });
    cue(co, 'thud', { gain: 0.35 }); cue(co + 0.64, 'thud', { gain: 0.3 }); cue(fo, 'pop', { gain: 0.35 }); cue(fo + 0.17, 'pop', { gain: 0.35 }); }

  // ── S4 · "He had to take them to court, and it dragged on for years." / "Then, on the day the trial was supposed to start, they suddenly settled, and made him promise not to talk about it."
  { const st = L(5), co = Wd('court', 5), dr = Wd('dragged', 5), th = L(6), da = Wd('day', 6), su = Wd('suddenly', 6), se = Wd('settled', 6), pr = Wd('promise', 6), ta = Wd('talk', 6), end = L(7);
    add({ id: 'S4', at: st, trans: 'dissolve', note: 'court: the wall calendar flips 2001 to 2005 while the old man gets sleepier; the judge walks in, the lawyers panic, slide a big check across the table, and shush him', draw(lt, d, t, blit) {
      hideAll(); into(COURT.scene, oldman, law1, law2, judge);
      const yr = t < dr ? 0 : Math.min(4, Math.floor((t - dr) / Math.max(0.3, (th - dr) / 5))); cal.set(String(2001 + yr));
      const tired = clamp((t - dr) / Math.max(0.5, th - dr));
      act(oldman, -1.15, -0.4, { ...A.face(t, [[st, 'skeptic'], [dr, 'tired'], [da, 'deadpan'], [se, 'shock'], [pr + 0.2, 'worried']]), sweat: tired > 0.5 && t < da ? 1 : 0, lean: tired * 6 * (t < da ? 1 : 0),
        armR: A.arm(t, [[st, [30, 30]], [ta - 0.25, [120, 120]], [ta + 0.6, [20, 20]]]), ...A.react('shock', t, se, 0.6), energy: t < da ? 1 - tired * 0.5 : 1 });
      act(law1, 1.15, -0.5, { ...A.face(t, [[st, 'smug'], [da, 'worried'], [su, 'shock'], [se, 'strain'], [pr, 'scheme']]), sweat: t > da && t < se ? 1 : 0,
        armR: A.arm(t, [[st, [30, 30]], [se - 0.1, [80, 70]], [se + 0.6, [20, 20]], [pr, [120, 150]]]), ...A.react('shock', t, su, 0.6), energy: t > da ? 1.4 : 1 });
      act(law2, 1.95, -1.4, { ...A.face(t, [[st, 'smug'], [da, 'gasp'], [su, 'worried']]), sweat: t > da ? 1 : 0, ...A.react('shock', t, su + 0.1, 0.6) });
      const jIn = clamp((t - da + 0.6) / 0.6);
      act(judge, lerp(3.2, 0.1, eio(jIn)), -3.7, { ...A.face(t, [[st, 'deadpan'], [se, 'skeptic']]), legs: jIn > 0 && jIn < 1 ? 'walk' : undefined, phase: t * 7, talk: 0.2 }, 0.35);
      judge.group.visible = t > da - 0.6;
      const slide = eio(clamp((t - se + 0.05) / 0.5)); check.visible = t > se - 0.1; check.position.set(lerp(0.6, -0.45, slide), 0.93, -0.7); check.rotation.set(-Math.PI / 2, 0, lerp(0.3, -0.1, slide)); check.scale.setScalar(0.55);
      const c = A.camPath(t, [
        [st, [0.0, 1.75, 3.2], [0.0, 1.4, -0.6], 44],
        [dr + 0.3, [-1.3, 1.85, 2.0], [-1.7, 1.7, -1.6], 42],
        [th - 0.2, [-1.2, 1.7, 2.2], [-1.15, 1.35, -0.4], 40],
        [da + 0.4, [0.4, 1.9, 3.6], [0.3, 1.45, -2.0], 46],
        [se + 0.2, [0.1, 2.2, 2.4], [0.0, 1.0, -0.6], 44],
        [pr, [0.9, 1.75, 3.4], [0.0, 1.4, -0.5], 40],
        [end, [0.3, 1.7, 3.0], [-0.6, 1.45, -0.45], 38],
      ]);
      shoot(COURT.scene, c); blit();
    } });
    cue(co, 'thud', { gain: 0.35 }); for (let k = 0; k < 4; k++) cue(dr + 0.3 + k * 0.4, 'tock', { gain: 0.3 }); cue(su, 'boing', { gain: 0.3 }); cue(se, 'slide', { gain: 0.4 }); cue(ta - 0.2, 'gulp', { gain: 0.35 }); }

  // ── S5 · "But a TV news team got curious. If one clerk did this, how many others had?"
  { const st = L(7), cu = Wd('curious', 7), on = Wd('one', 7), ot = Wd('others', 7), end = L(8);
    add({ id: 'S5', at: st, trans: 'dissolve', note: 'a TV crew walks into the shop: the reporter squints at the clerk, who sweats; the camera pushes past the reporter\'s shoulder to the nervous clerk', draw(lt, d, t, blit) {
      hideAll(); into(SHOP.scene, reporter, cammo, clerk); idleScreen(); SHOP.terminal.pivot.rotation.y = Math.PI;
      const walkIn = clamp((t - st) / 1.2);
      act(reporter, lerp(-3.0, -0.3, eo(walkIn)), 0.6, { ...A.face(t, [[st, 'excited'], [cu, 'skeptic'], [ot, 'scheme']]), legs: walkIn < 1 ? 'walk' : undefined, phase: t * 8, holdR: micProp, armR: [85, 40], ...A.react('point', t, on, 0.9) });
      act(cammo, lerp(-3.6, -1.3, eo(walkIn)), 1.5, { mood: 'content', legs: walkIn < 1 ? 'walk' : undefined, phase: t * 8 + 1, holdR: tvCamProp, armR: [150, 60], armL: [120, 60], talk: 0 });
      act(clerk, 0.5, -1.75, { ...A.face(t, [[st, 'happy'], [cu, 'worried'], [ot, 'gasp']]), sweat: t > cu ? 1 : 0, ...A.react('shock', t, ot, 0.6), talk: 0.3 });
      const c = A.camPath(t, [
        [st, [1.2, 1.8, 4.2], [-0.8, 1.3, 0.6], 44],
        [cu, [0.4, 1.7, 3.2], [-0.1, 1.4, 0.0], 42],
        [end, [0.3, 1.7, 1.3], [0.5, 1.55, -1.75], 38],
      ]);
      shoot(SHOP.scene, c); blit();
    } });
    cue(st + 0.1, 'swoosh', { gain: 0.35 }); cue(ot, 'gulp', { gain: 0.35 }); }

  // ── S6 · lines 8-10: the professor's chalkboard
  { const st = L(8), nu = Wd('numbers', 8), tw = Wd('hundred', 9), lu = Wd('luck', 9), si = Wd('sixty', 9), ys = L(10), wi = Wd('win', 10), end = L(11);
    add({ id: 'S6', at: st, trans: 'dissolve', note: 'the professor\'s chalkboard: he chalks the real count (200+) and the luck count (about 60) while the reporter\'s jaw drops; on "You see" the board explains equal tickets, equal luck', draw(lt, d, t, blit) {
      hideAll(); into(UNI.scene, prof, reporter);
      const lines = [['STORE WORKERS\' BIG WINS', '#F2C230', 40, 60]];
      if (t > tw - 0.4) lines.push(['REAL: 200+', '#FFFFFF', 76, 160]);
      if (t > lu - 0.1) lines.push(['LUCK: ~60', '#8FE0A0', 76, 260]);
      if (t > ys + 0.2) { lines.length = 0; lines.push(['TICKETS BOUGHT', '#F2C230', 44, 60], ['CLERKS = EVERYONE', '#FFFFFF', 52, 150], ['SO WINS SHOULD', '#FFFFFF', 46, 245], ['BE EQUAL TOO', '#8FE0A0', 52, 320]); }
      brd.draw(lines);
      act(prof, -0.95, -2.4, { ...A.face(t, [[st, 'content'], [nu, 'excited'], [tw, 'skeptic'], [si, 'smug'], [ys, 'content'], [wi, 'proud']]), holdR: chalkProp,
        armR: A.arm(t, [[st, [30, 30]], [tw - 0.5, [120, 60]], [tw + 0.3, [60, 40]], [lu - 0.2, [110, 60]], [lu + 0.5, [60, 40]], [ys + 0.2, [100, 50]]]), ...A.react('point', t, si, 1.0) });
      act(reporter, 0.95, -0.4, { ...A.face(t, [[st, 'excited'], [tw, 'gasp'], [si, 'shock'], [ys, 'skeptic'], [wi, 'gasp']]), holdR: micProp, armR: [80, 40], ...A.react('shock', t, si + 0.05, 0.7) });
      const c = A.camPath(t, [
        [st, [1.4, 1.8, 4.6], [-0.4, 1.6, -1.8], 46],
        [tw - 0.2, [0.4, 1.95, 3.4], [-0.2, 1.75, -2.4], 46],
        [si, [1.3, 1.75, 3.2], [0.4, 1.55, -1.2], 44],
        [ys + 0.4, [0.0, 1.95, 3.0], [0.0, 1.75, -2.4], 46],
        [end, [-0.6, 1.8, 2.6], [-0.6, 1.7, -2.2], 44],
      ]);
      shoot(UNI.scene, c); blit();
    } });
    cue(tw - 0.4, 'slide', { gain: 0.25 }); cue(lu - 0.1, 'slide', { gain: 0.25 }); cue(si + 0.05, 'boing', { gain: 0.3 }); cue(ys + 0.2, 'swoosh', { gain: 0.3 }); }

  // ── S7 · "It's like a friend who wins every coin toss, but he's also the one who flips the coin and tells you how it landed."
  { const st = L(11), wi = Wd('wins', 11), fl = Wd('flips', 11), te = Wd('tells', 11), la = Wd('landed', 11), end = L(12);
    const per = Math.max(0.9, (end - st) / 3);
    add({ id: 'S7', at: st, trans: 'dissolve', note: 'the coin-toss gag at the counter: the clerk flips a coin, slaps it on her hand, peeks, and cheers every time while the old man stares deadpan', draw(lt, d, t, blit) {
      hideAll(); into(SHOP.scene, clerk, oldman); idleScreen(); SHOP.terminal.pivot.rotation.y = Math.PI;
      const k = ((t - st) % per) / per, flipUp = k < 0.55, n = Math.floor((t - st) / per);
      coin.visible = !(k > 0.6); coin.position.set(0.7, flipUp ? 1.55 + Math.sin(Math.PI * (k / 0.55)) * 0.9 : 1.5, -1.55); coin.rotation.set(flipUp ? t * 22 : Math.PI / 2, 0, 0);
      act(clerk, 0.5, -1.75, { ...A.face(t, [[st, 'scheme'], [wi, 'excited'], [fl, 'scheme'], [te, 'sly'], [la, 'laugh']]), armR: flipUp ? [120, 20] : [80, 70], armL: !flipUp ? [80, 70] : [20, 20], ...(k > 0.72 ? A.react('cheer', t, st + n * per + per * 0.72, 0.35) : {}), energy: 1.3 });
      act(oldman, 0.25, 0.15, { ...A.face(t, [[st, 'deadpan'], [te, 'skeptic'], [la, 'deadpan']]), armL: [40, 128], armR: [40, 128], talk: 0 });
      const c = A.camPath(t, [
        [st, [2.4, 1.7, 2.0], [0.6, 1.5, -1.0], 42],
        [te, [1.8, 1.8, 1.6], [0.7, 1.55, -1.2], 40],
        [end, [1.2, 1.7, 2.6], [0.45, 1.4, -0.6], 42],
      ]);
      shoot(SHOP.scene, c); blit();
    } });
    for (let k = 0; k < 3; k++) { cue(st + k * per, 'zip', { gain: 0.25 }); cue(st + k * per + per * 0.72, 'ding', { gain: 0.3 }); } }

  // ── S8 · "The odds of that being luck were about one in a trillion trillion trillion trillion."
  { const st = L(12), tr = Wd('trillion', 12), end = L(13);
    add({ id: 'S8', at: st, trans: 'dissolve', note: 'back at the board: the professor writes 1 IN 1 followed by a run of zeros that spills off the board while the reporter\'s jaw drops', draw(lt, d, t, blit) {
      hideAll(); into(UNI.scene, prof, reporter);
      const z = Math.max(0, Math.floor((t - tr + 0.2) * 22)); brd.draw([['ODDS IT WAS LUCK:', '#F2C230', 46, 70], ['1 IN', '#FFFFFF', 70, 165], ['1' + '0'.repeat(Math.min(48, z)), '#8FE0A0', 54, 265]]);
      act(prof, -0.95, -2.4, { ...A.face(t, [[st, 'smug'], [tr, 'excited']]), holdR: chalkProp, armR: A.arm(t, [[st, [60, 40]], [tr - 0.2, [110, 60]]]), energy: 1.3 });
      act(reporter, 0.95, -0.4, { ...A.face(t, [[st, 'skeptic'], [tr + 0.3, 'shock']]), holdR: micProp, armR: [80, 40], ...A.react('shock', t, tr + 0.3, 0.8) });
      const c = A.camPath(t, [
        [st, [0.6, 1.95, 3.6], [0.0, 1.75, -2.4], 46],
        [end, [0.2, 1.9, 2.4], [0.1, 1.7, -2.4], 50],
      ]);
      shoot(UNI.scene, c); blit();
    } });
    cue(tr, 'zip', { gain: 0.3 }); cue(end - 0.4, 'boing', { gain: 0.3 }); }

  // ── S9 · "Now you can scan your own ticket, and the screen faces you."
  { const st = L(13), sc = Wd('scan', 13), sf = Wd('screen', 13), end = L(14);
    add({ id: 'S9', at: st, trans: 'dissolve', note: 'today: the old man scans his own ticket at a self-check box; the clerk\'s terminal screen swings round to face him and reads FREE TICKET (really, this time); he shrugs and smiles', draw(lt, d, t, blit) {
      hideAll(); into(SHOP.scene, oldman, clerk);
      SHOP.checker.group.visible = true; const scanned = t > sc + 0.4;
      SHOP.checker.setScreen(scanned ? [['FREE', '#F2C230', 50], ['TICKET', '#FFFFFF', 40]] : [['SCAN', '#FFFFFF', 44], ['YOUR TICKET', '#F2C230', 26]], scanned ? '#2E8A4A' : '#1E3A5E');
      const turn = eio(clamp((t - sf + 0.1) / 0.6)); SHOP.terminal.pivot.rotation.y = lerp(Math.PI, 0, turn);
      if (turn > 0.5) SHOP.terminal.setScreen([['FREE', '#F2C230', 50], ['TICKET', '#FFFFFF', 40]], '#2E8A4A'); else idleScreen();
      act(oldman, -0.75, 0.05, { ...A.face(t, [[st, 'content'], [sc + 0.4, 'skeptic'], [sf + 0.5, 'happy']]), holdR: ticketProp, armR: A.arm(t, [[st, [30, 30]], [sc - 0.1, [80, 30]], [sc + 0.6, [40, 40]]]), ...A.react('shrug', t, sf + 0.6, 0.9) });
      act(clerk, 0.5, -1.75, { ...A.face(t, [[st, 'content'], [sf, 'worried']]), sweat: t > sf ? 1 : 0, talk: 0.2 });
      const c = A.camPath(t, [
        [st, [-0.2, 1.7, 2.4], [-0.8, 1.35, -0.6], 40],
        [sc + 0.3, [-0.4, 1.65, 2.1], [-0.85, 1.35, -0.7], 38],
        [end, [0.6, 1.7, 2.6], [0.1, 1.3, -0.9], 42],
      ]);
      shoot(SHOP.scene, c); blit();
    } });
    cue(sc + 0.3, 'ding', { gain: 0.35 }); cue(sf, 'swoosh', { gain: 0.3 }); }

  // ── S10 · "And the lottery company? It spent three times more on lawyers fighting the old man than it ever paid him."
  { const st = L(14), la = Wd('lawyers', 14), pa = Wd('paid', 14), end = T.dur;
    add({ id: 'S10', at: st, trans: 'dissolve', note: 'the lottery boss at his desk: a small $200,000 check on one side, a wobbling tower of LAWYER BILLS on the other; the camera cranes up the tower; the boss sweats and shrugs', draw(lt, d, t, blit) {
      hideAll(); into(LOT.scene, boss, law1);
      checkB.visible = true; checkB.position.set(-0.75, 0.98, -1.4); checkB.rotation.set(-Math.PI / 2 + 0.25, 0, 0.1); checkB.scale.setScalar(0.5);
      bills.visible = true; const grow = eo(clamp((t - la + 0.3) / 1.2)); bills.position.set(0.75, 0.97, -1.55); bills.scale.set(1, Math.max(0.05, grow * 1.4), 1); bills.rotation.z = Math.sin(t * 3) * 0.02 * grow;
      act(boss, 0.0, -2.35, { ...A.face(t, [[st, 'smug'], [la, 'worried'], [pa, 'gasp']]), sweat: t > la ? 1 : 0, ...A.react('shrug', t, pa + 0.3, 1.0), talk: 0.3 });
      act(law1, 1.6, -2.6, { ...A.face(t, [[st, 'smug'], [la, 'happy']]), armL: [38, 128], armR: [38, 128], talk: 0 });
      const c = A.camPath(t, [
        [st, [0.0, 1.6, 2.2], [0.0, 1.45, -1.8], 42],
        [la + 0.6, [0.5, 2.0, 2.0], [0.7, 1.9, -1.6], 44],
        [pa + 0.4, [0.3, 2.2, 2.6], [0.3, 1.8, -1.8], 46],
        [end, [0.1, 2.1, 2.9], [0.1, 1.7, -1.8], 46],
      ]);
      shoot(LOT.scene, c); blit();
    } });
    cue(la, 'slide', { gain: 0.3 }); cue(pa + 0.2, 'boing', { gain: 0.3 }); }

  A.autoSwoosh(S, cue, CUES);
  return { shots: S, cues: CUES };
}
