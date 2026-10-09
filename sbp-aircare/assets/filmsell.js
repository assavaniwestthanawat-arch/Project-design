// SBP AirCare — what each film chapter sells (r16 A2–D2). Every panel prices from the Pricebook through the same functions
// as the rest of the site (cleanRate, installRows, recommendBtu, diagnosis, VOLUME_TIERS) and puts the job in the same quote
// basket (commerce.cart), so a quote from these pages reads exactly like one from any other edition. Nothing here reads an
// internal rate: standard public prices, rounded to hundreds, before VAT (§6.6 #1, #8, #13).
//   cleanPanel(root, {onBook, onPrices, onBusiness, onChange})   type × size × C1/C2 × package × machines → price, warranty, basket
//   installPanel(root, {onBook, onShop, onChange})               type × size × standard/premium → price, warranty, materials, basket
//   roomPanel(root, {onShop, use})                               room size, sun, people → BTU (the same estimate as the concierge)
//   repairPanel(root, {onPrices})                                diagnosis fees + priced repair items
//   qualityPanel(root, {onInstall})                              the specified materials of both installation tiers
//   businessPanel(root, {onCatalog})                             annual contract estimate · procedure + report · projects
//   areaPanel(root, {onZone})                                    area check + travel table
import { DATA, TYPE_BY_ID, SIZE_BANDS, CLEAN_PKGS, VOLUME_TIERS, cleanRate, recommendBtu, baht, btuFmt, h, $, $$ } from './sbp-core.js';
import { cart, PKG_INFO, METHOD_INFO, materialTable } from './commerce.js';
import { installRows, diagnosis } from './jobcard.js';
import { mountZone, toast } from './proto-ui.js';
import { travelTable } from './journey.js';

const TYPES4 = ['wall', 'ceiling', 'cassette', 'floor'];
const LV = { C1: 'ล้างปกติ C1', C2: 'ล้างใหญ่ C2' };
const range = (t, b) => { const s = t === 'wall' ? b.wall : b.other; return (s.startsWith('<=') ? 'ไม่เกิน ' + s.slice(2) : s.replace('-', '–')) + ' BTU'; };

/** a question: legend + pressed buttons (one choice) */
function ask(legend, opts, cur, onPick, cls = '') {
  const box = h('div', { class: 'fs-opts ' + cls });
  const draw = v => $$('button', box).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  opts.forEach(o => box.append(h('button', { type: 'button', class: 'fs-opt', 'data-v': String(o.v), onclick: () => { draw(o.v); onPick(o.v); } }, h('b', {}, o.t), o.s ? h('small', {}, o.s) : null)));
  draw(cur);
  const f = h('fieldset', { class: 'fs-q' }, h('legend', {}, legend), box); f.draw = draw; f.box = box; return f;
}
function stepper(label, v, { min = 1, max = 99, onChange }) {
  const i = h('input', { type: 'number', inputmode: 'numeric', min, max, value: v, 'aria-label': label });
  const set = n => { n = Math.max(min, Math.min(max, Math.round(+n) || min)); i.value = n; onChange(n); };
  i.addEventListener('change', () => set(i.value));
  return h('div', { class: 'fs-q fs-qty' }, h('span', { class: 'fs-ql' }, label),
    h('span', { class: 'fs-step' }, h('button', { type: 'button', 'aria-label': `ลด${label}`, onclick: () => set(+i.value - 1) }, '−'), i, h('button', { type: 'button', 'aria-label': `เพิ่ม${label}`, onclick: () => set(+i.value + 1) }, '+')));
}
const acts = (...b) => h('div', { class: 'fs-acts' }, ...b.filter(Boolean));
const btn = (cls, t, fn) => h('button', { type: 'button', class: 'v-btn ' + cls, onclick: fn }, t);

