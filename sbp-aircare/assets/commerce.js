// SBP AirCare — commerce layer shared by all three prototypes:
// product detail with install package + add-ons, full service price centre, quote basket, zone/travel fee.
// Markup uses the "s-" classes styled in assets/shared.css through each variant's alias tokens.
import {
  DATA, TYPES, TYPE_BY_ID, BRAND_BY_ID, CLEAN_PKGS, VAT, vatOf, withTax, TAX_MODES, PRICE_NOTE, baht, btuFmt, installOptions, addonsFor,
  checkZone, TIER_TH, TRAVEL, h, $, $$, stockTh, travelCharge, travelNote, SIZE_BANDS, isVRF, VRF_NOTE, COMPANY, logoSrc,
} from './sbp-core.js';
import { typeArt, toast } from './proto-ui.js';
import { askTeam, handoffBox, copyText, guardForm, submitTicket, consentBox, honeypot, requestBooking } from './contact.js';
import { quoteFromCart, sourceTag } from './ticket.js';
import { productVisual } from './product-media.js';
import { modelViewer, hasGL } from './model3d.js';

const exInc = ex => (ex == null ? null : { ex, inc: ex });
const priceNode = (ex, unit) => ex == null
  ? h('span', { class: 's-price survey' }, 'ประเมินหน้างาน')
  : h('span', { class: 's-price' }, h('b', {}, baht(ex)), h('small', {}, `ก่อน VAT${unit ? ' / ' + unit : ''}`));   // Rev.09 r9: one price, round hundred, before VAT

/* =========================================================
   Quote basket
   ========================================================= */
const KEY = 'sbp-quote-v2';
export const cart = {
  // tax: 'none' = individual, pays the shown (pre-VAT) price · 'invoice' = wants a tax invoice, + VAT 7% (Rev.09 r9 owner decision)
  items: [], zone: null, zoneInput: '', tax: 'none', subs: new Set(),
  load() { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j) { this.items = j.items || []; this.zoneInput = j.zoneInput || ''; this.tax = j.tax === 'invoice' ? 'invoice' : 'none'; this.zone = this.zoneInput ? checkZone(this.zoneInput) : null; } } catch (e) {} },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ items: this.items, zoneInput: this.zoneInput, tax: this.tax })); } catch (e) {} this.subs.forEach(f => f(this)); },
  setTax(m) { this.tax = m === 'invoice' ? 'invoice' : 'none'; this.save(); },
  add(line) {
    const same = this.items.find(i => i.key && i.key === line.key);
    if (same && line.kind !== 'survey') same.qty += line.qty || 1; else if (!same) this.items.push({ id: Math.random().toString(36).slice(2, 9), qty: 1, ...line });
    this.save();
  },
  setQty(id, q) { const it = this.items.find(i => i.id === id); if (!it) return; it.qty = Math.max(1, Math.min(999, q)); this.save(); },
  remove(id) { this.items = this.items.filter(i => i.id !== id); this.save(); },
  clear() { this.items = []; this.save(); },
  setZone(input) { this.zoneInput = input; this.zone = checkZone(input); this.save(); },
  count() { return this.items.reduce((n, i) => n + (i.kind === 'survey' ? 0 : i.qty), 0); },
  totals() {
    let ex = 0, cleanEx = 0;
    this.items.forEach(i => { if (i.unitEx != null) { ex += i.unitEx * i.qty; if (i.group === 'clean') cleanEx += i.unitEx * i.qty; } });
    const z = this.zone;
    const units = this.units();
    // annual contracts already carry travel per visit — only charge a trip for the one-off lines
    const oneOff = this.items.some(i => i.group !== 'contract' && i.kind !== 'survey');
    const tc = oneOff ? travelCharge(z, units) : { fee: 0, waived: false, short: 0 };
    const travel = tc.fee;
    const minGap = cleanEx > 0 && cleanEx < DATA.minBill ? DATA.minBill - cleanEx : 0;
    const totalEx = ex + travel + minGap;
    const tx = withTax(totalEx, this.tax);
    return { ex, travel, travelWaived: tc.waived, travelShort: tc.short, units, minGap, totalEx, tax: this.tax, vat: tx.vat, inc: tx.total, surveys: this.items.filter(i => i.unitEx == null).length };
  },
  // machines on site = the largest per-group count (a product + its install line is still one machine)
  units() {
    const by = {}; this.items.forEach(i => { if (['product', 'install', 'clean', 'repair'].includes(i.group)) by[i.group] = (by[i.group] || 0) + (i.units || i.qty); });
    return Math.max(0, ...Object.values(by));
  },
};

