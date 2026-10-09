// SBP AirCare — technician + tools for the home scene (Rev.08).
// The technician is an animated jointed figure (people3d 'rig' pose) in the company uniform: walks between work spots
// along a small path graph (room ↔ sliding door ↔ balcony), climbs the A-frame ladder, crouches at the condensing unit,
// reaches up to the indoor unit, and holds the right tool for each step (spray gun, clamp meter, thermometer probe,
// tablet with the service form, remote, torque wrench, chemical sprayer, hand blower, torch, drill).
// Site tools: A-frame ladder, drop cloth, cleaning bag with spout + hose into a bucket, pressure-washer pump with hose,
// PCB cover, manifold gauges with red / blue / yellow hoses, vacuum pump, nitrogen cylinder with regulator, cartons.
import * as THREE from './three.module.min.js';
import { createCrowd, gait } from './people3d.js';
import { V, clamp, ease, smoothPts } from './install3d.js';
import { canvasTex } from './ac3d.js';
import { chestTex, backTex } from './brand3d.js';

const S = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...x });
const bx = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const cy = (r, h, m, x = 0, y = 0, z = 0, seg = 20, r2) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 ?? r, h, seg), m); o.position.set(x, y, z); o.castShadow = true; return o; };
const tubeM = (pts, r, m, seg = 40) => { const o = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8), m); o.castShadow = true; return o; };

