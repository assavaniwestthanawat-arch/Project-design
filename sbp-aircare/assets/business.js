// SBP AirCare — Rev.09 r9 (owner 2 ต.ค. 2569): the corporate page.
//   mountAmc(root)      why organisations choose us · public quantity ladder with worked examples · package comparison
//   mountSop(root)      the whole contract step by step · every step per machine (services.cleanSteps — §6.6 #18) ·
//                       a sample Service Report laid out like form SBP-SR-ACCL-UNI-001 Rev.07 · contract terms
//   mountProjects(root) new build / renovation without AC / replacement with trade-in: flow, documents, a room-by-room estimate
// Rules: prices only from the Pricebook (round hundreds, before VAT — r100 in loadData); anything without a Pricebook price is
// "ประเมินหน้างาน". Claims stay inside documented standards (company forms, CLEAN_PKGS / PKG_INFO terms, COMPANY facts) —
// no response-time promises, no competitor names. Sample report values are recording examples, never pass/fail limits (§6.6 #12).
import {
  DATA, TYPE_BY_ID, CLEAN_PKGS, VOLUME_TIERS, PRICING, COMPANY, TRAVEL, estimateContract, cleanRate, installOptions, addonsFor,
  recommendBtu, baht, btuFmt, vatOf, h, $$,
} from './sbp-core.js';
import { cleanSteps, PH } from './services.js';
import { cart, PKG_INFO } from './commerce.js';
import { toast } from './proto-ui.js';
import { requestBooking } from './contact.js';
import { icon } from './icons.js';

const pct = x => `${Math.round(x * 100)}%`;
const CTYPES = [['wall', 'ติดผนัง'], ['ceiling', 'แขวนใต้ฝ้า'], ['cassette', 'สี่ทิศทาง'], ['floor', 'ตู้ตั้งพื้น'], ['duct', 'ซ่อนในฝ้า']];
const seg = (label, list, val, set) => h('div', { class: 's-seg', role: 'group', 'aria-label': label }, list.map(([id, th]) => h('button', { type: 'button', 'aria-pressed': id === val, onclick: () => set(id) }, th)));

/* =========================================================
   1 · why us + quantity ladder + packages
   ========================================================= */
export const USP = [
  { k: 'price', t: 'รู้งบทั้งปีตั้งแต่วันแรก', d: 'ราคามาตรฐานจาก Pricebook อยู่บนเว็บทุกรายการ ราคาขั้นบันไดตามจำนวนเครื่องเปิดเผย คำนวณเองได้ก่อนคุยกับทีมขาย' },
  { k: 'unit', t: 'ทุกเครื่องมีประวัติของตัวเอง', d: 'Asset / Tag รายเครื่อง ภาพก่อน–หลัง ค่าวัดก่อน–หลัง (Standard Care ขึ้นไป) เกรดสภาพ A–D และรอบถัดไป ตามแบบฟอร์ม SBP-SR-ACCL-UNI-001 Rev.07' },
  { k: 'c2', t: 'ล้างใหญ่ไม่ตัดท่อ มีทะเบียนชิ้นส่วน', d: 'ล้างใหญ่ C2 ปลดคอยล์เย็นลงล้างโดยไม่ตัดท่อและไม่เปิดวงจรน้ำยา ทุกชิ้นที่ถอดลงทะเบียนพร้อมภาพ ประกอบกลับครบ' },
  { k: 'approve', t: 'ไม่ซ่อมก่อนอนุมัติ', d: 'พบอาการผิดปกติ ทีมแจ้งผลตรวจพร้อมราคาซ่อมจาก Pricebook ให้ผู้รับผิดชอบอนุมัติก่อนทุกครั้ง' },
  { k: 'parts', t: 'อะไหล่และน้ำยาจากบริษัทเดียวกัน', d: `${COMPANY.th} ${COMPANY.trade} ประสบการณ์ ${COMPANY.years}` },
  { k: 'sign', t: 'ลงนามรับรอง 3 ฝ่ายทุกเครื่อง', d: 'ช่างผู้ปฏิบัติงาน หัวหน้าทีม และลูกค้าลงนามรับมอบ ต้นฉบับให้ลูกค้า สำเนาเก็บที่บริษัท' },
];
const USP_ICON = { price: 'compare', unit: 'check', c2: 'info', approve: 'warn', parts: 'star', sign: 'sign' };

