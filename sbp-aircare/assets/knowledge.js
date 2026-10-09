// SBP AirCare — knowledge hub "ศึกษาก่อน ลองเอง" (Rev.09, owner request 1 ต.ค. 2569):
// short guides for home (B2C) and organisations (B2B), each ending in the simulator / table where the visitor can try it.
// Every number is read from the same constants the tools use (recommendBtu, FIT_RULES, PRICING, TRAVEL, Pricebook rows),
// so a guide can never disagree with the calculator next to it. Wording follows the banned-claims list (CLAUDE.md §6.6 #11).
// Owner / tech lead to review the copy; data corrections flow in through the constants.
import { h, $$, recommendBtu, btuFmt, baht, DATA, PRICING, TRAVEL, VRF_NOTE } from './sbp-core.js';
import { PKG_INFO, METHOD_INFO } from './commerce.js';
import { FIT_RULES } from './roomfit.js';
import { askTeam } from './contact.js';

const ex = recommendBtu({ w: 4, d: 3.5, h: 2.6, sun: 1, people: 2 });
const cm = m => Math.round(m * 100);
const L = (...items) => h('ul', {}, items.map(t => h('li', {}, t)));
const P = t => h('p', {}, t);

// try: [label, tool key]; tool keys map to section ids per variant (cfg.ids) — missing keys are skipped
export const GUIDES = [
  { id: 'btu', aud: 'home', th: 'เลือก BTU ให้พอดีห้อง', lead: 'พื้นที่ แดด จำนวนคน และความสูงฝ้า กำหนดขนาดเครื่อง', min: 2,
    body: () => [P('สูตรเบื้องต้นที่เว็บนี้ใช้ (ทุกเครื่องมือใช้สูตรเดียวกัน):'),
      L('พื้นที่ห้อง (ตร.ม.) × 700 BTU เมื่อแดดน้อย · 750 ปานกลาง · 820 แดดจัดหรือห้องใต้หลังคา', 'คนเกิน 2 คน เพิ่มราว 600 BTU ต่อคน', 'ฝ้าสูงกว่า 2.7 ม. เพิ่มตามสัดส่วนความสูง'),
      P(`ตัวอย่าง: ห้อง 4 × 3.5 ม. แดดปานกลาง 2 คน ต้องการประมาณ ${btuFmt(ex.btu)} จึงเลือกเครื่องขนาด ${btuFmt(ex.pick)}`),
      P('เครื่องเล็กไปจะเย็นช้าและทำงานหนักตลอด ส่วนเครื่องธรรมดาที่ใหญ่ไปจะตัดบ่อย ห้องเย็นแต่ความชื้นค้าง ห้องที่มีกระจกมาก ครัว ห้องเซิร์ฟเวอร์ หรือมีเครื่องจักร ทีมจะคำนวณจากหน้างานจริง')],
    try: [['ลองวางในห้องของคุณ', 'fit'], ['ห้องจำลอง 48 แบบ', 'studio']] },
  { id: 'types', aud: 'all', th: 'แอร์ 4 ประเภท ต่างกันอย่างไร', lead: 'ติดผนัง แขวน สี่ทิศทาง ตู้ตั้ง เหมาะกับห้องแบบไหน', min: 3,
    body: () => [L(
      `ติดผนัง — ห้องนอน ห้องนั่งเล่น ห้องทำงาน ลมไปได้ราว ${FIT_RULES.wall.throw} ม. ติดตั้งง่าย ราคาเริ่มต้นต่ำสุด`,
      `แขวนใต้ฝ้า — ห้องยาว ร้านค้า สำนักงาน ลมเกาะแนวฝ้าไปได้ราว ${FIT_RULES.ceiling.throw} ม.`,
      `สี่ทิศทาง (ฝังฝ้า) — กลางห้อง ร้านอาหาร โถง ลมออก 4 ทิศ รัศมีราว ${FIT_RULES.cassette.throw} ม. ต้องมีช่องเหนือฝ้าให้ตัวเครื่อง`,
      'ตู้ตั้งพื้น — พื้นที่ใหญ่ที่เจาะฝ้าไม่ได้ ห้องประชุม โชว์รูม'),
      P('ระยะลมเป็นค่าทั่วไปของแต่ละประเภท รุ่นจริงต่างกันได้ ส่วนระบบ VRV / VRF ที่ต่อคอยล์เย็นหลายตัวเข้าคอยล์ร้อนชุดเดียวเป็นงานโครงการ ติดต่อทีมแยก')],
    try: [['ดูการทำงานแบบ 3 มิติ', 'howto'], ['ลองวางในห้องของคุณ', 'fit']] },
  { id: 'inverter', aud: 'home', th: 'อินเวอร์เตอร์ กับ ระบบธรรมดา', lead: 'ต่างกันที่การปรับรอบคอมเพรสเซอร์', min: 2,
    body: () => [L('อินเวอร์เตอร์ปรับรอบคอมเพรสเซอร์ตามความร้อนในห้อง เมื่อห้องเย็นแล้วจะเบาลง อุณหภูมินิ่งกว่า ไม่ตัด–ต่อบ่อย', 'ระบบธรรมดา (Fixed speed) ทำงานเต็มกำลังแล้วตัด ราคาเครื่องต่ำกว่า เหมาะห้องที่เปิดไม่กี่ชั่วโมงต่อวัน'),
      P('ห้องที่เปิดนานหลายชั่วโมงต่อวัน รุ่นอินเวอร์เตอร์มักใช้ไฟรวมน้อยกว่า ผลจริงขึ้นกับรุ่น การใช้งาน และการล้างตามรอบ ดูค่าไฟโดยประมาณได้ในห้องจำลอง')],
    try: [['เทียบรุ่นอินเวอร์เตอร์', 'catalog'], ['ค่าไฟในห้องจำลอง', 'studio']] },
  { id: 'clean', aud: 'all', th: 'ควรล้างแอร์บ่อยแค่ไหน', lead: 'รอบล้างตามประเภทห้อง และสัญญาณว่าถึงรอบแล้ว', min: 2,
    body: () => [P('รอบที่แนะนำตามแนวปฏิบัติทั่วไป:'),
      L('บ้าน 6 เดือน (ห้องนั่งเล่นที่เปิดทั้งวัน 4 เดือน)', 'สำนักงาน คลินิก ร้านค้า 3 เดือน', 'ครัว ร้านอาหาร โรงงาน คลังสินค้า 2 เดือน', 'ห้อง Server 6 เดือน'),
      P('สัญญาณว่าถึงรอบ: ลมเบาลง เย็นช้า มีกลิ่นอับ น้ำหยด หรือเสียงดังขึ้น แผ่นกรองล้างเองได้ทุก 2–4 สัปดาห์ แต่ไม่ควรฉีดน้ำแรงดันเอง เพราะแผงวงจรต้องคลุมกันน้ำก่อนทุกครั้ง')],
    try: [['เลื่อนดูฝุ่น 0–18 เดือน', 'studio'], ['ดูข้างในเครื่อง', 'inside'], ['ราคาล้าง', 'prices']] },
  { id: 'c1c2', aud: 'all', th: 'ล้างปกติ (C1) กับ ล้างใหญ่ (C2)', lead: 'ต่างกันที่การปลดเครื่องและชิ้นส่วนที่ถอดล้าง', min: 2,
    body: () => [L(...METHOD_INFO.filter(m => m.id !== 'C3').map(m => `${m.th} — ${m.d}`)),
      P('เลือกล้างใหญ่เมื่อเห็นคราบดำที่ใบพัด กลิ่นอับไม่หายหลังล้างปกติ หรือไม่ได้ล้างมานาน ทุกงานเรียงตามแบบฟอร์มรายงานของบริษัท และแจ้งราคาก่อนเริ่มงาน')],
    try: [['ดูทีมช่างล้าง C1 / C2 และติดตั้ง ทีละขั้น', 'cleanflow'], ['ราคาล้างทุกประเภท', 'prices']] },
  { id: 'install', aud: 'all', th: 'ติดตั้งมาตรฐานของเรารวมอะไร', lead: 'ระยะท่อที่รวม วัสดุที่ระบุยี่ห้อ และการทดสอบก่อนส่งมอบ', min: 3,
    body: () => [L(`รวมท่อน้ำยาและวัสดุ ${FIT_RULES.pipeIncluded} เมตรแรก ท่อน้ำทิ้ง สายไฟตามระยะที่ระบุ เบรกเกอร์ ขาแขวน`,
      'วัสดุ: ท่อทองแดง O-TWO หนา 0.70 มม. · ฉนวน Aeroflex · ราง Airpro · สายไฟ Yazaki · ท่อน้ำทิ้ง SCG · เบรกเกอร์กันดูด NANO RCBO',
      'ก่อนส่งมอบ: Vacuum ไล่ความชื้นในท่อ ตรวจรอยต่อ ทดสอบน้ำทิ้ง วัดกระแสและแรงดันไฟ Test Run และใบรับมอบงาน',
      'รับประกันงานติดตั้ง 3 ปี เมื่อซื้อเครื่องใหม่จากบริษัท · 1 ปี เมื่อลูกค้าจัดหาเครื่องเอง (ตามเงื่อนไขในใบเสนอราคา)'),
      P('ส่วนที่เกินจากที่รวม เช่น ท่อยาวขึ้น ปั๊มน้ำทิ้ง งานสูง เลือกเพิ่มได้ในหน้าสินค้า รายการที่ขึ้นกับหน้างานจริงจะแจ้งราคาก่อนเริ่มงาน')],
    try: [['ดูวัสดุแบบ 3 มิติ', 'quality'], ['ลองวางในห้อง + คำนวณท่อ', 'fit']] },
  { id: 'place', aud: 'home', th: 'ตำแหน่งติดตั้งที่ดี', lead: 'ระยะห่างฝ้า ผนัง ความสูง และที่วางคอยล์ร้อน', min: 2,
    body: () => [L(`แอร์ติดผนัง: เว้นห่างฝ้าอย่างน้อย ${cm(FIT_RULES.wall.top)} ซม. ซ้าย–ขวา ${cm(FIT_RULES.wall.side)} ซม. ใต้เครื่องสูงจากพื้นราว ${FIT_RULES.wall.bestBottom[0].toFixed(1)}–${FIT_RULES.wall.bestBottom[1].toFixed(1)} ม.`,
      'ห้องยาว ติดเครื่องที่ผนังด้านแคบเพื่อให้ลมพุ่งตามความยาวห้อง และไม่เป่าตรงหัวเตียงหรือโต๊ะทำงาน',
      `สี่ทิศทาง: ขอบหน้ากากห่างผนังอย่างน้อย ${cm(FIT_RULES.cassette.wall)} ซม. ทุกด้าน`,
      `คอยล์ร้อน: วางที่ระบายอากาศดี ไม่อับ ใกล้ตัวเครื่องเพื่อให้ท่อสั้น (ราคารวมท่อ ${FIT_RULES.pipeIncluded} เมตรแรก)`),
      P('ค่าเหล่านี้เป็นค่าแนะนำทั่วไป ทีมช่างยืนยันตามคู่มือของรุ่นจริงตอนสำรวจ')],
    try: [['ลองวางในห้องของคุณ', 'fit']] },
  { id: 'contract', aud: 'biz', th: 'สัญญาล้างรายปีสำหรับองค์กร', lead: 'วางรอบทั้งปี รายงานทุกรอบ วางบิลตามรอบ', min: 2,
    body: () => [L('ทีมวางรอบล่วงหน้าทั้งปี ส่งรายงานตามแพ็กเกจหลังทุกรอบ และวางบิลตามรอบ',
      'ราคาบนเว็บเป็นอัตรามาตรฐานต่อเครื่องต่อครั้ง (ก่อน VAT) สัญญารายปีมีราคาขั้นบันได: 10–29 เครื่อง ลด 3% · 30–59 ลด 5% · 60 ขึ้นไป ลด 7% จากยอดสัญญา ตั้งแต่ 100 เครื่องขอราคาโครงการได้',
      `งานล้างมียอดขั้นต่ำต่อการเข้าหน้างาน ${baht(DATA.minBill)} ก่อน VAT`,
      `กำลังทีมต่อวันตามคู่มือบริษัท: ติดผนังราว ${PRICING.unitsPerTeamDay.wall} เครื่อง · แขวน / สี่ทิศทางราว ${PRICING.unitsPerTeamDay.cassette} เครื่อง ต่อทีม-วัน`)],
    try: [['คำนวณงบทั้งปี', 'b2b']] },
  { id: 'packages', aud: 'biz', th: 'แพ็กเกจล้าง 3 ระดับ ต่างกันอย่างไร', lead: 'เอกสาร ภาพ ค่าตรวจวัด และระยะรับประกันงานล้าง', min: 3,
    body: () => PKG_INFO.map(p => h('div', { class: 'kh-pk' }, h('b', {}, `${p.code} ${p.id} · ${p.pitch}`), h('small', {}, `เหมาะกับ: ${p.fit}`), L(...p.gets, `ดูแลหลังบริการ: ${p.care}`))),
    try: [['เทียบราคาแพ็กเกจ', 'prices'], ['คำนวณงบทั้งปี', 'b2b']] },
  { id: 'docs', aud: 'biz', th: 'เอกสารที่องค์กรได้รับ', lead: 'สำหรับฝ่ายอาคาร จัดซื้อ และบัญชี', min: 1,
    body: () => [L('ใบเสนอราคาแยกรายการ ระบุยี่ห้อและสเปกวัสดุ สิ่งที่รวมและไม่รวม', 'ใบกำกับภาษีเต็มรูป', 'รายงานหลังงานตามแพ็กเกจ: ใบรับมอบงาน · Service Report พร้อมภาพ · ทะเบียนทรัพย์สินรายเครื่อง', 'งานติดตั้ง: ใบรับมอบงาน ค่าหลังติดตั้ง และเงื่อนไขรับประกัน')],
    try: [['ดูตัวอย่างขั้นตอนและค่าที่บันทึก', 'howto'], ['ขอใบเสนอราคา', 'quote']] },
  { id: 'vrf', aud: 'biz', th: 'ระบบ VRV / VRF', lead: 'งานโครงการแยก ออกแบบตามอาคารจริง', min: 1,
    body: () => [P(VRF_NOTE), P('ล้างและติดตั้งแอร์ทุกประเภทอื่นมีราคามาตรฐานบนเว็บ ส่วน VRV / VRF ทีมโครงการจะสำรวจ ออกแบบท่อและคอนโทรล แล้วทำ BOQ ให้')],
    try: [['ติดต่อสอบถาม VRV / VRF', 'ask:ระบบ VRV / VRF']] },
  { id: 'area', aud: 'all', th: 'พื้นที่บริการและค่าเดินทาง', lead: 'กรุงเทพฯ และปริมณฑลไม่มีค่าเดินทาง', min: 1,
    body: () => [L('กรุงเทพฯ นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร ไม่มีค่าเดินทาง',
      ...TRAVEL.bands.map(b => `ระยะ ${b.th}: ${baht(b.fee(0))} ก่อน VAT ต่อเที่ยว${b.minUnits > 1 ? ` · ขั้นต่ำ ${b.minUnits} เครื่อง` : ''}${b.waiveAt ? ` · ยกเว้นเมื่อ ${b.waiveAt} เครื่องขึ้นไป` : ''}`),
      `ไกลกว่า ${TRAVEL.maxKm} กม. รับเป็นงานโครงการหรือสัญญา`)],
    try: [['เช็กพื้นที่ของคุณ', 'area']] },
];

