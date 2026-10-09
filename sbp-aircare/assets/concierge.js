// SBP AirCare — concierge: understand the visitor first (r12 v2 editions; owner 5 ต.ค. 2569 "ในมุมของการใช้บริการ ที่เราเข้าใจลูกค้า
// จริงๆ"). Three questions — where, what is happening, a few details — then: what we understood (one sentence), the usual
// causes shown on the 3D stage (each cause plays a scene + labels), what we recommend and why, and the price from the
// Pricebook. Honest by construction: causes are "common causes" confirmed by the technician on site; repair is never priced
// before diagnosis and never done before the customer approves (§6.6 #13); no forbidden promise words (#11); cleaning shows
// the per-visit minimum as its own line (#8); no internal rate is read.
// mountConcierge(root, {stage, slot, labels, onBook(preset), onShop({type, btu}), onPrices(tab), place}) → {set(patch), state}
import { DATA, TYPE_BY_ID, SIZE_BANDS, cleanRate, estimateContract, recommendBtu, baht, btuFmt, h, $$ } from './sbp-core.js';
import { cart } from './commerce.js';
import { diagnosis, installRows } from './jobcard.js';
import { toast } from './proto-ui.js';

export const PLACES = [['home', 'บ้าน'], ['condo', 'คอนโด'], ['shop', 'ร้านค้า คาเฟ่'], ['office', 'สำนักงาน'], ['factory', 'โรงงาน คลังสินค้า'], ['other', 'โรงแรม คลินิก อื่น ๆ']];
export const NEEDS = [
  ['due', 'ถึงรอบล้าง'], ['warm', 'ไม่เย็น หรือเย็นน้อย'], ['drip', 'น้ำหยด'], ['noise', 'มีเสียงดัง'], ['smell', 'มีกลิ่น'], ['bill', 'ค่าไฟสูงขึ้น'],
  ['dead', 'เปิดไม่ติด ดับเอง หรือขึ้นรหัส'], ['new', 'ซื้อแอร์ใหม่'], ['move', 'ย้ายแอร์'], ['fleet', 'ดูแลหลายเครื่องทั้งปี'],
];
const TYPES4 = ['wall', 'ceiling', 'cassette', 'floor'];
const LAST = [['lt6', 'ไม่เกิน 6 เดือน'], ['6to12', '6–12 เดือน'], ['gt12', 'เกิน 1 ปี'], ['unk', 'จำไม่ได้']];
const SUN = [['0', 'แดดน้อย'], ['1', 'แดดบ่าย'], ['2', 'แดดทั้งวัน หรือใต้หลังคา']];

