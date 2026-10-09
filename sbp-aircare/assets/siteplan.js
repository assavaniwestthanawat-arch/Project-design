// SBP AirCare — site survey for the room-fit simulator (Rev.09 r7, owner 2 ต.ค. 2569: "ลองวางแอร์ในห้อง … ใช้เป็นข้อมูลส่งให้บริษัท
// เพื่อประเมินค่าใช้จ่ายจริง และแนวเดินท่อน้ำยา ว่าจะเป็นเดินลอย ไปออกจุดไหน คอยล์ร้อนตำแหน่ง ระเบียงมีที่เดิน / ไม่มีที่เดิน ขาแขวน
// แบบที่สูง … ฝ้ายิปซั่ม ฝ้าเรียบ ฝ้าทีบาร์ หรือเดินท่อบนฝ้า ช่องเซอร์วิส คิดให้รอบคอบ").
// Pure module (no DOM, no three.js), node-testable:
//   · site options — building, ceiling, wall material, pipe route, condensing-unit location, drain, service hatch
//   · routePlan(S) — the refrigerant run in the room frame (points, lengths inside / above the ceiling / outside, exit hole,
//     where the condensing unit sits, whether the drain needs a pump, height above ground)
//   · siteWorks(S, plan) — the extra work this layout implies, each tied to a Pricebook item code; roomfit.js prices it from
//     DATA (only where the Pricebook has a price — everything else says "ประเมินหน้างาน")
//   · resizeLayout() — furniture keeps its wall / relative place when the room is resized
//   · encodeLayout / decodeLayout — the layout code the customer sends so the team can open the exact same layout
// Room frame = roomplan.js: x = width (left −, right +), z = length (back −L/2, front +L/2), y up, floor 0.
// Everything here is general guidance for an estimate; the team confirms on site (ค่าประมาณ ทีมช่างยืนยันหน้างาน).
import { FURN, frame2, footprint, clampItem } from './roomplan.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = v => Math.round(v * 100) / 100;
export const STOREY = 3.0;            // floor-to-floor height used to estimate height above ground (m)
export const REACH = 3.0;             // Pricebook: standard install = no survey when working height ≤ 3 m

