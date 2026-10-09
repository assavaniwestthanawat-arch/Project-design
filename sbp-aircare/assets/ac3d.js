// SBP AirCare — procedural 3D air-conditioner viewer (Three.js r170)
// Indoor + outdoor unit built from primitives, exploded view, X-ray, airflow, dirt/clean simulation,
// hotspot anchors (projected to screen for HTML labels), camera presets, scroll-driven explode.
// Production note: swap procedural geometry for real GLB models per series; keep this API.

import * as THREE from './three.module.min.js';
import { createWisps, airTint } from './wisp3d.js';
import { track as glTrack, warm, whenCalm } from './gl-pool.js';
import { RoomEnvironment } from './RoomEnvironment.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Part catalogue (Thai copy used by every variant)                    */
/* ------------------------------------------------------------------ */
export const PARTS = {
  indoor: [
    { id: 'front', th: 'ฝาหน้า', en: 'Front panel', order: 0, explode: [0, 0.36, 0.2], rot: [-0.95, 0, 0], anchor: [0.2, 0.12, 0.12], shell: true,
      d: 'ฝาครอบด้านหน้า เปิดขึ้นเพื่อถอดแผ่นกรอง ช่างจะถอดออกทั้งชิ้นเมื่อล้างใหญ่' },
    { id: 'filter', th: 'แผ่นกรองฝุ่น', en: 'Air filter', order: 1, explode: [0, 0.14, 0.3], anchor: [-0.25, 0.06, 0.1], dirty: true,
      d: 'ดักฝุ่นก่อนเข้าคอยล์ ถ้าอุดตัน ลมจะผ่านได้น้อยลง เป็นจุดที่เจ้าของบ้านล้างเองได้ทุก 2–4 สัปดาห์' },
    { id: 'coil', th: 'คอยล์เย็น', en: 'Evaporator coil', order: 2, explode: [0, 0.1, 0.0], anchor: [-0.1, 0.07, 0.06], dirty: true,
      d: 'ครีบอะลูมิเนียมกับท่อทองแดงที่ดึงความร้อนออกจากอากาศ ฝุ่นที่เกาะครีบทำให้ลมผ่านยาก อาจทำให้ลมเบาและเย็นช้าลง' },
    { id: 'blower', th: 'โบลเวอร์', en: 'Cross-flow fan', order: 3, explode: [0, -0.18, 0.2], anchor: [-0.3, -0.035, 0.05], dirty: true,
      d: 'พัดลมกรงกระรอกที่ดันลมเย็นออกหน้าเครื่อง คราบดำที่ใบพัดเป็นสาเหตุหนึ่งของกลิ่นอับและเสียงดัง ต้องล้างด้วยปั๊มแรงดัน' },
    { id: 'pan', th: 'ถาดน้ำทิ้ง', en: 'Drain pan', order: 4, explode: [0, -0.31, 0.12], anchor: [0.1, -0.09, 0.07], dirty: true,
      d: 'รองน้ำที่กลั่นตัวจากคอยล์ ถ้ามีเมือกหรือท่ออุดตัน น้ำอาจล้นและหยดจากตัวเครื่อง' },
    { id: 'louver', th: 'บานสวิง', en: 'Louver', order: 5, explode: [0, -0.4, 0.3], anchor: [0.0, -0.13, 0.08],
      d: 'ปรับทิศทางลมขึ้น–ลงและซ้าย–ขวา ควรเช็ดคราบใต้บานสวิงทุกครั้งที่ล้าง' },
    { id: 'motor', th: 'มอเตอร์พัดลม', en: 'Fan motor', order: 3, explode: [0.16, -0.18, 0.2], anchor: [0.29, -0.035, 0.0],
      d: 'ขับโบลเวอร์ ช่างตรวจเสียงและอาการสั่นระหว่างล้าง ห้ามให้น้ำเข้า' },
    { id: 'pcb', th: 'กล่องควบคุม', en: 'Control box', order: 6, explode: [0.32, 0.04, 0.06], anchor: [0.38, 0.02, 0.0],
      d: 'แผงวงจรและเซนเซอร์ ต้องคลุมกันน้ำทุกครั้งก่อนฉีดล้าง จุดนี้คือเหตุผลที่ไม่ควรล้างเองด้วยน้ำแรงดัน' },
    { id: 'chassis', th: 'โครงหลัง', en: 'Chassis', order: 7, explode: [0, 0, -0.2], anchor: [-0.38, 0.1, -0.1], shell: true,
      d: 'โครงรับทุกชิ้นส่วน ยึดกับเพลทแขวนผนัง ท่อน้ำยาและท่อน้ำทิ้งออกทางด้านหลัง' },
  ],
  outdoor: [
    { id: 'o-front', th: 'ฝาหน้า', en: 'Front casing', order: 0, explode: [0, 0, 0.36], anchor: [0.25, 0.18, 0.16], shell: true,
      d: 'แผ่นเหล็กพ่นสีด้านหน้า มีช่องลมออกของพัดลม' },
    { id: 'o-top', th: 'ฝาบน', en: 'Top cover', order: 1, explode: [0, 0.3, 0], anchor: [-0.2, 0.28, 0], shell: true,
      d: 'ฝาบนกันแดดกันฝน ถอดเพื่อเข้าถึงแผงควบคุมและคอยล์' },
    { id: 'o-side', th: 'ฝาข้าง', en: 'Side panel', order: 1, explode: [0.32, 0, 0], anchor: [0.4, 0.05, 0.05], shell: true,
      d: 'ฝาข้างด้านขวา ปิดช่องต่อท่อและขั้วไฟ' },
    { id: 'o-grille', th: 'ตะแกรงหน้า', en: 'Fan guard', order: 0, explode: [0, 0, 0.52], anchor: [-0.1, 0.2, 0.17],
      d: 'กันสิ่งของเข้าใบพัด' },
    { id: 'o-fan', th: 'ใบพัดระบายความร้อน', en: 'Propeller fan', order: 2, explode: [0, 0, 0.3], anchor: [-0.18, -0.08, 0.1],
      d: 'ดึงลมผ่านคอยล์ร้อนแล้วเป่าออกด้านหน้า' },
    { id: 'o-motor', th: 'มอเตอร์พัดลม', en: 'Fan motor', order: 3, explode: [0, 0, 0.16], anchor: [-0.1, 0, 0.04],
      d: 'ขับใบพัดคอยล์ร้อน' },
    { id: 'o-coil', th: 'คอยล์ร้อน', en: 'Condenser coil', order: 4, explode: [-0.08, 0, -0.24], anchor: [-0.3, 0.12, -0.13], dirty: true,
      d: 'ระบายความร้อนออกจากระบบ ถ้าครีบสกปรกหรือมีของบังลม เครื่องจะทำงานหนักขึ้น' },
    { id: 'o-comp', th: 'คอมเพรสเซอร์', en: 'Compressor', order: 5, explode: [0.18, 0, 0.3], anchor: [0.3, -0.05, 0],
      d: 'หัวใจของระบบ อัดสารทำความเย็น อาการผิดปกติต้องวัดค่าหน้างานเท่านั้น' },
    { id: 'o-valve', th: 'วาล์วบริการ', en: 'Service valves', order: 6, explode: [0.45, 0, 0.05], anchor: [0.42, -0.16, 0.07],
      d: 'จุดต่อท่อน้ำยาและวัดแรงดัน งานของช่างที่มีเครื่องมือเท่านั้น' },
    { id: 'o-pcb', th: 'แผงควบคุม', en: 'Control board', order: 6, explode: [0.12, 0.34, 0], anchor: [0.3, 0.2, 0],
      d: 'ควบคุมคอมเพรสเซอร์และพัดลม (รุ่นอินเวอร์เตอร์มีแผงขับความเร็ว)' },
  ],
};

/* ------------------------------------------------------------------ */
/* Textures                                                             */
/* ------------------------------------------------------------------ */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const meshTex = () => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 1.2;
  for (let x = 0; x <= w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y <= h; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.lineWidth = 6; g.strokeRect(0, 0, w, h);
});
const displayTex = () => canvasTex(128, 64, (g, w, h) => {
  g.fillStyle = '#0b1117'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7fe3ff'; g.font = '600 34px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('25°', w / 2, h / 2 + 2);
});
const shadowTex = () => canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});
const dotTex = () => canvasTex(64, 64, (g, w, h) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});

