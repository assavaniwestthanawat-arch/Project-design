// SBP AirCare — beta feedback (r13: moved out of site.js so every edition has it — A/B/C/A3–C3 through site.js, D and the
// v2 editions through mountBeta()). The form becomes a ticket (kind 'feedback') like every other request, or an honest
// hand-off summary when the back office cannot be reached (contact.js submitTicket).
// openFeedback({variant, pages, seen}) · trapFocus(box) · mountBeta({variant, pages, hubLabel})
// Rev.10 UX: consent when a name / phone is given · focus after sending · live-mode wording · read-only test viewers told up front ·
// legal link labels equal the page titles.
import { h, $, $$ } from './sbp-core.js';
import { submitTicket, honeypot, consentBox, guardForm, clearFieldError } from './contact.js';
import { sourceTag, connected, testSite, viewerReadOnly } from './ticket.js';

export function trapFocus(box) {
  box.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...box.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
}
export function openFeedback({ variant = 'A', pages = [], seen = [], note = '' } = {}) {   // r15 note: text put in "ควรปรับ" (the test panel's results)
  const prev = document.activeElement, live = document.documentElement.hasAttribute('data-sbp-live');   // Rev.10 SITE_MODE=live
  const close = () => { dlg.remove(); removeEventListener('keydown', esc); prev && prev.focus && prev.focus(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const radios = (name, opts) => h('div', { class: 'sx-rad', role: 'radiogroup' }, opts.map(o => h('label', {}, h('input', { type: 'radio', name, value: o }), h('span', {}, o))));
  // Rev.10 UX: a name or phone is personal data — once something is typed in "ชื่อ / เบอร์" the consent line appears and is required
  // (server/tickets.mjs refuses feedback that carries a phone without it); anonymous feedback stays consent-free (§6.6 #23)
  const whoIn = h('input', { name: 'sx-who', autocomplete: 'name' });
  const cb = consentBox('sx-consent'), cbIn = cb.querySelector('input'), cbWrap = h('div', { class: 'sx-fbc' }, cb);   // .s-consent is display:flex: hide its wrapper
  const showCb = () => { const on = !!whoIn.value.trim(); cbWrap.hidden = !on; cbIn.disabled = !on; if (!on) { cbIn.checked = false; clearFieldError(cbIn); } };
  whoIn.addEventListener('input', showCb); showCb();
  const f = h('form', { class: 'sx-fbf' },
    h('fieldset', {}, h('legend', {}, 'โดยรวมใช้งานง่ายแค่ไหน'), radios('sx-ease', ['1 ยากมาก', '2', '3', '4', '5 ง่ายมาก'])),
    h('fieldset', {}, h('legend', {}, 'หาสิ่งที่ต้องการเจอไหม'), radios('sx-find', ['เจอทันที', 'เจอแต่ใช้เวลา', 'หาไม่เจอ'])),
    h('label', { class: 's-field' }, 'ส่วนที่ชอบหรือมีประโยชน์ที่สุด', h('select', { name: 'sx-best' }, h('option', { value: '' }, 'เลือก'), pages.map(t => h('option', {}, t)))),
    h('label', { class: 's-field' }, 'อะไรที่สับสน หรืออยากให้ปรับ', h('textarea', { name: 'sx-fix', rows: note ? 8 : 3 }, note)),
    h('label', { class: 's-field' }, 'ชื่อ / เบอร์ (ถ้าต้องการให้ทีมติดต่อกลับ)', whoIn), cbWrap,
    // the button says what it does: connected → it sends; otherwise it only builds the summary to hand over (Rev.10 UX)
    h('div', { class: 'sx-dlg-a' }, h('button', { type: 'submit', class: 's-btn primary' }, connected() ? 'ส่งความเห็น' : 'สร้างสรุปความเห็น'), h('button', { type: 'button', class: 's-btn ghost', onclick: close }, 'ปิด')));
  // live: a public site — no prototype or design-choice wording
  const body = h('div', { class: 'sx-dlg-b' }, h('h2', { id: 'sx-fb-h' }, live ? 'ความเห็นต่อเว็บไซต์' : `ช่วยเราปรับเว็บไซต์ · แบบ ${variant}`),
    h('p', {}, live ? 'ใช้เวลาไม่ถึง 1 นาที ช่วยให้เราปรับเว็บไซต์ให้ใช้ง่ายขึ้น' : 'ใช้เวลาไม่ถึง 1 นาที ความเห็นของคุณใช้ตัดสินใจเลือกแบบเว็บไซต์จริง'), f);
  const dlg = h('div', { class: 'sx-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sx-fb-h' }, body);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  f.append(honeypot());
  guardForm(f);   // Thai message next to the consent box when it is shown and not ticked
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(f), g = k => (fd.get(k) || '').toString().trim();
    const head = live ? 'ความเห็นต่อเว็บไซต์ SBP AirCare' : `ความเห็นทดลองใช้เว็บไซต์ SBP AirCare · แบบ ${variant}`;
    const text = [head, `ใช้งานง่าย: ${g('sx-ease') || '-'}`, `หาสิ่งที่ต้องการ: ${g('sx-find') || '-'}`, `ส่วนที่ชอบที่สุด: ${g('sx-best') || '-'}`, `ควรปรับ: ${g('sx-fix') || '-'}`, `หน้าที่เปิดดู: ${seen.join(', ') || '-'}`, g('sx-who') ? `ผู้ให้ความเห็น: ${g('sx-who')}` : null].filter(Boolean).join('\n');
    // r10: feedback is a ticket too (anonymous allowed); a phone number typed in "ชื่อ / เบอร์" lets the team call back
    const who = g('sx-who'), telm = who.replace(/[\s-]/g, '').match(/0\d{8,9}/);
    const out = h('div');
    const r = await submitTicket({ kind: 'feedback', customer: { name: who.replace(/[0-9\s-]{9,}/, '').trim(), tel: telm ? telm[0] : '' }, details: text, website: g('website'), source: sourceTag(variant), ...(who ? { consent: cbIn.checked } : {}) },
      { out, form: f, label: 'ความเห็น', fallback: { title: 'สรุปความเห็นของคุณ', text, subject: live ? 'ความเห็นต่อเว็บไซต์ SBP AirCare' : `ความเห็นทดลองใช้เว็บไซต์ แบบ ${variant}` } });
    // a field to fix or a failure worth retrying keeps the form ("ลองส่งอีกครั้ง" re-submits it with the same request id)
    if (!r.ok && !['not_connected', 'read_only', 'rejected'].includes(r.code)) { f.querySelector('.s-tkerr')?.remove(); out.classList.add('s-tkerr'); f.append(out); return; }
    // Rev.10 UX: the dialog's content is replaced — focus goes to the new heading, never to <body>
    const done = h('h2', { id: 'sx-fb-h', tabindex: '-1' }, r.ok ? 'ขอบคุณสำหรับความเห็น' : 'ความเห็นของคุณ');
    body.replaceChildren(done, out, h('div', { class: 'sx-dlg-a' }, h('button', { type: 'button', class: 's-btn ghost', onclick: close }, 'ปิด')));
    done.focus();
  });
  trapFocus(dlg); document.body.append(dlg); addEventListener('keydown', esc);
  requestAnimationFrame(() => { const x = dlg.querySelector('input,select,textarea,button'); x && x.focus(); });
}

