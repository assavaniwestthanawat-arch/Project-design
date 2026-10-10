// SBP AirCare server — ticket API: the Apps Script contract (backoffice/apps-script/Code.gs) on SQLite. Rev.10.
// Same actions, request fields, response keys, status/kind/service/slot keys, ID format and error codes, so every
// page and the staff board keep working unchanged (assets/ticket.js, contact.js, booking.js, backoffice-board.js).
// Deliberate fixes over Code.gs (no client depends on the old behaviour):
//   · own-property lookups (prototype keys like "constructor" are no longer a valid kind/status)
//   · real calendar dates, preferred date at most a year ahead
//   · the daily sequence never wraps (…-999 → …-1000) and a failed insert never burns a number (one transaction)
//   · server errors never echo internal messages; quote figures are recomputed on the server (pricing.mjs)
//   · fixed-window limits per phone, per IP and site-wide (anonymous feedback is limited per IP, not one shared bucket),
//     plus limits on track and on failed staff logins
//   · idempotent create: the same request id (ticket.rid) from the same phone returns the ticket already stored
//   · consent is recorded with the text the customer agreed to and the time (PDPA)
import { tx, sheetRow, audit, HEADERS } from './db.mjs';
import { str, digits, own, isDate, now, today, addDays, beYear, MAX, sha256, nowMs } from './util.mjs';
import { recompute, quoteLinesText } from './pricing.mjs';

