// SBP AirCare — "How it works": mechanism view for the three main indoor-unit types (wall, ceiling-suspended, 4-way cassette).
// One detailed unit at a time (units3d.js), shown WHOLE with an x-ray casing (glass shell + outline) so the real mechanism is
// visible without cutting the machine in half; everything moves:
// fans spin, flaps/vanes swing, float switch bobs; air (warm → cold at the coil), condensate, drain and refrigerant flow as particles.
// Callouts sit in two columns at the sides with leader lines (they never overlap); on phones they collapse to numbered dots + legend.
// Principle illustration built from manufacturer documentation — proportions are indicative, not any specific model.
import { icon, iconLabel } from './icons.js';
import { mountThrowSim } from './throwsim3d.js';
import * as THREE from './three.module.min.js';
import { track as glTrack, warm, whenCalm } from './gl-pool.js';
import { createWisps, airTint } from './wisp3d.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { buildOutdoor, materialSet, canvasTex, orbit } from './ac3d.js';
import { buildUnit, animateUnit } from './units3d.js';
import { buildTrunk, bentPath, pathPoints, pipeMesh, pipeHanger } from './trunk3d.js';
import { TYPES, STEPS, LABELS } from './hw-data.js';
import { h } from './sbp-core.js';
export { TYPES, STEPS };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------- particles ---------------- */
const dotTex = (() => { let t; return () => t || (t = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); })();
function pointsMat(additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 }, map: { value: dotTex() } },
    vertexShader: 'attribute float alpha; attribute float psize; attribute vec3 pcol; varying float vA; varying vec3 vC; uniform float uScale; void main(){ vC=pcol; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=clamp(psize*uScale/max(0.1,-mv.z),1.0,14.0); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC,t.a*vA); if(gl_FragColor.a<0.02) discard; }',
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
function makePts(n, size, additive) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('pcol', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
  const ps = new Float32Array(n); for (let i = 0; i < n; i++) ps[i] = size * (0.7 + Math.random() * 0.6);
  g.setAttribute('psize', new THREE.BufferAttribute(ps, 1));
  const p = new THREE.Points(g, pointsMat(additive)); p.frustumCulled = false; p.renderOrder = 8; return p;
}
const lutOf = (pts, n = 360) => new THREE.CatmullRomCurve3(pts, false, 'centripetal').getSpacedPoints(n);
function fracNear(lut, p) { let bi = 0, bd = 1e9; lut.forEach((q, i) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; bi = i; } }); return bi / (lut.length - 1); }

// Rev.09 round 3: air is drawn as soft wisps (wisp3d.js) — every particle is a short tapering streamline of TR points
// along its own path (spacing TRD as a path fraction), translucent and de-saturated, so the flow reads as moving air
// rather than drops of water. Water / refrigerant flows (LineFlow, Drips) stay as particles.
const TR = 10, TRD = 0.011;
// air through a wall / ceiling unit: one (y,z) path, x spread across the fan, widening in the room
class SheetFlow {
  constructor(spec, n, cWarm, cCold, size, additive) {
    this.lut = lutOf(spec.yz.map(([y, z]) => V(0, y, z)));
    const [x0, x1] = spec.x; this.n = n; this.dark = !!additive;
    this.W = createWisps(null, { max: n * (TR - 1), additive, renderOrder: 8 }); this.pts = this.W.mesh;
    this.w = new Float32Array(n).map(() => size * (0.55 + Math.random() * 0.5)); this.sc = new Float32Array(TR * 3); this.c3 = [0, 0, 0];
    this.uCoil = fracNear(this.lut, V(0, ...spec.yz[spec.coil ?? 4])); this.uOut = fracNear(this.lut, V(0, ...spec.yz[spec.out ?? spec.yz.length - 4]));
    this.u = new Float32Array(n).map(() => Math.random()); this.x = new Float32Array(n).map(() => x0 + Math.random() * (x1 - x0)); this.j = new Float32Array(n * 2).map(() => (Math.random() - 0.5) * 0.02); this.sp = new Float32Array(n).map(() => 0.8 + Math.random() * 0.4);
    this.cw = new THREE.Color(cWarm); this.cc = new THREE.Color(cCold); this.tmp = new THREE.Color(); this.speed = 0.075; this.level = 1; this.target = 1; this.k = 1;
  }
  at(i, u) { return this.lut[Math.min(this.lut.length - 1, Math.floor(u * (this.lut.length - 1)))]; }
  place(i, u, o, pos) {
    const p = this.at(i, u), g = Math.max(0, u - this.uOut) * 3.2, gin = Math.max(0, this.uCoil * 0.5 - u) * 2;
    pos[o * 3] = this.x[i] * (1 + g * 0.9 + gin); pos[o * 3 + 1] = p.y + this.j[i * 2] * (1 + g * 7 + gin * 6); pos[o * 3 + 2] = p.z + this.j[i * 2 + 1] * (1 + g * 7 + gin * 6);
  }
  step(dt) {
    this.level += (this.target - this.level) * Math.min(1, dt * 4); this.pts.visible = this.level > 0.02; if (!this.pts.visible) return;
    const W = this.W, sc = this.sc, c3 = this.c3, base = this.dark ? 0.34 : 0.42; W.begin();
    for (let i = 0; i < this.n; i++) {
      this.u[i] += dt * this.speed * this.sp[i] * this.k; if (this.u[i] > 1) this.u[i] -= 1;
      const u0 = this.u[i]; if (u0 < TR * TRD) continue;   // whole wisp on the path (no wrap-around segment)
      for (let k = 0; k < TR; k++) this.place(i, u0 - k * TRD, k, sc);
      const m = clamp((u0 - this.uCoil + 0.03) / 0.08, 0, 1); this.tmp.copy(this.cw).lerp(this.cc, m);
      c3[0] = this.tmp.r; c3[1] = this.tmp.g; c3[2] = this.tmp.b; airTint(c3, this.dark);
      const a = Math.min(1, u0 * 14) * Math.min(1, (1 - u0) * 4) * this.level * base * (u0 > this.uOut ? 1 - 0.55 * Math.min(1, (u0 - this.uOut) * 4) : 1);
      const w = this.w[i] * (u0 > this.uOut ? 1 + (u0 - this.uOut) * 5 : 1);   // the jet widens and thins out once in the room
      for (let k = 0; k < TR - 1; k++) {
        const f0 = 1 - k / (TR - 1), f1 = 1 - (k + 1) / (TR - 1);
        W.seg(sc[k * 3], sc[k * 3 + 1], sc[k * 3 + 2], sc[k * 3 + 3], sc[k * 3 + 4], sc[k * 3 + 5], c3[0], c3[1], c3[2], a * f0 * f0, a * f1 * f1, w * (0.5 + 0.5 * f0), w * (0.5 + 0.5 * f1));
      }
    }
    W.end();
  }
}
// air through a 4-way cassette: radial (r, y) path, 4 directions, spread along each slot
class RadialFlow extends SheetFlow {
  constructor(spec, n, cWarm, cCold, size, additive) {
    super({ yz: spec.radial.map(([r, y]) => [y, r]), x: [-0.26, 0.26], coil: 7, out: 11 }, n, cWarm, cCold, size, additive);
    this.dir = new Uint8Array(n).map((_, i) => i % 4);
  }
  place(i, u, o, pos) {
    const D = RadialFlow.D, p = this.at(i, u), r = p.z, y = p.y, [dx, dz] = D[this.dir[i]];
    const f = r < 0.3 ? Math.max(0.05, r / 0.3) : 1 + Math.max(0, r - 0.45) * 0.9;
    const lat = this.x[i] * f;
    pos[o * 3] = dx * r + dz * lat + this.j[i * 2] * 0.5; pos[o * 3 + 1] = y + this.j[i * 2 + 1] * (1 + Math.max(0, r - 0.4) * 6); pos[o * 3 + 2] = dz * r - dx * lat + this.j[i * 2] * 0.5;
  }
}
RadialFlow.D = [[0, 1], [0, -1], [1, 0], [-1, 0]];
// particles along a 3D polyline (drain water, refrigerant, exhaust)
class LineFlow {
  constructor(pts, n, color, size, speed, jitter = 0.004, additive = false) {
    this.lut = lutOf(pts.map(p => V(...p)), 240); this.n = n; this.pts = makePts(n, size, additive); this.speed = speed; this.level = 1; this.target = 1;
    this.u = new Float32Array(n).map((_, i) => i / n); this.j = new Float32Array(n * 3).map(() => (Math.random() - 0.5) * jitter);
    const c = new THREE.Color(color), col = this.pts.geometry.attributes.pcol.array; for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  }
  step(dt) {
    this.level += (this.target - this.level) * Math.min(1, dt * 4); this.pts.visible = this.level > 0.02; if (!this.pts.visible) return;
    const P = this.pts.geometry.attributes, pos = P.position.array, al = P.alpha.array;
    for (let i = 0; i < this.n; i++) { this.u[i] = (this.u[i] + dt * this.speed) % 1; const p = this.lut[Math.floor(this.u[i] * (this.lut.length - 1))]; pos[i * 3] = p.x + this.j[i * 3]; pos[i * 3 + 1] = p.y + this.j[i * 3 + 1]; pos[i * 3 + 2] = p.z + this.j[i * 3 + 2]; al[i] = Math.min(1, this.u[i] * 12) * Math.min(1, (1 - this.u[i]) * 12) * this.level; }
    P.position.needsUpdate = P.alpha.needsUpdate = true;
  }
}
// condensate drops falling from the coil into the pan
class Drips {
  constructor(spec, n, color, size) {
    this.s = spec; this.n = n; this.pts = makePts(n, size, false); this.level = 1; this.target = 1;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n); for (let i = 0; i < n; i++) this.reset(i, true);
    const c = new THREE.Color(color), col = this.pts.geometry.attributes.pcol.array; for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  }
  reset(i, init) {
    const s = this.s;
    if (s.ring) { const side = i % 4, t = Math.random() * 0.62 - 0.31, r = s.ring[0] + Math.random() * (s.ring[1] - s.ring[0]); const xy = [[t, r], [t, -r], [r, t], [-r, t]][side]; this.p[i * 3] = xy[0]; this.p[i * 3 + 2] = xy[1]; this.p[i * 3 + 1] = 0.2 - Math.random() * (init ? 0.14 : 0.02); }
    else { this.p[i * 3] = s.x[0] + Math.random() * (s.x[1] - s.x[0]); this.p[i * 3 + 1] = s.y[0] + (init ? -Math.random() * (s.y[0] - s.y[1]) : 0); this.p[i * 3 + 2] = s.z + (Math.random() - 0.5) * 0.02; }
    this.v[i] = 0;
  }
  step(dt) {
    this.level += (this.target - this.level) * Math.min(1, dt * 4); this.pts.visible = this.level > 0.02; if (!this.pts.visible) return;
    const P = this.pts.geometry.attributes, pos = P.position.array, al = P.alpha.array, yb = this.s.ring ? 0.052 : this.s.y[1];
    for (let i = 0; i < this.n; i++) { this.v[i] += dt * (this.s.ring ? 0.25 : 0.9); this.p[i * 3 + 1] -= this.v[i] * dt; if (this.p[i * 3 + 1] < yb) this.reset(i); pos[i * 3] = this.p[i * 3]; pos[i * 3 + 1] = this.p[i * 3 + 1]; pos[i * 3 + 2] = this.p[i * 3 + 2]; al[i] = 0.9 * this.level; }
    P.position.needsUpdate = P.alpha.needsUpdate = true;
  }
}