/* ---------------- ล้างแอร์ ---------------- */
export function cleanPanel(root, { onBook, onPrices, onBusiness, onChange, start = {} } = {}) {
  const S = { type: 'wall', size: 0, level: 'C1', pkg: 'Standard Care', qty: 1, ...start };
  const bands = () => SIZE_BANDS.filter(b => cleanRate(CLEAN_PKGS[0].id, S.level, S.type, b.id));
  const qType = ask('ประเภทแอร์', TYPES4.map(t => ({ v: t, t: TYPE_BY_ID[t].th })), S.type, v => { S.type = v; drawSizes(); draw(); });
  const qSize = h('fieldset', { class: 'fs-q' }, h('legend', {}, 'ขนาดเครื่อง'));
  function drawSizes() {
    const bs = bands(); if (!bs.some(b => b.id === S.size)) S.size = bs[0] ? bs[0].id : 0;
    const f = ask('ขนาดเครื่อง', bs.map(b => ({ v: b.id, t: range(S.type, b), s: b.th })), S.size, v => { S.size = +v; draw(); }, 'fs-wrap');
    qSize.replaceChildren(...f.childNodes);
  }
  const qLevel = ask('วิธีล้าง', METHOD_INFO.filter(m => m.id !== 'C3').map(m => ({ v: m.id, t: m.th, s: m.id === 'C1' ? 'ล้างที่ตำแหน่งเดิม ไม่ปลดเครื่อง' : 'ปลดคอยล์เย็นลงล้าง ไม่ตัดท่อน้ำยา' })), S.level, v => { S.level = v; drawSizes(); draw(); }, 'fs-two');
  const qPkg = ask('แพ็กเกจเอกสาร', PKG_INFO.map(p => ({ v: p.id, t: p.id, s: p.pitch })), S.pkg, v => { S.pkg = v; draw(); }, 'fs-three');
  const qQty = stepper('จำนวนเครื่อง', S.qty, { max: 999, onChange: n => { S.qty = n; draw(); } });
  const out = h('div', { class: 'fs-res', 'aria-live': 'polite' });
  function draw() {
    const r = cleanRate(S.pkg, S.level, S.type, S.size), P = PKG_INFO.find(p => p.id === S.pkg), M = METHOD_INFO.find(m => m.id === S.level);
    const ex = r && r.rate.s != null ? r.rate.s : null, sum = ex != null ? ex * S.qty : null;
    const tier = VOLUME_TIERS.find(t => S.qty >= t.min && S.qty <= t.max);
    out.replaceChildren(
      h('p', { class: 'fs-what' }, `${TYPE_BY_ID[S.type].th} ${range(S.type, SIZE_BANDS[S.size])} · ${LV[S.level]} · ${S.pkg}`),
      ex != null ? h('p', { class: 'fs-price' }, h('span', { class: 'fs-unit' }, 'ราคาต่อเครื่อง'), h('b', { class: 'tab' }, baht(ex)), h('span', { class: 'fs-vat' }, 'ก่อน VAT'))
        : h('p', { class: 'fs-price' }, h('b', {}, 'ประเมินหน้างาน')),
      sum != null && S.qty > 1 ? h('p', { class: 'fs-sum' }, `${S.qty} เครื่อง รวม `, h('b', { class: 'tab' }, baht(sum)), ' ก่อน VAT') : null,
      sum != null && sum < DATA.minBill ? h('p', { class: 'fs-note' }, `ขั้นต่ำต่อการเข้างาน ${baht(DATA.minBill)} ก่อน VAT ใบเสนอราคาปรับยอดให้เองเมื่อรวมแล้วไม่ถึง`) : null,
      h('dl', { class: 'fs-meta' },
        h('dt', {}, 'วิธีล้าง'), h('dd', {}, M ? M.d : ''),
        h('dt', {}, 'ได้รับ'), h('dd', {}, P ? P.gets.join(' · ') : ''),
        r && r.warranty ? [h('dt', {}, 'รับประกันงาน'), h('dd', {}, r.warranty)] : null,
        P && P.care && P.care !== 'ไม่มี' ? [h('dt', {}, 'ดูแลหลังงาน'), h('dd', {}, P.care)] : null),
      tier && tier.off ? h('p', { class: 'fs-note fs-hi' }, `${tier.th}: ทำเป็นสัญญาล้างรายปี ${tier.note}`, onBusiness ? [' ', h('button', { type: 'button', class: 'v-link', onclick: onBusiness }, 'ดูสัญญารายปี')] : null) : null,
      acts(
        btn('go', ex != null ? 'ใส่ใบเสนอราคา' : 'ขอประเมินราคา', () => {
          if (!r) return;
          cart.add({ kind: 'service', group: 'clean', key: `CL-${S.pkg}-${S.level}-${S.type}-${S.size}`, name: `${r.name} · ${LV[S.level]}`, detail: `${S.pkg} · ${r.warranty || ''}`, unitEx: ex, qty: S.qty });
          toast(`ใส่ใบเสนอราคาแล้ว ${r.name} · ${LV[S.level]} × ${S.qty}`);
        }),
        onBook ? btn('ghost', 'จองคิวล้างแอร์', () => onBook({ service: 'clean' })) : null,
        onPrices ? h('button', { type: 'button', class: 'v-link', onclick: () => onPrices('clean') }, 'ราคาทุกขนาด ทุกแพ็กเกจ') : null));
    onChange && onChange({ ...S });
  }
  drawSizes(); draw();
  root.replaceChildren(h('div', { class: 'fs fs-clean' }, h('div', { class: 'fs-form' }, qType, qSize, qLevel, qPkg, qQty), out));
  return { set(o) { Object.assign(S, o); qType.draw(S.type); qLevel.draw(S.level); qPkg.draw(S.pkg); drawSizes(); draw(); }, state: () => ({ ...S }) };
}

