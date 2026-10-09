// SBP AirCare — Room Studio 3D: procedural rooms (home / office / shop / industrial), AC units of every type,
// airflow particles whose throw shrinks as the unit gets dirty, floating dust, floor temperature map.
// All visuals are illustrative. Production: replace furniture with GLB sets per scene; keep this API.
import * as THREE from './three.module.min.js';
import { track as glTrack, disposeLater, freeGeometry, warm, whenCalm } from './gl-pool.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { materialSet, orbit, canvasTex } from './ac3d.js';
import { buildWallUnit, buildCeilingUnit, buildCassetteUnit, animateUnit } from './units3d.js';
import { ORIENT_BY_ID, GLASS, TYPE_RULES } from './studio-model.js';
import { createCrowd, freePath } from './people3d.js';
import { createAirflow } from './airflow3d.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------- textures ---------------- */
const floorTex = (kind, base) => canvasTex(256, 256, (g, w, h) => {
  const c = new THREE.Color(base);
  const hex = k => '#' + c.clone().offsetHSL(0, 0, k).getHexString();
  g.fillStyle = hex(0); g.fillRect(0, 0, w, h);
  if (kind === 'wood') {
    for (let y = 0; y < h; y += 32) { g.fillStyle = hex((y / 32 % 2 ? -0.03 : 0.02)); g.fillRect(0, y, w, 31); g.fillStyle = hex(-0.08); g.fillRect(0, y + 31, w, 1); const o = (y * 53) % w; g.fillRect(o, y, 1, 31); }
  } else if (kind === 'tile') {
    g.fillStyle = hex(-0.06); for (let i = 0; i <= w; i += 64) { g.fillRect(i, 0, 2, h); g.fillRect(0, i, w, 2); }
  } else if (kind === 'carpet') {
    for (let i = 0; i < 1400; i++) { g.fillStyle = hex((Math.random() - 0.5) * 0.05); g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = hex(-0.04); for (let i = 0; i <= w; i += 128) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
  } else if (kind === 'concrete') {
    for (let i = 0; i < 900; i++) { g.fillStyle = hex((Math.random() - 0.5) * 0.07); const r = 1 + Math.random() * 3; g.fillRect(Math.random() * w, Math.random() * h, r, r); }
    g.fillStyle = 'rgba(230,190,40,.9)'; g.fillRect(0, h * 0.48, w, 6);
  } else if (kind === 'rubber') {
    for (let i = 0; i < 900; i++) { g.fillStyle = hex((Math.random() - 0.5) * 0.06); g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    g.fillStyle = hex(0.05); for (let i = 0; i <= w; i += 128) { g.fillRect(i, 0, 2, h); g.fillRect(0, i, w, 2); }
  } else if (kind === 'grid') {
    g.strokeStyle = 'rgba(18,63,123,.18)'; g.lineWidth = 1; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  }
});
const FLOOR_KIND = { bedroom: 'wood', master: 'wood', living: 'wood', kitchen: 'tile', study: 'wood', bath: 'tile', openoffice: 'carpet', exec: 'wood', meeting: 'carpet', server: 'tile', shop: 'tile', restaurant: 'wood', clinic: 'tile', factory: 'concrete', warehouse: 'concrete', control: 'carpet', dining: 'wood', hotel: 'carpet', classroom: 'tile', ward: 'tile',
  kids: 'wood', condostudio: 'wood', condobed: 'wood', condoliving: 'wood', reception: 'tile', printroom: 'tile', minimart: 'tile', cafe: 'wood', gym: 'rubber', salon: 'tile', spa: 'wood', karaoke: 'carpet', netcafe: 'carpet', dental: 'tile', laundry: 'tile', lobby: 'tile', ballroom: 'carpet', buffet: 'wood', complab: 'tile', library: 'wood', auditorium: 'carpet', canteen: 'tile', dorm: 'tile', opd: 'tile', medlab: 'tile', orroom: 'tile', fcanteen: 'tile', foffice: 'carpet' };
const compassTex = (() => { const c = {}; return dark => c[dark] || (c[dark] = canvasTex(256, 256, (g, w, h) => {
  const ink = dark ? 'rgba(220,232,245,.85)' : 'rgba(30,45,64,.8)'; g.clearRect(0, 0, w, h);
  g.strokeStyle = ink; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 84, 0, 7); g.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84); g.lineTo(128 + Math.cos(a) * 110, 128 + Math.sin(a) * 110); g.stroke(); }
  g.fillStyle = '#e2552c'; g.beginPath(); g.moveTo(128, 22); g.lineTo(150, 128); g.lineTo(106, 128); g.closePath(); g.fill();
  g.fillStyle = ink; g.beginPath(); g.moveTo(128, 234); g.lineTo(150, 128); g.lineTo(106, 128); g.closePath(); g.fill();
})); })();
const sprite = (() => { let t; return () => t || (t = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); })();