/* ---------------- per-type scene setup (unit frame = world frame) ---------------- */
const WIDE = typeof matchMedia === 'function' ? matchMedia('(min-width:981px)') : { matches: false };
const CAMS = {
  wall: { overview: { t: [0.06, -0.03, 0.02], th: -0.62, ph: 1.38, r: 1.55 }, intake: { t: [0.0, 0.08, 0.02], th: -0.5, ph: 1.05, r: 1.25 }, filter: { t: [-0.05, 0.06, 0.04], th: -0.5, ph: 1.12, r: 1.1 }, coil: { t: [-0.05, 0.02, 0.05], th: -0.6, ph: 1.28, r: 1.1 }, water: { t: [-0.2, -0.1, 0.03], th: -0.6, ph: 1.78, r: 1.15 }, fan: { t: [-0.05, -0.05, 0.03], th: -0.35, ph: 1.66, r: 1.0 }, throw: { t: [0.05, -0.35, 0.5], th: -0.55, ph: 1.3, r: 2.1 }, outdoor: { t: [-1.0, -0.36, 0.0], th: -0.3, ph: 1.38, r: 3.7 } },
  ceiling: { overview: { t: [0.3, -0.03, 0.02], th: -0.62, ph: 1.85, r: 2.0 }, intake: { t: [0.1, -0.1, -0.05], th: -0.55, ph: 2.1, r: 2.0 }, filter: { t: [0.0, -0.09, -0.08], th: -0.5, ph: 2.05, r: 1.8 }, fan: { t: [0.0, -0.01, -0.06], th: -0.62, ph: 1.82, r: 1.7 }, coil: { t: [0.0, 0.01, 0.1], th: -0.55, ph: 1.72, r: 1.7 }, water: { t: [0.35, -0.09, 0.15], th: -0.72, ph: 1.9, r: 1.5 }, throw: { t: [0.25, -0.35, 0.9], th: -0.5, ph: 1.62, r: 2.8 }, outdoor: { t: [0.95, -0.28, -0.3], th: 0.3, ph: 1.42, r: 3.8 } },
  cassette: { overview: { t: [0.0, 0.06, 0.0], th: 0.78, ph: 1.98, r: 2.0 }, intake: { t: [0.0, -0.02, 0.0], th: 0.7, ph: 2.35, r: 1.8 }, filter: { t: [0.0, 0.0, 0.0], th: 0.75, ph: 2.22, r: 1.6 }, fan: { t: [0.0, 0.12, 0.0], th: 0.78, ph: 2.08, r: 1.55 }, coil: { t: [0.0, 0.13, 0.0], th: 0.6, ph: 1.98, r: 1.65 }, water: { t: [0.2, 0.1, -0.2], th: 0.85, ph: 1.98, r: 1.45 }, throw: { t: [0.0, -0.22, 0.0], th: 0.78, ph: 2.1, r: 3.0 }, outdoor: { t: [0.75, -0.45, -0.35], th: 0.95, ph: 1.45, r: 3.6 } },
};
// Rev.08: frame the whole unit with some room around it (overview) and keep the part close-ups a little wider
for (const t in CAMS) for (const k in CAMS[t]) CAMS[t][k].r *= k === 'overview' ? 1.45 : (k === 'outdoor' || k === 'throw') ? 1.05 : 1.2;
// section plane: everything of the indoor unit on the removed side is cut away (fins, fan blades, casing) to show the real cross-section
const CUT = { wall: [V(1, 0, 0), 0.05], ceiling: [V(1, 0, 0), -0.15], cassette: [V(-Math.SQRT1_2, 0, -Math.SQRT1_2), 0.06 * Math.SQRT1_2] };
// callout anchors on the section face (used while the unit is cut open)
const SEC = {
  wall: { intake: [0.14, 0.155, 0.0], filter: [-0.04, 0.128, 0.03], coil: [-0.045, 0.06, 0.075], fan: [-0.045, -0.035, 0.005], motor: [0.3, -0.035, 0.0], pan: [-0.04, -0.094, 0.07], drain: [0.5, -0.12, 0.05], louver: [0.12, -0.134, 0.1], vanes: [-0.02, -0.12, 0.04], pipes: [-0.4, -0.42, -0.15] },
  ceiling: { intake: [0.38, -0.118, -0.12], filter: [0.16, -0.1, -0.16], fan: [0.16, 0.04, -0.09], scroll: [0.16, 0.087, -0.13], coil: [0.16, 0.025, 0.11], pan: [0.16, -0.094, 0.22], drain: [0.72, -0.098, 0.2], louver: [0.32, -0.06, 0.355], vanes: [0.42, -0.05, 0.285], pcb: [0.55, 0.08, -0.13], pipes: [0.45, 0.05, -0.45] },
  cassette: { intake: [-0.12, -0.04, -0.12], filter: [-0.22, -0.004, -0.1], bell: [-0.14, 0.04, -0.12], fan: [-0.16, 0.14, 0.02], motor: [-0.03, 0.26, -0.03], coil: [-0.319, 0.17, 0.2], pan: [-0.33, 0.046, 0.2], pump: [0.33, 0.13, -0.33], float: [0.29, 0.05, -0.37], drain: [0.33, 0.205, -0.47], louver: [-0.37, -0.04, 0.1], pipes: [0.12, 0.15, -0.56] },
};
const OUT_AT = { wall: { p: [-1.95, -0.62, 0.0], ry: 0 }, ceiling: { p: [1.85, -0.62, -0.46], ry: 0 }, cassette: { p: [1.46, -0.95, -0.55], ry: Math.PI / 2 } };
// tidy pipe routes (trunk centre-lines, lid normals, wall caps). Wall faces: wall type z = −0.16 · ceiling type back wall z = −0.62 ·
// cassette type exterior wall x = 1.30. D = 0.055 → centre-line sits D/2 off the surface.
const ROUTE = {
  wall: { c: [[-0.345, -0.14, -0.1325], [-0.345, -0.28, -0.1325], [-0.47, -0.405, -0.1325], [-1.47, -0.405, -0.1325], [-1.47, -0.62, -0.1325]], lids: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]], caps: [{ at: [-1.12, -0.405, -0.1325], n: [1, 0, 0] }] },
  ceiling: { c: [[0.435, 0.05, -0.43], [0.435, 0.05, -0.5925], [2.33, 0.05, -0.5925], [2.33, -0.6, -0.5925]], lids: [[0, -1, 0], [0, 0, 1], [0, 0, 1]], caps: [{ at: [1.3, 0.05, -0.5925], n: [1, 0, 0] }] },
  cassette: { c: [[1.3275, 0.13, -1.0], [1.3275, -0.35, -1.0], [1.3275, -0.47, -1.12], [1.3275, -1.0, -1.12]], lids: [[1, 0, 0], [1, 0, 0], [1, 0, 0]], caps: [{ at: [1.3, 0.13, -1.0], n: [1, 0, 0] }] },
};

