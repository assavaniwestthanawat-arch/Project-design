// SBP AirCare — "where does the cold air go" room simulation (Rev.08), replaces the 2D stick-figure section.
// A furnished 12 m cut-away room; the chosen unit type (wall / ceiling-suspended / 4-way cassette) runs with the
// airflow model from airflow3d.js (jet, swing, Coanda, sinking cold air, floor spread, return air, heat plumes) and
// animated occupants from people3d.js who react to the air temperature where they are. The floor shows the
// occupied-zone temperature, a distance scale runs along the front edge, and each person shows the temperature
// around them. Fan speed / swing / dirty filter can be changed to see the throw grow or shrink. Illustrative only.
import * as THREE from './three.module.min.js';
import { track as glTrack, warm, whenCalm, freeGeometry } from './gl-pool.js';
import { RoomEnvironment } from './RoomEnvironment.js';
import { materialSet } from './ac3d.js';
import { buildWallUnit, buildCeilingUnit, buildCassetteUnit, buildFloorUnit, animateUnit } from './units3d.js';
import { createAirflow, tempColor } from './airflow3d.js';
import { createCrowd } from './people3d.js';
import { mats, F, windowUnit, ctex, rbox } from './roomkit3d.js';
import { h } from './sbp-core.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const L = 12, D = 4.6, H = 2.8;

const TYPE_INFO = {
  wall: { th: 'แอร์ติดผนัง', nominal: 6.5, note: 'ติดผนังสูงราว 2.3 ม. บานสวิงส่ายขึ้นลง ลมเย็นพุ่งเฉียงลงแล้วแผ่ไปตามพื้น ห้องลึกเกิน ~6–7 ม. ด้านไกลเย็นช้ากว่าและคนด้านไกลยังร้อน' },
  ceiling: { th: 'แอร์แขวนใต้ฝ้า', nominal: 10, note: 'ลมพุ่งเกาะแนวฝ้า (Coanda) ไปได้ไกลแล้วค่อยตกลงช่วงกลาง–ปลายห้อง เหมาะห้องยาว · ห้ามมีคานหรือของขวางแนวลมใต้ฝ้า' },
  floor: { th: 'แอร์ตู้ตั้งพื้น', nominal: 8, note: 'ตั้งพื้นชิดผนัง ลมออกช่องบนพุ่งตรงไปข้างหน้าได้ไกล เหมาะโถง ห้องประชุม ร้านขนาดใหญ่ · หน้าเครื่องต้องโล่ง ไม่วางของบังช่องลมกลับด้านล่าง' },
  cassette: { th: 'แอร์สี่ทิศทาง', nominal: 4.2, note: 'เครื่องอยู่กลางฝ้า ลมออก 4 ทิศ ครอบคลุมรัศมีราว 3–5 ม. รอบเครื่อง ห้องยาวมากใช้หลายเครื่องเรียงเป็นตาราง' },
};

