// Rev.11 วางบนผนังบ้านคุณ — node check (no browser) of the real-size body behind ar.js:
//   ar3d.usdz(sc) for wall / ceiling / cassette / floor → a valid USDZ (stored zip, model.usda first, 64-byte aligned data, no
//   texture files = nothing a logo could ride on), real scale (metersPerUnit 1), plane anchoring with the right alignment, and a body
//   whose size is the modelScene size in metres, anchored at the centre of its back (wall) or of its base (floor)
//   ar3d.surfaceOf / placement → the back lies flat on a wall facing the camera, the base stands on the floor, a cassette's ceiling
//   board touches the ceiling (only its face shows)
// usage: node tests/ar-usdz.mjs
import { unzipSync, strFromU8 } from '../assets/three-ar/fflate.module.js';
// canvas stand-in: the viewer's materials draw a few small textures at build time (the AR body drops every map)
const g2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : /^create\w*Gradient$/.test(k) ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: (t, k, v) => ((t[k] = v), true) });
globalThis.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => g2d }) };
const THREE = await import('../assets/three.module.min.js');
const A = await import('../assets/ar3d.js');

const bad = [], ok = [];
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol;
const check = (cond, what) => (cond ? ok : bad).push(what);

// the zip's own records: names, method, where each file's data starts
function entries(u8) {
  const out = [], dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  for (let p = 0; p + 30 <= u8.length && dv.getUint32(p, true) === 0x04034b50;) {
    const method = dv.getUint16(p + 8, true), size = dv.getUint32(p + 18, true), nl = dv.getUint16(p + 26, true), xl = dv.getUint16(p + 28, true);
    const name = strFromU8(u8.subarray(p + 30, p + 30 + nl)), data = p + 30 + nl + xl;
    out.push({ name, method, data }); p = data + size;
  }
  return out;
}
const nums = s => s.match(/-?\d+(\.\d+)?(e[-+]?\d+)?/gi).map(Number);
// world bounding box of the exported scene: every Xform's matrix applied to its geometry file's points
function bounds(files) {
  const usda = strFromU8(files['model.usda']), box = new THREE.Box3(), v = new THREE.Vector3(), M = new THREE.Matrix4();
  const re = /references = @\.\/(geometries\/Geometry_\d+\.usda)@[\s\S]*?matrix4d xformOp:transform = (\([^\n]*\))\n/g;
  let m, n = 0;
  while ((m = re.exec(usda))) {
    const geo = strFromU8(files[m[1]]), pts = nums(geo.match(/point3f\[\] points = \[([^\]]*)\]/)[1]);
    M.fromArray(nums(m[2]));
    for (let i = 0; i < pts.length; i += 3) box.expandByPoint(v.set(pts[i], pts[i + 1], pts[i + 2]).applyMatrix4(M));
    n++;
  }
  return { box, n, usda };
}

const CASES = [
  { type: 'wall', w: 0.77, h: 0.285, d: 0.226, src: 'spec', align: 'vertical' },
  { type: 'ceiling', w: 1.28, h: 0.235, d: 0.69, src: 'est', align: 'vertical' },
  { type: 'cassette', w: 0.84, h: 0.256, d: 0.84, src: 'est', align: 'horizontal' },
  { type: 'floor', w: 0.5, h: 1.75, d: 0.32, src: 'est', align: 'horizontal' },
];
for (const sc of CASES) {
  const t = sc.type, t0 = performance.now();
  const u8 = await A.usdz(sc), ms = Math.round(performance.now() - t0);
  check(u8 instanceof Uint8Array && u8[0] === 0x50 && u8[1] === 0x4b, `${t}: zip signature`);
  const list = entries(u8);
  check(list.length >= 2 && list[0].name === 'model.usda', `${t}: model.usda is the first file (${list.length} files)`);
  check(list.every(e => e.method === 0), `${t}: every file stored uncompressed (USDZ rule)`);
  check(list.every(e => e.data % 64 === 0), `${t}: every file's data 64-byte aligned (USDZ rule)`);
  check(list.every(e => /^(model|geometries\/Geometry_\d+)\.usda$/.test(e.name)), `${t}: geometry only — no texture or image files`);
  const files = unzipSync(u8);
  check(Object.keys(files).length === list.length, `${t}: fflate reads the same ${list.length} files`);
  const { box, n, usda } = bounds(files);
  check(/metersPerUnit = 1\b/.test(usda) && /upAxis = "Y"/.test(usda), `${t}: metres, Y up (real scale)`);
  check(usda.includes('token preliminary:anchoring:type = "plane"'), `${t}: plane anchoring`);
  check(usda.includes(`token preliminary:planeAnchoring:alignment = "${sc.align}"`), `${t}: ${sc.align} alignment`);
  check(!/NaN|Infinity/.test(usda) && n >= 2, `${t}: ${n} meshes, no NaN`);
  const s = box.getSize(new THREE.Vector3());
  if (t === 'cassette') {
    // the size is the casing (above the ceiling); the decorative panel below it is wider — the card says ตัวเครื่อง ไม่รวมหน้ากาก
    const U = A.arUnit(sc), b = new THREE.Box3().setFromObject(U.body);
    check(near(b.max.x - b.min.x, sc.w) && near(b.max.y - b.min.y, sc.h) && near(b.max.z - b.min.z, sc.d), `${t}: casing ${sc.w}×${sc.h}×${sc.d} m`);
    check(s.x >= sc.w && s.z >= sc.d && s.x < sc.w + 0.2, `${t}: panel wider than the casing, within reason (${s.x.toFixed(3)} m)`);
    A.disposeUnit(U);
  } else check(near(s.x, sc.w) && near(s.y, sc.h) && near(s.z, sc.d), `${t}: body ${sc.w}×${sc.h}×${sc.d} m (got ${s.x.toFixed(3)}×${s.y.toFixed(3)}×${s.z.toFixed(3)})`);
  if (sc.align === 'vertical') check(near(box.min.z, 0, 1e-4) && near(box.min.x, -box.max.x) && near(box.min.y, -box.max.y), `${t}: origin at the centre of its back (back on the wall)`);
  else check(near(box.min.y, 0, 1e-4) && near(box.min.x, -box.max.x) && near(box.min.z, -box.max.z), `${t}: origin at the centre of its base (stands on the floor)`);
  check(u8.length < 4e6, `${t}: ${(u8.length / 1e6).toFixed(2)} MB, ${ms} ms`);
}