export function createHowItWorks3D(container, opts = {}) {
  const o = { theme: 'light', onFrame: null, ...opts };
  const dark = o.theme === 'dark', bp = o.theme === 'blueprint';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.localClippingEnabled = true;
  renderer.toneMapping = bp ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 1.0 : 1.08;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  if (!bp) { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = dark ? 0.5 : 0.85; }
  glTrack(renderer, container, { scene, name: 'หลักการทำงาน', onScale: () => resize() });   // r15: point sizes follow the pixel ratio   // B1: context budget (gl-pool)
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x1b2330 : 0xc9d3de, bp ? 1.7 : dark ? 0.55 : 0.75));
  const key = new THREE.DirectionalLight(0xffffff, bp ? 1.0 : 1.6); key.position.set(1.6, 2.2, 2.6); scene.add(key);
  if (dark) { const rim = new THREE.DirectionalLight(0x6fc8ff, 1.6); rim.position.set(-2, 1, -1.5); scene.add(rim); }
  const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 60);
  const M = materialSet(bp ? 'blueprint' : dark ? 'showroom' : 'studio');
  const accent = new THREE.Color(dark ? 0xff8a3d : 0xe2711d);
  const ctxMat = new THREE.MeshStandardMaterial({ color: dark ? 0x1a232e : bp ? 0xf1f5fa : 0xeef1f4, roughness: 0.95 });
  const ctxMat2 = new THREE.MeshStandardMaterial({ color: dark ? 0x222d3a : bp ? 0xe6edf6 : 0xe2e7ec, roughness: 0.9 });
  const glassMat = new THREE.MeshBasicMaterial({ color: dark ? 0x3a5068 : 0xbfd6ea, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const pipeMat = new THREE.MeshStandardMaterial({ color: bp ? 0x9fb3cf : 0x1c1f23, roughness: 0.85 });
  const cols = { warm: dark ? 0xff9a52 : 0xf07a2e, cold: dark ? 0x55d6ff : 0x1597e8, water: dark ? 0x7cc8ff : 0x2a7fd4, liq: dark ? 0x62b8ff : 0x1f6fd1, gas: dark ? 0xb4e6ff : 0x5bb6e8, hot: 0xff6a2a };
  const cutPlane = new THREE.Plane(V(-1, 0, 0), 100);
  const st = { type: null, step: -1, cut: false, xray: true, layers: { air: true, water: true, refr: true }, t: 0, vis: true, cam: { t: V(0, 0, 0), th: 0.6, ph: 1.4, r: 1.6 }, fly: null, userAt: 0 };
  const orbitState = { theta: 0.6, phi: 1.4, radius: 1.6, minR: 0.5, maxR: 6, wheelZoom: false, userAt: 0 };
  orbit(renderer.domElement, orbitState, () => { st.fly = null; st.cam.th = orbitState.theta; st.cam.ph = orbitState.phi; st.userAt = performance.now(); });
  const cache = {};

  // x-ray casing: the whole machine stays visible — casing turns to glass with a crisp outline so the mechanism shows through
  function setupXray(U, type) {
    const list = [...U.shells];
    if (type === 'cassette') ['panel', 'grille'].forEach(id => U.parts[id] && U.parts[id].traverse(o => (o.isMesh || o.isInstancedMesh) && list.push(o)));
    const lineMat = new THREE.LineBasicMaterial({ color: dark ? 0x86a3c0 : bp ? 0x2c6cb8 : 0x6f859c, transparent: true, opacity: 0.6 });
    const edges = [];
    list.forEach(o => { o.material.transparent = true; if (!o.isInstancedMesh && o.geometry) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 30), lineMat); e.visible = false; e.raycast = () => {}; o.add(e); edges.push(e); } });
    return { set(on) { list.forEach(o => { o.material.opacity = on ? (o.isInstancedMesh ? 0.22 : 0.12) : 1; o.material.depthWrite = !on; o.material.needsUpdate = true; }); edges.forEach(e => e.visible = on); } };
  }
  function tube(pts, r, mat) { return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(...p))), 48, r, 10), mat); }
  function build(type) {
    if (cache[type]) return cache[type];
    const G = new THREE.Group(); G.visible = false; scene.add(G);
    const U = buildUnit(type, M, { rod: type === 'ceiling' ? 0.3 : 0.38 });
    // per-mesh materials (highlight + clipping per part)
    U.root.traverse(ob => { if (ob.isMesh || ob.isInstancedMesh) { ob.material = ob.material.clone(); ob.userData.baseE = ob.material.emissive ? ob.material.emissive.clone() : null; } });
    U.root.traverse(ob => { if (ob.material) { ob.material.clippingPlanes = [cutPlane]; if (ob.userData.shell || ob.isMesh && !ob.isInstancedMesh) ob.material.side = THREE.DoubleSide; } });
    if (!bp) ['fan'].forEach(id => U.parts[id] && U.parts[id].traverse(ob => { if (ob.material && ob.material.color && type !== 'cassette') ob.material.color.set(dark ? 0x9aa7b5 : 0xb3bfcc); }));
    G.add(U.root);
    if (type === 'wall') { U.parts.chassis.children.filter(c => c.geometry && c.geometry.type === 'CylinderGeometry').forEach(c => c.visible = false); if (U.parts.drain) U.parts.drain.visible = false; }
    // context: wall / ceiling slab / ceiling board, outside partition, outdoor unit, pipes
    const ctx = new THREE.Group(); G.add(ctx);
    let camLimit;
    if (type === 'wall') {
      const w = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.4, 0.08), ctxMat); w.position.set(-0.8, -0.3, -0.2); ctx.add(w);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.006), M.metal.clone()); plate.material.clippingPlanes = [cutPlane]; plate.position.set(0, 0, -0.158); ctx.add(plate);
      camLimit = p => { p.z = Math.max(p.z, 0.05); };
    } else if (type === 'ceiling') {
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 2.4), ctxMat); s.position.set(0.4, 0.1175 + 0.3 + 0.06, 0.0); ctx.add(s);
      const w = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 0.08), ctxMat2); w.position.set(1.0, -0.45, -0.66); ctx.add(w);
      camLimit = p => { p.y = Math.min(p.y, 0.35); p.z = Math.max(p.z, -0.55); };
    } else {
      const bs = new THREE.Shape(); bs.moveTo(-1.6, -1.6); bs.lineTo(1.6, -1.6); bs.lineTo(1.6, 1.6); bs.lineTo(-1.6, 1.6); bs.closePath();
      const hl = new THREE.Path(); hl.moveTo(-0.43, -0.43); hl.lineTo(-0.43, 0.43); hl.lineTo(0.43, 0.43); hl.lineTo(0.43, -0.43); hl.closePath(); bs.holes.push(hl);
      const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.012, bevelEnabled: false }); bg.rotateX(Math.PI / 2);
      const board = new THREE.Mesh(bg, ctxMat.clone()); board.position.y = 0.012; board.material.clippingPlanes = [cutPlane]; board.material.side = THREE.DoubleSide; ctx.add(board);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 3.2), ctxMat2); slab.position.set(0, 0.246 + 0.38 + 0.06, 0); ctx.add(slab);
      const ext = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.1, 1.7), ctxMat2); ext.position.set(1.26, -0.4, -0.9); ctx.add(ext);   // exterior wall strip the pipe run passes through
      camLimit = p => { p.y = Math.min(p.y, -0.05); };
    }
    // outside: partition + outdoor unit
    const oa = OUT_AT[type], OU = buildOutdoor(M); OU.root.traverse(ob => { if (ob.isMesh || ob.isInstancedMesh) ob.material = ob.material.clone(); });
    const og = new THREE.Group(); og.position.set(...oa.p); og.rotation.y = oa.ry; og.add(OU.root); ctx.add(og); og.updateMatrixWorld(true);
    const ob = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.4), M.metal); ob.position.set(0, -0.3, 0); og.add(ob);
    const part = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), glassMat); part.rotation.y = Math.PI / 2; part.position.set(type === 'wall' ? -1.12 : 1.3, -0.5, 0); ctx.add(part);
    const vw = og.localToWorld(V(0.39, -0.16, 0.08)), vw2 = og.localToWorld(V(0.39, -0.16, 0.12));
    // ---- tidy pipe run: trunking with fittings + insulated pipes bent at right angles ----
    const RT = ROUTE[type], TR = buildTrunk(RT.c, RT.lids, { caps: RT.caps, blueprint: bp }); ctx.add(TR.group);
    const trunkMats = TR.mats.map(m => { m.transparent = true; m.opacity = 1; return m; });
    const offs = (side, depth) => RT.c.map((p, i) => {   // pipe centre-line inside the trunk, `side` across the face, `depth` toward the wall
      const seg = k => { const a = V(...RT.c[k]), b = V(...RT.c[k + 1]), n = V(...RT.lids[k]); return { s: n.clone().cross(b.sub(a).normalize()), n }; };
      const ks = [i - 1, i].filter(k => k >= 0 && k < RT.c.length - 1).map(seg);
      const sv = ks.reduce((a, q) => a.add(q.s), V(0, 0, 0)).normalize(), nv = ks.reduce((a, q) => a.add(q.n), V(0, 0, 0)).normalize();
      return V(...p).add(sv.multiplyScalar(side)).add(nv.multiplyScalar(-depth)).toArray();
    });
    const inT = side => offs(side, 0.004), E = RT.c[RT.c.length - 1];
    let liq, gas, drn;
    if (type === 'wall') {
      liq = [[-0.41, 0.08, 0.04], [-0.41, -0.05, 0.0], [-0.331, -0.12, -0.1365], ...inT(0.014), [-1.456, -0.78, -0.1365], [-1.456, -0.78, vw.z], [vw.x + 0.005, vw.y, vw.z]];
      gas = [[-0.41, 0.1, 0.0], [-0.42, 0.02, -0.06], [-0.359, -0.12, -0.1365], ...inT(-0.014), [-1.484, -0.7, -0.1365], [-1.484, -0.7, vw2.z], [vw2.x + 0.03, -0.7, vw2.z], [vw2.x + 0.03, vw2.y, vw2.z], [vw2.x + 0.005, vw2.y, vw2.z]];
      drn = [[0.3, -0.093, 0.07], [-0.2, -0.093, 0.07], [-0.44, -0.097, 0.07], [-0.47, -0.11, 0.05], [-0.43, -0.145, -0.08], [-0.345, -0.15, -0.145], ...offs(0, 0.016), [E[0], -1.25, E[2] - 0.016]];
    } else if (type === 'ceiling') {
      liq = [[0.445, -0.05, 0.16], [0.405, 0.05, 0.0], [0.405, 0.05, -0.36], ...inT(-0.017), [2.313, -0.78, -0.5965], [2.313, -0.78, vw.z], [vw.x + 0.005, vw.y, vw.z]];
      gas = [[0.445, 0.09, 0.05], [0.465, 0.07, -0.1], [0.465, 0.05, -0.36], ...inT(0.017), [2.347, -0.7, -0.5965], [2.347, -0.7, vw2.z], [vw2.x + 0.055, -0.7, vw2.z], [vw2.x + 0.055, vw2.y, vw2.z], [vw2.x + 0.005, vw2.y, vw2.z]];
      drn = [[0.1, -0.09, 0.19], [0.52, -0.094, 0.2], [0.66, -0.098, 0.2], [0.74, -0.1, 0.2], [0.78, -0.12, 0.1], [0.78, -0.14, -0.58], [0.78, -1.35, -0.585]];
      const DT = buildTrunk([[0.78, -0.12, -0.6], [0.78, -1.35, -0.6]], [[0, 0, 1]], { W: 0.05, D: 0.04, endCap: false, blueprint: bp }); ctx.add(DT.group); DT.mats.forEach(m => { m.transparent = true; trunkMats.push(m); });
    } else {
      liq = [[0.319, 0.1, -0.2], [0.2, 0.11, -0.3], [0.12, 0.11, -0.49], [0.12, 0.11, -0.983], [1.29, 0.11, -0.983], ...inT(-0.017).map((p, i) => i === 0 ? [p[0], 0.11, p[2]] : p), [1.3235, -1.11, -1.103], [vw.x, -1.11, -1.103], [vw.x, vw.y, vw.z - 0.005]];
      gas = [[0.297, 0.2, -0.2], [0.2, 0.15, -0.3], [0.12, 0.15, -0.49], [0.12, 0.15, -1.017], [1.29, 0.15, -1.017], ...inT(0.017).map((p, i) => i === 0 ? [p[0], 0.15, p[2]] : p), [1.3235, -1.05, -1.137], [vw2.x, -1.05, -1.137], [vw2.x, -1.05, -0.99], [vw2.x, vw2.y, -0.99], [vw2.x, vw2.y, vw2.z - 0.005]];
      drn = [[-0.32, 0.052, -0.3], [0.1, 0.052, -0.32], [0.3, 0.045, -0.33], [0.33, 0.14, -0.34], [0.33, 0.205, -0.5], [0.33, 0.19, -0.95], [1.29, 0.17, -0.95], ...offs(0, 0.016).map((p, i) => i === 0 ? [p[0], 0.17, p[2]] : p), [E[0] - 0.016, -1.4, E[2]]];
      // insulated pipes + drain above the ceiling hang from the slab on rods and clamps
      [[0.12, -0.75], [0.7, -1.0]].forEach(([x, z], k) => ctx.add(pipeHanger([x, 0.1, z], k ? 0 : Math.PI / 2, 0.52, M.metal)));
    }
    const LP = bentPath(liq, 0.03), GP = bentPath(gas, 0.035), DP = bentPath(drn, 0.03);
    const drainMat = new THREE.MeshStandardMaterial({ color: bp ? 0xc6d3e4 : 0x8e959b, roughness: 0.45 });
    ctx.add(pipeMesh(LP, 0.011, pipeMat), pipeMesh(GP, 0.016, pipeMat), pipeMesh(DP, 0.0105, drainMat));
    liq = pathPoints(LP, 200); gas = pathPoints(GP, 220); const drainPts = pathPoints(DP, 200);
    // flows
    const add = f => { G.add(f.pts); return f; };
    const size = type === 'wall' ? 0.011 : 0.014;
    const keep = { wall: [-0.03, 0.28], ceiling: [0.17, 0.48], cassette: null }[type];
    const air = add(type === 'cassette' ? new RadialFlow(U.paths, 520, cols.warm, cols.cold, size * 0.85, dark) : new SheetFlow({ ...U.paths.air, x: keep || U.paths.air.x }, 380, cols.warm, cols.cold, size * 0.85, dark));
    const drips = add(new Drips(keep ? { ...U.paths.drips, x: [keep[0], Math.min(keep[1], U.paths.drips.x[1])] } : U.paths.drips, type === 'cassette' ? 90 : 60, cols.water, 0.008));
    const drain = add(new LineFlow(drainPts, 110, cols.water, 0.009, 0.12));
    const lq = add(new LineFlow(liq.slice().reverse(), 160, cols.liq, 0.012, 0.09, 0.002));
    const gs = add(new LineFlow(gas, 170, cols.gas, 0.016, 0.09, 0.003));
    const ex = new LineFlow([[0, 0, 0.14], [0, 0, 0.5], [0, 0.05, 0.9]], 160, cols.hot, 0.03, 0.5, 0.25, !bp); og.add(ex.pts);
    ex.pts.position.set(-0.1, 0, 0);
    const outFan = OU.parts['o-fan'].userData.spin;
    cache[type] = { G, U, OU, og, air, drips, drain, lq, gs, ex, outFan, camLimit, TR, trunkMats, xr: setupXray(U, type) };
    return cache[type];
  }

  function setType(type) {
    Object.values(cache).forEach(c => c.G.visible = false);
    const C = build(type); C.G.visible = true; st.type = type;
    const [n, c] = CUT[type]; cutPlane.normal.copy(n); cutPlane.constant = st.cut ? c : 100; C.xr.set(st.xray);
    st.step = -1; applyVisual(); flyTo(CAMS[type].overview, true);
  }
  function applyVisual() {
    const C = cache[st.type]; if (!C) return;
    const s = STEPS[st.type][st.step], on = new Set(s ? s.parts : []);
    Object.entries(C.U.parts).forEach(([id, g]) => g.traverse(ob => { const m = ob.material; if (!m || !m.emissive) return; ob.userData.hl = on.has(id); if (!on.has(id)) { m.emissive.copy(ob.userData.baseE || new THREE.Color(0)); m.emissiveIntensity = 1; } }));
    const k = s && s.k;
    C.air.target = st.layers.air ? (!k || ['intake', 'filter', 'coil', 'fan', 'throw'].includes(k) ? 1 : 0.25) : 0;
    const w = st.layers.water ? (!k || k === 'water' ? 1 : 0.2) : 0; C.drips.target = w; C.drain.target = w;
    ['o-front', 'o-top', 'o-side', 'o-grille'].forEach(id => C.OU.parts[id] && C.OU.parts[id].traverse(ob => { if (!ob.material) return; const see = k === 'outdoor' && id !== 'o-grille'; ob.material.transparent = see; ob.material.opacity = see ? 0.28 : 1; ob.material.depthWrite = !see; ob.material.needsUpdate = true; }));
    const fanStep = k === 'fan'; C.U.parts.coil && C.U.parts.coil.traverse(ob => { if (!ob.material) return; ob.material.transparent = fanStep; ob.material.opacity = fanStep ? 0.22 : 1; ob.material.depthWrite = !fanStep; });
    const see = ['coil', 'outdoor'].includes(k); C.trunkMats.forEach(m => { m.opacity = 1; m.depthWrite = true; });   // trunking stays solid white (finished look); flow shows on the exposed pipe ends
    const r = st.layers.refr ? (!k || ['coil', 'outdoor'].includes(k) ? 1 : 0.2) : 0; C.lq.target = r; C.gs.target = r; C.ex.target = st.layers.refr ? (!k || k === 'outdoor' ? 1 : 0.3) : 0;
  }
  function flyTo(c, instant) {
    const to = { t: V(...c.t), th: c.th, ph: c.ph, r: c.r };
    if (instant || RM()) { st.cam = to; st.fly = null; } else st.fly = { from: { t: st.cam.t.clone(), th: st.cam.th, ph: st.cam.ph, r: st.cam.r }, to, t0: performance.now(), dur: 1300 };
    orbitState.theta = to.th; orbitState.phi = to.ph;
  }
  function focus(i) { st.step = i; applyVisual(); const s = STEPS[st.type][i]; flyTo(s ? CAMS[st.type][s.k] : CAMS[st.type].overview); }

  // anchors in world space for the callout layer
  const tmp = V(0, 0, 0);
  function anchors() {
    const C = cache[st.type]; if (!C) return [];
    const s = STEPS[st.type][st.step];
    const ids = s ? s.lab.filter(id => !st.cut || id.startsWith('o-') || id.startsWith('x-') || SEC[st.type][id]) : { wall: ['intake', 'filter', 'coil', 'fan', 'motor', 'pan', 'louver'], ceiling: ['intake', 'filter', 'fan', 'scroll', 'coil', 'pan', 'louver'], cassette: ['intake', 'filter', 'fan', 'coil', 'pan', 'pump', 'louver'] }[st.type];
    const W = container.clientWidth, H = container.clientHeight, out = [];
    ids.forEach(id => {
      let p;
      if (id.startsWith('x-')) { const a = C.TR.anchors[id.slice(2)]; if (!a) return; p = tmp.set(...a); }
      else if (id.startsWith('o-')) { const a = { 'o-fan': [-0.1, 0.0, 0.16], 'o-comp': [0.3, 0.0, 0.0], 'o-coil': [-0.3, 0.12, -0.13] }[id]; p = C.og.localToWorld(tmp.set(...a)); }
      else { const a = (st.cut && SEC[st.type][id]) || C.U.anchors[id]; if (!a) return; p = tmp.set(...a); }
      const v = p.clone().project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
      out.push({ id, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, on: !!s });
    });
    return out;
  }

  function resize() { const W = container.clientWidth || 1, H = container.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W / H < 0.9 ? 46 : 34; camera.updateProjectionMatrix(); psBase = H * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); }
  let psBase = 400; new ResizeObserver(resize).observe(container); resize();
  new IntersectionObserver(es => st.vis = es[0].isIntersecting).observe(container);
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    if (!st.vis || document.hidden || !st.type) return;
    const rm = RM(), d = rm ? 0 : dt; st.t += d;
    const C = cache[st.type];
    if (st.fly) { const k = clamp((now - st.fly.t0) / st.fly.dur, 0, 1), e = ease(k), f = st.fly.from, t = st.fly.to; st.cam.t.lerpVectors(f.t, t.t, e); st.cam.r = f.r + (t.r - f.r) * e; st.cam.th = f.th + (t.th - f.th) * e; st.cam.ph = f.ph + (t.ph - f.ph) * e; if (k >= 1) st.fly = null; orbitState.theta = st.cam.th; orbitState.phi = st.cam.ph; }
    else if (!rm && now - st.userAt > 6000 && st.step < 0) { st.cam.th += d * 0.05 * Math.sin(st.t * 0.25); orbitState.theta = st.cam.th; }
    const R = st.cam.r * (camera.aspect < 1 ? 1.12 : 1), sp = Math.sin(st.cam.ph);
    camera.position.set(st.cam.t.x + R * sp * Math.sin(st.cam.th), st.cam.t.y + R * Math.cos(st.cam.ph), st.cam.t.z + R * sp * Math.cos(st.cam.th));
    C.camLimit(camera.position); camera.lookAt(st.cam.t);
    // motion
    animateUnit(C.U, d, st.t, 1); C.outFan.rotation.z -= d * 11;
    const pulse = 0.2 + Math.sin(st.t * 3.2) * 0.1;
    C.U.root.traverse(ob => { if (ob.userData.hl && ob.material && ob.material.emissive) { ob.material.emissive.copy(accent); ob.material.emissiveIntensity = pulse; } });
    const ps = psBase * clamp(st.cam.r / 2.2, 0.45, 1.1);
    [C.air, C.drips, C.drain, C.lq, C.gs, C.ex].forEach(f => { const u = f.pts.material.uniforms.uScale; if (u) u.value = ps; f.step(d); });   // wisps (air) size themselves per camera
    renderer.render(scene, camera);
    o.onFrame && o.onFrame(anchors());
  }
  requestAnimationFrame(frame);
  // r15: the other types are built and their shaders compiled while the page is idle (one per idle moment), so a type tab
  // switches at once instead of stalling on the GPU compiling a new set of materials
  let preT = 0;
  function preload() {
    const t = ['wall', 'ceiling', 'cassette'].find(k => !cache[k]); if (!t || ++preT > 3) return;
    // compiled as it will be shown (x-ray state)
    whenCalm(() => { if (cache[t]) return preload(); const C = build(t); C.xr.set(st.xray); whenCalm(() => { warm(renderer, scene, camera, C.G); preload(); }, 400); }, 800);
  }
  setTimeout(preload, 600);

  return {
    setType(t) { setType(t); },
    focus, overview() { st.step = -1; applyVisual(); flyTo(CAMS[st.type].overview); },
    setCut(v) { st.cut = !!v; const [, c] = CUT[st.type]; cutPlane.constant = st.cut ? c : 100; },
    setXray(v) { st.xray = !!v; const C = cache[st.type]; C && C.xr.set(st.xray); },
    setLayer(k, v) { st.layers[k] = !!v; applyVisual(); },
    get type() { return st.type; }, get step() { return st.step; },
  };
}