// common causes per need: text + what the stage shows (scene) + labelled parts. Wording: "อาจ", "พบบ่อย" — the technician confirms.
const DIRTY = { dirt: 1, xray: true, explode: 0, shot: 'inside', power: true };
const CAUSES = {
  due: [{ t: 'ฝุ่นสะสมที่แผ่นกรองและคอยล์เย็นตามเวลา', d: 'ลมผ่านคอยล์ได้น้อยลง เครื่องจึงทำงานนานขึ้นกว่าจะเย็น', scene: DIRTY, lab: [['filter', 'แผ่นกรอง'], ['coil', 'คอยล์เย็น']] },
    { t: 'คราบในใบพัดลมและถาดน้ำทิ้ง', d: 'เป็นจุดที่ล้างปกติเข้าถึงได้บางส่วน ล้างใหญ่ปลดเครื่องลงมาล้างได้ทั่วถึงกว่า', scene: { ...DIRTY, explode: 0.45 }, lab: [['blower', 'ใบพัดลม'], ['fan', 'ใบพัดลม'], ['pan', 'ถาดน้ำทิ้ง']] }],
  warm: [{ t: 'แผ่นกรองหรือคอยล์เย็นสกปรก', d: 'สาเหตุที่พบบ่อยที่สุด ลมผ่านน้อย ความเย็นออกมาไม่เต็มที่', scene: DIRTY, lab: [['filter', 'แผ่นกรอง'], ['coil', 'คอยล์เย็น']] },
    { t: 'ลมไม่ถึงจุดที่นั่งหรือเครื่องเล็กไปสำหรับห้อง', d: 'ดูทางลมและระยะลม ห้องที่ร้อนมากอาจต้องใช้ขนาด BTU สูงกว่าเดิม', scene: { dirt: 0, xray: false, explode: 0, shot: 'air', power: true }, lab: [] },
    { t: 'น้ำยาไม่พอ หรือคอยล์ร้อนระบายความร้อนไม่ดี', d: 'ต้องวัดค่าที่หน้างาน ช่างไม่เติมน้ำยาโดยไม่หาจุดรั่วก่อน', scene: { dirt: 0, xray: true, explode: 0, shot: 'close', power: true }, lab: [['coil', 'คอยล์เย็น']] }],
  drip: [{ t: 'ถาดน้ำทิ้งหรือท่อน้ำทิ้งอุดตัน', d: 'น้ำที่กลั่นจากอากาศไหลออกไม่ทัน จึงล้นออกหน้าเครื่อง', scene: { dirt: 0.6, xray: true, explode: 0.3, shot: 'inside', power: true }, lab: [['pan', 'ถาดน้ำทิ้ง'], ['pump', 'ปั๊มน้ำทิ้ง']] },
    { t: 'คอยล์สกปรกจนน้ำเกาะเป็นหยดใหญ่', d: 'ลมพาหยดน้ำออกมาทางช่องลม มักหายเมื่อล้างคอยล์', scene: DIRTY, lab: [['coil', 'คอยล์เย็น'], ['louver', 'ช่องลมออก']] },
    { t: 'ตัวเครื่องเอียงหรือแนวท่อน้ำทิ้งไม่ลาด', d: 'ช่างตรวจระดับและแนวท่อที่หน้างาน', scene: { dirt: 0, xray: false, explode: 0, shot: 'close', power: true }, lab: [] }],
  noise: [{ t: 'ใบพัดลมสกปรกหรือไม่สมดุล', d: 'คราบที่เกาะใบพัดไม่เท่ากันทำให้สั่นและมีเสียง', scene: { dirt: 0.8, xray: true, explode: 0.6, shot: 'inside', power: true }, lab: [['blower', 'ใบพัดลม'], ['fan', 'ใบพัดลม'], ['motor', 'มอเตอร์พัดลม']] },
    { t: 'ฝาหน้า ขายึด หรือชิ้นส่วนหลวม', d: 'ตรวจและขันยึดได้ระหว่างล้างหรือตรวจเช็ก', scene: { dirt: 0, xray: false, explode: 0.25, shot: 'close', power: true }, lab: [['front', 'ฝาหน้า'], ['louver', 'บานสวิง']] },
    { t: 'เสียงจากคอยล์ร้อนหรือคอมเพรสเซอร์', d: 'ต้องฟังและวัดที่หน้างาน ช่างแจ้งผลก่อนเสนอราคาซ่อม', scene: { dirt: 0, xray: false, explode: 0, shot: 'wide', power: true }, lab: [] }],
  smell: [{ t: 'ฝุ่นและความชื้นสะสมที่ใบพัดและคอยล์', d: 'เป็นที่มาของกลิ่นอับที่พบบ่อย ล้างใหญ่ปลดเครื่องลงมาล้างใบพัดได้ทั่วถึงกว่า', scene: { ...DIRTY, explode: 0.4 }, lab: [['coil', 'คอยล์เย็น'], ['blower', 'ใบพัดลม'], ['fan', 'ใบพัดลม']] },
    { t: 'น้ำขังในถาดน้ำทิ้ง', d: 'ถาดที่ระบายไม่หมดทำให้เกิดกลิ่น', scene: { dirt: 0.6, xray: true, explode: 0.3, shot: 'inside', power: true }, lab: [['pan', 'ถาดน้ำทิ้ง']] }],
  bill: [{ t: 'คอยล์และแผ่นกรองสกปรก เครื่องทำงานนานขึ้น', d: 'กว่าห้องจะถึงอุณหภูมิที่ตั้งต้องใช้เวลานานกว่าเดิม', scene: DIRTY, lab: [['filter', 'แผ่นกรอง'], ['coil', 'คอยล์เย็น']] },
    { t: 'การใช้งาน เช่น ตั้งอุณหภูมิต่ำมากหรือเปิดประตูบ่อย', d: 'ลองตั้ง 25–26 องศาแล้วเปิดพัดลมช่วยเป็นทางเลือกหนึ่ง', scene: { dirt: 0, xray: false, explode: 0, shot: 'air', power: true }, lab: [] }],
  dead: [{ t: 'ระบบไฟ บอร์ดควบคุม หรือเซนเซอร์', d: 'รหัสบนจอช่วยบอกทิศทาง แต่ต้องตรวจวัดก่อนเปลี่ยนอะไหล่ทุกครั้ง', scene: { dirt: 0, xray: true, explode: 0.2, shot: 'close', power: false }, lab: [['pcb', 'บอร์ดควบคุม'], ['display', 'จอแสดงผล']] }],
};
const pick = (o, k) => o[k] || [];