export function createThrowSim(container, opts = {}) {
  const o = { theme: 'light', ...opts };
  const dark = o.theme === 'dark', bp = o.theme === 'blueprint';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = dark ? 0.95 : 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = dark ? 0.35 : 0.6;
  glTrack(renderer, container, { scene, name: 'ระยะลม' });   // B1: context budget (gl-pool)
  scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x1a2230 : 0x9aa1ab, dark ? 0.5 : 0.8));
  const sun = new THREE.DirectionalLight(0xffe6c4, dark ? 1.1 : 2.2); sun.position.set(2, 7, -8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005;
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6, near: 1, far: 30 }); sun.target.position.set(6, 0, 0); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xdfe9ff, dark ? 0.35 : 0.6); fill.position.set(8, 5, 9); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(40, 2, 0.05, 80);
  const K = mats(dark ? 'dark' : 'light'), M = materialSet(dark ? 'showroom' : 'studio');

  /* ---------- room shell ---------- */
  const room = new THREE.Group(); scene.add(room);
  const add = (m, x, y, z) => { m.position.set(x, y, z); room.add(m); return m; };
  const box = (w, hh, d, mat, x, y, z, cast = false) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat); m.receiveShadow = true; m.castShadow = cast; return add(m, x, y, z); };
  K.floorT.repeat.set(L / 3.2, D / 3.2);
  box(L, 0.08, D, K.floor, L / 2, -0.04, 0);
  // back wall with a window opening (x 3.1–5.3, y 0.85–2.15)
  const wx0 = 3.1, wx1 = 5.3, wy0 = 0.85, wy1 = 2.15, wz = -D / 2 - 0.06;
  box(wx0, H, 0.12, K.wall, wx0 / 2, H / 2, wz); box(L - wx1, H, 0.12, K.wall, (wx1 + L) / 2, H / 2, wz);
  box(wx1 - wx0, wy0, 0.12, K.wall, (wx0 + wx1) / 2, wy0 / 2, wz); box(wx1 - wx0, H - wy1, 0.12, K.wall, (wx0 + wx1) / 2, (wy1 + H) / 2, wz);
  const win = windowUnit(K, wx1 - wx0, wy1 - wy0); win.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, -D / 2 - 0.02); room.add(win);
  [wx0 - 0.35, wx1 + 0.35].forEach(x => { const c = F.curtain(K, 0.55, 2.35); c.position.set(x, 0.2, -D / 2 + 0.12); room.add(c); });
  box(0.12, H, D, K.wall, -0.06, H / 2, 0); box(0.12, H, D, K.wall, L + 0.06, H / 2, 0);
  box(L, 0.1, 0.018, K.base, L / 2, 0.05, -D / 2 + 0.01); box(0.018, 0.1, D, K.base, 0.01, 0.05, 0); box(0.018, 0.1, D, K.base, L - 0.01, 0.05, 0);
  // ceiling (seen from below) + cut edge along the front
  const ceilM = new THREE.MeshStandardMaterial({ color: dark ? 0x8fa3b8 : 0xc9d3dd, transparent: true, opacity: dark ? 0.1 : 0.14, depthWrite: false, side: THREE.DoubleSide, roughness: 1 });
  const ceil = box(L, 0.02, D, ceilM, L / 2, H + 0.01, 0); ceil.castShadow = false; ceil.receiveShadow = false;
  const ceilEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, 0.02, D)), new THREE.LineBasicMaterial({ color: dark ? 0x7d8b9a : 0x9aa6b3, transparent: true, opacity: 0.7 })); add(ceilEdge, L / 2, H + 0.01, 0);
  const cut = new THREE.MeshStandardMaterial({ color: dark ? 0x59626e : 0x9aa3ad, roughness: 0.9 });
  box(0.02, H + 0.1, 0.02, cut, -0.12, H / 2, D / 2 + 0.01); box(0.02, H + 0.1, 0.02, cut, L + 0.12, H / 2, D / 2 + 0.01);
  // floor distance scale (0–12 m) along the front edge
  const scaleT = ctex(2048, 128, (g, w, hh) => {
    g.clearRect(0, 0, w, hh); g.fillStyle = dark ? 'rgba(10,14,20,.55)' : 'rgba(255,255,255,.72)'; g.fillRect(0, 22, w, 84);
    g.strokeStyle = dark ? '#cfd8e3' : '#26313d'; g.fillStyle = g.strokeStyle; g.lineWidth = 3; g.font = '700 46px system-ui, sans-serif'; g.textAlign = 'center';
    for (let m = 0; m <= L; m++) { const x = 8 + (w - 16) * m / L; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, m % 2 ? 44 : 56); g.stroke(); if (m) g.fillText(m + (m === L ? ' ม.' : ''), clamp(x, 40, w - 60), 96); }
    g.lineWidth = 1.5; for (let m = 0; m < L; m++) for (let k = 1; k < 10; k++) { const x = 8 + (w - 16) * (m + k / 10) / L; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, 32); g.stroke(); }
  });
  const scaleM = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.34), new THREE.MeshBasicMaterial({ map: scaleT, transparent: true, depthWrite: false })); scaleM.rotation.x = -Math.PI / 2 + 0.75; add(scaleM, L / 2, 0.12, D / 2 - 0.12); scaleM.renderOrder = 3;
  // occupied-zone temperature on the floor
  const GXd = 120, GZd = 46, fData = new Uint8Array(GXd * GZd * 4), fTex = new THREE.DataTexture(fData, GXd, GZd); fTex.colorSpace = THREE.SRGBColorSpace; fTex.magFilter = fTex.minFilter = THREE.LinearFilter;
  const heat = new THREE.Mesh(new THREE.PlaneGeometry(L, D), new THREE.MeshBasicMaterial({ map: fTex, transparent: true, opacity: dark ? 0.5 : 0.42, depthWrite: false })); heat.rotation.x = -Math.PI / 2; add(heat, L / 2, 0.01, 0); heat.renderOrder = 2;

  /* ---------- furniture + obstacles ---------- */
  const obst = [];
  const put = (g, x, z, ry = 0, ob = null) => { g.position.set(x, 0, z); g.rotation.y = ry; g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); room.add(g); if (ob) obst.push({ minX: x - ob[0] / 2, maxX: x + ob[0] / 2, minY: 0, maxY: ob[1], minZ: z - ob[2] / 2, maxZ: z + ob[2] / 2 }); return g; };
  put(F.rug(K, 3.0, 2.2), 3.1, -0.75);
  put(F.sofa(K, 2.2), 3.0, -1.72, 0, [2.2, 0.62, 0.92]);
  put(F.coffee(K), 3.0, -0.45, 0, [1.1, 0.46, 0.6]);
  put(F.lamp(K), 1.35, -1.85);
  put(F.plant(K, 1.1), 5.75, -1.85); put(F.plant(K, 0.9), 11.45, 1.6);
  put(F.dining(K), 7.8, -0.8, 0, [1.5, 0.76, 0.85]);
  put(F.shelf(K, 1.2, 1.9), 10.6, -2.05, 0, [1.2, 1.9, 0.34]);
  put(F.tv(K, 1.4), 0.32, -0.55, Math.PI / 2, null);
  const art = F.art(K, 30); art.position.set(8.0, 1.75, -D / 2 + 0.02); room.add(art);
  const art2 = F.art(K, 200); art2.position.set(10.6, 2.35, -D / 2 + 0.02); art2.scale.setScalar(0.55); room.add(art2);

  /* ---------- people ---------- */
  const crowd = createCrowd(room, { max: 8 });
  const PEOPLE = [
    { x: 2.6, z: -1.6, ry: 0, pose: 'sit' }, { x: 3.45, z: -1.6, ry: 0, pose: 'sit' },
    { x: 7.42, z: -1.42, ry: 0, pose: 'sit', desk: true }, { x: 8.18, z: -0.18, ry: Math.PI, pose: 'sit', desk: true },
    { x: 5.2, z: 1.1, pose: 'walk', path: [4.6, 1.15, 10.4, 1.15] }, { x: 11.1, z: -0.9, ry: -Math.PI / 2, pose: 'stand' },
  ];
  crowd.set(PEOPLE);
  const chips = h('div', { class: 'tsim-chips', 'aria-hidden': 'true' }); container.append(chips);
  const chipEls = PEOPLE.map(() => { const e = h('span', { class: 'tsim-chip' }); chips.append(e); return e; });

  /* ---------- units ---------- */
  const air = createAirflow(room, { count: 1700, dark, width: 0.024, trail: 0.2 });
  air.setRoom({ w: L, d: D, h: H, x0: L / 2, z0: 0 }); air.obstacles(obst);
  let type = 'wall', U = null, unitG = null;
  // Rev.09 r4: the remote / room controller drives these (power, mode, set temperature, fan, flap position, left–right swing, dirty unit)
  const C = { power: true, mode: 'cool', temp: 25, fan: 'auto', louver: null, hswing: true, dirty: false };
  const FAN = { auto: 1, 1: 0.72, 2: 1, 3: 1.22, turbo: 1.4 };
  const UA = { wall: V(0.3, 2.06, 0.2), ceiling: V(0.8, H - 0.26, 0.2), cassette: V(6, H - 0.08, 0.55), floor: V(0.48, 1.42, 1.35) };   // where the unit display chip sits
  const roomT = 30;
  // r8: each unit type is built once and kept (switching back is instant, nothing leaks); the air settles with prewarm()
  // (physics only, one geometry write) instead of 310 full update+draw passes
  const units = {};
  function build(t) {
    Object.values(units).forEach(u => { u.g.visible = false; });
    if (units[t]) { unitG = units[t].g; U = units[t].U; unitG.visible = true; air.setEmitters(units[t].E); type = t; setParams(); reach = 0; air.prewarm(280, 0.05); return; }
    unitG = new THREE.Group(); room.add(unitG);
    let E = [];
    if (t === 'wall') {
      U = buildWallUnit(M); U.parts.pipes && (U.parts.pipes.visible = false); U.parts.drain && (U.parts.drain.visible = false);
      U.root.position.set(0.14, 2.32, 0.2); U.root.rotation.y = Math.PI / 2; unitG.add(U.root);
      E = [{ o: V(0.3, 2.19, 0.2), f: V(1, 0, 0), r: V(0, 0, 1), width: 0.72, kind: 'wall', v0: 3.6, intake: V(0.16, 2.5, 0.2) }];
    } else if (t === 'ceiling') {
      U = buildCeilingUnit(M, { interior: false, rod: 0.02 }); U.root.position.set(0.4, H - 0.14, 0.2); U.root.rotation.y = Math.PI / 2; unitG.add(U.root);
      E = [{ o: V(0.78, H - 0.2, 0.2), f: V(1, 0, 0), r: V(0, 0, 1), width: 1.1, kind: 'ceiling', v0: 4.8, intake: V(0.3, H - 0.3, 0.2) }];
    } else if (t === 'floor') {
      U = buildFloorUnit(M, {}); U.root.position.set(0.24, 0, 1.35); U.root.rotation.y = Math.PI / 2; unitG.add(U.root);
      E = [{ o: V(0.46, 1.5, 1.35), f: V(1, 0, 0), r: V(0, 0, 1), width: 0.42, kind: 'floor', v0: 4.2, intake: V(0.46, 0.45, 1.35) }];
    } else {
      U = buildCassetteUnit(M, { interior: false, rod: 0.25 });
      U.root.position.set(6, H - 0.002, 0); unitG.add(U.root);
      E = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b], k) => ({ o: V(6 + a * 0.4, H - 0.06, b * 0.4), f: V(a, 0, b), r: V(b, 0, -a), width: 0.62, kind: 'cassette', v0: 3.1, phase: k, intake: V(6, H - 0.12, 0) }));
    }
    U.root.traverse(m => { if (m.isMesh) m.castShadow = true; });
    units[t] = { g: unitG, U, E };
    air.setEmitters(E); type = t; setParams(); reach = 0;
    // start from a settled room: run the airflow ~14 s before the first frame
    air.prewarm(280, 0.05);
  }
  function setParams() {
    // ambient: the rest of the room is mixed and cooled a little, more near the unit (illustrative), less when the unit is dirty / on low fan /
    // set warmer; nothing when the unit is off or on fan only. Supply air: colder at a lower set temperature (illustrative, not a rating)
    const ux = type === 'cassette' ? 6 : 0, uz = type === 'floor' ? 1.35 : 0, fanF = FAN[C.fan] * (C.mode === 'dry' ? 0.72 : 1);
    const cool = !C.power || C.mode === 'fan' ? 0 : C.mode === 'dry' ? 0.45 : clamp((roomT - C.temp + 2) / 7, 0.3, 1.3);
    const reachN = TYPE_INFO[type].nominal * (C.dirty ? 0.65 : 1) * (0.55 + 0.45 * fanF), drop = (C.dirty ? 2.2 : 4.2) * (0.8 + 0.2 * fanF) * cool;
    const ambient = (x, z) => roomT - drop * Math.exp(-Math.hypot(x - ux, type === 'cassette' ? z : (z - uz) * 0.4) / (reachN * 0.85));
    const supplyT = (C.mode === 'fan' ? roomT - 0.6 : C.mode === 'dry' ? 15.5 : 11.5 + (C.temp - 16) * 0.22) + (C.dirty ? 2 : 0);
    air.set({ running: C.power, airF: C.dirty ? 0.58 : 1, fan: fanF, swing: C.louver == null, louver: C.louver, hswing: C.hswing && type !== 'cassette', supplyT, roomT, dark, ambient });
    o.onSupply && o.onSupply(C.power && C.mode !== 'fan' ? supplyT : null);
  }

  /* ---------- camera ---------- */
  const st = { th: 0.1, ph: 1.36, r: 9.6, t: V(6, 1.0, -0.3), user: 0 };
  const el = renderer.domElement; el.style.touchAction = 'pan-y'; let drag = null;
  el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, th: st.th, ph: st.ph, id: e.pointerId }; });
  addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; st.th = clamp(drag.th - (e.clientX - drag.x) * 0.004, -0.75, 0.75); if (e.pointerType !== 'touch') st.ph = clamp(drag.ph - (e.clientY - drag.y) * 0.003, 1.0, 1.45); st.user = performance.now(); });
  addEventListener('pointerup', () => drag = null); addEventListener('pointercancel', () => drag = null);
  const resize = () => { const w = container.clientWidth || 1, hh = container.clientHeight || 1; renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.fov = w / hh < 1.2 ? 58 : 40; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(container); resize();
  let vis = false; new IntersectionObserver(es => vis = es[0].isIntersecting).observe(container);

  /* ---------- loop ---------- */
  const tmp = [0, 0, 0], pv = V(0, 0, 0);
  let clock = 0, last = performance.now(), reach = 0, acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now; if (!vis || document.hidden) return;
    const rm = RM(), ddt = rm ? 0.016 : dt; clock += ddt;
    if (!rm && now - st.user > 5000) st.th += (Math.sin(clock * 0.05) * 0.16 + 0.08 - st.th) * 0.01;
    const R = st.r * Math.max(1, 1.9 / camera.aspect), sp = Math.sin(st.ph);
    camera.position.set(st.t.x + R * sp * Math.sin(st.th), st.t.y + R * Math.cos(st.ph), st.t.z + R * sp * Math.cos(st.th)); camera.lookAt(st.t);
    if (U && C.power) { animateUnit(U, rm ? 0 : dt, clock, FAN[C.fan] * (C.dirty ? 0.7 : 1)); if (C.louver != null && U.anim) U.anim.flaps.forEach(f => { f.obj.rotation[f.axis] = f.base + (C.louver - 0.5) * 2 * f.amp; }); }
    // heat sources: heads + window + TV
    const hs = crowd.heads().map(p => ({ x: p.x, y: p.y - 0.1, z: p.z, r: 0.12, k: 0.55 }));
    hs.push({ x: 4.2, y: 0.9, z: -D / 2 + 0.2, r: 0.9, k: 0.9 }, { x: 0.45, y: 1.0, z: -0.55, r: 0.35, k: 0.5 });
    air.setSources(hs);
    air.update(rm ? 0.016 : dt, clock);
    crowd.update(rm ? 0 : dt, clock, (x, z) => air.tempAt(x, z));
    // floor map + reach, a few times per second
    acc += (now - (frame.prev || now)) / 1000; frame.prev = now; if (acc > 0.15) { acc = 0; paintFloor(); }
    renderer.render(scene, camera);
    // the unit's own display (set temperature / mode) next to the unit
    { const W0 = container.clientWidth, H0 = container.clientHeight; pv.copy(UA[type]); room.localToWorld(pv); pv.project(camera); const ok = pv.z < 1 && Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.05; disp.style.visibility = ok ? 'visible' : 'hidden'; if (ok) disp.style.transform = `translate(${Math.min(W0 - 70, Math.max(70, (pv.x + 1) / 2 * W0)).toFixed(1)}px,${Math.max(20, (1 - pv.y) / 2 * H0 - 26).toFixed(1)}px) translate(-50%,-50%)`; }
    // person chips
    const W = container.clientWidth, HH = container.clientHeight, P = crowd.people(), heads = crowd.heads();
    const placed = [];
    P.map((p, i) => { if (!heads[i]) return null; pv.copy(heads[i]).add(V(0, 0.3, 0)); room.localToWorld(pv); pv.project(camera); return { p, i, x: (pv.x + 1) / 2 * W, y: (1 - pv.y) / 2 * HH, ok: pv.z < 1 && Math.abs(pv.x) < 1 && Math.abs(pv.y) < 1 }; }).filter(Boolean).sort((a, b) => b.y - a.y)
      .forEach(q => { const e = chipEls[q.i]; e.style.display = q.ok ? '' : 'none'; if (!q.ok) return; let y = q.y; for (let k = 0; k < 6; k++) { const hit = placed.find(r => Math.abs(r.x - q.x) < 86 && Math.abs(r.y - y) < 24); if (!hit) break; y = hit.y - 25; } placed.push({ x: q.x, y }); const t = q.p.temp ?? roomT; const c = t >= 28.6 ? ['ร้อน ', 'hot'] : t >= 27.5 ? ['อุ่น ', 'warm'] : t <= 22.5 ? ['เย็นไป ', 'cold'] : ['สบาย ', 'ok']; e.textContent = c[0] + t.toFixed(1) + '°'; e.className = 'tsim-chip ' + c[1]; e.style.transform = `translate(${q.x.toFixed(1)}px,${y.toFixed(1)}px)`; });
  }
  function paintFloor() {
    const G = air.grid(); let far = 0;
    const ux = type === 'cassette' ? 6 : 0;
    for (let j = 0; j < GZd; j++) for (let i = 0; i < GXd; i++) {
      const gx = Math.floor(i / GXd * G.GX), gz = Math.floor(j / GZd * G.GZ); const t = G.T[gz * G.GX + gx];
      tempColor(t, tmp); const k = ((GZd - 1 - j) * GXd + i) * 4; fData[k] = tmp[0] * 255; fData[k + 1] = tmp[1] * 255; fData[k + 2] = tmp[2] * 255; fData[k + 3] = 255;
    }
    for (let gz = 0; gz < G.GZ; gz++) for (let gx = 0; gx < G.GX; gx++) { if (G.T[gz * G.GX + gx] < roomT - 2.2) { const x = (gx + 0.5) / G.GX * L; far = Math.max(far, Math.abs(x - ux)); } }
    fTex.needsUpdate = true; reach = reach < 0.01 ? far : reach + (far - reach) * 0.25; o.onReach && o.onReach(reach, type);
    if (o.onStats) { let sum = 0, n = 0; for (let gz = 0; gz < G.GZ; gz++) for (let gx = 0; gx < G.GX; gx++) { sum += G.T[gz * G.GX + gx]; n++; } const P = crowd.people(); o.onStats({ reach, avg: sum / Math.max(1, n), comfy: P.filter(p => p.temp != null && p.temp < 27.5 && p.temp > 22.5).length, n: P.length }); }
  }
  // unit display chip (what the remote just set)
  const disp = h('div', { class: 'tsim-disp', 'aria-hidden': 'true' }); container.append(disp);
  const MODE_TH = { cool: 'เย็น', dry: 'แห้ง', fan: 'พัดลม', auto: 'อัตโน' };
  function paintDisp(ping) { disp.className = 'tsim-disp' + (C.power ? '' : ' off'); disp.textContent = C.power ? `${MODE_TH[C.mode]} ${C.mode === 'fan' ? '' : C.temp + '°'}`.trim() : 'ปิด'; if (ping && !RM()) { disp.classList.remove('tsim-ping'); void disp.offsetWidth; disp.classList.add('tsim-ping'); } }
  paintDisp(false);
  requestAnimationFrame(frame);
  build('wall');
  // r15: compile the other unit types' shaders once the visitor pauses (a sample of each, geometry freed again — the materials
  // and so the programs stay), so switching type never waits for the GPU
  const preDone = new Set();
  function preload() {
    const t = ['ceiling', 'cassette', 'floor'].find(k => !units[k] && !preDone.has(k)); if (!t) return;
    whenCalm(() => {
      preDone.add(t); if (units[t]) return preload();
      const S2 = t === 'ceiling' ? buildCeilingUnit(M, { interior: false, rod: 0.02 }) : t === 'cassette' ? buildCassetteUnit(M, { interior: false, rod: 0.25 }) : buildFloorUnit(M, {});
      S2.root.traverse(m => { if (m.isMesh) m.castShadow = true; }); warm(renderer, scene, camera, S2.root); freeGeometry(S2.root); preload();
    }, 1500);
  }
  setTimeout(preload, 3000);
  return {
    setType(t) { if (t !== type) build(t); },
    setControl(c) { Object.assign(C, c); setParams(); paintDisp(true); },
    get type() { return type; },
  };
}