export function mountAmc(root, { hl = 'h3' } = {}) {
  root.classList.add('bz');
  // why us
  root.append(h('ul', { class: 'bz-usp', 'aria-label': 'จุดเด่นของสัญญาล้างรายปี' }, USP.map(u => h('li', {}, h('span', { class: 'bz-usp-i' }, icon(USP_ICON[u.k], { size: 20 })), h(hl, {}, u.t), h('p', {}, u.d)))));
  // ladder with worked examples (wall 9,000–18,000 BTU · Standard Care · 3 visits incl. one C2)
  const ex = [5, 10, 30, 60, 120];
  const rows = VOLUME_TIERS.map((t, i) => { const n = ex[i]; const e = estimateContract({ units: { wall: n }, visits: 3, pkg: 'Standard Care', size: 0, deep: true }); return { t, n, e }; });
  const tb = h('table', { class: 'bz-ladder' },
    h('caption', {}, 'ราคาขั้นบันไดตามจำนวนเครื่องในสัญญา'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'จำนวนเครื่อง'), h('th', { scope: 'col' }, 'ส่วนลดจากยอดสัญญา'), h('th', { scope: 'col' }, 'ตัวอย่าง: จำนวน'), h('th', { scope: 'col' }, 'ราคามาตรฐาน / ปี'), h('th', { scope: 'col' }, 'ราคาสัญญา / ปี'), h('th', { scope: 'col' }, 'เฉลี่ย / เครื่อง / ปี'))),
    h('tbody', {}, rows.map(({ t, n, e }) => h('tr', { class: t.off ? '' : 'base' },
      h('th', { scope: 'row' }, t.th), h('td', { class: 'off' }, t.off ? pct(t.off) + (t.project ? ' + ขอราคาโครงการ' : '') : 'อัตรามาตรฐาน'),
      h('td', {}, `${n} เครื่อง`), h('td', { class: 'num' }, baht(e.annualStd)), h('td', { class: 'num strong' }, baht(e.annualEx)), h('td', { class: 'num' }, `≈ ${baht(e.perUnitYear)}`)))));
  root.append(h('div', { class: 'bz-block' },
    h('div', { class: 'bz-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางราคาขั้นบันได เลื่อนดูด้านข้างได้' }, tb),
    h('p', { class: 's-note' }, `ตัวอย่างคำนวณจากแอร์ติดผนัง 9,000–18,000 BTU แพ็กเกจ Standard Care ปีละ 3 รอบ (ล้างใหญ่ C2 1 รอบ) ในกรุงเทพฯ และปริมณฑล · ส่วนลดคิดจากค่าล้างต่อรอบ ไม่รวมค่าเดินทาง แล้วปัดเป็นหลักร้อย · ใช้ได้ทุกแพ็กเกจและทุกประเภทเครื่อง · ยอดขั้นต่ำ ${baht(DATA.minBill)} ต่อการเข้าหน้างานยังใช้ · ราคาก่อน VAT ต้องการใบกำกับภาษีบวก VAT 7%`)));
  // packages side by side
  const first = id => DATA.clean.find(r => r.pkg === id && r.type);
  const rate = (id, lv) => cleanRate(id, lv, 'wall', 0)?.rate.s;
  const steps = (id, lv) => cleanSteps('wall', lv, id).length;
  const ROWS = [
    ['เหมาะกับ', p => p.fit],
    ['ได้หลังงาน', p => h('ul', {}, p.gets.map(g => h('li', {}, g)))],
    ['เอกสาร', p => first(p.id)?.doc || '—'],
    ['รับประกันงานล้าง', p => first(p.id)?.warranty || '—'],
    ['ดูแลหลังบริการ', p => p.care],
    ['ขั้นตอนต่อเครื่อง (ติดผนัง)', p => `ล้างปกติ ${steps(p.id, 'C1')} ขั้น · ล้างใหญ่ ${steps(p.id, 'C2')} ขั้น`],
    ['ราคาต่อเครื่อง ติดผนังเล็ก', p => `ล้างปกติ ${baht(rate(p.id, 'C1'))} · ล้างใหญ่ ${baht(rate(p.id, 'C2'))}`],
  ];
  root.append(h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, 'เลือกระดับรายงานให้ตรงกับการใช้งาน'),
    h('div', { class: 'bz-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางเทียบแพ็กเกจ เลื่อนดูด้านข้างได้' },
      h('table', { class: 'bz-pk' }, h('thead', {}, h('tr', {}, h('td', {}), PKG_INFO.map(p => h('th', { scope: 'col', class: p.code === 'P2' ? 'rec' : '' }, h('small', {}, p.code + (p.code === 'P2' ? ' · แนะนำสำหรับองค์กร' : '')), p.id)))),
        h('tbody', {}, ROWS.map(([th, f]) => h('tr', {}, h('th', { scope: 'row' }, th), PKG_INFO.map(p => h('td', { class: p.code === 'P2' ? 'rec' : '' }, f(p)))))))),
    h('p', { class: 's-note' }, 'ระดับแพ็กเกจกำหนดหลักฐาน การตรวจวัด และการรับประกัน ส่วนความลึกของการล้างอยู่ที่วิธีล้าง ล้างปกติ C1 / ล้างใหญ่ C2 · ราคาต่อเครื่องตามประเภทและขนาดดูได้ในตัวคำนวณด้านล่าง')));
}

/* =========================================================
   2 · how the contract runs + steps per machine + sample report + terms
   ========================================================= */
