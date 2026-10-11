// SBP AirCare — back office for the TEST site on Claude (Rev.10, owner 10 ต.ค. 2569: no domain / server yet, the team tests on
// a claude.ai Artifact). handle(body) takes exactly the request bodies assets/ticket.js sends and resolves the SAME replies as the
// production server (server/API.md · tickets.mjs · payments.mjs · staff.mjs), or rejects {code} with the server's error codes —
// stored in the artifact's shared `db` capability instead of SQLite. Quotes are re-priced by the server's own pricing.mjs and the
// PromptPay QR comes from the server's promptpay.mjs (both bundled into the page). TEST ONLY:
//   · fixed test accounts admin / staff / tech, one password (TEST_PASSWORD) — the page source is readable by every viewer
//   · PromptPay 0000000000000 and bank account 000-0-00000-0 are placeholders no bank accepts; money replies carry test:true
//   · nothing is e-mailed or sent to LINE (there is no mail) and no reply says so (CLAUDE.md §6.6 #23)
//   · everyone who can open the artifact can read the store: test data only, never real customers
// Data model (amounts in satang inside the store, baht in every reply, like the server):
//   tickets/<id>      the sheet row (server/db.mjs HEADERS, no payload) + quote (server recompute) + priceCheck + consent +
//                     reqs[] / pays[] / refs[] (payreq / payments / refunds rows) + reqIds[] / payIds[] / receiptNos[] for lookups
//   counters/ticket   {k:'T<พ.ศ.><MMDD>', n}  ·  counters/receipt {k:'R<พ.ศ.><MM>', n}  — taken under an acquire() lease
//   sessions/<sha-256 of the token>  {user, createdAt, expiresMs}  — 12-hour staff sessions (role comes from TEST_ACCOUNTS)
// Every read-modify-write of a ticket holds that document's lease (other tabs wait) and runs one at a time in this tab.
// No db in this view (signed out / not granted / not served / revoked) → reject {code:'not_connected'}: the page shows its honest
// hand-off. Published with db rules [{path:'', read:'interact', write:'interact'}]: a viewer below Contributor (user.can('data.write')
// === false) gets {code:'read_only'} for every action; when can() says nothing, a well-formed write the store refuses → 'read_only'.
import * as core from './sbp-core.js';
import { initPricing, recompute, quoteLinesText } from '../server/pricing.mjs';
import { promptpayPayload, qrDataUrl, maskId } from '../server/promptpay.mjs';

