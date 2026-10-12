// Rev.11 วางบนผนังบ้านคุณ — browser flow of the AR entry in the product panel (ar.js), with stand-ins for what headless Chromium lacks:
//   none   no AR in this browser → no button at all, one line saying where it works; "ดูรุ่นนี้แบบ 3 มิติ" stays — also on a desktop
//          that knows rel="ar" (macOS Safari previews, it has no camera AR) and in an in-app browser (LINE) even with WebXR
//   ql     AR Quick Look (iPhone / iPad Safari, mocked relList.supports('ar')) → the button makes a USDZ in the page and clicks an
//          <a rel="ar"> holding an <img> whose href is a blob: URL (#allowsContentScaling=0); the file is a real USDZ with the right
//          alignment; the Quick Look banner button books this model
//   xr     WebXR immersive-ar (Android Chrome, mocked navigator.xr) → requestSession with hit-test (+ dom-overlay); Thai controls
//          วาง / หมุน / ย้าย / ปิด follow the surface the camera sees; a denied camera says so; ending releases the hit-test source and
//          the WebGL context; the overlay's booking button books this model
//   axe WCAG 2.2 AA on the AR block and on the camera overlay
// usage: node tests/ar-flow.mjs <a|b|c> [width=1366] [light|dark]      prints "RESULT {json}"; exit 1 when any check fails
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { launch, BASE } from './_lib.mjs';
import { QL_MOCK, XR_MOCK, openModel } from './ar-mock.mjs';
const [pg = 'c', w = '1366', scheme = 'light'] = process.argv.slice(2);
const mob = +w < 600;
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const FINE = 'แบบจำลองเพื่ออธิบาย · ตัวเครื่องจริงแตกต่างตามรุ่น · ไม่มีโลโก้แบรนด์';
const res = [], errs = [];
const ok = (name, pass, info) => { res.push({ name, pass: !!pass, ...(info === undefined ? {} : { info }) }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${info === undefined ? '' : ' ' + JSON.stringify(info)}`); };

const b = await launch();
const LINE_UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Line/14.16.1/IAB';
async function open(mock, typeTh) {
  const ctx = await b.newContext({ viewport: { width: +w, height: mob ? 844 : 900 }, colorScheme: scheme, isMobile: mob, hasTouch: mob, acceptDownloads: true, ...(mock === 'xr-line' ? { userAgent: LINE_UA } : {}) });
  if (mock === 'ql') await ctx.addInitScript(QL_MOCK);
  if (mock === 'xr' || mock === 'xr-line') await ctx.addInitScript(XR_MOCK);
  if (mock === 'rel-only') await ctx.addInitScript(() => { const sup = DOMTokenList.prototype.supports; DOMTokenList.prototype.supports = function (t) { return t === 'ar' ? true : sup.call(this, t); }; });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`${mock}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|context lost|ERR_FILE_NOT_FOUND|favicon/i.test(m.text())) errs.push(`${mock}: ${m.text().slice(0, 200)}`); });
  await p.goto(`${BASE}/${pg}.html`);
  await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 });
  await p.waitForTimeout(600);
  await openModel(p, typeTh);
  // the booking request that a "ขอนัดติดตั้งรุ่นนี้" button sends (contact.requestBooking → cancelable 'sbp:book'); recorded, not cancelled
  await p.evaluate(() => document.addEventListener('sbp:book', e => { document.documentElement.dataset.arTestBook = JSON.stringify(e.detail); }, true));
  return { ctx, p };
}
const arState = p => p.evaluate(() => {
  const r = document.querySelector('#drawerBody .ar'), btn = r.querySelector('.ar-go'), vis = e => !!e && !e.hidden && e.getClientRects().length > 0;
  const bb = btn.getBoundingClientRect();
  return { mode: r.dataset.ar, btn: vis(btn), label: btn.textContent.trim(), h: Math.round(bb.height), hint: vis(r.querySelector('.ar-hint')) ? r.querySelector('.ar-hint').textContent.trim() : '',
    info: vis(r.querySelector('.ar-info')) ? r.querySelector('.ar-info').textContent.replace(/\s+/g, ' ').trim() : '', m3d: !!document.querySelector('#drawerBody .m3d-open'),
    focusable: [...r.querySelectorAll('button, a[href], [tabindex]')].filter(e => vis(e) && e.tabIndex >= 0).length };
});
async function axeOn(p, sel, name) {
  await p.waitForTimeout(900);   // the product panel slides / fades in: measure contrast once it has settled
  await p.addScriptTag({ content: AXE });
  const v = await p.evaluate(async sel => (await axe.run({ include: [[sel]] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] }))
    .violations.filter(x => !['region', 'landmark-one-main', 'page-has-heading-one'].includes(x.id)).map(x => `${x.id}: ${x.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')}`), sel);
  ok(`axe ${name}`, v.length === 0, v.length ? v : undefined);
}
const booked = p => p.evaluate(() => { try { return JSON.parse(document.documentElement.dataset.arTestBook || 'null'); } catch (_) { return null; } });

