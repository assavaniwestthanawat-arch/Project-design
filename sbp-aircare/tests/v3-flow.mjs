// r13 รุ่นที่ 3 (a3/b3/c3): nine pages by job — each page shows only its own sections under its own heading, the menu marks
// the current page, back/forward walk the pages, the hero's job links open the right page, every concierge answer on the
// repair page carries a price line or "ประเมินหน้างาน" and hands the job to the booking form (contact page), a catalog
// model goes into the quote basket from its drawer, the cleaning and installation pages each add their price line, the
// annual-contract estimate goes to the quote, a price link opens the price centre on its tab, search opens a model, banned
// words never appear, at most 3 live WebGL contexts, no page errors, no sideways scroll.
// usage: node tests/v3-flow.mjs <a3|b3|c3> [width=1366]   (dev server: BASE env or :8765)
import { launch, BASE } from './_lib.mjs';
const [,, page = 'a3', W = 1366] = process.argv;
const BANNED = ['แก้หายแน่นอน', 'ไม่มีปัญหาอีกแน่นอน', 'ประหยัดไฟแน่นอน', 'ปลอดเชื้อ', 'สะอาด 100%', 'รับประกันเย็น', 'ล้างใหญ่ครบทุกจุด', 'ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี', 'อะไหล่เสียแน่นอน', 'เสร็จตามเวลาแน่นอน', 'Type L', 'K Copper', 'undefined', 'NaN', 'อัตราพิเศษ ', 'อัตราโครงการ'];
const PAGES = { home: ['hero', 'start', 'services', 'flow'], shop: ['catalog', 'studio', 'fit', 'fujiva'], cleaning: ['cleanflow', 'inside'], install: ['installflow', 'quality', 'projects'], repair: ['ask', 'howto'], business: ['amc', 'b2b', 'sop'], pricing: ['prices'], guide: ['learn'], contact: ['booking', 'quote', 'area', 'about', 'faq'] };
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: +W < 600 ? 844 : 900 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
let ok = 0, bad = 0; const check = (c, msg) => { if (c) ok++; else { bad++; console.log('✗ ' + msg); } };
await p.addInitScript(() => { const g = { live: 0, peak: 0 }; window.__gl = g; const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc.call(this, t, ...a); if (c && /webgl/.test(t) && !this.__c) { this.__c = 1; g.live++; g.peak = Math.max(g.peak, g.live); this.addEventListener('webglcontextlost', () => g.live--); } return c; }; });
await p.goto(`${BASE}/${page}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('v3-on'), null, { timeout: 120000 });
const cartN = () => p.evaluate(() => +document.querySelector('[data-cart-n]').textContent || 0);
const view = () => p.evaluate(() => document.documentElement.dataset.sxView);
let text = '';

// ---- the nine pages ----
const nav = await p.evaluate(() => [...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v));
check(JSON.stringify(nav) === JSON.stringify(Object.keys(PAGES)), `menu = nine pages in order (${nav})`);
for (const [v, ids] of Object.entries(PAGES)) {
  await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(1200);
  const s = await p.evaluate(ids => ({ cur: document.documentElement.dataset.sxView, shown: [...document.querySelectorAll('main section[id]')].filter(x => !x.closest('[hidden]') && x.offsetParent).map(x => x.id),
    mark: document.querySelector('header nav a[aria-current="page"]')?.dataset.v, h1: [...document.querySelectorAll('h1')].filter(x => x.offsetParent).map(x => x.textContent.trim()) }), ids);
  check(s.cur === v && s.mark === v, `${v}: current page + menu mark (${s.cur}/${s.mark})`);
  check(ids.every(id => s.shown.includes(id)) && s.shown.every(id => ids.includes(id)), `${v}: shows exactly its sections (${s.shown})`);
  check(s.h1.length === 1, `${v}: one visible h1 (${s.h1})`);
  text += '\n' + await p.evaluate(() => { document.querySelectorAll('details').forEach(d => d.open = true); return document.body.innerText; });
}
// back / forward
await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(600);
await p.click('header nav a[data-v="pricing"]'); await p.waitForTimeout(800);
await p.click('header nav a[data-v="guide"]'); await p.waitForTimeout(800);
await p.goBack(); await p.waitForTimeout(900); check(await view() === 'pricing', 'back → previous page');
await p.goForward(); await p.waitForTimeout(900); check(await view() === 'guide', 'forward → next page');

// ---- hero job links ----
await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(800);
const jobs = await p.evaluate(() => [...document.querySelectorAll('#hero a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter((x, i, l) => l.indexOf(x) === i));
check(jobs.length >= 4, `hero job links (${jobs})`);
for (const j of jobs) { await p.evaluate(j => { location.hash = 'home'; }, j); await p.waitForTimeout(500); await p.locator(`#hero a[href="#${j}"]`).first().click(); await p.waitForTimeout(700); const v = await view(); check(v === j || await p.evaluate(([j, v]) => document.getElementById(j)?.closest('[data-sx]')?.dataset.sx === v, [j, v]), `hero link #${j} → ${v}`); }
const heroPrices = await p.evaluate(() => [...document.querySelectorAll('#hero [data-from],#hero [data-from-buy]')].map(e => e.textContent.trim()));
check(heroPrices.length >= 3 && heroPrices.every(t => /฿[\d,]+|ประเมินหน้างาน/.test(t)), `hero starting prices (${heroPrices})`);

// ---- repair: concierge ----
await p.evaluate(() => { location.hash = 'repair'; }); await p.waitForTimeout(1500);
await p.waitForSelector('#askRoot .cc-chips button', { timeout: 60000 });
const needs = await p.evaluate(() => [...document.querySelectorAll('#askRoot .cc-q:nth-child(2) .cc-chips button')].map(b => b.textContent));
check(needs.length === 10, `10 needs (${needs.length})`);
for (const n of needs) {
  await p.locator('#askRoot .cc-q:nth-child(2) .cc-chips button', { hasText: n }).first().click(); await p.waitForTimeout(150);
  const r = await p.evaluate(() => { const res = document.querySelector('.cc-res'); return { txt: res.innerText, rows: res.querySelectorAll('.cc-price dd').length, money: [...res.querySelectorAll('.cc-price dd')].every(d => /฿[\d,]+|ประเมินหน้างาน/.test(d.textContent)), go: !!res.querySelector('.cc-acts .v-btn.go') }; });
  text += '\n' + r.txt;
  check(r.go, `${n}: booking button`);
  check(n === 'ดูแลหลายเครื่องทั้งปี' || (r.rows > 0 && r.money), `${n}: price rows (${r.rows}) each a price or ประเมินหน้างาน`);
}
await p.locator('#askRoot .cc-q:nth-child(2) .cc-chips button', { hasText: 'ไม่เย็น หรือเย็นน้อย' }).first().click(); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('.cc-acts .v-btn.go').click()); await p.waitForTimeout(1500);
const bk = await p.evaluate(() => ({ v: document.documentElement.dataset.sxView, svc: document.querySelector('#bookRoot input[type=radio]:checked')?.value }));
check(bk.v === 'contact' && !!bk.svc, `concierge → booking on the contact page (${JSON.stringify(bk)})`);

