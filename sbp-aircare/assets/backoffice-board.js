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
// Rev.10 UX (staff audit): the edit form sends only the fields staff changed and never turns the customer's preferred date
// into an appointment · every money form carries a request id (rid): a retry after a timeout gets the server's stored reply,
// never a second receipt · in-page confirmations read their question, close with Esc, return focus, and use a red button for
// void / reject / refund / cancel · cancelling asks for a reason (every role) and voids open payment requests · the 60 s refresh
// never redraws under staff (it offers the update instead) and redraws keep keyboard focus · one Thai date-time format ·
// ≥1101 px list and ticket side by side · ≤700 px rows as cards and a one-row header.
import { h, $, $$, COMPANY, TYPE_BY_ID, logoSrc } from './sbp-core.js';
import { staffApi, staffLogin, endpoint, useEndpoint, testSite, errTh, KINDS, SERVICES, STATUSES, SLOTS } from './ticket.js';
import { copyText } from './contact.js';
import { icon } from './icons.js';

const SK = 'sbp-staff-v1', DK = 'sbp-staff-draft-v1';
const ss = { get() { try { return JSON.parse(sessionStorage.getItem(SK) || 'null'); } catch (e) { return null; } }, set(v) { try { v ? sessionStorage.setItem(SK, JSON.stringify(v)) : sessionStorage.removeItem(SK); } catch (e) {} } };
const ACTIVE = ['new', 'need_info', 'confirmed', 'assigned', 'in_progress'];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const thDay = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const thDayLong = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }) : '';
// one Thai date-time for every time stamp on the board: '2026-10-11 10:47:43' → 'อา. 11 ต.ค. 10:47' (another year adds it)
const thDT = s => { const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || '')); if (!m) return String(s || ''); const other = +m[1] !== new Date().getFullYear(); return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', ...(other ? { year: '2-digit' } : {}) }) + ` ${m[4]}:${m[5]}`; };
const hhmm = d => d ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
const telFmt = t => { const d = String(t || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : d; };
const units = u => { try { const o = typeof u === 'string' && u ? JSON.parse(u) : (u || {}); return Object.entries(o).map(([k, n]) => `${(TYPE_BY_ID[k] || { th: k }).th} ${n}`).join(' · '); } catch (e) { return String(u || ''); } };
const when = t => t.schedDate ? { d: t.schedDate, s: t.schedSlot, fixed: true } : t.prefDate ? { d: t.prefDate, s: t.slot, fixed: false } : null;
const greet = n => { n = String(n || '').trim(); return /^คุณ/.test(n) ? n : 'คุณ' + n; };   // many names already start with คุณ (and some names begin with it: never cut it off)
const newRid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
// one line under the name: what this account does (server roles — server/staff.mjs; payments.mjs can())
const ROLE_NOTE = { admin: 'ทำได้ทุกรายการ รวมบันทึกการคืนเงิน', staff: 'เรียกเก็บ ยืนยันยอด บันทึกรับเงิน · คืนเงินโดยผู้ดูแล', tech: 'อัปเดตงานและบันทึกเงินที่รับหน้างาน · สำนักงานตรวจยอด' };
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
// the money chip: everything asked for is paid, yet the server quote still leaves an amount nobody has asked for (owner to confirm wording)
const payState = s => !s ? null : s.due <= 0 && s.paid > 0 && !(s.refunded > 0) && s.status !== 'overpaid' && s.unasked > 0 ? { k: 'asked', th: 'ชำระตามที่เรียกเก็บ' } : s.statusTh ? { k: s.status, th: s.statusTh } : null;
// the appointment message for LINE / SMS: built from the SAVED appointment at the moment of the click (no team names — §6.6 #24)
const confirmText = t => `เรียน${greet(t.name)} ${COMPANY.brand} ยืนยันนัด${SERVICES[t.service] || 'บริการ'} ${thDayLong(t.schedDate)} ${SLOTS[t.schedSlot] || ''} เลขที่คำขอ ${t.id} ทีมจะโทรก่อนเข้าหน้างาน สอบถาม ${COMPANY.tel}`.replace(/\s+/g, ' ');
const copyWhy = t => t.kind !== 'booking' ? 'ข้อความยืนยันนัดใช้กับคำขอจองคิวเท่านั้น' : !t.schedDate || !['confirmed', 'assigned'].includes(t.status) ? 'ยืนยันวันนัดก่อน: ตั้งวันนัด เลือกสถานะ "ยืนยันนัดแล้ว" หรือ "จัดทีมแล้ว" แล้วกดบันทึก' : '';
const rm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountBoard(root) {
  let session = ss.get(), api = session ? staffApi(session.token) : null, data = null, sel = null, timer = null;
  let loadedAt = null, offline = '', fresh = null;
  if (session && session.url) useEndpoint(session.url);
  const FILT0 = { status: 'active', kind: '', q: '', day: '', pay: '' };
  const filt = { ...FILT0 };
  // payments of the open ticket (paydetail), cached so filtering / the 60 s refresh do not wipe what staff are typing
  const PAY0 = () => ({ id: null, d: null, err: '', stale: true, seq: 0 });
  let pay = PAY0();
  const payOpen = new Set();   // which payment forms are unfolded
  // per ticket: unsaved typing (edit form + payment forms), the request id of each money form, inline messages that outlive a redraw
  const drafts = new Map(), rids = new Map(), notes = new Map(), restored = new Set();   // restored: drafts brought back after a new login
  const ridOf = k => { if (!rids.has(k)) rids.set(k, newRid()); return rids.get(k); };
  const hasPay = () => !!(session && session.role);   // production server (Apps Script back office has no payments)
  const roleLine = () => [session.roleTh, ROLE_NOTE[session.role]].filter(Boolean).join(' · ');
  const head = h('header', { class: 'bo-head' }, h('img', { src: logoSrc('sbp'), alt: '', width: 44, height: 32 }), h('div', { class: 'bo-title' }, h('b', {}, 'หลังบ้าน', h('span', { class: 'bo-wide' }, ' SBP AirCare')), h('small', {}, 'คิวและคำขอจากเว็บไซต์')), h('div', { class: 'bo-who' }));
  const main = h('main', { class: 'bo-main' });
  root.append(head, main);
  // the sticky header's real height → scroll padding, so the opened ticket and focused controls never sit under it
  const headH = () => document.documentElement.style.setProperty('--bo-head-h', head.offsetHeight + 'px');
  if (typeof ResizeObserver === 'function') new ResizeObserver(headH).observe(head);
  headH();
  function who() {
    const w = $('.bo-who', head); w.replaceChildren();
    if (!session) return;
    const out = h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => { out.disabled = true; logout(); } }, h('span', {}, 'ออก', h('span', { class: 'bo-wide' }, 'จากระบบ')));
    w.append(h('span', { class: 'bo-me' }, h('b', {}, session.name || 'เจ้าหน้าที่'), session.roleTh ? h('small', {}, roleLine()) : null), h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => load(true) }, 'รีเฟรช'), out);
  }
  function endSession(msg = '', keep = false) {
    if (keep) saveDraft(); else try { sessionStorage.removeItem(DK); } catch (e) {}
    session = null; api = null; ss.set(null); clearInterval(timer); data = null; sel = null; fresh = null; pay = PAY0(); payOpen.clear(); drafts.clear(); rids.clear(); notes.clear(); restored.clear(); who(); login(msg);
  }
  async function logout() { const a = api; if (a) { try { await a.logout(); } catch (e) {} } endSession(); }   // the server ends the session; the Apps Script back office has nothing to end
  const expired = () => endSession('หมดเวลาเข้าใช้งานหรือบัญชีถูกปิด กรุณาเข้าสู่ระบบอีกครั้ง', true);
  // session ended under staff: keep what they typed in the open ticket (edit form + money forms) and the money forms' request
  // ids (a retry stays a retry) for this tab — nothing is re-sent by itself: every money action still needs its click
  function saveDraft() { try { const ds = sel ? [...drafts].filter(([k]) => k.startsWith(sel + ':')) : []; ds.length || rids.size ? sessionStorage.setItem(DK, JSON.stringify({ user: session.user || session.name, sel, drafts: ds, rids: [...rids] })) : sessionStorage.removeItem(DK); } catch (x) {} }
  function takeDraft(s) { try { const x = JSON.parse(sessionStorage.getItem(DK) || 'null'); sessionStorage.removeItem(DK); return x && x.user === (s.user || s.name) ? x : null; } catch (e) { return null; } }
  function login(msg = '') {
    const tok = h('input', { id: 'bo-tok', type: 'password', required: true, autocomplete: 'current-password', 'aria-describedby': 'bo-lerr' });
    const nm = h('input', { id: 'bo-nm', required: true, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', 'aria-describedby': 'bo-lerr' });
    const err = h('p', { class: 'bo-err', role: 'alert', id: 'bo-lerr' }, msg);
    const fixed = !!endpoint();
    const url = h('input', { id: 'bo-url', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', 'aria-describedby': 'bo-lerr' });
    const go = h('button', { class: 'bo-btn primary', type: 'submit' }, 'เข้าสู่ระบบ');
    // a refused login marks the fields it is about, says why under them and puts the cursor back where staff retype
    const refuse = (text, bad, at) => { err.textContent = text; for (const x of [url, nm, tok]) bad.includes(x) ? x.setAttribute('aria-invalid', 'true') : x.removeAttribute('aria-invalid'); if (at) { at.focus(); if (at.select) at.select(); } };
    for (const x of [url, nm, tok]) x.addEventListener('input', () => x.removeAttribute('aria-invalid'));
    const f = h('form', { class: 'bo-login', novalidate: true }, h('h1', {}, 'เข้าสู่ระบบหลังบ้าน'),
      h('p', { class: 'bo-note' }, fixed ? 'ใช้ชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลระบบสร้างให้' : 'ใส่ที่อยู่ระบบหลังบ้าน (Web app URL ที่ลงท้าย /exec) ชื่อผู้ใช้ และรหัสผ่าน — ดู backoffice/README.md'),
      fixed ? null : h('label', {}, 'ที่อยู่ระบบหลังบ้าน', url),
      h('label', {}, 'ชื่อผู้ใช้', nm), h('label', {}, 'รหัสผ่าน', tok),
      // the shared-code back office (Apps Script) only: the board talks to it when there is no fixed endpoint
      fixed ? null : h('p', { class: 'bo-note' }, 'ระบบเดิมที่ใช้รหัสเจ้าหน้าที่ร่วมกัน: ใส่ชื่อของคุณในช่องชื่อผู้ใช้ (บันทึกในประวัติการแก้ไข) และรหัสเจ้าหน้าที่ในช่องรหัสผ่าน'), err, go);
    f.addEventListener('submit', async e => {
      e.preventDefault(); const user = nm.value.trim(), pw = tok.value;
      if (!pw || !user) return refuse('กรอกชื่อผู้ใช้และรหัสผ่าน', [user ? null : nm, pw ? null : tok], user ? tok : nm);
      if (!fixed && !useEndpoint(url.value.trim())) return refuse('ที่อยู่ระบบหลังบ้านต้องขึ้นต้นด้วย https://', [url], url);
      go.disabled = true; err.textContent = 'กำลังตรวจ…'; for (const x of [url, nm, tok]) x.removeAttribute('aria-invalid');
      let s, old = false;
      try {
        try { const r = await staffLogin(user, pw); s = { token: r.token, name: r.name, role: r.role, roleTh: r.roleTh, user }; }
        catch (x) {
          // Apps Script back office (no accounts: unknown_action) or the legacy STAFF_TOKEN typed as the password (unauthorized):
          // the password is the token and the typed name goes into the history — list() decides
          if (!x || (x.code !== 'unknown_action' && x.code !== 'unauthorized')) throw x;
          old = x.code === 'unknown_action'; s = { token: pw, name: user, role: '', legacy: true, user };
        }
        api = staffApi(s.token); data = await api.list(); loadedAt = new Date(); offline = '';
        if (s.legacy && !old) { const m = await api.me().catch(() => null); if (m) Object.assign(s, { role: m.role, roleTh: m.roleTh }); }
        session = { ...s, url: fixed ? null : url.value.trim() }; ss.set(session); pay = PAY0(); who();
        const dr = takeDraft(session);
        if (dr && data.tickets.some(t => t.id === dr.sel)) {
          sel = dr.sel; pay.id = sel; for (const [k, v] of dr.rids || []) rids.set(k, v);
          for (const [k, v] of dr.drafts || []) { drafts.set(k, v); restored.add(k); if (k !== sel + ':edit') payOpen.add(k.slice(sel.length + 1)); }   // money forms with a draft open unfolded
        }
        board(); start();
        if (restored.size) open(sel); else { const h1 = $('h1', main); if (h1) h1.focus(); }
      } catch (x) {
        api = null; data = null; go.disabled = false;
        const wrong = !!(x && x.code === 'unauthorized');
        refuse(wrong && !old ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' : x && x.code === 'rate_limited' ? 'ลองผิดหลายครั้ง ระบบพักการเข้าสู่ระบบจากเครื่องนี้ประมาณ 15 นาที' : errTh(x), wrong ? [nm, tok] : [], tok);
      }
    });
    main.replaceChildren(f); setTimeout(() => nm.focus(), 0);
  }
  // 60 s refresh: never redraws under staff (a confirmation open, unsaved typing, keyboard focus in the board) — then it fetches
  // quietly and offers the update in the status line; otherwise it redraws and keyboard focus stays on the same control
  const busy = () => { const a = document.activeElement; return !!document.querySelector('.bo-sure, .bo-main form[data-dirty]') || !!(a && a !== document.body && main.contains(a)); };
  function start() { clearInterval(timer); timer = setInterval(tick, 60000); }
  async function tick() {
    if (!api || !data || document.visibilityState !== 'visible') return;
    if (!busy()) return load();
    try { const d = await api.list(); offline = ''; if (sig(d) !== sig(data)) fresh = { d, at: new Date() }; upd(); }
    catch (x) { if (x && x.code === 'unauthorized') return expired(); offline = errTh(x); upd(); }
  }
  const sig = d => d ? d.tickets.map(t => [t.id, t.status, t.updatedAt, t.team, t.schedDate, JSON.stringify(t.pay || '')].join('~')).join('|') : '';
  async function load(manual = false) {
    if (!api) return;
    try { data = await api.list(); fresh = null; loadedAt = new Date(); offline = ''; pay.stale = true; board(); if (manual) flash('อัปเดตแล้ว'); }
    catch (x) {
      if (x && x.code === 'unauthorized') return expired();
      offline = errTh(x); if (data) upd(); else main.replaceChildren(h('p', { class: 'bo-err', role: 'alert' }, errTh(x)), h('p', {}, h('button', { type: 'button', class: 'bo-btn', onclick: () => load(true) }, 'ลองอีกครั้ง')));
      if (manual) flash(errTh(x), true);   // the persistent line says it too; an automatic refresh never repeats a toast
    }
  }
  const toast = h('p', { class: 'bo-toast', role: 'status', hidden: true });
  const live = h('p', { class: 'bo-sr', role: 'status' });   // short announcements (the detail itself is not a live region)
  document.body.append(toast, live);
  function flash(t, bad) { toast.textContent = t; toast.classList.toggle('bad', !!bad); toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => toast.hidden = true, bad ? 6000 : 3500); }
  const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 60); };
  const dirty = f => { f.addEventListener('input', () => { f.dataset.dirty = '1'; }); return f; };
  // the list's status line: counts + last update; offline = one persistent line; new data while staff work = an offer
  function upd() {
    const p = $('.bo-upd', main); if (!p) return;
    p.classList.toggle('bad', !!offline);
    p.replaceChildren(`${p.dataset.n} คำขอ · ` + (offline ? `ออฟไลน์หรือระบบไม่ตอบ — ข้อมูลล่าสุด ${hhmm(loadedAt)}` : `อัปเดต ${hhmm(loadedAt)}`),
      ...(fresh && !offline ? [' · ', h('button', { type: 'button', class: 'bo-link', 'data-fk': 'fresh', onclick: () => { data = fresh.d; loadedAt = fresh.at; fresh = null; pay.stale = true; board(); } }, 'มีข้อมูลใหม่ — แสดง')] : []));
  }
  // keyboard focus across a redraw: controls carry data-fk; the same control (and caret) gets focus back
  const focusKey = () => { const a = document.activeElement; if (!a || a === document.body || !main.contains(a)) return null; const el = a.closest('[data-fk]'); return { k: el ? el.dataset.fk : '', d: !!a.closest('.bo-detail'), s: a.selectionStart, e: a.selectionEnd }; };
  function refocus(f) {
    if (!f) return;
    const el = (f.k && main.querySelector(`[data-fk="${CSS.escape(f.k)}"]`)) || (f.d ? $('.bo-detail h2', main) : null) || $('.bo-tools select', main);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (typeof f.s === 'number' && el.setSelectionRange) try { el.setSelectionRange(f.s, f.e); } catch (e) {}
  }

  function board() {
    const T = data.tickets, today = iso(new Date()), fk = focusKey();
    const act = T.filter(t => ACTIVE.includes(t.status));
    const kpi = [
      ['ใหม่ รอยืนยัน', T.filter(t => t.status === 'new').length, 'new'],
      ['รอข้อมูลลูกค้า', T.filter(t => t.status === 'need_info').length, 'need_info'],
      ['นัดแล้ว (ยืนยัน / จัดทีม)', T.filter(t => ['confirmed', 'assigned'].includes(t.status)).length, 'booked'],
      ['งานวันนี้', act.filter(t => (when(t) || {}).d === today).length, 'today'],
    ];
    // Rev.10: money tiles (production server) — reported transfers / technicians' entries to verify, and what is still owed
    // (a cancelled ticket owes nothing: cancelling voids its open requests)
    const owes = t => t.pay && t.pay.due > 0 && t.status !== 'cancelled';
    const pk = hasPay() ? [['รอตรวจยอด', String(T.filter(t => t.pay && t.pay.pending > 0).length), 'pending'], ['ยอดค้างชำระ', thb(T.reduce((a, t) => a + (owes(t) ? +t.pay.due : 0), 0)), 'due']] : [];
    const tiles = h('div', { class: 'bo-kpi' }, kpi.map(([th, n, k]) => h('button', { type: 'button', class: 'bo-tile', 'data-fk': 'tile:' + k, 'aria-pressed': !filt.pay && (filt.status === k || (k === 'today' && filt.day === today)), onclick: () => { filt.pay = ''; if (k === 'today') { filt.day = today; filt.status = 'active'; } else { filt.status = k; filt.day = ''; } board(); } }, h('b', {}, String(n)), h('span', {}, th))),
      pk.map(([th, v, k]) => h('button', { type: 'button', class: 'bo-tile' + (k === 'due' ? ' money' : ''), 'data-fk': 'tile:' + k, 'aria-pressed': filt.pay === k, onclick: () => { filt.pay = filt.pay === k ? '' : k; filt.status = 'all'; filt.day = ''; board(); } }, h('b', {}, v), h('span', {}, th))));
    // 14-day load: bookings per half-day vs capacity (scheduled date first, else the customer's preferred date)
    const cap = data.capacity || 2, days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return iso(d); });
    const busyAt = {}; act.forEach(t => { const w = when(t); if (!w || t.kind !== 'booking') return; const k = w.d + '|' + (w.s || 'AM'); (busyAt[k] = busyAt[k] || []).push(t); });
    const grid = h('div', { class: 'bo-cap', role: 'table', 'aria-label': `คิว 14 วัน (รับได้ ${cap} งานต่อช่วง)` },
      h('div', { role: 'row', class: 'bo-cap-r hd' }, h('span', { role: 'columnheader' }, 'วัน'), ...Object.values(SLOTS).map(s => h('span', { role: 'columnheader' }, s))),
      days.map(d => h('div', { role: 'row', class: 'bo-cap-r' + (filt.day === d ? ' on' : '') },
        h('span', { role: 'rowheader' }, h('button', { type: 'button', 'data-fk': 'day:' + d, 'aria-pressed': filt.day === d, onclick: () => { filt.day = filt.day === d ? '' : d; board(); } }, thDay(d))),
        ...Object.keys(SLOTS).map(s => { const n = (busyAt[d + '|' + s] || []).length; return h('span', { role: 'cell', class: n >= cap && s !== 'EVE' ? 'full' : n ? 'some' : '' }, n ? `${n}${s !== 'EVE' ? '/' + cap : ''}` : '–'); }))));
    // list — search also takes the phone as the table shows it (digits only) and the payment codes on slips / receipts
    const q = filt.q.trim().toLowerCase(), qd = /^[\d\s()+-]+$/.test(q) ? q.replace(/\D/g, '') : '';
    const hit = t => !q || [t.id, t.name, t.tel, telFmt(t.tel), t.company, t.area, t.address, ...((t.pay && t.pay.refs) || [])].join(' ').toLowerCase().includes(q) || (qd.length >= 3 && String(t.tel || '').replace(/\D/g, '').includes(qd));
    const rows = T.filter(t => (filt.status === 'active' ? ACTIVE.includes(t.status) : filt.status === 'all' ? true : filt.status === 'booked' ? ['confirmed', 'assigned'].includes(t.status) : t.status === filt.status)
      && (!filt.kind || t.kind === filt.kind) && (!filt.day || (when(t) || {}).d === filt.day)
      && (!filt.pay || (t.pay && (filt.pay === 'pending' ? t.pay.pending > 0 : owes(t)))) && hit(t));
    const statusSel = h('select', { 'aria-label': 'สถานะ', 'data-fk': 'f:status', onchange: e => { filt.status = e.target.value; board(); } }, [['active', 'ยังไม่ปิด'], ['all', 'ทั้งหมด'], ['booked', 'นัดแล้ว'], ...Object.entries(STATUSES)].map(([k, t]) => h('option', { value: k, selected: k === filt.status }, t)));
    const kindSel = h('select', { 'aria-label': 'ประเภทคำขอ', 'data-fk': 'f:kind', onchange: e => { filt.kind = e.target.value; board(); } }, [['', 'ทุกประเภท'], ...Object.entries(KINDS)].map(([k, t]) => h('option', { value: k, selected: k === filt.kind }, t)));
    const search = h('input', { type: 'search', placeholder: 'ค้นหา เลขที่ ชื่อ เบอร์ รหัสอ้างอิงการชำระ', value: filt.q, 'aria-label': 'ค้นหาคำขอ', 'data-fk': 'f:q', oninput: e => { filt.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(board, 250); } });
    const P = hasPay(), cols = ['เลขที่', 'รับเมื่อ', 'คำขอ', 'ลูกค้า', 'พื้นที่', 'วันที่', 'สถานะ', ...(P ? ['ชำระเงิน'] : []), 'ทีม'];
    const payCell = p => { const st = payState(p); const x = p ? [st ? h('span', { class: 'bo-ps ps-' + st.k }, st.th) : null, p.due > 0 ? h('small', { class: 'nw' }, 'ค้าง ' + thb(p.due)) : null, st && st.k === 'asked' ? h('small', { class: 'nw' }, 'ยังไม่เรียกเก็บ ' + thb(p.unasked)) : null, p.pending > 0 ? h('small', { class: 'bo-pend' }, `รอตรวจยอด ${p.pending}`) : null].filter(Boolean) : []; return x.length ? h('div', { class: 'bo-pc-cell' }, x) : '—'; };
    // each row: the ticket number is the button (keyboard + screen readers); a click anywhere on the row opens it too
    const row = t => { const w = when(t); return h('tr', { class: (sel === t.id ? 'on ' : '') + 'st-' + t.status, 'data-id': t.id, onclick: e => { if (!e.target.closest('a, button')) open(t.id); } },
      h('th', { scope: 'row', class: 'c-id' }, h('button', { type: 'button', class: 'bo-open', 'data-fk': 'row:' + t.id, 'aria-current': sel === t.id ? 'true' : null, onclick: () => open(t.id) }, t.id)),
      h('td', { class: 'c-at' }, ...thDT(t.createdAt).split(/ (?=\d\d:\d\d$)/).map((x, i) => i ? h('small', {}, x) : x)), h('td', { class: 'c-kind' }, KINDS[t.kind] || t.kind, t.service ? h('small', {}, SERVICES[t.service] || t.service) : null),
      h('td', { class: 'c-cust' }, t.name, h('small', { class: 'nw' }, telFmt(t.tel))), h('td', { class: 'c-area', 'data-empty': t.area ? null : '' }, t.area || '—'),
      h('td', { class: 'c-when', 'data-empty': w ? null : '' }, w ? [h('span', { class: 'nw' }, thDay(w.d)), h('small', {}, [SLOTS[w.s], w.fixed ? 'นัดแล้ว' : 'ลูกค้าขอ'].filter(Boolean).join(' · '))] : '—'),
      h('td', { class: 'c-st' }, h('span', { class: 'bo-st st-' + t.status }, STATUSES[t.status] || t.status)), P ? (c => h('td', { class: 'c-pay', 'data-empty': c === '—' ? '' : null }, c))(payCell(t.pay)) : null, h('td', { class: 'c-team' }, t.team || '—')); };
    const isDefault = Object.keys(FILT0).every(k => filt[k] === FILT0[k]);
    const empty = !T.length ? [h('b', {}, 'ยังไม่มีคำขอ'), ' — ลองจองคิวจากหน้าเว็บ แล้วกดรีเฟรช', ...(testSite() ? [' · ', h('a', { href: '#' }, 'กลับหน้าเว็บ')] : [])]
      : isDefault ? ['ไม่มีคำขอที่ยังไม่ปิด ', h('button', { type: 'button', class: 'bo-btn ghost sm', 'data-fk': 'empty', onclick: () => { filt.status = 'all'; board(); } }, 'ดูคำขอทั้งหมด')]
      : ['ไม่มีคำขอตามตัวกรองนี้ ', h('button', { type: 'button', class: 'bo-btn ghost sm', 'data-fk': 'empty', onclick: () => { Object.assign(filt, FILT0); board(); } }, 'ล้างตัวกรอง')];
    const table = h('table', { class: 'bo-t' + (P ? ' pay' : '') }, h('thead', {}, h('tr', {}, cols.map(t => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rows.length ? rows.map(row) : h('tr', {}, h('td', { colspan: cols.length, class: 'bo-empty' }, empty))));
    main.replaceChildren(h('h1', { class: 'bo-sr', tabindex: '-1' }, 'คิวและคำขอ'), session && session.roleTh ? h('p', { class: 'bo-note bo-role' }, `${session.name || ''} · ${roleLine()}`) : null, tiles,
      h('div', { class: 'bo-cols' + (sel ? ' sel' : '') },
        h('section', { class: 'bo-list', 'aria-label': 'รายการคำขอ' }, h('div', { class: 'bo-tools' }, statusSel, kindSel, search, filt.day ? h('button', { type: 'button', class: 'bo-btn ghost', 'data-fk': 'chip:day', onclick: () => { filt.day = ''; board(); } }, `วันที่ ${thDay(filt.day)} ×`) : null,
          filt.pay ? h('button', { type: 'button', class: 'bo-btn ghost', 'data-fk': 'chip:pay', 'aria-label': 'ล้างตัวกรองการชำระเงิน', onclick: () => { filt.pay = ''; filt.status = 'active'; board(); } }, `${filt.pay === 'pending' ? 'รอตรวจยอด' : 'มียอดค้างชำระ'} ×`) : null),
          h('div', { class: 'bo-scroll', tabindex: '0', role: 'region', 'aria-label': 'ตารางคำขอ' }, table), h('p', { class: 'bo-note bo-upd', role: 'status', 'data-n': `${rows.length} จาก ${T.length}` })),
        h('aside', { class: 'bo-side' }, h('div', { class: 'bo-detail' }), h('div', { class: 'bo-capbox' }, h('h2', {}, 'คิว 14 วัน'), h('p', { class: 'bo-note' }, `งานจองคิวต่อช่วง (รับได้ ${cap} งาน) · กดวันเพื่อกรอง`), grid))));
    upd();
    if (sel) open(sel, true);
    refocus(fk);
  }
  const back = id => { const b = main.querySelector(`[data-fk="${CSS.escape('row:' + id)}"]`) || $('.bo-tools input', main); if (b) { b.focus({ preventScroll: true }); b.scrollIntoView({ behavior: rm() ? 'auto' : 'smooth', block: 'center' }); } };
  function open(id, quiet) {
    sel = id; const t = data.tickets.find(x => x.id === id); const box = $('.bo-detail', main); if (!t || !box) return;
    $('.bo-cols', main).classList.add('sel');
    $$('.bo-t tbody tr', main).forEach(r => { const on = r.dataset.id === id, b = $('.bo-open', r); r.classList.toggle('on', on); if (b) on ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'); });
    const ek = id + ':edit', cur = { status: t.status, team: t.team || '', schedDate: t.schedDate || '', schedSlot: t.schedSlot || '', staffNote: t.staffNote || '' };
    const st = h('select', { id: 'bo-st', 'data-fk': 'e:st' }, Object.entries(STATUSES).map(([k, v]) => h('option', { value: k, selected: k === t.status }, v)));
    const team = h('select', { id: 'bo-team', 'data-fk': 'e:team' }, ['', ...(data.teams || [])].map(k => h('option', { value: k, selected: k === (t.team || '') }, k || '— ยังไม่จัดทีม —')));
    // the appointment is only what the team scheduled; the customer's preferred date is a hint until staff choose it (§6.6 #23)
    const sd = h('input', { id: 'bo-sd', type: 'date', value: t.schedDate || '', 'data-fk': 'e:sd', 'aria-describedby': t.prefDate ? 'bo-pref' : null });
    const sl = h('select', { id: 'bo-sl', 'data-fk': 'e:sl', 'aria-describedby': t.prefDate ? 'bo-pref' : null }, [['', '—'], ...Object.entries(SLOTS)].map(([k, v]) => h('option', { value: k, selected: k === (t.schedSlot || '') }, v)));
    const note = h('textarea', { id: 'bo-note', rows: 3, 'data-fk': 'e:note', placeholder: 'บันทึกภายใน (ลูกค้าไม่เห็น)' }, t.staffNote || '');
    const pref = t.prefDate ? h('div', { class: 'bo-pref' }, h('span', { id: 'bo-pref' }, `${t.schedDate ? '' : 'ยังไม่ได้นัด · '}ลูกค้าขอ ${thDay(t.prefDate)}${SLOTS[t.slot] ? ' ' + SLOTS[t.slot] : ''}${t.altDate ? ' · สำรอง ' + thDay(t.altDate) : ''}`),
      h('button', { type: 'button', class: 'bo-btn ghost sm', 'data-fk': 'e:pref', onclick: () => { sd.value = t.prefDate; if (SLOTS[t.slot]) sl.value = t.slot; mark(); sd.focus(); } }, 'ใช้วันที่ลูกค้าขอ')) : null;
    const save = h('button', { type: 'submit', class: 'bo-btn primary', 'data-fk': 'e:save' }, 'บันทึก');
    const ferr = h('p', { class: 'bo-err', role: 'alert' }, notes.get(ek) || '');
    const f = h('form', { class: 'bo-edit', novalidate: true }, restored.has(ek) ? h('p', { class: 'bo-note bo-restored' }, 'คืนข้อความที่พิมพ์ค้างไว้แล้ว — ตรวจแล้วกดบันทึก') : null,
      h('div', { class: 'bo-2' }, h('label', {}, 'สถานะ', st), h('label', {}, 'ทีม', team)), h('div', { class: 'bo-2' }, h('label', {}, 'วันนัด', sd), h('label', {}, 'ช่วงเวลา', sl)), pref,
      h('label', {}, 'บันทึกภายใน', note), save, ferr);
    const vals = () => ({ status: st.value, team: team.value, schedDate: sd.value, schedSlot: sl.value, staffNote: note.value });
    const diff = () => { const v = vals(), o = {}; for (const k of Object.keys(v)) if (v[k] !== cur[k]) o[k] = v[k]; return o; };
    // the confirmation message: copied from the saved appointment; offered only for a confirmed booking with a date
    const why = copyWhy(t), cwhy = h('p', { class: 'bo-note', id: 'bo-copy-why' });
    const copy = h('button', { type: 'button', class: 'bo-btn ghost', 'aria-describedby': 'bo-copy-why', onclick: async () => flash((await copyText(confirmText(t))) ? 'คัดลอกข้อความยืนยันนัดแล้ว' : 'คัดลอกไม่ได้') }, icon('copy', { size: 14 }), ' ข้อความยืนยันนัด (LINE / SMS)');
    function mark() {
      const n = Object.keys(diff()).length;
      if (n) { f.dataset.dirty = '1'; drafts.set(ek, vals()); } else { delete f.dataset.dirty; drafts.delete(ek); }
      const r = n ? 'บันทึกการแก้ไขก่อนคัดลอกข้อความ' : why; copy.disabled = !!r; cwhy.textContent = r; cwhy.hidden = !r;
    }
    const dr = drafts.get(ek); if (dr) { st.value = dr.status; team.value = dr.team; sd.value = dr.schedDate; sl.value = dr.schedSlot; note.value = dr.staffNote; }
    f.addEventListener('input', mark); f.addEventListener('change', mark); mark();
    f.addEventListener('submit', e => {
      e.preventDefault(); notes.delete(ek); ferr.textContent = '';
      const patch = diff();   // only what staff changed: saving a note never sets a date
      if (!Object.keys(patch).length) return flash('ไม่มีการเปลี่ยนแปลง');
      if (patch.status === 'cancelled') return cancelAsk(t, f, save, ferr, patch);
      saveTicket(t, patch, save, ferr);
    });
    let hist = []; try { hist = JSON.parse(t.history || '[]'); } catch (e) {}
    const histTh = x => [x.s ? String(x.s).split('→').map(k => STATUSES[k] || k).join(' → ') : '', x.team != null ? 'ทีม ' + (x.team || '-') : '', x.date != null ? 'วันนัด ' + (x.date ? thDay(x.date) : '-') : '', x.slot != null ? 'ช่วง ' + (SLOTS[x.slot] || '-') : '', x.note ? 'แก้บันทึกภายใน' : ''].filter(Boolean).join(' · ');
    const dl = (k, v) => v ? [h('dt', {}, k), h('dd', {}, v)] : [];
    const quote = t.quoteLines ? h('div', { class: 'bo-quote' }, h('pre', {}, t.quoteLines), +t.quoteTotalEx > 0 ? h('p', { class: 'bo-qtot' }, `รวมก่อน VAT ${thb(t.quoteTotalEx)}`) : null) : '';
    box.replaceChildren(h('div', { class: 'bo-card' },
      h('div', { class: 'bo-dh' }, h('h2', { tabindex: '-1', 'data-fk': 'dh' }, t.id), h('span', { class: 'bo-st st-' + t.status }, STATUSES[t.status] || t.status), h('button', { type: 'button', class: 'bo-btn ghost sm bo-back', onclick: () => back(t.id) }, 'กลับไปที่รายการ')),
      h('dl', { class: 'bo-dl' },
        ...dl('คำขอ', `${KINDS[t.kind] || t.kind}${t.service ? ' · ' + (SERVICES[t.service] || t.service) : ''}`), ...dl('รับเมื่อ', thDT(t.createdAt)),
        ...dl('ลูกค้า', `${t.name}${t.company ? ' · ' + t.company : ''}`), ...dl('โทร', h('a', { href: 'tel:' + String(t.tel).replace(/\D/g, '') }, telFmt(t.tel))), ...dl('อีเมล', t.email),
        ...dl('ใบกำกับภาษี', t.taxInvoice ? `${t.taxName || '-'} ${t.taxId || ''}` : ''), ...dl('จำนวนเครื่อง', units(t.units)), ...dl('ทีม-วัน (ประมาณ)', t.teamDays ? String(t.teamDays) : ''),
        ...dl('วันที่ลูกค้าขอ', t.prefDate ? `${thDay(t.prefDate)} ${SLOTS[t.slot] || ''}${t.altDate ? ' · สำรอง ' + thDay(t.altDate) : ''}` : ''),
        ...dl('ที่อยู่', [t.address, t.area].filter(Boolean).join(' · ')), ...dl('พื้นที่', t.zoneTier === 'extended' ? `นอกพื้นที่หลัก · ค่าเดินทาง ${+t.travelFee > 0 ? thb(t.travelFee) : '-'}` : t.zoneTier === 'out' ? 'เกินระยะรับงานรายเครื่อง' : ''),
        ...dl('อาคาร', [t.building, t.access].filter(Boolean).join(' · ')), ...dl('รายละเอียด', t.details), ...dl('หมายเหตุลูกค้า', t.notes),
        ...dl('ใบเสนอราคาเบื้องต้น', quote), ...dl('ที่มา', t.source)),
      f,
      h('div', { class: 'bo-act' }, copy), cwhy,
      hasPay() ? h('section', { class: 'bo-pay', 'aria-labelledby': 'bo-pay-h' }) : null,
      hist.length ? h('details', { class: 'bo-hist' }, h('summary', {}, `ประวัติ ${hist.length} รายการ`), h('ol', {}, hist.slice().reverse().map(x => h('li', {}, `${thDT(x.at)} · ${x.by}`, h('small', {}, histTh(x)))))) : null));
    if (hasPay()) payLoad(t, !quiet || pay.stale || pay.id !== t.id);
    if (!quiet) {
      // keyboard and screen readers land on the ticket; ≥1101 px it sits beside the list, narrower it follows the list
      $('h2', box).focus({ preventScroll: true }); say(`เปิด ${t.id} แล้ว`);
      if (matchMedia('(min-width: 1101px)').matches) $('.bo-side', main).scrollTop = 0;
      else box.scrollIntoView({ behavior: rm() ? 'auto' : 'smooth', block: 'start' });
    }
  }
  async function saveTicket(t, patch, save, ferr, msg) {
    const ek = t.id + ':edit';
    save.disabled = true; save.textContent = 'กำลังบันทึก…';
    try {
      const r = await api.update(t.id, patch, session.name); Object.assign(t, r.ticket); drafts.delete(ek); notes.delete(ek); restored.delete(ek);
      flash(msg || `บันทึก ${t.id} แล้ว`); board();
      const h2 = $('.bo-detail h2', main); if (h2) h2.focus();
    } catch (x) {
      if (x && x.code === 'unauthorized') return expired();
      save.disabled = false; save.textContent = 'บันทึก';
      notes.set(ek, `ยังไม่ได้บันทึก — ${errTh(x)} ลองอีกครั้ง`); ferr.textContent = notes.get(ek);   // stays next to the button until the next try
    }
  }
  // ยกเลิก (every role): confirmed in the page with a reason, which goes into the internal note; payment requests the customer
  // could still pay are voided first (admin / staff), so a cancelled job can never be paid
  async function cancelAsk(t, f, save, ferr, patch) {
    let d = pay.id === t.id ? pay.d : null;
    if (hasPay() && !d) {
      save.disabled = true;
      try { d = await api.payDetail(t.id); Object.assign(pay, { id: t.id, d, err: '', stale: false }); }
      catch (x) { if (x && x.code === 'unauthorized') return expired(); }
      save.disabled = false;
    }
    const open = d ? d.requests.filter(r => r.status === 'open') : [], P = d ? d.payments || [] : [];
    const voidable = open.filter(r => !(r.paid > 0) && !P.some(p => p.reqId === r.id && ['submitted', 'pending'].includes(p.status))), stuck = open.filter(r => !voidable.includes(r));
    const can = !!(d && d.can && d.can.request), left = r2(open.reduce((a, r) => a + r.amount - (r.paid || 0), 0)), refsOf = a => a.map(r => r.ref).join(', ');
    const why = h('input', { id: 'bo-cx-why', required: true, maxlength: 200, autocomplete: 'off', 'aria-describedby': 'bo-cx-err' });
    const vx = voidable.length && can ? h('input', { type: 'checkbox', id: 'bo-cx-void', checked: true }) : null;
    const cerr = h('p', { class: 'bo-err', role: 'alert', id: 'bo-cx-err' });
    why.addEventListener('input', () => { why.removeAttribute('aria-invalid'); cerr.textContent = ''; });
    const body = [h('label', {}, 'เหตุผลที่ยกเลิก (บันทึกในบันทึกภายใน)', why),
      vx ? h('label', { class: 'bo-check' }, vx, h('span', {}, `ยกเลิกรายการเรียกเก็บที่ยังเปิด (${refsOf(voidable)}) ด้วย — ลูกค้าจะชำระรายการนี้ไม่ได้อีก`)) : null,
      voidable.length && !can ? h('p', { class: 'bo-warn' }, `บัญชีนี้ยกเลิกรายการเรียกเก็บไม่ได้ — แจ้งสำนักงานให้ยกเลิกรายการ ${refsOf(voidable)}`) : null,
      stuck.length ? h('p', { class: 'bo-warn' }, `รายการ ${refsOf(stuck)} มียอดชำระหรือรอตรวจยอดแล้ว ยกเลิกรายการไม่ได้ ใช้การคืนเงินแทน`) : null, cerr];
    sure(f, `ยกเลิกคำขอ ${t.id} (${t.name})?${open.length ? ` มีรายการเรียกเก็บที่ยังเปิด ${thb(left)} — ลูกค้ายังชำระได้` : ''}`, async () => {
      const w = why.value.trim(); let n = 0;
      save.disabled = true;
      if (vx && vx.checked) for (const r of voidable) {
        const k = t.id + ':cx:' + r.id;
        try { const res = await api.payVoid(r.id, w, session.name, { rid: ridOf(k) }); rids.delete(k); n++; Object.assign(pay, { id: t.id, d: res, err: '', stale: false }); syncRow(t, res); }
        catch (x) {
          if (x && x.code === 'unauthorized') return expired();
          save.disabled = false; notes.set(t.id + ':edit', `ยังไม่ได้ยกเลิกคำขอ — ยกเลิกรายการเรียกเก็บ ${r.ref} ไม่สำเร็จ: ${errTh(x)}`); ferr.textContent = notes.get(t.id + ':edit');
          return payLoad(t, true);
        }
      }
      saveTicket(t, { ...patch, staffNote: [$('#bo-note', f).value.trim(), 'ยกเลิก: ' + w].filter(Boolean).join('\n') }, save, ferr, `ยกเลิกคำขอ ${t.id} แล้ว${n ? ` · ยกเลิกรายการเรียกเก็บ ${n} รายการ` : ''}`);
    }, { tone: 'danger', label: 'ยกเลิกคำขอนี้', returnTo: save, body, first: why, check: () => { if (why.value.trim()) return true; cerr.textContent = errTh('reason_required'); why.setAttribute('aria-invalid', 'true'); why.focus(); return false; } });
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
  function syncRow(t, d) { if (d.summary) t.pay = { ...(t.pay || {}), ...d.summary, unasked: d.suggested ? d.suggested.amount : 0 }; else delete t.pay; }
  // run one payment action: the server's reply (the new paydetail) is the only source of what is shown afterwards.
  // key = the form: its request id goes with the action, so a retry of an action that already reached the server is
  // answered with the stored reply; a timeout / dropped connection reloads the list before the button works again
  async function payAct(t, btn, err, run, ok, key) {
    const k = t.id + ':' + key;
    btn.disabled = true; err.textContent = ''; notes.delete(k);
    try {
      const r = await run(ridOf(k));
      Object.assign(pay, { id: t.id, d: r, err: '', stale: false }); syncRow(t, r); payOpen.delete(key); rids.delete(k); drafts.delete(k); restored.delete(k);
      flash(r.repeat ? 'รายการนี้บันทึกไว้แล้วตั้งแต่ครั้งก่อน ระบบไม่ได้บันทึกซ้ำ' : typeof ok === 'function' ? ok(r) : ok);
      // unsaved typing in the status / note form stays: then only the payment block is redrawn (table + tiles on the next refresh)
      if ($('.bo-edit[data-dirty]', main)) payRender(t); else board();
      const hd = $('#bo-pay-h', main); if (hd) hd.focus();
      if (r.repeat) payLoad(t, true);   // the stored reply is from the first try: show what is there now
    } catch (x) {
      if (x && x.code === 'unauthorized') return expired();
      if (x && (x.code === 'timeout' || x.code === 'network')) {
        const f = btn.closest('form'); if (f) drafts.set(k, formVals(f));   // exactly what was sent, whatever the reloaded defaults become
        notes.set(k, 'ไม่แน่ใจว่าบันทึกสำเร็จหรือไม่ — ตรวจรายการด้านล่างก่อนกดอีกครั้ง'); err.textContent = notes.get(k);
        await payLoad(t, true); if (sel !== t.id) return;
        payRender(t);
        const again = main.querySelector(`[data-fk="${CSS.escape('p:' + key)}"]`) || $('#bo-pay-h', main); if (again) again.focus();
        return;
      }
      btn.disabled = false; notes.set(k, errTh(x)); err.textContent = notes.get(k);   // stays next to the form (across redraws) until the next try
    }
  }
  const fold = (key, title, ...kids) => h('details', { class: 'bo-pf', open: payOpen.has(key), ontoggle: e => { e.currentTarget.open ? payOpen.add(key) : payOpen.delete(key); } }, h('summary', {}, title), ...kids);
  // money forms keep what staff typed across redraws (refresh, another action, an uncertain result) until their action succeeds;
  // a form counts as unsaved typing only while it differs from what it started with
  const formVals = f => Object.fromEntries($$('input[id], select[id], textarea[id]', f).map(e => [e.id, e.value]));
  const keep = (f, k) => {
    const init = JSON.stringify(formVals(f));
    const put = () => { const v = formVals(f); if (JSON.stringify(v) === init) { drafts.delete(k); delete f.dataset.dirty; } else { drafts.set(k, v); f.dataset.dirty = '1'; } };
    const d = drafts.get(k);
    if (d) { for (const [id, v] of Object.entries(d)) { const el = f.querySelector('#' + CSS.escape(id)); if (el) el.value = v; } if (JSON.stringify(formVals(f)) !== init) f.dataset.dirty = '1'; }   // a redraw never drops a draft
    if (d && restored.has(k)) f.prepend(h('p', { class: 'bo-note bo-restored' }, 'คืนข้อความที่พิมพ์ค้างไว้แล้ว — ตรวจยอดอีกครั้งก่อนกดปุ่ม'));
    f.addEventListener('input', put); f.addEventListener('change', put); return f;
  };
  const pform = (t, key, ...kids) => keep(dirty(h('form', { class: 'bo-pform', novalidate: true }, ...kids)), t.id + ':' + key);
  const ferrOf = (t, key) => h('p', { class: 'bo-err', role: 'alert' }, notes.get(t.id + ':' + key) || '');
  // in-page confirmation (no window.confirm: claude.ai artifact frames refuse it — the Rev.10 test site — and it is clearer anyway).
  // The question (with the amount) labels the group and describes the confirm button; Esc or ไม่ใช่ closes it and focus goes back
  // to the button that opened it. tone 'danger' (void / reject / refund / cancel): red confirm button, focus starts on ไม่ใช่.
  let sureN = 0;
  function sure(anchor, text, yes, o = {}) {
    const ret = o.returnTo || anchor;
    const old = anchor.parentNode.querySelector(':scope > .bo-sure');
    if (old) { const same = old._by === ret; old.remove(); if (same) { ret.focus(); return; } }
    const pid = 'bo-sure-' + (++sureN), danger = o.tone === 'danger';
    const box = h('div', { class: 'bo-sure' + (danger ? ' danger' : ''), role: 'group', 'aria-labelledby': pid }, h('p', { id: pid }, text), ...(o.body || []));
    const close = () => { box.remove(); ret.focus(); };
    const ok = h('button', { type: 'button', class: 'bo-btn sm bo-yes ' + (danger ? 'danger' : 'primary'), 'aria-describedby': pid, onclick: () => { if (o.check && !o.check()) return; box.remove(); yes(); } }, o.label || 'ยืนยัน');
    const no = h('button', { type: 'button', class: 'bo-btn sm', onclick: close }, 'ไม่ใช่');
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });
    box.append(h('div', { class: 'bo-act' }, ok, no)); box._by = ret;
    anchor.after(box); (o.first || (danger ? no : ok)).focus();
  }
  const bad = (err, el, msg) => { err.textContent = msg; el.setAttribute('aria-invalid', 'true'); el.focus(); };
  const meta = a => h('small', {}, a.filter(Boolean).join(' · '));

  function payRender(t) {
    const box = $('.bo-pay', main); if (!box) return;
    const d = pay.id === t.id ? pay.d : null, s = d && d.summary && { ...d.summary, unasked: d.suggested ? d.suggested.amount : 0 }, ps = payState(s);
    const top = h('div', { class: 'bo-ph' }, h('h3', { id: 'bo-pay-h', tabindex: '-1' }, 'การชำระเงิน'), ps ? h('span', { class: 'bo-ps ps-' + ps.k }, ps.th) : null);
    if (!d) return box.replaceChildren(top, ...(pay.err ? [h('p', { class: 'bo-err', role: 'alert' }, pay.err), h('button', { type: 'button', class: 'bo-btn ghost', onclick: () => payLoad(t, true) }, 'โหลดข้อมูลการชำระอีกครั้ง')] : [h('p', { class: 'bo-note' }, 'กำลังโหลดข้อมูลการชำระเงิน…')]));
    const K = d.kinds || {}, M = d.methods || {}, can = d.can || {}, lines = (d.quote && d.quote.lines) || [];
    // the server quote's totals next to the quote lines (VAT and the total when the customer asked for a tax invoice)
    const Q = d.quote, qt = $('.bo-qtot', main);
    if (qt && Q && Q.totals) qt.textContent = `รวมก่อน VAT ${thb(Q.totals.totalEx)}` + (Q.tax === 'invoice' ? ` · VAT 7% ${thb(Q.totals.vat)} · รวม ${thb(Q.totals.total)}` : '');
    // money summary
    const money = s ? h('div', { class: 'bo-money' }, [['ค้างชำระ', s.due], ['ได้รับแล้ว', s.paid], ['คืนแล้ว', s.refunded], ['ยังไม่เรียกเก็บ', ps && ps.k === 'asked' ? s.unasked : 0]].filter(([, v], i) => i < 2 || v > 0).map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, thb(v))))) : null;
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
      const key = 'pv:' + p.id, err = ferrOf(t, key);
      const vb = h('button', { type: 'button', class: 'bo-btn primary sm', 'data-fk': 'p:' + key, onclick: () => sure(vb.parentNode, `ยืนยันว่าพบยอด ${thb(p.amount)} ในบัญชีบริษัท / ได้รับเงินแล้ว? ระบบจะออกเลขที่ใบเสร็จ`, () => payAct(t, vb, err, rid => api.payVerify(p.id, 'verify', { staff: session.name, rid }), r => { const x = r.payments.find(y => y.id === p.id); return `ยืนยันได้รับเงิน ${thb(x ? x.amount : p.amount)} แล้ว${x && x.receiptNo ? ' · ใบเสร็จ ' + x.receiptNo : ''}`; }, key), { label: 'ยืนยันได้รับเงิน', returnTo: vb }) }, 'ยืนยันได้รับเงิน');
      const rb = h('button', { type: 'button', class: 'bo-btn sm danger-o', onclick: () => sure(vb.parentNode, `บันทึกว่าไม่พบยอด ${thb(p.amount)}? รายการนี้จะไม่นับเป็นยอดที่ได้รับ`, () => payAct(t, rb, err, rid => api.payVerify(p.id, 'reject', { staff: session.name, rid }), 'บันทึกว่าไม่พบยอดแล้ว', key), { tone: 'danger', label: 'บันทึกว่าไม่พบยอด', returnTo: rb }) }, 'ไม่พบยอด');
      return h('li', { 'data-pay': p.id }, h('div', { class: 'bo-rw' }, h('span', {}, `${p.methodTh || M[p.method] || p.method} `, h('b', {}, thb(p.amount))), h('span', { class: 'bo-ps pm-' + p.status }, p.statusTh || p.status)),
        p.receiptNo ? h('small', {}, 'เลขที่ใบเสร็จ ', h('b', { class: 'bo-rc' }, p.receiptNo)) : null,
        meta([p.reqId ? `รายการ ${refOf(p.reqId)}` : '', p.reference ? `อ้างอิง ${p.reference}` : '', `บันทึกโดย ${p.byWho} ${thDT(p.createdAt)}`, p.verifiedBy && p.status !== 'submitted' ? `ตรวจโดย ${p.verifiedBy}` : '']),
        p.note ? h('small', {}, p.note) : null,
        p.status !== 'submitted' ? null : can.verify ? h('div', { class: 'bo-act' }, vb, rb) : h('small', { class: 'bo-warn' }, 'รอสำนักงานตรวจยอด'), p.status === 'submitted' && can.verify ? err : null);
    };
    const refRow = f => h('li', {}, h('div', { class: 'bo-rw' }, h('span', {}, 'คืนเงิน ', h('b', {}, thb(f.amount))), h('span', { class: 'bo-ps ps-refunded' }, REFUND_TH[f.method] || f.method)),
      meta([f.reason, f.reference ? `อ้างอิง ${f.reference}` : '', `โดย ${f.byWho} ${thDT(f.createdAt)}`]));
    const list = (a, row, none) => a.length ? h('ul', { class: 'bo-rows' }, a.map(row)) : h('p', { class: 'bo-note' }, none);
    const net = s ? r2(s.paid - s.refunded) : 0;
    box.replaceChildren(...[top, money, pend, check, sug,
      h('div', { class: 'bo-pg' }, h('h4', {}, 'รายการเรียกเก็บ'), list(d.requests, reqRow, 'ยังไม่มีรายการเรียกเก็บ'), can.request && t.status !== 'cancelled' ? reqForm(t, d) : null),
      h('div', { class: 'bo-pg' }, h('h4', {}, 'รับเงิน'), list(d.payments, payRow, 'ยังไม่มีการรับเงิน'), recForm(t, d)),
      d.refunds.length || (can.refund && net > 0) ? h('div', { class: 'bo-pg' }, h('h4', {}, 'คืนเงิน'), d.refunds.length ? list(d.refunds, refRow, '') : null, can.refund && net > 0 ? refundForm(t, d, net) : null) : null].filter(Boolean));
  }
  // ask the customer for money: full = the server's own figure (basis: server quote) when it has one; มัดจำ / ส่วนที่เหลือ /
  // งานเพิ่ม = an amount staff agreed with the customer (the field starts empty and the typed amount is always sent)
  function reqForm(t, d) {
    const sg = d.suggested, asked = d.summary ? d.summary.asked : 0, KT = d.kinds || {};
    const kind = h('select', { id: 'bo-pr-kind' }, Object.entries(KT).map(([k, v]) => h('option', { value: k, selected: k === 'full' }, v)));
    const amt = h('input', { id: 'bo-pr-amt', inputmode: 'decimal', autocomplete: 'off', required: !sg, value: sg ? String(sg.amount) : '', 'aria-describedby': 'bo-pr-hint' });
    const note = h('input', { id: 'bo-pr-note', maxlength: 400, autocomplete: 'off' });
    const hint = h('p', { class: 'bo-note', id: 'bo-pr-hint' });
    const err = ferrOf(t, 'req'), go = h('button', { type: 'submit', class: 'bo-btn primary', 'data-fk': 'p:req' }, 'สร้างรายการเรียกเก็บ');
    const f = pform(t, 'req', h('div', { class: 'bo-2' }, h('label', {}, 'ประเภท', kind), h('label', {}, 'จำนวนเงิน (บาท)', amt)), hint,
      h('label', {}, 'หมายเหตุภายใน (ลูกค้าไม่เห็น)', note), err, go, h('p', { class: 'bo-note' }, 'ลูกค้าดูยอดและวิธีชำระได้ในหน้าติดตามสถานะ ด้วยเลขที่คำขอและเบอร์โทร'));
    const full = () => kind.value === 'full';
    const setKind = reset => {
      if (reset) amt.value = full() && sg ? String(sg.amount) : '';
      amt.required = !full() || !sg;
      hint.textContent = full() ? (sg ? 'ตั้งต้นเป็นยอดที่ระบบคำนวณจากราคาในระบบ แก้ได้เมื่อยืนยันยอดอื่นกับลูกค้าแล้ว' : 'ระบบคำนวณยอดให้ไม่ได้ ใส่ยอดที่ยืนยันกับลูกค้าแล้ว')
        : `ใส่ยอด${KT[kind.value] || ''}ที่ตกลงกับลูกค้า` + (sg ? ` (ยอดเต็มตามราคาในระบบ ${thb(sg.amount + asked)} · เรียกเก็บแล้ว ${thb(asked)})` : '');
    };
    kind.addEventListener('change', () => { setKind(true); amt.removeAttribute('aria-invalid'); err.textContent = ''; });
    setKind(false);
    f.addEventListener('submit', e => {
      e.preventDefault(); amt.removeAttribute('aria-invalid'); const a = cleanAmt(amt.value);
      if (!a && (!sg || !full())) return bad(err, amt, full() ? 'กรุณาใส่จำนวนเงินที่ยืนยันกับลูกค้าแล้ว' : `กรุณาใส่จำนวนเงิน${KT[kind.value] || ''}ที่ตกลงกับลูกค้า`);
      if (a && !amtOk(a)) return bad(err, amt, errTh('bad_amount'));
      const o = { kind: kind.value, note: note.value.trim(), staff: session.name };
      if (a && !(full() && sg && +a === sg.amount)) o.amount = a;   // the unchanged full suggestion → the server fills it in itself (basis: server quote)
      payAct(t, go, err, rid => api.payRequest(t.id, { ...o, rid }), r => { const x = r.requests.find(y => y.id === r.created); return x ? `สร้างรายการเรียกเก็บ ${thb(x.amount)} (รหัสอ้างอิง ${x.ref}) แล้ว` : 'สร้างรายการเรียกเก็บแล้ว'; }, 'req');
    });
    return fold('req', 'สร้างรายการเรียกเก็บเงิน', f);
  }
  function voidForm(t, r) {
    const key = 'void:' + r.id, why = h('input', { id: 'bo-pv-' + r.id, required: true, maxlength: 200, autocomplete: 'off' });
    const err = ferrOf(t, key), go = h('button', { type: 'submit', class: 'bo-btn sm danger-o', 'data-fk': 'p:' + key }, 'ยกเลิกรายการเรียกเก็บ');
    const f = pform(t, key, h('label', {}, 'เหตุผลที่ยกเลิก', why), err, go);
    f.addEventListener('submit', e => {
      e.preventDefault(); why.removeAttribute('aria-invalid'); const w = why.value.trim();
      if (!w) return bad(err, why, errTh('reason_required'));
      sure(go, `ยกเลิกรายการเรียกเก็บ ${r.ref} (${thb(r.amount)})? ลูกค้าจะชำระรายการนี้ไม่ได้อีก`, () => payAct(t, go, err, rid => api.payVoid(r.id, w, session.name, { rid }), `ยกเลิกรายการ ${r.ref} แล้ว`, key), { tone: 'danger', label: 'ยกเลิกรายการเรียกเก็บ' });
    });
    return fold(key, 'ยกเลิกรายการนี้', f);
  }
  // money received on site / by transfer: admin & staff → verified with a receipt number at once, so it is confirmed in the
  // page first (method, amount, request, what is left; a red warning when it is more than what is left); tech → waits for the office
  function recForm(t, d) {
    const open = d.requests.filter(r => r.status === 'open'), left = r => r2(r.amount - (r.paid || 0)), tech = !(d.can || {}).verify, M = d.methods || {};
    const method = h('select', { id: 'bo-pm-method' }, Object.entries(M).filter(([k]) => k !== 'gateway').map(([k, v]) => h('option', { value: k, selected: k === 'cash' }, v)));
    const req = h('select', { id: 'bo-pm-req' }, h('option', { value: '' }, '— ไม่ผูกกับรายการเรียกเก็บ —'), open.map((r, i) => h('option', { value: r.id, selected: i === 0 }, `${r.ref} · ${(d.kinds || {})[r.kind] || r.kind} · คงเหลือ ${thb(left(r))}`)));
    const amt = h('input', { id: 'bo-pm-amt', inputmode: 'decimal', autocomplete: 'off', required: true, value: open[0] ? String(left(open[0])) : '', 'aria-describedby': 'bo-pm-over' });
    let auto = amt.value;
    const ref = h('input', { id: 'bo-pm-ref', maxlength: 120, autocomplete: 'off', placeholder: 'เลขที่สลิป / เลขที่เช็ค' });
    const note = h('input', { id: 'bo-pm-note', maxlength: 400, autocomplete: 'off' });
    const over = h('p', { class: 'bo-warn', id: 'bo-pm-over', hidden: true });
    const err = ferrOf(t, 'rec'), go = h('button', { type: 'submit', class: 'bo-btn primary', 'data-fk': 'p:rec' }, 'บันทึกรับเงิน');
    const f = pform(t, 'rec', h('div', { class: 'bo-2' }, h('label', {}, 'ช่องทาง', method), h('label', {}, 'จำนวนเงิน (บาท)', amt)), over, h('label', {}, 'สำหรับรายการเรียกเก็บ', req),
      h('div', { class: 'bo-2' }, h('label', {}, 'เลขอ้างอิง', ref), h('label', {}, 'หมายเหตุ', note)),
      h('p', { class: tech ? 'bo-warn' : 'bo-note' }, tech ? 'บัญชีช่าง: ยอดที่บันทึกจะรอสำนักงานตรวจยอดก่อน จึงจะนับเป็นยอดที่ได้รับและออกเลขที่ใบเสร็จ' : 'บันทึกเมื่อได้รับเงินจริงแล้วเท่านั้น ระบบจะนับเป็นยอดที่ได้รับและออกเลขที่ใบเสร็จทันที'), err, go);
    // what is still owed for the chosen request (no request: what the ticket owes) and how far the typed amount goes over it
    const linked = () => open.find(x => x.id === req.value), rest = () => { const r = linked(); return r ? left(r) : d.summary ? r2(d.summary.due) : 0; };
    const excess = () => { const a = cleanAmt(amt.value), m = rest(); return amtOk(a) && (linked() || m > 0) && +a > m ? r2(+a - m) : 0; };
    const showOver = () => { const x = excess(); over.hidden = !x; over.textContent = x ? `มากกว่ายอดคงเหลือ ${thb(x)} (คงเหลือ ${thb(rest())})` : ''; };
    req.addEventListener('change', () => { const r = linked(); if (cleanAmt(amt.value) === auto) amt.value = auto = r ? String(left(r)) : ''; showOver(); });
    amt.addEventListener('input', showOver); showOver();
    f.addEventListener('submit', e => {
      e.preventDefault(); amt.removeAttribute('aria-invalid'); const a = cleanAmt(amt.value);
      if (!amtOk(a)) return bad(err, amt, a ? errTh('bad_amount') : 'กรุณาใส่จำนวนเงินที่ได้รับ');
      const before = new Set(d.payments.map(p => p.id)), r = linked(), x = excess();
      const send = () => payAct(t, go, err, rid => api.payRecord(t.id, { method: method.value, amount: a, req: req.value || undefined, reference: ref.value.trim(), note: note.value.trim(), staff: session.name, rid }),
        res => { const p = res.payments.find(y => y.id === res.created) || res.payments.find(y => !before.has(y.id)); return p && p.receiptNo ? `บันทึกรับเงิน ${thb(p.amount)} แล้ว · ใบเสร็จ ${p.receiptNo}` : `บันทึก ${thb(+a)} แล้ว รอสำนักงานตรวจยอด`; }, 'rec');
      if (tech) return send();   // a technician's entry is only "submitted": the office checks it before it counts
      sure(go, `บันทึกรับเงิน ${thb(+a)} · ${M[method.value] || method.value} · ${r ? `รายการ ${r.ref} (คงเหลือ ${thb(left(r))})` : 'ไม่ผูกกับรายการเรียกเก็บ'}${x ? ` — มากกว่ายอดคงเหลือ ${thb(x)}` : ''}? ระบบจะออกเลขที่ใบเสร็จทันที บันทึกแล้วแก้ไขหรือลบไม่ได้`,
        send, { tone: x ? 'danger' : '', label: 'บันทึกรับเงิน' });
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
    const err = ferrOf(t, 'refund'), go = h('button', { type: 'submit', class: 'bo-btn danger-o', 'data-fk': 'p:refund' }, 'บันทึกการคืนเงิน');
    const f = pform(t, 'refund', h('div', { class: 'bo-2' }, h('label', {}, 'จำนวนเงิน (บาท)', amt), h('label', {}, 'คืนทาง', method)), h('p', { class: 'bo-note', id: 'bo-rf-hint' }, `คืนได้ไม่เกิน ${thb(net)} (ยอดที่ได้รับสุทธิ) · บันทึกหลังคืนเงินให้ลูกค้าแล้วเท่านั้น`),
      h('label', {}, 'คืนจากการชำระ', pm), h('div', { class: 'bo-2' }, h('label', {}, 'เลขอ้างอิง', ref), h('label', {}, 'เหตุผล', why)), err, go);
    f.addEventListener('submit', e => {
      e.preventDefault(); amt.removeAttribute('aria-invalid'); why.removeAttribute('aria-invalid'); const a = cleanAmt(amt.value), w = why.value.trim();
      if (!amtOk(a)) return bad(err, amt, a ? errTh('bad_amount') : 'กรุณาใส่จำนวนเงินที่คืน');
      if (+a > net) return bad(err, amt, errTh('refund_too_large'));
      if (!w) return bad(err, why, errTh('reason_required'));
      sure(go, `บันทึกการคืนเงิน ${thb(+a)} ให้ ${t.name}? บันทึกแล้วแก้ไขหรือลบไม่ได้`, () => payAct(t, go, err, rid => api.refund(t.id, { amount: a, method: method.value, payment: pm.value || undefined, reference: ref.value.trim(), reason: w, staff: session.name, rid }), `บันทึกการคืนเงิน ${thb(+a)} แล้ว`, 'refund'), { tone: 'danger', label: 'บันทึกการคืนเงิน' });
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
