// r15: smoothness + robustness of the 3D / animation tools. For each 3D root on a page: open it (its view), let it boot,
// then press every visible control in it once (type tabs, explode, x-ray, play, rooms, modes …, never cart/booking/links)
// and measure — the longest main-thread task while booting and while switching (a "stall"), frame pacing (rAF intervals:
// median, p95, share of frames > 50 ms), page errors, and WebGL objects (buffers / textures / programs) before and after a
// second pass over the same controls (growth = a leak). Headless WebGL is software (swiftshader): absolute frame times are
// slower than any phone GPU — compare modules with each other and before/after a change.
// usage: node tests/perf3d.mjs <page.html> [width=1366] [rootsCsv] [maxControls=14]   (BASE env or :8765)
import { launch, BASE } from './_lib.mjs';
const [,, page = 'a.html', W = 1366, rootsCsv = '', maxCtl = 10] = process.argv;
const ROOTS = rootsCsv ? rootsCsv.split(',') : ['#hero3d', '#top', '#journey', '#studioRoot', '#fitRoot', '#cleanRoot', '#installRoot', '#howRoot', '#servicesRoot', '#qualityRoot', '#storyStage', '#insideBox', '#mapRoot', '#askStage', '#srRoot', '#v3dClean', '#dFit', '#vFit'];
const SKIP = /ใบเสนอราคา|จอง|เพิ่ม|ส่ง|โทร|ติดต่อ|ให้ความเห็น|ค้นหา|เทียบ|ปิด|ซื้อ|สอบถาม|ดูราคา|รายละเอียด|เปิดหน้า|คัดลอก/;
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: +W < 600 ? 844 : 900 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160))); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
await p.addInitScript(() => {
  const P = window.__perf = { lt: [], fr: [], gl: { buf: 0, tex: 0, prog: 0, fb: 0 } };
  new PerformanceObserver(l => l.getEntries().forEach(e => P.lt.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true });
  let last = 0; const f = t => { if (last) P.fr.push([t, t - last]); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
  // GPU objects are counted per context; a context the pool released (WEBGL_lose_context) drops out of the sum and starts
  // from zero when restored — so growth between two passes is a real leak, not the pool re-uploading a scene
  const per = new Map(), cnt = gl => { let c = per.get(gl); if (!c) per.set(gl, c = { buf: 0, tex: 0, prog: 0, fb: 0, dead: false }); return c; };
  Object.defineProperty(P, 'gl', { get: () => { const s = { buf: 0, tex: 0, prog: 0, fb: 0, ctx: 0 }; per.forEach(c => { if (c.dead) return; s.ctx++; for (const k of ['buf', 'tex', 'prog', 'fb']) s[k] += c[k]; }); return s; } });
  const wrap = (C) => { if (!C) return; const pr = C.prototype; [['createBuffer', 'deleteBuffer', 'buf'], ['createTexture', 'deleteTexture', 'tex'], ['createProgram', 'deleteProgram', 'prog'], ['createFramebuffer', 'deleteFramebuffer', 'fb']].forEach(([c, d, k]) => { const oc = pr[c], od = pr[d]; pr[c] = function (...a) { const r = oc.apply(this, a); if (r) cnt(this)[k]++; return r; }; pr[d] = function (o) { if (o) cnt(this)[k]--; return od.call(this, o); }; });
    const ge = pr.getExtension; pr.getExtension = function (n) { const x = ge.call(this, n); if (x && n === 'WEBGL_lose_context' && !x.__w) { const gl = this, lo = x.loseContext.bind(x), re = x.restoreContext.bind(x); x.loseContext = () => { cnt(gl).dead = true; return lo(); }; x.restoreContext = () => { Object.assign(cnt(gl), { buf: 0, tex: 0, prog: 0, fb: 0, dead: false }); return re(); }; x.__w = 1; } return x; }; };
  wrap(window.WebGLRenderingContext); wrap(window.WebGL2RenderingContext);
});
await p.goto(`${BASE}/${page}`);
await p.waitForFunction(() => { const c = document.documentElement.classList; return c.contains('sx-on') || c.contains('v2-on') || c.contains('v3-on') || document.querySelector('.jc-on'); }, null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
const stat = (fr) => { const d = fr.map(x => x[1]).sort((a, z) => a - z); if (!d.length) return { n: 0 }; const q = k => Math.round(d[Math.min(d.length - 1, Math.floor(d.length * k))]); return { n: d.length, p50: q(0.5), p95: q(0.95), max: Math.round(d[d.length - 1]), slow: Math.round(100 * d.filter(x => x > 50).length / d.length) }; };
const window_ = async (t0) => p.evaluate(t0 => { const P = window.__perf; return { lt: P.lt.filter(x => x[0] >= t0), fr: P.fr.filter(x => x[0] >= t0), gl: { ...P.gl } }; }, t0);
const now = () => p.evaluate(() => performance.now());
const out = [];
for (const root of ROOTS) {
  const has = await p.evaluate(r => !!document.querySelector(r), root); if (!has) continue;
  const e0 = errs.length;
  // open its view and bring it on screen (site.js switches views on scrollIntoView)
  let t0 = await now();
  await p.evaluate(r => { const el = document.querySelector(r); el.scrollIntoView({ block: 'center' }); }, root);
  // D / v2: tools that load on a button press
  if (root === '#v3dClean' || root === '#dFit' || root === '#vFit') { const btn = { '#v3dClean': '#b3dClean', '#dFit': '#bFit', '#vFit': '#bFit' }[root]; await p.evaluate(s => document.querySelector(s)?.click(), btn); }
  await p.waitForTimeout(5000);
  const boot = await window_(t0);
  const ctl = async () => p.evaluate(([r, skip, max]) => {
    const el = document.querySelector(r); const re = new RegExp(skip);
    return [...el.querySelectorAll('button, [role="tab"], input[type="range"]')].filter(x => x.offsetParent && !x.disabled && !re.test(x.textContent || '') && !x.closest('a,[data-cart-btn]')).slice(0, max).length;
  }, [root, SKIP.source, +maxCtl]);
  const n = await ctl();
  const pass = async () => {
    for (let i = 0; i < n; i++) {
      await p.evaluate(([r, skip, max, i]) => {
        const el = document.querySelector(r); const re = new RegExp(skip);
        const xs = [...el.querySelectorAll('button, [role="tab"], input[type="range"]')].filter(x => x.offsetParent && !x.disabled && !re.test(x.textContent || '') && !x.closest('a,[data-cart-btn]')).slice(0, max);
        const x = xs[i]; if (!x) return;
        if (x.type === 'range') { x.value = String((+x.min + +x.max) / 2 + (i % 2 ? 0.1 : -0.1) * (+x.max - +x.min)); x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); }
        else x.click();
      }, [root, SKIP.source, +maxCtl, i]);
      await p.waitForTimeout(900);
    }
  };
  // pass 1 builds what the controls need (types, steps …) and is the one timed; pass 2 repeats it — anything the GPU holds more
  // after pass 2 than after pass 1 was built again without the old copy being freed (a leak)
  t0 = await now(); await pass(); const s1 = await window_(t0);
  const glA = (await window_(await now())).gl;
  await pass(); const glB = (await window_(await now())).gl;
  const lmax = a => a.length ? Math.round(Math.max(...a.map(x => x[1]))) : 0;
  const r = { root, controls: n, bootStall: lmax(boot.lt), bootFrames: stat(boot.fr), switchStall: lmax(s1.lt), switchLong: s1.lt.filter(x => x[1] > 200).length, frames: stat(s1.fr),
    glGrowth: { buf: glB.buf - glA.buf, tex: glB.tex - glA.tex, prog: glB.prog - glA.prog }, errors: errs.slice(e0, e0 + 3) };
  out.push(r); console.log(JSON.stringify(r));   // one line per root as it finishes (a long page still reports what it measured)
}
console.log(JSON.stringify({ page, W: +W, roots: out.length, errors: errs.length }));
await b.close();