// ---- the server's vocabulary (kept equal to server/*.mjs by tests/artifact-api.mjs) ----
export const KINDS = { booking: 'จองคิว', quote: 'ขอใบเสนอราคา', inquiry: 'ติดต่อ / สอบถาม', feedback: 'ความเห็นเว็บไซต์' };
export const SERVICES = { clean: 'ล้างแอร์', install: 'ติดตั้งแอร์', repair: 'ตรวจเช็ก / ซ่อม', move: 'ย้ายแอร์', amc: 'สำรวจสัญญาล้างรายปี', project: 'สำรวจงานโครงการ / รีโนเวต', buy: 'ซื้อแอร์', other: 'อื่น ๆ' };
export const STATUSES = { new: 'รับคำขอแล้ว รอยืนยัน', need_info: 'รอข้อมูลเพิ่มจากลูกค้า', confirmed: 'ยืนยันนัดแล้ว', assigned: 'จัดทีมแล้ว', in_progress: 'กำลังดำเนินการ', done: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
export const SLOTS = { AM: 'ช่วงเช้า', PM: 'ช่วงบ่าย', EVE: 'นอกเวลาทำการ' };
export const ACTIVE = ['new', 'need_info', 'confirmed', 'assigned', 'in_progress'];
export const CONSENT_DEFAULT = 'ยินยอมให้ บริษัท สหบูรพากรุ๊ป จำกัด ใช้ชื่อ เบอร์โทร อีเมล และที่อยู่ที่กรอก เพื่อติดต่อกลับ นัดหมาย เสนอราคา และให้บริการตามคำขอนี้เท่านั้น';
export const HEADERS = ['id', 'createdAt', 'status', 'kind', 'service', 'units', 'teamDays', 'prefDate', 'slot', 'altDate', 'name', 'tel', 'email', 'company',
  'taxInvoice', 'taxName', 'taxId', 'address', 'area', 'zoneTier', 'travelFee', 'building', 'access', 'quoteTotalEx', 'quoteLines', 'details', 'notes',
  'source', 'team', 'schedDate', 'schedSlot', 'staffNote', 'updatedAt', 'history', 'payload'];
export const ROLES = { admin: 'ผู้ดูแล', staff: 'เจ้าหน้าที่', tech: 'ช่าง' };
export const REQ_KINDS = { full: 'ชำระเต็มจำนวน', deposit: 'มัดจำ', balance: 'ส่วนที่เหลือ', extra: 'งานเพิ่มหน้างาน' };
export const REQ_STATUS = { open: 'รอชำระ', paid: 'ชำระแล้ว', void: 'ยกเลิกรายการ', expired: 'หมดอายุ' };
export const PAY_METHODS = { promptpay: 'พร้อมเพย์ (QR)', transfer: 'โอนเข้าบัญชีบริษัท', cash: 'เงินสด (หน้างาน)', edc: 'บัตร (เครื่องรูดหน้างาน)', cheque: 'เช็ค', gateway: 'ชำระออนไลน์ผ่านผู้ให้บริการ', other: 'อื่น ๆ' };
export const PAY_STATUS = { submitted: 'รอตรวจยอด', verified: 'ได้รับเงินแล้ว', rejected: 'ไม่พบยอด', pending: 'รอชำระ', failed: 'ไม่สำเร็จ', expired: 'หมดอายุ' };
const MONEY_TH = { none: '', unpaid: 'รอชำระ', partial: 'ชำระบางส่วน', paid: 'ชำระครบแล้ว', overpaid: 'ชำระเกิน รอคืนส่วนต่าง', refunded: 'คืนเงินแล้ว', part_refunded: 'คืนเงินบางส่วน' };
const TEAMS = ['ทีม 1', 'ทีม 2', 'ผู้รับเหมา'], CAPACITY = 2;
const LIMITS = { createPerTel: 5, createPerIp: 20, createGlobal: 300, trackPerIp: 30, loginPerIp: 10, payPerIp: 20 };   // server/config.mjs (here: per tab)

// ---- TEST settings (placeholders — no bank accepts them) ----
export const TEST_PAY = Object.freeze({ promptpayId: '0000000000000', payee: 'บริษัท สหบูรพากรุ๊ป จำกัด', bank: 'ธนาคารตัวอย่าง', accountName: '', accountNo: '000-0-00000-0', onsite: true, requestDays: 7 });
export const TEST_PASSWORD = 'ทดสอบ1234';
export const TEST_ACCOUNTS = Object.freeze({ admin: Object.freeze({ name: 'ผู้ดูแล (ทดสอบ)', role: 'admin' }), staff: Object.freeze({ name: 'เจ้าหน้าที่ (ทดสอบ)', role: 'staff' }), tech: Object.freeze({ name: 'ช่าง (ทดสอบ)', role: 'tech' }) });

// ---- helpers (same behaviour as server/util.mjs: Bangkok time, text cleaning, ids, money) ----
const DAY = 864e5, SESSION_MS = 12 * 3600e3, MAX = { short: 120, mid: 400, long: 2000 }, MAX_SATANG = 50_000_000_00, DOC_MAX = 255 * 1024;
let clock = () => Date.now();
const nowMs = () => clock();
const bkk = (ms = clock()) => new Date(ms + 7 * 3600e3).toISOString();
const now = ms => bkk(ms).slice(0, 19).replace('T', ' ');
const today = ms => bkk(ms).slice(0, 10);
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
const beYear = ms => +bkk(ms).slice(0, 4) + 543;
const str = (v, max = MAX.short) => (v == null ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max));
const digits = v => String(v == null ? '' : v).replace(/\D/g, '');
const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && (d => !isNaN(d) && d.toISOString().slice(0, 10) === s)(new Date(s + 'T00:00:00Z'));
const rnd = n => crypto.getRandomValues(new Uint8Array(n));
const token = (n = 24) => btoa(String.fromCharCode(...rnd(n))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // transfer-memo codes: no 0/O/1/I
const code = (n = 6) => Array.from(rnd(n), b => ALPHA[b % ALPHA.length]).join('');
const rid = p => p + '-' + token(6).replace(/[-_]/g, 'x').slice(0, 8).toUpperCase();
const toSatang = baht => Math.round(+baht * 100);
const fmtBaht = satang => (satang / 100).toLocaleString('en-US', { minimumFractionDigits: satang % 100 ? 2 : 0, maximumFractionDigits: 2 });
const sha256 = async s => (crypto.subtle ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2, '0')).join('') : s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
// a ticket id is a document id: anything that is not a plain path segment simply does not exist
const safeId = v => { const s = str(v, 40); return /^[A-Za-z0-9_.~:@+-]+$/.test(s) && s !== '.' && s !== '..' ? s : null; };
function amountSatang(v) {   // staff type baht ("1,500" / "1500.50")
  const s = String(v == null ? '' : v).replace(/[,\s฿]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = toSatang(+s);
  return n >= 100 && n <= MAX_SATANG ? n : null;
}
// deepest {…}/[…] nesting outside JSON strings (server/app.mjs)
const nesting = s => {
  let d = 0, m = 0;
  for (let i = 0, q = false; i < s.length; i++) { const c = s[i]; if (q) { if (c === '\\') i++; else if (c === '"') q = false; } else if (c === '"') q = true; else if (c === '{' || c === '[') m = Math.max(m, ++d); else if (c === '}' || c === ']') d--; }
  return m;
};
// fixed-window limits like the server's, but per tab (there is no server to count every visitor)
const hits = new Map();
const rl = {
  hit(key, max, win) { const t = nowMs(); let e = hits.get(key); if (!e || e.reset <= t) { e = { n: 0, reset: t + win }; hits.set(key, e); } if (e.n >= max) return false; e.n++; return true; },
  peek(key, max) { const e = hits.get(key); return !e || e.reset <= nowMs() || e.n < max; },
};
const fail = code => Object.assign(new Error(code), { api: code });

// ---- the store: memoized namespace, one retry on `unavailable`, write guards, leases ----
let dbP = null, DB = null;
const getDb = () => dbP || (dbP = (async () => { try { return (await globalThis.claude?.use?.('db')) || null; } catch (e) { return null; } })());
let userP = null;
const getUser = () => userP || (userP = (async () => { try { return (await globalThis.claude?.use?.('user')) || null; } catch (e) { return null; } })());
const canWrite = async () => { const u = await getUser(); try { return u && u.can ? await u.can('data.write') : null; } catch (e) { return null; } };
async function retry(f) {
  try { return await f(); }
  catch (e) { if (e && e.code === 'unavailable') { await sleep(120 + Math.random() * 380); return f(); } throw e; }
}
const getDoc = async path => { const s = await retry(() => DB.doc(path).get()); return s && s.exists ? clone(s.data()) || {} : null; };
const query = async q => (await retry(() => q.get())).docs.map(d => clone(d.data()) || {});
// bodies are checked before they are sent (plain JSON, ≤ 256 KiB), so a refused write means this viewer may not write
async function write(f) {
  try { return await retry(f); }
  catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'transform_error')) { console.warn('[artifact-api] write refused:', e.message || e.code); throw fail('read_only'); } throw e; }
}
async function putDoc(path, body) {
  body = clone(body);
  if (new TextEncoder().encode(JSON.stringify(body)).length > DOC_MAX) throw fail('too_large');   // a document holds at most 256 KiB
  return write(() => DB.doc(path).set(body));
}
const delDoc = path => write(() => DB.doc(path).delete());
const HOLDER = 'tab-' + token(9);
// cooperative lease (db.d.ts acquire idiom): busy → wait for its expiry; this tab renews its own lease at once
async function lease(path, ttlMs = 4000) {
  const ref = DB.doc(path), end = Date.now() + 15000;
  for (;;) {
    const r = await write(() => ref.acquire({ holder: HOLDER, ttlMs }));
    if (r && r.acquired) return;
    if (Date.now() > end) throw fail('network');
    await sleep(Math.min(ttlMs, Math.max(60, (Date.parse(r && r.expiresAt) || 0) - Date.now())) + Math.random() * 150);
  }
}
// one write at a time per document in this tab
const queue = new Map();
function serial(key, f) {
  const run = (queue.get(key) || Promise.resolve()).then(f), tail = run.catch(() => {});
  queue.set(key, tail); tail.then(() => { if (queue.get(key) === tail) queue.delete(key); });
  return run;
}
// next number of a daily / monthly sequence: counters/<name> = {k, n}, under its lease
const nextSeq = (name, k) => serial('c:' + name, async () => {
  const path = 'counters/' + name;
  await lease(path);
  const c = await getDoc(path) || {}, n = (c.k === k ? Math.max(0, Math.floor(+c.n) || 0) : 0) + 1;
  await putDoc(path, { k, n });
  return n;
});
const setSeq = (name, k, n) => serial('c:' + name, async () => { await lease('counters/' + name); await putDoc('counters/' + name, { k, n }); });

