// Rev.10 — staff board (backoffice.html) against the production server (server/): staff accounts, the server's price
// check, payment requests, payments received / verified / rejected, refunds, roles (admin vs tech), legacy STAFF_TOKEN.
// Starts its own server on a free port with a temp DATA_DIR (memory mail). usage: node tests/board-pay.mjs [width=1366] [theme=light]
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from './_lib.mjs';

const [,, W = 1366, theme = 'light'] = process.argv;
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = await new Promise(res => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const BASE = `http://127.0.0.1:${PORT}`, TOKEN = 'board-pay-legacy-token-0123456789', PW = 'test-password-123';
const DATA = mkdtempSync(join(tmpdir(), 'sbp-boardpay-'));
const env = { ...process.env, NODE_ENV: '', DEV: '1', MAIL_TRANSPORT: 'memory', DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', STAFF_TOKEN: TOKEN,
  PROMPTPAY_ID: '0105555555555', BANK_NAME: 'ธนาคารทดสอบ', BANK_ACCOUNT_NO: '123-4-56789-0', NOTIFY_EMAIL: 'team@example.com' };
const NODE = [process.execPath, '--disable-warning=ExperimentalWarning'];
for (const [u, n, r] of [['admin', 'แอดมินทดสอบ', 'admin'], ['tech1', 'ช่างทดสอบ', 'tech']])
  execFileSync(NODE[0], [NODE[1], 'server/cli.mjs', 'staff', 'add', u, n, r], { cwd: ROOT, env: { ...env, STAFF_PASSWORD: PW }, stdio: 'pipe' });
const srv = spawn(NODE[0], [NODE[1], 'server/index.mjs'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { srv.stdout.on('data', d => { if (/SBP AirCare .* http:\/\//.test(d)) res(); }); srv.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server start timeout')), 20000); });
const api = body => fetch(`${BASE}/exec`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(r => r.json());

let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x) : ''); } else console.log('✓', m); };
const day = d => new Date(Date.now() + 7 * 3600e3 + d * 864e5).toISOString().slice(0, 10);   // Bangkok calendar day
const TEL = '0812345678';
const booking = (o = {}) => ({ kind: 'booking', service: 'clean', units: { wall: 2 }, prefDate: day(3), slot: 'AM', consent: true, source: 'board-pay test',
  customer: { name: 'คุณทดสอบ ชำระเงิน', tel: TEL }, site: { address: '12/3 ถ.พระราม 2', area: 'บางขุนเทียน' },
  quote: { totalEx: 4500, tax: 'none', vat: 0, total: 4500, travel: 0, minGap: 3100, zoneInput: 'บางขุนเทียน',
    lines: [{ name: 'ล้าง Basic ติดผนัง 9,000–12,000 BTU', qty: 2, unitEx: 700, key: 'CL-Basic Clean-C1-wall-0', group: 'clean', kind: 'service' }] }, ...o });

const b = await launch();
const errs = [];
const ctxPage = async (w = +W, scheme = theme) => {
  const c = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('dialog', d => { errs.push('unexpected dialog: ' + d.message()); d.dismiss(); });   // the board confirms in the page (no window.confirm)
  await p.goto(`${BASE}/backoffice.html`); await p.waitForSelector('#bo-nm', { timeout: 30000 });
  return p;
};
const signIn = async (p, user, pw) => { await p.fill('#bo-nm', user); await p.fill('#bo-tok', pw); await p.click('.bo-login button[type=submit]'); };
const openTicket = async (p, id) => {
  await p.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  await p.click(`.bo-t tbody tr:has(th:text-is("${id}"))`);
  await p.waitForSelector('.bo-pay .bo-money, .bo-pay .bo-pg', { timeout: 15000 });
};
const text = (p, sel) => p.$eval(sel, e => e.textContent).catch(() => '');
const toast = (p, re) => p.waitForFunction(r => new RegExp(r).test(document.querySelector('.bo-toast')?.textContent || ''), re.source, { timeout: 15000 });
const yes = async (p, scope = '.bo-pay') => { await p.waitForSelector(`${scope} .bo-sure`, { timeout: 5000 }); await p.click(`${scope} .bo-sure button:has-text("ยืนยัน")`); };   // in-page confirmation step
const unfold = async (p, key) => { const s = p.locator('.bo-pay details.bo-pf > summary', { hasText: key }).first(); await s.click(); };

try {
  // 0 · data: one fully payable booking (2 × 700 + cleaning minimum = 4,500 before VAT, no tax invoice) + one mismatched quote
  const c1 = await api({ action: 'create', ticket: booking() });
  const c2 = await api({ action: 'create', ticket: booking({ customer: { name: 'คุณราคาไม่ตรง', tel: '0898765432' }, quote: { ...booking().quote, totalEx: 4000, total: 4000, minGap: 3200, lines: [{ ...booking().quote.lines[0], unitEx: 400 }] } }) });
  ok(c1.ok && c2.ok, 'two bookings stored', [c1, c2]);
  const id = c1.id;

  // 1 · login: wrong password → Thai error, nothing stored
  const p = await ctxPage();
  ok(await p.$eval('label:has(#bo-nm)', e => /ชื่อผู้ใช้/.test(e.textContent)) && await p.$eval('label:has(#bo-tok)', e => /รหัสผ่าน/.test(e.textContent)), 'login fields are ชื่อผู้ใช้ + รหัสผ่าน');
  await signIn(p, 'admin', 'wrong-password-0');
  await p.waitForFunction(() => /ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/.test(document.querySelector('.bo-err')?.textContent || ''), null, { timeout: 15000 });
  ok(await p.evaluate(() => sessionStorage.getItem('sbp-staff-v1') === null), 'wrong password: Thai error, no session stored');
  // admin login → session {token, name, role} + who is logged in
  await signIn(p, 'admin', PW);
  await p.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  const sess = await p.evaluate(() => JSON.parse(sessionStorage.getItem('sbp-staff-v1')));
  ok(sess && sess.token && sess.token !== PW && sess.name === 'แอดมินทดสอบ' && sess.role === 'admin', 'admin login: session token stored with name + role', sess && { name: sess.name, role: sess.role });
  ok(/แอดมินทดสอบ/.test(await text(p, '.bo-who')) && /ผู้ดูแล/.test(await text(p, '.bo-who')), 'header shows who is logged in + role');
  ok(await p.$$eval('.bo-t thead th', x => x.some(e => e.textContent === 'ชำระเงิน')), 'table has a payment column');
  ok(await p.$$eval('.bo-tile span', x => x.some(e => e.textContent === 'รอตรวจยอด') && x.some(e => e.textContent === 'ยอดค้างชำระ')), 'KPI tiles: รอตรวจยอด + ยอดค้างชำระ');

  // 2 · price check + suggested amount
  await openTicket(p, c2.id);
  ok(/ราคาจากหน้าเว็บไม่ตรงกับราคาในระบบ/.test(await text(p, '.bo-pay .bo-pc')) && await p.$$eval('.bo-pay .bo-pc li', x => x.length) >= 1, 'mismatched quote: warning + issues listed');
  await openTicket(p, id);
  ok(/ราคาจากหน้าเว็บตรงกับราคาในระบบ/.test(await text(p, '.bo-pay .bo-pc')), 'matching quote: price check ok');
  const sug = await text(p, '.bo-pay .bo-sug');
  ok(/4,500/.test(sug) && /ก่อน VAT/.test(sug), 'suggested amount 4,500 (before VAT, no tax invoice)', sug);
  ok(!(await p.$('.bo-pay .bo-money')) && /ยังไม่มีรายการเรียกเก็บ/.test(await text(p, '.bo-pay')) && /ยังไม่มีการรับเงิน/.test(await text(p, '.bo-pay')), 'no money yet');
  ok(!/\b(null|undefined|NaN)\b/.test(await text(p, 'main')), 'no null / undefined / NaN rendered');

  // 3 · create a full payment request (amount prefilled from the server's suggestion)
  await unfold(p, 'สร้างรายการเรียกเก็บเงิน');
  ok(await p.inputValue('#bo-pr-amt') === '4500' && await p.inputValue('#bo-pr-kind') === 'full', 'request form prefilled: full, 4500');
  await p.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]');
  await toast(p, /สร้างรายการเรียกเก็บ ฿4,500/);
  ok(/รอชำระ/.test(await text(p, '.bo-pay .bo-ph')) && /฿4,500/.test(await text(p, '.bo-pay .bo-money')), 'request created: status รอชำระ, due ฿4,500');
  const d1 = await api({ action: 'paydetail', token: TOKEN, staff: 'test', id });
  const req = d1.requests[0];
  ok(d1.requests.length === 1 && req.kind === 'full' && req.amount === 4500 && req.basis === 'server_quote' && req.createdBy === 'แอดมินทดสอบ', 'server stored the request (basis server_quote, by the logged-in admin)', req);
  ok(/รอชำระ/.test(await text(p, `.bo-t tbody tr:has(th:text-is("${id}")) .bo-pc-cell`)) && /ค้าง ฿4,500/.test(await text(p, `.bo-t tbody tr:has(th:text-is("${id}")) .bo-pc-cell`)), 'table row shows payment status + due');
  ok(await p.$$eval('.bo-tile', x => x.some(e => /ยอดค้างชำระ/.test(e.textContent) && /฿4,500/.test(e.textContent))), 'KPI ยอดค้างชำระ = ฿4,500');

  // 4 · the customer reports a transfer → SUBMITTED (waits for the office)
  const rep = await api({ action: 'paid', id, tel: TEL, req: req.id, method: 'transfer', reference: 'SLIP-1234' });
  ok(rep.ok && rep.payment.pending === true, 'customer report stored as pending', rep);

  // 5 · technician (second context, dark theme, phone width): sees the report, cannot verify, cannot create requests
  const t = await ctxPage(390, 'dark');
  await signIn(t, 'tech1', PW);
  await t.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  ok(/ช่างทดสอบ/.test(await text(t, '.bo-who')) && /ช่าง/.test(await text(t, '.bo-who .bo-me small')), 'tech login: name + role shown');
  ok(await t.$$eval('.bo-tile', x => x.some(e => /รอตรวจยอด/.test(e.textContent) && e.querySelector('b').textContent === '1')), 'KPI รอตรวจยอด = 1');
  await openTicket(t, id);
  await t.waitForSelector('.bo-pay [data-pay]');
  ok(/รอตรวจยอด/.test(await text(t, '.bo-pay [data-pay]')) && /รอสำนักงานตรวจยอด/.test(await text(t, '.bo-pay [data-pay]')), 'tech sees the submitted payment waiting for the office');
  ok(await t.locator('.bo-pay button', { hasText: 'ยืนยันได้รับเงิน' }).count() === 0 && await t.locator('.bo-pay button', { hasText: 'ไม่พบยอด' }).count() === 0, 'tech: no verify / reject buttons');
  ok(!(await t.$('.bo-pay .bo-sug')), 'tech: no suggested amount (cannot ask for money)');
  ok(await t.locator('.bo-pay summary', { hasText: 'สร้างรายการเรียกเก็บเงิน' }).count() === 0 && await t.locator('.bo-pay summary', { hasText: 'ยกเลิกรายการนี้' }).count() === 0, 'tech: no request / void forms');
  await unfold(t, 'บันทึกเงินที่รับหน้างาน');
  ok(/รอสำนักงานตรวจยอด/.test(await text(t, '.bo-pay form:has(#bo-pm-amt)')), 'tech record form explains it waits for office verification');
  ok(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'phone width: no horizontal page scroll');
  ok(await t.$$eval('.bo-pay button, .bo-pay input, .bo-pay select, .bo-pay summary', x => x.filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= 36)), 'payment controls are full-size targets');

  // 6 · admin: reload → verify / reject buttons; reject the report (confirm)
  await p.click('.bo-who button:has-text("รีเฟรช")'); await toast(p, /อัปเดตแล้ว/);
  await p.waitForSelector('.bo-pay [data-pay] button');
  ok(await p.locator('.bo-pay [data-pay] button', { hasText: 'ยืนยันได้รับเงิน' }).count() === 1, 'admin sees verify for the submitted payment');
  await p.click('.bo-pay [data-pay] button:has-text("ไม่พบยอด")'); await yes(p);
  await toast(p, /ไม่พบยอด/);
  ok(/ไม่พบยอด/.test(await text(p, '.bo-pay [data-pay] .bo-ps')), 'rejected: shown as ไม่พบยอด');

  // 7 · void flow on a second request (reason + confirm)
  ok(await p.$('.bo-pay .bo-sug') === null, 'whole quote already requested: no further suggestion');
  await unfold(p, 'สร้างรายการเรียกเก็บเงิน');
  ok(await p.inputValue('#bo-pr-amt') === '' && await p.$eval('#bo-pr-amt', e => e.required), 'no suggestion: amount empty and required');
  await p.selectOption('#bo-pr-kind', 'extra');
  await p.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]');
  ok(/กรุณาใส่จำนวนเงิน/.test(await text(p, '.bo-pay form:has(#bo-pr-amt) .bo-err')) && await p.$eval('#bo-pr-amt', e => e.getAttribute('aria-invalid') === 'true'), 'empty amount: Thai error next to the form, nothing sent');
  await p.fill('#bo-pr-amt', '300'); await p.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]');
  await toast(p, /สร้างรายการเรียกเก็บ ฿300/);
  const d2 = await api({ action: 'paydetail', token: TOKEN, id });
  ok(d2.requests.length === 2, 'second request stored', d2.requests.map(r => r.amount));
  await p.locator('.bo-pay .bo-rows li', { hasText: d2.requests[1].ref }).locator('summary', { hasText: 'ยกเลิกรายการนี้' }).click();
  const vf = p.locator('.bo-pay .bo-rows li', { hasText: d2.requests[1].ref }).locator('form');
  await vf.locator('button[type=submit]').click();
  ok(/เหตุผล/.test(await vf.locator('.bo-err').textContent()), 'void without a reason: Thai error in role=alert');
  await vf.locator('input').fill('สร้างซ้ำโดยไม่ตั้งใจ'); await vf.locator('button[type=submit]').click(); await yes(p);
  await toast(p, /ยกเลิกรายการ .* แล้ว/);
  const d3 = await api({ action: 'paydetail', token: TOKEN, id });
  ok(d3.requests[1].status === 'void' && /สร้างซ้ำ/.test(d3.requests[1].note), 'request voided with the reason', d3.requests[1]);

  // 8 · admin records the cash received → receipt number + paid
  await unfold(p, 'บันทึกรับเงิน');
  ok(await p.inputValue('#bo-pm-method') === 'cash' && await p.inputValue('#bo-pm-req') === req.id && await p.inputValue('#bo-pm-amt') === '4500', 'record form: cash, linked to the open request, remaining 4500');
  await p.fill('#bo-pm-ref', 'เงินสดหน้างาน'); await p.click('.bo-pay form:has(#bo-pm-amt) button[type=submit]');
  await toast(p, /ใบเสร็จ RC\d{4}-\d{4}/);
  const rc = await p.$$eval('.bo-pay .bo-rc', x => x.map(e => e.textContent));
  ok(rc.length === 1 && /^RC\d{4}-\d{4}$/.test(rc[0]), 'receipt number shown', rc);
  ok(/ชำระครบแล้ว/.test(await text(p, '.bo-pay .bo-ph')) && /ชำระครบแล้ว/.test(await text(p, `.bo-t tbody tr:has(th:text-is("${id}")) .bo-pc-cell`)), 'status paid in the detail and the table');
  const d4 = await api({ action: 'paydetail', token: TOKEN, id });
  const cash = d4.payments.find(x => x.method === 'cash');
  ok(d4.summary.status === 'paid' && d4.summary.due === 0 && d4.summary.paid === 4500 && cash.status === 'verified' && cash.receiptNo === rc[0] && cash.byWho === 'แอดมินทดสอบ', 'server: paid 4,500, receipt matches, recorded by admin', d4.summary);
  ok(await p.$$eval('.bo-tile', x => x.some(e => /ยอดค้างชำระ/.test(e.textContent) && /฿0/.test(e.textContent))), 'KPI ยอดค้างชำระ back to ฿0');

  // 9 · refund (admin only): amount over the net received is refused in the form; a valid one is recorded
  await unfold(p, 'บันทึกการคืนเงิน');
  await p.fill('#bo-rf-amt', '5000'); await p.fill('#bo-rf-why', 'ทดสอบ'); await p.click('.bo-pay form:has(#bo-rf-amt) button[type=submit]');
  ok(/คืนเงินได้ไม่เกิน/.test(await text(p, '.bo-pay form:has(#bo-rf-amt) .bo-err')), 'refund above the net received: Thai error');
  await p.fill('#bo-rf-amt', '500'); await p.fill('#bo-rf-why', 'ลดราคาให้ลูกค้า 1 เครื่อง'); await p.click('.bo-pay form:has(#bo-rf-amt) button[type=submit]'); await yes(p);
  await toast(p, /บันทึกการคืนเงิน ฿500 แล้ว/);
  ok(/คืนเงินบางส่วน/.test(await text(p, '.bo-pay .bo-ph')) && /฿500/.test(await text(p, '.bo-pay .bo-money')), 'refund recorded: คืนเงินบางส่วน');

  // 10 · tech records money on site → submitted (no receipt) → admin verifies it
  await t.click('.bo-who button:has-text("รีเฟรช")'); await toast(t, /อัปเดตแล้ว/);
  await openTicket(t, c2.id);
  await unfold(t, 'บันทึกเงินที่รับหน้างาน');
  await t.fill('#bo-pm-amt', '1000'); await t.click('.bo-pay form:has(#bo-pm-amt) button[type=submit]');
  await toast(t, /รอสำนักงานตรวจยอด/);
  const d5 = await api({ action: 'paydetail', token: TOKEN, id: c2.id });
  ok(d5.payments.length === 1 && d5.payments[0].status === 'submitted' && !d5.payments[0].receiptNo && d5.payments[0].byWho === 'ช่างทดสอบ', 'tech entry stored as submitted, no receipt', d5.payments[0]);
  await p.click('.bo-who button:has-text("รีเฟรช")'); await toast(p, /อัปเดตแล้ว/);
  await openTicket(p, c2.id);
  await p.fill('#bo-note', 'โน้ตที่ยังไม่บันทึก');   // unsaved typing in the status form must survive a payment action
  await p.click('.bo-pay [data-pay] button:has-text("ยืนยันได้รับเงิน")'); await yes(p);
  await toast(p, /ยืนยันได้รับเงิน ฿1,000 แล้ว · ใบเสร็จ RC/);
  ok((await api({ action: 'paydetail', token: TOKEN, id: c2.id })).payments[0].status === 'verified', 'admin verified the tech entry');
  ok(await p.inputValue('#bo-note') === 'โน้ตที่ยังไม่บันทึก' && /ได้รับเงินแล้ว/.test(await text(p, '.bo-pay [data-pay] .bo-ps')), 'unsaved note kept while the payment block updates');

  // 11 · logout ends the server session
  const tk = (await p.evaluate(() => JSON.parse(sessionStorage.getItem('sbp-staff-v1')))).token;
  await p.click('.bo-who button:has-text("ออกจากระบบ")');
  await p.waitForSelector('#bo-nm');
  ok(await p.evaluate(() => sessionStorage.getItem('sbp-staff-v1') === null), 'logout clears the session');
  ok((await api({ action: 'list', token: tk })).error === 'unauthorized', 'logout ended the server session');

  // 12 · legacy STAFF_TOKEN typed as the password still works (role admin, typed name in the history)
  await signIn(p, 'ผู้ใช้รหัสเดิม', TOKEN);
  await p.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  const ls = await p.evaluate(() => JSON.parse(sessionStorage.getItem('sbp-staff-v1')));
  ok(ls.token === TOKEN && ls.name === 'ผู้ใช้รหัสเดิม' && ls.role === 'admin' && /ผู้ใช้รหัสเดิม/.test(await text(p, '.bo-who')), 'legacy STAFF_TOKEN login on the new server', { name: ls.name, role: ls.role });
  await openTicket(p, id);
  ok(/คืนเงินบางส่วน/.test(await text(p, '.bo-pay .bo-ph')), 'legacy session sees payments');

  ok(!/\b(null|undefined|NaN)\b/.test(await text(p, 'main')) && !/\b(null|undefined|NaN)\b/.test(await text(t, 'main')), 'no null / undefined / NaN rendered after all actions');
  // 13 · no browser errors anywhere
  ok(errs.length === 0, 'no console / page errors', errs.slice(0, 5));
} catch (e) { fails++; console.log('✗ crashed:', e.message); }
await b.close(); srv.kill();
try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
console.log(JSON.stringify({ width: +W, theme, checks: n, fails }));
process.exit(fails ? 1 : 0);
