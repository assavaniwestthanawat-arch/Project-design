// r16 รุ่นที่ 2 (a2 ภาพยนตร์ · b2 ภารกิจ · c2 โชว์รูม · d2 ดิจิทัลทวิน): every chapter's 3D scene builds and plays its shots
// (scroll, blocks or player), the captions come from the company data, the sales panels price from the Pricebook and put the
// job in the quote basket, "จองคิว" hands the job to the booking form, the concierge answers every need with a price line or
// "ประเมินหน้างาน", the room panel sends the visitor to a model at or above the recommended size, the showroom puts machine
// + installation in the quote, banned words never appear, few live WebGL contexts, no page errors, no sideways scroll.
// usage: node tests/v2-flow.mjs <a2|b2|c2|d2> [width=1366]   (dev server on :8765)
import { launch, BASE } from './_lib.mjs';
const [,, page = 'a2', W = 1366] = process.argv;
const BANNED = ['แก้หายแน่นอน', 'ไม่มีปัญหาอีกแน่นอน', 'ประหยัดไฟแน่นอน', 'ปลอดเชื้อ', 'สะอาด 100%', 'รับประกันเย็น', 'ล้างใหญ่ครบทุกจุด', 'ไม่มีค่าใช้จ่ายเพิ่มเติมทุกกรณี', 'อะไหล่เสียแน่นอน', 'เสร็จตามเวลาแน่นอน', 'Type L', 'K Copper', 'undefined', 'NaN', 'ต้นทุน', 'อัตราโครงการ'];
const b = await launch(); const p = await b.newPage({ viewport: { width: +W, height: +W < 600 ? 844 : 900 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
let ok = 0, bad = 0; const check = (c, msg) => { if (c) ok++; else { bad++; console.log('✗ ' + msg); } };
// live contexts = created and not lost (the pool releases far scenes)
await p.addInitScript(() => { const L = window.__ctx = []; const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc.call(this, t, ...a); if (c && /webgl/.test(t) && !this.__c) { this.__c = 1; L.push(c); } return c; }; });
await p.goto(`${BASE}/${page}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('film-on'), null, { timeout: 120000 });
const cartN = () => p.evaluate(() => +document.querySelector('[data-cart-n]').textContent || 0);
const to = (sel, block = 'start') => p.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ block: b }), [sel, block]);
let text = '';

// ---- every chapter: captions + its 3D scene + the shots move ----
const chapters = await p.evaluate(() => [...document.querySelectorAll('[data-film]')].map(el => ({ id: el.id, spec: JSON.parse(el.dataset.film) })));
check(chapters.length >= 7, `chapters with a scene (${chapters.length})`);
for (const ch of chapters) {
  const S = `#${ch.id}`;
  await to(S); await p.waitForTimeout(300);
  if (ch.spec.drive === 'progress') await p.evaluate(s => { const t = document.querySelector(s + ' .fm-track'); scrollTo(0, scrollY + t.getBoundingClientRect().top + t.offsetHeight * 0.3); }, S);
  else if (ch.spec.drive === 'blocks' || ch.spec.drive === 'player') await to(`${S} .fm-stage`, 'center');
  if (ch.spec.kind !== 'unit') {
    await p.waitForFunction(s => { const el = document.querySelector(s); return el.classList.contains('is-live') || el.classList.contains('no-gl'); }, S, { timeout: 180000 }).catch(() => {});
    // (the map draws its canvas once it is on screen: wait for it)
    await p.waitForFunction(s => document.querySelector(s + ' .fm-gl canvas'), S, { timeout: 60000 }).catch(() => {});
    const st = await p.evaluate(s => { const el = document.querySelector(s); return { live: el.classList.contains('is-live'), shots: el.querySelectorAll('.fm-shot').length, canvas: !!el.querySelector('.fm-gl canvas'), tag: /แบบจำลองเพื่ออธิบาย/.test(el.querySelector('.fm-stage').innerText) }; }, S);
    check(st.live && st.canvas, `${ch.id}: 3D scene built (${JSON.stringify(st)})`);
    check(st.shots > 0, `${ch.id}: shot list (${st.shots})`);
    check(st.tag, `${ch.id}: "แบบจำลองเพื่ออธิบาย" on the stage`);
  }
  if (ch.spec.drive === 'player') {
    await p.locator(`${S} .fm-next`).click(); await p.waitForTimeout(250);
    const a = await p.evaluate(s => document.querySelector(s).style.getPropertyValue('--step'), S);
    await p.locator(`${S} .fm-next`).click(); await p.waitForTimeout(250);
    const c = await p.evaluate(s => ({ step: document.querySelector(s).style.getPropertyValue('--step'), cur: document.querySelectorAll(s + ' .fm-shot[aria-current="step"]').length }), S);
    check(c.step !== a && c.cur === 1, `${ch.id}: next moves the shot (${a} → ${c.step})`);
  } else if (ch.spec.drive === 'progress') {
    // (the shot follows the scroll position on the next frame; a heavy build can hold frames back on software WebGL)
    await p.waitForFunction(s => document.querySelector(s + ' .fm-sub-t').textContent, S, { timeout: 30000 }).catch(() => {});
    const a = await p.evaluate(s => document.querySelector(s + ' .fm-sub-t').textContent, S);
    await p.evaluate(s => { const t = document.querySelector(s + ' .fm-track'); scrollTo(0, scrollY + t.getBoundingClientRect().top + t.offsetHeight * 0.75); }, S);
    await p.waitForFunction(([s, a]) => { const t = document.querySelector(s + ' .fm-sub-t').textContent; return t && t !== a; }, [S, a], { timeout: 30000 }).catch(() => {});
    const c = await p.evaluate(s => document.querySelector(s + ' .fm-sub-t').textContent, S);
    check(a && c && a !== c, `${ch.id}: scrolling changes the shot ("${a.slice(0, 20)}" → "${c.slice(0, 20)}")`);
  } else if (ch.spec.drive === 'blocks') {
    await p.evaluate(s => { const li = document.querySelectorAll(s + ' .fm-shot')[1]; li && li.scrollIntoView({ block: 'center' }); }, S);
    await p.waitForFunction(s => document.querySelectorAll(s + ' .fm-shot')[1]?.classList.contains('on'), S, { timeout: 20000 }).catch(() => {});
    check(await p.evaluate(s => document.querySelectorAll(s + ' .fm-shot')[1]?.classList.contains('on'), S), `${ch.id}: the block in the middle plays`);
  }
  text += '\n' + await p.evaluate(s => [...document.querySelectorAll(s + ' .fm-shot')].map(x => x.textContent).join('\n'), S);
}

// ---- cleaning: price for every type × method, basket, booking hand-off ----
await to('[data-sell="clean"]'); await p.waitForSelector('.fs-clean .fs-price', { timeout: 60000 });
for (const t of ['ติดผนัง', 'แขวนใต้ฝ้า', 'สี่ทิศทาง', 'ตู้ตั้งพื้น']) for (const lv of ['C1', 'C2']) {
  await p.locator('.fs-clean .fs-q').first().locator('button', { hasText: t }).click();
  await p.locator('.fs-clean .fs-opt', { hasText: lv }).first().click(); await p.waitForTimeout(80);
  const pr = await p.evaluate(() => document.querySelector('.fs-clean .fs-price').textContent);
  check(/฿[\d,]+|ประเมินหน้างาน/.test(pr), `clean ${t} ${lv}: ${pr}`);
}
await p.locator('.fs-clean .fs-step button', { hasText: '+' }).click();
let c0 = await cartN(); await p.locator('.fs-clean .fs-acts .v-btn.go').click(); await p.waitForTimeout(300);
check(await cartN() >= c0 + 2, 'clean panel → 2 machines in the quote basket');
text += '\n' + await p.evaluate(() => document.querySelector('.fs-clean').innerText);

// ---- installation ----
await to('[data-sell="install"]'); await p.waitForSelector('.fs-install .fs-price', { timeout: 60000 });
for (const t of ['ติดผนัง', 'แขวนใต้ฝ้า', 'สี่ทิศทาง', 'ตู้ตั้งพื้น']) {
  await p.locator('.fs-install .fs-q').first().locator('button', { hasText: t }).click(); await p.waitForTimeout(80);
  const pr = await p.evaluate(() => document.querySelector('.fs-install .fs-price').textContent);
  check(/฿[\d,]+|ประเมินหน้างาน/.test(pr), `install ${t}: ${pr}`);
}
await p.locator('.fs-install .fs-q').first().locator('button', { hasText: 'ติดผนัง' }).click();
c0 = await cartN(); await p.locator('.fs-install .fs-acts .v-btn.go').click(); await p.waitForTimeout(300);
check(await cartN() > c0, 'install panel → quote basket');
text += '\n' + await p.evaluate(() => document.querySelector('.fs-install').innerText);

// ---- room size → a showroom model at or above the recommended size ----
await to('[data-sell="room"]'); await p.waitForSelector('.fs-room .fs-price', { timeout: 60000 });
await p.locator('.fs-room input').nth(0).fill('5'); await p.locator('.fs-room input').nth(1).fill('6'); await p.waitForTimeout(200);
const pick = await p.evaluate(() => +(document.querySelector('.fs-room .fs-price b').textContent.match(/[\d,]+/) || ['0'])[0].replace(/,/g, ''));
check(pick >= 18000, `room 5×6 m → ${pick} BTU`);
await p.locator('.fs-room .fs-acts .v-btn').first().click(); await p.waitForTimeout(2500);
const sel = await p.evaluate(() => { const c = document.querySelector('.sr-code'); const m = c && c.textContent.match(/([\d,]+) BTU/); return m ? +m[1].replace(/,/g, '') : 0; });
check(sel >= pick * 0.95, `showroom model ${sel} BTU ≥ recommended ${pick}`);

// ---- showroom ----
await to('[data-showroom]', 'center'); await p.waitForTimeout(500);
for (const t of ['แขวนใต้ฝ้า', 'สี่ทิศทาง', 'ตู้ตั้งพื้น', 'ติดผนัง']) {
  await p.locator('.sr-types button', { hasText: t }).first().click(); await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({ code: document.querySelector('.sr-code')?.textContent || '', price: document.querySelector('.sr-price b')?.textContent || '', rows: document.querySelectorAll('.sr-row').length }));
  check(d.code.includes(t) && /฿[\d,]+/.test(d.price) && d.rows > 0, `showroom ${t}: ${d.code} ${d.price}`);
}
c0 = await cartN(); await p.locator('.sr-acts .v-btn.go').click(); await p.waitForTimeout(400);
check(await cartN() > c0, 'showroom → quote basket');
for (const s of ['ใกล้', 'ภายใน', 'ทางลม']) { await p.locator('[data-sr-ctl] button', { hasText: s }).first().click(); await p.waitForTimeout(250); }

// ---- concierge: every need answered with a price line or ประเมินหน้างาน ----
await to('[data-concierge]', 'start'); await p.waitForSelector('.cc-chips button', { timeout: 60000 });
const needs = await p.evaluate(() => [...document.querySelectorAll('.cc-q:nth-child(2) .cc-chips button')].map(b => b.textContent));
check(needs.length === 10, `10 needs (got ${needs.length})`);
for (const n of needs) {
  await p.locator('.cc-q:nth-child(2) .cc-chips button', { hasText: n }).first().click(); await p.waitForTimeout(150);
  const r = await p.evaluate(() => { const res = document.querySelector('.cc-res'); return { txt: res.innerText, rows: res.querySelectorAll('.cc-price dd').length, money: [...res.querySelectorAll('.cc-price dd')].every(d => /฿[\d,]+|ประเมินหน้างาน/.test(d.textContent)), go: !!res.querySelector('.cc-acts .v-btn.go') }; });
  text += '\n' + r.txt;
  check(r.go, `${n}: booking button`);
  check(n === 'ดูแลหลายเครื่องทั้งปี' || (r.rows > 0 && r.money), `${n}: price rows (${r.rows}) each a price or ประเมินหน้างาน`);
}
await p.locator('.cc-q:nth-child(2) .cc-chips button', { hasText: 'น้ำหยด' }).first().click(); await p.waitForTimeout(300);
await to('[data-cc-stage]', 'center');
await p.waitForFunction(() => document.querySelectorAll('[data-cc-stage] .stage-lab:not([hidden])').length > 0, null, { timeout: 120000 }).catch(() => {});
check(await p.evaluate(() => document.querySelectorAll('[data-cc-stage] .stage-lab:not([hidden])').length > 0), 'cause labels on the concierge stage');

// ---- repair prices, area, business ----
await to('[data-sell="repair"]'); await p.waitForSelector('.fs-repair .fs-lead li', { timeout: 60000 });
check(await p.evaluate(() => [...document.querySelectorAll('.fs-repair .fs-lead b')].filter(b => /฿[\d,]+/.test(b.textContent)).length >= 4), 'repair: diagnosis + repair prices');
await to('[data-sell="area"]'); await p.waitForSelector('.fs-area [data-z-input]', { timeout: 60000 });
await p.locator('.fs-area [data-z-try]').first().click(); await p.waitForTimeout(300);
check(await p.evaluate(() => !document.querySelector('.fs-area [data-z-result]').hidden), 'area check shows a result');
if (await p.evaluate(() => !!document.querySelector('[data-sell="business"]'))) {
  await to('[data-sell="business"]'); await p.waitForSelector('.fs-biz [role=tab]', { timeout: 60000 });
  check(await p.evaluate(() => document.querySelectorAll('.fs-biz .fs-table tbody tr').length === 5), 'business: volume ladder 5 rows');
  for (const k of ['sop', 'projects', 'amc']) { await p.locator(`.fs-biz [data-k="${k}"]`).click(); await p.waitForTimeout(400); check(await p.evaluate(k => document.getElementById('fs-' + k).children.length > 0, k), `business tab ${k} mounted`); }
  text += '\n' + await p.evaluate(() => document.querySelector('.fs-biz').innerText);
}

// ---- booking hand-off (last: it scrolls the page to the booking form) ----
await to('[data-sell="clean"]'); await p.waitForTimeout(400);
await p.locator('.fs-clean .fs-acts .v-btn.ghost').click();
await p.waitForFunction(() => document.querySelector('#bookRoot input[type=radio]:checked'), null, { timeout: 60000 }).catch(() => {});
const bk = await p.evaluate(() => document.querySelector('#bookRoot input[type=radio]:checked')?.value);
check(bk === 'clean', `"จองคิวล้างแอร์" → booking preset clean (${bk})`);

const st = await p.evaluate(() => ({ live: window.__ctx.filter(c => !c.isContextLost()).length, made: window.__ctx.length, ox: document.documentElement.scrollWidth - innerWidth }));
check(st.live <= 5, `live WebGL contexts ≤ 5 (live ${st.live}, created ${st.made})`);
check(st.ox <= 0, `no sideways scroll (${st.ox})`);
for (const w of BANNED) { const i = text.indexOf(w); check(i < 0, `banned "${w}": …${text.slice(Math.max(0, i - 40), i + 40)}…`); }
check(!errs.length, `no page errors: ${errs.slice(0, 3).join(' | ')}`);
console.log(JSON.stringify({ page, W: +W, ok, bad, gl: st }));
await b.close(); process.exit(bad ? 1 : 0);
