// SBP AirCare — animated occupants for the room simulations (Rev.08).
// Jointed figures (pelvis, spine, neck, head, shoulders/elbows/wrists, hips/knees/ankles) driven by simple procedural
// animation: standing idle, walking back and forth on a free path, sitting (typing when a desk is in front), lying
// (breathing). Behaviour follows the local air temperature: warm (≥ 27 °C) → fanning the face with one hand, hot
// (≥ 29.5 °C) → also wiping the forehead now and then; comfortable → calm; cool (< 22 °C) → arms folded.
// Rendering is instanced: one InstancedMesh per body-part kind for the whole crowd (≈ 14 draw calls for 60 people).
import * as THREE from './three.module.min.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SHIRT = [0x3e5c8a, 0x8a4b3e, 0x2f6d5a, 0x6b5b95, 0xc9a24a, 0x55606c, 0xb85c7a, 0x3d7ea6, 0xe6e1d6, 0x7c8f3d, 0xd8d2c4, 0x1f3552];
const PANTS = [0x2b3440, 0x3b3f46, 0x5a4a3a, 0x1f2a3a, 0x6b6f76, 0x2c3b52, 0x8a7a64];
const SKIN = [0xe3bd98, 0xc99a73, 0xa87653, 0xf0cfae, 0xd6a986];
const HAIR = [0x1d1a17, 0x2a211b, 0x3a2a1e, 0x5a4636, 0x8f8f8f];
const SHOE = [0x22262b, 0x3a2e26, 0xe8e8e6, 0x2f3a4a];

// part kinds: geometry is authored so that the node origin is the joint and the limb hangs along -Y
function geos() {
  const cap = (r, len, rs = 10) => new THREE.CapsuleGeometry(r, len, 4, rs);
  const g = {
    pelvis: cap(0.13, 0.08, 14).scale(1.2, 0.95, 0.72).translate(0, -0.02, 0),
    torso: cap(0.145, 0.3, 16).scale(1.18, 1, 0.66).translate(0, 0.25, 0),
    neck: new THREE.CylinderGeometry(0.042, 0.048, 0.1, 12).translate(0, 0.05, 0),
    head: new THREE.SphereGeometry(0.1, 20, 16).scale(0.9, 1.1, 1).translate(0, 0.12, 0.005),
    hairS: new THREE.SphereGeometry(0.106, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(0.92, 1.08, 1.02).translate(0, 0.14, -0.006),
    hairL: new THREE.CapsuleGeometry(0.095, 0.16, 4, 12).scale(1.02, 1, 0.55).translate(0, 0.07, -0.06),
    uarm: cap(0.046, 0.2).translate(0, -0.13, 0),
    farm: cap(0.038, 0.18).translate(0, -0.12, 0),
    hand: new THREE.SphereGeometry(1, 12, 8).scale(0.036, 0.062, 0.024).translate(0, -0.05, 0),
    thigh: cap(0.066, 0.3).translate(0, -0.2, 0),
    shin: cap(0.05, 0.32).translate(0, -0.2, 0),
    shoe: cap(0.045, 0.14, 8).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(0, -0.035, 0.05),
    skirt: new THREE.CylinderGeometry(0.16, 0.25, 0.42, 16, 1, true).translate(0, -0.2, 0),
    // work cap: crown + visor (technician)
    cap: (() => { const c = new THREE.SphereGeometry(0.108, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.95, 0.78, 1.03).translate(0, 0.158, -0.004); const v = new THREE.CylinderGeometry(0.075, 0.08, 0.012, 20, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.25).translate(0, 0.16, 0.07); const m = new THREE.BufferGeometry(); const a = c.toNonIndexed(), b = v.toNonIndexed(); const pa = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3); pa.set(a.attributes.position.array); pa.set(b.attributes.position.array, a.attributes.position.array.length); const na = new Float32Array(pa.length); na.set(a.attributes.normal.array); na.set(b.attributes.normal.array, a.attributes.normal.array.length); m.setAttribute('position', new THREE.BufferAttribute(pa, 3)); m.setAttribute('normal', new THREE.BufferAttribute(na, 3)); return m; })(),
  };
  return g;
}

