// SBP AirCare — site structure for the beta (Rev.09 r5, owner 2 ต.ค. 2569: "เน้นทำ UX/UI และ feature ให้สมบูรณ์ ใช้งานได้จริง เตรียม
// beta test ให้ลูกค้าทดลองใช้ทั้ง 3 แบบ … จัดเรียงให้ใช้งานได้จริงแบบเป็น section หมวดหมู่ workflow และ customer experience / journey").
// The long single page becomes 6 views that follow how a customer decides:
//   หน้าแรก (what do you need?) · ซื้อแอร์ · ล้าง/ติดตั้ง/ซ่อม · สำหรับองค์กร · ความรู้·ลองเอง · ติดต่อเรา
// Every existing section keeps its id and its module; this module only shows the view a section belongs to — the menu, hash links,
// in-page links and scrollIntoView() calls all switch views — and adds: a short intro + jump links at the top of each view,
// "next step" cards at the bottom, an intent picker on the home view that starts a guided journey (a step strip that follows the
// customer across views and remembers progress), the company / contact block, the beta notice + feedback form, and the footer.
// Hidden views do not boot their 3D (scenes start on IntersectionObserver), so each view is lighter than the old page.
import { icon } from './icons.js';
import { h, $, $$, COMPANY, DEMO, DATA, BRANDS, BRAND_BY_ID, TYPE_BY_ID, PROCESS, SERVICES, FAQ, baht, isVRF, logoSrc } from './sbp-core.js';
import { GUIDES } from './knowledge.js';
import { cart } from './commerce.js';
import { askTeam, handoffBox, guardForm, submitTicket, requestBooking, honeypot } from './contact.js';
import { quoteFromCart, sourceTag } from './ticket.js';
import { openFeedback, trapFocus, perfButton } from './feedback.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: the page still works */ } },
};

