// SBP AirCare — 3D map of Thailand (77 provinces) showing the service area and travel-fee bands.
// Geometry: Natural Earth admin-1 (public domain), simplified with mapshaper → assets/thai-provinces.json.
// Province colour = the lowest travel band any part of the province falls in (road km ≈ straight km × TRAVEL.roadFactor).
// Rings show where each band actually ends. The exact fee always comes from the address checker.
import * as THREE from './three.module.min.js';
import { track as glTrack } from './gl-pool.js';
import { ZONES, TRAVEL, HQ, NEARBY, baht, h } from './sbp-core.js';

const LAT0 = 13.7, LON0 = 100.5, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180) / 10, KZ = 110.57 / 10;   // 1 unit = 10 km
const P = (lon, lat) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const CORE = new Set(ZONES.filter(z => z.tier === 'core').map(z => z.province));
const BANDS = TRAVEL.bands.map(b => ({ ...b, r: b.maxKm / TRAVEL.roadFactor / 10 }));   // straight-line radius in units
const STATUS = {
  core: { th: 'ไม่มีค่าเดินทาง', h: 1.5 },
  Z1: { th: `ค่าเดินทาง ${baht((BANDS[0].fee(0)))}`, h: 1.0 },
  Z2: { th: `ค่าเดินทาง ${baht((BANDS[1].fee(0)))}`, h: 0.8 },
  Z3: { th: `ค่าเดินทาง ${baht((BANDS[2].fee(0)))}`, h: 0.62 },
  out: { th: 'นอกพื้นที่ · รับเป็นงานโครงการ', h: 0.36 },
};
const PAL = {
  light: { sea: 0xa9cbe6, sea2: 0xcfe3f3, nb: 0xd9d6cf, core: 0x1b5aa8, Z1: 0x2f9e8f, Z2: 0xe9b949, Z3: 0xec8a4b, out: 0xfdfaf3, side: 0.78, line: 0xffffff, lineOp: 0.9, ring: 0x123f7b, hq: 0xe2711d },
  blueprint: { sea: 0xdbe7f4, sea2: 0xeef4fb, nb: 0xf1f4f8, core: 0x2c6cb8, Z1: 0x6fa3dc, Z2: 0xa9c6ea, Z3: 0xd3e2f5, out: 0xfbfcfe, side: 0.82, line: 0x0e2238, lineOp: 0.55, ring: 0xe2711d, hq: 0xe2711d },
  dark: { sea: 0x08121c, sea2: 0x0f1d2b, nb: 0x141b23, core: 0x2fb2f0, Z1: 0x2bb39f, Z2: 0xd9a93c, Z3: 0xe07a3e, out: 0x1c2733, side: 0.6, line: 0x5f7488, lineOp: 0.6, ring: 0x9fdcff, hq: 0xff8a3d },
};
const MAJOR = new Set(['เชียงใหม่', 'ขอนแก่น', 'นครราชสีมา', 'ภูเก็ต', 'สงขลา', 'อุดรธานี', 'พิษณุโลก', 'อุบลราชธานี', 'สุราษฎร์ธานี', 'นครสวรรค์']);

// shortest distance (units) from a point to a province outline; 0 when inside
function distTo(poly, x, z) {
  let best = Infinity, inside = false;
  poly.forEach(rings => rings.forEach((ring, ri) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, z1] = ring[j], [x2, z2] = ring[i];
      if (ri === 0 && ((z1 > z) !== (z2 > z)) && x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) inside = !inside;
      const dx = x2 - x1, dz = z2 - z1, L = dx * dx + dz * dz || 1, t = clamp(((x - x1) * dx + (z - z1) * dz) / L, 0, 1);
      best = Math.min(best, Math.hypot(x - x1 - t * dx, z - z1 - t * dz));
    }
  }));
  return inside ? 0 : best;
}

async function loadGeo() {
  if (globalThis.__SBP_TH) return globalThis.__SBP_TH;
  return (await fetch(new URL('./thai-provinces.json', import.meta.url))).json();
}

