/**
 * SBP AirCare — back office ticket API (Google Apps Script bound to a Google Sheet) · Rev.09 r10 (2 ต.ค. 2569)
 *
 * The website sends every booking / quote request / contact message here as a ticket. Each ticket is one row in the
 * "Tickets" sheet (the company's single source of truth for incoming work); the staff board (backoffice.html) and the
 * sheet itself are the back office. Setup: backoffice/README.md.
 *
 * One endpoint (the web app URL), JSON over POST with Content-Type text/plain (no CORS preflight from browsers):
 *   public  {action:'create', ticket}            → {ok, id, status}
 *           {action:'track',  id, tel}           → {ok, ticket: {id, status, statusTh, kind, prefDate, slot, schedDate, schedSlot, team}}
 *           {action:'slots',  from, days}        → {ok, capacity, days: [{date, AM, PM, EVE}]}   (counts only, never names)
 *   staff   {action:'list',   token, status?, since?}           → {ok, tickets:[…all fields…], teams, statuses}
 *           {action:'update', token, id, patch, staff}          → {ok, ticket}
 *   GET     ?action=health                                       → {ok, service, version}
 *
 * Script properties (Project Settings → Script properties):
 *   STAFF_TOKEN   required for list/update — a long random string, shared with staff only
 *   NOTIFY_EMAIL  optional — new tickets are emailed here (e.g. the company inbox)
 *   TEAMS         optional JSON array, default ["ทีม 1","ทีม 2","ผู้รับเหมา"]
 *   SLOT_CAPACITY optional number of jobs per half-day slot, default 2 (two in-house teams)
 *   LINE_TOKEN / LINE_TO  optional — LINE Messaging API push to a staff group (channel access token + group/user id)
 *   CUSTOMER_ACK  optional "1" — email the customer an acknowledgement when they left an email address
 *
 * Safety: customer text is never interpreted by the sheet (values that start with = + - @ are prefixed with '),
 * the sheet columns are plain text, a hidden honeypot field drops bots, and each phone number / the whole endpoint are
 * rate-limited. Staff fields (team, note, history) are never returned to the public track call.
 */