/* ------------------------------------------------------------------ */
/* Materials per visual style                                           */
/* ------------------------------------------------------------------ */
function materialSet(style) {
  const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0, ...o });
  const P = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0, clearcoat: 0.4, ...o });
  if (style === 'blueprint') {
    const flat = c => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    return {
      shell: flat(0xfbfcfe), chassis: flat(0xf1f5fa), fin: S(0x7f9cc4, { roughness: 1 }), copper: flat(0xe2711d),
      blade: flat(0xe3eaf4), dark: flat(0x9fb3cf), pcb: flat(0xcfe0f3), filter: flat(0xdfe8f4), pan: flat(0xf4f7fb),
      metal: flat(0xd5dfeb), brass: flat(0xe2711d), insul: flat(0x8aa1c2), display: flat(0x123f7b),
      edge: new THREE.LineBasicMaterial({ color: 0x123f7b, transparent: true, opacity: 0.85 }),
    };
  }
  const dark = style === 'showroom';
  return {
    shell: P(0xf6f7f9, { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }),
    chassis: P(0xe4e7ec, { roughness: 0.55, clearcoat: 0.2 }),
    fin: S(0xd3dae1, { metalness: 0.65, roughness: 0.3 }),
    copper: S(0xc27a46, { metalness: 0.9, roughness: 0.28 }),
    blade: P(0xe8ebee, { roughness: 0.45 }),
    dark: S(dark ? 0x2a2f38 : 0x272b31, { roughness: 0.55 }),
    pcb: S(0x1e6a45, { roughness: 0.45 }),
    filter: S(0xe9f0f6, { roughness: 0.7, transparent: true, side: THREE.DoubleSide, alphaTest: 0.2 }),
    pan: P(0xeef1f4, { roughness: 0.5 }),
    metal: S(0xb7bfc8, { metalness: 0.75, roughness: 0.32 }),
    brass: S(0xc9a44c, { metalness: 0.9, roughness: 0.3 }),
    insul: S(0x121417, { roughness: 0.9 }),
    display: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    edge: null,
  };
}

/* ------------------------------------------------------------------ */
/* Builders                                                             */
/* ------------------------------------------------------------------ */
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
}
function cyl(r, len, mat, axis = 'x', x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); return m;
}
// fins along a 2D segment in the YZ plane, repeated across X
function finSegment(mat, p0, p1, depth, x0, x1, pitch) {
  const dy = p1[0] - p0[0], dz = p1[1] - p0[1];
  const len = Math.hypot(dy, dz);
  const geo = new THREE.BoxGeometry(0.0006, len, depth);
  const n = Math.floor((x1 - x0) / pitch);
  const im = new THREE.InstancedMesh(geo, mat, n);
  const ang = Math.atan2(dz, dy);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang);
  const mtx = new THREE.Matrix4(), s = new THREE.Vector3(1, 1, 1);
  const cy = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
  for (let i = 0; i < n; i++) { mtx.compose(new THREE.Vector3(x0 + i * pitch, cy, cz), q, s); im.setMatrixAt(i, mtx); }
  im.userData.seg = { p0, p1, len, ang, depth };
  return im;
}

function buildIndoor(M) {
  const root = new THREE.Group(); root.name = 'indoor';
  const parts = {};
  const grp = id => { const g = new THREE.Group(); g.name = id; parts[id] = g; root.add(g); return g; };

  // chassis
  const ch = grp('chassis');
  ch.add(box(0.9, 0.29, 0.012, M.chassis, 0, 0, -0.108));
  ch.add(box(0.9, 0.008, 0.125, M.chassis, 0, -0.141, -0.04));
  ch.add(box(0.012, 0.296, 0.232, M.chassis, -0.447, 0, 0.004));
  ch.add(box(0.012, 0.296, 0.232, M.chassis, 0.447, 0, 0.004));
  ch.add(box(0.8, 0.24, 0.003, M.metal, 0, 0, -0.118));

  // front panel — thin curved shell extruded along X
  const fr = grp('front');
  const sh = new THREE.Shape();
  sh.moveTo(-0.105, 0.148); sh.lineTo(0.085, 0.148);
  sh.quadraticCurveTo(0.118, 0.148, 0.118, 0.11);
  sh.lineTo(0.112, -0.06);
  sh.quadraticCurveTo(0.108, -0.1, 0.075, -0.108);
  sh.lineTo(0.074, -0.1);
  sh.quadraticCurveTo(0.1, -0.094, 0.104, -0.06);
  sh.lineTo(0.11, 0.11);
  sh.quadraticCurveTo(0.11, 0.14, 0.085, 0.14);
  sh.lineTo(-0.105, 0.14); sh.closePath();
  const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.882, bevelEnabled: false, curveSegments: 16 });
  fg.rotateY(-Math.PI / 2); fg.translate(0.441, 0, 0);
  fr.add(new THREE.Mesh(fg, M.shell));
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), M.display);
  if (M.display.isMeshBasicMaterial && !M.edge) M.display.map = displayTex();
  disp.position.set(0.31, 0.02, 0.1185); disp.rotation.x = -0.03; fr.add(disp);

  // coil geometry (YZ segments)
  const segA = [[0.118, 0.03], [0.02, 0.083]];
  const segB = [[0.02, 0.083], [-0.07, 0.07]];
  const segC = [[0.118, 0.018], [0.04, -0.082]];
  const x0 = -0.41, x1 = 0.33, depth = 0.018;
  const co = grp('coil');
  [segA, segB, segC].forEach(([a, b]) => co.add(finSegment(M.fin, a, b, depth, x0, x1, 0.0058)));
  // tubes
  [segA, segB, segC].forEach(([a, b]) => {
    const dy = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dy, dz), ny = -dz / L, nz = dy / L;
    [0.18, 0.5, 0.82].forEach(f => [-1, 1].forEach(r => {
      const y = a[0] + dy * f + ny * r * depth * 0.28, z = a[1] + dz * f + nz * r * depth * 0.28;
      co.add(cyl(0.0034, x1 - x0 + 0.02, M.copper, 'x', (x0 + x1) / 2, y, z, 10));
    }));
  });
  co.add(box(0.003, 0.2, 0.18, M.metal, x0 - 0.008, 0.03, 0.01));
  co.add(box(0.003, 0.2, 0.18, M.metal, x1 + 0.008, 0.03, 0.01));
  // hairpin stubs on the left end
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0032, 8, 12, Math.PI), M.copper); t.rotation.y = Math.PI / 2; t.position.set(x0 - 0.016, 0.1 - i * 0.03, 0.04 - i * 0.005); co.add(t); }

  // filter — two halves on top of seg A and B front faces
  const fi = grp('filter');
  const ftex = M.edge ? null : meshTex();
  const fmat = M.filter.clone(); if (ftex) { fmat.map = ftex; fmat.alphaMap = ftex; ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(3, 2); }
  [segA, segB].forEach(([a, b]) => {
    const dy = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dy, dz), ny = -dz / L, nz = dy / L;
    [-0.2, 0.2].forEach(xc => {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.385, L, 0.002), fmat);
      pl.position.set(xc - 0.04, (a[0] + b[0]) / 2 + ny * 0.016, (a[1] + b[1]) / 2 + nz * 0.016);
      pl.rotation.x = Math.atan2(dz, dy);
      fi.add(pl);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.006, 0.006), M.chassis);
      frame.position.copy(pl.position).add(new THREE.Vector3(0, dy * 0.5, dz * 0.5)); fi.add(frame);
    });
  });
  // blower — cross-flow fan
  const bl = grp('blower');
  const bc = new THREE.Group(); bc.position.set(-0.06, -0.035, 0.005); bl.add(bc);
  const bladeGeo = new THREE.BoxGeometry(0.64, 0.0022, 0.013);
  const nB = 34, bim = new THREE.InstancedMesh(bladeGeo, M.blade, nB);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < nB; i++) {
    const a = (i / nB) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a + 0.9);
    mtx.compose(new THREE.Vector3(0, Math.sin(a) * 0.043, Math.cos(a) * 0.043), q, new THREE.Vector3(1, 1, 1));
    bim.setMatrixAt(i, mtx);
  }
  bc.add(bim);
  for (let i = 0; i <= 8; i++) bc.add(cyl(0.05, 0.003, M.blade, 'x', -0.32 + i * 0.08, 0, 0, 28));
  bc.add(cyl(0.006, 0.7, M.metal, 'x', 0, 0, 0, 10));
  bl.userData.spin = bc;
  const mo = grp('motor');
  mo.add(cyl(0.034, 0.052, M.dark, 'x', 0.29, -0.035, 0.005));
  mo.add(box(0.012, 0.09, 0.09, M.chassis, 0.262, -0.035, 0.005));
  // drain pan
  const pa = grp('pan');
  pa.add(box(0.8, 0.004, 0.064, M.pan, -0.04, -0.094, 0.07));
  pa.add(box(0.8, 0.022, 0.004, M.pan, -0.04, -0.084, 0.102));
  pa.add(box(0.8, 0.018, 0.004, M.pan, -0.04, -0.086, 0.038));
  pa.add(cyl(0.008, 0.05, M.pan, 'x', -0.46, -0.1, 0.07));
  // louver
  const lo = grp('louver');
  const piv = new THREE.Group(); piv.position.set(0, -0.128, 0.062); lo.add(piv);
  const flap = box(0.8, 0.004, 0.05, M.shell, 0, 0, 0.012); piv.add(flap);
  lo.userData.flap = piv;
  const vanes = new THREE.Group(); vanes.position.set(0, -0.122, 0.035); lo.add(vanes);
  for (let i = 0; i < 12; i++) { const v = box(0.002, 0.022, 0.03, M.chassis, -0.33 + i * 0.06, 0, 0); vanes.add(v); }
  lo.userData.vanes = vanes;
  // control box
  const pc = grp('pcb');
  pc.add(box(0.05, 0.2, 0.15, M.dark, 0.385, 0.0, -0.02));
  pc.add(box(0.003, 0.15, 0.11, M.pcb, 0.412, 0.0, -0.02));
  [[0.03, 0.02], [-0.02, -0.03], [0.05, -0.04], [-0.05, 0.03]].forEach(([y, z]) => pc.add(box(0.008, 0.018, 0.022, M.metal, 0.416, y, z - 0.02)));
  pc.add(cyl(0.008, 0.02, M.dark, 'x', 0.42, -0.05, 0.02));
  return { root, parts };
}


