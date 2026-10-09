// temp: axe-core WCAG 2.2 AA scan of every view of one variant
import { launch, BASE } from './_lib.mjs';
import { readFileSync } from 'node:fs';
const [page = 'a.html', theme = 'light'] = process.argv.slice(2);
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const b = await launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 }, colorScheme: theme });
await p.goto(`${BASE}/${page}`); await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
const views = await p.evaluate(() => [...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v));
await p.addScriptTag({ content: AXE });
const all = {};
for (const v of views) {
  await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 4).map(n => n.target.join(' ') + (n.any[0] ? ' :: ' + n.any[0].message.slice(0, 110) : '')) })));
  r.forEach(x => { const k = x.id; all[k] = all[k] || { impact: x.impact, n: 0, views: [], t: [] }; all[k].n += x.n; all[k].views.push(v); all[k].t.push(...x.t); });
}
console.log(page, theme);
Object.entries(all).forEach(([k, x]) => { console.log(`${k} [${x.impact}] ×${x.n} views=${x.views.join(',')}`); [...new Set(x.t)].slice(0, 6).forEach(t => console.log('   ' + t)); });
await b.close();
