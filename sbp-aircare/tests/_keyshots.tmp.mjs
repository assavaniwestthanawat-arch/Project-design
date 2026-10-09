// temp: viewport screenshots of chosen sections (view-aware), one browser for several pages
import { launch, BASE } from './_lib.mjs';
const [out, W = '1366', H = '900', ...jobs] = process.argv.slice(2);   // jobs: page:theme:id,id,id
const b = await launch();
for (const job of jobs) {
  const [page, theme, ids] = job.split(':');
  const p = await b.newPage({ viewport: { width: +W, height: +H }, colorScheme: theme });
  await p.goto(`${BASE}/${page}`); await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(2500);
  for (const id of ids.split(',')) {
    if (id === 'top') { await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(1500); await p.evaluate(() => scrollTo(0, 0)); }
    else if (id.startsWith('#')) { await p.evaluate(v => { location.hash = v; }, id.slice(1)); await p.waitForTimeout(1500); }
    else { await p.evaluate(id => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById(id).scrollIntoView({ block: 'start' }); }, id); await p.waitForTimeout(500); await p.evaluate(id => { const el = document.getElementById(id); scrollTo(0, el.getBoundingClientRect().top + scrollY - 60); }, id); }
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/${page.replace('.html', '')}_${W}_${id.replace('#', 'v-')}.png`, timeout: 240000 });
  }
  await p.close();
}
await b.close();