const LIFE = [
  { t: 'สำรวจและทำรายการเครื่อง', who: 'ทีมขาย + หัวหน้าทีมช่าง', d: 'นับเครื่องตามพื้นที่ ประเภท ขนาด ยี่ห้อ รุ่น ตำแหน่งติดตั้ง และจุดที่เข้าถึงยาก (งานสูง ช่องฝ้า พื้นที่ควบคุม)', out: 'รายการเครื่อง + Asset / Tag รายเครื่อง' },
  { t: 'ใบเสนอราคาและแผนรอบทั้งปี', who: 'ทีมขาย', d: `ราคา Pricebook + ราคาขั้นบันได · 2–4 รอบต่อปี ล้างใหญ่ C2 ปีละครั้งตามสภาพ · วางทีมตามกำลังงาน (ติดผนังราว ${PRICING.unitsPerTeamDay.wall} เครื่อง แขวน / สี่ทิศทาง / ตู้ตั้งราว ${PRICING.unitsPerTeamDay.cassette} เครื่อง ต่อทีม-วัน)`, out: 'ใบเสนอราคา + ตารางนัดทั้งปี' },
  { t: 'ก่อนเข้างานทุกรอบ', who: 'ผู้ประสานงาน', d: 'ยืนยันวัน เวลา จำนวนเครื่อง ผู้ประสานงานฝั่งลูกค้า การขออนุญาตเข้าพื้นที่ งานนอกเวลา และจุดน้ำ–ไฟสำหรับล้าง', out: 'ใบสั่งงาน (WO) ต่อรอบ' },
  { t: 'วันล้าง: ทำตามแบบฟอร์มทุกเครื่อง', who: 'ทีมช่าง', d: 'ตรวจสภาพก่อน → ล้างตามวิธี C1 / C2 → ทดสอบน้ำทิ้งและเดินเครื่อง → วัดค่า (ตามแพ็กเกจ) → ประเมินเกรด A–D → ลงนาม 3 ฝ่าย', out: 'Service Report รายเครื่อง' },
  { t: 'หลังรอบ', who: 'ทีมขาย + ผู้ประสานงาน', d: 'สรุปเครื่องที่ต้องเฝ้าระวัง / ควรแก้ไข พร้อมใบเสนอราคาซ่อมจาก Pricebook — ไม่ซ่อมก่อนลูกค้าอนุมัติ · วางบิลตามรอบ', out: 'สรุปรอบ + ใบเสนอราคาซ่อม (ถ้ามี) + ใบแจ้งหนี้' },
  { t: 'สรุปทั้งปีและต่อสัญญา', who: 'ทีมขาย', d: 'Standard Care: สรุปโครงการพร้อมเกรดรายเครื่อง · Corporate Control: แนวโน้ม ลำดับความสำคัญ ผู้รับผิดชอบ กำหนดปิดเคส', out: 'สรุปโครงการ + แผนปีถัดไป' },
];
const SAMPLE = [
  { tag: 'AC-2F-01', at: 'ชั้น 2 ห้องประชุม', type: 'wall', btu: 18000, ref: 'R32', rb: 27.8, ra: 26.9, sb: 17.9, sa: 14.6, amp: 5.6, drain: 'ปกติ', g: 'A', note: '—' },
  { tag: 'AC-2F-02', at: 'ชั้น 2 สำนักงาน', type: 'cassette', btu: 36000, ref: 'R32', rb: 28.4, ra: 27.0, sb: 19.6, sa: 15.2, amp: 11.8, drain: 'ปั๊มน้ำทิ้งทำงาน', g: 'B', note: 'ฉนวนท่อช่วงฝ้าเริ่มเสื่อม เฝ้าระวัง' },
  { tag: 'AC-1F-05', at: 'ชั้น 1 ห้องเก็บของ', type: 'ceiling', btu: 24000, ref: 'R410A', rb: 29.1, ra: 28.6, sb: 22.4, sa: 20.9, amp: 9.4, drain: 'ไหลช้า ทะลวงแล้ว', g: 'C', note: 'ลมจ่ายยังอุ่น เสนอตรวจระบบน้ำยา (A4) รอบถัดไป' },
];
const GRADES = [['A', 'ปกติ'], ['B', 'ใช้งานได้ ควรเฝ้าระวัง'], ['C', 'ควรแก้ไขรอบถัดไป'], ['D', 'เร่งด่วน ควรหยุดใช้งาน']];