/* ---------------- ติดตั้ง ---------------- */
export function installPanel(root, { onBook, onShop, onChange, start = {} } = {}) {
  const S = { type: 'wall', i: 0, tier: 'STANDARD', qty: 1, ...start };
  const qType = ask('ประเภทแอร์', TYPES4.map(t => ({ v: t, t: TYPE_BY_ID[t].th })), S.type, v => { S.type = v; S.i = 0; drawSizes(); draw(); });
  const qSize = h('fieldset', { class: 'fs-q' }, h('legend', {}, 'ขนาดเครื่อง'));
  function drawSizes() {
    const rows = installRows(S.type); if (S.i >= rows.length) S.i = 0;
    const f = ask('ขนาดเครื่อง', rows.map((r, i) => ({ v: i, t: `${r.range} BTU` })), S.i, v => { S.i = +v; draw(); }, 'fs-wrap');
    qSize.replaceChildren(...f.childNodes);
  }
  const qTier = ask('ระดับงาน', [{ v: 'STANDARD', t: 'มาตรฐาน', s: 'วัสดุระบุยี่ห้อครบ' }, { v: 'PREMIUM', t: 'พรีเมียม', s: 'เพิ่ม Support และงานเก็บรายละเอียด' }], S.tier, v => { S.tier = v; draw(); }, 'fs-two');
  const qQty = stepper('จำนวนเครื่อง', S.qty, { max: 99, onChange: n => { S.qty = n; draw(); } });
  const out = h('div', { class: 'fs-res', 'aria-live': 'polite' });
  const mat = h('details', { class: 'fs-mat' });
  function draw() {
    const rows = installRows(S.type), row = rows[S.i], it = row && (S.tier === 'PREMIUM' ? row.prem : row.std);
    out.replaceChildren(
      h('p', { class: 'fs-what' }, `ติดตั้ง${TYPE_BY_ID[S.type].th} ${row ? row.range + ' BTU' : ''} · ${S.tier === 'PREMIUM' ? 'พรีเมียม' : 'มาตรฐาน'}`),
      it ? h('p', { class: 'fs-price' }, h('span', { class: 'fs-unit' }, 'ค่าติดตั้งต่อเครื่อง'), h('b', { class: 'tab' }, baht(it.ex)), h('span', { class: 'fs-vat' }, 'ก่อน VAT')) : h('p', { class: 'fs-price' }, h('b', {}, 'ประเมินหน้างาน')),
      it && S.qty > 1 ? h('p', { class: 'fs-sum' }, `${S.qty} เครื่อง รวม `, h('b', { class: 'tab' }, baht(it.ex * S.qty)), ' ก่อน VAT') : null,
      h('dl', { class: 'fs-meta' },
        h('dt', {}, 'รวมในราคา'), h('dd', {}, 'ท่อน้ำยาและวัสดุ 4 เมตรแรก ทดสอบรอยรั่วและทำสุญญากาศก่อนเปิดวาล์ว ส่วนที่เกินเลือกเพิ่มตามระยะจริง'),
        it && it.warranty ? [h('dt', {}, 'รับประกัน'), h('dd', {}, it.warranty)] : null,
        h('dt', {}, 'ไม่รวม'), h('dd', {}, 'ตัวเครื่อง ระบบซ่อนในฝ้า และขนาดที่ไม่มีในตาราง (ประเมินหน้างาน)')),
      acts(
        it ? btn('go', 'ใส่ใบเสนอราคา', () => { cart.add({ kind: 'service', group: 'install', key: `I-${it.code}`, name: it.name, detail: it.warranty || '', unitEx: it.ex, qty: S.qty }); toast(`ใส่ใบเสนอราคาแล้ว ${it.name} × ${S.qty}`); }) : null,
        onBook ? btn('ghost', 'จองคิวติดตั้ง', () => onBook({ service: 'install' })) : null,
        onShop ? h('button', { type: 'button', class: 'v-link', onclick: () => onShop({ type: S.type, btu: row ? row.lo : 12000 }) }, 'ยังไม่มีเครื่อง เลือกรุ่นพร้อมติดตั้ง') : null));
    mat.replaceChildren(h('summary', {}, 'วัสดุที่ใช้ แยกตามระดับงาน'), h('div', { class: 'fs-scroll', tabindex: '0', role: 'region', 'aria-label': 'วัสดุที่ใช้' }, materialTable(S.type, row ? row.lo : 12000, { compact: true })));
    onChange && onChange({ ...S });
  }
  drawSizes(); draw();
  root.replaceChildren(h('div', { class: 'fs fs-install' }, h('div', { class: 'fs-form' }, qType, qSize, qTier, qQty), h('div', { class: 'fs-side' }, out, mat)));
  return { set(o) { Object.assign(S, o); qType.draw(S.type); qTier.draw(S.tier); drawSizes(); draw(); } };
}

