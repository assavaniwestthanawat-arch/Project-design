// r20 · poster stills for the hero 3D of A / B / C on phones (assets/posters/hero-<v>.webp, transparent background).
// Phones show the poster first and start the live 3D after a tap on it or a calm moment (proto-ui mountViewer phoneDefer),
// so the poster must match the first frame: phone layout, reduced motion (no auto-rotate), labels and controls hidden.
// usage (dev server on :8765): node tools/heroposters.mjs [a b c]   → then build embeds them as data URIs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BASE || 'http://localhost:8765';
const PAGES = { a: { sel: '#hero3d [data-v-canvas]', scheme: 'light' }, b: { sel: '#hero3d [data-v-canvas]', scheme: 'light' }, c: { sel: '#top [data-v-canvas]', scheme: 'dark' } };
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PAGES);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const v of want) {
  const P = PAGES[v];
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: P.scheme, reducedMotion: 'reduce' });
  await p.goto(`${BASE}/${v}.html`);
  await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
  // start the deferred 3D at once (a tap on the stage does the same for a visitor)
  await p.evaluate(sel => document.querySelector(sel).closest('[data-v-canvas]').parentElement.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), P.sel);
  await p.waitForFunction(sel => { const c = document.querySelector(sel + ' > canvas'); return c && !/opacity: 0/.test(c.getAttribute('style') || ''); }, P.sel, { timeout: 180000 });
  await p.waitForTimeout(6000);
  // only the canvas: everything else (labels, controls, headline over the stage, fixed bars) hidden, backgrounds transparent
  await p.addStyleTag({ content: `html,body,body *{background:transparent!important;box-shadow:none!important}body *{visibility:hidden!important}${P.sel} > canvas{visibility:visible!important}${P.sel}::before,${P.sel}::after{display:none!important}` });
  await p.waitForTimeout(1500);
  const png = path.join(ROOT, 'assets', 'posters', `hero-${v}.png`), webp = png.replace(/\.png$/, '.webp');
  await p.locator(P.sel + ' > canvas').screenshot({ path: png, omitBackground: true, timeout: 120000 });
  execFileSync('python3', ['-c', 'import sys; from PIL import Image; im = Image.open(sys.argv[1]); im.save(sys.argv[2], "WEBP", quality=82, method=6); import os; os.remove(sys.argv[1])', png, webp]);
  console.log(v, webp);
  await p.close();
}
await b.close();