// ---- 1. no AR here: no dead button, one line saying where it works --------------------------------------------------------------
{
  const { ctx, p } = await open('none', 'ติดผนัง');
  const s = await arState(p);
  ok('none: support detected as none', s.mode === 'none', s.mode);
  ok('none: no AR button shown', !s.btn && s.focusable === 0);
  ok('none: one line says where it works', /iPhone/.test(s.hint) && /Android/.test(s.hint) && /เพื่อวางบนผนังจริง/.test(s.hint), s.hint);
  ok('none: 3D viewer button stays', s.m3d);
  await axeOn(p, '#drawerBody .m3d', 'none: AR block');
  await ctx.close();
}
for (const [mock, re, what] of [['rel-only', /iPhone|Safari/, 'desktop that knows rel="ar" (macOS Safari)'], ['xr-line', /เปิดลิงก์นี้ใน Safari หรือ Chrome/, 'LINE in-app browser']]) {
  const { ctx, p } = await open(mock, 'ติดผนัง');
  const s = await arState(p);
  ok(`${mock}: ${what} → no button, one line`, s.mode === 'none' && !s.btn && re.test(s.hint), s.hint);
  await ctx.close();
}

// ---- 2. AR Quick Look (iPhone / iPad) ---------------------------------------------------------------------------------------------
for (const [typeTh, align, label] of [['ติดผนัง', 'vertical', 'วางบนผนังบ้านคุณ'], ['สี่ทิศทาง', 'horizontal', 'ดูขนาดจริงในห้องคุณ']]) {
  const { ctx, p } = await open('ql', typeTh);
  const s = await arState(p);
  ok(`ql ${typeTh}: support detected as quicklook`, s.mode === 'quicklook', s.mode);
  ok(`ql ${typeTh}: button "${label}"`, s.btn && s.label === label, s.label);
  if (mob) ok(`ql ${typeTh}: touch target ≥ 44 px`, s.h >= 44, s.h);
  ok(`ql ${typeTh}: size label from the spec or the type`, /^(ขนาดตามสเปก|ขนาดทั่วไปของประเภทนี้)/.test(s.info) && /กว้าง [\d.]+ × สูง [\d.]+ × ลึก [\d.]+ ซม\./.test(s.info), s.info.slice(0, 90));
  ok(`ql ${typeTh}: illustrative / no logo line`, s.info.includes(FINE));
  ok(`ql ${typeTh}: real size locked`, s.info.includes('ขนาดล็อกไว้ตามจริง'));
  if (typeTh === 'สี่ทิศทาง') ok('ql cassette: says Quick Look has no ceiling, stands it on the floor', /วางแบบจำลองบนฝ้าไม่ได้/.test(s.info) && /ไม่รวมหน้ากาก/.test(s.info));
  if (!mob) await axeOn(p, '#drawerBody .m3d', `ql ${typeTh}: AR block`);
  // Chromium has no Quick Look: the rel="ar" anchor's download attribute (needed for a blob: model) saves the file instead
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 90000 }), p.click('#drawerBody .ar-go')]);
  const a = await p.evaluate(() => { const a = document.querySelector('#drawerBody a.ar-ql'); return a && { rel: a.rel, href: a.getAttribute('href'), img: a.firstElementChild && a.firstElementChild.tagName, dl: a.getAttribute('download') }; });
  ok(`ql ${typeTh}: <a rel="ar"> with an <img> child`, a && a.rel === 'ar' && a.img === 'IMG', a && { rel: a.rel, img: a.img });
  ok(`ql ${typeTh}: blob: USDZ, scaling off, booking banner`, a && /^blob:/.test(a.href) && a.href.includes('#allowsContentScaling=0') && a.href.includes('callToAction=') && /\.usdz$/.test(a.dl), a && a.href.replace(/^blob:[^#]*/, 'blob:…').slice(0, 120));
  const buf = readFileSync(await dl.path()), txt = buf.toString('latin1');
  ok(`ql ${typeTh}: the file is a USDZ (zip, model.usda first, ${align} anchoring)`, buf[0] === 0x50 && buf[1] === 0x4b && txt.slice(30, 40) === 'model.usda' && txt.includes(`preliminary:planeAnchoring:alignment = "${align}"`) && txt.includes('metersPerUnit = 1'), { kb: Math.round(buf.length / 1024), name: dl.suggestedFilename() });
  // the Quick Look banner button ("ขอนัดติดตั้งรุ่นนี้") arrives as a message event on the anchor
  await p.evaluate(() => document.querySelector('#drawerBody a.ar-ql').dispatchEvent(new MessageEvent('message', { data: '_apple_ar_quicklook_button_tapped' })));
  await p.waitForTimeout(800);
  const bk = await booked(p);
  ok(`ql ${typeTh}: banner button books this model`, bk && bk.service === 'install' && Object.values(bk.units || {})[0] === 1 && /ขนาดจริงผ่านกล้องมือถือ/.test(bk.notes || ''), bk && { service: bk.service, units: bk.units, notes: (bk.notes || '').slice(0, 60) });
  await ctx.close();
}

// ---- 3. WebXR immersive-ar (Android Chrome) — wall unit ------------------------------------------------------------------------------
{
  const { ctx, p } = await open('xr', 'ติดผนัง');
  const s = await arState(p);
  ok('xr wall: support detected as webxr', s.mode === 'webxr', s.mode);
  ok('xr wall: button "วางบนผนังบ้านคุณ"', s.btn && s.label === 'วางบนผนังบ้านคุณ', s.label);
  ok('xr wall: tip tells how', /อนุญาตให้ใช้กล้อง/.test(s.info) && /ส่องผนัง/.test(s.info), s.info.slice(0, 120));
  // a denied camera: said plainly, nothing left open
  await p.evaluate(() => { window.__xr.reject = 'NotAllowedError'; });
  await p.click('#drawerBody .ar-go');
  await p.waitForFunction(() => /ไม่ได้รับอนุญาตให้ใช้กล้อง/.test(document.querySelector('#drawerBody .ar-msg').textContent), null, { timeout: 30000 }).catch(() => {});
  const den = await p.evaluate(() => ({ msg: document.querySelector('#drawerBody .ar-msg').textContent, ov: !!document.querySelector('.ar-xr'), busy: document.querySelector('#drawerBody .ar-go').getAttribute('aria-busy') }));
  ok('xr: denied camera → Thai message, overlay gone, button usable', /ไม่ได้รับอนุญาตให้ใช้กล้อง/.test(den.msg) && !den.ov && den.busy == null, den);
  await p.evaluate(() => { window.__xr.reject = null; window.__xr.calls = []; });
  // the session
  await p.click('#drawerBody .ar-go');
  await p.waitForSelector('.ar-xr:not(.wait)', { timeout: 60000 });
  const call = await p.evaluate(() => window.__xr.calls[0]);
  ok('xr: requestSession("immersive-ar") requires hit-test', call && call.mode === 'immersive-ar' && call.required.includes('hit-test'), call);
  ok('xr: dom-overlay asked as optional, with the Thai controls as its root', call && call.optional.includes('dom-overlay') && call.overlay);
  const ov = await p.evaluate(() => { const e = document.querySelector('.ar-xr'); return { role: e.getAttribute('role'), modal: e.getAttribute('aria-modal'), label: e.getAttribute('aria-label'), btns: [...e.querySelectorAll('.ar-xr-b button')].map(b => b.textContent), dims: e.querySelector('.ar-xr-d').textContent, fine: e.querySelector('.ar-xr-f').textContent, focus: e.contains(document.activeElement) }; });
  ok('xr: overlay is a labelled modal dialog holding focus', ov.role === 'dialog' && ov.modal === 'true' && !!ov.label && ov.focus, ov.label);
  ok('xr: buttons วาง / หมุน / ย้าย / ปิด', ov.btns.join('/') === 'วาง/หมุน/ย้าย/ปิด', ov.btns);
  ok('xr: size shown (กว้าง × สูง × ลึก ซม.) with its source', /^(ขนาดตามสเปก|ขนาดทั่วไปของประเภทนี้) กว้าง [\d.]+ × สูง [\d.]+ × ลึก [\d.]+ ซม\.$/.test(ov.dims.replace(/\s+/g, ' ').trim()), ov.dims);
  ok('xr: illustrative / no logo line over the camera', ov.fine.replace(/\s+/g, ' ').includes(FINE));
  const st = () => p.evaluate(() => { const e = document.querySelector('.ar-xr'), q = a => e.querySelector(`[data-a=${a}]`); return { s: e.querySelector('.ar-xr-s').textContent, h: e.querySelector('.ar-xr-h').hidden ? '' : e.querySelector('.ar-xr-h').textContent, place: !q('place').disabled, turn: !q('turn').disabled, move: !q('move').disabled, book: !e.querySelector('.ar-xr-book').hidden }; });
  const until = re => p.waitForFunction(re => new RegExp(re).test(document.querySelector('.ar-xr .ar-xr-s').textContent), re.source, { timeout: 30000 }).catch(() => {});
  // the camera sees the floor first: a wall unit cannot go there; the floor becomes the height reference
  await p.evaluate(() => { window.__xr.surface = 'floor'; }); await until(/ตรงนี้เป็นพื้น/);
  let x = await st();
  ok('xr wall: floor under the reticle → says so, วาง off', /ตรงนี้เป็นพื้น/.test(x.s) && /ต้องวางบนผนัง/.test(x.s) && !x.place, x);
  await p.evaluate(() => { window.__xr.surface = 'wall'; }); await until(/พบผนังแล้ว/);
  x = await st();
  ok('xr wall: wall found → วาง on, หมุน off (flush on the wall)', /พบผนังแล้ว/.test(x.s) && x.place && !x.turn && !x.move, x);
  ok('xr wall: bottom-edge height as an estimate with the general guide', /ขอบล่างสูงจากพื้นประมาณ [\d.]+ ม\./.test(x.h) && /ค่าประมาณจากกล้อง/.test(x.h) && /ค่าแนะนำทั่วไป/.test(x.h), x.h);
  if (!mob) await axeOn(p, '.ar-xr', 'xr: camera overlay');
  await p.click('.ar-xr [data-a=place]'); await until(/วางแล้ว/);
  x = await st();
  ok('xr wall: วาง → placed, ย้าย on, booking button shown', /วางแล้ว/.test(x.s) && x.move && x.book && !x.place, x);
  await p.click('.ar-xr [data-a=move]'); await until(/พบผนังแล้ว/);
  x = await st();
  ok('xr wall: ย้าย → aiming again', /พบผนังแล้ว/.test(x.s) && x.place && !x.book, x);
  await p.evaluate(() => { window.__xr.surface = null; }); await until(/ส่องกล้องไปที่ผนัง/);
  ok('xr wall: nothing found → aiming hint', /ส่องกล้องไปที่ผนัง/.test((await st()).s));
  await p.evaluate(() => { window.__xr.surface = 'wall'; }); await until(/พบผนังแล้ว/);
  // Esc ends everything
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => !document.querySelector('.ar-xr'), null, { timeout: 30000 }).catch(() => {});
  const end = await p.evaluate(() => { const c = window.__xr.canvas, g = c && (c.getContext('webgl2') || c.getContext('webgl')); return { ended: window.__xr.ended, cancelled: window.__xr.cancelled, ov: !!document.querySelector('.ar-xr'), lost: !g || g.isContextLost(), focus: document.activeElement === document.querySelector('#drawerBody .ar-go'), msg: document.querySelector('#drawerBody .ar-msg').textContent }; });
  ok('xr: Esc ends the session, overlay removed, focus back on the button', end.ended === 1 && !end.ov && end.focus, end);
  ok('xr: hit-test source cancelled, WebGL context released', end.cancelled && end.lost, end);
  // book from the camera view
  await p.click('#drawerBody .ar-go');
  await p.waitForSelector('.ar-xr:not(.wait)', { timeout: 60000 });
  await until(/พบผนังแล้ว/);
  await p.click('.ar-xr [data-a=place]'); await until(/วางแล้ว/);
  await p.click('.ar-xr .ar-xr-book');
  await p.waitForTimeout(1200);
  const bk = await booked(p), gone = await p.evaluate(() => ({ ov: !!document.querySelector('.ar-xr'), ended: window.__xr.ended }));
  ok('xr: ขอนัดติดตั้งรุ่นนี้ ends the session and books this model', bk && bk.service === 'install' && bk.units && bk.units.wall === 1 && !gone.ov && gone.ended === 2, { bk: bk && { units: bk.units, notes: (bk.notes || '').slice(0, 70) }, gone });
  await ctx.close();
}

// ---- 4. WebXR — floor-standing unit: stands on the floor, turns 15° a tap -------------------------------------------------------------
{
  const { ctx, p } = await open('xr', 'ตู้ตั้งพื้น');
  const s = await arState(p);
  ok('xr floor: button "ตั้งในห้องบ้านคุณ"', s.btn && s.label === 'ตั้งในห้องบ้านคุณ', s.label);
  await p.evaluate(() => { window.__xr.surface = 'floor'; });
  await p.click('#drawerBody .ar-go');
  await p.waitForSelector('.ar-xr:not(.wait)', { timeout: 60000 });
  await p.waitForFunction(() => /พบพื้นแล้ว/.test(document.querySelector('.ar-xr .ar-xr-s').textContent), null, { timeout: 30000 }).catch(() => {});
  const x = await p.evaluate(() => { const e = document.querySelector('.ar-xr'); return { s: e.querySelector('.ar-xr-s').textContent, turn: !e.querySelector('[data-a=turn]').disabled, h: e.querySelector('.ar-xr-h').hidden }; });
  ok('xr floor: floor found → หมุน on, no height line', /พบพื้นแล้ว/.test(x.s) && x.turn && x.h, x);
  await p.click('.ar-xr [data-a=turn]'); await p.click('.ar-xr [data-a=place]');
  await p.waitForFunction(() => /วางแล้ว/.test(document.querySelector('.ar-xr .ar-xr-s').textContent), null, { timeout: 30000 }).catch(() => {});
  const y = await p.evaluate(() => document.querySelector('.ar-xr .ar-xr-s').textContent);
  ok('xr floor: placed, หมุน still offered', /วางแล้ว/.test(y) && /หมุน/.test(y), y);
  await p.click('.ar-xr [data-a=close]');
  await p.waitForFunction(() => !document.querySelector('.ar-xr'), null, { timeout: 30000 }).catch(() => {});
  ok('xr floor: ปิด ends the session', await p.evaluate(() => !document.querySelector('.ar-xr') && window.__xr.ended === 1));
  await ctx.close();
}

await b.close();
ok('no page errors', errs.length === 0, errs.length ? errs.slice(0, 6) : undefined);
const fail = res.filter(r => !r.pass);
console.log('RESULT ' + JSON.stringify({ test: 'ar-flow', page: pg, w: +w, scheme, checks: res.length, failed: fail.map(r => r.name), pass: !fail.length }));
process.exit(fail.length ? 1 : 0);
