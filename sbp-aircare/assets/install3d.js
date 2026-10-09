// SBP AirCare — realistic home scene for the technician stories (C) and the system sequence (B) — Rev.08.
// A furnished living room cut away like a doll's house (oak floor, plaster walls, window with curtains, sofa, rug, TV,
// shelf, plants), a partition wall with a sliding glass door to a tiled balcony, and a complete, tidy installation:
//   • indoor unit (wall / ceiling-suspended / cassette) on the back wall or ceiling
//   • white 75 mm PVC trunking (base channel + snap-on lids + real fittings: inside corner, flat elbows, end caps, joint)
//     from the unit along the wall, through the partition, down the balcony wall to the condensing unit
//   • inside the trunking: O-TWO copper (0.70 mm wall) in black Aeroflex insulation (printed), blue PVC drain,
//     Yazaki THW cores (brown / blue / green-yellow); copper is exposed only at the flare nuts on the service valves
//   • condensing unit on a galvanised floor stand with rubber pads, blue drain ending over the balcony floor drain
//   • RCBO in a small enclosure with its own mini trunking up to the main run
// Everything that a step can show or hide is returned as named handles; flows (refrigerant, drain water, power) get
// dense point paths. Geometry is illustrative (not a copy of any manufacturer's product); brand names are printed text.
import * as THREE from './three.module.min.js';
import { track as glTrack } from './gl-pool.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { buildPremiumIndoor, buildOutdoor, materialSet, canvasTex } from './ac3d.js';
import { buildCeilingUnit, buildCassetteUnit } from './units3d.js';
import { mats, rbox, F, windowUnit, TEX } from './roomkit3d.js';
import { kit, printed } from './matkit3d.js';
import { bentPath } from './trunk3d.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const RM = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* =====================================================================================================
   Stage: renderer + lights + orbiting camera with fly-to, pointer drag, visibility-gated render loop
   ===================================================================================================== */
export function createStage(container, o = {}) {
  const dark = o.theme === 'dark';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure ?? (dark ? 1.0 : 1.04);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' }); renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = dark ? 0.5 : 0.72;
  glTrack(renderer, container, { scene, name: o.name || 'บ้านจำลอง' });   // B1: context budget (gl-pool)
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x151b22 : 0xbcc4cc, dark ? 0.42 : 0.62));
  const sun = new THREE.DirectionalLight(0xfff0da, dark ? 1.35 : 2.05); sun.position.set(-3.2, 6.8, 5.6); sun.target.position.set(0.9, 0.6, -0.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6.2, right: 6.2, top: 5.2, bottom: -4.2, near: 1, far: 26 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(dark ? 0x7fb8ff : 0xdfe9ff, dark ? 0.5 : 0.32); fill.position.set(6, 3, 5); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.04, 90);
  const cam = { t: V(0.8, 1.2, -0.4), r: 8, th: 0.3, ph: 1.2 }; let fly = null, userAt = -1e9;
  function flyTo(c, dur = 1500) {
    const to = { t: c.t.isVector3 ? c.t.clone() : V(...c.t), r: c.r, th: c.th, ph: c.ph };
    if (RM() || dur <= 0) { cam.t.copy(to.t); cam.r = to.r; cam.th = to.th; cam.ph = to.ph; fly = null; return; }
    // shortest way round
    const dth = Math.atan2(Math.sin(to.th - cam.th), Math.cos(to.th - cam.th)); to.th = cam.th + dth;
    fly = { from: { t: cam.t.clone(), r: cam.r, th: cam.th, ph: cam.ph }, to, t0: performance.now(), dur };
  }
  const el = renderer.domElement; el.style.touchAction = 'pan-y'; let drag = null;
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph, id: e.pointerId }; fly = null; });
  const onMove = e => { if (!drag || e.pointerId !== drag.id) return; cam.th = drag.th - (e.clientX - drag.x) * 0.006; if (e.pointerType !== 'touch') cam.ph = clamp(drag.ph - (e.clientY - drag.y) * 0.005, 0.55, 1.6); userAt = performance.now(); };
  const onUp = () => { drag = null; };
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
  let W = 1, H = 1;
  const resize = () => { W = container.clientWidth || 1; H = container.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W / H < 0.95 ? 50 : W / H < 1.4 ? 40 : 34; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  let vis = false; const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { rootMargin: '120px 0px' }); io.observe(container);
  const hooks = [], post = [];
  let last = performance.now(), clock = 0, alive = true;
  function frame(now) {
    if (!alive) return; requestAnimationFrame(frame);
    const raw = clamp((now - last) / 1000, 0, 0.5), dt = Math.min(raw, 0.05); last = now;
    if (!vis || document.hidden) return;
    const rm = RM(); clock += rm ? 0 : dt;
    if (fly) { const k = clamp((now - fly.t0) / fly.dur, 0, 1), e = ease(k); cam.t.lerpVectors(fly.from.t, fly.to.t, e); cam.r = fly.from.r + (fly.to.r - fly.from.r) * e; cam.th = fly.from.th + (fly.to.th - fly.from.th) * e; cam.ph = fly.from.ph + (fly.to.ph - fly.from.ph) * e; if (k >= 1) fly = null; }
    else if (!rm && !drag && now - userAt > 5000 && o.drift !== false) cam.th += Math.sin(clock * 0.21) * 0.00035;
    for (const f of hooks) f(rm ? 0 : dt, clock, raw);
    const narrow = camera.aspect < 0.95, R = cam.r * (narrow ? 1.12 : camera.aspect < 1.4 ? 1.06 : 1), sp = Math.sin(cam.ph);
    camera.position.set(cam.t.x + R * sp * Math.sin(cam.th), cam.t.y + R * Math.cos(cam.ph), cam.t.z + R * sp * Math.cos(cam.th)); camera.lookAt(cam.t);
    renderer.render(scene, camera);
    for (const f of post) f(camera, W, H);
  }
  requestAnimationFrame(frame);
  return {
    renderer, scene, camera, cam, flyTo, el, container,
    onFrame: f => hooks.push(f), onAfter: f => post.push(f),
    get size() { return { W, H }; }, get flying() { return !!fly; },
    advance(sec) { for (let t = 0; t < sec; t += 0.05) { clock += 0.05; for (const f of hooks) f(0.05, clock, 0.05); } if (fly) { fly.t0 -= fly.dur; } },
    dispose() { alive = false; ro.disconnect(); io.disconnect(); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); renderer.dispose(); el.remove(); },
  };
}

/* =====================================================================================================
   Labels: numbered callouts in two tidy columns (left / right of the picture), sorted top-to-bottom, never
   overlapping, joined to their parts by right-angle leader lines. Narrow screens: numbered dots only.
   ===================================================================================================== */
