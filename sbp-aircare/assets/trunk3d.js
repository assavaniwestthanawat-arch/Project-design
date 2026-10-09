// SBP AirCare — tidy refrigerant-pipe routing: white PVC trunking (Airpro-style, 75 mm) with real fittings, plus neat
// pipe bends. Used by the "how it works" scenes so the pipe run from the indoor unit to the condensing unit reads like a
// premium installation: straight runs, flat elbows (ข้องอแบน) in the wall plane, corner elbows (ข้องอฉาก) where the run
// turns off a surface, 45° elbows (ข้อปรับองศา) for offsets, wall caps (ฝาครอบผนัง) at wall penetrations and an end cap.
// Geometry is generic (not a copy of any manufacturer's fitting design); brand names are shown only as plain text elsewhere.
import * as THREE from './three.module.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Polyline → CurvePath with short radius bends at the corners (like a bent copper pipe, not a spline wobble)
export function bentPath(pts, r = 0.035) {
  const P = pts.map(p => (p.isVector3 ? p.clone() : V(...p)));
  const path = new THREE.CurvePath();
  let cur = P[0].clone();
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    if (!c) { path.add(new THREE.LineCurve3(cur, b.clone())); break; }
    const d1 = b.clone().sub(a), d2 = c.clone().sub(b);
    const rr = Math.min(r, d1.length() * 0.45, d2.length() * 0.45);
    const p1 = b.clone().sub(d1.normalize().multiplyScalar(rr)), p2 = b.clone().add(d2.normalize().multiplyScalar(rr));
    if (cur.distanceTo(p1) > 1e-5) path.add(new THREE.LineCurve3(cur, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
    cur = p2;
  }
  return path;
}
export const pathPoints = (path, n = 120) => path.getSpacedPoints(n).map(p => [p.x, p.y, p.z]);
export function pipeMesh(path, r, mat, seg = 160) { return new THREE.Mesh(new THREE.TubeGeometry(path, seg, r, 12, false), mat); }

// A trunking run along a CENTRE-LINE polyline. `lids[i]` = unit vector pointing to the lid side of segment i (away from the
// wall/ceiling it is fixed to). W = face width, D = depth. caps: [{ at:[x,y,z], n:[..] }] wall caps (plate normal = run
// direction through the wall). Returns { group, mats, anchors: { trunk, elbow, e45, cap, end } }.
export function buildTrunk(center, lids, opts = {}) {
  const W = opts.W ?? 0.075, D = opts.D ?? 0.055, g = new THREE.Group(); g.name = 'trunk';
  const bp = !!opts.blueprint;
  const body = opts.mat || (bp ? new THREE.MeshLambertMaterial({ color: 0xf7f9fc }) : new THREE.MeshStandardMaterial({ color: 0xf6f7f4, roughness: 0.32, metalness: 0 }));
  const fit = opts.fitMat || (bp ? new THREE.MeshLambertMaterial({ color: 0xeef3f9 }) : new THREE.MeshStandardMaterial({ color: 0xfbfbf9, roughness: 0.25 }));
  const seam = bp ? new THREE.MeshLambertMaterial({ color: 0xc7d4e6 }) : new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.5 });
  const P = center.map(p => V(...p)), anchors = { elbow: null, e45: null, cap: null, end: null, trunk: null };
  const frame = (d, n) => { const x = d.clone().normalize(), z = n.clone().normalize(), y = z.clone().cross(x).normalize(); z.copy(x.clone().cross(y)).normalize(); return new THREE.Matrix4().makeBasis(x, y, z); };
  const boxAlong = (a, b, n, w, dd, mat, extra = 0) => {
    const d = b.clone().sub(a), L = d.length() + extra; if (L < 1e-4) return null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, w, dd), mat);
    m.applyMatrix4(frame(d, n)); m.position.copy(a).add(b).multiplyScalar(0.5); g.add(m); return m;
  };
  const FL = 0.055;                              // fitting sleeve length each side of a corner
  let longest = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], n = V(...lids[i]), d = b.clone().sub(a).normalize();
    // run between the fittings
    const a2 = i > 0 ? a.clone().add(d.clone().multiplyScalar(FL)) : a, b2 = i < P.length - 2 ? b.clone().sub(d.clone().multiplyScalar(FL)) : b;
    boxAlong(a2, b2, n, W, D, body);
    // lid seam line on the face (reads as base + snap-on lid)
    const off = n.clone().multiplyScalar(D / 2 + 0.0004), side = n.clone().cross(d).normalize().multiplyScalar(W / 2 - 0.006);
    boxAlong(a2.clone().add(off).add(side), b2.clone().add(off).add(side), n, 0.0016, 0.0008, seam);
    boxAlong(a2.clone().add(off).sub(side), b2.clone().add(off).sub(side), n, 0.0016, 0.0008, seam);
    const L = a2.distanceTo(b2); if (L > longest) { longest = L; anchors.trunk = a2.clone().add(b2).multiplyScalar(0.5).add(n.clone().multiplyScalar(D / 2)).toArray(); }
  }
  // fittings at the interior corners: two oversize sleeves meeting at the corner + a corner block
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize(), n1 = V(...lids[i - 1]), n2 = V(...lids[i]);
    const ang = Math.acos(Math.max(-1, Math.min(1, d1.dot(d2))));   // 0 = straight, π/2 = 90°, π/4 = 45°
    const w = W + 0.008, dd = D + 0.006;
    boxAlong(b.clone().sub(d1.clone().multiplyScalar(FL)), b.clone().add(d1.clone().multiplyScalar(ang > 1.2 ? w / 2 : 0.012)), n1, w, dd, fit);
    boxAlong(b.clone().sub(d2.clone().multiplyScalar(ang > 1.2 ? w / 2 : 0.012)), b.clone().add(d2.clone().multiplyScalar(FL)), n2, w, dd, fit);
    const onFace = b.clone().add(n1.clone().multiplyScalar(dd / 2));
    if (ang > 1.2 && !anchors.elbow) anchors.elbow = onFace.toArray();
    if (ang > 0.5 && ang < 1.2 && !anchors.e45) anchors.e45 = onFace.toArray();
  }
  // wall caps
  (opts.caps || []).forEach(c => {
    const at = V(...c.at), n = V(...c.n).normalize();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, W + 0.05, 0.01), fit);
    plate.quaternion.setFromUnitVectors(V(0, 0, 1), n); plate.position.copy(at); g.add(plate);
    if (!anchors.cap) anchors.cap = at.clone().add(n.clone().multiplyScalar(0.006)).toArray();
  });
  // end cap (open towards the pipes' exit)
  if (opts.endCap !== false) {
    const a = P[P.length - 2], b = P[P.length - 1], d = b.clone().sub(a).normalize(), n = V(...lids[lids.length - 1]);
    boxAlong(b.clone().sub(d.clone().multiplyScalar(0.03)), b.clone().add(d.clone().multiplyScalar(0.006)), n, W + 0.008, D + 0.006, fit);
    anchors.end = b.clone().add(n.clone().multiplyScalar(D / 2)).toArray();
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, mats: [body, fit, seam], anchors };
}

// Pipe hanger (threaded rod + clamp) for runs above a ceiling
export function pipeHanger(at, up, len, mat) {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 8), mat); rod.position.set(at[0], at[1] + len / 2, at[2]); g.add(rod);
  const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 20, Math.PI), mat); clamp.position.set(at[0], at[1], at[2]); clamp.rotation.z = Math.PI; clamp.rotation.y = up; g.add(clamp);
  return g;
}
