// SBP AirCare — "ลองวางแอร์ในห้องของคุณ" room-fit simulator (Rev.09, owner request 1 ต.ค. 2569)
// Pick any catalog model (FUJIVA as soon as its data is imported), type the room's width × length × height, choose the
// wall and position → the unit appears at its spec size with clearance lines, cold-air throw, the outdoor unit and an
// estimated pipe length. Checks are general guidance ("ค่าแนะนำทั่วไป"), never manufacturer limits — the team confirms
// on site. All text/results live in the side panel, so the page works without WebGL (the 3D view is extra).
// Rev.09 round 3 — room planner ("จัดห้องเองเหมือนเกม Sims แต่สมจริง"): furnished presets, a furniture catalogue, drag /
// rotate / delete in the 3D view (or from the list, keyboard-accessible), drag the AC along its wall; the cold air flows
// around the furniture and the checks add air-path, comfort and window/door clashes (roomplan.js).
// Rev.09 r7 — site survey (owner 2 ต.ค. 2569: "ใช้เป็นข้อมูลส่งให้บริษัทเพื่อประเมินค่าใช้จ่ายจริง"): building / storey / ceiling type /
// void above the ceiling / wall material, the refrigerant route (through the wall, surface trunk to another exit, above the
// ceiling with a service hatch, or chased into the wall), where the condensing unit sits (balcony with access, ledge without,
// bracket, high bracket, roof, ground), drain and distance to the panel → pipe length from the route, the extra work it implies
// (siteplan.siteWorks, priced from the Pricebook or "ประเมินหน้างาน"), furniture that scales with the room, and a layout code +
// summary the customer sends so the team opens the same layout.
import { icon } from './icons.js';
import { DEMO, DATA, BRAND_BY_ID, TYPE_BY_ID, baht, btuFmt, recommendBtu, installOptions, addonsFor, h, $$ } from './sbp-core.js';
import { cart } from './commerce.js';
import { productVisual, photosFor } from './product-media.js';
import { toast } from './proto-ui.js';
import { askTeam, handoffBox, copyText } from './contact.js';
import { FURN, FURN_GROUPS, PRESETS, presetLayout, freeSpot, clampItem, layoutChecks, newId, frame2, footprint } from './roomplan.js';
import { BUILDINGS, CEILINGS, WALL_MATS, ROUTES, OUT_LOCS, DRAINS, HATCHES, REACH, STOREY, siteDefault, routeDefault, outdoorDefault, routePlan, siteWorks, resizeLayout, encodeLayout, decodeLayout, dropFor } from './siteplan.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = v => Math.round(v * 10) / 10;
const wallLenOf = (wall, W, L) => (wall === 'left' || wall === 'right' ? L : W);   // same frames as roomfit3d.wallFrame

// Generic guidance used by the simulator — NOT a manufacturer limit. Tech lead to confirm, or replace per model
// when installation manuals are imported (then the model's own values win).
export const FIT_RULES = {
  wall: { top: 0.1, side: 0.15, minBottom: 1.8, bestBottom: [2.0, 2.5], throw: 6.5 },
  ceiling: { side: 0.3, minBottom: 2.2, gap: 0.03, throw: 10 },
  cassette: { wall: 1.0, minH: 2.4, maxH: 3.5, throw: 4.2, panel: 0.11 },
  floor: { side: 0.15, top: 0.3, throw: 9 },
  pipeIncluded: 4,   // ราคาติดตั้งมาตรฐานรวมท่อ 4 เมตรแรก (Pricebook · FAQ)
};
const SUN = [{ id: 0, th: 'แดดน้อย' }, { id: 1, th: 'ปานกลาง' }, { id: 2, th: 'แดดจัด / ใต้หลังคา' }];
const WALLS = [{ id: 'back', th: 'ผนังหลัง' }, { id: 'left', th: 'ผนังซ้าย' }, { id: 'right', th: 'ผนังขวา' }, { id: 'front', th: 'ผนังหน้า' }];
const FIT_TYPES = ['wall', 'ceiling', 'cassette', 'floor'];
// FUJIVA (company brand) has no Pricebook rows yet: a clearly-labelled preview lets visitors try the FUJIVA body
// in their room now (rounded premium shell with the wordmark, or the brand photo from product-media.json).
// Sizes are examples only; real models replace this automatically once FUJIVA is imported (BRAND_BY_ID.fujiva.n > 0).
const FUJIVA_PREVIEW = { id: 'fujiva-preview', brand: 'fujiva', type: 'wall', inverter: true, label: '—', series: 'FUJIVA Inverter · ตัวอย่างตัวเครื่อง', preview: true,
  skus: [9000, 12000, 18000, 24000].map(btu => ({ sku: `FUJIVA · ตัวอย่าง ${(btu / 1000).toFixed(0)}K`, btu, px: null, price: null, installStdEx: null, d: { indoorDim: null } })) };

export const throwFor = (type, btu) => FIT_RULES[type].throw * clamp(Math.pow(btu / 12000, 0.3), 0.85, 1.35);

// indoor-unit size in metres from the spec string ("298 x 766 x 202", "250 x 1,620 x 690", "880(+88)" …),
// otherwise a typical size for the type and BTU (flagged src: 'est')
export function unitDims(type, btu, spec) {
  const n = (spec || '').replace(/\([^)]*\)/g, '').replace(/,/g, '').match(/\d+(\.\d+)?/g);
  const v = n ? n.map(Number).filter(x => x >= 100 && x <= 2600).slice(0, 3) : [];
  if (v.length === 3) {
    const [a, b, c] = [...v].sort((x, y) => y - x);
    const dm = type === 'floor' ? { w: b, h: a, d: c } : type === 'wall' ? { w: a, h: b, d: c } : { w: a, h: c, d: b };
    const ok = type === 'wall' ? dm.h < 450 && dm.w > 550 : type === 'floor' ? dm.h > 1000 : dm.h < 450;
    if (ok) return { w: dm.w / 1000, h: dm.h / 1000, d: dm.d / 1000, src: 'spec', raw: spec };
  }
  const k = btu || 12000;
  const est = {
    wall: k <= 9600 ? [0.8, 0.29, 0.21] : k <= 13600 ? [0.86, 0.295, 0.215] : k <= 19500 ? [1.0, 0.315, 0.23] : k <= 25500 ? [1.1, 0.33, 0.24] : [1.2, 0.34, 0.25],
    ceiling: k <= 19500 ? [1.0, 0.235, 0.69] : k <= 31000 ? [1.28, 0.235, 0.69] : [1.6, 0.235, 0.69],
    cassette: k <= 28000 ? [0.84, 0.256, 0.84] : [0.84, 0.298, 0.84],
    floor: k <= 36000 ? [0.5, 1.75, 0.32] : [0.58, 1.85, 0.38],
  }[type] || [0.86, 0.3, 0.22];
  return { w: est[0], h: est[1], d: est[2], src: 'est' };
}

