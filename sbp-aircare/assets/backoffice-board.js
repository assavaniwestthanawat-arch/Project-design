// SBP AirCare — staff board for the ticket back office (Rev.10). Page: backoffice.html (internal — never published to customers).
// Rev.09 r10: reads / updates tickets through the same endpoint as the website (ticket.js staffApi). The record stays on the
// server; this board is the day-to-day view: what is new, what is booked when, which team goes, what to tell the customer.
// Rev.10 (production server — server/API.md): per-person staff accounts (ชื่อผู้ใช้ + รหัสผ่าน → a 12-hour session token,
// roles admin / staff / tech) and the money on each ticket: the server's price check, payment requests, payments received
// (a technician's entry and a customer's "I have transferred" wait for the office to verify them), refunds. Every amount and
// status shown is what the server answered — the board never marks money as received by itself (CLAUDE.md §6.6 #23).
// Falls back to the Apps Script back office (one shared STAFF_TOKEN + a typed name, no payments) when the endpoint answers
// unknown_action; the legacy STAFF_TOKEN typed as the password still works on the production server.
// The token lives in sessionStorage only (closes with the tab) and is never put in a URL.
import { h, $, $$, COMPANY, TYPE_BY_ID, logoSrc } from './sbp-core.js';
import { staffApi, staffLogin, endpoint, useEndpoint, errTh, KINDS, SERVICES, STATUSES, SLOTS } from './ticket.js';
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
// Rev.10 money: the server answers in baht (satang kept as 2 decimals)
const r2 = n => Math.round((+n || 0) * 100) / 100;
const thb = n => '฿' + r2(n).toLocaleString('en-US', { minimumFractionDigits: r2(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const cleanAmt = v => String(v == null ? '' : v).replace(/[,\s฿]/g, '');
const amtOk = s => /^\d+(\.\d{1,2})?$/.test(s) && +s >= 1;
const CHECK_TH = { mismatch: 'ราคาต่อหน่วยไม่ตรง', survey_has_price: 'หน้าเว็บมีราคา แต่ในระบบเป็นรายการประเมินหน้างาน', unverified: 'ระบบไม่รู้จักรายการนี้' };
const TOTAL_TH = { totalEx: 'รวมก่อน VAT', vat: 'VAT', total: 'ยอดรวม', travel: 'ค่าเดินทาง', minGap: 'ส่วนเติมยอดขั้นต่ำงานล้าง' };
const REFUND_TH = { transfer: 'โอนคืนเข้าบัญชีลูกค้า', promptpay: 'พร้อมเพย์คืนลูกค้า', cash: 'เงินสด', gateway: 'คืนผ่านผู้ให้บริการชำระออนไลน์', other: 'อื่น ๆ' };   // server refund methods
const priceOf = v => v == null ? 'ประเมินหน้างาน' : thb(v);
const issueTh = (x, lines) => x.total ? `${TOTAL_TH[x.total] || x.total}: หน้าเว็บ ${priceOf(x.client)} · ในระบบ ${priceOf(x.server)}`
  : `รายการ ${x.line + 1} ${(lines[x.line] || {}).name || x.key || ''}: ${CHECK_TH[x.check] || x.check}${x.check === 'unverified' ? ` (หน้าเว็บ ${priceOf(x.client)})` : ` (หน้าเว็บ ${priceOf(x.client)} · ในระบบ ${priceOf(x.server)})`}`;

export function mountBoard(root) {
  let session = ss.get(), api = session ? staffApi(session.token) : null, data = null, sel = null, timer = null;
  if (session && session.url) useEndpoint(session.url);
  const filt = { status: 'active', kind: '', q: '', day: '', pay: '' };
  // payments of the open ticket (paydetail), cached so filtering / the 60 s refresh do not wipe what staff are typing
  const PAY0 = () => ({ id: null, d: null, err: '', stale: true, seq: 0 });
  let pay = PAY0();
  const payOpen = new Set();   // which payment forms are unfolded
  const hasPay = () => !!(session && session.role);   // production server (Apps Script back office has no payments)
  const head = h('header', { class: 'bo-head' }, h('img', { src: logoSrc('sbp'), alt: '', width: 44, height: 32 }), h('div', {}, h('b', {}, 'หลังบ้าน SBP AirCare'), h('small', {}, 'คิวและคำขอจากเว็บไซต์')), h('div', { class: 'bo-who' }));
  const main = h('main', { class: 'bo-main' });
  root.append(head, main);
  function who() {
    const w = $('.bo-who', head); w.replaceChildren();
    if (!session) return;
    const out = h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => { out.disabled = true; logout(); } }, 'ออกจากระบบ');
    w.append(h('span', { class: 'bo-me' }, h('b', {}, session.name || 'เจ้าหน้าที่'), session.roleTh ? h('small', {}, session.roleTh) : null), h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => load(true) }, 'รีเฟรช'), out);
  }
  function endSession(msg = '') { session = null; api = null; ss.set(null); clearInterval(timer); data = null; sel = null; pay = PAY0(); payOpen.clear(); who(); login(msg); }
  async function logout() { const a = api; if (a) { try { await a.logout(); } catch (e) {} } endSession(); }   // the server ends the session; the Apps Script back office has nothing to end
  const expired = () => endSession('หมดเวลาเข้าใช้งานหรือบัญชีถูกปิด กรุณาเข้าสู่ระบบอีกครั้ง');
  function login(msg = '') {
    const tok = h('input', { id: 'bo-tok', type: 'password', required: true, autocomplete: 'current-password' });
    const nm = h('input', { id: 'bo-nm', required: true, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
    const err = h('p', { class: 'bo-err', role: 'alert' }, msg);
    const fixed = !!endpoint();
    const url = h('input', { id: 'bo-url', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off' });
    const go = h('button', { class: 'bo-btn primary', type: 'submit' }, 'เข้าสู่ระบบ');
    const f = h('form', { class: 'bo-login', novalidate: true }, h('h1', {}, 'เข้าสู่ระบบหลังบ้าน'),
      h('p', { class: 'bo-note' }, fixed ? 'ใช้ชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลระบบสร้างให้' : 'ใส่ที่อยู่ระบบหลังบ้าน (Web app URL ที่ลงท้าย /exec) ชื่อผู้ใช้ และรหัสผ่าน — ดู backoffice/README.md'),
      fixed ? null : h('label', {}, 'ที่อยู่ระบบหลังบ้าน', url),
      h('label', {}, 'ชื่อผู้ใช้', nm), h('label', {}, 'รหัสผ่าน', tok),
      h('p', { class: 'bo-note' }, 'ระบบเดิมที่ใช้รหัสเจ้าหน้าที่ร่วมกัน: ใส่ชื่อของคุณในช่องชื่อผู้ใช้ (บันทึกในประวัติการแก้ไข) และรหัสเจ้าหน้าที่ในช่องรหัสผ่าน'), err, go);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const user = nm.value.trim(), pw = tok.value;
      if (!pw || !user) { err.textContent = 'กรอกชื่อผู้ใช้และรหัสผ่าน'; (user ? tok : nm).focus(); return; }
      if (!fixed && !useEndpoint(url.value.trim())) { err.textContent = 'ที่อยู่ระบบหลังบ้านต้องขึ้นต้นด้วย https://'; return; }
      go.disabled = true; err.textContent = 'กำลังตรวจ…';
      let s, old = false;
      try {
        try { const r = await staffLogin(user, pw); s = { token: r.token, name: r.name, role: r.role, roleTh: r.roleTh }; }
        catch (x) {
          // Apps Script back office (no accounts: unknown_action) or the legacy STAFF_TOKEN typed as the password (unauthorized):
          // the password is the token and the typed name goes into the history — list() decides
          if (!x || (x.code !== 'unknown_action' && x.code !== 'unauthorized')) throw x;
          old = x.code === 'unknown_action'; s = { token: pw, name: user, role: '', legacy: true };
        }
        api = staffApi(s.token); data = await api.list();
        if (s.legacy && !old) { const m = await api.me().catch(() => null); if (m) Object.assign(s, { role: m.role, roleTh: m.roleTh }); }
        session = { ...s, url: fixed ? null : url.value.trim() }; ss.set(session); pay = PAY0(); who(); board(); start();
      } catch (x) {
        api = null; data = null; go.disabled = false;
        err.textContent = x && x.code === 'unauthorized' && !old ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : x && x.code === 'rate_limited' ? 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' : errTh(x);
      }
    });
    main.replaceChildren(f); setTimeout(() => nm.focus(), 0);
  }
  // 60 s refresh — skipped while a form in the detail has focus or unsaved typing
  function start() { clearInterval(timer); timer = setInterval(() => { if (api && document.visibilityState === 'visible' && !document.querySelector('.bo-detail form:focus-within, .bo-detail form[data-dirty]')) load(); }, 60000); }
  async function load(manual = false) {
    if (!api) return;
    try { data = await api.list(); pay.stale = true; board(); if (manual) flash('อัปเดตแล้ว'); }
    catch (x) { if (x && x.code === 'unauthorized') expired(); else flash(errTh(x), true); }
  }
  const toast = h('p', { class: 'bo-toast', role: 'status', hidden: true });
  document.body.append(toast);
  function flash(t, bad) { toast.textContent = t; toast.classList.toggle('bad', !!bad); toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => toast.hidden = true, bad ? 6000 : 3500); }
  const dirty = f => { f.addEventListener('input', () => { f.dataset.dirty = '1'; }); return f; };

  function board() {
    const T = data.tickets, today = iso(new Date());
    const act = T.filter(t => ACTIVE.includes(t.status));
    const kpi = [
      ['ใหม่ รอยืนยัน', T.filter(t => t.status === 'new').length, 'new'],
      ['รอข้อมูลลูกค้า', T.filter(t => t.status === 'need_info').length, 'need_info'],
      ['นัดแล้ว (ยืนยัน / จัดทีม)', T.filter(t => ['confirmed', 'assigned'].includes(t.status)).length, 'booked'],
      ['งานวันนี้', act.filter(t => (when(t) || {}).d === today).length, 'today'],
    ];
    // Rev.10: money tiles (production server) — reported transfers / technicians' entries to verify, and what is still owed
    const pk = hasPay() ? [['รอตรวจยอด', String(T.filter(t => t.pay && t.pay.pending > 0).length), 'pending'], ['ยอดค้างชำระ', thb(T.reduce((a, t) => a + (t.pay && t.pay.due > 0 ? +t.pay.due : 0), 0)), 'due']] : [];
    const tiles = h('div', { class: 'bo-kpi' }, kpi.map(([th, n, k]) => h('button', { type: 'button', class: 'bo-tile', 'aria-pressed': !filt.pay && (filt.status === k || (k === 'today' && filt.day === today)), onclick: () => { filt.pay = ''; if (k === 'today') { filt.day = today; filt.status = 'active'; } else { filt.status = k; filt.day = ''; } board(); } }, h('b', {}, String(n)), h('span', {}, th))),
      pk.map(([th, v, k]) => h('button', { type: 'button', class: 'bo-tile' + (k === 'due' ? ' money' : ''), 'aria-pressed': filt.pay === k, onclick: () => { filt.pay = filt.pay === k ? '' : k; filt.status = 'all'; filt.day = ''; board(); } }, h('b', {}, v), h('span', {}, th))));
    // 14-day load: bookings per half-day vs capacity (scheduled date first, else the customer's preferred date)
    const cap = data.capacity || 2, days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return iso(d); });
    const busy = {}; act.forEach(t => { const w = when(t); if (!w || t.kind !== 'booking') return; const k = w.d + '|' + (w.s || 'AM'); (busy[k] = busy[k] || []).push(t); });
    const grid = h('div', { class: 'bo-cap', role: 'table', 'aria-label': `คิว 14 วัน (รับได้ ${cap} งานต่อช่วง)` },
      h('div', { role: 'row', class: 'bo-cap-r hd' }, h('span', { role: 'columnheader' }, 'วัน'), ...Object.values(SLOTS).map(s => h('span', { role: 'columnheader' }, s))),
      days.map(d => h('div', { role: 'row', class: 'bo-cap-r' + (filt.day === d ? ' on' : '') },
        h('span', { role: 'rowheader' }, h('button', { type: 'button', 'aria-pressed': filt.day === d, onclick: () => { filt.day = filt.day === d ? '' : d; board(); } }, thDay(d))),
        ...Object.keys(SLOTS).map(s => { const n = (busy[d + '|' + s] || []).length; return h('span', { role: 'cell', class: n >= cap && s !== 'EVE' ? 'full' : n ? 'some' : '' }, n ? `${n}${s !== 'EVE' ? '/' + cap : ''}` : '–'); }))));
    // list
    const q = filt.q.trim().toLowerCase();
    const rows = T.filter(t => (filt.status === 'active' ? ACTIVE.includes(t.status) : filt.status === 'all' ? true : filt.status === 'booked' ? ['confirmed', 'assigned'].includes(t.status) : t.status === filt.status)
      && (!filt.kind || t.kind === filt.kind) && (!filt.day || (when(t) || {}).d === filt.day)
      && (!filt.pay || (t.pay && (filt.pay === 'pending' ? t.pay.pending > 0 : t.pay.due > 0)))
      && (!q || [t.id, t.name, t.tel, t.company, t.area, t.address].join(' ').toLowerCase().includes(q)));
    const statusSel = h('select', { 'aria-label': 'สถานะ', onchange: e => { filt.status = e.target.value; board(); } }, [['active', 'ยังไม่ปิด'], ['all', 'ทั้งหมด'], ['booked', 'นัดแล้ว'], ...Object.entries(STATUSES)].map(([k, t]) => h('option', { value: k, selected: k === filt.status }, t)));
    const kindSel = h('select', { 'aria-label': 'ประเภทคำขอ', onchange: e => { filt.kind = e.target.value; board(); } }, [['', 'ทุกประเภท'], ...Object.entries(KINDS)].map(([k, t]) => h('option', { value: k, selected: k === filt.kind }, t)));
    const search = h('input', { type: 'search', placeholder: 'ค้นหา เลขที่ ชื่อ เบอร์ พื้นที่', value: filt.q, 'aria-label': 'ค้นหาคำขอ', oninput: e => { filt.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(() => { board(); const x = $('.bo-tools input[type=search]', main); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); } });
    const P = hasPay(), cols = ['เลขที่', 'รับเมื่อ', 'คำขอ', 'ลูกค้า', 'พื้นที่', 'วันที่', 'สถานะ', ...(P ? ['ชำระเงิน'] : []), 'ทีม'];
    const payCell = p => { const x = p ? [p.statusTh ? h('span', { class: 'bo-ps ps-' + p.status }, p.statusTh) : null, p.due > 0 ? h('small', { class: 'nw' }, 'ค้าง ' + thb(p.due)) : null, p.pending > 0 ? h('small', { class: 'bo-pend' }, `รอตรวจยอด ${p.pending}`) : null].filter(Boolean) : []; return x.length ? x : '—'; };
    const table = h('table', { class: 'bo-t' + (P ? ' pay' : '') }, h('thead', {}, h('tr', {}, cols.map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rows.length ? rows.map(t => { const w = when(t); return h('tr', { class: (sel === t.id ? 'on ' : '') + 'st-' + t.status, tabindex: '0', onclick: () => open(t.id), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(t.id); } } },
        h('th', { scope: 'row' }, t.id), h('td', {}, String(t.createdAt || '').slice(5, 16)), h('td', {}, KINDS[t.kind] || t.kind, t.service ? h('small', {}, SERVICES[t.service] || t.service) : null),
        h('td', {}, t.name, h('small', { class: 'nw' }, telFmt(t.tel))), h('td', {}, t.area || '—'), h('td', {}, w ? [thDay(w.d), h('small', {}, (SLOTS[w.s] || '') + (w.fixed ? ' · นัดแล้ว' : ' · ลูกค้าขอ'))] : '—'),
        h('td', {}, h('span', { class: 'bo-st st-' + t.status }, STATUSES[t.status] || t.status)), P ? h('td', { class: 'bo-pc-cell' }, payCell(t.pay)) : null, h('td', {}, t.team || '—')); }) : h('tr', {}, h('td', { colspan: cols.length, class: 'bo-empty' }, 'ไม่มีคำขอตามตัวกรองนี้'))));
    main.replaceChildren(h('h1', { class: 'bo-sr' }, 'คิวและคำขอ'), tiles,
      h('div', { class: 'bo-cols' },
        h('section', { class: 'bo-list', 'aria-label': 'รายการคำขอ' }, h('div', { class: 'bo-tools' }, statusSel, kindSel, search, filt.day ? h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => { filt.day = ''; board(); } }, `วันที่ ${thDay(filt.day)} ×`) : null,
          filt.pay ? h('button', { type: 'button', class: 'bo-btn ghost', 'aria-label': 'ล้างตัวกรองการชำระเงิน', onclick: () => { filt.pay = ''; filt.status = 'active'; board(); } }, `${filt.pay === 'pending' ? 'รอตรวจยอด' : 'มียอดค้างชำระ'} ×`) : null),
          h('div', { class: 'bo-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางคำขอ' }, table), h('p', { class: 'bo-note' }, `${rows.length} จาก ${T.length} คำขอ · อัปเดต ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`)),
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
    const f = dirty(h('form', { class: 'bo-edit' }, h('div', { class: 'bo-2' }, h('label', {}, 'สถานะ', st), h('label', {}, 'ทีม', team)), h('div', { class: 'bo-2' }, h('label', {}, 'วันนัด', sd), h('label', {}, 'ช่วงเวลา', sl)), h('label', {}, 'บันทึกภายใน', note), save));
    f.addEventListener('submit', async e => {
      e.preventDefault(); save.disabled = true; save.textContent = 'กำลังบันทึก…';
      try { const r = await api.update(t.id, { status: st.value, team: team.value, schedDate: sd.value, schedSlot: sl.value, staffNote: note.value }, session.name); Object.assign(t, r.ticket); flash(`บันทึก ${t.id} แล้ว`); board(); }
      catch (x) { if (x && x.code === 'unauthorized') return expired(); flash(errTh(x), true); save.disabled = false; save.textContent = 'บันทึก'; }
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
      hasPay() ? h('section', { class: 'bo-pay', 'aria-labelledby': 'bo-pay-h' }) : null,
      hist.length ? h('details', { class: 'bo-hist' }, h('summary', {}, `ประวัติ ${hist.length} รายการ`), h('ol', {}, hist.slice().reverse().map(x => h('li', {}, `${x.at} · ${x.by}`, h('small', {}, [x.s, x.team != null ? 'ทีม ' + (x.team || '-') : '', x.date != null ? 'วัน ' + (x.date || '-') : '', x.slot != null ? 'ช่วง ' + (SLOTS[x.slot] || '-') : '', x.note ? 'แก้บันทึก' : ''].filter(Boolean).join(' · ')))))) : null));
    if (hasPay()) payLoad(t, !quiet || pay.stale || pay.id !== t.id);
    if (!quiet) box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  /* ---------- Rev.10 payments (production server: paydetail / payreq / payvoid / payrecord / payverify / refund) ---------- */
  async function payLoad(t, fresh) {
    if (pay.id !== t.id) { pay = { ...PAY0(), seq: pay.seq }; payOpen.clear(); }
    payRender(t);
    if (!fresh && (pay.d || pay.err)) return;
    const n = ++pay.seq;
    try {
      const d = await api.payDetail(t.id); if (n !== pay.seq || sel !== t.id) return;
      const same = pay.d && JSON.stringify(pay.d) === JSON.stringify(d);
      Object.assign(pay, { id: t.id, d, err: '', stale: false }); syncRow(t, d);
      if (!same) payRender(t);
    } catch (x) {
      if (n !== pay.seq) return;
      if (x && x.code === 'unauthorized') return expired();
      Object.assign(pay, { id: t.id, d: null, err: errTh(x), stale: false }); if (sel === t.id) payRender(t);
    }
  }
  // keep the table row / KPI figures in step with the detail the server just returned
  function syncRow(t, d) { if (d.summary) t.pay = d.summary; else delete t.pay; }
  // run one payment action: the server's reply (the new paydetail) is the only source of what is shown afterwards
  async function payAct(t, btn, err, run, ok, key) {
    btn.disabled = true; err.textContent = '';
    try {
      const r = await run();
      Object.assign(pay, { id: t.id, d: r, err: '', stale: false }); syncRow(t, r); if (key) payOpen.delete(key);
      // unsaved typing in the status / note form stays: then only the payment block is redrawn (table + tiles on the next refresh)
      flash(typeof ok === 'function' ? ok(r) : ok); if ($('.bo-edit[data-dirty]', main)) payRender(t); else board();
      const hd = $('#bo-pay-h', main); if (hd) hd.focus();
    } catch (x) { btn.disabled = false; if (x && x.code === 'unauthorized') return expired(); err.textContent = errTh(x); }
  }
  const fold = (key, title, ...kids) => h('details', { class: 'bo-pf', open: payOpen.has(key), ontoggle: e => { e.currentTarget.open ? payOpen.add(key) : payOpen.delete(key); } }, h('summary', {}, title), ...kids);
  const pform = (...kids) => dirty(h('form', { class: 'bo-pform', novalidate: true }, ...kids));
  // in-page confirmation (no window.confirm: claude.ai artifact frames refuse it — the Rev.10 test site — and it is clearer anyway)
  const sure = (anchor, text, yes) => {
    const old = anchor.parentNode.querySelector(':scope > .bo-sure'); if (old) { old.remove(); return; }
    const box = h('div', { class: 'bo-sure', role: 'group', 'aria-label': 'ยืนยันรายการ' }, h('p', {}, text));
    const ok = h('button', { type: 'button', class: 'bo-btn primary sm', onclick: () => { box.remove(); yes(); } }, 'ยืนยัน');
    box.append(h('div', { class: 'bo-rw' }, ok, h('button', { type: 'button', class: 'bo-btn sm', onclick: () => { box.remove(); anchor.focus(); } }, 'ไม่ใช่')));
    anchor.after(box); ok.focus();
  };
  const bad = (err, el, msg) => { err.textContent = msg; el.setAttribute('aria-invalid', 'true'); el.focus(); };
  const meta = a => h('small', {}, a.filter(Boolean).join(' · '));

  function payRender(t) {
    const box = $('.bo-pay', main); if (!box) return;
    const d = pay.id === t.id ? pay.d : null, s = d && d.summary;
    const top = h('div', { class: 'bo-ph' }, h('h3', { id: 'bo-pay-h', tabindex: '-1' }, 'การชำระเงิน'), s && s.statusTh ? h('span', { class: 'bo-ps ps-' + s.status }, s.statusTh) : null);
    if (!d) return box.replaceChildren(top, ...(pay.err ? [h('p', { class: 'bo-err', role: 'alert' }, pay.err), h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => payLoad(t, true) }, 'โหลดข้อมูลการชำระอีกครั้ง')] : [h('p', { class: 'bo-note' }, 'กำลังโหลดข้อมูลการชำระเงิน…')]));
    const K = d.kinds || {}, M = d.methods || {}, can = d.can || {}, lines = (d.quote && d.quote.lines) || [];
    // money summary
    const money = s ? h('div', { class: 'bo-money' }, [['ค้างชำระ', s.due], ['ได้รับแล้ว', s.paid], ['คืนแล้ว', s.refunded]].filter(([, v], i) => i < 2 || v > 0).map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, thb(v))))) : null;
    const pend = s && s.pending > 0 ? h('p', { class: 'bo-warn' }, `มียอดรอตรวจยอด ${s.pending} รายการ (ลูกค้าแจ้งโอน หรือช่างบันทึก)`) : null;
    // the server's price check of the customer's quote (list → ticket.priceCheck)
    const pc = t.priceCheck;
    const check = !pc ? h('p', { class: 'bo-note' }, 'คำขอนี้ไม่มีใบเสนอราคาจากหน้าเว็บ เรียกเก็บตามยอดที่ยืนยันกับลูกค้าแล้ว')
      : h('div', { class: 'bo-pc ' + (pc.match ? 'ok' : 'bad') }, h('b', {}, pc.match ? 'ราคาจากหน้าเว็บตรงกับราคาในระบบ' : 'ราคาจากหน้าเว็บไม่ตรงกับราคาในระบบ'),
        pc.issues && pc.issues.length ? h('ul', {}, pc.issues.map(x => h('li', {}, issueTh(x, lines)))) : null,
        pc.payable ? null : h('p', { class: 'bo-note' }, 'ระบบคำนวณยอดเรียกเก็บให้ไม่ได้ (มีรายการประเมินหน้างาน สินค้า สัญญารายปี หรือพื้นที่ที่ต้องยืนยัน) ใส่ยอดที่ยืนยันกับลูกค้าแล้ว'));
    const sg = can.request ? d.suggested : null;   // only those who can ask for money see the figure to ask
    const sug = sg ? h('p', { class: 'bo-sug' }, h('span', {}, 'ยอดแนะนำจากราคาในระบบ'), h('b', {}, thb(sg.amount)),
      h('small', {}, [sg.tax === 'invoice' ? `รวม VAT 7% (ลูกค้าขอใบกำกับภาษี: ก่อน VAT ${thb(sg.totalEx)} + VAT ${thb(sg.vat)})` : 'ราคาก่อน VAT · ลูกค้าไม่ขอใบกำกับภาษี', s && s.asked > 0 ? 'หักยอดที่เรียกเก็บไปแล้ว' : ''].filter(Boolean).join(' · '))) : null;
    const refOf = id => (d.requests.find(r => r.id === id) || {}).ref || id;
    // payment requests
    const reqRow = r => h('li', {}, h('div', { class: 'bo-rw' }, h('span', {}, `${K[r.kind] || r.kind} `, h('b', {}, thb(r.amount))), h('span', { class: 'bo-ps rq-' + r.status }, r.statusTh || r.status)),
      meta([`รหัสอ้างอิง ${r.ref}`, r.paid > 0 && r.paid < r.amount ? `รับแล้ว ${thb(r.paid)}` : '', r.status === 'open' && r.expiresAt ? `ชำระได้ถึง ${thDay(r.expiresAt)}` : '', r.createdBy ? `โดย ${r.createdBy}` : '']),
      r.note ? h('small', {}, r.note) : null, r.status === 'open' && can.request && !(r.paid > 0) && !(d.payments || []).some(p => p.reqId === r.id && ['submitted', 'pending'].includes(p.status)) ? voidForm(t, r) : null);
    // payments received
    const payRow = p => {
      const err = h('p', { class: 'bo-err', role: 'alert' });
      const vb = h('button', { type: 'button', class: 'bo-btn primary sm', onclick: () => sure(vb.parentNode, `ยืนยันว่าพบยอด ${thb(p.amount)} ในบัญชีบริษัท / ได้รับเงินแล้ว? ระบบจะออกเลขที่ใบเสร็จ`, () => payAct(t, vb, err, () => api.payVerify(p.id, 'verify', { staff: session.name }), r => { const x = r.payments.find(y => y.id === p.id); return `ยืนยันได้รับเงิน ${thb(p.amount)} แล้ว${x && x.receiptNo ? ' · ใบเสร็จ ' + x.receiptNo : ''}`; })) }, 'ยืนยันได้รับเงิน');
      const rb = h('button', { type: 'button', class: 'bo-btn sm', onclick: () => sure(rb.parentNode, `บันทึกว่าไม่พบยอด ${thb(p.amount)}? รายการนี้จะไม่นับเป็นยอดที่ได้รับ`, () => payAct(t, rb, err, () => api.payVerify(p.id, 'reject', { staff: session.name }), 'บันทึกว่าไม่พบยอดแล้ว')) }, 'ไม่พบยอด');
      return h('li', { 'data-pay': p.id }, h('div', { class: 'bo-rw' }, h('span', {}, `${p.methodTh || M[p.method] || p.method} `, h('b', {}, thb(p.amount))), h('span', { class: 'bo-ps pm-' + p.status }, p.statusTh || p.status)),
        p.receiptNo ? h('small', {}, 'เลขที่ใบเสร็จ ', h('b', { class: 'bo-rc' }, p.receiptNo)) : null,
        meta([p.reqId ? `รายการ ${refOf(p.reqId)}` : '', p.reference ? `อ้างอิง ${p.reference}` : '', `บันทึกโดย ${p.byWho} ${String(p.createdAt || '').slice(5, 16)}`, p.verifiedBy && p.status !== 'submitted' ? `ตรวจโดย ${p.verifiedBy}` : '']),
        p.note ? h('small', {}, p.note) : null,
        p.status !== 'submitted' ? null : can.verify ? h('div', { class: 'bo-act' }, vb, rb) : h('small', { class: 'bo-warn' }, 'รอสำนักงานตรวจยอด'), p.status === 'submitted' && can.verify ? err : null);
    };
    const refRow = f => h('li', {}, h('div', { class: 'bo-rw' }, h('span', {}, 'คืนเงิน ', h('b', {}, thb(f.amount))), h('span', { class: 'bo-ps ps-refunded' }, REFUND_TH[f.method] || f.method)),
      meta([f.reason, f.reference ? `อ้างอิง ${f.reference}` : '', `โดย ${f.byWho} ${String(f.createdAt || '').slice(5, 16)}`]));
    const list = (a, row, none) => a.length ? h('ul', { class: 'bo-rows' }, a.map(row)) : h('p', { class: 'bo-note' }, none);
    const net = s ? r2(s.paid - s.refunded) : 0;
    box.replaceChildren(...[top, money, pend, check, sug,
      h('div', { class: 'bo-pg' }, h('h4', {}, 'รายการเรียกเก็บ'), list(d.requests, reqRow, 'ยังไม่มีรายการเรียกเก็บ'), can.request && t.status !== 'cancelled' ? reqForm(t, d) : null),
      h('div', { class: 'bo-pg' }, h('h4', {}, 'รับเงิน'), list(d.payments, payRow, 'ยังไม่มีการรับเงิน'), recForm(t, d)),
      d.refunds.length || (can.refund && net > 0) ? h('div', { class: 'bo-pg' }, h('h4', {}, 'คืนเงิน'), d.refunds.length ? list(d.refunds, refRow, '') : null, can.refund && net > 0 ? refundForm(t, d, net) : null) : null].filter(Boolean));
  }
  // ask the customer for money: the amount defaults to the server's own figure (basis: server quote) when it has one
  function reqForm(t, d) {
    const sg = d.suggested;
    const kind = h('select', { id: 'bo-pr-kind' }, Object.entries(d.kinds || {}).map(([k, v]) => h('option', { value: k, selected: k === 'full' }, v)));
    const amt = h('input', { id: 'bo-pr-amt', inputmode: 'decimal', autocomplete: 'off', required: !sg, value: sg ? String(sg.amount) : '', 'aria-describedby': 'bo-pr-hint' });
    const note = h('input', { id: 'bo-pr-note', maxlength: 400, autocomplete: 'off' });
    const err = h('p', { class: 'bo-err', role: 'alert' }), go = h('button', { type: 'submit', class: 'bo-btn primary' }, 'สร้างรายการเรียกเก็บ');
    const f = pform(h('div', { class: 'bo-2' }, h('label', {}, 'ประเภท', kind), h('label', {}, 'จำนวนเงิน (บาท)', amt)),
      h('p', { class: 'bo-note', id: 'bo-pr-hint' }, sg ? 'ตั้งต้นเป็นยอดที่ระบบคำนวณจากราคาในระบบ แก้ได้เมื่อยืนยันยอดอื่นกับลูกค้าแล้ว' : 'ระบบคำนวณยอดให้ไม่ได้ ใส่ยอดที่ยืนยันกับลูกค้าแล้ว'),
      h('label', {}, 'หมายเหตุภายใน (ลูกค้าไม่เห็น)', note), err, go, h('p', { class: 'bo-note' }, 'ลูกค้าดูยอดและวิธีชำระได้ในหน้าติดตามสถานะ ด้วยเลขที่คำขอและเบอร์โทร'));
    f.addEventListener('submit', e => {
      e.preventDefault(); amt.removeAttribute('aria-invalid'); const a = cleanAmt(amt.value);
      if (!a && !sg) return bad(err, amt, 'กรุณาใส่จำนวนเงินที่ยืนยันกับลูกค้าแล้ว');
      if (a && !amtOk(a)) return bad(err, amt, errTh('bad_amount'));
      const o = { kind: kind.value, note: note.value.trim(), staff: session.name };
      if (a && !(sg && +a === sg.amount)) o.amount = a;   // unchanged suggestion → the server fills it in itself (basis: server quote)
      const before = new Set(d.requests.map(r => r.id));
      payAct(t, go, err, () => api.payRequest(t.id, o), r => { const x = r.requests.find(y => !before.has(y.id)); return x ? `สร้างรายการเรียกเก็บ ${thb(x.amount)} (รหัสอ้างอิง ${x.ref}) แล้ว` : 'สร้างรายการเรียกเก็บแล้ว'; }, 'req');
    });
    return fold('req', 'สร้างรายการเรียกเก็บเงิน', f);
  }
  function voidForm(t, r) {
    const key = 'void:' + r.id, why = h('input', { id: 'bo-pv-' + r.id, required: true, maxlength: 200, autocomplete: 'off' });
    const err = h('p', { class: 'bo-err', role: 'alert' }), go = h('button', { type: 'submit', class: 'bo-btn sm' }, 'ยืนยันยกเลิกรายการ');
    const f = pform(h('label', {}, 'เหตุผลที่ยกเลิก', why), err, go);
    f.addEventListener('submit', e => {
      e.preventDefault(); why.removeAttribute('aria-invalid'); const w = why.value.trim();
      if (!w) return bad(err, why, errTh('reason_required'));
      sure(go, `ยกเลิกรายการเรียกเก็บ ${r.ref} (${thb(r.amount)})? ลูกค้าจะชำระรายการนี้ไม่ได้อีก`, () => payAct(t, go, err, () => api.payVoid(r.id, w, session.name), `ยกเลิกรายการ ${r.ref} แล้ว`, key));
    });
    return fold(key, 'ยกเลิกรายการนี้', f);
  }
  // money received on site / by transfer: admin & staff → verified with a receipt number; tech → waits for the office
  function recForm(t, d) {
    const open = d.requests.filter(r => r.status === 'open'), left = r => r2(r.amount - (r.paid || 0)), tech = !(d.can || {}).verify;
    const method = h('select', { id: 'bo-pm-method' }, Object.entries(d.methods || {}).filter(([k]) => k !== 'gateway').map(([k, v]) => h('option', { value: k, selected: k === 'cash' }, v)));
    const req = h('select', { id: 'bo-pm-req' }, h('option', { value: '' }, '— ไม่ผูกกับรายการเรียกเก็บ —'), open.map((r, i) => h('option', { value: r.id, selected: i === 0 }, `${r.ref} · ${(d.kinds || {})[r.kind] || r.kind} · คงเหลือ ${thb(left(r))}`)));
    const amt = h('input', { id: 'bo-pm-amt', inputmode: 'decimal', autocomplete: 'off', required: true, value: open[0] ? String(left(open[0])) : '' });
    let auto = amt.value;
    req.addEventListener('change', () => { const r = open.find(x => x.id === req.value); if (cleanAmt(amt.value) === auto) amt.value = auto = r ? String(left(r)) : ''; });
    const ref = h('input', { id: 'bo-pm-ref', maxlength: 120, autocomplete: 'off', placeholder: 'เลขที่สลิป / เลขที่เช็ค' });
    const note = h('input', { id: 'bo-pm-note', maxlength: 400, autocomplete: 'off' });
    const err = h('p', { class: 'bo-err', role: 'alert' }), go = h('button', { type: 'submit', class: 'bo-btn primary' }, 'บันทึกรับเงิน');
    const f = pform(h('div', { class: 'bo-2' }, h('label', {}, 'ช่องทาง', method), h('label', {}, 'จำนวนเงิน (บาท)', amt)), h('label', {}, 'สำหรับรายการเรียกเก็บ', req),
      h('div', { class: 'bo-2' }, h('label', {}, 'เลขอ้างอิง', ref), h('label', {}, 'หมายเหตุ', note)),
      h('p', { class: tech ? 'bo-warn' : 'bo-note' }, tech ? 'บัญชีช่าง: ยอดที่บันทึกจะรอสำนักงานตรวจยอดก่อน จึงจะนับเป็นยอดที่ได้รับและออกเลขที่ใบเสร็จ' : 'บันทึกเมื่อได้รับเงินจริงแล้วเท่านั้น ระบบจะนับเป็นยอดที่ได้รับและออกเลขที่ใบเสร็จทันที'), err, go);
    f.addEventListener('submit', e => {
      e.preventDefault(); amt.removeAttribute('aria-invalid'); const a = cleanAmt(amt.value);
      if (!amtOk(a)) return bad(err, amt, a ? errTh('bad_amount') : 'กรุณาใส่จำนวนเงินที่ได้รับ');
      const before = new Set(d.payments.map(p => p.id));
      payAct(t, go, err, () => api.payRecord(t.id, { method: method.value, amount: a, req: req.value || undefined, reference: ref.value.trim(), note: note.value.trim(), staff: session.name }),
        r => { const p = r.payments.find(x => !before.has(x.id)); return p && p.receiptNo ? `บันทึกรับเงิน ${thb(p.amount)} แล้ว · ใบเสร็จ ${p.receiptNo}` : `บันทึก ${thb(+a)} แล้ว รอสำนักงานตรวจยอด`; }, 'rec');
    });
    return fold('rec', tech ? 'บันทึกเงินที่รับหน้างาน' : 'บันทึกรับเงิน', f);
  }
  // admin only: money given back (after the transfer / cash went out) — never more than received net
  function refundForm(t, d, net) {
    const M = d.methods || {}, gw = d.payments.some(p => p.method === 'gateway' && p.status === 'verified');
    const amt = h('input', { id: 'bo-rf-amt', inputmode: 'decimal', autocomplete: 'off', required: true, 'aria-describedby': 'bo-rf-hint' });
    const method = h('select', { id: 'bo-rf-method' }, Object.keys(REFUND_TH).filter(k => k !== 'gateway' || gw).map(k => h('option', { value: k }, REFUND_TH[k])));
    const pm = h('select', { id: 'bo-rf-pay' }, h('option', { value: '' }, '— ไม่ระบุ —'), d.payments.filter(p => p.status === 'verified').map(p => h('option', { value: p.id }, `${p.receiptNo || p.id} · ${p.methodTh || M[p.method] || p.method} · ${thb(p.amount)}`)));
    const ref = h('input', { id: 'bo-rf-ref', maxlength: 120, autocomplete: 'off' });
    const why = h('input', { id: 'bo-rf-why', required: true, maxlength: 200, autocomplete: 'off' });
    const err = h('p', { class: 'bo-err', role: 'alert' }), go = h('button', { type: 'submit', class: 'bo-btn primary' }, 'บันทึกการคืนเงิน');
    const f = pform(h('div', { class: 'bo-2' }, h('label', {}, 'จำนวนเงิน (บาท)', amt), h('label', {}, 'คืนทาง', method)), h('p', { class: 'bo-note', id: 'bo-rf-hint' }, `คืนได้ไม่เกิน ${thb(net)} (ยอดที่ได้รับสุทธิ) · บันทึกหลังคืนเงินให้ลูกค้าแล้วเท่านั้น`),
      h('label', {}, 'คืนจากการชำระ', pm), h('div', { class: 'bo-2' }, h('label', {}, 'เลขอ้างอิง', ref), h('label', {}, 'เหตุผล', why)), err, go);
    f.addEventListener('submit', e => {
      e.preventDefault(); amt.removeAttribute('aria-invalid'); why.removeAttribute('aria-invalid'); const a = cleanAmt(amt.value), w = why.value.trim();
      if (!amtOk(a)) return bad(err, amt, a ? errTh('bad_amount') : 'กรุณาใส่จำนวนเงินที่คืน');
      if (+a > net) return bad(err, amt, errTh('refund_too_large'));
      if (!w) return bad(err, why, errTh('reason_required'));
      sure(go, `บันทึกการคืนเงิน ${thb(+a)} ให้ ${t.name}? บันทึกแล้วแก้ไขหรือลบไม่ได้`, () => payAct(t, go, err, () => api.refund(t.id, { amount: a, method: method.value, payment: pm.value || undefined, reference: ref.value.trim(), reason: w, staff: session.name }), `บันทึกการคืนเงิน ${thb(+a)} แล้ว`, 'refund'));
    });
    return fold('refund', 'บันทึกการคืนเงิน', f);
  }

  who();
  if (session) {
    main.replaceChildren(h('p', { class: 'bo-note' }, 'กำลังโหลด…'));
    // a Rev.09 session (no role saved): ask the server who this is — the Apps Script back office answers unknown_action
    (session.role === undefined ? api.me().then(m => Object.assign(session, { role: m.role, roleTh: m.roleTh }), () => { session.role = ''; }).then(() => { ss.set(session); who(); }) : Promise.resolve()).then(() => load()).then(start);
  } else login();
}