export const BUILDINGS = [
  { id: 'house', th: 'บ้าน / ทาวน์โฮม' }, { id: 'condo', th: 'คอนโด / อาคารชุด' },
  { id: 'shop', th: 'ร้านค้า / อาคารพาณิชย์' }, { id: 'office', th: 'สำนักงาน / อาคาร' },
];
export const CEILINGS = [
  { id: 'smooth', th: 'ฝ้ายิปซั่มฉาบเรียบ', sub: 'เข้าเหนือฝ้าต้องเจาะ แล้วปิดคืน' },
  { id: 'tbar', th: 'ฝ้าทีบาร์', sub: 'ยกแผ่นฝ้าเข้าทำงานได้' },
  { id: 'none', th: 'ไม่มีฝ้า · เพดานปูน', sub: 'ท่อเดินลอยใต้เพดาน' },
];
export const WALL_MATS = [
  { id: 'brick', th: 'อิฐฉาบปูน' }, { id: 'concrete', th: 'คอนกรีต' },
  { id: 'board', th: 'ผนังเบา / ยิปซั่มบอร์ด' }, { id: 'glass', th: 'กระจก' },
];
export const ROUTES = [
  { id: 'direct', th: 'เจาะออกหลังเครื่อง', sub: 'สั้นที่สุด ท่อไม่โผล่ในห้อง' },
  { id: 'surface', th: 'เดินลอยในราง', sub: 'รางครอบท่อตามผนัง ไปออกจุดอื่น' },
  { id: 'ceiling', th: 'เดินบนฝ้า', sub: 'ซ่อนท่อเหนือฝ้า ต้องมีช่องเซอร์วิส' },
  { id: 'concealed', th: 'ฝังในผนัง', sub: 'กรีดผนัง ฝังท่อ ฉาบ ทาสีคืน' },
];
export const OUT_LOCS = [
  { id: 'balcony', th: 'ระเบียงมีที่เดิน', sub: 'วางบนพื้นระเบียง ช่างเดินเข้าถึง' },
  { id: 'ledge', th: 'แท่นวางไม่มีที่เดิน', sub: 'ช่องวางคอยล์ร้อนนอกหน้าต่าง' },
  { id: 'bracket', th: 'ขาแขวนผนัง', sub: 'ช่างตั้งบันไดหรือเอื้อมถึง' },
  { id: 'high', th: 'ขาแขวนที่สูง', sub: 'ต้องโรยตัว นั่งร้าน หรือกระเช้า' },
  { id: 'roof', th: 'ดาดฟ้า / หลังคา', sub: 'ท่อขึ้นด้านบน' },
  { id: 'ground', th: 'พื้นดิน / ลานด้านล่าง', sub: 'วางบนฐานที่พื้น' },
];
export const DRAINS = [
  { id: 'out', th: 'ปล่อยนอกอาคาร', sub: 'ตามแนวท่อลงพื้นหรือรางระบายน้ำ' },
  { id: 'floor', th: 'ท่อระบายพื้นระเบียง', sub: 'ต่อลงจุดระบายที่มีอยู่' },
  { id: 'inside', th: 'ท่อระบายในอาคาร', sub: 'เช่น ท่อระบายห้องน้ำ ต้องมีกาลักน้ำ' },
];
export const HATCHES = [
  { id: 'none', th: 'ไม่มี' }, { id: 'existing', th: 'มีช่องเซอร์วิสเดิม' }, { id: 'new', th: 'ทำช่องใหม่' },
];
// ext = the walls that face the outside of the building (pipes can only leave through these; the others are shared with a
// neighbour, a corridor or another room)
export const siteDefault = () => ({ building: 'house', floor: 1, ceiling: 'smooth', plenum: 0.4, wallMat: 'brick', hatch: { mode: 'none', x: 0, z: 0 }, db: 6, ext: ['back', 'left'] });
const extOf = site => (site && Array.isArray(site.ext) && site.ext.length ? site.ext : ['back', 'right', 'front', 'left']);
export const routeDefault = () => ({ mode: 'direct', exit: null });
export const outdoorDefault = () => ({ loc: 'bracket', side: 'right', run: 1.2, drop: 1.6 });

/* ---------------------------------------------------------------- geometry helpers (2D [x, z]) */
const ORDER = ['back', 'right', 'front', 'left'];   // walking to the right (seen from inside) around the room
const P2 = (fr, a, inset = 0) => [fr.o[0] + fr.t[0] * a + fr.n[0] * inset, fr.o[1] + fr.t[1] * a + fr.n[1] * inset];
const lenOf = (w, W, L) => (w === 'back' || w === 'front' ? W : L);
const offOf = (w, W, L) => ({ back: 0, right: W, front: W + L, left: 2 * W + L })[w];
/** path along the walls (in the corner-to-corner order) from (w1, a1) to (w2, a2), `inset` off the wall; the shorter way round */
export function perimPath(w1, a1, w2, a2, W, L, inset = 0.04) {
  const P = 2 * (W + L), s1 = offOf(w1, W, L) + a1, s2 = offOf(w2, W, L) + a2;
  const fwd = ((s2 - s1) % P + P) % P, dir = fwd <= P - fwd ? 1 : -1, dist = dir > 0 ? fwd : P - fwd;
  const pts = [P2(frame2(w1, W, L), a1, inset)];
  // corners crossed: corner k sits at the start of ORDER[k] (perimeter coordinate offOf), shared with ORDER[k-1]
  const cs = ORDER.map((w, k) => ({ k, s: offOf(w, W, L) }));
  const passed = cs.map(c => ({ ...c, d: dir > 0 ? ((c.s - s1) % P + P) % P : ((s1 - c.s) % P + P) % P })).filter(c => c.d > 1e-6 && c.d < dist - 1e-6).sort((a, b) => a.d - b.d);
  passed.forEach(c => { const w = ORDER[c.k], prev = ORDER[(c.k + 3) % 4], fw = frame2(w, W, L), fp = frame2(prev, W, L); pts.push([fw.o[0] + (fw.n[0] + fp.n[0]) * inset, fw.o[1] + (fw.n[1] + fp.n[1]) * inset]); });
  pts.push(P2(frame2(w2, W, L), a2, inset));
  return pts;
}
const seglen = pts => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);

