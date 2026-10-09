// SBP AirCare — the job scene: a two-man crew cleaning or installing one indoor unit on a real site (Rev.09 round 4, owner
// 1 ต.ค. 2569: "งานล้างแบบ 3D ให้สมจริง ใส่ตัวคนล้างพร้อมเสื่อมีตรา FUJIVA ส่วนตัวแอร์ไม่ต้องใส่ยี่ห้อ … movement เหมือนช่างจริงทำงาน
// เป็นทีมทุกขั้นตอน … แอร์แขวนใต้ฝ้า สี่ทิศทาง ตู้ตั้ง … งานติดตั้ง: ติดผนัง = ห้องบ้าน · แขวน = ร้านค้า/ออฟฟิศ · สี่ทิศทาง = คาเฟ่ /
// พื้นที่มีมูลค่า · ตู้ตั้ง = ห้องประชุม / โถงรับลูกค้า"). Replaces cleanguide3d.js.
// The venue follows the unit type. The customer's units carry no brand. The crew (crew3d.js): the lead works at the unit
// (ladder), the assistant receives every removed part, carries it to the parts table, washes it, holds the bag hose, works
// the condensing unit; the customer watches and signs. Company marks stay small and where a real crew carries them: the
// FUJIVA work mat, SBP AirCare uniforms / tool box / cleaning-bag print / service sign / tablet report.
// Water = droplets + mist, air = soft wisps (airflow3d), dirt is illustrative. Every state comes from jobguide.js.
import * as THREE from './three.module.min.js';
import { track as glTrack, disposeDeep, disposeLater, freeGeometry, warm, whenCalm } from './gl-pool.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { materialSet, buildPremiumIndoor, buildOutdoor, canvasTex } from './ac3d.js';
import { buildCeilingUnit, buildCassetteUnit, buildFloorUnit, animateUnit } from './units3d.js';
import { mats as roomMats, rbox, F, TEX, windowUnit } from './roomkit3d.js';
import { buildTrunk, bentPath } from './trunk3d.js';
import { createAirflow } from './airflow3d.js';
import { createCrew, buildLadder } from './crew3d.js';
import { matTex, bagTex, boxTex, chestTex, decal, drawSbp } from './brand3d.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const faceTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
const H = 2.7;

const DIRT0 = { front: 0.25, grille: 0.35, filter: 0.9, louver: 0.4, panel: 0.3, coil: 0.75, coilBack: 0.8, blower: 0.85, fan: 0.85, scroll: 0.6, bell: 0.5, pan: 0.75, outdoor: 0.6 };
const DIRT_C = { filter: 0x8a7a62, coil: 0x7d6b52, blower: 0x2e2a24, fan: 0x2e2a24, scroll: 0x3a352d, bell: 0x6b6355, pan: 0x5f6a4b, front: 0xc9bfa9, grille: 0xb8ab8f, louver: 0xa89c84, panel: 0xc9bfa9, outdoor: 0x7a6d58 };
// laid on the table: tilt about x so the part rests flat (per type / part); long parts also turn to lie along the table
const FLATX = { wall: { front: -1.35, filter: -1.4 }, floor: { front: -Math.PI / 2, grille: -Math.PI / 2, filter: -Math.PI / 2 } };
// act aliases: overhead cassette work; floor-standing unit = standing / kneeling at chest height (no ladder)
const ACT = { cassette: { work: 'up', spray: 'sprayUp', reach: 'up' }, floor: { work: 'table', spray: 'sprayLow', reach: 'kneel', handDown: 'present', measure: 'table', pour: 'table', drill: 'kneel' } };
// customers per venue
const CUST = { wall: { female: true, colors: { shirt: 0xd8d2c4, pants: 0x3b3f46 } }, ceiling: { female: false, colors: { shirt: 0x2f6d5a, pants: 0x3b3f46, longSleeve: false } }, cassette: { female: true, colors: { shirt: 0x5a4636, pants: 0x2b3440 } }, floor: { female: false, colors: { shirt: 0xf2f2ee, pants: 0x2c3b52, longSleeve: true } } };

/**
 * createJobScene(container, { theme, type, job, onFrame }) →
 *   { setType(t), setJob(j), show(state, { jump }), reset(), busy(), project(v), anchors(), advance(sec), dispose() }
 * state: { cam, crew:[lead, asst, cust], beats:[{ t, crew, set }], spray:{ by, at, chem }, off:{part:1}, dirt:{…}, power, run,
 *          bag, pcb, lower, foam, probes, bagWater, drain, lad0, lad1, sign,
 *          install: marks, mount, cut, unbox, unitK, cartons, oUnbox, outK, ocarton, pipeK, trunkK, drainK, wireK, gauges, n2, vac, needle }
 * crew spec: { s: spot, a: act, t: tool } — spots: L (lead ladder), L2, foot, uf, uf2, table, tub, breaker, out, valve, outDrain,
 *            box, washer, carton, ocarton, door, cust, custMeet, leadMeet, asstMeet, idle0, idle1
 */
