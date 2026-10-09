// SBP AirCare — contact form topic + message, and askTeam() — Rev.09
// Every "ติดต่อสอบถาม" button (VRV / VRF, project work, FUJIVA, survey requests) scrolls to #quote with the topic pre-selected.
import { h, CONTACT_TOPICS, COMPANY } from './sbp-core.js';
import { sendTicket, errTh, connected, STATUSES } from './ticket.js';
export function enhanceQuoteForm(form = document.getElementById('qform')) {
  if (!form || form.querySelector('.s-qtopic')) return;
  const sel = h('select', { id: 'q-topic', 'aria-label': 'เรื่องที่ต้องการติดต่อ' }, CONTACT_TOPICS.map(t => h('option', { value: t }, t)));
  const msg = h('textarea', { id: 'q-msg', 'aria-label': 'รายละเอียด', placeholder: 'รายละเอียดเพิ่มเติม เช่น ประเภทอาคาร จำนวนเครื่อง ช่วงเวลาที่สะดวก' });
  const btn = form.querySelector('button');
  form.insertBefore(h('label', { class: 'field s-qtopic' }, 'เรื่องที่ต้องการติดต่อ', sel), btn);
  form.insertBefore(h('label', { class: 'field s-qtopic' }, 'รายละเอียด', msg), btn);
  // Rev.09 r10: every form that sends a ticket carries the consent line and the bot trap
  form.insertBefore(consentBox('q-consent'), btn); form.insertBefore(honeypot(), btn);
}
/* ---- Rev.09 r10: tickets to the back office ---- */
// PDPA: purpose-limited consent, shown next to every form that sends personal data (wording for the owner/legal to review)
export const CONSENT_TH = `ยินยอมให้ ${COMPANY.th} ใช้ชื่อ เบอร์โทร อีเมล และที่อยู่ที่กรอก เพื่อติดต่อกลับ นัดหมาย เสนอราคา และให้บริการตามคำขอนี้เท่านั้น`;
export const consentBox = id => h('label', { class: 's-consent' }, h('input', { type: 'checkbox', id, required: true, 'aria-label': 'ยินยอมให้ใช้ข้อมูลเพื่อติดต่อกลับ' }), h('span', {}, CONSENT_TH));
// hidden field people never fill (bots do) — the back office drops tickets that carry it
export const honeypot = () => h('label', { class: 's-hp', 'aria-hidden': 'true' }, 'เว็บไซต์', h('input', { name: 'website', tabindex: '-1', autocomplete: 'off' }));
/**
 * submitTicket(ticket, {out, fallback:{ref, title, text, subject}, label, form, onTrack}) — send to the back office, show the outcome in `out`:
 * stored → the ticket number + what happens next · not connected / blocked / failed → the honest hand-off summary (handoffBox)
 * with the reason. Never says "sent" unless the back office answered ok. Resolves {ok, id?, code?}.
 */
