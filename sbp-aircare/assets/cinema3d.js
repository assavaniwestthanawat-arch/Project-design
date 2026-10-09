// SBP AirCare — cinematic real-time 3D for the v2 editions (r12, owner 5 ต.ค. 2569: "ภาพที่สมจริง … Cinematic …
// Mood & tone ผสมผสานกลมกลืน … Luxury premium ultra … ต้องมีภาพ animation ครบทุกโมเดลให้ทดลอง").
// One renderer, four art-directed sets (MOODS), a camera that moves in shots, and a post-processing chain that grades
// the frame like film: ACES tone mapping → depth of field → bloom → colour grade + vignette + grain + letterbox.
// Every catalogue model can be shown: the indoor unit of its type (units3d builders, brand-neutral — §6.6 #14/#20) scaled
// to the model's size from its spec (roomfit.unitDims), with power-on, swing, airflow (airflow3d wisps), x-ray, exploded
// parts, a dirty → cleaned sequence. Everything is an illustration ("แบบจำลองเพื่ออธิบาย"), never a measurement.
// Budget: one WebGL context per cinema (gl-pool track), pixel ratio capped, quality tier by device, still frame for
// prefers-reduced-motion, renders only while on screen.
// createCinema(container, {mood, quality, bars, model, onShot, onClean, onFrame}) → {setModel, scene, attach, anchor, shot, auto,
//   power, mode, swing, xray, explode, dirt, clean, setMood, letterbox, sound, frame, advance, dispose, state, type, host}
// attach(host) moves the one canvas (and its WebGL context) to another place on the page — several "stage slots" share it.
import * as THREE from './three.module.min.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { EffectComposer } from './three-pp/EffectComposer.js';
import { RenderPass } from './three-pp/RenderPass.js';
import { UnrealBloomPass } from './three-pp/UnrealBloomPass.js';
import { BokehPass } from './three-pp/BokehPass.js';
import { ShaderPass } from './three-pp/ShaderPass.js';
import { OutputPass } from './three-pp/OutputPass.js';
import { materialSet } from './ac3d.js';
import { buildUnit, animateUnit } from './units3d.js';
import { createAirflow } from './airflow3d.js';
import { track, PR_CAP, disposeDeep, warm, whenCalm } from './gl-pool.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10);   // smootherstep
const W = 6.4, D = 5.6, H = 2.9;   // the set: x ∈ [−W/2, W/2], back wall at z = 0, room toward +z, floor y = 0, ceiling y = H
const DIRT_C = new THREE.Color(0x4a3f33);

/* ---------- art direction: one mood per edition (light, materials, grade) ---------- */
export const MOODS = {
  // A — a residence at golden hour: walnut fluting, warm low sun through the window, soft cream walls
  aurora: { th: 'บ้านยามเย็น', bg: 0x1d1611, exposure: 0.9, env: 0.55, dark: false,
    wall: 0xe9dfd2, back: 0x6b4a32, flute: true, floor: 0x8a6a4f, floorR: 0.42, floorM: 0.0, ceil: 0xf3ece3,
    key: { c: 0xffc58a, i: 2.0, p: [-5.5, 3.4, 2.6] }, fill: { c: 0x9fb6d6, i: 0.35 }, hemi: [0xfff1de, 0x3a2c22, 0.45],
    window: { side: -1, glow: 0xffd7a3, i: 2.6 }, cove: 0xffc98f, accent: 0xffb36b, shafts: 0.18,
    grade: { lift: [0.02, 0.012, 0.0], gamma: [1.0, 1.0, 1.04], gain: [1.06, 1.0, 0.92], sat: 1.06 }, bloom: [0.35, 0.55, 1.05], bokeh: 0.018, grain: 0.035 },
  // B — a corporate tower at night: smoked glass, city lights, cool steel, cyan instrument glow
  tower: { th: 'อาคารยามค่ำ', bg: 0x05070d, exposure: 0.92, env: 0.35, dark: true,
    wall: 0x2a3140, back: 0x1b212d, flute: false, floor: 0x14171d, floorR: 0.28, floorM: 0.35, ceil: 0x1e2430,
    key: { c: 0x9cc4ff, i: 1.5, p: [3.5, 4.5, 4.5] }, fill: { c: 0x3a5fa8, i: 0.5 }, hemi: [0x8fb0e6, 0x0a0c12, 0.25],
    window: { side: -1, city: true, glow: 0x6f8fd6, i: 1.4 }, cove: 0x7fd3ff, accent: 0x52d1ff, shafts: 0,
    grade: { lift: [0.0, 0.01, 0.03], gamma: [1.02, 1.0, 0.96], gain: [0.94, 1.0, 1.08], sat: 0.95 }, bloom: [0.8, 0.6, 0.95], bokeh: 0.022, grain: 0.045 },
  // C — a black-and-gold product theatre: gloss black, gold light lines, two hard spots
  noir: { th: 'โรงภาพยนตร์สินค้า', bg: 0x030303, exposure: 0.95, env: 0.12, dark: true,
    wall: 0x0d0d0f, back: 0x0a0a0c, flute: true, floor: 0x050506, floorR: 0.18, floorM: 0.55, ceil: 0x09090a,
    key: { c: 0xfff1d6, i: 1.5, p: [2.8, 4.6, 3.4] }, fill: { c: 0x334466, i: 0.25 }, hemi: [0x403a30, 0x000000, 0.2],
    window: null, cove: 0xffc46a, accent: 0xffc46a, shafts: 0, spots: true,
    grade: { lift: [0.0, 0.0, 0.0], gamma: [1.0, 1.02, 1.06], gain: [1.08, 1.02, 0.92], sat: 1.0 }, bloom: [0.85, 0.5, 1.0], bokeh: 0.026, grain: 0.05 },
  // D — a bright gallery: white plaster cyclorama, soft north light, FUJIVA blue accents
  atelier: { th: 'แกลเลอรีสว่าง', bg: 0xe9edf2, exposure: 0.82, env: 0.4, dark: false,
    wall: 0xe4e7ec, back: 0xc9d3df, flute: false, floor: 0xd6d9dd, floorR: 0.38, floorM: 0.0, ceil: 0xcdd4dd,
    key: { c: 0xffffff, i: 1.7, p: [3.0, 6.0, 4.0] }, fill: { c: 0xdfe8f6, i: 0.3 }, hemi: [0xffffff, 0xb9c2cc, 0.42],
    window: { side: -1, glow: 0xffffff, i: 1.2 }, cove: 0xeaf2ff, accent: 0x1b51a4, shafts: 0.08,
    grade: { lift: [0.0, 0.0, 0.01], gamma: [0.96, 0.97, 0.98], gain: [0.98, 0.99, 1.01], sat: 1.0 }, bloom: [0.2, 0.5, 1.1], bokeh: 0.012, grain: 0.02 },
};