function skeleton() {
  const n = () => new THREE.Object3D();
  const root = n(), pelvis = n(), spine = n(), neck = n(), head = n();
  const sh = [n(), n()], el = [n(), n()], wr = [n(), n()], hip = [n(), n()], kn = [n(), n()], an = [n(), n()];
  root.add(pelvis); pelvis.position.y = 0.95; pelvis.add(spine); spine.position.y = 0.06;
  spine.add(neck); neck.position.y = 0.47; neck.add(head); head.position.y = 0.08;
  [-1, 1].forEach((s, i) => {
    spine.add(sh[i]); sh[i].position.set(s * 0.2, 0.43, 0); sh[i].add(el[i]); el[i].position.y = -0.27; el[i].add(wr[i]); wr[i].position.y = -0.245;
    pelvis.add(hip[i]); hip[i].position.set(s * 0.095, -0.04, 0); hip[i].add(kn[i]); kn[i].position.y = -0.43; kn[i].add(an[i]); an[i].position.y = -0.43;
  });
  return { root, pelvis, spine, neck, head, sh, el, wr, hip, kn, an };
}

/**
 * createCrowd(parent, { shadows, flat }) → { set(list), update(dt, t, tempAt), clear(), count, heads() }
 * list: [{ x, z, y, ry, pose: 'stand'|'sit'|'lie'|'walk', desk, path: [ax, az, bx, bz] }]
 */
