// temp: axe-core WCAG 2.2 AA scan of a single-page edition after every section has mounted (r16 A2–D2)
import { launch, BASE } from './_lib.mjs';
import { readFileSync } from 'node:fs';
const [page = 'a2.html', w = 1366] = process.argv.slice(2);
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const b = await launch(); const p = await b.newPage({ viewport: { width: +w, height: +w < 600 ? 844 : 900 } });
await p.goto(`${BASE}/${page}`); await p.waitForFunction(() => document.documentElement.classList.contains('film-on'), null, { timeout: 120000 });
// mount every lazy part: walk the page
let H = await p.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < H; y += 800) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(350); H = await p.evaluate(() => document.body.scrollHeight); }
await p.waitForTimeout(3000);
await p.addScriptTag({ content: AXE });
const r = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 5).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) })));
console.log(page, w, r.length ? '' : 'axe 0 violations');
r.forEach(x => { console.log(`${x.id} [${x.impact}] ×${x.n}`); x.t.forEach(t => console.log('   ' + t.slice(0, 260))); });
await b.close();