/* ---------- film grade: lift / gamma / gain + saturation + vignette + grain + letterbox (display space) ---------- */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, lift: { value: V(0, 0, 0) }, gamma: { value: V(1, 1, 1) }, gain: { value: V(1, 1, 1) }, sat: { value: 1 },
    vig: { value: 0.32 }, grain: { value: 0.03 }, time: { value: 0 }, bars: { value: 0 }, aspect: { value: 1.6 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 lift, gamma, gain; uniform float sat, vig, grain, time, bars, aspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 0.7) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = c * gain + lift * (1.0 - c); c = pow(max(c, 0.0), 1.0 / gamma);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat);
      vec2 q = (vUv - 0.5) * vec2(aspect, 1.0); c *= 1.0 - vig * smoothstep(0.35, 1.05, length(q));
      c += (h(vUv * 931.7) - 0.5) * grain;
      float b = bars * 0.5 * max(0.0, 1.0 - (aspect / 2.39));   // 2.39:1 letterbox when bars = 1
      if (vUv.y < b || vUv.y > 1.0 - b) c = vec3(0.0);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/* ---------- small procedural textures ---------- */
function ctex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const cityTex = () => ctex(1024, 512, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#060a18'); sky.addColorStop(0.55, '#16203d'); sky.addColorStop(1, '#2b2a44'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) {   // towers with lit windows (procedural — no real skyline)
    const bw = 30 + rnd() * 70, bh = 120 + rnd() * 330, x = rnd() * w, y = h - bh;
    g.fillStyle = `rgb(${10 + rnd() * 14},${14 + rnd() * 16},${28 + rnd() * 24})`; g.fillRect(x, y, bw, bh);
    for (let yy = y + 8; yy < h - 6; yy += 9) for (let xx = x + 5; xx < x + bw - 5; xx += 8) if (rnd() < 0.34) { g.fillStyle = rnd() < 0.8 ? 'rgba(255,214,150,.85)' : 'rgba(150,210,255,.8)'; g.fillRect(xx, yy, 4, 5); }
  }
});
const shaftTex = () => ctex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const sg = g.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = sg; g.fillRect(0, 0, w, h); });
const rugTex = (c1, c2) => ctex(512, 512, (g, w, h) => { g.fillStyle = c1; g.fillRect(0, 0, w, h); g.strokeStyle = c2; g.lineWidth = 6; g.strokeRect(24, 24, w - 48, h - 48); g.lineWidth = 2; g.strokeRect(44, 44, w - 88, h - 88); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
const tempTex = (txt, col) => ctex(256, 96, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = '700 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4); });

// bounds of what is drawn (Box3.setFromObject also counts hidden pipes, which pulls the framing off the unit)
function visBox(obj) {
  const b = new THREE.Box3(), t = new THREE.Box3(); obj.updateMatrixWorld(true);
  obj.traverseVisible(m => { if (!m.isMesh || !m.geometry) return; let bb; if (m.isInstancedMesh) { if (!m.boundingBox) m.computeBoundingBox(); bb = m.boundingBox; } else { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); bb = m.geometry.boundingBox; } t.copy(bb).applyMatrix4(m.matrixWorld); b.union(t); });
  return b;
}

/* ---------- unit placement per type: root position, emitters, framing ---------- */
function placeUnit(type, U, s) {
  const d = U.dims, g = U.root;
  if (type === 'wall') { g.position.set(0, 2.2, d.d * s / 2 + 0.01); return [{ o: V(0, 2.2 - d.h * s * 0.32, d.d * s + 0.05), f: V(0, 0, 1), r: V(1, 0, 0), width: d.w * s * 0.8, kind: 'wall', v0: 3.6, intake: V(0, 2.2 + d.h * s * 0.45, d.d * s * 0.5) }]; }
  if (type === 'ceiling') { g.position.set(0, H - 0.14, 0.55); g.rotation.y = 0; return [{ o: V(0, H - 0.2, 0.55 + d.d * s * 0.55), f: V(0, 0, 1), r: V(1, 0, 0), width: d.w * s * 0.8, kind: 'ceiling', v0: 4.6, intake: V(0, H - 0.3, 0.55) }]; }
  if (type === 'cassette') { const z = 2.35; g.position.set(0, H - 0.002, z); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b], k) => ({ o: V(a * 0.4 * s, H - 0.06, z + b * 0.4 * s), f: V(a, 0, b), r: V(b, 0, -a), width: 0.62 * s, kind: 'cassette', v0: 3.1, phase: k, intake: V(0, H - 0.12, z) })); }
  g.position.set(0.0, 0, d.d * s / 2 + 0.12); return [{ o: V(0, 1.5 * s, d.d * s + 0.16), f: V(0, 0, 1), r: V(1, 0, 0), width: 0.42 * s, kind: 'floor', v0: 4.2, intake: V(0, 0.45, d.d * s + 0.14) }];
}

