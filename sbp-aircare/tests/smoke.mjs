// Console/page errors + canvas + WebGL contexts (live at the end / peak while scrolling / created) after scrolling the whole page.
// Rev.09: contexts are counted by wrapping getContext (the old count created contexts on canvases that never booted).
// usage: node tests/smoke.mjs [page=a.html] [width=1366] [height=900]
//   pages: a.html b.html c.html (multi-file dev) or dist/offline/a.html (built single file)
import { launch, BASE, scrollAll } from './_lib.mjs';
const [,, page = 'a.html', w = 1366, h = 900] = process.argv;
const b = await launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
// count real WebGL contexts the page creates, and how many are live (created − lost + restored), without creating any
// live WebGL contexts: a context stops counting the moment loseContext() is called on it (the context is lost at once;
// only the 'webglcontextlost' event is queued, and on swiftshader it can arrive seconds later) or when a real loss fires
await p.addInitScript(() => {
  const S = window.__glStat = { created: 0, live: 0, peak: 0 };
  const lost = c => { if (c.__glc === 1) { c.__glc = 2; S.live--; } };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const ctx = orig.call(this, type, ...a);
    if (ctx && /webgl/.test(type) && !this.__glc) {
      this.__glc = 1; S.created++; S.live++; S.peak = Math.max(S.peak, S.live);
      this.addEventListener('webglcontextlost', () => lost(this));
      this.addEventListener('webglcontextrestored', () => { if (this.__glc === 2) { this.__glc = 1; S.live++; S.peak = Math.max(S.peak, S.live); } });
    }
    return ctx;
  };
  [window.WebGLRenderingContext, window.WebGL2RenderingContext].forEach(C => {
    if (!C) return; const ge = C.prototype.getExtension;
    C.prototype.getExtension = function (name) {
      const ext = ge.call(this, name);
      if (ext && name === 'WEBGL_lose_context' && !ext.__w) { const cv = this.canvas, lc = ext.loseContext; ext.__w = 1; ext.loseContext = function () { lost(cv); return lc.call(this); }; }
      return ext;
    };
  });
});
await p.goto(`${BASE}/${page}`); await p.waitForTimeout(3000);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on') || document.querySelector('.jc-on') || document.documentElement.classList.contains('v2-on'), null, { timeout: 120000 }).catch(() => {});   // r5: views are built at the end of the page script · r10: แบบ D is one page (job card = ready)
// Rev.09 r5: the page is split into views (site.js) — visit every view and scroll it, so every section and 3D scene boots once
const views = await p.evaluate(() => [...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v));
let H = 0;
for (const v of views.length ? views : [null]) {
  if (v) { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(1200); }
  H += await scrollAll(p);
}
// r10 แบบ D: the 3D tools load only on request — press each "open" button once
for (const btn of ['#b3dClean', '#bFit']) {
  if (!(await p.$(btn))) continue;
  await p.evaluate(s => { const b = document.querySelector(s); b.scrollIntoView({ block: 'center' }); b.click(); }, btn); await p.waitForTimeout(8000);
}
// r8: switch the AC type in every 3D module (a broken switch used to leave the crew scene half-built with page errors)
const TYPE_RE = 'ติดผนัง|แขวน|สี่ทิศ|ตู้ตั้ง|ตั้งพื้น';
for (const root of ['#howRoot', '#edRoot', '#servicesRoot', '#cleanRoot', '#installRoot', '#fitRoot', '#d3dClean', '#dFit', '#v3dClean', '#vFit']) {   // r11: v2 editions use #v3dClean / #vFit · r13: v3 #installRoot
  const n = await p.evaluate(r => { const el = document.querySelector(r); if (!el) return 0; el.scrollIntoView(); return 1; }, root); if (!n) continue;
  await p.waitForTimeout(1500);
  await p.evaluate(r => { const el = document.querySelector(r); scrollTo(0, el.getBoundingClientRect().top + scrollY - 80); }, root); await p.waitForTimeout(2500);
  const k = await p.evaluate(([r, re]) => [...document.querySelectorAll(r + ' button')].filter(b => new RegExp(re).test(b.textContent) && b.offsetParent).length, [root, TYPE_RE]);
  for (let i = 0; i < k; i++) { await p.evaluate(([r, re, i]) => { const b = [...document.querySelectorAll(r + ' button')].filter(x => new RegExp(re).test(x.textContent) && x.offsetParent)[i]; b && b.click(); }, [root, TYPE_RE, i]); await p.waitForTimeout(900); }
}
await p.waitForTimeout(2000);
const r = await p.evaluate(() => { const g = window.__glStat; return { canvases: document.querySelectorAll('canvas').length, webgl: g.live, webglPeak: g.peak, webglCreated: g.created, overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
console.log(JSON.stringify({ page, w: +w, views: views.length, height: H, ...r, errors: errs.length }));
errs.slice(0, 25).forEach(e => console.log('  ' + e));
await b.close(); process.exit(errs.length || r.overflowX ? 1 : 0);