/* ------------------------------------------------------------------ */
/* Premium showroom unit (own design, FUJIVA-style) — same part ids as buildIndoor so explode / x-ray / labels work.
/* Brand-specific shells (e.g. official manufacturer GLB) load through viewer.loadModel(url) when licensed assets exist.
/* ------------------------------------------------------------------ */
export const FINISHES = {
  pearl: { th: 'ขาวมุก', shell: 0xf4f4f1, cap: 0xe9e9e6, metal: 0.0, rough: 0.18 },
  graphite: { th: 'เทากราไฟต์', shell: 0x2d3137, cap: 0x1f2226, metal: 0.35, rough: 0.28 },
  champagne: { th: 'ทองแชมเปญ', shell: 0xd9c6a4, cap: 0xc7b28e, metal: 0.55, rough: 0.26 },
};
const logoTex = () => canvasTex(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(120,128,138,0.9)'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('F U J I V A', w / 2, h / 2 + 2); });
// Rev.09: also the default wall body everywhere except the blueprint style; o.logo = false drops the FUJIVA wordmark (generic product shots)
function buildPremiumIndoor(M, o = {}) {
  const U = buildIndoor(M);
  const { parts } = U;
  const shellM = new THREE.MeshPhysicalMaterial({ color: 0xf4f4f1, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.2 });
  const capM = new THREE.MeshPhysicalMaterial({ color: 0xe9e9e6, roughness: 0.3, metalness: 0, clearcoat: 0.6 });
  // front band (top + curved front face)
  const out = [[-0.10, 0.156], [0.06, 0.156], [0.096, 0.149], [0.118, 0.128], [0.127, 0.094], [0.129, 0.03], [0.126, -0.04], [0.118, -0.08], [0.104, -0.104]];
  const inn = [[-0.10, 0.149], [0.06, 0.149], [0.091, 0.143], [0.111, 0.124], [0.12, 0.093], [0.122, 0.03], [0.119, -0.04], [0.111, -0.078], [0.098, -0.1]];
  const sh = new THREE.Shape(); sh.moveTo(out[0][0], out[0][1]); sh.splineThru(out.slice(1).map(p => new THREE.Vector2(p[0], p[1])));
  sh.lineTo(inn[inn.length - 1][0], inn[inn.length - 1][1]); sh.splineThru(inn.slice(0, -1).reverse().map(p => new THREE.Vector2(p[0], p[1]))); sh.closePath();
  const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.884, bevelEnabled: false, curveSegments: 24 }); fg.rotateY(-Math.PI / 2); fg.translate(0.442, 0, 0);
  const fr = parts.front; fr.clear();
  const band = new THREE.Mesh(fg, shellM); band.userData.finish = 'shell'; fr.add(band);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.0022, 0.0015), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, toneMapped: false })); glow.position.set(0, -0.062, 0.1225); glow.rotation.x = -0.2; fr.add(glow);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.022), M.display.isMeshBasicMaterial ? new THREE.MeshBasicMaterial({ map: displayTex(), transparent: true, toneMapped: false }) : M.display);
  disp.position.set(0.33, 0.04, 0.1296); fr.add(disp);
  if (!M.edge && o.logo !== false) { const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03), new THREE.MeshBasicMaterial({ map: logoTex(), transparent: true, depthWrite: false })); logo.position.set(-0.3, 0.04, 0.1297); fr.add(logo); }
  // chassis: rounded end caps + back + rear bottom
  const cap = new THREE.Shape(); cap.moveTo(out[0][0], out[0][1]); cap.splineThru(out.slice(1).map(p => new THREE.Vector2(p[0], p[1])));
  cap.splineThru([new THREE.Vector2(0.09, -0.122), new THREE.Vector2(0.05, -0.147)]); cap.lineTo(-0.085, -0.15); cap.quadraticCurveTo(-0.121, -0.15, -0.121, -0.12); cap.lineTo(-0.121, 0.13); cap.quadraticCurveTo(-0.121, 0.156, -0.10, 0.156);
  const cg = new THREE.ExtrudeGeometry(cap, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 4, curveSegments: 24 }); cg.rotateY(-Math.PI / 2);
  const ch = parts.chassis; ch.clear();
  [0.456, -0.444].forEach(x => { const m = new THREE.Mesh(cg, capM); m.position.x = x; m.userData.finish = 'cap'; ch.add(m); });
  ch.add(box(0.884, 0.29, 0.006, M.chassis, 0, 0.0, -0.118), box(0.884, 0.006, 0.13, M.chassis, 0, -0.147, -0.055));
  // wing-shaped horizontal flap
  const piv = parts.louver.userData.flap; piv.clear();
  const wing = new THREE.Shape(); wing.moveTo(-0.04, 0); wing.quadraticCurveTo(0.0, 0.009, 0.045, 0.002); wing.quadraticCurveTo(0.0, -0.002, -0.04, 0);
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.8, bevelEnabled: false, curveSegments: 12 }); wg.rotateY(-Math.PI / 2); wg.translate(0.4, 0, 0);
  const flap = new THREE.Mesh(wg, shellM); flap.userData.finish = 'shell'; flap.position.z = 0.012; piv.add(flap);
  // ---- Rev.08 premium details: top intake slots, champagne trim, glass display with icons, dark outlet cavity, status LED
  const flat = !!M.edge;
  const slotM = flat ? M.dark : new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.55 });
  const slots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0042, 0.0018, 0.118), slotM, 58); const mm = new THREE.Matrix4();
  for (let i = 0; i < 58; i++) { mm.makeTranslation(-0.415 + i * 0.01456, 0.1566, -0.03); slots.setMatrixAt(i, mm); }
  fr.add(slots);
  const trimM = flat ? M.metal : new THREE.MeshPhysicalMaterial({ color: 0xcbb896, metalness: 0.95, roughness: 0.22, clearcoat: 0.6 });
  const trim = box(0.86, 0.0045, 0.0022, trimM, 0, -0.022, 0.1268); fr.add(trim);
  if (!flat) {
    const dispT = canvasTex(256, 96, (g, w, h) => {
      g.clearRect(0, 0, w, h); const r = 18; g.fillStyle = 'rgba(12,16,22,0.94)'; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
      g.fillStyle = '#8fe8ff'; g.font = '600 58px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('25°', w * 0.44, h / 2 + 3);
      g.strokeStyle = '#8fe8ff'; g.lineWidth = 3; const cx = w * 0.84, cy = h / 2; for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); g.stroke(); }
    });
    disp.material = new THREE.MeshBasicMaterial({ map: dispT, transparent: true, toneMapped: false }); disp.geometry = new THREE.PlaneGeometry(0.072, 0.027); disp.position.set(0.315, 0.036, 0.1297);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 16), new THREE.MeshBasicMaterial({ color: 0x5cf0a0, toneMapped: false })); led.position.set(0.37, 0.018, 0.1298); fr.add(led); fr.userData.led = led;
    const cav = box(0.84, 0.002, 0.07, new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.9 }), 0, -0.1, 0.065); ch.add(cav);
  }
  U.finishMats = { shell: shellM, cap: capM };
  return U;
}