export function createLabels(container) {
  const layer = document.createElement('div'); layer.className = 'hl-layer'; layer.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'hl-svg'); layer.append(svg);
  container.append(layer);
  let items = [], sig = '';
  const P = new THREE.Vector3();
  function set(list) {
    const s = list.map(l => l.text).join('|'); if (s === sig) return; sig = s;
    items.forEach(it => it.el.remove()); svg.innerHTML = '';
    items = list.map((l, i) => {
      const el = document.createElement('div'); el.className = 'hl' + (l.warn ? ' warn' : '');
      el.innerHTML = `<b>${l.n ?? i + 1}</b><span></span>`; el.querySelector('span').textContent = l.text; layer.append(el);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '3.5'); svg.append(path, dot);
      return { ...l, el, path, dot, w: 0 };
    });
  }
  const ray = new THREE.Raycaster(); let occ = [], tick = 0;
  function update(camera, W, H) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    // occlusion by walls (checked every few frames)
    if (occ.length && (tick++ % 6 === 0)) for (const it of items) { const p = typeof it.at === 'function' ? it.at() : it.at; if (!p) continue; const d = camera.position.distanceTo(p); ray.set(camera.position, p.clone().sub(camera.position).normalize()); ray.far = d - 0.06; it.hidden = ray.intersectObjects(occ, false).length > 0; }
    const narrow = W < 600; layer.classList.toggle('dots', narrow);
    const vis = [];
    for (const it of items) {
      const p = typeof it.at === 'function' ? it.at() : it.at; if (!p) { it.el.style.display = 'none'; it.path.style.display = it.dot.style.display = 'none'; continue; }
      P.copy(p).project(camera);
      const ok = !it.hidden && P.z < 1 && Math.abs(P.x) < 1.05 && Math.abs(P.y) < 1.05;
      if (!ok) { it.el.style.display = 'none'; it.path.style.display = it.dot.style.display = 'none'; continue; }
      it.ax = (P.x + 1) / 2 * W; it.ay = (1 - P.y) / 2 * H; it.el.style.display = ''; it.path.style.display = it.dot.style.display = '';
      if (!it.w) { it.w = it.el.offsetWidth || 120; it.h = it.el.offsetHeight || 26; }
      vis.push(it);
    }
    if (narrow) {
      for (const it of vis) { it.el.style.transform = `translate(${(it.ax - 11).toFixed(1)}px,${(it.ay - 11).toFixed(1)}px)`; it.path.setAttribute('d', ''); it.dot.setAttribute('cx', -99); }
      return;
    }
    // split into columns by the anchor's side of the picture, then balance
    const mid = W / 2; let L = vis.filter(i => i.ax < mid), R = vis.filter(i => i.ax >= mid);
    while (L.length > R.length + 2) { L.sort((a, b) => b.ax - a.ax); R.push(L.shift()); }
    while (R.length > L.length + 2) { R.sort((a, b) => a.ax - b.ax); L.push(R.shift()); }
    const gap = 8, top = 12, bottom = H - 12;
    const place = (col, left) => {
      col.sort((a, b) => a.ay - b.ay);
      let y = top; col.forEach(it => { it.ly = Math.max(y, it.ay - it.h / 2); y = it.ly + it.h + gap; });
      // pull the column back up if it runs off the bottom
      let over = y - gap - bottom; for (let i = col.length - 1; i >= 0 && over > 0; i--) { const it = col[i]; const prevEnd = i ? col[i - 1].ly + col[i - 1].h + gap : top; const room = it.ly - prevEnd; const mv = Math.min(over, Math.max(0, room)); for (let k = i; k < col.length; k++) col[k].ly -= mv; over -= mv; }
      col.forEach(it => {
        const lx = left ? 12 : W - 12 - it.w, cy = it.ly + it.h / 2, ex = left ? lx + it.w : lx;
        it.el.style.transform = `translate(${lx.toFixed(1)}px,${it.ly.toFixed(1)}px)`;
        const mx = left ? Math.min(it.ax - 14, ex + 18) : Math.max(it.ax + 14, ex - 18);
        it.path.setAttribute('d', `M${ex.toFixed(1)} ${cy.toFixed(1)}H${mx.toFixed(1)}L${it.ax.toFixed(1)} ${it.ay.toFixed(1)}`);
        it.dot.setAttribute('cx', it.ax.toFixed(1)); it.dot.setAttribute('cy', it.ay.toFixed(1));
      });
    };
    place(L, true); place(R, false);
  }
  return { set, update, clear: () => set([]), layer, occluders(list) { occ = list || []; } };
}

/* =====================================================================================================
   Lane geometry: offset a centre-line polyline inside the trunking (s = across the face, n = out of the wall)
   ===================================================================================================== */
function segFrames(C, lids) {
  return C.slice(0, -1).map((a, i) => { const d = C[i + 1].clone().sub(a).normalize(), n = lids[i].clone().normalize(), s = n.clone().cross(d).normalize(); return { d, n, s }; });
}
export function laneLine(C, lids, s, n) {
  const F = segFrames(C, lids), out = [];
  const off = f => f.s.clone().multiplyScalar(s).add(f.n.clone().multiplyScalar(n));
  out.push(C[0].clone().add(off(F[0])));
  for (let i = 1; i < C.length - 1; i++) {
    const f0 = F[i - 1], f1 = F[i], a0 = off(f0), a1 = off(f1), dd = f0.d.dot(f1.d);
    if (Math.abs(dd) > 0.999) { out.push(C[i].clone().add(a0.clone().add(a1).multiplyScalar(0.5))); continue; }
    // least squares: P + a0 + t d0 ≈ P + a1 + u d1
    const w = a0.clone().sub(a1), A = 1, B = -dd, D = 1, e = -f0.d.dot(w), f = f1.d.dot(w), det = A * D - B * B;
    const t = (e * D - B * f) / det;
    out.push(C[i].clone().add(a0).add(f0.d.clone().multiplyScalar(t)));
  }
  out.push(C[C.length - 1].clone().add(off(F[F.length - 1])));
  return out;
}
// dense points along a polyline with rounded bends (for tubes and flows)
export function smoothPts(poly, r = 0.04, step = 0.012) { const path = bentPath(poly, r); const L = path.getLength(); return path.getSpacedPoints(Math.max(8, Math.round(L / step))); }
const curveOf = pts => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
const lengthOf = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L; };
function splitAt(pts, fromEnd) { // split dense points at distance `fromEnd` from the end
  let acc = 0; for (let i = pts.length - 1; i > 0; i--) { acc += pts[i].distanceTo(pts[i - 1]); if (acc >= fromEnd) return [pts.slice(0, i + 1), pts.slice(i)]; }
  return [pts.slice(0, 2), pts];
}