/* ---------------- point sprites with per-vertex alpha ---------------- */
function pointsMat(additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: `attribute float alpha; attribute float psize; attribute vec3 pcol; varying float vA; varying vec3 vC; uniform float uScale;
      void main(){ vC=pcol; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(1.0, psize*uScale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d)*vA; gl_FragColor=vec4(vC,a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
function makePoints(count, additive) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('pcol', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(count), 1));
  g.setAttribute('psize', new THREE.BufferAttribute(new Float32Array(count), 1));
  const p = new THREE.Points(g, pointsMat(additive)); p.frustumCulled = false; p.renderOrder = 5;
  return p;
}

/* ---------------- palette per site theme ---------------- */
function palette(theme) {
  const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o });
  if (theme === 'blueprint') {
    const L = c => new THREE.MeshLambertMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const w = L(0xf7f9fc), b = L(0xe8eef6), a = L(0xdfe8f4);
    return { theme, edges: true, wood: b, wood2: a, fabric: a, fabric2: b, white: w, dark: L(0xc7d4e6), metal: b, glass: new THREE.MeshLambertMaterial({ color: 0xcfe0f3, transparent: true, opacity: 0.5 }), accent: L(0xf4c9a8), green: L(0xd5e6d8), screen: L(0x9fb3cf), skin: L(0xd9e2ee), person: L(0x9fb3cf), rack: L(0xc7d4e6), machine: L(0xdfe8f4), yellow: L(0xf4e2a8), shell: w, edgeMat: new THREE.LineBasicMaterial({ color: 0x123f7b, transparent: true, opacity: 0.45 }) };
  }
  const dark = theme === 'dark';
  return {
    theme, edges: false,
    wood: S(0x9b7653, { roughness: 0.6 }), wood2: S(0x6e5440, { roughness: 0.55 }), fabric: S(dark ? 0x5b6675 : 0x8d99a8, { roughness: 0.95 }), fabric2: S(0xd9d2c7, { roughness: 0.95 }),
    white: S(0xf3f4f6, { roughness: 0.5 }), dark: S(0x2c3139, { roughness: 0.5 }), metal: S(0xaab3bd, { metalness: 0.6, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0 }),
    accent: S(0xe2711d, { roughness: 0.6 }), green: S(0x4f8a57, { roughness: 0.9 }), screen: new THREE.MeshBasicMaterial({ color: dark ? 0x3aa6ff : 0x1c2a3a }),
    skin: S(0xd8b08c), person: S(dark ? 0x6d7a8c : 0x3e4a5a, { roughness: 0.8 }), rack: S(0x1f252d, { roughness: 0.45, metalness: 0.3 }),
    machine: S(0xcfd6db, { roughness: 0.5, metalness: 0.2 }), yellow: S(0xe8b923, { roughness: 0.6 }), shell: S(0xf6f7f9, { roughness: 0.3 }), edgeMat: null,
  };
}

/* ---------------- furniture builders ---------------- */
// Each builder gets a context and pushes meshes + heat spots + seats. Coordinates: back wall z=-d/2, left wall x=-w/2, floor y=0.
function Kit(g, P) {
  const add = m => { m.castShadow = true; m.receiveShadow = true; g.add(m); if (P.edges && m.geometry) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), P.edgeMat); e.position.copy(m.position); e.rotation.copy(m.rotation); e.scale.copy(m.scale); g.add(e); } return m; };
  return {
    g, add,
    box: (w, h, d, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.rotation.y = ry; return add(m); },
    cyl: (r, h, mat, x, y, z, seg = 18, r2) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 ?? r, h, seg), mat); m.position.set(x, y + h / 2, z); return add(m); },
    sph: (r, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); return add(m); },
  };
}
// kit bound to a sub-group placed at (x, z) and turned by ry — lets composite furniture rotate as one piece
function sub(g, P, x, z, ry = 0) { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); return Kit(s, P); }
const loc = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
function sofa(g, K, P, x, z, len, ry = 0, mat = P.fabric) { const S = sub(g, P, x, z, ry); S.box(len, 0.42, 0.9, mat, 0, 0, 0); S.box(len, 0.45, 0.2, mat, 0, 0.42, -0.35); S.box(0.18, 0.62, 0.9, mat, -len / 2 + 0.09, 0, 0); S.box(0.18, 0.62, 0.9, mat, len / 2 - 0.09, 0, 0); for (let i = 0; i < Math.round(len / 0.7); i++) S.box(0.5, 0.12, 0.5, P.fabric2, -len / 2 + 0.45 + i * 0.7, 0.42, -0.05); }
function bed(g, K, P, x, z, bw, bl, ry = 0, head = true) { const S = sub(g, P, x, z, ry); S.box(bw + 0.08, 0.32, bl + 0.05, P.wood, 0, 0, 0); S.box(bw, 0.2, bl, P.white, 0, 0.32, 0); S.box(bw + 0.02, 0.06, bl * 0.58, P.fabric, 0, 0.52, bl * 0.2); if (head) S.box(bw + 0.08, 0.95, 0.07, P.wood2, 0, 0, -bl / 2 - 0.02); [-1, 1].forEach(k => bw > 1.2 || k < 0 ? S.box(Math.min(0.6, bw * 0.4), 0.12, 0.34, P.fabric2, bw > 1.2 ? k * bw * 0.24 : 0, 0.52, -bl / 2 + 0.28) : 0); }
function counter(g, K, P, x, z, cw, cd, ch, ry = 0, top = P.dark, body = P.white) { const S = sub(g, P, x, z, ry); S.box(cw, ch - 0.04, cd, body, 0, 0, 0); S.box(cw + 0.02, 0.04, cd + 0.02, top, 0, ch - 0.04, 0); }
function products(S, P, w, y, d, n, z = 0) { const cols = [P.accent, P.fabric2, P.green, P.yellow, P.fabric]; for (let i = 0; i < n; i++) S.box(w / n * 0.8, 0.22, d * 0.8, cols[i % cols.length], -w / 2 + (i + 0.5) * w / n, y, z); }
function gondola(g, K, P, x, z, len, ry = 0) { const S = sub(g, P, x, z, ry); S.box(len, 1.6, 0.08, P.metal, 0, 0, 0); for (let lv = 0; lv < 4; lv++) { S.box(len, 0.03, 0.9, P.white, 0, 0.18 + lv * 0.4, 0); products(S, P, len, 0.21 + lv * 0.4, 0.35, Math.round(len * 5), -0.22); products(S, P, len, 0.21 + lv * 0.4, 0.35, Math.round(len * 5), 0.22); } }
function openFridge(g, K, P, x, z, len, ry = 0) { const S = sub(g, P, x, z, ry); S.box(len, 2.0, 0.8, P.white, 0, 0, 0); S.box(len - 0.1, 1.5, 0.02, P.glass, 0, 0.3, 0.41); for (let lv = 0; lv < 4; lv++) products(S, P, len - 0.2, 0.35 + lv * 0.36, 0.5, Math.round(len * 6), 0.05); S.box(len, 0.12, 0.1, P.accent, 0, 1.9, 0.4); }
function treadmill(g, K, P, x, z, ry = 0) { const S = sub(g, P, x, z, ry); S.box(0.8, 0.22, 1.9, P.dark, 0, 0, 0); S.box(0.55, 0.03, 1.6, P.rack, 0, 0.22, 0.05); S.box(0.06, 1.2, 0.06, P.metal, -0.36, 0.2, -0.8); S.box(0.06, 1.2, 0.06, P.metal, 0.36, 0.2, -0.8); S.box(0.8, 0.3, 0.2, P.dark, 0, 1.3, -0.82); S.box(0.3, 0.18, 0.02, P.screen, 0, 1.36, -0.71); }
function washer(g, K, P, x, z, ry = 0, stack = false) { const S = sub(g, P, x, z, ry); [0, stack ? 0.9 : null].forEach(y => { if (y == null) return; S.box(0.68, 0.86, 0.7, P.white, 0, y, 0); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24), P.glass); d.rotation.x = Math.PI / 2; d.position.set(0, y + 0.45, 0.36); S.add(d); S.box(0.5, 0.06, 0.02, P.screen, 0, y + 0.77, 0.36); }); }
function bookshelf(g, K, P, x, z, len, hgt, ry = 0) { const S = sub(g, P, x, z, ry); S.box(len, hgt, 0.35, P.wood, 0, 0, 0); const cols = [P.accent, P.fabric, P.green, P.yellow, P.fabric2, P.dark]; const lv = Math.floor(hgt / 0.38); for (let l = 0; l < lv; l++) for (let i = 0; i < Math.floor(len / 0.12); i++) if ((i * 7 + l * 3) % 9) S.box(0.09, 0.26 + ((i * 13) % 5) * 0.012, 0.24, cols[(i + l) % cols.length], -len / 2 + 0.08 + i * 0.12, 0.05 + l * 0.38, 0.06); }
function bunk(g, K, P, x, z, ry = 0) { const S = sub(g, P, x, z, ry); [0, 1.1].forEach(y => { S.box(0.95, 0.12, 2.0, P.metal, 0, y + 0.3, 0); S.box(0.9, 0.14, 1.95, P.white, 0, y + 0.42, 0); S.box(0.92, 0.05, 1.1, P.fabric, 0, y + 0.56, 0.35); }); [[-0.46, -0.98], [0.46, -0.98], [-0.46, 0.98], [0.46, 0.98]].forEach(([a, b]) => S.box(0.05, 1.9, 0.05, P.metal, a, 0, b)); }
function seatRows(g, K, P, x0, z0, cols, rows, dx, dz, step, seats, mat = P.fabric, ry = Math.PI) { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = x0 + c * dx, z = z0 + r * dz, y = r * step; if (step) K.box(dx * 0.98, y, dz * 0.98, P.wood2, x, 0, z); const S = sub(g, P, x, z, ry); S.box(0.48, 0.08, 0.46, mat, 0, y + 0.42, 0); S.box(0.48, 0.5, 0.06, mat, 0, y + 0.46, 0.22); seats.push([x, z, 'sit', ry, y]); } }
function chair(K, P, x, z, ry = 0, mat = P.fabric) { const c = Math.cos(ry), s = Math.sin(ry); K.box(0.46, 0.08, 0.46, mat, x, 0.42, z, ry); K.box(0.46, 0.45, 0.07, mat, x - s * 0.2, 0.5, z - c * 0.2, ry); K.cyl(0.03, 0.42, P.metal, x, 0, z, 8); }
function desk(K, P, x, z, w = 1.4, d = 0.7, ry = 0, screens = 1) { K.box(w, 0.04, d, P.white, x, 0.72, z, ry); K.box(0.04, 0.72, d * 0.9, P.metal, x - w / 2 + 0.05, 0, z, ry); K.box(0.04, 0.72, d * 0.9, P.metal, x + w / 2 - 0.05, 0, z, ry);
  for (let i = 0; i < screens; i++) { const off = (i - (screens - 1) / 2) * 0.58; K.box(0.54, 0.34, 0.03, P.screen, x + Math.cos(ry) * off, 0.9, z - Math.cos(ry) * d * 0.3 + Math.sin(ry) * off * 0, ry); } }
function plant(K, P, x, z, s = 1) { K.cyl(0.16 * s, 0.34 * s, P.white, x, 0, z, 14, 0.12 * s); K.sph(0.32 * s, P.green, x, 0.62 * s, z); }
function shelf(K, P, x, z, w, h, d, ry = 0, mat = P.wood) { K.box(w, h, d, mat, x, 0, z, ry); }
function rack(K, P, x, z) { K.box(0.6, 2.0, 1.0, P.rack, x, 0, z); for (let i = 0; i < 6; i++) K.box(0.5, 0.02, 0.02, P.accent, x, 0.3 + i * 0.28, z + 0.51); }
function machine(K, P, x, z, l = 2.6, hgt = 1.5) { K.box(l, hgt, 1.2, P.machine, x, 0, z); K.box(l * 0.3, 0.5, 0.05, P.screen, x - l * 0.25, hgt * 0.45, z + 0.62); K.box(l, 0.12, 1.24, P.yellow, x, hgt - 0.12, z); K.box(0.9, 0.1, 0.5, P.metal, x + l / 2 + 0.6, 0.85, z); }

const FURN = {
  bedroom(K, P, S) { const { w, d } = S; const bx = w * 0.18, bz = -d / 2 + 1.05;
    K.box(1.8, 0.32, 2.05, P.wood, bx, 0, bz); K.box(1.72, 0.2, 1.95, P.white, bx, 0.32, bz); K.box(1.72, 0.06, 1.2, P.fabric, bx, 0.52, bz + 0.35); K.box(1.8, 0.9, 0.08, P.wood2, bx, 0, -d / 2 + 0.05);
    K.box(0.6, 0.12, 0.35, P.fabric2, bx - 0.42, 0.52, bz - 0.72); K.box(0.6, 0.12, 0.35, P.fabric2, bx + 0.42, 0.52, bz - 0.72);
    K.box(0.45, 0.5, 0.4, P.wood2, bx - 1.2, 0, -d / 2 + 0.25); K.box(0.45, 0.5, 0.4, P.wood2, bx + 1.2, 0, -d / 2 + 0.25);
    K.box(0.6, 2.2, 1.4, P.wood, -w / 2 + 0.32, 0, d / 2 - 0.8); K.box(1.6, 0.01, 1.2, P.fabric, bx - 0.2, 0, bz + 1.5);
    return { seats: [[bx - 0.4, bz + 0.2, 'lie'], [bx + 0.4, bz + 0.2, 'lie'], [-w * 0.1, d * 0.3]], heat: [] }; },
  master(K, P, S) { const r = FURN.bedroom(K, P, S); const { w, d } = S; K.box(1.6, 0.5, 0.45, P.wood2, w / 2 - 1.0, 0, d / 2 - 0.4); K.box(1.3, 0.75, 0.05, P.screen, w / 2 - 1.0, 0.8, d / 2 - 0.4); chair(K, P, w / 2 - 1.1, -d / 2 + 0.9, -0.6, P.fabric2); plant(K, P, w / 2 - 0.4, -d / 2 + 0.4); return r; },
  living(K, P, S) { const { w, d } = S;
    K.box(2.4, 0.45, 0.45, P.wood2, w * 0.1, 0, -d / 2 + 0.28); K.box(1.9, 1.05, 0.05, P.screen, w * 0.1, 0.9, -d / 2 + 0.12);
    const sz = d * 0.22; K.box(2.6, 0.42, 0.95, P.fabric, w * 0.1, 0, sz); K.box(2.6, 0.45, 0.2, P.fabric, w * 0.1, 0.42, sz + 0.38); K.box(0.95, 0.42, 1.8, P.fabric, w * 0.1 + 1.75, 0, sz - 0.4);
    K.box(1.1, 0.38, 0.6, P.wood, w * 0.1, 0, sz - 1.1); K.box(2.6, 0.01, 1.9, P.fabric2, w * 0.1, 0, sz - 0.9); chair(K, P, -w / 2 + 1.1, sz - 0.9, 1.3, P.fabric2);
    plant(K, P, w / 2 - 0.45, -d / 2 + 0.45, 1.2); plant(K, P, -w / 2 + 0.5, -d / 2 + 0.5); K.box(0.4, 2.0, 1.2, P.wood, w / 2 - 0.3, 0, d * 0.05);
    return { seats: [[w * 0.1 - 0.7, sz, 'sit', Math.PI], [w * 0.1, sz, 'sit', Math.PI], [w * 0.1 + 0.7, sz, 'sit', Math.PI], [w * 0.1 + 1.75, sz - 0.7, 'sit', -Math.PI / 2], [-w / 2 + 1.1, sz - 0.9, 'sit', 1.3], [0, d * 0.4]], heat: [{ x: w * 0.1, z: -d / 2 + 0.4, r: 0.6, a: 0.6, lab: 'ทีวี' }] }; },
  kitchen(K, P, S) { const { w, d } = S; const cx = -w / 2 + 0.33;
    K.box(0.65, 0.9, d * 0.75, P.white, cx, 0, -d * 0.1); K.box(0.66, 0.04, d * 0.75, P.dark, cx, 0.9, -d * 0.1); K.box(0.6, 0.02, 0.6, P.dark, cx, 0.94, -d * 0.18);
    K.box(0.4, 0.5, 0.9, P.metal, cx - 0.05, 1.7, -d * 0.18); K.box(0.7, 1.9, 0.7, P.metal, cx + 0.03, 0, d * 0.32);
    K.box(0.35, 0.7, d * 0.75, P.white, cx - 0.12, 1.55, -d * 0.1);
    K.box(1.6, 0.04, 0.9, P.wood, w * 0.15, 0.74, d * 0.05); K.box(1.4, 0.74, 0.1, P.wood2, w * 0.15, 0, d * 0.05);
    [[-0.45, -0.6, 0], [0.45, -0.6, 0], [-0.45, 0.7, Math.PI], [0.45, 0.7, Math.PI]].forEach(([a, b, r]) => chair(K, P, w * 0.15 + a, d * 0.05 + b, r, P.wood2));
    return { seats: [[w * 0.15 - 0.45, d * 0.05 - 0.6, 'sit', 0], [w * 0.15 + 0.45, d * 0.05 + 0.7, 'sit', Math.PI], [cx + 0.7, -d * 0.18, 'stand', -Math.PI / 2], [w * 0.15 + 0.45, d * 0.05 - 0.6, 'sit', 0]], heat: [{ x: cx + 0.3, z: -d * 0.18, r: 0.9, a: 3.2, lab: 'เตา · ไอน้ำมัน' }, { x: cx + 0.3, z: d * 0.32, r: 0.5, a: 0.8, lab: 'ตู้เย็น' }] }; },
  study(K, P, S) { const { w, d } = S; desk(K, P, w * 0.12, -d / 2 + 0.45, 1.5, 0.7, 0, 2); chair(K, P, w * 0.12, -d / 2 + 1.15, Math.PI);
    shelf(K, P, -w / 2 + 0.2, 0, 0.35, 2.0, 1.4, 0); plant(K, P, w / 2 - 0.4, d / 2 - 0.5); K.box(1.2, 0.01, 1.0, P.fabric, w * 0.1, 0, 0.2);
    return { seats: [[w * 0.12, -d / 2 + 1.1, 'sit', Math.PI]], heat: [{ x: w * 0.12, z: -d / 2 + 0.5, r: 0.7, a: 1.6, lab: 'คอมพิวเตอร์ + จอ 2 จอ' }] }; },
  bath(K, P, S) { const { w, d } = S;
    K.box(1.2, 0.85, 0.5, P.white, w * 0.18, 0, -d / 2 + 0.26); K.box(1.0, 0.8, 0.03, P.glass, w * 0.18, 1.1, -d / 2 + 0.03);
    K.box(0.9, 2.0, 0.03, P.glass, w / 2 - 1.0, 0, d * 0.05); K.box(0.9, 0.03, 0.9, P.white, w / 2 - 0.55, 0, -d * 0.25 + 0.2);
    K.box(0.55, 2.1, 1.6, P.wood, -w / 2 + 0.3, 0, d * 0.1); K.box(0.4, 0.45, 0.4, P.fabric2, -w * 0.05, 0, d * 0.25);
    return { seats: [[-w * 0.05, d * 0.1]], heat: [{ x: w / 2 - 0.55, z: -d * 0.1, r: 0.8, a: 1.2 }] }; },
  openoffice(K, P, S) { const { w, d } = S; const seats = [], heat = [];
    const cols = Math.max(1, Math.floor((w - 3) / 3.4)), rows = Math.max(1, Math.floor((d - 3) / 3.2));
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = -w / 2 + 2.2 + c * ((w - 3.6) / Math.max(1, cols - 1 || 1)), z = -d / 2 + 2.0 + r * ((d - 3.6) / Math.max(1, rows - 1 || 1));
      desk(K, P, x - 0.72, z - 0.4, 1.4, 0.7, 0, 1); desk(K, P, x + 0.72, z - 0.4, 1.4, 0.7, 0, 1); desk(K, P, x - 0.72, z + 0.4, 1.4, 0.7, Math.PI, 1); desk(K, P, x + 0.72, z + 0.4, 1.4, 0.7, Math.PI, 1);
      K.box(2.9, 0.4, 0.04, P.fabric, x, 0.76, z);
      [[-0.72, -1.0, 0], [0.72, -1.0, 0], [-0.72, 1.0, Math.PI], [0.72, 1.0, Math.PI]].forEach(([a, b, ry]) => { chair(K, P, x + a, z + b, ry); seats.push([x + a, z + b, 'sit', ry]); });
      heat.push({ x, z, r: 1.3, a: 1.0, lab: heat.length ? null : 'คอมพิวเตอร์ทุกโต๊ะ' });
    }
    plant(K, P, w / 2 - 0.6, -d / 2 + 0.6, 1.3); plant(K, P, -w / 2 + 0.6, d / 2 - 0.8, 1.3); K.box(0.6, 1.1, 0.6, P.white, w / 2 - 0.5, 0, d / 2 - 1.2);
    K.box(3.5, 2.4, 2.4, P.glass, -w / 2 + 2.0, 0, d / 2 - 1.4); K.box(1.6, 0.04, 0.8, P.wood, -w / 2 + 2.0, 0.72, d / 2 - 1.4);
    return { seats, heat }; },
  exec(K, P, S) { const { w, d } = S;
    K.box(2.0, 0.05, 0.9, P.wood2, w * 0.1, 0.74, -d / 2 + 1.3); K.box(1.9, 0.72, 0.8, P.wood2, w * 0.1, 0, -d / 2 + 1.3); K.box(0.6, 0.36, 0.03, P.screen, w * 0.1 - 0.4, 0.8, -d / 2 + 1.1);
    chair(K, P, w * 0.1, -d / 2 + 0.6, 0, P.dark); chair(K, P, w * 0.1 - 0.5, -d / 2 + 2.2, Math.PI, P.fabric2); chair(K, P, w * 0.1 + 0.5, -d / 2 + 2.2, Math.PI, P.fabric2);
    K.box(2.4, 2.2, 0.4, P.wood, w * 0.1, 0, -d / 2 + 0.2); K.box(2.2, 0.42, 0.9, P.dark, -w / 2 + 1.3, 0, d / 2 - 1.0); K.box(0.9, 0.35, 0.6, P.wood, -w / 2 + 1.3, 0, d / 2 - 2.0);
    plant(K, P, w / 2 - 0.5, d / 2 - 0.6, 1.3); K.box(3.0, 0.01, 2.0, P.fabric, -w / 2 + 1.4, 0, d / 2 - 1.5);
    return { seats: [[w * 0.1, -d / 2 + 0.65, 'sit', 0], [w * 0.1 - 0.5, -d / 2 + 2.2, 'sit', Math.PI], [-w / 2 + 1.0, d / 2 - 1.0, 'sit', Math.PI]], heat: [{ x: w * 0.1, z: -d / 2 + 1.2, r: 0.8, a: 0.8 }] }; },
  meeting(K, P, S) { const { w, d } = S; const L = Math.min(w - 2.6, 5.2), seats = [];
    K.box(L, 0.05, 1.4, P.wood2, 0, 0.74, 0.2); K.box(L - 0.6, 0.72, 0.6, P.wood2, 0, 0, 0.2);
    const per = Math.max(2, Math.floor(L / 0.85)); for (let i = 0; i < per; i++) { const x = -L / 2 + 0.45 + i * ((L - 0.9) / Math.max(1, per - 1)); chair(K, P, x, 0.2 - 1.0, 0, P.dark); chair(K, P, x, 0.2 + 1.0, Math.PI, P.dark); seats.push([x, -0.8, 'sit', 0], [x, 1.2, 'sit', Math.PI]); }
    K.box(2.4, 1.35, 0.06, P.screen, 0, 1.0, -d / 2 + 0.08); K.box(2.0, 0.8, 0.45, P.wood, w / 2 - 1.3, 0, -d / 2 + 0.3); plant(K, P, -w / 2 + 0.5, -d / 2 + 0.5, 1.1);
    return { seats, heat: [{ x: 0, z: 0.2, r: 2.0, a: 1.2 }, { x: 0, z: -d / 2 + 0.3, r: 0.6, a: 0.9 }] }; },
  server(K, P, S) { const { w, d } = S; const heat = [];
    const n = Math.max(2, Math.floor((w - 1.4) / 0.62)); for (let i = 0; i < n; i++) { const x = -w / 2 + 0.9 + i * 0.62; rack(K, P, x, -0.1); heat.push({ x, z: 0.5, r: 0.7, a: 3.0, lab: i ? null : 'ตู้ Server · ความร้อนตลอด 24 ชม.' }); }
    K.box(0.5, 1.2, 0.3, P.white, w / 2 - 0.4, 0, d / 2 - 0.5); K.box(w - 1.2, 0.08, 0.3, P.yellow, 0, 2.3, -0.1);
    return { seats: [[w / 2 - 0.8, d / 2 - 0.8]], heat }; },
  shop(K, P, S) { const { w, d } = S; const seats = [];
    for (let i = 0; i < 3; i++) { K.box(0.45, 2.2, w * 0.18, P.white, -w / 2 + 0.25, 0, -d / 2 + 1.5 + i * (d * 0.28)); }
    K.box(w * 0.6, 2.2, 0.45, P.white, w * 0.05, 0, -d / 2 + 0.25); for (let i = 0; i < 6; i++) K.box(0.4, 0.3, 0.35, P.accent, -w * 0.2 + i * 0.8, 1.2, -d / 2 + 0.3);
    [[-1.5, -0.5], [1.2, -0.5], [-1.5, 1.8], [1.2, 1.8]].forEach(([x, z]) => { K.box(1.5, 0.8, 0.9, P.wood, x, 0, z); K.box(0.3, 0.25, 0.3, P.accent, x - 0.4, 0.8, z); K.box(0.3, 0.35, 0.3, P.fabric2, x + 0.3, 0.8, z); });
    K.box(2.0, 1.05, 0.6, P.wood2, w / 2 - 1.6, 0, d / 2 - 1.4); seats.push([w / 2 - 1.6, d / 2 - 2.0], [-0.2, 0.6], [2.0, 0.8], [-2.4, 2.8], [0.6, 3.0], [2.8, -1.4], [-0.4, -1.6], [3.0, 2.6], [-3.0, 0.4], [1.5, 3.2]);
    return { seats, heat: [{ x: 0, z: -d / 2 + 0.4, r: 1.6, a: 0.7 }] }; },
  restaurant(K, P, S) { const { w, d } = S; const seats = [];
    K.box(w * 0.45, 1.05, 0.7, P.wood2, w * 0.18, 0, -d / 2 + 0.5); K.box(w * 0.45, 0.05, 0.75, P.dark, w * 0.18, 1.05, -d / 2 + 0.5);
    const cols = Math.max(2, Math.floor((w - 2) / 2.2)), rows = Math.max(2, Math.floor((d - 2.4) / 2.0));
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const x = -w / 2 + 1.4 + c * ((w - 2.8) / Math.max(1, cols - 1)), z = -d / 2 + 2.4 + r * ((d - 3.4) / Math.max(1, rows - 1));
      K.cyl(0.42, 0.04, P.wood, x, 0.74, z, 20); K.cyl(0.05, 0.74, P.metal, x, 0, z, 8); chair(K, P, x - 0.6, z, Math.PI / 2, P.wood2); chair(K, P, x + 0.6, z, -Math.PI / 2, P.wood2); seats.push([x - 0.6, z, 'sit', Math.PI / 2], [x + 0.6, z, 'sit', -Math.PI / 2]); }
    plant(K, P, -w / 2 + 0.5, -d / 2 + 0.5, 1.3); plant(K, P, w / 2 - 0.5, d / 2 - 0.5, 1.3);
    return { seats, heat: [{ x: w * 0.18, z: -d / 2 + 0.5, r: 1.8, a: 2.6, lab: 'เคาน์เตอร์ครัว · ไอร้อน' }] }; },
  clinic(K, P, S) { const { w, d } = S;
    K.box(0.7, 0.7, 1.9, P.white, w / 2 - 0.9, 0, -d / 2 + 1.2); K.box(0.7, 0.1, 0.5, P.accent, w / 2 - 0.9, 0.7, -d / 2 + 0.45);
    desk(K, P, -w * 0.15, -d / 2 + 0.5, 1.3, 0.65, 0, 1); chair(K, P, -w * 0.15, -d / 2 + 1.15, Math.PI, P.dark); chair(K, P, -w * 0.15, -d / 2 + 1.9, 0, P.fabric2);
    K.box(0.02, 1.8, 1.8, P.fabric2, w / 2 - 1.5, 0, -d / 2 + 1.2); K.box(1.2, 1.8, 0.45, P.white, -w / 2 + 0.7, 0, d / 2 - 0.4); plant(K, P, -w / 2 + 0.4, -d / 2 + 0.4);
    return { seats: [[-w * 0.15, -d / 2 + 1.1, 'sit', Math.PI], [-w * 0.15, -d / 2 + 1.9, 'sit', 0], [w / 2 - 1.8, -d / 2 + 1.6, 'stand', Math.PI / 2]], heat: [{ x: -w * 0.15, z: -d / 2 + 0.6, r: 0.6, a: 0.8 }] }; },
  factory(K, P, S) { const { w, d, h } = S; const seats = [], heat = [];
    const lines = Math.max(2, Math.floor((d - 4) / 3.4)); for (let r = 0; r < lines; r++) { const z = -d / 2 + 3.2 + r * ((d - 5.4) / Math.max(1, lines - 1));
      K.box(w - 6, 0.12, 0.8, P.dark, -1, 0.8, z + 1.1); for (let i = 0; i < 4; i++) { const x = -w / 2 + 3.5 + i * ((w - 8) / 3); machine(K, P, x, z, 2.6, 1.6); heat.push({ x, z, r: 2.0, a: 3.2, lab: heat.length ? null : 'เครื่องจักร · ความร้อนสูง' }); seats.push([x + 0.2, z + 1.8]); seats.push([x - 1.4, z + 1.8]); } }
    for (let c = 1; c < 4; c++) for (const z of [-d / 6, d / 6]) K.box(0.4, h, 0.4, P.metal, -w / 2 + c * (w / 4), 0, z);
    for (let i = 0; i < 4; i++) { K.box(1.2, 0.15, 1.0, P.wood, w / 2 - 1.6, 0, -d / 2 + 1.5 + i * 1.4); K.box(1.0, 0.9, 0.8, P.fabric2, w / 2 - 1.6, 0.15, -d / 2 + 1.5 + i * 1.4); }
    return { seats, heat }; },
  warehouse(K, P, S) { const { w, d, h } = S; const seats = [];
    const rowsN = Math.max(2, Math.floor((w - 6) / 3.2)); for (let r = 0; r < rowsN; r++) { const x = -w / 2 + 2.6 + r * 3.2;
      for (let lv = 0; lv < 3; lv++) K.box(1.1, 0.08, d - 5, P.accent, x, 0.1 + lv * 1.6, -0.6);
      for (let k = 0; k < 5; k++) for (let lv = 0; lv < 3; lv++) if ((k + lv + r) % 4) K.box(1.0, 1.1, 1.1, P.fabric2, x, 0.2 + lv * 1.6, -d / 2 + 3.0 + k * ((d - 6) / 4));
      K.box(0.08, 4.8, 0.08, P.metal, x - 0.55, 0, -d / 2 + 2); K.box(0.08, 4.8, 0.08, P.metal, x - 0.55, 0, d / 2 - 3.2); }
    K.box(1.2, 1.2, 2.2, P.yellow, w / 2 - 2.5, 0, d / 2 - 2.0); K.box(1.0, 2.2, 0.1, P.metal, w / 2 - 2.5, 0, d / 2 - 3.1);
    K.box(2.4, 0.9, 1.0, P.wood, -w / 2 + 2, 0, d / 2 - 1.5); seats.push([-w / 2 + 2, d / 2 - 0.8], [w / 2 - 2.5, d / 2 - 0.6], [0, d / 2 - 2], [-w / 2 + 3.2, d / 2 - 0.8], [2.0, d / 2 - 1.2], [-2, d / 2 - 2.4]);
    return { seats, heat: [{ x: w / 2 - 2.5, z: d / 2 - 2.0, r: 1.0, a: 1.0 }] }; },
  control(K, P, S) { const { w, d } = S; const seats = [];
    K.box(w - 2.4, 1.7, 0.08, P.screen, 0, 0.7, -d / 2 + 0.08);
    for (let i = 0; i < 3; i++) { const x = (i - 1) * 2.1; desk(K, P, x, -d / 2 + 2.0, 1.9, 0.8, 0, 3); chair(K, P, x - 0.5, -d / 2 + 2.8, Math.PI, P.dark); chair(K, P, x + 0.5, -d / 2 + 2.8, Math.PI, P.dark); seats.push([x - 0.5, -d / 2 + 2.8, 'sit', Math.PI], [x + 0.5, -d / 2 + 2.8, 'sit', Math.PI]); }
    K.box(1.8, 0.05, 0.9, P.white, 0, 0.74, d / 2 - 1.4); K.box(1.7, 0.72, 0.1, P.metal, 0, 0, d / 2 - 1.4); K.box(0.6, 1.9, 0.6, P.rack, w / 2 - 0.6, 0, d / 2 - 0.6);
    return { seats, heat: [{ x: 0, z: -d / 2 + 1.8, r: 2.4, a: 1.8, lab: 'จอและคอมพิวเตอร์ควบคุม' }, { x: 0, z: -d / 2 + 0.3, r: 1.8, a: 1.2 }] }; },
  dining(K, P, S) { const { w, d } = S; const tx = w * 0.08, tz = d * 0.02; const seats = [];
    K.box(1.8, 0.05, 0.95, P.wood, tx, 0.74, tz); [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]].forEach(([a, b]) => K.box(0.06, 0.74, 0.06, P.wood2, tx + a, 0, tz + b));
    [[-0.5, -0.75, 0], [0.5, -0.75, 0], [-0.5, 0.75, Math.PI], [0.5, 0.75, Math.PI], [-1.2, 0, Math.PI / 2], [1.2, 0, -Math.PI / 2]].forEach(([a, b, r]) => { chair(K, P, tx + a, tz + b, r, P.wood2); seats.push([tx + a, tz + b, 'sit', r]); });
    for (let i = 0; i < 3; i++) K.cyl(0.14, 0.03, P.white, tx - 0.5 + i * 0.5, 0.79, tz, 16);
    K.box(1.6, 0.85, 0.45, P.wood2, -w * 0.05, 0, -d / 2 + 0.25); K.box(2.2, 0.01, 1.6, P.fabric2, tx, 0, tz); plant(K, P, w / 2 - 0.45, -d / 2 + 0.45, 1.1);
    K.cyl(0.3, 0.18, P.dark, tx, S.h - 0.75, tz, 18, 0.12); K.cyl(0.01, 0.55, P.metal, tx, S.h - 0.57, tz, 6);
    return { seats, heat: [{ x: tx, z: tz, r: 1.1, a: 1.0, lab: 'อาหารร้อน + คนนั่งพร้อมกัน' }] }; },
  hotel(K, P, S) { const { w, d } = S; const bx = w * 0.12, bz = -d / 2 + 1.25;
    K.box(2.0, 0.32, 2.1, P.wood2, bx, 0, bz); K.box(1.92, 0.22, 2.0, P.white, bx, 0.32, bz); K.box(1.95, 0.05, 0.7, P.fabric, bx, 0.54, bz + 0.6); K.box(2.2, 1.1, 0.08, P.fabric, bx, 0, -d / 2 + 0.05);
    [[-0.45], [0.45]].forEach(([a]) => K.box(0.6, 0.14, 0.34, P.white, bx + a, 0.54, bz - 0.78));
    K.box(0.5, 0.55, 0.42, P.wood2, bx - 1.3, 0, -d / 2 + 0.25); K.box(0.5, 0.55, 0.42, P.wood2, bx + 1.3, 0, -d / 2 + 0.25);
    K.box(1.4, 0.05, 0.55, P.wood2, w / 2 - 0.35, 0.74, d * 0.12, Math.PI / 2); K.box(1.3, 0.72, 0.45, P.wood2, w / 2 - 0.35, 0, d * 0.12, Math.PI / 2); K.box(0.05, 0.5, 0.85, P.screen, w / 2 - 0.12, 0.82, d * 0.12);
    chair(K, P, w / 2 - 0.95, d * 0.12, Math.PI / 2, P.fabric2); chair(K, P, -w / 2 + 0.8, d * 0.2, Math.PI / 2 + 0.4, P.fabric);
    K.box(1.2, 2.2, 0.6, P.wood, -w / 2 + 0.7, 0, d / 2 - 0.35); K.box(w - 1.6, 2.3, 0.05, P.glass, 0.5, 0, d / 2 - 1.6);
    return { seats: [[bx - 0.45, bz + 0.1, 'lie'], [w / 2 - 0.95, d * 0.12, 'sit', Math.PI / 2]], heat: [{ x: w / 2 - 0.3, z: d * 0.12, r: 0.6, a: 0.7, lab: 'ทีวี · มินิบาร์' }] }; },
  classroom(K, P, S) { const { w, d } = S; const seats = [], heat = [];
    K.box(Math.min(4.8, w - 2), 1.2, 0.05, P.white, 0, 0.9, -d / 2 + 0.06); K.box(2.2, 1.3, 0.03, P.screen, w * 0.28, 1.0, -d / 2 + 0.1);
    K.box(1.5, 0.75, 0.7, P.wood2, -w * 0.25, 0, -d / 2 + 1.1); chair(K, P, -w * 0.25, -d / 2 + 0.55, 0, P.dark);
    const cols = Math.max(2, Math.floor((w - 1.6) / 1.5)), rows = Math.max(2, Math.floor((d - 3.2) / 1.1));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = -w / 2 + 1.0 + c * ((w - 2.0) / Math.max(1, cols - 1)), z = -d / 2 + 2.4 + r * ((d - 3.2) / Math.max(1, rows - 1));
      K.box(1.2, 0.04, 0.45, P.white, x, 0.72, z); K.box(0.04, 0.72, 0.4, P.metal, x - 0.56, 0, z); K.box(0.04, 0.72, 0.4, P.metal, x + 0.56, 0, z);
      [-0.3, 0.3].forEach(a => { chair(K, P, x + a, z + 0.45, Math.PI, P.fabric); seats.push([x + a, z + 0.45, 'sit', Math.PI]); }); }
    heat.push({ x: 0, z: d * 0.1, r: Math.max(w, d) * 0.35, a: 1.4, lab: 'นักเรียนเต็มห้อง' });
    seats.unshift([-w * 0.25, -d / 2 + 1.6, 'stand', Math.PI]);
    return { seats, heat }; },
  ward(K, P, S) { const { w, d } = S; const seats = [];
    [-w * 0.22, w * 0.22].forEach((x, i) => { const z = -d / 2 + 1.2;
      K.box(0.95, 0.5, 2.0, P.white, x, 0.05, z); K.box(0.9, 0.12, 1.9, P.fabric2, x, 0.55, z); K.box(0.95, 0.9, 0.05, P.metal, x, 0.1, -d / 2 + 0.2); K.box(0.03, 0.25, 1.4, P.metal, x - 0.5, 0.62, z + 0.1); K.box(0.03, 0.25, 1.4, P.metal, x + 0.5, 0.62, z + 0.1);
      K.box(0.45, 0.8, 0.45, P.white, x + (i ? -0.8 : 0.8), 0, -d / 2 + 0.35); K.cyl(0.02, 1.7, P.metal, x + (i ? 0.7 : -0.7), 0, -d / 2 + 0.5, 6); K.box(0.32, 0.24, 0.06, P.screen, x + (i ? 0.7 : -0.7), 1.35, -d / 2 + 0.52);
      chair(K, P, x + (i ? -0.85 : 0.85), z + 0.9, i ? Math.PI / 2 : -Math.PI / 2, P.fabric);
      seats.push([x, z + 0.1, 'lie'], [x + (i ? -0.85 : 0.85), z + 0.9, 'sit', i ? Math.PI / 2 : -Math.PI / 2]); });
    K.box(0.02, 2.0, 2.2, P.fabric2, 0, 0.1, -d / 2 + 1.3); K.box(1.2, 0.9, 0.5, P.white, w / 2 - 0.7, 0, d / 2 - 0.35); K.box(0.9, 2.1, 0.05, P.wood, -w / 2 + 1.0, 0, d / 2 - 0.03);
    return { seats, heat: [{ x: -w * 0.22 - 0.7, z: -d / 2 + 0.5, r: 0.5, a: 0.7, lab: 'เครื่องมือแพทย์' }] }; },

  // ---------- rooms added in Rev.07 (heavy-use rooms per sector) ----------
  kids(K, P, S) { const { w, d } = S; const g = K.g;
    bed(g, K, P, -w / 2 + 0.6, -d / 2 + 1.1, 0.95, 1.95, 0); K.box(0.9, 0.5, 0.45, P.accent, -w / 2 + 0.55, 0, d / 2 - 0.4); K.box(0.8, 1.1, 0.4, P.wood, w / 2 - 0.45, 0, -d / 2 + 0.25);
    for (let i = 0; i < 5; i++) K.sph(0.09 + (i % 2) * 0.03, [P.accent, P.yellow, P.green, P.fabric2, P.fabric][i], w / 2 - 0.9 + i * 0.16, 0.1, d / 2 - 0.6); K.box(1.4, 0.01, 1.1, P.yellow, 0.2, 0, 0.3);
    desk(K, P, w / 2 - 0.55, 0.4, 1.0, 0.55, -Math.PI / 2, 0); chair(K, P, w / 2 - 1.05, 0.4, -Math.PI / 2, P.accent);
    return { seats: [[-w / 2 + 0.6, -d / 2 + 1.0, 'lie'], [0.2, 0.4]], heat: [{ x: -w / 2 + 0.6, z: -d / 2 + 1.2, r: 0.8, a: 0.5, lab: 'ตุ๊กตา ผ้าห่ม ฝุ่นละเอียด' }] }; },
  condostudio(K, P, S) { const { w, d } = S; const g = K.g;
    bed(g, K, P, w / 2 - 1.2, -d / 2 + 1.1, 1.6, 2.0, 0); K.box(0.4, 0.5, 0.4, P.wood2, w / 2 - 0.2, 0, -d / 2 + 0.25);
    counter(g, K, P, -w / 2 + 1.4, -d / 2 + 0.33, 2.4, 0.6, 0.9); K.box(0.6, 0.02, 0.5, P.dark, -w / 2 + 1.0, 0.92, -d / 2 + 0.33); K.box(0.7, 1.85, 0.65, P.metal, -w / 2 + 0.36, 0, -d / 2 + 1.3);
    K.box(0.4, 0.45, 0.35, P.metal, -w / 2 + 2.2, 1.55, -d / 2 + 0.25);
    sofa(g, K, P, -0.3, d / 2 - 0.9, 1.8, Math.PI); K.box(0.9, 0.38, 0.5, P.wood, -0.3, 0, d / 2 - 1.8); K.box(1.3, 0.75, 0.05, P.screen, -0.3, 0.75, -d / 2 + 1.35 - 0.3);
    return { seats: [[w / 2 - 1.5, -d / 2 + 1.1, 'lie'], [-0.6, d / 2 - 0.9, 'sit', Math.PI], [-w / 2 + 1.4, -d / 2 + 0.95, 'stand', Math.PI]], heat: [{ x: -w / 2 + 1.0, z: -d / 2 + 0.4, r: 0.9, a: 2.6, lab: 'ครัวเปิด · ไอน้ำมัน' }, { x: -w / 2 + 0.36, z: -d / 2 + 1.3, r: 0.5, a: 0.8, lab: 'ตู้เย็น' }] }; },
  condobed(K, P, S) { const { w, d } = S; const g = K.g; bed(g, K, P, 0.25, -d / 2 + 1.05, 1.5, 2.0, 0); K.box(0.4, 0.45, 0.35, P.wood2, 0.25 - 1.0, 0, -d / 2 + 0.22); K.box(0.55, 2.1, 1.2, P.wood, -w / 2 + 0.3, 0, d / 2 - 0.7); return { seats: [[0.0, -d / 2 + 1.0, 'lie'], [0.5, -d / 2 + 1.0, 'lie']], heat: [] }; },
  condoliving(K, P, S) { const { w, d } = S; const g = K.g;
    sofa(g, K, P, 0.4, d / 2 - 0.8, 2.2, Math.PI); K.box(1.0, 0.36, 0.55, P.wood, 0.4, 0, d / 2 - 1.75); K.box(1.6, 0.9, 0.05, P.screen, 0.4, 0.8, -d / 2 + 0.1); K.box(1.8, 0.45, 0.4, P.wood2, 0.4, 0, -d / 2 + 0.22);
    counter(g, K, P, -w / 2 + 0.35, -0.2, 2.2, 0.6, 0.9, Math.PI / 2); K.box(0.5, 0.02, 0.45, P.dark, -w / 2 + 0.35, 0.92, -0.6); plant(K, P, w / 2 - 0.4, -d / 2 + 0.45);
    return { seats: [[0.0, d / 2 - 0.8, 'sit', Math.PI], [0.8, d / 2 - 0.8, 'sit', Math.PI], [-w / 2 + 1.0, -0.6, 'stand', -Math.PI / 2]], heat: [{ x: -w / 2 + 0.4, z: -0.6, r: 0.8, a: 1.6, lab: 'แพนทรี · ไมโครเวฟ' }, { x: 0.4, z: -d / 2 + 0.3, r: 0.6, a: 0.6 }] }; },
  reception(K, P, S) { const { w, d } = S; const g = K.g;
    counter(g, K, P, 0, -d / 2 + 1.4, 3.0, 0.8, 1.1, 0, P.wood2, P.wood); K.box(3.4, 1.2, 0.06, P.accent, 0, 1.2, -d / 2 + 0.05); desk(K, P, 0, -d / 2 + 0.75, 1.4, 0.6, 0, 1);
    sofa(g, K, P, w / 2 - 1.4, 0.8, 2.2, -Math.PI / 2, P.fabric2); sofa(g, K, P, -w / 2 + 1.2, 1.4, 1.8, Math.PI / 2, P.fabric2); K.box(1.0, 0.4, 0.6, P.wood, 0.2, 0, 1.4); plant(K, P, w / 2 - 0.5, -d / 2 + 0.5, 1.3); plant(K, P, -w / 2 + 0.5, -d / 2 + 0.5, 1.3);
    K.box(1.8, 2.3, 0.05, P.glass, 0.6, 0, d / 2 - 0.05);
    return { seats: [[-0.5, -d / 2 + 0.7, 'sit', 0], [0.5, -d / 2 + 0.7, 'sit', 0], [w / 2 - 1.4, 0.5, 'sit', -Math.PI / 2], [-w / 2 + 1.2, 1.0, 'sit', Math.PI / 2], [0.6, d / 2 - 0.6], [1.2, 0.2]], heat: [{ x: 0.6, z: d / 2 - 0.4, r: 1.5, a: 1.6, lab: 'ประตูเปิดปิด · ฝุ่นและความร้อนจากนอกอาคาร' }] }; },
  printroom(K, P, S) { const { w, d } = S; const g = K.g;
    K.box(1.2, 1.1, 0.7, P.white, -w / 2 + 0.75, 0, -d / 2 + 0.45); K.box(1.1, 0.12, 0.6, P.dark, -w / 2 + 0.75, 1.1, -d / 2 + 0.45); K.box(0.6, 0.9, 0.5, P.white, -w / 2 + 1.75, 0, -d / 2 + 0.35);
    counter(g, K, P, w / 2 - 0.35, 0, 2.2, 0.6, 0.9, -Math.PI / 2); K.box(0.5, 0.3, 0.4, P.metal, w / 2 - 0.35, 0.9, -0.5); K.box(0.3, 0.35, 0.3, P.dark, w / 2 - 0.35, 0.9, 0.3); shelf(K, P, -w / 2 + 0.2, d / 2 - 0.7, 0.35, 1.9, 1.0, 0);
    return { seats: [[-w / 2 + 0.75, -d / 2 + 1.2, 'stand', Math.PI], [w / 2 - 1.0, 0.1, 'stand', -Math.PI / 2]], heat: [{ x: -w / 2 + 0.8, z: -d / 2 + 0.5, r: 0.9, a: 2.0, lab: 'เครื่องถ่ายเอกสาร · ผงหมึก' }, { x: w / 2 - 0.4, z: -0.2, r: 0.7, a: 1.2, lab: 'ไมโครเวฟ · เครื่องชงกาแฟ' }] }; },
  minimart(K, P, S) { const { w, d } = S; const g = K.g;
    openFridge(g, K, P, 0.4, -d / 2 + 0.45, w * 0.62, 0); openFridge(g, K, P, -w / 2 + 0.45, -0.5, d * 0.5, Math.PI / 2);
    [-1.0, 1.6].forEach(z => [-1.6, 1.6].forEach(x => gondola(g, K, P, x + 0.6, z, 2.4, 0)));
    counter(g, K, P, w / 2 - 1.5, d / 2 - 1.2, 2.2, 0.7, 1.0, Math.PI, P.accent, P.white); K.box(0.4, 0.3, 0.3, P.screen, w / 2 - 1.6, 1.0, d / 2 - 1.25);
    K.box(2.0, 2.3, 0.05, P.glass, w / 2 - 3.5, 0, d / 2 - 0.03);
    return { seats: [[w / 2 - 1.5, d / 2 - 0.6, 'stand', Math.PI], [-0.8, 0.3], [1.9, 0.3], [0.2, 2.6], [-2.4, 2.4], [2.6, -0.1], [-0.6, -1.9], [w / 2 - 3.5, d / 2 - 0.7]], heat: [{ x: 0.4, z: -d / 2 + 0.8, r: 2.2, a: 2.4, lab: 'ตู้แช่ปล่อยความร้อน · เปิด 24 ชม.' }, { x: w / 2 - 3.5, z: d / 2 - 0.5, r: 1.3, a: 1.4, lab: 'ประตูอัตโนมัติเปิดตลอด' }] }; },
  cafe(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    counter(g, K, P, w * 0.12, -d / 2 + 0.55, w * 0.5, 0.7, 1.05, 0, P.wood2, P.wood); K.box(0.55, 0.45, 0.5, P.metal, w * 0.12 - 0.8, 1.05, -d / 2 + 0.5); K.box(0.9, 0.6, 0.6, P.metal, w * 0.12 + 1.2, 0, -d / 2 + 0.3); K.box(w * 0.4, 0.6, 0.5, P.glass, w * 0.12, 1.05, -d / 2 + 0.75);
    [[-2.2, 0.3], [0.2, 0.6], [2.4, 0.4], [-1.2, 2.0], [1.4, 2.0]].forEach(([x, z]) => { K.cyl(0.35, 0.04, P.wood, x, 0.74, z, 20); K.cyl(0.04, 0.74, P.metal, x, 0, z, 8); chair(K, P, x - 0.55, z, Math.PI / 2, P.wood2); chair(K, P, x + 0.55, z, -Math.PI / 2, P.wood2); seats.push([x - 0.55, z, 'sit', Math.PI / 2], [x + 0.55, z, 'sit', -Math.PI / 2]); });
    K.box(w - 1, 2.4, 0.04, P.glass, 0, 0, d / 2 - 0.03); plant(K, P, -w / 2 + 0.5, -d / 2 + 0.5, 1.2);
    seats.unshift([w * 0.12 - 0.6, -d / 2 + 0.05, 'stand', 0]);
    return { seats, heat: [{ x: w * 0.12 + 1.2, z: -d / 2 + 0.4, r: 1.0, a: 2.4, lab: 'เตาอบ · ผงแป้ง' }, { x: w * 0.12 - 0.8, z: -d / 2 + 0.5, r: 0.7, a: 1.4, lab: 'เครื่องชงกาแฟ · ไอน้ำ' }] }; },
  gym(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    for (let i = 0; i < 5; i++) { const x = -w / 2 + 1.2 + i * 1.1; treadmill(g, K, P, x, -d / 2 + 1.3, 0); seats.push([x, -d / 2 + 1.35, 'stand', 0]); }
    for (let i = 0; i < 3; i++) { const x = w / 2 - 1.2 - i * 1.6; K.box(0.5, 0.45, 1.2, P.fabric, x, 0, 0.8); K.box(1.4, 0.05, 0.05, P.metal, x, 1.2, 0.3); K.box(0.05, 1.3, 0.05, P.metal, x - 0.6, 0, 0.3); K.box(0.05, 1.3, 0.05, P.metal, x + 0.6, 0, 0.3); seats.push([x, 0.8, 'sit', Math.PI]); }
    K.box(3.0, 0.8, 0.4, P.rack, -w / 2 + 2.2, 0, d / 2 - 0.3); for (let i = 0; i < 8; i++) K.cyl(0.08, 0.2, P.dark, -w / 2 + 1.0 + i * 0.34, 0.8, d / 2 - 0.3, 12);
    K.box(w - 2, 2.0, 0.03, P.glass, 0, 0.3, -d / 2 + 0.03); K.box(3, 0.01, 2.5, P.accent, 0, 0, d / 2 - 2.0);
    for (let i = 0; i < 6; i++) seats.push([-2.5 + i * 1.0, d / 2 - 1.8 - (i % 2) * 0.6]);
    return { seats, heat: [{ x: -w / 2 + 3.4, z: -d / 2 + 1.3, r: 2.4, a: 2.2, lab: 'คนออกกำลัง · เหงื่อ ความชื้นสูง' }, { x: 0, z: d / 2 - 2, r: 1.8, a: 1.4 }] }; },
  salon(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    for (let i = 0; i < 4; i++) { const x = -w / 2 + 1.1 + i * 1.35; K.box(1.1, 1.3, 0.04, P.glass, x, 0.75, -d / 2 + 0.05); K.box(1.0, 0.06, 0.45, P.white, x, 0.8, -d / 2 + 0.25); const C = sub(g, P, x, -d / 2 + 1.0, 0); C.box(0.6, 0.12, 0.6, P.dark, 0, 0.45, 0); C.box(0.6, 0.6, 0.1, P.dark, 0, 0.55, 0.28); C.cyl(0.22, 0.45, P.metal, 0, 0, 0, 16); seats.push([x, -d / 2 + 1.0, 'sit', Math.PI], [x + 0.45, -d / 2 + 1.5, 'stand', Math.PI]); }
    [0, 1].forEach(i => { const x = w / 2 - 0.9 - i * 1.0; K.box(0.7, 0.85, 0.6, P.white, x, 0, d / 2 - 0.4); K.box(0.6, 0.12, 1.1, P.dark, x, 0.5, d / 2 - 1.2); });
    sofa(g, K, P, -w / 2 + 1.4, d / 2 - 0.55, 1.8, Math.PI, P.fabric2);
    return { seats, heat: [{ x: -w / 2 + 2.5, z: -d / 2 + 0.9, r: 1.8, a: 1.9, lab: 'ไดร์เป่าผม · สเปรย์ · ไอเคมี' }] }; },
  spa(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    [-w * 0.2, w * 0.22].forEach(x => { K.box(0.75, 0.7, 1.95, P.wood2, x, 0, -0.1); K.box(0.72, 0.08, 1.9, P.white, x, 0.7, -0.1); K.box(0.7, 0.03, 0.6, P.fabric2, x, 0.78, 0.4); seats.push([x, -0.2, 'lie']); seats.push([x + 0.6, 0.3, 'stand', -Math.PI / 2]); });
    K.box(0.02, 2.0, 2.2, P.fabric2, 0, 0, -0.2); K.box(1.2, 0.8, 0.45, P.wood, w / 2 - 0.8, 0, -d / 2 + 0.25); for (let i = 0; i < 6; i++) K.box(0.25, 0.08, 0.3, P.white, w / 2 - 1.2 + (i % 3) * 0.28, 0.8 + Math.floor(i / 3) * 0.09, -d / 2 + 0.25); plant(K, P, -w / 2 + 0.4, -d / 2 + 0.4);
    return { seats, heat: [{ x: w / 2 - 0.8, z: -d / 2 + 0.3, r: 0.7, a: 0.9, lab: 'ผ้าขนหนู · สตีม · น้ำมันนวด' }] }; },
  karaoke(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    K.box(2.2, 1.3, 0.06, P.screen, 0, 0.8, -d / 2 + 0.05); K.box(2.4, 0.5, 0.45, P.dark, 0, 0, -d / 2 + 0.25); [-1.4, 1.4].forEach(x => K.box(0.4, 1.1, 0.35, P.rack, x, 0, -d / 2 + 0.25));
    sofa(g, K, P, 0, d / 2 - 0.55, w - 1.0, Math.PI, P.accent); sofa(g, K, P, -w / 2 + 0.55, 0.3, 2.0, Math.PI / 2, P.accent); K.box(1.8, 0.45, 0.7, P.wood2, 0, 0, 0.4);
    for (let i = 0; i < 6; i++) seats.push([-1.6 + i * 0.65, d / 2 - 0.55, 'sit', Math.PI]); seats.push([-w / 2 + 0.55, -0.2, 'sit', Math.PI / 2], [-w / 2 + 0.55, 0.6, 'sit', Math.PI / 2], [0.3, -0.6], [-0.3, -0.7]);
    return { seats, heat: [{ x: 0, z: 0.4, r: 1.6, a: 1.6, lab: 'ห้องปิด · คนแน่น · อาหาร' }, { x: 0, z: -d / 2 + 0.3, r: 0.9, a: 1.0 }] }; },
  netcafe(K, P, S) { const { w, d } = S; const seats = [], heat = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const x = -w / 2 + 1.1 + c * ((w - 2.2) / 5), z = -d / 2 + 1.2 + r * 1.9; desk(K, P, x, z, 1.0, 0.6, 0, 1); K.box(0.2, 0.45, 0.45, P.dark, x + 0.35, 0.72, z); chair(K, P, x, z + 0.6, Math.PI, P.dark); seats.push([x, z + 0.6, 'sit', Math.PI]); }
    for (let r = 0; r < 3; r++) heat.push({ x: 0, z: -d / 2 + 1.2 + r * 1.9, r: w * 0.3, a: 1.6, lab: r ? null : 'คอมพิวเตอร์ 18 เครื่อง · เปิด 12–24 ชม.' });
    return { seats, heat }; },
  dental(K, P, S) { const { w, d } = S; const g = K.g;
    const C = sub(g, P, 0.3, -0.2, -0.35); C.box(0.65, 0.45, 1.8, P.white, 0, 0, 0); C.box(0.6, 0.12, 1.2, P.accent, 0, 0.45, 0.2); C.box(0.6, 0.5, 0.12, P.accent, 0, 0.5, -0.45); C.box(0.05, 1.5, 0.05, P.metal, 0.45, 0, -0.7); C.box(0.35, 0.12, 0.2, P.white, 0.3, 1.5, -0.5);
    K.box(1.6, 0.9, 0.55, P.white, -w / 2 + 1.0, 0, -d / 2 + 0.3); K.box(1.0, 0.8, 0.02, P.screen, w / 2 - 0.2, 1.2, 0.3); chair(K, P, -0.5, 0.3, 0, P.dark); K.box(0.6, 0.9, 0.5, P.metal, w / 2 - 0.4, 0, -d / 2 + 0.3);
    return { seats: [[0.3, -0.1, 'lie'], [-0.5, 0.3, 'sit', 0], [0.9, -0.5, 'stand', -Math.PI / 2]], heat: [{ x: 0.3, z: -0.2, r: 1.0, a: 1.2, lab: 'ละอองจากหัวกรอ · เครื่องขูดหินปูน' }] }; },
  laundry(K, P, S) { const { w, d } = S; const g = K.g; const heat = [];
    for (let i = 0; i < 7; i++) { washer(g, K, P, -w / 2 + 0.6 + i * 0.78, -d / 2 + 0.45, 0, i >= 4); }
    for (let i = 0; i < 4; i++) heat.push({ x: -w / 2 + 3.7 + i * 0.78, z: -d / 2 + 0.6, r: 0.7, a: 2.4, lab: i ? null : 'เครื่องอบผ้า · ขุยผ้า ความร้อน' });
    K.box(3.0, 0.9, 0.7, P.wood, 0.5, 0, 1.0); K.box(2.2, 0.45, 0.4, P.fabric2, -w / 2 + 1.4, 0, d / 2 - 0.3); [0, 1, 2].forEach(i => K.box(0.4, 0.3, 0.35, P.fabric, -0.3 + i * 0.6, 0.9, 1.0));
    return { seats: [[0.5, 1.6, 'stand', Math.PI], [-w / 2 + 1.1, d / 2 - 0.5, 'sit', Math.PI], [-w / 2 + 2.0, -d / 2 + 1.3, 'stand', 0]], heat }; },
  lobby(K, P, S) { const { w, d, h } = S; const g = K.g; const seats = [];
    counter(g, K, P, -w / 2 + 3.2, -d / 2 + 1.6, 4.5, 0.9, 1.15, 0, P.wood2, P.wood); K.box(5.5, 2.4, 0.08, P.accent, -w / 2 + 3.2, 0.6, -d / 2 + 0.05);
    [[-1.5, 1.2], [2.8, 0.5], [3.5, 3.4]].forEach(([x, z], i) => { sofa(g, K, P, x, z, 2.2, i % 2 ? -Math.PI / 2 : Math.PI, P.fabric2); K.box(1.0, 0.38, 0.6, P.wood, x + (i % 2 ? -1.0 : 0), 0, z + (i % 2 ? 0 : -1.0)); seats.push([x, z, 'sit', i % 2 ? -Math.PI / 2 : Math.PI]); });
    for (let i = 0; i < 4; i++) K.cyl(0.35, h, P.white, -w / 2 + 6 + i * 3.2, 0, 0.2, 20); plant(K, P, w / 2 - 0.7, -d / 2 + 0.7, 1.8); K.box(4.0, 2.8, 0.05, P.glass, w / 2 - 4, 0, d / 2 - 0.05);
    for (let i = 0; i < 10; i++) seats.push([-4 + (i * 1.9) % 9, 1.5 + (i % 3) * 1.3]); seats.unshift([-w / 2 + 2.6, -d / 2 + 1.0, 'stand', 0], [-w / 2 + 3.8, -d / 2 + 1.0, 'stand', 0]);
    return { seats, heat: [{ x: w / 2 - 4, z: d / 2 - 0.5, r: 2.4, a: 1.6, lab: 'ประตูหลัก · เปิด 24 ชม.' }] }; },
  ballroom(K, P, S) { const { w, d } = S; const seats = [];
    K.box(6, 0.6, 3, P.wood2, 0, 0, -d / 2 + 1.6); K.box(5, 2.2, 0.06, P.screen, 0, 1.2, -d / 2 + 0.1);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const x = -w / 2 + 2.2 + c * ((w - 4.4) / 4), z = -d / 2 + 4.6 + r * 2.5; K.cyl(0.8, 0.04, P.white, x, 0.74, z, 24); K.cyl(0.1, 0.74, P.metal, x, 0, z, 8); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, sx = x + Math.cos(a) * 1.15, sz = z + Math.sin(a) * 1.15; chair(K, P, sx, sz, -a - Math.PI / 2, P.accent); seats.push([sx, sz, 'sit', -a - Math.PI / 2]); } }
    return { seats, heat: [{ x: 0, z: 1.5, r: w * 0.4, a: 1.8, lab: 'แขกนับร้อยพร้อมกัน' }] }; },
  complab(K, P, S) { const { w, d } = S; const seats = [], heat = [];
    K.box(3.2, 1.2, 0.05, P.white, 0, 0.9, -d / 2 + 0.06);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { const x = -w / 2 + 1.2 + c * ((w - 2.4) / 4), z = -d / 2 + 2.0 + r * 1.55; desk(K, P, x - 0.4, z, 0.75, 0.6, 0, 1); desk(K, P, x + 0.4, z, 0.75, 0.6, 0, 1); chair(K, P, x - 0.4, z + 0.55, Math.PI, P.dark); chair(K, P, x + 0.4, z + 0.55, Math.PI, P.dark); seats.push([x - 0.4, z + 0.55, 'sit', Math.PI], [x + 0.4, z + 0.55, 'sit', Math.PI]); }
    for (let r = 0; r < 4; r++) heat.push({ x: 0, z: -d / 2 + 2.0 + r * 1.55, r: w * 0.32, a: 1.5, lab: r ? null : 'คอมพิวเตอร์ 40 เครื่อง' });
    return { seats, heat }; },
  library(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    for (let i = 0; i < 4; i++) bookshelf(g, K, P, -w / 2 + 2.2 + i * 1.6, -d / 2 + 1.4, 3.0, 2.0, Math.PI / 2);
    bookshelf(g, K, P, 1.5, -d / 2 + 0.25, 7, 2.2, 0);
    for (let t = 0; t < 3; t++) { const x = 1.0 + t * 1.9, z = 1.2; K.box(1.6, 0.05, 0.9, P.wood, x, 0.74, z); K.box(1.5, 0.72, 0.1, P.wood2, x, 0, z); [[-0.45, -0.6, 0], [0.45, -0.6, 0], [-0.45, 0.6, Math.PI], [0.45, 0.6, Math.PI]].forEach(([a, b, r]) => { chair(K, P, x + a, z + b, r, P.fabric); seats.push([x + a, z + b, 'sit', r]); }); }
    counter(g, K, P, -w / 2 + 2, d / 2 - 1.2, 2.4, 0.7, 1.05, Math.PI, P.wood2, P.wood);
    return { seats, heat: [{ x: -w / 2 + 3.5, z: -d / 2 + 1.5, r: 2.2, a: 0.6, lab: 'ฝุ่นกระดาษจากหนังสือ' }] }; },
  auditorium(K, P, S) { const { w, d } = S; const seats = [];
    K.box(10, 1.0, 4, P.wood2, 0, 0, -d / 2 + 2.1); K.box(9, 3.5, 0.08, P.screen, 0, 1.6, -d / 2 + 0.1); K.box(12, 5, 0.1, P.accent, 0, 0, -d / 2 + 0.02);
    seatRows(K.g, K, P, -w / 2 + 3, -d / 2 + 5.5, 16, 8, (w - 6) / 15, 1.05, 0.12, seats, P.fabric);
    return { seats, heat: [{ x: 0, z: 2.5, r: w * 0.45, a: 1.7, lab: 'ผู้ชมหลายร้อยคน' }] }; },
  canteen(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    for (let i = 0; i < 4; i++) counter(g, K, P, -w / 2 + 2 + i * 3.0, -d / 2 + 0.5, 2.6, 0.8, 0.95, 0, P.metal, P.white);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = -w / 2 + 2.3 + c * ((w - 4.6) / 3), z = -d / 2 + 3.2 + r * 2.8; K.box(2.4, 0.05, 0.8, P.white, x, 0.74, z); K.box(2.2, 0.72, 0.1, P.metal, x, 0, z); K.box(2.4, 0.42, 0.3, P.metal, x, 0, z - 0.65); K.box(2.4, 0.42, 0.3, P.metal, x, 0, z + 0.65); for (let k = 0; k < 3; k++) seats.push([x - 0.8 + k * 0.8, z - 0.65, 'sit', 0], [x - 0.8 + k * 0.8, z + 0.65, 'sit', Math.PI]); }
    for (let i = 0; i < 4; i++) seats.unshift([-w / 2 + 2 + i * 3.0, -d / 2 + 1.1, 'stand', Math.PI]);
    return { seats, heat: [{ x: 0, z: -d / 2 + 0.6, r: w * 0.4, a: 2.8, lab: 'ร้านอาหาร · ไอน้ำมัน' }] }; },
  dorm(K, P, S) { const { w, d } = S; const g = K.g;
    bunk(g, K, P, -w / 2 + 0.6, -d / 2 + 1.15, 0); bunk(g, K, P, w / 2 - 0.6, -d / 2 + 1.15, 0);
    desk(K, P, -w / 2 + 0.55, d / 2 - 1.2, 1.0, 0.55, Math.PI / 2, 1); desk(K, P, w / 2 - 0.55, d / 2 - 1.2, 1.0, 0.55, -Math.PI / 2, 1); chair(K, P, -w / 2 + 1.05, d / 2 - 1.2, -Math.PI / 2, P.dark); chair(K, P, w / 2 - 1.05, d / 2 - 1.2, Math.PI / 2, P.dark);
    K.box(1.0, 2.0, 0.55, P.wood, 0, 0, d / 2 - 0.3);
    return { seats: [[-w / 2 + 0.6, -d / 2 + 1.1, 'lie'], [w / 2 - 0.6, -d / 2 + 1.1, 'lie'], [-w / 2 + 1.05, d / 2 - 1.2, 'sit', -Math.PI / 2], [w / 2 - 1.05, d / 2 - 1.2, 'sit', Math.PI / 2]], heat: [{ x: 0, z: 0, r: 1.5, a: 0.7, lab: 'หลายคนต่อห้อง · ผ้าและของใช้' }] }; },
  opd(K, P, S) { const { w, d } = S; const g = K.g; const seats = [];
    counter(g, K, P, -w / 2 + 2.6, -d / 2 + 0.9, 4.0, 0.8, 1.05, 0, P.white, P.white); K.box(4.4, 0.4, 0.06, P.green, -w / 2 + 2.6, 2.1, -d / 2 + 0.05);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x = -1.0 + c * 5.0, z = -d / 2 + 3.0 + r * 1.6; K.box(3.6, 0.45, 0.5, P.accent, x, 0, z); K.box(3.6, 0.5, 0.08, P.accent, x, 0.45, z + 0.22); for (let k = 0; k < 5; k++) seats.push([x - 1.45 + k * 0.72, z, 'sit', Math.PI]); }
    K.box(1.8, 1.0, 0.05, P.screen, w / 2 - 1.5, 1.6, -d / 2 + 0.05); plant(K, P, w / 2 - 0.5, d / 2 - 0.5, 1.3);
    seats.unshift([-w / 2 + 2.0, -d / 2 + 0.4, 'sit', 0], [-w / 2 + 3.3, -d / 2 + 0.4, 'sit', 0]);
    return { seats, heat: [{ x: 1.5, z: 1.0, r: w * 0.35, a: 1.6, lab: 'ผู้ป่วยและญาติแออัด' }] }; },
  medlab(K, P, S) { const { w, d } = S; const g = K.g;
    counter(g, K, P, 0, -d / 2 + 0.4, w - 1.2, 0.7, 0.9, 0, P.white, P.white); for (let i = 0; i < 5; i++) K.box(0.6, 0.55 + (i % 2) * 0.2, 0.5, i % 2 ? P.machine : P.white, -w / 2 + 1.3 + i * 1.3, 0.9, -d / 2 + 0.4);
    counter(g, K, P, 0, 0.6, 4.0, 1.2, 0.9, 0, P.white, P.white); K.box(1.2, 1.9, 0.7, P.metal, w / 2 - 0.5, 0, d / 2 - 0.5); K.box(1.0, 1.9, 0.7, P.white, -w / 2 + 0.6, 0, d / 2 - 0.5);
    return { seats: [[-1, -d / 2 + 1.1, 'stand', 0], [1.2, -d / 2 + 1.1, 'stand', 0], [0.6, 1.5, 'stand', Math.PI]], heat: [{ x: 0, z: -d / 2 + 0.5, r: 2.4, a: 2.2, lab: 'เครื่องวิเคราะห์ทำงาน 24 ชม.' }] }; },
  orroom(K, P, S) { const { w, d, h } = S;
    K.box(0.6, 0.85, 2.0, P.metal, 0, 0, 0); K.box(0.62, 0.08, 1.9, P.green, 0, 0.85, 0); K.cyl(0.35, 0.12, P.white, 0, h - 0.9, 0, 24); K.cyl(0.03, 0.8, P.metal, 0, h - 0.8, 0, 8);
    K.box(1.2, 1.6, 0.5, P.machine, -w / 2 + 0.8, 0, -1.2); K.box(0.9, 0.7, 0.05, P.screen, -w / 2 + 0.8, 1.6, -1.2); K.box(1.0, 1.9, 0.6, P.white, w / 2 - 0.6, 0, -d / 2 + 0.4); K.box(2.4, 0.02, 2.4, P.white, 0, h - 0.02, 0);
    return { seats: [[0, 0.1, 'lie'], [-0.8, 0.4, 'stand', Math.PI / 2], [0.8, -0.3, 'stand', -Math.PI / 2], [0.8, 0.6, 'stand', -Math.PI / 2]], heat: [{ x: 0, z: 0, r: 1.4, a: 1.4, lab: 'ห้องควบคุมความดันและการกรองอากาศ' }] }; },
};

/* ---------------- AC units by type ---------------- */
function unitMesh(type, P, M, opt = {}) {
  const g = new THREE.Group(); const grille = [];
  const B = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const grilleMat = () => { const m = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.8 }); grille.push({ m, base: m.color.clone() }); return m; };
  const tintable = (U, ids) => ids.forEach(id => U.parts[id] && U.parts[id].traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.material = o.material.clone(); grille.push({ m: o.material, base: o.material.color.clone() }); } }));
  let U = null;
  if (type === 'wall') { U = buildWallUnit(M); tintable(U, ['filter', 'coil']);
    // pipes go straight into the wall behind the unit (no loose pipe stubs hanging below the unit in the room)
    U.parts.chassis.children.filter(c => c.geometry && c.geometry.type === 'CylinderGeometry').forEach(c => c.visible = false); if (U.parts.drain) U.parts.drain.visible = false; }
  else if (type === 'ceiling') { U = buildCeilingUnit(M, { interior: false, rod: opt.rod ?? 0.3 }); tintable(U, ['grille']); }
  else if (type === 'cassette') { U = buildCassetteUnit(M, { interior: false, rod: 0 }); U.parts.casing.visible = false; U.parts.hangers.visible = false; tintable(U, ['grille']); }
  else if (type === 'floor') {
    B(0.6, 1.85, 0.36, P.shell, 0, 0.925, 0); B(0.5, 0.22, 0.02, P.dark, 0, 1.72, 0.18); B(0.5, 0.5, 0.02, grilleMat(), 0, 0.35, 0.181); B(0.12, 0.06, 0.01, P.screen, 0, 1.45, 0.185);
  } else if (type === 'duct') {
    const gm = new THREE.MeshStandardMaterial({ color: 0x8fa0b3, transparent: true, opacity: 0.2, depthWrite: false });
    B(1.1, 0.3, 0.7, gm, 0, 0.2, 0).castShadow = false;
  }
  if (U) { U.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(U.root); }
  return { g, grille, U };
}

/* ---------------- viewer ---------------- */
export function createStudio3D(container, opts = {}) {
  const o = { theme: 'light', onFrame: null, ...opts };
  const dark = o.theme === 'dark', bp = o.theme === 'blueprint';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = bp ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 0.95 : 1.05;
  renderer.shadowMap.enabled = !bp; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = dark ? 0.35 : 0.55;
  glTrack(renderer, container, { scene, name: 'สตูดิโอเครื่อง', onScale: () => resize() });   // r15: point sizes follow the pixel ratio   // B1: context budget (gl-pool)
  const hemi = new THREE.HemisphereLight(0xffffff, dark ? 0x1a2230 : 0x8a8f99, dark ? 0.55 : bp ? 1.6 : 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; scene.add(sun); scene.add(sun.target);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  const P = palette(o.theme), M = materialSet(bp ? 'blueprint' : dark ? 'showroom' : 'studio');
  const room = new THREE.Group(); scene.add(room);
  const st = { theta: 0.6, phi: 1.0, radius: 9, target: V3(0, 1, 0), minR: 2, maxR: 80, wheelZoom: false, userAt: 0 };
  orbit(renderer.domElement, st, () => {});

  // state
  let S = { w: 4, d: 3.5, h: 2.6, sun: 1, people: 2 }, scn = null, U = { type: 'wall', n: 1 };
  let units = [], emitters = [], heatSpots = [], seats = [], peopleG = null, ceilingM = null, heatPlane = null, floorMesh = null;
  const layers = { air: true, heat: true, dust: true, marks: true };
  let dirt = 0, running = true, Troom = 32, capRatio = 1, airF = 1;

  // heat map texture
  let NX = 96, NZ = 72, heatData = new Uint8Array(NX * NZ * 4), heatTex = null;
  function makeHeatTex() {
    NZ = clamp(Math.round(NX * S.d / S.w), 24, 128); heatData = new Uint8Array(NX * NZ * 4);
    heatTex && heatTex.dispose(); heatTex = new THREE.DataTexture(heatData, NX, NZ); heatTex.colorSpace = THREE.SRGBColorSpace; heatTex.magFilter = heatTex.minFilter = THREE.LinearFilter; heatTex.needsUpdate = true;
  }
  const RAMP = [[0.13, 0.36, 0.92], [0.18, 0.72, 0.95], [0.55, 0.9, 0.75], [0.98, 0.86, 0.4], [0.97, 0.52, 0.22], [0.86, 0.2, 0.18]];
  const colorFor = t => { const k = clamp((t - 21) / 13, 0, 1) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(k)), r = k - i; return RAMP[i].map((c, j) => lerp(c, RAMP[i + 1][j], r)); };

  // particles
  const airPts = makePoints(8, dark); airPts.visible = false;   // legacy point sprites (kept for the resize hook)
  const air = createAirflow(scene, { count: 2400, dark, width: 0.026, trail: 0.2 });
  const dustPts = makePoints(1100, false); scene.add(dustPts);
  let airP = null, dustP = null;

  function clearRoom() { room.traverse(ob => { if (ob.geometry) ob.geometry.dispose(); }); room.clear(); }

  function buildRoom() {
    clearRoom();
    const { w, d, h } = S; const ind = scn.g === 'ind';
    // floor slab + texture
    const ft = floorTex(bp ? 'grid' : FLOOR_KIND[scn.id] || 'tile', bp ? 0xfbfcfe : scn.floor); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(w / (ind ? 6 : 2.5), d / (ind ? 6 : 2.5));
    floorMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.85 })); floorMesh.position.y = -0.05; floorMesh.receiveShadow = true; room.add(floorMesh);
    heatPlane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: heatTex, transparent: true, opacity: dark ? 0.62 : 0.55, depthWrite: false })); heatPlane.rotation.x = -Math.PI / 2; heatPlane.position.y = 0.012; heatPlane.renderOrder = 2; room.add(heatPlane);
    // walls
    const wm = new THREE.MeshStandardMaterial({ color: bp ? 0xf4f7fb : scn.wall, roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h, 0.12), wm); back.position.set(0, h / 2, -d / 2 - 0.06); back.receiveShadow = true; room.add(back);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, d), wm); left.position.set(-w / 2 - 0.06, h / 2, 0); left.receiveShadow = true; room.add(left);
    const base = new THREE.MeshStandardMaterial({ color: dark ? 0x39404a : 0xd8d4cd }); [[w, 0.1, 0.02, 0, 0.05, -d / 2 + 0.01], [0.02, 0.1, d, -w / 2 + 0.01, 0.05, 0]].forEach(([a, b, c, x, y, z]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), base); m.position.set(x, y, z); room.add(m); });
    if (ind) { const rib = new THREE.MeshStandardMaterial({ color: 0xc9cfd4, roughness: 0.6, metalness: 0.3 }); for (let x = -w / 2 + 1; x < w / 2; x += 1.2) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.03), rib); m.position.set(x, h / 2, -d / 2 + 0.02); room.add(m); } }
    // windows on the left wall (sun side)
    const winW = [0.9, 1.6, 2.6][S.sun] * (ind ? 2 : 1), winH = ind ? 1.4 : 1.35, glass = new THREE.MeshBasicMaterial({ color: dark ? 0x28435e : 0xdff1ff }), frame = new THREE.MeshStandardMaterial({ color: dark ? 0x5a6675 : 0x8e99a6 });
    const OR = ORIENT_BY_ID[S.orient] || ORIENT_BY_ID.E, sunK = S.closed ? 0.25 : OR.sun;
    const nWin = S.closed ? 0 : Math.max(1, Math.floor(d / (winW + 1.6)));
    winMarks = [];
    for (let i = 0; i < nWin; i++) { const z = -d / 2 + (i + 0.5) * (d / nWin); const y = ind ? h - 1.4 : 1.5;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glass); gl.rotation.y = Math.PI / 2; gl.position.set(-w / 2 + 0.005, y, z); room.add(gl);
      [[0.06, winH + 0.08, 0.06, 0, -winW / 2], [0.06, winH + 0.08, 0.06, 0, winW / 2], [0.06, 0.06, winW, winH / 2, 0], [0.06, 0.06, winW, -winH / 2, 0], [0.04, winH, 0.04, 0, 0]].forEach(([a, b, c, dy, dz]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), frame); m.position.set(-w / 2 + 0.02, y + dy, z + dz); room.add(m); });
      heatSpotsBase.push({ x: -w / 2 + 0.6, z, r: 1.1 + S.sun * 0.4, a: [0.3, 1.3, 2.6][S.sun] * sunK });
      winMarks.push(V3(-w / 2 + 0.05, y + winH / 2 + 0.25, z));
    }
    // closed room: one door, no windows
    if (S.closed) { const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.9), new THREE.MeshStandardMaterial({ color: dark ? 0x5b4a3a : 0x8a6a4c, roughness: 0.7 })); door.position.set(-w / 2 + 0.03, 1.05, -d / 2 + 1.0); room.add(door); winMarks.push(V3(-w / 2 + 0.05, 2.35, -d / 2 + 1.0)); }
    // top floor under a sun-heated roof: warm plane above the ceiling + down arrows
    if (S.roof) { const rp = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: dark ? 0.16 : 0.12, side: THREE.DoubleSide, depthWrite: false })); rp.rotation.x = -Math.PI / 2; rp.position.y = h + 0.02; room.add(rp);
      const am = new THREE.MeshBasicMaterial({ color: 0xf06a28, transparent: true, opacity: 0.75 }); const nx = Math.max(2, Math.round(w / 2.2)), nz = Math.max(2, Math.round(d / 2.2));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.08 * Math.max(1, w / 8), 0.3 * Math.max(1, w / 8), 10), am); c.rotation.x = Math.PI; c.position.set(-w / 2 + (i + 0.5) * w / nx, h + 0.35, -d / 2 + (j + 0.5) * d / nz); room.add(c); }
      heatSpotsBase.push({ x: 0, z: 0, r: Math.max(w, d), a: 0.9 }); }
    // compass: the window wall (-x) faces the chosen orientation
    { const az = { N: 0, E: 90, S: 180, W: 270 }[S.orient] ?? 270, a = az * Math.PI / 180; const cs = clamp(Math.max(w, d) / 10, 0.35, 1.6);
      const cg = new THREE.Group(); const pl = new THREE.Mesh(new THREE.PlaneGeometry(cs * 2, cs * 2), new THREE.MeshBasicMaterial({ map: compassTex(dark), transparent: true, depthWrite: false })); pl.rotation.x = -Math.PI / 2; cg.add(pl);
      cg.rotation.y = Math.atan2(Math.cos(a), -Math.sin(a)); cg.position.set(w / 2 - cs * 1.15, 0.02, d / 2 - cs * 1.15); cg.renderOrder = 3; room.add(cg);
      northMark = V3(w / 2 - cs * 1.15 - Math.cos(a) * cs * 1.05, 0.05, d / 2 - cs * 1.15 + Math.sin(a) * cs * 1.05); }
    if (ind) { const lamp = new THREE.MeshBasicMaterial({ color: 0xfff6dd }); for (let x = -w / 2 + 3; x < w / 2; x += 5) for (let z = -d / 2 + 3; z < d / 2; z += 5) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 16), lamp); m.position.set(x, h - 0.6, z); room.add(m); } }
    // furniture
    const fg = new THREE.Group(); room.add(fg);
    const out = FURN[scn.furn](Kit(fg, P), P, S);
    seats = out.seats; heatSpotsBase.push(...out.heat);
    // furniture footprints: walkers avoid them, air flows over/around them
    furnBoxes = []; const bb = new THREE.Box3(); fg.updateMatrixWorld(true);
    fg.traverse(m => { if (!m.isMesh) return; bb.setFromObject(m); const hh = bb.max.y - bb.min.y, a = (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z); if (bb.max.y < 0.3 || a > w * d * 0.35 || a < 0.02) return; furnBoxes.push({ minX: bb.min.x, maxX: bb.max.x, minY: bb.min.y, maxY: bb.max.y, minZ: bb.min.z, maxZ: bb.max.z }); });
    // sun direction: from the window side
    const R = Math.max(w, d);
    const elev = S.closed || S.orient === 'none' || S.orient === 'N' ? 1.3 : S.orient === 'S' ? 0.85 : 0.42;
    sun.position.set(-w / 2 - R * 0.6, h + R * elev, d * 0.1); sun.target.position.set(0, 0, 0);
    sun.intensity = (dark ? [0.4, 0.8, 1.3][S.sun] : [1.0, 1.9, 2.8][S.sun]) * (S.closed ? 0.45 : clamp(OR.sun, 0.45, 1.15)) + (S.roof ? 0.35 : 0);
    sun.color.set(S.orient === 'W' && !S.closed ? 0xffc98a : S.orient === 'E' && !S.closed ? 0xffe7c2 : 0xfff1dc);
    const sc = sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 0.5; sc.far = R * 4; sc.updateProjectionMatrix();
    // ceiling guide (only where the unit sits in the ceiling)
    ceilingM = null;
    // camera framing
    st.target.set(w * 0.04, Math.min(h, 3.2) * 0.38, d * 0.02); st.radius = Math.max(w, d) * 1.28 + h * 0.9; st.minR = st.radius * 0.45; st.maxR = st.radius * 1.8;
  }
  let heatSpotsBase = [], winMarks = [], northMark = null, furnBoxes = [];

  // animated occupants (people3d.js): sit / type at desks / lie / stand / walk on a free path; they fan themselves where the air is warm
  const crowd = createCrowd(scene, { max: 64, flat: bp, shadows: !bp });
  function buildPeople() {
    const n = Math.min(S.people, 60); heatSpots = heatSpotsBase.slice(); peopleAt = null;
    const list = [];
    const deskAhead = (x, z, ry) => { const fx = x + Math.sin(ry) * 0.55, fz = z + Math.cos(ry) * 0.55; return furnBoxes.some(b => b.maxY > 0.66 && b.maxY < 0.82 && fx > b.minX - 0.15 && fx < b.maxX + 0.15 && fz > b.minZ - 0.15 && fz < b.maxZ + 0.15); };
    let walkers = 0;
    for (let i = 0; i < n; i++) {
      let [x, z, pose, ry, sy] = seats[i % Math.max(1, seats.length)] || [0, 0];
      const extra = i >= seats.length;
      if (extra) { x += ((i * 37) % 7 - 3) * 0.35; z += ((i * 53) % 5 - 2) * 0.35; pose = undefined; ry = undefined; }
      x = clamp(x, -S.w / 2 + 0.3, S.w / 2 - 0.3); z = clamp(z, -S.d / 2 + 0.3, S.d / 2 - 0.3);
      if (ry === undefined) ry = Math.atan2(-x, -z) + ((i * 29) % 7 - 3) * 0.12;   // face the middle of the room
      if (pose === 'lie') list.push({ x, y: 0.62, z: z + 0.86, ry: 0, pose: 'lie' });
      else if (pose === 'sit') list.push({ x, y: sy || 0, z, ry, pose: 'sit', desk: deskAhead(x, z, ry) });
      else { const path = walkers < Math.max(1, Math.round(n * 0.25)) && (i % 2 === 0) ? freePath(x, z, furnBoxes, S.w, S.d, (i * 0.37) % 1, 1.4, Math.min(5, Math.max(S.w, S.d) * 0.45)) : null;
        if (path) { walkers++; list.push({ x, z, pose: 'walk', path }); } else list.push({ x, z, ry, pose: 'stand' }); }
      if (!peopleAt) peopleAt = V3(x, pose === 'lie' ? 1.1 : pose === 'sit' ? 1.55 + (sy || 0) : 1.95, pose === 'lie' ? z + 0.3 : z);
      heatSpots.push({ x, z, r: 0.55, a: 0.5 });
    }
    crowd.set(list);
    rebuildMarks();
  }
  let peopleAt = null;

  /* ---------- symbols projected from 3D ---------- */
  const marksEl = document.createElement('div'); marksEl.className = 'st-marks'; marksEl.setAttribute('aria-hidden', 'true'); container.appendChild(marksEl);
  let marks = [];
  const tmpV = new THREE.Vector3();
  function rebuildMarks() {
    if (!scn) return;
    const list = [], OR = ORIENT_BY_ID[S.orient] || ORIENT_BY_ID.E;
    if (S.closed) list.push({ k: 'closed', v: winMarks[0] || V3(-S.w / 2, 2.3, 0), t: 'ห้องปิดทึบ · ประตูเดียว ไม่มีช่องลมใหม่' });
    else if (winMarks[0]) list.push({ k: 'sun', v: winMarks[0], t: `${OR.long} · ${GLASS[S.sun ?? 1].th}` });
    if (S.roof) list.push({ k: 'roof', v: V3(0, S.h + 0.7, 0), t: 'ใต้หลังคา · ความร้อนจากหลังคา' });
    const seen = new Set(); heatSpotsBase.forEach(hs => { if (hs.lab && !seen.has(hs.lab)) { seen.add(hs.lab); list.push({ k: 'heat', v: V3(hs.x, 1.3, hs.z), t: hs.lab }); } });
    if (peopleAt && S.people) list.push({ k: 'people', v: peopleAt, t: `${S.people} คน` });
    units.filter(u => u.type !== 'ductbox').slice(0, 3).forEach((u, i) => list.push({ k: 'ac', v: u.g.position.clone().add(V3(0, u.type === 'floor' ? 2.05 : 0.32, 0)), t: `${TYPE_RULES[u.type]?.th || ''} ${U.per ? Math.round(U.per / 1000) + 'k BTU' : ''}${i === 0 && U.n > 1 ? ` × ${U.n}` : ''}` }));
    if (U.type === 'duct' && units[0]) list.push({ k: 'ac', v: V3(0, S.h + 0.25, -S.d / 2 + 0.6), t: `ท่อลม ${U.per ? Math.round(U.per / 1000) + 'k BTU' : ''} × ${U.n}` });
    if (northMark) list.push({ k: 'north', v: northMark, t: 'N' });
    marksEl.innerHTML = '';
    marks = list.map(m => { const el = document.createElement('div'); el.className = 'st-mk ' + m.k; const sp = document.createElement('span'); sp.textContent = m.t; el.append(document.createElement('i'), sp); marksEl.append(el); return { v: m.v, el }; });
  }
  function placeMarks() {
    marksEl.hidden = !layers.marks; if (!layers.marks) return;
    const W = container.clientWidth, H = container.clientHeight;
    const placed = [];
    marks.forEach(m => { tmpV.copy(m.v).project(camera); m.ok = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05; m.x = (tmpV.x + 1) / 2 * W; m.y = (1 - tmpV.y) / 2 * H; m.w = m.w || (m.el.lastChild.offsetWidth || 120); m.dx = (m.x - m.w / 2 < 6) ? 6 + m.w / 2 - m.x : (m.x + m.w / 2 > W - 6) ? W - 6 - m.w / 2 - m.x : 0; });   // keep chips inside the stage
    // nudge chips upward until they no longer overlap the ones already placed (the dot stays on the true point)
    marks.filter(m => m.ok).sort((a, b) => b.y - a.y).forEach(m => { let dy = 0; for (let k = 0; k < 8; k++) { const top = m.y - dy - 30, hit = placed.find(p => Math.abs(p.x - (m.x + m.dx)) < (p.w + m.w) / 2 + 4 && Math.abs(p.top - top) < 22); if (!hit) break; dy += 22 - Math.abs(hit.top - top) + 2; } m.dy = dy; placed.push({ x: m.x + m.dx, w: m.w, top: m.y - dy - 30 }); });
    marks.forEach(m => { m.el.style.display = m.ok ? '' : 'none'; if (m.ok) { m.el.style.transform = `translate(${m.x.toFixed(1)}px,${m.y.toFixed(1)}px)`; m.el.lastChild.style.marginBottom = (m.dy || 0) + 'px'; m.el.lastChild.style.marginLeft = (m.dx || 0).toFixed(1) + 'px'; } });
  }

  // where units go: throw along the long side of the room, never through the opposite wall; wall units above the window line
  // r15: the units a layout replaces are freed (geometry + their own tint materials; the shared sets stay) — they used to stay
  // on the GPU after every change of type, count or room size
  const shared = new Set([...Object.values(M), ...Object.values(P)].filter(m => m && m.isMaterial));
  function layoutUnits() {
    units.forEach(u => { room.remove(u.g); disposeLater(u.g, shared); }); units = []; emitters = [];
    if (ceilingM) { room.remove(ceilingM); ceilingM = null; }
    const { w, d, h } = S; const type = U.type; const n = U.n;
    const pos = [];
    const mountLeft = scn.mount ? scn.mount === 'left' : (w > d * 1.15 && !(type === 'wall' && h < 2.65 && !S.closed));
    const alongWall = (count, y, inset, left) => {
      const L = left ? d : w, per = Math.max(1, Math.floor((L - 0.8) / (type === 'ceiling' ? 2.6 : 2.2)) + 1);
      const rows = Math.ceil(count / per), depth = left ? w : d, gapR = Math.min(9, depth / rows);
      let k = 0;
      for (let r = 0; r < rows; r++) { const m = Math.min(per, count - k);
        for (let i = 0; i < m; i++, k++) { const t = m === 1 ? (scn.at != null && r === 0 ? scn.at : (left ? 0.1 : -0.15) * L) : -L / 2 + 0.9 + i * ((L - 1.8) / (m - 1)); const off = inset + r * gapR;
          pos.push(left ? { x: -w / 2 + off, y, z: t, ry: Math.PI / 2 } : { x: t, y, z: -d / 2 + off, ry: 0 }); } }
    };
    if (type === 'wall') alongWall(n, Math.min(h - 0.28, 2.45), 0.13, mountLeft && h >= 2.65);
    else if (type === 'ceiling') alongWall(n, Math.min(h, 4.2) - 0.1175 - 0.02, 0.36, mountLeft);
    else if (type === 'floor') alongWall(n, 0, 0.2, false);
    else if (type === 'cassette' || type === 'duct') {
      const cells = type === 'duct' ? clamp(Math.round(w * d / 14), Math.max(2, n), 30) : n;
      const cols = Math.max(1, Math.round(Math.sqrt(cells * w / d))), rows = Math.ceil(cells / cols);
      let k = 0; for (let r = 0; r < rows; r++) { const inRow = Math.min(cols, cells - k); for (let c = 0; c < inRow; c++, k++) pos.push({ x: -w / 2 + (c + 0.5) * w / inRow, y: h - 0.002, z: -d / 2 + (r + 0.5) * d / rows, ry: 0, diff: type === 'duct' }); }
      const cm = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: dark ? 0x8fb6d9 : 0x9fb0c3, transparent: true, opacity: dark ? 0.05 : 0.07, side: THREE.DoubleSide, depthWrite: false }));
      cm.rotation.x = Math.PI / 2; cm.position.y = h; ceilingM = cm; room.add(cm);
      if (type === 'duct') for (let i = 0; i < n; i++) { const { g } = unitMesh('duct', P, M); g.position.set(-w / 2 + (i + 0.5) * w / n, h, -d / 2 + 0.6); room.add(g); units.push({ g, grille: [], type: 'ductbox' }); }
    }
    pos.forEach(p => {
      let g, grille = [], Uu = null;
      if (p.diff) { g = new THREE.Group(); const pan = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.55), P.shell); const gr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.01, 0.4), new THREE.MeshStandardMaterial({ color: 0xdfe4ea })); gr.position.y = -0.012; g.add(pan, gr); grille.push({ m: gr.material, base: gr.material.color.clone() }); }
      else ({ g, grille, U: Uu } = unitMesh(type, P, M, { rod: Math.max(0, h - (p.y + 0.1175)) }));
      g.position.set(p.x, p.y, p.z); g.rotation.y = p.ry; room.add(g);
      const u = { g, grille, type, p, U: Uu }; units.push(u);
      const fwd = V3(Math.sin(p.ry), 0, Math.cos(p.ry)), right = V3(Math.cos(p.ry), 0, -Math.sin(p.ry));
      const mk = (origin, dir, rgt, prof, spread) => emitters.push({ origin, dir, rgt, prof, spread, unit: u });
      if (type === 'wall') mk(V3(p.x, p.y - 0.13, p.z).addScaledVector(fwd, 0.12), fwd, right, 'wall', 0.42);
      else if (type === 'ceiling') mk(V3(p.x, p.y - 0.055, p.z).addScaledVector(fwd, 0.36), fwd, right, 'ceiling', 0.34);
      else if (type === 'floor') mk(V3(p.x, 1.74, p.z).addScaledVector(fwd, 0.2), fwd, right, 'floor', 0.22);
      else { [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([a, b]) => { const dv = V3(a, 0, b), rv = V3(b, 0, -a); mk(V3(p.x, p.y - 0.045, p.z).addScaledVector(dv, p.diff ? 0.2 : 0.4), dv, rv, p.diff ? 'diff' : 'cassette', p.diff ? 0.18 : 0.46); }); }
    });
    rebuildPaths(); seedAir(); syncAir(); rebuildMarks();
  }

  // emitter paths depend on airflow (dirt) and on the room walls — the jet never passes through a wall
  function rebuildPaths() {
    const { w, d, h } = S; const af = airF;
    const avail = e => { const o = e.origin, v = e.dir; const tx = v.x > 1e-3 ? (w / 2 - o.x) / v.x : v.x < -1e-3 ? (-w / 2 - o.x) / v.x : 1e9, tz = v.z > 1e-3 ? (d / 2 - o.z) / v.z : v.z < -1e-3 ? (-d / 2 - o.z) / v.z : 1e9; return Math.max(0.8, Math.min(tx, tz) - 0.25); };
    emitters.forEach(e => {
      const y0 = e.origin.y, A = avail(e); let F, Y;
      if (e.prof === 'wall') { const L = Math.min(A, Math.max(1.2, 6.5 * af)); F = [0, 0.1, 0.3, 0.55, 0.8, 1]; Y = [y0, y0 - 0.25, y0 - 0.7, Math.max(1.0, y0 - 1.25), 0.65, 0.35]; e.len = L; e.swing = 0.25; F = F.map(k => k * L); }
      else if (e.prof === 'ceiling') { const L = Math.min(A, Math.max(2, 10 * af)); F = [0, 0.1, 0.35, 0.6, 0.82, 1]; Y = [y0, y0 - 0.04, y0 - 0.08 - (1 - af) * 0.5, y0 * 0.72, Math.max(0.6, y0 * 0.35), 0.35]; e.len = L; e.swing = 0.18; F = F.map(k => k * L); }
      else if (e.prof === 'floor') { const L = Math.min(A, Math.max(1.5, 6.5 * af)); const up = Math.min(h - 2.1, 0.9); F = [0, 0.08, 0.35, 0.7, 1].map(k => k * L); Y = [y0, y0 + 0.35, y0 + up * af, y0 + 0.1, y0 - 1.3]; e.len = L; e.swing = 0.1; }
      else if (e.prof === 'cassette') { const L = Math.min(A, Math.max(1, 4.2 * af)); F = [0, 0.12, 0.4, 0.62, 0.85, 1]; Y = [y0 - 0.02, y0 - 0.05, y0 - 0.12 - (1 - af) * 0.4, y0 * 0.7, Math.max(0.6, y0 * 0.32), 0.35]; F = F.map(k => k * L); e.len = L; e.swing = 0.12; }
      else { const L = Math.min(A, Math.max(0.6, 1.5 * af)); F = [0, 0.2, 0.5, 0.8, 1].map(k => k * L); Y = [y0, y0 - 0.12, y0 * 0.65, y0 * 0.3, 0.45]; e.len = L; e.swing = 0; }
      const pts = F.map((f, i) => e.origin.clone().addScaledVector(e.dir, f).setY(Y[i]));
      pts.forEach(p => { p.x = clamp(p.x, -w / 2 + 0.1, w / 2 - 0.1); p.z = clamp(p.z, -d / 2 + 0.1, d / 2 - 0.1); p.y = clamp(p.y, 0.08, h - 0.02); });
      e.lut = new THREE.CatmullRomCurve3(pts).getSpacedPoints(60);
      e.end = pts[pts.length - 1];
    });
  }
  // airflow model (airflow3d.js): one jet per outlet, return to the unit's intake grille
  const KIND = { wall: { v0: 3.6, w: 0.72, in: (p, f) => V3(p.x, p.y + 0.16, p.z).addScaledVector(f, 0.05) }, ceiling: { v0: 4.8, w: 1.1, in: (p, f) => V3(p.x, p.y - 0.1, p.z).addScaledVector(f, -0.22) },
    cassette: { v0: 3.1, w: 0.62, in: p => V3(p.x, p.y - 0.06, p.z) }, floor: { v0: 3.4, w: 0.42, in: (p, f) => V3(p.x, 0.35, p.z).addScaledVector(f, 0.22) }, diff: { v0: 1.7, w: 0.36, in: p => V3(p.x, p.y - 0.06, p.z) } };
  function syncAir() {
    air.setRoom({ w: S.w, d: S.d, h: S.h, x0: 0, z0: 0 }); air.obstacles(furnBoxes);
    air.setScale(clamp(Math.max(S.w, S.d) / 7, 1, 2.6));
    air.setEmitters(emitters.map(e => { const k = KIND[e.prof] || KIND.wall; const p = e.unit.g.position; return { o: e.origin.clone(), f: e.dir.clone(), r: e.rgt.clone(), width: k.w, kind: e.prof, v0: k.v0, intake: k.in(p, e.dir) }; }));
    air.set({ airF, dirt, running, roomT: Troom, supplyT: 13.5 + dirt * 3, dark, swing: true, fan: 1 });
    air.prewarm(160, 0.05);   // r8: settle once, draw once (was 160 full draws)
  }
  let heatEnds = [], heatPerE = 0;
  function heatAt(x, z) {
    let t = Troom;
    for (const s of heatSpots) { const q = ((x - s.x) ** 2 + (z - s.z) ** 2) / (s.r * s.r); if (q < 9) t += s.a * Math.exp(-q); }
    let c = 0; for (const e of heatEnds) { const q = ((x - e.x) ** 2 + (z - e.z) ** 2) / (e.r * e.r); const q2 = ((x - e.mx) ** 2 + (z - e.mz) ** 2) / (e.r * e.r * 0.6); c += Math.exp(-q) + 0.45 * Math.exp(-q2); }
    return t - heatPerE * Math.min(1.6, c) * clamp((Troom - 22) / 8, 0.3, 1);
  }
  function seedAir() {
    const N = airPts.geometry.attributes.alpha.count;
    airP = { u: new Float32Array(N), e: new Uint16Array(N), jx: new Float32Array(N), jy: new Float32Array(N), sp: new Float32Array(N) };
    for (let i = 0; i < N; i++) { airP.u[i] = Math.random(); airP.e[i] = emitters.length ? i % emitters.length : 0; airP.jx[i] = (Math.random() - 0.5) * 2; airP.jy[i] = (Math.random() - 0.5) * 2; airP.sp[i] = 0.75 + Math.random() * 0.5; }
    const ps = airPts.geometry.attributes.psize.array; for (let i = 0; i < N; i++) ps[i] = (dark ? 0.07 : 0.06) * (0.7 + Math.random() * 0.6) * Math.min(2.2, Math.max(1, Math.max(S.w, S.d) / 8));
    airPts.geometry.attributes.psize.needsUpdate = true;
  }
  function seedDust() {
    const N = dustPts.geometry.attributes.alpha.count; const { w, d, h } = S;
    dustP = { base: new Float32Array(N * 3), ph: new Float32Array(N) };
    const pos = dustPts.geometry.attributes.position.array, col = dustPts.geometry.attributes.pcol.array, ps = dustPts.geometry.attributes.psize.array;
    const c = new THREE.Color(dark ? 0xd9c29a : bp ? 0x8a6d4a : 0x7a6247);
    for (let i = 0; i < N; i++) { dustP.base[i * 3] = (Math.random() - 0.5) * w; dustP.base[i * 3 + 1] = 0.2 + Math.random() * (Math.min(h, 4) - 0.3); dustP.base[i * 3 + 2] = (Math.random() - 0.5) * d; dustP.ph[i] = Math.random() * 100;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; ps[i] = 0.028 * (0.6 + Math.random()) * Math.min(2.5, Math.max(1, Math.max(w, d) / 7)); pos[i * 3 + 1] = -99; }
    dustPts.geometry.attributes.pcol.needsUpdate = true; dustPts.geometry.attributes.psize.needsUpdate = true;
  }

  const cCold = new THREE.Color(dark ? 0x62dcff : 0x14a3e6), cWarm = new THREE.Color(dark ? 0xcfefff : 0x9fd6f0), cGrey = new THREE.Color(0x8d969e), tmpC = new THREE.Color();
  function stepAir(dt) {
    const on = layers.air && running && emitters.length; air.visible(!!on); if (!on) return;
    const hs = heatSpotsBase.map(p => ({ x: p.x, y: 0.9, z: p.z, r: Math.min(0.9, p.r * 0.6), k: clamp(p.a / 2.6, 0.2, 1) }));
    crowd.heads().forEach((p, i) => { if (i < 40) hs.push({ x: p.x, y: p.y - 0.1, z: p.z, r: 0.12, k: 0.55 }); });
    air.setSources(hs); air.set({ airF, dirt, running, roomT: Troom, supplyT: 13.5 + dirt * 3, dark });
    air.update(dt, clock);
  }
  let dustT = 0;
  function stepDust(dt) {
    const N = dustP.ph.length; const shown = layers.dust ? Math.round(N * clamp(dirt * 1.05, 0, 1)) : 0; dustPts.visible = shown > 0; if (!shown) return;
    dustT += dt; const pos = dustPts.geometry.attributes.position.array, al = dustPts.geometry.attributes.alpha.array;
    const intakes = units.filter(u => u.type !== 'ductbox').map(u => u.g.position);
    for (let i = 0; i < N; i++) {
      if (i >= shown) { al[i] = 0; pos[i * 3 + 1] = -99; continue; }
      const t = dustT * 0.25 + dustP.ph[i];
      let x = dustP.base[i * 3] + Math.sin(t * 0.9) * 0.25, y = dustP.base[i * 3 + 1] + Math.sin(t * 0.6 + i) * 0.12, z = dustP.base[i * 3 + 2] + Math.cos(t * 0.7) * 0.25;
      // drift toward the nearest intake (suction)
      if (running && intakes.length) { let best = null, bd = 1e9; for (const q of intakes) { const dd = (q.x - x) ** 2 + (q.y - y) ** 2 + (q.z - z) ** 2; if (dd < bd) { bd = dd; best = q; } }
        const pull = clamp(1.8 - Math.sqrt(bd), 0, 1.8) / 1.8; const ph = (t * 0.35) % 1; x = lerp(x, best.x, pull * ph * 0.8); y = lerp(y, best.y, pull * ph * 0.8); z = lerp(z, best.z, pull * ph * 0.8); }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; al[i] = 0.55 + 0.35 * Math.sin(t * 2 + i);
    }
    dustPts.geometry.attributes.position.needsUpdate = true; dustPts.geometry.attributes.alpha.needsUpdate = true;
  }
  let heatAcc = 0;
  function stepHeat(dt) {
    heatAcc += dt; if (heatAcc < 0.12) return; heatAcc = 0;
    const { w, d } = S; const cool = running ? 4.2 * capRatio : 0;
    heatEnds = emitters.map(e => ({ x: e.end.x, z: e.end.z, mx: e.lut[36].x, mz: e.lut[36].z, r: 0.6 + e.len * 0.28 }));
    heatPerE = heatEnds.length ? cool / Math.max(1, Math.sqrt(heatEnds.length)) : 0;
    heatPlane && (heatPlane.visible = layers.heat); if (!layers.heat) return;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = (i / (NX - 1) - 0.5) * w, z = (j / (NZ - 1) - 0.5) * d;
      const k = ((NZ - 1 - j) * NX + i) * 4; const cc = colorFor(heatAt(x, z));
      heatData[k] = cc[0] * 255; heatData[k + 1] = cc[1] * 255; heatData[k + 2] = cc[2] * 255; heatData[k + 3] = 255;
    }
    heatTex.needsUpdate = true;
  }
  function tintUnits() {
    const dc = new THREE.Color(0x6b5238);
    units.forEach(u => u.grille.forEach(gm => gm.m.color.copy(gm.base).lerp(dc, dirt * 0.85)));
  }

  // render loop
  function resize() { const W = container.clientWidth || 1, H = container.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    const sc = H * renderer.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); airPts.material.uniforms.uScale.value = sc; dustPts.material.uniforms.uScale.value = sc; }
  new ResizeObserver(resize).observe(container); resize();
  let vis = true; new IntersectionObserver(es => vis = es[0].isIntersecting).observe(container);
  let last = performance.now(), raf, paused = false, clock = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    if (!vis || document.hidden || paused || !scn) return;
    const rm = RM();
    if (!rm && performance.now() - st.userAt > 5000) st.theta += (0.6 + Math.sin(now / 11000) * 0.28 - st.theta) * 0.02;
    const sp = Math.sin(st.phi), R = st.radius * Math.max(1, 1.35 / camera.aspect);
    camera.position.set(st.target.x + R * sp * Math.sin(st.theta), st.target.y + R * Math.cos(st.phi), st.target.z + R * sp * Math.cos(st.theta));
    camera.lookAt(st.target);
    const ddt = rm ? 0 : dt; clock += ddt;
    units.forEach(u => { if (u.U && running) animateUnit(u.U, ddt, clock, airF); });
    stepHeat(dt); crowd.update(ddt, clock, (x, z) => heatAt(x, z) - 1.2); stepAir(ddt); stepDust(ddt);
    o.onFrame && o.onFrame(dt);
    renderer.render(scene, camera); placeMarks();
  }
  raf = requestAnimationFrame(frame);
  // r15: compile the other unit types' shaders once the visitor pauses (one type at a time), so choosing another type of
  // air conditioner does not stall on the GPU; the sample units' geometry is freed again, their materials (and so the compiled programs) stay
  const preDone = new Set();
  function preload() {
    const t = ['wall', 'ceiling', 'cassette', 'floor'].find(k => k !== U.type && !preDone.has(k)); if (!t) return;
    whenCalm(() => { preDone.add(t); const { g } = unitMesh(t, P, M, { rod: 0.3 }); g.position.set(0, 1.5, 0); warm(renderer, scene, camera, g); freeGeometry(g); preload(); }, 1500);
  }
  setTimeout(preload, 2500);

  return {
    setScene(s, params) { scn = s; S = { ...params }; heatSpotsBase = []; makeHeatTex(); buildRoom(); buildPeople(); layoutUnits(); seedDust(); tintUnits(); },
    setParams(params) { const re = ['w', 'd', 'h', 'sun', 'orient', 'roof', 'closed'].some(k => params[k] !== S[k]); const pe = params.people !== S.people; S = { ...params };
      if (re) { heatSpotsBase = []; makeHeatTex(); buildRoom(); buildPeople(); layoutUnits(); seedDust(); tintUnits(); } else if (pe) buildPeople(); },
    setUnits(u) { U = { ...u }; layoutUnits(); tintUnits(); },
    setDirt(v) { dirt = clamp(v, 0, 1); const a = 1 - 0.35 * dirt; if (Math.abs(a - airF) > 0.01) { airF = a; rebuildPaths(); } tintUnits(); air.set({ airF, dirt, supplyT: 13.5 + dirt * 3 }); },
    setCap(r) { capRatio = r; }, setTemp(t) { Troom = t; }, setRunning(v) { running = !!v; },
    setLayer(k, v) { layers[k] = !!v; },
    zoom(f) { st.radius = clamp(st.radius * f, st.minR, st.maxR); st.userAt = performance.now(); },
    resetView() { st.theta = 0.6; st.phi = 1.0; st.userAt = 0; if (scn) st.radius = Math.max(S.w, S.d) * 1.28 + S.h * 0.9; },
    pause(v) { paused = !!v; marksEl.hidden = !!v || !layers.marks; },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