export function mountSop(root, { hl = 'h3' } = {}) {
  root.classList.add('bz');
  // contract lifecycle
  root.append(h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, 'สัญญาหนึ่งปีทำงานอย่างไร'),
    h('ol', { class: 'bz-life' }, LIFE.map((s, i) => h('li', {}, h('span', { class: 'bz-n', 'aria-hidden': 'true' }, String(i + 1)),
      h('div', {}, h('b', {}, s.t), h('small', {}, s.who), h('p', {}, s.d), h('p', { class: 'bz-out' }, icon('check', { size: 14 }), ' ได้: ', s.out)))))));
  // every step per machine (single source: services.cleanSteps)
  let type = 'wall', level = 'C1', pkg = 'Standard Care';
  const stepsBox = h('div', { class: 'bz-steps' }), ctl = h('div', { class: 'bz-ctl' });
  function render() {
    ctl.replaceChildren(
      seg('ประเภทเครื่อง', CTYPES, type, v => { type = v; render(); }),
      seg('วิธีล้าง', [['C1', 'ล้างปกติ C1'], ['C2', 'ล้างใหญ่ C2']], level, v => { level = v; render(); }),
      seg('แพ็กเกจ', CLEAN_PKGS.map(p => [p.id, p.th]), pkg, v => { pkg = v; render(); }));
    const list = cleanSteps(type, level, pkg), groups = {};
    list.forEach(s => (groups[s.ph] = groups[s.ph] || []).push(s));
    let n = 0;
    stepsBox.replaceChildren(h('p', { class: 'bz-count' }, `${TYPE_BY_ID[type].th} · ${level === 'C1' ? 'ล้างปกติ C1' : 'ล้างใหญ่ C2'} · ${pkg}: `, h('b', {}, `${list.length} ขั้นต่อเครื่อง`)),
      ...Object.entries(groups).map(([ph, ss]) => h('section', { class: 'bz-ph' + (ph === 'c2' ? ' c2' : '') }, h('h4', {}, PH[ph] || ph),
        h('ol', { start: n + 1 }, ss.map(s => (n++, h('li', {}, h('b', {}, s.t), h('p', {}, s.d), s.chk && s.chk.length ? h('ul', { class: 'bz-chk', 'aria-label': 'รายการตรวจ / บันทึก' }, s.chk.map(c => h('li', {}, icon('check', { size: 12 }), c))) : null)))))));
  }
  render();
  root.append(h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, 'ขั้นตอนต่อเครื่อง และรายการตรวจเช็ก'),
    h('p', { class: 's-note' }, 'ข้อความจากแบบฟอร์มงานล้างของบริษัท SBP-SR-ACCL-UNI-001 Rev.07 ชุดเดียวกับที่ช่างใช้หน้างาน เลือกประเภท วิธีล้าง และแพ็กเกจเพื่อดูขั้นที่ทำจริง'),
    ctl, stepsBox));
  // sample service report
  const f1 = n => n.toFixed(1);
  const rep = h('article', { class: 'bz-rep', 'aria-label': 'ตัวอย่างรายงานบริการ' },
    h('header', { class: 'bz-rep-h' },
      h('div', {}, h('b', {}, 'รายงานบริการล้างเครื่องปรับอากาศ'), h('small', {}, 'Service Report · แบบฟอร์ม SBP-SR-ACCL-UNI-001 Rev.07')),
      h('span', { class: 'bz-stamp' }, 'ตัวอย่าง')),
    h('dl', { class: 'bz-rep-meta' },
      ...[['ลูกค้า', 'บริษัทตัวอย่าง จำกัด'], ['สถานที่', 'อาคารสำนักงาน 2 ชั้น'], ['เลขที่ใบสั่งงาน', 'WO-ตัวอย่าง'], ['สัญญา / รอบ', 'สัญญารายปี · รอบที่ 2 จาก 3'],
        ['แพ็กเกจ / วิธีล้าง', 'Standard Care (P2) · ล้างปกติ C1'], ['ทีม', 'ช่างผู้ปฏิบัติงาน 2 คน · หัวหน้าทีม 1 คน']].flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('div', { class: 'bz-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางผลรายเครื่อง เลื่อนดูด้านข้างได้' },
      h('table', { class: 'bz-rep-t' },
        h('thead', {}, h('tr', {}, ['Asset / Tag', 'ตำแหน่ง', 'ประเภท · ขนาด', 'น้ำยา', 'ลมกลับ °C ก่อน → หลัง', 'ลมจ่าย °C ก่อน → หลัง', 'ΔT °C ก่อน → หลัง', 'กระแส A', 'น้ำทิ้ง', 'เกรด', 'สิ่งที่พบ / เสนอ'].map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, SAMPLE.map(r => h('tr', {}, h('th', { scope: 'row' }, r.tag), h('td', {}, r.at), h('td', {}, `${TYPE_BY_ID[r.type].th} ${btuFmt(r.btu)}`), h('td', {}, r.ref),
          h('td', { class: 'num' }, `${f1(r.rb)} → ${f1(r.ra)}`), h('td', { class: 'num' }, `${f1(r.sb)} → ${f1(r.sa)}`), h('td', { class: 'num' }, `${f1(r.rb - r.sb)} → ${f1(r.ra - r.sa)}`),
          h('td', { class: 'num' }, f1(r.amp)), h('td', {}, r.drain), h('td', {}, h('span', { class: 'bz-g g' + r.g }, r.g)), h('td', {}, r.note)))))),
    h('div', { class: 'bz-rep-f' },
      h('div', {}, h('b', {}, 'ภาพประกอบ'), h('p', {}, 'ก่อนงาน / ระหว่างงาน / หลังงาน 2–4 ภาพต่อเครื่อง อ้างอิงตาม Asset / Tag')),
      h('div', {}, h('b', {}, 'เกรดสภาพ'), h('ul', { class: 'bz-gl' }, GRADES.map(([g, t]) => h('li', {}, h('span', { class: 'bz-g g' + g }, g), t)))),
      h('div', {}, h('b', {}, 'สถานะส่งมอบ / รอบถัดไป'), h('p', {}, 'ใช้งานได้ตามปกติ / มีข้อควรระวัง / นัดตรวจ–ซ่อมเพิ่ม / แจ้งหยุดใช้งาน · รอบถัดไป: ทุก 3 / 4 / 6 / 12 เดือน')),
      h('div', {}, h('b', {}, 'ลงนามรับรอง'), h('p', { class: 'bz-sig' }, ['ช่างผู้ปฏิบัติงาน', 'หัวหน้าทีม', 'ลูกค้า'].map(t => h('span', {}, t))))),
    h('p', { class: 'bz-rep-n' }, icon('info', { size: 14 }), ' ตัวเลขในตารางเป็นตัวอย่างการบันทึก ไม่ใช่เกณฑ์ผ่าน / ไม่ผ่าน งานจริงเทียบกับค่าของรุ่นตามคู่มือผู้ผลิต · Basic Clean (P1) ได้รายงานแบบย่อ ไม่มีค่าวัด · ล้างใหญ่ C2 มีทะเบียนชิ้นส่วนที่ถอดแนบท้ายทุกเครื่อง'));
  root.append(h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, 'ตัวอย่างรายงานที่องค์กรได้รับหลังทุกรอบ'), rep));
  // contract terms
  const T = [
    ['ราคา', 'ก่อน VAT ปัดเป็นหลักร้อยทุกรายการ · องค์กรที่ต้องการใบกำกับภาษีเต็มรูปบวก VAT 7%'],
    ['ราคาขั้นบันได', VOLUME_TIERS.filter(t => t.off).map(t => `${t.th} ลด ${pct(t.off)}`).join(' · ') + ' (คิดจากค่าล้างต่อรอบ)'],
    ['ยอดขั้นต่ำ', `${baht(DATA.minBill)} ต่อการเข้าหน้างาน (งานล้าง)`],
    ['ค่าเดินทาง', `กรุงเทพฯ และปริมณฑลไม่มี · นอกพื้นที่ ${TRAVEL.bands.map(b => `${b.th} ${baht(b.fee(0))}`).join(' · ')} ต่อเที่ยว ยกเว้นตามจำนวนเครื่อง`],
    ['การวางบิล', 'ตามรอบที่เข้าทำงาน'],
    ['รับประกันงานล้าง', CLEAN_PKGS.map(p => `${p.th}: ${(p.sub.match(/รับประกัน[^·]*/) || ['—'])[0].trim()}`).join(' · ')],
    ['ประเมินหน้างาน', 'งานสูงเกิน 3 ม. นั่งร้าน / รถกระเช้า งานนอกเวลา วันหยุด การขออนุญาตเข้าพื้นที่ และงานซ่อม — แจ้งราคาให้อนุมัติก่อนเริ่มงาน'],
    ['ลูกค้าเตรียม', 'รายการเครื่อง (ถ้ามี) แผนผังพื้นที่ ผู้ประสานงาน ช่วงเวลาเข้าพื้นที่ ที่จอดรถ และจุดน้ำ–ไฟสำหรับล้าง'],
  ];
  root.append(h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, 'เงื่อนไขสัญญาโดยสรุป'),
    h('dl', { class: 'bz-terms' }, T.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    h('div', { class: 'bz-act' },
      h('button', { type: 'button', class: 's-btn primary', onclick: () => document.getElementById('b2b')?.scrollIntoView({ behavior: 'smooth' }) }, 'คำนวณงบของอาคารคุณ'),
      h('button', { type: 'button', class: 's-btn', onclick: () => requestBooking({ service: 'amc', notes: 'ขอนัดสำรวจและทำรายการเครื่องสำหรับสัญญาล้างรายปี' }, 'สัญญาล้างรายปี') }, 'นัดสำรวจทำรายการเครื่อง'))));
}

