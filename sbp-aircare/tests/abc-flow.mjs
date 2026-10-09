// r20 A · B · C flow checks (the conversion path Dev must keep working):
//   lazy view mounting · quick quote prices (Pricebook + minimum-bill line) · quick quote → basket · quick quote → booking
//   · basket → estimate document (labels, totals, terms, back to the form) · structured data + meta · no errors · no sideways scroll
// usage: node tests/abc-flow.mjs <a|b|c> [width=1366] [light|dark]      (dev server: npm run serve; BASE env to override)
// prints one line per check and a final "RESULT {json}" line; exit 1 when any check fails
import { launch, BASE } from './_lib.mjs';
const [pg = 'a', w = '1366', scheme = 'light'] = process.argv.slice(2);
const mob = +w < 600;
const b = await launch();
const p = await b.newPage({ viewport: { width: +w, height: mob ? 844 : 900 }, colorScheme: scheme, isMobile: mob, hasTouch: mob });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU stall|context lost/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
const out = []; const ok = (name, pass, info = '') => { out.push({ name, pass: !!pass, info }); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const T = { timeout: 120000 };
const num = s => +String(s).replace(/[^\d]/g, '');

await p.goto(`${BASE}/${pg}.html`);
await p.waitForFunction(() => document.documentElement.classList.contains('sx-on'), null, T);
await p.waitForTimeout(1200);

// 1. lazy mounting: the catalog (shop view) is empty until the shop view is opened
const cat0 = await p.evaluate(() => document.getElementById('catalog')?.querySelectorAll('*').length || 0);

// 2. quick quote on home: wall C1 default → line(s), minimum-bill line, total = 4,500 (DATA.minBill) before VAT
const qk = await p.evaluate(() => {
  const r = document.getElementById('quickRoot'); if (!r) return null;
  const dts = [...r.querySelectorAll('.jc-lines dt')].map(x => x.textContent), dds = [...r.querySelectorAll('.jc-lines dd')].map(x => x.textContent);
  return { visible: !r.closest('[hidden]'), dts, dds, total: r.querySelector('.jc-total .jc-num')?.textContent, hint: r.querySelector('.jc-hint.strong')?.textContent || '', ref: getComputedStyle(r.querySelector('.jc-ref')).display };
});
ok('มีส่วนประเมินราคาทันทีในหน้าแรก', qk && qk.visible);
ok('ประเมินราคา: มีบรรทัดปรับยอดขั้นต่ำงานล้าง', qk && qk.dts.some(t => /ขั้นต่ำ/.test(t)), qk ? qk.dts.join(' | ') : '');
ok('ประเมินราคา: ยอดรวมเท่ากับผลรวมบรรทัด', qk && num(qk.total) === qk.dds.reduce((s, d) => s + (d.trim().startsWith('−') ? -1 : 1) * num(d), 0), qk ? `${qk.total} vs ${qk.dds.join('+')}` : '');
ok('ประเมินราคา: ราคาเป็นหลักร้อย', qk && qk.dds.every(d => num(d) % 100 === 0));
ok('ประเมินราคา: ไม่แสดงเลขที่คำขอก่อนหลังบ้านตอบ', qk && qk.ref === 'none');

// 3. quick quote → basket
const n0 = await p.evaluate(() => +(document.querySelector('[data-cart-btn]')?.dataset.n || 0));
await p.locator('#quickRoot .jc-add').click();
await p.waitForFunction(() => { const d = document.querySelector('.s-cart'); return d && !d.hidden; }, null, { timeout: 10000 }).catch(() => {});
const n1 = await p.evaluate(() => +(document.querySelector('[data-cart-btn]')?.dataset.n || 0));
ok('ใส่ใบเสนอราคา → ตะกร้าเพิ่มและเปิดเอง', n1 > n0 && await p.evaluate(() => !document.querySelector('.s-cart').hidden), `${n0} → ${n1}`);

// 4. basket → estimate document
await p.locator('#s-cart-zone').fill('จอมทอง'); await p.waitForTimeout(500);
await p.locator('.s-doc-open').click(); await p.waitForTimeout(400);
const doc = await p.evaluate(() => { const d = document.querySelector('.s-doc'); if (!d) return null; const b = document.querySelector('.s-cart-b');
  return { title: d.querySelector('h3')?.textContent, not: d.querySelector('.s-doc-not')?.textContent, rows: d.querySelectorAll('tbody tr').length, tot: d.querySelector('.s-doc-sum dd.tot')?.textContent, ref: d.querySelector('.s-doc-id dd:nth-of-type(2)')?.textContent, co: d.querySelector('.s-doc-co b')?.textContent, terms: d.querySelectorAll('.s-doc-terms li').length, ox: b.scrollWidth > b.clientWidth + 1 }; });
ok('ใบประเมินราคา: หัวเอกสารและป้าย "ไม่ใช่ใบเสนอราคาทางการ"', doc && /ใบประเมินราคาเบื้องต้น/.test(doc.title) && /ไม่ใช่ใบเสนอราคาทางการ/.test(doc.not), doc ? `${doc.title} / ${doc.not}` : 'no doc');
ok('ใบประเมินราคา: บริษัท + เลขที่ใบประเมินในเครื่อง + เงื่อนไข', doc && /สหบูรพา/.test(doc.co) && /^PE-\d{6}-\d{4}$/.test(doc.ref) && doc.terms >= 3, doc ? `${doc.ref} terms ${doc.terms}` : '');
ok('ใบประเมินราคา: ไม่เลื่อนแนวนอน', doc && !doc.ox);
await p.locator('.s-doc-act button', { hasText: 'ขอใบเสนอราคาอย่างเป็นทางการ' }).click(); await p.waitForTimeout(300);
ok('ใบประเมินราคา → กลับไปฟอร์มขอใบเสนอราคา (โฟกัสช่องชื่อ)', await p.evaluate(() => document.activeElement?.id === 's-q-name'));
await p.keyboard.press('Escape'); await p.waitForTimeout(400);

// 5. quick quote → booking (contact view, booking section shown with the job preset)
await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(800);
await p.locator('#quickRoot .jc-go').click(); await p.waitForTimeout(1500);
const bk = await p.evaluate(() => { const s = document.getElementById('booking'), r = document.getElementById('bookRoot');
  return { shown: !!s && !s.closest('[hidden]') && s.getBoundingClientRect().height > 0, svc: r?.querySelector('.bk-chips input:checked')?.value, wall: r?.querySelector('[data-u="wall"]')?.value }; });
ok('เลือกวันและจองคิว → เปิดส่วนจองคิว', bk.shown);
ok('จองคิว: รับงานและจำนวนเครื่องจากใบประเมิน (ล้าง · ติดผนัง 2)', bk.svc === 'clean' && bk.wall === '2', `${bk.svc} · wall ${bk.wall}`);

// 6. lazy mounting on demand: open the shop view → catalog builds
await p.evaluate(() => { location.hash = 'shop'; }); await p.waitForTimeout(2500);
const cat1 = await p.evaluate(() => document.getElementById('catalog')?.querySelectorAll('*').length || 0);
ok('แคตตาล็อกสร้างเมื่อเปิดหน้าซื้อแอร์ครั้งแรก (lazy mount)', cat0 < 100 && cat1 > cat0 + 150, `catalog nodes ${cat0} → ${cat1}`);

// 7. structured data + meta
const seo = await p.evaluate(() => { let j = null; try { j = JSON.parse(document.getElementById('sbp-ld')?.textContent || 'null'); } catch (e) {} const g = j && j['@graph'] || [];
  return { org: g.find(x => [].concat(x['@type']).includes('Organization'))?.name, svc: g.filter(x => x['@type'] === 'Service').length, desc: document.querySelector('meta[name=description]')?.content || '', og: !!document.querySelector('meta[property="og:title"]') }; });
ok('JSON-LD: องค์กร + บริการ', seo.org && seo.svc >= 4, `${seo.org} · ${seo.svc} services`);
ok('meta description + Open Graph', seo.desc.length > 60 && seo.og);

// 8. page health
await p.evaluate(() => { location.hash = 'home'; }); await p.waitForTimeout(1000);
ok('ไม่เลื่อนแนวนอน', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
ok('ไม่มี error ใน console', errs.length === 0, errs.slice(0, 3).join(' | '));

const fail = out.filter(x => !x.pass).length;
console.log('RESULT ' + JSON.stringify({ test: 'abc-flow', page: pg, w: +w, scheme, pass: out.length - fail, total: out.length, fails: out.filter(x => !x.pass).map(x => x.name) }));
await b.close();
process.exit(fail ? 1 : 0);
