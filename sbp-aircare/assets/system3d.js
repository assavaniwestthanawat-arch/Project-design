// SBP AirCare — "ลำดับการทำงาน" in 3D (variant B, Rev.08): the whole air-conditioning system working inside a real
// home, one step at a time, for the three main types (wall / ceiling-suspended / 4-way cassette).
//   1 power on  → 2 room air drawn in through the filter → 3 cold liquid refrigerant evaporates in the coil
//   → 4 condensate to the pan and out of the blue drain → 5 the fan pushes the cooled air out → 6 cool air spreads
//   through the room (people stop fanning themselves) → 7 refrigerant vapour carries the heat to the compressor
//   → 8 the condensing unit throws the heat outside, liquid returns → 9 the whole loop together.
// Uses the same realistic home as the technician stories (install3d): pipes run inside closed Airpro trunking; for the
// refrigerant / drain steps the trunk lids and insulation turn see-through so the flow inside is visible.
import { icon, iconLabel } from './icons.js';
import * as THREE from './three.module.min.js';
import { createStage, buildHome, createLabels, createPathFlow, V, clamp, ease, RM, smoothPts } from './install3d.js';
import { createAirflow } from './airflow3d.js';
import { createCrowd } from './people3d.js';
import { animateUnit } from './units3d.js';
import { canvasTex } from './ac3d.js';
import { h } from './sbp-core.js';
import { warm, whenCalm } from './gl-pool.js';

const TYPE_TH = { wall: 'แอร์ติดผนัง', ceiling: 'แอร์แขวนใต้ฝ้า', cassette: 'แอร์สี่ทิศทาง' };
const COL = { liq: 0x1d56d8, gas: 0x7cc6ff, hot: 0xff5a36, hot2: 0xffa24d, power: 0xffd23f, drain: 0x2f8fff, warm: 0xff9a4d, cool: 0x39a7ff };

/* ---------------------------------------------------------------- per-type unit internals (unit frame) */
const WALL_PATHS = { // the premium wall unit shares the layout of the standard wall unit (ac3d buildIndoor)
  air: { yz: [[0.42, 0.02], [0.24, 0.02], [0.155, 0.04], [0.09, 0.062], [0.02, 0.05], [-0.035, 0.012], [-0.09, 0.03], [-0.13, 0.08], [-0.2, 0.2]], x: [-0.36, 0.28], coil: 3, out: 7 },
  drips: { x: [-0.38, 0.3], y: [-0.07, -0.09], z: 0.058 },
  pan: [[-0.36, -0.092, 0.07], [0.3, -0.094, 0.07], [0.37, -0.11, 0.04]],
  liquid: [[0.37, -0.02, -0.06], [0.34, 0.05, 0.02]], coil: [[0.33, 0.075, 0.075], [-0.4, 0.075, 0.075], [-0.41, 0.03, 0.06], [-0.4, -0.01, 0.04], [0.32, -0.015, 0.04]], gas: [[0.36, -0.06, -0.05]],
};
function unitPaths(type, U) {
  if (type === 'wall') return WALL_PATHS;
  const P = U.paths;
  if (type === 'ceiling') return { air: P.air, drips: P.drips, pan: P.drain.slice(0, 3), liquid: P.liquid.slice(1), coil: [[0.5, 0.02, 0.12], [-0.5, 0.02, 0.12], [-0.52, -0.02, 0.1], [0.5, -0.04, 0.1]], gas: P.gas.slice(0, 2) };
  return { radial: P.radial, drips: P.drips, pan: P.drain.slice(0, 5), liquid: P.liquid.slice(1), coil: [[0.319, 0.1, -0.2], [0.319, 0.1, 0.3], [-0.319, 0.12, 0.3], [-0.319, 0.14, -0.3], [0.297, 0.2, -0.3]], gas: P.gas.slice(0, 2) };
}
// condensing unit (outdoor frame): suction → compressor → discharge → condenser snake → liquid valve
function outdoorPaths() {
  const snake = []; const ys = [0.21, 0.155, 0.1, 0.045, -0.01, -0.065, -0.12, -0.175, -0.23];
  ys.forEach((y, j) => { const a = j % 2 ? -0.37 : 0.19, b = j % 2 ? 0.19 : -0.37; snake.push([a, y, -0.13], [b, y, -0.13]); });
  return {
    suction: [[0.445, -0.2, 0.06], [0.39, -0.2, 0.06], [0.37, -0.18, 0.02], [0.35, -0.12, 0.0]],
    hot: [[0.3, 0.02, -0.02], [0.3, 0.2, -0.04], [0.24, 0.23, -0.12], ...snake, [0.22, -0.23, -0.12], [0.36, -0.22, 0.06], [0.445, -0.2, 0.105]],
  };
}

