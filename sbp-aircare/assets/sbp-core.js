// SBP AirCare prototype core — shared data + business logic (no rendering).
// Data source: assets/sbp-data.json, extracted from the company's approved price files
//   "ใบเสนอราคาติดตั้งแอร์ Final จริง.xlsx" (714 models, 194 install/add-on items)
//   "ใบเสนอราคาล้างและซ่อม Final จริง.xlsx" (cleaning pricebook 3 packages × C1/C2, 86 repair items)
// All source prices are before VAT.
// Rev.09 r9 owner decision (written, 2 ต.ค. 2569): every price on the web is a ROUND HUNDRED and is shown BEFORE VAT.
//   · r100() rounds each Pricebook price to the nearest hundred (half up: 650 → 700, 550 → 600) once, in loadData() —
//     sbp-data.json stays identical to the Pricebook; tools_recon.py checks the same rule.
//   · individual customers (no tax invoice) pay the shown price · companies that want a tax invoice pay shown price + VAT 7%.
export const VAT = 0.07;
export const incVat = n => Math.round(n * (1 + VAT));   // tax-invoice customers only (quote basket / contract), never a list price
export const vatOf = ex => Math.round(ex * VAT);
export const r100 = n => (n == null ? n : Math.round(n / 100) * 100);
// who pays VAT: chosen in the quote basket and the contract calculator
export const TAX_MODES = [
  { id: 'none', th: 'บุคคลทั่วไป', sub: 'ไม่ต้องการใบกำกับภาษี ชำระตามราคาที่แสดง' },
  { id: 'invoice', th: 'นิติบุคคล / ต้องการใบกำกับภาษี', sub: 'ราคาที่แสดง + VAT 7% ออกใบกำกับภาษีเต็มรูป' },
];
export const PRICE_NOTE = 'ราคาก่อน VAT · บุคคลทั่วไปชำระตามราคานี้ · ต้องการใบกำกับภาษี บวก VAT 7%';
export const withTax = (ex, mode) => (mode === 'invoice' ? { ex, vat: vatOf(ex), total: ex + vatOf(ex) } : { ex, vat: 0, total: ex });

/* ---------- taxonomy ---------- */
export const TYPES = [
  { id: 'wall',     th: 'ติดผนัง',            en: 'Wall type',          color: '#1B5AA8', code: 'W',  clean: 'ติดผนัง' },
  { id: 'ceiling',  th: 'แขวนใต้ฝ้า',          en: 'Ceiling suspended',  color: '#7A4FB5', code: 'C',  clean: 'แขวนใต้ฝ้า' },
  { id: 'cassette', th: 'สี่ทิศทาง',           en: 'Cassette',           color: '#0E8C7A', code: 'K',  clean: 'สี่ทิศทาง' },
  { id: 'floor',    th: 'ตู้ตั้งพื้น',            en: 'Floor standing',     color: '#B4560D', code: 'FS', clean: 'ตั้งพื้น/ตั้งตู้' },
  { id: 'duct',     th: 'ซ่อนในฝ้า / ท่อลม',   en: 'Ducted / concealed', color: '#5A6675', code: 'DUCT', clean: 'ซ่อนในฝ้า/ต่อท่อลม' },
];
export const TYPE_BY_ID = Object.fromEntries(TYPES.map(t => [t.id, t]));
const TYPE_FROM_CLEAN = Object.fromEntries(TYPES.map(t => [t.clean, t.id]));

