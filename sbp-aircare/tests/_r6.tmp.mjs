// temp: r6 checks — path cards, search, inline validation (screenshots + console errors)
import { launch, BASE } from './_lib.mjs';
const [out, page = 'a.html', W = '1366', H = '900', theme = 'light'] = process.argv.slice(2);
const tag = page.replace('.html', '') + '-' + W;
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: +H }, colorScheme: theme });
const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(`${BASE}/${page}`); await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/${tag}-home.png`, timeout: 240000 });
await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; const el = document.getElementById('start'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); });
await p.waitForTimeout(1500); await p.screenshot({ path: `${out}/${tag}-start.png`, timeout: 240000 });
console.log('cards', await p.evaluate(() => [...document.querySelectorAll('.sx-int')].map(c => c.querySelector('h3').textContent + ' | ' + (c.querySelector('.sx-int-p')?.textContent || '')).join(' ;; ')));
// search: model
await p.click('.sx-sbtn'); await p.waitForTimeout(400); await p.fill('.sx-sq', 'daikin 12000'); await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/${tag}-search.png`, timeout: 240000 });
console.log('search', await p.evaluate(() => [...document.querySelectorAll('.sx-so')].slice(0, 4).map(o => o.textContent.slice(0, 60))));
await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
console.log('model opened', await p.evaluate(() => ({ drawer: !document.getElementById('drawer').hidden, view: document.documentElement.dataset.sxView })));
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
// search: price item
await p.keyboard.press('/'); await p.waitForTimeout(400); await p.fill('.sx-sq', 'ปั๊มน้ำทิ้ง'); await p.waitForTimeout(400);
console.log('search2', await p.evaluate(() => [...document.querySelectorAll('.sx-so')].slice(0, 3).map(o => o.textContent.slice(0, 70))));
await p.keyboard.press('Enter'); await p.waitForTimeout(2000);
console.log('price', await p.evaluate(() => ({ view: document.documentElement.dataset.sxView, q: document.getElementById('pc-search')?.value, rows: document.querySelectorAll('#priceCenter tr, #priceCenter .s-row').length })));
await p.screenshot({ path: `${out}/${tag}-price.png`, timeout: 240000 });
// inline validation
await p.evaluate(() => { location.hash = 'quote'; }); await p.waitForTimeout(1500);
await p.evaluate(() => document.querySelector('#qform button:not([type="button"])').click()); await p.waitForTimeout(500);
console.log('errors shown', await p.evaluate(() => [[...document.querySelectorAll('#qform .s-err')].map(e => e.textContent), document.activeElement?.id]));
await p.fill('#qform input[required] >> nth=1', '12345'); await p.evaluate(() => document.querySelector('#qform button:not([type="button"])').click()); await p.waitForTimeout(400);
console.log('tel error', await p.evaluate(() => [...document.querySelectorAll('#qform .s-err')].map(e => e.textContent)));
await p.screenshot({ path: `${out}/${tag}-form.png`, timeout: 240000 });
console.log('errors', errs.length, errs.slice(0, 6));
await b.close();
