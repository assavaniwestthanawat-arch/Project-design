// SBP AirCare — ticket client (Rev.09 r10, owner 2 ต.ค. 2569: "ระบบจองคิว … ส่ง ticket เข้าระบบหลังบ้านบริษัท").
// Every booking, quote request, contact message and beta feedback becomes ONE ticket in the company's back office
// (Google Sheet + Apps Script web app — backoffice/README.md). This module only talks to that endpoint:
//   sendTicket(ticket) → {id, status, statusTh}   fetchSlots(from, days) → {capacity, days}   trackTicket(id, tel) → {ticket}
//   staffApi(token) → {list(q), update(id, patch, staff)}   (the staff board, backoffice.html)
// Not connected (no endpoint) or blocked (a claude.ai artifact cannot call other sites) → the call rejects with
// {code:'not_connected'|'network'|'timeout'|<server error>} and the page falls back to the honest hand-off summary.
// Never sends internal prices: tickets carry only what the customer saw on the page.
// Rev.10 UX: errTh(e, action) — one plain Thai sentence per failure (cause + fix), per action; timeouts are recognised by name.
import { COMPANY } from './sbp-core.js';

// ▼ Production: paste the Apps Script web-app URL (…/exec) here once it is deployed. Empty = not connected.
export const TICKET_ENDPOINT = '';
export const TIMEOUT_MS = 15000;

// local testing only: ?ticketApi=<url> on localhost (tools/backoffice-server.mjs serves /exec)
const override = () => { try { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return new URLSearchParams(location.search).get('ticketApi'); } catch (e) {} return null; };
// staff board only: the back-office URL typed at login (offline board file, before TICKET_ENDPOINT is set) — https only
let manual = null;
export const useEndpoint = u => { manual = /^https:\/\/\S+$/.test(u || '') ? u : null; return !!manual; };
// Rev.10: the production server (server/) serves the pages itself and marks them with <meta name="sbp-api" content="/exec">
// (same origin, no CORS). Artifact / offline single-file builds carry no such tag → "not connected" as before.
// Rev.10 test site on Claude (no domain yet, owner 10 ต.ค. 2569): `build.py --test` marks the page "artifact:db" — the calls then
// run in the page against the artifact's own document store (artifact-api.js); test data only, never real customers.
const served = () => { try { const m = document.querySelector('meta[name="sbp-api"]'); return m && (m.content === 'artifact:db' || /^\/[\w/-]*$/.test(m.content)) ? m.content : null; } catch (e) { return null; } };
export const endpoint = () => override() || manual || TICKET_ENDPOINT || served();
export const connected = () => !!endpoint();
export const testSite = () => endpoint() === 'artifact:db';
// the test build plugs the in-page backend in (build.py --test: useLocalBackend(handle) from artifact-api.js) — production pages never carry it
let local = null;
export const useLocalBackend = fn => { local = typeof fn === 'function' ? fn : null; };