/* ---------------- ขนาดที่เหมาะกับห้อง ---------------- */
export function roomPanel(root, { onShop, use = 'home' } = {}) {
  const S = { w: 4, d: 4, h: 2.7, sun: 1, people: 2, use };
  const num = (label, k, { min, max, step, unit }) => {
    const i = h('input', { type: 'number', inputmode: 'decimal', min, max, step, value: S[k] });
    i.addEventListener('input', () => { const v = parseFloat(i.value); if (v >= min && v <= max) { S[k] = v; draw(); } });
    return h('label', { class: 'fs-num' }, h('span', {}, label), i, h('small', {}, unit));
  };
  const qSun = ask('แดดที่ห้องได้รับ', [{ v: 0, t: 'แดดน้อย' }, { v: 1, t: 'แดดบ่าย' }, { v: 2, t: 'แดดทั้งวัน', s: 'หรือใต้หลังคา' }], S.sun, v => { S.sun = +v; draw(); }, 'fs-three');
  const qUse = ask('ใช้ทำอะไร', [{ v: 'home', t: 'ห้องนอน ห้องนั่งเล่น' }, { v: 'office', t: 'สำนักงาน' }, { v: 'shop', t: 'ร้านค้า คาเฟ่' }], S.use, v => { S.use = v; draw(); }, 'fs-three');
  const out = h('div', { class: 'fs-res', 'aria-live': 'polite' });
  function draw() {
    const r = recommendBtu(S);
    const types = r.pick <= 24000 ? ['wall'] : r.pick <= 36000 ? ['wall', 'ceiling', 'cassette'] : ['ceiling', 'cassette', 'floor'];
    out.replaceChildren(
      h('p', { class: 'fs-what' }, `ห้อง ${S.w} × ${S.d} ม. พื้นที่ ${(Math.round(r.area * 10) / 10).toLocaleString('en-US')} ตร.ม.`),
      h('p', { class: 'fs-price' }, h('span', { class: 'fs-unit' }, 'ขนาดที่แนะนำ'), h('b', { class: 'tab' }, btuFmt(r.pick))),
      h('p', { class: 'fs-sum' }, `ค่าประมาณจากพื้นที่ แดด ความสูง และจำนวนคน ${btuFmt(r.btu)} ช่างยืนยันที่หน้างานก่อนติดตั้ง`),
      onShop ? acts(...types.map((t, i) => btn(i ? 'ghost' : 'go', `ดู${TYPE_BY_ID[t].th} ${btuFmt(r.pick)}`, () => onShop({ type: t, btu: r.pick })))) : null);
  }
  draw();
  root.replaceChildren(h('div', { class: 'fs fs-room' }, h('div', { class: 'fs-form' },
    h('div', { class: 'fs-nums' }, num('กว้าง', 'w', { min: 1.5, max: 30, step: 0.5, unit: 'ม.' }), num('ยาว', 'd', { min: 1.5, max: 30, step: 0.5, unit: 'ม.' }), num('สูง', 'h', { min: 2.2, max: 6, step: 0.1, unit: 'ม.' }), num('คนในห้อง', 'people', { min: 1, max: 40, step: 1, unit: 'คน' })),
    qSun, qUse), out));
}

