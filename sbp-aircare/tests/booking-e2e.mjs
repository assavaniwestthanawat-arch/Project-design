// Rev.09 r10 — end-to-end: website → ticket → back office → staff board → customer status, against the local back office
// (tools/backoffice-server.mjs = Code.gs in the Apps Script emulator + static files). Starts its own server.
// usage: node tests/booking-e2e.mjs [page=a.html] [width=1366] [theme=light]
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch } from './_lib.mjs';

const [,, page = 'a.html', W = 1366, theme = 'light'] = process.argv;
const PORT = 8792 + process.pid % 100, BASE = `http://localhost:${PORT}`, TOKEN = 'e2e-token';
const srv = spawn(process.execPath, ['tools/backoffice-server.mjs'], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PORT: String(PORT), STAFF_TOKEN: TOKEN, FRESH: '1', DATA: join(tmpdir(), `sbp-e2e-${process.pid}.json`) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { srv.stdout.on('data', d => { if (/back office \(local\)/.test(d)) res(); }); srv.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server start timeout')), 15000); });
const api = body => fetch(`${BASE}/exec`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }).then(r => r.json());

let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x) : ''); } else console.log('✓', m); };
const b = await launch();
const errs = [];
const newPage = async (url, w = +W) => { const p = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: theme }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_CONNECTION_REFUSED|net::/.test(m.text())) errs.push(m.text().slice(0, 200)); }); await p.goto(url); return p; };
const fillBooking = async (p, { tel = '0812345678', name = 'คุณทดสอบ อีทูอี' } = {}) => {
  await p.waitForSelector('#bookRoot .bk-form', { timeout: 60000 });
  await p.evaluate(() => { location.hash = '#booking'; }); await p.waitForTimeout(800);
  await p.fill('#bookRoot [data-u="wall"]', '4');
  const strip = await p.$('.bk-days button:not([disabled])');
  if (strip) await strip.click(); else await p.fill('#bookRoot input[type=date][required]', new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10));
  await p.fill('#bookRoot textarea[required]', '99/9 ถ.บางนา-ตราด');
  await p.fill('#bookRoot input[placeholder^="เช่น บางนา"]', 'บางนา'); await p.waitForTimeout(400);
  await p.fill('#bookRoot input[autocomplete="name"]', name);
  await p.fill('#bookRoot input[autocomplete="tel"]', tel);
  await p.check('#bookRoot .s-consent input');
};

