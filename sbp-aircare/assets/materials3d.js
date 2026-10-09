// SBP AirCare — installation materials showroom in 3D (Rev.08: photo-real materials).
// A turntable showroom: 7 pedestals, one per material the company installs, each rendered with physically based
// materials (brushed copper, pebbled black EPDM foam, glossy blue PVC, satin white PVC trunking, galvanised steel):
//   1 O-TWO copper pipe, wall thickness 0.70 mm — pancake coil + cut sample with the wall ring called out
//   2 Aeroflex closed-cell insulation — sleeves printed with the brand name along the tube, cut face shows the cells
//   3 Airpro trunking — wall cap, run, flat elbow, joint, end cap; the lid opens to show the bundle inside
//   4 Yazaki THW 1×2.5 sq.mm — brown (L), blue (N), green-yellow (G) coils printed along the insulation
//   5 SCG blue PVC drain pipe — printed pipe on saddles + 90° elbow with sockets
//   6 galvanised brackets + anti-vibration rubber under a mini condensing unit
//   7 NANO RCBO 30 mA on a DIN rail
// Brand names are printed as plain text (no logo artwork is reproduced). Official logo files supplied with the brand
// owners' permission can be dropped in as globalThis.__SBP_LOGOS[key] (build.py inlines assets/logos/<key>.png) and
// are then printed instead of the text. Display proportions are for explanation — not to scale between items.
import { icon } from './icons.js';
import * as THREE from './three.module.min.js';
import { track as glTrack } from './gl-pool.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { buildOutdoor, materialSet, orbit } from './ac3d.js';
import { kit, printed, logoImage } from './matkit3d.js';
import { h } from './sbp-core.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

export const MATS = [
  { id: 'copper', brand: 'O-TWO', th: 'ท่อน้ำยาทองแดง หนา 0.70 มม.', spec: 'ท่อทองแดงความหนาผนัง 0.70 มม. ขนาดท่อตามรุ่นเครื่อง เช่น 1/4" + 3/8" ใช้ความหนาเดียวกันทุกงานบนเว็บ', why: 'ผนังท่อที่หนาพอทนแรงดันน้ำยา บานแฟลร์แล้วไม่ร้าว ดัดโค้งแล้วไม่ยุบ ลดความเสี่ยงรั่วในระยะยาว · ความหนาต้องไม่น้อยกว่าที่คู่มือผู้ผลิตของรุ่นนั้นกำหนด', cam: { y: 0.13, r: 1.0, ph: 1.28 } },
  { id: 'insul', brand: 'Aeroflex', th: 'ฉนวนหุ้มท่อ Aeroflex', spec: 'ยาง EPDM เซลล์ปิด สีดำ หนา 3/8 นิ้ว หุ้มทั้งท่อเล็กและท่อใหญ่ตลอดแนว มีชื่อยี่ห้อพิมพ์บนผิวฉนวน', why: 'กันผิวท่อเย็นเกิดหยดน้ำ (คอนเดนส์) หยดใส่ฝ้าหรือผนัง และลดความเย็นที่สูญเสียระหว่างทาง', cam: { y: 0.08, r: 0.82, ph: 1.22 } },
  { id: 'duct', brand: 'Airpro', th: 'รางครอบท่อ + ข้องอ ข้อต่อ', spec: 'รางสีขาว 75 / 100 มม. พร้อมข้องอ ข้อต่อตรง ฝาครอบผนัง ฝาปิดปลาย ยี่ห้อเดียวกันทั้งชุด ภายในเดินท่อน้ำยา ท่อน้ำทิ้ง และสายไฟเรียบร้อย', why: 'ท่อไม่โดนแดดฝนโดยตรง แนวท่อตรงเรียบร้อย สีขาวกลมกลืนกับผนัง หน้าบ้านดูสวยหลังติดตั้ง', cam: { y: 0.18, r: 1.08, ph: 1.32 } },
  { id: 'cable', brand: 'Yazaki', th: 'สายไฟ THW', spec: 'สาย THW (60227 IEC 01) 3 เส้น ไฟ (น้ำตาล) นิวทรัล (ฟ้า) สายดิน (เขียวแถบเหลือง) ขนาดตามกระแสเครื่อง เช่น 1×2.5 ตร.มม.', why: 'สายได้มาตรฐานและขนาดพอกับกระแสเครื่อง ลดความร้อนสะสมที่สายและจุดต่อ มีสายดินแยกเพื่อความปลอดภัย', cam: { y: 0.1, r: 0.9, ph: 1.2 } },
  { id: 'drain', brand: 'SCG', th: 'ท่อน้ำทิ้ง PVC สีฟ้า', spec: 'ท่อ PVC สีฟ้า 3/4 นิ้ว (หรือ 1 นิ้วตามเครื่อง) วางลาดลงตลอดแนว มีจุดยึดเป็นระยะ ปลายท่อลงท่อระบาย', why: 'ท่อแข็งแรงไม่ตกท้องช้าง น้ำไหลสะดวก ลดปัญหาน้ำย้อนกลับไปหยดจากตัวเครื่อง', cam: { y: 0.1, r: 0.92, ph: 1.24 } },
  { id: 'mount', brand: '', th: 'ขาแขวนคอยล์ร้อน + ยางรองกันสั่น', spec: 'ขาแขวนเหล็กชุบกัลวาไนซ์รับน้ำหนักตามรุ่น ยางรองกันสั่นทุกจุดวางเครื่อง ยึดพุกตามชนิดผนัง', why: 'เครื่องได้ระดับ ระบายลมดี ลดเสียงและแรงสั่นที่ส่งเข้าผนังและห้องข้างเคียง', cam: { y: 0.21, r: 1.18, ph: 1.3 } },
  { id: 'rcbo', brand: 'NANO', th: 'เบรกเกอร์กันดูด (RCBO)', spec: 'RCBO 1P ตัดไฟรั่ว 30 mA 6 kA ขนาด 20A หรือ 32A ตามกระแสเครื่อง แยกวงจรแอร์ (NANO หรือยี่ห้อที่อนุมัติตามใบเสนอราคา)', why: 'ตัดไฟเมื่อไฟเกิน ลัดวงจร หรือไฟรั่ว ช่วยป้องกันไฟดูดและไฟไหม้', cam: { y: 0.17, r: 0.98, ph: 1.34 } },
];
const RC = 1.18;                                   // platform radius where pedestals sit
const PR = 0.27;                                   // pedestal radius
const OVER = { t: [0, 0.0, 0.92], th: 0, ph: 1.18, r: 2.55 };

