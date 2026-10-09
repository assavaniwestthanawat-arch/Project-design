// Screenshot one section (or the top) of a page after its 3D scene settles; prints console errors.
// usage: node tests/shot.mjs <out.png> <page> [sectionId|-|@sectionId] [width=1366] [height=900] [theme=light] [waitMs=6000]
//   @sectionId = screenshot the whole section element instead of the viewport
import { launch, BASE } from './_lib.mjs';
const [,, out, page = 'a.html', id = '-', w = 1366, h = 900, theme = 'light', wait = 6000] = process.argv;
const b = await launch(); const p = await b.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
await p.goto(`${BASE}/${page}`); await p.waitForTimeout(2500);
const sid = id.replace(/^@/, '');
if (id !== '-') { await p.evaluate(id => { const el = document.getElementById(id); scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sid); }
await p.waitForTimeout(+wait);
if (id !== '-') { await p.evaluate(id => { const el = document.getElementById(id); scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, sid); await p.waitForTimeout(2500); }   // layout above may have grown
if (id.startsWith('@')) await p.locator('#' + sid).screenshot({ path: out, timeout: 240000 });
else await p.screenshot({ path: out, timeout: 240000 });
console.log(JSON.stringify({ page, id, errors: errs.length })); errs.slice(0, 12).forEach(e => console.log('  ' + e));
await b.close();
