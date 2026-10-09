// Scan the rendered text of a page for words that must never appear (banned claims, retired specs, internal data).
// usage: node tests/textscan.mjs [page=a.html]
import { launch, BASE, scrollAll } from './_lib.mjs';
const [,, page = 'a.html'] = process.argv;
const BANNED = ['แก้หายแน่นอน', 'ไม่มีปัญหาอีกแน่นอน', 'ประหยัดไฟแน่นอน', 'ปลอดเชื้อ', 'สะอาด 100%', 'รับประกันเย็น', 'ล้างใหญ่ครบทุกจุด',
  'ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี', 'อะไหล่เสียแน่นอน', 'เสร็จตามเวลาแน่นอน', 'Type L', 'K Copper', 'สีเทา', 'ต้นทุน', 'อัตราพิเศษ ', 'อัตราโครงการ'];
const b = await launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
await p.goto(`${BASE}/${page}`); await p.waitForTimeout(2500);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on') || document.querySelector('.jc-on') || document.documentElement.classList.contains('v2-on'), null, { timeout: 120000 }).catch(() => {});   // r5: views are built at the end of the page script · r10: แบบ D is one page (job card = ready)
// Rev.09 r5: hidden views are not in innerText — read every view
const views = await p.evaluate(() => [...document.querySelectorAll('header nav a[data-v]')].map(a => a.dataset.v));
let t = '';
for (const v of views.length ? views : [null]) {
  if (v) { await p.evaluate(v => { location.hash = v; }, v); await p.waitForTimeout(1000); }
  await scrollAll(p, 1400, 500);
  await p.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true)); await p.waitForTimeout(800);
  t += '\n' + await p.evaluate(() => document.body.innerText);
}
let hits = 0;
for (const w of BANNED) { const re = new RegExp('.{0,50}' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.{0,50}', 'g'); const m = t.match(re) || []; if (m.length) { hits += m.length; console.log(`✗ "${w}" ×${m.length}`); m.slice(0, 3).forEach(x => console.log('    ' + x.replace(/\n/g, ' | '))); } }
console.log(hits ? `${hits} hit(s) — review each (some words are fine in context, e.g. "ต้นทุน" in an FAQ)` : 'clean');
await b.close(); process.exit(hits ? 1 : 0);