export function createJobScene(container, o = {}) {
  const theme = o.theme === 'dark' ? 'dark' : 'light', dark = theme === 'dark';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 0.95 : 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true'); renderer.domElement.className = 'cg-canvas';
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = dark ? 0.45 : 0.7; pm.dispose();
  const gl = glTrack(renderer, container, { scene, redraw: () => kick(), name: 'ทีมช่างหน้างาน' });
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x1a2230 : 0xd9dfe6, dark ? 0.55 : 0.75));
  const sun = new THREE.DirectionalLight(0xfff4e6, dark ? 1.0 : 1.4); sun.position.set(3, 6.5, 5.5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.bias = -0.0004;
  { const c = sun.shadow.camera; c.left = -4.6; c.right = 4.6; c.top = 4.6; c.bottom = -3; c.near = 0.5; c.far = 17; c.updateProjectionMatrix(); } scene.add(sun, sun.target); sun.target.position.set(0, 0.8, 1.4);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  const K = roomMats(theme), M = materialSet(dark ? 'showroom' : 'studio');
  const SHARED = new Set([...Object.values(K), ...Object.values(M)].filter(m => m && m.isMaterial));   // never disposed when a unit / prop is swapped
  const std = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...x });
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; return b; };
  const cyl = (r, h, m, x = 0, y = 0, z = 0, seg = 20, r2) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r2 ?? r, h, seg), m); c.position.set(x, y, z); c.castShadow = true; return c; };
  const tube = (pts, r, m, seg = 60, rad = 8) => { const t = new THREE.Mesh(new THREE.TubeGeometry(pts.isCurve || pts.curves ? pts : new THREE.CatmullRomCurve3(pts), seg, r, rad), m); t.castShadow = true; return t; };
  const railM = std(dark ? 0x8e99a5 : 0x9aa3ad, { metalness: 0.6, roughness: 0.35 });

  const world = new THREE.Group(); scene.add(world);     // crew, props, parts in transit (world frame)
  let venue = null; const venues = {};                     // r8: one venue per type, built once and kept (switching back is instant, nothing leaks)

  /* ---------------------------------------------------------------- crew equipment (built once) */
  // FUJIVA work mat (rubber, company mark), laid where the crew works
  const matG = new THREE.Group(); world.add(matG);
  matG.add(box(2.0, 0.008, 1.25, std(dark ? 0x141c26 : 0x1f2b39, { roughness: 0.95 }), 0, 0.004, 0));
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.98, 1.23), new THREE.MeshStandardMaterial({ map: matTex(dark), roughness: 0.92 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.0085; m.receiveShadow = true; matG.add(m); }
  // folding parts table (long side along z) with a rubber top
  const table = new THREE.Group(); world.add(table); const TT = 0.7575;
  table.add(rbox(0.76, 0.035, 1.8, 0.008, std(0xe9e6df, { roughness: 0.5 }), 0, 0.74, 0)); [[-0.33, -0.84], [0.33, -0.84], [-0.33, 0.84], [0.33, 0.84]].forEach(([x, z]) => table.add(cyl(0.014, 0.73, railM, x, 0.365, z, 8)));
  { const top = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.72), std(0x51708f, { roughness: 0.9 })); top.rotation.x = -Math.PI / 2; top.position.y = TT + 0.0015; top.receiveShadow = true; table.add(top); }
  // wash tub for the removed parts
  const tub = new THREE.Group(); world.add(tub);
  tub.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.3, 32, 1, true), std(0x8fa3b5, { roughness: 0.5, side: THREE.DoubleSide })), { castShadow: true })); tub.children[0].position.y = 0.15;
  tub.add(cyl(0.3, 0.01, std(0x7d92a6), 0, 0.005, 0, 28)); const tubW = new THREE.Mesh(new THREE.CircleGeometry(0.33, 28), std(0x9fb8c9, { roughness: 0.08, transparent: true, opacity: 0.85 })); tubW.rotation.x = -Math.PI / 2; tubW.position.y = 0.17; tub.add(tubW);
  // SBP tool box (orange, the company print on the front)
  const tbox = new THREE.Group(); world.add(tbox);
  tbox.add(box(0.5, 0.24, 0.26, std(0xef4e2e, { roughness: 0.45 }), 0, 0.12, 0), box(0.51, 0.03, 0.27, std(0x2b3037), 0, 0.255, 0), box(0.24, 0.025, 0.03, std(0x2b3037), 0, 0.29, 0));
  { const d = decal(boxTex(), 0.38, 0.15, { rough: 0.5 }); d.position.set(0, 0.12, 0.131); tbox.add(d); }
  // pressure-washer pump with a small company sticker
  const washer = new THREE.Group(); world.add(washer);
  washer.add(box(0.3, 0.24, 0.22, std(0xc8282e, { roughness: 0.4 }), 0, 0.18, 0), box(0.26, 0.05, 0.18, std(0x1d2126), 0, 0.325, 0), cyl(0.012, 0.4, std(0x1d2126), -0.14, 0.38, 0));
  [-0.11, 0.11].forEach(z => { const w = cyl(0.055, 0.035, std(0x1d2126), 0.11, 0.055, z); w.rotation.x = Math.PI / 2; washer.add(w); });
  { const d = decal(chestTex(), 0.16, 0.08); d.position.set(0, 0.19, 0.111); washer.add(d); }
  // bucket under the bag hose
  const bucket = new THREE.Group(); world.add(bucket);
  bucket.add(cyl(0.17, 0.32, std(0x2f6fd1, { roughness: 0.45 }), 0, 0.16, 0, 28, 0.14)); const bucketW = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), std(0x8a7a62, { roughness: 0.1, transparent: true, opacity: 0.85 })); bucketW.rotation.x = -Math.PI / 2; bucket.add(bucketW);
  // service sign for shops / cafés / offices (yellow A-frame): what is going on + the company line, small
  const signG = new THREE.Group(); world.add(signG);
  { const t = canvasTex(256, 384, (g, w, h) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1d2126'; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = '#1d2126'; g.beginPath(); g.moveTo(w / 2, 46); g.lineTo(w / 2 + 52, 136); g.lineTo(w / 2 - 52, 136); g.closePath(); g.fill(); g.fillStyle = '#f2c230'; g.font = '800 64px Arial'; g.textAlign = 'center'; g.fillText('!', w / 2, 128);
      g.fillStyle = '#1d2126'; g.font = '700 34px "Anuphan","Kanit",system-ui,sans-serif'; g.fillText('งานบริการ', w / 2, 200); g.font = '600 26px "Anuphan","Kanit",system-ui,sans-serif'; g.fillText('กำลังดำเนินการ', w / 2, 240); g.fillText('ขออภัยในความไม่สะดวก', w / 2, 276);
      drawSbp(g, w / 2, 334, 26, '#1d2126', '#b4560d', false); });
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide });
    [1, -1].forEach(s => { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), m); p.position.set(0, 0.3, s * 0.09); p.rotation.set(s * -0.28, s > 0 ? 0 : Math.PI, 0); p.castShadow = true; signG.add(p); }); }
  // ladders: lead (always on site when the unit is overhead) + a second one for two-man lifts; rebuilt per type (height)
  let lad = [null, null];
  // cartons (installation)
  const cartons = new THREE.Group(), ocarton = new THREE.Group(); world.add(cartons, ocarton);
  const cartonMat = (t1, w, h) => new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(512, Math.round(512 * h / w), (g, W, Hh) => { g.fillStyle = '#c49a64'; g.fillRect(0, 0, W, Hh); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, Hh * 0.46, W, Hh * 0.08); g.fillStyle = '#23303e'; g.font = `800 ${Math.round(Hh * 0.17)}px Arial`; g.textAlign = 'center'; g.fillText(t1, W / 2, Hh * 0.38); g.font = `600 ${Math.round(Hh * 0.1)}px Arial`; g.fillText('↑↑  THIS SIDE UP  ·  FRAGILE', W / 2, Hh * 0.72); g.fillStyle = '#fff'; g.fillRect(W * 0.66, Hh * 0.8, W * 0.3, Hh * 0.15); g.fillStyle = '#23303e'; g.font = `500 ${Math.round(Hh * 0.06)}px "Anuphan",Arial`; g.fillText('งานติดตั้ง · SBP AirCare', W * 0.81, Hh * 0.9); }) });
  // gauge manifold + nitrogen + vacuum pump (installation tests), at the condensing unit
  const gauges = new THREE.Group(), n2 = new THREE.Group(), vac = new THREE.Group(); world.add(gauges, n2, vac);
  const needles = [];
  { gauges.add(box(0.16, 0.06, 0.05, std(0x2a2f36, { metalness: 0.4, roughness: 0.35 })));
    [[-0.05, 0x2f6fd0], [0.05, 0xd0342f]].forEach(([x, col]) => { const d = new THREE.Group(); d.position.set(x, 0.08, 0); const rim = cyl(0.045, 0.03, std(col, { roughness: 0.4 })); rim.rotation.x = Math.PI / 2; d.add(rim);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (c, W) => { c.fillStyle = '#f4f4f0'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 2; for (let k = 0; k <= 20; k++) { const a = Math.PI * (0.75 + 1.5 * k / 20); c.beginPath(); c.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); c.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); c.stroke(); } c.fillStyle = col === 0x2f6fd0 ? '#2f6fd0' : '#d0342f'; c.font = '700 16px Arial'; c.textAlign = 'center'; c.fillText(col === 0x2f6fd0 ? 'LOW' : 'HIGH', 64, 96); }) }));
      face.position.z = 0.0155; d.add(face); const nd = new THREE.Group(); nd.position.z = 0.018; nd.add(box(0.002, 0.034, 0.002, std(0xd0342f), 0, 0.014, 0)); d.add(nd); needles.push(nd); gauges.add(d); }); }
  { n2.add(cyl(0.09, 0.95, std(0x3d4a3f, { roughness: 0.5, metalness: 0.3 }), 0, 0.5, 0, 28)); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x3d4a3f, { roughness: 0.5, metalness: 0.3 })); dome.position.y = 0.975; n2.add(dome); n2.add(cyl(0.02, 0.08, std(0xb9bec4, { metalness: 0.8, roughness: 0.3 }), 0, 1.09, 0));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), new THREE.MeshBasicMaterial({ map: canvasTex(64, 128, (c, W, Hh) => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#23303e'; c.font = '800 26px Arial'; c.textAlign = 'center'; c.fillText('N₂', W / 2, 60); c.font = '600 11px Arial'; c.fillText('NITROGEN', W / 2, 90); }) })); lab.position.set(0, 0.6, 0.091); n2.add(lab); }
  { vac.add(box(0.3, 0.18, 0.14, std(0xf2c230, { roughness: 0.4 }), 0, 0.12, 0)); const mo = cyl(0.07, 0.2, std(0x3a3f46, { metalness: 0.5, roughness: 0.4 }), -0.05, 0.12, 0); mo.rotation.z = Math.PI / 2; vac.add(mo); vac.add(box(0.24, 0.02, 0.14, std(0x1d2126), 0, 0.02, 0)); }
  const testHoses = new THREE.Group(); world.add(testHoses);

  /* ---------------------------------------------------------------- spray (water droplets + mist) */
  const NS = 520, sg = new THREE.BufferGeometry(), sPos = new Float32Array(NS * 3), sVel = new Float32Array(NS * 3), sLife = new Float32Array(NS), sAl = new Float32Array(NS);
  sg.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sg.setAttribute('aA', new THREE.BufferAttribute(sAl, 1));
  const dropTex = canvasTex(32, 32, (g, w, h) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const sMat = new THREE.PointsMaterial({ size: 0.026, map: dropTex, color: dark ? 0xd8f1ff : 0x5d9fd0, transparent: true, depthWrite: false, opacity: 0.95 });
  sMat.onBeforeCompile = sh => { sh.vertexShader = 'attribute float aA;\nvarying float vA;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vA = aA;'); sh.fragmentShader = 'varying float vA;\n' + sh.fragmentShader.replace('#include <alphatest_fragment>', 'diffuseColor.a *= vA;\n#include <alphatest_fragment>'); };
  const spray = new THREE.Points(sg, sMat); spray.frustumCulled = false; spray.renderOrder = 9; scene.add(spray);
  const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTex, color: dark ? 0xcfeaff : 0xa9cde8, transparent: true, opacity: 0, depthWrite: false })); mist.renderOrder = 9; scene.add(mist);
  for (let i = 0; i < NS; i++) { sLife[i] = -Math.random(); sPos[i * 3 + 1] = -9; }
  let sprayOn = false, sprayChem = false; const sprayTip = V(0, 2, 1), sprayTarget = V(0, 2, 0);
  function emitSpray(dt) {
    const dir = sprayTarget.clone().sub(sprayTip).normalize();
    for (let i = 0; i < NS; i++) {
      sLife[i] -= dt;
      if (sLife[i] <= 0) {
        if (!sprayOn) { sAl[i] = 0; sPos[i * 3 + 1] = -9; continue; }
        const s = sprayChem ? 0.3 : 0.08, d2 = dir.clone().add(V((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)).normalize(), v = sprayChem ? 2.2 + Math.random() : 7 + Math.random() * 3;
        sPos[i * 3] = sprayTip.x; sPos[i * 3 + 1] = sprayTip.y; sPos[i * 3 + 2] = sprayTip.z; sVel[i * 3] = d2.x * v; sVel[i * 3 + 1] = d2.y * v; sVel[i * 3 + 2] = d2.z * v;
        sLife[i] = (sprayChem ? 0.35 : 0.25) + Math.random() * 0.35; sAl[i] = 1; continue;
      }
      let x = sPos[i * 3], y = sPos[i * 3 + 1], z = sPos[i * 3 + 2], vx = sVel[i * 3], vy = sVel[i * 3 + 1], vz = sVel[i * 3 + 2];
      vy -= (sprayChem ? 2.5 : 9.8) * dt; x += vx * dt; y += vy * dt; z += vz * dt;
      const tx = sprayTarget.x - x, ty = sprayTarget.y - y, tz = sprayTarget.z - z;
      if (tx * dir.x + ty * dir.y + tz * dir.z < 0.02 && vy > -6) { vx = (Math.random() - 0.5) * 0.8 - dir.x * 0.6; vz = (Math.random() - 0.5) * 0.8 - dir.z * 0.6; vy = -0.5 - Math.random(); sLife[i] = Math.min(sLife[i], 0.35); }
      sAl[i] = clamp(sLife[i] * 4, 0, 1) * 0.9;
      sPos[i * 3] = x; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = z; sVel[i * 3] = vx; sVel[i * 3 + 1] = vy; sVel[i * 3 + 2] = vz;
    }
    sg.attributes.position.needsUpdate = true; sg.attributes.aA.needsUpdate = true;
  }
  // water in the drain pan (test) + the outlet drip at the end of the drain pipe
  const NDR = 60, dg = new THREE.BufferGeometry(), dPos = new Float32Array(NDR * 3), dU = new Float32Array(NDR).map(() => Math.random());
  dg.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const drops = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.018, map: dropTex, color: 0x3aa0ff, transparent: true, depthWrite: false, depthTest: false })); drops.frustumCulled = false; drops.renderOrder = 10; scene.add(drops); drops.visible = false;
  // pressure-washer hose to the gun in the sprayer's hand (rebuilt when the hand moves)
  const hoseM = std(0x1d2126, { roughness: 0.55 }); let hoseMesh = null, hoseKey = '';
  function washerHose(to) {
    const key = to ? to.toArray().map(v => v.toFixed(2)).join() : ''; if (key === hoseKey) return; hoseKey = key;
    if (hoseMesh) { hoseMesh.geometry.dispose(); world.remove(hoseMesh); hoseMesh = null; } if (!to) return;
    const from = washer.localToWorld(V(-0.14, 0.2, 0.08)), mid = from.clone().lerp(to, 0.5); mid.y = 0.03;
    hoseMesh = tube([from, V(from.x, 0.03, from.z + 0.12), mid, V(to.x, Math.max(0.05, to.y - 0.6), to.z + 0.08), to], 0.008, hoseM, 60, 6); world.add(hoseMesh);
  }

  /* ---------------------------------------------------------------- per type: venue, unit, routes, spots */
  let type = null, job = o.job || 'clean', U = null, OU = null, air = null, crew = null;
  const unitG = new THREE.Group(); scene.add(unitG);
  let bag = null, hose = null, pcbCover = null, foam = null, probes = null, marks = null, mount = null, patch = null, brk = null, lever = null, led = null;
  let pipes = null, trunk = null, drainP = null, wire = null, tailOut = null;
  const SP = {}, CAMS = {}, U0 = {};           // spots, camera presets, unit placement
  const LOCAL = {};                              // spray targets in the unit frame
  const SLOTZ = [-0.55, 0, 0.55];
  let slotTop = [TT, TT, TT];
  const HP = {};                                 // movable part holders
  const disposeTree = g => g.traverse(x => { if (x.isMesh || x.isPoints) { x.geometry && x.geometry.dispose(); } });

  function buildVenue(t) {
    Object.values(venues).forEach(g => { g.visible = false; });
    if (venues[t]) { venue = venues[t]; venue.visible = true; patch = venue.userData.patch || null; return; }
    venue = venues[t] = new THREE.Group(); scene.add(venue); patch = null;
    const commercial = t !== 'wall';
    // floor + walls + ceiling (doll-house cut: back wall, left wall, the right wall with a door to the balcony / service yard)
    const fl = t === 'ceiling' ? K.tile.clone() : t === 'floor' ? new THREE.MeshStandardMaterial({ map: TEX.fabric(dark ? '#3e4652' : '#7d8794'), roughness: 1 }) : K.floor.clone();
    if (fl.map) { fl.map = fl.map.clone(); fl.map.wrapS = fl.map.wrapT = THREE.RepeatWrapping; fl.map.repeat.set(t === 'ceiling' ? 7 : t === 'floor' ? 12 : 3, t === 'ceiling' ? 5 : t === 'floor' ? 8 : 2.4); fl.map.needsUpdate = true; }
    if (t === 'cassette') fl.color.setHex(dark ? 0x9a7a62 : 0xb48e6c);
    const wallM = t === 'wall' ? K.wall : t === 'cassette' ? std(0xffffff, { map: TEX.plaster(dark ? '#5a4f45' : '#eadcc9'), roughness: 0.95 }) : std(dark ? 0x3d444d : 0xf1f2ef, { roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.05, 3.6), fl); floor.position.set(-0.6, -0.025, 1.8); floor.receiveShadow = true; venue.add(floor);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5.52, H, 0.12), wallM); back.position.set(-0.6, H / 2, -0.06); back.receiveShadow = true; venue.add(back);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 3.6), wallM); left.position.set(-3.36, H / 2, 1.8); left.receiveShadow = true; venue.add(left);
    venue.add(box(5.4, 0.08, 0.012, K.base, -0.6, 0.04, 0.006));
    // right wall with a door opening (z 1.75 … 2.65) → balcony / service yard
    [[0, 1.75], [2.65, 3.6]].forEach(([a, b]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, b - a), wallM); p.position.set(2.16, H / 2, (a + b) / 2); p.receiveShadow = true; venue.add(p); });
    venue.add(box(0.12, H - 2.1, 0.9, wallM, 2.16, (H + 2.1) / 2, 2.2)); [1.77, 2.63].forEach(z => venue.add(box(0.16, 2.1, 0.04, K.white, 2.16, 1.05, z))); venue.add(box(0.16, 0.04, 0.9, K.white, 2.16, 2.1, 2.2));
    // outside: balcony (home) / service yard (others)
    const ofl = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.05, 3.6), commercial ? K.concrete : K.tile); ofl.position.set(3.1, -0.06, 1.8); ofl.receiveShadow = true; venue.add(ofl);
    const ow = new THREE.Mesh(new THREE.BoxGeometry(1.84, H, 0.12), K.wallAlt); ow.position.set(3.1, H / 2, -0.06); ow.receiveShadow = true; venue.add(ow);
    if (!commercial) { venue.add(box(0.04, 0.04, 3.6, railM, 3.98, 1.0, 1.8)); for (let i = 0; i < 10; i++) venue.add(box(0.02, 1.0, 0.02, railM, 3.98, 0.5, 0.1 + i * 0.38)); }
    else { venue.add(box(0.14, 0.95, 3.6, K.wallAlt, 3.97, 0.475, 1.8)); venue.add(box(0.18, 0.04, 3.6, K.base, 3.97, 0.97, 1.8)); }
    // ceiling (shops, cafés, offices): board with downlights; the cassette sits in an opening (patch = before the cut)
    if (commercial) {
      const cm = K.ceiling.clone(); cm.side = THREE.DoubleSide; const cz = U0.cz ?? 1.25, hw = 0.43;
      const piece = (x0, x1, z0, z1) => { const c = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.04, z1 - z0), cm); c.position.set((x0 + x1) / 2, H + 0.02, (z0 + z1) / 2); venue.add(c); };
      if (t === 'cassette') { piece(-3.3, -hw, 0, 3.6); piece(hw, 2.1, 0, 3.6); piece(-hw, hw, 0, cz - hw); piece(-hw, hw, cz + hw, 3.6); patch = box(2 * hw, 0.04, 2 * hw, cm, 0, H + 0.02, cz); patch.castShadow = false; venue.add(patch); }
      else piece(-3.3, 2.1, 0, 3.6);
      const dl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: dark ? 1.1 : 0.6 });
      [[-2.4, 0.9], [-2.4, 2.6], [-1.0, 2.6], [1.2, 2.6], [1.2, 0.9], [-1.0, 0.9]].forEach(([x, z]) => { if (t === 'cassette' && Math.abs(x) < 0.9 && Math.abs(z - cz) < 0.9) return; const d = cyl(0.06, 0.01, dl, x, H - 0.006, z, 20); d.castShadow = false; venue.add(d); });
    }
    // furniture per venue (kept out of the work area x −0.9…1.4, z 0…2.4, the parts table and the door path)
    const add = (o3, x, z, ry = 0, y = 0) => { o3.position.set(x, y, z); o3.rotation.y = ry; venue.add(o3); return o3; };
    if (t === 'wall') {   // home bedroom
      add(F.bed(K, 1.6, 2.0), -2.52, 1.07); add(F.wardrobe(K, 1.2, 0.6, 2.0), -3.0, 2.9, Math.PI / 2); add(F.art(K, 28), -2.52, 0, 0, 1.55).position.z = 0.03;
      const win = windowUnit(K, 0.66, 1.15); win.position.set(-1.18, 1.5, 0.0); venue.add(win);
      add(F.curtain(K, 0.3, 2.05), -1.72, 0.09, 0, 0.32); add(F.curtain(K, 0.3, 2.05), -0.66, 0.09, 0, 0.32); add(F.plant(K, 1.0), 1.85, 0.32);
    } else if (t === 'ceiling') {   // shop
      add(F.rack(K, 1.8, 0.5, 1.8), -2.35, 0.3); add(F.rack(K, 1.6, 0.5, 1.8), -3.02, 2.25, Math.PI / 2); add(F.counter(K, 1.4, 0.6), -2.2, 3.15, Math.PI);
      add(F.art(K, 200), 1.72, 0, 0, 1.75).position.z = 0.03; add(F.plant(K, 1.1), 1.85, 0.32); add(F.plant(K, 0.9), -0.2, 3.3);
    } else if (t === 'cassette') {   // café
      const bar = add(F.counter(K, 2.0, 0.6), -2.25, 0.36); void bar;
      const steel = std(0xc9ced4, { metalness: 0.8, roughness: 0.3 }); venue.add(box(0.5, 0.4, 0.38, steel, -2.7, 1.24, 0.3), box(0.18, 0.32, 0.2, std(0x2b3037), -1.95, 1.2, 0.3)); [-2.45, -2.3].forEach(x => venue.add(cyl(0.04, 0.08, K.white, x, 1.08, 0.5, 14)));
      const shade = new THREE.MeshStandardMaterial({ color: 0x1d2126, emissive: 0xffd9a0, emissiveIntensity: dark ? 0.9 : 0.4, roughness: 0.5, side: THREE.DoubleSide });
      [-2.9, -2.25, -1.6].forEach(x => { venue.add(cyl(0.004, H - 2.15, K.black, x, (H + 2.15) / 2, 0.45, 6)); const s = cyl(0.13, 0.16, shade, x, 2.08, 0.45, 24, 0.05); s.castShadow = false; venue.add(s); });
      const menu = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.6), new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(512, 236, (g, w, h) => { g.fillStyle = '#23292f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8b6b4a'; g.lineWidth = 10; g.strokeRect(0, 0, w, h); g.fillStyle = 'rgba(240,236,228,.85)'; g.font = '600 26px "Kanit",system-ui'; g.fillText('MENU', 30, 46); for (let i = 0; i < 5; i++) { g.fillRect(30, 70 + i * 30, 160 + (i * 41) % 90, 6); g.fillRect(300, 70 + i * 30, 120 + (i * 29) % 70, 6); } }) }));
      menu.position.set(-2.25, 1.9, 0.01); venue.add(menu);
      const ctable = (x, z, n) => { const g = new THREE.Group(); g.add(cyl(0.36, 0.03, K.woodL, 0, 0.74, 0, 32), cyl(0.03, 0.72, K.black, 0, 0.37, 0, 10), cyl(0.22, 0.02, K.black, 0, 0.01, 0, 24));
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + 0.6, c = new THREE.Group(); c.add(rbox(0.42, 0.04, 0.42, 0.015, K.wood, 0, 0.45, 0), rbox(0.42, 0.36, 0.035, 0.012, K.wood, 0, 0.7, -0.2)); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a2, b2]) => c.add(box(0.03, 0.45, 0.03, K.black, a2, 0.225, b2))); c.position.set(Math.sin(a) * 0.62, 0, Math.cos(a) * 0.62); c.rotation.y = a + Math.PI; g.add(c); }
        g.position.set(x, 0, z); venue.add(g); };
      ctable(-2.45, 1.75, 2); ctable(-2.4, 3.05, 3);
      { const st = new THREE.Group(); [0, 1].forEach(k => { const c = new THREE.Group(); c.add(rbox(0.42, 0.04, 0.42, 0.015, K.wood, 0, 0.45, 0), rbox(0.42, 0.36, 0.035, 0.012, K.wood, 0, 0.7, -0.2)); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a2, b2]) => c.add(box(0.03, 0.45, 0.03, K.black, a2, 0.225, b2))); c.position.y = k * 0.06; st.add(c); }); st.position.set(-0.75, 0, 3.2); venue.add(st); }   // chairs moved out from under the unit, stacked
      add(F.plant(K, 1.2), 1.85, 0.32); add(F.plant(K, 0.9), -3.05, 0.35);
    } else {   // meeting room / client lounge
      add(F.meeting(K, 2.0, 1.0), -2.35, 2.4, Math.PI / 2);
      venue.add(box(1.7, 0.98, 0.04, K.black, -2.35, 1.5, 0.03)); { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.92), K.screen); s.position.set(-2.35, 1.5, 0.052); venue.add(s); }
      for (let i = 0; i < 16; i++) venue.add(box(0.05, H, 0.03, K.woodL, -3.25 + i * 0.12, H / 2, 0.016));   // slatted feature wall behind the screen
      add(F.plant(K, 1.2), 1.85, 0.32); add(F.armchair(K), 1.25, 3.05, Math.PI + 0.5); add(F.plant(K, 0.9), -0.4, 3.3);
    }
    venue.traverse(m => { if (m.isMesh && m.castShadow === undefined) m.castShadow = true; });
    venue.userData.patch = patch;
  }

  function placeUnit(t) {
    // r8: parts of the previous unit that sit on the table or travel in a hand are attached to the world — remove them too
    // r15: freed two frames later (disposeLater) so the new unit re-uses the compiled shaders instead of compiling them again
    Object.values(HP).forEach(P => { if (P.h.parent && P.h.parent !== U.root) { P.h.parent.remove(P.h); disposeLater(P.h, SHARED); } });
    if (U) disposeLater(U.root, SHARED);
    unitG.clear(); Object.keys(HP).forEach(k => delete HP[k]); slotTop = [TT, TT, TT];
    if (t === 'wall') { U = buildPremiumIndoor(M, { logo: false }); U0.p = V(0, 2.18, 0.135); U0.bot = 2.03; U0.front = 0.26; U0.w = 0.9; }
    else if (t === 'ceiling') { U = buildCeilingUnit(M, { interior: true, rod: 0 }); U0.p = V(0, H - 0.1475, 0.35); U0.bot = H - 0.265; U0.front = 0.7; U0.w = 1.27; }
    else if (t === 'cassette') { U = buildCassetteUnit(M, { interior: true, rod: 0 }); U0.p = V(0, H, U0.cz = 1.25); U0.bot = H - 0.04; U0.front = 1.25 + 0.475; U0.w = 0.95; }
    else { U = buildFloorUnit(M, { interior: true, w: 0.6, h: 1.85, d: 0.38 }); U0.p = V(0, 0, 0.21); U0.bot = 0; U0.front = 0.4; U0.w = 0.6; }
    U.root.position.copy(U0.p); U.root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    // own materials per part so each part carries its own dirt
    U.mats = {}; Object.entries(U.parts).forEach(([id, g]) => { const list = []; g.traverse(m => { if (m.isMesh && m.material && !m.material.isMeshBasicMaterial && !m.userData.own) { m.material = m.material.clone(); m.userData.own = true; m.userData.base = m.material.color.clone(); list.push(m); } }); U.mats[id] = list; });
    unitG.add(U.root);
    // spray targets / drain line in the unit frame
    Object.assign(LOCAL, {
      wall: { coil: V(0, 0.04, 0.025), fan: V(-0.05, -0.06, 0.045), pan: V(0, -0.11, 0.065), back: V(0, -0.06, -0.105), d0: V(0.38, -0.1, 0.07), d1: V(-0.47, -0.1, 0.07), pcb: V(0.385, 0, -0.025) },
      ceiling: { coil: V(0, 0.0, 0.15), fan: V(-0.1, -0.05, -0.05), pan: V(0.2, -0.09, 0.15), back: V(0, -0.15, -0.25), d0: V(0.5, -0.09, 0.2), d1: V(-0.55, -0.09, 0.2), pcb: V(0.55, 0, -0.25) },
      cassette: { coil: V(0, 0.1, 0.25), fan: V(0, 0.08, 0), pan: V(0.25, 0.03, 0.25), back: V(0.3, 0.1, 0.3), d0: V(0.3, 0.03, 0.3), d1: V(-0.3, 0.03, 0.3), pcb: V(0.3, 0.12, -0.3) },
      floor: { coil: V(0, 1.03, 0.05), fan: V(0, 0.52, 0.08), pan: V(0, 0.75, 0.05), back: V(0, 1.03, -0.1), d0: V(0.24, 0.75, 0.0), d1: V(-0.24, 0.75, 0.0), pcb: V(0.2, 1.15, 0.12) },
    }[t]);
    // the condensing unit (balcony / service yard) — no brand mark
    if (!OU) {   // r8: the same condensing unit for every venue — built once (it used to be rebuilt, and leaked, on every switch)
      OU = buildOutdoor(M, { logo: false }); OU.root.scale.setScalar(0.85); OU.base = V(3.05, 0.55 * 0.85 / 2 + 0.07, 0.32);
      OU.root.traverse(m => { if (m.isMesh) { m.castShadow = true; if (m.material && !m.material.isMeshBasicMaterial) { m.material = m.material.clone(); m.userData.base = m.material.color.clone(); } } }); world.add(OU.root);
    }
  }

  function propsFor(t) {
    [bag, hose, pcbCover, probes, marks, mount, brk, pipes, trunk, drainP, wire, tailOut].forEach(x => { if (x) { x.parent && x.parent.remove(x); disposeLater(x, SHARED); } });
    if (foam) { foam.parent && foam.parent.remove(foam); disposeLater(foam, SHARED); foam = null; }
    const u = U0.p, w = U0.w;
    // ---- positions: mat, table, tub, tool box, washer, bucket, ladders, sign
    const P = {
      wall: { mat: [0.05, 0.78], table: [-1.05, 1.35], tub: [-1.1, 2.72], box: [-0.72, 0.36], washer: [0.86, 0.36], bucket: [0.62, 0.78], lad0: [0.14, 0.56], lad1: null, sign: null, carton: [0.95, 1.65], h0: 0.9 },
      ceiling: { mat: [0.05, 1.0], table: [-1.25, 1.45], tub: [-1.25, 2.8], box: [-0.72, 0.55], washer: [0.86, 0.5], bucket: [0.72, 1.12], lad0: [0.16, 0.92], lad1: [-0.42, 0.92], sign: [1.3, 1.6], carton: [0.95, 1.8], h0: 0.95 },
      cassette: { mat: [0.05, 1.3], table: [-1.25, 1.35], tub: [-1.25, 2.72], box: [-0.72, 0.85], washer: [0.86, 0.78], bucket: [0.82, 1.95], lad0: [0.4, 1.72], lad1: [-0.6, 1.25], sign: [1.35, 1.55], carton: [0.95, 2.1], h0: 1.15 },
      floor: { mat: [0.05, 0.85], table: [-1.05, 1.25], tub: [-0.35, 2.55], box: [-0.35, 1.3], washer: [0.86, 0.42], bucket: [0.62, 1.05], lad0: null, lad1: null, sign: [1.3, 1.6], carton: [0.95, 1.75], h0: 0 },
    }[t];
    matG.position.set(P.mat[0], 0, P.mat[1]);
    table.position.set(P.table[0], 0, P.table[1]); tub.position.set(P.tub[0], 0, P.tub[1]);
    tbox.position.set(P.box[0], 0.009, P.box[1]); washer.position.set(P.washer[0], 0.009, P.washer[1]); washer.rotation.y = -0.4; bucket.position.set(P.bucket[0], 0.009, P.bucket[1]);
    signG.visible = !!P.sign; if (P.sign) { signG.position.set(P.sign[0], 0, P.sign[1]); signG.rotation.y = -0.5; }
    // ladders (lead: at the unit; second: two-man lifts on overhead units)
    lad.forEach(l => { if (l && l.L) { world.remove(l.L); disposeDeep(l.L, SHARED); } }); lad = [null, null];   // lad[i] = { L (the ladder group), h, spec } — r8 fix: disposing the wrapper threw and left the scene half-built
    const mkLad = (at, face, h) => { const L = buildLadder(h), sp = h * 0.36, ry = face + Math.PI; L.rotation.y = ry; // climber faces `face`; the tread face of the ladder points back at him
      const tread = at, back = V(Math.sin(face), 0, Math.cos(face));   // unit direction
      L.position.set(tread[0] - back.x * -L.userData.z, 0, tread[1] - back.z * -L.userData.z);   // tread under the feet
      const foot = [tread[0] - back.x * (sp + 0.38 - L.userData.z), tread[1] - back.z * (sp + 0.38 - L.userData.z)];
      L.position.set(tread[0] + back.x * L.userData.z, 0, tread[1] + back.z * L.userData.z);
      world.add(L); L.visible = false; return { L, h, spec: { at: foot, face, top: L.userData.top + 0.014, lean: sp + 0.38 - L.userData.z } }; };
    if (P.lad0) lad[0] = mkLad(P.lad0, Math.PI, P.h0);
    if (P.lad1) lad[1] = mkLad(P.lad1, t === 'cassette' ? Math.PI / 2 : Math.PI, P.h0);
    // ---- cleaning bag (wall / ceiling / cassette: funnel bag; floor: tray in front of the cabinet) + hose to the bucket + PCB cover
    const bagM = new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, roughness: 0.25, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
    bag = new THREE.Group(); world.add(bag); bag.userData.m = bagM;
    let spout;
    if (t === 'floor') {
      const tr = new THREE.Group(); tr.position.set(0, 0.009, U0.front + 0.2); bag.add(tr); const tm = std(0x9bb3c9, { roughness: 0.5 });
      tr.add(box(0.66, 0.012, 0.36, tm, 0, 0.006, 0)); [[0.66, 0.06, 0.012, 0, 0.18], [0.66, 0.06, 0.012, 0, -0.18], [0.012, 0.06, 0.36, 0.33, 0], [0.012, 0.06, 0.36, -0.33, 0]].forEach(([a, b, c, x, z]) => tr.add(box(a, b, c, tm, x, 0.03, z)));
      spout = V(0.3, 0.05, U0.front + 0.2);
    } else {
      const by = U0.bot, fz = t === 'wall' ? U0.front : u.z + (t === 'ceiling' ? 0.32 : 0.5), bz0 = t === 'wall' ? 0.02 : u.z - (t === 'ceiling' ? 0.33 : 0.5), hw = t === 'cassette' ? 0.5 : w / 2 + 0.02;
      spout = V(t === 'cassette' ? 0.3 : w * 0.22, by - (t === 'wall' ? 0.55 : 0.5), (bz0 + fz) / 2 + 0.03);
      const top = [V(-hw, by, bz0), V(hw, by, bz0), V(hw, by, fz + 0.04), V(-hw, by, fz + 0.04)], sp = [V(-0.05, 0, -0.04), V(0.05, 0, -0.04), V(0.05, 0, 0.04), V(-0.05, 0, 0.04)].map(p => p.add(spout));
      const pos = []; for (let i = 0; i < 4; i++) { const a = top[i], b = top[(i + 1) % 4], c = sp[(i + 1) % 4], d = sp[i]; pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.computeVertexNormals();
      const bm = new THREE.Mesh(bg, bagM); bm.renderOrder = 3; bag.add(bm);
      // print on the front panel of the bag (FUJIVA · SBP AirCare), facing the room
      const c = top[2].clone().add(top[3]).add(sp[2]).add(sp[3]).multiplyScalar(0.25), n = top[3].clone().sub(sp[3]).cross(top[2].clone().sub(top[3])).normalize();
      const d = decal(bagTex(), Math.min(0.42, hw * 0.9), Math.min(0.21, hw * 0.45), { rough: 0.6 }); d.position.copy(c).addScaledVector(n, 0.004); d.lookAt(c.clone().add(n)); d.renderOrder = 4; bag.add(d);
    }
    const bp = bucket.position;
    hose = tube([spout.clone(), spout.clone().add(V(0.05, -0.25, 0.08)), V(bp.x - 0.05, 0.62, bp.z - 0.02), V(bp.x - 0.04, 0.34, bp.z)], 0.018, bagM, 40, 10); bag.add(hose); hose = null;
    pcbCover = new THREE.Mesh(new THREE.BoxGeometry(t === 'wall' ? 0.15 : 0.22, 0.3, 0.3), new THREE.MeshPhysicalMaterial({ color: 0xf2f6fa, roughness: 0.2, transparent: true, opacity: 0.38, depthWrite: false })); pcbCover.position.copy(LOCAL.pcb); U.root.add(pcbCover);
    // chemical foam on the coil face (follows the unit)
    const ft = canvasTex(256, 128, (g, W2, H2) => { g.clearRect(0, 0, W2, H2); for (let i = 0; i < 900; i++) { const x = Math.random() * W2, y = Math.random() * H2, r = 1.5 + Math.random() * 4.5; g.fillStyle = `rgba(255,255,255,${0.45 + Math.random() * 0.5})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
    foam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: ft, transparent: true, opacity: 0, roughness: 0.9, depthWrite: false }));
    if (t === 'wall') { foam.scale.set(0.74, 0.2, 1); foam.position.set(-0.04, 0.04, 0.105); foam.rotation.x = -0.35; }
    else if (t === 'ceiling') { foam.scale.set(1.1, 0.16, 1); foam.position.set(0, 0, 0.18); foam.rotation.x = -0.2; }
    else if (t === 'cassette') { foam.scale.set(0.55, 0.55, 1); foam.position.set(0, -0.02, 0); foam.rotation.x = Math.PI / 2; }
    else { foam.scale.set(0.5, 0.42, 1); foam.position.set(0, 1.03, 0.1); foam.rotation.x = -0.3; }
    U.root.add(foam);
    // thermometer probes (T2 readings)
    probes = new THREE.Group(); U.root.add(probes); const pM = std(0xd8dde2, { metalness: 0.6, roughness: 0.3 });
    const pr = (p, rx) => { const g = new THREE.Group(); g.position.copy(p); g.add(cyl(0.004, 0.16, pM, 0, 0, 0, 8)); g.add(box(0.05, 0.08, 0.02, std(0xf0c419), 0, -0.11, 0)); g.rotation.x = rx; probes.add(g); };
    ({ wall: () => { pr(V(-0.15, 0.22, -0.015), -0.4); pr(V(0.1, -0.23, 0.185), 0.6); }, ceiling: () => { pr(V(-0.3, -0.17, -0.15), 0.3); pr(V(0.2, -0.1, 0.43), 0.8); }, cassette: () => { pr(V(0, -0.1, 0), 0); pr(V(0.37, -0.08, 0.1), 0.5); }, floor: () => { pr(V(0, 0.4, 0.24), 0.3); pr(V(0, 1.55, 0.24), 0.8); } })[t]();
    // ---- breaker (customer's panel; the AC circuit breaker)
    brk = new THREE.Group(); brk.position.set(1.15, 1.45, 0.0); venue.add(brk);
    brk.add(rbox(0.22, 0.3, 0.08, 0.01, std(0xf1f2f0, { roughness: 0.4 }), 0, 0, 0.04)); lever = new THREE.Group(); lever.position.set(0, 0.02, 0.085); brk.add(lever); lever.add(box(0.03, 0.06, 0.02, std(0x2b2f35), 0, 0.02, 0));
    led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3ad36b })); led.position.set(0.07, 0.09, 0.083); brk.add(led);
    // ---- installation layout marks (blue tape) and mounting hardware
    marks = new THREE.Group(); venue.add(marks); const tape = new THREE.MeshBasicMaterial({ color: 0x2f7fd0, transparent: true, opacity: 0.9 });
    const tapeRect = (cx, cy, cz, a, b, plane) => { const th = 0.012; if (plane === 'wall') { [[a, th, cx, cy + b / 2], [a, th, cx, cy - b / 2], [th, b, cx - a / 2, cy], [th, b, cx + a / 2, cy]].forEach(([w2, h2, x, y]) => marks.add(box(w2, h2, 0.002, tape, x, y, cz))); } else { [[a, th, cx, cz + b / 2], [a, th, cx, cz - b / 2], [th, b, cx - a / 2, cz], [th, b, cx + a / 2, cz]].forEach(([w2, d2, x, z]) => marks.add(box(w2, 0.002, d2, tape, x, cy, z))); } };
    if (t === 'wall') tapeRect(0, u.y, 0.003, 0.92, 0.3, 'wall'); else if (t === 'ceiling') tapeRect(0, H - 0.004, u.z, 1.3, 0.7, 'ceil'); else if (t === 'cassette') tapeRect(0, H - 0.004, u.z, 0.86, 0.86, 'ceil'); else tapeRect(0, 0.004, u.z, 0.62, 0.4, 'ceil');
    mount = new THREE.Group(); venue.add(mount); const mm = std(0xb9c0c8, { metalness: 0.8, roughness: 0.35 });
    if (t === 'wall') { mount.add(box(0.72, 0.24, 0.006, mm, 0, u.y + 0.02, 0.004)); for (let i = 0; i < 6; i++) mount.add(box(0.06, 0.02, 0.008, std(0x8a929b), -0.3 + i * 0.12, u.y + 0.1, 0.006)); }
    else if (t === 'ceiling') [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => mount.add(cyl(0.006, 0.12, mm, sx * (0.635 + 0.042), H - 0.06, u.z + sz * 0.22, 8)));
    else if (t === 'cassette') [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => mount.add(cyl(0.006, 0.6, mm, sx * 0.46, H + 0.3, u.z + sz * 0.29, 8)));
    else mount.add(box(0.2, 0.04, 0.03, mm, 0, 1.75, 0.02), box(0.04, 0.04, 0.2, mm, 0, 1.75, 0.1));
    // ---- refrigerant pipes in the trunking to the condensing unit, drain (blue PVC), power cable — drawn as they are installed
    const valve = V(3.405, 0.21, 0.36), zW = 0.04;
    const run = {
      wall: [[0.5, 2.06, zW], [2.4, 2.06, zW], [3.58, 2.06, zW], [3.58, 0.62, zW]],
      ceiling: [[0.72, 2.6, zW], [2.4, 2.6, zW], [3.58, 2.6, zW], [3.58, 0.62, zW]],
      cassette: [[0.32, 2.63, zW], [2.4, 2.63, zW], [3.58, 2.63, zW], [3.58, 0.62, zW]],
      floor: [[0.36, 0.34, zW], [2.4, 0.34, zW], [3.58, 0.34, zW]],
    }[t];
    const head = { wall: [[0.3, 2.06, 0.02]], ceiling: [[0.5, 2.6, 0.12]], cassette: [[0.32, 2.8, 1.25], [0.32, 2.8, zW]], floor: [[0.2, 0.34, 0.02]] }[t];
    const tail = t === 'floor' ? [[3.5, 0.3, 0.2], [valve.x + 0.02, valve.y + 0.06, valve.z]] : [[3.58, 0.4, 0.2], [valve.x + 0.02, valve.y + 0.06, valve.z]];
    const pipePts = [...head, ...run, ...tail].map(p => V(...p));
    const insM = std(0x15181c, { roughness: 0.85 }), pvcM = std(0x2f8fe0, { roughness: 0.45 }), cabM = std(0xf4f4f0, { roughness: 0.5 });
    pipes = tube(bentPath(pipePts, 0.06), 0.022, insM, 160, 10); world.add(pipes);
    const lids = run.slice(1).map(() => V(0, 0, 1));
    trunk = buildTrunk(run, lids, { caps: [{ at: [2.16, run[1][1], zW], n: [1, 0, 0] }] }).group; trunk.traverse(m => { if (m.isMesh) { m.castShadow = true; m.material = m.material.clone(); m.material.transparent = true; } }); world.add(trunk);
    const dEnd = t === 'floor' ? [[3.7, 0.3, zW], [3.7, 0.05, zW], [3.7, 0.02, 0.18]] : [[3.68, 0.62, zW], [3.68, 0.05, zW], [3.68, 0.02, 0.18]];
    const dPts = [...head.map(p => [p[0] - 0.05, p[1] - 0.03, p[2]]), ...run.map(p => [p[0], p[1] - 0.012, p[2]]), ...dEnd].map(p => V(...p));
    drainP = tube(bentPath(dPts, 0.05), 0.011, pvcM, 160, 8); world.add(drainP); drainP.userData.end = V(3.68, 0.03, 0.18);
    const wPts = { wall: [[1.15, 1.6, 0.02], [1.15, 1.95, 0.02], [0.45, 1.95, 0.02]], ceiling: [[1.15, 1.6, 0.02], [1.15, 2.55, 0.02], [0.6, 2.55, 0.02]], cassette: [[1.15, 1.6, 0.02], [1.15, 2.68, 0.02]], floor: [[1.15, 1.3, 0.02], [1.15, 0.5, 0.02], [0.3, 0.5, 0.02]] }[t].map(p => V(...p));
    wire = tube(bentPath(wPts, 0.04), 0.009, cabM, 60, 6); world.add(wire);
    // test hoses from the gauges (hung on the condensing unit) to the service valve, the vacuum pump and the nitrogen cylinder
    disposeDeep(testHoses, SHARED); testHoses.clear();
    gauges.position.set(3.32, 0.62, 0.52); gauges.rotation.y = -0.35; vac.position.set(3.55, 0, 1.0); n2.position.set(2.62, 0, 0.75);
    const hz = (a, b, col, mid) => testHoses.add(tube([a, mid, b], 0.006, std(col, { roughness: 0.5 }), 40, 6));
    hz(V(3.3, 0.56, 0.54), valve.clone().add(V(0.03, 0.02, 0.02)), 0x2f6fd0, V(3.45, 0.32, 0.6)); testHoses.userData.vac = tube([V(3.34, 0.56, 0.54), V(3.5, 0.3, 0.8), V(3.5, 0.22, 1.0)], 0.006, std(0xf2c230), 40, 6); testHoses.add(testHoses.userData.vac);
    testHoses.userData.n2 = tube([V(3.28, 0.56, 0.54), V(3.0, 0.7, 0.7), V(2.66, 1.1, 0.75)], 0.006, std(0xd0342f), 40, 6); testHoses.add(testHoses.userData.n2);
    // cartons (installation)
    disposeDeep(cartons, SHARED); cartons.clear(); disposeDeep(ocarton, SHARED); ocarton.clear();
    const cs = { wall: [1.02, 0.36, 0.38], ceiling: [1.38, 0.32, 0.76], cassette: [0.98, 0.34, 0.98], floor: [0.68, 1.95, 0.46] }[t];
    { const m = cartonMat('INDOOR UNIT', cs[0], cs[1]), side = std(0xc49a64, { roughness: 0.9 }); const c = new THREE.Mesh(new THREE.BoxGeometry(...cs), [side, side, side, side, m, m]); c.position.y = cs[1] / 2; c.castShadow = true; cartons.add(c); cartons.position.set(P.carton[0], 0, P.carton[1]); cartons.rotation.y = -0.25; }
    { const m = cartonMat('OUTDOOR UNIT', 0.92, 0.66), side = std(0xc49a64, { roughness: 0.9 }); const c = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.66, 0.4), [side, side, side, side, m, m]); c.position.y = 0.33; c.castShadow = true; ocarton.add(c); ocarton.position.set(3.0, -0.035, 1.85); ocarton.rotation.y = 0.15; }
    // ---- air for the run tests (shared physics, soft wisps)
    if (air) air.dispose();
    air = createAirflow(scene, { count: 560, dark, width: 0.017, trail: 0.16, plumeShare: 0, haze: 0.35, alpha: 0.55 }); air.setRoom({ w: 5.4, d: 3.6, h: H, x0: -0.6, z0: 1.8 });
    const L = p => U.root.localToWorld(p.clone());
    const E = t === 'wall' ? [{ o: L(V(0, -0.14, 0.135)), f: V(0, 0, 1), r: V(1, 0, 0), width: 0.7, kind: 'wall', v0: 3.0, intake: L(V(0, 0.16, 0)) }]
      : t === 'ceiling' ? [{ o: L(V(0, -0.05, 0.36)), f: V(0, 0, 1), r: V(1, 0, 0), width: 1.0, kind: 'ceiling', v0: 4.6, intake: L(V(0, -0.12, -0.2)) }]
      : t === 'cassette' ? [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b], k) => ({ o: L(V(a * 0.38, -0.06, b * 0.38)), f: V(a, 0, b), r: V(b, 0, -a), width: 0.55, kind: 'cassette', v0: 3.0, phase: k, intake: L(V(0, -0.15, 0)) }))
      : [{ o: L(V(0, 1.55, 0.24)), f: V(0, 0, 1), r: V(1, 0, 0), width: 0.45, kind: 'floor', v0: 4.0, intake: L(V(0, 0.45, 0.25)) }];
    air.setEmitters(E); air.set({ running: false, swing: true, fan: 1, airF: 1, supplyT: 14, roomT: 30, dark }); air.visible(false);
    // ---- spots (x, z, face) for the crew
    const S = (x, z, f) => ({ x, z, face: f });
    const tP = P.table, tb = P.tub;
    Object.keys(SP).forEach(k => delete SP[k]);
    Object.assign(SP, {
      L: lad[0] ? { x: lad[0].spec.at[0], z: lad[0].spec.at[1], face: Math.PI, ladder: lad[0].spec } : null,
      L2: lad[1] ? { x: lad[1].spec.at[0], z: lad[1].spec.at[1], face: lad[1].spec.face, ladder: lad[1].spec } : null,
      uf: t === 'floor' ? S(0.5, U0.front + 0.3, Math.PI) : S(u.x + 0.78, Math.min(U0.front + 0.5, 2.3), Math.PI),
      uf2: t === 'floor' ? S(-0.55, U0.front + 0.38, 2.2) : S(u.x - 0.32, Math.min(U0.front + 0.5, 2.3), Math.PI),
      foot: t === 'floor' ? S(-0.62, U0.front + 0.5, 2.3) : S(P.lad0[0] + 0.68, P.lad0[1] + 0.32, 0),
      table: S(tP[0] + 0.62, tP[1], -Math.PI / 2), tub: S(tb[0] + 0.62, tb[1], -Math.PI / 2),
      breaker: S(1.15, 0.6, Math.PI), box: S(P.box[0] + 0.15, P.box[1] + 0.62, Math.PI - 0.3), washer: S(P.washer[0] + 0.1, P.washer[1] + 0.55, Math.PI),
      carton: S(P.carton[0] + 0.1, P.carton[1] + 0.62, Math.PI), ocarton: S(3.0, 2.55, Math.PI),
      cartonR: S(P.carton[0] + 0.5, P.carton[1] + 0.05, -Math.PI / 2), cartonL: S(P.carton[0] - 0.5, P.carton[1] + 0.05, Math.PI / 2), sideR: S(u.x + 0.52, u.z + 0.06, -Math.PI / 2), sideL: S(u.x - 0.52, u.z + 0.06, Math.PI / 2),
      table2: S(tP[0] + 0.5, tP[1] + 1.2, faceTo([tP[0] + 0.5, tP[1] + 1.2], tP)), out2: S(2.62, 0.95, faceTo([2.62, 0.95], [3.05, 0.32])),
      out: S(2.72, 0.98, faceTo([2.72, 0.98], [3.0, 0.3])), valve: S(3.72, 0.8, faceTo([3.72, 0.8], [3.41, 0.36])), outDrain: S(3.45, 0.75, 2.2), n2: S(2.75, 1.25, Math.PI),
      door: S(1.85, 2.2, Math.PI / 2), idle0: S(0.85, 2.35, Math.PI), idle1: S(0.3, 2.55, Math.PI),
      cust: S(1.72, 1.4, 0), custMeet: S(1.25, 2.45, 0), leadMeet: S(0.62, 2.0, 0), asstMeet: S(0.15, 2.5, 0),
    });
    if (SP.foot) SP.foot.face = faceTo([SP.foot.x, SP.foot.z], SP.L ? [lad[0].spec.at[0], lad[0].spec.at[1] - 0.3] : [SP.uf.x, SP.uf.z - 0.2]);
    SP.cust.face = faceTo([SP.cust.x, SP.cust.z], [u.x, u.z]); SP.custMeet.face = faceTo([SP.custMeet.x, SP.custMeet.z], [SP.leadMeet.x, SP.leadMeet.z]); SP.leadMeet.face = faceTo([SP.leadMeet.x, SP.leadMeet.z], [SP.custMeet.x, SP.custMeet.z]); SP.asstMeet.face = faceTo([SP.asstMeet.x, SP.asstMeet.z], [SP.custMeet.x, SP.custMeet.z]);
    SP.uf.face = faceTo([SP.uf.x, SP.uf.z], [u.x, u.z]); SP.uf2.face = faceTo([SP.uf2.x, SP.uf2.z], [u.x, u.z]);
    SP.idle0.face = faceTo([0.85, 2.35], [u.x, u.z]); SP.idle1.face = faceTo([0.3, 2.55], [u.x, u.z]);
    // obstacles for walking (table, tub, the floor-standing cabinet)
    OBST.length = 0; OBST.push([tP[0] - 0.42, tP[0] + 0.42, tP[1] - 0.94, tP[1] + 0.94], [tb[0] - 0.4, tb[0] + 0.4, tb[1] - 0.4, tb[1] + 0.4]); if (t === 'floor') OBST.push([-0.34, 0.34, 0, 0.42]);
    // ---- camera presets
    const c = (a, b) => [a, b], up = (x, y, z) => u.clone().add(V(x, y, z));
    Object.keys(CAMS).forEach(k => delete CAMS[k]);
    Object.assign(CAMS, {
      // r7: overhead units — the camera looks higher so the unit at the ceiling stays in frame with the crew under it
      // (low camera looking slightly up: the ceiling, the unit and the opening read; the crew stays in frame)
      wide: t === 'wall' ? c(V(2.35, 3.05, 5.7), V(-0.6, 1.25, 1.1)) : t === 'floor' ? c(V(2.3, 2.2, 5.5), V(-0.5, 1.3, 1.1)) : t === 'cassette' ? c(V(2.4, 1.5, 6.0), V(-0.45, 1.85, 1.15)) : c(V(2.4, 1.6, 6.0), V(-0.45, 1.8, 0.85)),
      team: t === 'wall' ? c(V(1.9, 2.55, 4.85), V(-0.45, 1.15, 1.0)) : t === 'floor' ? c(V(1.85, 2.2, 4.7), V(-0.45, 1.35, 1.0)) : t === 'cassette' ? c(V(2.15, 1.55, 5.75), V(-0.4, 1.85, 1.15)) : c(V(2.2, 1.6, 5.7), V(-0.4, 1.8, 0.7)),   // r7: far enough that the lead on the ladder does not fill the frame
      table: c(V(tP[0] + 1.5, 1.85, tP[1] + 1.75), V(tP[0], 0.8, tP[1])), tub: c(V(tb[0] + 1.45, 1.55, tb[1] + 1.25), V(tb[0], 0.3, tb[1])),
      breaker: c(V(1.55, 1.7, 1.7), V(1.0, 1.4, 0.1)), outdoor: c(V(3.75, 2.55, 3.55), V(3.0, 0.35, 0.45)), door: c(V(-0.3, 1.8, 3.7), V(1.4, 0.75, 1.8)), meet: c(V(-1.25, 1.95, 4.65), V(0.85, 1.1, 2.15)),
      // close-ups of overhead units from the left, the side away from the lead's ladder (he never stands between camera and unit)
      unit: { wall: c(up(-0.85, 0.0, 1.9), up(0, -0.08, 0)), ceiling: c(up(-1.75, -0.8, 1.45), up(0.05, -0.1, 0.12)), cassette: c(up(-1.9, -1.35, -0.8), up(0.1, 0.02, 0.05)), floor: c(up(-0.04, 2.45, 2.3), up(0, 0.9, 0.12)) }[t],   // r7 floor: high, straight on, between the lead (right) and the assistant (left)
      under: { wall: c(V(-0.95, 1.45, 1.75), V(0.05, 2.08, 0.15)), ceiling: c(up(-1.6, -1.15, 1.1), up(0.05, -0.1, 0.12)), cassette: c(up(-1.75, -1.4, -0.7), up(0.1, 0.02, 0.05)), floor: c(up(0.02, 2.4, 2.1), up(0, 0.78, 0.12)) }[t],
      back: { wall: c(V(-1.6, 1.5, 1.6), V(0.05, 2.02, 0.2)), ceiling: c(up(-1.55, -0.95, 0.95), up(0.05, -0.12, -0.02)), cassette: c(up(-1.85, -1.3, -0.5), up(0.12, 0.04, 0.08)), floor: c(up(-0.06, 2.45, 2.0), up(0, 0.9, 0.05)) }[t],
      bag: { wall: c(V(1.5, 1.95, 3.15), V(0.15, 1.35, 0.5)), ceiling: c(V(1.4, 1.35, 2.9), V(0.2, 1.5, 0.7)), cassette: c(V(1.45, 1.25, 3.4), V(0.2, 1.6, 1.4)), floor: c(V(1.3, 1.2, 2.6), V(0.1, 0.4, 0.6)) }[t],
      ceil: c(V(1.0, 1.15, 3.6), V(0, 2.55, 1.0)),
    });
  }
  const OBST = [];
  // route avoiding the table / tub, through the door between inside and outside
  const DOOR_IN = [1.8, 2.2], DOOR_OUT = [2.55, 2.2];
  const hits = (a, b, r) => { for (let k = 0; k <= 12; k++) { const x = a[0] + (b[0] - a[0]) * k / 12, z = a[1] + (b[1] - a[1]) * k / 12; if (x > r[0] - 0.3 && x < r[1] + 0.3 && z > r[2] - 0.3 && z < r[3] + 0.3) return true; } return false; };
  const inside = (p, r, m = 0.3) => p[0] > r[0] - m && p[0] < r[1] + m && p[1] > r[2] - m && p[1] < r[3] + m;
  // obstacles for member i: the table / tub / cabinet + the other people standing still + the lead's ladder (Rev.09 r4: nobody walks through anyone)
  function obstFor(i) {
    const L = OBST.slice();
    if (crew) crew.members.forEach((n, j) => { if (j !== i && !n.path.length) L.push([n.x - 0.18, n.x + 0.18, n.z - 0.18, n.z + 0.18]); });
    if (i !== 0 && lad[0] && lad[0].L.visible) { const p = lad[0].L.position, e = lad[0].h * 0.36; L.push([p.x - 0.26, p.x + 0.26, p.z - e, p.z + e]); }
    return L;
  }
  function leg(a, b, OB) {
    const list = OB.filter(r2 => !inside(a, r2) && !inside(b, r2));
    const r = list.find(o2 => hits(a, b, o2)); if (!r) return [b];
    const cs2 = [[r[0] - 0.38, r[2] - 0.38], [r[1] + 0.38, r[2] - 0.38], [r[0] - 0.38, r[3] + 0.38], [r[1] + 0.38, r[3] + 0.38]].filter(c2 => !list.some(o2 => hits(a, c2, o2) || hits(c2, b, o2)));
    if (!cs2.length) return [b]; cs2.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) + Math.hypot(b[0] - p[0], b[1] - p[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]) - Math.hypot(b[0] - q[0], b[1] - q[1]));
    return [cs2[0], b];
  }
  function route(a, b, i = 0) {
    const OB = obstFor(i), ina = a[0] < 2.16, inb = b[0] < 2.16;
    if (ina === inb) return leg(a, b, OB);
    return ina ? [...leg(a, DOOR_IN, OB), DOOR_OUT, b] : [DOOR_OUT, DOOR_IN, ...leg(DOOR_IN, b, OB)];
  }

  /* ---------------------------------------------------------------- state + animation */
  const SCAL = ['power', 'run', 'bag', 'pcb', 'lower', 'foam', 'probes', 'bagWater', 'drain', 'marks', 'mount', 'cut', 'unbox', 'unitK', 'cartons', 'oUnbox', 'outK', 'ocarton', 'pipeK', 'trunkK', 'drainK', 'wireK', 'gauges', 'n2', 'vac', 'needle', 'lad0', 'lad1', 'sign', 'carry', 'panel'];
  const LIN = { unitK: 0.42, outK: 0.45, pipeK: 0.3, trunkK: 0.4, drainK: 0.4, wireK: 0.5, lower: 0.6, needle: 0.35 };   // linear rates (per s) — the rest ease in
  const base = j => ({ cam: 'wide', power: 1, run: 0, bag: 0, pcb: 0, lower: 0, foam: 0, probes: 0, bagWater: 0, drain: 0, marks: 0, mount: 1, cut: 1, unbox: 1, unitK: 1, cartons: 0, oUnbox: 1, outK: 1, ocarton: 0, pipeK: 1, trunkK: 1, drainK: 1, wireK: 1, gauges: 0, n2: 0, vac: 0, needle: 0, lad0: 1, lad1: 0, sign: 1, panel: 1, ...(j === 'install' ? { mount: 0, cut: 0, unbox: 0, unitK: 0, oUnbox: 0, outK: 0, pipeK: 0, trunkK: 0, drainK: 0, wireK: 0, lad0: 0 } : {}), dirt: { ...DIRT0 }, off: {}, spray: null, crew: [], beats: [] });
  const st = { ...base(job), dirt: { ...DIRT0 } };
  let T = base(job), snap = true, beats = [], beatT = 0;
  const want = [null, null, null];
  function crewGo(i, sp, instant) {
    if (!crew || !sp) return; let s = sp.s || 'idle0', a = sp.a || 'idle';
    if ((s === 'L' || s === 'L2') && !SP[s]) s = s === 'L' ? 'uf' : 'uf2';
    const al = ACT[type]; if (al && al[a] && (s === 'L' || s === 'L2' || (type === 'floor' && (s === 'uf' || s === 'uf2')))) a = al[a];
    const p = SP[s] || SP.idle0; const spec = { x: p.x, z: p.z, face: sp.face ?? p.face, act: a, tool: sp.t || null, ladder: p.ladder || null };
    instant ? crew.place(i, spec) : crew.go(i, spec);
  }
  function setWant(i, sp, instant) { want[i] = sp; if (i === 2 || (!trip && !trips.length)) crewGo(i, sp, instant); }

  /* ---- parts: off the unit → lead's hands → assistant → table (and back for reassembly) */
  let trips = [], trip = null;
  function holderOf(id) {
    if (HP[id]) return HP[id]; const g = U.parts[id]; if (!g || g.parent !== U.root) return null;
    U.root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(V(0, 0, 0)), size = bb.getSize(V(0, 0, 0));
    U.root.worldToLocal(c); const h = new THREE.Group(); h.position.copy(c); U.root.add(h); g.position.sub(c); h.add(g);
    // resting pose on the table: the tilt about x that makes the part lowest (curved / inclined panels lie flat), long parts along the table
    const yaw = size.x > 0.55 && type !== 'cassette' ? Math.PI / 2 : 0, q = new THREE.Quaternion(), e = new THREE.Euler(0, yaw, 0, 'YXZ'); let best = (FLATX[type] || {})[id] || 0, bh = 9;
    world.attach(h); for (let a = -1.6; a <= 1.6; a += 0.1) { e.x = a; h.quaternion.setFromEuler(e); h.updateMatrixWorld(true); const hh = new THREE.Box3().setFromObject(h).getSize(V(0, 0, 0)).y; if (hh < bh - 0.004) { bh = hh; best = a; } }
    U.root.attach(h); h.position.copy(c); h.quaternion.identity();
    return (HP[id] = { id, h, rest: c.clone(), loc: 'unit', want: 'unit', flat: new THREE.Quaternion().setFromEuler(new THREE.Euler(best, yaw, 0, 'YXZ')), long: size.x > 0.55, slot: -1, y: 0 });
  }
  const hold = (i, j) => { const m = crew.mid(i), f = crew.members[i].face; return m.add(V(Math.sin(f) * 0.14, 0.02 + j * 0.06, Math.cos(f) * 0.14)); };
  const restW = P => U.root.localToWorld(P.rest.clone());
  const tmpQ = new THREE.Quaternion(), bb = new THREE.Box3();
  function slotFor(P) {   // slot on the table + the landing height (part resting flat on the table or on the parts below it)
    const k = P.long ? 1 : (Object.values(HP).filter(q => q.loc === 'table' && !q.long).length % 2 ? 2 : 0);
    const q0 = P.h.quaternion.clone(), p0 = P.h.position.clone(); P.h.quaternion.copy(P.flat); P.h.position.set(0, 0, 0); P.h.updateMatrixWorld(true);
    bb.setFromObject(P.h, true); P.h.quaternion.copy(q0); P.h.position.copy(p0); P.h.updateMatrixWorld(true);
    const c = bb.getCenter(V(0, 0, 0)); const pos = V(table.position.x - c.x, slotTop[k] - bb.min.y + 0.003, table.position.z + SLOTZ[k] - c.z);
    slotTop[k] += bb.max.y - bb.min.y; P.slot = k; return pos;
  }
  function toTable(P) { if (P.h.parent !== world) world.attach(P.h); const pos = slotFor(P); P.h.position.copy(pos); P.h.quaternion.copy(P.flat); P.loc = 'table'; }
  function toUnit(P) { if (P.h.parent !== U.root) U.root.attach(P.h); P.h.position.copy(P.rest); P.h.quaternion.identity(); P.loc = 'unit'; }
  function finishAll() { trip = null; trips = []; Object.values(HP).forEach(P => { if (P.want === 'table' && P.loc !== 'table') toTable(P); if (P.want === 'unit' && P.loc !== 'unit') toUnit(P); }); if (Object.values(HP).every(P => P.loc === 'unit')) slotTop = [TT, TT, TT]; }
  function planParts(off, instant) {
    if (!U) return;
    const down = Object.keys(off).filter(id => { const P = holderOf(id); return P && P.want !== 'table'; });
    const up = Object.values(HP).filter(P => P.want === 'table' && !off[P.id]).map(P => P.id).reverse();
    down.forEach(id => { HP[id].want = 'table'; }); up.forEach(id => { HP[id].want = 'unit'; });
    if (instant || RM()) { finishAll(); return; }
    for (let i = 0; i < down.length; i += 3) trips.push({ dir: 'down', ids: down.slice(i, i + 3) });
    for (let i = 0; i < up.length; i += 3) trips.push({ dir: 'up', ids: up.slice(i, i + 3) });
  }
  function runTrips(dt) {
    if (!trip) { trip = trips.shift() || null; if (!trip) return; Object.assign(trip, { stage: 'go', t: 0, i: 0 }); }
    const R = trip, nx = s2 => { R.stage = s2; R.t = 0; }, D = R.dir === 'down';
    const ids = R.ids.map(id => HP[id]);
    R.t += dt;
    if (R.stage === 'go') {
      if (R.t - dt === 0) { crewGo(0, { s: 'L', a: 'work' }); crewGo(1, D ? { s: 'foot', a: 'receive' } : { s: 'table', a: 'table' }); }
      if (R.t > 0.15 && !crew.busy(0) && !crew.busy(1)) nx(D ? 'pull' : 'pick');
    } else if (R.stage === 'pull') {   // lead lifts the part off the unit
      const P = ids[R.i]; if (R.t - dt === 0) { P.from = P.h.getWorldPosition(V(0, 0, 0)); world.attach(P.h); P.loc = 'move'; crewGo(0, { s: 'L', a: 'work' }); }
      P.h.position.lerpVectors(P.from, crew.mid(0), ease(clamp(R.t / 0.6, 0, 1))); if (R.t >= 0.6) nx('pass');
    } else if (R.stage === 'pass') {   // hands it down to the assistant
      const P = ids[R.i]; if (R.t - dt === 0) { crewGo(0, { s: 'L', a: 'handDown' }); crewGo(1, { s: 'foot', a: 'receive' }); P.from = P.h.position.clone(); }
      const k = ease(clamp((R.t - 0.25) / 0.55, 0, 1)); P.h.position.lerpVectors(R.t < 0.25 ? crew.mid(0) : P.from.lerp(crew.mid(0), 0.2), hold(1, R.i), k);
      ids.slice(0, R.i).forEach((Q, j) => Q.h.position.copy(hold(1, j)));
      if (R.t >= 0.85) { R.i++; nx(R.i < ids.length ? 'pull' : 'carry'); }
    } else if (R.stage === 'carry') {   // assistant walks the parts to the table (or back to the ladder)
      if (R.t - dt === 0) crewGo(1, D ? { s: 'table', a: 'carry' } : { s: 'foot', a: 'carry' });
      ids.forEach((P, j) => P.h.position.copy(hold(1, j)));
      if (R.t > 0.2 && !crew.busy(1)) { R.i = D ? 0 : 0; nx(D ? 'place' : 'up'); }
    } else if (R.stage === 'place') {   // laid on the table one by one
      const P = ids[R.i]; if (R.t - dt === 0) { crewGo(1, { s: 'table', a: 'table' }); P.from = P.h.position.clone(); P.q0 = P.h.quaternion.clone(); P.to = slotFor(P); }
      const k = ease(clamp(R.t / 0.5, 0, 1)); P.h.position.lerpVectors(P.from, P.to, k); P.h.quaternion.slerpQuaternions(P.q0, P.flat, k);
      ids.slice(R.i + 1).forEach((Q, j) => Q.h.position.copy(hold(1, j)));
      if (R.t >= 0.5) { P.loc = 'table'; R.i++; if (R.i >= ids.length) { trip = null; if (!trips.length) [0, 1].forEach(i => crewGo(i, want[i])); } else nx('place'); }
    } else if (R.stage === 'pick') {   // reassembly: the assistant picks the parts up from the table
      if (R.t - dt === 0) ids.forEach(P => { P.from = P.h.position.clone(); P.q0 = P.h.quaternion.clone(); P.loc = 'move'; });
      const k = ease(clamp(R.t / 0.6, 0, 1)); U.root.getWorldQuaternion(tmpQ);
      ids.forEach((P, j) => { P.h.position.lerpVectors(P.from, hold(1, j), k); P.h.quaternion.slerpQuaternions(P.q0, tmpQ, k); });
      if (R.t >= 0.6) { R.i = 0; slotTop = [TT, TT, TT]; Object.values(HP).filter(P => P.loc === 'table').forEach(P => { const b2 = new THREE.Box3().setFromObject(P.h); slotTop[P.slot] = Math.max(slotTop[P.slot], b2.max.y); }); nx('carry'); }
    } else if (R.stage === 'up') {   // handed up to the lead
      const P = ids[R.i]; if (R.t - dt === 0) { crewGo(1, { s: 'foot', a: 'receive' }); crewGo(0, { s: 'L', a: 'handDown' }); P.from = P.h.position.clone(); }
      P.h.position.lerpVectors(P.from, crew.mid(0), ease(clamp(R.t / 0.6, 0, 1))); ids.slice(R.i + 1).forEach((Q, j) => Q.h.position.copy(hold(1, j)));
      if (R.t >= 0.6) nx('fit');
    } else if (R.stage === 'fit') {   // and fitted back on the unit
      const P = ids[R.i]; if (R.t - dt === 0) { crewGo(0, { s: 'L', a: 'work' }); P.from = P.h.position.clone(); }
      P.h.position.lerpVectors(P.from, restW(P), ease(clamp(R.t / 0.6, 0, 1))); ids.slice(R.i + 1).forEach((Q, j) => Q.h.position.copy(hold(1, j)));
      if (R.t >= 0.6) { toUnit(P); R.i++; if (R.i >= ids.length) { trip = null; if (!trips.length) [0, 1].forEach(i => crewGo(i, want[i])); } else nx('up'); }
    }
  }

  function tintParts() {
    if (!U) return;
    Object.entries(U.mats).forEach(([id, list]) => { const d = st.dirt[id] ?? (id === 'blower' ? st.dirt.fan : 0); const c = DIRT_C[id]; if (!c || !list.length) return; const dc = new THREE.Color(c); list.forEach(m => m.material.color.copy(m.userData.base).lerp(dc, d * (id === 'filter' ? 0.9 : 0.75))); });
    if (OU) { const dc = new THREE.Color(DIRT_C.outdoor); OU.root.traverse(m => { if (m.isMesh && m.userData.base) m.material.color.copy(m.userData.base).lerp(dc, st.dirt.outdoor * 0.5); }); }
  }
  const drawK = (mesh, k) => { const g = mesh.geometry, n = g.index ? g.index.count : g.attributes.position.count; const segs = g.parameters ? g.parameters.tubularSegments : 1; const per = n / segs; g.setDrawRange(0, Math.round(clamp(k, 0, 1) * segs) * per); mesh.visible = k > 0.003; };
  const unitPath = (k, out) => {   // install: from the carton (unboxed, on the floor) up to the mounting position
    const c = cartons.position, p2 = U0.p, h0 = type === 'floor' ? 0 : type === 'cassette' ? 0.25 : 0.3;
    const p0 = V(c.x, h0, c.z), p1 = type === 'cassette' ? V(p2.x, p2.y - 0.9, p2.z) : type === 'floor' ? V((c.x + p2.x) / 2, 0.25, (c.z + p2.z) / 2 + 0.3) : V(p2.x, p2.y - 0.7, p2.z + 0.55);
    const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, d = k * k; return out.set(p0.x * a + p1.x * b + p2.x * d, p0.y * a + p1.y * b + p2.y * d, p0.z * a + p1.z * b + p2.z * d);
  };
  const tmpV = V(0, 0, 0); let carried = false;
  function step(dt) {
    // beats inside a step (sequenced crew actions)
    beatT += dt; while (beats.length && beatT >= beats[0].t) { const b = beats.shift(); if (b.set) Object.assign(T, b.set); if (b.crew) b.crew.forEach((sp, i) => sp && setWant(i, sp)); }
    if (trip || trips.length) runTrips(dt);
    // scalar state
    const k = snap ? 1 : 1 - Math.pow(0.02, dt);
    SCAL.forEach(n => { const tg = T[n] ?? 0; if (LIN[n] && !snap) { const d = tg - st[n]; st[n] += Math.sign(d) * Math.min(Math.abs(d), LIN[n] * dt); } else st[n] += (tg - st[n]) * k; });
    Object.keys(st.dirt).forEach(n => { const tg = T.dirt[n] ?? st.dirt[n]; st.dirt[n] += (tg - st.dirt[n]) * (snap ? 1 : 1 - Math.pow(0.3, dt)); });
    // props
    const inst = job === 'install';
    bag.visible = st.bag > 0.02; bag.userData.m.opacity = 0.42 * st.bag; bag.userData.m.color.set(0xbfe0ff).lerp(new THREE.Color(0x8a7a62), st.bagWater * 0.75);
    bucket.visible = st.bag > 0.02; bucketW.position.y = 0.05 + st.bagWater * 0.22; bucketW.visible = st.bagWater > 0.05;
    pcbCover.visible = st.pcb > 0.02; pcbCover.material.opacity = 0.38 * st.pcb; foam.material.opacity = st.foam * 0.95; probes.visible = st.probes > 0.5;
    tubW.material.color.set(0x9fb8c9).lerp(new THREE.Color(0x8a7a62), clamp(Object.values(HP).filter(P => P.loc === 'table').reduce((a2, P) => a2 + (st.dirt[P.id] ?? 0), 0) / 3, 0, 1) * 0.6);
    table.visible = tub.visible = !inst; washer.visible = !inst; matG.visible = true; tbox.visible = !crew || ![0, 1].some(i => crew.members[i].tool === 'box');
    signG.visible = !!signG.userData.on && st.sign > 0.5 && type !== 'wall';
    lever.rotation.x = (1 - st.power) * 0.9; led.material.color.setHex(st.power > 0.5 ? 0x3ad36b : 0x3a3f46); brk.visible = !inst || st.wireK > 0.5;
    marks.visible = st.marks > 0.5; mount.visible = st.mount > 0.5; if (patch) patch.visible = inst && st.cut < 0.5;
    cartons.visible = st.cartons > 0.5; ocarton.visible = st.ocarton > 0.5;
    gauges.visible = st.gauges > 0.5; n2.visible = st.n2 > 0.5; vac.visible = st.vac > 0.5; testHoses.visible = gauges.visible; testHoses.userData.vac.visible = vac.visible; testHoses.userData.n2.visible = n2.visible;
    needles.forEach((nd, i) => { nd.rotation.z = -clamp(st.needle, -1, 1) * (i ? 1.6 : 2.0) + (vac.visible ? Math.sin(clock * 40) * 0.01 : 0); });
    drawK(pipes, st.pipeK); drawK(drainP, st.drainK); drawK(wire, st.wireK);
    trunk.visible = st.trunkK > 0.01; trunk.traverse(m => { if (m.isMesh) m.material.opacity = clamp(st.trunkK, 0, 1); });
    if (lad[0]) lad[0].L.visible = st.lad0 > 0.5 || (crew && crew.members[0].ladder === lad[0].spec); if (lad[1]) lad[1].L.visible = st.lad1 > 0.5;
    // unit: mounted / lifted from the carton / hidden in the carton; C2 wall unit swings out on its top hooks (pipes stay connected)
    if (U) {
      U.root.visible = st.unbox > 0.5 || st.unitK > 0.01;
      // floor-standing: two men carry the cabinet between them (it follows their hands), then it stands in place
      if (type === 'floor' && T.carry > 0.5 && crew && !snap) { const a = crew.members[0], b = crew.members[1]; U.root.position.set((a.x + b.x) / 2, 0.06, (a.z + b.z) / 2); U.root.rotation.set(0, 0, 0); carried = true; }
      else if (carried && type === 'floor') { carried = false; st.unitK = 1; U.root.position.copy(U0.p); }
      else if (st.unitK < 0.999) { unitPath(clamp(st.unitK, 0, 1), U.root.position); U.root.rotation.set(0, type === 'floor' ? 0 : -0.25 * (1 - st.unitK), 0); }
      else if (type === 'wall') { const th = -0.42 * st.lower, hy = 0.15, hz = -0.12, hinge = V(0, 2.33 - 0.08 * st.lower, 0.015); U.root.rotation.set(th, 0, 0); U.root.position.set(0, hinge.y - (hy * Math.cos(th) - hz * Math.sin(th)), hinge.z - (hy * Math.sin(th) + hz * Math.cos(th))); }
      else { U.root.position.copy(U0.p); U.root.rotation.set(0, 0, 0); }
      // r7: C2 on an overhead unit — the casing turns see-through once the unit is opened, so the fans / coil / pan read clearly
      if (U.mats.casing && (type === 'ceiling' || type === 'cassette')) { const ko = 1 - 0.72 * clamp(st.lower, 0, 1); U.mats.casing.forEach(m => { const mt = m.material; if (Math.abs(mt.opacity - ko) > 0.002) { mt.transparent = ko < 0.995; mt.opacity = ko; mt.depthWrite = ko > 0.9; } }); }
      // r7: cassette installation — decorative panel, louvers, return grille and filter go on after piping and drain
      if (type === 'cassette') { const pv = st.panel > 0.5; ['panel', 'louver', 'grille', 'filter'].forEach(k => { const g = U.parts[k]; if (g) g.visible = pv; }); }
      // condensing unit: from its carton to the stand
      const ob = OU.base, oc = ocarton.position, ok = clamp(st.outK, 0, 1); OU.root.visible = st.oUnbox > 0.5 || ok > 0.01;
      OU.root.position.set(oc.x + (ob.x - oc.x) * ease(ok), ob.y + Math.sin(ok * Math.PI) * 0.18, oc.z + (ob.z - oc.z) * ease(ok)); OU.root.rotation.y = 0.15 * (1 - ok);
    }
    tintParts();
    // spray from the gun in the sprayer's hand
    const sp = T.spray; let tip = null;
    if (sp && !RM() && crew && !trip) tip = crew.toolTip(sp.by ?? 0, sp.chem ? 'sprayer' : 'gun');
    if (tip) {
      sprayOn = true; sprayChem = !!sp.chem; sweep += dt; sprayTip.copy(tip);
      const tgt = sp.at === 'tub' ? tub.position.clone().add(V(Math.sin(sweep * 1.4) * 0.15, 0.2, Math.cos(sweep * 1.1) * 0.1)) : sp.at === 'outdoor' ? V(3.05 + Math.sin(sweep * 1.2) * 0.28, 0.42, 0.5) : U.root.localToWorld((LOCAL[sp.at] || LOCAL.coil).clone()).add(V(Math.sin(sweep * 1.3) * U0.w * (type === 'cassette' ? 0.2 : 0.32), 0, 0));
      sprayTarget.lerp(tgt, 1 - Math.pow(0.02, dt));
      sMat.color.setHex(sp.chem ? (dark ? 0xf4f7fb : 0xc9d6e2) : dark ? 0xd8f1ff : 0x5d9fd0);
      mist.position.copy(sprayTarget); const ms = (sp.chem ? 0.22 : 0.3) + 0.06 * Math.sin(clock * 9); mist.scale.set(ms, ms, 1); mist.material.opacity = 0.5;
      washerHose(sp.chem ? null : crew.hand(sp.by ?? 0, 0));
    } else { sprayOn = false; mist.material.opacity = Math.max(0, mist.material.opacity - dt * 2); washerHose(null); }
    emitSpray(RM() ? 0.016 : dt);
    // drain test: water along the pan to its outlet, and out of the drain pipe at the end of the run
    drops.visible = st.drain > 0.5;
    if (drops.visible && U) { const a = U.root.localToWorld(LOCAL.d0.clone()), b = U.root.localToWorld(LOCAL.d1.clone()), e = drainP.userData.end; for (let i = 0; i < NDR; i++) { dU[i] = (dU[i] + dt * 0.35) % 1; if (i < 44) { tmpV.copy(a).lerp(b, dU[i]); dPos[i * 3] = tmpV.x; dPos[i * 3 + 1] = tmpV.y + 0.006 * Math.sin(i); dPos[i * 3 + 2] = tmpV.z + 0.01 * Math.cos(i * 1.7); } else { dPos[i * 3] = e.x + Math.sin(i) * 0.005; dPos[i * 3 + 1] = e.y - dU[i] * 0.03; dPos[i * 3 + 2] = e.z + 0.02 + dU[i] * 0.02; } } dg.attributes.position.needsUpdate = true; }
    // running unit: louvers + fan + soft air
    if (U) {
      const run = st.run > 0.5;
      if (type === 'wall') { const fl = U.parts.louver && U.parts.louver.userData.flap; if (fl && run) fl.rotation.x = 0.55 + Math.sin(clock * 0.8) * 0.18; const bs = U.parts.blower && U.parts.blower.userData.spin; if (bs && run) bs.rotation.x -= dt * 9; }
      else if (U.anim && run && !RM()) animateUnit(U, dt, clock, 0.8);
      air.visible(run); air.set({ running: run }); if (run) air.update(RM() ? 0 : dt, clock);
      if (OU.parts && OU.parts['o-fan'] && run) OU.parts['o-fan'].userData.spin.rotation.z -= dt * 14;
    }
    if (crew) crew.tick(dt, clock);
    snap = false;
  }
  let sweep = 0;
  const camP = V(2.15, 2.3, 4.75), camT = V(-0.55, 1.2, 1.0), wantP = V(0, 0, 0);
  function camStep(dt) {
    const c = CAMS[T.cam] || CAMS.wide, asp = cam.aspect; if (!c) return;
    const pull = asp < 1.1 ? 1.38 : asp < 1.4 ? 1.12 : 1;   // phones: step back
    wantP.copy(c[0]).sub(c[1]).multiplyScalar(pull).add(c[1]);
    const k = snap || RM() ? 1 : 1 - Math.pow(0.03, dt);
    camP.lerp(wantP, k); camT.lerp(c[1], k); cam.position.copy(camP); cam.lookAt(camT);
  }

  /* ---------------------------------------------------------------- loop */
  let raf = 0, last = performance.now(), vis = false, clock = 0, idle = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis) kick(); }, { rootMargin: '120px 0px' }); io.observe(container);
  const size = () => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(() => { size(); kick(); }); ro.observe(container);
  function kick() { idle = 0; if (!raf && vis) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  const isBusy = () => !!(trip || trips.length || beats.length || (crew && [0, 1, 2].some(i => crew.busy(i))) || Object.keys(LIN).some(n => Math.abs((T[n] ?? 0) - st[n]) > 0.003));
  function tick(now) {
    raf = 0; if (!vis) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    step(dt); camStep(dt);
    renderer.render(scene, cam);
    o.onFrame && o.onFrame(cam, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
    // the crew keeps moving (idle sway, work motion): keep rendering while visible, slower when nothing happens
    idle = isBusy() || sprayOn || st.run > 0.5 ? 0 : idle + dt;
    if (idle < 6) raf = requestAnimationFrame(tick); else { raf = 0; setTimeout(() => { if (vis && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }, 250); idle = 5.5; }
  }

  function setType(t) {
    if (t === type) return; type = t;
    if (crew) { crew.dispose(); crew = null; }
    placeUnit(t); buildVenue(t); propsFor(t);
    crew = createCrew(world, { route, at: [[SP.idle0.x, SP.idle0.z], [SP.idle1.x, SP.idle1.z], [SP.cust.x, SP.cust.z]], customer: CUST[t] });
    trips = []; trip = null; snap = true; signG.userData.on = true;
    const s0 = T; T = base(job); show({ ...s0, off: {} }, { jump: true });
  }
  function show(s, opt = {}) {
    const jump = !!opt.jump || RM();
    if (jump) { finishAll(); }
    else if (trip || trips.length) finishAll();   // a new step while parts are still moving: put them where they belong first
    T = { ...base(job), ...s, dirt: { ...DIRT0, ...(s.dirt || {}) }, off: s.off || {}, spray: s.spray || null };
    planParts(T.off, jump);
    beats = (s.beats || []).slice().sort((a, b) => a.t - b.t); beatT = 0;
    if (jump) { while (beats.length) { const b = beats.shift(); if (b.set) Object.assign(T, b.set); if (b.crew) s.crew = s.crew ? s.crew.map((c2, i) => b.crew[i] || c2) : b.crew; } snap = true; }
    (s.crew || []).forEach((sp, i) => sp && setWant(i, sp, jump));
    kick();
  }
  size(); setType(o.type || 'wall');
  // r15: the other venues are built and their shaders (venue + unit) compiled once the visitor pauses — one type at a time —
  // so a type tab switches without waiting for the GPU; the sample unit's geometry is freed, its materials' programs stay
  const preDone = new Set();
  function preload() {
    const t = ['wall', 'ceiling', 'cassette', 'floor'].find(k => k !== type && !preDone.has(k)); if (!t) return;
    whenCalm(() => {
      preDone.add(t); if (t === type) return preload();
      if (!venues[t]) { const keepV = venue, keepP = patch; buildVenue(t); venues[t].visible = false; venue = keepV; patch = keepP; if (venue) venue.visible = true; }
      const S2 = t === 'wall' ? buildPremiumIndoor(M, { logo: false }) : t === 'ceiling' ? buildCeilingUnit(M, { interior: true, rod: 0 }) : t === 'cassette' ? buildCassetteUnit(M, { interior: true, rod: 0 }) : buildFloorUnit(M, { interior: true, w: 0.6, h: 1.85, d: 0.38 });
      S2.root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      whenCalm(() => { warm(renderer, scene, cam, venues[t]); warm(renderer, scene, cam, S2.root); freeGeometry(S2.root); preload(); }, 500);
    }, 1500);
  }
  setTimeout(preload, 3000);

  return {
    setType(t) { setType(t); kick(); },
    setJob(j) { if (j === job) return; job = j; finishAll(); Object.values(HP).forEach(toUnit); T = base(job); snap = true; kick(); },
    show,
    reset() { finishAll(); Object.values(HP).forEach(P => { P.want = 'unit'; toUnit(P); }); slotTop = [TT, TT, TT]; T = base(job); snap = true; kick(); },
    busy: isBusy,
    project(p) { return p.clone().project(cam); },
    anchors: () => {
      const heads = crew ? crew.crowd.heads() : [], A = U0.p.clone();
      return { unit: type === 'floor' ? A.clone().add(V(0, 1.2, 0.2)) : A, pipes: type === 'wall' ? V(0.42, 2.05, 0.06) : type === 'ceiling' ? V(0.75, 2.6, 0.06) : type === 'cassette' ? V(0.35, 2.62, 0.06) : V(0.4, 0.36, 0.06), table: V(table.position.x, 0.95, table.position.z), tub: tub.position.clone().add(V(0, 0.4, 0)), breaker: V(1.15, 1.7, 0.05), bag: bag && bucket.position.clone().add(V(0, 0.5, 0)), outdoor: V(3.05, 0.85, 0.32), mat: matG.position.clone().add(V(0, 0.05, 0.4)), lead: heads[0] && heads[0].clone().add(V(0, 0.25, 0)), asst: heads[1] && heads[1].clone().add(V(0, 0.25, 0)), cust: heads[2] && heads[2].clone().add(V(0, 0.25, 0)), carton: cartons.position.clone().add(V(0, 0.6, 0)), ocarton: ocarton.position.clone().add(V(0, 0.8, 0)), trunk: V(1.6, type === 'floor' ? 0.4 : type === 'wall' ? 2.12 : 2.66, 0.05), drain: drainP ? drainP.userData.end.clone().add(V(0, 0.2, 0)) : null, gauges: gauges.position.clone().add(V(0, 0.15, 0)), sign: signG.position.clone().add(V(0, 0.75, 0)) };
    },
    advance(sec) { for (let t = 0; t < sec; t += 0.05) { clock += 0.05; step(0.05); } camStep(1); renderer.render(scene, cam); },
    dispose() { gl.release(); cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); air && air.dispose(); crew && crew.dispose(); scene.traverse(x => { if ((x.isMesh || x.isPoints) && x.geometry) x.geometry.dispose(); }); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); },
  };
}