/* ---------------- tickets ---------------- */
async function nextId() {
  // SBP-<พ.ศ. 2 หลัก><เดือน><วัน>-<ลำดับในวัน>, Bangkok calendar day (server/tickets.mjs nextId)
  const t = today(), md = t.slice(5, 7) + t.slice(8, 10), y = beYear(), k = 'T' + y + md, pre = 'SBP-' + String(y).slice(-2) + md + '-';
  for (let i = 0; i < 4; i++) {
    const id = pre + String(await nextSeq('ticket', k)).padStart(3, '0');
    if (!(await getDoc('tickets/' + id))) return id;
    // the counter fell behind the stored tickets (e.g. counters were reset): continue after the highest number of the day
    const top = (await query(DB.collection('tickets').where('createdAt', '>=', t + ' 00:00:00'))).reduce((a, x) => (String(x.id).startsWith(pre) ? Math.max(a, +String(x.id).slice(pre.length) || 0) : a), 0);
    await setSeq('ticket', k, top);
  }
  throw fail('server');
}
async function nextReceipt() {
  // RC<พ.ศ. 2 หลัก><เดือน>-<ลำดับในเดือน> (server/payments.mjs nextReceipt)
  const t = today(), y = beYear(), k = 'R' + y + t.slice(5, 7), pre = 'RC' + String(y).slice(-2) + t.slice(5, 7) + '-';
  for (let i = 0; i < 4; i++) {
    const no = pre + String(await nextSeq('receipt', k)).padStart(4, '0');
    if (!(await query(DB.collection('tickets').where('receiptNos', 'array-contains', no).limit(1))).length) return no;
    const top = (await query(DB.collection('tickets').limit(1000))).flatMap(x => x.receiptNos || []).reduce((a, r) => (String(r).startsWith(pre) ? Math.max(a, +String(r).slice(pre.length) || 0) : a), 0);
    await setSeq('receipt', k, top);
  }
  throw fail('server');
}
const norm = t => (t && Object.assign(t, { reqs: t.reqs || [], pays: t.pays || [], refs: t.refs || [], reqIds: t.reqIds || [], payIds: t.payIds || [], receiptNos: t.receiptNos || [] }));
const loadTicket = async id => { const s = safeId(id); return s ? norm(await getDoc('tickets/' + s)) : null; };
// read-modify-write of one ticket under its lease; fn(t) may throw (nothing written) or return false (nothing to write)
async function mutate(id, fn) {
  const s = safeId(id);
  if (!s || !(await getDoc('tickets/' + s))) throw fail('not_found');
  return serial('t:' + s, async () => {
    await lease('tickets/' + s);
    const t = norm(await getDoc('tickets/' + s)); if (!t) throw fail('not_found');
    if (await fn(t) !== false) await putDoc('tickets/' + s, t);
    return t;
  });
}
// a ticket as the sheet / board sees it: the 34 visible columns (no payload), numbers or ''
const sheetRow = o => { const x = {}; for (const k of HEADERS) if (k !== 'payload') x[k] = o[k] == null ? '' : o[k]; return x; };
let pricingP = null;
const ensurePricing = () => pricingP || (pricingP = core.loadData().then(() => initPricing(core)).catch(e => { pricingP = null; throw e; }));

