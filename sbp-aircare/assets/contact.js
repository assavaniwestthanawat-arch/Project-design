// SBP AirCare — contact form topic + message, and askTeam() — Rev.09 · Rev.10 UX (consent sentence = checkbox name, per-kind
// ticket card, retry without duplicates, test-site hand-off without company contacts, 'sbp:sent' event on a stored ticket)
// Every "ติดต่อสอบถาม" button (VRV / VRF, project work, FUJIVA, survey requests) scrolls to #quote with the topic pre-selected.
import { h, CONTACT_TOPICS, COMPANY } from './sbp-core.js';
import { sendTicket, errTh, connected, testSite, STATUSES } from './ticket.js';
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
// PDPA: the consent sentence shown next to every form that sends personal data — DRAFT wording for the owner's counsel to review.
// Rev.10 UX: one purpose (this request, under the privacy notice) instead of a field list that missed fields the forms send.
// server/tickets.mjs and assets/artifact-api.js CONSENT_DEFAULT carry the same sentence (tests/artifact-api.mjs compares them).
const PRIVACY_TH = 'ประกาศความเป็นส่วนตัว';
export const CONSENT_TH = `ยินยอมให้ ${COMPANY.th} ใช้ข้อมูลที่กรอกในแบบฟอร์มนี้เพื่อดำเนินการตามคำขอ ตาม${PRIVACY_TH}`;
// the test site on Claude keeps fictitious data in the page's own test store and never reaches the company (CLAUDE.md §6.6 #23)
export const CONSENT_TEST_TH = 'เว็บทดสอบ: ใช้ชื่อ เบอร์ และที่อยู่สมมติเท่านั้น ข้อมูลเก็บในฐานข้อมูลทดสอบของหน้านี้เท่านั้น ไม่ส่งถึงบริษัท';
export const consentText = () => (testSite() ? CONSENT_TEST_TH : CONSENT_TH);
// Rev.10 UX: the visible sentence IS the checkbox's name (no shorter aria-label — WCAG 2.5.3); on the production site its last
// words link to the privacy notice (privacy.html is served by server/static.mjs; the test site and offline builds have no such page)
export const consentBox = id => {
  const t = consentText(), link = connected() && !testSite() && t.endsWith(PRIVACY_TH);
  return h('label', { class: 's-consent' }, h('input', { type: 'checkbox', id, required: true }),
    h('span', {}, link ? [t.slice(0, -PRIVACY_TH.length), h('a', { href: './privacy.html', target: '_blank', rel: 'noopener', style: 'white-space:nowrap' }, PRIVACY_TH)] : t));
};
// hidden field people never fill (bots do) — the back office drops tickets that carry it
export const honeypot = () => h('label', { class: 's-hp', 'aria-hidden': 'true' }, 'เว็บไซต์', h('input', { name: 'website', tabindex: '-1', autocomplete: 'off' }));
/**
 * submitTicket(ticket, {out, fallback:{ref, title, text, subject}, label, form, onTrack}) — send to the back office, show the outcome in `out`:
 * stored → the ticket number + what happens next · not connected / blocked / failed → the honest hand-off summary (handoffBox)
 * with the reason. Never says "sent" unless the back office answered ok. Resolves {ok, id?, code?}.
 * Rev.10 UX: success → a card with the next steps of that kind of ticket; it takes focus (the form may fold away next) and
 * document gets 'sbp:sent' {id, kind} (site.js marks the guided journey's send step done only then) · a field the customer can
 * fix → one sentence · anything else → the hand-off with a "ลองส่งอีกครั้ง" button (same request id → never a duplicate) ·
 * read-only / not connected never say "try again" · the test site never shows the company's contacts for test data.
 */