// r20: printable preliminary estimate (document layout of the basket). Labelled as NOT the official quotation;
// the reference is local to this browser (never presented as a back-office number — §6.6 #23).
// window.print() is inert inside a frame (Claude Artifact, the A/B/C tester) → the print button only shows top-level.
const canPrint = (() => { try { return window.top === window.self && typeof window.print === 'function'; } catch (e) { return false; } })();
const thDate = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
const docRef = d => 'PE-' + String(d.getFullYear() + 543).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
function quoteDoc({ onBack, onFormal, onCopy }) {
  const t = cart.totals(), now = new Date(), inv = t.tax === 'invoice';
  const num = n => n.toLocaleString('th-TH');
  const rows = cart.items.map((i, k) => h('tr', { class: i.unitEx == null ? 'sv' : '' },
    h('td', { class: 'n' }, String(k + 1)),
    h('td', {}, h('b', {}, i.name), i.detail ? h('small', {}, i.detail) : null),
    h('td', { class: i.unitEx == null ? 'n' : 'n q' }, i.unitEx == null ? '—' : num(i.qty)),
    h('td', { class: 'n' }, i.unitEx == null ? 'ประเมินหน้างาน' : num(i.unitEx)),
    h('td', { class: 'n' }, i.unitEx == null ? '—' : num(i.unitEx * i.qty))));
  if (t.travel) rows.push(h('tr', {}, h('td', { class: 'n' }, String(rows.length + 1)), h('td', {}, h('b', {}, 'ค่าเดินทาง 1 เที่ยว'), h('small', {}, cart.zoneInput)), h('td', { class: 'n q' }, '1'), h('td', { class: 'n' }, num(t.travel)), h('td', { class: 'n' }, num(t.travel))));
  if (t.minGap) rows.push(h('tr', {}, h('td', { class: 'n' }, String(rows.length + 1)), h('td', {}, h('b', {}, `ปรับยอดขั้นต่ำงานล้าง ${baht(DATA.minBill)}`), h('small', {}, 'ยอดขั้นต่ำต่อการเข้าหน้างาน ใช้กับงานล้างเท่านั้น')), h('td', { class: 'n q' }, '1'), h('td', { class: 'n' }, num(t.minGap)), h('td', { class: 'n' }, num(t.minGap))));
  const hasInstall = cart.items.some(i => i.group === 'install' || i.group === 'product');
  const terms = [
    'ราคาตาม Pricebook 2569 ของบริษัท ปัดเป็นหลักร้อย ก่อน VAT',
    inv ? 'ผู้ซื้อต้องการใบกำกับภาษี คิด VAT 7% จากยอดก่อน VAT' : 'บุคคลทั่วไป ไม่ต้องการใบกำกับภาษี ชำระตามยอดรวม',
    t.surveys ? `รายการ "ประเมินหน้างาน" ${t.surveys} รายการ ยังไม่รวมในยอด ทีมแจ้งราคาให้ยืนยันก่อนเริ่มงาน` : null,
    cart.items.some(i => i.group === 'product') ? 'รายการเครื่องต้องยืนยันสต็อกก่อนสั่ง' : null,
    hasInstall ? 'รับประกันงานติดตั้ง 3 ปี เมื่อซื้อเครื่องใหม่จากบริษัท · 1 ปี เมื่อลูกค้าจัดหาเครื่องเอง' : null,
    t.travelShort ? `ระยะนี้รับงานขั้นต่ำ ${cart.zone.minUnits} เครื่องต่อเที่ยว ทีมจะรวมคิวกับงานใกล้เคียงหรือเสนอทางเลือก` : null,
    'ราคา เงื่อนไข และวันนัด ยืนยันในใบเสนอราคาอย่างเป็นทางการจากทีมขาย',
  ].filter(Boolean);
  return h('article', { class: 's-doc', 'aria-labelledby': 's-doc-title' },
    h('header', { class: 's-doc-h' },
      h('div', { class: 's-doc-co' },
        h('img', { src: logoSrc('sbp'), alt: '', width: 55, height: 40 }),
        h('div', {}, h('b', {}, COMPANY.th), h('small', {}, `${COMPANY.en} · ${COMPANY.brand}`), h('small', {}, COMPANY.addr), h('small', {}, `โทร ${COMPANY.tel} · ${COMPANY.email} · ${COMPANY.web}`))),
      h('div', { class: 's-doc-id' },
        h('h3', { id: 's-doc-title' }, 'ใบประเมินราคาเบื้องต้น'),
        h('p', { class: 's-doc-not' }, 'ไม่ใช่ใบเสนอราคาทางการ'),
        h('dl', {}, h('dt', {}, 'วันที่'), h('dd', {}, thDate(now)), h('dt', {}, 'เลขที่ใบประเมิน'), h('dd', {}, docRef(now)), h('dt', {}, 'สถานะ'), h('dd', {}, 'ยังไม่ส่งถึงทีม')))),
    h('dl', { class: 's-doc-to' },
      h('dt', {}, 'ผู้ซื้อ'), h('dd', {}, inv ? 'นิติบุคคล ต้องการใบกำกับภาษี' : 'บุคคลทั่วไป'),
      h('dt', {}, 'พื้นที่ปฏิบัติงาน'), h('dd', {}, cart.zone && cart.zone.match ? `${cart.zoneInput}${cart.zone.province ? ' · ' + cart.zone.province : ''}` : (cart.zoneInput || 'ยังไม่ระบุ'))),
    h('div', { class: 's-doc-tw', tabindex: '0', role: 'region', 'aria-label': 'รายการ' },
      h('table', { class: 's-doc-t' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', class: 'n' }, 'ลำดับ'), h('th', { scope: 'col' }, 'รายการ'), h('th', { scope: 'col', class: 'n' }, 'จำนวน'), h('th', { scope: 'col', class: 'n' }, 'ราคาต่อหน่วย'), h('th', { scope: 'col', class: 'n' }, 'จำนวนเงิน (บาท)'))),
        h('tbody', {}, rows))),
    h('dl', { class: 's-doc-sum' },
      h('dt', {}, 'รวมก่อน VAT'), h('dd', {}, num(t.totalEx)),
      inv ? [h('dt', {}, 'VAT 7%'), h('dd', {}, num(t.vat))] : null,
      h('dt', { class: 'tot' }, inv ? 'รวมทั้งสิ้น (รวม VAT)' : 'รวมทั้งสิ้น'), h('dd', { class: 'tot' }, baht(t.inc))),
    h('div', { class: 's-doc-terms' }, h('h4', {}, 'เงื่อนไข'), h('ol', {}, terms.map(x => h('li', {}, x)))),
    h('div', { class: 's-doc-act' },
      h('button', { type: 'button', class: 's-btn primary', onclick: onFormal }, 'ขอใบเสนอราคาอย่างเป็นทางการ'),
      canPrint ? h('button', { type: 'button', class: 's-btn', onclick: () => window.print() }, 'พิมพ์ หรือบันทึกเป็น PDF') : null,
      h('button', { type: 'button', class: 's-btn ghost', onclick: onCopy }, 'คัดลอกสรุปรายการ'),
      h('button', { type: 'button', class: 's-btn ghost', onclick: onBack }, 'กลับไปแก้รายการ')));
}

// what a basket is mostly about → ticket service key (ticket.js SERVICES)
const guessService = () => { const g = new Set(cart.items.map(i => i.group)); return g.has('product') ? 'buy' : g.has('install') ? 'install' : g.has('repair') ? 'repair' : g.has('clean') || g.has('contract') ? 'clean' : 'other'; };
export function mountCart({ buttons = '[data-cart-btn]' } = {}) {
  cart.load();
  const dr = h('div', { class: 's-cart', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ใบเสนอราคาเบื้องต้น' });
  const panel = h('div', { class: 's-cart-panel' });
  dr.append(panel); document.body.append(dr);
  const close = () => { dr.classList.remove('open'); document.body.classList.remove('lock'); setTimeout(() => dr.hidden = true, 250); };
  const open = () => { render(); dr.hidden = false; requestAnimationFrame(() => dr.classList.add('open')); document.body.classList.add('lock'); };
  dr.addEventListener('click', e => { if (e.target === dr) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !dr.hidden) close(); });
  let sent = null, docView = false;
  const quoteText = () => { const t = cart.totals(); return ['ใบเสนอราคาเบื้องต้น SBP AirCare', ...cart.items.map(i => `• ${i.name}${i.detail ? ' (' + i.detail + ')' : ''} × ${i.qty}${i.unitEx == null ? ' — ประเมินหน้างาน' : ' — ' + baht((i.unitEx * i.qty))}`), `พื้นที่: ${cart.zoneInput || '-'}`, `ยอดก่อน VAT ${baht(t.totalEx)}`, t.tax === 'invoice' ? `ต้องการใบกำกับภาษี · VAT 7% ${baht(t.vat)} · รวมทั้งสิ้น ${baht(t.inc)}` : `บุคคลทั่วไป ไม่ต้องการใบกำกับภาษี · รวมทั้งสิ้น ${baht(t.inc)}`].join('\n'); };
  const copySum = async () => { toast((await copyText(quoteText())) ? 'คัดลอกสรุปแล้ว วางในอีเมลหรือแชตได้เลย' : 'คัดลอกไม่ได้ในหน้านี้'); };
  function render() {
    const t = cart.totals();
    panel.innerHTML = '';
    if (!cart.items.length || sent) docView = false;
    panel.classList.toggle('doc', docView);
    dr.classList.toggle('s-cart-doc', docView);
    panel.append(h('div', { class: 's-cart-h' }, h('div', {}, h('b', {}, 'ใบเสนอราคาเบื้องต้น'), h('small', {}, `${cart.items.length} รายการ`)), h('button', { type: 'button', class: 's-x', 'aria-label': 'ปิด', onclick: close }, '×')));
    const body = h('div', { class: 's-cart-b' }); panel.append(body);
    if (sent) {
      // Rev.09 r10: the request went to the back office as a ticket (number shown) — or, when it could not, the honest hand-off summary
      body.append(sent.node,
        h('div', { class: 's-hand-act' }, h('button', { type: 'button', class: 's-btn ghost', onclick: () => { sent = null; render(); } }, 'กลับไปแก้รายการ'), h('button', { type: 'button', class: 's-btn ghost', onclick: () => { sent = null; cart.clear(); render(); } }, 'เริ่มใบใหม่')));
      return;
    }
    if (docView) {
      body.append(quoteDoc({ onBack: () => { docView = false; render(); }, onCopy: copySum,
        onFormal: () => { docView = false; render(); const n = panel.querySelector('#s-q-name'); if (n) { n.scrollIntoView({ block: 'center' }); n.focus({ preventScroll: true }); } } }));
      body.scrollTop = 0; return;
    }
    if (!cart.items.length) { body.append(h('div', { class: 's-empty' }, h('p', {}, 'ยังไม่มีรายการ'), h('p', { class: 's-note' }, 'เลือกรุ่นแอร์ในหน้าสินค้า หรือกด "เพิ่ม" ในตารางค่าบริการ'), h('button', { type: 'button', class: 's-btn', onclick: () => { close(); ($('#prices') || $('#catalog'))?.scrollIntoView({ behavior: 'smooth' }); } }, 'ไปที่ค่าบริการ'))); return; }
    const list = h('ul', { class: 's-lines' });
    cart.items.forEach(i => {
      list.append(h('li', { class: i.unitEx == null ? 'sv' : '' },
        h('div', { class: 's-l-t' }, h('b', {}, i.name), i.detail ? h('small', {}, i.detail) : null),
        i.unitEx == null ? h('span', { class: 's-price survey' }, 'ประเมินหน้างาน')
          : h('div', { class: 's-l-q' },
            h('div', { class: 's-stp' }, h('button', { type: 'button', 'aria-label': 'ลด', onclick: () => { cart.setQty(i.id, i.qty - 1); render(); } }, '−'), h('span', {}, String(i.qty)), h('button', { type: 'button', 'aria-label': 'เพิ่ม', onclick: () => { cart.setQty(i.id, i.qty + 1); render(); } }, '+')),
            h('span', { class: 's-l-p' }, baht((i.unitEx * i.qty)))),
        h('button', { type: 'button', class: 's-rm', 'aria-label': 'ลบ ' + i.name, onclick: () => { cart.remove(i.id); render(); } }, 'ลบ')));
    });
    body.append(list);
    // zone
    const zi = h('input', { id: 's-cart-zone', value: cart.zoneInput, placeholder: 'เขต / อำเภอ ที่ติดตั้งหรือล้าง', autocomplete: 'off' });
    const zr = h('p', { class: 's-zr' });
    const showZ = () => { const z = cart.zone; zr.dataset.tier = z ? z.tier : ''; zr.textContent = !z ? 'กรอกพื้นที่เพื่อคำนวณค่าเดินทาง' : z.tier === 'core' ? `${z.match} · ${TIER_TH.core.th} ไม่มีค่าเดินทาง` : z.tier === 'extended' ? `${z.match}, ${z.province} · ประมาณ ${z.km} กม. · ${travelNote(z)}` : z.tier === 'out' ? `${z.match} · ประมาณ ${z.km} กม. · ${TIER_TH.out.th} (เกิน ${TRAVEL.maxKm} กม.)` : TIER_TH.unknown.th; };
    let zt; zi.addEventListener('input', () => { clearTimeout(zt); zt = setTimeout(() => { cart.setZone(zi.value); showZ(); sumBox.replaceWith(sumBox = summary()); }, 250); });
    showZ();
    body.append(h('label', { class: 's-field', for: 's-cart-zone' }, 'พื้นที่ปฏิบัติงาน', zi), zr);
    // who is buying → VAT (Rev.09 r9)
    const taxSeg = h('fieldset', { class: 's-tax' }, h('legend', {}, 'ผู้ซื้อ'), TAX_MODES.map(m => { const id = 's-tax-' + m.id; const r = h('input', { type: 'radio', name: 's-tax', id, value: m.id, checked: cart.tax === m.id });
      r.addEventListener('change', () => { cart.setTax(m.id); render(); }); return h('label', { class: 's-tax-o', for: id }, r, h('span', {}, h('b', {}, m.th), h('small', {}, m.sub))); }));
    body.append(taxSeg);
    let sumBox = summary(); body.append(sumBox);
    function summary() {
      const t = cart.totals();
      return h('dl', { class: 's-sum' },
        h('dt', {}, 'รวมรายการ (ก่อน VAT)'), h('dd', {}, baht(t.ex)),
        t.travel ? [h('dt', {}, 'ค่าเดินทาง 1 เที่ยว'), h('dd', {}, baht(t.travel))] : null,
        t.travelWaived ? [h('dt', {}, `ค่าเดินทาง (ยกเว้น ${t.units} เครื่อง)`), h('dd', {}, baht(0))] : null,
        t.travelShort ? h('p', { class: 's-note bad', style: 'grid-column:1/-1' }, `ระยะนี้รับงานขั้นต่ำ ${cart.zone.minUnits} เครื่องต่อเที่ยว (ตอนนี้ ${t.units}) ส่งข้อมูลได้ ทีมจะรวมคิวกับงานใกล้เคียงหรือเสนอทางเลือก`) : null,
        t.minGap ? [h('dt', {}, `ปรับขั้นต่ำงานล้าง ${baht(DATA.minBill)}`), h('dd', {}, baht(t.minGap))] : null,
        t.tax === 'invoice' ? [h('dt', {}, 'ยอดก่อน VAT'), h('dd', {}, baht(t.totalEx)), h('dt', {}, 'VAT 7% (ใบกำกับภาษี)'), h('dd', {}, baht(t.vat))] : null,
        h('dt', { class: 'tot' }, t.tax === 'invoice' ? 'รวมทั้งสิ้น (รวม VAT)' : 'รวมทั้งสิ้น'), h('dd', { class: 'tot' }, baht(t.inc)),
        t.tax === 'invoice' ? null : h('p', { class: 's-note', style: 'grid-column:1/-1' }, 'บุคคลทั่วไป ชำระตามราคาที่แสดง ไม่บวก VAT · ต้องการใบกำกับภาษี เลือก "นิติบุคคล" ด้านบน'),
        t.surveys ? h('p', { class: 's-note', style: 'grid-column:1/-1' }, `+ ${t.surveys} รายการประเมินหน้างาน ทีมแจ้งราคาให้ยืนยันก่อนเริ่มงาน`) : null,
        cart.zone && cart.zone.tier === 'out' ? h('p', { class: 's-note bad', style: 'grid-column:1/-1' }, 'พื้นที่นี้เกินระยะรับงานรายเครื่อง ส่งข้อมูลได้ ทีมจะประเมินเป็นงานโครงการ') : null);
    }
    body.append(h('p', { class: 's-note' }, 'ราคาตาม Pricebook 2569 ของบริษัท ปัดเป็นหลักร้อย ก่อน VAT ยืนยันอีกครั้งในใบเสนอราคาอย่างเป็นทางการ รายการเครื่องต้องยืนยันสต็อกก่อนสั่ง'));
    body.append(h('button', { type: 'button', class: 's-btn s-doc-open', onclick: () => { docView = true; render(); } }, 'ดูเป็นใบประเมินราคา'));
    // contact
    const f = h('form', { class: 's-form' },
      h('label', { class: 's-field' }, 'ชื่อ / บริษัท', h('input', { id: 's-q-name', required: true, autocomplete: 'name' })),
      h('label', { class: 's-field' }, 'เบอร์โทร', h('input', { id: 's-q-tel', required: true, inputmode: 'tel', pattern: '[0-9\\- ]{9,12}', autocomplete: 'tel' })),
      h('label', { class: 's-field' }, 'วันที่สะดวก', h('input', { id: 's-q-date', type: 'date', min: new Date(Date.now() + 864e5).toISOString().slice(0, 10) })),
      cart.tax === 'invoice' ? h('label', { class: 's-field' }, 'ออกใบกำกับภาษีในนาม', h('input', { id: 's-q-tax', placeholder: 'ชื่อบริษัท สาขา / เลขผู้เสียภาษี 13 หลัก' })) : null,
      consentBox('s-q-consent'), honeypot(),
      h('button', { class: 's-btn primary', type: 'submit' }, 'ขอใบเสนอราคาอย่างเป็นทางการ'));
    guardForm(f);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const v = id => (f.querySelector('#' + id)?.value || '').trim(), ref = 'Q' + Date.now().toString().slice(-7);
      const text = [`ขอใบเสนอราคาอย่างเป็นทางการ · เลขอ้างอิง ${ref}`, `ชื่อ / บริษัท: ${v('s-q-name')}`, `โทร: ${v('s-q-tel')}`, v('s-q-date') ? `วันที่สะดวก: ${v('s-q-date')}` : null, v('s-q-tax') ? `ใบกำกับภาษีในนาม: ${v('s-q-tax')}` : null, '', quoteText()].filter(x => x != null).join('\n');
      const out = h('div');
      const ticket = { kind: 'quote', service: guessService(), prefDate: v('s-q-date'), consent: true, website: f.querySelector('[name=website]').value, source: sourceTag(),
        customer: { name: v('s-q-name'), tel: v('s-q-tel'), taxInvoice: cart.tax === 'invoice', taxName: v('s-q-tax') }, site: { area: cart.zoneInput, zoneTier: cart.zone ? cart.zone.tier : '', travelFee: cart.totals().travel }, quote: quoteFromCart(cart) };
      const r = await submitTicket(ticket, { out, form: f, label: 'คำขอใบเสนอราคา', fallback: { ref, title: 'ใบเสนอราคาเบื้องต้นของคุณ', text, subject: 'ขอใบเสนอราคา SBP AirCare' } });
      if (!r.ok && ['bad_tel', 'bad_name', 'no_consent', 'bad_date', 'bad_email', 'rate_limited'].includes(r.code)) { f.querySelector('.s-tkerr')?.remove(); out.classList.add('s-tkerr'); f.append(out); return; }   // fixable: stay on the form
      sent = { ref, node: out };
      render();
    });
    body.append(f);
    // Rev.09 r10: turn this basket into a booking (the booking form attaches the basket lines)
    if (document.getElementById('booking')) body.append(h('button', { type: 'button', class: 's-btn', onclick: () => { close(); requestBooking({ service: guessService() }, 'อื่น ๆ'); } }, 'จองคิวจากรายการนี้'));
    body.append(h('button', { type: 'button', class: 's-btn ghost', onclick: copySum }, 'คัดลอกสรุปรายการ'));
  }
  const upd = () => $$(buttons).forEach(b => { const n = cart.count(); b.dataset.n = n; const c = $('[data-cart-n]', b); if (c) c.textContent = n; b.classList.toggle('has', n > 0); b.setAttribute('aria-label', `ใบเสนอราคา ${n} รายการ`); });
  cart.subs.add(upd); upd();
  $$(buttons).forEach(b => b.addEventListener('click', open));
  return { open, close, render };
}