/* ================================================================== */
/* Air-throw section (2D, animated) — where the cold air goes in a room */
/* ================================================================== */
function throwSvg(type) {
  const S = 52, x0 = 36, yc = 30, yf = 30 + 3 * S;   // 1 m = 52 px, ceiling 3.0 m
  const X = m => x0 + m * S, Y = m => yf - m * S;
  const person = (m, k) => `<g class="tw-person" transform="translate(${X(m)},${yf})"><circle cx="0" cy="${-1.6 * S}" r="${0.12 * S}"/><path d="M${-0.14 * S} ${-1.42 * S}h${0.28 * S}l${0.05 * S} ${0.7 * S}h${-0.38 * S}zM${-0.12 * S} ${-0.72 * S}h${0.1 * S}v${0.72 * S}h${-0.1 * S}zM${0.02 * S} ${-0.72 * S}h${0.1 * S}v${0.72 * S}h${-0.1 * S}z"/></g>`;
  const ticks = Array.from({ length: 13 }, (_, i) => `<g class="tw-tick"><path d="M${X(i)} ${yf + 4}v6"/><text x="${X(i)}" y="${yf + 22}">${i}</text></g>`).join('');
  let unit = '', jets = '', note = '';
  const jet = (d, i) => `<path class="tw-jet" style="animation-delay:${-i * 0.45}s" d="${d}"/>`;
  if (type === 'wall') {
    unit = `<rect class="tw-wallside" x="${x0 - 8}" y="${yc}" width="8" height="${yf - yc}"/><rect class="tw-unit" x="${x0}" y="${Y(2.35)}" width="${0.25 * S}" height="${0.3 * S}" rx="4"/>`;
    jets = [0, 1, 2, 3].map(i => jet(`M${X(0.3)} ${Y(2.2)} C ${X(1.6 + i * 0.4)} ${Y(1.9 - i * 0.12)}, ${X(3.2 + i * 0.6)} ${Y(1.2 - i * 0.1)}, ${X(4.8 + i * 0.7)} ${Y(0.5 + i * 0.05)} S ${X(6.2 + i * 0.5)} ${Y(0.2)}, ${X(6.6 + i * 0.4)} ${Y(0.12)}`, i)).join('');
    note = 'ติดผนังสูงราว 2.2–2.5 ม. ลมเป่าลงเฉียง ห้องลึกเกิน ~6–7 ม. ด้านไกลจะเย็นช้ากว่า';
  } else if (type === 'ceiling') {
    unit = `<rect class="tw-wallside" x="${x0 - 8}" y="${yc}" width="8" height="${yf - yc}"/><rect class="tw-unit" x="${x0}" y="${yc}" width="${0.69 * S}" height="${0.24 * S}" rx="4"/>`;
    jets = [0, 1, 2, 3].map(i => jet(`M${X(0.72)} ${Y(2.85 - i * 0.03)} C ${X(3 + i * 0.4)} ${Y(2.9 - i * 0.05)}, ${X(6 + i * 0.5)} ${Y(2.75 - i * 0.12)}, ${X(8.5 + i * 0.4)} ${Y(1.9 - i * 0.2)} S ${X(10.2 + i * 0.3)} ${Y(0.6)}, ${X(10.6 + i * 0.3)} ${Y(0.15)}`, i)).join('');
    note = 'ลมเกาะแนวฝ้า (Coanda) แล้วค่อยตกลงด้านไกล เหมาะห้องยาว · ห้ามมีคานหรือของขวางแนวลมใต้ฝ้า';
  } else {
    const c = 6;
    unit = `<rect class="tw-unit" x="${X(c) - 0.475 * S}" y="${yc - 2}" width="${0.95 * S}" height="${0.1 * S}" rx="3"/>`;
    jets = [0, 1, 2].flatMap(i => [jet(`M${X(c + 0.4)} ${Y(2.93)} C ${X(c + 1.6 + i * 0.3)} ${Y(2.9 - i * 0.05)}, ${X(c + 3 + i * 0.3)} ${Y(2.5 - i * 0.15)}, ${X(c + 3.8 + i * 0.3)} ${Y(1.2)} S ${X(c + 4.1 + i * 0.3)} ${Y(0.3)}, ${X(c + 4.2 + i * 0.3)} ${Y(0.12)}`, i), jet(`M${X(c - 0.4)} ${Y(2.93)} C ${X(c - 1.6 - i * 0.3)} ${Y(2.9 - i * 0.05)}, ${X(c - 3 - i * 0.3)} ${Y(2.5 - i * 0.15)}, ${X(c - 3.8 - i * 0.3)} ${Y(1.2)} S ${X(c - 4.1 - i * 0.3)} ${Y(0.3)}, ${X(c - 4.2 - i * 0.3)} ${Y(0.12)}`, i + 3)]).join('') + `<path class="tw-in" d="M${X(c)} ${Y(1.6)}V${Y(2.85)}"/>`;
    note = 'เครื่องอยู่กลางฝ้า ลมออก 4 ทิศ (ภาพตัดเห็น 2 ทิศ) · 1 เครื่องครอบคลุมรัศมีราว 3–5 ม. ห้องใหญ่ใช้หลายเครื่องเรียงเป็นตาราง';
  }
  const people = type === 'cassette' ? person(2.2) + person(9.6) : person(3.2) + person(7.6);
  return `<svg viewBox="0 0 700 ${yf + 34}" class="tw-svg" role="img" aria-label="ทิศทางลมในห้อง ${TYPES[type].th}">
    <rect class="tw-ceil" x="${x0 - 8}" y="${yc - 8}" width="${12.6 * S}" height="8"/><rect class="tw-floor" x="${x0 - 8}" y="${yf}" width="${12.6 * S}" height="4"/>
    ${ticks}<text class="tw-u" x="${X(12.3)}" y="${yf + 22}">ม.</text>${people}${jets}${unit}</svg><p class="tw-note">${note}</p>`;
}