/* =====================================================================================================
   Trunking with base channel, lids and fittings as separate groups (so steps can open / close them)
   ===================================================================================================== */
function buildTrunking(C, lids, MK, o = {}) {
  const W = o.W ?? 0.075, D = o.D ?? 0.062, t = 0.0025, lidT = 0.004, FL = o.FL ?? 0.06;
  const base = new THREE.Group(), lid = new THREE.Group(), fit = new THREE.Group();
  const Fm = segFrames(C, lids);
  const boxAlong = (g, a, b, f, w, dd, mat, off = V(0, 0, 0)) => {
    const L = a.distanceTo(b); if (L < 1e-4) return null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, w, dd), mat); m.applyMatrix4(new THREE.Matrix4().makeBasis(f.d, f.s, f.n));
    m.position.copy(a).add(b).multiplyScalar(0.5).add(off); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  const anchors = { run: null, corner: [], flat: [], end: null, joint: null };
  let longest = 0;
  for (let i = 0; i < C.length - 1; i++) {
    const f = Fm[i], a = C[i], b = C[i + 1];
    const a0 = i > 0 ? a.clone().sub(f.d.clone().multiplyScalar(W / 2)) : a, b0 = i < C.length - 2 ? b.clone().add(f.d.clone().multiplyScalar(W / 2)) : b;
    // base: back plate + two side walls
    boxAlong(base, a0, b0, f, W, t, MK.trunk, f.n.clone().multiplyScalar(-D / 2 + t / 2));
    [-1, 1].forEach(k => boxAlong(base, a0, b0, f, t, D - lidT, MK.trunk, f.s.clone().multiplyScalar(k * (W / 2 - t / 2)).add(f.n.clone().multiplyScalar(-lidT / 2))));
    // screws on the back plate
    const L = a0.distanceTo(b0); for (let q = 0.2; q < L - 0.1; q += 0.45) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), MK.steel); sc.quaternion.setFromUnitVectors(V(0, 1, 0), f.n); sc.position.copy(a0).add(f.d.clone().multiplyScalar(q)).add(f.n.clone().multiplyScalar(-D / 2 + t + 0.001)); base.add(sc); }
    // lid: stops short of fittings
    const la = i > 0 ? a.clone().add(f.d.clone().multiplyScalar(FL)) : a, lb = i < C.length - 2 ? b.clone().sub(f.d.clone().multiplyScalar(FL)) : b;
    const lm = boxAlong(lid, la, lb, f, W + 0.003, lidT, MK.trunk, f.n.clone().multiplyScalar(D / 2 - lidT / 2)); if (lm) lm.userData.n = f.n.clone();
    // lid edge lines (reads as a snap-on lid)
    [-1, 1].forEach(k => { const e = boxAlong(lid, la, lb, f, 0.0015, lidT + 0.001, MK.trunkSeam, f.s.clone().multiplyScalar(k * (W / 2 + 0.0008)).add(f.n.clone().multiplyScalar(D / 2 - lidT / 2))); if (e) e.userData.n = f.n.clone(); });
    const Ll = la.distanceTo(lb); if (Ll > longest) { longest = Ll; anchors.run = la.clone().add(lb).multiplyScalar(0.5).add(f.n.clone().multiplyScalar(D / 2)); }
    // straight joint on long runs
    if (Ll > 1.2) { const m = la.clone().add(lb).multiplyScalar(0.5), jd = f.d.clone().multiplyScalar(0.03); const j = boxAlong(fit, m.clone().sub(jd), m.clone().add(jd), f, W + 0.008, D + 0.006, MK.trunkFit); if (j) j.userData.n = f.n.clone(); anchors.joint = anchors.joint || m.clone().add(f.n.clone().multiplyScalar(D / 2 + 0.003)); }
  }
  for (let i = 1; i < C.length - 1; i++) {
    const f0 = Fm[i - 1], f1 = Fm[i], b = C[i], w = W + 0.008, dd = D + 0.006;
    const same = f0.n.dot(f1.n) > 0.99;          // flat elbow (turn within the wall face) vs corner elbow
    const ext = same ? 0 : dd / 2 - 0.001;      // flat elbow: sleeves meet at the corner + rounded outer disc; inside corner: sleeves reach the other wall
    const e1 = boxAlong(fit, b.clone().sub(f0.d.clone().multiplyScalar(FL)), b.clone().add(f0.d.clone().multiplyScalar(ext)), f0, w, dd, MK.trunkFit);
    const e2 = boxAlong(fit, b.clone().sub(f1.d.clone().multiplyScalar(ext)), b.clone().add(f1.d.clone().multiplyScalar(FL)), f1, w, dd, MK.trunkFit);
    [e1, e2].forEach((e, k) => e && (e.userData.n = (k ? f1 : f0).n.clone()));
    if (same) { // rounded outer corner of a flat elbow
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, dd, 28, 1, false), MK.trunkFit);
      cyl.quaternion.setFromUnitVectors(V(0, 1, 0), f0.n); cyl.position.copy(b); cyl.userData.n = f0.n.clone(); fit.add(cyl);
      anchors.flat.push(b.clone().add(f0.n.clone().multiplyScalar(dd / 2)));
    } else anchors.corner.push(b.clone().add(f0.n.clone().multiplyScalar(dd / 2)).add(f1.n.clone().multiplyScalar(dd / 2)));
  }
  // end fittings
  const cap = (i, dir) => { const f = Fm[i], p = dir > 0 ? C[C.length - 1] : C[0]; const e = boxAlong(fit, p.clone().sub(f.d.clone().multiplyScalar(dir * 0.035)), p.clone().add(f.d.clone().multiplyScalar(dir * 0.004)), f, W + 0.008, D + 0.006, MK.trunkFit); if (e) e.userData.n = f.n.clone(); return p.clone().add(f.n.clone().multiplyScalar(D / 2 + 0.003)); };
  if (o.capStart !== false) cap(0, -1);
  anchors.end = cap(C.length - 2, 1);
  [base, lid, fit].forEach(g => g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }));
  return { base, lid, fit, anchors, W, D };
}

/* =====================================================================================================
   Home
   ===================================================================================================== */
const LANES = {           // [s, n, radius] inside the 75 × 62 mm trunk
  gas: [-0.019, -0.006, 0.0145], liq: [0.013, -0.009, 0.0128], drain: [0.021, 0.015, 0.0133],
  L: [-0.0275, 0.019, 0.0019], N: [-0.0232, 0.021, 0.0019], G: [-0.0189, 0.019, 0.0019],
};
const CU = { gas: 0.00476, liq: 0.00318 };       // copper outside radius (3/8", 1/4")

