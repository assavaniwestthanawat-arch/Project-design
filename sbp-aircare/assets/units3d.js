// SBP AirCare — detailed procedural indoor units for the three main types (Three.js r170).
// Wall-mounted (reuses ac3d buildIndoor), ceiling-suspended and 4-way cassette, built from the real layout of each type:
//   wall      : top/front intake → filter → A-shape evaporator → cross-flow fan → louver + vanes · gravity drain
//   ceiling   : bottom-rear suction grille → filter → sirocco fans in scroll housings (double-shaft motor)
//               → inclined evaporator → front discharge + auto-swing flap · gravity drain from the side
//   cassette  : centre grille → filter → bell-mouth → turbo fan (motor on top) → square evaporator around the fan
//               → down through the outer channels → 4 slots with flaps · drain pump + float switch lifts the water
// Every builder returns { root, parts, anim, paths, anchors, dims, shells } in metres, unit frame:
//   x = width, y = up, z = toward the room (front / discharge side). Cassette: y = 0 is the ceiling board.
// Geometry is an illustration of the principle — not a copy of any manufacturer's product design.
import * as THREE from './three.module.min.js';
import { buildIndoor, buildPremiumIndoor, finSegment, meshTex, canvasTex } from './ac3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function box(w, h, d, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
function cyl(r, len, mat, axis = 'x', x = 0, y = 0, z = 0, seg = 24, r2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 ?? r, len, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); return m;
}
// extrude a (z, y) side profile along x from x0 to x1
function sideExtrude(pts, x0, x1, mat, curve = 16) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: curve });
  g.rotateY(-Math.PI / 2); g.translate(x1, 0, 0);
  return new THREE.Mesh(g, mat);
}
// thin band that follows a (z, y) polyline, extruded along x
function bandAlong(pts, t, x0, x1, mat) {
  const outer = [], inner = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy) || 1, nz = -dy / L, ny = dz / L;
    outer.push([pts[i][0] + nz * t / 2, pts[i][1] + ny * t / 2]); inner.push([pts[i][0] - nz * t / 2, pts[i][1] - ny * t / 2]);
  }
  return sideExtrude([...outer, ...inner.reverse()], x0, x1, mat, 4);
}
const extra = (M) => {
  const bp = !!M.edge;
  const L = c => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  return {
    foam: bp ? L(0xeef3f9) : new THREE.MeshStandardMaterial({ color: 0xe3e6e8, roughness: 0.95 }),
    lining: bp ? L(0xd9e3ef) : new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.95 }),
    water: new THREE.MeshStandardMaterial({ color: 0x5fb6ea, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false }),
    rod: bp ? L(0xc7d4e6) : new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.8, roughness: 0.35 }),
    grille: bp ? L(0xf7f9fc) : new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, roughness: 0.35, clearcoat: 0.5 }),
    hose: bp ? L(0xdfe8f4) : new THREE.MeshStandardMaterial({ color: 0xdfe3e7, roughness: 0.6, transparent: true, opacity: 0.85 }),
  };
};
function filterMat(M) {
  const m = M.filter.clone(); if (!M.edge) { const t = meshTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); m.map = t; m.alphaMap = t; }
  return m;
}
function grp(root, parts, id) { const g = new THREE.Group(); g.name = id; parts[id] = g; root.add(g); return g; }
function markShell(g, shells) { g.traverse(o => { if (o.isMesh) { o.userData.shell = true; shells.push(o); } }); }

/* =================================================================== */
/* WALL — reuse the existing detailed wall unit, add its motion/paths   */
/* =================================================================== */
export function buildWallUnit(M, opt = {}) {
  // Rev.09: rounded premium body (no wordmark) by default — the boxy shell stays for the blueprint style or premium: false
  const U = opt.premium && opt.buildPremium ? opt.buildPremium(M) : (M.edge || opt.premium === false) ? buildIndoor(M) : buildPremiumIndoor(M, { logo: !!opt.logo });
  const { root, parts } = U; const shells = [];
  markShell(parts.front, shells); markShell(parts.chassis, shells);
  // drain hose + refrigerant pipe stubs leaving the back-left (routed down behind the unit)
  const X = extra(M);
  const pg = grp(root, parts, 'pipes');
  pg.add(cyl(0.012, 0.05, M.insul, 'z', -0.36, -0.13, -0.14), cyl(0.009, 0.05, M.insul, 'z', -0.33, -0.13, -0.14));
  const dh = grp(root, parts, 'drain'); dh.add(cyl(0.008, 0.07, X.hose, 'x', 0.47, -0.1, 0.07)); dh.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.5, -0.1, 0.07), V(0.53, -0.14, 0.02), V(0.5, -0.2, -0.12), V(0.46, -0.6, -0.14)]), 20, 0.008, 8), X.hose));
  const anim = {
    spin: [{ obj: parts.blower.userData.spin, axis: 'x', rate: -9 }],
    flaps: [{ obj: parts.louver.userData.flap, axis: 'x', base: 0.5, amp: 0.26, speed: 0.9 }],
    vanes: [{ obj: parts.louver.userData.vanes, axis: 'y', base: 0, amp: 0.25, speed: 0.6 }],
  };
  // (y, z) air path through the unit; x spread across the fan length
  const paths = {
    air: { yz: [[0.42, 0.02], [0.24, 0.02], [0.155, 0.04], [0.09, 0.062], [0.02, 0.05], [-0.035, 0.012], [-0.09, 0.03], [-0.13, 0.08], [-0.2, 0.2], [-0.34, 0.42], [-0.55, 0.75], [-0.8, 1.2]], x: [-0.36, 0.28], coil: 3, out: 7 },
    drain: [[-0.02, -0.092, 0.07], [0.2, -0.093, 0.07], [0.44, -0.097, 0.07], [0.5, -0.1, 0.07], [0.53, -0.14, 0.02], [0.5, -0.2, -0.12], [0.46, -0.6, -0.14]],
    drips: { x: [-0.38, 0.3], y: [-0.07, -0.09], z: 0.058 },
    liquid: [[-0.33, -0.55, -0.14], [-0.33, -0.2, -0.14], [-0.33, -0.12, -0.12], [-0.41, -0.05, 0.0], [-0.41, 0.08, 0.04]],
    gas: [[-0.41, 0.1, 0.0], [-0.42, 0.02, -0.06], [-0.36, -0.12, -0.12], [-0.36, -0.2, -0.14], [-0.36, -0.55, -0.14]],
  };
  const anchors = {
    intake: [0.0, 0.15, 0.02], filter: [-0.22, 0.13, 0.055], coil: [-0.05, 0.06, 0.08], fan: [-0.18, -0.035, 0.03], motor: [0.29, -0.035, 0.01],
    pan: [0.12, -0.09, 0.08], louver: [0.05, -0.132, 0.1], vanes: [-0.2, -0.12, 0.05], pcb: [0.39, 0.03, -0.01], pipes: [-0.35, -0.13, -0.14], drain: [-0.48, -0.1, 0.07],
  };
  return { root, parts: { ...parts, fan: parts.blower }, anim, paths, anchors, dims: { w: 0.9, h: 0.3, d: 0.25 }, shells, type: 'wall', finishMats: U.finishMats };
}