async function create(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) t = {};
  if (str(t.website)) throw fail('rejected');   // honeypot
  const kind = own(KINDS, t.kind) ? t.kind : null; if (!kind) throw fail('bad_kind');
  const c = t.customer && typeof t.customer === 'object' ? t.customer : {}, s = t.site && typeof t.site === 'object' ? t.site : {};
  const q = t.quote && typeof t.quote === 'object' ? t.quote : null;
  const tel = digits(c.tel), fb = kind === 'feedback';
  if (!(fb && !tel) && !/^0\d{8,9}$/.test(tel)) throw fail('bad_tel');
  const name = str(c.name) || (fb ? 'ไม่ระบุชื่อ' : ''); if (!name) throw fail('bad_name');
  if (kind !== 'feedback' && t.consent !== true) throw fail('no_consent');
  const email = str(c.email, MAX.short); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('bad_email');
  const pref = str(t.prefDate, 10); let alt = str(t.altDate, 10);
  if (pref && (!isDate(pref) || pref < today() || pref > addDays(today(), 366))) throw fail('bad_date');
  if (alt && !isDate(alt)) alt = '';
  const slot = own(SLOTS, t.slot) ? t.slot : '';
  if (q && q.lines != null && !Array.isArray(q.lines)) throw fail('bad_json');
  const rid = typeof t.rid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(t.rid) ? t.rid : '';
  // idempotent retry: the same request id from the same phone within 24 h returns the stored ticket
  if (rid) {
    const since = now(nowMs() - DAY), prev = (await query(DB.collection('tickets').where('rid', '==', rid))).filter(x => x.tel === tel && x.createdAt >= since).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0];
    if (prev) return { ok: true, id: prev.id, status: prev.status, statusTh: STATUSES[prev.status] || prev.status, repeat: true };
  }
  if (!rl.hit('create:all', LIMITS.createGlobal, 10 * 60e3) || !rl.hit('create:ip', LIMITS.createPerIp, 10 * 60e3) || !rl.hit('create:tel:' + (tel || 'anon'), LIMITS.createPerTel, 3600e3)) throw fail('rate_limited');
  const units = {}; let total = 0;
  if (t.units && typeof t.units === 'object') for (const k of Object.keys(t.units)) { const n = Math.max(0, Math.min(999, Math.floor(+t.units[k] || 0))); if (n && /^[a-z]{2,10}$/.test(k)) { units[k] = n; total += n; } }
  let rq = null; if (q) { await ensurePricing(); rq = recompute(q, str(s.area)); }
  const o = {
    createdAt: now(), status: 'new', kind, service: own(SERVICES, t.service) ? t.service : (kind === 'booking' ? 'other' : ''),
    units: total ? JSON.stringify(units) : '', teamDays: +t.teamDays > 0 ? Math.min(999, Math.round(+t.teamDays * 10) / 10) : '',
    prefDate: pref, slot, altDate: alt, name, tel, email, company: str(c.company),
    taxInvoice: c.taxInvoice ? 'ใช่' : '', taxName: str(c.taxName, MAX.mid), taxId: digits(c.taxId).slice(0, 13),
    address: str(s.address, MAX.mid), area: str(s.area), zoneTier: rq && rq.zone ? rq.zone.tier : str(s.zoneTier, 20),
    // travel and totals are the server pricing's figures, never the browser's
    travelFee: rq ? (rq.totals.travel > 0 ? rq.totals.travel : '') : (+s.travelFee > 0 ? Math.min(1e6, +s.travelFee) : ''),
    building: str(s.building), access: str(s.access, MAX.mid),
    quoteTotalEx: rq && rq.totals.totalEx > 0 ? rq.totals.totalEx : '',
    quoteLines: rq ? str(quoteLinesText(rq), MAX.long) : '',
    details: str(t.details, MAX.long), notes: str(t.notes, MAX.long), source: str(t.source, MAX.mid),
    team: '', schedDate: '', schedSlot: '', staffNote: '', updatedAt: '',
    history: JSON.stringify([{ at: now(), by: 'เว็บไซต์', s: 'new' }]),
    quote: rq, priceCheck: rq ? { verified: rq.verified, match: rq.match, payable: rq.payable, issues: rq.issues.slice(0, 20) } : null,
    consentText: kind !== 'feedback' ? str(t.consentText, 600) || CONSENT_DEFAULT : '', consentAt: kind !== 'feedback' ? now() : '',
    rid, ipHash: '', anonymizedAt: '', reqs: [], pays: [], refs: [], reqIds: [], payIds: [], receiptNos: [],
  };
  o.id = await nextId();
  await putDoc('tickets/' + o.id, o);
  return { ok: true, id: o.id, status: o.status, statusTh: STATUSES[o.status] };
}
async function findByIdTel(id, tel) {
  const o = await loadTicket(id), d = digits(tel);
  if (!o || !d || !o.tel || o.tel.replace(/^0/, '') !== d.replace(/^0/, '')) return null;   // anonymous feedback is never trackable
  return o;
}
async function track(b) {
  if (!rl.hit('track:ip', LIMITS.trackPerIp, 10 * 60e3)) throw fail('rate_limited');
  const o = await findByIdTel(b.id, b.tel); if (!o) throw fail('not_found');
  const ticket = { id: o.id, status: o.status, statusTh: STATUSES[o.status] || o.status, kind: o.kind, service: o.service, prefDate: o.prefDate, slot: o.slot, schedDate: o.schedDate, schedSlot: o.schedSlot, team: o.team ? 'จัดทีมแล้ว' : '' };
  const payment = publicView(o);
  if (payment) ticket.payment = payment;
  return { ok: true, ticket };
}
async function slots(b) {
  const from = isDate(b.from) ? b.from : today(), days = Math.max(1, Math.min(31, Math.floor(+b.days) || 14));
  const map = {}, out = [];
  for (let i = 0; i < days; i++) { const k = addDays(from, i); map[k] = { date: k, AM: 0, PM: 0, EVE: 0 }; out.push(map[k]); }
  const to = addDays(from, days);
  for (const o of await query(DB.collection('tickets').where('kind', '==', 'booking').where('status', 'in', ACTIVE))) {
    const d = o.schedDate || o.prefDate, s = o.schedSlot || o.slot;
    if (d >= from && d < to && map[d] && own(SLOTS, s)) map[d][s]++;
  }
  return { ok: true, capacity: CAPACITY, days: out };
}
const listRow = t => { const x = sheetRow(t); x.priceCheck = t.priceCheck || null; const s = summaryBaht(t); if (s) x.pay = s; return x; };
async function list(b) {
  let q = DB.collection('tickets');
  if (b.status && own(STATUSES, b.status)) q = q.where('status', '==', b.status);
  if (b.since && typeof b.since === 'string') q = q.where('createdAt', '>=', str(b.since, 19));
  const limit = Math.max(1, Math.min(2000, Math.floor(+b.limit) || 500));
  const rows = (await query(q.orderBy('createdAt', 'desc').limit(Math.min(1000, limit)))).map(norm)
    .sort((a, c) => (a.createdAt === c.createdAt ? (a.id < c.id ? 1 : -1) : a.createdAt < c.createdAt ? 1 : -1)).slice(0, limit);
  return { ok: true, tickets: rows.map(listRow), teams: TEAMS, statuses: STATUSES, slots: SLOTS, capacity: CAPACITY };
}
async function update(b, staff) {
  const patch = b.patch && typeof b.patch === 'object' ? b.patch : {};
  let changed = false;
  const t = await mutate(b.id, o => {
    const ch = {};
    if (patch.status != null) { if (!own(STATUSES, patch.status)) throw fail('bad_status'); if (patch.status !== o.status) ch.s = o.status + '→' + patch.status; o.status = patch.status; }
    if (patch.team != null) { const v = str(patch.team); if (v && !TEAMS.includes(v)) throw fail('bad_team'); if (v !== o.team) ch.team = v; o.team = v; }
    if (patch.schedDate != null) { const d = str(patch.schedDate, 10); if (d && !isDate(d)) throw fail('bad_date'); if (d !== o.schedDate) ch.date = d; o.schedDate = d; }
    if (patch.schedSlot != null) { const sl = own(SLOTS, patch.schedSlot) ? patch.schedSlot : ''; if (sl !== o.schedSlot) ch.slot = sl; o.schedSlot = sl; }
    if (patch.staffNote != null) { const n = str(patch.staffNote, MAX.long); if (n !== o.staffNote) ch.note = 1; o.staffNote = n; }
    let h = []; try { h = JSON.parse(o.history || '[]'); } catch (e) {}
    changed = Object.keys(ch).length > 0;
    if (changed) { ch.at = now(); ch.by = staff.name; h.push(ch); }
    o.history = JSON.stringify(h.slice(-50));
    if (!changed && o.updatedAt) return false;
    o.updatedAt = changed ? now() : (o.updatedAt || now());
  });
  return { ok: true, ticket: listRow(t) };
}

