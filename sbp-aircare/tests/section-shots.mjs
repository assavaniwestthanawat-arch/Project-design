// Viewport screenshot of every <section id> of a page (design review / before-after comparisons).
// usage: node tests/section-shots.mjs <outDir> [page=a.html] [width=1366] [height=900] [theme=]
import { launch, BASE } from './_lib.mjs';
import { mkdirSync } from 'node:fs';
const [,, out, page = 'a.html', w = 1366, h = 900, theme = ''] = process.argv;
mkdirSync(out, { recursive: true });
const b = await launch(); const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(`${BASE}/${page}`); await p.waitForTimeout(2500);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 }).catch(() => {});   // r5 views
const tag = page.replace(/\W+/g, '_') + `_${w}`;
await p.screenshot({ path: `${out}/${tag}_00top.png`, timeout: 240000 });
const ids = await p.evaluate(() => [...document.querySelectorAll('section[id]')].map(s => s.id).filter(id => id !== 'top' || !document.getElementById('hero')));
let n = 1;
for (const id of ids) {
  // r5: scrollIntoView switches to the view the section belongs to
  await p.evaluate(id => { const de = document.documentElement; de.style.scrollBehavior = 'auto'; document.getElementById(id).scrollIntoView({ block: 'start' }); }, id);
  await p.waitForTimeout(400);
  await p.evaluate(id => { const el = document.getElementById(id); scrollTo(0, el.getBoundingClientRect().top + scrollY - 60); }, id);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${out}/${tag}_${String(n++).padStart(2, '0')}${id}.png`, timeout: 240000 });
}
console.log(JSON.stringify({ page, w: +w, sections: ids, errors: errs.length })); errs.slice(0, 10).forEach(e => console.log('  ' + e));
await b.close();
