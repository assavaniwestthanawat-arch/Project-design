// axe-core WCAG 2.2 AA + best-practice on every view (site.js page) of one edition — r20 (was a scratch script since r6)
// usage: node tests/axe.mjs <a|b|c|…> [light|dark] [width=1366]      prints violations + "RESULT {json}"; exit 1 when any
import { launch, BASE } from './_lib.mjs';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const [pg = 'a', theme = 'light', w = '1366'] = process.argv.slice(2);
const page = pg.endsWith('.html') ? pg : pg + '.html';
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const mob = +w < 600;
const b = await launch(); const p = await b.newPage({ viewport: { width: +w, height: mob ? 844 : 900 }, colorScheme: theme, hasTouch: mob, isMobile: mob });
await p.goto(`${BASE}/${page}`); await p.waitForFunction(() => /sx-on|v3-on|sg-on/.test(document.documentElement.className + ' ' + document.body.className), null, { timeout: 120000 });
const views = await p.evaluate(() => [...new Set([...document.querySelectorAll('nav a[data-v]')].map(a => a.dataset.v))]);
await p.addScriptTag({ content: AXE });
const all = {};
for (const v of views.length ? views : ['']) {
  if (v) { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(2500); }
  const H = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < H; y += 900) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(250); }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] })).violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, t: x.nodes.slice(0, 4).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('').slice(0, 140)) })));
  r.forEach(x => { const k = x.id; all[k] = all[k] || { impact: x.impact, n: 0, views: [], t: [] }; all[k].n += x.n; all[k].views.push(v || 'page'); all[k].t.push(...x.t); });
}
Object.entries(all).forEach(([k, x]) => { console.log(`${k} [${x.impact}] ×${x.n} views=${x.views.join(',')}`); [...new Set(x.t)].slice(0, 6).forEach(t => console.log('   ' + t)); });
const n = Object.values(all).reduce((s, x) => s + x.n, 0);
console.log('RESULT ' + JSON.stringify({ test: 'axe', page: pg, theme, w: +w, views: views.length, rules: Object.keys(all), nodes: n, pass: n === 0 }));
await b.close();
process.exit(n ? 1 : 0);
