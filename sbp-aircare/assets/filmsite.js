// SBP AirCare — page wiring of the r16 editions (a2/b2/c2/d2.html, owner 6 ต.ค. 2569: "รื้อโครงสร้างและทำใหม่ … ทำมา 4 แบบ
// ให้เลือก … ทุกหัวข้อต้องมีภาพประกอบ animation … และสามารถขายบริการและสินค้าได้จริง"). Each edition is its own layout and art
// direction; the behaviour is one:
//   · chapters ([data-film]) played by the film director (film.js) — every chapter has its own 3D scene
//   · unit stages ([data-stage]) share ONE cinema (stage.js): the hero, the showroom, the concierge
//   · sales panels ([data-sell]) priced from the Pricebook (filmsell.js), the showroom ([data-showroom]), the concierge
//     ([data-concierge]), booking (#bookRoot), the quote basket, the price centre and product drawers, area, FAQ, contact
//   · everything mounts when the visitor gets near it — the first paint is static HTML and a poster frame
// mountFilmSite({variant, theme, mood, quality, bars, place, srStart, autoplay, onStep, onDone, onBuilt}) → api
import { loadData, COMPANY, FAQ, h, $, $$ } from './sbp-core.js';
import { mountFaq, wireDrawers, openDrawer, closeDrawer, toast } from './proto-ui.js';
import { mountCart, productDetail, mountPriceCenter, cart } from './commerce.js';
import { enhanceQuoteForm } from './contact.js';
import { mountBooking } from './booking.js';
import { whenNear, wireContactForm, fillFacts } from './dstudio.js';
import { createStage, stageLabels } from './stage.js';
import { mountConcierge } from './concierge.js';
import { mountShowroom } from './showroom.js';
import { mountBeta } from './feedback.js';
import { mountFilm } from './film.js';
import { kinetic, grain, sound } from './filmfx.js';
import { cleanPanel, installPanel, roomPanel, repairPanel, qualityPanel, businessPanel, areaPanel } from './filmsell.js';