/* ---------------- ซ่อม: ราคา ---------------- */
export function repairPanel(root, { onPrices } = {}) {
  const priced = DATA.rep.filter(r => r.rate.s != null && r.cat !== 'ตรวจวินิจฉัย');
  const pick = ['ระบบน้ำทิ้ง', 'ไฟฟ้า', 'Motor', 'PCB/Control', 'Refrigerant', 'Compressor', 'Coil'];
  const list = pick.flatMap(c => priced.filter(r => r.cat === c).slice(0, 1));
  const diag = ['wall', 'ceiling'].map(diagnosis).filter(Boolean);
  root.replaceChildren(h('div', { class: 'fs fs-repair' },
    h('div', { class: 'fs-res' },
      h('p', { class: 'fs-what' }, 'ค่าตรวจวินิจฉัย'),
      h('ul', { class: 'fs-lead' }, diag.map(d => h('li', {}, h('span', {}, d.name), h('b', { class: 'tab' }, baht(d.rate.s)))), h('li', {}, h('span', {}, 'แอร์ตู้ตั้งพื้น'), h('b', {}, 'แจ้งก่อนนัด'))),
      h('p', { class: 'fs-note' }, 'ช่างแจ้งผลและราคาซ่อมเป็นรายรายการ ลงมือเมื่อคุณอนุมัติเท่านั้น อะไหล่ที่เปลี่ยนเก็บไว้ให้ดูทุกชิ้น')),
    h('div', { class: 'fs-res' },
      h('p', { class: 'fs-what' }, 'ตัวอย่างราคางานซ่อม ก่อน VAT'),
      h('ul', { class: 'fs-lead' }, list.map(r => h('li', {}, h('span', {}, r.name, r.unit ? h('small', {}, ` ต่อ${r.unit}`) : null), h('b', { class: 'tab' }, baht(r.rate.s))))),
      onPrices ? acts(h('button', { type: 'button', class: 'v-link', onclick: () => onPrices('repair') }, `ราคาซ่อมทั้งหมด ${DATA.rep.length} รายการ`)) : null)));
}

/* ---------------- วัสดุ ---------------- */
export function qualityPanel(root, { onInstall } = {}) {
  const S = { type: 'wall' };
  const box = h('div', { class: 'fs-scroll', tabindex: '0', role: 'region', 'aria-label': 'วัสดุแต่ละระดับงาน' });
  const draw = () => { const r = installRows(S.type)[0]; box.replaceChildren(materialTable(S.type, r ? r.lo : 12000, { compact: true })); };
  const qType = ask('ประเภทแอร์', TYPES4.map(t => ({ v: t, t: TYPE_BY_ID[t].th })), S.type, v => { S.type = v; draw(); });
  draw();
  root.replaceChildren(h('div', { class: 'fs fs-quality' }, h('div', { class: 'fs-form' }, qType, h('p', { class: 'fs-note' }, 'ทุกรายการระบุยี่ห้อ ทองแดงหนา 0.70 มม. ทั้งสองระดับงาน ขนาดท่อและสายไฟตามรุ่นเครื่อง'),
    onInstall ? acts(btn('ghost', 'ดูค่าติดตั้ง', onInstall)) : null), box));
}

