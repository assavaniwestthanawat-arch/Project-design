// Rev.09 r10 — back office ticket API (backoffice/apps-script/Code.gs) run unchanged in the Apps Script emulator.
// usage: node tests/backoffice.mjs   (no browser, no network)
import { createGas } from '../tools/gas-emu.mjs';

let fails = 0, n = 0;
const ok = (cond, msg, extra) => { n++; if (!cond) { fails++; console.log('✗', msg, extra !== undefined ? JSON.stringify(extra) : ''); } };
const day = d => { const x = new Date(Date.now() + 7 * 3600e3 + d * 864e5); return x.toISOString().slice(0, 10); };   // Bangkok calendar day
const base = (o = {}) => ({ kind: 'booking', service: 'clean', units: { wall: 3, cassette: 1 }, teamDays: 0.3, prefDate: day(2), slot: 'AM', consent: true,
  customer: { name: 'คุณทดสอบ ระบบ', tel: '081-234-5678', email: 'test@example.com' }, site: { address: '12/3 ถ.พระราม 2', area: 'บางขุนเทียน กรุงเทพมหานคร', zoneTier: 'core' },
  source: 'test', ...o });

const g = createGas({ props: { STAFF_TOKEN: 'secret-token', NOTIFY_EMAIL: 'team@example.com' } });
// health
ok(g.get().ok === true, 'GET health');
// create
const r1 = g.post({ action: 'create', ticket: base() });
ok(r1.ok && /^SBP-\d{6}-001$/.test(r1.id), 'create returns first id of the day', r1);
ok(r1.status === 'new' && r1.statusTh, 'create status new', r1);
const r2 = g.post({ action: 'create', ticket: base({ customer: { name: 'ลูกค้า 2', tel: '0899999999' }, slot: 'PM' }) });
ok(r2.ok && r2.id.endsWith('-002'), 'ids increase within the day', r2);
ok(g.outbox.length === 2 && /SBP-/.test(g.outbox[0].subject) && g.outbox[0].to === 'team@example.com', 'team is emailed per ticket', g.outbox.map(m => m.subject));
// the sheet: header + 2 rows, phone keeps its leading zero, no formula
const sh = g.sheet();
ok(sh[0][0] === 'id' && sh.length === 3, 'sheet has header + 2 rows', sh.length);
const H = sh[0], col = k => H.indexOf(k);
ok(sh[1][col('tel')] === '0812345678', 'phone stored as text with leading zero', sh[1][col('tel')]);
ok(sh[1][col('status')] === 'new' && sh[1][col('kind')] === 'booking' && sh[1][col('units')] === '{"wall":3,"cassette":1}', 'row fields', sh[1].slice(0, 8));
// validation
ok(g.post({ action: 'create', ticket: base({ customer: { name: 'x', tel: '12345' } }) }).error === 'bad_tel', 'bad phone rejected');
ok(g.post({ action: 'create', ticket: base({ customer: { name: '', tel: '0812345670' } }) }).error === 'bad_name', 'missing name rejected');
ok(g.post({ action: 'create', ticket: base({ consent: false, customer: { name: 'ก', tel: '0812345671' } }) }).error === 'no_consent', 'no consent rejected');
ok(g.post({ action: 'create', ticket: base({ prefDate: day(-1), customer: { name: 'ก', tel: '0812345672' } }) }).error === 'bad_date', 'past date rejected');
ok(g.post({ action: 'create', ticket: base({ kind: 'spam', customer: { name: 'ก', tel: '0812345673' } }) }).error === 'bad_kind', 'unknown kind rejected');
ok(g.post({ action: 'create', ticket: base({ website: 'http://spam', customer: { name: 'ก', tel: '0812345674' } }) }).error === 'rejected', 'honeypot rejected');
ok(g.post('{not json').error === 'bad_json', 'bad json');
ok(g.post({ action: 'nope' }).error === 'unknown_action', 'unknown action');
ok(g.post('x'.repeat(40000)).error === 'too_large', 'oversized body');
// formula injection: customer text never becomes a formula
const r3 = g.post({ action: 'create', ticket: base({ customer: { name: '=HYPERLINK("http://evil","x")', tel: '0861111111' }, notes: '+cmd|calc', details: '@SUM(A1)' }) });
ok(r3.ok, 'formula-like text accepted as text', r3);
ok(g.formulas().length === 0, 'no formula cells in the sheet', g.formulas());
const row3 = g.sheet().find(r => r[0] === r3.id);
ok(row3[col('name')] === '=HYPERLINK("http://evil","x")' && row3[col('notes')] === '+cmd|calc', 'formula text kept literally', row3[col('name')]);
// quote lines + tax invoice
const r4 = g.post({ action: 'create', ticket: base({ kind: 'quote', prefDate: '', slot: '', customer: { name: 'บริษัท ทดสอบ จำกัด', tel: '021234567', taxInvoice: true, taxName: 'บริษัท ทดสอบ จำกัด (สำนักงานใหญ่)', taxId: '0105555555555' },
  quote: { totalEx: 12300, lines: [{ name: 'ล้างปกติ ติดผนัง 9,000-18,000 BTU', qty: 3, unitEx: 800 }, { name: 'รื้อแอร์ติดผนัง', qty: 1, unitEx: null }] } }) });