/* =================================================================== */
/* CEILING-SUSPENDED                                                    */
/* =================================================================== */
export function buildCeilingUnit(M, opt = {}) {
  const interior = opt.interior !== false, X = extra(M);
  const W = 1.27, H = 0.235, D = 0.69, hw = W / 2, hy = H / 2, hd = D / 2;
  const root = new THREE.Group(); root.name = 'ceiling'; const parts = {}, shells = [];
  const shellM = M.shell;
  // --- casing ---
  const cs = grp(root, parts, 'casing');
  const prof = [[-hd, hy], [hd - 0.085, hy], [hd, hy - 0.085, hd, hy], [hd, -0.018], [hd - 0.012, -0.086], [hd - 0.075, -hy, hd - 0.02, -hy], [-hd + 0.03, -hy], [-hd, -hy + 0.03, -hd, -hy]];
  const capL = sideExtrude(prof, -hw, -hw + 0.022, shellM, 20), capR = sideExtrude(prof, hw - 0.022, hw, shellM, 20);
  cs.add(capL, capR);
  cs.add(box(W - 0.04, 0.006, D - 0.085, shellM, 0, hy - 0.0038, -0.042));   // sits 0.8 mm under the front band → no z-fighting at the join                       // top
  cs.add(bandAlong([[hd - 0.085, hy - 0.003], [hd - 0.03, hy - 0.012], [hd - 0.003, hy - 0.05], [hd - 0.003, -0.018]], 0.006, -hw + 0.02, hw - 0.02, shellM)); // front upper face
  cs.add(bandAlong([[hd - 0.014, -0.086], [hd - 0.04, -hy + 0.008], [hd - 0.08, -hy + 0.003], [0.13, -hy + 0.003]], 0.006, -hw + 0.02, hw - 0.02, shellM)); // bottom front lip
  cs.add(box(W - 0.04, H - 0.01, 0.006, shellM, 0, 0, -hd + 0.003));                             // rear
  if (!M.edge) { const acc = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.003, 0.0015), new THREE.MeshBasicMaterial({ color: 0x9fb2c4 })); acc.position.set(0, 0.035, hd + 0.0008); cs.add(acc); }
  markShell(cs, shells);
  // --- suction grille (bottom rear) ---
  const gr = grp(root, parts, 'grille');
  const gz0 = -hd + 0.03, gz1 = 0.125, gw = W - 0.09;
  gr.add(box(gw, 0.008, 0.012, X.grille, 0, -hy + 0.004, gz0), box(gw, 0.008, 0.012, X.grille, 0, -hy + 0.004, gz1));
  gr.add(box(0.012, 0.008, gz1 - gz0, X.grille, -gw / 2, -hy + 0.004, (gz0 + gz1) / 2), box(0.012, 0.008, gz1 - gz0, X.grille, gw / 2, -hy + 0.004, (gz0 + gz1) / 2));
  { const n = Math.floor((gz1 - gz0 - 0.02) / 0.013), im = new THREE.InstancedMesh(new THREE.BoxGeometry(gw - 0.02, 0.012, 0.004), X.grille, n), mt = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { mt.makeTranslation(0, -hy + 0.006, gz0 + 0.012 + i * 0.013); im.setMatrixAt(i, mt); } gr.add(im); }
  // --- discharge: auto-swing flap + vertical vanes ---
  const lo = grp(root, parts, 'louver');
  const piv = new THREE.Group(); piv.position.set(0, -0.052, hd - 0.012); lo.add(piv);
  const wing = new THREE.Shape(); wing.moveTo(-0.004, 0); wing.quadraticCurveTo(0.03, 0.01, 0.07, 0.003); wing.quadraticCurveTo(0.03, -0.003, -0.004, 0);
  const wg = new THREE.ExtrudeGeometry(wing, { depth: W - 0.08, bevelEnabled: false, curveSegments: 10 }); wg.rotateY(-Math.PI / 2); wg.translate((W - 0.08) / 2, 0, 0);
  piv.add(new THREE.Mesh(wg, shellM)); piv.rotation.x = 0.55;   // rest angle = animation base (reduced-motion / static views)
  const vanes = new THREE.Group(); vanes.name = 'vanes'; parts.vanes = vanes; lo.add(vanes);
  for (let i = 0; i < 18; i++) { const v = new THREE.Group(); v.position.set(-hw + 0.08 + i * ((W - 0.16) / 17), -0.052, hd - 0.06); v.add(box(0.002, 0.058, 0.045, M.chassis)); vanes.add(v); }
  // --- hangers + rods ---
  const hg = grp(root, parts, 'hangers'); const rod = opt.rod ?? 0.3;
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const x = sx * (hw + 0.012), z = sz * 0.22;
    hg.add(box(0.006, 0.06, 0.06, M.metal, x, hy - 0.035, z), box(0.04, 0.006, 0.06, M.metal, x + sx * 0.02, hy - 0.004, z));
    if (rod > 0) hg.add(cyl(0.005, rod, X.rod, 'y', x + sx * 0.03, hy + rod / 2, z, 8));
  });
  const anim = { spin: [], flaps: [{ obj: piv, axis: 'x', base: 0.55, amp: 0.35, speed: 0.55 }], vanes: [], float: null };
  const anchors = { intake: [0.0, -hy, -0.1], louver: [0.1, -0.06, hd + 0.01], vanes: [-0.3, -0.05, hd - 0.06], hangers: [hw + 0.03, hy + 0.08, 0.22] };
  if (interior) {
    // filter
    const fi = grp(root, parts, 'filter');
    const fp = new THREE.Mesh(new THREE.BoxGeometry(gw - 0.03, 0.002, gz1 - gz0 - 0.02), filterMat(M)); fp.position.set(0, -hy + 0.018, (gz0 + gz1) / 2); fi.add(fp);
    fi.add(box(gw - 0.03, 0.006, 0.006, M.chassis, 0, -hy + 0.018, gz0 + 0.01), box(gw - 0.03, 0.006, 0.006, M.chassis, 0, -hy + 0.018, gz1 - 0.01));
    // fans: 4 sirocco wheels on one shaft, double-shaft motor in the middle, each wheel in a scroll housing
    const zc = -0.09, yc = -0.012, R = 0.064;
    const fan = grp(root, parts, 'fan'); const spin = new THREE.Group(); spin.position.set(0, yc, zc); fan.add(spin);
    const wheels = [-0.44, -0.2, 0.15, 0.39], wl = 0.17;
    const bladeGeo = new THREE.BoxGeometry(wl, 0.0014, 0.014);
    wheels.forEach(cx => {
      const n = 40, im = new THREE.InstancedMesh(bladeGeo, M.blade, n), mt = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a - 0.55); mt.compose(V(cx, Math.sin(a) * (R - 0.007), Math.cos(a) * (R - 0.007)), q, V(1, 1, 1)); im.setMatrixAt(i, mt); }
      spin.add(im);
      spin.add(cyl(R, 0.004, M.blade, 'x', cx + wl / 2, 0, 0, 32));               // drive-side disc
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.003, 0.003, 6, 40), M.blade); ring.rotation.y = Math.PI / 2; ring.position.x = cx - wl / 2; spin.add(ring);
      spin.add(cyl(0.016, 0.02, M.metal, 'x', cx + wl / 2 - 0.01, 0, 0, 16));
    });
    spin.add(cyl(0.006, 1.02, M.metal, 'x', -0.03, 0, 0, 10));
    anim.spin.push({ obj: spin, axis: 'x', rate: -11 });
    const mo = grp(root, parts, 'motor');
    mo.add(cyl(0.052, 0.13, M.dark, 'x', -0.025, yc, zc, 28), cyl(0.056, 0.012, M.metal, 'x', -0.095, yc, zc, 28), cyl(0.056, 0.012, M.metal, 'x', 0.045, yc, zc, 28));
    mo.add(box(0.1, 0.01, 0.12, M.metal, -0.025, yc - 0.06, zc));
    // scroll housings: spiral from the tongue (front-upper) clockwise to the top, then a straight outlet toward the coil
    const sc = grp(root, parts, 'scroll');
    const spiral = []; const a0 = 55 * Math.PI / 180, sweep = 305 * Math.PI / 180, r0 = 0.074, r1 = 0.098;
    for (let i = 0; i <= 40; i++) { const t = i / 40, a = a0 - t * sweep, r = r0 + (r1 - r0) * t; spiral.push([zc + r * Math.cos(a), yc + r * Math.sin(a)]); }
    const top = spiral[spiral.length - 1];
    spiral.push([0.02, top[1]]);
    const scM = M.edge ? M.chassis : new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.7, side: THREE.DoubleSide });
    wheels.forEach(cx => sc.add(bandAlong(spiral, 0.004, cx - wl / 2 - 0.006, cx + wl / 2 + 0.006, scM)));
    const tongue = [zc + r0 * Math.cos(a0), yc + r0 * Math.sin(a0)];
    wheels.forEach(cx => sc.add(bandAlong([tongue, [0.02, tongue[1] + 0.004]], 0.004, cx - wl / 2 - 0.006, cx + wl / 2 + 0.006, scM)));
    // inclined evaporator (3 rows) between the fan outlets and the front discharge
    const co = grp(root, parts, 'coil');
    const cp0 = [0.092, 0.035], cp1 = [-0.078, 0.2], cdep = 0.042, cx0 = -hw + 0.06, cx1 = hw - 0.19;
    co.add(finSegment(M.fin, cp0, cp1, cdep, cx0, cx1, 0.0062));
    { const dy = cp1[0] - cp0[0], dz = cp1[1] - cp0[1], L = Math.hypot(dy, dz), ny = -dz / L, nz = dy / L;
      for (let k = 0; k < 7; k++) [-1, 0, 1].forEach(r => { const f = 0.08 + k * 0.14; co.add(cyl(0.0042, cx1 - cx0 + 0.02, M.copper, 'x', (cx0 + cx1) / 2, cp0[0] + dy * f + ny * r * cdep * 0.3, cp0[1] + dz * f + nz * r * cdep * 0.3, 10)); });
      [cx0 - 0.008, cx1 + 0.008].forEach(x => { const sp = box(0.003, L * 0.98, cdep + 0.01, M.metal, x, (cp0[0] + cp1[0]) / 2, (cp0[1] + cp1[1]) / 2); sp.rotation.x = Math.atan2(dz, dy); co.add(sp); });
      for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0036, 8, 12, Math.PI), M.copper); t.rotation.y = Math.PI / 2; t.position.set(cx1 + 0.018, cp0[0] + dy * (0.08 + k * 0.14), cp0[1] + dz * (0.08 + k * 0.14)); co.add(t); } }
    // drain pan under the lower edge of the coil (insulated), outlet at the right end
    const pa = grp(root, parts, 'pan');
    pa.add(box(cx1 - cx0 + 0.04, 0.004, 0.2, M.pan, (cx0 + cx1) / 2 + 0.01, -0.094, 0.19), box(cx1 - cx0 + 0.04, 0.018, 0.004, M.pan, (cx0 + cx1) / 2 + 0.01, -0.086, 0.29), box(cx1 - cx0 + 0.04, 0.03, 0.004, M.pan, (cx0 + cx1) / 2 + 0.01, -0.08, 0.09));
    pa.add(box(cx1 - cx0 + 0.04, 0.012, 0.2, X.lining, (cx0 + cx1) / 2 + 0.01, -0.103, 0.19));
    const wat = box(cx1 - cx0, 0.002, 0.17, X.water, (cx0 + cx1) / 2, -0.091, 0.19); wat.name = 'water'; pa.add(wat);
    pa.add(cyl(0.011, 0.07, M.pan, 'x', hw - 0.05, -0.098, 0.2, 14));
    const dr = grp(root, parts, 'drain'); dr.add(cyl(0.01, 0.12, X.hose, 'x', hw + 0.02, -0.098, 0.2, 12));
    // electrical box + control PCB at the right end
    const pc = grp(root, parts, 'pcb');
    pc.add(box(0.1, 0.15, 0.3, M.dark, hw - 0.09, 0.005, -0.13), box(0.004, 0.12, 0.25, M.pcb, hw - 0.137, 0.005, -0.13));
    [[0.03, -0.18], [-0.02, -0.1], [0.04, -0.06]].forEach(([y, z]) => pc.add(box(0.008, 0.02, 0.028, M.metal, hw - 0.142, y, z)));
    // refrigerant connections (liquid + gas, insulated) leaving the back at the right
    const pp = grp(root, parts, 'pipes');
    pp.add(cyl(0.013, 0.12, M.insul, 'z', hw - 0.17, 0.05, -hd - 0.05, 14), cyl(0.009, 0.12, M.insul, 'z', hw - 0.23, 0.05, -hd - 0.05, 14));
    pp.add(cyl(0.006, 0.4, M.copper, 'x', hw - 0.37, 0.07, -0.05, 8), cyl(0.0045, 0.4, M.copper, 'x', hw - 0.4, 0.05, 0.02, 8));
    Object.assign(anchors, { filter: [-0.35, -hy + 0.02, -0.12], fan: [-0.2, yc + 0.02, zc + 0.05], motor: [-0.025, yc + 0.055, zc], scroll: [0.15, yc + 0.1, zc - 0.03], coil: [0.05, 0.02, 0.12], pan: [0.2, -0.094, 0.2], drain: [hw + 0.08, -0.098, 0.2], pcb: [hw - 0.09, 0.08, -0.13], pipes: [hw - 0.2, 0.05, -hd - 0.1] });
  }
  const paths = {
    // room air rises into the rear suction grille, is drawn into the wheels, blown up-forward through the coil, out of the front slot
    air: { yz: [[-0.62, -0.42], [-0.34, -0.26], [-0.16, -0.15], [-0.1, -0.12], [-0.06, -0.1], [-0.02, -0.095], [0.05, -0.12], [0.075, -0.07], [0.068, -0.02], [0.06, 0.04], [0.02, 0.12], [-0.035, 0.21], [-0.055, 0.3], [-0.065, 0.4], [-0.09, 0.7], [-0.18, 1.4], [-0.35, 2.2]], x: [-0.54, 0.46], coil: 9, out: 13 },
    drain: [[0.0, -0.09, 0.19], [0.3, -0.093, 0.2], [hw - 0.05, -0.098, 0.2], [hw + 0.08, -0.098, 0.2], [hw + 0.12, -0.2, 0.2], [hw + 0.12, -0.5, 0.2]],
    drips: { x: [-hw + 0.08, hw - 0.2], y: [-0.07, -0.09], z: 0.19 },
    liquid: [[hw - 0.23, 0.05, -hd - 0.5], [hw - 0.23, 0.05, -hd], [hw - 0.23, 0.05, 0.0], [hw - 0.19, -0.05, 0.16]],
    gas: [[hw - 0.19, 0.09, 0.05], [hw - 0.17, 0.07, -0.1], [hw - 0.17, 0.05, -hd], [hw - 0.17, 0.05, -hd - 0.5]],
  };
  return { root, parts, anim, paths, anchors, dims: { w: W, h: H, d: D }, shells, type: 'ceiling' };
}

