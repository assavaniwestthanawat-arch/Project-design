// temp: walk every view of one variant, screenshot the top of each, exercise journey / hand-off / feedback
import { launch, BASE } from './_lib.mjs';
const [v = 'a', W = '1366', H = '900', out = '/tmp/v5'] = process.argv.slice(2);
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const t0 = Date.now();
await p.goto(`${BASE}/${v}.html`); await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
console.log('mounted ms', Date.now() - t0);
await p.waitForTimeout(1500);
const shot = async n => p.screenshot({ path: `${out}/${v}-${W}-${n}.png`, timeout: 180000 });
await shot('home');
await p.evaluate(() => document.getElementById('start').scrollIntoView()); await p.waitForTimeout(800); await shot('start'); await p.evaluate(() => scrollTo(0, 0));
const views = await p.evaluate(() => [...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v));
console.log('views', views.join(','));
for (const vw of views) {
  await p.evaluate(vw => { location.hash = vw; }, vw); await p.waitForTimeout(2500);
  const info = await p.evaluate(() => ({ view: document.documentElement.dataset.sxView, vis: [...document.querySelectorAll('[data-sx]')].filter(e => !e.hidden).map(e => e.id || e.className).join(' '), ox: document.documentElement.scrollWidth > innerWidth, H: document.body.scrollHeight, title: document.title }));
  console.log(vw, JSON.stringify(info));
  await shot(vw);
}
// journey: home → first intent card
await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(800);
await p.click('.sx-int >> nth=0'); await p.waitForTimeout(2500);
console.log('journey', await p.evaluate(() => ({ view: document.documentElement.dataset.sxView, strip: !!document.querySelector('.sx-js:not([hidden]) .sx-jsi'), here: document.querySelector('.sx-here:not([hidden])')?.textContent, store: localStorage.getItem('sbp-journey-v1') })));
await shot('journey');
await p.click('.sx-here .s-btn'); await p.waitForTimeout(2500);
console.log('journey2', await p.evaluate(() => ({ view: document.documentElement.dataset.sxView, here: document.querySelector('.sx-here:not([hidden])')?.textContent, hash: location.hash })));
await shot('journey2');
// hand-off
await p.evaluate(() => { location.hash = 'quote'; }); await p.waitForTimeout(1500);
await p.fill('#qform input[required] >> nth=0', 'ทดสอบ'); await p.fill('#qform input[required] >> nth=1', '0812345678');
await p.click('#qform button[type=submit], #qform button:not([type])'); await p.waitForTimeout(1200);
console.log('handoff', await p.evaluate(() => { const x = document.querySelector('.sx-qout .s-hand'); return x ? x.querySelector('textarea').value.slice(0, 160) : null; }));
await shot('handoff');
// feedback
await p.click('.sx-beta .sx-fbb'); await p.waitForTimeout(500);
await p.click('.sx-rad label >> nth=4'); await p.click('.sx-fbf button[type=submit]'); await p.waitForTimeout(500);
console.log('feedback', await p.evaluate(() => !!document.querySelector('.sx-dlg .s-hand')));
await shot('feedback');
await p.keyboard.press('Escape');
// back button
await p.goBack(); await p.waitForTimeout(800); console.log('back→', await p.evaluate(() => [location.hash, document.documentElement.dataset.sxView]));
console.log('errors', errs.length, errs.slice(0, 8));
await b.close();