/* =========================================================
   Product detail: specs + install package + add-ons + live total
   ========================================================= */
export function productDetail(m, skuIndex, { onPick, on3D, onAdded, onFit } = {}) {
  const b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type], s = m.skus[skuIndex], d = s.d;
  const opts = installOptions(m.type, s.btu);
  const std = opts.find(o => o.key === 'STANDARD');
  const state = { level: std ? 'STANDARD' : opts[0]?.key || null, qty: 1, add: {} };
  const root = h('div', { class: 's-pd' });
  root.append(
    productVisual(m, s, { size: 'detail' }),   // Rev.09: photo slot (assets/product-media.json) or studio render
    h('p', { class: 's-pd-brand' }, b.name, ' · ', t.th, d.system ? ' · ' + d.system : ''),
    h('h3', { class: 's-pd-title' }, s.sku),
    h('p', { class: 's-pd-meta' }, `${d.series || ''} · ${btuFmt(s.btu)} · น้ำยา ${d.refrigerant || '—'}`),
    modelViewer(m, s),   // r15: this model in 3D (every catalogue model, every edition)
  );
  const chips = h('div', { class: 'btu-chips s-chips', role: 'radiogroup', 'aria-label': 'เลือกขนาด BTU' });
  m.skus.forEach((k, i) => chips.append(h('button', { type: 'button', role: 'radio', 'aria-checked': i === skuIndex, class: 'bchip', onclick: () => onPick && onPick(i) }, k.btu.toLocaleString())));
  root.append(chips);
  // price block
  root.append(h('div', { class: 's-pd-price' }, h('span', { class: 's-lbl' }, 'ราคาเครื่อง'), priceNode(s.px), h('small', { class: 's-note' }, stockTh(s) + (d.approved ? ' · ราคาอนุมัติ Pricebook 2569' : ' · ราคาอ้างอิงตลาด ต้องยืนยันก่อนเสนอ'))));
  // install package
  if (opts.length) {
    const box = h('fieldset', { class: 's-pkg' }, h('legend', {}, 'แพ็กเกจติดตั้ง'));
    const list = h('div', { class: 's-pkg-list' });
    const none = { key: null, th: 'ไม่ติดตั้ง / ซื้อเครื่องอย่างเดียว' };
    [...opts, none].forEach(o => {
      const id = `pk-${m.id}-${o.key || 'none'}`;
      const inp = h('input', { type: 'radio', name: `pk-${m.id}`, id, checked: state.level === o.key });
      inp.addEventListener('change', () => { state.level = o.key; refresh(); });
      list.append(h('label', { class: 's-pkg-o', for: id }, inp, h('span', {}, h('b', {}, o.th), o.note ? h('small', {}, o.note) : null), o.item ? priceNode(o.item.ex) : h('span', { class: 's-price' }, '—')));
    });
    box.append(list);
    const det = h('details', { class: 's-det' }, h('summary', {}, 'รายละเอียดสิ่งที่รวม / ไม่รวม'), h('div', { class: 's-det-b' }));
    box.append(det);
    box.append(h('details', { class: 's-det' }, h('summary', {}, 'เทียบวัสดุ มาตรฐาน / พรีเมียม (ยี่ห้อ · สเปก · การทดสอบ)'), materialTable(m.type, s.btu, { compact: true })));
    root.append(box);
    var detBody = $('.s-det-b', det);
  }
  // add-ons
  const addWrap = h('div', { class: 's-add' }, h('h3', {}, 'อุปกรณ์และงานเพิ่มเติม'));
  addonsFor(m.type, s.btu).forEach(g => {
    const grp = h('div', { class: 's-add-g' }, h('p', { class: 's-lbl' }, g.group));
    g.items.forEach((a, idx) => {
      const key = `${g.group}-${idx}`;
      if (a.qty === 'flag') {
        const id = `ad-${m.id}-${a.item.code}`;
        const cb = h('input', { type: 'checkbox', id });
        cb.addEventListener('change', () => { state.add[key] = cb.checked ? { item: a.item, qty: 1, flag: true } : null; refresh(); });
        grp.append(h('label', { class: 's-add-r flag', for: id }, cb, h('span', {}, a.item.name), h('span', { class: 's-price survey' }, 'ประเมินหน้างาน')));
        return;
      }
      const choices = a.choose || [a.item];
      let cur = choices[0];
      const qty = h('input', { type: 'number', min: '0', max: '99', value: '0', inputmode: 'numeric', 'aria-label': 'จำนวน' });
      const sel = choices.length > 1 ? h('select', { 'aria-label': 'เลือกรายการ' }, choices.map((c, i) => h('option', { value: i }, `${c.name.replace(/^งานเดินเมนไฟ 1 เฟส — /, 'เมนไฟ ').replace(/^เซอร์กิตเบรกเกอร์ /, '')} · ${baht(c.ex)}/${c.unit}`))) : null;
      const set = () => { const q = Math.max(0, +qty.value || 0); state.add[key] = q ? { item: cur, qty: q } : null; refresh(); };
      qty.addEventListener('input', set); sel && sel.addEventListener('change', () => { cur = choices[+sel.value]; set(); });
      grp.append(h('div', { class: 's-add-r' }, h('span', { class: 's-add-n' }, sel ? null : cur.name, sel, a.note ? h('small', {}, a.note) : null), h('span', { class: 's-add-u' }, sel ? '' : `${baht(cur.ex)} / ${cur.unit}`), h('label', { class: 's-qty' }, qty, h('span', {}, cur.unit))));
    });
    addWrap.append(grp);
  });
  root.append(addWrap);
  // specs
  const spec = [['รหัสรุ่น', s.sku], ['ซีรีส์', d.series], ['ระบบ', d.system], ['ขนาด', btuFmt(s.btu)], ['น้ำยา', d.refrigerant], ['ท่อน้ำยา', d.pipeLiquid && d.pipeGas ? `${d.pipeLiquid}" / ${d.pipeGas}"` : null], ['คอยล์เย็น (มม.)', d.indoorDim], ['น้ำหนักคอยล์เย็น', d.indoorKg && d.indoorKg + ' กก.'], ['คอยล์ร้อน (มม.)', d.outdoorDim], ['น้ำหนักคอยล์ร้อน', d.outdoorKg && d.outdoorKg + ' กก.'], ['ไฟ', d.power], ['คอมเพรสเซอร์', d.compressor], ['รับประกันเครื่อง', d.warranty]];
  root.append(h('details', { class: 's-det', open: true }, h('summary', {}, 'สเปกเครื่อง'), h('dl', { class: 's-spec' }, spec.filter(([, v]) => v).map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))));
  // live total
  const tot = h('div', { class: 's-pd-total', 'aria-live': 'polite' });
  const qtyIn = h('input', { type: 'number', min: '1', max: '99', value: '1', 'aria-label': 'จำนวนเครื่อง', inputmode: 'numeric' });
  qtyIn.addEventListener('input', () => { state.qty = Math.max(1, +qtyIn.value || 1); refresh(); });
  root.append(h('div', { class: 's-pd-buy' }, h('label', { class: 's-qty big' }, h('span', {}, 'จำนวน'), qtyIn, h('span', {}, 'เครื่อง')), tot,
    h('div', { class: 's-pd-cta' },
      h('button', { type: 'button', class: 's-btn primary', onclick: addToCart }, 'ใส่ใบเสนอราคา'),
      onFit ? h('button', { type: 'button', class: 's-btn', onclick: () => onFit(m, m.skus.indexOf(s)) }, 'ลองวางในห้องของคุณ') : null,
      // r15: the 3D view of this very model sits at the top of the panel; on3D (the page's own section) stays as the way in
      // when the device cannot draw WebGL
      on3D && !hasGL() ? h('button', { type: 'button', class: 's-btn ghost', onclick: () => on3D(m, s) }, 'ดูข้างในแบบ 3 มิติ') : null)));
  function lines() {
    const L = [{ kind: 'product', group: 'product', key: `P-${s.sku}`, name: `${b.name} ${s.sku}`, detail: `${t.th} ${btuFmt(s.btu)}`, unitEx: s.px, qty: state.qty }];
    const o = opts.find(o => o.key === state.level);
    if (o) L.push({ kind: 'service', group: 'install', key: `I-${o.item.code}`, name: o.item.name, detail: `สำหรับ ${s.sku}`, unitEx: o.item.ex, qty: state.qty });
    Object.values(state.add).filter(Boolean).forEach(a => L.push(a.flag ? { kind: 'survey', group: 'addon', key: `S-${a.item.code}`, name: a.item.name, detail: `สำหรับ ${s.sku}`, unitEx: null, qty: 1 } : { kind: 'addon', group: 'addon', key: `A-${a.item.code}`, name: a.item.name, detail: `${a.qty} ${a.item.unit} × ${state.qty} เครื่อง`, unitEx: a.item.ex * a.qty, qty: state.qty }));
    return L;
  }
  function refresh() {
    const L = lines();
    const ex = L.reduce((n, l) => n + (l.unitEx == null ? 0 : l.unitEx * l.qty), 0);
    const sv = L.filter(l => l.unitEx == null).length;
    tot.innerHTML = '';
    tot.append(h('span', { class: 's-lbl' }, `รวม ${state.qty} เครื่อง${state.level ? ' พร้อมติดตั้ง' : ''}`), h('b', {}, baht(ex)), h('small', {}, `ก่อน VAT · ต้องการใบกำกับภาษี ${baht(ex + vatOf(ex))} รวม VAT${sv ? ` · +${sv} รายการประเมินหน้างาน` : ''}`));
    if (detBody) { const o = opts.find(o => o.key === state.level); detBody.innerHTML = ''; if (o) detBody.append(h('p', {}, h('b', {}, 'รวม: '), o.item.inc || '—'), h('p', {}, h('b', {}, 'ไม่รวม: '), o.item.exc || '—'), h('p', {}, h('b', {}, 'รับประกัน: '), o.item.warranty || '—')); else detBody.append(h('p', {}, 'ซื้อเครื่องอย่างเดียว ไม่รวมงานติดตั้ง')); }
  }
  function addToCart() { lines().forEach(l => cart.add(l)); toast(`ใส่ใบเสนอราคาแล้ว · ${cart.count()} รายการ`); onAdded && onAdded(); }
  refresh();
  return root;
}