/* ---------------------------------------------------------------- site tools (world placed) */
export function buildTools(home) {
  const g = new THREE.Group(); g.name = 'tools'; home.props.add(g);
  const alu = S(0xc5ccd3, { metalness: 0.8, roughness: 0.32 }), black = S(0x1d2126, { roughness: 0.5 }), orange = S(0xe2711d, { roughness: 0.45 }), yellow = S(0xf2c230, { roughness: 0.45 });
  const items = {};
  const item = (name, obj) => { obj.name = name; obj.visible = false; obj.userData.k = 0; g.add(obj); items[name] = obj; return obj; };

  // A-frame ladder in front of the indoor unit (climbed from the room side)
  { const L = new THREE.Group(); const H = 1.3, spread = 0.36;
    [-1, 1].forEach(s => { // two side rails per face
      const back = bx(0.04, Math.hypot(H, spread), 0.022, alu); back.position.set(s * 0.22, H / 2, spread / 2); back.rotation.x = -Math.atan2(spread, H); L.add(back);
      const front = bx(0.04, Math.hypot(H, spread), 0.022, alu); front.position.set(s * 0.22, H / 2, -spread / 2); front.rotation.x = Math.atan2(spread, H); L.add(front);
      [spread, -spread].forEach(z => L.add(bx(0.05, 0.02, 0.05, black, s * 0.22, 0.01, z)));
    });
    for (let i = 1; i <= 4; i++) { const y = i * H / 5, z = spread * (1 - y / H); L.add(bx(0.46, 0.022, 0.085, alu, 0, y, z - 0.01)); }
    L.add(bx(0.5, 0.05, 0.16, orange, 0, H + 0.02, 0));
    L.position.set(0.95, 0, -1.43); item('ladder', L); L.userData.step = { y: 2 * H / 5 + 0.011, z: -1.43 + spread * (1 - 2 / 5) + 0.03 }; }
  // drop cloth (blue tarp with folds)
  { const geo = new THREE.PlaneGeometry(1.7, 1.25, 40, 30); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.0025 + Math.sin(p.getY(i) * 13 + p.getX(i) * 3) * 0.0015); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, S(0x2f64b4, { roughness: 0.9, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(0.95, 0.012, -1.36); m.receiveShadow = true; item('cloth', m); }
  // cleaning bag under the unit (canvas cover with a spout) — follows the unit
  { const bag = new THREE.Group(); const top = [[-0.47, -0.13, -0.12], [0.47, -0.13, -0.12], [0.47, -0.13, 0.2], [-0.47, -0.13, 0.2]], bot = [[0.24, -0.5, 0.0], [0.34, -0.5, 0.0], [0.34, -0.5, 0.1], [0.24, -0.5, 0.1]];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...top, ...bot].flat(), 3)); geo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, S(0x9bb3c9, { roughness: 0.75, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); bag.add(m);
    const rim = bx(0.96, 0.02, 0.34, S(0x6e8aa4), 0, -0.125, 0.04); bag.add(rim);
    const spout = cy(0.035, 0.08, S(0x6e8aa4), 0.29, -0.54, 0.05); bag.add(spout);
    item('bag', bag); bag.userData.attachTo = 'unit'; }
  // bucket + drain hose from the bag spout
  { const b = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.32, 32, 1, true), S(0x2f7fd0, { roughness: 0.45, side: THREE.DoubleSide })); body.position.y = 0.16; body.castShadow = true; b.add(body);
    b.add(cy(0.13, 0.01, S(0x2a6fb8), 0, 0.005, 0)); const handle = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.005, 6, 28, Math.PI), black); handle.position.y = 0.32; b.add(handle);
    const water = cy(0.148, 0.01, new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.15, transparent: true, opacity: 0.92 }), 0, 0.05, 0, 28); b.add(water); b.userData.water = water;
    b.position.set(1.62, 0, -1.3); item('bucket', b); }
  // pressure washer pump (small cart) — hose to the gun is dynamic
  { const w = new THREE.Group(); w.add(bx(0.28, 0.22, 0.2, S(0xd8242b, { roughness: 0.4 }), 0, 0.17, 0)); w.add(bx(0.24, 0.05, 0.16, black, 0, 0.3, 0)); w.add(cy(0.012, 0.36, black, -0.13, 0.36, 0)); [-0.1, 0.1].forEach(z => { const wh = cy(0.05, 0.03, black, 0.1, 0.05, z); wh.rotation.x = Math.PI / 2; w.add(wh); });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ map: canvasTex(128, 56, (c, W, H) => { c.fillStyle = '#d8242b'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = '700 22px Arial'; c.textAlign = 'center'; c.fillText('HIGH PRESSURE', W / 2, 34); }) })); tag.position.set(0, 0.18, 0.101); w.add(tag);
    w.position.set(1.95, 0, -1.05); w.rotation.y = -0.4; item('washer', w); w.userData.outlet = V(1.95 + 0.05, 0.2, -1.05 + 0.1); }
  // PCB cover (clear plastic over the right end of the unit) — follows the unit
  { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.28), new THREE.MeshPhysicalMaterial({ color: 0xd9ecff, roughness: 0.15, transparent: true, opacity: 0.4, depthWrite: false })); m.position.set(0.37, 0, 0.01); item('pcb', m); m.userData.attachTo = 'unit'; }
  // cartons
  { const c = new THREE.Group(); const card = S(0xc49a64, { roughness: 0.9 }); const lab = (t, w, h) => new THREE.MeshBasicMaterial({ map: canvasTex(256, 96, (x, W, H) => { x.fillStyle = '#c49a64'; x.fillRect(0, 0, W, H); x.fillStyle = '#23303e'; x.font = '800 34px Arial'; x.textAlign = 'center'; x.fillText('F U J I V A', W / 2, 42); x.font = '600 22px Arial'; x.fillText(t, W / 2, 76); }) });
    const a = bx(1.02, 0.34, 0.34, card, 0, 0.17, 0); c.add(a); const la = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), lab('INDOOR UNIT')); la.position.set(0, 0.18, 0.171); c.add(la);
    const b2 = bx(0.92, 0.66, 0.4, card, 0.02, 0.33, 0.62); c.add(b2); const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), lab('OUTDOOR UNIT')); lb.position.set(0.02, 0.45, 0.821); c.add(lb);
    c.position.set(-1.45, 0, -0.95); c.rotation.y = 0.12; item('boxes', c); }
  // layout marks: blue masking tape along the planned trunk route (install survey)
  { const m = new THREE.Group(); const tape = new THREE.MeshBasicMaterial({ color: 0x2f7fd0, transparent: true, opacity: 0.85 });
    const segs = []; const C = home.lanes.gas.fixed; for (let i = 0; i < C.length - 12; i += 12) segs.push([C[i], C[i + 6]]);
    segs.forEach(([a, b]) => { const d = b.clone().sub(a), L = d.length(); if (L < 0.02) return; const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, L), tape); s.position.copy(a).add(b).multiplyScalar(0.5); s.lookAt(b); m.add(s); });
    item('marks', m); }
  // manifold gauge set hung on the service valve + hoses (to valve, vacuum pump, nitrogen)
  { const mg = new THREE.Group(); const body = bx(0.16, 0.06, 0.05, S(0x2a2f36, { metalness: 0.4, roughness: 0.35 })); mg.add(body);
    const dial = (x, col) => { const d = new THREE.Group(); d.position.set(x, 0.08, 0); const rim = cy(0.045, 0.03, S(col, { roughness: 0.4 })); rim.rotation.x = Math.PI / 2; d.add(rim); const face = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, W, H) => { c.fillStyle = '#f4f4f0'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 2; for (let k = 0; k <= 20; k++) { const a = Math.PI * (0.75 + 1.5 * k / 20); c.beginPath(); c.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); c.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); c.stroke(); } c.fillStyle = col === 0x2f6fd0 ? '#2f6fd0' : '#d0342f'; c.font = '700 16px Arial'; c.textAlign = 'center'; c.fillText(col === 0x2f6fd0 ? 'LOW' : 'HIGH', 64, 96); c.fillText('psi', 64, 40); }) })); face.position.z = 0.0155; d.add(face);
      const needle = bx(0.002, 0.034, 0.002, S(0xd0342f), 0, 0.012, 0.018); d.add(needle); d.userData.needle = needle; mg.add(d); return d; };
    const lo = dial(-0.05, 0x2f6fd0), hi = dial(0.05, 0xd0342f); mg.userData.dials = [lo, hi];
    mg.position.set(home.cdu.x + 0.28, home.cdu.y + 0.36, home.cdu.z + 0.19); mg.rotation.y = 0.35;   // hung from the top front edge of the condensing unit
    const hose = (to, col) => tubeM(smoothPts([mg.position.clone().add(V(-0.04, -0.04, 0.02)), mg.position.clone().add(V(0.02, -0.25, 0.08)), to.clone().add(V(0.14, -0.06, 0.04)), to], 0.05, 0.02), 0.006, S(col, { roughness: 0.5 }), 50);
    const hs = new THREE.Group(); hs.add(hose(home.valve.gas.clone().add(V(0.03, 0.02, -0.02)), 0x2f6fd0));
    mg.userData.hoses = hs; item('gauges', mg); g.add(hs); hs.visible = false; items.gaugeHoses = hs; hs.userData.k = 0; hs.name = 'gaugeHoses'; }
  // vacuum pump (balcony floor) + yellow hose to the manifold
  { const p = new THREE.Group(); p.add(bx(0.3, 0.18, 0.14, S(0xf2c230, { roughness: 0.4 }), 0, 0.12, 0)); { const mo = cy(0.07, 0.2, S(0x3a3f46, { metalness: 0.5, roughness: 0.4 }), -0.05, 0.12, 0); mo.rotation.z = Math.PI / 2; p.add(mo); }   // Rev.09 r3: rotate the motor, not the whole pump p.add(bx(0.24, 0.02, 0.14, black, 0, 0.02, 0)); p.add(bx(0.05, 0.08, 0.02, black, 0.1, 0.25, 0));
    p.position.set(3.35, -0.05, -1.02); item('vac', p);
    const hy = tubeM(smoothPts([V(3.45, 0.22, -1.02), V(3.6, 0.3, -1.15), items.gauges.position.clone().add(V(0, -0.2, 0))], 0.06, 0.02), 0.006, S(0xf2c230), 50); item('vacHose', hy); }
  // nitrogen cylinder + regulator
  { const n = new THREE.Group(); n.add(cy(0.09, 0.95, S(0x3d4a3f, { roughness: 0.5, metalness: 0.3 }), 0, 0.5, 0, 28)); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), S(0x3d4a3f, { roughness: 0.5, metalness: 0.3 })); dome.position.y = 0.975; n.add(dome);
    n.add(cy(0.02, 0.08, S(0xb9bec4, { metalness: 0.8, roughness: 0.3 }), 0, 1.09, 0)); const rg = cy(0.035, 0.03, S(0xc9a44c, { metalness: 0.9, roughness: 0.3 }), 0.04, 1.12, 0); rg.rotation.z = Math.PI / 2; n.add(rg);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (c, W, H) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, W, H); c.fillStyle = '#23303e'; c.font = '800 26px Arial'; c.textAlign = 'center'; c.fillText('N₂', W / 2, 60); c.font = '600 11px Arial'; c.fillText('NITROGEN', W / 2, 90); }) })); lab.position.set(0, 0.6, 0.091); n.add(lab);
    n.position.set(3.05, -0.05, -1.25); item('n2', n);
    const hr = tubeM(smoothPts([V(3.12, 1.05, -1.25), V(3.4, 0.7, -1.3), items.gauges.position.clone().add(V(-0.02, -0.2, 0))], 0.06, 0.02), 0.006, S(0xd0342f), 50); item('n2Hose', hr); }
  // mounting plate level (spirit level) + drill dust (hole)
  { const lv = bx(0.6, 0.035, 0.025, S(0xf2c230), 0.9, 2.36, -1.985); item('level', lv); }

  // animated hose from the washer to the gun in the technician's hand
  const hoseMat = S(0x1d2126, { roughness: 0.55 }); let hoseMesh = null, hoseKey = '';
  function washerHose(to) {
    const from = items.washer.userData.outlet; const key = to ? to.toArray().map(v => v.toFixed(2)).join() : '';
    if (key === hoseKey) return; hoseKey = key; if (hoseMesh) { hoseMesh.geometry.dispose(); g.remove(hoseMesh); hoseMesh = null; }
    if (!to || !items.washer.visible) return;
    const mid = from.clone().lerp(to, 0.5); mid.y = Math.min(from.y, to.y) - 0.05; mid.y = Math.max(0.03, mid.y - 0.4);
    hoseMesh = tubeM([from, V(from.x - 0.1, 0.03, from.z + 0.05), mid, to.clone().add(V(0, -0.25, 0.05)), to], 0.007, hoseMat, 60); g.add(hoseMesh);
  }
  let bagHose = null, bagKey = '';
  function bagHoseTo(spoutW) {
    const key = spoutW && items.bag.visible ? spoutW.toArray().map(v => v.toFixed(2)).join() : '';
    if (key === bagKey) return; bagKey = key; if (bagHose) { bagHose.geometry.dispose(); g.remove(bagHose); bagHose = null; } if (!key) return;
    const b = items.bucket.position; bagHose = tubeM([spoutW, spoutW.clone().add(V(0.05, -0.35, 0.06)), V(b.x - 0.05, 0.6, b.z - 0.02), V(b.x - 0.04, 0.3, b.z)], 0.02, S(0x9bb3c9, { roughness: 0.6, transparent: true, opacity: 0.85 }), 40); g.add(bagHose);
  }
  function show(name, on) { const o = items[name]; if (!o) return; o.userData.want = on ? 1 : 0; }
  function update(dt, unitMatrix) {
    for (const k in items) {
      const o = items[k], w = o.userData.want ?? 0; o.userData.k += (w - o.userData.k) * clamp(dt * 4, 0, 1); if (dt === 0) o.userData.k = w;
      o.visible = o.userData.k > 0.02;
      if (o.userData.attachTo === 'unit' && unitMatrix) { o.matrixAutoUpdate = false; if (!o.userData.local) o.userData.local = o.matrix.clone().compose(o.position, o.quaternion, o.scale); o.matrix.multiplyMatrices(unitMatrix, o.userData.local); }
      const s = 0.6 + 0.4 * ease(clamp(o.userData.k, 0, 1)); if (!o.userData.attachTo) o.scale.setScalar(o.visible ? s : 1);
    }
  }
  return { g, items, show, update, washerHose, bagHoseTo };
}