/* ---------------- money (server/payments.mjs) ---------------- */
const P = TEST_PAY;
function expireOld(t) { const d = today(); for (const r of t.reqs) if (r.status === 'open' && r.expiresAt && r.expiresAt < d) Object.assign(r, { status: 'expired', closedAt: now() }); }
const paidFor = (t, reqId) => t.pays.filter(p => p.reqId === reqId && p.status === 'verified').reduce((a, p) => a + p.amount, 0);
function settle(t, reqId) { const r = t.reqs.find(x => x.id === reqId); if (r && r.status === 'open' && paidFor(t, reqId) >= r.amount) Object.assign(r, { status: 'paid', closedAt: now() }); }
function summary(t) {
  expireOld(t);
  const R = t.reqs, Pm = t.pays, F = t.refs;
  if (!R.length && !Pm.length && !F.length) return null;
  const paid = Pm.filter(p => p.status === 'verified').reduce((a, p) => a + p.amount, 0);
  const refunded = F.filter(f => f.status === 'done').reduce((a, f) => a + f.amount, 0);
  const open = R.filter(r => r.status === 'open');
  const due = open.reduce((a, r) => a + Math.max(0, r.amount - paidFor(t, r.id)), 0);
  const asked = R.filter(r => r.status === 'open' || r.status === 'paid').reduce((a, r) => a + r.amount, 0);
  const pending = Pm.filter(p => p.status === 'submitted').length;
  const net = paid - refunded;
  const status = refunded && net <= 0 ? 'refunded' : refunded ? 'part_refunded' : due > 0 ? (paid > 0 ? 'partial' : 'unpaid') : net > asked && asked > 0 ? 'overpaid' : paid > 0 ? 'paid' : 'none';
  return { status, statusTh: MONEY_TH[status], due, paid, refunded, asked, pending, open: open.length };
}
const baht = x => x && { ...x, due: x.due / 100, paid: x.paid / 100, refunded: x.refunded / 100, asked: x.asked / 100 };
// list / update: like server summaries() — only tickets with a payment request or a payment carry `pay`
const summaryBaht = t => baht(t.reqs.length || t.pays.length ? summary(t) : null);
function suggested(t) {
  const rq = t.quote;
  if (!rq || !rq.payable) return null;
  const s = summary(t), already = s ? s.asked : 0, total = toSatang(rq.totals.total);
  return total - already >= 100 ? { amount: total - already, basis: 'server_quote', tax: rq.tax, totalEx: rq.totals.totalEx, vat: rq.totals.vat } : null;
}
const payee = () => ({ name: P.payee, promptpay: P.promptpayId ? maskId(P.promptpayId) : '', bank: P.bank && P.accountNo ? { name: P.bank, accountName: P.accountName || P.payee, accountNo: P.accountNo } : null });
const methodsFor = () => [P.promptpayId ? 'promptpay' : null, P.bank && P.accountNo ? 'transfer' : null, P.onsite ? 'onsite' : null].filter(Boolean);
// what the customer may see after id + phone: amounts, request references, receipt numbers — no staff names or notes
function publicView(t) {
  const s = summary(t);
  if (!s) return null;
  return {
    status: s.status, statusTh: s.statusTh, due: s.due / 100, paid: s.paid / 100, refunded: s.refunded / 100, pending: s.pending > 0,
    methods: methodsFor(), payee: P.payee,
    requests: t.reqs.filter(r => r.status !== 'void').map(r => ({ id: r.id, kind: r.kind, kindTh: REQ_KINDS[r.kind] || r.kind, amount: r.amount / 100, remaining: Math.max(0, r.amount - paidFor(t, r.id)) / 100, status: r.status, statusTh: REQ_STATUS[r.status] || r.status, ref: r.ref, expiresAt: r.expiresAt, submitted: t.pays.some(p => p.reqId === r.id && p.status === 'submitted') })),
    receipts: t.pays.filter(p => p.status === 'verified' && p.receiptNo).map(p => ({ no: p.receiptNo, amount: p.amount / 100, at: p.verifiedAt.slice(0, 10), method: PAY_METHODS[p.method] || p.method })),
    test: true,
  };
}
const openReq = (t, reqId) => { expireOld(t); const r = t.reqs.find(x => x.id === str(reqId, 40)); return r && r.status === 'open' ? r : null; };
async function pay(b) {
  if (b.method === 'gateway') throw fail('pay_unavailable');   // phase 2 gateway: never on the test site
  if (!rl.hit('pay:ip', LIMITS.payPerIp, 10 * 60e3)) throw fail('rate_limited');
  const t = await findByIdTel(b.id, b.tel); if (!t) throw fail('not_found');
  const r = openReq(t, b.req); if (!r) throw fail('pay_closed');
  const remaining = r.amount - paidFor(t, r.id);
  if (remaining < 100) throw fail('pay_closed');
  const out = { req: r.id, kind: r.kind, kindTh: REQ_KINDS[r.kind], amount: remaining / 100, amountTh: fmtBaht(remaining), ref: r.ref, payee: P.payee, expiresAt: r.expiresAt };
  if (b.method === 'promptpay') {
    if (!P.promptpayId) throw fail('pay_unavailable');
    const payload = promptpayPayload(P.promptpayId, remaining);
    return { ok: true, pay: { ...out, method: 'promptpay', promptpay: maskId(P.promptpayId), payload, qr: qrDataUrl(payload), test: true } };
  }
  if (b.method === 'transfer') {
    const p = payee(); if (!p.bank) throw fail('pay_unavailable');
    return { ok: true, pay: { ...out, method: 'transfer', bank: p.bank, test: true } };
  }
  if (b.method === 'onsite') {
    if (!P.onsite) throw fail('pay_unavailable');
    return { ok: true, pay: { ...out, method: 'onsite', test: true } };
  }
  throw fail('bad_method');
}
// the customer says "I have transferred" — SUBMITTED until staff check the statement (never counted as paid here)
async function paid(b) {
  if (!rl.hit('pay:ip', LIMITS.payPerIp, 10 * 60e3)) throw fail('rate_limited');
  const t0 = await findByIdTel(b.id, b.tel); if (!t0) throw fail('not_found');
  const method = b.method === 'transfer' ? 'transfer' : 'promptpay';
  if (!methodsFor().includes(method)) throw fail('pay_unavailable');
  const t = await mutate(t0.id, t => {
    const r = openReq(t, b.req); if (!r) throw fail('pay_closed');
    if (t.pays.some(p => p.reqId === r.id && p.status === 'submitted')) return false;   // a repeated report is not doubled
    const id = rid('PM');
    t.pays.push({ id, ticketId: t.id, reqId: r.id, method, provider: 'manual', providerRef: '', amount: r.amount - paidFor(t, r.id), status: 'submitted', reference: str(b.reference, 120), note: str(b.note, 400), byWho: 'ลูกค้า', createdAt: now(), verifiedBy: '', verifiedAt: '', receiptNo: null });
    t.payIds.push(id);
  });
  return { ok: true, payment: publicView(t) };
}