export function createCrowd(parent, opts = {}) {
  const o = { shadows: true, flat: false, max: 64, ...opts };
  const G = geos();
  const mat = o.flat ? new THREE.MeshLambertMaterial({ color: 0xffffff }) : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0 });
  const skinMat = o.flat ? mat : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
  const KINDS = [
    ['pelvis', 1, mat], ['torso', 1, mat], ['neck', 1, skinMat], ['head', 1, skinMat], ['hairS', 1, mat], ['hairL', 1, mat],
    ['uarm', 2, mat], ['farm', 2, mat], ['hand', 2, skinMat], ['thigh', 2, mat], ['shin', 2, mat], ['shoe', 2, mat], ['skirt', 1, mat], ['cap', 1, mat],
  ];
  const IM = {};
  const group = new THREE.Group(); group.name = 'crowd'; parent.add(group);
  KINDS.forEach(([k, per, m]) => { const im = new THREE.InstancedMesh(G[k], m, o.max * per); im.castShadow = o.shadows; im.receiveShadow = false; im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(im); IM[k] = im; });
  let P = [];
  const col = new THREE.Color(), M4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);

  function set(list) {
    P = list.slice(0, o.max).map((s, i) => {
      const sk = skeleton();
      const C = s.colors || {};
      const female = s.female ?? ((i * 7 + 3) % 5 < 2), longSleeve = C.longSleeve ?? ((i * 5) % 3 === 0), skirt = C.skirt ?? (female && (i * 11) % 3 === 0);
      const p = {
        ...s, i, sk, female, skirt, longSleeve,
        shirt: C.shirt ?? SHIRT[(i * 7) % SHIRT.length], pants: C.pants ?? PANTS[(i * 3) % PANTS.length], skin: C.skin ?? SKIN[(i * 5) % SKIN.length], hair: C.hair ?? HAIR[(i * 11) % HAIR.length], shoe: C.shoe ?? SHOE[(i * 13) % SHOE.length], capC: C.cap ?? null,
        scale: (female ? 0.93 : 1.0) + ((i * 13) % 9) / 90, ph: (i * 1.37) % 6.28, seed: ((i * 9301 + 49297) % 233280) / 233280,
        u: 0, dir: 1, warm: 0, cold: 0, look: 0, walkT: 0,
      };
      sk.root.scale.setScalar(p.scale);
      if (p.pose === 'walk' && p.path) { p.len = Math.hypot(p.path[2] - p.path[0], p.path[3] - p.path[1]); p.u = p.seed; }
      return p;
    });
    // counts + colours (static per person)
    const counts = {}; KINDS.forEach(([k, per]) => counts[k] = 0);
    P.forEach(p => {
      const put = (k, c) => { const im = IM[k]; col.set(c); im.setColorAt(counts[k]++, col); };
      put('pelvis', p.skirt ? p.shirt : p.pants); put('torso', p.shirt); put('neck', p.skin); put('head', p.skin); put('hairS', p.hair); put('hairL', p.female ? p.hair : p.hair);
      [0, 1].forEach(() => { put('uarm', p.shirt); put('farm', p.longSleeve ? p.shirt : p.skin); put('hand', p.skin); put('thigh', p.skirt ? p.skin : p.pants); put('shin', p.skirt ? p.skin : p.pants); put('shoe', p.shoe); });
      put('skirt', p.pants); put('cap', p.capC ?? 0x222222);
    });
    KINDS.forEach(([k, per]) => { IM[k].count = P.length * per; if (IM[k].instanceColor) IM[k].instanceColor.needsUpdate = true; });
  }

  // pose solver: sets joint rotations for one person
  function pose(p, t, dt, temp) {
    const S = p.sk; const ph = t * 1.0 + p.ph;
    // comfort state (smoothed) from the air temperature at the person
    const warmT = temp == null ? 0 : clamp((temp - 27.6) / 1.4, 0, 1), coldT = temp == null ? 0 : clamp((21.8 - temp) / 1.5, 0, 1);
    p.warm = lerp(p.warm, warmT, clamp(dt * 0.8, 0, 1)); p.cold = lerp(p.cold, coldT, clamp(dt * 0.8, 0, 1));
    const reset = n => n.rotation.set(0, 0, 0);
    [S.pelvis, S.spine, S.neck, S.head, ...S.sh, ...S.el, ...S.wr, ...S.hip, ...S.kn, ...S.an].forEach(reset);
    S.root.position.set(p.x, p.y || 0, p.z); S.root.rotation.set(0, p.ry || 0, 0); S.pelvis.position.set(0, 0.95, 0);
    const breath = Math.sin(t * 1.6 + p.ph) * 0.015;
    if (p.pose === 'rig' && p.rig) { p.rig(S, t, dt, p); return; }
    if (p.pose === 'walk' && p.path && p.len > 0.4) {
      const sp = 0.75 + p.seed * 0.35;
      p.u += (dt * sp / p.len) * p.dir;
      if (p.u > 1) { p.u = 1; p.dir = -1; p.pause = 1.2 + p.seed; } if (p.u < 0) { p.u = 0; p.dir = 1; p.pause = 1.2 + p.seed; }
      if (p.pause > 0) { p.pause -= dt; p.u -= (dt * sp / p.len) * p.dir; }
      const [ax, az, bx, bz] = p.path; const x = lerp(ax, bx, p.u), z = lerp(az, bz, p.u);
      const face = Math.atan2((bx - ax) * p.dir, (bz - az) * p.dir);
      p.face = p.face == null ? face : p.face + Math.atan2(Math.sin(face - p.face), Math.cos(face - p.face)) * clamp(dt * 5, 0, 1);
      S.root.position.set(x, 0, z); S.root.rotation.y = p.face;
      const moving = !(p.pause > 0);
      p.walkT += moving ? dt * sp * 5.2 : 0; const w = p.walkT, amp = moving ? 1 : 0;
      S.hip[0].rotation.x = -0.42 * Math.sin(w) * amp; S.hip[1].rotation.x = 0.42 * Math.sin(w) * amp;
      S.kn[0].rotation.x = Math.max(0, 0.75 * Math.sin(w - 1.2)) * amp; S.kn[1].rotation.x = Math.max(0, 0.75 * Math.sin(w + Math.PI - 1.2)) * amp;
      S.an[0].rotation.x = -0.15 * Math.sin(w) * amp; S.an[1].rotation.x = 0.15 * Math.sin(w) * amp;
      S.sh[0].rotation.x = 0.32 * Math.sin(w) * amp; S.sh[1].rotation.x = -0.32 * Math.sin(w) * amp; S.el[0].rotation.x = -0.25; S.el[1].rotation.x = -0.25;
      S.sh[0].rotation.z = -0.06; S.sh[1].rotation.z = 0.06;
      S.pelvis.position.y = 0.95 + Math.abs(Math.cos(w)) * 0.025 * amp - 0.01; S.pelvis.rotation.y = 0.08 * Math.sin(w) * amp; S.spine.rotation.y = -0.12 * Math.sin(w) * amp;
    } else if (p.pose === 'sit') {
      S.pelvis.position.y = 0.5; S.hip[0].rotation.x = S.hip[1].rotation.x = -1.5; S.kn[0].rotation.x = S.kn[1].rotation.x = 1.45; S.an[0].rotation.x = S.an[1].rotation.x = 0.05;
      S.hip[0].rotation.z = -0.05; S.hip[1].rotation.z = 0.05;
      S.spine.rotation.x = p.desk ? 0.08 : -0.1; S.spine.scale.setScalar(1 + breath * 0.4);
      if (p.desk) { // typing
        S.sh[0].rotation.x = S.sh[1].rotation.x = -0.55; S.el[0].rotation.x = -1.05 + Math.sin(t * 9 + p.ph) * 0.05; S.el[1].rotation.x = -1.05 + Math.sin(t * 8.3 + p.ph + 1) * 0.05;
        S.sh[0].rotation.z = -0.12; S.sh[1].rotation.z = 0.12; S.wr[0].rotation.x = S.wr[1].rotation.x = 0.35;
        S.neck.rotation.x = 0.18; S.head.rotation.y = Math.sin(t * 0.3 + p.ph) * 0.15;
      } else { // relaxed, hands on thighs, glancing around
        S.sh[0].rotation.x = S.sh[1].rotation.x = -0.45; S.el[0].rotation.x = S.el[1].rotation.x = -0.55; S.sh[0].rotation.z = -0.1; S.sh[1].rotation.z = 0.1;
        S.head.rotation.y = Math.sin(t * 0.25 + p.ph) * 0.45; S.neck.rotation.x = 0.05;
      }
    } else if (p.pose === 'lie') {
      S.root.rotation.set(-Math.PI / 2, p.ry || 0, 0, 'YXZ'); S.root.position.y = (p.y || 0);
      S.spine.scale.set(1 + breath, 1, 1 + breath * 1.6); S.sh[0].rotation.z = -0.12; S.sh[1].rotation.z = 0.12;
      S.el[0].rotation.x = S.el[1].rotation.x = -0.3; S.head.rotation.y = Math.sin(t * 0.07 + p.ph) * 0.3;
    } else { // stand idle: weight shift + look around + small talk gestures
      const sw = Math.sin(t * 0.5 + p.ph);
      S.pelvis.rotation.z = sw * 0.035; S.hip[0].rotation.z = -sw * 0.035; S.hip[1].rotation.z = -sw * 0.035; S.kn[sw > 0 ? 0 : 1].rotation.x = Math.abs(sw) * 0.12;
      S.spine.scale.setScalar(1 + breath * 0.4); S.head.rotation.y = Math.sin(t * 0.21 + p.ph) * 0.55; S.neck.rotation.x = 0.04;
      S.sh[0].rotation.z = -0.1; S.sh[1].rotation.z = 0.1; S.el[0].rotation.x = S.el[1].rotation.x = -0.15;
      if (p.seed > 0.55) { const g = Math.max(0, Math.sin(t * 0.7 + p.ph * 2)); S.sh[1].rotation.x = -0.4 * g; S.el[1].rotation.x = -0.15 - 1.1 * g; S.wr[1].rotation.z = Math.sin(t * 3 + p.ph) * 0.3 * g; }
    }
    // comfort overlays (not while lying)
    if (p.pose !== 'lie') {
      const wv = p.warm;
      if (wv > 0.02) { // right hand fans the face
        const f = Math.sin(t * 13 + p.ph);
        S.sh[1].rotation.x = lerp(S.sh[1].rotation.x, -1.25, wv); S.sh[1].rotation.z = lerp(S.sh[1].rotation.z, 0.35, wv);
        S.el[1].rotation.x = lerp(S.el[1].rotation.x, -1.75, wv); S.wr[1].rotation.z = lerp(S.wr[1].rotation.z, f * 0.9, wv); S.wr[1].rotation.x = lerp(S.wr[1].rotation.x, 0.2, wv);
        S.head.rotation.x = lerp(0, -0.12, wv);
        // very hot: wipe the forehead with the other hand now and then
        const wipe = clamp((temp - 29.4) / 1.0, 0, 1) * Math.max(0, Math.sin(t * 0.45 + p.ph * 3)) ** 3;
        if (wipe > 0.01 && p.pose !== 'walk') { S.sh[0].rotation.x = lerp(S.sh[0].rotation.x, -1.55, wipe); S.sh[0].rotation.z = lerp(S.sh[0].rotation.z, 0.5, wipe); S.el[0].rotation.x = lerp(S.el[0].rotation.x, -2.0, wipe); S.wr[0].rotation.y = Math.sin(t * 4) * 0.5 * wipe; }
      }
      const cv = p.cold;
      if (cv > 0.02 && p.pose !== 'walk') { // arms folded
        [0, 1].forEach(k => { const s = k ? 1 : -1; S.sh[k].rotation.x = lerp(S.sh[k].rotation.x, -0.55, cv); S.sh[k].rotation.z = lerp(S.sh[k].rotation.z, -s * 0.25, cv); S.sh[k].rotation.y = lerp(0, s * 0.45, cv); S.el[k].rotation.x = lerp(S.el[k].rotation.x, -1.85, cv); });
      }
    }
  }

  const heads = [];
  function update(dt, t, tempAt) {
    const counts = {}; KINDS.forEach(([k]) => counts[k] = 0);
    heads.length = 0;
    let shown = true;   // p.hidden (Rev.09 r4): keep the slot, draw nothing
    const put = (k, node, visible = true) => { const im = IM[k]; im.setMatrixAt(counts[k]++, visible && shown ? node.matrixWorld : zero); };
    const tmp = new THREE.Vector3();
    P.forEach(p => {
      const S = p.sk;
      const temp = tempAt ? tempAt(p.pose === 'walk' && p.path ? S.root.position.x : p.x, p.pose === 'walk' && p.path ? S.root.position.z : p.z) : null;
      p.temp = temp; pose(p, t, dt, temp); shown = !p.hidden;
      S.root.updateMatrixWorld(true);
      // parent group transform (room offset) is applied through the InstancedMesh parent
      put('pelvis', S.pelvis, !p.skirt); put('torso', S.spine); put('neck', S.neck); put('head', S.head); put('hairS', S.head); put('hairL', S.head, p.female);
      [0, 1].forEach(k => { put('uarm', S.sh[k]); put('farm', S.el[k]); put('hand', S.wr[k]); put('thigh', S.hip[k]); put('shin', S.kn[k]); put('shoe', S.an[k]); });
      put('skirt', S.pelvis, p.skirt); put('cap', S.head, p.capC != null);
      heads.push(S.head.getWorldPosition(tmp).clone());
    });
    KINDS.forEach(([k]) => { IM[k].instanceMatrix.needsUpdate = true; });
  }
  return {
    group, set, update, heads: () => heads, people: () => P,
    clear() { set([]); },
    dispose() { KINDS.forEach(([k]) => { IM[k].geometry.dispose(); }); parent.remove(group); },
  };
}

