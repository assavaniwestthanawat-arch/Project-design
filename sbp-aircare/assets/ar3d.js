// SBP AirCare — วางบนผนังบ้านคุณ: the real-size body and the WebXR session behind ar.js (Rev.11, owner 12 ต.ค. 2569: "พัฒนา A B C
// ให้แบบล้ำสมัย … ไม่คาดคิดว่าจะเจอหรือมีจริงๆ"). Loaded only when a visitor asks for AR, never with the page.
// The body is the brand-neutral unit the 3D viewer draws (units3d.buildUnit, no logo — CLAUDE.md §5.5, §6.6 #20): only its outside,
// in plain colours, scaled so its bounding box is exactly the size modelScene gives (the model's spec, or the typical size of the type,
// which the card says) in metres. Nothing here is measured or promised — the card and the overlay say แบบจำลองเพื่ออธิบาย.
//   arUnit(sc) → { root, body, face, box, size, boardY, mats }  ·  usdz(sc) → zip bytes for AR Quick Look (iPhone / iPad)
//   surfaceOf(ny), placement(U, surf, hit, normal, cam, turn) → pure maths for WebXR  ·  startXR(session, sc, ui) → the hit-test session
import * as THREE from './three.module.min.js';
import { buildUnit } from './units3d.js';
import { materialSet } from './ac3d.js';
import { mergeGeometries, mergeVertices } from './BufferGeometryUtils.js';
import { USDZExporter } from './three-ar/USDZExporter.js';

// the outside a customer sees — inner parts (coil, fan, filter), pipes, the drain hose and hanger rods stay out
const OUTSIDE = { wall: ['chassis', 'front', 'louver'], ceiling: ['casing', 'grille', 'louver', 'vanes'], cassette: ['casing', 'panel', 'grille', 'louver'], floor: ['casing', 'louver', 'display', 'grille'] };
// a cassette set into a real ceiling shows only its panel: the body sits above the ceiling board
const FACE = ['panel', 'grille', 'louver'];
// AR Quick Look anchors: a wall-hung or ceiling-suspended unit goes on a wall (the suspended one slides up to the ceiling line);
// a floor-standing unit and a cassette stand on the floor (Quick Look has no ceiling anchor — ar.js says so on the card)
export const QL_ALIGN = { wall: 'vertical', ceiling: 'vertical', floor: 'horizontal', cassette: 'horizontal' };
// WebXR surfaces each type may be placed on; the first is where it is installed, a cassette on the floor is a size check
export const MOUNTS = { wall: ['wall'], floor: ['floor'], ceiling: ['ceiling', 'wall'], cassette: ['ceiling', 'floor'] };
export const TURN = Math.PI / 12;   // หมุน: 15° per tap (floor and ceiling placements)
const UP = new THREE.Vector3(0, 1, 0);