/* ---------------- staff: payments ---------------- */
const role = (staff, ...allowed) => allowed.includes(staff.role);
function detail(t, staff) {
  expireOld(t);
  return {
    ok: true, id: t.id, summary: baht(summary(t)),
    suggested: (x => x && { ...x, amount: x.amount / 100 })(suggested(t)), quote: t.quote || null, payee: payee(), methods: PAY_METHODS, kinds: REQ_KINDS,
    requests: t.reqs.map(r => ({ ...r, amount: r.amount / 100, paid: paidFor(t, r.id) / 100, statusTh: REQ_STATUS[r.status] })),
    payments: t.pays.map(p => ({ ...p, amount: p.amount / 100, statusTh: PAY_STATUS[p.status], methodTh: PAY_METHODS[p.method] })),
    refunds: t.refs.map(f => ({ ...f, amount: f.amount / 100 })),
    can: { request: role(staff, 'admin', 'staff'), verify: role(staff, 'admin', 'staff'), refund: role(staff, 'admin') },
    test: true,
  };
}
async function payDetail(b, staff) { const t = await loadTicket(b.id); if (!t) throw fail('not_found'); return detail(t, staff); }
async function request(b, staff) {
  if (!role(staff, 'admin', 'staff')) throw fail('forbidden');
  const t = await mutate(b.id, t => {
    if (t.status === 'cancelled') throw fail('ticket_cancelled');
    if (!own(REQ_KINDS, b.kind)) throw fail('bad_kind');
    let amount = b.amount === '' || b.amount == null ? null : amountSatang(b.amount), basis = 'staff_confirmed';
    if (b.amount === '' || b.amount == null) { const s = suggested(t); if (!s) throw fail('amount_required'); amount = s.amount; basis = 'server_quote'; }
    if (!amount) throw fail('bad_amount');
    const id = rid('PR');
    t.reqs.push({ id, ticketId: t.id, kind: b.kind, amount, status: 'open', ref: code(6), note: str(b.note, 400), basis, createdAt: now(), createdBy: staff.name, expiresAt: addDays(today(), Math.max(1, P.requestDays)), closedAt: '' });
    t.reqIds.push(id);
  });
  return detail(t, staff);
}
// the ticket holding payment request / payment `id` (rows live inside their ticket's document)
const ticketOf = async (field, id) => { const s = str(id, 40); return s ? ((await query(DB.collection('tickets').where(field, 'array-contains', s).limit(1)))[0] || null) : null; };
async function voidReq(b, staff) {
  if (!role(staff, 'admin', 'staff')) throw fail('forbidden');
  const reqId = str(b.req, 40), owner = await ticketOf('reqIds', reqId); if (!owner) throw fail('not_found');
  const t = await mutate(owner.id, t => {
    const r = t.reqs.find(x => x.id === reqId); if (!r) throw fail('not_found');
    if (r.status !== 'open') throw fail('pay_closed');
    // verified money, or a transfer reported and not yet checked, keeps the request visible
    if (t.pays.some(p => p.reqId === r.id && ['verified', 'submitted', 'pending'].includes(p.status))) throw fail('has_payments');
    Object.assign(r, { status: 'void', closedAt: now(), note: str([r.note, 'ยกเลิก: ' + str(b.reason, 200)].filter(Boolean).join(' · '), 400) });
  });
  return detail(t, staff);
}
// money received on site / by transfer, typed in by staff (a technician's entry waits for the office to verify it)
async function record(b, staff) {
  const t = await mutate(b.id, async t => {
    if (!own(PAY_METHODS, b.method) || b.method === 'gateway') throw fail('bad_method');
    const amount = amountSatang(b.amount); if (!amount) throw fail('bad_amount');
    let reqId = '';
    if (b.req) { const r = t.reqs.find(x => x.id === str(b.req, 40)); if (!r) throw fail('not_found'); reqId = r.id; }
    const verified = role(staff, 'admin', 'staff'), id = rid('PM'), receiptNo = verified ? await nextReceipt() : null;
    t.pays.push({ id, ticketId: t.id, reqId, method: b.method, provider: 'manual', providerRef: '', amount, status: verified ? 'verified' : 'submitted', reference: str(b.reference, 120), note: str(b.note, 400), byWho: staff.name, createdAt: now(), verifiedBy: verified ? staff.name : '', verifiedAt: verified ? now() : '', receiptNo });
    t.payIds.push(id); if (receiptNo) t.receiptNos.push(receiptNo);
    if (reqId) settle(t, reqId);
  });
  return detail(t, staff);
}
async function verify(b, staff) {
  if (!role(staff, 'admin', 'staff')) throw fail('forbidden');
  const pid = str(b.payment, 40), owner = await ticketOf('payIds', pid); if (!owner) throw fail('not_found');
  const t = await mutate(owner.id, async t => {
    const p = t.pays.find(x => x.id === pid); if (!p) throw fail('not_found');
    if (p.status !== 'submitted') throw fail('pay_closed');
    const ok = b.decision === 'verify';
    if (!ok && b.decision !== 'reject') throw fail('bad_decision');
    // the office may correct the amount actually received before verifying
    const amount = b.amount != null && b.amount !== '' ? amountSatang(b.amount) : p.amount; if (!amount) throw fail('bad_amount');
    const note = str([p.note, str(b.note, 200)].filter(Boolean).join(' · '), 400);
    if (ok) { Object.assign(p, { status: 'verified', amount, verifiedBy: staff.name, verifiedAt: now(), receiptNo: await nextReceipt(), note }); t.receiptNos.push(p.receiptNo); }
    else Object.assign(p, { status: 'rejected', verifiedBy: staff.name, verifiedAt: now(), note });
    if (ok && p.reqId) settle(t, p.reqId);
  });
  return detail(t, staff);
}
async function refund(b, staff) {
  if (!role(staff, 'admin')) throw fail('forbidden');
  if (!(await loadTicket(b.id))) throw fail('not_found');
  const amount = amountSatang(b.amount); if (!amount) throw fail('bad_amount');
  if (!['transfer', 'cash', 'promptpay', 'gateway', 'other'].includes(b.method)) throw fail('bad_method');
  if (!str(b.reason, 200)) throw fail('reason_required');
  const t = await mutate(b.id, t => {
    const s = summary(t) || { paid: 0, refunded: 0 };
    if (amount > s.paid - s.refunded) throw fail('refund_too_large');
    t.refs.push({ id: rid('RF'), ticketId: t.id, paymentId: str(b.payment, 40), amount, method: b.method, status: 'done', reason: str(b.reason, 200), reference: str(b.reference, 120), byWho: staff.name, createdAt: now(), completedAt: now() });
  });
  return detail(t, staff);
}