/**
 * UI wrapper used inside the "how it works" section — Rev.09 r4 (owner: "ลมเย็นไปทิศทางไหน ทำเป็น 3 แบบ มีลูกเล่นสวยงามขึ้น และเลือกได้
 * เหมือนสั่งการผ่านรีโมตคอนโทรลหรือรูมคอนโทรลแบบดิจิทัล"): one simulated controller per prototype —
 *   style 'remote' (A): handheld remote with an LCD · 'panel' (B): wall-mounted room controller with engineering read-outs ·
 *   'glass' (C): glass touch panel with a temperature dial.
 * The controller sets power, mode, set temperature, fan speed, flap position / up–down swing and left–right swing; the unit type
 * (4 types) and the "not cleaned for 12 months" condition sit beside it. Everything readable stays without WebGL.
 */
const ICON = {
  cool: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/></svg>',
  dry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z"/></svg>',
  fan: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1.8"/><path d="M12 10c-1-4 1-7 3.5-7 2 0 2.5 2.5.5 4.2L13.8 9M14 12.2c4-1 7 1 7 3.5 0 2-2.5 2.5-4.2.5L15 14M10.2 13.6c-2.8 3-6.4 3-7.6.8-1-1.7 1-3.4 3.4-2.6l2.6.9"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 16.5l3.5-9 3.5 9M9.8 13.4h4.4"/></svg>',
  power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8M6.6 6.6a8 8 0 1 0 10.8 0"/></svg>',
  vswing: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M4 12h14M4 18h10M19 4v4M17 6l2-2 2 2M19 20v-4M17 18l2 2 2-2"/></svg>',
  hswing: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v10M12 5v14M18 5v10M4 21h4M6 19l-2 2 2 2M20 21h-4M18 19l2 2-2 2"/></svg>',
};
const MODES = [['cool', 'เย็น'], ['dry', 'ลดความชื้น'], ['fan', 'พัดลม'], ['auto', 'อัตโนมัติ']];
const FANS = [['auto', 'อัตโนมัติ'], ['1', 'เบา'], ['2', 'กลาง'], ['3', 'แรง'], ['turbo', 'เทอร์โบ']];
const LOUV = [null, 0, 0.25, 0.5, 0.75, 1];   // null = swing up–down, then flap positions 1 (highest) … 5 (lowest)
const UNIT_TYPES = [['wall', 'ติดผนัง'], ['ceiling', 'แขวนใต้ฝ้า'], ['cassette', 'สี่ทิศทาง'], ['floor', 'ตู้ตั้งพื้น']];
const icon = k => { const s = h('span', { class: 'tk-i' }); s.innerHTML = ICON[k]; return s; };