export function createCinema(container0, opts = {}) {
  let container = container0, api = null;   // api is filled in at the end (callbacks may fire while building)
  const o = { mood: 'aurora', quality: 'auto', bars: false, ...opts };
  const lowDev = (navigator.deviceMemory && navigator.deviceMemory <= 3) || matchMedia('(pointer: coarse)').matches;
  const Q = o.quality === 'auto' ? (lowDev ? 'mid' : 'high') : o.quality;   // high: DOF + bloom + grade · mid: bloom + grade · low: grade only
  const renderer = new THREE.WebGLRenderer({ antialias: Q !== 'high', alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(PR_CAP, devicePixelRatio || 1, Q === 'high' ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const el = renderer.domElement; el.setAttribute('aria-hidden', 'true'); el.style.display = 'block'; el.style.width = '100%'; el.style.height = '100%'; el.style.touchAction = 'pan-y';
  container.append(el);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 60);
  const slot = track(renderer, container, { scene, redraw: () => frame(), name: 'ภาพยนตร์ 3 มิติ', onScale: pr => { composer.setPixelRatio(pr); size.w = 0; } });   // r15: the post chain follows the adaptive pixel ratio
  const FPS = matchMedia('(pointer: coarse)').matches || Q !== 'high' ? 30 : 60;   // phones / mid tier: 30 fps is calmer on battery

  // post chain
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, cam));
  const bokeh = Q === 'high' ? new BokehPass(scene, cam, { focus: 3, aperture: 0.012, maxblur: 0.006 }) : null; if (bokeh) composer.addPass(bokeh);
  const bloom = Q !== 'low' ? new UnrealBloomPass(new THREE.Vector2(512, 288), 0.6, 0.6, 0.85) : null; if (bloom) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);

  /* ---- the set ---- */
  const set = new THREE.Group(); scene.add(set);
  const lights = new THREE.Group(); scene.add(lights);
  let M = materialSet('studio');
  const mat = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  let moodKey = null, mood = null, cityMat = null; const props = {};
  function buildSet(k) {
    disposeDeep(set); set.clear(); disposeDeep(lights); lights.clear(); for (const k2 in props) delete props[k2];
    mood = MOODS[k] || MOODS.aurora; moodKey = k;
    scene.background = new THREE.Color(mood.bg); scene.fog = new THREE.Fog(mood.bg, 9, 22);
    renderer.toneMappingExposure = mood.exposure; scene.environmentIntensity = mood.env;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, D * 3), mat(mood.floor, mood.floorR, mood.floorM)); floor.rotation.x = -Math.PI / 2; floor.position.z = D / 2; floor.receiveShadow = true; set.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat(mood.wall, 0.9)); back.position.set(0, H / 2, 0); back.receiveShadow = true; set.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), mat(mood.wall, 0.9)); left.rotation.y = Math.PI / 2; left.position.set(-W / 2, H / 2, D / 2); left.receiveShadow = true; set.add(left);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(mood.ceil, 0.95)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, D / 2); set.add(ceil);
    // fluted feature wall behind the unit (walnut / black lacquer) — instanced slats
    if (mood.flute) {
      const bk = new THREE.Mesh(new THREE.BoxGeometry(2.64, H, 0.012), mat(new THREE.Color(mood.back).multiplyScalar(0.28), 0.9)); bk.position.set(0, H / 2, 0.006); bk.receiveShadow = true; set.add(bk);
      const n = 46, sw = 2.6 / n; const slat = new THREE.InstancedMesh(new THREE.BoxGeometry(sw * 0.62, H, 0.035), mat(mood.back, k === 'noir' ? 0.35 : 0.55, k === 'noir' ? 0.2 : 0), n);
      const m4 = new THREE.Matrix4(); for (let i = 0; i < n; i++) { m4.makeTranslation(-1.3 + sw * (i + 0.5), H / 2, 0.018); slat.setMatrixAt(i, m4); } slat.castShadow = slat.receiveShadow = true; set.add(slat);
    } else { const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, H, 0.04), mat(mood.back, 0.7, k === 'tower' ? 0.2 : 0)); panel.position.set(0, H / 2, 0.02); panel.receiveShadow = true; set.add(panel); }
    // light lines: cove in the ceiling edge + a frame around the feature wall (they carry the bloom)
    const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    const cove = new THREE.Mesh(new THREE.BoxGeometry(W, 0.02, 0.03), glow(new THREE.Color(mood.cove).multiplyScalar(k === 'atelier' ? 1 : 2.2))); cove.position.set(0, H - 0.04, 0.05); set.add(cove);
    if (k === 'noir' || k === 'tower') [-1.32, 1.32].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.012, H - 0.2, 0.012), glow(new THREE.Color(mood.accent).multiplyScalar(2.6))); l.position.set(x, H / 2, 0.05); set.add(l); });
    // window (left wall): golden-hour glow, or a night city
    if (mood.window) {
      const wm = mood.window.city ? new THREE.MeshBasicMaterial({ map: cityMat || (cityMat = cityTex()), toneMapped: true }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(mood.window.glow).multiplyScalar(mood.window.i), toneMapped: false });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), wm); win.rotation.y = Math.PI / 2; win.position.set(-W / 2 + 0.01, 1.45, 2.9); set.add(win);
      const frame = mat(k === 'atelier' ? 0xdfe3e8 : 0x1a1a1c, 0.5, 0.4);
      [[0, 0.95 + 0.03, 2.66, 0.05], [0, -0.95 - 0.03, 2.66, 0.05], [1.3 + 0.03, 0, 0.05, 1.96], [-1.3 - 0.03, 0, 0.05, 1.96], [0, 0, 0.03, 1.9]].forEach(([zz, yy, ww, hh]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, hh, ww), frame); b.position.set(-W / 2 + 0.03, 1.45 + yy, 2.9 + zz); set.add(b); });
    }
    // light shafts from the window (additive gradient cards)
    if (mood.shafts) { const st = shaftTex(); for (let i = 0; i < 3; i++) { const sm = new THREE.MeshBasicMaterial({ map: st, color: mood.window ? mood.window.glow : 0xffffff, transparent: true, opacity: mood.shafts, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 4.2), sm); s.position.set(-W / 2 + 1.5, 1.2, 2.2 + i * 0.7); s.rotation.set(0, 0.25, 1.05); set.add(s); } }
    // furnishing per mood (simple, low-poly silhouettes — the unit stays the subject)
    if (k === 'aurora') {
      const side = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 0.42), mat(0x5a3d29, 0.45)); side.position.set(0, 0.31, 0.24); side.castShadow = side.receiveShadow = true; set.add(side); props.side = side;
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshStandardMaterial({ map: rugTex('#d8cbb7', '#9c7b55'), roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.3, 0.004, 2.6); rug.receiveShadow = true; set.add(rug);
      const sofa = new THREE.Group(); const sm = mat(0xcbbba6, 0.95); [[2.2, 0.42, 0.9, 0, 0.21, 0], [2.2, 0.45, 0.2, 0, 0.62, -0.35], [0.2, 0.62, 0.9, -1.0, 0.31, 0], [0.2, 0.62, 0.9, 1.0, 0.31, 0]].forEach(([a, b, c, x, y, z]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), sm); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; sofa.add(m); }); sofa.position.set(0.4, 0, 4.1); sofa.rotation.y = Math.PI; set.add(sofa);
      const lamp = new THREE.Group(); const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.5), mat(0x2b2118, 0.4, 0.6)); stem.position.y = 0.75; const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1dc, emissive: 0xffc98f, emissiveIntensity: 1.2, side: THREE.DoubleSide })); shade.position.y = 1.55; lamp.add(stem, shade); lamp.position.set(1.7, 0, 0.5); set.add(lamp);
    } else if (k === 'tower') {
      const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 1.1), mat(0x1c2230, 0.25, 0.5)); table.position.set(0.4, 0.74, 3.2); table.castShadow = table.receiveShadow = true; set.add(table);
      const legM = mat(0x0e1118, 0.4, 0.6); [[-0.9, 2.85], [1.7, 2.85], [-0.9, 3.55], [1.7, 3.55]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.05), legM); l.position.set(x, 0.36, z); set.add(l); });
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.5), mat(0x252b38, 0.8)); c.position.set(-0.6 + i * 0.7, 0.48, 2.45); c.castShadow = true; set.add(c); }
    } else if (k === 'noir') {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.2), mat(0x0c0c0d, 0.2, 0.6)); plinth.position.set(0, 0.03, 0.9); plinth.receiveShadow = true; set.add(plinth); props.plinth = plinth;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.008, 0.008), glow(new THREE.Color(mood.accent).multiplyScalar(2.4))); edge.position.set(0, 0.064, 1.5); set.add(edge);
    } else {
      const plant = new THREE.Group(); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.42, 32), mat(0xffffff, 0.6)); pot.position.y = 0.21; plant.add(pot);
      for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat(0x5f8a5a, 0.8)); lf.scale.set(0.6, 1.6, 0.25); lf.position.set(Math.sin(i * 2.4) * 0.14, 0.62 + (i % 3) * 0.14, Math.cos(i * 2.4) * 0.14); lf.rotation.set(Math.sin(i) * 0.5, i, Math.cos(i) * 0.4); plant.add(lf); }
      plant.position.set(-1.9, 0, 0.7); plant.traverse(m => { if (m.isMesh) m.castShadow = true; }); set.add(plant);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.45), mat(0xdfe3e8, 0.5)); bench.position.set(1.0, 0.21, 3.2); bench.castShadow = bench.receiveShadow = true; set.add(bench);
    }
    // lights
    const hemi = new THREE.HemisphereLight(mood.hemi[0], mood.hemi[1], mood.hemi[2]); lights.add(hemi);
    const key = new THREE.DirectionalLight(mood.key.c, mood.key.i); key.position.set(...mood.key.p); key.target.position.set(0, 1.4, 1.2); key.castShadow = true; key.shadow.mapSize.set(Q === 'high' ? 2048 : 1024, Q === 'high' ? 2048 : 1024); key.shadow.radius = 5; key.shadow.bias = -0.0004;
    const sc = key.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 0.5; sc.far = 20; lights.add(key, key.target);
    const fill = new THREE.DirectionalLight(mood.fill.c, mood.fill.i); fill.position.set(3, 2, 6); lights.add(fill);
    if (mood.spots) [[-2.2, 0xffd59a, 6], [2.4, 0xbfd4ff, 4]].forEach(([x, c, i]) => { const s = new THREE.SpotLight(c, i, 9, 0.42, 0.75, 1.6); s.position.set(x, H - 0.1, 2.4); s.target.position.set(0, 1.8, 0.2); s.castShadow = true; s.shadow.mapSize.set(1024, 1024); lights.add(s, s.target); });
    if (mood.window) { const wl = new THREE.PointLight(mood.window.glow, mood.window.city ? 2.5 : 6, 7, 1.6); wl.position.set(-W / 2 + 0.6, 1.6, 2.9); lights.add(wl); }
    const g = mood.grade; grade.uniforms.lift.value.set(...g.lift); grade.uniforms.gamma.value.set(...g.gamma); grade.uniforms.gain.value.set(...g.gain); grade.uniforms.sat.value = g.sat; grade.uniforms.grain.value = mood.grain; grade.uniforms.vig.value = mood.dark ? 0.42 : 0.26;
    if (bloom) { bloom.strength = mood.bloom[0]; bloom.radius = mood.bloom[1]; bloom.threshold = mood.bloom[2]; }
    if (air) air.set({ dark: mood.dark, alpha: mood.dark ? 0.42 : 0.7 });
    if (U) fitProps();
  }

  /* ---- the unit + its air ---- */
  const unitG = new THREE.Group(); scene.add(unitG);
  const air = createAirflow(scene, { count: Q === 'high' ? 1400 : Q === 'mid' ? 650 : 420, dark: false, width: 0.02, timeScale: 0.6, haze: 0.25, alpha: 0.72 });
  air.setRoom({ w: W, d: D, h: H, x0: 0, z0: D / 2 });
  let U = null, type = 'wall', dims = { w: 0.9, h: 0.3, d: 0.25 }, center = V(0, 2.2, 0.2), radius = 0.6, curDims = {};
  const shellMats = [], dispMats = [], dirtMats = [];
  const S = { power: 0, powerT: 1, mode: 'cool', swing: true, xray: 0, xrayT: 0, explode: 0, explodeT: 0, dirt: 0, dirtT: 0, cleaning: 0, spray: 0, auto: true, shot: 'hero' };
  const partHome = new Map();
  // r15: one built unit per type, kept — the 705 catalogue models are four bodies at different sizes, so switching between
  // models of a type only rescales (no rebuild, no new shaders, no texture uploads); a new type is built once
  const units = new Map();   // type → { U, M, shell, disp, dirt, home }
  function buildType(t) {
    const M2 = materialSet('studio');
    const U2 = buildUnit(t, M2, t === 'floor' ? { interior: true } : { interior: true, rod: 0.02 });
    if (U2.parts.pipes) U2.parts.pipes.visible = false; if (U2.parts.drain) U2.parts.drain.visible = false; if (U2.parts.hangers) U2.parts.hangers.visible = t === 'cassette';
    const home = new Map(), shell = [], disp = [], dirt = [];
    // exploded view: every part slides out along (its centre − unit centre) plus the face the unit shows the room
    // (front for wall / floor, underside for ceiling / cassette); outer parts travel further, the casing stays
    { const c0 = visBox(U2.root).getCenter(V(0, 0, 0)), bias = t === 'ceiling' || t === 'cassette' ? V(0, -1, 0) : V(0, 0, 1), dm = U2.dims, big = Math.max(dm.w, dm.h, dm.d);
      const list = Object.entries(U2.parts).filter(([id, g]) => g.visible && !/^(chassis|casing|pipes|drain|hangers)$/.test(id)).map(([id, g]) => { const c = visBox(g).getCenter(V(0, 0, 0)); return { g, rel: c.sub(c0) }; });
      const dots = list.map(x => x.rel.dot(bias)), lo = Math.min(...dots), hi = Math.max(...dots);
      list.forEach((x, i) => { const out = hi > lo ? (dots[i] - lo) / (hi - lo) : 1; const dir = V(x.rel.x / dm.w, x.rel.y / dm.h, x.rel.z / dm.d).multiplyScalar(0.6).add(bias.clone().multiplyScalar(0.9)).normalize(); home.set(x.g, { p0: x.g.position.clone(), off: dir.multiplyScalar(big * (0.18 + 0.42 * out)) }); }); }
    U2.root.traverse(m => {
      if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
      const mt = m.material; if (!mt) return;
      const ghost = m.userData.shell || (t === 'cassette' && (isIn(m, U2.parts.panel) || isIn(m, U2.parts.grille)));   // cassette: see up through the panel
      if (ghost && !shell.includes(mt)) { mt.transparent = true; mt.depthWrite = true; shell.push(mt); }
      if (mt.isMeshBasicMaterial && mt.map && !disp.includes(mt)) disp.push(mt);
    });
    [M2.filter, M2.fin, M2.blade, M2.pan].forEach(m2 => { if (m2 && m2.color) { m2.userData.c0 = m2.color.clone(); dirt.push(m2); } });
    const e = { U: U2, M: M2, shell, disp, dirt, home }; units.set(t, e); return e;
  }
  function setModel({ type: t = 'wall', w, h, d } = {}) {
    curDims = { w, h };
    if (U) { unitG.remove(U.root); partHome.forEach((hm, g) => g.position.copy(hm.p0)); }
    const e = units.get(t) || buildType(t);
    type = t; U = e.U; M = e.M;
    shellMats.length = dispMats.length = dirtMats.length = 0; shellMats.push(...e.shell); dispMats.push(...e.disp); dirtMats.push(...e.dirt);
    partHome.clear(); e.home.forEach((v, k) => partHome.set(k, v));
    U.root.position.set(0, 0, 0); U.root.rotation.set(0, 0, 0);
    const base = U.dims, sx = w ? w / base.w : 1, sy = h ? h / base.h : 1;
    const s = Math.max(0.7, Math.min(1.5, (sx + sy) / 2)); U.root.scale.setScalar(s);
    dims = { w: base.w * s, h: base.h * s, d: base.d * s };
    const E = placeUnit(t, U, s);
    unitG.add(U.root); fitProps();
    const bb = visBox(U.root); center = bb.getCenter(V(0, 0, 0)); radius = bb.getSize(V(0, 0, 0)).length() / 2;
    air.setEmitters(E); air.prewarm(Q === 'high' ? 140 : 80, 0.05);   // settle the jet before it is shown (fewer steps on phones)
    go(S.shot, true); frame();
    if (!preT) preT = setTimeout(preload, 900);
  }
  // r15: the other three bodies are built and their shaders compiled while the page is idle (one per idle moment, through the
  // post chain's own target), so the next type — a stage slot further down, another model — appears without a stall
  let preT = 0;
  function preload() {
    const t = ['wall', 'ceiling', 'cassette', 'floor'].find(k => !units.has(k)); if (!t || disposed) return;
    whenCalm(() => { if (disposed) return; if (!units.has(t)) buildType(t); whenCalm(() => { if (!disposed) warm(renderer, scene, cam, units.get(t).U.root, composer.renderTarget1); preload(); }, 400); }, 900);
  }
  let disposed = false;

  const isIn = (m, g) => { for (let p2 = m; p2; p2 = p2.parent) if (p2 === g) return true; return false; };
  // set pieces that would collide with a model: the sideboard makes room for a floor-standing unit, the noir plinth lifts it
  function fitProps() {
    if (props.side) props.side.visible = type !== 'floor';
    if (type === 'floor') U.root.position.y = props.plinth ? 0.06 : 0;
    U.root.updateMatrixWorld(true);
  }

  /* ---- camera: shots + gentle drift + drag to look around ---- */
  const camA = { p: V(3, 1.6, 4.5), t: V(0, 1.8, 0) }, camB = { p: V(), t: V() }; let shotT = 1, shotDur = 2.2;
  const SH = {
    hero: () => { const up = type === 'cassette' ? -0.55 : type === 'ceiling' ? -0.18 : type === 'floor' ? 0.1 : 0.0, dist = Math.max(3.0, radius * 5.4); return { p: center.clone().add(V(Math.sin(0.58) * dist, Math.sin(up) * dist + (type === 'cassette' ? 0 : 0.05), Math.cos(0.58) * dist)), t: center.clone() }; },
    close: () => { const dist = Math.max(1.1, radius * 2.0), up = type === 'cassette' ? -0.9 : type === 'ceiling' ? -0.35 : -0.08; return { p: center.clone().add(V(Math.sin(0.28) * dist, Math.sin(up) * dist, Math.cos(0.28) * dist)), t: center.clone().add(V(0, type === 'floor' ? 0.55 : -0.03, 0)) }; },
    air: () => { const hi = type === 'ceiling' || type === 'cassette'; return { p: V(W * 0.36, hi ? 1.2 : 1.35, D * 0.98), t: V(-0.2, hi ? 2.1 : 1.4, type === 'cassette' ? 2.3 : 1.6) }; },
    inside: () => { const dist = Math.max(1.3, radius * 2.4), up = type === 'cassette' ? -0.75 : type === 'ceiling' ? -0.3 : 0.05; return { p: center.clone().add(V(Math.sin(-0.35) * dist, Math.sin(up) * dist, Math.cos(-0.35) * dist)), t: center.clone() }; },
    wide: () => ({ p: V(W * 0.44, 1.7, D * 1.02), t: V(-0.3, 1.5, 0.9) }),
  };
  const AUTO = ['hero', 'close', 'air', 'wide'];
  function go(name, cut = false) {
    S.shot = SH[name] ? name : 'hero';
    const nx = SH[S.shot](); camA.p.copy(cut ? nx.p : cam.position); camA.t.copy(cut ? nx.t : look); camB.p.copy(nx.p); camB.t.copy(nx.t); shotT = cut ? 1 : 0;
    o.onShot && o.onShot(S.shot);
    if (S.shot === 'inside') { S.xrayT = 1; S.explodeT = 0.45; } else if (S.xrayT && !S.keepX) { S.xrayT = 0; S.explodeT = 0; }
  }
  const look = V(0, 1.8, 0); const yawOff = { v: 0, t: 0 }, pitchOff = { v: 0, t: 0 };
  let drag = null;
  const par = { x: 0, y: 0, vx: 0, vy: 0 };   // mouse parallax: the frame leans a little toward the pointer (not on touch)
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: yawOff.t, pitch: pitchOff.t }; S.auto = false; });
  addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && !drag) { const r = el.getBoundingClientRect(); par.x = ((e.clientX - r.left) / r.width - 0.5) * 2; par.y = ((e.clientY - r.top) / r.height - 0.5) * 2; api.kick(); }
    if (!drag) return; yawOff.t = Math.max(-0.9, Math.min(0.9, drag.yaw - (e.clientX - drag.x) * 0.004)); pitchOff.t = Math.max(-0.35, Math.min(0.35, drag.pitch + (e.clientY - drag.y) * 0.003)); });
  el.addEventListener('pointerleave', () => { par.x = par.y = 0; });

  /* ---- cleaning spray (water drops, not air) ---- */
  const NS = 260, spPos = new Float32Array(NS * 3), spVel = new Float32Array(NS * 3), spAge = new Float32Array(NS).fill(9);
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const spray = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0x9fd6ff, size: 0.012, transparent: true, opacity: 0.85, depthWrite: false })); spray.visible = false; scene.add(spray);

  /* ---- room sound: filtered noise that follows the fan (WebAudio — only ever started from a visitor's click) ---- */
  let snd = null;
  function sound(on) {
    if (!on) { if (snd) { snd.ctx.close(); snd = null; } return false; }
    if (snd) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ctx = new AC(), n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.35; }   // soft pink-ish noise
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(lp).connect(g).connect(ctx.destination); src.start();
    snd = { ctx, g }; api.kick(); return true;
  }

  /* ---- loop ---- */
  let raf = 0, last = performance.now(), clock = 0, autoT = 0, onScreen = true;
  const io = new IntersectionObserver(es => { onScreen = es.some(e => e.isIntersecting); if (onScreen && !raf && !RM()) { last = performance.now(); loop(); } }, { rootMargin: '120px 0px' }); io.observe(container);
  function step(dt) {
    clock += dt;
    const k = 1 - Math.pow(0.002, dt);   // frame-rate independent smoothing
    S.power += (S.powerT - S.power) * k * 0.6; S.xray += (S.xrayT - S.xray) * k; S.explode += (S.explodeT - S.explode) * k; S.dirt += (S.dirtT - S.dirt) * k * 0.5;
    if (U) {
      if (S.power > 0.5) animateUnit(U, dt, clock, S.mode === 'fan' ? 0.8 : 1);
      shellMats.forEach(m => { m.opacity = 1 - S.xray * 0.86; m.depthWrite = S.xray < 0.5; });
      dispMats.forEach(m => { m.opacity = 0.15 + 0.85 * S.power; m.transparent = true; });
      dirtMats.forEach(m => m.color.copy(m.userData.c0).lerp(DIRT_C, S.dirt * 0.75));
      partHome.forEach((h, g) => { g.position.copy(h.p0).addScaledVector(h.off, S.explode); });
    }
    air.set({ running: S.power > 0.5 && S.mode !== 'off', swing: S.swing, fan: S.mode === 'fan' ? 0.8 : 1, airF: 1 - S.dirt * 0.45, supplyT: S.mode === 'fan' ? 26 : S.mode === 'dry' ? 18 : 14, roomT: 29 });
    air.visible(S.power > 0.05); air.update(dt, clock);
    // spray during a clean
    if (S.cleaning > 0) {
      S.cleaning -= dt; spray.visible = true;
      for (let i = 0; i < NS; i++) {
        if (spAge[i] > 0.7) { spAge[i] = Math.random() * 0.1; const nz = center.clone().add(V((Math.random() - 0.5) * dims.w * 0.8, type === 'cassette' ? -0.5 : 0.25, type === 'cassette' ? 0 : dims.d + 0.35)); spPos.set([nz.x, nz.y, nz.z], i * 3); const v = center.clone().sub(nz).normalize().multiplyScalar(2.2 + Math.random()); spVel.set([v.x + (Math.random() - 0.5) * 0.5, v.y, v.z], i * 3); }
        spAge[i] += dt; spVel[i * 3 + 1] -= 3.2 * dt; for (let a = 0; a < 3; a++) spPos[i * 3 + a] += spVel[i * 3 + a] * dt;
      }
      spGeo.attributes.position.needsUpdate = true;
      if (S.cleaning <= 0) { spray.visible = false; S.dirtT = 0; S.xrayT = 0; S.explodeT = 0; o.onClean && o.onClean(); }
    }
    // camera
    if (S.auto && !RM()) { autoT += dt; if (autoT > 7.5) { autoT = 0; go(AUTO[(AUTO.indexOf(S.shot) + 1) % AUTO.length]); } }
    shotT = Math.min(1, shotT + dt / shotDur); const e = ease(shotT);
    yawOff.v += (yawOff.t - yawOff.v) * k; pitchOff.v += (pitchOff.t - pitchOff.v) * k;
    par.vx += (par.x - par.vx) * k * 0.35; par.vy += (par.y - par.vy) * k * 0.35;
    const p = camA.p.clone().lerp(camB.p, e); look.copy(camA.t).lerp(camB.t, e);
    const rel = p.clone().sub(look), sph = new THREE.Spherical().setFromVector3(rel); sph.theta += yawOff.v - par.vx * 0.05 + (RM() ? 0 : Math.sin(clock * 0.21) * 0.025); sph.phi = Math.max(0.2, Math.min(Math.PI - 0.2, sph.phi - pitchOff.v + par.vy * 0.025 + (RM() ? 0 : Math.sin(clock * 0.17) * 0.012)));
    // portrait screens: the vertical field of view stays, so the camera steps back to keep the subject's width in frame
    const asp = size.w && size.h ? size.w / size.h : 1.6; sph.radius *= asp < 1.25 ? Math.pow(1.25 / asp, 0.72) : 1;
    cam.position.copy(look).add(V(0, 0, 0).setFromSpherical(sph)); cam.lookAt(look);
    if (bokeh) bokeh.uniforms.focus.value = cam.position.distanceTo(center);
    if (snd) snd.g.gain.value += ((S.power > 0.5 && S.mode !== 'off' ? (S.mode === 'fan' ? 0.05 : 0.07) * (1 - S.dirt * 0.35) : 0) - snd.g.gain.value) * k * 0.5;
    grade.uniforms.time.value = clock;
  }
  function frame() {
    const r = container.getBoundingClientRect(), w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
    // framing offset: the subject sits beside the page's text (frame = [x, y] share of the width/height; frameM below 700 px)
    const fr = (w < 700 ? S.frameM : null) || S.frame || [0, 0];
    if (fr[0] !== size.fx || fr[1] !== size.fy) { size.fx = fr[0]; size.fy = fr[1]; size.w = 0; }
    if (w !== size.w || h !== size.h) { size.w = w; size.h = h; renderer.setSize(w, h, false); composer.setSize(w, h); cam.aspect = w / h; if (fr[0] || fr[1]) cam.setViewOffset(w, h, -fr[0] * w, fr[1] * h, w, h); else cam.clearViewOffset(); cam.updateProjectionMatrix(); grade.uniforms.aspect.value = w / h; if (bokeh) { bokeh.uniforms.aspect.value = w / h; bokeh.uniforms.aperture.value = mood.bokeh * (w < 700 ? 0.6 : 1); } }
    grade.uniforms.bars.value = o.bars ? 1 : 0;
    composer.render();
    if (o.onFrame && api) o.onFrame(api);
  }
  const size = { w: 0, h: 0 };
  function loop() {
    raf = 0; if (!onScreen) return;
    const now = performance.now();
    if (now - last < 1000 / FPS - 4) { raf = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt); frame(); raf = requestAnimationFrame(loop);
  }
  // model: null → no unit yet (the stage builds it in a later task, so booting is two shorter tasks instead of one long one)
  buildSet(o.mood); if (o.model !== null) setModel(o.model || { type: 'wall' });
  if (RM()) { S.power = S.powerT = 1; for (let i = 0; i < 40; i++) step(0.05); frame(); } else { last = performance.now(); loop(); }
  const ro = new ResizeObserver(() => { if (RM() || !raf) frame(); }); ro.observe(container);

  api = {
    state: S, get type() { return type; }, get host() { return container; }, get mood() { return moodKey; },
    setModel,
    // several settings at once (a stage slot's scene): {type,w,h,d, mood, shot, auto, power, mode, swing, xray, explode, dirt}
    scene(c = {}) {
      if (c.mood && c.mood !== moodKey) buildSet(c.mood);
      if (c.type && (!U || c.type !== type || c.w !== curDims.w || c.h !== curDims.h)) { curDims = { w: c.w, h: c.h }; setModel({ type: c.type, w: c.w, h: c.h, d: c.d }); }
      if (c.power != null) S.powerT = c.power ? 1 : 0; if (c.mode) S.mode = c.mode; if (c.swing != null) S.swing = !!c.swing;
      if (c.xray != null) { S.xrayT = c.xray ? 1 : 0; S.keepX = !!c.xray; } if (c.explode != null) S.explodeT = +c.explode; if (c.dirt != null) S.dirtT = +c.dirt;
      if ('frame' in c) S.frame = c.frame; if ('frameM' in c) S.frameM = c.frameM;
      // cut (no camera move) when asked — a slot taking over the canvas is a new scene, not a camera move
      if (c.shot && (c.shot !== S.shot || c.cut)) go(c.shot, !!c.cut);
      if (c.auto != null) { S.auto = !!c.auto; autoT = 0; }
      api.kick();
    },
    // move the canvas into another element (keeps the WebGL context, the set and the model)
    attach(host) {
      if (!host || host === container) return;
      io.unobserve(container); ro.unobserve(container); container = host; host.append(el); io.observe(host); ro.observe(host); slot.move(host);
      size.w = 0; frame(); api.kick();
    },
    // where a part of the unit is on screen (px inside the host) — for HTML labels drawn by the page
    anchor(id) {
      const g = U && (U.parts[id] || (id === 'unit' ? U.root : null)); if (!g) return null;
      const c = visBox(g).getCenter(V(0, 0, 0)).project(cam);
      return { x: (c.x + 1) / 2 * size.w, y: (1 - c.y) / 2 * size.h, on: c.z < 1 && Math.abs(c.x) < 1.05 && Math.abs(c.y) < 1.05 };
    },
    sound,
    shot: n => { S.auto = false; go(n); if (RM()) { for (let i = 0; i < 50; i++) step(0.05); frame(); } },
    auto: v => { S.auto = !!v; autoT = 0; },
    power: v => { S.powerT = v ? 1 : 0; api.kick(); }, mode: m => { S.mode = m; api.kick(); }, swing: v => { S.swing = !!v; api.kick(); },
    xray: v => { S.xrayT = v ? 1 : 0; S.keepX = !!v; api.kick(); }, explode: v => { S.explodeT = Math.max(0, Math.min(1, +v)); api.kick(); },
    dirt: v => { S.dirtT = Math.max(0, Math.min(1, +v)); api.kick(); },
    // dirty → spray → clean, ~4 s (x-ray on so the coil is visible)
    clean: () => { S.dirtT = 1; S.dirt = 1; S.xrayT = 0.85; S.cleaning = 4; S.auto = false; go('close'); api.kick(); },
    setMood: k => { buildSet(k); api.kick(); }, letterbox: v => { o.bars = !!v; api.kick(); },
    kick: () => { if (RM()) { for (let i = 0; i < 40; i++) step(0.05); frame(); } else if (!raf && onScreen) { last = performance.now(); loop(); } },
    frame, advance: sec => { for (let t = 0; t < sec; t += 0.05) step(0.05); frame(); }, quality: Q,
    // r15: what the owner's every-model walk checks — the unit that was built, its size on screen in metres (finite, > 0)
    probe() { if (!U) return null; U.root.updateMatrixWorld(true); const b = visBox(U.root).getSize(V(0, 0, 0)); return { type, dims: { ...dims }, box: [b.x, b.y, b.z], parts: Object.keys(U.parts).length }; },
    dispose() { disposed = true; clearTimeout(preT); sound(false); cancelAnimationFrame(raf); raf = 0; io.disconnect(); ro.disconnect(); slot.release(); air.dispose(); units.forEach(e => { if (e.U !== U) disposeDeep(e.U.root); }); units.clear(); disposeDeep(scene); composer.dispose && composer.dispose(); renderer.dispose(); renderer.forceContextLoss(); el.remove(); },
  };
  return api;
}