/* ---------------- staff accounts (TEST) ---------------- */
async function login(b) {
  const user = str(b.user, 40).toLowerCase(), W = 15 * 60e3, max = LIMITS.loginPerIp;
  // only FAILED attempts count (per tab and per username), like the server
  if (!rl.peek('login:ip', max) || !rl.peek('login:u:' + user, max)) throw fail('rate_limited');
  const a = own(TEST_ACCOUNTS, user) ? TEST_ACCOUNTS[user] : null;
  if (!a || String(b.password == null ? '' : b.password) !== TEST_PASSWORD) { rl.hit('login:ip', max, W); rl.hit('login:u:' + user, max, W); throw fail('unauthorized'); }
  const tk = token(32);
  try { for (const x of (await retry(() => DB.collection('sessions').where('expiresMs', '<', nowMs()).limit(50).get())).docs) await delDoc('sessions/' + x.id); } catch (e) {}   // tidy up expired sessions
  await putDoc('sessions/' + await sha256(tk), { user, createdAt: now(), expiresMs: nowMs() + SESSION_MS });
  return { ok: true, token: tk, name: a.name, role: a.role, roleTh: ROLES[a.role] };
}
async function logout(tk) { if (tk && typeof tk === 'string' && tk.length <= 200) await delDoc('sessions/' + await sha256(tk)); return { ok: true }; }
// → {id, name, role}: the session must map to a test account (the role always comes from TEST_ACCOUNTS, never from the store)
async function authenticate(tk) {
  if (tk && typeof tk === 'string' && tk.length <= 200) {
    const path = 'sessions/' + await sha256(tk), s = await getDoc(path), a = s && own(TEST_ACCOUNTS, s.user) ? TEST_ACCOUNTS[s.user] : null;
    if (a && +s.expiresMs > nowMs()) {
      if (s.expiresMs - nowMs() < SESSION_MS / 2) await putDoc(path, { ...s, expiresMs: nowMs() + SESSION_MS }).catch(() => {});   // sliding
      return { id: s.user, name: a.name, role: a.role };
    }
  }
  if (!rl.hit('auth:fail', 30, 15 * 60e3)) throw fail('rate_limited');
  throw fail('unauthorized');
}

