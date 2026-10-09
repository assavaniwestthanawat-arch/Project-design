// SBP AirCare — จองคิว / ขอนัดหมาย (Rev.09 r10, owner 2 ต.ค. 2569: "สร้างระบบจองคิวให้แบบส่ง ticket เข้าระบบหลังบ้านบริษัทได้").
// mountBooking(root, {variant, hl, onSent(id)}) → {preset({service, units, notes, level, pkg}), track(id, tel)} · bookWith(preset) opens it from anywhere.
// A booking is a REQUEST for a date and half-day slot: the team confirms by phone (status in the back office), so the page
// never promises a time. With the back office connected (ticket.js) the 14-day strip shows how many jobs each half-day already
// holds (counts only) and the request lands in the company's ticket sheet; without it the visitor gets the hand-off summary.
// Durations are estimates from the company manual (PRICING.unitsPerTeamDay, cleaning only); out-of-hours / Sunday work is
// "ประเมินหน้างาน" (Pricebook LOG-NIGHT / LOG-SUN carry no fixed price) — no opening hours are invented.
import { h, $$, TYPES, PRICING, COMPANY, CLEAN_PKGS, checkZone, travelNote, TIER_TH } from './sbp-core.js';
import { cart } from './commerce.js';
import { fetchSlots, trackTicket, connected, errTh, SERVICES, SLOTS, STATUSES, sourceTag, quoteFromCart } from './ticket.js';
import { guardForm, consentBox, honeypot, submitTicket } from './contact.js';
import { icon } from './icons.js';

const SVC = [['clean', 'ล้างแอร์'], ['install', 'ติดตั้งแอร์'], ['repair', 'ตรวจเช็ก / ซ่อม'], ['move', 'ย้ายแอร์'], ['amc', 'สำรวจสัญญาล้างรายปี'], ['project', 'สำรวจงานโครงการ / รีโนเวต'], ['other', 'อื่น ๆ']];
const WITH_UNITS = ['clean', 'install', 'repair', 'move', 'amc'];
const SYMPTOMS = ['ไม่เย็น / เย็นน้อย', 'น้ำหยด / น้ำรั่ว', 'มีเสียงดัง', 'มีกลิ่น', 'เปิดไม่ติด / ตัดบ่อย', 'ขึ้นรหัส Error'];
const BUILDINGS = ['บ้าน / ทาวน์เฮาส์', 'คอนโด / อพาร์ตเมนต์', 'สำนักงาน', 'ร้านค้า / ร้านอาหาร', 'โรงงาน / โกดัง', 'โรงแรม / คลินิก / อื่น ๆ'];
const ACCESS = ['ต้องแลกบัตร / ขออนุญาตนิติบุคคล', 'ที่จอดรถจำกัด', 'มีเครื่องติดสูงเกิน 3 ม.', 'ทำงานได้เฉพาะนอกเวลาทำการ'];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const thDay = s => { const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }); };
let current = null;
/** open the booking section with a preset (from journeys, service pages, the quote basket) */
export function bookWith(preset = {}) { if (!current) return false; current.preset(preset); document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }

export function mountBooking(root, { variant = 'A', hl = 'h3', onSent } = {}) {
  root.classList.add('bk');
  const today = new Date(), min = iso(addDays(today, 1)), max = iso(addDays(today, 60));
  const st = { service: 'clean', units: { wall: 1 }, slot: 'AM', avail: null, zone: null };
  const id = k => `bk-${k}-${variant}`;
  // ---- 1 · what ----
  const svc = h('div', { class: 'bk-chips', role: 'radiogroup', 'aria-label': 'งานที่ต้องการ' }, SVC.map(([k, t]) => h('label', { class: 'bk-chip' }, h('input', { type: 'radio', name: id('svc'), value: k, checked: k === st.service, onchange: () => { st.service = k; showSvc(); upd(); } }), h('span', {}, t))));
  const unitBox = h('div', { class: 'bk-units' }, TYPES.map(t => h('label', { class: 'bk-unit' }, h('span', {}, t.th), h('input', { type: 'number', min: '0', max: '999', inputmode: 'numeric', value: st.units[t.id] || 0, 'data-u': t.id, 'aria-label': `จำนวนเครื่อง ${t.th}`, oninput: e => { st.units[t.id] = Math.max(0, Math.min(999, parseInt(e.target.value || '0', 10) || 0)); upd(); } }))));
  const levelSel = h('select', { id: id('level') }, ['ไม่แน่ใจ ให้ช่างแนะนำ', 'ล้างปกติ C1', 'ล้างใหญ่ C2'].map(t => h('option', {}, t)));
  const pkgSel = h('select', { id: id('pkg') }, ['ไม่แน่ใจ', ...CLEAN_PKGS.map(p => p.th)].map(t => h('option', {}, t)));
  const cleanBox = h('div', { class: 'bk-row' }, h('label', { class: 's-field' }, 'วิธีล้าง', levelSel), h('label', { class: 's-field' }, 'แพ็กเกจ', pkgSel));
  const errIn = h('input', { id: id('err'), maxlength: '120' });
  const symBox = h('fieldset', { class: 'bk-sym' }, h('legend', {}, 'อาการที่พบ'), SYMPTOMS.map(t => h('label', { class: 's-chk' }, h('input', { type: 'checkbox', value: t }), h('span', {}, t))),
    h('label', { class: 's-field' }, 'รหัส Error / ยี่ห้อ รุ่น (ถ้าทราบ)', errIn));
  const est = h('p', { class: 'bk-est', 'aria-live': 'polite' });
  // ---- 2 · when ----
  const date = h('input', { type: 'date', id: id('date'), min, max, required: true, onchange: () => { markSlots(); upd(); } });
  const alt = h('input', { type: 'date', id: id('alt'), min, max });
  const slotBox = h('div', { class: 'bk-chips', role: 'radiogroup', 'aria-label': 'ช่วงเวลา' }, Object.entries(SLOTS).map(([k, t]) => h('label', { class: 'bk-chip' }, h('input', { type: 'radio', name: id('slot'), value: k, checked: k === st.slot, onchange: () => { st.slot = k; markSlots(); upd(); } }), h('span', {}, t, k === 'EVE' ? h('small', {}, 'มีค่าแรงเพิ่ม ประเมินหน้างาน') : null))));
  const strip = h('div', { class: 'bk-strip', hidden: true });
  const whenNote = h('p', { class: 's-note', 'aria-live': 'polite' });
  // ---- 3 · where ----
  const addr = h('textarea', { id: id('addr'), rows: 2, maxlength: '400', required: true, placeholder: 'บ้านเลขที่ อาคาร ชั้น ถนน' });
  const area = h('input', { id: id('area'), required: true, placeholder: 'เช่น บางนา, ปากเกร็ด, ศรีราชา', autocomplete: 'off' });
  const areaRes = h('p', { class: 'bk-zone', 'aria-live': 'polite' });
  let zt; area.addEventListener('input', () => { clearTimeout(zt); zt = setTimeout(() => { st.zone = checkZone(area.value); showZone(); upd(); }, 250); });
  const bld = h('select', { id: id('bld') }, BUILDINGS.map(t => h('option', {}, t)));
  const acc = h('div', { class: 'bk-acc' }, ACCESS.map(t => h('label', { class: 's-chk' }, h('input', { type: 'checkbox', value: t }), h('span', {}, t))));
  // ---- 4 · who ----
  const name = h('input', { id: id('name'), required: true, autocomplete: 'name', maxlength: '120' });
  const tel = h('input', { id: id('tel'), required: true, inputmode: 'tel', autocomplete: 'tel', maxlength: '20' });
  const mail = h('input', { id: id('mail'), type: 'email', autocomplete: 'email', maxlength: '120' });
  const co = h('input', { id: id('co'), autocomplete: 'organization', maxlength: '120' });
  const taxChk = h('input', { type: 'checkbox', id: id('taxc'), onchange: () => { taxBox.hidden = !taxChk.checked; } });
  const taxName = h('input', { id: id('taxn'), maxlength: '200', placeholder: 'ชื่อบริษัท สาขา' }), taxId = h('input', { id: id('taxi'), inputmode: 'numeric', maxlength: '17', placeholder: '13 หลัก' });
  const taxBox = h('div', { class: 'bk-row', hidden: true }, h('label', { class: 's-field' }, 'ออกใบกำกับภาษีในนาม', taxName), h('label', { class: 's-field' }, 'เลขผู้เสียภาษี', taxId));
  const attach = h('input', { type: 'checkbox', id: id('att'), checked: true });
  const attachRow = h('label', { class: 's-chk bk-att' }, attach, h('span', {}));
  const notes = h('textarea', { id: id('notes'), rows: 2, maxlength: '2000', placeholder: 'เช่น เวลาที่สะดวกให้โทร จุดที่ต้องระวัง' });
  const hp = honeypot();
  const submit = h('button', { type: 'submit', class: 's-btn primary' }, 'ส่งคำขอจองคิว');
  const step = (n, title, ...kids) => h('fieldset', { class: 'bk-step' }, h('legend', {}, h('span', { class: 'bk-n', 'aria-hidden': 'true' }, String(n)), title), ...kids);
  const form = h('form', { class: 'bk-form', novalidate: true },
    step(1, 'งานที่ต้องการ', svc, h('div', { class: 'bk-u' }, h('p', { class: 'bk-lbl' }, 'จำนวนเครื่องตามประเภท'), unitBox), cleanBox, symBox, est),
    step(2, 'วันและช่วงเวลาที่สะดวก', strip, h('div', { class: 'bk-row' }, h('label', { class: 's-field' }, 'วันที่ต้องการ', date), h('label', { class: 's-field' }, 'วันสำรอง (ถ้ามี)', alt)), slotBox, whenNote),
    step(3, 'สถานที่', h('label', { class: 's-field' }, 'ที่อยู่หน้างาน', addr), h('div', { class: 'bk-row' }, h('label', { class: 's-field' }, 'เขต / อำเภอ', area), h('label', { class: 's-field' }, 'ประเภทอาคาร', bld)), areaRes, acc),
    step(4, 'ผู้ติดต่อ', h('div', { class: 'bk-row' }, h('label', { class: 's-field' }, 'ชื่อผู้ติดต่อ', name), h('label', { class: 's-field' }, 'เบอร์โทร', tel)),
      h('div', { class: 'bk-row' }, h('label', { class: 's-field' }, 'อีเมล (ถ้ามี)', mail), h('label', { class: 's-field' }, 'บริษัท / องค์กร (ถ้ามี)', co)),
      h('label', { class: 's-chk' }, taxChk, h('span', {}, 'ต้องการใบกำกับภาษีเต็มรูป (+VAT 7%)')), taxBox, attachRow, h('label', { class: 's-field' }, 'หมายเหตุถึงทีม', notes)),
    h('div', { class: 'bk-send' }, consentBox(id('consent')), hp, submit,
      h('p', { class: 's-note' }, 'จองคิว = ขอนัดวันและช่วงเวลา ทีมโทรยืนยันวัน เวลา และราคาก่อนเข้างานทุกครั้ง')));
  guardForm(form);
  // ---- side: live summary + track ----
  const sum = h('dl', { class: 'bk-sum' });
  const tId = h('input', { id: id('tid'), placeholder: 'SBP-691002-001', autocapitalize: 'characters', maxlength: '20' }), tTel = h('input', { id: id('ttel'), inputmode: 'tel', placeholder: 'เบอร์ที่ใช้จอง', maxlength: '20' });
  const tOut = h('div', { class: 'bk-tout', 'aria-live': 'polite' });
  const tForm = h('form', { class: 'bk-track', onsubmit: e => { e.preventDefault(); track(tId.value, tTel.value); } },
    h(hl, {}, 'ตรวจสถานะคำขอ'), h('label', { class: 's-field' }, 'เลขที่คำขอ', tId), h('label', { class: 's-field' }, 'เบอร์โทร', tTel), h('button', { type: 'submit', class: 's-btn' }, 'ตรวจสถานะ'), tOut);
  const out = h('div', { class: 'bk-out', hidden: true, tabindex: '-1' });
  const again = h('button', { type: 'button', class: 's-btn ghost', hidden: true, onclick: () => { form.hidden = false; again.hidden = true; out.hidden = true; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'จองคิวอีกรายการ');
  const side = h('aside', { class: 'bk-side' },
    h('div', { class: 'bk-card' }, h(hl, {}, 'สรุปคำขอ'), sum, h('p', { class: 's-note bk-conn' }, connected() ? 'คำขอจะส่งเข้าระบบหลังบ้านของบริษัทและได้เลขที่คำขอทันที' : 'ช่วงทดลอง: ระบบจะสรุปคำขอให้ส่งทีมทางอีเมลหรือโทร')),
    h('div', { class: 'bk-card' }, tForm),
    h('div', { class: 'bk-card' }, h('p', {}, 'ต้องการคุยก่อน โทร ', h('a', { href: COMPANY.telHref }, COMPANY.tel)), h('p', { class: 's-note' }, COMPANY.email)));
  root.append(h('div', { class: 'bk-grid' }, h('div', { class: 'bk-main' }, out, again, form), side));

  function showSvc() {
    const s = st.service;
    unitBox.closest('.bk-u').hidden = !WITH_UNITS.includes(s);
    cleanBox.hidden = s !== 'clean'; symBox.hidden = s !== 'repair';
    if (s === 'repair' && !Object.values(st.units).some(Boolean)) { st.units.wall = 1; $$('[data-u="wall"]', unitBox).forEach(x => x.value = 1); }
  }
  function unitsTotal() { return WITH_UNITS.includes(st.service) ? Object.values(st.units).reduce((a, b) => a + (+b || 0), 0) : 0; }
  function teamDays() { if (st.service !== 'clean') return 0; return Object.entries(st.units).reduce((a, [k, n]) => a + (+n || 0) / (PRICING.unitsPerTeamDay[k] || 12), 0); }
  function showZone() {
    const z = st.zone; areaRes.dataset.tier = z ? z.tier : '';
    areaRes.textContent = !z ? '' : z.tier === 'core' ? `${z.match} · ${TIER_TH.core.th} ไม่มีค่าเดินทาง` : z.tier === 'extended' ? `${z.match}, ${z.province} · ประมาณ ${z.km} กม. · ${travelNote(z)}` : z.tier === 'out' ? `${z.match} · ประมาณ ${z.km} กม. · ${TIER_TH.out.th} ส่งคำขอได้ ทีมประเมินเป็นงานโครงการ` : TIER_TH.unknown.th;
  }
  function markSlots() {
    $$('.bk-strip button', strip).forEach(b => b.setAttribute('aria-pressed', b.dataset.d === date.value && b.dataset.s === st.slot));
    const notes = [];
    if (date.value && new Date(date.value + 'T00:00:00').getDay() === 0) notes.push('วันอาทิตย์ / วันหยุด มีค่าแรงเพิ่ม (ประเมินหน้างาน)');
    if (st.slot === 'EVE') notes.push('นอกเวลาทำการ มีค่าแรงเพิ่ม (ประเมินหน้างาน) ทีมยืนยันเวลาทางโทรศัพท์');
    const a = st.avail && st.avail.days.find(x => x.date === date.value);
    if (a && st.slot !== 'EVE') { const left = st.avail.capacity - a[st.slot]; notes.push(left <= 0 ? 'ช่วงนี้คิวเต็มแล้ว เลือกช่วงอื่น หรือส่งคำขอไว้ ทีมจะเสนอเวลาใกล้เคียง' : `ช่วงนี้ยังรับได้อีก ${left} งาน`); }
    if (!st.avail) notes.push('ทีมจะโทรยืนยันวันและช่วงเวลาที่ว่างจริง');
    whenNote.textContent = notes.join(' · ');
  }
  function renderStrip() {
    if (!st.avail) { strip.hidden = true; return; }
    const cap = st.avail.capacity;
    strip.replaceChildren(h('p', { class: 'bk-lbl' }, 'คิวที่ว่าง 14 วันข้างหน้า (กดเพื่อเลือก)'),
      h('div', { class: 'bk-days', role: 'group', 'aria-label': 'เลือกวันและช่วงเวลาที่ว่าง' }, st.avail.days.map(d => h('div', { class: 'bk-day' }, h('b', {}, thDay(d.date)),
        ['AM', 'PM'].map(s => { const left = cap - d[s], full = left <= 0; return h('button', { type: 'button', 'data-d': d.date, 'data-s': s, disabled: full, class: full ? 'full' : left === 1 ? 'low' : '', 'aria-label': `${thDay(d.date)} ${SLOTS[s]} ${full ? 'เต็ม' : 'ว่าง ' + left + ' งาน'}`,
          onclick: () => { date.value = d.date; st.slot = s; $$(`input[name="${id('slot')}"]`, form).forEach(r => r.checked = r.value === s); markSlots(); upd(); } }, SLOTS[s].replace('ช่วง', ''), h('small', {}, full ? 'เต็ม' : left === 1 ? 'เหลือ 1' : 'ว่าง')); })))));
    strip.hidden = false; markSlots();
  }
  if (connected()) fetchSlots(min, 14).then(r => { st.avail = r; renderStrip(); }).catch(() => { st.avail = null; markSlots(); });
  function upd() {
    const n = unitsTotal(), td = teamDays(), q = cart.items.length;
    est.textContent = st.service === 'clean' && n ? `ล้าง ${n} เครื่อง ใช้ทีมช่างประมาณ ${td <= 0.5 ? 'ครึ่งวัน' : td <= 1 ? '1 วัน' : (Math.ceil(td * 2) / 2) + ' ทีม-วัน'} (ค่าประมาณจากคู่มือบริษัท)` : '';
    attachRow.hidden = !q; attachRow.querySelector('span').textContent = q ? `แนบรายการจากใบเสนอราคาเบื้องต้น (${q} รายการ)` : '';
    const rows = [['งาน', SERVICES[st.service]], n ? ['จำนวน', `${n} เครื่อง`] : null, ['วันที่', date.value ? `${thDay(date.value)} · ${SLOTS[st.slot]}` : 'ยังไม่เลือก'], ['พื้นที่', st.zone && st.zone.match ? `${st.zone.match}${st.zone.tier === 'extended' ? ' (มีค่าเดินทาง)' : ''}` : (area.value || '—')], q && attach.checked ? ['แนบ', `ใบเสนอราคาเบื้องต้น ${q} รายการ`] : null].filter(Boolean);
    sum.replaceChildren(...rows.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!date.value) { date.focus(); return; }
    const checked = box => $$('input[type=checkbox]:checked', box).map(x => x.value);
    const units = WITH_UNITS.includes(st.service) ? Object.fromEntries(Object.entries(st.units).filter(([, n]) => +n > 0)) : {};
    const details = [st.service === 'clean' ? `วิธีล้าง: ${levelSel.value} · แพ็กเกจ: ${pkgSel.value}` : '', st.service === 'repair' ? `อาการ: ${checked(symBox).join(', ') || '-'}${errIn.value.trim() ? ' · ' + errIn.value.trim() : ''}` : ''].filter(Boolean).join('\n');
    const z = st.zone;
    const ticket = {
      kind: 'booking', service: st.service, units, teamDays: Math.round(teamDays() * 10) / 10, prefDate: date.value, slot: st.slot, altDate: alt.value || '',
      customer: { name: name.value.trim(), tel: tel.value.trim(), email: mail.value.trim(), company: co.value.trim(), taxInvoice: taxChk.checked, taxName: taxChk.checked ? taxName.value.trim() : '', taxId: taxChk.checked ? taxId.value.trim() : '' },
      site: { address: addr.value.trim(), area: z && z.match ? `${z.match}${z.province && z.province !== z.match ? ' ' + z.province : ''}` : area.value.trim(), zoneTier: z ? z.tier : '', travelFee: z && z.tier === 'extended' ? z.fee : 0, building: bld.value, access: checked(acc).join(', ') },
      details, notes: notes.value.trim(), quote: cart.items.length && attach.checked ? quoteFromCart(cart) : null, consent: true, website: hp.querySelector('input').value, source: sourceTag(variant),
    };
    const ref = 'R' + Date.now().toString().slice(-7);
    const text = [`ขอจองคิว SBP AirCare · เลขอ้างอิง ${ref}`, `งาน: ${SERVICES[st.service]}`, Object.keys(units).length ? `จำนวน: ${Object.entries(units).map(([k, n]) => `${TYPES.find(t => t.id === k).th} ${n}`).join(', ')}` : '', details,
      `วันที่ต้องการ: ${date.value} ${SLOTS[st.slot]}${alt.value ? ' · สำรอง ' + alt.value : ''}`, `สถานที่: ${ticket.site.address} · ${ticket.site.area} · ${bld.value}${ticket.site.access ? ' · ' + ticket.site.access : ''}`,
      `ผู้ติดต่อ: ${ticket.customer.name} · ${ticket.customer.tel}${ticket.customer.email ? ' · ' + ticket.customer.email : ''}${ticket.customer.company ? ' · ' + ticket.customer.company : ''}`,
      taxChk.checked ? `ใบกำกับภาษี: ${ticket.customer.taxName} ${ticket.customer.taxId}` : '', ticket.quote ? `แนบใบเสนอราคาเบื้องต้น ${ticket.quote.lines.length} รายการ` : '', ticket.notes ? `หมายเหตุ: ${ticket.notes}` : ''].filter(Boolean).join('\n');
    const r = await submitTicket(ticket, { out, form, label: 'คำขอจองคิว', fallback: { ref, title: 'สรุปคำขอจองคิว', text, subject: 'ขอจองคิว SBP AirCare' }, onTrack: (tid, t) => { tId.value = tid; tTel.value = t; track(tid, t); tForm.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    if (r.ok) { onSent && onSent(r.id); form.hidden = true; again.hidden = false; tId.value = r.id; tTel.value = tel.value; if (st.avail) fetchSlots(min, 14).then(x => { st.avail = x; renderStrip(); }).catch(() => {}); }
    out.focus({ preventScroll: true }); out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  async function track(tid, t) {
    tOut.replaceChildren(h('p', { class: 's-note' }, 'กำลังตรวจ…'));
    try {
      const { ticket: k } = await trackTicket(tid, t);
      const order = ['new', 'confirmed', 'assigned', 'in_progress', 'done'], at = order.indexOf(k.status);
      tOut.replaceChildren(h('p', { class: 'bk-tst' }, h('b', {}, k.id), ` · ${SERVICES[k.service] || ''}`),
        k.status === 'cancelled' || k.status === 'need_info' ? h('p', { class: 's-note bad' }, k.statusTh) :
          h('ol', { class: 'bk-tl' }, order.map((s, i) => h('li', { class: i < at ? 'done' : i === at ? 'now' : '' }, i <= at ? icon('check', { size: 12 }) : null, STATUSES[s]))),
        k.schedDate ? h('p', {}, `นัดหมาย: ${thDay(k.schedDate)} ${SLOTS[k.schedSlot] || ''}`) : k.prefDate ? h('p', { class: 's-note' }, `วันที่ขอ: ${thDay(k.prefDate)} ${SLOTS[k.slot] || ''} (รอยืนยัน)`) : null);
    } catch (e) { tOut.replaceChildren(h('p', { class: 's-note bad', role: 'alert' }, errTh(e))); }
  }
  showSvc(); markSlots(); upd();
  cart.subs.add(upd);
  const api = {
    preset({ service, units, notes: n, level, pkg } = {}) {
      if (service && SERVICES[service]) { st.service = service; $$(`input[name="${id('svc')}"]`, form).forEach(r => r.checked = r.value === service); }
      // Rev.10: the D job card also carries the cleaning method / package (option text, e.g. 'ล้างปกติ C1', 'Standard Care')
      if (level && [...levelSel.options].some(o => o.value === level)) levelSel.value = level;
      if (pkg && [...pkgSel.options].some(o => o.value === pkg)) pkgSel.value = pkg;
      if (units) { Object.keys(st.units).forEach(k => st.units[k] = 0); Object.assign(st.units, units); $$('[data-u]', unitBox).forEach(x => x.value = st.units[x.dataset.u] || 0); }
      if (n) notes.value = notes.value ? notes.value + '\n' + n : n;
      form.hidden = false; again.hidden = true; showSvc(); upd();
    },
    track,
  };
  current = api;
  document.addEventListener('sbp:book', e => { e.preventDefault(); api.preset(e.detail || {}); document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  return api;
}