// Rev.10 UX: every message is one plain sentence — what happened, then what to do — with no brackets and no system code on screen
// (an unknown code goes to the console). The test site never offers the company phone (test data only, CLAUDE.md §6.6 #23).
const callUs = () => (testSite() ? '' : ` หรือโทร ${COMPANY.tel}`);
const ERR_TH = {
  not_connected: 'หน้านี้ยังไม่ได้เชื่อมกับระบบหลังบ้าน', read_only: 'เว็บทดสอบ: ลิงก์นี้ดูได้อย่างเดียว ขอสิทธิ์ผู้ทดสอบจากเจ้าของเพื่อทดลองส่ง',
  network: 'เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', timeout: 'ระบบตอบช้าเกินไปจึงยังไม่ทราบผล ตรวจรายการอีกครั้งก่อนทำซ้ำ',
  server: 'ระบบขัดข้องชั่วคราว ลองอีกครั้งในอีกสักครู่', quota_exceeded: 'พื้นที่เก็บข้อมูลของเว็บทดสอบเต็มแล้ว แจ้งเจ้าของเว็บทดสอบ',
  // the limits count per phone, per network address and site-wide — never blame "this phone"
  rate_limited: () => `ทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่${callUs()}`,
  bad_tel: 'เบอร์โทรไม่ถูกต้อง ใส่ 9–10 หลัก ขึ้นต้นด้วย 0', bad_name: 'กรุณากรอกชื่อ', no_consent: 'กรุณาติ๊กยืนยันการใช้ข้อมูลก่อนส่ง',
  bad_date: 'วันที่ต้องเป็นวันนี้หรือหลังจากนี้', bad_email: 'รูปแบบอีเมลไม่ถูกต้อง เช่น name@company.com', not_found: 'ไม่พบคำขอ ตรวจเลขที่คำขอและเบอร์โทรอีกครั้ง', unauthorized: 'รหัสเจ้าหน้าที่ไม่ถูกต้อง',
  staff_disabled: 'ยังไม่ได้ตั้งรหัสเจ้าหน้าที่ (STAFF_TOKEN) ในระบบหลังบ้าน', rejected: 'ระบบไม่รับคำขอนี้',
  // Rev.10 payments + staff accounts
  pay_closed: 'รายการชำระนี้ปิดแล้ว เพราะชำระครบ ยกเลิก หรือหมดอายุ ตรวจสถานะอีกครั้ง', pay_unavailable: () => `ช่องทางชำระนี้ยังไม่เปิดใช้ เลือกช่องทางอื่น${callUs()}`,
  bad_method: 'ช่องทางชำระไม่ถูกต้อง', bad_amount: 'จำนวนเงินไม่ถูกต้อง ใส่อย่างน้อย 1 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง', amount_required: 'ใบเสนอราคายังมีรายการที่ต้องประเมิน กรุณาใส่จำนวนเงินที่ยืนยันกับลูกค้าแล้ว',
  forbidden: 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้', ticket_cancelled: 'คำขอนี้ถูกยกเลิกแล้ว', has_payments: 'รายการนี้มียอดชำระแล้ว ยกเลิกไม่ได้ ใช้การคืนเงินแทน',
  reason_required: 'กรุณาระบุเหตุผล', refund_too_large: 'คืนเงินได้ไม่เกินยอดที่ได้รับสุทธิ', gateway_error: 'ระบบรับชำระออนไลน์ขัดข้อง ลองใหม่หรือเลือกช่องทางอื่น',
  bad_json: 'ข้อมูลที่ส่งไม่ถูกต้อง', too_large: 'ข้อมูลยาวเกินไป', bad_status: 'สถานะไม่ถูกต้อง', bad_team: 'ไม่มีทีมนี้ในระบบ', bad_decision: 'คำสั่งไม่ถูกต้อง',
};
// errTh(e, action?) — the action (send · track · pay · report) names what failed, so a status check never reads like a failed send
const ACT_TH = { send: 'ส่งคำขอไม่สำเร็จ', track: 'ตรวจสถานะไม่ได้ตอนนี้', pay: 'โหลดข้อมูลการชำระไม่ได้', report: 'แจ้งโอนไม่สำเร็จ' };
const TRANSIENT = { network: 'เชื่อมต่อระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', timeout: 'ระบบตอบช้าเกินไป ลองอีกครั้งในอีกสักครู่', server: 'ระบบขัดข้องชั่วคราว ลองอีกครั้งในอีกสักครู่' };
// a timeout leaves the result unknown: resending the same form is safe (same request id → the ticket already stored)
const UNSURE = { send: 'ระบบตอบช้าเกินไปจึงยังไม่ทราบว่าคำขอถึงบริษัทหรือไม่ กดลองส่งอีกครั้งได้ ระบบไม่สร้างคำขอซ้ำ', report: 'ระบบตอบช้าเกินไปจึงยังไม่ทราบว่าแจ้งโอนสำเร็จหรือไม่ ตรวจสถานะการชำระก่อนแจ้งซ้ำ' };
export function errTh(e, action = '') {
  const code = typeof e === 'string' ? e : e && typeof e.code === 'string' ? e.code : '';
  if (code === 'timeout' && UNSURE[action]) return UNSURE[action];
  if (TRANSIENT[code] && ACT_TH[action]) return `${ACT_TH[action]} เพราะ${TRANSIENT[code]}`;
  if (code === 'rate_limited' && (action === 'track' || action === 'pay')) return 'ตรวจสถานะถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
  const m = Object.prototype.hasOwnProperty.call(ERR_TH, code) ? ERR_TH[code] : null;
  if (m) return typeof m === 'function' ? m() : m;
  console.warn('[ticket] error without Thai text:', code || e);
  return `${ACT_TH[action] || 'ทำรายการไม่สำเร็จ'} ลองอีกครั้ง${callUs()}`;
}

async function call(body) {
  const url = endpoint();
  if (!url) throw { code: 'not_connected' };
  if (url === 'artifact:db') {
    if (!local) throw { code: 'not_connected' };
    try { return await local(body); } catch (e) { throw e && typeof e.code === 'string' ? e : { code: 'server' }; }
  }
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), TIMEOUT_MS);
  try {
    // text/plain = a "simple" request: no CORS preflight (Apps Script answers with a redirect + Access-Control-Allow-Origin: *)
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', signal: ctl ? ctl.signal : undefined });
    const j = await r.json();
    if (!j || !j.ok) throw { code: (j && j.error) || 'server' };
    return j;
  } catch (e) {
    // an AbortError is a DOMException whose legacy numeric code (20) is truthy: test the name first, rethrow only our {code:'…'}
    if (e && e.name === 'AbortError') throw { code: 'timeout' };
    if (e && typeof e.code === 'string') throw e;
    throw { code: e instanceof SyntaxError ? 'server' : 'network' };   // an answer that is not JSON (a proxy error page) is a server fault
  } finally { clearTimeout(t); }
}
// Rev.10 UX test site: whether this viewer can only look (the store answers read_only before any action runs) — the Beta bar says so
// up front. The probe action does not exist, so a viewer who may write gets unknown_action and nothing is stored.
export const viewerReadOnly = async () => {
  if (!testSite() || !local) return false;
  try { await local({ action: 'access' }); } catch (e) { return !!e && e.code === 'read_only'; }
  return false;
};