/** where the refrigerant pipes leave the indoor unit (room frame) + the height its drain outlet sits at */
export function unitPort(S) {
  const { w: W, l: L, h: H } = S.room, d = S.unit.dims, t = S.unit.type, p = S.place;
  if (t === 'cassette') {
    const ph = d.w / 2 + 0.055, x = clamp(p.cx, -W / 2 + ph, W / 2 - ph), z = clamp(p.cz, -L / 2 + ph, L / 2 - ph);
    return { t, cas: true, x: x + d.w / 2 - 0.12, y: H + 0.12, z, cx: x, cz: z, drainY: H - 0.05, top: H + d.h };
  }
  const fr = frame2(p.wall, W, L), along = clamp(p.along, d.w / 2, fr.len - d.w / 2);
  const pa = clamp(along - d.w / 2 + 0.12, 0.1, fr.len - 0.1);   // pipes leave at the rear left of the unit (the usual side)
  const y = t === 'wall' ? p.height + d.h * 0.3 : t === 'ceiling' ? H - p.gap - d.h * 0.5 : 0.22;
  const bottom = t === 'wall' ? p.height : t === 'ceiling' ? H - p.gap - d.h : 0.05;
  const [x, z] = P2(fr, pa, 0.03);
  return { t, wall: p.wall, along: pa, unitAlong: along, x, y, z, drainY: bottom + 0.03, top: t === 'floor' ? d.h : t === 'wall' ? p.height + d.h : H - p.gap };
}
/** a sensible exit hole when the visitor picks a route that does not go straight through the wall behind the unit */
export function defaultExit(S, port = unitPort(S)) {
  const { w: W, l: L } = S.room, ext = extOf(S.site);
  if (port.cas) {   // the nearest outside wall, straight across from the unit
    const dd = { back: port.cz + L / 2, front: L / 2 - port.cz, left: port.cx + W / 2, right: W / 2 - port.cx };
    const wall = Object.keys(dd).filter(w => ext.includes(w)).sort((a, b) => dd[a] - dd[b])[0] || 'back', fr = frame2(wall, W, L);
    return { wall, along: r2(clamp((port.cx - fr.o[0]) * fr.t[0] + (port.cz - fr.o[1]) * fr.t[1], 0.3, fr.len - 0.3)) };
  }
  const k = ORDER.indexOf(port.wall), prev = ORDER[(k + 3) % 4], next = ORDER[(k + 1) % 4], opp = ORDER[(k + 2) % 4];
  if (ext.includes(prev)) return { wall: prev, along: r2(lenOf(prev, W, L) - 0.6) };   // round the unit's left corner, 0.6 m along the next wall
  if (ext.includes(next)) return { wall: next, along: 0.6 };                            // or its right corner
  if (ext.includes(port.wall)) {   // same wall, beside the unit (left side if there is room, else right)
    const len = lenOf(port.wall, W, L), hw = S.unit.dims.w / 2, a = port.unitAlong - hw - 0.3;
    return { wall: port.wall, along: r2(a >= 0.2 ? a : clamp(port.unitAlong + hw + 0.3, 0.2, len - 0.2)) };
  }
  if (ext.includes(opp)) return { wall: opp, along: r2(lenOf(opp, W, L) / 2) };
  return { wall: prev, along: r2(lenOf(prev, W, L) - 0.6) };
}