/* =========================================================
   3 · projects: new build · renovation without AC · replacement with trade-in
   ========================================================= */
const I = c => DATA.instByCode[c];
export const SCEN = {
  new: { th: 'บ้าน / อาคารสร้างใหม่', sub: 'วางระบบตั้งแต่แบบ เดินท่อรอก่อนปิดฝ้าและฉาบผนัง',
    flow: [
      ['ดูแบบและสำรวจ', 'แบบบ้าน / อาคาร ตำแหน่งห้อง ผนังภายนอก จุดวางคอยล์ร้อน', 'รายการห้องและเงื่อนไขหน้างาน'],
      ['คำนวณขนาดและวางตำแหน่ง', 'ขนาดเครื่องตามภาระความร้อนจริง ตำแหน่งคอยล์เย็น–คอยล์ร้อน แนวท่อ จุดน้ำทิ้ง จุดไฟ', 'แบบตำแหน่งเครื่องและแนวท่อ'],
      ['ใบเสนอราคา', 'เครื่อง + ติดตั้งตาม Pricebook + งานเดินท่อรอ · Shop Drawing เมื่อโครงการกำหนด', 'ใบเสนอราคา / BOQ'],
      ['งานเดินท่อรอ (ช่วงที่ 1)', 'เดินท่อน้ำยา ท่อน้ำทิ้ง และสายไฟ ก่อนปิดฝ้าและฉาบผนัง อัดไนโตรเจนตรวจรั่ว แล้วปิดปลายท่อกันฝุ่นและความชื้น', 'บันทึกการทดสอบแนวท่อ'],
      ['ติดตั้งเครื่อง (ช่วงที่ 2)', 'หลังงานสีและฝ้าเสร็จ ติดตั้งคอยล์เย็น–คอยล์ร้อน Vacuum และทดสอบตามแบบฟอร์ม SBP-SR-ACIN-UNI-001 Rev.04', 'ใบรับมอบงานติดตั้ง'],
      ['ส่งมอบ', 'ค่าหลังติดตั้ง รายการแก้ไข (punch list) เอกสารรับประกันและลงทะเบียนเครื่อง · As-built เมื่อโครงการกำหนด', 'เอกสารส่งมอบ + รับประกัน'],
      ['ดูแลต่อ', 'เข้าสัญญาล้างรายปี วางรอบตั้งแต่วันส่งมอบ', 'แผนล้างรายปี'],
    ],
    survey: [['DOC-SURVEY'], ['ROUGHIN', 'งานเดินท่อรอก่อนปิดฝ้า / ฉาบ (แยก 2 ช่วงงาน)'], ['REF-LEAK'], ['DOC-SHOP'], ['DOC-COMM'], ['DOC-WARRANTY']],
    rooms: [['ห้องนอนใหญ่', 4, 5, 0], ['ห้องนอน 2', 3.5, 4, 0], ['ห้องนั่งเล่น', 5, 6, 1]] },
  reno: { th: 'รีโนเวต · เดิมไม่มีแอร์', sub: 'พื้นที่เดิมที่ยังไม่มีระบบแอร์ ต้องหาทางเดินท่อ ไฟ และจุดวางคอยล์ร้อน',
    flow: [
      ['สำรวจ', 'ผนังภายนอก จุดวางคอยล์ร้อน แนวท่อที่เป็นไปได้ ฝ้าและช่องเหนือฝ้า ตู้ไฟและขนาดมิเตอร์ / เมนไฟเดิม (ตรวจจริง ไม่ประมาณขนาดสาย)', 'รายงานสำรวจ'],
      ['ออกแบบแนวท่อ', 'เดินในรางครอบท่อ / เหนือฝ้า + ช่องเซอร์วิส / ฝังผนัง ตามสภาพอาคาร · จุดน้ำทิ้งหรือปั๊มน้ำทิ้ง', 'แบบแนวท่อ'],
      ['ใบเสนอราคา', 'เครื่อง + ติดตั้งตาม Pricebook + งานโยธา (เจาะ กรีดผนัง เปิด–คืนฝ้า ฉาบคืนสภาพ) + ระบบไฟเพิ่ม', 'ใบเสนอราคา'],
      ['งานระบบไฟและโยธา', 'เดินเมนไฟ / ตู้ไฟย่อยเมื่อจำเป็น เจาะ Core กรีดผนัง เปิดฝ้า', 'บันทึกงานระบบ'],
      ['ติดตั้งและทดสอบ', 'ติดตั้ง Vacuum ทดสอบตามแบบฟอร์ม SBP-SR-ACIN-UNI-001 Rev.04', 'ใบรับมอบงานติดตั้ง'],
      ['คืนสภาพและส่งมอบ', 'ฉาบ ทาสี ปิดฝ้า อุดช่องเปิด ทำความสะอาด ส่งมอบพร้อมรับประกัน', 'เอกสารส่งมอบ'],
      ['ดูแลต่อ', 'เข้าสัญญาล้างรายปี', 'แผนล้างรายปี'],
    ],
    survey: [['DOC-SURVEY'], ['CIV-CORE'], ['CIV-CHASE'], ['CIV-CEIL'], ['CIV-PATCH'], ['ELE-DB'], ['FIRESTOP-4']],
    rooms: [['ห้องทำงาน', 4, 5, 1], ['ห้องประชุม', 6, 8, 1], ['โถงรับรอง', 6, 6, 1]] },
  replace: { th: 'เปลี่ยนแอร์เดิม + เทิร์นเครื่องเก่า', sub: 'รื้อเครื่องเดิม เก็บน้ำยาอย่างถูกวิธี ประเมินมูลค่าเทิร์น แล้วติดตั้งเครื่องใหม่',
    flow: [
      ['สำรวจเครื่องเดิม', 'ยี่ห้อ รุ่น อายุ สภาพ ขนาดท่อเดิมเทียบสเปกรุ่นใหม่ ระบบไฟ และแนวท่อเดิม', 'รายการเครื่องเดิม + ภาพ'],
      ['เลือกเครื่องใหม่ + ประเมินเทิร์น', 'ขนาดตามภาระความร้อนจริง · มูลค่าเทิร์นเครื่องเดิมประเมินจากยี่ห้อ อายุ และสภาพ แจ้งในใบเสนอราคา', 'ใบเสนอราคา + มูลค่าเทิร์น'],
      ['เก็บน้ำยาก่อนรื้อ', 'เก็บสารทำความเย็นเข้าคอยล์ร้อน / ถังเก็บ ไม่ปล่อยทิ้ง', 'บันทึกการเก็บน้ำยา'],
      ['รื้อและขนย้าย', 'รื้อคอยล์เย็น–คอยล์ร้อน ขนย้ายเครื่องเดิมออกจากพื้นที่', 'รายการเครื่องที่รื้อ'],
      ['ท่อเดิมหรือท่อใหม่', 'ใช้ท่อเดิมได้เมื่อขนาดตรงสเปกรุ่นใหม่และสภาพดี: ตรวจ ล้างด้วยน้ำยา Flushing อัดไนโตรเจนตรวจรั่ว · ไม่ผ่านเดินท่อใหม่', 'ผลตรวจท่อเดิม'],
      ['ติดตั้งและทดสอบ', 'ติดตั้ง Vacuum ทดสอบตามแบบฟอร์ม SBP-SR-ACIN-UNI-001 Rev.04', 'ใบรับมอบงานติดตั้ง'],
      ['ส่งมอบและดูแลต่อ', 'รับประกันงานติดตั้ง 3 ปีเมื่อซื้อเครื่องใหม่จากบริษัท · เข้าสัญญาล้างรายปี', 'เอกสารรับประกัน + แผนล้าง'],
    ],
    survey: [['DOC-SURVEY'], ['TRADEIN', 'มูลค่าเทิร์นเครื่องเดิม (ยี่ห้อ อายุ สภาพ) — หักในใบเสนอราคา'], ['REF-PUMPDOWN', null, 'old'], ['REM', null, 'old'], ['DISPOSE', null, 'old'], ['REF-EXIST', null, 'reuse'], ['REF-FLUSH', null, 'reuse'], ['REF-LEAK', null, 'reuse']],
    rooms: [['ห้องนอนใหญ่', 4, 5, 0], ['ห้องนั่งเล่น', 5, 6, 1], ['ห้องทำงาน', 3.5, 4, 1]] },
};
const SUN = [['0', 'ปกติ'], ['1', 'แดดบ่าย'], ['2', 'ใต้หลังคา']];
const REM_OF = { wall: 'REM-W', ceiling: 'REM-C', cassette: 'REM-K', floor: 'REM-FS', duct: 'REM-DUCT' };