// every number the side panel and the 3D view need, from the state alone (pure — unit-testable)
export function fitCheck(S0) {
  const S = S0.site && S0.route ? S0 : { ...S0, site: siteDefault(), route: routeDefault(), outdoor: { ...outdoorDefault(), ...S0.outdoor }, drain: S0.drain || 'out' };
  const { w: W, l: L, h: H } = S.room, u = S.unit, d = u.dims, t = u.type, R = FIT_RULES[t], sku = S.sel ? S.sel.m.skus[S.sel.si] : null;
  const need = recommendBtu({ w: W, d: L, h: H, sun: S.sun, people: S.people }).btu;
  const btu = sku ? sku.btu : need;
  const thr = throwFor(t, btu);
  const gaps = {}, checks = [];
  const add = (ok, th, d2) => checks.push({ ok, th, d: d2 });
  let depth, wallDist = 0;
  if (t === 'cassette') {
    const ph = d.w / 2 + R.panel / 2;
    const x = clamp(S.place.cx, -W / 2 + ph, W / 2 - ph), z = clamp(S.place.cz, -L / 2 + ph, L / 2 - ph);
    gaps.left = { v: x + W / 2 - ph }; gaps.right = { v: W / 2 - x - ph }; gaps.back = { v: z + L / 2 - ph }; gaps.front = { v: L / 2 - z - ph };
    ['left', 'right', 'back', 'front'].forEach(k => (gaps[k].ok = gaps[k].v >= R.wall));
    depth = Math.max(Math.hypot(Math.max(x + W / 2, W / 2 - x), Math.max(z + L / 2, L / 2 - z)) * 0.85, 0);
    wallDist = Math.min(gaps.left.v, gaps.right.v, gaps.back.v, gaps.front.v) + ph;
  } else {
    const len = wallLenOf(S.place.wall, W, L);
    const along = clamp(S.place.along, d.w / 2, len - d.w / 2);
    gaps.left = { v: along - d.w / 2 }; gaps.right = { v: len - along - d.w / 2 };
    gaps.left.ok = gaps.left.v >= R.side; gaps.right.ok = gaps.right.v >= R.side;
    if (t === 'wall') { gaps.top = { v: H - S.place.height - d.h }; gaps.top.ok = gaps.top.v >= R.top; gaps.bottom = { v: S.place.height }; gaps.bottom.ok = gaps.bottom.v >= R.minBottom; }
    if (t === 'ceiling') { gaps.top = { v: S.place.gap, ok: true }; gaps.bottom = { v: H - S.place.gap - d.h }; gaps.bottom.ok = gaps.bottom.v >= R.minBottom; }
    if (t === 'floor') { gaps.top = { v: H - d.h }; gaps.top.ok = gaps.top.v >= R.top; }
    depth = (S.place.wall === 'left' || S.place.wall === 'right' ? W : L) - d.d;
  }
  // 1 · capacity vs room
  const ratio = btu / need;
  if (!sku) add('info', 'ยังไม่ได้เลือกรุ่น', `ห้องนี้ต้องการประมาณ ${btuFmt(need)} เลือกรุ่นทางซ้ายเพื่อดูขนาดจริงและราคา`);
  else if (ratio < 0.9) add('warn', `ขนาดเล็กกว่าที่ห้องต้องการ (${btuFmt(btu)} จาก ~${btuFmt(need)})`, 'อาจเย็นช้าช่วงบ่ายหรือเมื่อคนเยอะ ลองรุ่นที่ใหญ่ขึ้นหนึ่งขนาด');
  else if (ratio > 1.4) add(S.sel.m.inverter ? 'info' : 'warn', `ขนาดใหญ่กว่าห้องค่อนข้างมาก (${btuFmt(btu)} จาก ~${btuFmt(need)})`, S.sel.m.inverter ? 'รุ่นอินเวอร์เตอร์ปรับรอบลงได้ แต่ราคาเครื่องสูงกว่าที่จำเป็น' : 'เครื่องธรรมดาอาจตัดบ่อย ห้องเย็นเร็วแต่ความชื้นค้าง เลือกขนาดเล็กลงหรือรุ่นอินเวอร์เตอร์');
  else add('ok', `ขนาดเหมาะกับห้อง (${btuFmt(btu)} · ห้องต้องการ ~${btuFmt(need)})`, `พื้นที่ ${r1(W * L)} ตร.ม. สูง ${H.toFixed(2)} ม. ${SUN[S.sun].th} ${S.people} คน · ค่าประมาณเบื้องต้น`);
  // 2 · air reach
  if (t === 'cassette') add(depth > thr * 1.15 ? 'warn' : 'ok', depth > thr * 1.15 ? `มุมไกลของห้องอยู่นอกรัศมีลม (~${thr.toFixed(1)} ม.)` : `ลมกระจาย 4 ทิศครอบคลุมห้อง (~${thr.toFixed(1)} ม. รอบเครื่อง)`, depth > thr * 1.15 ? 'ห้องยาวหรือกว้างมากใช้ 2 เครื่องเรียงกันจะเย็นทั่วกว่า' : 'ตำแหน่งกลางห้องให้ลมทั่วที่สุด');
  else add(depth > thr * 1.15 ? 'warn' : 'ok', depth > thr * 1.15 ? `ห้องลึก ${depth.toFixed(1)} ม. ลมไปถึงราว ${thr.toFixed(1)} ม.` : `ลมเย็นไปถึงอีกฝั่งของห้อง (~${thr.toFixed(1)} ม. · ห้องลึก ${depth.toFixed(1)} ม.)`, depth > thr * 1.15 ? (t === 'wall' ? 'ด้านไกลจะเย็นช้ากว่า ลองติดผนังด้านยาวของห้อง หรือใช้แอร์แขวนใต้ฝ้าที่ลมไปไกลกว่า' : 'พิจารณาติดผนังด้านยาว หรือใช้ 2 เครื่อง') : 'ค่าระยะลมเป็นค่าทั่วไปของประเภทนี้ ปรับตามรุ่นจริงเมื่อมีข้อมูลผู้ผลิต');
  // 3 · clearances
  if (t === 'cassette') {
    const bad = ['left', 'right', 'back', 'front'].filter(k => !gaps[k].ok);
    add(bad.length ? 'warn' : 'ok', bad.length ? `ใกล้ผนังเกินไป (ต่ำสุด ${Math.round(Math.min(...bad.map(k => gaps[k].v)) * 100)} ซม.)` : 'ระยะจากขอบหน้ากากถึงผนังเพียงพอ', `ค่าแนะนำทั่วไป ≥ ${Math.round(FIT_RULES.cassette.wall * 100)} ซม. ทุกด้าน เพื่อให้ลมออกได้เต็มและเข้าถึงเพื่อล้าง`);
    add(H < FIT_RULES.cassette.minH || H > FIT_RULES.cassette.maxH ? 'warn' : 'ok', `ฝ้าสูง ${H.toFixed(2)} ม.`, H > FIT_RULES.cassette.maxH ? 'ฝ้าสูงมาก ลมอาจลงไม่ถึงพื้น ทีมจะเลือกรุ่นที่ตั้งค่าเพดานสูงได้' : H < FIT_RULES.cassette.minH ? 'ฝ้าต่ำ ลมเป่าใกล้ศีรษะ ควรพิจารณาแอร์ติดผนังหรือแขวน' : `ต้องมีช่องเหนือฝ้าสูงกว่าตัวเครื่อง (${Math.round(d.h * 100)} ซม.) และเปิดฝ้าได้ ทีมสำรวจยืนยัน`);
  } else {
    const side = Math.min(gaps.left.v, gaps.right.v);
    add(gaps.left.ok && gaps.right.ok ? 'ok' : 'warn', gaps.left.ok && gaps.right.ok ? `ระยะซ้าย–ขวาพอ (${Math.round(gaps.left.v * 100)} / ${Math.round(gaps.right.v * 100)} ซม.)` : `ชิดมุมห้องเกินไป (${Math.round(side * 100)} ซม.)`, `ค่าแนะนำทั่วไป ≥ ${Math.round(FIT_RULES[t].side * 100)} ซม. เพื่อลมเข้า–ออกสะดวกและถอดฝาล้างได้`);
    if (t === 'wall') {
      add(gaps.top.ok ? 'ok' : 'warn', gaps.top.ok ? `ห่างฝ้า ${Math.round(gaps.top.v * 100)} ซม.` : `ชิดฝ้าเกินไป (${Math.round(gaps.top.v * 100)} ซม.)`, `ช่องลมเข้าอยู่ด้านบนเครื่อง ค่าแนะนำทั่วไป ≥ ${Math.round(FIT_RULES.wall.top * 100)} ซม.`);
      const [b0, b1] = FIT_RULES.wall.bestBottom;
      add(!gaps.bottom.ok ? 'warn' : S.place.height < b0 || S.place.height > b1 ? 'info' : 'ok', `ใต้เครื่องสูงจากพื้น ${S.place.height.toFixed(2)} ม.`, !gaps.bottom.ok ? 'ต่ำเกินไป ลมเป่าตรงคนและชนเฟอร์นิเจอร์' : `ช่วงที่ลมกระจายดีโดยทั่วไป ${b0.toFixed(1)}–${b1.toFixed(1)} ม.`);
    }
    if (t === 'ceiling') add(gaps.bottom.ok ? 'ok' : 'warn', `ใต้เครื่องสูงจากพื้น ${gaps.bottom.v.toFixed(2)} ม.`, gaps.bottom.ok ? 'แขวนชิดฝ้า ลมพุ่งเกาะแนวฝ้าไปได้ไกล ห้ามมีคานหรือโคมไฟขวางแนวลม' : 'ฝ้าต่ำ ศีรษะอาจชนเครื่อง พิจารณาแอร์ติดผนังหรือสี่ทิศทาง');
    if (t === 'floor') add(gaps.top.ok ? 'ok' : 'warn', `เครื่องสูง ${d.h.toFixed(2)} ม. · เหลือถึงฝ้า ${Math.round(gaps.top.v * 100)} ซม.`, 'ลมออกด้านบนหน้าเครื่อง อย่าวางของบังหน้าเครื่องในระยะ 1 ม.');
  }
  // 5 · the room as furnished: tall pieces in the air path, comfort where the stream meets a bed / seat, window / door clash
  layoutChecks(S, { t, d, thr, add });
  // 4 · pipe run (estimate, from the route drawn in the room) → included 4 m, extra metres priced from the Pricebook pipe set of this size
  const plan = routePlan(S), o = S.outdoor;
  const len = plan.total;
  const extra = Math.max(0, Math.ceil(len - FIT_RULES.pipeIncluded));
  const pipeItem = addonsFor(t, btu)[0].items[0].item;
  const costInc = pipeItem && pipeItem.ex != null ? (pipeItem.ex * extra) : null;
  const ROUTE_TH = { direct: 'เจาะผนังหลังเครื่อง', surface: 'เดินลอยในรางครอบท่อ', ceiling: 'เดินเหนือฝ้า', concealed: 'ฝังในผนัง' };
  const exTh = WALLS.find(w => w.id === plan.exit.wall).th;
  add(extra ? 'info' : 'ok', extra ? `ท่อน้ำยาประมาณ ${len} ม. · เกินระยะที่รวม ${extra} ม.` : `ท่อน้ำยาประมาณ ${len} ม. อยู่ในระยะที่รวมในราคา (${FIT_RULES.pipeIncluded} ม.)`,
    `${ROUTE_TH[plan.mode]}${plan.mode === 'direct' ? '' : ` ออก${exTh}`} · ในห้อง ~${plan.inLen.toFixed(1)} ม. นอกอาคาร ~${plan.outLen.toFixed(1)} ม.` + (extra && costInc != null ? ` · ส่วนเกินประมาณ ${baht(costInc)} ก่อน VAT (${pipeItem.name})` : '') + ' · ช่างวัดระยะจริงหน้างาน');
  if (plan.mode !== plan.asked) {
    const why = plan.asked === 'ceiling' ? ['ห้องไม่มีฝ้า ท่อเดินลอยใต้เพดานในราง', 'แนวท่อปรับเป็นรางครอบท่อชิดเพดานให้อัตโนมัติ'] : t === 'cassette' ? ['แอร์สี่ทิศทางเดินท่อเหนือฝ้าเสมอ', 'ท่อออกจากตัวเครื่องเหนือฝ้า ไปออกผนังภายนอกที่ใกล้ที่สุดหรือจุดที่เลือก'] : ['ผนังหลังเครื่องไม่ใช่ผนังภายนอก', `เจาะออกตรงหลังเครื่องไม่ได้ ท่อเดินลอยในรางไปออก${exTh}ให้อัตโนมัติ · หรือย้ายแอร์ไปติดผนังภายนอก`];
    add(t !== 'cassette' && plan.asked === 'direct' ? 'warn' : 'info', why[0], why[1]);
  }
  if (len > 15) add('info', `ท่อยาว ~${len} ม.`, 'ทีมตรวจระยะท่อสูงสุด ต่างระดับ และน้ำยาที่อาจต้องเติมเพิ่ม ตามคู่มือของรุ่น (ประเมินหน้างาน)');
  // condensing unit: where it sits, how it is reached, how high above the ground
  const og = plan.outdoor.aboveGround, loc = OUT_LOCS.find(x => x.id === o.loc) || OUT_LOCS[2];
  const hard = o.loc === 'high' || o.loc === 'ledge' && S.site.floor > 1 || o.loc === 'bracket' && og > REACH;
  const LOC_D = { balcony: 'ช่างเดินถึงได้ ล้างและดูแลง่าย · เว้นที่ว่างหน้าเครื่องให้ลมร้อนออก', ledge: 'ช่างทำงานจากหน้าต่าง · หน้าเครื่องต้องโล่งให้ลมร้อนระบายออก ไม่ใช่ช่องปิดทึบ',
    bracket: 'ช่างเข้าถึงด้วยบันไดจากพื้น', high: '', roof: 'ตรวจทางขึ้นหลังคาและจุดผ่านกันซึม', ground: 'วางบนฐานที่พื้น ช่างเข้าถึงง่าย · ยกฐานกันน้ำขัง' };
  add(hard ? 'warn' : 'ok', `คอยล์ร้อน: ${loc.th}${og > 0.5 ? ` · สูงจากพื้นดิน ~${og.toFixed(1)} ม.` : ''}`, hard ? 'งานที่สูงหรือไม่มีที่ยืน ต้องใช้อุปกรณ์กันตก โรยตัว นั่งร้าน หรือกระเช้า ทั้งวันติดตั้งและทุกครั้งที่ล้าง · ประเมินหน้างาน' : LOC_D[o.loc]);
  // drain
  if (plan.needPump) add('warn', `น้ำทิ้งต้องใช้ปั๊ม (แนวท่อขึ้นสูงกว่าจุดน้ำทิ้ง ~${Math.round(plan.rise * 100)} ซม.)`, 'น้ำทิ้งไหลด้วยแรงโน้มถ่วงต้องลาดลงตลอดแนว · เลี่ยงปั๊มได้ถ้าเจาะออกหลังเครื่อง หรือแยกท่อน้ำทิ้งลงต่ำไปจุดระบายอื่น ทีมเลือกแนวที่เหมาะหน้างาน');
  // extra work this layout implies, priced only where the Pricebook has a price
  const works = siteWorks(S, plan).map(w => { const it = w.code ? DATA.instByCode[w.code] : null; const ex = it && it.ex != null && w.kind === 'price' ? it.ex * w.qty : it && it.ex != null && w.kind === 'opt' ? it.ex * w.qty : null; return { ...w, item: it || null, ex }; });
  works.filter(w => w.kind === 'warn').forEach(w => add('warn', w.th, w.why));
  const clash = plan.mode !== 'direct' && (S.furn || []).find(it => FURN[it.k].wallItem && it.wall === plan.exit.wall && Math.abs(it.along - plan.exit.along) < FURN[it.k].w / 2 + 0.1 && plan.exit.y > FURN[it.k].sill - 0.1 && plan.exit.y < FURN[it.k].sill + FURN[it.k].h + 0.1);
  if (clash) add('warn', `จุดเจาะท่อตรงกับ${FURN[clash.k].th}`, 'ย้ายจุดเจาะไปผนังทึบข้าง ๆ (ลากวงกลมสีส้มในภาพ หรือปรับในข้อ 4)');
  if (sku) {
    const mp = parseFloat(sku.d.maxPipe), ml = parseFloat(sku.d.maxLift), lift = Math.abs(plan.exit.y - plan.outdoor.valveY);
    if (mp && len > mp) add('warn', `ยาวเกินที่ผู้ผลิตกำหนด (${mp} ม.)`, 'ต้องย้ายตำแหน่งคอยล์ร้อนให้ใกล้ขึ้น');
    if (ml && lift > ml) add('warn', `ต่างระดับเกินที่ผู้ผลิตกำหนด (${ml} ม.)`, 'ต้องปรับตำแหน่งคอยล์ร้อน');
  }
  return { need, btu, ratio, throw: thr, depth, gaps, checks, pipe: { len, extra, item: pipeItem, costInc }, plan, works };
}

