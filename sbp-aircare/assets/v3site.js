// SBP AirCare — page wiring of the รุ่นที่ 3 editions (r13: a3/b3/c3.html; owner 6 ต.ค. 2569 on v2: "ไม่สวยและไม่เสมือนจริง มันแย่กว่า
// A B C … แยกแยะหน้าเว็บให้เป็นสัดส่วนชัดเจน" — answers: bright, photographic, every A/B/C module, several pages by job).
// Nine pages, one per job (site.js views): หน้าแรก · ซื้อแอร์ · ล้างแอร์ · ติดตั้ง ย้าย · ซ่อม ตรวจเช็ก · องค์กร · ราคา · ความรู้ · ติดต่อ.
// Each page's modules mount the first time the page opens, so a page never builds the tools of the other eight; the booking
// form, the quote basket, FAQ and search are ready everywhere. Everything else (menu, page headings, journeys, next steps,
// about, contact form, feedback, footer, search) is site.js, as on A/B/C.
// mountV3({variant}) → { site, ensure(view) }
import { mountAmc, mountSop, mountProjects } from './business.js';
import { mountBooking } from './booking.js';
import { icon } from './icons.js';
import { mountCatalog, mountBuilder, mountZone, mountFaq, mountViewer, toast, wireDrawers, openDrawer, closeDrawer, compareTable, typeArt, h, $, $$, baht, BRAND_BY_ID, TYPE_BY_ID } from './proto-ui.js';
import { SERVICES, FAQ, PRESETS, TYPES, DATA, DEMO, BRANDS, COMPANY, estimateContract, loadData } from './sbp-core.js';
import { mountCart, productDetail, mountPriceCenter, cart, mountMaterials } from './commerce.js';
import { mountStudio } from './studio.js';
import { mountServices } from './services.js';
import { mountHowItWorks } from './howitworks3d.js';
import { mountThaiMap } from './thaimap3d.js';
import { travelTable, mountQuotePill, mountMobileMenu, mountFlow, enhanceQuoteForm, askTeam } from './journey.js';
import { loadMedia, productVisual } from './product-media.js';
import { mountRoomFit } from './roomfit.js';
import { mountKnowledge } from './knowledge.js';
import { mountJobGuide } from './jobguide.js';
import { mountConcierge } from './concierge.js';
import { mountSite } from './site.js';

// the pages: title + one-line lead (the page heading), and the sections each page holds (ids in the markup)
export const PAGES = {
  home: { th: 'หน้าแรก', ids: ['hero', 'start', 'services', 'flow'] },
  shop: { th: 'ซื้อแอร์', lead: 'หาขนาดที่เหมาะกับห้อง เลือกรุ่นพร้อมราคาติดตั้ง แล้วลองวางในห้องของคุณก่อนตัดสินใจ', ids: ['catalog', 'studio', 'fit', 'fujiva'] },
  cleaning: { th: 'ล้างแอร์', lead: 'ล้างปกติ C1 หรือล้างใหญ่ C2 ดูทีมช่างทำทีละขั้น เห็นว่าฝุ่นสะสมตรงไหน และราคามาตรฐานตามประเภทและขนาดเครื่อง', ids: ['cleanflow', 'inside'] },
  install: { th: 'ติดตั้ง ย้าย', lead: 'ติดตั้งมาตรฐานหรือพรีเมียม วัสดุระบุยี่ห้อและสเปก ขั้นตอนทดสอบก่อนส่งมอบ และงานติดตั้งทั้งพื้นที่ สร้างใหม่ รีโนเวต เปลี่ยนทั้งชุด', ids: ['installflow', 'quality', 'projects'] },
  repair: { th: 'ซ่อม ตรวจเช็ก', lead: 'บอกอาการ ดูสาเหตุที่พบบ่อย และค่าตรวจเช็ก ช่างวัดค่าหน้างานแล้วแจ้งราคาให้คุณอนุมัติก่อนซ่อมทุกครั้ง', ids: ['ask', 'howto'] },
  business: { th: 'สำหรับองค์กร', lead: 'สัญญาล้างรายปี ราคาขั้นบันไดตามจำนวนเครื่อง รายงานรายเครื่องหลังทุกรอบ และขั้นตอนทั้งสัญญา', ids: ['amc', 'b2b', 'sop'] },
  pricing: { th: 'ราคา', lead: 'ราคาล้าง ติดตั้ง ซ่อม และอุปกรณ์เสริมทุกรายการจาก Pricebook 2569 ราคาก่อน VAT ปัดหลักร้อย กด "เพิ่ม" เพื่อรวมยอดในใบเสนอราคา', ids: ['prices'] },
  guide: { th: 'ความรู้', lead: 'อ่านสั้น ๆ ก่อนตัดสินใจ: เลือก BTU ประเภทเครื่อง รอบล้าง สิ่งที่รวมในงานติดตั้ง แล้วกดลองกับเครื่องมือจำลองได้ทันที', ids: ['learn'] },
  contact: { th: 'ติดต่อ', lead: 'จองคิว ให้ทีมโทรกลับ ตรวจพื้นที่ให้บริการ ข้อมูลบริษัท และคำถามที่พบบ่อย', ids: ['booking', 'quote', 'area', 'about', 'faq'] },
};
const LABELS = { installflow: 'ขั้นตอนติดตั้งทีละขั้น', cleanflow: 'ขั้นตอนล้างทีละขั้น', inside: 'ฝุ่นสะสมตรงไหน', ask: 'เช็กอาการแอร์', howto: 'แอร์ทำงานอย่างไร และขั้นตอนตรวจซ่อม', fujiva: 'แอร์ FUJIVA', prices: 'ราคาทุกบริการ', learn: 'คู่มือก่อนตัดสินใจ' };

