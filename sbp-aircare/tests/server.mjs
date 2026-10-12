// Rev.10 — production server (server/*.mjs) end to end, no mocks. Spawns server/index.mjs with fresh temp DATA_DIRs
// (memory mail, DEV) and checks: A · the Apps Script contract (every check of tests/backoffice.mjs that still applies) ·
// B · Rev.10 fixes · C · server-side pricing · D · payments (the PromptPay QR is decoded from pixels in Chromium) ·
// E · staff accounts · F · notifications · G · static allowlist + security headers · H · backup → verify → restore drill.
// usage: npm run test:server   (ports 8831–8839, or PORT_BASE=…; VERBOSE=1 prints every check)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import jsQR from 'jsqr';
import { launch } from './_lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const NODE = [process.execPath, '--disable-warning=ExperimentalWarning'];
const TOKEN = 'server-test-legacy-token-0123456789', PW = 'test-password-123';
const TMP = mkdtempSync(join(tmpdir(), 'sbp-server-test-'));
const D1 = join(TMP, 'main'), D2 = join(TMP, 'second'), D3 = join(TMP, 'restored', 'data');   // D3 does not exist before the restore
const VERBOSE = !!process.env.VERBOSE;
// public price data, the same file the server prices from (keys + expected figures come from it, not from the server)
globalThis.__SBP_DATA = JSON.parse(readFileSync(join(ROOT, 'assets', 'sbp-data.json'), 'utf8'));
const core = await import('../assets/sbp-core.js');
await core.loadData();

let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } else if (VERBOSE) console.log('✓', m); };
const day = d => new Date(Date.now() + 7 * 3600e3 + d * 864e5).toISOString().slice(0, 10);   // Bangkok calendar day
const sleep = ms => new Promise(r => setTimeout(r, ms));
// '2026-10-15' → '15 ต.ค. 2569' — how customer and team messages write dates (Rev.10 UX)
const thD = d => `${+d.slice(8, 10)} ${['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][+d.slice(5, 7) - 1]} ${+d.slice(0, 4) + 543}`;
const BE = String(+day(0).slice(0, 4) + 543).slice(-2), ID0 = 'SBP-' + BE + day(0).slice(5, 7) + day(0).slice(8, 10) + '-', RC0 = 'RC' + BE + day(0).slice(5, 7) + '-';

/* ---------------- servers ---------------- */
// a clean environment: nothing from the caller's shell may switch a server feature on or off
const ENV0 = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(STAFF_|DEV$|NOTIFY_|CUSTOMER_|PROMPTPAY_|BANK_|PAY|SITE_|HOME_PAGE$|PUBLIC_PAGES$|TEAMS$|SLOT_|SMTP_|MAIL_|LINE_|OMISE_|DB_FILE$|BACKUP_|RETENTION_|TRUST_PROXY$|HOST$|PORT$|DATA_DIR$|NODE_ENV$|IP_HASH_SECRET$)/.test(k)));
const portFree = p => new Promise(res => { const s = createServer().once('error', () => res(false)).listen(p, '127.0.0.1', () => s.close(() => res(true))); });
let nextPort = +(process.env.PORT_BASE || 8831);
async function freePort() {
  for (; nextPort <= Math.max(8839, +(process.env.PORT_BASE || 0) + 8); nextPort++) if (await portFree(nextPort)) return nextPort++;
  return new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
}
const servers = [];
async function start(dataDir, extra = {}) {
  const port = await freePort();
  const env = { ...ENV0, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, MAIL_TRANSPORT: 'memory', TRUST_PROXY: '1', ...extra };
  const proc = spawn(NODE[0], [NODE[1], 'server/index.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const s = { proc, port, out: '', err: '', dataDir };
  servers.push(s);
  proc.stdout.on('data', d => { s.out += d; }); proc.stderr.on('data', d => { s.err += d; });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server start timeout\n' + s.err)), 20000);
    proc.stdout.on('data', () => { if (/SBP AirCare .* http:\/\//.test(s.out)) { clearTimeout(t); res(); } });
    proc.once('exit', c => { clearTimeout(t); rej(new Error(`server exited ${c}\n${s.err}`)); });
  });
  return s;
}
const stop = s => new Promise(res => {
  if (!s || s.proc.exitCode != null || s.proc.signalCode) return res();
  s.proc.once('exit', () => res()); s.proc.kill('SIGTERM');
  setTimeout(() => { try { s.proc.kill('SIGKILL'); } catch (e) {} }, 5000).unref();
});
const cli = (dataDir, args, extra = {}) => execFileSync(NODE[0], [NODE[1], 'server/cli.mjs', ...args], { cwd: ROOT, env: { ...ENV0, DATA_DIR: dataDir, ...extra }, stdio: 'pipe' }).toString('utf8');
// the servers run with TRUST_PROXY=1 (as behind Caddy): X-Forwarded-For gives every section its own client address,
// so the per-address limits (20 creates / 10 min, 30 tracks, 10 failed logins …) can be tested on purpose and do not trip by accident
function http(s, method, path, { body, headers = {}, ip } = {}) {
  return new Promise(res => {
    const h = { ...headers }; if (ip) h['X-Forwarded-For'] = ip;
    if (body != null) h['Content-Length'] = Buffer.byteLength(body);
    const r = request({ host: '127.0.0.1', port: s.port, method, path, headers: h, agent: false }, x => {
      const c = []; x.on('data', d => c.push(d)); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(c) }));
      x.on('error', e => res({ status: x.statusCode, error: e.code || e.message, headers: x.headers, body: Buffer.concat(c) }));
    });
    r.on('error', e => res({ status: 0, error: e.code || e.message, headers: {}, body: Buffer.alloc(0) }));
    r.setTimeout(30000, () => r.destroy(new Error('timeout')));
    if (body != null) r.write(body);
    r.end();
  });
}
let S1, S2, S3, IP = '127.0.1.1';
async function api(body, { s = S1, ip = IP } = {}) {
  const r = await http(s, 'POST', '/exec', { body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, ip });
  try { const j = JSON.parse(r.body.toString('utf8')); if (r.status !== 200) j.httpStatus = r.status; return j; }
  catch (e) { return { httpStatus: r.status, httpError: r.error, raw: r.body.toString('utf8').slice(0, 200) }; }
}
const dbRows = (dir, sql, ...a) => { const db = new DatabaseSync(join(dir, 'aircare.sqlite')); try { db.exec('PRAGMA busy_timeout = 5000'); return db.prepare(sql).all(...a); } finally { db.close(); } };

/* ---------------- data ---------------- */
const TEL = '0812345678';
const base = (o = {}) => ({ kind: 'booking', service: 'clean', units: { wall: 3, cassette: 1 }, teamDays: 0.3, prefDate: day(2), slot: 'AM', consent: true,
  customer: { name: 'คุณทดสอบ ระบบ', tel: '081-234-5678', email: 'test@example.com' }, site: { address: '12/3 ถ.พระราม 2', area: 'บางขุนเทียน กรุงเทพมหานคร', zoneTier: 'core' },
  source: 'server test', ...o });
const CLR = core.cleanRate('Basic Clean', 'C1', 'wall', 0).rate.s, MIN = core.DATA.minBill;   // 700 · 4,500 before VAT
const CL = (qty, unitEx = CLR) => ({ name: 'ล้าง Basic ติดผนัง 9,000–18,000 BTU', key: 'CL-Basic Clean-C1-wall-0', group: 'clean', kind: 'service', qty, unitEx });
const SV = core.DATA.inst.find(i => i.ex == null);                                            // an "ประเมินหน้างาน" item (no public price)
const SKU = core.DEMO.models.find(m => m.type === 'wall').skus[0];
const quote = (lines, o = {}) => ({ tax: 'none', zoneInput: 'บางขุนเทียน', lines, ...o });
// independent CRC-16/CCITT-FALSE + EMVCo TLV reader for the PromptPay checks
const crc16 = s => { let c = 0xffff; for (const b of Buffer.from(s, 'ascii')) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c.toString(16).toUpperCase().padStart(4, '0'); };
const tlv = s => { const o = {}; for (let i = 0; i + 4 <= s.length;) { const id = s.slice(i, i + 2), len = +s.slice(i + 2, i + 4); o[id] = s.slice(i + 4, i + 4 + len); i += 4 + len; } return o; };
const BANNED = ['แก้หายแน่นอน', 'ไม่มีปัญหาอีกแน่นอน', 'ประหยัดไฟแน่นอน', 'ปลอดเชื้อ', 'สะอาด 100%', 'รับประกันเย็น', 'ล้างใหญ่ครบทุกจุด', 'ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี', 'อะไหล่เสียแน่นอน', 'เสร็จตามเวลาแน่นอน', 'ต้นทุน', 'อัตราพิเศษ ', 'อัตราโครงการ'];
const PROMISE = /ภายใน\s*\d+\s*(นาที|ชั่วโมง|ชม\.|วัน)|แน่นอน|รับประกันว่า/;