var VERSION = 'r10-2569-10-02';
var SHEET = 'Tickets';
var TZ = 'Asia/Bangkok';
var KINDS = { booking: 'จองคิว', quote: 'ขอใบเสนอราคา', inquiry: 'ติดต่อ / สอบถาม', feedback: 'ความเห็นเว็บไซต์' };
var SERVICES = { clean: 'ล้างแอร์', install: 'ติดตั้งแอร์', repair: 'ตรวจเช็ก / ซ่อม', move: 'ย้ายแอร์', amc: 'สำรวจสัญญาล้างรายปี', project: 'สำรวจงานโครงการ / รีโนเวต', buy: 'ซื้อแอร์', other: 'อื่น ๆ' };
var STATUSES = { new: 'รับคำขอแล้ว รอยืนยัน', need_info: 'รอข้อมูลเพิ่มจากลูกค้า', confirmed: 'ยืนยันนัดแล้ว', assigned: 'จัดทีมแล้ว', in_progress: 'กำลังดำเนินการ', done: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
var SLOTS = { AM: 'ช่วงเช้า', PM: 'ช่วงบ่าย', EVE: 'นอกเวลาทำการ' };
var ACTIVE = ['new', 'need_info', 'confirmed', 'assigned', 'in_progress'];
var HEADERS = ['id', 'createdAt', 'status', 'kind', 'service', 'units', 'teamDays', 'prefDate', 'slot', 'altDate', 'name', 'tel', 'email', 'company',
  'taxInvoice', 'taxName', 'taxId', 'address', 'area', 'zoneTier', 'travelFee', 'building', 'access', 'quoteTotalEx', 'quoteLines', 'details', 'notes',
  'source', 'team', 'schedDate', 'schedSlot', 'staffNote', 'updatedAt', 'history', 'payload'];
var MAX = { short: 120, mid: 400, long: 2000, payload: 30000 };

/* ---------------- entry points ---------------- */
function doGet(e) {
  return out_({ ok: true, service: 'SBP AirCare back office', version: VERSION });
}
function doPost(e) {
  var raw = (e && e.postData && e.postData.contents) || '', body;
  if (raw.length > MAX.payload) return out_({ ok: false, error: 'too_large' });
  try { body = JSON.parse(raw || '{}'); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  try {
    switch (body.action) {
      case 'create': return out_(create_(body.ticket || {}));
      case 'track': return out_(track_(body.id, body.tel));
      case 'slots': return out_(slots_(body.from, body.days));
      case 'list': return out_(staff_(body.token) || list_(body));
      case 'update': return out_(staff_(body.token) || update_(body.id, body.patch || {}, body.staff));
      default: return out_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return out_({ ok: false, error: 'server', detail: String(err && err.message || err).slice(0, 200) });
  }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------- helpers ---------------- */
function props_() { return PropertiesService.getScriptProperties(); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function str_(v, max) { return v == null ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || MAX.short); }
function digits_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
function cell_(v) { v = v == null ? '' : v; if (typeof v === 'string' && /^[=+\-@\t\r]/.test(v)) return "'" + v; return v; }   // never let customer text become a formula
function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
function teams_() { try { var t = JSON.parse(props_().getProperty('TEAMS') || 'null'); if (t && t.length) return t; } catch (e) {} return ['ทีม 1', 'ทีม 2', 'ผู้รับเหมา']; }
function capacity_() { var n = +(props_().getProperty('SLOT_CAPACITY') || 2); return n > 0 ? n : 2; }
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1000, HEADERS.length).setNumberFormat('@');   // phone numbers, ids and dates stay plain text
  }
  return sh;
}
function rows_() {
  var sh = sheet_(), n = sh.getLastRow();
  if (n < 2) return [];
  var vals = sh.getRange(2, 1, n - 1, HEADERS.length).getValues();
  return vals.map(function (r, i) { var o = { _row: i + 2 }; HEADERS.forEach(function (k, j) { o[k] = r[j]; }); return o; });
}
function find_(id) { id = str_(id, 40); var all = rows_(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
function write_(o) { sheet_().getRange(o._row, 1, 1, HEADERS.length).setNumberFormat('@').setValues([HEADERS.map(function (k) { return cell_(o[k]); })]); }
function nextId_() {
  // SBP-<พ.ศ. 2 หลัก><เดือน><วัน>-<ลำดับในวัน> e.g. SBP-691002-007 (Thai Buddhist year, like the company's documents)
  var d = new Date(), y = +Utilities.formatDate(d, TZ, 'yyyy') + 543, md = Utilities.formatDate(d, TZ, 'MMdd');
  var key = 'SEQ_' + y + md, p = props_(), n = +(p.getProperty(key) || 0) + 1;
  p.setProperty(key, String(n));
  return 'SBP-' + String(y).slice(-2) + md + '-' + ('00' + n).slice(-3);
}
function throttle_(tel) {
  var c = CacheService.getScriptCache();
  var g = +(c.get('rate:all') || 0); if (g >= 120) return 'rate_limited';
  var t = +(c.get('rate:' + tel) || 0); if (t >= 5) return 'rate_limited';
  c.put('rate:all', String(g + 1), 600); c.put('rate:' + tel, String(t + 1), 3600);
  return null;
}
function staff_(token) {
  var want = props_().getProperty('STAFF_TOKEN');
  if (!want) return { ok: false, error: 'staff_disabled' };
  if (!token || String(token) !== want) return { ok: false, error: 'unauthorized' };
  return null;   // authorised
}

/* ---------------- public: create ---------------- */
function create_(t) {
  if (str_(t.website)) return { ok: false, error: 'rejected' };                       // honeypot (hidden field humans never fill)
  var kind = KINDS[t.kind] ? t.kind : null; if (!kind) return { ok: false, error: 'bad_kind' };
  var c = t.customer || {}, s = t.site || {}, q = t.quote || null;
  var tel = digits_(c.tel), fb = kind === 'feedback';                                  // website feedback may stay anonymous
  if (!(fb && !tel) && !/^0\d{8,9}$/.test(tel)) return { ok: false, error: 'bad_tel' };
  var name = str_(c.name) || (fb ? 'ไม่ระบุชื่อ' : ''); if (!name) return { ok: false, error: 'bad_name' };
  if (kind !== 'feedback' && t.consent !== true) return { ok: false, error: 'no_consent' };
  var email = str_(c.email, MAX.short); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'bad_email' };
  var pref = str_(t.prefDate, 10), alt = str_(t.altDate, 10);
  if (pref && (!isDate_(pref) || pref < today_())) return { ok: false, error: 'bad_date' };
  if (alt && !isDate_(alt)) alt = '';
  var slot = SLOTS[t.slot] ? t.slot : '';
  var limited = throttle_(tel || 'anon'); if (limited) return { ok: false, error: limited };
  var units = {}, total = 0; Object.keys(t.units || {}).forEach(function (k) { var n = Math.max(0, Math.min(999, Math.floor(+t.units[k] || 0))); if (n && /^[a-z]{2,10}$/.test(k)) { units[k] = n; total += n; } });
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var o = {
      id: nextId_(), createdAt: now_(), status: 'new', kind: kind, service: SERVICES[t.service] ? t.service : (kind === 'booking' ? 'other' : ''),
      units: total ? JSON.stringify(units) : '', teamDays: +t.teamDays > 0 ? Math.round(+t.teamDays * 10) / 10 : '',
      prefDate: pref, slot: slot, altDate: alt, name: name, tel: tel, email: email, company: str_(c.company),
      taxInvoice: c.taxInvoice ? 'ใช่' : '', taxName: str_(c.taxName, MAX.mid), taxId: digits_(c.taxId).slice(0, 13),
      address: str_(s.address, MAX.mid), area: str_(s.area), zoneTier: str_(s.zoneTier, 20), travelFee: +s.travelFee > 0 ? +s.travelFee : '',
      building: str_(s.building), access: str_(s.access, MAX.mid),
      quoteTotalEx: q && +q.totalEx > 0 ? +q.totalEx : '', quoteLines: q && q.lines ? str_(q.lines.map(function (l) { return '• ' + str_(l.name, 160) + ' × ' + (+l.qty || 1) + (l.unitEx == null ? ' (ประเมินหน้างาน)' : ' = ' + (+l.unitEx * (+l.qty || 1))); }).join('\n'), MAX.long) : '',
      details: str_(t.details, MAX.long), notes: str_(t.notes, MAX.long), source: str_(t.source, MAX.mid),
      team: '', schedDate: '', schedSlot: '', staffNote: '', updatedAt: '', history: JSON.stringify([{ at: now_(), by: 'เว็บไซต์', s: 'new' }]),
      payload: str_(JSON.stringify(t), MAX.payload),
    };
    var sh = sheet_(); o._row = sh.getLastRow() + 1; write_(o);
  } finally { lock.releaseLock(); }
  notify_(o);
  return { ok: true, id: o.id, status: o.status, statusTh: STATUSES[o.status] };
}
function summary_(o) {
  return [KINDS[o.kind] + (o.service ? ' · ' + (SERVICES[o.service] || o.service) : '') + ' · ' + o.id,
    'ลูกค้า: ' + o.name + (o.company ? ' (' + o.company + ')' : '') + ' · โทร ' + o.tel + (o.email ? ' · ' + o.email : ''),
    o.prefDate ? 'วันที่ต้องการ: ' + o.prefDate + ' ' + (SLOTS[o.slot] || '') + (o.altDate ? ' · สำรอง ' + o.altDate : '') : '',
    o.units ? 'จำนวนเครื่อง: ' + o.units : '', o.address || o.area ? 'สถานที่: ' + [o.address, o.area].filter(String).join(' · ') : '',
    o.quoteLines ? 'รายการจากใบเสนอราคาเบื้องต้น:\n' + o.quoteLines + (o.quoteTotalEx ? '\nรวมก่อน VAT ' + o.quoteTotalEx : '') : '',
    o.details ? 'รายละเอียด: ' + o.details : '', o.notes ? 'หมายเหตุ: ' + o.notes : '', o.taxInvoice ? 'ต้องการใบกำกับภาษี: ' + (o.taxName || '-') + ' ' + (o.taxId || '') : '',
    'ที่มา: ' + (o.source || '-')].filter(String).join('\n');
}
function notify_(o) {
  var p = props_(), to = p.getProperty('NOTIFY_EMAIL'), text = summary_(o);
  try { if (to) MailApp.sendEmail({ to: to, subject: '[SBP ' + KINDS[o.kind] + '] ' + o.id + ' · ' + o.name, body: text + '\n\nเปิดชีต Tickets หรือหน้าหลังบ้านเพื่อยืนยันนัด' }); } catch (e) {}
  try { if (p.getProperty('CUSTOMER_ACK') === '1' && o.email) MailApp.sendEmail({ to: o.email, subject: 'SBP AirCare ได้รับคำขอของคุณแล้ว · ' + o.id, body: 'เรียนคุณ ' + o.name + '\n\nบริษัทได้รับคำขอเลขที่ ' + o.id + ' แล้ว ทีมจะติดต่อกลับเพื่อยืนยันรายละเอียดและนัดหมาย\nตรวจสถานะได้ที่หน้าเว็บไซต์ (เลขที่คำขอ + เบอร์โทร)\n\nบริษัท สหบูรพากรุ๊ป จำกัด' }); } catch (e) {}
  try {
    var lt = p.getProperty('LINE_TOKEN'), lto = p.getProperty('LINE_TO');
    if (lt && lto) UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + lt }, payload: JSON.stringify({ to: lto, messages: [{ type: 'text', text: text.slice(0, 4900) }] }), muteHttpExceptions: true });
  } catch (e) {}
}