const FIXABLE = ['bad_tel', 'bad_name', 'no_consent', 'bad_date', 'bad_email'];
const NO_RETRY = [...FIXABLE, 'read_only', 'not_connected', 'rejected', 'quota_exceeded'];
// after the hand-off summary is e-mailed or read out on the phone, the team calls back (never a promised time — §6.6 #23)
const AFTER_TH = { booking: ' ทีมจะติดต่อกลับเพื่อยืนยันรายละเอียดและนัดวัน', quote: ' ทีมจะติดต่อกลับเพื่อยืนยันรายละเอียดและราคา', inquiry: ' ทีมจะติดต่อกลับ', feedback: '' };
export async function submitTicket(ticket, { out, fallback, label = 'คำขอ', onTrack = null, form = null }) {
  const btn = form && form.querySelector('button[type=submit],button:not([type])');
  if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = 'กำลังส่ง…'; }
  // Rev.10: one request id per form fill — a retry after a timeout returns the ticket the server already stored instead
  // of a duplicate; the consent sentence the customer ticked is stored with the ticket (PDPA)
  const holder = form || out;
  if (!holder.dataset.rid) holder.dataset.rid = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  ticket = { ...ticket, rid: holder.dataset.rid, ...(ticket.consent === true ? { consentText: consentText() } : {}) };
  try {
    const r = await sendTicket(ticket);
    delete holder.dataset.rid;
    const card = ticketCard({ id: r.id, statusTh: r.statusTh || STATUSES.new, label, onTrack, tel: ticket.customer && ticket.customer.tel, kind: ticket.kind });
    out.replaceChildren(card); out.hidden = false;
    card.querySelector('.s-tk-b').focus();
    document.dispatchEvent(new CustomEvent('sbp:sent', { detail: { id: r.id, kind: ticket.kind } }));
    return { ok: true, id: r.id };
  } catch (e) {
    const code = e && typeof e.code === 'string' ? e.code : '';
    if (code) console.warn('[ticket] not stored:', code);   // the code is for the team; the page shows the Thai sentence
    const why = errTh(e, 'send');
    const retry = form && !NO_RETRY.includes(code) ? h('button', { type: 'button', class: 's-btn primary', onclick: () => form.requestSubmit() }, 'ลองส่งอีกครั้ง') : null;
    const after = AFTER_TH[ticket.kind] ?? AFTER_TH.booking;
    if (FIXABLE.includes(code) || code === 'rate_limited') out.replaceChildren(h('p', { class: 's-note bad', role: 'alert' }, why), ...(retry ? [retry] : []));
    else out.replaceChildren(handoffBox({ ...fallback, retry,
      note: testSite() ? (code === 'not_connected' ? 'หน้านี้บันทึกคำขอทดสอบได้เมื่อเปิดผ่านลิงก์ของ Claude ด้วยบัญชีผู้ทดสอบ ข้อมูลที่กรอกยังไม่ถูกบันทึก' : why.replace(/^เว็บทดสอบ: /, ''))
        : connected() ? `${why} หรือส่งสรุปนี้ให้เราทางอีเมล หรือโทรแจ้งเลขอ้างอิง${after}`
        : `ระบบช่วงทดลองยังส่งข้อมูลจากหน้านี้ถึงทีมโดยตรงไม่ได้ กรุณาส่งสรุปนี้ให้เราทางอีเมล หรือโทรแจ้งเลขอ้างอิง${after}` }));
    out.hidden = false;
    return { ok: false, code };
  } finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t || btn.textContent; } }
}
// Rev.10 UX: what happens next depends on the kind — a booking is confirmed by phone, a quote is priced, a call-back request is
// called back, feedback is only read (and anonymous feedback has no phone, so it cannot be tracked). Never a time (§6.6 #23).
const NEXT_TH = {
  booking: ['ทีมตรวจรายละเอียดและโทรยืนยันวัน เวลา และราคา', 'รายการที่ต้องประเมินหน้างาน ทีมแจ้งราคาให้ยืนยันก่อนเริ่มงาน'],
  quote: ['ทีมตรวจรายการและโทรยืนยันราคาก่อนออกใบเสนอราคาอย่างเป็นทางการ', 'รายการที่ต้องประเมินหน้างาน ทีมแจ้งราคาให้ยืนยันก่อนเริ่มงาน'],
  inquiry: ['ทีมจะโทรกลับตามเบอร์ที่ให้ไว้'],
};
export function ticketCard({ id, statusTh, label = 'คำขอ', onTrack = null, tel = '', kind = 'booking' }) {
  const msg = h('span', { class: 's-tk-m', 'aria-live': 'polite' }), fb = kind === 'feedback', test = testSite();
  const track = !fb || tel ? 'ตรวจสถานะได้ทุกเวลาด้วยเลขที่คำขอ + เบอร์โทร' : '';
  // the test site: test data only — nobody calls back, the tester looks it up in the test back office
  const next = fb ? [] : test ? ['ข้อมูลทดสอบ ไม่มีทีมติดต่อกลับ ดูคำขอนี้ได้ในหลังบ้านทดสอบ'] : NEXT_TH[kind] || NEXT_TH.booking;
  return h('div', { class: 's-tk', role: 'status' },
    h('p', { class: 's-tk-b', tabindex: '-1' }, fb ? (test ? 'บันทึกความเห็นในระบบทดสอบแล้ว' : 'ได้รับความเห็นแล้ว') : test ? `บันทึก${label}ในระบบทดสอบแล้ว` : `ส่ง${label}เข้าระบบของบริษัทแล้ว`),
    h('p', { class: 's-tk-id' }, h('small', {}, 'เลขที่คำขอ'), h('b', {}, id),
      h('button', { type: 'button', class: 's-hand-x', onclick: async () => { msg.textContent = (await copyText(id)) ? 'คัดลอกแล้ว' : 'เลือกเลขแล้วคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก'), msg),
    fb ? null : h('p', {}, `สถานะ: ${statusTh}`),
    next.length ? h('ol', { class: 's-tk-next' }, [...next, track].filter(Boolean).map(t => h('li', {}, t))) : track ? h('p', {}, track) : null,
    onTrack ? h('button', { type: 'button', class: 's-btn ghost', onclick: () => onTrack(id, tel) }, 'ตรวจสถานะคำขอนี้') : null,
    test || !track ? null : h('p', { class: 's-note' }, 'เก็บเลขที่คำขอไว้อ้างอิงเมื่อติดต่อทีม · โทร ', h('a', { href: COMPANY.telHref }, COMPANY.tel)));
}
// Rev.09 r10: open the booking section (booking.js listens for 'sbp:book'); pages without it fall back to the contact form
export function requestBooking(preset = {}, topic = 'อื่น ๆ') {
  const ev = new CustomEvent('sbp:book', { detail: preset, cancelable: true });
  if (document.dispatchEvent(ev)) askTeam(topic, preset.notes || '');   // nobody handled it
}
export function askTeam(topic, message = '') {
  const form = document.getElementById('qform'); if (!form) return;
  if (form.hidden) form.dispatchEvent(new CustomEvent('sbp:reopen'));   // folded after a sent request (site.js): a clean form again
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
// Rev.10 UX: `retry` (a button) sits right under the reason · on the test site the summary stays copyable (a tester pastes it into
// the test forms) but there is no company e-mail, mail link or phone: test data never goes to the company (CLAUDE.md §6.6 #23)
export function handoffBox({ ref, title = 'สรุปคำขอของคุณ', text, subject = 'คำขอจากเว็บไซต์ SBP AirCare', note = connected() ? 'ส่งสรุปนี้ให้เราทางอีเมล หรือโทรแจ้งเลขอ้างอิง ทีมจะติดต่อกลับเพื่อยืนยันราคาและนัดวัน' : 'ระบบช่วงทดลองยังไม่ส่งข้อมูลถึงทีมอัตโนมัติ กรุณาส่งสรุปนี้ให้เราทางอีเมล หรือโทรแจ้งเลขอ้างอิง ทีมจะติดต่อกลับเพื่อยืนยันราคาและนัดวัน', retry = null }) {
  const test = testSite();
  const ta = h('textarea', { class: 's-hand-t', readonly: true, rows: Math.min(10, text.split('\n').length + 1), 'aria-label': 'สรุปคำขอสำหรับคัดลอก' }, text);
  const msg = h('p', { class: 's-hand-m', 'aria-live': 'polite' });
  const copyBtn = h('button', { type: 'button', class: 's-btn ' + (retry ? 'ghost' : 'primary'), onclick: async () => { msg.textContent = (await copyText(text, ta)) ? 'คัดลอกแล้ว วางในอีเมลหรือแชตได้เลย' : 'คัดลอกอัตโนมัติไม่ได้ ข้อความถูกเลือกไว้แล้ว กดคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอกสรุป');
  const mail = h('a', { class: 's-btn ghost', href: `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject + (ref ? ' · ' + ref : ''))}&body=${encodeURIComponent(text)}` }, 'เปิดอีเมลพร้อมข้อความ');
  const em = h('span', { class: 's-hand-sel' }, COMPANY.email);
  return h('div', { class: 's-hand', role: 'status' },
    test ? h('p', { class: 's-hand-b' }, 'เว็บทดสอบ') : connected() ? null : h('p', { class: 's-hand-b' }, 'ช่วงทดลองใช้ (Beta)'),
    h('h3', {}, title, ref ? h('small', {}, ` · เลขอ้างอิง ${ref}`) : null),
    h('p', {}, note), retry ? h('div', { class: 's-hand-act' }, retry) : null,
    ta, h('div', { class: 's-hand-act' }, copyBtn, test ? null : mail), msg,
    test ? null : h('dl', { class: 's-hand-c' }, h('dt', {}, 'อีเมล'), h('dd', {}, em, h('button', { type: 'button', class: 's-hand-x', onclick: async () => { msg.textContent = (await copyText(COMPANY.email)) ? 'คัดลอกอีเมลแล้ว' : 'เลือกอีเมลแล้วคัดลอกจากเครื่องของคุณ'; } }, 'คัดลอก')),
      h('dt', {}, 'โทร'), h('dd', {}, h('a', { href: COMPANY.telHref }, COMPANY.tel))));
}

/**
 * Rev.09 r6 — field-level validation in Thai, shown next to the field (not the browser's bubble, which is English on many
 * phones and disappears). Runs before the form's own submit handlers; invalid → stops the submit and focuses the first field.
 */
const TEL_RE = /^0[0-9]{8,9}$/;
const fieldName = x => { const l = x.closest('label'); return (l ? [...l.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim() : x.getAttribute('aria-label') || '').replace(/\s*\(.*\)$/, ''); };
function fieldError(x) {
  if (x.type === 'checkbox') return x.required && !x.checked ? (x.closest('.s-consent') ? 'กรุณาติ๊กยืนยันการใช้ข้อมูลก่อนส่ง' : 'กรุณาเลือกช่องนี้') : '';
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
  // inside the field's label (never a new grid cell) — except a checkbox: its error follows the whole label (a full grid row), so it
  // never splits the box from its sentence and never reads as part of the sentence (Rev.10 UX)
  const box = x.type === 'checkbox' && x.closest('label');
  if (!el) { el = h('span', { class: 's-err', id, style: box ? 'grid-column:1/-1' : null }); (box || x).after(el); }
  el.textContent = msg; x.setAttribute('aria-invalid', 'true');
  const d = new Set((x.getAttribute('aria-describedby') || '').split(' ').filter(Boolean)); d.add(id); x.setAttribute('aria-describedby', [...d].join(' '));
}
// a field that is hidden again (feedback consent once the name is cleared) drops its message
export const clearFieldError = x => showError(x, '');
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
