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
  await p.click(`.bo-t tbody tr[data-id="${id}"]`);
  await p.waitForSelector('.bo-pay .bo-money, .bo-pay .bo-pg', { timeout: 15000 });
};
const text = (p, sel) => p.$eval(sel, e => e.textContent).catch(() => '');
const toast = (p, re) => p.waitForFunction(r => new RegExp(r).test(document.querySelector('.bo-toast')?.textContent || ''), re.source, { timeout: 15000 });
const yes = async (p, scope = '.bo-pay') => { await p.waitForSelector(`${scope} .bo-sure`, { timeout: 5000 }); await p.click(`${scope} .bo-sure .bo-yes`); };   // in-page confirmation step (its button repeats the action)
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
  ok(await p.evaluate(() => document.activeElement.id === 'bo-tok' && ['bo-nm', 'bo-tok'].every(i => document.getElementById(i).getAttribute('aria-invalid') === 'true' && document.getElementById(i).getAttribute('aria-describedby') === 'bo-lerr')), 'wrong password: fields marked invalid, tied to the message, cursor back in the password');
  ok(!/รหัสเจ้าหน้าที่ร่วมกัน/.test(await text(p, '.bo-login')), 'no legacy shared-code note on the production server');
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
  ok(/รอชำระ/.test(await text(p, `.bo-t tbody tr[data-id="${id}"] .bo-pc-cell`)) && /ค้าง ฿4,500/.test(await text(p, `.bo-t tbody tr[data-id="${id}"] .bo-pc-cell`)), 'table row shows payment status + due');
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
  await yes(p);   // admin / staff: a receipt is issued at once, so the page asks first
  await toast(p, /ใบเสร็จ RC\d{4}-\d{4}/);
  const rc = await p.$$eval('.bo-pay .bo-rc', x => x.map(e => e.textContent));
  ok(rc.length === 1 && /^RC\d{4}-\d{4}$/.test(rc[0]), 'receipt number shown', rc);
  ok(/ชำระครบแล้ว/.test(await text(p, '.bo-pay .bo-ph')) && /ชำระครบแล้ว/.test(await text(p, `.bo-t tbody tr[data-id="${id}"] .bo-pc-cell`)), 'status paid in the detail and the table');
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
  // 13 · Rev.10 UX (staff audit) — keyboard, the appointment, copy, amounts, confirmations, retry, cancel, search, dates, refresh
  const U1 = await api({ action: 'create', ticket: booking({ customer: { name: 'คุณนัดใหม่', tel: '0861234567' }, quote: undefined }) });
  const U2 = await api({ action: 'create', ticket: booking({ customer: { name: 'คุณมัดจำ ทดสอบ', tel: '0862345678' } }) });
  const u = await ctxPage(); await u.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await signIn(u, 'admin', PW); await u.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  ok(await u.evaluate(() => document.activeElement.tagName === 'H1'), 'after login focus is on the page heading (not lost to body)');
  const at1 = await text(u, `.bo-t tbody tr[data-id="${U1.id}"] .c-at`);
  ok(/\d{1,2}:\d{2}/.test(at1) && /\S+\. \d{1,2} \S+\./.test(at1) && !/^\d{2}-\d{2}/.test(at1), 'รับเมื่อ in one Thai date-time format', at1);
  // keyboard: the ticket number is a button; Enter opens the ticket and puts focus on its heading
  await u.focus(`.bo-open[data-fk="row:${U1.id}"]`); await u.keyboard.press('Enter'); await u.waitForSelector('#bo-sd');
  ok(await u.evaluate(id => document.activeElement.tagName === 'H2' && document.activeElement.textContent === id && document.querySelector(`.bo-open[data-fk="row:${id}"]`).getAttribute('aria-current') === 'true' && !document.querySelector('.bo-detail[aria-live]'), U1.id), 'Enter on a ticket number → focus on the ticket heading, aria-current on its row, no live region around the detail');
  ok(await u.inputValue('#bo-sd') === '' && await u.inputValue('#bo-sl') === '' && /ลูกค้าขอ/.test(await text(u, '.bo-pref')), "nothing scheduled: appointment fields empty, the customer's date shown as a hint");
  ok(await u.$eval('.bo-act button', e => e.disabled) && /ยืนยันวันนัดก่อน/.test(await text(u, '#bo-copy-why')), 'confirmation message unavailable before an appointment is confirmed (reason shown)');
  await u.fill('#bo-note', 'โทรหาลูกค้าแล้ว'); await u.click('.bo-edit button[type=submit]'); await toast(u, /บันทึก .* แล้ว/);
  const x1 = (await api({ action: 'list', token: TOKEN })).tickets.find(x => x.id === U1.id), h1 = JSON.parse(x1.history).pop();
  ok(x1.schedDate === '' && x1.schedSlot === '' && x1.status === 'new' && x1.staffNote === 'โทรหาลูกค้าแล้ว' && h1.note === 1 && !('date' in h1) && !('slot' in h1) && !('s' in h1), 'saving a note sends only the note: the preferred date never becomes an appointment', [x1.schedDate, h1]);
  ok(await u.evaluate(() => document.activeElement.tagName === 'H2'), 'after save focus returns to the ticket heading');
  ok(!/new→|→confirmed/.test(await text(u, '.bo-hist')) && /รับคำขอแล้ว รอยืนยัน/.test(await text(u, '.bo-hist')), 'history in Thai status names');
  await u.click('.bo-pref button'); await u.selectOption('#bo-st', 'confirmed');
  ok(await u.$eval('.bo-act button', e => e.disabled) && /บันทึกการแก้ไขก่อน/.test(await text(u, '#bo-copy-why')), 'unsaved edits: copy waits for the save');
  await u.click('.bo-edit button[type=submit]'); await toast(u, /บันทึก .* แล้ว/);
  const x2 = (await api({ action: 'list', token: TOKEN })).tickets.find(x => x.id === U1.id);
  ok(x2.schedDate === day(3) && x2.schedSlot === 'AM' && x2.status === 'confirmed', '"ใช้วันที่ลูกค้าขอ" + save → the appointment is set on purpose', [x2.schedDate, x2.schedSlot]);
  await u.click('.bo-act button:has-text("ข้อความยืนยันนัด")'); await toast(u, /คัดลอกข้อความยืนยันนัดแล้ว/);
  const msg = await u.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/^เรียนคุณนัดใหม่ /.test(msg) && /วัน.+ที่ \d+/.test(msg) && /ช่วงเช้า/.test(msg) && !/ทีม 1|ทีมผู้รับผิดชอบ/.test(msg), 'copied message: saved appointment, one คุณ, long weekday, no team name', msg);
  // request form: a deposit starts empty and is required; the typed amount is sent
  await openTicket(u, U2.id); await unfold(u, 'สร้างรายการเรียกเก็บเงิน');
  await u.selectOption('#bo-pr-kind', 'deposit');
  ok(await u.inputValue('#bo-pr-amt') === '' && await u.$eval('#bo-pr-amt', e => e.required) && /ยอดเต็มตามราคาในระบบ ฿4,500/.test(await text(u, '#bo-pr-hint')), 'มัดจำ: amount cleared, required, hint shows the full price');
  await u.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]');
  ok(/กรุณาใส่จำนวนเงินมัดจำ/.test(await text(u, '.bo-pay form:has(#bo-pr-amt) .bo-err')), 'empty deposit: Thai error, nothing sent');
  await u.fill('#bo-pr-amt', '1000'); await u.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]'); await toast(u, /สร้างรายการเรียกเก็บ ฿1,000/);
  const dq = (await api({ action: 'paydetail', token: TOKEN, id: U2.id })).requests;
  ok(dq.length === 1 && dq[0].kind === 'deposit' && dq[0].amount === 1000 && dq[0].basis === 'staff_confirmed', 'deposit request = the typed ฿1,000 (not the full price)', dq);
  // record: the confirmation names method, amount, request and what is left; more than is left = a red warning
  await unfold(u, 'บันทึกรับเงิน'); await u.fill('#bo-pm-amt', '5000');
  ok(/มากกว่ายอดคงเหลือ ฿4,000/.test(await text(u, '#bo-pm-over')), 'over the remaining amount: inline warning');
  await u.click('.bo-pay form:has(#bo-pm-amt) button[type=submit]'); await u.waitForSelector('.bo-pay .bo-sure');
  const rs = await u.evaluate(() => { const s = document.querySelector('.bo-pay .bo-sure'), q = document.getElementById(s.getAttribute('aria-labelledby')); return { q: q && q.textContent, danger: s.classList.contains('danger'), focus: document.activeElement.textContent, desc: !!q && s.querySelector('.bo-yes').getAttribute('aria-describedby') === q.id }; });
  ok(rs.danger && /฿5,000/.test(rs.q) && rs.q.includes(dq[0].ref) && /คงเหลือ ฿1,000/.test(rs.q) && /มากกว่ายอดคงเหลือ ฿4,000/.test(rs.q) && rs.focus === 'ไม่ใช่' && rs.desc, 'record confirmation: amount, request ref, remaining, over-warning; red; focus on ไม่ใช่; question labels it', rs);
  await u.keyboard.press('Escape');
  ok(await u.evaluate(() => !document.querySelector('.bo-sure') && document.activeElement.textContent === 'บันทึกรับเงิน'), 'Esc closes the confirmation and returns focus to its button');
  ok((await api({ action: 'paydetail', token: TOKEN, id: U2.id })).payments.length === 0, 'nothing recorded without the confirmation');
  // the reply to a payrecord is lost on the way back: the board says it is unsure, reloads, and a retry is not recorded twice
  // (the note shows at once; the reloaded list lands a moment later — wait for both, the check below used to race the reload under load)
  let dropped = 0;
  await u.route('**/exec', async route => { if (!dropped && /"payrecord"/.test(route.request().postData() || '')) { dropped++; await route.fetch(); return route.abort('failed'); } return route.continue(); });
  await u.fill('#bo-pm-amt', '1000'); await u.click('.bo-pay form:has(#bo-pm-amt) button[type=submit]'); await yes(u);
  await u.waitForFunction(() => { const f = document.querySelector('.bo-pay form:has(#bo-pm-amt)'); return /ไม่แน่ใจว่าบันทึกสำเร็จหรือไม่/.test(f?.querySelector('.bo-err')?.textContent || '') && !f.querySelector('button[type=submit]').disabled && document.querySelectorAll('.bo-pay [data-pay]').length === 1; }, null, { timeout: 15000 });   // message shown, list reloaded
  for (let i = errs.length - 1; i >= 0; i--) if (/net::ERR_FAILED/.test(errs[i])) errs.splice(i, 1);   // the browser logs the reply dropped on purpose above
  const pd1 = await api({ action: 'paydetail', token: TOKEN, id: U2.id });
  ok(dropped === 1 && pd1.payments.length === 1 && await u.$$eval('.bo-pay [data-pay]', x => x.length) === 1 && !(await u.$eval('.bo-pay form:has(#bo-pm-amt) button[type=submit]', e => e.disabled)), 'lost reply: inline "not sure" message, the list already shows the payment, button usable again', pd1.payments.length);
  await u.click('.bo-pay form:has(#bo-pm-amt) button[type=submit]'); await yes(u); await toast(u, /ไม่ได้บันทึกซ้ำ/);
  const pd2 = await api({ action: 'paydetail', token: TOKEN, id: U2.id });
  ok(pd2.payments.length === 1 && pd2.payments.filter(x => x.receiptNo).length === 1, 'retry with the same request id → the stored reply, still one payment and one receipt', pd2.payments.map(x => x.receiptNo));
  await u.unroute('**/exec');
  // cancel: a reason is required; the open request is voided with it; the cancelled ticket leaves ยอดค้างชำระ
  await unfold(u, 'สร้างรายการเรียกเก็บเงิน'); await u.selectOption('#bo-pr-kind', 'extra'); await u.fill('#bo-pr-amt', '700'); await u.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]'); await toast(u, /สร้างรายการเรียกเก็บ ฿700/);
  const dueBefore = await u.$eval('.bo-tile.money b', e => e.textContent);
  await u.selectOption('#bo-st', 'cancelled'); await u.click('.bo-edit button[type=submit]'); await u.waitForSelector('.bo-detail .bo-sure');
  ok(/฿700/.test(await text(u, '.bo-detail .bo-sure')) && await u.$eval('#bo-cx-void', e => e.checked) && await u.evaluate(() => document.activeElement.id === 'bo-cx-why'), 'cancel asks: open ฿700 named, void ticked, cursor in the reason');
  await u.click('.bo-detail .bo-sure .bo-yes');
  ok(/เหตุผล/.test(await text(u, '#bo-cx-err')) && (await api({ action: 'list', token: TOKEN })).tickets.find(x => x.id === U2.id).status !== 'cancelled', 'no reason → not cancelled');
  await u.fill('#bo-cx-why', 'ลูกค้ายกเลิกงาน'); await u.click('.bo-detail .bo-sure .bo-yes'); await toast(u, /ยกเลิกคำขอ .* แล้ว · ยกเลิกรายการเรียกเก็บ 1 รายการ/);
  const pd3 = await api({ action: 'paydetail', token: TOKEN, id: U2.id }), x3 = (await api({ action: 'list', token: TOKEN })).tickets.find(x => x.id === U2.id), ex = pd3.requests.find(r => r.kind === 'extra') || {};
  ok(x3.status === 'cancelled' && /ยกเลิก: ลูกค้ายกเลิกงาน/.test(x3.staffNote) && ex.status === 'void' && /ลูกค้ายกเลิกงาน/.test(ex.note), 'cancelled with the reason in the note; the open request voided with it', [x3.status, pd3.requests.map(r => r.status)]);
  const dueAfter = await u.$eval('.bo-tile.money b', e => e.textContent), num = v => +v.replace(/[^\d.]/g, '');
  ok(num(dueBefore) - num(dueAfter) === 700, 'ยอดค้างชำระ drops by the voided ฿700', [dueBefore, dueAfter]);
  // search: the phone as the table shows it, and a payment request code
  await u.selectOption('.bo-tools select[aria-label="สถานะ"]', 'all'); await u.fill('.bo-tools input[type=search]', '086-123-4567'); await u.waitForTimeout(450);
  ok(await u.$$eval('.bo-t tbody tr[data-id]', x => x.map(e => e.dataset.id).join()) === U1.id && await u.evaluate(() => document.activeElement.type === 'search'), 'search by the formatted phone finds the ticket (focus stays in the search box)');
  await u.fill('.bo-tools input[type=search]', dq[0].ref.toLowerCase()); await u.waitForTimeout(450);
  ok(await u.$$eval('.bo-t tbody tr[data-id]', x => x.map(e => e.dataset.id).join()) === U2.id, 'search by a payment request code finds the ticket');
  await u.fill('.bo-tools input[type=search]', 'ไม่มีชื่อนี้แน่ ๆ'); await u.waitForTimeout(450);
  ok(/ไม่มีคำขอตามตัวกรองนี้/.test(await text(u, '.bo-empty')) && !!(await u.$('.bo-empty button:has-text("ล้างตัวกรอง")')), 'filters hide everything → message + ล้างตัวกรอง');
  await u.click('.bo-empty button');
  ok(await u.inputValue('.bo-tools input[type=search]') === '' && await u.$$eval('.bo-t tbody tr[data-id]', x => x.length) > 0, 'ล้างตัวกรอง brings the list back');
  if (+W <= 700) ok(await u.$eval('.bo-scroll', e => e.scrollWidth <= e.clientWidth + 1), 'phone: ticket rows are cards (no sideways scroll in the list)');
  // the session ends under staff: what they typed in the open ticket comes back after the new login (nothing is sent by itself)
  await openTicket(u, U1.id); await u.fill('#bo-note', 'ร่างก่อนหมดเวลา'); await unfold(u, 'บันทึกรับเงิน'); await u.fill('#bo-pm-amt', '1234');
  await api({ action: 'logout', token: await u.evaluate(() => JSON.parse(sessionStorage.getItem('sbp-staff-v1')).token) });
  await u.click('.bo-who button:has-text("รีเฟรช")'); await u.waitForSelector('#bo-nm', { timeout: 15000 });
  ok(/หมดเวลาเข้าใช้งาน/.test(await text(u, '.bo-login .bo-err')), 'session ended: the login says why');
  await signIn(u, 'admin', PW); await u.waitForSelector('#bo-pm-amt', { timeout: 15000 });
  ok(await u.inputValue('#bo-note') === 'ร่างก่อนหมดเวลา' && await u.inputValue('#bo-pm-amt') === '1234' && await u.$$eval('.bo-detail .bo-restored', x => x.length) === 2 && (await api({ action: 'paydetail', token: TOKEN, id: U1.id })).payments.length === 0,
    'new login: the ticket reopens with the typed note and amount, each marked as restored; nothing was sent');
  // the 60 s refresh never redraws under keyboard focus; new data is offered instead; an idle board redraws
  const k = await b.newContext({ viewport: { width: +W, height: 900 }, colorScheme: theme }); const kp = await k.newPage();
  kp.on('pageerror', e => errs.push(e.message)); await kp.clock.install();
  await kp.goto(`${BASE}/backoffice.html`); await kp.waitForSelector('#bo-nm'); await signIn(kp, 'admin', PW); await kp.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  await kp.focus(`.bo-open[data-fk="row:${U1.id}"]`); await kp.evaluate(() => { document.activeElement.__mark = 1; });
  await kp.clock.fastForward(61000); await kp.waitForTimeout(800);
  ok(await kp.evaluate(() => document.activeElement.__mark === 1), 'refresh while a row has keyboard focus: nothing redrawn, focus kept');
  await api({ action: 'update', token: TOKEN, id: U1.id, patch: { team: 'ทีม 1' }, staff: 'อีกคน' });
  await kp.clock.fastForward(61000); await kp.waitForFunction(() => /มีข้อมูลใหม่/.test(document.querySelector('.bo-upd')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
  ok(/มีข้อมูลใหม่/.test(await text(kp, '.bo-upd')) && await kp.evaluate(() => document.activeElement.__mark === 1), 'new data while staff work: offered in the status line instead of a redraw');
  await kp.evaluate(() => { document.activeElement.blur(); document.querySelector('.bo-main h1').__mark = 1; });
  await kp.clock.fastForward(61000); await kp.waitForFunction(() => !document.querySelector('.bo-main h1').__mark, null, { timeout: 10000 }).catch(() => {});
  ok(await kp.evaluate(() => !document.querySelector('.bo-main h1').__mark && !/มีข้อมูลใหม่/.test(document.querySelector('.bo-upd').textContent)), 'idle board (focus on the page): the refresh redraws with the new data');
  await k.close();
  ok(!/(null|undefined|NaN)/.test(await text(u, 'main')), 'no null / undefined / NaN rendered in the board after these actions');

  // 14 · no browser errors anywhere
  ok(errs.length === 0, 'no console / page errors', errs.slice(0, 5));
} catch (e) { fails++; console.log('✗ crashed:', e.message); }
await b.close(); srv.kill();
try { rmSync(DATA, { recursive: true, force: true }); } catch (e) {}
console.log(JSON.stringify({ width: +W, theme, checks: n, fails }));
process.exit(fails ? 1 : 0);