/* ---------------------------------------------------------------- steps */
export function steps(type) {   // r16: exported — the film chapters read the captions without building the 3D view
  const T = TYPE_TH[type];
  const intake = { wall: 'ตะแกรงด้านบนของตัวเครื่อง', ceiling: 'ตะแกรงใต้ตัวเครื่องครึ่งหลัง', cassette: 'หน้ากากกลางใต้ฝ้า' }[type];
  const fan = { wall: 'พัดลมกรงกระรอก (Cross-flow) ยาวตลอดตัวเครื่อง', ceiling: 'โบลเวอร์ซีร็อกโคหลายตัวบนแกนเดียว ในเสื้อพัดลมก้นหอย', cassette: 'พัดลมเทอร์โบหมุนแนวนอน เหวี่ยงลมออกรอบตัว' }[type];
  const throw_ = { wall: 'บานสวิงกวาดขึ้น–ลง ครีบแนวตั้งกวาดซ้าย–ขวา ลมเย็นหนักกว่าลมอุ่นจึงค่อยๆ ลงสู่ระดับที่คนนั่ง', ceiling: 'ลมพุ่งเกาะแนวฝ้าไปได้ไกล (Coanda) ก่อนค่อยๆ ลงด้านไกลของห้อง เหมาะห้องยาว', cassette: 'ลมออกทั้ง 4 ด้านของหน้ากาก วิ่งแนบฝ้าออกไปรอบตัวแล้วลงสู่พื้นที่ใช้งาน ห้องเย็นทั่วจากกลางฝ้า' }[type];
  const water = type === 'cassette' ? 'น้ำจากคอยล์ลงถาด ปั๊มน้ำทิ้งในตัวเครื่องยกน้ำขึ้นไปที่ข้อต่อ ลูกลอยคอยตัดการทำงานถ้าน้ำในถาดสูงผิดปกติ จากนั้นไหลตามท่อ PVC สีฟ้าที่ลาดลงเหนือฝ้า ออกผนัง ลงรางไปถึงท่อระบายที่ระเบียง' : 'ผิวคอยล์เย็นกว่าจุดน้ำค้าง ไอน้ำในลมจึงกลั่นเป็นหยดน้ำ ไหลลงถาดใต้คอยล์ แล้วออกทางท่อ PVC สีฟ้าในราง ท่อต้องลาดลงตลอดแนวจนถึงท่อระบายที่ระเบียง';
  return [
    { k: 'power', t: 'เปิดเครื่อง: ไฟเข้าคอยล์เย็น แล้วส่งไปคอยล์ร้อน', d: 'กดรีโมต บอร์ดในคอยล์เย็นรับคำสั่ง ไฟจากเบรกเกอร์ RCBO ที่แยกวงจรไว้วิ่งขึ้นรางสายไฟเข้าคอยล์เย็น แล้วส่งไฟและสัญญาณไปคอยล์ร้อนผ่านสาย THW ในรางเดียวกับท่อน้ำยา บานสวิงเปิด พัดลมเริ่มหมุน', cam: 'overview', flows: ['power'], lab: [['เบรกเกอร์ RCBO แยกวงจร', 'rcbo'], ['คอยล์เย็นรับคำสั่ง', 'unit'], ['สายไฟ + สัญญาณในราง', 'link'], ['คอยล์ร้อนเริ่มทำงาน', 'cdu']], cool: 0 },
    { k: 'intake', t: `ลมร้อนในห้องถูกดูดเข้าทาง${intake}`, d: `พัดลมในเครื่องดูดอากาศในห้องเข้าทาง${intake} ผ่านแผ่นกรองที่ดักฝุ่น เส้นผม และขนสัตว์ก่อนถึงคอยล์ ถ้าแผ่นกรองอุดตัน ลมผ่านได้น้อย ห้องเย็นช้า`, cam: 'unit', flows: ['room', 'unitWarm'], xu: 1, lab: [['ช่องลมกลับ', 'intake'], ['แผ่นกรองฝุ่น', 'filter']], cool: 0 },
    { k: 'coil', t: 'น้ำยาเหลวเย็นจัดเข้าคอยล์เย็น ดูดความร้อนจากลม', d: 'น้ำยาเหลวแรงดันต่ำเข้ามาทางท่อเล็ก (มองทะลุรางและฉนวน Aeroflex) พอเข้าคอยล์ก็ระเหยที่อุณหภูมิต่ำ ดูดความร้อนจากลมที่ผ่านครีบอะลูมิเนียม ลมจึงเย็นลงก่อนถึงพัดลม', cam: 'unitTrunk', flows: ['liq', 'coil', 'unitWarm', 'unitCool'], xu: 1, xt: 1, lab: [['ท่อเล็ก: น้ำยาเหลวเข้า', 'liqIn'], ['คอยล์เย็น: น้ำยาระเหย', 'coil'], ['ฉนวน Aeroflex กันผิวท่อเกิดหยดน้ำ', 'insul']], cool: 0.1 },
    { k: 'water', t: 'ความชื้นกลั่นเป็นน้ำ ลงถาด ออกท่อน้ำทิ้งสีฟ้า', d: water, cam: 'drain', flows: ['drips', 'drain'], xu: 0.6, xt: 1, lab: type === 'cassette' ? [['ถาด + ปั๊มน้ำทิ้ง + ลูกลอย', 'pan'], ['ท่อน้ำทิ้ง PVC สีฟ้า', 'drainRun'], ['ปลายท่อลงท่อระบาย', 'drainEnd']] : [['ถาดน้ำทิ้ง', 'pan'], ['ท่อน้ำทิ้ง PVC สีฟ้า ลาดตลอดแนว', 'drainRun'], ['ปลายท่อลงท่อระบาย', 'drainEnd']], cool: 0.2 },
    { k: 'fan', t: `${fan.split(' ')[0]}ส่งลมเย็นออกจากเครื่อง`, d: `${fan} ลมที่ผ่านคอยล์แล้วถูกเป่าออกทางช่องลมออก ใบพัดถี่มาก ฝุ่นผสมความชื้นจึงเกาะเป็นคราบ ถ้าไม่ล้าง ลมจะเบาและมีกลิ่น`, cam: 'unit', flows: ['unitCool', 'room'], xu: 1, lab: [['พัดลม', 'fan'], ['ช่องลมออก + บานสวิง', 'outlet']], cool: 0.35 },
    { k: 'throw', t: 'ลมเย็นกระจายทั่วห้อง', d: `${throw_} ลมที่อุ่นขึ้นไหลกลับเข้าเครื่องเป็นวงรอบ คนในห้องเริ่มสบาย (สีของเส้นลม = อุณหภูมิลม ภาพเพื่ออธิบาย ไม่ใช่ค่าวัด)`, cam: 'overview', flows: ['room'], lab: [['ลมเย็นลงสู่ระดับที่คนอยู่', 'throwTo'], ['ลมอุ่นไหลกลับเข้าเครื่อง', 'intake']], cool: 1 },
    { k: 'gas', t: 'ไอน้ำยาพาความร้อนกลับทางท่อใหญ่ ไปคอมเพรสเซอร์', d: 'น้ำยาที่ระเหยเป็นไอแล้วพาความร้อนจากห้องกลับทางท่อใหญ่ (หุ้มฉนวนตลอดแนวในราง) ออกผนัง ลงรางถึงวาล์วบริการของคอยล์ร้อน คอมเพรสเซอร์ดูดไอน้ำยาเข้าไปอัดจนร้อนจัดและแรงดันสูง', cam: 'balcony', flows: ['gas', 'suction'], xt: 1, comp: 1, lab: [['ท่อใหญ่: ไอน้ำยากลับ', 'gasRun'], ['วาล์วบริการ + แฟลร์นัต', 'valves'], ['คอมเพรสเซอร์', 'comp']], cool: 1 },
    { k: 'reject', t: 'คอยล์ร้อนระบายความร้อนออกนอกอาคาร', d: 'ไอน้ำยาร้อนจัดวิ่งผ่านแผงคอยล์ร้อน พัดลมเป่าลมผ่านครีบ ความร้อนจากห้องจึงถูกทิ้งออกนอกบ้าน น้ำยาเย็นตัวกลับเป็นของเหลว แล้วไหลกลับเข้าห้องทางท่อเล็ก (ลดแรงดันก่อนเข้าคอยล์เย็น) วนซ้ำ', cam: 'cdu', flows: ['hot', 'plume', 'liq'], xo: 1, comp: 1, lab: [['แผงคอยล์ร้อน', 'oCoil'], ['พัดลมคอยล์ร้อน: ลมร้อนออก', 'fanOut'], ['ท่อเล็ก: น้ำยาเหลวกลับเข้าห้อง', 'liqOut']], cool: 1 },
    { k: 'loop', t: 'ทั้งระบบทำงานเป็นวงจรเดียว', d: 'ความร้อนในห้องถูกย้ายออกนอกบ้านอย่างต่อเนื่องผ่านน้ำยาที่วนในท่อทองแดง เมื่อห้องถึงอุณหภูมิที่ตั้ง เครื่องลดการทำงานของคอมเพรสเซอร์ (รุ่นอินเวอร์เตอร์ปรับรอบลง รุ่นธรรมดาตัด–ต่อ) น้ำทิ้งไหลออกตลอดเวลาที่เครื่องทำความเย็น', cam: 'overview', flows: ['room', 'liq', 'gas', 'drain', 'plume'], xt: 1, comp: 1, lab: [['ลมเย็นในห้อง', 'throwTo'], ['ท่อน้ำยา + น้ำทิ้งในราง', 'trunkOut'], ['ความร้อนออกนอกบ้าน', 'fanOut']], cool: 1 },
  ];
}