/* ---------------- dispatch ---------------- */
const STAFF = {
  list: (b, st) => list(b),
  update: (b, st) => update(b, st),
  me: (b, st) => ({ ok: true, name: st.name, role: st.role, roleTh: ROLES[st.role] }),
  paydetail: payDetail, payreq: request, payvoid: voidReq, payrecord: record, payverify: verify, refund,
};
async function dispatch(b) {
  switch (b.action) {
    case 'create': return create(b.ticket || {});
    case 'track': return track(b);
    case 'slots': return slots(b);
    case 'pay': return pay(b);
    case 'paid': return paid(b);
    case 'login': return login(b);
    case 'logout': return logout(b.token);
    default:
      if (own(STAFF, b.action)) return STAFF[b.action](b, await authenticate(b.token));
      throw fail('unknown_action');
  }
}
const LIFECYCLE = ['revoked', 'not_granted', 'capability_disabled', 'capability_removed'];
function toCode(e) {
  if (e && e.api) return { code: e.api };
  const c = e && typeof e.code === 'string' ? e.code : '';
  if (LIFECYCLE.includes(c)) return { code: 'not_connected' };
  if (c === 'quota_exceeded') return { code: 'quota_exceeded' };   // the artifact's store is full: tell the team, retrying cannot help
  if (c && c !== 'invalid_argument' && c !== 'transform_error' && !(e instanceof Error)) return { code: 'network' };   // unavailable, resource_exhausted, unknown store codes
  const ref = token(6);
  console.error(`[artifact-api] error ${ref}:`, e);
  return { code: 'server', ref };
}

// the whole API: body = what assets/ticket.js would POST to /exec → the server's {ok:true, …} reply, or a rejection {code}
export async function handle(body) {
  DB = await getDb();
  if (!DB) throw { code: 'not_connected' };
  if (await canWrite() === false) throw { code: 'read_only' };   // below Contributor: the rules let this viewer neither read nor write
  let text, b;
  try { text = JSON.stringify(body == null ? {} : body); } catch (e) { throw { code: 'bad_json' }; }
  if (text === undefined) throw { code: 'unknown_action' };
  if (text.length > 30000 || new TextEncoder().encode(text).length > 64 * 1024) throw { code: 'too_large' };   // same limits as /exec
  if (nesting(text) > 64) throw { code: 'bad_json' };
  b = JSON.parse(text);   // a plain copy, like a request body
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw { code: 'unknown_action' };
  try { return clone(await dispatch(b)); } catch (e) { throw toCode(e); }
}

// tests only (tests/artifact-api.mjs): an injectable clock, and forget the memoized store / limits
export const testHooks = { setClock: f => { clock = f || (() => Date.now()); }, reset: () => { dbP = null; userP = null; DB = null; hits.clear(); } };
