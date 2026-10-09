// SBP AirCare — staff board for the ticket back office (Rev.09 r10). Page: backoffice.html (internal — never published to customers).
// Reads / updates tickets through the same Apps Script endpoint as the website (ticket.js staffApi) with the STAFF_TOKEN.
// The Google Sheet stays the record; this board is the day-to-day view: what is new, what is booked when, which team goes,
// and what to tell the customer. The token lives in sessionStorage only (closes with the tab) and is never put in a URL.
import { h, $, $$, COMPANY, TYPE_BY_ID, logoSrc } from './sbp-core.js';
import { staffApi, endpoint, useEndpoint, errTh, KINDS, SERVICES, STATUSES, SLOTS } from './ticket.js';
import { copyText } from './contact.js';
import { icon } from './icons.js';

const SK = 'sbp-staff-v1';
const ss = { get() { try { return JSON.parse(sessionStorage.getItem(SK) || 'null'); } catch (e) { return null; } }, set(v) { try { v ? sessionStorage.setItem(SK, JSON.stringify(v)) : sessionStorage.removeItem(SK); } catch (e) {} } };
const ACTIVE = ['new', 'need_info', 'confirmed', 'assigned', 'in_progress'];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const thDay = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const telFmt = t => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : d; };
const units = u => { try { const o = typeof u === 'string' && u ? JSON.parse(u) : (u || {}); return Object.entries(o).map(([k, n]) => `${(TYPE_BY_ID[k] || { th: k }).th} ${n}`).join(' · '); } catch (e) { return String(u || ''); } };
const when = t => t.schedDate ? { d: t.schedDate, s: t.schedSlot, fixed: true } : t.prefDate ? { d: t.prefDate, s: t.slot, fixed: false } : null;

