// Rev.10 — the TEST-site back office (assets/artifact-api.js) with no browser: an in-memory fake of the Artifact `db` + `user`
// capabilities on globalThis.claude (db.d.ts: path grammar + parity, plain-JSON bodies ≤ 256 KiB / 32 levels, where / orderBy /
// limit, leases, onSnapshot, frozen snapshots; user.d.ts: can('data.write') true / false / null), driven through handle(); then
// the SAME request sequence against the real server in-process (server/app.mjs, temp DATA_DIR, memory mail, the same PromptPay /
// bank settings) with every reply compared key by key (shape) and value by value (except random ids and times).
// usage: node tests/artifact-api.mjs   (VERBOSE=1 prints every check)
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import jsQR from 'jsqr';

const ROOT = new URL('..', import.meta.url).pathname;
const VERBOSE = !!process.env.VERBOSE;
globalThis.__SBP_DATA = JSON.parse(readFileSync(join(ROOT, 'assets', 'sbp-data.json'), 'utf8'));
const core = await import('../assets/sbp-core.js');
await core.loadData();
const API = await import('../assets/artifact-api.js');
const { handle, testHooks, TEST_PAY, TEST_PASSWORD, TEST_ACCOUNTS } = API;

let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x).slice(0, 700) : ''); } else if (VERBOSE) console.log('✓', m); };
const day = d => new Date(Date.now() + 7 * 3600e3 + d * 864e5).toISOString().slice(0, 10);   // Bangkok calendar day
const BE = String(+day(0).slice(0, 4) + 543).slice(-2), ID0 = 'SBP-' + BE + day(0).slice(5, 7) + day(0).slice(8, 10) + '-', RC0 = 'RC' + BE + day(0).slice(5, 7) + '-';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();

/* ---------------- fake Artifact capabilities ---------------- */
const enc = s => Buffer.byteLength(s, 'utf8');
const dbErr = (code, message = code) => ({ code, message });
const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;
function segs(p, kind) {   // throws TypeError synchronously, like the real builders
  if (typeof p !== 'string' || !p) throw new TypeError('path must be a non-empty string');
  const s = p.split('/');
  if (s.length > 16 || enc(p) > 1000) throw new TypeError('path: at most 16 segments and 1000 bytes');
  for (const x of s) if (!SEG.test(x) || x === '.' || x === '..' || enc(x) > 200) throw new TypeError('bad path segment ' + JSON.stringify(x));
  if ((s.length % 2 === 0) !== (kind === 'doc')) throw new TypeError(`a ${kind} path needs an ${kind === 'doc' ? 'even' : 'odd'} number of segments (got ${s.length})`);
  return s;
}
const plain = v => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function checkBody(o) {
  if (!plain(o)) throw dbErr('invalid_argument', 'a document body is a plain object');
  const walk = (v, d) => {
    if (d > 32) throw dbErr('invalid_argument', 'deeper than 32 levels');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) throw dbErr('invalid_argument', 'non-finite number'); return; }
    if (Array.isArray(v)) return v.forEach(x => walk(x, d + 1));
    if (plain(v)) return Object.values(v).forEach(x => walk(x, d + 1));
    throw dbErr('invalid_argument', 'not plain JSON: ' + typeof v);
  };
  walk(o, 1);
  if (enc(JSON.stringify(o)) > 256 * 1024) throw dbErr('invalid_argument', 'document over 256 KiB');
}
const clone = o => JSON.parse(JSON.stringify(o));
const freeze = o => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = plain(v) && plain(a[k]) ? merge(a[k], v) : v; return a; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cmp = (a, b) => (typeof a === typeof b && (typeof a === 'number' || typeof a === 'string') ? (a < b ? -1 : a > b ? 1 : 0) : null);
const OPS = ['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains'];
function match(data, { field, op, value }) {
  const has = Object.prototype.hasOwnProperty.call(data, field), v = data[field], c = has ? cmp(v, value) : null;
  switch (op) {
    case '==': return has && same(v, value);
    case '!=': return has && !same(v, value);
    case '<': return c === -1; case '<=': return c === -1 || c === 0; case '>': return c === 1; case '>=': return c === 1 || c === 0;
    case 'in': return has && value.some(x => same(v, x));
    case 'not-in': return has && !value.some(x => same(v, x));
    case 'array-contains': return Array.isArray(v) && v.some(x => same(x, value));
  }
  return false;
}
function createFakeDb() {
  const docs = new Map(), leases = new Map(), subs = new Set();
  const st = { calls: 0, writes: 0, acquires: 0, fail: [], failSet: null, readOnly: false, maxBytes: 0, docs };
  const tick = () => new Promise(r => setImmediate(r));
  const notify = () => { for (const s of subs) setImmediate(() => subs.has(s) && s.fire()); };
  async function op(kind, f) {
    st.calls++; await tick();
    const code = st.fail.shift(); if (code) throw dbErr(code);
    if (kind === 'w' && st.readOnly) throw dbErr('invalid_argument', 'this viewer may not write');
    const r = f(); if (kind === 'w') { st.writes++; notify(); }
    return r;
  }
  const put = (path, data) => { const prev = docs.get(path); docs.set(path, { data, version: (prev ? prev.version : 0) + 1 }); st.maxBytes = Math.max(st.maxBytes, enc(JSON.stringify(data))); };
  const meta = { fromCache: false, hasPendingWrites: false };
  const snap = (path, d = docs.get(path)) => { const body = d ? freeze(clone(d.data)) : undefined; return Object.freeze({ id: path.split('/').pop(), exists: !!d, data: () => body, metadata: meta }); };
  function subscribe(compute, next, error) {
    const sub = { prev: null, fire() { try { next(compute(sub)); } catch (e) { subs.delete(sub); if (error) error(e); } } };
    subs.add(sub); setImmediate(() => subs.has(sub) && sub.fire());
    return () => { subs.delete(sub); };
  }
  const docRef = path => {
    const s = segs(path, 'doc');
    return Object.freeze({
      id: s.at(-1), path,
      get: () => op('r', () => snap(path)),
      set: data => op('w', () => { if (st.failSet && path.startsWith(st.failSet.prefix)) throw dbErr(st.failSet.code); checkBody(data); put(path, clone(data)); }),
      update: data => op('w', () => { checkBody(data); const cur = docs.get(path); if (!cur) throw dbErr('invalid_argument', 'update needs an existing document'); const m = merge(clone(cur.data), clone(data)); checkBody(m); put(path, m); }),
      delete: () => op('w', () => { docs.delete(path); }),
      acquire: o => op('w', () => {
        if (!o || typeof o.holder !== 'string' || !o.holder) throw dbErr('invalid_argument', 'holder is required');
        const ttl = Math.max(1000, Math.min(600000, +o.ttlMs || 30000)), t = Date.now(), L = leases.get(path);
        if (L && L.until > t && L.holder !== o.holder) return { acquired: false, expiresAt: new Date(L.until).toISOString() };
        leases.set(path, { holder: o.holder, until: t + ttl }); st.acquires++;
        const cur = docs.get(path);
        if (o.data) { checkBody(o.data); put(path, merge(cur ? clone(cur.data) : {}, clone(o.data))); }
        else if (!cur) put(path, {});   // adversarial: assume a granted lease may create an empty document
        return { acquired: true, version: docs.get(path).version, expiresAt: new Date(t + ttl).toISOString(), holder: o.holder };
      }),
      onSnapshot: (next, error) => subscribe(() => snap(path), next, error),
      collection: p => colRef(path + '/' + p),
    });
  };
  function makeQuery(path, filters = [], order = null, lim = null) {
    const depth = segs(path, 'collection').length + 1;
    function run(sub) {
      if (filters.length > 10) throw dbErr('invalid_argument', 'at most 10 filters');
      if (lim != null && !(Number.isInteger(lim) && lim >= 1 && lim <= 1000)) throw dbErr('invalid_argument', 'limit must be 1-1000');
      for (const f of filters) {
        if (typeof f.field !== 'string' || !OPS.includes(f.op)) throw dbErr('invalid_argument', 'bad filter ' + f.op);
        if ((f.op === 'in' || f.op === 'not-in') && !(Array.isArray(f.value) && f.value.length <= 30)) throw dbErr('invalid_argument', f.op + ' takes an array of at most 30');
      }
      if (order && order.dir !== 'asc' && order.dir !== 'desc') throw dbErr('invalid_argument', 'orderBy dir');
      let rows = [...docs].filter(([p]) => p.startsWith(path + '/') && p.split('/').length === depth).map(([p, d]) => ({ p, d }))
        .filter(r => filters.every(f => match(r.d.data, f))).sort((a, b) => (a.p < b.p ? -1 : 1));   // by document id
      if (order) rows.sort((a, b) => { const ha = order.field in a.d.data, hb = order.field in b.d.data; if (!ha || !hb) return ha === hb ? 0 : ha ? -1 : 1; const c = cmp(a.d.data[order.field], b.d.data[order.field]); return (c == null ? 0 : c) * (order.dir === 'desc' ? -1 : 1); });   // missing field last, stable
      if (lim) rows = rows.slice(0, lim);
      const out = rows.map(r => snap(r.p, r.d)), prev = sub && sub.prev;
      if (sub) sub.prev = out;
      return Object.freeze({ docs: out, size: out.length, empty: !out.length, metadata: meta,
        docChanges: () => out.map((d, i) => ({ type: !prev ? 'added' : prev.some(x => x.id === d.id) ? 'modified' : 'added', doc: d, oldIndex: prev ? prev.findIndex(x => x.id === d.id) : -1, newIndex: i })) });
    }
    return {
      where: (field, o, value) => makeQuery(path, [...filters, { field, op: o, value }], order, lim),
      orderBy: (field, dir = 'asc') => makeQuery(path, filters, { field, dir }, lim),
      limit: k => makeQuery(path, filters, order, k),
      get: () => op('r', () => run()),
      onSnapshot: (next, error) => subscribe(run, next, error),
    };
  }
  const colRef = path => Object.freeze({ ...makeQuery(path), path, doc: id => docRef(path + '/' + (id == null ? createHash('sha1').update(Math.random() + '').digest('hex').slice(0, 20) : id)), add: async data => { const r = colRef(path).doc(); await r.set(data); return r; } });
  const db = Object.freeze({ doc: docRef, collection: colRef });
  return { db, st, hold: (path, holder, ms) => leases.set(path, { holder, until: Date.now() + ms }), raw: path => (docs.get(path) || {}).data };
}
const U = { write: true };   // what user.can('data.write') resolves: true / false / null
const fakeUser = Object.freeze({
  can: async name => (name === 'data.write' ? U.write : U.write === null ? null : false),
  isOwner: async () => false, canEdit: async () => false, id: async () => 'u_tester', name: async () => '', email: async () => null, avatarUrl: async () => null, search: async () => [],
  me: async () => ({ id: 'u_tester', name: '', avatarUrl: 'data:,', color: '#777', email: null, isOwner: false, canEdit: false }),
  profiles: async ids => Object.fromEntries([].concat(ids).map(id => [id, { id, name: '', avatarUrl: 'data:,', color: '#777', email: null, isMe: id === 'u_tester', guest: false }])),
});
let fake = createFakeDb();
const install = (f = fake) => { fake = f; globalThis.claude = { use: async name => (name === 'db' ? f.db : name === 'user' ? fakeUser : null) }; testHooks.reset(); };

