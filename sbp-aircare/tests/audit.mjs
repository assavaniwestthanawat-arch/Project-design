// Measured audit per view (r18, moved into tests/ r20): sharpness (img / canvas backing store vs CSS px × DPR), text < 12 px,
// touch targets < 44 px (phones), clipped text, arrow/emoji glyphs used as icons, horizontal overflow.
// usage: node tests/audit.mjs <a|b|c> [width=1366] [light|dark] [dpr=2] [views=home,shop,service,business,knowledge,contact]
// pass = no small text, no small touch targets, no clipped text, no glyph icons, no sideways scroll, no page error
// (soft images / canvases are reported only: 3D canvases scale their resolution to the machine — swiftshader is slow).
import { chromium } from 'playwright';
const [,, pg = 'c', w = '1366', scheme = 'dark', dpr = '2', views = 'home,shop,service,business,knowledge,contact'] = process.argv;
const mob = +w < 600;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: +w, height: mob ? 844 : 900 }, deviceScaleFactor: +dpr, colorScheme: scheme, hasTouch: mob, isMobile: mob });
const p = await ctx.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(`${process.env.BASE || "http://localhost:8765"}/${pg}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
const res = {};
for (const v of views.split(',')) {
  await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(2000);
  // walk the page so lazy images / canvases boot
  const hh = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < hh; y += 700) { await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(350); }
  await p.waitForTimeout(1500);
  res[v] = await p.evaluate(({ mob }) => {
    const D = devicePixelRatio, vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && el.closest('[hidden]') == null && !el.closest('[aria-hidden="true"] ~ x'); };
    const sel = el => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.'); const sec = el.closest('section[id],[data-sx]'); return (sec ? (sec.id || sec.dataset.sx) + ' › ' : '') + s; };
    const out = { softImg: [], softCanvas: [], small: {}, smallN: 0, tap: [], tapN: 0, clip: [], glyph: [] };
    for (const im of document.querySelectorAll('img')) { if (!vis(im) || !im.naturalWidth) continue; const need = im.getBoundingClientRect().width * D; const fit = getComputedStyle(im).objectFit; const r = im.naturalWidth / need; if (r < .9) out.softImg.push(`${sel(im)} ${im.naturalWidth}px for ${Math.round(need)}px (${Math.round(r * 100)}%)${fit === 'cover' ? ' cover' : ''}`); }
    for (const c of document.querySelectorAll('canvas')) { if (!vis(c)) continue; const r = c.getBoundingClientRect(); const need = r.width * D; const k = c.width / need; if (k < .9) out.softCanvas.push(`${sel(c)} ${c.width}×${c.height} for ${Math.round(need)}×${Math.round(r.height * D)} (${Math.round(k * 100)}%)`); }
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || !vis(el) || el.closest('svg,script,style,[aria-hidden="true"]')) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 12) { out.smallN++; const k = sel(el) + ' ' + fs + 'px'; out.small[k] = (out.small[k] || 0) + 1; } if (/[▶►→←✓✔★☆✍⚠✕✖❚]/.test(t)) out.glyph.push(sel(el) + ' "' + t.slice(0, 30) + '"'); }
    if (mob) for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary,label:has(input)')) { if (!vis(el) || el.closest('[aria-hidden="true"]') && el.tabIndex < 0) continue; const lb = el.matches('input') && el.closest('label'); const r0 = (lb || el).getBoundingClientRect(), af = getComputedStyle(el, '::after'), ins = k => af.content !== 'none' && af.position === 'absolute' ? Math.max(0, -parseFloat(af[k]) || 0) : 0; const r = { width: r0.width + ins('left') + ins('right'), height: r0.height + ins('top') + ins('bottom') }; if (r.height < 43.5 || r.width < 43.5) { if (el.closest('p,li') && el.tagName === 'A' && r.height >= 20) continue; out.tapN++; if (out.tap.length < 30) out.tap.push(`${sel(el)} ${Math.round(r.width)}×${Math.round(r.height)} "${(el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`); } }
    for (const el of document.querySelectorAll('body *')) { if (!vis(el) || el.children.length > 3) continue; const s = getComputedStyle(el); if (!/(hidden|clip)/.test(s.overflowX + s.overflow) || s.textOverflow === 'ellipsis') continue; if (el.scrollWidth > el.clientWidth + 2 && el.textContent.trim() && !el.closest('[class*=scroll],[class*=tabs],nav,.tbl-wrap,table')) out.clip.push(`${sel(el)} ${el.scrollWidth}>${el.clientWidth}`); }
    out.small = Object.entries(out.small).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, n]) => `${n}× ${k}`);
    out.clip = out.clip.slice(0, 15); out.glyph = [...new Set(out.glyph)].slice(0, 12); out.softImg = out.softImg.slice(0, 15); out.softCanvas = out.softCanvas.slice(0, 15);
    out.overflowX = document.documentElement.scrollWidth > innerWidth + 1;
    return out;
  }, { mob });
}
const sum = k => Object.values(res).reduce((s, r) => s + (Array.isArray(r[k]) ? r[k].length : (r[k] || 0)), 0);
for (const [v, r] of Object.entries(res)) for (const k of ['small', 'tap', 'clip', 'glyph']) (r[k] || []).slice(0, 6).forEach(x => console.log());
const R = { test: 'audit', page: pg, w: +w, scheme, dpr: +dpr, errors: errs.length, small: sum('smallN'), tap: sum('tapN'), clip: sum('clip'), glyph: sum('glyph'), overflow: Object.values(res).filter(r => r.overflowX).length, softImg: sum('softImg'), softCanvas: sum('softCanvas') };
R.pass = !R.errors && !R.small && !R.tap && !R.clip && !R.glyph && !R.overflow;
if (process.env.AUDIT_JSON) console.log(JSON.stringify({ page: pg, w, scheme, dpr, errors: errs.slice(0, 5), res }, null, 1));
console.log('RESULT ' + JSON.stringify(R));
await b.close();
process.exit(R.pass ? 0 : 1);