/* =================================================================== */
/* 4-WAY CASSETTE (body above the ceiling board, panel below)           */
/* =================================================================== */
export function buildCassetteUnit(M, opt = {}) {
  const interior = opt.interior !== false, X = extra(M);
  const B = 0.84, hb = B / 2, HB = 0.246, P = 0.95, hp = P / 2, PT = 0.04;
  const root = new THREE.Group(); root.name = 'cassette'; const parts = {}, shells = [];
  // --- decoration panel with centre intake + 4 outlet slots ---
  const pn = grp(root, parts, 'panel');
  const rr = (s, cx, cz, w, d, r) => { s.moveTo(cx - w / 2 + r, cz - d / 2); s.lineTo(cx + w / 2 - r, cz - d / 2); s.quadraticCurveTo(cx + w / 2, cz - d / 2, cx + w / 2, cz - d / 2 + r); s.lineTo(cx + w / 2, cz + d / 2 - r); s.quadraticCurveTo(cx + w / 2, cz + d / 2, cx + w / 2 - r, cz + d / 2); s.lineTo(cx - w / 2 + r, cz + d / 2); s.quadraticCurveTo(cx - w / 2, cz + d / 2, cx - w / 2, cz + d / 2 - r); s.lineTo(cx - w / 2, cz - d / 2 + r); s.quadraticCurveTo(cx - w / 2, cz - d / 2, cx - w / 2 + r, cz - d / 2); };
  const ps = new THREE.Shape(); rr(ps, 0, 0, P, P, 0.04);
  const hole = (cx, cz, w, d, r) => { const h = new THREE.Path(); rr(h, cx, cz, w, d, r); ps.holes.push(h); };
  hole(0, 0, 0.58, 0.58, 0.02); const SL = 0.6, SW = 0.072, SO = 0.37;
  hole(0, SO, SL, SW, 0.02); hole(0, -SO, SL, SW, 0.02); hole(SO, 0, SW, SL, 0.02); hole(-SO, 0, SW, SL, 0.02);
  const pg = new THREE.ExtrudeGeometry(ps, { depth: PT - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 3, curveSegments: 10 });
  pg.rotateX(Math.PI / 2); pg.translate(0, -0.004, 0);
  const panelM = X.grille; pn.add(new THREE.Mesh(pg, panelM));
  // --- centre intake grille (slit plate) ---
  const gr = grp(root, parts, 'grille');
  { const n = 38, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.56, 0.02, 0.004), panelM, n), mt = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { mt.makeTranslation(0, -PT + 0.014, -0.27 + i * (0.54 / (n - 1))); im.setMatrixAt(i, mt); } gr.add(im);
  }
  // --- 4 auto-swing flaps ---
  const lo = grp(root, parts, 'louver'); const flaps = [];
  [[0, SO, 0], [0, -SO, Math.PI], [SO, 0, Math.PI / 2], [-SO, 0, -Math.PI / 2]].forEach(([x, z, ry]) => {
    const holder = new THREE.Group(); holder.position.set(x, -PT + 0.006, z); holder.rotation.y = ry; lo.add(holder);
    const piv = new THREE.Group(); piv.position.z = -0.022; holder.add(piv);
    const wing = new THREE.Shape(); wing.moveTo(0, 0); wing.quadraticCurveTo(0.03, 0.008, 0.062, 0.002); wing.quadraticCurveTo(0.03, -0.002, 0, 0);
    const wgeo = new THREE.ExtrudeGeometry(wing, { depth: SL - 0.03, bevelEnabled: false, curveSegments: 8 }); wgeo.rotateY(-Math.PI / 2); wgeo.translate((SL - 0.03) / 2, 0, 0);
    piv.add(new THREE.Mesh(wgeo, panelM)); piv.rotation.x = 0.55; flaps.push(piv);
  });
  // --- casing (body above the ceiling board): chamfered square, insulated inside ---
  const cs = grp(root, parts, 'casing');
  const ch = 0.08, oct = new THREE.Shape();
  oct.moveTo(-hb + ch, -hb); oct.lineTo(hb - ch, -hb); oct.lineTo(hb, -hb + ch); oct.lineTo(hb, hb - ch); oct.lineTo(hb - ch, hb); oct.lineTo(-hb + ch, hb); oct.lineTo(-hb, hb - ch); oct.lineTo(-hb, -hb + ch); oct.closePath();
  const inner = new THREE.Path(); const hi = hb - 0.012, ci = ch - 0.005;
  inner.moveTo(-hi + ci, -hi); inner.lineTo(-hi, -hi + ci); inner.lineTo(-hi, hi - ci); inner.lineTo(-hi + ci, hi); inner.lineTo(hi - ci, hi); inner.lineTo(hi, hi - ci); inner.lineTo(hi, -hi + ci); inner.lineTo(hi - ci, -hi); inner.closePath(); oct.holes.push(inner);
  const wallG = new THREE.ExtrudeGeometry(oct, { depth: HB, bevelEnabled: false }); wallG.rotateX(-Math.PI / 2);
  const casM = M.edge ? M.chassis : new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.55, roughness: 0.4 });
  cs.add(new THREE.Mesh(wallG, casM));
  const topS = new THREE.Shape(oct.getPoints()); const topG = new THREE.ExtrudeGeometry(topS, { depth: 0.006, bevelEnabled: false }); topG.rotateX(-Math.PI / 2); const tp = new THREE.Mesh(topG, casM); tp.position.y = HB - 0.006; cs.add(tp);
  const linG = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(inner.getPoints()); const h2 = new THREE.Path(); const hj = hi - 0.02; h2.moveTo(-hj, -hj); h2.lineTo(hj, -hj); h2.lineTo(hj, hj); h2.lineTo(-hj, hj); h2.closePath(); s.holes.push(h2); return s; })(), { depth: HB - 0.02, bevelEnabled: false });
  linG.rotateX(-Math.PI / 2); const lin = new THREE.Mesh(linG, X.lining); lin.position.y = 0.01; cs.add(lin);
  markShell(cs, shells);
  // hangers at the 4 corners + rods
  const hg = grp(root, parts, 'hangers'); const rod = opt.rod ?? 0.35;
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => { const x = sx * (hb + 0.02), z = sz * (hb - 0.14);
    hg.add(box(0.05, 0.05, 0.006, M.metal, x, HB - 0.06, z).rotateY(Math.PI / 2), box(0.04, 0.006, 0.05, M.metal, x + sx * 0.012, HB - 0.03, z));
    if (rod > 0) hg.add(cyl(0.005, rod, X.rod, 'y', x + sx * 0.02, HB - 0.03 + rod / 2, z, 8)); });
  const anim = { spin: [], flaps: flaps.map((f, i) => ({ obj: f, axis: 'x', base: 0.55, amp: 0.32, speed: 0.5, phase: i * 0.0 })), vanes: [], float: null, pump: null };
  const anchors = { intake: [0.0, -PT, 0.0], louver: [0.0, -PT, SO + 0.02], panel: [-hp + 0.02, -PT / 2, -hp + 0.06], hangers: [hb + 0.04, HB + 0.1, hb - 0.14] };
  if (interior) {
    const fi = grp(root, parts, 'filter');
    fi.add(box(0.55, 0.002, 0.55, filterMat(M), 0, -0.004, 0));
    [[0, 0.275, 0.55, 0.006], [0, -0.275, 0.55, 0.006], [0.275, 0, 0.006, 0.55], [-0.275, 0, 0.006, 0.55]].forEach(([x, z, w, d]) => fi.add(box(w, 0.006, d, M.chassis, x, -0.004, z)));
    // bell-mouth (orifice) guiding the air up into the fan
    const bm = grp(root, parts, 'bell');
    const bprof = [[0.3, 0.004], [0.27, 0.008], [0.225, 0.022], [0.19, 0.045], [0.172, 0.068], [0.168, 0.08]].map(([r, y]) => new THREE.Vector2(r, y));
    const bmM = M.edge ? M.chassis : new THREE.MeshStandardMaterial({ color: 0x505861, roughness: 0.6, side: THREE.DoubleSide });
    bm.add(new THREE.Mesh(new THREE.LatheGeometry(bprof, 48), bmM));
    // turbo fan: shroud ring + 7 backward-curved 3D blades + hub, motor on top
    const fan = grp(root, parts, 'fan'); const spin = new THREE.Group(); fan.add(spin);
    const fanM = M.edge ? M.blade : new THREE.MeshStandardMaterial({ color: 0x2f353c, roughness: 0.45, side: THREE.DoubleSide });
    const shroud = new THREE.LatheGeometry([[0.176, 0.07], [0.2, 0.074], [0.232, 0.084], [0.25, 0.092]].map(([r, y]) => new THREE.Vector2(r, y)), 48); spin.add(new THREE.Mesh(shroud, fanM));
    spin.add(cyl(0.252, 0.006, fanM, 'y', 0, 0.205, 0, 48));
    spin.add(cyl(0.05, 0.09, fanM, 'y', 0, 0.16, 0, 24, 0.075));
    for (let b = 0; b < 7; b++) {
      const s = new THREE.Shape(), pts = [], ptsI = [], a0 = b / 7 * Math.PI * 2;
      for (let i = 0; i <= 12; i++) { const t = i / 12, r = 0.12 + t * 0.128, a = a0 + t * 0.95; pts.push([Math.cos(a) * r, Math.sin(a) * r]); ptsI.push([Math.cos(a - 0.03) * r, Math.sin(a - 0.03) * r]); }
      s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); ptsI.reverse().forEach(p => s.lineTo(p[0], p[1])); s.closePath();
      const bg = new THREE.ExtrudeGeometry(s, { depth: 0.118, bevelEnabled: false }); bg.rotateX(-Math.PI / 2); const bl = new THREE.Mesh(bg, fanM); bl.position.y = 0.084; spin.add(bl);
    }
    anim.spin.push({ obj: spin, axis: 'y', rate: 7 });
    const mo = grp(root, parts, 'motor');
    mo.add(cyl(0.078, 0.055, M.dark, 'y', 0, 0.232, 0, 32), cyl(0.012, 0.03, M.metal, 'y', 0, 0.2, 0, 12));
    [0, 1, 2].forEach(i => { const a = i / 3 * Math.PI * 2; mo.add(box(0.14, 0.006, 0.02, M.metal, Math.cos(a) * 0.12, HB - 0.01, Math.sin(a) * 0.12).rotateY(-a)); });
    // square evaporator around the fan (2 rows), gap at the corner where the pump and pipes sit
    const co = grp(root, parts, 'coil');
    const ri = 0.3, ro = 0.338, y0 = 0.05, y1 = 0.228, pitch = 0.0065, gap = 0.12;
    const fin = new THREE.BoxGeometry(0.0006, y1 - y0, ro - ri);
    const mid = (ri + ro) / 2;
    const sides = [
      { axis: 'x', fixed: mid, from: -ro, to: ro }, { axis: 'z', fixed: -mid, from: -ro, to: ro },
      { axis: 'x', fixed: -mid, from: -ro, to: ro - gap }, { axis: 'z', fixed: mid, from: -ro + gap, to: ro },
    ];
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion();
    sides.forEach(sd => {
      const n = Math.floor((sd.to - sd.from) / pitch), im = new THREE.InstancedMesh(fin, M.fin, n);
      for (let i = 0; i < n; i++) { const u = sd.from + i * pitch; if (sd.axis === 'x') { q.identity(); mt.compose(V(u, (y0 + y1) / 2, sd.fixed), q, V(1, 1, 1)); } else { mt.compose(V(sd.fixed, (y0 + y1) / 2, u), q.setFromAxisAngle(V(0, 1, 0), Math.PI / 2), V(1, 1, 1)); } im.setMatrixAt(i, mt); }
      co.add(im);
      for (let k = 0; k < 6; k++) [ri + 0.009, ro - 0.009].forEach(r => { const y = y0 + 0.015 + k * 0.03, len = sd.to - sd.from, mid = (sd.from + sd.to) / 2, fx = Math.sign(sd.fixed) * r;
        co.add(sd.axis === 'x' ? cyl(0.004, len, M.copper, 'x', mid, y, fx, 8) : cyl(0.004, len, M.copper, 'z', fx, y, mid, 8)); });
    });
    for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.004, 8, 12, Math.PI), M.copper); t.position.set(ro - gap + 0.004, y0 + 0.015 + k * 0.03, -mid); t.rotation.y = Math.PI / 2; co.add(t); }
    co.add(cyl(0.007, 0.19, M.copper, 'y', mid, 0.14, -ro + gap - 0.02, 10), cyl(0.005, 0.19, M.copper, 'y', mid - 0.022, 0.14, -ro + gap - 0.02, 10));
    // drain pan: moulded foam ring under the coil + sump at the pump corner
    const pa = grp(root, parts, 'pan');
    const ring = new THREE.Shape(); ring.moveTo(-0.352, -0.352); ring.lineTo(0.352, -0.352); ring.lineTo(0.352, 0.352); ring.lineTo(-0.352, 0.352); ring.closePath();
    const rh = new THREE.Path(); rh.moveTo(-0.27, -0.27); rh.lineTo(-0.27, 0.27); rh.lineTo(0.27, 0.27); rh.lineTo(0.27, -0.27); rh.closePath(); ring.holes.push(rh);
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.048, bevelEnabled: false }); rg.rotateX(-Math.PI / 2); pa.add(new THREE.Mesh(rg, X.foam));
    const wring = new THREE.Shape(); wring.moveTo(-0.345, -0.345); wring.lineTo(0.345, -0.345); wring.lineTo(0.345, 0.345); wring.lineTo(-0.345, 0.345); wring.closePath();
    const wh = new THREE.Path(); wh.moveTo(-0.295, -0.295); wh.lineTo(-0.295, 0.295); wh.lineTo(0.295, 0.295); wh.lineTo(0.295, -0.295); wh.closePath(); wring.holes.push(wh);
    const wgeo = new THREE.ShapeGeometry(wring); wgeo.rotateX(-Math.PI / 2); const wat = new THREE.Mesh(wgeo, X.water); wat.position.y = 0.05; wat.name = 'water'; pa.add(wat);
    pa.add(box(0.09, 0.03, 0.09, X.foam, 0.33, 0.035, -0.33));
    // drain pump + float switch in the sump, lift hose to the drain socket on the side
    const pu = grp(root, parts, 'pump');
    pu.add(cyl(0.032, 0.055, M.dark, 'y', 0.33, 0.1, -0.33, 20), cyl(0.012, 0.05, M.metal, 'y', 0.33, 0.05, -0.33, 12), box(0.07, 0.006, 0.07, M.metal, 0.33, 0.13, -0.33));
    const up = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.33, 0.13, -0.35), V(0.33, 0.17, -0.37), V(0.33, 0.2, -0.4), V(0.33, 0.205, -0.43)]), 16, 0.007, 8), X.hose); pu.add(up);
    const fl = grp(root, parts, 'float'); const fpiv = new THREE.Group(); fpiv.position.set(0.29, 0.05, -0.37); fl.add(fpiv);
    fpiv.add(cyl(0.003, 0.06, M.metal, 'y', 0, 0.02, 0, 6)); const bob = cyl(0.012, 0.022, X.foam, 'y', 0, 0, 0, 14); bob.material = M.edge ? M.pcb : new THREE.MeshStandardMaterial({ color: 0xe2711d, roughness: 0.5 }); fpiv.add(bob);
    anim.float = { obj: bob, base: 0.0, amp: 0.012, speed: 1.6 }; anim.pump = pu;
    const dr = grp(root, parts, 'drain'); dr.add(cyl(0.012, 0.07, M.pan, 'z', 0.33, 0.205, -hb - 0.025, 12));
    // electrical box on the outside of the casing
    const pc = grp(root, parts, 'pcb');
    pc.add(box(0.06, 0.13, 0.3, M.dark, -hb - 0.035, 0.1, -0.18), box(0.004, 0.1, 0.25, M.pcb, -hb - 0.068, 0.1, -0.18));
    // refrigerant connections on the side (liquid + gas)
    const pp = grp(root, parts, 'pipes');
    pp.add(cyl(0.013, 0.14, M.insul, 'z', 0.12, 0.15, -hb - 0.07, 14), cyl(0.009, 0.14, M.insul, 'z', 0.12, 0.11, -hb - 0.07, 14));
    Object.assign(anchors, { filter: [-0.18, -0.004, -0.05], bell: [-0.2, 0.03, 0.0], fan: [0.18, 0.13, -0.02], motor: [0.0, 0.26, -0.02], coil: [-0.319, 0.17, -0.02], pan: [-0.33, 0.045, -0.02], pump: [0.33, 0.13, -0.33], float: [0.29, 0.05, -0.37], drain: [0.33, 0.205, -hb - 0.05], pcb: [-hb - 0.065, 0.14, -0.18], pipes: [0.12, 0.15, -hb - 0.14] });
  }
  const paths = {
    // centre intake up through the filter and bell-mouth, flung sideways by the fan, through the coil, down the outer channel, out of the slot and along the ceiling
    radial: [[0.0, -0.9], [0.0, -0.3], [0.02, -0.03], [0.05, 0.03], [0.12, 0.08], [0.2, 0.12], [0.26, 0.13], [0.32, 0.12], [0.375, 0.1], [0.38, 0.03], [0.372, -0.03], [0.4, -0.065], [0.62, -0.1], [1.0, -0.18], [1.6, -0.45], [2.2, -0.95]],
    swap: [0.38, 0.52],
    drain: [[-0.32, 0.052, -0.3], [0.1, 0.052, -0.32], [0.3, 0.045, -0.33], [0.33, 0.06, -0.33], [0.33, 0.14, -0.34], [0.33, 0.2, -0.4], [0.33, 0.205, -hb - 0.06], [0.33, 0.2, -hb - 0.4]],
    drips: { ring: [ri_(), ro_()], y: [0.05, 0.05] },
    liquid: [[0.12, 0.11, -hb - 0.5], [0.12, 0.11, -hb - 0.07], [0.2, 0.11, -0.3], [0.319, 0.1, -0.2]],
    gas: [[0.297, 0.2, -0.2], [0.2, 0.15, -0.3], [0.12, 0.15, -hb - 0.07], [0.12, 0.15, -hb - 0.5]],
  };
  function ri_() { return 0.3; } function ro_() { return 0.338; }
  return { root, parts, anim, paths, anchors, dims: { w: P, h: HB + PT, d: P, panel: P, body: B, bodyH: HB }, shells, type: 'cassette' };
}