export async function mountFilmSite({ variant = 'A2', theme = 'dark', mood = 'aurora', quality = 'auto', bars = false, place = 'home', srStart = {}, autoplay = true, onStep, onDone, onBuilt } = {}) {
  await loadData();
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = sel => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
  fillFacts();
  $$('[data-company]').forEach(el => { const k = el.dataset.company; if (COMPANY[k]) el.textContent = COMPANY[k]; if (k === 'tel' && el.href) el.href = COMPANY.telHref; });
  kinetic();
  $$('.fx-grain').forEach(grain);

  // header: menu on narrow screens, solid once the page scrolls
  const menu = $('.v-menu'), nav = $('#v-nav');
  if (menu && nav) {
    menu.addEventListener('click', () => { const o = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(o)); nav.classList.toggle('open', o); });
    nav.addEventListener('click', e => { if (e.target.closest('a')) { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); } });
  }
  const hd = $('.v-hd');
  if (hd) { const upd = () => hd.classList.toggle('solid', scrollY > 40); addEventListener('scroll', upd, { passive: true }); upd(); }
  // --hd: where the fixed header (with the beta bar inside it) ends — full-screen stages start below it
  if (hd && getComputedStyle(hd).position === 'fixed') {
    const hdH = () => document.documentElement.style.setProperty('--hd', Math.round(hd.getBoundingClientRect().bottom) + 'px');
    hdH(); if ('ResizeObserver' in window) new ResizeObserver(hdH).observe(hd); addEventListener('resize', hdH);
  }

  // the shared cinema (unit stages) + the film chapters
  const stage = createStage({ mood, quality, bars });
  const film = mountFilm({ stage, theme, mood, quality, autoplay, onStep, onDone, onBuilt });

  // which chapter is on screen: links to it get aria-current (chapter index, side rail, HUD)
  const links = $$('a[href^="#"]').filter(a => a.closest('[data-spy]'));
  if (links.length) {
    const secs = [...new Set(links.map(a => $(a.getAttribute('href'))).filter(Boolean))];
    const vis = new Map();
    const io = new IntersectionObserver(es => {
      es.forEach(e => vis.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0));
      let best = null, bv = 0; vis.forEach((v, s) => { if (v > bv) { bv = v; best = s; } });
      links.forEach(a => { const on = best && a.getAttribute('href') === '#' + best.id; if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      document.documentElement.dataset.chapter = best ? best.id : '';
    }, { threshold: [0, 0.1, 0.3, 0.5, 0.7, 1] });
    secs.forEach(s => io.observe(s));
  }

  // quote basket + booking
  mountCart();
  let BK = null;
  const booking = () => BK || (BK = mountBooking($('#bookRoot'), { variant, hl: 'h3' }));
  if ($('#bookRoot')) whenNear($('#booking') || $('#bookRoot'), booking, '900px 0px');
  const book = p => { if (!$('#bookRoot')) return; booking().preset(p || {}); go('#booking'); };
  $$('[data-book]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); book({ service: b.dataset.book || undefined }); }));

  // drawers: price centre, product detail (with its own 3D view of the model)
  const openPrices = tab => { const body = $('#drawerBody'); body.replaceChildren(); const box = h('div', { id: 'priceCenter' }); body.append(h('h3', { class: 'd-dh' }, 'ราคาค่าบริการทั้งหมด'), box); mountPriceCenter(box).show(tab); openDrawer($('#drawer')); };
  $$('[data-prices]').forEach(b => b.addEventListener('click', () => openPrices(b.dataset.prices || 'clean')));
  function openProduct(m, idx = 0) {
    const body = $('#drawerBody'); body.replaceChildren(productDetail(m, idx, { onPick: i => openProduct(m, i) }));
    if ($('#drawer').hidden) openDrawer($('#drawer'));
  }
  wireDrawers();

  // sound: the cinema's room sound + the interface tones, only from a click
  $$('[data-sound]').forEach(b => b.addEventListener('click', () => {
    const want = b.getAttribute('aria-pressed') !== 'true', got = sound(want);
    $$('[data-sound]').forEach(x => x.setAttribute('aria-pressed', String(got)));
    stage.with(c => c.sound(got));
  }));

  // showroom (every catalogue model on the shared cinema)
  let SR = null;
  const srRoot = $('[data-showroom]');
  const srSlot = srRoot ? (srRoot.closest('[data-film]') || document).querySelector('[data-stage]') : null;
  const showroom = () => SR || (srRoot && srSlot ? (SR = mountShowroom(srRoot, { stage, slot: srSlot, ctl: $('[data-sr-ctl]'), start: srStart, onOpen: openProduct, onBook: book, hl: 'h3' })) : null);
  if (srRoot) whenNear(srRoot.closest('section') || srRoot, showroom, '900px 0px');
  const shop = f => { const s = showroom(); if (s) { s.filter(f); go(srRoot.closest('section') || srRoot); } };
  $$('[data-shop]').forEach(b => b.addEventListener('click', () => shop({ type: b.dataset.shop || 'wall' })));

  // concierge (symptoms → common causes on its own unit stage → what to do → price)
  const ccRoot = $('[data-concierge]'), ccSlot = $('[data-cc-stage]');
  if (ccRoot && ccSlot) {
    const labels = stageLabels(ccSlot, stage);
    whenNear(ccRoot.closest('section') || ccRoot, () => mountConcierge(ccRoot, { stage, slot: ccSlot, labels, place, onBook: book, onPrices: openPrices, onShop: shop }), '900px 0px');
  }

  // sales panels
  const mapCh = () => film.chapters.find(c => c.spec.kind === 'map');
  // a panel may start from the page's own choice: data-start='{"type":"ceiling"}'
  const start = el => { try { return JSON.parse(el.dataset.start || '{}'); } catch (_) { return {}; } };
  const SELL = {
    clean: el => cleanPanel(el, { onBook: book, onPrices: openPrices, onBusiness: $('#plan, #business') ? () => go($('#plan, #business')) : null, start: { ...(place === 'office' ? { type: 'cassette', pkg: 'Corporate Control' } : {}), ...start(el) } }),
    install: el => installPanel(el, { onBook: book, onShop: srRoot ? shop : null, start: start(el) }),
    room: el => roomPanel(el, { onShop: srRoot ? shop : null, use: place === 'office' ? 'office' : place === 'shop' ? 'shop' : 'home' }),
    repair: el => repairPanel(el, { onPrices: openPrices }),
    quality: el => qualityPanel(el, { onInstall: $('#install') ? () => go('#install') : null }),
    business: el => businessPanel(el, { onCatalog: srRoot ? () => go(srRoot.closest('section') || srRoot) : null }),
    area: el => areaPanel(el, { onZone: z => { const c = mapCh(); if (c && c.scene) c.scene.api.highlight(z); } }),
  };
  const panels = {};
  $$('[data-sell]').forEach(el => { const k = el.dataset.sell, f = SELL[k]; if (f) whenNear(el, () => { panels[k] = f(el); }, '900px 0px'); });

  // FAQ + contact
  whenNear($('#contact'), () => {
    const fl = $('#faqList'); if (fl) { FAQ.forEach(f => fl.append(h('details', { class: 'd-faq' }, h('summary', {}, f.q), h('p', {}, f.a)))); mountFaq(fl); }
    const qf = $('#qform'); if (qf) { enhanceQuoteForm(qf); wireContactForm(qf, { variant }); }
  });
  mountBeta({ variant });
  document.documentElement.classList.add('film-on', 'v2-on');   // tests: the page script has finished wiring
  return { stage, film, book, go, openPrices, openProduct, showroom, shop, panels, cart, toast, sound };
}
