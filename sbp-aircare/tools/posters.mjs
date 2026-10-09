// r12 poster frames for the v2 editions: one still per hero stage (desktop + phone crop), rendered by the same engine
// (test-cinema.html) so the first paint shows the film before WebGL starts; the live canvas cross-fades over it.
// usage (dev server on :8765):  node tools/posters.mjs [a2 b2 c2 d2]   → assets/posters/<page>-hero.jpg, <page>-hero-m.jpg
// swiftshader is slow: ~20–40 s per frame.
import { launch } from '../tests/_lib.mjs';
const BASE = process.env.BASE || 'http://localhost:8765';
const JOBS = {
  a2: { mood: 'aurora', type: 'wall', d: [1600, 900, 0.3, 0.08], m: [780, 1500, 0, 0.22] },
  b2: { mood: 'tower', type: 'cassette', d: [1600, 900, 0, 0], m: [780, 1500, 0, 0] },
  c2: { mood: 'atelier', type: 'wall', d: [1000, 800, 0, 0], m: [900, 720, 0, 0] },
};
const pages = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOBS);
const b = await launch();
for (const k of pages) {
  const J = JOBS[k];
  for (const [suf, [w, h, fx, fy]] of [['', J.d], ['-m', J.m]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${BASE}/test-cinema.html?mood=${J.mood}&type=${J.type}&shot=hero&q=high&t=6${fx || fy ? `&fx=${fx}&fy=${fy}` : ''}`);
    await p.waitForFunction(() => window.READY, null, { timeout: 180000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `assets/posters/${k}-hero${suf}.jpg`, type: 'jpeg', quality: 70, timeout: 180000 });
    console.log(k + suf, w + '×' + h, errs.length ? errs : 'ok');
    await p.close();
  }
}
await b.close();