// per-frame motion for any unit built above; k = fan speed factor (0..1), t = clock
export function animateUnit(U, dt, t, k = 1) {
  const A = U.anim; if (!A) return;
  A.spin.forEach(s => { s.obj.rotation[s.axis] += dt * s.rate * k; });
  A.flaps.forEach(f => { f.obj.rotation[f.axis] = f.base + Math.sin(t * f.speed + (f.phase || 0)) * f.amp; });
  A.vanes.forEach(v => { v.obj.rotation[v.axis] = v.base + Math.sin(t * v.speed) * v.amp; });
  if (U.type === 'ceiling' && U.parts.vanes) U.parts.vanes.children.forEach((v, i) => { v.rotation.y = Math.sin(t * 0.35 + i * 0.05) * 0.3; });
  if (A.float) A.float.obj.position.y = A.float.base + (Math.sin(t * A.float.speed) * 0.5 + 0.5) * A.float.amp;
}
/* =================================================================== */
/* FLOOR-STANDING — Rev.09 (room-fit simulator, product shots)          */
/* front discharge at the top with auto-swing flaps, display, intake grille low on the front, plinth   */
/* origin: x/z centre, y = 0 on the floor, front = +z                                                 */
/* =================================================================== */
export function buildFloorUnit(M, opt = {}) {
  const W = opt.w || 0.52, H = opt.h || 1.78, D = opt.d || 0.34, hw = W / 2, hd = D / 2, r = Math.min(0.07, W * 0.14);
  const root = new THREE.Group(); root.name = 'floor'; const parts = {}, shells = [];
  const flat = !!M.edge, X = extra(M);
  const shellM = flat ? M.shell : new THREE.MeshPhysicalMaterial({ color: 0xf4f4f2, roughness: 0.26, clearcoat: 0.8, clearcoatRoughness: 0.14 });
  const darkM = flat ? M.dark : new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.75 });
  const glassM = flat ? M.dark : new THREE.MeshPhysicalMaterial({ color: 0x0d1116, roughness: 0.08, clearcoat: 1, metalness: 0.2 });
  // casing: rounded-rect section (x, z) extruded up y
  const cs = grp(root, parts, 'casing');
  // the bevel grows the section outward by bevelSize, so the shape is inset by it: the front face sits exactly at z = hd
  const bs = 0.01, sw = hw - bs, sd = hd - bs, sec = new THREE.Shape(); const iw = sw - r, id = sd - r;
  sec.moveTo(-iw, -sd); sec.lineTo(iw, -sd); sec.quadraticCurveTo(sw, -sd, sw, -id); sec.lineTo(sw, id); sec.quadraticCurveTo(sw, sd, iw, sd); sec.lineTo(-iw, sd); sec.quadraticCurveTo(-sw, sd, -sw, id); sec.lineTo(-sw, -id); sec.quadraticCurveTo(-sw, -sd, -iw, -sd);
  const interior = !!opt.interior;   // Rev.09 r4 (job scene): open casing — front cover + intake grille are separate parts, interior behind
  if (!interior) {
    const body = new THREE.ExtrudeGeometry(sec, { depth: H - 0.084, bevelEnabled: true, bevelThickness: 0.012, bevelSize: bs, bevelSegments: 4, curveSegments: 18 });
    body.rotateX(-Math.PI / 2); body.translate(0, 0.072, 0);
    cs.add(new THREE.Mesh(body, shellM));
  } else {
    const t = 0.014, yb = 0.06, hh = H - yb;
    cs.add(box(W - 2 * r, hh, t, shellM, 0, yb + hh / 2, -hd + t / 2));                                   // back
    [-1, 1].forEach(sx => { cs.add(box(t, hh, D - r, shellM, sx * (hw - t / 2), yb + hh / 2, r / 2 - 0.004)); cs.add(cyl(r, hh, shellM, 'y', sx * (hw - r), yb + hh / 2, -hd + r, 20)); });   // sides + rounded rear corners
    cs.add(box(W, 0.016, D, shellM, 0, H - 0.008, 0));                                                     // top
    cs.add(box(W - 0.004, H * 0.28 - 0.008, t, shellM, 0, H - H * 0.14, hd - t / 2));                      // fixed upper front (outlet frame)
    cs.add(box(W - 2 * t - 0.01, hh - 0.02, 0.004, X.lining, 0, yb + hh / 2, -hd + t + 0.003));            // insulated lining
  }
  cs.add(box(W - 0.04, 0.05, D - 0.05, darkM, 0, 0.03, -0.005));   // recessed plinth
  markShell(cs, shells);
  // discharge: dark cavity + horizontal flaps + vertical vanes (upper front)
  // Rev.09 tidy: a dark outlet panel framed in grey, vertical swing vanes on it and three wide shell-coloured flaps in front
  const lo = grp(root, parts, 'louver'); const y0 = H * 0.74, y1 = H * 0.93, cw = W - 0.1;
  lo.add(box(cw, y1 - y0, 0.004, darkM, 0, (y0 + y1) / 2, hd + 0.002));
  [[cw, 0.012, 0, y1 + 0.006], [cw, 0.012, 0, y0 - 0.006], [0.012, y1 - y0 + 0.024, -cw / 2 - 0.006, (y0 + y1) / 2], [0.012, y1 - y0 + 0.024, cw / 2 + 0.006, (y0 + y1) / 2]].forEach(([w, hh, x, y]) => lo.add(box(w, hh, 0.006, X.grille, x, y, hd + 0.003)));
  const vanes = new THREE.Group(); lo.add(vanes);
  for (let i = 0; i < 9; i++) vanes.add(box(0.004, y1 - y0 - 0.016, 0.01, X.grille, -cw / 2 + 0.03 + i * ((cw - 0.06) / 8), (y0 + y1) / 2, hd + 0.006));
  const flaps = [];
  for (let i = 0; i < 3; i++) { const piv = new THREE.Group(); piv.position.set(0, y0 + 0.03 + i * ((y1 - y0 - 0.06) / 2), hd + 0.012); const wing = box(cw - 0.012, 0.007, 0.042, shellM, 0, 0, 0.018); piv.add(wing); piv.rotation.x = 0.3; lo.add(piv); flaps.push(piv); }
  // display window (interior build: it sits on the removable front cover)
  const dp = interior ? new THREE.Group() : grp(root, parts, 'display');
  dp.add(box(W * 0.46, 0.07, 0.006, glassM, 0, H * 0.64, hd + 0.003));
  if (!flat) {
    const t = canvasTex(256, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#8fe8ff'; g.font = '600 40px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('25°', w / 2, h / 2 + 2); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.3, 0.05), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })); lab.position.set(0, H * 0.64, hd + 0.0065); dp.add(lab);
  }
  // intake grille (lower front): fine horizontal slots
  const gr = grp(root, parts, 'grille'); const g0 = 0.14, g1 = H * 0.36, n = Math.floor((g1 - g0) / 0.016);
  if (interior) gr.add(box(W - 0.03, g1 - g0 + 0.08, 0.006, X.grille, 0, (g0 + g1) / 2, hd - 0.004), box(W - 0.13, g1 - g0 + 0.01, 0.007, darkM, 0, (g0 + g1) / 2, hd - 0.002));
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(W - 0.12, 0.006, 0.004), darkM, n), mt = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { mt.makeTranslation(0, g0 + i * 0.016, hd + 0.002); im.setMatrixAt(i, mt); } gr.add(im);
  gr.add(box(W - 0.1, 0.004, 0.004, X.grille, 0, g1 + 0.012, hd + 0.002));
  const anim = { spin: [], flaps: flaps.map((f, i) => ({ obj: f, axis: 'x', base: 0.3, amp: 0.16, speed: 0.8, phase: i * 0.2 })), vanes: [{ obj: vanes, axis: 'y', base: 0, amp: 0.12, speed: 0.5 }] };
  const anchors = { outlet: [0, (y0 + y1) / 2, hd + 0.02], display: [0, H * 0.64, hd + 0.01], grille: [0, (g0 + g1) / 2, hd + 0.01] };
  if (interior) {
    // front cover between the intake grille and the outlet frame, with the display
    const fr = grp(root, parts, 'front'); const f0 = g1 + 0.04, f1 = H * 0.72;
    fr.add(box(W - 0.004, f1 - f0, 0.014, shellM, 0, (f0 + f1) / 2, hd - 0.007)); fr.add(dp);
    // filter behind the grille
    const fi = grp(root, parts, 'filter');
    fi.add(box(W - 0.08, g1 - g0, 0.003, filterMat(M), 0, (g0 + g1) / 2, hd - 0.03));
    [[W - 0.08, 0.008, 0, g0], [W - 0.08, 0.008, 0, g1], [0.008, g1 - g0, -(W - 0.08) / 2, (g0 + g1) / 2], [0.008, g1 - g0, (W - 0.08) / 2, (g0 + g1) / 2]].forEach(([w, h2, x, y]) => fi.add(box(w, h2, 0.008, M.chassis, x, y, hd - 0.03)));
    // sirocco blower (horizontal shaft) low in the cabinet, in its scroll housing
    const yc = H * 0.28, zc = -0.03, R = Math.min(0.11, D * 0.3), wl = W - 0.16;
    const fan = grp(root, parts, 'fan'); const spin = new THREE.Group(); spin.position.set(0, yc, zc); fan.add(spin);
    { const nb = 44, im = new THREE.InstancedMesh(new THREE.BoxGeometry(wl, 0.0016, 0.02), M.blade, nb), mt = new THREE.Matrix4();
      for (let i = 0; i < nb; i++) { const a = i / nb * Math.PI * 2; mt.compose(V(0, Math.sin(a) * (R - 0.01), Math.cos(a) * (R - 0.01)), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a - 0.55), V(1, 1, 1)); im.setMatrixAt(i, mt); }
      spin.add(im); [-1, 1].forEach(sx => spin.add(cyl(R, 0.004, M.blade, 'x', sx * wl / 2, 0, 0, 32))); spin.add(cyl(0.007, W - 0.06, M.metal, 'x', 0, 0, 0, 10)); }
    anim.spin.push({ obj: spin, axis: 'x', rate: -10 });
    const sc = grp(root, parts, 'scroll');
    { const pts = []; const a0 = 0.9, sw = 5.2, r0 = R + 0.012, r1 = R + 0.05; for (let i = 0; i <= 36; i++) { const t2 = i / 36, a = a0 - t2 * sw, rr = r0 + (r1 - r0) * t2; pts.push([zc + rr * Math.cos(a), yc + rr * Math.sin(a)]); }
      const scM = M.edge ? M.chassis : new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.7, side: THREE.DoubleSide });
      sc.add(bandAlong(pts, 0.004, -wl / 2 - 0.01, wl / 2 + 0.01, scM)); }
    // evaporator coil in the upper cabinet (inclined slab) + drain pan below it
    const co = grp(root, parts, 'coil'); const cp0 = [H * 0.42, -0.05], cp1 = [H * 0.7, 0.04];
    co.add(finSegment(M.fin, cp0, cp1, 0.05, -hw + 0.04, hw - 0.06, 0.0062));
    { const dy = cp1[0] - cp0[0], dz = cp1[1] - cp0[1]; for (let k = 0; k < 9; k++) [-1, 1].forEach(rw => co.add(cyl(0.0045, W - 0.08, M.copper, 'x', -0.01, cp0[0] + dy * (0.06 + k * 0.11), cp0[1] + dz * (0.06 + k * 0.11) + rw * 0.012, 10))); }
    const pa = grp(root, parts, 'pan'); const py = H * 0.4;
    pa.add(box(W - 0.06, 0.006, 0.2, M.pan, 0, py, -0.01), box(W - 0.06, 0.035, 0.005, M.pan, 0, py + 0.016, 0.09), box(W - 0.06, 0.035, 0.005, M.pan, 0, py + 0.016, -0.11));
    const wat = box(W - 0.1, 0.002, 0.17, X.water, 0, py + 0.006, -0.01); wat.name = 'water'; pa.add(wat);
    const pc = grp(root, parts, 'pcb'); pc.add(box(0.12, 0.16, 0.06, M.dark, hw - 0.1, H * 0.62, hd - 0.07), box(0.1, 0.13, 0.004, M.pcb, hw - 0.1, H * 0.62, hd - 0.039));
    Object.assign(anchors, { front: [0, (f0 + f1) / 2, hd + 0.01], filter: [0, (g0 + g1) / 2, hd - 0.02], fan: [0, yc, zc + R], coil: [0, (cp0[0] + cp1[0]) / 2, 0.02], pan: [0, py, 0.08], coilBack: [0, (cp0[0] + cp1[0]) / 2, -0.09] });
  }
  return { root, parts, anim, paths: null, anchors, dims: { w: W, h: H, d: D }, shells, type: 'floor' };
}

export const buildUnit = (type, M, opt) => type === 'ceiling' ? buildCeilingUnit(M, opt) : type === 'cassette' ? buildCassetteUnit(M, opt) : type === 'floor' ? buildFloorUnit(M, opt) : buildWallUnit(M, opt);