/** the whole run: unit → (inside: direct / trunk on the wall / above the ceiling / in the wall) → exit hole → condensing unit */
export function routePlan(S) {
  const { w: W, l: L, h: H } = S.room, site = S.site, t = S.unit.type, port = unitPort(S);
  let mode = S.route.mode;
  const ext = extOf(site);
  if (mode === 'direct' && t !== 'cassette' && !ext.includes(port.wall)) mode = 'surface';   // the wall behind the unit is not an outside wall
  if (t === 'cassette' && (mode === 'direct' || mode === 'concealed')) mode = site.ceiling === 'none' ? 'surface' : 'ceiling';
  if (mode === 'ceiling' && site.ceiling === 'none') mode = 'surface';   // no ceiling void → exposed under the slab
  const ex = mode === 'direct' ? { wall: port.wall, along: port.along } : (S.route.exit || defaultExit(S, port));
  const fr = frame2(ex.wall, W, L), ea = clamp(ex.along, 0.15, fr.len - 0.15);
  const pts = [], kinds = [];   // kinds[i] = what segment i → i+1 is: 'trunk' (visible) | 'ceil' (above ceiling) | 'chase' (in wall) | 'up' (riser in trunk)
  const push = (p, k) => { if (pts.length) kinds.push(k); pts.push(p); };
  let exitY;
  const yC = H + clamp(site.plenum / 2, 0.08, 0.2);   // above-ceiling run height
  if (mode === 'direct') { exitY = port.y; push([port.x, port.y, port.z]); }
  else if (mode === 'ceiling') {
    if (port.cas) push([port.x, yC, port.z]);
    else { push([port.x, port.y, port.z]); push([port.x, H - 0.03, port.z], 'up'); push([port.x, yC, port.z], 'up'); }
    const e = P2(fr, ea, 0.06), s0 = pts[pts.length - 1];
    const mid = Math.abs(e[0] - s0[0]) >= Math.abs(e[1] - s0[2]) ? [e[0], yC, s0[2]] : [s0[0], yC, e[1]];
    push(mid, 'ceil'); push([e[0], yC, e[1]], 'ceil'); exitY = yC;
  } else {   // surface trunk or concealed chase along the walls
    const kind = mode === 'concealed' ? 'chase' : 'trunk';
    if (port.cas) {
      const yR = H - 0.06; push([port.cx, yR, port.cz]);
      const a = clamp((port.cx - fr.o[0]) * fr.t[0] + (port.cz - fr.o[1]) * fr.t[1], 0.15, fr.len - 0.15), w0 = P2(fr, a, 0.04);
      push([w0[0], yR, w0[1]], kind); const e = P2(fr, ea, 0.04); push([e[0], yR, e[1]], kind); exitY = yR;
    } else {
      const yR = t === 'wall' ? port.y : t === 'ceiling' ? H - 0.07 : 0.14;
      push([port.x, port.y, port.z]); if (Math.abs(yR - port.y) > 0.01) push([port.x, yR, port.z], kind);
      perimPath(port.wall, port.along, ex.wall, ea, W, L, 0.04).slice(1).forEach(q => push([q[0], yR, q[1]], kind));
      exitY = yR;
    }
  }
  // lengths inside, by kind
  const by = { trunk: 0, ceil: 0, chase: 0, up: 0 };
  pts.slice(1).forEach((p, i) => { const q = pts[i]; by[kinds[i]] += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); });
  const inLen = mode === 'direct' ? 0.15 : seglen(pts);
  // outside: through the wall, along the outside face to the side, then up / down to the condensing unit's valves
  const hole = P2(fr, ea, 0), outN = [-fr.n[0], -fr.n[1]];
  const o = S.outdoor, sgn = o.side === 'left' ? -1 : 1;
  const ouAlong = ea + sgn * Math.max(0, o.run), baseY = exitY - o.drop, valveY = baseY + 0.15;
  const outLen = 0.2 + Math.max(0, o.run) + Math.abs(exitY - valveY);
  const total = Math.round((inLen + outLen + 0.4) * 10) / 10;   // + connection tails at both ends
  // drain: gravity needs a steady fall from the unit's drain outlet; a route that climbs on the way needs a pump
  const rise = Math.max(0, ...pts.slice(1).map(p => p[1])) - port.drainY;   // the route after the unit (pipes leave the casing higher than the drain)
  const needPump = t !== 'cassette' && mode !== 'direct' && rise > 0.12;
  const aboveGround = (Math.max(1, site.floor) - 1) * STOREY + baseY;
  return { mode, asked: S.route.mode, port, exit: { wall: ex.wall, along: ea, y: exitY, outside: ext.includes(ex.wall) }, pts, kinds, by, inLen, hole, outN,
    outdoor: { along: ouAlong, baseY, valveY, aboveGround, loc: o.loc }, outLen, total, rise, needPump };
}