const pressAll = (g, list, v) => $$(':scope > button', g).forEach((b, i) => b.setAttribute('aria-pressed', String(list[i].id) === String(v)));
const seg = (list, val, on, label, cls = '') => {
  const g = h('div', { class: 'rf-seg ' + cls, role: 'group', 'aria-label': label });
  list.forEach(o => g.append(h('button', { type: 'button', 'aria-pressed': String(o.id) === String(val), onclick: () => { pressAll(g, list, o.id); on(o.id); } }, o.th)));
  g.set = v => pressAll(g, list, v);
  g.only = ids => $$(':scope > button', g).forEach((b, i) => { b.hidden = !!ids && !ids.includes(list[i].id); });
  return g;
};
// r7: option cards (name + one line of context) for site choices a customer may not know the word for
const opts = (list, val, on, label, cls = '') => {
  const g = h('div', { class: 'rf-opts ' + cls, role: 'group', 'aria-label': label });
  list.forEach(o => g.append(h('button', { type: 'button', 'aria-pressed': String(o.id) === String(val), onclick: () => { pressAll(g, list, o.id); on(o.id); } }, h('b', {}, o.th), o.sub ? h('small', {}, o.sub) : null)));
  g.set = v => pressAll(g, list, v);
  g.only = ids => $$(':scope > button', g).forEach((b, i) => { b.hidden = !!ids && !ids.includes(list[i].id); });
  return g;
};
let uid = 0;
function slider({ label, min, max, step, value, unit = 'ม.', fmt = v => v.toFixed(2), on }) {
  const id = `rf-${++uid}`;
  const out = h('output', { for: id }, fmt(value) + ' ' + unit);
  const inp = h('input', { type: 'range', id, min, max, step, value });
  const num = h('input', { type: 'number', min, max, step, value: fmt(value), 'aria-label': label, inputmode: 'decimal' });
  const set = (v, from) => { v = clamp(+v || 0, +inp.min, +inp.max); if (from !== inp) inp.value = v; if (from !== num) num.value = fmt(v); out.textContent = fmt(v) + ' ' + unit; on(v); };
  inp.addEventListener('input', () => set(+inp.value, inp));
  num.addEventListener('change', () => set(+num.value, num));
  const row = h('div', { class: 'rf-sl' }, h('label', { for: id }, label), inp, num, h('span', { class: 'rf-u' }, unit));
  row.set = (v, lo, hi) => { if (lo != null) { inp.min = lo; num.min = lo; } if (hi != null) { inp.max = hi; num.max = hi; } inp.value = v; num.value = fmt(+inp.value); out.textContent = fmt(+inp.value) + ' ' + unit; };
  return row;
}
const sub = (th, ...kids) => h('div', { class: 'rf-sub' }, h('h4', {}, th), ...kids);
const r2 = v => Math.round(v * 100) / 100;