function buildOutdoor(M, o = {}) {   // o.logo === false → no brand mark (Rev.09 r4 job scene: the customer's unit carries no brand)
  // Rev.08 — condensing unit with rounded casing, bell-mouth + wire fan guard, swept propeller, louvred side vents,
  // wire-guarded rear/left coil, valve cover + brass service valves with flare nuts, rails with rubber feet.
  const root = new THREE.Group(); root.name = 'outdoor';
  const parts = {};
  const grp = id => { const g = new THREE.Group(); g.name = id; parts[id] = g; root.add(g); return g; };
  const flat = !!M.edge;
  const W = 0.8, H = 0.55, D = 0.3;
  const fc = new THREE.Vector2(-0.1, 0);
  const shellM = flat ? M.shell : new THREE.MeshPhysicalMaterial({ color: 0xf1f1ee, roughness: 0.34, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const greyM = flat ? M.chassis : new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.5, metalness: 0.2 });
  const guardM = flat ? M.dark : new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.45, metalness: 0.6 });
  const rubberM = flat ? M.dark : new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 });
  const rbx = (w, h, d, r, mat, x, y, z) => { const sh = new THREE.Shape(); const iw = w / 2 - r, ih = h / 2 - r; sh.moveTo(-iw, -ih); sh.lineTo(iw, -ih); sh.lineTo(iw, ih); sh.lineTo(-iw, ih); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3 }); g.translate(0, 0, -(d - 2 * r) / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return m; };
  // base rails + rubber feet (static)
  const base = new THREE.Group(); root.add(base);
  [-0.3, 0.3].forEach(x => { base.add(rbx(0.07, 0.03, 0.34, 0.006, greyM, x, -H / 2 - 0.02, 0)); [-0.13, 0.13].forEach(z => base.add(cyl(0.022, 0.018, rubberM, 'y', x, -H / 2 - 0.044, z, 16))); });
  base.add(box(0.8, 0.012, 0.29, greyM, 0, -H / 2 - 0.004, 0));
  // front casing with a bevelled fan opening
  const f = grp('o-front');
  const s = new THREE.Shape(); const r0 = 0.02; s.moveTo(-W / 2 + r0, -H / 2); s.lineTo(W / 2 - r0, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r0); s.lineTo(W / 2, H / 2 - r0); s.quadraticCurveTo(W / 2, H / 2, W / 2 - r0, H / 2); s.lineTo(-W / 2 + r0, H / 2); s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r0); s.lineTo(-W / 2, -H / 2 + r0); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r0, -H / 2);
  const hole = new THREE.Path(); hole.absarc(fc.x, fc.y, 0.2, 0, Math.PI * 2, true); s.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 56 });
  const fm = new THREE.Mesh(fg, shellM); fm.position.z = D / 2 - 0.01; f.add(fm);
  const bell = new THREE.Mesh(new THREE.TorusGeometry(0.203, 0.012, 12, 72), shellM); bell.position.set(fc.x, fc.y, D / 2 - 0.004); f.add(bell);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.08, 56, 1, true), flat ? M.chassis : new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7, side: THREE.DoubleSide })); shroud.rotation.x = Math.PI / 2; shroud.position.set(fc.x, fc.y, D / 2 - 0.05); f.add(shroud);
  // louvred side vents on the front right (embossed slots)
  for (let i = 0; i < 11; i++) f.add(rbx(0.15, 0.007, 0.006, 0.0025, greyM, 0.27, -0.2 + i * 0.03, D / 2 + 0.002));
  if (!flat && o.logo !== false) { const lg = canvasTex(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(96,104,114,.95)'; g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('F U J I V A', w / 2, h / 2 + 2); }); const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03), new THREE.MeshBasicMaterial({ map: lg, transparent: true, depthWrite: false })); lp.position.set(0.27, 0.22, D / 2 + 0.0055); f.add(lp); }
  // top cover (rounded)
  const t = grp('o-top'); t.add(rbx(W + 0.014, 0.018, D + 0.014, 0.006, shellM, 0, H / 2 + 0.008, 0));
  // right side panel + valve cover
  const sd = grp('o-side'); sd.add(rbx(0.014, H, D, 0.005, shellM, W / 2 + 0.006, 0, 0));
  sd.add(rbx(0.018, 0.16, 0.13, 0.006, greyM, W / 2 + 0.018, -0.1, 0.05));
  sd.add(box(0.004, 0.035, 0.06, guardM, W / 2 + 0.028, -0.06, 0.05));
  // fan guard: concentric rings + radial spokes + hub badge
  const gr = grp('o-grille');
  [0.035, 0.07, 0.105, 0.14, 0.175, 0.205].forEach(r => { const tor = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0024, 6, 72), guardM); tor.position.set(fc.x, fc.y, D / 2 + 0.02); gr.add(tor); });
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const sp = cyl(0.0022, 0.18, guardM, 'y', fc.x + Math.cos(a) * 0.12, fc.y + Math.sin(a) * 0.12, D / 2 + 0.019, 6); sp.rotation.z = a - Math.PI / 2; gr.add(sp); }
  const hub = cyl(0.03, 0.006, guardM, 'z', fc.x, fc.y, D / 2 + 0.021, 28); gr.add(hub);
  // fan: three swept, pitched blades
  const fa = grp('o-fan');
  const spin = new THREE.Group(); spin.position.set(fc.x, fc.y, 0.1); fa.add(spin);
  spin.add(cyl(0.038, 0.055, flat ? M.dark : new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.5 }), 'z'));
  const bladeS = new THREE.Shape(); bladeS.moveTo(0.03, -0.02); bladeS.bezierCurveTo(0.09, -0.07, 0.17, -0.06, 0.19, 0.0); bladeS.bezierCurveTo(0.19, 0.06, 0.11, 0.08, 0.03, 0.03); bladeS.closePath();
  const bladeG = new THREE.ExtrudeGeometry(bladeS, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 16 });
  const bladeM = flat ? M.dark : new THREE.MeshStandardMaterial({ color: 0x3b4047, roughness: 0.4, metalness: 0.1 });
  for (let i = 0; i < 3; i++) { const hld = new THREE.Group(); hld.rotation.z = i / 3 * Math.PI * 2; spin.add(hld); const bl = new THREE.Mesh(bladeG, bladeM); bl.rotation.x = 0.42; hld.add(bl); }
  fa.userData.spin = spin;
  const fmo = grp('o-motor');
  fmo.add(cyl(0.05, 0.07, M.dark, 'z', fc.x, fc.y, 0.035));
  fmo.add(box(0.03, H - 0.04, 0.02, M.metal, fc.x + 0.06, 0, 0.0));
  fmo.add(box(0.03, H - 0.04, 0.02, M.metal, fc.x - 0.06, 0, 0.0));
  // condenser coil (L shape, rear + left) behind a wire guard
  const co = grp('o-coil');
  const finBack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0006, H - 0.06, 0.024), M.fin, 120);
  const finSide = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, H - 0.06, 0.0006), M.fin, 48);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 120; i++) { mm.makeTranslation(-0.38 + i * 0.0049, 0, -D / 2 + 0.02); finBack.setMatrixAt(i, mm); }
  for (let i = 0; i < 48; i++) { mm.makeTranslation(-W / 2 + 0.022, 0, -D / 2 + 0.03 + i * 0.0052); finSide.setMatrixAt(i, mm); }
  co.add(finBack, finSide);
  for (let j = 0; j < 9; j++) co.add(cyl(0.0035, 0.6, M.copper, 'x', -0.09, -0.24 + j * 0.06, -D / 2 + 0.02, 8));
  for (let j = 0; j < 8; j++) { const hp = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0035, 6, 12, Math.PI), M.copper); hp.rotation.y = Math.PI / 2; hp.position.set(0.215, -0.21 + j * 0.06, -D / 2 + 0.02); co.add(hp); }
  if (!flat) { const wg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, H - 0.05), new THREE.MeshStandardMaterial({ map: meshTex(), alphaMap: meshTex(), transparent: true, color: 0x2b2f35, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false })); wg.material.map.wrapS = wg.material.map.wrapT = THREE.RepeatWrapping; wg.material.map.repeat.set(4, 3); wg.material.alphaMap.wrapS = wg.material.alphaMap.wrapT = THREE.RepeatWrapping; wg.material.alphaMap.repeat.set(4, 3); wg.rotation.y = Math.PI; wg.position.set(-0.08, 0, -D / 2 - 0.003); co.add(wg); }
  // partition
  root.add(box(0.004, H - 0.03, D - 0.02, M.metal, 0.19, 0, 0));
  // compressor
  const cp = grp('o-comp');
  const cpb = new THREE.Group(); cpb.position.set(0.3, -0.12, -0.02); cp.add(cpb);
  cpb.add(new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.2, 32), M.dark));
  const cap1 = new THREE.Mesh(new THREE.SphereGeometry(0.072, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.dark); cap1.position.y = 0.1; cpb.add(cap1);
  cpb.add(cyl(0.03, 0.16, M.dark, 'y', 0.1, 0.02, 0.05));
  cpb.add(cyl(0.006, 0.12, M.copper, 'y', 0.03, 0.18, 0.0));
  // service valves (brass body + hex flare nut + cap) below the valve cover
  const va = grp('o-valve');
  [[0.014, -0.2, 0.06], [0.011, -0.2, 0.105]].forEach(([r, y, z]) => { va.add(cyl(r + 0.006, 0.03, M.brass, 'x', W / 2 + 0.018, y, z, 6)); va.add(cyl(r, 0.04, M.brass, 'x', W / 2 + 0.045, y, z, 16)); va.add(cyl(r + 0.004, 0.012, M.brass, 'y', W / 2 + 0.018, y + 0.025, z, 6)); });
  // control board
  const pb = grp('o-pcb');
  pb.add(box(0.17, 0.1, 0.2, M.metal, 0.3, 0.19, -0.01));
  pb.add(box(0.15, 0.004, 0.17, M.pcb, 0.3, 0.242, -0.01));
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, parts };
}

