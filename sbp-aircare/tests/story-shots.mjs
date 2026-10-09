// Screenshot technician-story steps (variant C module) through test-ts.html.
// usage: node tests/story-shots.mjs <outPrefix> <C1|C2|install|repair> <steps e.g. 0,4,8> [w=1280] [h=900] [theme=light]
import { launch, BASE } from './_lib.mjs';
const [,, out, story, steps, w = 1280, h = 900, theme = 'light'] = process.argv;
const b = await launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`${BASE}/test-ts.html?theme=${theme}`);
await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
await p.evaluate(() => document.querySelector('.ts-stage').scrollIntoView());
await p.waitForFunction(() => window.TS._s3(), null, { timeout: 90000 });
if (story !== 'C1') await p.evaluate(s => [...document.querySelectorAll('.ts-tabs button')].find(x => x.textContent.includes({ C2: 'C2', install: 'ติดตั้ง', repair: 'ตรวจ' }[s])).click(), story);
for (const s of steps.split(',')) {
  await p.evaluate(i => { const S3 = window.TS._s3(); S3.go(i); S3.advance(9); }, +s);   // advance(sec) = fast-forward the animation
  await p.waitForTimeout(1800);
  await p.locator('#m').screenshot({ path: `${out}-${story}-${s}.png`, timeout: 240000 });
}
console.log(errs.length ? errs.join('\n') : 'ok'); await b.close();