// r15: the owner's smoothness test panel (perfhud.js — loaded only when asked); #perftest at the end of a link opens it at once
export function perfButton(variant) {
  const open = () => import('./perfhud.js').then(m => m.openPerfHud({ variant }));
  if (/^#perftest$/i.test(location.hash)) setTimeout(open, 1500);
  return h('button', { type: 'button', class: 'sx-fbb sx-perfb', onclick: open }, 'ทดสอบความลื่น');
}

// Rev.10: privacy notice, terms, cancellation/refund policy — served only by the production server (server/static.mjs LEGAL),
// so the links appear only there (Artifact / offline builds and the test site have no such pages)
// Rev.10 test site on Claude: say so in the Beta bar, and the way into the test back office (#backoffice — test accounts).
// Rev.10 UX: a viewer who may only look is told before filling a form (the store answers read_only to every action)
export const testNote = () => {
  if (!testSite()) return [];
  const ro = h('span', { class: 'sx-ro' });
  viewerReadOnly().then(x => { if (x) ro.textContent = ' · ดูได้อย่างเดียว ขอสิทธิ์ผู้ทดสอบจากเจ้าของเพื่อทดลองส่ง'; });
  return [' · ', h('b', {}, 'เว็บทดสอบ'), ' ใส่ข้อมูลสมมติเท่านั้น', ro, ' · ', h('a', { href: '#backoffice' }, 'หลังบ้าน (ทดสอบ)')];
};
// Rev.10 UX: one name per document everywhere — each link says exactly the page's own title (h1)
export const LEGAL_TH = { privacy: 'ประกาศความเป็นส่วนตัว', terms: 'ข้อกำหนดการใช้บริการ', refund: 'การชำระเงิน การยกเลิก และการคืนเงิน' };
export const legalLinks = () => (connected() && !testSite() ? Object.entries(LEGAL_TH).map(([k, t]) => h('a', { href: `./${k}.html` }, t)) : []);
// the beta notice for pages without site.js (แบบ D, รุ่นที่ 2): a thin bar above the page header — inside the header when the
// header is fixed — with the feedback button and the way back to the hub; plus every [data-feedback] button in the page
export function mountBeta({ variant = 'D', pages = null, hubLabel = 'หน้ารวมทุกแบบ' } = {}) {
  // the parts of the page a tester can name as the most useful: its chapter headings unless given
  const list = () => pages || [...new Set($$('main section h2').map(x => x.textContent.trim()).filter(Boolean))].slice(0, 14);
  const fb = () => openFeedback({ variant, pages: list(), seen: [] });
  $$('[data-feedback]').forEach(b => b.addEventListener('click', fb));
  const hub = globalThis.SBP_HUB ?? './';
  const hd = $('header'), inHd = !!hd && getComputedStyle(hd).position === 'fixed';   // a fixed header carries the bar (an aside inside a header is not a landmark of its own)
  const bar = h(inHd ? 'div' : 'aside', { class: 'proto sx-beta sx-beta-x', 'aria-label': inHd ? null : 'สถานะเว็บไซต์ทดลอง' },
    h('b', {}, `ทดลองใช้ (Beta) · แบบ ${variant}`), h('span', { class: 'sx-bt' }, connected() ? ' · ราคาจาก Pricebook 2569' : ' · ราคาจาก Pricebook 2569 · ช่วงทดลองระบบยังไม่ส่งคำขอถึงทีมอัตโนมัติ'), ...testNote(), ' ',
    h('button', { type: 'button', class: 'sx-fbb', onclick: fb }, 'ให้ความเห็น'), ' ', perfButton(variant),
    hub ? [' ', h('a', { href: hub, target: /^https?:/.test(hub) ? '_blank' : null, rel: /^https?:/.test(hub) ? 'noopener' : null }, hubLabel)] : null);
  if (inHd) hd.prepend(bar); else if (hd) hd.before(bar); else document.body.prepend(bar);
  // Rev.10: pages with their own footer (D, รุ่นที่ 2) get the legal links too when served by the production server
  const foot = $('footer'), links = legalLinks();
  if (foot && links.length && !foot.querySelector('.sx-legal')) foot.append(h('nav', { class: 'sx-legal', 'aria-label': 'ประกาศและข้อกำหนด' }, ...links.flatMap((a, i) => (i ? [' · ', a] : [a]))));
  return { open: fb };
}