function addEdges(root, mat) {
  if (!mat) return;
  root.traverse(o => {
    if (o.isMesh && !o.isInstancedMesh && !o.userData.noEdge) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), mat.clone());
      e.userData.isEdge = true; o.add(e);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Particles                                                            */
/* ------------------------------------------------------------------ */
// Rev.09 round 3: air is drawn as soft wisps (wisp3d.js) — each particle a short tapering translucent streamline along the
// path, widening as it leaves the unit — so the flow reads as moving air, not as drops. API unchanged: returns a mesh with
// userData.step(dt, speed, swap, spread, minU); material.opacity fades the whole flow.
function makeFlow(pathPts, count, colA, colB, size, xr, yr = 0.02, additive = true) {
  const curve = new THREE.CatmullRomCurve3(pathPts.map(p => new THREE.Vector3(0, p[0], p[1])));
  const LUT = curve.getSpacedPoints(240);
  const K = 10, DU = 0.013;
  const W = createWisps(null, { max: count * (K - 1), additive, renderOrder: 6 });
  const pts = W.mesh; pts.material.opacity = additive ? 0.9 : 0.85;
  const u = new Float32Array(count), xs = new Float32Array(count), jit = new Float32Array(count * 2), wd = new Float32Array(count);
  for (let i = 0; i < count; i++) { u[i] = Math.random(); xs[i] = xr[0] + Math.random() * (xr[1] - xr[0]); jit[i * 2] = (Math.random() - 0.5) * yr; jit[i * 2 + 1] = (Math.random() - 0.5) * 0.02; wd[i] = size * (0.34 + Math.random() * 0.3); }
  const ca = new THREE.Color(colA), cb = new THREE.Color(colB), tmp = new THREE.Color(), c3 = [0, 0, 0], sc = new Float32Array(K * 3);
  pts.userData.step = (dt, speed, swap = [0.36, 0.5], spread = 1, minU = 0) => {
    W.begin();
    for (let i = 0; i < count; i++) {
      u[i] += dt * speed * (0.8 + (i % 7) * 0.05); if (u[i] > 1) u[i] -= 1;
      const u0 = u[i]; if (u0 < K * DU || u0 - K * DU < minU) continue;
      let fanH = 0;
      for (let t = 0; t < K; t++) {
        const uu = u0 - t * DU, p = LUT[Math.min(239, Math.floor(uu * 239))];
        const fan = Math.max(0, uu - 0.7) * spread; if (!t) fanH = fan;
        sc[t * 3] = xs[i] * (1 + fan * 0.6); sc[t * 3 + 1] = p.y + jit[i * 2] * (1 + fan * 6); sc[t * 3 + 2] = p.z + jit[i * 2 + 1] * (1 + fan * 6);
      }
      tmp.copy(ca).lerp(cb, clamp((u0 - swap[0]) / (swap[1] - swap[0]), 0, 1)); c3[0] = tmp.r; c3[1] = tmp.g; c3[2] = tmp.b; airTint(c3, additive);
      const a = Math.min(1, u0 * 8) * Math.min(1, (1 - u0) * 4) * (additive ? 0.34 : 0.42) * (1 - 0.45 * Math.min(1, fanH * 2)), w = wd[i] * (1 + fanH * 4);
      for (let t = 0; t < K - 1; t++) {
        const f0 = 1 - t / (K - 1), f1 = 1 - (t + 1) / (K - 1);
        W.seg(sc[t * 3], sc[t * 3 + 1], sc[t * 3 + 2], sc[t * 3 + 3], sc[t * 3 + 4], sc[t * 3 + 5], c3[0], c3[1], c3[2], a * f0 * f0, a * f1 * f1, w * (0.5 + 0.5 * f0), w * (0.5 + 0.5 * f1));
      }
    }
    W.end();
  };
  return pts;
}

function makeSpray(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), life = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.012, map: dotTex(), color: 0xbfe9ff, transparent: true, depthWrite: false, opacity: 0.85, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false;
  const reset = i => {
    const nx = -0.35 + Math.random() * 0.62;
    pos[i * 3] = nx + (Math.random() - 0.5) * 0.04; pos[i * 3 + 1] = 0.26 + (Math.random() - 0.5) * 0.02; pos[i * 3 + 2] = 0.42;
    vel[i * 3] = (Math.random() - 0.5) * 0.08; vel[i * 3 + 1] = -0.35 - Math.random() * 0.2; vel[i * 3 + 2] = -0.9 - Math.random() * 0.4;
    life[i] = Math.random() * 0.5;
  };
  for (let i = 0; i < count; i++) reset(i);
  pts.userData.step = (dt, sweepX) => {
    for (let i = 0; i < count; i++) {
      life[i] += dt;
      vel[i * 3 + 1] -= 1.2 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 2] < 0.09 || life[i] > 0.8) { reset(i); pos[i * 3] = sweepX + (Math.random() - 0.5) * 0.12; }
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

/* ------------------------------------------------------------------ */
/* Orbit controls (lightweight, touch-friendly: vertical page scroll kept) */
/* ------------------------------------------------------------------ */
function orbit(dom, state, onChange) {
  let drag = null;
  dom.style.touchAction = 'pan-y';
  dom.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, th: state.theta, ph: state.phi, id: e.pointerId, moved: false }; });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    state.theta = drag.th - dx * 0.008;
    state.phi = clamp(drag.ph - dy * 0.006, 0.25, Math.PI - 0.35);
    state.userAt = performance.now(); onChange();
  });
  const up = e => { if (drag && e.pointerId === drag.id) { state.lastDragMoved = drag.moved; drag = null; } };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  dom.addEventListener('wheel', e => {
    if (!state.wheelZoom) return;
    e.preventDefault(); state.radius = clamp(state.radius * (1 + Math.sign(e.deltaY) * 0.08), state.minR, state.maxR); state.userAt = performance.now(); onChange();
  }, { passive: false });
}