// ---- shop: catalog → drawer → quote ----
await p.evaluate(() => { location.hash = 'shop'; }); await p.waitForTimeout(2000);
await p.waitForSelector('[data-cat-grid] .card .open', { timeout: 60000 });
await p.locator('[data-cat-grid] .card .open').first().click(); await p.waitForTimeout(800);
const c0 = await cartN();
const add = p.locator('#drawerBody button', { hasText: /ใส่ใบเสนอราคา|เพิ่มลงใบเสนอราคา/ }).first();
if (await add.count()) { await add.click(); await p.waitForTimeout(500); }
check(await cartN() > c0, 'catalog model → quote basket');
await p.evaluate(() => { document.querySelector('#drawer [data-close]')?.click(); }); await p.waitForTimeout(600);

// ---- cleaning / install price lines ----
for (const [v, root] of [['cleaning', '#cleanRoot'], ['install', '#installRoot']]) {
  await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(2000);
  const n0 = await cartN();
  const ok2 = await p.evaluate(r => { const b = [...document.querySelectorAll(r + ' button')].find(x => /ใส่ใบเสนอราคา/.test(x.textContent) && x.offsetParent); if (b) b.click(); return !!b; }, root); await p.waitForTimeout(400);
  check(ok2 && await cartN() > n0, `${v}: price line → quote basket`);
}

// ---- business: annual estimate → quote ----
await p.evaluate(() => { location.hash = 'business'; }); await p.waitForTimeout(1500);
await p.locator('#presets button').nth(1).click(); await p.waitForTimeout(400);
const n1 = await cartN(); await p.locator('[data-quote]').first().click(); await p.waitForTimeout(600);
check(await cartN() > n1, 'annual contract estimate → quote basket');
await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('[data-cart-close],.s-cart [data-close]')?.click()); await p.waitForTimeout(400);

// ---- price link (data-pc) from another page → price centre tab ----
await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(600);
const pcOk = await p.evaluate(() => { const a = document.createElement('a'); a.href = '#prices'; a.dataset.pc = 'repair'; a.textContent = 'x'; document.querySelector('#hero').append(a); a.click(); a.remove(); return document.documentElement.dataset.sxView; });
check(pcOk === 'pricing', `data-pc link → pricing page (${pcOk})`);

// ---- search → a model's drawer ----
await p.evaluate(() => { location.hash = 'guide'; }); await p.waitForTimeout(600);
await p.click('.sx-sbtn'); await p.waitForSelector('.sx-sq', { timeout: 10000 });
await p.fill('.sx-sq', 'FTKB'); await p.waitForTimeout(500);
await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
check(await p.evaluate(() => !document.getElementById('drawer').hidden || document.documentElement.dataset.sxView === 'shop'), 'search FTKB → model');

const st = await p.evaluate(() => ({ gl: window.__gl, ox: document.documentElement.scrollWidth - innerWidth }));
check(st.gl.peak <= 3, `WebGL contexts ≤ 3 at once (peak ${st.gl.peak})`);
check(st.ox <= 0, `no sideways scroll (${st.ox})`);
for (const w of BANNED) { const i = text.indexOf(w); check(i < 0, `banned "${w}": …${text.slice(Math.max(0, i - 40), i + 40)}…`); }
check(!errs.length, `no page errors: ${errs.slice(0, 3).join(' | ')}`);
console.log(JSON.stringify({ page, W: +W, ok, bad }));
await b.close(); process.exit(bad ? 1 : 0);
