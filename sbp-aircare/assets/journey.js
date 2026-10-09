// Small shared pieces for the customer journey: travel-fee table, quote progress pill, contact form topic (Rev.09).
import { TRAVEL, baht, h, $$ } from './sbp-core.js';
import { cart } from './commerce.js';

export function travelTable() {
  const rows = [['กรุงเทพฯ นนทบุรี ปทุมธานี สมุทรปราการ สมุทรสาคร', 'ไม่มีค่าเดินทาง', '—']];
  TRAVEL.bands.forEach(b => {
    const fee = `${baht(b.fee(0))} ก่อน VAT`;
    rows.push([`ระยะถนน ${b.th}`, fee, [b.minUnits > 1 ? `ขั้นต่ำ ${b.minUnits} เครื่อง` : null, b.waiveAt ? `ยกเว้นเมื่อ ${b.waiveAt} เครื่องขึ้นไป` : null].filter(Boolean).join(' · ') || '—']);
  });
  rows.push([`เกิน ${TRAVEL.maxKm} กม.`, 'รับเป็นงานโครงการ / สัญญา', `ค่าทีมต่อวัน + ทางด่วน + ที่พักตามจริง`]);
  return h('div', { class: 's-mat-wrap', tabindex: '0', role: 'region', 'aria-label': 'ตารางค่าเดินทาง' }, h('table', { class: 's-mat compact s-travel' },
    h('thead', {}, h('tr', {}, h('th', {}, 'พื้นที่'), h('th', {}, 'ค่าเดินทางต่อเที่ยว (ก่อน VAT)'), h('th', {}, 'เงื่อนไข'))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map((c, i) => i ? h('td', {}, c) : h('th', { scope: 'row' }, c)))))),
    h('p', { class: 's-note', style: 'padding:8px 12px;margin:0' }, 'คิดต่อเที่ยว ไม่ใช่ต่อเครื่อง · งานสัญญารายปีรวมค่าเดินทางต่อรอบไว้ในราคาต่อปีแล้ว'));
}

// floating "your quote" pill for desktop — appears after the first item is added
export function mountQuotePill(openCart) {
  const pill = h('button', { type: 'button', class: 's-qpill', hidden: true, 'aria-live': 'polite' });
  document.body.append(pill);
  pill.addEventListener('click', openCart);
  const upd = () => { const n = cart.items.length; pill.hidden = !n; if (!n) return; const t = cart.totals(); pill.innerHTML = ''; pill.append(h('span', {}, `ใบเสนอราคา ${n} รายการ`), h('b', {}, baht(t.inc)), h('i', {}, 'เปิดใบเสนอราคา')); };
  cart.subs.add(upd); upd();
}

