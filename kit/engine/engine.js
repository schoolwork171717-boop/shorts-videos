// Renderer + cartoon-film look: neutral tone curve (keeps colours saturated), soft shadows, environment light, bloom, depth of field, vignette + grain.
//   const E = makeEngine(canvas)   ·   E.render(scene, camera, { bloom, focus, aperture, maxblur, grade })
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---- INK + CEL LOOK (Iron Canyon v3) ----------------------------------------------------------------------------
// ink: dark outlines on every 3D object, found from depth + normal edges of an extra normal/depth render, thinner and
// lighter with distance (like a hand-inked background). cel: every MeshStandardMaterial is swapped for a toon material
// with soft bands (keeps its colour/texture/emissive). Cut-outs (transparent planes), sprites and points are left alone.
const INK = {
  uniforms: { tDiffuse: { value: null }, tNormal: { value: null }, tDepth: { value: null }, uPx: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.05 }, uFar: { value: 800 }, uInk: { value: new THREE.Color('#1F1C33') }, uStrength: { value: 0.9 },
    uFadeNear: { value: 12 }, uFadeFar: { value: 120 }, uDepthK: { value: 0.04 }, uNormK: { value: 0.5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse, tNormal, tDepth; uniform vec2 uPx; uniform float uNear, uFar, uStrength, uFadeNear, uFadeFar, uDepthK, uNormK; uniform vec3 uInk; varying vec2 vUv;
    float lin(float d){ return (uNear * uFar) / (uFar - d * (uFar - uNear)); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec4 nc = texture2D(tNormal, vUv);
      if (nc.a < 0.75) { gl_FragColor = c; return; }                       // sky or a cut-out person: no ink here
      float z = lin(texture2D(tDepth, vUv).x); vec3 n = nc.xyz * 2.0 - 1.0; float e = 0.0;
      for (int i = 0; i < 4; i++) { vec2 o = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
        vec2 uv2 = vUv + o * uPx; vec4 ni = texture2D(tNormal, uv2);
        if (ni.a < 0.1) { e = 1.0; continue; }                               // silhouette against the sky
        if (ni.a < 0.75) continue;                                          // next to a cut-out: it has its own ink
        float zi = lin(texture2D(tDepth, uv2).x);
        float de = (zi - z) / max(z, 0.05);                                 // only the nearer side of a depth step gets ink
        float ne = 1.0 - dot(ni.xyz * 2.0 - 1.0, n);
        e = max(e, max(smoothstep(uDepthK, uDepthK * 2.5, de), smoothstep(uNormK, uNormK * 1.8, ne))); }
      float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, z);
      c.rgb = mix(c.rgb, uInk, e * uStrength * (0.3 + 0.7 * fade));
      gl_FragColor = c; }`,
};
const GRAD = (() => { const d = new Uint8Array([120, 120, 120, 255, 175, 175, 175, 255, 220, 220, 220, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const TOON = new WeakMap();
const toonOf = (m) => { if (!m || !m.isMeshStandardMaterial || m.userData.keepPBR) return m; if (TOON.has(m)) return TOON.get(m);
  const t = new THREE.MeshToonMaterial({ color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity, transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest, alphaMap: m.alphaMap, fog: m.fog, gradientMap: GRAD, depthWrite: m.depthWrite });
  TOON.set(m, t); return t; };
export function celify(scene) { scene.traverse((o) => { if (!o.isMesh || o.userData.noCel) return; o.material = Array.isArray(o.material) ? o.material.map(toonOf) : toonOf(o.material); }); }

export const W = 1080, H = 1920;
/** the film look: ?ink=0 / ?cel=0 in the URL turn the outlines / cel shading off */
export const STYLE = { ink: true, cel: true, inkStrength: 0.9 };
/** render quality from the URL: ?res=0.6 renders 3D at 60% size (upscaled), ?aa=0 turns MSAA off, ?shadow=1024 */
const Q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const RES = +(Q.get('res') || 1), AA = +(Q.get('aa') ?? 4), SHADOW = +(Q.get('shadow') || 2048);
if (Q.get('ink') === '0') STYLE.ink = false; if (Q.get('cel') === '0') STYLE.cel = false;
// the colour grade ("majestic"): vibrance lifts dull colours most, an S-curve adds punch, split toning pushes shadows
// toward violet-blue and coloured highlights toward gold (near-white cut-out faces are left white), soft vignette, grain.
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.35 }, uGrain: { value: 0.025 }, uTime: { value: 0 }, uWarm: { value: 0.04 }, uSat: { value: 1.12 },
    uVib: { value: 0.45 }, uCon: { value: 0.22 }, uSplit: { value: 0.6 }, uShadow: { value: new THREE.Color('#4B3A8C') }, uHigh: { value: new THREE.Color('#FFC46B') } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uGrain, uTime, uWarm, uSat, uVib, uCon, uSplit; uniform vec3 uShadow, uHigh; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 7.13) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; d.x *= 0.5625;
      vec3 x = clamp(c.rgb, 0.0, 1.0);
      x = mix(x, x * x * (3.0 - 2.0 * x), uCon);
      float l = dot(x, vec3(0.299, 0.587, 0.114)), mx = max(x.r, max(x.g, x.b)), mn = min(x.r, min(x.g, x.b)), s = mx - mn;
      x = mix(vec3(l), x, uSat * (1.0 + uVib * (1.0 - s) * smoothstep(0.02, 0.12, s)));
      float colourful = smoothstep(0.04, 0.22, s);
      x += uSplit * 0.22 * ((1.0 - smoothstep(0.0, 0.55, l)) * (uShadow - vec3(0.42)) + smoothstep(0.45, 1.0, l) * colourful * (uHigh - vec3(0.72)));
      x *= 1.0 - uVig * smoothstep(0.25, 0.75, length(d) * 1.4);
      x += (h(vUv * 1000.0) - 0.5) * uGrain; x.r += uWarm * 0.5; x.b -= uWarm * 0.5;
      gl_FragColor = vec4(x, c.a); }`,
};