export function buildHome(scene, o = {}) {
  const type = o.type || 'wall', dark = o.theme === 'dark';
  const K = mats(dark ? 'dark' : 'light'), MK = kit('light'), M = materialSet(dark ? 'showroom' : 'studio');
  if (!dark) { K.wall = K.wall.clone(); K.wall.color = new THREE.Color(0xe7e1d7); }
  if (!MK.trunkSeam) MK.trunkSeam = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.5 });
  const CEIL = 2.7, WH = type === 'cassette' ? 3.34 : 2.7;
  const root = new THREE.Group(); root.name = 'home'; scene.add(root);
  const room = new THREE.Group(), sys = new THREE.Group(), props = new THREE.Group(); root.add(room, sys, props);
  const walls = [];
  const box = (w, h, d, mat, x, y, z, parent = room, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); if (parent === room && (w <= 0.13 || d <= 0.13) && h > 0.8) walls.push(m); return m; };
  const S = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...x });

  /* ---------- shell ---------- */
  const slabM = S(dark ? 0x3a3f46 : 0xd6d2cb, { roughness: 0.95 });
  const floorM = K.floor.clone(); floorM.map = K.floorT.clone(); floorM.map.needsUpdate = true; floorM.map.repeat.set(2.4, 1.8);
  box(5.2, 0.02, 4.0, floorM, 0, -0.01, 0); box(5.44, 0.18, 4.12, slabM, 0, -0.11, -0.06);
  const extM = S(dark ? 0x4d545e : 0xe8e3da, { map: TEX.plaster('#e6e0d6'), roughness: 0.92 });
  box(5.44, WH, 0.12, K.wall, 0, WH / 2, -2.06);                                   // back wall (room)
  box(1.9, WH + 0.2, 0.12, extM, 3.67, WH / 2 - 0.1, -2.06);                       // back wall (balcony, exterior)
  // left wall with a window opening z ∈ [-1.1, 0.5], y ∈ [0.9, 2.2]
  box(0.12, WH, 1.02, K.wall, -2.66, WH / 2, -1.61); box(0.12, WH, 1.5, K.wall, -2.66, WH / 2, 1.25);
  box(0.12, 0.9, 1.6, K.wall, -2.66, 0.45, -0.3); box(0.12, WH - 2.2, 1.6, K.wall, -2.66, (2.2 + WH) / 2, -0.3);
  const win = windowUnit(K, 1.6, 1.3); win.rotation.y = Math.PI / 2; win.position.set(-2.66, 1.55, -0.3); room.add(win);
  [[-1.25], [0.65]].forEach(([z]) => { const c = F.curtain(K, 0.5, 2.36); c.rotation.y = Math.PI / 2; c.position.set(-2.53, 0, z); room.add(c); });
  // partition with sliding door opening z ∈ [-1.2, 0.3], h 2.2
  // (doll's-house cut: the part of the partition facing the camera is cut low so the corner installation stays visible)
  box(0.12, WH, 0.8, K.wall, 2.66, WH / 2, -1.6); box(0.12, 2.2, 0.3, K.wall, 2.66, 1.1, 0.45); box(0.12, 0.9, 1.4, K.wall, 2.66, 0.45, 1.3);
  box(0.13, 0.012, 0.3, slabM, 2.66, 2.206, 0.45, room, false); box(0.13, 0.012, 1.4, slabM, 2.66, 0.906, 1.3, room, false);
  // skirting
  box(5.2, 0.08, 0.014, K.base, 0, 0.04, -1.993, room, false); box(0.014, 0.08, 4.0, K.base, -2.593, 0.04, 0, room, false);
  box(0.014, 0.08, 0.8, K.base, 2.593, 0.04, -1.6, room, false); box(0.014, 0.08, 1.7, K.base, 2.593, 0.04, 1.15, room, false);
  box(5.44, 0.012, 0.13, slabM, 0, WH + 0.006, -2.06, room, false); box(0.13, 0.012, 4.12, slabM, -2.66, WH + 0.006, -0.06, room, false); box(0.13, 0.012, 0.8, slabM, 2.66, WH + 0.006, -1.6, room, false);
  // sliding door: aluminium frame + two glass panels (one slid open)
  const alu = S(0x5d636b, { metalness: 0.65, roughness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe3ee, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false });
  box(0.1, 2.2, 0.04, alu, 2.66, 1.1, -1.18); box(0.1, 2.2, 0.04, alu, 2.66, 1.1, 0.28); box(0.1, 0.05, 1.5, alu, 2.66, 2.175, -0.45); box(0.1, 0.02, 1.5, alu, 2.66, 0.01, -0.45);
  const panel = (x, z0, z1) => { const g = new THREE.Group(); const w = z1 - z0, zc = (z0 + z1) / 2; [[0.035, 2.12, w, 0, 1.08, zc], [0.035, 0.04, w, 0, 0.04, zc], [0.035, 0.04, w, 0, 2.12, zc], [0.035, 2.12, 0.04, 0, 1.08, z0 + 0.02], [0.035, 2.12, 0.04, 0, 1.08, z1 - 0.02]].forEach(([a, b, c, dx, y, z], k) => { if (k === 0) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.006, 2.06, w - 0.06), glass); gl.position.set(x, 1.08, zc); g.add(gl); } else box(a, b, c, alu, x, y, z, g); }); room.add(g); return g; };
  panel(2.688, -0.45, 0.27); panel(2.634, -0.52, 0.2);
  // balcony: tiled slab, glass balustrade, floor drain, plant
  const tileM = K.tile.clone(); tileM.map = K.tile.map.clone(); tileM.map.needsUpdate = true; tileM.map.wrapS = tileM.map.wrapT = THREE.RepeatWrapping; tileM.map.repeat.set(2.2, 3.2);
  box(1.8, 0.02, 2.6, tileM, 3.62, -0.06, -0.7); box(1.9, 0.15, 2.6, slabM, 3.67, -0.145, -0.7);
  const rail = S(0x3b4149, { metalness: 0.6, roughness: 0.4 });
  const balG = new THREE.MeshPhysicalMaterial({ color: 0xbfe0dd, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false });
  [[4.49, -1.97], [4.49, -1.05], [4.49, -0.15], [4.49, 0.56], [3.6, 0.56], [2.8, 0.56]].forEach(([x, z]) => box(0.04, 1.05, 0.04, rail, x, -0.05 + 0.525, z));
  box(0.05, 0.04, 2.58, rail, 4.49, 1.0, -0.7); box(1.72, 0.04, 0.05, rail, 3.64, 1.0, 0.56);
  { const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.86, 2.5), balG); g1.position.set(4.49, 0.46, -0.7); room.add(g1); const g2 = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.86, 0.01), balG); g2.position.set(3.64, 0.46, 0.56); room.add(g2); }
  const drainPos = V(4.3, -0.048, -1.94);
  { const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.004, 28), new THREE.MeshStandardMaterial({ color: 0xb8bec4, metalness: 0.85, roughness: 0.3, map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, h); g.fillStyle = '#23272c'; for (let i = 0; i < 7; i++) g.fillRect(22, 22 + i * 13, 84, 6); }) })); gr.position.copy(drainPos); gr.receiveShadow = true; room.add(gr); }
  const bp = F.plant(K, 0.85); bp.position.set(4.18, -0.05, 0.25); room.add(bp);
  // cassette: ceiling board (see-through), void above, slab
  if (type === 'cassette') {
    const cm = new THREE.MeshStandardMaterial({ color: 0xf5f4f1, roughness: 0.9, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const cb = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.012, 4.0), cm); cb.position.set(0, CEIL + 0.006, 0); room.add(cb);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.2, 0.012, 4.0)), new THREE.LineBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.6 })); edge.position.copy(cb.position); room.add(edge);
    const sm = slabM.clone(); sm.transparent = true; sm.opacity = 0.35; sm.depthWrite = false; const sl = new THREE.Mesh(new THREE.BoxGeometry(5.44, 0.14, 4.12), sm); sl.position.set(0, WH + 0.07, -0.06); room.add(sl);
  }
  // soft shadow catcher around the model
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShadowMaterial({ opacity: dark ? 0.32 : 0.12 })); g.rotation.x = -Math.PI / 2; g.position.y = -0.22; g.receiveShadow = true; room.add(g); }

  /* ---------- furniture ---------- */
  const furn = [];
  const put = (g, x, y, z, ry = 0) => { g.position.set(x, y, z); g.rotation.y = ry; room.add(g); furn.push(g); return g; };
  put(F.rug(K, 2.7, 1.9), -0.45, 0, 0.8);
  put(F.sofa(K, 2.2), -0.45, 0, 1.36, Math.PI);
  put(F.coffee(K), -0.45, 0, 0.42);
  put(F.tv(K, 1.3), -0.85, 0, -1.78);
  put(F.lamp(K), -1.9, 0, 1.72);
  put(F.shelf(K, 0.9, 1.9), -2.43, 0, 1.22, Math.PI / 2);
  put(F.plant(K, 1.15), 2.22, 0, 1.58);
  { const a = F.art(K, 28); a.position.set(-2.05, 1.62, -1.985); room.add(a); const b = F.art(K, 200); b.scale.setScalar(0.7); b.position.set(-1.55, 1.52, -1.985); room.add(b); }
  const obstacles = furn.slice(1).map(g => { const b = new THREE.Box3().setFromObject(g); return { minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y, minZ: b.min.z, maxZ: b.max.z }; });
  room.traverse(m => { if (m.isMesh && !m.material.transparent) { m.castShadow = m.castShadow !== false; m.receiveShadow = true; } });

  /* ---------- indoor unit ---------- */
  const unitG = new THREE.Group(); sys.add(unitG);
  let U, hang = null, emitters, attach, plate = null, unitAnchor;
  if (type === 'wall') {
    U = buildPremiumIndoor(M);
    // pivot at the top-back edge (the hooks on the mounting plate) so C2 can un-hook and tilt the unit forward
    hang = new THREE.Group(); hang.position.set(0.9, 2.2 + 0.156, -1.87 - 0.121); unitG.add(hang);
    const inner = new THREE.Group(); inner.position.set(0, -0.156, 0.121); hang.add(inner); inner.add(U.root);
    plate = box(0.78, 0.25, 0.004, MK.steel, 0.9, 2.2, -1.997, sys);
    emitters = [{ o: V(0.9, 2.075, -1.77), f: V(0, 0, 1), r: V(-1, 0, 0), width: 0.72, kind: 'wall', v0: 3.6, intake: V(0.9, 2.37, -1.86) }];
    attach = { gas: V(0.40, -0.13, -0.105), liq: V(0.40, -0.1, -0.1), drain: V(0.38, -0.118, 0.02), L: V(0.39, -0.06, -0.11), N: V(0.39, -0.055, -0.11), G: V(0.39, -0.05, -0.11) };
    unitAnchor = inner;
  } else if (type === 'ceiling') {
    U = buildCeilingUnit(M, { interior: true, rod: 0.03 }); U.root.position.set(0.45, CEIL - 0.1375, -2 + 0.345 + 0.02); unitG.add(U.root);
    emitters = [{ o: V(0.45, 2.5, -1.28), f: V(0, 0, 1), r: V(-1, 0, 0), width: 1.1, kind: 'ceiling', v0: 4.8, intake: V(0.45, 2.42, -1.75) }];
    attach = { gas: V(0.6, -0.03, -0.3), liq: V(0.6, -0.06, -0.3), drain: V(0.6, -0.1, -0.2), L: V(0.6, 0.02, -0.3), N: V(0.6, 0.025, -0.3), G: V(0.6, 0.03, -0.3) };
    unitAnchor = U.root;
  } else {
    U = buildCassetteUnit(M, { interior: true, rod: 0.4 }); U.root.position.set(0.2, CEIL, -0.5); unitG.add(U.root);
    emitters = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b], k) => ({ o: V(0.2 + a * 0.4, CEIL - 0.06, -0.5 + b * 0.4), f: V(a, 0, b), r: V(b, 0, -a), width: 0.62, kind: 'cassette', v0: 3.1, phase: k, intake: V(0.2, CEIL - 0.12, -0.5) }));
    attach = { gas: V(0.12, 0.15, -0.49), liq: V(0.12, 0.11, -0.49), drain: V(0.33, 0.205, -0.48), L: V(0.05, 0.2, -0.47), N: V(0.05, 0.205, -0.47), G: V(0.05, 0.21, -0.47) };
    unitAnchor = U.root;
  }
  // our own routed pipes replace the builders' short stubs
  if (type !== 'wall') { if (U.parts.pipes) U.parts.pipes.visible = false; if (U.parts.drain) U.parts.drain.visible = false; }
  U.root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });

  /* ---------- routes ---------- */
  const penY = type === 'wall' ? 2.01 : type === 'ceiling' ? 2.37 : 2.82, zPen = -1.72, xi = 2.569, xo = 2.751, zw = -1.969;
  let C, lids, trunkIn;   // interior part of the centre-line (trunked or above the ceiling)
  if (type === 'wall') { C = [V(1.30, 2.06, zw), V(xi, 2.02, zw), V(xi, penY, zPen)]; lids = [V(0, 0, 1), V(-1, 0, 0)]; trunkIn = true; }
  else if (type === 'ceiling') { C = [V(1.16, 2.42, zw), V(xi, 2.38, zw), V(xi, penY, zPen)]; lids = [V(0, 0, 1), V(-1, 0, 0)]; trunkIn = true; }
  else { C = [V(0.42, 2.86, -1.02), V(0.42, 2.845, zPen), V(2.3, penY, zPen)]; lids = [V(0, 1, 0), V(0, 1, 0)]; trunkIn = false; }
  const nIn = C.length;
  // through the partition, then the exterior run down the balcony walls
  const Q = [V(2.6, penY, zPen), V(2.72, penY, zPen), V(xo, penY, zPen), V(xo, 1.0, zPen), V(xo, 1.0, zw), V(4.15, 1.0, zw), V(4.15, 0.38, zw)];
  const QL = trunkIn ? [V(0, 0, 1), V(0, 0, 1), V(0, 1, 0), V(1, 0, 0), V(1, 0, 0), V(0, 0, 1), V(0, 0, 1)] : [V(0, 1, 0), V(0, 1, 0), V(0, 1, 0), V(1, 0, 0), V(1, 0, 0), V(0, 0, 1), V(0, 0, 1)];
  const CL = [...C, ...Q], LL = [...lids, ...QL];   // lids[i] belongs to segment i
  const Ct = C.map(p => p.clone()); Ct[Ct.length - 1].z += 0.05;                 // interior run ends 5 cm past the turn into the wall
  const trunkA = trunkIn ? buildTrunking(Ct, lids, MK, { capStart: true }) : null;
  const extC = CL.slice(nIn + 2).map(p => p.clone()), extL = LL.slice(nIn + 2);   // from the point just off the exterior face (xo) down
  extC[0].y += 0.06;                                                              // starts 6 cm above the hole so the bends stay inside
  const trunkB = buildTrunking(extC, extL, MK, { capStart: true });
  const trunk = { base: new THREE.Group(), lid: new THREE.Group(), fit: new THREE.Group() };
  [trunkA, trunkB].filter(Boolean).forEach(tk => { trunk.base.add(tk.base); trunk.lid.add(tk.lid); trunk.fit.add(tk.fit); });
  sys.add(trunk.base, trunk.lid, trunk.fit);
  // cassette: pipes above the ceiling hang from the slab on threaded rods + strut
  if (!trunkIn) for (let i = 0; i < C.length - 1; i++) { const a = C[i], b2 = C[i + 1], L = a.distanceTo(b2); for (let q = 0.35; q < L - 0.2; q += 0.75) { const p = a.clone().lerp(b2, q / L); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, WH - p.y), MK.steel); rod.position.set(p.x, (WH + p.y) / 2 - 0.015, p.z); sys.add(rod); const d = b2.clone().sub(a).normalize(); const strut = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.022), MK.steel); strut.position.set(p.x, p.y - 0.028, p.z); strut.rotation.y = Math.atan2(d.x, d.z); sys.add(strut); } }
  // wall caps (ฝาครอบผนัง) round the penetration on both faces
  const capGeo = new THREE.BoxGeometry(0.004, 0.13, 0.13);
  const wallCaps = new THREE.Group(); [2.598, 2.722].forEach(x => { const m = new THREE.Mesh(capGeo, MK.trunkFit); m.position.set(x, penY, zPen); m.castShadow = true; wallCaps.add(m); }); sys.add(wallCaps);
  // mini trunk from the RCBO up to the main run (wall / ceiling) or to the ceiling (cassette)
  const RX = 1.85, rcboPos = V(RX, 1.42, -1.955);
  const miniTop = type === 'cassette' ? CEIL - 0.02 : (C[0].y + (C[1].y - C[0].y) * ((RX - C[0].x) / (C[1].x - C[0].x))) - 0.0375;
  const mini = new THREE.Mesh(new THREE.BoxGeometry(0.032, miniTop - (rcboPos.y + 0.115), 0.02), MK.trunk); mini.position.set(RX, (miniTop + rcboPos.y + 0.115) / 2, -1.99); mini.castShadow = true; sys.add(mini);

  /* ---------- condensing unit on its stand ---------- */
  const OU = buildOutdoor(M); const cdu = V(3.55, 0.42, -1.72); const outG = new THREE.Group(); outG.position.copy(cdu); outG.add(OU.root); sys.add(outG);
  OU.root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const stand = new THREE.Group(); sys.add(stand);
  const galv = MK.steel, conc = S(0xa9a9a4, { roughness: 0.95 });
  [-0.3, 0.3].forEach(dx => {
    [-0.14, 0.14].forEach(dz => box(0.1, 0.08, 0.1, conc, cdu.x + dx, -0.05 + 0.04, cdu.z + dz, stand));
    box(0.05, 0.04, 0.38, galv, cdu.x + dx, 0.05, cdu.z, stand);
    [-0.13, 0.13].forEach(dz => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.022, 20), MK.rubber); p.position.set(cdu.x + dx, 0.081, cdu.z + dz); p.castShadow = true; stand.add(p); });
  });
  const valve = { gas: V(cdu.x + 0.465, cdu.y - 0.2, cdu.z + 0.06), liq: V(cdu.x + 0.465, cdu.y - 0.2, cdu.z + 0.105) };
  const term = V(cdu.x + 0.43, cdu.y - 0.09, cdu.z + 0.04);

  /* ---------- RCBO enclosure ---------- */
  const rcbo = new THREE.Group(); rcbo.position.copy(rcboPos); sys.add(rcbo);
  const encl = rbox(0.13, 0.23, 0.08, 0.01, S(0xf2f2ef, { roughness: 0.4 })); rcbo.add(encl);
  const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.004), new THREE.MeshPhysicalMaterial({ color: 0xd8e6ee, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false })); win2.position.set(0, 0.0, 0.041); rcbo.add(win2);
  const dev = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.09, 0.05), S(0xf6f6f2, { roughness: 0.35 })); dev.position.set(0, 0, 0.012); rcbo.add(dev);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.022, 0.012), S(0x2b3035, { roughness: 0.4 })); lever.position.set(0, 0.012, 0.04); rcbo.add(lever);
  const tbtn = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 12), S(0xf1c232)); tbtn.rotation.x = Math.PI / 2; tbtn.position.set(0.01, -0.03, 0.038); rcbo.add(tbtn);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.024), new THREE.MeshBasicMaterial({ map: canvasTex(128, 96, (g, w, h) => { g.fillStyle = '#f3f3ef'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1f24'; g.font = '900 30px Arial'; g.textAlign = 'center'; g.fillText('NANO', w / 2, 34); g.font = '700 18px Arial'; g.fillText('RCBO C20', w / 2, 60); g.fillStyle = '#d6202a'; g.fillText('30mA', w / 2, 84); }) })); face.position.set(0, -0.026, 0.0376); rcbo.add(face);
  rcbo.traverse(m => { if (m.isMesh) m.castShadow = true; });
  const setPower = on => { lever.rotation.x = on ? 0 : 0.9; lever.position.y = on ? 0.012 : -0.004; };
  setPower(true);

  /* ---------- lanes: insulated copper, blue drain, THW cores, interconnect ---------- */
  const unitW = k => { unitAnchor.updateWorldMatrix(true, false); return unitAnchor.localToWorld(attach[k].clone()); };
  const lanes = {}, meshes = {};
  const LG = new THREE.Group(); sys.add(LG);
  const mk = (pts, r, kind) => { const c = curveOf(pts), L = lengthOf(pts); const mat = kind === 'copper' ? MK.copper : printed(kind, L); const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(16, Math.round(L / 0.02)), r, kind === 'copper' ? 12 : 16, false), mat); m.castShadow = true; m.receiveShadow = true; m.userData.L = L; LG.add(m); return m; };
  const TAIL = type === 'wall' ? 0.16 : 0.12;           // flexible bit next to the unit (re-built when C2 tilts the unit)
  function tailPts(k, startW, joinW) { const a = startW, b = joinW, mid = a.clone().lerp(b, 0.5); mid.z = Math.min(a.z, b.z) - 0.002; return smoothPts([a, mid, b], 0.03, 0.01); }
  for (const k of Object.keys(LANES)) {
    const [s, n, r] = LANES[k];
    const line = laneLine(CL, LL, s, n);
    let pts;
    if (k === 'gas' || k === 'liq') {
      const v = valve[k], e0 = line[line.length - 1], yv = v.y;
      pts = smoothPts([...line, V(e0.x, yv, e0.z), V(e0.x, yv, v.z), V(v.x + 0.02, yv, v.z)], 0.035);
    } else if (k === 'drain') {
      const e0 = line[line.length - 1];
      pts = smoothPts([...line, V(e0.x, e0.y - 0.04, e0.z), V(drainPos.x, e0.y - 0.05, e0.z), V(drainPos.x, 0.0, e0.z)], 0.035);
    } else {
      const e0 = line[line.length - 1], yt = term.y + 0.01 + (k === 'N' ? 0.004 : k === 'G' ? 0.008 : 0);
      pts = smoothPts([...line, V(e0.x, yt, e0.z), V(e0.x, yt, term.z + (k === 'L' ? -0.005 : k === 'G' ? 0.005 : 0)), V(term.x + 0.012, yt, term.z)], 0.02);
    }
    // cut the first TAIL metres (replaced by the flexible tail that follows the unit)
    let acc = 0, cut = 0; for (let i = 1; i < pts.length; i++) { acc += pts[i].distanceTo(pts[i - 1]); if (acc >= TAIL) { cut = i; break; } }
    const fixed = pts.slice(cut);
    lanes[k] = { s, n, r, fixed, join: fixed[0].clone() };
  }
  // meshes
  const exposed = 0.075;          // copper visible before the flare nuts
  const kindOf = k => (k === 'gas' || k === 'liq') ? 'insul' : k === 'drain' ? 'drain' : 'thw' + k;
  function tailMesh(k) { const Ln = lanes[k], pts = tailPts(k, unitW(k), Ln.join); Ln.full = [...pts, ...Ln.fixed.slice(1)]; return mk(pts, Ln.r, kindOf(k)); }
  function laneMeshes(k) {
    const Ln = lanes[k], tail = tailMesh(k);
    if (k === 'gas' || k === 'liq') {
      const [ins, cu] = splitAt(Ln.fixed, exposed);
      return { tail, ins: mk(ins, Ln.r, 'insul'), cu: mk(cu, CU[k], 'copper'), core: mk(Ln.full, CU[k], 'copper') };
    }
    return { tail, pipe: mk(Ln.fixed, Ln.r, kindOf(k)) };
  }
  for (const k in lanes) meshes[k] = laneMeshes(k);
  meshes.gas.core.visible = meshes.liq.core.visible = false;   // shown only in x-ray
  // flare nuts on the valves (brass hex) — the valves themselves are part of the condensing unit
  const nuts = new THREE.Group(); sys.add(nuts);
  ['gas', 'liq'].forEach(k => { const n = new THREE.Mesh(new THREE.CylinderGeometry(k === 'gas' ? 0.013 : 0.011, k === 'gas' ? 0.013 : 0.011, 0.022, 6), MK.brass); n.rotation.z = Math.PI / 2; n.position.copy(valve[k]).add(V(0.005, 0, 0)); n.castShadow = true; nuts.add(n); });
  // power feed: RCBO → mini trunk → main run → indoor unit (three cores)
  const powerPts = (() => {
    const top = V(RX, miniTop - 0.01, -1.99);
    if (type === 'cassette') return smoothPts([V(RX, rcboPos.y + 0.12, -1.99), V(RX, CEIL + 0.1, -1.99), V(RX, 2.9, -1.9), V(0.62, 2.9, -0.35), unitW('L')], 0.05);
    const yIn = top.y + 0.02, x0 = C[0].x + 0.06;
    return smoothPts([V(RX, rcboPos.y + 0.12, -1.99), top, V(RX, yIn, -1.991), V(x0, yIn + (C[0].y - C[1].y) * ((RX - x0) / (C[1].x - C[0].x)), -1.991), unitW('L')], 0.03);
  })();
  const powerMeshes = [0, 1, 2].map(i => { const off = V(0, 0, (i - 1) * 0.004); return mk(powerPts.map(p => p.clone().add(off)), 0.0019, ['thwL', 'thwN', 'thwG'][i]); });

  function rebuildTails() {       // after the unit moves (C2): re-make only the short flexible bits next to the unit
    for (const k in meshes) { const old = meshes[k].tail, vis = old.visible; old.geometry.dispose(); LG.remove(old); meshes[k].tail = tailMesh(k); meshes[k].tail.visible = vis; }
    applyReveal(); if (lastX) setXray(lastX.k, lastX.what);
  }
  // progressive reveal of pipes (install): 0..1 along the run
  let reveal = 1;
  function applyReveal() {
    for (const k in meshes) for (const m of Object.values(meshes[k])) { const g = m.geometry, n = g.index ? g.index.count : g.attributes.position.count; g.setDrawRange(0, reveal >= 1 ? Infinity : Math.floor(n * reveal / 6) * 6); }
  }
  function setReveal(k) { k = clamp(k, 0, 1); if (Math.abs(k - reveal) < 1e-3) return; reveal = k; applyReveal(); }

  /* ---------- x-ray (see-through lids / insulation / unit shells) ---------- */
  const xrayMats = new Map();
  function fade(obj, k) {
    obj.traverse(m => {
      if (!m.isMesh) return;
      if (!xrayMats.has(m)) { const mm = Array.isArray(m.material) ? m.material : [m.material]; m.material = mm.map(x => x.clone()); if (m.material.length === 1) m.material = m.material[0]; xrayMats.set(m, { op: (Array.isArray(m.material) ? m.material : [m.material]).map(x => ({ t: x.transparent, o: x.opacity, d: x.depthWrite })) }); }
      const st = xrayMats.get(m).op, keep = m.userData.xrayKeep ?? 0.15; (Array.isArray(m.material) ? m.material : [m.material]).forEach((x, i) => { const s0 = st[i]; if (k <= 0.001) { x.transparent = s0.t; x.opacity = s0.o; x.depthWrite = s0.d; } else { x.transparent = true; x.opacity = s0.o * (1 - k * (1 - keep)); x.depthWrite = false; } });
      m.castShadow = k < 0.5;
    });
  }
  let lastX = null;
  function setXray(k, what = ['lid', 'fit', 'insul']) {
    lastX = k > 0 ? { k, what } : null;
    if (what.includes('lid')) { fade(trunk.lid, k); fade(trunk.fit, k); fade(mini, k); }
    if (what.includes('insul')) { [meshes.gas.ins, meshes.liq.ins, meshes.gas.tail, meshes.liq.tail].forEach(m => { m.userData.xrayKeep = 0.4; fade(m, k); }); meshes.gas.core.visible = meshes.liq.core.visible = k > 0.05; }
  }

  /* ---------- anchors for labels / cameras ---------- */
  const W = p => p.clone();
  const anchors = {
    unit: () => unitAnchor.localToWorld(V(0, 0.05, 0.12)),
    trunkIn: trunkA ? W(trunkA.anchors.run) : C[1].clone(), corner: trunkA ? (trunkA.anchors.corner[0] || C[1]) : C[1],
    wallcap: V(2.598, penY + 0.07, zPen), trunkOut: W(trunkB.anchors.run), flat: trunkB.anchors.flat[0] || Q[4], cornerOut: trunkB.anchors.corner[0] || Q[4], joint: trunkB.anchors.joint, endcap: trunkB.anchors.end,
    cdu: cdu.clone().add(V(-0.1, 0.1, 0.16)), fan: cdu.clone().add(V(-0.1, 0, 0.17)), comp: cdu.clone().add(V(0.3, -0.05, 0)), valves: valve.gas.clone(), term: term.clone(),
    pads: cdu.clone().add(V(0.3, -0.34, 0.13)), drainEnd: V(drainPos.x, 0.02, drainPos.z), floorDrain: drainPos.clone(), rcbo: rcboPos.clone().add(V(0, 0.02, 0.05)),
    insul: () => lanes.gas.fixed[Math.floor(lanes.gas.fixed.length * 0.72)], drain: () => lanes.drain.fixed[Math.floor(lanes.drain.fixed.length * 0.8)],
    plate: V(0.9, 2.2, -1.99),
  };

  const H = CEIL;
  return {
    type, root, room, sys, props, walls, U, unitG, hang, plate, OU, outG, cdu, valve, term, stand, trunk, wallCaps, mini, rcbo, setPower, lanes, meshes, powerMeshes, powerPts, nuts,
    emitters, obstacles, roomBox: { w: 5.2, d: 4.0, h: H, x0: 0, z0: 0 }, anchors, drainPos, penY, rebuildTails, setReveal, setXray, MK, K, M,
    flow: {
      gas: () => lanes.gas.full, liq: () => lanes.liq.full.slice().reverse(), drain: () => lanes.drain.full, power: () => powerPts, link: () => lanes.L.full,
    },
    dispose() { scene.remove(root); root.traverse(m => { if (m.isMesh) { m.geometry.dispose(); } }); },
  };
}

/* =====================================================================================================
   Flows: points that travel along a dense path (refrigerant, drain water, power pulses)
   ===================================================================================================== */
const dotTex = (() => { let t; return () => t || (t = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); })();
export function createPathFlow(parent, o = {}) {
  const n = o.count || 120, g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: o.size || 0.03, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthTest: o.depthTest !== false });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 8; parent.add(pts);
  const u = new Float32Array(n).map(() => Math.random()), jit = new Float32Array(n * 3).map(() => (Math.random() - 0.5));
  let path = [], L = 1, on = 0, want = 0; const c0 = new THREE.Color(o.color || 0x3aa0ff), c1 = new THREE.Color(o.color2 || o.color || 0x3aa0ff), tmp = new THREE.Color();
  return {
    points: pts,
    setPath(p) { path = p || []; L = Math.max(0.01, lengthOf(path)); },
    set(v) { want = v ? 1 : 0; },
    update(dt) {
      on += (want - on) * clamp(dt * 3, 0, 1); mat.opacity = on * (o.opacity ?? 0.95); pts.visible = on > 0.01 && path.length > 1;
      if (!pts.visible) return;
      const sp = (o.speed || 0.5) / L, N = path.length - 1;
      for (let i = 0; i < n; i++) {
        u[i] = (u[i] + dt * sp * (0.8 + 0.4 * ((i * 37) % 10) / 10)) % 1;
        const f = u[i] * N, k = Math.min(N - 1, Math.floor(f)), r = f - k, a = path[k], b = path[k + 1];
        const j = o.jitter || 0, sp3 = o.spread;
        pos[i * 3] = a.x + (b.x - a.x) * r + jit[i * 3] * (sp3 ? sp3.x : j); pos[i * 3 + 1] = a.y + (b.y - a.y) * r + jit[i * 3 + 1] * (sp3 ? sp3.y : j); pos[i * 3 + 2] = a.z + (b.z - a.z) * r + jit[i * 3 + 2] * (sp3 ? sp3.z : j);
        tmp.copy(c0).lerp(c1, u[i]); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
    },
    dispose() { g.dispose(); mat.dispose(); parent.remove(pts); },
  };
}
