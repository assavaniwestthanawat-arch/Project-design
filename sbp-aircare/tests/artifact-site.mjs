// Rev.10 — the test site on Claude (build.py --test c → dist/art/test-c.html), end to end in Chromium with a stand-in for
// the claude.ai viewer: window.claude.use('db' | 'user') backed by localStorage (same contract shape as the artifact
// runtime's db.d.ts — doc / collection / where / orderBy / limit / get / set / update / delete / acquire / onSnapshot).
// Flow: customer books → ticket id → #backoffice test login → confirm + payment request → customer tracks, PromptPay QR,
// reports the transfer → office verifies → receipt number → customer sees it. Also: no window dialogs, no console errors,
// the Beta bar says it is a test site, and without the viewer (no window.claude) the page falls back to the hand-off summary.
// Needs the dev server (BASE, default http://localhost:8765) and a fresh `python3 build.py --test c`.
// usage: node tests/artifact-site.mjs [variant=c] [width=1366]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { launch } from './_lib.mjs';

const [,, V = 'c', W = 1366] = process.argv;
const ROOT = new URL('..', import.meta.url).pathname, BASE = process.env.BASE || 'http://localhost:8765';
const SRC = `${ROOT}dist/art/test-${V}.html`;
if (!existsSync(SRC)) { console.error(`missing ${SRC} — run: python3 build.py --test ${V}`); process.exit(2); }
// the artifact publish skeleton (what claude.ai wraps the page in)
writeFileSync(`${ROOT}dist/art/_test-${V}.full.html`, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + readFileSync(SRC, 'utf8') + '</body></html>');
const URL0 = `${BASE}/dist/art/_test-${V}.full.html`;

// in-page stand-in for the viewer's runtime (persists across reloads of the same origin, like the real store)
const FAKE = () => {
  const KEY = 'sbp-fake-artifact-db', leases = {};
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));
  const subs = new Set(), fire = () => setTimeout(() => subs.forEach(f => f()));
  const clone = x => JSON.parse(JSON.stringify(x));
  const seg = p => p.split('/').filter(Boolean);
  const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v; return o; };
  const meta = { fromCache: false, hasPendingWrites: false };
  const snap = (path, s) => { const d = s[path]; return Object.freeze({ id: seg(path).pop(), exists: !!d, data: () => (d ? clone(d) : undefined), metadata: meta }); };
  const check = (p, even) => { const n = seg(p).length; if (!n || n % 2 !== (even ? 0 : 1)) throw new TypeError('bad path parity: ' + p); };
  const size = d => { if (JSON.stringify(d).length > 256 * 1024) throw { code: 'invalid_argument', message: 'document over 256 KiB' }; };
  const docRef = path => { check(path, true); return {
    id: seg(path).pop(), path,
    get: async () => snap(path, load()),
    set: async d => { if (!d || typeof d !== 'object' || Array.isArray(d)) throw { code: 'invalid_argument', message: 'body' }; size(d); const s = load(); s[path] = clone(d); save(s); fire(); },
    update: async d => { const s = load(); if (!s[path]) throw { code: 'invalid_argument', message: 'missing document' }; s[path] = merge(s[path], clone(d)); size(s[path]); save(s); fire(); },
    delete: async () => { const s = load(); delete s[path]; save(s); fire(); },
    acquire: async ({ holder, ttlMs = 30000, data } = {}) => {
      const now = Date.now(), L = leases[path], ttl = Math.max(1000, Math.min(600000, ttlMs || 30000));
      if (L && L.exp > now && L.holder !== holder) return { acquired: false, expiresAt: new Date(L.exp).toISOString() };
      leases[path] = { holder, exp: now + ttl };
      if (data) { const s = load(); s[path] = merge(s[path] || {}, clone(data)); save(s); fire(); }
      return { acquired: true, version: 1, expiresAt: new Date(now + ttl).toISOString(), holder };
    },
    onSnapshot: (next) => { const f = () => next(snap(path, load())); subs.add(f); setTimeout(f); return () => subs.delete(f); },
    collection: p => colRef(path + '/' + p),
  }; };
  const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b,
    in: (a, b) => b.includes(a), 'not-in': (a, b) => !b.includes(a), 'array-contains': (a, b) => Array.isArray(a) && a.includes(b) };
  const colRef = path => {
    check(path, false);
    const run = (f, o, n) => {
      const s = load(), depth = seg(path).length + 1;
      let docs = Object.keys(s).filter(k => k.startsWith(path + '/') && seg(k).length === depth).sort().map(k => snap(k, s));
      for (const [fld, op, v] of f) { if (!OPS[op]) throw { code: 'invalid_argument', message: 'op ' + op }; docs = docs.filter(d => OPS[op](d.data()[fld], v)); }
      if (o) docs.sort((a, b) => { const x = a.data()[o[0]], y = b.data()[o[0]]; const c = x === undefined ? 1 : y === undefined ? -1 : x < y ? -1 : x > y ? 1 : 0; return o[1] === 'desc' ? -c : c; });
      docs = docs.slice(0, n);
      return Object.freeze({ docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((doc, i) => ({ type: 'added', doc, oldIndex: -1, newIndex: i })), metadata: meta });
    };
    const q = (f = [], o = null, n = 1000) => ({
      where: (fld, op, v) => q([...f, [fld, op, v]], o, n), orderBy: (fld, dir = 'asc') => q(f, [fld, dir], n), limit: k => q(f, o, Math.max(1, Math.min(1000, k))),
      get: async () => run(f, o, n),
      onSnapshot: next => { const fn = () => next(run(f, o, n)); subs.add(fn); setTimeout(fn); return () => subs.delete(fn); },
    });
    return Object.assign(q(), { path, doc: id => docRef(path + '/' + (id || Math.random().toString(36).slice(2, 12))), add: async d => { const r = docRef(path + '/' + Math.random().toString(36).slice(2, 12)); await r.set(d); return r; } });
  };
  const db = Object.freeze({ doc: docRef, collection: colRef });
  const user = Object.freeze({ id: async () => 'u_tester', me: async () => ({ id: 'u_tester', name: '', avatarUrl: 'data:,', color: '#1B51A4', email: null, isOwner: true, canEdit: true }),
    isOwner: async () => true, canEdit: async () => true, can: async () => !window.__sbpReadOnly, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: '', avatarUrl: 'data:,', color: '#1B51A4', email: null, isMe: i === 'u_tester', guest: false }])),
    name: async () => '', avatarUrl: async () => null, search: async () => [], email: async () => null });
  window.claude = Object.freeze({ use: async name => (name === 'db' ? db : name === 'user' ? user : null) });
};