// plain colour version of a viewer material (USDZ takes MeshStandardMaterial without maps; screens become dark glass)
function plainOf(src, cache) {
  const glass = !!src.map, basic = !src.isMeshStandardMaterial;
  const c = glass ? new THREE.Color(0x161a20) : src.color ? src.color.clone() : new THREE.Color(0xdcdfe3);
  const rough = glass ? 0.25 : basic ? 0.5 : Math.min(1, Math.max(0.15, src.roughness ?? 0.5)), metal = basic || glass ? 0 : Math.min(1, src.metalness ?? 0);
  const glow = basic && !glass;   // the light strip / status lamp keep their light
  const key = `${c.getHexString()}|${rough.toFixed(2)}|${metal.toFixed(2)}|${glow}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, emissive: glow ? c.clone().multiplyScalar(0.7) : 0x000000 }));
  return cache.get(key);
}
// world-space copy with only position + normal, always indexed, winding kept right for mirrored parts
const flat = a => { const out = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); } return out; };
function baked(geo, mat) {
  const g = new THREE.BufferGeometry(), n = geo.attributes.position.count;
  g.setAttribute('position', new THREE.BufferAttribute(flat(geo.attributes.position), 3));
  const idx = geo.index ? Array.from(geo.index.array) : Array.from({ length: n }, (_, i) => i);
  if (mat.determinant() < 0) for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  g.setIndex(idx);
  if (geo.attributes.normal) g.setAttribute('normal', new THREE.BufferAttribute(flat(geo.attributes.normal), 3)); else g.computeVertexNormals();
  g.applyMatrix4(mat); return g;
}
const keep = (o) => { const m = o.material; return m && !Array.isArray(m) && m.visible !== false && !(m.transparent && (m.opacity < 0.5 || m.depthWrite === false) && !m.map) && !(m.alphaTest > 0); };

/** the real-size body for a modelScene {type, w, h, d}: centred on its reference box (the casing of a cassette, everything else
 *  for the others) and scaled so that box is w × h × d metres; one merged mesh per colour */
export function arUnit(sc) {
  const type = OUTSIDE[sc.type] ? sc.type : 'wall';
  const U = buildUnit(type, materialSet('studio'), type === 'floor' ? { interior: false } : { interior: false, rod: 0.02 });
  const lv = U.parts.louver && U.parts.louver.userData; if (lv) { if (lv.flap) lv.flap.rotation.set(0, 0, 0); if (lv.vanes) lv.vanes.rotation.set(0, 0, 0); }   // closed, as on a wall at rest
  U.root.updateMatrixWorld(true);
  const cache = new Map(), groups = { body: new Map(), face: new Map() }, ref = new THREE.Box3(), all = new THREE.Box3(), mi = new THREE.Matrix4(), mw = new THREE.Matrix4();
  for (const id of OUTSIDE[type]) {
    const part = U.parts[id]; if (!part) continue;
    const side = type === 'cassette' && FACE.includes(id) ? 'face' : type === 'cassette' ? 'body' : 'face';
    part.traverseVisible(o => {
      if (!o.isMesh || !keep(o)) return;
      const mat = plainOf(o.material, cache), list = groups[side].get(mat) || [];
      const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, i) => { o.getMatrixAt(i, mi); return mw.multiplyMatrices(o.matrixWorld, mi).clone(); }) : [o.matrixWorld];
      mats.forEach(m => { const g = baked(o.geometry, m); g.computeBoundingBox(); all.union(g.boundingBox); if (type !== 'cassette' || id === 'casing') ref.union(g.boundingBox); list.push(g); });
      groups[side].set(mat, list);
    });
  }
  // scale the reference box to the model's size, centred on it
  if (ref.isEmpty()) ref.copy(all);
  const c = ref.getCenter(new THREE.Vector3()), sz = ref.getSize(new THREE.Vector3());
  const k = new THREE.Vector3(sc.w / sz.x, sc.h / sz.y, sc.d / sz.z);
  const T = new THREE.Matrix4().makeScale(k.x, k.y, k.z).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  const root = new THREE.Group(); root.name = 'ar-unit';
  const out = {}, mats = [];
  for (const side of ['body', 'face']) {
    const g = new THREE.Group(); g.name = side; root.add(g); out[side] = g;
    groups[side].forEach((list, mat) => { const m0 = mergeGeometries(list), geo = mergeVertices(m0, 1e-5); m0.dispose(); list.forEach(x => x.dispose()); geo.applyMatrix4(T); g.add(new THREE.Mesh(geo, mat)); if (!mats.includes(mat)) mats.push(mat); });
  }
  U.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });   // the viewer body was only the source
  const box = all.clone().applyMatrix4(T);
  return { root, body: out.body, face: out.face, box, size: { w: sc.w, h: sc.h, d: sc.d }, boardY: type === 'cassette' ? (0 - c.y) * k.y : null, mats, type };
}
export function disposeUnit(U) { U.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); U.mats.forEach(m => m.dispose()); }

/** USDZ (zip bytes) for AR Quick Look: real scale (metres), plane anchoring — vertical (back of the unit on the wall, origin at the
 *  centre of its back) or horizontal (origin at the centre of its base) */
export async function usdz(sc) {
  const U = arUnit(sc), align = QL_ALIGN[U.type] || 'horizontal';
  const scene = new THREE.Group(); scene.add(U.root);
  const cx = (U.box.min.x + U.box.max.x) / 2, cy = (U.box.min.y + U.box.max.y) / 2, cz = (U.box.min.z + U.box.max.z) / 2;
  if (align === 'vertical') U.root.position.set(-cx, -cy, -U.box.min.z); else U.root.position.set(-cx, -U.box.min.y, -cz);
  scene.updateMatrixWorld(true);
  try { return await new USDZExporter().parseAsync(scene, { ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: align } }, quickLookCompatible: true }); }
  finally { disposeUnit(U); }
}

/** surface kind from the hit pose's normal (its Y axis): floor / ceiling / wall, or null for a slope */
export const surfaceOf = ny => (ny > 0.75 ? 'floor' : ny < -0.75 ? 'ceiling' : Math.abs(ny) < 0.35 ? 'wall' : null);
/** where the body goes for a hit: on a wall its back lies flat on the wall facing out; on the floor its base stands on it and on a
 *  ceiling its top (a cassette: its ceiling board) touches it, turned to face the camera plus `turn` */
export function placement(U, surf, hit, normal, cam, turn = 0) {
  const b = U.box, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
  let yaw, local;
  if (surf === 'wall') {
    const n = new THREE.Vector3(normal.x, 0, normal.z); if (n.lengthSq() < 1e-6) n.set(0, 0, 1); n.normalize();
    if (n.x * (cam.x - hit.x) + n.z * (cam.z - hit.z) < 0) n.negate();   // the wall's face toward the visitor
    yaw = Math.atan2(n.x, n.z); local = new THREE.Vector3(cx, cy, b.min.z);
  } else {
    yaw = Math.atan2(cam.x - hit.x, cam.z - hit.z) + turn;
    local = new THREE.Vector3(cx, surf === 'floor' ? b.min.y : U.boardY != null ? U.boardY : b.max.y, cz);
  }
  const quat = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const pos = new THREE.Vector3(hit.x, hit.y, hit.z).sub(local.applyQuaternion(quat));
  return { pos, quat, yaw, faceOnly: surf === 'ceiling' && U.boardY != null, bottom: pos.y + b.min.y };
}

// soft contact shadow (the camera picture has none): a radial fade, drawn once
function shadowTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** WebXR immersive-ar with hit-test (Android Chrome). The visitor aims the centre of the screen at a surface: a ring sits on it and
 *  a see-through body follows; วาง fixes it, ย้าย picks it up again, หมุน turns a floor / ceiling placement, ปิด ends the session.
 *  ui.update(state) gets {mode, surf, ok, turn, bottom, ceil} whenever it changes; ui.ended() runs once everything is released. */
export async function startXR(session, sc, ui) {
  const cv = document.createElement('canvas');
  const gl = cv.getContext('webgl2', { alpha: true, antialias: true, xrCompatible: true }) || cv.getContext('webgl', { alpha: true, antialias: true, xrCompatible: true });
  if (!gl) throw new Error('no WebGL');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, context: gl, alpha: true, antialias: true });
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(70, 1, 0.01, 40);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d9299, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(0.6, 2.2, 1.4); scene.add(sun);
  const U = arUnit(sc), holder = new THREE.Group(); holder.add(U.root); holder.visible = false; scene.add(holder);
  U.mats.forEach(m => { m.transparent = true; });
  const sm = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 1 });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sm); U.root.add(sh);
  // reticle: a white ring with a dark edge (reads on white walls and on dark floors) + a centre dot
  const ret = new THREE.Group(); ret.matrixAutoUpdate = false; ret.visible = false; scene.add(ret);
  const rm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }), re = new THREE.MeshBasicMaterial({ color: 0x0b1118, transparent: true, opacity: 0.45, depthTest: false });
  ret.add(new THREE.Mesh(new THREE.RingGeometry(0.075, 0.088, 48).rotateX(-Math.PI / 2), re), new THREE.Mesh(new THREE.RingGeometry(0.058, 0.075, 48).rotateX(-Math.PI / 2), rm), new THREE.Mesh(new THREE.CircleGeometry(0.008, 16).rotateX(-Math.PI / 2), rm));
  ret.children.forEach(m => { m.renderOrder = 10; });
  const st = { mode: 'aim', surf: null, ok: false, turn: 0, floorY: null, hit: null, n: null, at: null, sent: '' };   // at: where it was placed
  const want = MOUNTS[U.type] || ['wall'];
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), N = new THREE.Vector3();
  let src = null, ended = false;
  function shadowFor(surf) {   // on the wall behind the body, or under it on the floor; none at a ceiling
    const b = U.box, w = b.max.x - b.min.x, hh = b.max.y - b.min.y, d = b.max.z - b.min.z;
    sh.visible = surf === 'wall' || surf === 'floor'; sh.rotation.set(surf === 'floor' ? -Math.PI / 2 : 0, 0, 0);
    if (surf === 'wall') { sh.scale.set(w * 1.3, hh * 1.6, 1); sh.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, b.min.z + 0.003); }
    else if (surf === 'floor') { sh.scale.set(w * 1.5, d * 1.8, 1); sh.position.set((b.min.x + b.max.x) / 2, b.min.y + 0.003, (b.min.z + b.max.z) / 2); }
  }
  // move the body onto a hit (aiming) or turn it where it stands (placed); the camera is the viewer's pose this frame
  function pose(surf, hit, n) {
    const p = placement(U, surf, hit, n, renderer.xr.getCamera().position, st.turn);
    holder.position.copy(p.pos); holder.quaternion.copy(p.quat); U.body.visible = !p.faceOnly; shadowFor(surf); return p;
  }
  function look(ghost) { U.mats.forEach(m => { m.opacity = ghost ? 0.62 : 1; m.depthWrite = true; }); sm.opacity = ghost ? 0.5 : 1; }
  // heights from the lowest floor the camera has seen (ค่าประมาณ): the bottom edge of a hung body, or the ceiling a cassette is set in
  function emit(p) {
    const placed = st.mode === 'placed', surf = placed ? st.at.surf : st.surf, hitY = placed ? st.at.hit.y : st.hit && st.hit.y;
    const s = { mode: st.mode, surf, ok: placed || st.ok, turn: !!surf && surf !== 'wall' && (placed || st.ok), bottom: null, ceil: null };
    if (st.floorY != null && p) { if (p.faceOnly) s.ceil = Math.round((hitY - st.floorY) * 20) / 20; else if (surf !== 'floor') s.bottom = Math.round((p.bottom - st.floorY) * 20) / 20; }
    if (s.bottom != null && (s.bottom < 0.2 || s.bottom > 4.5)) s.bottom = null;   // a floor seen elsewhere (another level, a table): say nothing
    if (s.ceil != null && (s.ceil < 1.8 || s.ceil > 6)) s.ceil = null;
    const key = JSON.stringify(s); if (key !== st.sent) { st.sent = key; try { ui.update(s); } catch (_) {} }
  }
  function tick(frame) {
    if (!src || st.mode !== 'aim') return;
    const ref = renderer.xr.getReferenceSpace(), hits = frame.getHitTestResults(src), hp = hits.length ? hits[0].getPose(ref) : null;
    if (hp) {
      M.fromArray(hp.transform.matrix); P.setFromMatrixPosition(M); N.set(M.elements[4], M.elements[5], M.elements[6]).normalize();
      st.surf = surfaceOf(N.y); st.hit = P.clone(); st.n = N.clone();
      if (st.surf === 'floor') st.floorY = st.floorY == null ? P.y : Math.min(st.floorY, P.y);
      st.ok = want.includes(st.surf);
      ret.matrix.copy(M); ret.visible = true; rm.color.setHex(st.ok ? 0xffffff : 0xffb35c);
    } else { st.surf = null; st.ok = false; ret.visible = false; }
    let p = null;
    if (st.ok) { p = pose(st.surf, st.hit, st.n); holder.visible = true; } else holder.visible = false;
    emit(p);
  }
  const api = {
    place() {
      if (st.mode !== 'aim' || !st.ok) return false;
      st.mode = 'placed'; st.at = { surf: st.surf, hit: st.hit.clone(), n: st.n.clone() }; ret.visible = false; look(false);
      emit(pose(st.at.surf, st.at.hit, st.at.n)); try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
      return true;
    },
    move() { if (st.mode !== 'placed') return; st.mode = 'aim'; look(true); emit(null); },
    rotate() {
      const placed = st.mode === 'placed', surf = placed ? st.at.surf : st.ok ? st.surf : null; if (!surf || surf === 'wall') return false;
      st.turn = (st.turn + TURN) % (Math.PI * 2);
      if (placed) pose(surf, st.at.hit, st.at.n);
      return true;
    },
    end() { if (!ended) session.end().catch(() => {}); },
  };
  function release(notify = true) {
    if (ended) return; ended = true;
    renderer.setAnimationLoop(null);
    try { src && src.cancel && src.cancel(); } catch (_) {}
    disposeUnit(U); sm.map.dispose(); sm.dispose(); sh.geometry.dispose(); rm.dispose(); re.dispose(); ret.children.forEach(m => m.geometry.dispose());
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (_) {}
    if (notify) try { ui.ended(); } catch (_) {}
  }
  session.addEventListener('end', () => release(), { once: true });
  // a tap on the camera view places the body; with Thai buttons over the camera (dom-overlay) a tap on them does not
  const overlay = !!session.domOverlayState;
  session.addEventListener('select', () => { if (st.mode === 'aim') api.place(); else if (!overlay) api.move(); });
  try {
    await renderer.xr.setSession(session);
    const viewer = await session.requestReferenceSpace('viewer');
    src = await session.requestHitTestSource({ space: viewer });
  } catch (e) { release(false); try { await session.end(); } catch (_) {} throw e; }   // the caller says what went wrong
  look(true); emit(null);
  renderer.setAnimationLoop((t, frame) => { if (frame) tick(frame); renderer.render(scene, cam); });
  return api;
}