const row4 = g.sheet().find(r => r[0] === r4.id);
ok(r4.ok && row4[col('taxInvoice')] === 'ใช่' && row4[col('taxId')] === '0105555555555' && /ประเมินหน้างาน/.test(row4[col('quoteLines')]), 'quote + tax invoice stored', row4 && row4.slice(14, 25));
// rate limit: 5 per phone per hour
const tel = '0870000000'; let last;
for (let i = 0; i < 6; i++) last = g.post({ action: 'create', ticket: base({ customer: { name: 'ซ้ำ', tel } }) });
ok(last.error === 'rate_limited', 'sixth ticket from the same phone is rate limited', last);
// track
const t1 = g.post({ action: 'track', id: r1.id, tel: '0812345678' });
ok(t1.ok && t1.ticket.status === 'new' && t1.ticket.statusTh && !('staffNote' in t1.ticket) && !('name' in t1.ticket), 'track returns status only (no names/notes)', t1);
ok(g.post({ action: 'track', id: r1.id, tel: '0899999999' }).error === 'not_found', 'track with wrong phone = not found');
ok(g.post({ action: 'track', id: 'SBP-000000-999', tel: '0812345678' }).error === 'not_found', 'track unknown id');
ok(g.post({ action: 'track', id: r1.id, tel: '' }).error === 'not_found', 'track without phone');
// staff auth
ok(g.post({ action: 'list' }).error === 'unauthorized', 'list needs token');
ok(g.post({ action: 'list', token: 'wrong' }).error === 'unauthorized', 'list wrong token');
const L = g.post({ action: 'list', token: 'secret-token' });
ok(L.ok && L.tickets.length >= 4 && L.tickets[0].createdAt >= L.tickets[L.tickets.length - 1].createdAt && !('payload' in L.tickets[0]) && L.teams.length === 3, 'list newest first, no raw payload', L.tickets.length);
// update
ok(g.post({ action: 'update', token: 'secret-token', id: r1.id, patch: { status: 'bogus' } }).error === 'bad_status', 'bad status rejected');
ok(g.post({ action: 'update', token: 'secret-token', id: r1.id, patch: { team: 'ทีม 9' } }).error === 'bad_team', 'unknown team rejected');
const U = g.post({ action: 'update', token: 'secret-token', id: r1.id, staff: 'แอดมิน', patch: { status: 'confirmed', team: 'ทีม 1', schedDate: day(3), schedSlot: 'PM', staffNote: 'ลูกค้าขอให้โทรก่อน 30 นาที' } });
ok(U.ok && U.ticket.status === 'confirmed' && U.ticket.team === 'ทีม 1' && U.ticket.schedDate === day(3), 'update applies', U);
const hist = JSON.parse(U.ticket.history);
ok(hist.length === 2 && hist[1].by === 'แอดมิน' && hist[1].s === 'new→confirmed', 'history records who changed what', hist);
const t2 = g.post({ action: 'track', id: r1.id, tel: '0812345678' });
ok(t2.ticket.status === 'confirmed' && t2.ticket.schedDate === day(3) && t2.ticket.schedSlot === 'PM' && t2.ticket.team === 'จัดทีมแล้ว' && !JSON.stringify(t2).includes('โทรก่อน'), 'customer sees schedule, not the staff note', t2);
ok(g.post({ action: 'update', token: 'nope', id: r1.id, patch: { status: 'done' } }).error === 'unauthorized', 'update needs token');
// slots: counts bookings on the scheduled (else preferred) day, never names
const S = g.post({ action: 'slots', from: day(0), days: 7 });
const d3 = S.days.find(x => x.date === day(3)), d2 = S.days.find(x => x.date === day(2));
ok(S.ok && S.capacity === 2 && S.days.length === 7, 'slots shape', S);
ok(d3.PM === 1 && d2.PM >= 1 && d2.AM >= 2, 'slot counts follow schedule / preference', { d2, d3 });
ok(!JSON.stringify(S).includes('ทดสอบ'), 'slots carry no customer data');
g.post({ action: 'update', token: 'secret-token', id: r2.id, patch: { status: 'cancelled' } });
const S2 = g.post({ action: 'slots', from: day(0), days: 7 });
ok(S2.days.find(x => x.date === day(2)).PM === d2.PM - 1, 'cancelled bookings free the slot');
// anonymous website feedback is accepted (no phone), a wrong phone is still rejected
const fb = g.post({ action: 'create', ticket: { kind: 'feedback', customer: {}, details: 'ใช้งานง่าย 5', source: 'test' } });
ok(fb.ok && g.sheet().find(r => r[0] === fb.id)[col('name')] === 'ไม่ระบุชื่อ', 'anonymous feedback stored', fb);
ok(g.post({ action: 'create', ticket: { kind: 'feedback', customer: { tel: '123' } } }).error === 'bad_tel', 'feedback with a bad phone rejected');
ok(g.post({ action: 'create', ticket: { kind: 'inquiry', consent: true, customer: { name: 'ไม่มีเบอร์' } } }).error === 'bad_tel', 'inquiry still needs a phone');
// staff disabled without a token property
const g2 = createGas({ props: {} });
ok(g2.post({ action: 'list', token: 'x' }).error === 'staff_disabled', 'no STAFF_TOKEN = staff API off');
ok(g2.post({ action: 'create', ticket: base() }).ok && g2.outbox.length === 0, 'no NOTIFY_EMAIL = no mail, still stored');

console.log(JSON.stringify({ checks: n, fails }));
process.exit(fails ? 1 : 0);