export function mountKnowledge(root, { ids = {} } = {}) {
  root.classList.add('kh'); root.innerHTML = '';
  const AUD = [{ id: 'all', th: 'ทั้งหมด' }, { id: 'home', th: 'บ้าน · คอนโด' }, { id: 'biz', th: 'องค์กร · อาคาร' }];
  let aud = 'all', q = '';
  const seg = h('div', { class: 'kh-seg', role: 'group', 'aria-label': 'สำหรับ' });
  AUD.forEach(a => seg.append(h('button', { type: 'button', 'aria-pressed': a.id === aud, onclick: e => { aud = a.id; $$('button', seg).forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); draw(); } }, a.th)));
  const search = h('input', { type: 'search', class: 'kh-q', placeholder: 'ค้นหา เช่น BTU, ล้างใหญ่, ท่อ', 'aria-label': 'ค้นหาความรู้' });
  search.addEventListener('input', () => { q = search.value.trim(); draw(); });
  const grid = h('div', { class: 'kh-grid' });
  root.append(h('div', { class: 'kh-bar' }, seg, search), grid, h('p', { class: 'kh-note' }, 'ข้อมูลทั่วไปเพื่อประกอบการตัดสินใจ ตัวเลขดึงจากเครื่องมือและราคามาตรฐานบนเว็บ ทีมช่างยืนยันตามหน้างานและรุ่นจริง'));
  const go = key => {
    if (key.startsWith('ask:')) { askTeam(key.slice(4)); return; }
    const el = document.getElementById(ids[key] || key);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };
  function draw() {
    grid.innerHTML = '';
    const list = GUIDES.filter(g => (aud === 'all' || g.aud === aud || g.aud === 'all') && (!q || (g.th + g.lead).includes(q) || g.body().some(n => n.textContent.includes(q))));
    if (!list.length) grid.append(h('p', { class: 'kh-note' }, 'ไม่พบหัวข้อที่ค้นหา'));
    list.forEach(g => {
      const tries = g.try.filter(([, k]) => k.startsWith('ask:') || ids[k] || document.getElementById(k));
      grid.append(h('details', { class: 'kh-card', id: `kh-${g.id}` },
        h('summary', {}, h('span', { class: 'kh-aud' }, g.aud === 'biz' ? 'องค์กร' : g.aud === 'home' ? 'บ้าน' : 'ทุกคน', ` · อ่าน ${g.min} นาที`), h('b', {}, g.th), h('small', {}, g.lead)),
        h('div', { class: 'kh-body' }, g.body(), tries.length ? h('div', { class: 'kh-try' }, h('span', {}, 'ลองเอง:'), tries.map(([th, k]) => h('button', { type: 'button', class: 's-btn', onclick: () => go(k) }, th))) : null)));
    });
  }
  draw();
}