let browser = null;
const t0 = Date.now();
try {
  // staff accounts first (CLI, scrypt hashes), then the main server
  for (const [u, nm, r] of [['admin', 'แอดมินทดสอบ', 'admin'], ['staff1', 'เจ้าหน้าที่ทดสอบ', 'staff'], ['tech1', 'ช่างทดสอบ', 'tech'], ['lockme', 'ทดสอบล็อก', 'staff']])
    cli(D1, ['staff', 'add', u, nm, r], { STAFF_PASSWORD: PW });
  S1 = await start(D1, { DEV: '1', STAFF_TOKEN: TOKEN, PROMPTPAY_ID: '0105555555555', BANK_NAME: 'ธนาคารทดสอบ', BANK_ACCOUNT_NO: '123-4-56789-0',
    NOTIFY_EMAIL: 'team@example.com', CUSTOMER_ACK: '1', CUSTOMER_NOTIFY: '1' });
  const listAll = async () => (await api({ action: 'list', token: TOKEN, limit: 2000 })).tickets || [];
  const row = async id => (await listAll()).find(t => t.id === id);

  /* ======== A · the Apps Script contract (tests/backoffice.mjs, ported) ======== */
  IP = '127.0.1.1';
  const hg = await http(S1, 'GET', '/exec'), hj = JSON.parse(hg.body);
  ok(hg.status === 200 && hj.ok === true && hj.service && hj.version, 'GET /exec health', hj);
  const r1 = await api({ action: 'create', ticket: base() });
  ok(r1.ok && r1.id === ID0 + '001', 'create returns the first id of the day (SBP-<พ.ศ.><เดือนวัน>-001)', r1);
  ok(r1.status === 'new' && r1.statusTh === 'รับคำขอแล้ว รอยืนยัน' && !r1.repeat, 'create status new', r1);
  const r2 = await api({ action: 'create', ticket: base({ customer: { name: 'ลูกค้า 2', tel: '0899999999' }, slot: 'PM' }) });
  ok(r2.ok && r2.id === ID0 + '002', 'sequence ids …-001 → …-002', r2);
  const L0 = await listAll(), x1 = L0.find(t => t.id === r1.id);
  ok(x1 && x1.tel === TEL && x1.status === 'new' && x1.kind === 'booking' && x1.units === '{"wall":3,"cassette":1}' && x1.teamDays === 0.3 && x1.prefDate === day(2) && x1.slot === 'AM', 'row fields (phone keeps its leading zero)', x1);
  const bad = async (t, code, msg) => { const r = await api({ action: 'create', ticket: t }); ok(r.ok === false && r.error === code, msg, r); };
  await bad(base({ customer: { name: 'x', tel: '12345' } }), 'bad_tel', 'bad phone rejected');
  await bad(base({ customer: { name: '', tel: '0812345670' } }), 'bad_name', 'missing name rejected');
  await bad(base({ consent: false, customer: { name: 'ก', tel: '0812345671' } }), 'no_consent', 'no consent rejected');
  await bad(base({ consent: 'true', customer: { name: 'ก', tel: '0812345671' } }), 'no_consent', 'consent must be the boolean true');
  await bad(base({ prefDate: day(-1), customer: { name: 'ก', tel: '0812345672' } }), 'bad_date', 'past date rejected');
  await bad(base({ kind: 'spam', customer: { name: 'ก', tel: '0812345673' } }), 'bad_kind', 'unknown kind rejected');
  await bad(base({ website: 'http://spam', customer: { name: 'ก', tel: '0812345674' } }), 'rejected', 'honeypot rejected');
  await bad(base({ customer: { name: 'ก', tel: '0812345675', email: 'not-an-email' } }), 'bad_email', 'bad email rejected');
  ok((await api('{not json')).error === 'bad_json', 'bad json');
  ok((await api({ action: 'nope' })).error === 'unknown_action', 'unknown action');
  ok((await api('[1,2]')).error === 'unknown_action' && (await api('null')).error === 'unknown_action', 'a non-object body is an unknown action');
  ok((await api('x'.repeat(40000))).error === 'too_large', 'oversized body (over 30,000 characters, same as Code.gs)');
  const huge = await api(JSON.stringify({ action: 'create', ticket: base({ details: 'x'.repeat(70000) }) }));
  ok(huge.ok === false && huge.error === 'too_large' && !huge.httpStatus, 'body over 64 KB still gets the JSON reply too_large (not a dropped connection)', huge);
  // formula-like text is stored as text
  const r3 = await api({ action: 'create', ticket: base({ customer: { name: '=HYPERLINK("http://evil","x")', tel: '0861111111' }, notes: '+cmd|calc', details: '@SUM(A1)' }) });
  ok(r3.ok, 'formula-like text accepted as text', r3);
  // quote lines + tax invoice (browser lines without keys stay unverified, survey lines stay unpriced)
  const r4 = await api({ action: 'create', ticket: base({ kind: 'quote', prefDate: '', slot: '', customer: { name: 'บริษัท ทดสอบ จำกัด', tel: '021234567', taxInvoice: true, taxName: 'บริษัท ทดสอบ จำกัด (สำนักงานใหญ่)', taxId: '0105555555555' },
    quote: { totalEx: 12300, lines: [{ name: 'ล้างปกติ ติดผนัง 9,000-18,000 BTU', qty: 3, unitEx: 800 }, { name: 'รื้อแอร์ติดผนัง', qty: 1, unitEx: null }] } }) });
  const L1 = await listAll(), x3 = L1.find(t => t.id === r3.id), x4 = L1.find(t => t.id === r4.id);
  ok(x3 && x3.name === '=HYPERLINK("http://evil","x")' && x3.notes === '+cmd|calc' && x3.details === '@SUM(A1)', 'formula text kept literally', x3 && [x3.name, x3.notes, x3.details]);
  ok(r4.ok && x4 && x4.taxInvoice === 'ใช่' && x4.taxId === '0105555555555' && /ประเมินหน้างาน/.test(x4.quoteLines), 'quote + tax invoice stored', x4 && [x4.taxInvoice, x4.taxId, x4.quoteLines]);
  ok(x4 && x4.priceCheck && x4.priceCheck.verified === false && x4.priceCheck.payable === false, 'lines without a key are flagged unverified (never payable)', x4 && x4.priceCheck);
  // rate limit: 5 per phone per hour
  { const tel = '0870000000'; let last; for (let i = 0; i < 6; i++) last = await api({ action: 'create', ticket: base({ customer: { name: 'ซ้ำ', tel } }) }, { ip: '127.0.1.2' });
    ok(last.error === 'rate_limited', 'sixth ticket from the same phone is rate limited', last); }
  // track: status only
  const t1 = await api({ action: 'track', id: r1.id, tel: TEL });
  ok(t1.ok && t1.ticket.status === 'new' && t1.ticket.statusTh && !('staffNote' in t1.ticket) && !('name' in t1.ticket) && !('notes' in t1.ticket) && !('tel' in t1.ticket) && !('history' in t1.ticket) && !JSON.stringify(t1).includes('คุณทดสอบ'), 'track returns status only (no names/notes)', t1);
  ok((await api({ action: 'track', id: r1.id, tel: '081-234-5678' })).ok, 'track accepts the phone with dashes');
  ok(!('payment' in t1.ticket), 'track has no payment block before the office asks for money', t1.ticket);
  ok((await api({ action: 'track', id: r1.id, tel: '0899999999' })).error === 'not_found', 'track with wrong phone = not found');
  ok((await api({ action: 'track', id: 'SBP-000000-999', tel: TEL })).error === 'not_found', 'track unknown id');
  ok((await api({ action: 'track', id: r1.id, tel: '' })).error === 'not_found', 'track without phone');
  // staff auth + list
  ok((await api({ action: 'list' })).error === 'unauthorized', 'list needs a token');
  ok((await api({ action: 'list', token: 'wrong' })).error === 'unauthorized', 'list with a wrong token');
  const L = await api({ action: 'list', token: TOKEN });
  const newestFirst = L.tickets && L.tickets.every((t, i, a) => !i || a[i - 1].createdAt > t.createdAt || (a[i - 1].createdAt === t.createdAt && a[i - 1].id > t.id));
  ok(L.ok && L.tickets.length >= 4 && newestFirst && L.tickets[0].id > L.tickets[L.tickets.length - 1].id && !('payload' in L.tickets[0]) && L.teams.length === 3, 'list newest first, no raw payload, 3 teams', L.tickets && L.tickets.map(t => t.id));
  ok(L.statuses && L.statuses.new && L.slots && L.slots.AM && L.capacity === 2 && Object.keys(L.tickets[0]).length >= 34, 'list carries statuses / slots / capacity + the 34 sheet columns', L.tickets && Object.keys(L.tickets[0]).length);
  // update
  ok((await api({ action: 'update', token: TOKEN, id: r1.id, patch: { status: 'bogus' } })).error === 'bad_status', 'bad status rejected');
  ok((await api({ action: 'update', token: TOKEN, id: r1.id, patch: { team: 'ทีม 9' } })).error === 'bad_team', 'unknown team rejected');
  ok((await api({ action: 'update', token: TOKEN, id: 'SBP-000000-999', patch: { status: 'done' } })).error === 'not_found', 'update unknown id');
  const U = await api({ action: 'update', token: TOKEN, id: r1.id, staff: 'แอดมิน', patch: { status: 'confirmed', team: 'ทีม 1', schedDate: day(3), schedSlot: 'PM', staffNote: 'ลูกค้าขอให้โทรก่อน 30 นาที' } });
  ok(U.ok && U.ticket.status === 'confirmed' && U.ticket.team === 'ทีม 1' && U.ticket.schedDate === day(3) && U.ticket.schedSlot === 'PM', 'update applies', U);
  const hist = U.ok ? JSON.parse(U.ticket.history) : [];
  ok(hist.length === 2 && hist[0].by === 'เว็บไซต์' && hist[1].by === 'แอดมิน' && hist[1].s === 'new→confirmed', 'history records who changed what', hist);
  const t2 = await api({ action: 'track', id: r1.id, tel: TEL });
  ok(t2.ticket && t2.ticket.status === 'confirmed' && t2.ticket.schedDate === day(3) && t2.ticket.schedSlot === 'PM' && t2.ticket.team === 'จัดทีมแล้ว' && !JSON.stringify(t2).includes('โทรก่อน') && !JSON.stringify(t2).includes('ทีม 1'), 'customer sees schedule, not the staff note or team name', t2);
  ok((await api({ action: 'update', token: 'nope', id: r1.id, patch: { status: 'done' } })).error === 'unauthorized', 'update needs a token');
  // slots: bookings on the scheduled (else preferred) day, never names
  const S = await api({ action: 'slots', from: day(0), days: 7 });
  const d3 = S.days && S.days.find(x => x.date === day(3)), d2 = S.days && S.days.find(x => x.date === day(2));
  ok(S.ok && S.capacity === 2 && S.days.length === 7 && S.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && [d.AM, d.PM, d.EVE].every(Number.isInteger)), 'slots shape', S);
  ok(d3 && d3.PM === 1 && d2.PM === 1 && d2.AM >= 2, 'slot counts follow schedule / preference', { d2, d3 });
  ok(!/ทดสอบ|0812345678|example\.com|ลูกค้า/.test(JSON.stringify(S)), 'slots carry no customer data');
  await api({ action: 'update', token: TOKEN, id: r2.id, patch: { status: 'cancelled' } });
  const S2s = await api({ action: 'slots', from: day(0), days: 7 });
  ok(S2s.days.find(x => x.date === day(2)).PM === d2.PM - 1, 'cancelled bookings free the slot');
  // anonymous website feedback: stored, never trackable; a wrong phone is still rejected
  const fb = await api({ action: 'create', ticket: { kind: 'feedback', customer: {}, details: 'ใช้งานง่าย 5', source: 'server test' } });
  const xf = fb.ok && await row(fb.id);
  ok(fb.ok && xf && xf.name === 'ไม่ระบุชื่อ' && xf.tel === '', 'anonymous feedback stored as ไม่ระบุชื่อ', xf);
  ok((await api({ action: 'track', id: fb.id, tel: '' })).error === 'not_found' && (await api({ action: 'track', id: fb.id, tel: '0' })).error === 'not_found', 'anonymous feedback is not trackable');
  await bad({ kind: 'feedback', customer: { tel: '123' } }, 'bad_tel', 'feedback with a bad phone rejected');
  // Rev.10 UX: feedback that carries a phone is personal data → consent like every request; anonymous feedback stays consent-free
  await bad({ kind: 'feedback', customer: { name: 'สมชาย', tel: '0812225555' }, details: 'x' }, 'no_consent', 'feedback with a phone and no consent rejected');
  const fbc = await api({ action: 'create', ticket: { kind: 'feedback', consent: true, customer: { name: 'สมชาย', tel: '0812225555' }, details: 'x' } });
  const cRows = dbRows(D1, `SELECT id, consentText, consentAt FROM tickets WHERE id IN (?, ?)`, fb.id, fbc.id || '-');
  ok(fbc.ok && cRows.find(x => x.id === fbc.id)?.consentText.includes('ตามประกาศความเป็นส่วนตัว') && cRows.find(x => x.id === fb.id)?.consentText === '', 'feedback with a phone + consent stores the consent sentence; anonymous feedback none', cRows);
  // Rev.10 UX: the IP is kept as an HMAC under a server-only key (DATA_DIR/ip-hash.key), not a plain hash an IPv4 scan reverses
  const ipKey = existsSync(join(D1, 'ip-hash.key')) ? readFileSync(join(D1, 'ip-hash.key'), 'utf8').trim() : '';
  const ipRow = dbRows(D1, `SELECT ipHash FROM tickets WHERE id = ?`, r1.id)[0] || {};
  ok(ipKey.length >= 32 && ipRow.ipHash === createHmac('sha256', ipKey).update('ip:127.0.1.1').digest('hex').slice(0, 16) && ipRow.ipHash !== createHash('sha256').update('ip:127.0.1.1').digest('hex').slice(0, 16), 'ipHash = HMAC with the key kept in DATA_DIR (never the plain sha-256 of the address)', ipRow);
  await bad({ kind: 'inquiry', consent: true, customer: { name: 'ไม่มีเบอร์' } }, 'bad_tel', 'inquiry still needs a phone');

  /* ======== B · Rev.10 fixes ======== */
  IP = '127.0.2.1';
  for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) await bad(base({ kind: k, customer: { name: 'ก', tel: '0812345676' } }), 'bad_kind', `prototype key "${k}" is not a kind`);
  for (const s of ['toString', 'constructor', '__proto__', 'valueOf']) ok((await api({ action: 'update', token: TOKEN, id: r3.id, patch: { status: s } })).error === 'bad_status', `prototype key "${s}" is not a status`);
  const rp = await api({ action: 'create', ticket: base({ service: 'hasOwnProperty', slot: 'constructor', customer: { name: 'โปรโตไทป์', tel: '0812345677' } }) });
  const xp = rp.ok && await row(rp.id);
  ok(xp && xp.service === 'other' && xp.slot === '', 'prototype keys as service / slot fall back to the defaults', xp && [xp.service, xp.slot]);
  await bad(base({ prefDate: '2099-13-45', customer: { name: 'ก', tel: '0812345678' } }), 'bad_date', 'impossible date 2099-13-45 rejected');
  await bad(base({ prefDate: '2027-02-30', customer: { name: 'ก', tel: '0812345678' } }), 'bad_date', 'impossible date 2027-02-30 rejected');
  await bad(base({ prefDate: day(370), customer: { name: 'ก', tel: '0812345678' } }), 'bad_date', 'preferred date more than a year ahead rejected');
  ok((await api({ action: 'update', token: TOKEN, id: r3.id, patch: { schedDate: '2099-13-45' } })).error === 'bad_date', 'impossible schedDate rejected on update');
  const sx = await api({ action: 'slots', from: '2099-13-45', days: 3 });
  ok(sx.ok && sx.days.length === 3 && sx.days[0].date === day(0), 'slots with an impossible from-date fall back to today', sx);
  // idempotent create: same rid + same phone → the stored ticket
  const ridT = base({ rid: 'srv-test-rid-0001', customer: { name: 'ส่งซ้ำ', tel: '0855555555' } });
  const i1 = await api({ action: 'create', ticket: ridT }), n1 = (await listAll()).length;
  const i2 = await api({ action: 'create', ticket: ridT }), n2 = (await listAll()).length;
  ok(i1.ok && !i1.repeat && i2.ok && i2.repeat === true && i2.id === i1.id && n2 === n1, 'idempotent rid: a retry returns the same id with repeat:true, nothing new stored', [i1, i2, n1, n2]);
  const i3 = await api({ action: 'create', ticket: { ...ridT, customer: { name: 'คนอื่น', tel: '0866666666' } } });
  ok(i3.ok && !i3.repeat && i3.id !== i1.id, 'the same rid from another phone is a new ticket', i3);
  const ia = await api({ action: 'create', ticket: base({ rid: ['srv-test-rid-0002'], customer: { name: 'rid แบบ array', tel: '0855555556' } }) });
  ok(ia.ok === true && !ia.repeat, 'a rid that is not a string is ignored (no server error)', ia);
  // a small but deeply nested body (5,000 levels ≈ 10 KB) once overflowed String()/JSON.stringify() inside the handlers
  { let deep = '0'; for (let i = 0; i < 5000; i++) deep = '[' + deep + ']';
    const r = await api(`{"action":"create","ticket":${JSON.stringify(base({ customer: { name: 'ลึก', tel: '0855555557' } })).slice(0, -1)},"details":${deep}}}`);
    ok(r.ok === false && r.error === 'bad_json', 'deeply nested JSON → bad_json (no server error)', r);
    ok((await api(`{"action":"login","user":${deep},"password":"x"}`)).error === 'bad_json', 'deeply nested login → bad_json');
    ok((await api({ action: 'create', ticket: base({ customer: { name: 'ซ้อน "[[[" ในข้อความ', tel: '0855555558' }, details: '[[[['.repeat(40) + '{{{{'.repeat(40) }) })).ok, 'brackets inside strings do not count as nesting'); }

  /* ======== C · server-side pricing ======== */
  IP = '127.0.3.1';
  const P1 = await api({ action: 'create', ticket: base({ customer: { name: 'ราคาตรง', tel: '0831000001' }, units: { wall: 2 }, quote: quote([CL(2)], { totalEx: MIN, vat: 0, total: MIN, travel: 0, minGap: MIN - 2 * CLR }) }) });
  const P2 = await api({ action: 'create', ticket: base({ customer: { name: 'ราคาถูกแก้', tel: '0831000002' }, units: { wall: 6 }, quote: quote([CL(6, 100)], { totalEx: 600, total: 600, vat: 0, travel: 0, minGap: 0 }) }) });
  const P3 = await api({ action: 'create', ticket: base({ customer: { name: 'ต่างจังหวัด', tel: '0831000003', taxInvoice: true, taxName: 'บริษัท นครปฐม จำกัด', taxId: '0735555555555' }, units: { wall: 1 }, site: { address: '1 ถ.เพชรเกษม', area: 'นครปฐม' },
    quote: quote([CL(1), { name: SV.name, key: 'S-' + SV.code, group: 'install', kind: 'survey', qty: 1, unitEx: 5000 }], { tax: 'invoice', zoneInput: 'นครปฐม' }) }) });
  const P4 = await api({ action: 'create', ticket: base({ customer: { name: 'ต่างจังหวัด 4 เครื่อง', tel: '0831000004' }, units: { wall: 4 }, site: { area: 'นครปฐม' }, quote: quote([CL(4)], { zoneInput: 'นครปฐม' }) }) });
  const P5 = await api({ action: 'create', ticket: base({ kind: 'quote', service: 'buy', customer: { name: 'ซื้อเครื่อง', tel: '0831000005' }, quote: quote([{ name: SKU.sku, key: 'P-' + SKU.sku, group: 'product', kind: 'product', qty: 1, unitEx: SKU.px }]) }) });
  ok([P1, P2, P3, P4, P5].every(r => r.ok), 'pricing tickets stored', [P1, P2, P3, P4, P5]);
  const LC = await listAll(), y = id => LC.find(t => t.id === id) || {};
  const y1 = y(P1.id), y2 = y(P2.id), y3 = y(P3.id), y4 = y(P4.id), y5 = y(P5.id);
  ok(y1.priceCheck && y1.priceCheck.verified && y1.priceCheck.match && y1.priceCheck.payable && !y1.priceCheck.issues.length && y1.quoteTotalEx === MIN && y1.travelFee === '' && y1.zoneTier === 'core', 'honest quote: verified, matching, payable; server total stored', y1.priceCheck);
  ok(y2.priceCheck && y2.priceCheck.match === false && y2.priceCheck.issues.some(i => i.line === 0 && i.check === 'mismatch' && i.client === 100 && i.server === CLR) && y2.priceCheck.issues.some(i => i.total === 'totalEx' && i.client === 600 && i.server === MIN),
    'tampered unitEx is flagged in list priceCheck', y2.priceCheck);
  ok(y2.quoteTotalEx === MIN && y2.quoteTotalEx !== 600 && y2.quoteLines.includes(`× 6 = ฿${(6 * CLR).toLocaleString('en-US')}`) && y2.quoteLines.includes('ส่วนเติมยอดขั้นต่ำงานล้าง'), 'stored quoteTotalEx / lines are the server\'s figures, not the browser\'s', [y2.quoteTotalEx, y2.quoteLines]);
  const pd2 = await api({ action: 'paydetail', id: P2.id, token: TOKEN });
  ok(pd2.ok && pd2.quote.lines[0].unitEx === CLR && pd2.quote.lines[0].clientUnitEx === 100 && pd2.quote.client.totalEx === 600 && pd2.quote.totals.totalEx === MIN, 'quote lines re-priced from their keys (browser figure kept beside)', pd2.quote && pd2.quote.lines);
  const pd3 = await api({ action: 'paydetail', id: P3.id, token: TOKEN }), q3 = pd3.quote || { lines: [{}, {}], totals: {} };
  ok(q3.lines[1].unitEx === null && q3.lines[1].kind === 'survey' && q3.lines[1].check === 'survey_has_price' && /ประเมินหน้างาน/.test(y3.quoteLines) && !/5000|5,000/.test(y3.quoteLines), 'survey lines are never priced (a sent price is ignored and flagged)', q3.lines[1]);
  const zNP = core.checkZone('นครปฐม'), ex3 = CLR + zNP.fee + (MIN - CLR);
  ok(zNP.tier === 'extended' && q3.zone && q3.zone.tier === 'extended' && q3.totals.travel === zNP.fee && y3.travelFee === zNP.fee && y3.zoneTier === 'extended', 'travel for an extended zone (นครปฐม) computed by the server', [q3.zone, q3.totals]);
  ok(y3.quoteTotalEx === ex3 && q3.totals.totalEx === ex3 && q3.totals.tax === 'invoice' && q3.totals.vat === core.vatOf(ex3) && q3.totals.total === ex3 + core.vatOf(ex3) && y3.priceCheck.payable === false, 'tax invoice: VAT 7% on the server total; survey line → not payable', q3.totals);
  ok(y4.travelFee === '' && y4.quoteTotalEx === MIN, 'travel waived from 4 machines in the 60 km band', [y4.travelFee, y4.quoteTotalEx]);
  ok(y5.priceCheck && y5.priceCheck.verified && y5.priceCheck.payable === false && y5.quoteTotalEx === SKU.px, 'a product line is priced but not payable (stock confirmed first)', y5.priceCheck);

  /* ======== E · staff accounts ======== */
  const lg = (user, password, ip) => api({ action: 'login', user, password }, { ip });
  const la = await lg('admin', PW, '127.0.5.1');
  ok(la.ok && typeof la.token === 'string' && la.token.length >= 40 && la.token !== PW && la.name === 'แอดมินทดสอบ' && la.role === 'admin' && la.roleTh === 'ผู้ดูแล', 'login ok: session token + name + role', { ...la, token: la.token && la.token.length });
  const ls = await lg('staff1', PW, '127.0.5.1'), lt = await lg('tech1', PW, '127.0.5.1');
  ok(ls.ok && ls.role === 'staff' && lt.ok && lt.role === 'tech' && lt.roleTh === 'ช่าง', 'staff and tech accounts log in with their roles', [ls.role, lt.role]);
  ok((await lg('admin', 'wrong-password-0', '127.0.5.1')).error === 'unauthorized', 'wrong password → unauthorized');
  ok((await lg('nobody', PW, '127.0.5.1')).error === 'unauthorized' && (await lg('', '', '127.0.5.1')).error === 'unauthorized', 'unknown / empty user → unauthorized');
  { let all = true; for (let i = 0; i < 12; i++) { const r = await lg('staff1', PW, '127.0.5.2'); all = all && r.ok; } ok(all, '12 successful logins in a row all succeed (only failures count)'); }
  for (let i = 0; i < 9; i++) await lg('ghost' + i, 'wrong-password-0', '127.0.5.3');
  ok((await lg('admin', PW, '127.0.5.3')).ok, '9 failed attempts from one address: a correct login still works');
  await lg('ghost9', 'wrong-password-0', '127.0.5.3');
  ok((await lg('admin', PW, '127.0.5.3')).error === 'rate_limited', 'after 10 failed attempts the address is rate limited (even a correct password)');
  ok((await lg('admin', PW, '127.0.5.4')).ok, 'other addresses are not affected');
  for (let i = 0; i < 10; i++) await lg('lockme', 'wrong-password-0', '127.0.6.' + (i + 1));
  ok((await lg('lockme', PW, '127.0.6.50')).error === 'rate_limited', 'after 10 failed attempts on one username it is rate limited from any address');
  ok((await lg('admin', PW, '127.0.6.50')).ok, 'other usernames are not affected');
  IP = '127.0.5.9';
  const me = await api({ action: 'me', token: la.token });
  ok(me.ok && me.name === 'แอดมินทดสอบ' && me.role === 'admin' && me.roleTh === 'ผู้ดูแล', 'me: who is logged in', me);
  const Ls = await api({ action: 'list', token: ls.token });
  ok(Ls.ok && Array.isArray(Ls.tickets) && Ls.tickets.length >= 10, 'a session token works for list');
  const lo = await lg('staff1', PW, '127.0.5.9');
  ok((await api({ action: 'logout', token: lo.token })).ok && (await api({ action: 'me', token: lo.token })).error === 'unauthorized' && (await api({ action: 'list', token: lo.token })).error === 'unauthorized', 'logout invalidates the session');
  ok((await api({ action: 'me', token: ls.token })).ok, 'logout ends only that session');
  const lm = await api({ action: 'me', token: TOKEN, staff: 'คุณเลกาซี' });
  ok(lm.ok && lm.role === 'admin' && lm.name === 'คุณเลกาซี', 'legacy STAFF_TOKEN works as admin, name from the staff field', lm);
  const hu = await api({ action: 'update', token: ls.token, staff: 'ชื่อที่พิมพ์เอง', id: r1.id, patch: { staffNote: 'ตรวจสอบแล้ว' } });
  const hb = hu.ok ? JSON.parse(hu.ticket.history) : [];
  ok(hu.ok && hb.at(-1).by === 'เจ้าหน้าที่ทดสอบ' && hb.at(-1).note === 1, 'history by = the logged-in account name (not the typed one)', hb.at(-1));
  const A = { token: la.token }, St = { token: ls.token }, T = { token: lt.token };

  /* ======== D · payments ======== */
  IP = '127.0.4.1';
  const PTEL = '0823456789', Q6 = quote([CL(6)], { tax: 'invoice' }), tot6 = MIN + core.vatOf(MIN);   // 6 × 700 + minimum gap = 4,500 + VAT 315
  const PT = await api({ action: 'create', ticket: base({ customer: { name: 'คุณชำระ เงิน', tel: PTEL, email: 'pay@example.com', taxInvoice: true, taxName: 'บริษัท ชำระ จำกัด', taxId: '0105555555555' }, units: { wall: 6 }, quote: Q6 }) });
  ok(PT.ok, 'payable ticket stored', PT);
  const pd0 = await api({ action: 'paydetail', id: PT.id, ...A });
  ok(pd0.ok && pd0.suggested && pd0.suggested.amount === tot6 && pd0.suggested.basis === 'server_quote' && pd0.suggested.tax === 'invoice' && pd0.suggested.totalEx === MIN && pd0.suggested.vat === core.vatOf(MIN), 'paydetail: suggested amount for a payable quote', pd0.suggested);
  ok(pd0.ok && pd0.summary === null && !pd0.requests.length && pd0.can.request && pd0.can.verify && pd0.can.refund && pd0.payee.promptpay === '0xxxxxxxx5555' && pd0.payee.bank.accountNo === '123-4-56789-0', 'paydetail shape (no money yet, admin can do everything)', pd0);
  ok((await api({ action: 'paydetail', id: 'SBP-000000-999', ...A })).error === 'not_found', 'paydetail unknown id');
  ok((await api({ action: 'payreq', id: PT.id, kind: 'full', ...T })).error === 'forbidden', 'tech cannot ask for money');
  ok((await api({ action: 'payreq', id: PT.id, kind: 'toString', ...A })).error === 'bad_kind', 'payreq bad kind');
  for (const a of ['0', '-100', 'abc', '1.005', '0.50', '1e5']) ok((await api({ action: 'payreq', id: PT.id, kind: 'deposit', amount: a, ...A })).error === 'bad_amount', `bad_amount for "${a}"`);
  const pr = await api({ action: 'payreq', id: PT.id, kind: 'full', ...A }), rq = pr.requests && pr.requests[0];
  ok(pr.ok && pr.requests.length === 1 && rq.amount === tot6 && rq.status === 'open' && rq.basis === 'server_quote' && /^[2-9A-HJ-NP-Z]{6}$/.test(rq.ref) && rq.expiresAt === day(7) && rq.createdBy === 'แอดมินทดสอบ', 'payreq without amount uses the suggested server figure', rq);
  ok(pr.suggested === null && pr.summary.status === 'unpaid' && pr.summary.due === tot6, 'after the request: nothing left to suggest, money status unpaid', [pr.suggested, pr.summary]);
  const tp = await api({ action: 'track', id: PT.id, tel: PTEL }), py = tp.ticket && tp.ticket.payment;
  ok(py && py.status === 'unpaid' && py.statusTh === 'รอชำระ' && py.due === tot6 && py.paid === 0 && py.pending === false && py.methods.join() === 'promptpay,transfer,onsite' && py.payee === 'บริษัท สหบูรพากรุ๊ป จำกัด', 'track shows the payment block', py);
  ok(py && py.requests.length === 1 && py.requests[0].id === rq.id && py.requests[0].amount === tot6 && py.requests[0].remaining === tot6 && py.requests[0].ref === rq.ref && py.requests[0].submitted === false && !py.receipts.length, 'track: the open request with its reference', py && py.requests);
  ok(!/แอดมินทดสอบ|createdBy|basis|note/.test(JSON.stringify(tp)), 'track shows no staff names / internal fields', tp);
  // pay: PromptPay (payload + QR), transfer, on site
  const pp = await api({ action: 'pay', id: PT.id, tel: PTEL, req: rq.id, method: 'promptpay' }), P = pp.pay || {};
  ok(pp.ok && P.method === 'promptpay' && P.amount === tot6 && P.amountTh === tot6.toLocaleString('en-US') && P.ref === rq.ref && P.promptpay === '0xxxxxxxx5555' && P.payee === 'บริษัท สหบูรพากรุ๊ป จำกัด' && /^data:image\/svg\+xml;base64,/.test(P.qr || ''), 'pay promptpay returns payload + data URL QR', { ...P, qr: (P.qr || '').slice(0, 40) });
  ok(crc16('123456789') === '29B1', 'test CRC-16/CCITT-FALSE check value');
  const pl = P.payload || '', tg = tlv(pl), t29 = tlv(tg['29'] || '');
  ok(pl.slice(-8, -4) === '6304' && crc16(pl.slice(0, -4)) === pl.slice(-4), 'PromptPay payload CRC is valid', pl);
  ok(tg['00'] === '01' && tg['01'] === '12' && t29['00'] === 'A000000677010111' && t29['02'] === '0105555555555' && tg['53'] === '764' && tg['54'] === tot6.toFixed(2) && tg['58'] === 'TH', 'payload: PromptPay id (tag 29/02), THB, amount tag 54, dynamic QR', tg);
  browser = await launch();
  const qp = await (await browser.newContext()).newPage();
  const decodeQr = async dataUrl => {
    const px = await qp.evaluate(async src => {
      const blob = await (await fetch(src)).blob(), url = URL.createObjectURL(blob);   // blob: is same-origin → the canvas is never tainted
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
      const u = g.getImageData(0, 0, c.width, c.height).data; let s = '';
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return { w: c.width, h: c.height, b64: btoa(s) };
    }, dataUrl);
    const q = jsQR(new Uint8ClampedArray(Buffer.from(px.b64, 'base64')), px.w, px.h);
    return { text: q ? q.data : null, w: px.w };
  };
  const qr = P.qr ? await decodeQr(P.qr) : { text: null };
  ok(qr.text && qr.text === pl, 'QR decoded from pixels (Chromium canvas + jsQR) equals the payload', { decoded: qr.text, payload: pl, w: qr.w });
  ok(qr.text && crc16(qr.text.slice(0, -4)) === qr.text.slice(-4) && qr.text.includes('0213' + '0105555555555') && tlv(qr.text)['54'] === tot6.toFixed(2), 'decoded QR: valid CRC, PromptPay id, amount tag 54', qr.text);
  const ptf = await api({ action: 'pay', id: PT.id, tel: PTEL, req: rq.id, method: 'transfer' });
  ok(ptf.ok && ptf.pay.method === 'transfer' && ptf.pay.bank && ptf.pay.bank.name === 'ธนาคารทดสอบ' && ptf.pay.bank.accountNo === '123-4-56789-0' && ptf.pay.bank.accountName === 'บริษัท สหบูรพากรุ๊ป จำกัด' && !ptf.pay.payload, 'pay transfer returns the bank account', ptf);
  const pos = await api({ action: 'pay', id: PT.id, tel: PTEL, req: rq.id, method: 'onsite' });
  ok(pos.ok && pos.pay.method === 'onsite' && pos.pay.amount === tot6, 'pay onsite ok', pos);
  ok((await api({ action: 'pay', id: PT.id, tel: PTEL, req: rq.id, method: 'gateway' })).error === 'pay_unavailable', 'gateway is off without keys');
  ok((await api({ action: 'pay', id: PT.id, tel: PTEL, req: rq.id, method: 'cash' })).error === 'bad_method', 'pay: unknown method');
  ok((await api({ action: 'pay', id: PT.id, tel: '0899999999', req: rq.id, method: 'promptpay' })).error === 'not_found', 'pay: wrong phone = not found');
  ok((await api({ action: 'pay', id: PT.id, tel: PTEL, req: 'PR-NOPE', method: 'promptpay' })).error === 'pay_closed', 'pay: unknown request = closed');
  // the customer reports the transfer → SUBMITTED, not paid
  const pdn = await api({ action: 'paid', id: PT.id, tel: PTEL, req: rq.id, method: 'promptpay', reference: 'TX-0001' });
  ok(pdn.ok && pdn.payment && pdn.payment.pending === true && pdn.payment.status === 'checking' && pdn.payment.statusTh === 'รอตรวจยอด' && pdn.payment.paid === 0 && pdn.payment.due === tot6 && pdn.payment.requests[0].submitted === true && pdn.payment.requests[0].rejected === false, 'paid → submitted + pending: รอตรวจยอด, nothing counted as paid', pdn.payment);
  await api({ action: 'paid', id: PT.id, tel: PTEL, req: rq.id, method: 'promptpay', reference: 'TX-0001' });
  const pd1 = await api({ action: 'paydetail', id: PT.id, ...A }), pm = pd1.payments || [];
  ok(pm.length === 1 && pm[0].status === 'submitted' && pm[0].byWho === 'ลูกค้า' && pm[0].receiptNo == null && pm[0].amount === tot6 && pd1.summary.pending === 1, 'one submitted payment (a repeated report is not doubled)', pm);
  ok((await api({ action: 'payverify', payment: pm[0] && pm[0].id, decision: 'verify', ...T })).error === 'forbidden', 'tech: payverify → forbidden');
  ok((await api({ action: 'payverify', payment: pm[0] && pm[0].id, decision: 'maybe', ...A })).error === 'bad_decision', 'payverify bad decision');
  const pv = await api({ action: 'payverify', payment: pm[0] && pm[0].id, decision: 'verify', ...A }), pv0 = (pv.payments || [])[0] || {};
  ok(pv.ok && pv0.status === 'verified' && pv0.receiptNo === RC0 + '0001' && pv0.verifiedBy === 'แอดมินทดสอบ', 'verify → receipt number RC<ปี><เดือน>-0001', pv0);
  ok(pv.ok && pv.requests[0].status === 'paid' && pv.summary.status === 'paid' && pv.summary.paid === tot6 && pv.summary.due === 0 && pv.summary.pending === 0, 'the request settles to paid', [pv.requests && pv.requests[0], pv.summary]);
  ok((await api({ action: 'payverify', payment: pm[0] && pm[0].id, decision: 'verify', ...A })).error === 'pay_closed', 'a verified payment cannot be verified twice');
  const tp2 = await api({ action: 'track', id: PT.id, tel: PTEL }), py2 = tp2.ticket && tp2.ticket.payment;
  ok(py2 && py2.status === 'paid' && py2.statusTh === 'ชำระครบแล้ว' && py2.pending === false && py2.receipts.length === 1 && py2.receipts[0].no === RC0 + '0001' && py2.receipts[0].amount === tot6 && py2.receipts[0].method === 'พร้อมเพย์ (QR)' && py2.requests[0].remaining === 0, 'track shows the receipt', py2);
  ok(!JSON.stringify(tp2).includes('แอดมินทดสอบ'), 'track shows no staff name after verification');
  ok((await api({ action: 'pay', id: PT.id, tel: PTEL, req: rq.id, method: 'promptpay' })).error === 'pay_closed', 'a paid request cannot be paid again');
  ok((await api({ action: 'payvoid', req: rq.id, reason: 'x', ...A })).error === 'pay_closed', 'payvoid: a paid request cannot be voided');
  // non-payable quotes need a typed amount
  ok((await api({ action: 'payreq', id: P3.id, kind: 'full', ...A })).error === 'amount_required', 'payreq without amount on a non-payable quote (survey line) → amount_required');
  ok((await api({ action: 'payreq', id: P5.id, kind: 'full', ...A })).error === 'amount_required', 'payreq without amount on a product quote → amount_required');
  ok((await api({ action: 'payreq', id: r3.id, kind: 'full', amount: '', ...A })).error === 'amount_required', 'payreq without amount on a ticket without a quote → amount_required');
  const pr3 = await api({ action: 'payreq', id: P3.id, kind: 'deposit', amount: '1500.50', ...St }), rq3 = (pr3.requests || [])[0] || {};
  ok(pr3.ok && rq3.amount === 1500.5 && rq3.basis === 'staff_confirmed' && rq3.kind === 'deposit' && rq3.createdBy === 'เจ้าหน้าที่ทดสอบ', 'payreq with a typed amount (2 decimals) by a staff account', rq3);
  const pp3 = await api({ action: 'pay', id: P3.id, tel: '0831000003', req: rq3.id, method: 'promptpay' });
  ok(pp3.ok && pp3.pay.amount === 1500.5 && pp3.pay.amountTh === '1,500.50' && tlv(pp3.pay.payload)['54'] === '1500.50', 'satang amounts reach the QR payload exactly (tag 54 = 1500.50)', pp3.pay && [pp3.pay.amount, pp3.pay.amountTh]);
  const qr3 = pp3.ok ? await decodeQr(pp3.pay.qr) : { text: null };
  ok(qr3.text === pp3.pay.payload, 'second QR decodes to its payload too', qr3.text);
  // a technician records cash on site → submitted; the office verifies → the next receipt number
  ok((await api({ action: 'payrecord', id: P3.id, req: rq3.id, method: 'gateway', amount: '500', ...T })).error === 'bad_method', 'payrecord: gateway cannot be typed in');
  for (const a of ['0', '-5', 'ห้าร้อย', '']) ok((await api({ action: 'payrecord', id: P3.id, req: rq3.id, method: 'cash', amount: a, ...T })).error === 'bad_amount', `payrecord bad_amount for "${a}"`);
  const rc = await api({ action: 'payrecord', id: P3.id, req: rq3.id, method: 'cash', amount: '500', note: 'รับเงินสดหน้างาน', ...T }), rcp = (rc.payments || [])[0] || {};
  ok(rc.ok && rcp.status === 'submitted' && rcp.receiptNo == null && rcp.byWho === 'ช่างทดสอบ' && rc.can.verify === false && rc.can.refund === false, 'tech role: payrecord → submitted (waits for the office)', rcp);
  const rv = await api({ action: 'payverify', payment: rcp.id, decision: 'verify', ...St }), rvp = (rv.payments || [])[0] || {};
  ok(rv.ok && rvp.receiptNo === RC0 + '0002' && rvp.verifiedBy === 'เจ้าหน้าที่ทดสอบ', 'the next verified payment gets RC…-0002', rvp);
  ok(rv.ok && rv.requests[0].status === 'open' && rv.requests[0].paid === 500 && rv.summary.status === 'partial' && rv.summary.due === 1000.5, 'a part payment leaves the request open (partial, due 1,000.50)', [rv.requests && rv.requests[0], rv.summary]);
  ok((await api({ action: 'payvoid', req: rq3.id, reason: 'x', ...A })).error === 'has_payments', 'payvoid: an open request with a payment cannot be voided');
  // refunds: admin only, never more than paid − refunded, reason required
  ok((await api({ action: 'refund', id: P3.id, amount: '100', method: 'transfer', reason: 'ทดสอบ', ...St })).error === 'forbidden', 'refund: staff role → forbidden');
  ok((await api({ action: 'refund', id: P3.id, amount: '100', method: 'transfer', reason: 'ทดสอบ', ...T })).error === 'forbidden', 'refund: tech role → forbidden');
  ok((await api({ action: 'refund', id: P3.id, amount: '500.01', method: 'transfer', reason: 'ทดสอบ', ...A })).error === 'refund_too_large', 'refund more than paid → refund_too_large');
  ok((await api({ action: 'refund', id: P3.id, amount: '100', method: 'transfer', reason: '  ', ...A })).error === 'reason_required', 'refund without a reason → reason_required');
  ok((await api({ action: 'refund', id: P3.id, amount: '100', method: 'edc', reason: 'ทดสอบ', ...A })).error === 'bad_method', 'refund: bad method');
  ok((await api({ action: 'refund', id: P3.id, amount: '0', method: 'transfer', reason: 'ทดสอบ', ...A })).error === 'bad_amount', 'refund: bad amount');
  const rf = await api({ action: 'refund', id: P3.id, amount: '200.25', method: 'transfer', reason: 'คืนส่วนต่าง', reference: 'RF-TX-1', ...A });
  ok(rf.ok && rf.refunds.length === 1 && rf.refunds[0].amount === 200.25 && rf.summary.refunded === 200.25 && rf.summary.status === 'part_refunded', 'admin refund recorded (2 decimals)', rf.ok ? [rf.refunds, rf.summary] : rf);
  ok((await api({ action: 'refund', id: P3.id, amount: '300', method: 'transfer', reason: 'ทดสอบ', ...A })).error === 'refund_too_large', 'a second refund is limited to paid − refunded (299.75 left)');
  const lgcy = await api({ action: 'paydetail', id: P3.id, token: TOKEN, staff: 'คุณเลกาซี' });
  ok(lgcy.ok && lgcy.can.refund === true, 'legacy STAFF_TOKEN has admin rights on payments', lgcy.can);
  // void: only an open request without payments; the customer no longer sees it
  const pr1 = await api({ action: 'payreq', id: P1.id, kind: 'full', ...A }), rq1 = (pr1.requests || [])[0] || {};
  ok(pr1.ok && rq1.amount === MIN, 'payreq on the honest quote = the server total', rq1);
  ok((await api({ action: 'payvoid', req: rq1.id, reason: 'x', ...T })).error === 'forbidden', 'payvoid: tech → forbidden');
  ok((await api({ action: 'payvoid', req: 'PR-NOPE', reason: 'x', ...A })).error === 'not_found', 'payvoid: unknown request');
  const vd = await api({ action: 'payvoid', req: rq1.id, reason: 'ลูกค้าเปลี่ยนวิธีชำระ', ...A });
  ok(vd.ok && vd.requests[0].status === 'void' && /ลูกค้าเปลี่ยนวิธีชำระ/.test(vd.requests[0].note), 'payvoid an open request without payments', vd.requests);
  ok((await api({ action: 'payvoid', req: rq1.id, reason: 'x', ...A })).error === 'pay_closed', 'a void request cannot be voided twice');
  // a transfer the customer reported but the office has not checked yet also keeps the request from being voided
  const pr1b = await api({ action: 'payreq', id: P1.id, kind: 'balance', amount: '700', ...A }), rq1b = (pr1b.requests || []).find(r => r.status === 'open') || {};
  await api({ action: 'paid', id: P1.id, tel: '0831000001', req: rq1b.id, method: 'promptpay' });
  ok((await api({ action: 'payvoid', req: rq1b.id, reason: 'x', ...A })).error === 'has_payments', 'payvoid: a request with a reported (unchecked) transfer cannot be voided');
  const sub1b = ((await api({ action: 'paydetail', id: P1.id, ...A })).payments || []).find(x => x.reqId === rq1b.id && x.status === 'submitted') || {};
  await api({ action: 'payverify', payment: sub1b.id, decision: 'reject', note: 'ไม่พบในบัญชี', ...A });
  const trj = await api({ action: 'track', id: P1.id, tel: '0831000001' }), rj = (((trj.ticket || {}).payment || {}).requests || []).find(r => r.id === rq1b.id) || {};
  ok(rj.rejected === true && rj.submitted === false && trj.ticket.payment.status === 'unpaid' && trj.ticket.payment.methods.length === 3 && !/ไม่พบในบัญชี|แอดมินทดสอบ/.test(JSON.stringify(trj)), 'a rejected report: rejected:true on the request (no staff note / name), payable again', rj);
  ok((await api({ action: 'payvoid', req: rq1b.id, reason: 'ไม่พบยอด', ...A })).ok, 'after the office rejects the report the request can be voided');
  const tv = await api({ action: 'track', id: P1.id, tel: '0831000001' });
  ok(tv.ok && (!tv.ticket.payment || !tv.ticket.payment.requests.length), 'the customer does not see a void request', tv.ticket && tv.ticket.payment);
  ok((await api({ action: 'pay', id: P1.id, tel: '0831000001', req: rq1.id, method: 'promptpay' })).error === 'pay_closed', 'a void request cannot be paid');
  await api({ action: 'update', id: P1.id, patch: { status: 'cancelled' }, ...A });
  ok((await api({ action: 'payreq', id: P1.id, kind: 'full', amount: '100', ...A })).error === 'ticket_cancelled', 'no payment request on a cancelled ticket');
  // money with 2 decimals recorded at once by the office → verified with the next receipt number
  const r99 = await api({ action: 'payrecord', id: r4.id, method: 'transfer', amount: '99.99', reference: 'TX-99', ...A }), p99 = (r99.payments || [])[0] || {};
  ok(r99.ok && p99.amount === 99.99 && p99.status === 'verified' && p99.receiptNo === RC0 + '0003' && r99.summary.paid === 99.99, 'admin payrecord: verified at once, 99.99 kept exactly, RC…-0003', p99);
  // Rev.10 UX: a money action repeated with the same request id (the board retries after a timeout) is answered from the stored reply
  { const ra = await api({ action: 'payrecord', id: r4.id, method: 'cash', amount: '1000', rid: 'srv-pay-rid-0001', ...A });
  const rb = await api({ action: 'payrecord', id: r4.id, method: 'cash', amount: '1000', rid: 'srv-pay-rid-0001', ...A });
  const rcpA = (ra.payments || []).find(x => x.id === ra.created) || {};
  ok(ra.ok && !ra.repeat && /^PM-/.test(ra.created) && rcpA.receiptNo === RC0 + '0004', 'payrecord with a rid: recorded once, reply names the created payment', [ra.created, rcpA.receiptNo]);
  ok(rb.ok && rb.repeat === true && rb.created === ra.created && rb.payments.length === ra.payments.length && (await api({ action: 'paydetail', id: r4.id, ...A })).payments.length === ra.payments.length, 'the same rid again → the stored reply (repeat:true), no second payment or receipt', [rb.repeat, rb.payments && rb.payments.length]);
  const rs = await api({ action: 'payrecord', id: r4.id, method: 'cash', amount: '1000', rid: 'srv-pay-rid-0001', ...St });
  ok(rs.ok && !rs.repeat && rs.created !== ra.created, 'the same rid from another staff account is a new action', rs.created);
  ok((await api({ action: 'payrecord', id: r4.id, method: 'cash', amount: '0', rid: 'srv-pay-rid-0002', ...A })).error === 'bad_amount' && (await api({ action: 'payrecord', id: r4.id, method: 'cash', amount: '50', rid: 'srv-pay-rid-0002', ...A })).ok, 'a refused reply is not stored: the corrected form can be sent with the same rid');
  const qa = await api({ action: 'payreq', id: r4.id, kind: 'extra', amount: '300', rid: 'srv-req-rid-0001', ...A }), qb = await api({ action: 'payreq', id: r4.id, kind: 'extra', amount: '300', rid: 'srv-req-rid-0001', ...A });
  ok(qa.ok && qb.repeat === true && qb.created === qa.created && (await api({ action: 'paydetail', id: r4.id, ...A })).requests.length === 1, 'payreq with a rid: one request however often it is sent', qb.created);
  const va = await api({ action: 'payvoid', req: qa.created, reason: 'ทดสอบ', rid: 'srv-void-rid-0001', ...A }), vb2 = await api({ action: 'payvoid', req: qa.created, reason: 'ทดสอบ', rid: 'srv-void-rid-0001', ...A });
  ok(va.ok && vb2.ok && vb2.repeat === true && (await api({ action: 'payvoid', req: qa.created, reason: 'ทดสอบ', ...A })).error === 'pay_closed', 'payvoid repeated with its rid → the stored success (without a rid → pay_closed)');
  ok(dbRows(D1, `SELECT COUNT(*) n FROM idem`)[0].n === 5, 'idem table (migration 3) keeps one row per successful (staff, action, rid)'); }
  // UX audit: deposit-only "paid" label, an expired request with money owed, no on-site payment once done, nothing payable once cancelled
  IP = '127.0.4.2';
  const T4 = '0831000004', pq4 = await api({ action: 'payreq', id: P4.id, kind: 'deposit', amount: '1000', ...A }), rq4 = (pq4.requests || [])[0] || {};
  const pr4 = await api({ action: 'payrecord', id: P4.id, req: rq4.id, method: 'cash', amount: '1000', ...A });
  ok(pr4.ok && pr4.summary.status === 'paid' && pr4.summary.statusTh === 'ชำระตามที่เรียกเก็บแล้ว', 'only a deposit settled: status paid, label ชำระตามที่เรียกเก็บแล้ว (not ชำระครบแล้ว)', pr4.summary);
  const bq4 = await api({ action: 'payreq', id: P4.id, kind: 'balance', amount: '500', ...A }), rb4 = (bq4.requests || []).find(r => r.kind === 'balance') || {};
  ok(bq4.ok && bq4.summary.status === 'partial' && bq4.summary.due === 500, 'balance asked: partial, due 500', bq4.summary);
  dbRows(D1, `UPDATE payreq SET expiresAt = ? WHERE id = ?`, day(-1), rb4.id);
  const te4 = await api({ action: 'track', id: P4.id, tel: T4 }), pe4 = (te4.ticket || {}).payment || {};
  ok(pe4.status === 'expired' && pe4.statusTh === 'มีรายการชำระเงินหมดอายุ' && pe4.due === 0 && pe4.paid === 1000 && (pe4.requests || []).some(r => r.id === rb4.id && r.status === 'expired' && r.remaining === 500), 'an expired balance with money owed never reads as paid: status expired', pe4);
  ok((await api({ action: 'paydetail', id: P4.id, ...A })).summary.status === 'expired', 'the board summary says expired too');
  const xq4 = await api({ action: 'payreq', id: P4.id, kind: 'extra', amount: '300', ...A }), rx4 = (xq4.requests || []).find(r => r.kind === 'extra') || {};
  await api({ action: 'update', id: P4.id, patch: { status: 'done' }, ...A });
  const td4 = await api({ action: 'track', id: P4.id, tel: T4 });
  ok(td4.ticket.payment.methods.join() === 'promptpay,transfer', 'job done: on-site payment is no longer offered', td4.ticket.payment.methods);
  ok((await api({ action: 'pay', id: P4.id, tel: T4, req: rx4.id, method: 'onsite' })).error === 'pay_unavailable' && (await api({ action: 'pay', id: P4.id, tel: T4, req: rx4.id, method: 'promptpay' })).ok, 'job done: pay onsite → pay_unavailable, PromptPay still works');
  await api({ action: 'update', id: P4.id, patch: { status: 'cancelled' }, ...A });
  const tc4 = await api({ action: 'track', id: P4.id, tel: T4 });
  ok(tc4.ok && tc4.ticket.payment.methods.length === 0, 'cancelled ticket: no payment methods offered', tc4.ticket && tc4.ticket.payment.methods);
  ok((await api({ action: 'pay', id: P4.id, tel: T4, req: rx4.id, method: 'promptpay' })).error === 'ticket_cancelled' && (await api({ action: 'paid', id: P4.id, tel: T4, req: rx4.id, method: 'transfer' })).error === 'ticket_cancelled', 'cancelled ticket: pay / paid → ticket_cancelled');
  const lp = (await listAll()).find(t => t.id === PT.id);
  ok(lp && lp.pay && lp.pay.status === 'paid' && lp.pay.paid === tot6 && lp.pay.asked === tot6 && lp.pay.open === 0 && lp.priceCheck.payable === true, 'list carries the money summary (baht) + price check', lp && lp.pay);
  ok(lp.pay.unasked === 0 && lp.pay.refs.includes(rq.ref) && lp.pay.refs.includes(RC0 + '0001'), 'list summary: nothing left to ask + the request ref and receipt number for search', lp.pay);

  // Rev.10 UX: status e-mails close with what the customer can do now (need_info → call with the id · cancelled → no appointment)
  const NI = await api({ action: 'create', ticket: base({ customer: { name: 'คุณข้อมูล เพิ่ม', tel: '0844444441', email: 'info@example.com' } }) }, { ip: '127.0.7.1' });
  for (const patch of [{ status: 'need_info' }, { status: 'confirmed', schedDate: day(4), schedSlot: 'AM' }, { status: 'cancelled' }]) await api({ action: 'update', token: TOKEN, id: NI.id, staff: 'แอดมิน', patch });

  /* ======== F · notifications ======== */
  const OB = dbRows(D1, `SELECT channel, recipient, subject, body, ticketId FROM outbox ORDER BY id`);
  const mails = (id, re) => OB.filter(m => m.ticketId === id && re.test(m.subject));
  ok(mails(r1.id, /\[SBP จองคิว\]/).some(m => m.recipient === 'team@example.com'), 'team email queued for every new ticket', OB.filter(m => m.ticketId === r1.id).map(m => m.subject));
  ok(mails(r1.id, /ได้รับคำขอของคุณแล้ว/).some(m => m.recipient === 'test@example.com' && m.body.includes(r1.id)), 'CUSTOMER_ACK=1: the customer gets an acknowledgement');
  ok(mails(r1.id, /อัปเดตคำขอ/).some(m => m.recipient === 'test@example.com' && m.body.includes(`นัดหมาย: ${thD(day(3))} ช่วงบ่าย`) && !m.body.includes('โทรก่อน') && !m.body.includes('ทีม 1')), 'CUSTOMER_NOTIFY=1: status e-mail with the appointment, no staff note / team');
  ok(mails(r1.id, /อัปเดตคำขอ/).length === 1, 'a staff-note-only change sends the customer nothing (one e-mail: the status change)', mails(r1.id, /อัปเดตคำขอ/).length);
  const mReq = mails(PT.id, /รายการชำระเงิน/), mPaid = mails(PT.id, /ได้รับชำระเงินแล้ว/);
  ok(mReq.length === 1 && mReq[0].recipient === 'pay@example.com' && mReq[0].body.includes(rq.ref) && mReq[0].body.includes(tot6.toLocaleString('en-US')) && mReq[0].body.includes('ชำระได้ถึง: ' + thD(day(7))), 'payreq → the customer gets the amount, reference and last day (CUSTOMER_NOTIFY on)', mReq.map(m => m.body));
  ok(mPaid.length === 1 && mPaid[0].recipient === 'pay@example.com' && mPaid[0].body.includes(RC0 + '0001'), 'verified payment → the customer gets the receipt number (CUSTOMER_NOTIFY on)', mPaid.map(m => m.body));
  ok(mails(PT.id, /ลูกค้าแจ้งโอนแล้ว/).some(m => m.recipient === 'team@example.com'), 'a customer transfer report notifies the team');
  ok(mReq.length === 1 && mReq[0].body.includes('รหัสชำระเงิน (ใส่ในบันทึกการโอน): ' + rq.ref) && mReq[0].body.includes('วิธีชำระ: พร้อมเพย์ · โอนเข้าบัญชีบริษัท · ชำระหน้างาน') && mReq[0].body.includes('บริษัทออกเลขที่ใบเสร็จเมื่อตรวจยืนยันยอดที่ได้รับจริงแล้วเท่านั้น'), 'payreq e-mail: รหัสชำระเงิน, the methods this server offers, the receipt sentence', mReq.map(m => m.body));
  const ni = OB.filter(m => m.ticketId === NI.id && m.recipient === 'info@example.com' && /อัปเดตคำขอ/.test(m.subject)).map(m => m.body);
  ok(ni.length === 3 && ni[0].includes('สถานะ: รอข้อมูลเพิ่มเติมจากคุณ') && ni[0].includes(`กรุณาโทร 02-459-3291-9 พร้อมแจ้งเลขที่คำขอ ${NI.id}`) && !ni[0].includes('เปลี่ยนวันนัด'), 'need_info e-mail: customer words + call with the ticket id', ni);
  ok(ni[1] && ni[1].includes(`นัดหมาย: ${thD(day(4))} ช่วงเช้า`) && ni[1].includes('หากต้องการเปลี่ยนวันนัด กรุณาโทร'), 'confirmed e-mail: the appointment with a Thai date + how to change it', ni[1]);
  ok(ni[2] && ni[2].includes('สถานะ: ยกเลิก') && !/นัดหมาย:|เปลี่ยนวันนัด/.test(ni[2]) && ni[2].includes('หากคุณไม่ได้ขอยกเลิก กรุณาโทร'), 'cancelled e-mail: no appointment line; call if the customer did not cancel', ni[2]);
  const team1 = mails(r1.id, /\[SBP จองคิว\]/)[0] || {};
  ok(/จำนวนเครื่อง: ติดผนัง 3 · สี่ทิศทาง 1/.test(team1.body) && !/\{"/.test(team1.body) && team1.body.includes('วันที่ต้องการ: ' + thD(day(2))), 'team e-mail: units in the board words and the date in Thai (no JSON, no ISO date)', team1.body);
  const cust = OB.filter(m => m.recipient !== 'team@example.com');
  ok(cust.length && cust.every(m => m.body.includes('\nโทร 02-459-3291-9 · Sahaburapa.official@gmail.com')) && !cust.some(m => /\d{4}-\d{2}-\d{2}/.test(m.body.replace(/https?:\S+/g, ''))), 'customer e-mails: company phone + e-mail in the signature, no ISO dates', cust.map(m => m.body.slice(-90)));
  ok(cust.length >= 4 && cust.every(m => !BANNED.some(w => m.body.includes(w) || m.subject.includes(w)) && !PROMISE.test(m.body) && !/แอดมินทดสอบ|เจ้าหน้าที่ทดสอบ|ช่างทดสอบ/.test(m.body)), 'customer e-mails: no banned phrase, no time promise, no staff name', cust.map(m => m.subject));
  // the 15 s outbox worker delivers into the DEV memory outbox (bounded wait)
  let box = [];
  for (const until = Date.now() + 20000; Date.now() < until;) {
    const r = await http(S1, 'GET', '/__outbox'); try { box = JSON.parse(r.body); } catch (e) { box = []; }
    if (box.some(m => m.to === 'team@example.com' && m.subject.includes(r1.id))) break;
    await sleep(500);
  }
  ok(box.some(m => m.to === 'team@example.com' && m.subject.includes(r1.id) && m.body.includes('คุณทดสอบ ระบบ')), '/__outbox (DEV) shows the delivered team e-mail', box.map(m => m.subject).slice(0, 6));
  const sent = dbRows(D1, `SELECT COUNT(*) n FROM outbox WHERE status = 'sent'`)[0].n;
  ok(sent >= 1, 'outbox rows are marked sent after delivery', sent);

  /* ======== G · static allowlist + security headers ======== */
  IP = '127.0.7.1';
  for (const p of ['/', '/c.html', '/assets/sbp-core.js', '/assets/sbp-data.json', '/robots.txt', '/favicon.ico', '/backoffice.html', '/privacy.html']) {
    const r = await http(S1, 'GET', p); ok(r.status === 200 && r.body.length > 0, `200 ${p}`, r.status);
  }
  for (const p of ['/CLAUDE.md', '/HANDOFF.md', '/tools_recon.py', '/internal/sbp_real.json', '/backoffice/apps-script/Code.gs', '/hub-local.html', '/test-ts.html', '/preview.html', '/package.json',
    '/assets/photos/photos.json', '/assets/logos/README.txt', '/server/config.mjs', '/tests/server.mjs', '/.git/config', '/data/aircare.sqlite', '/assets/..%2f..%2fCLAUDE.md', '/%2e%2e/package.json', '/assets/%2e%2e/package.json',
    '/assets/..%5c..%5cpackage.json', '/assets/sbp-core.js%00.html', '/assets/%2e%2e%2f%2e%2e%2finternal/sbp_real.json', '/..%2f..%2fetc/passwd', '/__outbox/x']) {
    const r = await http(S1, 'GET', p); ok(r.status === 404 && /ไม่พบหน้านี้/.test(r.body.toString('utf8')), `404 ${p}`, [r.status, r.body.toString('utf8').slice(0, 80)]);
  }
  ok((await http(S1, 'POST', '/c.html', { body: 'x' })).status === 405, 'POST to a page → 405');
  const home = await http(S1, 'GET', '/'), html = home.body.toString('utf8'), csp = home.headers['content-security-policy'] || '';
  const inl = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m => !/application\/(ld\+)?json/i.test(m[1]));
  const scriptSrc = (csp.split(';').find(d => d.trim().startsWith('script-src')) || '').trim();
  ok(inl.length >= 1 && inl.some(m => /type=["']?module/.test(m[1])), 'the home page has its inline module', inl.length);
  ok(inl.length && inl.every(m => scriptSrc.includes(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)) && !/unsafe-inline|unsafe-eval|\*/.test(scriptSrc), 'CSP script-src carries the sha256 of every inline script (recomputed from the served HTML), no unsafe-*', scriptSrc.slice(0, 120));
  ok(/default-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp), 'CSP defaults', csp);
  ok(home.headers['x-content-type-options'] === 'nosniff' && home.headers['x-frame-options'] === 'DENY' && home.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'X-Content-Type-Options / X-Frame-Options / Referrer-Policy', home.headers);
  ok(/<meta name="sbp-api" content="\/exec">/.test(html), '<meta name="sbp-api"> injected');
  const api0 = await http(S1, 'POST', '/exec', { body: '{}', headers: { 'Content-Type': 'text/plain' } });
  ok(api0.headers['x-content-type-options'] === 'nosniff' && api0.headers['cache-control'] === 'no-store' && /application\/json/.test(api0.headers['content-type']), 'API replies: JSON, no-store, nosniff', api0.headers);
  const js = await http(S1, 'GET', '/assets/sbp-core.js'), et = js.headers.etag;
  const js304 = await http(S1, 'GET', '/assets/sbp-core.js', { headers: { 'If-None-Match': et } });
  ok(et && js304.status === 304 && js304.body.length === 0, 'ETag → 304 Not Modified', [et, js304.status]);
  const gz = await http(S1, 'GET', '/assets/sbp-core.js', { headers: { 'Accept-Encoding': 'gzip' } });
  const brr = await http(S1, 'GET', '/assets/sbp-core.js', { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
  ok(gz.headers['content-encoding'] === 'gzip' && gunzipSync(gz.body).equals(js.body), 'gzip content-encoding (decodes to the same file)', gz.headers['content-encoding']);
  ok(brr.headers['content-encoding'] === 'br' && brotliDecompressSync(brr.body).equals(js.body) && /Accept-Encoding/i.test(brr.headers.vary || ''), 'br content-encoding (+ Vary)', brr.headers['content-encoding']);
  ok(!js.headers['content-encoding'] && js.body.equals(readFileSync(join(ROOT, 'assets', 'sbp-core.js'))), 'identity when the client asks for no encoding');
  const hz = await http(S1, 'GET', '/healthz'), hzj = JSON.parse(hz.body);
  ok(hz.status === 200 && hzj.ok === true && hzj.version && Number.isInteger(hzj.uptimeS) && Number.isInteger(hzj.outboxPending), '/healthz ok', hzj);
  // the CSP really lets the pages run in a browser (an inline module blocked by its own CSP = a dead site)
  for (const pg of ['/backoffice.html', '/']) {
    const c = await browser.newContext(), p = await c.newPage(), viol = [];
    p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) viol.push(m.text().slice(0, 160)); });
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error('Refused to ' + e.violatedDirective + ' ' + e.blockedURI)));
    await p.goto(`http://127.0.0.1:${S1.port}${pg}`, { waitUntil: 'domcontentloaded' });
    const ran = await p.waitForFunction(sel => document.querySelector(sel), pg === '/' ? 'html.sx-on' : '#bo-nm', { timeout: 90000 }).then(() => true, () => false);
    await p.waitForTimeout(1500);
    ok(ran && !viol.length, `${pg} runs under its CSP in Chromium (no violation)`, viol.slice(0, 5));
    await c.close();
  }

  /* ======== second instance: no STAFF_TOKEN / no accounts / DEV off / CUSTOMER_NOTIFY off / no NOTIFY_EMAIL ======== */
  S2 = await start(D2, { PROMPTPAY_ID: '0105555555555' });
  const a2 = (b, o = {}) => api(b, { s: S2, ip: '127.0.8.1', ...o });
  ok((await a2({ action: 'list', token: 'x' })).error === 'staff_disabled', 'no STAFF_TOKEN and no accounts = staff API off (staff_disabled)');
  ok((await http(S2, 'GET', '/__outbox')).status === 404, '/__outbox is 404 when DEV is off');
  const q2 = await a2({ action: 'create', ticket: base({ customer: { name: 'คุณปิดแจ้งเตือน', tel: '0841111111', email: 'quiet@example.com' }, units: { wall: 6 }, quote: Q6 }) });
  ok(q2.ok && q2.id === ID0 + '001', 'second instance: own sequence', q2);
  cli(D2, ['staff', 'add', 'boss', 'หัวหน้าทดสอบ', 'admin'], { STAFF_PASSWORD: PW });
  const lb = await a2({ action: 'login', user: 'boss', password: PW });
  ok(lb.ok && (await a2({ action: 'list', token: 'x' })).error === 'unauthorized', 'an account added with the CLI while running switches the staff API on');
  await a2({ action: 'update', token: lb.token, id: q2.id, patch: { status: 'confirmed', schedDate: day(4), schedSlot: 'AM' } });
  const rq2 = ((await a2({ action: 'payreq', token: lb.token, id: q2.id, kind: 'full' })).requests || [])[0] || {};
  ok((await a2({ action: 'paid', id: q2.id, tel: '0841111111', req: rq2.id, method: 'transfer' })).error === 'pay_unavailable', 'no bank account configured: a transfer report is refused (pay_unavailable)');
  await a2({ action: 'paid', id: q2.id, tel: '0841111111', req: rq2.id, method: 'promptpay' });
  const pm2 = ((await a2({ action: 'paydetail', token: lb.token, id: q2.id })).payments || [])[0] || {};
  const vf2 = await a2({ action: 'payverify', token: lb.token, payment: pm2.id, decision: 'verify' });
  ok(rq2.amount === tot6 && vf2.ok && vf2.payments[0].receiptNo === RC0 + '0001', 'second instance: request → report → verify works', [rq2.amount, vf2.payments && vf2.payments[0]]);
  const OB2 = dbRows(D2, `SELECT recipient, subject FROM outbox`);
  ok(OB2.length === 0, 'CUSTOMER_NOTIFY off: no status / payment-request / receipt e-mail; CUSTOMER_ACK off + no NOTIFY_EMAIL: no mail at all (ticket still stored)', OB2);
  // a server error replies {ok:false, error:'server', ref} — the ref is in the log, the message never leaves the server
  { const db = new DatabaseSync(join(D2, 'aircare.sqlite'));
    try { db.exec(`PRAGMA busy_timeout = 5000; CREATE TRIGGER t_boom BEFORE INSERT ON tickets BEGIN SELECT RAISE(ABORT, 'internal-detail-xyz'); END;`); } finally { db.close(); } }
  const se = await a2({ action: 'create', ticket: base({ customer: { name: 'ล่ม', tel: '0841111112' } }) });
  ok(se.ok === false && se.error === 'server' && /^[\w-]{8}$/.test(se.ref || '') && Object.keys(se).sort().join() === 'error,ok,ref', 'server error → {ok:false, error:"server", ref}', se);
  ok(!/internal-detail|RAISE|trigger|sqlite|stack|Error:/i.test(JSON.stringify({ ...se, ref: '' })), 'the server error never leaks its message', se);
  for (const until = Date.now() + 3000; Date.now() < until && !S2.err.includes(se.ref);) await sleep(100);
  ok(se.ref && S2.err.includes(se.ref) && S2.err.includes('internal-detail-xyz'), 'the ref matches the server log line (message logged, not sent)', S2.err.slice(-300));
  { const db = new DatabaseSync(join(D2, 'aircare.sqlite')); try { db.exec(`PRAGMA busy_timeout = 5000; DROP TRIGGER t_boom;`); } finally { db.close(); } }
  const q4 = await a2({ action: 'create', ticket: base({ customer: { name: 'หลังล่ม', tel: '0841111113' } }) });
  ok(q4.ok && q4.id === ID0 + '002', 'a failed insert does not burn a sequence number', q4);
  cli(D2, ['staff', 'disable', 'boss']);
  ok((await a2({ action: 'me', token: lb.token })).error !== undefined && (await a2({ action: 'login', user: 'boss', password: PW })).error === 'unauthorized', 'a disabled account loses its session and cannot log in');

  /* ======== H · backup → verify → restore drill ======== */
  const total = (await listAll()).length;
  const bk = JSON.parse(cli(D1, ['backup']));
  ok(bk.ok && existsSync(bk.file) && bk.tickets === total && bk.integrity === 'ok' && bk.staff === 4, 'backup while the server runs (VACUUM INTO + integrity check)', { ...bk, total });
  const vb = JSON.parse(cli(D1, ['verify-backup', bk.file]));
  ok(vb.ok && vb.tickets === total && vb.payments >= 3 && vb.schema >= 2, 'verify-backup ok with the ticket count', vb);
  let rs = '';
  try { rs = cli(D3, ['restore', bk.file]); } catch (e) { rs = 'ERR ' + (e.stderr || e.message).toString().slice(0, 300); }
  ok(/กู้คืนแล้ว/.test(rs) && existsSync(join(D3, 'aircare.sqlite')), 'restore into a NEW data dir (created by the CLI)', rs);
  if (existsSync(join(D3, 'aircare.sqlite'))) {
    S3 = await start(D3, { STAFF_TOKEN: TOKEN });
    const tr = await api({ action: 'track', id: r1.id, tel: TEL }, { s: S3, ip: '127.0.9.1' });
    ok(tr.ok && tr.ticket.status === 'confirmed' && tr.ticket.schedDate === day(3), 'restored server: tracking a ticket created earlier works', tr);
    const tp3 = await api({ action: 'track', id: PT.id, tel: PTEL }, { s: S3, ip: '127.0.9.1' });
    ok(tp3.ok && tp3.ticket.payment && tp3.ticket.payment.receipts[0].no === RC0 + '0001', 'restored server: payments and receipts are there', tp3.ticket && tp3.ticket.payment);
    ok((await api({ action: 'login', user: 'admin', password: PW }, { s: S3, ip: '127.0.9.1' })).ok, 'restored server: staff accounts are there');
    const nx = await api({ action: 'create', ticket: base({ customer: { name: 'หลังกู้คืน', tel: '0841111114' } }) }, { s: S3, ip: '127.0.9.1' });
    ok(nx.ok && +nx.id.slice(-3) > Math.max(...(await listAll()).filter(t => t.id.startsWith(ID0)).map(t => +t.id.slice(-3))), 'restored server continues the sequence (no id reused)', nx);
  }
  ok(S1 && !/api error|request error/.test(S1.err), 'main server: no server error logged during the whole run', S1 && S1.err.split('\n').filter(l => /error/.test(l)).slice(0, 5));
} catch (e) {
  fails++; console.log('✗ test crashed:', e && e.stack || e);
} finally {
  if (browser) await browser.close().catch(() => {});
  await Promise.all(servers.map(stop));
  if (fails && process.env.KEEP) console.log('kept', TMP); else rmSync(TMP, { recursive: true, force: true });
}
console.log(JSON.stringify({ checks: n, fails, seconds: Math.round((Date.now() - t0) / 1000) }));
process.exit(fails ? 1 : 0);