/* ---------------------------------------------------------------- hand tools (built in the hand frame: grip at origin, points along -y) */
export function handTools() {
  const T = {}, black = S(0x1d2126, { roughness: 0.5 }), steel = S(0xc0c7ce, { metalness: 0.85, roughness: 0.3 });
  const mk = (name, build) => { const g = new THREE.Group(); build(g); g.visible = false; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); T[name] = g; return g; };
  mk('gun', g => { g.add(bx(0.03, 0.1, 0.035, S(0x2b3037, { roughness: 0.4 }), 0, 0.0, 0.0)); const lance = cy(0.006, 0.42, steel, 0, -0.26, 0.03); g.add(lance); g.add(cy(0.012, 0.03, black, 0, -0.47, 0.03)); g.add(bx(0.02, 0.05, 0.02, S(0xe2711d), 0, 0.03, -0.03)); g.userData.tip = V(0, -0.49, 0.03); });
  mk('sprayer', g => { g.add(cy(0.045, 0.2, S(0xf0f0ea, { roughness: 0.3, transparent: true, opacity: 0.85 }), 0, 0.06, 0.04)); g.add(bx(0.05, 0.05, 0.04, S(0x2f7fd0), 0, -0.06, 0.04)); g.add(cy(0.006, 0.06, black, 0, -0.1, 0.04)); g.userData.tip = V(0, -0.13, 0.04); });
  mk('meter', g => { g.add(bx(0.07, 0.16, 0.035, S(0xf2c230, { roughness: 0.5 }), 0, -0.04, 0.02)); const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 20, Math.PI * 1.7), black); jaw.position.set(0, -0.15, 0.02); g.add(jaw);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshBasicMaterial({ color: 0xcfe8d0 })); scr.position.set(0, -0.02, 0.038); g.add(scr); g.userData.screen = scr; });
  mk('probe', g => { g.add(bx(0.045, 0.1, 0.025, S(0x3a78c2), 0, -0.02, 0.02)); g.add(cy(0.003, 0.18, steel, 0, -0.16, 0.02)); g.userData.tip = V(0, -0.25, 0.02); });
  mk('tablet', g => { const t = new THREE.Group(); t.position.set(0.0, -0.06, 0.07); t.rotation.set(-1.25, 0, 0); g.add(t); t.add(bx(0.26, 0.18, 0.01, S(0x1d2126, { roughness: 0.3 })));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), new THREE.MeshBasicMaterial({ map: canvasTex(384, 256, (c, W, H) => { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#1f5fa8'; c.fillRect(0, 0, W, 34); c.fillStyle = '#fff'; c.font = '700 17px Arial'; c.fillText('SBP  Service Report', 12, 23); c.fillStyle = '#23303e'; c.font = '600 13px Arial'; for (let i = 0; i < 8; i++) { c.strokeStyle = '#8fa1b3'; c.strokeRect(14, 48 + i * 24, 13, 13); if (i < 5) { c.strokeStyle = '#1f9a55'; c.lineWidth = 3; c.beginPath(); c.moveTo(16, 55 + i * 24); c.lineTo(20, 60 + i * 24); c.lineTo(26, 50 + i * 24); c.stroke(); c.lineWidth = 1; } c.fillStyle = '#c8d2dc'; c.fillRect(36, 51 + i * 24, 120 + (i * 37) % 150, 8); } }) })); scr.position.z = 0.0055; t.add(scr); });
  mk('remote', g => { g.add(bx(0.045, 0.15, 0.02, S(0xf3f3f0, { roughness: 0.35 }), 0, -0.05, 0.02)); g.add(bx(0.03, 0.03, 0.002, S(0x9fd8f0), 0, -0.1, 0.031)); });
  mk('wrench', g => { g.add(cy(0.011, 0.3, S(0x2b3037, { metalness: 0.6, roughness: 0.35 }), 0, -0.12, 0.02)); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 6, 16, Math.PI * 1.6), steel); hd.position.set(0, -0.29, 0.02); g.add(hd); g.add(bx(0.022, 0.05, 0.022, S(0xe2711d), 0, -0.05, 0.02)); });
  mk('blower', g => { g.add(bx(0.07, 0.12, 0.09, S(0x2f7fd0, { roughness: 0.4 }), 0, 0.0, 0.03)); g.add(cy(0.025, 0.14, black, 0, -0.12, 0.05)); g.userData.tip = V(0, -0.2, 0.05); });
  mk('torch', g => { g.add(cy(0.016, 0.16, black, 0, -0.05, 0.02)); const lens = cy(0.02, 0.01, new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), 0, -0.135, 0.02); g.add(lens); g.userData.tip = V(0, -0.14, 0.02); });
  mk('drill', g => { g.add(bx(0.05, 0.16, 0.06, S(0x1f6fb0, { roughness: 0.4 }), 0, 0.0, 0.05)); g.add(cy(0.03, 0.2, S(0x1f6fb0), 0, -0.1, 0.1)); g.add(cy(0.03, 0.18, steel, 0, -0.29, 0.1)); });
  return T;
}

/* ---------------------------------------------------------------- the technician */
const NODES = { U0: [0.95, -0.85], RB: [1.85, -1.42], R: [2.25, -0.8], D: [2.66, -0.85], B: [3.1, -0.85], CV: [4.36, -1.1], CF: [2.92, -1.38], CL: [2.95, -1.2], FR: [0.95, 0.12], BX: [-0.72, -1.36], BK: [1.45, -1.05] };
const EDGES = [['U0', 'RB'], ['U0', 'R'], ['RB', 'R'], ['R', 'D'], ['D', 'B'], ['B', 'CV'], ['B', 'CF'], ['B', 'CL'], ['CF', 'CV'], ['CF', 'CL'], ['U0', 'FR'], ['FR', 'R'], ['U0', 'BX'], ['BX', 'FR'], ['U0', 'BK'], ['BK', 'RB'], ['BK', 'R']];
export const SPOTS = {    // where the technician works: node + facing (rad; 0 = +z) + activity default
  unit: { n: 'U0', face: Math.PI, ladder: true }, unitFloor: { n: 'U0', face: Math.PI }, breaker: { n: 'RB', face: Math.PI }, bucket: { n: 'BK', face: Math.PI * 0.8 },
  cduValve: { n: 'CV', face: -2.57 }, cduFront: { n: 'CF', face: 1.75 }, cduLeft: { n: 'CL', face: 2.7 }, front: { n: 'FR', face: -1.75 }, boxes: { n: 'BX', face: -1.05 }, door: { n: 'D', face: -Math.PI / 2 },
};
function route(a, b) { // BFS over the small graph
  const adj = {}; EDGES.forEach(([p, q]) => { (adj[p] ||= []).push(q); (adj[q] ||= []).push(p); });
  const prev = { [a]: null }, Q = [a]; while (Q.length) { const n = Q.shift(); if (n === b) break; for (const m of adj[n] || []) if (!(m in prev)) { prev[m] = n; Q.push(m); } }
  const out = []; let n = b; while (n != null) { out.unshift(n); n = prev[n]; } return out[0] === a ? out : [a, b];
}

export function createTech(home, o = {}) {
  const crowd = createCrowd(home.root, { max: 3, shadows: true });
  const TOOLS = handTools(); Object.values(TOOLS).forEach(t => { t.matrixAutoUpdate = false; home.props.add(t); });
  const ladder = o.tools && o.tools.items.ladder;
  const st = { node: 'U0', x: NODES.U0[0], z: NODES.U0[1], y: 0, face: Math.PI, path: [], seg: 0, walkT: 0, spot: 'unitFloor', act: 'idle', tool: null, climb: 0, climbTo: 0, actT: 0 };
  const cust = { mode: 'sofa', k: 0 };
  const floorY = (x) => (x > 2.72 ? -0.05 : 0);
  // rig for the technician
  function rig(Sk, t, dt) {
    const moving = st.path.length > 0;
    const R = Sk.root; R.position.set(st.x, st.y, st.z); R.rotation.set(0, st.face, 0);
    Sk.pelvis.position.set(0, 0.95, 0); Sk.spine.scale.setScalar(1);
    if (moving) { st.walkT += dt * 6.2; gait(Sk, st.walkT, 1); return; }
    const a = st.act, w = Math.sin(t * 5.5), w2 = Math.sin(t * 2.2);
    const set = (n, x = 0, y = 0, z = 0) => n.rotation.set(x, y, z);
    if (st.climb > 0.01 && st.climb < 0.99) { const c = st.climb; set(Sk.hip[0], -0.9 * Math.sin(c * Math.PI * 2) ** 2); set(Sk.kn[0], 1.2 * Math.sin(c * Math.PI * 2) ** 2); set(Sk.hip[1], -0.9 * Math.cos(c * Math.PI * 2) ** 2); set(Sk.kn[1], 1.2 * Math.cos(c * Math.PI * 2) ** 2); set(Sk.sh[0], -1.6); set(Sk.sh[1], -1.6); set(Sk.el[0], -0.4); set(Sk.el[1], -0.4); return; }
    switch (a) {
      case 'reach': case 'work': // both hands up at the unit, working
        set(Sk.sh[0], -2.05 + w * 0.08, 0, 0.08); set(Sk.el[0], -0.45 - w * 0.12); set(Sk.sh[1], -1.95 - w * 0.06, 0, -0.1); set(Sk.el[1], -0.6 + w * 0.1); set(Sk.neck, -0.22); set(Sk.head, -0.1, w2 * 0.1); set(Sk.spine, -0.04); break;
      case 'spray': // right hand on the gun, left steadies the lance, sweeping
        set(Sk.sh[0], -2.0 + w2 * 0.18, w2 * 0.2, 0.05); set(Sk.el[0], -0.35); set(Sk.sh[1], -1.75 + w2 * 0.15, 0.25, -0.2); set(Sk.el[1], -0.95); set(Sk.neck, -0.28); set(Sk.head, -0.1, w2 * 0.15); set(Sk.spine, -0.05, w2 * 0.1); break;
      case 'crouch': // squat at the condensing unit, hands working forward
        Sk.pelvis.position.y = 0.5; set(Sk.hip[0], -1.95, 0, -0.18); set(Sk.hip[1], -1.95, 0, 0.18); set(Sk.kn[0], 2.25); set(Sk.kn[1], 2.25); set(Sk.an[0], -0.3); set(Sk.an[1], -0.3); set(Sk.spine, 0.42);
        set(Sk.sh[0], -1.25 + w * 0.08); set(Sk.el[0], -0.7 + w * 0.1); set(Sk.sh[1], -1.1 - w * 0.06); set(Sk.el[1], -0.8); set(Sk.neck, 0.1); break;
      case 'crouchSpray':
        Sk.pelvis.position.y = 0.52; set(Sk.hip[0], -1.9); set(Sk.hip[1], -1.9); set(Sk.kn[0], 2.2); set(Sk.kn[1], 2.2); set(Sk.an[0], -0.3); set(Sk.an[1], -0.3); set(Sk.spine, 0.3, w2 * 0.1);
        set(Sk.sh[0], -1.45 + w2 * 0.15, w2 * 0.2); set(Sk.el[0], -0.3); set(Sk.sh[1], -1.3, 0.2); set(Sk.el[1], -0.9); break;
      case 'tablet': // reading / writing the form
        set(Sk.sh[0], -0.55); set(Sk.el[0], -1.35 + w * 0.05); set(Sk.sh[1], -0.6, 0, -0.15); set(Sk.el[1], -1.25); set(Sk.wr[0], 0, 0, 0.2); set(Sk.neck, 0.42); set(Sk.head, 0.12); break;
      case 'present': // showing the report to the customer
        set(Sk.sh[0], -0.95); set(Sk.el[0], -0.8); set(Sk.sh[1], -0.9, 0, -0.1); set(Sk.el[1], -0.9); set(Sk.neck, 0.15); set(Sk.head, 0, Math.sin(t * 0.7) * 0.2); break;
      case 'measure': // probe / clamp up to the unit, meter at chest
        set(Sk.sh[0], -2.1 + w2 * 0.05); set(Sk.el[0], -0.25); set(Sk.sh[1], -0.6, 0, -0.1); set(Sk.el[1], -1.35); set(Sk.neck, -0.15); set(Sk.head, -0.1, 0.2); break;
      case 'switch': // breaker at shoulder height
        set(Sk.sh[0], -1.5 + Math.max(0, Math.sin(t * 1.6)) * 0.1); set(Sk.el[0], -0.35); set(Sk.sh[1], -0.2); set(Sk.el[1], -0.3); set(Sk.neck, 0.05); break;
      case 'remote':
        set(Sk.sh[0], -1.3); set(Sk.el[0], -0.45); set(Sk.sh[1], -0.2); set(Sk.el[1], -0.25); set(Sk.neck, -0.2); break;
      case 'carry':
        set(Sk.sh[0], -0.4); set(Sk.el[0], -1.2); set(Sk.sh[1], -0.4); set(Sk.el[1], -1.2); break;
      default: { const sw = Math.sin(t * 0.5); Sk.pelvis.rotation.z = sw * 0.03; set(Sk.sh[0], 0, 0, -0.08); set(Sk.sh[1], 0, 0, 0.08); set(Sk.el[0], -0.2); set(Sk.el[1], -0.2); set(Sk.head, 0, Math.sin(t * 0.3) * 0.4); }
    }
  }
  const people = [
    { x: st.x, z: st.z, pose: 'rig', rig, female: false, colors: { shirt: 0x1b51a4, pants: 0x2b3440, shoe: 0x22262b, cap: 0xef4e2e, longSleeve: true, skin: 0xc99a73, hair: 0x1d1a17 } },
    { x: -0.2, z: 1.33, ry: Math.PI, pose: 'sit', female: true, colors: { shirt: 0xd8d2c4, pants: 0x5a4a3a, skin: 0xe3bd98, hair: 0x2a211b } },
  ];
  crowd.set(people);
  const P = crowd.people();
  // customer: sit on the sofa ↔ stand for the hand-over
  P[1].rig = (Sk, t) => { const k = ease(cust.k); Sk.root.position.set(-0.2 + 0.5 * k, 0, 1.33 - 0.7 * k); Sk.root.rotation.set(0, Math.PI - 1.9 * k, 0); Sk.pelvis.position.set(0, 0.5 + 0.45 * k, 0);
    [Sk.hip[0], Sk.hip[1]].forEach(n => n.rotation.set(-1.5 * (1 - k), 0, 0)); [Sk.kn[0], Sk.kn[1]].forEach(n => n.rotation.set(1.45 * (1 - k), 0, 0)); Sk.sh[0].rotation.set(-0.45 * (1 - k) - 0.6 * k, 0, -0.1); Sk.sh[1].rotation.set(-0.45 * (1 - k), 0, 0.1); Sk.el[0].rotation.set(-0.55 * (1 - k) - 1.0 * k, 0, 0); Sk.el[1].rotation.set(-0.55 * (1 - k) - 0.2 * k, 0, 0); Sk.head.rotation.set(0.1 * k, Math.sin(t * 0.25) * 0.3 * (1 - k), 0); };
  P[1].pose = 'rig';
  // path following
  function goTo(spot, act = 'idle', tool = null, immediate = false) {
    const sp = SPOTS[spot] || SPOTS.unitFloor; st.targetSpot = spot; st.act = act; st.tool = tool; st.faceTo = sp.face; st.climbTo = sp.ladder ? 1 : 0;
    const to = sp.n; if (immediate) { st.node = to; [st.x, st.z] = NODES[to]; st.path = []; st.climb = st.climbTo; st.face = sp.face; return; }
    if (to === st.node && !st.path.length) return;
    st.pendingPath = route(st.path.length ? st.path[st.path.length - 1] : st.node, to);
  }
  function tick(dt, t) {
    // ladder: climb down before walking away, climb up after arriving
    if (st.pendingPath) { if (st.climb > 0.01) { st.climb = Math.max(0, st.climb - dt * 1.3); } else { st.path = st.pendingPath.slice(1); st.pendingPath = null; } }
    if (st.path.length) {
      const [nx, nz] = NODES[st.path[0]], dx = nx - st.x, dz = nz - st.z, d = Math.hypot(dx, dz), sp = 1.15 * dt;
      const want = Math.atan2(dx, dz); st.face += Math.atan2(Math.sin(want - st.face), Math.cos(want - st.face)) * clamp(dt * 7, 0, 1);
      if (d <= sp) { st.x = nx; st.z = nz; st.node = st.path.shift(); } else { st.x += dx / d * sp; st.z += dz / d * sp; }
    } else if (!st.pendingPath) {
      st.face += Math.atan2(Math.sin(st.faceTo - st.face), Math.cos(st.faceTo - st.face)) * clamp(dt * 5, 0, 1);
      if (st.climbTo > st.climb) st.climb = Math.min(1, st.climb + dt * 1.1); else if (st.climbTo < st.climb) st.climb = Math.max(0, st.climb - dt * 1.3);
    }
    // position on the ladder
    const lst = ladder && ladder.userData.step; const c = ease(st.climb);
    const base = floorY(st.x);
    if (lst && st.node === 'U0' && !st.path.length) { st.y = base + c * lst.y; st.z = NODES.U0[1] + (lst.z - NODES.U0[1]) * c; } else st.y = base;
    cust.k += ((cust.mode === 'stand' ? 1 : 0) - cust.k) * clamp(dt * 1.5, 0, 1);
    crowd.update(dt, t, null);
    // tools in the right hand (wrist 0)
    const Sk = P[0].sk; Sk.wr[0].updateMatrixWorld(true);
    for (const k in TOOLS) { const tl = TOOLS[k]; tl.visible = k === st.tool && !st.path.length && st.climb >= st.climbTo - 0.02; if (tl.visible) { tl.matrix.copy(Sk.wr[0].matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, -0.05, 0.0)); } }
    if (marks) { Sk.spine.updateMatrixWorld(true); marks.chest.matrix.copy(Sk.spine.matrixWorld).multiply(marks.oc); marks.back.matrix.copy(Sk.spine.matrixWorld).multiply(marks.ob); marks.chest.material.opacity = marks.back.material.opacity = ghost; }
  }
  // ghost: fade the technician when the camera looks past him at the work (valves, close-ups)
  let ghost = 1, ghostT = 1; const crowdMats = []; crowd.group.traverse(o => { if (o.isMesh && !crowdMats.includes(o.material)) crowdMats.push(o.material); });
  // Rev.09 r4: uniform marks (small "SBP AirCare" on the chest, company line on the back) — same decals as the crew in the job scene
  const mk = (tx, w, hh) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); d.matrixAutoUpdate = false; d.renderOrder = 3; crowd.group.add(d); return d; };
  const marks = { chest: mk(chestTex(), 0.085, 0.042), back: mk(backTex(), 0.25, 0.125), oc: new THREE.Matrix4().makeTranslation(0.07, 0.36, 0.1), ob: new THREE.Matrix4().makeRotationY(Math.PI).premultiply(new THREE.Matrix4().makeTranslation(0, 0.3, -0.1)) };
  function stepGhost(dt) { if (Math.abs(ghost - ghostT) < 0.005) return; ghost += (ghostT - ghost) * Math.min(1, dt * 4 || 1); const on = ghost < 0.98; crowdMats.forEach(m => { m.transparent = on; m.opacity = ghost; m.depthWrite = !on; m.needsUpdate = true; }); }
  const tip = new THREE.Vector3();
  return {
    setGhost(k) { ghostT = k; }, stepGhost,
    crowd, tools: TOOLS, st, goTo, tick,
    customer(mode) { cust.mode = mode; },
    toolTip(name) { const tl = TOOLS[name]; if (!tl || !tl.visible || !tl.userData.tip) return null; return tip.copy(tl.userData.tip).applyMatrix4(tl.matrix); },
    get busy() { return st.path.length > 0 || !!st.pendingPath || Math.abs(st.climb - st.climbTo) > 0.02; },
    hand() { return P[0].sk.wr[0].getWorldPosition(new THREE.Vector3()); },
  };
}