/** extra work this layout implies → [{ code, th, qty, unit, why, kind }] — kind: 'price' (Pricebook price when it has one),
 *  'survey' (ประเมินหน้างาน), 'opt' (only if the building requires it), 'warn' (cannot be done this way), 'info' (no cost) */
export function siteWorks(S, plan) {
  const out = [], add = (code, th, qty, unit, why, kind = 'price') => out.push({ code, th, qty, unit, why, kind });
  const t = S.unit.type, site = S.site, H = S.room.h, d = S.unit.dims;
  // drain
  if (plan.needPump) add('DRAIN-PUMP-15', 'ปั๊มน้ำทิ้งพร้อมลูกลอย', 1, 'ชุด', `แนวท่อขึ้นสูงกว่าจุดน้ำทิ้งของเครื่อง ~${Math.round(plan.rise * 100)} ซม. น้ำไหลเองไม่ได้`);
  if (t === 'cassette') add(null, 'ปั๊มน้ำทิ้งในตัวเครื่องสี่ทิศทาง', 0, '', 'ยกน้ำขึ้นเหนือฝ้าได้ในระยะที่คู่มือรุ่นกำหนด ทีมตรวจระยะยกจริง', 'info');
  if (S.drain === 'inside') add('DRAIN-TRAP-34', 'ชุดกาลักน้ำทิ้ง (Trap)', 1, 'ชุด', 'ต่อเข้าท่อระบายในอาคาร กันกลิ่นย้อน');
  // ceiling
  if (t === 'cassette') {
    if (site.ceiling === 'none') add(null, 'แอร์สี่ทิศทางต้องติดกับฝ้า', 0, '', 'ห้องไม่มีฝ้า ควรใช้แอร์แขวนใต้ฝ้าแทน หรือทำฝ้าก่อน', 'warn');
    else add('CIV-CEIL', site.ceiling === 'tbar' ? 'ปรับโครงทีบาร์รับหน้ากากเครื่อง' : 'เจาะฝ้าตามแบบหน้ากาก + โครงรับรอบช่อง', 1, 'จุด', 'งานฝ้าไม่รวมในราคาติดตั้งมาตรฐาน', 'survey');
    if (site.ceiling !== 'none' && site.plenum < d.h + 0.05) add(null, `ช่องเหนือฝ้า ${Math.round(site.plenum * 100)} ซม. ไม่พอสำหรับตัวเครื่อง (${Math.round(d.h * 100)} ซม.)`, 0, '', 'ต้องยืนยันความสูงเหนือฝ้าจริง หรือเลือกเครื่องแบบอื่น', 'warn');
  }
  if (plan.mode === 'ceiling') {
    if (site.ceiling === 'tbar') add(null, 'ยกแผ่นฝ้าทีบาร์เข้าเดินท่อ', 0, '', 'ไม่ต้องเจาะฝ้า วางแผ่นคืนเมื่อเสร็จ', 'info');
    else if (site.hatch.mode === 'existing') add(null, 'ใช้ช่องเซอร์วิสเดิมเข้าเดินท่อ', 0, '', 'ทีมตรวจว่าช่องเดิมเข้าถึงแนวท่อได้ครบ', 'info');
    else if (t === 'cassette' && site.hatch.mode === 'none') add(null, 'เดินท่อเหนือฝ้าผ่านช่องติดตั้งเครื่อง', 0, '', `ข้อต่อที่ตัวเครื่องเข้าถึงทางช่องหน้ากาก · แนวเหนือฝ้า ~${plan.by.ceil.toFixed(1)} ม. ทีมสำรวจว่าต้องมีช่องเซอร์วิสเพิ่มหรือไม่`, 'info');
    else add('CIV-CEIL', 'เปิดฝ้าเดินท่อ + ทำช่องเซอร์วิส 60×60 ซม. และปิดคืน', 1, 'จุด', 'ฝ้ายิปซั่มฉาบเรียบต้องมีช่องเข้าถึงข้อต่อและท่อน้ำทิ้งไว้ใช้ดูแลภายหลัง', 'survey');
    if (site.plenum < 0.15) add(null, `ช่องเหนือฝ้า ${Math.round(site.plenum * 100)} ซม. แคบมาก`, 0, '', 'ท่อพร้อมฉนวนต้องการช่องราว 15 ซม. ขึ้นไป', 'warn');
  }
  if (plan.mode === 'surface' && plan.by.trunk > 0.3) add(null, `รางครอบท่อในห้อง ~${(plan.by.trunk + plan.by.up).toFixed(1)} ม.`, 0, '', 'รวมอยู่ในความยาวท่อ (ชุดวัสดุส่วนเกินแบบเหมามีรางครอบท่อแล้ว)', 'info');
  if (plan.mode === 'concealed') { add('CIV-CHASE', 'กรีดผนังฝังท่อและสาย', Math.ceil(plan.by.chase), 'เมตร', `แนวฝังประมาณ ${plan.by.chase.toFixed(1)} ม.`, 'survey'); add('CIV-PATCH', 'ฉาบซ่อม ทาสี และคืนสภาพ', 1, 'งาน', 'หลังฝังท่อ', 'survey'); }
  if (!plan.exit.outside) add(null, 'จุดเจาะอยู่บนผนังที่ไม่ติดภายนอก', 0, '', 'ท่อจะทะลุไปห้องข้างเคียงหรือทางเดิน · เลือกจุดเจาะบนผนังภายนอก หรือแจ้งทีมว่าต้องเดินท่อผ่านพื้นที่ข้างเคียง', 'warn');
  if (t === 'floor' || (site.floor > 1 && (t === 'ceiling' || t === 'cassette'))) add(null, 'ทางขนตัวเครื่องเข้าห้อง', 0, '', t === 'floor' ? 'ตู้สูงราว 1.8–1.9 ม. ตรวจขนาดประตู ลิฟต์ และบันได' : 'ลิฟต์ขนของหรือบันไดตามกฎอาคาร ทีมตรวจก่อนวันติดตั้ง', 'info');
  // the wall the pipes go through
  if (site.wallMat === 'concrete') add('CIV-CORE', 'เจาะ Core Drill ผนังคอนกรีต', 1, 'จุด', 'ผนังคอนกรีตใช้เครื่องเจาะแกน', 'survey');
  if (site.wallMat === 'glass') add(null, 'ผนังกระจกเจาะท่อไม่ได้', 0, '', 'เลือกจุดออกท่อที่ผนังทึบ หรือใช้ช่องที่เปลี่ยนเป็นแผ่นปิดได้', 'warn');
  if (site.wallMat === 'board') add(null, 'ผนังเบา / ยิปซั่มบอร์ด', 0, '', 'ยึดรางและขายึดกับโครงคร่าว ทีมตรวจแนวโครงหน้างาน', 'info');
  // condensing unit
  const og = plan.outdoor.aboveGround, loc = S.outdoor.loc;
  if (loc === 'high' || (loc === 'bracket' && og > REACH && site.floor > 1)) add('ACC-ROPE', loc === 'high' ? 'งานคอยล์ร้อนที่สูง (โรยตัว / นั่งร้าน / กระเช้า)' : `ขาแขวนสูงจากพื้นดิน ~${og.toFixed(1)} ม. ต้องใช้งานที่สูง`, 1, 'งาน', 'ทีมเลือกวิธีเข้าถึงตามหน้างาน ไม่รวมในราคาติดตั้งมาตรฐาน', 'survey');
  else if (loc === 'bracket' && og > REACH) add('ACC-HEIGHT', `ขาแขวนสูงจากพื้น ~${og.toFixed(1)} ม. (เกิน 3 ม.)`, 1, 'งาน', 'ต้องใช้บันไดสูงหรือนั่งร้านพร้อมอุปกรณ์ความปลอดภัย', 'survey');
  if (loc === 'ledge' && site.floor > 1) add('ACC-HEIGHT', 'ทำงานนอกหน้าต่างบนแท่นวาง (อุปกรณ์กันตก)', 1, 'งาน', 'ไม่มีที่เดิน ช่างต้องใช้สายกันตกขณะติดตั้งและล้างทุกครั้ง', 'survey');
  if (loc === 'roof') add('SUP-ROOF', 'ฐานรองบนหลังคา / ดาดฟ้า พร้อมกันซึม', 1, 'งาน', 'ท่อขึ้นด้านบน ต้องตรวจทางขึ้นและจุดผ่านกันซึม', 'survey');
  if (loc === 'ground') add('SUP-CONC', 'ฐานคอนกรีตสำหรับคอยล์ร้อน (ถ้ายังไม่มี)', 1, 'ฐาน', 'วางบนพื้นดินต้องยกพื้นกันน้ำขัง', 'opt');
  // working height inside the room
  if (plan.port.top > REACH + 0.05) add('ACC-HEIGHT', `งานสูงภายในห้อง (ตัวเครื่องสูง ~${plan.port.top.toFixed(1)} ม.)`, 1, 'งาน', 'สูงเกิน 3 ม. ต้องใช้บันไดสูง / นั่งร้าน', 'survey');
  // power from the panel
  if (site.db > 10) add(null, `เดินเมนไฟส่วนเกิน ~${Math.round(site.db - 10)} ม. จากตู้ไฟ`, Math.round(site.db - 10), 'เมตร', 'ราคาตามขนาดสายของรุ่น ทีมยืนยันขนาดสายตามกระแสของรุ่นก่อนเสนอราคา', 'survey');
  // building rules
  if (site.building === 'condo' || site.building === 'office') add('FIRESTOP-4', 'อุดช่องผ่านผนังด้วย Fire Stop', 1, 'จุด', 'ถ้าอาคารกำหนด', 'opt');
  if (site.building === 'condo') add(null, 'ขออนุญาตนิติบุคคลก่อนวันติดตั้ง', 0, '', 'ตำแหน่งคอยล์ร้อนและการเจาะผนังภายนอกต้องเป็นไปตามข้อกำหนดอาคาร', 'info');
  return out;
}