/* =========================================================
   Material quality: parse the install packages' "included" text into comparable rows
   ========================================================= */
export const MAT_ROWS = [
  { id: 'incl', th: 'ระยะที่รวมในราคา', re: /^รวมท่อ/ },
  { id: 'pipe', th: 'ท่อน้ำยาทองแดง', re: /ท่อน้ำยา|ท่อทองแดง|Type L|K Copper|ทองแดง/ },
  { id: 'ins', th: 'ฉนวนหุ้มท่อ', re: /ฉนวน|Aeroflex|Closed-cell/ },
  { id: 'rail', th: 'รางครอบท่อ', re: /ราง/ },
  { id: 'cable', th: 'สายไฟ', re: /สายไฟ|Yazaki|มอก\./ },
  { id: 'drain', th: 'ท่อน้ำทิ้ง', re: /ท่อน้ำทิ้ง|SCG|PVC/ },
  { id: 'brk', th: 'เบรกเกอร์', re: /Breaker|เบรกเกอร์/ },
  { id: 'mount', th: 'ขาแขวน · กันสั่น', re: /ขาแขวน|ยางรอง|Support|Anti-vibration|กันสั่น/ },
  { id: 'test', th: 'ทดสอบระบบ', re: /Vacuum|Nitrogen|Leak|Torque|Flare|Test Run|ตรวจรอยต่อ|Function/ },
  { id: 'doc', th: 'เอกสาร · ภาพ · ติดตามผล', re: /Photo|ภาพ|ใบรับมอบ|บันทึก|ติดตาม|Commissioning/ },
];
export function materialMatrix(type, btu) {
  const opts = installOptions(type, btu);
  const cols = opts.map(o => {
    const parts = (o.item.inc || '').split(/;\s*/).map(x => x.trim()).filter(Boolean);
    const cell = {};
    // each "; " part may hold several clauses ("Vacuum, ตรวจรอยต่อ…, Test Run และใบรับมอบงาน") — give every clause to ONE row
    // (first matching), and a clause that matches nothing stays with the clause before it
    let lastRow = null;
    parts.forEach(pt => {
      if (/^รวมท่อ/.test(pt)) { (cell.incl = cell.incl || []).push(pt.replace(/^รวม/, '').trim()); return; }
      if (/วัสดุ Standard/.test(pt)) return;
      pt.split(/,\s*|\s+และ(?=\S)/).map(x => x.trim()).filter(Boolean).forEach(cl => {
        const r = MAT_ROWS.slice(1).find(r => r.re.test(cl)) || lastRow; if (!r) return; lastRow = r;
        (cell[r.id] = cell[r.id] || []).push(cl);
      });
    });
    if (parts.some(pt => /วัสดุ Standard/.test(pt))) MAT_ROWS.slice(1, 8).forEach(r => { cell[r.id] = cell[r.id] ? ['เหมือนแพ็กเกจมาตรฐาน', ...cell[r.id]] : ['เหมือนแพ็กเกจมาตรฐาน']; });
    return { key: o.key, th: o.th, item: o.item, cell };
  });
  return cols;
}
export function materialTable(type, btu, { compact = false } = {}) {
  const cols = materialMatrix(type, btu);
  if (!cols.length) return h('p', { class: 's-note' }, 'ขนาดนี้ต้องสำรวจก่อนระบุวัสดุ');
  const t = h('table', { class: 's-mat' + (compact ? ' compact' : '') },
    h('thead', {}, h('tr', {}, h('th', {}, 'รายการ'), cols.map(c => h('th', { class: c.key === 'STANDARD' ? 'rec' : '' }, c.th, c.key === 'STANDARD' ? h('small', {}, 'แนะนำ') : null, h('span', { class: 's-mat-p' }, baht(c.item.ex)))))),
    h('tbody', {},
      MAT_ROWS.map(r => h('tr', {}, h('th', { scope: 'row' }, r.th), cols.map(c => h('td', { class: c.key === 'STANDARD' ? 'rec' : '' }, c.cell[r.id] ? c.cell[r.id].join(' · ') : '—')))),
      h('tr', {}, h('th', { scope: 'row' }, 'รับประกันงานติดตั้ง'), cols.map(c => h('td', { class: c.key === 'STANDARD' ? 'rec' : '' }, c.item.warranty || '—')))));
  return h('div', { class: 's-mat-wrap', tabindex: '0', role: 'region', 'aria-label': 'ตารางเทียบวัสดุ เลื่อนดูด้านข้างได้' }, t);
}
export function mountMaterials(root, cfg = {}) {
  let type = 'wall', btu = 12000;
  const show = h('div', { class: 'mt3-root' }); root.append(show);
  import('./materials3d.js').then(m => m.mountMaterials3D(show, { theme: cfg.theme })).catch(e => console.warn('materials showcase', e));
  const sizes = { wall: [12000, 18000, 24000, 30000], ceiling: [24000, 36000, 48000, 60000], cassette: [24000, 36000, 48000, 60000], floor: [36000, 48000, 60000] };
  const bar = h('div', { class: 's-seg', role: 'group', 'aria-label': 'ประเภทเครื่อง' });
  const sz = h('div', { class: 's-seg', role: 'group', 'aria-label': 'ขนาด' });
  const out = h('div');
  const why = h('div', { class: 's-why' },
    h('h3', {}, 'ก่อนจ้างติดตั้ง ไม่ว่าร้านไหน ควรถาม 6 ข้อนี้'),
    h('ol', {}, ['ท่อทองแดงหนากี่มิลลิเมตร และยี่ห้ออะไร', 'ฉนวนหุ้มท่อยี่ห้อและความหนาเท่าไร', 'สายไฟยี่ห้อ ขนาด และมีเบรกเกอร์แยกหรือไม่', 'ทำ Vacuum ก่อนปล่อยน้ำยาหรือไม่ ใช้เวลาเท่าไร', 'ราคารวมท่อกี่เมตร ส่วนเกินคิดเมตรละเท่าไร', 'รับประกันงานติดตั้งกี่ปี ครอบคลุมอะไร'].map(x => h('li', {}, x))),
    h('p', { class: 's-note' }, 'ทุกข้อด้านซ้ายเราระบุไว้ในแพ็กเกจและในใบเสนอราคาแล้ว ลูกค้าตรวจของจริงหน้างานเทียบกับเอกสารได้'));
  function render() {
    bar.innerHTML = ''; sz.innerHTML = '';
    [['wall', 'ติดผนัง'], ['ceiling', 'แขวนใต้ฝ้า'], ['cassette', 'สี่ทิศทาง'], ['floor', 'ตู้ตั้งพื้น']].forEach(([id, th]) => bar.append(h('button', { type: 'button', 'aria-pressed': id === type, onclick: () => { type = id; btu = sizes[id][0]; render(); } }, th)));
    sizes[type].forEach(b => sz.append(h('button', { type: 'button', 'aria-pressed': b === btu, onclick: () => { btu = b; render(); } }, (b / 1000) + 'k BTU')));
    out.innerHTML = ''; out.append(materialTable(type, btu));
  }
  root.append(h('div', { class: 's-mat-tools' }, bar, sz), h('div', { class: 's-mat-grid' }, out, why), h('p', { class: 's-note' }, 'ข้อมูลจากแพ็กเกจติดตั้งใน Pricebook 2569 ราคาต่อเครื่องก่อน VAT รวมท่อและวัสดุ 4 เมตรแรก ทุกแพ็กเกจบนเว็บใช้วัสดุเกรดพรีเมียมชุดเดียวกัน · ท่อน้ำยาทองแดง O-TWO หนา 0.70 มม. ทุกงาน'));
  render();
}