export function mountProjects(root, { hl = 'h3', onCatalog = null } = {}) {
  root.classList.add('bz');
  let scen = 'new', reuse = false, E = null;
  const state = {};
  const roomsOf = k => state[k] || (state[k] = SCEN[k].rooms.map(([name, w, d, sun]) => ({ name, w, d, sun, type: 'wall', pipe: 6, old: k === 'replace' })));
  const head = h('div', { class: 'bz-scen' }), body = h('div');
  root.append(head, body);
  function estimate() {
    const rooms = roomsOf(scen);
    const lines = rooms.map(r => {
      const rec = recommendBtu({ w: +r.w || 0, d: +r.d || 0, sun: +r.sun, people: 2, use: scen === 'new' ? 'home' : 'office' });
      const ins = installOptions(r.type, rec.pick).find(o => o.key === 'STANDARD');
      const pipeItem = addonsFor(r.type, rec.pick)[0].items[0].item;
      const extra = Math.max(0, Math.ceil((+r.pipe || 0) - 4));
      return { r, rec, ins: ins ? ins.item : null, pipeItem, extra, pipeEx: pipeItem && pipeItem.ex != null ? pipeItem.ex * extra : null };
    });
    const priced = lines.reduce((n, l) => n + (l.ins ? l.ins.ex : 0) + (l.pipeEx || 0), 0);
    const olds = scen === 'replace' ? rooms.filter(r => r.old) : [];
    const sv = SCEN[scen].survey.filter(([, , when]) => !when || (when === 'old' && olds.length) || (when === 'reuse' && reuse)).map(([code, th]) => {
      if (code === 'REM') return { code: [...new Set(olds.map(r => REM_OF[r.type]))].join(' / '), th: `รื้อเครื่องเดิม ${olds.length} เครื่อง`, ex: null };
      const it = I(code); return { code: it ? code : '', th: th || (it ? it.name : code), ex: it ? it.ex : null, unit: it ? it.unit : '' };
    });
    return { lines, priced, sv, olds };
  }
  const sumBox = h('div', { class: 'bz-sum', 'aria-live': 'polite' });
  let cells = [];
  // inputs stay in place while typing; only the computed cells and the summary are rewritten
  function recalc() {
    E = estimate();
    E.lines.forEach((l, i) => { const c = cells[i]; if (!c) return;
      c.btu.textContent = btuFmt(l.rec.pick);
      c.ins.textContent = l.ins ? baht(l.ins.ex) : 'ประเมินหน้างาน';
      c.pipe.textContent = l.extra ? (l.pipeEx != null ? `${l.extra} ม. · ${baht(l.pipeEx)}` : `${l.extra} ม. · ประเมิน`) : 'รวมแล้ว 4 ม.'; });
    const S = SCEN[scen];
    sumBox.replaceChildren(
      h('p', { class: 'bz-sum-l' }, `ค่าติดตั้งมาตรฐาน + ท่อส่วนเกิน ${E.lines.length} ห้อง (ไม่รวมราคาเครื่อง)`),
      h('p', { class: 'bz-sum-v' }, baht(E.priced), h('small', {}, ' ก่อน VAT')),
      h('p', { class: 's-note' }, `ต้องการใบกำกับภาษี ${baht(E.priced + vatOf(E.priced))} รวม VAT 7% · ขนาดเครื่องเป็นค่าประมาณจากพื้นที่และแดด ทีมคำนวณภาระความร้อนจริงหน้างาน · รับประกันงานติดตั้ง 3 ปีเมื่อซื้อเครื่องใหม่จากบริษัท / 1 ปีเมื่อลูกค้าจัดหาเครื่องเอง`),
      h('p', { class: 'bz-sum-l bz-sv-h' }, 'งานที่ต้องประเมินหน้างานของงานแบบนี้'),
      h('ul', { class: 'bz-sv' }, E.sv.map(x => h('li', {}, h('span', {}, x.th, x.code ? h('small', {}, ` · ${x.code}`) : null), h('b', {}, x.ex != null ? `${baht(x.ex)} / ${x.unit}` : 'ประเมินหน้างาน')))),
      h('div', { class: 'bz-act' },
        h('button', { type: 'button', class: 's-btn primary', onclick: addAll }, 'ใส่ใบเสนอราคา'),
        h('button', { type: 'button', class: 's-btn', onclick: () => requestBooking({ service: 'project', units: Object.fromEntries(E.lines.reduce((m, l) => m.set(l.r.type, (m.get(l.r.type) || 0) + 1), new Map())), notes: brief() }, 'งานโครงการ / รีโนเวต / เปลี่ยนทั้งชุด') }, 'ขอสำรวจหน้างาน'),
        onCatalog ? h('button', { type: 'button', class: 's-btn ghost', onclick: onCatalog }, 'เลือกรุ่นแอร์') : null));
    function brief() {
      return [`งาน: ${S.th}`, ...E.lines.map(l => `- ${l.r.name} ${l.r.w}×${l.r.d} ม. · ${TYPE_BY_ID[l.r.type].th} ~${btuFmt(l.rec.pick)} · ท่อ ${l.r.pipe} ม.${scen === 'replace' && l.r.old ? ' · มีแอร์เดิม' : ''}`),
        `ประมาณการค่าติดตั้ง + ท่อส่วนเกิน ${baht(E.priced)} ก่อน VAT (ไม่รวมเครื่อง)`, reuse && scen === 'replace' ? 'ต้องการใช้ท่อเดิม' : null].filter(Boolean).join('\n');
    }
    function addAll() {
      E.lines.forEach(l => {
        if (l.ins) cart.add({ kind: 'service', group: 'install', key: `I-${l.ins.code}-${l.r.name}`, name: l.ins.name, detail: `${S.th} · ${l.r.name}`, unitEx: l.ins.ex, qty: 1 });
        else cart.add({ kind: 'survey', group: 'install', key: `S-INS-${l.r.name}`, name: `ติดตั้ง ${TYPE_BY_ID[l.r.type].th} ${btuFmt(l.rec.pick)}`, detail: l.r.name, unitEx: null, qty: 1 });
        if (l.extra && l.pipeItem) cart.add({ kind: l.pipeEx == null ? 'survey' : 'addon', group: 'addon', key: `A-${l.pipeItem.code}-${l.r.name}`, name: l.pipeItem.name, detail: `${l.extra} ${l.pipeItem.unit} · ${l.r.name}`, unitEx: l.pipeEx, qty: 1 });
      });
      E.sv.forEach(x => cart.add({ kind: 'survey', group: 'addon', key: `PJ-${scen}-${x.code || x.th}`, name: x.th, detail: S.th, unitEx: null, qty: 1 }));
      toast(`ใส่ใบเสนอราคาแล้ว · ${E.lines.length} ห้อง + ${E.sv.length} รายการประเมิน`);
    }
  }
  function render() {
    head.replaceChildren(h('div', { class: 's-seg bz-scen-seg', role: 'group', 'aria-label': 'ประเภทงานโครงการ' }, Object.entries(SCEN).map(([k, x]) => h('button', { type: 'button', 'aria-pressed': k === scen, onclick: () => { scen = k; render(); } }, h('b', {}, x.th), h('small', {}, x.sub)))));
    const S = SCEN[scen], rooms = roomsOf(scen);
    const flow = h('ol', { class: 'bz-flow' }, S.flow.map(([t, d, out], i) => h('li', {}, h('span', { class: 'bz-n', 'aria-hidden': 'true' }, String(i + 1)), h('div', {}, h('b', {}, t), h('p', {}, d), h('p', { class: 'bz-out' }, icon('check', { size: 14 }), ' ได้: ', out)))));
    const num = (r, k, lab, min, max, step) => h('input', { type: 'number', inputmode: 'decimal', min, max, step, value: r[k], 'aria-label': `${lab} ${r.name}`, oninput: e => { const v = +e.target.value; if (e.target.value !== '' && !isNaN(v)) { r[k] = Math.max(min, Math.min(max, v)); recalc(); } } });
    cells = [];
    const table = h('table', { class: 'bz-rooms' },
      h('thead', {}, h('tr', {}, ['ห้อง', 'กว้าง × ยาว (ม.)', 'แดด', 'ประเภทแอร์', 'ระยะท่อ (ม.)', scen === 'replace' ? 'มีแอร์เดิม' : null, 'ขนาดแนะนำ (ประมาณ)', 'ติดตั้งมาตรฐาน', 'ท่อส่วนเกิน', h('span', { class: 'sr' }, 'ลบ')].filter(x => x != null).map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rooms.map((r, i) => { const c = { btu: h('td', { class: 'num', 'data-l': 'ขนาดแนะนำ' }), ins: h('td', { class: 'num', 'data-l': 'ติดตั้งมาตรฐาน' }), pipe: h('td', { class: 'num', 'data-l': 'ท่อส่วนเกิน' }) }; cells.push(c); return h('tr', {},
        h('td', { class: 'bz-c-name' }, h('input', { value: r.name, 'aria-label': `ชื่อห้องที่ ${i + 1}`, class: 'bz-name', oninput: e => { r.name = e.target.value; } })),
        h('td', { class: 'bz-wd', 'data-l': 'กว้าง × ยาว (ม.)' }, num(r, 'w', 'กว้าง', 1, 40, 0.5), h('span', { 'aria-hidden': 'true' }, '×'), num(r, 'd', 'ยาว', 1, 60, 0.5)),
        h('td', { 'data-l': 'แดด' }, h('select', { 'aria-label': `แดด ${r.name}`, onchange: e => { r.sun = +e.target.value; recalc(); } }, SUN.map(([v, t]) => h('option', { value: v, selected: +v === +r.sun }, t)))),
        h('td', { 'data-l': 'ประเภทแอร์' }, h('select', { 'aria-label': `ประเภทแอร์ ${r.name}`, onchange: e => { r.type = e.target.value; recalc(); } }, CTYPES.filter(([k]) => k !== 'duct').map(([v, t]) => h('option', { value: v, selected: v === r.type }, t)))),
        h('td', { 'data-l': 'ระยะท่อ (ม.)' }, num(r, 'pipe', 'ระยะท่อ', 0, 60, 1)),
        scen === 'replace' ? h('td', { 'data-l': 'มีแอร์เดิม' }, h('input', { type: 'checkbox', checked: r.old, 'aria-label': `มีแอร์เดิมที่ ${r.name}`, onchange: e => { r.old = e.target.checked; recalc(); } })) : null,
        c.btu, c.ins, c.pipe,
        h('td', { class: 'bz-c-rm' }, rooms.length > 1 ? h('button', { type: 'button', class: 'bz-rm', 'aria-label': `ลบ ${r.name}`, onclick: () => { rooms.splice(i, 1); render(); } }, icon('x', { size: 14 })) : null)); })));
    const addRoom = h('button', { type: 'button', class: 's-btn ghost', onclick: () => { rooms.push({ name: `ห้อง ${rooms.length + 1}`, w: 4, d: 4, sun: 0, type: 'wall', pipe: 6, old: scen === 'replace' }); render(); } }, icon('plus', { size: 14 }), ' เพิ่มห้อง');
    const reuseBox = scen === 'replace' ? h('label', { class: 's-chk' }, h('input', { type: 'checkbox', checked: reuse, onchange: e => { reuse = e.target.checked; recalc(); } }), h('span', {}, 'ต้องการใช้ท่อน้ำยาเดิม (ตรวจขนาดและสภาพก่อน)')) : null;
    body.replaceChildren(
      h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, `${S.th}: ขั้นตอนงาน`), flow),
      h('div', { class: 'bz-block' }, h(hl, { class: 'bz-h' }, 'ประมาณการทีละห้อง'),
        h('p', { class: 's-note' }, 'ใส่ห้องที่ต้องการติดแอร์ ระบบแนะนำขนาดโดยประมาณและดึงราคาติดตั้งมาตรฐานจาก Pricebook (รวมท่อและวัสดุ 4 เมตรแรก) · วางแอร์ทีละห้องแบบละเอียดได้ที่ "ลองวางในห้องของคุณ"'),
        h('div', { class: 'bz-grid' }, h('div', { class: 'bz-col' }, h('div', { class: 'bz-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางห้อง เลื่อนดูด้านข้างได้' }, table), h('div', { class: 'bz-row' }, addRoom, reuseBox)), sumBox)));
    recalc();
  }
  render();
  return { set: k => { if (SCEN[k]) { scen = k; render(); } } };
}