/* ================================================================== */
/* UI wrapper                                                          */
/* ================================================================== */
export function mountHowItWorks(root, cfg = {}) {
  root.classList.add('hw');
  const tabs = h('div', { class: 'hw-tabs', role: 'tablist', 'aria-label': 'ประเภทแอร์' });
  const stage = h('div', { class: 'hw-stage' });
  const coSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); coSvg.setAttribute('class', 'hw-lines'); coSvg.setAttribute('aria-hidden', 'true');
  const coBox = h('div', { class: 'hw-co-layer', 'aria-hidden': 'true' });
  const cap = h('div', { class: 'hw-cap', 'aria-live': 'polite', title: 'แตะเพื่ออ่านทั้งหมด' }); cap.addEventListener('click', () => cap.classList.toggle('open'));
  const ctrl = h('div', { class: 'hw-ctrl' });
  const legendM = h('ol', { class: 'hw-legend-m' });
  const list = h('ol', { class: 'hw-steps' });
  const facts = h('dl', { class: 'hw-facts' });
  const tw = h('div', { class: 'hw-throw' });
  const fb = h('div', { class: 'hw-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ ขั้นตอนด้านข้างยังอ่านได้ครบ');
  stage.append(coSvg, coBox, cap, ctrl, fb);
  root.append(tabs, h('div', { class: 'hw-main' }, h('div', { class: 'hw-left' }, stage, legendM, h('div', { class: 'hw-keys' }, ...[['warm', 'ลมอุ่นจากห้อง'], ['cold', 'ลมเย็นหลังผ่านคอยล์'], ['water', 'น้ำทิ้ง'], ['liq', 'น้ำยาเหลว (ท่อเล็ก)'], ['gas', 'ไอน้ำยากลับ (ท่อใหญ่)'], ['hot', 'ความร้อนที่คอยล์ร้อนระบายออก']].map(([k, t]) => h('span', {}, h('i', { class: 'k-' + k }), t)))), h('div', { class: 'hw-side' }, list, facts)),
    h('div', { class: 'hw-throw-card' }, h('h3', {}, 'ลมเย็นไปทางไหนในห้อง — ลองสั่งงานเองในห้องจริง 12 เมตร'), h('p', { class: 'hw-throw-sub' }, 'เลือกเครื่อง 4 แบบ แล้วสั่งงานจาก' + ({ panel: 'แผงควบคุมห้อง', glass: 'แผงสัมผัส' }[cfg.throwStyle] || 'รีโมต') + ': เปิด/ปิด โหมด อุณหภูมิ ความแรงลม บานสวิงขึ้นลง/ซ้ายขวา · เส้นลมเปลี่ยนสีตามอุณหภูมิ: ฟ้าเข้ม = ลมเย็นจากเครื่อง · ฟ้าอ่อน/ขาว = ผสมกับอากาศในห้องแล้ว · ส้ม = อากาศอุ่นจากคน หน้าต่าง เครื่องใช้ไฟฟ้า ที่ลอยขึ้นแล้วไหลกลับเข้าเครื่อง · พื้นแสดงอุณหภูมิระดับตัวคน · คนที่ร้อนจะพัดมือ'), tw),
    h('p', { class: 's-note' }, 'ภาพจำลองหลักการทำงานจากโครงสร้างตามเอกสารผู้ผลิต สัดส่วนและรูปทรงไม่ใช่รุ่นใดรุ่นหนึ่ง ฝาครอบแสดงแบบมองทะลุเพื่อเห็นกลไกด้านใน (ปิดได้ที่ "มองทะลุตัวเครื่อง") · ระยะลมเป็นค่าโดยประมาณ ขึ้นกับรุ่น ความเร็วพัดลม และสภาพห้อง'));
  let type = cfg.start || 'wall', step = -1, V3 = null, timer = null, playing = false;
  const btn = (label, fn, cls = '', aria) => h('button', { type: 'button', class: cls, onclick: fn, 'aria-label': aria || null }, label);
  const play = iconLabel(btn('เล่นทีละขั้น', () => toggle(), 'hw-play'), 'play', 'เล่นทีละขั้น');
  const prev = btn('‹', () => go(step <= 0 ? STEPS[type].length - 1 : step - 1), 'hw-nav', 'ขั้นก่อนหน้า'), next = btn('›', () => go((step + 1) % STEPS[type].length), 'hw-nav', 'ขั้นถัดไป');
  const tg = (label, on, fn) => h('label', { class: 'hw-tg' }, h('input', { type: 'checkbox', checked: on, onchange: e => fn(e.target.checked) }), label);
  ctrl.append(prev, play, next, btn('ภาพรวม', () => go(-1), 'hw-ov'), h('span', { class: 'hw-sep' }), tg('มองทะลุตัวเครื่อง', true, v => V3 && V3.setXray(v)), tg('ลม', true, v => V3 && V3.setLayer('air', v)), tg('น้ำทิ้ง', true, v => V3 && V3.setLayer('water', v)), tg('น้ำยา', true, v => V3 && V3.setLayer('refr', v)), tg('ชื่อชิ้นส่วน', true, v => { showLab = v; coBox.hidden = coSvg.hidden = !v; }));
  let showLab = true;
  let TS = null, near = false, pendT = false;
  function toggle() { playing = !playing; iconLabel(play, playing ? 'pause' : 'play', playing ? 'หยุด' : 'เล่นทีละขั้น'); clearInterval(timer); if (playing) { go(step < 0 ? 0 : (step + 1) % STEPS[type].length); timer = setInterval(() => go((step + 1) % STEPS[type].length), 6500); } }
  function go(i) { step = i; if (V3) (i < 0 ? V3.overview() : V3.focus(i)); render(); }
  function render() {
    tabs.innerHTML = '';
    Object.entries(TYPES).forEach(([k, t]) => tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': k === type, onclick: () => { if (k === type) return; type = k; step = -1; if (playing) toggle(); V3 && V3.setType(k); render(); cfg.onType && cfg.onType(k); } }, t.th)));
    const S = STEPS[type];
    list.innerHTML = '';
    S.forEach((s, i) => list.append(h('li', { class: i === step ? 'on' : '' }, h('button', { type: 'button', 'aria-current': i === step ? 'step' : null, onclick: () => { if (playing) toggle(); go(i); } }, h('span', {}, String(i + 1)), h('b', {}, s.t)), i === step ? h('p', {}, s.d) : null)));
    cap.innerHTML = ''; cap.classList.remove('open');
    if (step >= 0) cap.append(h('span', { class: 'hw-n' }, String(step + 1)), h('div', {}, h('b', {}, S[step].t), h('p', {}, S[step].d)));
    else cap.append(h('div', {}, h('b', {}, `${TYPES[type].th} ทำงานอย่างไร`), h('p', {}, 'ตัวเครื่องแสดงแบบมองทะลุ เห็นกลไกจริงที่กำลังทำงานทั้งเครื่อง กด "เล่นทีละขั้น" หรือเลือกขั้นตอน ลากภาพเพื่อหมุนดู')));
    const T = TYPES[type]; facts.innerHTML = '';
    [['ลมเข้า', T.inlet], ['ลมออก', T.outlet], ['พัดลม', T.fan], ['น้ำทิ้ง', T.drain], ['ลักษณะลม', T.throw], ['เหมาะกับ', T.rooms], ['จุดที่ช่างล้าง', T.clean]].forEach(([a, b]) => facts.append(h('dt', {}, a), h('dd', {}, b)));
    if (TS) { if (near) TS.setType(type); else pendT = true; }   // r8: off screen → applied when the section comes near
    coKey = '';
  }
  // callouts: two side columns with leader lines — laid out every frame, never overlapping
  let coKey = '', els = {};
  function layout(list) {
    if (!showLab) return;
    const W = stage.clientWidth, H = stage.clientHeight, narrow = W < 620;
    const key = type + step + list.map(a => a.id).join(',') + narrow;
    if (key !== coKey) {
      coKey = key; coBox.innerHTML = ''; els = {};
      list.forEach((a, i) => { const e = h('div', { class: 'hw-co' + (a.on ? ' on' : '') + (narrow ? ' dot' : '') }, narrow ? String(i + 1) : LABELS[a.id] || a.id); coBox.append(e); els[a.id] = { e, n: i + 1 }; });
      legendM.innerHTML = ''; if (narrow) list.forEach((a, i) => legendM.append(h('li', {}, h('span', {}, String(i + 1)), LABELS[a.id] || a.id)));
      legendM.hidden = !narrow;
    }
    let d = '';
    if (narrow) {
      const P = list.map(a => ({ a, x: a.x, y: a.y }));
      for (let it = 0; it < 16; it++) for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y, dd = Math.hypot(dx, dy) || 0.01; if (dd < 26) { const k = (26 - dd) / 2 / dd; P[i].x -= dx * k; P[i].y -= dy * k; P[j].x += dx * k; P[j].y += dy * k; } }
      P.forEach(q => { const E = els[q.a.id]; if (!E) return; E.e.style.transform = `translate(${q.x - 11}px,${q.y - 11}px)`; if (Math.hypot(q.x - q.a.x, q.y - q.a.y) > 3) d += `<path d="M${q.a.x} ${q.a.y}L${q.x} ${q.y}"/><circle cx="${q.a.x}" cy="${q.a.y}" r="2.5"/>`; });
      coSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); coSvg.innerHTML = d; return;
    }
    const capEl = stage.querySelector('.hw-cap'), capTop = WIDE.matches;   // Rev.08: caption sits at the top on wide screens
    const top = capTop ? capEl.offsetHeight + 24 : 14, bottom = capTop ? H - 64 : H - (capEl.offsetHeight + 72), gap = 34;
    const cols = [list.filter(a => a.x < W / 2).sort((p, q) => p.y - q.y), list.filter(a => a.x >= W / 2).sort((p, q) => p.y - q.y)];
    cols.forEach((col, ci) => {
      let y = top; const ys = col.map(a => { y = Math.max(y, clamp(a.y, top, bottom)); const r = y; y += gap; return r; });
      const over = ys.length ? ys[ys.length - 1] - bottom : 0; if (over > 0) for (let i = ys.length - 1, lim = bottom; i >= 0; i--) { ys[i] = Math.min(ys[i], lim); lim = ys[i] - gap; }
      col.forEach((a, i) => {
        const E = els[a.id]; if (!E) return; const w = E.e.offsetWidth || 100;
        const lx = ci === 0 ? 12 : W - 12 - w, ly = ys[i];
        E.e.style.transform = `translate(${lx}px,${ly - 14}px)`;
        const ex = ci === 0 ? lx + w : lx, mx = ci === 0 ? ex + 22 : ex - 22;
        d += `<path d="M${ex} ${ly}H${mx}L${a.x} ${a.y}"/><circle cx="${a.x}" cy="${a.y}" r="4"/>`;
      });
    });
    coSvg.setAttribute('viewBox', `0 0 ${W} ${H}`); coSvg.innerHTML = d;
  }
  render();
  TS = mountThrowSim(tw, { theme: cfg.theme, type, style: cfg.throwStyle, fallback: () => { const d = h('div'); d.innerHTML = throwSvg(type); return d; } });
  const boot = () => { try { V3 = createHowItWorks3D(stage, { theme: cfg.theme, onFrame: layout }); V3.setType(type); if (step >= 0) V3.focus(step); } catch (e) { console.warn('how-it-works 3D unavailable', e); fb.hidden = false; } };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '500px 0px' }); io.observe(stage);
  // r8: a type chosen elsewhere (services, the B system view) while this section is off screen is built when it comes near —
  // rebuilding the unit + the room air for an invisible scene used to freeze that click
  const nio = new IntersectionObserver(es => { near = es.some(e => e.isIntersecting); if (near && pendT) { pendT = false; V3 && V3.setType(type); TS && TS.setType(type); } }, { rootMargin: '300px 0px' }); nio.observe(root);
  const K = { grille: 'intake', front: 'intake', intake: 'intake', filter: 'filter', coil: 'coil', fan: 'fan', blower: 'fan', motor: 'fan', pan: 'water', pump: 'water', drain: 'water', louver: 'throw', outdoor: 'outdoor' };
  return {
    setType(t) { if (t === type || !TYPES[t]) return; type = t; step = -1; if (playing) toggle(); if (near) V3 && V3.setType(t); else pendT = true; render(); },
    focusPart(p) { const i = STEPS[type].findIndex(s => s.k === K[p]); if (i >= 0) { if (playing) toggle(); go(i); } },
  };
}
