// r15: every catalogue model in 3D — opens the owner's test panel (perfhud.js) on a page and runs its "every model" walk:
// each of the 705 models is shown in the product-panel viewer (model3d.js → cinema3d) at its own size; the check fails when
// a model throws, builds the wrong type, or ends up with a non-finite / absurd size. Also reports build time per type.
// usage: node tests/models3d.mjs [page=a3.html] [limit=0 (all)]      (BASE env or :8765; swiftshader → minutes)
import { launch, BASE } from './_lib.mjs';
const [,, page = 'a3.html', limit = '0'] = process.argv;
const b = await launch(); const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
await p.goto(`${BASE}/${page}`);
await p.waitForTimeout(3000);
const out = await p.evaluate(async lim => {
  const core = await import('./assets/sbp-core.js'); await core.loadData();
  if (+lim) { let left = +lim; core.DEMO.models.forEach(m => { m.skus = left > 0 ? m.skus.slice(0, Math.max(0, Math.min(m.skus.length, left))) : []; left -= m.skus.length; }); core.DEMO.models = core.DEMO.models.filter(m => m.skus.length); }
  const { openPerfHud } = await import('./assets/perfhud.js');
  const P = openPerfHud({ variant: 'test' });
  await P.run.models();
  const R = P.results.models; if (!R) return { error: document.querySelector('.ph-status')?.textContent };
  const types = Object.fromEntries(Object.entries(R.byType).map(([k, t]) => [k, { n: t.n, ok: t.ok, spec: t.spec, avg: Math.round(t.ms.reduce((a, b) => a + b, 0) / t.ms.length), max: Math.round(Math.max(...t.ms)), bad: t.bad.slice(0, 5) }]));
  return { total: R.total, done: R.rows.length, ok: R.rows.filter(r => r.ok).length, types, status: document.querySelector('.ph-status')?.textContent };
}, limit);
console.log(JSON.stringify({ page, ...out, pageErrors: errs.slice(0, 5) }, null, 1));
await p.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
await b.close();
process.exit(out && out.ok === out.done && out.done > 0 && !errs.length ? 0 : 1);