/** resize: pieces touching a wall stay on it (same gap), the rest keep their relative place; windows / doors scale along */
export function resizeLayout(items, W0, L0, W1, L1) {
  (items || []).forEach(it => {
    const f = FURN[it.k]; if (!f) return;
    if (f.wallItem) { const a = frame2(it.wall, W0, L0).len, b = frame2(it.wall, W1, L1).len; it.along = r2(it.along * b / a); clampItem(it, W1, L1); return; }
    const fp = footprint(it), gl = it.x - fp.hx + W0 / 2, gr = W0 / 2 - it.x - fp.hx, gb = it.z - fp.hz + L0 / 2, gf = L0 / 2 - it.z - fp.hz;
    it.x = r2(gl < 0.2 ? -W1 / 2 + fp.hx + gl : gr < 0.2 ? W1 / 2 - fp.hx - gr : it.x * W1 / W0);
    it.z = r2(gb < 0.2 ? -L1 / 2 + fp.hz + gb : gf < 0.2 ? L1 / 2 - fp.hz - gf : it.z * L1 / L0);
    clampItem(it, W1, L1);
  });
  return items;
}

/* ---------------------------------------------------------------- layout code (customer → team) */
const b64 = { enc: s => (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')), dec: s => (typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary')) };
const toB64url = str => b64.enc(Array.from(new TextEncoder().encode(str), c => String.fromCharCode(c)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => new TextDecoder().decode(Uint8Array.from(b64.dec(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export function encodeLayout(S) {
  const sku = S.sel && !S.sel.m.preview ? S.sel.m.skus[S.sel.si].sku : null, p = S.place, si = S.site, ro = S.route, o = S.outdoor;
  const v = { v: 1, r: [S.room.w, S.room.l, S.room.h].map(r2), sn: S.sun, pp: S.people, t: S.unit.type, k: sku,
    pl: [p.wall, r2(p.along), r2(p.height), r2(p.gap), r2(p.cx), r2(p.cz)],
    si: [si.building, si.floor, si.ceiling, r2(si.plenum), si.wallMat, si.hatch.mode, r2(si.hatch.x), r2(si.hatch.z), r2(si.db), (si.ext || []).join(',')],
    ro: [ro.mode, ro.exit ? ro.exit.wall : null, ro.exit ? r2(ro.exit.along) : null],
    o: [o.loc, o.side, r2(o.run), r2(o.drop)], dr: S.drain,
    f: (S.furn || []).map(it => (FURN[it.k].wallItem ? [it.k, it.wall, r2(it.along)] : [it.k, r2(it.x), r2(it.z), it.q || 0])) };
  return 'SBP1.' + toB64url(JSON.stringify(v));
}
const pickId = (list, id, d) => (list.some(x => x.id === id) ? id : d);
const WALL_IDS = ['back', 'left', 'right', 'front'];
/** → a plain, validated object (or null when the code is not a layout code) */
export function decodeLayout(code) {
  try {
    const m = String(code || '').trim().match(/SBP1\.([A-Za-z0-9_-]+)/); if (!m) return null;
    const v = JSON.parse(fromB64url(m[1])); if (!v || v.v !== 1 || !Array.isArray(v.r)) return null;
    const num = (x, a, b, d) => (Number.isFinite(+x) ? clamp(+x, a, b) : d), wall = w => (WALL_IDS.includes(w) ? w : 'back');
    return {
      room: { w: num(v.r[0], 2, 15, 4), l: num(v.r[1], 2, 20, 3.5), h: num(v.r[2], 2.3, 5, 2.6) }, sun: num(v.sn, 0, 2, 1) | 0, people: num(v.pp, 1, 30, 2) | 0,
      type: ['wall', 'ceiling', 'cassette', 'floor'].includes(v.t) ? v.t : 'wall', sku: typeof v.k === 'string' ? v.k.slice(0, 80) : null,
      place: { wall: wall(v.pl?.[0]), along: num(v.pl?.[1], 0, 20, 2), height: num(v.pl?.[2], 1, 4.5, 2.1), gap: num(v.pl?.[3], 0, 0.4, 0.03), cx: num(v.pl?.[4], -8, 8, 0), cz: num(v.pl?.[5], -10, 10, 0) },
      site: { building: pickId(BUILDINGS, v.si?.[0], 'house'), floor: num(v.si?.[1], 1, 80, 1) | 0, ceiling: pickId(CEILINGS, v.si?.[2], 'smooth'), plenum: num(v.si?.[3], 0, 2, 0.4), wallMat: pickId(WALL_MATS, v.si?.[4], 'brick'),
        hatch: { mode: pickId(HATCHES, v.si?.[5], 'none'), x: num(v.si?.[6], -8, 8, 0), z: num(v.si?.[7], -10, 10, 0) }, db: num(v.si?.[8], 1, 60, 6),
        ext: typeof v.si?.[9] === 'string' ? v.si[9].split(',').filter(w => WALL_IDS.includes(w)) : ['back', 'right', 'front', 'left'] },
      route: { mode: pickId(ROUTES, v.ro?.[0], 'direct'), exit: v.ro?.[1] ? { wall: wall(v.ro[1]), along: num(v.ro[2], 0, 20, 1) } : null },
      outdoor: { loc: pickId(OUT_LOCS, v.o?.[0], 'bracket'), side: v.o?.[1] === 'left' ? 'left' : 'right', run: num(v.o?.[2], 0, 30, 1.2), drop: num(v.o?.[3], -20, 60, 1.6) },
      drain: pickId(DRAINS, v.dr, 'out'),
      furn: (Array.isArray(v.f) ? v.f : []).filter(a => Array.isArray(a) && FURN[a[0]]).slice(0, 80).map(a => (FURN[a[0]].wallItem ? { k: a[0], wall: wall(a[1]), along: num(a[2], 0, 20, 1) } : { k: a[0], x: num(a[1], -8, 8, 0), z: num(a[2], -10, 10, 0), q: num(a[3], 0, 3, 0) | 0 })),
    };
  } catch (_) { return null; }
}
/** default drop for a location (how far the condensing unit's base sits below the exit hole) */
export function dropFor(loc, exitY, H, floor) {
  if (loc === 'balcony' || loc === 'ledge') return r2(exitY);                 // on the balcony / ledge floor, level with the room floor
  if (loc === 'roof') return r2(-(H - exitY + 0.6));                          // above the room (roof slab of this storey)
  if (loc === 'bracket') return r2(exitY - 1.2);                              // reachable from a ladder: base ~1.2 m above the floor level
  if (loc === 'ground') return r2(exitY + (Math.max(1, floor) - 1) * STOREY);  // down to the ground
  return 0.6;                                                                 // on a bracket just below the hole
}