export const VIEWS = {
  home: { th: 'หน้าแรก' },
  shop: { th: 'ซื้อแอร์', lead: 'หาขนาดที่เหมาะกับห้อง เลือกรุ่นพร้อมราคาติดตั้ง แล้วลองวางในห้องของคุณก่อนตัดสินใจ' },
  service: { th: 'ล้าง ติดตั้ง ซ่อม', lead: 'ดูทีมช่างทำงานทีละขั้น เทียบระดับงาน ราคามาตรฐานจาก Pricebook และวัสดุที่ระบุไว้ในทุกแพ็กเกจ' },
  business: { th: 'สำหรับองค์กร', lead: 'สัญญาล้างรายปีราคาขั้นบันไดตามจำนวนเครื่อง รายงานรายเครื่องทุกรอบ และงานโครงการ: สร้างใหม่ รีโนเวต เปลี่ยนแอร์ทั้งชุด' },
  knowledge: { th: 'ความรู้และทดลอง', lead: 'อ่านสั้น ๆ ก่อนตัดสินใจ แล้วลองกับเครื่องมือจำลอง: แอร์ทำงานอย่างไร ลมเย็นไปทางไหน ล้างแล้วได้อะไร' },
  contact: { th: 'ติดต่อเรา', lead: 'ข้อมูลบริษัท ช่องทางติดต่อ พื้นที่ให้บริการ และส่งคำขอให้ทีมติดต่อกลับ' },
};
const SEC_TH = {
  hero: 'เริ่มต้น', start: 'เลือกสิ่งที่ต้องการ', flow: 'ขั้นตอนใช้บริการ', services: 'บริการของเรา', 'proc-sec': 'ขั้นตอนทำงาน',
  catalog: 'เลือกรุ่นและราคา', studio: 'หาขนาด BTU ตามห้อง', room: 'หาขนาด BTU ตามห้อง', fit: 'ลองวางในห้องของคุณ',
  cleanflow: 'ทีมช่างทำงานทีละขั้น', prices: 'ราคาทุกบริการ', quality: 'วัสดุในแพ็กเกจ', story: 'ล้างถึงชิ้นไหน', inside: 'ข้างในแอร์',
  howto: 'แอร์ทำงานอย่างไร และขั้นตอนบริการ', b2b: 'ประเมินงบสัญญารายปี', amc: 'ราคาขั้นบันไดและจุดเด่น', sop: 'ขั้นตอนสัญญาและรายงาน', projects: 'งานโครงการ · รีโนเวต', learn: 'คู่มือก่อนตัดสินใจ', journey: 'แอร์ทำงานอย่างไร',
  about: 'เกี่ยวกับเรา', area: 'พื้นที่ให้บริการ', faq: 'คำถามที่พบบ่อย', quote: 'ส่งคำขอ', booking: 'จองคิว',
};
// guided journeys: [section id (alternatives a|b), what the customer does there]; 'quote' = the quotation (or the contact form)
export const JOURNEYS = {
  clean: { th: 'ล้างแอร์', sub: 'บ้าน คอนโด ร้าน สำนักงาน · ล้างปกติ C1 หรือล้างใหญ่ C2', topic: 'ล้างแอร์', ico: 'M4 9h16v6H4zM7 15v3M12 15v4M17 15v3',
    steps: [['cleanflow', 'ดูขั้นตอนช่าง เลือก C1 / C2'], ['prices', 'ดูราคาตามประเภทและขนาด'], ['area', 'ตรวจพื้นที่และค่าเดินทาง'], ['booking|quote', 'จองคิวล้าง']] },
  buy: { th: 'ซื้อแอร์ใหม่ + ติดตั้ง', sub: '', topic: 'ซื้อแอร์', ico: 'M3 7h18v8H3zM6 15v2M18 15v2M7 11h6',
    steps: [['studio|room', 'หาขนาด BTU ที่เหมาะกับห้อง'], ['catalog', 'เลือกรุ่นและแพ็กเกจติดตั้ง'], ['fit', 'ลองวางในห้องของคุณ'], ['quote', 'ส่งใบเสนอราคา']] },
  install: { th: 'ติดตั้ง / ย้ายแอร์', sub: 'มีเครื่องแล้ว · ติดตั้งมาตรฐาน หรือพรีเมียม', topic: 'ติดตั้งแอร์', ico: 'M14 4l6 6-9 9H5v-6z',
    steps: [['installflow|cleanflow', 'ดูขั้นตอนติดตั้งของทีม'], ['quality', 'วัสดุที่ใช้ในแต่ละแพ็กเกจ'], ['prices', 'ราคาติดตั้งตามขนาด'], ['booking|quote', 'จองคิวสำรวจ / ติดตั้ง']] },
  repair: { th: 'แอร์มีปัญหา / ซ่อม', sub: 'ไม่เย็น น้ำหยด มีเสียง มีกลิ่น', topic: 'ซ่อม / ตรวจเช็ก', ico: 'M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9',
    steps: [['ask|howto', 'เช็กอาการเบื้องต้นและขั้นตอนตรวจซ่อม'], ['prices', 'ค่าตรวจเช็กและค่าซ่อม'], ['booking|quote', 'จองคิวตรวจเช็ก แจ้งอาการ']] },
  business: { th: 'องค์กร / สัญญารายปี', sub: 'สำนักงาน ร้านค้า โรงงาน อาคาร', topic: 'สัญญาล้างรายปี', ico: 'M4 20V8l8-4 8 4v12M9 20v-6h6v6',
    steps: [['amc', 'ดูราคาขั้นบันไดและจุดเด่น'], ['b2b', 'ประเมินงบล้างทั้งปี'], ['sop', 'ขั้นตอนสัญญาและตัวอย่างรายงาน'], ['booking|quote', 'นัดสำรวจทำรายการเครื่อง']] },
  // Rev.09 r9: projects — new build, renovation without AC, replacement with trade-in
  project: { th: 'สร้างใหม่ / รีโนเวต / เปลี่ยนทั้งชุด', sub: 'บ้านและอาคารสร้างใหม่ พื้นที่รีโนเวต เปลี่ยนแอร์เดิมพร้อมเทิร์น', topic: 'งานโครงการ / รีโนเวต / เปลี่ยนทั้งชุด', ico: 'M3 20h18M5 20V10l7-5 7 5v10M9 20v-5h6v5M14 9h3',
    steps: [['projects', 'เลือกแบบงานและประมาณการทีละห้อง'], ['fit', 'วางแอร์ในห้องจริงทีละห้อง'], ['catalog', 'เลือกรุ่นแอร์'], ['booking|quote', 'จองคิวสำรวจหน้างาน']] },
};
// what to do after each view
const NEXT = {
  shop: [{ cart: 1, th: 'ดูใบเสนอราคาของคุณ', sub: 'รวมเครื่อง ติดตั้ง อุปกรณ์เสริม และ VAT' }, { go: 'area', th: 'ตรวจพื้นที่และค่าเดินทาง', sub: 'ฟรีในกรุงเทพฯ และปริมณฑล' }, { go: 'cleanflow', pre: 'install', th: 'ดูขั้นตอนติดตั้งของทีม', sub: 'มาตรฐาน / พรีเมียม ทดสอบอะไรบ้าง' }],
  service: [{ cart: 1, th: 'ดูใบเสนอราคาของคุณ', sub: 'รายการที่กดเพิ่มไว้ รวมยอดให้' }, { book: { service: 'clean' }, th: 'จองคิวกับทีม', sub: 'เลือกวันและช่วงเวลา ทีมโทรยืนยัน' }, { go: 'catalog', th: 'ซื้อแอร์ใหม่พร้อมติดตั้ง', sub: 'ทุกรุ่นพร้อมราคา' }],
  business: [{ book: { service: 'amc' }, th: 'นัดสำรวจทำรายการเครื่อง', sub: 'ทีมขายเตรียมใบเสนอราคาสัญญา' }, { go: 'cleanflow', pre: 'clean', th: 'ดูมาตรฐานงานล้าง', sub: 'ขั้นตอนตามแบบฟอร์มของบริษัท' }, { go: 'area', th: 'พื้นที่ให้บริการ', sub: 'และค่าเดินทางนอกพื้นที่หลัก' }],
  knowledge: [{ go: 'studio|room', th: 'หาขนาด BTU ที่เหมาะ', sub: 'เลือกห้องที่ใกล้เคียงของคุณ' }, { go: 'catalog', th: 'ดูรุ่นแอร์และราคา', sub: 'เทียบรุ่นได้' }, { ask: 'อื่น ๆ', th: 'ถามทีมของเรา', sub: 'ฝากคำถาม ทีมติดต่อกลับ' }],
  contact: [{ go: 'home', th: 'กลับไปเลือกบริการ', sub: 'เริ่มจากสิ่งที่ต้องการ' }, { go: 'catalog', th: 'ดูรุ่นแอร์', sub: 'พร้อมราคาติดตั้ง' }, { go: 'cleanflow', th: 'ดูทีมช่างทำงาน', sub: 'ล้าง และติดตั้ง ทีละขั้น' }],
};
// r10: journey → booking service (ticket.js SERVICES)
const JSVC = { clean: 'clean', install: 'install', repair: 'repair', business: 'amc', project: 'project' };
const svgI = d => h('span', { class: 'sx-ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>` });

/**
 * mountSite({ variant, views: { home: [ids…], shop: […], … }, order, navFmt(i, th), labels, hooks: { clean, install, repair, business, buy }, openCart, openModel(m), priceItem(tab, q) })
 * → { go(id), view(), startJourney(key), openFeedback(), openSearch() }
 */
export function mountSite(cfg) {
  const { variant = 'A', views, order = ['home', 'shop', 'service', 'business', 'knowledge', 'contact'], hooks = {}, openCart = () => {}, openModel = null, priceItem = null, navFmt = (i, th) => th, labels = {}, viewDefs = {}, facts = {}, next = {}, hubLabel = 'หน้ารวมทุกแบบ' } = cfg;
  // r13: an edition may add or rename views ({id: {th, lead}}), and give them their own facts and next-step cards
  const VV = { ...VIEWS, ...viewDefs };
  document.documentElement.classList.add('sx-on');
  const L = id => labels[id] || SEC_TH[id] || id;
  /* ---- 1 · which view each section belongs to ---- */
  const VOF = {}, ELS = {};
  Object.entries(views).forEach(([v, ids]) => { ELS[v] = []; ids.forEach(id => { const el = document.getElementById(id); if (!el) return; el.dataset.sx = v; VOF[id] = v; ELS[v].push(el); }); });
  Object.values(ELS).forEach(l => l.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));   // page order, not config order
  const pick = ids => ids.split('|').find(id => VOF[id]);
  const live = order.filter(v => ELS[v] && ELS[v].length);

  /* ---- 2 · menu ---- */
  const nav = $('header nav');
  if (nav) { nav.innerHTML = ''; live.forEach((v, i) => nav.append(h('a', { href: '#' + v, 'data-v': v }, navFmt(i, VV[v].th)))); }
  const navLinks = nav ? $$('a[data-v]', nav) : [];

  /* ---- 3 · intro + jump links at the top of every view, next-step cards at the bottom ---- */
  // r6: the deciding facts of each view, from the same data the tools use (r9: prices are round hundreds before VAT; rules §6.6 #1 #3 #8 #10)
  const svcFrom = id => (SERVICES.find(x => x.id === id) || {}).from || '';
  const minPrice = () => { const ps = DEMO.models.flatMap(m => m.skus.map(x => x.price)).filter(n => n > 0); return ps.length ? Math.min(...ps) : 0; };
  const FACTS = {
    shop: () => [`${DEMO.skuCount} รุ่น ${BRANDS.filter(b => b.n).length} แบรนด์`, minPrice() ? `เครื่องเริ่ม ${baht(minPrice())} ก่อน VAT` : '', 'การ์ดแสดงราคาพร้อมติดตั้งมาตรฐาน', 'รับประกันงานติดตั้ง 3 ปี เมื่อซื้อเครื่องจากบริษัท'],
    service: () => [svcFrom('clean') && `ล้าง${svcFrom('clean')}`, svcFrom('install') && `ติดตั้ง${svcFrom('install')}`, svcFrom('repair'), 'กรุงเทพฯ และปริมณฑล ไม่มีค่าเดินทาง'],
    business: () => ['ราคาต่อปีจาก Pricebook คำนวณเองได้', 'สร้างใหม่ · รีโนเวต · เปลี่ยนทั้งชุด', `ยอดขั้นต่ำงานล้าง ${baht(DATA.minBill)} ก่อน VAT ต่อการเข้า`, 'รายงานรายเครื่องทุกรอบ', 'ราคาขั้นบันได 10 เครื่องขึ้นไป ลดสูงสุด 7%'],
    knowledge: () => [`${GUIDES.length} หัวข้อ อ่านจบในไม่กี่นาที`, 'ตัวเลขมาจากสูตรเดียวกับเครื่องมือคำนวณ', 'ภาพ 3 มิติเป็นแบบจำลองเพื่ออธิบาย'],
    contact: () => [`โทร ${COMPANY.tel}`, COMPANY.email, 'ตอบกลับในเวลาทำการ'],
  };
  const INTRO = {};
  live.filter(v => v !== 'home').forEach(v => {
    const els = ELS[v], first = els[0], last = els[els.length - 1];
    const js = h('div', { class: 'sx-js', hidden: true });
    const h1 = h('h1', { tabindex: '-1' }, VV[v].th);
    const fx = facts[v] || FACTS[v], fl = fx ? fx().filter(Boolean) : [];
    const box = h('div', { class: 'sx-vh', 'data-sx': v },
      h('p', { class: 'sx-crumb' }, h('a', { href: '#home' }, 'หน้าแรก'), h('span', { 'aria-hidden': 'true' }, ' / '), h('span', {}, VV[v].th)),
      h1, h('p', { class: 'sx-lead' }, VV[v].lead),
      fl.length ? h('ul', { class: 'sx-facts', 'aria-label': 'ข้อมูลสำคัญ' }, fl.map(t => h('li', {}, t))) : null,
      els.length > 1 ? h('nav', { class: 'sx-jump', 'aria-label': 'หัวข้อในหน้านี้' }, els.map((el, i) => h('a', { href: '#' + el.id }, h('b', {}, String(i + 1)), L(el.id)))) : null, js);
    if (!first.parentElement.closest('.wrap')) box.classList.add('wrap');   // a full-bleed section (C #journey) sits outside the page column
    first.parentNode.insertBefore(box, first);
    if (!box.closest('main,[role="main"],section,aside,nav,header,footer')) { box.setAttribute('role', 'region'); box.setAttribute('aria-label', VV[v].th); }   // r13: a page heading outside <main> (C #journey) is still in a landmark
    // r13: a page photo written in the markup (<figure data-sx-photo="<view>">) joins the page heading
    const ph = document.querySelector(`[data-sx-photo="${v}"]`); if (ph) { box.classList.add('has-ph'); box.append(ph); ph.hidden = false; }
    INTRO[v] = { box, js, h1 };
    const cards = (next[v] || NEXT[v] || []).map(nextCard).filter(Boolean);
    if (cards.length) last.parentNode.insertBefore(h('div', { class: 'sx-next' + (last.parentElement.closest('.wrap') ? '' : ' wrap'), 'data-sx': v }, h('h2', {}, 'ขั้นต่อไป'), h('div', { class: 'sx-next-g' }, cards)), last.nextSibling);
  });
  function nextCard(n) {
    const target = n.cart ? 'quote' : n.book ? (VOF.booking ? 'booking' : 'quote') : n.ask ? 'quote' : VV[n.go] ? n.go : pick(n.go);
    if (!target) return null;
    const a = h('a', { class: 'sx-nc', href: '#' + target }, h('b', {}, n.th), n.sub ? h('small', {}, n.sub) : null);
    a.addEventListener('click', e => {
      if (n.cart) { e.preventDefault(); if (cart.items.length) openCart(); else { go('quote'); } return; }
      if (n.book) { e.preventDefault(); requestBooking(n.book); return; }
      if (n.ask) { e.preventDefault(); askTeam(n.ask); return; }
      if (n.pre && hooks[n.pre]) hooks[n.pre]();
    });
    return a;
  }

  /* ---- 4 · router: views, hash links, scrollIntoView ---- */
  let cur = null;
  const seen = new Set();
  function show(v, scroll = 'top', focus = false) {
    if (!ELS[v] || !ELS[v].length) v = 'home';
    if (v !== cur) {
      cur = v; seen.add(v);
      $$('[data-sx]').forEach(el => { el.hidden = el.dataset.sx !== v; });
      navLinks.forEach(a => { if (a.dataset.v === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      document.documentElement.dataset.sxView = v;
      try { document.title = v === 'home' ? baseTitle : `${VV[v].th} · ${baseTitle}`; } catch (e) { /* ignore */ }
      paintJourney(); observeSteps();
      hooks.onView && hooks.onView(v);
    }
    if (scroll === 'top') instant(() => scrollTo({ top: 0, behavior: 'instant' }), () => scrollTo(0, 0));   // a new view starts at its top at once
    if (focus && INTRO[v]) INTRO[v].h1.focus({ preventScroll: true });
  }
  const baseTitle = document.title;
  const push = id => { try { history.pushState(null, '', '#' + id); } catch (e) { /* sandboxed: fine without history */ } };
  const ORIG = Element.prototype.scrollIntoView;
  // instant jump (CSS scroll-behavior:smooth on the page would otherwise animate it); older browsers without 'instant' get the CSS switched off for the call
  function instant(f, legacy) { const de = document.documentElement, sb = de.style.scrollBehavior; de.style.scrollBehavior = 'auto'; try { f(); } catch (e) { legacy(); } de.style.scrollBehavior = sb; }
  const jumpTo = el => instant(() => ORIG.call(el, { block: 'start', behavior: 'instant' }), () => ORIG.call(el, { block: 'start' }));
  let touched = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, () => { touched = true; }, { once: true, passive: true }));
  function go(id, { pushHash = true, initial = false } = {}) {
    if (id === 'top' || id === '') id = 'home';
    if (VV[id]) { show(id, 'top', true); if (pushHash) push(id); return; }
    const el = document.getElementById(id); if (!el) return;
    const sec = el.closest('[data-sx]');
    if (sec) show(sec.dataset.sx, null);
    if (pushHash) push(id);
    // opening a link to a section: jump there, and once more after scenes above it have booted and settled their height
    if (initial) { requestAnimationFrame(() => jumpTo(el)); setTimeout(() => { if (!touched) jumpTo(el); }, 900); return; }
    requestAnimationFrame(() => ORIG.call(el, { behavior: RM() ? 'auto' : 'smooth', block: 'start' }));
  }
  // any code that scrolls to a section in another view (knowledge "ลองเอง", product → "ลองวางในห้อง", askTeam …) switches the view first
  Element.prototype.scrollIntoView = function (o) {
    const sec = this.closest && this.closest('[data-sx]');
    if (sec && sec.dataset.sx !== cur) { show(sec.dataset.sx, null); const el = this; requestAnimationFrame(() => ORIG.call(el, o)); return; }
    return ORIG.call(this, o);
  };
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id === 'top' || VV[id] || (id && document.getElementById(id) && document.getElementById(id).closest('[data-sx]'))) { e.preventDefault(); go(id); }
  });
  addEventListener('popstate', () => route(location.hash, false));
  addEventListener('hashchange', () => route(location.hash, false));
  function route(hash, initial) {
    const id = decodeURIComponent((hash || '').replace(/^#/, ''));
    if (!id) { show('home', initial ? null : 'top'); return; }
    go(id, { pushHash: false, initial });
  }

  /* ---- 5 · guided journey (intent → steps across views) ---- */
  let J = store.get('sbp-journey-v1', null); if (J && !JOURNEYS[J.k]) J = null;
  const stepsOf = k => JOURNEYS[k].steps.map(([ids, th], i) => ({ i, id: ids === 'quote' ? 'quote' : pick(ids), th })).filter(s => s.id);
  const saveJ = () => store.set('sbp-journey-v1', J);
  const here = h('div', { class: 'sx-here', hidden: true });
  let hereStep = null;
  function goStep(s) {
    if (s.id === 'quote') { if (cart.items.length) { openCart(); markDone(s.i); } else askTeam(JOURNEYS[J.k].topic); return; }
    if (s.id === 'booking') document.dispatchEvent(new CustomEvent('sbp:book', { detail: { service: JSVC[J.k] || 'other' }, cancelable: true }));   // r10: preset the booking form
    hereStep = s; const el = document.getElementById(s.id);
    if (el) { el.before(here); here.dataset.sx = el.dataset.sx; }
    go(s.id); paintHere();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!here.hidden) ORIG.call(here, { behavior: RM() ? 'auto' : 'smooth', block: 'start' }); }));
  }
  function paintHere() {
    here.innerHTML = '';
    if (!J || !hereStep || !here.isConnected) { here.hidden = true; return; }
    const steps = stepsOf(J.k), k = steps.findIndex(x => x.i === hereStep.i), nx = steps.slice(k + 1).find(x => !J.done.includes(x.i)) || steps.find(x => !J.done.includes(x.i) && x.i !== hereStep.i);
    here.append(h('p', {}, h('b', {}, `${JOURNEYS[J.k].th} · ขั้นที่ ${k + 1} จาก ${steps.length}`), h('span', {}, hereStep.th)),
      nx ? h('button', { type: 'button', class: 's-btn primary', onclick: () => goStep(nx) }, `ขั้นต่อไป: ${nx.th}`) : null);
    here.hidden = here.dataset.sx !== cur;
  }
  function markDone(i) { if (!J || J.done.includes(i)) return; J.done.push(i); saveJ(); paintJourney(); }
  function startJourney(k) {
    if (!JOURNEYS[k]) return; J = { k, done: [] }; saveJ();
    hooks[k] && hooks[k]();
    const s = stepsOf(k)[0]; if (s) goStep(s);
    paintJourney();
  }
  function stripEl() {
    const steps = stepsOf(J.k), nextS = steps.find(s => !J.done.includes(s.i)) || null, n = steps.filter(s => J.done.includes(s.i)).length;
    return h('div', { class: 'sx-jsi' },
      h('p', { class: 'sx-jst' }, h('b', {}, `เส้นทางของคุณ: ${JOURNEYS[J.k].th}`), h('span', {}, ` · ทำแล้ว ${n} จาก ${steps.length} ขั้น`)),
      h('ol', {}, steps.map((s, k) => h('li', {}, h('button', { type: 'button', class: (J.done.includes(s.i) ? 'done ' : '') + (nextS && s.i === nextS.i ? 'next' : ''), 'aria-label': `ขั้นที่ ${k + 1} ${s.th}${J.done.includes(s.i) ? ' (ทำแล้ว)' : ''}`, onclick: () => goStep(s) }, h('i', {}, J.done.includes(s.i) ? icon('check', { size: 14 }) : String(k + 1)), h('span', {}, s.th))))),
      h('div', { class: 'sx-jsa' },
        nextS ? h('button', { type: 'button', class: 's-btn primary', onclick: () => goStep(nextS) }, `ขั้นต่อไป: ${nextS.th}`) : h('p', { class: 'sx-jsd' }, 'ครบทุกขั้นแล้ว ทีมจะติดต่อกลับหลังได้รับสรุปคำขอของคุณ'),
        h('button', { type: 'button', class: 's-btn ghost', onclick: () => { J = null; saveJ(); paintJourney(); } }, 'ปิดเส้นทางนี้')));
  }
  const homeJ = h('div', { class: 'sx-js sx-js-home', hidden: true });
  function paintJourney() {
    Object.values(INTRO).forEach(x => { x.js.hidden = true; x.js.innerHTML = ''; });
    homeJ.hidden = true; homeJ.innerHTML = '';
    if (!J) { hereStep = null; here.remove(); return; }
    paintHere();
    const tgt = cur === 'home' ? homeJ : INTRO[cur] && INTRO[cur].js; if (!tgt) return;
    tgt.append(stripEl()); tgt.hidden = false;
  }
  // a step counts as done once its section has been on screen for a moment
  let stepIO = null;
  function observeSteps() {
    if (stepIO) stepIO.disconnect(); if (!J) return;
    const steps = stepsOf(J.k), timers = new Map();
    stepIO = new IntersectionObserver(es => es.forEach(e => {
      const s = steps.find(x => document.getElementById(x.id) === e.target); if (!s) return;
      if (e.isIntersecting) timers.set(s.i, setTimeout(() => markDone(s.i), 1800)); else clearTimeout(timers.get(s.i));
    }), { rootMargin: '-35% 0px -35% 0px' });   // crosses the middle of the screen (a threshold would never fire on very tall sections)
    steps.forEach(s => { const el = document.getElementById(s.id); if (el && el.dataset.sx === cur) stepIO.observe(el); });
  }

  /* ---- 6 · home: what do you need? + trust facts ---- */
  // r6: every path card carries a real starting price from the Pricebook (VAT included) — the deciding fact, not decoration.
  // Each card is a list item with one button; the button's hit area covers the whole card (CSS), so it is one target for touch
  // and one stop for the keyboard. Variants restyle the same markup: A bento tiles · B drawing register (code column) · C showroom zones.
  const startRoot = $('#startRoot');
  if (startRoot) {
    const nb = BRANDS.filter(b => b.n).length;
    const svc = id => (SERVICES.find(x => x.id === id) || {}).from || '';
    const prices = DEMO.models.flatMap(m => m.skus.map(x => x.price)).filter(n => n > 0);
    const PRICE = { clean: svc('clean'), buy: prices.length ? `เครื่องเริ่ม ${baht(Math.min(...prices))}` : '', install: svc('install'), repair: svc('repair'), business: 'ราคาขั้นบันได ลดสูงสุด 7%', project: svc('install') ? `ติดตั้ง${svc('install')}` : '' };
    JOURNEYS.buy.sub = `${DEMO.skuCount} รุ่น ${nb} แบรนด์ พร้อมราคาติดตั้ง`;
    const card = (k, code, j, steps, price, go, label, act) => h('li', { class: 'sx-int', 'data-k': k },
      svgI(j.ico), h('span', { class: 'sx-int-c', 'aria-hidden': 'true' }, code),
      h('h3', {}, j.th), h('p', { class: 'sx-int-s' }, j.sub),
      price ? h('p', { class: 'sx-int-p' }, price, /฿/.test(price) ? h('small', {}, ' ก่อน VAT') : null) : null,
      h('ol', { 'aria-label': 'ขั้นตอน' }, steps.map(t => h('li', {}, t))),
      h('button', { type: 'button', class: 'sx-int-go', 'aria-label': label, onclick: act }, go));
    const cards = ['clean', 'buy', 'install', 'repair', 'business', 'project'].map((k, n) => card(k, `S-0${n + 1}`, JOURNEYS[k], stepsOf(k).map(x => x.th), PRICE[k], 'เริ่ม', `เริ่มเส้นทาง ${JOURNEYS[k].th}`, () => startJourney(k)));
    cards.push(card('fujiva', 'S-07', { th: 'แอร์ FUJIVA', sub: 'แบรนด์ของบริษัท ราคากำลังจะขึ้นเว็บ', ico: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z' },
      ['สอบถามรุ่นและราคากับทีมขาย'], '', 'สอบถาม', 'สอบถามแอร์ FUJIVA กับทีมขาย', () => askTeam('FUJIVA')));
    const head = h('li', { class: 'sx-int-hd', 'aria-hidden': 'true' }, h('span', {}, 'รหัส'), h('span', {}, 'งาน'), h('span', {}, 'ขั้นตอนที่ระบบพาไป'), h('span', {}, 'ราคาเริ่มต้น'), h('span', {}));
    startRoot.append(homeJ, h('ul', { class: 'sx-ints', 'aria-label': 'เลือกงานที่ต้องการ' }, head, cards),
      h('ul', { class: 'sx-trust', 'aria-label': 'ทำไมเลือกเรา' }, [
        `ประสบการณ์ด้านแอร์ ${COMPANY.years}`, 'ทีมช่างของบริษัทเอง', 'ราคามาตรฐานจาก Pricebook แสดงก่อนเรียกช่าง', 'ใบกำกับภาษีเต็มรูป', 'รายงานหลังงานรายเครื่อง', 'วัสดุติดตั้งระบุยี่ห้อ'].map(t => h('li', {}, t))));
  }

  /* ---- 7 · about + contact ---- */
  // company facts written into page markup from one place (data-co="tel|email|addr|web|th")
  $$('[data-co]').forEach(el => { const k = el.dataset.co; if (!COMPANY[k]) return; el.textContent = COMPANY[k]; if (el.tagName === 'A' && k === 'tel') el.setAttribute('href', COMPANY.telHref); });
  const aboutRoot = $('#aboutRoot');
  if (aboutRoot) {
    const copyMsg = h('span', { class: 'sx-cm', 'aria-live': 'polite' });
    const copyBtn = (txt, ok) => h('button', { type: 'button', class: 'sx-copy', onclick: async () => { try { await navigator.clipboard.writeText(txt); copyMsg.textContent = ok; } catch (e) { copyMsg.textContent = 'เลือกข้อความแล้วคัดลอกจากเครื่องของคุณ'; } } }, 'คัดลอก');
    aboutRoot.append(h('div', { class: 'sx-about' },
      h('div', { class: 'sx-co' },
        h('p', { class: 'sx-co-b' }, `${COMPANY.brand} · บริการโดย ${COMPANY.service}`),
        h('h3', {}, COMPANY.th), h('p', { class: 'sx-co-en' }, COMPANY.en),
        h('p', {}, `ประสบการณ์ด้านอะไหล่ น้ำยา และอุปกรณ์เครื่องปรับอากาศ ${COMPANY.years} — ${COMPANY.trade} · ทีมบริการของบริษัทรับงานล้าง ติดตั้ง ซ่อม และย้ายแอร์ ทั้งบ้านและองค์กร และจำหน่ายแอร์ FUJIVA แบรนด์ของบริษัท`),
        h('dl', { class: 'sx-co-dl' },
          h('dt', {}, 'สำนักงาน'), h('dd', {}, COMPANY.addr, ' ', h('a', { href: COMPANY.mapUrl, target: '_blank', rel: 'noopener' }, 'เปิดแผนที่')),
          h('dt', {}, 'โทร'), h('dd', {}, h('a', { href: COMPANY.telHref }, COMPANY.tel)),
          h('dt', {}, 'อีเมล'), h('dd', {}, h('span', { class: 'sx-sel' }, COMPANY.email), ' ', copyBtn(COMPANY.email, 'คัดลอกอีเมลแล้ว'), copyMsg),
          h('dt', {}, 'เว็บไซต์บริษัท'), h('dd', {}, h('a', { href: COMPANY.webUrl, target: '_blank', rel: 'noopener' }, COMPANY.web))),
        h('div', { class: 'sx-co-act' }, h('a', { class: 's-btn primary', href: '#quote' }, 'ให้ทีมติดต่อกลับ'), h('a', { class: 's-btn ghost', href: '#area' }, 'ตรวจพื้นที่ให้บริการ'))),
      h('div', { class: 'sx-how' },
        h('h3', {}, 'ทำงานกับเราอย่างไร'),
        h('ol', {}, PROCESS.map(p => h('li', {}, h('b', {}, p.th), h('span', {}, p.d)))),
        h('h3', {}, 'มาตรฐานที่ตรวจสอบได้'),
        h('ul', { class: 'sx-std' }, ['ขั้นตอนงานล้างตามแบบฟอร์ม SBP-SR-ACCL-UNI-001', 'ขั้นตอนงานติดตั้งตามแบบฟอร์ม SBP-SR-ACIN-UNI-001', 'รับประกันงานติดตั้ง 3 ปี เมื่อซื้อเครื่องจากบริษัท · 1 ปี เมื่อจัดหาเครื่องเอง', 'ใบเสนอราคาระบุยี่ห้อและสเปกวัสดุ'].map(t => h('li', {}, t))))));
  }

  /* ---- 8 · contact form → a ticket in the back office (r10) · honest hand-off when the back office cannot be reached ---- */
  const qf = $('#qform');
  if (qf) {
    guardForm(qf);
    const sb = qf.querySelector('button:not([type="button"])'); if (sb) sb.textContent = 'ส่งคำขอให้ทีมติดต่อกลับ';
    const out = h('div', { class: 'sx-qout', hidden: true });
    qf.after(out);
    const TOPIC_SVC = { 'ล้างแอร์': 'clean', 'ติดตั้งแอร์': 'install', 'ซ่อม / ตรวจเช็ก': 'repair', 'สัญญาล้างรายปี': 'amc', 'ซื้อแอร์': 'buy', 'FUJIVA': 'buy', 'ระบบ VRV / VRF': 'project', 'งานโครงการ / รีโนเวต / เปลี่ยนทั้งชุด': 'project', 'งานโครงการอื่น': 'project' };
    qf.addEventListener('submit', async e => {
      e.preventDefault();
      const ref = 'R' + Date.now().toString().slice(-7);
      const lab = x => { const l = x.closest('label'); return l ? [...l.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').trim() : x.getAttribute('aria-label') || x.id; };
      const fields = [...qf.querySelectorAll('input,select,textarea')].filter(x => x.value && x.type !== 'hidden' && x.type !== 'checkbox' && !x.closest('.s-hp'));
      const rows = fields.map(x => `${lab(x)}: ${x.value}`);
      const val = re => (fields.find(x => re.test(x.id)) || {}).value || '';
      const t = cart.totals(), items = cart.items.length ? ['', `รายการในใบเสนอราคาเบื้องต้น (${cart.items.length} รายการ · รวม ${Math.round(t.inc).toLocaleString('th-TH')} บาท${t.tax === 'invoice' ? ' รวม VAT' : ''})`, ...cart.items.map(i => `• ${i.name} × ${i.qty}`)] : [];
      const topic = val(/^q-topic$/), n = +val(/-n$/) || 0;
      const ticket = { kind: 'inquiry', service: TOPIC_SVC[topic] || 'other', consent: true, website: (qf.querySelector('[name=website]') || {}).value || '', source: sourceTag(variant),
        customer: { name: val(/name/), tel: val(/tel/), email: (fields.find(x => x.type === 'email') || {}).value || '' },
        details: [topic ? `เรื่อง: ${topic}` : '', n ? `จำนวนเครื่องโดยประมาณ: ${n}` : ''].filter(Boolean).join('\n'), notes: val(/^q-msg$/), quote: quoteFromCart(cart) };
      await submitTicket(ticket, { out, form: qf, label: 'คำขอ', fallback: { ref, title: 'คำขอให้ทีมติดต่อกลับ', text: [`คำขอจากเว็บไซต์ SBP AirCare (แบบ ${variant}) · เลขอ้างอิง ${ref}`, ...rows, ...items].join('\n'), subject: 'คำขอให้ทีมติดต่อกลับ' } });
      if (J) { const q = stepsOf(J.k).find(s => s.id === 'quote'); q && markDone(q.i); }
      requestAnimationFrame(() => ORIG.call(out, { behavior: RM() ? 'auto' : 'smooth', block: 'nearest' }));
    });
  }

  /* ---- 9 · beta notice, feedback, footer, mobile bar ---- */
  const proto = $('aside.proto');
  // r13: the feedback form lives in feedback.js (D and the v2 editions use it too)
  const feedback = () => openFeedback({ variant, pages: live.map(v => VV[v].th), seen: [...seen].map(v => VV[v].th) });
  const fbBtn = () => h('button', { type: 'button', class: 'sx-fbb', onclick: feedback }, 'ให้ความเห็น');
  if (proto) {
    const hub = proto.querySelector('a');
    proto.innerHTML = ''; proto.classList.add('sx-beta');
    proto.append(h('b', {}, `ทดลองใช้ (Beta) · แบบ ${variant}`), h('span', { class: 'sx-bt' }, ' · ราคาจาก Pricebook 2569 · ช่วงทดลองระบบยังไม่ส่งคำขอถึงทีมอัตโนมัติ'), ' ', fbBtn(), ' ', perfButton(variant));
    if (hub) { hub.textContent = hubLabel; proto.append(' ', hub); }
  }
  const foot = $('footer');
  if (foot) {
    foot.innerHTML = '';
    foot.append(h('div', { class: 'wrap sx-foot' },
      h('div', {}, h('p', { class: 'sx-fb-marks' }, h('img', { src: logoSrc('sbp'), alt: COMPANY.th, width: 55, height: 40 }), h('img', { class: 'sx-fb-fuj', src: logoSrc('fujiva'), alt: 'FUJIVA แบรนด์แอร์ของบริษัท', width: 97, height: 32 })), h('b', { class: 'sx-fb-brand' }, COMPANY.brand), h('p', {}, COMPANY.th), h('p', {}, COMPANY.addr), h('p', {}, 'โทร ', h('a', { href: COMPANY.telHref }, COMPANY.tel), ' · ', h('span', { class: 'sx-sel' }, COMPANY.email))),
      h('div', {}, h('h2', { class: 'sx-fh' }, 'บริการและสินค้า'), h('ul', {}, live.filter(v => v !== 'home').map(v => h('li', {}, h('a', { href: '#' + v }, VV[v].th))))),
      h('div', {}, h('h2', { class: 'sx-fh' }, 'ช่วงทดลองใช้'), h('p', {}, 'เว็บไซต์เวอร์ชันทดลองสำหรับลูกค้ากลุ่มแรก ราคาตาม Pricebook 2569 ยืนยันอีกครั้งในใบเสนอราคาอย่างเป็นทางการ'), fbBtn()),
      h('div', {}, h('h2', { class: 'sx-fh' }, 'บริษัท'), h('ul', {}, h('li', {}, h('a', { href: '#about' }, 'เกี่ยวกับเรา')), h('li', {}, h('a', { href: COMPANY.webUrl, target: '_blank', rel: 'noopener' }, COMPANY.web)), h('li', {}, h('a', { href: '#faq' }, 'คำถามที่พบบ่อย'))))));
  }

  /* ---- 10 · find anything (r6): pages, paths, 705 models, every price item, guides, FAQ — header button or "/" ---- */
  const norm = t => (t || '').toLowerCase().replace(/[\s·/()–-]+/g, '');
  const IDX = [];
  const add = (g, th, sub, run, extra = '', btus = null) => IDX.push({ g, th, sub, run, key: norm(`${th} ${sub} ${extra}`), t: norm(th), btus });
  const priceGo = (tab, q) => priceItem ? priceItem(tab, q) : go('prices');
  const openIn = (view, sel, match) => { go(view); requestAnimationFrame(() => requestAnimationFrame(() => { const d = [...document.querySelectorAll(sel)].find(match); if (d) { d.open = true; ORIG.call(d, { block: 'center' }); } })); };
  Object.entries(JOURNEYS).forEach(([k, j]) => add('เริ่มเส้นทาง', j.th, j.sub || '', () => startJourney(k)));
  live.forEach(v => add('หน้า', VV[v].th, VV[v].lead || 'เลือกงานที่ต้องการ', () => go(v)));
  Object.keys(VOF).filter(id => SEC_TH[id] || labels[id]).forEach(id => add('หัวข้อ', L(id), `อยู่ในหน้า ${VV[VOF[id]].th}`, () => go(id)));
  DEMO.models.forEach(m => {
    const b = BRAND_BY_ID[m.brand], ps = m.skus.map(x => x.price).filter(n => n > 0), t = TYPE_BY_ID[m.type];
    add('รุ่นแอร์', `${b ? b.name : ''} ${m.series}`, [t ? t.th : '', m.skus.map(x => x.btu.toLocaleString()).join(' / ') + ' BTU', ps.length ? `เริ่ม ${baht(Math.min(...ps))}` : 'สอบถามราคา'].filter(Boolean).join(' · '),
      () => openModel ? openModel(m) : go('catalog'), m.skus.map(x => x.sku).join(' '), m.skus.map(x => x.btu));
  });
  DATA.inst.forEach(i => { const n = parseInt(i.cat, 10), tab = n <= 5 ? 'install' : n <= 10 ? 'mat' : n === 15 ? 'project' : 'move';
    add('ค่าบริการ', i.name, isVRF(i.name, i.cat) ? 'ติดต่อทีมโครงการ' : i.ex != null ? `${baht(i.ex)} ก่อน VAT` : 'ประเมินหน้างาน', () => priceGo(tab, i.name), `${i.code} ${i.cat}`); });
  DATA.rep.forEach(r => add('ค่าบริการ', `ซ่อม ${r.name}`, r.rate.s != null ? `${baht(r.rate.s)} ก่อน VAT` : 'ประเมินหน้างาน', () => priceGo('repair', r.name), r.cat));
  GUIDES.forEach(gd => add('ความรู้', gd.th, gd.lead || '', () => openIn('knowledge', '.kh-card', d => d.id === 'kh-' + gd.id)));
  FAQ.forEach(f => add('คำถามที่พบบ่อย', f.q, f.a.slice(0, 70) + '…', () => openIn('contact', '#faqList details', d => (d.querySelector('summary') || {}).textContent === f.q), f.a));
  const GROUPS = [['เริ่มเส้นทาง', 5], ['หน้า', 6], ['หัวข้อ', 5], ['รุ่นแอร์', 6], ['ค่าบริการ', 6], ['ความรู้', 4], ['คำถามที่พบบ่อย', 4]];
  function find(q) {
    const words = q.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    if (!words.length) return IDX.filter(x => x.g === 'เริ่มเส้นทาง' || x.g === 'หน้า');
    // a size ("12000", "12k", "12,000") matches models within ±12 % (brands rate 12,000-class units 11,900–12,300 BTU)
    const size = w => { const m = /^(\d{1,3}(?:,\d{3})+|\d+)(k)?(btu)?$/.exec(w); if (!m) return 0; const n = +m[1].replace(/,/g, '') * (m[2] ? 1000 : 1); return n >= 5000 && n <= 400000 ? n : 0; };
    const sizes = words.map(size), w0 = words.filter((w, i) => !sizes[i]).join('');
    const ok = (x, w, i) => sizes[i] && x.btus ? x.btus.some(b => Math.abs(b - sizes[i]) / sizes[i] <= 0.12) : x.key.includes(w);
    const hit = IDX.filter(x => words.every((w, i) => ok(x, w, i))).map(x => ({ x, r: !w0 ? 1 : x.t.startsWith(w0) ? 0 : x.t.includes(w0) ? 1 : 2 }));
    return GROUPS.flatMap(([g, n]) => hit.filter(o => o.x.g === g).sort((a, b) => a.r - b.r).slice(0, n).map(o => o.x));
  }
  let sdlg = null;
  function openSearch() {
    if (sdlg) return;
    const prev = document.activeElement, de = document.documentElement, ov = de.style.overflow;
    const input = h('input', { type: 'search', class: 'sx-sq', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'sx-sres', 'aria-autocomplete': 'list', autocomplete: 'off', enterkeyhint: 'go', 'aria-label': 'ค้นหาในเว็บไซต์', placeholder: 'ค้นหารุ่นแอร์ ค่าบริการ ขั้นตอน หรือคำถาม' });
    const list = h('div', { class: 'sx-sres', id: 'sx-sres', role: 'listbox', 'aria-label': 'ผลการค้นหา' });
    const sLive = h('p', { class: 'sx-slive', 'aria-live': 'polite' });
    let opts = [], act = -1;
    const close = () => { if (!sdlg) return; sdlg.remove(); sdlg = null; de.style.overflow = ov; prev && prev.focus && prev.focus({ preventScroll: true }); };
    const run = o => { close(); o.run(); };
    const setAct = i => { act = i; opts.forEach((o, k) => o.el.setAttribute('aria-selected', String(k === i))); if (opts[i]) { input.setAttribute('aria-activedescendant', opts[i].el.id); opts[i].el.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant'); };
    function paint() {
      const q = input.value.trim(), res = find(q); list.innerHTML = ''; opts = [];
      let g = null, grp = null;
      res.forEach((x, k) => {
        if (x.g !== g) { g = x.g; const gid = 'sx-sg' + k; grp = h('div', { role: 'group', 'aria-labelledby': gid }, h('p', { class: 'sx-sg', id: gid }, q ? g : g === 'หน้า' ? 'ไปที่หน้า' : 'เริ่มจากสิ่งที่ต้องการ')); list.append(grp); }
        const el = h('div', { class: 'sx-so', role: 'option', id: 'sx-o' + k, 'aria-selected': 'false' }, h('b', {}, x.th), x.sub ? h('small', {}, x.sub) : null);
        el.addEventListener('click', () => run(x)); el.addEventListener('mousemove', () => { if (act !== opts.findIndex(o => o.el === el)) setAct(opts.findIndex(o => o.el === el)); });
        grp.append(el); opts.push({ el, x });
      });
      if (!res.length) list.append(h('div', { class: 'sx-snone' }, h('p', {}, `ไม่พบ “${q}” ลองชื่อแบรนด์ ขนาด BTU เช่น 12000 หรือชื่องาน เช่น ล้างแอร์`), h('button', { type: 'button', class: 's-btn ghost', onclick: () => { close(); askTeam('อื่น ๆ', `ค้นหาในเว็บไซต์: ${q}`); } }, 'ถามทีมของเรา')));
      sLive.textContent = q ? (res.length ? `พบ ${res.length} รายการ` : 'ไม่พบรายการ') : '';
      setAct(res.length ? 0 : -1);
    }
    input.addEventListener('input', paint);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (opts.length) setAct((act + 1) % opts.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (opts.length) setAct((act - 1 + opts.length) % opts.length); }
      else if (e.key === 'Enter') { e.preventDefault(); if (opts[act]) run(opts[act].x); }
    });
    sdlg = h('div', { class: 'sx-sdlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'ค้นหาในเว็บไซต์' },
      h('div', { class: 'sx-sbox' },
        h('div', { class: 'sx-sin' }, icon('search', { size: 20 }), input, h('button', { type: 'button', class: 'sx-sx', onclick: close }, 'ปิด')),
        list, sLive, h('p', { class: 'sx-shint' }, 'ลูกศรขึ้นลงเพื่อเลือก · Enter เพื่อเปิด · Esc เพื่อปิด')));
    sdlg.addEventListener('click', e => { if (e.target === sdlg) close(); });
    sdlg.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    trapFocus(sdlg);
    document.body.append(sdlg); de.style.overflow = 'hidden'; paint(); input.focus();
  }
  const hdrCart = $('header [data-cart-btn]');
  if (hdrCart) hdrCart.before(h('button', { type: 'button', class: 'sx-sbtn', 'aria-label': 'ค้นหาในเว็บไซต์', 'aria-keyshortcuts': '/', 'aria-haspopup': 'dialog', onclick: openSearch }, icon('search', { size: 18 }), h('span', {}, 'ค้นหา'), h('kbd', { 'aria-hidden': 'true' }, '/')));
  addEventListener('keydown', e => { if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || sdlg) return; const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; e.preventDefault(); openSearch(); });

  // keep Tab inside an open dialog (search, feedback)
  route(location.hash, true);
  return { go, view: () => cur, startJourney, openFeedback: feedback, openSearch };
}