/* =========================================================
   Cleaning packages — what each level gives, who it suits, starting prices (Pricebook) — from sales manual SBP-SAL-001
   ========================================================= */
export const PKG_INFO = [
  { id: 'Basic Clean', code: 'P1', pitch: 'คุ้มค่า', fit: 'บ้าน คอนโด ร้านเล็ก ที่ต้องการล้างตามรอบ', gets: ['ใบรับมอบงาน / รายงานแบบย่อรายเครื่อง', 'ทดสอบการทำงาน น้ำทิ้ง และ Error Code หลังล้าง (T1)'], care: 'ไม่มี' },
  { id: 'Standard Care', code: 'P2', pitch: 'มีหลักฐาน วางแผนซ่อมได้', fit: 'สำนักงาน ร้านค้า คลินิก ร้านอาหาร ที่ต้องการเอกสารและภาพ', gets: ['Service Report พร้อมภาพ 2–4 ภาพต่อเครื่อง', 'วัดค่าก่อน–หลัง (T2): ลมกลับ ลมจ่าย ผลต่างอุณหภูมิ กระแส แรงดัน', 'ประเมินสภาพเครื่อง A–D + สรุปโครงการ'], care: 'Service Care 90 วัน' },
  { id: 'Corporate Control', code: 'P3', pitch: 'บริหารทรัพย์สิน', fit: 'องค์กรหลายสาขา โรงงาน โรงแรม โรงพยาบาล', gets: ['ทะเบียนทรัพย์สิน รุ่น / หมายเลขเครื่อง รายเครื่อง', 'ดัชนีภาพ + ค่าตรวจวัดเชื่อมกับทะเบียน (T3)', 'จัดลำดับความสำคัญ แนวโน้ม ผู้รับผิดชอบ กำหนดปิดเคส'], care: 'Service Care Plus 90 วัน' },
];
export const METHOD_INFO = [
  { id: 'C1', th: 'ล้างปกติ (C1)', d: 'ล้างที่ตำแหน่งเดิม ล้างจุดบริการและส่วนที่เข้าถึงได้ ไม่ปลดเครื่อง ไม่เปิดวงจรน้ำยา' },
  { id: 'C2', th: 'ล้างใหญ่ (C2)', d: 'ปลดคอยล์เย็นลงล้างโดยไม่ตัดท่อน้ำยา ถอดใบพัดโบลเวอร์และถาดน้ำทิ้งตามทะเบียนชิ้นส่วนที่ถอด (ไม่รวมมอเตอร์ แผงวงจร และการเปิดวงจรน้ำยา)' },
  { id: 'C3', th: 'ตัดล้าง (C3)', d: 'สำรวจก่อนเสมอ รวมทดสอบรั่ว Vacuum และ Commissioning ตามใบเสนอราคา ไม่มีราคามาตรฐานบนเว็บ' },
];
export function cleanPackageGuide(where = 'บริการ', hl = 'h4') {   // hl = heading level for the cards (depends on where it sits)
  let method = 'C1';
  const root = h('div', { class: 'pk' });
  const types = [['wall', 'ติดผนัง'], ['ceiling', 'แขวนใต้ฝ้า'], ['cassette', 'สี่ทิศทาง'], ['floor', 'ตั้งพื้น/ตั้งตู้'], ['duct', 'ซ่อนในฝ้า/ท่อลม']];
  const startAt = (pkg, lv) => { const rs = DATA.clean.filter(r => r.pkg === pkg && r.level === lv && r.type && r.rate.s != null); return rs.length ? Math.min(...rs.map(r => r.rate.s)) : null; };
  function render() {
    root.innerHTML = '';
    const cards = h('div', { class: 'pk-cards' }, PKG_INFO.map(p => { const r = DATA.clean.find(x => x.pkg === p.id && x.type); const from = startAt(p.id, 'C1');
      return h('article', { class: 'pk-card' + (p.code === 'P2' ? ' rec' : '') }, h('p', { class: 'pk-code' }, p.code, p.code === 'P2' ? h('span', {}, 'แนะนำสำหรับธุรกิจ') : null), h(hl, {}, p.id), h('p', { class: 'pk-pitch' }, p.pitch),
        h('p', { class: 'pk-from' }, h('small', {}, 'ล้างปกติ เริ่ม'), h('b', {}, from ? baht(from) : '—'), h('small', {}, '/ เครื่อง ก่อน VAT')),
        h('ul', {}, p.gets.map(g => h('li', {}, g))), h('dl', {}, h('dt', {}, 'รับประกันงานล้าง'), h('dd', {}, r?.warranty || '—'), h('dt', {}, 'ดูแลหลังบริการ'), h('dd', {}, p.care), h('dt', {}, 'เหมาะกับ'), h('dd', {}, p.fit))); }));
    const methods = h('div', { class: 'pk-methods' }, METHOD_INFO.map(m => h('div', {}, h('b', {}, m.th), h('p', {}, m.d))));
    const seg = h('div', { class: 's-seg', role: 'group', 'aria-label': 'วิธีล้าง' }, [['C1', 'ล้างปกติ C1'], ['C2', 'ล้างใหญ่ C2']].map(([k, t]) => h('button', { type: 'button', 'aria-pressed': k === method, onclick: () => { method = k; render(); } }, t)));
    const tb = h('tbody');
    types.forEach(([t, th]) => { const bands = SIZE_BANDS.filter(b => DATA.clean.some(r => r.type === t && r.range === (t === 'wall' ? b.wall : b.other)));
      bands.forEach((b, i) => { const rg = t === 'wall' ? b.wall : b.other; tb.append(h('tr', {}, i === 0 ? h('th', { rowspan: bands.length, scope: 'rowgroup' }, th) : null, h('td', {}, rg + ' BTU'), ...PKG_INFO.map(p => { const r = DATA.clean.find(x => x.pkg === p.id && x.level === method && x.type === t && x.range === rg); return h('td', { class: 'pr' }, r && r.rate.s != null ? baht(r.rate.s) : 'ประเมิน'); }))); }); });
    root.append(cards,
      h('div', { class: 'pk-key' }, h('b', {}, 'ระดับบริการแพงขึ้น ไม่เท่ากับล้างลึกขึ้น: '), 'ความลึกของการล้างอยู่ที่วิธีล้าง C1 / C2 ส่วน P1 / P2 / P3 คือหลักฐาน การตรวจวัด การรับประกัน และการดูแลหลังงาน เลือกได้อิสระ เช่น P3 + ล้างปกติ'),
      methods,
      h('div', { class: 'pk-table-h' }, h(hl, {}, 'ราคาต่อเครื่อง (ก่อน VAT) ตามประเภทและขนาด'), seg),
      h('div', { class: 'pk-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางราคาล้างต่อเครื่อง (' + where + ')' }, h('table', { class: 'pk-t' }, h('thead', {}, h('tr', {}, h('th', {}, 'ประเภท'), h('th', {}, 'ขนาด'), ...PKG_INFO.map(p => h('th', {}, p.id)))), tb)),
      h('p', { class: 's-note' }, `ราคามาตรฐานจาก Pricebook 2569 · ขั้นต่ำต่อการเข้าหน้างาน ${baht(DATA.minBill)} · งานเสริมตามอาการ (น้ำยาล้างคอยล์เกรดอุตสาหกรรม, Chemical Wash สเปรย์โฟมเกรด อย., ตรวจระบบน้ำยา) เสนอราคาแยกเมื่อจำเป็น · Service Care คือสิทธิ์ดูแลหลังส่งมอบตามเงื่อนไขในใบเสนอราคา ไม่ใช่การรับประกัน · สัญญารายปี 10 เครื่องขึ้นไปมีราคาขั้นบันได`));
  }
  render();
  return root;
}
/* =========================================================
   Service price centre
   ========================================================= */