export const BRANDS = [];          // filled by loadData()
export const BRAND_BY_ID = {};
export const DEMO = { models: [], skuCount: 0 };   // name kept for compatibility: now real catalog
export const DATA = { inst: [], instByCode: {}, clean: [], rep: [], minBill: 4500, version: '', loaded: false };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function loadData(url) {
  if (DATA.loaded) return DATA;
  // single-file builds inline the data as globalThis.__SBP_DATA; the multi-file prototype fetches it
  const j = globalThis.__SBP_DATA || await (await fetch(url || new URL('./sbp-data.json', import.meta.url))).json();
  const S = i => (i == null || i < 0 ? null : j.pool[i]);
  DATA.version = j.v; DATA.minBill = r100(j.minBill);
  // products -> series cards
  const groups = new Map();
  let skuCount = 0;
  for (const r of j.prods) {
    const [type, brand, model, btu, px, ix, approved, se, sys, ref, pl, pg, idim, iwt, odim, owt, pw, comp, war, lead, od, lmax, hmax] = r;
    const d = { series: S(se), system: S(sys), refrigerant: S(ref), pipeLiquid: S(pl), pipeGas: S(pg), indoorDim: S(idim), indoorKg: S(iwt), outdoorDim: S(odim), outdoorKg: S(owt), power: S(pw), compressor: S(comp), warranty: S(war), lead: S(lead), outdoorModel: S(od), maxPipe: S(lmax), maxLift: S(hmax), approved: !!approved };
    const bid = slug(brand);
    if (!BRAND_BY_ID[bid]) { const b = { id: bid, name: brand, n: 0 }; BRANDS.push(b); BRAND_BY_ID[bid] = b; }
    BRAND_BY_ID[bid].n++;
    const inverter = /inverter/i.test(d.system || '');
    const key = [bid, d.series || model, type, inverter].join('|');
    if (!groups.has(key)) groups.set(key, { id: slug(key), code: model, brand: bid, type, inverter, label: d.refrigerant || '—', series: (d.series || model) + (/inverter|fixed/i.test(d.series || '') ? '' : inverter ? ' · Inverter' : d.system ? ' · ' + d.system : ''), popular: false, isNew: false, skus: [] });
    groups.get(key).skus.push({ sku: model, btu, px: r100(px), price: r100(px), installStdEx: r100(ix), stock: 'check', d });
    skuCount++;
  }
  DEMO.models = [...groups.values()].map(m => (m.skus.sort((a, b) => a.btu - b.btu), m.code = m.skus[0].sku, m));
  DEMO.skuCount = skuCount;
  BRANDS.sort((a, b) => b.n - a.n);
  const fj = { id: 'fujiva', name: 'FUJIVA', own: true, n: 0 }; BRANDS.unshift(fj); BRAND_BY_ID.fujiva = fj;
  // install + add-on items
  // Owner decision (Rev.07): the web sells Standard + Premium installation only (premium-grade materials in every job);
  // the Basic/MASS tier stays in the Pricebook for the sales team. Copper brand shown as O-TWO (Pricebook to be updated to match).
  // Rev.08 owner decision: the web shows one copper spec only — O-TWO 0.70 mm. Type L / project-grade copper stays in the Pricebook (QTN/BOQ work) but is not listed on the web.
  const brand = t => t == null ? t : t.replace(/K Copper Type L/g, 'O-TWO').replace(/K Copper/g, 'O-TWO').replace(/ท่อน้ำยาทองแดง 0\.70 มม\./g, 'ท่อน้ำยาทองแดง O-TWO 0.70 มม.').replace(/ท่อ Type L หรือ Project-grade ใช้เมื่อระบุใน QTN\/BOQ;\s*ไม่รวมอัตโนมัติหากไม่ระบุ;\s*/g, '');
  DATA.inst = j.inst.map(([c, cat, n, u, p, inc, exc, w, sv]) => ({ code: c, cat: S(cat), name: brand(n), unit: S(u), ex: r100(p), inc: brand(S(inc)), exc: S(exc), warranty: S(w), survey: S(sv) })).filter(i => !/-MASS$/.test(i.code) && !/^MAT-CU-L-/.test(i.code));
  DATA.instByCode = Object.fromEntries(DATA.inst.map(i => [i.code, i]));
  DATA.clean = j.clean.map(([pk, lv, ty, rg, u, s, sp, pj, w, care, doc, inc, exc, st, n]) => ({ pkg: S(pk), level: lv, ty: S(ty), type: TYPE_FROM_CLEAN[S(ty)] || null, range: S(rg), unit: S(u), rate: { s: r100(s), sp: null, pj: null }, warranty: S(w), care: S(care), doc: S(doc), inc: S(inc), exc: S(exc), status: S(st), name: n }));
  DATA.rep = j.rep.map(([ty, n, u, s, sp, pj, w, inc, exc, st]) => ({ cat: S(ty), name: n.replace(/^ซ่อมแอร์:\s*/, ''), unit: S(u), rate: { s: r100(s), sp: null, pj: null }, warranty: S(w), inc: S(inc), exc: S(exc), status: S(st) }));
  // headline "from" prices for service cards
  const minOf = arr => Math.min(...arr.filter(x => x != null));
  const c1 = DATA.clean.filter(r => r.pkg === 'Basic Clean' && r.level === 'C1' && r.type).map(r => r.rate.s);
  const ins = DATA.inst.filter(i => /^INS-/.test(i.code) && i.ex).map(i => i.ex);
  const dia = DATA.rep.filter(r => r.cat === 'ตรวจวินิจฉัย').map(r => r.rate.s);
  const set = (id, from) => { const s = SERVICES.find(x => x.id === id); if (s) s.from = from; };
  set('clean', `เริ่ม ${baht(minOf(c1))} / เครื่อง`);
  set('install', `เริ่ม ${baht(minOf(ins))} / เครื่อง`);
  set('repair', `ค่าตรวจเริ่ม ${baht(minOf(dia))}`);
  DATA.loaded = true;
  return DATA;
}

export const stockTh = s => (s.stock === 'ready' ? 'พร้อมส่ง' : s.stock === 'order' ? 'สั่งจอง' : 'ยืนยันสต็อกก่อนสั่ง');

/* ---------- install packages + add-ons for one SKU ---------- */
const INS_LEVELS = [
  { key: 'STANDARD', th: 'มาตรฐาน', note: 'แนะนำ · รับประกันงานติดตั้งตามเงื่อนไข 1–3 ปี' },
  { key: 'PREMIUM', th: 'พรีเมียม', note: 'เพิ่ม Support และงานเก็บรายละเอียด' },
];
export function installOptions(type, btu) {
  const code = TYPE_BY_ID[type]?.code;
  const bands = [...new Set(DATA.inst.filter(i => i.code.startsWith(`INS-${code}-`) && !/SURVEY/.test(i.code)).map(i => i.code.split('-').slice(2, 4).join('-')))]
    .map(b => ({ b, lo: +b.split('-')[0], hi: +b.split('-')[1] })).sort((a, b) => a.lo - b.lo);
  const band = bands.find(x => btu <= x.hi);
  if (!band) return [];
  return INS_LEVELS.map(l => ({ ...l, item: DATA.instByCode[`INS-${code}-${band.b}-${l.key}`] })).filter(o => o.item);
}
const PIPE_SET = [[12000, 'PIP-PKG-1438'], [18000, 'PIP-PKG-1412'], [24000, 'PIP-PKG-1458'], [36000, 'PIP-PKG-3858'], [48000, 'PIP-PKG-3834'], [60000, 'PIP-PKG-3878']];
export function addonsFor(type, btu) {
  const I = c => DATA.instByCode[c];
  const pipe = I((PIPE_SET.find(([m]) => btu <= m) || PIPE_SET[PIPE_SET.length - 1])[1]);
  const rem = { wall: 'REM-W', ceiling: 'REM-C', cassette: 'REM-K', floor: 'REM-FS', duct: 'REM-DUCT' }[type];
  return [
    { group: 'วัสดุส่วนเกิน', items: [
      { item: pipe, qty: 'm', note: 'ในราคาติดตั้งรวมท่อ 4 เมตรแรกแล้ว ใส่เฉพาะส่วนที่เกิน' },
      { item: I('MAT-SCG-DRAIN-34'), qty: 'm' },
    ] },
    { group: 'ระบบไฟ', items: [
      { choose: ['ELE-MAIN-1P-2.5', 'ELE-MAIN-1P-4', 'ELE-MAIN-1P-6'].map(I), qty: 'm', note: 'ช่างยืนยันขนาดสายตามกระแสของรุ่นก่อนติดตั้ง' },
      { choose: ['ELE-NANO-RCBO20', 'ELE-NANO-RCBO32'].map(I), qty: 'pc' },
    ] },
    { group: 'น้ำทิ้งและงานอื่น', items: [
      { item: I('DRAIN-PUMP-15'), qty: 'pc' }, { item: I('DRAIN-TRAP-34'), qty: 'pc' }, { item: I('FIRESTOP-4'), qty: 'pc' },
    ] },
    { group: 'ประเมินหน้างาน (ไม่มีราคาตายตัว)', items: [
      { item: I(rem), qty: 'flag' }, { item: I('DISPOSE'), qty: 'flag' }, { item: I('ACC-HEIGHT'), qty: 'flag' }, { item: I('SUP-STD'), qty: 'flag' },
      { item: I('CIV-CHASE'), qty: 'flag' }, { item: I('CIV-CEIL'), qty: 'flag' }, { item: I('LOG-NIGHT'), qty: 'flag' }, { item: I('LOG-SUN'), qty: 'flag' },
    ].filter(x => x.item) },
  ];
}