/* ---------------- องค์กร: สัญญารายปี ขั้นตอน รายงาน โครงการ ---------------- */
export async function businessPanel(root, { onCatalog, hl = 'h3' } = {}) {
  const { mountAmc, mountSop, mountProjects } = await import('./business.js');
  const T = [['amc', 'สัญญาล้างรายปี'], ['sop', 'ขั้นตอนและรายงาน'], ['projects', 'งานโครงการ']];
  const panes = {}, done = new Set();
  const bar = h('div', { class: 'fs-tabs', role: 'tablist', 'aria-label': 'บริการองค์กร' });
  const ladder = h('div', { class: 'fs-scroll', tabindex: '0', role: 'region', 'aria-label': 'ราคาขั้นบันไดตามจำนวนเครื่อง' }, h('table', { class: 'fs-table' },
    h('caption', {}, 'ราคาขั้นบันไดของสัญญารายปี ตามจำนวนเครื่องในสัญญา'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'จำนวนเครื่อง'), h('th', { scope: 'col' }, 'อัตรา'))),
    h('tbody', {}, VOLUME_TIERS.map(t => h('tr', {}, h('th', { scope: 'row' }, t.th), h('td', {}, t.note))))));
  const show = k => {
    $$('[role=tab]', bar).forEach(b => { const on = b.dataset.k === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; panes[b.dataset.k].hidden = !on; });
    if (!done.has(k)) { done.add(k); const p = panes[k]; if (k === 'amc') mountAmc(p, { hl }); else if (k === 'sop') mountSop(p, { hl }); else mountProjects(p, { hl, onCatalog }); }
  };
  T.forEach(([k, t], i) => {
    panes[k] = h('div', { class: 'fs-pane', role: 'tabpanel', id: `fs-${k}`, 'aria-label': t, hidden: true });
    const b = h('button', { type: 'button', role: 'tab', 'data-k': k, 'aria-controls': `fs-${k}`, 'aria-selected': 'false', onclick: () => show(k) }, t);
    b.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); const n = T[(i + d + T.length) % T.length][0]; show(n); $(`[data-k="${n}"]`, bar).focus(); });
    bar.append(b);
  });
  root.replaceChildren(h('div', { class: 'fs fs-biz' }, ladder, bar, ...Object.values(panes)));
  show('amc');
  return { show };
}

/* ---------------- พื้นที่บริการ ---------------- */
export function areaPanel(root, { onZone } = {}) {
  const zone = h('div', { class: 'fs-zone' },
    h('label', { class: 'd-field' }, 'ตรวจพื้นที่ของคุณ', h('input', { 'data-z-input': '', placeholder: 'เขต อำเภอ หรือจังหวัด', autocomplete: 'address-level2' })),
    h('div', { class: 'd-try', role: 'group', 'aria-label': 'ตัวอย่างพื้นที่' }, ['บางนา', 'ปากเกร็ด', 'สามพราน', 'ศรีราชา'].map(t => h('button', { type: 'button', 'data-z-try': t }, t))),
    h('div', { class: 'd-zres', 'data-z-result': '', hidden: true }),
    h('p', { class: 'fs-note' }, 'ระยะทางคำนวณโดยประมาณจากพิกัดอำเภอ ทีมยืนยันจากที่อยู่จริงก่อนนัด'));
  root.replaceChildren(h('div', { class: 'fs fs-area' }, zone, h('div', { class: 'fs-travel' }, travelTable())));
  mountZone(zone, { onResult: z => onZone && onZone(z) });
}