export function mountPriceCenter(root) {
  const tabs = [
    { id: 'clean', th: 'ล้างแอร์' }, { id: 'install', th: 'ติดตั้ง' }, { id: 'repair', th: 'ซ่อม' },
    { id: 'contract', th: 'สัญญาล้างรายปี' }, { id: 'move', th: 'รื้อ · ย้าย · น้ำยา · งานพิเศษ' }, { id: 'mat', th: 'วัสดุและอุปกรณ์เสริม' }, { id: 'project', th: 'งานโครงการ · รีโนเวต' },
  ];
  let tab = 'clean', pkg = 'Standard Care', level = 'C1', insLevel = 'STANDARD', q = '';
  const bar = h('div', { class: 's-tabs', role: 'tablist', 'aria-label': 'หมวดค่าบริการ' });
  const tools = h('div', { class: 's-pc-tools' });
  const search = h('input', { class: 's-search', id: 'pc-search', placeholder: 'ค้นหารายการ เช่น ปั๊มน้ำทิ้ง, เบรกเกอร์, คาปาซิเตอร์', autocomplete: 'off', 'aria-label': 'ค้นหาค่าบริการ' });
  search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); body(); });
  const out = h('div', { class: 's-pc-body' });
  root.append(bar, tools, out);
  tabs.forEach(t => { const b = h('button', { type: 'button', role: 'tab', 'aria-selected': t.id === tab, onclick: () => { tab = t.id; head(); body(); } }, t.th); bar.append(b); });
  const seg = (list, val, set, label) => h('div', { class: 's-seg', role: 'group', 'aria-label': label }, list.map(o => h('button', { type: 'button', 'aria-pressed': o.id === val, onclick: () => { set(o.id); head(); body(); } }, o.th, o.sub ? h('small', {}, o.sub) : null)));
  function head() {
    $$('[role=tab]', bar).forEach((b, i) => b.setAttribute('aria-selected', tabs[i].id === tab));
    tools.innerHTML = '';
    if (tab === 'clean') tools.append(seg(CLEAN_PKGS, pkg, v => pkg = v, 'แพ็กเกจ'), seg([{ id: 'C1', th: 'ล้างปกติ C1', sub: 'ล้างตามจุดที่เข้าถึงได้' }, { id: 'C2', th: 'ล้างใหญ่ C2', sub: 'C1 + ถอดล้าง Blower / ถาดน้ำทิ้ง' }], level, v => level = v, 'ระดับการล้าง'));
    if (tab === 'install') tools.append(seg([{ id: 'STANDARD', th: 'มาตรฐาน', sub: 'วัสดุพรีเมียมครบ' }, { id: 'PREMIUM', th: 'พรีเมียม', sub: '+ Support และงานเก็บรายละเอียด' }], insLevel, v => insLevel = v, 'ระดับงานติดตั้ง'));
    tools.append(search);
  }
  const match = (...txt) => !q || txt.join(' ').toLowerCase().includes(q);
  function row({ name, sub, ex, unit, warranty, inc, exc, add }) {
    const vrf = isVRF(name, sub);   // Rev.09: VRV / VRF never goes into the basket — separate inquiry
    const r = h('div', { class: 's-row' + (ex == null ? ' sv' : '') },
      h('div', { class: 's-row-t' }, h('b', {}, name, vrf ? h('span', { class: 's-tag-vrf' }, 'ติดต่อแยก') : null), sub ? h('small', {}, sub) : null),
      vrf ? h('span', { class: 's-price survey' }, 'งานโครงการ') : priceNode(ex, unit),
      h('div', { class: 's-row-w' }, warranty && !vrf ? h('small', {}, warranty) : null),
      vrf ? h('button', { type: 'button', class: 's-add-btn s-ask', onclick: () => askTeam('ระบบ VRV / VRF', name) }, 'ติดต่อสอบถาม')
        : h('button', { type: 'button', class: 's-add-btn', onclick: () => { cart.add(add); toast(`เพิ่ม "${name}" แล้ว`); } }, ex == null ? '+ ขอประเมิน' : '+ เพิ่ม'));
    if (inc || exc) r.append(h('details', { class: 's-row-d' }, h('summary', {}, 'รายละเอียด'), inc ? h('p', {}, h('b', {}, 'รวม: '), inc) : null, exc ? h('p', {}, h('b', {}, 'ไม่รวม: '), exc) : null));
    return r;
  }
  const group = (title, rows, note) => rows.length ? h('section', { class: 's-grp' }, h('h3', {}, title), note ? h('p', { class: 's-note' }, note) : null, h('div', { class: 's-rows' }, rows)) : null;
  function body() {
    out.innerHTML = '';
    if (tab === 'clean') {
      out.append(h('details', { class: 'pk-det', open: true }, h('summary', {}, 'เทียบแพ็กเกจล้าง: ได้อะไร เหมาะกับใคร ราคาเริ่มต้น'), cleanPackageGuide('ศูนย์ราคา', 'h3')));
      const P = CLEAN_PKGS.find(p => p.id === pkg);
      const rows = DATA.clean.filter(r => r.pkg === pkg && r.level === level);
      const first = rows.find(r => r.type);
      out.append(h('div', { class: 's-pc-info' }, h('p', {}, h('b', {}, `${P.th} · ${level === 'C1' ? 'ล้างปกติ' : 'ล้างใหญ่'}`), ` — ${first?.doc || ''}`), h('p', { class: 's-note' }, `รับประกัน ${first?.warranty || '—'} · ${first?.care || ''} · ขั้นต่ำต่อการเข้าหน้างาน ${baht(DATA.minBill)} ก่อน VAT`), first ? h('details', { class: 's-row-d' }, h('summary', {}, 'ขอบเขตงาน'), h('p', {}, h('b', {}, 'รวม: '), first.inc), h('p', {}, h('b', {}, 'ไม่รวม: '), first.exc)) : null));
      TYPES.forEach(t => {
        const rs = rows.filter(r => r.type === t.id && match(r.name, t.th, r.range));
        out.append(group(t.th, rs.map(r => row({ name: `${t.th} ${r.range} BTU`, ex: r.rate.s, unit: r.unit, warranty: r.warranty, add: { kind: 'service', group: 'clean', key: `C-${pkg}-${level}-${t.id}-${r.range}`, name: `${level === 'C1' ? 'ล้างปกติ' : 'ล้างใหญ่'} ${t.th} ${r.range} BTU`, detail: pkg, unitEx: r.rate.s, qty: 1 } }))));
      });
      const extra = rows.filter(r => !r.type && match(r.name, r.ty));
      out.append(group('งานเพิ่ม · AHU · พื้นที่พิเศษ', extra.map(r => row({ name: r.name, sub: `${r.ty} · ${r.range}`, ex: r.rate.s, unit: r.unit, warranty: r.warranty, inc: r.inc, exc: r.exc, add: { kind: r.rate.s == null ? 'survey' : 'service', group: 'clean', key: `CX-${r.name}`, name: r.name, unitEx: r.rate.s, qty: 1 } })), 'รายการที่ไม่มีราคา ทีมประเมินจากหน้างานจริงก่อนเริ่มงาน'));
    }
    if (tab === 'install') {
      const L = { STANDARD: 'มาตรฐาน', PREMIUM: 'พรีเมียม' }[insLevel];
      const items = DATA.inst.filter(i => /^INS-/.test(i.code) && i.code.endsWith('-' + insLevel));
      const sample = items[0];
      out.append(h('div', { class: 's-pc-info' }, h('p', {}, h('b', {}, `ติดตั้ง${L}`), ' — ราคาต่อเครื่อง รวมท่อน้ำยาและวัสดุ 4 เมตรแรก'), sample ? h('details', { class: 's-row-d' }, h('summary', {}, 'ขอบเขตงาน'), h('p', {}, h('b', {}, 'รวม: '), sample.inc), h('p', {}, h('b', {}, 'ไม่รวม: '), sample.exc), h('p', {}, h('b', {}, 'รับประกัน: '), sample.warranty)) : null));
      [['W', 'ติดผนัง'], ['C', 'แขวนใต้ฝ้า'], ['K', 'สี่ทิศทาง'], ['FS', 'ตู้ตั้งพื้น']].forEach(([c, th]) => {
        const rs = items.filter(i => i.code.startsWith(`INS-${c}-`) && match(i.name));
        out.append(group(th, rs.map(i => row({ name: i.name.replace(/^บริการติดตั้ง\S+ — /, ''), ex: i.ex, unit: i.unit, warranty: i.warranty, add: { kind: 'service', group: 'install', key: `I-${i.code}`, name: i.name, unitEx: i.ex, qty: 1 } }))));
      });
      const sv = DATA.inst.filter(i => /^INS-.*SURVEY$/.test(i.code) && match(i.name));
      out.append(group('ระบบอื่น (สำรวจก่อนเสนอราคา)', sv.map(i => row({ name: i.name, ex: null, unit: i.unit, inc: i.inc, exc: i.exc, add: { kind: 'survey', group: 'install', key: `S-${i.code}`, name: i.name, unitEx: null, qty: 1 } }))));
    }
    if (tab === 'repair') {
      const cats = [...new Set(DATA.rep.map(r => r.cat))];
      out.append(h('div', { class: 's-pc-info' }, h('p', {}, h('b', {}, 'ค่าซ่อมตามรายการ'), ' — เริ่มจากค่าตรวจวินิจฉัย ช่างแจ้งราคาซ่อมและรับประกันต่อรายการก่อนลงมือ'), h('p', { class: 's-note' }, 'ราคาที่แสดงเป็นราคามาตรฐาน อะไหล่บางรายการต้องยืนยันรุ่นก่อน')));
      cats.forEach(c => out.append(group(c, DATA.rep.filter(r => r.cat === c && match(r.name, c)).map(r => row({ name: r.name, ex: r.rate.s, unit: r.unit, warranty: r.warranty, inc: r.inc, exc: r.exc, add: { kind: r.rate.s == null ? 'survey' : 'service', group: 'repair', key: `R-${r.name}`, name: r.name, unitEx: r.rate.s, qty: 1 } })))));
    }
    if (tab === 'contract') {
      out.append(h('div', { class: 's-pc-info' }, h('p', {}, h('b', {}, 'สัญญาล้างรายปี (PM)'), ' — ทีมวางรอบล่วงหน้าทั้งปี ส่งรายงานตามแพ็กเกจหลังทุกรอบ วางบิลตามรอบ'), h('p', { class: 's-note' }, `ราคาต่อเครื่องต่อครั้ง อัตรามาตรฐาน · ขั้นต่ำต่อการเข้าหน้างาน ${baht(DATA.minBill)} · สัญญารายปี 10 เครื่องขึ้นไปมีราคาขั้นบันได`),
        h('button', { type: 'button', class: 's-btn primary', onclick: () => { const b = document.getElementById('b2b'); b && b.scrollIntoView({ behavior: 'smooth' }); } }, 'คำนวณสัญญาของอาคารคุณ')));
      const cardsBox = h('div', { class: 's-pk3' });
      CLEAN_PKGS.forEach(P => {
        const rs = TYPES.map(t => { const a = DATA.clean.find(r => r.pkg === P.id && r.level === 'C1' && r.type === t.id); const b = DATA.clean.find(r => r.pkg === P.id && r.level === 'C2' && r.type === t.id); return a ? [t, a, b] : null; }).filter(Boolean);
        const first = rs[0] && rs[0][1];
        cardsBox.append(h('article', { class: 's-pk' + (P.id === 'Standard Care' ? ' rec' : '') }, h('h3', {}, P.th, P.id === 'Standard Care' ? h('small', {}, 'แนะนำ') : null), h('p', { class: 's-note' }, P.sub),
          h('table', { class: 's-btable' }, h('thead', {}, h('tr', {}, h('th', {}, 'ประเภท (เล็กสุด)'), h('th', {}, 'ล้างปกติ'), h('th', {}, 'ล้างใหญ่'))), h('tbody', {}, rs.filter(([t, a]) => match(t.th, P.th)).map(([t, a, b]) => h('tr', {}, h('td', {}, `${t.th} ${a.range}`), h('td', {}, baht(a.rate.s)), h('td', {}, b ? baht(b.rate.s) : '—'))))),
          first ? h('p', { class: 's-note' }, `เอกสาร: ${first.doc} · รับประกัน ${first.warranty}`) : null));
      });
      out.append(cardsBox);
    }
    if (tab === 'project') {
      out.append(h('div', { class: 's-pc-info' }, h('p', {}, h('b', {}, 'งานโครงการ · รีโนเวต · ระบบใหญ่'), ' — สำรวจหน้างาน ออกแบบ ทำ BOQ แล้วเสนอราคาเป็นงวด'), h('p', { class: 's-note' }, 'งานกลุ่มนี้ราคาขึ้นกับแบบและหน้างานจริง จึงไม่มีราคาตายตัวบนเว็บ กด "ขอประเมิน" เพื่อให้ทีมติดต่อกลับ')));
      // Rev.09 r9: new build / renovation / replacement estimate lives on the corporate page (#projects)
      if (document.getElementById('projects')) out.append(h('div', { class: 's-pc-info' }, h('p', {}, h('b', {}, 'สร้างใหม่ · รีโนเวต · เปลี่ยนแอร์ทั้งชุดพร้อมเทิร์น'), ' — ดูขั้นตอนงานและประมาณการค่าติดตั้งทีละห้องจาก Pricebook'), h('button', { type: 'button', class: 's-btn', onclick: () => document.getElementById('projects').scrollIntoView({ behavior: 'smooth' }) }, 'ประมาณการงานโครงการ')));
      out.append(h('div', { class: 's-vrf' }, h('p', {}, h('b', {}, 'VRV / VRF · '), VRF_NOTE), h('button', { type: 'button', class: 's-btn primary', onclick: () => askTeam('ระบบ VRV / VRF') }, 'ติดต่อสอบถาม VRV / VRF')));
      const kinds = [['ระบบ VRF / VRV', 'หลายคอยล์เย็นต่อคอยล์ร้อนชุดเดียว เหมาะกับอาคารสำนักงานและคอนโด'], ['ระบบ Package / Rooftop', 'พื้นที่ใหญ่ โรงงาน โชว์รูม ห้างร้าน'], ['ระบบท่อลม (Duct) และหัวจ่ายลม', 'ซ่อนเครื่องในฝ้า กระจายลมทั่วห้อง'], ['AHU / FCU อาคาร', 'ล้าง ซ่อม ปรับปรุงระบบลมของอาคาร'], ['รีโนเวตเปลี่ยนเครื่องทั้งชั้น', 'รื้อเครื่องเดิม เดินท่อใหม่ ติดตั้ง และจัดการซาก'], ['ห้อง Server / ห้องควบคุม', 'ออกแบบเครื่องสำรอง N+1 และระบบเตือน']];
      out.append(group('ประเภทงาน', kinds.filter(([n, d]) => match(n, d)).map(([n, d]) => row({ name: n, sub: d, ex: null, add: { kind: 'survey', group: 'install', key: `PJ-${n}`, name: `ขอสำรวจ: ${n}`, unitEx: null, qty: 1 } }))));
      const pj = DATA.inst.filter(i => ['05', '15'].some(p => (i.cat || '').startsWith(p)) && match(i.name, i.cat));
      [...new Set(pj.map(i => i.cat))].forEach(c => out.append(group(c.replace(/^\d+\s*/, ''), pj.filter(i => i.cat === c).map(i => row({ name: i.name, ex: i.ex, unit: i.unit, warranty: i.warranty, inc: i.inc, exc: i.exc, add: { kind: i.ex == null ? 'survey' : 'addon', group: 'addon', key: `A-${i.code}`, name: i.name, unitEx: i.ex, qty: 1 } })))));
    }
    const instCats = pre => DATA.inst.filter(i => pre.some(p => (i.cat || '').startsWith(p)));
    if (tab === 'move' || tab === 'mat') {
      const pres = tab === 'move' ? ['13', '11', '14', '16', '12', '17'] : ['06', '07', '08', '09', '10'];
      const all = instCats(pres);
      [...new Set(all.map(i => i.cat))].forEach(c => out.append(group(c.replace(/^\d+\s*/, ''), all.filter(i => i.cat === c && match(i.name, c)).map(i => row({ name: i.name, ex: i.ex, unit: i.unit, warranty: i.warranty, inc: i.inc, exc: i.exc, add: { kind: i.ex == null ? 'survey' : 'addon', group: 'addon', key: `A-${i.code}`, name: i.name, unitEx: i.ex, qty: 1 } })))));
    }
    if (!out.querySelector('.s-row')) out.append(h('p', { class: 's-empty' }, 'ไม่พบรายการที่ค้นหา'));
  }
  head(); body();
  return { show: id => { tab = id; head(); body(); root.scrollIntoView({ behavior: 'smooth' }); } };
}