export async function mountV3({ variant = 'A3', navFmt, hubLabel = 'หน้ารวมทุกแบบ' } = {}) {
  await loadData(); await loadMedia();
  enhanceQuoteForm();
  $$('[data-ask]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); askTeam(a.dataset.ask); }));
  const CART = mountCart();
  mountQuotePill(CART.open);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svcFrom = id => (SERVICES.find(x => x.id === id) || {}).from || '';

  // ---- ready on every page: drawers, booking, FAQ, price lines in the heroes ----
  const drawer = $('#drawer');
  wireDrawers();
  const BK = mountBooking($('#bookRoot'), { variant, hl: 'h3' });
  FAQ.forEach(f => $('#faqList').append(h('details', {}, h('summary', {}, f.q), h('p', {}, f.a))));
  mountFaq($('#faqList'));
  $$('[data-from]').forEach(el => { const t = svcFrom(el.dataset.from); if (t) el.textContent = t; });
  const prices = DEMO.models.flatMap(m => m.skus.map(x => x.price)).filter(n => n > 0);
  $$('[data-from-buy]').forEach(el => { if (prices.length) el.textContent = `เครื่องเริ่ม ${baht(Math.min(...prices))}`; });
  $$('[data-models]').forEach(el => { el.textContent = `${DEMO.skuCount} รุ่น ${BRANDS.filter(b => b.n).length} แบรนด์`; });
  $$('[data-minbill]').forEach(el => { el.textContent = baht(DATA.minBill); });

  // ---- page modules, mounted when their page first opens (and on demand from another page) ----
  const once = f => { let v, done = false; return () => { if (!done) { done = true; try { v = f(); } catch (e) { console.error(e); } } return v; }; };
  let FIT = null;
  function openProduct(m, idx = 0) {
    const body = $('#drawerBody'); body.innerHTML = '';
    body.append(productDetail(m, idx, {
      onPick: i => openProduct(m, i),
      on3D: () => { closeDrawer(drawer); ensure('cleaning'); $('#inside').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); },
      onFit: (mm, i) => { closeDrawer(drawer); ensure('shop'); FIT && FIT.setModel(mm, i); },
    }));
    if (drawer.hidden) openDrawer(drawer);
  }
  const M = {
    home: once(() => {
      mountFlow($('#flowRoot'), { room: 'studio', product: 'catalog', service: 'cleanflow', area: 'area', quote: 'quote' }, { openCart: CART.open, dock: false });
      const icons = { 'clean-b2b': 'M4 20V8l8-4 8 4v12M9 20v-6h6v6', clean: 'M4 9h16v6H4zM7 15v3M12 15v4M17 15v3', install: 'M14 4l6 6-9 9H5v-6z', repair: 'M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9', move: 'M4 12h14M14 6l6 6-6 6', project: 'M4 20h16M6 20V9l6-5 6 5v11' };
      const page = { 'clean-b2b': 'business', clean: 'cleaning', install: 'install', repair: 'repair', move: 'install', project: 'projects' };
      SERVICES.forEach(s => $('#svc').append(h('article', { class: 'tile' + (s.key ? ' key' : '') },
        h('span', { class: 'ico', html: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[s.id]}"/></svg>` }),
        h('h3', {}, s.th), h('p', { class: 'sub' }, s.sub),
        h('dl', {}, h('dt', {}, 'ราคา'), h('dd', {}, s.from), h('dt', {}, 'เวลา'), h('dd', {}, s.time)),
        s.contact ? h('a', { class: 'go', href: '#quote', onclick: e => { e.preventDefault(); askTeam('ระบบ VRV / VRF'); } }, 'ติดต่อทีมโครงการ') : h('a', { class: 'go', href: '#' + (page[s.id] || 'pricing') }, s.key ? 'ประเมินงบทั้งปี' : 'ดูรายละเอียดและราคา'))));
    }),
    shop: once(() => {
      const cat = mountCatalog($('[data-catalog]'), {
        pageSize: 12, toast,
        skeleton: () => h('div', { class: 'skel', 'aria-hidden': 'true' }, h('i', { style: 'aspect-ratio:4/3' }), h('i', { style: 'height:14px;width:50%' }), h('i', { style: 'height:18px;width:80%' }), h('i', { style: 'height:34px' })),
        cardTpl: (m, skus, si, act) => {
          const b = BRAND_BY_ID[m.brand], t = TYPE_BY_ID[m.type], s = skus[si];
          return h('article', { class: 'card' },
            h('div', { class: 'ph' }, productVisual(m, s, { tag: t.th })),
            h('p', { class: 'br' }, b.name, b.own ? h('b', { class: 'own-tag' }, 'แบรนด์เรา') : null, m.inverter ? h('span', {}, '· Inverter') : null),
            h('h3', {}, m.series),
            h('div', { class: 'btu-chips', role: 'radiogroup', 'aria-label': 'ขนาด BTU' }, skus.map((k, i) => h('button', { type: 'button', role: 'radio', class: 'bchip', 'aria-checked': i === si, onclick: () => act.pick(i) }, (k.btu / 1000) + 'k'))),
            h('div', { class: 'pr' }, h('b', {}, baht(s.price)), h('span', { class: 'st o' }, 'ก่อน VAT')),
            h('p', { class: 'inst' }, s.installStdEx ? `พร้อมติดตั้งมาตรฐาน ${baht(s.px + s.installStdEx)}` : 'ติดตั้ง: ประเมินหน้างาน'),
            h('div', { class: 'acts' }, h('button', { type: 'button', class: 'open', onclick: () => openProduct(m, m.skus.indexOf(s)) }, 'รายละเอียด'), h('button', { type: 'button', 'aria-pressed': act.inCompare, onclick: act.compare }, icon(act.inCompare ? 'check' : 'plus', { size: 15 }), 'เทียบ')));
        },
        rowTpl: (m, skus) => h('table', { class: 'rows' }, h('tbody', {}, skus.map(s => h('tr', {},
          h('td', { class: 'mono' }, s.sku), h('td', {}, BRAND_BY_ID[m.brand].name), h('td', {}, m.series), h('td', {}, TYPE_BY_ID[m.type].th),
          h('td', { class: 'r' }, s.btu.toLocaleString()), h('td', { class: 'r' }, baht(s.price)), h('td', { class: 'r' }, s.installStdEx ? baht(s.px + s.installStdEx) : '—'),
          h('td', {}, h('button', { type: 'button', class: 'chip', onclick: () => openProduct(m, m.skus.indexOf(s)) }, 'เปิด')))))),
        onOpen: (m, s) => openProduct(m, m.skus.indexOf(s)),
        onCompare: items => { const body = $('#drawerBody'); body.innerHTML = ''; body.append(h('h3', { style: 'font-size:22px;margin-bottom:12px' }, 'เทียบรุ่น'), compareTable(items), h('p', { class: 'pd-note', style: 'margin-top:10px' }, 'แถวที่ไฮไลต์ = ค่าที่ต่างกัน')); openDrawer(drawer); },
      });
      // filters move into the bottom sheet on narrow screens
      const facets = $('[data-cat-facets]'), home = facets.parentElement;
      const mq = matchMedia('(max-width:1080px)'); const place = () => (mq.matches ? $('#sheetBody') : home).append(facets); mq.addEventListener('change', place); place();
      mountStudio($('#studioRoot'), { theme: 'light', sceneStart: 'bedroom', onOpen: (m, i) => openProduct(m, i) });
      FIT = mountRoomFit($('#fitRoot'), { theme: 'light', preset: 'bedroom', onOpenModel: (m, i) => openProduct(m, i) });
      const fuj = $('#fujArt'); if (fuj) fuj.append(productVisual({ type: 'wall', brand: 'fujiva', series: 'FUJIVA Inverter' }, null, { size: 'card' }));
      return cat;
    }),
    cleaning: once(() => {
      mountJobGuide($('#cleanRoot'), { theme: 'light', start: 'C1', type: 'wall', job: 'clean' });
      mountViewer($('#insideBox'), { style: 'studio', autoRotate: false, dirt: 0.7, onCleaned: () => toast('ล้างเสร็จ · ลมกลับมาแรงขึ้น (แบบจำลอง)') });
    }),
    install: once(() => {
      mountJobGuide($('#installRoot'), { theme: 'light', type: 'wall', job: 'install' });
      mountMaterials($('#qualityRoot'), { theme: 'light' });
      mountProjects($('#projRoot'), { onCatalog: () => site.go('catalog') });
    }),
    repair: once(() => {
      // the concierge without a 3D stage: its causes, plan and price lines stand on their own (r13: no simulated unit here)
      const still = { set() {}, with() {}, on() { return () => {}; } };
      mountConcierge($('#askRoot'), { stage: still, slot: null, labels: null, place: 'home',
        onBook: p => { BK.preset(p || {}); site.go('booking'); },
        onPrices: tab => prices_(tab),
        onShop: () => site.go('catalog') });
      let SVX = null;
      const HWX = mountHowItWorks($('#howRoot'), { theme: 'light', throwStyle: 'remote', onType: t => SVX && SVX.setType(t) });
      SVX = mountServices($('#servicesRoot'), { how: false, start: 'repair', onType: t => HWX.setType(t), onPart: p => HWX.focusPart(p) });
      return SVX;
    }),
    business: once(() => {
      mountAmc($('#amcRoot')); mountSop($('#sopRoot'));
      PRESETS.forEach(p => $('#presets').append(h('button', { type: 'button', 'data-b-preset': p.id, 'aria-pressed': 'false' }, p.th, h('small', {}, p.sub))));
      TYPES.forEach(t => $('#ucards').append(h('div', { class: 'ucard' },
        h('div', { html: typeArt(t.id) }), h('h3', {}, t.th),
        h('div', { class: 'stp' }, h('button', { type: 'button', 'data-b-step': `${t.id}:-1`, 'aria-label': `ลด ${t.th}` }, '−'), h('input', { type: 'number', min: '0', id: `v3-u-${t.id}`, 'data-b-unit': t.id, 'aria-label': `จำนวน ${t.th}`, inputmode: 'numeric' }), h('button', { type: 'button', 'data-b-step': `${t.id}:1`, 'aria-label': `เพิ่ม ${t.th}` }, '+')),
        h('div', { class: 'bar' }, h('i', { 'data-b-bar': t.id })))));
      const BLD = mountBuilder($('[data-builder]'));
      $$('[data-quote]').forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        const est = BLD && BLD.estimate();
        if (est && est.count) cart.add({ kind: 'service', group: 'contract', key: 'K-' + [est.count, est.visits, BLD.state().pkg].join('-'), name: `สัญญาล้างรายปี ${est.count} เครื่อง × ${est.visits} ครั้ง/ปี`, detail: `${BLD.state().pkg} · ${est.tierTh}${est.travel ? ' · รวมค่าเดินทางแล้ว' : ''}`, unitEx: est.annualEx, qty: 1, units: est.count });
        CART.open();
      }));
      return BLD;
    }),
    pricing: once(() => mountPriceCenter($('#priceCenter'))),
    guide: once(() => mountKnowledge($('#learnRoot'), { ids: { cleanflow: 'cleanflow', fit: 'fit', studio: 'studio', howto: 'howto', catalog: 'catalog', inside: 'inside', prices: 'prices', quality: 'quality', b2b: 'b2b', area: 'area', quote: 'quote' } })),
    contact: once(() => {
      $('#travelTbl').append(travelTable());
      const zoneRoot = $('#area [data-zone]'), zIn = $('[data-z-input]', zoneRoot);
      let TMAP = null;
      mountZone(zoneRoot, { onResult: z => TMAP && TMAP.highlight(z) });
      mountThaiMap($('#mapRoot'), { theme: 'light', onPick: th => { zIn.value = th; zIn.dispatchEvent(new Event('input')); } }).then(m => { TMAP = m; });
    }),
  };
  const ensure = v => (M[v] ? M[v]() : null);
  const prices_ = tab => { const PC = ensure('pricing'); site.go('prices'); if (PC && tab) PC.show(tab); return PC; };
  // a price link on any page (data-pc="clean|install|repair|…") opens that tab of the price centre
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-pc]'); if (!a) return; e.preventDefault(); prices_(a.dataset.pc); });

  const views = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.ids]));
  const viewDefs = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, { th: v.th, lead: v.lead }]));
  const site = mountSite({
    variant, openCart: CART.open, views, viewDefs, order: Object.keys(PAGES), labels: LABELS, navFmt, hubLabel,
    openModel: m => openProduct(m, 0),
    priceItem: (tab, q) => { prices_(tab); const x = $('#pc-search'); if (x) { x.value = q; x.dispatchEvent(new Event('input')); } },
    facts: {
      cleaning: () => [svcFrom('clean') && `ล้าง${svcFrom('clean')}`, `ยอดขั้นต่ำต่อการเข้า ${baht(DATA.minBill)} ก่อน VAT`, 'ล้างปกติ C1 · ล้างใหญ่ C2', 'รายงานหลังงานรายเครื่อง'],
      install: () => [svcFrom('install') && `ติดตั้ง${svcFrom('install')}`, 'มาตรฐาน · พรีเมียม', 'วัสดุระบุยี่ห้อในใบเสนอราคา', 'รับประกันงานติดตั้ง 3 ปี เมื่อซื้อเครื่องจากบริษัท'],
      repair: () => [svcFrom('repair'), 'แจ้งราคาให้อนุมัติก่อนซ่อม', 'กรุงเทพฯ และปริมณฑล ไม่มีค่าเดินทาง'],
      pricing: () => ['ราคาจาก Pricebook 2569', 'ราคาก่อน VAT ปัดหลักร้อย', 'ต้องการใบกำกับภาษีบวก VAT 7%'],
      guide: () => ['ตัวเลขมาจากสูตรเดียวกับเครื่องมือคำนวณ', 'ภาพ 3 มิติเป็นแบบจำลองเพื่ออธิบาย'],
    },
    next: {
      shop: [{ cart: 1, th: 'ดูใบเสนอราคาของคุณ', sub: 'รวมเครื่อง ติดตั้ง อุปกรณ์เสริม และ VAT' }, { go: 'installflow', th: 'ดูขั้นตอนติดตั้งของทีม', sub: 'มาตรฐาน / พรีเมียม ทดสอบอะไรบ้าง' }, { go: 'area', th: 'ตรวจพื้นที่และค่าเดินทาง', sub: 'ไม่มีค่าเดินทางในกรุงเทพฯ และปริมณฑล' }],
      cleaning: [{ book: { service: 'clean' }, th: 'จองคิวล้างแอร์', sub: 'เลือกวันและช่วงเวลา ทีมโทรยืนยัน' }, { go: 'b2b', th: 'มีหลายเครื่อง ดูสัญญาล้างรายปี', sub: 'ราคาขั้นบันไดตามจำนวนเครื่อง' }, { go: 'prices', th: 'ดูราคาทุกบริการ', sub: 'ล้าง ติดตั้ง ซ่อม อุปกรณ์เสริม' }],
      install: [{ book: { service: 'install' }, th: 'จองคิวสำรวจหรือติดตั้ง', sub: 'ทีมยืนยันราคาก่อนเริ่มงาน' }, { go: 'catalog', th: 'ยังไม่มีเครื่อง เลือกรุ่นแอร์', sub: 'ทุกรุ่นพร้อมราคาติดตั้ง' }, { cart: 1, th: 'ดูใบเสนอราคาของคุณ', sub: 'รายการที่กดเพิ่มไว้ รวมยอดให้' }],
      repair: [{ book: { service: 'repair' }, th: 'จองคิวตรวจเช็ก', sub: 'แจ้งอาการ ทีมโทรยืนยันวันเวลา' }, { go: 'cleanflow', th: 'อาการที่เกิดจากความสกปรก', sub: 'ดูขั้นตอนล้าง C1 / C2' }, { go: 'prices', th: 'ค่าตรวจเช็กและค่าซ่อม', sub: 'ราคามาตรฐานจาก Pricebook' }],
      business: [{ book: { service: 'amc' }, th: 'นัดสำรวจทำรายการเครื่อง', sub: 'ทีมขายเตรียมใบเสนอราคาสัญญา' }, { go: 'cleanflow', th: 'ดูมาตรฐานงานล้าง', sub: 'ขั้นตอนตามแบบฟอร์มของบริษัท' }, { go: 'projects', th: 'งานติดตั้งทั้งพื้นที่', sub: 'สร้างใหม่ รีโนเวต เปลี่ยนทั้งชุด' }],
      pricing: [{ cart: 1, th: 'ดูใบเสนอราคาของคุณ', sub: 'รวมยอด เลือกใบกำกับภาษีได้' }, { book: { service: 'clean' }, th: 'จองคิวกับทีม', sub: 'เลือกวันและช่วงเวลา' }, { go: 'catalog', th: 'ซื้อแอร์ใหม่พร้อมติดตั้ง', sub: 'ทุกรุ่นพร้อมราคา' }],
      guide: [{ go: 'studio', th: 'หาขนาด BTU ที่เหมาะ', sub: 'เลือกห้องที่ใกล้เคียงของคุณ' }, { go: 'ask', th: 'แอร์มีอาการ เช็กสาเหตุ', sub: 'สาเหตุที่พบบ่อยและค่าตรวจเช็ก' }, { ask: 'อื่น ๆ', th: 'ถามทีมของเรา', sub: 'ฝากคำถาม ทีมติดต่อกลับ' }],
      contact: [{ go: 'home', th: 'กลับไปเลือกงาน', sub: 'เริ่มจากสิ่งที่ต้องการ' }, { go: 'catalog', th: 'ดูรุ่นแอร์', sub: 'พร้อมราคาติดตั้ง' }, { go: 'cleanflow', th: 'ดูทีมช่างทำงาน', sub: 'ล้างทีละขั้น' }],
    },
    hooks: {
      onView: v => {
        ensure(v); document.documentElement.dataset.page = v;
        // a scrolling row of page tabs (phones, C3) keeps the current page in sight
        const a = document.querySelector(`header nav a[data-v="${v}"]`), nav = a && a.parentElement;
        if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: 'auto' });
      },
      repair: () => { const s = ensure('repair'); s && s.set && s.set('repair'); },
    },
  });
  mountMobileMenu();
  document.documentElement.classList.add('v3-on');
  return { site, ensure };
}
