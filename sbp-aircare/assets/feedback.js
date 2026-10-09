// SBP AirCare — beta feedback (r13: moved out of site.js so every edition has it — A/B/C/A3–C3 through site.js, D and the
// v2 editions through mountBeta()). The form becomes a ticket (kind 'feedback') like every other request, or an honest
// hand-off summary when the back office cannot be reached (contact.js submitTicket).
// openFeedback({variant, pages, seen}) · trapFocus(box) · mountBeta({variant, pages, hubLabel})
import { h, $, $$ } from './sbp-core.js';
import { submitTicket, honeypot } from './contact.js';
import { sourceTag } from './ticket.js';

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
  const prev = document.activeElement;
  const close = () => { dlg.remove(); removeEventListener('keydown', esc); prev && prev.focus && prev.focus(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const radios = (name, opts) => h('div', { class: 'sx-rad', role: 'radiogroup' }, opts.map(o => h('label', {}, h('input', { type: 'radio', name, value: o }), h('span', {}, o))));
  const f = h('form', { class: 'sx-fbf' },
    h('fieldset', {}, h('legend', {}, 'โดยรวมใช้งานง่ายแค่ไหน'), radios('sx-ease', ['1 ยากมาก', '2', '3', '4', '5 ง่ายมาก'])),
    h('fieldset', {}, h('legend', {}, 'หาสิ่งที่ต้องการเจอไหม'), radios('sx-find', ['เจอทันที', 'เจอแต่ใช้เวลา', 'หาไม่เจอ'])),
    h('label', { class: 's-field' }, 'ส่วนที่ชอบหรือมีประโยชน์ที่สุด', h('select', { name: 'sx-best' }, h('option', { value: '' }, 'เลือก'), pages.map(t => h('option', {}, t)))),
    h('label', { class: 's-field' }, 'อะไรที่สับสน หรืออยากให้ปรับ', h('textarea', { name: 'sx-fix', rows: note ? 8 : 3 }, note)),
    h('label', { class: 's-field' }, 'ชื่อ / เบอร์ (ถ้าต้องการให้ทีมติดต่อกลับ)', h('input', { name: 'sx-who', autocomplete: 'name' })),
    h('div', { class: 'sx-dlg-a' }, h('button', { type: 'submit', class: 's-btn primary' }, 'สร้างสรุปความเห็น'), h('button', { type: 'button', class: 's-btn ghost', onclick: close }, 'ปิด')));
  const body = h('div', { class: 'sx-dlg-b' }, h('h2', { id: 'sx-fb-h' }, `ช่วยเราปรับเว็บไซต์ · แบบ ${variant}`), h('p', {}, 'ใช้เวลาไม่ถึง 1 นาที ความเห็นของคุณใช้ตัดสินใจเลือกแบบเว็บไซต์จริง'), f);
  const dlg = h('div', { class: 'sx-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sx-fb-h' }, body);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  f.append(honeypot());
  f.addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(f), g = k => (fd.get(k) || '').toString().trim();
    const text = [`ความเห็นทดลองใช้เว็บไซต์ SBP AirCare · แบบ ${variant}`, `ใช้งานง่าย: ${g('sx-ease') || '-'}`, `หาสิ่งที่ต้องการ: ${g('sx-find') || '-'}`, `ส่วนที่ชอบที่สุด: ${g('sx-best') || '-'}`, `ควรปรับ: ${g('sx-fix') || '-'}`, `หน้าที่เปิดดู: ${seen.join(', ') || '-'}`, g('sx-who') ? `ผู้ให้ความเห็น: ${g('sx-who')}` : null].filter(Boolean).join('\n');
    // r10: feedback is a ticket too (anonymous allowed); a phone number typed in "ชื่อ / เบอร์" lets the team call back
    const who = g('sx-who'), telm = who.replace(/[\s-]/g, '').match(/0\d{8,9}/);
    const out = h('div');
    const r = await submitTicket({ kind: 'feedback', customer: { name: who.replace(/[0-9\s-]{9,}/, '').trim(), tel: telm ? telm[0] : '' }, details: text, website: g('website'), source: sourceTag(variant) },
      { out, form: f, label: 'ความเห็น', fallback: { title: 'สรุปความเห็นของคุณ', text, subject: `ความเห็นทดลองใช้เว็บไซต์ แบบ ${variant}` } });
    if (!r.ok && ['bad_tel', 'rate_limited'].includes(r.code)) { f.querySelector('.s-tkerr')?.remove(); out.classList.add('s-tkerr'); f.append(out); return; }   // fixable: keep the form
    body.innerHTML = ''; body.append(h('h2', { id: 'sx-fb-h' }, 'ขอบคุณสำหรับความเห็น'), out, h('div', { class: 'sx-dlg-a' }, h('button', { type: 'button', class: 's-btn ghost', onclick: close }, 'ปิด')));
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
    h('b', {}, `ทดลองใช้ (Beta) · แบบ ${variant}`), h('span', { class: 'sx-bt' }, ' · ราคาจาก Pricebook 2569 · ช่วงทดลองระบบยังไม่ส่งคำขอถึงทีมอัตโนมัติ'), ' ',
    h('button', { type: 'button', class: 'sx-fbb', onclick: fb }, 'ให้ความเห็น'), ' ', perfButton(variant),
    hub ? [' ', h('a', { href: hub, target: /^https?:/.test(hub) ? '_blank' : null, rel: /^https?:/.test(hub) ? 'noopener' : null }, hubLabel)] : null);
  if (inHd) hd.prepend(bar); else if (hd) hd.before(bar); else document.body.prepend(bar);
  return { open: fb };
}