/* ---------------- public: track + slots ---------------- */
function track_(id, tel) {
  var o = find_(id);
  if (!o || !digits_(tel) || digits_(o.tel).replace(/^0/, '') !== digits_(tel).replace(/^0/, '')) return { ok: false, error: 'not_found' };
  return { ok: true, ticket: { id: o.id, status: o.status, statusTh: STATUSES[o.status] || o.status, kind: o.kind, service: o.service, prefDate: o.prefDate, slot: o.slot, schedDate: o.schedDate, schedSlot: o.schedSlot, team: o.team ? 'จัดทีมแล้ว' : '' } };
}
function slots_(from, days) {
  from = isDate_(from) ? from : today_(); days = Math.max(1, Math.min(31, +days || 14));
  var cap = capacity_(), map = {}, out = [];
  var d0 = new Date(from + 'T00:00:00+07:00');
  for (var i = 0; i < days; i++) { var k = Utilities.formatDate(new Date(d0.getTime() + i * 864e5), TZ, 'yyyy-MM-dd'); map[k] = { date: k, AM: 0, PM: 0, EVE: 0 }; out.push(map[k]); }
  rows_().forEach(function (o) {
    if (ACTIVE.indexOf(o.status) < 0 || o.kind !== 'booking') return;
    var d = o.schedDate || o.prefDate, s = o.schedSlot || o.slot;
    if (map[d] && SLOTS[s]) map[d][s]++;
  });
  return { ok: true, capacity: cap, days: out };
}