export async function submitTicket(ticket, { out, fallback, label = 'คำขอ', onTrack = null, form = null }) {
  const btn = form && form.querySelector('button[type=submit],button:not([type])');
  if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = 'กำลังส่ง…'; }
  try {
    const r = await sendTicket(ticket);
    out.replaceChildren(ticketCard({ id: r.id, statusTh: r.statusTh || STATUSES.new, label, onTrack, tel: ticket.customer && ticket.customer.tel }));
    out.hidden = false;
    return { ok: true, id: r.id };
  } catch (e) {
    const why = errTh(e), hard = ['bad_tel', 'bad_name', 'no_consent', 'bad_date', 'bad_email', 'rate_limited'].includes(e && e.code);
    out.replaceChildren(hard ? h('p', { class: 's-note bad', role: 'alert' }, why)
      : handoffBox({ ...fallback, note: `${connected() ? why + ' — ' : ''}ระบบช่วงทดลองยังส่งข้อมูลจากหน้านี้ถึงทีมโดยตรงไม่ได้ กรุณาส่งสรุปนี้ให้เราทางอีเมล หรือโทรแจ้งเลขอ้างอิง ทีมจะติดต่อกลับเพื่อยืนยันรายละเอียดและนัดวัน` }));
    out.hidden = false;
    return { ok: false, code: e && e.code };
  } finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t || btn.textContent; } }
}
export function ticketCard({ id, statusTh, label = 'คำขอ', onTrack = null, tel = '' }) {
  const msg = h('span', { class: 's-tk-m', 'aria-live': 'polite' });
  return h('div', { class: 's-tk', role: 'status' },
    h('p', { class: 's-tk-b' }, `ส่ง${label}เข้าระบบของบริษัทแล้ว`),
    h('p', { class: 's-tk-id' }, h('small', {}, 'เลขที่คำขอ'), h('b', {}, id),
      h('button', { type: 'button', class: 's-hand-x', onclick: async () => { msg.textContent = (await copyText(id)) ? 'คัดลอกแล้ว' : 'เลือกเลขแล้วคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก'), msg),
    h('p', {}, `สถานะ: ${statusTh}`),
    h('ol', { class: 's-tk-next' }, h('li', {}, 'ทีมตรวจรายละเอียดและโทรยืนยันวัน เวลา และราคา'), h('li', {}, 'รายการที่ต้องประเมินหน้างาน ทีมแจ้งราคาให้ยืนยันก่อนเริ่มงาน'), h('li', {}, 'ตรวจสถานะได้ทุกเวลาด้วยเลขที่คำขอ + เบอร์โทร')),
    onTrack ? h('button', { type: 'button', class: 's-btn ghost', onclick: () => onTrack(id, tel) }, 'ตรวจสถานะคำขอนี้') : null,
    h('p', { class: 's-note' }, 'เก็บเลขที่คำขอไว้อ้างอิงเมื่อติดต่อทีม · โทร ', h('a', { href: COMPANY.telHref }, COMPANY.tel)));
}
// Rev.09 r10: open the booking section (booking.js listens for 'sbp:book'); pages without it fall back to the contact form
export function requestBooking(preset = {}, topic = 'อื่น ๆ') {
  const ev = new CustomEvent('sbp:book', { detail: preset, cancelable: true });
  if (document.dispatchEvent(ev)) askTeam(topic, preset.notes || '');   // nobody handled it
}
export function askTeam(topic, message = '') {
  const form = document.getElementById('qform'); if (!form) return;
  enhanceQuoteForm(form);
  const sel = form.querySelector('#q-topic'), msg = form.querySelector('#q-msg');
  if (topic && sel) { if (![...sel.options].some(o => o.value === topic)) sel.append(h('option', { value: topic }, topic)); sel.value = topic; }
  if (message && msg && !msg.value.includes(message)) msg.value = (msg.value ? msg.value + '\n' : '') + message;
  const sec = document.getElementById('quote') || form;
  sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  form.classList.remove('s-qflash'); void form.offsetWidth; form.classList.add('s-qflash');
  setTimeout(() => form.querySelector('input,select,textarea')?.focus({ preventScroll: true }), 500);
}

/**
 * Rev.09 r5 (beta) — what happens after "ส่ง": the site has no backend yet, so it must not pretend the request reached the team.
 * handoffBox({ ref, title, text, subject }) shows the reference number, says plainly that nothing was sent, and gives the customer
 * the summary to copy and send (email shown as selectable text — mail links are unreliable inside an artifact) or the phone number.
 */
export async function copyText(text, ta) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { if (ta) { ta.focus(); ta.select(); } return false; }
}
export function handoffBox({ ref, title = 'สรุปคำขอของคุณ', text, subject = 'คำขอจากเว็บไซต์ SBP AirCare', note = 'ระบบช่วงทดลองยังไม่ส่งข้อมูลถึงทีมอัตโนมัติ กรุณาส่งสรุปนี้ให้เราทางอีเมล หรือโทรแจ้งเลขอ้างอิง ทีมจะติดต่อกลับเพื่อยืนยันราคาและนัดวัน' }) {
  const ta = h('textarea', { class: 's-hand-t', readonly: true, rows: Math.min(10, text.split('\n').length + 1), 'aria-label': 'สรุปคำขอสำหรับคัดลอก' }, text);
  const msg = h('p', { class: 's-hand-m', 'aria-live': 'polite' });
  const copyBtn = h('button', { type: 'button', class: 's-btn primary', onclick: async () => { msg.textContent = (await copyText(text, ta)) ? 'คัดลอกแล้ว วางในอีเมลหรือแชตได้เลย' : 'คัดลอกอัตโนมัติไม่ได้ ข้อความถูกเลือกไว้แล้ว กดคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอกสรุป');
  const mail = h('a', { class: 's-btn ghost', href: `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject + (ref ? ' · ' + ref : ''))}&body=${encodeURIComponent(text)}` }, 'เปิดอีเมลพร้อมข้อความ');
  const em = h('span', { class: 's-hand-sel' }, COMPANY.email);
  return h('div', { class: 's-hand', role: 'status' },
    h('p', { class: 's-hand-b' }, 'ช่วงทดลองใช้ (Beta)'),
    h('h3', {}, title, ref ? h('small', {}, ` · เลขอ้างอิง ${ref}`) : null),
    h('p', {}, note),
    ta, h('div', { class: 's-hand-act' }, copyBtn, mail), msg,
    h('dl', { class: 's-hand-c' }, h('dt', {}, 'อีเมล'), h('dd', {}, em, h('button', { type: 'button', class: 's-hand-x', onclick: async () => { msg.textContent = (await copyText(COMPANY.email)) ? 'คัดลอกอีเมลแล้ว' : 'เลือกอีเมลแล้วคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก')),
      h('dt', {}, 'โทร'), h('dd', {}, h('a', { href: COMPANY.telHref }, COMPANY.tel))));
}

/**
 * Rev.09 r6 — field-level validation in Thai, shown next to the field (not the browser's bubble, which is English on many
 * phones and disappears). Runs before the form's own submit handlers; invalid → stops the submit and focuses the first field.
 */
const TEL_RE = /^0[0-9]{8,9}$/;
const fieldName = x => { const l = x.closest('label'); return (l ? [...l.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim() : x.getAttribute('aria-label') || '').replace(/\s*\(.*\)$/, ''); };
function fieldError(x) {
  if (x.type === 'checkbox') return x.required && !x.checked ? (x.closest('.s-consent') ? 'กรุณายืนยันการใช้ข้อมูลเพื่อติดต่อกลับ' : 'กรุณาเลือกช่องนี้') : '';
  if (x.closest('.s-hp')) return '';
  const v = (x.value || '').trim(), name = fieldName(x) || 'ช่องนี้';
  const tel = x.type === 'tel' || x.inputMode === 'tel' || /tel/.test(x.id);
  if (x.required && !v) return tel ? 'กรุณากรอกเบอร์โทร' : `กรุณากรอก${name}`;
  if (!v) return '';
  if (tel && !TEL_RE.test(v.replace(/[\s-]/g, ''))) return 'เบอร์โทร 9–10 หลัก ขึ้นต้นด้วย 0 เช่น 081-234-5678';
  if (x.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'รูปแบบอีเมลไม่ถูกต้อง เช่น name@company.com';
  if (x.type === 'number' && x.min !== '' && +v < +x.min) return `${name}ต้องไม่น้อยกว่า ${x.min}`;
  return '';
}
function showError(x, msg) {
  const id = (x.id || ('f' + Math.random().toString(36).slice(2, 8))) + '-err'; if (!x.id) x.id = id.slice(0, -4);
  let el = document.getElementById(id);
  if (!msg) { x.removeAttribute('aria-invalid'); if (el) el.remove(); const d = (x.getAttribute('aria-describedby') || '').split(' ').filter(t => t && t !== id); d.length ? x.setAttribute('aria-describedby', d.join(' ')) : x.removeAttribute('aria-describedby'); return; }
  if (!el) { el = h('span', { class: 's-err', id }); x.after(el); }   // inside the field's label: never a new grid cell
  el.textContent = msg; x.setAttribute('aria-invalid', 'true');
  const d = new Set((x.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)); d.add(id); x.setAttribute('aria-describedby', [...d].join(' '));
}
export function guardForm(form) {
  if (!form || form.dataset.guard) return form;
  form.dataset.guard = '1'; form.noValidate = true;
  const fields = () => [...form.querySelectorAll('input,select,textarea')].filter(x => x.type !== 'hidden' && !x.disabled);
  form.addEventListener('submit', e => {
    const bad = fields().map(x => [x, fieldError(x)]).filter(([, m]) => m);
    fields().forEach(x => showError(x, ''));
    if (!bad.length) return;
    e.preventDefault(); e.stopImmediatePropagation();
    bad.forEach(([x, m]) => showError(x, m));
    bad[0][0].focus();
  }, true);
  form.addEventListener('input', e => { const x = e.target; if (x.getAttribute('aria-invalid') === 'true') showError(x, fieldError(x)); });
  form.addEventListener('focusout', e => { const x = e.target; if (x.matches && x.matches('input,select,textarea') && (x.value || '').trim()) showError(x, fieldError(x)); });
  return form;
}