export function mountRoomFit(root, { theme = 'light', onOpenModel, preset = 'bedroom' } = {}) {
  const S = {
    room: { w: 4.0, l: 3.5, h: 2.6 }, sun: 1, people: 2,
    sel: null, unit: { type: 'wall', dims: unitDims('wall', 12000), photo: null },
    place: { wall: 'back', along: 2.0, height: 2.1, gap: 0.03, cx: 0, cz: 0 },
    outdoor: { ...outdoorDefault(), auto: true }, site: siteDefault(), route: routeDefault(), drain: 'out',
    show: { air: true, dims: true, pipe: true }, photo: false,
    preset, furn: [], pick: null,
  };
  // a sample room never puts furniture where a floor-standing unit stands (or in the ~0.9 m of air in front of it)
  function layoutFor(id) {
    const list = presetLayout(id, S.room.w, S.room.l);
    if (S.unit.type !== 'floor') return list;
    const d = S.unit.dims, f = frame2(S.place.wall, S.room.w, S.room.l), a = clamp(S.place.along, d.w / 2, f.len - d.w / 2), dep = d.d / 2 + 0.45;
    const c = [f.o[0] + f.t[0] * a + f.n[0] * dep, f.o[1] + f.t[1] * a + f.n[1] * dep];
    const hx = Math.abs(f.t[0]) * (d.w / 2 + 0.2) + Math.abs(f.n[0]) * dep, hz = Math.abs(f.t[1]) * (d.w / 2 + 0.2) + Math.abs(f.n[1]) * dep;
    return list.filter(it => { if (FURN[it.k].wallItem || FURN[it.k].flat) return true; const fp = footprint(it); return !(Math.abs(it.x - c[0]) < fp.hx + hx && Math.abs(it.z - c[1]) < fp.hz + hz); });
  }
  S.furn = layoutFor(preset);
  let hatchPlaced = false, lastR = null, extSet = false;
  // outside walls until the visitor sets them: the unit's wall + walls with windows (+ the shop front)
  function guessExt() { if (extSet) return; const w = new Set([S.place.wall]); S.furn.forEach(it => { if (it.k === 'window') w.add(it.wall); }); if (S.preset === 'shop') w.add('front'); S.site.ext = ['back', 'right', 'front', 'left'].filter(x => w.has(x)); }
  guessExt();
  root.classList.add('rf'); root.innerHTML = '';
  /* ----- stage ----- */
  const host = h('div', { class: 'rf-host' });
  const fb = h('p', { class: 'rf-fallback', hidden: true }, 'อุปกรณ์นี้แสดงภาพ 3 มิติไม่ได้ ผลตรวจและราคาด้านข้างยังใช้ได้ครบ');
  const viewSeg = seg([{ id: 'iso', th: '3 มิติ' }, { id: 'top', th: 'มุมบน' }, { id: 'front', th: 'มองตรงผนัง' }, { id: 'out', th: 'ด้านนอก' }], 'iso', v => V3 && V3.view(v), 'มุมมอง', 'rf-views');
  const tog = (k, th) => { const id = `rf-t-${k}-${++uid}`; const cb = h('input', { type: 'checkbox', id, checked: k === 'photo' ? S.photo : S.show[k] }); cb.addEventListener('change', () => { if (k === 'photo') S.photo = cb.checked; else S.show[k] = cb.checked; sync(); }); return h('label', { class: 'rf-tog', for: id }, cb, th); };
  const photoTog = tog('photo', 'ภาพจริงของรุ่น');
  const toggles = h('div', { class: 'rf-togs' }, tog('air', 'ลมเย็น'), tog('dims', 'ระยะ'), tog('pipe', 'แนวท่อ · คอยล์ร้อน'), photoTog);
  const read = h('div', { class: 'rf-read', 'aria-live': 'polite' });
  const stage = h('div', { class: 'rf-stage' }, host, fb, h('div', { class: 'rf-bar' }, viewSeg, toggles), read,
    h('p', { class: 'rf-cap' }, 'แบบจำลองเพื่ออธิบาย · ขนาดเครื่องตามสเปกผู้ผลิตเมื่อมีข้อมูล · เฟอร์นิเจอร์ขนาดมาตรฐานจริง · ระยะ แนวท่อ และความยาวท่อเป็นค่าประมาณ ทีมช่างยืนยันหน้างาน'));
  /* ----- side panel ----- */
  const side = h('div', { class: 'rf-side' });
  root.append(stage, side);

  // 1 · model
  const typeSeg = seg(FIT_TYPES.map(id => ({ id, th: TYPE_BY_ID[id].th })), S.unit.type, v => { S.unit.type = v; S.sel = null; pickBest(); renderPick(); sync(); }, 'ประเภทแอร์', 'rf-types');
  const q = h('input', { type: 'search', class: 'rf-q', placeholder: 'ค้นหารุ่น แบรนด์ หรือ BTU', 'aria-label': 'ค้นหารุ่นแอร์' });
  const list = h('div', { class: 'rf-list', role: 'list' });
  const selBox = h('div', { class: 'rf-selm' });
  const fj = BRAND_BY_ID.fujiva;
  const fjNote = fj && !fj.n ? h('p', { class: 'rf-fj' }, h('b', {}, 'FUJIVA'), ' แบรนด์ของเรา · ข้อมูลรุ่นกำลังนำเข้า ', h('button', { type: 'button', class: 'rf-link', onclick: () => { const need = fitCheck(S).need; const i = FUJIVA_PREVIEW.skus.findIndex(k => k.btu >= need); setModel(FUJIVA_PREVIEW, i < 0 ? 3 : i); } }, 'ลองตัวเครื่อง FUJIVA'), ' · ', h('button', { type: 'button', class: 'rf-link', onclick: () => askTeam('FUJIVA', 'สนใจ FUJIVA สำหรับ' + roomText()) }, 'สอบถาม FUJIVA')) : null;
  q.addEventListener('input', renderPick);
  side.append(h('section', { class: 'rf-sec' }, h('h3', {}, h('span', {}, '1'), 'เลือกแอร์'), typeSeg, selBox, q, list, fjNote));

  // 2 · room + building (r7: storey, ceiling type, void above the ceiling, wall material)
  const sw = slider({ label: 'กว้าง', min: 2, max: 15, step: 0.1, value: S.room.w, on: v => resizeRoom('w', v) });
  const sl = slider({ label: 'ยาว (ลึก)', min: 2, max: 20, step: 0.1, value: S.room.l, on: v => resizeRoom('l', v) });
  const sh = slider({ label: 'สูงถึงฝ้า', min: 2.3, max: 5, step: 0.05, value: S.room.h, on: v => resizeRoom('h', v) });
  const sp = slider({ label: 'จำนวนคน', min: 1, max: 30, step: 1, value: S.people, unit: 'คน', fmt: v => String(Math.round(v)), on: v => { S.people = Math.round(v); sync(); } });
  const sunSeg = seg(SUN, S.sun, v => { S.sun = +v; sync(); }, 'แดด', 'rf-sun');
  const bldOpts = opts(BUILDINGS, S.site.building, v => { S.site.building = v; sync(); }, 'ประเภทอาคาร', 'two');
  const sFloor = slider({ label: 'ห้องอยู่ชั้นที่', min: 1, max: 60, step: 1, value: S.site.floor, unit: 'ชั้น', fmt: v => String(Math.round(v)), on: v => { S.site.floor = Math.round(v); sync(); } });
  const ceilOpts = opts(CEILINGS, S.site.ceiling, v => { S.site.ceiling = v; reclamp(); sync(); }, 'ชนิดฝ้า');
  const sPlenum = slider({ label: 'ช่องว่างเหนือฝ้า', min: 0.1, max: 1.5, step: 0.05, value: S.site.plenum, on: v => { S.site.plenum = v; sync(); } });
  const wallOpts = opts(WALL_MATS, S.site.wallMat, v => { S.site.wallMat = v; sync(); }, 'วัสดุผนังที่เจาะท่อ', 'two');
  // r7: which walls face the outside — pipes can only leave the building through these
  const extBox = h('div', { class: 'rf-chips', role: 'group', 'aria-label': 'ผนังที่ติดภายนอกอาคาร' });
  WALLS.forEach(w => extBox.append(h('button', { type: 'button', 'aria-pressed': S.site.ext.includes(w.id), onclick: e => { const on = !S.site.ext.includes(w.id); if (!on && S.site.ext.length === 1) { toast('ต้องมีผนังภายนอกอย่างน้อย 1 ด้าน'); return; } S.site.ext = on ? [...S.site.ext, w.id] : S.site.ext.filter(x => x !== w.id); extSet = true; e.currentTarget.setAttribute('aria-pressed', on); if (S.route.exit && !S.site.ext.includes(S.route.exit.wall)) S.route.exit = null; sync(); } }, w.th)));
  extBox.set = () => $$(':scope > button', extBox).forEach((b, i) => b.setAttribute('aria-pressed', S.site.ext.includes(WALLS[i].id)));
  side.append(h('section', { class: 'rf-sec' }, h('h3', {}, h('span', {}, '2'), 'ห้องและอาคาร'), sw, sl, sh, sp, sunSeg,
    sub('อาคาร', bldOpts, sFloor), sub('ฝ้าเพดาน', ceilOpts, sPlenum, h('p', { class: 'rf-note' }, 'ช่องว่างเหนือฝ้า = จากแผ่นฝ้าถึงพื้นชั้นบนหรือโครงหลังคา (ไม่แน่ใจใส่ค่าโดยประมาณ ทีมวัดจริงตอนสำรวจ)')), sub('ผนังที่ติดภายนอกอาคาร', extBox, h('p', { class: 'rf-note' }, 'ท่อออกนอกอาคารได้เฉพาะผนังเหล่านี้ · ผนังที่ติดห้องอื่นหรือทางเดินให้กดออก (ในภาพ 3 มิติ ผนังภายนอกมีแถบสีส้มบนสัน)')), sub('ผนังที่เจาะท่อ', wallOpts)));

  // furnish (room planner) — under the view it drives
  const presetSeg = h('div', { class: 'rf-chips', role: 'group', 'aria-label': 'ห้องตัวอย่าง' });
  PRESETS.forEach(pr => presetSeg.append(h('button', { type: 'button', 'aria-pressed': pr.id === S.preset, onclick: () => applyPreset(pr.id) }, pr.th)));
  const catBox = h('div', { class: 'rf-cat' });
  FURN_GROUPS.forEach(([g, th]) => catBox.append(h('div', { class: 'rf-cat-g' }, h('b', {}, th), ...Object.keys(FURN).filter(k => FURN[k].g === g).map(k => h('button', { type: 'button', class: 'rf-chip', onclick: () => addFurn(k) }, '+ ', FURN[k].th)))));
  const items = h('ul', { class: 'rf-items', 'aria-label': 'ของในห้อง' });
  const furnSec = h('section', { class: 'rf-sec rf-furn' }, h('h3', {}, 'จัดห้องของคุณ'),
    h('p', { class: 'rf-note' }, 'เลือกห้องตัวอย่างหรือเพิ่มเฟอร์นิเจอร์ แล้ว', h('b', {}, 'ลากในภาพ 3 มิติ'), 'เพื่อจัดวางให้ตรงห้องจริง · มือถือ: แตะเลือกแล้วลาก · ลากแอร์ หน้าต่าง ประตู เลยมุมห้องเพื่อย้ายไปผนังถัดไป · ห้องตัวอย่างจัดเฟอร์นิเจอร์ใหม่ตามขนาดห้องที่ปรับ'),
    presetSeg, h('details', { class: 'rf-add' }, h('summary', {}, 'เพิ่มเฟอร์นิเจอร์ · หน้าต่าง · ประตู'), catBox), items);
  stage.append(furnSec);
  const nameOf = it => FURN[it.k].th + (FURN[it.k].wallItem ? ` · ${WALLS.find(w => w.id === it.wall).th}` : '');
  function renderItems() {
    items.innerHTML = '';
    $$('button', presetSeg).forEach((b, i) => b.setAttribute('aria-pressed', PRESETS[i].id === S.preset));
    if (!S.furn.length) { items.append(h('li', { class: 'rf-note' }, 'ห้องว่าง · เพิ่มเฟอร์นิเจอร์จากรายการด้านบน')); return; }
    S.furn.forEach(it => items.append(h('li', { class: S.pick === it.id ? 'on' : '' },
      h('button', { type: 'button', class: 'rf-it', 'aria-pressed': S.pick === it.id, onclick: () => pick(S.pick === it.id ? null : it.id) }, nameOf(it)),
      FURN[it.k].wallItem ? h('button', { type: 'button', class: 'rf-ib', 'aria-label': `ย้าย${FURN[it.k].th}ไปผนังถัดไป`, onclick: () => nextWall(it.id) }, 'ผนังถัดไป') : h('button', { type: 'button', class: 'rf-ib', 'aria-label': `หมุน${FURN[it.k].th} 90 องศา`, onclick: () => rotateFurn(it.id) }, 'หมุน'),
      h('button', { type: 'button', class: 'rf-ib del', 'aria-label': `ลบ${FURN[it.k].th}`, onclick: () => removeFurn(it.id) }, 'ลบ'))));
  }
  const unitAvoid = it => { if (S.unit.type === 'cassette' || it.wall !== S.place.wall) return false; return Math.abs(it.along - S.place.along) < FURN[it.k].w / 2 + S.unit.dims.w / 2 + 0.1; };
  // keep the ids of pieces that survive a re-layout (the 3D view rebuilds only what changed)
  function keepIds(old, next) { const pool = {}; old.forEach(o => (pool[o.k] = pool[o.k] || []).push(o.id)); next.forEach(it => { const p = pool[it.k]; if (p && p.length) it.id = p.shift(); }); }
  function applyPreset(id) { const old = S.furn; S.preset = id; S.furn = layoutFor(id); keepIds(old, S.furn); S.pick = null; V3 && V3.select(null); guessExt(); extBox.set(); renderItems(); sync(); }
  function addFurn(k) {
    const it = freeSpot(k, S.furn, S.room.w, S.room.l, FURN[k].wallItem ? unitAvoid : null); it.id = newId(); S.furn.push(it); S.preset = null;
    pick(it.id); renderItems(); sync(); toast(`วาง${FURN[k].th}แล้ว · ลากในภาพเพื่อย้าย`);
  }
  function rotateFurn(id) { const it = S.furn.find(o => o.id === id); if (!it) return; it.q = ((it.q || 0) + 1) % 4; clampItem(it, S.room.w, S.room.l); S.preset = null; renderItems(); sync(); }
  function nextWall(id) { const it = S.furn.find(o => o.id === id); if (!it) return; const order = ['back', 'right', 'front', 'left']; it.wall = order[(order.indexOf(it.wall) + 1) % 4]; it.along = frame2(it.wall, S.room.w, S.room.l).len / 2; clampItem(it, S.room.w, S.room.l); S.preset = null; renderItems(); sync(); }
  function removeFurn(id) { S.furn = S.furn.filter(o => o.id !== id); if (S.pick === id) { S.pick = null; V3 && V3.select(null); } S.preset = null; renderItems(); sync(); }
  function pick(id) { S.pick = id; V3 && V3.select(id); renderItems(); }
  function fitFurn() { S.furn.forEach(it => clampItem(it, S.room.w, S.room.l)); }
  // r7: a resized room keeps its proportions — a sample room is laid out again for the new size (more desks, aisles, seats),
  // a room the visitor arranged keeps each piece against its wall / in its relative place; the AC, pipe exit and hatch follow
  function resizeRoom(k, v) {
    const W0 = S.room.w, L0 = S.room.l; S.room[k] = v;
    if (k !== 'h' && (W0 !== S.room.w || L0 !== S.room.l)) {
      const W1 = S.room.w, L1 = S.room.l, len = (w, a, b) => frame2(w, a, b).len;
      if (S.preset) { const old = S.furn; S.furn = layoutFor(S.preset); keepIds(old, S.furn); }
      else resizeLayout(S.furn, W0, L0, W1, L1);
      S.place.along *= len(S.place.wall, W1, L1) / len(S.place.wall, W0, L0); S.place.cx *= W1 / W0; S.place.cz *= L1 / L0;
      if (S.route.exit) S.route.exit.along *= len(S.route.exit.wall, W1, L1) / len(S.route.exit.wall, W0, L0);
      S.site.hatch.x *= W1 / W0; S.site.hatch.z *= L1 / L0;
      if (S.pick && !S.furn.some(it => it.id === S.pick)) { S.pick = null; V3 && V3.select(null); }
      renderItems();
    }
    reclamp(); fitFurn(); sync();
  }
  renderItems();

  // 3 · position
  const wallSeg = seg(WALLS, S.place.wall, v => { S.place.wall = v; S.place.along = wallLen() / 2; guessExt(); extBox.set(); reclamp(); sync(); if (V3) V3.view('iso'); }, 'ผนังที่ติดตั้ง', 'rf-walls');
  const sAlong = slider({ label: 'กึ่งกลางเครื่องห่างมุมซ้าย', min: 0.4, max: 4, step: 0.05, value: S.place.along, on: v => { S.place.along = v; sync(); } });
  const sHeight = slider({ label: 'ใต้เครื่องสูงจากพื้น', min: 1.5, max: 2.5, step: 0.05, value: S.place.height, on: v => { S.place.height = v; sync(); } });
  const sGap = slider({ label: 'ห่างจากฝ้า', min: 0, max: 0.4, step: 0.01, value: S.place.gap, on: v => { S.place.gap = v; sync(); } });
  const sCx = slider({ label: 'กึ่งกลางเครื่องห่างผนังซ้าย', min: 0.5, max: 4, step: 0.05, value: S.room.w / 2, on: v => { S.place.cx = v - S.room.w / 2; sync(); } });
  const sCz = slider({ label: 'กึ่งกลางเครื่องห่างผนังหลัง', min: 0.5, max: 4, step: 0.05, value: S.room.l / 2, on: v => { S.place.cz = v - S.room.l / 2; sync(); } });
  const center = h('button', { type: 'button', class: 'rf-link', onclick: () => { if (S.unit.type === 'cassette') { S.place.cx = 0; S.place.cz = 0; } else S.place.along = wallLen() / 2; reclamp(); sync(); } }, 'วางกึ่งกลาง');
  side.append(h('section', { class: 'rf-sec' }, h('h3', {}, h('span', {}, '3'), 'ตำแหน่งติดตั้ง', center), wallSeg, sAlong, sHeight, sGap, sCx, sCz,
    h('p', { class: 'rf-note' }, 'ลากตัวแอร์ในภาพเพื่อเลื่อน · ลากเลยมุมห้องเพื่อย้ายไปผนังถัดไป')));

  // 4 · refrigerant route · drain · power (r7)
  const routeOpts = opts(ROUTES, S.route.mode, v => { S.route.mode = v; if (v === 'direct') S.route.exit = null; if (v === 'ceiling' && S.site.hatch.mode === 'none' && S.site.ceiling === 'smooth') { S.site.hatch.mode = 'new'; placeHatch(); } sync(); }, 'แนวเดินท่อในห้อง');
  const exitSeg = seg(WALLS, 'left', v => { S.route.exit = { wall: v, along: r2(frame2(v, S.room.w, S.room.l).len / 2) }; sync(); }, 'ผนังที่เจาะท่อออก', 'rf-walls');
  const sExit = slider({ label: 'จุดเจาะห่างมุมซ้ายของผนัง', min: 0.15, max: 4, step: 0.05, value: 1, on: v => { const p = lastR ? lastR.plan : routePlan(S); S.route.exit = { wall: p.exit.wall, along: v }; sync(); } });
  const exitBox = sub('จุดเจาะท่อออกนอกอาคาร', exitSeg, sExit, h('p', { class: 'rf-note' }, 'ลากวงกลมสีส้มบนผนังในภาพเพื่อย้ายจุดเจาะ · ลากเลยมุมห้องเพื่อไปผนังถัดไป'));
  const hatchSeg = seg(HATCHES, S.site.hatch.mode, v => { S.site.hatch.mode = v; if (v !== 'none' && !hatchPlaced) placeHatch(); sync(); }, 'ช่องเซอร์วิสบนฝ้า');
  const hatchBox = sub('ช่องเซอร์วิสบนฝ้า', hatchSeg, h('p', { class: 'rf-note' }, 'ฝ้าฉาบเรียบต้องมีช่องเปิด (ปกติ 60×60 ซม.) ไว้เข้าถึงข้อต่อและท่อน้ำทิ้งตอนล้างหรือซ่อม · ลากช่องในภาพไปจุดที่ต้องการ'));
  const drainOpts = opts(DRAINS, S.drain, v => { S.drain = v; sync(); }, 'ปลายทางน้ำทิ้ง');
  const sDb = slider({ label: 'ระยะเดินสายไฟจากตู้ไฟถึงแอร์', min: 1, max: 60, step: 1, value: S.site.db, unit: 'ม.', fmt: v => String(Math.round(v)), on: v => { S.site.db = Math.round(v); sync(); } });
  const routeNote = h('p', { class: 'rf-note rf-rn', 'aria-live': 'polite' });
  side.append(h('section', { class: 'rf-sec' }, h('h3', {}, h('span', {}, '4'), 'แนวท่อ น้ำทิ้ง และไฟ'), routeOpts, routeNote, exitBox, hatchBox,
    sub('น้ำทิ้ง', drainOpts), sub('ไฟฟ้า', sDb, h('p', { class: 'rf-note' }, 'ราคาติดตั้งมาตรฐานรวมสายไฟไม่เกิน 10 ม. · ขนาดสายและเบรกเกอร์ทีมยืนยันตามกระแสของรุ่น'))));
  function placeHatch() {
    const p = routePlan(S), d = S.unit.dims; let x, z;
    if (p.port.cas) { const e = p.pts[p.pts.length - 1], dx = e[0] - p.port.cx, dz = e[2] - p.port.cz, n = Math.hypot(dx, dz) || 1; x = p.port.cx + dx / n * (d.w / 2 + 0.6); z = p.port.cz + dz / n * (d.w / 2 + 0.6); }
    else { const f = frame2(S.place.wall, S.room.w, S.room.l); x = p.port.x + f.n[0] * 0.55; z = p.port.z + f.n[1] * 0.55; }
    S.site.hatch.x = r2(clamp(x, -S.room.w / 2 + 0.35, S.room.w / 2 - 0.35)); S.site.hatch.z = r2(clamp(z, -S.room.l / 2 + 0.35, S.room.l / 2 - 0.35)); hatchPlaced = true;
  }

  // 5 · condensing unit (r7: where it really sits — balcony with access, ledge without, bracket, high bracket, roof, ground)
  const locOpts = opts(OUT_LOCS, S.outdoor.loc, v => { S.outdoor.loc = v; S.outdoor.auto = true; sync(); }, 'ตำแหน่งคอยล์ร้อน', 'two');
  const sideSeg = seg([{ id: 'left', th: 'ไปทางซ้าย' }, { id: 'right', th: 'ไปทางขวา' }], S.outdoor.side, v => { S.outdoor.side = v; S.outdoor.sideSet = true; sync(); }, 'ทิศทางคอยล์ร้อนจากจุดเจาะ (มองจากในห้อง)');
  const sRun = slider({ label: 'ห่างจากจุดเจาะตามแนวผนัง', min: 0, max: 15, step: 0.1, value: S.outdoor.run, on: v => { S.outdoor.run = v; sync(); } });
  const sDrop = slider({ label: 'ฐานคอยล์ร้อนต่ำกว่าจุดเจาะ (ติดลบ = สูงกว่า)', min: -8, max: 60, step: 0.1, value: S.outdoor.drop, on: v => { S.outdoor.drop = v; S.outdoor.auto = false; sync(); } });
  const outNote = h('p', { class: 'rf-note', 'aria-live': 'polite' });
  side.append(h('section', { class: 'rf-sec' }, h('h3', {}, h('span', {}, '5'), 'คอยล์ร้อนวางตรงไหน'), locOpts, sideSeg, sRun, sDrop, outNote));

  // 6 · result
  const sum = h('p', { class: 'rf-sum' });
  const ul = h('ul', { class: 'rf-checks' });
  const worksUl = h('ul', { class: 'rf-works' });
  const worksBox = h('div', { class: 'rf-wk' }, h('h4', {}, 'งานเพิ่มตามแบบห้องนี้'), worksUl);
  const price = h('div', { class: 'rf-price', 'aria-live': 'polite' });
  const sendBox = h('div', { class: 'rf-send' });
  const codeOut = h('input', { type: 'text', class: 'rf-code', readonly: true, 'aria-label': 'รหัสแบบห้อง' });
  const codeIn = h('input', { type: 'text', class: 'rf-code', placeholder: 'วางรหัสแบบห้อง SBP1.…', 'aria-label': 'วางรหัสแบบห้องเพื่อเปิด' });
  const codeMsg = h('p', { class: 'rf-note', 'aria-live': 'polite' });
  const codeBox = h('details', { class: 'rf-add rf-codes' }, h('summary', {}, 'รหัสแบบห้อง · บันทึกหรือเปิดแบบเดิม'),
    h('div', { class: 'rf-cat' }, h('p', { class: 'rf-note' }, 'รหัสนี้เก็บขนาดห้อง เฟอร์นิเจอร์ ตำแหน่งแอร์ แนวท่อ และคอยล์ร้อนไว้ทั้งหมด ทีมเปิดรหัสเดียวกันแล้วเห็นแบบเดียวกับคุณ'),
      h('div', { class: 'rf-crow' }, codeOut, h('button', { type: 'button', class: 's-btn', onclick: async () => { codeOut.value = encodeLayout(S); codeMsg.textContent = (await copyText(codeOut.value, codeOut)) ? 'คัดลอกรหัสแล้ว' : 'คัดลอกอัตโนมัติไม่ได้ รหัสถูกเลือกไว้แล้ว กดคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก')),
      h('div', { class: 'rf-crow' }, codeIn, h('button', { type: 'button', class: 's-btn', onclick: () => importCode(codeIn.value) }, 'เปิดแบบ')), codeMsg));
  codeBox.addEventListener('toggle', () => { if (codeBox.open) codeOut.value = encodeLayout(S); });
  const ctas = h('div', { class: 'rf-ctas' },
    h('button', { type: 'button', class: 's-btn primary', onclick: addQuote }, 'ใส่ใบเสนอราคา'),
    h('button', { type: 'button', class: 's-btn', onclick: sendLayout }, 'ส่งแบบห้องให้ทีมประเมิน'),
    h('button', { type: 'button', class: 's-btn', onclick: () => { if (S.sel && S.sel.m.preview) askTeam('FUJIVA'); else if (S.sel && onOpenModel) onOpenModel(S.sel.m, S.sel.si); } }, 'รายละเอียดรุ่น'),
    h('button', { type: 'button', class: 's-btn ghost', onclick: () => { cart.add({ kind: 'survey', group: 'install', key: `SV-FIT-${roomText()}`, name: 'ขอสำรวจหน้างานติดตั้ง', detail: `${roomText()} · ${S.sel ? BRAND_BY_ID[S.sel.m.brand].name + ' ' + S.sel.m.skus[S.sel.si].sku : TYPE_BY_ID[S.unit.type].th} · รหัสแบบห้อง ${encodeLayout(S)}`, unitEx: null, qty: 1 }); toast('เพิ่มคำขอสำรวจในใบเสนอราคาแล้ว'); } }, 'ขอสำรวจหน้างาน'));
  stage.append(h('section', { class: 'rf-sec rf-res' }, h('h3', {}, h('span', {}, '6'), 'ผลตรวจและงานเพิ่ม'), sum, ul, worksBox, price, ctas, sendBox, codeBox));

  const roomText = () => `ห้อง ${S.room.w.toFixed(1)}×${S.room.l.toFixed(1)}×${S.room.h.toFixed(2)} ม.`;
  const wallLen = () => (S.place.wall === 'left' || S.place.wall === 'right' ? S.room.l : S.room.w);
  function reclamp() {
    const d = S.unit.dims, t = S.unit.type, L = wallLen();
    S.place.along = clamp(S.place.along, d.w / 2, L - d.w / 2);
    sAlong.set(S.place.along, r1(d.w / 2), r1(L - d.w / 2));
    const hiH = Math.max(1.5, S.room.h - d.h);
    S.place.height = clamp(S.place.height, 1.2, hiH); sHeight.set(S.place.height, 1.2, hiH.toFixed(2));
    const ph = d.w / 2 + FIT_RULES.cassette.panel / 2;
    S.place.cx = clamp(S.place.cx, -S.room.w / 2 + ph, S.room.w / 2 - ph); S.place.cz = clamp(S.place.cz, -S.room.l / 2 + ph, S.room.l / 2 - ph);
    sCx.set(S.place.cx + S.room.w / 2, r1(ph), r1(S.room.w - ph)); sCz.set(S.place.cz + S.room.l / 2, r1(ph), r1(S.room.l - ph));
    if (S.route.exit) { const el = frame2(S.route.exit.wall, S.room.w, S.room.l).len; S.route.exit.along = clamp(S.route.exit.along, 0.15, el - 0.15); }
    S.site.hatch.x = clamp(S.site.hatch.x, -S.room.w / 2 + 0.35, S.room.w / 2 - 0.35); S.site.hatch.z = clamp(S.site.hatch.z, -S.room.l / 2 + 0.35, S.room.l / 2 - 0.35);
    const cas = t === 'cassette';
    wallSeg.hidden = cas; sAlong.hidden = cas; sCx.hidden = !cas; sCz.hidden = !cas; sHeight.hidden = t !== 'wall'; sGap.hidden = t !== 'ceiling';
    wallSeg.set(S.place.wall);
    sPlenum.hidden = S.site.ceiling === 'none';
    routeOpts.only(cas ? ['surface', 'ceiling'] : null);
  }
  // the site controls that depend on the route plan (exit wall, hatch, drop range) follow it after each check
  function renderSite(R) {
    const p = R.plan, cas = S.unit.type === 'cassette';
    routeOpts.set(p.mode);
    exitBox.hidden = p.mode === 'direct';
    exitSeg.set(p.exit.wall); const el = frame2(p.exit.wall, S.room.w, S.room.l).len; sExit.set(p.exit.along, 0.15, r1(el - 0.15));
    hatchBox.hidden = !(S.site.ceiling === 'smooth' && (p.mode === 'ceiling' || cas));
    hatchSeg.set(S.site.hatch.mode);
    sideSeg.set(S.outdoor.side);
    sDrop.set(S.outdoor.drop, -(S.room.h + 6), Math.max(12, Math.ceil((Math.max(1, S.site.floor) - 1) * STOREY + p.exit.y + 2)));
    const by = p.by, parts = [by.trunk + by.up > 0.05 ? `รางครอบท่อ ~${(by.trunk + by.up).toFixed(1)} ม.` : '', by.ceil > 0.05 ? `เหนือฝ้า ~${by.ceil.toFixed(1)} ม.` : '', by.chase > 0.05 ? `ฝังผนัง ~${by.chase.toFixed(1)} ม.` : ''].filter(Boolean);
    routeNote.textContent = p.mode === 'direct' ? `เจาะผนังตรงหลังเครื่อง ท่อออกนอกอาคารทันที · ท่อรวมประมาณ ${p.total} ม.` : `ในห้อง ~${p.inLen.toFixed(1)} ม. (${parts.join(' · ') || 'สั้นมาก'}) → เจาะออก${WALLS.find(w => w.id === p.exit.wall).th} · ท่อรวมประมาณ ${p.total} ม.${p.needPump ? ' · น้ำทิ้งต้องใช้ปั๊ม' : ''}`;
    const og = p.outdoor.aboveGround;
    outNote.textContent = `ฐานคอยล์ร้อน${S.outdoor.drop >= 0 ? 'ต่ำกว่า' : 'สูงกว่า'}จุดเจาะ ${Math.abs(S.outdoor.drop).toFixed(1)} ม. · สูงจากพื้นดินประมาณ ${Math.max(0, og).toFixed(1)} ม. (ชั้น ${S.site.floor} · คิดชั้นละ ${STOREY} ม.)` + (S.outdoor.auto ? ' · ค่าตามตำแหน่งที่เลือก ปรับเองได้' : '');
  }

  // model list: sized for the room unless the visitor searches
  const allSkus = () => DEMO.models.flatMap(m => m.skus.map((s, si) => ({ m, s, si })));
  function pickBest() {
    const need = recommendBtu({ w: S.room.w, d: S.room.l, h: S.room.h, sun: S.sun, people: S.people }).btu;
    const c = allSkus().filter(x => x.m.type === S.unit.type).sort((a, b) => Math.abs(a.s.btu - need * 1.05) - Math.abs(b.s.btu - need * 1.05) || a.s.price - b.s.price)[0];
    if (c) setModel(c.m, c.si, true);
  }
  function renderPick() {
    list.innerHTML = '';
    const qq = q.value.trim().toLowerCase().replace(/[\s,\-\/]/g, '');
    const need = recommendBtu({ w: S.room.w, d: S.room.l, h: S.room.h, sun: S.sun, people: S.people }).btu;
    let c = allSkus();
    if (qq) c = c.filter(x => (BRAND_BY_ID[x.m.brand].name + x.m.series + x.s.sku + x.s.btu + TYPE_BY_ID[x.m.type].th).toLowerCase().replace(/[\s,\-\/]/g, '').includes(qq));
    else c = c.filter(x => x.m.type === S.unit.type).sort((a, b) => Math.abs(a.s.btu - need) - Math.abs(b.s.btu - need) || a.s.price - b.s.price);
    const seen = new Set(); const out = [];
    for (const x of c) { const k = x.m.id + (qq ? x.s.sku : ''); if (seen.has(k)) continue; seen.add(k); out.push(x); if (out.length >= 6) break; }
    if (!out.length) list.append(h('p', { class: 'rf-note' }, 'ไม่พบรุ่นที่ค้นหา'));
    out.forEach(x => {
      const on = S.sel && S.sel.m === x.m && S.sel.si === x.si;
      list.append(h('div', { role: 'listitem', class: 'rf-li' }, h('button', { type: 'button', class: 'rf-item', 'aria-pressed': on, onclick: () => { setModel(x.m, x.si); } },   // r6: the list item wraps the button (a button cannot carry role=listitem + aria-pressed)
        h('b', {}, BRAND_BY_ID[x.m.brand].name, ' ', x.s.sku), h('small', {}, `${TYPE_BY_ID[x.m.type].th} · ${btuFmt(x.s.btu)} · ${baht(x.s.price)}`))));
    });
  }
  function renderSel() {
    selBox.innerHTML = '';
    if (!S.sel) { selBox.append(h('p', { class: 'rf-note' }, 'ยังไม่ได้เลือกรุ่น')); return; }
    const { m, si } = S.sel, s = m.skus[si], d = S.unit.dims;
    selBox.append(productVisual(m, s, { size: 'thumb' }),
      h('div', {}, h('p', { class: 'rf-br' }, BRAND_BY_ID[m.brand].name, ' · ', TYPE_BY_ID[m.type].th, m.inverter ? ' · Inverter' : ''), h('b', { class: 'rf-sku' }, s.sku), h('p', { class: 'rf-meta' }, `${btuFmt(s.btu)} · ${s.price == null ? 'ราคากำลังนำเข้า' : baht(s.price) + ' ก่อน VAT'}`),
        h('p', { class: 'rf-dims' + (d.src === 'est' ? ' est' : '') }, `กว้าง ${Math.round(d.w * 100)} · สูง ${Math.round(d.h * 100)} · ลึก ${Math.round(d.d * 100)} ซม.`, h('small', {}, d.src === 'spec' ? ' ตามสเปกผู้ผลิต' : ' ขนาดโดยประมาณ · รอสเปกรุ่น'))));
  }
  function setModel(m, si = 0, quiet = false) {
    const s = m.skus[si];
    const prevType = S.unit.type;
    S.sel = { m, si };
    S.unit = { type: m.type === 'duct' ? 'ceiling' : m.type, dims: unitDims(m.type, s.btu, s.d.indoorDim), photo: (photosFor(m, s)[0] || {}).src || null, logo: m.brand === 'fujiva' };
    if (!S.unit.photo) S.photo = false;
    if (S.unit.type !== prevType) {   // fresh, sensible placement for the new type
      const d = S.unit.dims;
      S.place.height = clamp(S.room.h - 0.25 - d.h, 1.9, 2.4); S.place.gap = FIT_RULES.ceiling.gap; S.place.cx = 0; S.place.cz = 0; S.place.along = wallLen() / 2;
      if (S.unit.type === 'cassette' && S.route.mode !== 'surface') S.route.mode = 'ceiling';
      if (prevType === 'cassette' && S.unit.type !== 'cassette' && S.route.mode === 'ceiling') { S.route.mode = 'direct'; S.route.exit = null; }
      if (S.preset && (S.unit.type === 'floor' || prevType === 'floor')) { const old = S.furn; S.furn = layoutFor(S.preset); keepIds(old, S.furn); renderItems(); }
    }
    photoTog.querySelector('input').checked = S.photo; photoTog.querySelector('input').disabled = !S.unit.photo; photoTog.title = S.unit.photo ? '' : 'ยังไม่มีภาพจริงของรุ่นนี้';
    typeSeg.set(S.unit.type);
    reclamp(); renderSel(); renderPick();
    if (!quiet) sync();
  }

  // the extra work list: Pricebook price (round hundred, before VAT — r9) or "ประเมินหน้างาน"; 'opt' = only if the building requires it
  function worksTotal(R) { return R.works.filter(w => w.kind === 'price' && w.ex != null).reduce((a, w) => a + w.ex, 0); }
  function render(R) {
    lastR = R;
    const n = R.checks.filter(c => c.ok === 'warn').length;
    sum.textContent = n ? `ควรปรับ ${n} จุด · ผลตรวจ ${R.checks.length} ข้อ` : `วางได้ดี · ผ่านทุกข้อที่ตรวจ (${R.checks.length} ข้อ)`;
    sum.className = 'rf-sum ' + (n ? 'warn' : 'ok');
    ul.innerHTML = '';
    R.checks.forEach(c => ul.append(h('li', { class: c.ok }, h('i', { 'aria-hidden': 'true' }, icon(c.ok === 'ok' ? 'check' : c.ok === 'warn' ? 'warn' : 'info', { size: 15 })), h('div', {}, h('b', {}, c.th), h('span', {}, c.d)))));
    worksUl.innerHTML = '';
    const shown = R.works.filter(w => w.kind !== 'warn');
    if (!shown.length) worksUl.append(h('li', { class: 'none' }, h('span', {}, 'ไม่มีงานเพิ่มจากแบบนี้ · อยู่ในขอบเขตติดตั้งมาตรฐาน')));
    shown.forEach(w => worksUl.append(h('li', { class: w.kind },
      h('div', {}, h('b', {}, w.th), h('span', {}, w.why)),
      h('em', {}, w.kind === 'info' ? 'ไม่มีค่าใช้จ่าย' : w.ex != null ? h('span', {}, baht(w.ex), h('small', {}, w.kind === 'opt' ? ' ก่อน VAT ถ้าอาคารกำหนด' : ' ก่อน VAT')) : 'ประเมินหน้างาน'))));
    read.innerHTML = '';
    read.append(h('span', {}, `${roomText()} · ${r1(S.room.w * S.room.l)} ตร.ม.`), h('span', {}, `ห้องต้องการ ~${btuFmt(R.need)}`), S.sel ? h('span', {}, `เลือก ${btuFmt(R.btu)}`) : null, h('span', {}, `ท่อ ~${R.pipe.len} ม.`));
    price.innerHTML = '';
    const survey = R.works.filter(w => w.kind === 'survey').length;
    if (S.sel && S.sel.m.preview) price.append(h('span', {}, 'FUJIVA · แบรนด์ของบริษัท'), h('b', {}, 'รอนำเข้าราคา'), h('small', {}, 'ขนาดและรุ่นเป็นตัวอย่าง · ทีมขายเสนอรุ่นและราคาจริงให้ได้ทันที'));
    else if (S.sel) {
      const s = S.sel.m.skus[S.sel.si], ins = installOptions(S.sel.m.type, s.btu).find(o => o.key === 'STANDARD');
      const wk = worksTotal(R), nWk = R.works.filter(w => w.kind === 'price' && w.ex != null).length;
      const ex = s.px + (ins ? ins.item.ex || 0 : 0) + (R.pipe.extra && R.pipe.item && R.pipe.item.ex != null ? R.pipe.item.ex * R.pipe.extra : 0) + wk;
      price.append(h('span', {}, ins ? 'เครื่อง + ติดตั้งมาตรฐาน' + (R.pipe.extra ? ` + ท่อเกิน ~${R.pipe.extra} ม.` : '') + (nWk ? ` + งานเพิ่ม ${nWk} รายการ` : '') : 'ราคาเครื่อง (ติดตั้ง: ประเมินหน้างาน)'), h('b', {}, baht(ex)),
        h('small', {}, `ก่อน VAT · ประมาณการ ยืนยันหลังสำรวจ${survey ? ` · อีก ${survey} รายการประเมินหน้างาน` : ''}`));
    }
    renderSite(R); extBox.set();
  }
  function addQuote() {
    if (!S.sel) { toast('เลือกรุ่นก่อน'); return; }
    if (S.sel.m.preview) { askTeam('FUJIVA', `สนใจ FUJIVA ${btuFmt(S.sel.m.skus[S.sel.si].btu)} สำหรับ${roomText()}`); return; }
    const R = fitCheck(S), m = S.sel.m, s = m.skus[S.sel.si], b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type];
    const from = `จากห้องจำลองติดตั้ง ${roomText()}`;
    cart.add({ kind: 'product', group: 'product', key: `P-${s.sku}`, name: `${b.name} ${s.sku}`, detail: `${t.th} ${btuFmt(s.btu)} · ${from}`, unitEx: s.px, qty: 1 });
    const ins = installOptions(m.type, s.btu).find(o => o.key === 'STANDARD');
    if (ins) cart.add({ kind: 'service', group: 'install', key: `I-${ins.item.code}`, name: ins.item.name, detail: `สำหรับ ${s.sku}`, unitEx: ins.item.ex, qty: 1 });
    if (R.pipe.extra && R.pipe.item) cart.add({ kind: 'addon', group: 'addon', key: `A-${R.pipe.item.code}-FIT`, name: R.pipe.item.name, detail: `ท่อส่วนเกินประมาณ ${R.pipe.extra} ${R.pipe.item.unit || 'ม.'} · ช่างวัดจริงหน้างาน`, unitEx: R.pipe.item.ex * R.pipe.extra, qty: 1 });
    // r7: the site work this layout implies — priced lines from the Pricebook, the rest as "ขอประเมิน" lines
    R.works.forEach(w => {
      if (w.kind === 'price' && w.item && w.ex != null) cart.add({ kind: 'addon', group: 'addon', key: `A-${w.code}-FIT`, name: w.item.name, detail: `${w.th} · ${w.qty} ${w.unit} · จากแบบห้อง`, unitEx: w.ex, qty: 1 });
      else if (w.kind === 'survey') cart.add({ kind: 'survey', group: 'install', key: `SV-${w.code || w.th}-FIT`, name: w.item ? w.item.name : w.th, detail: `${w.th} · ${w.why}`, unitEx: null, qty: 1 });
    });
    const nSv = R.works.filter(w => w.kind === 'survey').length;
    toast(`ใส่ ${b.name} ${s.sku}${ins ? ' + ติดตั้งมาตรฐาน' : ''}${nSv ? ` + ${nSv} รายการขอประเมิน` : ''} ในใบเสนอราคาแล้ว`);
  }

  // r7: the layout as a summary the team can price from (no backend yet → handoffBox: copy / email, nothing is sent silently)
  function briefText(R) {
    const p = R.plan, o = S.outdoor, si = S.site, u = S.unit, pl = S.place;
    const th = (L, id) => (L.find(x => x.id === id) || {}).th || id;
    const model = S.sel ? `${BRAND_BY_ID[S.sel.m.brand].name} ${S.sel.m.skus[S.sel.si].sku} · ${TYPE_BY_ID[u.type].th} ${btuFmt(R.btu)}` : `${TYPE_BY_ID[u.type].th} (ยังไม่เลือกรุ่น)`;
    const pos = u.type === 'cassette' ? `กลางเครื่องห่างผนังซ้าย ${(pl.cx + S.room.w / 2).toFixed(2)} ม. ผนังหลัง ${(pl.cz + S.room.l / 2).toFixed(2)} ม.` : `${th(WALLS, pl.wall)} กึ่งกลางห่างมุมซ้าย ${pl.along.toFixed(2)} ม.` + (u.type === 'wall' ? ` ใต้เครื่องสูง ${pl.height.toFixed(2)} ม.` : u.type === 'ceiling' ? ` ห่างฝ้า ${Math.round(pl.gap * 100)} ซม.` : '');
    const cnt = {}; S.furn.forEach(it => { cnt[FURN[it.k].th] = (cnt[FURN[it.k].th] || 0) + 1; });
    const lines = [
      'แบบห้องสำหรับประเมินติดตั้งแอร์ · SBP AirCare',
      `อาคาร: ${th(BUILDINGS, si.building)} · ห้องอยู่ชั้น ${si.floor}`,
      `ห้อง: กว้าง ${S.room.w.toFixed(2)} × ยาว ${S.room.l.toFixed(2)} ม. สูงถึงฝ้า ${S.room.h.toFixed(2)} ม. (${r1(S.room.w * S.room.l)} ตร.ม.) · ${SUN[S.sun].th} · ${S.people} คน`,
      `ฝ้า: ${th(CEILINGS, si.ceiling)}${si.ceiling !== 'none' ? ` · ช่องเหนือฝ้า ~${Math.round(si.plenum * 100)} ซม.` : ''} · ผนังที่เจาะ: ${th(WALL_MATS, si.wallMat)}`,
      `แอร์: ${model} (ห้องต้องการ ~${btuFmt(R.need)}) · ขนาดเครื่อง ${Math.round(u.dims.w * 100)}×${Math.round(u.dims.h * 100)}×${Math.round(u.dims.d * 100)} ซม.${u.dims.src === 'est' ? ' (ประมาณ)' : ''}`,
      `ตำแหน่งแอร์: ${pos}`,
      `แนวท่อ: ${th(ROUTES, p.mode)}${p.mode === 'direct' ? '' : ` → เจาะออก${th(WALLS, p.exit.wall)} ห่างมุมซ้าย ${p.exit.along.toFixed(2)} ม. สูงจากพื้น ${p.exit.y.toFixed(2)} ม.`} · ในห้อง ~${p.inLen.toFixed(1)} ม. นอกอาคาร ~${p.outLen.toFixed(1)} ม. · รวม ~${p.total} ม.`,
      (si.ceiling === 'smooth' && (p.mode === 'ceiling' || u.type === 'cassette')) ? `ช่องเซอร์วิสฝ้า: ${th(HATCHES, si.hatch.mode)}${si.hatch.mode !== 'none' ? ` (ห่างผนังซ้าย ${(si.hatch.x + S.room.w / 2).toFixed(1)} ม. ผนังหลัง ${(si.hatch.z + S.room.l / 2).toFixed(1)} ม.)` : ''}` : null,
      `คอยล์ร้อน: ${th(OUT_LOCS, o.loc)} · ไปทาง${o.side === 'left' ? 'ซ้าย' : 'ขวา'}ของจุดเจาะ ${o.run.toFixed(1)} ม. · ฐาน${o.drop >= 0 ? 'ต่ำกว่า' : 'สูงกว่า'}จุดเจาะ ${Math.abs(o.drop).toFixed(1)} ม. · สูงจากพื้นดิน ~${Math.max(0, p.outdoor.aboveGround).toFixed(1)} ม.`,
      `น้ำทิ้ง: ${th(DRAINS, S.drain)}${p.needPump ? ' · ต้องใช้ปั๊มน้ำทิ้ง' : u.type === 'cassette' ? ' · ปั๊มในตัวเครื่อง' : ' · ไหลลงเอง'}`,
      `ไฟฟ้า: ระยะจากตู้ไฟ ~${si.db} ม.`,
      `เฟอร์นิเจอร์: ${Object.entries(cnt).map(([k, v]) => `${k}${v > 1 ? ' ×' + v : ''}`).join(', ') || 'ห้องว่าง'}`,
      `ผลตรวจที่ควรปรับ: ${R.checks.filter(c => c.ok === 'warn').map(c => c.th).join(' · ') || 'ไม่มี'}`,
      'งานเพิ่มตามแบบ:',
      ...(R.works.filter(w => w.kind !== 'info').map(w => `- ${w.th}${w.qty > 1 ? ` (${w.qty} ${w.unit})` : ''}: ${w.kind === 'warn' ? 'ต้องแก้แบบ' : w.ex != null ? baht(w.ex) + ' ก่อน VAT' + (w.kind === 'opt' ? ' ถ้าอาคารกำหนด' : '') : 'ประเมินหน้างาน'}`)),
      ...(R.works.some(w => w.kind !== 'info') ? [] : ['- ไม่มี']),
      price.querySelector('b') ? `ประมาณการ: ${price.querySelector('b').textContent} ก่อน VAT · ยืนยันหลังสำรวจ` : null,
      `รหัสแบบห้อง: ${encodeLayout(S)}`,
    ];
    return lines.filter(Boolean).join('\n');
  }
  function sendLayout() {
    const R = fitCheck(S), ref = 'L' + Date.now().toString().slice(-7);
    sendBox.innerHTML = '';
    sendBox.append(handoffBox({ ref, title: 'แบบห้องสำหรับประเมินราคา', text: briefText(R), subject: 'ขอประเมินติดตั้งแอร์จากแบบห้อง',
      note: 'ช่วงทดลองระบบยังไม่ส่งแบบห้องถึงทีมอัตโนมัติ กรุณาคัดลอกสรุปนี้ (มีรหัสแบบห้องอยู่ท้ายข้อความ) ส่งทางอีเมล ทีมเปิดรหัสแล้วเห็นห้อง แนวท่อ และตำแหน่งคอยล์ร้อนแบบเดียวกับคุณ แล้วติดต่อกลับเพื่อยืนยันราคาและนัดสำรวจ' }));
    sendBox.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }
  function importCode(code) {
    const v = decodeLayout(code);
    if (!v) { codeMsg.textContent = 'รหัสไม่ถูกต้อง ตรวจว่าคัดลอกมาครบ (ขึ้นต้นด้วย SBP1.)'; return; }
    S.room = v.room; S.sun = v.sun; S.people = v.people; S.site = v.site; S.route = v.route; S.outdoor = { ...v.outdoor, auto: false, sideSet: true }; S.drain = v.drain;
    const hit = v.sku && allSkus().find(x => x.s.sku === v.sku);
    if (hit) setModel(hit.m, hit.si, true); else { S.sel = null; S.unit = { type: v.type, dims: unitDims(v.type, 12000), photo: null }; pickBest(); }
    S.place = v.place; S.furn = v.furn.map(it => ({ ...it, id: newId() })); S.preset = null; S.pick = null; hatchPlaced = true; extSet = true;
    V3 && V3.select(null);
    sw.set(S.room.w); sl.set(S.room.l); sh.set(S.room.h); sp.set(S.people); sunSeg.set(S.sun); bldOpts.set(S.site.building); sFloor.set(S.site.floor); ceilOpts.set(S.site.ceiling); sPlenum.set(S.site.plenum); wallOpts.set(S.site.wallMat); extBox.set();
    drainOpts.set(S.drain); sDb.set(S.site.db); locOpts.set(S.outdoor.loc); sideSeg.set(S.outdoor.side); sRun.set(S.outdoor.run); typeSeg.set(S.unit.type);
    reclamp(); renderItems(); renderSel(); renderPick(); sync(); if (V3) V3.view('iso');
    codeMsg.textContent = `เปิดแบบห้องแล้ว${v.sku && !hit ? ' · ไม่พบรุ่น ' + v.sku + ' ในรายการปัจจุบัน เลือกรุ่นใกล้เคียงให้แทน' : ''}`;
  }

  /* ----- 3D (lazy) ----- */
  let V3 = null, booting = false, pend = 0, pendLive = false;
  // the condensing unit follows its location (on the balcony / ledge floor, on the roof, on the ground) until moved by hand
  function prep() {
    guessExt();   // derived from the layout until the visitor sets the outside walls by hand
    if (!S.outdoor.auto && S.outdoor.sideSet) return;
    const p = routePlan(S);
    if (!S.outdoor.sideSet) { const el = frame2(p.exit.wall, S.room.w, S.room.l).len; S.outdoor.side = p.exit.along + S.outdoor.run <= el - 0.4 || p.exit.along < el / 2 ? 'right' : 'left'; }
    if (S.outdoor.auto) S.outdoor.drop = dropFor(S.outdoor.loc, p.exit.y, S.room.h, S.site.floor);
  }
  // live = during a drag in the 3D view: the scene keeps its air running instead of re-settling it every frame
  function sync(live = false) {
    pendLive = live;
    if (pend) return;
    pend = requestAnimationFrame(() => { pend = 0; prep(); const R = fitCheck(S); render(R); if (V3) V3.set(S, R, { live: pendLive }); });
  }
  // edits made directly in the 3D view (drag furniture / the unit / a window / the pipe exit / the service hatch), and its tool buttons
  const on3D = {
    onEdit(kind, live) { if (kind === 'furn' || kind === 'wallItem') S.preset = null; if (kind === 'unit') { reclamp(); if (!live) { guessExt(); extBox.set(); } } if (kind === 'hatch') hatchPlaced = true; if (!live) renderItems(); sync(live); },
    onPick(id) { S.pick = id; renderItems(); },
    actions: { rotate: id => rotateFurn(id), remove: id => removeFurn(id), nextWall: id => nextWall(id) },
  };
  const io = new IntersectionObserver(async es => {
    if (!es.some(e => e.isIntersecting) || booting) return; booting = true; io.disconnect();
    try { const mod = await import('./roomfit3d.js'); V3 = mod.createRoomFit3D(host, { theme, ...on3D }); prep(); V3.set(S, fitCheck(S)); if (S.pick) V3.select(S.pick); }
    catch (e) { console.warn('room-fit 3D unavailable', e); fb.hidden = false; host.hidden = true; }
  }, { rootMargin: '300px 0px' });
  io.observe(host);   // not the stage: below 1000px the stage is display:contents (no box) and would never intersect

  pickBest(); reclamp(); renderPick(); sync();
  return {
    setModel: (m, si = 0) => { setModel(m, si); if (V3) V3.view('iso'); root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); },
    state: () => S, check: () => fitCheck(S), code: () => encodeLayout(S), open: importCode,
  };
}