/* ---------------- staff: list + update ---------------- */
function list_(b) {
  var all = rows_().filter(function (o) { return (!b.status || o.status === b.status) && (!b.since || o.createdAt >= b.since); });
  all.reverse();
  return { ok: true, tickets: all.slice(0, 500).map(function (o) { var x = {}; HEADERS.forEach(function (k) { if (k !== 'payload') x[k] = o[k]; }); return x; }), teams: teams_(), statuses: STATUSES, slots: SLOTS, capacity: capacity_() };
}
function update_(id, patch, staff) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var o = find_(id); if (!o) return { ok: false, error: 'not_found' };
    var ch = {};
    if (patch.status != null) { if (!STATUSES[patch.status]) return { ok: false, error: 'bad_status' }; if (patch.status !== o.status) ch.s = o.status + '→' + patch.status; o.status = patch.status; }
    if (patch.team != null) { var t = str_(patch.team); if (t && teams_().indexOf(t) < 0) return { ok: false, error: 'bad_team' }; if (t !== o.team) ch.team = t; o.team = t; }
    if (patch.schedDate != null) { var d = str_(patch.schedDate, 10); if (d && !isDate_(d)) return { ok: false, error: 'bad_date' }; if (d !== o.schedDate) ch.date = d; o.schedDate = d; }
    if (patch.schedSlot != null) { var sl = SLOTS[patch.schedSlot] ? patch.schedSlot : ''; if (sl !== o.schedSlot) ch.slot = sl; o.schedSlot = sl; }
    if (patch.staffNote != null) { var n = str_(patch.staffNote, MAX.long); if (n !== o.staffNote) ch.note = 1; o.staffNote = n; }
    var h = []; try { h = JSON.parse(o.history || '[]'); } catch (e) {}
    if (Object.keys(ch).length) { ch.at = now_(); ch.by = str_(staff) || 'staff'; h.push(ch); }
    o.history = JSON.stringify(h.slice(-50)); o.updatedAt = now_();
    write_(o);
    var x = {}; HEADERS.forEach(function (k) { if (k !== 'payload') x[k] = o[k]; });
    return { ok: true, ticket: x };
  } finally { lock.releaseLock(); }
}