function chips(name, opts, cur, onPick, multi = false) {
  const g = h('div', { class: 'cc-chips', role: 'group', 'aria-label': name });
  const draw = v => $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(multi ? v.has(b.dataset.v) : b.dataset.v === String(v))));
  opts.forEach(([v, th]) => g.append(h('button', { type: 'button', 'data-v': v, onclick: () => onPick(v, draw) }, th)));
  draw(cur); return g;
}
function num(v, { min = 0, max = 999, step = 1, label, onChange, unit }) {
  const i = h('input', { type: 'number', inputmode: 'decimal', min, max, step, value: v, 'aria-label': label });
  const set = n => { n = Math.max(min, Math.min(max, +n || 0)); onChange(n); };
  i.addEventListener('change', () => { set(i.value); i.value = Math.max(min, Math.min(max, +i.value || 0)); });
  i.addEventListener('input', () => { if (i.value !== '') set(i.value); });
  return h('label', { class: 'cc-num' }, h('span', {}, label), h('span', { class: 'cc-num-in' }, h('button', { type: 'button', 'aria-label': `ลด ${label}`, onclick: () => { i.value = Math.max(min, +i.value - step); set(i.value); } }, '−'), i,
    h('button', { type: 'button', 'aria-label': `เพิ่ม ${label}`, onclick: () => { i.value = Math.min(max, +i.value + step); set(i.value); } }, '+')), unit ? h('small', {}, unit) : null);
}