/* ---------- catalog query ---------- */
export const PRICE_BANDS = [
  { id: 'p1', th: 'ต่ำกว่า 15,000', min: 0, max: 15000 },
  { id: 'p2', th: '15,000–25,000', min: 15000, max: 25000 },
  { id: 'p3', th: '25,000–40,000', min: 25000, max: 40000 },
  { id: 'p4', th: '40,000–70,000', min: 40000, max: 70000 },
  { id: 'p5', th: '70,000 ขึ้นไป', min: 70000, max: Infinity },
];
export const BTU_BANDS = [
  { id: 'b1', th: '≤ 12,000', min: 0, max: 12000 },
  { id: 'b2', th: '12,001–18,000', min: 12001, max: 18000 },
  { id: 'b3', th: '18,001–30,000', min: 18001, max: 30000 },
  { id: 'b4', th: '30,001–48,000', min: 30001, max: 48000 },
  { id: 'b5', th: '> 48,000', min: 48001, max: Infinity },
];
export function emptyFilter() { return { q: '', type: new Set(), brand: new Set(), btu: new Set(), price: new Set(), inverter: '', sort: 'rec' }; }
function skuMatches(sku, f) {
  if (f.btu.size && ![...f.btu].some(id => { const b = BTU_BANDS.find(x => x.id === id); return sku.btu >= b.min && sku.btu <= b.max; })) return false;
  if (f.price.size && ![...f.price].some(id => { const b = PRICE_BANDS.find(x => x.id === id); return sku.price >= b.min && sku.price < b.max; })) return false;
  return true;
}
function modelMatches(m, f, skip) {
  if (skip !== 'type' && f.type.size && !f.type.has(m.type)) return false;
  if (skip !== 'brand' && f.brand.size && !f.brand.has(m.brand)) return false;
  if (skip !== 'inverter' && f.inverter && (f.inverter === 'inv') !== m.inverter) return false;
  if (f.q) {
    const q = f.q.toLowerCase().replace(/[,\s\-\/]/g, '');
    const hay = (m.series + BRAND_BY_ID[m.brand].name + TYPE_BY_ID[m.type].th + m.skus.map(s => s.sku + s.btu).join('')).toLowerCase().replace(/[,\s\-\/]/g, '');
    if (!hay.includes(q)) return false;
  }
  const g = { ...f };
  if (skip === 'btu') g.btu = new Set();
  if (skip === 'price') g.price = new Set();
  return m.skus.some(s => skuMatches(s, g));
}
export function queryCatalog(f) {
  let list = DEMO.models.filter(m => modelMatches(m, f));
  const minP = m => Math.min(...m.skus.filter(s => skuMatches(s, f)).map(s => s.price));
  if (f.sort === 'price-asc') list.sort((a, b) => minP(a) - minP(b));
  else if (f.sort === 'price-desc') list.sort((a, b) => minP(b) - minP(a));
  else if (f.sort === 'btu') list.sort((a, b) => a.skus[0].btu - b.skus[0].btu);
  else list.sort((a, b) => TYPES.findIndex(t => t.id === a.type) - TYPES.findIndex(t => t.id === b.type) || BRAND_BY_ID[b.brand].n - BRAND_BY_ID[a.brand].n || a.skus[0].btu - b.skus[0].btu);
  const skuTotal = list.reduce((n, m) => n + m.skus.filter(s => skuMatches(s, f)).length, 0);
  return { list, skuTotal, visibleSkus: m => m.skus.filter(s => skuMatches(s, f)) };
}
export function facetCounts(f) {
  const out = { type: {}, brand: {}, btu: {}, price: {}, inverter: {} };
  const base = key => DEMO.models.filter(m => modelMatches(m, f, key));
  const bt = base('type'); TYPES.forEach(t => out.type[t.id] = bt.filter(m => m.type === t.id).length);
  const bb = base('brand'); BRANDS.forEach(b => out.brand[b.id] = bb.filter(m => m.brand === b.id).length);
  const bu = base('btu'); BTU_BANDS.forEach(b => out.btu[b.id] = bu.filter(m => m.skus.some(s => s.btu >= b.min && s.btu <= b.max && skuMatches(s, { ...f, btu: new Set() }))).length);
  const bp = base('price'); PRICE_BANDS.forEach(b => out.price[b.id] = bp.filter(m => m.skus.some(s => s.price >= b.min && s.price < b.max && skuMatches(s, { ...f, price: new Set() }))).length);
  const bi = base('inverter'); out.inverter.inv = bi.filter(m => m.inverter).length; out.inverter.fix = bi.filter(m => !m.inverter).length;
  return out;
}
export function filterToParams(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  for (const k of ['type', 'brand', 'btu', 'price']) if (f[k].size) p.set(k, [...f[k]].join(','));
  if (f.inverter) p.set('inv', f.inverter);
  if (f.sort !== 'rec') p.set('sort', f.sort);
  return p.toString();
}