export function mountThrowSim(root, cfg = {}) {
  const style = ['remote', 'panel', 'glass'].includes(cfg.style) ? cfg.style : 'remote';
  root.classList.add('tsim', 'tsim--' + style);
  const S = { type: TYPE_INFO[cfg.type] ? cfg.type : 'wall', power: true, mode: 'cool', temp: 25, fan: 'auto', lv: 0, hswing: true, dirty: false };
  const stats = { reach: null, avg: null, comfy: null, n: 6, supply: null };
  const stage = h('div', { class: 'tsim-stage' });
  const read = h('div', { class: 'tsim-read', 'aria-live': 'polite' });
  const note = h('p', { class: 'tsim-note' });
  const legend = h('div', { class: 'tsim-legend', 'aria-hidden': 'true' }, h('span', {}, '13°'), h('i'), h('span', {}, '34°C'));
  const fb = h('div', { class: 'tsim-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้');
  stage.append(legend, fb);
  let sim = null;
  const push = () => sim && sim.setControl({ power: S.power, mode: S.mode, temp: S.temp, fan: S.fan, louver: LOUV[S.lv], hswing: S.hswing, dirty: S.dirty });

  /* ---- the controller ---- */
  const dev = h('div', { class: 'tctl tctl--' + style, role: 'group', 'aria-label': { remote: 'รีโมตจำลอง', panel: 'แผงควบคุมห้องจำลอง', glass: 'แผงสัมผัสจำลอง' }[style] });
  const sr = h('p', { class: 'tctl-sr', 'aria-live': 'polite' });
  const led = h('i', { class: 'tctl-led', 'aria-hidden': 'true' });
  const blink = () => { if (RM()) return; led.classList.remove('on'); void led.offsetWidth; led.classList.add('on'); dev.classList.remove('tap'); void dev.offsetWidth; dev.classList.add('tap'); };
  const act = fn => () => { fn(); blink(); paint(); push(); };
  const key = (cls, label, aria, fn, ic) => h('button', { type: 'button', class: 'tk ' + cls, 'aria-label': aria, onclick: act(fn) }, ic ? icon(ic) : null, label ? h('span', {}, label) : null);
  const kPow = key('tk-pow', style === 'glass' ? null : 'เปิด/ปิด', 'เปิดหรือปิดเครื่อง', () => { S.power = !S.power; }, 'power');
  const kMode = key('tk-mode', 'โหมด', 'เปลี่ยนโหมด', () => { const i = MODES.findIndex(m => m[0] === S.mode); S.mode = MODES[(i + 1) % MODES.length][0]; S.power = true; });
  const kDn = key('tk-dn', '−', 'ลดอุณหภูมิที่ตั้ง', () => { S.temp = Math.max(16, S.temp - 1); S.power = true; });
  const kUp = key('tk-up', '+', 'เพิ่มอุณหภูมิที่ตั้ง', () => { S.temp = Math.min(30, S.temp + 1); S.power = true; });
  const kFan = key('tk-fan', 'ความแรงลม', 'เปลี่ยนความแรงลม', () => { const i = FANS.findIndex(f => f[0] === S.fan); S.fan = FANS[(i + 1) % FANS.length][0]; S.power = true; }, 'fan');
  const kV = key('tk-v', 'สวิงขึ้นลง', 'บานสวิงขึ้นลง: สวิง หรือตำแหน่ง 1 ถึง 5', () => { S.lv = (S.lv + 1) % LOUV.length; S.power = true; }, 'vswing');
  const kH = key('tk-h', 'สวิงซ้ายขวา', 'เปิดหรือปิดสวิงซ้ายขวา', () => { S.hswing = !S.hswing; S.power = true; }, 'hswing');
  // display
  const lcd = h('div', { class: 'tctl-lcd', 'aria-hidden': 'true' });
  const dMode = h('span', { class: 'd-mode' }), dTemp = h('b', { class: 'd-temp' }), dUnit = h('small', { class: 'd-unit' }, '°C'), dFan = h('span', { class: 'd-fan' }), dV = h('span', { class: 'd-v' }), dH = h('span', { class: 'd-h' });
  const dRead = h('dl', { class: 'd-read' });
  // glass: dial
  let arc = null, knob = null, glow = null;
  if (style === 'glass') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('class', 'tctl-dial'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path class="dial-bg" d="M43.4 156.6A80 80 0 1 1 156.6 156.6"/><path class="dial-glow" d="M43.4 156.6A80 80 0 1 1 156.6 156.6"/><path class="dial-arc" d="M43.4 156.6A80 80 0 1 1 156.6 156.6"/><circle class="dial-knob" r="7"/>';
    arc = svg.querySelector('.dial-arc'); glow = svg.querySelector('.dial-glow'); knob = svg.querySelector('.dial-knob');
    lcd.append(svg, h('div', { class: 'd-mid' }, dMode, h('div', { class: 'd-tw' }, dTemp, dUnit), h('div', { class: 'd-row' }, dFan, dV, dH)));
  } else lcd.append(h('div', { class: 'd-top' }, dMode, dFan), h('div', { class: 'd-tw' }, dTemp, dUnit), h('div', { class: 'd-row' }, dV, dH));
  if (style !== 'remote') lcd.append(dRead);
  const modeChips = style === 'glass' ? h('div', { class: 'tctl-modes', role: 'group', 'aria-label': 'โหมด' }, MODES.map(([k, th]) => h('button', { type: 'button', class: 'tk tk-chip', 'data-k': k, 'aria-label': 'โหมด' + th, onclick: act(() => { S.mode = k; S.power = true; }) }, icon(k), h('span', {}, th)))) : null;
  const fanDots = style === 'glass' ? h('div', { class: 'tctl-fans', role: 'group', 'aria-label': 'ความแรงลม' }, FANS.map(([k, th]) => h('button', { type: 'button', class: 'tk tk-dot', 'data-k': k, 'aria-label': 'ลม' + th, onclick: act(() => { S.fan = k; S.power = true; }) }, h('span', {}, k === 'auto' ? 'A' : k === 'turbo' ? 'T' : k)))) : null;
  const mark = h('span', { class: 'tctl-mark', 'aria-hidden': 'true' }, style === 'panel' ? 'SBP AirCare' : 'FUJIVA');
  if (style === 'remote') dev.append(led, lcd, h('div', { class: 'tctl-keys' }, kPow, kMode, kFan, h('div', { class: 'tk-rock' }, kDn, kUp), kV, kH), mark, sr);
  else if (style === 'panel') dev.append(h('div', { class: 'tctl-head' }, h('span', {}, 'ROOM CONTROLLER'), led), lcd, h('div', { class: 'tctl-keys' }, kPow, kMode, kFan, kDn, kUp, kV, kH), mark, sr);
  else dev.append(led, lcd, h('div', { class: 'tctl-tr' }, kDn, kPow, kUp), modeChips, fanDots, h('div', { class: 'tctl-keys' }, kV, kH), mark, sr);
  // unit type + unit condition (beside the controller)
  const seg = (items, cur, fn, label) => h('div', { class: 'tsim-seg', role: 'group', 'aria-label': label }, items.map(([k, th]) => h('button', { type: 'button', 'data-k': k, 'aria-pressed': String(k === cur), onclick: e => { [...e.currentTarget.parentNode.children].forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); fn(k); } }, th)));
  const typeSeg = seg(UNIT_TYPES, S.type, k => { setType(k); cfg.onType && cfg.onType(k); }, 'ประเภทแอร์ในห้องจำลอง');
  const set = h('div', { class: 'tsim-set' }, h('span', { class: 'tsim-lab' }, 'เครื่องในห้อง'), typeSeg,
    seg([['0', 'เครื่องสะอาด'], ['1', 'ไม่ได้ล้าง 12 เดือน']], '0', k => { S.dirty = k === '1'; paint(); push(); }, 'สภาพเครื่อง'));
  const cap = h('p', { class: 'tctl-cap' }, { remote: 'รีโมตจำลอง · กดปุ่มแล้วดูลมในห้องเปลี่ยน', panel: 'แผงควบคุมห้องจำลอง (Room controller) · ค่าที่แสดงเป็นค่าจำลอง', glass: 'แผงสัมผัสจำลอง · แตะเพื่อสั่งงาน' }[style]);
  root.append(set, h('div', { class: 'tsim-wrap' }, stage, h('div', { class: 'tctl-col' }, dev, cap)), read, note);

  const MODE_TH = Object.fromEntries(MODES), FAN_TH = Object.fromEntries(FANS);
  const tc = t => { const k = clamp((t - 16) / 14, 0, 1), A = [47, 140, 255], B = [63, 208, 232], Cc = [255, 176, 74], [p, q, f] = k < 0.57 ? [A, B, k / 0.57] : [B, Cc, (k - 0.57) / 0.43]; return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * f)).join(',')})`; };   // dial colour: blue (16°) → cyan (24°) → amber (30°)
  function paint() {
    const fanOnly = S.mode === 'fan';
    dev.classList.toggle('off', !S.power); dev.dataset.mode = S.mode;
    dMode.innerHTML = ''; dMode.append(icon(S.mode), h('span', {}, S.power ? MODE_TH[S.mode] : 'ปิดเครื่อง'));
    dTemp.textContent = !S.power ? '--' : fanOnly ? '--' : String(S.temp);
    dFan.textContent = ''; const lvN = { auto: 0, 1: 1, 2: 2, 3: 3, turbo: 4 }[S.fan]; dFan.append(h('span', { class: 'bars', 'data-n': lvN }, [1, 2, 3, 4].map(i => h('i', { class: i <= lvN ? 'on' : '' }))), h('span', {}, FAN_TH[S.fan]));
    dV.textContent = LOUV[S.lv] == null ? 'สวิงขึ้นลง' : `บานตำแหน่ง ${S.lv}`; dH.textContent = S.type === 'cassette' ? 'ลมออก 4 ทิศ' : S.hswing ? 'สวิงซ้ายขวา' : 'ซ้ายขวาคงที่';
    kH.disabled = S.type === 'cassette';
    if (arc) { const k = (S.temp - 16) / 14, L0 = 377; arc.style.strokeDasharray = `${(k * L0).toFixed(1)} 999`; arc.style.stroke = S.power && !fanOnly ? tc(S.temp) : 'rgba(255,255,255,.18)'; glow.style.strokeDasharray = arc.style.strokeDasharray; glow.style.stroke = arc.style.stroke; const a = (225 - k * 270) * Math.PI / 180; knob.setAttribute('cx', (100 + 80 * Math.cos(a)).toFixed(1)); knob.setAttribute('cy', (100 - 80 * Math.sin(a)).toFixed(1)); knob.style.fill = arc.style.stroke; dev.style.setProperty('--tc', S.power && !fanOnly ? tc(S.temp) : '#5b6878'); }
    if (modeChips) [...modeChips.children].forEach(b => b.setAttribute('aria-pressed', String(S.power && b.dataset.k === S.mode)));
    if (fanDots) [...fanDots.children].forEach(b => b.setAttribute('aria-pressed', String(S.power && b.dataset.k === S.fan)));
    if (style !== 'remote') { dRead.innerHTML = ''; [['ห้องเฉลี่ย', stats.avg == null ? '…' : stats.avg.toFixed(1) + '°'], ['ลมจ่าย', !S.power || stats.supply == null ? '—' : stats.supply.toFixed(1) + '°'], ['ระยะลมเย็น', stats.reach == null ? '…' : (Math.round(stats.reach * 2) / 2).toFixed(1) + ' ม.'], ['คนรู้สึกสบาย', stats.comfy == null ? '…' : `${stats.comfy}/${stats.n}`]].forEach(([a, b]) => dRead.append(h('dt', {}, a), h('dd', {}, b))); }
    sr.textContent = S.power ? `เปิดเครื่อง · โหมด${MODE_TH[S.mode]}${fanOnly ? '' : ` · ตั้ง ${S.temp} องศา`} · ลม${FAN_TH[S.fan]} · ${dV.textContent}${S.type === 'cassette' ? '' : ' · ' + dH.textContent}` : 'ปิดเครื่อง';
    note.textContent = TYPE_INFO[S.type].note + (S.power ? '' : ' · ตอนนี้ปิดเครื่อง: ห้องค่อย ๆ อุ่นขึ้น คนเริ่มร้อน');
  }
  function setType(t) { if (!TYPE_INFO[t]) return; S.type = t; [...typeSeg.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === t))); lastR = -1; stats.reach = null; paint(); sim && sim.setType(t); push(); }
  paint();
  let lastR = -1, lastPaint = 0;
  const boot = () => {
    try {
      sim = createThrowSim(stage, {
        theme: cfg.theme,
        onReach: (r, t) => { const v = Math.round(r * 2) / 2; if (v === lastR) return; lastR = v; read.innerHTML = ''; read.append(S.power ? h('b', {}, `ลมเย็นระดับตัวคนไปถึงราว ${v.toFixed(1)} ม.${t === 'cassette' ? ' รอบเครื่อง' : ' จากเครื่อง'}`) : h('b', {}, 'ปิดเครื่องอยู่ — ลมเย็นที่เหลือค่อย ๆ หายไป'), h('span', {}, ` · ค่าทั่วไปของ${TYPE_INFO[t].th} ~${TYPE_INFO[t].nominal} ม.${S.dirty ? ' · เครื่องสกปรกลมสั้นลง' : ''} · ค่าจำลองเพื่ออธิบาย`)); },
        onStats: x => { Object.assign(stats, x); const now = performance.now(); if (style !== 'remote' && now - lastPaint > 600) { lastPaint = now; paint(); } },
        onSupply: v => { stats.supply = v; },
      });
      sim.setType(S.type); push();
    } catch (e) { console.warn('throw sim unavailable', e); fb.hidden = false; if (cfg.fallback) { stage.innerHTML = ''; stage.append(cfg.fallback()); } }
  };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); boot(); } }, { rootMargin: '300px 0px' }); io.observe(stage);
  return { setType };
}