/** default grade, change per film: STYLE-wide `GRADE_DEFAULT`, per frame `look.grade = { vib, con, split, shadow, high }`, `look.sat` */
export const GRADE_DEFAULT = { sat: 1.2, vib: 0.5, con: 0.24, split: 0.45, shadow: '#3A3CA8', high: '#FFD890' };

export function makeEngine(canvas, { w = W, h = H, samples = 4, shadowSize = 2048 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h, false); renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer), envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples });
  renderer.userData = { shadowSize };
  const composer = new EffectComposer(renderer, rt); composer.setSize(w, h);
  const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()); composer.addPass(rp);
  // normal + depth target for the ink pass
  const nrt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType }); nrt.depthTexture = new THREE.DepthTexture(w, h); nrt.depthTexture.type = THREE.UnsignedIntType;
  const nmat = new THREE.MeshNormalMaterial(); const clear = new THREE.Color(0, 0, 0);
  const ink = new ShaderPass(INK); ink.uniforms.tNormal.value = nrt.texture; ink.uniforms.tDepth.value = nrt.depthTexture; ink.uniforms.uPx.value.set(1.6 / w, 1.6 / h); composer.addPass(ink);
  const hidden = [];
  const masks = new WeakMap();
  const maskOf = (m) => { if (masks.has(m)) return masks.get(m); const k = new THREE.MeshBasicMaterial({ color: '#000000', map: m.map, transparent: false, opacity: 0.5, alphaTest: 0.25, side: THREE.DoubleSide }); masks.set(m, k); return k; };
  const swapped = [];
  const normalPass = (scene, cam) => {
    hidden.length = 0; swapped.length = 0;
    scene.traverse((o) => { if (!o.visible) return;
      if (o.isSprite || o.isPoints || o.isLine) { o.visible = false; hidden.push(o); return; }
      if (!o.isMesh) return; const m = o.material;
      if (Array.isArray(m)) { swapped.push([o, m]); o.material = nmat; return; }
      if (o.userData.noInk || m.isShaderMaterial || (m.transparent && !m.alphaTest) || (m.isMeshBasicMaterial && !m.map)) { o.visible = false; hidden.push(o); return; }
      swapped.push([o, m]); o.material = m.map && m.alphaTest ? maskOf(m) : nmat; });
    const bg = scene.background, fog = scene.fog; scene.background = null; scene.fog = null;
    renderer.setRenderTarget(nrt); renderer.setClearColor(clear, 0); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
    scene.background = bg; scene.fog = fog; hidden.forEach((o) => (o.visible = true)); swapped.forEach(([o, m]) => (o.material = m));
  };
  const bokeh = new BokehPass(rp.scene, rp.camera, { focus: 3, aperture: 0.002, maxblur: 0.008 }); composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 0.85); composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GRADE); composer.addPass(grade);
  return {
    renderer, envMap, composer,
    /** look = { bloom, bloomThreshold, focus (m), aperture (0 = all sharp), maxblur, exposure, vignette, grain, warm, t } */
    render(scene, camera, look = {}) {
      rp.scene = scene; rp.camera = camera; bokeh.scene = scene; bokeh.camera = camera;
      const style = look.style ?? STYLE;
      if (style.cel) celify(scene);
      ink.enabled = !!style.ink;
      if (ink.enabled) { normalPass(scene, camera); Object.assign(ink.uniforms.uNear, { value: camera.near }); ink.uniforms.uFar.value = camera.far; ink.uniforms.uStrength.value = look.ink ?? style.inkStrength ?? 0.9; ink.uniforms.uFadeFar.value = look.inkFar ?? 140; }
      bokeh.enabled = (look.aperture ?? 0.0015) > 0;
      bokeh.uniforms.focus.value = look.focus ?? 3; bokeh.uniforms.aperture.value = look.aperture ?? 0.0015; bokeh.uniforms.maxblur.value = look.maxblur ?? 0.006;
      bloom.strength = look.bloom ?? 0.3; bloom.threshold = look.bloomThreshold ?? 0.85; bloom.radius = 0.6;
      renderer.toneMappingExposure = look.exposure ?? 1.0;
      grade.uniforms.uVig.value = look.vignette ?? 0.18; grade.uniforms.uGrain.value = look.grain ?? 0.008; grade.uniforms.uSat.value = look.sat ?? GRADE_DEFAULT.sat; grade.uniforms.uWarm.value = look.warm ?? 0.02; const GD = { ...GRADE_DEFAULT, ...(look.grade || {}) }; grade.uniforms.uVib.value = GD.vib; grade.uniforms.uCon.value = GD.con; grade.uniforms.uSplit.value = GD.split; grade.uniforms.uShadow.value.set(GD.shadow); grade.uniforms.uHigh.value.set(GD.high); grade.uniforms.uTime.value = look.t ?? 0;
      composer.render();
    },
  };
}
/** the default light rig: warm key with soft shadow, cool fill, rim, sky/ground bounce. Returns { key, rim, group } */
export function lightRig(scene, { key = '#FFE2C2', keyI = 3.2, keyPos = [2.5, 4, 3], rimCol = '#BFD8FF', rimI = 2.2, sky = '#FFF4E6', ground = '#8C6E55', hemiI = 0.9, shadowBox = 3, target = [0, 1, 0] } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const k = new THREE.DirectionalLight(key, keyI); k.position.set(...keyPos); k.target.position.set(...target); k.castShadow = true;
  k.shadow.mapSize.set(SHADOW, SHADOW); k.shadow.bias = -0.0004; k.shadow.normalBias = 0.02; k.shadow.radius = 6;
  Object.assign(k.shadow.camera, { left: -shadowBox, right: shadowBox, top: shadowBox, bottom: -shadowBox, near: 0.1, far: 20 }); k.shadow.camera.updateProjectionMatrix();
  g.add(k, k.target);
  const r = new THREE.DirectionalLight(rimCol, rimI); r.position.set(-3, 3, -3); g.add(r);
  g.add(new THREE.HemisphereLight(sky, ground, hemiI));
  return { key: k, rim: r, group: g };
}
export function camera(fov = 30) { return new THREE.PerspectiveCamera(fov, W / H, 0.05, 800); }