try {
  // 1 · booking → ticket
  const p = await newPage(`${BASE}/${page}?ticketApi=/exec#booking`);
  await p.waitForSelector('#bookRoot .bk-form', { timeout: 60000 });
  // Rev.10 UX: the guided journey's send step is done only with a ticket id — never because the form was on screen
  // (a journey saved before the rule had it ticked: it must come back as "not sent")
  const hasJ = !!(await p.$('.sx-js-home'));
  const strip = () => p.evaluate(() => { location.hash = '#home'; return new Promise(r => setTimeout(() => r((document.querySelector('.sx-js-home') || {}).textContent || ''), 900)); });
  if (hasJ) {
    await p.evaluate(() => localStorage.setItem('sbp-journey-v1', JSON.stringify({ k: 'clean', done: [0, 1, 2, 3] })));
    await p.reload(); await p.waitForSelector('#bookRoot .bk-form', { timeout: 60000 });
    const j0 = await strip();
    ok(/ทำแล้ว 3 จาก 4/.test(j0) && /ยังไม่ได้ส่งคำขอ/.test(j0) && /ไปส่งคำขอ/.test(j0) && !/ครบทุกขั้นแล้ว|ทีมจะติดต่อกลับ/.test(j0), 'journey: nothing sent → the send step stays open ("ยังไม่ได้ส่งคำขอ" + ไปส่งคำขอ)', j0);
    await p.click('.sx-js-home button:has-text("ไปส่งคำขอ")'); await p.waitForTimeout(2500);   // longer than the 1.8 s "seen" timer
    const here = await p.$eval('.sx-here', e => (e.hidden ? '' : e.textContent)).catch(() => '');
    ok(/ขั้นที่ 4 จาก 4/.test(here) && /ยังไม่ได้ส่งคำขอ/.test(here) && !/\bnull\b/.test(here), '"ไปส่งคำขอ" opens the form; the step banner says it is not sent (no "null")', here);
    ok(/ยังไม่ได้ส่งคำขอ/.test(await strip()), 'journey: viewing the booking form does not mark it sent');
    await p.evaluate(() => { location.hash = '#booking'; }); await p.waitForTimeout(600);
  }
  await p.waitForFunction(() => !document.querySelector('.bk-strip').hidden, null, { timeout: 15000 }).catch(() => {});
  ok(await p.$eval('.bk-strip', e => !e.hidden), 'availability strip shown when connected');
  await p.click('#bookRoot .bk-send button[type=submit]');
  ok(await p.$$eval('#bookRoot [aria-invalid="true"]', x => x.length) >= 3, 'empty form: Thai field errors, nothing sent');
  ok((await api({ action: 'list', token: TOKEN })).tickets.length === 0, 'no ticket from an invalid form');
  await fillBooking(p);
  ok(/บางนา/.test(await p.textContent('#bookRoot .bk-zone')), 'area check shows the zone');
  await p.click('#bookRoot .bk-send button[type=submit]');
  await p.waitForSelector('#bookRoot .s-tk-id b', { timeout: 20000 });
  const id = (await p.textContent('#bookRoot .s-tk-id b')).trim();
  ok(/^SBP-\d{6}-\d{3}$/.test(id), 'booking stored, ticket number shown', id);
  ok(await p.evaluate(() => !!(document.activeElement && document.activeElement.closest('#bookRoot .bk-out'))), 'focus moves to the result (never left on the folded form or <body>)');
  if (hasJ) {
    const j1 = await strip();
    ok(/ทำแล้ว 4 จาก 4/.test(j1) && j1.includes('ส่งคำขอแล้ว เลขที่ ' + id) && !/\bnull\b/.test(j1), 'journey: the stored ticket completes the send step, with its id', j1);
    await p.evaluate(() => { location.hash = '#booking'; }); await p.waitForTimeout(600);
  }
  ok(await p.$eval('#bookRoot .bk-form', f => f.hidden), 'form folds away after success');
  const L1 = await api({ action: 'list', token: TOKEN });
  const t1 = L1.tickets.find(t => t.id === id);
  ok(t1 && t1.kind === 'booking' && t1.service === 'clean' && t1.units === '{"wall":4}' && t1.tel === '0812345678' && /บางนา/.test(t1.area) && t1.prefDate && t1.slot, 'back office row has the booking details', t1);
  // 2 · customer tracks it
  await p.click('#bookRoot .s-tk .s-btn');
  await p.waitForSelector('#bookRoot .bk-tl li.now', { timeout: 15000 });
  ok(/รับคำขอแล้ว/.test(await p.textContent('#bookRoot .bk-tl li.now')), 'track: received / waiting for confirmation');
  // 3 · staff board: login, open, confirm + assign
  const s = await newPage(`${BASE}/backoffice.html?ticketApi=/exec`, 1366);
  await s.fill('#bo-nm', 'แอดมินทดสอบ'); await s.fill('#bo-tok', 'wrong'); await s.click('.bo-login button');
  await s.waitForFunction(() => /รหัสเจ้าหน้าที่ไม่ถูกต้อง/.test(document.querySelector('.bo-err')?.textContent || ''), null, { timeout: 10000 });
  ok(true, 'board rejects a wrong staff code');
  await s.fill('#bo-tok', TOKEN); await s.click('.bo-login button');
  await s.waitForSelector('.bo-t tbody th', { timeout: 15000 });
  ok(await s.$$eval('.bo-t tbody th', x => x.map(e => e.textContent)).then(a => a.includes(id)), 'board lists the new ticket');
  await s.click(`.bo-t tbody tr[data-id="${id}"]`);
  await s.waitForSelector('#bo-st');
  // Rev.10 UX: the customer's preferred date is only a hint — the appointment field stays empty until staff choose it
  ok(await s.inputValue('#bo-sd') === '' && /ลูกค้าขอ/.test(await s.textContent('.bo-pref')), 'appointment empty until staff set it; the preferred date is a hint');
  await s.click('.bo-pref button:has-text("ใช้วันที่ลูกค้าขอ")');
  await s.selectOption('#bo-st', 'confirmed'); await s.selectOption('#bo-team', 'ทีม 1'); await s.selectOption('#bo-sl', 'PM');
  await s.fill('#bo-note', 'ลูกค้าขอให้โทรก่อน'); await s.click('.bo-edit button[type=submit]');
  await s.waitForFunction(() => /บันทึก .* แล้ว/.test(document.querySelector('.bo-toast')?.textContent || ''), null, { timeout: 10000 });
  const t2 = (await api({ action: 'list', token: TOKEN })).tickets.find(t => t.id === id);
  ok(t2.status === 'confirmed' && t2.team === 'ทีม 1' && t2.schedSlot === 'PM' && t2.schedDate === t1.prefDate && JSON.parse(t2.history).pop().by === 'แอดมินทดสอบ', 'staff update stored with who/when', t2);
  ok(await s.$eval('.bo-cap', e => /1\/2/.test(e.textContent)), 'capacity grid counts the booking');
  // 4 · customer sees the confirmation, not the staff note
  await p.click('#bookRoot .bk-track button[type=submit]');
  await p.waitForFunction(() => /ยืนยันนัดแล้ว/.test(document.querySelector('#bookRoot .bk-tl li.now')?.textContent || ''), null, { timeout: 15000 });
  const tout = await p.textContent('#bookRoot .bk-tout');
  ok(/นัดหมาย:/.test(tout) && !/โทรก่อน/.test(tout), 'track: confirmed + appointment, staff note hidden', tout);
  // UX audit: no literal "null", the current step is exposed (aria-current) and only finished steps carry the check
  const tl = await p.$$eval('#bookRoot .bk-tl li', x => x.map(li => ({ cur: li.getAttribute('aria-current'), done: li.classList.contains('done'), check: !!li.querySelector('svg') })));
  ok(!/\bnull\b|undefined/.test(tout) && tl.filter(l => l.cur === 'step').length === 1 && tl.every(l => l.check === l.done), 'track: no "null", aria-current on the current step, checks only on finished steps', tl);
  // 5 · contact form → inquiry ticket
  await p.evaluate(() => { location.hash = '#quote'; }); await p.waitForTimeout(1200);
  const nameSel = '#qform input[id$="name"]', telSel = '#qform input[id$="tel"]';
  await p.fill(nameSel, 'คุณติดต่อ'); await p.fill(telSel, '0898765432'); await p.selectOption('#q-topic', 'สัญญาล้างรายปี'); await p.fill('#q-msg', 'อาคาร 3 ชั้น ประมาณ 40 เครื่อง'); await p.check('#q-consent');
  await p.click('#qform button:not([type=button])');
  await p.waitForSelector('.sx-qout .s-tk-id b, .d-qout .s-tk-id b', { timeout: 20000 });
  const L3 = await api({ action: 'list', token: TOKEN });
  const inq = L3.tickets.find(t => t.kind === 'inquiry');
  ok(inq && inq.service === 'amc' && /40 เครื่อง/.test(inq.notes) && inq.name === 'คุณติดต่อ', 'contact form stored as an inquiry ticket', inq);
  if (await p.$('.sx-qout')) {
    const qc = await p.textContent('.sx-qout');
    ok(await p.$eval('#qform', f => f.hidden) && /ทีมจะโทรกลับตามเบอร์ที่ให้ไว้/.test(qc) && !/โทรยืนยันวัน เวลา/.test(qc), 'contact form: folds away after success; the card gives the call-back step (not booking steps)', qc.slice(0, 200));
    ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('s-tk-b')), 'contact form: focus on the result heading');
    await p.click('.sx-qout .sx-qagain');
    ok(!(await p.$eval('#qform', f => f.hidden)) && (await p.inputValue(nameSel)) === '' && !(await p.isChecked('#q-consent')), '"ส่งเรื่องใหม่" opens a clean form');
  }
  // 6 · quote basket → quote ticket (add a cleaning line from the price centre; phones hide the header quote button — use the visible one)
  if (await p.$('#prices')) { await p.evaluate(() => { location.hash = '#prices'; }); await p.waitForTimeout(1500); await p.click('#prices .s-add-btn:not(.s-ask)'); }
  else { await p.evaluate(() => scrollTo(0, 0)); await p.click('#jobcard .jc-add'); }   // แบบ D: the job card puts its lines in the basket
  await p.waitForTimeout(300);
  await p.locator('[data-cart-btn]:visible').first().click(); await p.waitForSelector('.s-cart #s-q-name', { timeout: 10000 });
  await p.fill('.s-cart #s-q-name', 'บริษัท ใบเสนอราคา จำกัด'); await p.fill('.s-cart #s-q-tel', '021112222'); await p.check('.s-cart #s-q-consent');
  await p.click('.s-cart .s-form button[type=submit]');
  await p.waitForSelector('.s-cart .s-tk-id b', { timeout: 20000 });
  const qt = (await api({ action: 'list', token: TOKEN })).tickets.find(t => t.kind === 'quote');
  ok(qt && qt.quoteLines && +qt.quoteTotalEx > 0 && +qt.quoteTotalEx % 100 === 0, 'quote basket stored with its lines (round hundreds)', qt && { lines: qt.quoteLines, total: qt.quoteTotalEx });
  const mails = await fetch(`${BASE}/__outbox`).then(r => r.json());
  ok(mails.length === 3, 'team notified for each ticket', mails.map(m => m.subject));
  // 7 · not connected (no endpoint): honest hand-off, nothing claimed
  const q = await newPage(`${BASE}/${page}#booking`);
  await fillBooking(q, { tel: '0855555555' });
  ok(await q.$eval('.bk-strip', e => e.hidden), 'no strip when not connected');
  await q.click('#bookRoot .bk-send button[type=submit]');
  await q.waitForSelector('#bookRoot .s-hand', { timeout: 10000 });
  ok(!(await q.$('#bookRoot .s-tk')), 'not connected: hand-off summary, no ticket claim');
  // 8 · back office unreachable: hand-off with the reason
  const r = await newPage(`${BASE}/${page}?ticketApi=http://127.0.0.1:9/exec#booking`);
  await fillBooking(r, { tel: '0866666666' });
  await r.click('#bookRoot .bk-send button[type=submit]');
  await r.waitForSelector('#bookRoot .s-hand', { timeout: 20000 });
  const why = await r.textContent('#bookRoot .s-hand > p:not(.s-hand-b)');
  ok(/เชื่อมต่อระบบไม่ได้/.test(why) && !/[()]/.test(why), 'unreachable: hand-off says why in one plain sentence (no nested brackets, no code)', why);
  const rid0 = await r.$eval('#bookRoot .bk-form', f => f.dataset.rid);
  ok(await r.$('#bookRoot .s-hand button:has-text("ลองส่งอีกครั้ง")') !== null, 'unreachable: a "ลองส่งอีกครั้ง" button right under the reason');
  await r.click('#bookRoot .s-hand button:has-text("ลองส่งอีกครั้ง")'); await r.waitForTimeout(300);
  await r.waitForSelector('#bookRoot .s-hand', { timeout: 20000 });
  ok(!!rid0 && rid0 === await r.$eval('#bookRoot .bk-form', f => f.dataset.rid), 'the retry re-sends with the same request id (no duplicate when it gets through)');
  ok((await api({ action: 'list', token: TOKEN })).tickets.length === 3, 'exactly 3 tickets stored (fallbacks stored nothing)');
  // 9 · feedback: a name / phone makes the consent line appear and required; the result is a feedback card with focus on its heading
  if (await p.$('.sx-fbb')) {
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);   // the quote basket from step 6 is still open
    await p.locator('.sx-fbb').first().click(); await p.waitForSelector('.sx-dlg form');
    ok(await p.$eval('.sx-fbc', e => e.hidden), 'feedback: no consent line while anonymous');
    await p.fill('.sx-dlg input[name=sx-who]', 'สมชาย 081-222-5555');
    ok(await p.$eval('.sx-fbc', e => !e.hidden), 'feedback: a name / phone shows the consent line');
    await p.click('.sx-dlg button[type=submit]'); await p.waitForTimeout(400);
    ok((await p.getAttribute('#sx-consent', 'aria-invalid')) === 'true' && !(await p.$('.sx-dlg .s-tk')), 'feedback with a phone: not sent until consent is ticked');
    await p.check('#sx-consent'); await p.click('.sx-dlg button[type=submit]');
    await p.waitForSelector('.sx-dlg .s-tk', { timeout: 20000 });
    const fc = await p.textContent('.sx-dlg .s-tk');
    ok(/ได้รับความเห็นแล้ว/.test(fc) && !/สถานะ:|โทรยืนยันวัน/.test(fc) && await p.evaluate(() => document.activeElement.id === 'sx-fb-h'), 'feedback: "ได้รับความเห็นแล้ว" card without booking status/steps, focus on the heading', fc.slice(0, 160));
    await p.keyboard.press('Escape');
  }
  // 10 · search opens with Ctrl+K / ⌘K, never with a single character key (WCAG 2.1.4)
  if (await p.$('.sx-sbtn')) {
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press('/'); await p.waitForTimeout(300);
    const slash = !!(await p.$('.sx-sdlg'));
    await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
    ok(!slash && !!(await p.$('.sx-sdlg')) && (await p.getAttribute('.sx-sbtn', 'aria-keyshortcuts')) === 'Control+K Meta+K', 'search: "/" does nothing, Ctrl+K opens it (aria-keyshortcuts Control+K Meta+K)');
    await p.keyboard.press('Escape');
  }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) { fails++; console.log('✗ crashed:', e.message); }
await b.close(); srv.kill();
console.log(JSON.stringify({ page, width: +W, theme, checks: n, fails }));
process.exit(fails ? 1 : 0);
