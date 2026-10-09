// Rev.10 แบบ D — job card + chapters behave (no backend needed): live prices from the Pricebook, cleaning minimum,
// table → card presets, card → booking hand-off, card → quote basket, business tabs, no console errors, no sideways scroll.
// usage: node tests/d-flow.mjs [width=1366] [theme=light]   (dev server on :8765 — npm run serve)
import { launch, BASE } from './_lib.mjs';
const [,, W = 1366, theme = 'light'] = process.argv;
let fails = 0, n = 0;
const ok = (c, m, x) => { n++; if (!c) { fails++; console.log('✗', m, x !== undefined ? JSON.stringify(x) : ''); } else console.log('✓', m); };
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: 900 }, colorScheme: theme });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
const total = () => p.$eval('#jobcard .jc-num', e => e.textContent.trim());
try {
  await p.goto(`${BASE}/d.html`); await p.waitForSelector('#jobcard .jc-tabs');
  ok(await total() === '฿4,500', 'clean: 2 small wall units → minimum ฿4,500', await total());
  ok(/ล้างแอร์ติดผนังเพิ่มได้อีก 4 เครื่อง/.test(await p.textContent('#jobcard .jc-sum')), 'clean: says how many more fit in the minimum');
  for (let i = 0; i < 5; i++) await p.click('#jobcard .jc-u:nth-child(2) .jc-step button:last-child');
  ok(await total() === '฿4,900', 'clean: 7 units × ฿700 = ฿4,900 (no minimum line)', await total());
  await p.click('#jobcard .jc-seg button[data-v="C2"]');
  ok(await total() === '฿11,900', 'clean C2: 7 × ฿1,700', await total());
  await p.click('#jobcard [data-job="install"]');
  ok(await total() === '฿3,800', 'install: wall 9–12k standard ฿3,800', await total());
  await p.click('#jobcard .jc-seg button[data-v="PREMIUM"]');
  ok(await total() === '฿4,800', 'install premium ฿4,800', await total());
  await p.click('#jobcard [data-job="repair"]');
  ok(await total() === '฿900', 'repair: wall diagnosis ฿900', await total());
  await p.click('#jobcard .jc-seg button[data-v="floor"]');
  ok(await total() === 'แจ้งก่อนนัด', 'repair floor: fee told before the visit', await total());
  await p.click('#jobcard [data-job="amc"]');
  ok(/฿64,300/.test(await total()), 'contract: 12 wall + 4 cassette, 3 visits, Standard Care = ฿64,300/yr', await total());
  ok(/เพิ่มอีก 14 เครื่อง/.test(await p.textContent('#jobcard .jc-sum')), 'contract: next ladder step hint');
  // price table → card
  await p.evaluate(() => document.getElementById('clean').scrollIntoView()); await p.waitForSelector('#cleanRoot .d-pick');
  await p.click('#cleanRoot .d-price tbody:nth-of-type(2) tr:first-child td:nth-of-type(3) .d-pick');   // ceiling, smallest, Standard Care
  await p.waitForTimeout(300);
  ok(await p.$eval('#jobcard [data-job="clean"]', e => e.getAttribute('aria-selected')) === 'true' && await p.$eval('#jobcard .jc-seg.three button[aria-pressed="true"]', e => e.dataset.v) === 'Standard Care', 'price table click loads the card (clean, Standard Care)');
  // card → booking
  await p.click('#jobcard .jc-go'); await p.waitForSelector('#bookRoot .bk-form', { timeout: 20000 }); await p.waitForTimeout(600);
  const bk = await p.evaluate(() => ({ svc: document.querySelector('#bookRoot input[type=radio]:checked')?.value, pkg: [...document.querySelectorAll('#bookRoot select')].map(s => s.value).join('|'), notes: document.querySelector('#bookRoot textarea:not([required])')?.value || '' }));
  ok(bk.svc === 'clean' && /Standard Care/.test(bk.pkg) && /จากใบงาน/.test(bk.notes), 'card hands off to booking with service, package and notes', bk);
  // card → quote basket
  await p.evaluate(() => scrollTo(0, 0)); await p.click('#jobcard .jc-add'); await p.waitForTimeout(300);
  ok(await p.$eval('[data-cart-btn] [data-cart-n]', e => +e.textContent) > 0, 'card adds lines to the quote basket');
  // business tabs
  await p.evaluate(() => document.getElementById('business').scrollIntoView()); await p.waitForSelector('#amcRoot > *:not(.d-load)', { timeout: 15000 });
  await p.click('[data-biz="projects"]'); await p.waitForTimeout(500);
  ok(await p.$eval('#projects', e => !e.hidden && e.textContent.length > 200) && await p.$eval('#amc', e => e.hidden), 'business tabs switch panels and mount on first view');
  const wide = await p.evaluate(() => { const W = innerWidth, out = []; document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.right > W + 1 && r.width && getComputedStyle(e).position !== 'fixed') { let a = e; while ((a = a.parentElement) && !/auto|scroll|hidden/.test(getComputedStyle(a).overflowX)); if (!a) out.push(`${e.tagName}.${typeof e.className === 'string' ? e.className : ''}#${e.id} ${Math.round(r.right)}`); } }); return { over: document.documentElement.scrollWidth - W, out: out.slice(0, 5) }; });
  ok(wide.over <= 0, 'no sideways scroll', wide);
  ok(errs.length === 0, 'no page errors', errs.slice(0, 4));
} catch (e) { fails++; console.log('✗ crashed:', e.message.split('\n')[0]); }
await b.close();
console.log(JSON.stringify({ page: 'd.html', width: +W, theme, checks: n, fails }));
process.exit(fails ? 1 : 0);