// mobile: the header nav is hidden, so add a "เมนู" button to the bottom bar that opens a section sheet
export function mountMobileMenu() {
  const bar = document.querySelector('.mbar'); const links = () => [...document.querySelectorAll('header nav a[href^="#"]')];
  if (!bar || !links().length) return;
  const sheet = h('div', { class: 's-msheet', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'เมนู' });
  const panel = h('div', { class: 's-msheet-p' });
  const close = () => { sheet.classList.remove('open'); setTimeout(() => sheet.hidden = true, 220); };
  const hub = globalThis.SBP_HUB ?? './';   // single-file builds set this (artifact URL, or '' when embedded in the tester)
  // links are read when the sheet opens, so a menu rebuilt later (site.js views) is what the sheet shows
  const fill = () => {
    panel.innerHTML = ''; panel.append(h('p', { class: 's-lbl' }, 'ไปที่หัวข้อ'));
    links().forEach(a => panel.append(h('a', { href: a.getAttribute('href'), 'aria-current': a.getAttribute('aria-current'), onclick: close }, a.textContent.replace(/^\d+\s*/, ''))));
    if (hub) panel.append(h('a', { href: hub, class: 'hub', target: /^https?:/.test(hub) ? '_blank' : null }, 'หน้ารวมทุกแบบ'));
  };
  sheet.append(panel); document.body.append(sheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const btn = h('button', { type: 'button', class: 'btn-ghost s-mmenu', 'aria-haspopup': 'dialog' }, 'เมนู');
  btn.addEventListener('click', () => { fill(); sheet.hidden = false; requestAnimationFrame(() => { sheet.classList.add('open'); const a = panel.querySelector('a'); a && a.focus(); }); });
  bar.prepend(btn);
}

/* =========================================================
   Customer workflow: 6 steps from "see my room" to "handover report".
   Section cards + a small desktop dock. Status comes from what the visitor actually did
   (sections seen, lines in the quote basket, area checked).
   ids: { room, product, service, area, quote }  — section ids in this variant
   ========================================================= */
const FLOW = [
  { k: 'room', th: 'เลือกห้องและขนาด', d: 'เลือกแบบห้อง ทิศแดด และจำนวนคน ดู BTU ที่เหมาะ', cta: 'เปิดห้องจำลอง' },
  { k: 'product', th: 'เลือกรุ่นแอร์', d: 'ทุกรุ่นมีราคาจริง (ก่อน VAT) และแพ็กเกจติดตั้ง', cta: 'ดูสินค้า' },
  { k: 'service', th: 'เลือกบริการ', d: 'ดูขั้นตอนล้าง ติดตั้ง ซ่อม สิ่งที่รวม/ไม่รวม และราคา', cta: 'ดูขั้นตอนบริการ' },
  { k: 'area', th: 'เช็กพื้นที่และค่าเดินทาง', d: 'กรุงเทพฯ และปริมณฑลไม่มีค่าเดินทาง จังหวัดใกล้เคียงคิดตามระยะ', cta: 'เช็กพื้นที่' },
  { k: 'quote', th: 'ส่งใบเสนอราคาเบื้องต้น', d: 'ระบบรวมยอด (เลือกใบกำกับภาษีได้) แล้วสร้างสรุปให้ส่งทีมทางอีเมลหรือโทร', cta: 'ดูใบเสนอราคา' },
  { k: 'site', th: 'ทีมยืนยันหน้างาน · ส่งมอบรายงาน', d: 'ยืนยันราคาก่อนเริ่มงาน ทำงานตามขั้นตอน ส่งรายงานและเงื่อนไขรับประกัน' },
];
function flowState(seen, cart) {
  const g = new Set(cart.items.map(i => i.group));
  return {
    room: seen.has('room') || cart.items.some(i => /ห้องจำลอง/.test(i.detail || '') || /^SV-/.test(i.key || '')),
    product: g.has('product'),
    service: ['clean', 'install', 'repair', 'contract'].some(x => g.has(x)),
    area: !!cart.zone && cart.zone.tier !== 'unknown',
    quote: false, site: false,
  };
}
export function mountFlow(root, ids, { openCart, dock = true } = {}) {
  const seen = new Set();
  const cards = FLOW.map((f, i) => {
    const b = h(f.cta ? 'a' : 'div', { class: 's-flow-c', href: f.cta ? (f.k === 'quote' ? '#' + ids.quote : '#' + ids[f.k]) : null, 'data-k': f.k },
      h('span', { class: 's-flow-n' }, String(i + 1)), h('b', {}, f.th), h('small', {}, f.d), f.cta ? h('em', {}, f.cta) : h('em', { class: 'muted' }, 'หลังส่งคำขอ'));
    if (f.k === 'quote' && openCart) b.addEventListener('click', e => { if (cart.items.length) { e.preventDefault(); openCart(); } });
    return b;
  });
  const bar = h('div', { class: 's-flow-bar', 'aria-hidden': 'true' }, h('i'));
  root.classList.add('s-flow');
  root.append(h('div', { class: 's-flow-h' }, h('p', { class: 's-lbl' }, 'ขั้นตอนใช้บริการ'), h('span', { class: 's-flow-p', 'aria-live': 'polite' })), bar, h('ol', { class: 's-flow-l' }, cards.map(c => h('li', {}, c))));
  const dk = dock ? h('nav', { class: 's-dock', 'aria-label': 'ความคืบหน้าการเลือกบริการ', hidden: true }) : null;
  if (dk) document.body.append(dk);
  let cur = null;
  function upd() {
    const st = flowState(seen, cart); const done = FLOW.filter(f => st[f.k]).length;
    const next = FLOW.find(f => f.cta && !st[f.k]) || FLOW[4];
    cards.forEach(c => { const k = c.dataset.k; c.classList.toggle('done', !!st[k]); c.classList.toggle('next', k === next.k); c.classList.toggle('cur', k === cur); });
    bar.style.setProperty('--p', (done / 5).toFixed(2));
    $$('.s-flow-p', root).forEach(p => p.textContent = done ? `ทำแล้ว ${done} จาก 5 ขั้น · ต่อไป: ${next.th}` : 'เริ่มจากขั้นไหนก็ได้ ระบบจำรายการในใบเสนอราคาให้');
    if (dk) { dk.innerHTML = ''; FLOW.slice(0, 5).forEach((f, i) => dk.append(h('a', { href: '#' + ids[f.k], class: (st[f.k] ? 'done ' : '') + (f.k === cur ? 'cur ' : '') + (f.k === next.k ? 'next' : ''), title: f.th, onclick: f.k === 'quote' && openCart ? e => { if (cart.items.length) { e.preventDefault(); openCart(); } } : null }, h('span', {}, st[f.k] ? '✓' : String(i + 1)), h('b', {}, f.th)))); }
  }
  // which step is on screen
  const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) { cur = e.target.dataset.flowK; if (cur === 'room' || cur === 'service') seen.add(cur); } }); upd(); }, { rootMargin: '-45% 0px -45% 0px' });
  Object.entries(ids).forEach(([k, id]) => { const el = document.getElementById(id); if (el) { el.dataset.flowK = k; io.observe(el); } });
  // show the dock once the flow section has scrolled away
  // (Rev.09: also on scroll — an observer alone misses a jump past the section, e.g. a menu link or "back to top")
  if (dk) { let q = 0; const chk = () => { q = 0; const r = root.getBoundingClientRect(); dk.hidden = r.bottom > 0; }; addEventListener('scroll', () => { if (!q) q = requestAnimationFrame(chk); }, { passive: true }); chk(); }
  cart.subs.add(upd); upd();
}

// Rev.09 contact helpers live in contact.js (commerce.js uses them too); re-exported for the page wiring
export { enhanceQuoteForm, askTeam } from './contact.js';