/* ---------------------------------------------------------------- 3D */
const dotTex = (() => { let t; return () => t || (t = canvasTex(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); })); })();
function pts(n, size, additive) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, opacity: 0, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  p.frustumCulled = false; p.renderOrder = 9; p.userData = { n, u: new Float32Array(n).map(() => Math.random()), a: new Float32Array(n * 3).map(() => Math.random()), k: 0, want: 0 }; return p;
}

export function createSystem3D(container, opts = {}) {
  const stage = createStage(container, { theme: opts.theme === 'dark' ? 'dark' : 'light', name: 'ระบบแอร์ทั้งบ้าน' });
  const dark = opts.theme === 'dark';
  const labels = createLabels(container);
  let cur = null, type = null, step = -1, list = [];

  // r8: each type's home is built once and kept — switching back is instant and nothing leaks (it was rebuilt every time,
  // leaving ~17 label textures behind per switch)
  const built = {};
  function build(t) {
    Object.values(built).forEach(b => { b.home.root.visible = false; });
    if (built[t]) { type = t; built[t].home.root.visible = true; labels.occluders(built[t].home.walls); return built[t]; }
    type = t; const home = buildHome(stage.scene, { type: t, theme: dark ? 'dark' : 'light' }); labels.occluders(home.walls);
    const U = home.U, UP = unitPaths(t, U), OP = outdoorPaths();
    home.root.updateMatrixWorld(true);
    const uw = (p) => U.root.localToWorld(V(...p)), ow = (p) => home.outG.localToWorld(V(...p));
    // clone shells so x-ray fades stay local
    const shells = t === 'wall' ? [] : (U.shells || []); if (t === 'wall') { [U.parts.front, U.parts.chassis].forEach(g => g.traverse(m => { if (m.isMesh) shells.push(m); })); }
    shells.forEach(m => { m.material = m.material.clone(); m.userData.op = m.material.opacity; m.userData.tr = m.material.transparent; });
    const comp = []; home.OU.parts['o-comp'].traverse(m => { if (m.isMesh) { m.material = m.material.clone(); comp.push(m); } });
    // room air + people
    const air = createAirflow(home.root, { count: 1600, dark, width: 0.024, trail: 0.2 });
    air.setRoom(home.roomBox); air.obstacles(home.obstacles); air.setEmitters(home.emitters);
    const ux = home.emitters[0].o.x, uz = home.emitters[0].o.z;
    const coolAt = (x, z, c) => 30.5 - c * (4.2 + 2.6 * Math.exp(-Math.hypot(x - ux, z - uz) / 3.2));
    let cool = 0, coolT = 0;
    air.set({ airF: 1, fan: 1, swing: true, supplyT: 13.8, roomT: 30.5, dark, ambient: (x, z) => coolAt(x, z, cool), running: true });
    air.prewarm(200, 0.05);   // settle the room air once (physics only), not 200 full draws
    const crowd = createCrowd(home.root, { max: 4 });
    crowd.set([{ x: -1.0, z: 1.33, ry: Math.PI, pose: 'sit' }, { x: 0.05, z: 1.33, ry: Math.PI, pose: 'sit' }, { x: -1.95, z: -0.35, ry: -Math.PI / 2 + 0.3, pose: 'stand' }]);
    // flows
    const F = {};
    const flow = (name, path, o) => { const f = createPathFlow(home.root, { count: 140, speed: 0.55, depthTest: false, ...o, size: (o.size || 0.034) * 1.8 }); f.setPath(path); F[name] = f; return f; };
    const liqPath = [...OP.hot.slice(-3).map(ow), ...home.flow.liq(), ...UP.liquid.map(uw)];
    const gasPath = [...UP.gas.map(uw), ...home.flow.gas()];
    flow('power', [...home.flow.power(), ...home.flow.link()], { color: COL.power, size: 0.03, speed: 0.9, additive: dark, count: 90 });
    flow('liq', smoothPts(liqPath, 0.02, 0.01), { color: COL.liq, size: 0.03, speed: 0.45 });
    flow('gas', smoothPts(gasPath, 0.02, 0.01), { color: COL.gas, color2: 0x9fd8ff, size: 0.036, speed: 0.6 });
    flow('coil', smoothPts(UP.coil.map(uw), 0.02, 0.006), { color: COL.liq, color2: COL.gas, size: 0.026, speed: 0.35, count: 90 });
    flow('suction', smoothPts(OP.suction.map(ow), 0.02, 0.005), { color: COL.gas, size: 0.03, speed: 0.25, count: 40 });
    flow('hot', smoothPts(OP.hot.map(ow), 0.015, 0.008), { color: COL.hot, color2: COL.hot2, size: 0.03, speed: 0.9, count: 160, additive: dark });
    flow('drain', smoothPts([...UP.pan.map(uw), ...home.flow.drain()], 0.02, 0.01), { color: COL.drain, color2: 0x7cc6ff, size: 0.032, speed: 0.45, count: 100, jitter: 0.004 });
    // unit-internal air (warm before the coil, cool after), drips, heat plume
    const inAir = pts(700, 0.026, dark), drips = pts(160, 0.022, false), plume = pts(420, 0.05, dark); home.root.add(inAir, drips, plume);
    const cPale = new THREE.Color(0xffe2c4), cW = new THREE.Color(COL.warm), cC = new THREE.Color(COL.cool), cD = new THREE.Color(0x6fc0ff), cH = new THREE.Color(COL.hot2), tmp = new THREE.Color(), wv = new THREE.Vector3();
    const yz = UP.air ? UP.air.yz.slice(0, UP.air.out + 2) : null, rad = UP.radial ? UP.radial.slice(0, 13) : null;
    const coilIdx = UP.air ? UP.air.coil : 8;
    const polyAt = (P, u) => { const f = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), r = f - i; return [P[i][0] + (P[i + 1][0] - P[i][0]) * r, P[i][1] + (P[i + 1][1] - P[i][1]) * r, f]; };
    const fanC = home.outG.localToWorld(V(-0.1, 0, 0.2));
    const setK = (p, on, dt) => { const u = p.userData; u.want = on ? 1 : 0; u.k += (u.want - u.k) * clamp(dt * 3, 0, 1); p.material.opacity = u.k * 0.95; p.visible = u.k > 0.02; return p.visible; };
    function stepInAir(dt, warm, coolOn) {
      if (!setK(inAir, warm || coolOn, dt)) return; const u = inAir.userData, pos = inAir.geometry.attributes.position.array, col = inAir.geometry.attributes.color.array;
      for (let i = 0; i < u.n; i++) {
        u.u[i] += dt * 0.55; if (u.u[i] > 1) { u.u[i] = 0; u.a[i * 3] = Math.random(); u.a[i * 3 + 1] = Math.random(); }
        let x, y, z, idx;
        if (yz) { const [yy, zz, f] = polyAt(yz, u.u[i]); idx = f; x = UP.air.x[0] + (UP.air.x[1] - UP.air.x[0]) * u.a[i * 3]; y = yy; z = zz; }
        else { const [r, yy, f] = polyAt(rad, u.u[i]); idx = f; const k = Math.floor(u.a[i * 3] * 4), dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][k], l = (u.a[i * 3 + 1] - 0.5) * 0.5 * Math.min(1, r / 0.3); x = dir[0] * r + dir[1] * l; z = dir[1] * r - dir[0] * l; y = yy; }
        const isCool = idx > coilIdx; const show = isCool ? coolOn : warm; wv.set(x, y, z); U.root.localToWorld(wv);
        pos[i * 3] = wv.x; pos[i * 3 + 1] = show ? wv.y : -99; pos[i * 3 + 2] = wv.z; tmp.copy(isCool ? cC : cW); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      inAir.geometry.attributes.position.needsUpdate = true; inAir.geometry.attributes.color.needsUpdate = true;
    }
    function stepDrips(dt, on) {
      if (!setK(drips, on, dt)) return; const u = drips.userData, pos = drips.geometry.attributes.position.array, col = drips.geometry.attributes.color.array, D = UP.drips;
      for (let i = 0; i < u.n; i++) {
        u.u[i] += dt * 0.9; if (u.u[i] > 1) { u.u[i] = 0; u.a[i * 3] = Math.random(); u.a[i * 3 + 1] = Math.random(); }
        if (D.ring) { const a = u.a[i * 3] * Math.PI * 2, r = D.ring[0] + (D.ring[1] - D.ring[0]) * u.a[i * 3 + 1]; wv.set(Math.cos(a) * r, 0.16 - u.u[i] * 0.11, Math.sin(a) * r); }
        else wv.set(D.x[0] + (D.x[1] - D.x[0]) * u.a[i * 3], D.y[0] + 0.07 - u.u[i] * 0.09, D.z + (u.a[i * 3 + 1] - 0.5) * 0.02);
        U.root.localToWorld(wv); pos[i * 3] = wv.x; pos[i * 3 + 1] = wv.y; pos[i * 3 + 2] = wv.z; col[i * 3] = cD.r; col[i * 3 + 1] = cD.g; col[i * 3 + 2] = cD.b;
      }
      drips.geometry.attributes.position.needsUpdate = true; drips.geometry.attributes.color.needsUpdate = true;
    }
    function stepPlume(dt, on) {
      if (!setK(plume, on, dt)) return; const u = plume.userData, pos = plume.geometry.attributes.position.array, col = plume.geometry.attributes.color.array;
      for (let i = 0; i < u.n; i++) {
        u.u[i] += dt * 0.6; if (u.u[i] > 1) { u.u[i] = 0; u.a[i * 3] = Math.random(); u.a[i * 3 + 1] = Math.random(); u.a[i * 3 + 2] = Math.random(); }
        const t = u.u[i], a = u.a[i * 3] * Math.PI * 2, r = 0.17 * Math.sqrt(u.a[i * 3 + 1]) * (1 + t * 1.6);
        pos[i * 3] = fanC.x + Math.cos(a) * r; pos[i * 3 + 1] = fanC.y + Math.sin(a) * r + t * t * 0.35; pos[i * 3 + 2] = fanC.z + t * 1.6;
        tmp.copy(cH).lerp(cPale, t); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      plume.geometry.attributes.position.needsUpdate = true; plume.geometry.attributes.color.needsUpdate = true;
    }
    // anchors
    const A = home.anchors, UA = (p) => () => U.root.localToWorld(V(...p));
    const ua = U.anchors || { intake: [0.0, 0.15, 0.02], filter: [-0.22, 0.13, 0.055], coil: [-0.05, 0.06, 0.08], fan: [-0.18, -0.035, 0.03], pan: [0.12, -0.09, 0.08], louver: [0.05, -0.132, 0.1] };
    const AN = {
      rcbo: A.rcbo, unit: A.unit, cdu: A.cdu, link: () => home.lanes.L.fixed[Math.floor(home.lanes.L.fixed.length * 0.55)], intake: UA(ua.intake), filter: UA(ua.filter), coil: UA(ua.coil), fan: UA(ua.fan), pan: UA(t === 'cassette' ? (ua.pump || ua.pan) : ua.pan), outlet: UA(ua.louver),
      liqIn: () => home.lanes.liq.fixed[Math.floor(home.lanes.liq.fixed.length * 0.1)], insul: A.insul, drainRun: A.drain, drainEnd: A.drainEnd, gasRun: () => home.lanes.gas.fixed[Math.floor(home.lanes.gas.fixed.length * 0.7)], valves: A.valves, comp: A.comp,
      oCoil: home.outG.localToWorld(V(-0.3, 0.12, -0.14)), fanOut: fanC.clone().add(V(0, 0.1, 0.45)), liqOut: () => home.lanes.liq.fixed[Math.floor(home.lanes.liq.fixed.length * 0.9)], trunkOut: A.trunkOut,
      throwTo: V(ux * 0.6 - 0.2, 1.0, t === 'cassette' ? 0.9 : 0.5),
    };
    // cameras per type
    const uc = U.root.getWorldPosition(new THREE.Vector3());
    const CAM = {
      overview: { t: [0.9, 1.1, -0.4], r: 8.6, th: 0.4, ph: 1.18 },
      unit: t === 'cassette' ? { t: [uc.x, uc.y - 0.1, uc.z], r: 3.0, th: 0.35, ph: 1.72 } : { t: [uc.x, uc.y - 0.05, uc.z + 0.1], r: t === 'ceiling' ? 3.0 : 2.3, th: 0.32, ph: 1.4 },
      unitTrunk: t === 'cassette' ? { t: [1.3, 2.75, -1.1], r: 3.4, th: 0.3, ph: 1.62 } : { t: [(uc.x + 2.5) / 2, (uc.y + home.penY) / 2, -1.8], r: 2.9, th: 0.32, ph: 1.36 },
      drain: { t: [2.5, (home.penY + 0.3) / 2 + 0.3, -1.5], r: 6.2, th: 0.34, ph: 1.2 },
      balcony: { t: [3.3, (home.penY + 0.3) / 2 + 0.2, -1.35], r: 4.9, th: 0.2, ph: 1.22 },
      cdu: { t: [3.72, 0.48, -1.55], r: 2.05, th: 0.22, ph: 1.2 },
    };
    const obj = {
      home, CAM, AN, F,
      update(dt, clock, cur) {
        const s = cur, on = n => !!(s && s.flows.includes(n));
        coolT = s ? s.cool : 0.4; cool += (coolT - cool) * clamp(dt * 0.6, 0, 1);
        air.set({ ambient: (x, z) => coolAt(x, z, cool), running: true }); air.update(dt, clock); air.mesh.visible = !s || on('room') || s.k === 'throw';
        animateUnit(U.anim ? U : { anim: null }, dt, clock, 1);
        if (t === 'wall' && !RM()) { U.parts.blower.userData.spin.rotation.x -= dt * 9; U.parts.louver.userData.flap.rotation.x = 0.55 + Math.sin(clock * 0.9) * 0.22; }
        if (!RM()) home.OU.parts['o-fan'].userData.spin.rotation.z -= dt * 11;
        crowd.update(dt, clock, (x, z) => coolAt(x, z, cool));
        for (const n in F) { F[n].set(on(n)); F[n].update(dt); }
        stepInAir(dt, on('unitWarm') || (s && s.k === 'intake'), on('unitCool')); stepDrips(dt, on('drips')); stepPlume(dt, on('plume'));
        // see-through unit shells / trunking
        const xu = s && s.xu ? s.xu : 0; shells.forEach(m => { const o = m.userData.op ?? 1; m.material.transparent = xu > 0 || m.userData.tr; m.material.opacity = o * (1 - 0.82 * xu); m.material.depthWrite = xu < 0.1; });
        const xt = s && s.xt ? 1 : 0; if (obj._xt !== xt) { obj._xt = xt; home.setXray(xt, ['lid', 'insul']); }
        const g = s && s.comp ? 0.5 + 0.5 * Math.sin(clock * 5) : 0; comp.forEach(m => { if (m.material.emissive) { m.material.emissive.setHex(0xff5a1f); m.material.emissiveIntensity = g * 0.6; } });
      },
      dispose() { home.dispose(); labels.clear(); },
    };
    built[t] = obj;
    return obj;
  }

  function setType(t) { if (t === type) return; cur = build(t); list = steps(t); go(step < 0 ? -1 : 0); opts.onBuilt && opts.onBuilt(list); }
  function go(i) {
    step = i; const s = list[i];
    stage.flyTo((s && cur.CAM[s.cam]) || cur.CAM.overview, RM() ? 0 : 1500);
    labels.set(s ? s.lab.map(([text, at], k) => ({ text, at: cur.AN[at] || null, n: k + 1 })) : []);
    opts.onStep && opts.onStep(i);
  }
  stage.onFrame((dt, clock) => { if (cur) cur.update(dt, clock, list[step] || null); });
  stage.onAfter((camera, W, H) => labels.update(camera, W, H));
  setType(opts.type || 'wall');
  // r15: the other two homes are built and their shaders compiled once the visitor pauses (no touch / scroll for a moment),
  // one at a time — a type tab then switches at once instead of freezing while a whole house is built and compiled
  let preN = 0;
  function preload() {
    const t = ['wall', 'ceiling', 'cassette'].find(k => !built[k]); if (!t || ++preN > 3) return;
    whenCalm(() => {
      if (built[t]) return preload();
      const keep = type, b = build(t); b.home.root.visible = false;
      type = keep; if (built[keep]) { built[keep].home.root.visible = true; labels.occluders(built[keep].home.walls); }
      whenCalm(() => { warm(stage.renderer, stage.scene, stage.camera, b.home.root); preload(); }, 600);
    }, 1500);
  }
  setTimeout(preload, 2500);
  return { setType, go, get steps() { return list; }, advance: s => stage.advance(s), dispose: () => { Object.values(built).forEach(b => b.dispose()); stage.dispose(); } };
}