// r8: the pages await this at load — and everything after it (the site router included) waited for 77 extruded provinces to be
// built, even though the map sits on the contact page. It now returns at once and builds when the map comes near the viewport;
// a zone highlighted before that is applied once the map is ready.
export async function mountThaiMap(host, cfg = {}) {
  let real = null, booting = false, lastZ = null;
  const boot = async () => { if (booting) return; booting = true; io.disconnect(); try { real = await buildThaiMap(host, cfg); if (lastZ && real) real.highlight(lastZ); } catch (e) { console.warn('map unavailable', e); } };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) boot(); }, { rootMargin: '600px 0px' });
  io.observe(host);
  return { highlight(z) { lastZ = z; real && real.highlight(z); }, setView(v) { real && real.setView && real.setView(v); }, get provinces() { return real ? real.provinces : []; } };
}
async function buildThaiMap(host, cfg = {}) {
  const theme = cfg.theme || 'light', C = PAL[theme] || PAL.light;
  const geoAll = await loadGeo(); const raw = geoAll.prov || geoAll, NB = geoAll.nb || [];
  const [hx, hz] = P(HQ.lon, HQ.lat);
  const provs = raw.map(p => {
    const poly = p.p.map(rings => rings.map(r => { const pts = []; for (let i = 0; i < r.length; i += 2) pts.push(P(r[i], r[i + 1])); return pts; }));
    const d = distTo(poly, hx, hz) * 10 * TRAVEL.roadFactor;   // road km to the nearest part
    const st = CORE.has(p.th) ? 'core' : d <= BANDS[0].maxKm ? 'Z1' : d <= BANDS[1].maxKm ? 'Z2' : d <= BANDS[2].maxKm ? 'Z3' : 'out';
    return { th: p.th, en: p.en, poly, label: P(p.l[0], p.l[1]), st, km: Math.round(d) };
  });
  const byTh = Object.fromEntries(provs.map(p => [p.th, p]));

  /* ---------- markup ---------- */
  host.classList.add('tm', 'tm-' + theme);
  const stage = h('div', { class: 'tm-stage' });
  const labels = h('div', { class: 'tm-labels', 'aria-hidden': 'true' });
  const tip = h('div', { class: 'tm-tip', hidden: true, role: 'status' });
  const views = h('div', { class: 'tm-views' },
    h('button', { type: 'button', 'data-v': 'service', 'aria-pressed': 'true' }, 'พื้นที่บริการ'),
    h('button', { type: 'button', 'data-v': 'country', 'aria-pressed': 'false' }, 'ทั้งประเทศ'));
  const zoom = h('div', { class: 'tm-zoom' }, h('button', { type: 'button', 'aria-label': 'ซูมเข้า', 'data-z': '0.8' }, '+'), h('button', { type: 'button', 'aria-label': 'ซูมออก', 'data-z': '1.25' }, '−'));
  const legend = h('div', { class: 'tm-legend' }, ['core', 'Z1', 'Z2', 'Z3', 'out'].map(k => h('span', {}, h('i', { style: `background:#${new THREE.Color(C[k]).getHexString()}` }),
    k === 'core' ? 'กรุงเทพฯ และปริมณฑล · ' + STATUS.core.th : k === 'out' ? STATUS.out.th : `${BANDS[{ Z1: 0, Z2: 1, Z3: 2 }[k]].th} · ${STATUS[k].th}`)));
  const fb = h('div', { class: 'tm-fb', hidden: true });
  stage.append(labels, tip, views, zoom, fb);
  host.append(stage, legend, h('p', { class: 's-note tm-note' }, `แผนที่จังหวัดจาก Natural Earth · สีจังหวัด = ช่วงค่าเดินทางที่ใกล้ที่สุดของจังหวัดนั้น เส้นวง = ระยะถนนประมาณ 60 / 100 / 150 กม. จากสำนักงานใหญ่ ค่าเดินทางจริงคิดจากที่อยู่หน้างาน (ใช้ช่องตรวจพื้นที่)`));

  /* ---------- three.js ---------- */
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { drawFallback(); return { highlight() {}, fly() {} }; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = theme !== 'blueprint'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = theme === 'dark' ? 1.0 : 1.08;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  glTrack(renderer, stage, { name: 'แผนที่บริการ' });   // B1: context budget (gl-pool)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, theme === 'dark' ? 0x0b1118 : 0xb9c6d2, theme === 'dark' ? 0.9 : theme === 'blueprint' ? 1.6 : 1.25));
  const sun = new THREE.DirectionalLight(0xfff3e2, theme === 'dark' ? 1.2 : 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -90; sc.right = 90; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 600; sun.shadow.bias = -0.0005;
  sun.position.set(-60, 160, 90); scene.add(sun, sun.target);
  // sea
  const seaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); const r = g.createRadialGradient(256, 256, 30, 256, 256, 256); r.addColorStop(0, '#' + new THREE.Color(C.sea2).getHexString()); r.addColorStop(1, '#' + new THREE.Color(C.sea).getHexString()); g.fillStyle = r; g.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshBasicMaterial({ map: seaTex, toneMapped: false }));
  // neighbouring countries: flat, muted — context only
  NB.forEach(c => c.p.forEach(rings => { const pts = []; for (let i = 0; i < rings[0].length; i += 2) pts.push(P(rings[0][i], rings[0][i + 1])); const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: C.nb, roughness: 0.95 })); m.receiveShadow = true; scene.add(m); }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, 30); sea.receiveShadow = true; scene.add(sea);

  // provinces
  const group = new THREE.Group(); scene.add(group);
  const pick = [];
  provs.forEach(p => {
    const shapes = p.poly.map(rings => { const s = new THREE.Shape(rings[0].map(([x, z]) => new THREE.Vector2(x, -z))); rings.slice(1).forEach(hr => s.holes.push(new THREE.Path(hr.map(([x, z]) => new THREE.Vector2(x, -z))))); return s; });
    const H = STATUS[p.st].h;
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: H, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);   // shape XY → ground XZ, extrude along +Y
    const col = new THREE.Color(C[p.st]);
    const top = new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.02 });
    const side = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(C.side), roughness: 0.8 });
    const m = new THREE.Mesh(geo, [top, side]); m.castShadow = m.receiveShadow = true; m.userData.p = p;
    group.add(m); pick.push(m); p.mesh = m; p.base = col.clone();
    // crisp border on top
    const pts = []; p.poly.forEach(rings => rings.forEach(r => r.forEach(([x, z], i) => { const [x2, z2] = r[(i + 1) % r.length]; pts.push(x, H + 0.07, z, x2, H + 0.07, z2); })));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const ln = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: C.line, transparent: true, opacity: C.lineOp })); group.add(ln); p.line = ln;
  });
  // band rings around HQ
  BANDS.forEach((b, i) => {
    const pts = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2; pts.push(new THREE.Vector3(hx + Math.cos(a) * b.r, 2.1, hz + Math.sin(a) * b.r)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: C.ring, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.85 - i * 0.12 })); l.computeLineDistances(); scene.add(l);
  });
  // HQ pin
  const pin = new THREE.Group(); pin.position.set(hx, 0, hz); scene.add(pin);
  const pinM = new THREE.MeshStandardMaterial({ color: C.hq, roughness: 0.35, emissive: C.hq, emissiveIntensity: 0.25 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 12), pinM); stem.position.y = 1.6 + 1.5; pin.add(stem);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), pinM); head.position.y = 4.9; head.castShadow = true; pin.add(head);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.66, 48), new THREE.MeshBasicMaterial({ color: C.hq, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  pulse.rotation.x = -Math.PI / 2; pulse.position.y = 1.62; pin.add(pulse);
  // job pin (from the address checker)
  const job = new THREE.Group(); job.visible = false; scene.add(job);
  const jobM = new THREE.MeshStandardMaterial({ color: theme === 'dark' ? 0xffffff : 0x0e2238, roughness: 0.4 });
  const js = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), jobM); js.position.y = 1.3 + 1.2; job.add(js);
  const jh = new THREE.Mesh(new THREE.OctahedronGeometry(0.36), jobM); jh.position.y = 4.0; job.add(jh);
  const jobLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.hq })); scene.add(jobLine);

  /* ---------- labels ---------- */
  const labelList = [];
  const addLabel = (text, v, cls, prov) => { const el = h('div', { class: 'tm-lb ' + cls }, h('span', {}, text)); labels.append(el); labelList.push({ el, v, cls, prov }); };
  provs.forEach(p => { const H = STATUS[p.st].h; if (p.st !== 'out') addLabel(p.th === 'กรุงเทพมหานคร' ? 'กรุงเทพฯ' : p.th, new THREE.Vector3(p.label[0], H + 0.2, p.label[1]), 'prov ' + p.st, p); else if (MAJOR.has(p.th)) addLabel(p.th, new THREE.Vector3(p.label[0], H + 0.2, p.label[1]), 'major', p); });
  addLabel('สำนักงานใหญ่ พระราม 2', new THREE.Vector3(hx, 5.5, hz), 'hq');
  BANDS.forEach(b => addLabel(`${b.maxKm} กม.`, new THREE.Vector3(hx, 2.2, hz - b.r), 'ring'));
  const jobLabel = { el: h('div', { class: 'tm-lb job', hidden: true }, h('span')), v: new THREE.Vector3(), cls: 'job' }; labels.append(jobLabel.el); labelList.push(jobLabel);
  const V3g = (lon, lat, y = 0) => { const [x, z] = P(lon, lat); return new THREE.Vector3(x, y, z); };
  addLabel('ทะเลอันดามัน', V3g(97.2, 9.2, 0.2), 'sea');
  addLabel('อ่าวไทย', V3g(101.0, 10.6, 0.2), 'sea');
  const NBL = { MMR: [97.6, 17.2], LAO: [103.2, 18.8], KHM: [104.6, 12.6], MYS: [101.6, 4.9] };
  NB.forEach(c => NBL[c.c] && addLabel(c.th, V3g(NBL[c.c][0], NBL[c.c][1], 0.3), 'nb'));

  /* ---------- camera + interaction ---------- */
  const VIEWS = {
    service: { t: new THREE.Vector3(hx + 1.8, 0, hz - 1.2), r: 46, th: -0.18, ph: 0.72 },
    country: { t: V3g(100.9, 12.9), r: 250, th: -0.05, ph: 0.42 },
  };
  const cam = { t: VIEWS.country.t.clone(), r: VIEWS.country.r, th: VIEWS.country.th, ph: VIEWS.country.ph };
  let fly = null, view = 'service';
  function flyTo(to, dur = 1600) { if (RM()) dur = 1; fly = { from: { t: cam.t.clone(), r: cam.r, th: cam.th, ph: cam.ph }, to, t0: performance.now(), dur }; }
  function setView(v) { view = v; flyTo(VIEWS[v]); views.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); }
  views.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => setView(b.dataset.v)));
  zoom.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => flyTo({ t: cam.t.clone(), r: clamp(cam.r * +b.dataset.z, 12, 380), th: cam.th, ph: cam.ph }, 350)));
  // drag = pan along the ground (touch keeps vertical page scroll)
  const el = renderer.domElement; el.style.touchAction = 'pan-y';
  let drag = null;
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, t: cam.t.clone(), moved: false, id: e.pointerId }; fly = null; });
  addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.pointerType === 'touch' ? 0 : e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
      const k = cam.r / (el.clientHeight || 400) * 0.55, c = Math.cos(cam.th), s = Math.sin(cam.th);
      cam.t.set(drag.t.x - (dx * c + dy * s) * k, 0, drag.t.z - (-dx * s + dy * c) * k / Math.cos(cam.ph));
      cam.t.x = clamp(cam.t.x, -70, 70); cam.t.z = clamp(cam.t.z, -90, 100);
    } else if (e.target === el) hover(e);
  });
  const up = e => { if (drag && e.pointerId === drag.id) { if (!drag.moved) click(e); drag = null; } };
  addEventListener('pointerup', up); addEventListener('pointercancel', () => drag = null);
  el.addEventListener('pointerleave', () => { tip.hidden = true; setHover(null); });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(e) { const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); const i = ray.intersectObjects(pick, false)[0]; return i ? i.object.userData.p : null; }
  let hov = null, sel = null;
  function paint(p) { if (!p) return; const on = p === hov || p === sel; p.mesh.material[0].color.copy(p.base).offsetHSL(0, on ? 0.05 : 0, on ? 0.08 : 0); p.mesh.material[0].emissive.set(p === sel ? C.hq : 0x000000); p.mesh.material[0].emissiveIntensity = p === sel ? 0.18 : 0; }
  function setHover(p) { const o = hov; hov = p; paint(o); paint(p); el.style.cursor = p ? 'pointer' : 'grab'; }
  function describe(p) { return p.st === 'core' ? 'ไม่มีค่าเดินทาง' : p.st === 'out' ? `ส่วนที่ใกล้ที่สุดห่างประมาณ ${p.km} กม. (ระยะถนน) · รับเป็นงานโครงการ/สัญญา` : `ค่าเดินทางเริ่มต้น ${STATUS[p.st].th.replace('ค่าเดินทาง ', '')} ต่อเที่ยว (ก่อน VAT) · บางอำเภออยู่ช่วงไกลกว่า`; }
  function hover(e) { const p = hit(e); setHover(p); if (!p) { tip.hidden = true; return; } const r = stage.getBoundingClientRect(); tip.hidden = false; tip.innerHTML = ''; tip.append(h('b', {}, p.th), h('span', {}, describe(p))); tip.style.transform = `translate(${Math.min(e.clientX - r.left + 14, r.width - 250)}px,${e.clientY - r.top + 14}px)`; }
  function click(e) { const p = hit(e); if (!p) return; cfg.onPick && cfg.onPick(p.th); }
  new ResizeObserver(() => { const W = stage.clientWidth || 1, H = stage.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }).observe(stage);

  /* ---------- loop ---------- */
  const tmp = new THREE.Vector3(); let vis = false, started = false, t0 = performance.now();
  new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !started) { started = true; setTimeout(() => setView('service'), RM() ? 0 : 700); } }, { threshold: 0.25 }).observe(stage);
  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis || document.hidden) return;
    if (fly) { const k = clamp((now - fly.t0) / fly.dur, 0, 1), e = ease(k); cam.t.lerpVectors(fly.from.t, fly.to.t, e); cam.r = fly.from.r + (fly.to.r - fly.from.r) * e; cam.th = fly.from.th + (fly.to.th - fly.from.th) * e; cam.ph = fly.from.ph + (fly.to.ph - fly.from.ph) * e; if (k >= 1) fly = null; }
    const R = cam.r * Math.max(1, 1.2 / camera.aspect);
    camera.position.set(cam.t.x + R * Math.sin(cam.ph) * Math.sin(cam.th), R * Math.cos(cam.ph), cam.t.z + R * Math.sin(cam.ph) * Math.cos(cam.th));
    camera.lookAt(cam.t);
    const tt = (now - t0) / 1000; const pk = (tt % 2) / 2; pulse.scale.setScalar(1 + pk * 5); pulse.material.opacity = 0.6 * (1 - pk);
    head.position.y = 4.9 + (RM() ? 0 : Math.sin(tt * 2.2) * 0.15);
    if (sel && sel.lift < 1) { sel.lift = Math.min(1, sel.lift + 0.05); sel.mesh.position.y = ease(sel.lift) * 0.6; sel.line.position.y = sel.mesh.position.y; }
    renderer.render(scene, camera);
    placeLabels();
  }
  requestAnimationFrame(frame);
  function placeLabels() {
    const W = stage.clientWidth, H = stage.clientHeight, far = cam.r > 120, placed = [];
    labelList.forEach(L => {
      let show = L.cls === 'hq' || L.cls === 'job' ? !L.el.hidden || L.cls === 'hq' : far ? (L.cls === 'major' || L.cls === 'sea' || L.cls === 'nb' || (L.prov && L.prov.st === 'core' && L.prov.th === 'กรุงเทพมหานคร')) : (L.cls.startsWith('prov') || L.cls === 'ring');
      if (L.cls === 'job' && L.el.hidden) show = false;
      if (!show) { L.el.style.display = 'none'; return; }
      tmp.copy(L.v); if (L.prov && L.prov === sel) tmp.y += 0.6; tmp.project(camera);
      if (tmp.z > 1 || Math.abs(tmp.x) > 1.02 || Math.abs(tmp.y) > 1.02) { L.el.style.display = 'none'; return; }
      const x = (tmp.x + 1) / 2 * W, y = (1 - tmp.y) / 2 * H, w = L.w || (L.w = L.el.firstChild.offsetWidth || 60);
      const pri = L.cls === 'hq' || L.cls === 'job' || (L.prov && L.prov === sel);
      if (!pri && placed.some(q => Math.abs(q.x - x) < (q.w + w) / 2 + 2 && Math.abs(q.y - y) < 17)) { L.el.style.display = 'none'; return; }
      if (L.cls === 'hq') L.el.classList.toggle('flip', x - w - 16 < 0);
      placed.push({ x, y, w }); L.el.style.display = ''; L.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    });
  }

  /* ---------- API ---------- */
  function highlight(z) {
    const old = sel; sel = z && byTh[z.province] || null;
    if (old && old !== sel) { old.lift = 0; old.mesh.position.y = 0; old.line.position.y = 0; paint(old); }
    if (sel) { sel.lift = 0; paint(sel); }
    // exact point when we know the district, otherwise the province label point
    const n = z && NEARBY.find(x => x.district === z.match || (z.match && z.match.includes(x.district)));
    const pt = n ? P(n.lon, n.lat) : sel ? sel.label : null;
    if (!pt) { job.visible = false; jobLabel.el.hidden = true; jobLine.visible = false; return; }
    job.position.set(pt[0], sel ? STATUS[sel.st].h + 0.6 : 1, pt[1]); job.visible = true;
    const a = new THREE.Vector3(hx, 3.3, hz), b = new THREE.Vector3(pt[0], job.position.y + 2.6, pt[1]);
    const mid = new THREE.Vector3((hx + pt[0]) / 2, 4.5 + Math.hypot(pt[0] - hx, pt[1] - hz) * 0.12, (hz + pt[1]) / 2);
    jobLine.geometry.dispose(); jobLine.geometry = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(40));
    jobLine.visible = true;
    jobLabel.el.hidden = false; jobLabel.el.firstChild.textContent = `${z.match}${z.km ? ` · ~${z.km} กม.` : ''}`; jobLabel.w = 0; jobLabel.v.set(pt[0], job.position.y + 4.6, pt[1]);
    const d = Math.hypot(pt[0] - hx, pt[1] - hz);
    flyTo({ t: new THREE.Vector3((hx + pt[0]) / 2, 0, (hz + pt[1]) / 2), r: clamp(30 + d * 2.2, 36, 120), th: cam.th, ph: 0.7 }, 1200);
  }
  function drawFallback() {
    fb.hidden = false;
    const all = provs.flatMap(p => p.poly.flat(2)); const xs = all.map(a => a[0]), zs = all.map(a => a[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const svg = `<svg viewBox="${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}" role="img" aria-label="แผนที่ประเทศไทยและพื้นที่บริการ">${provs.map(p => `<path d="${p.poly.map(r => r.map(ring => 'M' + ring.map(q => q.map(v => v.toFixed(2)).join(' ')).join('L') + 'Z').join('')).join('')}" fill="#${new THREE.Color(C[p.st]).getHexString()}" stroke="#fff" stroke-width=".15"><title>${p.th}</title></path>`).join('')}<circle cx="${hx}" cy="${hz}" r="1" fill="#e2711d"/></svg>`;
    fb.innerHTML = svg;
  }
  return { highlight, setView, provinces: provs };
}