export function mountConcierge(root, { stage, slot, labels, onBook, onShop, onPrices, place = 'home' } = {}) {
  const S = { place, need: '', type: place === 'office' || place === 'shop' ? 'cassette' : 'wall', n: 1, size: 0, last: 'unk', room: { w: 4, d: 4, sun: '1' }, visits: 3, cause: 0 };
  const q1 = h('fieldset', { class: 'cc-q' }, h('legend', {}, 'ที่ไหน'), chips('สถานที่', PLACES, S.place, (v, draw) => { S.place = v; draw(v); if (!S.touchedType) S.type = v === 'office' || v === 'shop' ? 'cassette' : v === 'factory' ? 'ceiling' : 'wall'; render(); }));
  const q2 = h('fieldset', { class: 'cc-q' }, h('legend', {}, 'วันนี้เกิดอะไรขึ้น'), chips('เรื่องที่ต้องการ', NEEDS, S.need, (v, draw) => { S.need = v; S.cause = 0; draw(v); render(true); }));
  const q3 = h('fieldset', { class: 'cc-q', hidden: true }, h('legend', {}, 'รายละเอียดอีกนิด'));
  const res = h('div', { class: 'cc-res', 'aria-live': 'polite', hidden: true });
  root.replaceChildren(h('div', { class: 'cc-ask' }, q1, q2, q3), res);

  function details() {
    const N = S.need, body = [];
    if (N === 'new') {
      body.push(h('div', { class: 'cc-row' }, num(S.room.w, { min: 2, max: 20, step: 0.5, label: 'ห้องกว้าง', unit: 'เมตร', onChange: v => { S.room.w = v; out(); } }), num(S.room.d, { min: 2, max: 30, step: 0.5, label: 'ห้องยาว', unit: 'เมตร', onChange: v => { S.room.d = v; out(); } })),
        chips('แดด', SUN, S.room.sun, (v, draw) => { S.room.sun = v; draw(v); out(); }));
    } else if (N === 'fleet') {
      S.fleet = S.fleet || { wall: 12, ceiling: 0, cassette: 4, floor: 0 };
      body.push(h('div', { class: 'cc-row cc-fleet' }, TYPES4.map(t => num(S.fleet[t], { min: 0, max: 999, label: TYPE_BY_ID[t].th, unit: 'เครื่อง', onChange: v => { S.fleet[t] = v; out(); } }))),
        chips('ล้างกี่ครั้งต่อปี', [['2', '2 ครั้ง/ปี'], ['3', '3 ครั้ง/ปี'], ['4', '4 ครั้ง/ปี']], String(S.visits), (v, draw) => { S.visits = +v; draw(v); out(); }));
    } else {
      body.push(chips('ประเภทเครื่อง', TYPES4.map(t => [t, TYPE_BY_ID[t].th]), S.type, (v, draw) => { S.type = v; S.touchedType = true; draw(v); out(); }),
        h('div', { class: 'cc-row' }, num(S.n, { min: 1, max: 200, label: 'จำนวนเครื่อง', unit: 'เครื่อง', onChange: v => { S.n = v; out(); } }),
          h('label', { class: 'cc-sel' }, h('span', {}, 'ขนาดเครื่อง'), sizeSel())));
      if (N !== 'move' && N !== 'dead') body.push(h('div', { class: 'cc-sub' }, h('span', {}, 'ล้างครั้งล่าสุด'), chips('ล้างครั้งล่าสุด', LAST, S.last, (v, draw) => { S.last = v; draw(v); out(); })));
    }
    return body;
  }
  function sizeSel() {
    const sel = h('select', { 'aria-label': 'ขนาดเครื่อง', onchange: () => { S.size = +sel.value; out(); } },
      SIZE_BANDS.map(b => h('option', { value: b.id, selected: S.size === b.id }, `${(S.type === 'wall' ? b.wall : b.other).replace('<=', 'ไม่เกิน ').replace(/-/g, '–')} BTU`)));
    return sel;
  }
  function render(fresh) {
    q3.hidden = !S.need; res.hidden = !S.need;
    if (!S.need) return;
    q3.replaceChildren(h('legend', {}, 'รายละเอียดอีกนิด'), ...details());
    out(fresh);
  }

  /* ---- the answer ---- */
  const placeTh = () => PLACES.find(p => p[0] === S.place)[1];
  const needTh = () => NEEDS.find(p => p[0] === S.need)[1];
  function plan() {
    const N = S.need, t = S.type, T = TYPE_BY_ID[t];
    if (N === 'new') {
      const r = recommendBtu({ w: S.room.w, d: S.room.d, sun: +S.room.sun, use: S.place === 'office' ? 'office' : S.place === 'shop' ? 'shop' : 'home' });
      const ty = r.pick > 30000 && (S.place === 'office' || S.place === 'shop') ? 'cassette' : r.pick > 36000 ? 'ceiling' : 'wall';
      const rows = installRows(ty), row = rows.find(x => r.pick <= x.hi) || rows[rows.length - 1];
      return { kind: 'new', rec: r, ty, row,
        head: `ห้อง ${S.room.w} × ${S.room.d} ม. (${r.area.toFixed(1)} ตร.ม.) ควรใช้แอร์ประมาณ ${btuFmt(r.pick)}`,
        why: `คำนวณจากพื้นที่ แดด และการใช้งานแบบ${placeTh()} เป็นค่าประมาณเบื้องต้น ทีมช่างยืนยันจากหน้างานจริงก่อนสั่งเครื่อง`,
        lines: row ? [{ th: `ค่าติดตั้งมาตรฐาน ${TYPE_BY_ID[ty].th} ${row.range} BTU`, ex: row.std.ex }, row.prem ? { th: 'หรือติดตั้งพรีเมียม', ex: row.prem.ex, alt: true } : null].filter(Boolean) : [{ th: 'ค่าติดตั้ง', ex: null }],
        book: { service: 'install', units: { [ty]: 1 }, notes: `ห้อง ${S.room.w}×${S.room.d} ม. แนะนำประมาณ ${btuFmt(r.pick)} (${placeTh()})` } };
    }
    if (N === 'fleet') {
      const e = estimateContract({ units: S.fleet, visits: S.visits, pkg: 'Standard Care' });
      if (!e.count) return { kind: 'fleet', head: 'ใส่จำนวนเครื่องอย่างน้อย 1 เครื่อง', lines: [], book: { service: 'amc' } };
      return { kind: 'fleet', e,
        head: `สัญญาล้างรายปี ${e.count} เครื่อง ${S.visits} ครั้งต่อปี`, why: `${e.tierTh} · แพ็กเกจ Standard Care มีภาพก่อน–หลังและรายงานรายเครื่อง · ล้างใหญ่ปีละ 1 ครั้งรวมในยอดนี้${e.next ? ` · เพิ่มอีก ${e.next.need} เครื่องได้ขั้น ${e.next.tier.th}` : ''}`,
        lines: [{ th: 'ประมาณการต่อปี', ex: e.annualEx }, { th: 'เฉลี่ยต่อเครื่องต่อปี', ex: e.perUnitYear, alt: true }],
        book: { service: 'amc', units: Object.fromEntries(Object.entries(S.fleet).filter(([, v]) => v)), pkg: 'Standard Care', notes: `สัญญาล้างรายปี ${e.count} เครื่อง ${S.visits} ครั้ง/ปี ประมาณ ${baht(e.annualEx)} ต่อปี ก่อน VAT` } };
    }
    if (N === 'move') {
      const code = { wall: 'MOVE-W', ceiling: 'MOVE-C', floor: 'MOVE-C', cassette: 'MOVE-K' }[t], it = DATA.instByCode[code];
      return { kind: 'move', head: `ย้าย${T.th} ${S.n} เครื่อง`, why: 'ช่างเก็บน้ำยากลับเข้าคอยล์ร้อนก่อนรื้อ แล้วติดตั้งที่ใหม่พร้อมทำ Vacuum ราคาขึ้นกับระยะท่อใหม่และจุดติดตั้ง จึงประเมินหน้างาน',
        lines: [{ th: it ? it.name : 'รื้อ ย้าย และติดตั้ง', ex: null }], survey: it, book: { service: 'move', units: { [t]: S.n }, notes: `ย้าย${T.th} ${S.n} เครื่อง` } };
    }
    const diag = diagnosis(t);
    const cleanFirst = ['due', 'smell', 'bill'].includes(N) || ((N === 'warm' || N === 'drip') && S.last !== 'lt6');
    if (N === 'dead' || N === 'noise' || !cleanFirst) {
      return { kind: 'diag', head: `แนะนำให้ช่างตรวจวินิจฉัย${T.th} ${S.n} เครื่อง`,
        why: N === 'dead' ? 'อาการทางไฟฟ้าต้องตรวจวัดก่อน ช่างแจ้งผลและราคาซ่อมเป็นรายการ แล้วลงมือเมื่อคุณอนุมัติเท่านั้น' : `${S.last === 'lt6' ? 'ล้างมาไม่นาน สาเหตุจึงอาจไม่ใช่ฝุ่น ' : ''}ช่างตรวจหาสาเหตุก่อน แจ้งราคาซ่อมเป็นรายการ และไม่ซ่อมก่อนคุณอนุมัติ`,
        lines: [{ th: diag ? diag.name : 'ค่าตรวจวินิจฉัย', ex: diag ? diag.rate.s : null, n: S.n }], diag,
        book: { service: 'repair', units: { [t]: S.n }, notes: `${needTh()} · ${T.th} ${S.n} เครื่อง` } };
    }
    const deep = S.last === 'gt12' && (N === 'smell' || N === 'drip' || N === 'warm');
    const lv = deep ? 'C2' : 'C1', pkg = S.place === 'home' || S.place === 'condo' ? 'Basic Clean' : 'Standard Care';
    const r = cleanRate(pkg, lv, t, S.size), each = r ? r.rate.s : null, sub = each != null ? each * S.n : null;
    const lines = [{ th: `${lv === 'C2' ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'} ${T.th} ${r ? r.range + ' BTU' : ''} · ${pkg}`, ex: each, n: S.n }];
    if (sub != null && sub < DATA.minBill) lines.push({ th: `ปรับเป็นยอดขั้นต่ำงานล้างต่อการเข้างาน ${baht(DATA.minBill)}`, ex: DATA.minBill - sub, note: true, left: each ? Math.floor((DATA.minBill - sub) / each) : 0 });
    return { kind: 'clean', lv, pkg, r,
      head: `แนะนำ${lv === 'C2' ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'} ${T.th} ${S.n} เครื่อง`,
      why: lv === 'C2' ? 'ไม่ได้ล้างเกิน 1 ปีและมีอาการ ล้างใหญ่ปลดเครื่องลงมาล้างใบพัดและถาดน้ำทิ้งได้ทั่วถึงกว่า โดยไม่ตัดท่อน้ำยา' : (N === 'due' ? 'ล้างตามรอบช่วยให้ลมผ่านคอยล์ได้เต็มที่' : 'เริ่มจากล้างก่อนเพราะเป็นสาเหตุที่พบบ่อยและราคาชัด') + (diag && N !== 'due' ? ` หากล้างแล้วอาการยังอยู่ ช่างตรวจต่อ ค่าตรวจ ${baht(diag.rate.s)} ต่อเครื่อง` : ''),
      lines, book: { service: 'clean', units: { [t]: S.n }, level: lv === 'C2' ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1', pkg, notes: `${needTh()} · ${T.th} ${S.n} เครื่อง · ล้างล่าสุด ${LAST.find(x => x[0] === S.last)[1]}` } };
  }
  function out(fresh) {
    const P = plan(), causes = pick(CAUSES, S.need);
    const total = P.lines.filter(l => l.ex != null && !l.alt).reduce((a, l) => a + l.ex * (l.n || 1), 0);
    const understood = S.need === 'new' ? `${placeTh()} · ซื้อแอร์ใหม่ · ห้อง ${S.room.w} × ${S.room.d} ม. · ${SUN.find(x => x[0] === S.room.sun)[1]}`
      : S.need === 'fleet' ? `${placeTh()} · ดูแลหลายเครื่องทั้งปี`
        : `${placeTh()} · ${TYPE_BY_ID[S.type].th} ${S.n} เครื่อง · ${needTh()}${S.need !== 'move' && S.need !== 'dead' ? ` · ล้างล่าสุด ${LAST.find(x => x[0] === S.last)[1]}` : ''}`;
    const causeList = causes.length ? h('ol', { class: 'cc-causes' }, causes.map((c, i) => h('li', {}, h('button', { type: 'button', 'aria-pressed': String(i === S.cause), onclick: () => { S.cause = i; show(c); $$('.cc-causes button', res).forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); } },
      h('b', {}, c.t), h('span', {}, c.d))))) : null;
    const priceRows = h('dl', { class: 'cc-price' }, ...P.lines.flatMap(l => [h('dt', { class: l.alt ? 'alt' : l.note ? 'note' : '' }, l.th, l.n > 1 ? ` × ${l.n}` : '', l.note && l.left ? h('small', {}, `ในยอดนี้ล้างเพิ่มได้อีก ${l.left} เครื่องโดยราคาไม่เปลี่ยน`) : null),
      h('dd', {}, l.ex == null ? 'ประเมินหน้างาน' : baht(l.ex * (l.n || 1)))]));
    res.replaceChildren(
      h('p', { class: 'cc-got' }, h('span', {}, 'สิ่งที่เราเข้าใจ'), understood),
      causeList ? h('div', { class: 'cc-why' }, h('h3', {}, 'สาเหตุที่พบบ่อย'), causeList, h('p', { class: 'cc-fine' }, 'กดแต่ละข้อเพื่อดูในภาพ ช่างยืนยันสาเหตุจริงที่หน้างาน')) : null,
      h('div', { class: 'cc-plan' }, h('h3', {}, P.head), P.why ? h('p', {}, P.why) : null, priceRows,
        total ? h('p', { class: 'cc-total' }, h('span', {}, P.kind === 'fleet' ? 'ประมาณการต่อปี' : P.kind === 'diag' ? 'ค่าตรวจรวม' : 'รวมโดยประมาณ'), h('b', {}, baht(P.kind === 'fleet' ? P.e.annualEx : total)), h('small', {}, 'ก่อน VAT')) : null,
        h('div', { class: 'cc-acts' },
          h('button', { type: 'button', class: 'v-btn go', onclick: () => onBook && onBook(P.book) }, P.kind === 'diag' ? 'นัดช่างตรวจ' : P.kind === 'fleet' || P.kind === 'move' ? 'นัดสำรวจหน้างาน' : 'เลือกวันและจองคิว'),
          P.kind === 'new' && onShop ? h('button', { type: 'button', class: 'v-btn ghost', onclick: () => onShop({ type: P.ty, btu: P.rec.pick }) }, `ดูรุ่น ${btuFmt(P.rec.pick)} ทุกยี่ห้อ`) : null,
          P.kind === 'clean' || P.kind === 'diag' || P.kind === 'move' ? h('button', { type: 'button', class: 'v-btn ghost', onclick: () => addQuote(P) }, 'ใส่ใบเสนอราคา') : null,
          onPrices ? h('button', { type: 'button', class: 'v-link', onclick: () => onPrices(P.kind === 'diag' ? 'repair' : P.kind === 'new' || P.kind === 'move' ? 'install' : 'clean') }, 'ดูราคาทั้งหมด') : null)));
    // the stage: first cause (or the recommended unit) on a fresh answer
    if (fresh || S.need) { if (causes.length) show(causes[Math.min(S.cause, causes.length - 1)]); else if (S.need === 'new') { stage.set(slot, { type: P.ty, shot: 'air', dirt: 0, xray: false, explode: 0, power: true }); labels && labels.set([]); } else { stage.set(slot, { type: S.need === 'fleet' ? 'cassette' : S.type, shot: 'hero', dirt: 0, xray: false, explode: 0, power: true }); labels && labels.set([]); } }
  }
  function show(c) {
    const ty = S.need === 'new' || S.need === 'fleet' ? undefined : S.type;
    stage.set(slot, { ...(ty ? { type: ty } : {}), ...c.scene, auto: false });
    labels && labels.set(c.lab);
  }
  function addQuote(P) {
    if (P.kind === 'clean' && P.r) {
      cart.add({ kind: 'service', group: 'clean', key: `CL-${P.pkg}-${P.lv}-${S.type}-${S.size}`, name: `${P.r.name} · ${P.lv === 'C2' ? 'ล้างใหญ่ C2' : 'ล้างปกติ C1'}`, detail: `${P.pkg} · ${P.r.warranty || ''}`, unitEx: P.r.rate.s, qty: S.n });
    } else if (P.kind === 'diag' && P.diag) {
      cart.add({ kind: 'service', group: 'repair', key: `RP-${P.diag.name}`, name: P.diag.name, detail: needTh(), unitEx: P.diag.rate.s, qty: S.n });
    } else if (P.kind === 'move' && P.survey) {
      cart.add({ kind: 'survey', group: 'install', key: `S-${P.survey.code}`, name: P.survey.name, detail: `${S.n} เครื่อง`, unitEx: null, qty: S.n });
    } else return;
    toast('ใส่ใบเสนอราคาแล้ว');
  }
  return {
    state: S,
    set(p) { Object.assign(S, p); $$('.cc-chips', q1)[0] && render(true); },
  };
}