// WebXR maths
check(A.surfaceOf(0.98) === 'floor' && A.surfaceOf(-0.97) === 'ceiling' && A.surfaceOf(0.05) === 'wall' && A.surfaceOf(0.55) === null, 'surfaceOf: floor / ceiling / wall / slope');
check(A.MOUNTS.wall.join() === 'wall' && A.MOUNTS.floor.join() === 'floor' && A.MOUNTS.cassette[0] === 'ceiling' && A.MOUNTS.ceiling.includes('wall'), 'MOUNTS: each type goes where it is installed');
check(A.QL_ALIGN.wall === 'vertical' && A.QL_ALIGN.floor === 'horizontal', 'QL_ALIGN: wall vertical, floor horizontal');
{
  const U = A.arUnit({ type: 'wall', w: 0.8, h: 0.29, d: 0.21 }), cam = new THREE.Vector3(0.3, 1.5, 0);
  // a wall facing +X (camera on its +X side), hit 2.1 m up
  const hit = new THREE.Vector3(-1.2, 2.1, -0.4), p = A.placement(U, 'wall', hit, { x: 1, y: 0, z: 0 }, cam);
  const back = new THREE.Vector3((U.box.min.x + U.box.max.x) / 2, (U.box.min.y + U.box.max.y) / 2, U.box.min.z).applyQuaternion(p.quat).add(p.pos);
  const front = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quat);
  check(back.distanceTo(hit) < 1e-6, 'wall: centre of the back on the hit point (flush)');
  check(near(front.x, 1, 1e-6), 'wall: front faces out of the wall, toward the camera');
  check(near(p.bottom, 2.1 - 0.145, 1e-3), 'wall: bottom edge height = hit − half the height');
  const p2 = A.placement(U, 'wall', hit, { x: -1, y: 0, z: 0 }, cam);   // normal reported the other way: still faces the camera
  check(near(new THREE.Vector3(0, 0, 1).applyQuaternion(p2.quat).x, 1, 1e-6), 'wall: a flipped normal still faces the camera');
  A.disposeUnit(U);
  const F = A.arUnit({ type: 'floor', w: 0.5, h: 1.75, d: 0.32 }), fh = new THREE.Vector3(0, 0, -1.6), pf = A.placement(F, 'floor', fh, { x: 0, y: 1, z: 0 }, new THREE.Vector3(0, 1.5, 0));
  check(near(pf.pos.y + F.box.min.y, 0, 1e-6), 'floor: base on the floor');
  check(near(new THREE.Vector3(0, 0, 1).applyQuaternion(pf.quat).z, 1, 1e-6), 'floor: turned to face the camera');
  const pt = A.placement(F, 'floor', fh, { x: 0, y: 1, z: 0 }, new THREE.Vector3(0, 1.5, 0), A.TURN);
  check(near(pt.yaw - pf.yaw, Math.PI / 12, 1e-9), 'floor: หมุน turns 15°');
  A.disposeUnit(F);
  const K = A.arUnit({ type: 'cassette', w: 0.84, h: 0.256, d: 0.84 }), kh = new THREE.Vector3(0.2, 2.7, -1.5), pk = A.placement(K, 'ceiling', kh, { x: 0, y: -1, z: 0 }, new THREE.Vector3(0, 1.5, 0));
  check(pk.faceOnly && near(pk.pos.y + K.boardY, 2.7, 1e-6), 'cassette: ceiling board at the ceiling, only the panel shows');
  A.disposeUnit(K);
}

ok.forEach(x => console.log("  ok  " + x));
console.log(JSON.stringify({ ok: ok.length, bad }, null, 1));
process.exit(bad.length ? 1 : 0);