const call = body => handle(body).then(r => r, e => ({ ok: false, error: e && e.code, ...(e && e.ref ? { ref: e.ref } : {}), rejectedWith: e }));
const TEL = '0812345678', PW = TEST_PASSWORD;
const base = (o = {}) => ({ kind: 'booking', service: 'clean', units: { wall: 3, cassette: 1 }, teamDays: 0.3, prefDate: day(2), slot: 'AM', consent: true,
  customer: { name: 'คุณทดสอบ ระบบ', tel: '081-234-5678', email: 'test@example.com' }, site: { address: '12/3 ถ.พระราม 2', area: 'บางขุนเทียน กรุงเทพมหานคร', zoneTier: 'core' }, source: 'artifact test', ...o });
const CLR = core.cleanRate('Basic Clean', 'C1', 'wall', 0).rate.s, MIN = core.DATA.minBill;   // 700 · 4,500 before VAT
const CL = (qty, unitEx = CLR) => ({ name: 'ล้าง Basic ติดผนัง 9,000–18,000 BTU', key: 'CL-Basic Clean-C1-wall-0', group: 'clean', kind: 'service', qty, unitEx });
const SV = core.DATA.inst.find(i => i.ex == null), SKU = core.DEMO.models.find(m => m.type === 'wall').skus[0];
const quote = (lines, o = {}) => ({ tax: 'none', zoneInput: 'บางขุนเทียน', lines, ...o });
// the honest cleaning booking of tests/board-pay.mjs: 2 × 700 + cleaning minimum = 4,500 before VAT, no tax invoice
const boardPay = (o = {}) => ({ kind: 'booking', service: 'clean', units: { wall: 2 }, prefDate: day(3), slot: 'AM', consent: true, source: 'board-pay test',
  customer: { name: 'คุณทดสอบ ชำระเงิน', tel: '0812345679' }, site: { address: '12/3 ถ.พระราม 2', area: 'บางขุนเทียน' },
  quote: { totalEx: 4500, tax: 'none', vat: 0, total: 4500, travel: 0, minGap: 3100, zoneInput: 'บางขุนเทียน',
    lines: [{ name: 'ล้าง Basic ติดผนัง 9,000–12,000 BTU', qty: 2, unitEx: 700, key: 'CL-Basic Clean-C1-wall-0', group: 'clean', kind: 'service' }] }, ...o });