/** walking gait on a skeleton (phase w, amplitude 0..1) — for rigs that move the root themselves */
export function gait(S, w, amp = 1) {
  S.hip[0].rotation.x = -0.42 * Math.sin(w) * amp; S.hip[1].rotation.x = 0.42 * Math.sin(w) * amp;
  S.kn[0].rotation.x = Math.max(0, 0.75 * Math.sin(w - 1.2)) * amp; S.kn[1].rotation.x = Math.max(0, 0.75 * Math.sin(w + Math.PI - 1.2)) * amp;
  S.an[0].rotation.x = -0.15 * Math.sin(w) * amp; S.an[1].rotation.x = 0.15 * Math.sin(w) * amp;
  S.sh[0].rotation.x = 0.32 * Math.sin(w) * amp; S.sh[1].rotation.x = -0.32 * Math.sin(w) * amp; S.el[0].rotation.x = S.el[1].rotation.x = -0.25 * amp;
  S.pelvis.position.y = 0.95 + Math.abs(Math.cos(w)) * 0.025 * amp - 0.01 * amp; S.pelvis.rotation.y = 0.08 * Math.sin(w) * amp; S.spine.rotation.y = -0.12 * Math.sin(w) * amp;
}

/** pick a free straight path (for walkers) that avoids boxes [{minX,maxX,minZ,maxZ}] inside [-w/2..w/2]×[-d/2..d/2] */
export function freePath(x, z, boxes, w, d, seed = 0.5, minLen = 1.2, maxLen = 4) {
  const ok = (px, pz) => px > -w / 2 + 0.35 && px < w / 2 - 0.35 && pz > -d / 2 + 0.35 && pz < d / 2 - 0.35 && !boxes.some(b => px > b.minX - 0.3 && px < b.maxX + 0.3 && pz > b.minZ - 0.3 && pz < b.maxZ + 0.3);
  if (!ok(x, z)) return null;
  let best = null;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + seed * 3;
    let L = 0; for (let s = 0.2; s <= maxLen; s += 0.2) { if (!ok(x + Math.sin(a) * s, z + Math.cos(a) * s)) break; L = s; }
    if (L >= minLen && (!best || L > best.L)) best = { L, a };
  }
  return best ? [x, z, x + Math.sin(best.a) * best.L, z + Math.cos(best.a) * best.L] : null;
}