export const sendTicket = ticket => call({ action: 'create', ticket });
export const fetchSlots = (from, days = 14) => call({ action: 'slots', from, days });
export const trackTicket = (id, tel) => call({ action: 'track', id: String(id || '').trim().toUpperCase(), tel });
export const staffApi = token => ({
  list: (q = {}) => call({ action: 'list', token, ...q }),
  update: (id, patch, staff) => call({ action: 'update', token, id, patch, staff }),
  // Rev.10 (production server only — the Apps Script back office answers unknown_action)
  me: () => call({ action: 'me', token }),
  payDetail: id => call({ action: 'paydetail', token, id }),
  payRequest: (id, o) => call({ action: 'payreq', token, id, ...o }),
  payVoid: (req, reason, staff) => call({ action: 'payvoid', token, req, reason, staff }),
  payRecord: (id, o) => call({ action: 'payrecord', token, id, ...o }),
  payVerify: (payment, decision, o = {}) => call({ action: 'payverify', token, payment, decision, ...o }),
  refund: (id, o) => call({ action: 'refund', token, id, ...o }),
  logout: () => call({ action: 'logout', token }),
});
// Rev.10 staff accounts: username + password → a 12-hour session token used exactly like STAFF_TOKEN
export const staffLogin = (user, password) => call({ action: 'login', user, password });
// Rev.10 customer payments (id + phone, like track): see a request's PromptPay QR / bank account, choose to pay on site,
// or report a transfer (the office verifies it against the bank statement before it counts)
export const payInfo = (id, tel, req, method) => call({ action: 'pay', id: String(id || '').trim().toUpperCase(), tel, req, method });
export const payReport = (id, tel, req, method, reference) => call({ action: 'paid', id: String(id || '').trim().toUpperCase(), tel, req, method, reference });

// shared vocabulary (the back office uses the same keys — Code.gs KINDS / SERVICES / STATUSES / SLOTS)
export const KINDS = { booking: 'จองคิว', quote: 'ขอใบเสนอราคา', inquiry: 'ติดต่อ / สอบถาม', feedback: 'ความเห็นเว็บไซต์' };
export const SERVICES = { clean: 'ล้างแอร์', install: 'ติดตั้งแอร์', repair: 'ตรวจเช็ก / ซ่อม', move: 'ย้ายแอร์', amc: 'สำรวจสัญญาล้างรายปี', project: 'สำรวจงานโครงการ / รีโนเวต', buy: 'ซื้อแอร์', other: 'อื่น ๆ' };
export const STATUSES = { new: 'รับคำขอแล้ว รอยืนยัน', need_info: 'รอข้อมูลเพิ่มจากลูกค้า', confirmed: 'ยืนยันนัดแล้ว', assigned: 'จัดทีมแล้ว', in_progress: 'กำลังดำเนินการ', done: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
export const SLOTS = { AM: 'ช่วงเช้า', PM: 'ช่วงบ่าย', EVE: 'นอกเวลาทำการ' };
// a short "where it came from" stamp for the team (variant + view); no tracking ids, no device fingerprint
// Rev.10: the production server tags each page with <meta name="sbp-variant"> (titles become customer-facing when SITE_MODE=live)
const metaVariant = () => { try { return document.querySelector('meta[name="sbp-variant"]').content; } catch (e) { return ''; } };
export const sourceTag = variant => `เว็บไซต์ แบบ ${variant || ((document.title.match(/แบบ\s*([ABCD])/) || [])[1]) || metaVariant() || '-'} · ${(location.hash || '#home').slice(0, 40)}`;
// map the visitor's quote basket to ticket lines (prices as shown: round hundreds before VAT)
export const quoteFromCart = cart => {
  if (!cart || !cart.items || !cart.items.length) return null;
  const t = cart.totals();
  // Rev.10: each line also carries its pricebook key / group / kind so the server can re-price it (server/pricing.mjs)
  return { totalEx: t.totalEx, tax: t.tax, vat: t.vat, total: t.inc, travel: t.travel, minGap: t.minGap, zoneInput: cart.zoneInput || '',
    lines: cart.items.map(i => ({ name: i.name + (i.detail ? ` (${i.detail})` : ''), qty: i.qty, unitEx: i.unitEx, key: i.key, group: i.group, kind: i.kind, ...(i.units ? { units: i.units } : {}) })) };
};