// independent CRC-16/CCITT-FALSE + EMVCo TLV reader + SVG rasterizer → jsQR (the QR is decoded from its own pixels)
const crc16 = s => { let c = 0xffff; for (const b of Buffer.from(s, 'ascii')) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c.toString(16).toUpperCase().padStart(4, '0'); };
const tlv = s => { const o = {}; for (let i = 0; i + 4 <= s.length;) { const id = s.slice(i, i + 2), len = +s.slice(i + 2, i + 4); o[id] = s.slice(i + 4, i + 4 + len); i += 4 + len; } return o; };
function decodeQr(dataUrl) {
  const svg = Buffer.from(String(dataUrl).split(',')[1] || '', 'base64').toString('utf8'), size = +(/width="(\d+)"/.exec(svg) || [])[1];
  if (!size) return null;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const m of svg.matchAll(/M(\d+) (\d+)h(\d+)v\d+h-\d+z/g)) for (let y = +m[2]; y < +m[2] + +m[3]; y++) for (let x = +m[1]; x < +m[1] + +m[3]; x++) { const i = (y * size + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  const q = jsQR(px, size, size);
  return q ? q.data : null;
}
const BANNED = ['แก้หายแน่นอน', 'ไม่มีปัญหาอีกแน่นอน', 'ประหยัดไฟแน่นอน', 'ปลอดเชื้อ', 'สะอาด 100%', 'รับประกันเย็น', 'ล้างใหญ่ครบทุกจุด', 'ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี', 'อะไหล่เสียแน่นอน', 'เสร็จตามเวลาแน่นอน', 'ต้นทุน', 'อัตราพิเศษ ', 'อัตราโครงการ'];
const SENT = /ส่งอีเมล|ส่งไลน์|ส่ง LINE|แจ้งทางอีเมล|ส่งแล้ว|\b(sent|mailed|notified|emailed)\b/i;
const replies = [];   // every adapter reply, for the global text checks at the end
const rec = r => { replies.push(r); return r; };
const C = async b => rec(await call(b));

let srv = null, app = null, TMP = null;
try {
  /* ======== 0 · vocabulary is the server's ======== */
  const [Tk, Pm, Sf, Db] = await Promise.all([import('../server/tickets.mjs'), import('../server/payments.mjs'), import('../server/staff.mjs'), import('../server/db.mjs')]);
  for (const [k, a, b] of [['KINDS', API.KINDS, Tk.KINDS], ['SERVICES', API.SERVICES, Tk.SERVICES], ['STATUSES', API.STATUSES, Tk.STATUSES], ['SLOTS', API.SLOTS, Tk.SLOTS], ['ACTIVE', API.ACTIVE, Tk.ACTIVE],
    ['CONSENT_DEFAULT', API.CONSENT_DEFAULT, Tk.CONSENT_DEFAULT], ['HEADERS', API.HEADERS, Db.HEADERS], ['ROLES', API.ROLES, Sf.ROLES], ['REQ_KINDS', API.REQ_KINDS, Pm.REQ_KINDS],
    ['REQ_STATUS', API.REQ_STATUS, Pm.REQ_STATUS], ['PAY_METHODS', API.PAY_METHODS, Pm.PAY_METHODS], ['PAY_STATUS', API.PAY_STATUS, Pm.PAY_STATUS]]) ok(same(a, b), `${k} equals the server's`, [a, b]);
  ok(Object.isFrozen(TEST_PAY) && TEST_PAY.promptpayId === '0000000000000' && TEST_PAY.bank === 'ธนาคารตัวอย่าง' && TEST_PAY.accountNo === '000-0-00000-0' && TEST_PAY.onsite === true && TEST_PAY.payee === 'บริษัท สหบูรพากรุ๊ป จำกัด', 'TEST_PAY: frozen placeholder settings', TEST_PAY);
  ok(same(Object.keys(TEST_ACCOUNTS), ['admin', 'staff', 'tech']) && TEST_ACCOUNTS.admin.name === 'ผู้ดูแล (ทดสอบ)' && TEST_ACCOUNTS.tech.role === 'tech', 'three test accounts');

  /* ======== A · not connected / read-only ======== */
  delete globalThis.claude; testHooks.reset();
  let r = await call({ action: 'track', id: ID0 + '001', tel: TEL });
  ok(r.error === 'not_connected' && same(Object.keys(r.rejectedWith), ['code']), 'no claude runtime → rejects exactly {code:"not_connected"}', r);
  globalThis.claude = { use: async () => null }; testHooks.reset();
  ok((await call({ action: 'create', ticket: base() })).error === 'not_connected', 'use("db") → null (signed out / not granted) → not_connected');
  install();
  U.write = false;
  for (const b of [{ action: 'track', id: ID0 + '001', tel: TEL }, { action: 'slots', from: day(0), days: 7 }, { action: 'create', ticket: base() }, { action: 'login', user: 'admin', password: PW }, { action: 'list', token: 'x' }])
    ok((await call(b)).error === 'read_only', `can('data.write') false → read_only for ${b.action}`);
  ok(fake.st.calls === 0, 'a read-only viewer never touches the store', fake.st.calls);
  U.write = null; fake.st.readOnly = true;
  ok((await call({ action: 'create', ticket: base() })).error === 'read_only', 'can() null + the store refuses a well-formed write (invalid_argument) → read_only');
  ok((await call({ action: 'login', user: 'admin', password: PW })).error === 'read_only', 'can() null: login (writes a session) → read_only');
  ok((await call({ action: 'track', id: ID0 + '001', tel: TEL })).error === 'not_found', 'can() null: reads still answer (nothing stored yet → not_found)');
  ok(![...fake.st.docs.keys()].some(k => k.startsWith('tickets/') || k.startsWith('sessions/')), 'nothing stored by the refused writes');
  fake.st.readOnly = false; U.write = true; install(createFakeDb());

  /* ======== B · create ======== */
  const r1 = await C({ action: 'create', ticket: base() });
  ok(r1.ok && r1.id === ID0 + '001' && r1.status === 'new' && r1.statusTh === 'รับคำขอแล้ว รอยืนยัน' && !r1.repeat, 'create → first id of the Bangkok day SBP-<พ.ศ.><MMDD>-001', r1);
  const r2 = await C({ action: 'create', ticket: base({ customer: { name: 'ลูกค้า 2', tel: '0899999999' }, slot: 'PM' }) });
  ok(r2.ok && r2.id === ID0 + '002', 'sequence …-001 → …-002', r2);
  ok(same(fake.raw('counters/ticket'), { k: 'T' + (+day(0).slice(0, 4) + 543) + day(0).slice(5, 7) + day(0).slice(8, 10), n: 2 }), 'counter document {k, n}', fake.raw('counters/ticket'));
  const bad = async (t, code, msg) => { const x = await C({ action: 'create', ticket: t }); ok(x.ok === false && x.error === code, msg, x); };
  await bad(base({ customer: { name: 'x', tel: '12345' } }), 'bad_tel', 'bad phone → bad_tel');
  await bad(base({ customer: { name: '', tel: '0812345670' } }), 'bad_name', 'missing name → bad_name');
  await bad(base({ consent: false, customer: { name: 'ก', tel: '0812345671' } }), 'no_consent', 'no consent → no_consent');
  await bad(base({ consent: 'true', customer: { name: 'ก', tel: '0812345671' } }), 'no_consent', 'consent must be the boolean true');
  await bad(base({ prefDate: day(-1), customer: { name: 'ก', tel: '0812345672' } }), 'bad_date', 'past date → bad_date');
  await bad(base({ prefDate: '2027-02-30', customer: { name: 'ก', tel: '0812345672' } }), 'bad_date', 'impossible date → bad_date');
  await bad(base({ prefDate: day(370), customer: { name: 'ก', tel: '0812345672' } }), 'bad_date', 'more than a year ahead → bad_date');
  for (const k of ['spam', 'constructor', '__proto__', 'toString']) await bad(base({ kind: k, customer: { name: 'ก', tel: '0812345673' } }), 'bad_kind', `kind "${k}" → bad_kind`);
  await bad(base({ website: 'http://spam', customer: { name: 'ก', tel: '0812345674' } }), 'rejected', 'honeypot → rejected');
  await bad(base({ customer: { name: 'ก', tel: '0812345675', email: 'not-an-email' } }), 'bad_email', 'bad email → bad_email');
  await bad(base({ customer: { name: 'ก', tel: '0812345675' }, quote: { lines: 'x' } }), 'bad_json', 'quote.lines not an array → bad_json');
  await bad({ kind: 'inquiry', consent: true, customer: { name: 'ไม่มีเบอร์' } }, 'bad_tel', 'inquiry still needs a phone');
  ok((await C({ action: 'nope' })).error === 'unknown_action' && (await C([1, 2])).error === 'unknown_action' && (await C(null)).error === 'unknown_action', 'unknown action / non-object body → unknown_action');
  ok((await C({ action: 'create', ticket: base({ details: 'x'.repeat(40000) }) })).error === 'too_large', 'body over 30,000 characters → too_large');
  { let deep = 0; for (let i = 0; i < 100; i++) deep = [deep]; ok((await C({ action: 'create', ticket: base({ details: deep }) })).error === 'bad_json', 'nesting over 64 levels → bad_json'); }
  const ridT = base({ rid: 'art-test-rid-0001', customer: { name: 'ส่งซ้ำ', tel: '0855555555' } });
  const nT = () => [...fake.st.docs.keys()].filter(k => k.startsWith('tickets/')).length;
  const i1 = await C({ action: 'create', ticket: ridT }), n1 = nT(), i2 = await C({ action: 'create', ticket: ridT });
  ok(i1.ok && !i1.repeat && i2.ok && i2.repeat === true && i2.id === i1.id && nT() === n1, 'idempotent rid: the retry returns the same id with repeat:true, nothing new stored', [i1, i2]);
  const i3 = await C({ action: 'create', ticket: { ...ridT, customer: { name: 'คนอื่น', tel: '0866666666' } } });
  ok(i3.ok && !i3.repeat && i3.id !== i1.id, 'the same rid from another phone is a new ticket', i3);
  const fb = await C({ action: 'create', ticket: { kind: 'feedback', customer: {}, details: 'ใช้งานง่าย 5', source: 'artifact test' } });
  const fbDoc = fake.raw('tickets/' + fb.id) || {};
  ok(fb.ok && fbDoc.name === 'ไม่ระบุชื่อ' && fbDoc.tel === '' && fbDoc.consentText === '', 'anonymous feedback stored as ไม่ระบุชื่อ', fbDoc);
  const d1 = fake.raw('tickets/' + r1.id) || {};
  ok(d1.tel === TEL && d1.units === '{"wall":3,"cassette":1}' && d1.teamDays === 0.3 && /^\[\{"at":/.test(d1.history) && d1.consentText && !('payload' in d1) && Array.isArray(d1.reqs), 'stored ticket = the sheet row (phone with its leading zero) + consent, no raw payload', d1);
  { let lim; for (let i = 0; i < 6; i++) lim = await C({ action: 'create', ticket: base({ customer: { name: 'ซ้ำ', tel: '0870000000' } }) }); ok(lim.error === 'rate_limited', 'sixth ticket from one phone within an hour → rate_limited (per tab)', lim); }

  /* ======== C · track ======== */
  const k1 = await C({ action: 'track', id: r1.id, tel: TEL });
  ok(k1.ok && same(Object.keys(k1.ticket), ['id', 'status', 'statusTh', 'kind', 'service', 'prefDate', 'slot', 'schedDate', 'schedSlot', 'team']) && !JSON.stringify(k1).includes('คุณทดสอบ'), 'track: status only — no name / phone / notes / history, no payment block yet', k1);
  ok((await C({ action: 'track', id: r1.id, tel: '081-234-5678' })).ok, 'track accepts the phone with dashes');
  ok((await C({ action: 'track', id: r1.id, tel: '0899999999' })).error === 'not_found', 'track: wrong phone → not_found');
  ok((await C({ action: 'track', id: r1.id, tel: '' })).error === 'not_found' && (await C({ action: 'track', id: 'SBP-000000-999', tel: TEL })).error === 'not_found', 'track: no phone / unknown id → not_found');
  for (const id of ['a/b', '..', '', 'x'.repeat(300), 'ไทย', null, { x: 1 }]) ok((await C({ action: 'track', id, tel: TEL })).error === 'not_found', `track: id ${JSON.stringify(id).slice(0, 20)} is not a path → not_found (no error)`);
  ok((await C({ action: 'track', id: fb.id, tel: '' })).error === 'not_found' && (await C({ action: 'track', id: fb.id, tel: '0' })).error === 'not_found', 'anonymous feedback is not trackable');

  /* ======== D · staff login ======== */
  ok((await C({ action: 'login', user: 'admin', password: 'wrong-password-0' })).error === 'unauthorized', 'wrong password → unauthorized');
  ok((await C({ action: 'login', user: 'nobody', password: PW })).error === 'unauthorized' && (await C({ action: 'login', user: '', password: '' })).error === 'unauthorized', 'unknown / empty user → unauthorized');
  const la = await C({ action: 'login', user: 'Admin', password: PW }), ls = await C({ action: 'login', user: 'staff', password: PW }), lt = await C({ action: 'login', user: 'tech', password: PW });
  ok(la.ok && typeof la.token === 'string' && la.token.length >= 40 && la.token !== PW && la.name === 'ผู้ดูแล (ทดสอบ)' && la.role === 'admin' && la.roleTh === 'ผู้ดูแล', 'admin login (username case-insensitive): token + name + role + roleTh', { ...la, token: la.token && la.token.length });
  ok(ls.ok && ls.role === 'staff' && ls.roleTh === 'เจ้าหน้าที่' && ls.name === 'เจ้าหน้าที่ (ทดสอบ)' && lt.ok && lt.role === 'tech' && lt.roleTh === 'ช่าง' && lt.name === 'ช่าง (ทดสอบ)', 'staff + tech accounts with the server role names', [ls.role, lt.role]);
  const sk = [...fake.st.docs.keys()].filter(k => k.startsWith('sessions/'));
  ok(sk.length === 3 && sk.every(k => /^sessions\/[0-9a-f]{64}$/.test(k)) && ![...fake.st.docs].some(([k, v]) => k.includes(la.token) || JSON.stringify(v.data).includes(la.token)), 'sessions stored under the SHA-256 of the token (the token itself is never in the store)', sk);
  const A = { token: la.token }, St = { token: ls.token }, T = { token: lt.token };
  const me = await C({ action: 'me', ...A });
  ok(me.ok && me.name === 'ผู้ดูแล (ทดสอบ)' && me.role === 'admin' && me.roleTh === 'ผู้ดูแล', 'me: who is logged in', me);
  ok((await C({ action: 'list' })).error === 'unauthorized' && (await C({ action: 'list', token: 'wrong' })).error === 'unauthorized' && (await C({ action: 'me', token: { x: 1 } })).error === 'unauthorized', 'list / me need a valid session token');
  // a session document cannot grant itself a role: the role comes from the test account it names
  const forged = 'forged-token-0123456789-abcdefghijklmnop';
  await fake.db.doc('sessions/' + createHash('sha256').update(forged).digest('hex')).set({ user: 'root', role: 'admin', expiresMs: Date.now() + 3600e3 });
  ok((await C({ action: 'me', token: forged })).error === 'unauthorized', 'a session for an unknown user → unauthorized');
  await fake.db.doc('sessions/' + createHash('sha256').update(forged).digest('hex')).set({ user: 'tech', role: 'admin', expiresMs: Date.now() + 3600e3 });
  ok((await C({ action: 'me', token: forged })).role === 'tech', 'a session claiming role admin for "tech" is still tech');
  const lo = await C({ action: 'login', user: 'staff', password: PW });
  ok((await C({ action: 'logout', token: lo.token })).ok && (await C({ action: 'me', token: lo.token })).error === 'unauthorized' && (await C({ action: 'list', token: lo.token })).error === 'unauthorized', 'logout ends the session');
  ok((await C({ action: 'me', ...St })).ok, 'logout ends only that session');
  // 12-hour sliding session (injectable clock)
  { const base0 = Date.now();
    testHooks.setClock(() => base0 + 7 * 3600e3); const m7 = await C({ action: 'me', ...T }); const exp = fake.raw('sessions/' + createHash('sha256').update(lt.token).digest('hex')).expiresMs;
    ok(m7.ok && exp > base0 + 18 * 3600e3, 'after 7 h a used session slides to 12 h from now', exp - base0);
    testHooks.setClock(() => base0 + 13 * 3600e3); ok((await C({ action: 'me', ...A })).error === 'unauthorized', 'an unused session expires after 12 h');
    testHooks.setClock(null); }
  const la2 = await C({ action: 'login', user: 'admin', password: PW }); A.token = la2.token;
  // only failed logins count; 10 failures → rate_limited even with the right password (per tab), then the window passes
  { testHooks.reset(); for (let i = 0; i < 9; i++) await C({ action: 'login', user: 'ghost' + i, password: 'x' });
    ok((await C({ action: 'login', user: 'staff', password: PW })).ok, '9 failed attempts: a correct login still works');
    await C({ action: 'login', user: 'ghost9', password: 'x' });
    ok((await C({ action: 'login', user: 'staff', password: PW })).error === 'rate_limited', 'after 10 failed attempts → rate_limited (even the right password)');
    const b0 = Date.now(); testHooks.setClock(() => b0 + 16 * 60e3);
    ok((await C({ action: 'login', user: 'staff', password: PW })).ok, '15 minutes later login works again');
    testHooks.setClock(null); }

  /* ======== E · list + update ======== */
  const L = await C({ action: 'list', ...A });
  const newest = L.tickets && L.tickets.every((t, i, a) => !i || a[i - 1].createdAt > t.createdAt || (a[i - 1].createdAt === t.createdAt && a[i - 1].id > t.id));
  ok(L.ok && newest && L.tickets.length === nT() && same(L.teams, ['ทีม 1', 'ทีม 2', 'ผู้รับเหมา']) && L.capacity === 2 && same(L.statuses, API.STATUSES) && same(L.slots, API.SLOTS), 'list: every ticket newest first + teams / statuses / slots / capacity', L.tickets && L.tickets.map(t => t.id));
  const row1 = (L.tickets || []).find(t => t.id === r1.id) || {};
  ok(same(Object.keys(row1), [...API.HEADERS.filter(k => k !== 'payload'), 'priceCheck']) && row1.priceCheck === null && row1.travelFee === '' && row1.quoteTotalEx === '', 'list row = the 34 sheet columns + priceCheck (no payload, no internal arrays)', Object.keys(row1));
  ok((await C({ action: 'list', status: 'new', limit: 2, ...A })).tickets.length === 2 && (await C({ action: 'list', status: 'done', ...A })).tickets.length === 0, 'list status filter + limit');
  for (const s of ['bogus', 'toString', '__proto__']) ok((await C({ action: 'update', id: r1.id, patch: { status: s }, ...A })).error === 'bad_status', `update status "${s}" → bad_status`);
  ok((await C({ action: 'update', id: r1.id, patch: { team: 'ทีม 9' }, ...A })).error === 'bad_team', 'unknown team → bad_team');
  ok((await C({ action: 'update', id: r1.id, patch: { schedDate: '2099-13-45' }, ...A })).error === 'bad_date', 'impossible schedDate → bad_date');
  ok((await C({ action: 'update', id: 'SBP-000000-999', patch: { status: 'done' }, ...A })).error === 'not_found', 'update unknown id → not_found');
  ok(!fake.raw('tickets/SBP-000000-999'), 'a failed update creates no document');
  const up = await C({ action: 'update', id: r1.id, staff: 'ชื่อที่พิมพ์เอง', patch: { status: 'confirmed', team: 'ทีม 1', schedDate: day(3), schedSlot: 'PM', staffNote: 'ลูกค้าขอให้โทรก่อน 30 นาที' }, ...St });
  const h1 = up.ok ? JSON.parse(up.ticket.history) : [];
  ok(up.ok && up.ticket.status === 'confirmed' && up.ticket.team === 'ทีม 1' && up.ticket.schedDate === day(3) && up.ticket.schedSlot === 'PM' && up.ticket.updatedAt, 'update applies and returns the row', up);
  ok(h1.length === 2 && h1[0].by === 'เว็บไซต์' && h1[1].by === 'เจ้าหน้าที่ (ทดสอบ)' && h1[1].s === 'new→confirmed' && h1[1].note === 1, 'history: by = the logged-in account (not the typed staff name)', h1);
  const w0 = fake.st.writes; const up2 = await C({ action: 'update', id: r1.id, patch: { status: 'confirmed' }, ...A });
  ok(up2.ok && JSON.parse(up2.ticket.history).length === 2 && fake.st.writes - w0 <= 1, 'an update that changes nothing adds no history (and does not rewrite the ticket)', fake.st.writes - w0);
  const k2 = await C({ action: 'track', id: r1.id, tel: TEL });
  ok(k2.ticket.status === 'confirmed' && k2.ticket.schedDate === day(3) && k2.ticket.team === 'จัดทีมแล้ว' && !JSON.stringify(k2).includes('โทรก่อน') && !JSON.stringify(k2).includes('ทีม 1'), 'the customer sees the appointment, not the staff note or team name', k2);
  ok((await C({ action: 'update', id: r1.id, patch: { staffNote: 'ช่างแก้ได้' }, ...T })).ok, 'a technician may update a ticket (as on the server)');

  /* ======== F · slots ======== */
  const S1 = await C({ action: 'slots', from: day(0), days: 7 });
  const sd = d => (S1.days || []).find(x => x.date === day(d)) || {};
  ok(S1.ok && S1.capacity === 2 && S1.days.length === 7 && S1.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && [d.AM, d.PM, d.EVE].every(Number.isInteger)), 'slots shape', S1);
  ok(sd(3).PM === 1 && sd(2).PM === 1 && sd(2).AM >= 2, 'counts follow the schedule, else the preferred day', [sd(2), sd(3)]);
  ok(!/ทดสอบ|0812345678|example\.com|ลูกค้า/.test(JSON.stringify(S1)), 'slots carry no customer data');
  await C({ action: 'update', id: r2.id, patch: { status: 'cancelled' }, ...A });
  ok((await C({ action: 'slots', from: day(0), days: 7 })).days.find(x => x.date === day(2)).PM === sd(2).PM - 1, 'a cancelled booking frees its slot');
  const sx = await C({ action: 'slots', from: '2099-13-45', days: 99 });
  ok(sx.ok && sx.days.length === 31 && sx.days[0].date === day(0), 'bad from-date → today, days capped at 31');

  /* ======== G · server pricing in the browser ======== */
  const BP = await C({ action: 'create', ticket: boardPay() });
  const P2 = await C({ action: 'create', ticket: base({ customer: { name: 'ราคาถูกแก้', tel: '0831000002' }, units: { wall: 6 }, quote: quote([CL(6, 100)], { totalEx: 600, total: 600, vat: 0, travel: 0, minGap: 0 }) }) });
  const P3 = await C({ action: 'create', ticket: base({ customer: { name: 'ต่างจังหวัด', tel: '0831000003', taxInvoice: true, taxName: 'บริษัท นครปฐม จำกัด', taxId: '0735555555555' }, units: { wall: 1 }, site: { address: '1 ถ.เพชรเกษม', area: 'นครปฐม' },
    quote: quote([CL(1), { name: SV.name, key: 'S-' + SV.code, group: 'install', kind: 'survey', qty: 1, unitEx: 5000 }], { tax: 'invoice', zoneInput: 'นครปฐม' }) }) });
  const P5 = await C({ action: 'create', ticket: base({ kind: 'quote', service: 'buy', customer: { name: 'ซื้อเครื่อง', tel: '0831000005' }, quote: quote([{ name: SKU.sku, key: 'P-' + SKU.sku, group: 'product', kind: 'product', qty: 1, unitEx: SKU.px }]) }) });
  ok([BP, P2, P3, P5].every(x => x.ok), 'pricing tickets stored', [BP, P2, P3, P5]);
  const LC = await C({ action: 'list', ...A }), y = id => (LC.tickets || []).find(t => t.id === id) || {};
  ok(y(BP.id).priceCheck && y(BP.id).priceCheck.verified && y(BP.id).priceCheck.match && y(BP.id).priceCheck.payable && y(BP.id).quoteTotalEx === 4500 && y(BP.id).zoneTier === 'core', 'board-pay cleaning quote: verified, matching, payable, server total 4,500', y(BP.id).priceCheck);
  ok(y(P2.id).priceCheck.match === false && y(P2.id).priceCheck.issues.some(i => i.line === 0 && i.check === 'mismatch' && i.client === 100 && i.server === CLR) && y(P2.id).quoteTotalEx === MIN && y(P2.id).quoteLines.includes(`× 6 = ${6 * CLR}`), 'a tampered unit price is flagged; the stored totals are the server\'s', y(P2.id).priceCheck);
  const zNP = core.checkZone('นครปฐม'), ex3 = CLR + zNP.fee + (MIN - CLR), q3 = (await C({ action: 'paydetail', id: P3.id, ...A })).quote || { lines: [{}, {}], totals: {} };
  ok(q3.lines[1].unitEx === null && q3.lines[1].check === 'survey_has_price' && y(P3.id).travelFee === zNP.fee && q3.totals.totalEx === ex3 && q3.totals.vat === core.vatOf(ex3) && y(P3.id).priceCheck.payable === false, 'survey line never priced; travel + VAT computed; not payable', q3.totals);
  ok(y(P5.id).priceCheck.verified && y(P5.id).priceCheck.payable === false && y(P5.id).quoteTotalEx === SKU.px, 'a product line is priced but not payable');
  const pd0 = await C({ action: 'paydetail', id: BP.id, ...A });
  ok(pd0.ok && pd0.suggested && pd0.suggested.amount === 4500 && pd0.suggested.basis === 'server_quote' && pd0.suggested.tax === 'none' && pd0.suggested.totalEx === 4500 && pd0.suggested.vat === 0, 'paydetail: suggested 4,500 for the board-pay cleaning quote', pd0.suggested);
  ok(pd0.summary === null && !pd0.requests.length && pd0.can.request && pd0.can.verify && pd0.can.refund && pd0.payee.promptpay === '0xxxxxxxx0000' && pd0.payee.bank.name === 'ธนาคารตัวอย่าง' && pd0.payee.bank.accountNo === '000-0-00000-0' && pd0.payee.bank.accountName === TEST_PAY.payee && pd0.test === true, 'paydetail shape: no money yet, admin can do everything, test payee', pd0);
  ok((await C({ action: 'paydetail', id: 'SBP-000000-999', ...A })).error === 'not_found', 'paydetail unknown id → not_found');

  /* ======== H · payments ======== */
  ok((await C({ action: 'payreq', id: BP.id, kind: 'full', ...T })).error === 'forbidden', 'tech cannot ask for money → forbidden');
  ok((await C({ action: 'payreq', id: BP.id, kind: 'toString', ...A })).error === 'bad_kind', 'payreq bad kind');
  for (const a of ['0', '-100', 'abc', '1.005', '0.50', '1e5']) ok((await C({ action: 'payreq', id: BP.id, kind: 'deposit', amount: a, ...A })).error === 'bad_amount', `payreq bad_amount for "${a}"`);
  ok((await C({ action: 'payreq', id: P3.id, kind: 'full', ...A })).error === 'amount_required', 'payreq without amount on a non-payable quote (survey line) → amount_required');
  ok((await C({ action: 'payreq', id: P5.id, kind: 'full', ...A })).error === 'amount_required' && (await C({ action: 'payreq', id: r1.id, kind: 'full', amount: '', ...A })).error === 'amount_required', 'payreq without amount: product quote / no quote → amount_required');
  const pr = await C({ action: 'payreq', id: BP.id, kind: 'full', ...A }), rq = (pr.requests || [])[0] || {};
  ok(pr.ok && rq.amount === 4500 && rq.status === 'open' && rq.statusTh === 'รอชำระ' && rq.basis === 'server_quote' && /^PR-[A-Z0-9]{8}$/.test(rq.id) && /^[2-9A-HJ-NP-Z]{6}$/.test(rq.ref) && rq.expiresAt === day(7) && rq.createdBy === 'ผู้ดูแล (ทดสอบ)' && rq.paid === 0, 'payreq without amount = the suggested 4,500 (server quote)', rq);
  ok(pr.suggested === null && pr.summary.status === 'unpaid' && pr.summary.due === 4500 && pr.summary.asked === 4500, 'after the request: nothing left to suggest, unpaid', [pr.suggested, pr.summary]);
  ok((fake.raw('tickets/' + BP.id).reqs[0] || {}).amount === 450000, 'the store keeps satang (replies are baht)');
  const BTEL = '0812345679', tp = await C({ action: 'track', id: BP.id, tel: BTEL }), py = (tp.ticket || {}).payment;
  ok(py && py.status === 'unpaid' && py.statusTh === 'รอชำระ' && py.due === 4500 && py.paid === 0 && py.pending === false && py.methods.join() === 'promptpay,transfer,onsite' && py.payee === TEST_PAY.payee && py.test === true, 'track shows the payment block (test)', py);
  ok(py && py.requests.length === 1 && py.requests[0].id === rq.id && py.requests[0].remaining === 4500 && py.requests[0].submitted === false && !py.receipts.length && !/ผู้ดูแล|createdBy|basis|note/.test(JSON.stringify(tp)), 'track: the open request only — no staff names / internal fields', py);
  const pp = await C({ action: 'pay', id: BP.id, tel: BTEL, req: rq.id, method: 'promptpay' }), P = pp.pay || {};
  ok(pp.ok && P.method === 'promptpay' && P.amount === 4500 && P.amountTh === '4,500' && P.ref === rq.ref && P.promptpay === '0xxxxxxxx0000' && P.payee === TEST_PAY.payee && P.test === true && /^data:image\/svg\+xml;base64,/.test(P.qr || ''), 'pay promptpay: payload + data-URL QR + test:true', { ...P, qr: (P.qr || '').slice(0, 40) });
  const pl = P.payload || '', tg = tlv(pl), t29 = tlv(tg['29'] || '');
  ok(crc16('123456789') === '29B1' && pl.slice(-8, -4) === '6304' && crc16(pl.slice(0, -4)) === pl.slice(-4), 'PromptPay payload CRC-16 is valid', pl);
  ok(tg['00'] === '01' && tg['01'] === '12' && t29['00'] === 'A000000677010111' && t29['02'] === '0000000000000' && tg['53'] === '764' && tg['54'] === '4500.00' && tg['58'] === 'TH', 'payload: test PromptPay id (tag 29/02), THB, amount tag 54 = 4500.00, dynamic QR', tg);
  ok(decodeQr(P.qr) === pl, 'the QR image decodes (rasterized SVG → jsQR) to exactly the payload');
  const ptf = await C({ action: 'pay', id: BP.id, tel: BTEL, req: rq.id, method: 'transfer' });
  ok(ptf.ok && ptf.pay.method === 'transfer' && same(ptf.pay.bank, { name: 'ธนาคารตัวอย่าง', accountName: TEST_PAY.payee, accountNo: '000-0-00000-0' }) && !ptf.pay.payload && ptf.pay.test === true, 'pay transfer: the test bank account', ptf);
  ok((await C({ action: 'pay', id: BP.id, tel: BTEL, req: rq.id, method: 'onsite' })).pay.method === 'onsite', 'pay onsite');
  ok((await C({ action: 'pay', id: BP.id, tel: BTEL, req: rq.id, method: 'gateway' })).error === 'pay_unavailable', 'gateway → pay_unavailable');
  ok((await C({ action: 'pay', id: BP.id, tel: BTEL, req: rq.id, method: 'cash' })).error === 'bad_method', 'pay: unknown method → bad_method');
  ok((await C({ action: 'pay', id: BP.id, tel: '0899999999', req: rq.id, method: 'promptpay' })).error === 'not_found', 'pay: wrong phone → not_found');
  ok((await C({ action: 'pay', id: BP.id, tel: BTEL, req: 'PR-NOPE', method: 'promptpay' })).error === 'pay_closed', 'pay: unknown request → pay_closed');
  const pdn = await C({ action: 'paid', id: BP.id, tel: BTEL, req: rq.id, method: 'promptpay', reference: 'TX-0001' });
  ok(pdn.ok && pdn.payment.pending === true && pdn.payment.status === 'unpaid' && pdn.payment.paid === 0 && pdn.payment.requests[0].submitted === true, 'paid → submitted + pending (never paid by itself)', pdn.payment);
  await C({ action: 'paid', id: BP.id, tel: BTEL, req: rq.id, method: 'promptpay', reference: 'TX-0001' });
  const pd1 = await C({ action: 'paydetail', id: BP.id, ...A }), pm = pd1.payments || [];
  ok(pm.length === 1 && pm[0].status === 'submitted' && pm[0].statusTh === 'รอตรวจยอด' && pm[0].byWho === 'ลูกค้า' && pm[0].receiptNo === null && pm[0].amount === 4500 && pd1.summary.pending === 1, 'one submitted payment (a repeated report is not doubled)', pm);
  ok((await C({ action: 'payverify', payment: pm[0].id, decision: 'verify', ...T })).error === 'forbidden', 'tech payverify → forbidden');
  ok((await C({ action: 'payverify', payment: pm[0].id, decision: 'maybe', ...A })).error === 'bad_decision', 'payverify bad decision');
  ok((await C({ action: 'payverify', payment: 'PM-NOPE', decision: 'verify', ...A })).error === 'not_found', 'payverify unknown payment → not_found');
  const pv = await C({ action: 'payverify', payment: pm[0].id, decision: 'verify', ...A }), pv0 = (pv.payments || [])[0] || {};
  ok(pv.ok && pv0.status === 'verified' && pv0.receiptNo === RC0 + '0001' && pv0.verifiedBy === 'ผู้ดูแล (ทดสอบ)', 'verify → receipt RC<พ.ศ.><MM>-0001', pv0);
  ok(pv.requests[0].status === 'paid' && pv.summary.status === 'paid' && pv.summary.paid === 4500 && pv.summary.due === 0 && pv.summary.pending === 0, 'the request settles to paid', pv.summary);
  ok((await C({ action: 'payverify', payment: pm[0].id, decision: 'verify', ...A })).error === 'pay_closed', 'a verified payment cannot be verified twice');
  const tp2 = await C({ action: 'track', id: BP.id, tel: BTEL }), py2 = tp2.ticket.payment;
  ok(py2.status === 'paid' && py2.statusTh === 'ชำระครบแล้ว' && py2.receipts.length === 1 && py2.receipts[0].no === RC0 + '0001' && py2.receipts[0].amount === 4500 && py2.receipts[0].method === 'พร้อมเพย์ (QR)' && py2.receipts[0].at === day(0) && !JSON.stringify(tp2).includes('ผู้ดูแล'), 'track shows the receipt, no staff name', py2);
  ok((await C({ action: 'pay', id: BP.id, tel: BTEL, req: rq.id, method: 'promptpay' })).error === 'pay_closed' && (await C({ action: 'payvoid', req: rq.id, reason: 'x', ...A })).error === 'pay_closed', 'a paid request cannot be paid or voided');
  // typed amount (2 decimals) by a staff account; a technician's cash → submitted; the office verifies → RC…-0002
  const pr3 = await C({ action: 'payreq', id: P3.id, kind: 'deposit', amount: '1,500.50', ...St }), rq3 = (pr3.requests || [])[0] || {};
  ok(pr3.ok && rq3.amount === 1500.5 && rq3.basis === 'staff_confirmed' && rq3.createdBy === 'เจ้าหน้าที่ (ทดสอบ)', 'payreq with a typed amount by a staff account', rq3);
  const pp3 = await C({ action: 'pay', id: P3.id, tel: '0831000003', req: rq3.id, method: 'promptpay' });
  ok(pp3.ok && pp3.pay.amount === 1500.5 && pp3.pay.amountTh === '1,500.50' && tlv(pp3.pay.payload)['54'] === '1500.50' && decodeQr(pp3.pay.qr) === pp3.pay.payload, 'satang reach the QR exactly (tag 54 = 1500.50)', pp3.pay && pp3.pay.amountTh);
  ok((await C({ action: 'payrecord', id: P3.id, req: rq3.id, method: 'gateway', amount: '500', ...T })).error === 'bad_method', 'payrecord gateway → bad_method');
  for (const a of ['0', '-5', 'ห้าร้อย', '']) ok((await C({ action: 'payrecord', id: P3.id, req: rq3.id, method: 'cash', amount: a, ...T })).error === 'bad_amount', `payrecord bad_amount for "${a}"`);
  ok((await C({ action: 'payrecord', id: P3.id, req: 'PR-NOPE', method: 'cash', amount: '500', ...T })).error === 'not_found', 'payrecord unknown request → not_found');
  const rc = await C({ action: 'payrecord', id: P3.id, req: rq3.id, method: 'cash', amount: '500', note: 'รับเงินสดหน้างาน', ...T }), rcp = (rc.payments || [])[0] || {};
  ok(rc.ok && rcp.status === 'submitted' && rcp.receiptNo === null && rcp.byWho === 'ช่าง (ทดสอบ)' && rc.can.verify === false && rc.can.request === false && rc.can.refund === false, 'tech payrecord → submitted, no receipt; tech can do nothing else', rcp);
  const rv = await C({ action: 'payverify', payment: rcp.id, decision: 'verify', ...St }), rvp = (rv.payments || [])[0] || {};
  ok(rv.ok && rvp.receiptNo === RC0 + '0002' && rvp.verifiedBy === 'เจ้าหน้าที่ (ทดสอบ)', 'staff verifies → RC…-0002', rvp);
  ok(rv.requests[0].status === 'open' && rv.requests[0].paid === 500 && rv.summary.status === 'partial' && rv.summary.due === 1000.5, 'a part payment leaves the request open (partial, due 1,000.50)', rv.summary);
  ok((await C({ action: 'payvoid', req: rq3.id, reason: 'x', ...A })).error === 'has_payments', 'payvoid: an open request with a payment → has_payments');
  // refunds: admin only, never more than paid − refunded, reason required
  ok((await C({ action: 'refund', id: P3.id, amount: '100', method: 'transfer', reason: 'ทดสอบ', ...St })).error === 'forbidden' && (await C({ action: 'refund', id: P3.id, amount: '100', method: 'transfer', reason: 'ทดสอบ', ...T })).error === 'forbidden', 'refund: staff / tech → forbidden');
  ok((await C({ action: 'refund', id: P3.id, amount: '500.01', method: 'transfer', reason: 'ทดสอบ', ...A })).error === 'refund_too_large', 'refund more than paid → refund_too_large');
  ok((await C({ action: 'refund', id: P3.id, amount: '100', method: 'transfer', reason: '  ', ...A })).error === 'reason_required', 'refund without a reason → reason_required');
  ok((await C({ action: 'refund', id: P3.id, amount: '100', method: 'edc', reason: 'ทดสอบ', ...A })).error === 'bad_method' && (await C({ action: 'refund', id: P3.id, amount: '0', method: 'transfer', reason: 'ทดสอบ', ...A })).error === 'bad_amount', 'refund: bad method / bad amount');
  const rf = await C({ action: 'refund', id: P3.id, amount: '200.25', method: 'transfer', reason: 'คืนส่วนต่าง', reference: 'RF-TX-1', ...A });
  ok(rf.ok && rf.refunds.length === 1 && rf.refunds[0].amount === 200.25 && rf.refunds[0].byWho === 'ผู้ดูแล (ทดสอบ)' && rf.summary.refunded === 200.25 && rf.summary.status === 'part_refunded', 'admin refund recorded (2 decimals) → part_refunded', rf.summary);
  ok((await C({ action: 'refund', id: P3.id, amount: '300', method: 'transfer', reason: 'ทดสอบ', ...A })).error === 'refund_too_large', 'a second refund is limited to paid − refunded (299.75 left)');
  // void rules
  const prv = await C({ action: 'payreq', id: P2.id, kind: 'extra', amount: '300', ...A }), rqv = (prv.requests || [])[0] || {};
  ok((await C({ action: 'payvoid', req: rqv.id, reason: 'x', ...T })).error === 'forbidden' && (await C({ action: 'payvoid', req: 'PR-NOPE', reason: 'x', ...A })).error === 'not_found', 'payvoid: tech → forbidden, unknown → not_found');
  const vd = await C({ action: 'payvoid', req: rqv.id, reason: 'ลูกค้าเปลี่ยนวิธีชำระ', ...A });
  ok(vd.ok && vd.requests[0].status === 'void' && vd.requests[0].statusTh === 'ยกเลิกรายการ' && /ยกเลิก: ลูกค้าเปลี่ยนวิธีชำระ/.test(vd.requests[0].note), 'payvoid an open request without payments (reason kept)', vd.requests);
  ok((await C({ action: 'payvoid', req: rqv.id, reason: 'x', ...A })).error === 'pay_closed', 'a void request cannot be voided twice');
  const prb = await C({ action: 'payreq', id: P2.id, kind: 'balance', amount: '700', ...A }), rqb = (prb.requests || []).find(x => x.status === 'open') || {};
  await C({ action: 'paid', id: P2.id, tel: '0831000002', req: rqb.id, method: 'transfer' });
  ok((await C({ action: 'payvoid', req: rqb.id, reason: 'x', ...A })).error === 'has_payments', 'payvoid: a reported (unchecked) transfer → has_payments');
  const sub = ((await C({ action: 'paydetail', id: P2.id, ...A })).payments || []).find(x => x.reqId === rqb.id) || {};
  const rj = await C({ action: 'payverify', payment: sub.id, decision: 'reject', note: 'ไม่พบยอด', ...A });
  ok(rj.ok && rj.payments[0].status === 'rejected' && rj.payments[0].receiptNo === null && rj.summary.paid === 0, 'reject → ไม่พบยอด, no receipt, nothing counted', rj.payments);
  ok((await C({ action: 'payvoid', req: rqb.id, reason: 'ไม่พบยอด', ...A })).ok, 'after the office rejects the report the request can be voided');
  const tv = await C({ action: 'track', id: P2.id, tel: '0831000002' });
  ok(tv.ok && tv.ticket.payment && !tv.ticket.payment.requests.length && (await C({ action: 'pay', id: P2.id, tel: '0831000002', req: rqv.id, method: 'promptpay' })).error === 'pay_closed', 'void requests are hidden from the customer and cannot be paid');
  await C({ action: 'update', id: P2.id, patch: { status: 'cancelled' }, ...A });
  ok((await C({ action: 'payreq', id: P2.id, kind: 'full', amount: '100', ...A })).error === 'ticket_cancelled', 'no payment request on a cancelled ticket → ticket_cancelled');
  const r99 = await C({ action: 'payrecord', id: P5.id, method: 'transfer', amount: '99.99', reference: 'TX-99', ...A }), p99 = (r99.payments || [])[0] || {};
  ok(r99.ok && p99.amount === 99.99 && p99.status === 'verified' && p99.receiptNo === RC0 + '0003' && r99.summary.paid === 99.99 && r99.summary.status === 'paid', 'admin payrecord (no request) → verified at once, 99.99 exact, RC…-0003', p99);
  const lp = ((await C({ action: 'list', ...A })).tickets || []).find(t => t.id === BP.id) || {};
  ok(lp.pay && lp.pay.status === 'paid' && lp.pay.paid === 4500 && lp.pay.asked === 4500 && lp.pay.open === 0 && lp.pay.pending === 0 && lp.priceCheck.payable === true, 'list carries the money summary (baht) + price check', lp.pay);
  // a request expires the day after expiresAt (injectable clock)
  { const prx = await C({ action: 'payreq', id: r1.id, kind: 'deposit', amount: '500', ...A }), rx = prx.requests[0], b0 = Date.now();
    testHooks.setClock(() => b0 + 8 * 864e5);
    const tx = await C({ action: 'track', id: r1.id, tel: TEL });
    ok(tx.ticket.payment.requests[0].status === 'expired' && tx.ticket.payment.due === 0 && (await C({ action: 'pay', id: r1.id, tel: TEL, req: rx.id, method: 'promptpay' })).error === 'pay_closed', 'after its last day a request is expired and cannot be paid', tx.ticket.payment);
    testHooks.setClock(null); }

  /* ======== I · store robustness ======== */
  testHooks.reset();   // fresh per-tab limits for this section (the store stays)
  fake.st.fail.push('unavailable');
  ok((await C({ action: 'track', id: r1.id, tel: TEL })).ok, 'one `unavailable` is retried once transparently');
  fake.st.fail.push('unavailable', 'unavailable');
  ok((await C({ action: 'track', id: r1.id, tel: TEL })).error === 'network', 'twice `unavailable` → network');
  fake.st.fail.push('revoked'); ok((await C({ action: 'track', id: r1.id, tel: TEL })).error === 'not_connected', 'revoked → not_connected');
  fake.st.fail.push('resource_exhausted'); ok((await C({ action: 'slots' })).error === 'network', 'resource_exhausted → network');
  { const before = nT(); fake.st.failSet = { prefix: 'tickets/', code: 'quota_exceeded' };   // the store is full: the ticket write fails
    const qx = await C({ action: 'create', ticket: base({ customer: { name: 'เต็ม', tel: '0844444444' } }) });
    fake.st.failSet = null;
    ok(qx.error === 'quota_exceeded', 'a full store surfaces quota_exceeded (no fake success)', qx);
    ok(nT() === before, 'nothing stored when the write fails'); }
  const topSeq = () => Math.max(...[...fake.st.docs.keys()].filter(k => k.startsWith('tickets/' + ID0)).map(k => +k.slice(-3)));
  // another tab holds the day counter: this tab waits for the lease, then continues the sequence
  { const last = fake.raw('counters/ticket').n; fake.hold('counters/ticket', 'other-tab', 1200); const w = Date.now();
    const cx = await C({ action: 'create', ticket: base({ customer: { name: 'รอคิว', tel: '0844444445' } }) });
    ok(cx.ok && Date.now() - w >= 1000 && +cx.id.slice(-3) === last + 1, 'a busy counter lease is waited for, then the sequence continues', [cx, Date.now() - w]); }
  // counters lost (test data reset): ids and receipts never collide with what is stored
  { const before = nT(), top = topSeq(); await fake.db.doc('counters/ticket').delete();
    const cy = await C({ action: 'create', ticket: base({ customer: { name: 'หลังรีเซ็ต', tel: '0844444446' } }) });
    ok(cy.ok && nT() === before + 1 && fake.raw('tickets/' + ID0 + '001').name === 'คุณทดสอบ ระบบ' && +cy.id.slice(-3) === top + 1, 'counter deleted → the next id continues after the highest stored (nothing overwritten)', [cy, top]);
    await fake.db.doc('counters/receipt').delete();
    const cr = await C({ action: 'payrecord', id: P5.id, method: 'cash', amount: '1', ...A });
    ok(cr.ok && cr.payments.at(-1).receiptNo === RC0 + '0004', 'receipt counter deleted → the next receipt continues after RC…-0003', cr.payments && cr.payments.at(-1)); }
  // one tab: concurrent calls run one at a time (no lost update, distinct ids)
  { const xs = await Promise.all([0, 1, 2, 3].map(i => C({ action: 'create', ticket: base({ customer: { name: 'พร้อมกัน ' + i, tel: '084000000' + i } }) })));
    ok(xs.every(x => x.ok) && new Set(xs.map(x => x.id)).size === 4, 'four concurrent creates → four distinct ids', xs.map(x => x.id));
    const ys = await Promise.all([0, 1, 2].map(i => C({ action: 'payrecord', id: P5.id, method: 'cash', amount: String(10 + i), ...T })));
    ok(ys.every(x => x.ok) && (await C({ action: 'paydetail', id: P5.id, ...A })).payments.filter(p => p.status === 'submitted').length === 3, 'three concurrent payrecords on one ticket → all three kept'); }
  // two tabs (two module instances, two lease holders) on the same store
  { const API2 = await import('../assets/artifact-api.js?tab=2'), C2 = b => API2.handle(b).then(r => rec(r), e => ({ ok: false, error: e && e.code }));
    const xs = await Promise.all([C({ action: 'create', ticket: base({ customer: { name: 'แท็บ 1', tel: '0841111111' } }) }), C2({ action: 'create', ticket: base({ customer: { name: 'แท็บ 2', tel: '0842222222' } }) }),
      C({ action: 'create', ticket: base({ customer: { name: 'แท็บ 1 ข', tel: '0841111112' } }) }), C2({ action: 'create', ticket: base({ customer: { name: 'แท็บ 2 ข', tel: '0842222223' } }) })]);
    ok(xs.every(x => x.ok) && new Set(xs.map(x => x.id)).size === 4, 'two tabs creating at once → distinct ids', xs.map(x => x.id || x.error));
    const n0 = (await C({ action: 'paydetail', id: P5.id, ...A })).payments.length;
    const ys = await Promise.all([C({ action: 'payrecord', id: P5.id, method: 'cash', amount: '21', ...T }), C2({ action: 'payrecord', id: P5.id, method: 'cash', amount: '22', ...T }), C2({ action: 'payrecord', id: P5.id, method: 'cash', amount: '23', ...T })]);
    ok(ys.every(x => x.ok) && (await C({ action: 'paydetail', id: P5.id, ...A })).payments.length === n0 + 3, 'two tabs writing one ticket at once → no lost update (lease)', ys.map(x => x.error || 'ok')); }
  // a ticket document never grows past 256 KiB: the write is refused with too_large and the ticket stays readable
  { const big = await C({ action: 'create', ticket: base({ customer: { name: 'เอกสารใหญ่', tel: '0843333333' } }) }); let last = null, k = 0;
    for (; k < 400; k++) { last = await call({ action: 'payrecord', id: big.id, method: 'other', amount: '1', note: 'บันทึกยาว'.repeat(44), reference: 'R'.repeat(120), ...T }); if (!last.ok) break; }
    const bytes = Buffer.byteLength(JSON.stringify(fake.raw('tickets/' + big.id)));
    ok(last && last.error === 'too_large' && bytes <= 256 * 1024 && fake.st.maxBytes <= 256 * 1024, 'payment rows stop at the 256 KiB document limit → too_large', { k, bytes, error: last && last.error });
    ok((await C({ action: 'paydetail', id: big.id, ...A })).ok, 'the full ticket is still readable'); }
  // replies are copies: changing one never changes the store
  { const L1 = await C({ action: 'list', ...A }); L1.tickets[0].status = 'done'; L1.statuses.new = 'x';
    const L2 = await C({ action: 'list', ...A }); ok(L2.tickets[0].status !== 'done' && L2.statuses.new === 'รับคำขอแล้ว รอยืนยัน', 'replies are plain copies'); }
  // snapshots from the fake are frozen and onSnapshot works (sanity of the fake itself)
  { const s = await fake.db.doc('tickets/' + r1.id).get(); let threw = false; try { s.data().status = 'x'; } catch (e) { threw = true; }
    let seen = null; const un = fake.db.collection('tickets').where('kind', '==', 'booking').limit(3).onSnapshot(q => { seen = q; }); await sleep(20); un();
    let te = null; try { fake.db.doc('tickets'); } catch (e) { te = e; }
    ok(threw && seen && seen.size === 3 && te instanceof TypeError && /even/.test(te.message), 'fake db: frozen snapshots, onSnapshot, path parity TypeError'); }

  /* ======== J · global text rules over every adapter reply ======== */
  const all = JSON.stringify(replies, (k, v) => (k === 'qr' ? undefined : v));   // the QR image is base64
  ok(!BANNED.some(w => all.includes(w)), 'no banned phrase (§6.6 #11) in any reply', BANNED.filter(w => all.includes(w)));
  ok(!SENT.test(all), 'no reply claims a message was sent (§6.6 #23)', (all.match(SENT) || [])[0]);
  ok(!/"sp":|"pj":|ต้นทุน/.test(all), 'no special / project rate or cost in any reply');

  /* ======== K · the same sequence against the real server (in-process) ======== */
  const { loadConfig } = await import('../server/config.mjs'), { createApp } = await import('../server/app.mjs'), { addStaff } = Sf;
  TMP = mkdtempSync(join(tmpdir(), 'sbp-artifact-api-'));
  const SRV_PW = 'ทดสอบ12345';   // the server requires ≥ 10 characters; the artifact's test password is ทดสอบ1234
  const cfg = loadConfig({ DATA_DIR: TMP, MAIL_TRANSPORT: 'memory', DEV: '1', PROMPTPAY_ID: TEST_PAY.promptpayId, BANK_NAME: TEST_PAY.bank, BANK_ACCOUNT_NO: TEST_PAY.accountNo, PAYEE_NAME: TEST_PAY.payee });
  app = await createApp(cfg, { log: { error: (...a) => console.log('[server]', ...a), log() {}, warn() {} } });
  for (const [u, a] of Object.entries(TEST_ACCOUNTS)) addStaff(app.db, { username: u, name: a.name, role: a.role, password: SRV_PW });
  srv = createServer(app.handler); await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const url = `http://127.0.0.1:${srv.address().port}/exec`;
  const viaServer = body => fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(x => x.json());
  install(createFakeDb());
  const viaArtifact = body => handle(body).then(r => r, e => ({ ok: false, error: e && e.code }));
  async function scenario(api, pw) {
    const R = [], s = async (label, body) => { const x = await api(body); R.push([label, x]); return x; };
    const c1 = await s('create honest booking', { action: 'create', ticket: boardPay() });
    const c2 = await s('create tampered quote', { action: 'create', ticket: base({ customer: { name: 'ราคาถูกแก้', tel: '0831000002' }, units: { wall: 6 }, quote: quote([CL(6, 100)], { totalEx: 600, total: 600, vat: 0, travel: 0, minGap: 0 }) }) });
    const c3 = await s('create survey + tax invoice', { action: 'create', ticket: base({ customer: { name: 'ต่างจังหวัด', tel: '0831000003', taxInvoice: true, taxName: 'บริษัท นครปฐม จำกัด', taxId: '0735555555555' }, site: { area: 'นครปฐม' }, quote: quote([CL(1), { name: SV.name, key: 'S-' + SV.code, group: 'install', kind: 'survey', qty: 1, unitEx: 5000 }], { tax: 'invoice', zoneInput: 'นครปฐม' }) }) });
    const c4 = await s('create product quote', { action: 'create', ticket: base({ kind: 'quote', service: 'buy', prefDate: '', slot: '', customer: { name: 'ซื้อเครื่อง', tel: '0831000005' }, quote: quote([{ name: SKU.sku, key: 'P-' + SKU.sku, group: 'product', kind: 'product', qty: 1, unitEx: SKU.px }]) }) });
    await s('create feedback', { action: 'create', ticket: { kind: 'feedback', customer: {}, details: 'ใช้งานง่าย' } });
    await s('create rid', { action: 'create', ticket: base({ rid: 'cmp-rid-00000001', customer: { name: 'ส่งซ้ำ', tel: '0855555555' } }) });
    await s('create rid repeat', { action: 'create', ticket: base({ rid: 'cmp-rid-00000001', customer: { name: 'ส่งซ้ำ', tel: '0855555555' } }) });
    for (const [lb, t] of [['bad_tel', base({ customer: { name: 'x', tel: '1' } })], ['no_consent', base({ consent: false })], ['bad_date', base({ prefDate: day(-1) })], ['bad_kind', base({ kind: 'spam' })], ['honeypot', base({ website: 'x' })], ['bad_email', base({ customer: { name: 'ก', tel: TEL, email: 'x' } })]]) await s('create ' + lb, { action: 'create', ticket: t });
    await s('unknown action', { action: 'nope' });
    await s('track', { action: 'track', id: c1.id, tel: '0812345679' });
    await s('track wrong phone', { action: 'track', id: c1.id, tel: '0899999999' });
    await s('slots', { action: 'slots', from: day(0), days: 7 });
    await s('login wrong password', { action: 'login', user: 'admin', password: 'wrong-password-0' });
    const la = await s('login admin', { action: 'login', user: 'admin', password: pw }), ls = await s('login staff', { action: 'login', user: 'staff', password: pw }), lt = await s('login tech', { action: 'login', user: 'tech', password: pw });
    const A = { token: la.token }, St = { token: ls.token }, T = { token: lt.token };
    await s('me', { action: 'me', ...A }); await s('list no token', { action: 'list' }); await s('list wrong token', { action: 'list', token: 'wrong' });
    await s('update bad_status', { action: 'update', id: c1.id, patch: { status: 'bogus' }, ...A }); await s('update bad_team', { action: 'update', id: c1.id, patch: { team: 'ทีม 9' }, ...A });
    await s('update not_found', { action: 'update', id: 'SBP-000000-999', patch: { status: 'done' }, ...A });
    await s('update apply', { action: 'update', id: c3.id, staff: 'ชื่อที่พิมพ์เอง', patch: { status: 'confirmed', team: 'ทีม 1', schedDate: day(3), schedSlot: 'PM', staffNote: 'โน้ต' }, ...St });
    await s('track after update', { action: 'track', id: c3.id, tel: '0831000003' });
    await s('paydetail honest', { action: 'paydetail', id: c1.id, ...A }); await s('paydetail survey', { action: 'paydetail', id: c3.id, ...A }); await s('paydetail unknown', { action: 'paydetail', id: 'SBP-000000-999', ...A });
    await s('payreq tech', { action: 'payreq', id: c1.id, kind: 'full', ...T }); await s('payreq bad_kind', { action: 'payreq', id: c1.id, kind: 'x', ...A }); await s('payreq bad_amount', { action: 'payreq', id: c1.id, kind: 'full', amount: '0.50', ...A });
    await s('payreq amount_required survey', { action: 'payreq', id: c3.id, kind: 'full', ...A }); await s('payreq amount_required product', { action: 'payreq', id: c4.id, kind: 'full', ...A });
    const pr = await s('payreq suggested', { action: 'payreq', id: c1.id, kind: 'full', ...A }), rq = pr.requests[0];
    await s('track with payment', { action: 'track', id: c1.id, tel: '0812345679' });
    for (const m of ['promptpay', 'transfer', 'onsite', 'gateway', 'cash']) await s('pay ' + m, { action: 'pay', id: c1.id, tel: '0812345679', req: rq.id, method: m });
    await s('pay unknown req', { action: 'pay', id: c1.id, tel: '0812345679', req: 'PR-NOPE', method: 'promptpay' });
    await s('paid', { action: 'paid', id: c1.id, tel: '0812345679', req: rq.id, method: 'promptpay', reference: 'TX-1' });
    await s('paid repeat', { action: 'paid', id: c1.id, tel: '0812345679', req: rq.id, method: 'promptpay', reference: 'TX-1' });
    const pd = await s('paydetail submitted', { action: 'paydetail', id: c1.id, ...A }), pid = pd.payments[0].id;
    await s('payverify tech', { action: 'payverify', payment: pid, decision: 'verify', ...T }); await s('payverify bad decision', { action: 'payverify', payment: pid, decision: 'maybe', ...A });
    await s('payverify verify', { action: 'payverify', payment: pid, decision: 'verify', ...A }); await s('payverify twice', { action: 'payverify', payment: pid, decision: 'verify', ...A });
    await s('track paid', { action: 'track', id: c1.id, tel: '0812345679' }); await s('payvoid paid', { action: 'payvoid', req: rq.id, reason: 'x', ...A });
    const pr3 = await s('payreq typed', { action: 'payreq', id: c3.id, kind: 'deposit', amount: '1500.50', ...St }), rq3 = pr3.requests[0];
    await s('pay typed promptpay', { action: 'pay', id: c3.id, tel: '0831000003', req: rq3.id, method: 'promptpay' });
    const rc = await s('payrecord tech', { action: 'payrecord', id: c3.id, req: rq3.id, method: 'cash', amount: '500', note: 'หน้างาน', ...T });
    await s('payrecord bad method', { action: 'payrecord', id: c3.id, method: 'gateway', amount: '5', ...A });
    await s('payverify staff', { action: 'payverify', payment: rc.payments[0].id, decision: 'verify', ...St });
    await s('payvoid has_payments', { action: 'payvoid', req: rq3.id, reason: 'x', ...A });
    await s('refund staff', { action: 'refund', id: c3.id, amount: '100', method: 'transfer', reason: 'x', ...St }); await s('refund too large', { action: 'refund', id: c3.id, amount: '500.01', method: 'transfer', reason: 'x', ...A });
    await s('refund no reason', { action: 'refund', id: c3.id, amount: '100', method: 'transfer', reason: ' ', ...A }); await s('refund ok', { action: 'refund', id: c3.id, amount: '200.25', method: 'transfer', reason: 'คืนส่วนต่าง', ...A });
    const pv = await s('payreq to void', { action: 'payreq', id: c2.id, kind: 'extra', amount: '300', ...A });
    await s('payvoid tech', { action: 'payvoid', req: pv.requests[0].id, reason: 'x', ...T }); await s('payvoid unknown', { action: 'payvoid', req: 'PR-NOPE', reason: 'x', ...A });
    await s('payvoid ok', { action: 'payvoid', req: pv.requests[0].id, reason: 'ลูกค้าเปลี่ยนวิธีชำระ', ...A }); await s('payvoid twice', { action: 'payvoid', req: pv.requests[0].id, reason: 'x', ...A });
    await s('track void', { action: 'track', id: c2.id, tel: '0831000002' });
    await s('update cancel', { action: 'update', id: c2.id, patch: { status: 'cancelled' }, ...A }); await s('payreq cancelled', { action: 'payreq', id: c2.id, kind: 'full', amount: '100', ...A });
    await s('payrecord admin', { action: 'payrecord', id: c4.id, method: 'transfer', amount: '99.99', reference: 'TX-99', ...A });
    await s('list', { action: 'list', ...A }); await s('slots after', { action: 'slots', from: day(0), days: 7 });
    await s('logout', { action: 'logout', ...St }); await s('me after logout', { action: 'me', ...St });
    return R;
  }
  const RS = await scenario(viaServer, SRV_PW), RA = await scenario(viaArtifact, PW);
  ok(RS.length === RA.length && RS.every(([l], i) => RA[i][0] === l), 'both runs made the same calls', [RS.length, RA.length]);
  const kind = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const VOLATILE = new Set(['token', 'ref', 'createdAt', 'updatedAt', 'verifiedAt', 'completedAt', 'closedAt', 'consentAt', 'history']);
  const INTENDED = /\.test$/;   // test:true on every money reply of the artifact (TEST site)
  const shapeDiffs = [], valueDiffs = [];
  function compare(a, b, path) {
    const ka = kind(a), kb = kind(b);
    if (ka !== kb) { shapeDiffs.push(`${path}: server ${ka} · artifact ${kb}`); return; }
    if (ka === 'array') { if (a.length !== b.length) shapeDiffs.push(`${path}: length server ${a.length} · artifact ${b.length}`); for (let i = 0; i < Math.min(a.length, b.length); i++) compare(a[i], b[i], `${path}[${i}]`); return; }
    if (ka === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const p = `${path}.${k}`;
        if (!(k in b)) shapeDiffs.push(`${p}: only on the server`);
        else if (!(k in a)) { if (!INTENDED.test(p)) shapeDiffs.push(`${p}: only in the artifact`); }
        else compare(a[k], b[k], p);
      }
      return;
    }
    const key = path.split('.').pop().replace(/\[\d+\]$/, '');
    if (VOLATILE.has(key) || (typeof a === 'string' && /^(PR|PM|RF)-[A-Z0-9x]{8}$/i.test(a))) return;
    if (a !== b) valueDiffs.push(`${path}: server ${JSON.stringify(a).slice(0, 80)} · artifact ${JSON.stringify(b).slice(0, 80)}`);
  }
  RS.forEach(([label, a], i) => compare(a, RA[i][1], label));
  ok(RS.filter(([, x]) => x.ok).length >= 40 && RS.filter(([, x]) => !x.ok).length >= 25, 'the scenario exercised both successes and errors on the server', [RS.filter(([, x]) => x.ok).length, RS.filter(([, x]) => !x.ok).length]);
  ok(!shapeDiffs.length, `reply shapes (keys + types) identical to the server over ${RS.length} calls`, shapeDiffs.slice(0, 20));
  ok(!valueDiffs.length, 'reply values identical to the server (ids / times / tokens / refs aside)', valueDiffs.slice(0, 20));
  if (shapeDiffs.length || valueDiffs.length || VERBOSE) { console.log('shape differences:', shapeDiffs.length); shapeDiffs.forEach(d => console.log('  ', d)); console.log('value differences:', valueDiffs.length); valueDiffs.slice(0, 60).forEach(d => console.log('  ', d)); }
} catch (e) { fails++; console.log('✗ crashed:', e && e.stack || e); }
finally {
  if (srv) await new Promise(res => srv.close(res));
  if (app) app.close();
  if (TMP) try { rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
}
console.log(JSON.stringify({ checks: n, fails, seconds: Math.round((Date.now() - t0) / 1000) }));
process.exit(fails ? 1 : 0);