/* ---------- formatting ---------- */
export const baht = n => '฿' + Math.round(n).toLocaleString('en-US');
export const btuFmt = n => n.toLocaleString('en-US') + ' BTU';
export const kbtu = n => (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k';

/* ---------- service area: Bangkok + 4 vicinity provinces; nearby provinces by road distance ---------- */
export const HQ = { th: 'สำนักงานใหญ่ พระราม 2 ซอย 31', lat: 13.664, lon: 100.44 };   // approximate point
// Rev.09 r5 — company facts for the about / contact blocks. Email from the owner (2 ต.ค. 2569); address, phone and years from the
// company's public listings (sahaburapa.com / sahaburapagroup.com contact pages via search — the sites themselves were not reachable
// from the build environment) → owner to confirm. Tax id, LINE OA, opening hours: not shown until the owner supplies them.
// owner-supplied company logos (2 ต.ค. 2569): sbp = SP "QUALITY BRAND" company mark · fujiva = FUJIVA brand
export const logoSrc = key => (globalThis.__SBP_LOGOS && globalThis.__SBP_LOGOS[key]) || new URL(`./logos/${key}.png`, import.meta.url).href;
export const COMPANY = {
  th: 'บริษัท สหบูรพากรุ๊ป จำกัด', en: 'Saha Burapa Group Co., Ltd.', brand: 'SBP AirCare', service: 'Sahaburapa Service',
  addr: '593 ถนนพระราม 2 แขวงบางมด เขตจอมทอง กรุงเทพฯ 10150', tel: '02-459-3291-9', telHref: 'tel:024593291', email: 'Sahaburapa.official@gmail.com',
  web: 'www.sahaburapa.com', webUrl: 'https://www.sahaburapa.com', years: 'กว่า 30 ปี',
  trade: 'จำหน่ายและนำเข้าน้ำยาแอร์ อุปกรณ์ เครื่องมือ และอะไหล่แอร์ ทั้งปลีกและส่ง',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('สหบูรพากรุ๊ป 593 ถนนพระราม 2 บางมด จอมทอง กรุงเทพฯ'),
};
export const ZONES = [
  { province: 'กรุงเทพมหานคร', tier: 'core', districts: ['พระนคร','ดุสิต','หนองจอก','บางรัก','บางเขน','บางกะปิ','ปทุมวัน','ป้อมปราบศัตรูพ่าย','พระโขนง','มีนบุรี','ลาดกระบัง','ยานนาวา','สัมพันธวงศ์','พญาไท','ธนบุรี','บางกอกใหญ่','ห้วยขวาง','คลองสาน','ตลิ่งชัน','บางกอกน้อย','บางขุนเทียน','ภาษีเจริญ','หนองแขม','ราษฎร์บูรณะ','บางพลัด','ดินแดง','บึงกุ่ม','สาทร','บางซื่อ','จตุจักร','บางคอแหลม','ประเวศ','คลองเตย','สวนหลวง','จอมทอง','ดอนเมือง','ราชเทวี','ลาดพร้าว','วัฒนา','บางแค','หลักสี่','สายไหม','คันนายาว','สะพานสูง','วังทองหลาง','คลองสามวา','บางนา','ทวีวัฒนา','ทุ่งครุ','บางบอน'] },
  { province: 'นนทบุรี', tier: 'core', districts: ['เมืองนนทบุรี','บางกรวย','บางใหญ่','บางบัวทอง','ไทรน้อย','ปากเกร็ด'] },
  { province: 'ปทุมธานี', tier: 'core', districts: ['เมืองปทุมธานี','คลองหลวง','ธัญบุรี','หนองเสือ','ลาดหลุมแก้ว','ลำลูกกา','สามโคก'] },
  { province: 'สมุทรปราการ', tier: 'core', districts: ['เมืองสมุทรปราการ','บางบ่อ','บางพลี','พระประแดง','พระสมุทรเจดีย์','บางเสาธง'] },
  { province: 'สมุทรสาคร', tier: 'core', districts: ['เมืองสมุทรสาคร','กระทุ่มแบน','บ้านแพ้ว'] },
];
// nearby places with approximate coordinates (district office level). Production: Google Distance Matrix from the job address.
export const NEARBY = [
  ['นครปฐม', 'เมืองนครปฐม', 13.819, 100.062], ['นครปฐม', 'สามพราน', 13.724, 100.215], ['นครปฐม', 'พุทธมณฑล', 13.802, 100.322], ['นครปฐม', 'นครชัยศรี', 13.803, 100.186], ['นครปฐม', 'บางเลน', 14.022, 100.169], ['นครปฐม', 'ดอนตูม', 13.962, 100.087], ['นครปฐม', 'กำแพงแสน', 14.005, 99.99],
  ['สมุทรสงคราม', 'เมืองสมุทรสงคราม', 13.409, 100.001], ['สมุทรสงคราม', 'อัมพวา', 13.425, 99.955],
  ['พระนครศรีอยุธยา', 'พระนครศรีอยุธยา', 14.353, 100.568], ['พระนครศรีอยุธยา', 'บางปะอิน', 14.228, 100.578], ['พระนครศรีอยุธยา', 'วังน้อย', 14.237, 100.714], ['พระนครศรีอยุธยา', 'บางไทร', 14.195, 100.476], ['พระนครศรีอยุธยา', 'อุทัย', 14.365, 100.683], ['พระนครศรีอยุธยา', 'เสนา', 14.327, 100.405],
  ['ฉะเชิงเทรา', 'เมืองฉะเชิงเทรา', 13.689, 101.071], ['ฉะเชิงเทรา', 'บางปะกง', 13.504, 100.967], ['ฉะเชิงเทรา', 'บ้านโพธิ์', 13.593, 101.083], ['ฉะเชิงเทรา', 'บางน้ำเปรี้ยว', 13.843, 101.052], ['ฉะเชิงเทรา', 'บางคล้า', 13.72, 101.21],
  ['ชลบุรี', 'เมืองชลบุรี', 13.361, 100.985], ['ชลบุรี', 'ศรีราชา', 13.174, 100.93], ['ชลบุรี', 'บางละมุง', 12.925, 100.878], ['ชลบุรี', 'พานทอง', 13.466, 101.093], ['ชลบุรี', 'บ้านบึง', 13.314, 101.108],
  ['ราชบุรี', 'เมืองราชบุรี', 13.536, 99.817], ['ราชบุรี', 'บ้านโป่ง', 13.816, 99.878], ['ราชบุรี', 'โพธาราม', 13.692, 99.849], ['ราชบุรี', 'ดำเนินสะดวก', 13.519, 99.955],
  ['สุพรรณบุรี', 'เมืองสุพรรณบุรี', 14.474, 100.122], ['สระบุรี', 'เมืองสระบุรี', 14.528, 100.91], ['สระบุรี', 'หนองแค', 14.34, 100.873],
  ['นครนายก', 'เมืองนครนายก', 14.204, 101.213], ['ชลบุรี', 'พัทยา', 12.927, 100.877], ['ชลบุรี', 'แหลมฉบัง', 13.08, 100.9], ['ชลบุรี', 'บ่อวิน', 13.05, 101.1], ['ระยอง', 'เมืองระยอง', 12.681, 101.281], ['ระยอง', 'ปลวกแดง', 12.98, 101.21], ['สระบุรี', 'แก่งคอย', 14.586, 101.0], ['สระบุรี', 'หนองแซง', 14.5, 100.83], ['ฉะเชิงเทรา', 'แปลงยาว', 13.59, 101.29], ['กาญจนบุรี', 'เมืองกาญจนบุรี', 14.004, 99.548], ['เพชรบุรี', 'เมืองเพชรบุรี', 13.112, 99.94], ['ปราจีนบุรี', 'เมืองปราจีนบุรี', 14.051, 101.372], ['อ่างทอง', 'เมืองอ่างทอง', 14.589, 100.455],
].map(([province, district, lat, lon]) => ({ province, district, lat, lon }));
// Travel rule outside the 5 core provinces — modelled on published fees of Thai AC service shops (market survey 29 ก.ย. 2569):
// 300 flat for the next ring (e.g. +300 นครปฐม/สมุทรสาคร), 800 for 61–80 km bands, 5–10 บาท/กม. beyond a free radius,
// ~3,000/day for 150–200 km jobs. Amounts are before VAT, per trip (one-way road km from HQ).
// waiveAt / minUnits are cost-based proposals (no shop publishes them) — owner to confirm.
export const TRAVEL = {
  roadFactor: 1.35,
  bands: [
    { id: 'Z1', maxKm: 60, fee: () => 300, waiveAt: 4, minUnits: 1, th: 'ไม่เกิน 60 กม.' },
    { id: 'Z2', maxKm: 100, fee: () => 800, waiveAt: 8, minUnits: 3, th: '61–100 กม.' },
    { id: 'Z3', maxKm: 150, fee: () => 1500, waiveAt: null, minUnits: 5, th: '101–150 กม.' },
  ],
  maxKm: 150,
  perKm: 10,
  farDay: 3000,
  source: 'สำรวจราคาที่ร้านแอร์ในไทยประกาศบนเว็บ 18 แหล่ง (29 ก.ย. 2569)',
};
export const TIER_TH = {
  core: { th: 'อยู่ในพื้นที่ให้บริการ', note: 'กรุงเทพฯ และปริมณฑล ไม่มีค่าเดินทางเพิ่ม' },
  extended: { th: 'รับงานได้ มีค่าเดินทางเพิ่ม', note: 'นอกกรุงเทพฯ และปริมณฑล คิดค่าเดินทางต่อเที่ยวตามช่วงระยะทางจากสำนักงานใหญ่ ยกเว้นเมื่อจำนวนเครื่องถึงเกณฑ์' },
  out: { th: 'เกินระยะให้บริการ', note: 'เกินระยะที่รับงานรายเครื่อง ฝากข้อมูลไว้เพื่อประเมินเป็นงานโครงการหรือสัญญา' },
  unknown: { th: 'ไม่พบชื่อพื้นที่นี้', note: 'ลองพิมพ์ชื่อเขตหรืออำเภอ หรือให้ทีมตรวจสอบจากที่อยู่จริง' },
};
const norm = s => (s || '').replace(/\s|เขต|อำเภอ|อ\.|จังหวัด|จ\./g, '').toLowerCase();
const hav = (a, b, c, d) => { const R = 6371, t = x => x * Math.PI / 180; const dl = t(c - a), dn = t(d - b); const s = Math.sin(dl / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
export function travelFor(km) {
  const band = TRAVEL.bands.find(x => km <= x.maxKm);
  return band ? { fee: band.fee(km), band, minUnits: band.minUnits, waiveAt: band.waiveAt } : null;
}
// fee actually charged for a job with `units` machines (waived at volume); returns { fee, waived, short }
export function travelCharge(zone, units = 1) {
  if (!zone || zone.tier !== 'extended') return { fee: 0, waived: false, short: 0 };
  const waived = !!(zone.waiveAt && units >= zone.waiveAt);
  return { fee: waived ? 0 : zone.fee, waived, short: Math.max(0, (zone.minUnits || 1) - units) };
}
export const travelNote = z => z && z.tier === 'extended'
  ? `ค่าเดินทาง ${baht(z.fee)}/เที่ยว (${z.bandTh})${z.waiveAt ? ` · ยกเว้นเมื่อ ${z.waiveAt} เครื่องขึ้นไป` : ''}${z.minUnits > 1 ? ` · ขั้นต่ำ ${z.minUnits} เครื่อง` : ''}`
  : '';
export function checkZone(input) {
  const q = norm(input);
  if (q.length < 2) return null;
  // collect every candidate name, then keep the longest one that matches (so "พระนครศรีอยุธยา" never resolves to เขตพระนคร)
  const cands = [];
  for (const z of ZONES) { cands.push({ name: z.province, z }); z.districts.forEach(d => cands.push({ name: d, z })); }
  NEARBY.forEach(n => { cands.push({ name: n.district, n }); cands.push({ name: n.province, n: NEARBY.find(x => x.province === n.province) }); });
  const hit = cands.filter(c => { const k = norm(c.name); return k.includes(q) || q.includes(k); }).sort((a, b) => (norm(b.name) === q) - (norm(a.name) === q) || b.name.length - a.name.length)[0];
  if (hit && hit.z) return { ...hit.z, match: hit.name, tier: 'core', km: 0, fee: 0 };
  if (hit && hit.n) {
    const n = hit.n;
    const km = Math.round(hav(HQ.lat, HQ.lon, n.lat, n.lon) * TRAVEL.roadFactor);
    const t = travelFor(km);
    return { province: n.province, match: hit.name === n.province ? n.province : n.district, districts: [], km, tier: t ? 'extended' : 'out', fee: t ? t.fee : null, band: t ? t.band.id : null, bandTh: t ? t.band.th : '', minUnits: t ? t.minUnits : null, waiveAt: t ? t.waiveAt : null };
  }
  if (/^\d{5}$/.test(q)) {
    if (['10270', '10280', '10290', '10540', '10560', '10130'].includes(q)) return { ...ZONES[3], match: 'รหัส ' + q, tier: 'core', km: 0, fee: 0 };
    const p = { '10': 'กรุงเทพมหานคร', '11': 'นนทบุรี', '12': 'ปทุมธานี', '74': 'สมุทรสาคร' }[q.slice(0, 2)];
    if (p) return { ...ZONES.find(z => z.province === p), match: 'รหัส ' + q, tier: 'core', km: 0, fee: 0 };
  }
  return { province: '', match: input, tier: 'unknown', districts: [] };
}

/* ---------- annual cleaning contract (real pricebook rates) ---------- */
export const CLEAN_PKGS = [
  { id: 'Basic Clean', th: 'Basic Clean', sub: 'ใบรับมอบงานแบบย่อ · รับประกันงาน 30 วัน' },
  { id: 'Standard Care', th: 'Standard Care', sub: 'Service Report พร้อมภาพ · รับประกัน 45 วัน · Service Care 90 วัน' },
  { id: 'Corporate Control', th: 'Corporate Control', sub: 'Asset Report รายเครื่อง · รับประกัน 60 วัน · Service Care Plus 90 วัน' },
];
export const SIZE_BANDS = [
  { id: 0, th: 'เล็ก', wall: '9,000-18,000', other: '<=24,000' },
  { id: 1, th: 'กลาง', wall: '19,000-24,000', other: '25,000-36,000' },
  { id: 2, th: 'ใหญ่', wall: '25,000-36,000', other: '37,000-48,000' },
  { id: 3, th: 'ใหญ่มาก', wall: '37,000-60,000', other: '49,000-60,000' },
];
// Public site shows the STANDARD rate only. Special / project rates need conditions + approval (Approval Matrix)
// and are never sent to the browser — the sales team offers them in the formal quotation.
export const VOLUME_LEVELS = [ { min: 0, key: 's', th: 'อัตรามาตรฐาน' } ];
// Rev.09 r9 owner decision (written, 2 ต.ค. 2569): annual cleaning contracts get a PUBLIC quantity ladder on the contract total
// (machines in the contract). Every step stays above the internal special rate on every contract row — tools_recon.py checks
// it offline against the internal extract (internal rates never reach the browser). 100+ machines: the sales team may also
// offer project pricing in the formal quotation.
export const VOLUME_TIERS = [
  { min: 1, max: 9, off: 0, th: '1–9 เครื่อง', note: 'อัตรามาตรฐาน' },
  { min: 10, max: 29, off: 0.03, th: '10–29 เครื่อง', note: 'ลด 3% จากยอดสัญญา' },
  { min: 30, max: 59, off: 0.05, th: '30–59 เครื่อง', note: 'ลด 5% จากยอดสัญญา' },
  { min: 60, max: 99, off: 0.07, th: '60–99 เครื่อง', note: 'ลด 7% จากยอดสัญญา' },
  { min: 100, max: Infinity, off: 0.07, th: '100 เครื่องขึ้นไป', note: 'ลด 7% + ขอราคาโครงการได้', project: true },
];
export const tierFor = n => VOLUME_TIERS.find(t => n >= t.min && n <= t.max) || VOLUME_TIERS[0];
export const VOLUME_HINT = 100;   // from this many machines the page offers a project quotation on top of the ladder
// Crew productivity per team-day for standard cleaning (C1) — company manual §1.9 (SBP-GRW-001): wall 20–25, ceiling/cassette 12–16 → mid-points.
// Floor-standing uses the ceiling/cassette range; ducted uses its lower bound (no separate figure in the manual).
export const PRICING = { unitsPerTeamDay: { wall: 22, ceiling: 14, cassette: 14, floor: 14, duct: 12 } };
export function cleanRate(pkg, level, type, sizeId) {
  const band = SIZE_BANDS[sizeId] || SIZE_BANDS[0];
  const rg = type === 'wall' ? band.wall : band.other;
  return DATA.clean.find(r => r.pkg === pkg && r.level === level && r.type === type && r.range === rg);
}
export const PRESETS = [
  { id: 'office-s', th: 'สำนักงานเล็ก', sub: '10 เครื่อง', units: { wall: 8, cassette: 2 }, visits: 3 },
  { id: 'office-m', th: 'สำนักงาน 1 ชั้น', sub: '30 เครื่อง', units: { wall: 12, cassette: 14, ceiling: 4 }, visits: 3 },
  { id: 'factory', th: 'โรงงาน / โกดัง', sub: '46 เครื่อง', units: { wall: 10, ceiling: 20, floor: 8, duct: 8 }, visits: 4 },
  { id: 'building', th: 'อาคาร / คอนโด', sub: '120 เครื่อง', units: { wall: 96, cassette: 16, duct: 8 }, visits: 2 },
];
export function estimateContract({ units, visits, zone = null, high = false, pkg = 'Standard Care', size = 0, deep = true, tax = 'none' }) {
  const count = Object.values(units).reduce((a, b) => a + (+b || 0), 0);
  if (!count) return { count: 0 };
  const lvl = VOLUME_LEVELS[0], tier = tierFor(count);
  let c1 = 0, c2 = 0, teamDays = 0; const lines = [];
  for (const [t, n] of Object.entries(units)) {
    if (!(+n)) continue;
    const r1 = cleanRate(pkg, 'C1', t, size), r2 = cleanRate(pkg, 'C2', t, size);
    const p1 = r1 ? r1.rate.s : 0, p2 = r2 ? r2.rate.s : 0;
    c1 += p1 * n; c2 += p2 * n; teamDays += n / (PRICING.unitsPerTeamDay[t] || 5);
    lines.push({ type: t, n: +n, range: r1?.range, c1: p1, c2: p2 });
  }
  const deepVisits = deep ? 1 : 0;
  const normalVisits = Math.max(0, visits - deepVisits);
  const minBill = DATA.minBill;
  // ladder discount on each visit's total, result kept a round hundred; the cleaning minimum still applies per visit
  const net = c => r100(c * (1 - tier.off));
  const v1 = Math.max(net(c1), minBill), v2 = Math.max(net(c2), minBill);
  const s1 = Math.max(c1, minBill), s2 = Math.max(c2, minBill);
  const tc = travelCharge(zone, count); const travel = tc.fee;
  const annualStd = s1 * normalVisits + s2 * deepVisits + travel * visits;
  const annualEx = v1 * normalVisits + v2 * deepVisits + travel * visits;
  const next = VOLUME_TIERS.find(t => t.min > count && t.off > tier.off);
  const tx = withTax(annualEx, tax);
  return {
    count, visits, level: lvl, tier, tierTh: tier.off ? `ราคาขั้นบันได ${tier.th} ลด ${Math.round(tier.off * 100)}%` : 'อัตรามาตรฐาน', next: next ? { need: next.min - count, tier: next } : null, lines,
    perVisitC1: v1, perVisitC2: v2, stdVisitC1: s1, stdVisitC2: s2, travel, travelWaived: tc.waived, travelShort: tc.short,
    minBillApplied: c1 < minBill || (deep && c2 < minBill),
    annualStd, discount: annualStd - annualEx, annualEx, tax, vat: tx.vat, total: tx.total, annualInc: annualEx + vatOf(annualEx),
    perUnitYear: r100(annualEx / count), teamDaysPerVisit: Math.ceil(teamDays * 2) / 2, high,
    project: !!tier.project,
    // aliases kept for older markup
    low: annualEx, high_: annualEx + vatOf(annualEx),
  };
}

/* ---------- BTU helper (rule of thumb, preliminary) ---------- */
export function recommendBtu({ w, d, h = 2.7, sun = 1, people = 2, use = 'home' }) {
  const area = w * d;
  const perM2 = [700, 750, 820][sun];
  const useF = { home: 1, office: 1.06, shop: 1.15 }[use] || 1;
  let btu = area * perM2 * useF * Math.max(1, h / 2.7) + Math.max(0, people - 2) * 600;
  const sizes = [9000, 12000, 15000, 18000, 24000, 30000, 36000, 48000, 60000];
  const pick = sizes.find(s => s >= btu) || sizes[sizes.length - 1];
  return { area, btu: Math.round(btu / 100) * 100, pick };
}

/* ---------- services ---------- */
export const SERVICES = [
  { id: 'clean-b2b', th: 'สัญญาล้างรายปี', sub: 'องค์กร · อาคาร · โรงงาน', from: 'อัตราตามจำนวนเครื่อง', time: 'วางแผนรอบทั้งปี', key: true },
  { id: 'clean', th: 'ล้างแอร์', sub: 'ล้างปกติ C1 / ล้างใหญ่ C2', from: '—', time: 'ตามจำนวนเครื่อง' },
  { id: 'install', th: 'ติดตั้งแอร์', sub: 'มาตรฐาน หรือพรีเมียม ทุกงานใช้วัสดุระบุยี่ห้อ', from: '—', time: 'รวมท่อ 4 เมตรแรก' },
  { id: 'repair', th: 'ตรวจเช็ก / ซ่อม', sub: '86 รายการ พร้อมราคาและประกัน', from: '—', time: 'แจ้งราคาก่อนซ่อม' },
  { id: 'move', th: 'รื้อ ย้าย ติดตั้งใหม่', sub: 'เก็บน้ำยา ถอด ย้าย ติดตั้ง', from: 'ประเมินหน้างาน', time: 'ตามระยะท่อจริง' },
  { id: 'project', th: 'งานโครงการ · VRV / VRF', sub: 'VRV · VRF · Package · AHU · Duct', from: 'ติดต่อทีมโครงการ', time: 'สำรวจ + ออกแบบ + BOQ', contact: true },
];
// Rev.09 owner decision (1 ต.ค. 2569): cleaning and installation on the web cover every system type EXCEPT VRV / VRF —
// those are designed per project, so every VRV/VRF item routes to a separate inquiry instead of the quote basket.
export const isVRF = (...t) => /VRV|VRF/i.test(t.filter(Boolean).join(' '));
export const VRF_NOTE = 'ระบบ VRV / VRF ออกแบบเฉพาะโครงการ ไม่มีราคาบนเว็บ ติดต่อทีมโครงการเพื่อสำรวจและออกแบบ';
// topics offered in every page's contact form (askTeam() pre-selects one)
export const CONTACT_TOPICS = ['ล้างแอร์', 'ติดตั้งแอร์', 'ซ่อม / ตรวจเช็ก', 'สัญญาล้างรายปี', 'ซื้อแอร์', 'FUJIVA', 'ระบบ VRV / VRF', 'งานโครงการ / รีโนเวต / เปลี่ยนทั้งชุด', 'งานโครงการอื่น', 'อื่น ๆ'];
export const PROCESS = [
  { th: 'เลือกบริการหรือรุ่น', d: 'ดูราคาบนเว็บ ใส่ลงใบเสนอราคาเบื้องต้น ระบบรวมยอดให้ (ต้องการใบกำกับภาษีบวก VAT 7%)' },
  { th: 'ยืนยันหน้างาน', d: 'ทีมโทรยืนยัน รายการที่ต้องประเมินหน้างานจะแจ้งราคาก่อนเริ่มงาน' },
  { th: 'ลงมือทำงาน', d: 'คลุมพื้นที่ ทำตามขั้นตอน ถ่ายภาพก่อน–หลัง' },
  { th: 'ส่งมอบ + รายงาน', d: 'ทดสอบการทำงาน ส่งเอกสารตามแพ็กเกจ และเงื่อนไขรับประกันต่อรายการ' },
];
export const FAQ = [
  { q: 'ราคาบนเว็บรวม VAT แล้วหรือยัง', a: 'ทุกราคาบนเว็บเป็นราคาก่อน VAT ปัดเป็นหลักร้อย ลูกค้าบุคคลทั่วไปที่ไม่ต้องการใบกำกับภาษีชำระตามราคาที่แสดง ลูกค้านิติบุคคลที่ต้องการใบกำกับภาษีบวก VAT 7% เลือกได้ในใบเสนอราคาเบื้องต้น' },
  { q: 'สัญญารายปีหลายเครื่องมีส่วนลดไหม', a: 'มีราคาขั้นบันไดตามจำนวนเครื่องในสัญญา: 10–29 เครื่อง ลด 3% · 30–59 เครื่อง ลด 5% · 60 เครื่องขึ้นไป ลด 7% จากยอดสัญญา (ไม่รวมค่าเดินทาง) ตั้งแต่ 100 เครื่องขอราคาโครงการเพิ่มได้ ตัวคำนวณในหน้าองค์กรคิดให้อัตโนมัติ' },
  { q: 'ราคาติดตั้งรวมอะไรบ้าง', a: 'รวมท่อน้ำยาและวัสดุ 4 เมตรแรก ท่อน้ำทิ้ง สายไฟตามระยะที่ระบุ เบรกเกอร์ ขาแขวน Vacuum และทดสอบ ส่วนที่เกินเลือกเพิ่มได้ในหน้าสินค้า' },
  { q: 'รายการที่ขึ้นว่า "ประเมินหน้างาน" คืออะไร', a: 'งานที่ราคาขึ้นกับสภาพจริง เช่น รื้อเครื่องเดิม งานสูง นั่งร้าน เปิดฝ้า ทีมจะแจ้งราคาให้ยืนยันก่อนเริ่มงานทุกครั้ง' },
  { q: 'สัญญารายปีต่างจากเรียกล้างทีละครั้งอย่างไร', a: 'ทีมวางรอบล่วงหน้าทั้งปี ได้ราคาขั้นบันไดตามจำนวนเครื่อง มีรายงานตามแพ็กเกจหลังทุกรอบ ทะเบียนเครื่องรายเครื่อง และวางบิลตามรอบ' },
  { q: 'นอกกรุงเทพฯ และปริมณฑลรับงานไหม', a: 'รับถึงระยะประมาณ 150 กม. จากสำนักงานใหญ่ ค่าเดินทางต่อเที่ยว (ก่อน VAT): ไม่เกิน 60 กม. 300 บาท ยกเว้นเมื่อ 4 เครื่องขึ้นไป · 61–100 กม. 800 บาท ขั้นต่ำ 3 เครื่อง ยกเว้นเมื่อ 8 เครื่องขึ้นไป · 101–150 กม. 1,500 บาท ขั้นต่ำ 5 เครื่อง ไกลกว่านั้นรับเป็นงานโครงการหรือสัญญา' },
  { q: 'รับงานระบบ VRV / VRF ไหม', a: 'รับเป็นงานโครงการแยกจากงานล้างและติดตั้งทั่วไป เพราะต้องสำรวจ ออกแบบท่อและคอนโทรล และทำ BOQ ตามอาคารจริง กด "ติดต่อสอบถาม VRV / VRF" แล้วทีมโครงการจะติดต่อกลับ' },
  { q: 'มียอดขั้นต่ำไหม', a: 'งานล้างมียอดขั้นต่ำต่อการเข้าหน้างาน 4,500 บาทก่อน VAT ระบบจะแจ้งในใบเสนอราคาเบื้องต้นเมื่อยอดต่ำกว่านี้' },
];

/* ---------- utilities used by all variants ---------- */
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (typeof v === 'boolean' && k.startsWith('aria-')) { el.setAttribute(k, String(v)); continue; }   // aria-pressed="true"/"false", never ""
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
export function countUp(el, to, dur = 900, fmt = n => Math.round(n).toLocaleString('en-US')) {
  if (reduceMotion()) { el.textContent = fmt(to); return; }
  const from = parseFloat(el.dataset.v || 0) || 0; el.dataset.v = to;
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