/* ------------------------------------------------------------------ */
/* Viewer                                                               */
/* ------------------------------------------------------------------ */
export function createACViewer(container, opts = {}) {
  const o = {
    style: 'studio', unit: 'indoor', autoRotate: true, wheelZoom: true, airflow: true,
    accent: 0xe2711d, onFrame: null, onSelect: null, exposure: 1.0, radiusScale: 1, background: null, floorShadow: true, ghost: 0.16, targetOffset: [0, 0], ...opts,
  };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: o.background == null, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = o.style === 'blueprint' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure;
  renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (o.background != null) scene.background = new THREE.Color(o.background);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 30);
  if (o.style !== 'blueprint') {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = o.style === 'showroom' ? 0.55 : 0.9;
  }
  glTrack(renderer, container, { scene, name: 'เครื่องแอร์ 3 มิติ' });   // B1: context budget (gl-pool)
  const hemi = new THREE.HemisphereLight(0xffffff, o.style === 'showroom' ? 0x1a2230 : 0xdfe6ee, o.style === 'blueprint' ? 1.6 : 0.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, o.style === 'blueprint' ? 1.1 : 1.4); key.position.set(1.5, 2.2, 2.4); scene.add(key);
  if (o.style === 'showroom') {
    const rim = new THREE.DirectionalLight(0x6fc8ff, 2.2); rim.position.set(-2, 1, -2); scene.add(rim);
    const warm = new THREE.PointLight(0xe2711d, 1.2, 3); warm.position.set(0.8, -0.4, 0.8); scene.add(warm);
  }

  const M = materialSet(o.style);
  // Rev.09: the rounded premium body is the default (sharper, more realistic); premium: true keeps the FUJIVA wordmark, blueprint stays technical
  const prem = o.premium ?? (o.style !== 'blueprint');
  const units = { indoor: prem ? buildPremiumIndoor(M, { logo: o.premium === true }) : buildIndoor(M), outdoor: buildOutdoor(M) };
  const holder = new THREE.Group(); scene.add(holder);
  for (const k in units) {
    // clone materials per mesh so highlight / x-ray / dirt can be per-part
    units[k].root.traverse(ob => {
      if (ob.isMesh || ob.isInstancedMesh) {
        ob.material = ob.material.clone();
        ob.userData.base = { color: ob.material.color.clone(), opacity: ob.material.opacity ?? 1, transparent: ob.material.transparent };
      }
    });
    addEdges(units[k].root, M.edge || (o.edgeLines ? new THREE.LineBasicMaterial({ color: o.edgeLines, transparent: true, opacity: 0.32 }) : null));
    units[k].root.visible = false; holder.add(units[k].root);
    units[k].meta = Object.fromEntries(PARTS[k].map(p => [p.id, p]));
    // remember rest positions
    for (const id in units[k].parts) units[k].parts[id].userData.rest = units[k].parts[id].position.clone();
  }
  if (o.floorShadow) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: o.style === 'showroom' ? 0.6 : 0.28 }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -0.42; scene.add(sh); holder.userData.shadow = sh;
  }
  // airflow
  const addv = o.style === 'showroom';
  const flowIn = makeFlow([[0.36, 0.0], [0.2, 0.01], [0.15, 0.05], [0.06, 0.062], [-0.02, 0.02], [-0.08, 0.02], [-0.125, 0.06], [-0.19, 0.17], [-0.28, 0.33], [-0.36, 0.48]], 300, addv ? 0xff9a52 : 0xe2711d, addv ? 0x55d6ff : 0x1b8fd6, addv ? 0.016 : 0.011, [-0.34, 0.24], 0.016, addv);
  const flowOut = makeFlow([[0.04, -0.62], [0.03, -0.36], [0.0, -0.13], [0.0, 0.02], [0.0, 0.12], [0.0, 0.34], [0.02, 0.62], [0.03, 0.95]], 300, addv ? 0x9fdcff : 0x1b8fd6, addv ? 0xff7a3d : 0xe2711d, addv ? 0.018 : 0.012, [-0.3, 0.1], 0.36, addv);
  const spray = makeSpray(420);
  scene.add(flowIn, flowOut, spray);

  const state = {
    unit: null, explodeT: 0, explode: 0, xray: false, xrayT: 0, selected: null, dirt: 0, dirtT: 0,
    theta: 0.5, phi: 1.24, radius: 1.75, target: new THREE.Vector3(0, -0.02, 0),
    camTo: null, minR: 0.9, maxR: 3.2, wheelZoom: o.wheelZoom, userAt: 0,
    running: true, fan: 1, cleaning: 0, visible: true, t: 0, airflow: o.airflow,
  };
  state.radius *= o.radiusScale; state.maxR *= o.radiusScale;
  const PRESET = {
    persp: { theta: 0.5, phi: 1.24, radius: 1.75 },
    front: { theta: 0, phi: Math.PI / 2 - 0.04, radius: 1.6 },
    side: { theta: -Math.PI / 2 + 0.02, phi: Math.PI / 2 - 0.08, radius: 1.5 },
    top: { theta: -0.001, phi: 0.3, radius: 1.7 },
    back: { theta: Math.PI - 0.5, phi: 1.2, radius: 1.8 },
    exploded: { theta: 0.55, phi: 1.14, radius: 2.55 },
  };

  function setUnit(u) {
    state.unit = u;
    for (const k in units) units[k].root.visible = k === u;
    flowIn.visible = u === 'indoor'; flowOut.visible = u === 'outdoor';
    if (holder.userData.shadow) holder.userData.shadow.position.y = u === 'indoor' ? -0.42 : -0.32;
    state.target.set(0, u === 'indoor' ? -0.02 : 0, 0);
    state.selected = null; applyVisual();
  }

  function partsList() { return PARTS[state.unit]; }

  function applyVisual() {
    const U = units[state.unit]; if (!U) return;
    const accent = new THREE.Color(o.accent);
    for (const id in U.parts) {
      const meta = U.meta[id] || {};
      const isSel = state.selected === id;
      const ghost = (state.selected && !isSel) ? o.ghost : 1;
      const xr = meta.shell ? lerp(1, 0.1, state.xrayT) : 1;
      const op = Math.min(ghost, xr);
      U.parts[id].traverse(ob => {
        const m = ob.material; if (!m) return;
        if (ob.userData.isEdge) { m.opacity = 0.85 * op; m.transparent = true; return; }
        const b = ob.userData.base; if (!b) return;
        const want = op < 0.999 || b.transparent;
        if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; }
        m.opacity = b.opacity * op; m.depthWrite = op > 0.5;
        // dirt tint
        if (meta.dirty && !M.edge) {
          const dirtC = id === 'blower' ? new THREE.Color(0x2e2a24) : id === 'pan' ? new THREE.Color(0x6a7350) : new THREE.Color(0x857255);
          m.color.copy(b.color).lerp(dirtC, state.dirt * (id === 'filter' ? 0.9 : 0.75));
          if (id === 'filter') m.opacity = Math.min(1, b.opacity * op * (1 + state.dirt * 0.6));
        }
        if ('emissive' in m) { m.emissive = m.emissive || new THREE.Color(); m.emissive.copy(isSel ? accent : new THREE.Color(0)); m.emissiveIntensity = isSel ? 0.35 : 0; }
      });
    }
  }

  const v3 = new THREE.Vector3();
  function anchors() {
    const U = units[state.unit]; const out = [];
    const r = renderer.domElement.getBoundingClientRect();
    for (const p of PARTS[state.unit]) {
      const g = U.parts[p.id]; if (!g) continue;
      v3.set(...p.anchor).add(g.position).sub(g.userData.rest);
      holder.localToWorld(v3);
      const camDir = v3.clone().sub(camera.position);
      v3.project(camera);
      out.push({ id: p.id, th: p.th, en: p.en, x: (v3.x * 0.5 + 0.5) * r.width, y: (-v3.y * 0.5 + 0.5) * r.height, visible: v3.z < 1 && camDir.length() > 0.05, selected: state.selected === p.id });
    }
    return out;
  }

  // picking
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('click', e => {
    if (state.lastDragMoved) { state.lastDragMoved = false; return; }
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(units[state.unit].root, true).filter(h => h.object.visible && !h.object.userData.isEdge && (h.object.material.opacity ?? 1) > 0.3);
    if (!hits.length) { select(null); return; }
    let ob = hits[0].object; while (ob && !units[state.unit].parts[ob.name]) ob = ob.parent;
    select(ob ? ob.name : null);
  });

  function select(id) {
    state.selected = id && state.selected !== id ? id : (id ? null : null);
    applyVisual();
    o.onSelect && o.onSelect(state.selected ? units[state.unit].meta[state.selected] : null);
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    // r19: between portrait and landscape keep the horizontal view at ~40° (no jump at 0.9 that cropped the unit on phones)
    const a = w / h; camera.fov = a < 0.9 ? 44 : a < 1.25 ? 2 * Math.atan(Math.tan(0.349) / a) * 57.296 : 32; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();
  orbit(renderer.domElement, state, () => { state.camTo = null; });
  const io = new IntersectionObserver(es => { state.visible = es[0].isIntersecting; }, { threshold: 0.01 });
  io.observe(container);

  let last = performance.now(), raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    if (!state.visible || document.hidden) return;
    state.t += dt;
    const rm = RM();
    // tween values
    const k = rm ? 1 : 1 - Math.pow(0.001, dt);
    state.explode = lerp(state.explode, state.explodeT, rm ? 1 : 1 - Math.pow(0.02, dt));
    const prevX = state.xrayT; state.xrayT = lerp(state.xrayT, state.xray ? 1 : 0, k);
    if (state.cleaning > 0) {
      state.cleaning = Math.max(0, state.cleaning - dt);
      state.dirt = Math.max(0, state.dirt - dt * 0.42 * state.dirtFrom);
      applyVisual();
    }
    if (Math.abs(prevX - state.xrayT) > 1e-4) applyVisual();
    // camera
    if (state.camTo) {
      state.theta = lerp(state.theta, state.camTo.theta, k * 0.9); state.phi = lerp(state.phi, state.camTo.phi, k * 0.9); state.radius = lerp(state.radius, state.camTo.radius, k * 0.9);
      if (Math.abs(state.theta - state.camTo.theta) < 1e-3) state.camTo = null;
    } else if (o.autoRotate && !rm && now - state.userAt > 3500 && !state.selected) {
      state.autoDir = state.autoDir || 1;
      state.theta += dt * 0.12 * state.autoDir * (state.explode > 0.5 ? 0.5 : 1);
      if (state.theta > PRESET.persp.theta + 0.75) state.autoDir = -1;
      if (state.theta < PRESET.persp.theta - 0.75) state.autoDir = 1;
    }
    state.target.y = lerp(state.target.y, (state.unit === 'indoor' ? -0.02 : 0) + state.explode * 0.06 + o.targetOffset[1] * (1 - state.explode * 0.5), 0.1);
    state.target.x = lerp(state.target.x, o.targetOffset[0] * (1 - state.explode * 0.3), 0.1);
    const sp = Math.sin(state.phi);
    camera.position.set(state.target.x + state.radius * sp * Math.sin(state.theta), state.target.y + state.radius * Math.cos(state.phi), state.target.z + state.radius * sp * Math.cos(state.theta));
    camera.lookAt(state.target);
    // explode offsets
    const U = units[state.unit];
    const maxOrder = Math.max(...PARTS[state.unit].map(p => p.order));
    for (const p of PARTS[state.unit]) {
      const g = U.parts[p.id]; if (!g) continue;
      const s = 0.09;
      const lt = clamp((state.explode - p.order * s) / Math.max(0.2, 1 - maxOrder * s), 0, 1);
      const e = easeIO(lt);
      g.position.set(g.userData.rest.x + p.explode[0] * e, g.userData.rest.y + p.explode[1] * e, g.userData.rest.z + p.explode[2] * e);
      if (p.rot) g.rotation.set(p.rot[0] * e, p.rot[1] * e, p.rot[2] * e);
    }
    // motion
    if (state.running && !rm) {
      if (state.unit === 'indoor') {
        U.parts.blower.userData.spin.rotation.x -= dt * 9 * state.fan * (1 - state.dirt * 0.45);
        U.parts.louver.userData.flap.rotation.x = 0.45 + Math.sin(state.t * 0.9) * 0.28;
        U.parts.louver.userData.vanes.rotation.y = Math.sin(state.t * 0.6) * 0.25;
      } else U.parts['o-fan'].userData.spin.rotation.z -= dt * 11 * state.fan;
    }
    const flowOn = state.airflow && state.running && state.explode < 0.25;
    flowIn.visible = flowOn && state.unit === 'indoor';
    flowOut.visible = flowOn && state.unit === 'outdoor';
    if (flowIn.visible) flowIn.userData.step(rm ? 0 : dt, 0.16 * (1 - state.dirt * 0.6), [0.34, 0.48], 1, state.xrayT > 0.5 || addv ? 0 : 0.6);
    if (flowOut.visible) flowOut.userData.step(rm ? 0 : dt, 0.2, [0.28, 0.42], 0.1);
    spray.visible = state.cleaning > 0 && state.unit === 'indoor';
    if (spray.visible) spray.userData.step(dt, -0.35 + ((state.t * 0.35) % 1) * 0.62);
    renderer.render(scene, camera);
    o.onFrame && o.onFrame(anchors(), state);
  }
  raf = requestAnimationFrame(frame);

  setUnit(o.unit);
  // r15: compile both units, solid and see-through (x-ray, and a picked part ghosting the rest), once the visitor pauses — the
  // first press of x-ray, a part or the outdoor unit then shows at once instead of waiting for new shaders
  // r20: not on phones (touch, ≤ 900 px): eight extra full renders cost a slow phone seconds of main thread for buttons most
  // visitors never press there — the first press compiles on demand instead
  if (!matchMedia('(pointer:coarse) and (max-width:900px)').matches) whenCalm(() => {
    const keepU = state.unit, keepX = state.xrayT, keepS = state.selected;
    for (const k in units) {
      state.unit = k; const ids = Object.keys(units[k].parts);
      for (const x of [0, 0.5]) { state.xrayT = x; state.selected = null; applyVisual(); warm(renderer, scene, camera, units[k].root); }
      // a picked part ghosts all the others (see-through): two picks cover every part's see-through version
      state.xrayT = 0; for (const id of ids.slice(0, 2)) { state.selected = id; applyVisual(); warm(renderer, scene, camera, units[k].root); }
    }
    for (const k in units) { state.unit = k; state.xrayT = 0; state.selected = null; applyVisual(); }
    state.unit = keepU; state.xrayT = keepX; state.selected = keepS; applyVisual(); renderer.render(scene, camera);
  }, 1500);
  if (RM()) state.explode = state.explodeT;

  return {
    three: THREE, scene, camera, renderer,
    parts: () => partsList(),
    setUnit, select,
    selectById: id => { state.selected = null; select(id); },
    setExplode: (v, instant) => { state.explodeT = clamp(v, 0, 1); if (instant) state.explode = state.explodeT; },
    getExplode: () => state.explodeT,
    setXray: v => { state.xray = !!v; },
    setAirflow: v => { state.airflow = !!v; },
    setRunning: v => { state.running = !!v; },
    setDirt: v => { state.dirt = clamp(v, 0, 1); applyVisual(); },
    setFinish: name => { const F = FINISHES[name]; if (!F) return; units.indoor.root.traverse(ob => { if (!ob.userData.finish || !ob.material) return; const c = new THREE.Color(ob.userData.finish === 'cap' ? F.cap : F.shell); ob.material.color.copy(c); ob.userData.base.color = c.clone(); ob.material.metalness = F.metal; ob.material.roughness = F.rough; }); applyVisual(); },
    // licensed manufacturer model (GLB) replaces the procedural indoor shell when the company has the asset rights
    loadModel: async url => { const { GLTFLoader } = await import('./GLTFLoader.js'); const g = await new GLTFLoader().loadAsync(url); const root = g.scene; const b = new THREE.Box3().setFromObject(root), sz = b.getSize(new THREE.Vector3()); const k = 0.9 / Math.max(sz.x, 1e-3); root.scale.setScalar(k); b.setFromObject(root); root.position.sub(b.getCenter(new THREE.Vector3())); units.indoor.root.visible = false; holder.add(root); state.custom = root; return root; },
    clean: () => { state.dirtFrom = Math.max(0.05, state.dirt); state.cleaning = 2.6; },
    view: name => { state.camTo = { ...PRESET[name], radius: PRESET[name].radius * o.radiusScale }; state.userAt = performance.now(); },
    zoom: f => { state.radius = clamp(state.radius * f, state.minR, state.maxR); state.userAt = performance.now(); },
    state,
    dispose: () => { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}

/* ------------------------------------------------------------------ */
/* Virtual room: AC in a room + floor temperature map (illustrative)    */
/* ------------------------------------------------------------------ */
export function createRoomSim(container, opts = {}) {
  const o = { onStats: null, accent: 0xe2711d, ...opts };
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
  glTrack(renderer, container, { scene, name: 'ห้องจำลอง' });   // B1: context budget (gl-pool)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4250, 0.8));
  const sun = new THREE.DirectionalLight(0xffe2b8, 1.6); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  const M = materialSet('studio');
  const room = new THREE.Group(); scene.add(room);
  const N = 48; const data = new Uint8Array(N * N * 4);
  const heat = new THREE.DataTexture(data, N, N); heat.colorSpace = THREE.SRGBColorSpace; heat.magFilter = THREE.LinearFilter; heat.minFilter = THREE.LinearFilter;
  const P = { w: 5, d: 4, h: 2.7, sun: 1, people: 2, btu: 12000, set: 25, tOut: 34 };
  let T = 32, simMin = 0, reached = null, ac, flow, running = true;
  const st = { theta: 0.62, phi: 1.02, radius: 9, target: new THREE.Vector3(0, 0.9, 0), minR: 4, maxR: 16, wheelZoom: false, userAt: 0 };
  orbit(renderer.domElement, st, () => {});

  function colorFor(t) { // 22 (blue) .. 34 (red)
    const k = clamp((t - 22) / 12, 0, 1);
    const stops = [[0.16, 0.45, 0.95], [0.2, 0.8, 0.9], [0.95, 0.9, 0.55], [0.96, 0.55, 0.25], [0.85, 0.22, 0.2]];
    const f = k * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(f)), r = f - i;
    return stops[i].map((c, j) => lerp(c, stops[i + 1][j], r));
  }

  function build() {
    room.clear();
    const { w, d, h } = P;
    const floorMat = new THREE.MeshStandardMaterial({ map: heat, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat); floor.rotation.x = -Math.PI / 2; room.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xeef0f3, roughness: 0.95, side: THREE.DoubleSide });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); back.position.set(0, h / 2, -d / 2); room.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat.clone()); left.rotation.y = Math.PI / 2; left.position.set(-w / 2, h / 2, 0); room.add(left);
    // window on left wall
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0xffe9c2 }));
    win.rotation.y = Math.PI / 2; win.position.set(-w / 2 + 0.01, 1.45, 0.2); room.add(win);
    const frameM = new THREE.MeshStandardMaterial({ color: 0x5a6675 });
    [[0, 0.62, 1.64, 0.04], [0, -0.62, 1.64, 0.04]].forEach(([z, y, len]) => { const b = box(0.05, 0.04, len, frameM, -w / 2 + 0.02, 1.45 + y, 0.2); room.add(b); });
    sun.position.set(-w / 2 - 3, 4, 1); sun.intensity = [0.6, 1.4, 2.4][P.sun];
    // furniture
    const fm = new THREE.MeshStandardMaterial({ color: 0x9aa7b6, roughness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0xb58a62, roughness: 0.7 });
    room.add(box(1.8, 0.42, 0.8, fm, 0.4, 0.21, d / 2 - 0.7));
    room.add(box(1.8, 0.4, 0.18, fm, 0.4, 0.55, d / 2 - 0.35));
    room.add(box(1.0, 0.05, 0.55, wood, 0.4, 0.42, d / 2 - 1.55));
    room.add(box(1.2, 0.04, 0.6, wood, w / 2 - 0.8, 0.74, -d / 2 + 0.4));
    [[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(([x, z]) => room.add(box(0.04, 0.72, 0.04, wood, w / 2 - 0.8 + x, 0.36, -d / 2 + 0.4 + z)));
    // people markers
    for (let i = 0; i < P.people; i++) {
      const pmk = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 6, 12), new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.6 }));
      pmk.position.set(-0.6 + i * 0.7, 0.62, d / 2 - 1.1 - (i % 2) * 0.4); room.add(pmk);
    }
    // AC unit (reused indoor builder)
    const U = buildIndoor(M);
    U.root.traverse(ob => { if (ob.isMesh) ob.material = ob.material.clone(); });
    U.root.position.set(0.3, h - 0.45, -d / 2 + 0.13); room.add(U.root); ac = U;
    // airflow jet into the room
    flow = makeFlow([[0.0, 0.0], [-0.05, 0.25], [-0.5, 1.2], [-1.2, 2.2], [-1.8, 3.0], [-2.1, 3.6]], 520, 0x7fdcff, 0x7fdcff, 0.06, [-0.4, 0.4]);
    flow.position.set(0.3, h - 0.57, -d / 2 + 0.2); room.add(flow);
    st.target.set(0, h * 0.35, 0); st.radius = Math.max(w, d) * 1.75;
    T = 32; simMin = 0; reached = null;
  }

  function step(dtReal) {
    const { w, d, h } = P;
    const area = w * d, vol = area * h;
    const dtSim = dtReal * 90; // 1 real second ≈ 1.5 simulated minutes
    const qSun = area * [25, 45, 75][P.sun], qPeople = P.people * 75, UA = (2 * (w + d) * h) * 0.9 + area * 1.2;
    const qEnv = UA * (P.tOut - T);
    const qAcMax = P.btu * 0.293 * 0.72; // sensible fraction
    const qAc = running ? (T > P.set + 0.3 ? qAcMax : Math.min(qAcMax, qSun + qPeople + qEnv)) : 0;
    const C = vol * 1.2 * 1005 * 9; // air + contents effective mass
    T += ((qSun + qPeople + qEnv - qAc) / C) * dtSim;
    simMin += dtSim / 60;
    if (reached == null && T <= P.set + 0.05) reached = simMin;
    // floor map
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * w, z = (0.5 - j / (N - 1)) * d;
      const jetZ = -d / 2 + 0.2 + 3.0, jetX = 0.3 - 1.4;
      const dj = Math.hypot((x - jetX) / 1.5, (z - Math.min(jetZ, d / 2 - 0.5)) / 1.9);
      const cool = running ? Math.exp(-dj * dj) * Math.min(2.6, (qAcMax / 3000)) : 0;
      const dw = Math.hypot((x + w / 2) / 1.3, (z - 0.2) / 1.2);
      const warm = Math.exp(-dw * dw) * [0.6, 1.6, 2.8][P.sun];
      const t = T - cool + warm + Math.sin(i * 0.7 + j * 0.3 + simMin * 0.05) * 0.05;
      const c = colorFor(t);
      const k = (j * N + i) * 4; data[k] = c[0] * 255; data[k + 1] = c[1] * 255; data[k + 2] = c[2] * 255; data[k + 3] = 255;
    }
    heat.needsUpdate = true;
    o.onStats && o.onStats({ T, simMin, reached, set: P.set, need: recommend(), ...P });
  }
  function recommend() { const a = P.w * P.d; return Math.round(a * [700, 750, 820][P.sun] * Math.max(1, P.h / 2.7) + Math.max(0, P.people - 2) * 600); }

  function resize() { const w = container.clientWidth || 1, h = container.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(container); resize();
  let vis = true; new IntersectionObserver(es => vis = es[0].isIntersecting).observe(container);
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    if (!vis || document.hidden) return;
    const rm = RM();
    if (!rm && performance.now() - st.userAt > 4000) st.theta = 0.62 + Math.sin(now / 9000) * 0.25;
    const sp = Math.sin(st.phi);
    camera.position.set(st.target.x + st.radius * sp * Math.sin(st.theta), st.target.y + st.radius * Math.cos(st.phi), st.target.z + st.radius * sp * Math.cos(st.theta));
    camera.lookAt(st.target);
    if (ac && running && !rm) { ac.parts.blower.userData.spin.rotation.x -= dt * 9; ac.parts.louver.userData.flap.rotation.x = 0.55 + Math.sin(now / 1200) * 0.2; }
    if (flow) { flow.visible = running; flow.userData.step(rm ? 0 : dt, 0.18, [0, 1], 1.2); flow.material.opacity = clamp((T - P.set) / 3, 0.25, 0.8); }
    step(dt);
    renderer.render(scene, camera);
  }
  build(); requestAnimationFrame(frame);
  return {
    set: patch => { const rebuild = ['w', 'd', 'h', 'people'].some(k => k in patch && patch[k] !== P[k]); Object.assign(P, patch); if (rebuild) build(); else { T = Math.max(T, 30); simMin = 0; reached = null; } },
    restart: () => { T = 32; simMin = 0; reached = null; },
    setRunning: v => { running = !!v; },
    params: P,
  };
}

// helpers reused by the room studio
export { buildIndoor, buildPremiumIndoor, buildOutdoor, materialSet, orbit, canvasTex, finSegment, meshTex };