/* ---------------- small geometry helpers ---------------- */
function canvasTex(w, hh, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = hh; draw(c.getContext('2d'), w, hh);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// straight printed tube along x from x0 to x1 (TubeGeometry: u runs along the pipe, so the print reads along it)
function ptube(r, x0, x1, mat, rotate = 0) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(x0, 0, 0), V(x1, 0, 0)), 8, r, 40, false), mat);
  m.rotation.x = rotate; m.castShadow = true; m.receiveShadow = true; return m;
}
// ring face (cut end) facing ±x
function ringFace(rIn, rOut, mat, x, dir) { const r = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 48), mat); r.rotation.y = dir * Math.PI / 2; r.position.x = x; return r; }
// hollow tube along x: outer + inner skin + two ring faces (cut ends)
function hollow(rIn, rOut, len, mat, faceMat = mat, seg = 40, innerMat = null) {
  const g = new THREE.Group();
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rOut, rOut, len, seg, 1, true), mat);
  const im = (innerMat || mat).clone(); im.side = THREE.BackSide;
  const i = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, len, seg, 1, true), im);
  [o, i].forEach(m => { m.rotation.z = Math.PI / 2; g.add(m); });
  [-1, 1].forEach(s => g.add(ringFace(rIn, rOut, faceMat, s * len / 2, s)));
  g.userData.faces = g.children.slice(2);
  return g;
}
function label(w, hh, draw, mat = {}) {
  const px = 512, py = Math.round(512 * hh / w);
  const tex = canvasTex(px, py, (g, W, H) => draw(g, W, H));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: !!mat.transparent, ...mat }));
}
function roundRect(w, hh, r) { const s = new THREE.Shape(); const x = -w / 2, y = -hh / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + hh - r); s.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh); s.lineTo(x + r, y + hh); s.quadraticCurveTo(x, y + hh, x, y + hh - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
const SHAPE_TO_RUN = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1); // shape x→world y, shape y→world z, extrude z→world x
// big readable brand print for the insulation sleeves (logo slot → official artwork when supplied)
function brandSleeveTex(L, r = 0.06, perM = 0.2) {
  // canvas aspect matches the sleeve (length × circumference) so the lettering is not stretched
  const C = Math.PI * 2 * r, W = 2048, Hh = Math.min(2048, Math.max(256, Math.round(W * C / L))), reps = Math.max(1, Math.round(L / perM));
  const draw = g => {
    g.fillStyle = '#141517'; g.fillRect(0, 0, W, Hh);
    // fine foam speckle
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '60,62,66'},${0.25 + Math.random() * 0.3})`; g.fillRect(Math.random() * W, Math.random() * Hh, 1.5, 1.5); }
    const im = logoImage('aeroflex'), cw = W / reps;
    for (let k = 0; k < reps; k++) {
      const x0 = k * cw + cw * 0.08, cy = Hh * 0.27;
      const pm = Hh / C, big = 0.017 * pm, small = 0.0075 * pm;   // letter heights in metres → px
      if (im && im.complete && im.naturalWidth) { const hh2 = big * 1.3, ww = hh2 * im.naturalWidth / im.naturalHeight; g.drawImage(im, x0, cy - hh2 / 2, ww, hh2); }
      else { g.fillStyle = 'rgba(244,244,240,0.96)'; g.font = `900 ${big}px Arial, Helvetica, sans-serif`; g.textBaseline = 'middle'; g.fillText('AEROFLEX', x0, cy); const tw = g.measureText('AEROFLEX').width; g.fillStyle = 'rgba(244,244,240,0.9)'; g.fillRect(x0, cy + big * 0.62, tw, Math.max(2, big * 0.07)); }
      g.fillStyle = 'rgba(230,230,226,0.82)'; g.font = `700 ${small}px Arial, Helvetica, sans-serif`; g.textBaseline = 'middle'; g.fillText('EPDM  ·  CLOSED CELL  ·  3/8"', x0, cy + big * 1.25);
    }
  };
  const t = canvasTex(W, Hh, draw); t.wrapS = THREE.RepeatWrapping;
  const im = logoImage('aeroflex'); if (im && !im.complete) im.addEventListener('load', () => { draw(t.image.getContext('2d')); t.needsUpdate = true; });
  return t;
}

export function createMaterials3D(container, opts = {}) {
  const dark = opts.theme === 'dark', bp = false;   // Rev.08: every model shows the materials photo-real (blueprint pages too)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 1.1 : 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' }); renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = dark ? 0.75 : 0.95; }
  glTrack(renderer, container, { scene, name: 'วัสดุติดตั้ง' });   // B1: context budget (gl-pool)
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x1a2230 : 0xcfd6de, 0.45));
  const key = new THREE.DirectionalLight(0xfff4e6, 1.9); key.position.set(1.6, 3.2, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 9 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; scene.add(key);
  const rim = new THREE.DirectionalLight(dark ? 0x7cc8ff : 0xdfeaff, dark ? 1.6 : 0.8); rim.position.set(-2.5, 1.5, -2.2); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 30);
  const M = materialSet(dark ? 'showroom' : 'studio');
  const MK = kit('light');
  const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });
  const mat = {
    copper: MK.copper, cut: new THREE.MeshPhysicalMaterial({ color: 0xf2b086, metalness: 1, roughness: 0.12, clearcoat: 0.4 }), brass: MK.brass,
    white: MK.trunk, fit: MK.trunkFit, steel: MK.steel, rubber: MK.rubber, blueIn: S(0x1f4f96, { roughness: 0.6 }),
    zinc: S(0xb9c0c6, { metalness: 0.85, roughness: 0.32 }), wall: S(dark ? 0x3a4450 : 0xe3ddd3, { roughness: 0.95 }), panel: S(dark ? 0x505a66 : 0xb7bec6, { roughness: 0.6 }),
    ped: S(dark ? 0x27313c : 0xf7f8f9, { roughness: 0.28 }), pedRim: S(dark ? 0x8a97a6 : 0xc3cad1, { metalness: 0.7, roughness: 0.3 }), plat: S(dark ? 0x141b23 : 0xdbe1e7, { roughness: 0.55 }),
    dev: S(0xf3f3ef, { roughness: 0.35 }), tape: S(0x3d6fb0, { roughness: 0.6 }), lever: S(0x2c3136, { roughness: 0.4 }), test: S(0xf1c232, { roughness: 0.4 }), term: S(0x3a3f45, { roughness: 0.5 }),
    brown: new THREE.MeshPhysicalMaterial({ color: 0x6a3a1e, roughness: 0.38, clearcoat: 0.3 }), blue: new THREE.MeshPhysicalMaterial({ color: 0x1f4fa8, roughness: 0.38, clearcoat: 0.3 }),
  };
  // closed-cell foam texture for the insulation cut faces
  const cellTex = canvasTex(256, 256, (g, w, hh) => { g.fillStyle = '#2a2d31'; g.fillRect(0, 0, w, hh); for (let i = 0; i < 1700; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '10,11,12' : '74,78,84'},${0.35 + Math.random() * 0.4})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * hh, 0.8 + Math.random() * 2.2, 0, TAU); g.fill(); } });
  const foamFace = new THREE.MeshStandardMaterial({ map: cellTex, roughness: 1 });
  const gyTex = canvasTex(8, 128, (g, w, hh) => { g.fillStyle = '#e2c21e'; g.fillRect(0, 0, w, hh); g.fillStyle = '#2f9a45'; g.fillRect(0, hh * 0.35, w, hh * 0.3); });
  const gyMat = new THREE.MeshPhysicalMaterial({ map: gyTex, roughness: 0.38, clearcoat: 0.3 });

  const add = (g, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); return m; };
  const box = (w, hh, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m);
  const cyl = (r, l, m, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m);
  const tube = (pts, r, m, seg = 64, rad = 14, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.5), seg, r, rad, closed), m);
  const wallPiece = (w, hh, z) => { const g = new THREE.Group(); add(g, box(w, hh, 0.02, mat.wall), 0, hh / 2, z - 0.01); add(g, box(w + 0.01, 0.012, 0.03, mat.panel), 0, 0.006, z - 0.005); return g; };
  const callout = (txt, w = 0.1, hh = 0.03, col = '#e2711d') => { const l = label(w, hh, (c, W, H) => { c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,0.96)'; const r = H / 2; c.beginPath(); c.moveTo(r, 0); c.arcTo(W, 0, W, H, r); c.arcTo(W, H, 0, H, r); c.arcTo(0, H, 0, 0, r); c.arcTo(0, 0, W, 0, r); c.fill(); c.fillStyle = col; c.font = `800 ${H * 0.58}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, W / 2, H / 2 + 2); }, { transparent: true, depthWrite: false, roughness: 1 }); return l; };

  /* ---------------- products (origin = pedestal top centre, front = +z) ---------------- */
  const P = {};
  // 1 — O-TWO copper: pancake coil + tag + cut sample (true wall ratio) with flare + nut and a 0.70 mm callout
  P.copper = () => {
    const g = new THREE.Group(), turns = 3.4, r0 = 0.07, pitch = 0.0168, tr = 0.0075, rmax = r0 + pitch * turns;
    const pts = []; const N = 260; for (let i = 0; i <= N; i++) { const a = i / N * turns * TAU + 0.6; const r = r0 + pitch * (a - 0.6) / TAU; pts.push(V(r * Math.cos(a), rmax + tr + r * Math.sin(a), -0.07)); }
    add(g, tube(pts, tr, mat.copper, 420, 16));
    [0.5, 2.6, 4.7].forEach(a => { const b = box(rmax - r0 + 0.026, 0.009, 0.019, mat.tape); b.rotation.z = a; b.position.set(Math.cos(a) * (r0 + rmax) / 2, rmax + tr + Math.sin(a) * (r0 + rmax) / 2, -0.07); g.add(b); });
    const tag = label(0.1, 0.062, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#b8612f'; c.fillRect(0, 0, W, 18); c.fillStyle = '#1b1f24'; c.font = '900 96px Arial'; c.textAlign = 'center'; c.fillText('O-TWO', W / 2, 128); c.font = '600 38px Arial'; c.fillText('COPPER TUBE', W / 2, 184); c.fillStyle = '#b8612f'; c.font = '900 64px Arial'; c.fillText('0.70 mm', W / 2, 262); c.fillStyle = '#1b1f24'; c.beginPath(); c.arc(W / 2, 36, 9, 0, TAU); c.fill(); }, { side: THREE.DoubleSide });
    tag.position.set(0.1, 0.225, -0.05); tag.rotation.set(-0.05, -0.2, 0.12); g.add(tag);
    add(g, tube([V(0.098, 0.265, -0.055), V(0.105, 0.29, -0.062), V(0.106, 0.305, -0.07)], 0.0012, mat.white, 8, 6));
    const s = new THREE.Group(); s.position.set(0.0, 0.0205, 0.12); s.rotation.y = -0.35; g.add(s);
    const rO = 0.0205, rI = rO * (1 - 0.7 / 4.76);   // 3/8" (OD 9.52 mm → r 4.76 mm) with a 0.70 mm wall, shown ×4.3
    const hp = hollow(rI, rO, 0.2, mat.copper, mat.cut, 48, mat.cut); s.add(hp);
    const cutRing = hp.userData.faces[1];
    const flare = add(s, new THREE.Mesh(new THREE.CylinderGeometry(rO * 1.35, rO, 0.014, 32, 1, true), mat.copper), -0.107, 0, 0); flare.rotation.z = Math.PI / 2;
    const nut = add(s, cyl(0.032, 0.03, mat.brass, 6), -0.088, 0.0105, 0); nut.rotation.z = Math.PI / 2;
    // wall-thickness callout at the cut end
    const co = callout('ผนัง 0.70 มม.', 0.11, 0.028); co.position.set(0.15, 0.05, 0.0); co.rotation.y = 0.35; s.add(co);
    add(s, tube([V(0.1, rO - 0.001, 0), V(0.12, 0.03, 0), V(0.13, 0.042, 0)], 0.0011, new THREE.MeshBasicMaterial({ color: 0xe2711d }), 12, 6));
    return { g, anim(k, t) { s.position.z = 0.12 + 0.05 * k; s.rotation.y = -0.35 - 0.35 * k; nut.rotation.x = t * 0.8 * k; co.visible = k > 0.3; if (cutRing.material.emissive) { cutRing.material.emissive.setHex(0xe2711d); cutRing.material.emissiveIntensity = k * (0.3 + 0.2 * Math.sin(t * 4)); } } };
  };
  // 2 — Aeroflex: two sleeves printed with the brand along the tube; front sleeve slides back to show the copper
  P.insul = () => {
    const g = new THREE.Group();
    const mk = (rCu, len, z, y, rot) => {
      const grp = new THREE.Group(); grp.position.set(0, y, z); grp.rotation.y = rot; g.add(grp);
      const rO = rCu + 0.041;
      const cu = hollow(rCu * 0.853, rCu, len + 0.1, mat.copper, mat.cut, 40, mat.cut); grp.add(cu);
      const sl = new THREE.Group(); grp.add(sl);
      const skin = MK.insul.clone(); skin.map = brandSleeveTex(len, rO); skin.color = new THREE.Color(0xffffff);
      sl.add(ptube(rO, -len / 2, len / 2, skin, -2.0));                                   // print band (v≈0.72) turned towards the viewer
      const inner = MK.insul.clone(); inner.side = THREE.BackSide; const im = new THREE.Mesh(new THREE.CylinderGeometry(rCu + 0.001, rCu + 0.001, len, 32, 1, true), inner); im.rotation.z = Math.PI / 2; sl.add(im);
      [-1, 1].forEach(s => sl.add(ringFace(rCu + 0.001, rO, foamFace, s * len / 2, s)));
      return { grp, sl, rO };
    };
    const a = mk(0.0205, 0.36, 0.07, 0.0615, -0.42), b = mk(0.0137, 0.32, -0.09, 0.0547, -0.36);
    return { g, anim(k) { a.sl.position.x = -0.075 * k; } };
  };
  // 3 — Airpro trunking on a wall section: wall cap → run → flat elbow → run down → joint → end cap; lid opens
  P.duct = () => {
    const g = new THREE.Group(); const Z0 = -0.07, W = 0.07, D = 0.05, t = 0.003;
    g.add(wallPiece(0.46, 0.38, Z0));
    const trunkRun = (len, withLid = true) => {
      const r = new THREE.Group();
      add(r, box(len, W, t, mat.white), len / 2, 0, t / 2);
      add(r, box(len, t, D - 0.006, mat.white), len / 2, W / 2 - t / 2, (D - 0.006) / 2);
      add(r, box(len, t, D - 0.006, mat.white), len / 2, -W / 2 + t / 2, (D - 0.006) / 2);
      let lid = null;
      if (withLid) {
        const sh = roundRect(W + 0.004, 0.009, 0.0038); const geo = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 6 }); geo.applyMatrix4(SHAPE_TO_RUN);
        const pivot = new THREE.Group(); pivot.position.set(0, W / 2 + 0.002, D - 0.0045); r.add(pivot);
        lid = new THREE.Mesh(geo, mat.white); lid.position.set(0, -(W + 0.004) / 2, 0); pivot.add(lid); lid.userData.pivot = pivot;
      }
      return { r, lid };
    };
    const y0 = 0.27, xL = -0.13, xE = 0.1;
    const hr = trunkRun(xE - xL); hr.r.position.set(xL, y0, Z0); g.add(hr.r);
    const vr = trunkRun(y0 - W / 2 - 0.05); vr.r.rotation.z = -Math.PI / 2; vr.r.position.set(xE + W / 2, y0 - W / 2, Z0); g.add(vr.r);
    // the real bundle inside the run: Aeroflex-insulated pipes, blue drain, THW cores (visible when the lid opens)
    const inside = new THREE.Group(); inside.position.set(0, y0, Z0 + 0.024); g.add(inside);
    const L = xE - xL + 0.03;
    add(inside, ptube(0.0125, xL - 0.02, xE + 0.01, printed('insul', L)), 0, 0.012, -0.002);
    add(inside, ptube(0.0105, xL - 0.02, xE + 0.01, printed('insul', L)), 0, -0.014, -0.004);
    add(inside, ptube(0.0085, xL - 0.02, xE + 0.01, printed('drain', L)), 0, -0.024, 0.012).rotation.x = -0.4;
    [['thwL', 0.024], ['thwN', 0.028], ['thwG', 0.032]].forEach(([k, y]) => add(inside, ptube(0.0022, xL - 0.02, xE + 0.01, printed(k, L)), 0, y, 0.008));
    // flat elbow with rounded outer corner
    const es = new THREE.Shape(); const e = W + 0.006, rr = 0.03; es.moveTo(0, 0); es.lineTo(e, 0); es.lineTo(e, e - rr); es.quadraticCurveTo(e, e, e - rr, e); es.lineTo(0, e); es.closePath();
    const eg = new THREE.ExtrudeGeometry(es, { depth: D + 0.002, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelSegments: 2, curveSegments: 10 });
    add(g, new THREE.Mesh(eg, mat.fit), xE - 0.003, y0 - W / 2 - 0.003, Z0 - 0.0005);
    const mkTxt = (txt, w, hh, px = 70) => label(w, hh, (c, Wd, H) => { c.clearRect(0, 0, Wd, H); c.fillStyle = 'rgba(140,148,156,0.92)'; c.font = `800 ${px}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, Wd / 2, H / 2); }, { transparent: true, depthWrite: false });
    const et = mkTxt('Airpro', 0.05, 0.016, 150); et.position.set(xE + 0.034, y0 + 0.004, Z0 + D + 0.0046); g.add(et);
    const cs = roundRect(0.11, 0.11, 0.012); const cg = new THREE.ExtrudeGeometry(cs, { depth: 0.012, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });
    add(g, new THREE.Mesh(cg, mat.fit), xL - 0.02, y0, Z0);
    add(g, box(0.03, W + 0.008, D + 0.004, mat.fit), xL + 0.01, y0, Z0 + (D + 0.004) / 2);
    add(g, box(W + 0.008, 0.032, D + 0.004, mat.fit), xE + W / 2, 0.14, Z0 + (D + 0.004) / 2);
    add(g, box(W + 0.008, 0.014, D + 0.004, mat.fit), xE + W / 2, 0.042, Z0 + (D + 0.004) / 2);
    return { g, anim(k) { hr.lid.userData.pivot.rotation.x = -1.75 * k; } };
  };
  // 4 — Yazaki THW: three coils (L brown / N blue / G green-yellow), print runs along the insulation, stripped tails
  P.cable = () => {
    const g = new THREE.Group(); const tr = 0.0062, coils = [];
    [['thwL', mat.brown], ['thwN', mat.blue], ['thwG', gyMat]].forEach(([kind, plain], ci) => {
      const c = new THREE.Group(); c.position.y = ci * 0.043; c.rotation.y = ci * 1.1; g.add(c); coils.push(c);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        const R = 0.072 + j * 2 * tr + (i % 2) * tr * 0.5, m = printed(kind, TAU * R * 1.2); m.map.repeat.set(Math.max(1, Math.round(TAU * R / 0.16)), 1);
        const tt = new THREE.Mesh(new THREE.TorusGeometry(R, tr, 12, 96), j === 3 ? m : plain); tt.rotation.x = Math.PI / 2; tt.position.y = tr + i * 2 * tr * 0.94; tt.castShadow = true; c.add(tt);
      }
      const Ro = 0.072 + 3 * 2 * tr, y = tr + 2 * 2 * tr * 0.94;
      add(c, tube([V(Ro, y, 0), V(Ro + 0.01, y + 0.005, 0.04), V(Ro - 0.01, y + 0.012, 0.09), V(Ro - 0.04, y + 0.014, 0.12)], tr, plain, 24, 12));
      const core = add(c, cyl(0.0026, 0.026, mat.cut, 10), Ro - 0.052, y + 0.014, 0.127); core.rotation.set(0, -0.9, Math.PI / 2);
      c.userData.core = core;
    });
    const tag = label(0.15, 0.064, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#d6202a'; c.fillRect(0, 0, 150, H); c.fillStyle = '#fff'; c.font = '900 44px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(75, H / 2); c.rotate(-Math.PI / 2); c.fillText('THW', 0, 0); c.restore(); c.fillStyle = '#1b1f24'; c.textAlign = 'left'; c.font = '900 64px Arial'; c.fillText('YAZAKI', 176, 70); c.font = '600 34px Arial'; c.fillText('60227 IEC 01', 178, 132); c.fillText('1 × 2.5 sq.mm  450/750 V', 178, 176); });
    tag.position.set(0.02, 0.06, 0.19); tag.rotation.x = -0.28; g.add(tag);
    add(g, box(0.15, 0.006, 0.05, mat.panel), 0.02, 0.003, 0.2);
    return { g, anim(k, t) { coils[2].position.y = 2 * 0.043 + 0.035 * k; coils[2].rotation.y = 2.2 + t * 0.5 * k; coils.forEach(c => { const m = c.userData.core.material; if (m.emissive) { m.emissive.setHex(0xe2711d); m.emissiveIntensity = 0.25 * k; } }); } };
  };
  // 5 — SCG blue PVC drain: printed pipe on saddles + 90° elbow with sockets (elbow slides off to show the socket)
  P.drain = () => {
    const g = new THREE.Group(); const rO = 0.026, rI = 0.0222, y = 0.022 + rO, blue = MK.drain;
    const pipe = new THREE.Group(); pipe.position.set(-0.04, y, 0.04); g.add(pipe);
    pipe.add(ptube(rO, -0.16, 0.16, printed("drain", 0.32), -2.0));
    const inner = blue.clone(); inner.side = THREE.BackSide; inner.color = new THREE.Color(0x1f4f96); const im = new THREE.Mesh(new THREE.CylinderGeometry(rI, rI, 0.32, 40, 1, true), inner); im.rotation.z = Math.PI / 2; pipe.add(im);
    [-1, 1].forEach(s => pipe.add(ringFace(rI, rO, blue, s * 0.16, s)));
    [-0.15, 0.06].forEach(x => { const sd = new THREE.Mesh(new THREE.TorusGeometry(rO + 0.004, 0.004, 8, 24, Math.PI), mat.zinc); sd.position.set(x, y, 0.04); sd.rotation.y = Math.PI / 2; g.add(sd); add(g, box(0.05, 0.022, 0.06, mat.panel), x, 0.011, 0.04); });
    const el = new THREE.Group(); el.position.set(0.12, y, 0.04); g.add(el);
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.031, 20, 32, Math.PI / 2), blue); bend.position.set(0.035, 0.05, 0); bend.rotation.z = -Math.PI / 2; el.add(bend);
    const s1 = hollow(rO + 0.0005, 0.031, 0.036, blue, blue, 40, mat.blueIn); s1.position.set(0.017, 0, 0); el.add(s1);
    const s2 = hollow(rO + 0.0005, 0.031, 0.036, blue, blue, 40, mat.blueIn); s2.rotation.z = Math.PI / 2; s2.position.set(0.085, 0.068, 0); el.add(s2);
    const up = hollow(rI, rO, 0.09, blue, blue, 40, mat.blueIn); up.rotation.z = Math.PI / 2; up.position.set(0.085, 0.11, 0); el.add(up);
    return { g, anim(k) { el.position.x = 0.12 + 0.05 * k; } };
  };
  // 6 — galvanised brackets + rubber pads under a mini condensing unit; unit lifts to show the pads
  let outFan = null;
  P.mount = () => {
    const g = new THREE.Group(); const Z0 = -0.12;
    g.add(wallPiece(0.46, 0.42, Z0));
    const pads = [];
    [-0.115, 0.115].forEach(x => {
      add(g, box(0.024, 0.2, 0.012, mat.steel), x, 0.12, Z0 + 0.006);
      add(g, box(0.024, 0.024, 0.25, mat.steel), x, 0.1, Z0 + 0.125);
      const br = add(g, box(0.018, 0.018, 0.2, mat.steel), x, 0.062, Z0 + 0.08); br.rotation.x = 0.44;
      [0.035, 0.155].forEach(z => { add(g, cyl(0.004, 0.01, mat.zinc, 10), x, 0.03, Z0 + 0.0125); const pd = add(g, cyl(0.019, 0.022, mat.rubber.clone(), 20), x, 0.1 + 0.012 + 0.011, Z0 + z); pads.push(pd); add(g, cyl(0.0045, 0.03, mat.zinc, 8), x, 0.128, Z0 + z); });
    });
    const OU = buildOutdoor(M); OU.root.scale.setScalar(0.34); OU.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    const holder = new THREE.Group(); holder.position.set(0, 0.134 + 0.325 * 0.34, Z0 + 0.095); holder.add(OU.root); g.add(holder);
    outFan = OU.parts['o-fan'] && OU.parts['o-fan'].userData.spin;
    return { g, anim(k, t) { holder.position.y = 0.134 + 0.325 * 0.34 + 0.085 * k; pads.forEach(p => { if (p.material.emissive) { p.material.emissive.setHex(0xe2711d); p.material.emissiveIntensity = k * (0.25 + 0.2 * Math.sin(t * 4)); } }); } };
  };
  // 7 — NANO RCBO on a DIN rail with L / N wiring; lever switches on
  P.rcbo = () => {
    const g = new THREE.Group(); const Z0 = -0.06;
    add(g, box(0.28, 0.34, 0.016, mat.panel), 0, 0.17, Z0 - 0.008);
    add(g, box(0.26, 0.034, 0.008, mat.zinc), 0, 0.18, Z0 + 0.004);
    const d = new THREE.Group(); d.position.set(0, 0.18, Z0 + 0.008); g.add(d);
    add(d, box(0.078, 0.2, 0.052, mat.dev), 0, 0, 0.026);
    add(d, box(0.078, 0.11, 0.03, mat.dev), 0, 0, 0.067);
    add(d, box(0.078, 0.05, 0.016, mat.dev), 0, 0, 0.09);
    [-1, 1].forEach(s => { add(d, box(0.03, 0.02, 0.012, mat.term), -0.018, s * 0.082, 0.053); add(d, box(0.03, 0.02, 0.012, mat.term), 0.018, s * 0.082, 0.053); });
    const pv = new THREE.Group(); pv.position.set(0, 0.012, 0.098); d.add(pv);
    add(pv, box(0.036, 0.042, 0.018, mat.lever), 0, 0.02, 0.006);
    const test = add(d, cyl(0.0085, 0.01, mat.test, 18), 0.024, -0.036, 0.086); test.rotation.x = Math.PI / 2;
    const face = label(0.07, 0.05, (c, W, H) => { c.fillStyle = '#f3f3ef'; c.fillRect(0, 0, W, H); c.fillStyle = '#1b1f24'; c.font = '900 76px Arial'; c.textAlign = 'center'; c.fillText('NANO', W / 2, 96); c.font = '700 40px Arial'; c.fillText('RCBO  C20', W / 2, 160); c.fillStyle = '#d6202a'; c.fillText('IΔn 30mA', W / 2, 212); c.fillStyle = '#1b1f24'; c.font = '600 32px Arial'; c.fillText('6kA  230V~', W / 2, 256); });
    face.position.set(0, -0.078, 0.0535); d.add(face);
    const wire = (x, m, s) => add(g, tube([V(x, 0.18 + s * 0.09, Z0 + 0.06), V(x, 0.18 + s * 0.13, Z0 + 0.05), V(x + 0.01, 0.18 + s * 0.165, Z0 + 0.02)], 0.005, m, 16, 8));
    wire(-0.018, mat.brown, 1); wire(0.018, mat.blue, 1); wire(-0.018, mat.brown, -1); wire(0.018, mat.blue, -1);
    return { g, anim(k, t) { pv.rotation.x = 0.55 - 1.1 * k; if (test.material.emissive) { test.material.emissive.setHex(0xe2711d); test.material.emissiveIntensity = k * (0.2 + 0.2 * Math.sin(t * 4)); } } };
  };

  /* ---------------- showroom: floor, platform, pedestals ---------------- */
  const world = new THREE.Group(); scene.add(world);
  if (!bp) { const f = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: dark ? 0.35 : 0.14 })); f.rotation.x = -Math.PI / 2; f.position.y = -0.052; f.receiveShadow = true; world.add(f); }
  const plat = new THREE.Group(); world.add(plat);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.42, RC + 0.46, 0.05, 96), mat.plat); disk.position.y = -0.026; disk.receiveShadow = true; plat.add(disk);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(RC + 0.44, 0.006, 8, 160), mat.pedRim); trim.rotation.x = Math.PI / 2; trim.position.y = 0.0; plat.add(trim);
  const slots = MATS.map((m, i) => {
    const a = i / MATS.length * TAU;
    const slot = new THREE.Group(); slot.position.set(RC * Math.sin(a), 0, RC * Math.cos(a)); slot.rotation.y = a; plat.add(slot);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(PR, PR + 0.01, 0.07, 64), mat.ped); ped.position.y = 0.035; ped.receiveShadow = true; ped.castShadow = !bp; slot.add(ped);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(PR + 0.004, 0.004, 8, 96), mat.pedRim); rim.rotation.x = Math.PI / 2; rim.position.y = 0.07; slot.add(rim);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(PR + 0.03, 0.0045, 8, 96), new THREE.MeshBasicMaterial({ color: 0xe2711d, transparent: true, opacity: 0 })); glow.rotation.x = Math.PI / 2; glow.position.y = 0.004; slot.add(glow);
    const spin = new THREE.Group(); spin.position.y = 0.07; slot.add(spin);
    const prod = P[m.id](); spin.add(prod.g);
    prod.g.traverse(o => { if (o.isMesh && !o.material.transparent) { o.castShadow = !bp; o.receiveShadow = !bp; } });
    return { id: m.id, a, slot, spin, glow, prod, k: 0, drop: 0 };
  });
  // unique materials per product so emissive highlights stay local
  slots.forEach(s => s.prod.g.traverse(o => { if (o.isMesh && o.material && o.material.emissive !== undefined) o.material = o.material.clone(); }));

  /* ---------------- camera, carousel, tour ---------------- */
  const st = { theta: OVER.th, phi: OVER.ph, radius: OVER.r, minR: 0.4, maxR: 5, wheelZoom: false, userAt: -1e9 };
  const cam = { t: V(...OVER.t), th: OVER.th, ph: OVER.ph, r: OVER.r }; let fly = null;
  orbit(renderer.domElement, st, () => { fly = null; cam.th = clamp(st.theta, -0.9, 0.9); cam.ph = st.phi; st.theta = cam.th; });
  const frontT = m => ({ t: [0, m.cam.y, RC], th: m.cam.th ?? 0.3, ph: m.cam.ph, r: m.cam.r });
  function flyTo(c) { const to = { t: V(...c.t), th: c.th, ph: c.ph, r: c.r }; if (RM()) { Object.assign(cam, to); fly = null; } else fly = { from: { t: cam.t.clone(), th: cam.th, ph: cam.ph, r: cam.r }, to, t0: performance.now(), dur: 1300 }; st.theta = to.th; st.phi = to.ph; }
  let ang = 0, angTo = 0, focus = null, tourI = 0, tourAt = 0, intro = RM() ? 99 : -1;
  const idx = id => MATS.findIndex(m => m.id === id);
  function turnTo(i) { const target = -slots[i].a; angTo = target + TAU * Math.round((ang - target) / TAU); if (RM()) ang = angTo; }
  function setFocus(id) { focus = id; const i = idx(id); if (i >= 0) { turnTo(i); flyTo(frontT(MATS[i])); } else { flyTo(OVER); tourAt = performance.now(); turnTo(tourI); opts.onTour && opts.onTour(MATS[tourI].id); } }
  function resize() { const W = container.clientWidth || 1, H = container.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W / H < 0.9 ? 44 : 32; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(container); resize();
  let vis = false; new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && intro < 0) { intro = 0; tourAt = performance.now(); opts.onTour && opts.onTour(MATS[0].id); } }, { threshold: 0.2 }).observe(container);
  let last = performance.now(), clock = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = clamp((now - last) / 1000, 0, 0.25), dt = Math.min(raw, 0.05); last = now; if (!vis || document.hidden) return;
    const rm = RM(), d = rm ? 0 : dt; clock += d;
    if (intro >= 0 && intro < 6) intro += raw;   // real time, so slow devices still finish the intro
    // guided tour in overview: advance every 4.2 s unless the viewer is dragging
    if (!focus && !rm && intro > 1.6 && now - tourAt > 4200 && now - st.userAt > 6000) { tourI = (tourI + 1) % MATS.length; tourAt = now; turnTo(tourI); opts.onTour && opts.onTour(MATS[tourI].id); }
    ang += (angTo - ang) * (rm ? 1 : clamp(raw * 3.2, 0, 1)); plat.rotation.y = ang;
    const active = focus ? idx(focus) : (rm ? -1 : tourI);
    slots.forEach((s, i) => {
      const want = i === active ? 1 : 0; s.k += (want - s.k) * (rm ? 1 : clamp(raw * 2.4, 0, 1));
      const dk = rm ? 1 : ease(clamp((intro - 0.12 * i) / 0.8, 0, 1)); s.slot.position.y = (1 - dk) * 0.8; s.slot.visible = intro >= 0 || rm;
      s.slot.rotation.y = -ang;
      s.spin.rotation.y = rm ? 0 : Math.sin(clock * 0.55 + i) * 0.28 * s.k;
      s.glow.material.opacity = s.k * (0.45 + 0.2 * Math.sin(clock * 3));
      s.prod.anim(ease(s.k), clock);
    });
    if (outFan) outFan.rotation.z -= d * 8;
    if (fly) { const k = clamp((now - fly.t0) / fly.dur, 0, 1), e = ease(k); cam.t.lerpVectors(fly.from.t, fly.to.t, e); cam.r = fly.from.r + (fly.to.r - fly.from.r) * e; cam.th = fly.from.th + (fly.to.th - fly.from.th) * e; cam.ph = fly.from.ph + (fly.to.ph - fly.from.ph) * e; if (k >= 1) fly = null; st.theta = cam.th; st.phi = cam.ph; }
    const narrow = camera.aspect < 1.2, ph = cam.ph - (narrow && !focus && !fly ? 0.2 : 0), R = cam.r * (narrow ? (focus ? 1.02 : 1.0) : 1), sp = Math.sin(ph), ty = cam.t.y + (narrow ? (focus ? 0.05 : 0.3) : 0);
    camera.position.set(cam.t.x + R * sp * Math.sin(cam.th), ty + R * Math.cos(ph), cam.t.z + R * sp * Math.cos(cam.th)); camera.lookAt(cam.t.x, ty, cam.t.z);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return { setFocus, replay() { intro = RM() ? 99 : 0; } };
}

export function mountMaterials3D(root, cfg = {}) {
  root.classList.add('mt3');
  const stage = h('div', { class: 'mt3-stage' });
  const chip = h('div', { class: 'mt3-chip', 'aria-live': 'polite' });
  const list = h('ol', { class: 'mt3-list' });
  const ctrl = h('div', { class: 'mt3-ctrl' }, h('button', { type: 'button', class: 's-btn ghost', onclick: () => { cur = null; V3 && V3.setFocus(null); paint(); } }, 'ดูทั้งชุด'), h('button', { type: 'button', class: 's-btn ghost', onclick: () => V3 && V3.replay() }, icon('play', { size: 16 }), 'เล่นใหม่'));
  const note = h('span', { class: 'mt3-note' }, 'ภาพจำลอง 3 มิติ · สัดส่วนเพื่ออธิบาย');
  const fb = h('div', { class: 'mt3-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ รายการวัสดุด้านข้างยังอ่านได้ครบ');
  stage.append(chip, ctrl, note, fb);
  root.append(h('div', { class: 'mt3-grid' }, stage, list),
    h('div', { class: 'mt3-test' }, h('b', {}, 'ทุกงานก่อนส่งมอบ: '), 'ทำ Vacuum ไล่ความชื้นในท่อ · ตรวจรอยต่อ · ทดสอบน้ำทิ้ง · วัดกระแสและแรงดันไฟ · Test Run · ใบรับมอบงาน'),
    h('div', { class: 'mt3-war' }, h('b', {}, 'รับประกันงานติดตั้งสูงสุด 3 ปี '), 'เมื่อซื้อเครื่องใหม่จากบริษัท · 1 ปี เมื่อลูกค้าจัดหาเครื่องเอง · ครอบคลุมฝีมืองานและวัสดุที่บริษัทจัดหา ตามเงื่อนไขในใบเสนอราคา · ตัวเครื่องรับประกันตามผู้ผลิต'));
  let cur = null, tour = null, V3 = null;
  function showChip(m) { chip.innerHTML = ''; chip.hidden = !m; if (m) chip.append(h('b', {}, (m.brand ? m.brand + ' · ' : '') + m.th), h('span', {}, m.spec)); }
  function paint() {
    list.innerHTML = '';
    MATS.forEach((m, i) => list.append(h('li', { class: cur === m.id ? 'on' : (!cur && tour === m.id ? 'tour' : '') }, h('button', { type: 'button', 'aria-pressed': cur === m.id, onclick: () => { cur = cur === m.id ? null : m.id; V3 && V3.setFocus(cur); paint(); } },
      h('span', { class: 'n' }, String(i + 1)), h('span', { class: 'mt3-t' }, m.brand ? h('b', { class: 'mt3-brand', 'data-logo-slot': m.brand.toLowerCase() }, m.brand) : null, h('b', {}, m.th)),
      cur === m.id ? h('span', { class: 'mt3-d' }, h('span', {}, m.spec), h('em', {}, m.why)) : null))));
    showChip(MATS.find(x => x.id === (cur || tour)));
  }
  paint();
  const onTour = id => { tour = id; if (!cur) paint(); };
  const boot = () => { try { V3 = createMaterials3D(stage, { theme: cfg.theme, onTour }); } catch (e) { console.warn('materials 3D unavailable', e); fb.hidden = false; } };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '400px 0px' }); io.observe(stage);
  return { focus: id => { cur = id; V3 && V3.setFocus(id); paint(); } };
}