export function mountBoard(root) {
  let session = ss.get(), api = session ? staffApi(session.token) : null, data = null, sel = null, timer = null;
  if (session && session.url) useEndpoint(session.url);
  const filt = { status: 'active', kind: '', q: '', day: '' };
  const head = h('header', { class: 'bo-head' }, h('img', { src: logoSrc('sbp'), alt: '', width: 44, height: 32 }), h('div', {}, h('b', {}, 'หลังบ้าน SBP AirCare'), h('small', {}, 'คิวและคำขอจากเว็บไซต์')), h('div', { class: 'bo-who' }));
  const main = h('main', { class: 'bo-main' });
  root.append(head, main);
  function who() {
    const w = $('.bo-who', head); w.replaceChildren();
    if (!session) return;
    w.append(h('span', {}, session.name || 'เจ้าหน้าที่'), h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => load(true) }, 'รีเฟรช'), h('button', { type: 'button', class: 'bo-btn ghost', onclick: logout }, 'ออกจากระบบ'));
  }
  function logout() { session = null; api = null; ss.set(null); clearInterval(timer); data = null; sel = null; who(); login(); }
  function login(msg = '') {
    const tok = h('input', { id: 'bo-tok', type: 'password', required: true, autocomplete: 'current-password' });
    const nm = h('input', { id: 'bo-nm', required: true, autocomplete: 'name', placeholder: 'ชื่อที่บันทึกในประวัติการแก้ไข' });
    const err = h('p', { class: 'bo-err', role: 'alert' }, msg);
    const fixed = !!endpoint();
    const url = h('input', { id: 'bo-url', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off' });
    const f = h('form', { class: 'bo-login' }, h('h1', {}, 'เข้าสู่ระบบหลังบ้าน'),
      h('p', { class: 'bo-note' }, fixed ? 'เชื่อมกับระบบหลังบ้านแล้ว ใส่รหัสเจ้าหน้าที่ (STAFF_TOKEN ใน Script properties)' : 'ใส่ที่อยู่ระบบหลังบ้าน (Web app URL ที่ลงท้าย /exec) และรหัสเจ้าหน้าที่ — ดู backoffice/README.md'),
      fixed ? null : h('label', {}, 'ที่อยู่ระบบหลังบ้าน', url),
      h('label', {}, 'ชื่อเจ้าหน้าที่', nm), h('label', {}, 'รหัสเจ้าหน้าที่', tok), err, h('button', { class: 'bo-btn primary', type: 'submit' }, 'เข้าสู่ระบบ'));
    f.addEventListener('submit', async e => {
      e.preventDefault(); if (!tok.value || !nm.value.trim()) { err.textContent = 'กรอกชื่อและรหัสเจ้าหน้าที่'; return; }
      if (!fixed && !useEndpoint(url.value.trim())) { err.textContent = 'ที่อยู่ระบบหลังบ้านต้องขึ้นต้นด้วย https://'; return; }
      api = staffApi(tok.value); err.textContent = 'กำลังตรวจ…';
      try { data = await api.list(); session = { token: tok.value, name: nm.value.trim(), url: fixed ? null : url.value.trim() }; ss.set(session); who(); board(); start(); }
      catch (x) { api = null; err.textContent = errTh(x); }
    });
    main.replaceChildren(f); setTimeout(() => nm.focus(), 0);
  }
  function start() { clearInterval(timer); timer = setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('.bo-detail form:focus-within')) load(); }, 60000); }
  async function load(manual = false) {
    try { data = await api.list(); board(); if (manual) flash('อัปเดตแล้ว'); }
    catch (x) { if (x && x.code === 'unauthorized') { logout(); login(errTh(x)); } else flash(errTh(x), true); }
  }
  const toast = h('p', { class: 'bo-toast', role: 'status', hidden: true });
  document.body.append(toast);
  function flash(t, bad) { toast.textContent = t; toast.classList.toggle('bad', !!bad); toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => toast.hidden = true, 2600); }

  function board() {
    const T = data.tickets, today = iso(new Date());
    const act = T.filter(t => ACTIVE.includes(t.status));
    const kpi = [
      ['ใหม่ รอยืนยัน', T.filter(t => t.status === 'new').length, 'new'],
      ['รอข้อมูลลูกค้า', T.filter(t => t.status === 'need_info').length, 'need_info'],
      ['นัดแล้ว (ยืนยัน / จัดทีม)', T.filter(t => ['confirmed', 'assigned'].includes(t.status)).length, 'booked'],
      ['งานวันนี้', act.filter(t => (when(t) || {}).d === today).length, 'today'],
    ];
    const tiles = h('div', { class: 'bo-kpi' }, kpi.map(([th, n, k]) => h('button', { type: 'button', class: 'bo-tile', 'aria-pressed': filt.status === k || (k === 'today' && filt.day === today), onclick: () => { if (k === 'today') { filt.day = today; filt.status = 'active'; } else { filt.status = k; filt.day = ''; } board(); } }, h('b', {}, String(n)), h('span', {}, th))));
    // 14-day load: bookings per half-day vs capacity (scheduled date first, else the customer's preferred date)
    const cap = data.capacity || 2, days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return iso(d); });
    const busy = {}; act.forEach(t => { const w = when(t); if (!w || t.kind !== 'booking') return; const k = w.d + '|' + (w.s || 'AM'); (busy[k] = busy[k] || []).push(t); });
    const grid = h('div', { class: 'bo-cap', role: 'table', 'aria-label': `คิว 14 วัน (รับได้ ${cap} งานต่อช่วง)` },
      h('div', { role: 'row', class: 'bo-cap-r hd' }, h('span', { role: 'columnheader' }, 'วัน'), ...Object.values(SLOTS).map(s => h('span', { role: 'columnheader' }, s))),
      days.map(d => h('div', { role: 'row', class: 'bo-cap-r' + (filt.day === d ? ' on' : '') },
        h('button', { type: 'button', role: 'rowheader', onclick: () => { filt.day = filt.day === d ? '' : d; board(); } }, thDay(d)),
        ...Object.keys(SLOTS).map(s => { const n = (busy[d + '|' + s] || []).length; return h('span', { role: 'cell', class: n >= cap && s !== 'EVE' ? 'full' : n ? 'some' : '' }, n ? `${n}${s !== 'EVE' ? '/' + cap : ''}` : '–'); }))));
    // list
    const q = filt.q.trim().toLowerCase();
    const rows = T.filter(t => (filt.status === 'active' ? ACTIVE.includes(t.status) : filt.status === 'all' ? true : filt.status === 'booked' ? ['confirmed', 'assigned'].includes(t.status) : t.status === filt.status)
      && (!filt.kind || t.kind === filt.kind) && (!filt.day || (when(t) || {}).d === filt.day)
      && (!q || [t.id, t.name, t.tel, t.company, t.area, t.address].join(' ').toLowerCase().includes(q)));
    const statusSel = h('select', { 'aria-label': 'สถานะ', onchange: e => { filt.status = e.target.value; board(); } }, [['active', 'ยังไม่ปิด'], ['all', 'ทั้งหมด'], ['booked', 'นัดแล้ว'], ...Object.entries(STATUSES)].map(([k, t]) => h('option', { value: k, selected: k === filt.status }, t)));
    const kindSel = h('select', { 'aria-label': 'ประเภทคำขอ', onchange: e => { filt.kind = e.target.value; board(); } }, [['', 'ทุกประเภท'], ...Object.entries(KINDS)].map(([k, t]) => h('option', { value: k, selected: k === filt.kind }, t)));
    const search = h('input', { type: 'search', placeholder: 'ค้นหา เลขที่ ชื่อ เบอร์ พื้นที่', value: filt.q, 'aria-label': 'ค้นหาคำขอ', oninput: e => { filt.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(() => { board(); const x = $('.bo-tools input[type=search]', main); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); } });
    const table = h('table', { class: 'bo-t' }, h('thead', {}, h('tr', {}, ['เลขที่', 'รับเมื่อ', 'คำขอ', 'ลูกค้า', 'พื้นที่', 'วันที่', 'สถานะ', 'ทีม'].map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rows.length ? rows.map(t => { const w = when(t); return h('tr', { class: (sel === t.id ? 'on ' : '') + 'st-' + t.status, tabindex: '0', onclick: () => open(t.id), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t.id); } } },
        h('th', { scope: 'row' }, t.id), h('td', {}, String(t.createdAt || '').slice(5, 16)), h('td', {}, KINDS[t.kind] || t.kind, t.service ? h('small', {}, SERVICES[t.service] || t.service) : null),
        h('td', {}, t.name, h('small', { class: 'nw' }, telFmt(t.tel))), h('td', {}, t.area || '—'), h('td', {}, w ? [thDay(w.d), h('small', {}, (SLOTS[w.s] || '') + (w.fixed ? ' · นัดแล้ว' : ' · ลูกค้าขอ'))] : '—'),
        h('td', {}, h('span', { class: 'bo-st st-' + t.status }, STATUSES[t.status] || t.status)), h('td', {}, t.team || '—')); }) : h('tr', {}, h('td', { colspan: 8, class: 'bo-empty' }, 'ไม่มีคำขอตามตัวกรองนี้'))));
    main.replaceChildren(tiles,
      h('div', { class: 'bo-cols' },
        h('section', { class: 'bo-list', 'aria-label': 'รายการคำขอ' }, h('div', { class: 'bo-tools' }, statusSel, kindSel, search, filt.day ? h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => { filt.day = ''; board(); } }, `วันที่ ${thDay(filt.day)} ×`) : null),
          h('div', { class: 'bo-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางคำขอ' }, table), h('p', { class: 'bo-note' }, `${rows.length} จาก ${T.length} คำขอ · อัปเดต ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ข้อมูลทั้งหมดอยู่ในชีต Tickets`)),
        h('aside', { class: 'bo-side' }, h('h2', {}, 'คิว 14 วัน'), h('p', { class: 'bo-note' }, `งานจองคิวต่อช่วง (รับได้ ${cap} งาน) · กดวันเพื่อกรอง`), grid, h('div', { class: 'bo-detail', 'aria-live': 'polite' }))));
    if (sel) open(sel, true);
  }
  function open(id, quiet) {
    sel = id; const t = data.tickets.find(x => x.id === id); const box = $('.bo-detail', main); if (!t || !box) return;
    $$('.bo-t tbody tr', main).forEach(r => r.classList.toggle('on', r.querySelector('th')?.textContent === id));
    const st = h('select', { id: 'bo-st' }, Object.entries(STATUSES).map(([k, v]) => h('option', { value: k, selected: k === t.status }, v)));
    const team = h('select', { id: 'bo-team' }, ['', ...(data.teams || [])].map(k => h('option', { value: k, selected: k === (t.team || '') }, k || '— ยังไม่จัดทีม —')));
    const sd = h('input', { id: 'bo-sd', type: 'date', value: t.schedDate || t.prefDate || '' });
    const sl = h('select', { id: 'bo-sl' }, [['', '—'], ...Object.entries(SLOTS)].map(([k, v]) => h('option', { value: k, selected: k === (t.schedSlot || t.slot || '') }, v)));
    const note = h('textarea', { id: 'bo-note', rows: 3, placeholder: 'บันทึกภายใน (ลูกค้าไม่เห็น)' }, t.staffNote || '');
    const save = h('button', { type: 'submit', class: 'bo-btn primary' }, 'บันทึก');
    const f = h('form', { class: 'bo-edit' }, h('div', { class: 'bo-2' }, h('label', {}, 'สถานะ', st), h('label', {}, 'ทีม', team)), h('div', { class: 'bo-2' }, h('label', {}, 'วันนัด', sd), h('label', {}, 'ช่วงเวลา', sl)), h('label', {}, 'บันทึกภายใน', note), save);
    f.addEventListener('submit', async e => {
      e.preventDefault(); save.disabled = true; save.textContent = 'กำลังบันทึก…';
      try { const r = await api.update(t.id, { status: st.value, team: team.value, schedDate: sd.value, schedSlot: sl.value, staffNote: note.value }, session.name); Object.assign(t, r.ticket); flash(`บันทึก ${t.id} แล้ว`); board(); }
      catch (x) { flash(errTh(x), true); save.disabled = false; save.textContent = 'บันทึก'; }
    });
    let hist = []; try { hist = JSON.parse(t.history || '[]'); } catch (e) {}
    const w = when(t);
    const confirmText = `เรียนคุณ${t.name} ${COMPANY.brand} ยืนยันนัด${SERVICES[t.service] || 'บริการ'}${w ? ` วัน${thDay(w.d)} ${SLOTS[w.s] || ''}` : ''} เลขที่คำขอ ${t.id}${t.team ? ` ทีมผู้รับผิดชอบ: ${t.team}` : ''} ทีมจะโทรก่อนเข้าหน้างาน สอบถาม ${COMPANY.tel}`;
    const dl = (k, v) => v ? [h('dt', {}, k), h('dd', {}, v)] : [];
    box.replaceChildren(h('div', { class: 'bo-card' },
      h('div', { class: 'bo-dh' }, h('h2', {}, t.id), h('span', { class: 'bo-st st-' + t.status }, STATUSES[t.status] || t.status)),
      h('dl', { class: 'bo-dl' },
        ...dl('คำขอ', `${KINDS[t.kind] || t.kind}${t.service ? ' · ' + (SERVICES[t.service] || t.service) : ''}`), ...dl('รับเมื่อ', t.createdAt),
        ...dl('ลูกค้า', `${t.name}${t.company ? ' · ' + t.company : ''}`), ...dl('โทร', h('a', { href: 'tel:' + String(t.tel).replace(/\D/g, '') }, telFmt(t.tel))), ...dl('อีเมล', t.email),
        ...dl('ใบกำกับภาษี', t.taxInvoice ? `${t.taxName || '-'} ${t.taxId || ''}` : ''), ...dl('จำนวนเครื่อง', units(t.units)), ...dl('ทีม-วัน (ประมาณ)', t.teamDays ? String(t.teamDays) : ''),
        ...dl('วันที่ลูกค้าขอ', t.prefDate ? `${thDay(t.prefDate)} ${SLOTS[t.slot] || ''}${t.altDate ? ' · สำรอง ' + thDay(t.altDate) : ''}` : ''),
        ...dl('ที่อยู่', [t.address, t.area].filter(Boolean).join(' · ')), ...dl('พื้นที่', t.zoneTier === 'extended' ? `นอกพื้นที่หลัก · ค่าเดินทาง ${t.travelFee || '-'}` : t.zoneTier === 'out' ? 'เกินระยะรับงานรายเครื่อง' : ''),
        ...dl('อาคาร', [t.building, t.access].filter(Boolean).join(' · ')), ...dl('รายละเอียด', t.details), ...dl('หมายเหตุลูกค้า', t.notes),
        ...dl('ใบเสนอราคาเบื้องต้น', t.quoteLines ? h('pre', {}, t.quoteLines + (t.quoteTotalEx ? `\nรวมก่อน VAT ${(+t.quoteTotalEx).toLocaleString('th-TH')}` : '')) : ''), ...dl('ที่มา', t.source)),
      f,
      h('div', { class: 'bo-act' }, h('button', { type: 'button', class: 'bo-btn ghost', onclick: async () => flash((await copyText(confirmText)) ? 'คัดลอกข้อความยืนยันนัดแล้ว' : 'คัดลอกไม่ได้', false) }, icon('copy', { size: 14 }), ' ข้อความยืนยันนัด (LINE / SMS)')),
      hist.length ? h('details', { class: 'bo-hist' }, h('summary', {}, `ประวัติ ${hist.length} รายการ`), h('ol', {}, hist.slice().reverse().map(x => h('li', {}, `${x.at} · ${x.by}`, h('small', {}, [x.s, x.team != null ? 'ทีม ' + (x.team || '-') : '', x.date != null ? 'วัน ' + (x.date || '-') : '', x.slot != null ? 'ช่วง ' + (SLOTS[x.slot] || '-') : '', x.note ? 'แก้บันทึก' : ''].filter(Boolean).join(' · ')))))) : null));
    if (!quiet) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  who();
  if (session) { load().then(start); main.replaceChildren(h('p', { class: 'bo-note' }, 'กำลังโหลด…')); } else login();
}