let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x) : ''); } else console.log('✓', m); };
const b = await launch();
const errs = [];
const ctx = await b.newContext({ viewport: { width: +W, height: 900 } });
await ctx.addInitScript(FAKE);
const page = async url => {
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on('dialog', d => { errs.push('window dialog: ' + d.message()); d.dismiss(); });
  await p.goto(url); return p;
};
const text = (p, sel) => p.$eval(sel, e => e.textContent).catch(() => '');
const TEL = '0812345678';

try {
  // 1 · the site: test note + link to the test back office; book a cleaning job
  const p = await page(URL0 + '#booking');
  await p.waitForSelector('#bookRoot .bk-form', { timeout: 90000 });
  await p.waitForFunction(() => /เว็บทดสอบ/.test(document.querySelector('.sx-beta')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  ok(/เว็บทดสอบ/.test(await text(p, '.sx-beta')) && await p.$('.sx-beta a[href="#backoffice"]'), 'Beta bar: test site note + link to the test back office');
  await p.waitForFunction(() => !document.querySelector('.bk-strip')?.hidden, null, { timeout: 30000 }).catch(() => {});
  ok(await p.$eval('.bk-strip', e => !e.hidden).catch(() => false), 'availability strip shown (slots from the artifact store)');
  await p.fill('#bookRoot [data-u="wall"]', '2');
  const day = await p.$('.bk-days button:not([disabled])'); if (day) await day.click();
  await p.fill('#bookRoot textarea[required]', '12/3 ถ.พระราม 2 (ข้อมูลทดสอบ)');
  await p.fill('#bookRoot input[placeholder^="เช่น บางนา"]', 'บางขุนเทียน'); await p.waitForTimeout(400);
  await p.fill('#bookRoot input[autocomplete="name"]', 'คุณทดสอบ ระบบ');
  await p.fill('#bookRoot input[autocomplete="tel"]', TEL);
  await p.check('#bookRoot .s-consent input');
  await p.click('#bookRoot .bk-send button[type=submit]');
  await p.waitForFunction(() => /SBP-\d{6}-\d{3,5}/.test(document.querySelector('#bookRoot .bk-out')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const id = ((await text(p, '#bookRoot .bk-out')).match(/SBP-\d{6}-\d{3,5}/) || [])[0];
  ok(!!id, 'booking stored: ticket number shown', id);

  // 2 · test back office: login with the test account, confirm the job, create a payment request
  const s = await page(URL0 + '#backoffice');
  await s.waitForSelector('#bo-nm', { timeout: 90000 });
  ok(/หลังบ้านทดสอบ/.test(await text(s, '.bo-test')) && /ทดสอบ1234/.test(await text(s, '.bo-test')), 'back office mode: test bar with the test accounts');
  ok(!(await s.$('#bookRoot')) && !(await s.$('.sx-beta')), 'back office mode replaced the site');
  await s.fill('#bo-nm', 'admin'); await s.fill('#bo-tok', 'wrong-password'); await s.click('.bo-login button[type=submit]');
  await s.waitForFunction(() => (document.querySelector('.bo-err')?.textContent || '').length > 0, null, { timeout: 15000 }).catch(() => {});
  ok(/ไม่ถูกต้อง/.test(await text(s, '.bo-err')), 'wrong test password refused');
  await s.fill('#bo-tok', 'ทดสอบ1234'); await s.click('.bo-login button[type=submit]');
  await s.waitForSelector('.bo-t tbody th', { timeout: 20000 });
  ok(/ผู้ดูแล/.test(await text(s, '.bo-who')), 'admin test login');
  ok(await s.$(`.bo-t tbody tr[data-id="${id}"]`) !== null, 'the booking is in the list');
  await s.click(`.bo-t tbody tr[data-id="${id}"]`);
  await s.waitForSelector('.bo-pay', { timeout: 15000 });
  await s.selectOption('#bo-st', 'confirmed').catch(() => {});
  const save = await s.$('.bo-edit button[type=submit]'); if (save) { await save.click(); await s.waitForTimeout(800); }
  // a booking from the form carries no quote → no suggested amount: staff type the amount agreed with the customer
  await s.locator('.bo-pay details.bo-pf > summary', { hasText: 'สร้างรายการเรียกเก็บเงิน' }).first().click();
  ok(!(await s.$('.bo-pay .bo-sug')), 'no quote → no suggested amount');
  await s.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]');
  ok((await text(s, '.bo-pay form:has(#bo-pr-amt) .bo-err')).length > 0, 'empty amount without a suggestion: Thai error');
  await s.fill('#bo-pr-amt', '1500'); await s.click('.bo-pay form:has(#bo-pr-amt) button[type=submit]');
  await s.waitForFunction(() => /รอชำระ/.test(document.querySelector('.bo-pay .bo-ph')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok(/รอชำระ/.test(await text(s, '.bo-pay .bo-ph')), 'payment request created');

  // 3 · customer: track → payment box → PromptPay QR (test id) → reports the transfer
  await p.reload(); await p.waitForSelector('#bookRoot .bk-track', { timeout: 90000 });
  await p.fill('input[id^="bk-tid"]', id); await p.fill('input[id^="bk-ttel"]', TEL); await p.click('.bk-track button[type=submit]');
  await p.waitForSelector('.pay .pay-m button', { timeout: 20000 }).catch(() => {});
  ok(/1,500/.test(await text(p, '.pay')), 'customer sees the payment request', (await text(p, '.pay')).slice(0, 160));
  await p.click('.pay .pay-m button:has-text("พร้อมเพย์")').catch(() => {});
  await p.waitForSelector('.pay-qr', { timeout: 20000 }).catch(() => {});
  ok(await p.$eval('.pay-qr', e => e.complete && e.naturalWidth > 100).catch(() => false), 'PromptPay QR rendered');
  ok(/ห้ามโอนเงินจริง/.test(await text(p, '.pay-test')) && await p.$('.pay-qrw.test'), 'test QR is marked "ทดสอบ — ห้ามโอนเงินจริง"');
  await p.click('.pay-rep button[type=submit]').catch(() => {});
  // the box re-renders from the reply: "รอตรวจยอด" (never paid by itself), pay buttons folded away
  await p.waitForFunction(() => /รอตรวจยอด/.test(document.querySelector('.pay .pay-st')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok(/รอตรวจยอด/.test(await text(p, '.pay .pay-st')) && /แจ้งโอนแล้ว/.test(await text(p, '.pay')) && await p.$$eval('.pay .pay-m button', x => x.every(b => b.closest('details'))), 'transfer reported: รอตรวจยอด, waits for the office');
  ok(!/\bnull\b|undefined|NaN/.test(await text(p, '#bookRoot .bk-tout')), 'no null / undefined / NaN in the tracking result');

  // 4 · office verifies (in-page confirmation) → receipt number
  await s.reload(); await s.waitForSelector('.bo-t tbody th', { timeout: 30000 });
  await s.click(`.bo-t tbody tr[data-id="${id}"]`); await s.waitForSelector('.bo-pay [data-pay]', { timeout: 15000 });
  await s.click('.bo-pay [data-pay] button:has-text("ยืนยันได้รับเงิน")');
  await s.waitForSelector('.bo-pay .bo-sure', { timeout: 5000 }); await s.click('.bo-pay .bo-sure button:has-text("ยืนยัน")');
  await s.waitForSelector('.bo-pay .bo-rc', { timeout: 15000 }).catch(() => {});
  const rc = await text(s, '.bo-pay .bo-rc');
  ok(/^RC\d{4}-0001$/.test(rc), 'verified → receipt RC<yy><MM>-0001', rc);

  // 5 · customer sees the receipt
  await p.click('.bk-track button[type=submit]');
  await p.waitForFunction(r => (document.querySelector('.pay')?.textContent || '').includes(r), rc, { timeout: 15000 }).catch(() => {});
  ok((await text(p, '.pay')).includes(rc) && /ชำระครบแล้ว/.test(await text(p, '.pay')), 'customer sees ชำระครบแล้ว + receipt number');
  ok(!/(null|undefined|NaN)/.test(await text(p, '.pay')), 'no null / undefined / NaN in the payment box');

  // 6 · no viewer runtime (opened outside claude.ai): honest hand-off, no ticket claim
  const ctx2 = await b.newContext({ viewport: { width: +W, height: 900 } });
  const q = await ctx2.newPage(); q.on('dialog', d => { errs.push('window dialog: ' + d.message()); d.dismiss(); });
  await q.goto(URL0 + '#booking'); await q.waitForSelector('#bookRoot .bk-form', { timeout: 90000 });
  await q.fill('#bookRoot [data-u="wall"]', '1');
  const d2 = await q.$('.bk-days button:not([disabled])'); if (d2) await d2.click(); else await q.fill('#bookRoot input[type=date][required]', new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  await q.fill('#bookRoot textarea[required]', 'ทดสอบ'); await q.fill('#bookRoot input[autocomplete="name"]', 'ทดสอบ'); await q.fill('#bookRoot input[autocomplete="tel"]', '0899999999');
  await q.check('#bookRoot .s-consent input'); await q.click('#bookRoot .bk-send button[type=submit]');
  await q.waitForTimeout(4000);
  const out2 = await text(q, '#bookRoot .bk-out, #bookRoot .s-hand');
  ok(!/SBP-\d{6}-\d{3}/.test(out2), 'without the viewer: no ticket number is claimed', out2.slice(0, 160));
  await ctx2.close();

  // 7 · a view-only viewer (below Contributor) learns it before filling the form, and is never pointed at the real company
  const ctx3 = await b.newContext({ viewport: { width: +W, height: 900 } });
  await ctx3.addInitScript(() => { window.__sbpReadOnly = true; }); await ctx3.addInitScript(FAKE);
  const r3 = await ctx3.newPage(); await r3.goto(URL0 + '#booking'); await r3.waitForSelector('#bookRoot .bk-form', { timeout: 90000 });
  await r3.waitForFunction(() => /ดูได้อย่างเดียว/.test(document.querySelector('#bookRoot .bk-conn')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const conn3 = await text(r3, '#bookRoot .bk-conn');
  ok(/เว็บทดสอบ/.test(conn3) && /ดูได้อย่างเดียว/.test(conn3) && !/ส่งเข้าระบบหลังบ้านของบริษัท/.test(conn3), 'view-only viewer: the side card says so before the form is filled', conn3);
  await ctx3.close();

  ok(!errs.length, 'no console errors and no window dialogs', errs.slice(0, 5));
} catch (e) { fails++; console.log('✗ crashed', e.message); }
finally { await b.close(); }
console.log(JSON.stringify({ variant: V, width: +W, checks: n, fails }));
process.exit(fails ? 1 : 0);