/* ---------------------------------------------------------------- UI */
export function mountSystem3D(root, cfg = {}) {
  root.classList.add('sy3');
  let type = cfg.start || 'wall', step = -1, V3 = null, playing = false, timer = null, drawing = null;
  const tabs = h('div', { class: 'ts-tabs sy3-tabs', role: 'tablist', 'aria-label': 'ประเภทแอร์' });
  const stageEl = h('div', { class: 'sy3-stage' }), fb = h('div', { class: 'ts-fb', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ อ่านลำดับการทำงานด้านล่างได้ครบ'); stageEl.append(fb);
  const tl = h('div', { class: 'ts-tl', role: 'group', 'aria-label': 'ลำดับการทำงาน' });
  const play = iconLabel(h('button', { type: 'button', class: 'ts-play', onclick: () => toggle() }), 'play', 'เล่นทีละขั้น');
  const prev = h('button', { type: 'button', class: 'ts-nav', 'aria-label': 'ขั้นก่อนหน้า', onclick: () => { stop(); go(Math.max(-1, step - 1)); } }, '‹');
  const next = h('button', { type: 'button', class: 'ts-nav', 'aria-label': 'ขั้นถัดไป', onclick: () => { stop(); go(Math.min(steps(type).length - 1, step + 1)); } }, '›');
  const cap = h('div', { class: 'ts-cap sy3-cap', 'aria-live': 'polite' });
  const keys = h('div', { class: 'sy3-keys' }, ...[['warm', 'ลมอุ่นจากห้อง'], ['cool', 'ลมเย็นออก'], ['liq', 'น้ำยาเหลว (ท่อเล็ก)'], ['gas', 'ไอน้ำยา (ท่อใหญ่)'], ['hot', 'น้ำยาร้อน / ความร้อนออก'], ['drain', 'น้ำทิ้ง'], ['power', 'ไฟฟ้า']].map(([k, t]) => h('span', {}, h('i', { class: 'k-' + k }), t)));
  const drawBtn = h('button', { type: 'button', class: 's-btn ghost sy3-draw', 'aria-expanded': 'false', onclick: () => toggleDrawing() }, 'ดูภาพตัด 2 มิติ (แบบวิศวกรรม)');
  const drawHost = h('div', { class: 'sy3-drawing', hidden: true });
  root.append(tabs, stageEl, h('div', { class: 'ts-bar sy3-bar' }, play, prev, tl, next), cap, keys, h('div', { class: 'sy3-more' }, drawBtn), drawHost,
    h('p', { class: 's-note' }, 'ภาพ 3 มิติจำลองหลักการทำงานของระบบในบ้านจริง ท่อทั้งหมดเดินในรางครอบท่อ ขั้นที่เกี่ยวกับน้ำยาและน้ำทิ้งแสดงแบบมองทะลุรางและฉนวน สีของเส้นลมและน้ำยาเพื่ออธิบาย ไม่ใช่ค่าวัดของรุ่นใดรุ่นหนึ่ง'));
  const stop = () => { if (playing) toggle(); };
  function toggle() { playing = !playing; iconLabel(play, playing ? 'pause' : 'play', playing ? 'หยุด' : 'เล่นทีละขั้น'); clearInterval(timer); if (playing) { go(step < 0 ? 0 : (step + 1) % steps(type).length); timer = setInterval(() => go((step + 1) % steps(type).length), 7500); } }
  function go(i) { step = i; V3 ? V3.go(i) : paint(); }
  function paint() {
    const L = steps(type);
    tl.innerHTML = ''; L.forEach((s, i) => tl.append(h('button', { type: 'button', 'aria-pressed': i === step, title: s.t, class: i < step ? 'done' : '', onclick: () => { stop(); go(i); } }, String(i + 1))));
    cap.innerHTML = '';
    if (step < 0) cap.append(h('div', { class: 'ts-cap-h' }, h('b', {}, `${TYPE_TH[type]}: ทั้งระบบทำงานอย่างไร`)), h('p', {}, `${L.length} ขั้น ตั้งแต่เปิดเครื่อง ลมในห้องผ่านคอยล์เย็น น้ำทิ้งออกท่อ จนความร้อนถูกทิ้งที่คอยล์ร้อน กด "เล่นทีละขั้น" หรือเลือกหมายเลข ลากภาพเพื่อหมุนดู`));
    else { const s = L[step]; cap.append(h('div', { class: 'ts-cap-h' }, h('span', { class: 'ts-sn' }, `${step + 1}/${L.length}`), h('b', {}, s.t)), h('p', {}, s.d)); }
  }
  function render() {
    tabs.innerHTML = '';
    Object.entries(TYPE_TH).forEach(([k, th]) => tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': k === type, onclick: () => { if (k === type) return; setType(k); cfg.onType && cfg.onType(k); } }, th)));
    paint();
  }
  // r8: a type picked elsewhere on the page (services, how-it-works) while this scene is off screen is applied when it comes
  // near the viewport — building a whole house used to freeze the click for ~1 s although nothing here was visible
  let near = false, pendT = false;
  function setType(t) { if (!TYPE_TH[t] || t === type && V3) return; stop(); type = t; step = -1; if (near) V3 && V3.setType(t); else pendT = true; drawing && drawing.setType(t); render(); }
  const nio = new IntersectionObserver(es => { near = es.some(e => e.isIntersecting); if (near && pendT && V3) { pendT = false; V3.setType(type); } }, { rootMargin: '300px 0px' }); nio.observe(stageEl);
  function toggleDrawing() {
    const open = drawHost.hidden; drawHost.hidden = !open; drawBtn.setAttribute('aria-expanded', String(open)); drawBtn.textContent = open ? 'ซ่อนภาพตัด 2 มิติ' : 'ดูภาพตัด 2 มิติ (แบบวิศวกรรม)';
    if (open && !drawing) import('./engdraw.js').then(m => { drawing = m.mountEngDrawings(drawHost, { start: type, onType: t => { setType(t); cfg.onType && cfg.onType(t); } }); });
  }
  const io = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; io.disconnect();
    try { V3 = createSystem3D(stageEl, { theme: cfg.theme, type, onStep: i => { step = i; paint(); } }); } catch (e) { console.warn('system 3D unavailable', e); fb.hidden = false; } }, { rootMargin: '400px 0px' });
  io.observe(stageEl);
  render();
  return { setType, mark(p) { const K = { grille: 1, intake: 1, filter: 1, coil: 2, fan: 4, blower: 4, pan: 3, pump: 3, louver: 5, outdoor: 7 }; if (K[p] != null) { stop(); go(K[p]); } }, _v3: () => V3 };
}
