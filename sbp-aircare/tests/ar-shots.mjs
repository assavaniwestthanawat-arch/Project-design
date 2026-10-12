// Rev.11 AR screenshots for a visual check (tests/out/ar-*.png): the AR entry in the product panel and, with the WebXR stand-in,
// the camera view with its Thai controls (the body is drawn over a plain "wall" picture — a real phone shows its camera).
// usage: node tests/ar-shots.mjs <a|b|c> [width=1366] [light|dark] [none|ql|xr] [ติดผนัง|แขวนใต้ฝ้า|สี่ทิศทาง|ตู้ตั้งพื้น]
import { mkdirSync } from 'node:fs';
import { launch, BASE } from './_lib.mjs';
import { QL_MOCK, XR_MOCK, openModel } from './ar-mock.mjs';
const [pg = 'c', w = '1366', scheme = 'light', mode = 'none', typeTh = 'ติดผนัง'] = process.argv.slice(2);
const mob = +w < 600, tag = `${pg}-${w}-${scheme}-${mode}-${{ 'ติดผนัง': 'wall', 'แขวนใต้ฝ้า': 'ceiling', 'สี่ทิศทาง': 'cassette', 'ตู้ตั้งพื้น': 'floor' }[typeTh] || 'x'}`;
mkdirSync('tests/out', { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: +w, height: mob ? 844 : 900 }, colorScheme: scheme, isMobile: mob, hasTouch: mob, acceptDownloads: true });
if (mode === 'ql') await ctx.addInitScript(QL_MOCK);
if (mode === 'xr') await ctx.addInitScript(XR_MOCK);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|context lost/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
await p.goto(`${BASE}/${pg}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
await p.waitForTimeout(800);
await openModel(p, typeTh);
await p.evaluate(() => document.querySelector('#drawerBody .m3d').scrollIntoView({ block: 'start' }));
await p.waitForTimeout(500);
await p.screenshot({ path: `tests/out/ar-${tag}-panel.png`, timeout: 180000 });
if (mode === 'xr') {
  await p.click('#drawerBody .ar-go');
  await p.waitForSelector('.ar-xr:not(.wait)', { timeout: 60000 });
  await p.evaluate(() => { window.__xr.surface = 'floor'; }); await p.waitForTimeout(500);   // the camera sees the floor first: heights become known
  const surf = { 'ติดผนัง': 'wall', 'แขวนใต้ฝ้า': 'ceiling', 'สี่ทิศทาง': 'ceiling', 'ตู้ตั้งพื้น': 'floor' }[typeTh] || 'wall';
  await p.evaluate(s => { window.__xr.surface = s; }, surf);
  await p.waitForFunction(() => /พบ/.test(document.querySelector('.ar-xr-s')?.textContent || ''), null, { timeout: 60000 });
  // stand-in camera picture: a pale wall over a floor, the renderer's canvas on it, the overlay above
  const show = async name => {
    await p.evaluate(() => {
      let bg = document.getElementById('ar-test-cam');
      if (!bg) { bg = document.createElement('div'); bg.id = 'ar-test-cam'; bg.style.cssText = 'position:fixed;inset:0;z-index:2147482990;background:linear-gradient(#d9d4cb 0 62%,#9c8b78 62% 100%)'; document.body.append(bg); }
      const cv = window.__xr.canvas; if (cv && cv.parentNode !== bg) { cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; bg.append(cv); }
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `tests/out/ar-${tag}-${name}.png`, timeout: 180000 });
  };
  await show('xr-aim');
  await p.click('.ar-xr [data-a=place]'); await p.waitForTimeout(400);
  await show('xr-placed');
  console.log(JSON.stringify(await p.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.height)]; }; return { vh: innerHeight, ov: r('.ar-xr'), top: r('.ar-xr-top'), bot: r('.ar-xr-bot'), body: getComputedStyle(document.body).transform, fs: getComputedStyle(document.querySelector('.ar-xr')).fontSize }; })));
  await p.click('.ar-xr [data-a=close]'); await p.waitForTimeout(400);
}
console.log(JSON.stringify({ tag, errs }));
await b.close();