export const KINDS = { booking: 'จองคิว', quote: 'ขอใบเสนอราคา', inquiry: 'ติดต่อ / สอบถาม', feedback: 'ความเห็นเว็บไซต์' };
export const SERVICES = { clean: 'ล้างแอร์', install: 'ติดตั้งแอร์', repair: 'ตรวจเช็ก / ซ่อม', move: 'ย้ายแอร์', amc: 'สำรวจสัญญาล้างรายปี', project: 'สำรวจงานโครงการ / รีโนเวต', buy: 'ซื้อแอร์', other: 'อื่น ๆ' };
export const STATUSES = { new: 'รับคำขอแล้ว รอยืนยัน', need_info: 'รอข้อมูลเพิ่มจากลูกค้า', confirmed: 'ยืนยันนัดแล้ว', assigned: 'จัดทีมแล้ว', in_progress: 'กำลังดำเนินการ', done: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
export const SLOTS = { AM: 'ช่วงเช้า', PM: 'ช่วงบ่าย', EVE: 'นอกเวลาทำการ' };
export const ACTIVE = ['new', 'need_info', 'confirmed', 'assigned', 'in_progress'];
// the consent sentence the forms show (assets/contact.js CONSENT_TH) — stored with each ticket when the browser does not send its own copy
export const CONSENT_DEFAULT = 'ยินยอมให้ บริษัท สหบูรพากรุ๊ป จำกัด ใช้ชื่อ เบอร์โทร อีเมล และที่อยู่ที่กรอก เพื่อติดต่อกลับ นัดหมาย เสนอราคา และให้บริการตามคำขอนี้เท่านั้น';

const fail = error => ({ ok: false, error });
const DAY = 864e5;

function nextId(db) {
  // SBP-<พ.ศ. 2 หลัก><เดือน><วัน>-<ลำดับในวัน> e.g. SBP-691009-007 — Thai Buddhist year, like the company's documents
  const t = today(), md = t.slice(5, 7) + t.slice(8, 10), y = beYear(), k = 'T' + y + md;
  const n = db.prepare(`INSERT INTO seq (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`).get(k).n;
  return 'SBP-' + String(y).slice(-2) + md + '-' + String(n).padStart(3, '0');
}

export function summary(o) {
  return [KINDS[o.kind] + (o.service ? ' · ' + (SERVICES[o.service] || o.service) : '') + ' · ' + o.id,
    'ลูกค้า: ' + o.name + (o.company ? ' (' + o.company + ')' : '') + ' · โทร ' + o.tel + (o.email ? ' · ' + o.email : ''),
    o.prefDate ? 'วันที่ต้องการ: ' + o.prefDate + ' ' + (SLOTS[o.slot] || '') + (o.altDate ? ' · สำรอง ' + o.altDate : '') : '',
    o.units ? 'จำนวนเครื่อง: ' + o.units : '', o.address || o.area ? 'สถานที่: ' + [o.address, o.area].filter(String).join(' · ') : '',
    o.quoteLines ? 'รายการจากใบเสนอราคาเบื้องต้น:\n' + o.quoteLines + (o.quoteTotalEx !== '' && o.quoteTotalEx != null ? '\nรวมก่อน VAT ' + o.quoteTotalEx : '') : '',
    o.details ? 'รายละเอียด: ' + o.details : '', o.notes ? 'หมายเหตุ: ' + o.notes : '', o.taxInvoice ? 'ต้องการใบกำกับภาษี: ' + (o.taxName || '-') + ' ' + (o.taxId || '') : '',
    'ที่มา: ' + (o.source || '-')].filter(String).join('\n');
}

/* ---------------- public: create ---------------- */
export function create(ctx, t, req) {
  const { db, cfg, rl } = ctx;
  if (!t || typeof t !== 'object' || Array.isArray(t)) t = {};
  if (str(t.website)) return fail('rejected');                                           // honeypot (hidden field humans never fill)
  const kind = own(KINDS, t.kind) ? t.kind : null; if (!kind) return fail('bad_kind');
  const c = t.customer && typeof t.customer === 'object' ? t.customer : {}, s = t.site && typeof t.site === 'object' ? t.site : {};
  const q = t.quote && typeof t.quote === 'object' ? t.quote : null;
  const tel = digits(c.tel), fb = kind === 'feedback';                                   // website feedback may stay anonymous
  if (!(fb && !tel) && !/^0\d{8,9}$/.test(tel)) return fail('bad_tel');
  const name = str(c.name) || (fb ? 'ไม่ระบุชื่อ' : ''); if (!name) return fail('bad_name');
  if (kind !== 'feedback' && t.consent !== true) return fail('no_consent');
  const email = str(c.email, MAX.short); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('bad_email');
  const pref = str(t.prefDate, 10); let alt = str(t.altDate, 10);
  if (pref && (!isDate(pref) || pref < today() || pref > addDays(today(), 366))) return fail('bad_date');
  if (alt && !isDate(alt)) alt = '';
  const slot = own(SLOTS, t.slot) ? t.slot : '';
  if (q && q.lines != null && !Array.isArray(q.lines)) return fail('bad_json');
  const rid = typeof t.rid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(t.rid) ? t.rid : '';   // ['abc…'] stringifies to a match but cannot be bound
  // idempotent retry (the browser timed out after the server had already stored the ticket): same rid + same phone
  if (rid) {
    const prev = db.prepare(`SELECT id, status FROM tickets WHERE rid = ? AND tel = ? AND createdAt >= ?`).get(rid, tel, now(nowMs() - DAY));
    if (prev) return { ok: true, id: prev.id, status: prev.status, statusTh: STATUSES[prev.status] || prev.status, repeat: true };
  }
  const ip = req && req.ip || '';
  if (!rl.hit('create:all', cfg.limits.createGlobal, 10 * 60e3) || !rl.hit('create:ip:' + ip, cfg.limits.createPerIp, 10 * 60e3)
    || !rl.hit('create:tel:' + (tel || 'anon:' + ip), cfg.limits.createPerTel, 3600e3)) return fail('rate_limited');

  const units = {}; let total = 0;
  if (t.units && typeof t.units === 'object') for (const k of Object.keys(t.units)) { const n = Math.max(0, Math.min(999, Math.floor(+t.units[k] || 0))); if (n && /^[a-z]{2,10}$/.test(k)) { units[k] = n; total += n; } }
  const rq = q ? recompute(q, str(s.area)) : null;
  const o = {
    createdAt: now(), status: 'new', kind, service: own(SERVICES, t.service) ? t.service : (kind === 'booking' ? 'other' : ''),
    units: total ? JSON.stringify(units) : '', teamDays: +t.teamDays > 0 ? Math.min(999, Math.round(+t.teamDays * 10) / 10) : null,
    prefDate: pref, slot, altDate: alt, name, tel, email, company: str(c.company),
    taxInvoice: c.taxInvoice ? 'ใช่' : '', taxName: str(c.taxName, MAX.mid), taxId: digits(c.taxId).slice(0, 13),
    address: str(s.address, MAX.mid), area: str(s.area), zoneTier: rq && rq.zone ? rq.zone.tier : str(s.zoneTier, 20),
    // travel and totals are the SERVER's figures (Code.gs stored whatever the browser sent)
    travelFee: rq ? (rq.totals.travel > 0 ? rq.totals.travel : null) : (+s.travelFee > 0 ? Math.min(1e6, +s.travelFee) : null),
    building: str(s.building), access: str(s.access, MAX.mid),
    quoteTotalEx: rq ? (rq.totals.totalEx > 0 ? rq.totals.totalEx : null) : null,
    quoteLines: rq ? str(quoteLinesText(rq), MAX.long) : '',
    details: str(t.details, MAX.long), notes: str(t.notes, MAX.long), source: str(t.source, MAX.mid),
    team: '', schedDate: '', schedSlot: '', staffNote: '', updatedAt: '',
    history: JSON.stringify([{ at: now(), by: 'เว็บไซต์', s: 'new' }]),
    payload: str(JSON.stringify(t), MAX.payload),
    quoteJson: rq ? JSON.stringify(rq) : '', priceCheck: rq ? JSON.stringify({ verified: rq.verified, match: rq.match, payable: rq.payable, issues: rq.issues.slice(0, 20) }) : '',
    consentText: kind !== 'feedback' ? str(t.consentText, 600) || CONSENT_DEFAULT : '', consentAt: kind !== 'feedback' ? now() : '',
    rid, ipHash: ip ? sha256('ip:' + ip).slice(0, 16) : '',
  };
  const cols = [...HEADERS, 'quoteJson', 'priceCheck', 'consentText', 'consentAt', 'rid', 'ipHash'];
  tx(db, () => {
    o.id = nextId(db);
    db.prepare(`INSERT INTO tickets (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...cols.map(k => (o[k] === undefined ? '' : o[k])));
  });
  ctx.notifyCreated && ctx.notifyCreated(o);
  return { ok: true, id: o.id, status: o.status, statusTh: STATUSES[o.status] };
}

/* ---------------- public: track + slots ---------------- */
export function findByIdTel(db, id, tel) {
  const o = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(str(id, 40));
  const d = digits(tel);
  if (!o || !d || !o.tel || o.tel.replace(/^0/, '') !== d.replace(/^0/, '')) return null;   // anonymous feedback (no phone) is never trackable
  return o;
}
export function track(ctx, id, tel, req) {
  if (!ctx.rl.hit('track:ip:' + (req && req.ip || ''), ctx.cfg.limits.trackPerIp, 10 * 60e3)) return fail('rate_limited');
  const o = findByIdTel(ctx.db, id, tel);
  if (!o) return fail('not_found');
  const ticket = { id: o.id, status: o.status, statusTh: STATUSES[o.status] || o.status, kind: o.kind, service: o.service, prefDate: o.prefDate, slot: o.slot, schedDate: o.schedDate, schedSlot: o.schedSlot, team: o.team ? 'จัดทีมแล้ว' : '' };
  const payment = ctx.payments ? ctx.payments.publicView(o) : null;
  if (payment) ticket.payment = payment;
  return { ok: true, ticket };
}
export function slots(ctx, from, days) {
  const { db, cfg } = ctx;
  from = isDate(from) ? from : today(); days = Math.max(1, Math.min(31, Math.floor(+days) || 14));
  const map = {}, out = [];
  for (let i = 0; i < days; i++) { const k = addDays(from, i); map[k] = { date: k, AM: 0, PM: 0, EVE: 0 }; out.push(map[k]); }
  const to = addDays(from, days);
  const rows = db.prepare(`SELECT schedDate, prefDate, schedSlot, slot FROM tickets WHERE kind = 'booking' AND status IN (${ACTIVE.map(() => '?').join(',')})
    AND ((schedDate <> '' AND schedDate >= ? AND schedDate < ?) OR (schedDate = '' AND prefDate >= ? AND prefDate < ?))`).all(...ACTIVE, from, to, from, to);
  for (const o of rows) { const d = o.schedDate || o.prefDate, s = o.schedSlot || o.slot; if (map[d] && own(SLOTS, s)) map[d][s]++; }
  return { ok: true, capacity: cfg.slotCapacity, days: out };
}

/* ---------------- staff: list + update ---------------- */
export function list(ctx, b) {
  const { db, cfg } = ctx;
  const where = [], args = [];
  if (b.status && own(STATUSES, b.status)) { where.push('status = ?'); args.push(b.status); }
  if (b.since && typeof b.since === 'string') { where.push('createdAt >= ?'); args.push(str(b.since, 19)); }
  const limit = Math.max(1, Math.min(2000, Math.floor(+b.limit) || 500));
  const rows = db.prepare(`SELECT * FROM tickets ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY createdAt DESC, id DESC LIMIT ?`).all(...args, limit);
  const sums = ctx.payments ? ctx.payments.summaries(rows.map(r => r.id)) : {};
  return {
    ok: true, tickets: rows.map(r => { const x = sheetRow(r); x.priceCheck = r.priceCheck ? JSON.parse(r.priceCheck) : null; if (sums[r.id]) x.pay = sums[r.id]; return x; }),
    teams: cfg.teams, statuses: STATUSES, slots: SLOTS, capacity: cfg.slotCapacity,
  };
}
export function update(ctx, id, patch, staff) {
  const { db, cfg } = ctx;
  patch = patch && typeof patch === 'object' ? patch : {};
  let out, o;
  tx(db, () => {
    o = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(str(id, 40));
    if (!o) { out = fail('not_found'); return; }
    const ch = {};
    if (patch.status != null) { if (!own(STATUSES, patch.status)) { out = fail('bad_status'); return; } if (patch.status !== o.status) ch.s = o.status + '→' + patch.status; o.status = patch.status; }
    if (patch.team != null) { const t = str(patch.team); if (t && !cfg.teams.includes(t)) { out = fail('bad_team'); return; } if (t !== o.team) ch.team = t; o.team = t; }
    if (patch.schedDate != null) { const d = str(patch.schedDate, 10); if (d && !isDate(d)) { out = fail('bad_date'); return; } if (d !== o.schedDate) ch.date = d; o.schedDate = d; }
    if (patch.schedSlot != null) { const sl = own(SLOTS, patch.schedSlot) ? patch.schedSlot : ''; if (sl !== o.schedSlot) ch.slot = sl; o.schedSlot = sl; }
    if (patch.staffNote != null) { const n = str(patch.staffNote, MAX.long); if (n !== o.staffNote) ch.note = 1; o.staffNote = n; }
    let h = []; try { h = JSON.parse(o.history || '[]'); } catch (e) {}
    const changed = Object.keys(ch).length > 0;
    if (changed) { ch.at = now(); ch.by = staff.name; h.push(ch); }
    o.history = JSON.stringify(h.slice(-50)); o.updatedAt = changed ? now() : (o.updatedAt || now());
    db.prepare(`UPDATE tickets SET status = ?, team = ?, schedDate = ?, schedSlot = ?, staffNote = ?, history = ?, updatedAt = ? WHERE id = ?`)
      .run(o.status, o.team, o.schedDate, o.schedSlot, o.staffNote, o.history, o.updatedAt, o.id);
    if (changed) { audit(db, staff.name, 'ticket.update', o.id, ch); out = { ok: true, ch }; }
    else out = { ok: true, ch: null };
  });
  if (!out.ok) return out;
  if (out.ch && ctx.notifyUpdated) ctx.notifyUpdated(o, out.ch);
  const x = sheetRow(o); x.priceCheck = o.priceCheck ? JSON.parse(o.priceCheck) : null;
  if (ctx.payments) { const s = ctx.payments.summaries([o.id])[o.id]; if (s) x.pay = s; }
  return { ok: true, ticket: x };
}
