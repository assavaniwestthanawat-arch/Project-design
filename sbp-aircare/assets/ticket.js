// SBP AirCare — ticket client (Rev.09 r10, owner 2 ต.ค. 2569: "ระบบจองคิว … ส่ง ticket เข้าระบบหลังบ้านบริษัท").
// Every booking, quote request, contact message and beta feedback becomes ONE ticket in the company's back office
// (Google Sheet + Apps Script web app — backoffice/README.md). This module only talks to that endpoint:
//   sendTicket(ticket) → {id, status, statusTh}   fetchSlots(from, days) → {capacity, days}   trackTicket(id, tel) → {ticket}
//   staffApi(token) → {list(q), update(id, patch, staff)}   (the staff board, backoffice.html)
// Not connected (no endpoint) or blocked (a claude.ai artifact cannot call other sites) → the call rejects with
// {code:'not_connected'|'network'|'timeout'|<server error>} and the page falls back to the honest hand-off summary.
// Never sends internal prices: tickets carry only what the customer saw on the page.

// ▼ Production: paste the Apps Script web-app URL (…/exec) here once it is deployed. Empty = not connected.
export const TICKET_ENDPOINT = '';
export const TIMEOUT_MS = 15000;

// local testing only: ?ticketApi=<url> on localhost (tools/backoffice-server.mjs serves /exec)
const override = () => { try { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return new URLSearchParams(location.search).get('ticketApi'); } catch (e) {} return null; };
// staff board only: the back-office URL typed at login (offline board file, before TICKET_ENDPOINT is set) — https only
let manual = null;
export const useEndpoint = u => { manual = /^https:\/\/\S+$/.test(u || '') ? u : null; return !!manual; };
export const endpoint = () => override() || manual || TICKET_ENDPOINT;
export const connected = () => !!endpoint();

const ERR_TH = {
  not_connected: 'หน้านี้ยังไม่ได้เชื่อมกับระบบหลังบ้าน', network: 'ส่งเข้าระบบไม่ได้ (เครือข่าย หรือหน้านี้ถูกจำกัดการเชื่อมต่อ)', timeout: 'ระบบหลังบ้านตอบช้าเกินไป',
  rate_limited: 'ส่งคำขอจากเบอร์นี้หลายครั้งเกินไป กรุณารอสักครู่ หรือโทรหาเรา', bad_tel: 'เบอร์โทรไม่ถูกต้อง', bad_name: 'กรุณากรอกชื่อ', no_consent: 'กรุณายืนยันการใช้ข้อมูลเพื่อติดต่อกลับ',
  bad_date: 'วันที่ต้องเป็นวันนี้หรือหลังจากนี้', bad_email: 'รูปแบบอีเมลไม่ถูกต้อง', not_found: 'ไม่พบคำขอ ตรวจเลขที่คำขอและเบอร์โทรอีกครั้ง', unauthorized: 'รหัสเจ้าหน้าที่ไม่ถูกต้อง',
  staff_disabled: 'ยังไม่ได้ตั้งรหัสเจ้าหน้าที่ (STAFF_TOKEN) ในระบบหลังบ้าน', server: 'ระบบหลังบ้านขัดข้อง', rejected: 'ระบบปฏิเสธคำขอ',
};
export const errTh = e => ERR_TH[(e && e.code) || e] || `ส่งไม่สำเร็จ (${(e && e.code) || e})`;

async function call(body) {
  const url = endpoint();
  if (!url) throw { code: 'not_connected' };
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), TIMEOUT_MS);
  try {
    // text/plain = a "simple" request: no CORS preflight (Apps Script answers with a redirect + Access-Control-Allow-Origin: *)
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', signal: ctl ? ctl.signal : undefined });
    const j = await r.json();
    if (!j || !j.ok) throw { code: (j && j.error) || 'server' };
    return j;
  } catch (e) {
    if (e && e.code) throw e;
    throw { code: e && e.name === 'AbortError' ? 'timeout' : 'network' };
  } finally { clearTimeout(t); }
}

export const sendTicket = ticket => call({ action: 'create', ticket });
export const fetchSlots = (from, days = 14) => call({ action: 'slots', from, days });
export const trackTicket = (id, tel) => call({ action: 'track', id: String(id || '').trim().toUpperCase(), tel });
export const staffApi = token => ({
  list: (q = {}) => call({ action: 'list', token, ...q }),
  update: (id, patch, staff) => call({ action: 'update', token, id, patch, staff }),
});

// shared vocabulary (the back office uses the same keys — Code.gs KINDS / SERVICES / STATUSES / SLOTS)
export const KINDS = { booking: 'จองคิว', quote: 'ขอใบเสนอราคา', inquiry: 'ติดต่อ / สอบถาม', feedback: 'ความเห็นเว็บไซต์' };
export const SERVICES = { clean: 'ล้างแอร์', install: 'ติดตั้งแอร์', repair: 'ตรวจเช็ก / ซ่อม', move: 'ย้ายแอร์', amc: 'สำรวจสัญญาล้างรายปี', project: 'สำรวจงานโครงการ / รีโนเวต', buy: 'ซื้อแอร์', other: 'อื่น ๆ' };
export const STATUSES = { new: 'รับคำขอแล้ว รอยืนยัน', need_info: 'รอข้อมูลเพิ่มจากลูกค้า', confirmed: 'ยืนยันนัดแล้ว', assigned: 'จัดทีมแล้ว', in_progress: 'กำลังดำเนินการ', done: 'เสร็จแล้ว', cancelled: 'ยกเลิก' };
export const SLOTS = { AM: 'ช่วงเช้า', PM: 'ช่วงบ่าย', EVE: 'นอกเวลาทำการ' };
// a short "where it came from" stamp for the team (variant + view); no tracking ids, no device fingerprint
export const sourceTag = variant => `เว็บไซต์ แบบ ${variant || ((document.title.match(/แบบ\s*([ABCD])/) || [])[1]) || '-'} · ${(location.hash || '#home').slice(0, 40)}`;
// map the visitor's quote basket to ticket lines (prices as shown: round hundreds before VAT)
export const quoteFromCart = cart => {
  if (!cart || !cart.items || !cart.items.length) return null;
  const t = cart.totals();
  return { totalEx: t.totalEx, tax: t.tax, vat: t.vat, total: t.inc, travel: t.travel, minGap: t.minGap, lines: cart.items.map(i => ({ name: i.name + (i.detail ? ` (${i.detail})` : ''), qty: i.qty, unitEx: i.unitEx })) };
};
